using System;

namespace backend.Models.Jobs
{
    public class JobSearchQuery
    {
        public string? Keyword { get; set; }
        public string? Location { get; set; }
        public string? Category { get; set; }
        public string? EmploymentType { get; set; }
        public string? Experience { get; set; }
        public decimal? MinSalary { get; set; }
        public decimal? MaxSalary { get; set; }
        public string? WorkMode { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 10;
        public string? Source { get; set; }
        public string? SortBy { get; set; } = "match";
    }
}
