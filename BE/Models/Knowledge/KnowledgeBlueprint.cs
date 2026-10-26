using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace backend.Models
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum AreaImportance
    {
        HIGH,
        MEDIUM,
        LOW
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum RequirementSource
    {
        OFFICIAL,
        TRUSTED_EXTERNAL,
        CANDIDATE_REPORTED,
        INFERRED,
        UNKNOWN
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ConceptCoverageStatus
    {
        NOT_TESTED,
        INTRODUCED,
        WEAK,
        PARTIAL,
        STRONG,
        VERIFIED
    }

    public class BlueprintConcept
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public List<string> ExpectedUnderstanding { get; set; } = new();
        public List<string> PracticalSignals { get; set; } = new();
        public List<string> FailureSignals { get; set; } = new();
        public RequirementSource RequirementSource { get; set; } = RequirementSource.OFFICIAL;
        public bool IsMandatory { get; set; } = true;
        public List<string> ContextualSignals { get; set; } = new();
        public List<string> CompanyRelevance { get; set; } = new();
    }

    public class KnowledgeArea
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public AreaImportance Importance { get; set; } = AreaImportance.HIGH;
        public string RequiredLevel { get; set; } = string.Empty;
        public List<string> Competencies { get; set; } = new();
        public List<BlueprintConcept> Concepts { get; set; } = new();
    }

    public class KnowledgeBlueprint
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Position { get; set; } = string.Empty;
        public string Level { get; set; } = string.Empty;
        public string Version { get; set; } = "1.0";
        public List<KnowledgeArea> Areas { get; set; } = new();
    }
}
