using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using backend.Models;
using backend.Models.AI;

namespace backend.Services.AI
{
    public class AIRouter : IAIRouter
    {
        private readonly AIConfigurationService _configurationService;
        private readonly IAIProviderAdapter _providerAdapter;
        private readonly IModelRegistry? _modelRegistry;
        private readonly IProviderRegistry? _providerRegistry;
        private readonly INoAiModeService? _noAiModeService;
        private readonly IConfigurationVersionService? _versionService;
        private readonly IComboRootService? _comboRootService;
        private readonly IPrepMateAIClient? _prepMateAIClient;

        private readonly ConcurrentDictionary<string, CircuitBreakerState> _circuitBreakers = new(StringComparer.OrdinalIgnoreCase);

        public AIRouter(
            AIConfigurationService configurationService,
            IAIProviderAdapter providerAdapter,
            IModelRegistry? modelRegistry = null,
            IProviderRegistry? providerRegistry = null,
            INoAiModeService? noAiModeService = null,
            IConfigurationVersionService? versionService = null,
            IComboRootService? comboRootService = null,
            IPrepMateAIClient? prepMateAIClient = null)
        {
            _configurationService = configurationService ?? throw new ArgumentNullException(nameof(configurationService));
            _providerAdapter = providerAdapter ?? throw new ArgumentNullException(nameof(providerAdapter));
            _modelRegistry = modelRegistry;
            _providerRegistry = providerRegistry;
            _noAiModeService = noAiModeService;
            _versionService = versionService;
            _comboRootService = comboRootService;
            _prepMateAIClient = prepMateAIClient;
        }

        public CircuitBreakerState GetCircuitBreakerState(string routeKey)
        {
            return _circuitBreakers.GetOrAdd(routeKey, k => new CircuitBreakerState { RouteKey = k });
        }

        public SessionAiSnapshot CreateSessionSnapshot(
            string sessionId,
            string initialTaskType = AITaskType.IntroductionAnalysis)
        {
            var config = _configurationService.GetConfiguration();
            var version = _versionService?.GetVersionsForEntity("default").OrderByDescending(v => v.VersionNumber).FirstOrDefault();

            var snapshot = new SessionAiSnapshot
            {
                SessionId = sessionId,
                ConfigurationVersionId = version?.VersionId ?? "v1-combo-root",
                ProviderConnectionId = "combo-root",
                ProviderName = "Combo Root Gateway",
                BaseUrl = config.BaseUrl,
                Protocol = config.Protocol,
                PrimaryModelId = ComboRootConfiguration.CanonicalAlias, // "PrepMate"
                PrimaryUpstreamModelId = ComboRootConfiguration.CanonicalAlias,
                FallbackModelIds = new List<string> { "api-2-vilao-secondary", "api-3-openai-direct", "api-4-openrouter-backup" },
                NoAiFallbackEnabled = true,
                RoutingPolicy = "ComboRootSequentialFailover"
            };

            return snapshot;
        }

        public async Task<AIRouteExecutionResult> RouteAndExecuteAsync(
            AIRequestContext context,
            CancellationToken cancellationToken = default)
        {
            if (context == null) throw new ArgumentNullException(nameof(context));
            var stopwatch = Stopwatch.StartNew();

            // Fail-Fast: Validate client prompt input
            if (string.IsNullOrWhiteSpace(context.Prompt))
            {
                return new AIRouteExecutionResult
                {
                    Success = false,
                    StatusCode = 400,
                    ErrorCategory = "ClientValidationError",
                    ErrorMessage = "Nội dung yêu cầu (Prompt) không được để trống.",
                    CorrelationId = context.CorrelationId,
                    LatencyMs = stopwatch.ElapsedMilliseconds
                };
            }

            var config = _configurationService.GetConfiguration();

            // 1. Check if AI is disabled globally
            if (!config.Enabled)
            {
                return HandleNoAiFallback(context, "Dịch vụ AI đang tạm tắt trong cấu hình hệ thống.", stopwatch.ElapsedMilliseconds);
            }

            // 2. Determine if request routes through Combo Root (Alias "PrepMate", "default", or unspecified)
            bool isComboRoot = _comboRootService != null && (
                string.IsNullOrWhiteSpace(context.PreferredModelId) ||
                context.PreferredModelId.Equals(ComboRootConfiguration.CanonicalAlias, StringComparison.OrdinalIgnoreCase) ||
                context.PreferredModelId.Equals("default", StringComparison.OrdinalIgnoreCase) ||
                context.PreferredModelId.Equals("prepmate", StringComparison.OrdinalIgnoreCase)
            );

            if (isComboRoot && _comboRootService != null)
            {
                return await ExecuteComboRootChainAsync(context, stopwatch, cancellationToken);
            }

            // 3. Fallback to model registry or direct configuration if a specific non-alias model is requested
            return await ExecuteStandardRegistryRouteAsync(context, config, stopwatch, cancellationToken);
        }

