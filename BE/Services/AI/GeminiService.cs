using System;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using backend.Models;
using backend.Models.AI;
using backend.Services.AI;

namespace backend.Services
{
    /// <summary>
    /// Legacy AI facade preserved for backward compatibility across existing business services.
    /// Delegates directly to the IAIRouter for dynamic task routing, capability validation, and failover.
    /// </summary>
    public class GeminiService
    {
        private readonly HttpClient _httpClient;
        private readonly AIConfigurationService _configurationService;
        private readonly IAIProviderAdapter _providerAdapter;
        private readonly IAIRouter? _router;

        public GeminiService(
            HttpClient httpClient,
            AIConfigurationService configurationService,
            IAIProviderAdapter? providerAdapter = null,
            IAIRouter? router = null)
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _configurationService = configurationService ?? throw new ArgumentNullException(nameof(configurationService));
            _providerAdapter = providerAdapter ?? new OpenAIChatCompletionsAdapter(_httpClient);
            _router = router;
        }

        public virtual async Task<string> CallGeminiApiAsync(
            string prompt,
            string systemInstruction = "",
            bool isJsonMode = false)
        {
            return await CallGeminiApiForTaskAsync(
                AITaskType.IntroductionAnalysis,
                prompt,
                systemInstruction,
                isJsonMode
            );
        }

        public virtual async Task<string> CallGeminiApiForTaskAsync(
            string taskType,
            string prompt,
            string systemInstruction = "",
            bool isJsonMode = false,
            string? sessionId = null,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(prompt))
            {
                throw new ArgumentException("Prompt không được để trống.", nameof(prompt));
            }

            // Route through dynamic IAIRouter when available
            if (_router != null)
            {
                var reqContext = new AIRequestContext
                {
                    TaskType = taskType,
                    PreferredModelId = ComboRootConfiguration.CanonicalAlias, // Canonical model alias "PrepMate"
                    Prompt = prompt,
                    SystemInstruction = systemInstruction,
                    IsJsonMode = isJsonMode,
                    SessionId = sessionId
                };

                var result = await _router.RouteAndExecuteAsync(reqContext, cancellationToken);
                if (!result.Success)
                {
                    throw new AiGatewayException(
                        result.StatusCode,
                        result.ErrorMessage ?? "Dịch vụ AI phản hồi không thành công.",
                        result.ErrorCategory ?? "UpstreamError"
                    );
                }

                return result.Content;
            }

            // Fallback direct adapter execution
            var configuration = _configurationService.GetConfiguration();
            if (!configuration.Enabled)
            {
                throw new AiGatewayException(
                    503,
                    "Dịch vụ AI đang tạm tắt trong cấu hình hệ thống.",
                    "AI is disabled in admin configuration."
                );
            }

            var resolved = _configurationService.ResolveCredential();
            if (string.IsNullOrWhiteSpace(resolved.Key))
            {
                throw new AiGatewayException(
                    503,
                    "API key AI chưa được Admin cấu hình.",
                    "AI API key is missing."
                );
            }

            if (string.IsNullOrWhiteSpace(configuration.BaseUrl))
            {
                throw new AiGatewayException(
                    503,
                    "Base URL AI chưa được cấu hình.",
                    "AI BaseUrl is missing."
                );
            }

            if (string.IsNullOrWhiteSpace(configuration.Model))
            {
                throw new AiGatewayException(
                    503,
                    "Model AI chưa được cấu hình.",
                    "AI Model is missing."
                );
            }

            return await _providerAdapter.ExecuteChatCompletionAsync(
                configuration,
                resolved.Key,
                prompt,
                systemInstruction,
                cancellationToken
            );
        }

        /// <summary>
        /// Probes the upstream AI provider with a lightweight prompt to truthfully verify connectivity.
        /// Does NOT send any candidate, CV, or interview data.
        /// </summary>
        public virtual async Task<AIHealthStatus> CheckHealthAsync(CancellationToken cancellationToken = default)
        {
            if (_router != null)
            {
                return await _router.ProbeHealthAsync(null, cancellationToken);
            }

            var probeGeneration = _configurationService.CurrentGeneration;
            var resolved = _configurationService.ResolveCredential();
            var config = _configurationService.GetConfiguration();

            var health = await _providerAdapter.CheckHealthAsync(
                config,
                resolved.Key,
                resolved.Source,
                resolved.IsEnvironmentManaged,
                resolved.StorageStatus,
                probeGeneration,
                cancellationToken
            );

            bool recorded = _configurationService.RecordHealthCheckResult(probeGeneration, health);
            if (!recorded)
            {
                return _configurationService.GetHealthStatus();
            }

            return health;
        }
    }
}
