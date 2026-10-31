// ==========================================
// PREPMATE — VIRTUAL INTERVIEW ROOM LOGIC
// ARCHITECTURE: SINGLE-STATE MACHINE & ADAPTIVE FLOW
// ==========================================

const DEBUG_INTERVIEW = true;

function debugInterview(category, ...args) {
  if (DEBUG_INTERVIEW) {
    console.log(`[${category}]`, ...args);
  }
}

// Session Storage Key
var INTERVIEW_SESSION_STORAGE_KEY = (typeof window !== "undefined" && window.INTERVIEW_SESSION_STORAGE_KEY) || "prepmate_backend_session_id";
if (typeof window !== "undefined") { window.INTERVIEW_SESSION_STORAGE_KEY = INTERVIEW_SESSION_STORAGE_KEY; }


// ==========================================
// UNIFIED GLOBAL STATE (SINGLE SOURCE OF TRUTH)
// ==========================================

// Global Interview Lifecycle Flags
window._isInterviewSessionStarted = false;
window._interviewPracticeInitialized = false;

// Interview Progress & Phase
let interviewPhase = "INTRODUCTION"; // "INTRODUCTION" | "ADAPTIVE_INTERVIEW" | "COMPLETED"
let interviewQuestionsMeta = []; // metadata objects matching question index

// Synchronize / initialize globals already declared in main.js
interviewQuestions = []; // string[] only (strictly unified)
currentQuestionIndex = 0;
userResponses = [];
window._interviewHistory = [];
window._topicsAsked = [];

// Request concurrency & double-click lock
let isProcessingAnswer = false;
let isInterviewPaused = false;
let isQuestionSpeaking = false;
let currentInterviewUIState = "not_started";
let _lastAppendedAiMessage = "";

// TTS Subsystem extracted to interview-tts.js in WI 1.18-B

// Hands-free mode setting
isHandsFreeMode = false;


// Think Time Timer State
window._thinkTimeInterval = null;
function clearThinkTimeCountdown() {
  if (window._thinkTimeInterval) {
    clearInterval(window._thinkTimeInterval);
    window._thinkTimeInterval = null;
  }
}
window.clearThinkTimeCountdown = clearThinkTimeCountdown;

// ==========================================
// CENTRALIZED UI STATE MACHINE & ACCESSIBILITY
// ==========================================

/**
 * WCAG 4.1.3 Accessible Screen Reader Announcer
 * @param {string} message
 */
function announceToScreenReader(message) {
  if (!message) return;
  const announcer = document.getElementById("sr-status-announcer");
  if (announcer) {
    announcer.textContent = "";
    setTimeout(() => {
      announcer.textContent = message;
    }, 50);
  }
}

/**
 * Single owner of button states & input accessibility
 * @param {"not_started"|"speaking"|"listening"|"processing"|"paused"|"completed"} state
 * @param {string} [customStatusText]
 */
function setInterviewUIState(state, customStatusText = "") {
  // If interview session is already started, NEVER allow reverting back to not_started
  if (state === "not_started" && window._isInterviewSessionStarted) {
    debugInterview("INTERVIEW STATE", "Prevented not_started while interview session is active. Coercing to listening.");
    state = "listening";
  }

  debugInterview("INTERVIEW STATE", "Transitioning to state:", state, customStatusText);
  currentInterviewUIState = state;

  if (state !== "processing" && typeof stopProcessingStatusProgression === "function") {
    stopProcessingStatusProgression();
  }

  const startBtn = document.getElementById("btn-start-interview");
  const endBtn = document.getElementById("btn-end-interview");
  const pauseBtn = document.getElementById("btn-pause-interview");
  const inputEl = document.getElementById("user-input");
  const sendBtn = document.getElementById("btn-send");
  const micBtn = document.getElementById("btn-mic");
  const consoleMicBtn = document.getElementById("btn-console-mic");
  const statusEl = document.getElementById("chat-status-text");

  switch (state) {
    case "not_started":
      if (startBtn) {
        startBtn.style.display = "inline-flex";
        startBtn.disabled = false;
      }
      if (endBtn) {
        endBtn.style.display = "none";
      }
      if (pauseBtn) {
        pauseBtn.disabled = true;
        pauseBtn.style.opacity = "0.5";
        pauseBtn.style.cursor = "not-allowed";
        pauseBtn.innerHTML = "⏸ Tạm dừng";
      }
      if (inputEl) {
        inputEl.disabled = true;
        inputEl.value = "";
        inputEl.placeholder = "Chờ bạn nhấn nút Bắt đầu phỏng vấn...";
      }
      if (sendBtn) {
        sendBtn.disabled = true;
      }
      if (micBtn) {
        if (typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.isMicPreviewActive === "function" && PrepMateAudioRecorder.isMicPreviewActive()) {
          micBtn.classList.remove("off");
          micBtn.classList.add("recording");
          micBtn.title = "Tắt kiểm tra Micro";
        } else {
          micBtn.classList.remove("recording");
          micBtn.classList.add("off");
          micBtn.title = "Bật kiểm tra Micro (Nói thử để kiểm tra)";
        }
      }
      if (consoleMicBtn) {
        if (typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.isMicPreviewActive === "function" && PrepMateAudioRecorder.isMicPreviewActive()) {
          consoleMicBtn.classList.remove("off");
          consoleMicBtn.classList.add("recording");
          consoleMicBtn.disabled = false;
          consoleMicBtn.title = "Tắt kiểm tra Micro";
        } else {
          consoleMicBtn.classList.remove("recording");
          consoleMicBtn.classList.add("off");
          consoleMicBtn.disabled = false;
          consoleMicBtn.title = "Bật kiểm tra Micro (Nói thử để kiểm tra)";
        }
      }
      setInterviewerState("idle", "Sẵn sàng");
      if (statusEl) {
        statusEl.innerText = customStatusText || "Chờ bạn nhấn nút Bắt đầu phỏng vấn...";
      }
      break;

    case "speaking":
      if (startBtn) startBtn.style.display = "none";
      if (endBtn) endBtn.style.display = "inline-flex";
      if (pauseBtn) {
        pauseBtn.disabled = false;
        pauseBtn.style.opacity = "1";
        pauseBtn.style.cursor = "pointer";
      }
      if (inputEl) {
        inputEl.disabled = false;
        inputEl.placeholder = "Người phỏng vấn đang đọc câu hỏi... Bạn có thể nhập câu trả lời.";
      }
      if (sendBtn) sendBtn.disabled = false;
      if (consoleMicBtn) consoleMicBtn.disabled = false;
      setInterviewerState("speaking", "Đang đọc câu hỏi");
      if (statusEl) {
        statusEl.innerText = customStatusText || "Người phỏng vấn đang đọc câu hỏi...";
      }
      break;

    case "listening":
      if (startBtn) startBtn.style.display = "none";
      if (endBtn) endBtn.style.display = "inline-flex";
      if (pauseBtn) {
        pauseBtn.disabled = false;
        pauseBtn.style.opacity = "1";
        pauseBtn.style.cursor = "pointer";
      }
      if (inputEl) {
        inputEl.disabled = false;
        inputEl.placeholder = "Nhập câu trả lời của bạn tại đây... (Enter để gửi)";
        inputEl.focus();
      }
      if (sendBtn) sendBtn.disabled = false;
      if (consoleMicBtn) consoleMicBtn.disabled = false;
      setInterviewerState("listening", "Đang lắng nghe");
      if (statusEl) {
        statusEl.innerText = customStatusText || "Mời bạn trình bày câu trả lời.";
      }
      break;

    case "processing":
      if (startBtn) startBtn.style.display = "none";
      if (endBtn) endBtn.style.display = "inline-flex";
      if (pauseBtn) {
        pauseBtn.disabled = false;
      }
      if (inputEl) {
        inputEl.disabled = true;
        inputEl.placeholder = "Người phỏng vấn đang ghi nhận câu trả lời...";
      }
      if (sendBtn) sendBtn.disabled = true;
      if (micBtn) {
        micBtn.classList.remove("recording");
        micBtn.classList.add("off");
      }
      if (consoleMicBtn) {
        consoleMicBtn.disabled = true;
        consoleMicBtn.classList.remove("recording");
        consoleMicBtn.classList.add("off");
      }
      setInterviewerState("thinking", "Đang ghi nhận");
      if (statusEl) {
        statusEl.innerText = customStatusText || "Người phỏng vấn đang phân tích câu trả lời của bạn...";
      }
      break;

    case "paused":
      if (startBtn) startBtn.style.display = "none";
      if (endBtn) endBtn.style.display = "inline-flex";
      if (pauseBtn) {
        pauseBtn.disabled = false;
        pauseBtn.innerHTML = "▶ Tiếp tục";
        pauseBtn.classList.add("btn-paused");
      }
      if (inputEl) {
        inputEl.disabled = true;
        inputEl.placeholder = "Phòng phỏng vấn đang tạm dừng...";
      }
      if (sendBtn) sendBtn.disabled = true;
      if (consoleMicBtn) {
        consoleMicBtn.disabled = true;
        consoleMicBtn.classList.remove("recording");
        consoleMicBtn.classList.add("off");
      }
      setInterviewerState("idle", "Đã tạm dừng");
      if (statusEl) {
        statusEl.innerText = customStatusText || "Phòng phỏng vấn đang tạm dừng.";
      }
      break;

    case "completed":
      if (startBtn) startBtn.style.display = "none";
      if (endBtn) endBtn.style.display = "none";
      if (pauseBtn) pauseBtn.disabled = true;
      if (inputEl) {
        inputEl.disabled = true;
        inputEl.value = "";
        inputEl.placeholder = "Buổi phỏng vấn đã hoàn thành.";
      }
      if (sendBtn) sendBtn.disabled = true;
      if (micBtn) {
        micBtn.classList.remove("recording");
        micBtn.classList.add("off");
      }
      if (consoleMicBtn) {
        consoleMicBtn.disabled = true;
        consoleMicBtn.classList.remove("recording");
        consoleMicBtn.classList.add("off");
      }
      setInterviewerState("thinking", "Hoàn tất báo cáo");
      if (statusEl) {
        statusEl.innerText = customStatusText || "Buổi phỏng vấn đã kết thúc.";
      }
      break;
  }

  if (statusEl && statusEl.innerText) {
    announceToScreenReader(statusEl.innerText);
  }
}

