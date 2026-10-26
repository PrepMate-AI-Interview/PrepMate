using System.Collections.Generic;
using backend.Models;

namespace backend.Services.AI
{
    public interface IConfigurationVersionService
    {
        ConfigurationVersion RecordVersion(string entityType, string logicalId, object entity, string changeSummary);

        ConfigurationVersion? GetVersion(string versionId);

        IEnumerable<ConfigurationVersion> GetVersionsForEntity(string logicalId);
    }
}
