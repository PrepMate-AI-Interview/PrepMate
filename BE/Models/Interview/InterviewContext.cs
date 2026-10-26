using System.Collections.Generic;

namespace backend.Models
{
    /// <summary>
    /// Compact candidate context used by the Adaptive Interview Engine.
    /// This context is built once before the interview and reused during the session.
    /// </summary>
    public class InterviewContext
    {
        // Candidate basic information
        public string FullName { get; set; } = string.Empty;
        public string Major { get; set; } = string.Empty;
        public string Specialization { get; set; } = string.Empty;
        public string ExperienceLevel { get; set; } = string.Empty;

        // Target
        public string TargetPosition { get; set; } = string.Empty;
        public string TargetCompany { get; set; } = string.Empty;

        // Job description
        public string JdText { get; set; } = string.Empty;

        // Candidate skills extracted from profile/CV
        public List<string> Skills { get; set; } = new();

        // Important topics extracted from CV/projects
        public List<string> CvTopics { get; set; } = new();

        // Topics that should be assessed for the target position
        public List<string> TargetTopics { get; set; } = new();
        public string Industry { get; set; } = string.Empty;

        public List<string> CandidateTopics { get; set; } = new();

        public List<string> ExpectedTopics { get; set; } = new();

        public List<string> InterviewDimensions { get; set; } = new();

        // Short CV summary.
        // Keep this compact to reduce Gemini token usage.
        public string CvSummary { get; set; } = string.Empty;

        // Interviewer Persona
        public InterviewerPersona Persona { get; set; } = new();

        // Phase 2: Company Intelligence & Knowledge Blueprint
        public KnowledgeBlueprint? KnowledgeBlueprint { get; set; }
        public CompanyContext? CompanyContext { get; set; }

        // Phase 2 Step 7: Interview Strategy & Coverage Planning
        public InterviewStrategy? Strategy { get; set; }

        // Phase 4 Step 5: Multi-Industry Interview Blueprint
        public InterviewBlueprint? InterviewBlueprint { get; set; }

        // Language Contract - Single Source of Truth
        public string Language { get; set; } = InterviewLanguage.Vietnamese;
    }
}