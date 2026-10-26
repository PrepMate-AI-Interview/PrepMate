using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using backend.Models;
using backend.Models.AI;

namespace backend.Services.AI
{
    public class VilaoModelDiscoveryService : IVilaoModelDiscoveryService
    {
        private readonly HttpClient _httpClient;
        private readonly AIConfigurationService _configurationService;
        private readonly IModelRegistry? _modelRegistry;
        private readonly IAIProviderAdapter _providerAdapter;
        private static readonly object _syncLock = new();
        private static readonly TimeSpan DefaultTtl = TimeSpan.FromMinutes(10);
        private static readonly DiscoveredCatalog _catalog = new();

        public VilaoModelDiscoveryService(
            HttpClient httpClient,
            AIConfigurationService configurationService,
            IModelRegistry? modelRegistry = null,
            IAIProviderAdapter? providerAdapter = null)
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _configurationService = configurationService ?? throw new ArgumentNullException(nameof(configurationService));
            _modelRegistry = modelRegistry;
            _providerAdapter = providerAdapter ?? new OpenAIChatCompletionsAdapter(_httpClient);
        }

        public async Task<DiscoveredCatalog> GetCatalogAsync(bool forceRefresh = false, CancellationToken cancellationToken = default)
        {
            lock (_syncLock)
            {
                bool isCacheValid = _catalog.LastSyncAt.HasValue &&
                                    (DateTime.UtcNow - _catalog.LastSyncAt.Value < DefaultTtl) &&
                                    _catalog.SyncStatus == "SUCCESS";

                if (isCacheValid && !forceRefresh)
                {
                    return CloneCatalog(_catalog);
                }
            }

            return await RefreshInternalAsync(cancellationToken);
        }

        public async Task<DiscoveredCatalogDto> GetCatalogDtoAsync(bool forceRefresh = false, CancellationToken cancellationToken = default)
        {
            var catalog = await GetCatalogAsync(forceRefresh, cancellationToken);
            return ToDto(catalog);
        }

        public async Task<DiscoveredCatalogDto> RefreshAsync(CancellationToken cancellationToken = default)
        {
            var catalog = await RefreshInternalAsync(cancellationToken);
            return ToDto(catalog);
        }

        public async Task<AIHealthStatus> VerifyAliasInferenceAsync(CancellationToken cancellationToken = default)
        {
            var config = _configurationService.GetConfiguration();
            var resolved = _configurationService.ResolveCredential();
            var probeGen = _configurationService.CurrentGeneration;

            var testConfig = new AIConfiguration
            {
                Id = "prepmate-alias-probe",
                Provider = "Vilao AI Combo Root",
                Protocol = "openai-chat-completions",
                BaseUrl = config.BaseUrl,
                Model = ComboRootConfiguration.CanonicalAlias, // "PrepMate"
                Enabled = true,
                Temperature = 0.1,
                MaxTokens = 5
            };

            return await _providerAdapter.CheckHealthAsync(
                testConfig,
                resolved.Key,
                resolved.Source,
                resolved.IsEnvironmentManaged,
                resolved.StorageStatus,
                probeGen,
                cancellationToken
            );
        }

