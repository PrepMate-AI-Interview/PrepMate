using System.Threading.Tasks;
using backend.Models;

namespace backend.Services.Interview
{
    public interface IBehavioralInterviewService
    {
        Task<GeneratedQuestion> GenerateQuestionAsync(Session session, BehavioralEvidence? previousEvidence = null);
        Task<BehavioralEvidence> AnalyzeAnswerAsync(Session session, string question, string answer, string? parentQuestionId = null);
    }
}
