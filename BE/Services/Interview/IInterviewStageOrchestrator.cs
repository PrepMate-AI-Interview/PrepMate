using backend.Models;

namespace backend.Services.Interview
{
    public interface IInterviewStageOrchestrator
    {
        InterviewStage GetCurrentStage(Session session);
        InterviewStage GetNextStage(InterviewStage currentStage);
        bool IsStageComplete(Session session, InterviewStage stage, InterviewStageBudget? budget = null);
        StageTransitionResult EvaluateTransition(Session session, InterviewStageBudget? customBudget = null);
        void ApplyTransition(Session session, InterviewStage targetStage, string reason = "");
        string GetStageTransitionMessage(InterviewStage fromStage, InterviewStage toStage);
    }
}
