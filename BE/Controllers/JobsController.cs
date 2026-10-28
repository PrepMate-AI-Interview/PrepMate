using System;
using System.Threading;
using System.Threading.Tasks;
using backend.Models.Jobs;
using backend.Services.Jobs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/jobs")]
    public class JobsController : ControllerBase
    {
        private readonly IJobAggregationService _jobService;

        public JobsController(IJobAggregationService jobService)
        {
            _jobService = jobService;
        }

        [HttpGet("search")]
        [EnableRateLimiting("jobs-policy")]
        public async Task<IActionResult> SearchJobs(
            [FromQuery] string? q,
            [FromQuery] string? location,
            [FromQuery] string? category,
            [FromQuery] string? type,
            [FromQuery] string? exp,
            [FromQuery] decimal? minSalary,
            [FromQuery] decimal? maxSalary,
            [FromQuery] string? workMode,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? source = null,
            [FromQuery] string? sortBy = "match",
            CancellationToken cancellationToken = default)
        {
            if (page < 1) page = 1;
            if (page > 100) page = 100;
            if (pageSize < 1) pageSize = 10;
            if (pageSize > 50) pageSize = 50;

            if (minSalary.HasValue && minSalary.Value < 0) minSalary = 0;
            if (maxSalary.HasValue && maxSalary.Value < 0) maxSalary = 0;
            if (maxSalary.HasValue && maxSalary.Value > 0 && minSalary.HasValue && minSalary.Value > maxSalary.Value)
            {
                return BadRequest(new { error = "Lương tối thiểu không được lớn hơn lương tối đa." });
            }

            var query = new JobSearchQuery
            {
                Keyword = q,
                Location = location,
                Category = category,
                EmploymentType = type,
                Experience = exp,
                MinSalary = minSalary,
                MaxSalary = maxSalary,
                WorkMode = workMode,
                Page = page,
                PageSize = pageSize,
                Source = source,
                SortBy = sortBy
            };

            var result = await _jobService.SearchJobsAsync(query, cancellationToken);
            return Ok(result);
        }

        [HttpGet("providers")]
        public IActionResult GetProviders()
        {
            var providers = _jobService.GetProviderStatuses();
            return Ok(providers);
        }
    }
}
