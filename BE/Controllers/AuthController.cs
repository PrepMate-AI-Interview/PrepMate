using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Hosting;
using System;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using backend.Models;
using backend.Services;
using backend.Services.Email;
using backend.Services.Security;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly FileDb _fileDb;
        private readonly JwtTokenService _jwtService;
        private readonly IEmailSender _emailSender;
        private readonly EmailTemplateRenderer _templateRenderer;
        private readonly EmailOptions _emailOptions;
        private readonly IEmailInboxStore _inboxStore;
        private readonly IWebHostEnvironment _environment;
        private readonly ILoginProtectionService _loginProtection;

        public AuthController(
            FileDb fileDb,
            JwtTokenService jwtService,
            IEmailSender emailSender,
            EmailTemplateRenderer templateRenderer,
            EmailOptions emailOptions,
            IEmailInboxStore inboxStore,
            IWebHostEnvironment environment,
            ILoginProtectionService loginProtection)
        {
            _fileDb = fileDb;
            _jwtService = jwtService;
            _emailSender = emailSender;
            _templateRenderer = templateRenderer;
            _emailOptions = emailOptions;
            _inboxStore = inboxStore;
            _environment = environment;
            _loginProtection = loginProtection;
        }

        // ======================================================================
        // REGISTER
        // ======================================================================
        [EnableRateLimiting("auth-register-policy")]
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { error = "Dữ liệu đăng ký không hợp lệ." });
            }

            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.Fullname))
            {
                return BadRequest(new { error = "Vui lòng điền đầy đủ họ tên, email và mật khẩu." });
            }

            if (!IsValidEmail(request.Email))
            {
                return BadRequest(new { error = "Địa chỉ email không đúng định dạng." });
            }

            if (!PasswordPolicy.Validate(request.Password, out var passwordError))
            {
                return BadRequest(new { error = passwordError });
            }

            var normalizedEmail = request.Email.Trim().ToLowerInvariant();

            // Check if email already exists
            foreach (var existingUser in _fileDb.Users.Values)
            {
                if (existingUser.Email.Equals(normalizedEmail, StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { error = "Email này đã được sử dụng." });
                }
            }

            // Generate Username from email prefix if not supplied
            var username = !string.IsNullOrWhiteSpace(request.Username)
                ? request.Username.Trim().ToLowerInvariant()
                : normalizedEmail.Split('@')[0].ToLowerInvariant();

            // Ensure username uniqueness
            var baseUsername = username;
            var suffix = 1;
            while (_fileDb.Users.Values.Any(u => u.Username.Equals(username, StringComparison.OrdinalIgnoreCase)))
            {
                username = $"{baseUsername}{suffix++}";
            }

            var userId = "user_" + Guid.NewGuid().ToString("N")[..8];
            var passwordHash = PasswordHasher.HashPassword(request.Password);

            // Generate cryptographically secure verification token
            var rawVerificationToken = GenerateSecureToken();
            var verificationTokenHash = HashToken(rawVerificationToken);

            var newUser = new User
            {
                Id = userId,
                Fullname = request.Fullname.Trim(),
                Email = normalizedEmail,
                Username = username,
                Password = string.Empty, // Plaintext password strictly cleared for security
                PasswordHash = passwordHash,
                CreatedAt = DateTime.UtcNow,
                Role = "user",
                Subscription = "free",
                EmailVerified = false, // Must verify email before accessing protected resources
                EmailVerificationTokenHash = verificationTokenHash,
                EmailVerificationTokenExpiresAt = DateTime.UtcNow.AddHours(24),
                LastVerificationEmailSentAt = DateTime.UtcNow,
                SecurityStamp = Guid.NewGuid().ToString("N")
            };

            lock (_fileDb)
            {
                _fileDb.Users[userId] = newUser;
                _fileDb.Save();
            }

            // Construct verification link using configured Frontend Base URL
            var baseUrl = ResolveBaseUrl();
            var verificationLink = $"{baseUrl}/features/auth/verify-email.html?token={rawVerificationToken}";
            var (htmlBody, plainText) = _templateRenderer.RenderVerificationEmail(newUser.Fullname, verificationLink);

            var sendResult = await _emailSender.SendEmailAsync(new EmailMessage(
                To: newUser.Email,
                Subject: "PrepMate — Xác nhận địa chỉ email của bạn",
                HtmlBody: htmlBody,
                PlainTextBody: plainText,
                SenderName: _emailOptions.SenderName,
                SenderEmail: _emailOptions.SenderEmail
            ));

            return Ok(new AuthResponse
            {
                Id = userId,
                Fullname = newUser.Fullname,
                Email = newUser.Email,
                Username = newUser.Username,
                Token = string.Empty, // No JWT token granted before email verification
                Role = newUser.Role,
                Subscription = newUser.Subscription,
                SubscriptionExpiry = newUser.SubscriptionExpiry,
                RequiresVerification = true,
                Message = sendResult.Success
                    ? "Đăng ký thành công! Vui lòng kiểm tra email để xác minh tài khoản của bạn."
                    : "Đăng ký thành công. Hệ thống gửi email đang bận, bạn có thể đăng nhập và yêu cầu gửi lại sau."
            });
        }

        // ======================================================================
        // LOGIN
        // ======================================================================
        [EnableRateLimiting("auth-login-policy")]
        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { error = "Vui lòng nhập email/username và mật khẩu." });
            }

            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new { error = "Vui lòng nhập đầy đủ tài khoản và mật khẩu." });
            }

            var loginInput = request.Email.Trim().ToLowerInvariant();
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown_ip";

            // WI-03: Login Brute-Force & Abuse Protection
            if (_loginProtection.IsLockedOut(loginInput, clientIp, out var retryAfterSeconds, out var lockoutReason))
            {
                Response.Headers.RetryAfter = retryAfterSeconds.ToString();
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    error = lockoutReason,
                    retryAfterSeconds = retryAfterSeconds
                });
            }

            // Find user by email or username
            var user = _fileDb.Users.Values.FirstOrDefault(u =>
                u.Email.Equals(loginInput, StringComparison.OrdinalIgnoreCase) ||
                u.Username.Equals(loginInput, StringComparison.OrdinalIgnoreCase));

            if (user == null)
            {
                _loginProtection.RecordFailedAttempt(loginInput, clientIp);
                return Unauthorized(new { error = "Email/username hoặc mật khẩu không chính xác." });
            }

            var passwordValid = false;

            // 1. PBKDF2 hashed password verification
            if (!string.IsNullOrEmpty(user.PasswordHash))
            {
                passwordValid = PasswordHasher.VerifyPassword(request.Password, user.PasswordHash);
            }
            // 2. Legacy plaintext verification with seamless migration
            else if (!string.IsNullOrEmpty(user.Password) && user.Password == request.Password)
            {
                passwordValid = true;
            }

            if (!passwordValid)
            {
                _loginProtection.RecordFailedAttempt(loginInput, clientIp);
                return Unauthorized(new { error = "Email/username hoặc mật khẩu không chính xác." });
            }

            // Automatic upgrade: rehash legacy 100k or plaintext passwords to 600k iterations
            if (PasswordHasher.NeedsRehash(user.PasswordHash))
            {
                user.PasswordHash = PasswordHasher.HashPassword(request.Password);
                user.Password = string.Empty;
                lock (_fileDb)
                {
                    _fileDb.Save();
                }
            }

            // Successful login credentials verified -> reset failure counters
            _loginProtection.RecordSuccessfulLogin(loginInput, clientIp);

            // Enforce email verification for users with EmailVerified = false
            if (!user.EmailVerified)
            {
                return BadRequest(new
                {
                    error = "Tài khoản của bạn chưa được xác minh email. Vui lòng kiểm tra hộp thư hoặc yêu cầu gửi lại email xác minh.",
                    requiresVerification = true,
                    email = user.Email
                });
            }

            lock (_fileDb)
            {
                var needsSave = user.CheckAndSyncSubscriptionExpiry();
                if (string.IsNullOrEmpty(user.SecurityStamp))
                {
                    user.SecurityStamp = Guid.NewGuid().ToString("N");
                    needsSave = true;
                }
                if (needsSave)
                {
                    _fileDb.Save();
                }
            }

            var token = _jwtService.GenerateToken(user);

            return Ok(new AuthResponse
            {
                Id = user.Id,
                Fullname = user.Fullname,
                Email = user.Email,
                Username = user.Username,
                Token = token,
                Role = user.Role,
                Subscription = user.Subscription,
                SubscriptionExpiry = user.SubscriptionExpiry
            });
        }

        // ======================================================================
        // VERIFY EMAIL (POST /api/auth/verify-email)
        // ======================================================================
        [EnableRateLimiting("auth-verify-policy")]
        [HttpPost("verify-email")]
        public IActionResult VerifyEmail([FromBody] VerifyEmailRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Token))
            {
                return BadRequest(new { error = "Mã xác minh không hợp lệ hoặc bị thiếu.", code = "invalid" });
            }

            var tokenHash = HashToken(request.Token);

            lock (_fileDb)
            {
                var user = _fileDb.Users.Values.FirstOrDefault(u =>
                    !string.IsNullOrEmpty(u.EmailVerificationTokenHash) &&
                    u.EmailVerificationTokenHash == tokenHash);

                if (user == null)
                {
                    return BadRequest(new { error = "Liên kết xác minh không hợp lệ hoặc đã được sử dụng.", code = "invalid_or_used" });
                }

                if (user.EmailVerificationTokenExpiresAt.HasValue &&
                    user.EmailVerificationTokenExpiresAt.Value < DateTime.UtcNow)
                {
                    user.EmailVerificationTokenHash = null;
                    _fileDb.Save();
                    return BadRequest(new { error = "Liên kết xác minh đã hết hạn. Vui lòng yêu cầu gửi lại email mới.", code = "expired", email = user.Email });
                }

                user.EmailVerified = true;
                user.EmailVerifiedAt = DateTime.UtcNow;
                user.EmailVerificationTokenHash = null;
                user.EmailVerificationTokenExpiresAt = null;
                _fileDb.Save();

                return Ok(new
                {
                    message = "Xác minh email thành công! Bạn có thể đăng nhập ngay.",
                    email = user.Email,
                    fullname = user.Fullname
                });
            }
        }

        // GET api/auth/verify-email (Direct browser link support)
        // SAFE EMAIL VERIFICATION (WI-05): Under no circumstance should a GET request consume
        // single-use tokens or mutate account verification state. Email scanners follow links via GET;
        // only user-submitted POST consumes verification tokens.
        [EnableRateLimiting("auth-verify-policy")]
        [HttpGet("verify-email")]
        public IActionResult VerifyEmailGet([FromQuery] string? token)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                return Redirect("/features/auth/verify-email.html?error=missing_token");
            }

            return Redirect($"/features/auth/verify-email.html?token={Uri.EscapeDataString(token)}");
        }

        // ======================================================================
        // RESEND VERIFICATION (POST /api/auth/resend-verification)
        // ======================================================================
        [EnableRateLimiting("auth-resend-policy")]
        [HttpPost("resend-verification")]
        public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationRequest request)
        {
            const string neutralMsg = "Nếu địa chỉ email tồn tại trong hệ thống và chưa được kích hoạt, PrepMate đã gửi liên kết xác minh mới.";

            if (request == null || string.IsNullOrWhiteSpace(request.Email) || !IsValidEmail(request.Email))
            {
                return BadRequest(new { error = "Địa chỉ email không đúng định dạng." });
            }

            var normalizedEmail = request.Email.Trim().ToLowerInvariant();

            var user = _fileDb.Users.Values.FirstOrDefault(u =>
                u.Email.Equals(normalizedEmail, StringComparison.OrdinalIgnoreCase));

            if (user == null || user.EmailVerified)
            {
                // Defense against email enumeration
                return Ok(new { message = neutralMsg });
            }

            // Cooldown: 60 seconds
            if (user.LastVerificationEmailSentAt.HasValue &&
                user.LastVerificationEmailSentAt.Value.AddSeconds(60) > DateTime.UtcNow)
            {
                var waitSeconds = (int)Math.Ceiling((user.LastVerificationEmailSentAt.Value.AddSeconds(60) - DateTime.UtcNow).TotalSeconds);
                return BadRequest(new
                {
                    error = $"Vui lòng đợi {waitSeconds} giây trước khi yêu cầu gửi lại email xác minh.",
                    cooldownRemaining = waitSeconds
                });
            }

            var rawToken = GenerateSecureToken();
            var tokenHash = HashToken(rawToken);

            lock (_fileDb)
            {
                user.EmailVerificationTokenHash = tokenHash;
                user.EmailVerificationTokenExpiresAt = DateTime.UtcNow.AddHours(24);
                user.LastVerificationEmailSentAt = DateTime.UtcNow;
                _fileDb.Save();
            }

            var baseUrl = ResolveBaseUrl();
            var verificationLink = $"{baseUrl}/features/auth/verify-email.html?token={rawToken}";
            var (htmlBody, plainText) = _templateRenderer.RenderVerificationEmail(user.Fullname, verificationLink);

            await _emailSender.SendEmailAsync(new EmailMessage(
                To: user.Email,
                Subject: "PrepMate — Xác nhận địa chỉ email của bạn",
                HtmlBody: htmlBody,
                PlainTextBody: plainText,
                SenderName: _emailOptions.SenderName,
                SenderEmail: _emailOptions.SenderEmail
            ));

            return Ok(new { message = neutralMsg });
        }

        // ======================================================================
        // FORGOT PASSWORD (POST /api/auth/forgot-password)
        // ======================================================================
        [EnableRateLimiting("auth-forgot-policy")]
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            const string neutralMsg = "Nếu địa chỉ email tồn tại trong hệ thống, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu đến địa chỉ đó.";

            if (request == null || string.IsNullOrWhiteSpace(request.Email) || !IsValidEmail(request.Email))
            {
                return BadRequest(new { error = "Địa chỉ email không đúng định dạng." });
            }

            var normalizedEmail = request.Email.Trim().ToLowerInvariant();

            var user = _fileDb.Users.Values.FirstOrDefault(u =>
                u.Email.Equals(normalizedEmail, StringComparison.OrdinalIgnoreCase));

            // Anti-enumeration: neutral response for non-existent users
            if (user == null)
            {
                return Ok(new { message = neutralMsg });
            }

            // Cooldown check: 60 seconds
            if (user.LastPasswordResetRequestedAt.HasValue &&
                user.LastPasswordResetRequestedAt.Value.AddSeconds(60) > DateTime.UtcNow)
            {
                // Silently return neutral response to avoid timing and enumeration leaks
                return Ok(new { message = neutralMsg });
            }

            var rawResetToken = GenerateSecureToken();
            var resetTokenHash = HashToken(rawResetToken);

            lock (_fileDb)
            {
                user.PasswordResetTokenHash = resetTokenHash;
                user.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddMinutes(30);
                user.LastPasswordResetRequestedAt = DateTime.UtcNow;
                _fileDb.Save();
            }

            var baseUrl = ResolveBaseUrl();
            var resetLink = $"{baseUrl}/features/auth/reset-password.html?token={rawResetToken}";
            var (htmlBody, plainText) = _templateRenderer.RenderPasswordResetEmail(user.Fullname, resetLink, 30);

            await _emailSender.SendEmailAsync(new EmailMessage(
                To: user.Email,
                Subject: "Yêu cầu đặt lại mật khẩu PrepMate",
                HtmlBody: htmlBody,
                PlainTextBody: plainText,
                SenderName: _emailOptions.SenderName,
                SenderEmail: _emailOptions.SenderEmail
            ));

            return Ok(new { message = neutralMsg });
        }

        // ======================================================================
        // VERIFY RESET TOKEN (GET /api/auth/verify-reset-token)
        // ======================================================================
        [EnableRateLimiting("auth-reset-policy")]
        [HttpGet("verify-reset-token")]
        public IActionResult VerifyResetToken([FromQuery] string? token)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                return BadRequest(new { valid = false, error = "Mã đặt lại mật khẩu không hợp lệ.", code = "invalid" });
            }

            var tokenHash = HashToken(token);

            lock (_fileDb)
            {
                var user = _fileDb.Users.Values.FirstOrDefault(u =>
                    !string.IsNullOrEmpty(u.PasswordResetTokenHash) &&
                    u.PasswordResetTokenHash == tokenHash);

                if (user == null)
                {
                    return BadRequest(new { valid = false, error = "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng.", code = "invalid_or_used" });
                }

                if (user.PasswordResetTokenExpiresAt.HasValue &&
                    user.PasswordResetTokenExpiresAt.Value < DateTime.UtcNow)
                {
                    user.PasswordResetTokenHash = null;
                    _fileDb.Save();
                    return BadRequest(new { valid = false, error = "Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu liên kết mới.", code = "expired" });
                }

                return Ok(new { valid = true, email = user.Email });
            }
        }

        // ======================================================================
        // RESET PASSWORD (POST /api/auth/reset-password)
        // ======================================================================
        [EnableRateLimiting("auth-reset-policy")]
        [HttpPost("reset-password")]
        public IActionResult ResetPassword([FromBody] ResetPasswordRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Token))
            {
                return BadRequest(new { error = "Mã token đặt lại mật khẩu không hợp lệ.", code = "invalid" });
            }

            if (!PasswordPolicy.Validate(request.NewPassword, out var passwordError))
            {
                return BadRequest(new { error = passwordError });
            }

            var tokenHash = HashToken(request.Token);

            lock (_fileDb)
            {
                var user = _fileDb.Users.Values.FirstOrDefault(u =>
                    !string.IsNullOrEmpty(u.PasswordResetTokenHash) &&
                    u.PasswordResetTokenHash == tokenHash);

                if (user == null)
                {
                    return BadRequest(new { error = "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng.", code = "invalid_or_used" });
                }

                if (user.PasswordResetTokenExpiresAt.HasValue &&
                    user.PasswordResetTokenExpiresAt.Value < DateTime.UtcNow)
                {
                    user.PasswordResetTokenHash = null;
                    _fileDb.Save();
                    return BadRequest(new { error = "Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng gửi yêu cầu mới.", code = "expired" });
                }

                // Apply new password
                user.PasswordHash = PasswordHasher.HashPassword(request.NewPassword);
                user.Password = string.Empty;

                // Invalidate reset token immediately (single-use guarantee)
                user.PasswordResetTokenHash = null;
                user.PasswordResetTokenExpiresAt = null;
                user.PasswordChangedAt = DateTime.UtcNow;

                // Revoke existing sessions / security stamp refresh
                user.SecurityStamp = Guid.NewGuid().ToString("N");

                _fileDb.Save();

                return Ok(new
                {
                    message = "Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập bằng mật khẩu mới."
                });
            }
        }

        // ======================================================================
        // GET api/auth/me
        // ======================================================================
        [Authorize]
        [HttpGet("me")]
        public IActionResult GetMe([FromQuery] string? userId = null)
        {
            var authenticatedUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(authenticatedUserId))
            {
                return Unauthorized(new { error = "Không tìm thấy danh tính người dùng từ token xác thực." });
            }

            if (!_fileDb.Users.TryGetValue(authenticatedUserId, out var user))
            {
                return NotFound(new { error = "Không tìm thấy người dùng." });
            }

            lock (_fileDb)
            {
                if (user.CheckAndSyncSubscriptionExpiry())
                {
                    _fileDb.Save();
                }
            }

            return Ok(new
            {
                id = user.Id,
                fullname = user.Fullname,
                email = user.Email,
                username = user.Username,
                role = user.Role,
                subscription = user.Subscription,
                subscriptionExpiry = user.SubscriptionExpiry,
                subscriptionDate = user.SubscriptionDate,
                scheduledDowngrade = user.ScheduledDowngrade,
                phone = user.Phone,
                bio = user.Bio,
                targetRole = user.TargetRole,
                experienceLevel = user.ExperienceLevel,
                skills = user.Skills ?? new(),
                location = user.Location,
                createdAt = user.CreatedAt,
                updatedAt = user.UpdatedAt,
                emailVerified = user.EmailVerified
            });
        }

        // ======================================================================
        // DEV EMAIL INBOX (Development / Testing Inspection Only)
        // ======================================================================
        [HttpGet("/api/dev/emails")]
        public IActionResult GetDevInbox([FromQuery] string? to = null)
        {
            if (_environment.IsProduction())
            {
                return NotFound();
            }

            if (!string.IsNullOrWhiteSpace(to))
            {
                var email = _inboxStore.GetLatestFor(to);
                return Ok(email != null ? new[] { email } : Array.Empty<StoredEmail>());
            }

            return Ok(_inboxStore.GetAll());
        }

        [HttpDelete("/api/dev/emails")]
        public IActionResult ClearDevInbox()
        {
            if (_environment.IsProduction())
            {
                return NotFound();
            }

            _inboxStore.Clear();
            return Ok(new { message = "Inbox store cleared" });
        }

        // ======================================================================
        // HELPERS
        // ======================================================================
        private static bool IsValidEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email) || email.Contains(' ')) return false;
            var parts = email.Split('@');
            if (parts.Length != 2) return false;
            var local = parts[0];
            var domain = parts[1];
            if (string.IsNullOrEmpty(local) || string.IsNullOrEmpty(domain)) return false;
            if (!domain.Contains('.') || domain.StartsWith('.') || domain.EndsWith('.')) return false;
            return true;
        }

        private static string GenerateSecureToken()
        {
            byte[] bytes = RandomNumberGenerator.GetBytes(32);
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        private static string HashToken(string token)
        {
            using var sha256 = SHA256.Create();
            var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(token.Trim()));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        private string ResolveBaseUrl()
        {
            if (!string.IsNullOrWhiteSpace(_emailOptions.FrontendBaseUrl))
            {
                return _emailOptions.FrontendBaseUrl.TrimEnd('/');
            }

            var request = HttpContext.Request;
            var scheme = request.Scheme;
            var host = request.Host.Value;
            return $"{scheme}://{host}".TrimEnd('/');
        }
    }
}
