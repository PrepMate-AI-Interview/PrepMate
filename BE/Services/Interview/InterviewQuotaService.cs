using backend.Models;
using System;
using System.Buffers.Binary;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using backend.Services.Security;
using backend.Services.Storage;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace backend.Services.Interview
{
    public class InterviewQuotaService : IInterviewQuotaService
    {
        public const string DefaultDevGuestSecret = "PrepMate_Secure_Guest_Dev_Key_2026_Minimum_256_Bits_Super_Secret!";

        private static bool IsUserProActive(User? user, DateTime nowUtc)
        {
            if (user == null || !string.Equals(user.Subscription, "pro", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
            if (string.IsNullOrWhiteSpace(user.SubscriptionExpiry))
            {
                return true;
            }
            if (DateTime.TryParse(user.SubscriptionExpiry, null, DateTimeStyles.RoundtripKind, out var expiryUtc))
            {
                return expiryUtc.ToUniversalTime() > nowUtc;
            }
            return false;
        }

        private readonly FileDb _fileDb;
        private readonly byte[] _currentHmacKey;
        private readonly List<byte[]> _verificationHmacKeys = new();
        private static readonly TimeZoneInfo VietnamTz = ResolveVietnamTimeZone();

        private class PendingReservation
        {
            public string SessionId { get; set; } = string.Empty;
            public string UserIdOrGuestId { get; set; } = string.Empty;
            public string Tier { get; set; } = string.Empty; // "free" | "guest" | "pro"
            public DateTime ExpiresAtUtc { get; set; }
        }

        private readonly ConcurrentDictionary<string, PendingReservation> _pendingReservations = new();

        public InterviewQuotaService(FileDb fileDb, IConfiguration configuration, IWebHostEnvironment? environment = null)
        {
            _fileDb = fileDb;
            var envName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");
            var isProduction = string.Equals(envName, "Production", StringComparison.OrdinalIgnoreCase);

            var guestSecret = configuration["GuestToken:SigningKey"]
                ?? Environment.GetEnvironmentVariable("GUEST_TOKEN__SIGNING_KEY")
                ?? Environment.GetEnvironmentVariable("GUEST_TOKEN_SIGNING_KEY");

            if (string.IsNullOrWhiteSpace(guestSecret))
            {
                if (isProduction)
                {
                    throw new InvalidOperationException("Production configuration error: Guest token signing key (GuestToken:SigningKey or GUEST_TOKEN__SIGNING_KEY) is required and cannot be empty.");
                }
                guestSecret = DefaultDevGuestSecret;
            }
            else if (guestSecret.Length < 32)
            {
                if (isProduction)
                {
                    throw new InvalidOperationException("Production configuration error: Guest token signing key (GuestToken:SigningKey or GUEST_TOKEN__SIGNING_KEY) must be at least 32 characters (256 bits).");
                }
                guestSecret = guestSecret.PadRight(32, '!');
            }

            var jwtSecret = configuration["Jwt:Secret"] ?? Environment.GetEnvironmentVariable("JWT__SECRET");
            if (!string.IsNullOrWhiteSpace(jwtSecret) && string.Equals(guestSecret, jwtSecret, StringComparison.Ordinal))
            {
                if (isProduction)
                {
                    throw new InvalidOperationException("Production configuration error: GuestToken:SigningKey and Jwt:Secret must not use the same signing key. Cryptographic key separation is required.");
                }
            }

            _currentHmacKey = Encoding.UTF8.GetBytes(guestSecret);
            _verificationHmacKeys.Add(_currentHmacKey);

            LoadPreviousVerificationKeys(configuration, isProduction);
        }

        private void LoadPreviousVerificationKeys(IConfiguration configuration, bool isProduction)
        {
            var prevKeysRaw = new List<string>();

            // 1. Array in configuration: GuestToken:PreviousSigningKeys
            var section = configuration.GetSection("GuestToken:PreviousSigningKeys");
            if (section.Exists())
            {
                foreach (var child in section.GetChildren())
                {
                    if (!string.IsNullOrWhiteSpace(child.Value))
                    {
                        prevKeysRaw.Add(child.Value);
                    }
                }
            }

            // 2. Delimited string in env var or config
            var envPrev = Environment.GetEnvironmentVariable("GUEST_TOKEN__PREVIOUS_SIGNING_KEYS")
                ?? Environment.GetEnvironmentVariable("GUEST_TOKEN_PREVIOUS_SIGNING_KEYS")
                ?? configuration["GuestToken:PreviousSigningKeys"];

            if (!string.IsNullOrWhiteSpace(envPrev))
            {
                var tokens = envPrev.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                foreach (var tok in tokens)
                {
                    if (!string.IsNullOrWhiteSpace(tok) && !prevKeysRaw.Contains(tok))
                    {
                        prevKeysRaw.Add(tok);
                    }
                }
            }

            foreach (var key in prevKeysRaw)
            {
                var normalizedKey = key;
                if (normalizedKey.Length < 32)
                {
                    if (isProduction) continue;
                    normalizedKey = normalizedKey.PadRight(32, '!');
                }

                var keyBytes = Encoding.UTF8.GetBytes(normalizedKey);
                if (!keyBytes.SequenceEqual(_currentHmacKey) && !_verificationHmacKeys.Any(k => k.SequenceEqual(keyBytes)))
                {
                    _verificationHmacKeys.Add(keyBytes);
                }
            }
        }

        private static TimeZoneInfo ResolveVietnamTimeZone()
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh"); } catch { }
            try { return TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"); } catch { }
            return TimeZoneInfo.CreateCustomTimeZone("Asia/Ho_Chi_Minh", TimeSpan.FromHours(7), "Vietnam Standard Time", "Vietnam Standard Time");
        }

        private string GenerateSignedGuestToken()
        {
            // 24 random bytes + 8 bytes timestamp (Unix seconds)
            Span<byte> randomBytes = stackalloc byte[24];
            RandomNumberGenerator.Fill(randomBytes);
            var nowSec = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            Span<byte> timeBytes = stackalloc byte[8];
            BinaryPrimitives.WriteInt64BigEndian(timeBytes, nowSec);

            Span<byte> payload = stackalloc byte[32];
            randomBytes.CopyTo(payload[..24]);
            timeBytes.CopyTo(payload[24..]);

            var payloadHex = Convert.ToHexString(payload).ToLowerInvariant();
            var sigHex = ComputeHmacSignature(payloadHex, _currentHmacKey);

            return $"pmg_{payloadHex}.{sigHex}";
        }

        private static string ComputeHmacSignature(string payloadHex, byte[] key)
        {
            using var hmac = new HMACSHA256(key);
            var sigBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadHex));
            return Convert.ToHexString(sigBytes).ToLowerInvariant();
        }

        private bool TryVerifyGuestToken(string? token, out string guestId, out bool isExpired, out bool wasSignedByPreviousKey)
        {
            guestId = string.Empty;
            isExpired = false;
            wasSignedByPreviousKey = false;

            if (string.IsNullOrWhiteSpace(token)) return false;
            token = token.Trim();
            if (!token.StartsWith("pmg_") || !token.Contains('.')) return false;

            var parts = token.Split('.');
            if (parts.Length != 2) return false;

            var payloadWithPrefix = parts[0]; // e.g. pmg_abcdef...
            var sigHex = parts[1];

            if (payloadWithPrefix.Length != 4 + 64 || sigHex.Length != 64) return false;

            var payloadHex = payloadWithPrefix[4..];
            var sigBytes = Encoding.UTF8.GetBytes(sigHex.ToLowerInvariant());

            bool signatureValid = false;
            bool isCurrent = false;

            for (int i = 0; i < _verificationHmacKeys.Count; i++)
            {
                var candidateKey = _verificationHmacKeys[i];
                var expectedSigHex = ComputeHmacSignature(payloadHex, candidateKey);
                var expectedSigBytes = Encoding.UTF8.GetBytes(expectedSigHex);

                if (CryptographicOperations.FixedTimeEquals(sigBytes, expectedSigBytes))
                {
                    signatureValid = true;
                    isCurrent = (i == 0);
                    break;
                }
            }

            if (!signatureValid)
            {
                return false;
            }

            wasSignedByPreviousKey = !isCurrent;

            // Parse timestamp (last 16 hex characters = 8 bytes)
            try
            {
                var timeHex = payloadHex[^16..];
                Span<byte> timeBytes = stackalloc byte[8];
                Convert.FromHexString(timeHex, timeBytes, out _, out _);
                var iatSec = BinaryPrimitives.ReadInt64BigEndian(timeBytes);
                var iat = DateTimeOffset.FromUnixTimeSeconds(iatSec);

                // 30 days expiry limit
                if (DateTimeOffset.UtcNow - iat > TimeSpan.FromDays(30) || iat > DateTimeOffset.UtcNow.AddMinutes(5))
                {
                    isExpired = true;
                    return false;
                }
            }
            catch
            {
                return false;
            }

            // Derive deterministic guest identity: guest_<hex20>
            // Note: payloadHex is independent of signature, preserving stable guestId across key rotations
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payloadHex)))[..20].ToLowerInvariant();
            guestId = $"guest_{hash}";
            return true;
        }

        private bool TryVerifyGuestToken(string? token, out string guestId, out bool isExpired)
        {
            return TryVerifyGuestToken(token, out guestId, out isExpired, out _);
        }

        private static void SetGuestCookieAndHeaders(HttpContext httpContext, string token, string guestId)
        {
            try
            {
                if (!httpContext.Response.HasStarted)
                {
                    httpContext.Response.Cookies.Append("pm_guest_token", token, new CookieOptions
                    {
                        HttpOnly = true,
                        Secure = httpContext.Request.IsHttps,
                        SameSite = SameSiteMode.Lax,
                        Path = "/",
                        Expires = DateTimeOffset.UtcNow.AddDays(30)
                    });
                    httpContext.Response.Headers["X-Guest-Id"] = guestId;
                }
            }
            catch { /* Response headers already committed */ }
        }

        public (string RawToken, string GuestId) ResolveOrCreateGuestIdentity(HttpContext httpContext)
        {
            string? candidateCookie = null;
            string? candidateHeader = null;

            if (httpContext.Request.Cookies.TryGetValue("pm_guest_token", out var cVal) && !string.IsNullOrWhiteSpace(cVal))
            {
                candidateCookie = cVal.Trim();
            }
            if (httpContext.Request.Headers.TryGetValue("X-Guest-Token", out var hVal) && !string.IsNullOrWhiteSpace(hVal))
            {
                candidateHeader = hVal.ToString().Trim();
            }

            // 1. Cookie takes precedence: verify if authentic server-issued token
            if (TryVerifyGuestToken(candidateCookie, out var cookieGuestId, out _, out var cookieFromOldKey))
            {
                string tokenToSet = candidateCookie!;
                if (cookieFromOldKey)
                {
                    var payloadHex = candidateCookie!.Split('.')[0][4..];
                    tokenToSet = $"pmg_{payloadHex}.{ComputeHmacSignature(payloadHex, _currentHmacKey)}";
                }
                SetGuestCookieAndHeaders(httpContext, tokenToSet, cookieGuestId);
                return (tokenToSet, cookieGuestId);
            }

            // 2. Fallback header: only accepted if verified as authentic server-issued token
            if (TryVerifyGuestToken(candidateHeader, out var headerGuestId, out _, out var headerFromOldKey))
            {
                string tokenToSet = candidateHeader!;
                if (headerFromOldKey)
                {
                    var payloadHex = candidateHeader!.Split('.')[0][4..];
                    tokenToSet = $"pmg_{payloadHex}.{ComputeHmacSignature(payloadHex, _currentHmacKey)}";
                }
                SetGuestCookieAndHeaders(httpContext, tokenToSet, headerGuestId);
                return (tokenToSet, headerGuestId);
            }

            // 3. Neither cookie nor header contained a valid server-issued token.
            // Client sent an arbitrary/self-minted string or first-time visitor:
            // Issue a fresh, legitimately signed server guest token.
            var freshToken = GenerateSignedGuestToken();
            TryVerifyGuestToken(freshToken, out var freshGuestId, out _);
            SetGuestCookieAndHeaders(httpContext, freshToken, freshGuestId);
            return (freshToken, freshGuestId);
        }

        public QuotaStatusDto GetQuotaStatus(ClaimsPrincipal? principal, HttpContext httpContext)
        {
            CleanExpiredReservations();

            var callerId = principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var nowUtc = DateTime.UtcNow;
            var vnNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, VietnamTz);
            var currentYear = vnNow.Year;
            var currentMonth = vnNow.Month;

            var nextMonthFirstDay = new DateTime(vnNow.Year, vnNow.Month, 1, 0, 0, 0, DateTimeKind.Unspecified).AddMonths(1);
            var nextResetUtc = TimeZoneInfo.ConvertTimeToUtc(nextMonthFirstDay, VietnamTz);
            var resetAtFormatted = $"{nextMonthFirstDay:yyyy-MM-ddTHH:mm:ss}+07:00";
            var resetAtUtcFormatted = nextResetUtc.ToString("o");

            // 1. Authenticated User
            if (!string.IsNullOrEmpty(callerId))
            {
                var user = _fileDb.Users.TryGetValue(callerId, out var u) ? u : null;
                var isProActive = IsUserProActive(user, nowUtc);

                var isPrivileged = string.Equals(user?.Role, "admin", StringComparison.OrdinalIgnoreCase) ||
                                   string.Equals(user?.Role, "manager", StringComparison.OrdinalIgnoreCase);

                if (isProActive || isPrivileged)
                {
                    return new QuotaStatusDto
                    {
                        Tier = "pro",
                        Limit = null,
                        Used = 0,
                        Remaining = 999999,
                        CanStart = true,
                        IsProActive = true,
                        IsFree = false,
                        DemoUsed = false,
                        ResetAt = resetAtFormatted,
                        ResetAtUtc = resetAtUtcFormatted,
                        UserId = callerId
                    };
                }

                // Free Tier user (or expired Pro fallen back to Free)
                // Only count started sessions belonging to the current Vietnam calendar month
                // Pro sessions snapshot 'pro' are never retroactively deducted from Free quota.
                int startedFreeCount = _fileDb.Sessions.Values.Count(s =>
                    string.Equals(s.UserId, callerId, StringComparison.OrdinalIgnoreCase) &&
                    s.IsStarted &&
                    !string.Equals(s.PlanSnapshot, "pro", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(s.PlanSnapshot, "guest", StringComparison.OrdinalIgnoreCase) &&
                    IsSessionInVietnamMonth(s.StartedAt ?? s.CreatedAt, currentYear, currentMonth)
                );

                int activeReservations = _pendingReservations.Values.Count(r =>
                    string.Equals(r.UserIdOrGuestId, callerId, StringComparison.OrdinalIgnoreCase) &&
                    r.Tier == "free" &&
                    r.ExpiresAtUtc > nowUtc
                );

                int remaining = Math.Max(0, 3 - (startedFreeCount + activeReservations));
                bool canStart = (startedFreeCount + activeReservations) < 3;

                return new QuotaStatusDto
                {
                    Tier = "free",
                    Limit = 3,
                    Used = startedFreeCount,
                    Remaining = remaining,
                    CanStart = canStart,
                    IsProActive = false,
                    IsFree = true,
                    DemoUsed = false,
                    ResetAt = resetAtFormatted,
                    ResetAtUtc = resetAtUtcFormatted,
                    UserId = callerId
                };
            }

            // 2. Guest User
            var (_, guestId) = ResolveOrCreateGuestIdentity(httpContext);

            int startedDemoCount = _fileDb.Sessions.Values.Count(s =>
                (string.Equals(s.UserId, guestId, StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(s.OriginalGuestId, guestId, StringComparison.OrdinalIgnoreCase)) &&
                s.IsStarted
            );

            int activeGuestReservations = _pendingReservations.Values.Count(r =>
                string.Equals(r.UserIdOrGuestId, guestId, StringComparison.OrdinalIgnoreCase) &&
                r.Tier == "guest" &&
                r.ExpiresAtUtc > nowUtc
            );

            bool demoUsed = startedDemoCount >= 1;
            bool canGuestStart = !demoUsed && (activeGuestReservations == 0);

            return new QuotaStatusDto
            {
                Tier = "guest",
                Limit = 1,
                Used = demoUsed ? 1 : 0,
                Remaining = demoUsed ? 0 : 1,
                CanStart = canGuestStart,
                IsProActive = false,
                IsFree = false,
                DemoUsed = demoUsed,
                GuestId = guestId
            };
        }

        public QuotaReservationResult CheckAndReserveQuota(
            ClaimsPrincipal? principal, HttpContext httpContext, string sessionId)
        {
            CleanExpiredReservations();
            var nowUtc = DateTime.UtcNow;

            return _fileDb.WithLock(() =>
            {
                var callerId = principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                // 1. Authenticated User Check & Reserve
                if (!string.IsNullOrEmpty(callerId))
                {
                    var user = _fileDb.Users.TryGetValue(callerId, out var u) ? u : null;
                    var isProActive = IsUserProActive(user, nowUtc);

                    var isPrivileged = string.Equals(user?.Role, "admin", StringComparison.OrdinalIgnoreCase) ||
                                       string.Equals(user?.Role, "manager", StringComparison.OrdinalIgnoreCase);

                    if (isProActive || isPrivileged)
                    {
                        return new QuotaReservationResult
                        {
                            Success = true,
                            Tier = "pro",
                            ResolvedUserId = callerId,
                            StatusCode = 200
                        };
                    }

                    // Free Tier (or expired Pro)
                    var vnNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, VietnamTz);
                    int startedCount = _fileDb.Sessions.Values.Count(s =>
                        string.Equals(s.UserId, callerId, StringComparison.OrdinalIgnoreCase) &&
                        s.IsStarted &&
                        !string.Equals(s.PlanSnapshot, "pro", StringComparison.OrdinalIgnoreCase) &&
                        !string.Equals(s.PlanSnapshot, "guest", StringComparison.OrdinalIgnoreCase) &&
                        IsSessionInVietnamMonth(s.StartedAt ?? s.CreatedAt, vnNow.Year, vnNow.Month)
                    );

                    int activeReservations = _pendingReservations.Values.Count(r =>
                        string.Equals(r.UserIdOrGuestId, callerId, StringComparison.OrdinalIgnoreCase) &&
                        r.Tier == "free" &&
                        r.ExpiresAtUtc > nowUtc &&
                        !string.Equals(r.SessionId, sessionId, StringComparison.OrdinalIgnoreCase)
                    );

                    if (startedCount + activeReservations >= 3)
                    {
                        return new QuotaReservationResult
                        {
                            Success = false,
                            StatusCode = 429,
                            ErrorCode = "INTERVIEW_QUOTA_EXCEEDED",
                            ErrorMessage = "Bạn đã sử dụng hết 3 lượt phỏng vấn miễn phí của tháng này. Vui lòng nâng cấp lên gói Pro để tiếp tục luyện tập không giới hạn.",
                            Tier = "free",
                            ResolvedUserId = callerId
                        };
                    }

                    // Reserve slot
                    _pendingReservations[sessionId] = new PendingReservation
                    {
                        SessionId = sessionId,
                        UserIdOrGuestId = callerId,
                        Tier = "free",
                        ExpiresAtUtc = nowUtc.AddMinutes(10)
                    };

                    return new QuotaReservationResult
                    {
                        Success = true,
                        Tier = "free",
                        ResolvedUserId = callerId,
                        StatusCode = 200
                    };
                }

                // 2. Guest Check & Reserve
                var (_, guestId) = ResolveOrCreateGuestIdentity(httpContext);

                int startedGuestCount = _fileDb.Sessions.Values.Count(s =>
                    string.Equals(s.UserId, guestId, StringComparison.OrdinalIgnoreCase) &&
                    s.IsStarted
                );

                int activeGuestReservations = _pendingReservations.Values.Count(r =>
                    string.Equals(r.UserIdOrGuestId, guestId, StringComparison.OrdinalIgnoreCase) &&
                    r.Tier == "guest" &&
                    r.ExpiresAtUtc > nowUtc &&
                    !string.Equals(r.SessionId, sessionId, StringComparison.OrdinalIgnoreCase)
                );

                if (startedGuestCount + activeGuestReservations >= 1)
                {
                    return new QuotaReservationResult
                    {
                        Success = false,
                        StatusCode = 429,
                        ErrorCode = "GUEST_DEMO_EXCEEDED",
                        ErrorMessage = "Bạn đã sử dụng phiên phỏng vấn demo dành cho khách. Vui lòng đăng ký hoặc đăng nhập tài khoản để tiếp tục luyện tập.",
                        Tier = "guest",
                        ResolvedUserId = guestId
                    };
                }

                // Reserve demo slot
                _pendingReservations[sessionId] = new PendingReservation
                {
                    SessionId = sessionId,
                    UserIdOrGuestId = guestId,
                    Tier = "guest",
                    ExpiresAtUtc = nowUtc.AddMinutes(10)
                };

                return new QuotaReservationResult
                {
                    Success = true,
                    Tier = "guest",
                    ResolvedUserId = guestId,
                    StatusCode = 200
                };
            });
        }

        public QuotaReservationResult CommitSessionStart(
            string sessionId, ClaimsPrincipal? principal, HttpContext httpContext)
        {
            if (!_fileDb.Sessions.TryGetValue(sessionId, out var session) || session == null)
            {
                return new QuotaReservationResult
                {
                    Success = false,
                    StatusCode = 404,
                    ErrorCode = "SESSION_NOT_FOUND",
                    ErrorMessage = "Không tìm thấy phiên phỏng vấn."
                };
            }

            return CommitSessionStart(session, principal, httpContext);
        }

        public QuotaReservationResult CommitSessionStart(
            Session session, ClaimsPrincipal? principal, HttpContext httpContext)
        {
            if (session == null)
            {
                return new QuotaReservationResult
                {
                    Success = false,
                    StatusCode = 404,
                    ErrorCode = "SESSION_NOT_FOUND",
                    ErrorMessage = "Không tìm thấy phiên phỏng vấn."
                };
            }

            // Idempotent: If already started, do not re-charge or re-calculate
            if (session.IsStarted)
            {
                return new QuotaReservationResult
                {
                    Success = true,
                    Tier = session.PlanSnapshot ?? "free",
                    ResolvedUserId = session.UserId,
                    StatusCode = 200
                };
            }

            var nowUtc = DateTime.UtcNow;

            return _fileDb.WithLock(() =>
            {
                if (session.IsStarted)
                {
                    return new QuotaReservationResult
                    {
                        Success = true,
                        Tier = session.PlanSnapshot ?? "free",
                        ResolvedUserId = session.UserId,
                        StatusCode = 200
                    };
                }

                var callerId = principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                string effectiveTier;
                string resolvedUserId;

                if (!string.IsNullOrEmpty(callerId))
                {
                    // Authenticated User: evaluate entitlement at start time
                    var user = _fileDb.Users.TryGetValue(callerId, out var u) ? u : null;
                    var isProActive = IsUserProActive(user, nowUtc);

                    var isPrivileged = string.Equals(user?.Role, "admin", StringComparison.OrdinalIgnoreCase) ||
                                       string.Equals(user?.Role, "manager", StringComparison.OrdinalIgnoreCase);

                    if (isProActive || isPrivileged)
                    {
                        effectiveTier = "pro";
                    }
                    else
                    {
                        // Free tier check
                        var vnNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, VietnamTz);
                        int startedCount = _fileDb.Sessions.Values.Count(s =>
                            string.Equals(s.UserId, callerId, StringComparison.OrdinalIgnoreCase) &&
                            s.IsStarted &&
                            !string.Equals(s.PlanSnapshot, "pro", StringComparison.OrdinalIgnoreCase) &&
                            !string.Equals(s.PlanSnapshot, "guest", StringComparison.OrdinalIgnoreCase) &&
                            IsSessionInVietnamMonth(s.StartedAt ?? s.CreatedAt, vnNow.Year, vnNow.Month)
                        );

                        if (startedCount >= 3)
                        {
                            return new QuotaReservationResult
                            {
                                Success = false,
                                StatusCode = 429,
                                ErrorCode = "INTERVIEW_QUOTA_EXCEEDED",
                                ErrorMessage = "Bạn đã sử dụng hết 3 lượt phỏng vấn miễn phí của tháng này. Vui lòng nâng cấp lên gói Pro để tiếp tục luyện tập.",
                                Tier = "free",
                                ResolvedUserId = callerId
                            };
                        }
                        effectiveTier = "free";
                    }
                    resolvedUserId = callerId;
                }
                else
                {
                    // Guest user: check demo limit
                    var (_, guestId) = ResolveOrCreateGuestIdentity(httpContext);
                    int startedGuestCount = _fileDb.Sessions.Values.Count(s =>
                        (string.Equals(s.UserId, guestId, StringComparison.OrdinalIgnoreCase) ||
                         string.Equals(s.OriginalGuestId, guestId, StringComparison.OrdinalIgnoreCase)) &&
                        s.IsStarted
                    );

                    if (startedGuestCount >= 1)
                    {
                        return new QuotaReservationResult
                        {
                            Success = false,
                            StatusCode = 429,
                            ErrorCode = "GUEST_DEMO_EXCEEDED",
                            ErrorMessage = "Bạn đã sử dụng phiên phỏng vấn demo dành cho khách. Vui lòng đăng ký hoặc đăng nhập tài khoản để tiếp tục luyện tập.",
                            Tier = "guest",
                            ResolvedUserId = guestId
                        };
                    }
                    effectiveTier = "guest";
                    resolvedUserId = guestId;
                }

                // Atomically commit session start and snapshot plan
                session.IsStarted = true;
                session.StartedAt = nowUtc.ToString("o");
                session.PlanSnapshot = effectiveTier;
                session.UserId = resolvedUserId;
                session.Status = "in_progress";

                _pendingReservations.TryRemove(session.Id, out _);
                _fileDb.Sessions[session.Id] = session;
                _fileDb.Save();

                return new QuotaReservationResult
                {
                    Success = true,
                    Tier = effectiveTier,
                    ResolvedUserId = resolvedUserId,
                    StatusCode = 200
                };
            });
        }

        public void ReleaseReservation(string sessionId)
        {
            _pendingReservations.TryRemove(sessionId, out _);
        }

        public (bool IsAllowed, int StatusCode, string? ErrorMessage) ValidateSessionAccess(
            Session session, ClaimsPrincipal? principal, HttpContext httpContext, bool allowMutate = false)
        {
            if (session == null)
            {
                return (false, 404, "Không tìm thấy phiên phỏng vấn.");
            }

            var callerId = principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var isAdmin = principal?.IsInRole("admin") == true;

            // Admin always has full access
            if (isAdmin)
            {
                return (true, 200, null);
            }

            // 1. Session belongs to an authenticated user
            if (!session.UserId.StartsWith("guest", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrEmpty(callerId))
                {
                    return (false, 401, "Vui lòng đăng nhập để truy cập phiên phỏng vấn này.");
                }

                if (!callerId.Equals(session.UserId, StringComparison.OrdinalIgnoreCase))
                {
                    return (false, 403, "Bạn không có quyền truy cập phiên phỏng vấn của người dùng khác.");
                }

                return (true, 200, null);
            }

            // 2. Session belongs to a specific guest identity ("guest_...")
            if (session.UserId.StartsWith("guest_", StringComparison.OrdinalIgnoreCase))
            {
                var (_, currentGuestId) = ResolveOrCreateGuestIdentity(httpContext);

                if (!string.Equals(session.UserId, currentGuestId, StringComparison.OrdinalIgnoreCase))
                {
                    return (false, 403, "Bạn không có quyền truy cập phiên phỏng vấn của khách khác.");
                }

                return (true, 200, null);
            }

            // 3. Legacy session with literal "guest"
            if (session.UserId.Equals("guest", StringComparison.OrdinalIgnoreCase))
            {
                return (false, 403, "Phiên phỏng vấn cũ không xác định được chủ sở hữu. Vui lòng liên hệ quản trị viên.");
            }

            return (false, 403, "Không có quyền truy cập phiên phỏng vấn.");
        }

        public (bool Success, int StatusCode, string? ErrorMessage) ClaimGuestSession(
            Session session,
            ClaimsPrincipal? principal,
            HttpContext httpContext)
        {
            if (session == null)
            {
                return (false, 404, "Không tìm thấy phiên phỏng vấn.");
            }

            var callerId = principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrWhiteSpace(callerId))
            {
                return (false, 401, "Vui lòng đăng nhập để liên kết phiên phỏng vấn vào tài khoản.");
            }

            // Idempotency: if session is already owned by this caller
            if (string.Equals(session.UserId, callerId, StringComparison.OrdinalIgnoreCase))
            {
                return (true, 200, null);
            }

            // Reject if already claimed or owned by another registered user
            if (!session.UserId.StartsWith("guest", StringComparison.OrdinalIgnoreCase))
            {
                return (false, 403, "Phiên phỏng vấn này đã thuộc về một tài khoản khác.");
            }

            // Verify caller's current browser guest identity
            var (_, currentGuestId) = ResolveOrCreateGuestIdentity(httpContext);

            bool matchesGuest = string.Equals(session.UserId, currentGuestId, StringComparison.OrdinalIgnoreCase) ||
                                (!string.IsNullOrWhiteSpace(session.OriginalGuestId) &&
                                 string.Equals(session.OriginalGuestId, currentGuestId, StringComparison.OrdinalIgnoreCase));

            if (!matchesGuest)
            {
                return (false, 403, "Bạn không có quyền chuyển quyền sở hữu phiên phỏng vấn này vì danh tính khách của trình duyệt không khớp.");
            }

            // Atomic claim: keep guest proof & original plan snapshot intact
            session.OriginalGuestId = session.UserId;
            session.UserId = callerId;
            session.ClaimedAt = DateTime.UtcNow.ToString("o");
            _fileDb.Sessions[session.Id] = session;
            _fileDb.Save();

            return (true, 200, null);
        }

        private static bool IsSessionInVietnamMonth(string? createdAtIso, int year, int month)
        {
            if (string.IsNullOrWhiteSpace(createdAtIso)) return false;
            if (!DateTime.TryParse(createdAtIso, null, DateTimeStyles.RoundtripKind, out var dtUtc)) return false;

            var vnDt = TimeZoneInfo.ConvertTimeFromUtc(dtUtc.ToUniversalTime(), VietnamTz);
            return vnDt.Year == year && vnDt.Month == month;
        }

        private void CleanExpiredReservations()
        {
            var now = DateTime.UtcNow;
            foreach (var kvp in _pendingReservations)
            {
                if (kvp.Value.ExpiresAtUtc <= now)
                {
                    _pendingReservations.TryRemove(kvp.Key, out _);
                }
            }
        }
    }
}
