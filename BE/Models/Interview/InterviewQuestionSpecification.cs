using System;
using System.Text.Json.Serialization;

namespace backend.Models
{
    /// <summary>
    /// Supported question types for natural interviewer dialogue and evidence investigation.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum InterviewQuestionType
    {
        INITIAL,
        FOLLOW_UP,
        CLARIFICATION,
        DEEP_DIVE,
        EXAMPLE_REQUEST,
        METHOD_REQUEST,
        IMPACT_REQUEST,
        TRADEOFF_REQUEST,
        RISK_REQUEST,
        REPEATABILITY_REQUEST,
        BRIDGE,
        TRANSITION
    }

    /// <summary>
    /// Deterministic intermediate representation representing WHAT to ask, why, and in what context.
    /// C# deterministically governs this specification; AI/Gemini assists ONLY with natural conversational delivery (HOW).
    /// </summary>
    public class InterviewQuestionSpecification
    {
        public string Stage { get; set; } = InterviewStageNames.TechnicalAssessment;
        public InterviewIntentType Intent { get; set; } = InterviewIntentType.VERIFY_CLAIM;
        public string ProbeReason { get; set; } = string.Empty;
        public string TargetCompetency { get; set; } = string.Empty;
        public string TargetDimension { get; set; } = string.Empty;
        public InterviewQuestionType QuestionType { get; set; } = InterviewQuestionType.INITIAL;
        public string Objective { get; set; } = string.Empty;
        public string Context { get; set; } = string.Empty;
        public string? ParentQuestionId { get; set; }
        public string? RelatedClaimId { get; set; }
        public int Difficulty { get; set; } = 1;
        public bool IsFollowUp { get; set; } = false;
        public bool IsBridge { get; set; } = false;
        public string? BridgeContext { get; set; }
        public string? ConversationalHook { get; set; }
        public string? DeterministicWording { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
