using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using System.Security.Claims;
using backend.Models;
using backend.Services;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/cv")]
    [Authorize]
    public class CVController : ControllerBase
    {
        private readonly FileDb _fileDb;

        public CVController(FileDb fileDb)
        {
            _fileDb = fileDb;
        }

        // GET api/cv — get active CV of authenticated user
        [HttpGet]
        public IActionResult GetMyCV()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { error = "Không tìm thấy danh tính người dùng từ token xác thực." });
            }

            var cv = _fileDb.CVs.Values
                .FirstOrDefault(c => c.UserId == userId && c.IsActive);

            if (cv == null)
            {
                return NotFound(new { message = "Chưa có CV nào được lưu cho tài khoản này." });
            }

            return Ok(ToCvResponse(cv));
        }

        // GET api/cv/user/{userId} — BOLA/IDOR protected CV retrieval
        [HttpGet("user/{userId}")]
        public IActionResult GetUserCV(string userId)
        {
            var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

            if (string.IsNullOrEmpty(currentUserId))
            {
                return Unauthorized(new { error = "Không tìm thấy danh tính người dùng từ token xác thực." });
            }

            // IDOR / BOLA authorization check
            bool isSelf = currentUserId.Equals(userId, StringComparison.OrdinalIgnoreCase);
            bool isPrivileged = role.Equals("admin", StringComparison.OrdinalIgnoreCase) ||
                               role.Equals("manager", StringComparison.OrdinalIgnoreCase);

            if (!isSelf && !isPrivileged)
            {
                return StatusCode(403, new { error = "Bạn không có quyền truy cập CV của người dùng này." });
            }

            var cv = _fileDb.CVs.Values
                .FirstOrDefault(c => c.UserId == userId && c.IsActive);

            if (cv == null)
            {
                return NotFound(new { message = "Không tìm thấy CV của người dùng." });
            }

            return Ok(ToCvResponse(cv));
        }

        // POST api/cv — create or update active CV for authenticated user
        [HttpPost]
        public IActionResult SaveCV([FromBody] SaveCvRequest request)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { error = "Không tìm thấy danh tính người dùng từ token xác thực." });
            }

            if (request == null || string.IsNullOrWhiteSpace(request.RawText))
            {
                return BadRequest(new { error = "Nội dung CV không được để trống." });
            }

            if (request.RawText.Length > 100000)
            {
                return BadRequest(new { error = "Nội dung CV vượt quá giới hạn độ dài cho phép (100.000 ký tự)." });
            }

            if (request.FileSize < 0)
            {
                return BadRequest(new { error = "Dung lượng tệp (FileSize) không được là số âm." });
            }

            if (request.FileSize > 20 * 1024 * 1024)
            {
                return BadRequest(new { error = "Dung lượng tệp vượt quá giới hạn tối đa cho phép (20 MB)." });
            }

            if (!string.IsNullOrWhiteSpace(request.FileType))
            {
                var cleanExt = request.FileType.Trim().TrimStart('.').ToLowerInvariant();
                var allowed = new[] { "pdf", "docx", "doc", "txt" };
                if (!allowed.Contains(cleanExt))
                {
                    return BadRequest(new { error = "Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, DOCX, DOC hoặc TXT." });
                }
                request.FileType = cleanExt;
            }

            if (request.ReadinessScore.HasValue && (request.ReadinessScore.Value < 0 || request.ReadinessScore.Value > 100))
            {
                return BadRequest(new { error = "Điểm sẵn sàng (ReadinessScore) phải nằm trong khoảng từ 0 đến 100." });
            }

            var safeFileName = !string.IsNullOrWhiteSpace(request.FileName) 
                ? System.IO.Path.GetFileName(request.FileName.Trim()) 
                : null;

            if (!string.IsNullOrWhiteSpace(safeFileName))
            {
                var fileExt = System.IO.Path.GetExtension(safeFileName).TrimStart('.').ToLowerInvariant();
                var allowedExts = new[] { "pdf", "docx", "doc", "txt" };
                if (!string.IsNullOrEmpty(fileExt) && !allowedExts.Contains(fileExt))
                {
                    return BadRequest(new { error = "Tên tệp đính kèm có định dạng không được hỗ trợ. Chỉ chấp nhận .pdf, .docx, .doc hoặc .txt." });
                }
            }

            CandidateCV cv;
            lock (_fileDb)
            {
                var existing = _fileDb.CVs.Values
                    .FirstOrDefault(c => c.UserId == userId && c.IsActive);

                if (existing != null)
                {
                    cv = existing;
                    cv.FileName = !string.IsNullOrWhiteSpace(safeFileName) ? safeFileName : cv.FileName;
                    cv.FileType = !string.IsNullOrWhiteSpace(request.FileType) ? request.FileType.Trim() : cv.FileType;
                    cv.FileSize = request.FileSize > 0 ? request.FileSize : cv.FileSize;
                    cv.RawText = request.RawText.Trim();
                    if (request.ExtractedSkills != null && request.ExtractedSkills.Count > 0)
                    {
                        cv.ExtractedSkills = request.ExtractedSkills;
                    }
                    if (!string.IsNullOrWhiteSpace(request.ExtractedRole))
                    {
                        cv.ExtractedRole = request.ExtractedRole.Trim();
                    }
                    if (!string.IsNullOrWhiteSpace(request.Summary))
                    {
                        cv.Summary = request.Summary.Trim();
                    }
                    if (request.ReadinessScore.HasValue)
                    {
                        cv.ReadinessScore = request.ReadinessScore.Value;
                    }
                    cv.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    var cvId = "cv_" + Guid.NewGuid().ToString("N")[..12];
                    cv = new CandidateCV
                    {
                        Id = cvId,
                        UserId = userId,
                        FileName = !string.IsNullOrWhiteSpace(safeFileName) ? safeFileName : "cv.pdf",
                        FileType = !string.IsNullOrWhiteSpace(request.FileType) ? request.FileType.Trim() : "pdf",
                        FileSize = request.FileSize > 0 ? request.FileSize : request.RawText.Length,
                        RawText = request.RawText.Trim(),
                        ExtractedSkills = request.ExtractedSkills ?? new(),
                        ExtractedRole = request.ExtractedRole,
                        Summary = request.Summary,
                        ReadinessScore = request.ReadinessScore ?? 85,
                        IsActive = true,
                        UploadedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _fileDb.CVs[cvId] = cv;
                }

                _fileDb.Save();
            }

            return Ok(ToCvResponse(cv));
        }

        // DELETE api/cv — deactivate / delete authenticated user CV
        [HttpDelete]
        public IActionResult DeleteCV()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { error = "Không tìm thấy danh tính người dùng từ token xác thực." });
            }

            bool removed = false;
            lock (_fileDb)
            {
                var existing = _fileDb.CVs.Values
                    .FirstOrDefault(c => c.UserId == userId && c.IsActive);

                if (existing != null)
                {
                    existing.IsActive = false;
                    existing.UpdatedAt = DateTime.UtcNow;
                    _fileDb.Save();
                    removed = true;
                }
            }

            if (!removed)
            {
                return NotFound(new { error = "Không tìm thấy CV để xóa." });
            }

            return Ok(new { message = "Đã xóa CV thành công." });
        }

        private static CandidateCvResponse ToCvResponse(CandidateCV cv)
        {
            return new CandidateCvResponse
            {
                Id = cv.Id,
                UserId = cv.UserId,
                FileName = cv.FileName,
                FileType = cv.FileType,
                FileSize = cv.FileSize,
                RawText = cv.RawText,
                ExtractedSkills = cv.ExtractedSkills ?? new(),
                ExtractedRole = cv.ExtractedRole,
                Summary = cv.Summary,
                ReadinessScore = cv.ReadinessScore,
                IsActive = cv.IsActive,
                UploadedAt = cv.UploadedAt,
                UpdatedAt = cv.UpdatedAt
            };
        }
    }
}
