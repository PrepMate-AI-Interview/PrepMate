using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using backend.Models;
using backend.Services.Security;

namespace backend.Services.AI
{
    public class ProviderRegistryService : IProviderRegistry
    {
        private static readonly Regex IdRegex = new(@"^[a-zA-Z0-9_\-]{2,50}$", RegexOptions.Compiled);
        private readonly FileDb _fileDb;
        private readonly ICredentialProtectionService _protectionService;
        private readonly IConfigurationVersionService _versionService;
        private readonly object _syncLock = new();

        public ProviderRegistryService(
            FileDb fileDb,
            ICredentialProtectionService protectionService,
            IConfigurationVersionService versionService)
        {
            _fileDb = fileDb ?? throw new ArgumentNullException(nameof(fileDb));
            _protectionService = protectionService ?? throw new ArgumentNullException(nameof(protectionService));
            _versionService = versionService ?? throw new ArgumentNullException(nameof(versionService));

            EnsureDefaultProjected();
        }

        private void EnsureDefaultProjected()
        {
            lock (_syncLock)
            {
                if (_fileDb.ProviderConnections.Count == 0 && _fileDb.AIConfigurations.TryGetValue("default", out var legacyDefault))
                {
                    // Deterministically project the legacy default configuration as the initial provider record
                    var provider = new ProviderConnection
                    {
                        Id = "default",
                        DisplayName = string.IsNullOrWhiteSpace(legacyDefault.Provider) ? "Default Provider" : legacyDefault.Provider,
                        Protocol = string.IsNullOrWhiteSpace(legacyDefault.Protocol) ? "openai-chat-completions" : legacyDefault.Protocol,
                        BaseUrl = legacyDefault.BaseUrl,
                        CredentialSlotId = "slot:default",
                        StoredApiKey = legacyDefault.ApiKey ?? string.Empty,
                        CredentialMode = string.IsNullOrWhiteSpace(legacyDefault.CredentialMode) ? "auto" : legacyDefault.CredentialMode,
                        Enabled = legacyDefault.Enabled,
                        TimeoutSeconds = 60,
                        MaxRetries = 1,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    var ver = _versionService.RecordVersion("Provider", "default", provider, "Projected from legacy default configuration");
                    provider.CurrentVersionId = ver.VersionId;

                    _fileDb.ProviderConnections["default"] = provider;
                }
            }
        }

        public static void ValidateBaseUrl(string rawUrl)
        {
            if (string.IsNullOrWhiteSpace(rawUrl))
            {
                throw new ArgumentException("Base URL cannot be empty.", nameof(rawUrl));
            }

            if (!Uri.TryCreate(rawUrl.Trim(), UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                throw new ArgumentException("Base URL must be a valid absolute URL using HTTP or HTTPS protocol.", nameof(rawUrl));
            }

            if (uri.Scheme == Uri.UriSchemeHttp && !OpenAIChatCompletionsAdapter.IsLoopbackOrLocalhost(uri))
            {
                throw new ArgumentException("Insecure HTTP protocol is prohibited for remote endpoints. HTTPS is required.", nameof(rawUrl));
            }
        }

        public static void ValidateIdentifier(string id, string fieldName = "Id")
        {
            if (string.IsNullOrWhiteSpace(id) || !IdRegex.IsMatch(id.Trim()))
            {
                throw new ArgumentException($"{fieldName} must be 2 to 50 characters long and contain only alphanumeric characters, dashes, or underscores.", fieldName);
            }
        }

        public IEnumerable<ProviderConnection> GetAllProviders()
        {
            EnsureDefaultProjected();
            return _fileDb.ProviderConnections.Values.OrderBy(p => p.Id).ToList();
        }

        public ProviderConnection? GetProvider(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return null;
            }

            EnsureDefaultProjected();
            _fileDb.ProviderConnections.TryGetValue(id.Trim(), out var provider);
            return provider;
        }

        public ProviderConnection CreateProvider(CreateProviderConnectionRequest request)
        {
            if (request == null)
            {
                throw new ArgumentNullException(nameof(request));
            }

            ValidateIdentifier(request.Id, nameof(request.Id));
            string cleanId = request.Id.Trim().ToLowerInvariant();

            if (string.IsNullOrWhiteSpace(request.DisplayName))
            {
                throw new ArgumentException("DisplayName cannot be empty.", nameof(request.DisplayName));
            }

            ValidateBaseUrl(request.BaseUrl);

            string protocol = string.IsNullOrWhiteSpace(request.Protocol)
                ? "openai-chat-completions"
                : request.Protocol.Trim().ToLowerInvariant();

            if (protocol != "openai-chat-completions")
            {
                throw new ArgumentException($"API Protocol '{request.Protocol}' is unsupported. Currently supported: 'openai-chat-completions'.", nameof(request.Protocol));
            }

            string credMode = string.IsNullOrWhiteSpace(request.CredentialMode)
                ? "auto"
                : request.CredentialMode.Trim().ToLowerInvariant();

            if (credMode != "auto" && credMode != "environment" && credMode != "admin")
            {
                throw new ArgumentException("CredentialMode must be 'auto', 'environment', or 'admin'.", nameof(request.CredentialMode));
            }

            if (request.TimeoutSeconds < 5 || request.TimeoutSeconds > 300)
            {
                throw new ArgumentException("TimeoutSeconds must be between 5 and 300 seconds.", nameof(request.TimeoutSeconds));
            }

            if (request.MaxRetries < 0 || request.MaxRetries > 5)
            {
                throw new ArgumentException("MaxRetries must be between 0 and 5.", nameof(request.MaxRetries));
            }

            if (request.RateLimitRpm.HasValue && request.RateLimitRpm.Value <= 0)
            {
                throw new ArgumentException("RateLimitRpm must be a positive integer.", nameof(request.RateLimitRpm));
            }

            lock (_syncLock)
            {
                if (_fileDb.ProviderConnections.ContainsKey(cleanId))
                {
                    throw new InvalidOperationException($"Provider connection with ID '{cleanId}' already exists.");
                }

                string storedKey = string.Empty;
                if (!string.IsNullOrWhiteSpace(request.ApiKey))
                {
                    storedKey = _protectionService.Protect(request.ApiKey.Trim());
                }

                var provider = new ProviderConnection
                {
                    Id = cleanId,
                    DisplayName = request.DisplayName.Trim(),
                    Protocol = protocol,
                    BaseUrl = request.BaseUrl.Trim().TrimEnd('/') + "/",
                    CredentialSlotId = $"slot:{cleanId}",
                    StoredApiKey = storedKey,
                    CredentialMode = credMode,
                    Enabled = request.Enabled,
                    TimeoutSeconds = request.TimeoutSeconds,
                    MaxRetries = request.MaxRetries,
                    RateLimitRpm = request.RateLimitRpm,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var version = _versionService.RecordVersion("Provider", cleanId, provider, "Created provider connection");
                provider.CurrentVersionId = version.VersionId;

                _fileDb.ProviderConnections[cleanId] = provider;
                return provider;
            }
        }

        public ProviderConnection UpdateProvider(string id, UpdateProviderConnectionRequest request)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("Id cannot be empty.", nameof(id));
            }
            if (request == null)
            {
                throw new ArgumentNullException(nameof(request));
            }

            string cleanId = id.Trim().ToLowerInvariant();

            if (string.IsNullOrWhiteSpace(request.DisplayName))
            {
                throw new ArgumentException("DisplayName cannot be empty.", nameof(request.DisplayName));
            }

            ValidateBaseUrl(request.BaseUrl);

            string protocol = string.IsNullOrWhiteSpace(request.Protocol)
                ? "openai-chat-completions"
                : request.Protocol.Trim().ToLowerInvariant();

            if (protocol != "openai-chat-completions")
            {
                throw new ArgumentException($"API Protocol '{request.Protocol}' is unsupported. Currently supported: 'openai-chat-completions'.", nameof(request.Protocol));
            }

            string credMode = string.IsNullOrWhiteSpace(request.CredentialMode)
                ? "auto"
                : request.CredentialMode.Trim().ToLowerInvariant();

            if (credMode != "auto" && credMode != "environment" && credMode != "admin")
            {
                throw new ArgumentException("CredentialMode must be 'auto', 'environment', or 'admin'.", nameof(request.CredentialMode));
            }

            if (request.TimeoutSeconds < 5 || request.TimeoutSeconds > 300)
            {
                throw new ArgumentException("TimeoutSeconds must be between 5 and 300 seconds.", nameof(request.TimeoutSeconds));
            }

            if (request.MaxRetries < 0 || request.MaxRetries > 5)
            {
                throw new ArgumentException("MaxRetries must be between 0 and 5.", nameof(request.MaxRetries));
            }

            if (request.RateLimitRpm.HasValue && request.RateLimitRpm.Value <= 0)
            {
                throw new ArgumentException("RateLimitRpm must be a positive integer.", nameof(request.RateLimitRpm));
            }

            lock (_syncLock)
            {
                if (!_fileDb.ProviderConnections.TryGetValue(cleanId, out var existing))
                {
                    throw new KeyNotFoundException($"Provider connection with ID '{cleanId}' was not found.");
                }

                string effectiveApiKey;
                if (request.ClearApiKey)
                {
                    effectiveApiKey = string.Empty;
                }
                else if (!string.IsNullOrWhiteSpace(request.ApiKey))
                {
                    effectiveApiKey = _protectionService.Protect(request.ApiKey.Trim());
                }
                else
                {
                    effectiveApiKey = existing.StoredApiKey;
                }

                string normalizedBaseUrl = request.BaseUrl.Trim().TrimEnd('/') + "/";

                bool routingParamsChanged =
                    !string.Equals(existing.Protocol, protocol, StringComparison.Ordinal) ||
                    !string.Equals(existing.BaseUrl, normalizedBaseUrl, StringComparison.Ordinal) ||
                    !string.Equals(existing.StoredApiKey, effectiveApiKey, StringComparison.Ordinal) ||
                    !string.Equals(existing.CredentialMode, credMode, StringComparison.OrdinalIgnoreCase) ||
                    existing.TimeoutSeconds != request.TimeoutSeconds;

                existing.DisplayName = request.DisplayName.Trim();
                existing.Protocol = protocol;
                existing.BaseUrl = normalizedBaseUrl;
                existing.StoredApiKey = effectiveApiKey;
                existing.CredentialMode = credMode;
                existing.Enabled = request.Enabled;
                existing.TimeoutSeconds = request.TimeoutSeconds;
                existing.MaxRetries = request.MaxRetries;
                existing.RateLimitRpm = request.RateLimitRpm;
                existing.UpdatedAt = DateTime.UtcNow;

                if (routingParamsChanged)
                {
                    // Copy-On-Write configuration versioning: Create a new immutable version record
                    var version = _versionService.RecordVersion("Provider", cleanId, existing, "Updated provider connection routing parameters");
                    existing.CurrentVersionId = version.VersionId;
                }

                _fileDb.ProviderConnections[cleanId] = existing;
                return existing;
            }
        }

