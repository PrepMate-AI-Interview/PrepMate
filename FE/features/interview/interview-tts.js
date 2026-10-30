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

  // TTS Global State (strictly unified & persisted)
  let initialTtsEnabled = true;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = localStorage.getItem("tts_enabled");
      if (stored !== null) {
        initialTtsEnabled = stored === "true";
      }
    }
  } catch (e) { }

  if (typeof window.ttsEnabled === "undefined") {
    window.ttsEnabled = initialTtsEnabled;
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
      try { window._activeTtsAbortController.abort(); } catch (e) { }
      window._activeTtsAbortController = null;
    }
    if (typeof stopTTSPreview === "function") {
      try { stopTTSPreview(); } catch (e) { }
    }
    if (currentSpeechState === SPEECH_STATE.SPEAKING || currentSpeechState === SPEECH_STATE.PAUSED) {
      debugTTS("TTS", `cancelCurrentSpeech: cancelling active speech #${currentSpeechSessionId}, reason: ${reason}`);
      currentSpeechState = SPEECH_STATE.CANCELLED;
    }

    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) { }
    }
    if (window._currentAIAudio) {
      try {
        window._currentAIAudio.pause();
        window._currentAIAudio.currentTime = 0;
      } catch (e) { }
      window._currentAIAudio = null;
    }
    if (window._waitingRoomAudio) {
      try {
        window._waitingRoomAudio.pause();
        window._waitingRoomAudio.currentTime = 0;
      } catch (e) { }
      window._waitingRoomAudio = null;
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
    } catch (e) { }
    debugTTS("TTS", "Toggled TTS state:", ttsEnabled, "currentSpeechState:", currentSpeechState);

    if (!ttsEnabled) {
      // If currently SPEAKING, pause speech gracefully without destroying session or calling callback
      if (currentSpeechState === SPEECH_STATE.SPEAKING) {
        currentSpeechState = SPEECH_STATE.PAUSED;
      }

      // Hard stop any Web Speech playback
      if (window.speechSynthesis) {
        try { window.speechSynthesis.pause(); } catch (e) { }
        try { window.speechSynthesis.cancel(); } catch (e) { }
      }

      // Hard stop turn audio
      if (window._currentAIAudio && !window._currentAIAudio.paused) {
        try { window._currentAIAudio.pause(); } catch (e) { }
      }

      // Hard stop waiting room audio
      if (window._waitingRoomAudio) {
        try {
          window._waitingRoomAudio.pause();
          window._waitingRoomAudio.currentTime = 0;
        } catch (e) { }
        window._waitingRoomAudio = null;
      }

      // Hard stop preview audio
      if (typeof stopTTSPreview === "function") {
        try { stopTTSPreview(); } catch (e) { }
      }

      // Abort active fetch controller
      if (window._activeTtsAbortController) {
        try { window._activeTtsAbortController.abort(); } catch (e) { }
        window._activeTtsAbortController = null;
      }

      // Clear visual speaking indicators
      const avatarPreview = document.getElementById("interviewer-avatar-preview");
      const interviewerBox = document.getElementById("interviewer-video-box") || avatarPreview?.closest(".ir-interviewer-tile");
      if (avatarPreview) avatarPreview.classList.remove("speaking-pulse");
      if (interviewerBox) interviewerBox.classList.remove("speaking");

      if (typeof setInterviewerState === "function") {
        setInterviewerState("idle", "Sẵn sàng");
      } else if (typeof window.setInterviewerState === "function") {
        window.setInterviewerState("idle", "Sẵn sàng");
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
        try { window.speechSynthesis.resume(); } catch (e) { }
      }
      if (window._currentAIAudio && window._currentAIAudio.paused) {
        try { window._currentAIAudio.play(); } catch (e) { }
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
    const pSettings = resolveActivePersonaVoiceSettings();
    if (pSettings && pSettings.personaId) {
      _currentTtsVoiceConfig.personaId = pSettings.personaId;
      _currentTtsVoiceConfig.voiceId = pSettings.voiceId;
      _currentTtsVoiceConfig.name = pSettings.name;
      _currentTtsVoiceConfig.provider = "elevenlabs";
      _currentTtsVoiceConfig.pitch = 1.0;
      _currentTtsVoiceConfig.rate = 1.0;
    }
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
    } catch (e) { }
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
          } catch (e) { }
        }
      }
      if (window.localStorage && !_currentTtsVoiceConfig.voiceId) {
        const savedCfgStr = window.localStorage.getItem("prepmate_tts_voice_config");
        if (savedCfgStr) {
          try {
            const savedCfg = JSON.parse(savedCfgStr);
            if (savedCfg) _currentTtsVoiceConfig = { ..._currentTtsVoiceConfig, ...savedCfg };
          } catch (e) { }
        }
      }

      // Purge stale browser provider, mismatched persona voices, or browser voice names
      const startupSettings = resolveActivePersonaVoiceSettings();
      _currentTtsVoiceConfig.provider = "elevenlabs";
      _currentTtsVoiceConfig.personaId = startupSettings.personaId;
      _currentTtsVoiceConfig.voiceId = startupSettings.voiceId;
      _currentTtsVoiceConfig.name = startupSettings.name;
      _currentTtsVoiceConfig.modelId = "eleven_flash_v2_5";
      _currentTtsVoiceConfig.pitch = 1.0;
      _currentTtsVoiceConfig.rate = 1.0;

      if (!_currentTtsVoiceConfig.voiceId || !_currentTtsVoiceConfig.personaId) {
        let pId = _currentTtsVoiceConfig.personaId || "";
        try {
          if (!pId && window.sessionStorage) {
            const iStr = window.sessionStorage.getItem("interview_init_data");
            if (iStr) {
              const parsed = JSON.parse(iStr);
              pId = parsed.interviewerPersona || (parsed.ttsVoice && parsed.ttsVoice.personaId) || "";
            }
          }
          if (!pId && window.localStorage) {
            pId = window.localStorage.getItem("prepmate_interviewer_persona") || "";
          }
        } catch (e) { }
        if (!pId) pId = "professional";
        _currentTtsVoiceConfig.personaId = pId;
        if (typeof window.PrepMatePersonas !== "undefined" && typeof window.PrepMatePersonas.getPersona === "function") {
          const pObj = window.PrepMatePersonas.getPersona(pId);
          if (pObj && (pObj.voiceId || pObj.defaultVoiceId)) {
            _currentTtsVoiceConfig.voiceId = pObj.voiceId || pObj.defaultVoiceId;
            _currentTtsVoiceConfig.provider = "elevenlabs";
            _currentTtsVoiceConfig.modelId = "eleven_flash_v2_5";
          }
        }
      }
    }
  } catch (e) { }

  function resolveActivePersonaVoiceSettings() {
    let personaId = "";
    if (typeof window !== "undefined") {
      if (window.currentInterviewSession && window.currentInterviewSession.interviewerPersona) {
        personaId = window.currentInterviewSession.interviewerPersona;
      }
      if (!personaId) {
        try {
          const params = new URLSearchParams(window.location.search);
          personaId = params.get("persona") || "";
        } catch (e) {}
      }
      if (!personaId && window.sessionStorage) {
        try {
          const initStr = window.sessionStorage.getItem("interview_init_data");
          if (initStr) {
            const init = JSON.parse(initStr);
            personaId = init.interviewerPersona || (init.ttsVoice && init.ttsVoice.personaId) || "";
          }
        } catch (e) {}
      }
      if (!personaId && window.localStorage) {
        personaId = window.localStorage.getItem("prepmate_interviewer_persona") || "";
      }
    }
    if (!personaId && _currentTtsVoiceConfig && _currentTtsVoiceConfig.personaId) {
      personaId = _currentTtsVoiceConfig.personaId;
    }
    if (!personaId) personaId = "professional";

    let personaObj = null;
    if (typeof window !== "undefined" && window.PrepMatePersonas && typeof window.PrepMatePersonas.getPersona === "function") {
      personaObj = window.PrepMatePersonas.getPersona(personaId);
    }

    const isFemale = personaObj?.fallbackVoiceGender === "female" || personaId === "friendly";
    const defaultPitch = 1.00;
    const defaultRate = 1.00;

    const voiceId = personaObj?.voiceId || personaObj?.defaultVoiceId || (isFemale ? "3BUMLmVV2cgPJQ2pAwBa" : (personaId === "professional" ? "yTpM1yhZn6oZ0xMLpLFT" : "GbyYOHheg88tlJBFNEYY"));

    return {
      personaId,
      personaObj,
      gender: isFemale ? "female" : "male",
      pitch: typeof personaObj?.pitch === "number" ? personaObj.pitch : defaultPitch,
      rate: typeof personaObj?.rate === "number" ? personaObj.rate : defaultRate,
      name: personaObj?.name || (isFemale ? "Lê Lan Anh" : (personaId === "professional" ? "Trần Minh Vũ" : "Nguyễn Hoàng Nam")),
      voiceId
    };
  }

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
    const AbortCtrl = (typeof AbortController !== "undefined")
      ? AbortController
      : (typeof window !== "undefined" && window.AbortController ? window.AbortController : null);
    _previewAbortCtrl = AbortCtrl ? new AbortCtrl() : { signal: undefined, abort: () => {} };

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
        } catch (e) { }
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
        try { URL.revokeObjectURL(url); } catch (e) { }
        _previewAudio = null;
        if (typeof onEnd === "function") onEnd();
      };

      audio.onerror = (e) => {
        try { URL.revokeObjectURL(url); } catch (err) { }
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
      try { _previewAbortCtrl.abort(); } catch (e) { }
      _previewAbortCtrl = null;
    }
    if (_previewAudio) {
      try {
        _previewAudio.pause();
        _previewAudio.currentTime = 0;
      } catch (e) { }
      _previewAudio = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) { }
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

  let _hasShownElevenLabsRestrictedToast = false;

  async function speakElevenLabs(text, onEndCallback = null, sessionId = null, targetIdentity = null) {
    if (!ttsEnabled || (typeof window.isTTSEnabled === "function" && !window.isTTSEnabled())) {
      return false;
    }

    const pSettings = resolveActivePersonaVoiceSettings();
    // Authentic persona ElevenLabs voice ID SSOT:
    // friendly (Lê Lan Anh) -> 3BUMLmVV2cgPJQ2pAwBa
    // professional (Trần Minh Vũ) -> yTpM1yhZn6oZ0xMLpLFT
    // balanced (Nguyễn Hoàng Nam) -> GbyYOHheg88tlJBFNEYY
    const voiceId = pSettings.voiceId || (pSettings.personaId === "friendly" ? "3BUMLmVV2cgPJQ2pAwBa" : (pSettings.personaId === "professional" ? "yTpM1yhZn6oZ0xMLpLFT" : "GbyYOHheg88tlJBFNEYY"));
    const provider = "elevenlabs";
    const speed = 1.0;
    const modelId = "eleven_flash_v2_5";

    if (window._activeTtsAbortController) {
      try { window._activeTtsAbortController.abort(); } catch (e) { }
    }
    const AbortCtrl = (typeof AbortController !== "undefined")
      ? AbortController
      : (typeof window !== "undefined" && window.AbortController ? window.AbortController : null);
    const abortCtrl = AbortCtrl ? new AbortCtrl() : { signal: undefined, abort: () => {} };
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
        let errJson = null;
        try {
          errJson = await resp.json();
        } catch (e) {}
        debugTTS("TTS", `Backend TTS proxy returned HTTP ${resp.status}`, errJson);

        if (resp.status === 401 && errJson?.error === "ELEVENLABS_ACCOUNT_RESTRICTED") {
          if (!_hasShownElevenLabsRestrictedToast && typeof showToast === "function") {
            _hasShownElevenLabsRestrictedToast = true;
            showToast(`Lưu ý: Tài khoản ElevenLabs bị giới hạn (Free Tier - Unusual Activity). Để nghe đúng giọng ElevenLabs ${pSettings.name}, vui lòng nâng cấp gói hoặc cập nhật API key trong BE/appsettings.json. Hệ thống đang dùng tạm giọng trình duyệt.`, "warning", 8000);
          }
        }
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
        try { URL.revokeObjectURL(url); } catch (e) { }
        if (typeof setInterviewerState === "function") {
          setInterviewerState("idle", "Sẵn sàng");
        }
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
        try { URL.revokeObjectURL(url); } catch (e) { }
        debugTTS("TTS", "Audio playback error:", audioErr);
        if (typeof setInterviewerState === "function") {
          setInterviewerState("idle", "Sẵn sàng");
        }
        if (sessionId !== null) {
          completeSpeechOnce(sessionId, "elevenlabs_error");
        }
      };

      if (typeof setInterviewerState === "function") {
        setInterviewerState("speaking", "Đang đọc câu hỏi");
      } else if (typeof window.setInterviewerState === "function") {
        window.setInterviewerState("speaking", "Đang đọc câu hỏi");
      }

      try {
        await audio.play();
        return true;
      } catch (playErr) {
        if (playErr && playErr.name === "NotAllowedError") {
          debugTTS("TTS", "Audio play blocked by browser autoplay policy. Awaiting user interaction...");
          const unlockAudio = (evt) => {
            document.removeEventListener("click", unlockAudio);
            document.removeEventListener("keydown", unlockAudio);
            if (evt && evt.target && (evt.target.closest("#btn-start-interview") || evt.target.closest("#confirm-modal-start-btn"))) {
              return;
            }
            if (window._currentAIAudio === audio && window.ttsEnabled) {
              if (window._isInterviewSessionStarted && targetIdentity === "waiting_room_prompt") {
                debugTTS("TTS", "Interview already started; suppressing delayed waiting room audio.");
                return;
              }
              audio.play().catch(e => debugTTS("TTS", "Playback on unlock failed:", e));
            }
          };
          document.addEventListener("click", unlockAudio, { once: true });
          document.addEventListener("keydown", unlockAudio, { once: true });
          return true;
        }
        throw playErr;
      }
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
      try { window._activeTtsAbortController.abort(); } catch (e) { }
      window._activeTtsAbortController = null;
    }
    if (typeof stopTTSPreview === "function") {
      try { stopTTSPreview(); } catch (e) { }
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
    const usedEL = await speakElevenLabs(cleanText, onEndCallback, thisSessionId, targetIdentity);
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

      const personaVoiceSettings = resolveActivePersonaVoiceSettings();
      const allVoices = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
      const viVoices = allVoices.filter(v => v.lang && v.lang.toLowerCase().startsWith("vi"));

      let matchedVoice = null;
      if (personaVoiceSettings.gender === "female") {
        matchedVoice = viVoices.find(v => /hoaimy|hoài|my|linh|mai|lan|nữ|female|girl/i.test(v.name))
          || allVoices.find(v => /hoaimy|hoài|my|linh|mai|lan|nữ|female|girl/i.test(v.name));
      } else {
        matchedVoice = viVoices.find(v => /nam|vũ|minh|an|male|boy|man/i.test(v.name))
          || allVoices.find(v => /nam|vũ|minh|an|male|boy|man/i.test(v.name));
      }

      if (!matchedVoice && viVoices.length > 0) {
        matchedVoice = viVoices[0];
      }
      if (!matchedVoice) {
        const getVoice = typeof getPreferredSpeechVoice === "function" ? getPreferredSpeechVoice : (typeof window.getPreferredSpeechVoice === "function" ? window.getPreferredSpeechVoice : null);
        if (getVoice) {
          matchedVoice = getVoice();
        }
      }
      if (matchedVoice) utt.voice = matchedVoice;

      const userSpeed = typeof _currentTtsVoiceConfig.speed === "number" ? _currentTtsVoiceConfig.speed : 1.0;
      utt.pitch = 1.00; // Always use natural un-distorted pitch
      utt.rate = Math.min(1.5, Math.max(0.7, (personaVoiceSettings.rate || 1.0) * userSpeed));

      // Temporarily pause mic while AI is speaking
      const activeRec = typeof recognition !== "undefined" ? recognition : window.recognition;
      const activeListening = typeof isListening !== "undefined" ? isListening : window.isListening;
      if (activeRec && activeListening) {
        try { activeRec.stop(); } catch (e) { }
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
  window.resolveActivePersonaVoiceSettings = resolveActivePersonaVoiceSettings;
})();
