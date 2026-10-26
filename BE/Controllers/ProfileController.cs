using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Security.Claims;
using backend.Models;
using backend.Services;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/profile")]
    [Authorize]
    public class ProfileController : ControllerBase
    {
        private readonly FileDb _fileDb;

        public ProfileController(FileDb fileDb)
        {
            _fileDb = fileDb;
        }

        // GET api/profile — get authenticated user profile (SSOT)
        [HttpGet]
        public IActionResult GetProfile()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { error = "Không tìm thấy danh tính người dùng từ token xác thực." });
            }

            if (!_fileDb.Users.TryGetValue(userId, out var user))
            {
                return NotFound(new { error = "Không tìm thấy hồ sơ người dùng." });
            }

            return Ok(ToProfileResponse(user));
        }

        // PUT api/profile — update profile fields with strict privilege boundaries
        [HttpPut]
        public IActionResult UpdateProfile([FromBody] UpdateProfileRequest request)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { error = "Không tìm thấy danh tính người dùng từ token xác thực." });
            }

            if (request == null)
            {
                return BadRequest(new { error = "Dữ liệu cập nhật không hợp lệ." });
            }

            UserProfileResponse? response = null;

            bool updated = _fileDb.UpdateUser(userId, user =>
            {
                if (!string.IsNullOrWhiteSpace(request.Fullname))
                {
                    user.Fullname = request.Fullname.Trim();
                }

                if (request.Phone != null)
                {
                    user.Phone = request.Phone.Trim();
                }

                if (request.Bio != null)
                {
                    user.Bio = request.Bio.Trim();
                }

                if (request.TargetRole != null)
                {
                    user.TargetRole = request.TargetRole.Trim();
                }

                if (request.ExperienceLevel != null)
                {
                    user.ExperienceLevel = request.ExperienceLevel.Trim();
                }

                if (request.Skills != null)
                {
                    user.Skills = request.Skills;
                }

                if (request.Location != null)
                {
                    user.Location = request.Location.Trim();
                }

                user.UpdatedAt = DateTime.UtcNow;
                response = ToProfileResponse(user);
            });

            if (!updated || response == null)
            {
                return NotFound(new { error = "Không tìm thấy hồ sơ người dùng để cập nhật." });
            }

            return Ok(response);
        }

        private static UserProfileResponse ToProfileResponse(User user)
        {
            return new UserProfileResponse
            {
                Id = user.Id,
                Fullname = user.Fullname,
                Email = user.Email,
                Username = user.Username,
                Phone = user.Phone,
                Bio = user.Bio,
                TargetRole = user.TargetRole,
                ExperienceLevel = user.ExperienceLevel,
                Skills = user.Skills ?? new(),
                Location = user.Location,
                Role = user.Role,
                Subscription = user.Subscription,
                SubscriptionExpiry = user.SubscriptionExpiry,
                SubscriptionDate = user.SubscriptionDate,
                CreatedAt = user.CreatedAt,
                UpdatedAt = user.UpdatedAt
            };
        }
    }
}
