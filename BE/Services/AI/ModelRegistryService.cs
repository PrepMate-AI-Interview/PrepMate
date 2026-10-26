using backend.Models.AI;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using backend.Models;

namespace backend.Services.AI
{
    public class ModelRegistryService : IModelRegistry
    {
        private static readonly Regex IdRegex = new(@"^[a-zA-Z0-9_\-]{2,50}$", RegexOptions.Compiled);
        private readonly FileDb _fileDb;
        private readonly IProviderRegistry _providerRegistry;
        private readonly IConfigurationVersionService _versionService;
        private readonly object _syncLock = new();

        public ModelRegistryService(
            FileDb fileDb,
            IProviderRegistry providerRegistry,
            IConfigurationVersionService versionService)
        {
            _fileDb = fileDb ?? throw new ArgumentNullException(nameof(fileDb));
            _providerRegistry = providerRegistry ?? throw new ArgumentNullException(nameof(providerRegistry));
            _versionService = versionService ?? throw new ArgumentNullException(nameof(versionService));

            EnsureDefaultProjected();
        }

        public static readonly HashSet<string> ValidTasks = new(StringComparer.OrdinalIgnoreCase)
        {
            "InterviewIntroduction",
            "QuestionGeneration",
            "AnswerAnalysis",
            "InterviewClosing",
            "ReportGeneration",
            "CvAnalysis",
            "JobRecommendation",
            "CareerRoadmap",
            "GeneralChat",
            "TechnicalAssessment",
            "BehavioralStar",
            "SituationalCase",
            "CandidateQuestion",
            "Closing",
            "IntroductionAnalysis"
        };

