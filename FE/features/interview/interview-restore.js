// ==========================================
// PREPMATE — INTERVIEW SESSION RESTORE
// ARCHITECTURE: SESSION RESTORE & RECOVERY MODULE
// ==========================================

/**
 * Restores interview session state from backend data (RULE 4, 15, 16)
 */
function restoreInterviewSession(session) {
  if (!session) {
    console.warn("[INTERVIEW] No session data to restore.");
    return;
  }

  if (typeof debugInterview === "function") {
    debugInterview("SESSION", "Restoring session data from backend...");
  }

  const state = session.InterviewState || session.interviewState || {};
  const questions = session.Questions || session.questions || [];
  const answers = session.Answers || session.answers || [];
  const phase = state.InterviewPhase || state.interviewPhase || "INTRODUCTION";

  if (typeof interviewPhase !== "undefined") {
    interviewPhase = phase;
  }
  if (typeof window !== "undefined") {
    window.interviewPhase = phase;
  }
  if (typeof currentInterviewSession !== "undefined" && currentInterviewSession) {
    currentInterviewSession.phase = phase;
    currentInterviewSession.backendState = session;
  }

  // Restore questions array
  interviewQuestions = Array.isArray(questions) ? [...questions] : [];

  // Determine current active question index based on answered count
  const adaptiveAnswerCount = Math.max(0, answers.filter((a) => (a?.question || "").trim() !== "Giới thiệu bản thân").length);
  currentQuestionIndex = Math.min(adaptiveAnswerCount, Math.max(0, interviewQuestions.length - 1));

  // Restore userResponses
  userResponses = [];
  if (typeof window !== "undefined") {
    window._interviewHistory = [];
  }

  for (const answerItem of answers) {
    if (!answerItem) continue;
    const qText = answerItem.question || "";
    const aText = answerItem.answer || "";
    const isIntro = qText === "Giới thiệu bản thân";

    userResponses.push({
      question: qText,
      answer: aText,
      score: null,
      offTopic: false,
      phase: isIntro ? "INTRODUCTION" : "ADAPTIVE_INTERVIEW",
    });

    if (typeof window !== "undefined" && Array.isArray(window._interviewHistory)) {
      window._interviewHistory.push({
        question: qText,
        answer: aText,
        phase: isIntro ? "INTRODUCTION" : "ADAPTIVE_INTERVIEW",
      });
    }
  }

  // Restore current question metadata & prompter
  const currentQuestion = interviewQuestions[currentQuestionIndex];
  if (currentQuestion && typeof currentInterviewSession !== "undefined" && currentInterviewSession) {
    currentInterviewSession.currentQuestion = {
      question: currentQuestion,
      topic: state.CurrentTopic || state.currentTopic || "",
      subtopic: state.CurrentSubtopic || state.currentSubtopic || "",
      dimension: state.CurrentDimension || state.currentDimension || "",
      questionType: "Technical",
      difficulty: 1,
      isFollowUp: false,
    };
  }

  // Prompter text update on restore (WAITING FOR START)
  if ((phase === "ADAPTIVE_INTERVIEW" || phase === "TECHNICAL_ASSESSMENT") && currentQuestion) {
    const currentQEl = document.getElementById("current-question-text");
    if (currentQEl) currentQEl.textContent = currentQuestion;

    const currentQBadge = document.getElementById("current-question-badge");
    if (currentQBadge) {
      currentQBadge.className = "ir-question-badge";
      currentQBadge.textContent = currentQuestionIndex === 0 ? "Câu hỏi đầu tiên" : "Câu hỏi trọng tâm";
    }

    const counterEl = document.getElementById("question-counter");
    if (counterEl) {
      counterEl.className = "ir-progress-pill pm-status-pill ready";
      counterEl.innerHTML = `
        <span class="pm-status-dot ready"></span>
        <span>Câu hỏi <strong>${currentQuestionIndex + 1}</strong></span>
      `;
    }
  } else if (phase === "CANDIDATE_QUESTIONS" || phase === "CLOSING" || phase === "COMPLETED") {
    if (typeof updateStagePresentation === "function") {
      updateStagePresentation(phase, false, currentQuestionIndex + 1, true);
    }
  } else if (phase === "INTRODUCTION") {
    const introAnswer = answers.find((a) => (a?.question || "").trim() === "Giới thiệu bản thân");
    if (!introAnswer) {
      const sessionId = session?.Id || session?.id || (typeof currentInterviewSession !== "undefined" ? (currentInterviewSession?.backendSessionId || currentInterviewSession?.id) : "");
      const sessionStartedKey = sessionId ? "prepmate_interview_started_" + sessionId : "";
      const wasStarted = (sessionStartedKey && typeof sessionStorage !== "undefined" && sessionStorage.getItem(sessionStartedKey) === "true") ||
        (typeof window !== "undefined" && Boolean(window._isInterviewSessionStarted));

      const currentQEl = document.getElementById("current-question-text");
      if (currentQEl && wasStarted) {
        currentQEl.textContent =
          "Xin chào bạn. Chúng ta sẽ bắt đầu buổi phỏng vấn. " +
          "Hãy trả lời tự nhiên như trong một buổi phỏng vấn thực tế. " +
          "Trước tiên, bạn hãy giới thiệu ngắn gọn về bản thân, " +
          "kinh nghiệm và những dự án nổi bật mà bạn đã thực hiện nhé.";
      }
      if (typeof updateStagePresentation === "function") {
        updateStagePresentation("INTRODUCTION", false, 1);
      }
    }
  }

  if (typeof debugInterview === "function") {
    debugInterview("SESSION", "Restore complete:", {
      phase,
      questionsCount: interviewQuestions.length,
      answersCount: answers.length,
      currentQuestionIndex,
      currentQuestion,
    });
  }
}

