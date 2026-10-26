using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace backend.Services.TTS
{
    public interface IElevenLabsTtsService
    {
        bool IsConfigured { get; }
        bool ZeroRetentionEnabled { get; }
        Task<TtsVoicesResponse> GetVoicesAsync(CancellationToken cancellationToken = default);
        Task<TtsSpeakResult> SpeakAsync(TtsSpeakRequest request, CancellationToken cancellationToken = default);
        Task<VoiceDesignPreviewResponse> CreateVoiceDesignPreviewAsync(VoiceDesignPreviewRequest request, CancellationToken cancellationToken = default);
        Task<VoiceDesignSaveResponse> SaveVoiceFromPreviewAsync(VoiceDesignSaveRequest request, CancellationToken cancellationToken = default);
    }

    public class TtsVoicesResponse
    {
        public bool Success { get; set; }
        public bool Configured { get; set; }
        public string? Error { get; set; }
        public string? Message { get; set; }
        public List<TtsVoiceDto> Voices { get; set; } = new();
    }

    public class TtsVoiceDto
    {
        public string VoiceId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Category { get; set; }
        public string? Description { get; set; }
        public string? PreviewUrl { get; set; }
        public Dictionary<string, string>? Labels { get; set; }
        public bool SupportsVietnamese { get; set; }
        public string? Accent { get; set; }
        public string? Gender { get; set; }
    }

    public class TtsSpeakRequest
    {
        public string Text { get; set; } = string.Empty;
        public string VoiceId { get; set; } = string.Empty;
        public string ModelId { get; set; } = "eleven_flash_v2_5";
        public float Speed { get; set; } = 1.0f;
    }

    public class TtsSpeakResult
    {
        public bool Success { get; set; }
        public int StatusCode { get; set; } = 200;
        public string? ErrorCode { get; set; }
        public string? ErrorMessage { get; set; }
        public byte[]? AudioBytes { get; set; }
        public string ContentType { get; set; } = "audio/mpeg";
    }

    public class VoiceDesignPreviewRequest
    {
        public string Description { get; set; } = string.Empty;
        public string? Text { get; set; }
        public string? IndustryContext { get; set; }
        public string? ModelId { get; set; }
    }

    public class VoiceDesignPreviewResponse
    {
        public bool Success { get; set; }
        public int StatusCode { get; set; } = 200;
        public string? Error { get; set; }
        public string? Message { get; set; }
        public List<VoiceDesignPreviewItem> Previews { get; set; } = new();
        public string? Text { get; set; }
    }

    public class VoiceDesignPreviewItem
    {
        public string GeneratedVoiceId { get; set; } = string.Empty;
        public string AudioBase64 { get; set; } = string.Empty;
        public double DurationSecs { get; set; }
        public string MediaType { get; set; } = "audio/mpeg";
        public string? Language { get; set; }
    }

    public class VoiceDesignSaveRequest
    {
        public string VoiceName { get; set; } = string.Empty;
        public string? VoiceDescription { get; set; }
        public string GeneratedVoiceId { get; set; } = string.Empty;
    }

    public class VoiceDesignSaveResponse
    {
        public bool Success { get; set; }
        public int StatusCode { get; set; } = 200;
        public string? Error { get; set; }
        public string? Message { get; set; }
        public string? VoiceId { get; set; }
        public string? Name { get; set; }
    }

    public class ElevenLabsTtsService : IElevenLabsTtsService
    {
        public const string DefaultTtsModel = "eleven_flash_v2_5";
        public const string DefaultVoiceDesignModel = "eleven_multilingual_ttv_v2";
        public static readonly string[] ValidVoiceDesignModels = new[]
        {
            "eleven_multilingual_ttv_v2",
            "eleven_ttv_v3"
        };

        private readonly HttpClient _httpClient;
        private readonly string _apiKey;
        private readonly string _baseUrl;
        private readonly bool _zeroRetentionEnabled;
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        public ElevenLabsTtsService(HttpClient httpClient, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _apiKey = (configuration["ElevenLabs:ApiKey"]
                ?? Environment.GetEnvironmentVariable("ELEVENLABS_API_KEY")
                ?? string.Empty).Trim();
            _baseUrl = (configuration["ElevenLabs:BaseUrl"]
                ?? Environment.GetEnvironmentVariable("ELEVENLABS_BASE_URL")
                ?? "https://api.elevenlabs.io").Trim().TrimEnd('/');

            // Server-side Zero Retention Mode flag. Defaults to false.
            // Notice: Turning this on requires Enterprise licensing on ElevenLabs; standard/free accounts will fail if enabled.
            var zrConfig = configuration["ElevenLabs:ZeroRetentionEnabled"]
                ?? Environment.GetEnvironmentVariable("ELEVENLABS_ZERO_RETENTION_ENABLED");
            _zeroRetentionEnabled = string.Equals(zrConfig, "true", StringComparison.OrdinalIgnoreCase);
        }

        public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

        public bool ZeroRetentionEnabled => _zeroRetentionEnabled;

        /// <summary>
        /// Classifies ElevenLabs upstream error response into structured application error codes and safe localized messages.
        /// Prevents leaking secrets, sensitive headers, or raw stack traces.
        /// </summary>
        public static (string ErrorCode, string ErrorMessage) ClassifyUpstreamError(int statusCode, string? responseBody)
        {
            string? upstreamStatus = null;
            string? upstreamMessage = null;

            if (!string.IsNullOrWhiteSpace(responseBody))
            {
                try
                {
                    using var errDoc = JsonDocument.Parse(responseBody);
                    if (errDoc.RootElement.TryGetProperty("detail", out var detailEl))
                    {
                        if (detailEl.ValueKind == JsonValueKind.Object)
                        {
                            if (detailEl.TryGetProperty("status", out var sProp)) upstreamStatus = sProp.GetString();
                            if (detailEl.TryGetProperty("message", out var mProp)) upstreamMessage = mProp.GetString();
                        }
                        else if (detailEl.ValueKind == JsonValueKind.String)
                        {
                            upstreamMessage = detailEl.GetString();
                        }
                    }
                }
                catch { }
            }

            if (statusCode == 401)
            {
                if (string.Equals(upstreamStatus, "detected_unusual_activity", StringComparison.OrdinalIgnoreCase) ||
                    (upstreamMessage != null && upstreamMessage.IndexOf("unusual activity", StringComparison.OrdinalIgnoreCase) >= 0))
                {
                    return ("ELEVENLABS_ACCOUNT_RESTRICTED",
                        "Tài khoản ElevenLabs bị hạn chế truy cập do phát hiện hoạt động bất thường từ provider. Vui lòng kiểm tra lại trạng thái tài khoản.");
                }

                return ("ELEVENLABS_UNAUTHORIZED",
                    "Xác thực ElevenLabs thất bại. API key không hợp lệ hoặc không có quyền truy cập.");
            }

            if (statusCode == 403)
            {
                return ("ELEVENLABS_FORBIDDEN",
                    "Tài khoản ElevenLabs không có quyền truy cập tính năng hoặc tài nguyên này.");
            }

            if (statusCode == 429)
            {
                return ("ELEVENLABS_QUOTA_EXCEEDED",
                    "Đã vượt quá hạn mức (quota) hoặc giới hạn tần suất yêu cầu của ElevenLabs.");
            }

            if (statusCode == 404)
            {
                return ("ELEVENLABS_VOICE_NOT_FOUND",
                    "Không tìm thấy giọng đọc hoặc tài nguyên trên ElevenLabs.");
            }

            if (statusCode == 400)
            {
                if (string.Equals(upstreamStatus, "quota_exceeded", StringComparison.OrdinalIgnoreCase) ||
                    (upstreamMessage != null && upstreamMessage.IndexOf("quota", StringComparison.OrdinalIgnoreCase) >= 0))
                {
                    return ("ELEVENLABS_QUOTA_EXCEEDED",
                        "Đã vượt quá hạn mức credit của tài khoản ElevenLabs.");
                }

                return ("ELEVENLABS_BAD_REQUEST",
                    "Yêu cầu không hợp lệ đối với máy chủ ElevenLabs.");
            }

            if (statusCode >= 500)
            {
                return ($"ELEVENLABS_SERVER_ERROR_{statusCode}",
                    $"Máy chủ ElevenLabs phản hồi lỗi dịch vụ ({statusCode}).");
            }

            return ($"ELEVENLABS_{statusCode}",
                $"ElevenLabs phản hồi mã lỗi HTTP {statusCode}.");
        }

        public async Task<TtsVoicesResponse> GetVoicesAsync(CancellationToken cancellationToken = default)
        {
            if (!IsConfigured)
            {
                return new TtsVoicesResponse
                {
                    Success = false,
                    Configured = false,
                    Error = "ELEVENLABS_NOT_CONFIGURED",
                    Message = "ElevenLabs API Key chưa được cấu hình trên server.",
                    Voices = new List<TtsVoiceDto>()
                };
            }

            try
            {
                var url = $"{_baseUrl}/v1/voices";
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Add("xi-api-key", _apiKey);

                using var response = await _httpClient.SendAsync(request, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    string errBody = string.Empty;
                    try { errBody = await response.Content.ReadAsStringAsync(cancellationToken); } catch { }
                    var (errCode, errMsg) = ClassifyUpstreamError((int)response.StatusCode, errBody);

                    return new TtsVoicesResponse
                    {
                        Success = false,
                        Configured = true,
                        Error = errCode,
                        Message = errMsg,
                        Voices = new List<TtsVoiceDto>()
                    };
                }

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(json);
                var voicesList = new List<TtsVoiceDto>();

                if (doc.RootElement.TryGetProperty("voices", out var voicesElement) && voicesElement.ValueKind == JsonValueKind.Array)
                {
                    foreach (var voiceEl in voicesElement.EnumerateArray())
                    {
                        var voiceId = voiceEl.TryGetProperty("voice_id", out var idProp) ? idProp.GetString() ?? "" : "";
                        var name = voiceEl.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "" : "";
                        var category = voiceEl.TryGetProperty("category", out var catProp) ? catProp.GetString() : null;
                        var description = voiceEl.TryGetProperty("description", out var descProp) ? descProp.GetString() : null;
                        var previewUrl = voiceEl.TryGetProperty("preview_url", out var prevProp) ? prevProp.GetString() : null;

                        var labels = new Dictionary<string, string>();
                        if (voiceEl.TryGetProperty("labels", out var labelsProp) && labelsProp.ValueKind == JsonValueKind.Object)
                        {
                            foreach (var label in labelsProp.EnumerateObject())
                            {
                                labels[label.Name] = label.Value.GetString() ?? "";
                            }
                        }

                        // Determine language, accent, gender
                        string? gender = labels.TryGetValue("gender", out var g) ? g : null;
                        string? accent = labels.TryGetValue("accent", out var a) ? a : null;
                        string? language = labels.TryGetValue("language", out var l) ? l : null;

                        // Check Vietnamese support
                        bool isVi = (language != null && language.IndexOf("vietnam", StringComparison.OrdinalIgnoreCase) >= 0) ||
                                    (accent != null && accent.IndexOf("vietnam", StringComparison.OrdinalIgnoreCase) >= 0) ||
                                    (description != null && description.IndexOf("vietnamese", StringComparison.OrdinalIgnoreCase) >= 0) ||
                                    (description != null && description.IndexOf("tiếng việt", StringComparison.OrdinalIgnoreCase) >= 0);

                        voicesList.Add(new TtsVoiceDto
                        {
                            VoiceId = voiceId,
                            Name = name,
                            Category = category,
                            Description = description,
                            PreviewUrl = previewUrl,
                            Labels = labels,
                            SupportsVietnamese = isVi,
                            Gender = gender,
                            Accent = accent
                        });
                    }
                }

                // Sort Vietnamese voices to the front, followed by other voices
                var sorted = voicesList
                    .OrderByDescending(v => v.SupportsVietnamese)
                    .ThenBy(v => v.Name)
                    .ToList();

                return new TtsVoicesResponse
                {
                    Success = true,
                    Configured = true,
                    Voices = sorted
                };
            }
            catch (Exception ex)
            {
                return new TtsVoicesResponse
                {
                    Success = false,
                    Configured = true,
                    Error = "FETCH_FAILED",
                    Message = $"Lỗi kết nối tới ElevenLabs: {ex.Message}"
                };
            }
        }

        public async Task<TtsSpeakResult> SpeakAsync(TtsSpeakRequest request, CancellationToken cancellationToken = default)
        {
            if (!IsConfigured)
            {
                return new TtsSpeakResult
                {
                    Success = false,
                    StatusCode = 503,
                    ErrorCode = "ELEVENLABS_NOT_CONFIGURED",
                    ErrorMessage = "ElevenLabs API Key chưa được cấu hình trên server."
                };
            }

            if (string.IsNullOrWhiteSpace(request.Text))
            {
                return new TtsSpeakResult
                {
                    Success = false,
                    StatusCode = 400,
                    ErrorCode = "EMPTY_TEXT",
                    ErrorMessage = "Văn bản phát âm không được để trống."
                };
            }

            if (request.Text.Length > 2000)
            {
                return new TtsSpeakResult
                {
                    Success = false,
                    StatusCode = 400,
                    ErrorCode = "TEXT_TOO_LONG",
                    ErrorMessage = "Độ dài văn bản vượt quá giới hạn cho phép (2000 ký tự)."
                };
            }

            if (string.IsNullOrWhiteSpace(request.VoiceId))
            {
                return new TtsSpeakResult
                {
                    Success = false,
                    StatusCode = 400,
                    ErrorCode = "MISSING_VOICE_ID",
                    ErrorMessage = "Thiếu VoiceId của ElevenLabs."
                };
            }

            // Ensure model defaults to DefaultTtsModel (eleven_flash_v2_5) for Vietnamese support
            string modelId = string.IsNullOrWhiteSpace(request.ModelId) ? DefaultTtsModel : request.ModelId.Trim();
            float speed = Math.Clamp(request.Speed, 0.7f, 1.2f);

            try
            {
                // Only attach ?enable_logging=false when Zero Retention Mode is explicitly configured on the server.
                // Standard/Free accounts must omit this parameter to adhere to provider's default policy without triggering 401.
                var url = $"{_baseUrl}/v1/text-to-speech/{Uri.EscapeDataString(request.VoiceId)}";
                if (_zeroRetentionEnabled)
                {
                    url += "?enable_logging=false";
                }

                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
                httpRequest.Headers.Add("xi-api-key", _apiKey);
                httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("audio/mpeg"));

                var payload = new
                {
                    text = request.Text,
                    model_id = modelId,
                    voice_settings = new
                    {
                        stability = 0.5f,
                        similarity_boost = 0.8f,
                        speed = speed
                    }
                };

                httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

                using var response = await _httpClient.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    string errBody = string.Empty;
                    try
                    {
                        errBody = await response.Content.ReadAsStringAsync(cancellationToken);
                    }
                    catch { }

                    var (errCode, errMsg) = ClassifyUpstreamError((int)response.StatusCode, errBody);

                    return new TtsSpeakResult
                    {
                        Success = false,
                        StatusCode = (int)response.StatusCode,
                        ErrorCode = errCode,
                        ErrorMessage = errMsg
                    };
                }

                var audioBytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
                return new TtsSpeakResult
                {
                    Success = true,
                    StatusCode = 200,
                    AudioBytes = audioBytes,
                    ContentType = "audio/mpeg"
                };
            }
            catch (OperationCanceledException)
            {
                return new TtsSpeakResult
                {
                    Success = false,
                    StatusCode = 499,
                    ErrorCode = "REQUEST_CANCELLED",
                    ErrorMessage = "Yêu cầu phát âm đã bị hủy."
                };
            }
            catch (Exception ex)
            {
                return new TtsSpeakResult
                {
                    Success = false,
                    StatusCode = 502,
                    ErrorCode = "GATEWAY_ERROR",
                    ErrorMessage = $"Lỗi kết nối tới ElevenLabs TTS: {ex.Message}"
                };
            }
        }

        public async Task<VoiceDesignPreviewResponse> CreateVoiceDesignPreviewAsync(VoiceDesignPreviewRequest request, CancellationToken cancellationToken = default)
        {
            if (!IsConfigured)
            {
                return new VoiceDesignPreviewResponse
                {
                    Success = false,
                    StatusCode = 503,
                    Error = "ELEVENLABS_NOT_CONFIGURED",
                    Message = "ElevenLabs API Key chưa được cấu hình trên server."
                };
            }

            var trimmedDesc = (request.Description ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(trimmedDesc) || trimmedDesc.Length < 20)
            {
                return new VoiceDesignPreviewResponse
                {
                    Success = false,
                    StatusCode = 400,
                    Error = "DESCRIPTION_TOO_SHORT",
                    Message = "Mô tả giọng nói phải có độ dài tối thiểu từ 20 đến 1000 ký tự."
                };
            }

            if (trimmedDesc.Length > 1000)
            {
                return new VoiceDesignPreviewResponse
                {
                    Success = false,
                    StatusCode = 400,
                    Error = "DESCRIPTION_TOO_LONG",
                    Message = "Mô tả giọng nói vượt quá giới hạn cho phép (1000 ký tự)."
                };
            }

            // Enrich description with industry context if provided (up to 1000 chars)
            string fullDescription = trimmedDesc;
            if (!string.IsNullOrWhiteSpace(request.IndustryContext))
            {
                string combined = $"{fullDescription} Interview context: {request.IndustryContext.Trim()}.";
                fullDescription = combined.Length > 1000 ? combined.Substring(0, 1000) : combined;
            }

            // Separate Voice Design model (must be eleven_multilingual_ttv_v2 or eleven_ttv_v3)
            string modelId = string.IsNullOrWhiteSpace(request.ModelId)
                ? DefaultVoiceDesignModel
                : request.ModelId.Trim();

            if (!ValidVoiceDesignModels.Contains(modelId))
            {
                modelId = DefaultVoiceDesignModel;
            }

            // ElevenLabs contract: 'text' if provided must be between 100 and 1000 chars.
            // If custom text is provided, auto_generate_text = false.
            // If omitted/null or < 100 chars, auto_generate_text = true and text is omitted.
            string? validCustomText = null;
            if (!string.IsNullOrWhiteSpace(request.Text))
            {
                string t = request.Text.Trim();
                if (t.Length >= 100 && t.Length <= 1000)
                {
                    validCustomText = t;
                }
            }

            try
            {
                var url = $"{_baseUrl}/v1/text-to-voice/design";
                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
                httpRequest.Headers.Add("xi-api-key", _apiKey);

                object payload = validCustomText != null
                    ? new
                    {
                        voice_description = fullDescription,
                        model_id = modelId,
                        text = validCustomText,
                        auto_generate_text = false
                    }
                    : new
                    {
                        voice_description = fullDescription,
                        model_id = modelId,
                        auto_generate_text = true
                    };

                httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload, _jsonOptions), Encoding.UTF8, "application/json");

                using var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    string errBody = string.Empty;
                    try { errBody = await response.Content.ReadAsStringAsync(cancellationToken); } catch { }
                    var (errCode, errMsg) = ClassifyUpstreamError((int)response.StatusCode, errBody);

                    return new VoiceDesignPreviewResponse
                    {
                        Success = false,
                        StatusCode = (int)response.StatusCode,
                        Error = errCode,
                        Message = errMsg
                    };
                }

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(json);
                var previews = new List<VoiceDesignPreviewItem>();

                if (doc.RootElement.TryGetProperty("previews", out var previewsEl) && previewsEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in previewsEl.EnumerateArray())
                    {
                        var genId = item.TryGetProperty("generated_voice_id", out var idProp) ? idProp.GetString() ?? "" : "";
                        var audio64 = item.TryGetProperty("audio_base_64", out var audProp) ? audProp.GetString() ?? "" : "";
                        var dur = item.TryGetProperty("duration_secs", out var durProp) ? durProp.GetDouble() : 0.0;
                        var media = item.TryGetProperty("media_type", out var medProp) ? medProp.GetString() ?? "audio/mpeg" : "audio/mpeg";
                        var lang = item.TryGetProperty("language", out var langProp) ? langProp.GetString() : null;

                        if (!string.IsNullOrEmpty(genId))
                        {
                            previews.Add(new VoiceDesignPreviewItem
                            {
                                GeneratedVoiceId = genId,
                                AudioBase64 = audio64,
                                DurationSecs = dur,
                                MediaType = media,
                                Language = lang
                            });
                        }
                    }
                }

                string? returnedText = doc.RootElement.TryGetProperty("text", out var tProp) ? tProp.GetString() : validCustomText;

                return new VoiceDesignPreviewResponse
                {
                    Success = true,
                    StatusCode = 200,
                    Previews = previews,
                    Text = returnedText
                };
            }
            catch (Exception ex)
            {
                return new VoiceDesignPreviewResponse
                {
                    Success = false,
                    StatusCode = 502,
                    Error = "GATEWAY_ERROR",
                    Message = $"Lỗi khi kết nối tới ElevenLabs Voice Design: {ex.Message}"
                };
            }
        }

        public async Task<VoiceDesignSaveResponse> SaveVoiceFromPreviewAsync(VoiceDesignSaveRequest request, CancellationToken cancellationToken = default)
        {
            if (!IsConfigured)
            {
                return new VoiceDesignSaveResponse
                {
                    Success = false,
                    StatusCode = 503,
                    Error = "ELEVENLABS_NOT_CONFIGURED",
                    Message = "ElevenLabs API Key chưa được cấu hình trên server."
                };
            }

            if (string.IsNullOrWhiteSpace(request.VoiceName))
            {
                return new VoiceDesignSaveResponse
                {
                    Success = false,
                    StatusCode = 400,
                    Error = "EMPTY_VOICE_NAME",
                    Message = "Tên giọng nói không được để trống."
                };
            }

            if (string.IsNullOrWhiteSpace(request.GeneratedVoiceId))
            {
                return new VoiceDesignSaveResponse
                {
                    Success = false,
                    StatusCode = 400,
                    Error = "MISSING_GENERATED_VOICE_ID",
                    Message = "Thiếu generated_voice_id từ bước tạo preview."
                };
            }

            try
            {
                var url = $"{_baseUrl}/v1/text-to-voice";
                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
                httpRequest.Headers.Add("xi-api-key", _apiKey);

                var payload = new
                {
                    voice_name = request.VoiceName.Trim(),
                    voice_description = request.VoiceDescription?.Trim() ?? string.Empty,
                    generated_voice_id = request.GeneratedVoiceId.Trim()
                };

                httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

                using var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    return new VoiceDesignSaveResponse
                    {
                        Success = false,
                        StatusCode = (int)response.StatusCode,
                        Error = $"API_ERROR_{(int)response.StatusCode}",
                        Message = $"Lỗi khi lưu giọng nói từ ElevenLabs: {response.StatusCode}."
                    };
                }

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(json);
                string voiceId = doc.RootElement.TryGetProperty("voice_id", out var idProp) ? idProp.GetString() ?? "" : "";
                string name = doc.RootElement.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "" : request.VoiceName;

                return new VoiceDesignSaveResponse
                {
                    Success = true,
                    StatusCode = 200,
                    VoiceId = voiceId,
                    Name = name
                };
            }
            catch (Exception ex)
            {
                return new VoiceDesignSaveResponse
                {
                    Success = false,
                    StatusCode = 502,
                    Error = "GATEWAY_ERROR",
                    Message = $"Lỗi lưu giọng nói: {ex.Message}"
                };
            }
        }
    }
}
