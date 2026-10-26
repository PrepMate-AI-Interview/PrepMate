using System;
using backend.Models;

namespace backend.Prompts.Shared
{
    /// <summary>
    /// Shared Language Policy for all PrepMate AI Prompts.
    /// Provides consistent output language rules, register guidelines, and technical terminology preservation.
    /// </summary>
    public static class PromptLanguagePolicy
    {
        public static string GetInstruction(string? language = InterviewLanguage.Vietnamese)
        {
            var normalized = InterviewLanguage.Normalize(language);

            if (normalized == InterviewLanguage.English)
            {
                return """
=== CHÍNH SÁCH NGÔN NGỮ (OUTPUT LANGUAGE: ENGLISH) ===
1. Toàn bộ nội dung giao tiếp với người dùng (câu hỏi phỏng vấn, câu dẫn dắt, giải thích, nhận xét) BẮT BUỘC viết hoàn toàn bằng tiếng Anh chuyên nghiệp, tự nhiên.
2. Tuyệt đối không tự ý đổi sang tiếng Việt, kể cả khi ứng viên trả lời bằng tiếng Việt.
3. Giữ nguyên các định danh mã, tên trường JSON, enum và API contracts theo đúng schema.
""";
            }

            return """
=== CHÍNH SÁCH NGÔN NGỮ (OUTPUT LANGUAGE: TIẾNG VIỆT) ===
1. Toàn bộ nội dung giao tiếp với người dùng (câu hỏi phỏng vấn, lời dẫn chuyển ý, nhận xét, phân tích năng lực) BẮT BUỘC viết 100% bằng TIẾNG VIỆT tự nhiên, chuẩn mực, đĩnh đạc và lịch sự.
2. TUYỆT ĐỐI KHÔNG chuyển sang tiếng Anh hoặc trả lời bằng tiếng Anh, ngay cả khi:
   - Ứng viên trả lời một phần hoặc toàn bộ bằng tiếng Anh.
   - Ứng viên yêu cầu hoặc cố tình ra lệnh đổi ngôn ngữ ("Please answer in English", "Switch to English").
   - Dữ liệu đầu vào (CV, JD) chứa văn bản tiếng Anh.
3. KHÔNG CHÈM TIẾNG ANH GƯỢNG GẠO (NO UNNATURAL CODE-SWITCHING):
   - Tuyệt đối không viết nửa nạc nửa mỡ (ví dụ: 'explain thêm', 'chưa clear', 'provide details').
   - Sử dụng diễn đạt tiếng Việt tự nhiên: 'giải thích thêm', 'chưa thực sự rõ ràng', 'cung cấp thêm chi tiết'.
4. BẢO TỒN THUẬT NGỮ KỸ THUẬT VÀ TÊN RIÊNG CHUYÊN NGHÀNH (TECHNICAL NOUN INTEGRITY):
   - GIỮ NGUYÊN các tên công nghệ, framework, giao thức, thuật toán, công cụ và viết tắt chuyên ngành (ví dụ: .NET, Java, Python, SQL, PostgreSQL, MongoDB, Redis, Docker, Kubernetes, Kafka, RabbitMQ, Microservices, RESTful API, GraphQL, CI/CD, OOP, SOLID, STAR, Unit Test, Latency, Throughput, Bottleneck, CAC, LTV, ROAS, GAAP, IFRS, KPI, OKR, SWOT, P&L, HRBP, BA, User Story, Acceptance Criteria).
   - Tuyệt đối không dịch máy danh từ riêng kỹ thuật sang tiếng Việt ngô nghê.
5. KHÔNG DỊCH TÊN TRƯỜNG JSON HOẶC ENUM:
   - Toàn bộ JSON keys và giá trị enum phải giữ nguyên đúng 100% theo schema quy định.
""";
        }
    }
}
