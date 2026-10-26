using System;
using System.Collections.Generic;
using System.Linq;
using backend.Models;

namespace backend.Services.Evaluation
{
    public class InterviewPerformanceService : IInterviewPerformanceService
    {
        public InterviewPerformanceAssessment AnalyzePerformance(Session session, FinalInterviewEvaluation evaluation)
        {
            if (session == null) throw new ArgumentNullException(nameof(session));
            if (evaluation == null) throw new ArgumentNullException(nameof(evaluation));

            var targetLevel = !string.IsNullOrWhiteSpace(evaluation.TargetLevel)
                ? evaluation.TargetLevel
                : (!string.IsNullOrWhiteSpace(session.InterviewContext?.ExperienceLevel)
                    ? session.InterviewContext.ExperienceLevel
                    : "Mid");

            var targetPosition = !string.IsNullOrWhiteSpace(evaluation.TargetPosition)
                ? evaluation.TargetPosition
                : (!string.IsNullOrWhiteSpace(session.JobTitle) ? session.JobTitle : ProfessionalDomainClassifier.DefaultPositionTitle);

            var assessment = new InterviewPerformanceAssessment
            {
                SessionId = session.Id,
                TargetPosition = targetPosition,
                TargetLevel = targetLevel,
                CreatedAt = DateTime.UtcNow
            };

            var answers = session.Answers ?? new List<AnswerItem>();
            var competencies = evaluation.Competencies ?? new List<CompetencyEvaluation>();
            var risks = evaluation.Risks ?? new List<EvaluationRisk>();

            // 1. DIMENSION: TECHNICAL_KNOWLEDGE
            assessment.Dimensions.Add(EvaluateTechnicalKnowledge(competencies, answers));

            // 2. DIMENSION: PRACTICAL_APPLICATION
            assessment.Dimensions.Add(EvaluatePracticalApplication(competencies, answers));

            // 3. DIMENSION: REASONING_DEPTH
            assessment.Dimensions.Add(EvaluateReasoningDepth(answers, targetLevel));

            // 4. DIMENSION: FOLLOW_UP_HANDLING
            assessment.Dimensions.Add(EvaluateFollowUpHandling(answers, session.InterviewState));

            // 5. DIMENSION: COMMUNICATION
            assessment.Dimensions.Add(EvaluateCommunication(answers));

            // 6. DIMENSION: CONSISTENCY
            assessment.Dimensions.Add(EvaluateConsistency(answers, risks));

            // 7. READINESS EVALUATION
            EvaluateReadiness(assessment, evaluation, competencies, risks, answers, targetLevel);

            // 8. SYNTHESIZE STRENGTHS, IMPROVEMENTS, LIMITATIONS
            SynthesizePerformanceInsights(assessment);

            return assessment;
        }

