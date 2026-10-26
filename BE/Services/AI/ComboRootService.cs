using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using backend.Models;
using backend.Models.AI;
using backend.Services.Security;

namespace backend.Services.AI
{
    public class ComboRootService : IComboRootService
    {
        private readonly FileDb _fileDb;
        private readonly ICredentialProtectionService _protectionService;
        private readonly IAIProviderAdapter _providerAdapter;
        private readonly AIConfigurationService _configurationService;
        private readonly object _syncLock = new();

        private readonly List<ComboRootSlot> _slots = new();

        public ComboRootService(
            FileDb fileDb,
            ICredentialProtectionService protectionService,
            IAIProviderAdapter providerAdapter,
            AIConfigurationService configurationService)
        {
            _fileDb = fileDb ?? throw new ArgumentNullException(nameof(fileDb));
            _protectionService = protectionService ?? throw new ArgumentNullException(nameof(protectionService));
            _providerAdapter = providerAdapter ?? throw new ArgumentNullException(nameof(providerAdapter));
            _configurationService = configurationService ?? throw new ArgumentNullException(nameof(configurationService));

            InitializeDefaultSlots();
        }

        private void InitializeDefaultSlots()
        {
            lock (_syncLock)
            {
                var legacyDefault = _configurationService.GetRawDatabaseConfiguration();
                string primaryUrl = !string.IsNullOrWhiteSpace(legacyDefault?.BaseUrl) ? legacyDefault.BaseUrl : "https://api.vilao.ai/v1/";
                string primaryModel = !string.IsNullOrWhiteSpace(legacyDefault?.Model) ? legacyDefault.Model : "ag/gemini-2.0-flash";

                _slots.Clear();

                // Slot 1: API 1 (Primary) — Vilao Gateway Combo Root (Model Alias 'PrepMate')
                _slots.Add(new ComboRootSlot
                {
                    SlotIndex = 1,
                    Id = "api-1-vilao-primary",
                    Name = "API 1: Vilao Gateway (PrepMate Combo Root)",
                    ProviderConnectionId = "provider-vilao-primary",
                    BaseUrl = primaryUrl,
                    Protocol = "openai-chat-completions",
                    UpstreamModelId = ComboRootConfiguration.CanonicalAlias,
                    CredentialSlotId = "slot:vilao-primary",
                    CredentialMode = legacyDefault?.CredentialMode ?? "auto",
                    Enabled = true,
                    TimeoutSeconds = 30,
                    MaxRetries = 1,
                    HealthState = "UNTESTED"
                });

                // Slot 2: API 2 (Secondary Fallback) — Vilao AI Gateway (Gemini 1.5 Flash)
                _slots.Add(new ComboRootSlot
                {
                    SlotIndex = 2,
                    Id = "api-2-vilao-secondary",
                    Name = "API 2: Vilao Gateway (Gemini 1.5 Flash)",
                    ProviderConnectionId = "provider-vilao-secondary",
                    BaseUrl = "https://api.vilao.ai/v1/",
                    Protocol = "openai-chat-completions",
                    UpstreamModelId = "ag/gemini-1.5-flash",
                    CredentialSlotId = "slot:vilao-secondary",
                    CredentialMode = "auto",
                    Enabled = true,
                    TimeoutSeconds = 30,
                    MaxRetries = 1,
                    HealthState = "UNTESTED"
                });

                // Slot 3: API 3 (Tertiary Fallback) — OpenAI Direct Gateway (GPT-4o Mini)
                _slots.Add(new ComboRootSlot
                {
                    SlotIndex = 3,
                    Id = "api-3-openai-direct",
                    Name = "API 3: OpenAI Direct (GPT-4o Mini)",
                    ProviderConnectionId = "provider-openai-direct",
                    BaseUrl = "https://api.openai.com/v1/",
                    Protocol = "openai-chat-completions",
                    UpstreamModelId = "gpt-4o-mini",
                    CredentialSlotId = "slot:openai-direct",
                    CredentialMode = "auto",
                    Enabled = true,
                    TimeoutSeconds = 30,
                    MaxRetries = 1,
                    HealthState = "UNTESTED"
                });

                // Slot 4: API 4 (Quaternary Fallback) — OpenRouter / Groq Backup (Llama 3.3 70B)
                _slots.Add(new ComboRootSlot
                {
                    SlotIndex = 4,
                    Id = "api-4-openrouter-backup",
                    Name = "API 4: OpenRouter Backup (Llama 3.3 70B)",
                    ProviderConnectionId = "provider-openrouter-backup",
                    BaseUrl = "https://openrouter.ai/api/v1/",
                    Protocol = "openai-chat-completions",
                    UpstreamModelId = "meta-llama/llama-3.3-70b-instruct",
                    CredentialSlotId = "slot:openrouter-backup",
                    CredentialMode = "auto",
                    Enabled = true,
                    TimeoutSeconds = 35,
                    MaxRetries = 1,
                    HealthState = "UNTESTED"
                });
            }
        }

