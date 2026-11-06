using System;
using Microsoft.Extensions.Caching.Memory;

namespace backend.Services.Security
{
    public interface ILoginProtectionService
    {
        bool IsLockedOut(string identifier, string ip, out int remainingSeconds, out string reason);
        void RecordFailedAttempt(string identifier, string ip);
        void RecordSuccessfulLogin(string identifier, string ip);
    }

    public class LoginProtectionService : ILoginProtectionService
    {
        private readonly IMemoryCache _cache;

        private const int MaxAccountAttempts = 5;
        private static readonly TimeSpan AccountLockoutDuration = TimeSpan.FromSeconds(60);
        private static readonly TimeSpan AttemptSlidingWindow = TimeSpan.FromMinutes(15);

        private const int MaxIpAttempts = 20;
        private static readonly TimeSpan IpLockoutDuration = TimeSpan.FromSeconds(120);

        public LoginProtectionService(IMemoryCache cache)
        {
            _cache = cache;
        }

        public bool IsLockedOut(string identifier, string ip, out int remainingSeconds, out string reason)
        {
            remainingSeconds = 0;
            reason = string.Empty;

            var normId = NormalizeIdentifier(identifier);

            // 1. Check account-level lockout
            if (!string.IsNullOrEmpty(normId))
            {
                var lockKey = $"login_lock:account:{normId}";
                if (_cache.TryGetValue(lockKey, out DateTime lockExpiresAt))
                {
                    var diff = (int)Math.Ceiling((lockExpiresAt - DateTime.UtcNow).TotalSeconds);
                    if (diff > 0)
                    {
                        remainingSeconds = diff;
                        reason = $"Tài khoản đang tạm thời bị khóa thử đăng nhập do nhập sai mật khẩu {MaxAccountAttempts} lần (429 Too Many Requests). Vui lòng thử lại sau {diff} giây.";
                        return true;
                    }
                    _cache.Remove(lockKey);
                }
            }

            // 2. Check IP-level lockout (defense against distributed password spraying across many accounts)
            var normIp = NormalizeIp(ip);
            if (!string.IsNullOrEmpty(normIp))
            {
                var ipLockKey = $"login_lock:ip:{normIp}";
                if (_cache.TryGetValue(ipLockKey, out DateTime ipLockExpiresAt))
                {
                    var diff = (int)Math.Ceiling((ipLockExpiresAt - DateTime.UtcNow).TotalSeconds);
                    if (diff > 0)
                    {
                        remainingSeconds = diff;
                        reason = $"Bạn đã thử đăng nhập thất bại quá nhiều lần từ địa chỉ này ({MaxIpAttempts} lần) (429 Too Many Requests). Vui lòng thử lại sau {diff} giây.";
                        return true;
                    }
                    _cache.Remove(ipLockKey);
                }
            }

            return false;
        }

        public void RecordFailedAttempt(string identifier, string ip)
        {
            var normId = NormalizeIdentifier(identifier);
            var now = DateTime.UtcNow;

            // 1. Account attempt tracking
            if (!string.IsNullOrEmpty(normId))
            {
                var attemptKey = $"login_fail:account:{normId}";
                var attempts = _cache.GetOrCreate(attemptKey, entry =>
                {
                    entry.SlidingExpiration = AttemptSlidingWindow;
                    return 0;
                }) + 1;

                _cache.Set(attemptKey, attempts, AttemptSlidingWindow);

                if (attempts >= MaxAccountAttempts)
                {
                    _cache.Set($"login_lock:account:{normId}", now.Add(AccountLockoutDuration), AccountLockoutDuration);
                    _cache.Remove(attemptKey); // reset counter after triggering temporary lockout
                }
            }

            // 2. IP attempt tracking
            var normIp = NormalizeIp(ip);
            if (!string.IsNullOrEmpty(normIp))
            {
                var ipAttemptKey = $"login_fail:ip:{normIp}";
                var ipAttempts = _cache.GetOrCreate(ipAttemptKey, entry =>
                {
                    entry.SlidingExpiration = AttemptSlidingWindow;
                    return 0;
                }) + 1;

                _cache.Set(ipAttemptKey, ipAttempts, AttemptSlidingWindow);

                if (ipAttempts >= MaxIpAttempts)
                {
                    _cache.Set($"login_lock:ip:{normIp}", now.Add(IpLockoutDuration), IpLockoutDuration);
                    _cache.Remove(ipAttemptKey);
                }
            }
        }

        public void RecordSuccessfulLogin(string identifier, string ip)
        {
            var normId = NormalizeIdentifier(identifier);
            if (!string.IsNullOrEmpty(normId))
            {
                _cache.Remove($"login_fail:account:{normId}");
                _cache.Remove($"login_lock:account:{normId}");
            }

            var normIp = NormalizeIp(ip);
            if (!string.IsNullOrEmpty(normIp))
            {
                _cache.Remove($"login_fail:ip:{normIp}");
                _cache.Remove($"login_lock:ip:{normIp}");
            }
        }

        private static string NormalizeIdentifier(string identifier)
        {
            return (identifier ?? string.Empty).Trim().ToLowerInvariant();
        }

        private static string NormalizeIp(string ip)
        {
            return (ip ?? "unknown_ip").Trim();
        }
    }
}
