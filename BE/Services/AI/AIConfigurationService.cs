using System;
using backend.Models;
using backend.Services.Security;

namespace backend.Services
{
    public class AIConfigurationService
    {
        public const string StateNotConfigured = "NOT_CONFIGURED";
        public const string StateNotChecked = "NOT_CHECKED";
        public const string StateHealthy = "HEALTHY";
        public const string StateUnhealthy = "UNHEALTHY";

        public const string SourcePrepmateEnv = "environment:PREPMATE_AI_API_KEY";
        public const string SourceVilaoEnv = "environment:VILAO_API_KEY";
        public const string SourceGeminiEnv = "environment:GEMINI_API_KEY";
        public const string SourceDatabaseEncrypted = "admin:encrypted";
        public const string SourceDatabaseLegacy = "admin:legacy_plaintext";
        public const string SourceNone = "none";

        private readonly FileDb _fileDb;
        private readonly ICredentialProtectionService _protectionService;
        private readonly backend.Services.AI.IProviderRegistry? _providerRegistry;
        private readonly backend.Services.AI.IModelRegistry? _modelRegistry;

        private string _lastReadinessState = StateNotChecked;
        private DateTime? _lastCheckedAt = null;
        private string _lastHealthMessage = "Đã có cấu hình AI nhưng chưa kiểm tra kết nối với upstream.";
        private int? _lastUpstreamStatusCode = null;
        private long? _lastLatencyMs = null;
        private string? _lastErrorCategory = null;
        private long _configGeneration = 1;
        private readonly object _healthLock = new();

        public AIConfigurationService(
            FileDb fileDb,
            ICredentialProtectionService protectionService,
            backend.Services.AI.IProviderRegistry? providerRegistry = null,
            backend.Services.AI.IModelRegistry? modelRegistry = null)
        {
            _fileDb = fileDb ?? throw new ArgumentNullException(nameof(fileDb));
            _protectionService = protectionService ?? throw new ArgumentNullException(nameof(protectionService));
            _providerRegistry = providerRegistry;
            _modelRegistry = modelRegistry;
        }

        public long CurrentGeneration
        {
            get
            {
                lock (_healthLock)
                {
                    return _configGeneration;
                }
            }
        }

        /// <summary>
        /// Centralized credential resolution:
        /// Respects CredentialMode ("auto", "environment", "admin")
        /// Resolves environment variables or encrypted/legacy database credentials safely.
        /// </summary>
        public (string Key, string Source, bool IsEnvironmentManaged, string StorageStatus) ResolveCredential()
        {
            var dbConfig = GetRawDatabaseConfiguration();
            var storageStatus = _protectionService.GetStorageStatus(dbConfig?.ApiKey);
            var mode = (dbConfig?.CredentialMode ?? "auto").ToLowerInvariant();

            string? envKey = null;
            string envSource = SourceNone;

            var prepmateEnv = Environment.GetEnvironmentVariable("PREPMATE_AI_API_KEY");
            if (!string.IsNullOrWhiteSpace(prepmateEnv))
            {
                envKey = prepmateEnv.Trim();
                envSource = SourcePrepmateEnv;
            }
            else
            {
                var vilaoEnv = Environment.GetEnvironmentVariable("VILAO_API_KEY");
                if (!string.IsNullOrWhiteSpace(vilaoEnv))
                {
                    envKey = vilaoEnv.Trim();
                    envSource = SourceVilaoEnv;
                }
                else
                {
                    var geminiEnv = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
                    if (!string.IsNullOrWhiteSpace(geminiEnv))
                    {
                        envKey = geminiEnv.Trim();
                        envSource = SourceGeminiEnv;
                    }
                }
            }

            // Mode: strictly environment
            if (mode == "environment")
            {
                if (!string.IsNullOrWhiteSpace(envKey))
                {
                    return (envKey, envSource, true, storageStatus);
                }
                return (string.Empty, SourceNone, true, storageStatus);
            }

            // Mode: strictly admin / database
            if (mode == "admin")
            {
                if (dbConfig != null && !string.IsNullOrWhiteSpace(dbConfig.ApiKey))
                {
                    var plainDbKey = _protectionService.Unprotect(dbConfig.ApiKey);
                    var dbSource = _protectionService.IsProtected(dbConfig.ApiKey)
                        ? SourceDatabaseEncrypted
                        : SourceDatabaseLegacy;
                    return (plainDbKey, dbSource, false, storageStatus);
                }
                return (string.Empty, SourceNone, false, storageStatus);
            }

            // Mode: auto (environment takes precedence if present, else database)
            if (!string.IsNullOrWhiteSpace(envKey))
            {
                return (envKey, envSource, true, storageStatus);
            }

            if (dbConfig != null && !string.IsNullOrWhiteSpace(dbConfig.ApiKey))
            {
                var plainDbKey = _protectionService.Unprotect(dbConfig.ApiKey);
                var dbSource = _protectionService.IsProtected(dbConfig.ApiKey)
                    ? SourceDatabaseEncrypted
                    : SourceDatabaseLegacy;
                return (plainDbKey, dbSource, false, storageStatus);
            }

            return (string.Empty, SourceNone, false, storageStatus);
        }

