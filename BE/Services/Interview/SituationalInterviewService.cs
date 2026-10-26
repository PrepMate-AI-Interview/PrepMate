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
    public class SituationalInterviewService : ISituationalInterviewService
    {
        private readonly GeminiService? _geminiService;

        private static readonly Dictionary<string, string> BaseScenarios = new(StringComparer.OrdinalIgnoreCase)
        {
            ["DeadlineConflict"] = "Bạn có hai nhiệm vụ đều được đánh dấu mức ưu tiên cao (P0) từ hai bên liên quan khác nhau và cả hai đều muốn hoàn thành trong hôm nay. Bạn sẽ phân tích và xử lý tình huống này như thế nào?",
            ["ProductionIncident"] = "Một sự cố nghiêm trọng (production incident) xảy ra trên hệ thống chỉ ít giờ trước thời điểm release một tính năng lớn của toàn công ty. Bạn sẽ ưu tiên những bước hành động nào và phối hợp ra sao?",
            ["TeamConflict"] = "Một đồng nghiệp trong nhóm phản đối mạnh mẽ giải pháp kỹ thuật của bạn trong khi thời hạn bàn giao dự án chỉ còn đúng một ngày. Bạn sẽ xử lý bất đồng quan điểm này như thế nào?",
            ["AmbiguousRequirement"] = "Khách hàng đưa ra một yêu cầu tính năng còn rất mơ hồ và thiếu thông số kỹ thuật, nhưng lại yêu cầu bạn phải bắt đầu triển khai ngay để kịp tiến độ. Bạn sẽ phản ứng và làm việc lại thế nào?",
            ["EthicalDilemma"] = "Bạn phát hiện code của một đồng nghiệp có một lỗ hổng bảo mật nghiêm trọng sắp được đưa lên production, nhưng đồng nghiệp đó muốn che giấu để kịp deadline. Bạn sẽ xử lý tình huống này thế nào?",
            ["ScopeChange"] = "Quản lý bất ngờ yêu cầu bổ sung một module tính năng lớn vào dự án ngay trước ngày demo cho khách hàng. Bạn sẽ phản hồi và thương lượng ra sao?"
        };

        public SituationalInterviewService(GeminiService? geminiService = null)
        {
            _geminiService = geminiService;
        }

        public async Task<GeneratedQuestion> GenerateScenarioAsync(Session session, SituationalEvidence? previousEvidence = null)
        {
            var targetPosition = session.InterviewContext?.TargetPosition ?? session.JobTitle ?? ProfessionalDomainClassifier.DefaultPositionTitle;
            var seniority = session.InterviewContext?.ExperienceLevel ?? session.InterviewState?.CandidateLevel ?? "Mid-level";

            // 1. Follow-up check: If previous evidence is missing critical situational aspects
            if (previousEvidence != null && previousEvidence.MissingEvidence != null && previousEvidence.MissingEvidence.Count > 0)
            {
                var parentId = session.InterviewState?.LastParentQuestionId ?? session.Questions?.LastOrDefault();
                var followUpText = BuildFollowUpText(previousEvidence);

                return new GeneratedQuestion
                {
                    Question = followUpText,
                    QuestionId = Guid.NewGuid().ToString(),
                    ParentQuestionId = parentId,
                    Topic = "Situational",
                    Subtopic = previousEvidence.Category,
                    Dimension = "SITUATIONAL",
                    QuestionType = "Situational_FollowUp",
                    Stage = InterviewStageNames.SituationalCase,
                    Category = previousEvidence.Category,
                    IsFollowUp = true,
                    Reason = $"Situational follow-up probing missing dimensions: {string.Join(", ", previousEvidence.MissingEvidence)}"
                };
            }

            // 2. Select an unasked category
            var askedCategories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (session.Answers != null)
            {
                foreach (var ans in session.Answers)
                {
                    if (ans.SituationalEvidence != null && !string.IsNullOrWhiteSpace(ans.SituationalEvidence.Category))
                    {
                        askedCategories.Add(ans.SituationalEvidence.Category);
                    }
                }
            }

            var candidates = BaseScenarios.Keys
                .Where(k => !askedCategories.Contains(k))
                .ToList();

            if (candidates.Count == 0)
            {
                candidates = BaseScenarios.Keys.ToList();
            }

            string chosenCategory;
            if (seniority.Contains("Senior", StringComparison.OrdinalIgnoreCase) || seniority.Contains("Lead", StringComparison.OrdinalIgnoreCase))
            {
                chosenCategory = candidates.FirstOrDefault(k => k == "ProductionIncident" || k == "ScopeChange" || k == "EthicalDilemma")
                                 ?? candidates.First();
            }
            else
            {
                chosenCategory = candidates.FirstOrDefault(k => k == "DeadlineConflict" || k == "TeamConflict" || k == "AmbiguousRequirement")
                                 ?? candidates.First();
            }

            var scenarioText = BaseScenarios[chosenCategory];
            var newQuestionId = Guid.NewGuid().ToString();

            if (session.InterviewState != null)
            {
                session.InterviewState.LastParentQuestionId = newQuestionId;
                session.InterviewState.ActiveSituationalCategory = chosenCategory;
            }

            return new GeneratedQuestion
            {
                Question = scenarioText,
                QuestionId = newQuestionId,
                ParentQuestionId = null,
                Topic = "Situational",
                Subtopic = chosenCategory,
                Dimension = "SITUATIONAL",
                QuestionType = "Situational",
                Stage = InterviewStageNames.SituationalCase,
                Category = chosenCategory,
                IsFollowUp = false,
                Reason = $"Situational dilemma evaluating decision-making, prioritization, and communication on {chosenCategory}"
            };
        }

        public async Task<SituationalEvidence> AnalyzeAnswerAsync(
            Session session,
            string scenario,
            string answer,
            string? parentQuestionId = null)
        {
            var targetPosition = session.InterviewContext?.TargetPosition ?? session.JobTitle ?? ProfessionalDomainClassifier.DefaultPositionTitle;
            var seniority = session.InterviewContext?.ExperienceLevel ?? session.InterviewState?.CandidateLevel ?? "Mid-level";
            var category = session.InterviewState?.ActiveSituationalCategory ?? "DeadlineConflict";

            SituationalEvidence currentEvidence;

            string priorContext = "";
            AnswerItem? parentAnswer = null;
            if (!string.IsNullOrWhiteSpace(parentQuestionId) && session.Answers != null)
            {
                parentAnswer = session.Answers.LastOrDefault(a => a.QuestionId == parentQuestionId || a.ParentQuestionId == parentQuestionId);
                if (parentAnswer?.SituationalEvidence != null)
                {
                    priorContext = $"Lượt trước - Quyết định: {parentAnswer.SituationalEvidence.DecisionMaking}; Kế hoạch: {string.Join(", ", parentAnswer.SituationalEvidence.ActionPlan)}";
                }
            }

            if (_geminiService != null)
            {
                try
                {
                    var prompt = SituationalPrompt.BuildAnalysisPrompt(targetPosition, seniority, category, scenario, answer, priorContext);
                    var aiJson = await _geminiService.CallGeminiApiAsync(prompt, isJsonMode: true);
                    currentEvidence = ParseAiEvidence(aiJson, category, scenario, answer);
                }
                catch (Exception)
                {
                    currentEvidence = FallbackEvidence(category, scenario, answer);
                }
            }
            else
            {
                currentEvidence = FallbackEvidence(category, scenario, answer);
            }

            // Evidence Aggregation: If follow-up, merge with parent evidence
            if (parentAnswer?.SituationalEvidence != null)
            {
                currentEvidence = AggregateEvidence(parentAnswer.SituationalEvidence, currentEvidence);
            }

            return currentEvidence;
        }

        private static string BuildFollowUpText(SituationalEvidence prev)
        {
            if (prev.MissingEvidence.Contains("Communication", StringComparer.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(prev.Communication))
            {
                return "Trong phương án của bạn, bạn sẽ chủ động trao đổi và cập nhật với những bên liên quan (stakeholders) nào và vào thời điểm nào?";
            }

            if (prev.MissingEvidence.Contains("RiskAwareness", StringComparer.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(prev.RiskAwareness))
            {
                return "Theo bạn cách tiếp cận này có thể tiềm ẩn những rủi ro hoặc tác động tiêu cực nào đến hệ thống hoặc các team khác?";
            }

            if (prev.MissingEvidence.Contains("TradeoffAwareness", StringComparer.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(prev.TradeoffAwareness))
            {
                return "Khi lựa chọn phương án này, bạn đã cân nhắc đánh đổi (trade-off) những yếu tố gì giữa thời gian, chất lượng và phạm vi?";
            }

            if (prev.MissingEvidence.Contains("ProblemUnderstanding", StringComparer.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(prev.ProblemUnderstanding))
            {
                return "Trước khi đưa ra quyết định hành động, bạn cần thu thập hoặc làm rõ thêm những thông tin cốt lõi nào?";
            }

            if (prev.MissingEvidence.Contains("EscalationJudgment", StringComparer.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(prev.EscalationJudgment))
            {
                return "Trong trường hợp tình hình diễn biến xấu hơn dự kiến, bạn sẽ xác định thời điểm và cách thức báo cáo lên cấp trên ra sao?";
            }

            return "Bạn có kế hoạch dự phòng (contingency/rollback plan) nào nếu phương án đề xuất không mang lại hiệu quả mong đợi không?";
        }

        private static SituationalEvidence ParseAiEvidence(string rawJson, string defaultCategory, string scenario, string answer)
        {
            if (string.IsNullOrWhiteSpace(rawJson))
            {
                return FallbackEvidence(defaultCategory, scenario, answer);
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

                var aiProblem = GetString(root, "problemUnderstanding");
                var aiPrioritization = GetString(root, "prioritization");
                var aiDecision = GetString(root, "decisionMaking");
                var aiComm = GetString(root, "communication");
                var aiRisk = GetString(root, "riskAwareness");
                var aiTradeoff = GetString(root, "tradeoffAwareness");
                var aiEscalation = GetString(root, "escalationJudgment");

                var ev = new SituationalEvidence
                {
                    Scenario = scenario,
                    Category = GetString(root, "category", defaultCategory),
                    Ownership = GetString(root, "ownership", "Unclear")
                };

                // Gemini Fabrication Protection
                if (isRefusal)
                {
                    if (!string.IsNullOrWhiteSpace(aiDecision)) ev.Claims.Add($"Unverified AI Claim (Decision): {aiDecision}");
                    if (!string.IsNullOrWhiteSpace(aiTradeoff)) ev.Claims.Add($"Unverified AI Claim (Tradeoffs): {aiTradeoff}");
                    if (!string.IsNullOrWhiteSpace(aiRisk)) ev.Claims.Add($"Unverified AI Claim (Risk): {aiRisk}");
                    ev.ProblemUnderstanding = string.Empty;
                    ev.Prioritization = string.Empty;
                    ev.DecisionMaking = string.Empty;
                    ev.Communication = string.Empty;
                    ev.RiskAwareness = string.Empty;
                    ev.TradeoffAwareness = string.Empty;
                    ev.EscalationJudgment = string.Empty;
                }
                else
                {
                    ev.ProblemUnderstanding = aiProblem;
                    ev.Prioritization = aiPrioritization;
                    ev.DecisionMaking = aiDecision;
                    ev.Communication = aiComm;
                    ev.RiskAwareness = aiRisk;
                    ev.TradeoffAwareness = aiTradeoff;
                    ev.EscalationJudgment = aiEscalation;
                }

                if (root.TryGetProperty("actionPlan", out var ap) && ap.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in ap.EnumerateArray())
                    {
                        var s = item.GetString();
                        if (!string.IsNullOrWhiteSpace(s)) ev.ActionPlan.Add(s);
                    }
                }

                if (root.TryGetProperty("missingEvidence", out var me) && me.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in me.EnumerateArray())
                    {
                        var s = item.GetString();
                        if (!string.IsNullOrWhiteSpace(s)) ev.MissingEvidence.Add(s);
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

                // Deterministic checks on missing dimensions
                if (string.IsNullOrWhiteSpace(ev.Communication) && !ev.MissingEvidence.Contains("Communication", StringComparer.OrdinalIgnoreCase))
                    ev.MissingEvidence.Add("Communication");
                if (string.IsNullOrWhiteSpace(ev.RiskAwareness) && !ev.MissingEvidence.Contains("RiskAwareness", StringComparer.OrdinalIgnoreCase))
                    ev.MissingEvidence.Add("RiskAwareness");
                if (string.IsNullOrWhiteSpace(ev.TradeoffAwareness) && !ev.MissingEvidence.Contains("TradeoffAwareness", StringComparer.OrdinalIgnoreCase))
                    ev.MissingEvidence.Add("TradeoffAwareness");
                if (string.IsNullOrWhiteSpace(ev.EscalationJudgment) && !ev.MissingEvidence.Contains("EscalationJudgment", StringComparer.OrdinalIgnoreCase))
                    ev.MissingEvidence.Add("EscalationJudgment");

                // Deterministic EvidenceStrength & ReasoningQuality - Gemini CANNOT inject scores or strength!
                if (!string.IsNullOrWhiteSpace(ev.DecisionMaking) &&
                    !string.IsNullOrWhiteSpace(ev.Communication) &&
                    !string.IsNullOrWhiteSpace(ev.RiskAwareness))
                {
                    ev.EvidenceStrength = "Strong";
                    ev.ReasoningQuality = !string.IsNullOrWhiteSpace(ev.TradeoffAwareness) ? "High" : "Medium";
                }
                else if (!string.IsNullOrWhiteSpace(ev.DecisionMaking) || !string.IsNullOrWhiteSpace(ev.ProblemUnderstanding))
                {
                    ev.EvidenceStrength = "Moderate";
                    ev.ReasoningQuality = "Medium";
                }
                else
                {
                    ev.EvidenceStrength = "Insufficient";
                    ev.ReasoningQuality = "Low";
                }

                return ev;
            }
            catch (Exception)
            {
                return FallbackEvidence(defaultCategory, scenario, answer);
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

        private static SituationalEvidence FallbackEvidence(string category, string scenario, string answer)
        {
            if (IsNegativeOrRefusal(answer))
            {
                return new SituationalEvidence
                {
                    Scenario = scenario,
                    Category = category,
                    ProblemUnderstanding = string.Empty,
                    Prioritization = string.Empty,
                    DecisionMaking = string.Empty,
                    Communication = string.Empty,
                    RiskAwareness = string.Empty,
                    TradeoffAwareness = string.Empty,
                    EscalationJudgment = string.Empty,
                    Ownership = "Unclear",
                    EvidenceStrength = "Insufficient",
                    ReasoningQuality = "Low",
                    MissingEvidence = new List<string> { "ProblemUnderstanding", "DecisionMaking", "Communication", "RiskAwareness", "TradeoffAwareness", "EscalationJudgment" }
                };
            }

            var missing = new List<string>();
            var hasCommunication = answer.Contains("thông báo", StringComparison.OrdinalIgnoreCase) ||
                                  answer.Contains("trao đổi", StringComparison.OrdinalIgnoreCase) ||
                                  answer.Contains("giao tiếp", StringComparison.OrdinalIgnoreCase) ||
                                  answer.Contains("báo cáo", StringComparison.OrdinalIgnoreCase);

            var hasRisk = answer.Contains("rủi ro", StringComparison.OrdinalIgnoreCase) ||
                          answer.Contains("risk", StringComparison.OrdinalIgnoreCase) ||
                          answer.Contains("sự cố", StringComparison.OrdinalIgnoreCase) ||
                          answer.Contains("dự phòng", StringComparison.OrdinalIgnoreCase);

            var hasTradeoff = answer.Contains("đánh đổi", StringComparison.OrdinalIgnoreCase) ||
                              answer.Contains("tradeoff", StringComparison.OrdinalIgnoreCase) ||
                              answer.Contains("thay vì", StringComparison.OrdinalIgnoreCase);

            if (!hasCommunication) missing.Add("Communication");
            if (!hasRisk) missing.Add("RiskAwareness");
            if (!hasTradeoff) missing.Add("TradeoffAwareness");

            return new SituationalEvidence
            {
                Scenario = scenario,
                Category = category,
                DecisionMaking = answer.Length > 20 ? answer : string.Empty,
                ProblemUnderstanding = answer.Length > 40 ? "Candidate identified problem scope" : string.Empty,
                Ownership = (answer.Contains("tôi", StringComparison.OrdinalIgnoreCase) || answer.Contains("em", StringComparison.OrdinalIgnoreCase)) ? "High" : "Medium",
                EvidenceStrength = answer.Length > 50 ? "Moderate" : "Insufficient",
                ReasoningQuality = answer.Length > 80 ? "Medium" : "Low",
                MissingEvidence = missing
            };
        }

        private static SituationalEvidence AggregateEvidence(SituationalEvidence parent, SituationalEvidence child)
        {
            var merged = new SituationalEvidence
            {
                Scenario = !string.IsNullOrWhiteSpace(parent.Scenario) ? parent.Scenario : child.Scenario,
                Category = !string.IsNullOrWhiteSpace(parent.Category) ? parent.Category : child.Category,
                ProblemUnderstanding = !string.IsNullOrWhiteSpace(parent.ProblemUnderstanding) ? parent.ProblemUnderstanding : child.ProblemUnderstanding,
                Prioritization = !string.IsNullOrWhiteSpace(parent.Prioritization) ? parent.Prioritization : child.Prioritization,
                DecisionMaking = !string.IsNullOrWhiteSpace(parent.DecisionMaking) ? parent.DecisionMaking : child.DecisionMaking,
                Communication = !string.IsNullOrWhiteSpace(child.Communication) ? child.Communication : parent.Communication,
                RiskAwareness = !string.IsNullOrWhiteSpace(child.RiskAwareness) ? child.RiskAwareness : parent.RiskAwareness,
                TradeoffAwareness = !string.IsNullOrWhiteSpace(child.TradeoffAwareness) ? child.TradeoffAwareness : parent.TradeoffAwareness,
                EscalationJudgment = !string.IsNullOrWhiteSpace(child.EscalationJudgment) ? child.EscalationJudgment : parent.EscalationJudgment,
                ReasoningQuality = child.ReasoningQuality == "High" || parent.ReasoningQuality == "High" ? "High" : "Medium"
            };

            // Upgrade ownership
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

            // Combine Action Plans
            merged.ActionPlan = parent.ActionPlan.Concat(child.ActionPlan).Distinct().ToList();
            merged.Claims = parent.Claims.Concat(child.Claims).Distinct().ToList();

            // Re-evaluate missing evidence
            var missing = new List<string>();
            if (string.IsNullOrWhiteSpace(merged.ProblemUnderstanding)) missing.Add("ProblemUnderstanding");
            if (string.IsNullOrWhiteSpace(merged.Communication)) missing.Add("Communication");
            if (string.IsNullOrWhiteSpace(merged.RiskAwareness)) missing.Add("RiskAwareness");
            if (string.IsNullOrWhiteSpace(merged.TradeoffAwareness)) missing.Add("TradeoffAwareness");
            if (string.IsNullOrWhiteSpace(merged.EscalationJudgment)) missing.Add("EscalationJudgment");
            merged.MissingEvidence = missing;

            // Compute evidence strength
            if (!string.IsNullOrWhiteSpace(merged.DecisionMaking) &&
                !string.IsNullOrWhiteSpace(merged.Communication) &&
                !string.IsNullOrWhiteSpace(merged.RiskAwareness))
            {
                merged.EvidenceStrength = "Strong";
            }
            else if (!string.IsNullOrWhiteSpace(merged.DecisionMaking) || !string.IsNullOrWhiteSpace(merged.ProblemUnderstanding))
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
    }
}
