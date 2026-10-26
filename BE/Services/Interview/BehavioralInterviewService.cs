using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using backend.Models;
using backend.Prompts.Interview;
using backend.Services.AI;

namespace backend.Services.Interview
{
    public class BehavioralInterviewService : IBehavioralInterviewService
    {
        private readonly GeminiService? _geminiService;

        private static readonly Dictionary<string, string> BaseQuestions = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Conflict"] = "Bạn hãy chia sẻ về một lần xảy ra bất đồng quan điểm chuyên môn giữa bạn và đồng nghiệp trong dự án, và cách bạn giải quyết bất đồng đó?",
            ["Failure"] = "Hãy kể về một tình huống mà một tính năng hoặc giải pháp bạn triển khai không hoạt động như kỳ vọng hoặc gặp sự cố. Bạn đã xử lý thế nào?",
            ["Deadline"] = "Hãy chia sẻ về một dự án mà bạn phải làm việc dưới áp lực thời gian rất gấp để kịp tiến độ bàn giao. Bạn đã tổ chức công việc ra sao?",
            ["Leadership"] = "Hãy kể về một lần bạn chủ động đứng ra giải quyết một vấn đề quan trọng của dự án mà việc đó ban đầu không được phân công cụ thể cho bạn?",
            ["Feedback"] = "Hãy chia sẻ về một lần bạn nhận được phản hồi hoặc góp ý mang tính phê bình khó nghe từ quản lý hoặc đồng nghiệp, và bạn đã tiếp nhận nó ra sao?",
            ["Mistake"] = "Hãy kể về một sai lầm chuyên môn mà bạn đã từng mắc phải trong quá trình làm việc và bài học lớn nhất bạn rút ra từ đó là gì?",
            ["Adaptation"] = "Hãy chia sẻ về một lần yêu cầu dự án bị thay đổi đột ngột hoặc phạm vi thay đổi lớn ngay giữa quá trình phát triển, bạn đã thích ứng thế nào?",
            ["Collaboration"] = "Hãy kể về một tình huống làm việc nhóm phức tạp và phần đóng góp cụ thể của riêng cá nhân bạn vào thành công chung của team?"
        };

        public BehavioralInterviewService(GeminiService? geminiService = null)
        {
            _geminiService = geminiService;
        }

        public async Task<GeneratedQuestion> GenerateQuestionAsync(Session session, BehavioralEvidence? previousEvidence = null)
        {
            var targetPosition = session.InterviewContext?.TargetPosition ?? session.JobTitle ?? ProfessionalDomainClassifier.DefaultPositionTitle;
            var seniority = session.InterviewContext?.ExperienceLevel ?? session.InterviewState?.CandidateLevel ?? "Mid-level";

            // 1. Follow-up check: If previous evidence is missing key STAR components, generate a targeted follow-up
            if (previousEvidence != null && previousEvidence.MissingComponents != null && previousEvidence.MissingComponents.Count > 0)
            {
                var parentId = session.InterviewState?.LastParentQuestionId ?? session.Questions?.LastOrDefault();
                var followUpQuestionText = BuildFollowUpText(previousEvidence);

                return new GeneratedQuestion
                {
                    Question = followUpQuestionText,
                    QuestionId = Guid.NewGuid().ToString(),
                    ParentQuestionId = parentId,
                    Topic = "Behavioral",
                    Subtopic = previousEvidence.Competency,
                    Dimension = "BEHAVIORAL",
                    QuestionType = "Behavioral_FollowUp",
                    Stage = InterviewStageNames.BehavioralStar,
                    Competency = previousEvidence.Competency,
                    IsFollowUp = true,
                    Reason = $"Targeted follow-up probing missing components: {string.Join(", ", previousEvidence.MissingComponents)}"
                };
            }

            // 2. Select a new competency not yet asked in this session
            var askedCompetencies = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (session.Answers != null)
            {
                foreach (var ans in session.Answers)
                {
                    if (ans.BehavioralEvidence != null && !string.IsNullOrWhiteSpace(ans.BehavioralEvidence.Competency))
                    {
                        askedCompetencies.Add(ans.BehavioralEvidence.Competency);
                    }
                }
            }

            var candidateCompetencies = BaseQuestions.Keys
                .Where(c => !askedCompetencies.Contains(c))
                .ToList();

            if (candidateCompetencies.Count == 0)
            {
                candidateCompetencies = BaseQuestions.Keys.ToList();
            }

            // Prioritize by seniority if available
            string chosenCompetency;
            if (seniority.Contains("Senior", StringComparison.OrdinalIgnoreCase) || seniority.Contains("Lead", StringComparison.OrdinalIgnoreCase))
            {
                chosenCompetency = candidateCompetencies.FirstOrDefault(c => c == "Leadership" || c == "Conflict" || c == "Failure")
                                   ?? candidateCompetencies.First();
            }
            else
            {
                chosenCompetency = candidateCompetencies.FirstOrDefault(c => c == "Collaboration" || c == "Adaptation" || c == "Deadline")
                                   ?? candidateCompetencies.First();
            }

            var baseText = BaseQuestions[chosenCompetency];
            var newQuestionId = Guid.NewGuid().ToString();

            if (session.InterviewState != null)
            {
                session.InterviewState.LastParentQuestionId = newQuestionId;
                session.InterviewState.ActiveBehavioralCompetency = chosenCompetency;
            }

            return new GeneratedQuestion
            {
                Question = baseText,
                QuestionId = newQuestionId,
                ParentQuestionId = null,
                Topic = "Behavioral",
                Subtopic = chosenCompetency,
                Dimension = "BEHAVIORAL",
                QuestionType = "Behavioral",
                Stage = InterviewStageNames.BehavioralStar,
                Competency = chosenCompetency,
                IsFollowUp = false,
                Reason = $"Core behavioral question evaluating {chosenCompetency} under STAR framework"
            };
        }

