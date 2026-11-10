using System;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Interview
{
    /// <summary>
    /// Prompt for analyzing candidate introduction at interview start.
    /// Extracts mentioned concepts, validates claims, and identifies high-value follow-up candidates.
    /// </summary>
    public static class IntroductionPrompt
    {
        public static string Build(
            string targetPosition,
            string introduction,
            string? language = InterviewLanguage.Vietnamese)
        {
            var langInstruction = PromptLanguagePolicy.GetInstruction(language);

            var schema = """
{
  "concepts": ["Tất cả khái niệm, công nghệ hoặc nghiệp vụ được ứng viên nêu"],
  "correctConcepts": ["Khái niệm ứng viên thể hiện hiểu biết chính xác"],
  "missingConcepts": [],
  "incorrectConcepts": ["Khái niệm có dấu hiệu hiểu sai hoặc nhầm lẫn"],
  "depth": 1,
  "confidence": 0.9,
  "followUpCandidates": ["Tối đa 3 khái niệm tiềm năng để hỏi sâu tiếp"],
  "summary": "Tóm tắt ngắn gọn phần giới thiệu",
  "doesNotKnow": false,
  "mainConcept": "Khái niệm hoặc chuyên môn nổi bật nhất",
  "answerType": "INTRODUCTION",
  "evidence": ["Dữ kiện thực tế đã được chứng minh"],
  "assumptions": [],
  "needsClarification": false,
  "showsPracticalExperience": false
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là hệ thống phân tích nội bộ đánh giá phần giới thiệu của ứng viên trong một buổi phỏng vấn tuyển dụng thực tế.
- Bạn KHÔNG phải interviewer trực tiếp.
- Bạn KHÔNG tạo câu hỏi phỏng vấn.
- Bạn KHÔNG viết feedback hoặc chấm điểm ứng viên.

====================
THÔNG TIN VỊ TRÍ
====================
Vị trí ứng tuyển: {{targetPosition}}

====================
NỘI DUNG GIỚI THIỆU CỦA ỨNG VIÊN
====================
{{PromptContextBoundary.Wrap("CANDIDATE_INTRODUCTION", introduction)}}

====================
NHIỆM VỤ PHÂN TÍCH
====================
1. Xác định các concept, kỹ năng, công nghệ, kinh nghiệm hoặc dự án mà ứng viên THỰC SỰ đề cập.
2. Xác định những concept ứng viên thể hiện có hiểu biết chính xác (correctConcepts).
3. Xác định những concept có dấu hiệu sai hoặc nhầm lẫn (incorrectConcepts).
4. Chọn tối đa 3 concept phù hợp nhất để interviewer đào sâu tiếp theo (followUpCandidates).
5. TUYỆT ĐỐI KHÔNG tự tạo ra kinh nghiệm, công nghệ hoặc số liệu mà ứng viên chưa nói.
6. Nếu ứng viên chỉ giới thiệu bản thân chung chung mà không nêu kiến thức cụ thể, hãy phản ánh trung thực điều đó.

QUY ƯỚC DEPTH:
1 = basic (nêu khái niệm chung)
2 = intermediate (hiểu cơ chế, cách áp dụng)
3 = advanced (kinh nghiệm thực chiến sâu sắc)
4 = expert (quy mô lớn, tối ưu hóa hệ thống)

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }

        public static string BuildUnifiedIntroductionAndFirstQuestion(
            InterviewContext context,
            InterviewState state,
            string introduction,
            string? language = InterviewLanguage.Vietnamese)
        {
            var persona = context.Persona ?? InterviewerPersona.CreateDefault(context.TargetPosition);
            var langInstruction = PromptLanguagePolicy.GetInstruction(language);

            var skills = (context.Skills != null && context.Skills.Count > 0)
                ? string.Join(", ", context.Skills)
                : "Chưa cung cấp";

            var schema = """
{
  "analysis": {
    "concepts": ["Tất cả khái niệm, công nghệ hoặc nghiệp vụ được ứng viên nêu"],
    "correctConcepts": ["Khái niệm ứng viên thể hiện hiểu biết chính xác"],
    "missingConcepts": [],
    "incorrectConcepts": ["Khái niệm có dấu hiệu hiểu sai hoặc nhầm lẫn"],
    "depth": 2,
    "confidence": 0.9,
    "followUpCandidates": ["Tối đa 3 khái niệm tiềm năng để hỏi sâu tiếp"],
    "summary": "Tóm tắt ngắn gọn phần giới thiệu",
    "doesNotKnow": false,
    "mainConcept": "Khái niệm hoặc chuyên môn nổi bật nhất",
    "answerType": "INTRODUCTION",
    "needsClarification": false,
    "showsPracticalExperience": true
  },
  "firstQuestion": {
    "question": "Nội dung câu hỏi phỏng vấn hoàn chỉnh mở đầu bằng lời ghi nhận tự nhiên, kết nối chặt chẽ với những gì ứng viên vừa tự giới thiệu",
    "conversationalTransition": "Cảm ơn phần giới thiệu của bạn",
    "topic": "Chủ đề chuyên môn chính",
    "subtopic": "Khía cạnh kỹ thuật cụ thể cần khai thác",
    "dimension": "Technical",
    "questionType": "EXPERIENCE",
    "difficulty": 1,
    "targetConcept": "Khái niệm hoặc kỹ năng trọng tâm",
    "reason": "Lý do lựa chọn câu hỏi mở đầu"
  }
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn đóng vai trò kép trong hệ thống phỏng vấn AI:
1. Phân tích nội dung giới thiệu của ứng viên.
2. Đóng vai Người phỏng vấn (Interviewer) để sinh ĐÚNG MỘT câu hỏi chuyên môn đầu tiên mở đầu buổi phỏng vấn một cách tự nhiên và mạch lạc.

====================
THÔNG TIN VỊ TRÍ & NGƯỜI PHỎNG VẤN
====================
- Vị trí ứng tuyển: {{context.TargetPosition}}
- Doanh nghiệp mục tiêu: {{context.TargetCompany}}
- Ngành nghề: {{context.Industry}}
- Người phỏng vấn: {{persona.Role}} (Phong cách: {{persona.CommunicationStyle}})
- Kỹ năng ứng viên: {{skills}}

====================
NỘI DUNG GIỚI THIỆU CỦA ỨNG VIÊN
====================
{{PromptContextBoundary.Wrap("CANDIDATE_INTRODUCTION", introduction)}}

====================
NHIỆM VỤ THỰC HIỆN
====================
1. Phân tích phần giới thiệu: xác định các concept, công nghệ, kỹ năng mà ứng viên THỰC SỰ nhắc tới. Đánh giá depth từ 1 (cơ bản) đến 4 (chuyên gia). Tóm tắt ngắn gọn 1 câu.
2. Sinh câu hỏi phỏng vấn chuyên môn đầu tiên:
   - Mở đầu bằng lời dẫn dắt tự nhiên, lịch sự ghi nhận nội dung ứng viên vừa giới thiệu (1 câu).
   - Đi thẳng vào một dự án, bài toán hoặc kỹ năng nổi bật mà ứng viên vừa nêu (1-2 câu). Sắc bén, trực diện.
   - TUYỆT ĐỐI KHÔNG tự bịa đặt công nghệ hay số liệu mà ứng viên chưa nói.
   - Giọng điệu chuyên nghiệp, tự nhiên, đĩnh đạc.
   - YÊU CẦU ĐỘ DÀI: Viết súc tích, cô đọng, tránh văn phong dài dòng để tối ưu tốc độ phản hồi. Mỗi danh sách tối đa 2-3 mục chính yếu nhất.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
