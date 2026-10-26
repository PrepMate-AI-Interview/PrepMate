using System.Collections.Generic;

namespace backend.Models
{
    public class BehavioralEvidence
    {
        public string Situation { get; set; } = string.Empty;
        public string Task { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string Result { get; set; } = string.Empty;
        public string Reflection { get; set; } = string.Empty;
        public string Ownership { get; set; } = "Unclear"; // "High", "Medium", "Low", "Unclear"
        public string Specificity { get; set; } = "Medium"; // "High", "Medium", "Low"
        public string EvidenceStrength { get; set; } = "Insufficient"; // "Strong", "Moderate", "Weak", "Insufficient"
        public List<string> MissingComponents { get; set; } = new(); // e.g. ["SITUATION", "TASK", "ACTION", "RESULT", "REFLECTION"]
        public List<string> Claims { get; set; } = new();
        public List<string> Contradictions { get; set; } = new();
        public string Competency { get; set; } = string.Empty; // "Conflict", "Failure", "Deadline", "Leadership", "Feedback", "Mistake", "Adaptation", "Collaboration"

        public bool IsComplete => !string.IsNullOrWhiteSpace(Situation) &&
                                  !string.IsNullOrWhiteSpace(Task) &&
                                  !string.IsNullOrWhiteSpace(Action) &&
                                  !string.IsNullOrWhiteSpace(Result);
    }
}
