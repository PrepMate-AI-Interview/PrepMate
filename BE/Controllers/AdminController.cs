using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using System.Threading.Tasks;
using backend.Models;
using backend.Services;
using backend.Services.Security;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/admin")]
    public class AdminController : ControllerBase
    {
        private readonly FileDb _fileDb;

        public AdminController(FileDb fileDb)
        {
            _fileDb = fileDb;
        }

        // GET api/admin/users
        [Authorize(Roles = "admin,manager")]
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            await _fileDb.RefreshFromCloudAsync(TimeSpan.FromSeconds(1));

            var userList = _fileDb.Users.Values
                .OrderByDescending(u => u.CreatedAt)
                .Select(u => new
                {
                    id = u.Id,
                    fullname = u.Fullname,
                    email = u.Email,
                    username = u.Username,
                    subscription = u.Subscription,
                    subscriptionDate = u.SubscriptionDate,
                    subscriptionExpiry = u.SubscriptionExpiry,
                    createdAt = u.CreatedAt,
                    role = u.Role
                }).ToList();

            return Ok(userList);
        }

        public class CreateAdminUserRequest
        {
            public string Fullname { get; set; } = string.Empty;
            public string Username { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
            public string Role { get; set; } = "user";
            public string Subscription { get; set; } = "free";
        }

        public class UpdateAdminUserRequest
        {
            public string? Fullname { get; set; }
            public string? Email { get; set; }
            public string? Role { get; set; }
            public string? Subscription { get; set; }
            public string? SubscriptionExpiry { get; set; }
        }

        // POST api/admin/users
        [Authorize(Roles = "admin")]
        [HttpPost("users")]
        public async Task<IActionResult> CreateUser([FromBody] CreateAdminUserRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Fullname) ||
                string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new { error = "Vui lòng nhập đầy đủ họ tên, email và mật khẩu." });
            }

            await _fileDb.RefreshFromCloudAsync(TimeSpan.FromSeconds(1));

            var email = request.Email.Trim().ToLowerInvariant();
            var username = string.IsNullOrWhiteSpace(request.Username)
                ? email.Split('@')[0]
                : request.Username.Trim().ToLowerInvariant();

            if (_fileDb.Users.Values.Any(u => u.Email.Equals(email, StringComparison.OrdinalIgnoreCase)
                                           || u.Username.Equals(username, StringComparison.OrdinalIgnoreCase)))
            {
                return BadRequest(new { error = "Tên đăng nhập hoặc Email này đã tồn tại trong hệ thống." });
            }

            var targetRole = (request.Role ?? "user").Trim().ToLowerInvariant();
            if (targetRole != "user" && targetRole != "manager" && targetRole != "admin")
            {
                targetRole = "user";
            }

            var isPro = string.Equals(request.Subscription, "pro", StringComparison.OrdinalIgnoreCase);
            var userId = "user_" + Guid.NewGuid().ToString("N")[..8];
            var newUser = new User
            {
                Id = userId,
                Fullname = request.Fullname.Trim(),
                Email = email,
                Username = username,
                Password = string.Empty,
                PasswordHash = PasswordHasher.HashPassword(request.Password),
                Role = targetRole,
                Subscription = isPro ? "pro" : "free",
                SubscriptionDate = isPro ? DateTime.UtcNow.ToString("o") : null,
                SubscriptionExpiry = isPro ? DateTime.UtcNow.AddDays(30).ToString("o") : null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                EmailVerified = true,
                SecurityStamp = Guid.NewGuid().ToString("N")
            };

            _fileDb.Users[userId] = newUser;
            _fileDb.Save();
            if (_fileDb.PostgresSync != null)
            {
                await _fileDb.PostgresSync.FlushStagedChangesAsync();
            }

            return Ok(new
            {
                id = newUser.Id,
                fullname = newUser.Fullname,
                email = newUser.Email,
                username = newUser.Username,
                role = newUser.Role,
                subscription = newUser.Subscription,
                subscriptionDate = newUser.SubscriptionDate,
                subscriptionExpiry = newUser.SubscriptionExpiry,
                createdAt = newUser.CreatedAt
            });
        }

        // PUT api/admin/users/{userId}
        [Authorize(Roles = "admin")]
        [HttpPut("users/{userId}")]
        public async Task<IActionResult> UpdateUser(string userId, [FromBody] UpdateAdminUserRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { error = "Dữ liệu cập nhật không hợp lệ." });
            }

            await _fileDb.RefreshFromCloudAsync(TimeSpan.FromSeconds(1));

            if (!_fileDb.Users.TryGetValue(userId, out var user))
            {
                return NotFound(new { error = "Không tìm thấy người dùng." });
            }

            if (!string.IsNullOrWhiteSpace(request.Fullname))
            {
                user.Fullname = request.Fullname.Trim();
            }

            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                var nextEmail = request.Email.Trim().ToLowerInvariant();
                if (_fileDb.Users.Values.Any(u => u.Id != userId && u.Email.Equals(nextEmail, StringComparison.OrdinalIgnoreCase)))
                {
                    return BadRequest(new { error = "Email này đã thuộc về tài khoản khác." });
                }
                user.Email = nextEmail;
            }

            if (!string.IsNullOrWhiteSpace(request.Role) && userId != "user_admin")
            {
                var targetRole = request.Role.Trim().ToLowerInvariant();
                if (targetRole == "user" || targetRole == "manager" || targetRole == "admin")
                {
                    user.Role = targetRole;
                }
            }

            if (!string.IsNullOrWhiteSpace(request.Subscription))
            {
                var isPro = string.Equals(request.Subscription, "pro", StringComparison.OrdinalIgnoreCase)
                         || string.Equals(request.Subscription, "premium", StringComparison.OrdinalIgnoreCase);
                user.Subscription = isPro ? "pro" : "free";
                user.SubscriptionDate = isPro ? (user.SubscriptionDate ?? DateTime.UtcNow.ToString("o")) : null;
                user.SubscriptionExpiry = isPro ? request.SubscriptionExpiry : null;
            }

            user.UpdatedAt = DateTime.UtcNow;
            _fileDb.Save();
            if (_fileDb.PostgresSync != null)
            {
                await _fileDb.PostgresSync.FlushStagedChangesAsync();
            }

            return Ok(new { message = $"Đã cập nhật tài khoản {user.Fullname}." });
        }

        // GET api/admin/sessions-summary
        [Authorize(Roles = "admin,manager")]
        [HttpGet("sessions-summary")]
        public async Task<IActionResult> GetSessionsSummary()
        {
            await _fileDb.RefreshFromCloudAsync(TimeSpan.FromSeconds(1));

            var allSessions = _fileDb.Sessions.Values.ToList();
            var completed = allSessions
                .Where(s => string.Equals(s.Status, "completed", StringComparison.OrdinalIgnoreCase)
                         || (s.Report?.OverallScore > 0)
                         || (s.Evaluation?.OverallScore > 0))
                .ToList();

            var scoredValues = completed
                .Select(s => s.Evaluation?.OverallScore ?? s.Report?.OverallScore ?? 0)
                .Where(score => score > 0)
                .ToList();

            int avgScore = scoredValues.Count > 0
                ? (int)Math.Round(scoredValues.Average())
                : 0;

            return Ok(new
            {
                totalSessions = allSessions.Count,
                completedSessions = completed.Count,
                averageScore = avgScore
            });
        }

        // POST api/admin/users/{userId}/upgrade
        [Authorize(Roles = "admin")]
        [HttpPost("users/{userId}/upgrade")]
        public async Task<IActionResult> UpgradeUser(string userId)
        {
            await _fileDb.RefreshFromCloudAsync(TimeSpan.FromSeconds(1));

            if (!_fileDb.Users.TryGetValue(userId, out var user))
            {
                return NotFound(new { error = "Không tìm thấy người dùng." });
            }

            user.Subscription = "pro";
            user.SubscriptionDate = DateTime.UtcNow.ToString("o");
            user.SubscriptionExpiry = DateTime.UtcNow.AddDays(30).ToString("o");
            user.UpdatedAt = DateTime.UtcNow;
            _fileDb.Save();
            if (_fileDb.PostgresSync != null)
            {
                await _fileDb.PostgresSync.FlushStagedChangesAsync();
            }

            return Ok(new { message = $"Đã nâng cấp thành viên {user.Fullname} lên gói Pro thành công." });
        }

        // POST api/admin/users/{userId}/downgrade
        [Authorize(Roles = "admin")]
        [HttpPost("users/{userId}/downgrade")]
        public async Task<IActionResult> DowngradeUser(string userId)
        {
            await _fileDb.RefreshFromCloudAsync(TimeSpan.FromSeconds(1));

            if (!_fileDb.Users.TryGetValue(userId, out var user))
            {
                return NotFound(new { error = "Không tìm thấy người dùng." });
            }

            user.Subscription = "free";
            user.SubscriptionDate = null;
            user.SubscriptionExpiry = null;
            user.UpdatedAt = DateTime.UtcNow;
            _fileDb.Save();
            if (_fileDb.PostgresSync != null)
            {
                await _fileDb.PostgresSync.FlushStagedChangesAsync();
            }

            return Ok(new { message = $"Đã hạ cấp thành viên {user.Fullname} xuống gói Free." });
        }

        public class ChangeRoleRequest
        {
            public string Role { get; set; } = string.Empty;
        }

        // POST api/admin/users/{userId}/role
        [Authorize(Roles = "admin")]
        [HttpPost("users/{userId}/role")]
        public async Task<IActionResult> ChangeUserRole(string userId, [FromBody] ChangeRoleRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Role))
            {
                return BadRequest(new { error = "Vai trò không hợp lệ. Chỉ chấp nhận: user, manager, admin." });
            }

            // Reject elevated casing, homoglyphs, zero-width spaces, and unauthorized roles
            if (request.Role == "Admin" || request.Role == "ADMIN" ||
                request.Role.Any(c => c > 127 || char.IsControl(c)) ||
                request.Role.Equals("superadmin", StringComparison.OrdinalIgnoreCase) ||
                request.Role.Equals("root", StringComparison.OrdinalIgnoreCase) ||
                request.Role.Equals("administrator", StringComparison.OrdinalIgnoreCase) ||
                request.Role.Equals("unknown", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { error = "Vai trò không hợp lệ. Chỉ chấp nhận: user, manager, admin." });
            }

            await _fileDb.RefreshFromCloudAsync(TimeSpan.FromSeconds(1));

            if (!_fileDb.Users.TryGetValue(userId, out var user))
            {
                return NotFound(new { error = "Không tìm thấy người dùng." });
            }

            if (userId == "user_admin")
            {
                return BadRequest(new { error = "Không thể thay đổi vai trò của Admin tối cao." });
            }

            var targetRole = request.Role.Trim().ToLowerInvariant();
            if (targetRole != "user" && targetRole != "manager" && targetRole != "admin")
            {
                return BadRequest(new { error = "Vai trò không hợp lệ. Chỉ chấp nhận: user, manager, admin." });
            }

            user.Role = targetRole;
            user.UpdatedAt = DateTime.UtcNow;
            _fileDb.Save();
            if (_fileDb.PostgresSync != null)
            {
                await _fileDb.PostgresSync.FlushStagedChangesAsync();
            }

            return Ok(new { message = $"Đã cập nhật vai trò của thành viên {user.Fullname} thành {targetRole}." });
        }

        // DELETE api/admin/users/{userId}
        [Authorize(Roles = "admin")]
        [HttpDelete("users/{userId}")]
        public async Task<IActionResult> DeleteUser(string userId)
        {
            if (userId == "user_admin")
            {
                return BadRequest(new { error = "Không thể xóa tài khoản Admin tối cao." });
            }

            await _fileDb.RefreshFromCloudAsync(TimeSpan.FromSeconds(1));

            if (!_fileDb.Users.TryRemove(userId, out var user))
            {
                return NotFound(new { error = "Không tìm thấy người dùng." });
            }

            // Remove associated sessions of this user
            var sessionsToDelete = _fileDb.Sessions.Where(kvp => kvp.Value.UserId == userId).Select(kvp => kvp.Key).ToList();
            foreach (var key in sessionsToDelete)
            {
                _fileDb.Sessions.TryRemove(key, out _);
            }

            _fileDb.Save();
            if (_fileDb.PostgresSync != null)
            {
                await _fileDb.PostgresSync.FlushStagedChangesAsync();
            }

            return Ok(new { message = $"Đã xóa thành viên {user.Fullname} và các lịch sử phỏng vấn liên quan." });
        }

        // GET api/admin/transactions
        [Authorize(Roles = "admin,manager")]
        [HttpGet("transactions")]
        public async Task<IActionResult> GetTransactions()
        {
            await _fileDb.RefreshFromCloudAsync(TimeSpan.FromSeconds(1));

            var transactionList = _fileDb.Transactions
                .OrderByDescending(t => t.Timestamp)
                .ToList();

            return Ok(transactionList);
        }
    }
}
