using System.Threading.Tasks;
using backend.Models;

namespace backend.Services.Interview
{
    public interface IInterviewQualityService
    {
        /// <summary>
        /// Initializes the InterviewQualityState based on candidate seniority and context.
        /// Deterministically sets starting difficulty and difficulty ceiling.
        /// </summary>
        InterviewQualityState InitializeQualityState(Session session, string? seniority = null);

        /// <summary>
        /// Classifies candidate answer quality purely for interviewer steering (diagnostic only).
        /// Invariant: 0% impact on final domain scores.
        /// </summary>
        AnswerQualityLevel EvaluateAnswerQuality(
            string answer,
            AnswerAnalysis? analysis = null,
            ClaimEvidence? claimEvidence = null,
            BehavioralEvidence? star = null,
            SituationalEvidence? sit = null);

        /// <summary>
        /// Detects candidate engagement and fatigue risk using non-intrusive text heuristics.
        /// Invariant: Strictly no multimodal (no camera/voice/emotion), 0% penalty on evaluation.
        /// </summary>
        (CandidateEngagementLevel Level, bool FatigueDetected) DetectEngagementAndFatigue(
            Session session,
            string answer,
            int turn);

        /// <summary>
        /// Decides the next interviewer action (Probe, Clarify, Increase/Decrease difficulty, Move on)
        /// based on answer quality, fatigue, evidence sufficiency, and probe limits.
        /// </summary>
        (NextInterviewAction Action, InterviewDifficultyLevel NewDifficulty, string Reason) DecideNextAdaptiveAction(
            Session session,
            AnswerQualityLevel quality,
            bool fatigueDetected,
            bool evidenceSufficient,
            int currentProbeCount,
            int probeLimit = 3,
            string? currentCompetency = null);

        /// <summary>
        /// Adjusts interviewer pressure level (CALM, NORMAL, PROBING, CHALLENGING) based on role and fatigue.
        /// Maintains professional tone; never hostile. Pressure never penalizes scores.
        /// </summary>
        InterviewPressureLevel AdjustPressureLevel(
            Session session,
            string role,
            InterviewDifficultyLevel difficulty,
            CandidateEngagementLevel engagement,
            bool fatigueDetected,
            int turn);

        /// <summary>
        /// Deterministic Question Similarity Guard that prevents duplicate or semantically identical questions.
        /// </summary>
        bool IsQuestionSimilarOrDuplicate(
            Session session,
            string questionCandidate,
            string? competency = null,
            string? pattern = null,
            string? dimension = null,
            string? parentQuestionId = null);

        /// <summary>
        /// Records the semantic fingerprint of an emitted question to prevent future repetitions.
        /// </summary>
        void RecordQuestionFingerprint(
            Session session,
            string question,
            string? competency = null,
            string? pattern = null,
            string? dimension = null,
            string? parentQuestionId = null,
            int turn = 1);

        /// <summary>
        /// Prepends natural conversational transition bridges based on action, reason, and answer quality.
        /// </summary>
        string NaturalizeQuestionWithTransition(
            Session session,
            string rawQuestion,
            NextInterviewAction action,
            TopicTransitionReason? reason,
            AnswerQualityLevel lastQuality);

        /// <summary>
        /// Enforces deterministic difficulty ceiling based on seniority.
        /// Intern/Junior: Max ADVANCED (never CHALLENGING).
        /// </summary>
        InterviewDifficultyLevel EnforceSeniorityCeiling(InterviewDifficultyLevel requested, string seniority);

        /// <summary>
        /// Compiles the final quality and realism diagnostic summary for the interview session.
        /// </summary>
        InterviewQualitySummary CalculateQualitySummary(Session session);
    }
}
