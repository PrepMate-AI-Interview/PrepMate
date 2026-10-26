using System.Collections.Generic;

namespace backend.Models
{
    public class CandidateQuestionEvidence
    {
        public string QuestionText { get; set; } = string.Empty;
        public string Category { get; set; } = "OTHER"; // ROLE, TEAM, TECHNICAL, PRODUCT, BUSINESS, GROWTH, CULTURE, PERFORMANCE, PROCESS, COMPENSATION, WORKING_MODEL, OTHER
        public string Specificity { get; set; } = "Medium"; // High, Medium, Low
        public string Relevance { get; set; } = "Medium"; // High, Medium, Low
        public string RoleUnderstanding { get; set; } = "Unclear"; // Strong, Moderate, Weak, Unclear
        public string CompanyUnderstanding { get; set; } = "Unclear"; // Strong, Moderate, Weak, Unclear
        public string GrowthOrientation { get; set; } = "Unclear"; // Strong, Moderate, Weak, Unclear
        public string TechnicalCuriosity { get; set; } = "Unclear"; // Strong, Moderate, Weak, Unclear
        public string TeamAwareness { get; set; } = "Unclear"; // Strong, Moderate, Weak, Unclear
        public string StrategicThinking { get; set; } = "Unclear"; // Strong, Moderate, Weak, Unclear
        public string CandidateIntent { get; set; } = string.Empty;
        public string EvidenceStrength { get; set; } = "Insufficient"; // Strong, Moderate, Weak, Insufficient
        public List<string> Claims { get; set; } = new();
        public List<string> UnclearElements { get; set; } = new();
        public bool IsRefusalOrNoQuestions { get; set; } = false;
    }
}
