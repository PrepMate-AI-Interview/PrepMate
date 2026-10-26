using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using backend.Models;

namespace backend.Services.AI
{
    public class OpenAIChatCompletionsAdapter : IAIProviderAdapter
    {
        public const string ProtocolName = "openai-chat-completions";
        private readonly HttpClient _httpClient;

        public OpenAIChatCompletionsAdapter(HttpClient httpClient)
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        }

        public string Protocol => ProtocolName;

        public static bool IsLoopbackOrLocalhost(Uri uri)
        {
            if (uri.IsLoopback)
            {
                return true;
            }
            var host = uri.Host.ToLowerInvariant();
            return host == "localhost" || host == "127.0.0.1" || host == "::1";
        }

        public static Uri BuildEndpointUri(string rawBaseUrl)
        {
            if (string.IsNullOrWhiteSpace(rawBaseUrl))
            {
                throw new AiGatewayException(503, "Base URL AI chưa được cấu hình.", "AI BaseUrl is missing.");
            }

            if (!Uri.TryCreate(rawBaseUrl.Trim(), UriKind.Absolute, out var baseUri))
            {
                throw new AiGatewayException(400, "Base URL AI không hợp lệ.", $"Invalid BaseUrl format: {rawBaseUrl}");
            }

            if (baseUri.Scheme != Uri.UriSchemeHttp && baseUri.Scheme != Uri.UriSchemeHttps)
            {
                throw new AiGatewayException(400, "Base URL phải sử dụng giao thức HTTP hoặc HTTPS.", $"Unsupported scheme: {baseUri.Scheme}");
            }

            if (baseUri.Scheme == Uri.UriSchemeHttp && !IsLoopbackOrLocalhost(baseUri))
            {
                throw new AiGatewayException(
                    400,
                    "Giao thức HTTP không được phép cho endpoint máy chủ từ xa vì lý do bảo mật. Vui lòng sử dụng HTTPS.",
                    "Insecure HTTP prohibited for remote upstream AI endpoints."
                );
            }

            var normalizedBase = rawBaseUrl.TrimEnd('/') + "/";
            return new Uri(new Uri(normalizedBase), "chat/completions");
        }

        public static (string Category, string UserMessage, int GatewayCode) CategorizeError(int statusCode, string responseBody, string modelName)
        {
            var body = responseBody ?? string.Empty;

            if (body.Contains("MODEL_INACTIVE", StringComparison.OrdinalIgnoreCase) ||
                body.Contains("is currently inactive", StringComparison.OrdinalIgnoreCase) ||
                body.Contains("model inactive", StringComparison.OrdinalIgnoreCase))
            {
                return (
                    "ModelInactive",
                    $"Mô hình AI '{modelName}' hiện đang ở trạng thái ngừng hoạt động phía nhà cung cấp (MODEL_INACTIVE). Quản trị viên vui lòng kiểm tra portal nhà cung cấp hoặc đổi sang mô hình khác đang hoạt động.",
                    503
                );
            }

            if (statusCode == 402 ||
                body.Contains("insufficient_quota", StringComparison.OrdinalIgnoreCase) ||
                body.Contains("INSUFFICIENT_BALANCE", StringComparison.OrdinalIgnoreCase))
            {
                return (
                    "RateLimitOrQuota",
                    "Dịch vụ AI tạm thời gián đoạn do tài khoản đã hết hạn mức hoặc chưa gia hạn gói.",
                    503
                );
            }

            if (statusCode == 429)
            {
                return (
                    "RateLimitOrQuota",
                    "Hệ thống AI đang quá tải với nhiều yêu cầu cùng lúc (HTTP 429). Vui lòng đợi trong giây lát và thử lại.",
                    503
                );
            }

            if (statusCode == 401)
            {
                return (
                    "AuthFailure",
                    "Xác thực dịch vụ AI thất bại (HTTP 401). API key có thể không hợp lệ hoặc đã bị thu hồi.",
                    502
                );
            }

            if (statusCode == 403)
            {
                if (body.Contains("model", StringComparison.OrdinalIgnoreCase) ||
                    body.Contains("permission", StringComparison.OrdinalIgnoreCase))
                {
                    return (
                        "PermissionOrModelUnavailable",
                        $"API key không có quyền truy cập mô hình '{modelName}' hoặc tài nguyên này bị từ chối (HTTP 403).",
                        502
                    );
                }
                return (
                    "AuthFailure",
                    "Quyền truy cập dịch vụ AI bị từ chối (HTTP 403).",
                    502
                );
            }

            if (statusCode == 404)
            {
                return (
                    "PermissionOrModelUnavailable",
                    $"Không tìm thấy mô hình '{modelName}' hoặc đường dẫn API tại nhà cung cấp (HTTP 404).",
                    502
                );
            }

            if (statusCode == 400)
            {
                return (
                    "InvalidRequest",
                    "Yêu cầu tới dịch vụ AI không hợp lệ hoặc tham số không được mô hình hỗ trợ (HTTP 400).",
                    400
                );
            }

            if (statusCode >= 500)
            {
                int code = statusCode == 504 ? 504 : 502;
                return (
                    "ServerFailure",
                    $"Dịch vụ AI phía máy chủ upstream phản hồi lỗi (HTTP {statusCode}). Vui lòng thử lại sau.",
                    code
                );
            }

            return (
                "UpstreamError",
                $"Dịch vụ AI phản hồi mã lỗi không thành công (HTTP {statusCode}).",
                502
            );
        }

