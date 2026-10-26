using System;
using System.Collections.Generic;

namespace backend.Models
{
    /// <summary>
    /// Phase 3 Step 4: Diagnosis of a candidate's strength.
    /// Explains why the candidate performs well, with explicit turn evidence, impact, and confidence.
    /// </summary>
    public class StrengthDiagnosis
    {
        public string Title { get; set; } = string.Empty;
        public string RelatedCompetency { get; set; } = string.Empty;
        public StrengthType Type { get; set; } = StrengthType.TECHNICAL_KNOWLEDGE;
        public DiagnosticImpact Impact { get; set; } = DiagnosticImpact.MEDIUM;
        public EvaluationConfidence Confidence { get; set; } = EvaluationConfidence.HIGH;
        public List<string> Evidence { get; set; } = new();
        public List<int> TurnReferences { get; set; } = new();
        public string Explanation { get; set; } = string.Empty;
    }

    /// <summary>
    /// Phase 3 Step 4: Diagnosis of a candidate's tested weakness.
    /// Captures the root cause (Knowledge gap, insufficient depth, trade-off reasoning, follow-up gap, etc.),
    /// impact, priority, and turn-by-turn evidence.
    /// Invariant: NOT_TESTED is never diagnosed as a weakness!
    /// </summary>
    public class WeaknessDiagnosis
    {
        public string Title { get; set; } = string.Empty;
        public string RelatedCompetency { get; set; } = string.Empty;
        public DiagnosticRootCause RootCause { get; set; } = DiagnosticRootCause.KNOWLEDGE_GAP;
        public DiagnosticImpact Impact { get; set; } = DiagnosticImpact.HIGH;
        public DiagnosticPriority Priority { get; set; } = DiagnosticPriority.HIGH;
        public EvaluationConfidence Confidence { get; set; } = EvaluationConfidence.HIGH;
        public List<string> Evidence { get; set; } = new();
        public List<int> TurnReferences { get; set; } = new();
        public string Explanation { get; set; } = string.Empty;
    }

    /// <summary>
    /// Phase 3 Step 4: Diagnosis of unassessed or partially evidenced competencies.
    /// Strictly distinguished from weaknesses.
    /// </summary>
    public class KnowledgeGapDiagnosis
    {
        public string Title { get; set; } = string.Empty;
        public string RelatedCompetency { get; set; } = string.Empty;
        public KnowledgeGapType GapType { get; set; } = KnowledgeGapType.UNASSESSED;
        public bool IsMandatory { get; set; } = true;
        public DiagnosticImpact Impact { get; set; } = DiagnosticImpact.MEDIUM;
        public DiagnosticPriority Priority { get; set; } = DiagnosticPriority.MEDIUM;
        public EvaluationConfidence Confidence { get; set; } = EvaluationConfidence.INSUFFICIENT_EVIDENCE;
        public string Description { get; set; } = string.Empty;
    }

    /// <summary>
    /// Phase 3 Step 4: Enriched diagnosis of risks (Contradiction, Unverified High Claim, Budget Constrained).
    /// Reuses evaluation risks and adds verification requirements without accusing candidates of lying.
    /// </summary>
    public class RiskDiagnosis
    {
        public EvaluationRiskType Type { get; set; } = EvaluationRiskType.KNOWLEDGE_GAP;
        public string Severity { get; set; } = "MEDIUM";
        public string RelatedCompetency { get; set; } = string.Empty;
        public DiagnosticImpact Impact { get; set; } = DiagnosticImpact.MEDIUM;
        public EvaluationConfidence Confidence { get; set; } = EvaluationConfidence.HIGH;
        public string Evidence { get; set; } = string.Empty;
        public bool RequiresVerification { get; set; }
        public string Description { get; set; } = string.Empty;
    }

    /// <summary>
    /// Phase 3 Step 4: Pattern findings across multiple performance dimensions.
    /// E.g. Strong implementation knowledge + limited reasoning depth.
    /// </summary>
    public class CrossDimensionFinding
    {
        public string PatternTitle { get; set; } = string.Empty;
        public List<PerformanceDimensionType> RelatedDimensions { get; set; } = new();
        public string Description { get; set; } = string.Empty;
        public DiagnosticImpact Impact { get; set; } = DiagnosticImpact.MEDIUM;
    }

    /// <summary>
    /// Phase 3 Step 4: Comprehensive Diagnostic Analysis.
    /// Answers why the candidate performed the way they did, with explicit root causes,
    /// evidence traces, impacts, and priorities.
    /// </summary>
    public class DiagnosticAnalysis
    {
        public string SessionId { get; set; } = string.Empty;
        public List<StrengthDiagnosis> Strengths { get; set; } = new();
        public List<WeaknessDiagnosis> Weaknesses { get; set; } = new();
        public List<KnowledgeGapDiagnosis> KnowledgeGaps { get; set; } = new();
        public List<RiskDiagnosis> Risks { get; set; } = new();
        public List<CrossDimensionFinding> CrossDimensionFindings { get; set; } = new();
        public List<string> Priorities { get; set; } = new();
        public List<string> Limitations { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
