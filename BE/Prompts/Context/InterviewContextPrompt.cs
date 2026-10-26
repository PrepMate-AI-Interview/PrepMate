using System;
using System.Collections.Generic;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Context
{
    /// <summary>
    /// Prompt for extracting structured interview context, topics, and dimensions from candidate profile, CV, and JD.
    /// </summary>
    public static class InterviewContextPrompt
    {
        public static string Build(
            CreateSessionRequest request,
            string cvTruncated,
            string jdTruncated,
            string skillsString,
            string? language = InterviewLanguage.Vietnamese)
        {
            var langInstruction = PromptLanguagePolicy.GetInstruction(language);

            var schema = """
{
  "industry": "Ngành/lĩnh vực chính (ví dụ: CNTT, Marketing, TaiChinh, NhanSu, PhanTichNghiepVu,...)",
  "candidateTopics": ["Chủ đề ứng viên thực sự có kinh nghiệm từ CV/Skills"],
  "expectedTopics": ["Chủ đề trọng tâm cần khảo sát theo yêu cầu vị trí/JD"],
  "cvTopics": ["Chủ đề nổi bật trong CV"],
  "interviewDimensions": ["Technical", "PracticalExperience", "ProblemSolving", "Communication"],
  "cvSummary": "Tóm tắt ngắn gọn năng lực ứng viên"
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là bộ phận xây dựng Ngữ cảnh phỏng vấn (Interview Context) cho hệ thống phỏng vấn AI.

Nhiệm vụ:
Phân tích thông tin ứng viên, CV và JD để tạo ra một CONTEXT NGẮN GỌN, CHUẨN XÁC cho adaptive interview engine.
- KHÔNG tạo câu hỏi phỏng vấn.
- KHÔNG đánh giá hay chấm điểm ứng viên.

====================
THÔNG TIN ỨNG VIÊN & VỊ TRÍ
====================
Vị trí ứng tuyển: {{request.JobTitle}}
Doanh nghiệp mục tiêu: {{request.TargetCompany ?? "Chưa cung cấp"}}
Cấp bậc ứng tuyển: {{request.ExperienceLevel ?? "Mid"}}
Họ tên: {{request.FullName ?? "Chưa cung cấp"}}
Chuyên môn / Ngành học: {{request.Major ?? request.Specialization ?? "Chưa cung cấp"}}
Kỹ năng đã khai báo: {{skillsString}}

{{PromptContextBoundary.Wrap("USER_DESCRIPTION", request.UserDescription)}}

{{PromptContextBoundary.Wrap("CANDIDATE_CV", cvTruncated)}}

{{PromptContextBoundary.Wrap("JOB_DESCRIPTION", jdTruncated)}}

====================
QUY TẮC PHÂN TÍCH NGỮ CẢNH
====================
1. Industry: Xác định đúng lĩnh vực chuyên môn chính của vị trí (không mặc định là IT nếu vị trí thuộc Marketing, Tài chính, Nhân sự, Quản trị kinh doanh,...).
2. CandidateTopics: Chỉ chọn những chủ đề mà ứng viên THỰC SỰ có dấu hiệu đã làm hoặc hiểu biết từ CV/Skills. Tuyệt đối KHÔNG giả định ứng viên biết một công nghệ chỉ vì JD yêu cầu.
3. ExpectedTopics: Xác định những vùng kiến thức trọng tâm mà vị trí/JD đòi hỏi để hệ thống định hình phạm vi khảo sát.
4. InterviewDimensions: Chọn các khía cạnh cần đánh giá phù hợp (Technical Knowledge, Practical Experience, Problem Solving, Behavioral, Communication, Domain Knowledge, Leadership).
5. CvSummary: Tóm tắt cực ngắn gọn, trung thực, chỉ giữ thông tin giá trị phục vụ người phỏng vấn.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
