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

            // Performance Optimization: Run Context Prompt asynchronously in parallel with Company Context & Blueprint
            var contextPromptTask = _geminiService.CallGeminiApiForTaskAsync(
                backend.Models.AI.AITaskType.CvAnalysis,
                prompt,
                isJsonMode: true
            );

            // Phase 2 Step 5: Extract Company Context (if company name or description is provided)
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

            // Phase 2: Generate Knowledge Blueprint from JD (if JD is provided)
            KnowledgeBlueprint? blueprint = null;
            if (!string.IsNullOrWhiteSpace(jdText))
            {
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
            }

            // Phase 2 Step 6: Enrich Blueprint with CompanyContext & Level Contextual Signals
            if (blueprint != null && companyContext != null)
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

            // Phase 2 Step 7: Build Interview Strategy & Coverage Plan
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
                        request.MaximumQuestions ?? 15,
                        request.TargetDurationMinutes ?? 30
                    );
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[INTERVIEW] Strategy building error: {ex.Message}");
                }
            }

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

                var aiContext =
                    JsonSerializer.Deserialize<InterviewContext>(
                        json,
                        options
                    );

                if (aiContext != null)
                {
                    // Giữ dữ liệu gốc từ request.
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
                Console.WriteLine(
                    $"[INTERVIEW] Context building error: {ex.Message}"
                );
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
    }
}