using System;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Knowledge
{
    /// <summary>
    /// Knowledge Blueprint Generation Prompt.
    /// Analyzes Job Descriptions across IT, Marketing, Finance, HR, and BA to extract structured competency areas
    /// without domain bias, metric fabrication, or interview question generation.
    /// </summary>
    public static class BlueprintPrompt
    {
        public static string Build(
            string position,
            string jdText,
            string experienceLevel = "",
            CompanyContext? companyContext = null,
            string? language = InterviewLanguage.Vietnamese)
        {
            var truncatedJd = jdText.Length > 6000 ? jdText[..6000] : jdText;
            var levelStr = !string.IsNullOrWhiteSpace(experienceLevel) ? experienceLevel : "Not specified";
            var safePosition = string.IsNullOrWhiteSpace(position) ? ProfessionalDomainClassifier.DefaultPositionTitle : position.Trim();
            var langInstruction = PromptLanguagePolicy.GetInstruction(language);

            var companySection = "";
            if (companyContext != null && !string.IsNullOrWhiteSpace(companyContext.CompanyName))
            {
                companySection = $@"
Bối cảnh công ty tuyển dụng (CHỈ DÙNG THAM KHẢO DOMAIN CONTEXT, TUYỆT ĐỐI KHÔNG TỰ BỊA REQUIREMENT):
- Tên công ty: {companyContext.CompanyName}
- Ngành nghề: {companyContext.Industry}
- Loại hình: {companyContext.CompanyType}
LƯU Ý: Blueprint chỉ chiết xuất những năng lực được yêu cầu hoặc suy luận trực tiếp từ Job Description. Bối cảnh công ty chỉ để hiểu sâu hơn về môi trường làm việc, KHÔNG ĐƯỢC thêm công nghệ hoặc concept mà JD không hề đề cập.
";
            }

            var schema = $$"""
{
  "position": "{{safePosition}}",
  "level": "{{levelStr}}",
  "version": "1.0",
  "areas": [
    {
      "name": "Tên nhóm năng lực phù hợp ngành nghề (ví dụ: Chuyên môn kỹ thuật / Hoạch định chiến dịch / Phân tích tài chính / Quản trị nhân sự / Phân tích yêu cầu)",
      "description": "Mô tả ngắn nhóm năng lực cần đánh giá",
      "importance": "HIGH | MEDIUM | LOW",
      "requiredLevel": "Junior | Middle | Senior",
      "competencies": [
        "Năng lực cụ thể 1",
        "Năng lực cụ thể 2"
      ],
      "concepts": [
        {
          "id": "slug-id (ví dụ: campaign-roi-tracking, credit-risk-modeling, user-story-mapping, sql-indexing)",
          "name": "Tên khái niệm hoặc kỹ năng chuyên môn",
          "expectedUnderstanding": [
            "Hiểu biết kỳ vọng về nguyên lý, quy trình hoặc cơ chế thực thi"
          ],
          "practicalSignals": [
            "Dấu hiệu thực tế cho thấy ứng viên từng vận dụng hiệu quả vào công việc"
          ],
          "failureSignals": [
            "Dấu hiệu hiểu sai bản chất, nhầm lẫn khái niệm hoặc thiếu kỹ năng cơ bản"
          ],
          "requirementSource": "OFFICIAL | INFERRED",
          "isMandatory": true
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

Bạn là chuyên gia phân tích yêu cầu tuyển dụng và kiến trúc khung năng lực (Job Description Analyst & Competency Architect).

NHIỆM VỤ:
Phân tích Mô tả công việc (Job Description - JD) và Vị trí ứng tuyển để xây dựng một BẢN ĐỒ ĐÁNH GIÁ NĂNG LỰC (KNOWLEDGE BLUEPRINT).
Bản đồ này xác định: "ỨNG VIÊN CẦN ĐƯỢC ĐÁNH GIÁ VỀ NHỮNG NĂNG LỰC, KHÁI NIỆM NÀO?".

==================================================
QUY TẮC BẮT BUỘC:
==================================================
1. TUYỆT ĐỐI KHÔNG TẠO CÂU HỎI PHỎNG VẤN:
   - ExpectedUnderstanding, PracticalSignals, FailureSignals PHẢI LÀ TIÊU CHÍ ĐÁNH GIÁ NỘI BỘ, KHÔNG ĐƯỢC LÀ CÂU HỎI.
   - Ví dụ KHÔNG ĐƯỢC VIẾT: "Khái niệm X là gì?", "Bạn hiểu Y thế nào?".
   - Ví dụ ĐÚNG: "Nắm vững quy trình X, hiểu rõ cách phòng ngừa rủi ro Y và tối ưu hiệu quả Z."

2. PHÂN BIỆT BẮT BUỘC (MANDATORY) VÀ ƯU TIÊN / ĐIỂM CỘNG (OPTIONAL / PLUS):
   - Nếu JD nêu yêu cầu cốt lõi ("yêu cầu", "bắt buộc", "required", "must", "kinh nghiệm từ..."):
     * requirementSource = "OFFICIAL", isMandatory = true, importance = "HIGH"
   - Nếu JD nêu điểm cộng ("ưu tiên", "plus", "nice to have", "lợi thế"):
     * requirementSource = "OFFICIAL", isMandatory = false, importance = "MEDIUM" hoặc "LOW"
   - Nếu khái niệm được SUY LUẬN hợp lý từ bối cảnh vị trí:
     * requirementSource = "INFERRED", isMandatory = false, importance = "MEDIUM" hoặc "LOW"

3. TUYỆT ĐỐI KHÔNG BỊA ĐẶT (ZERO HALLUCINATION):
   - Chỉ trích xuất những gì JD thực tế yêu cầu hoặc có căn cứ vững chắc từ ngữ cảnh vị trí.
   - Blueprint nhỏ gọn, chính xác tốt hơn blueprint đồ sộ nhưng chứa đựng thông tin bịa đặt.

4. CẤU TRÚC KNOWLEDGE AREA & COMPETENCIES ĐA NGÀNH:
   - Gom các concept liên quan thành 3 đến 8 nhóm năng lực (Knowledge Areas) tương thích với đúng ngành nghề:
     * Ngành Công nghệ thông tin: Kiến trúc dịch vụ, Tối ưu dữ liệu, Kiểm thử & Chất lượng phần mềm,...
     * Ngành Marketing: Hoạch định chiến lược kênh, Phân tích dữ liệu tăng trưởng, Sáng tạo nội dung,...
     * Ngành Tài chính - Kế toán: Quản trị rủi ro dòng tiền, Kiểm toán & Báo cáo tài chính, Thuế & Tuân thủ,...
     * Ngành Nhân sự: Thu hút nhân tài & Tuyển dụng, Quan hệ lao động, Đào tạo & Phát triển tổ chức,...
     * Ngành Phân tích nghiệp vụ (BA): Khai thác & Quản lý yêu cầu, Mô hình hóa quy trình, Kiểm thử chấp nhận người dùng,...
   - Mỗi Area chứa từ 2 đến 6 Concepts.

==================================================
THÔNG TIN ĐẦU VÀO:
==================================================
Vị trí ứng tuyển: {{safePosition}}
Cấp bậc: {{levelStr}}
{{companySection}}
{{PromptContextBoundary.Wrap("JOB_DESCRIPTION", truncatedJd)}}

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