        private void EnsureDefaultProjected()
        {
            lock (_syncLock)
            {
                if (_fileDb.ModelRegistrations.Count == 0 && _fileDb.AIConfigurations.TryGetValue("default", out var legacyDefault))
                {
                    // Deterministically project the legacy default model into the registry
                    string upstreamModel = string.IsNullOrWhiteSpace(legacyDefault.Model) ? "gpt-4o-mini" : legacyDefault.Model;

                    var model = new ModelRegistration
                    {
                        Id = "default",
                        DisplayName = upstreamModel,
                        ProviderConnectionId = "default",
                        UpstreamModelId = upstreamModel,
                        SupportedTasks = new List<string>
                        {
                            "QuestionGeneration",
                            "AnswerAnalysis",
                            "InterviewIntroduction",
                            "InterviewClosing",
                            "IntroductionAnalysis",
                            "TechnicalAssessment",
                            "BehavioralStar",
                            "SituationalCase",
                            "CandidateQuestion",
                            "Closing",
                            "ReportGeneration",
                            "CvAnalysis",
                            "JobRecommendation",
                            "CareerRoadmap"
                        },
                        MaxContextTokens = 128000,
                        DefaultMaxTokens = legacyDefault.MaxTokens > 0 ? legacyDefault.MaxTokens : 1000,
                        DefaultTemperature = legacyDefault.Temperature >= 0 ? legacyDefault.Temperature : 0.7,
                        SupportsStructuredJson = true,
                        Enabled = legacyDefault.Enabled,
                        VerificationStatus = "UNTESTED",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    var ver = _versionService.RecordVersion("Model", "default", model, "Projected from legacy default configuration");
                    model.CurrentVersionId = ver.VersionId;

                    _fileDb.ModelRegistrations["default"] = model;
                }

                if (!_fileDb.ModelRegistrations.ContainsKey("PrepMate"))
                {
                    var prepMateModel = new ModelRegistration
                    {
                        Id = "PrepMate",
                        DisplayName = "PrepMate (Combo Root Engine)",
                        ProviderConnectionId = "default",
                        UpstreamModelId = "PrepMate",
                        SupportedTasks = AITaskType.AllTasks.ToList(),
                        MaxContextTokens = 128000,
                        DefaultMaxTokens = 1000,
                        DefaultTemperature = 0.7,
                        SupportsStructuredJson = true,
                        Enabled = true,
                        VerificationStatus = "UNTESTED",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _fileDb.ModelRegistrations["PrepMate"] = prepMateModel;
                }
            }
        }

        public static void ValidateIdentifier(string id, string fieldName = "Id")
        {
            if (string.IsNullOrWhiteSpace(id) || !IdRegex.IsMatch(id.Trim()))
            {
                throw new ArgumentException($"{fieldName} must be 2 to 50 characters long and contain only alphanumeric characters, dashes, or underscores.", fieldName);
            }
        }

        public IEnumerable<ModelRegistration> GetAllModels()
        {
            EnsureDefaultProjected();
            return _fileDb.ModelRegistrations.Values.OrderBy(m => m.Id).ToList();
        }

        public ModelRegistration? GetModel(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return null;
            }

            EnsureDefaultProjected();
            _fileDb.ModelRegistrations.TryGetValue(id.Trim(), out var model);
            return model;
        }

        public IEnumerable<ModelRegistration> GetModelsByProvider(string providerId)
        {
            if (string.IsNullOrWhiteSpace(providerId))
            {
                return Enumerable.Empty<ModelRegistration>();
            }

            EnsureDefaultProjected();
            return _fileDb.ModelRegistrations.Values
                .Where(m => string.Equals(m.ProviderConnectionId, providerId.Trim(), StringComparison.OrdinalIgnoreCase))
                .OrderBy(m => m.Id)
                .ToList();
        }

        public IEnumerable<ModelRegistration> GetModelsByTask(string taskType)
        {
            if (string.IsNullOrWhiteSpace(taskType))
            {
                return Enumerable.Empty<ModelRegistration>();
            }

            EnsureDefaultProjected();
            return _fileDb.ModelRegistrations.Values
                .Where(m => m.Enabled && m.SupportedTasks.Any(t => string.Equals(t, taskType.Trim(), StringComparison.OrdinalIgnoreCase)))
                .OrderBy(m => m.Id)
                .ToList();
        }

        public ModelRegistration CreateModel(CreateModelRegistrationRequest request)
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

            if (string.IsNullOrWhiteSpace(request.ProviderConnectionId))
            {
                throw new ArgumentException("ProviderConnectionId cannot be empty.", nameof(request.ProviderConnectionId));
            }

            string cleanProviderId = request.ProviderConnectionId.Trim().ToLowerInvariant();

            // Foreign Key Check: Verify provider exists!
            var provider = _providerRegistry.GetProvider(cleanProviderId);
            if (provider == null)
            {
                throw new KeyNotFoundException($"Referenced provider connection '{cleanProviderId}' does not exist.");
            }

            if (string.IsNullOrWhiteSpace(request.UpstreamModelId))
            {
                throw new ArgumentException("UpstreamModelId cannot be empty.", nameof(request.UpstreamModelId));
            }

            if (request.DefaultTemperature < 0.0 || request.DefaultTemperature > 2.0)
            {
                throw new ArgumentException("DefaultTemperature must be between 0.0 and 2.0.", nameof(request.DefaultTemperature));
            }

            if (request.DefaultMaxTokens < 1 || request.DefaultMaxTokens > 32000)
            {
                throw new ArgumentException("DefaultMaxTokens must be between 1 and 32000.", nameof(request.DefaultMaxTokens));
            }

            if (request.MaxContextTokens < 1000 || request.MaxContextTokens > 2000000)
            {
                throw new ArgumentException("MaxContextTokens must be between 1000 and 2,000,000.", nameof(request.MaxContextTokens));
            }

            lock (_syncLock)
            {
                if (_fileDb.ModelRegistrations.ContainsKey(cleanId))
                {
                    throw new InvalidOperationException($"Model registration with ID '{cleanId}' already exists.");
                }

                var tasks = request.SupportedTasks != null && request.SupportedTasks.Count > 0
                    ? request.SupportedTasks.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim()).Distinct().ToList()
                    : new List<string> { "GeneralChat" };

                foreach (var task in tasks)
                {
                    if (!ValidTasks.Contains(task))
                    {
                        throw new ArgumentException($"Unsupported task capability '{task}'. Supported tasks: {string.Join(", ", ValidTasks)}.", nameof(request.SupportedTasks));
                    }
                }

                var model = new ModelRegistration
                {
                    Id = cleanId,
                    DisplayName = request.DisplayName.Trim(),
                    ProviderConnectionId = cleanProviderId,
                    UpstreamModelId = request.UpstreamModelId.Trim(),
                    SupportedTasks = tasks,
                    MaxContextTokens = request.MaxContextTokens,
                    DefaultMaxTokens = request.DefaultMaxTokens,
                    DefaultTemperature = request.DefaultTemperature,
                    SupportsStructuredJson = request.SupportsStructuredJson,
                    Enabled = request.Enabled,
                    VerificationStatus = "UNTESTED",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var version = _versionService.RecordVersion("Model", cleanId, model, "Created model registration");
                model.CurrentVersionId = version.VersionId;

                _fileDb.ModelRegistrations[cleanId] = model;
                return model;
            }
        }

