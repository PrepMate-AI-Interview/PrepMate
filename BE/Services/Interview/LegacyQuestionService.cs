using backend.Prompts.Interview;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using backend.Models;
using backend.Services.Storage;

namespace backend.Services.Interview
{
    public class LegacyQuestionService
    {
        private readonly GeminiService _geminiService;
        private readonly FileDb? _fileDb;
        private readonly ISessionLockManager? _sessionLockManager;

        public LegacyQuestionService(
            GeminiService geminiService,
            FileDb? fileDb = null,
            ISessionLockManager? sessionLockManager = null)
        {
            _geminiService = geminiService;
            _fileDb = fileDb;
            _sessionLockManager = sessionLockManager;
        }

        public async Task<LegacyQuestionResult> GenerateAsync(
            NextQuestionRequest request)
        {
            IDisposable? sessionLock = null;
            if (!string.IsNullOrWhiteSpace(request.SessionId) && _sessionLockManager != null)
            {
                sessionLock = await _sessionLockManager.AcquireLockAsync(request.SessionId);
            }

            try
            {
                Session? session = null;
                if (!string.IsNullOrWhiteSpace(request.SessionId) && _fileDb != null)
                {
                    if (_fileDb.Sessions.TryGetValue(request.SessionId, out session))
                    {
                        var isCompleted = session.Status.Equals("completed", StringComparison.OrdinalIgnoreCase) ||
                                          session.InterviewState?.InterviewPhase.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase) == true;
                        if (isCompleted)
                        {
                            return LegacyQuestionResult.BadRequest("Phiên phỏng vấn đã hoàn tất, không thể tiếp tục tạo câu hỏi.");
                        }

                        // Immutable session snapshot is the authoritative SSOT
                        if (!string.IsNullOrWhiteSpace(session.JobTitle))
                        {
                            request.JobTitle = session.JobTitle;
                        }

                        if (!string.IsNullOrWhiteSpace(session.JdText))
                        {
                            request.JdText = session.JdText;
                        }

                        if (session.Answers != null && session.Answers.Count > 0)
                        {
                            request.History = session.Answers
                                .Where(a => !string.IsNullOrWhiteSpace(a.Question) && !string.IsNullOrWhiteSpace(a.Answer))
                                .Select(a => new QAPair { Question = a.Question, Answer = a.Answer })
                                .ToList();
                        }
                    }
                }

                var recentHistory =
                    request.History != null && request.History.Count > 3
                        ? request.History.GetRange(
                            request.History.Count - 3,
                            3)
                        : (request.History ?? new List<QAPair>());

                var prompt = LegacyQuestionPrompt.Build(request, recentHistory);

                var jsonText =
                    await _geminiService
                        .CallGeminiApiForTaskAsync(backend.Models.AI.AITaskType.QuestionGeneration,                            prompt,
                            isJsonMode: true
                        );

                var options =
                    new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };

                var result =
                    JsonSerializer.Deserialize<
                        NextQuestionResponse>(
                            jsonText,
                            options
                        );

                if (result == null)
                {
                    return LegacyQuestionResult.Error(
                        "AI không tạo được câu hỏi."
                    );
                }

                if (session != null && _fileDb != null && !string.IsNullOrWhiteSpace(result.Question))
                {
                    session.Questions ??= new List<string>();
                    session.Questions.Add(result.Question);
                    _fileDb.Sessions[session.Id] = session;
                    _fileDb.Save();
                }

                return LegacyQuestionResult.Success(
                    result
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"NextQuestion error: {ex}"
                );

                return LegacyQuestionResult.Error(
                    "Không thể tạo câu hỏi tiếp theo.",
                    ex.Message
                );
            }
            finally
            {
                sessionLock?.Dispose();
            }
        }
    }

    public class LegacyQuestionResult
    {
        public int StatusCode { get; init; }
        public object? Data { get; init; }

        public static LegacyQuestionResult Success(
            object data)
        {
            return new LegacyQuestionResult
            {
                StatusCode = 200,
                Data = data
            };
        }

        public static LegacyQuestionResult BadRequest(
            string error)
        {
            return new LegacyQuestionResult
            {
                StatusCode = 400,
                Data = new
                {
                    error
                }
            };
        }

        public static LegacyQuestionResult Error(
            string error,
            string? detail = null)
        {
            return new LegacyQuestionResult
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