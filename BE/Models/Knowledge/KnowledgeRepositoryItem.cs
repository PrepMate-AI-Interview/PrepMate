using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace backend.Models
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum RepositoryItemType
    {
        CONCEPT,
        EXAMPLE,
        SCENARIO,
        MISCONCEPTION,
        QUESTION_PATTERN,
        FOLLOW_UP_PATTERN,
        CHALLENGE_PATTERN
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum RepositoryItemDifficulty
    {
        BASIC,
        INTERMEDIATE,
        ADVANCED
    }

    public class KnowledgeRepositoryItem
    {
        public string Id { get; set; } = string.Empty;
        public string ConceptId { get; set; } = string.Empty;
        public string ConceptName { get; set; } = string.Empty;
        public RepositoryItemType Type { get; set; } = RepositoryItemType.QUESTION_PATTERN;
        public string Content { get; set; } = string.Empty;
        public RepositoryItemDifficulty Difficulty { get; set; } = RepositoryItemDifficulty.INTERMEDIATE;
        public List<string> Tags { get; set; } = new();
        public string Source { get; set; } = "PrepMate Curated";
        public RequirementSource SourceReliability { get; set; } = RequirementSource.OFFICIAL;
        public bool IsActive { get; set; } = true;

        // Action and level mapping for Adaptive Engine support
        public InterviewAction? AssociatedAction { get; set; }
        public string? TargetLevel { get; set; } // "Junior", "Middle", "Senior"
    }
}
