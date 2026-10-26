using System.Collections.Generic;

namespace backend.Models
{
    public class TargetEvaluationContext
    {
        public string AreaName { get; set; } = string.Empty;
        public string ConceptId { get; set; } = string.Empty;
        public string ConceptName { get; set; } = string.Empty;
        public List<string> ExpectedUnderstanding { get; set; } = new();
        public List<string> PracticalSignals { get; set; } = new();
        public List<string> FailureSignals { get; set; } = new();
        public RequirementSource RequirementSource { get; set; } = RequirementSource.OFFICIAL;
        public AreaImportance AreaImportance { get; set; } = AreaImportance.HIGH;
        public bool IsMandatory { get; set; } = true;
        public ConceptCoverageStatus CoverageStatus { get; set; } = ConceptCoverageStatus.NOT_TESTED;
        public string MissingEvidence { get; set; } = string.Empty;
        public string PreviousRelevantEvidence { get; set; } = string.Empty;
        public List<string> ContextualSignals { get; set; } = new();
        public List<string> CompanyRelevance { get; set; } = new();

        // Repository support fields (Phase 2 - Step 8)
        public List<string> QuestionPatterns { get; set; } = new();
        public List<string> ReferenceScenarios { get; set; } = new();
        public List<KnowledgeRepositoryItem> RepositoryItems { get; set; } = new();
    }
}