        public ComboRootConfiguration GetConfiguration()
        {
            lock (_syncLock)
            {
                return new ComboRootConfiguration
                {
                    Alias = ComboRootConfiguration.CanonicalAlias,
                    Enabled = _slots.Any(s => s.Enabled),
                    Slots = _slots.Select(CloneSlot).ToList(),
                    UpdatedAt = DateTime.UtcNow
                };
            }
        }

        public ComboRootSlot? GetSlot(int slotIndex)
        {
            lock (_syncLock)
            {
                var s = _slots.FirstOrDefault(x => x.SlotIndex == slotIndex);
                return s != null ? CloneSlot(s) : null;
            }
        }

        public ComboRootSlot UpdateSlot(int slotIndex, UpdateComboRootSlotRequest request)
        {
            if (request == null) throw new ArgumentNullException(nameof(request));

            lock (_syncLock)
            {
                var slot = _slots.FirstOrDefault(x => x.SlotIndex == slotIndex);
                if (slot == null)
                {
                    throw new KeyNotFoundException($"API Slot {slotIndex} does not exist in Combo Root.");
                }

                if (!string.IsNullOrWhiteSpace(request.Name))
                {
                    slot.Name = request.Name.Trim();
                }

                if (!string.IsNullOrWhiteSpace(request.BaseUrl))
                {
                    ValidateBaseUrl(request.BaseUrl.Trim());
                    slot.BaseUrl = request.BaseUrl.Trim();
                }

                if (!string.IsNullOrWhiteSpace(request.Protocol))
                {
                    slot.Protocol = request.Protocol.Trim().ToLowerInvariant();
                }

                if (!string.IsNullOrWhiteSpace(request.UpstreamModelId))
                {
                    slot.UpstreamModelId = request.UpstreamModelId.Trim();
                }

                if (request.ClearApiKey)
                {
                    slot.StoredApiKey = string.Empty;
                }
                else if (!string.IsNullOrWhiteSpace(request.ApiKey))
                {
                    slot.StoredApiKey = _protectionService.Protect(request.ApiKey.Trim());
                }

                if (!string.IsNullOrWhiteSpace(request.CredentialMode))
                {
                    var mode = request.CredentialMode.Trim().ToLowerInvariant();
                    if (mode is "auto" or "environment" or "admin")
                    {
                        slot.CredentialMode = mode;
                    }
                }

                if (request.Enabled.HasValue)
                {
                    slot.Enabled = request.Enabled.Value;
                }

                if (request.TimeoutSeconds.HasValue && request.TimeoutSeconds.Value > 0)
                {
                    slot.TimeoutSeconds = request.TimeoutSeconds.Value;
                }

                slot.HealthState = "UNTESTED";
                slot.LastError = null;
                slot.LastStatusCode = null;

                return CloneSlot(slot);
            }
        }

