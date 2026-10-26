using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using backend.Models;
using backend.Models.AI;

namespace backend.Services.AI
{
    public interface IVilaoModelDiscoveryService
    {
        Task<DiscoveredCatalog> GetCatalogAsync(bool forceRefresh = false, CancellationToken cancellationToken = default);

        Task<DiscoveredCatalogDto> GetCatalogDtoAsync(bool forceRefresh = false, CancellationToken cancellationToken = default);

        Task<DiscoveredCatalogDto> RefreshAsync(CancellationToken cancellationToken = default);

        Task<AIHealthStatus> VerifyAliasInferenceAsync(CancellationToken cancellationToken = default);

        List<DiscoveredModel> ParseModelsResponse(string jsonContent);
    }
}
