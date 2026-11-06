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
                    else if (request.Responses != null && request.Responses.Count > 0)
                    {
                        session.Answers = request.Responses;
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

                int mainQCounter = 0;
                for (
                    var i = 0;
                    i < request.Responses.Count;
                    i++)
                {
                    var r = request.Responses[i];
                    bool isIntro = string.Equals(r.Question, "Giới thiệu bản thân", StringComparison.OrdinalIgnoreCase) ||
                                   string.Equals(r.Stage, InterviewStageNames.Introduction, StringComparison.OrdinalIgnoreCase) ||
                                   string.Equals(r.QuestionType, "Introduction", StringComparison.OrdinalIgnoreCase);

                    string qId = r.QuestionId ?? (isIntro ? "intro" : $"q_{++mainQCounter}");
                    string label = isIntro ? "Phần mở đầu (Giới thiệu bản thân)" : $"Câu hỏi chính {mainQCounter} [QuestionId: {qId}]";

                    transcriptList.Add(
                        $"{label}:\n" +
                        $"Câu hỏi: {r.Question}\n" +
                        $"Trả lời: {r.Answer}"
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

                report.EvaluationMethod = "ai_grounded";
                report.EvaluationConfidence = evaluation?.OverallConfidence.ToString() ?? "HIGH";

                // Ensure QuestionId & AnalysisStatus on knowledgeAnalysis (WI-INTERVIEW-REPORT-FIX-01)
                if (report.KnowledgeAnalysis != null && report.KnowledgeAnalysis.Count > 0)
                {
                    int autoIdx = 1;
                    foreach (var ka in report.KnowledgeAnalysis)
                    {
                        if (string.IsNullOrWhiteSpace(ka.QuestionId))
                        {
                            ka.QuestionId = $"q_{autoIdx++}";
                        }
                        if (string.IsNullOrWhiteSpace(ka.AnalysisStatus))
                        {
                            ka.AnalysisStatus = "ASSESSED";
                        }
                        if (string.IsNullOrWhiteSpace(ka.Strengths) && !string.IsNullOrWhiteSpace(ka.Analysis))
                        {
                            ka.Strengths = ka.Analysis;
                        }
                    }
                }

                // AI Score Protection: Deterministic evaluation is single source of truth for scores!
                if (evaluation != null)
                {
                    report.OverallScore = Math.Round(evaluation.OverallScore * 10.0, 1);
                    report.TechScore = evaluation.TechnicalScore.HasValue ? Math.Round(evaluation.TechnicalScore.Value * 10.0, 1) : null;
                    report.TechnicalStatus = evaluation.TechnicalStatus.ToString();
                    report.StarScore = evaluation.BehavioralScore > 0
                        ? Math.Round(evaluation.BehavioralScore * 10.0, 1)
                        : (evaluation.Competencies.Any(c => c.AreaName == "Behavioral (STAR)") ? Math.Round(evaluation.BehavioralScore * 10.0, 1) : 0.0);
                    report.SituationalScore = Math.Round(evaluation.SituationalScore * 10.0, 1);
                    report.CandidateQuestionScore = evaluation.CandidateQuestionStatus == DimensionAssessmentStatus.ASSESSED
                        ? Math.Round(evaluation.CandidateQuestionScore * 10.0, 1)
                        : null;
                    report.CandidateQuestionStatus = evaluation.CandidateQuestionStatus.ToString();
                    report.CommScore = Math.Round(evaluation.CommunicationScore * 10.0, 1);
                    report.SoftScore = Math.Round(evaluation.SoftScore * 10.0, 1);
                    report.IntelligenceSummary = evaluation.IntelligenceSummary ?? session?.EvidenceState?.Summary;
                    report.QualitySummary = evaluation.QualitySummary ?? (session?.QualityState != null ? new InterviewQualityService().CalculateQualitySummary(session) : null);
                }

                // Attach Phase 3 Step 2 EvidenceReport
                if (evaluation != null && report.Criteria != null && (!evaluation.TechnicalScore.HasValue || evaluation.TechnicalStatus != DimensionAssessmentStatus.ASSESSED))
                {
                    report.Criteria.TechnicalKnowledge = evaluation.TechnicalStatus == DimensionAssessmentStatus.EVALUATION_FAILED ? "Chưa thể đánh giá (dữ liệu không hợp lệ)" : "Chưa đánh giá";
                }
                if (evaluation != null && report.Criteria != null && evaluation.CandidateQuestionStatus != DimensionAssessmentStatus.ASSESSED)
                {
                    report.Criteria.Attitude = "Chưa đánh giá";
                }

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
                TechScore = evaluation.TechnicalScore.HasValue ? Math.Round(evaluation.TechnicalScore.Value * 10.0, 1) : null,
                TechnicalStatus = evaluation.TechnicalStatus.ToString(),
                CommScore = Math.Round(evaluation.CommunicationScore * 10.0, 1),
                SoftScore = Math.Round(evaluation.SoftScore * 10.0, 1),
                StarScore = evaluation.BehavioralScore > 0
                    ? Math.Round(evaluation.BehavioralScore * 10.0, 1)
                    : (evaluation.Competencies.Any(c => c.AreaName == "Behavioral (STAR)") ? Math.Round(evaluation.BehavioralScore * 10.0, 1) : 0.0),
                SituationalScore = Math.Round(evaluation.SituationalScore * 10.0, 1),
                CandidateQuestionScore = evaluation.CandidateQuestionStatus == DimensionAssessmentStatus.ASSESSED
                    ? Math.Round(evaluation.CandidateQuestionScore * 10.0, 1)
                    : null,
                CandidateQuestionStatus = evaluation.CandidateQuestionStatus.ToString(),
                EvaluationMethod = "deterministic_evidence_fallback",
                EvaluationConfidence = evaluation.OverallConfidence.ToString(),
                IntelligenceSummary = evaluation.IntelligenceSummary ?? session.EvidenceState?.Summary,
                QualitySummary = evaluation.QualitySummary ?? (session.QualityState != null ? new InterviewQualityService().CalculateQualitySummary(session) : null),
                EvidenceReport = evidenceReport,
                Strengths = strengthsList,
                Improvements = weaknessesList.Count > 0 ? string.Join("\n", weaknessesList) : "Cần tích lũy thêm kinh nghiệm thực chiến.",
                Suggestion = evidenceReport?.OverallEvaluation?.Summary ?? evaluation.Summary,
                KnowledgeAnalysis = new List<KnowledgeAnalysisItem>(),
                Criteria = new ReportCriteria
                {
                    TechnicalKnowledge = evaluation.TechnicalScore >= 8.0 ? "Xuất sắc" : (evaluation.TechnicalScore >= 6.5 ? "Tốt" : "Chưa tốt"),
                    Communication = evaluation.CommunicationScore >= 8.0 ? "Xuất sắc" : (evaluation.CommunicationScore >= 6.5 ? "Tốt" : "Chưa tốt"),
                    ProblemSolving = evaluation.SituationalScore >= 8.0 ? "Xuất sắc" : (evaluation.SituationalScore >= 6.5 ? "Tốt" : "Chưa tốt"),
                    Attitude = evaluation.CandidateQuestionScore >= 8.0 ? "Xuất sắc" : (evaluation.CandidateQuestionScore >= 6.5 ? "Tốt" : "Chưa tốt")
                }
            };

            if (!evaluation.TechnicalScore.HasValue || evaluation.TechnicalStatus != DimensionAssessmentStatus.ASSESSED)
            {
                fallbackReport.Criteria.TechnicalKnowledge = evaluation.TechnicalStatus == DimensionAssessmentStatus.EVALUATION_FAILED ? "Chưa thể đánh giá (dữ liệu không hợp lệ)" : "Chưa đánh giá";
            }
            if (evaluation.CandidateQuestionStatus != DimensionAssessmentStatus.ASSESSED)
            {
                fallbackReport.Criteria.Attitude = "Chưa đánh giá";
            }

            // Populate honest evidence-backed fallback knowledge analysis (WI-INTERVIEW-REPORT-FIX-01)
            if (session.Answers != null && session.Answers.Count > 0)
            {
                int fbQCount = 0;
                foreach (var a in session.Answers)
                {
                    bool isIntro = string.Equals(a.Question, "Giới thiệu bản thân", StringComparison.OrdinalIgnoreCase) ||
                                   string.Equals(a.Stage, InterviewStageNames.Introduction, StringComparison.OrdinalIgnoreCase) ||
                                   string.Equals(a.QuestionType, "Introduction", StringComparison.OrdinalIgnoreCase);
                    if (isIntro) continue;

                    fbQCount++;
                    var qId = a.QuestionId ?? $"q_{fbQCount}";
                    var rating = a.ShowsPracticalExperience || (a.VerifiedFacts != null && a.VerifiedFacts.Count > 0)
                        ? "Tốt"
                        : (a.IncorrectConcepts != null && a.IncorrectConcepts.Count > 0 ? "Chưa tốt" : "Đạt yêu cầu");

                    var evidenceText = a.VerifiedFacts != null && a.VerifiedFacts.Count > 0
                        ? string.Join(", ", a.VerifiedFacts)
                        : (a.Answer?.Length > 60 ? a.Answer.Substring(0, 57) + "..." : (a.Answer ?? ""));

                    fallbackReport.KnowledgeAnalysis.Add(new KnowledgeAnalysisItem
                    {
                        QuestionId = qId,
                        Question = a.Question,
                        Rating = rating,
                        AnalysisStatus = "FALLBACK",
                        Analysis = $"[Ghi nhận hệ thống] Câu trả lời đã được ghi nhận trong phiên{(a.VerifiedFacts?.Count > 0 ? ": " + string.Join("; ", a.VerifiedFacts) : "")}.",
                        Strengths = a.VerifiedFacts?.Count > 0 ? string.Join("; ", a.VerifiedFacts) : "Đã phản hồi câu hỏi phỏng vấn.",
                        Gaps = a.IncorrectConcepts?.Count > 0 ? string.Join("; ", a.IncorrectConcepts) : string.Empty,
                        Recommendation = string.Empty,
                        Supplement = string.Empty,
                        Evidence = evidenceText
                    });
                }
            }

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
