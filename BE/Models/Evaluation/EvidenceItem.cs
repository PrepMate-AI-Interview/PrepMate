using System;

namespace backend.Models
{
    public class EvidenceItem
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string ConceptId { get; set; } = string.Empty;
        public string ConceptName { get; set; } = string.Empty;
        public int TurnIndex { get; set; }
        public EvidenceType Type { get; set; } = EvidenceType.OBSERVED;
        public string Description { get; set; } = string.Empty;
        public int Depth { get; set; }
        public bool ShowsPracticalExperience { get; set; }
        public RequirementSource SourceReliability { get; set; } = RequirementSource.OFFICIAL;
        public EvaluationConfidence Confidence { get; set; } = EvaluationConfidence.MEDIUM;
        public DateTime ObservedAt { get; set; } = DateTime.UtcNow;
    }
}
