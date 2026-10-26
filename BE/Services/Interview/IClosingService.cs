using System.Threading.Tasks;
using backend.Models;

namespace backend.Services.Interview
{
    public interface IClosingService
    {
        Task<ClosingResult> GenerateClosingStatementAsync(Session session);
        Task<ClosingEvidence> AnalyzeClosingResponseAsync(Session session, string candidateFinalStatement);
    }
}
