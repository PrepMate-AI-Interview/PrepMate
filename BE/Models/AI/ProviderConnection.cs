using System;

namespace backend.Models
{
    public class ProviderConnection
    {
        public string Id { get; set; } = string.Empty;

        public string DisplayName { get; set; } = string.Empty;

        public string Protocol { get; set; } = "openai-chat-completions";

        public string BaseUrl { get; set; } = string.Empty;

        /// <summary>
        /// Logical credential slot identifier (e.g. "slot:provider-openai").
        /// Separates the credential slot from individual model registrations.
        /// </summary>
        public string CredentialSlotId { get; set; } = string.Empty;

        /// <summary>
        /// Protected API key ciphertext at rest (e.g. "dp:v1:..."), encrypted by ICredentialProtectionService.
        /// Plaintext secrets are never exposed in API responses or logs.
        /// </summary>
        public string StoredApiKey { get; set; } = string.Empty;

        /// <summary>
        /// Credential precedence mode: "auto", "environment", "admin".
        /// </summary>
        public string CredentialMode { get; set; } = "auto";

        public bool Enabled { get; set; } = true;

        public int TimeoutSeconds { get; set; } = 60;

        public int MaxRetries { get; set; } = 1;

        public int? RateLimitRpm { get; set; } = null;

        /// <summary>
        /// References the active immutable configuration version in ConfigurationVersions.
        /// </summary>
        public string CurrentVersionId { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
