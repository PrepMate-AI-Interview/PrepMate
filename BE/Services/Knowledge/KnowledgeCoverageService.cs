using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using backend.Models;

namespace backend.Services.Knowledge
{
    public class KnowledgeCoverageService
    {
        /// <summary>
        /// Initializes the KnowledgeCoverage dictionary in InterviewState with all concepts from the blueprint
        /// set to ConceptCoverageStatus.NOT_TESTED.
        /// </summary>
        public void InitializeCoverage(InterviewState state, KnowledgeBlueprint? blueprint)
        {
            if (state == null || blueprint == null || blueprint.Areas == null)
            {
                return;
            }

            state.KnowledgeCoverage ??= new Dictionary<string, ConceptCoverageStatus>();

            foreach (var area in blueprint.Areas)
            {
                if (area?.Concepts == null) continue;

                foreach (var concept in area.Concepts)
                {
                    if (string.IsNullOrWhiteSpace(concept.Id))
                    {
                        continue;
                    }

                    if (!state.KnowledgeCoverage.ContainsKey(concept.Id))
                    {
                        state.KnowledgeCoverage[concept.Id] = ConceptCoverageStatus.NOT_TESTED;
                    }
                }
            }
        }

        /// <summary>
        /// Updates the KnowledgeCoverage in InterviewState based on the evidence evaluated in AnswerAnalysis.
        /// Strictly scoped to concepts that exist in the KnowledgeBlueprint.
        /// Does NOT reset dictionary and avoids arbitrary downgrading of established competence.
        /// </summary>
        public void UpdateCoverage(InterviewState state, KnowledgeBlueprint? blueprint, AnswerAnalysis? analysis)
        {
            if (state == null || blueprint == null || blueprint.Areas == null || analysis == null)
            {
                return;
            }

            state.KnowledgeCoverage ??= new Dictionary<string, ConceptCoverageStatus>();

            // Collect all blueprint concepts
            var blueprintConcepts = blueprint.Areas
                .Where(a => a?.Concepts != null)
                .SelectMany(a => a.Concepts)
                .Where(c => !string.IsNullOrWhiteSpace(c.Id))
                .ToList();

            if (blueprintConcepts.Count == 0)
            {
                return;
            }

            // Ensure all blueprint concepts have an initial status
            foreach (var bc in blueprintConcepts)
            {
                if (!state.KnowledgeCoverage.ContainsKey(bc.Id))
                {
                    state.KnowledgeCoverage[bc.Id] = ConceptCoverageStatus.NOT_TESTED;
                }
            }

            // Evaluate each blueprint concept against analysis signals
            foreach (var concept in blueprintConcepts)
            {
                var conceptId = concept.Id;
                var currentStatus = state.KnowledgeCoverage.TryGetValue(conceptId, out var existing)
                    ? existing
                    : ConceptCoverageStatus.NOT_TESTED;

                var isMentioned = IsConceptMatch(concept, analysis.Concepts) ||
                                  IsConceptMatch(concept, new[] { analysis.MainConcept });

                var isIncorrect = IsConceptMatch(concept, analysis.IncorrectConcepts) ||
                                  (analysis.DoesNotKnow && isMentioned);

                var isCorrect = IsConceptMatch(concept, analysis.CorrectConcepts);

                var isVerifiedFact = IsConceptMatch(concept, analysis.VerifiedFacts);

                var isUnverifiedClaim = IsConceptMatch(concept, analysis.UnverifiedClaims);

                // If this concept was not part of this turn's evidence, leave it unchanged
                if (!isMentioned && !isIncorrect && !isCorrect && !isVerifiedFact && !isUnverifiedClaim)
                {
                    continue;
                }

                var newStatus = DetermineNewStatus(
                    currentStatus,
                    isCorrect,
                    isIncorrect,
                    isVerifiedFact,
                    isUnverifiedClaim,
                    analysis.ShowsPracticalExperience,
                    analysis.Depth,
                    analysis.HasInconsistency
                );

                state.KnowledgeCoverage[conceptId] = newStatus;
            }
        }

