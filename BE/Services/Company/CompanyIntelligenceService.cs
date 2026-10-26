using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using backend.Models;
using backend.Prompts;
using backend.Prompts.Company;

namespace backend.Services.Company
{
    public class CompanyIntelligenceService
    {
        private readonly GeminiService _geminiService;

        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        public CompanyIntelligenceService(GeminiService geminiService)
        {
            _geminiService = geminiService;
        }

        public async Task<CompanyContext?> ExtractCompanyContextAsync(
            string? companyName,
            string? jdText,
            string? companyDescription = null,
            string? companyUrl = null)
        {
            if (string.IsNullOrWhiteSpace(companyName) && string.IsNullOrWhiteSpace(companyDescription))
            {
                return null;
            }

            var safeCompanyName = companyName?.Trim() ?? "Target Company";

            // If we have absolutely no context beyond a bare name, return a safe unverified context without calling LLM
            if (string.IsNullOrWhiteSpace(jdText) && string.IsNullOrWhiteSpace(companyDescription) && string.IsNullOrWhiteSpace(companyUrl))
            {
                return new CompanyContext
                {
                    CompanyName = safeCompanyName,
                    Industry = "Unknown",
                    CompanyType = "Unknown",
                    SourceReliability = RequirementSource.UNKNOWN,
                    IsVerified = false,
                    VerificationNotes = "Only company name provided. No verified background information available.",
                    KnownFacts = new List<CompanyFactItem>(),
                    Inferences = new List<CompanyFactItem>()
                };
            }

            try
            {
                var prompt = CompanyIntelligencePrompt.BuildExtractionPrompt(
                    safeCompanyName,
                    jdText,
                    companyDescription,
                    companyUrl
                );

                Console.WriteLine($"[COMPANY INTELLIGENCE] Extracting context for '{safeCompanyName}'...");
                var json = await _geminiService.CallGeminiApiAsync(prompt, isJsonMode: true);

                var context = ParseCompanyContext(json, safeCompanyName);
                if (context != null)
                {
                    Console.WriteLine($"[COMPANY INTELLIGENCE] Successfully extracted context for '{safeCompanyName}': Industry='{context.Industry}', Type='{context.CompanyType}', Facts={context.KnownFacts.Count}, Inferences={context.Inferences.Count}");
                    return context;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[COMPANY INTELLIGENCE] Error extracting company context: {ex.Message}. Falling back to safe unverified context.");
            }

            // Fallback object to guarantee zero crash and zero hallucination
            return new CompanyContext
            {
                CompanyName = safeCompanyName,
                Industry = "Unknown",
                CompanyType = "Unknown",
                SourceReliability = RequirementSource.UNKNOWN,
                IsVerified = false,
                VerificationNotes = "Fallback: Company context extraction could not be completed.",
                KnownFacts = new List<CompanyFactItem>(),
                Inferences = new List<CompanyFactItem>()
            };
        }

        public CompanyContext? ParseCompanyContext(string? json, string defaultCompanyName)
        {
            if (string.IsNullOrWhiteSpace(json))
                return null;

            try
            {
                // Clean potential markdown blocks if present
                var cleanJson = json.Trim();
                if (cleanJson.StartsWith("```json"))
                {
                    cleanJson = cleanJson.Substring(7);
                }
                else if (cleanJson.StartsWith("```"))
                {
                    cleanJson = cleanJson.Substring(3);
                }

                if (cleanJson.EndsWith("```"))
                {
                    cleanJson = cleanJson.Substring(0, cleanJson.Length - 3);
                }
                cleanJson = cleanJson.Trim();

                var context = JsonSerializer.Deserialize<CompanyContext>(cleanJson, _jsonOptions);
                if (context != null)
                {
                    if (string.IsNullOrWhiteSpace(context.CompanyName))
                    {
                        context.CompanyName = defaultCompanyName;
                    }
                    context.KnownFacts ??= new List<CompanyFactItem>();
                    context.Inferences ??= new List<CompanyFactItem>();

                    // Default to Unknown if missing
                    if (string.IsNullOrWhiteSpace(context.Industry))
                        context.Industry = "Unknown";
                    if (string.IsNullOrWhiteSpace(context.CompanyType))
                        context.CompanyType = "Unknown";

                    return context;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[COMPANY INTELLIGENCE] JSON deserialization failed: {ex.Message}");
            }

            return null;
        }
    }
}