// ==========================================
// SPEECH RECOGNITION (STT) & HARDENED MIC STATE MACHINE
// Extracted to interview-stt.js (WI 1.17-B)
// ==========================================

// ==========================================
// TEXT-TO-SPEECH (TTS) SYSTEM
// Extracted to interview-tts.js (WI 1.18-B)
// ==========================================

// ==========================================
// START INTERVIEW SESSION (SINGLE OWNER)
// ==========================================

// ==========================================
// DEVICE PREFLIGHT & MICROPHONE TEST
// WI-INTERVIEW-PREFLIGHT-01
// ==========================================

let _preflightMicMuted = false;

async function startMicPreflightTest() {
  if (typeof PrepMateAudioRecorder === "undefined" || typeof PrepMateAudioRecorder.startMicPreview !== "function") {
    return;
  }
  const micBadge = document.getElementById("candidate-mic-badge");
  const micBtn = document.getElementById("btn-mic");
  const levelBar = document.getElementById("candidate-mic-level-bar");

  if (micBadge) {
    micBadge.title = "Đang kiểm tra micro...";
  }

  const result = await PrepMateAudioRecorder.startMicPreview((level) => {
    if (_preflightMicMuted || window._isInterviewSessionStarted) {
      if (levelBar) levelBar.style.width = "0%";
      return;
    }
    if (levelBar) {
      levelBar.style.width = Math.min(100, Math.max(0, level * 1.5)) + "%";
      if (level > 15) {
        levelBar.classList.add("active");
      } else {
        levelBar.classList.remove("active");
      }
    }
  });

  if (result.success) {
    _preflightMicMuted = false;
    window._micPreflightState = "ready";
    if (micBadge) {
      micBadge.classList.remove("muted");
      micBadge.classList.add("live");
      micBadge.title = "Micro sẵn sàng • Nói thử để kiểm tra";
      micBadge.innerHTML = `
        <svg class="zoom-nameplate-svg-live" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#22c55e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      `;
    }
    if (micBtn && !window._isInterviewSessionStarted) {
      micBtn.classList.remove("off");
      micBtn.classList.add("recording");
      micBtn.title = "Tắt kiểm tra Micro";
      micBtn.innerHTML = `
        <svg class="zoom-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      `;
    }
  } else {
    _preflightMicMuted = true;
    window._micPreflightState = (result.error === "NotAllowedError" || result.error === "denied") ? "denied" : "unavailable";
    if (micBadge) {
      micBadge.classList.remove("live");
      micBadge.classList.add("muted");
      micBadge.title = window._micPreflightState === "denied" ? "Chưa cấp quyền micro • Nhấp để thử lại" : "Micro không khả dụng";
    }
    if (micBtn && !window._isInterviewSessionStarted) {
      micBtn.classList.remove("recording");
      micBtn.classList.add("off");
      micBtn.title = "Cấp quyền / Bật Micro";
    }
    if (levelBar) levelBar.style.width = "0%";
  }
}
window.startMicPreflightTest = startMicPreflightTest;

function stopMicPreflightTest(closeTracks = false) {
  if (typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.stopMicPreview === "function") {
    PrepMateAudioRecorder.stopMicPreview(closeTracks);
  }
  const levelBar = document.getElementById("candidate-mic-level-bar");
  if (levelBar) {
    levelBar.style.width = "0%";
    levelBar.classList.remove("active");
  }
}
window.stopMicPreflightTest = stopMicPreflightTest;

function toggleMicPreflight() {
  if (window._isInterviewSessionStarted) return;
  if (_preflightMicMuted) {
    startMicPreflightTest();
    if (typeof showToast === "function") showToast("Đã bật kiểm tra micro.", "info");
  } else {
    _preflightMicMuted = true;
    stopMicPreflightTest(true);
    const micBadge = document.getElementById("candidate-mic-badge");
    const micBtn = document.getElementById("btn-mic");
    const levelBar = document.getElementById("candidate-mic-level-bar");
    if (micBadge) {
      micBadge.classList.remove("live");
      micBadge.classList.add("muted");
      micBadge.title = "Micro đang tắt • Nhấp để bật kiểm tra";
      micBadge.innerHTML = `
        <svg class="zoom-nameplate-svg-red" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="2" y1="2" x2="22" y2="22" stroke="#ef4444" stroke-width="2.6"/>
          <path d="M18.89 13.23A7.12 7.12 0 0 0 19 11v-1"/>
          <path d="M5 10v1a7 7 0 0 0 11.37 5.5"/>
          <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
          <path d="M9 9v2a3 3 0 0 0 5.12 2.12"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="8" y1="22" x2="16" y2="22"/>
        </svg>
      `;
    }
    if (micBtn) {
      micBtn.classList.remove("recording");
      micBtn.classList.add("off");
      micBtn.title = "Bật kiểm tra Micro";
      micBtn.innerHTML = `
        <svg class="zoom-svg-icon zoom-svg-muted" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="2" y1="2" x2="22" y2="22" stroke="#ef4444" stroke-width="2.5"/>
          <path d="M18.89 13.23A7.12 7.12 0 0 0 19 11v-1"/>
          <path d="M5 10v1a7 7 0 0 0 11.37 5.5"/>
          <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
          <path d="M9 9v2a3 3 0 0 0 5.12 2.12"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="8" y1="22" x2="16" y2="22"/>
        </svg>
      `;
    }
    if (levelBar) levelBar.style.width = "0%";
    if (typeof showToast === "function") showToast("Đã tắt kiểm tra micro.", "info");
  }
}
window.toggleMicPreflight = toggleMicPreflight;

