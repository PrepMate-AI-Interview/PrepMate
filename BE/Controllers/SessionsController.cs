using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using backend.Models;
using backend.Services;
using backend.Services.Knowledge;
using backend.Services.Interview;
using System.Security.Claims;


namespace backend.Controllers
{
    [EnableRateLimiting("ai-policy")]
    [ApiController]
    [Route("api/sessions")]
    public class SessionsController : ControllerBase
    {
        private readonly FileDb _fileDb;
        private readonly InterviewContextBuilder _contextBuilder;
        private readonly KnowledgeCoverageService _coverageService;
        private readonly IInterviewReadinessService _readinessService;
        private readonly IInterviewQuotaService _quotaService;
        private readonly backend.Services.AI.IAIRouter? _aiRouter;
        private readonly backend.Services.AI.INoAiModeService? _noAiMode;

        public SessionsController(
            FileDb fileDb,
            InterviewContextBuilder contextBuilder,
            KnowledgeCoverageService coverageService,
            IInterviewReadinessService readinessService,
            IInterviewQuotaService quotaService,
            backend.Services.AI.IAIRouter? aiRouter = null,
            backend.Services.AI.INoAiModeService? noAiMode = null)
        {
            _fileDb = fileDb;
            _contextBuilder = contextBuilder;
            _coverageService = coverageService;
            _readinessService = readinessService;
            _quotaService = quotaService;
            _aiRouter = aiRouter;
            _noAiMode = noAiMode;
        }

        // =========================================================
        // POST api/sessions/readiness
        // =========================================================

        [HttpPost("readiness")]
        public IActionResult CheckReadiness(
            [FromBody] CreateSessionRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { error = "Dữ liệu kiểm tra mức độ sẵn sàng không được để trống." });
            }

