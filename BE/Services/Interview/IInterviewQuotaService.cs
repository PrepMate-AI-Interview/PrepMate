using backend.Models;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace backend.Services.Interview
{
    public class QuotaStatusDto
    {
        public string Tier { get; set; } = "free"; // "guest" | "free" | "pro"
        public int? Limit { get; set; }
        public int Used { get; set; }
        public int Remaining { get; set; }
        public bool CanStart { get; set; }
        public bool IsProActive { get; set; }
        public bool IsFree { get; set; }
        public bool DemoUsed { get; set; }
        public string? ResetAt { get; set; }
        public string? ResetAtUtc { get; set; }
        public string? GuestId { get; set; }
        public string? UserId { get; set; }
    }

    public class QuotaReservationResult
    {
        public bool Success { get; set; }
        public string? ErrorCode { get; set; }
        public string? ErrorMessage { get; set; }
        public int StatusCode { get; set; } = 200;
        public string? Tier { get; set; }
        public string? ResolvedUserId { get; set; }
    }

    public interface IInterviewQuotaService
    {
        QuotaStatusDto GetQuotaStatus(ClaimsPrincipal? principal, HttpContext httpContext);
        QuotaReservationResult CheckAndReserveQuota(ClaimsPrincipal? principal, HttpContext httpContext, string sessionId);
        QuotaReservationResult CommitSessionStart(Session session, ClaimsPrincipal? principal, HttpContext httpContext);
        QuotaReservationResult CommitSessionStart(string sessionId, ClaimsPrincipal? principal, HttpContext httpContext);
        void ReleaseReservation(string sessionId);
        (bool IsAllowed, int StatusCode, string? ErrorMessage) ValidateSessionAccess(
            Session session,
            ClaimsPrincipal? principal,
            HttpContext httpContext,
            bool allowMutate = false);
        (string RawToken, string GuestId) ResolveOrCreateGuestIdentity(HttpContext httpContext);
        (bool Success, int StatusCode, string? ErrorMessage) ClaimGuestSession(
            Session session,
            ClaimsPrincipal? principal,
            HttpContext httpContext);
    }
}
