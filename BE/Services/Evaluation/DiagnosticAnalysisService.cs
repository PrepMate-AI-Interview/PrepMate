using System;
using System.Collections.Generic;
using System.Linq;
using backend.Models;

namespace backend.Services.Evaluation
{
    public class DiagnosticAnalysisService : IDiagnosticAnalysisService
    {
        public DiagnosticAnalysis AnalyzeSession(Session session, FinalInterviewEvaluation evaluation)
        {
            if (session == null) throw new ArgumentNullException(nameof(session));
            if (evaluation == null) throw new ArgumentNullException(nameof(evaluation));

            var diagnosis = new DiagnosticAnalysis
            {
                SessionId = session.Id,
                CreatedAt = DateTime.UtcNow
            };

            var answers = session.Answers ?? new List<AnswerItem>();
            var competencies = evaluation.Competencies ?? new List<CompetencyEvaluation>();
            var risks = evaluation.Risks ?? new List<EvaluationRisk>();
            var perf = evaluation.PerformanceAssessment;
            var targetLevel = !string.IsNullOrWhiteSpace(evaluation.TargetLevel) ? evaluation.TargetLevel : "Mid";
            bool isSenior = targetLevel.Contains("Senior", StringComparison.OrdinalIgnoreCase);
            bool isJunior = targetLevel.Contains("Junior", StringComparison.OrdinalIgnoreCase);

            // Empty Evidence Guard: If no answers were given, do not fabricate diagnostics
            if (answers.Count == 0)
            {
                // Map unassessed gaps if blueprint exists
                foreach (var comp in competencies.Where(c => c.CoverageStatus == ConceptCoverageStatus.NOT_TESTED))
                {
                    diagnosis.KnowledgeGaps.Add(new KnowledgeGapDiagnosis
                    {
                        Title = $"Chưa kiểm tra: {comp.CompetencyName}",
                        RelatedCompetency = comp.CompetencyName,
                        GapType = KnowledgeGapType.UNASSESSED,
                        IsMandatory = comp.IsMandatory,
                        Impact = comp.IsMandatory ? DiagnosticImpact.HIGH : DiagnosticImpact.MEDIUM,
                        Priority = comp.IsMandatory ? DiagnosticPriority.HIGH : DiagnosticPriority.LOW,
                        Confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE,
                        Description = $"Chưa có câu hỏi phỏng vấn nào được thực hiện đối với kỹ năng '{comp.CompetencyName}'."
                    });
                }

                diagnosis.Limitations.Add("Chưa có lượt trả lời phỏng vấn nào để thực hiện chẩn đoán năng lực.");
                return diagnosis;
            }

            // 1. STRENGTH DIAGNOSIS
            DiagnoseStrengths(diagnosis, competencies, perf, answers);

            // 2. WEAKNESS DIAGNOSIS (Tested deficiencies only; NOT_TESTED is strictly excluded)
            DiagnoseWeaknesses(diagnosis, competencies, answers, isSenior, isJunior);

            // 3. KNOWLEDGE GAPS DIAGNOSIS
            DiagnoseKnowledgeGaps(diagnosis, competencies);

            // 4. RISK DIAGNOSIS (Reuse EvaluationRisk, no accusation of lying)
            DiagnoseRisks(diagnosis, risks);

            // 5. CROSS-DIMENSION FINDINGS
            DiagnoseCrossDimensionPatterns(diagnosis, perf);

            // 6. PRIORITIES SYNTHESIS
            SynthesizePriorities(diagnosis);

            // 7. LIMITATIONS
            SynthesizeLimitations(diagnosis, evaluation, answers);

            return diagnosis;
        }