        private static PerformanceDimensionAssessment EvaluateTechnicalKnowledge(
            List<CompetencyEvaluation> competencies,
            List<AnswerItem> answers)
        {
            var assessed = competencies.Where(c => c.Confidence != EvaluationConfidence.INSUFFICIENT_EVIDENCE).ToList();
            if (assessed.Count == 0)
            {
                return new PerformanceDimensionAssessment
                {
                    Dimension = PerformanceDimensionType.TECHNICAL_KNOWLEDGE,
                    Name = "Kiến thức chuyên môn (Technical Knowledge)",
                    Level = "Unassessed",
                    Score = 0.0,
                    Confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE,
                    EvidenceCount = 0,
                    Summary = "Chưa có đủ dữ liệu phỏng vấn để đánh giá kiến thức chuyên môn."
                };
            }

            double totalWeight = assessed.Sum(c => c.WeightPercentage);
            double score = totalWeight > 0
                ? (assessed.Sum(c => c.Score * c.WeightPercentage) / totalWeight)
                : assessed.Average(c => c.Score);
            score = Math.Round(score, 1);

            string level;
            if (score >= 8.0) level = "STRONG";
            else if (score >= 6.5) level = "MODERATE";
            else if (score >= 4.5) level = "LIMITED";
            else level = "WEAK";

            var confidence = assessed.All(c => c.Confidence == EvaluationConfidence.HIGH)
                ? EvaluationConfidence.HIGH
                : EvaluationConfidence.MEDIUM;

            var turns = assessed.SelectMany(c => c.EvidenceItems ?? new List<EvidenceItem>())
                .Where(e => e.TurnIndex > 0)
                .Select(e => e.TurnIndex)
                .Distinct()
                .OrderBy(t => t)
                .ToList();

            var supporting = assessed
                .OrderByDescending(c => c.Score)
                .Take(3)
                .Select(c => $"{c.CompetencyName}: {c.Score}/10 ({c.DemonstratedLevel})")
                .ToList();

            return new PerformanceDimensionAssessment
            {
                Dimension = PerformanceDimensionType.TECHNICAL_KNOWLEDGE,
                Name = "Kiến thức chuyên môn (Technical Knowledge)",
                Level = level,
                Score = score,
                Confidence = confidence,
                EvidenceCount = assessed.Sum(c => c.EvidenceItems?.Count ?? 0),
                TurnReferences = turns,
                SupportingEvidence = supporting,
                Summary = $"Nắm vững {assessed.Count(c => c.Score >= 7.5)}/{assessed.Count} kỹ năng được kiểm tra với mức độ biểu hiện trung bình {level}."
            };
        }

        private static PerformanceDimensionAssessment EvaluatePracticalApplication(
            List<CompetencyEvaluation> competencies,
            List<AnswerItem> answers)
        {
            var practicalTurns = new List<int>();
            for (int i = 0; i < answers.Count; i++)
            {
                if (answers[i].ShowsPracticalExperience)
                {
                    practicalTurns.Add(i + 1);
                }
            }

            var compPracticalEvidence = competencies
                .SelectMany(c => c.EvidenceItems ?? new List<EvidenceItem>())
                .Where(e => e.ShowsPracticalExperience)
                .ToList();

            int practicalCount = Math.Max(practicalTurns.Count, compPracticalEvidence.Count);

            if (practicalCount == 0)
            {
                // Invariant: Theoretical knowledge != Practical experience.
                // If candidate was not asked practical questions or no practical evidence exists -> INSUFFICIENT_EVIDENCE
                return new PerformanceDimensionAssessment
                {
                    Dimension = PerformanceDimensionType.PRACTICAL_APPLICATION,
                    Name = "Vận dụng thực tế (Practical Application)",
                    Level = "Unassessed",
                    Score = 0.0,
                    Confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE,
                    EvidenceCount = 0,
                    Summary = "Chưa ghi nhận minh chứng thực tế trên môi trường sản xuất hoặc bài toán dự án thực chiến."
                };
            }

            var maxDepth = answers.Where(a => a.ShowsPracticalExperience).Select(a => a.Depth).DefaultIfEmpty(1).Max();
            string level;
            double score;
            EvaluationConfidence confidence;

            if (practicalCount >= 2 || maxDepth >= 2)
            {
                level = "STRONG";
                score = 8.5;
                confidence = EvaluationConfidence.HIGH;
            }
            else
            {
                level = "MODERATE";
                score = 7.0;
                confidence = EvaluationConfidence.MEDIUM;
            }

            return new PerformanceDimensionAssessment
            {
                Dimension = PerformanceDimensionType.PRACTICAL_APPLICATION,
                Name = "Vận dụng thực tế (Practical Application)",
                Level = level,
                Score = score,
                Confidence = confidence,
                EvidenceCount = practicalCount,
                TurnReferences = practicalTurns,
                SupportingEvidence = new List<string> { $"Minh chứng kinh nghiệm thực chiến xuất hiện ở {practicalCount} lượt câu hỏi." },
                Summary = $"Thể hiện trải nghiệm triển khai thực chiến với độ sâu cao nhất là {maxDepth}/3."
            };
        }

