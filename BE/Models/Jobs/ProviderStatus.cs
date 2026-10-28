using System;

namespace backend.Models.Jobs
{
    public class ProviderStatus
    {
        public string Name { get; set; } = string.Empty;
        public string SourceKey { get; set; } = string.Empty;
        public bool IsEnabled { get; set; } = true;
        public bool IsConfigured { get; set; } = false;
        public string StatusMessage { get; set; } = string.Empty;
        public string Mode { get; set; } = "DirectApi"; // DirectApi, ExternalSearchLink, Catalog
        public int ResultCount { get; set; } = 0;
        public string? Attribution { get; set; }
    }

    public class ExternalSearchLink
    {
        public string PlatformName { get; set; } = string.Empty;
        public string PlatformKey { get; set; } = string.Empty;
        public string SearchUrl { get; set; } = string.Empty;
        public string BadgeColor { get; set; } = "#2563eb";
        public string Description { get; set; } = string.Empty;
    }
}
