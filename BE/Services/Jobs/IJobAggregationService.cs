using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using backend.Models.Jobs;

namespace backend.Services.Jobs
{
    public interface IJobAggregationService
    {
        List<ProviderStatus> GetProviderStatuses();
        Task<JobSearchResponse> SearchJobsAsync(JobSearchQuery query, CancellationToken cancellationToken = default);
    }
}
