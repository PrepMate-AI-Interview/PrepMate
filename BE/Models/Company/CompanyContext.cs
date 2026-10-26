using System;

using System.Collections.Generic;

namespace backend.Models
{
    public class CompanyFactItem
    {
        public string Information { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty;
        public RequirementSource Reliability { get; set; } = RequirementSource.UNKNOWN;
        public bool IsVerified { get; set; } = false;
    }

    public class CompanyContext
    {
        public string CompanyName { get; set; } = string.Empty;
        public string Industry { get; set; } = string.Empty;
        public string CompanyType { get; set; } = string.Empty; // Contextual hint only (e.g., Startup, Enterprise, Fintech, ProductCompany, Outsourcing, BigTech)
        public RequirementSource SourceReliability { get; set; } = RequirementSource.UNKNOWN;
        public bool IsVerified { get; set; } = false;
        public string VerificationNotes { get; set; } = string.Empty;

        public List<CompanyFactItem> KnownFacts { get; set; } = new();
        public List<CompanyFactItem> Inferences { get; set; } = new();
    }
}
