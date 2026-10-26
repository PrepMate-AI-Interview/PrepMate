using System;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Interview
{
    /// <summary>
    /// Situational interview evidence extraction and scenario refinement prompts.
    /// </summary>
    public static class SituationalPrompt
    {
        public static string BuildAnalysisPrompt(
            string position,
            string seniority,
            string category,
            string scenario,
            string answer,
            string priorContext = "",
            string? language = InterviewLanguage.Vietnamese)
        {
            var langInstruction = PromptLanguagePolicy.GetInstruction(language);

            var schema = """
{
  "problemUnderstanding": "Tóm tắt mức độ hiểu vấn đề cốt lõi",
  "prioritization": "Tóm tắt cách phân chia mức độ ưu tiên",
  "decisionMaking": "Tóm tắt quyết định đưa ra và căn cứ",
  "communication": "Tóm tắt kế hoạch giao tiếp/thông báo các bên",
  "riskAwareness": "Tóm tắt nhận thức về rủi ro và phương án dự phòng",
  "tradeoffAwareness": "Tóm tắt nhận thức về các điểm đánh đổi",
  "ownership": "High | Medium | Low | Unclear",
  "escalationJudgment": "Tóm tắt cách tiếp cận báo cáo lên cấp trên",
  "evidenceStrength": "Strong | Moderate | Weak | Insufficient",
  "reasoningQuality": "High | Medium | Low",
  "actionPlan": ["Bước 1", "Bước 2"],
  "missingEvidence": ["RiskAwareness", "Communication"],
  "claims": [],
  "contradictions": [],
  "category": "Loại tình huống"
}
""";

            var priorSection = !string.IsNullOrWhiteSpace(priorContext)
                ? PromptContextBoundary.Wrap("PRIOR_SCENARIO_CONTEXT", priorContext)
                : string.Empty;

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là bộ phận phân tích tình huống (Situational Evidence Extraction) cho hệ thống phỏng vấn AI.
- Bạn KHÔNG được tự quyết định điểm số hay xếp loại ứng viên.
- Nhiệm vụ: Phân tích khách quan cách ứng viên tiếp cận tình huống, tư duy giải quyết vấn đề, cân nhắc rủi ro, kỹ năng giao tiếp và ra quyết định.

====================
THÔNG TIN VỊ TRÍ & TÌNH HUỐNG
====================
Vị trí: {{position}}
Cấp bậc: {{seniority}}
Loại tình huống: {{category}}

Tình huống đặt ra cho ứng viên:
{{scenario}}

Câu trả lời của ứng viên:
{{PromptContextBoundary.Wrap("CANDIDATE_ANSWER", answer)}}

{{priorSection}}

====================
TIÊU CHÍ PHÂN TÍCH TÌNH HUỐNG
====================
1. ProblemUnderstanding: Ứng viên có hiểu đúng vấn đề cốt lõi, nguyên nhân và các ràng buộc không?
2. Prioritization: Ứng viên sắp xếp thứ tự xử lý thế nào? (khẩn cấp vs quan trọng)
3. DecisionMaking: Quyết định đề xuất có rõ ràng và có căn cứ hợp lý không?
4. Communication: Ứng viên có chủ động thông báo cho ai (stakeholder, khách hàng, team) và vào lúc nào?
5. RiskAwareness: Ứng viên có nhận diện được các rủi ro phát sinh hoặc có phương án dự phòng không?
6. TradeoffAwareness: Ứng viên có hiểu rõ được và mất trong giải pháp của mình không?
7. Ownership: Ứng viên thể hiện tinh thần chịu trách nhiệm hay né tránh trách nhiệm?
8. EscalationJudgment: Đánh giá cách ứng viên báo cáo lên cấp trên (hợp lý, đúng lúc hay ôm đồm)?
9. ActionPlan: Các bước hành động cụ thể mà ứng viên đưa ra.
10. MissingEvidence: Các khía cạnh mà ứng viên hoàn toàn chưa đề cập trong ["ProblemUnderstanding", "Prioritization", "Communication", "RiskAwareness", "TradeoffAwareness", "EscalationJudgment"].

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }

        public static string BuildScenarioRefinementPrompt(
            string position,
            string seniority,
            string category,
            string baseScenario,
            string? language = InterviewLanguage.Vietnamese)
        {
            var langInstruction = PromptLanguagePolicy.GetInstruction(language);

            return $$"""
{{langInstruction}}

Bạn là người phỏng vấn chuyên nghiệp.
Hãy điều chỉnh tình huống sau sao cho tự nhiên, mang tính thực tế cao và phù hợp cụ thể với vị trí {{position}} (cấp bậc {{seniority}}), loại tình huống: {{category}}.

Tình huống gốc:
"{{baseScenario}}"

YÊU CẦU:
1. Giữ nguyên mục tiêu đánh giá và các ràng buộc của tình huống gốc.
2. Đặt vấn đề sát với thực tế môi trường làm việc của ngành nghề.
3. Chỉ trả về DUY NHẤT nội dung tình huống và câu hỏi cho ứng viên, không kèm lời giải thích hay định dạng thừa.
""";
        }
    }
}
