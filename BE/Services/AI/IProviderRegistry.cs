using System.Collections.Generic;
using backend.Models;

namespace backend.Services.AI
{
    public interface IProviderRegistry
    {
        IEnumerable<ProviderConnection> GetAllProviders();

        ProviderConnection? GetProvider(string id);

        ProviderConnection CreateProvider(CreateProviderConnectionRequest request);

        ProviderConnection UpdateProvider(string id, UpdateProviderConnectionRequest request);

        bool DeleteProvider(string id, out string? errorMessage);

        (string PlaintextKey, string Source, bool IsEnvManaged, string StorageStatus) ResolveCredential(ProviderConnection provider);

        ProviderConnectionDto ToDto(ProviderConnection provider);
    }
}
