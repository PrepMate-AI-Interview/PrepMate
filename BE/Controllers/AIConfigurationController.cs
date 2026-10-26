using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Models;
using backend.Services;
using backend.Services.AI;
using backend.Models.AI;

namespace backend.Controllers
{
    [Authorize(Roles = "admin")]
    [ApiController]
    [Route("api/admin/ai")]
    public class AIConfigurationController : ControllerBase
    {
        private readonly AIConfigurationService _configurationService;
        private readonly GeminiService _geminiService;
        private readonly IProviderRegistry? _providerRegistry;
        private readonly IModelRegistry? _modelRegistry;
        private readonly IConfigurationVersionService? _versionService;
        private readonly IComboRootService? _comboRootService;
        private readonly IVilaoModelDiscoveryService? _discoveryService;

        public AIConfigurationController(
            AIConfigurationService configurationService,
            GeminiService geminiService,
            IProviderRegistry? providerRegistry = null,
            IModelRegistry? modelRegistry = null,
            IConfigurationVersionService? versionService = null,
            IComboRootService? comboRootService = null,
            IVilaoModelDiscoveryService? discoveryService = null)
        {
            _configurationService = configurationService ?? throw new ArgumentNullException(nameof(configurationService));
            _geminiService = geminiService ?? throw new ArgumentNullException(nameof(geminiService));
            _providerRegistry = providerRegistry;
            _modelRegistry = modelRegistry;
            _versionService = versionService;
            _comboRootService = comboRootService;
            _discoveryService = discoveryService;
        }

        [HttpGet("config")]
        public IActionResult GetConfiguration()
        {
            var config = _configurationService.GetConfiguration();
            var resolved = _configurationService.ResolveCredential();

            return Ok(new
            {
                provider = config.Provider,
                protocol = config.Protocol,
                baseUrl = config.BaseUrl,
                model = config.Model,
                enabled = config.Enabled,
                temperature = config.Temperature,
                maxTokens = config.MaxTokens,
                credentialMode = config.CredentialMode,
                apiKeyConfigured = !string.IsNullOrWhiteSpace(resolved.Key),
                credentialSource = resolved.Source,
                isEnvironmentManaged = resolved.IsEnvironmentManaged,
                credentialStorageStatus = resolved.StorageStatus
            });
        }

        [HttpGet("tasks")]
        public IActionResult GetSupportedTasks()
        {
            return Ok(AITaskType.AllTasks);
        }

        [HttpGet("health")]
        public IActionResult GetHealth()
        {
            var health = _configurationService.GetHealthStatus();
            var config = _configurationService.GetConfiguration();

            return Ok(new
            {
                state = health.State,
                credentialSource = health.CredentialSource,
                isEnvironmentManaged = health.IsEnvironmentManaged,
                credentialStorageStatus = health.CredentialStorageStatus,
                lastCheckedAt = health.LastCheckedAt?.ToString("o"),
                message = health.Message,
                provider = config.Provider,
                model = config.Model,
                statusCode = health.StatusCode,
                latencyMs = health.LatencyMs,
                errorCategory = health.ErrorCategory
            });
        }

        [HttpPost("health-check")]
        public async Task<IActionResult> TriggerHealthCheck(CancellationToken cancellationToken)
        {
            var health = await _geminiService.CheckHealthAsync(cancellationToken);
            var config = _configurationService.GetConfiguration();

            return Ok(new
            {
                state = health.State,
                credentialSource = health.CredentialSource,
                isEnvironmentManaged = health.IsEnvironmentManaged,
                credentialStorageStatus = health.CredentialStorageStatus,
                lastCheckedAt = health.LastCheckedAt?.ToString("o"),
                message = health.Message,
                provider = config.Provider,
                model = config.Model,
                statusCode = health.StatusCode,
                latencyMs = health.LatencyMs,
                errorCategory = health.ErrorCategory
            });
        }