        private static PerformanceDimensionAssessment EvaluateReasoningDepth(
            List<AnswerItem> answers,
            string targetLevel)
        {
            if (answers.Count == 0)
            {
                return new PerformanceDimensionAssessment
                {
                    Dimension = PerformanceDimensionType.REASONING_DEPTH,
                    Name = "Độ sâu tư duy & Phân tích (Reasoning Depth)",
                    Level = "Unassessed",
                    Score = 0.0,
                    Confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE,
                    EvidenceCount = 0,
                    Summary = "Chưa có lượt trả lời nào để đo lường độ sâu tư duy."
                };
            }

            double avgDepth = answers.Average(a => a.Depth);
            bool isSenior = targetLevel.Contains("senior", StringComparison.OrdinalIgnoreCase);
            bool isJunior = targetLevel.Contains("junior", StringComparison.OrdinalIgnoreCase);

            string level;
            double score;
            EvaluationConfidence confidence = EvaluationConfidence.HIGH;
            string summary;

            if (isSenior)
            {
                // Senior calibration: Surface answers are penalized even if basic concepts are correct
                if (avgDepth <= 1.5)
                {
                    level = avgDepth <= 1.0 ? "WEAK" : "LIMITED";
                    score = Math.Min(4.5, Math.Round(avgDepth * 3.0, 1));
                    summary = "Ứng viên ứng tuyển cấp độ Senior nhưng độ sâu phân tích chỉ dừng ở mức bề mặt (Depth <= 1), thiếu sự đối chiếu trade-off và cơ chế kiến trúc chuyên sâu.";
                }
                else if (avgDepth >= 2.5)
                {
                    level = "STRONG";
                    score = 9.0;
                    summary = "Độ sâu tư duy xuất sắc, phân tích cơ chế nội tại và đánh giá đa chiều phù hợp chuẩn Senior.";
                }
                else
                {
                    level = "MODERATE";
                    score = 7.0;
                    confidence = EvaluationConfidence.MEDIUM;
                    summary = "Độ sâu tư duy đạt chuẩn cơ bản của Senior, tuy nhiên vẫn cần sắc bén hơn ở các bài toán ngoại biên.";
                }
            }
            else if (isJunior)
            {
                // Junior calibration: Not penalized for missing senior-level architectural depth
                if (avgDepth >= 1.0)
                {
                    level = avgDepth >= 2.0 ? "STRONG" : "MODERATE";
                    score = avgDepth >= 2.0 ? 8.5 : 7.5;
                    summary = "Độ sâu tư duy hoàn toàn đáp ứng kỳ vọng đối với cấp độ Junior, giải thích nguyên lý rõ ràng.";
                }
                else
                {
                    level = "LIMITED";
                    score = 5.0;
                    confidence = EvaluationConfidence.MEDIUM;
                    summary = "Câu trả lời còn ngắn và chưa làm nổi bật được cách hiểu về bản chất của công nghệ.";
                }
            }
            else
            {
                // Mid level
                if (avgDepth >= 2.2)
                {
                    level = "STRONG";
                    score = 8.5;
                    summary = "Độ sâu tư duy vững vàng, có khả năng phân tích nguyên nhân và giải pháp rõ ràng.";
                }
                else if (avgDepth >= 1.5)
                {
                    level = "MODERATE";
                    score = 7.0;
                    confidence = EvaluationConfidence.MEDIUM;
                    summary = "Độ sâu tư duy đạt mức trung bình khá, giải quyết được yêu cầu chính của câu hỏi.";
                }
                else
                {
                    level = "LIMITED";
                    score = 5.0;
                    summary = "Câu trả lời có thiên hướng lý thuyết bề mặt, thiếu chiều sâu phân tích.";
                }
            }

            var turns = Enumerable.Range(1, answers.Count).ToList();

            return new PerformanceDimensionAssessment
            {
                Dimension = PerformanceDimensionType.REASONING_DEPTH,
                Name = "Độ sâu tư duy & Phân tích (Reasoning Depth)",
                Level = level,
                Score = score,
                Confidence = confidence,
                EvidenceCount = answers.Count,
                TurnReferences = turns,
                SupportingEvidence = new List<string> { $"Độ sâu trung bình đo lường: {Math.Round(avgDepth, 1)}/3 (Cấp độ mục tiêu: {targetLevel})" },
                Summary = summary
            };
        }

