using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using backend.Models;
using backend.Services;
using backend.Services.Interview;
using backend.Services.AI;

namespace backend.Controllers
{
    [EnableRateLimiting("ai-policy")]
    [ApiController]
    [Route("api/ai")]
    public class AIController : ControllerBase
    {
        private readonly FileDb _fileDb;
        private readonly InterviewFlowService _interviewFlowService;
        private readonly InterviewReportService _interviewReportService;
        private readonly LegacyQuestionService _legacyQuestionService;
        private readonly CvAnalysisService _cvAnalysisService;
        private readonly JobRecommendationService _jobRecommendationService;
        private readonly CareerRoadmapService _careerRoadmapService;
        private readonly IInterviewQuotaService _quotaService;

        public AIController(
            FileDb fileDb,
            InterviewFlowService interviewFlowService,
            InterviewReportService interviewReportService,
            LegacyQuestionService legacyQuestionService,
            CvAnalysisService cvAnalysisService,
            JobRecommendationService jobRecommendationService,
            CareerRoadmapService careerRoadmapService,
            IInterviewQuotaService quotaService)
        {
            _fileDb = fileDb;
            _interviewFlowService = interviewFlowService;
            _interviewReportService = interviewReportService;
            _legacyQuestionService = legacyQuestionService;
            _cvAnalysisService = cvAnalysisService;
            _jobRecommendationService = jobRecommendationService;
            _careerRoadmapService = careerRoadmapService;
            _quotaService = quotaService;
        }

        private IActionResult? ValidateSessionAccess(string? sessionId, bool allowMutate = true)
        {
            if (string.IsNullOrWhiteSpace(sessionId))
            {
                return BadRequest(new { error = "Thiếu SessionId." });
            }

            if (!_fileDb.Sessions.TryGetValue(sessionId, out var session))
            {
                return NotFound(new { error = "Không tìm thấy session." });
            }

            // Enforce resource ownership (BOLA / IDOR / Guest isolation)
            var accessCheck = _quotaService.ValidateSessionAccess(session, User, HttpContext, allowMutate);
            if (!accessCheck.IsAllowed)
            {
                return StatusCode(accessCheck.StatusCode, new { error = accessCheck.ErrorMessage });
            }

            // Prevent mutating completed session
            if (allowMutate)
            {
                var isCompleted = session.Status.Equals("completed", System.StringComparison.OrdinalIgnoreCase) ||
                                  session.InterviewState?.InterviewPhase.Equals("COMPLETED", System.StringComparison.OrdinalIgnoreCase) == true;
                if (isCompleted)
                {
                    return BadRequest(new { error = "Phiên phỏng vấn đã hoàn tất, không thể tiếp tục gửi câu trả lời." });
                }
            }

            return null;
        }

        [HttpPost("introduction")]
        public async Task<IActionResult> ProcessIntroduction(
            [FromBody] IntroductionRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { error = "Dữ liệu giới thiệu không được để trống." });
            }

            if (string.IsNullOrWhiteSpace(request.SessionId))
            {
                return BadRequest(new { error = "Thiếu SessionId." });
            }

            if (string.IsNullOrWhiteSpace(request.Introduction))
            {
                return BadRequest(new { error = "Nội dung giới thiệu bản thân không được để trống." });
            }

            if (request.Introduction.Length > 20000)
            {
                return BadRequest(new { error = "Nội dung giới thiệu vượt quá độ dài tối đa cho phép (20.000 ký tự)." });
            }

            var accessCheck = ValidateSessionAccess(request.SessionId, allowMutate: true);
            if (accessCheck != null)
            {
                return accessCheck;
            }

            if (_fileDb.Sessions.TryGetValue(request.SessionId, out var introSession) && introSession != null && !introSession.IsStarted)
            {
                var startResult = _quotaService.CommitSessionStart(introSession, User, HttpContext);
                if (!startResult.Success)
                {
                    return StatusCode(startResult.StatusCode, new
                    {
                        error = startResult.ErrorMessage,
                        code = startResult.ErrorCode ?? "INTERVIEW_QUOTA_EXCEEDED"
                    });
                }
            }

            var result =
                await _interviewFlowService
                    .ProcessIntroductionAsync(request);

