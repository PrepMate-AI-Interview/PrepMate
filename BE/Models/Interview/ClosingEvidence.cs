using System.Collections.Generic;

namespace backend.Models
{
    public class ClosingEvidence
    {
        public bool Completed { get; set; } = true;
        public string Professionalism { get; set; } = "Medium"; // High, Medium, Low
        public string Engagement { get; set; } = "Medium"; // High, Medium, Low
        public string ClosingQuality { get; set; } = "Medium"; // High, Medium, Low
        public string CandidateFinalStatement { get; set; } = string.Empty;
        public List<string> UnresolvedQuestions { get; set; } = new();
        public bool NextStepKnown { get; set; } = false;
        public string EvidenceStrength { get; set; } = "Moderate"; // Strong, Moderate, Weak, Insufficient
    }
}
