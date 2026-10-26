using backend.Models;

namespace backend.Services.Evaluation
{
    public interface IImprovementRoadmapService
    {
        ImprovementRoadmap GenerateRoadmap(Session session, FinalInterviewEvaluation evaluation);
    }
}
