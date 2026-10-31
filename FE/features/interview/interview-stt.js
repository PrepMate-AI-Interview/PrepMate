/**
 * PREPMATE — INTERVIEW SPEECH-TO-TEXT (STT) SUBSYSTEM
 * Handles Web Speech Recognition, microphone states, transcript buffering,
 * accessibility indicators, and silent mic hints.
 *
 * Extracted from interview.js under Phase 1 / WI 1.17-B.
 * Strictly behavior-preserving refactor.
 */

// ==========================================
// SPEECH RECOGNITION (STT) & HARDENED MIC STATE MACHINE
// ==========================================

const MIC_STATE = {
  NO_PERMISSION: "NO_PERMISSION",
  REQUESTING_PERMISSION: "REQUESTING_PERMISSION",
  READY: "READY",
  LISTENING: "LISTENING",
  MUTED: "MUTED",
  ERROR: "ERROR",
  UNSUPPORTED: "UNSUPPORTED",
};

let currentMicState = MIC_STATE.MUTED;
let _silentMicTimer = null;
let _speechFinalTranscript = "";
let _speechInterimTranscript = "";
let _speechShouldRestart = false;

// Defensive accessors for cross-script dependencies loaded after interview-stt.js
function checkIsInterviewPaused() {
  if (typeof window.isInterviewPaused === "function") {
    return Boolean(window.isInterviewPaused());
  }
  if (typeof window.isInterviewPaused === "boolean") {
    return window.isInterviewPaused;
  }
  return false;
}

function checkIsProcessingAnswer() {
  if (typeof window.isProcessingAnswer === "function") {
    return Boolean(window.isProcessingAnswer());
  }
  if (typeof window.isProcessingAnswer === "boolean") {
    return window.isProcessingAnswer;
  }
  return false;
}

function checkIsSessionStarted() {
  return Boolean(window._isInterviewSessionStarted);
}

