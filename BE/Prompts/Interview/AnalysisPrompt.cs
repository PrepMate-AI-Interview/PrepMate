using System;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Interview
{
    /// <summary>
    /// Turn-by-turn answer analysis prompt.
    /// Extracts factual evidence, detects unverified claims, identifies contradictions,
    /// and classifies answer depth without scoring or fabricating data.
    /// </summary>
    public static class AnalysisPrompt
    {
        public static string Build(
            string targetPosition,
            string currentTopic,
            string currentSubtopic,
            string question,
            string answer,
            string priorHistory = "",
            string? language = InterviewLanguage.Vietnamese)
        {
            var historySection = string.IsNullOrWhiteSpace(priorHistory)
                ? "[Chưa có lịch sử các lượt trước]"
                : priorHistory.Trim();

            var langInstruction = PromptLanguagePolicy.GetInstruction(language);

            var schema = """
{
  "mainConcept": "Khái niệm kỹ thuật hoặc nghiệp vụ chính trong câu trả lời",
  "answerType": "DEFINITION | EXPLANATION | EXAMPLE | EXPERIENCE | PROBLEM_SOLVING | COMPARISON | OPINION | UNCERTAIN",
  "depth": 2,
  "confidence": 0.9,
  "followUpCandidates": ["Tối đa 3 khái niệm cụ thể có thể đào sâu tiếp"],
  "incorrectConcepts": ["Khái niệm sai hoặc nhầm lẫn rõ ràng nếu có"],
  "needsClarification": false,
  "showsPracticalExperience": false,
  "doesNotKnow": false,
  "hasInconsistency": false,
  "inconsistencyDetail": "",
  "contradictedPriorStatement": "",
  "verifiedFacts": ["Sự thật đã được chứng minh cặn kẽ"],
  "unverifiedClaims": ["Tuyên bố tự nhận chưa có số liệu hay bằng chứng"],
  "challengeTrigger": ""
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là bộ phận phân tích nội bộ của hệ thống phỏng vấn AI.
- Bạn KHÔNG phải interviewer trực tiếp.
- Bạn KHÔNG được viết feedback cho ứng viên.
- Bạn KHÔNG được tự ý chấm điểm.

Nhiệm vụ duy nhất:
Phân tích câu trả lời của ứng viên kết hợp với lịch sử phỏng vấn trước đó để adaptive interview engine quyết định câu hỏi tiếp theo.

====================
THÔNG TIN VỊ TRÍ & NGỮ CẢNH
====================
Vị trí: {{targetPosition}}
Topic hiện tại: {{currentTopic}}
Subtopic hiện tại: {{currentSubtopic}}

====================
LỊCH SỬ CÁC LƯỢT TRẢ LỜI TRƯỚC (PRIOR HISTORY)
====================
{{PromptContextBoundary.Wrap("PRIOR_HISTORY", historySection)}}

====================
LƯỢT PHỎNG VẤN HIỆN TẠI
====================
Câu hỏi của interviewer:
{{question}}

Câu trả lời của ứng viên:
{{PromptContextBoundary.Wrap("CANDIDATE_ANSWER", answer)}}

====================
TIÊU CHÍ PHÂN TÍCH
====================
1. MainConcept: Khái niệm kỹ thuật hoặc nghiệp vụ trọng tâm ứng viên đang nói tới.
2. AnswerType: Chọn 1 trong các loại: DEFINITION, EXPLANATION, EXAMPLE, EXPERIENCE, PROBLEM_SOLVING, COMPARISON, OPINION, UNCERTAIN.
3. Depth:
   - 0: Không thể hiện hiểu biết hoặc trả lời không biết.
   - 1 (basic): Chỉ nêu khái niệm, định nghĩa chung chung.
   - 2 (understanding): Hiểu rõ cơ chế, cách hoạt động và lý do lựa chọn.
   - 3 (application): Có kinh nghiệm áp dụng thực tế, giải quyết tình huống cụ thể.
   - 4 (advanced): Nắm vững trade-off, xử lý tải cao, kiến trúc hệ thống hoặc tối ưu hóa.
4. Confidence: Độ tin cậy của phân tích từ 0.0 đến 1.0.
5. FollowUpCandidates: Tối đa 3 khái niệm cụ thể xuất hiện trong câu trả lời có thể đào sâu tiếp.
6. IncorrectConcepts: Chỉ liệt kê các khái niệm hoặc nhận định sai rõ ràng. Không tự suy diễn lỗi nếu chưa có căn cứ.
7. NeedsClarification: true nếu câu trả lời quá mơ hồ, thiếu chi tiết kỹ thuật hoặc lạc đề.
8. ShowsPracticalExperience: true nếu câu trả lời thể hiện trải nghiệm thực chiến cá nhân.
9. DoesNotKnow: true nếu ứng viên trực tiếp hoặc gián tiếp thể hiện rằng họ không biết, không chắc.
10. HasInconsistency: true NẾU câu trả lời hiện tại mâu thuẫn rõ ràng với phát biểu trước đó trong Lịch sử.
11. InconsistencyDetail: Trích xuất nội dung mâu thuẫn khách quan: "Trước đó nói ..., hiện tại nói ...". Nếu không có, để trống "".
12. ContradictedPriorStatement: Trích dẫn câu phát biểu trước đó bị mâu thuẫn. Nếu không có, để trống "".
13. VerifiedFacts: Những sự thật chuyên môn hoặc chi tiết dự án ứng viên ĐÃ chứng minh, giải thích cặn kẽ có chiều sâu.
14. UnverifiedClaims: Tuyên bố lớn nhưng CHƯA kèm giải pháp hoặc số liệu minh chứng.
15. ChallengeTrigger: Gợi ý trigger thử thách nếu có (ví dụ: "unverified_scale_claim", "weak_tradeoff", "missing_failure_handling").

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
