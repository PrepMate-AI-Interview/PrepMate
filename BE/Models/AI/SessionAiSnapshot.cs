using System;
using System.Collections.Generic;

namespace backend.Models.AI
{
    /// <summary>
    /// Immutable snapshot of AI configuration and routing state attached to an interview session.
    /// Ensures that changes made by Admin to providers or models do NOT disrupt or corrupt
    /// an in-flight interview session.
    /// Credentials and API keys must NEVER be stored in this snapshot.
    /// </summary>
    public class SessionAiSnapshot
    {
        public string SnapshotId { get; set; } = Guid.NewGuid().ToString();

        public string SessionId { get; set; } = string.Empty;

        public string ConfigurationVersionId { get; set; } = string.Empty;

        public string ProviderConnectionId { get; set; } = string.Empty;

        public string ProviderName { get; set; } = string.Empty;

        public string BaseUrl { get; set; } = string.Empty;

        public string Protocol { get; set; } = "openai-chat-completions";

        public string PrimaryModelId { get; set; } = string.Empty;

        public string PrimaryUpstreamModelId { get; set; } = string.Empty;

        public List<string> FallbackModelIds { get; set; } = new();

        public bool NoAiFallbackEnabled { get; set; } = true;

        public string RoutingPolicy { get; set; } = "TaskBasedWithFailover";

        public int MaxRetryAttempts { get; set; } = 2;

        public int TimeoutSeconds { get; set; } = 45;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
