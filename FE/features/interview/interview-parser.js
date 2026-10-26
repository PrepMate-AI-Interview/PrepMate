// ==========================================
// PREPMATE — RESPONSE PARSER & VALIDATOR (CONTRACT SAFE)
// ARCHITECTURE: INTERVIEW QUESTION EXTRACTION UTILITIES
// ==========================================

function extractQuestionText(data) {
  if (!data) return "";
  if (typeof data === "string") return data.trim();
  if (typeof data.nextQuestion === "string" && data.nextQuestion.trim()) {
    return data.nextQuestion.trim();
  }
  if (typeof data.question === "string" && data.question.trim()) {
    return data.question.trim();
  }
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }
  if (typeof data.transitionMessage === "string" && data.transitionMessage.trim()) {
    return data.transitionMessage.trim();
  }
  if (data.data) {
    return extractQuestionText(data.data);
  }
  return "";
}

function extractQuestionMetadata(data) {
  const source = data?.data || data || {};
  const stage = source.stage || source.Stage || "TECHNICAL_ASSESSMENT";
  const isTransition = Boolean(
    (!source.nextQuestion && (source.message || source.transitionMessage)) ||
    stage === "CANDIDATE_QUESTIONS" ||
    stage === "CLOSING" ||
    stage === "COMPLETED"
  );
  return {
    stage: stage,
    topic: source.topic || "",
    subtopic: source.subtopic || source.topic || "",
    dimension: source.dimension || "Technical",
    questionType: source.questionType || (isTransition ? "Transition" : "Behavioral/Technical"),
    difficulty: Number(source.difficulty) || 1,
    isFollowUp: source.isFollowUp === true,
    isTransitionPrompt: isTransition,
    targetConcept: source.targetConcept || "",
    reason: source.reason || "",
    message: source.message || "",
  };
}

if (typeof window !== "undefined") {
  window.extractQuestionText = extractQuestionText;
  window.extractQuestionMetadata = extractQuestionMetadata;
}
