/**
 * PREPMATE — AUDIO RECORDING SUBSYSTEM (WI-COACH-AUDIO-01)
 *
 * Records real candidate audio per turn/question using MediaRecorder API,
 * manages local persistence in IndexedDB (prepmate_audio_db), and
 * provides playback Blobs with duration tracking.
 *
 * Safety & Privacy:
 *   - Audio is stored strictly locally in client-side IndexedDB scoped by sessionId.
 *   - Clear disclosure provided to user; mic denial does not break interview/STT.
 *   - Auto-cleanup capability for expired sessions.
 */

(function () {
  "use strict";

  const DB_NAME = "prepmate_audio_db";
  const DB_VERSION = 1;
  const STORE_NAME = "answer_recordings";

  // In-memory fallback if IndexedDB is unavailable
  const _memoryStore = new Map();

  // Active recording state
  let _mediaStream = null;
  let _mediaRecorder = null;
  let _activeChunks = [];
  let _recordingStartTime = 0;
  let _recordingTotalPausedTime = 0;
  let _recordingPauseStart = 0;
  let _currentTurnIndex = null;
  let _currentQuestionText = "";
  let _isRecordingActive = false;
  let _isRecordingPaused = false;
  let _micPermissionDenied = false;

  // Preflight preview state (WI-INTERVIEW-PREFLIGHT-01)
  let _preflightAudioContext = null;
  let _preflightAnalyser = null;
  let _preflightSource = null;
  let _preflightTimer = null;
  let _isMicPreviewActive = false;

  // --------------------------------------------------------------------------
  // 1. INDEXEDDB REPOSITORY
  // --------------------------------------------------------------------------

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        return resolve(null); // Fallback to memory store
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("sessionId", "sessionId", { unique: false });
          store.createIndex("recordedAt", "recordedAt", { unique: false });
        }
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => {
        console.warn("[AUDIO RECORDER] IndexedDB open error:", event.target.error);
        resolve(null);
      };
    });
  }

  async function saveRecordingToStore(recordingRecord) {
    if (!recordingRecord || !recordingRecord.id) return false;

    try {
      const db = await openDatabase();
      if (!db) {
        _memoryStore.set(recordingRecord.id, recordingRecord);
        return true;
      }

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(recordingRecord);

        req.onsuccess = () => resolve(true);
        req.onerror = (e) => {
          console.warn("[AUDIO RECORDER] Failed to save record:", e.target.error);
          _memoryStore.set(recordingRecord.id, recordingRecord);
          resolve(false);
        };
      });
    } catch (e) {
      console.warn("[AUDIO RECORDER] Save exception:", e);
      _memoryStore.set(recordingRecord.id, recordingRecord);
      return false;
    }
  }

  async function getRecordingFromStore(id) {
    if (!id) return null;
    if (_memoryStore.has(id)) return _memoryStore.get(id);

    try {
      const db = await openDatabase();
      if (!db) return null;

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  async function getAllRecordingsForSession(sessionId) {
    if (!sessionId) return [];

    const results = [];
    // Check memory store
    for (const [key, val] of _memoryStore.entries()) {
      if (val && val.sessionId === sessionId) {
        results.push(val);
      }
    }

    try {
      const db = await openDatabase();
      if (!db) return results;

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], "readonly");
        const store = tx.objectStore(STORE_NAME);
        const index = store.index("sessionId");
        const req = index.getAll(sessionId);

        req.onsuccess = () => {
          const list = req.result || [];
          // Deduplicate with memory store
          const map = new Map();
          results.forEach((r) => map.set(r.turnIndex, r));
          list.forEach((r) => map.set(r.turnIndex, r));
          const sorted = Array.from(map.values()).sort((a, b) => a.turnIndex - b.turnIndex);
          resolve(sorted);
        };
        req.onerror = () => resolve(results);
      });
    } catch (e) {
      return results;
    }
  }

  async function deleteRecordingsForSession(sessionId) {
    if (!sessionId) return false;

    for (const [key, val] of _memoryStore.entries()) {
      if (val && val.sessionId === sessionId) {
        _memoryStore.delete(key);
      }
    }

    try {
      const db = await openDatabase();
      if (!db) return true;

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const index = store.index("sessionId");
        const req = index.openCursor(IDBKeyRange.only(sessionId));

        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve(true);
          }
        };
        req.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // 2. RECORDER ENGINE LIFECYCLE & VOICE ACTIVITY DETECTION (VAD)
  // --------------------------------------------------------------------------

  /**
   * Deterministic client-side Voice Activity Detection on PCM Float32Array
   */
  function analyzePcmVoiceActivity(channelData, sampleRate = 16000) {
    if (!channelData || channelData.length === 0) {
      return {
        speechActiveMs: 0,
        silenceMs: 0,
        totalDurationMs: 0,
        speechRatio: 0,
        isReliable: false,
        basis: "insufficient_data",
        method: "empty_buffer"
      };
    }

    const totalSamples = channelData.length;
    const totalDurationMs = Math.round((totalSamples / sampleRate) * 1000);

    if (totalDurationMs < 800) {
      return {
        speechActiveMs: 0,
        silenceMs: totalDurationMs,
        totalDurationMs,
        speechRatio: 0,
        isReliable: false,
        basis: "insufficient_data",
        method: "duration_too_short"
      };
    }

    // 25ms window, 10ms hop
    const frameSamples = Math.floor(sampleRate * 0.025);
    const hopSamples = Math.floor(sampleRate * 0.010);

    const frameEnergies = [];
    const frameZcrs = [];

    for (let offset = 0; offset + frameSamples <= totalSamples; offset += hopSamples) {
      let sumSq = 0;
      let zcrCount = 0;
      let prevSign = channelData[offset] >= 0;

      for (let i = 0; i < frameSamples; i++) {
        const val = channelData[offset + i];
        sumSq += val * val;
        const sign = val >= 0;
        if (sign !== prevSign) {
          zcrCount++;
          prevSign = sign;
        }
      }

      const rms = Math.sqrt(sumSq / frameSamples);
      const zcr = zcrCount / frameSamples;
      frameEnergies.push(rms);
      frameZcrs.push(zcr);
    }

    const totalFrames = frameEnergies.length;
    if (totalFrames === 0) {
      return {
        speechActiveMs: 0,
        silenceMs: totalDurationMs,
        totalDurationMs,
        speechRatio: 0,
        isReliable: false,
        basis: "insufficient_data",
        method: "zero_frames"
      };
    }

    // Estimate noise floor: 15th percentile of frame energies
    const sortedEnergies = [...frameEnergies].sort((a, b) => a - b);
    const noiseFloor = sortedEnergies[Math.floor(sortedEnergies.length * 0.15)] || 0;
    const maxEnergy = sortedEnergies[sortedEnergies.length - 1] || 0;

    // Adaptive threshold for human speech with sensitivity to soft/quiet speech & fillers
    const minSpeechRms = 0.008;
    const dynamicThreshold = Math.min(
      Math.max(minSpeechRms, maxEnergy * 0.5),
      Math.max(minSpeechRms, noiseFloor * 2.2, (maxEnergy + noiseFloor) * 0.12)
    );
    const releaseThreshold = Math.max(minSpeechRms * 0.65, Math.min(dynamicThreshold * 0.7, noiseFloor * 1.35));

    // Raw frame classification with hysteresis
    const rawActive = new Array(totalFrames).fill(false);
    let inSpeech = false;
    for (let i = 0; i < totalFrames; i++) {
      const rms = frameEnergies[i];
      const zcr = frameZcrs[i];
      if (!inSpeech) {
        if (rms >= dynamicThreshold && zcr >= 0.015 && zcr <= 0.48) {
          inSpeech = true;
          rawActive[i] = true;
        }
      } else {
        if (rms >= releaseThreshold && zcr <= 0.52) {
          rawActive[i] = true;
        } else {
          inSpeech = false;
        }
      }
    }

    // Smoothing 1: Remove isolated false-positive spikes (clicks/pops <= 20ms)
    for (let i = 1; i < totalFrames - 1; i++) {
      if (rawActive[i] && !rawActive[i - 1] && !rawActive[i + 1]) {
        rawActive[i] = false;
      }
    }

    // Smoothing 2: Hangover (bridge short inter-syllable gaps up to 150ms = 15 frames)
    const hangoverFrames = 15;
    const activeSmoothed = new Array(totalFrames).fill(false);
    let hangoverCounter = 0;

    for (let i = 0; i < totalFrames; i++) {
      if (rawActive[i]) {
        activeSmoothed[i] = true;
        hangoverCounter = hangoverFrames;
      } else if (hangoverCounter > 0) {
        activeSmoothed[i] = true;
        hangoverCounter--;
      }
    }

    const activeCount = activeSmoothed.filter(Boolean).length;
    const frameDurationMs = (hopSamples / sampleRate) * 1000;
    let speechActiveMs = Math.round(activeCount * frameDurationMs);
    if (speechActiveMs > totalDurationMs) speechActiveMs = totalDurationMs;
    const silenceMs = Math.max(0, totalDurationMs - speechActiveMs);
    const speechRatio = totalDurationMs > 0 ? Number((speechActiveMs / totalDurationMs).toFixed(2)) : 0;

    // Segment extraction: Group raw contiguous active regions, apply pre/post-roll, and bridge gaps
    const rawIntervals = [];
    let startIdx = -1;
    for (let i = 0; i < totalFrames; i++) {
      if (activeSmoothed[i]) {
        if (startIdx < 0) startIdx = i;
      } else {
        if (startIdx >= 0) {
          rawIntervals.push({ startFrame: startIdx, endFrame: i });
          startIdx = -1;
        }
      }
    }
    if (startIdx >= 0) {
      rawIntervals.push({ startFrame: startIdx, endFrame: totalFrames });
    }

    // Pre-roll (200ms = 20 frames) and post-roll (250ms = 25 frames)
    const preRollFrames = 20;
    const postRollFrames = 25;
    const minBridgingGapFrames = 35; // 350ms gap bridging for inter-syllable & short pauses

    const expanded = rawIntervals.map(it => ({
      startFrame: Math.max(0, it.startFrame - preRollFrames),
      endFrame: Math.min(totalFrames, it.endFrame + postRollFrames)
    }));

    const merged = [];
    for (const it of expanded) {
      if (merged.length === 0) {
        merged.push(it);
      } else {
        const prev = merged[merged.length - 1];
        if (it.startFrame <= prev.endFrame + minBridgingGapFrames) {
          prev.endFrame = Math.max(prev.endFrame, it.endFrame);
        } else {
          merged.push(it);
        }
      }
    }

    const speechSegments = [];
    let segTotalDuration = 0;
    for (const it of merged) {
      const startMs = Math.round((it.startFrame * hopSamples / sampleRate) * 1000);
      const endMs = Math.min(totalDurationMs, Math.round(((it.endFrame * hopSamples + frameSamples) / sampleRate) * 1000));
      const durationMs = Math.max(0, endMs - startMs);
      if (durationMs >= 120) {
        speechSegments.push({
          startMs,
          endMs,
          durationMs,
          startSample: Math.min(totalSamples, Math.floor(startMs * sampleRate / 1000)),
          endSample: Math.min(totalSamples, Math.floor(endMs * sampleRate / 1000))
        });
        segTotalDuration += durationMs;
      }
    }

    const hasSpeech = speechSegments.length > 0 && speechActiveMs >= 200 && maxEnergy >= minSpeechRms;
    const isPureSilence = !hasSpeech;

    const hasDynamicRange = (maxEnergy / Math.max(0.001, noiseFloor)) >= 2.2;
    const isSteadyNoise = speechRatio >= 0.98 && (maxEnergy / Math.max(0.001, noiseFloor)) < 2.5;
    const isReliable = Boolean(
      totalDurationMs >= 2000 &&
      speechActiveMs >= 1000 &&
      maxEnergy >= minSpeechRms &&
      hasDynamicRange &&
      !isSteadyNoise &&
      speechRatio >= 0.08
    );

    return {
      speechActiveMs: hasSpeech ? speechActiveMs : 0,
      silenceMs: hasSpeech ? silenceMs : totalDurationMs,
      totalDurationMs,
      speechRatio: hasSpeech ? speechRatio : 0,
      noiseFloor: Number(noiseFloor.toFixed(4)),
      maxEnergy: Number(maxEnergy.toFixed(4)),
      isReliable,
      hasSpeech,
      isPureSilence,
      speechSegments: hasSpeech ? speechSegments : [],
      filteredPlaybackDurationMs: hasSpeech ? segTotalDuration : 0,
      basis: isReliable ? "speech_active" : "turn_elapsed",
      method: "energy_zcr_vad"
    };
  }

  function extractSpeechSegments(channelData, sampleRate = 16000) {
    const vad = analyzePcmVoiceActivity(channelData, sampleRate);
    return {
      speechSegments: vad.speechSegments || [],
      speechActiveMs: vad.speechActiveMs || 0,
      silenceMs: vad.silenceMs || 0,
      totalDurationMs: vad.totalDurationMs || 0,
      hasSpeech: Boolean(vad.hasSpeech),
      isPureSilence: Boolean(vad.isPureSilence)
    };
  }

  /**
   * Decodes audio Blob via AudioContext and computes Voice Activity Detection
   */
  async function analyzeVoiceActivityFromBlob(blob) {
    if (!blob || !(blob.size > 0)) {
      return {
        speechActiveMs: 0,
        silenceMs: 0,
        totalDurationMs: 0,
        speechRatio: 0,
        isReliable: false,
        basis: "insufficient_data",
        method: "no_audio"
      };
    }

    const AudioCtx = (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext))
      ? (window.AudioContext || window.webkitAudioContext)
      : null;

    if (!AudioCtx) {
      return {
        speechActiveMs: null,
        silenceMs: null,
        totalDurationMs: 0,
        speechRatio: null,
        isReliable: false,
        basis: "turn_elapsed",
        method: "audio_context_unavailable"
      };
    }

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const ctx = new AudioCtx();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      if (ctx.close && ctx.state !== "closed") {
        ctx.close().catch(() => {});
      }

      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      return analyzePcmVoiceActivity(channelData, sampleRate);
    } catch (err) {
      return {
        speechActiveMs: null,
        silenceMs: null,
        totalDurationMs: 0,
        speechRatio: null,
        isReliable: false,
        basis: "turn_elapsed",
        method: "decode_error"
      };
    }
  }

  function getSupportedMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/aac"
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return "";
  }

  /**
   * Starts recording audio for the given turn index and question text.
   */
  async function startAudioRecording(turnIndex, questionText = "") {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      console.warn("[AUDIO RECORDER] getUserMedia not supported");
      updateRecordingUI("unavailable");
      return false;
    }

    // Stop any stale active recording first
    if (_isRecordingActive && _mediaRecorder) {
      try {
        _mediaRecorder.stop();
      } catch (e) {}
    }

    _activeChunks = [];
    _currentTurnIndex = turnIndex;
    _currentQuestionText = questionText;
    _recordingStartTime = Date.now();
    _recordingTotalPausedTime = 0;
    _isRecordingPaused = false;

    try {
      // Re-use or request audio stream
      if (!_mediaStream || !_mediaStream.active || _mediaStream.getAudioTracks().every(t => t.readyState === "ended")) {
        _mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};

      _mediaRecorder = new MediaRecorder(_mediaStream, options);

      _mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          _activeChunks.push(event.data);
        }
      };

      _mediaRecorder.onstart = () => {
        _isRecordingActive = true;
        updateRecordingUI("recording");
      };

      _mediaRecorder.onpause = () => {
        _isRecordingPaused = true;
        _recordingPauseStart = Date.now();
        updateRecordingUI("paused");
      };

      _mediaRecorder.onresume = () => {
        _isRecordingPaused = false;
        if (_recordingPauseStart > 0) {
          _recordingTotalPausedTime += (Date.now() - _recordingPauseStart);
          _recordingPauseStart = 0;
        }
        updateRecordingUI("recording");
      };

      _mediaRecorder.onerror = (e) => {
        console.warn("[AUDIO RECORDER] MediaRecorder error:", e);
        updateRecordingUI("error");
      };

      // Request data in 1-second timeslices so chunks accumulate progressively
      _mediaRecorder.start(1000);
      _micPermissionDenied = false;
      return true;

    } catch (err) {
      console.warn("[AUDIO RECORDER] Permission or start failed:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        _micPermissionDenied = true;
        updateRecordingUI("denied");
      } else {
        updateRecordingUI("error");
      }
      return false;
    }
  }

  function pauseAudioRecording() {
    if (_mediaRecorder && _mediaRecorder.state === "recording") {
      try {
        _mediaRecorder.pause();
      } catch (e) {}
    }
  }

  function resumeAudioRecording() {
    if (_mediaRecorder && _mediaRecorder.state === "paused") {
      try {
        _mediaRecorder.resume();
      } catch (e) {}
    }
  }

  /**
   * Stops active recording, compiles audio Blob, saves to IndexedDB, and returns metadata.
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

    const fadeSamples = Math.min(Math.floor(sampleRate * 0.005), 100); // 5ms crossfade
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
        const vad = analyzePcmVoiceActivity(audioBuffer.getChannelData(0), audioBuffer.sampleRate);
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
      console.warn('[AUDIO RECORDER] createSpeechOnlyAudioBlob error:', e);
      return null;
    }
  }

  async function stopAndSaveAudioRecording(sessionId, turnIndex, questionText = "") {
    if (!_isRecordingActive || !_mediaRecorder) {
      updateRecordingUI("idle");
      return null;
    }

    return new Promise((resolve) => {
      const finishHandler = async () => {
        _isRecordingActive = false;
        _isRecordingPaused = false;

        const effectiveEndTime = Date.now();
        let totalDurationMs = effectiveEndTime - _recordingStartTime - _recordingTotalPausedTime;
        if (totalDurationMs < 0) totalDurationMs = 0;

        const mimeType = _mediaRecorder?.mimeType || getSupportedMimeType() || "audio/webm";
        const audioBlob = _activeChunks.length > 0 ? new Blob(_activeChunks, { type: mimeType }) : null;

        // Perform asynchronous Voice Activity Detection if audio is present
        let vadResult = null;
        if (audioBlob && audioBlob.size > 0) {
          try {
            vadResult = await analyzeVoiceActivityFromBlob(audioBlob);
          } catch (e) {
            console.warn("[AUDIO RECORDER] VAD analysis error:", e);
          }
        }

        const recordId = `${sessionId}_turn_${turnIndex}`;
        const record = {
          id: recordId,
          sessionId: sessionId || "unassigned",
          turnIndex: typeof turnIndex === "number" ? turnIndex : 0,
          question: questionText || _currentQuestionText || "",
          audioBlob: audioBlob,
          mimeType: mimeType,
          durationMs: totalDurationMs,
          speechActiveMs: vadResult ? vadResult.speechActiveMs : null,
          silenceMs: vadResult ? vadResult.silenceMs : null,
          speechRatio: vadResult ? vadResult.speechRatio : null,
          hasSpeech: vadResult ? Boolean(vadResult.hasSpeech) : false,
          isPureSilence: vadResult ? Boolean(vadResult.isPureSilence) : false,
          speechSegments: vadResult ? (vadResult.speechSegments || []) : [],
          vadReliable: vadResult ? vadResult.isReliable : false,
          vadBasis: vadResult ? vadResult.basis : "turn_elapsed",
          recordedAt: new Date().toISOString()
        };

        if (audioBlob && audioBlob.size > 0) {
          await saveRecordingToStore(record);
        }

        // Clean up active chunks
        _activeChunks = [];
        updateRecordingUI("idle");
        resolve(record);
      };

      if (_mediaRecorder.state !== "inactive") {
        _mediaRecorder.onstop = finishHandler;
        try {
          _mediaRecorder.stop();
        } catch (e) {
          finishHandler();
        }
      } else {
        finishHandler();
      }
    });
  }

  function cancelAudioRecording() {
    if (_mediaRecorder && _mediaRecorder.state !== "inactive") {
      try {
        _mediaRecorder.stop();
      } catch (e) {}
    }
    _activeChunks = [];
    _isRecordingActive = false;
    _isRecordingPaused = false;
    updateRecordingUI("idle");
  }

  async function startMicPreview(onLevelUpdate) {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      console.warn("[AUDIO RECORDER] getUserMedia not supported");
      _micPermissionDenied = false;
      return { success: false, error: "not_supported" };
    }

    try {
      if (!_mediaStream || !_mediaStream.active || _mediaStream.getAudioTracks().every(t => t.readyState === "ended")) {
        _mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }

      // Re-enable tracks if disabled
      _mediaStream.getAudioTracks().forEach(t => { t.enabled = true; });
      _micPermissionDenied = false;
      _isMicPreviewActive = true;

      stopMicPreviewMeterOnly();

      const AudioCtxClass = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;
      if (AudioCtxClass) {
        try {
          _preflightAudioContext = new AudioCtxClass();
          _preflightSource = _preflightAudioContext.createMediaStreamSource(_mediaStream);
          _preflightAnalyser = _preflightAudioContext.createAnalyser();
          _preflightAnalyser.fftSize = 256;
          _preflightSource.connect(_preflightAnalyser);

          const dataArray = new Uint8Array(_preflightAnalyser.frequencyBinCount);
          _preflightTimer = setInterval(() => {
            if (!_isMicPreviewActive || !_preflightAnalyser) return;
            try {
              _preflightAnalyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              const level = Math.min(100, Math.round((avg / 128) * 100));
              if (typeof onLevelUpdate === "function") {
                onLevelUpdate(level);
              }
            } catch (tickErr) {}
          }, 80);
        } catch (audioErr) {
          console.warn("[AUDIO RECORDER] AudioContext meter fallback:", audioErr);
        }
      }

      return { success: true, stream: _mediaStream };
    } catch (err) {
      _micPermissionDenied = true;
      _isMicPreviewActive = false;
      console.warn("[AUDIO RECORDER] Preflight mic permission denied or unavailable:", err?.name);
      return { success: false, error: err?.name || "denied" };
    }
  }

  function stopMicPreviewMeterOnly() {
    if (_preflightTimer) {
      clearInterval(_preflightTimer);
      _preflightTimer = null;
    }
    if (_preflightSource) {
      try { _preflightSource.disconnect(); } catch (e) {}
      _preflightSource = null;
    }
    if (_preflightAnalyser) {
      try { _preflightAnalyser.disconnect(); } catch (e) {}
      _preflightAnalyser = null;
    }
    if (_preflightAudioContext && typeof _preflightAudioContext.close === "function") {
      try { _preflightAudioContext.close(); } catch (e) {}
      _preflightAudioContext = null;
    }
  }

  function stopMicPreview(muteTracks = false) {
    _isMicPreviewActive = false;
    stopMicPreviewMeterOnly();
    if (muteTracks && _mediaStream) {
      _mediaStream.getAudioTracks().forEach(t => { t.enabled = false; });
    }
  }

  function getAudioStream() {
    return _mediaStream;
  }

  function closeAllAudioTracks() {
    stopMicPreviewMeterOnly();
    _isMicPreviewActive = false;
    if (_mediaStream) {
      try {
        _mediaStream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      _mediaStream = null;
    }
  }

  // --------------------------------------------------------------------------
  // 3. UI PRESENTATION HELPER
  // --------------------------------------------------------------------------

  function updateRecordingUI(state) {
    if (typeof document === "undefined") return;

    const badge = document.getElementById("ir-audio-recording-badge");
    if (!badge) return;

    badge.classList.remove("recording", "paused", "denied", "unavailable", "idle");

    switch (state) {
      case "recording":
        badge.classList.add("recording");
        badge.innerHTML = `<span class="rec-dot"></span><span>Đang ghi âm câu trả lời</span>`;
        badge.style.display = "inline-flex";
        badge.title = "Bản ghi âm được lưu tạm thời trên trình duyệt của bạn để phân tích cách trình bày sau buổi phỏng vấn.";
        break;
      case "paused":
        badge.classList.add("paused");
        badge.innerHTML = `<span class="rec-dot paused"></span><span>Tạm dừng ghi âm</span>`;
        badge.style.display = "inline-flex";
        break;
      case "denied":
        badge.classList.add("denied");
        badge.innerHTML = `<span>Micro bị từ chối (Bạn vẫn có thể gõ câu trả lời)</span>`;
        badge.style.display = "inline-flex";
        break;
      case "unavailable":
        badge.classList.add("unavailable");
        badge.innerHTML = `<span>Ghi âm không khả dụng</span>`;
        badge.style.display = "inline-flex";
        break;
      case "idle":
      default:
        badge.classList.add("idle");
        badge.style.display = "none";
        break;
    }
  }

  // --------------------------------------------------------------------------
  // 4. EXPORTS
  // --------------------------------------------------------------------------

  const PrepMateAudioRecorder = {
    startAudioRecording,
    pauseAudioRecording,
    resumeAudioRecording,
    stopAndSaveAudioRecording,
    cancelAudioRecording,
    closeAllAudioTracks,
    startMicPreview,
    stopMicPreview,
    isMicPreviewActive: () => _isMicPreviewActive,
    getAudioStream,
    getRecording: getRecordingFromStore,
    getAllRecordingsForSession,
    deleteRecordingsForSession,
    isRecordingActive: () => _isRecordingActive,
    isRecordingPaused: () => _isRecordingPaused,
    isPermissionDenied: () => _micPermissionDenied,
    updateRecordingUI,
    analyzePcmVoiceActivity,
    analyzeVoiceActivityFromBlob,
    extractSpeechSegments,
    audioBufferToWavBlob,
    sliceAndConcatenateAudio,
    createSpeechOnlyAudioBlob
  };

  if (typeof window !== "undefined") {
    window.PrepMateAudioRecorder = PrepMateAudioRecorder;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = PrepMateAudioRecorder;
  }
})();