/**
 * Reconstructs chat conversation history from saved session data
 */
function restoreInterviewChatHistory(session) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;

  chatBox.innerHTML = "";
  if (typeof _lastAppendedAiMessage !== "undefined") {
    _lastAppendedAiMessage = "";
  }
  if (typeof window !== "undefined") {
    window._lastAppendedAiMessage = "";
  }

  const answers = Array.isArray(session?.Answers)
    ? session.Answers
    : (Array.isArray(session?.answers) ? session.answers : []);

  const state = session?.InterviewState || session?.interviewState || {};
  const phase = state.InterviewPhase || state.interviewPhase || (typeof interviewPhase !== "undefined" ? interviewPhase : "INTRODUCTION");

  const introPromptText =
    "Xin chào bạn. Chúng ta sẽ bắt đầu buổi phỏng vấn. " +
    "Hãy trả lời tự nhiên như trong một buổi phỏng vấn thực tế. " +
    "Trước tiên, bạn hãy giới thiệu ngắn gọn về bản thân, " +
    "kinh nghiệm và những dự án nổi bật mà bạn đã thực hiện nhé.";

  // 1. Introduction restore
  const introAnswer = answers.find((a) => (a?.question || "").trim() === "Giới thiệu bản thân");
  if (introAnswer) {
    appendAIMessage(
      introPromptText,
      null,
    );
    if (introAnswer.answer) {
      appendUserMessage(introAnswer.answer);
    }
  } else if (phase === "INTRODUCTION") {
    // When in INTRODUCTION phase without an intro answer, restore initial chat content instead of leaving chatBox blank
    const sessionId = session?.Id || session?.id || (typeof currentInterviewSession !== "undefined" ? (currentInterviewSession?.backendSessionId || currentInterviewSession?.id) : "");
    const sessionStartedKey = sessionId ? "prepmate_interview_started_" + sessionId : "";
    const wasStarted = (sessionStartedKey && typeof sessionStorage !== "undefined" && sessionStorage.getItem(sessionStartedKey) === "true") ||
      (typeof window !== "undefined" && Boolean(window._isInterviewSessionStarted));

    if (wasStarted) {
      // Candidate already clicked Start: show the active introduction prompt
      appendAIMessage(
        introPromptText,
        null,
      );
    } else {
      // Candidate has not clicked Start yet: show the initial welcome greeting
      if (typeof renderNewInterviewWelcomeMessage === "function") {
        renderNewInterviewWelcomeMessage();
      } else {
        const dispName = (typeof getActiveInterviewerDisplayName === "function")
          ? getActiveInterviewerDisplayName().replace(/\s*\(.*?\)\s*/, "")
          : "Trần Minh Vũ";
        appendAIMessage(
          `Xin chào bạn! Tôi là ${dispName}, người đồng hành cùng bạn trong buổi phỏng vấn hôm nay. Bạn hãy kiểm tra lại góc máy camera, âm thanh micro và nhấn nút "Bắt đầu" ở góc trên bên phải khi đã sẵn sàng nhé!`,
          null,
        );
      }
    }
  }

  // 2. Adaptive questions + answers restore (Only actual asked & answered items)
  const adaptiveAnswers = answers.filter((a) => (a?.question || "").trim() !== "Giới thiệu bản thân");
  adaptiveAnswers.forEach((item) => {
    if (item?.question) {
      appendAIMessage(item.question, null);
    }
    if (item?.answer) {
      appendUserMessage(item.answer);
    }
  });

  // 3. Ensure active unanswered question is displayed in chatBox
  const isAdaptivePhase = phase === "ADAPTIVE_INTERVIEW" || phase === "TECHNICAL_ASSESSMENT";
  const questionsList = (typeof interviewQuestions !== "undefined" && Array.isArray(interviewQuestions))
    ? interviewQuestions
    : (Array.isArray(session?.Questions) ? session.Questions : (Array.isArray(session?.questions) ? session.questions : []));
  const qIdx = typeof currentQuestionIndex === "number" ? currentQuestionIndex : 0;
  if (isAdaptivePhase && questionsList[qIdx]) {
    appendAIMessage(questionsList[qIdx], null);
  }

  chatBox.scrollTop = chatBox.scrollHeight;
}

if (typeof window !== "undefined") {
  window.restoreInterviewSession = restoreInterviewSession;
  window.restoreInterviewChatHistory = restoreInterviewChatHistory;
}
