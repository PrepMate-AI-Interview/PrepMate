using System;
using System.Collections.Generic;
using System.Linq;
using backend.Models;

namespace backend.Services.Interview
{
    public class InterviewStrategyService
    {
        public InterviewStrategy? BuildStrategy(
            KnowledgeBlueprint? blueprint,
            CompanyContext? companyContext,
            string position,
            string? experienceLevel = "Middle",
            int maximumQuestions = 15,
            int targetDurationMinutes = 30)
        {
            if (blueprint == null || blueprint.Areas == null || blueprint.Areas.Count == 0)
            {
                return null;
            }

            var safeLevel = string.IsNullOrWhiteSpace(experienceLevel) ? "Middle" : experienceLevel.Trim();
            var totalBudget = Math.Max(1, maximumQuestions);
            var duration = Math.Max(5, targetDurationMinutes);

            var strategy = new InterviewStrategy
            {
                TotalQuestionBudget = totalBudget,
                TargetDurationMinutes = duration,
                CandidateLevel = safeLevel,
                Areas = new List<InterviewAreaStrategy>()
            };

            // 1. Calculate raw points for each area
            var areaScores = new List<(KnowledgeArea Area, double Points)>();
            foreach (var area in blueprint.Areas)
            {
                if (area == null) continue;

                double points = area.Importance switch
                {
                    AreaImportance.HIGH => 3.0,
                    AreaImportance.MEDIUM => 2.0,
                    AreaImportance.LOW => 1.0,
                    _ => 2.0
                };

                // Weight bonus for mandatory concepts
                var mandatoryCount = area.Concepts?.Count(c => c.IsMandatory) ?? 0;
                points += (mandatoryCount * 2.0);

                // Contextual bonus if area concepts relate directly to company operational domain
                if (area.Concepts != null && area.Concepts.Any(c => c.CompanyRelevance != null && c.CompanyRelevance.Count > 0))
                {
                    points += 1.0;
                }

                areaScores.Add((area, points));
            }

            var totalPoints = areaScores.Sum(x => x.Points);
            if (totalPoints <= 0) totalPoints = 1.0;

            // 2. Build area strategies with normalized weights (summing to 100%)
            double accumulatedWeight = 0.0;
            var areaStrategies = new List<InterviewAreaStrategy>();

            for (int i = 0; i < areaScores.Count; i++)
            {
                var (area, points) = areaScores[i];
                double weight = Math.Round((points / totalPoints) * 100.0, 1);

                // Adjust rounding on the last element to guarantee exact 100.0% sum
                if (i == areaScores.Count - 1)
                {
                    weight = Math.Round(100.0 - accumulatedWeight, 1);
                }
                else
                {
                    accumulatedWeight += weight;
                }

                // Allocate question budget proportionally to weight
                var allocatedBudget = Math.Max(1, (int)Math.Round(totalBudget * (weight / 100.0)));

                var areaStrat = new InterviewAreaStrategy
                {
                    AreaName = area.Name,
                    Importance = area.Importance,
                    WeightPercentage = weight,
                    AllocatedQuestionBudget = allocatedBudget,
                    Concepts = new List<InterviewConceptStrategy>()
                };

                // 3. Build concept strategies
                if (area.Concepts != null)
                {
                    foreach (var concept in area.Concepts)
                    {
                        if (string.IsNullOrWhiteSpace(concept.Id) && string.IsNullOrWhiteSpace(concept.Name))
                            continue;

                        // Concept Priority (1 = Highest, 2 = Medium, 3 = Lower)
                        // Precedence: Explicit Mandatory > Explicit Optional > Inferred
                        int priority = 3;
                        if (concept.RequirementSource == RequirementSource.OFFICIAL)
                        {
                            priority = concept.IsMandatory ? 1 : 2;
                        }
                        else if (concept.RequirementSource == RequirementSource.TRUSTED_EXTERNAL)
                        {
                            priority = concept.IsMandatory ? 1 : 2;
                        }
                        else if (concept.RequirementSource == RequirementSource.CANDIDATE_REPORTED)
                        {
                            priority = 2;
                        }
                        else // INFERRED or UNKNOWN
                        {
                            priority = 3;
                        }

                        // Minimum Coverage Level based on Seniority Level & Mandatory status
                        ConceptCoverageStatus minCoverage;
                        if (safeLevel.Equals("Senior", StringComparison.OrdinalIgnoreCase))
                        {
                            minCoverage = concept.IsMandatory
                                ? ConceptCoverageStatus.STRONG
                                : ConceptCoverageStatus.PARTIAL;
                        }
                        else if (safeLevel.Equals("Junior", StringComparison.OrdinalIgnoreCase))
                        {
                            minCoverage = concept.IsMandatory
                                ? ConceptCoverageStatus.PARTIAL
                                : ConceptCoverageStatus.INTRODUCED;
                        }
                        else // Middle / Default
                        {
                            minCoverage = concept.IsMandatory
                                ? ConceptCoverageStatus.STRONG
                                : ConceptCoverageStatus.PARTIAL;
                        }

                        // Question budget per concept
                        int maxConceptBudget = concept.IsMandatory ? 3 : 2;

                        var conceptStrat = new InterviewConceptStrategy
                        {
                            ConceptId = concept.Id,
                            ConceptName = concept.Name,
                            RequirementSource = concept.RequirementSource,
                            IsMandatory = concept.IsMandatory,
                            Priority = priority,
                            MinimumCoverage = minCoverage,
                            MinQuestionBudget = 1,
                            MaxQuestionBudget = maxConceptBudget,
                            QuestionsAsked = 0
                        };

                        areaStrat.Concepts.Add(conceptStrat);
                    }
                }

                areaStrategies.Add(areaStrat);
            }

            strategy.Areas = areaStrategies;
            return strategy;
        }
    }
}
