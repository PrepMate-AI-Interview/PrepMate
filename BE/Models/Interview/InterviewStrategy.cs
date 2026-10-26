using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace backend.Models
{
    public class InterviewConceptStrategy
    {
        public string ConceptId { get; set; } = string.Empty;
        public string ConceptName { get; set; } = string.Empty;
        public RequirementSource RequirementSource { get; set; } = RequirementSource.OFFICIAL;
        public bool IsMandatory { get; set; } = true;
        public int Priority { get; set; } = 1; // 1 = Highest, 2 = Medium, 3 = Lower
        public double? WeightPercentage { get; set; }
        public ConceptCoverageStatus MinimumCoverage { get; set; } = ConceptCoverageStatus.PARTIAL;
        public int MinQuestionBudget { get; set; } = 1;
        public int MaxQuestionBudget { get; set; } = 3;
        public int QuestionsAsked { get; set; } = 0;
    }

    public class InterviewAreaStrategy
    {
        public string AreaName { get; set; } = string.Empty;
        public AreaImportance Importance { get; set; } = AreaImportance.HIGH;
        public double WeightPercentage { get; set; } = 0.0;
        public int AllocatedQuestionBudget { get; set; } = 0;
        public List<InterviewConceptStrategy> Concepts { get; set; } = new();
    }

    public class InterviewStrategy
    {
        public int TotalQuestionBudget { get; set; } = 15;
        public int TargetDurationMinutes { get; set; } = 30;
        public string CandidateLevel { get; set; } = "Middle";
        public List<InterviewAreaStrategy> Areas { get; set; } = new();

        public InterviewConceptStrategy? FindConceptStrategy(string? conceptIdOrName)
        {
            if (string.IsNullOrWhiteSpace(conceptIdOrName) || Areas == null)
                return null;

            foreach (var area in Areas)
            {
                if (area?.Concepts == null) continue;
                foreach (var c in area.Concepts)
                {
                    if (string.Equals(c.ConceptId, conceptIdOrName, System.StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(c.ConceptName, conceptIdOrName, System.StringComparison.OrdinalIgnoreCase))
                    {
                        return c;
                    }
                }
            }
            return null;
        }
    }
}
