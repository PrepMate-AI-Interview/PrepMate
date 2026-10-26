using System.Threading.Tasks;
using backend.Models;

namespace backend.Services.Interview
{
    public interface ICandidateQuestionService
    {
        Task<InterviewerAnswerResult> ProcessCandidateQuestionAsync(Session session, string candidateQuestion);
        Task<CandidateQuestionEvidence> AnalyzeQuestionEvidenceAsync(Session session, string candidateQuestion);
    }
}
