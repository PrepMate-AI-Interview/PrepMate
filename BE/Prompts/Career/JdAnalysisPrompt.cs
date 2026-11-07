using System;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Career
{
    /// <summary>
    /// Prompt for analyzing employer Job Descriptions (JD) and extracting recruitment requirements.
    /// Interprets input strictly as an employer specification, NOT a candidate CV.
    /// Adheres to context boundary and grounding rules to prevent hallucinated requirements.
    /// </summary>
    public static class JdAnalysisPrompt
    {
        public static string Build(
            string jobTitle,
            string jdText,
            string? industry = null,
            string? seniority = null,
            string? language = InterviewLanguage.Vietnamese)
        {
            var jdTruncated = (jdText.Length > 8000) ? jdText.Substring(0, 8000) : jdText;
            var safeJob = string.IsNullOrWhiteSpace(jobTitle) ? "Vị trí tuyển dụng theo JD" : jobTitle.Trim();
            var safeSeniority = string.IsNullOrWhiteSpace(seniority) ? "Chuyên viên / Senior" : seniority.Trim();
            var safeIndustry = string.IsNullOrWhiteSpace(industry) ? "Đa ngành" : industry.Trim();

            var langInstruction = PromptLanguagePolicy.GetInstruction(language);

            var schema = """
{
  "targetRole": "Tên chức danh hoặc vị trí tuyển dụng chính xác trích xuất từ JD (hoặc chuẩn hóa từ ngữ cảnh nếu JD không ghi rõ tiêu đề)",
  "summary": "Tổng quan súc tích về yêu cầu công việc, sứ mệnh vai trò và mục tiêu tuyển dụng của doanh nghiệp (từ 2 - 4 câu)",
  "keySkills": ["kỹ năng chuyên môn, công nghệ, công cụ hoặc năng lực cốt lõi được JD yêu cầu"],
  "responsibilities": ["trách nhiệm và nhiệm vụ công việc chính được nêu trong JD"],
  "strengths": ["tiêu chí tuyển dụng trọng tâm mà doanh nghiệp kỳ vọng ở ứng viên"],
  "gaps": ["các chủ đề chuyên sâu hoặc phạm vi nghiệp vụ người phỏng vấn sẽ tập trung đào sâu"],
  "suggestions": ["các hành động hoặc chủ đề trọng tâm ứng viên cần chuẩn bị trước buổi phỏng vấn"],
  "experienceRequirement": "Yêu cầu kinh nghiệm hoặc cấp bậc nếu có trong JD (nếu không nêu ghi 'Không nêu cụ thể trong JD')",
  "domainKnowledge": "Kiến thức ngành hoặc nghiệp vụ đặc thù nếu có trong JD (nếu không nêu ghi 'Không nêu cụ thể trong JD')"
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là chuyên gia thẩm định và phân tích yêu cầu tuyển dụng cấp cao.
Nhiệm vụ: Phân tích khách quan bản Mô tả công việc (Job Description — JD) do nhà tuyển dụng phát hành.
LƯU Ý QUAN TRỌNG:
- Văn bản đầu vào là BẢN MÔ TẢ CÔNG VIỆC (JOB DESCRIPTION) của nhà tuyển dụng, TUYỆT ĐỐI KHÔNG PHẢI là hồ sơ hay CV cá nhân của ứng viên.
- KHÔNG đánh giá năng lực của ứng viên hay nhận xét ứng viên sao chép JD.
- Nhiệm vụ của bạn là bóc tách các TIÊU CHUẨN TUYỂN DỤNG, TRÁCH NHIỆM và KỸ NĂNG mà nhà tuyển dụng đang tìm kiếm.

====================
THÔNG TIN BỔ TRỢ
====================
Vị trí lựa chọn ban đầu: {{safeJob}}
Cấp bậc tham chiếu: {{safeSeniority}}
Ngành nghề: {{safeIndustry}}

====================
NỘI DUNG JOB DESCRIPTION (JD)
====================
{{PromptContextBoundary.Wrap("JOB_DESCRIPTION", jdTruncated)}}

====================
YÊU CẦU PHÂN TÍCH
====================
1. Phân tích chi tiết các kỹ năng kỹ thuật, công nghệ, kỹ năng mềm và trách nhiệm được nhà tuyển dụng nêu trong JD.
2. TUYỆT ĐỐI KHÔNG tự bịa đặt các công nghệ hay yêu cầu mà JD không nhắc tới hoặc không hàm ý rõ ràng. Nếu JD không nêu, ghi nhận là không đề cập.
3. Trích xuất đúng tên vị trí tuyển dụng (targetRole) từ chính nội dung JD nếu có (ưu tiên dòng chức danh trong JD hơn vị trí lựa chọn ban đầu).
4. Xác định các tiêu chí tuyển dụng trọng tâm (strengths) và phạm vi bài toán phỏng vấn (gaps) để phục vụ buổi phỏng vấn AI.
5. Đưa ra gợi ý chuẩn bị (suggestions) mang tính định hướng hành động cao cho ứng viên.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
