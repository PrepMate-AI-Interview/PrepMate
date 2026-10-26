using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using backend.Models;

namespace backend.Services.AI
{
    public class ConfigurationVersionService : IConfigurationVersionService
    {
        private readonly FileDb _fileDb;
        private readonly object _syncLock = new();

        public ConfigurationVersionService(FileDb fileDb)
        {
            _fileDb = fileDb ?? throw new ArgumentNullException(nameof(fileDb));
        }

        public ConfigurationVersion RecordVersion(string entityType, string logicalId, object entity, string changeSummary)
        {
            if (string.IsNullOrWhiteSpace(entityType))
            {
                throw new ArgumentException("EntityType cannot be empty.", nameof(entityType));
            }
            if (string.IsNullOrWhiteSpace(logicalId))
            {
                throw new ArgumentException("LogicalId cannot be empty.", nameof(logicalId));
            }
            if (entity == null)
            {
                throw new ArgumentNullException(nameof(entity));
            }

            lock (_syncLock)
            {
                var existingVersions = _fileDb.ConfigurationVersions.Values
                    .Where(v => string.Equals(v.EntityType, entityType, StringComparison.OrdinalIgnoreCase) &&
                                string.Equals(v.LogicalId, logicalId, StringComparison.OrdinalIgnoreCase))
                    .OrderByDescending(v => v.VersionNumber)
                    .ToList();

                int nextVersion = existingVersions.Count > 0 ? existingVersions[0].VersionNumber + 1 : 1;
                string cleanType = entityType.Trim().ToLowerInvariant();
                string cleanId = logicalId.Trim().ToLowerInvariant();
                string versionId = $"ver_{cleanType}_{cleanId}_{nextVersion:D3}_{DateTime.UtcNow:yyyyMMddHHmmss}";

                var snapshotJson = JsonSerializer.Serialize(entity, new JsonSerializerOptions
                {
                    WriteIndented = false
                });

                var version = new ConfigurationVersion
                {
                    VersionId = versionId,
                    EntityType = entityType.Trim(),
                    LogicalId = logicalId.Trim(),
                    VersionNumber = nextVersion,
                    SnapshotJson = snapshotJson,
                    CreatedBy = "admin",
                    CreatedAt = DateTime.UtcNow,
                    ChangeSummary = changeSummary ?? "Configuration update"
                };

                _fileDb.ConfigurationVersions[versionId] = version;
                return version;
            }
        }

        public ConfigurationVersion? GetVersion(string versionId)
        {
            if (string.IsNullOrWhiteSpace(versionId))
            {
                return null;
            }
            _fileDb.ConfigurationVersions.TryGetValue(versionId.Trim(), out var version);
            return version;
        }

        public IEnumerable<ConfigurationVersion> GetVersionsForEntity(string logicalId)
        {
            if (string.IsNullOrWhiteSpace(logicalId))
            {
                return Enumerable.Empty<ConfigurationVersion>();
            }

            return _fileDb.ConfigurationVersions.Values
                .Where(v => string.Equals(v.LogicalId, logicalId.Trim(), StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(v => v.VersionNumber)
                .ToList();
        }
    }
}