        private static PerformanceDimensionAssessment EvaluateFollowUpHandling(
            List<AnswerItem> answers,
            InterviewState? state)
        {
            if (answers.Count <= 1)
            {
                return new PerformanceDimensionAssessment
                {
                    Dimension = PerformanceDimensionType.FOLLOW_UP_HANDLING,
                    Name = "Xử lý câu hỏi mở rộng & Thử thách (Follow-up Handling)",
                    Level = "Unassessed",
                    Score = 0.0,
                    Confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE,
                    EvidenceCount = 0,
                    Summary = "Chưa có đủ lượt câu hỏi follow-up/thử thách để đánh giá khả năng phản xạ và đào sâu."
                };
            }

            // Detect follow-up answers (answers past turn 1)
            var followUpAnswers = answers.Skip(1).ToList();
            int successfulFollowUps = 0;
            int failedFollowUps = 0;
            var followUpTurns = new List<int>();

            for (int i = 1; i < answers.Count; i++)
            {
                var a = answers[i];
                followUpTurns.Add(i + 1);

                if (a.IncorrectConcepts.Count > 0 || a.HasInconsistency)
                {
                    failedFollowUps++;
                }
                else if (a.Depth >= 2 || a.ShowsPracticalExperience || a.VerifiedFacts.Count > 0)
                {
                    successfulFollowUps++;
                }
                else if (a.Depth < answers[i - 1].Depth && a.Depth <= 1)
                {
                    failedFollowUps++;
                }
                else
                {
                    successfulFollowUps++;
                }
            }

            string level;
            double score;
            EvaluationConfidence confidence = EvaluationConfidence.HIGH;
            string summary;

            if (failedFollowUps > 0 && successfulFollowUps == 0)
            {
                level = "WEAK";
                score = 3.5;
                summary = "Ứng viên trả lời được câu hỏi mở đầu nhưng nhanh chóng bộc lộ hạn chế khi gặp câu hỏi đào sâu hoặc bị phản biện.";
            }
            else if (failedFollowUps > successfulFollowUps)
            {
                level = "LIMITED";
                score = 5.0;
                confidence = EvaluationConfidence.MEDIUM;
                summary = "Khả năng ứng biến khi bị đào sâu chưa ổn định, có lượt gặp khó khăn khi làm rõ chi tiết.";
            }
            else if (successfulFollowUps >= 2 || (successfulFollowUps > 0 && failedFollowUps == 0))
            {
                level = "STRONG";
                score = 8.5;
                summary = "Ứng viên tiếp nhận câu hỏi mở rộng rất tốt, phản hồi tự tin, mở rộng luận điểm chính xác và bảo vệ lập luận chắc chắn.";
            }
            else
            {
                level = "MODERATE";
                score = 7.0;
                confidence = EvaluationConfidence.MEDIUM;
                summary = "Xử lý tương đối tốt các câu hỏi tiếp nối ở mức độ vừa phải.";
            }

            return new PerformanceDimensionAssessment
            {
                Dimension = PerformanceDimensionType.FOLLOW_UP_HANDLING,
                Name = "Xử lý câu hỏi mở rộng & Thử thách (Follow-up Handling)",
                Level = level,
                Score = score,
                Confidence = confidence,
                EvidenceCount = followUpAnswers.Count,
                TurnReferences = followUpTurns,
                SupportingEvidence = new List<string> { $"Xử lý thành công {successfulFollowUps}/{followUpAnswers.Count} lượt câu hỏi nối tiếp." },
                Summary = summary
            };
        }

