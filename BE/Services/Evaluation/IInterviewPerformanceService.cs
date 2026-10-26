using backend.Models;

namespace backend.Services.Evaluation
{
    public interface IInterviewPerformanceService
    {
        InterviewPerformanceAssessment AnalyzePerformance(Session session, FinalInterviewEvaluation evaluation);
    }
}
