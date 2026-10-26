using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace backend.Models
{
    /// <summary>
    /// Represents the trajectory of evidence across multiple interview turns for a dimension or competency.
    /// Invariant: REGRESSION preserves uncertainty and NEVER implies a lie or character accusation.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum EvidenceEvolutionType
    {
        UNSPECIFIED,
        IMPROVEMENT, // UNKNOWN -> MODERATE, MODERATE -> STRONG, WEAK -> STRONG
        STABLE,      // STRONG -> STRONG, MODERATE -> MODERATE, UNKNOWN -> UNKNOWN
        REGRESSION   // STRONG -> WEAK, MODERATE -> WEAK (Context change, harder probe, boundary discovery)
    }

    /// <summary>
    /// A single chronological evidence observation on a specific dimension across turns.
    /// </summary>
    public class DimensionEvidenceEntry
    {
        public int Turn { get; set; }
        public string ClaimId { get; set; } = string.Empty;
        public string Dimension { get; set; } = string.Empty;
        public EvidenceDimensionLevel Level { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public string? EvidenceNote { get; set; }
        public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Synthesized diagnostic state of evidence for a single competency across all interview turns.
    /// Invariant: Competency evidence is purely diagnostic for interviewer intelligence, NEVER a scoring authority.
    /// </summary>
    public class CompetencyEvidenceRecord
    {
        public string CompetencyName { get; set; } = string.Empty;
        public EvidenceDimensionLevel CurrentLevel { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public EvidenceDimensionLevel PreviousLevel { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public EvidenceEvolutionType Evolution { get; set; } = EvidenceEvolutionType.UNSPECIFIED;
        public List<int> SourceTurns { get; set; } = new();
        public List<string> SupportingClaimIds { get; set; } = new();
        public List<DimensionEvidenceEntry> DimensionHistory { get; set; } = new();
        public List<EvidenceGap> OpenGaps { get; set; } = new();
        public int ContradictionCount { get; set; } = 0;
        public bool IsSufficient { get; set; } = false;
        public int LastUpdatedTurn { get; set; } = 1;
        public string SynthesisReason { get; set; } = string.Empty;
    }
}
