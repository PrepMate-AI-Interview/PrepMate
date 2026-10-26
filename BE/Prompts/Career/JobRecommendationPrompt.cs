using System;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Career
{
    /// <summary>
    /// Prompt for recommending suitable job roles based on candidate CV and target position.
    /// </summary>
    public static class JobRecommendationPrompt
    {
        public static string Build(
            string jobTitle,
            string cvText,
            string? language = InterviewLanguage.Vietnamese)
        {
            var cvTruncated = (cvText.Length > 5000) ? cvText.Substring(0, 5000) : cvText;
            var safeJob = string.IsNullOrWhiteSpace(jobTitle) ? ProfessionalDomainClassifier.DefaultPositionTitle : jobTitle.Trim();
            var langInstruction = PromptLanguagePolicy.GetInstruction(language);

            var schema = """
{
  "recommendations": [
    {
      "role": "Tên vị trí công việc gợi ý",
      "reason": "Lý do phù hợp dựa trên năng lực và kỹ năng thực tế trong CV"
    }
  ]
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là chuyên gia định hướng nghề nghiệp và tuyển dụng cấp cao.
Nhiệm vụ: Dựa trên CV thực tế của ứng viên và vị trí quan tâm "{{safeJob}}", đề xuất 3 vị trí công việc phù hợp nhất.

====================
DỮ LIỆU ĐẦU VÀO
====================
Vị trí quan tâm: {{safeJob}}

{{PromptContextBoundary.Wrap("CANDIDATE_CV", cvTruncated)}}

====================
YÊU CẦU ĐỀ XUẤT
====================
1. Đề xuất đúng 3 vị trí phù hợp với năng lực hiện tại hoặc lộ trình phát triển gần nhất của ứng viên.
2. Với mỗi vị trí, nêu rõ lý do (reason) gắn liền với điểm mạnh, công nghệ hoặc nghiệp vụ cụ thể trong CV.
3. Không đề xuất vị trí quá xa rời hồ sơ năng lực hiện có trừ khi có kỹ năng chuyển đổi (transferable skills) rõ rệt.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