        public AIConfiguration GetConfiguration()
        {
            var raw = GetRawDatabaseConfiguration();
            var resolved = ResolveCredential();

            return new AIConfiguration
            {
                Id = raw.Id,
                Provider = raw.Provider,
                Protocol = raw.Protocol,
                BaseUrl = raw.BaseUrl,
                ApiKey = resolved.Key, // Resolved plaintext key for internal runtime use
                Model = raw.Model,
                Enabled = raw.Enabled,
                Temperature = raw.Temperature,
                MaxTokens = raw.MaxTokens,
                CredentialMode = raw.CredentialMode
            };
        }

        public AIConfiguration GetRawDatabaseConfiguration()
        {
            if (_fileDb.AIConfigurations.TryGetValue("default", out var configuration))
            {
                return configuration;
            }

            var defaultConfig = new AIConfiguration
            {
                Id = "default",
                Provider = "OpenAI-Compatible",
                Protocol = "openai-chat-completions",
                BaseUrl = "https://api.openai.com/v1/",
                Model = "gpt-4o-mini",
                Enabled = true,
                Temperature = 0.7,
                MaxTokens = 1000,
                CredentialMode = "auto"
            };

            _fileDb.AIConfigurations["default"] = defaultConfig;
            return defaultConfig;
        }

        public void SaveConfiguration(AIConfiguration updatedConfig, string? rawApiKey, bool clearApiKey = false)
        {
            if (updatedConfig == null)
            {
                throw new ArgumentNullException(nameof(updatedConfig));
            }

            var existing = GetRawDatabaseConfiguration();

            string effectiveStoredApiKey;
            if (clearApiKey)
            {
                effectiveStoredApiKey = string.Empty;
            }
            else if (!string.IsNullOrWhiteSpace(rawApiKey))
            {
                // Protect new secret at rest with Data Protection
                effectiveStoredApiKey = _protectionService.Protect(rawApiKey.Trim());
            }
            else
            {
                // Preserve existing stored key (whether encrypted or legacy)
                effectiveStoredApiKey = existing.ApiKey;
            }

            bool connectionParamsChanged =
                !string.Equals(existing.Provider, updatedConfig.Provider, StringComparison.Ordinal) ||
                !string.Equals(existing.Protocol, updatedConfig.Protocol, StringComparison.Ordinal) ||
                !string.Equals(existing.BaseUrl, updatedConfig.BaseUrl, StringComparison.Ordinal) ||
                !string.Equals(existing.Model, updatedConfig.Model, StringComparison.Ordinal) ||
                !string.Equals(existing.ApiKey, effectiveStoredApiKey, StringComparison.Ordinal) ||
                !string.Equals(existing.CredentialMode, updatedConfig.CredentialMode, StringComparison.OrdinalIgnoreCase);

            var toSave = new AIConfiguration
            {
                Id = "default",
                Provider = updatedConfig.Provider.Trim(),
                Protocol = string.IsNullOrWhiteSpace(updatedConfig.Protocol) ? "openai-chat-completions" : updatedConfig.Protocol.Trim(),
                BaseUrl = updatedConfig.BaseUrl.Trim(),
                Model = updatedConfig.Model.Trim(),
                ApiKey = effectiveStoredApiKey,
                Enabled = updatedConfig.Enabled,
                Temperature = updatedConfig.Temperature,
                MaxTokens = updatedConfig.MaxTokens,
                CredentialMode = string.IsNullOrWhiteSpace(updatedConfig.CredentialMode) ? "auto" : updatedConfig.CredentialMode.Trim().ToLowerInvariant()
            };

            _fileDb.AIConfigurations["default"] = toSave;
            _fileDb.Save();

            // Synchronize to authoritative Registry
            SyncToRegistry(toSave, effectiveStoredApiKey);

            if (connectionParamsChanged)
            {
                InvalidateHealthStatus("Cấu hình kết nối AI vừa thay đổi, chưa kiểm tra kết nối với upstream.");
            }
        }

