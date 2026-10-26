using System;
using System.Collections.Generic;

namespace backend.Models.AI
{
    /// <summary>
    /// Represents an individual model discovered dynamically from the upstream provider (e.g. GET /v1/models).
    /// </summary>
    public class DiscoveredModel
    {
        public string Id { get; set; } = string.Empty;

        public string DisplayName { get; set; } = string.Empty;

        public string OwnedBy { get; set; } = string.Empty;

        public long? Created { get; set; }

        public bool IsAlias { get; set; }

        public bool SupportsInference { get; set; } = true;

        public string Object { get; set; } = "model";

        public Dictionary<string, object>? RawMetadata { get; set; }
    }

    /// <summary>
    /// Internal cached catalog discovered dynamically from Vilao API.
    /// </summary>
    public class DiscoveredCatalog
    {
        public string ProviderName { get; set; } = "Vilao AI Production Gateway";

        public string BaseUrl { get; set; } = "https://api.vilao.ai/v1";

        public string SyncStatus { get; set; } = "PENDING"; // PENDING, SUCCESS, FAILED

        public DateTime? LastSyncAt { get; set; }

        public int? LastStatusCode { get; set; }

        public string? LastError { get; set; }

        public string Alias { get; set; } = "PrepMate";

        /// <summary>
        /// Status of the alias:
        /// "DISCOVERED": Explicitly announced in GET /models
        /// "UNPUBLISHED_CONFIGURED": Not listed in GET /models, but configured as gateway Combo Root alias
        /// "UNVERIFIED": Initial state before discovery
        /// "FAILED": Gateway rejected alias
        /// </summary>
        public string AliasStatus { get; set; } = "UNVERIFIED";

        public List<DiscoveredModel> Models { get; set; } = new();
    }

    public class DiscoveredCatalogDto
    {
        public string ProviderName { get; set; } = string.Empty;

        public string BaseUrl { get; set; } = string.Empty;

        public string SyncStatus { get; set; } = string.Empty;

        public string? LastSyncAt { get; set; }

        public int? LastStatusCode { get; set; }

        public string? LastError { get; set; }

        public string Alias { get; set; } = "PrepMate";

        public string AliasStatus { get; set; } = string.Empty;

        public int TotalModelsCount { get; set; }

        public bool ApiKeyConfigured { get; set; }

        public string CredentialSource { get; set; } = string.Empty;

        public List<DiscoveredModelDto> Models { get; set; } = new();
    }

    public class DiscoveredModelDto
    {
        public string Id { get; set; } = string.Empty;

        public string DisplayName { get; set; } = string.Empty;

        public string OwnedBy { get; set; } = string.Empty;

        public long? Created { get; set; }

        public bool IsAlias { get; set; }

        public bool SupportsInference { get; set; }
    }
}
