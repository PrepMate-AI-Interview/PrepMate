using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using backend.Models;

namespace backend.Services.Evaluation
{
    public class EvidenceReportService : IEvidenceReportService
    {
        public InterviewReport ProjectReport(FinalInterviewEvaluation evaluation, Session session)
        {
            var report = new InterviewReport
            {
                SessionInfo = new ReportSessionInfo
                {
                    SessionId = session.Id,
                    TargetPosition = evaluation.TargetPosition,
                    TargetLevel = evaluation.TargetLevel,
                    TargetCompany = evaluation.TargetCompany,
                    QuestionCount = evaluation.TotalQuestionsAsked,
                    TotalQuestionsBudget = evaluation.MaximumQuestions,
                    InterviewDurationMinutes = session.InterviewContext?.Strategy?.TargetDurationMinutes ?? 30
                },
                CompletionInfo = new ReportCompletionInfo
                {
                    Status = evaluation.CompletionStatus,
                    Interpretation = GetCompletionInterpretation(evaluation.CompletionStatus, evaluation.MaximumQuestions)
                },
                OverallEvaluation = new ReportOverallEvaluation
                {
                    Score = Math.Round(evaluation.OverallScore * 10.0, 1),
                    NormalizedScore = Math.Round(evaluation.OverallScore * 10.0, 1),
                    ScoreScale = "0-100",
                    OriginalScale = "0-10",
                    Confidence = evaluation.OverallConfidence,
                    DemonstratedLevel = evaluation.OverallLevelAssessment,
                    Summary = evaluation.Summary
                }
            };

            // 1. Map Competencies
            foreach (var comp in evaluation.Competencies)
            {
                var evidenceSummaryList = new List<string>();
                if (comp.EvidenceItems != null && comp.EvidenceItems.Count > 0)
                {
                    foreach (var ev in comp.EvidenceItems)
                    {
                        if (ev.ShowsPracticalExperience)
                        {
                            evidenceSummaryList.Add($"Lượt {ev.TurnIndex}: Thể hiện kinh nghiệm thực chiến (Độ sâu {ev.Depth}/3).");
                        }
                        else if (ev.Type == EvidenceType.CONTRADICTORY)
                        {
                            evidenceSummaryList.Add($"Lượt {ev.TurnIndex}: Phát hiện mâu thuẫn: {ev.Description}");
                        }
                        else
                        {
                            evidenceSummaryList.Add($"Lượt {ev.TurnIndex}: {ev.Description}");
                        }
                    }
                }
                else if (comp.CoverageStatus == ConceptCoverageStatus.NOT_TESTED)
                {
                    evidenceSummaryList.Add("Chưa có bằng chứng đánh giá trực tiếp trong phiên phỏng vấn.");
                }

                report.Competencies.Add(new ReportCompetencyItem
                {
                    ConceptId = comp.CompetencyId,
                    ConceptName = comp.CompetencyName,
                    AreaName = comp.AreaName,
                    WeightPercentage = comp.WeightPercentage,
                    Score = Math.Round(comp.Score * 10.0, 1),
                    ScoreScale = "0-100",
                    OriginalScale = "0-10",
                    CoverageStatus = comp.CoverageStatus,
                    DemonstratedLevel = comp.DemonstratedLevel,
                    Confidence = comp.Confidence,
                    IsMet = comp.IsMet,
                    Rationale = comp.Rationale,
                    EvidenceSummary = evidenceSummaryList,
                    EvidenceItems = comp.EvidenceItems ?? new List<EvidenceItem>()
                });
            }

            // 2. Strengths (Evidence-backed: STRONG/VERIFIED + HIGH confidence)
            foreach (var comp in evaluation.Competencies)
            {
                bool isStrongOrVerified = comp.CoverageStatus == ConceptCoverageStatus.STRONG || comp.CoverageStatus == ConceptCoverageStatus.VERIFIED;
                if (isStrongOrVerified && comp.Confidence == EvaluationConfidence.HIGH && comp.Score >= 7.5)
                {
                    var turns = comp.EvidenceItems?
                        .Where(e => e.TurnIndex > 0)
                        .Select(e => $"Lượt {e.TurnIndex}")
                        .Distinct()
                        .ToList() ?? new List<string>();

                    report.Strengths.Add(new ReportStrengthItem
                    {
                        Title = $"Nắm vững {comp.CompetencyName}",
                        Description = comp.Rationale,
                        SupportingCompetencies = new List<string> { comp.CompetencyName },
                        EvidenceReferences = turns.Count > 0 ? turns : new List<string> { "Đánh giá thực tế" }
                    });
                }
            }

            // Inherit verified performance dimension strengths if concept strengths were not isolated
            if (report.Strengths.Count == 0 && evaluation.PerformanceAssessment?.Dimensions != null)
            {
                foreach (var dim in evaluation.PerformanceAssessment.Dimensions)
                {
                    bool isStrong = string.Equals(dim.Level, "STRONG", StringComparison.OrdinalIgnoreCase) ||
                                   string.Equals(dim.Level, "SENIOR", StringComparison.OrdinalIgnoreCase);
                    if (isStrong && dim.Score >= 7.5)
                    {
                        var turns = dim.TurnReferences != null && dim.TurnReferences.Count > 0
                            ? dim.TurnReferences.Select(t => $"Lượt {t}").ToList()
                            : new List<string> { "Đánh giá thực tế" };

                        report.Strengths.Add(new ReportStrengthItem
                        {
                            Title = dim.Name,
                            Description = dim.Summary,
                            SupportingCompetencies = new List<string> { dim.Dimension.ToString() },
                            EvidenceReferences = turns
                        });
                    }
                }
            }

            // 3. Weaknesses (Evidence-backed: Candidate tested and demonstrated deficiency; NEVER for NOT_TESTED!)
            foreach (var comp in evaluation.Competencies)
            {
                if (comp.CoverageStatus == ConceptCoverageStatus.NOT_TESTED)
                {
                    // Invariant: NOT_TESTED is never a weakness
                    continue;
                }

                bool isWeakOrUnmet = comp.CoverageStatus == ConceptCoverageStatus.WEAK ||
                                     (comp.CoverageStatus == ConceptCoverageStatus.PARTIAL && !comp.IsMet) ||
                                     (comp.Score < 6.0 && comp.CoverageStatus != ConceptCoverageStatus.NOT_TESTED);

                if (isWeakOrUnmet)
                {
                    var turns = comp.EvidenceItems?
                        .Where(e => e.TurnIndex > 0)
                        .Select(e => $"Lượt {e.TurnIndex}")
                        .Distinct()
                        .ToList() ?? new List<string>();

                    report.Weaknesses.Add(new ReportWeaknessItem
                    {
                        Title = $"Hạn chế về {comp.CompetencyName}",
                        Description = comp.Rationale,
                        Reason = comp.CoverageStatus == ConceptCoverageStatus.WEAK
                            ? $"Ứng viên đã được kiểm tra và bộc lộ ngộ nhận hoặc trả lời sai kiến thức cốt lõi."
                            : $"Ứng viên đã được kiểm tra nhưng chưa đạt độ sâu theo yêu cầu cấp độ {comp.TargetLevel}.",
                        Confidence = comp.Confidence,
                        SupportingCompetencies = new List<string> { comp.CompetencyName },
                        EvidenceReferences = turns
                    });
                }
            }

            // 4. Knowledge Gaps (Strictly distinguished from Weaknesses)
            foreach (var comp in evaluation.Competencies)
            {
                if (comp.CoverageStatus == ConceptCoverageStatus.NOT_TESTED)
                {
                    report.KnowledgeGaps.Add(new ReportKnowledgeGapItem
                    {
                        ConceptName = comp.CompetencyName,
                        AreaName = comp.AreaName,
                        GapType = KnowledgeGapType.UNASSESSED,
                        IsMandatory = comp.IsMandatory,
                        Description = comp.IsMandatory
                            ? $"Kỹ năng bắt buộc '{comp.CompetencyName}' chưa được kiểm tra trong buổi phỏng vấn."
                            : $"Kỹ năng tham khảo '{comp.CompetencyName}' chưa được kiểm tra."
                    });
                }
                else if (comp.CoverageStatus == ConceptCoverageStatus.PARTIAL)
                {
                    bool hasPractical = comp.EvidenceItems?.Any(e => e.ShowsPracticalExperience) == true;
                    if (!hasPractical)
                    {
                        report.KnowledgeGaps.Add(new ReportKnowledgeGapItem
                        {
                            ConceptName = comp.CompetencyName,
                            AreaName = comp.AreaName,
                            GapType = KnowledgeGapType.MISSING_PRACTICAL_EVIDENCE,
                            IsMandatory = comp.IsMandatory,
                            Description = $"Ứng viên chưa cung cấp minh chứng bài toán thực tế cho '{comp.CompetencyName}'."
                        });
                    }
                    else
                    {
                        report.KnowledgeGaps.Add(new ReportKnowledgeGapItem
                        {
                            ConceptName = comp.CompetencyName,
                            AreaName = comp.AreaName,
                            GapType = KnowledgeGapType.INSUFFICIENT_DEPTH,
                            IsMandatory = comp.IsMandatory,
                            Description = $"Khái niệm '{comp.CompetencyName}' mới dừng lại ở mức cơ bản, cần đào sâu thêm trade-off."
                        });
                    }
                }
                else if (comp.CoverageStatus == ConceptCoverageStatus.INTRODUCED)
                {
                    report.KnowledgeGaps.Add(new ReportKnowledgeGapItem
                    {
                        ConceptName = comp.CompetencyName,
                        AreaName = comp.AreaName,
                        GapType = KnowledgeGapType.INSUFFICIENT_DEPTH,
                        IsMandatory = comp.IsMandatory,
                        Description = $"Khái niệm '{comp.CompetencyName}' mới chỉ được nhắc thoáng qua, chưa đủ bằng chứng khẳng định năng lực."
                    });
                }
                else if (comp.Score < 6.0 && comp.CoverageStatus != ConceptCoverageStatus.NOT_TESTED)
                {
                    report.KnowledgeGaps.Add(new ReportKnowledgeGapItem
                    {
                        ConceptName = comp.CompetencyName,
                        AreaName = comp.AreaName,
                        GapType = KnowledgeGapType.BELOW_EXPECTED_LEVEL,
                        IsMandatory = comp.IsMandatory,
                        Description = $"Mức độ thể hiện của '{comp.CompetencyName}' chưa đạt chuẩn cấp độ {comp.TargetLevel}."
                    });
                }
            }

            // 5. Risks
            if (evaluation.Risks != null)
            {
                foreach (var r in evaluation.Risks)
                {
                    int? turnNum = null;
                    var match = Regex.Match(r.Description ?? "", @"(?:Turn|Lượt)\s*(\d+)", RegexOptions.IgnoreCase);
                    if (match.Success && int.TryParse(match.Groups[1].Value, out int parsedTurn))
                    {
                        turnNum = parsedTurn;
                    }

                    report.Risks.Add(new ReportRiskItem
                    {
                        Type = r.Type,
                        Severity = r.Severity ?? "MEDIUM",
                        Description = r.Description ?? string.Empty,
                        Evidence = r.Evidence ?? string.Empty,
                        RelatedCompetency = r.RelatedConcept ?? string.Empty,
                        RelatedTurn = turnNum
                    });
                }
            }

            // 6. Evidence Summary & Turn Traceability
            var answers = session.Answers ?? new List<AnswerItem>();
            var allEvidenceItems = evaluation.Competencies.SelectMany(c => c.EvidenceItems ?? new List<EvidenceItem>()).ToList();

            var traces = new List<TurnEvidenceTrace>();
            for (int i = 0; i < answers.Count; i++)
            {
                var a = answers[i];
                var snippet = (a.Answer?.Length ?? 0) > 120 ? a.Answer!.Substring(0, 117) + "..." : (a.Answer ?? "");
                traces.Add(new TurnEvidenceTrace
                {
                    TurnIndex = i + 1,
                    Question = a.Question ?? "",
                    AnswerSnippet = snippet,
                    TargetConcept = a.TargetConceptName ?? a.TargetConceptId ?? "",
                    Depth = a.Depth,
                    ShowsPracticalExperience = a.ShowsPracticalExperience,
                    VerifiedFacts = a.VerifiedFacts ?? new List<string>(),
                    UnverifiedClaims = a.UnverifiedClaims ?? new List<string>(),
                    IncorrectConcepts = a.IncorrectConcepts ?? new List<string>(),
                    HasInconsistency = a.HasInconsistency
                });
            }

            report.EvidenceSummary = new ReportEvidenceSummary
            {
                TotalEvidenceItems = allEvidenceItems.Count,
                ObservedEvidenceCount = allEvidenceItems.Count(e => e.Type == EvidenceType.OBSERVED),
                PracticalExperienceEvidenceCount = allEvidenceItems.Count(e => e.ShowsPracticalExperience),
                VerifiedFactsCount = answers.Sum(a => a.VerifiedFacts?.Count ?? 0),
                InconsistenciesCount = answers.Count(a => a.HasInconsistency),
                TurnProvenance = traces
            };

            // 7. Limitations (What PrepMate CANNOT conclude)
            var limitations = new List<string>();
            if (evaluation.CompletionStatus == InterviewCompletionStatus.MAX_QUESTIONS_REACHED)
            {
                limitations.Add($"Phiên phỏng vấn đã chạm giới hạn {evaluation.MaximumQuestions} câu hỏi; một số kỹ năng chưa được đánh giá trọn vẹn.");
            }
            if (evaluation.MissingEvidence.Count > 0)
            {
                limitations.Add($"Còn {evaluation.MissingEvidence.Count} kỹ năng bắt buộc chưa có dữ liệu đánh giá: {string.Join(", ", evaluation.MissingEvidence.Take(3))}.");
            }
            if (report.EvidenceSummary.PracticalExperienceEvidenceCount == 0 && answers.Count > 0)
            {
                limitations.Add("Toàn bộ phiên phỏng vấn chủ yếu dừng ở mức độ trao đổi lý thuyết, chưa thể độc lập xác minh năng lực triển khai thực tế trên hệ thống sản xuất.");
            }
            if (evaluation.OverallConfidence == EvaluationConfidence.INSUFFICIENT_EVIDENCE)
            {
                limitations.Add("Dữ liệu phỏng vấn chưa đủ ngưỡng tin cậy để đưa ra kết luận tuyển dụng dứt khoát.");
            }
            if (evaluation.CompletionStatus == InterviewCompletionStatus.INSUFFICIENT_TURNS)
            {
                limitations.Add("Chưa có đủ số lượt hỏi đáp để đánh giá năng lực ứng viên.");
            }

            if (evaluation.PerformanceAssessment?.Limitations != null)
            {
                foreach (var lim in evaluation.PerformanceAssessment.Limitations)
                {
                    if (!limitations.Contains(lim)) limitations.Add(lim);
                }
            }

            report.Limitations = limitations;
            // Phase 3 Step 3: Performance Assessment attachment
            report.PerformanceAssessment = evaluation.PerformanceAssessment;
            // Phase 3 Step 4: Diagnostic Analysis attachment
            report.DiagnosticAnalysis = evaluation.DiagnosticAnalysis;
            // Phase 3 Step 5: Improvement Roadmap attachment
            report.ImprovementRoadmap = evaluation.ImprovementRoadmap;
            // Phase 3 Step 6: Interview Preparation Ecosystem attachment
            report.PreparationPlan = evaluation.PreparationPlan;

            return report;
        }

