using backend.Models;

namespace backend.Services.Evaluation
{
    public interface IFinalEvaluationService
    {
        FinalInterviewEvaluation EvaluateSession(Session session);
    }
}