            var readiness = _readinessService.Evaluate(request);
            return Ok(readiness);
        }

        // =========================================================
        // POST api/sessions
        // =========================================================

        // =========================================================
        // GET api/sessions
        // =========================================================

        [HttpGet("quota")]
        [HttpGet("/api/user/quota")]
        public IActionResult GetQuota()
        {
            var quota = _quotaService.GetQuotaStatus(User, HttpContext);
            return Ok(quota);
        }

        [HttpGet]
        public IActionResult GetSessions()
        {
            var callerId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(callerId))
            {
                return Unauthorized(new
                {
                    error = "Vui lòng đăng nhập để xem lịch sử phỏng vấn."
                });
            }
            return GetUserSessions(callerId);
        }

        [HttpPost]
        [HttpPost("start")]
        public async Task<IActionResult> CreateSession(
            [FromBody] CreateSessionRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { error = "Dữ liệu khởi tạo phiên phỏng vấn không được để trống." });
            }

            if (string.IsNullOrWhiteSpace(request.JobTitle))
            {
                return BadRequest(new { error = "Vui lòng nhập vị trí ứng tuyển mục tiêu để hệ thống định hình câu hỏi." });
            }

            if (request.JobTitle.Length > 200)
            {
                return BadRequest(new { error = "Tên vị trí ứng tuyển không được vượt quá 200 ký tự." });
            }

            if (request.CvText != null && request.CvText.Length > 100000)
            {
                return BadRequest(new { error = "Nội dung CV vượt quá giới hạn độ dài cho phép (100.000 ký tự)." });
            }

            if (request.JdText != null && request.JdText.Length > 100000)
            {
                return BadRequest(new { error = "Nội dung JD vượt quá giới hạn độ dài cho phép (100.000 ký tự)." });
            }

            var authenticatedUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(authenticatedUserId))
            {
                request.UserId = authenticatedUserId;
            }
            else
            {
                request.UserId = "guest";
            }

            Console.WriteLine(
                    $"[CREATE SESSION] {DateTime.Now:HH:mm:ss.fff} " +
                    $"JobTitle={request.JobTitle} " +
                    $"UserId={request.UserId}"
                );

            var readiness = _readinessService.Evaluate(request);
            if (!readiness.CanStart)
            {
                return BadRequest(new
                {
                    error = readiness.Issues.FirstOrDefault(i => i.Severity == "ERROR")?.Message ?? "Thiếu thông tin bắt buộc để khởi tạo phiên phỏng vấn.",
                    readiness
                });
            }

            var chosenLevel = !string.IsNullOrWhiteSpace(request.ExperienceLevel)
                ? request.ExperienceLevel.Trim()
                : (!string.IsNullOrWhiteSpace(request.TargetLevel) ? request.TargetLevel.Trim() : null);

            if (string.IsNullOrWhiteSpace(chosenLevel))
            {
                var title = request.JobTitle?.ToLowerInvariant() ?? string.Empty;
                if (title.Contains("senior") || title.Contains("lead") || title.Contains("trưởng") || title.Contains("principal"))
                {
                    chosenLevel = "Senior";
                }
                else if (title.Contains("junior") || title.Contains("fresher") || title.Contains("intern") || title.Contains("thực tập"))
                {
                    chosenLevel = "Junior";
                }
                else
                {
                    chosenLevel = "Mid";
                }
            }
            request.ExperienceLevel = chosenLevel;

            var sessionId =
                Guid.NewGuid().ToString();

            var reservation = _quotaService.CheckAndReserveQuota(User, HttpContext, sessionId);
            if (!reservation.Success)
            {
                return StatusCode(reservation.StatusCode > 0 ? reservation.StatusCode : StatusCodes.Status429TooManyRequests, new
                {
                    error = reservation.ErrorMessage,
                    code = reservation.ErrorCode ?? "INTERVIEW_QUOTA_EXCEEDED"
                });
            }

            try
            {
                // =================================================
                // 1. BUILD INTERVIEW CONTEXT
                // =================================================

                var context =
                    await _contextBuilder.BuildAsync(
                        request
                    );


                // =================================================
                // 2. INITIALIZE INTERVIEW STATE
                // =================================================

                var state =
                    new InterviewState
                    {
                        CandidateLevel =
                            chosenLevel,

                        InterviewPhase =
                            "INTRODUCTION",

                        IntroductionCompleted =
                            false,

                        IntroductionAnswer =
                            string.Empty,

                        IntroductionDurationSeconds =
                            120,

                        QuestionCount =
                            0,

                        MaximumQuestions =
                            context.Strategy?.TotalQuestionBudget ?? (request.MaximumQuestions ?? 15),

                        IsReadyToFinish =
                            false,

                        CurrentTopic =
                            string.Empty,

                        CurrentSubtopic =
                            string.Empty,

                        CurrentDimension =
                            string.Empty,

                        TopicDepth =
                            0,

                        FollowUpCount =
                            0,

                        LastDecision =
                            string.Empty,

                        Strategy =
                            context.Strategy
                    };

                // Phase 2: Initialize KnowledgeCoverage from Blueprint
                _coverageService.InitializeCoverage(state, context.KnowledgeBlueprint);


                // =================================================
                // 3. BUILD TOPICS REMAINING
                // =================================================

                // Ưu tiên:
                // 1. Topic ứng viên có bằng chứng và JD cũng yêu cầu
                // 2. Topic ứng viên có bằng chứng
                // 3. Topic JD yêu cầu nhưng ứng viên chưa thể hiện

                var candidateTopics =
                    context.CandidateTopics
                        .Where(topic =>
                            !string.IsNullOrWhiteSpace(topic))
                        .Distinct(
                            StringComparer.OrdinalIgnoreCase)
                        .ToList();

                var expectedTopics =
                    context.ExpectedTopics
                        .Where(topic =>
                            !string.IsNullOrWhiteSpace(topic))
                        .Distinct(
                            StringComparer.OrdinalIgnoreCase)
                        .ToList();

                var overlappingTopics =
                    candidateTopics
                        .Where(candidate =>
                            expectedTopics.Any(expected =>
                                expected.Equals(
                                    candidate,
                                    StringComparison.OrdinalIgnoreCase)))
                        .ToList();

                var candidateOnlyTopics =
                    candidateTopics
                        .Where(candidate =>
                            !overlappingTopics.Any(topic =>
                                topic.Equals(
                                    candidate,
                                    StringComparison.OrdinalIgnoreCase)))
                        .ToList();

                var expectedOnlyTopics =
                    expectedTopics
                        .Where(expected =>
                            !overlappingTopics.Any(topic =>
                                topic.Equals(
                                    expected,
                                    StringComparison.OrdinalIgnoreCase)))
                        .ToList();

                state.TopicsRemaining =
                    overlappingTopics
                        .Concat(candidateOnlyTopics)
                        .Concat(expectedOnlyTopics)
                        .Distinct(
                            StringComparer.OrdinalIgnoreCase)
                        .ToList();

                // =================================================
                // 4. CREATE SESSION
                // =================================================

                var session =
                    new Session
                    {
                        Id =
                            sessionId,

                        UserId =
                            reservation.ResolvedUserId ?? "guest",

                        PlanSnapshot =
                            null,

                        IsStarted =
                            false,

                        StartedAt =
                            null,

                        JobTitle =
                            request.JobTitle?.Trim() ?? string.Empty,

                        JdText =
                            request.JdText ??
                            string.Empty,

                        CvText =
                            request.CvText ??
                            string.Empty,


                        Questions =
                            new List<string>(),

                        Answers =
                            new List<AnswerItem>(),

                        Feedbacks =
                            new List<string>(),

                        CreatedAt =
                            DateTime.UtcNow.ToString("o"),

                        Status =
                            "in_progress",

                        InterviewContext =
                            context,

                        InterviewState =
                            state,

                        Language =
                            InterviewLanguage.Normalize(request.InterviewLanguage ?? request.Language),

                        AiSnapshot =
                            _aiRouter?.CreateSessionSnapshot(sessionId, backend.Models.AI.AITaskType.IntroductionAnalysis),

                        EvidenceLedger =
                            new backend.Models.AI.EvidenceLedger { SessionId = sessionId },

                        IsNoAiMode =
                            _noAiMode?.IsNoAiActive() ?? false,

                        NoAiNotice =
                            (_noAiMode?.IsNoAiActive() == true) ? _noAiMode.GetNoAiNotice() : null
                    };


                // =================================================
                // 5. SAVE
                // =================================================

                _fileDb.Sessions[sessionId] =
                    session;

                _fileDb.Save();


                // =================================================
                // 6. RETURN
                // =================================================

                return Ok(new
                {
                    sessionId,

                    isNoAiMode =
                        session.IsNoAiMode,

                    noAiNotice =
                        session.NoAiNotice,

                    status =
                        session.Status,

                    interviewPhase =
                        state.InterviewPhase,

                    introductionDurationSeconds =
                        state.IntroductionDurationSeconds,

                    question =
                        (string?)null,

                    message =
                        "Interview session đã được khởi tạo. " +
                        "Ứng viên bắt đầu bằng phần giới thiệu."
                });
            }
            catch (Exception ex)
            {
                _quotaService.ReleaseReservation(sessionId);
                Console.WriteLine(
                    $"[INTERVIEW] Create session error: {ex}"
                );

                return StatusCode(
                    500,
                    new
                    {
                        error =
                            "Không thể khởi tạo phiên phỏng vấn.",

                        detail =
                            "Đã xảy ra sự cố nội bộ trong quá trình xử lý."
                    }
                );
            }
        }


        // =========================================================
        // GET api/sessions/{id}
        // =========================================================

        [HttpPost("{id}/start")]
        public IActionResult StartSession(string id)
        {
            if (!_fileDb.Sessions.TryGetValue(id, out var session) || session == null)
            {
                return NotFound(new { error = "Không tìm thấy session." });
            }

            var accessCheck = _quotaService.ValidateSessionAccess(session, User, HttpContext);
            if (!accessCheck.IsAllowed)
            {
                return StatusCode(accessCheck.StatusCode, new { error = accessCheck.ErrorMessage });
            }

            var startResult = _quotaService.CommitSessionStart(session, User, HttpContext);
            if (!startResult.Success)
            {
                return StatusCode(startResult.StatusCode, new
                {
                    error = startResult.ErrorMessage,
                    code = startResult.ErrorCode ?? "INTERVIEW_QUOTA_EXCEEDED"
                });
            }

            return Ok(new
            {
                sessionId = session.Id,
                status = session.Status,
                isStarted = session.IsStarted,
                startedAt = session.StartedAt,
                planSnapshot = session.PlanSnapshot
            });
        }

        [HttpGet("{id}")]
        public IActionResult GetSession(
            string id)
        {
            if (!_fileDb.Sessions.TryGetValue(
                    id,
                    out var session))
            {
                return NotFound(new
                {
                    error =
                        "Không tìm thấy session."
                });
            }

            // Enforce resource ownership (BOLA / IDOR / Guest isolation)
            var accessCheck = _quotaService.ValidateSessionAccess(session, User, HttpContext);
            if (!accessCheck.IsAllowed)
            {
                return StatusCode(accessCheck.StatusCode, new { error = accessCheck.ErrorMessage });
            }

            var callerId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var isAdmin = User.IsInRole("admin");

            // Authenticated owner or Admin gets full session details
            if (!string.IsNullOrEmpty(callerId) && (callerId.Equals(session.UserId, StringComparison.OrdinalIgnoreCase) || isAdmin))
            {
                return Ok(session);
            }

            // Guest Preview: strictly sanitize detailed evaluation and feedback data
            var previewSession = new
            {
                id = session.Id,
                userId = session.UserId,
                jobTitle = session.JobTitle,
                targetPosition = session.JobTitle,
                jdText = session.JdText,
                cvText = session.CvText,
                questions = session.Questions,
                experienceLevel = session.InterviewContext?.ExperienceLevel ?? "Middle",
                targetLevel = session.InterviewContext?.ExperienceLevel ?? "Middle",
                targetCompany = session.InterviewContext?.TargetCompany ?? string.Empty,
                status = session.Status,
                isStarted = session.IsStarted,
                startedAt = session.StartedAt,
                createdAt = session.CreatedAt,
                planSnapshot = session.PlanSnapshot,
                language = session.Language,
                interviewState = session.InterviewState,
                interviewContext = session.InterviewContext,
                isGuestPreview = true,
                report = session.Report != null ? new
                {
                    overallScore = session.Report.OverallScore,
                    isGuestPreview = true
                } : null
            };

            return Ok(previewSession);
        }

        // =========================================================
        // POST api/sessions/{id}/claim
        // =========================================================

        [HttpPost("{id}/claim")]
        public IActionResult ClaimSession(string id)
        {
            if (!_fileDb.Sessions.TryGetValue(id, out var session) || session == null)
            {
                return NotFound(new { error = "Không tìm thấy session." });
            }

            var claimResult = _quotaService.ClaimGuestSession(session, User, HttpContext);
            if (!claimResult.Success)
            {
                return StatusCode(claimResult.StatusCode, new { error = claimResult.ErrorMessage });
            }

            return Ok(new
            {
                success = true,
                sessionId = session.Id,
                userId = session.UserId,
                claimedAt = session.ClaimedAt,
                message = "Liên kết phiên phỏng vấn vào tài khoản thành công."
            });
        }


        // =========================================================
        // GET api/sessions/user/{userId}
        // =========================================================

        [HttpGet("user/{userId}")]
        public IActionResult GetUserSessions(
            string userId)
        {
            // Enforce IDOR protection: callers may only view their own session history unless Admin
            var callerId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var isAdmin = User.IsInRole("admin");

            if (string.IsNullOrEmpty(callerId))
            {
                return Unauthorized(new
                {
                    error = "Vui lòng đăng nhập để xem lịch sử phỏng vấn."
                });
            }

            if (!callerId.Equals(userId, StringComparison.OrdinalIgnoreCase) && !isAdmin)
            {
                return StatusCode(403, new
                {
                    error = "Bạn không có quyền xem lịch sử phỏng vấn của người dùng khác."
                });
            }

            var userSessions =
                _fileDb.Sessions.Values
                    .Where(s =>
                        s.UserId.Equals(
                            userId,
                            StringComparison.OrdinalIgnoreCase))
                    .OrderByDescending(
                        s => s.CreatedAt)
                    .ThenByDescending(
                        s => s.Id)
                    .ToList();

            return Ok(userSessions);
        }


        // =========================================================
        // DELETE api/sessions/{id}
        // =========================================================

        [HttpDelete("{id}")]
        public IActionResult DeleteSession(
            string id)
        {
            if (!_fileDb.Sessions.TryGetValue(
                    id,
                    out var session))
            {
                return NotFound(new
                {
                    error =
                        "Không tìm thấy session."
                });
            }

            // Enforce IDOR protection: only session owner or Admin may delete a session
            var callerId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var isAdmin = User.IsInRole("admin");

            if (string.IsNullOrEmpty(callerId))
            {
                return Unauthorized(new
                {
                    error = "Vui lòng đăng nhập để xóa phiên phỏng vấn."
                });
            }

            if (!session.UserId.Equals("guest", StringComparison.OrdinalIgnoreCase))
            {
                if (!callerId.Equals(session.UserId, StringComparison.OrdinalIgnoreCase) && !isAdmin)
                {
                    return StatusCode(403, new
                    {
                        error = "Bạn không có quyền xóa phiên phỏng vấn của người dùng khác."
                    });
                }
            }
            else
            {
                if (!isAdmin)
                {
                    return StatusCode(403, new
                    {
                        error = "Chỉ Quản trị viên mới có thể xóa phiên phỏng vấn dùng thử của khách."
                    });
                }
            }

            _fileDb.Sessions.TryRemove(
                    id,
                    out _);

            _fileDb.Save();

            return Ok(new
            {
                message =
                    "Đã xóa session thành công."
            });
        }
    }
}