        private async Task<AIRouteExecutionResult> ExecuteComboRootChainAsync(
            AIRequestContext context,
            Stopwatch stopwatch,
            CancellationToken cancellationToken)
        {
            var comboConfig = _comboRootService!.GetConfiguration();
            var slots = comboConfig.Slots.Where(s => s.Enabled).OrderBy(s => s.SlotIndex).ToList();

            if (slots.Count == 0)
            {
                return HandleNoAiFallback(context, "Không có API nào được kích hoạt trong Combo Root.", stopwatch.ElapsedMilliseconds);
            }

            Exception? lastException = null;
            string? lastErrorCategory = null;
            int lastStatusCode = 500;

            for (int i = 0; i < slots.Count; i++)
            {
                var slot = slots[i];
                var routeKey = $"combo-root:slot-{slot.SlotIndex}:{slot.UpstreamModelId}";
                var cb = GetCircuitBreakerState(routeKey);

                // Check Circuit Breaker
                if (cb.IsPaused && cb.PausedUntil.HasValue && cb.PausedUntil.Value > DateTime.UtcNow)
                {
                    Console.WriteLine($"[COMBO ROOT] Slot {slot.SlotIndex} ({slot.Name}) paused by circuit breaker until {cb.PausedUntil.Value:u}. Skipping to next slot...");
                    continue;
                }

                // If this is the canonical Vilao Combo Root slot (model: PrepMate), execute via unified PrepMateAIClient
                if (_prepMateAIClient != null &&
                    slot.SlotIndex == 1 &&
                    slot.UpstreamModelId.Equals(ComboRootConfiguration.CanonicalAlias, StringComparison.OrdinalIgnoreCase) &&
                    slot.BaseUrl.Contains("vilao.ai", StringComparison.OrdinalIgnoreCase))
                {
                    var clientResult = await _prepMateAIClient.ExecuteChatAsync(context, cancellationToken);
                    if (clientResult.Success)
                    {
                        cb.ConsecutiveFailures = 0;
                        cb.IsPaused = false;
                        cb.PausedUntil = null;

                        return new AIRouteExecutionResult
                        {
                            Success = true,
                            Content = clientResult.Content,
                            ModelId = ComboRootConfiguration.CanonicalAlias,
                            UpstreamModelId = slot.UpstreamModelId,
                            ProviderId = slot.Id,
                            LatencyMs = stopwatch.ElapsedMilliseconds,
                            IsFallback = false,
                            CorrelationId = context.CorrelationId,
                            StatusCode = 200
                        };
                    }

                    // Fail Fast on 400 Bad Request or 401/403 Auth errors
                    if (clientResult.StatusCode == 400 || clientResult.StatusCode == 401 || clientResult.StatusCode == 403)
                    {
                        return new AIRouteExecutionResult
                        {
                            Success = false,
                            StatusCode = clientResult.StatusCode,
                            ErrorCategory = clientResult.ErrorCategory,
                            ErrorMessage = clientResult.ErrorMessage,
                            CorrelationId = context.CorrelationId,
                            LatencyMs = stopwatch.ElapsedMilliseconds,
                            ModelId = ComboRootConfiguration.CanonicalAlias,
                            UpstreamModelId = slot.UpstreamModelId
                        };
                    }

                    lastErrorCategory = clientResult.ErrorCategory;
                    lastStatusCode = clientResult.StatusCode;
                    lastException = new InvalidOperationException(clientResult.ErrorMessage);
                    Console.WriteLine($"[COMBO ROOT] Unified PrepMate AI client failed ({lastErrorCategory}, HTTP {clientResult.StatusCode}).");
                    RecordCircuitBreakerFailure(cb, lastErrorCategory ?? "UpstreamError");

                    // In Single Gateway mode, Vilao handles upstream member model failover.
                    // If no custom mock endpoints are configured, transition directly to No-AI Mode!
                    var remainingSlots = slots.Skip(i + 1).Where(s => s.Enabled).ToList();
                    bool hasCustomMockSlots = remainingSlots.Any(s => !s.BaseUrl.Contains("vilao.ai", StringComparison.OrdinalIgnoreCase) && !s.BaseUrl.Contains("openai.com", StringComparison.OrdinalIgnoreCase) && !s.BaseUrl.Contains("openrouter.ai", StringComparison.OrdinalIgnoreCase));
                    if (!hasCustomMockSlots)
                    {
                        Console.WriteLine("[COMBO ROOT] Upstream Vilao Gateway returned error. Transitioning directly to No-AI Mode (single gateway policy)...");
                        return HandleNoAiFallback(context, clientResult.ErrorMessage ?? "Vilao AI Gateway không phản hồi.", stopwatch.ElapsedMilliseconds);
                    }
                    continue;
                }

                // Resolve slot credentials
                var cred = _comboRootService.ResolveSlotCredential(slot);
                if (string.IsNullOrWhiteSpace(cred.PlaintextKey))
                {
                    lastErrorCategory = "AuthFailure";
                    lastStatusCode = 503;
                    lastException = new InvalidOperationException($"API {slot.SlotIndex} ({slot.Name}) chưa được cấu hình API key.");
                    Console.WriteLine($"[COMBO ROOT] API {slot.SlotIndex} ({slot.Name}) missing API key. Failing over to API {slot.SlotIndex + 1}...");
                    continue;
                }

                var callConfig = new AIConfiguration
                {
                    Id = slot.Id,
                    Provider = slot.Name,
                    Protocol = slot.Protocol,
                    BaseUrl = slot.BaseUrl,
                    Model = slot.UpstreamModelId,
                    Enabled = true,
                    Temperature = context.TemperatureOverride ?? 0.7,
                    MaxTokens = context.MaxTokensOverride ?? 1000
                };

                try
                {
                    var content = await _providerAdapter.ExecuteChatCompletionAsync(
                        callConfig,
                        cred.PlaintextKey,
                        context.Prompt,
                        context.SystemInstruction,
                        cancellationToken
                    );

                    // Success: reset circuit breaker
                    cb.ConsecutiveFailures = 0;
                    cb.IsPaused = false;
                    cb.PausedUntil = null;

                    return new AIRouteExecutionResult
                    {
                        Success = true,
                        Content = content,
                        ModelId = ComboRootConfiguration.CanonicalAlias, // Always return canonical alias "PrepMate"
                        UpstreamModelId = slot.UpstreamModelId,
                        ProviderId = slot.Id,
                        LatencyMs = stopwatch.ElapsedMilliseconds,
                        IsFallback = (i > 0),
                        CorrelationId = context.CorrelationId,
                        StatusCode = 200
                    };
                }
                catch (AiGatewayException ex)
                {
                    lastException = ex;
                    lastStatusCode = ex.StatusCode;

                    // Fail Fast on 400 Bad Request if it indicates client prompt/schema error
                    if (ex.StatusCode == 400)
                    {
                        return new AIRouteExecutionResult
                        {
                            Success = false,
                            StatusCode = 400,
                            ErrorCategory = "ClientValidationError",
                            ErrorMessage = ex.Message,
                            CorrelationId = context.CorrelationId,
                            LatencyMs = stopwatch.ElapsedMilliseconds,
                            ModelId = ComboRootConfiguration.CanonicalAlias,
                            UpstreamModelId = slot.UpstreamModelId
                        };
                    }

                    lastErrorCategory = ex.StatusCode switch
                    {
                        401 or 403 => "AuthFailure",
                        503 when ex.Message.Contains("MODEL_INACTIVE") => "ModelInactive",
                        504 or 408 => "Timeout",
                        429 => "RateLimited",
                        _ => "UpstreamError"
                    };

                    Console.WriteLine($"[COMBO ROOT] API {slot.SlotIndex} ({slot.Name}) failed ({lastErrorCategory}, HTTP {ex.StatusCode}). Failing over to API {slot.SlotIndex + 1}...");
                    RecordCircuitBreakerFailure(cb, lastErrorCategory);
                }
                catch (Exception ex)
                {
                    lastException = ex;
                    lastErrorCategory = "InternalError";
                    lastStatusCode = 500;
                    Console.WriteLine($"[COMBO ROOT] API {slot.SlotIndex} ({slot.Name}) encountered unexpected error: {ex.Message}. Failing over...");
                    RecordCircuitBreakerFailure(cb, lastErrorCategory);
                }
            }

            // All 4 slots failed: transparent transition to No-AI Mode
            Console.WriteLine("[COMBO ROOT] All configured APIs in Combo Root failed. Transitioning to No-AI Mode...");
            if (_noAiModeService != null)
            {
                return HandleNoAiFallback(context, lastException?.Message ?? "Tất cả các API trong Combo Root đều không phản hồi.", stopwatch.ElapsedMilliseconds);
            }

            return new AIRouteExecutionResult
            {
                Success = false,
                StatusCode = lastStatusCode,
                ErrorCategory = lastErrorCategory ?? "UpstreamUnavailable",
                ErrorMessage = lastException?.Message ?? "Không thể kết nối tới dịch vụ AI qua Combo Root.",
                CorrelationId = context.CorrelationId,
                LatencyMs = stopwatch.ElapsedMilliseconds
            };
        }