        private static PerformanceDimensionAssessment EvaluateCommunication(List<AnswerItem> answers)
        {
            // Section 8 Invariant: Communication requires actual structured evidence.
            // Long answer != good communication. Short answer != poor communication.
            // If no structured communication evidence exists -> INSUFFICIENT_EVIDENCE.
            if (answers.Count == 0 || !answers.Any(a => a.VerifiedFacts.Count > 0 || a.CorrectConcepts.Count > 0 || !string.IsNullOrWhiteSpace(a.Answer)))
            {
                return new PerformanceDimensionAssessment
                {
                    Dimension = PerformanceDimensionType.COMMUNICATION,
                    Name = "Kỹ năng giao tiếp & Truyền đạt (Communication)",
                    Level = "Unassessed",
                    Score = 0.0,
                    Confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE,
                    EvidenceCount = 0,
                    Summary = "Chưa có đủ minh chứng có cấu trúc để đánh giá kỹ năng truyền đạt."
                };
            }

            // Check if answers have structured evidence (verified facts or concepts)
            var turnsWithContent = answers.Where(a => !string.IsNullOrWhiteSpace(a.Answer)).ToList();
            if (turnsWithContent.Count == 0)
            {
                return new PerformanceDimensionAssessment
                {
                    Dimension = PerformanceDimensionType.COMMUNICATION,
                    Name = "Kỹ năng giao tiếp & Truyền đạt (Communication)",
                    Level = "Unassessed",
                    Score = 0.0,
                    Confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE,
                    EvidenceCount = 0,
                    Summary = "Chưa có nội dung câu trả lời để đánh giá truyền đạt."
                };
            }

            int verifiedFactsCount = answers.Sum(a => a.VerifiedFacts.Count);
            int inconsistencyCount = answers.Count(a => a.HasInconsistency);

            // If session has no concepts/facts at all (e.g. legacy/unassessed)
            if (verifiedFactsCount == 0 && answers.All(a => a.CorrectConcepts.Count == 0))
            {
                return new PerformanceDimensionAssessment
                {
                    Dimension = PerformanceDimensionType.COMMUNICATION,
                    Name = "Kỹ năng giao tiếp & Truyền đạt (Communication)",
                    Level = "Unassessed",
                    Score = 0.0,
                    Confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE,
                    EvidenceCount = 0,
                    Summary = "Chưa đủ dữ liệu cấu trúc để khẳng định chất lượng truyền đạt."
                };
            }

            string level;
            double score;
            EvaluationConfidence confidence;
            string summary;

            if (inconsistencyCount > 0)
            {
                level = "LIMITED";
                score = 5.5;
                confidence = EvaluationConfidence.MEDIUM;
                summary = "Cách truyền đạt còn mâu thuẫn giữa các phát biểu, gây khó khăn cho việc thống nhất thông điệp.";
            }
            else if (verifiedFactsCount >= 2 || answers.Count >= 2)
            {
                level = "STRONG";
                score = 8.5;
                confidence = EvaluationConfidence.HIGH;
                summary = "Trình bày rõ ràng, đi thẳng vào trọng tâm câu hỏi, diễn đạt mạch lạc và có bằng chứng xác đáng.";
            }
            else
            {
                level = "MODERATE";
                score = 7.0;
                confidence = EvaluationConfidence.MEDIUM;
                summary = "Khả năng truyền đạt đáp ứng được yêu cầu cơ bản của buổi phỏng vấn.";
            }

            var turns = Enumerable.Range(1, answers.Count).ToList();

            return new PerformanceDimensionAssessment
            {
                Dimension = PerformanceDimensionType.COMMUNICATION,
                Name = "Kỹ năng giao tiếp & Truyền đạt (Communication)",
                Level = level,
                Score = score,
                Confidence = confidence,
                EvidenceCount = turnsWithContent.Count,
                TurnReferences = turns,
                SupportingEvidence = new List<string> { $"Minh chứng truyền đạt qua {turnsWithContent.Count} lượt trao đổi với {verifiedFactsCount} dữ kiện xác thực." },
                Summary = summary
            };
        }

