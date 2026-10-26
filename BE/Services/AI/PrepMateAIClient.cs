using System;
using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using backend.Models.AI;
using backend.Services.Security;

namespace backend.Services.AI
{
    /// <summary>
    /// Unified single AI gateway client for PrepMate.
    /// Sends requests exclusively to the Vilao AI Gateway (https://api.vilao.ai/v1/)
    /// using the canonical logical model alias "PrepMate".
    /// Combo Root upstream on Vilao handles routing across member models.
    /// PrepMate never loops through member models on the client side.
    /// </summary>
    public class PrepMateAIClient : IPrepMateAIClient
    {
        public const string DefaultGatewayBaseUrl = "https://api.vilao.ai/v1/";
        public const string CanonicalAlias = "PrepMate";

        private readonly HttpClient _httpClient;
        private readonly AIConfigurationService _configurationService;
        private readonly ICredentialProtectionService? _protectionService;

        public PrepMateAIClient(
            HttpClient httpClient,
            AIConfigurationService configurationService,
            ICredentialProtectionService? protectionService = null)
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _configurationService = configurationService ?? throw new ArgumentNullException(nameof(configurationService));
            _protectionService = protectionService;
        }

        public string GatewayBaseUrl
        {
            get
            {
                var cfg = _configurationService.GetConfiguration();
                if (!string.IsNullOrWhiteSpace(cfg.BaseUrl))
                {
                    return cfg.BaseUrl.TrimEnd('/') + "/";
                }
                return DefaultGatewayBaseUrl;
            }
        }

        public string CanonicalModelAlias => CanonicalAlias;