        private async Task<AIRouteExecutionResult> ExecuteStandardRegistryRouteAsync(
            AIRequestContext context,
            AIConfiguration config,
            Stopwatch stopwatch,
            CancellationToken cancellationToken)
        {
            var resolved = _configurationService.ResolveCredential();
            if (string.IsNullOrWhiteSpace(resolved.Key))
            {
                return new AIRouteExecutionResult
                {
                    Success = false,
                    StatusCode = 503,
                    ErrorCategory = "AuthFailure",
                    ErrorMessage = "API key AI chưa được Admin cấu hình.",
                    CorrelationId = context.CorrelationId,
                    LatencyMs = stopwatch.ElapsedMilliseconds
                };
            }

            var modelCandidates = ResolveModelCandidates(context, config);
            Exception? lastException = null;
            string? lastErrorCategory = null;
            int lastStatusCode = 500;

            foreach (var candidate in modelCandidates)
            {
                var routeKey = $"{candidate.ProviderConnectionId}:{candidate.UpstreamModelId}";
                var cb = GetCircuitBreakerState(routeKey);

                if (cb.IsPaused && cb.PausedUntil.HasValue && cb.PausedUntil.Value > DateTime.UtcNow)
                {
                    continue;
                }

                var callConfig = new AIConfiguration
                {
                    Id = config.Id,
                    Provider = candidate.ProviderName,
                    Protocol = candidate.Protocol,
                    BaseUrl = candidate.BaseUrl,
                    Model = candidate.UpstreamModelId,
                    Enabled = true,
                    Temperature = context.TemperatureOverride ?? candidate.DefaultTemperature,
                    MaxTokens = context.MaxTokensOverride ?? candidate.DefaultMaxTokens
                };

                try
                {
                    var content = await _providerAdapter.ExecuteChatCompletionAsync(
                        callConfig,
                        resolved.Key,
                        context.Prompt,
                        context.SystemInstruction,
                        cancellationToken
                    );

                    cb.ConsecutiveFailures = 0;
                    cb.IsPaused = false;
                    cb.PausedUntil = null;

                    return new AIRouteExecutionResult
                    {
                        Success = true,
                        Content = content,
                        ModelId = candidate.ModelId,
                        UpstreamModelId = candidate.UpstreamModelId,
                        ProviderId = candidate.ProviderConnectionId,
                        LatencyMs = stopwatch.ElapsedMilliseconds,
                        IsFallback = candidate.IsFallback,
                        CorrelationId = context.CorrelationId,
                        StatusCode = 200
                    };
                }
                catch (AiGatewayException ex)
                {
                    lastException = ex;
                    lastStatusCode = ex.StatusCode;
                    lastErrorCategory = ex.StatusCode switch
                    {
                        401 or 403 => "AuthFailure",
                        503 when ex.Message.Contains("MODEL_INACTIVE") => "ModelInactive",
                        504 or 408 => "Timeout",
                        429 => "RateLimited",
                        _ => "UpstreamError"
                    };

                    if (lastErrorCategory == "AuthFailure")
                    {
                        return new AIRouteExecutionResult
                        {
                            Success = false,
                            StatusCode = ex.StatusCode,
                            ErrorCategory = lastErrorCategory,
                            ErrorMessage = ex.Message,
                            CorrelationId = context.CorrelationId,
                            LatencyMs = stopwatch.ElapsedMilliseconds,
                            ModelId = candidate.ModelId,
                            UpstreamModelId = candidate.UpstreamModelId
                        };
                    }

                    RecordCircuitBreakerFailure(cb, lastErrorCategory);
                }
                catch (Exception ex)
                {
                    lastException = ex;
                    lastErrorCategory = "InternalError";
                    lastStatusCode = 500;
                    RecordCircuitBreakerFailure(cb, lastErrorCategory);
                }
            }

            if (_noAiModeService != null)
            {
                return HandleNoAiFallback(context, lastException?.Message ?? "Tất cả mô hình AI đều không phản hồi.", stopwatch.ElapsedMilliseconds);
            }

            return new AIRouteExecutionResult
            {
                Success = false,
                StatusCode = lastStatusCode,
                ErrorCategory = lastErrorCategory ?? "UpstreamUnavailable",
                ErrorMessage = lastException?.Message ?? "Không thể kết nối tới dịch vụ AI.",
                CorrelationId = context.CorrelationId,
                LatencyMs = stopwatch.ElapsedMilliseconds
            };
        }