        public (string PlaintextKey, string Source, bool IsEnvManaged) ResolveSlotCredential(ComboRootSlot slot)
        {
            if (slot == null) return (string.Empty, "none", false);

            var mode = (slot.CredentialMode ?? "auto").ToLowerInvariant();

            // 1. Check environment variables
            string? envKey = null;
            string envSource = "none";

            var prepmateKey = Environment.GetEnvironmentVariable("PREPMATE_AI_API_KEY");
            if (!string.IsNullOrWhiteSpace(prepmateKey))
            {
                envKey = prepmateKey.Trim();
                envSource = "environment:PREPMATE_AI_API_KEY";
            }
            else if (slot.SlotIndex is 1 or 2)
            {
                var vilaoKey = Environment.GetEnvironmentVariable("VILAO_API_KEY");
                if (!string.IsNullOrWhiteSpace(vilaoKey))
                {
                    envKey = vilaoKey.Trim();
                    envSource = "environment:VILAO_API_KEY";
                }
                else
                {
                    var geminiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
                    if (!string.IsNullOrWhiteSpace(geminiKey))
                    {
                        envKey = geminiKey.Trim();
                        envSource = "environment:GEMINI_API_KEY";
                    }
                }
            }
            else if (slot.SlotIndex == 3)
            {
                var openaiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
                if (!string.IsNullOrWhiteSpace(openaiKey))
                {
                    envKey = openaiKey.Trim();
                    envSource = "environment:OPENAI_API_KEY";
                }
            }
            else if (slot.SlotIndex == 4)
            {
                var openrouterKey = Environment.GetEnvironmentVariable("OPENROUTER_API_KEY");
                if (!string.IsNullOrWhiteSpace(openrouterKey))
                {
                    envKey = openrouterKey.Trim();
                    envSource = "environment:OPENROUTER_API_KEY";
                }
            }

            // Mode: strictly environment
            if (mode == "environment")
            {
                return (!string.IsNullOrWhiteSpace(envKey))
                    ? (envKey, envSource, true)
                    : (string.Empty, "none", true);
            }

            // Mode: strictly admin
            if (mode == "admin")
            {
                if (!string.IsNullOrWhiteSpace(slot.StoredApiKey))
                {
                    var plain = _protectionService.Unprotect(slot.StoredApiKey);
                    return (plain, "admin:slot", false);
                }
                return (string.Empty, "none", false);
            }

            // Mode: auto (environment takes precedence if present, else stored key, else legacy config)
            if (!string.IsNullOrWhiteSpace(envKey))
            {
                return (envKey, envSource, true);
            }

            if (!string.IsNullOrWhiteSpace(slot.StoredApiKey))
            {
                var plain = _protectionService.Unprotect(slot.StoredApiKey);
                return (plain, "admin:slot", false);
            }

            // Fallback for slot 1: inherit from AIConfigurationService legacy default
            if (slot.SlotIndex == 1)
            {
                var legacy = _configurationService.ResolveCredential();
                if (!string.IsNullOrWhiteSpace(legacy.Key))
                {
                    return (legacy.Key, legacy.Source, legacy.IsEnvironmentManaged);
                }
            }

            return (string.Empty, "none", false);
        }

        public async Task<ComboRootSlotDto> ProbeSlotHealthAsync(int slotIndex, CancellationToken cancellationToken = default)
        {
            ComboRootSlot? slot;
            lock (_syncLock)
            {
                slot = _slots.FirstOrDefault(s => s.SlotIndex == slotIndex);
            }

            if (slot == null)
            {
                throw new KeyNotFoundException($"API Slot {slotIndex} does not exist in Combo Root.");
            }

            var cred = ResolveSlotCredential(slot);
            var sw = Stopwatch.StartNew();

            if (string.IsNullOrWhiteSpace(cred.PlaintextKey))
            {
                lock (_syncLock)
                {
                    slot.HealthState = "UNHEALTHY";
                    slot.LastCheckedAt = DateTime.UtcNow;
                    slot.LastError = "API key chưa được cấu hình.";
                    slot.LastStatusCode = 503;
                    slot.LastLatencyMs = sw.ElapsedMilliseconds;
                }
                return ToDto(slot);
            }

            var callConfig = new AIConfiguration
            {
                Id = slot.Id,
                Provider = slot.Name,
                Protocol = slot.Protocol,
                BaseUrl = slot.BaseUrl,
                Model = slot.UpstreamModelId,
                Enabled = slot.Enabled,
                Temperature = 0.1,
                MaxTokens = 5
            };

            var health = await _providerAdapter.CheckHealthAsync(
                callConfig,
                cred.PlaintextKey,
                cred.Source,
                cred.IsEnvManaged,
                _protectionService.GetStorageStatus(slot.StoredApiKey),
                0,
                cancellationToken
            );

            lock (_syncLock)
            {
                slot.HealthState = health.State;
                slot.LastCheckedAt = DateTime.UtcNow;
                slot.LastStatusCode = health.StatusCode;
                slot.LastLatencyMs = health.LatencyMs;
                slot.LastError = (health.State != "HEALTHY") ? health.Message : null;
            }

            return ToDto(slot);
        }