        private static PerformanceDimensionAssessment EvaluateConsistency(
            List<AnswerItem> answers,
            List<EvaluationRisk> risks)
        {
            // Reuses contradiction/inconsistency evidence from Step 1 / Step 2
            var contradictionRisks = risks.Where(r => r.Type == EvaluationRiskType.CONTRADICTION).ToList();
            int answerInconsistencies = answers.Count(a => a.HasInconsistency);

            if (answers.Count < 2 && contradictionRisks.Count == 0)
            {
                return new PerformanceDimensionAssessment
                {
                    Dimension = PerformanceDimensionType.CONSISTENCY,
                    Name = "Tính nhất quán & Độ tin cậy (Consistency)",
                    Level = "Unassessed",
                    Score = 0.0,
                    Confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE,
                    EvidenceCount = 0,
                    Summary = "Số lượt trao đổi chưa đủ để kiểm chứng tính nhất quán xuyên suốt."
                };
            }

            if (contradictionRisks.Count > 0 || answerInconsistencies > 0)
            {
                var evidenceList = contradictionRisks.Select(r => r.Description).Distinct().ToList();
                if (evidenceList.Count == 0) evidenceList.Add("Phát hiện mâu thuẫn câu trả lời giữa các lượt.");

                return new PerformanceDimensionAssessment
                {
                    Dimension = PerformanceDimensionType.CONSISTENCY,
                    Name = "Tính nhất quán & Độ tin cậy (Consistency)",
                    Level = "WEAK",
                    Score = 3.5,
                    Confidence = EvaluationConfidence.HIGH,
                    EvidenceCount = contradictionRisks.Count + answerInconsistencies,
                    SupportingEvidence = evidenceList,
                    Summary = $"Phát hiện {contradictionRisks.Count + answerInconsistencies} dấu hiệu mâu thuẫn trong phát biểu của ứng viên."
                };
            }

            return new PerformanceDimensionAssessment
            {
                Dimension = PerformanceDimensionType.CONSISTENCY,
                Name = "Tính nhất quán & Độ tin cậy (Consistency)",
                Level = "STRONG",
                Score = 9.0,
                Confidence = EvaluationConfidence.HIGH,
                EvidenceCount = answers.Count,
                SupportingEvidence = new List<string> { "Không phát hiện mâu thuẫn giữa các câu trả lời." },
                Summary = "Thông tin và quan điểm nhất quán xuyên suốt toàn bộ các lượt trao đổi."
            };
        }

