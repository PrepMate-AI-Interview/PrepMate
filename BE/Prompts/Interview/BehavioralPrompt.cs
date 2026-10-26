using System;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Interview
{
    /// <summary>
    /// STAR behavioral interview evidence extraction and question refinement prompts.
    /// </summary>
    public static class BehavioralPrompt
    {
        public static string BuildAnalysisPrompt(
            string position,
            string seniority,
            string competency,
            string question,
            string answer,
            string priorContext = "",
            string? language = InterviewLanguage.Vietnamese)
        {
            var langInstruction = PromptLanguagePolicy.GetInstruction(language);

            var schema = """
{
  "situation": "Tóm tắt bối cảnh tình huống thực tế nếu có, hoặc để trống",
  "task": "Tóm tắt nhiệm vụ/mục tiêu cá nhân nếu có, hoặc để trống",
  "action": "Tóm tắt hành động cá nhân cụ thể của ứng viên, hoặc để trống",
  "result": "Tóm tắt kết quả/tác động đạt được nếu có, hoặc để trống",
  "reflection": "Tóm tắt bài học kinh nghiệm tự rút ra nếu có, hoặc để trống",
  "ownership": "High | Medium | Low | Unclear",
  "specificity": "High | Medium | Low",
  "evidenceStrength": "Strong | Moderate | Weak | Insufficient",
  "missingComponents": ["TASK", "RESULT"],
  "claims": ["Các khẳng định chưa được chứng minh"],
  "contradictions": ["Các điểm mâu thuẫn nếu có"],
  "competency": "Tên năng lực đang đánh giá"
}
""";

            var priorSection = !string.IsNullOrWhiteSpace(priorContext)
                ? PromptContextBoundary.Wrap("PRIOR_STORY_CONTEXT", priorContext)
                : string.Empty;

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là bộ phận trích xuất bằng chứng (Evidence Extraction) cho vòng phỏng vấn hành vi (Behavioral Interview - STAR framework).
- Bạn KHÔNG được tự quyết định điểm số hay xếp loại ứng viên.
- Nhiệm vụ duy nhất: Phân tích khách quan câu trả lời của ứng viên để trích xuất các thành phần STAR, quyền sở hữu (ownership), độ cụ thể và các thành phần còn thiếu.

====================
THÔNG TIN VỊ TRÍ & NĂNG LỰC
====================
Vị trí: {{position}}
Cấp bậc: {{seniority}}
Năng lực hành vi trọng tâm: {{competency}}

====================
CÂU HỎI VÀ CÂU TRẢ LỜI
====================
Câu hỏi của người phỏng vấn:
{{question}}

Câu trả lời của ứng viên:
{{PromptContextBoundary.Wrap("CANDIDATE_ANSWER", answer)}}

{{priorSection}}

====================
QUY TẮC PHÂN TÍCH STAR
====================
1. Situation (Bối cảnh): Ứng viên có mô tả bối cảnh dự án, môi trường, hoặc vấn đề phát sinh không?
2. Task (Nhiệm vụ): Trách nhiệm cụ thể của cá nhân ứng viên là gì, mục tiêu hoặc ràng buộc ra sao?
3. Action (Hành động): Ứng viên đã trực tiếp làm gì?
   - Phân biệt rõ "Tôi làm..." (hành động cá nhân) với "Team chúng tôi..." (công việc chung của tập thể).
   - Nếu chỉ nói chung chung "chúng tôi đã làm" mà không rõ phần đóng góp cá nhân, ghi nhận ownership là Low hoặc Unclear.
4. Result (Kết quả): Kết quả đạt được là gì (đo lường được, cải thiện quy trình, tác động nghiệp vụ, bài học)?
   - Không bắt buộc phải có số liệu chính xác nếu ứng viên nói thật thà là không nhớ con số.
5. Reflection (Bài học/Nhìn lại): Ứng viên có tự rút ra kinh nghiệm cải tiến nếu làm lại không?
6. MissingComponents: Danh sách các thành phần còn thiếu trong ["SITUATION", "TASK", "ACTION", "RESULT", "REFLECTION"].
   - Lưu ý: Không đánh giá tiêu cực chỉ vì câu trả lời ngắn nếu ứng viên trả lời chân thực.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }

        public static string BuildQuestionRefinementPrompt(
            string position,
            string seniority,
            string competency,
            string baseQuestion,
            string? language = InterviewLanguage.Vietnamese)
        {
            var langInstruction = PromptLanguagePolicy.GetInstruction(language);

            return $$"""
{{langInstruction}}

Bạn là chuyên gia phỏng vấn chuyên nghiệp.
Hãy diễn đạt lại câu hỏi hành vi sau đây sao cho tự nhiên, lịch sự, đĩnh đạc và phù hợp với vị trí {{position}} (cấp bậc {{seniority}}), năng lực đánh giá: {{competency}}.

Câu hỏi gốc:
"{{baseQuestion}}"

YÊU CẦU:
1. Giữ nguyên mục tiêu đánh giá năng lực của câu hỏi gốc.
2. Diễn đạt gãy gọn, tự nhiên, không mang tính chất đọc câu hỏi trong sách vở.
3. Chỉ trả về DUY NHẤT một câu hỏi hoàn chỉnh, không kèm bất kỳ lời giải thích, định dạng hay markdown thừa.
""";
        }
    }
}
