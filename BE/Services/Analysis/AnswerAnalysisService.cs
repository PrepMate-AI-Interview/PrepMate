using backend.Models.AI;
using System;
using System.Text.Json;
using System.Threading.Tasks;
using backend.Models;
using backend.Prompts.Interview;

namespace backend.Services
{
    public class AnswerAnalysisService
    {
        private readonly GeminiService _geminiService;

        public AnswerAnalysisService(GeminiService geminiService)
        {
            _geminiService = geminiService;
        }

        public async Task<AnswerAnalysis> AnalyzeAsync(
            string question,
            string answer,
            string currentTopic,
            string currentSubtopic,
            string targetPosition,
            string priorHistory = "")
        {
            if (string.IsNullOrWhiteSpace(answer))
            {
                return new AnswerAnalysis
                {
                    Summary = "Ứng viên không cung cấp câu trả lời.",
                    DoesNotKnow = true,
                    Confidence = 1.0
                };
            }

            var prompt = AnalysisPrompt.Build(
                targetPosition,
                currentTopic,
                currentSubtopic,
                question,
                answer,
                priorHistory
            );

            try
            {
                var json = await _geminiService.CallGeminiApiForTaskAsync(AITaskType.AnswerEvaluation,                    prompt,
                    isJsonMode: true
                );

                Console.WriteLine();
                Console.WriteLine("========== RAW ANSWER ANALYSIS ==========");
                Console.WriteLine(json);
                Console.WriteLine("==========================================");
                Console.WriteLine();
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var result = JsonSerializer.Deserialize<AnswerAnalysis>(
                    json,
                    options
                );

                return result ?? new AnswerAnalysis
                {
                    Summary = "Không thể phân tích câu trả lời.",
                    Confidence = 0
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"[INTERVIEW] Answer analysis error: {ex.Message}"
                );

                return new AnswerAnalysis
                {
                    Summary = "Phân tích câu trả lời thất bại.",
                    Confidence = 0
                };
            }
        }
    }
}