        public async Task<List<ComboRootSlotDto>> ProbeAllSlotsHealthAsync(CancellationToken cancellationToken = default)
        {
            var results = new List<ComboRootSlotDto>();
            for (int i = 1; i <= 4; i++)
            {
                try
                {
                    var dto = await ProbeSlotHealthAsync(i, cancellationToken);
                    results.Add(dto);
                }
                catch (Exception ex)
                {
                    results.Add(new ComboRootSlotDto
                    {
                        SlotIndex = i,
                        HealthState = "UNHEALTHY",
                        LastError = ex.Message,
                        LastCheckedAt = DateTime.UtcNow
                    });
                }
            }
            return results;
        }

        public ComboRootSlotDto ToDto(ComboRootSlot slot)
        {
            var cred = ResolveSlotCredential(slot);
            return new ComboRootSlotDto
            {
                SlotIndex = slot.SlotIndex,
                Id = slot.Id,
                Name = slot.Name,
                ProviderConnectionId = slot.ProviderConnectionId,
                BaseUrl = slot.BaseUrl,
                Protocol = slot.Protocol,
                UpstreamModelId = slot.UpstreamModelId,
                CredentialMode = slot.CredentialMode,
                ApiKeyConfigured = !string.IsNullOrWhiteSpace(cred.PlaintextKey),
                CredentialSource = cred.Source,
                Enabled = slot.Enabled,
                TimeoutSeconds = slot.TimeoutSeconds,
                HealthState = slot.HealthState,
                LastCheckedAt = slot.LastCheckedAt,
                LastError = slot.LastError,
                LastStatusCode = slot.LastStatusCode,
                LastLatencyMs = slot.LastLatencyMs
            };
        }

        private static void ValidateBaseUrl(string rawUrl)
        {
            if (string.IsNullOrWhiteSpace(rawUrl)) throw new ArgumentException("Base URL cannot be empty.", nameof(rawUrl));
            if (!Uri.TryCreate(rawUrl.Trim(), UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                throw new ArgumentException("Base URL must be a valid absolute HTTP or HTTPS URL.", nameof(rawUrl));
            }
            if (uri.Scheme == Uri.UriSchemeHttp && !OpenAIChatCompletionsAdapter.IsLoopbackOrLocalhost(uri))
            {
                throw new ArgumentException("Insecure HTTP protocol is prohibited for remote endpoints. HTTPS is required.", nameof(rawUrl));
            }
        }

        private static ComboRootSlot CloneSlot(ComboRootSlot s)
        {
            return new ComboRootSlot
            {
                SlotIndex = s.SlotIndex,
                Id = s.Id,
                Name = s.Name,
                ProviderConnectionId = s.ProviderConnectionId,
                BaseUrl = s.BaseUrl,
                Protocol = s.Protocol,
                UpstreamModelId = s.UpstreamModelId,
                CredentialSlotId = s.CredentialSlotId,
                StoredApiKey = s.StoredApiKey,
                CredentialMode = s.CredentialMode,
                Enabled = s.Enabled,
                TimeoutSeconds = s.TimeoutSeconds,
                MaxRetries = s.MaxRetries,
                HealthState = s.HealthState,
                LastCheckedAt = s.LastCheckedAt,
                LastError = s.LastError,
                LastStatusCode = s.LastStatusCode,
                LastLatencyMs = s.LastLatencyMs
            };
        }
    }
}
