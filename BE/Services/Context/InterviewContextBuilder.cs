using System;
using System.Text.Json;
using System.Threading.Tasks;
using backend.Models;
using System.Collections.Generic;
using backend.Services.Knowledge;
using backend.Services.Company;
using backend.Services.Interview;

namespace backend.Services
{
    public class InterviewContextBuilder
    {
        private readonly GeminiService _geminiService;
        private readonly KnowledgeBlueprintService _knowledgeBlueprintService;
        private readonly KnowledgeBlueprintEnrichmentService _blueprintEnrichmentService;
        private readonly CompanyIntelligenceService _companyIntelligenceService;
        private readonly InterviewStrategyService _strategyService;

        public InterviewContextBuilder(
            GeminiService geminiService,
            KnowledgeBlueprintService knowledgeBlueprintService,
            KnowledgeBlueprintEnrichmentService blueprintEnrichmentService,
            CompanyIntelligenceService companyIntelligenceService,
            InterviewStrategyService strategyService)
        {
            _geminiService = geminiService;
            _knowledgeBlueprintService = knowledgeBlueprintService;
            _blueprintEnrichmentService = blueprintEnrichmentService;
            _companyIntelligenceService = companyIntelligenceService;
            _strategyService = strategyService;
        }

        public async Task<InterviewContext> BuildAsync(
            CreateSessionRequest request)
        {
            var context = new InterviewContext
            {
                FullName = request.FullName ?? string.Empty,
                Major = request.Major ?? string.Empty,
                Specialization = request.Specialization ?? string.Empty,
                ExperienceLevel = request.ExperienceLevel ?? string.Empty,
                TargetPosition = request.JobTitle,
                TargetCompany = request.TargetCompany ?? string.Empty,
                JdText = request.JdText ?? string.Empty,
                Skills = request.Skills ?? new(),
                Language = InterviewLanguage.Normalize(request.InterviewLanguage ?? request.Language)
            };

            var cvText = request.CvText ?? string.Empty;
            var jdText = request.JdText ?? string.Empty;

            var cvForPrompt = cvText.Length > 6000
                ? cvText[..6000]
                : cvText;

            var jdForPrompt = jdText.Length > 5000
                ? jdText[..5000]
                : jdText;

            var requestSkills = request.Skills ?? new List<string>();

            var skills = requestSkills.Count > 0
                ? string.Join(", ", requestSkills)
                : "Chưa cung cấp";

            var prompt = backend.Prompts.Context.InterviewContextPrompt.Build(
                request,
                cvForPrompt,
                jdForPrompt,
                skills,
                request.InterviewLanguage ?? request.Language ?? backend.Models.InterviewLanguage.Vietnamese
            );

            // Phase 2 Step 5 & 6: Extract Company Context and Knowledge Blueprint
            CompanyContext? companyContext = null;
            if (!string.IsNullOrWhiteSpace(request.TargetCompany) || !string.IsNullOrWhiteSpace(request.CompanyDescription))
            {
                try
                {
                    companyContext = await _companyIntelligenceService.ExtractCompanyContextAsync(
                        request.TargetCompany,
                        jdText,
                        request.CompanyDescription,
                        request.CompanyUrl
                    );
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[INTERVIEW] Company context extraction error: {ex.Message}");
                }
            }

            KnowledgeBlueprint? blueprint = null;
            try
            {
                blueprint = await _knowledgeBlueprintService.GenerateAsync(
                    request.JobTitle,
                    jdText,
                    request.ExperienceLevel,
                    companyContext
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[INTERVIEW] Blueprint generation error: {ex.Message}");
            }

            if (blueprint != null && companyContext != null && !string.IsNullOrWhiteSpace(jdText))
            {
                try
                {
                    blueprint = await _blueprintEnrichmentService.EnrichAsync(
                        blueprint,
                        companyContext,
                        request.JobTitle,
                        request.ExperienceLevel
                    );
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[INTERVIEW] Blueprint enrichment error: {ex.Message}");
                }
            }

            InterviewStrategy? strategy = null;
            if (blueprint != null)
            {
                try
                {
                    strategy = _strategyService.BuildStrategy(
                        blueprint,
                        companyContext,
                        request.JobTitle,
                        request.ExperienceLevel,
                        request.MaximumQuestions ?? InterviewState.DemoInterviewQuestionLimit,
                        request.TargetDurationMinutes ?? 10
                    );
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[INTERVIEW] Strategy building error: {ex.Message}");
                }
            }

            // OPTIMIZATION (WI-INTERVIEW-PERFORMANCE-OPTIMIZATION-01 & 02):
            // Reuse prepared CV/JD analysis if already computed in Setup Step 4, avoiding redundant AI context call.
            // Verified & sanitized against arbitrary length / malformed injections.
            if (request.CvAnalysis != null && (request.CvAnalysis.KeySkills?.Count > 0 || !string.IsNullOrWhiteSpace(request.CvAnalysis.Summary)))
            {
                Console.WriteLine("[CONTEXT] Reusing prepared CV/JD analysis from setup step. Skipping redundant AI CvAnalysis call.");
                var preparedKeySkills = SanitizeSnapshotSkills(request.CvAnalysis.KeySkills ?? request.Skills);
                var preparedJdSkills = SanitizeSnapshotSkills(request.JdAnalysis?.KeySkills);

                context.CvSummary = !string.IsNullOrWhiteSpace(request.CvAnalysis.Summary)
                    ? SanitizeSnapshotText(request.CvAnalysis.Summary, 2000)
                    : BuildFallbackCvSummary(request);
                context.Skills = preparedKeySkills;
                context.CandidateTopics = preparedKeySkills.Take(5).ToList();
                context.ExpectedTopics = preparedJdSkills.Count > 0 ? preparedJdSkills.Take(5).ToList() : preparedKeySkills.Take(5).ToList();
                context.Persona = InterviewerPersona.CreateDefault(context.TargetPosition);
                context.KnowledgeBlueprint = blueprint;
                context.CompanyContext = companyContext;
                context.Strategy = strategy;
                context.Industry = companyContext != null && companyContext.Industry != "Unknown"
                    ? companyContext.Industry
                    : ProfessionalDomainClassifier.Classify(context.TargetPosition);

                return context;
            }

            // Fallback: Run context prompt if CV analysis was not pre-computed
            Task<string>? contextPromptTask = null;
            try
            {
                contextPromptTask = _geminiService.CallGeminiApiForTaskAsync(
                    backend.Models.AI.AITaskType.CvAnalysis,
                    prompt,
                    isJsonMode: true
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[INTERVIEW] Failed to dispatch context prompt: {ex.Message}");
            }

            if (contextPromptTask != null)
            {
                try
                {
                    var json = await contextPromptTask;
                    Console.WriteLine("========== INTERVIEW CONTEXT RAW RESPONSE ==========");
                    Console.WriteLine(json);
                    Console.WriteLine("========== END INTERVIEW CONTEXT RAW RESPONSE ==========");
                    var options = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };

                    var aiContext = JsonSerializer.Deserialize<InterviewContext>(json, options);
                    if (aiContext != null)
                    {
                        aiContext.FullName = context.FullName;
                        aiContext.Major = context.Major;
                        aiContext.Specialization = context.Specialization;
                        aiContext.ExperienceLevel = context.ExperienceLevel;
                        aiContext.TargetPosition = context.TargetPosition;
                        aiContext.TargetCompany = context.TargetCompany;
                        aiContext.JdText = context.JdText;

                        if (aiContext.Skills.Count == 0)
                        {
                            aiContext.Skills = context.Skills;
                        }

                        if (aiContext.Persona == null || string.IsNullOrWhiteSpace(aiContext.Persona.Role))
                        {
                            aiContext.Persona = InterviewerPersona.CreateDefault(aiContext.TargetPosition);
                        }

                        aiContext.KnowledgeBlueprint = blueprint;
                        aiContext.CompanyContext = companyContext;
                        aiContext.Strategy = strategy;
                        if (string.IsNullOrWhiteSpace(aiContext.Industry))
                        {
                            aiContext.Industry = companyContext != null && companyContext.Industry != "Unknown"
                                ? companyContext.Industry
                                : ProfessionalDomainClassifier.Classify(aiContext.TargetPosition);
                        }

                        return aiContext;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[INTERVIEW] Context building error: {ex.Message}");
                }
            }

            // Nếu Gemini lỗi vẫn phải tạo được session.
            context.CvSummary = BuildFallbackCvSummary(request);
            context.Persona = InterviewerPersona.CreateDefault(context.TargetPosition);
            context.KnowledgeBlueprint = blueprint;
            context.CompanyContext = companyContext;
            context.Strategy = strategy;
            if (string.IsNullOrWhiteSpace(context.Industry))
            {
                context.Industry = companyContext != null && companyContext.Industry != "Unknown"
                    ? companyContext.Industry
                    : ProfessionalDomainClassifier.Classify(context.TargetPosition);
            }

            return context;
        }

        private string BuildFallbackCvSummary(
            CreateSessionRequest request)
        {
            var parts = new[]
            {
                request.Specialization,
                request.ExperienceLevel,
                request.UserDescription
            };

            return string.Join(
                " | ",
                Array.FindAll(
                    parts,
                    x => !string.IsNullOrWhiteSpace(x)
                )
            );
        }

        private static string SanitizeSnapshotText(string? text, int maxLength = 2000)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;
            var sanitized = text.Replace("\0", string.Empty).Trim();
            if (sanitized.Length > maxLength) sanitized = sanitized.Substring(0, maxLength);
            return sanitized;
        }

        private static List<string> SanitizeSnapshotSkills(IEnumerable<string>? skills, int maxCount = 30)
        {
            if (skills == null) return new List<string>();
            return skills
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => SanitizeSnapshotText(s, 100))
                .Where(s => s.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(maxCount)
                .ToList();
        }
    }
}
