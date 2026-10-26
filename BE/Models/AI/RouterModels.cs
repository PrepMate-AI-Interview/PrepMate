using System;
using System.Collections.Generic;

namespace backend.Models.AI
{
    public class AIRequestContext
    {
        public string TaskType { get; set; } = AITaskType.IntroductionAnalysis;

        public string Prompt { get; set; } = string.Empty;

        public string SystemInstruction { get; set; } = string.Empty;

        public bool IsJsonMode { get; set; } = false;

        public string? SessionId { get; set; } = null;

        public string CorrelationId { get; set; } = Guid.NewGuid().ToString("N");

        public string? PreferredModelId { get; set; } = ComboRootConfiguration.CanonicalAlias;

        public int TimeoutSeconds { get; set; } = 45;

        public double? TemperatureOverride { get; set; } = null;

        public int? MaxTokensOverride { get; set; } = null;
    }

    public class AIRouteExecutionResult
    {
        public bool Success { get; set; }

        public string Content { get; set; } = string.Empty;

        public string ModelId { get; set; } = string.Empty;

        public string UpstreamModelId { get; set; } = string.Empty;

        public string ProviderId { get; set; } = string.Empty;

        public long LatencyMs { get; set; }

        public int TokensUsed { get; set; }

        public bool IsFallback { get; set; }

        public bool IsNoAiMode { get; set; }

        public string CorrelationId { get; set; } = string.Empty;

        public string? ErrorCategory { get; set; }

        public string? ErrorMessage { get; set; }

        public int StatusCode { get; set; } = 200;
    }

    public class CircuitBreakerState
    {
        public string RouteKey { get; set; } = string.Empty;

        public int ConsecutiveFailures { get; set; }

        public bool IsPaused { get; set; }

        public DateTime? PausedUntil { get; set; }

        public string? LastErrorCategory { get; set; }

        public DateTime? LastFailureAt { get; set; }
    }
}