        public ModelRegistration UpdateModel(string id, UpdateModelRegistrationRequest request)
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

            if (string.IsNullOrWhiteSpace(request.ProviderConnectionId))
            {
                throw new ArgumentException("ProviderConnectionId cannot be empty.", nameof(request.ProviderConnectionId));
            }

            string cleanProviderId = request.ProviderConnectionId.Trim().ToLowerInvariant();

            // Foreign Key Check
            var provider = _providerRegistry.GetProvider(cleanProviderId);
            if (provider == null)
            {
                throw new KeyNotFoundException($"Referenced provider connection '{cleanProviderId}' does not exist.");
            }

            if (string.IsNullOrWhiteSpace(request.UpstreamModelId))
            {
                throw new ArgumentException("UpstreamModelId cannot be empty.", nameof(request.UpstreamModelId));
            }

            if (request.DefaultTemperature < 0.0 || request.DefaultTemperature > 2.0)
            {
                throw new ArgumentException("DefaultTemperature must be between 0.0 and 2.0.", nameof(request.DefaultTemperature));
            }

            if (request.DefaultMaxTokens < 1 || request.DefaultMaxTokens > 32000)
            {
                throw new ArgumentException("DefaultMaxTokens must be between 1 and 32000.", nameof(request.DefaultMaxTokens));
            }

            if (request.MaxContextTokens < 1000 || request.MaxContextTokens > 2000000)
            {
                throw new ArgumentException("MaxContextTokens must be between 1000 and 2,000,000.", nameof(request.MaxContextTokens));
            }

            lock (_syncLock)
            {
                if (!_fileDb.ModelRegistrations.TryGetValue(cleanId, out var existing))
                {
                    throw new KeyNotFoundException($"Model registration with ID '{cleanId}' was not found.");
                }

                var tasks = request.SupportedTasks != null && request.SupportedTasks.Count > 0
                    ? request.SupportedTasks.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim()).Distinct().ToList()
                    : existing.SupportedTasks;

                foreach (var task in tasks)
                {
                    if (!ValidTasks.Contains(task))
                    {
                        throw new ArgumentException($"Unsupported task capability '{task}'. Supported tasks: {string.Join(", ", ValidTasks)}.", nameof(request.SupportedTasks));
                    }
                }

                bool routingParamsChanged =
                    !string.Equals(existing.ProviderConnectionId, cleanProviderId, StringComparison.OrdinalIgnoreCase) ||
                    !string.Equals(existing.UpstreamModelId, request.UpstreamModelId.Trim(), StringComparison.Ordinal) ||
                    existing.DefaultTemperature != request.DefaultTemperature ||
                    existing.DefaultMaxTokens != request.DefaultMaxTokens ||
                    existing.MaxContextTokens != request.MaxContextTokens ||
                    existing.SupportsStructuredJson != request.SupportsStructuredJson;

