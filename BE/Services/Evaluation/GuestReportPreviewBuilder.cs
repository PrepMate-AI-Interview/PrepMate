using System;
using System.Collections.Generic;
using System.Linq;
using backend.Models;

namespace backend.Services.Evaluation
{
    public class GuestStrengthPreviewItem
    {
        public string Competency { get; set; } = string.Empty;
        public string Observation { get; set; } = string.Empty;
        public string Evidence { get; set; } = string.Empty;
    }

    public class GuestImprovementPreviewItem
    {
        public string Problem { get; set; } = string.Empty;
        public string Why { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
    }

    public class DimensionSnapshotItem
    {
        public double? Score { get; set; }
        public string Status { get; set; } = "NOT_ASSESSED";
        public string ScoreScale { get; set; } = "0-100";
    }

    public class GuestPerformanceSnapshot
    {
        public DimensionSnapshotItem Technical { get; set; } = new();
        public DimensionSnapshotItem Star { get; set; } = new();
        public DimensionSnapshotItem Situational { get; set; } = new();
        public DimensionSnapshotItem Communication { get; set; } = new();
        public DimensionSnapshotItem SoftSkills { get; set; } = new();
    }

    public class GuestModalitySnapshot
    {
        public string Modality { get; set; } = string.Empty;
        public string Status { get; set; } = "NOT_ASSESSED";
        public string Summary { get; set; } = string.Empty;
        public string? Reason { get; set; }
    }

    public class GuestRepresentativeSample
    {
        public int Turn { get; set; } = 1;
        public string Question { get; set; } = string.Empty;
        public string CandidateSnippet { get; set; } = string.Empty;
        public string FeedbackHighlight { get; set; } = string.Empty;
        public string Competency { get; set; } = string.Empty;
    }

    public class GuestCapabilityTeaserDto
    {
        public string Title { get; set; } = "Năng lực Phân tích Đa chiều của PrepMate";
        public string Description { get; set; } = "PrepMate đánh giá toàn diện nội dung chuyên môn, cấu trúc lập luận STAR, nhịp độ giọng nói và tác phong phỏng vấn. Bản báo cáo đầy đủ mở khóa phân tích chuyên sâu kèm biểu đồ và gợi ý cải thiện.";
        public List<string> Capabilities { get; set; } = new()
        {
            "Phân tích chuyên sâu 5 câu hỏi phỏng vấn & ma trận rubric",
            "Đo lường nhịp độ phát âm, độ trôi chảy & ngữ điệu giọng nói",
            "Nhận xét tác phong chuyên nghiệp & mức độ tương tác qua camera"
        };
    }

    /// <summary>
    /// WI-REPORT-PREVIEW-02: Minimized Guest Report Preview DTO.
    /// Communicates outcomes while strictly preserving analytical depth, raw evidence,
    /// dimension breakdowns, telemetry, and action plans for authenticated users.
    /// </summary>
    public class GuestPreviewDto
    {
        public double? OverallScore { get; set; }
        public string? EvaluationRating { get; set; } = null;
        public string EvaluationStatus { get; set; } = "AVAILABLE"; // AVAILABLE, PENDING, EVALUATION_FAILED, INSUFFICIENT_EVIDENCE
        public string Summary { get; set; } = string.Empty;
        public string Interpretation { get; set; } = string.Empty;
        public List<GuestStrengthPreviewItem> TopStrengths { get; set; } = new();
        public string ImprovementTeaser { get; set; } = string.Empty;
        public List<GuestImprovementPreviewItem> ImprovementFocus { get; set; } = new();
        public GuestCapabilityTeaserDto AnalysisCapabilityTeaser { get; set; } = new();