function upsertActiveSessionToUserStorage(session) {
  if (!session) return;
  try {
    const getSessId = (s) => String(s?.id || s?.backendSessionId || s?.sessionId || s?.Id || "").trim();
    const sid = getSessId(session);
    if (!sid) return;

    const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
    const getUserSessionsFn = typeof getUserSessions === "function" ? getUserSessions : null;
    const saveUserSessionsFn = typeof saveUserSessions === "function" ? saveUserSessions : null;

    let sessions = [];
    if (currentUser && typeof getUserSessionsFn === "function") {
      sessions = getUserSessionsFn() || [];
    } else {
      try {
        sessions = JSON.parse(localStorage.getItem("interview_sessions")) || [];
      } catch (e) {
        sessions = [];
      }
    }
    if (!Array.isArray(sessions)) sessions = [];

    const itemToStore = {
      ...session,
      id: sid,
      backendSessionId: sid,
      sessionId: sid,
      status: session.status || "in_progress",
      date: session.date || new Date().toISOString(),
      createdAt: session.createdAt || session.date || new Date().toISOString(),
      jobTitle: session.jobTitle || "Buổi phỏng vấn",
      company: session.company || session.companyName || "Doanh nghiệp"
    };

    let replaced = false;
    for (let i = 0; i < sessions.length; i++) {
      if (getSessId(sessions[i]) === sid) {
        sessions[i] = { ...sessions[i], ...itemToStore };
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      sessions.unshift(itemToStore);
    }

    if (currentUser && typeof saveUserSessionsFn === "function") {
      saveUserSessionsFn(sessions);
    } else {
      localStorage.setItem("interview_sessions", JSON.stringify(sessions));
    }
  } catch (err) {
    stopProcessingStatusProgression();
    console.warn("[INTERVIEW] Failed to upsert active session to local storage:", err);
  }
}

async function startInterviewSession(skipConfirm = false) {
  // RULE 5 & 21: Double-click / already started protection
  if (window._isInterviewSessionStarted) {
    debugInterview("INTERVIEW", "Interview session already started. Ignoring repeat call.");
    return;
  }

  if (!skipConfirm) {
    showZoomStartConfirmModal();
    return;
  }

  debugInterview("INTERVIEW", "=== USER CONFIRMED START INTERVIEW ===");
  window._isInterviewSessionStarted = true;

  const startBtn = document.getElementById("btn-start-interview");
  const endBtn = document.getElementById("btn-end-interview");
  if (startBtn) startBtn.style.display = "none";
  if (endBtn) endBtn.style.display = "inline-flex";

  // Stop mic preflight meter, keeping stream active for active turn recording
  if (typeof stopMicPreflightTest === "function") {
    stopMicPreflightTest(false);
  }

  // Defer backend session creation to explicit confirmation
  if (!currentInterviewSession?.backendSessionId) {
    window._sessionCreationPromise = (async () => {
      try {
        const configStr = (typeof sessionStorage !== "undefined") ? sessionStorage.getItem("interview_init_data") : null;
        const config = configStr ? JSON.parse(configStr) : {};
        const jobTitle = config.jobTitle || currentInterviewSession?.jobTitle || "Chuyên viên";
        const companyName = config.companyName || currentInterviewSession?.companyName || "";
        const interviewRound = config.interviewRound || currentInterviewSession?.interviewRound || "round1";
        const jdText = config.jdText || currentInterviewSession?.jdText || "";
        const userDescription = config.userDescription || currentInterviewSession?.userDescription || "";
        const interviewLanguage = config.interviewLanguage || currentInterviewSession?.interviewLanguage || "vi";

        const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
        const data = await InterviewApiClient.createSession({
          userId: currentUser?.id || "guest",
          jobTitle,
          companyName,
          interviewRound,
          experienceLevel: config.experienceLevel || config.seniority || "",
          targetLevel: config.targetLevel || config.seniority || "",
          targetPosition: jobTitle,
          targetCompany: companyName,
          cvText: config.cvText || "",
          jdText,
          userDescription,
          specialization: config.selectedIndustry || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("prepmate_selected_industry") : "") || "",
          interviewLanguage,
          language: interviewLanguage,
          maximumQuestions: 15,
        });

        const backendSessionId = data.sessionId || data.id || data.Id;
        currentInterviewSession.id = backendSessionId;
        currentInterviewSession.backendSessionId = backendSessionId;
        currentInterviewSession.status = data.status || "in_progress";
        sessionStorage.setItem(INTERVIEW_SESSION_STORAGE_KEY, backendSessionId);
        try {
          if (typeof InterviewApiClient !== "undefined" && typeof InterviewApiClient.startSession === "function") {
            await InterviewApiClient.startSession(backendSessionId);
          }
        } catch (startErr) {
          console.warn("[START INTERVIEW] startSession commit warning:", startErr);
        }
        upsertActiveSessionToUserStorage(currentInterviewSession);
        return backendSessionId;
      } catch (err) {
        console.error("[START INTERVIEW] Backend session creation error:", err);
        if (typeof showToast === "function") {
          showToast("Lỗi kết nối máy chủ: " + err.message, "danger");
        }
        window._isInterviewSessionStarted = false;
        if (startBtn) startBtn.style.display = "inline-flex";
        if (endBtn) endBtn.style.display = "none";
        throw err;
      }
    })();

    try {
      await window._sessionCreationPromise;
    } catch (e) {
      return;
    }
  }

  const sessionId = currentInterviewSession?.backendSessionId || currentInterviewSession?.id;
  if (sessionId) {
    sessionStorage.setItem("prepmate_interview_started_" + sessionId, "true");
  }

  // Analytics tracking (GA4)
  if (typeof PrepMateAnalytics !== "undefined" && typeof PrepMateAnalytics.trackInterviewStart === "function") {
    try {
      PrepMateAnalytics.trackInterviewStart(currentInterviewSession?.jobTitle, currentInterviewSession?.specialization);
    } catch (e) {}
  }

  // Start total timer
  startInterviewTimer();

  // Clear any existing error banners
  if (typeof clearInterviewErrorGuidance === "function") {
    clearInterviewErrorGuidance();
  }
  if (typeof clearInterviewErrorMessage === "function") {
    clearInterviewErrorMessage();
  }

  // Determine which phase to execute
  if (interviewPhase === "INTRODUCTION") {
    showIntroductionPhase();
  } else if (interviewPhase === "ADAPTIVE_INTERVIEW") {
    showAdaptiveQuestion();
  }
}
window.startInterviewSession = startInterviewSession;


// ==========================================
// INTRODUCTION PHASE FLOW (RULE 6)
// ==========================================

async function showIntroductionPhase() {
  interviewPhase = "INTRODUCTION";
  if (currentInterviewSession) {
    currentInterviewSession.phase = "INTRODUCTION";
    currentInterviewSession.stage = "INTRODUCTION";
  }

  // Ensure pristine answer box & transcripts for intro
  const inputEl = document.getElementById("user-input");
  if (inputEl && !isProcessingAnswer) {
    inputEl.value = "";
  }
  resetSpeechTranscript();

  const introPromptText =
    "Xin chào bạn. Chúng ta sẽ bắt đầu buổi phỏng vấn. " +
    "Hãy trả lời tự nhiên như trong một buổi phỏng vấn thực tế. " +
    "Trước tiên, bạn hãy giới thiệu ngắn gọn về bản thân, " +
    "kinh nghiệm và những dự án nổi bật mà bạn đã thực hiện nhé.";

  // Update prompter stage
  const currentQEl = document.getElementById("current-question-text");
  if (currentQEl) currentQEl.textContent = introPromptText;

  updateStagePresentation("INTRODUCTION", false, 1, true);

  // Append AI introduction message to chat exactly once
  appendAIMessage(introPromptText, null);

  // Set speaking state
  setInterviewUIState("speaking", "Người phỏng vấn đang đọc phần giới thiệu...");

  // Begin in-turn visual sampling immediately as candidate views intro prompt (WI-COACH-VIDEO-02B)
  if (typeof handleInterviewTurnStarted === "function") {
    try { handleInterviewTurnStarted(0); } catch (e) {}
  } else if (typeof window !== "undefined" && typeof window.handleInterviewTurnStarted === "function") {
    try { window.handleInterviewTurnStarted(0); } catch (e) {}
  }

  // Speak AI (TTS ON speaks, TTS OFF skips directly)
  await speakAI(introPromptText, () => {
    // When done speaking, enable input and start countdown
    setInterviewUIState("listening", "Hãy giới thiệu về bản thân bạn.");
    startQuestionCountdown(120);
    if (typeof handleInterviewTurnStarted === "function") {
      try { handleInterviewTurnStarted(0); } catch (e) {}
    } else if (typeof window !== "undefined" && typeof window.handleInterviewTurnStarted === "function") {
      try { window.handleInterviewTurnStarted(0); } catch (e) {}
    } else if (typeof captureAndAnalyzeCurrentFrame === "function") {
      try { captureAndAnalyzeCurrentFrame(0); } catch (e) {}
    }
  }, "intro");
}

