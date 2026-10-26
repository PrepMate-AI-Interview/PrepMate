using backend.Models;

namespace backend.Services.Evaluation
{
    public interface IEvidenceReportService
    {
        InterviewReport ProjectReport(FinalInterviewEvaluation evaluation, Session session);
    }
}
