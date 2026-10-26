using System;
using System.Collections.Generic;

namespace backend.Models
{
    public class UserProfileResponse
    {
        public string Id { get; set; } = string.Empty;
        public string Fullname { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Bio { get; set; } = string.Empty;
        public string TargetRole { get; set; } = string.Empty;
        public string ExperienceLevel { get; set; } = string.Empty;
        public List<string> Skills { get; set; } = new();
        public string Location { get; set; } = string.Empty;
        public string Role { get; set; } = "user";
        public string Subscription { get; set; } = "free";
        public string? SubscriptionExpiry { get; set; }
        public string? SubscriptionDate { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class UpdateProfileRequest
    {
        public string? Fullname { get; set; }
        public string? Phone { get; set; }
        public string? Bio { get; set; }
        public string? TargetRole { get; set; }
        public string? ExperienceLevel { get; set; }
        public List<string>? Skills { get; set; }
        public string? Location { get; set; }
    }

    public class SaveCvRequest
    {
        public string? FileName { get; set; }
        public string? FileType { get; set; }
        public long FileSize { get; set; }
        public string RawText { get; set; } = string.Empty;
        public List<string>? ExtractedSkills { get; set; }
        public string? ExtractedRole { get; set; }
        public string? Summary { get; set; }
        public int? ReadinessScore { get; set; }
    }

    public class CandidateCvResponse
    {
        public string Id { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string FileType { get; set; } = string.Empty;
        public long FileSize { get; set; }
        public string RawText { get; set; } = string.Empty;
        public List<string> ExtractedSkills { get; set; } = new();
        public string? ExtractedRole { get; set; }
        public string? Summary { get; set; }
        public int ReadinessScore { get; set; }
        public bool IsActive { get; set; }
        public DateTime UploadedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
