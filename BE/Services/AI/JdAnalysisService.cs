using System;
using System.Text.Json;
using System.Threading.Tasks;
using backend.Models;
using backend.Models.AI;
using backend.Prompts.Career;

namespace backend.Services.AI
{
    public class JdAnalysisService
    {
        private readonly GeminiService _geminiService;

        public JdAnalysisService(GeminiService geminiService)
        {
            _geminiService = geminiService;
        }

        public async Task<JdAnalysisResult> AnalyzeAsync(AnalyzeJdRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.JdText))
            {
                return JdAnalysisResult.BadRequest(new { error = "Thiếu nội dung Job Description (JD)." });
            }

            if (request.JdText.Length > 100000)
            {
                return JdAnalysisResult.BadRequest(new { error = "Nội dung JD vượt quá giới hạn cho phép (100.000 ký tự)." });
            }

            try
            {
                var prompt = JdAnalysisPrompt.Build(
                    request.JobTitle ?? "Developer",
                    request.JdText,
                    request.Industry,
                    request.Seniority,
                    request.Language == "en" ? InterviewLanguage.English : InterviewLanguage.Vietnamese
                );

                var jsonText = await _geminiService.CallGeminiApiForTaskAsync(
                    AITaskType.JdAnalysis,
                    prompt,
                    isJsonMode: true
                );

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var analysis = JsonSerializer.Deserialize<AnalyzeJdResponse>(jsonText, options);

                if (analysis == null)
                {
                    return JdAnalysisResult.Error("AI không thể trích xuất cấu trúc phân tích JD.");
                }

                // If targetRole is empty, fallback to supplied JobTitle
                if (string.IsNullOrWhiteSpace(analysis.TargetRole))
                {
                    analysis.TargetRole = request.JobTitle ?? "Vị trí tuyển dụng theo JD";
                }

                return JdAnalysisResult.Success(analysis);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[JD_ANALYSIS_SERVICE] Gemini JD analysis error: {ex}");
                return JdAnalysisResult.Error("Không thể phân tích Job Description qua AI.", ex.Message);
            }
        }
    }

    public class JdAnalysisResult
    {
        public int StatusCode { get; init; }
        public object? Data { get; init; }

        public static JdAnalysisResult Success(object data)
        {
            return new JdAnalysisResult
            {
                StatusCode = 200,
                Data = data
            };
        }

        public static JdAnalysisResult BadRequest(object errorData)
        {
            return new JdAnalysisResult
            {
                StatusCode = 400,
                Data = errorData
            };
        }

        public static JdAnalysisResult Error(string message, string? detail = null)
        {
            return new JdAnalysisResult
            {
                StatusCode = 500,
                Data = new
                {
                    error = message,
                    detail = detail
                }
            };
        }
    }
}