            return StatusCode(
                result.StatusCode,
                result.Data
            );
        }

        [HttpPost("respond")]
        public async Task<IActionResult> Respond(
            [FromBody] AIRespondRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { error = "Dữ liệu câu trả lời không được để trống." });
            }

            if (string.IsNullOrWhiteSpace(request.SessionId))
            {
                return BadRequest(new { error = "Thiếu SessionId." });
            }

            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { error = "Câu trả lời không được để trống." });
            }

            if (request.Message.Length > 20000)
            {
                return BadRequest(new { error = "Câu trả lời vượt quá độ dài tối đa cho phép (20.000 ký tự)." });
            }

            var accessCheck = ValidateSessionAccess(request.SessionId, allowMutate: true);
            if (accessCheck != null)
            {
                return accessCheck;
            }

            if (_fileDb.Sessions.TryGetValue(request.SessionId, out var respSession) && respSession != null && !respSession.IsStarted)
            {
                var startResult = _quotaService.CommitSessionStart(respSession, User, HttpContext);
                if (!startResult.Success)
                {
                    return StatusCode(startResult.StatusCode, new
                    {
                        error = startResult.ErrorMessage,
                        code = startResult.ErrorCode ?? "INTERVIEW_QUOTA_EXCEEDED"
                    });
                }
            }

            var result =
                await _interviewFlowService
                    .RespondAsync(request);

            return StatusCode(
                result.StatusCode,
                result.Data
            );
        }

        [HttpPost("report")]
        [HttpPost("end-interview")]
        public async Task<IActionResult> AIReport(
            [FromBody] AIReportRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { error = "Dữ liệu yêu cầu kết thúc phỏng vấn không được để trống." });
            }

            if (string.IsNullOrWhiteSpace(request.SessionId))
            {
                return BadRequest(new { error = "Thiếu SessionId." });
            }

            var accessCheck = ValidateSessionAccess(request.SessionId, allowMutate: false);
            if (accessCheck != null)
            {
                return accessCheck;
            }

            var result =
                await _interviewReportService
                    .GenerateReportAsync(request);

            if (result.StatusCode == 200)
            {
                var callerId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var isAdmin = User.IsInRole("admin");

                _fileDb.Sessions.TryGetValue(request.SessionId, out var s);
                bool isAuthOwner = !string.IsNullOrEmpty(callerId) && s != null && (callerId.Equals(s.UserId, StringComparison.OrdinalIgnoreCase) || isAdmin);

                if (!isAuthOwner && s != null && s.Report != null)
                {
                    var previewReport = new
                    {
                        overallScore = s.Report.OverallScore,
                        isGuestPreview = true
                    };
                    return StatusCode(result.StatusCode, previewReport);
                }
            }

            return StatusCode(
                result.StatusCode,
                result.Data
            );
        }

        [HttpPost("next-question")]
        public async Task<IActionResult> NextQuestion(
            [FromBody] NextQuestionRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { error = "Dữ liệu yêu cầu câu hỏi tiếp theo không được để trống." });
            }

            if (string.IsNullOrWhiteSpace(request.SessionId) && string.IsNullOrWhiteSpace(request.JobTitle))
            {
                return BadRequest(new { error = "Yêu cầu phải có SessionId hoặc JobTitle." });
            }

            if (!string.IsNullOrWhiteSpace(request.SessionId))
            {
                var accessCheck = ValidateSessionAccess(request.SessionId, allowMutate: true);
                if (accessCheck != null)
                {
                    return accessCheck;
                }
            }

            var result =
                await _legacyQuestionService
                    .GenerateAsync(request);

            return StatusCode(
                result.StatusCode,
                result.Data
            );
        }

        [HttpPost("analyze-cv")]
        public async Task<IActionResult> AnalyzeCv(
            [FromBody] AnalyzeCvRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.CvText))
            {
                return BadRequest(new { error = "Thiếu nội dung CV." });
            }

            if (request.CvText.Length > 100000)
            {
                return BadRequest(new { error = "Nội dung CV vượt quá giới hạn độ dài cho phép (100.000 ký tự)." });
            }

            var result =
                await _cvAnalysisService
                    .AnalyzeAsync(request);

            if (User.Identity?.IsAuthenticated != true)
            {
                // Enforce Guest teaser boundary at server boundary (SEC-F1)
                if (result.StatusCode == 200 && result.Data is AnalyzeCvResponse resp)
                {
                    var fullSummary = resp.Summary ?? string.Empty;
                    var teaserSummary = fullSummary.Length > 170 ? (fullSummary.Length > 167 ? fullSummary[..167].Trim() + "..." : fullSummary[..170]) : fullSummary;
                    var teaser = new AnalyzeCvResponse
                    {
                        Summary = teaserSummary,
                        KeySkills = resp.KeySkills?.Take(2).ToList() ?? new List<string>(),
                        Experience = string.Empty,
                        Suitability = 0, // Omit precise numerical score for Guest teaser
                        Suggestions = new List<string>() // Gated for authenticated accounts
                    };
                    return StatusCode(result.StatusCode, teaser);
                }
            }

            return StatusCode(
                result.StatusCode,
                result.Data
            );
        }

        [Authorize]
        [HttpPost("job-recommendations")]
        public async Task<IActionResult> JobRecommendations(
            [FromBody] AnalyzeCvRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.CvText))
            {
                return BadRequest(new { error = "Thiếu nội dung CV." });
            }

            if (request.CvText.Length > 100000)
            {
                return BadRequest(new { error = "Nội dung CV vượt quá giới hạn độ dài cho phép (100.000 ký tự)." });
            }

            var result =
                await _jobRecommendationService
                    .RecommendAsync(request);

            return StatusCode(
                result.StatusCode,
                result.Data
            );
        }

        [Authorize]
        [HttpPost("career-roadmap")]
        public async Task<IActionResult> CareerRoadmap(
            [FromBody] AnalyzeCvRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.CvText))
            {
                return BadRequest(new { error = "Thiếu nội dung CV." });
            }

            if (request.CvText.Length > 100000)
            {
                return BadRequest(new { error = "Nội dung CV vượt quá giới hạn độ dài cho phép (100.000 ký tự)." });
            }

            var result =
                await _careerRoadmapService
                    .GenerateAsync(request);

            return StatusCode(
                result.StatusCode,
                result.Data
            );
        }
    }
}