function setMicState(state, detail = "") {
  currentMicState = state;
  isListening = (state === MIC_STATE.LISTENING);
  if (typeof debugInterview === "function") {
    debugInterview("MIC_STATE", state, detail);
  }

  const micBtn = document.getElementById("btn-mic");
  const consoleMicBtn = document.getElementById("btn-console-mic");
  const consoleMicLabel = document.getElementById("console-mic-label");
  const candidateTile = document.getElementById("candidate-tile");
  const candidateMicBadge = document.getElementById("candidate-mic-badge");

  if (_silentMicTimer) {
    if (typeof clearTimeout === "function") {
      clearTimeout(_silentMicTimer);
    }
    _silentMicTimer = null;
  }

  const icons = typeof ZOOM_ICONS !== "undefined" ? ZOOM_ICONS : (window.ZOOM_ICONS || {});

  switch (state) {
    case MIC_STATE.LISTENING:
      if (micBtn) {
        micBtn.classList.add("recording");
        micBtn.classList.remove("off");
        micBtn.innerHTML = icons.micOn || "";
        micBtn.title = "Tắt Micro (Phím cách)";
        if (typeof micBtn.setAttribute === "function") {
          micBtn.setAttribute("aria-label", "Tắt micro");
          micBtn.setAttribute("aria-pressed", "true");
        }
        if (typeof micBtn.removeAttribute === "function") {
          micBtn.removeAttribute("aria-disabled");
        }
      }
      if (consoleMicBtn) {
        consoleMicBtn.classList.add("recording");
        consoleMicBtn.classList.remove("off");
        consoleMicBtn.title = "Dừng nói (Phím cách)";
        if (typeof consoleMicBtn.setAttribute === "function") {
          consoleMicBtn.setAttribute("aria-label", "Dừng nói");
          consoleMicBtn.setAttribute("aria-pressed", "true");
        }
      }
      if (consoleMicLabel) {
        consoleMicLabel.textContent = "Dừng nói";
      }
      if (candidateTile) candidateTile.classList.add("speaking");
      if (candidateMicBadge) {
        candidateMicBadge.innerHTML = icons.nameplateMicLive || "";
        candidateMicBadge.classList.add("live");
        candidateMicBadge.classList.remove("muted");
        candidateMicBadge.title = "Micro đang thu âm";
      }
      setSpeechStatus("listening");

      // Silent mic detection: 15s with 0 speech results triggers gentle hint
      _silentMicTimer = setTimeout(() => {
        if (currentMicState === MIC_STATE.LISTENING) {
          const hint = document.getElementById("speech-status-text-hint");
          if (hint) {
            hint.textContent = "Chưa nhận được âm thanh từ micro. Bạn có thể kiểm tra micro hoặc gõ trực tiếp câu trả lời.";
          }
        }
      }, 15000);
      break;

    case MIC_STATE.MUTED:
    case MIC_STATE.READY:
      if (micBtn) {
        micBtn.classList.remove("recording");
        micBtn.classList.add("off");
        micBtn.innerHTML = icons.micMuted || "";
        micBtn.title = "Bật Micro (Phím cách)";
        if (typeof micBtn.setAttribute === "function") {
          micBtn.setAttribute("aria-label", "Bật micro");
          micBtn.setAttribute("aria-pressed", "false");
        }
        if (typeof micBtn.removeAttribute === "function") {
          micBtn.removeAttribute("aria-disabled");
        }
      }
      if (consoleMicBtn) {
        consoleMicBtn.classList.remove("recording");
        consoleMicBtn.classList.add("off");
        consoleMicBtn.title = "Nói để trả lời (Bật micro)";
        if (typeof consoleMicBtn.setAttribute === "function") {
          consoleMicBtn.setAttribute("aria-label", "Nói để trả lời");
          consoleMicBtn.setAttribute("aria-pressed", "false");
        }
      }
      if (consoleMicLabel) {
        consoleMicLabel.textContent = "Nói để trả lời";
      }
      if (candidateTile) candidateTile.classList.remove("speaking");
      if (candidateMicBadge) {
        candidateMicBadge.innerHTML = icons.nameplateMicMuted || "";
        candidateMicBadge.classList.remove("live");
        candidateMicBadge.classList.add("muted");
        candidateMicBadge.title = "Micro đang tắt";
      }
      setSpeechStatus("ready");
      break;

    case MIC_STATE.NO_PERMISSION:
      if (micBtn) {
        micBtn.classList.remove("recording");
        micBtn.classList.add("off");
        micBtn.innerHTML = icons.micMuted || "";
        micBtn.title = "Chưa cấp quyền Micro. Bạn vẫn có thể nhập câu trả lời.";
        micBtn.setAttribute("aria-label", "Chưa cấp quyền micro");
        micBtn.setAttribute("aria-disabled", "true");
      }
      if (consoleMicBtn) {
        consoleMicBtn.classList.remove("recording");
        consoleMicBtn.classList.add("off");
        consoleMicBtn.title = "Chưa cấp quyền micro. Bạn vẫn có thể nhập nội dung.";
      }
      if (consoleMicLabel) {
        consoleMicLabel.textContent = "Chưa có quyền mic";
      }
      if (candidateTile) candidateTile.classList.remove("speaking");
      if (candidateMicBadge) {
        candidateMicBadge.innerHTML = icons.nameplateMicMuted || "";
        candidateMicBadge.classList.remove("live");
        candidateMicBadge.classList.add("muted");
      }
      setSpeechStatus("unavailable");
      break;

    case MIC_STATE.UNSUPPORTED:
      if (micBtn) {
        micBtn.classList.remove("recording");
        micBtn.classList.add("off");
        micBtn.innerHTML = icons.micMuted || "";
        micBtn.title = "Trình duyệt không hỗ trợ nhận dạng giọng nói. Bạn có thể nhập câu trả lời.";
        micBtn.setAttribute("aria-label", "Trình duyệt không hỗ trợ micro");
        micBtn.setAttribute("aria-disabled", "true");
      }
      if (consoleMicBtn) {
        consoleMicBtn.classList.remove("recording");
        consoleMicBtn.classList.add("off");
        consoleMicBtn.title = "Trình duyệt không hỗ trợ nhận dạng giọng nói.";
      }
      if (consoleMicLabel) {
        consoleMicLabel.textContent = "Không hỗ trợ mic";
      }
      if (candidateTile) candidateTile.classList.remove("speaking");
      if (candidateMicBadge) {
        candidateMicBadge.innerHTML = icons.nameplateMicMuted || "";
        candidateMicBadge.classList.remove("live");
        candidateMicBadge.classList.add("muted");
      }
      setSpeechStatus("unsupported");
      break;

    case MIC_STATE.ERROR:
      if (micBtn) {
        micBtn.classList.remove("recording");
        micBtn.classList.add("off");
        micBtn.innerHTML = icons.micMuted || "";
        micBtn.title = detail || "Lỗi micro. Bạn có thể nhập câu trả lời.";
        micBtn.setAttribute("aria-label", "Lỗi micro");
      }
      if (candidateTile) candidateTile.classList.remove("speaking");
      if (candidateMicBadge) {
        candidateMicBadge.innerHTML = icons.nameplateMicMuted || "";
        candidateMicBadge.classList.remove("live");
        candidateMicBadge.classList.add("muted");
      }
      setSpeechStatus("ready");
      break;
  }
}
window.MIC_STATE = MIC_STATE;
window.setMicState = setMicState;

