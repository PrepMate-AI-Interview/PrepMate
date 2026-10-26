using System;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Career
{
    /// <summary>
    /// Prompt for generating a multi-step career progression roadmap.
    /// </summary>
    public static class CareerRoadmapPrompt
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
  "roadmap": [
    {
      "step": "1",
      "advice": "Lời khuyên hành động ngắn hạn cụ thể (0 - 6 tháng)"
    },
    {
      "step": "2",
      "advice": "Mục tiêu trung hạn nâng cao năng lực và vị thế chuyên môn (6 - 18 tháng)"
    },
    {
      "step": "3",
      "advice": "Định hướng dài hạn hướng tới vị trí dẫn dắt hoặc chuyên gia (18 - 36 tháng)"
    }
  ]
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là chuyên gia tư vấn phát triển sự nghiệp và hoạch định lộ trình thăng tiến.
Nhiệm vụ: Dựa vào hồ sơ thực tế của ứng viên và vị trí mục tiêu "{{safeJob}}", xây dựng lộ trình phát triển nghề nghiệp 3 bước cụ thể, khả thi.

====================
DỮ LIỆU ĐẦU VÀO
====================
Vị trí mục tiêu: {{safeJob}}

{{PromptContextBoundary.Wrap("CANDIDATE_CV", cvTruncated)}}

====================
YÊU CẦU HOẠCH ĐỊNH
====================
1. Xây dựng 3 bước phát triển rõ ràng từ hiện tại hướng tới làm chủ vị trí mục tiêu.
2. Lời khuyên (advice) phải thực tế, tập trung vào kỹ năng chuyên môn cần trau dồi, chứng chỉ uy tín nếu cần, và cách tích lũy kinh nghiệm qua dự án thực tế.
3. Không đưa ra lời khuyên chung chung, sáo rỗng.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
