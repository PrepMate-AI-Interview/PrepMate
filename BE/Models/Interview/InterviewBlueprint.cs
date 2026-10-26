using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace backend.Models
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum InterviewerProbePattern
    {
        OWNERSHIP_ATTRIBUTION,         // 1. Personal vs inherited vs team vs market
        CONTEXT_DEPENDENCY,            // 2. Personal ability vs favorable market/product/conditions
        CONTRIBUTION_VERIFICATION,     // 3. Separating candidate contribution from team/leaders
        METHODOLOGY_VERIFICATION,      // 4. Input -> Process -> Conversion -> Output -> Outcome (Funnel)
        CHANNEL_EFFECTIVENESS,         // 5. Best approach/acquisition/debugging/research channel and why
        ADAPTABILITY_TO_NEW_CONTEXT,   // 6. Starting in new environment without old advantages/tools
        RISK_AWARENESS,                // 7. Early warning signs of problems becoming risks
        TRADE_OFF,                     // 8. Goal A vs Risk/Constraint B; ethical or priority dilemma
        EXTERNAL_CHANGE_ADAPTATION,    // 9. External change (regulation, market, tech) breaks plan
        FAILURE_ANALYSIS,              // 10. Failed outcome, personal accountability, reflection
        REPEATABILITY                  // 11. Worst period, recovery, reproducing results elsewhere
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum CandidateClaimType
    {
        ACHIEVEMENT,
        RESPONSIBILITY,
        EXPERIENCE,
        RESULT,
        LEADERSHIP,
        CUSTOMER,
        PROBLEM_SOLVING,
        DECISION,
        FAILURE,
        PROJECT,
        TECHNICAL,
        PROCESS,
        IMPROVEMENT,
        LEARNING,
        OTHER
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum EvidenceDimensionLevel
    {
        NOT_APPLICABLE,
        UNKNOWN,
        WEAK,
        MODERATE,
        STRONG
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum EvidenceSufficiency
    {
        SUFFICIENT,
        INSUFFICIENT,
        CONTRADICTION,
        UNCERTAIN
    }

    /// <summary>
    /// Multi-Industry Interview Blueprint supporting any profession, job family, role, and seniority level.
    /// Provides domain context and probe preferences without coupling intelligence to a specific industry.
    /// </summary>
    public class InterviewBlueprint
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Industry { get; set; } = "General";
        public string JobFamily { get; set; } = "General";
        public string Role { get; set; } = "General Professional";
        public string Seniority { get; set; } = "Mid"; // Junior, Mid, Senior, Lead, Director
        public List<string> Competencies { get; set; } = new();
        public List<string> RequiredSkills { get; set; } = new();
        public List<string> PreferredSkills { get; set; } = new();
        public List<string> RiskAreas { get; set; } = new();
        public bool RiskRelevant { get; set; } = true;
        public List<string> BehavioralCompetencies { get; set; } = new();
        public List<string> SituationalCompetencies { get; set; } = new();
        public List<InterviewerProbePattern> PreferredProbePatterns { get; set; } = new();

        public static InterviewBlueprint CreateSoftwareBlueprint(string role = "Backend Developer", string seniority = "Senior")
        {
            return new InterviewBlueprint
            {
                Industry = "Technology",
                JobFamily = "Software Engineering",
                Role = role,
                Seniority = seniority,
                Competencies = new List<string> { "System Architecture", "Performance Optimization", "Database Design", "Reliability", "Clean Code" },
                RequiredSkills = new List<string> { "API Design", "Distributed Systems", "Data Structures", "CI/CD" },
                PreferredSkills = new List<string> { "Kubernetes", "Kafka", "Cloud Architecture" },
                RiskAreas = new List<string> { "System Outage", "Data Corruption", "Security Breach", "Technical Debt" },
                RiskRelevant = true,
                BehavioralCompetencies = new List<string> { "Collaboration", "Conflict Resolution", "Ownership" },
                SituationalCompetencies = new List<string> { "Production Incident", "Deadline Pressure", "Legacy Refactoring" },
                PreferredProbePatterns = new List<InterviewerProbePattern>
                {
                    InterviewerProbePattern.METHODOLOGY_VERIFICATION,
                    InterviewerProbePattern.OWNERSHIP_ATTRIBUTION,
                    InterviewerProbePattern.TRADE_OFF,
                    InterviewerProbePattern.REPEATABILITY
                }
            };
        }

        public static InterviewBlueprint CreateMarketingBlueprint(string role = "Digital Marketing Specialist", string seniority = "Mid")
        {
            return new InterviewBlueprint
            {
                Industry = "Marketing & Advertising",
                JobFamily = "Growth & Marketing",
                Role = role,
                Seniority = seniority,
                Competencies = new List<string> { "Campaign Management", "Attribution Modeling", "Conversion Rate Optimization", "Customer Acquisition" },
                RequiredSkills = new List<string> { "Data Analytics", "Performance Marketing", "A/B Testing", "SEO/SEM" },
                PreferredSkills = new List<string> { "Brand Strategy", "Content Marketing", "Marketing Automation" },
                RiskAreas = new List<string> { "Budget Burnout", "Brand Safety", "Ad Account Suspension", "Regulatory Compliance" },
                RiskRelevant = true,
                BehavioralCompetencies = new List<string> { "Cross-functional Alignment", "Creativity", "Data-driven Decision Making" },
                SituationalCompetencies = new List<string> { "Ad Fatigue", "Budget Cut", "Campaign Performance Drop" },
                PreferredProbePatterns = new List<InterviewerProbePattern>
                {
                    InterviewerProbePattern.CHANNEL_EFFECTIVENESS,
                    InterviewerProbePattern.OWNERSHIP_ATTRIBUTION,
                    InterviewerProbePattern.CONTEXT_DEPENDENCY,
                    InterviewerProbePattern.REPEATABILITY
                }
            };
        }

        public static InterviewBlueprint CreateSalesBlueprint(string role = "Enterprise Account Executive", string seniority = "Senior")
        {
            return new InterviewBlueprint
            {
                Industry = "Commercial & Sales",
                JobFamily = "Revenue & Sales",
                Role = role,
                Seniority = seniority,
                Competencies = new List<string> { "Pipeline Generation", "Deal Closing", "Relationship Management", "Solution Selling" },
                RequiredSkills = new List<string> { "Consultative Selling", "Negotiation", "Stakeholder Management", "CRM Funnel" },
                PreferredSkills = new List<string> { "Contract Negotiation", "Industry Network" },
                RiskAreas = new List<string> { "Discount Abuse", "Credit Risk", "Pipeline Leakage" },
                RiskRelevant = true,
                BehavioralCompetencies = new List<string> { "Resilience", "Customer Empathy", "Integrity" },
                SituationalCompetencies = new List<string> { "Stalled Deal", "Competitor Undercutting", "Quota Shortfall" },
                PreferredProbePatterns = new List<InterviewerProbePattern>
                {
                    InterviewerProbePattern.OWNERSHIP_ATTRIBUTION,
                    InterviewerProbePattern.CONTEXT_DEPENDENCY,
                    InterviewerProbePattern.METHODOLOGY_VERIFICATION,
                    InterviewerProbePattern.REPEATABILITY
                }
            };
        }

        public static InterviewBlueprint CreateHrBlueprint(string role = "Talent Acquisition Specialist", string seniority = "Mid")
        {
            return new InterviewBlueprint
            {
                Industry = "Human Resources",
                JobFamily = "People & Culture",
                Role = role,
                Seniority = seniority,
                Competencies = new List<string> { "Candidate Sourcing", "Interviewing & Assessment", "Stakeholder Advisory", "Funnel Optimization" },
                RequiredSkills = new List<string> { "Active Sourcing", "ATS Management", "Offer Negotiation", "Employer Branding" },
                PreferredSkills = new List<string> { "Workforce Planning", "Competency Mapping" },
                RiskAreas = new List<string> { "Early Turnover", "Hiring Bias", "Candidate Experience Drop" },
                RiskRelevant = false,
                BehavioralCompetencies = new List<string> { "Empathy", "Integrity", "Relationship Building" },
                SituationalCompetencies = new List<string> { "Difficult Hiring Manager", "Urgent Role Backfill", "Offer Rejection" },
                PreferredProbePatterns = new List<InterviewerProbePattern>
                {
                    InterviewerProbePattern.CHANNEL_EFFECTIVENESS,
                    InterviewerProbePattern.METHODOLOGY_VERIFICATION,
                    InterviewerProbePattern.OWNERSHIP_ATTRIBUTION
                }
            };
        }

        public static InterviewBlueprint CreateProductDesignBlueprint(string role = "Product Designer", string seniority = "Senior")
        {
            return new InterviewBlueprint
            {
                Industry = "Product & Design",
                JobFamily = "User Experience",
                Role = role,
                Seniority = seniority,
                Competencies = new List<string> { "User Research", "Interaction Design", "Prototyping", "Design System", "Product Thinking" },
                RequiredSkills = new List<string> { "Figma", "Usability Testing", "Wireframing", "Journey Mapping" },
                PreferredSkills = new List<string> { "Design System Governance", "Micro-interactions", "Analytics" },
                RiskAreas = new List<string> { "Unusable Interface", "Scope Creep", "Developer Handoff Mismatch" },
                RiskRelevant = false,
                BehavioralCompetencies = new List<string> { "User Advocacy", "Constructive Critique", "Collaboration" },
                SituationalCompetencies = new List<string> { "Engineering Constraints", "Conflicting Stakeholder Feedback" },
                PreferredProbePatterns = new List<InterviewerProbePattern>
                {
                    InterviewerProbePattern.METHODOLOGY_VERIFICATION,
                    InterviewerProbePattern.OWNERSHIP_ATTRIBUTION,
                    InterviewerProbePattern.TRADE_OFF
                }
            };
        }

        public static InterviewBlueprint CreateGenericBlueprint(string role = "Professional", string seniority = "Mid")
        {
            return new InterviewBlueprint
            {
                Industry = "General",
                JobFamily = "General Operations",
                Role = role,
                Seniority = seniority,
                Competencies = new List<string> { "Problem Solving", "Execution", "Communication", "Collaboration" },
                RequiredSkills = new List<string> { "Task Management", "Critical Thinking" },
                RiskAreas = new List<string>(),
                RiskRelevant = false,
                PreferredProbePatterns = new List<InterviewerProbePattern>
                {
                    InterviewerProbePattern.OWNERSHIP_ATTRIBUTION,
                    InterviewerProbePattern.METHODOLOGY_VERIFICATION,
                    InterviewerProbePattern.REPEATABILITY
                }
            };
        }
    }
}