        public List<DiscoveredModel> ParseModelsResponse(string jsonContent)
        {
            if (string.IsNullOrWhiteSpace(jsonContent))
            {
                return new List<DiscoveredModel>();
            }

            var results = new List<DiscoveredModel>();

            using var doc = JsonDocument.Parse(jsonContent);
            var root = doc.RootElement;

            JsonElement modelsArray;
            if (root.ValueKind == JsonValueKind.Array)
            {
                modelsArray = root;
            }
            else if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var dataElem) && dataElem.ValueKind == JsonValueKind.Array)
            {
                modelsArray = dataElem;
            }
            else if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("models", out var modelsElem) && modelsElem.ValueKind == JsonValueKind.Array)
            {
                modelsArray = modelsElem;
            }
            else
            {
                return results;
            }

            foreach (var item in modelsArray.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object) continue;

                string id = "";
                if (item.TryGetProperty("id", out var idElem) && idElem.ValueKind == JsonValueKind.String)
                {
                    id = idElem.GetString() ?? "";
                }

                if (string.IsNullOrWhiteSpace(id)) continue;

                string ownedBy = "";
                if (item.TryGetProperty("owned_by", out var ownedElem) && ownedElem.ValueKind == JsonValueKind.String)
                {
                    ownedBy = ownedElem.GetString() ?? "";
                }

                long? created = null;
                if (item.TryGetProperty("created", out var createdElem) && createdElem.TryGetInt64(out var cVal))
                {
                    created = cVal;
                }

                bool isAlias = id.Equals(ComboRootConfiguration.CanonicalAlias, StringComparison.OrdinalIgnoreCase);

                results.Add(new DiscoveredModel
                {
                    Id = id,
                    DisplayName = id,
                    OwnedBy = ownedBy,
                    Created = created,
                    IsAlias = isAlias,
                    SupportsInference = true
                });
            }

            return results;
        }

        private async Task<DiscoveredCatalog> RefreshInternalAsync(CancellationToken cancellationToken)
        {
            var config = _configurationService.GetConfiguration();
            var resolved = _configurationService.ResolveCredential();

            string rawUrl = config.BaseUrl;
            if (string.IsNullOrWhiteSpace(rawUrl))
            {
                rawUrl = "https://api.vilao.ai/v1";
            }

            var normalizedBase = rawUrl.TrimEnd('/') + "/";
            var endpointUri = new Uri(new Uri(normalizedBase), "models");

            lock (_syncLock)
            {
                _catalog.BaseUrl = rawUrl;
                _catalog.ProviderName = config.Provider;
                _catalog.Alias = ComboRootConfiguration.CanonicalAlias;
            }

            if (string.IsNullOrWhiteSpace(resolved.Key))
            {
                lock (_syncLock)
                {
                    _catalog.LastSyncAt = DateTime.UtcNow;
                    _catalog.SyncStatus = "FAILED";
                    _catalog.LastStatusCode = 503;
                    _catalog.LastError = "API key chưa được cấu hình. Vui lòng cung cấp API key để đồng bộ danh mục model.";
                    _catalog.AliasStatus = "UNVERIFIED";
                    return CloneCatalog(_catalog);
                }
            }

            using var request = new HttpRequestMessage(HttpMethod.Get, endpointUri);
            request.Headers.Add("Authorization", $"Bearer {resolved.Key}");
            request.Headers.Add("x-api-key", resolved.Key);
            request.Headers.Add("Accept", "application/json");

            try
            {
                var response = await _httpClient.SendAsync(request, cancellationToken);
                var content = await response.Content.ReadAsStringAsync(cancellationToken);

                lock (_syncLock)
                {
                    _catalog.LastSyncAt = DateTime.UtcNow;
                    _catalog.LastStatusCode = (int)response.StatusCode;

                    if (!response.IsSuccessStatusCode)
                    {
                        _catalog.SyncStatus = "FAILED";
                        _catalog.LastError = SanitizeErrorMessage(content, (int)response.StatusCode);
                        // Preserve existing catalog without clearing valid cached models!
                        return CloneCatalog(_catalog);
                    }

                    var parsedModels = ParseModelsResponse(content);

                    _catalog.SyncStatus = "SUCCESS";
                    _catalog.LastError = null;
                    _catalog.Models = parsedModels;

                    // Detect alias status
                    bool hasAlias = parsedModels.Any(m => m.IsAlias);
                    _catalog.AliasStatus = hasAlias ? "DISCOVERED" : "UNPUBLISHED_CONFIGURED";

                    // Synchronize discovered models into ModelRegistry
                    SyncToModelRegistry(parsedModels);

                    return CloneCatalog(_catalog);
                }
            }
            catch (Exception ex)
            {
                lock (_syncLock)
                {
                    _catalog.LastSyncAt = DateTime.UtcNow;
                    _catalog.SyncStatus = "FAILED";
                    _catalog.LastStatusCode = 500;
                    _catalog.LastError = SanitizeErrorMessage(ex.Message, 500);
                    // Preserve existing catalog without wiping
                    return CloneCatalog(_catalog);
                }
            }
        }

        private void SyncToModelRegistry(List<DiscoveredModel> models)
        {
            if (_modelRegistry == null) return;

            foreach (var m in models)
            {
                try
                {
                    var existing = _modelRegistry.GetModel(m.Id);
                    if (existing == null)
                    {
                        _modelRegistry.CreateModel(new CreateModelRegistrationRequest
                        {
                            Id = m.Id,
                            DisplayName = m.DisplayName,
                            ProviderConnectionId = "default",
                            UpstreamModelId = m.Id,
                            SupportedTasks = AITaskType.AllTasks.ToList(),
                            MaxContextTokens = 128000,
                            DefaultMaxTokens = 1000,
                            DefaultTemperature = 0.7,
                            SupportsStructuredJson = true,
                            Enabled = true
                        });
                    }
                }
                catch
                {
                    // Ignore registration collisions for existing projected models
                }
            }
        }

        private static string SanitizeErrorMessage(string raw, int statusCode)
        {
            if (string.IsNullOrWhiteSpace(raw))
            {
                return $"Upstream API trả về HTTP {statusCode}.";
            }

            try
            {
                using var doc = JsonDocument.Parse(raw);
                if (doc.RootElement.TryGetProperty("error", out var errElem))
                {
                    if (errElem.TryGetProperty("message", out var msgElem))
                    {
                        return msgElem.GetString() ?? raw;
                    }
                }
            }
            catch { }

            // Redact any possible token patterns
            var sanitized = System.Text.RegularExpressions.Regex.Replace(raw, @"(sk-[a-zA-Z0-9_\-]{8,})", "sk-***");
            return sanitized.Length > 200 ? sanitized.Substring(0, 200) + "..." : sanitized;
        }

        private DiscoveredCatalogDto ToDto(DiscoveredCatalog catalog)
        {
            var resolved = _configurationService.ResolveCredential();
            return new DiscoveredCatalogDto
            {
                ProviderName = catalog.ProviderName,
                BaseUrl = catalog.BaseUrl,
                SyncStatus = catalog.SyncStatus,
                LastSyncAt = catalog.LastSyncAt?.ToString("o"),
                LastStatusCode = catalog.LastStatusCode,
                LastError = catalog.LastError,
                Alias = catalog.Alias,
                AliasStatus = catalog.AliasStatus,
                TotalModelsCount = catalog.Models.Count,
                ApiKeyConfigured = !string.IsNullOrWhiteSpace(resolved.Key),
                CredentialSource = resolved.Source,
                Models = catalog.Models.Select(m => new DiscoveredModelDto
                {
                    Id = m.Id,
                    DisplayName = m.DisplayName,
                    OwnedBy = m.OwnedBy,
                    Created = m.Created,
                    IsAlias = m.IsAlias,
                    SupportsInference = m.SupportsInference
                }).ToList()
            };
        }

        private static DiscoveredCatalog CloneCatalog(DiscoveredCatalog c)
        {
            return new DiscoveredCatalog
            {
                ProviderName = c.ProviderName,
                BaseUrl = c.BaseUrl,
                SyncStatus = c.SyncStatus,
                LastSyncAt = c.LastSyncAt,
                LastStatusCode = c.LastStatusCode,
                LastError = c.LastError,
                Alias = c.Alias,
                AliasStatus = c.AliasStatus,
                Models = c.Models.Select(m => new DiscoveredModel
                {
                    Id = m.Id,
                    DisplayName = m.DisplayName,
                    OwnedBy = m.OwnedBy,
                    Created = m.Created,
                    IsAlias = m.IsAlias,
                    SupportsInference = m.SupportsInference,
                    Object = m.Object
                }).ToList()
            };
        }
    }
}
