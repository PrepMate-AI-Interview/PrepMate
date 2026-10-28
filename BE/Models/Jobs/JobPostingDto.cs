using System;
using System.Collections.Generic;

namespace backend.Models.Jobs
{
    public class JobPostingDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string? CompanyLogo { get; set; }
        public string Location { get; set; } = string.Empty;
        public decimal? SalaryMin { get; set; }
        public decimal? SalaryMax { get; set; }
        public string SalaryCurrency { get; set; } = "USD";
        public string? SalaryText { get; set; }
        public string EmploymentType { get; set; } = "Full-time";
        public string? WorkMode { get; set; }
        public string? ExperienceLevel { get; set; }
        public string Description { get; set; } = string.Empty;
        public List<string> Skills { get; set; } = new();
        public DateTime? PostedAt { get; set; }
        public int? PostedDays { get; set; }
        public string SourceName { get; set; } = string.Empty;
        public string SourceKey { get; set; } = string.Empty;
        public string? SourceUrl { get; set; }
        public string? ApplyUrl { get; set; }
        public DateTime FetchedAt { get; set; } = DateTime.UtcNow;
        public bool IsSample { get; set; } = false;
        public bool Featured { get; set; } = false;
        public int MatchScore { get; set; } = 85;
    }
}