        private static ConceptCoverageStatus DetermineNewStatus(
            ConceptCoverageStatus current,
            bool isCorrect,
            bool isIncorrect,
            bool isVerifiedFact,
            bool isUnverifiedClaim,
            bool showsPracticalExperience,
            int depth,
            bool hasInconsistency)
        {
            // 1. INCORRECT CONCEPTS
            if (isIncorrect)
            {
                // Rule 13: Do not arbitrarily downgrade an already established STRONG or VERIFIED competence
                if (current == ConceptCoverageStatus.STRONG || current == ConceptCoverageStatus.VERIFIED)
                {
                    return current;
                }
                return ConceptCoverageStatus.WEAK;
            }

            // 2. VERIFIED (Highest standard)
            // Multiple grounds for VERIFIED:
            // a) Already STRONG, and candidate demonstrates correct practical understanding again
            // b) Verified fact with depth >= 2
            // c) Shows practical experience with depth >= 3 without inconsistency
            if ((current == ConceptCoverageStatus.STRONG && isCorrect && (showsPracticalExperience || depth >= 2)) ||
                (isVerifiedFact && depth >= 2) ||
                (isCorrect && showsPracticalExperience && depth >= 3 && !hasInconsistency))
            {
                return ConceptCoverageStatus.VERIFIED;
            }

            // If already VERIFIED, maintain status
            if (current == ConceptCoverageStatus.VERIFIED)
            {
                return ConceptCoverageStatus.VERIFIED;
            }

            // 3. STRONG
            // Candidate demonstrated practical experience, depth >= 2 with correct understanding
            if (isCorrect && (showsPracticalExperience || depth >= 2 || isVerifiedFact))
            {
                return ConceptCoverageStatus.STRONG;
            }

            // If already STRONG, maintain status (no downgrade to partial or introduced)
            if (current == ConceptCoverageStatus.STRONG)
            {
                return ConceptCoverageStatus.STRONG;
            }

            // 4. PARTIAL
            // Candidate understood concept correctly, but without full practical depth or depth == 1
            if (isCorrect)
            {
                return ConceptCoverageStatus.PARTIAL;
            }

            // If already PARTIAL, maintain status
            if (current == ConceptCoverageStatus.PARTIAL)
            {
                return ConceptCoverageStatus.PARTIAL;
            }

            // 5. INTRODUCED
            // Mentioned concept or unverified claim, but no depth or verification yet
            if (current == ConceptCoverageStatus.NOT_TESTED)
            {
                return ConceptCoverageStatus.INTRODUCED;
            }

            return current;
        }

        private static bool IsConceptMatch(BlueprintConcept blueprintConcept, IEnumerable<string>? conceptNames)
        {
            if (conceptNames == null) return false;

            var id = blueprintConcept.Id;
            var name = blueprintConcept.Name;

            foreach (var item in conceptNames)
            {
                if (string.IsNullOrWhiteSpace(item)) continue;

                var candidate = item.Trim();

                // 1. Exact match on ID or Name
                if (candidate.Equals(id, StringComparison.OrdinalIgnoreCase) ||
                    candidate.Equals(name, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                // 2. Normalized slug match (e.g. "java-core" vs "java_core" vs "java core")
                var normCandidate = Regex.Replace(candidate.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
                var normId = Regex.Replace(id.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
                var normName = Regex.Replace(name.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');

                if (normCandidate == normId || (!string.IsNullOrEmpty(normName) && normCandidate == normName))
                {
                    return true;
                }

                // 3. Word boundary / token match: Candidate contains Concept Name as distinct token(s)
                // (e.g. Concept Name "Java" matches candidate "Java Core", "Spring Boot" matches "Spring Boot 3",
                // but avoids "Java" matching "JavaScript", "SQL" matching "MySQL", or "Spring" matching "Spring Boot")
                if (name.Length >= 2 && Regex.IsMatch(candidate, $@"(^|[\s\-_]){Regex.Escape(name)}([\s\-_]|$)", RegexOptions.IgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }
    }
}