        private static void DiagnoseStrengths(
            DiagnosticAnalysis diagnosis,
            List<CompetencyEvaluation> competencies,
            InterviewPerformanceAssessment? perf,
            List<AnswerItem> answers)
        {
            // Competency-based strengths
            foreach (var comp in competencies)
            {
                if (comp.CoverageStatus == ConceptCoverageStatus.NOT_TESTED) continue;

                bool isStrongOrVerified = comp.CoverageStatus == ConceptCoverageStatus.STRONG ||
                                          comp.CoverageStatus == ConceptCoverageStatus.VERIFIED;

                if (isStrongOrVerified && comp.Confidence == EvaluationConfidence.HIGH && comp.Score >= 7.5)
                {
                    var evidenceTurns = comp.EvidenceItems?
                        .Where(e => e.TurnIndex > 0)
                        .Select(e => e.TurnIndex)
                        .Distinct()
                        .OrderBy(t => t)
                        .ToList() ?? new List<int>();

                    var strengthType = StrengthType.TECHNICAL_KNOWLEDGE;
                    if (comp.EvidenceItems?.Any(e => e.ShowsPracticalExperience) == true)
                    {
                        strengthType = StrengthType.PRACTICAL_EXPERIENCE;
                    }
                    else if (comp.EvidenceItems?.Any(e => e.Depth >= 3) == true)
                    {
                        strengthType = StrengthType.REASONING_DEPTH;
                    }

                    var evidenceDesc = evidenceTurns.Count > 0
                        ? evidenceTurns.Select(t => $"Lượt {t}").ToList()
                        : new List<string> { "Đánh giá thực tế trong phiên" };

                    diagnosis.Strengths.Add(new StrengthDiagnosis
                    {
                        Title = $"Nắm vững chuyên sâu: {comp.CompetencyName}",
                        RelatedCompetency = comp.CompetencyName,
                        Type = strengthType,
                        Impact = comp.IsMandatory ? DiagnosticImpact.HIGH : DiagnosticImpact.MEDIUM,
                        Confidence = EvaluationConfidence.HIGH,
                        Evidence = evidenceDesc,
                        TurnReferences = evidenceTurns,
                        Explanation = comp.Rationale
                    });
                }
            }

            // Dimension-based strengths from performance
            if (perf != null)
            {
                var followUp = perf.FindDimension(PerformanceDimensionType.FOLLOW_UP_HANDLING);
                if (followUp?.Level == "STRONG" && followUp.Confidence == EvaluationConfidence.HIGH)
                {
                    diagnosis.Strengths.Add(new StrengthDiagnosis
                    {
                        Title = "Khả năng ứng biến và mở rộng luận điểm xuất sắc",
                        RelatedCompetency = "FOLLOW_UP_HANDLING",
                        Type = StrengthType.FOLLOW_UP_HANDLING,
                        Impact = DiagnosticImpact.HIGH,
                        Confidence = EvaluationConfidence.HIGH,
                        Evidence = followUp.TurnReferences.Select(t => $"Lượt {t}").ToList(),
                        TurnReferences = followUp.TurnReferences,
                        Explanation = followUp.Summary
                    });
                }

                var comm = perf.FindDimension(PerformanceDimensionType.COMMUNICATION);
                if (comm?.Level == "STRONG" && comm.Confidence == EvaluationConfidence.HIGH)
                {
                    diagnosis.Strengths.Add(new StrengthDiagnosis
                    {
                        Title = "Kỹ năng truyền đạt và dẫn chứng mạch lạc",
                        RelatedCompetency = "COMMUNICATION",
                        Type = StrengthType.COMMUNICATION,
                        Impact = DiagnosticImpact.MEDIUM,
                        Confidence = EvaluationConfidence.HIGH,
                        Evidence = comm.TurnReferences.Select(t => $"Lượt {t}").ToList(),
                        TurnReferences = comm.TurnReferences,
                        Explanation = comm.Summary
                    });
                }
            }
        }