        private void SyncToRegistry(AIConfiguration config, string storedApiKey)
        {
            if (_providerRegistry == null || _modelRegistry == null) return;
            try
            {
                var existingProvider = _providerRegistry.GetProvider("default");
                if (existingProvider != null)
                {
                    existingProvider.DisplayName = config.Provider;
                    existingProvider.Protocol = config.Protocol;
                    existingProvider.BaseUrl = config.BaseUrl;
                    existingProvider.StoredApiKey = storedApiKey;
                    existingProvider.CredentialMode = config.CredentialMode;
                    existingProvider.Enabled = config.Enabled;
                    existingProvider.UpdatedAt = DateTime.UtcNow;
                }

                var existingModel = _modelRegistry.GetModel("default");
                if (existingModel != null)
                {
                    existingModel.DisplayName = config.Model;
                    existingModel.UpstreamModelId = config.Model;
                    existingModel.DefaultTemperature = config.Temperature;
                    existingModel.DefaultMaxTokens = config.MaxTokens;
                    existingModel.Enabled = config.Enabled;
                    existingModel.UpdatedAt = DateTime.UtcNow;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AIConfigurationService] Notice: Could not sync to registry: {ex.Message}");
            }
        }

        public void InvalidateHealthStatus(string reason = "Cấu hình AI vừa được cập nhật, chưa kiểm tra kết nối với upstream.")
        {
            lock (_healthLock)
            {
                _configGeneration++;
                _lastReadinessState = StateNotChecked;
                _lastCheckedAt = null;
                _lastHealthMessage = reason;
                _lastUpstreamStatusCode = null;
                _lastLatencyMs = null;
                _lastErrorCategory = null;
            }
        }

        public bool IsConfigured()
        {
            var configuration = GetConfiguration();
            return configuration.Enabled
                && !string.IsNullOrWhiteSpace(configuration.Provider)
                && !string.IsNullOrWhiteSpace(configuration.BaseUrl)
                && !string.IsNullOrWhiteSpace(configuration.Model)
                && !string.IsNullOrWhiteSpace(configuration.ApiKey);
        }

        public AIHealthStatus GetHealthStatus()
        {
            lock (_healthLock)
            {
                var resolved = ResolveCredential();
                if (string.IsNullOrWhiteSpace(resolved.Key))
                {
                    return new AIHealthStatus
                    {
                        State = StateNotConfigured,
                        CredentialSource = SourceNone,
                        IsEnvironmentManaged = false,
                        CredentialStorageStatus = resolved.StorageStatus,
                        LastCheckedAt = null,
                        Message = "Chưa cấu hình API key từ bất kỳ nguồn nào.",
                        StatusCode = null,
                        LatencyMs = null,
                        ErrorCategory = "NoApiKey"
                    };
                }

                if (_lastCheckedAt == null)
                {
                    return new AIHealthStatus
                    {
                        State = StateNotChecked,
                        CredentialSource = resolved.Source,
                        IsEnvironmentManaged = resolved.IsEnvironmentManaged,
                        CredentialStorageStatus = resolved.StorageStatus,
                        LastCheckedAt = null,
                        Message = _lastHealthMessage,
                        StatusCode = null,
                        LatencyMs = null,
                        ErrorCategory = null
                    };
                }

                return new AIHealthStatus
                {
                    State = _lastReadinessState,
                    CredentialSource = resolved.Source,
                    IsEnvironmentManaged = resolved.IsEnvironmentManaged,
                    CredentialStorageStatus = resolved.StorageStatus,
                    LastCheckedAt = _lastCheckedAt,
                    Message = _lastHealthMessage,
                    StatusCode = _lastUpstreamStatusCode,
                    LatencyMs = _lastLatencyMs,
                    ErrorCategory = _lastErrorCategory
                };
            }
        }

        public bool RecordHealthCheckResult(long probeGeneration, AIHealthStatus status)
        {
            if (status == null)
            {
                return false;
            }

            lock (_healthLock)
            {
                if (probeGeneration != _configGeneration)
                {
                    // Stale probe from an older configuration generation! Ignore so it does not overwrite current state.
                    return false;
                }

                _lastReadinessState = status.State;
                _lastCheckedAt = status.LastCheckedAt ?? DateTime.UtcNow;
                _lastHealthMessage = status.Message;
                _lastUpstreamStatusCode = status.StatusCode;
                _lastLatencyMs = status.LatencyMs;
                _lastErrorCategory = status.ErrorCategory;
                return true;
            }
        }
    }
}