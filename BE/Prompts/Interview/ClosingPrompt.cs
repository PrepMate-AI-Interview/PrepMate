using System;
using System.Linq;
using backend.Services.Interview;
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

            var lastAnswerObj = session.Answers?.LastOrDefault(a =>
                !string.Equals(a.Question, "Giới thiệu bản thân", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(a.Stage, InterviewStageNames.Introduction, StringComparison.OrdinalIgnoreCase));

            var lastQuestion = lastAnswerObj?.Question ?? (session.Questions != null && session.Questions.Count > 0 ? session.Questions[^1] : "Câu hỏi chuyên môn");
            var lastAnswer = lastAnswerObj?.Answer ?? string.Empty;
            var candidateName = context?.FullName ?? "bạn";
            var targetPosition = session.JobTitle ?? context?.TargetPosition ?? "Chuyên viên";
            var level = session.InterviewState?.CandidateLevel ?? "Mid";
            var topicsCovered = session.InterviewState?.TopicsCovered != null && session.InterviewState.TopicsCovered.Count > 0
                ? string.Join(", ", session.InterviewState.TopicsCovered)
                : "Kiến thức chuyên môn và kinh nghiệm thực chiến";

            var schema = """
{
  "closingStatement": "Lời phát biểu kết thúc tự nhiên, liên kết với câu trả lời vừa rồi, không có câu hỏi mới",
  "nextStepKnown": true
}
""";

            return $$"""
{{PromptLanguagePolicy.GetInstruction(lang)}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là người phỏng vấn AI chuyên nghiệp của PrepMate, đang thực hiện lượt phát biểu KẾT THÚC buổi phỏng vấn (CLOSING TURN).
Ứng viên vừa hoàn thành câu trả lời cho câu hỏi phỏng vấn thứ 5 (câu hỏi cuối cùng).

THÔNG TIN BUỔI PHỎNG VẤN:
- Vị trí ứng tuyển: {{targetPosition}} (Cấp độ: {{level}})
- Tên ứng viên: {{candidateName}}
- Các chủ đề đã trao đổi: {{topicsCovered}}

CÂU HỎI CUỐI CÙNG VỪA TRAO ĐỔI:
{{PromptContextBoundary.Wrap("LAST_QUESTION", lastQuestion)}}

CÂU TRẢ LỜI CỦA ỨNG VIÊN CHO CÂU HỎI CUỐI:
{{PromptContextBoundary.Wrap("LAST_ANSWER", lastAnswer)}}

YÊU CẦU CỐT LÕI CHO LỜI KẾT (BẮT BUỘC 3 THÀNH PHẦN):
1. [Thành phần A - Ghi nhận câu trả lời cuối]: Đề cập ngắn gọn đến một ý thực tế hoặc khía cạnh cụ thể mà ứng viên vừa chia sẻ trong LAST_ANSWER (ví dụ: cách xử lý vấn đề, quyết định kỹ thuật, quan điểm tiếp cận). Không khen ngợi sáo rỗng hay tâng bốc. Không bịa đặt thông tin ứng viên chưa nói. Nếu câu trả lời quá ngắn, cảm ơn chân thành quan điểm vừa chia sẻ.
2. [Thành phần B - Chuyển tiếp tự nhiên]: Tạo cảm giác cuộc trao đổi đã đi đến điểm kết thúc trọn vẹn, không tạo cảm giác đang hỏi tiếp hoặc bị cắt ngang đột ngột.
3. [Thành phần C - Kết thúc và thông báo bước tiếp theo]: Thông báo rõ ràng buổi phỏng vấn đến đây là kết thúc và PrepMate đang tổng hợp kết quả để chuẩn bị báo cáo đánh giá chi tiết.

QUY CÁCH ĐỘ DÀI & GIỌNG ĐIỆU:
- Độ dài mục tiêu: Đúng 2 đến 3 câu ngắn (khoảng 25 đến 55 từ).
- Giọng điệu ấm áp, tự nhiên, đĩnh đạc và chuyên nghiệp.

TUYỆT ĐỐI CẤM (STRICT NEGATIVE CONSTRAINTS):
- TUYỆT ĐỐI KHÔNG đặt thêm câu hỏi mới (không có dấu hỏi '?', không hỏi 'bạn có câu hỏi nào không', không gợi ý ứng viên trả lời tiếp).
- TUYỆT ĐỐI KHÔNG đưa ra điểm số, xếp loại hay nhận xét ứng viên đạt/trượt/giỏi/yếu trước khi scoring hoàn tất.
- TUYỆT ĐỐI KHÔNG dùng câu cụt lủn, máy móc như 'Hết câu hỏi. Kết thúc phỏng vấn.' hay 'Đã đủ 5 câu'.
- TUYỆT ĐỐI KHÔNG viết đoạn văn dài như bài văn nhận xét báo cáo.
- TUYỆT ĐỐI KHÔNG in hay nhắc đến trạng thái kỹ thuật (FSM, SessionId, QuestionCount, JSON...).

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