        private static void DiagnoseWeaknesses(
            DiagnosticAnalysis diagnosis,
            List<CompetencyEvaluation> competencies,
            List<AnswerItem> answers,
            bool isSenior,
            bool isJunior)
        {
            foreach (var comp in competencies)
            {
                // Invariant: NOT_TESTED is NEVER diagnosed as a weakness!
                if (comp.CoverageStatus == ConceptCoverageStatus.NOT_TESTED)
                {
                    continue;
                }

                // Junior Calibration: Do not diagnose missing senior depth as a weakness for Junior
                if (isJunior && comp.CoverageStatus == ConceptCoverageStatus.PARTIAL && comp.IsMet)
                {
                    continue;
                }

                bool isWeakOrUnmet = comp.CoverageStatus == ConceptCoverageStatus.WEAK ||
                                     (comp.CoverageStatus == ConceptCoverageStatus.PARTIAL && !comp.IsMet) ||
                                     (comp.Score < 6.0 && comp.CoverageStatus != ConceptCoverageStatus.NOT_TESTED);

                if (isWeakOrUnmet)
                {
                    // Find matching turns
                    var matchingTurns = new List<int>();
                    var matchingAnswers = new List<AnswerItem>();
                    for (int i = 0; i < answers.Count; i++)
                    {
                        var a = answers[i];
                        bool match = string.Equals(a.TargetConceptId, comp.CompetencyId, StringComparison.OrdinalIgnoreCase) ||
                                     string.Equals(a.TargetConceptName, comp.CompetencyName, StringComparison.OrdinalIgnoreCase) ||
                                     a.IncorrectConcepts.Any(ic => ic.IndexOf(comp.CompetencyName, StringComparison.OrdinalIgnoreCase) >= 0) ||
                                     a.CorrectConcepts.Any(cc => cc.IndexOf(comp.CompetencyName, StringComparison.OrdinalIgnoreCase) >= 0);
                        if (match)
                        {
                            matchingTurns.Add(i + 1);
                            matchingAnswers.Add(a);
                        }
                    }

                    // Determine Root Cause
                    DiagnosticRootCause rootCause;
                    bool hasTradeOffMention = matchingAnswers.Any(a =>
                        (a.Question?.IndexOf("trade-off", StringComparison.OrdinalIgnoreCase) >= 0 ||
                         a.Question?.IndexOf("tradeoff", StringComparison.OrdinalIgnoreCase) >= 0 ||
                         a.Question?.IndexOf("write overhead", StringComparison.OrdinalIgnoreCase) >= 0 ||
                         a.Question?.IndexOf("composite", StringComparison.OrdinalIgnoreCase) >= 0 ||
                         a.Question?.IndexOf("đánh đổi", StringComparison.OrdinalIgnoreCase) >= 0 ||
                         a.Answer?.IndexOf("trade-off", StringComparison.OrdinalIgnoreCase) >= 0 ||
                         a.Answer?.IndexOf("composite", StringComparison.OrdinalIgnoreCase) >= 0));

                    if (comp.CoverageStatus == ConceptCoverageStatus.WEAK &&
                        matchingAnswers.Any(a => a.IncorrectConcepts.Count > 0 || a.Answer?.IndexOf("không biết", StringComparison.OrdinalIgnoreCase) >= 0))
                    {
                        rootCause = DiagnosticRootCause.KNOWLEDGE_GAP;
                    }
                    else if (hasTradeOffMention)
                    {
                        rootCause = DiagnosticRootCause.TRADE_OFF_REASONING_GAP;
                    }
                    else if (matchingTurns.Count > 1 && matchingAnswers.LastOrDefault()?.Depth < matchingAnswers.FirstOrDefault()?.Depth)
                    {
                        rootCause = DiagnosticRootCause.FOLLOW_UP_DEPTH_GAP;
                    }
                    else
                    {
                        rootCause = DiagnosticRootCause.INSUFFICIENT_DEPTH;
                    }

                    // Determine Impact (Mandatory weakness is HIGH; Optional is NOT automatically HIGH)
                    var impact = comp.IsMandatory ? DiagnosticImpact.HIGH : DiagnosticImpact.MEDIUM;

                    // Determine Priority (Senior depth gaps and mandatory core gaps get HIGH priority)
                    DiagnosticPriority priority;
                    if (comp.IsMandatory && (comp.CoverageStatus == ConceptCoverageStatus.WEAK || (isSenior && rootCause == DiagnosticRootCause.INSUFFICIENT_DEPTH)))
                    {
                        priority = DiagnosticPriority.HIGH;
                    }
                    else if (impact == DiagnosticImpact.HIGH)
                    {
                        priority = DiagnosticPriority.MEDIUM;
                    }
                    else
                    {
                        priority = DiagnosticPriority.LOW;
                    }

                    var evidenceDesc = matchingTurns.Count > 0
                        ? matchingTurns.Select(t => $"Lượt {t}").ToList()
                        : new List<string> { "Đánh giá qua câu hỏi phỏng vấn" };

                    diagnosis.Weaknesses.Add(new WeaknessDiagnosis
                    {
                        Title = $"Hạn chế: {comp.CompetencyName}",
                        RelatedCompetency = comp.CompetencyName,
                        RootCause = rootCause,
                        Impact = impact,
                        Priority = priority,
                        Confidence = comp.Confidence,
                        Evidence = evidenceDesc,
                        TurnReferences = matchingTurns,
                        Explanation = comp.Rationale
                    });
                }
            }
        }