        public async Task<string> ExecuteChatCompletionAsync(
            AIConfiguration config,
            string apiKey,
            string prompt,
            string systemInstruction,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(prompt))
            {
                throw new ArgumentException("Prompt không được để trống.", nameof(prompt));
            }

            if (string.IsNullOrWhiteSpace(apiKey))
            {
                throw new AiGatewayException(503, "API key AI chưa được cấu hình.", "AI API key is missing.");
            }

            if (string.IsNullOrWhiteSpace(config.Model))
            {
                throw new AiGatewayException(503, "Model AI chưa được cấu hình.", "AI Model is missing.");
            }

            var endpoint = BuildEndpointUri(config.BaseUrl);

            var messages = new List<object>();
            if (!string.IsNullOrWhiteSpace(systemInstruction))
            {
                messages.Add(new { role = "system", content = systemInstruction });
            }
            messages.Add(new { role = "user", content = prompt });

            var payload = new
            {
                model = config.Model,
                messages = messages,
                temperature = config.Temperature,
                max_tokens = config.MaxTokens
            };

            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            };

            var jsonPayload = JsonSerializer.Serialize(payload, options);

            HttpResponseMessage response;
            string responseJson;

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
                request.Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

                response = await _httpClient.SendAsync(request, cancellationToken);
                responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
            }
            catch (TaskCanceledException ex)
            {
                throw new AiGatewayException(
                    504,
                    "Yêu cầu tới dịch vụ AI đã quá thời gian chờ (timeout). Vui lòng thử lại.",
                    ex.Message,
                    ex
                );
            }
            catch (HttpRequestException ex)
            {
                throw new AiGatewayException(
                    502,
                    "Không thể kết nối tới dịch vụ AI (lỗi mạng hoặc cổng kết nối). Vui lòng thử lại sau.",
                    ex.Message,
                    ex
                );
            }

            if (!response.IsSuccessStatusCode)
            {
                var statusCode = (int)response.StatusCode;
                var (category, userMessage, gatewayCode) = CategorizeError(statusCode, responseJson, config.Model);

                Console.WriteLine($"[AI GATEWAY ERROR] Category: {category}, Status: {statusCode}, Model: {config.Model}");
                throw new AiGatewayException(gatewayCode, userMessage, $"Upstream error ({category}, HTTP {statusCode})");
            }

            try
            {
                using var doc = JsonDocument.Parse(responseJson);
                var text = doc.RootElement
                    .GetProperty("choices")[0]
                    .GetProperty("message")
                    .GetProperty("content")
                    .GetString();

                if (string.IsNullOrWhiteSpace(text))
                {
                    return string.Empty;
                }

                text = text.Trim();
                if (text.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
                {
                    text = text[7..].Trim();
                }
                if (text.StartsWith("```"))
                {
                    text = text[3..].Trim();
                }
                if (text.EndsWith("```"))
                {
                    text = text[..^3].Trim();
                }

                return text;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AI GATEWAY PARSE ERROR] {ex.Message}");
                throw new AiGatewayException(
                    502,
                    "Không thể phân tích định dạng phản hồi từ dịch vụ AI.",
                    "AI provider response parsing failed.",
                    ex
                );
            }
        }

        public async Task<AIHealthStatus> CheckHealthAsync(
            AIConfiguration config,
            string apiKey,
            string credentialSource,
            bool isEnvironmentManaged,
            string storageStatus,
            long probeGeneration,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return new AIHealthStatus
                {
                    State = "NOT_CONFIGURED",
                    CredentialSource = "none",
                    IsEnvironmentManaged = false,
                    CredentialStorageStatus = storageStatus,
                    LastCheckedAt = null,
                    Message = "Chưa cấu hình API key từ bất kỳ nguồn nào.",
                    StatusCode = null,
                    LatencyMs = null,
                    ErrorCategory = "NoApiKey"
                };
            }

            if (!config.Enabled)
            {
                return new AIHealthStatus
                {
                    State = "UNHEALTHY",
                    CredentialSource = credentialSource,
                    IsEnvironmentManaged = isEnvironmentManaged,
                    CredentialStorageStatus = storageStatus,
                    LastCheckedAt = DateTime.UtcNow,
                    Message = "Dịch vụ AI đang tạm tắt trong cấu hình hệ thống.",
                    StatusCode = 503,
                    LatencyMs = 0,
                    ErrorCategory = "ServiceDisabled"
                };
            }

            if (string.IsNullOrWhiteSpace(config.BaseUrl) || string.IsNullOrWhiteSpace(config.Model))
            {
                return new AIHealthStatus
                {
                    State = "UNHEALTHY",
                    CredentialSource = credentialSource,
                    IsEnvironmentManaged = isEnvironmentManaged,
                    CredentialStorageStatus = storageStatus,
                    LastCheckedAt = DateTime.UtcNow,
                    Message = "BaseUrl hoặc Model chưa được cấu hình đầy đủ.",
                    StatusCode = 400,
                    LatencyMs = 0,
                    ErrorCategory = "MissingConfiguration"
                };
            }

            Uri endpoint;
            try
            {
                endpoint = BuildEndpointUri(config.BaseUrl);
            }
            catch (AiGatewayException ex)
            {
                return new AIHealthStatus
                {
                    State = "UNHEALTHY",
                    CredentialSource = credentialSource,
                    IsEnvironmentManaged = isEnvironmentManaged,
                    CredentialStorageStatus = storageStatus,
                    LastCheckedAt = DateTime.UtcNow,
                    Message = ex.UserFacingMessage,
                    StatusCode = ex.StatusCode,
                    LatencyMs = 0,
                    ErrorCategory = "InvalidUrl"
                };
            }

            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            var probePayload = JsonSerializer.Serialize(new
            {
                model = config.Model,
                messages = new[]
                {
                    new { role = "user", content = "ping" }
                },
                max_tokens = 10
            });

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(10));

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
                request.Content = new StringContent(probePayload, Encoding.UTF8, "application/json");

                var response = await _httpClient.SendAsync(request, cts.Token);
                var responseBody = await response.Content.ReadAsStringAsync(cts.Token);
                stopwatch.Stop();
                var elapsedMs = stopwatch.ElapsedMilliseconds;
                var statusCode = (int)response.StatusCode;

                if (response.IsSuccessStatusCode)
                {
                    return new AIHealthStatus
                    {
                        State = "HEALTHY",
                        CredentialSource = credentialSource,
                        IsEnvironmentManaged = isEnvironmentManaged,
                        CredentialStorageStatus = storageStatus,
                        LastCheckedAt = DateTime.UtcNow,
                        Message = "Kiểm tra kết nối tới nhà cung cấp AI thành công.",
                        StatusCode = statusCode,
                        LatencyMs = elapsedMs,
                        ErrorCategory = null
                    };
                }

                var (category, userMsg, _) = CategorizeError(statusCode, responseBody, config.Model);

                return new AIHealthStatus
                {
                    State = "UNHEALTHY",
                    CredentialSource = credentialSource,
                    IsEnvironmentManaged = isEnvironmentManaged,
                    CredentialStorageStatus = storageStatus,
                    LastCheckedAt = DateTime.UtcNow,
                    Message = userMsg,
                    StatusCode = statusCode,
                    LatencyMs = elapsedMs,
                    ErrorCategory = category
                };
            }
            catch (OperationCanceledException)
            {
                stopwatch.Stop();
                return new AIHealthStatus
                {
                    State = "UNHEALTHY",
                    CredentialSource = credentialSource,
                    IsEnvironmentManaged = isEnvironmentManaged,
                    CredentialStorageStatus = storageStatus,
                    LastCheckedAt = DateTime.UtcNow,
                    Message = "Kiểm tra kết nối AI quá thời gian chờ (Timeout sau 10 giây).",
                    StatusCode = 504,
                    LatencyMs = stopwatch.ElapsedMilliseconds,
                    ErrorCategory = "Timeout"
                };
            }
            catch (HttpRequestException ex)
            {
                stopwatch.Stop();
                return new AIHealthStatus
                {
                    State = "UNHEALTHY",
                    CredentialSource = credentialSource,
                    IsEnvironmentManaged = isEnvironmentManaged,
                    CredentialStorageStatus = storageStatus,
                    LastCheckedAt = DateTime.UtcNow,
                    Message = $"Không thể kết nối mạng tới nhà cung cấp AI: {ex.Message}",
                    StatusCode = 502,
                    LatencyMs = stopwatch.ElapsedMilliseconds,
                    ErrorCategory = "NetworkError"
                };
            }
        }
    }
}
