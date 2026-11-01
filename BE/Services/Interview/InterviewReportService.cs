using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using backend.Models;
using backend.Prompts.Interview;

namespace backend.Services.Interview
{
    public class InterviewReportService
    {
        private readonly FileDb _fileDb;
        private readonly GeminiService _geminiService;
        private readonly backend.Services.Evaluation.IFinalEvaluationService? _finalEvaluationService;
        private readonly backend.Services.Evaluation.IEvidenceReportService? _evidenceReportService;
        private readonly backend.Services.Storage.ISessionLockManager? _sessionLockManager;

        public InterviewReportService(
            FileDb fileDb,
            GeminiService geminiService,
            backend.Services.Evaluation.IFinalEvaluationService? finalEvaluationService = null,
            backend.Services.Evaluation.IEvidenceReportService? evidenceReportService = null,
            backend.Services.Storage.ISessionLockManager? sessionLockManager = null)
        {
            _fileDb = fileDb;
            _geminiService = geminiService;
            _finalEvaluationService = finalEvaluationService;
            _evidenceReportService = evidenceReportService ?? new backend.Services.Evaluation.EvidenceReportService();
            _sessionLockManager = sessionLockManager;
        }

        public async Task<InterviewReportResult> GenerateReportAsync(
            AIReportRequest request)
        {
            IDisposable? sessionLock = null;
            if (!string.IsNullOrWhiteSpace(request.SessionId) && _sessionLockManager != null)
            {
                sessionLock = await _sessionLockManager.AcquireLockAsync(request.SessionId);
            }

            Session? session = null;
            FinalInterviewEvaluation? evaluation = null;
            InterviewReport? evidenceReport = null;

            try
            {
                if (!string.IsNullOrWhiteSpace(request.SessionId))
                {
                    _fileDb.Sessions.TryGetValue(request.SessionId, out session);
                }

                // ─── IDEMPOTENCY / REPLAY PROTECTION ────────────────────────────
                if (session != null && session.Report != null && session.Status.Equals("completed", StringComparison.OrdinalIgnoreCase))
                {
                    return InterviewReportResult.Success(session.Report);
                }

                if (session != null)
                {
                    if (session.Answers != null && session.Answers.Count > 0)
                    {
                        request.Responses = session.Answers;
                    }
                    if (!string.IsNullOrWhiteSpace(session.JobTitle))
                    {
                        request.JobTitle = session.JobTitle;
                    }
                }

                // ─── INCOMPLETE SESSION GUARDS ──────────────────────────────────
                if (request.Responses == null || request.Responses.Count == 0)
                {
                    return InterviewReportResult.BadRequest(new
                    {
                        error = "Chưa có câu trả lời nào được ghi nhận để thực hiện đánh giá năng lực.",
                        detail = "Candidate has not submitted any answers for evaluation."
                    });
                }

                if (session != null && session.Answers != null && session.Answers.Count > 0)
                {
                    // Candidate has only answered self-introduction, without actual interview questions
                    bool isOnlyIntro = session.Answers.All(a =>
                        a.Stage == InterviewStageNames.Introduction ||
                        string.Equals(a.Question, "Giới thiệu bản thân", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(a.QuestionType, "Introduction", StringComparison.OrdinalIgnoreCase));

                    if (isOnlyIntro)
                    {
                        return InterviewReportResult.BadRequest(new
                        {
                            error = "Phiên phỏng vấn chưa có đủ dữ liệu câu trả lời để tạo báo cáo đánh giá.",
                            detail = "Candidate has only completed introduction and has not answered any interview questions."
                        });
                    }
                }

                // Preserve immutable snapshot
                if (session != null && !string.IsNullOrWhiteSpace(session.JobTitle))
                {
                    request.JobTitle = session.JobTitle;
                }

                if (session != null && _finalEvaluationService != null)
                {
                    evaluation = _finalEvaluationService.EvaluateSession(session);
                    session.Evaluation = evaluation;

                    if (_evidenceReportService != null)
                    {
                        evidenceReport = _evidenceReportService.ProjectReport(evaluation, session);
                    }
                }

                var transcriptList =
                    new List<string>();

                for (
                    var i = 0;
                    i < request.Responses.Count;
                    i++)
                {
                    transcriptList.Add(
                        $"Câu {i + 1}: " +
                        $"{request.Responses[i].Question}\n" +
                        $"Trả lời: " +
                        $"{request.Responses[i].Answer}"
                    );
                }

                var qaTranscript =
                    string.Join(
                        "\n\n",
                        transcriptList
                    );

                var effectiveLang = session?.Language ?? request.Language;
                var langInstruction = InterviewLanguage.GetLanguageContract(effectiveLang);

                var prompt = ReportPrompt.Build(request.JobTitle, langInstruction, qaTranscript);

                var json =
                    await _geminiService
                        .CallGeminiApiForTaskAsync(
                            backend.Models.AI.AITaskType.ReportGeneration,
                            prompt,
                            isJsonMode: true
                        );

                var options =
                    new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true,
                        NumberHandling = JsonNumberHandling.AllowReadingFromString
                    };

                var report =
                    JsonSerializer.Deserialize<ReportModel>(
                        json,
                        options
                    );

                if (report == null)
                {
                    if (session != null && evaluation != null)
                    {
                        return UseFallbackReport(session, evaluation, evidenceReport);
                    }

                    return InterviewReportResult.Error(
                        "AI không tạo được báo cáo hợp lệ.",
                        "Report deserialization returned null."
                    );
                }

                // AI Score Protection: Deterministic evaluation is single source of truth for scores!
                if (evaluation != null)
                {
                    report.OverallScore = Math.Round(evaluation.OverallScore * 10.0, 1);
                    report.TechScore = Math.Round(evaluation.TechnicalScore * 10.0, 1);
                    report.StarScore = evaluation.BehavioralScore > 0
                        ? Math.Round(evaluation.BehavioralScore * 10.0, 1)
                        : (evaluation.Competencies.Any(c => c.AreaName == "Behavioral (STAR)") ? Math.Round(evaluation.BehavioralScore * 10.0, 1) : 0.0);
                    report.SituationalScore = Math.Round(evaluation.SituationalScore * 10.0, 1);
                    report.CandidateQuestionScore = Math.Round(evaluation.CandidateQuestionScore * 10.0, 1);
                    report.IntelligenceSummary = evaluation.IntelligenceSummary ?? session?.EvidenceState?.Summary;
                    report.QualitySummary = evaluation.QualitySummary ?? (session?.QualityState != null ? new InterviewQualityService().CalculateQualitySummary(session) : null);
                }

                // Attach Phase 3 Step 2 EvidenceReport
                report.EvidenceReport = evidenceReport;
                if (report.QualitySummary == null && session?.QualityState != null)
                {
                    report.QualitySummary = new InterviewQualityService().CalculateQualitySummary(session);
                }

                // Ensure strengths and improvements are populated from evidence if AI returned blank
                if (string.IsNullOrWhiteSpace(report.Strengths) && evidenceReport?.Strengths?.Count > 0)
                {
                    report.Strengths = string.Join("\n", evidenceReport.Strengths.ConvertAll(s => $"- {s.Title}: {s.Description}"));
                }
                if (string.IsNullOrWhiteSpace(report.Improvements) && evidenceReport != null && (evidenceReport.Weaknesses.Count > 0 || evidenceReport.KnowledgeGaps.Count > 0))
                {
                    var items = new List<string>();
                    items.AddRange(evidenceReport.Weaknesses.ConvertAll(w => $"- {w.Title}: {w.Description}"));
                    items.AddRange(evidenceReport.KnowledgeGaps.ConvertAll(g => $"- [Lỗ hổng {g.GapType}] {g.ConceptName}: {g.Description}"));
                    report.Improvements = string.Join("\n", items);
                }
                if (string.IsNullOrWhiteSpace(report.Suggestion) && evidenceReport != null)
                {
                    report.Suggestion = evidenceReport.OverallEvaluation.Summary;
                }

                if (session != null)
                {
                    session.Report =
                        report;

                    session.Status =
                        "completed";

                    session.InterviewState.InterviewPhase =
                        "COMPLETED";

                    session.InterviewState.IsReadyToFinish =
                        true;

                    _fileDb.Sessions[
                        session.Id] =
                        session;

                    _fileDb.Save();
                }

                return InterviewReportResult.Success(
                    report
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Gemini report generation error: {ex}"
                );

                if (session != null && evaluation != null)
                {
                    return UseFallbackReport(session, evaluation, evidenceReport);
                }

                return InterviewReportResult.Error(
                    "Không thể tạo báo cáo phỏng vấn.",
                    ex.Message
                );
            }
            finally
            {
                sessionLock?.Dispose();
            }
        }

