/**
 * PREPMATE — AUDIO PLAYBACK COMPONENT (WI-COACH-AUDIO-01 STEP 2)
 *
 * Renders dedicated audio playback controls per turn/question for interview
 * chat messages and post-interview debrief reports.
 *
 * Features:
 *   - Play / Pause / Seek per individual question answer.
 *   - Mutual exclusion: playing one answer automatically pauses any other playing audio.
 *   - Accurate duration formatting (mm:ss).
 *   - Transparent label: "Bản ghi âm toàn lượt trả lời (không ước lượng timestamp)".
 *   - Graceful fallback when recording is absent or audio playback fails.
 */

(function () {
  "use strict";

  let _activeAudioInstance = null;
  let _activePlayingBtn = null;

  function formatTime(msOrSec) {
    if (!msOrSec || isNaN(msOrSec) || msOrSec < 0) return "00:00";
    const totalSec = msOrSec > 1000 ? Math.floor(msOrSec / 1000) : Math.floor(msOrSec);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  function stopCurrentlyPlaying() {
    if (_activeAudioInstance) {
      try {
        _activeAudioInstance.pause();
        _activeAudioInstance.currentTime = 0;
      } catch (e) {}
      _activeAudioInstance = null;
    }
    if (_activePlayingBtn) {
      _activePlayingBtn.classList.remove("is-playing");
      _activePlayingBtn.setAttribute("aria-label", "Phát lại bản ghi âm");
      const icon = _activePlayingBtn.querySelector(".play-icon");
      if (icon) icon.innerHTML = "▶";
      const label = _activePlayingBtn.querySelector(".play-label");
      if (label) label.textContent = "Nghe lại";
      _activePlayingBtn = null;
    }
  }

  /**
   * Creates an interactive audio player DOM element for a given turn recording.
   * @param {Object} recordingRecord - { id, sessionId, turnIndex, question, audioBlob, durationMs, mimeType }
   * @param {Object} options - { compact: boolean, showNote: boolean }
   * @returns {HTMLElement}
   */
  function audioBufferToWavBlob(audioBuffer) {
    if (!audioBuffer) return null;
    const numChannels = audioBuffer.numberOfChannels || 1;
    const sampleRate = audioBuffer.sampleRate || 16000;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const numSamples = audioBuffer.length || 0;
    const dataByteLength = numSamples * blockAlign;
    const buffer = new ArrayBuffer(44 + dataByteLength);
    const view = new DataView(buffer);

    function writeString(offset, str) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataByteLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataByteLength, true);

    let offset = 44;
    const channels = [];
    for (let c = 0; c < numChannels; c++) {
      channels.push(typeof audioBuffer.getChannelData === 'function' ? audioBuffer.getChannelData(c) : new Float32Array(numSamples));
    }

    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = channels[c][i];
        sample = Math.max(-1, Math.min(1, sample));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  function sliceAndConcatenateAudio(audioBuffer, speechSegments) {
    if (!audioBuffer || !speechSegments || speechSegments.length === 0) return null;
    const sampleRate = audioBuffer.sampleRate || 16000;
    const numChannels = audioBuffer.numberOfChannels || 1;
    const totalBufferSamples = audioBuffer.length || (audioBuffer.getChannelData(0) ? audioBuffer.getChannelData(0).length : 0);

    let totalSamples = 0;
    const ranges = [];
    for (const seg of speechSegments) {
      const start = Math.max(0, Math.min(totalBufferSamples, Math.floor(seg.startMs * sampleRate / 1000)));
      const end = Math.max(start, Math.min(totalBufferSamples, Math.floor(seg.endMs * sampleRate / 1000)));
      const len = end - start;
      if (len > 0) {
        ranges.push({ start, end, len });
        totalSamples += len;
      }
    }

    if (totalSamples === 0) return null;

    const fadeSamples = Math.min(Math.floor(sampleRate * 0.005), 100);
    const channelArrays = [];

    for (let c = 0; c < numChannels; c++) {
      const src = audioBuffer.getChannelData(c);
      const dest = new Float32Array(totalSamples);
      let offset = 0;

      for (const r of ranges) {
        dest.set(src.subarray(r.start, r.end), offset);
        for (let f = 0; f < fadeSamples && f < r.len; f++) {
          dest[offset + f] *= (f / fadeSamples);
        }
        for (let f = 0; f < fadeSamples && f < r.len; f++) {
          dest[offset + r.len - 1 - f] *= (f / fadeSamples);
        }
        offset += r.len;
      }
      channelArrays.push(dest);
    }

    return {
      numberOfChannels: numChannels,
      sampleRate: sampleRate,
      length: totalSamples,
      duration: totalSamples / sampleRate,
      getChannelData: (c) => channelArrays[c]
    };
  }

  async function createSpeechOnlyAudioBlob(blob, precomputedSegments = null) {
    if (!blob || !(blob.size > 0)) return null;

    const AudioCtx = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
      ? (window.AudioContext || window.webkitAudioContext)
      : null;
    if (!AudioCtx) return null;

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const ctx = new AudioCtx();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      if (ctx.close && ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }

      let segments = precomputedSegments;
      if (!segments || segments.length === 0) {
        const vadFn = (typeof PrepMateAudioRecorder !== 'undefined' && PrepMateAudioRecorder.analyzePcmVoiceActivity)
          ? PrepMateAudioRecorder.analyzePcmVoiceActivity
          : ((typeof SpeechCoachingEngine !== 'undefined' && SpeechCoachingEngine.analyzePcmVoiceActivity) ? SpeechCoachingEngine.analyzePcmVoiceActivity : null);
        if (vadFn) {
          const vad = vadFn(audioBuffer.getChannelData(0), audioBuffer.sampleRate);
          if (!vad.hasSpeech || !vad.speechSegments || vad.speechSegments.length === 0) {
            return {
              hasSpeech: false,
              isPureSilence: true,
              speechSegments: [],
              blob: null,
              durationMs: 0,
              originalDurationMs: Math.round(audioBuffer.duration * 1000)
            };
          }
          segments = vad.speechSegments;
        }
      }

      if (!segments || segments.length === 0) {
        return null;
      }

      const filteredBuffer = sliceAndConcatenateAudio(audioBuffer, segments);
      if (!filteredBuffer) {
        return {
          hasSpeech: false,
          isPureSilence: true,
          speechSegments: [],
          blob: null,
          durationMs: 0,
          originalDurationMs: Math.round(audioBuffer.duration * 1000)
        };
      }

      const wavBlob = audioBufferToWavBlob(filteredBuffer);
      return {
        hasSpeech: true,
        isPureSilence: false,
        speechSegments: segments,
        blob: wavBlob,
        durationMs: Math.round(filteredBuffer.duration * 1000),
        originalDurationMs: Math.round(audioBuffer.duration * 1000)
      };
    } catch (e) {
      console.warn('[AUDIO PLAYER] createSpeechOnlyAudioBlob error:', e);
      return null;
    }
  }

  function createAudioPlayerElement(recordingRecord, options = {}) {
    const container = document.createElement("div");
    container.className = "pm-audio-player-widget";
    if (options.compact) container.classList.add("compact");

    // 1. Check absent recording
    if (!recordingRecord || !recordingRecord.audioBlob || !(recordingRecord.audioBlob.size > 0)) {
      container.classList.add("no-recording");
      container.innerHTML = `
        <div class="pm-audio-empty-notice">
          <span class="empty-icon">🔇</span>
          <span class="empty-text">Không có bản ghi âm cho lượt trả lời này (người dùng nhập văn bản hoặc micro tắt).</span>
        </div>
      `;
      return container;
    }

    // 2. Check pure silence (explicit flags or 0 active speech with >= 600ms total duration)
    const isExplicitlyPureSilence = Boolean(
      recordingRecord.isPureSilence === true ||
      recordingRecord.hasSpeech === false ||
      (typeof recordingRecord.speechActiveMs === "number" && recordingRecord.speechActiveMs === 0 && (recordingRecord.durationMs || 0) >= 600)
    );

    if (isExplicitlyPureSilence) {
      container.classList.add("no-speech", "is-silence");
      container.innerHTML = `
        <div class="pm-audio-empty-notice silence-notice">
          <span class="empty-icon">🔇</span>
          <span class="empty-text">Không ghi nhận được giọng nói trong lượt này (bản ghi âm hoàn toàn im lặng).</span>
        </div>
      `;
      return container;
    }

    // 3. Render Speech-Only Player Widget
    const hasFilteredMs = typeof recordingRecord.speechActiveMs === "number" && recordingRecord.speechActiveMs > 0;
    const initialDurationMs = hasFilteredMs ? recordingRecord.speechActiveMs : (recordingRecord.durationMs || 0);
    const durationText = formatTime(initialDurationMs);
    const turnLabel = recordingRecord.turnIndex === 0
      ? "Lượt giới thiệu bản thân"
      : ("Lượt trả lời câu " + recordingRecord.turnIndex);

    let objectUrl = null;
    let initialBlobToPlay = recordingRecord.derivedSpeechBlob || recordingRecord.audioBlob;
    try {
      objectUrl = URL.createObjectURL(initialBlobToPlay);
    } catch (e) {
      console.warn("[AUDIO PLAYER] Cannot create ObjectURL for blob:", e);
    }

    if (!objectUrl) {
      container.classList.add("error");
      container.innerHTML = `<span class="empty-text">Lỗi đọc file âm thanh của lượt này.</span>`;
      return container;
    }

    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = objectUrl;

    const isFiltered = hasFilteredMs && recordingRecord.durationMs && (recordingRecord.durationMs - recordingRecord.speechActiveMs >= 600);
    const filterTagHtml = isFiltered
      ? '<span class="speech-filter-badge" title="Tự động lọc khoảng lặng dài, chỉ phát giọng nói">🎙️ Đã lọc khoảng lặng</span>'
      : "";

    container.innerHTML = `
      <div class="pm-audio-player-inner">
        <button type="button" class="pm-audio-play-btn" aria-label="Phát lại bản ghi âm" title="Phát lại bản ghi âm của lượt này">
          <span class="play-icon">▶</span>
          <span class="play-label">Nghe lại</span>
        </button>

        <div class="pm-audio-timeline">
          <div class="pm-audio-progress-bar">
            <div class="pm-audio-progress-fill" style="width: 0%;"></div>
          </div>
          <div class="pm-audio-time-meta">
            <span class="pm-audio-current-time">00:00</span>
            <span class="pm-audio-divider">/</span>
            <span class="pm-audio-total-time">${durationText}</span>
          </div>
        </div>

        <div class="pm-audio-badge-info" title="Bản ghi âm lượt trả lời">
          <span class="turn-tag">${turnLabel}</span>
          ${filterTagHtml}
        </div>
      </div>
      ${options.showNote !== false ? `
        <div class="pm-audio-disclaimer">
          <span class="disclaimer-dot">ℹ️</span>
          <span>Bản ghi âm toàn lượt trả lời (đã lọc khoảng lặng, Web Speech API không hỗ trợ timestamp cấp từ).</span>
        </div>
      ` : ""}
    `;

    const playBtn = container.querySelector(".pm-audio-play-btn");
    const progressFill = container.querySelector(".pm-audio-progress-fill");
    const progressBar = container.querySelector(".pm-audio-progress-bar");
    const currentTimeEl = container.querySelector(".pm-audio-current-time");
    const totalTimeEl = container.querySelector(".pm-audio-total-time");
    const playIcon = playBtn ? playBtn.querySelector(".play-icon") : null;
    const playLabel = playBtn ? playBtn.querySelector(".play-label") : null;

    audio.onloadedmetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        totalTimeEl.textContent = formatTime(audio.duration);
      }
    };

    audio.ontimeupdate = () => {
      const cur = audio.currentTime;
      const dur = audio.duration || (initialDurationMs / 1000) || 1;
      const pct = Math.min(100, (cur / dur) * 100);
      if (progressFill) progressFill.style.width = pct + "%";
      if (currentTimeEl) currentTimeEl.textContent = formatTime(cur);
    };

    audio.onended = () => {
      if (playBtn) {
        playBtn.classList.remove("is-playing");
        playBtn.setAttribute("aria-label", "Phát lại bản ghi âm");
        if (playIcon) playIcon.innerHTML = "▶";
        if (playLabel) playLabel.textContent = "Nghe lại";
      }
      if (progressFill) progressFill.style.width = "0%";
      if (currentTimeEl) currentTimeEl.textContent = "00:00";
      if (_activeAudioInstance === audio) {
        _activeAudioInstance = null;
        _activePlayingBtn = null;
      }
    };

    audio.onerror = () => {
      if (playBtn) {
        playBtn.classList.remove("is-playing");
        if (playIcon) playIcon.innerHTML = "⚠️";
        if (playLabel) playLabel.textContent = "Lỗi phát";
      }
      if (_activeAudioInstance === audio) {
        _activeAudioInstance = null;
        _activePlayingBtn = null;
      }
    };

    if (playBtn) {
      playBtn.onclick = (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();

        if (audio.paused) {
          stopCurrentlyPlaying();
          _activeAudioInstance = audio;
          _activePlayingBtn = playBtn;
          audio.play().then(() => {
            playBtn.classList.add("is-playing");
            playBtn.setAttribute("aria-label", "Tạm dừng phát âm thanh");
            if (playIcon) playIcon.innerHTML = "⏸";
            if (playLabel) playLabel.textContent = "Tạm dừng";
          }).catch((err) => {
            console.warn("[AUDIO PLAYER] Playback blocked or failed:", err);
          });
        } else {
          audio.pause();
          playBtn.classList.remove("is-playing");
          playBtn.setAttribute("aria-label", "Phát tiếp bản ghi âm");
          if (playIcon) playIcon.innerHTML = "▶";
          if (playLabel) playLabel.textContent = "Phát tiếp";
          if (_activeAudioInstance === audio) {
            _activeAudioInstance = null;
            _activePlayingBtn = null;
          }
        }
      };
    }

    if (progressBar) {
      progressBar.onclick = (e) => {
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        const dur = audio.duration || (initialDurationMs / 1000) || 0;
        if (dur > 0) {
          audio.currentTime = ratio * dur;
          if (progressFill) progressFill.style.width = (ratio * 100) + "%";
          if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
        }
      };
    }

    // Asynchronously perform silence filtering & derive speech-only WAV blob in live browser
    if (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext) && !recordingRecord.derivedSpeechBlob) {
      createSpeechOnlyAudioBlob(recordingRecord.audioBlob, recordingRecord.speechSegments).then(res => {
        if (!res) return;
        if (res.isPureSilence) {
          stopCurrentlyPlaying();
          container.className = "pm-audio-player-widget no-speech is-silence" + (options.compact ? " compact" : "");
          container.innerHTML = `
            <div class="pm-audio-empty-notice silence-notice">
              <span class="empty-icon">🔇</span>
              <span class="empty-text">Không ghi nhận được giọng nói trong lượt này (bản ghi âm hoàn toàn im lặng).</span>
            </div>
          `;
          return;
        }
        if (res.hasSpeech && res.blob) {
          try {
            const speechUrl = URL.createObjectURL(res.blob);
            audio.src = speechUrl;
            if (res.durationMs && totalTimeEl) {
              totalTimeEl.textContent = formatTime(res.durationMs);
            }
            const badgeContainer = container.querySelector(".pm-audio-badge-info");
            if (badgeContainer && !badgeContainer.querySelector(".speech-filter-badge")) {
              const b = document.createElement("span");
              b.className = "speech-filter-badge";
              b.title = "Tự động lọc khoảng lặng dài, chỉ phát phần giọng nói";
              b.textContent = "🎙️ Đã lọc khoảng lặng";
              badgeContainer.appendChild(b);
            }
          } catch(e) {}
        }
      }).catch(err => {
        console.warn("[AUDIO PLAYER] Background speech filter error:", err);
      });
    }

    return container;
  }

  const PrepMateAudioPlayer = {
    createAudioPlayerElement,
    formatTime,
    stopCurrentlyPlaying,
    createSpeechOnlyAudioBlob,
    audioBufferToWavBlob,
    sliceAndConcatenateAudio
  };

  if (typeof window !== "undefined") {
    window.PrepMateAudioPlayer = PrepMateAudioPlayer;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = PrepMateAudioPlayer;
  }
})();