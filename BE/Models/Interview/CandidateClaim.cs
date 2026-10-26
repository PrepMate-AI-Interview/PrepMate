using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace backend.Models
{
    /// <summary>
    /// Represents a specific claim made by a candidate in an answer across any industry or profession.
    /// </summary>
    public class CandidateClaim
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public int Turn { get; set; } = 1;
        public string Text { get; set; } = string.Empty;
        public CandidateClaimType ClaimType { get; set; } = CandidateClaimType.EXPERIENCE;

        // Generic Evidence Dimensions
        public EvidenceDimensionLevel Specificity { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public EvidenceDimensionLevel Ownership { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public EvidenceDimensionLevel Method { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public EvidenceDimensionLevel Evidence { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public EvidenceDimensionLevel Impact { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public EvidenceDimensionLevel Consistency { get; set; } = EvidenceDimensionLevel.STRONG;
        public EvidenceDimensionLevel Repeatability { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public EvidenceDimensionLevel RiskAwareness { get; set; } = EvidenceDimensionLevel.NOT_APPLICABLE;
        public EvidenceDimensionLevel TradeOffAwareness { get; set; } = EvidenceDimensionLevel.NOT_APPLICABLE;

        // Contextual & Invariant Flags
        public bool IsUncertain { get; set; } = false;
        public bool HasContradiction { get; set; } = false;
        public string? ContradictionDetails { get; set; }
        public bool IsContradictionResolved { get; set; } = false;

        // Granular Impact (Activity vs Output vs Outcome vs Business/User Impact)
        public string ImpactType { get; set; } = "Activity"; // Activity, Output, Outcome, BusinessUserImpact

        // Sufficiency & Overall Strength
        public EvidenceSufficiency EvidenceSufficiency { get; set; } = EvidenceSufficiency.INSUFFICIENT;
        public string EvidenceStrength { get; set; } = "Weak"; // Strong, Moderate, Weak, Insufficient

        // Adaptive Probe Budget (Hard limit of 3 enforced by C#)
        public int ProbeCount { get; set; } = 0;
        public int MaxProbes { get; set; } = 3;

        // Semantic Extraction Details
        public string? ExtractedMetric { get; set; }
        public string? ExtractedArtifact { get; set; }
        public string? CandidateOwnershipComponent { get; set; }
        public string? TeamOwnershipComponent { get; set; }
        public List<string> ExtractedSteps { get; set; } = new();
        public List<string> Claims { get; set; } = new();

        // Phase 5 Step 2: Cross-Turn Evidence Lineage & Evolution
        public string? ParentClaimId { get; set; }
        public List<string> RelatedClaimIds { get; set; } = new();
        public string? ProjectContext { get; set; }
        public string? TimeframeContext { get; set; }
        public EvidenceEvolutionType Evolution { get; set; } = EvidenceEvolutionType.UNSPECIFIED;
        public List<int> TurnHistory { get; set; } = new();
    }

    /// <summary>
    /// Detailed evidence backing an answer's claims.
    /// </summary>
    public class ClaimEvidence
    {
        public List<CandidateClaim> ExtractedClaims { get; set; } = new();
        public EvidenceDimensionLevel OverallOwnership { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public EvidenceDimensionLevel OverallMethod { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public EvidenceDimensionLevel OverallEvidence { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public EvidenceDimensionLevel OverallSpecificity { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public EvidenceDimensionLevel OverallImpact { get; set; } = EvidenceDimensionLevel.UNKNOWN;
        public string EvidenceStrength { get; set; } = "Weak";
        public bool HasContradiction { get; set; } = false;
        public bool IsUncertain { get; set; } = false;
        public string? SuggestedProbeReason { get; set; }
        public InterviewerProbePattern? RecommendedPattern { get; set; }
    }
}