function normalizeSpeechText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function resetSpeechTranscript() {
  _speechFinalTranscript = "";
  _speechInterimTranscript = "";
  if (typeof debugInterview === "function") {
    debugInterview("SPEECH", "Transcript buffer cleared.");
  }
}

function getSpeechTranscript() {
  const finalText = normalizeSpeechText(_speechFinalTranscript);
  const interimText = normalizeSpeechText(_speechInterimTranscript);
  if (!finalText) return interimText;
  if (!interimText) return finalText;
  return normalizeSpeechText(`${finalText} ${interimText}`);
}

function getSpeechFinalTranscript() {
  return _speechFinalTranscript;
}

function setSpeechFinalTranscript(text) {
  _speechFinalTranscript = String(text || "");
}

function getSpeechInterimTranscript() {
  return _speechInterimTranscript;
}

function setSpeechInterimTranscript(text) {
  _speechInterimTranscript = String(text || "");
}

function updateSpeechInput() {
  const input = document.getElementById("user-input");
  if (!input) return;

  const transcript = getSpeechTranscript();
  input.value = transcript;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Human-readable microphone status shown above the answer box.
 * Presentation only — never decides anything about the interview.
 * @param {"listening"|"ready"|"unavailable"|"unsupported"} kind
 */
function setSpeechStatus(kind) {
  const hint = document.getElementById("speech-status-text-hint");
  const pill = document.getElementById("speech-status-indicator");
  const labels = {
    listening: "Đang nghe...",
    ready: "Sẵn sàng — bật micro hoặc nhập câu trả lời",
    unavailable: "Không dùng được micro. Bạn có thể tiếp tục nhập câu trả lời.",
    unsupported: "Trình duyệt này chưa hỗ trợ nhận giọng nói. Bạn có thể nhập câu trả lời.",
  };
  if (hint) hint.textContent = labels[kind] || labels.ready;
  if (pill && pill.classList) {
    pill.classList.remove("is-listening");
    pill.classList.remove("is-ready");
    pill.classList.remove("is-unavailable");
    if (kind === "listening") pill.classList.add("is-listening");
    else if (kind === "ready") pill.classList.add("is-ready");
    else pill.classList.add("is-unavailable");
  }
}
window.setSpeechStatus = setSpeechStatus;

function initSpeech() {
  const micBtn = document.getElementById("btn-mic");
  const ttsBtn = document.getElementById("btn-tts");

  const icons = typeof ZOOM_ICONS !== "undefined" ? ZOOM_ICONS : (window.ZOOM_ICONS || {});
  const isTtsOn = typeof ttsEnabled !== "undefined" ? ttsEnabled : Boolean(window.ttsEnabled);

  if (ttsBtn) {
    ttsBtn.innerHTML = isTtsOn ? (icons.speakerOn || "") : (icons.speakerMuted || "");
    ttsBtn.classList.toggle("off", !isTtsOn);
    ttsBtn.setAttribute("aria-label", isTtsOn ? "Tắt âm thanh người phỏng vấn" : "Bật âm thanh người phỏng vấn");
    ttsBtn.setAttribute("aria-pressed", isTtsOn ? "true" : "false");
  }

  if (location.protocol === "file:") {
    if (micBtn) {
      micBtn.title = "Micro yêu cầu mở qua web server hoặc HTTPS";
      micBtn.style.opacity = "0.4";
      micBtn.style.cursor = "not-allowed";
      micBtn.onclick = () => {
        if (typeof showToast === "function") {
          showToast("Micro yêu cầu mở qua kết nối web server hoặc HTTPS", "warning");
        }
      };
    }
    setMicState(MIC_STATE.UNSUPPORTED, "Micro yêu cầu mở qua web server hoặc HTTPS");
    if (typeof debugInterview === "function") {
      debugInterview("SPEECH", "Disabled because page is running on file://");
    }
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (micBtn) {
      micBtn.style.opacity = "0.4";
      micBtn.title = "Trình duyệt không hỗ trợ nhận dạng giọng nói. Bạn có thể nhập câu trả lời.";
    }
    setMicState(MIC_STATE.UNSUPPORTED, "Trình duyệt không hỗ trợ nhận dạng giọng nói");
    if (typeof debugInterview === "function") {
      debugInterview("SPEECH", "SpeechRecognition not supported in browser.");
    }
    return;
  }

  if (recognition) {
    if (typeof getRecognitionLanguage === "function") {
      recognition.lang = getRecognitionLanguage();
    }
    return;
  }

  try {
    recognition = new SpeechRecognition();
    recognition.lang = typeof getRecognitionLanguage === "function" ? getRecognitionLanguage() : "vi-VN";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognition.onstart = () => {
      setMicState(MIC_STATE.LISTENING);
      if (typeof setInterviewerState === "function") {
        setInterviewerState("listening", "Đang lắng nghe bạn");
      }
      if (typeof debugInterview === "function") {
        debugInterview("SPEECH", "Recognition started.");
      }
    };

    recognition.onend = () => {
      setMicState(MIC_STATE.MUTED);
      if (typeof debugInterview === "function") {
        debugInterview("SPEECH", "Recognition ended.");
      }

      // Safe auto-restart ONLY if active and not paused / ended / submitting
      if (_speechShouldRestart && !checkIsInterviewPaused() && !checkIsProcessingAnswer() && checkIsSessionStarted()) {
        if (typeof debugInterview === "function") {
          debugInterview("SPEECH", "Restarting speech recognition safely...");
        }
        setTimeout(() => {
          if (!_speechShouldRestart || isListening || checkIsInterviewPaused() || checkIsProcessingAnswer()) return;
          try {
            recognition.start();
          } catch (e) {
            if (typeof debugInterview === "function") {
              debugInterview("SPEECH", "Recognition restart skipped/failed:", e.message);
            }
          }
        }, 200);
      }
    };

    recognition.onerror = (e) => {
      if (typeof debugInterview === "function") {
        debugInterview("SPEECH", "Recognition error:", e.error);
      }
      _speechShouldRestart = false;

      if (e.error === "aborted" || e.error === "no-speech") {
        setMicState(MIC_STATE.MUTED);
        return;
      }

      if (e.error === "not-allowed") {
        setMicState(MIC_STATE.NO_PERMISSION, "Không thể truy cập micro. Bạn có thể tiếp tục nhập văn bản.");
        if (typeof showToast === "function") {
          showToast("Không thể truy cập micro. Bạn có thể tiếp tục nhập văn bản.", "warning");
        }
      } else {
        setMicState(MIC_STATE.ERROR, `Lỗi micro (${e.error}). Bạn có thể nhập câu trả lời.`);
      }
    };

    recognition.onresult = (event) => {
      // Discard trailing speech recognition events during answer submission / question transition
      if (checkIsProcessingAnswer()) {
        return;
      }

      // Clear silent timer on receipt of speech
      if (_silentMicTimer) {
        if (typeof clearTimeout === "function") {
          clearTimeout(_silentMicTimer);
        }
        _silentMicTimer = null;
      }

      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result || !result[0]) continue;

        const transcript = result[0].transcript || "";
        if (result.isFinal) {
          _speechFinalTranscript = normalizeSpeechText(`${_speechFinalTranscript} ${transcript}`);
          _speechInterimTranscript = "";
          if (typeof debugInterview === "function") {
            debugInterview("SPEECH", "Final segment:", transcript);
          }
        } else {
          interimTranscript += ` ${transcript}`;
        }
      }

      _speechInterimTranscript = normalizeSpeechText(interimTranscript);
      updateSpeechInput();
      // RULE 13: Normal mode NEVER auto-submits on result!
    };
  } catch (err) {
    console.warn("[SPEECH] Failed to instantiate SpeechRecognition:", err);
  }
}

