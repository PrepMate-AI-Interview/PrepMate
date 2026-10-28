using System;
using System.Collections.Generic;

namespace backend.Models.QBank
{
    public class QuestionSource
    {
        public string Id { get; set; } = string.Empty;
        public string Company { get; set; } = string.Empty;
        public string Domain { get; set; } = string.Empty;
        public string? SourceUrl { get; set; }
        public string SourceType { get; set; } = "PrepMateCurated"; // PrepMateCurated, PublicFrameworkReference, LicensedPartner
        public List<string> ApplicableIndustries { get; set; } = new();
        public bool Verified { get; set; } = false; // False: doanh nghiệp không trực tiếp chứng thực/xác nhận câu hỏi
        public DateTime LastIngestedAt { get; set; } = DateTime.UtcNow;
        public string Attribution { get; set; } = string.Empty;
        public string? LogoUrl { get; set; }
        public string Description { get; set; } = string.Empty;
    }
}
