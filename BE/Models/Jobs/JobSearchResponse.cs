using System;
using System.Collections.Generic;

namespace backend.Models.Jobs
{
    public class JobSearchResponse
    {
        public int TotalCount { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 10;
        public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
        public List<JobPostingDto> Jobs { get; set; } = new();
        public List<JobPostingDto> BenchmarkJobs { get; set; } = new();
        public List<ProviderStatus> Providers { get; set; } = new();
        public List<ExternalSearchLink> ExternalSearchLinks { get; set; } = new();
        public JobSearchQuery Query { get; set; } = new();
        public bool HasLiveProvidersConfigured { get; set; }
        public string Notice { get; set; } = string.Empty;
    }
}
