using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using backend.Models;
using backend.Prompts.Knowledge;

namespace backend.Services.Knowledge
{
    public class KnowledgeBlueprintService
    {
        private readonly GeminiService _geminiService;

        public KnowledgeBlueprintService(GeminiService geminiService)
        {
            _geminiService = geminiService;
        }

        public async Task<KnowledgeBlueprint?> GenerateAsync(
            string position,
            string? jdText,
            string? experienceLevel = "",
            CompanyContext? companyContext = null)
        {
            if (string.IsNullOrWhiteSpace(jdText))
            {
                Console.WriteLine("[BLUEPRINT] JD is empty or null. Skipping blueprint generation.");
                return null;
            }

            var safePosition = string.IsNullOrWhiteSpace(position) ? "Professional" : position.Trim();
            var safeLevel = experienceLevel?.Trim() ?? string.Empty;

            try
            {
                var prompt = BlueprintPrompt.Build(safePosition, jdText.Trim(), safeLevel, companyContext);

                Console.WriteLine($"[BLUEPRINT] Generating Knowledge Blueprint for position: '{safePosition}'...");
                var json = await _geminiService.CallGeminiApiAsync(
                    prompt,
                    isJsonMode: true
                );

                Console.WriteLine("========== RAW BLUEPRINT JSON ==========");
                Console.WriteLine(json);
                Console.WriteLine("========================================");

                var blueprint = ParseBlueprintJson(json, safePosition, safeLevel);
                if (blueprint != null && blueprint.Areas.Count > 0)
                {
                    Console.WriteLine($"[BLUEPRINT] Successfully generated Knowledge Blueprint with {blueprint.Areas.Count} areas.");
                    return blueprint;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BLUEPRINT] Failed to generate knowledge blueprint from JD: {ex.Message}");
            }

            return null;
        }

        public KnowledgeBlueprint? ParseBlueprintJson(string json, string defaultPosition, string defaultLevel)
        {
            if (string.IsNullOrWhiteSpace(json))
                return null;

            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var blueprint = new KnowledgeBlueprint
                {
                    Id = Guid.NewGuid().ToString(),
                    Position = root.TryGetProperty("position", out var posProp) && !string.IsNullOrWhiteSpace(posProp.GetString())
                        ? posProp.GetString()!
                        : defaultPosition,
                    Level = root.TryGetProperty("level", out var lvlProp) && !string.IsNullOrWhiteSpace(lvlProp.GetString())
                        ? lvlProp.GetString()!
                        : defaultLevel,
                    Version = root.TryGetProperty("version", out var verProp) && !string.IsNullOrWhiteSpace(verProp.GetString())
                        ? verProp.GetString()!
                        : "1.0",
                    Areas = new List<KnowledgeArea>()
                };

                if (root.TryGetProperty("areas", out var areasElem) && areasElem.ValueKind == JsonValueKind.Array)
                {
                    foreach (var areaElem in areasElem.EnumerateArray())
                    {
                        var areaName = areaElem.TryGetProperty("name", out var aName) ? aName.GetString() ?? "" : "";
                        if (string.IsNullOrWhiteSpace(areaName))
                            continue;

                        var areaDesc = areaElem.TryGetProperty("description", out var aDesc) ? aDesc.GetString() ?? "" : "";
                        var reqLevel = areaElem.TryGetProperty("requiredLevel", out var aReqLvl) ? aReqLvl.GetString() ?? "" : "";

                        var importance = AreaImportance.HIGH;
                        if (areaElem.TryGetProperty("importance", out var aImp))
                        {
                            var impStr = aImp.GetString();
                            if (Enum.TryParse<AreaImportance>(impStr, true, out var parsedImp))
                            {
                                importance = parsedImp;
                            }
                        }

                        var competencies = new List<string>();
                        if (areaElem.TryGetProperty("competencies", out var compsElem) && compsElem.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var c in compsElem.EnumerateArray())
                            {
                                var val = c.GetString();
                                if (!string.IsNullOrWhiteSpace(val))
                                    competencies.Add(val.Trim());
                            }
                        }

                        var concepts = new List<BlueprintConcept>();
                        if (areaElem.TryGetProperty("concepts", out var conceptsElem) && conceptsElem.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var conceptElem in conceptsElem.EnumerateArray())
                            {
                                var cName = conceptElem.TryGetProperty("name", out var cNameElem) ? cNameElem.GetString() ?? "" : "";
                                if (string.IsNullOrWhiteSpace(cName))
                                    continue;

                                var cId = conceptElem.TryGetProperty("id", out var cIdElem) ? cIdElem.GetString() ?? "" : "";
                                if (string.IsNullOrWhiteSpace(cId))
                                {
                                    cId = Regex.Replace(cName.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
                                    if (string.IsNullOrWhiteSpace(cId))
                                        cId = Guid.NewGuid().ToString("N")[..8];
                                }

                                var expectedUnderstanding = ParseStringList(conceptElem, "expectedUnderstanding");
                                var practicalSignals = ParseStringList(conceptElem, "practicalSignals");
                                var failureSignals = ParseStringList(conceptElem, "failureSignals");

                                var reqSource = RequirementSource.OFFICIAL;
                                if (conceptElem.TryGetProperty("requirementSource", out var rSourceElem))
                                {
                                    var rSourceStr = rSourceElem.GetString();
                                    if (Enum.TryParse<RequirementSource>(rSourceStr, true, out var parsedSource))
                                    {
                                        reqSource = parsedSource;
                                    }
                                }

                                var isMandatory = true;
                                if (conceptElem.TryGetProperty("isMandatory", out var mandElem))
                                {
                                    if (mandElem.ValueKind == JsonValueKind.True || mandElem.ValueKind == JsonValueKind.False)
                                    {
                                        isMandatory = mandElem.GetBoolean();
                                    }
                                }

                                concepts.Add(new BlueprintConcept
                                {
                                    Id = cId,
                                    Name = cName.Trim(),
                                    ExpectedUnderstanding = expectedUnderstanding,
                                    PracticalSignals = practicalSignals,
                                    FailureSignals = failureSignals,
                                    RequirementSource = reqSource,
                                    IsMandatory = isMandatory
                                });
                            }
                        }

                        blueprint.Areas.Add(new KnowledgeArea
                        {
                            Name = areaName.Trim(),
                            Description = areaDesc.Trim(),
                            Importance = importance,
                            RequiredLevel = reqLevel.Trim(),
                            Competencies = competencies,
                            Concepts = concepts
                        });
                    }
                }

                return blueprint.Areas.Count > 0 ? blueprint : null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BLUEPRINT] JSON parsing error: {ex.Message}");
                return null;
            }
        }

        private static List<string> ParseStringList(JsonElement element, string propertyName)
        {
            var result = new List<string>();
            if (!element.TryGetProperty(propertyName, out var prop))
                return result;

            if (prop.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in prop.EnumerateArray())
                {
                    var val = item.GetString();
                    if (!string.IsNullOrWhiteSpace(val))
                        result.Add(val.Trim());
                }
            }
            else if (prop.ValueKind == JsonValueKind.String)
            {
                var val = prop.GetString();
                if (!string.IsNullOrWhiteSpace(val))
                    result.Add(val.Trim());
            }

            return result;
        }
    }
}