        [HttpPut("config")]
        [HttpPost("config")]
        public IActionResult UpdateConfiguration(
            [FromBody] AIConfigurationRequest request)
        {
            if (request == null)
            {
                return BadRequest(new
                {
                    error = "Dữ liệu cấu hình AI không được để trống."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Provider))
            {
                return BadRequest(new
                {
                    error = "Provider không được để trống."
                });
            }

            var protocol = string.IsNullOrWhiteSpace(request.Protocol)
                ? "openai-chat-completions"
                : request.Protocol.Trim().ToLowerInvariant();

            if (protocol != "openai-chat-completions")
            {
                return BadRequest(new
                {
                    error = $"Giao thức API '{request.Protocol}' chưa được hỗ trợ. Hiện tại hỗ trợ: 'openai-chat-completions'."
                });
            }

            if (string.IsNullOrWhiteSpace(request.BaseUrl))
            {
                return BadRequest(new
                {
                    error = "Base URL không được để trống."
                });
            }

            if (!Uri.TryCreate(request.BaseUrl.Trim(), UriKind.Absolute, out var uri) || 
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                return BadRequest(new
                {
                    error = "Base URL phải là một URL tuyệt đối hợp lệ với giao thức http hoặc https."
                });
            }

            // Security constraint: Prohibit HTTP for remote hosts in production
            if (uri.Scheme == Uri.UriSchemeHttp && !OpenAIChatCompletionsAdapter.IsLoopbackOrLocalhost(uri))
            {
                return BadRequest(new
                {
                    error = "Giao thức HTTP không an toàn cho endpoint máy chủ từ xa. Vui lòng sử dụng HTTPS."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Model))
            {
                return BadRequest(new
                {
                    error = "Model không được để trống."
                });
            }

            if (request.Temperature < 0.0 || request.Temperature > 2.0)
            {
                return BadRequest(new
                {
                    error = "Temperature phải nằm trong khoảng từ 0.0 đến 2.0."
                });
            }

            if (request.MaxTokens < 1 || request.MaxTokens > 32000)
            {
                return BadRequest(new
                {
                    error = "MaxTokens phải nằm trong khoảng từ 1 đến 32000."
                });
            }

            var credMode = string.IsNullOrWhiteSpace(request.CredentialMode)
                ? "auto"
                : request.CredentialMode.Trim().ToLowerInvariant();

            if (credMode != "auto" && credMode != "environment" && credMode != "admin")
            {
                return BadRequest(new
                {
                    error = "CredentialMode không hợp lệ. Chỉ chấp nhận: 'auto', 'environment', hoặc 'admin'."
                });
            }

            var toUpdate = new AIConfiguration
            {
                Id = "default",
                Provider = request.Provider.Trim(),
                Protocol = protocol,
                BaseUrl = request.BaseUrl.Trim(),
                Model = request.Model.Trim(),
                Enabled = request.Enabled,
                Temperature = request.Temperature,
                MaxTokens = request.MaxTokens,
                CredentialMode = credMode
            };

            _configurationService.SaveConfiguration(toUpdate, request.ApiKey, request.ClearApiKey);
            var resolved = _configurationService.ResolveCredential();

            return Ok(new
            {
                message = "Đã cập nhật cấu hình AI.",
                provider = toUpdate.Provider,
                protocol = toUpdate.Protocol,
                baseUrl = toUpdate.BaseUrl,
                model = toUpdate.Model,
                enabled = toUpdate.Enabled,
                temperature = toUpdate.Temperature,
                maxTokens = toUpdate.MaxTokens,
                credentialMode = toUpdate.CredentialMode,
                apiKeyConfigured = !string.IsNullOrWhiteSpace(resolved.Key),
                credentialSource = resolved.Source,
                isEnvironmentManaged = resolved.IsEnvironmentManaged,
                credentialStorageStatus = resolved.StorageStatus
            });
        }

        // =========================================================================
        // PROVIDER REGISTRY ENDPOINTS
        // =========================================================================

        [HttpGet("providers")]
        public IActionResult GetAllProviders()
        {
            if (_providerRegistry == null)
            {
                return StatusCode(503, new { error = "Provider registry service is not available." });
            }

            var providers = _providerRegistry.GetAllProviders();
            var dtos = providers.Select(p => _providerRegistry.ToDto(p)).ToList();
            return Ok(dtos);
        }

        [HttpGet("providers/{id}")]
        public IActionResult GetProvider(string id)
        {
            if (_providerRegistry == null)
            {
                return StatusCode(503, new { error = "Provider registry service is not available." });
            }

            var provider = _providerRegistry.GetProvider(id);
            if (provider == null)
            {
                return NotFound(new { error = $"Provider '{id}' not found." });
            }

            return Ok(_providerRegistry.ToDto(provider));
        }

        [HttpPost("providers")]
        public IActionResult CreateProvider([FromBody] CreateProviderConnectionRequest request)
        {
            if (_providerRegistry == null)
            {
                return StatusCode(503, new { error = "Provider registry service is not available." });
            }

            if (request == null)
            {
                return BadRequest(new { error = "Request body cannot be empty." });
            }

            try
            {
                var created = _providerRegistry.CreateProvider(request);
                var dto = _providerRegistry.ToDto(created);
                return CreatedAtAction(nameof(GetProvider), new { id = created.Id }, dto);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { error = ex.Message });
            }
        }

        [HttpPut("providers/{id}")]
        public IActionResult UpdateProvider(string id, [FromBody] UpdateProviderConnectionRequest request)
        {
            if (_providerRegistry == null)
            {
                return StatusCode(503, new { error = "Provider registry service is not available." });
            }

            if (request == null)
            {
                return BadRequest(new { error = "Request body cannot be empty." });
            }

            try
            {
                var updated = _providerRegistry.UpdateProvider(id, request);
                return Ok(_providerRegistry.ToDto(updated));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpDelete("providers/{id}")]
        public IActionResult DeleteProvider(string id)
        {
            if (_providerRegistry == null)
            {
                return StatusCode(503, new { error = "Provider registry service is not available." });
            }

            bool success = _providerRegistry.DeleteProvider(id, out var errorMessage);
            if (!success)
            {
                if (errorMessage != null && errorMessage.Contains("does not exist", StringComparison.OrdinalIgnoreCase))
                {
                    return NotFound(new { error = errorMessage });
                }
                return Conflict(new { error = errorMessage ?? "Failed to delete provider." });
            }

            return Ok(new { message = $"Provider '{id}' deleted successfully." });
        }

        // =========================================================================
        // MODEL REGISTRY ENDPOINTS
        // =========================================================================

        [HttpGet("models")]
        public IActionResult GetAllModels([FromQuery] string? providerId = null, [FromQuery] string? taskType = null)
        {
            if (_modelRegistry == null)
            {
                return StatusCode(503, new { error = "Model registry service is not available." });
            }

            IEnumerable<ModelRegistration> models;
            if (!string.IsNullOrWhiteSpace(providerId))
            {
                models = _modelRegistry.GetModelsByProvider(providerId);
            }
            else if (!string.IsNullOrWhiteSpace(taskType))
            {
                models = _modelRegistry.GetModelsByTask(taskType);
            }
            else
            {
                models = _modelRegistry.GetAllModels();
            }

            var dtos = models.Select(m => _modelRegistry.ToDto(m)).ToList();
            return Ok(dtos);
        }

        [HttpGet("models/{id}")]
        public IActionResult GetModel(string id)
        {
            if (_modelRegistry == null)
            {
                return StatusCode(503, new { error = "Model registry service is not available." });
            }

            var model = _modelRegistry.GetModel(id);
            if (model == null)
            {
                return NotFound(new { error = $"Model '{id}' not found." });
            }

            return Ok(_modelRegistry.ToDto(model));
        }

        [HttpPost("models")]
        public IActionResult CreateModel([FromBody] CreateModelRegistrationRequest request)
        {
            if (_modelRegistry == null)
            {
                return StatusCode(503, new { error = "Model registry service is not available." });
            }

            if (request == null)
            {
                return BadRequest(new { error = "Request body cannot be empty." });
            }

            try
            {
                var created = _modelRegistry.CreateModel(request);
                var dto = _modelRegistry.ToDto(created);
                return CreatedAtAction(nameof(GetModel), new { id = created.Id }, dto);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { error = ex.Message });
            }
        }

        [HttpPut("models/{id}")]
        public IActionResult UpdateModel(string id, [FromBody] UpdateModelRegistrationRequest request)
        {
            if (_modelRegistry == null)
            {
                return StatusCode(503, new { error = "Model registry service is not available." });
            }

            if (request == null)
            {
                return BadRequest(new { error = "Request body cannot be empty." });
            }

            try
            {
                var updated = _modelRegistry.UpdateModel(id, request);
                return Ok(_modelRegistry.ToDto(updated));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpDelete("models/{id}")]
        public IActionResult DeleteModel(string id)
        {
            if (_modelRegistry == null)
            {
                return StatusCode(503, new { error = "Model registry service is not available." });
            }

            bool success = _modelRegistry.DeleteModel(id, out var errorMessage);
            if (!success)
            {
                if (errorMessage != null && errorMessage.Contains("does not exist", StringComparison.OrdinalIgnoreCase))
                {
                    return NotFound(new { error = errorMessage });
                }
                return Conflict(new { error = errorMessage ?? "Failed to delete model." });
            }

            return Ok(new { message = $"Model '{id}' deleted successfully." });
        }

        // =========================================================================
        // CONFIGURATION VERSION HISTORY ENDPOINT
        // =========================================================================

        [HttpGet("versions/{entityType}/{id}")]
        public IActionResult GetVersionHistory(string entityType, string id)
        {
            if (_versionService == null)
            {
                return StatusCode(503, new { error = "Configuration version service is not available." });
            }

            var versions = _versionService.GetVersionsForEntity(id);
            var dtos = versions.Select(v => new ConfigurationVersionDto
            {
                VersionId = v.VersionId,
                EntityType = v.EntityType,
                LogicalId = v.LogicalId,
                VersionNumber = v.VersionNumber,
                CreatedBy = v.CreatedBy,
                CreatedAt = v.CreatedAt,
                ChangeSummary = v.ChangeSummary
            }).ToList();

            return Ok(dtos);
        }

        // =========================================================================
        // COMBO ROOT ENDPOINTS
        // =========================================================================

        [HttpGet("combo-root")]
        public IActionResult GetComboRoot()
        {
            if (_comboRootService == null)
            {
                return StatusCode(503, new { error = "Combo Root service is not available." });
            }

            var cfg = _comboRootService.GetConfiguration();
            var dtos = cfg.Slots.Select(s => _comboRootService.ToDto(s)).ToList();

            return Ok(new
            {
                alias = cfg.Alias,
                enabled = cfg.Enabled,
                updatedAt = cfg.UpdatedAt,
                totalSlots = dtos.Count,
                activeSlots = dtos.Count(s => s.Enabled),
                slots = dtos
            });
        }

        [HttpGet("combo-root/slots/{slotIndex:int}")]
        public IActionResult GetComboRootSlot(int slotIndex)
        {
            if (_comboRootService == null)
            {
                return StatusCode(503, new { error = "Combo Root service is not available." });
            }

            var slot = _comboRootService.GetSlot(slotIndex);
            if (slot == null)
            {
                return NotFound(new { error = $"API Slot {slotIndex} not found in Combo Root." });
            }

            return Ok(_comboRootService.ToDto(slot));
        }

        [HttpPut("combo-root/slots/{slotIndex:int}")]
        public IActionResult UpdateComboRootSlot(int slotIndex, [FromBody] UpdateComboRootSlotRequest request)
        {
            if (_comboRootService == null)
            {
                return StatusCode(503, new { error = "Combo Root service is not available." });
            }

            if (request == null)
            {
                return BadRequest(new { error = "Request body cannot be empty." });
            }

            try
            {
                var updated = _comboRootService.UpdateSlot(slotIndex, request);
                return Ok(_comboRootService.ToDto(updated));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPost("combo-root/probe/{slotIndex:int?}")]
        public async Task<IActionResult> ProbeComboRoot(int? slotIndex, CancellationToken cancellationToken)
        {
            if (_comboRootService == null)
            {
                return StatusCode(503, new { error = "Combo Root service is not available." });
            }

            if (slotIndex.HasValue && slotIndex.Value > 0)
            {
                try
                {
                    var result = await _comboRootService.ProbeSlotHealthAsync(slotIndex.Value, cancellationToken);
                    return Ok(result);
                }
                catch (KeyNotFoundException ex)
                {
                    return NotFound(new { error = ex.Message });
                }
            }

            var allResults = await _comboRootService.ProbeAllSlotsHealthAsync(cancellationToken);
            return Ok(allResults);
        }

        // =========================================================================
        // DYNAMIC VILAO MODEL DISCOVERY ENDPOINTS
        // =========================================================================

        [HttpGet("discovery/catalog")]
        public async Task<IActionResult> GetDiscoveryCatalog([FromQuery] bool refresh = false, CancellationToken cancellationToken = default)
        {
            if (_discoveryService == null)
            {
                return StatusCode(503, new { error = "Dynamic model discovery service is not available." });
            }

            var catalog = await _discoveryService.GetCatalogDtoAsync(forceRefresh: refresh, cancellationToken);
            return Ok(catalog);
        }

        [HttpPost("discovery/refresh")]
        public async Task<IActionResult> RefreshDiscoveryCatalog(CancellationToken cancellationToken)
        {
            if (_discoveryService == null)
            {
                return StatusCode(503, new { error = "Dynamic model discovery service is not available." });
            }

            var catalog = await _discoveryService.RefreshAsync(cancellationToken);
            return Ok(catalog);
        }

        [HttpPost("discovery/verify-alias")]
        public async Task<IActionResult> VerifyAlias(CancellationToken cancellationToken)
        {
            if (_discoveryService == null)
            {
                return StatusCode(503, new { error = "Dynamic model discovery service is not available." });
            }

            var health = await _discoveryService.VerifyAliasInferenceAsync(cancellationToken);
            return Ok(new
            {
                alias = ComboRootConfiguration.CanonicalAlias,
                state = health.State,
                statusCode = health.StatusCode,
                latencyMs = health.LatencyMs,
                message = health.Message,
                errorCategory = health.ErrorCategory
            });
        }
    }

    public class AIConfigurationRequest
    {
        public string Provider { get; set; } = string.Empty;

        public string Protocol { get; set; } = "openai-chat-completions";

        public string BaseUrl { get; set; } = string.Empty;

        public string? ApiKey { get; set; } = null;

        public bool ClearApiKey { get; set; } = false;

        public string Model { get; set; } = string.Empty;

        public bool Enabled { get; set; } = true;

        public double Temperature { get; set; } = 0.7;

        public int MaxTokens { get; set; } = 1000;

        public string CredentialMode { get; set; } = "auto";
    }
}