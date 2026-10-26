using System.Collections.Generic;

namespace backend.Models
{
    public class SituationalEvidence
    {
        public string Scenario { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty; // "DeadlineConflict", "ProductionIncident", "TeamConflict", "AmbiguousRequirement", "EthicalDilemma", "ScopeChange"
        public string ProblemUnderstanding { get; set; } = string.Empty;
        public string Prioritization { get; set; } = string.Empty;
        public string DecisionMaking { get; set; } = string.Empty;
        public string Communication { get; set; } = string.Empty;
        public string RiskAwareness { get; set; } = string.Empty;
        public string TradeoffAwareness { get; set; } = string.Empty;
        public string Ownership { get; set; } = "Unclear"; // "High", "Medium", "Low", "Unclear"
        public string EscalationJudgment { get; set; } = string.Empty;
        public string EvidenceStrength { get; set; } = "Insufficient"; // "Strong", "Moderate", "Weak", "Insufficient"
        public List<string> ActionPlan { get; set; } = new();
        public List<string> MissingEvidence { get; set; } = new();
        public List<string> Claims { get; set; } = new();
        public List<string> Contradictions { get; set; } = new();
        public string ReasoningQuality { get; set; } = "Medium"; // "High", "Medium", "Low"
    }
}
