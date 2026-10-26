using System;
using System.Collections.Generic;

namespace backend.Models
{
    // =========================================================================
    // PROVIDER CONNECTION DTOS
    // =========================================================================

    public class ProviderConnectionDto
    {
        public string Id { get; set; } = string.Empty;

        public string DisplayName { get; set; } = string.Empty;

        public string Protocol { get; set; } = string.Empty;

        public string BaseUrl { get; set; } = string.Empty;

        public string CredentialSlotId { get; set; } = string.Empty;

        public string CredentialMode { get; set; } = "auto";

        public bool ApiKeyConfigured { get; set; }

        public string CredentialStorageStatus { get; set; } = "empty"; // "encrypted", "legacy_plaintext", "empty"

        public string CredentialSource { get; set; } = "none";

        public bool IsEnvironmentManaged { get; set; }

        public bool Enabled { get; set; } = true;

        public int TimeoutSeconds { get; set; } = 60;

        public int MaxRetries { get; set; } = 1;

        public int? RateLimitRpm { get; set; }

        public string CurrentVersionId { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public int RegisteredModelsCount { get; set; }
    }

    public class CreateProviderConnectionRequest
    {
        public string Id { get; set; } = string.Empty;

        public string DisplayName { get; set; } = string.Empty;

        public string Protocol { get; set; } = "openai-chat-completions";

        public string BaseUrl { get; set; } = string.Empty;

        public string? ApiKey { get; set; }

        public string CredentialMode { get; set; } = "auto";

        public bool Enabled { get; set; } = true;

        public int TimeoutSeconds { get; set; } = 60;

        public int MaxRetries { get; set; } = 1;

        public int? RateLimitRpm { get; set; }
    }

    public class UpdateProviderConnectionRequest
    {
        public string DisplayName { get; set; } = string.Empty;

        public string Protocol { get; set; } = "openai-chat-completions";

        public string BaseUrl { get; set; } = string.Empty;

        public string? ApiKey { get; set; }

        public bool ClearApiKey { get; set; } = false;

        public string CredentialMode { get; set; } = "auto";

        public bool Enabled { get; set; } = true;

        public int TimeoutSeconds { get; set; } = 60;

        public int MaxRetries { get; set; } = 1;

        public int? RateLimitRpm { get; set; }
    }

    // =========================================================================
    // MODEL REGISTRATION DTOS
    // =========================================================================

    public class ModelRegistrationDto
    {
        public string Id { get; set; } = string.Empty;

        public string DisplayName { get; set; } = string.Empty;

        public string ProviderConnectionId { get; set; } = string.Empty;

        public string ProviderDisplayName { get; set; } = string.Empty;

        public string UpstreamModelId { get; set; } = string.Empty;

        public List<string> SupportedTasks { get; set; } = new();

        public int MaxContextTokens { get; set; } = 128000;

        public int DefaultMaxTokens { get; set; } = 1000;

        public double DefaultTemperature { get; set; } = 0.7;

        public bool SupportsStructuredJson { get; set; } = true;

        public bool Enabled { get; set; } = true;

        public string VerificationStatus { get; set; } = "UNTESTED";

        public DateTime? LastVerifiedAt { get; set; }

        public string? VerificationMessage { get; set; }

        public string CurrentVersionId { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }
    }

    public class CreateModelRegistrationRequest
    {
        public string Id { get; set; } = string.Empty;

        public string DisplayName { get; set; } = string.Empty;

        public string ProviderConnectionId { get; set; } = string.Empty;

        public string UpstreamModelId { get; set; } = string.Empty;

        public List<string>? SupportedTasks { get; set; }

        public int MaxContextTokens { get; set; } = 128000;

        public int DefaultMaxTokens { get; set; } = 1000;

        public double DefaultTemperature { get; set; } = 0.7;

        public bool SupportsStructuredJson { get; set; } = true;

        public bool Enabled { get; set; } = true;
    }

    public class UpdateModelRegistrationRequest
    {
        public string DisplayName { get; set; } = string.Empty;

        public string ProviderConnectionId { get; set; } = string.Empty;

        public string UpstreamModelId { get; set; } = string.Empty;

        public List<string>? SupportedTasks { get; set; }

        public int MaxContextTokens { get; set; } = 128000;

        public int DefaultMaxTokens { get; set; } = 1000;

        public double DefaultTemperature { get; set; } = 0.7;

        public bool SupportsStructuredJson { get; set; } = true;

        public bool Enabled { get; set; } = true;
    }

    // =========================================================================
    // CONFIGURATION VERSION DTO
    // =========================================================================

    public class ConfigurationVersionDto
    {
        public string VersionId { get; set; } = string.Empty;

        public string EntityType { get; set; } = string.Empty;

        public string LogicalId { get; set; } = string.Empty;

        public int VersionNumber { get; set; }

        public string CreatedBy { get; set; } = "admin";

        public DateTime CreatedAt { get; set; }

        public string ChangeSummary { get; set; } = string.Empty;
    }
}
