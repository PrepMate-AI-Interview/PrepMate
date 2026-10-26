using System.Threading;
using System.Threading.Tasks;
using backend.Models;
using backend.Models.AI;

namespace backend.Services.AI
{
    public interface IAIRouter
    {
        Task<AIRouteExecutionResult> RouteAndExecuteAsync(
            AIRequestContext context,
            CancellationToken cancellationToken = default
        );

        SessionAiSnapshot CreateSessionSnapshot(
            string sessionId,
            string initialTaskType = AITaskType.IntroductionAnalysis
        );

        Task<AIHealthStatus> ProbeHealthAsync(
            string? modelId = null,
            CancellationToken cancellationToken = default
        );

        CircuitBreakerState GetCircuitBreakerState(string routeKey);
    }
}
