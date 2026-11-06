using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using backend.Models;
using backend.Prompts.Interview;
using backend.Services.AI;

namespace backend.Services.Interview
{
    public class ClosingService : IClosingService
    {
        private readonly GeminiService? _geminiService;

        public ClosingService(GeminiService? geminiService = null)
        {
            _geminiService = geminiService;
        }

                public async Task<ClosingResult> GenerateClosingStatementAsync(Session session)
        {
            var candidateName = session.InterviewContext?.FullName ?? "bạn";
            var company = session.InterviewContext?.TargetCompany ?? "chúng tôi";

            if (_geminiService != null)
            {
                try
                {
                    var prompt = ClosingPrompt.BuildClosingStatementPrompt(session);
                    var rawJson = await _geminiService.CallGeminiApiAsync(prompt, isJsonMode: true);
                    var cleaned = rawJson.Trim();
                    if (cleaned.StartsWith("```json")) cleaned = cleaned.Substring(7);
                    if (cleaned.StartsWith("```")) cleaned = cleaned.Substring(3);
                    if (cleaned.EndsWith("```")) cleaned = cleaned.Substring(0, cleaned.Length - 3);
                    cleaned = cleaned.Trim();

                    using var doc = JsonDocument.Parse(cleaned);
                    var root = doc.RootElement;
                    var stmt = GetString(root, "closingStatement");
                    var nextStepKnown = root.TryGetProperty("nextStepKnown", out var nsk) && nsk.GetBoolean();

                    if (!string.IsNullOrWhiteSpace(stmt))
                    {
                        var sanitized = SanitizeClosingStatement(stmt);
                        if (!string.IsNullOrWhiteSpace(sanitized))
                        {
                            return new ClosingResult
                            {
                                ClosingStatement = sanitized,
                                IsCompleted = false,
                                Evidence = new ClosingEvidence
                                {
                                    Completed = true,
                                    NextStepKnown = nextStepKnown,
                                    Professionalism = "High",
                                    Engagement = "High",
                                    ClosingQuality = "High",
                                    EvidenceStrength = "Strong"
                                }
                            };
                        }
                    }
                }
                catch (Exception)
                {
                    // Fall back to deterministic context-grounded closing statement
                }
            }

            var lastAnswerObj = session.Answers != null
                ? System.Linq.Enumerable.LastOrDefault(session.Answers, a =>
                    !string.Equals(a.Question, "Giới thiệu bản thân", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(a.Stage, InterviewStageNames.Introduction, StringComparison.OrdinalIgnoreCase))
                : null;

            string defaultStatement;
            if (lastAnswerObj != null && !string.IsNullOrWhiteSpace(lastAnswerObj.Answer) && lastAnswerObj.Answer.Trim().Length >= 10)
            {
                defaultStatement = $"Cảm ơn bạn đã chia sẻ cụ thể về cách tiếp cận của mình trong phần trao đổi vừa rồi. Như vậy, chúng ta đã hoàn thành buổi phỏng vấn hôm nay. PrepMate đang phân tích các câu trả lời và sẽ chuẩn bị báo cáo đánh giá chi tiết cho bạn ngay sau đây.";
            }
            else
            {
                defaultStatement = $"Cảm ơn bạn đã dành thời gian tham gia buổi trao đổi hôm nay. Như vậy, chúng ta đã hoàn thành toàn bộ phần phỏng vấn. PrepMate đang phân tích kết quả và chuẩn bị báo cáo đánh giá cho bạn ngay sau đây.";
            }

            return new ClosingResult
            {
                ClosingStatement = defaultStatement,
                IsCompleted = false,
                Evidence = new ClosingEvidence
                {
                    Completed = true,
                    NextStepKnown = true,
                    Professionalism = "High",
                    Engagement = "High",
                    ClosingQuality = "High",
                    EvidenceStrength = "Strong"
                }
            };
        }

                private static string SanitizeClosingStatement(string stmt)
        {
            if (string.IsNullOrWhiteSpace(stmt)) return string.Empty;
            var trimmed = stmt.Trim();
            trimmed = trimmed.Trim('"', '\'', '`', ' ');

            var rawSentences = trimmed.Split(new[] { '.', '!', '?' }, StringSplitOptions.RemoveEmptyEntries);
            var cleanParts = new List<string>();
            foreach (var p in rawSentences)
            {
                var pTrim = p.Trim();
                if (string.IsNullOrWhiteSpace(pTrim)) continue;
                if (pTrim.StartsWith("Bạn có", StringComparison.OrdinalIgnoreCase) ||
                    pTrim.StartsWith("Anh/chị có", StringComparison.OrdinalIgnoreCase) ||
                    pTrim.Contains("câu hỏi nào", StringComparison.OrdinalIgnoreCase) ||
                    pTrim.EndsWith('?'))
                {
                    continue;
                }
                cleanParts.Add(pTrim);
            }

            if (cleanParts.Count == 0) return string.Empty;

            // Keep at most 3 concise sentences as specified by WI-INTERVIEW-DEMO-02
            if (cleanParts.Count > 3)
            {
                cleanParts = System.Linq.Enumerable.ToList(System.Linq.Enumerable.Take(cleanParts, 3));
            }

            return string.Join(". ", cleanParts) + ".";
        }


        public async Task<ClosingEvidence> AnalyzeClosingResponseAsync(Session session, string candidateFinalStatement)
        {
            if (string.IsNullOrWhiteSpace(candidateFinalStatement))
            {
                return new ClosingEvidence
                {
                    Completed = true,
                    Professionalism = "Medium",
                    Engagement = "Medium",
                    ClosingQuality = "Medium",
                    EvidenceStrength = "Moderate",
                    CandidateFinalStatement = string.Empty
                };
            }

            var cleanStmt = candidateFinalStatement.Trim();

            if (_geminiService != null)
            {
                try
                {
                    var prompt = ClosingPrompt.BuildClosingAnalysisPrompt(session, cleanStmt);
                    var rawJson = await _geminiService.CallGeminiApiAsync(prompt, isJsonMode: true);
                    var cleaned = rawJson.Trim();
                    if (cleaned.StartsWith("```json")) cleaned = cleaned.Substring(7);
                    if (cleaned.StartsWith("```")) cleaned = cleaned.Substring(3);
                    if (cleaned.EndsWith("```")) cleaned = cleaned.Substring(0, cleaned.Length - 3);
                    cleaned = cleaned.Trim();

                    using var doc = JsonDocument.Parse(cleaned);
                    var root = doc.RootElement;

                    var prof = GetString(root, "professionalism", "High");
                    var eng = GetString(root, "engagement", "High");
                    var qual = GetString(root, "closingQuality", "High");

                    var ev = new ClosingEvidence
                    {
                        Completed = true,
                        Professionalism = prof,
                        Engagement = eng,
                        ClosingQuality = qual,
                        CandidateFinalStatement = cleanStmt,
                        EvidenceStrength = cleanStmt.Length > 15 ? "Strong" : "Moderate"
                    };

                    if (root.TryGetProperty("unresolvedQuestions", out var uq) && uq.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in uq.EnumerateArray())
                        {
                            var s = item.GetString();
                            if (!string.IsNullOrWhiteSpace(s)) ev.UnresolvedQuestions.Add(s);
                        }
                    }

                    return ev;
                }
                catch (Exception)
                {
                    // Fall back
                }
            }

            var lower = cleanStmt.ToLowerInvariant();
            var isPolite = lower.Contains("cảm ơn") || lower.Contains("thank") || lower.Contains("chào") || lower.Contains("hẹn gặp");

            return new ClosingEvidence
            {
                Completed = true,
                Professionalism = isPolite ? "High" : "Medium",
                Engagement = cleanStmt.Length > 20 ? "High" : "Medium",
                ClosingQuality = isPolite ? "High" : "Medium",
                CandidateFinalStatement = cleanStmt,
                EvidenceStrength = isPolite ? "Strong" : "Moderate"
            };
        }

        private static string GetString(JsonElement root, string prop, string defaultValue = "")
        {
            if (root.TryGetProperty(prop, out var el) && el.ValueKind == JsonValueKind.String)
            {
                var s = el.GetString();
                return string.IsNullOrWhiteSpace(s) ? defaultValue : s;
            }
            return defaultValue;
        }
    }
}
