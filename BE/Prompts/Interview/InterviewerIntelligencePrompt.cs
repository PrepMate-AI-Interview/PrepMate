using System;
using System.Text.Json;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Interview
{
    /// <summary>
    /// Semantic interview intelligence prompts:
    /// - Claim extraction from candidate answers
    /// - Deep probe question generation by probe pattern / intent
    /// - Natural delivery wording generation
    /// </summary>
    public static class InterviewerIntelligencePrompt
    {
        public static string BuildClaimExtractionPrompt(Session session, string question, string answer)
        {
            var role = session.JobTitle ?? session.InterviewContext?.TargetPosition ?? "Ứng viên";
            var level = session.InterviewContext?.ExperienceLevel ?? "Mid";
            var industry = session.InterviewContext?.Industry ?? session.InterviewBlueprint?.Industry ?? "Chung";
            var lang = session.Language ?? session.InterviewContext?.Language ?? InterviewLanguage.Vietnamese;
            var langInstruction = PromptLanguagePolicy.GetInstruction(lang);

            var schema = """
{
  "claims": [
    {
      "text": "nội dung khẳng định chính",
      "claimType": "ACHIEVEMENT | RESPONSIBILITY | EXPERIENCE | RESULT | LEADERSHIP | CUSTOMER | PROBLEM_SOLVING | DECISION | FAILURE | PROJECT | TECHNICAL | PROCESS | IMPROVEMENT | OTHER",
      "specificity": "High | Medium | Low",
      "isUncertain": false,
      "candidateOwnershipComponent": "phần ứng viên trực tiếp làm hoặc null nếu chỉ nói chung chung team",
      "teamOwnershipComponent": "phần đóng góp của team hoặc null",
      "extractedMetric": "con số cụ thể ứng viên đã nêu hoặc null",
      "extractedArtifact": "tài liệu, sản phẩm, dashboard, API cụ thể hoặc null",
      "extractedSteps": ["bước 1", "bước 2"],
      "impactType": "Activity | Output | Outcome | BusinessUserImpact",
      "contextDependency": "High | Medium | Low | Unknown",
      "riskOrTradeOffMentioned": false
    }
  ],
  "summary": "tóm tắt ngắn gọn các luận điểm"
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là trợ lý phân tích ngữ nghĩa phỏng vấn (Semantic Interview Intelligence Assistant) cho hệ thống PrepMate.
Nhiệm vụ: Trích xuất các khẳng định/tuyên bố (Claims) và bằng chứng sơ bộ từ câu trả lời của ứng viên.

====================
NGỮ CẢNH PHỎNG VẤN
====================
- Vị trí ứng tuyển: {{role}}
- Cấp bậc: {{level}}
- Ngành nghề: {{industry}}

Câu hỏi của người phỏng vấn:
{{question}}

Câu trả lời của ứng viên:
{{PromptContextBoundary.Wrap("CANDIDATE_ANSWER", answer)}}

====================
QUY TẮC BẮT BUỘC
====================
1. KHÔNG ĐƯỢC TỰ BỊA ĐẶT số liệu, KPI, metric mà ứng viên không nói.
2. KHÔNG ĐƯỢC KẾT LUẬN ứng viên nói dối. Nếu có sự mơ hồ, chỉ đánh dấu là uncertain hoặc cần làm rõ.
3. PHÂN TÁCH RÕ RÀNG giữa phần việc của team và phần việc ứng viên trực tiếp sở hữu (Candidate Ownership vs Team Component).
4. Đánh giá mức độ rõ ràng, cụ thể (Specificity) và tác động (Activity vs Output vs Outcome vs Business/User Impact).
5. Giữ nguyên các trường schema JSON và enum theo đúng quy định.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }

        public static string BuildProbeQuestionPrompt(
            Session session,
            CandidateClaim claim,
            InterviewerProbePattern pattern,
            string reason,
            int probeDepth)
        {
            var role = session.JobTitle ?? session.InterviewContext?.TargetPosition ?? "Ứng viên";
            var level = session.InterviewContext?.ExperienceLevel ?? session.InterviewBlueprint?.Seniority ?? "Mid";
            var industry = session.InterviewContext?.Industry ?? session.InterviewBlueprint?.Industry ?? "Chung";
            var lang = session.Language ?? session.InterviewContext?.Language ?? InterviewLanguage.Vietnamese;
            var langInstruction = PromptLanguagePolicy.GetInstruction(lang);

            var schema = """
{
  "probeQuestion": "câu hỏi đào sâu lịch sự, tự nhiên, đi thẳng vào trọng tâm",
  "rationale": "mục đích kiểm chứng"
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

Bạn là một người phỏng vấn chuyên nghiệp trên PrepMate.
Hãy đặt một câu hỏi đào sâu (Deep Probe Question) tự nhiên, sắc sảo, lịch sự để kiểm chứng khẳng định của ứng viên.

====================
NGỮ CẢNH
====================
- Vị trí: {{role}} (Level: {{level}}, Ngành: {{industry}})
- Khẳng định của ứng viên: "{{claim.Text}}"
- Pattern kỹ thuật cần probe: {{pattern}}
- Lý do cần đào sâu: {{reason}}
- Độ sâu hiện tại: {{probeDepth}} (1=HOW/Phương pháp, 2=WHY/Cơ sở quyết định, 3=REPEATABILITY/Khả năng tái lập kết quả)

HƯỚNG DẪN THEO PATTERN:
- OWNERSHIP_ATTRIBUTION: Hỏi để tách bạch vai trò trực tiếp của ứng viên khỏi đóng góp của team hoặc điều kiện thừa hưởng.
- CONTEXT_DEPENDENCY: Hỏi xem kết quả đến từ nỗ lực bản thân hay điều kiện thị trường/hệ thống sẵn có.
- CONTRIBUTION_VERIFICATION: Đào sâu phần ứng viên trực tiếp quyết định và thực hiện trong dự án lớn.
- METHODOLOGY_VERIFICATION: Hỏi rõ quy trình, các bước thực hiện từ đầu vào -> xử lý -> đầu ra.
- RISK_AWARENESS: Hỏi về dấu hiệu cảnh báo sớm hoặc rủi ro tiềm ẩn.
- TRADE_OFF: Hỏi về việc cân nhắc đánh đổi giữa 2 mục tiêu đối nghịch.
- REPEATABILITY: Hỏi về khả năng tái lập thành công ở một môi trường hoặc quy mô khác.

CALIBRATION THEO CẤP BẬC:
- Junior: Tập trung vào thao tác thực tế, cách học hỏi, giải quyết lỗi cơ bản.
- Mid: Tập trung vào trade-offs, giải pháp, khả năng làm việc độc lập.
- Senior: Tập trung vào tầm nhìn hệ thống, quản trị rủi ro, quy mô, ảnh hưởng tổ chức.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }

        public static string BuildIntentProbeQuestionPrompt(
            Session session,
            CandidateClaim claim,
            InterviewerIntentDecision decision,
            int probeDepth)
        {
            return BuildIntentProbeQuestionPrompt(session, claim, decision.Intent, decision.RecommendedPattern, decision.Reason, probeDepth);
        }

        public static string BuildIntentProbeQuestionPrompt(
            Session session,
            CandidateClaim claim,
            InterviewIntentType intent,
            InterviewerProbePattern? pattern,
            string reason,
            int probeDepth)
        {
            var role = session.JobTitle ?? session.InterviewContext?.TargetPosition ?? "Ứng viên";
            var level = session.InterviewContext?.ExperienceLevel ?? session.InterviewBlueprint?.Seniority ?? "Mid";
            var industry = session.InterviewContext?.Industry ?? session.InterviewBlueprint?.Industry ?? "Chung";
            var lang = session.Language ?? session.InterviewContext?.Language ?? InterviewLanguage.Vietnamese;
            var langInstruction = PromptLanguagePolicy.GetInstruction(lang);

            var schema = """
{
  "probeQuestion": "câu hỏi đào sâu lịch sự, tự nhiên, đi thẳng vào trọng tâm",
  "rationale": "mục đích kiểm chứng"
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

Bạn là một người phỏng vấn chuyên nghiệp trên PrepMate.
Hãy đặt một câu hỏi đào sâu (Deep Probe Question) tự nhiên, sắc sảo, lịch sự để kiểm chứng khẳng định của ứng viên dựa trên Ý định phỏng vấn (Interview Intent).

====================
NGỮ CẢNH
====================
- Vị trí: {{role}} (Level: {{level}}, Ngành: {{industry}})
- Khẳng định của ứng viên: "{{claim.Text}}"
- Ý định phỏng vấn: {{intent}}
- Lý do cần đào sâu: {{reason}}
- Độ sâu hiện tại: {{probeDepth}}

QUY TẮC BẮT BUỘC:
1. TUYỆT ĐỐI KHÔNG để lộ thuật ngữ kỹ thuật nội bộ (như "Interview Intent", "Evidence Gap", "Claim", "Score") trong câu hỏi gửi cho ứng viên.
2. KHÔNG ĐƯỢC bịa đặt số liệu hay công nghệ ứng viên chưa từng nhắc tới.
3. Đặt câu hỏi lịch sự, tự nhiên, đĩnh đạc như một chuyên gia tuyển dụng đang trực tiếp lắng nghe và khai thác sâu.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }

        public static string BuildNaturalWordingPrompt(Session session, InterviewQuestionSpecification spec)
        {
            var role = session.JobTitle ?? session.InterviewContext?.TargetPosition ?? "Ứng viên";
            var level = session.InterviewContext?.ExperienceLevel ?? "Mid";
            var industry = session.InterviewContext?.Industry ?? "Generic";
            var lang = session.Language ?? session.InterviewContext?.Language ?? InterviewLanguage.Vietnamese;
            var langInstruction = PromptLanguagePolicy.GetInstruction(lang);

            var schema = """
{
  "question": "Câu hỏi phỏng vấn hoàn chỉnh được diễn đạt tự nhiên theo đúng mục tiêu",
  "conversationalTransition": "Lời dẫn dắt ghi nhận ngắn gọn nếu phù hợp"
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

Bạn là người phỏng vấn chuyên nghiệp tại PrepMate.
Nhiệm vụ: Diễn đạt lại câu hỏi định hướng sau đây thành một câu hỏi phỏng vấn tự nhiên, mạch lạc, tôn trọng, đúng chuẩn phong thái phỏng vấn thực tế.

========================
THÔNG TIN NGỮ CẢNH
========================
- Vị trí: {{role}} (Level: {{level}}, Ngành: {{industry}})
- Năng lực mục tiêu: {{spec.TargetCompetency}}
- Khía cạnh: {{spec.TargetDimension}}
- Mục tiêu câu hỏi: {{spec.Objective}}
- Câu hỏi định hướng gốc: "{{spec.DeterministicWording}}"

========================
QUY TẮC BẢO MẬT & BẢO TOÀN
========================
1. GIỮ NGUYÊN mục đích đánh giá của câu hỏi. KHÔNG đổi sang chủ đề khác.
2. KHÔNG chấm điểm, KHÔNG đưa điểm số vào phản hồi.
3. KHÔNG dùng từ ngữ quy chụp, phán xét hay buộc tội ứng viên.
4. KHÔNG bịa đặt kinh nghiệm hoặc số liệu mà ứng viên chưa từng nêu.
5. KHÔNG để lộ các thuật ngữ nội bộ như PROBE_COUNT hay Spec Intent.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
