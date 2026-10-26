using System.Collections.Generic;

namespace backend.Models
{
    public class SubscriptionPlan
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public long Price { get; set; }
        public string Currency { get; set; } = "VND";
        public int DurationDays { get; set; }
        public int TierLevel { get; set; }
        public bool IsActive { get; set; } = true;
        public List<string> Features { get; set; } = new();
    }
}
