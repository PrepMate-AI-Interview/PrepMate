using System;
using System.Collections.Generic;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Interview
{
    /// <summary>
    /// Adaptive Follow-Up Question Generation Prompt.
    /// Fully standardized with domain classification, zero few-shot bias, and shared system policies.
    /// </summary>
    public static class QuestionPrompt
    {
        public static string Build(
            InterviewState state,
            string nextTopic,
            InterviewContext context,
            AnswerAnalysis analysis,
            string history,
            TargetEvaluationContext? targetEvaluation = null)
        {
            var jobFamily = ProfessionalDomainClassifier.Classify(context.TargetPosition, context.Industry);
            var isSwe = jobFamily == JobFamily.SOFTWARE_ENGINEERING;
            var persona = context.Persona ?? InterviewerPersona.CreateDefault(context.TargetPosition);
            var lang = context.Language ?? InterviewLanguage.Vietnamese;
            var langInstruction = PromptLanguagePolicy.GetInstruction(lang);

            var targetEval = targetEvaluation ?? state.ActiveTargetEvaluation;

            var targetEvaluationSection = string.Empty;
            if (targetEval != null && !string.IsNullOrWhiteSpace(targetEval.ConceptName))
            {
                var expectedLines = targetEval.ExpectedUnderstanding.Count > 0
                    ? string.Join("\n  * ", targetEval.ExpectedUnderstanding)
                    : (isSwe ? "Đánh giá mức độ làm chủ và tư duy kỹ thuật trong thực tế." : "Đánh giá mức độ làm chủ và tư duy chuyên môn nghiệp vụ trong thực tế.");

                var practicalLines = targetEval.PracticalSignals.Count > 0
                    ? string.Join("\n  * ", targetEval.PracticalSignals)
                    : (isSwe ? "Khả năng vận dụng vào dự án thực tế, hiểu rõ cách debug và xử lý bài toán vận hành." : "Khả năng vận dụng vào công việc thực tế, phân tích vấn đề và xử lý các bài toán nghiệp vụ phát sinh.");

                var failureLines = targetEval.FailureSignals.Count > 0
                    ? string.Join("\n  * ", targetEval.FailureSignals)
                    : "Hiểu sai bản chất, nhầm lẫn khái niệm hoặc chỉ học vẹt lý thuyết.";

                targetEvaluationSection = $$"""

==================================================
PHẦN 7.5: MỤC TIÊU ĐÁNH GIÁ NĂNG LỰC (KNOWLEDGE TARGET & COVERAGE)
==================================================
- Vùng năng lực: {{targetEval.AreaName}} (Độ quan trọng: {{targetEval.AreaImportance}})
- Khái niệm mục tiêu: {{targetEval.ConceptName}}
- Trạng thái kiểm chứng: {{targetEval.CoverageStatus}}
- Bắt buộc: {{(targetEval.IsMandatory ? "Có" : "Không")}}

TIÊU CHÍ KỲ VỌNG NỘI BỘ (KHÔNG COPY NGUYÊN VĂN VÀO CÂU HỎI):
- Tiêu chí hiểu biết kỳ vọng:
  * {{expectedLines}}
- Dấu hiệu thực chiến cần tìm:
  * {{practicalLines}}
- Dấu hiệu thiếu hụt cần lưu ý:
  * {{failureLines}}

NGUYÊN TẮC VỀ MỤC TIÊU ĐÁNH GIÁ:
1. Câu hỏi BẮT BUỘC tập trung đánh giá đúng khái niệm "{{targetEval.ConceptName}}".
2. KHÔNG COPY NGUYÊN VĂN tiêu chí nội bộ vào câu hỏi; hãy chuyển hóa thành bài toán hoặc tình huống phỏng vấn tự nhiên.
3. KHÔNG ĐƯỢC để lộ thuật ngữ kỹ thuật nội bộ cho ứng viên.
""";
            }

            var inconsistencyInfo = analysis.HasInconsistency
                ? $"""
                  CẢNH BÁO MÂU THUẪN (INCONSISTENCY DETECTED):
                  - Chi tiết: {analysis.InconsistencyDetail}
                  - Phát biểu trước đó: {analysis.ContradictedPriorStatement}
                  - YÊU CẦU: Hãy đặt câu hỏi để ứng viên làm rõ mâu thuẫn này một cách khéo léo, lịch sự, chuyên nghiệp. Tuyệt đối không phán xét hay quy chụp ứng viên.
                  """
                : "Không phát hiện mâu thuẫn.";

            var unverifiedClaimsInfo = analysis.UnverifiedClaims.Count > 0
                ? string.Join(", ", analysis.UnverifiedClaims)
                : "Không có";

            var verifiedFactsInfo = analysis.VerifiedFacts.Count > 0
                ? string.Join(", ", analysis.VerifiedFacts)
                : "Chưa ghi nhận";

            var companySection = string.Empty;
            if (context.CompanyContext != null && !string.IsNullOrWhiteSpace(context.CompanyContext.CompanyName))
            {
                var comp = context.CompanyContext;
                companySection = $@"
- Bối cảnh doanh nghiệp mục tiêu (Company Context):
  * Tên công ty: {comp.CompanyName}
  * Ngành nghề: {comp.Industry}
  * Loại hình: {comp.CompanyType}
  * LƯU Ý: Bối cảnh công ty chỉ dùng làm gia vị tình huống thực tế, TUYỆT ĐỐI KHÔNG làm lệch mục tiêu năng lực đang đánh giá.";
            }

            var toneSection = $@"NGUYÊN TẮC GIỌNG ĐIỆU:
- Bạn là một {persona.Role} thực thụ đang đối thoại với ứng viên vị trí {context.TargetPosition}.
- Giữ phong thái tự nhiên, đĩnh đạc, không nói năng như robot đọc đề thi.
- Không lặp lại các câu sáo rỗng ('Cảm ơn bạn đã chia sẻ...', 'Đây là một câu trả lời thú vị...').
- Dùng lời dẫn tự nhiên, gãy gọn: 'Tôi hiểu.', 'Được, vậy chúng ta đi sâu hơn vào trường hợp này nhé.', 'Bạn vừa đề cập giải pháp X. Nếu phát sinh tình huống rủi ro Y thì bạn sẽ xử lý thế nào?'.";

            var clarifySection = isSwe
                ? @"3. NẾU CLARIFY:
   - TargetConcept BẮT BUỘC phải nằm trong Followups hoặc MainConcept.
   - Giữ CurrentTopic.
   - Hỏi sâu hơn về:
     * Luồng dữ liệu (Data flow)
     * Trạng thái và vòng đời (State & lifecycle)
     * Cách xử lý ngoại lệ và trường hợp biên (Exceptions & edge cases)
     * Quyết định thiết kế kỹ thuật (Technical trade-offs & design decisions)"
                : $@"3. NẾU CLARIFY:
   - TargetConcept BẮT BUỘC phải nằm trong Followups hoặc MainConcept.
   - Giữ CurrentTopic.
   - Hỏi sâu hơn về:
     * Quy trình và luồng công việc nghiệp vụ (Business workflow)
     * Dữ liệu, chỉ số và căn cứ ra quyết định (Metrics & rationale)
     * Cách xử lý ngoại lệ, tranh chấp hoặc tình huống phát sinh (Exception handling)
     * Quyết định lựa chọn phương án chuyên môn của {context.TargetPosition}";

            var challengeSection = isSwe
                ? @"6. NẾU CHALLENGE:
   - Giữ CurrentTopic. Tăng độ khó và tạo áp lực thực tế phù hợp chuyên môn kỹ thuật.
   - Các góc độ thử thách:
     * Quy mô (Scale): Khi lưu lượng hoặc tải dữ liệu tăng đột biến...
     * Sự cố (Failure): Khi một dịch vụ hoặc node kết nối phụ thuộc gặp sự cố ngừng hoạt động...
     * Ràng buộc (Constraint): Khi bị giới hạn tài nguyên hoặc không thể sử dụng giải pháp thông thường...
     * Đánh đổi (Trade-off): Phân tích ưu nhược điểm giữa độ trễ, tính nhất quán và chi phí vận hành...
     * Quyền sở hữu (Ownership): Làm rõ phần việc trực tiếp thiết kế, triển khai so với phần việc của thành viên khác trong team."
                : $@"6. NẾU CHALLENGE:
   - Giữ CurrentTopic. Tăng độ khó và tạo áp lực thực tế phù hợp chuyên môn {context.TargetPosition}.
   - Các góc độ thử thách:
     * Tải công việc / Quy mô: Khi khối lượng công việc hoặc số lượng yêu cầu tăng gấp nhiều lần...
     * Biến động / Sự cố: Khi đối tác hoặc khách hàng bất ngờ thay đổi kế hoạch vào phút chót...
     * Ràng buộc nguồn lực: Khi ngân sách hoặc nhân sự bị cắt giảm...
     * Đánh đổi (Trade-off): Cân nhắc giữa tiến độ, chi phí và chất lượng thực hiện...
     * Quyền sở hữu (Ownership): Làm rõ thẩm quyền trực tiếp quyết định và thực thi của cá nhân ứng viên.";

            var transitionExamples = isSwe
                ? @"Ví dụ minh họa cấu trúc (LƯU Ý: Đây chỉ là mẫu cấu trúc câu hỏi, TUYỆT ĐỐI KHÔNG sao chép số liệu hoặc công nghệ vào câu hỏi nếu ứng viên không đề cập):
- [Ghi nhận giải pháp ứng viên nêu] -> [Đặt tình huống / rủi ro kỹ thuật liên quan] -> [Hỏi phương án xử lý chi tiết]
- Ví dụ mẫu: 'Tôi ghi nhận giải pháp phân tách service qua message broker mà bạn đã nêu. Trong trường hợp hệ thống đối mặt với sự cố nghẽn mạng hoặc lưu lượng tăng đột biến, cơ chế kiểm soát lỗi và bảo đảm tính nhất quán dữ liệu được bạn xử lý ra sao?'"
                : @"Ví dụ minh họa cấu trúc (LƯU Ý: Đây chỉ là mẫu cấu trúc câu hỏi, TUYỆT ĐỐI KHÔNG sao chép chi tiết vào câu hỏi nếu ứng viên không đề cập):
- [Ghi nhận giải pháp ứng viên nêu] -> [Đặt tình huống / thách thức nghiệp vụ] -> [Hỏi phương án xử lý]
- Ví dụ mẫu: 'Tôi hiểu phương án bạn vừa trình bày. Nếu đối tác bất ngờ thay đổi yêu cầu trọng yếu hoặc ngân sách bị giới hạn, bạn sẽ điều chỉnh kế hoạch và thương lượng với các bên liên quan ra sao?'";

            var schema = """
{
  "question": "Nội dung câu hỏi đầy đủ bao gồm cả câu dẫn dắt tự nhiên của interviewer",
  "conversationalTransition": "Lời dẫn dắt / ghi nhận ngắn gọn mở đầu",
  "topic": "Topic hiện tại",
  "subtopic": "Subtopic cụ thể",
  "dimension": "Khía cạnh đánh giá",
  "questionType": "TECHNICAL | SITUATIONAL | EXPERIENCE",
  "difficulty": 1,
  "targetConcept": "Khái niệm mục tiêu",
  "challengeTrigger": "",
  "reason": "Lý do lựa chọn câu hỏi"
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là AI INTERVIEWER thực thụ trong một buổi phỏng vấn tuyển dụng chuyên nghiệp.

Nhiệm vụ:
Tạo ĐÚNG MỘT câu hỏi tiếp theo có tính hội thoại tự nhiên (Conversational Question), bám sát quyết định của Decision Engine và thể hiện đúng phong thái của Interviewer Persona.

==================================================
PHẦN 1: HÌNH TƯỢNG NGƯỜI PHỎNG VẤN (INTERVIEWER PERSONA)
==================================================
- Vai trò: {{persona.Role}}
- Phong cách: {{persona.CommunicationStyle}}
- Độ khắt khe: {{persona.Strictness}}
- Cách đào sâu: {{persona.FollowUpStyle}}
- Cách thách thức: {{persona.ChallengeStyle}}
{{toneSection}}

==================================================
PHẦN 2: THÔNG TIN VỊ TRÍ & ỨNG VIÊN
==================================================
- Vị trí ứng tuyển: {{context.TargetPosition}}
- Doanh nghiệp mục tiêu: {{context.TargetCompany}}{{companySection}}
- Kỹ năng ứng viên: {{string.Join(", ", context.Skills)}}
- Chủ đề ứng viên đã làm: {{string.Join(", ", context.CandidateTopics)}}
- Chủ đề trọng tâm cần khảo sát: {{string.Join(", ", context.ExpectedTopics)}}

{{PromptContextBoundary.Wrap("JOB_DESCRIPTION", context.JdText)}}

==================================================
PHẦN 3: TRẠNG THÁI HIỆN TẠI CỦA BUỔI PHỎNG VẤN
==================================================
- Topic hiện tại: {{state.CurrentTopic}}
- Subtopic hiện tại: {{state.CurrentSubtopic}}
- Khía cạnh (Dimension): {{state.CurrentDimension}}
- Độ sâu hiện tại: {{state.TopicDepth}}
- Số lượt follow-up trong topic: {{state.FollowUpCount}} / {{state.TopicFollowUpLimit}}
- Chủ đề đã phỏng vấn: {{string.Join(", ", state.TopicsCovered)}}
- Dữ kiện đã chứng minh (VerifiedFacts): {{verifiedFactsInfo}}

==================================================
PHẦN 4: KẾT QUẢ PHÂN TÍCH CÂU TRẢ LỜI MỚI NHẤT
==================================================
- Khái niệm chính: {{analysis.MainConcept}}
- Kiểu trả lời: {{analysis.AnswerType}}
- Độ sâu thể hiện: {{analysis.Depth}}
- Khái niệm chưa chính xác: {{string.Join(", ", analysis.IncorrectConcepts)}}
- Khái niệm tiềm năng để đào sâu: {{string.Join(", ", analysis.FollowUpCandidates)}}
- Tuyên bố chưa có bằng chứng (UnverifiedClaims): {{unverifiedClaimsInfo}}
- Ứng viên không biết: {{(analysis.DoesNotKnow ? "Có" : "Không")}}
- Trigger thử thách: {{analysis.ChallengeTrigger}}

==================================================
PHẦN 5: KIỂM SOÁT NHẤT QUÁN (CROSS-TURN CONSISTENCY)
==================================================
{{inconsistencyInfo}}

==================================================
PHẦN 6: LỊCH SỬ HỘI THOẠI GẦN ĐÂY
==================================================
{{PromptContextBoundary.Wrap("CONVERSATION_HISTORY", history)}}

==================================================
PHẦN 7: DECISION ENGINE (LUẬT BẮT BUỘC)
==================================================
Quyết định: {{state.LastDecision}}
Next Topic (nếu chuyển): {{nextTopic}}

QUY TẮC THEO QUYẾT ĐỊNH:
1. NẾU CÓ MÂU THUẪN (HasInconsistency = true): Đặt câu hỏi làm rõ mâu thuẫn một cách lịch sự, khách quan.
2. NẾU VERIFY: TargetConcept BẮT BUỘC phải nằm trong IncorrectConcepts. Giữ CurrentTopic. Hỏi để kiểm chứng điểm hiểu sai hoặc đặt tình huống để ứng viên tự nhận ra vấn đề.
{{clarifySection}}
4. NẾU DEEPEN_TOPIC: Giữ CurrentTopic. Chọn một khái niệm tiềm năng để đào sâu cơ chế thực thi bên dưới.
5. NẾU APPLICATION: Giữ CurrentTopic. Đặt concept vào bài toán thực tế của vị trí {{context.TargetPosition}}.
{{challengeSection}}
7. NẾU CHANGE_TOPIC: Chuyển sang Next Topic: "{{nextTopic}}". Dẫn dắt chuyển ý tự nhiên sang chủ đề mới.
{{targetEvaluationSection}}

==================================================
PHẦN 8: HỘI THOẠI & PHONG THÁI TỰ NHIÊN
==================================================
{{transitionExamples}}

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
