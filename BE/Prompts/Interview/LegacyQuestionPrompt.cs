using System.Collections.Generic;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Interview
{
    /// <summary>
    /// Prompt builder for legacy interview follow-up question generation.
    /// Standardized with shared language policy, context boundaries, and output policy.
    /// </summary>
    public static class LegacyQuestionPrompt
    {
        public static string Build(NextQuestionRequest request, IEnumerable<QAPair> recentHistory)
        {
            var langInstruction = PromptLanguagePolicy.GetInstruction(request.Language);
            var historyText = string.Empty;

            foreach (var qa in recentHistory)
            {
                historyText += $"HR: {qa.Question}\nỨng viên: {qa.Answer}\n\n";
            }

            var topicsText = request.TopicsAsked != null && request.TopicsAsked.Count > 0
                ? "Các chủ đề đã hỏi: " + string.Join(", ", request.TopicsAsked)
                : "Chưa có chủ đề cụ thể.";

            var contextSection = PromptContextBoundary.Wrap("INTERVIEW_HISTORY", string.IsNullOrWhiteSpace(historyText) ? "Chưa có lịch sử câu hỏi." : historyText.Trim());
            var topicsSection = PromptContextBoundary.Wrap("TOPICS_ASKED", topicsText);

            return $$"""
Bạn là chuyên gia nhân sự và người phỏng vấn cho vị trí "{{request.JobTitle}}".

{{langInstruction}}

{{contextSection}}

{{topicsSection}}

QUY TẮC TẠO CÂU HỎI:
1. Nếu câu trả lời gần nhất đề cập nhiều khái niệm hoặc kỹ năng: chọn một điểm cụ thể để hỏi sâu hơn.
2. Tối đa 2-3 câu hỏi đào sâu (follow-up) cho một chủ đề.
3. Nếu đã hỏi đủ follow-up hoặc ứng viên không biết: chuyển sang chủ đề chuyên môn mới phù hợp với vị trí.
4. Tuyệt đối không lặp lại câu hỏi đã hỏi trong lịch sử.
5. Giọng văn tự nhiên, chuyên nghiệp và lịch sự như người phỏng vấn thực tế.
6. Mỗi câu hỏi tối đa 2 câu ngắn gọn, súc tích.

{{PromptOutputPolicy.StrictJsonOnly}}

Định dạng JSON yêu cầu:
{
  "question": "Nội dung câu hỏi phỏng vấn tiếp theo",
  "isFollowUp": true,
  "topic": "Chủ đề của câu hỏi"
}
""";
        }
    }
}
