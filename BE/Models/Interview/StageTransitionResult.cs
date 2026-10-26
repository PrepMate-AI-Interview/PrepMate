namespace backend.Models
{
    public class StageTransitionResult
    {
        public bool HasTransitioned { get; set; } = false;
        public InterviewStage FromStage { get; set; }
        public InterviewStage ToStage { get; set; }
        public string TransitionMessage { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public bool IsFinished { get; set; } = false;

        public static StageTransitionResult NoChange(InterviewStage currentStage)
        {
            return new StageTransitionResult
            {
                HasTransitioned = false,
                FromStage = currentStage,
                ToStage = currentStage,
                IsFinished = currentStage == InterviewStage.COMPLETED
            };
        }

        public static StageTransitionResult Transition(InterviewStage from, InterviewStage to, string reason, string message = "", bool isFinished = false)
        {
            return new StageTransitionResult
            {
                HasTransitioned = true,
                FromStage = from,
                ToStage = to,
                Reason = reason,
                TransitionMessage = message,
                IsFinished = isFinished || to == InterviewStage.COMPLETED
            };
        }
    }
}