/**
 * Toggle Microphone (RULE 13: Normal mode speech -> textarea only, NEVER auto-submits)
 */
function toggleMic() {
  if (!checkIsSessionStarted()) {
    if (typeof toggleMicPreflight === "function") {
      toggleMicPreflight();
      return;
    }
    if (typeof showToast === "function") {
      showToast("Vui lòng nhấn Bắt đầu trước khi sử dụng Micro.", "warning");
    }
    return;
  }

  if (!recognition) {
    initSpeech();
    if (!recognition) {
      if (typeof showToast === "function") {
        showToast("Trình duyệt chưa hỗ trợ hoặc chưa cấp quyền Micro.", "warning");
      }
      return;
    }
  }

  if (isListening) {
    _speechShouldRestart = false;
    try {
      recognition.stop();
    } catch (e) {}
    setMicState(MIC_STATE.MUTED);
    if (typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.pauseAudioRecording === "function") {
      PrepMateAudioRecorder.pauseAudioRecording();
    }
    if (typeof debugInterview === "function") {
      debugInterview("SPEECH", "Microphone turned off by user (no auto-submit).");
    }
    return;
  }

  // Before turning ON, ensure transcript is synchronized with current input (or reset if empty)
  const inputEl = document.getElementById("user-input");
  if (inputEl && inputEl.value.trim()) {
    _speechFinalTranscript = inputEl.value.trim();
  } else {
    _speechFinalTranscript = "";
  }
  _speechInterimTranscript = "";

  // Turn ON microphone
  _speechShouldRestart = true;
  try {
    recognition.start();
    if (typeof debugInterview === "function") {
      debugInterview("SPEECH", "Microphone turned on by user.");
    }
  } catch (e) {
    if (typeof debugInterview === "function") {
      debugInterview("SPEECH", "Cannot start recognition:", e.message);
    }
  }

  // Audio & Visual recording trigger (WI-COACH-AUDIO-01 & WI-COACH-VIDEO-01)
  const isIntro = (typeof interviewPhase !== "undefined" && interviewPhase === "INTRODUCTION");
  const turnIdx = isIntro ? 0 : ((typeof currentQuestionIndex === "number" ? currentQuestionIndex : 0) + 1);
  const qText = isIntro ? "Giới thiệu bản thân" : ((typeof interviewQuestions !== "undefined" && Array.isArray(interviewQuestions)) ? (interviewQuestions[currentQuestionIndex] || "") : "");

  if (typeof PrepMateAudioRecorder !== "undefined") {
    if (PrepMateAudioRecorder.isRecordingPaused && PrepMateAudioRecorder.isRecordingPaused()) {
      PrepMateAudioRecorder.resumeAudioRecording();
    } else if (typeof PrepMateAudioRecorder.startAudioRecording === "function") {
      const isCamOn = (typeof currentCamState !== "undefined" && currentCamState === CAM_STATE.ON);
      PrepMateAudioRecorder.startAudioRecording(turnIdx, qText, { includeVideo: isCamOn });
    }
  }

  if (typeof captureAndAnalyzeCurrentFrame === "function") {
    try {
      captureAndAnalyzeCurrentFrame(turnIdx);
    } catch (e) {}
  }
}
window.toggleMic = toggleMic;

