namespace backend.Models
{
    public class InterviewerAnswerResult
    {
        public string Answer { get; set; } = string.Empty;
        public string GroundingSource { get; set; } = "SafeUnknown"; // ExplicitCompanyContext, JobDescription, KnowledgeBlueprint, SessionContext, SafeUnknown
        public bool IsSafeFallback { get; set; } = false;
        public string? FollowUpQuestion { get; set; }
        public CandidateQuestionEvidence? Evidence { get; set; }
    }
}
