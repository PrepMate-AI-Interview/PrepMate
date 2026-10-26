using System.Text;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Interview
{
    /// <summary>
    /// Closing statement generation and closing interaction analysis prompts.
    /// </summary>
    public static class ClosingPrompt
    {
        public static string BuildClosingStatementPrompt(Session session)
        {
            var context = session.InterviewContext;
            var lang = session.Language ?? context?.Language ?? InterviewLanguage.Vietnamese;

            var schema = """
{
  "closingStatement": "Lời phát biểu kết thúc phỏng vấn hoàn chỉnh, lịch sự, chuyên nghiệp",
  "nextStepKnown": false
}
""";

            return $$"""
{{PromptLanguagePolicy.GetInstruction(lang)}}

{{PromptGroundingPolicy.Instruction}}

Bạn là người phỏng vấn chuyên nghiệp đang đưa ra lời phát biểu tổng kết chính thức kết thúc buổi phỏng vấn.
- Vị trí ứng tuyển: {{session.JobTitle ?? context?.TargetPosition ?? "Ứng viên"}}
- Tên ứng viên: {{context?.FullName ?? "bạn"}}

YÊU CẦU ĐỐI VỚI LỜI KẾT THÚC:
1. Ghi nhận và cảm ơn chân thành sự chuẩn bị cùng thời gian ứng viên đã dành cho buổi phỏng vấn hôm nay.
2. Xác nhận tất cả các phần trao đổi (chuyên môn, tình huống, hành vi, giải đáp thắc mắc) đã hoàn tất.
3. Nêu rõ kết quả đánh giá năng lực toàn diện sẽ được hội đồng tuyển dụng tổng hợp và phản hồi theo quy trình chuẩn.
4. TUYỆT ĐỐI KHÔNG hứa hẹn mốc thời gian cụ thể chưa được xác thực (ví dụ không nói 'HR sẽ gọi lúc 9h sáng mai').
5. Giữ phong thái lịch sự, ấm áp, đĩnh đạc và chuyên nghiệp.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }

        public static string BuildClosingAnalysisPrompt(Session session, string candidateFinalStatement)
        {
            var lang = session.Language ?? session.InterviewContext?.Language ?? InterviewLanguage.Vietnamese;

            var schema = """
{
  "professionalism": "High | Medium | Low",
  "engagement": "High | Medium | Low",
  "closingQuality": "High | Medium | Low",
  "unresolvedQuestions": ["Các câu hỏi còn tồn đọng nếu có"]
}
""";

            return $$"""
{{PromptLanguagePolicy.GetInstruction(lang)}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là chuyên gia phân tích ngữ nghĩa phỏng vấn, đánh giá phát biểu cuối cùng của ứng viên ở giai đoạn KẾT THÚC (CLOSING).

Phát biểu cuối cùng của ứng viên:
{{PromptContextBoundary.Wrap("FINAL_STATEMENT", candidateFinalStatement)}}

Nhiệm vụ: Đánh giá tính chuyên nghiệp, thái độ và mức độ tương tác của ứng viên.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
