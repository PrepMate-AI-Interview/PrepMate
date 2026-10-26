using System;

namespace backend.Prompts.Shared
{
    /// <summary>
    /// Strict Structured Output (JSON) Contract Policy.
    /// Ensures model responses strictly parseable without markdown formatting issues.
    /// </summary>
    public static class PromptOutputPolicy
    {
        public const string StrictJsonOnly = """
=== ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (STRICT JSON ONLY) ===
1. Trả về DUY NHẤT một đối tượng JSON hợp lệ.
2. TUYỆT ĐỐI KHÔNG sử dụng markdown code fences (KHÔNG bọc trong ```json hay ```).
3. TUYỆT ĐỐI KHÔNG thêm bất kỳ câu giải thích, lời chào hay văn bản dẫn dắt nào trước hoặc sau khối JSON.
4. Giữ nguyên chính xác tên các trường JSON (case-sensitive) và kiểu dữ liệu quy định.
""";

        public static string GetJsonContract(string schemaDescription)
        {
            return $"""
=== ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (STRICT JSON ONLY) ===
1. Trả về DUY NHẤT một đối tượng JSON hợp lệ tuân thủ đúng 100% cấu trúc schema dưới đây.
2. TUYỆT ĐỐI KHÔNG sử dụng markdown code fences (KHÔNG bọc trong ```json hay ```).
3. TUYỆT ĐỐI KHÔNG thêm bất kỳ câu giải thích, lời chào hay văn bản dẫn dắt nào trước hoặc sau khối JSON.
4. Giữ nguyên chính xác tên các trường JSON (case-sensitive) và kiểu dữ liệu quy định.

CẤU TRÚC JSON YÊU CẦU:
{schemaDescription}
""";
        }
    }
}
