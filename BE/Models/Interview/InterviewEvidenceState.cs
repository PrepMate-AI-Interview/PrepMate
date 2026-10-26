using System;
using System.Collections.Generic;

namespace backend.Models
{
    /// <summary>
    /// Tracks contradiction across multiple turns without drawing authoritative lie accusations.
    /// Invariant: LieVerdict is ALWAYS false. Contradictions prompt clarification, not moral judgment.
    /// </summary>
    public class CrossAnswerContradictionRecord
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public int Turn1 { get; set; }
        public int Turn2 { get; set; }
        public string Statement1 { get; set; } = string.Empty;
        public string Statement2 { get; set; } = string.Empty;
        public string ContradictionDescription { get; set; } = string.Empty;
        public bool IsResolved { get; set; } = false;
        public string? ResolutionStatement { get; set; }
        public bool LieVerdict { get; } = false; // INVARIANT: LieVerdict is strictly false
    }

    /// <summary>
    /// Records an interviewer deep probe into a specific candidate claim.
    /// </summary>
    public class InterviewerProbeRecord
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string ClaimId { get; set; } = string.Empty;
        public int Turn { get; set; }
        public string? ParentQuestionId { get; set; }
        public InterviewerProbePattern Pattern { get; set; }
        public InterviewIntentType? Intent { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string ProbeQuestion { get; set; } = string.Empty;
        public int ProbeDepth { get; set; } = 1; // 1 = HOW, 2 = WHY #1, 3 = REPEATABILITY / WHY #2
    }

    /// <summary>
    /// Diagnostic summary for the Interviewer Intelligence engine.
    /// Diagnostic only; does not overwrite technical, behavioral, situational, or candidate scores.
    /// </summary>
    public class InterviewerIntelligenceSummary
    {
        public int ClaimsEvaluated { get; set; } = 0;
        public int StrongEvidenceCount { get; set; } = 0;
        public int ModerateEvidenceCount { get; set; } = 0;
        public int InsufficientEvidenceCount { get; set; } = 0;
        public int OwnershipGaps { get; set; } = 0;
        public int MethodGaps { get; set; } = 0;
        public int EvidenceGaps { get; set; } = 0;
        public int SpecificityGaps { get; set; } = 0;
        public int ImpactGaps { get; set; } = 0;
        public int RepeatabilityGaps { get; set; } = 0;
        public int RiskGaps { get; set; } = 0;
        public int TradeoffGaps { get; set; } = 0;
        public int ContradictionsDetected { get; set; } = 0;
        public int ClarificationsGenerated { get; set; } = 0;
        public int ProbesUsed { get; set; } = 0;
    }

    /// <summary>
    /// Session-level state container for candidate claims, evidence, probes, and consistency memory.
    /// </summary>
    public class InterviewEvidenceState
    {
        public List<CandidateClaim> Claims { get; set; } = new();
        public string? ActiveClaimId { get; set; }
        public List<CrossAnswerContradictionRecord> Contradictions { get; set; } = new();
        public List<InterviewerProbeRecord> Probes { get; set; } = new();
        public List<InterviewerIntentDecision> IntentHistory { get; set; } = new();
        public InterviewerIntelligenceSummary Summary { get; set; } = new();

        // Phase 5 Step 2: Cross-Turn Competency Map & History
        public Dictionary<string, CompetencyEvidenceRecord> CompetencyMap { get; set; } = new(StringComparer.OrdinalIgnoreCase);
        public List<DimensionEvidenceEntry> EvidenceHistory { get; set; } = new();

        // Phase 5 Step 3: Stage-Level & Cross-Competency Evidence Synthesis
        public Dictionary<string, Dictionary<string, StageCompetencyEvidenceRecord>> StageEvidenceMap { get; set; } = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, CrossStageCompetencyRecord> CrossStageMap { get; set; } = new(StringComparer.OrdinalIgnoreCase);
        public List<CrossCompetencyRelationship> CompetencyRelationships { get; set; } = new();
        public EvidenceGapSummary GapSummary { get; set; } = new();
        public List<EvidenceProvenanceEntry> Provenance { get; set; } = new();

        // Phase 5 Step 4: Natural Interviewer Conversation & Question Specifications
        public List<InterviewQuestionSpecification> QuestionSpecifications { get; set; } = new();
        public InterviewQuestionSpecification? CurrentQuestionSpecification { get; set; }

        // Phase 5 Step 5: Realistic Multi-Industry Interview Scenarios & Interviewer Behavior
        public InterviewScenario? ActiveScenario { get; set; }
        public List<InterviewScenario> ScenarioHistory { get; set; } = new();
        public InterviewerBehaviorType CurrentInterviewerBehavior { get; set; } = InterviewerBehaviorType.NEUTRAL;

        // Phase 5 Step 6: Real-Time Adaptive Feedback Calibration
        public RealTimeFeedbackState RealTimeFeedback { get; set; } = new();
    }
}
