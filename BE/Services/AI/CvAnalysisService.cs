using backend.Models.AI;
using System;
using System.Text.Json;
using System.Threading.Tasks;
using backend.Models;

namespace backend.Services.AI
{
    public class CvAnalysisService
    {
        private readonly GeminiService _geminiService;

        public CvAnalysisService(
            GeminiService geminiService)
        {
            _geminiService = geminiService;
        }

        public async Task<CvAnalysisResult> AnalyzeAsync(
            AnalyzeCvRequest request)
        {
            if (string.IsNullOrWhiteSpace(
                    request.CvText))
            {
                return CvAnalysisResult.BadRequest(
                    new
                    {
                        error =
                            "Thiếu nội dung CV."
                    });
            }

            try
            {
                var prompt = backend.Prompts.Career.CvAnalysisPrompt.Build(
                    request.JobTitle ?? "Developer",
                    request.CvText,
                    request.UserDescription,
                    request.Language == "en" ? InterviewLanguage.English : InterviewLanguage.Vietnamese
                );

                var jsonText =
                    await _geminiService
                        .CallGeminiApiForTaskAsync(AITaskType.CvAnalysis,                            prompt,
                            isJsonMode: true
                        );

                var options =
                    new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };

                var analysis =
                    JsonSerializer.Deserialize<
                        AnalyzeCvResponse>(
                            jsonText,
                            options
                        );

                if (analysis == null)
                {
                    return CvAnalysisResult.Error(
                        "AI không phân tích được CV."
                    );
                }

                return CvAnalysisResult.Success(
                    analysis
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Gemini CV analysis error: {ex}"
                );

                return CvAnalysisResult.Error(
                    "Không thể phân tích CV.",
                    ex.Message
                );
            }
        }
    }

    public class CvAnalysisResult
    {
        public int StatusCode { get; init; }
        public object? Data { get; init; }

        public static CvAnalysisResult Success(
            object data)
        {
            return new CvAnalysisResult
            {
                StatusCode = 200,
                Data = data
            };
        }

        public static CvAnalysisResult BadRequest(
            object data)
        {
            return new CvAnalysisResult
            {
                StatusCode = 400,
                Data = data
            };
        }

        public static CvAnalysisResult Error(
            string error,
            string? detail = null)
        {
            return new CvAnalysisResult
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