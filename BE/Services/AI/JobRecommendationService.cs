using backend.Models.AI;
using System;
using System.Text.Json;
using System.Threading.Tasks;
using backend.Models;

namespace backend.Services.AI
{
    public class JobRecommendationService
    {
        private readonly GeminiService _geminiService;

        public JobRecommendationService(
            GeminiService geminiService)
        {
            _geminiService = geminiService;
        }

        public async Task<JobRecommendationResult> RecommendAsync(
            AnalyzeCvRequest request)
        {
            if (string.IsNullOrWhiteSpace(
                    request.CvText))
            {
                return JobRecommendationResult.BadRequest(
                    new
                    {
                        error =
                            "Thiếu nội dung CV."
                    });
            }

            try
            {
                var prompt = backend.Prompts.Career.JobRecommendationPrompt.Build(
                    request.JobTitle ?? ProfessionalDomainClassifier.DefaultPositionTitle,
                    request.CvText
                );

                var jsonText =
                    await _geminiService
                        .CallGeminiApiForTaskAsync(AITaskType.JobRecommendation,                            prompt,
                            isJsonMode: true
                        );

                var options =
                    new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };

                var recommendations =
                    JsonSerializer.Deserialize<
                        JobRecommendationsResponse>(
                            jsonText,
                            options
                        );

                if (recommendations == null)
                {
                    return JobRecommendationResult.Error(
                        "AI không tạo được job recommendations."
                    );
                }

                return JobRecommendationResult.Success(
                    recommendations
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Gemini job recommendation error: {ex}"
                );

                return JobRecommendationResult.Error(
                    "Không thể tạo job recommendations.",
                    ex.Message
                );
            }
        }
    }

    public class JobRecommendationResult
    {
        public int StatusCode { get; init; }
        public object? Data { get; init; }

        public static JobRecommendationResult Success(
            object data)
        {
            return new JobRecommendationResult
            {
                StatusCode = 200,
                Data = data
            };
        }

        public static JobRecommendationResult BadRequest(
            object data)
        {
            return new JobRecommendationResult
            {
                StatusCode = 400,
                Data = data
            };
        }

        public static JobRecommendationResult Error(
            string error,
            string? detail = null)
        {
            return new JobRecommendationResult
            {
                StatusCode = 500,
                Data = detail == null
                    ? new
                    {
                        error
                    }
                    : new
                    {
                        error,
                        detail
                    }
            };
        }
    }
}