        private InterviewReportResult UseFallbackReport(
            Session session,
            FinalInterviewEvaluation evaluation,
            InterviewReport? evidenceReport = null)
        {
            if (evidenceReport == null && _evidenceReportService != null)
            {
                evidenceReport = _evidenceReportService.ProjectReport(evaluation, session);
            }

            var strengthsList = evidenceReport?.Strengths != null && evidenceReport.Strengths.Count > 0
                ? string.Join("\n", evidenceReport.Strengths.ConvertAll(s => $"- {s.Title}: {s.Description}"))
                : (evaluation.KeyStrengths.Count > 0
                    ? string.Join("\n", evaluation.KeyStrengths.ConvertAll(s => $"- {s}"))
                    : "Đã hoàn thành phiên phỏng vấn.");

            var weaknessesList = new List<string>();
            if (evidenceReport != null)
            {
                if (evidenceReport.Weaknesses.Count > 0)
                    weaknessesList.AddRange(evidenceReport.Weaknesses.ConvertAll(w => $"- {w.Title}: {w.Description}"));
                if (evidenceReport.KnowledgeGaps.Count > 0)
                    weaknessesList.AddRange(evidenceReport.KnowledgeGaps.ConvertAll(g => $"- [Lỗ hổng {g.GapType}] {g.ConceptName}: {g.Description}"));
            }
            else if (evaluation.KnowledgeGaps.Count > 0)
            {
                weaknessesList.AddRange(evaluation.KnowledgeGaps.ConvertAll(g => $"- {g}"));
            }

            var fallbackReport = new ReportModel
            {
                OverallScore = Math.Round(evaluation.OverallScore * 10.0, 1),
                TechScore = Math.Round(evaluation.TechnicalScore * 10.0, 1),
                CommScore = Math.Round(evaluation.OverallScore * 10.0, 1),
                SoftScore = Math.Round(evaluation.OverallScore * 10.0, 1),
                StarScore = evaluation.BehavioralScore > 0
                    ? Math.Round(evaluation.BehavioralScore * 10.0, 1)
                    : (evaluation.Competencies.Any(c => c.AreaName == "Behavioral (STAR)") ? Math.Round(evaluation.BehavioralScore * 10.0, 1) : 0.0),
                SituationalScore = Math.Round(evaluation.SituationalScore * 10.0, 1),
                CandidateQuestionScore = Math.Round(evaluation.CandidateQuestionScore * 10.0, 1),
                IntelligenceSummary = evaluation.IntelligenceSummary ?? session.EvidenceState?.Summary,
                QualitySummary = evaluation.QualitySummary ?? (session.QualityState != null ? new InterviewQualityService().CalculateQualitySummary(session) : null),
                EvidenceReport = evidenceReport,
                Strengths = strengthsList,
                Improvements = weaknessesList.Count > 0 ? string.Join("\n", weaknessesList) : "Cần tích lũy thêm kinh nghiệm thực chiến.",
                Suggestion = evidenceReport?.OverallEvaluation?.Summary ?? evaluation.Summary,
                Criteria = new ReportCriteria
                {
                    TechnicalKnowledge = evaluation.TechnicalScore >= 0.8 ? "Xuất sắc" : (evaluation.TechnicalScore >= 0.6 ? "Tốt" : "Chưa tốt"),
                    Communication = evaluation.OverallScore >= 0.8 ? "Xuất sắc" : (evaluation.OverallScore >= 0.6 ? "Tốt" : "Chưa tốt"),
                    ProblemSolving = evaluation.SituationalScore >= 0.8 ? "Xuất sắc" : (evaluation.SituationalScore >= 0.6 ? "Tốt" : "Chưa tốt"),
                    Attitude = evaluation.CandidateQuestionScore >= 0.8 ? "Xuất sắc" : (evaluation.CandidateQuestionScore >= 0.6 ? "Tốt" : "Chưa tốt")
                }
            };

            session.Report = fallbackReport;
            session.Status = "completed";
            session.InterviewState.InterviewPhase = "COMPLETED";
            session.InterviewState.IsReadyToFinish = true;
            _fileDb.Sessions[session.Id] = session;
            _fileDb.Save();

            return InterviewReportResult.Success(fallbackReport);
        }
    }

    public class InterviewReportResult
    {
        public int StatusCode { get; init; }
        public object? Data { get; init; }

        public static InterviewReportResult Success(
            object data)
        {
            return new InterviewReportResult
            {
                StatusCode = 200,
                Data = data
            };
        }

        public static InterviewReportResult BadRequest(
            object data)
        {
            return new InterviewReportResult
            {
                StatusCode = 400,
                Data = data
            };
        }

        public static InterviewReportResult Error(
            string error,
            string detail)
        {
            return new InterviewReportResult
            {
                StatusCode = 500,
                Data = new
                {
                    error,
                    detail
                }
            };
        }
    }
}