        private static void DiagnoseKnowledgeGaps(
            DiagnosticAnalysis diagnosis,
            List<CompetencyEvaluation> competencies)
        {
            foreach (var comp in competencies)
            {
                if (comp.CoverageStatus == ConceptCoverageStatus.NOT_TESTED)
                {
                    diagnosis.KnowledgeGaps.Add(new KnowledgeGapDiagnosis
                    {
                        Title = $"Chưa kiểm tra: {comp.CompetencyName}",
                        RelatedCompetency = comp.CompetencyName,
                        GapType = KnowledgeGapType.UNASSESSED,
                        IsMandatory = comp.IsMandatory,
                        Impact = comp.IsMandatory ? DiagnosticImpact.HIGH : DiagnosticImpact.MEDIUM,
                        Priority = comp.IsMandatory ? DiagnosticPriority.HIGH : DiagnosticPriority.LOW,
                        Confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE,
                        Description = comp.IsMandatory
                            ? $"Kỹ năng bắt buộc '{comp.CompetencyName}' chưa được kiểm chứng trong buổi phỏng vấn."
                            : $"Kỹ năng tham khảo '{comp.CompetencyName}' chưa được kiểm tra."
                    });
                }
                else if (comp.Score >= 7.5 && (comp.EvidenceItems == null || comp.EvidenceItems.All(e => !e.ShowsPracticalExperience)))
                {
                    // Invariant: Knowledge is strong, but practical experience is unevidenced (Test 3)
                    diagnosis.KnowledgeGaps.Add(new KnowledgeGapDiagnosis
                    {
                        Title = $"Thiếu minh chứng thực chiến: {comp.CompetencyName}",
                        RelatedCompetency = comp.CompetencyName,
                        GapType = KnowledgeGapType.MISSING_PRACTICAL_EVIDENCE,
                        IsMandatory = comp.IsMandatory,
                        Impact = DiagnosticImpact.MEDIUM,
                        Priority = DiagnosticPriority.MEDIUM,
                        Confidence = EvaluationConfidence.MEDIUM,
                        Description = $"Ứng viên nắm vững lý thuyết chuyên môn về '{comp.CompetencyName}' nhưng chưa có dữ liệu kiểm chứng trên môi trường thực tế."
                    });
                }
                else if (comp.CoverageStatus == ConceptCoverageStatus.PARTIAL)
                {
                    bool hasPractical = comp.EvidenceItems?.Any(e => e.ShowsPracticalExperience) == true;
                    diagnosis.KnowledgeGaps.Add(new KnowledgeGapDiagnosis
                    {
                        Title = hasPractical ? $"Chưa đủ độ sâu: {comp.CompetencyName}" : $"Thiếu minh chứng thực chiến: {comp.CompetencyName}",
                        RelatedCompetency = comp.CompetencyName,
                        GapType = hasPractical ? KnowledgeGapType.INSUFFICIENT_DEPTH : KnowledgeGapType.MISSING_PRACTICAL_EVIDENCE,
                        IsMandatory = comp.IsMandatory,
                        Impact = comp.IsMandatory ? DiagnosticImpact.HIGH : DiagnosticImpact.MEDIUM,
                        Priority = DiagnosticPriority.MEDIUM,
                        Confidence = comp.Confidence,
                        Description = hasPractical
                            ? $"Ứng viên đã trả lời ở mức cơ bản nhưng còn thiếu độ sâu khi phân tích trade-off hoặc bài toán mở rộng."
                            : $"Chưa có minh chứng giải quyết bài toán thực tế cho '{comp.CompetencyName}'."
                    });
                }
            }
        }