// ==========================================
// ADAPTIVE QUESTION FLOW (RULE 7, 8, 9, 10)
// ==========================================

/**
 * Universal Adaptive Question renderer & speaker (Deduplicated single owner)
 */
async function showAdaptiveQuestion() {
  if (interviewPhase === "COMPLETED") return;

  if (!Array.isArray(interviewQuestions) || interviewQuestions.length === 0) {
    console.error("[INTERVIEW] Cannot show question: interviewQuestions is empty.");
    showToast("Không tìm thấy câu hỏi của phiên phỏng vấn.", "danger");
    setInterviewUIState("listening", "Chưa có câu hỏi khả dụng.");
    return;
  }

  const question = interviewQuestions[currentQuestionIndex];
  if (!question) {
    console.error("[INTERVIEW] Current question missing at index:", currentQuestionIndex);
    return;
  }

  // Ensure answer input & speech transcript are completely pristine for this new question
  const inputEl = document.getElementById("user-input");
  if (inputEl && !isProcessingAnswer) {
    inputEl.value = "";
  }
  resetSpeechTranscript();

  const meta = interviewQuestionsMeta[currentQuestionIndex] || {};
  const currentStage = meta.stage || currentInterviewSession?.stage || "TECHNICAL_ASSESSMENT";
  debugInterview("INTERVIEW", `Showing Question #${currentQuestionIndex + 1} (${currentStage}):`, question);

  interviewPhase = "ADAPTIVE_INTERVIEW";
  if (currentInterviewSession) {
    currentInterviewSession.phase = "ADAPTIVE_INTERVIEW";
    currentInterviewSession.stage = currentStage;
  }

  // 1. Update prompter UI (RULE 8: AI Question goes to prompter & chat, NEVER into textarea)
  const currentQEl = document.getElementById("current-question-text");
  if (currentQEl) {
    currentQEl.textContent = question;
    announceToScreenReader("Câu hỏi phỏng vấn: " + question);
  }

  const isTransition = Boolean(
    meta.isTransitionPrompt ||
    currentStage === "CANDIDATE_QUESTIONS" ||
    currentStage === "CLOSING" ||
    currentStage === "COMPLETED"
  );

  let evaluatedQuestionNum = 0;
  for (let i = 0; i <= currentQuestionIndex; i++) {
    const m = interviewQuestionsMeta[i];
    if (!m?.isTransitionPrompt && m?.stage !== "CANDIDATE_QUESTIONS" && m?.stage !== "CLOSING" && m?.stage !== "COMPLETED") {
      evaluatedQuestionNum++;
    }
  }
  if (evaluatedQuestionNum === 0) evaluatedQuestionNum = 1;

  updateStagePresentation(currentStage, meta.isFollowUp, evaluatedQuestionNum, isTransition);

  // 2. Append AI message to Chat box exactly once
  appendAIMessage(question, null, meta.isFollowUp);

  // 3. Set speaking state
  setInterviewUIState("speaking", "Người phỏng vấn đang đọc câu hỏi...");

  // Begin in-turn visual sampling immediately as candidate views question (WI-COACH-VIDEO-02B)
  if (typeof handleInterviewTurnStarted === "function") {
    try { handleInterviewTurnStarted(currentQuestionIndex + 1); } catch (e) {}
  } else if (typeof window !== "undefined" && typeof window.handleInterviewTurnStarted === "function") {
    try { window.handleInterviewTurnStarted(currentQuestionIndex + 1); } catch (e) {}
  }

  // 4. Speak AI with TTS (RULE 9 & 14)
  await speakAI(question, () => {
    // When done speaking (or immediately if TTS is OFF), enable input & focus
    setInterviewUIState("listening", "Mời bạn trình bày câu trả lời.");
    startQuestionCountdown(120);
    if (typeof handleInterviewTurnStarted === "function") {
      try { handleInterviewTurnStarted(currentQuestionIndex + 1); } catch (e) {}
    } else if (typeof window !== "undefined" && typeof window.handleInterviewTurnStarted === "function") {
      try { window.handleInterviewTurnStarted(currentQuestionIndex + 1); } catch (e) {}
    } else if (typeof captureAndAnalyzeCurrentFrame === "function") {
      try { captureAndAnalyzeCurrentFrame(currentQuestionIndex + 1); } catch (e) {}
    }
  }, "question_" + currentQuestionIndex);
}

// ==========================================
// INTERVIEW ERROR RECOVERY & GUIDANCE
// ==========================================

