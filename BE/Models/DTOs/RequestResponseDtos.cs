using System.Collections.Generic;

namespace backend.Models
{
    // Sessions
    public class CreateSessionRequest
    {
        // User / candidate
        public string? UserId { get; set; }
        public string? FullName { get; set; }
        public string? Major { get; set; }
        public string? Specialization { get; set; }
        public string? ExperienceLevel { get; set; }
        public string? TargetLevel { get; set; }
        public string? UserDescription { get; set; }

        // Target
        public string JobTitle { get; set; } = string.Empty;
        public string? TargetCompany { get; set; }

        // Job information
        public string? JdText { get; set; }
        public string? CompanyUrl { get; set; }
        public string? CompanyDescription { get; set; }

        // CV
        public string? CvText { get; set; }

        // Candidate skills
        public List<string> Skills { get; set; } = new();

        // Strategy / Budget
        public int? MaximumQuestions { get; set; }
        public int? TargetDurationMinutes { get; set; }

        // Language Contract
        public string? Language { get; set; } = "vi-VN";
        public string? InterviewLanguage { get; set; }

        // Context Preparation & Performance Optimization (WI-INTERVIEW-PERFORMANCE-OPTIMIZATION-01)
        public AnalyzeCvResponse? CvAnalysis { get; set; }
        public AnalyzeJdResponse? JdAnalysis { get; set; }
        public bool? AutoStart { get; set; }
    }

    public class CreateSessionResponse
    {
        public string SessionId { get; set; } = string.Empty;
        public List<string>? Questions { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    // AI Respond
    public class AIRespondRequest
    {
        public string Message { get; set; } = string.Empty;
        public string? Question { get; set; }
        public string? JobTitle { get; set; }
        public string? SessionId { get; set; }
    }

    public class AIRespondResponse
    {
        public string Reply { get; set; } = string.Empty;
    }

    // Adaptive Next-Question
    public class NextQuestionRequest
    {
        public string? SessionId { get; set; }
        public string JobTitle { get; set; } = string.Empty;
        public string? JdText { get; set; }
        public List<QAPair> History { get; set; } = new List<QAPair>();
        public List<string> TopicsAsked { get; set; } = new List<string>();
        public string? Language { get; set; }
    }

    public class QAPair
    {
        public string Question { get; set; } = string.Empty;
        public string Answer { get; set; } = string.Empty;
    }

    public class NextQuestionResponse
    {
        public string Question { get; set; } = string.Empty;
        public bool IsFollowUp { get; set; }
        public string? Topic { get; set; }
    }

    // AI Report
    public class AIReportRequest
    {
        public string? SessionId { get; set; }
        public string JobTitle { get; set; } = string.Empty;
        public List<AnswerItem> Responses { get; set; } = new List<AnswerItem>();
        public string? Language { get; set; }
    }

    // CV Analysis
    public class AnalyzeCvRequest
    {
        public string CvText { get; set; } = string.Empty;
        public string? JobTitle { get; set; }
        public string? UserDescription { get; set; }
        public string? Language { get; set; }
    }


    public class AnalyzeJdRequest
    {
        public string JdText { get; set; } = string.Empty;
        public string? JobTitle { get; set; }
        public string? Industry { get; set; }
        public string? Seniority { get; set; }
        public string? Language { get; set; }
    }

    public class AnalyzeJdResponse
    {
        public string TargetRole { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public List<string> KeySkills { get; set; } = new List<string>();
        public List<string> Responsibilities { get; set; } = new List<string>();
        public List<string> Strengths { get; set; } = new List<string>();
        public List<string> Gaps { get; set; } = new List<string>();
        public List<string> Suggestions { get; set; } = new List<string>();
        public string ExperienceRequirement { get; set; } = string.Empty;
        public string DomainKnowledge { get; set; } = string.Empty;
    }

    public class AnalyzeCvResponse
    {
        public string Summary { get; set; } = string.Empty;
        public List<string> KeySkills { get; set; } = new List<string>();
        public string Experience { get; set; } = string.Empty;
        public int Suitability { get; set; }
        public List<string> Suggestions { get; set; } = new List<string>();
    }

    // Job Recommendations
    public class JobRecommendationItem
    {
        public string Role { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
    }

    public class JobRecommendationsResponse
    {
        public List<JobRecommendationItem> Recommendations { get; set; } = new List<JobRecommendationItem>();
    }

    // Career Roadmap
    public class CareerRoadmapItem
    {
        public string Step { get; set; } = string.Empty;
        public string Advice { get; set; } = string.Empty;
    }

    public class CareerRoadmapResponse
    {
        public List<CareerRoadmapItem> Roadmap { get; set; } = new List<CareerRoadmapItem>();
    }

    // Authentication DTOs
    public class RegisterRequest
    {
        public string Fullname { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty; // Holds email or username
        public string Password { get; set; } = string.Empty;
    }

    public class AuthResponse
    {
        public string Id { get; set; } = string.Empty;
        public string Fullname { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Token { get; set; } = string.Empty;
        public string Role { get; set; } = "user"; // "user" | "manager" | "admin"
        public string Subscription { get; set; } = "free"; // "free" | "pro"
        public string? SubscriptionExpiry { get; set; }
        public bool? RequiresVerification { get; set; }
        public bool? IsPending { get; set; }
        public string? Message { get; set; }
    }

    public class ForgotPasswordRequest
    {
        public string Email { get; set; } = string.Empty;
    }

    public class ResetPasswordRequest
    {
        public string Token { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    public class VerifyEmailRequest
    {
        public string Token { get; set; } = string.Empty;
        public string? Password { get; set; }
    }

    public class ChangePasswordRequest
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    public class ResendVerificationRequest
    {
        public string Email { get; set; } = string.Empty;
    }
}