function stopSpeechRecognitionSilently() {
  _speechShouldRestart = false;
  if (recognition && isListening) {
    try {
      recognition.stop();
    } catch (e) {}
  }
  setMicState(MIC_STATE.MUTED);
}

// Single-source-of-truth properties on window for external callers and test runners
Object.defineProperty(window, "recognition", {
  get: () => recognition,
  set: (val) => { recognition = val; },
  configurable: true,
  enumerable: true
});

Object.defineProperty(window, "isListening", {
  get: () => isListening,
  set: (val) => { isListening = Boolean(val); },
  configurable: true,
  enumerable: true
});

Object.defineProperty(window, "currentMicState", {
  get: () => currentMicState,
  set: (val) => { currentMicState = val; },
  configurable: true,
  enumerable: true
});

Object.defineProperty(window, "_speechFinalTranscript", {
  get: () => _speechFinalTranscript,
  set: (val) => { _speechFinalTranscript = String(val || ""); },
  configurable: true,
  enumerable: true
});

Object.defineProperty(window, "_speechInterimTranscript", {
  get: () => _speechInterimTranscript,
  set: (val) => { _speechInterimTranscript = String(val || ""); },
  configurable: true,
  enumerable: true
});

Object.defineProperty(window, "_speechShouldRestart", {
  get: () => _speechShouldRestart,
  set: (val) => { _speechShouldRestart = Boolean(val); },
  configurable: true,
  enumerable: true
});

// Explicit Public API Exports
window.normalizeSpeechText = normalizeSpeechText;
window.resetSpeechTranscript = resetSpeechTranscript;
window.getSpeechTranscript = getSpeechTranscript;
window.getSpeechFinalTranscript = getSpeechFinalTranscript;
window.setSpeechFinalTranscript = setSpeechFinalTranscript;
window.getSpeechInterimTranscript = getSpeechInterimTranscript;
window.setSpeechInterimTranscript = setSpeechInterimTranscript;
window.updateSpeechInput = updateSpeechInput;
window.initSpeech = initSpeech;
window.stopSpeechRecognitionSilently = stopSpeechRecognitionSilently;