function showInterviewErrorGuidance(errorInfo) {
  const guidanceEl = document.getElementById("stage-context-guidance");
  if (!guidanceEl) return;

  const safeEscape = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
  const title = safeEscape(errorInfo?.title || "Sự cố kết nối AI");
  const detail = safeEscape(errorInfo?.message || "Không thể kết nối đến mô hình AI.");
  const actionPrompt = safeEscape(errorInfo?.actionPrompt || "Vui lòng kiểm tra lại và thử gửi lại.");

  guidanceEl.style.display = "block";
  guidanceEl.className = "ir-stage-guidance is-error";
  guidanceEl.setAttribute("role", "alert");
  guidanceEl.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div style="flex:1;min-width:240px;">
        <div class="guidance-error-header" style="display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:4px;color:#dc2626;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>${title}</span>
        </div>
        <p class="guidance-error-body" style="margin:0 0 4px 0;font-size:12.5px;line-height:1.45;color:#7f1d1d;">${detail}</p>
        <span class="guidance-error-prompt" style="font-size:12px;color:#991b1b;opacity:0.9;">${actionPrompt}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;align-self:center;">
        <button type="button" class="btn-retry-stage" onclick="retryInterviewSubmission()" style="display:inline-flex;align-items:center;gap:5px;background:#dc2626;color:#ffffff;border:none;border-radius:6px;font-size:12.5px;font-weight:600;padding:6px 14px;cursor:pointer;" title="Gửi lại câu trả lời">
          Thử lại
        </button>
      </div>
    </div>
  `;
}

function clearInterviewErrorGuidance() {
  const guidanceEl = document.getElementById("stage-context-guidance");
  if (!guidanceEl) return;
  guidanceEl.style.display = "none";
  guidanceEl.className = "ir-stage-guidance";
  guidanceEl.innerHTML = "";
  if (typeof guidanceEl.removeAttribute === "function") {
    guidanceEl.removeAttribute("role");
  }
}

function retryInterviewSubmission() {
  clearInterviewErrorGuidance();
  if (typeof clearInterviewErrorMessage === "function") {
    clearInterviewErrorMessage();
  }
  sendMessage();
}

if (typeof window !== "undefined") {
  window.showInterviewErrorGuidance = showInterviewErrorGuidance;
  window.clearInterviewErrorGuidance = clearInterviewErrorGuidance;
  window.retryInterviewSubmission = retryInterviewSubmission;
}

// ==========================================
// SUBMIT INTRODUCTION (BACKEND ANALYSIS)
// ==========================================

async function submitIntroduction(introductionText) {
  const sessionId = currentInterviewSession?.backendSessionId || currentInterviewSession?.id;
  if (!sessionId) {
    showToast("Phiên phỏng vấn chưa được khởi tạo.", "danger");
    setInterviewUIState("listening", "Lỗi: Không tìm thấy sessionId.");
    isProcessingAnswer = false;
    const inputEl = document.getElementById("user-input");
    if (inputEl) {
      inputEl.value = introductionText;
      inputEl.disabled = false;
      inputEl.focus();
    }
    if (typeof setSpeechFinalTranscript === "function") {
      setSpeechFinalTranscript(introductionText);
    } else {
      window._speechFinalTranscript = introductionText;
    }
    return;
  }

  debugInterview("INTERVIEW API", "POST /api/ai/introduction with sessionId:", sessionId);

  try {
    startProcessingStatusProgression("Đang phân tích phần giới thiệu...");
    const data = await InterviewApiClient.submitIntroduction(sessionId, introductionText);
    stopProcessingStatusProgression();

    debugInterview("INTERVIEW API", "Introduction analysis response:", data);

    if (interviewPhase === "COMPLETED") {
      isProcessingAnswer = false;
      return;
    }

    // RULE 7: Safe question text extraction
    const firstQuestionText = extractQuestionText(data);
    if (!firstQuestionText) {
      throw new Error("Backend chưa trả về câu hỏi đầu tiên sau phần giới thiệu.");
    }

    // Clear previous error guidance and chat error messages on successful response
    clearInterviewErrorGuidance();
    if (typeof clearInterviewErrorMessage === "function") {
      clearInterviewErrorMessage();
    }

    // Candidate answer confirmed: append to chat, clear textarea & reset transcripts
    appendUserMessage(introductionText, 0);
    const inputEl = document.getElementById("user-input");
    if (inputEl) inputEl.value = "";
    resetSpeechTranscript();

    // Finalize audio recording for Introduction turn (WI-COACH-AUDIO-01)
    if (typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.stopAndSaveAudioRecording === "function") {
      PrepMateAudioRecorder.stopAndSaveAudioRecording(sessionId, 0, "Giới thiệu bản thân");
    }

    // Complete in-turn visual sampling for Introduction turn (WI-COACH-VIDEO-03)
    if (typeof handleInterviewTurnCompleted === "function") {
      try { await handleInterviewTurnCompleted(0); } catch (e) {}
    } else if (typeof window !== "undefined" && typeof window.handleInterviewTurnCompleted === "function") {
      try { await window.handleInterviewTurnCompleted(0); } catch (e) {}
    }

    // Save intro response
    currentInterviewSession.introduction = introductionText;
    userResponses.push({
      question: "Giới thiệu bản thân",
      answer: introductionText,
      score: null,
      offTopic: false,
      phase: "INTRODUCTION",
    });
    window._interviewHistory.push({
      question: "Giới thiệu bản thân",
      answer: introductionText,
      phase: "INTRODUCTION",
    });

    // Switch Phase to ADAPTIVE_INTERVIEW
    interviewPhase = "ADAPTIVE_INTERVIEW";
    if (currentInterviewSession) {
      currentInterviewSession.phase = "ADAPTIVE_INTERVIEW";
      currentInterviewSession.introductionAnalysis = data.analysis || null;
    }

    // Store first question & metadata
    currentQuestionIndex = 0;
    interviewQuestions = [firstQuestionText];
    interviewQuestionsMeta = [extractQuestionMetadata(data)];

    if (data.topic && !window._topicsAsked.includes(data.topic)) {
      window._topicsAsked.push(data.topic);
    }

    isProcessingAnswer = false;

    // Show the first adaptive question
    setTimeout(() => {
      showAdaptiveQuestion();
    }, 300);
  } catch (error) {
    stopProcessingStatusProgression();
    console.error("[INTERVIEW API] Introduction submission failed:", error);

    const errorInfo = typeof categorizeInterviewError === "function"
      ? categorizeInterviewError(error)
      : (typeof InterviewApiClient !== "undefined" && typeof InterviewApiClient.categorizeError === "function"
          ? InterviewApiClient.categorizeError(error)
          : null);

    const displayMsg = errorInfo?.message || error.message || "Không thể gửi phần giới thiệu tới backend.";
    const shortStatus = errorInfo?.shortStatus || "Có lỗi xảy ra. Bạn có thể thử gửi lại câu trả lời.";

    if (typeof showToast === "function") {
      showToast(displayMsg, "danger");
    }
    announceToScreenReader(shortStatus);

    isProcessingAnswer = false;
    setInterviewUIState("listening", shortStatus);

    if (errorInfo && typeof showInterviewErrorGuidance === "function") {
      showInterviewErrorGuidance(errorInfo);
    }
    if (errorInfo && typeof appendInterviewErrorMessage === "function") {
      appendInterviewErrorMessage(errorInfo.message, errorInfo.title);
    }

    // CANDIDATE ANSWER PRESERVATION: restore text into textarea so it is not lost
    const inputEl = document.getElementById("user-input");
    if (inputEl) {
      inputEl.value = introductionText;
      inputEl.disabled = false;
      inputEl.focus();
    }
    if (typeof setSpeechFinalTranscript === "function") {
      setSpeechFinalTranscript(introductionText);
    } else {
      window._speechFinalTranscript = introductionText;
    }
  }
}

// ==========================================
let _processingStatusTimer = null;

function startProcessingStatusProgression(initialText = "Đang phân tích câu trả lời...") {
  stopProcessingStatusProgression();
  setInterviewUIState("processing", initialText);

  _processingStatusTimer = setTimeout(() => {
    if (isProcessingAnswer && currentInterviewUIState === "processing") {
      setInterviewUIState("processing", "Đang chuẩn bị câu hỏi tiếp theo...");
    }
  }, 3200);
}

function stopProcessingStatusProgression() {
  if (_processingStatusTimer) {
    clearTimeout(_processingStatusTimer);
    _processingStatusTimer = null;
  }
}
// SEND MESSAGE (RULE 11 & 12: UNIFIED ANSWER SUBMIT)
// ==========================================

async function sendMessage() {
  // RULE 21: Concurrency / double-submit lock
  if (isProcessingAnswer) {
    debugInterview("INTERVIEW", "Already processing an answer. Ignoring duplicate submission.");
    return;
  }

  const inputEl = document.getElementById("user-input");
  // Single source of truth for user input
  const userInput = inputEl?.value.trim() || "";

  if (!userInput) {
    if (typeof showToast === "function") {
      showToast("Vui lòng nhập hoặc nói câu trả lời của bạn.", "warning");
    }
    return;
  }

  // Clear any existing error banner when a new submission attempt starts
  if (typeof clearInterviewErrorGuidance === "function") {
    clearInterviewErrorGuidance();
  }

  // Lock submission immediately
  isProcessingAnswer = true;
  debugInterview("INTERVIEW", "Sending user answer:", userInput.substring(0, 50));

  // Stop any active speech immediately
  cancelCurrentSpeech("submit_answer");

  // Stop recording if active
  stopSpeechRecognitionSilently();

  // Stop answer countdown
  stopQuestionCountdown();
  if (typeof clearThinkTimeCountdown === "function") {
    clearThinkTimeCountdown();
  }

  // Set processing UI state with progressive status updates
  startProcessingStatusProgression("Đang phân tích câu trả lời...");

  // Ensure deferred session creation has resolved before submitting answer
  if (window._sessionCreationPromise) {
    try {
      await window._sessionCreationPromise;
    } catch (e) {}
  }

  // Flow check: Introduction vs Adaptive Interview
  if (interviewPhase === "INTRODUCTION") {
    await submitIntroduction(userInput);
    return;
  }

  // --- ADAPTIVE INTERVIEW ANSWER SUBMISSION ---
  const sessionId = currentInterviewSession?.backendSessionId || currentInterviewSession?.id;
  if (!sessionId) {
    showToast("Phiên phỏng vấn chưa được khởi tạo.", "danger");
    isProcessingAnswer = false;
    setInterviewUIState("listening", "Phiên phỏng vấn chưa được khởi tạo.");
    if (inputEl) {
      inputEl.value = userInput;
      inputEl.disabled = false;
      inputEl.focus();
    }
    if (typeof setSpeechFinalTranscript === "function") {
      setSpeechFinalTranscript(userInput);
    } else {
      window._speechFinalTranscript = userInput;
    }
    return;
  }

  const currentQuestion = interviewQuestions[currentQuestionIndex];
  if (!currentQuestion) {
    console.error("[INTERVIEW] Missing current question for submission.");
    isProcessingAnswer = false;
    setInterviewUIState("listening", "Chưa xác định được câu hỏi hiện tại.");
    if (inputEl) {
      inputEl.value = userInput;
      inputEl.disabled = false;
      inputEl.focus();
    }
    if (typeof setSpeechFinalTranscript === "function") {
      setSpeechFinalTranscript(userInput);
    } else {
      window._speechFinalTranscript = userInput;
    }
    return;
  }

  debugInterview("INTERVIEW API", "POST /api/ai/respond with answer length:", userInput.length);

  try {
    const data = await InterviewApiClient.submitAnswer(sessionId, currentQuestion, userInput);
    stopProcessingStatusProgression();

    debugInterview("INTERVIEW API", "Adaptive response received:", data);

    if (interviewPhase === "COMPLETED") {
      isProcessingAnswer = false;
      return;
    }

    // Clear previous error guidance and chat error messages on successful response
    clearInterviewErrorGuidance();
    if (typeof clearInterviewErrorMessage === "function") {
      clearInterviewErrorMessage();
    }

    // Candidate answer confirmed: append to chat, clear textarea & reset transcripts
    appendUserMessage(userInput, currentQuestionIndex + 1);
    if (inputEl) inputEl.value = "";
    resetSpeechTranscript();

    // Finalize audio recording for this question turn (WI-COACH-AUDIO-01)
    if (typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.stopAndSaveAudioRecording === "function") {
      PrepMateAudioRecorder.stopAndSaveAudioRecording(sessionId, currentQuestionIndex + 1, currentQuestion);
    }

    // Complete in-turn visual sampling for this question turn (WI-COACH-VIDEO-03)
    if (typeof handleInterviewTurnCompleted === "function") {
      try { await handleInterviewTurnCompleted(currentQuestionIndex + 1); } catch (e) {}
    } else if (typeof window !== "undefined" && typeof window.handleInterviewTurnCompleted === "function") {
      try { await window.handleInterviewTurnCompleted(currentQuestionIndex + 1); } catch (e) {}
    }

    // Record history
    userResponses.push({
      question: currentQuestion,
      answer: userInput,
      score: null,
      offTopic: false,
      phase: "ADAPTIVE_INTERVIEW",
    });
    window._interviewHistory.push({
      question: currentQuestion,
      answer: userInput,
      phase: "ADAPTIVE_INTERVIEW",
    });

    // Check if interview completed
    if (data.isFinished === true) {
      debugInterview("INTERVIEW", "Interview finished by backend directive.");
      setInterviewUIState("completed", "Buổi phỏng vấn đã kết thúc.");
      isProcessingAnswer = false;
      setTimeout(() => {
        if (typeof window !== "undefined" && typeof window.endInterview === "function") {
          window.endInterview(false);
        } else if (typeof endInterview === "function") {
          endInterview(false);
        }
      }, 500);
      return;
    }

    // Extract next question
    const nextQuestionText = extractQuestionText(data);
    if (!nextQuestionText) {
      throw new Error("AI chưa trả về nội dung câu hỏi tiếp theo.");
    }

    // Advance question index and store question
    currentQuestionIndex++;
    interviewQuestions[currentQuestionIndex] = nextQuestionText;
    interviewQuestionsMeta[currentQuestionIndex] = extractQuestionMetadata(data);

    if (data.topic && !window._topicsAsked.includes(data.topic)) {
      window._topicsAsked.push(data.topic);
    }

    isProcessingAnswer = false;

    // Display next question
    setTimeout(() => {
      showAdaptiveQuestion();
    }, 300);
  } catch (error) {
    stopProcessingStatusProgression();
    console.error("[INTERVIEW API] Respond error:", error);

    const errorInfo = typeof categorizeInterviewError === "function"
      ? categorizeInterviewError(error)
      : (typeof InterviewApiClient !== "undefined" && typeof InterviewApiClient.categorizeError === "function"
          ? InterviewApiClient.categorizeError(error)
          : null);

    const displayMsg = errorInfo?.message || error.message || "Không thể gửi câu trả lời tới backend.";
    const shortStatus = errorInfo?.shortStatus || "Có lỗi xảy ra. Bạn có thể gửi lại câu trả lời.";

    if (typeof showToast === "function") {
      showToast(displayMsg, "danger");
    }
    announceToScreenReader(shortStatus);

    isProcessingAnswer = false;
    setInterviewUIState("listening", shortStatus);

    if (errorInfo && typeof showInterviewErrorGuidance === "function") {
      showInterviewErrorGuidance(errorInfo);
    }
    if (errorInfo && typeof appendInterviewErrorMessage === "function") {
      appendInterviewErrorMessage(errorInfo.message, errorInfo.title);
    }

    // CANDIDATE ANSWER PRESERVATION: restore text into textarea so it is not lost
    if (inputEl) {
      inputEl.value = userInput;
      inputEl.disabled = false;
      inputEl.focus();
    }
    if (typeof setSpeechFinalTranscript === "function") {
      setSpeechFinalTranscript(userInput);
    } else {
      window._speechFinalTranscript = userInput;
    }
  }
}
window.sendMessage = sendMessage;

function handleKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    sendMessage();
  }
}
window.handleKeyDown = handleKeyDown;

function handleKeyPress(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    sendMessage();
  }
}
window.handleKeyPress = handleKeyPress;

// ==========================================
// PAUSE / RESUME INTERVIEW (RULE 23)
// Extracted to interview-pause.js (WI 1.20-B)
// Public APIs exposed on window: pauseInterview, resumeInterview,
// isInterviewPaused, setIsInterviewPaused, clearInterviewPause
// ==========================================

// ==========================================
// END INTERVIEW & DEBRIEF REPORT GENERATION
// Extracted to interview-finish.js (WI 1.19-B)
// Public APIs exposed on window: endInterview, applyUnEvaluatedSessionAndShow,
// applyReportToSessionAndShow, saveCompletedInterviewSession, showFinishModal, closeFinishModal
// Fallback jobTitle is currentInterviewSession?.jobTitle || "Chuyên viên chuyên môn"
// Debrief metric card label is <span class="debrief-metric-label">Chuyên môn</span>
// ==========================================

// ==========================================
// ASSISTANCE: CLARIFICATION & 30s THINK TIME
// ==========================================

function requestClarification() {
  if (interviewPhase !== "ADAPTIVE_INTERVIEW" && interviewPhase !== "TECHNICAL_ASSESSMENT") return;
  const currentQ = interviewQuestions[currentQuestionIndex];
  if (!currentQ) return;

  setInterviewerState("speaking", "Đang giải thích");

  const clarificationText =
    "Để làm rõ hơn, câu hỏi này nhằm tìm hiểu cách bạn áp dụng kinh nghiệm vào thực tế. " +
    "Bạn hãy nêu một tình huống hoặc dự án bạn từng trực tiếp xử lý đối với câu hỏi này nhé.";

  appendAIMessage(clarificationText, null);

  try {
    speakAI(clarificationText, () => {
      setInterviewUIState("listening", "Mời bạn tiếp tục trả lời.");
    }, "clarification_" + currentQuestionIndex);
  } catch (e) {
    setInterviewUIState("listening");
  }
}
window.requestClarification = requestClarification;

function requestThinkTime() {
  clearThinkTimeCountdown();
  setInterviewerState("thinking", "Bạn có 30 giây chuẩn bị");
  if (typeof showToast === "function") {
    showToast("Được chứ, bạn có 30 giây để sắp xếp ý chính.", "info");
  }

  const input = document.getElementById("user-input");
  const prevPlaceholder = input?.getAttribute("data-original-placeholder") || input?.placeholder || "";
  if (input) {
    if (!input.getAttribute("data-original-placeholder")) {
      input.setAttribute("data-original-placeholder", prevPlaceholder);
    }
    input.placeholder = "Đang trong thời gian 30s chuẩn bị ý...";
  }

  let remaining = 30;
  window._thinkTimeInterval = setInterval(() => {
    remaining--;
    const statusText = document.getElementById("chat-status-text");
    if (statusText) statusText.innerText = `Thời gian chuẩn bị: còn ${remaining}s...`;

    if (remaining <= 0) {
      clearThinkTimeCountdown();
      if (interviewPhase === "COMPLETED" || isInterviewPaused) return;
      setInterviewUIState("listening", "Mời bạn trình bày câu trả lời.");
      if (input) {
        input.placeholder = input.getAttribute("data-original-placeholder") || prevPlaceholder;
        input.focus();
      }
    }
  }, 1000);
}
window.requestThinkTime = requestThinkTime;

// ==========================================
// ESCAPE HTML HELPER
// ==========================================

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

// ==========================================
// INIT INTERVIEW PRACTICE (CONTROLLER ENTRY POINT)
// ==========================================

async function initInterviewPractice() {
  debugInterview("INIT", "Starting interview practice initialization...");

  // RULE 2: If interview session is already active in memory, NEVER re-init or reset
  if (window._isInterviewSessionStarted) {
    debugInterview("INIT", "Interview session is already started and active. Skipping re-init.");
    return;
  }

  if (window._interviewPracticeInitialized) {
    debugInterview("INIT", "Already initialized. Skipping.");
    return;
  }
  window._interviewPracticeInitialized = true;

  const configStr = sessionStorage.getItem("interview_init_data");
  if (!configStr) {
    debugInterview("INIT", "No config in sessionStorage, redirecting to interview-info.html");
    window.location.href = "interview-info.html";
    return;
  }

  let config;
  try {
    config = JSON.parse(configStr);
  } catch (e) {
    window.location.href = "interview-info.html";
    return;
  }

  const jobTitle = config.jobTitle || "";
  const companyName = config.companyName || "";
  const interviewRound = config.interviewRound || "round2";
  const jdText = config.jdText || "";
  const userDescription = config.userDescription || "";
  const interviewLanguage = config.interviewLanguage || "vi-VN";
  const enableCamera = Boolean(config.enableCamera);
  const enableHandsFree = Boolean(config.enableHandsFree);

  isHandsFreeMode = enableHandsFree;
  if (config.ttsVoice && typeof window.setTtsVoiceConfig === "function") {
    window.setTtsVoiceConfig(config.ttsVoice);
  }

  // Sync Topbar Title
  const topbarTitle = document.getElementById("topbar-job-title");
  if (topbarTitle) {
    topbarTitle.innerText = companyName ? `${jobTitle} — ${companyName}` : jobTitle;
  }

  // Avatar Init
  if (typeof pmAvatarInit === "function") {
    pmAvatarInit("ai-avatar-visual");
  }

  // Update candidate profile
  updateCandidateAvatarAndName();

  // Camera & Mic Device Preflight (WI-INTERVIEW-PREFLIGHT-01)
  // Automatically initiate camera & microphone preview check upon room entry
  requestCameraAccess();
  startMicPreflightTest();

  // Initialize Speech
  initSpeech();

  // Reset core states for session creation
  window._isInterviewSessionStarted = false;
  isProcessingAnswer = false;
  isInterviewPaused = false;
  interviewPhase = "INTRODUCTION";
  currentQuestionIndex = 0;
  interviewQuestions = [];
  interviewQuestionsMeta = [];
  userResponses = [];
  window._interviewHistory = [];
  window._topicsAsked = [];

  currentInterviewSession = {
    id: null,
    backendSessionId: null,
    jobTitle: companyName ? `${jobTitle} (${companyName})` : jobTitle,
    companyName,
    interviewRound,
    jdText,
    userDescription,
    selectedIndustry: config.selectedIndustry || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("prepmate_selected_industry") : "") || "",
    interviewerPersona: config.interviewerPersona || "professional",
    interviewLanguage,
    date: new Date(),
    startTime: new Date(),
    status: "starting",
    phase: "INTRODUCTION",
    introduction: null,
    currentQuestion: null,
    score: null,
    scores: null,
    criteria: null,
    knowledgeAnalysis: [],
    analysis: null,
  };

  // Check existing session in storage for Resume
  let isResuming = false;
  let data = null;
  let paramSessionId = null;
  try {
    if (typeof URLSearchParams !== "undefined" && typeof window !== "undefined" && window.location && window.location.search) {
      paramSessionId = new URLSearchParams(window.location.search).get("sessionId");
    }
  } catch (e) {}
  const savedSessionId = sessionStorage.getItem(INTERVIEW_SESSION_STORAGE_KEY) || paramSessionId;

  if (savedSessionId) {
    debugInterview("INIT", "Found savedSessionId in storage:", savedSessionId);
    try {
      const session = await InterviewApiClient.getSession(savedSessionId);
      const sessionStatus = session?.status || session?.Status;
      if (session && sessionStatus === "in_progress") {
        data = {
          sessionId: session.Id || session.id,
          status: session.Status || session.status,
          interviewPhase: session.InterviewState?.InterviewPhase || session.interviewState?.interviewPhase || "INTRODUCTION",
          session,
        };
        isResuming = true;
        debugInterview("INIT", "Successfully loaded existing backend session for resume:", data.sessionId);
      } else {
        sessionStorage.removeItem(INTERVIEW_SESSION_STORAGE_KEY);
      }
    } catch (e) {
      console.warn("[INIT] Failed to fetch existing session:", e);
      sessionStorage.removeItem(INTERVIEW_SESSION_STORAGE_KEY);
    }
  }

  const backendSessionId = data ? (data.sessionId || data.id || data.Id) : null;

  // If resuming an existing session:
  if (data && backendSessionId) {
    currentInterviewSession.id = backendSessionId;
    currentInterviewSession.backendSessionId = backendSessionId;
    currentInterviewSession.status = data.status || "in_progress";
    currentInterviewSession.phase = data.interviewPhase || "INTRODUCTION";
    sessionStorage.setItem(INTERVIEW_SESSION_STORAGE_KEY, backendSessionId);
    upsertActiveSessionToUserStorage(currentInterviewSession);
  } else {
    // WI-INTERVIEW-PREFLIGHT-01: Session creation deferred until Start confirmation.
    isResuming = false;
  }

  // Restore or Initialize UI
  const sessionStartedKey = backendSessionId ? ("prepmate_interview_started_" + backendSessionId) : null;
  const wasAlreadyStarted = sessionStartedKey ? (sessionStorage.getItem(sessionStartedKey) === "true") : false;

  if (isResuming && data.session) {
    restoreInterviewSession(data.session);
    restoreInterviewChatHistory(data.session);

    if (wasAlreadyStarted && data.status === "in_progress") {
      debugInterview("INIT", "Session was previously started and in_progress. Resuming continuously without re-prompting Start.");
      window._isInterviewSessionStarted = true;
      startInterviewTimer();
      setInterviewUIState("listening", "Mời bạn tiếp tục trình bày câu trả lời.");
    } else {
      // RULE 4 & 15: If not yet started, wait for user to click Start
      window._isInterviewSessionStarted = false;
      setInterviewUIState("not_started", "Phiên phỏng vấn đã được khôi phục. Nhấn Bắt đầu để tiếp tục.");
      const inputEl = document.getElementById("user-input");
      if (inputEl) {
        inputEl.placeholder = "Nhấn Bắt đầu để tiếp tục...";
      }
    }
  } else {
    // New interview: clear chat, render welcome message, wait for start
    renderNewInterviewWelcomeMessage();
    window._isInterviewSessionStarted = false;
    setInterviewUIState("not_started", "Kiểm tra thiết bị (Camera & Micro) • Nhấn Bắt đầu khi sẵn sàng");
  }


  // 2-Way Voice <-> Text Sync: sync manual typing so subsequent speech recognition doesn't overwrite
  const responseInput = document.getElementById("user-input");
  if (responseInput && !responseInput._hasSyncListener) {
    responseInput._hasSyncListener = true;
    responseInput.addEventListener("input", () => {
      if (!isListening) {
        if (typeof setSpeechFinalTranscript === "function") {
          setSpeechFinalTranscript(responseInput.value);
        } else {
          window._speechFinalTranscript = responseInput.value;
        }
        if (typeof setSpeechInterimTranscript === "function") {
          setSpeechInterimTranscript("");
        } else {
          window._speechInterimTranscript = "";
        }
      }
    });
  }

  // Global UX & Resilience Listeners (Network, Exit Confirmation, Keyboard Shortcuts)
  if (typeof window !== "undefined" && !window._prepmateUXListenersBound) {
    window._prepmateUXListenersBound = true;

    // Network resilience
    window.addEventListener("offline", () => {
      if (typeof showToast === "function") {
        showToast("Mất kết nối mạng. Bạn vẫn có thể tiếp tục soạn câu trả lời trong khi chờ kết nối lại.", "warning");
      }
    });
    window.addEventListener("online", () => {
      if (typeof showToast === "function") {
        showToast("Đã khôi phục kết nối mạng.", "success");
      }
    });

    // Prevent accidental navigation during active interview
    window.addEventListener("beforeunload", (e) => {
      if (window._isInterviewSessionStarted && interviewPhase !== "COMPLETED") {
        e.preventDefault();
        e.returnValue = "Buổi phỏng vấn đang diễn ra. Bạn có chắc muốn rời khỏi phòng?";
        return e.returnValue;
      }
    });

    // Resource lifecycle cleanup on unload / pagehide (Mic, Cam, TTS, Timers)
    function cleanupAllInterviewResources(reason = "page_unload") {
      stopCamera();
      if (typeof stopMicPreflightTest === "function") {
        stopMicPreflightTest();
      }
      if (window.PrepMateAudioRecorder && typeof window.PrepMateAudioRecorder.closeAllAudioTracks === "function") {
        window.PrepMateAudioRecorder.closeAllAudioTracks();
      }
      cancelCurrentSpeech(reason);
      stopInterviewTimer();
      stopQuestionCountdown();
      if (typeof clearThinkTimeCountdown === "function") {
        clearThinkTimeCountdown();
      }
      stopSpeechRecognitionSilently();
    }
    window.cleanupAllInterviewResources = cleanupAllInterviewResources;

    window.addEventListener("pagehide", () => {
      cleanupAllInterviewResources("pagehide");
    });
    window.addEventListener("unload", () => {
      cleanupAllInterviewResources("unload");
    });

    // Keyboard Shortcuts (Space for Mic when not focused in input, Escape for modal/drawer dismiss)
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          const drawer = document.getElementById("ir-transcript-drawer");
          if (drawer && drawer.classList.contains("open")) {
            toggleTranscriptDrawer();
            return;
          }
          const startModal = document.getElementById("zoom-start-confirm-modal");
          if (startModal && startModal.style.display !== "none" && !startModal.classList.contains("hidden")) {
            closeStartConfirmModal();
            return;
          }
          if (isInterviewPaused) {
            pauseInterview();
            return;
          }
        }

        // Space to toggle mic when outside input/textarea
        if (e.key === " " && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) {
          if (window._isInterviewSessionStarted && !isInterviewPaused && !isProcessingAnswer) {
            e.preventDefault();
            toggleMic();
          }
        }
      });
    }
  }
}
// Global debug & inspection accessors on window
window.debugInterview = debugInterview;
window.getInterviewPhase = () => interviewPhase;
window.getCurrentQuestionIndex = () => currentQuestionIndex;
window.getInterviewQuestions = () => interviewQuestions;
window.getUserResponses = () => userResponses;
window.isProcessingAnswer = () => isProcessingAnswer;
window.setIsProcessingAnswer = (val) => {
  isProcessingAnswer = Boolean(val);
};
window.isInterviewPaused = () => isInterviewPaused;
window.setIsInterviewPaused = (val) => {
  isInterviewPaused = Boolean(val);
};
window.getCurrentInterviewSession = () => currentInterviewSession;
window.setInterviewPhase = (phase) => {
  interviewPhase = phase;
  if (currentInterviewSession) {
    currentInterviewSession.phase = phase;
  }
};
window.clearInterviewPause = () => {
  isInterviewPaused = false;
  const overlay = document.getElementById("ir-pause-overlay");
  if (overlay) overlay.remove();
};
window.setInterviewUIState = setInterviewUIState;
window.getInterviewUIState = () => currentInterviewUIState;

window.initInterviewPractice = initInterviewPractice;

// Auto-initialize when on interview-practice.html
if (typeof window !== "undefined" && window.location.pathname.endsWith("interview-practice.html")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initInterviewPractice();
    });
  } else {
    initInterviewPractice();
  }
}


// ==========================================
// IN-ROOM DEVICE SELECTION & POPOVER (WI-COACH-04A)
// ==========================================

async function toggleDeviceSettingsPopover(explicitShow = null) {
  const popover = document.getElementById("device-settings-popover");
  const gearBtn = document.getElementById("btn-device-settings");
  if (!popover) return;

  const isVisible = popover.style.display !== "none";
  const shouldShow = explicitShow !== null ? Boolean(explicitShow) : !isVisible;

  popover.style.display = shouldShow ? "block" : "none";
  if (gearBtn) {
    gearBtn.setAttribute("aria-expanded", shouldShow ? "true" : "false");
  }

  if (shouldShow) {
    await populatePracticeDeviceSelectors();
  }
}
window.toggleDeviceSettingsPopover = toggleDeviceSettingsPopover;

async function populatePracticeDeviceSelectors() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioSelect = document.getElementById("practice-audio-device-select");
    const videoSelect = document.getElementById("practice-video-device-select");

    const savedAudio = (typeof PrepMateAudioRecorder !== "undefined" && PrepMateAudioRecorder.getSelectedAudioDevice)
      ? PrepMateAudioRecorder.getSelectedAudioDevice()
      : (localStorage.getItem("prepmate_selected_audio_device") || "");

    const savedVideo = (typeof PrepMateAudioRecorder !== "undefined" && PrepMateAudioRecorder.getSelectedVideoDevice)
      ? PrepMateAudioRecorder.getSelectedVideoDevice()
      : (localStorage.getItem("prepmate_selected_video_device") || "");

    if (audioSelect) {
      audioSelect.innerHTML = '<option value="">Mặc định hệ thống</option>';
      devices.filter(d => d.kind === "audioinput").forEach((d, idx) => {
        const opt = document.createElement("option");
        opt.value = d.deviceId;
        opt.textContent = d.label || ("Microphone " + (idx + 1));
        if (savedAudio && d.deviceId === savedAudio) opt.selected = true;
        audioSelect.appendChild(opt);
      });
    }

    if (videoSelect) {
      videoSelect.innerHTML = '<option value="">Mặc định hệ thống</option>';
      devices.filter(d => d.kind === "videoinput").forEach((d, idx) => {
        const opt = document.createElement("option");
        opt.value = d.deviceId;
        opt.textContent = d.label || ("Camera " + (idx + 1));
        if (savedVideo && d.deviceId === savedVideo) opt.selected = true;
        videoSelect.appendChild(opt);
      });
    }
  } catch (e) {
    console.warn("[DEVICE SELECT] Error populating devices:", e);
  }
}
window.populatePracticeDeviceSelectors = populatePracticeDeviceSelectors;

function onPracticeAudioDeviceChange(deviceId) {
  if (typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.setSelectedAudioDevice === "function") {
    PrepMateAudioRecorder.setSelectedAudioDevice(deviceId);
  } else {
    if (deviceId) localStorage.setItem("prepmate_selected_audio_device", deviceId);
    else localStorage.removeItem("prepmate_selected_audio_device");
  }
  if (typeof showToast === "function") {
    showToast("Đã cập nhật micro.", "info");
  }
}
window.onPracticeAudioDeviceChange = onPracticeAudioDeviceChange;

function onPracticeVideoDeviceChange(deviceId) {
  if (typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.setSelectedVideoDevice === "function") {
    PrepMateAudioRecorder.setSelectedVideoDevice(deviceId);
  } else {
    if (deviceId) localStorage.setItem("prepmate_selected_video_device", deviceId);
    else localStorage.removeItem("prepmate_selected_video_device");
  }
  if (typeof switchCameraDevice === "function") {
    switchCameraDevice(deviceId);
  }
  if (typeof showToast === "function") {
    showToast("Đã cập nhật Camera.", "info");
  }
}
window.onPracticeVideoDeviceChange = onPracticeVideoDeviceChange;