        private static string GetCompletionInterpretation(InterviewCompletionStatus status, int maxQuestions)
        {
            return status switch
            {
                InterviewCompletionStatus.COMPLETED_NORMAL =>
                    "Buổi phỏng vấn đã hoàn thành bình thường. Các kỹ năng mục tiêu đã được đánh giá đầy đủ bằng chứng theo kế hoạch.",
                InterviewCompletionStatus.MAX_QUESTIONS_REACHED =>
                    $"Buổi phỏng vấn chạm trần số lượng câu hỏi tối đa được cấu hình ({maxQuestions} câu). Một số kỹ năng có thể chưa được thu thập đủ bằng chứng chuyên sâu.",
                InterviewCompletionStatus.MANUAL_EXIT =>
                    "Ứng viên hoặc người phỏng vấn đã chủ động kết thúc phiên phỏng vấn trước thời hạn.",
                InterviewCompletionStatus.INSUFFICIENT_TURNS =>
                    "Chưa có đủ số lượt hỏi đáp tối thiểu để đưa ra đánh giá năng lực đáng tin cậy.",
                InterviewCompletionStatus.INTERRUPTED =>
                    "Phiên phỏng vấn bị gián đoạn trước khi hoàn tất.",
                _ => "Trạng thái hoàn thành không xác định."
            };
        }
    }
}
