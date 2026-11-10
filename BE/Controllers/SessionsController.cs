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

        // =========================================================
        // GET api/sessions/guest & api/sessions/guest/history
        // Dedicated Guest History retrieval (WI-GUEST-HISTORY-SEPARATION-01)
        // =========================================================

        [HttpGet("guest")]
        [HttpGet("guest/history")]
        public IActionResult GetGuestSessions()
        {
            // 1. Resolve caller's verified guest identity via cookie or X-Guest-Token
            var (_, guestId) = _quotaService.ResolveOrCreateGuestIdentity(HttpContext);

            if (string.IsNullOrWhiteSpace(guestId))
            {
                return Ok(Array.Empty<object>());
            }

            // 2. Query sessions explicitly belonging to this exact guest identity:
            // - session.UserId == guestId
            // - OR (session.UserId == "guest" AND session.OriginalGuestId == guestId)
            // - Exclude all claimed sessions (session.ClaimedAt != null or session.UserId not starting with "guest")
            // - Exclude all sessions owned by registered accounts or other guests
            var guestSessions = _fileDb.Sessions.Values
                .Where(s =>
                    string.IsNullOrWhiteSpace(s.ClaimedAt) &&
                    s.UserId.StartsWith("guest", StringComparison.OrdinalIgnoreCase) &&
                    (
                        string.Equals(s.UserId, guestId, StringComparison.OrdinalIgnoreCase) ||
                        (string.Equals(s.UserId, "guest", StringComparison.OrdinalIgnoreCase) &&
                         !string.IsNullOrWhiteSpace(s.OriginalGuestId) &&
                         string.Equals(s.OriginalGuestId, guestId, StringComparison.OrdinalIgnoreCase))
                    )
                )
                .OrderByDescending(s => s.CreatedAt)
                .ThenByDescending(s => s.Id)
                .Select(s =>
                {
                    // 1. Authoritative Guest Preview & Evaluation Status/Rating SSOT (FIX-01 & FIX-02)
                    var guestPreview = backend.Services.Evaluation.GuestReportPreviewBuilder.BuildGuestPreview(s);
                    var evalStatus = guestPreview.EvaluationStatus;
                    bool isEvalAvailable = string.Equals(evalStatus, "AVAILABLE", StringComparison.OrdinalIgnoreCase);

                    double? overallScore = isEvalAvailable ? guestPreview.OverallScore : null;
                    string? evaluationRating = isEvalAvailable ? guestPreview.EvaluationRating : null;

                    // 2. Authoritative Completion Timestamp (FIX-03)
                    string? completedAt = s.CompletedAt;

                    // 3. Question Count: Main questions only, excluding introduction (FIX-04)
                    int questionsAnswered = (s.Answers ?? new List<AnswerItem>())
                        .Count(a => !backend.Services.Evaluation.GuestReportPreviewBuilder.IsIntroductionTurn(a) && !string.IsNullOrWhiteSpace(a.Answer));

                    // 4. Job Title without fabricated fallback (FIX-05)
                    string? jobTitle = !string.IsNullOrWhiteSpace(s.JobTitle)
                        ? s.JobTitle
                        : (!string.IsNullOrWhiteSpace(s.InterviewContext?.TargetPosition) ? s.InterviewContext.TargetPosition : null);

                    // 5. Company without fabricated fallback (FIX-05)
                    string? company = !string.IsNullOrWhiteSpace(s.InterviewContext?.TargetCompany)
                        ? s.InterviewContext.TargetCompany
                        : null;

                    // 6. Experience Level without fabricated fallback (FIX-05)
                    string? experienceLevel = !string.IsNullOrWhiteSpace(s.InterviewContext?.ExperienceLevel)
                        ? s.InterviewContext.ExperienceLevel
                        : null;

                    // 7. Duration: Only calculate from actual data, do not invent 15 mins (FIX-05)
                    int? duration = s.Duration;
                    int? durationSeconds = s.DurationSeconds;

                    bool isCompleted = string.Equals(s.Status, "completed", StringComparison.OrdinalIgnoreCase) ||
                                       string.Equals(s.InterviewState?.InterviewPhase, "COMPLETED", StringComparison.OrdinalIgnoreCase) ||
                                       (s.Report != null);

                    return new
                    {
                        id = s.Id,
                        sessionId = s.Id,
                        createdAt = s.CreatedAt,
                        startedAt = s.StartedAt,
                        completedAt = completedAt,
                        jobTitle = jobTitle,
                        company = company,
                        experienceLevel = experienceLevel,
                        status = isCompleted ? "completed" : (!string.IsNullOrWhiteSpace(s.Status) ? s.Status.ToLower() : "in_progress"),
                        questionsAnswered = questionsAnswered,
                        overallScore = overallScore,
                        evaluationRating = evaluationRating,
                        evaluationStatus = evalStatus,
                        isGuestPreview = true,
                        duration = duration,
                        durationSeconds = durationSeconds,
                        language = s.Language
                    };
                })
                .ToList();

            return Ok(guestSessions);
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
                            request.MaximumQuestions ?? context.Strategy?.TotalQuestionBudget ?? InterviewState.DemoInterviewQuestionLimit,

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

                        OriginalGuestId =
                            reservation.ResolvedUserId?.StartsWith("guest", StringComparison.OrdinalIgnoreCase) == true ? reservation.ResolvedUserId : null,

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


                // AutoStart commit on session creation if requested (WI-INTERVIEW-PERFORMANCE-OPTIMIZATION-01)
                if (request.AutoStart == true)
                {
                    var startCommit = _quotaService.CommitSessionStart(session, User, HttpContext);
                    if (startCommit.Success)
                    {
                        session.IsStarted = true;
                    }
                }

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

                    isStarted =
                        session.IsStarted,

                    startedAt =
                        session.StartedAt,

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

            // Guest Preview: strictly sanitize detailed evaluation and feedback data (WI-REPORT-PREVIEW-01)
            var guestPreview = backend.Services.Evaluation.GuestReportPreviewBuilder.BuildGuestPreview(session);

            var previewSession = new
            {
                id = session.Id,
                userId = "guest",
                jobTitle = session.JobTitle,
                targetPosition = session.JobTitle,
                experienceLevel = session.InterviewContext?.ExperienceLevel ?? "Middle",
                targetLevel = session.InterviewContext?.ExperienceLevel ?? "Middle",
                targetCompany = session.InterviewContext?.TargetCompany ?? string.Empty,
                status = session.Status,
                isStarted = session.IsStarted,
                startedAt = session.StartedAt,
                createdAt = session.CreatedAt,
                completedAt = session.CompletedAt,
                duration = session.Duration,
                durationSeconds = session.DurationSeconds,
                language = session.Language,
                questionsAnswered = session.Answers?.Count ?? 0,
                isGuestPreview = true,
                overallScore = guestPreview.OverallScore ?? session.Report?.OverallScore,
                guestPreview = guestPreview,
                report = session.Report != null ? new
                {
                    overallScore = session.Report.OverallScore,
                    isGuestPreview = true,
                    guestPreview = guestPreview,
                    summary = guestPreview.Summary,
                    interpretation = guestPreview.Interpretation,
                    topStrengths = guestPreview.TopStrengths,
                    improvementTeaser = guestPreview.ImprovementTeaser,
                    improvementFocus = guestPreview.ImprovementFocus,
                    analysisCapabilityTeaser = guestPreview.AnalysisCapabilityTeaser,
                    evaluationRating = guestPreview.EvaluationRating,
                    evaluationStatus = guestPreview.EvaluationStatus
                } : new
                {
                    overallScore = guestPreview.OverallScore ?? 0.0,
                    isGuestPreview = true,
                    guestPreview = guestPreview,
                    summary = guestPreview.Summary,
                    interpretation = guestPreview.Interpretation,
                    topStrengths = guestPreview.TopStrengths,
                    improvementTeaser = guestPreview.ImprovementTeaser,
                    improvementFocus = guestPreview.ImprovementFocus,
                    analysisCapabilityTeaser = guestPreview.AnalysisCapabilityTeaser,
                    evaluationRating = guestPreview.EvaluationRating,
                    evaluationStatus = guestPreview.EvaluationStatus
                }
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