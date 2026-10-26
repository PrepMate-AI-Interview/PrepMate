using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using backend.Models;
using backend.Prompts.Knowledge;

namespace backend.Services.Knowledge
{
    public class KnowledgeBlueprintEnrichmentService
    {
        private readonly GeminiService _geminiService;

        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        public KnowledgeBlueprintEnrichmentService(GeminiService geminiService)
        {
            _geminiService = geminiService;
        }

        public async Task<KnowledgeBlueprint> EnrichAsync(
            KnowledgeBlueprint blueprint,
            CompanyContext? companyContext,
            string position,
            string? experienceLevel = "")
        {
            if (blueprint == null)
            {
                throw new ArgumentNullException(nameof(blueprint));
            }

            // Case: No CompanyContext or empty/unverified context -> return original blueprint unchanged
            if (companyContext == null ||
                string.IsNullOrWhiteSpace(companyContext.CompanyName) ||
                (companyContext.Industry == "Unknown" && companyContext.KnownFacts.Count == 0 && companyContext.Inferences.Count == 0))
            {
                return blueprint;
            }

            try
            {
                var prompt = BlueprintEnrichmentPrompt.Build(blueprint, companyContext, position, experienceLevel);

                Console.WriteLine($"[BLUEPRINT ENRICHMENT] Enriching blueprint for position '{position}' with company '{companyContext.CompanyName}'...");
                var json = await _geminiService.CallGeminiApiAsync(prompt, isJsonMode: true);

                var enrichedCandidate = ParseEnrichedBlueprint(json);
                if (enrichedCandidate != null && enrichedCandidate.Areas.Count > 0)
                {
                    var merged = MergeAndValidateEnrichment(blueprint, enrichedCandidate);
                    Console.WriteLine($"[BLUEPRINT ENRICHMENT] Successfully enriched blueprint with {merged.Areas.Count} areas.");
                    return merged;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BLUEPRINT ENRICHMENT] Enrichment failed ({ex.Message}). Retaining original blueprint.");
            }

            // Fallback: return original blueprint
            return blueprint;
        }