        // Deprecated fields kept null for guest payload minimization
        public GuestPerformanceSnapshot? PerformanceSnapshot { get; set; } = null;
        public double? EvidenceCoverage { get; set; } = null;
        public string? EvaluationConfidence { get; set; } = null;
        public GuestModalitySnapshot? Communication { get; set; } = null;
        public GuestModalitySnapshot? VoiceDelivery { get; set; } = null;
        public GuestModalitySnapshot? BodyLanguage { get; set; } = null;
        public GuestRepresentativeSample? RepresentativeSample { get; set; } = null;
    }

    public static class GuestReportPreviewBuilder
    {
        public static string ResolveEvaluationRating(double score)
        {
            if (score >= 85.0) return "Xuất sắc";
            if (score >= 70.0) return "Tốt";
            if (score >= 55.0) return "Đạt yêu cầu";
            return "Cần cải thiện";
        }

        public static bool IsIntroductionTurn(AnswerItem? a)
        {
            if (a == null) return false;
            if (string.Equals(a.QuestionId, "intro", StringComparison.OrdinalIgnoreCase)) return true;
            if (string.Equals(a.QuestionType, "Introduction", StringComparison.OrdinalIgnoreCase)) return true;
            if (string.Equals(a.Stage, "INTRODUCTION", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(a.Stage, InterviewStageNames.Introduction, StringComparison.OrdinalIgnoreCase)) return true;
            if (!string.IsNullOrWhiteSpace(a.Question) &&
                (a.Question.Trim().StartsWith("Giới thiệu", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(a.Question.Trim(), "Giới thiệu bản thân", StringComparison.OrdinalIgnoreCase))) return true;
            return false;
        }

        public static GuestPreviewDto BuildGuestPreview(Session session)
        {
            var dto = new GuestPreviewDto();

            if (session == null)
            {
                dto.EvaluationStatus = "EVALUATION_FAILED";
                dto.OverallScore = null;
                dto.EvaluationRating = null;
                dto.Summary = "Không tìm thấy dữ liệu phiên phỏng vấn.";
                dto.Interpretation = "Hệ thống không thể truy xuất dữ liệu phỏng vấn.";
                return dto;
            }

            var report = session.Report;
            var eval = session.Evaluation;
            var answers = session.Answers ?? new List<AnswerItem>();

            // 1. Determine truthful evaluation status
            if (session.TechnicalEvaluationFailed || answers.Any(a => a.EvaluationFailed))
            {
                dto.EvaluationStatus = "EVALUATION_FAILED";
                dto.OverallScore = null;
                dto.EvaluationRating = null;
                dto.Summary = session.TechnicalEvaluationFailureReason ?? "Đánh giá năng lực không hoàn tất do lỗi xử lý hệ thống.";
                dto.Interpretation = "Đánh giá chưa thành công; vui lòng thử lại phiên phỏng vấn.";
                return dto;
            }

            var mainAnswers = answers
                .Where(a => !IsIntroductionTurn(a) && !string.IsNullOrWhiteSpace(a.Answer))
                .ToList();

            if (mainAnswers.Count == 0 && (report == null || report.OverallScore <= 0) && (eval == null || eval.OverallScore <= 0) && (!session.OverallScore.HasValue || session.OverallScore.Value <= 0))
            {
                dto.EvaluationStatus = "INSUFFICIENT_EVIDENCE";
                dto.OverallScore = null;
                dto.EvaluationRating = null;
                dto.Summary = "Chưa có đủ câu hỏi và câu trả lời để đưa ra kết luận đánh giá hợp lệ.";
                dto.Interpretation = "Cần thêm dữ liệu câu trả lời để hoàn thiện đánh giá.";
                return dto;
            }

            // 2. Authoritative OverallScore & Classification Rating (0-100 SSOT)
            double rawScore = 0.0;
            if (report != null && report.OverallScore > 0)
            {
                rawScore = report.OverallScore;
            }
            else if (eval != null && eval.OverallScore > 0)
            {
                rawScore = Math.Round(eval.OverallScore * 10.0, 1);
            }
            else if (session.OverallScore.HasValue && session.OverallScore.Value > 0)
            {
                rawScore = session.OverallScore.Value;
            }

            if (rawScore <= 0)
            {
                // Incomplete or pending evaluation
                dto.EvaluationStatus = "PENDING";
                dto.OverallScore = null;
                dto.EvaluationRating = null;
                dto.Summary = "Phiên phỏng vấn đang trong quá trình thực hiện hoặc chờ xử lý đánh giá.";
                dto.Interpretation = "Hệ thống đang hoàn thiện phân tích dữ liệu câu trả lời.";
                return dto;
            }

            dto.EvaluationStatus = "AVAILABLE";
            dto.OverallScore = Math.Round(rawScore, 1);
            dto.EvaluationRating = ResolveEvaluationRating(dto.OverallScore.Value);

            // 3. Interview Summary: Maximum 1-2 concise sentences (high-level result, no evaluation reasoning leaked)
            // WI-GUEST-PREVIEW-REMEDIATION-01: Non-formulaic, specific to role, seniority, and evaluated rating/score
            string jobTitle = !string.IsNullOrWhiteSpace(session.JobTitle) ? session.JobTitle : "Chuyên viên chuyên môn";
            string level = session.InterviewContext?.ExperienceLevel ?? "Middle";
            double score = dto.OverallScore ?? 0.0;
            string rating = dto.EvaluationRating;

            if (rating == "Xuất sắc")
            {
                dto.Summary = $"Ứng viên đã hoàn tất các lượt phỏng vấn cho vị trí {jobTitle} ({level}) với kết quả xuất sắc ({score:0}/100). Năng lực chuyên môn vượt trội và khả năng lập luận sắc bén đáp ứng toàn diện kỳ vọng của vai trò.";
            }
            else if (rating == "Tốt")
            {
                dto.Summary = $"Ứng viên đã hoàn tất các lượt phỏng vấn cho vị trí {jobTitle} ({level}) với kết quả tốt ({score:0}/100). Tư duy xử lý tình huống và kiến thức chuyên môn đáp ứng vững vàng các tiêu chuẩn trọng yếu của vai trò.";
            }
            else if (rating == "Đạt yêu cầu")
            {
                dto.Summary = $"Ứng viên đã hoàn tất các lượt phỏng vấn cho vị trí {jobTitle} ({level}) với mức độ đáp ứng đạt yêu cầu ({score:0}/100). Ứng viên nắm vững các kiến thức cốt lõi, có tiềm năng hoàn thiện tốt hơn ở các khía cạnh chuyên sâu.";
            }
            else
            {
                dto.Summary = $"Ứng viên đã hoàn tất các lượt phỏng vấn cho vị trí {jobTitle} ({level}) ở mức cần cải thiện ({score:0}/100). Kết quả cho thấy cần củng cố thêm kiến thức nền tảng và rèn luyện kỹ năng giải quyết tình huống thực tế cho vị trí này.";
            }

            // 4. One short interpretation sentence
            if (dto.OverallScore >= 85.0)
                dto.Interpretation = "Ứng viên thể hiện năng lực vượt trội, sẵn sàng đảm nhiệm các thách thức chuyên môn phức tạp.";
            else if (dto.OverallScore >= 70.0)
                dto.Interpretation = "Ứng viên đáp ứng tốt các tiêu chuẩn vị trí với nền tảng kỹ năng vững vàng.";
            else if (dto.OverallScore >= 55.0)
                dto.Interpretation = "Ứng viên nắm được các yêu cầu cơ bản, có tiềm năng phát triển tốt khi được bồi dưỡng thêm.";
            else
                dto.Interpretation = "Ứng viên cần củng cố thêm kiến thức nền tảng và rèn luyện kỹ năng phỏng vấn thực tế.";

            // 5. Strengths: Maximum 2 short, high-level observations. NO answer quotations, NO detailed evidence.
            ResolveTopStrengths(session, dto);

            // 6. Improvement Teaser: Reveal only ONE high-level improvement theme. NO problem analysis, root cause, or action plan.
            ResolveImprovementTeaser(session, dto);

            // 7. Analysis Capability Teaser: Restrained message without actual metrics, scores, or observations
            dto.AnalysisCapabilityTeaser = new GuestCapabilityTeaserDto();

            return dto;
        }

        private static void ResolveTopStrengths(Session session, GuestPreviewDto dto)
        {
            var strengths = new List<GuestStrengthPreviewItem>();
            var report = session.Report;
            var evidenceReport = report?.EvidenceReport;

            // FIX-03: Do not override an explicit "no demonstrated strengths" with unsupported meta-strengths
            if (HasNoDemonstratedStrengths(session))
            {
                dto.TopStrengths = new List<GuestStrengthPreviewItem>
                {
                    new GuestStrengthPreviewItem
                    {
                        Competency = "Năng lực Chuyên môn",
                        Observation = "Chưa ghi nhận điểm mạnh nổi bật qua các lượt trao đổi trong phiên phỏng vấn.",
                        Evidence = string.Empty
                    }
                };
                return;
            }

            // 1. Structured strengths from EvidenceReport (filtering out unverified meta-strengths)
            if (evidenceReport?.Strengths != null && evidenceReport.Strengths.Count > 0)
            {
                var validStrengths = evidenceReport.Strengths
                    .Where(s => !string.IsNullOrWhiteSpace(s.Title))
                    .Where(s => !IsUnsupportedMetaStrength(s.Title))
                    .ToList();

                if (validStrengths.Count == 0)
                {
                    validStrengths = evidenceReport.Strengths
                        .Where(s => s.EvidenceReferences != null && s.EvidenceReferences.Count > 0)
                        .ToList();
                }

                foreach (var s in validStrengths.Take(2))
                {
                    string compName = SanitizeCompetencyLabel(s.Title);
                    strengths.Add(new GuestStrengthPreviewItem
                    {
                        Competency = compName,
                        Observation = "Ứng viên thể hiện tư duy chuyên môn rõ ràng và phương pháp tiếp cận phù hợp.",
                        Evidence = string.Empty // No quotations or turn references
                    });
                }
            }

            // 2. Evaluation KeyStrengths fallback
            if (strengths.Count == 0 && session.Evaluation?.KeyStrengths != null && session.Evaluation.KeyStrengths.Count > 0)
            {
                foreach (var ks in session.Evaluation.KeyStrengths.Take(2))
                {
                    var parsed = ParseStrengthLine(ks);
                    if (parsed != null)
                    {
                        strengths.Add(parsed);
                    }
                }
            }

            // 3. Free-text Strengths fallback (FIX-02: Robust narrative parsing)
            if (strengths.Count == 0 && !string.IsNullOrWhiteSpace(report?.Strengths))
            {
                var raw = report.Strengths.Trim();
                var lines = raw.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(l => l.Trim().TrimStart('-', '•', '✓', ' ', '*'))
                    .Where(l => !string.IsNullOrWhiteSpace(l))
                    .ToList();

                if (lines.Count > 1)
                {
                    foreach (var line in lines.Take(2))
                    {
                        var parsed = ParseStrengthLine(line);
                        if (parsed != null)
                        {
                            strengths.Add(parsed);
                        }
                    }
                }
                else if (lines.Count == 1)
                {
                    var parsed = ParseNarrativeStrength(lines[0]);
                    if (parsed != null)
                    {
                        strengths.Add(parsed);
                    }
                }
            }

            // 4. Default graceful fallback
            if (strengths.Count == 0)
            {
                strengths.Add(new GuestStrengthPreviewItem
                {
                    Competency = "Tinh thần Cầu thị & Tác phong",
                    Observation = "Ứng viên chủ động hoàn tất các lượt phỏng vấn và thể hiện thái độ tích cực.",
                    Evidence = string.Empty
                });
            }

            dto.TopStrengths = strengths.Take(2).ToList();
        }

        private static bool HasNoDemonstratedStrengths(Session session)
        {
            var report = session.Report;
            if (report != null && !string.IsNullOrWhiteSpace(report.Strengths))
            {
                var lower = report.Strengths.ToLowerInvariant();
                if (lower.Contains("chưa ghi nhận") ||
                    lower.Contains("không ghi nhận") ||
                    lower.Contains("chưa thể hiện") ||
                    lower.Contains("không có điểm mạnh") ||
                    lower.Contains("chưa có điểm mạnh") ||
                    lower.Contains("chưa đủ bằng chứng") ||
                    lower.Contains("chưa đủ cơ sở") ||
                    lower.Contains("quá ngắn") ||
                    lower.Contains("không phát hiện điểm mạnh"))
                {
                    return true;
                }
            }

            if (session.Evaluation?.KeyStrengths != null && session.Evaluation.KeyStrengths.Count > 0)
            {
                var first = session.Evaluation.KeyStrengths[0].ToLowerInvariant();
                if (first.Contains("chưa ghi nhận") || first.Contains("không có") || first.Contains("chưa thể hiện"))
                {
                    return true;
                }
            }

            if (session.Report?.OverallScore > 0 && session.Report.OverallScore < 40 &&
                string.IsNullOrWhiteSpace(session.Report.Strengths))
            {
                return true;
            }

            return false;
        }

        private static bool IsUnsupportedMetaStrength(string title)
        {
            if (string.IsNullOrWhiteSpace(title)) return true;
            var t = title.Trim().ToLowerInvariant();
            return t == "follow-up handling" ||
                   t == "consistency" ||
                   t == "responsiveness" ||
                   t == "engagement" ||
                   t == "tác phong phỏng vấn";
        }

        private static GuestStrengthPreviewItem? ParseStrengthLine(string line)
        {
            if (string.IsNullOrWhiteSpace(line)) return null;
            line = line.Trim().TrimStart('-', '•', '✓', ' ', '*');

            var parts = line.Split(new[] { ':', '-', '–' }, 2);
            string compCandidate = parts[0].Trim();

            if (compCandidate.Length > 0 && compCandidate.Length <= 50)
            {
                string obs = parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1])
                    ? parts[1].Trim()
                    : "Năng lực then chốt được ghi nhận tích cực trong buổi phỏng vấn.";

                if (obs.Length > 180)
                {
                    var dotIdx = obs.IndexOf('.');
                    if (dotIdx > 20 && dotIdx <= 180)
                        obs = obs.Substring(0, dotIdx + 1);
                    else if (obs.Length > 177)
                        obs = obs.Substring(0, 177) + "...";
                }

                return new GuestStrengthPreviewItem
                {
                    Competency = compCandidate,
                    Observation = obs,
                    Evidence = string.Empty
                };
            }

            return ParseNarrativeStrength(line);
        }

