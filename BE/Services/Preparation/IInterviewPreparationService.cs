using backend.Models;

namespace backend.Services.Preparation
{
    public interface IInterviewPreparationService
    {
        InterviewPreparationPlan GeneratePreparationPlan(Session session, FinalInterviewEvaluation evaluation);
    }
}
