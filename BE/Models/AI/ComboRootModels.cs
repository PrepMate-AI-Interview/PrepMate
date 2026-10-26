using System;
using System.Collections.Generic;

namespace backend.Models.AI
{
    /// <summary>
    /// Represents an individual upstream API member within the Combo Root fallback chain.
    /// Priority order: Slot 1 -> Slot 2 -> Slot 3 -> Slot 4.
    /// </summary>
    public class ComboRootSlot
    {
        public int SlotIndex { get; set; } // 1, 2, 3, 4

        public string Id { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public string ProviderConnectionId { get; set; } = string.Empty;

        public string BaseUrl { get; set; } = string.Empty;

        public string Protocol { get; set; } = "openai-chat-completions";

        public string UpstreamModelId { get; set; } = string.Empty;

        public string CredentialSlotId { get; set; } = string.Empty;

        /// <summary>
        /// Protected ciphertext at rest, never leaked in DTOs or logs.
        /// </summary>
        public string StoredApiKey { get; set; } = string.Empty;

        public string CredentialMode { get; set; } = "auto";

        public bool Enabled { get; set; } = true;

        public int TimeoutSeconds { get; set; } = 30;

        public int MaxRetries { get; set; } = 1;

        public string HealthState { get; set; } = "UNTESTED"; // UNTESTED, HEALTHY, UNHEALTHY, DEGRADED

        public DateTime? LastCheckedAt { get; set; } = null;

        public string? LastError { get; set; } = null;

        public int? LastStatusCode { get; set; } = null;

        public long? LastLatencyMs { get; set; } = null;
    }

    /// <summary>
    /// Master Combo Root configuration mapping model alias 'PrepMate' to a 4-API fallback sequence.
    /// </summary>
    public class ComboRootConfiguration
    {
        public const string CanonicalAlias = "PrepMate";

        public string Alias { get; set; } = CanonicalAlias;

        public bool Enabled { get; set; } = true;

        public List<ComboRootSlot> Slots { get; set; } = new();

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class ComboRootSlotDto
    {
        public int SlotIndex { get; set; }

        public string Id { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public string ProviderConnectionId { get; set; } = string.Empty;

        public string BaseUrl { get; set; } = string.Empty;

        public string Protocol { get; set; } = "openai-chat-completions";

        public string UpstreamModelId { get; set; } = string.Empty;

        public string CredentialMode { get; set; } = "auto";

        public bool ApiKeyConfigured { get; set; }

        public string CredentialSource { get; set; } = "none";

        public bool Enabled { get; set; }

        public int TimeoutSeconds { get; set; }

        public string HealthState { get; set; } = "UNTESTED";

        public DateTime? LastCheckedAt { get; set; }

        public string? LastError { get; set; }

        public int? LastStatusCode { get; set; }

        public long? LastLatencyMs { get; set; }
    }

    public class UpdateComboRootSlotRequest
    {
        public string? Name { get; set; }

        public string? BaseUrl { get; set; }

        public string? Protocol { get; set; }

        public string? UpstreamModelId { get; set; }

        public string? ApiKey { get; set; }

        public bool ClearApiKey { get; set; } = false;

        public string? CredentialMode { get; set; }

        public bool? Enabled { get; set; }

        public int? TimeoutSeconds { get; set; }
    }
}
