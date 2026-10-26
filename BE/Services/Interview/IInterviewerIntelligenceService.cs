using System.Threading.Tasks;
using backend.Models;

namespace backend.Services.Interview
{
    public interface IInterviewerIntelligenceService
    {
        /// <summary>
        /// Analyzes a candidate answer to extract claims across any industry or role,
        /// evaluating ownership, method, evidence, specificity, impact, and consistency.
        /// </summary>
        Task<ClaimEvidence> AnalyzeAnswerClaimsAsync(Session session, string question, string answer, int turn);

        /// <summary>
        /// Determines whether to probe further into a claim or move on, based on missing evidence and C# budget constraints.
        /// Hard limit of 3 probes per claim is strictly enforced.
        /// </summary>
        (EvidenceSufficiency Sufficiency, InterviewerProbePattern? Pattern, string Reason) DecideProbeAction(
            Session session,
            CandidateClaim claim,
            InterviewBlueprint? blueprint);

        /// <summary>
        /// Generates an adaptive probe question using one of the 11 interviewer probe patterns or 3-Why/1-How,
        /// calibrated to role, industry, and seniority.
        /// </summary>
        Task<InterviewerProbeRecord> GenerateProbeAsync(
            Session session,
            CandidateClaim claim,
            InterviewerProbePattern pattern,
            string reason,
            int turn,
            string? parentQuestionId = null);

        /// <summary>
        /// Checks if a new claim directly contradicts prior statements across turns.
        /// INVARIANT: Never outputs a lie verdict.
        /// </summary>
        CrossAnswerContradictionRecord? CheckCrossAnswerContradiction(Session session, CandidateClaim newClaim, int turn);

        /// <summary>
        /// Analyzes gaps in candidate-provided evidence across dimensions (ownership, method, impact, etc.)
        /// using context-aware prioritization (seniority, industry, role).
        /// </summary>
        System.Collections.Generic.List<EvidenceGap> AnalyzeEvidenceGaps(
            Session session,
            CandidateClaim claim,
            InterviewBlueprint? blueprint = null);

        /// <summary>
        /// Deterministically determines the interviewer's inquiry intent based on missing evidence gaps.
        /// Answers: "What am I trying to verify from the candidate next?"
        /// </summary>
        InterviewerIntentDecision DecideIntent(
            Session session,
            CandidateClaim claim,
            InterviewBlueprint? blueprint = null);

        /// <summary>
        /// Generates an adaptive probe question matching the chosen InterviewIntent.
        /// Preserves internal reasoning in memory without exposing intent or evidence-gap jargon to candidate.
        /// </summary>
        Task<InterviewerProbeRecord> GenerateIntentProbeAsync(
            Session session,
            CandidateClaim claim,
            InterviewerIntentDecision decision,
            int turn,
            string? parentQuestionId = null);

        /// <summary>
        /// Compiles a diagnostic summary of evaluated claims and probe usage.
        /// </summary>
        InterviewerIntelligenceSummary CalculateSummary(Session session);

        /// <summary>
        /// Accumulates evidence across turns for a candidate claim, linking follow-up elaborations
        /// without aggressive false-merging of distinct projects or scopes.
        /// </summary>
        CandidateClaim AccumulateCrossTurnEvidence(Session session, CandidateClaim newClaim, int turn);

        /// <summary>
        /// Synthesizes evidence across turns for a specific competency into the CompetencyMap.
        /// Invariant: Purely diagnostic for interviewer intelligence, NEVER affects final score.
        /// </summary>
        CompetencyEvidenceRecord SynthesizeCompetencyEvidence(Session session, string competency, InterviewBlueprint? blueprint = null);

        /// <summary>
        /// Evaluates whether an additional probe on a claim would yield material new information,
        /// or whether the topic has been sufficiently covered.
        /// </summary>
        bool IsInformationValueLow(Session session, CandidateClaim claim, InterviewIntentType intent);

        /// <summary>
        /// Phase 5 Step 3: Synthesizes and records evidence for a competency within a specific interview stage,
        /// preserving granular dimension levels and complete provenance back to the source turn and answer.
        /// </summary>
        StageCompetencyEvidenceRecord RecordStageEvidence(Session session, string stage, CandidateClaim claim, int turn, string? sourceAnswer = null);

        /// <summary>
        /// Phase 5 Step 3: Synthesizes cross-stage evidence for a competency across all interview stages,
        /// preserving distinct stage observations without destructive collapsing or score drift.
        /// </summary>
        CrossStageCompetencyRecord SynthesizeCrossStageEvidence(Session session, string competency);

        /// <summary>
        /// Phase 5 Step 3: Evaluates diagnostic relationships (SUPPORTING, CORRELATED, TENSION, DEPENDENCY)
        /// between observed competencies based on blueprint, evidence, and multi-industry context.
        /// Invariant: Pure diagnostic reasoning; never used as a scoring formula.
        /// </summary>
        System.Collections.Generic.List<CrossCompetencyRelationship> EvaluateCrossCompetencyRelationships(Session session, InterviewBlueprint? blueprint = null);

