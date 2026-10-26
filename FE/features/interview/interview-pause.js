/**
 * PREPMATE — INTERVIEW PAUSE & RESUME SUBSYSTEM
 * Handles pausing and resuming the interview session, stopping/starting timers,
 * canceling TTS, muting mic, updating UI state, and rendering/removing the pause overlay.
 *
 * Extracted from interview.js under Phase 1 / WI 1.20-B.
 * Strictly behavior-preserving refactor.
 */

(function () {
  "use strict";

  function isPausedDefensive() {
    if (typeof window !== "undefined" && typeof window.isInterviewPaused === "function") {
      return Boolean(window.isInterviewPaused());
    }
    if (typeof isInterviewPaused !== "undefined") {
      return Boolean(isInterviewPaused);
    }
    return false;
  }

  function setPausedDefensive(val) {
    if (typeof window !== "undefined" && typeof window.setIsInterviewPaused === "function") {
      window.setIsInterviewPaused(val);
    } else if (typeof isInterviewPaused !== "undefined") {
      isInterviewPaused = Boolean(val);
    }
  }

  function getQuestionCountdownRemainingDefensive() {
    if (typeof getQuestionCountdownRemaining === "function") {
      return getQuestionCountdownRemaining();
    }
    if (typeof window !== "undefined" && typeof window.getQuestionCountdownRemaining === "function") {
      return window.getQuestionCountdownRemaining();
    }
    if (typeof _questionCountdownRemaining !== "undefined") {
      return _questionCountdownRemaining;
    }
    return 0;
  }

  function escapeHtmlDefensive(str) {
    if (typeof escapeHtml === "function") {
      return escapeHtml(str);
    }
    if (typeof window !== "undefined" && typeof window.escapeHtml === "function") {
      return window.escapeHtml(str);
    }
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getCurrentQuestionIndexDefensive() {
    if (typeof window !== "undefined" && typeof window.getCurrentQuestionIndex === "function") {
      return window.getCurrentQuestionIndex();
    }
    if (typeof currentQuestionIndex !== "undefined") {
      return currentQuestionIndex;
    }
    return 0;
  }

  function getInterviewQuestionsDefensive() {
    if (typeof window !== "undefined" && typeof window.getInterviewQuestions === "function") {
      return window.getInterviewQuestions();
    }
    if (typeof interviewQuestions !== "undefined" && Array.isArray(interviewQuestions)) {
      return interviewQuestions;
    }
    return [];
  }

  function triggerSetInterviewUIState(state, detail) {
    if (typeof setInterviewUIState === "function") {
      setInterviewUIState(state, detail);
    } else if (typeof window !== "undefined" && typeof window.setInterviewUIState === "function") {
      window.setInterviewUIState(state, detail);
    }
  }

  function triggerShowToast(message, type) {
    if (typeof showToast === "function") {
      showToast(message, type);
    } else if (typeof window !== "undefined" && typeof window.showToast === "function") {
      window.showToast(message, type);
    }
  }

  // ==========================================
  // PAUSE / RESUME INTERVIEW (RULE 23)
  // ==========================================

  function pauseInterview() {
    if (typeof window !== "undefined" && !window._isInterviewSessionStarted) return;

    const stage = document.getElementById("interview-room");
    const videoGrid = document.getElementById("ir-video-grid");

    const currentlyPaused = isPausedDefensive();
    const nextPaused = !currentlyPaused;
    setPausedDefensive(nextPaused);

    if (nextPaused) {
      // 1. Pause Timers
      if (typeof stopInterviewTimer === "function") {
        stopInterviewTimer();
      } else if (typeof window !== "undefined" && typeof window.stopInterviewTimer === "function") {
        window.stopInterviewTimer();
      }

      if (typeof stopQuestionCountdown === "function") {
        stopQuestionCountdown();
      } else if (typeof window !== "undefined" && typeof window.stopQuestionCountdown === "function") {
        window.stopQuestionCountdown();
      }

      if (typeof clearThinkTimeCountdown === "function") {
        clearThinkTimeCountdown();
      } else if (typeof window !== "undefined" && typeof window.clearThinkTimeCountdown === "function") {
        window.clearThinkTimeCountdown();
      }

      // 2. Stop TTS Audio
      if (typeof cancelCurrentSpeech === "function") {
        cancelCurrentSpeech("interview_paused");
      } else if (typeof window !== "undefined" && typeof window.cancelCurrentSpeech === "function") {
        window.cancelCurrentSpeech("interview_paused");
      }

      // 3. Stop Mic quietly and pause audio recording (WI-COACH-AUDIO-01)
      if (typeof stopSpeechRecognitionSilently === "function") {
        stopSpeechRecognitionSilently();
      } else if (typeof window !== "undefined" && typeof window.stopSpeechRecognitionSilently === "function") {
        window.stopSpeechRecognitionSilently();
      }
      if (typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.pauseAudioRecording === "function") {
        PrepMateAudioRecorder.pauseAudioRecording();
      }

      // 3b. Pause camera in-turn sampling without turning off camera (WI-COACH-VIDEO-03R)
      if (typeof pauseInTurnSampling === "function") {
        pauseInTurnSampling();
      } else if (typeof window !== "undefined" && typeof window.pauseInTurnSampling === "function") {
        window.pauseInTurnSampling();
      }

      // 4. Update UI State to Paused
      triggerSetInterviewUIState("paused", "Buổi phỏng vấn đã tạm dừng.");

      // 5. Blur video stage
      if (videoGrid) videoGrid.classList.add("is-paused");

      // 6. Show Pause Overlay
      const timerDisplay = document.getElementById("interview-timer-display");
      const timerStr = timerDisplay ? timerDisplay.innerText : "00:00";
      const currentQNum = getCurrentQuestionIndexDefensive() + 1;
      const questionsList = getInterviewQuestionsDefensive();
      const totalQNum = Math.max(questionsList.length, 5);

      let overlay = document.getElementById("ir-pause-overlay");
      if (!overlay && stage) {
        overlay = document.createElement("div");
        overlay.id = "ir-pause-overlay";
        overlay.className = "ir-pause-overlay";
        overlay.innerHTML = `
          <div class="zoom-pause-dialog">
            <div class="zoom-pause-top-badge">
              <span class="zoom-pause-pulse-dot"></span>
              <span>CUỘC PHỎNG VẤN ĐANG TẠM DỪNG</span>
            </div>
            <div class="zoom-pause-icon-wrap">
              <div class="zoom-pause-icon">⏸</div>
            </div>
            <h3 class="zoom-pause-title">Phòng Phỏng Vấn Tạm Dừng</h3>
            <p class="zoom-pause-desc">
              Đồng hồ đếm ngược, micro và câu hỏi đã được tạm ngắt. Bạn có thể thư giãn vài phút, uống nước hoặc ghi chú lại các ý chính. Dữ liệu đối thoại được bảo lưu an toàn.
            </p>
            <div class="zoom-pause-stats-row">
              <div class="pause-stat-pill">
                <span class="stat-icon">⏱</span>
                <div class="stat-meta">
                  <span class="stat-label">Thời lượng</span>
                  <strong class="stat-val">${escapeHtmlDefensive(timerStr)}</strong>
                </div>
              </div>
              <div class="pause-stat-pill">
                <span class="stat-icon">📌</span>
                <div class="stat-meta">
                  <span class="stat-label">Tiến độ</span>
                  <strong class="stat-val">Câu ${currentQNum} / ${totalQNum}</strong>
                </div>
              </div>
              <div class="pause-stat-pill">
                <span class="stat-icon">🛡️</span>
                <div class="stat-meta">
                  <span class="stat-label">Bảo mật</span>
                  <strong class="stat-val">Đã lưu</strong>
                </div>
              </div>
            </div>
            <div class="zoom-pause-actions">
              <button type="button" onclick="pauseInterview()" class="btn-zoom-resume">
                ▶ Tiếp tục phỏng vấn ngay
              </button>
              <button type="button" onclick="endInterview(true)" class="btn-zoom-end-early">
                🔴 Kết thúc phỏng vấn sớm
              </button>
            </div>
          </div>
        `;
        stage.appendChild(overlay);
      } else if (overlay) {
        overlay.style.display = "flex";
      }

      triggerShowToast("Đã tạm dừng buổi phỏng vấn.", "warning");
    } else {
      // RESUME FROM PAUSE
      if (typeof startInterviewTimer === "function") {
        startInterviewTimer();
      } else if (typeof window !== "undefined" && typeof window.startInterviewTimer === "function") {
        window.startInterviewTimer();
      }

      const countdownRemaining = getQuestionCountdownRemainingDefensive();
      if (countdownRemaining > 0) {
        if (typeof startQuestionCountdown === "function") {
          startQuestionCountdown(countdownRemaining);
        } else if (typeof window !== "undefined" && typeof window.startQuestionCountdown === "function") {
          window.startQuestionCountdown(countdownRemaining);
        }
      }

      if (videoGrid) videoGrid.classList.remove("is-paused");

      const overlay = document.getElementById("ir-pause-overlay");
      if (overlay) overlay.remove();

      const pauseBtn = document.getElementById("btn-pause-interview");
      if (pauseBtn) {
        pauseBtn.innerHTML = "⏸ Tạm dừng";
        pauseBtn.classList.remove("btn-paused");
      }

      if (typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.resumeAudioRecording === "function") {
        PrepMateAudioRecorder.resumeAudioRecording();
      }

      // Resume camera in-turn sampling if camera is active and in valid turn (WI-COACH-VIDEO-03R)
      if (typeof resumeInTurnSampling === "function") {
        resumeInTurnSampling();
      } else if (typeof window !== "undefined" && typeof window.resumeInTurnSampling === "function") {
        window.resumeInTurnSampling();
      }
      triggerSetInterviewUIState("listening", "Đã tiếp tục buổi phỏng vấn.");
      triggerShowToast("Đã tiếp tục buổi phỏng vấn.", "success");
    }
  }

  // Export to global scope
  if (typeof window !== "undefined") {
    window.pauseInterview = pauseInterview;
    window.resumeInterview = pauseInterview;
  }
})();
