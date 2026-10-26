using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace backend.Models
{
    /// <summary>
    /// Deterministic taxonomy for relationships between observed competencies.
    /// Invariant: Diagnostic relationships only, NEVER a scoring formula or multiplier.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum CompetencyRelationshipType
    {
        UNKNOWN,
        SUPPORTING,
        CORRELATED,
        TENSION,
        DEPENDENCY,
        UNRELATED
    }

    /// <summary>
    /// Diagnostic categorization of evidence coverage for candidate competencies.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum EvidenceGapStatus
    {
        UNTESTED,
        WELL_SUPPORTED,
        PARTIALLY_SUPPORTED,
        CONTEXT_LIMITED,
        CONFLICTING
    }

    /// <summary>
    /// Traceable provenance entry linking an evidence observation to its concrete source stage, turn, and claim.
    /// Invariant: PrepMate never creates summary evidence statements without verifiable provenance.
    /// </summary>
    public class EvidenceProvenanceEntry
    {
        public string Stage { get; set; } = string.Empty;
        public int Turn { get; set; }
        public string ClaimId { get; set; } = string.Empty;
        public string Competency { get; set; } = string.Empty;
        public string Dimension { get; set; } = string.Empty;
        public EvidenceDimensionLevel EvidenceLevel { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public string SourceAnswer { get; set; } = string.Empty;
        public string? EvidenceNote { get; set; }
        public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Synthesized evidence state for a single competency within a specific interview stage.
    /// </summary>
    public class StageCompetencyEvidenceRecord
    {
        public string Stage { get; set; } = string.Empty;
        public string CompetencyName { get; set; } = string.Empty;
        public EvidenceDimensionLevel CurrentLevel { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public Dictionary<string, EvidenceDimensionLevel> Dimensions { get; set; } = new(StringComparer.OrdinalIgnoreCase);
        public List<int> SourceTurns { get; set; } = new();
        public List<string> SupportingClaimIds { get; set; } = new();
        public List<EvidenceProvenanceEntry> Provenance { get; set; } = new();
        public string SynthesisReason { get; set; } = string.Empty;
        public int LastUpdatedTurn { get; set; } = 1;
    }

    /// <summary>
    /// Synthesized cross-stage evidence for a competency across all interview stages.
    /// Invariant: Preserves stage-specific evidence levels without destructive overwrite or score collapsing.
    /// </summary>
    public class CrossStageCompetencyRecord
    {
        public string CompetencyName { get; set; } = string.Empty;
        public Dictionary<string, EvidenceDimensionLevel> StageLevels { get; set; } = new(StringComparer.OrdinalIgnoreCase);
        public EvidenceGapStatus GapStatus { get; set; } = EvidenceGapStatus.UNTESTED;
        public string SynthesisReason { get; set; } = string.Empty;
        public List<EvidenceProvenanceEntry> Provenance { get; set; } = new();
        public bool IsConsistent { get; set; } = true;
    }

    /// <summary>
    /// Represents a diagnostic relationship between two competencies.
    /// Invariant: Relationships are purely diagnostic; they NEVER act as scoring formulas or multipliers.
    /// </summary>
    public class CrossCompetencyRelationship
    {
        public string CompetencyA { get; set; } = string.Empty;
        public string CompetencyB { get; set; } = string.Empty;
        public CompetencyRelationshipType RelationshipType { get; set; } = CompetencyRelationshipType.UNKNOWN;
        public string Description { get; set; } = string.Empty;
        public bool IsObserved { get; set; } = false;
        public string? TensionNote { get; set; }
    }

    /// <summary>
    /// Diagnostic summary of evidence coverage and gaps across the entire interview session.
    /// Invariant: Diagnostic data only; does NOT mutate score calculation or preparation authority directly.
    /// </summary>
    public class EvidenceGapSummary
    {
        public List<string> WellSupported { get; set; } = new();
        public List<string> PartiallySupported { get; set; } = new();
        public List<string> Untested { get; set; } = new();
        public List<string> Conflicting { get; set; } = new();
        public List<string> ContextLimited { get; set; } = new();
        public List<string> DiagnosticNotes { get; set; } = new();
    }
}
