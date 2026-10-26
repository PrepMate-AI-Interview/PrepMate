using System;
using System.Collections.Generic;

namespace backend.Models
{
    public class ModelRegistration
    {
        public string Id { get; set; } = string.Empty;

        public string DisplayName { get; set; } = string.Empty;

        /// <summary>
        /// Foreign key referencing an existing ProviderConnection.Id.
        /// </summary>
        public string ProviderConnectionId { get; set; } = string.Empty;

        /// <summary>
        /// The exact model string sent to the upstream provider (e.g. "gpt-4o-mini", "llama-3.3-70b-versatile").
        /// </summary>
        public string UpstreamModelId { get; set; } = string.Empty;

        /// <summary>
        /// List of supported task capabilities:
        /// e.g. "IntroductionAnalysis", "TechnicalAssessment", "BehavioralStar", "SituationalCase",
        /// "CandidateQuestion", "Closing", "ReportGeneration", "CvAnalysis", "JobRecommendation", "CareerRoadmap".
        /// </summary>
        public List<string> SupportedTasks { get; set; } = new();

        public int MaxContextTokens { get; set; } = 128000;

        public int DefaultMaxTokens { get; set; } = 1000;

        public double DefaultTemperature { get; set; } = 0.7;

        public bool SupportsStructuredJson { get; set; } = true;

        public bool Enabled { get; set; } = true;

        /// <summary>
        /// Verification state: "UNTESTED", "VERIFIED", "INACTIVE".
        /// Existence in Registry does NOT imply inference succeeded or provider is reachable.
        /// An untested model must never be falsely marked as VERIFIED.
        /// </summary>
        public string VerificationStatus { get; set; } = "UNTESTED";

        public DateTime? LastVerifiedAt { get; set; } = null;

        public string? VerificationMessage { get; set; } = null;

        /// <summary>
        /// References the active immutable configuration version in ConfigurationVersions.
        /// </summary>
        public string CurrentVersionId { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