                existing.DisplayName = request.DisplayName.Trim();
                existing.ProviderConnectionId = cleanProviderId;
                existing.UpstreamModelId = request.UpstreamModelId.Trim();
                existing.SupportedTasks = tasks;
                existing.MaxContextTokens = request.MaxContextTokens;
                existing.DefaultMaxTokens = request.DefaultMaxTokens;
                existing.DefaultTemperature = request.DefaultTemperature;
                existing.SupportsStructuredJson = request.SupportsStructuredJson;
                existing.Enabled = request.Enabled;
                existing.UpdatedAt = DateTime.UtcNow;

                if (routingParamsChanged)
                {
                    // Copy-On-Write configuration versioning
                    var version = _versionService.RecordVersion("Model", cleanId, existing, "Updated model registration routing parameters");
                    existing.CurrentVersionId = version.VersionId;
                    // Reset verification status if routing parameters changed
                    existing.VerificationStatus = "UNTESTED";
                    existing.LastVerifiedAt = null;
                    existing.VerificationMessage = "Configuration modified. Pending verification.";
                }

                _fileDb.ModelRegistrations[cleanId] = existing;
                return existing;
            }
        }

        public bool DeleteModel(string id, out string? errorMessage)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                errorMessage = "Model ID cannot be empty.";
                return false;
            }

            string cleanId = id.Trim().ToLowerInvariant();

            lock (_syncLock)
            {
                if (!_fileDb.ModelRegistrations.TryGetValue(cleanId, out _))
                {
                    errorMessage = $"Model registration with ID '{cleanId}' was not found.";
                    return false;
                }

                // Reference protection: Do not allow deleting the last configured model
                if (cleanId == "default" && _fileDb.ModelRegistrations.Count == 1)
                {
                    errorMessage = "Cannot delete the default model registration when it is the only model registered. Disable it instead.";
                    return false;
                }

                _fileDb.ModelRegistrations.TryRemove(cleanId, out _);
                errorMessage = null;
                return true;
            }
        }

        public void RecordVerificationResult(string modelId, bool isHealthy, string message)
        {
            if (string.IsNullOrWhiteSpace(modelId))
            {
                return;
            }

            lock (_syncLock)
            {
                if (_fileDb.ModelRegistrations.TryGetValue(modelId.Trim().ToLowerInvariant(), out var model))
                {
                    model.VerificationStatus = isHealthy ? "VERIFIED" : "INACTIVE";
                    model.LastVerifiedAt = DateTime.UtcNow;
                    model.VerificationMessage = message ?? (isHealthy ? "Verified operational." : "Verification failed.");
                    model.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        public ModelRegistrationDto ToDto(ModelRegistration model)
        {
            if (model == null)
            {
                throw new ArgumentNullException(nameof(model));
            }

            var provider = _providerRegistry.GetProvider(model.ProviderConnectionId);

            return new ModelRegistrationDto
            {
                Id = model.Id,
                DisplayName = model.DisplayName,
                ProviderConnectionId = model.ProviderConnectionId,
                ProviderDisplayName = provider?.DisplayName ?? model.ProviderConnectionId,
                UpstreamModelId = model.UpstreamModelId,
                SupportedTasks = new List<string>(model.SupportedTasks),
                MaxContextTokens = model.MaxContextTokens,
                DefaultMaxTokens = model.DefaultMaxTokens,
                DefaultTemperature = model.DefaultTemperature,
                SupportsStructuredJson = model.SupportsStructuredJson,
                Enabled = model.Enabled,
                VerificationStatus = model.VerificationStatus,
                LastVerifiedAt = model.LastVerifiedAt,
                VerificationMessage = model.VerificationMessage,
                CurrentVersionId = model.CurrentVersionId,
                CreatedAt = model.CreatedAt,
                UpdatedAt = model.UpdatedAt
            };
        }
    }
}
