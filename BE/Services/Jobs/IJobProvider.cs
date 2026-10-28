using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using backend.Models.Jobs;

namespace backend.Services.Jobs
{
    public class ProviderSearchResult
    {
        public List<JobPostingDto> Jobs { get; set; } = new();
        public int TotalCount { get; set; }
        public ProviderStatus Status { get; set; } = new();
        public string? ErrorMessage { get; set; }
    }

    public interface IJobProvider
    {
        string ProviderName { get; }
        string SourceKey { get; }
        bool IsConfigured { get; }
        ProviderStatus GetStatus();
        Task<ProviderSearchResult> SearchJobsAsync(JobSearchQuery query, CancellationToken cancellationToken = default);
    }
}
