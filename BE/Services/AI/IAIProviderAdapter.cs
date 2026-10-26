using System.Threading;
using System.Threading.Tasks;
using backend.Models;

namespace backend.Services.AI
{
    public interface IAIProviderAdapter
    {
        string Protocol { get; }

        Task<string> ExecuteChatCompletionAsync(
            AIConfiguration config,
            string apiKey,
            string prompt,
            string systemInstruction,
            CancellationToken cancellationToken = default
        );

        Task<AIHealthStatus> CheckHealthAsync(
            AIConfiguration config,
            string apiKey,
            string credentialSource,
            bool isEnvironmentManaged,
            string storageStatus,
            long probeGeneration,
            CancellationToken cancellationToken = default
        );
    }
}
