namespace backend.Models
{
    public class GeneratedQuestion
    {
        public string Question { get; set; } = "";

        public string Topic { get; set; } = "";

        public string Subtopic { get; set; } = "";

        public string Dimension { get; set; } = "";

        public string QuestionType { get; set; } = "";

        public int Difficulty { get; set; } = 1;

        public string TargetConcept { get; set; } = "";

        public string DecisionUsed { get; set; } = "";

        public bool IsFollowUp { get; set; } = false;

        public string ConversationalTransition { get; set; } = "";

        public string ChallengeTrigger { get; set; } = "";

        public string Reason { get; set; } = "";

        // Phase 4 Step 2: Multi-Stage metadata
        public string QuestionId { get; set; } = System.Guid.NewGuid().ToString();

        public string? ParentQuestionId { get; set; }

        public string Stage { get; set; } = "TECHNICAL_ASSESSMENT";

        // Phase 4 Step 3: Behavioral & Situational metadata
        public string? Competency { get; set; }

        public string? Category { get; set; }
    }
}