        public async Task<AIClientExecutionResult> ExecuteChatAsync(
            AIRequestContext context,
            CancellationToken cancellationToken = default)
        {
            if (context == null) throw new ArgumentNullException(nameof(context));
            var stopwatch = Stopwatch.StartNew();

            // 1. Fail-Fast: Client input validation
            if (string.IsNullOrWhiteSpace(context.Prompt))
            {
                return new AIClientExecutionResult
                {
                    Success = false,
                    StatusCode = 400,
                    ErrorCategory = "ClientValidationError",
                    ErrorMessage = "Nội dung yêu cầu (Prompt) không được để trống.",
                    CorrelationId = context.CorrelationId,
                    LatencyMs = stopwatch.ElapsedMilliseconds
                };
            }

            // 2. Check if AI is enabled globally
            var config = _configurationService.GetConfiguration();
            if (!config.Enabled)
            {
                return new AIClientExecutionResult
                {
                    Success = false,
                    StatusCode = 503,
                    ErrorCategory = "ServiceDisabled",
                    ErrorMessage = "Dịch vụ AI đang tạm tắt trong cấu hình hệ thống.",
                    CorrelationId = context.CorrelationId,
                    LatencyMs = stopwatch.ElapsedMilliseconds,
                    IsNoAiFallback = true
                };
            }

            // 3. Resolve Credential with strict precedence (Env vars -> Database/Admin -> appsettings)
            var resolvedKey = ResolveApiKey();
            if (string.IsNullOrWhiteSpace(resolvedKey))
            {
                return new AIClientExecutionResult
                {
                    Success = false,
                    StatusCode = 503,
                    ErrorCategory = "AuthFailure",
                    ErrorMessage = "API key AI chưa được Admin cấu hình. Vui lòng cấu hình VILAO_API_KEY hoặc lưu khóa trong trang Quản trị.",
                    CorrelationId = context.CorrelationId,
                    LatencyMs = stopwatch.ElapsedMilliseconds,
                    IsNoAiFallback = true
                };
            }

            // 4. Construct request payload
            var requestUri = OpenAIChatCompletionsAdapter.BuildEndpointUri(GatewayBaseUrl);
            var payload = new
            {
                model = CanonicalAlias,
                messages = BuildMessages(context),
                temperature = context.TemperatureOverride ?? config.Temperature,
                max_tokens = context.MaxTokensOverride ?? config.MaxTokens,
                response_format = context.IsJsonMode ? new { type = "json_object" } : null
            };

            var jsonBody = JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            });

            // 5. Send with bounded retry (max 1 retry for transient 502/503/504)
            int maxAttempts = 2;
            Exception? lastEx = null;
            HttpResponseMessage? response = null;
            string responseBody = string.Empty;

            for (int attempt = 1; attempt <= maxAttempts; attempt++)
            {
                try
                {
                    using var request = new HttpRequestMessage(HttpMethod.Post, requestUri);
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", resolvedKey);
                    request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                    request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

                    response = await _httpClient.SendAsync(request, cancellationToken);
                    responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

                    if (response.IsSuccessStatusCode)
                    {
                        var content = ExtractContent(responseBody);
                        return new AIClientExecutionResult
                        {
                            Success = true,
                            Content = content,
                            StatusCode = (int)response.StatusCode,
                            ResolvedModel = CanonicalAlias,
                            LatencyMs = stopwatch.ElapsedMilliseconds,
                            CorrelationId = context.CorrelationId
                        };
                    }

                    int status = (int)response.StatusCode;
                    // Fail fast without retry for client errors or auth errors
                    if (status == 400 || status == 401 || status == 403)
                    {
                        var (errCat, errMsg, _) = OpenAIChatCompletionsAdapter.CategorizeError(status, responseBody, CanonicalAlias);
                        return new AIClientExecutionResult
                        {
                            Success = false,
                            StatusCode = status,
                            ErrorCategory = errCat,
                            ErrorMessage = errMsg,
                            LatencyMs = stopwatch.ElapsedMilliseconds,
                            CorrelationId = context.CorrelationId,
                            ResolvedModel = CanonicalAlias
                        };
                    }

                    // Transient 502/503/504: allow 1 retry
                    if (attempt < maxAttempts && (status == 502 || status == 503 || status == 504 || status == 429))
                    {
                        await Task.Delay(500, cancellationToken);
                        continue;
                    }

                    var (cat, msg, _) = OpenAIChatCompletionsAdapter.CategorizeError(status, responseBody, CanonicalAlias);
                    return new AIClientExecutionResult
                    {
                        Success = false,
                        StatusCode = status,
                        ErrorCategory = cat,
                        ErrorMessage = msg,
                        LatencyMs = stopwatch.ElapsedMilliseconds,
                        CorrelationId = context.CorrelationId,
                        ResolvedModel = CanonicalAlias
                    };
                }
                catch (HttpRequestException ex)
                {
                    lastEx = ex;
                    if (attempt < maxAttempts)
                    {
                        await Task.Delay(500, cancellationToken);
                        continue;
                    }
                }
                catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
                {
                    lastEx = ex;
                    return new AIClientExecutionResult
                    {
                        Success = false,
                        StatusCode = 504,
                        ErrorCategory = "Timeout",
                        ErrorMessage = "Yêu cầu tới AI Gateway đã vượt quá thời gian chờ (Timeout).",
                        LatencyMs = stopwatch.ElapsedMilliseconds,
                        CorrelationId = context.CorrelationId,
                        ResolvedModel = CanonicalAlias
                    };
                }
            }

            return new AIClientExecutionResult
            {
                Success = false,
                StatusCode = 502,
                ErrorCategory = "GatewayUnavailable",
                ErrorMessage = lastEx != null ? $"Không thể kết nối tới AI Gateway: {lastEx.Message}" : "AI Gateway không phản hồi.",
                LatencyMs = stopwatch.ElapsedMilliseconds,
                CorrelationId = context.CorrelationId,
                ResolvedModel = CanonicalAlias
            };
        }

        public async Task<GatewayHealthResult> CheckGatewayHealthAsync(
            CancellationToken cancellationToken = default)
        {
            var sw = Stopwatch.StartNew();
            var result = new GatewayHealthResult
            {
                GatewayBaseUrl = GatewayBaseUrl,
                ModelAlias = CanonicalAlias
            };

            var apiKey = ResolveApiKey();
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                result.IsHealthy = false;
                result.Status = "AUTH_FAILURE";
                result.HttpStatusCode = 503;
                result.ErrorMessage = "API key chưa được cấu hình. Vui lòng thiết lập VILAO_API_KEY hoặc lưu key trong trang Admin.";
                result.LatencyMs = sw.ElapsedMilliseconds;
                return result;
            }

            var requestUri = OpenAIChatCompletionsAdapter.BuildEndpointUri(GatewayBaseUrl);
            var probePayload = new
            {
                model = CanonicalAlias,
                messages = new[] { new { role = "user", content = "ping" } },
                max_tokens = 5,
                temperature = 0.1
            };

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, requestUri);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
                request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                request.Content = new StringContent(JsonSerializer.Serialize(probePayload), Encoding.UTF8, "application/json");

                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(TimeSpan.FromSeconds(10));

                var response = await _httpClient.SendAsync(request, cts.Token);
                var body = await response.Content.ReadAsStringAsync(cts.Token);
                result.HttpStatusCode = (int)response.StatusCode;
                result.LatencyMs = sw.ElapsedMilliseconds;

                if (response.IsSuccessStatusCode)
                {
                    result.IsHealthy = true;
                    result.Status = "OPERATIONAL";
                    result.ErrorMessage = null;
                }
                else if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
                         response.StatusCode == System.Net.HttpStatusCode.Forbidden)
                {
                    result.IsHealthy = false;
                    result.Status = "AUTH_FAILURE";
                    result.ErrorMessage = $"Xác thực API key thất bại (HTTP {result.HttpStatusCode}). Vui lòng kiểm tra lại key.";
                }
                else if ((int)response.StatusCode == 429)
                {
                    result.IsHealthy = false;
                    result.Status = "RATE_LIMITED";
                    result.ErrorMessage = "AI Gateway đang bị giới hạn tần suất (Rate limit 429).";
                }
                else
                {
                    result.IsHealthy = false;
                    result.Status = "GATEWAY_ERROR";
                    result.ErrorMessage = $"AI Gateway phản hồi lỗi HTTP {result.HttpStatusCode}.";
                }
            }
            catch (TaskCanceledException)
            {
                result.IsHealthy = false;
                result.Status = "TIMEOUT";
                result.HttpStatusCode = 504;
                result.ErrorMessage = "Kiểm tra kết nối tới AI Gateway quá thời gian chờ (10s timeout).";
                result.LatencyMs = sw.ElapsedMilliseconds;
            }
            catch (Exception ex)
            {
                result.IsHealthy = false;
                result.Status = "NETWORK_ERROR";
                result.HttpStatusCode = 502;
                result.ErrorMessage = $"Lỗi kết nối mạng tới AI Gateway: {ex.Message}";
                result.LatencyMs = sw.ElapsedMilliseconds;
            }

            return result;
        }

        private string ResolveApiKey()
        {
            // Precedence 1: Environment variable PREPMATE_AI_API_KEY
            var envPrepmate = Environment.GetEnvironmentVariable("PREPMATE_AI_API_KEY");
            if (!string.IsNullOrWhiteSpace(envPrepmate)) return envPrepmate.Trim();

            // Precedence 2: Environment variable VILAO_API_KEY
            var envVilao = Environment.GetEnvironmentVariable("VILAO_API_KEY");
            if (!string.IsNullOrWhiteSpace(envVilao)) return envVilao.Trim();

            // Precedence 3: AIConfigurationService resolved key (includes database and protected key)
            var configResolved = _configurationService.ResolveCredential();
            if (!string.IsNullOrWhiteSpace(configResolved.Key)) return configResolved.Key.Trim();

            // Precedence 4: Environment variable GEMINI_API_KEY (backward compatibility fallback)
            var envGemini = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
            if (!string.IsNullOrWhiteSpace(envGemini)) return envGemini.Trim();

            return string.Empty;
        }

        private static object[] BuildMessages(AIRequestContext context)
        {
            var list = new System.Collections.Generic.List<object>();

            if (!string.IsNullOrWhiteSpace(context.SystemInstruction))
            {
                list.Add(new { role = "system", content = context.SystemInstruction });
            }

            list.Add(new { role = "user", content = context.Prompt });
            return list.ToArray();
        }

        private static string ExtractContent(string jsonResponse)
        {
            try
            {
                using var doc = JsonDocument.Parse(jsonResponse);
                var root = doc.RootElement;
                if (root.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
                {
                    var first = choices[0];
                    if (first.TryGetProperty("message", out var msg) && msg.TryGetProperty("content", out var content))
                    {
                        var text = content.GetString() ?? string.Empty;
                        text = text.Trim();
                        if (text.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
                        {
                            text = text[7..].Trim();
                        }
                        else if (text.StartsWith("```"))
                        {
                            text = text[3..].Trim();
                        }
                        if (text.EndsWith("```"))
                        {
                            text = text[..^3].Trim();
                        }
                        return text;
                    }
                }
            }
            catch
            {
                // Return raw response if not standard json choices
            }
            return jsonResponse;
        }
    }
}
