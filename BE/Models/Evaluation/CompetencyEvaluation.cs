using System.Collections.Generic;

namespace backend.Models
{
    public class CompetencyEvaluation
    {
        public string CompetencyId { get; set; } = string.Empty;
        public string CompetencyName { get; set; } = string.Empty;
        public string AreaName { get; set; } = string.Empty;
        public double WeightPercentage { get; set; }
        public int Priority { get; set; } = 1;
        public bool IsMandatory { get; set; } = true;
        public string TargetLevel { get; set; } = "Mid";
        public ConceptCoverageStatus CoverageStatus { get; set; } = ConceptCoverageStatus.NOT_TESTED;
        public string DemonstratedLevel { get; set; } = "Unassessed"; // Senior, Middle, Junior, Below Target, Unassessed
        public double Score { get; set; } // 0.0 - 10.0 scale
        public EvaluationConfidence Confidence { get; set; } = EvaluationConfidence.INSUFFICIENT_EVIDENCE;
        public bool IsMet { get; set; }
        public List<string> Strengths { get; set; } = new();
        public List<string> Gaps { get; set; } = new();
        public List<EvidenceItem> EvidenceItems { get; set; } = new();
        public string Rationale { get; set; } = string.Empty;
    }
}
