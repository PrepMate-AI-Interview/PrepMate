using System;

namespace backend.Models
{
    public class ConfigurationVersion
    {
        public string VersionId { get; set; } = string.Empty;

        public string EntityType { get; set; } = string.Empty; // "Provider" or "Model"

        public string LogicalId { get; set; } = string.Empty;

        public int VersionNumber { get; set; } = 1;

        /// <summary>
        /// Serialized snapshot of the entity at this exact version.
        /// Preserves non-sensitive routing parameters permanently for future session immutability.
        /// </summary>
        public string SnapshotJson { get; set; } = string.Empty;

        public string CreatedBy { get; set; } = "admin";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public string ChangeSummary { get; set; } = string.Empty;
    }
}
