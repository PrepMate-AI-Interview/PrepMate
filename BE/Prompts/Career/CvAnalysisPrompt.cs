using System;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Career
{
    /// <summary>
    /// Prompt for analyzing candidate CVs and assessing job suitability.
    /// Uses strict context boundary and grounding rules to prevent fabricating credentials.
    /// </summary>
    public static class CvAnalysisPrompt
    {
        public static string Build(
            string jobTitle,
            string cvText,
            string? userDescription = null,
            string? language = InterviewLanguage.Vietnamese)
        {
            var cvTruncated = (cvText.Length > 6000) ? cvText.Substring(0, 6000) : cvText;
            var safeJob = string.IsNullOrWhiteSpace(jobTitle) ? "Chuyên viên chuyên môn" : jobTitle.Trim();
            var descSection = !string.IsNullOrWhiteSpace(userDescription)
                ? PromptContextBoundary.Wrap("USER_SELF_DESCRIPTION", userDescription)
                : string.Empty;

            var langInstruction = PromptLanguagePolicy.GetInstruction(language);

            var schema = """
{
  "summary": "Tóm tắt hồ sơ năng lực thực tế của ứng viên",
  "keySkills": ["kỹ năng thực tế có trong CV"],
  "experience": "Tổng quan kinh nghiệm chuyên môn",
  "suitability": 85,
  "suggestions": ["Gợi ý cải thiện hồ sơ hoặc lộ trình học tập"]
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là chuyên gia thẩm định hồ sơ tuyển dụng cấp cao.
Nhiệm vụ: Phân tích khách quan hồ sơ ứng viên (CV) cho vị trí mục tiêu: "{{safeJob}}".

====================
DỮ LIỆU ĐẦU VÀO
====================
Vị trí mục tiêu: {{safeJob}}
{{descSection}}

{{PromptContextBoundary.Wrap("CANDIDATE_CV", cvTruncated)}}

====================
YÊU CẦU PHÂN TÍCH
====================
1. Phân tích ngành nghề, kinh nghiệm làm việc, kỹ năng cốt lõi và các dự án thực tế được nêu trong CV.
2. TUYỆT ĐỐI KHÔNG tự bịa đặt bằng cấp, chứng chỉ, kinh nghiệm hoặc số năm làm việc mà CV không có.
3. Đánh giá mức độ phù hợp (suitability) trên thang điểm 0 - 100 dựa trên bằng chứng thực tế từ CV so với yêu cầu của vị trí.
4. Đưa ra các gợi ý (suggestions) thực tế, có tính hành động cao giúp ứng viên bù đắp khoảng trống năng lực.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
