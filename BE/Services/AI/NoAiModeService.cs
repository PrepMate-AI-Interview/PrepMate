using System;
using System.Collections.Generic;
using backend.Models;

namespace backend.Services.AI
{
    public class NoAiModeService : INoAiModeService
    {
        private static readonly Dictionary<string, List<string>> QuestionBanks = new(StringComparer.OrdinalIgnoreCase)
        {
            ["cntt"] = new()
            {
                "Hãy mô tả một dự án kỹ thuật phức tạp nhất bạn từng tham gia và vai trò cụ thể của bạn trong việc giải quyết các thách thức kỹ thuật cốt lõi.",
                "Bạn thường tiếp cận việc tối ưu hóa hiệu năng và mở rộng (scaling) hệ thống backend như thế nào khi lưu lượng truy cập tăng đột biến?",
                "Kể về một sự cố production nghiêm trọng bạn từng đối mặt: Nguyên nhân gốc rễ là gì và bạn đã phối hợp xử lý như thế nào?",
                "Bạn áp dụng các nguyên tắc thiết kế phần mềm (SOLID, Clean Architecture, Design Patterns) vào việc xây dựng hệ thống ra sao?",
                "Khi xảy ra bất đồng quan điểm kỹ thuật giữa các thành viên trong team về giải pháp công nghệ, bạn xử lý và đi đến đồng thuận thế nào?"
            },
            ["marketing"] = new()
            {
                "Hãy chia sẻ về một chiến dịch marketing đa kênh thành công nhất bạn từng dẫn dắt: Mục tiêu, ngân sách và chỉ số ROI đạt được là gì?",
                "Bạn phân bổ ngân sách và đo lường hiệu quả chuyển đổi (CAC, LTV, ROAS) giữa các kênh trả phí và tự nhiên như thế nào?",
                "Kể về một chiến dịch không đạt kỳ vọng ban đầu: Bạn đã phân tích nguyên nhân và điều chỉnh chiến lược ra sao?",
                "Bạn xây dựng chân dung khách hàng mục tiêu (buyer persona) và thông điệp truyền thông như thế nào cho một sản phẩm mới?",
                "Làm thế nào để bạn duy trì sự phối hợp chặt chẽ giữa đội ngũ Marketing và đội ngũ Sales để tối ưu hóa tỷ lệ chuyển đổi lead?"
            },
            ["default"] = new()
            {
                "Hãy giới thiệu tóm tắt về bản thân, kinh nghiệm nổi bật nhất và lý do bạn muốn ứng tuyển vào vị trí này.",
                "Mô tả một dự án hoặc mục tiêu thử thách nhất bạn từng hoàn thành vượt kỳ vọng: Bạn đã đóng góp cụ thể điều gì?",
                "Khi phải làm việc dưới áp lực thời gian với nguồn lực hạn chế, bạn sắp xếp thứ tự ưu tiên các đầu việc như thế nào?",
                "Kể về một tình huống bạn phải thuyết phục cấp quản lý hoặc đồng nghiệp chấp nhận một sáng kiến hay thay đổi quy trình mới.",
                "Mục tiêu phát triển nghề nghiệp của bạn trong 2 đến 3 năm tới là gì và vị trí này giúp bạn hiện thực hóa mục tiêu đó ra sao?"
            }
        };

        private readonly AIConfigurationService _configService;

        public NoAiModeService(AIConfigurationService configService)
        {
            _configService = configService ?? throw new ArgumentNullException(nameof(configService));
        }

        public bool IsNoAiActive()
        {
            var config = _configService.GetConfiguration();
            if (!config.Enabled) return true;
            var resolved = _configService.ResolveCredential();
            return string.IsNullOrWhiteSpace(resolved.Key) || string.IsNullOrWhiteSpace(config.BaseUrl);
        }

        public string GetNoAiNotice()
        {
            return "Hệ thống đang hoạt động ở Chế độ Không-AI (No-AI Practice Mode). Câu hỏi và đánh giá được vận hành dựa trên bộ quy tắc chuẩn hóa, không sử dụng mô hình ngôn ngữ lớn (LLM).";
        }

        public string GetCuratedQuestion(string industry, string difficulty, int index)
        {
            var key = string.IsNullOrWhiteSpace(industry) ? "default" : industry.Trim().ToLowerInvariant();
            if (!QuestionBanks.TryGetValue(key, out var bank))
            {
                bank = QuestionBanks["default"];
            }

            var safeIndex = Math.Max(0, index) % bank.Count;
            return bank[safeIndex];
        }

        public AnswerAnalysis AnalyzeAnswerRuleBased(string question, string answer, string targetCompetency)
        {
            var ans = (answer ?? "").Trim();
            var wordCount = ans.Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries).Length;

            // Explicitly declared as rule-based heuristic
            var analysis = new AnswerAnalysis
            {
                MainConcept = targetCompetency,
                Summary = $"[No-AI Mode: Đánh giá theo quy tắc] Câu trả lời gồm {wordCount} từ.",
                ShowsPracticalExperience = wordCount >= 30,
                DoesNotKnow = wordCount < 5 || ans.ToLowerInvariant().Contains("không biết") || ans.ToLowerInvariant().Contains("chưa làm"),
                NeedsClarification = wordCount >= 5 && wordCount < 20,
                Confidence = 0.7
            };

            if (analysis.DoesNotKnow)
            {
                analysis.Depth = 1;
                analysis.Summary = "[No-AI Mode] Ứng viên chưa cung cấp đủ nội dung kinh nghiệm cho câu hỏi này.";
            }
            else if (wordCount >= 80)
            {
                analysis.Depth = 4;
                analysis.Summary = "[No-AI Mode] Câu trả lời có độ dài và cấu trúc tốt, có đề cập đến quá trình triển khai thực tế.";
                analysis.VerifiedFacts.Add($"Đã trình bày chi tiết về {targetCompetency}");
            }
            else if (wordCount >= 35)
            {
                analysis.Depth = 3;
                analysis.Summary = "[No-AI Mode] Câu trả lời tương đối đầy đủ nhưng cần thêm số liệu và kết quả định lượng.";
            }
            else
            {
                analysis.Depth = 2;
                analysis.Summary = "[No-AI Mode] Câu trả lời ngắn gọn, khuyến khích ứng viên chia sẻ chi tiết hơn theo mô hình STAR.";
            }

            return analysis;
        }

        public string GenerateQuestionRuleBased(string targetPosition, string lastAnswer, int questionIndex)
        {
            var bank = QuestionBanks["default"];
            if (!string.IsNullOrWhiteSpace(targetPosition))
            {
                var lowerPos = targetPosition.ToLowerInvariant();
                if (lowerPos.Contains("developer") || lowerPos.Contains("engineer") || lowerPos.Contains("cntt") || lowerPos.Contains("it") || lowerPos.Contains("phần mềm"))
                {
                    bank = QuestionBanks["cntt"];
                }
                else if (lowerPos.Contains("marketing") || lowerPos.Contains("seo") || lowerPos.Contains("content"))
                {
                    bank = QuestionBanks["marketing"];
                }
            }

            var safeIndex = Math.Max(0, questionIndex) % bank.Count;
            return bank[safeIndex];
        }
    }
}