        public bool DeleteProvider(string id, out string? errorMessage)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                errorMessage = "Provider ID cannot be empty.";
                return false;
            }

            string cleanId = id.Trim().ToLowerInvariant();

            lock (_syncLock)
            {
                if (!_fileDb.ProviderConnections.TryGetValue(cleanId, out _))
                {
                    errorMessage = $"Provider connection with ID '{cleanId}' was not found.";
                    return false;
                }

                // Reference protection rule: Reject deletion if any registered models reference this provider!
                var referencingModels = _fileDb.ModelRegistrations.Values
                    .Where(m => string.Equals(m.ProviderConnectionId, cleanId, StringComparison.OrdinalIgnoreCase))
                    .Select(m => m.Id)
                    .ToList();

                if (referencingModels.Count > 0)
                {
                    errorMessage = $"Cannot delete provider connection '{cleanId}' because it is referenced by {referencingModels.Count} model(s): {string.Join(", ", referencingModels)}. Please delete or reassign these models first.";
                    return false;
                }

                // Legacy default protection: Cannot delete the 'default' provider if it is the only configured provider
                if (cleanId == "default" && _fileDb.ProviderConnections.Count == 1)
                {
                    errorMessage = "Cannot delete the default provider connection when it is the only connection configured. Disable it instead.";
                    return false;
                }

                _fileDb.ProviderConnections.TryRemove(cleanId, out _);
                errorMessage = null;
                return true;
            }
        }

        public (string PlaintextKey, string Source, bool IsEnvManaged, string StorageStatus) ResolveCredential(ProviderConnection provider)
        {
            if (provider == null)
            {
                throw new ArgumentNullException(nameof(provider));
            }

            var storageStatus = _protectionService.GetStorageStatus(provider.StoredApiKey);
            var mode = (provider.CredentialMode ?? "auto").ToLowerInvariant();

            string? envKey = null;
            string envSource = "none";

            // Check standard environment variable keys
            var prepmateEnv = Environment.GetEnvironmentVariable("PREPMATE_AI_API_KEY");
            if (!string.IsNullOrWhiteSpace(prepmateEnv))
            {
                envKey = prepmateEnv.Trim();
                envSource = "environment:PREPMATE_AI_API_KEY";
            }
            else
            {
                var vilaoEnv = Environment.GetEnvironmentVariable("VILAO_API_KEY");
                if (!string.IsNullOrWhiteSpace(vilaoEnv))
                {
                    envKey = vilaoEnv.Trim();
                    envSource = "environment:VILAO_API_KEY";
                }
                else
                {
                    var geminiEnv = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
                    if (!string.IsNullOrWhiteSpace(geminiEnv))
                    {
                        envKey = geminiEnv.Trim();
                        envSource = "environment:GEMINI_API_KEY";
                    }
                    else
                    {
                        var openaiEnv = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
                        if (!string.IsNullOrWhiteSpace(openaiEnv))
                        {
                            envKey = openaiEnv.Trim();
                            envSource = "environment:OPENAI_API_KEY";
                        }
                    }
                }
            }

            if (mode == "environment")
            {
                if (!string.IsNullOrWhiteSpace(envKey))
                {
                    return (envKey, envSource, true, storageStatus);
                }
                return (string.Empty, "none", true, storageStatus);
            }

            if (mode == "admin")
            {
                if (!string.IsNullOrWhiteSpace(provider.StoredApiKey))
                {
                    var plain = _protectionService.Unprotect(provider.StoredApiKey);
                    var src = _protectionService.IsProtected(provider.StoredApiKey) ? "admin:encrypted" : "admin:legacy_plaintext";
                    return (plain, src, false, storageStatus);
                }
                return (string.Empty, "none", false, storageStatus);
            }

            // Mode: auto (environment takes precedence if present, else stored encrypted)
            if (!string.IsNullOrWhiteSpace(envKey))
            {
                return (envKey, envSource, true, storageStatus);
            }

            if (!string.IsNullOrWhiteSpace(provider.StoredApiKey))
            {
                var plain = _protectionService.Unprotect(provider.StoredApiKey);
                var src = _protectionService.IsProtected(provider.StoredApiKey) ? "admin:encrypted" : "admin:legacy_plaintext";
                return (plain, src, false, storageStatus);
            }

            return (string.Empty, "none", false, storageStatus);
        }

        public ProviderConnectionDto ToDto(ProviderConnection provider)
        {
            if (provider == null)
            {
                throw new ArgumentNullException(nameof(provider));
            }

            var resolved = ResolveCredential(provider);
            int modelsCount = _fileDb.ModelRegistrations.Values
                .Count(m => string.Equals(m.ProviderConnectionId, provider.Id, StringComparison.OrdinalIgnoreCase));

            return new ProviderConnectionDto
            {
                Id = provider.Id,
                DisplayName = provider.DisplayName,
                Protocol = provider.Protocol,
                BaseUrl = provider.BaseUrl,
                CredentialSlotId = provider.CredentialSlotId,
                CredentialMode = provider.CredentialMode,
                ApiKeyConfigured = !string.IsNullOrWhiteSpace(resolved.PlaintextKey),
                CredentialStorageStatus = resolved.StorageStatus,
                CredentialSource = resolved.Source,
                IsEnvironmentManaged = resolved.IsEnvManaged,
                Enabled = provider.Enabled,
                TimeoutSeconds = provider.TimeoutSeconds,
                MaxRetries = provider.MaxRetries,
                RateLimitRpm = provider.RateLimitRpm,
                CurrentVersionId = provider.CurrentVersionId,
                CreatedAt = provider.CreatedAt,
                UpdatedAt = provider.UpdatedAt,
                RegisteredModelsCount = modelsCount
            };
        }
    }
}