        private static void EvaluateReadiness(
            InterviewPerformanceAssessment assessment,
            FinalInterviewEvaluation evaluation,
            List<CompetencyEvaluation> competencies,
            List<EvaluationRisk> risks,
            List<AnswerItem> answers,
            string targetLevel)
        {
            // 1. Check for insufficient turns
            if (evaluation.CompletionStatus == InterviewCompletionStatus.INSUFFICIENT_TURNS || answers.Count == 0)
            {
                assessment.Readiness = InterviewReadinessStatus.NEEDS_MORE_EVIDENCE;
                assessment.ReadinessRationale = "Chưa có đủ lượt hỏi đáp tối thiểu để đưa ra kết luận mức độ sẵn sàng tuyển dụng.";
                return;
            }

            // 2. Mandatory competencies unassessed check (Inferred skills are NOT mandatory!)
            var mandatoryCompetencies = competencies.Where(c => c.IsMandatory).ToList();
            int unassessedMandatory = mandatoryCompetencies.Count(c => c.Confidence == EvaluationConfidence.INSUFFICIENT_EVIDENCE);

            if (unassessedMandatory > 1 || evaluation.OverallConfidence == EvaluationConfidence.INSUFFICIENT_EVIDENCE)
            {
                assessment.Readiness = InterviewReadinessStatus.NEEDS_MORE_EVIDENCE;
                assessment.ReadinessRationale = $"Còn {unassessedMandatory} năng lực bắt buộc chưa được kiểm chứng đầy đủ trong buổi phỏng vấn.";
                return;
            }

            // 3. Contradiction / Fatal Risks check
            bool hasSevereContradiction = risks.Any(r => r.Type == EvaluationRiskType.CONTRADICTION &&
                                                         (r.Severity == "HIGH" || r.Severity == "CRITICAL"));
            int failedMandatory = mandatoryCompetencies.Count(c => c.CoverageStatus == ConceptCoverageStatus.WEAK);

            if (hasSevereContradiction || failedMandatory >= 2 || evaluation.OverallScore < 5.0)
            {
                assessment.Readiness = InterviewReadinessStatus.NOT_READY;
                assessment.ReadinessRationale = hasSevereContradiction
                    ? "Phát hiện mâu thuẫn nghiêm trọng giữa các phát biểu kỹ thuật trong buổi phỏng vấn."
                    : "Ứng viên chưa đạt chuẩn yêu cầu năng lực cốt lõi cho vị trí ứng tuyển.";
                return;
            }

            // 4. Senior calibration check
            bool isSenior = targetLevel.Contains("senior", StringComparison.OrdinalIgnoreCase);
            var depthDim = assessment.FindDimension(PerformanceDimensionType.REASONING_DEPTH);
            var techDim = assessment.FindDimension(PerformanceDimensionType.TECHNICAL_KNOWLEDGE);

            if (isSenior && depthDim != null && (depthDim.Level == "WEAK" || depthDim.Level == "LIMITED"))
            {
                // Senior candidate with shallow answers
                assessment.Readiness = InterviewReadinessStatus.READY_WITH_GAPS;
                assessment.ReadinessRationale = "Ứng viên có kiến thức cơ bản nhưng độ sâu tư duy và phân tích trade-off chưa đạt kỳ vọng cấp độ Senior.";
                return;
            }

            // 5. Positive Ready status
            if (evaluation.OverallScore >= 7.5 && (techDim?.Level == "STRONG" || techDim?.Level == "MODERATE"))
            {
                assessment.Readiness = InterviewReadinessStatus.READY;
                assessment.ReadinessRationale = "Ứng viên thể hiện năng lực vững vàng, phản xạ tốt và sẵn sàng đảm nhiệm vị trí mục tiêu.";
                return;
            }

            // 6. Ready with gaps fallback
            if (evaluation.OverallScore >= 5.5)
            {
                assessment.Readiness = InterviewReadinessStatus.READY_WITH_GAPS;
                assessment.ReadinessRationale = "Ứng viên đáp ứng yêu cầu nền tảng, tuy nhiên cần bổ sung thêm minh chứng thực tế hoặc cải thiện một số mảng còn hạn chế.";
                return;
            }

            assessment.Readiness = InterviewReadinessStatus.NEEDS_MORE_EVIDENCE;
            assessment.ReadinessRationale = "Cần thêm dữ liệu phỏng vấn chuyên sâu để xác định rõ mức độ sẵn sàng.";
        }

        private static void SynthesizePerformanceInsights(InterviewPerformanceAssessment assessment)
        {
            foreach (var dim in assessment.Dimensions)
            {
                if (dim.Level == "STRONG")
                {
                    assessment.Strengths.Add($"{dim.Name}: {dim.Summary}");
                }
                else if (dim.Level == "WEAK" || dim.Level == "LIMITED")
                {
                    assessment.AreasForImprovement.Add($"{dim.Name}: {dim.Summary}");
                }
                else if (dim.Confidence == EvaluationConfidence.INSUFFICIENT_EVIDENCE)
                {
                    assessment.Limitations.Add($"{dim.Name}: {dim.Summary}");
                }
            }
        }
    }
}
