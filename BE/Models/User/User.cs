using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace backend.Models
{
    /// <summary>
    /// Role values: "user" | "manager" | "admin"
    /// </summary>
    public class User
    {
        public string Id { get; set; } = string.Empty;
        public string Fullname { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;

        /// <summary>
        /// Legacy plaintext password. Used ONLY during migration; strictly omitted from JSON when empty or writing default.
        /// </summary>
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
        public string Password { get; set; } = string.Empty;

        /// <summary>
        /// Secure PBKDF2 with HMAC-SHA256 password hash.
        /// </summary>
        public string? PasswordHash { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string Subscription { get; set; } = "free"; // "free" | "pro"
        public string? SubscriptionDate { get; set; }
        public string? SubscriptionExpiry { get; set; }

        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
        public bool ScheduledDowngrade { get; set; } = false;

        public string Role { get; set; } = "user"; // "user" | "manager" | "admin"

        // Email Verification & Password Reset Security State (WI-AUTH-01 & WI-AUTH-02)
        public bool EmailVerified { get; set; } = true;
        public DateTime? EmailVerifiedAt { get; set; }
        public string? EmailVerificationTokenHash { get; set; }
        public DateTime? EmailVerificationTokenExpiresAt { get; set; }
        public DateTime? LastVerificationEmailSentAt { get; set; }
        public DateTime? PendingRegistrationExpiresAt { get; set; }
        public int VerificationResendCount { get; set; } = 0;

        public string? PasswordResetTokenHash { get; set; }
        public DateTime? PasswordResetTokenExpiresAt { get; set; }
        public DateTime? LastPasswordResetRequestedAt { get; set; }
        public DateTime? PasswordChangedAt { get; set; }
        public string? SecurityStamp { get; set; }

        // H1: Server-persisted profile fields
        public string Phone { get; set; } = string.Empty;
        public string Bio { get; set; } = string.Empty;
        public string TargetRole { get; set; } = string.Empty;
        public string ExperienceLevel { get; set; } = string.Empty;
        public List<string> Skills { get; set; } = new();
        public string Location { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }

        // Computed helpers (not stored, for convenience)
        public bool IsAdmin => Role == "admin";
        public bool IsManager => Role == "manager";

        [JsonIgnore]
        public bool IsPendingEmailVerification => !EmailVerified && (PendingRegistrationExpiresAt.HasValue
            ? PendingRegistrationExpiresAt.Value >= DateTime.UtcNow
            : (EmailVerificationTokenExpiresAt.HasValue ? EmailVerificationTokenExpiresAt.Value >= DateTime.UtcNow : CreatedAt.AddHours(24) >= DateTime.UtcNow));

        [JsonIgnore]
        public bool IsPendingRegistrationExpired => !EmailVerified && (PendingRegistrationExpiresAt.HasValue
            ? PendingRegistrationExpiresAt.Value < DateTime.UtcNow
            : (EmailVerificationTokenExpiresAt.HasValue ? EmailVerificationTokenExpiresAt.Value < DateTime.UtcNow : CreatedAt.AddHours(24) < DateTime.UtcNow));

        /// <summary>
        /// Evaluates whether the user's paid subscription is currently active and within its valid time window.
        /// </summary>
        public bool IsSubscriptionActive()
        {
            if (string.Equals(Subscription, "pro", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrWhiteSpace(SubscriptionExpiry)) return true;
                if (DateTime.TryParse(SubscriptionExpiry, null, System.Globalization.DateTimeStyles.RoundtripKind, out var expiry))
                {
                    return expiry > DateTime.UtcNow;
                }
                return true;
            }
            return false;
        }

        /// <summary>
        /// Checks expiration against DateTime.UtcNow. If expired, automatically reverts Subscription to 'free'.
        /// Returns true if a state transition occurred.
        /// </summary>
        public bool CheckAndSyncSubscriptionExpiry()
        {
            if (string.Equals(Subscription, "pro", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.IsNullOrWhiteSpace(SubscriptionExpiry) &&
                    DateTime.TryParse(SubscriptionExpiry, null, System.Globalization.DateTimeStyles.RoundtripKind, out var expiry))
                {
                    if (expiry <= DateTime.UtcNow)
                    {
                        Subscription = "free";
                        ScheduledDowngrade = false;
                        return true;
                    }
                }
            }
            return false;
        }
    }
}