        public async Task<AIHealthStatus> ProbeHealthAsync(
            string? modelId = null,
            CancellationToken cancellationToken = default)
        {
            if (_comboRootService != null)
            {
                var slot1Dto = await _comboRootService.ProbeSlotHealthAsync(1, cancellationToken);
                var probeGeneration = _configurationService.CurrentGeneration;

                var health = new AIHealthStatus
                {
                    State = slot1Dto.HealthState,
                    CredentialSource = slot1Dto.CredentialSource,
                    IsEnvironmentManaged = slot1Dto.CredentialSource.StartsWith("environment:", StringComparison.OrdinalIgnoreCase),
                    CredentialStorageStatus = slot1Dto.ApiKeyConfigured ? "configured" : "empty",
                    LastCheckedAt = slot1Dto.LastCheckedAt,
                    Message = slot1Dto.HealthState == "HEALTHY"
                        ? $"Combo Root API 1 ({slot1Dto.UpstreamModelId}) hoạt động bình thường."
                        : (slot1Dto.LastError ?? "Lỗi kết nối tới API 1."),
                    StatusCode = slot1Dto.LastStatusCode,
                    LatencyMs = slot1Dto.LastLatencyMs,
                    ErrorCategory = slot1Dto.HealthState != "HEALTHY" ? (slot1Dto.LastStatusCode == 401 || slot1Dto.LastStatusCode == 403 ? "AuthFailure" : "UpstreamError") : null
                };

                _configurationService.RecordHealthCheckResult(probeGeneration, health);
                return health;
            }

            var pGen = _configurationService.CurrentGeneration;
            var res = _configurationService.ResolveCredential();
            var cfg = _configurationService.GetConfiguration();

            var h = await _providerAdapter.CheckHealthAsync(
                cfg,
                res.Key,
                res.Source,
                res.IsEnvironmentManaged,
                res.StorageStatus,
                pGen,
                cancellationToken
            );

            _configurationService.RecordHealthCheckResult(pGen, h);
            return h;
        }

