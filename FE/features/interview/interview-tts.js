/**
 * PrepMate — Interview Text-to-Speech (TTS) Subsystem Module
 * WI 1.18-B: Behavior-Preserving Structural Extraction from interview.js
 * 
 * Responsibilities:
 * - Speech State Machine (IDLE, SPEAKING, PAUSED, FINISHED, CANCELLED)
 * - ElevenLabs audio speech integration with fallback to Web Speech API
 * - Web Speech Synthesis Utterance lifecycle, pause/resume, and voice selection
 * - Unified ttsEnabled toggle with UI updates and audio pause/resume preservation
 * - Anti-duplicate speech identity locking and Chromium 15s pause watchdog
 */

(function () {
  "use strict";

  function debugTTS(category, ...args) {
    if (typeof debugInterview === "function") {
      debugInterview(category, ...args);
    } else if (typeof window.debugInterview === "function") {
      window.debugInterview(category, ...args);
    } else {
      console.log(`[${category}]`, ...args);
    }
  }

  // TTS Global State (strictly unified)
  if (typeof window.ttsEnabled === "undefined") {
    window.ttsEnabled = true;
  }
  let ttsEnabled = Boolean(window.ttsEnabled);

  // Speech State Machine & Single Source of Truth
  const SPEECH_STATE = {
    IDLE: "IDLE",
    SPEAKING: "SPEAKING",
    PAUSED: "PAUSED",
    FINISHED: "FINISHED",
    CANCELLED: "CANCELLED",
  };
  let currentSpeechState = SPEECH_STATE.IDLE;
  let currentSpeechSessionId = 0;
  let currentSpeechIdentity = "";
  let isQuestionSpeaking = false;

  function completeSpeechOnce(sessionId, reason) {
    if (sessionId !== currentSpeechSessionId) {
      debugTTS("TTS", `completeSpeechOnce ignored: session mismatch (${sessionId} vs ${currentSpeechSessionId})`);
      return;
    }
    if (currentSpeechState === SPEECH_STATE.FINISHED || currentSpeechState === SPEECH_STATE.CANCELLED) {
      debugTTS("TTS", `completeSpeechOnce ignored: already in terminal state (${currentSpeechState})`);
      return;
    }

    debugTTS("TTS", `completeSpeechOnce firing for session #${sessionId}, reason: ${reason}`);
    currentSpeechState = SPEECH_STATE.FINISHED;

    if (window._ttsResumeInterval) {
      clearInterval(window._ttsResumeInterval);
      window._ttsResumeInterval = null;
    }
    isQuestionSpeaking = false;
    window._activeUtterance = null;
    window._currentlySpeakingText = null;

    const cb = window._activeSpeechCallback;
    window._activeSpeechCallback = null;
    if (typeof cb === "function") {
      cb();
    }
  }

  function cancelCurrentSpeech(reason = "cancelled") {
    if (window._activeTtsAbortController) {
      try { window._activeTtsAbortController.abort(); } catch (e) {}
      window._activeTtsAbortController = null;
    }
    if (typeof stopTTSPreview === "function") {
      try { stopTTSPreview(); } catch (e) {}
    }
    if (currentSpeechState === SPEECH_STATE.SPEAKING || currentSpeechState === SPEECH_STATE.PAUSED) {
      debugTTS("TTS", `cancelCurrentSpeech: cancelling active speech #${currentSpeechSessionId}, reason: ${reason}`);
      currentSpeechState = SPEECH_STATE.CANCELLED;
    }

    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    if (window._currentAIAudio) {
      try {
        window._currentAIAudio.pause();
        window._currentAIAudio.currentTime = 0;
      } catch (e) {}
      window._currentAIAudio = null;
    }
    if (window._ttsResumeInterval) {
      clearInterval(window._ttsResumeInterval);
      window._ttsResumeInterval = null;
    }
    if (typeof clearThinkTimeCountdown === "function") {
      clearThinkTimeCountdown();
    } else if (typeof window.clearThinkTimeCountdown === "function") {
      window.clearThinkTimeCountdown();
    }
    isQuestionSpeaking = false;
    window._activeUtterance = null;
    window._activeSpeechCallback = null;
    window._currentlySpeakingText = null;
  }

  function updateTTSButtonUI(enabled) {
    const ttsBtn = document.getElementById("btn-tts");
    if (ttsBtn) {
      const icons = typeof ZOOM_ICONS !== "undefined" ? ZOOM_ICONS : (window.ZOOM_ICONS || {});
      ttsBtn.innerHTML = enabled ? icons.speakerOn : icons.speakerMuted;
      ttsBtn.classList.toggle("off", !enabled);
      ttsBtn.title = enabled ? "Tắt âm thanh người phỏng vấn" : "Bật âm thanh người phỏng vấn";
    }
  }

  function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    window.ttsEnabled = ttsEnabled;
    try {
      localStorage.setItem("tts_enabled", String(ttsEnabled));
    } catch (e) {}
    debugTTS("TTS", "Toggled TTS state:", ttsEnabled, "currentSpeechState:", currentSpeechState);

    if (!ttsEnabled) {
      // If currently SPEAKING, pause speech gracefully without destroying session or calling callback
      if (currentSpeechState === SPEECH_STATE.SPEAKING) {
        currentSpeechState = SPEECH_STATE.PAUSED;
        if (window.speechSynthesis) {
          try { window.speechSynthesis.pause(); } catch (e) {}
        }
        if (window._currentAIAudio && !window._currentAIAudio.paused) {
          try { window._currentAIAudio.pause(); } catch (e) {}
        }
      }

      updateTTSButtonUI(false);
      if (typeof showToast === "function") {
        showToast("Đã tắt âm thanh người phỏng vấn", "info");
      }

      // Toggle mute ONLY controls audio; it MUST NOT start timer or change interview state!
      return;
    }

    // If currently PAUSED, resume existing speech without creating new utterance or restarting text
    if (currentSpeechState === SPEECH_STATE.PAUSED) {
      currentSpeechState = SPEECH_STATE.SPEAKING;
      if (window.speechSynthesis) {
        try { window.speechSynthesis.resume(); } catch (e) {}
      }
      if (window._currentAIAudio && window._currentAIAudio.paused) {
        try { window._currentAIAudio.play(); } catch (e) {}
      }
    }

    updateTTSButtonUI(true);
    if (typeof showToast === "function") {
      showToast("Đã bật âm thanh người phỏng vấn", "success");
    }
  }

  // Default Voice Configuration (Three-Layer Decoupled Architecture)
  let _currentTtsVoiceConfig = {
    provider: "elevenlabs",
    voiceId: "",
    voiceName: "",
    modelId: "eleven_flash_v2_5",
    speed: 1.0,
  };

  // Preview state management
  let _previewAudio = null;
  let _previewAbortCtrl = null;

  function getTtsVoiceConfig() {
    return { ..._currentTtsVoiceConfig };
  }

  function setTtsVoiceConfig(cfg) {
    if (!cfg || typeof cfg !== "object") return;
    _currentTtsVoiceConfig = {
      ..._currentTtsVoiceConfig,
      ...cfg,
    };
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("prepmate_tts_voice_config", JSON.stringify(_currentTtsVoiceConfig));
      }
    } catch (e) {}
  }

  // Auto-load persisted voice config on startup
  try {
    if (typeof window !== "undefined") {
      if (window.sessionStorage) {
        const initDataStr = window.sessionStorage.getItem("interview_init_data");
        if (initDataStr) {
          try {
            const initData = JSON.parse(initDataStr);
            if (initData.ttsVoice) {
              _currentTtsVoiceConfig = { ..._currentTtsVoiceConfig, ...initData.ttsVoice };
            }
          } catch (e) {}
        }
      }
      if (window.localStorage && !_currentTtsVoiceConfig.voiceId) {
        const savedCfgStr = window.localStorage.getItem("prepmate_tts_voice_config");
        if (savedCfgStr) {
          try {
            const savedCfg = JSON.parse(savedCfgStr);
            if (savedCfg) _currentTtsVoiceConfig = { ..._currentTtsVoiceConfig, ...savedCfg };
          } catch (e) {}
        }
      }
    }
  } catch (e) {}

  function resolveTtsApiBase() {
    return (typeof window !== "undefined" && window.InterviewApiClient && typeof window.InterviewApiClient.resolveBaseUrl === "function")
      ? window.InterviewApiClient.resolveBaseUrl()
      : (typeof resolveApiBaseUrl === "function" ? resolveApiBaseUrl() : "");
  }

  async function fetchTTSStatus() {
    try {
      const base = resolveTtsApiBase();
      const resp = await fetch(`${base}/api/tts/status`);
      if (!resp.ok) return { configured: false, provider: "elevenlabs" };
      return await resp.json();
    } catch (e) {
      return { configured: false, provider: "elevenlabs" };
    }
  }

  async function fetchTTSVoices() {
    try {
      const base = resolveTtsApiBase();
      const resp = await fetch(`${base}/api/tts/voices`);
      if (!resp.ok) {
        return { success: false, configured: false, voices: [] };
      }
      return await resp.json();
    } catch (e) {
      return { success: false, configured: false, voices: [] };
    }
  }

  async function previewTTSVoice(voiceId, text, speed = 1.0, onStart, onEnd, onError) {
    stopTTSPreview();
    const sampleText = (text || "Xin chào, tôi là người phỏng vấn của bạn hôm nay tại PrepMate. Bạn đã sẵn sàng bắt đầu chưa?").trim();
    _previewAbortCtrl = new AbortController();

    try {
      if (typeof onStart === "function") onStart();
      const base = resolveTtsApiBase();

      const resp = await fetch(`${base}/api/tts/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sampleText,
          voiceId: voiceId || "",
          modelId: "eleven_flash_v2_5",
          speed: speed || 1.0,
        }),
        signal: _previewAbortCtrl.signal,
      });

      if (!resp.ok) {
        let errMsg = `TTS server HTTP ${resp.status}`;
        try {
          const errData = await resp.json();
          if (errData && errData.message) {
            errMsg = errData.message;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }

      const blob = await resp.blob();
      if (!blob || blob.size === 0) {
        throw new Error("Empty audio response");
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      _previewAudio = audio;

      audio.onended = () => {
        try { URL.revokeObjectURL(url); } catch (e) {}
        _previewAudio = null;
        if (typeof onEnd === "function") onEnd();
      };

      audio.onerror = (e) => {
        try { URL.revokeObjectURL(url); } catch (err) {}
        _previewAudio = null;
        if (typeof onError === "function") onError(e);
      };

      await audio.play();
      return true;
    } catch (err) {
      if (err.name === "AbortError") {
        if (typeof onEnd === "function") onEnd();
        return false;
      }
      _previewAudio = null;
      if (typeof onError === "function") onError(err);
      return false;
    }
  }

  function stopTTSPreview() {
    if (_previewAbortCtrl) {
      try { _previewAbortCtrl.abort(); } catch (e) {}
      _previewAbortCtrl = null;
    }
    if (_previewAudio) {
      try {
        _previewAudio.pause();
        _previewAudio.currentTime = 0;
      } catch (e) {}
      _previewAudio = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  async function createVoiceDesignPreview(description, text, industryContext) {
    const base = resolveTtsApiBase();
    const resp = await fetch(`${base}/api/tts/voice-design/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: (description || "").trim(),
        text: (text || "").trim(),
        industryContext: (industryContext || "").trim(),
      }),
    });
    return await resp.json();
  }

  async function saveVoiceDesignVoice(voiceName, voiceDescription, generatedVoiceId) {
    const base = resolveTtsApiBase();
    const resp = await fetch(`${base}/api/tts/voice-design/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceName: (voiceName || "").trim(),
        voiceDescription: (voiceDescription || "").trim(),
        generatedVoiceId: (generatedVoiceId || "").trim(),
      }),
    });
    return await resp.json();
  }

  async function speakElevenLabs(text, onEndCallback = null, sessionId = null) {
    const voiceCfg = getTtsVoiceConfig();
    const voiceId = voiceCfg.voiceId || (typeof window !== "undefined" && window._selectedTtsVoiceId) || "";
    if (!voiceId) return false;

    const speed = typeof voiceCfg.speed === "number" ? Math.min(1.2, Math.max(0.7, voiceCfg.speed)) : 1.0;
    const modelId = voiceCfg.modelId || "eleven_flash_v2_5";

    if (window._activeTtsAbortController) {
      try { window._activeTtsAbortController.abort(); } catch (e) {}
    }
    const abortCtrl = new AbortController();
    window._activeTtsAbortController = abortCtrl;
    currentSpeechState = SPEECH_STATE.SPEAKING;
    isQuestionSpeaking = true;
    window._activeSpeechCallback = onEndCallback;

    try {
      const base = resolveTtsApiBase();
      const endpoint = `${base}/api/tts/speak`;

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: (text || "").substring(0, 2000),
          voiceId: voiceId,
          modelId: modelId,
          speed: speed,
        }),
        signal: abortCtrl.signal,
      });

      if (!resp.ok) {
        debugTTS("TTS", `Backend TTS proxy returned HTTP ${resp.status}`);
        return false;
      }

      const blob = await resp.blob();
      if (!blob || blob.size === 0) {
        return false;
      }

      if (sessionId !== null && sessionId !== currentSpeechSessionId) {
        debugTTS("TTS", "ElevenLabs speech superseded while fetch was in flight.");
        return false;
      }
      if (currentSpeechState === SPEECH_STATE.CANCELLED) {
        return false;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      window._currentAIAudio = audio;
      currentSpeechState = SPEECH_STATE.SPEAKING;
      isQuestionSpeaking = true;
      window._activeSpeechCallback = onEndCallback;

      audio.onended = () => {
        window._currentAIAudio = null;
        try { URL.revokeObjectURL(url); } catch (e) {}
        if (sessionId !== null) {
          completeSpeechOnce(sessionId, "elevenlabs_ended");
        } else {
          isQuestionSpeaking = false;
          window._activeSpeechCallback = null;
          if (typeof onEndCallback === "function") {
            onEndCallback();
          }
        }
      };

      audio.onerror = (audioErr) => {
        window._currentAIAudio = null;
        try { URL.revokeObjectURL(url); } catch (e) {}
        debugTTS("TTS", "Audio playback error:", audioErr);
        if (sessionId !== null) {
          completeSpeechOnce(sessionId, "elevenlabs_error");
        }
      };

      if (typeof setInterviewerState === "function") {
        setInterviewerState("speaking", "Đang đọc câu hỏi");
      } else if (typeof window.setInterviewerState === "function") {
        window.setInterviewerState("speaking", "Đang đọc câu hỏi");
      }

      await audio.play();
      return true;
    } catch (e) {
      if (e.name === "AbortError") {
        debugTTS("TTS", "ElevenLabs fetch aborted.");
        return false;
      }
      debugTTS("TTS", "ElevenLabs fallback to Web Speech:", e && e.message);
      return false;
    } finally {
      if (window._activeTtsAbortController === abortCtrl) {
        window._activeTtsAbortController = null;
      }
    }
  }

  /**
   * Universal Speak Function (RULE 14: Unified state, TTS OFF skips smoothly)
   */
  async function speakAI(text, onEndCallback = null, speechIdentity = null) {
    const cleanText = (text || "")
      .replace(/[*#_🤖👤]/g, "")
      .replace(/AI Feedback:/gi, "Nhận xét của AI:")
      .replace(/Bạn:/g, "")
      .replace(/AI:/g, "");

    const targetIdentity = speechIdentity || cleanText;

    // Anti-duplicate utterance check:
    // If already SPEAKING or PAUSED for this EXACT identity or text, preserve current session and return
    if (
      window._activeUtterance &&
      (currentSpeechState === SPEECH_STATE.SPEAKING || currentSpeechState === SPEECH_STATE.PAUSED) &&
      (currentSpeechIdentity === targetIdentity || window._currentlySpeakingText === cleanText)
    ) {
      debugTTS("TTS", "Already speaking/paused this exact speech session. Preserving active speech.", targetIdentity);
      return;
    }

    // If a previous utterance was still speaking/paused with a different identity, cancel it cleanly
    if (window._activeTtsAbortController) {
      try { window._activeTtsAbortController.abort(); } catch (e) {}
      window._activeTtsAbortController = null;
    }
    if (typeof stopTTSPreview === "function") {
      try { stopTTSPreview(); } catch (e) {}
    }
    if (currentSpeechState === SPEECH_STATE.SPEAKING || currentSpeechState === SPEECH_STATE.PAUSED) {
      cancelCurrentSpeech("superseded_by_new_speech");
    }

    // Assign new speech session
    currentSpeechSessionId++;
    const thisSessionId = currentSpeechSessionId;
    currentSpeechIdentity = targetIdentity;
    window._currentlySpeakingText = cleanText;

    // If TTS is disabled, immediately skip speech and fire callback
    if (!ttsEnabled) {
      debugTTS("TTS", "TTS is OFF. Skipping audio output.");
      currentSpeechState = SPEECH_STATE.FINISHED;
      isQuestionSpeaking = false;
      window._activeUtterance = null;
      window._activeSpeechCallback = null;
      window._currentlySpeakingText = null;
      if (typeof onEndCallback === "function") {
        onEndCallback();
      }
      return;
    }

    // Try ElevenLabs first if configured
    const usedEL = await speakElevenLabs(cleanText, onEndCallback, thisSessionId);
    if (usedEL) return;

    // Fallback to browser Web Speech API
    if (!("speechSynthesis" in window)) {
      debugTTS("TTS", "speechSynthesis not supported.");
      currentSpeechState = SPEECH_STATE.FINISHED;
      isQuestionSpeaking = false;
      window._activeSpeechCallback = null;
      window._currentlySpeakingText = null;
      if (typeof onEndCallback === "function") onEndCallback();
      return;
    }

    try {
      currentSpeechState = SPEECH_STATE.SPEAKING;
      isQuestionSpeaking = true;
      window._activeSpeechCallback = onEndCallback;

      const getLang = typeof getSpeechLanguage === "function" ? getSpeechLanguage : (typeof window.getSpeechLanguage === "function" ? window.getSpeechLanguage : null);
      const speechLang = getLang ? getLang() : "vi-VN";
      const utt = new SpeechSynthesisUtterance(cleanText);
      utt._sessionId = thisSessionId;
      utt._speechIdentity = targetIdentity;
      window._activeUtterance = utt; // Strong global reference to prevent Chromium garbage collection during UI events
      utt.lang = speechLang;

      const getVoice = typeof getPreferredSpeechVoice === "function" ? getPreferredSpeechVoice : (typeof window.getPreferredSpeechVoice === "function" ? window.getPreferredSpeechVoice : null);
      if (getVoice) {
        const selectedVoice = getVoice();
        if (selectedVoice) utt.voice = selectedVoice;
      }

      utt.rate = typeof _currentTtsVoiceConfig.speed === "number" ? _currentTtsVoiceConfig.speed : 1.0;
      utt.pitch = 1.0;

      // Temporarily pause mic while AI is speaking
      const activeRec = typeof recognition !== "undefined" ? recognition : window.recognition;
      const activeListening = typeof isListening !== "undefined" ? isListening : window.isListening;
      if (activeRec && activeListening) {
        try { activeRec.stop(); } catch (e) {}
      }

      utt.onend = () => {
        debugTTS("TTS", "AI speech completed naturally.", { thisSessionId, currentSpeechSessionId, currentSpeechState });
        if (thisSessionId !== currentSpeechSessionId) return;
        if (currentSpeechState === SPEECH_STATE.PAUSED) {
          // Paused state must not trigger completion
          return;
        }
        completeSpeechOnce(thisSessionId, "onend");
      };

      utt.onerror = (err) => {
        debugTTS("TTS", "Speech synthesis error/cancelled:", err);
        if (thisSessionId !== currentSpeechSessionId) return;
        if (currentSpeechState === SPEECH_STATE.PAUSED) {
          return;
        }
        const isCancellation =
          err?.error === "canceled" ||
          err?.error === "interrupted" ||
          currentSpeechState === SPEECH_STATE.CANCELLED;
        if (isCancellation) {
          currentSpeechState = SPEECH_STATE.CANCELLED;
          window._activeUtterance = null;
          window._currentlySpeakingText = null;
          return;
        }
        completeSpeechOnce(thisSessionId, "onerror");
      };

      if (typeof setInterviewerState === "function") {
        setInterviewerState("speaking", "Đang đọc câu hỏi");
      } else if (typeof window.setInterviewerState === "function") {
        window.setInterviewerState("speaking", "Đang đọc câu hỏi");
      }
      window.speechSynthesis.speak(utt);

      // Watchdog to prevent Chromium ~15s pause bug
      if (window._ttsResumeInterval) {
        clearInterval(window._ttsResumeInterval);
        window._ttsResumeInterval = null;
      }
      if (window.speechSynthesis) {
        window._ttsResumeInterval = setInterval(() => {
          if (
            window.speechSynthesis &&
            window.speechSynthesis.speaking &&
            !window.speechSynthesis.paused &&
            currentSpeechState === SPEECH_STATE.SPEAKING
          ) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } else if (!window.speechSynthesis.speaking && currentSpeechState !== SPEECH_STATE.PAUSED) {
            if (window._ttsResumeInterval) {
              clearInterval(window._ttsResumeInterval);
              window._ttsResumeInterval = null;
            }
          }
        }, 10000);
      }
    } catch (e) {
      console.warn("[TTS] Web Speech exception:", e);
      if (thisSessionId === currentSpeechSessionId) {
        completeSpeechOnce(thisSessionId, "exception");
      }
    }
  }

  // Accessors & Mutators for window.ttsEnabled single source of truth
  Object.defineProperty(window, "ttsEnabled", {
    get: () => ttsEnabled,
    set: (val) => {
      ttsEnabled = Boolean(val);
    },
    configurable: true,
    enumerable: true,
  });

  // Explicit Public API Exports
  window.SPEECH_STATE = SPEECH_STATE;
  window.getSpeechState = () => currentSpeechState;
  window.getSpeechSessionId = () => currentSpeechSessionId;
  window.getSpeechIdentity = () => currentSpeechIdentity;
  window.isTTSEnabled = () => ttsEnabled;
  window.updateTTSButtonUI = updateTTSButtonUI;
  window.toggleTTS = toggleTTS;
  window.speakAI = speakAI;
  window.cancelCurrentSpeech = cancelCurrentSpeech;
  window.completeSpeechOnce = completeSpeechOnce;
  window.speakElevenLabs = speakElevenLabs;
  window.getTtsVoiceConfig = getTtsVoiceConfig;
  window.setTtsVoiceConfig = setTtsVoiceConfig;
  window.fetchTTSStatus = fetchTTSStatus;
  window.fetchTTSVoices = fetchTTSVoices;
  window.previewTTSVoice = previewTTSVoice;
  window.stopTTSPreview = stopTTSPreview;
  window.createVoiceDesignPreview = createVoiceDesignPreview;
  window.saveVoiceDesignVoice = saveVoiceDesignVoice;
})();
