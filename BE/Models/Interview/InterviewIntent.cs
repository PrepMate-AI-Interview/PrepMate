using System;
using System.Text.Json.Serialization;

namespace backend.Models
{
    /// <summary>
    /// Represents the interviewer's internal inquiry intent for verifying candidate claims.
    /// Internal reasoning only: NEVER exposed to the candidate.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum InterviewIntentType
    {
        VERIFY_CLAIM,           // Claim is too broad, vague, or unspecific
        VERIFY_OWNERSHIP,       // Candidate's direct role vs team/inherited
        VERIFY_METHOD,          // How the candidate achieved the result
        VERIFY_IMPACT,          // Concrete qualitative/quantitative outcome
        VERIFY_REPEATABILITY,   // One-time success vs repeatable competency
        TEST_TRADEOFF,          // Decision reasoning and alternatives evaluated
        TEST_RISK,              // Risk awareness, edge cases, failure modes
        TEST_DEPTH,             // Surface-level answer when depth is needed
        TEST_SYSTEM_THINKING,   // Architectural, cross-functional, or organizational view
        CLARIFY_CONTRADICTION,  // Resolve factual inconsistency (no lie accusation)
        MOVE_ON                 // Sufficient evidence or probe budget reached
    }

    /// <summary>
    /// Represents a gap in candidate-provided evidence across a specific evaluation dimension.
    /// </summary>
    public class EvidenceGap
    {
        public string Dimension { get; set; } = string.Empty; // Ownership, Specificity, Method, Impact, Repeatability, TradeOff, Risk, SystemThinking, Contradiction
        public string GapDimension { get => Dimension; set => Dimension = value; }
        public EvidenceDimensionLevel CurrentLevel { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public int Priority { get; set; } = 0;
        public string Description { get; set; } = string.Empty;
        public string GapDescription { get => Description; set => Description = value; }
        public InterviewIntentType TargetIntent { get; set; } = InterviewIntentType.MOVE_ON;
    }

    /// <summary>
    /// Represents the deterministic decision on what to investigate next and why.
    /// C# determines the intent and probe action; Gemini assists only in wording.
    /// </summary>
    public class InterviewerIntentDecision
    {
        public InterviewIntentType Intent { get; set; } = InterviewIntentType.MOVE_ON;
        public string? ClaimId { get; set; }
        public EvidenceGap? EvidenceGap { get; set; }
        public InterviewerProbePattern? RecommendedPattern { get; set; }
        public string? ParentQuestionId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public bool ShouldProbe { get; set; } = false;
        public EvidenceSufficiency Sufficiency { get; set; } = EvidenceSufficiency.SUFFICIENT;
        public string? TargetEvidenceDimension { get; set; }
    }
}
