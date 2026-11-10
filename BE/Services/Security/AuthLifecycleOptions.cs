using System;
using Microsoft.Extensions.Configuration;

namespace backend.Services.Security
{
    public class AuthLifecycleOptions
    {
        public int EmailVerificationTokenTtlMinutes { get; set; } = 30;
        public int PendingRegistrationTtlHours { get; set; } = 24;
        public int VerificationResendCooldownSeconds { get; set; } = 60;
        public int VerificationMaxSendsPer24Hours { get; set; } = 5;
        public int PendingCleanupIntervalMinutes { get; set; } = 60;

        /// <summary>
        /// Reads and binds authentication lifecycle configuration from IConfiguration and Environment Variables.
        /// Fully unifies hierarchical (AUTH__*) and flat (AUTH_*) naming conventions.
        /// </summary>
        public static AuthLifecycleOptions FromConfiguration(IConfiguration configuration)
        {
            var options = new AuthLifecycleOptions();

            // 1. Email verification token TTL in minutes (Default: 30 minutes)
            var tokenTtlStr = configuration["Auth:EmailVerificationTokenTtlMinutes"]
                ?? Environment.GetEnvironmentVariable("AUTH__EMAIL_VERIFICATION_TOKEN_TTL_MINUTES")
                ?? Environment.GetEnvironmentVariable("AUTH_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES");
            if (int.TryParse(tokenTtlStr, out var tokenTtl) && tokenTtl > 0)
            {
                options.EmailVerificationTokenTtlMinutes = tokenTtl;
            }

            // 2. Pending registration TTL in hours (Default: 24 hours)
            var pendingTtlStr = configuration["Auth:PendingRegistrationTtlHours"]
                ?? Environment.GetEnvironmentVariable("AUTH__PENDING_REGISTRATION_TTL_HOURS")
                ?? Environment.GetEnvironmentVariable("AUTH_PENDING_REGISTRATION_TTL_HOURS");
            if (int.TryParse(pendingTtlStr, out var pendingTtl) && pendingTtl > 0)
            {
                options.PendingRegistrationTtlHours = pendingTtl;
            }

            // 3. Verification resend cooldown in seconds (Default: 60 seconds)
            var cooldownStr = configuration["Auth:VerificationResendCooldownSeconds"]
                ?? Environment.GetEnvironmentVariable("AUTH__VERIFICATION_RESEND_COOLDOWN_SECONDS")
                ?? Environment.GetEnvironmentVariable("AUTH_VERIFICATION_RESEND_COOLDOWN_SECONDS");
            if (int.TryParse(cooldownStr, out var cooldown) && cooldown >= 0)
            {
                options.VerificationResendCooldownSeconds = cooldown;
            }

            // 4. Verification max sends per 24 hours (Default: 5 sends)
            var maxSendsStr = configuration["Auth:VerificationMaxSendsPer24Hours"]
                ?? Environment.GetEnvironmentVariable("AUTH__VERIFICATION_MAX_SENDS_PER_24_HOURS")
                ?? Environment.GetEnvironmentVariable("AUTH_VERIFICATION_MAX_SENDS_PER_24_HOURS");
            if (int.TryParse(maxSendsStr, out var maxSends) && maxSends > 0)
            {
                options.VerificationMaxSendsPer24Hours = maxSends;
            }

            // 5. Pending account cleanup interval in minutes (Default: 60 minutes)
            var cleanupIntervalStr = configuration["Auth:PendingCleanupIntervalMinutes"]
                ?? Environment.GetEnvironmentVariable("AUTH__PENDING_CLEANUP_INTERVAL_MINUTES")
                ?? Environment.GetEnvironmentVariable("AUTH_PENDING_CLEANUP_INTERVAL_MINUTES");
            if (int.TryParse(cleanupIntervalStr, out var cleanupInterval) && cleanupInterval > 0)
            {
                options.PendingCleanupIntervalMinutes = cleanupInterval;
            }

            return options;
        }
    }
}