        private static void DiagnoseRisks(DiagnosticAnalysis diagnosis, List<EvaluationRisk> risks)
        {
            foreach (var r in risks)
            {
                if (r.Type == EvaluationRiskType.UNVERIFIED_HIGH_CLAIM)
                {
                    diagnosis.Risks.Add(new RiskDiagnosis
                    {
                        Type = EvaluationRiskType.UNVERIFIED_HIGH_CLAIM,
                        Severity = r.Severity,
                        RelatedCompetency = r.RelatedConcept,
                        Impact = DiagnosticImpact.MEDIUM,
                        Confidence = EvaluationConfidence.MEDIUM,
                        RequiresVerification = true,
                        Evidence = r.Evidence,
                        Description = "Tuyên bố kinh nghiệm hoặc quy mô hệ thống chưa được kiểm chứng đầy đủ qua các câu hỏi kỹ thuật chuyên sâu (Cần bổ sung bằng chứng để xác minh)."
                    });
                }
                else if (r.Type == EvaluationRiskType.CONTRADICTION)
                {
                    diagnosis.Risks.Add(new RiskDiagnosis
                    {
                        Type = EvaluationRiskType.CONTRADICTION,
                        Severity = r.Severity,
                        RelatedCompetency = r.RelatedConcept,
                        Impact = DiagnosticImpact.HIGH,
                        Confidence = EvaluationConfidence.HIGH,
                        RequiresVerification = true,
                        Evidence = r.Evidence,
                        Description = $"Phát hiện phát biểu mâu thuẫn giữa các lượt trao đổi: {r.Description}"
                    });
                }
                else
                {
                    diagnosis.Risks.Add(new RiskDiagnosis
                    {
                        Type = r.Type,
                        Severity = r.Severity,
                        RelatedCompetency = r.RelatedConcept,
                        Impact = DiagnosticImpact.MEDIUM,
                        Confidence = EvaluationConfidence.MEDIUM,
                        RequiresVerification = false,
                        Evidence = r.Evidence,
                        Description = r.Description
                    });
                }
            }
        }

        private static void DiagnoseCrossDimensionPatterns(
            DiagnosticAnalysis diagnosis,
            InterviewPerformanceAssessment? perf)
        {
            if (perf == null) return;

            var tech = perf.FindDimension(PerformanceDimensionType.TECHNICAL_KNOWLEDGE);
            var practical = perf.FindDimension(PerformanceDimensionType.PRACTICAL_APPLICATION);
            var reasoning = perf.FindDimension(PerformanceDimensionType.REASONING_DEPTH);
            var comm = perf.FindDimension(PerformanceDimensionType.COMMUNICATION);

            // Pattern 1: Strong Technical Knowledge + Strong Practical + Limited/Weak Reasoning Depth
            if (tech?.Level == "STRONG" && practical?.Level == "STRONG" &&
                (reasoning?.Level == "WEAK" || reasoning?.Level == "LIMITED"))
            {
                diagnosis.CrossDimensionFindings.Add(new CrossDimensionFinding
                {
                    PatternTitle = "Thực thi thực tế vững vàng nhưng chiều sâu tư duy kiến trúc hạn chế",
                    RelatedDimensions = new List<PerformanceDimensionType>
                    {
                        PerformanceDimensionType.TECHNICAL_KNOWLEDGE,
                        PerformanceDimensionType.PRACTICAL_APPLICATION,
                        PerformanceDimensionType.REASONING_DEPTH
                    },
                    Impact = DiagnosticImpact.HIGH,
                    Description = "Ứng viên có kiến thức triển khai thực tế vững chắc nhưng chiều sâu tư duy kiến trúc và phân tích trade-off còn hạn chế."
                });
            }

            // Pattern 2: Strong Technical Knowledge + Limited Communication
            if (tech?.Level == "STRONG" && (comm?.Level == "WEAK" || comm?.Level == "LIMITED"))
            {
                diagnosis.CrossDimensionFindings.Add(new CrossDimensionFinding
                {
                    PatternTitle = "Năng lực kỹ thuật tốt nhưng khó khăn trong truyền đạt",
                    RelatedDimensions = new List<PerformanceDimensionType>
                    {
                        PerformanceDimensionType.TECHNICAL_KNOWLEDGE,
                        PerformanceDimensionType.COMMUNICATION
                    },
                    Impact = DiagnosticImpact.MEDIUM,
                    Description = "Ứng viên nắm bản chất kỹ thuật nhưng gặp trở ngại khi cấu trúc câu trả lời mạch lạc."
                });
            }

            // Pattern 3: Strong Knowledge + Unassessed Practical Application
            if (tech?.Level == "STRONG" && practical?.Confidence == EvaluationConfidence.INSUFFICIENT_EVIDENCE)
            {
                diagnosis.CrossDimensionFindings.Add(new CrossDimensionFinding
                {
                    PatternTitle = "Lý thuyết vững vàng nhưng thiếu dữ liệu thực tế",
                    RelatedDimensions = new List<PerformanceDimensionType>
                    {
                        PerformanceDimensionType.TECHNICAL_KNOWLEDGE,
                        PerformanceDimensionType.PRACTICAL_APPLICATION
                    },
                    Impact = DiagnosticImpact.MEDIUM,
                    Description = "Nắm vững lý thuyết chuyên môn tốt nhưng chưa có minh chứng vận dụng trên môi trường thực tế."
                });
            }
        }