        /// <summary>
        /// Phase 5 Step 3: Generates a diagnostic summary of evidence coverage and gaps across all competencies
        /// (WellSupported, PartiallySupported, Untested, Conflicting, ContextLimited).
        /// </summary>
        EvidenceGapSummary GenerateEvidenceGapSummary(Session session, InterviewBlueprint? blueprint = null);

        /// <summary>
        /// Phase 5 Step 4: Deterministically constructs an InterviewQuestionSpecification (WHAT to ask, why, and in what context)
        /// based on session state, evidence gaps, target competency, and seniority context.
        /// </summary>
        InterviewQuestionSpecification BuildQuestionSpecification(
            Session session,
            CandidateClaim? claim = null,
            InterviewerIntentDecision? decision = null,
            string? targetCompetency = null,
            string? parentQuestionId = null);

        /// <summary>
        /// Phase 5 Step 4: Constructs a natural, context-aware interview question from a specification.
        /// C# determines the specification and deterministic wording; Gemini assists only in natural phrasing,
        /// subject to strict safety and quality validation.
        /// </summary>
        Task<GeneratedQuestion> ConstructNaturalQuestionAsync(Session session, InterviewQuestionSpecification spec);

        /// <summary>
        /// Phase 5 Step 4: Deterministically validates the quality of a question candidate.
        /// Rejects empty text, metadata leakage, score/evaluation leaks, accusations, fabrications, and repetitions.
        /// </summary>
        bool ValidateQuestionQuality(Session session, InterviewQuestionSpecification spec, string questionText, out string failureReason);

        /// <summary>
        /// Phase 5 Step 4: Constructs a natural conversational bridge between a previous topic and a new competency
        /// without fabricating unstated candidate facts.
        /// </summary>
        string BuildNaturalBridge(Session session, string previousTopic, string newCompetency, string? candidateContext = null);

        /// <summary>
        /// Phase 5 Step 4: Checks whether a candidate question is semantically repetitive with prior questions
        /// within the same intent and dimension, while permitting deeper distinct objectives.
        /// </summary>
        bool CheckSemanticRepetition(Session session, InterviewQuestionSpecification spec, string candidateQuestion);

        // =====================================================================
        // PHASE 5 STEP 5: REALISTIC MULTI-INDUSTRY SCENARIOS & INTERVIEWER BEHAVIOR
        // =====================================================================

        /// <summary>
        /// Phase 5 Step 5: Initializes or retrieves the active realistic interview scenario for the session context,
        /// ensuring proper context, problem, constraints, and information boundaries.
        /// </summary>
        InterviewScenario InitializeScenario(Session session, InterviewBlueprint? blueprint = null);

        /// <summary>
        /// Phase 5 Step 5: Processes candidate information seeking, revealing authenticated facts when inquired,
        /// or gracefully declining unrecorded context without fact fabrication.
        /// </summary>
        (bool IsRevealed, string Message) ProcessCandidateInformationRequest(Session session, InterviewScenario scenario, string candidateQuery);

        /// <summary>
        /// Phase 5 Step 5: Deterministically transitions scenario state based on candidate investigation,
        /// decisions, trade-offs, and challenge defenses. C# is the sole state authority.
        /// </summary>
        ScenarioState TransitionScenarioState(Session session, InterviewScenario scenario, string candidateAnswer, CandidateClaim? claim = null);

        /// <summary>
        /// Phase 5 Step 5: Determines observable interviewer behavior (NEUTRAL, PROBING, SKEPTICAL, PRESSURE, SUPPORTIVE)
        /// based on scenario progression and candidate evidence. Invariant: Behavior NEVER modifies evaluation scores.
        /// </summary>
        InterviewerBehaviorType DetermineInterviewerBehavior(Session session, InterviewScenario scenario, CandidateClaim? claim = null);

        /// <summary>
        /// Phase 5 Step 5: Builds an InterviewQuestionSpecification tailored to the scenario state,
        /// interviewer behavior profile, and candidate responses.
        /// </summary>
        InterviewQuestionSpecification BuildScenarioQuestionSpecification(Session session, InterviewScenario scenario, InterviewerBehaviorType behavior, string candidateAnswer);

        /// <summary>
        /// Phase 5 Step 5: Injects a realistic constraint, trade-off, or time pressure dilemma into the active scenario.
        /// </summary>
        void InjectScenarioTradeOffOrConstraint(InterviewScenario scenario, string constraint);

        /// <summary>
        /// Phase 5 Step 5: Deterministically validates that generated interviewer text adheres strictly to authenticated
        /// scenario facts, preventing AI fact fabrication and adversarial injections.
        /// </summary>
        bool ValidateScenarioFactFidelity(InterviewScenario scenario, string responseText, out string failureReason);
    }
}
