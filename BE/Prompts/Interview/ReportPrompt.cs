using System;

namespace backend.Prompts.Interview
{
    /// <summary>
    /// Backward-compatible facade for Interview Report Prompt.
    /// Delegates directly to backend.Prompts.Reports.ReportPrompt.
    /// </summary>
    public static class ReportPrompt
    {
        public static string Build(string jobTitle, string langInstruction, string qaTranscript)
        {
            return backend.Prompts.Reports.ReportPrompt.Build(jobTitle, langInstruction, qaTranscript);
        }
    }
}
