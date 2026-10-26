using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using backend.Models;
using backend.Services;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/payment")]
    public class PaymentController : ControllerBase
    {
        private readonly FileDb _fileDb;

        // Authoritative, structured plan definitions for multi-plan readiness
        public static readonly IReadOnlyList<SubscriptionPlan> AvailablePlans = new List<SubscriptionPlan>
        {
            new SubscriptionPlan
            {
                Id = "free",
                Name = "Gói Trải Nghiệm (Miễn Phí)",
                Description = "Làm quen với AI phỏng vấn, thử nghiệm câu hỏi cơ bản và kiểm tra không gian thiết bị.",
                Price = 0,
                Currency = "VND",
                DurationDays = 0,
                TierLevel = 0,
                IsActive = true,
                Features = new List<string>
                {
                    "3 lượt phỏng vấn AI mô phỏng mỗi tháng",
                    "Trải nghiệm phòng phỏng vấn 1-1 (Giọng nói & Tương tác)",
                    "Báo cáo đánh giá STAR & chấm điểm năng lực sau buổi thi",
                    "Kiểm tra thiết bị preflight: camera, mic & không gian phòng",
                    "Truy cập ngân hàng câu hỏi phỏng vấn theo chuyên ngành"
                }
            },
            new SubscriptionPlan
            {
                Id = "pro",
                Name = "Gói Hội Viên Toàn Diện PrepMate PRO",
                Description = "Mở khóa toàn bộ trí tuệ nhân tạo thích ứng, giọng nói ElevenLabs và kịch bản theo mọi link JD.",
                Price = 99000,
                Currency = "VND",
                DurationDays = 30,
                TierLevel = 1,
                IsActive = true,
                Features = new List<string>
                {
                    "Không giới hạn số lượt phỏng vấn mô phỏng AI 1-1",
                    "Mở khóa phân tích & tối ưu CV chi tiết bằng AI",
                    "Gợi ý cơ hội việc làm cá nhân hóa dựa trên hồ sơ & kỹ năng",
                    "Lộ trình phát triển sự nghiệp cá nhân hóa theo vị trí mục tiêu",
                    "Đường truyền ưu tiên (Bypass Rate Limit), gọi AI không độ trễ",
                    "Lưu trữ toàn bộ lịch sử phỏng vấn & theo dõi tiến độ chi tiết"
                }
            }
        };

        public PaymentController(FileDb fileDb)
        {
            _fileDb = fileDb;
        }

        // GET api/payment/plans — Public catalog of plans
        [HttpGet("plans")]
        [AllowAnonymous]
        public IActionResult GetPlans()
        {
            return Ok(AvailablePlans);
        }

        // GET api/payment/subscription — Check current subscription status & entitlement
        [HttpGet("subscription")]
        [Authorize]
        public IActionResult GetSubscription()
        {
            var callerId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(callerId) || !_fileDb.Users.TryGetValue(callerId, out var user))
            {
                return Unauthorized(new { error = "Không tìm thấy người dùng." });
            }

            lock (_fileDb)
            {
                if (user.CheckAndSyncSubscriptionExpiry())
                {
                    _fileDb.Save();
                }
            }

            var isActive = user.IsSubscriptionActive();
            return Ok(new
            {
                userId = user.Id,
                subscription = user.Subscription,
                status = user.Subscription,
                isActive = isActive,
                subscriptionDate = user.SubscriptionDate,
                subscriptionExpiry = user.SubscriptionExpiry,
                scheduledDowngrade = user.ScheduledDowngrade,
                canPurchasePro = !isActive
            });
        }

        // GET api/payment/validate-checkout?plan=pro — Pre-checkout business rule check
        [HttpGet("validate-checkout")]
        [Authorize]
        public IActionResult ValidateCheckout([FromQuery] string plan = "pro")
        {
            var callerId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(callerId) || !_fileDb.Users.TryGetValue(callerId, out var user))
            {
                return Unauthorized(new { error = "Không tìm thấy người dùng." });
            }

            lock (_fileDb)
            {
                if (user.CheckAndSyncSubscriptionExpiry())
                {
                    _fileDb.Save();
                }
            }

            if (string.Equals(plan, "free", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    canCheckout = false,
                    reason = "free_plan",
                    error = "Gói Miễn phí không yêu cầu thanh toán."
                });
            }

            if (string.Equals(plan, "pro", StringComparison.OrdinalIgnoreCase))
            {
                if (user.IsSubscriptionActive())
                {
                    return Conflict(new
                    {
                        canCheckout = false,
                        error = "DUPLICATE_ACTIVE_SUBSCRIPTION",
                        message = $"Tài khoản của bạn đang sử dụng gói Pro còn hạn (đến {user.SubscriptionExpiry}). Không thể tạo giao dịch mua trùng gói đang hoạt động.",
                        reason = "already_active_pro",
                        subscription = user.Subscription,
                        subscriptionExpiry = user.SubscriptionExpiry
                    });
                }

                return Ok(new
                {
                    canCheckout = true,
                    valid = true,
                    plan = "pro",
                    planName = "Gói Hội Viên Toàn Diện PrepMate PRO",
                    price = 99000,
                    currency = "VND",
                    durationDays = 30
                });
            }

            return BadRequest(new { canCheckout = false, error = "Gói dịch vụ không tồn tại." });
        }

        public class DowngradeRequest
        {
            public string? Mode { get; set; } = "end_of_period"; // "end_of_period" | "immediate"
            public bool? Scheduled { get; set; }
        }

        // POST api/payment/downgrade — Safe downgrade to free without checkout or fee
        [HttpPost("downgrade")]
        [Authorize]
        public IActionResult DowngradeSubscription([FromBody] DowngradeRequest? request)
        {
            var callerId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(callerId) || !_fileDb.Users.TryGetValue(callerId, out var user))
            {
                return Unauthorized(new { error = "Không tìm thấy người dùng." });
            }

            lock (_fileDb)
            {
                user.CheckAndSyncSubscriptionExpiry();

                if (string.Equals(user.Subscription, "free", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { error = "Tài khoản của bạn hiện đang ở gói Miễn phí, không cần hạ gói." });
                }

                var immediate = request != null && (string.Equals(request.Mode, "immediate", StringComparison.OrdinalIgnoreCase) || request.Scheduled == false);

                if (immediate)
                {
                    user.Subscription = "free";
                    user.ScheduledDowngrade = false;
                    user.SubscriptionExpiry = null;
                    _fileDb.Save();

                    return Ok(new
                    {
                        message = "Đã hạ cấp tài khoản về gói Miễn phí thành công.",
                        subscription = user.Subscription,
                        currentSubscription = user.Subscription,
                        scheduledDowngrade = false,
                        mode = "immediate",
                        effectiveDate = DateTime.UtcNow.ToString("o")
                    });
                }
                else
                {
                    user.ScheduledDowngrade = true;
                    _fileDb.Save();

                    return Ok(new
                    {
                        message = $"Đã lên lịch chuyển về gói Miễn phí khi hết kỳ Pro hiện tại ({user.SubscriptionExpiry}). Bạn vẫn có toàn quyền sử dụng gói Pro cho đến thời điểm này.",
                        subscription = user.Subscription,
                        currentSubscription = user.Subscription,
                        subscriptionExpiry = user.SubscriptionExpiry,
                        scheduledDowngrade = true,
                        mode = "end_of_period",
                        effectiveDate = user.SubscriptionExpiry
                    });
                }
            }
        }

        // POST api/payment/cancel-downgrade — Cancel scheduled downgrade
        [HttpPost("cancel-downgrade")]
        [Authorize]
        public IActionResult CancelDowngrade()
        {
            var callerId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(callerId) || !_fileDb.Users.TryGetValue(callerId, out var user))
            {
                return Unauthorized(new { error = "Không tìm thấy người dùng." });
            }

            lock (_fileDb)
            {
                user.CheckAndSyncSubscriptionExpiry();
                if (!user.ScheduledDowngrade)
                {
                    return BadRequest(new { error = "Tài khoản chưa có lịch hẹn chuyển về gói Miễn phí." });
                }

                user.ScheduledDowngrade = false;
                _fileDb.Save();

                return Ok(new
                {
                    message = "Đã hủy lịch hẹn chuyển gói thành công. Tài khoản sẽ tiếp tục duy trì trạng thái PRO.",
                    subscription = user.Subscription,
                    scheduledDowngrade = false
                });
            }
        }

        [HttpPost("process")]
        [Authorize]
        public IActionResult ProcessPayment([FromBody] PaymentTransaction transaction)
        {
            if (transaction == null || string.IsNullOrWhiteSpace(transaction.Method) || string.IsNullOrWhiteSpace(transaction.User))
            {
                return BadRequest(new { error = "Dữ liệu thanh toán không hợp lệ." });
            }

            // Enforce authenticated ownership: A user cannot initiate payment on behalf of another user unless Admin
            var callerId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var isAdmin = User.IsInRole("admin");

            if (string.IsNullOrEmpty(callerId) || (!callerId.Equals(transaction.User, StringComparison.OrdinalIgnoreCase) && !isAdmin))
            {
                return StatusCode(403, new { error = "Bạn không có quyền thực hiện giao dịch cho tài khoản khác." });
            }

            if (transaction.Amount <= 0)
            {
                return BadRequest(new { error = "Số tiền thanh toán phải lớn hơn 0." });
            }

            const long AuthorizedProPlanPrice = 99000;
            if (transaction.Amount != AuthorizedProPlanPrice)
            {
                return BadRequest(new { error = $"Số tiền thanh toán ({transaction.Amount:N0}đ) không khớp với giá niêm yết của gói Pro ({AuthorizedProPlanPrice:N0}đ)." });
            }

            if (!isAdmin)
            {
                transaction.User = callerId;
            }

            // Check if user exists
            if (!_fileDb.Users.TryGetValue(transaction.User, out var user))
            {
                return BadRequest(new { error = "Không tìm thấy người dùng trên hệ thống." });
            }

            // Validate details based on method
            if (transaction.Method.Equals("card", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrEmpty(transaction.CardName) || string.IsNullOrEmpty(transaction.CardLast4))
                {
                    return BadRequest(new { error = "Thiếu thông tin thẻ tín dụng." });
                }
            }
            else if (transaction.Method.Equals("momo", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrEmpty(transaction.MomoPhone) || string.IsNullOrEmpty(transaction.TransactionId))
                {
                    return BadRequest(new { error = "Thiếu số điện thoại hoặc mã giao dịch Momo." });
                }
            }
            else if (transaction.Method.Equals("zalopay", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrEmpty(transaction.ZalopayPhone))
                {
                    return BadRequest(new { error = "Thiếu số điện thoại ZaloPay." });
                }
            }
            else if (transaction.Method.Equals("stripe", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrEmpty(transaction.StripeEmail))
                {
                    return BadRequest(new { error = "Thiếu email thanh toán Stripe." });
                }
            }

            // Replay protection & Idempotency check inside unified lock for atomic concurrency
            lock (_fileDb)
            {
                // Auto sync expiry before checking current active state
                user.CheckAndSyncSubscriptionExpiry();

                // Rule 2 & Rule 6: Block duplicate active plan purchase if user is already on active Pro plan and plan is specified
                if (!string.IsNullOrEmpty(transaction.Plan) && string.Equals(transaction.Plan, "pro", StringComparison.OrdinalIgnoreCase))
                {
                    if (user.IsSubscriptionActive())
                    {
                        return Conflict(new
                        {
                            error = "DUPLICATE_ACTIVE_SUBSCRIPTION",
                            message = $"Tài khoản của bạn đang sử dụng gói Pro còn hạn (đến {user.SubscriptionExpiry}). Không thể tạo giao dịch mua trùng gói đang hoạt động.",
                            code = "DUPLICATE_ACTIVE_SUBSCRIPTION",
                            subscription = user.Subscription,
                            subscriptionExpiry = user.SubscriptionExpiry
                        });
                    }
                }

                if (!string.IsNullOrWhiteSpace(transaction.TransactionId))
                {
                    if (_fileDb.Transactions.Any(t => string.Equals(t.TransactionId, transaction.TransactionId, StringComparison.OrdinalIgnoreCase)))
                    {
                        return Conflict(new { error = "Mã giao dịch này đã được ghi nhận trên hệ thống (Duplicate Transaction ID)." });
                    }
                }
                else
                {
                    transaction.TransactionId = "TX-" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + "-" + Guid.NewGuid().ToString("N")[..6];
                }

                // Record transaction
                transaction.Timestamp = DateTime.UtcNow.ToString("o");
                _fileDb.Transactions.Add(transaction);

                // Upgrade user to Pro
                user.Subscription = "pro";
                user.ScheduledDowngrade = false;
                user.SubscriptionDate = DateTime.UtcNow.ToString("o");
                user.SubscriptionExpiry = DateTime.UtcNow.AddDays(30).ToString("o");

                _fileDb.Save();

                return Ok(new
                {
                    message = "Thanh toán thành công! Gói PRO đã được kích hoạt.",
                    transactionId = transaction.TransactionId,
                    plan = "pro",
                    user = new
                    {
                        id = user.Id,
                        subscription = user.Subscription,
                        subscriptionDate = user.SubscriptionDate,
                        subscriptionExpiry = user.SubscriptionExpiry
                    }
                });
            }
        }
    }
}
