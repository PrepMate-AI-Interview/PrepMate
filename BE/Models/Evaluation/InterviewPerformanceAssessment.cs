using System;
using System.Collections.Generic;

namespace backend.Models
{
    /// <summary>
    /// Phase 3 Step 3: Performance Dimension Evaluation item.
    /// Captures how the candidate demonstrated capability across non-functional and behavioral dimensions.
    /// </summary>
    public class PerformanceDimensionAssessment
    {
        public PerformanceDimensionType Dimension { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Level { get; set; } = "Unassessed"; // "STRONG", "MODERATE", "LIMITED", "WEAK", "UNASSESSED"
        public double Score { get; set; } // 0.0 - 10.0 scale
        public EvaluationConfidence Confidence { get; set; } = EvaluationConfidence.INSUFFICIENT_EVIDENCE;
        public int EvidenceCount { get; set; }
        public List<string> SupportingEvidence { get; set; } = new();
        public List<int> TurnReferences { get; set; } = new();
        public string Summary { get; set; } = string.Empty;
    }

    /// <summary>
    /// Phase 3 Step 3: Comprehensive Interview Performance Assessment.
    /// Separates candidate interview performance (how they communicate, reason, handle follow-ups, and apply knowledge)
    /// from static knowledge evaluation.
    /// </summary>
    public class InterviewPerformanceAssessment
    {
        public string SessionId { get; set; } = string.Empty;
        public string TargetPosition { get; set; } = string.Empty;
        public string TargetLevel { get; set; } = "Mid";
        public InterviewReadinessStatus Readiness { get; set; } = InterviewReadinessStatus.NEEDS_MORE_EVIDENCE;
        public string ReadinessRationale { get; set; } = string.Empty;
        public List<PerformanceDimensionAssessment> Dimensions { get; set; } = new();
        public List<string> Strengths { get; set; } = new();
        public List<string> AreasForImprovement { get; set; } = new();
        public List<string> Limitations { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public PerformanceDimensionAssessment? FindDimension(PerformanceDimensionType type)
        {
            return Dimensions.Find(d => d.Dimension == type);
        }
    }
}