        public async Task<BehavioralEvidence> AnalyzeAnswerAsync(
            Session session,
            string question,
            string answer,
            string? parentQuestionId = null)
        {
            var targetPosition = session.InterviewContext?.TargetPosition ?? session.JobTitle ?? ProfessionalDomainClassifier.DefaultPositionTitle;
            var seniority = session.InterviewContext?.ExperienceLevel ?? session.InterviewState?.CandidateLevel ?? "Mid-level";
            var competency = session.InterviewState?.ActiveBehavioralCompetency ?? "Collaboration";

            BehavioralEvidence currentEvidence;

            // Prior context from parent if follow-up
            string priorContext = "";
            AnswerItem? parentAnswer = null;
            if (!string.IsNullOrWhiteSpace(parentQuestionId) && session.Answers != null)
            {
                parentAnswer = session.Answers.LastOrDefault(a => a.QuestionId == parentQuestionId || a.ParentQuestionId == parentQuestionId);
                if (parentAnswer?.BehavioralEvidence != null)
                {
                    priorContext = $"Lượt trước - Tình huống: {parentAnswer.BehavioralEvidence.Situation}; Hành động: {parentAnswer.BehavioralEvidence.Action}; Kết quả: {parentAnswer.BehavioralEvidence.Result}";
                }
            }

            if (_geminiService != null)
            {
                try
                {
                    var prompt = BehavioralPrompt.BuildAnalysisPrompt(targetPosition, seniority, competency, question, answer, priorContext);
                    var aiJson = await _geminiService.CallGeminiApiAsync(prompt, isJsonMode: true);
                    currentEvidence = ParseAiEvidence(aiJson, competency, answer);
                }
                catch (Exception)
                {
                    // Fallback resilience: Never crash, never fabricate STAR
                    currentEvidence = FallbackEvidence(competency, answer);
                }
            }
            else
            {
                currentEvidence = FallbackEvidence(competency, answer);
            }

            // Evidence Aggregation: If this is a follow-up response, merge with parent evidence
            if (parentAnswer?.BehavioralEvidence != null)
            {
                currentEvidence = AggregateEvidence(parentAnswer.BehavioralEvidence, currentEvidence);
            }

            return currentEvidence;
        }