        public KnowledgeBlueprint? ParseEnrichedBlueprint(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return null;

            try
            {
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

                return JsonSerializer.Deserialize<KnowledgeBlueprint>(cleanJson, _jsonOptions);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BLUEPRINT ENRICHMENT] JSON deserialization failed: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Merges enrichment candidate into original blueprint with strict architectural safety guarantees:
        /// 1. Preserves all original concepts, their IDs, RequirementSources, and IsMandatory flags.
        /// 2. Only enriches ContextualSignals, CompanyRelevance, and level-appropriate expectations.
        /// 3. Prevents duplicate concepts.
        /// 4. Inferred competencies are strictly non-mandatory (IsMandatory = false, RequirementSource = INFERRED).
        /// </summary>
        public KnowledgeBlueprint MergeAndValidateEnrichment(KnowledgeBlueprint original, KnowledgeBlueprint enriched)
        {
            var result = new KnowledgeBlueprint
            {
                Id = original.Id,
                Position = original.Position,
                Level = original.Level,
                Version = string.IsNullOrWhiteSpace(enriched.Version) ? "2.0-enriched" : enriched.Version,
                Areas = new List<KnowledgeArea>()
            };

            // Map all existing concepts in original blueprint
            var originalConceptMap = new Dictionary<string, BlueprintConcept>(StringComparer.OrdinalIgnoreCase);
            var allOriginalConceptNames = new List<string>();

            foreach (var origArea in original.Areas)
            {
                foreach (var origConcept in origArea.Concepts)
                {
                    if (!string.IsNullOrWhiteSpace(origConcept.Id))
                        originalConceptMap[origConcept.Id] = origConcept;
                    if (!string.IsNullOrWhiteSpace(origConcept.Name))
                    {
                        originalConceptMap[origConcept.Name] = origConcept;
                        allOriginalConceptNames.Add(origConcept.Name);
                    }
                }
            }

            // Map all candidate concepts from enriched
            var enrichedConceptMap = new Dictionary<string, BlueprintConcept>(StringComparer.OrdinalIgnoreCase);
            if (enriched.Areas != null)
            {
                foreach (var enArea in enriched.Areas)
                {
                    if (enArea?.Concepts == null) continue;
                    foreach (var enConcept in enArea.Concepts)
                    {
                        if (!string.IsNullOrWhiteSpace(enConcept.Id))
                            enrichedConceptMap[enConcept.Id] = enConcept;
                        if (!string.IsNullOrWhiteSpace(enConcept.Name))
                            enrichedConceptMap[enConcept.Name] = enConcept;
                    }
                }
            }

            var resultConceptMap = new Dictionary<string, BlueprintConcept>(StringComparer.OrdinalIgnoreCase);

            // Step 1: Copy all original areas and concepts, enhancing existing concepts
            foreach (var origArea in original.Areas)
            {
                var newArea = new KnowledgeArea
                {
                    Name = origArea.Name,
                    Description = origArea.Description,
                    Importance = origArea.Importance,
                    RequiredLevel = origArea.RequiredLevel,
                    Competencies = new List<string>(origArea.Competencies ?? new List<string>()),
                    Concepts = new List<BlueprintConcept>()
                };

                foreach (var origConcept in origArea.Concepts)
                {
                    BlueprintConcept? candidate = null;
                    if (!string.IsNullOrWhiteSpace(origConcept.Id) && enrichedConceptMap.TryGetValue(origConcept.Id, out var byId))
                    {
                        candidate = byId;
                    }
                    else if (!string.IsNullOrWhiteSpace(origConcept.Name) && enrichedConceptMap.TryGetValue(origConcept.Name, out var byName))
                    {
                        candidate = byName;
                    }

                    var mergedConcept = new BlueprintConcept
                    {
                        Id = origConcept.Id,
                        Name = origConcept.Name,
                        // Level-appropriate expectations from candidate if available
                        ExpectedUnderstanding = (candidate?.ExpectedUnderstanding != null && candidate.ExpectedUnderstanding.Count > 0)
                            ? candidate.ExpectedUnderstanding
                            : origConcept.ExpectedUnderstanding,
                        PracticalSignals = (candidate?.PracticalSignals != null && candidate.PracticalSignals.Count > 0)
                            ? candidate.PracticalSignals
                            : origConcept.PracticalSignals,
                        FailureSignals = (candidate?.FailureSignals != null && candidate.FailureSignals.Count > 0)
                            ? candidate.FailureSignals
                            : origConcept.FailureSignals,
                        // Rule: PRESERVE original requirement source and mandatory flag (JD wins!)
                        RequirementSource = origConcept.RequirementSource,
                        IsMandatory = origConcept.IsMandatory,
                        // Enrich contextual signals & company relevance
                        ContextualSignals = candidate?.ContextualSignals != null ? new List<string>(candidate.ContextualSignals) : new List<string>(),
                        CompanyRelevance = candidate?.CompanyRelevance != null ? new List<string>(candidate.CompanyRelevance) : new List<string>()
                    };

                    newArea.Concepts.Add(mergedConcept);
                    if (!string.IsNullOrWhiteSpace(mergedConcept.Id))
                        resultConceptMap[mergedConcept.Id] = mergedConcept;
                    if (!string.IsNullOrWhiteSpace(mergedConcept.Name))
                        resultConceptMap[mergedConcept.Name] = mergedConcept;
                }

                result.Areas.Add(newArea);
            }

            // Step 2: Handle genuinely new inferred competencies proposed by enrichment
            if (enriched.Areas != null)
            {
                foreach (var enArea in enriched.Areas)
                {
                    if (enArea?.Concepts == null) continue;
                    foreach (var enConcept in enArea.Concepts)
                    {
                        if (string.IsNullOrWhiteSpace(enConcept.Name)) continue;

                        // Check if it's already in original or is a duplicate/similar concept
                        bool isDuplicate = resultConceptMap.ContainsKey(enConcept.Id) ||
                                           resultConceptMap.ContainsKey(enConcept.Name) ||
                                           resultConceptMap.Values.Any(existing => IsDuplicateOrSimilar(existing.Name, enConcept.Name));

                        if (isDuplicate)
                        {
                            // If it's a duplicate, merge its contextual signals into existing concept instead of creating duplicate
                            var target = resultConceptMap.GetValueOrDefault(enConcept.Id) ??
                                         resultConceptMap.GetValueOrDefault(enConcept.Name) ??
                                         resultConceptMap.Values.FirstOrDefault(c => IsDuplicateOrSimilar(c.Name, enConcept.Name));

                            if (target != null)
                            {
                                if (enConcept.ContextualSignals != null)
                                {
                                    foreach (var s in enConcept.ContextualSignals)
                                    {
                                        if (!target.ContextualSignals.Contains(s, StringComparer.OrdinalIgnoreCase))
                                            target.ContextualSignals.Add(s);
                                    }
                                }
                                if (enConcept.CompanyRelevance != null)
                                {
                                    foreach (var r in enConcept.CompanyRelevance)
                                    {
                                        if (!target.CompanyRelevance.Contains(r, StringComparer.OrdinalIgnoreCase))
                                            target.CompanyRelevance.Add(r);
                                    }
                                }
                            }
                            continue;
                        }

                        // Genuinely new competency:
                        // Rule 11 & Acceptance Criteria: MUST be INFERRED and NON-MANDATORY
                        var newInferredConcept = new BlueprintConcept
                        {
                            Id = string.IsNullOrWhiteSpace(enConcept.Id)
                                ? Regex.Replace(enConcept.Name.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-')
                                : enConcept.Id,
                            Name = enConcept.Name,
                            ExpectedUnderstanding = enConcept.ExpectedUnderstanding ?? new List<string>(),
                            PracticalSignals = enConcept.PracticalSignals ?? new List<string>(),
                            FailureSignals = enConcept.FailureSignals ?? new List<string>(),
                            RequirementSource = RequirementSource.INFERRED, // Enforced
                            IsMandatory = false,                            // Enforced
                            ContextualSignals = enConcept.ContextualSignals ?? new List<string>(),
                            CompanyRelevance = enConcept.CompanyRelevance ?? new List<string>()
                        };

                        // Add to matching area or first available area
                        var targetArea = result.Areas.FirstOrDefault(a => string.Equals(a.Name, enArea.Name, StringComparison.OrdinalIgnoreCase))
                                         ?? result.Areas.FirstOrDefault();

                        if (targetArea != null)
                        {
                            targetArea.Concepts.Add(newInferredConcept);
                            resultConceptMap[newInferredConcept.Id] = newInferredConcept;
                            resultConceptMap[newInferredConcept.Name] = newInferredConcept;
                        }
                    }
                }
            }

            return result;
        }

        public static bool IsDuplicateOrSimilar(string name1, string name2)
        {
            if (string.Equals(name1, name2, StringComparison.OrdinalIgnoreCase))
                return true;

            var n1 = Regex.Replace(name1.ToLowerInvariant(), @"[^a-z0-9]", " ").Trim();
            var n2 = Regex.Replace(name2.ToLowerInvariant(), @"[^a-z0-9]", " ").Trim();

            if (n1 == n2)
                return true;

            var tokens1 = n1.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var tokens2 = n2.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            if (tokens1.Length == 1 && tokens2.Contains(tokens1[0]))
                return true;
            if (tokens2.Length == 1 && tokens1.Contains(tokens2[0]))
                return true;

            return false;
        }
    }
}
