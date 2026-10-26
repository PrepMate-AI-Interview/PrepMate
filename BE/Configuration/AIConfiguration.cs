namespace backend.Models
{
    public class AIConfiguration
    {
        public string Id { get; set; } = "default";

        public string Provider { get; set; } = "OpenAI-Compatible";

        public string Protocol { get; set; } = "openai-chat-completions";

        public string BaseUrl { get; set; } = string.Empty;

        public string ApiKey { get; set; } = string.Empty;

        public string Model { get; set; } = string.Empty;

        public bool Enabled { get; set; } = true;

        public double Temperature { get; set; } = 0.7;

        public int MaxTokens { get; set; } = 1000;

        /// <summary>
        /// Credential precedence mode:
        /// "auto" (default): Environment variable if present, otherwise database/Admin-managed.
        /// "environment": Strictly use environment variables (PREPMATE_AI_API_KEY, VILAO_API_KEY, GEMINI_API_KEY).
        /// "admin": Strictly use database/Admin-managed key protected at rest.
        /// </summary>
        public string CredentialMode { get; set; } = "auto";
    }

    public class AIHealthStatus
    {
        public string State { get; set; } = string.Empty;

        public string CredentialSource { get; set; } = string.Empty;

        public bool IsEnvironmentManaged { get; set; }

        public string CredentialStorageStatus { get; set; } = "empty";

        public DateTime? LastCheckedAt { get; set; }

        public string Message { get; set; } = string.Empty;

        public int? StatusCode { get; set; }

        public long? LatencyMs { get; set; }

        public string? ErrorCategory { get; set; }

        public string? DiagnosticDetails { get; set; }
    }
}