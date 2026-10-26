using System;
using System.Collections.Generic;

namespace backend.Models
{
    public class CandidateCV
    {
        public string Id { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string FileType { get; set; } = "pdf"; // "pdf" | "txt" | "docx"
        public long FileSize { get; set; }
        public string RawText { get; set; } = string.Empty;
        public List<string> ExtractedSkills { get; set; } = new();
        public string? ExtractedRole { get; set; }
        public string? Summary { get; set; }
        public int ReadinessScore { get; set; } = 85;
        public bool IsActive { get; set; } = true;
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
