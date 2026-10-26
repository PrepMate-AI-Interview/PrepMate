using backend.Models;

namespace backend.Services.Evaluation
{
    public interface IDiagnosticAnalysisService
    {
        DiagnosticAnalysis AnalyzeSession(Session session, FinalInterviewEvaluation evaluation);
    }
}