        private void RecordCircuitBreakerFailure(CircuitBreakerState cb, string errorCategory)
        {
            cb.ConsecutiveFailures++;
            cb.LastFailureAt = DateTime.UtcNow;
            cb.LastErrorCategory = errorCategory;

            if (cb.ConsecutiveFailures >= 3)
            {
                cb.IsPaused = true;
                cb.PausedUntil = DateTime.UtcNow.AddSeconds(30);
            }
        }

        private AIRouteExecutionResult HandleNoAiFallback(AIRequestContext context, string reason, long latencyMs)
        {
            if (_noAiModeService == null)
            {
                return new AIRouteExecutionResult
                {
                    Success = false,
                    StatusCode = 503,
                    ErrorCategory = "NoAiModeUnavailable",
                    ErrorMessage = reason,
                    LatencyMs = latencyMs,
                    CorrelationId = context.CorrelationId
                };
            }

            string fallbackContent = "";
            if (context.TaskType == AITaskType.IntroductionAnalysis || context.TaskType == AITaskType.AnswerEvaluation)
            {
                var analysis = _noAiModeService.AnalyzeAnswerRuleBased("Introduction", context.Prompt, "General");
                fallbackContent = System.Text.Json.JsonSerializer.Serialize(analysis);
            }
            else
            {
                var q = _noAiModeService.GetCuratedQuestion("cntt", "Trung cấp", 0);
                fallbackContent = System.Text.Json.JsonSerializer.Serialize(new
                {
                    question = q,
                    targetCompetency = "Kỹ năng chuyên môn",
                    reason = "[No-AI Mode: Bộ câu hỏi chuẩn hóa do Combo Root kích hoạt]"
                });
            }

            return new AIRouteExecutionResult
            {
                Success = true,
                Content = fallbackContent,
                IsNoAiMode = true,
                IsFallback = true,
                ModelId = ComboRootConfiguration.CanonicalAlias, // "PrepMate"
                UpstreamModelId = "rule-based",
                ProviderId = "combo-root:no-ai-mode",
                LatencyMs = latencyMs,
                CorrelationId = context.CorrelationId,
                StatusCode = 200
            };
        }

