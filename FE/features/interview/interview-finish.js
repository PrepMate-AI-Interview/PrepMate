/**
 * PREPMATE — INTERVIEW FINISH & REPORT SUBSYSTEM
 * Handles interview termination orchestration, confirmation dialog invocation,
 * un-evaluated session handling, AI debrief report synthesis, completed session persistence,
 * and completion modal rendering.
 *
 * Extracted from interview.js under Phase 1 / WI 1.19-B.
 * Strictly behavior-preserving refactor.
 */

(function () {
  "use strict";

  let isEndingInterview = false;

  function debugFinish(category, ...args) {
    if (typeof debugInterview === "function") {
      debugInterview(category, ...args);
    } else if (typeof window !== "undefined" && typeof window.debugInterview === "function") {
      window.debugInterview(category, ...args);
    } else {
      console.log(`[${category}]`, ...args);
    }
  }

  function getInterviewPhaseDefensive() {
    if (typeof window !== "undefined" && typeof window.getInterviewPhase === "function") {
      return window.getInterviewPhase();
    }
    if (typeof interviewPhase !== "undefined") {
      return interviewPhase;
    }
    return "";
  }

  function getUserResponsesDefensive() {
    if (typeof window !== "undefined" && typeof window.getUserResponses === "function") {
      return window.getUserResponses();
    }
    if (typeof userResponses !== "undefined" && Array.isArray(userResponses)) {
      return userResponses;
    }
    return [];
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

  function getCurrentInterviewSessionDefensive() {
    if (typeof window !== "undefined" && typeof window.getCurrentInterviewSession === "function") {
      return window.getCurrentInterviewSession();
    }
    if (typeof currentInterviewSession !== "undefined") {
      return currentInterviewSession;
    }
    return null;
  }

  function getSessionStorageKeyDefensive() {
    if (typeof INTERVIEW_SESSION_STORAGE_KEY !== "undefined") {
      return INTERVIEW_SESSION_STORAGE_KEY;
    }
    if (typeof window !== "undefined" && typeof window.INTERVIEW_SESSION_STORAGE_KEY !== "undefined") {
      return window.INTERVIEW_SESSION_STORAGE_KEY;
    }
    return "prepmate_backend_session_id";
  }

  function setInterviewPhaseDefensive(phase) {
    if (typeof window !== "undefined" && typeof window.setInterviewPhase === "function") {
      window.setInterviewPhase(phase);
    } else {
      if (typeof interviewPhase !== "undefined") {
        interviewPhase = phase;
      }
      const sess = getCurrentInterviewSessionDefensive();
      if (sess) {
        sess.phase = phase;
      }
    }
  }

  function clearInterviewPauseDefensive() {
    if (typeof window !== "undefined" && typeof window.clearInterviewPause === "function") {
      window.clearInterviewPause();
    } else {
      if (typeof isInterviewPaused !== "undefined") {
        isInterviewPaused = false;
      }
      const overlay = document.getElementById("ir-pause-overlay");
      if (overlay) overlay.remove();
    }
    const videoGrid = document.getElementById("ir-video-grid");
    if (videoGrid) videoGrid.classList.remove("is-paused");
  }

  function triggerSetInterviewUIState(state, detail) {
    if (typeof setInterviewUIState === "function") {
      setInterviewUIState(state, detail);
    } else if (typeof window !== "undefined" && typeof window.setInterviewUIState === "function") {
      window.setInterviewUIState(state, detail);
    }
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

  // ==========================================
  // END INTERVIEW & DEBRIEF REPORT GENERATION
  // ==========================================

  async function endInterview(confirmBefore = true) {
    const currentPhase = getInterviewPhaseDefensive();
    if (isEndingInterview || currentPhase === "COMPLETED") return;

    const userResponsesList = getUserResponsesDefensive();
    const interviewQuestionsList = getInterviewQuestionsDefensive();
    const currentSession = getCurrentInterviewSessionDefensive();

    const validResponses = userResponsesList.filter((r) => r.answer && r.answer.trim());

    if (confirmBefore) {
      const showDialogFn = typeof showZoomEndConfirmDialog === "function"
        ? showZoomEndConfirmDialog
        : (typeof window !== "undefined" && typeof window.showZoomEndConfirmDialog === "function" ? window.showZoomEndConfirmDialog : null);

      if (typeof showDialogFn === "function") {
        const confirmed = await showDialogFn(validResponses.length, interviewQuestionsList.length);
        if (!confirmed) return;
      }
    }

    isEndingInterview = true;
    const priorPhase = currentPhase || "ADAPTIVE_INTERVIEW";
    setInterviewPhaseDefensive("COMPLETED");

    // Clear pause state
    clearInterviewPauseDefensive();

    // Clear think time
    if (typeof clearThinkTimeCountdown === "function") {
      clearThinkTimeCountdown();
    } else if (typeof window !== "undefined" && typeof window.clearThinkTimeCountdown === "function") {
      window.clearThinkTimeCountdown();
    }

    // Stop timers & audio & camera
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

    if (typeof cancelCurrentSpeech === "function") {
      cancelCurrentSpeech("interview_completed");
    } else if (typeof window !== "undefined" && typeof window.cancelCurrentSpeech === "function") {
      window.cancelCurrentSpeech("interview_completed");
    }

    if (typeof stopSpeechRecognitionSilently === "function") {
      stopSpeechRecognitionSilently();
    } else if (typeof window !== "undefined" && typeof window.stopSpeechRecognitionSilently === "function") {
      window.stopSpeechRecognitionSilently();
    }

    if (typeof stopCamera === "function") {
      stopCamera();
    } else if (typeof window !== "undefined" && typeof window.stopCamera === "function") {
      window.stopCamera();
    }

    if (typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.closeAllAudioTracks === "function") {
      PrepMateAudioRecorder.closeAllAudioTracks();
    }

    triggerSetInterviewUIState("completed");

    const modal = document.getElementById("finish-modal");
    if (modal) modal.classList.remove("hidden");

    const scoreEl = document.getElementById("finish-score-value");
    if (scoreEl) scoreEl.innerText = "...";

    const finishMessage = document.getElementById("finish-message");
    if (finishMessage) {
      finishMessage.innerText = "AI đang phân tích và tổng hợp báo cáo đánh giá chuyên sâu...";
    }

    const finishSummary = document.getElementById("finish-summary");
    if (finishSummary) {
      finishSummary.innerHTML = `
        <div style="text-align:center;padding:24px;color:#94a3b8;">
          <span class="loading-dots">Đang tính toán điểm năng lực STAR và tổng hợp nhận xét...</span>
        </div>
      `;
    }

    const sess = getCurrentInterviewSessionDefensive();
    const sessionId = sess?.backendSessionId || sess?.id || "guest-session";
    const jobTitle = sess?.jobTitle || "Chuyên viên chuyên môn";

    try {
      debugFinish("INTERVIEW API", "Requesting end-interview report for sessionId:", sessionId);

      const client = typeof InterviewApiClient !== "undefined"
        ? InterviewApiClient
        : (typeof window !== "undefined" ? window.InterviewApiClient : null);

      if (!client || typeof client.endInterview !== "function") {
        throw new Error("InterviewApiClient.endInterview is not available.");
      }

      const data = await client.endInterview(
        sessionId,
        jobTitle,
        sess?.interviewLanguage || "vi",
        userResponsesList
      );

      const report = data.report || data;
      applyReportToSessionAndShow(report, validResponses);
    } catch (error) {
      console.error("[INTERVIEW] Backend report failed:", error);
      // RESTORE INTERVIEW LIFECYCLE CONSISTENCY (WI-02B3)
      isEndingInterview = false;
      setInterviewPhaseDefensive(priorPhase);

      const isHttp400 = Boolean(error && (error.status === 400 || (error.data && error.data.status === 400)));
      const isNetworkError = Boolean(error && (error.name === "TypeError" || (!error.status && error.message && error.message.toLowerCase().includes("fetch"))));

      if (isHttp400) {
        // HTTP 400: Backend rejected completion because insufficient answers.
        // Maintain session status as in_progress, preserve sessionStorage, do NOT save fake completed session.
        applyUnEvaluatedSessionAndShow(error.message || "Phiên phỏng vấn chưa có đủ dữ liệu câu trả lời để tạo báo cáo đánh giá.");
      } else if (isNetworkError) {
        // Network connection error
        handleEndInterviewFailure(
          modal,
          priorPhase,
          "Lỗi kết nối mạng: Không thể gửi yêu cầu kết thúc phỏng vấn. Phiên phỏng vấn vẫn được bảo lưu, bạn có thể tiếp tục hoặc thử lại.",
          "warning"
        );
      } else {
        // Server or other HTTP error (500, 502, 503, etc.)
        handleEndInterviewFailure(
          modal,
          priorPhase,
          error.message || `Lỗi máy chủ (${error.status || "unknown"}): Chưa thể tạo báo cáo. Phiên phỏng vấn vẫn được bảo lưu.`,
          "danger"
        );
      }
    }
  }

  function handleEndInterviewFailure(modal, priorPhase, message, toastType = "danger") {
    if (modal) modal.classList.add("hidden");

    const roomEl = document.getElementById("interview-room");
    if (roomEl) {
      roomEl.style.filter = "";
      roomEl.style.pointerEvents = "";
    }

    setInterviewPhaseDefensive(priorPhase || "ADAPTIVE_INTERVIEW");
    triggerSetInterviewUIState("listening", "Mời bạn tiếp tục buổi phỏng vấn.");

    if (typeof startInterviewTimer === "function") {
      startInterviewTimer();
    } else if (typeof window !== "undefined" && typeof window.startInterviewTimer === "function") {
      window.startInterviewTimer();
    }

    const toastFn = typeof showToast === "function"
      ? showToast
      : (typeof window !== "undefined" && typeof window.showToast === "function" ? window.showToast : null);
    if (typeof toastFn === "function") {
      toastFn(message, toastType);
    } else {
      console.warn("[INTERVIEW]", message);
    }
  }

  function resumeInterviewFromFinishModal() {
    const modal = document.getElementById("finish-modal");
    if (modal) modal.classList.add("hidden");

    const roomEl = document.getElementById("interview-room");
    if (roomEl) {
      roomEl.style.filter = "";
      roomEl.style.pointerEvents = "";
    }

    isEndingInterview = false;
    const sess = getCurrentInterviewSessionDefensive();
    const phase = sess?.phase || getInterviewPhaseDefensive() || "ADAPTIVE_INTERVIEW";
    setInterviewPhaseDefensive(phase);

    triggerSetInterviewUIState("listening", "Mời bạn tiếp tục trả lời câu hỏi.");

    if (typeof startInterviewTimer === "function") {
      startInterviewTimer();
    } else if (typeof window !== "undefined" && typeof window.startInterviewTimer === "function") {
      window.startInterviewTimer();
    }
  }

  function applyUnEvaluatedSessionAndShow(reasonMessage) {
    const userResponsesList = getUserResponsesDefensive();
    const validResponses = (userResponsesList || []).filter(
      (r) => r && r.answer && r.answer.trim().length > 0
    );

    const currentInterviewSession = getCurrentInterviewSessionDefensive();
    if (currentInterviewSession) {
      currentInterviewSession.score = 0;
      currentInterviewSession.overallScore = 0;
      currentInterviewSession.isEvaluated = false;
      currentInterviewSession.unevaluatedReason = reasonMessage;
      currentInterviewSession.techScore = 0;
      currentInterviewSession.commScore = 0;
      currentInterviewSession.softScore = 0;
      currentInterviewSession.starScore = 0;
      currentInterviewSession.scores = { tech: 0, comm: 0, soft: 0, star: 0, overall: 0 };
      currentInterviewSession.criteria = {};
      currentInterviewSession.knowledgeAnalysis = [];
      currentInterviewSession.analysis = {
        strengths: "Chưa đủ dữ liệu câu trả lời để phân tích điểm mạnh.",
        improvements: "Cần tham gia trả lời đầy đủ các câu hỏi tình huống của AI.",
        suggestion: "Bắt đầu một phiên phỏng vấn mới và trả lời các câu hỏi để AI phân tích năng lực."
      };

      const sessionStart = currentInterviewSession.startTime ? new Date(currentInterviewSession.startTime) : new Date();
      currentInterviewSession.date = currentInterviewSession.date || sessionStart.toISOString();
      currentInterviewSession.duration = Math.max(1, Math.round((Date.now() - sessionStart.getTime()) / 60000));
      currentInterviewSession.questionsAnswered = validResponses.length;

      // WI-02B3: Maintain session status as in_progress when backend rejects completion!
      currentInterviewSession.status = "in_progress";
      currentInterviewSession.userResponses = userResponsesList;
    }

    // WI-02B3: DO NOT remove sessionStorage keys!
    // Preservation of recovery keys ensures candidate can reload and resume seamlessly.
    // (sessionStorage remains intact)
    // window._isInterviewSessionStarted remains true if it was already started.

    // WI-02B3: DO NOT save fake completed session to localStorage.interview_sessions!
    // saveCompletedInterviewSession() is omitted because session is NOT completed.
    try {
      const getSessId = (s) => String(s?.id || s?.backendSessionId || s?.sessionId || s?.Id || "").trim();
      const currentId = getSessId(currentInterviewSession);
      if (currentId && typeof localStorage !== "undefined") {
        let sessions = JSON.parse(localStorage.getItem("interview_sessions")) || [];
        if (Array.isArray(sessions)) {
          sessions = sessions.filter((s) => getSessId(s) !== currentId);
          localStorage.setItem("interview_sessions", JSON.stringify(sessions));
        }
      }
    } catch (e) {}

    showFinishModal();
  }

  function applyReportToSessionAndShow(report, validResponses) {
    const overallScoreVal = Number(report.overallScore ?? report.score ?? 0);
    const techScoreVal = Number(report.techScore ?? report.scores?.tech ?? 0);
    const commScoreVal = Number(report.commScore ?? report.scores?.comm ?? 0);
    const softScoreVal = Number(report.softScore ?? report.scores?.soft ?? 0);
    const starScoreVal = Number(report.starScore ?? report.scores?.star ?? 0);

    const userResponsesList = getUserResponsesDefensive();
    const currentInterviewSession = getCurrentInterviewSessionDefensive();

    if (currentInterviewSession) {
      currentInterviewSession.score = overallScoreVal;
      currentInterviewSession.overallScore = overallScoreVal;
      currentInterviewSession.techScore = techScoreVal;
      currentInterviewSession.commScore = commScoreVal;
      currentInterviewSession.softScore = softScoreVal;
      currentInterviewSession.starScore = starScoreVal;
      currentInterviewSession.isEvaluated = overallScoreVal > 0;

      if (overallScoreVal === 0) {
        const count = (validResponses && validResponses.length) || (userResponsesList && userResponsesList.length) || 0;
        currentInterviewSession.unevaluatedReason = count > 0
          ? `Hệ thống đã ghi nhận ${count} câu trả lời của bạn. Tuy nhiên, phiên phỏng vấn kết thúc sớm khi chưa hoàn thành đủ các nhóm câu hỏi chuyên môn và tình huống STAR để AI chấm điểm tin cậy.`
          : "Phiên phỏng vấn kết thúc mà chưa có đủ câu trả lời để AI phân tích năng lực.";
      }

      currentInterviewSession.scores = {
        tech: techScoreVal,
        comm: commScoreVal,
        soft: softScoreVal,
        star: starScoreVal,
        overall: overallScoreVal,
      };

      currentInterviewSession.criteria = report.criteria || {};
      currentInterviewSession.knowledgeAnalysis = report.knowledgeAnalysis || [];
      currentInterviewSession.analysis = {
        strengths: report.strengths || report.analysis?.strengths || "Đã hoàn thành phiên phỏng vấn và phản hồi các câu hỏi phỏng vấn.",
        improvements: report.improvements || report.analysis?.improvements || "Cần bổ sung thêm các số liệu định lượng (KPI, metrics) cụ thể trong câu trả lời.",
        suggestion: report.suggestion || report.analysis?.suggestion || "Luyện tập theo mô hình STAR (Situation, Task, Action, Result) cho từng dự án.",
      };

      currentInterviewSession.rawReport = report;
      if (report.evidenceReport || report.EvidenceReport) {
        currentInterviewSession.evidenceReport = report.evidenceReport || report.EvidenceReport;
      }
      if (typeof getSessionVisualReport === "function") {
        try {
          currentInterviewSession.visualReport = getSessionVisualReport();
        } catch (e) {}
      }

      const sessionStart = currentInterviewSession.startTime ? new Date(currentInterviewSession.startTime) : new Date();
      currentInterviewSession.date = currentInterviewSession.date || sessionStart.toISOString();
      currentInterviewSession.duration = Math.max(1, Math.round((Date.now() - sessionStart.getTime()) / 60000));
      currentInterviewSession.questionsAnswered = validResponses.length;
      currentInterviewSession.status = "completed";
      currentInterviewSession.userResponses = userResponsesList;
    }

    // Clear session storage so next session starts fresh (RULE 17)
    const storageKey = getSessionStorageKeyDefensive();
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(storageKey);
      const finishSessId = currentInterviewSession?.backendSessionId || currentInterviewSession?.id;
      if (finishSessId) {
        sessionStorage.removeItem("prepmate_interview_started_" + finishSessId);
      }
    }
    if (typeof window !== "undefined") {
      window._isInterviewSessionStarted = false;
    }

    if (typeof PrepMateAnalytics !== "undefined" && typeof PrepMateAnalytics.trackInterviewCompleted === "function") {
      try {
        PrepMateAnalytics.trackInterviewCompleted(
          currentInterviewSession?.backendSessionId || currentInterviewSession?.id,
          overallScoreVal
        );
      } catch (e) {}
    }

    saveCompletedInterviewSession();
    showFinishModal();
  }

  function saveCompletedInterviewSession() {
    try {
      const currentInterviewSession = getCurrentInterviewSessionDefensive();
      if (!currentInterviewSession) return;

      const getSessId = (s) => String(s?.id || s?.backendSessionId || s?.sessionId || s?.Id || "").trim();
      const currentId = getSessId(currentInterviewSession);

      const currentUser = typeof getCurrentUser === "function"
        ? getCurrentUser()
        : (typeof window !== "undefined" && typeof window.getCurrentUser === "function" ? window.getCurrentUser() : null);

      const getUserSessionsFn = typeof getUserSessions === "function"
        ? getUserSessions
        : (typeof window !== "undefined" && typeof window.getUserSessions === "function" ? window.getUserSessions : null);

      const saveUserSessionsFn = typeof saveUserSessions === "function"
        ? saveUserSessions
        : (typeof window !== "undefined" && typeof window.saveUserSessions === "function" ? window.saveUserSessions : null);

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

      // Upsert: deduplicate by canonical session ID
      let replaced = false;
      if (currentId) {
        for (let i = 0; i < sessions.length; i++) {
          if (getSessId(sessions[i]) === currentId) {
            sessions[i] = { ...sessions[i], ...currentInterviewSession, status: "completed" };
            replaced = true;
            break;
          }
        }
      }

      if (!replaced) {
        sessions.unshift({ ...currentInterviewSession, status: "completed" });
      }

      if (currentUser && typeof saveUserSessionsFn === "function") {
        saveUserSessionsFn(sessions);
      } else {
        localStorage.setItem("interview_sessions", JSON.stringify(sessions));
      }

      if (typeof window !== "undefined" && typeof window.syncUserInterviewSessions === "function") {
        window.syncUserInterviewSessions().catch(err => {
          console.warn("[INTERVIEW] Background session sync after completion:", err);
        });
      }
    } catch (error) {
      console.warn("[INTERVIEW] Cannot persist completed session locally:", error);
    }
  }

  function showFinishModal() {
    const roomEl = document.getElementById("interview-room");
    if (roomEl) {
      roomEl.style.filter = "blur(4px)";
      roomEl.style.pointerEvents = "none";
    }

    const modal = document.getElementById("finish-modal");
    if (modal) modal.classList.remove("hidden");

    const currentInterviewSession = getCurrentInterviewSessionDefensive();
    const isEvaluated = currentInterviewSession?.isEvaluated !== false && (currentInterviewSession?.score != null && currentInterviewSession?.score > 0);
    const overallScore = Math.round(Number(currentInterviewSession?.score || 0));

    const deepReportBtn = document.getElementById("btn-view-deep-report");
    if (deepReportBtn) {
      if (!isEvaluated) {
        deepReportBtn.style.display = "none";
      } else {
        deepReportBtn.style.display = "flex";
        const sessId = currentInterviewSession?.backendSessionId || currentInterviewSession?.id;
        if (sessId) {
          deepReportBtn.href = `../report/report.html?sessionId=${encodeURIComponent(sessId)}`;
        } else {
          deepReportBtn.href = "../report/report.html";
        }
      }
    }

    // Provide Resume button if session is unevaluated
    let resumeBtn = document.getElementById("btn-resume-interview");
    if (!isEvaluated) {
      if (!resumeBtn && typeof document !== "undefined") {
        resumeBtn = document.createElement("button");
        resumeBtn.id = "btn-resume-interview";
        resumeBtn.type = "button";
        resumeBtn.className = "btn btn-primary";
        resumeBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>Tiếp tục phỏng vấn</span>
        `;
        resumeBtn.onclick = resumeInterviewFromFinishModal;
        const modalActions = document.querySelector("#finish-modal .modal-actions");
        if (modalActions) {
          modalActions.insertBefore(resumeBtn, modalActions.firstChild);
        }
      } else if (resumeBtn) {
        resumeBtn.style.display = "flex";
      }
    } else if (resumeBtn) {
      resumeBtn.style.display = "none";
    }

    const scoreValEl = document.getElementById("finish-score-value");
    if (scoreValEl) {
      scoreValEl.innerText = isEvaluated ? overallScore : "—";
    }

    const verdictEl = document.getElementById("finish-score-verdict");
    if (verdictEl) {
      if (!isEvaluated) {
        verdictEl.className = "finish-verdict-pill verdict-average";
        verdictEl.innerText = "ℹ️ Chưa hoàn tất đánh giá";
      } else {
        let vClass = "verdict-good";
        let vText = "👍 Đạt chuẩn — Nền tảng vững vàng";
        if (overallScore >= 80) {
          vClass = "verdict-excellent";
          vText = "⭐ Xuất sắc — Sẵn sàng tuyển dụng";
        } else if (overallScore >= 70) {
          vClass = "verdict-good";
          vText = "👍 Đạt chuẩn — Tiềm năng phát triển cao";
        } else if (overallScore >= 60) {
          vClass = "verdict-average";
          vText = "💡 Tiềm năng — Cần rèn luyện cấu trúc STAR";
        } else {
          vClass = "verdict-low";
          vText = "⚠️ Cần chuẩn bị thêm kiến thức chuyên sâu";
        }
        verdictEl.className = `finish-verdict-pill ${vClass}`;
        verdictEl.innerText = vText;
      }
    }

    const finishMsgEl = document.getElementById("finish-message");
    if (finishMsgEl) {
      if (!isEvaluated) {
        finishMsgEl.innerText = currentInterviewSession?.unevaluatedReason || "Phiên phỏng vấn kết thúc mà chưa có đủ câu trả lời để AI phân tích năng lực.";
      } else {
        finishMsgEl.innerText =
          overallScore >= 75
            ? "Bạn thể hiện phong thái tự tin, khả năng phân tích sắc bén và lập luận thuyết phục trong buổi phỏng vấn."
            : "Buổi phỏng vấn cho thấy bạn cần rèn luyện thêm về cấu trúc STAR và bổ sung thêm các số liệu thực tế.";
      }
    }

    const summary = document.getElementById("finish-summary");
    if (!summary) return;

    const scores = currentInterviewSession?.scores || {};
    const analysis = currentInterviewSession?.analysis || {};

    if (!isEvaluated) {
      summary.innerHTML = `
        <div class="debrief-report-container">
          <div class="analysis-item improvement">
            <h5>Lưu ý:</h5>
            <p>${escapeHtmlDefensive(currentInterviewSession?.unevaluatedReason || "Phiên phỏng vấn chưa ghi nhận câu trả lời để AI đánh giá.")}</p>
          </div>
        </div>
      `;
      return;
    }

    summary.innerHTML = `
      <div class="debrief-report-container">
        <div class="debrief-metrics-grid">
          <div class="debrief-metric-card">
            <span class="debrief-metric-score">${scores.tech ?? 0}%</span>
            <span class="debrief-metric-label">Chuyên môn</span>
          </div>
          <div class="debrief-metric-card">
            <span class="debrief-metric-score">${scores.comm ?? 0}%</span>
            <span class="debrief-metric-label">Giao tiếp</span>
          </div>
          <div class="debrief-metric-card">
            <span class="debrief-metric-score">${scores.soft ?? 0}%</span>
            <span class="debrief-metric-label">Kỹ năng mềm</span>
          </div>
          <div class="debrief-metric-card">
            <span class="debrief-metric-score">${scores.star ?? 0}%</span>
            <span class="debrief-metric-label">Chuẩn STAR</span>
          </div>
        </div>
        <div class="analysis-item strength">
          <h5>Điểm mạnh nổi bật:</h5>
          <p>${escapeHtmlDefensive(analysis.strengths || "Chủ động hoàn thành phiên phỏng vấn.")}</p>
        </div>
        <div class="analysis-item improvement">
          <h5>Điểm cần cải thiện:</h5>
          <p>${escapeHtmlDefensive(analysis.improvements || "Cần bổ sung thêm số liệu dự án cụ thể theo khung STAR.")}</p>
        </div>
      </div>
    `;
  }

  function closeFinishModal() {
    const modal = document.getElementById("finish-modal");
    if (modal) modal.classList.add("hidden");

    const currentInterviewSession = getCurrentInterviewSessionDefensive();
    // If the interview was NOT completed (still in_progress), closing modal should resume room
    if (currentInterviewSession && currentInterviewSession.status === "in_progress") {
      resumeInterviewFromFinishModal();
      return;
    }

    if (typeof window !== "undefined" && window.location) {
      window.location.href = "interview-info.html";
    }
  }

  // Export to global scope
  if (typeof window !== "undefined") {
    window.endInterview = endInterview;
    window.applyUnEvaluatedSessionAndShow = applyUnEvaluatedSessionAndShow;
    window.applyReportToSessionAndShow = applyReportToSessionAndShow;
    window.saveCompletedInterviewSession = saveCompletedInterviewSession;
    window.showFinishModal = showFinishModal;
    window.closeFinishModal = closeFinishModal;
    window.resumeInterviewFromFinishModal = resumeInterviewFromFinishModal;
  }
})();
