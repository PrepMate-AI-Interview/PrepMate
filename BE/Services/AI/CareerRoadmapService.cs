using backend.Models.AI;
using System;
using System.Text.Json;
using System.Threading.Tasks;
using backend.Models;

namespace backend.Services.AI
{
    public class CareerRoadmapService
    {
        private readonly GeminiService _geminiService;

        public CareerRoadmapService(
            GeminiService geminiService)
        {
            _geminiService = geminiService;
        }

        public async Task<CareerRoadmapResult> GenerateAsync(
            AnalyzeCvRequest request)
        {
            if (string.IsNullOrWhiteSpace(
                    request.CvText))
            {
                return CareerRoadmapResult.BadRequest(
                    new
                    {
                        error =
                            "Thiếu nội dung CV."
                    });
            }

            try
            {
                var prompt = backend.Prompts.Career.CareerRoadmapPrompt.Build(
                    request.JobTitle ?? ProfessionalDomainClassifier.DefaultPositionTitle,
                    request.CvText
                );

                var jsonText =
                    await _geminiService
                        .CallGeminiApiForTaskAsync(AITaskType.CareerRoadmap,                            prompt,
                            isJsonMode: true
                        );

                var options =
                    new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };

                var roadmap =
                    JsonSerializer.Deserialize<
                        CareerRoadmapResponse>(
                            jsonText,
                            options
                        );

                if (roadmap == null)
                {
                    return CareerRoadmapResult.Error(
                        "AI không tạo được career roadmap."
                    );
                }

                return CareerRoadmapResult.Success(
                    roadmap
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Gemini career roadmap error: {ex}"
                );

                return CareerRoadmapResult.Error(
                    "Không thể tạo career roadmap.",
                    ex.Message
                );
            }
        }
    }

    public class CareerRoadmapResult
    {
        public int StatusCode { get; init; }
        public object? Data { get; init; }

        public static CareerRoadmapResult Success(
            object data)
        {
            return new CareerRoadmapResult
            {
                StatusCode = 200,
                Data = data
            };
        }

        public static CareerRoadmapResult BadRequest(
            object data)
        {
            return new CareerRoadmapResult
            {
                StatusCode = 400,
                Data = data
            };
        }

        public static CareerRoadmapResult Error(
            string error,
            string? detail = null)
        {
            return new CareerRoadmapResult
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