using System;
using System.Text.Json;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Knowledge
{
    /// <summary>
    /// Blueprint Enrichment Prompt.
    /// Augments a base Knowledge Blueprint with contextual signals and company relevance
    /// calibrated by seniority and operational reality without injecting ungrounded mandatory skills.
    /// </summary>
    public static class BlueprintEnrichmentPrompt
    {
        public static string Build(
            KnowledgeBlueprint blueprint,
            CompanyContext companyContext,
            string position,
            string? experienceLevel = "",
            string? language = InterviewLanguage.Vietnamese)
        {
            var levelStr = !string.IsNullOrWhiteSpace(experienceLevel) ? experienceLevel : "Not specified";
            var blueprintJson = JsonSerializer.Serialize(blueprint, new JsonSerializerOptions { WriteIndented = true });
            var langInstruction = PromptLanguagePolicy.GetInstruction(language);

            var factsStr = companyContext.KnownFacts.Count > 0
                ? string.Join("\n  * ", companyContext.KnownFacts.ConvertAll(f => $"[Fact - {f.Source}] {f.Information}"))
                : "None explicitly provided";

            var inferencesStr = companyContext.Inferences.Count > 0
                ? string.Join("\n  * ", companyContext.Inferences.ConvertAll(i => $"[Inference] {i.Information}"))
                : "None";

            var schema = """
{
  "position": "Tên vị trí",
  "level": "Cấp độ",
  "version": "1.1",
  "areas": [
    {
      "name": "Tên nhóm năng lực",
      "description": "Mô tả",
      "importance": "HIGH | MEDIUM | LOW",
      "requiredLevel": "Junior | Middle | Senior",
      "competencies": ["Năng lực"],
      "concepts": [
        {
          "id": "concept-id",
          "name": "Tên khái niệm",
          "expectedUnderstanding": ["Hiểu biết kỳ vọng"],
          "practicalSignals": ["Dấu hiệu thực tế"],
          "failureSignals": ["Dấu hiệu thiếu sót"],
          "requirementSource": "OFFICIAL | INFERRED",
          "isMandatory": true,
          "contextualSignals": [
            "Tín hiệu vận hành thực tế 1",
            "Tín hiệu vận hành thực tế 2"
          ],
          "companyRelevance": [
            "Lý do năng lực này gắn liền với bối cảnh hoạt động của doanh nghiệp"
          ]
        }
      ]
    }
  ]
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là chuyên gia thiết kế khung năng lực phỏng vấn cấp cao (Senior Competency Architect).

NHIỆM VỤ:
Làm giàu (Enrich) một Knowledge Blueprint đã có từ Job Description (JD) bằng cách bổ sung tín hiệu thực tế (Contextual Signals & Company Relevance) dựa trên bối cảnh doanh nghiệp (Company Context) và cấp độ ứng viên (Seniority / Level).

==================================================
NGUYÊN TẮC BẮT BUỘC:
==================================================
1. JD LÀ NGUỒN CĂN CỨ DUY NHẤT CHO MANDATORY REQUIREMENTS:
   - JD xác định năng lực ứng viên PHẢI có.
   - Bối cảnh doanh nghiệp xác định TẠI SAO năng lực đó quan trọng trong môi trường làm việc thực tế.
   - TUYỆT ĐỐI KHÔNG tự ý biến các công nghệ, công cụ mới thành "Mandatory" chỉ vì ngành/công ty đó thường dùng.

2. BẢO TOÀN NGUỒN GỐC REQUIREMENT:
   - Mọi concept bắt nguồn từ JD phải giữ nguyên requirementSource = "OFFICIAL" và giá trị isMandatory gốc.
   - Nếu đề xuất thêm kỹ năng suy luận từ bối cảnh hoạt động: requirementSource = "INFERRED", isMandatory = false, importance = "MEDIUM" hoặc "LOW".

3. CHỐNG TRÙNG LẶP CONCEPT (DUPLICATE PREVENTION):
   - Tuyệt đối không tạo ra các concept trùng lặp mang cùng ý nghĩa nghiệp vụ.

4. HIỆU CHỈNH THEO CẤP ĐỘ (LEVEL AWARENESS):
   - Cấp độ hiện tại: {{levelStr}}.
   - Junior: Tập trung vào kiến thức nền tảng, quy trình chuẩn, xử lý tình huống thông thường.
   - Mid: Tập trung vào kinh nghiệm thực chiến, giải quyết vấn đề độc lập, tối ưu hóa quy trình, đánh đổi (trade-offs).
   - Senior: Tập trung vào quản trị rủi ro, quy mô lớn, hoạch định chiến lược, xử lý khủng hoảng và năng lực dẫn dắt.

5. BỔ SUNG CONTEXTUAL SIGNALS & COMPANY RELEVANCE CHO TỪNG CONCEPT HIỆN CÓ:
   - contextualSignals: 1 đến 3 tín hiệu vận hành thực tế gợi ý góc nhìn phỏng vấn sâu sắc phù hợp ngành nghề.
   - companyRelevance: 1 đến 2 lý do tại sao năng lực này quan trọng trong môi trường hoạt động của doanh nghiệp.

==================================================
THÔNG TIN ĐẦU VÀO:
==================================================
Vị trí: {{position}}
Cấp độ: {{levelStr}}
Tên doanh nghiệp: {{companyContext.CompanyName}}
Ngành nghề: {{companyContext.Industry}}
Loại hình: {{companyContext.CompanyType}}

Dữ kiện doanh nghiệp đã xác minh:
{{factsStr}}

Suy luận bối cảnh:
{{inferencesStr}}

{{PromptContextBoundary.Wrap("KNOWLEDGE_BLUEPRINT_INPUT", blueprintJson)}}

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
