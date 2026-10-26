// ==========================================
// TIMERS: TOTAL & PER-QUESTION COUNTDOWN
// ==========================================

// Timer State
let _interviewTimerInterval = null;
let _interviewElapsedSeconds = 0;
let _questionCountdownInterval = null;
let _questionCountdownRemaining = 120;

function startInterviewTimer() {
  stopInterviewTimer();
  const timerEl = document.getElementById("interview-timer-display");

  _interviewTimerInterval = setInterval(() => {
    _interviewElapsedSeconds++;
    const mins = String(Math.floor(_interviewElapsedSeconds / 60)).padStart(2, "0");
    const secs = String(_interviewElapsedSeconds % 60).padStart(2, "0");
    if (timerEl) {
      timerEl.innerText = `${mins}:${secs}`;
    }
  }, 1000);
}

function stopInterviewTimer() {
  if (_interviewTimerInterval) {
    clearInterval(_interviewTimerInterval);
    _interviewTimerInterval = null;
  }
}

function startQuestionCountdown(duration = 120, onExpire = null) {
  stopQuestionCountdown();
  _questionCountdownRemaining = duration;
  updateQuestionCountdownUI();

  _questionCountdownInterval = setInterval(() => {
    _questionCountdownRemaining--;
    updateQuestionCountdownUI();

    if (_questionCountdownRemaining <= 0) {
      stopQuestionCountdown();
      const statusEl = document.getElementById("chat-status-text");
      if (statusEl) {
        statusEl.innerText = "Đã hết thời gian 2 phút trả lời.";
      }

      if (typeof onExpire === "function") {
        onExpire();
      } else {
        const inputEl = document.getElementById("user-input");
        const answer = inputEl?.value.trim() || "";
        if (answer) {
          sendMessage();
        } else {
          if (typeof showToast === "function") {
            showToast("Hết 2 phút trả lời. Hãy gửi câu trả lời của bạn!", "warning");
          }
          if (inputEl) {
            inputEl.disabled = false;
            inputEl.focus();
          }
        }
      }
    }
  }, 1000);
}

function stopQuestionCountdown() {
  if (_questionCountdownInterval) {
    clearInterval(_questionCountdownInterval);
    _questionCountdownInterval = null;
  }
  const countdownPill = document.getElementById("dialogue-answer-countdown");
  if (countdownPill) countdownPill.style.display = "none";
}

function updateQuestionCountdownUI() {
  const mins = String(Math.floor(_questionCountdownRemaining / 60)).padStart(2, "0");
  const secs = String(_questionCountdownRemaining % 60).padStart(2, "0");
  const timeStr = `${mins}:${secs}`;

  const countdownPill = document.getElementById("dialogue-answer-countdown");
  const countdownTime = document.getElementById("answer-countdown-time");
  if (countdownPill && countdownTime) {
    countdownPill.style.display = "inline-flex";
    countdownTime.textContent = timeStr;
    if (_questionCountdownRemaining <= 30) {
      countdownPill.classList.add("warning");
    } else {
      countdownPill.classList.remove("warning");
    }
  }

  const hint = document.getElementById("speech-status-text-hint");
  if (hint) {
    hint.textContent = `Thời gian trả lời: ${timeStr} • Bật Mic hoặc nhập nội dung`;
  }
}

function isQuestionCountdownRunning() {
  return _questionCountdownInterval !== null;
}

function getQuestionCountdownRemaining() {
  return _questionCountdownRemaining;
}

// Global exports for classic script interop & VM regression runner
window.startInterviewTimer = startInterviewTimer;
window.stopInterviewTimer = stopInterviewTimer;
window.startQuestionCountdown = startQuestionCountdown;
window.stopQuestionCountdown = stopQuestionCountdown;
window.updateQuestionCountdownUI = updateQuestionCountdownUI;
window.isQuestionCountdownRunning = isQuestionCountdownRunning;
window.getQuestionCountdownRemaining = getQuestionCountdownRemaining;
