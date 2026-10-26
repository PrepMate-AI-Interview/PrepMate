using System;

namespace backend.Models
{
    public class EvaluationRisk
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public EvaluationRiskType Type { get; set; } = EvaluationRiskType.KNOWLEDGE_GAP;
        public string Severity { get; set; } = "MEDIUM"; // LOW, MEDIUM, HIGH, CRITICAL
        public string RelatedConcept { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Evidence { get; set; } = string.Empty;
    }
}
