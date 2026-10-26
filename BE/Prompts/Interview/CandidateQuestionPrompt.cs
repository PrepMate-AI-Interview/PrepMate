using System;
using System.Linq;
using System.Text;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Interview
{
    /// <summary>
    /// Prompt for responding to candidate questions and extracting candidate curiosity/depth evidence.
    /// Strictly respects verified company facts, avoids fabricating HR policies or compensation, and aligns with language policy.
    /// </summary>
    public static class CandidateQuestionPrompt
    {
        public static string BuildPrompt(Session session, string candidateQuestion)
        {
            var sb = new StringBuilder();
            var context = session.InterviewContext;
            var company = context?.CompanyContext;
            var bp = context?.KnowledgeBlueprint;
            var lang = session.Language ?? context?.Language ?? InterviewLanguage.Vietnamese;

            sb.AppendLine(PromptLanguagePolicy.GetInstruction(lang));
            sb.AppendLine();
            sb.AppendLine(PromptGroundingPolicy.Instruction);
            sb.AppendLine();
            sb.AppendLine(PromptContextBoundary.SecurityDisclaimer);
            sb.AppendLine();
            sb.AppendLine("Bạn là một người phỏng vấn giàu kinh nghiệm trên PrepMate.");
            sb.AppendLine("Buổi phỏng vấn đã chuyển sang giai đoạn DÀNH CHO ỨNG VIÊN ĐẶT CÂU HỎI (CANDIDATE_QUESTIONS).");
            sb.AppendLine("Ứng viên vừa đặt một câu hỏi cho bạn. Bạn phải thực hiện 2 nhiệm vụ:");
            sb.AppendLine("1. Đưa ra câu trả lời tự nhiên, chuyên nghiệp, đĩnh đạc, dựa CHẶT CHẼ trên NGỮ CẢNH ĐÃ XÁC THỰC.");
            sb.AppendLine("2. Phân tích câu hỏi của ứng viên để trích xuất các bằng chứng năng lực có cấu trúc.");
            sb.AppendLine();
            sb.AppendLine("=== THÔNG TIN NGỮ CẢNH ĐÃ XÁC THỰC ===");
            sb.AppendLine($"Vị trí ứng tuyển: {session.JobTitle ?? context?.TargetPosition ?? ProfessionalDomainClassifier.DefaultPositionTitle}");
            sb.AppendLine($"Cấp bậc: {context?.ExperienceLevel ?? "Mid"}");
            sb.AppendLine($"Tên công ty: {context?.TargetCompany ?? company?.CompanyName ?? "Công ty"}");

            if (!string.IsNullOrWhiteSpace(company?.Industry))
            {
                sb.AppendLine($"Ngành nghề: {company.Industry}");
            }
            if (company?.KnownFacts?.Count > 0)
            {
                sb.AppendLine("Dữ kiện đã xác thực về công ty:");
                foreach (var f in company.KnownFacts)
                {
                    sb.AppendLine($"- {f.Information}");
                }
            }

            if (!string.IsNullOrWhiteSpace(session.JdText))
            {
                var jdSnippet = session.JdText.Length > 800 ? session.JdText.Substring(0, 800) + "..." : session.JdText;
                sb.AppendLine(PromptContextBoundary.Wrap("JOB_DESCRIPTION", jdSnippet));
            }

            if (bp?.Areas?.Count > 0)
            {
                sb.AppendLine("Khu vực chuyên môn / Blueprint Areas:");
                foreach (var a in bp.Areas)
                {
                    var cNames = a.Concepts != null ? string.Join(", ", a.Concepts.Select(c => c.Name)) : "";
                    sb.AppendLine($"- {a.Name}: {cNames}");
                }
            }

            sb.AppendLine();
            sb.AppendLine("=== NGUYÊN TẮC PHẢN HỒI ===");
            sb.AppendLine("1. TUYỆT ĐỐI KHÔNG tự bịa đặt mức lương cụ thể, thưởng, phụ cấp hay chính sách nội bộ chưa có trong ngữ cảnh.");
            sb.AppendLine("2. Nếu ứng viên hỏi về mức lương/đãi ngộ mà không có trong ngữ cảnh, câu trả lời BẮT BUỘC phải nói rõ bạn chưa có con số chính xác và khuyên ứng viên trao đổi cụ thể với bộ phận HR.");
            sb.AppendLine("3. Nếu ứng viên hỏi về các chính sách chưa được liệt kê, hãy lịch sự giải thích bạn không nắm thông tin chi tiết đó trong phạm vi phỏng vấn chuyên môn.");
            sb.AppendLine();
            sb.AppendLine("Câu hỏi của ứng viên:");
            sb.AppendLine(PromptContextBoundary.Wrap("CANDIDATE_QUESTION", candidateQuestion));
            sb.AppendLine();

            var schema = """
{
  "answer": "Câu trả lời tự nhiên, có căn cứ của người phỏng vấn",
  "groundingSource": "ExplicitCompanyContext | JobDescription | KnowledgeBlueprint | SessionContext | SafeUnknown",
  "isSafeFallback": false,
  "followUpQuestion": "Câu hỏi tương tác ngắn gọn tiếp theo hoặc để trống",
  "category": "ROLE | TEAM | TECHNICAL | PRODUCT | BUSINESS | GROWTH | CULTURE | PERFORMANCE | PROCESS | COMPENSATION | WORKING_MODEL | OTHER",
  "specificity": "High | Medium | Low",
  "relevance": "High | Medium | Low",
  "roleUnderstanding": "Strong | Moderate | Weak | Unclear",
  "companyUnderstanding": "Strong | Moderate | Weak | Unclear",
  "growthOrientation": "Strong | Moderate | Weak | Unclear",
  "technicalCuriosity": "Strong | Moderate | Weak | Unclear",
  "teamAwareness": "Strong | Moderate | Weak | Unclear",
  "strategicThinking": "Strong | Moderate | Weak | Unclear",
  "candidateIntent": "Tóm tắt ngắn gọn mục đích câu hỏi của ứng viên",
  "claims": []
}
""";
            sb.AppendLine(PromptOutputPolicy.GetJsonContract(schema));

            return sb.ToString();
        }
    }
}
