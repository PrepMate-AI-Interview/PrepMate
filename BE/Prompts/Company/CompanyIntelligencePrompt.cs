using System;
using backend.Prompts.Shared;

namespace backend.Prompts.Company
{
    /// <summary>
    /// Company Intelligence Extraction Prompt.
    /// Extracts verified company background facts and operational inferences from JD and company description
    /// while strictly maintaining Fact vs Inference separation and zero hallucination.
    /// </summary>
    public static class CompanyIntelligencePrompt
    {
        public static string BuildExtractionPrompt(
            string companyName,
            string? jdText,
            string? companyDescription,
            string? companyUrl)
        {
            var schema = $$"""
{
  "CompanyName": "{{companyName}}",
  "Industry": "<Tên ngành nghề chính hoặc Unknown>",
  "CompanyType": "<Loại hình: Startup, Enterprise, Fintech, ProductCompany, Outsourcing, BigTech, hoặc Unknown>",
  "SourceReliability": "<OFFICIAL | TRUSTED_EXTERNAL | CANDIDATE_REPORTED | INFERRED | UNKNOWN>",
  "IsVerified": true,
  "VerificationNotes": "<Ghi chú ngắn gọn về nguồn trích xuất dữ liệu>",
  "KnownFacts": [
    {
      "Information": "<Dữ kiện thực tế được nêu trực tiếp trong văn bản>",
      "Source": "<JOB_DESCRIPTION | COMPANY_DESCRIPTION | OFFICIAL>",
      "Reliability": "<OFFICIAL | TRUSTED_EXTERNAL>",
      "IsVerified": true
    }
  ],
  "Inferences": [
    {
      "Information": "<Suy luận hợp lý về bối cảnh vận hành hoặc quy mô>",
      "Source": "INFERRED",
      "Reliability": "INFERRED",
      "IsVerified": false
    }
  ]
}
""";

            return $$"""
{{PromptLanguagePolicy.GetInstruction("vi-VN")}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là chuyên gia thẩm định và phân tích thông tin doanh nghiệp (Corporate Intelligence Analyst).
Mục tiêu: Trích xuất thông tin doanh nghiệp chuẩn xác, có cấu trúc để phục vụ ngữ cảnh phỏng vấn cho công ty: "{{companyName}}".

==================================================
QUY TẮC BẮT BUỘC VỀ BẰNG CHỨNG (ZERO FABRICATION):
==================================================
1. PHÂN BIỆT RẠCH RÒI SỰ THẬT (FACT) VÀ SUY LUẬN (INFERENCE):
   - Chỉ đánh dấu là sự thật (Reliability: "OFFICIAL" hoặc "TRUSTED_EXTERNAL", IsVerified: true) nếu thông tin đó được nêu TRỰC TIẾP, RÕ RÀNG trong Mô tả công việc (JD) hoặc Mô tả công ty được cung cấp.
   - Nếu bạn suy luận một đặc điểm vận hành dựa trên kiến thức ngành nhưng không được văn bản nêu trực tiếp, BẮT BUỘC phải đánh dấu Reliability là "INFERRED", IsVerified là false, và đưa vào danh sách "Inferences".
   - TUYỆT ĐỐI KHÔNG tự bịa đặt kiến trúc nội bộ bí mật, tên dự án mật, số liệu doanh thu không kiểm chứng.
   - Nếu không thể xác định ngành nghề hoặc loại hình công ty với độ tin cậy cao, hãy ghi nhận giá trị "Unknown".
2. TÁCH BIỆT KHỎI YÊU CẦU NĂNG LỰC:
   - Bạn CHỈ phân tích bối cảnh công ty (ngành nghề, loại hình, lĩnh vực kinh doanh, quy mô).
   - KHÔNG tạo câu hỏi phỏng vấn hay danh sách kỹ năng của ứng viên trong bước này.
3. PHƯƠNG ÁN DỰ PHÒNG:
   - Nếu tên công ty là chung chung hoặc không có đủ dữ liệu đầu vào, trả về "Unknown" cho Industry và CompanyType cùng các mảng dữ liệu rỗng [].

==================================================
DỮ LIỆU ĐẦU VÀO
==================================================
Tên công ty: {{companyName}}
Website / Domain: {{companyUrl ?? "Không có"}}

{{PromptContextBoundary.Wrap("COMPANY_DESCRIPTION", companyDescription)}}

{{PromptContextBoundary.Wrap("JOB_DESCRIPTION", jdText)}}

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