        private static GuestStrengthPreviewItem ParseNarrativeStrength(string text)
        {
            text = text.Trim().TrimStart('-', '•', '✓', ' ', '*');

            string label = ExtractThemeFromNarrative(text);

            string obs = text;
            var dotIdx = obs.IndexOf('.');
            if (dotIdx > 20 && dotIdx <= 160)
            {
                obs = obs.Substring(0, dotIdx + 1).Trim();
            }
            else if (obs.Length > 157)
            {
                int spaceIdx = obs.LastIndexOf(' ', Math.Min(155, obs.Length - 1));
                if (spaceIdx > 50)
                    obs = obs.Substring(0, spaceIdx) + "...";
                else
                    obs = obs.Substring(0, 154) + "...";
            }

            return new GuestStrengthPreviewItem
            {
                Competency = label,
                Observation = obs,
                Evidence = string.Empty
            };
        }

        private static string ExtractThemeFromNarrative(string text)
        {
            var lower = text.ToLowerInvariant();
            if (lower.Contains("cơ sở dữ liệu") || lower.Contains("sql") || lower.Contains("database"))
                return "Thiết kế & Tối ưu Cơ sở Dữ liệu";
            if (lower.Contains("kiến trúc") || lower.Contains("microservice") || lower.Contains("hệ thống"))
                return "Kiến trúc Hệ thống & Kỹ thuật";
            if (lower.Contains(".net") || lower.Contains("c#") || lower.Contains("backend") || lower.Contains("lập trình"))
                return "Kỹ thuật Lập trình & Nền tảng";
            if (lower.Contains("frontend") || lower.Contains("react") || lower.Contains("ui") || lower.Contains("giao diện"))
                return "Phát triển Giao diện & Trải nghiệm";
            if (lower.Contains("giao tiếp") || lower.Contains("trình bày") || lower.Contains("star"))
                return "Kỹ năng Truyền đạt & Cấu trúc";
            if (lower.Contains("quản lý") || lower.Contains("lãnh đạo") || lower.Contains("lead"))
                return "Tư duy Quản lý & Điều phối";

            return "Kiến thức Chuyên môn Cốt lõi";
        }

