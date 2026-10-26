using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System;
using System.Security.Claims;
using backend.Models;
using backend.Services;
using backend.Services.Security;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly FileDb _fileDb;
        private readonly JwtTokenService _jwtService;

        public AuthController(FileDb fileDb, JwtTokenService jwtService)
        {
            _fileDb = fileDb;
            _jwtService = jwtService;
        }

        // POST api/auth/register
        [EnableRateLimiting("auth-policy")]
        [HttpPost("register")]
        public IActionResult Register([FromBody] RegisterRequest request)
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

            if (request.Password.Length < 6)
            {
                return BadRequest(new { error = "Mật khẩu phải có độ dài tối thiểu 6 ký tự." });
            }

            // Check if email already exists
            foreach (var existingUser in _fileDb.Users.Values)
            {
                if (existingUser.Email.Equals(request.Email.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { error = "Email này đã được sử dụng." });
                }
            }

            // Generate Username from email prefix if not supplied
            var username = !string.IsNullOrWhiteSpace(request.Username)
                ? request.Username.Trim().ToLower()
                : request.Email.Split('@')[0].ToLower();

            // Ensure username uniqueness
            var baseUsername = username;
            var suffix = 1;
            while (_fileDb.Users.Values.Any(u => u.Username.Equals(username, StringComparison.OrdinalIgnoreCase)))
            {
                username = $"{baseUsername}{suffix++}";
            }

            var userId = "user_" + Guid.NewGuid().ToString("N")[..8];
            var passwordHash = PasswordHasher.HashPassword(request.Password);

            // Security Hardening: Never trust self-assigned Role or Subscription from untrusted registration payloads.
            // Role is strictly forced to "user"; Subscription is strictly forced to "free".
            var newUser = new User
            {
                Id = userId,
                Fullname = request.Fullname.Trim(),
                Email = request.Email.Trim().ToLower(),
                Username = username,
                Password = string.Empty, // Plaintext password strictly cleared for security
                PasswordHash = passwordHash,
                CreatedAt = DateTime.UtcNow,
                Role = "user",
                Subscription = "free"
            };

            _fileDb.Users[userId] = newUser;
            _fileDb.Save();

            var token = _jwtService.GenerateToken(newUser);

            return Ok(new AuthResponse
            {
                Id = userId,
                Fullname = newUser.Fullname,
                Email = newUser.Email,
                Username = newUser.Username,
                Token = token,
                Role = newUser.Role,
                Subscription = newUser.Subscription,
                SubscriptionExpiry = newUser.SubscriptionExpiry
            });
        }

        // POST api/auth/login
        [EnableRateLimiting("auth-policy")]
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

            var loginInput = request.Email.Trim().ToLower();

            // Find user by email or username
            var user = _fileDb.Users.Values.FirstOrDefault(u =>
                u.Email.Equals(loginInput, StringComparison.OrdinalIgnoreCase) ||
                u.Username.Equals(loginInput, StringComparison.OrdinalIgnoreCase));

            if (user == null)
            {
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
                user.PasswordHash = PasswordHasher.HashPassword(request.Password);
                user.Password = string.Empty;
                _fileDb.Save();
            }

            if (!passwordValid)
            {
                return Unauthorized(new { error = "Email/username hoặc mật khẩu không chính xác." });
            }

            lock (_fileDb)
            {
                if (user.CheckAndSyncSubscriptionExpiry())
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

        // GET api/auth/me — refresh user info (subscription, role) derived securely from authenticated JWT
        [Authorize]
        [HttpGet("me")]
        public IActionResult GetMe([FromQuery] string? userId = null)
        {
            // Identity is strictly server-derived from JWT ClaimsPrincipal
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
                updatedAt = user.UpdatedAt
            });

        }

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
    }
}
