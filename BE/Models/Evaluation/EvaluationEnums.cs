using System.Text.Json.Serialization;

namespace backend.Models
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum EvidenceType
    {
        OBSERVED,
        CLAIMED,
        INFERRED,
        MISSING,
        CONTRADICTORY
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum EvaluationConfidence
    {
        HIGH,
        MEDIUM,
        LOW,
        INSUFFICIENT_EVIDENCE
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum EvaluationRiskType
    {
        CONTRADICTION,
        UNVERIFIED_HIGH_CLAIM,
        KNOWLEDGE_GAP,
        BUDGET_CONSTRAINED,
        OVERCLAIMING
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum InterviewCompletionStatus
    {
        COMPLETED_NORMAL,
        MAX_QUESTIONS_REACHED,
        MANUAL_EXIT,
        INSUFFICIENT_TURNS,
        INTERRUPTED
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum KnowledgeGapType
    {
        UNASSESSED,
        INSUFFICIENT_DEPTH,
        MISSING_PRACTICAL_EVIDENCE,
        BELOW_EXPECTED_LEVEL
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum PerformanceDimensionType
    {
        TECHNICAL_KNOWLEDGE,
        PRACTICAL_APPLICATION,
        REASONING_DEPTH,
        FOLLOW_UP_HANDLING,
        COMMUNICATION,
        CONSISTENCY
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum InterviewReadinessStatus
    {
        READY,
        READY_WITH_GAPS,
        NEEDS_MORE_EVIDENCE,
        NOT_READY
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum DiagnosticImpact
    {
        HIGH,
        MEDIUM,
        LOW
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum DiagnosticPriority
    {
        HIGH,
        MEDIUM,
        LOW
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum DiagnosticRootCause
    {
        KNOWLEDGE_GAP,
        INSUFFICIENT_DEPTH,
        MISSING_PRACTICAL_EXPERIENCE,
        TRADE_OFF_REASONING_GAP,
        FOLLOW_UP_DEPTH_GAP,
        COMMUNICATION_STRUCTURE_GAP,
        INSUFFICIENT_EVIDENCE
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum StrengthType
    {
        TECHNICAL_KNOWLEDGE,
        PRACTICAL_EXPERIENCE,
        REASONING_DEPTH,
        PROBLEM_SOLVING,
        COMMUNICATION,
        FOLLOW_UP_HANDLING,
        CONSISTENCY
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum EstimatedEffort
    {
        LOW,
        MEDIUM,
        HIGH
    }
}