        private static string SanitizeCompetencyLabel(string label)
        {
            if (string.IsNullOrWhiteSpace(label)) return "Năng lực Chuyên môn";
            var clean = label.Trim().TrimStart('-', '•', '✓', ' ', '*');
            if (clean.Length > 50)
            {
                return ExtractThemeFromNarrative(clean);
            }
            return clean;
        }

        private static void ResolveImprovementTeaser(Session session, GuestPreviewDto dto)
        {
            string theme = string.Empty;
            var report = session.Report;
            var evidenceReport = report?.EvidenceReport;

            if (evidenceReport?.Weaknesses != null && evidenceReport.Weaknesses.Count > 0)
            {
                theme = evidenceReport.Weaknesses[0].Title;
            }
            else if (evidenceReport?.KnowledgeGaps != null && evidenceReport.KnowledgeGaps.Count > 0)
            {
                theme = $"Kiến thức chuyên sâu về {evidenceReport.KnowledgeGaps[0].ConceptName}";
            }
            else if (session.Evaluation?.KeyWeaknesses != null && session.Evaluation.KeyWeaknesses.Count > 0)
            {
                var parts = session.Evaluation.KeyWeaknesses[0].Split(new[] { ':', '-', '–' }, 2);
                theme = parts[0].Trim().TrimStart('-', '•', ' ', '*');
            }
            else if (!string.IsNullOrWhiteSpace(report?.Improvements))
            {
                var lines = report.Improvements.Split(new[] { '\r', '\n', ';' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(l => l.Trim().TrimStart('-', '•', ' ', '*'))
                    .Where(l => !string.IsNullOrWhiteSpace(l))
                    .ToList();
                if (lines.Count > 0)
                {
                    theme = lines[0];
                }
            }

            if (string.IsNullOrWhiteSpace(theme))
            {
                theme = "Độ sâu phân tích và đo lường tác động của giải pháp kỹ thuật";
            }

            if (theme.Length > 80)
            {
                var colon = theme.Split(new[] { ':', '-', '–' }, 2);
                if (colon[0].Trim().Length <= 80 && colon[0].Trim().Length >= 10)
                {
                    theme = colon[0].Trim();
                }
                else
                {
                    var dot = theme.IndexOf('.');
                    if (dot > 10 && dot <= 80)
                        theme = theme.Substring(0, dot).Trim();
                    else if (theme.Length > 77)
                        theme = theme.Substring(0, 77) + "...";
                }
            }

            // Only ONE high-level improvement theme. NO problem analysis, root cause, or action plan.
            dto.ImprovementTeaser = theme;

            // Compact 1-item representation for backwards compatibility without leaking root causes/actions
            dto.ImprovementFocus = new List<GuestImprovementPreviewItem>
            {
                new GuestImprovementPreviewItem
                {
                    Problem = theme,
                    Why = string.Empty,
                    Action = string.Empty
                }
            };
        }
    }
}
