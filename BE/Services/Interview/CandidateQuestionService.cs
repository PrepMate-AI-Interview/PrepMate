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
    public class CandidateQuestionService : ICandidateQuestionService
    {
        private readonly GeminiService? _geminiService;

        public CandidateQuestionService(GeminiService? geminiService = null)
        {
            _geminiService = geminiService;
        }

        public async Task<InterviewerAnswerResult> ProcessCandidateQuestionAsync(Session session, string candidateQuestion)
        {
            if (string.IsNullOrWhiteSpace(candidateQuestion))
            {
                return new InterviewerAnswerResult
                {
                    Answer = "Tôi chưa nghe rõ câu hỏi của bạn. Bạn có muốn hỏi thêm điều gì về vị trí hoặc đội ngũ phát triển không?",
                    GroundingSource = "SafeUnknown",
                    IsSafeFallback = true,
                    Evidence = new CandidateQuestionEvidence
                    {
                        QuestionText = string.Empty,
                        Category = "OTHER",
                        EvidenceStrength = "Insufficient",
                        Specificity = "Low",
                        Relevance = "Low"
                    }
                };
            }

            var cleanQ = candidateQuestion.Trim();

            // 1. Refusal / No questions check
            if (IsNoQuestionsOrRefusal(cleanQ))
            {
                if (session?.InterviewState != null)
                {
                    session.InterviewState.CandidateQuestionsCompleted = true;
                }

                return new InterviewerAnswerResult
                {
                    Answer = "Rất tốt. Cảm ơn bạn đã trao đổi rất cởi mở. Nếu bạn không còn câu hỏi nào khác, chúng ta sẽ chuyển sang phần tổng kết.",
                    GroundingSource = "SessionContext",
                    IsSafeFallback = false,
                    Evidence = new CandidateQuestionEvidence
                    {
                        QuestionText = cleanQ,
                        Category = "OTHER",
                        EvidenceStrength = "Insufficient",
                        IsRefusalOrNoQuestions = true,
                        Specificity = "Low",
                        Relevance = "Low"
                    }
                };
            }

            // 2. Strict Anti-Hallucination Interceptors
            // Salary / Compensation Interceptor
            if (IsAskingAboutSalary(cleanQ))
            {
                var explicitSalary = ExtractExplicitSalary(session);
                if (string.IsNullOrWhiteSpace(explicitSalary))
                {
                    var fallbackEvidence = AnalyzeQuestionEvidenceLocally(cleanQ, "COMPENSATION");
                    return new InterviewerAnswerResult
                    {
                        Answer = "Tôi chưa có con số chính xác về mức lương/đãi ngộ trong ngữ cảnh phỏng vấn kỹ thuật hiện tại. Phần này bạn có thể trao đổi và xác nhận chi tiết hơn với bộ phận tuyển dụng/HR.",
                        GroundingSource = "SafeUnknown",
                        IsSafeFallback = true,
                        Evidence = fallbackEvidence
                    };
                }
            }

            // Recruitment Timeline / Policy Interceptor
            if (IsAskingAboutRecruitmentTimelineOrPolicy(cleanQ))
            {
                var explicitTimeline = ExtractExplicitTimeline(session);
                if (string.IsNullOrWhiteSpace(explicitTimeline))
                {
                    var fallbackEvidence = AnalyzeQuestionEvidenceLocally(cleanQ, "PROCESS");
                    return new InterviewerAnswerResult
                    {
                        Answer = "Tôi chưa có đủ thông tin cụ thể về timeline/quy trình thăng tiến nội bộ trong ngữ cảnh phỏng vấn kỹ thuật hiện tại nên không muốn đưa ra phán đoán thiếu căn cứ. Bạn có thể xác nhận lại với bộ phận tuyển dụng ở các bước tiếp theo.",
                        GroundingSource = "SafeUnknown",
                        IsSafeFallback = true,
                        Evidence = fallbackEvidence
                    };
                }
            }

            // 3. AI-assisted generation with strict prompt
            if (_geminiService != null)
            {
                try
                {
                    var prompt = CandidateQuestionPrompt.BuildPrompt(session, cleanQ);
                    var rawJson = await _geminiService.CallGeminiApiAsync(prompt, isJsonMode: true);
                    return ParseAiResponse(session, cleanQ, rawJson);
                }
                catch (Exception)
                {
                    // Fall back to deterministic local answering
                }
            }

            return GenerateDeterministicAnswer(session, cleanQ);
        }

        public async Task<CandidateQuestionEvidence> AnalyzeQuestionEvidenceAsync(Session session, string candidateQuestion)
        {
            var res = await ProcessCandidateQuestionAsync(session, candidateQuestion);
            return res.Evidence ?? AnalyzeQuestionEvidenceLocally(candidateQuestion, "OTHER");
        }

        private InterviewerAnswerResult ParseAiResponse(Session session, string cleanQ, string rawJson)
        {
            try
            {
                var cleaned = rawJson.Trim();
                if (cleaned.StartsWith("```json")) cleaned = cleaned.Substring(7);
                if (cleaned.StartsWith("```")) cleaned = cleaned.Substring(3);
                if (cleaned.EndsWith("```")) cleaned = cleaned.Substring(0, cleaned.Length - 3);
                cleaned = cleaned.Trim();

                using var doc = JsonDocument.Parse(cleaned);
                var root = doc.RootElement;

                var answer = GetString(root, "answer");
                var grounding = GetString(root, "groundingSource", "SessionContext");
                var isSafeFallback = root.TryGetProperty("isSafeFallback", out var isf) && isf.GetBoolean();
                var followUp = GetString(root, "followUpQuestion");

                var category = GetString(root, "category", ClassifyCategoryLocally(cleanQ));
                var specificity = GetString(root, "specificity", "Medium");
                var relevance = GetString(root, "relevance", "Medium");
                var roleUnd = GetString(root, "roleUnderstanding", "Unclear");
                var companyUnd = GetString(root, "companyUnderstanding", "Unclear");
                var growth = GetString(root, "growthOrientation", "Unclear");
                var techCuriosity = GetString(root, "technicalCuriosity", "Unclear");
                var teamAwareness = GetString(root, "teamAwareness", "Unclear");
                var strategicThinking = GetString(root, "strategicThinking", "Unclear");
                var intent = GetString(root, "candidateIntent");

                // Gemini Fabrication Protection on Salary/Benefits:
                if (IsAskingAboutSalary(cleanQ) && ExtractExplicitSalary(session) == null)
                {
                    // If AI invented salary numbers in its answer, replace with safe fallback
                    if (answer.Contains("triệu", StringComparison.OrdinalIgnoreCase) ||
                        answer.Contains("vnd", StringComparison.OrdinalIgnoreCase) ||
                        answer.Contains("$", StringComparison.OrdinalIgnoreCase))
                    {
                        answer = "Tôi chưa có con số chính xác về mức lương/đãi ngộ trong ngữ cảnh phỏng vấn kỹ thuật hiện tại. Phần này bạn có thể trao đổi và xác nhận chi tiết hơn với bộ phận tuyển dụng/HR.";
                        grounding = "SafeUnknown";
                        isSafeFallback = true;
                    }
                }

                // Deterministic EvidenceStrength calculation - Gemini CANNOT inject EvidenceStrength!
                var evidenceStrength = CalculateEvidenceStrength(cleanQ, specificity, relevance, roleUnd, strategicThinking, techCuriosity);

                // Gemini Evidence Tampering Protection:
                // If question is empty or simple refusal, force all ratings to Unclear/Insufficient
                if (IsNoQuestionsOrRefusal(cleanQ))
                {
                    roleUnd = "Unclear";
                    growth = "Unclear";
                    strategicThinking = "Unclear";
                    techCuriosity = "Unclear";
                    evidenceStrength = "Insufficient";
                }

                var evidence = new CandidateQuestionEvidence
                {
                    QuestionText = cleanQ,
                    Category = category,
                    Specificity = specificity,
                    Relevance = relevance,
                    RoleUnderstanding = roleUnd,
                    CompanyUnderstanding = companyUnd,
                    GrowthOrientation = growth,
                    TechnicalCuriosity = techCuriosity,
                    TeamAwareness = teamAwareness,
                    StrategicThinking = strategicThinking,
                    CandidateIntent = intent,
                    EvidenceStrength = evidenceStrength
                };

                if (root.TryGetProperty("claims", out var cl) && cl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in cl.EnumerateArray())
                    {
                        var s = item.GetString();
                        if (!string.IsNullOrWhiteSpace(s)) evidence.Claims.Add(s);
                    }
                }

                return new InterviewerAnswerResult
                {
                    Answer = answer,
                    GroundingSource = grounding,
                    IsSafeFallback = isSafeFallback,
                    FollowUpQuestion = string.IsNullOrWhiteSpace(followUp) ? null : followUp,
                    Evidence = evidence
                };
            }
            catch (Exception)
            {
                return GenerateDeterministicAnswer(session, cleanQ);
            }
        }

        private InterviewerAnswerResult GenerateDeterministicAnswer(Session session, string cleanQ)
        {
            var category = ClassifyCategoryLocally(cleanQ);
            var evidence = AnalyzeQuestionEvidenceLocally(cleanQ, category);

            string answer;
            string groundingSource;
            bool isSafeFallback = false;

            if (category == "TECHNICAL")
            {
                var bp = session.InterviewContext?.KnowledgeBlueprint;
                var stack = bp?.Areas != null && bp.Areas.Count > 0
                    ? string.Join(", ", bp.Areas.Select(a => a.Name))
                    : "công nghệ hiện đại phù hợp với yêu cầu bài toán";
                answer = $"Về mặt kỹ thuật, đội ngũ hiện tập trung chủ yếu vào các công nghệ: {stack}. Chúng tôi luôn khuyến khích việc áp dụng các best practices về testing, clean architecture và tối ưu hóa hiệu năng.";
                groundingSource = bp != null ? "KnowledgeBlueprint" : "JobDescription";
            }
            else if (category == "TEAM" || category == "CULTURE")
            {
                var compName = session.InterviewContext?.TargetCompany ?? "đội ngũ";
                answer = $"Tại {compName}, chúng tôi đề cao tinh thần hợp tác, trao đổi thẳng thắn và chủ động giải quyết vấn đề. Mọi thành viên đều được khuyến khích đưa ra sáng kiến và hỗ trợ lẫn nhau trong các sprint.";
                groundingSource = "ExplicitCompanyContext";
            }
            else if (category == "ROLE" || category == "PERFORMANCE" || category == "GROWTH")
            {
                var role = session.JobTitle ?? session.InterviewContext?.TargetPosition ?? "vị trí này";
                answer = $"Đối với {role}, chúng tôi kỳ vọng ứng viên trong 3 tháng đầu sẽ nhanh chóng nắm bắt hệ thống hiện tại, hòa nhập với quy trình làm việc của team và bắt đầu đảm nhận các module cốt lõi một cách độc lập.";
                groundingSource = "JobDescription";
            }
            else
            {
                answer = "Cảm ơn câu hỏi rất hay của bạn. Chúng tôi luôn hoan nghênh những ứng viên có sự quan tâm chu đáo đến môi trường làm việc và định hướng phát triển của đội ngũ.";
                groundingSource = "SessionContext";
            }

            return new InterviewerAnswerResult
            {
                Answer = answer,
                GroundingSource = groundingSource,
                IsSafeFallback = isSafeFallback,
                Evidence = evidence
            };
        }

        private static CandidateQuestionEvidence AnalyzeQuestionEvidenceLocally(string cleanQ, string category)
        {
            var lower = cleanQ.ToLowerInvariant();
            var isSpecific = cleanQ.Length > 40 || lower.Contains("3 tháng") || lower.Contains("kỳ vọng") || lower.Contains("thách thức");
            var isStrategic = lower.Contains("định hướng") || lower.Contains("chiến lược") || lower.Contains("thành công") || lower.Contains("kỳ vọng") || lower.Contains("giải quyết");
            var isGrowth = lower.Contains("phát triển") || lower.Contains("học hỏi") || lower.Contains("mentor") || lower.Contains("lộ trình");
            var isTechCurious = lower.Contains("kiến trúc") || lower.Contains("stack") || lower.Contains("tech") || lower.Contains("scale") || lower.Contains("microservices") || lower.Contains("database");

            var specificity = isSpecific ? "High" : (cleanQ.Length > 20 ? "Medium" : "Low");
            var relevance = (category == "ROLE" || category == "TECHNICAL" || category == "TEAM" || category == "GROWTH" || category == "PERFORMANCE") ? "High" : "Medium";
            var roleUnd = isStrategic || isSpecific ? "Strong" : (cleanQ.Length > 20 ? "Moderate" : "Weak");
            var strategicThinking = isStrategic ? "Strong" : "Unclear";
            var growth = isGrowth ? "Strong" : "Unclear";
            var tech = isTechCurious ? "Strong" : "Unclear";

            var strength = CalculateEvidenceStrength(cleanQ, specificity, relevance, roleUnd, strategicThinking, tech);

            return new CandidateQuestionEvidence
            {
                QuestionText = cleanQ,
                Category = category,
                Specificity = specificity,
                Relevance = relevance,
                RoleUnderstanding = roleUnd,
                StrategicThinking = strategicThinking,
                GrowthOrientation = growth,
                TechnicalCuriosity = tech,
                EvidenceStrength = strength
            };
        }

        private static string CalculateEvidenceStrength(string cleanQ, string specificity, string relevance, string roleUnd, string strategicThinking, string techCuriosity)
        {
            if (IsNoQuestionsOrRefusal(cleanQ)) return "Insufficient";

            if (specificity == "High" && relevance == "High" && (strategicThinking == "Strong" || roleUnd == "Strong" || techCuriosity == "Strong"))
            {
                return "Strong";
            }

            if (cleanQ.Length <= 20 || specificity == "Low")
            {
                return "Weak";
            }

            return "Moderate";
        }

        private static string ClassifyCategoryLocally(string cleanQ)
        {
            var lower = cleanQ.ToLowerInvariant();
            if (lower.Contains("lương") || lower.Contains("salary") || lower.Contains("thưởng") || lower.Contains("đãi ngộ") || lower.Contains("thu nhập"))
                return "COMPENSATION";
            if (lower.Contains("văn hóa") || lower.Contains("culture") || lower.Contains("môi trường") || lower.Contains("giá trị"))
                return "CULTURE";
            if (lower.Contains("team") || lower.Contains("đội ngũ") || lower.Contains("đồng nghiệp") || lower.Contains("quy mô team"))
                return "TEAM";
            if (lower.Contains("công nghệ") || lower.Contains("stack") || lower.Contains("kiến trúc") || lower.Contains("framework") || lower.Contains("tech stack") || lower.Split(' ', '?', '.', '!').Contains("tech") || lower.Split(' ', '?', '.', '!').Contains("code"))
                return "TECHNICAL";
            if (lower.Contains("sản phẩm") || lower.Contains("product") || lower.Contains("tính năng") || lower.Contains("khách hàng") || lower.Contains("người dùng"))
                return "PRODUCT";
            if (lower.Contains("phát triển") || lower.Contains("học hỏi") || lower.Contains("thăng tiến") || lower.Contains("growth") || lower.Contains("lộ trình"))
                return "GROWTH";
            if (lower.Contains("kỳ vọng") || lower.Contains("đánh giá") || lower.Contains("kpi") || lower.Contains("hiệu quả") || lower.Contains("performance"))
                return "PERFORMANCE";
            if (lower.Contains("quy trình") || lower.Contains("scrum") || lower.Contains("agile") || lower.Contains("sprint") || lower.Contains("process"))
                return "PROCESS";
            if (lower.Contains("remote") || lower.Contains("hybrid") || lower.Contains("on-site") || lower.Contains("giờ giấc") || lower.Contains("working model"))
                return "WORKING_MODEL";
            if (lower.Contains("vị trí") || lower.Contains("công việc") || lower.Contains("trách nhiệm") || lower.Contains("role"))
                return "ROLE";

            return "OTHER";
        }

        private static bool IsNoQuestionsOrRefusal(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return true;
            var lower = text.Trim().ToLowerInvariant();
            if (lower.Length < 10)
            {
                if (lower.Contains("không") || lower.Contains("chưa") || lower.Contains("no") || lower.Contains("k"))
                    return true;
            }

            return lower.Contains("không có câu hỏi") ||
                   lower.Contains("không còn câu hỏi") ||
                   lower.Contains("chưa có câu hỏi") ||
                   lower.Contains("em đã rõ") ||
                   lower.Contains("tôi đã rõ") ||
                   lower.Contains("em không còn thắc mắc") ||
                   lower.Contains("tôi không còn thắc mắc") ||
                   lower.Contains("no questions") ||
                   lower.Contains("no question") ||
                   lower.Contains("everything is clear");
        }

        private static bool IsAskingAboutSalary(string text)
        {
            var lower = text.ToLowerInvariant();
            return lower.Contains("lương") ||
                   lower.Contains("salary") ||
                   lower.Contains("thu nhập") ||
                   lower.Contains("đãi ngộ") ||
                   lower.Contains("bonus") ||
                   lower.Contains("package");
        }

        private static bool IsAskingAboutRecruitmentTimelineOrPolicy(string text)
        {
            var lower = text.ToLowerInvariant();
            return (lower.Contains("bao giờ") && lower.Contains("kết quả")) ||
                   (lower.Contains("khi nào") && lower.Contains("kết quả")) ||
                   (lower.Contains("khi nào") && lower.Contains("feedback")) ||
                   (lower.Contains("bao giờ") && lower.Contains("feedback")) ||
                   (lower.Contains("bao lâu") && lower.Contains("kết quả")) ||
                   (lower.Contains("bao lâu") && lower.Contains("tăng lương")) ||
                   lower.Contains("hạn chót") ||
                   lower.Contains("chính sách tăng lương") ||
                   lower.Contains("thăng chức") ||
                   lower.Contains("kết quả phỏng vấn");
        }

        private static string? ExtractExplicitSalary(Session session)
        {
            // If explicit salary is mentioned in JdText or CompanyContext
            var text = (session.JdText ?? "") + " " + (session.InterviewContext?.JdText ?? "");
            if (text.Contains("$") || text.Contains("triệu", StringComparison.OrdinalIgnoreCase) || text.Contains("vnd", StringComparison.OrdinalIgnoreCase))
            {
                return "ExplicitSalaryInContext";
            }
            return null;
        }

        private static string? ExtractExplicitTimeline(Session session)
        {
            var text = (session.JdText ?? "") + " " + (session.InterviewContext?.JdText ?? "");
            if (text.Contains("ngày làm việc", StringComparison.OrdinalIgnoreCase) || text.Contains("vòng tiếp theo", StringComparison.OrdinalIgnoreCase))
            {
                return "ExplicitTimelineInContext";
            }
            return null;
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
