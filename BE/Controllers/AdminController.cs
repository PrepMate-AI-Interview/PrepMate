using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using backend.Models;
using backend.Services;

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
        public IActionResult GetUsers()
        {
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

        // POST api/admin/users/{userId}/upgrade
        [Authorize(Roles = "admin")]
        [HttpPost("users/{userId}/upgrade")]
        public IActionResult UpgradeUser(string userId)
        {
            if (!_fileDb.Users.TryGetValue(userId, out var user))
            {
                return NotFound(new { error = "Không tìm thấy người dùng." });
            }

            user.Subscription = "pro";
            user.SubscriptionDate = DateTime.UtcNow.ToString("o");
            user.SubscriptionExpiry = DateTime.UtcNow.AddDays(30).ToString("o");
            _fileDb.Save();

            return Ok(new { message = $"Đã nâng cấp thành viên {user.Fullname} lên gói Pro thành công." });
        }

        // POST api/admin/users/{userId}/downgrade
        [Authorize(Roles = "admin")]
        [HttpPost("users/{userId}/downgrade")]
        public IActionResult DowngradeUser(string userId)
        {
            if (!_fileDb.Users.TryGetValue(userId, out var user))
            {
                return NotFound(new { error = "Không tìm thấy người dùng." });
            }

            user.Subscription = "free";
            user.SubscriptionDate = null;
            user.SubscriptionExpiry = null;
            _fileDb.Save();

            return Ok(new { message = $"Đã hạ cấp thành viên {user.Fullname} xuống gói Free." });
        }

        public class ChangeRoleRequest
        {
            public string Role { get; set; } = string.Empty;
        }

        // POST api/admin/users/{userId}/role
        [Authorize(Roles = "admin")]
        [HttpPost("users/{userId}/role")]
        public IActionResult ChangeUserRole(string userId, [FromBody] ChangeRoleRequest request)
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
            _fileDb.Save();

            return Ok(new { message = $"Đã cập nhật vai trò của thành viên {user.Fullname} thành {targetRole}." });
        }

        // DELETE api/admin/users/{userId}
        [Authorize(Roles = "admin")]
        [HttpDelete("users/{userId}")]
        public IActionResult DeleteUser(string userId)
        {
            if (userId == "user_admin")
            {
                return BadRequest(new { error = "Không thể xóa tài khoản Admin tối cao." });
            }

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

            return Ok(new { message = $"Đã xóa thành viên {user.Fullname} và các lịch sử phỏng vấn liên quan." });
        }

        // GET api/admin/transactions
        [Authorize(Roles = "admin,manager")]
        [HttpGet("transactions")]
        public IActionResult GetTransactions()
        {
            var transactionList = _fileDb.Transactions
                .OrderByDescending(t => t.Timestamp)
                .ToList();

            return Ok(transactionList);
        }
    }
}
