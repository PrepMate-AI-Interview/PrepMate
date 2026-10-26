using System.Threading.Tasks;
using backend.Models;

namespace backend.Services.Interview
{
    public interface ISituationalInterviewService
    {
        Task<GeneratedQuestion> GenerateScenarioAsync(Session session, SituationalEvidence? previousEvidence = null);
        Task<SituationalEvidence> AnalyzeAnswerAsync(Session session, string scenario, string answer, string? parentQuestionId = null);
    }
}