        private List<ResolvedCandidate> ResolveModelCandidates(AIRequestContext context, AIConfiguration defaultConfig)
        {
            var list = new List<ResolvedCandidate>();

            if (!string.IsNullOrWhiteSpace(context.PreferredModelId) && _modelRegistry != null)
            {
                var m = _modelRegistry.GetModel(context.PreferredModelId);
                if (m != null && m.Enabled)
                {
                    list.Add(MapToResolvedCandidate(m, isFallback: false));
                }
            }

            if (_modelRegistry != null)
            {
                var taskModels = _modelRegistry.GetModelsByTask(context.TaskType)
                    .Where(m => m.Enabled && (!context.IsJsonMode || m.SupportsStructuredJson))
                    .ToList();

                foreach (var m in taskModels)
                {
                    if (!list.Any(c => c.ModelId == m.Id))
                    {
                        list.Add(MapToResolvedCandidate(m, isFallback: list.Count > 0));
                    }
                }
            }

            if (list.Count == 0 && !string.IsNullOrWhiteSpace(defaultConfig.Model))
            {
                list.Add(new ResolvedCandidate
                {
                    ModelId = defaultConfig.Model,
                    UpstreamModelId = defaultConfig.Model,
                    ProviderConnectionId = "default-provider",
                    ProviderName = defaultConfig.Provider,
                    BaseUrl = defaultConfig.BaseUrl,
                    Protocol = defaultConfig.Protocol,
                    DefaultTemperature = defaultConfig.Temperature,
                    DefaultMaxTokens = defaultConfig.MaxTokens,
                    SupportsStructuredJson = true,
                    IsFallback = false
                });
            }

            return list;
        }

        private ResolvedCandidate MapToResolvedCandidate(ModelRegistration model, bool isFallback)
        {
            var conn = _providerRegistry?.GetProvider(model.ProviderConnectionId);
            return new ResolvedCandidate
            {
                ModelId = model.Id,
                UpstreamModelId = model.UpstreamModelId,
                ProviderConnectionId = model.ProviderConnectionId,
                ProviderName = conn?.DisplayName ?? "Provider",
                BaseUrl = conn?.BaseUrl ?? "https://api.vilao.ai/v1/",
                Protocol = conn?.Protocol ?? "openai-chat-completions",
                DefaultTemperature = model.DefaultTemperature,
                DefaultMaxTokens = model.DefaultMaxTokens,
                SupportsStructuredJson = model.SupportsStructuredJson,
                IsFallback = isFallback
            };
        }

        private class ResolvedCandidate
        {
            public string ModelId { get; set; } = string.Empty;
            public string UpstreamModelId { get; set; } = string.Empty;
            public string ProviderConnectionId { get; set; } = string.Empty;
            public string ProviderName { get; set; } = string.Empty;
            public string BaseUrl { get; set; } = string.Empty;
            public string Protocol { get; set; } = "openai-chat-completions";
            public double DefaultTemperature { get; set; } = 0.7;
            public int DefaultMaxTokens { get; set; } = 1000;
            public bool SupportsStructuredJson { get; set; } = true;
            public bool IsFallback { get; set; }
        }
    }
}
