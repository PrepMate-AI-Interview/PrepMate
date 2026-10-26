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
    }
}