        private static string BuildFollowUpText(BehavioralEvidence prev)
        {
            if (prev.MissingComponents.Contains("SITUATION", StringComparer.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(prev.Situation))
            {
                return "Trước khi đi vào cách xử lý, tình huống lúc đó cụ thể như thế nào và nguyên nhân phát sinh từ đâu?";
            }

            if (prev.Ownership == "Low" || prev.Ownership == "Unclear" || prev.MissingComponents.Contains("OWNERSHIP", StringComparer.OrdinalIgnoreCase))
            {
                return "Cụ thể trong tình huống đó, phần trách nhiệm và những hành động do trực tiếp cá nhân bạn thực hiện là gì?";
            }

            if (prev.MissingComponents.Contains("ACTION", StringComparer.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(prev.Action))
            {
                return "Cụ thể bạn đã trực tiếp thực hiện những giải pháp hoặc hành động nào để giải quyết vấn đề đó?";
            }

            if (prev.MissingComponents.Contains("RESULT", StringComparer.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(prev.Result))
            {
                return "Sau khi bạn thực hiện các hành động đó thì kết quả cụ thể ra sao, có đo lường hoặc ghi nhận được tác động nào không?";
            }

            if (prev.MissingComponents.Contains("REFLECTION", StringComparer.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(prev.Reflection))
            {
                return "Nhìn lại tình huống đó, nếu có cơ hội làm lại bạn sẽ thay đổi điều gì hoặc rút ra bài học kinh nghiệm gì cho bản thân?";
            }

            return "Bạn có thể chia sẻ thêm về những kết quả cụ thể hoặc bài học kinh nghiệm rút ra từ tình huống này không?";
        }

        private static BehavioralEvidence ParseAiEvidence(string rawJson, string defaultCompetency, string answer)
        {
            if (string.IsNullOrWhiteSpace(rawJson))
            {
                return FallbackEvidence(defaultCompetency, answer);
            }

            try
            {
                var cleaned = rawJson.Trim();
                if (cleaned.StartsWith("```json")) cleaned = cleaned.Substring(7);
                if (cleaned.StartsWith("```")) cleaned = cleaned.Substring(3);
                if (cleaned.EndsWith("```")) cleaned = cleaned.Substring(0, cleaned.Length - 3);
                cleaned = cleaned.Trim();

                using var doc = JsonDocument.Parse(cleaned);
                var root = doc.RootElement;

                var isRefusal = IsNegativeOrRefusal(answer);

                var aiSituation = GetString(root, "situation");
                var aiTask = GetString(root, "task");
                var aiAction = GetString(root, "action");
                var aiResult = GetString(root, "result");
                var aiReflection = GetString(root, "reflection");

                var ev = new BehavioralEvidence
                {
                    Ownership = GetString(root, "ownership", "Unclear"),
                    Specificity = GetString(root, "specificity", "Medium"),
                    Competency = GetString(root, "competency", defaultCompetency)
                };

                // Gemini Fabrication Protection:
                // If candidate gave a negative answer / refusal / lacks experience, any extracted STAR is hallucinated
                if (isRefusal)
                {
                    if (!string.IsNullOrWhiteSpace(aiSituation)) ev.Claims.Add($"Unverified AI Claim (Situation): {aiSituation}");
                    if (!string.IsNullOrWhiteSpace(aiAction)) ev.Claims.Add($"Unverified AI Claim (Action): {aiAction}");
                    if (!string.IsNullOrWhiteSpace(aiResult)) ev.Claims.Add($"Unverified AI Claim (Result): {aiResult}");
                    ev.Situation = string.Empty;
                    ev.Task = string.Empty;
                    ev.Action = string.Empty;
                    ev.Result = string.Empty;
                    ev.Reflection = string.Empty;
                    ev.Ownership = "Unclear";
                }
                else
                {
                    ev.Situation = aiSituation;
                    ev.Task = aiTask;
                    ev.Action = aiAction;
                    ev.Result = aiResult;
                    ev.Reflection = aiReflection;
                }

                if (root.TryGetProperty("missingComponents", out var mc) && mc.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in mc.EnumerateArray())
                    {
                        var s = item.GetString();
                        if (!string.IsNullOrWhiteSpace(s)) ev.MissingComponents.Add(s);
                    }
                }

                if (root.TryGetProperty("claims", out var cl) && cl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in cl.EnumerateArray())
                    {
                        var s = item.GetString();
                        if (!string.IsNullOrWhiteSpace(s)) ev.Claims.Add(s);
                    }
                }

                if (root.TryGetProperty("contradictions", out var ct) && ct.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in ct.EnumerateArray())
                    {
                        var s = item.GetString();
                        if (!string.IsNullOrWhiteSpace(s)) ev.Contradictions.Add(s);
                    }
                }

                // Deterministic invariant checks on missing components
                if (string.IsNullOrWhiteSpace(ev.Situation) && !ev.MissingComponents.Contains("SITUATION", StringComparer.OrdinalIgnoreCase))
                    ev.MissingComponents.Add("SITUATION");
                if (string.IsNullOrWhiteSpace(ev.Task) && !ev.MissingComponents.Contains("TASK", StringComparer.OrdinalIgnoreCase))
                    ev.MissingComponents.Add("TASK");
                if (string.IsNullOrWhiteSpace(ev.Action) && !ev.MissingComponents.Contains("ACTION", StringComparer.OrdinalIgnoreCase))
                    ev.MissingComponents.Add("ACTION");
                if (string.IsNullOrWhiteSpace(ev.Result) && !ev.MissingComponents.Contains("RESULT", StringComparer.OrdinalIgnoreCase))
                    ev.MissingComponents.Add("RESULT");
                if (string.IsNullOrWhiteSpace(ev.Reflection) && !ev.MissingComponents.Contains("REFLECTION", StringComparer.OrdinalIgnoreCase))
                    ev.MissingComponents.Add("REFLECTION");

                // Deterministic check on ownership: if candidate exclusively uses "we" / "chúng tôi" without "I" / "tôi"
                var (hasPersonal, hasCollective) = AnalyzePronouns(answer);
                if (hasCollective && !hasPersonal)
                {
                    ev.Ownership = "Low";
                    if (!ev.MissingComponents.Contains("OWNERSHIP", StringComparer.OrdinalIgnoreCase))
                    {
                        ev.MissingComponents.Add("OWNERSHIP");
                    }
                }
                else if (hasPersonal)
                {
                    if (ev.Ownership == "Unclear" || ev.Ownership == "Low") ev.Ownership = "High";
                }

                // Deterministic EvidenceStrength calculation - Gemini CANNOT inject EvidenceStrength!
                if (!string.IsNullOrWhiteSpace(ev.Situation) &&
                    !string.IsNullOrWhiteSpace(ev.Action) &&
                    !string.IsNullOrWhiteSpace(ev.Result) &&
                    (ev.Ownership == "High" || ev.Ownership == "Medium"))
                {
                    ev.EvidenceStrength = "Strong";
                }
                else if (!string.IsNullOrWhiteSpace(ev.Action) || !string.IsNullOrWhiteSpace(ev.Situation))
                {
                    ev.EvidenceStrength = "Moderate";
                }
                else
                {
                    ev.EvidenceStrength = "Insufficient";
                }

                return ev;
            }
            catch (Exception)
            {
                return FallbackEvidence(defaultCompetency, answer);
            }
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

        private static BehavioralEvidence FallbackEvidence(string competency, string answer)
        {
            if (IsNegativeOrRefusal(answer))
            {
                return new BehavioralEvidence
                {
                    Situation = string.Empty,
                    Task = string.Empty,
                    Action = string.Empty,
                    Result = string.Empty,
                    Reflection = string.Empty,
                    Ownership = "Unclear",
                    Specificity = "Low",
                    EvidenceStrength = "Insufficient",
                    MissingComponents = new List<string> { "SITUATION", "TASK", "ACTION", "RESULT", "REFLECTION", "OWNERSHIP" },
                    Competency = competency
                };
            }

            var (hasPersonal, hasCollective) = AnalyzePronouns(answer);
            var isTeamOnly = hasCollective && !hasPersonal;
            var ownership = isTeamOnly ? "Low" : (hasPersonal ? "High" : "Unclear");

            bool isActionAnswer = answer.Contains("trực tiếp", StringComparison.OrdinalIgnoreCase) ||
                                  answer.Contains("triển khai", StringComparison.OrdinalIgnoreCase) ||
                                  answer.Contains("thiết kế", StringComparison.OrdinalIgnoreCase) ||
                                  answer.Contains("giải pháp", StringComparison.OrdinalIgnoreCase) ||
                                  answer.Contains("prototype", StringComparison.OrdinalIgnoreCase);

            bool isResultAnswer = (answer.Contains("kết quả", StringComparison.OrdinalIgnoreCase) ||
                                  answer.Contains("đạt được", StringComparison.OrdinalIgnoreCase) ||
                                  answer.Contains("uptime", StringComparison.OrdinalIgnoreCase)) &&
                                  !isActionAnswer;

            bool isReflectionAnswer = answer.Contains("bài học", StringComparison.OrdinalIgnoreCase) ||
                                      answer.Contains("rút ra", StringComparison.OrdinalIgnoreCase);

            string situation = (!isResultAnswer && !isReflectionAnswer && !isActionAnswer && answer.Length > 20) ? answer : string.Empty;
            string action = isActionAnswer || (hasPersonal && answer.Length > 40 && !isResultAnswer) ? answer : string.Empty;
            string result = isResultAnswer ? answer : string.Empty;
            string reflection = isReflectionAnswer ? answer : string.Empty;

            var missing = new List<string>();
            if (string.IsNullOrWhiteSpace(situation)) missing.Add("SITUATION");
            if (string.IsNullOrWhiteSpace(action)) missing.Add("ACTION");
            if (string.IsNullOrWhiteSpace(result)) missing.Add("RESULT");
            if (string.IsNullOrWhiteSpace(reflection)) missing.Add("REFLECTION");
            if (ownership == "Low" || ownership == "Unclear") missing.Add("OWNERSHIP");

            string strength;
            if (!string.IsNullOrWhiteSpace(situation) && !string.IsNullOrWhiteSpace(action) && !string.IsNullOrWhiteSpace(result))
            {
                strength = "Strong";
            }
            else if (!string.IsNullOrWhiteSpace(action) || !string.IsNullOrWhiteSpace(situation) || !string.IsNullOrWhiteSpace(result))
            {
                strength = "Moderate";
            }
            else
            {
                strength = "Insufficient";
            }

            return new BehavioralEvidence
            {
                Situation = situation,
                Action = action,
                Result = result,
                Reflection = reflection,
                Ownership = ownership,
                Specificity = answer.Length > 100 ? "High" : "Medium",
                EvidenceStrength = strength,
                MissingComponents = missing,
                Competency = competency
            };
        }

        private static BehavioralEvidence AggregateEvidence(BehavioralEvidence parent, BehavioralEvidence child)
        {
            var merged = new BehavioralEvidence
            {
                Situation = !string.IsNullOrWhiteSpace(parent.Situation) ? parent.Situation : child.Situation,
                Task = !string.IsNullOrWhiteSpace(parent.Task) ? parent.Task : child.Task,
                Action = !string.IsNullOrWhiteSpace(child.Action) ? child.Action : parent.Action,
                Result = !string.IsNullOrWhiteSpace(child.Result) ? child.Result : parent.Result,
                Reflection = !string.IsNullOrWhiteSpace(child.Reflection) ? child.Reflection : parent.Reflection,
                Competency = !string.IsNullOrWhiteSpace(child.Competency) ? child.Competency : parent.Competency,
                Specificity = child.Specificity == "High" || parent.Specificity == "High" ? "High" : "Medium"
            };

            // Upgrade ownership if either demonstrated clear personal agency
            if (child.Ownership == "High" || parent.Ownership == "High")
            {
                merged.Ownership = "High";
            }
            else if (child.Ownership == "Medium" || parent.Ownership == "Medium")
            {
                merged.Ownership = "Medium";
            }
            else
            {
                merged.Ownership = child.Ownership;
            }

            // Combine claims and contradictions
            merged.Claims = parent.Claims.Concat(child.Claims).Distinct().ToList();
            merged.Contradictions = parent.Contradictions.Concat(child.Contradictions).Distinct().ToList();

            // Re-evaluate missing components against the merged story
            var missing = new List<string>();
            if (string.IsNullOrWhiteSpace(merged.Situation)) missing.Add("SITUATION");
            if (string.IsNullOrWhiteSpace(merged.Task)) missing.Add("TASK");
            if (string.IsNullOrWhiteSpace(merged.Action)) missing.Add("ACTION");
            if (string.IsNullOrWhiteSpace(merged.Result)) missing.Add("RESULT");
            if (string.IsNullOrWhiteSpace(merged.Reflection)) missing.Add("REFLECTION");
            if (merged.Ownership == "Low" || merged.Ownership == "Unclear") missing.Add("OWNERSHIP");
            merged.MissingComponents = missing;

            // Compute overall evidence strength deterministically
            if (!string.IsNullOrWhiteSpace(merged.Situation) &&
                !string.IsNullOrWhiteSpace(merged.Action) &&
                !string.IsNullOrWhiteSpace(merged.Result) &&
                (merged.Ownership == "High" || merged.Ownership == "Medium"))
            {
                merged.EvidenceStrength = "Strong";
            }
            else if (!string.IsNullOrWhiteSpace(merged.Action) || !string.IsNullOrWhiteSpace(merged.Situation))
            {
                merged.EvidenceStrength = "Moderate";
            }
            else
            {
                merged.EvidenceStrength = "Insufficient";
            }

            return merged;
        }

        private static bool IsNegativeOrRefusal(string answer)
        {
            if (string.IsNullOrWhiteSpace(answer)) return true;
            var lower = answer.Trim().ToLowerInvariant();
            if (lower.Length < 15)
            {
                if (lower.Contains("không") || lower.Contains("chưa") || lower.Contains("don't") || lower.Contains("no"))
                    return true;
            }
            return lower.Contains("chưa từng") ||
                   lower.Contains("chưa có cơ hội") ||
                   lower.Contains("chưa có kinh nghiệm") ||
                   lower.Contains("không có kinh nghiệm") ||
                   lower.Contains("không biết") ||
                   lower.Contains("không nhớ") ||
                   lower.Contains("chưa làm") ||
                   lower.Contains("i don't know") ||
                   lower.Contains("don't remember") ||
                   lower.Contains("no experience") ||
                   lower.Contains("haven't encountered");
        }

        private static (bool hasPersonal, bool hasCollective) AnalyzePronouns(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return (false, false);

            bool hasCollective = text.Contains("chúng tôi", StringComparison.OrdinalIgnoreCase) ||
                                 text.Contains("chúng em", StringComparison.OrdinalIgnoreCase) ||
                                 text.Contains("chúng mình", StringComparison.OrdinalIgnoreCase) ||
                                 text.Contains("team", StringComparison.OrdinalIgnoreCase) ||
                                 text.Contains("we ", StringComparison.OrdinalIgnoreCase) ||
                                 text.Contains("we're", StringComparison.OrdinalIgnoreCase) ||
                                 text.Contains("our ", StringComparison.OrdinalIgnoreCase);

            var textWithoutCollective = text
                .Replace("chúng tôi", " ", StringComparison.OrdinalIgnoreCase)
                .Replace("chúng em", " ", StringComparison.OrdinalIgnoreCase)
                .Replace("chúng mình", " ", StringComparison.OrdinalIgnoreCase);

            bool hasPersonal = textWithoutCollective.Contains("tôi", StringComparison.OrdinalIgnoreCase) ||
                               textWithoutCollective.Contains("em ", StringComparison.OrdinalIgnoreCase) ||
                               textWithoutCollective.Contains(" em", StringComparison.OrdinalIgnoreCase) ||
                               textWithoutCollective.Contains("I ", StringComparison.OrdinalIgnoreCase) ||
                               textWithoutCollective.Contains(" I", StringComparison.OrdinalIgnoreCase) ||
                               textWithoutCollective.Contains("my ", StringComparison.OrdinalIgnoreCase) ||
                               textWithoutCollective.Contains("myself", StringComparison.OrdinalIgnoreCase);

            return (hasPersonal, hasCollective);
        }
    }
}