        private static void SynthesizePriorities(DiagnosticAnalysis diagnosis)
        {
            var priorityItems = new List<string>();

            // 1. High priority weaknesses
            foreach (var w in diagnosis.Weaknesses.Where(w => w.Priority == DiagnosticPriority.HIGH))
            {
                priorityItems.Add($"[Ưu tiên cao - Điểm yếu] {w.Title}: Nguyên nhân ({w.RootCause})");
            }

            // 2. High severity risks
            foreach (var r in diagnosis.Risks.Where(r => r.Severity == "HIGH" || r.Impact == DiagnosticImpact.HIGH))
            {
                priorityItems.Add($"[Ưu tiên cao - Rủi ro] {r.Type}: {r.Description}");
            }

            // 3. High priority mandatory unassessed gaps
            foreach (var g in diagnosis.KnowledgeGaps.Where(g => g.Priority == DiagnosticPriority.HIGH))
            {
                priorityItems.Add($"[Ưu tiên cao - Lỗ hổng bắt buộc] {g.Title}");
            }

            // 4. Medium priority items
            foreach (var w in diagnosis.Weaknesses.Where(w => w.Priority == DiagnosticPriority.MEDIUM))
            {
                priorityItems.Add($"[Ưu tiên trung bình - Điểm yếu] {w.Title}");
            }

            diagnosis.Priorities = priorityItems;
        }

        private static void SynthesizeLimitations(
            DiagnosticAnalysis diagnosis,
            FinalInterviewEvaluation evaluation,
            List<AnswerItem> answers)
        {
            if (evaluation.CompletionStatus == InterviewCompletionStatus.MAX_QUESTIONS_REACHED)
            {
                diagnosis.Limitations.Add($"Chạm giới hạn {evaluation.MaximumQuestions} câu hỏi; chưa đủ thời lượng kiểm tra toàn diện tất cả các khía cạnh chuyên sâu.");
            }

            int unassessedCount = diagnosis.KnowledgeGaps.Count(g => g.GapType == KnowledgeGapType.UNASSESSED);
            if (unassessedCount > 0)
            {
                diagnosis.Limitations.Add($"Còn {unassessedCount} kỹ năng trong blueprint chưa được kiểm tra trực tiếp.");
            }

            if (answers.All(a => !a.ShowsPracticalExperience) && answers.Count > 0)
            {
                diagnosis.Limitations.Add("Chưa thu thập được dữ liệu bài toán thực tế trên môi trường sản xuất; các đánh giá chủ yếu dựa trên trao đổi lý thuyết.");
            }
        }
    }
}
