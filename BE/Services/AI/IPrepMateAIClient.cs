using System;
using System.Threading;
using System.Threading.Tasks;
using backend.Models.AI;

namespace backend.Services.AI
{
    /// <summary>
    /// Unified AI Client interface for PrepMate.
    /// All AI use cases (Interview Flow, CV Analysis, Job Recommendation, Career Roadmap, STAR Evaluation)
    /// communicate through this single integration point targeting the Vilao AI Gateway and logical alias "PrepMate".
    /// </summary>
    public interface IPrepMateAIClient
    {
        string GatewayBaseUrl { get; }
        string CanonicalModelAlias { get; }

        Task<AIClientExecutionResult> ExecuteChatAsync(
            AIRequestContext context,
            CancellationToken cancellationToken = default);

        Task<GatewayHealthResult> CheckGatewayHealthAsync(
            CancellationToken cancellationToken = default);
    }

    public class AIClientExecutionResult
    {
        public bool Success { get; set; }
        public string Content { get; set; } = string.Empty;
        public int StatusCode { get; set; }
        public string? ErrorMessage { get; set; }
        public string? ErrorCategory { get; set; } // "AuthFailure", "ClientValidationError", "RateLimit", "GatewayUnavailable", "Timeout", "UpstreamError"
        public string? CorrelationId { get; set; }
        public long LatencyMs { get; set; }
        public string? ResolvedModel { get; set; }
        public AIUsageTelemetry? Usage { get; set; }
        public bool IsNoAiFallback { get; set; }
    }

    public class AIUsageTelemetry
    {
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }
        public int TotalTokens { get; set; }
    }

    public class GatewayHealthResult
    {
        public bool IsHealthy { get; set; }
        public string Status { get; set; } = "UNKNOWN"; // "OPERATIONAL", "AUTH_FAILURE", "NETWORK_ERROR", "TIMEOUT", "GATEWAY_ERROR"
        public string GatewayBaseUrl { get; set; } = string.Empty;
        public string ModelAlias { get; set; } = string.Empty;
        public int HttpStatusCode { get; set; }
        public long LatencyMs { get; set; }
        public string? ErrorMessage { get; set; }
        public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
    }
}
