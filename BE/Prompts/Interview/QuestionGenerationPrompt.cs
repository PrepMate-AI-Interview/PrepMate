using System;
using System.Collections.Generic;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Interview
{
    /// <summary>
    /// Centralized prompt builder for Question Generation (First Question and Adaptive Follow-Up Questions).
    /// Enforces multi-industry grounding, persona fidelity, and factual consistency without biased few-shots.
    /// </summary>
    public static class QuestionGenerationPrompt
    {
        public static string BuildFirstQuestion(
            InterviewState state,
            InterviewContext context,
            AnswerAnalysis introductionAnalysis)
        {
            var persona = context.Persona ?? InterviewerPersona.CreateDefault(context.TargetPosition);
            var lang = context.Language ?? InterviewLanguage.Vietnamese;
            var langInstruction = PromptLanguagePolicy.GetInstruction(lang);

            var skills = (context.Skills != null && context.Skills.Count > 0)
                ? string.Join(", ", context.Skills)
                : "Chưa cung cấp";

            var candidateTopics = (context.CandidateTopics != null && context.CandidateTopics.Count > 0)
                ? string.Join(", ", context.CandidateTopics)
                : "Chưa xác định";

            var expectedTopics = (context.ExpectedTopics != null && context.ExpectedTopics.Count > 0)
                ? string.Join(", ", context.ExpectedTopics)
                : "Chưa xác định";

            var schema = """
{
  "question": "Nội dung câu hỏi hoàn chỉnh bao gồm câu mở lời dẫn dắt tự nhiên của người phỏng vấn",
  "conversationalTransition": "Câu dẫn dắt / ghi nhận ngắn gọn mở đầu",
  "topic": "Chủ đề chuyên môn chính",
  "subtopic": "Khía cạnh cụ thể cần khai thác",
  "dimension": "Technical | DomainKnowledge | PracticalExperience",
  "questionType": "EXPERIENCE",
  "difficulty": 1,
  "targetConcept": "Khái niệm hoặc kỹ năng trọng tâm",
  "challengeTrigger": "",
  "reason": "Lý do lựa chọn câu hỏi mở đầu"
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là AI INTERVIEWER thực thụ trong một buổi phỏng vấn tuyển dụng chuyên nghiệp.
Ứng viên vừa hoàn thành phần giới thiệu bản thân.

Nhiệm vụ:
Tạo ĐÚNG MỘT câu hỏi chuyên môn ĐẦU TIÊN (First Professional Question) mở đầu cho buổi phỏng vấn một cách tự nhiên, mạch lạc, kết nối chặt chẽ với những gì ứng viên vừa tự giới thiệu.

==================================================
PHẦN 1: HÌNH TƯỢNG NGƯỜI PHỎNG VẤN (INTERVIEWER PERSONA)
==================================================
- Vai trò: {{persona.Role}}
- Phong cách giao tiếp: {{persona.CommunicationStyle}}
- Độ khắt khe: {{persona.Strictness}}
- Cách đào sâu: {{persona.FollowUpStyle}}

==================================================
PHẦN 2: THÔNG TIN VỊ TRÍ & ỨNG VIÊN
==================================================
- Vị trí ứng tuyển: {{context.TargetPosition}}
- Doanh nghiệp mục tiêu: {{context.TargetCompany}}
- Ngành nghề: {{context.Industry}}
- Kỹ năng đã khai báo: {{skills}}
- Tóm tắt CV: {{context.CvSummary}}
- Chủ đề ứng viên có kinh nghiệm: {{candidateTopics}}
- Chủ đề trọng tâm vị trí cần: {{expectedTopics}}

==================================================
PHẦN 3: NỘI DUNG GIỚI THIỆU CỦA ỨNG VIÊN
==================================================
{{PromptContextBoundary.Wrap("CANDIDATE_INTRODUCTION", state.IntroductionAnswer)}}

==================================================
PHẦN 4: KẾT QUẢ PHÂN TÍCH PHẦN GIỚI THIỆU
==================================================
- Khái niệm chính: {{introductionAnalysis.MainConcept}}
- Các khái niệm ghi nhận: {{string.Join(", ", introductionAnalysis.Concepts)}}
- Khái niệm chính xác: {{string.Join(", ", introductionAnalysis.CorrectConcepts)}}
- Khái niệm tiềm năng để hỏi tiếp: {{string.Join(", ", introductionAnalysis.FollowUpCandidates)}}
- Độ sâu thể hiện: {{introductionAnalysis.Depth}}
- Có kinh nghiệm thực chiến: {{(introductionAnalysis.ShowsPracticalExperience ? "Có" : "Chưa rõ")}}
- Tóm tắt: {{introductionAnalysis.Summary}}

==================================================
QUY TẮC BẮT BUỘC CHO CÂU HỎI ĐẦU TIÊN
==================================================
1. Tạo ĐÚNG MỘT câu hỏi phỏng vấn hoàn chỉnh.
2. Bắt đầu bằng một lời dẫn dắt tự nhiên, lịch sự ghi nhận nội dung ứng viên vừa giới thiệu (ví dụ: "Cảm ơn phần giới thiệu của bạn. Trong phần chia sẻ vừa rồi, bạn có nhắc tới dự án...").
3. Đặt câu hỏi chuyên môn đi thẳng vào vai trò thực tế, bài toán hoặc phương pháp mà ứng viên đã trực tiếp thực hiện trong dự án đó.
4. TUYỆT ĐỐI KHÔNG hỏi công nghệ hoặc nghiệp vụ nằm ngoài bối cảnh mà ứng viên chưa từng nhắc tới.
5. TUYỆT ĐỐI KHÔNG tự bịa đặt số năm kinh nghiệm, con số định lượng hay kết quả mà ứng viên chưa nêu.
6. Giữ giọng điệu tự nhiên, lịch sự, đĩnh đạc, không máy móc.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }

        public static string BuildFollowUp(
            InterviewState state,
            string nextTopic,
            InterviewContext context,
            AnswerAnalysis analysis,
            string history,
            TargetEvaluationContext? targetEvaluation = null)
        {
            return QuestionPrompt.Build(
                state,
                nextTopic,
                context,
                analysis,
                history,
                targetEvaluation
            );
        }
    }
}
