using System;
using System.Collections.Generic;
using System.Linq;

namespace backend.Models.AI
{
    /// <summary>
    /// Distinguishes what the candidate actually stated from what the AI inferred.
    /// Tracks verified facts, claims needing validation, gaps, and contradictions across turns.
    /// </summary>
    public class CompetencyEvidence
    {
        public string CompetencyName { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        /// <summary>
        /// Explicit facts, concrete details, or quotes confirmed by candidate statements.
        /// </summary>
        public List<string> ConfirmedFacts { get; set; } = new();

        /// <summary>
        /// AI hypotheses or candidate claims that have not yet been backed by concrete examples or metrics.
        /// </summary>
        public List<string> UnverifiedClaims { get; set; } = new();

        /// <summary>
        /// Specific missing details required by the evaluation rubric (e.g. personal role, scale numbers).
        /// </summary>
        public List<string> InformationGaps { get; set; } = new();

        /// <summary>
        /// Cross-turn inconsistencies detected between different answers.
        /// </summary>
        public List<string> Contradictions { get; set; } = new();

        /// <summary>
        /// Depth score: 1 (Surface/Buzzwords) to 5 (Deep Architectural Mastery).
        /// </summary>
        public int DepthScore { get; set; } = 1;

        /// <summary>
        /// Evaluation status: "UNTESTED", "IN_PROGRESS", "SATISFACTORY", "MASTERY", "INSUFFICIENT".
        /// </summary>
        public string Status { get; set; } = "UNTESTED";

        public int QuestionCountOnTopic { get; set; } = 0;

        public bool IsSufficient =>
            ConfirmedFacts.Count >= 2 &&
            DepthScore >= 3 &&
            InformationGaps.Count == 0 &&
            Contradictions.Count == 0;
    }

    /// <summary>
    /// Complete evidence ledger maintaining an audit trail of evidence for a session.
    /// </summary>
    public class EvidenceLedger
    {
        public string SessionId { get; set; } = string.Empty;

        public Dictionary<string, CompetencyEvidence> Competencies { get; set; } = new(StringComparer.OrdinalIgnoreCase);

        public List<LedgerTurnRecord> TurnRecords { get; set; } = new();

        public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;

        public CompetencyEvidence GetOrCreateCompetency(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) name = "General";
            if (!Competencies.TryGetValue(name, out var ev))
            {
                ev = new CompetencyEvidence
                {
                    CompetencyName = name,
                    Status = "UNTESTED"
                };
                Competencies[name] = ev;
            }
            return ev;
        }

        public void RecordTurn(
            int turnNumber,
            string question,
            string answer,
            string targetCompetency,
            string action,
            List<string>? confirmed,
            List<string>? gaps,
            List<string>? unverifiedClaims = null,
            List<string>? contradictions = null)
        {
            var comp = GetOrCreateCompetency(targetCompetency);
            comp.QuestionCountOnTopic++;

            if (confirmed != null)
            {
                foreach (var c in confirmed)
                {
                    if (!string.IsNullOrWhiteSpace(c) && !comp.ConfirmedFacts.Contains(c))
                        comp.ConfirmedFacts.Add(c);
                }
            }

            if (gaps != null)
            {
                foreach (var g in gaps)
                {
                    if (!string.IsNullOrWhiteSpace(g) && !comp.InformationGaps.Contains(g))
                        comp.InformationGaps.Add(g);
                }
            }

            if (unverifiedClaims != null)
            {
                foreach (var cl in unverifiedClaims)
                {
                    if (!string.IsNullOrWhiteSpace(cl) && !comp.UnverifiedClaims.Contains(cl))
                        comp.UnverifiedClaims.Add(cl);
                }
            }

            if (contradictions != null)
            {
                foreach (var cd in contradictions)
                {
                    if (!string.IsNullOrWhiteSpace(cd) && !comp.Contradictions.Contains(cd))
                        comp.Contradictions.Add(cd);
                }
            }

            TurnRecords.Add(new LedgerTurnRecord
            {
                TurnNumber = turnNumber,
                Question = question,
                Answer = answer,
                TargetCompetency = targetCompetency,
                AdaptiveAction = action,
                ConfirmedFacts = confirmed != null ? new List<string>(confirmed) : new(),
                UnverifiedClaims = unverifiedClaims != null ? new List<string>(unverifiedClaims) : new(),
                InformationGaps = gaps != null ? new List<string>(gaps) : new(),
                Contradictions = contradictions != null ? new List<string>(contradictions) : new(),
                RecordedAt = DateTime.UtcNow
            });

            LastUpdatedAt = DateTime.UtcNow;
        }
    }

    public class LedgerTurnRecord
    {
        public int TurnNumber { get; set; }

        public string Question { get; set; } = string.Empty;

        public string Answer { get; set; } = string.Empty;

        public string TargetCompetency { get; set; } = string.Empty;

        public string AdaptiveAction { get; set; } = string.Empty;

        public List<string> ConfirmedFacts { get; set; } = new();

        public List<string> UnverifiedClaims { get; set; } = new();

        public List<string> InformationGaps { get; set; } = new();

        public List<string> Contradictions { get; set; } = new();

        public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Explicit actions chosen by the adaptive interview engine.
    /// </summary>
    public static class AdaptiveActions
    {
        public const string ProbeDeeper = "PROBE_DEEPER";
        public const string ConcreteExample = "CONCRETE_EXAMPLE";
        public const string ClarifyRole = "CLARIFY_ROLE";
        public const string QueryMetrics = "QUERY_METRICS";
        public const string TestTradeoffs = "TEST_TRADEOFFS";
        public const string CheckLimits = "CHECK_LIMITS";
        public const string NextQuestion = "NEXT_QUESTION";
        public const string ClarifyContradiction = "CLARIFY_CONTRADICTION";
        public const string WrapUp = "WRAP_UP";
    }
}
