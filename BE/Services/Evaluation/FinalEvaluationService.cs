using System;
using System.Collections.Generic;
using System.Linq;
using backend.Models;
using backend.Services.Preparation;

namespace backend.Services.Evaluation
{
    public class FinalEvaluationService : IFinalEvaluationService
    {
        private readonly IInterviewPerformanceService _performanceService;
        private readonly IDiagnosticAnalysisService _diagnosticService;
        private readonly IImprovementRoadmapService _roadmapService;
        private readonly IInterviewPreparationService _preparationService;

        public FinalEvaluationService(
            IInterviewPerformanceService? performanceService = null,
            IDiagnosticAnalysisService? diagnosticService = null,
            IImprovementRoadmapService? roadmapService = null,
            IInterviewPreparationService? preparationService = null)
        {
            _performanceService = performanceService ?? new InterviewPerformanceService();
            _diagnosticService = diagnosticService ?? new DiagnosticAnalysisService();
            _roadmapService = roadmapService ?? new ImprovementRoadmapService();
            _preparationService = preparationService ?? new InterviewPreparationService();
        }

        public FinalInterviewEvaluation EvaluateSession(Session session)
        {
            if (session == null)
            {
                throw new ArgumentNullException(nameof(session));
            }

            var context = session.InterviewContext;
            var state = session.InterviewState ?? new InterviewState();
            var answers = session.Answers ?? new List<AnswerItem>();
            var blueprint = context?.KnowledgeBlueprint;
            var strategy = context?.Strategy ?? state.Strategy;
            var coverage = state.KnowledgeCoverage ?? new Dictionary<string, ConceptCoverageStatus>();
            var explicitLevel = !string.IsNullOrWhiteSpace(context?.ExperienceLevel)
                ? context.ExperienceLevel.Trim()
                : (!string.IsNullOrWhiteSpace(state.CandidateLevel) ? state.CandidateLevel.Trim() : string.Empty);

            var targetLevel = explicitLevel;
            if (string.IsNullOrWhiteSpace(targetLevel))
            {
                var title = (!string.IsNullOrWhiteSpace(context?.TargetPosition) ? context.TargetPosition : session.JobTitle)?.ToLowerInvariant() ?? string.Empty;
                if (title.Contains("senior") || title.Contains("lead") || title.Contains("trưởng") || title.Contains("principal"))
                {
                    targetLevel = "Senior";
                }
                else if (title.Contains("junior") || title.Contains("fresher") || title.Contains("intern") || title.Contains("thực tập"))
                {
                    targetLevel = "Junior";
                }
                else
                {
                    targetLevel = "Mid";
                }
            }
            var targetPosition = !string.IsNullOrWhiteSpace(context?.TargetPosition)
                ? context.TargetPosition
                : (!string.IsNullOrWhiteSpace(session.JobTitle) ? session.JobTitle : ProfessionalDomainClassifier.DefaultPositionTitle);
            var targetCompany = context?.TargetCompany ?? string.Empty;

            var evaluation = new FinalInterviewEvaluation
            {
                SessionId = session.Id,
                CandidateName = context?.FullName ?? "Ứng viên",
                TargetPosition = targetPosition,
                TargetLevel = targetLevel,
                TargetCompany = targetCompany,
                TotalQuestionsAsked = state.QuestionCount,
                MaximumQuestions = state.MaximumQuestions,
                CreatedAt = DateTime.UtcNow
            };

            // 1. Completion status determination
            if (answers.Count == 0)
            {
                evaluation.CompletionStatus = InterviewCompletionStatus.INSUFFICIENT_TURNS;
            }
            else if (state.QuestionCount >= state.MaximumQuestions)
            {
                evaluation.CompletionStatus = InterviewCompletionStatus.MAX_QUESTIONS_REACHED;
            }
            else
            {
                evaluation.CompletionStatus = InterviewCompletionStatus.COMPLETED_NORMAL;
            }

            // 2. Competency Evaluations
            var competencies = new List<CompetencyEvaluation>();

            if (blueprint?.Areas != null && blueprint.Areas.Count > 0)
            {
                var allConcepts = blueprint.Areas
                    .Where(a => a?.Concepts != null)
                    .SelectMany(a => a.Concepts.Select(c => new { Area = a, Concept = c }))
                    .ToList();

                var defaultWeight = allConcepts.Count > 0 ? (100.0 / allConcepts.Count) : 100.0;

                foreach (var item in allConcepts)
                {
                    var concept = item.Concept;
                    var area = item.Area;

                    var areaStrat = strategy?.Areas?.FirstOrDefault(a =>
                        string.Equals(a.AreaName, area.Name, StringComparison.OrdinalIgnoreCase));

                    var conceptStrat = strategy?.FindConceptStrategy(concept.Id)
                                       ?? strategy?.FindConceptStrategy(concept.Name);

                    double weight = defaultWeight;
                    if (conceptStrat?.WeightPercentage.HasValue == true)
                    {
                        weight = conceptStrat.WeightPercentage.Value;
                    }
                    else if (areaStrat != null && areaStrat.WeightPercentage > 0 && areaStrat.Concepts.Count > 0)
                    {
                        weight = areaStrat.WeightPercentage / areaStrat.Concepts.Count;
                    }

                    var priority = conceptStrat?.Priority ?? (concept.IsMandatory ? 1 : 2);
                    var isMandatory = concept.IsMandatory;

                    // Match coverage status safely
                    var status = ConceptCoverageStatus.NOT_TESTED;
                    if (coverage.TryGetValue(concept.Id, out var s1))
                    {
                        status = s1;
                    }
                    else if (coverage.TryGetValue(concept.Id.ToLowerInvariant(), out var s2))
                    {
                        status = s2;
                    }
                    else if (coverage.TryGetValue(concept.Name.ToLowerInvariant(), out var s3))
                    {
                        status = s3;
                    }

                    // Extract EvidenceItems from recorded answers
                    var evidenceItems = new List<EvidenceItem>();

                    for (int i = 0; i < answers.Count; i++)
                    {
                        var a = answers[i];
                        bool matchesTarget = string.Equals(a.TargetConceptId, concept.Id, StringComparison.OrdinalIgnoreCase) ||
                                             string.Equals(a.TargetConceptName, concept.Name, StringComparison.OrdinalIgnoreCase);

                        bool matchesConcept = a.CorrectConcepts.Any(c => MatchesName(c, concept)) ||
                                              a.IncorrectConcepts.Any(c => MatchesName(c, concept)) ||
                                              a.VerifiedFacts.Any(f => MatchesName(f, concept));

                        if (matchesTarget || matchesConcept)
                        {
                            if (a.IncorrectConcepts.Any(c => MatchesName(c, concept)))
                            {
                                evidenceItems.Add(new EvidenceItem
                                {
                                    ConceptId = concept.Id,
                                    ConceptName = concept.Name,
                                    TurnIndex = i + 1,
                                    Type = EvidenceType.OBSERVED,
                                    Confidence = EvaluationConfidence.HIGH,
                                    Depth = a.Depth,
                                    Description = $"Câu {i + 1}: Có dấu hiệu hiểu sai hoặc thiếu sót căn bản về {concept.Name}.",
                                    SourceReliability = concept.RequirementSource
                                });
                            }
                            else if (a.VerifiedFacts.Any(f => MatchesName(f, concept)) || a.ShowsPracticalExperience || a.Depth >= 2)
                            {
                                evidenceItems.Add(new EvidenceItem
                                {
                                    ConceptId = concept.Id,
                                    ConceptName = concept.Name,
                                    TurnIndex = i + 1,
                                    Type = EvidenceType.OBSERVED,
                                    Confidence = EvaluationConfidence.HIGH,
                                    Depth = a.Depth,
                                    ShowsPracticalExperience = a.ShowsPracticalExperience,
                                    Description = $"Câu {i + 1}: Thể hiện hiểu biết chính xác và kinh nghiệm thực chiến với độ sâu {a.Depth}.",
                                    SourceReliability = concept.RequirementSource
                                });
                            }
                            else
                            {
                                evidenceItems.Add(new EvidenceItem
                                {
                                    ConceptId = concept.Id,
                                    ConceptName = concept.Name,
                                    TurnIndex = i + 1,
                                    Type = EvidenceType.OBSERVED,
                                    Confidence = EvaluationConfidence.MEDIUM,
                                    Depth = a.Depth,
                                    Description = $"Câu {i + 1}: Trả lời ở mức độ cơ bản về {concept.Name}.",
                                    SourceReliability = concept.RequirementSource
                                });
                            }

                            if (a.HasInconsistency && matchesTarget)
                            {
                                evidenceItems.Add(new EvidenceItem
                                {
                                    ConceptId = concept.Id,
                                    ConceptName = concept.Name,
                                    TurnIndex = i + 1,
                                    Type = EvidenceType.CONTRADICTORY,
                                    Confidence = EvaluationConfidence.HIGH,
                                    Description = $"Phát hiện phát biểu mâu thuẫn: {a.InconsistencyDetail}",
                                    SourceReliability = RequirementSource.CANDIDATE_REPORTED
                                });
                            }
                        }
                    }

                    // If not tested in answers
                    if (evidenceItems.Count == 0 && status == ConceptCoverageStatus.NOT_TESTED)
                    {
                        evidenceItems.Add(new EvidenceItem
                        {
                            ConceptId = concept.Id,
                            ConceptName = concept.Name,
                            TurnIndex = 0,
                            Type = EvidenceType.MISSING,
                            Confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE,
                            Description = $"Chưa kiểm tra năng lực {concept.Name} trong buổi phỏng vấn.",
                            SourceReliability = concept.RequirementSource
                        });
                    }

                    // Score, Demonstrated Level, and Confidence calculation
                    double score;
                    string demonstratedLevel;
                    EvaluationConfidence confidence;
                    bool isMet;
                    string rationale;

                    switch (status)
                    {
                        case ConceptCoverageStatus.VERIFIED:
                            score = 9.5;
                            demonstratedLevel = "Senior";
                            confidence = EvaluationConfidence.HIGH;
                            isMet = true;
                            rationale = $"Ứng viên làm chủ khái niệm {concept.Name} xuất sắc, giải thích sâu sắc cơ chế và xử lý bài toán thực chiến phức tạp.";
                            break;

                        case ConceptCoverageStatus.STRONG:
                            score = 8.5;
                            demonstratedLevel = "Middle";
                            confidence = EvaluationConfidence.HIGH;
                            isMet = true;
                            rationale = $"Ứng viên nắm vững bản chất của {concept.Name}, có kinh nghiệm thực tế và trả lời tự tin.";
                            break;

                        case ConceptCoverageStatus.PARTIAL:
                            score = 6.5;
                            demonstratedLevel = "Junior";
                            confidence = EvaluationConfidence.MEDIUM;
                            isMet = targetLevel.Contains("junior", StringComparison.OrdinalIgnoreCase);
                            rationale = $"Ứng viên nắm được nguyên lý cơ bản của {concept.Name} nhưng còn thiếu độ sâu thực chiến và đánh giá trade-off.";
                            break;

                        case ConceptCoverageStatus.INTRODUCED:
                            score = 5.0;
                            demonstratedLevel = "Junior";
                            confidence = EvaluationConfidence.LOW;
                            isMet = false;
                            rationale = $"Ứng viên mới chỉ nhắc thoáng qua khái niệm {concept.Name} hoặc đưa ra tuyên bố chưa được kiểm chứng đầy đủ.";
                            break;

                        case ConceptCoverageStatus.WEAK:
                            score = 3.0;
                            demonstratedLevel = "Below Target";
                            confidence = EvaluationConfidence.HIGH; // High confidence that knowledge is weak/erroneous
                            isMet = false;
                            rationale = $"Ứng viên có dấu hiệu ngộ nhận hoặc trả lời sai kiến thức nền tảng về {concept.Name}.";
                            break;

                        case ConceptCoverageStatus.NOT_TESTED:
                        default:
                            score = 0.0;
                            demonstratedLevel = "Unassessed";
                            confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE;
                            isMet = false;
                            rationale = $"Khái niệm {concept.Name} chưa được kiểm tra trong buổi phỏng vấn (Chưa có dữ liệu đánh giá).";
                            break;
                    }

                    var compEval = new CompetencyEvaluation
                    {
                        CompetencyId = concept.Id,
                        CompetencyName = concept.Name,
                        AreaName = area.Name,
                        WeightPercentage = weight,
                        Priority = priority,
                        IsMandatory = isMandatory,
                        TargetLevel = targetLevel,
                        CoverageStatus = status,
                        DemonstratedLevel = demonstratedLevel,
                        Score = score,
                        Confidence = confidence,
                        IsMet = isMet,
                        EvidenceItems = evidenceItems,
                        Rationale = rationale
                    };

                    if (score >= 7.5)
                    {
                        compEval.Strengths.Add($"Làm chủ tốt {concept.Name}");
                    }
                    else if (status == ConceptCoverageStatus.WEAK)
                    {
                        compEval.Gaps.Add($"Cần củng cố lại kiến thức về {concept.Name}");
                    }
                    else if (status == ConceptCoverageStatus.NOT_TESTED && isMandatory)
                    {
                        compEval.Gaps.Add($"Thiếu bằng chứng đánh giá về kỹ năng bắt buộc {concept.Name}");
                    }

                    competencies.Add(compEval);
                }
            }
            else
            {
                // Fallback for sessions without KnowledgeBlueprint (Phase 1 legacy flow)
                bool hasAnswers = answers.Count > 0 || state.QuestionCount > 0;
                var genericComp = new CompetencyEvaluation
                {
                    CompetencyId = "general-tech",
                    CompetencyName = "General Technical Knowledge",
                    AreaName = "General",
                    WeightPercentage = 100.0,
                    Priority = 1,
                    IsMandatory = true,
                    TargetLevel = targetLevel,
                    CoverageStatus = !hasAnswers ? ConceptCoverageStatus.NOT_TESTED : (state.StrongAnswerCount > state.WeakAnswerCount ? ConceptCoverageStatus.STRONG : ConceptCoverageStatus.PARTIAL),
                    Score = !hasAnswers ? 0.0 : (state.StrongAnswerCount > state.WeakAnswerCount ? 7.5 : 5.5),
                    Confidence = !hasAnswers ? EvaluationConfidence.INSUFFICIENT_EVIDENCE : EvaluationConfidence.MEDIUM,
                    DemonstratedLevel = targetLevel,
                    IsMet = hasAnswers && (state.StrongAnswerCount >= state.WeakAnswerCount),
                    Rationale = !hasAnswers ? "Chưa có câu trả lời nào được ghi nhận." : "Đánh giá dựa trên tổng số câu trả lời kỹ thuật trong buổi phỏng vấn."
                };
                competencies.Add(genericComp);
            }

            // 2b. Evaluate Behavioral (STAR) competencies from answers if present
            var behavioralAnswers = answers.Where(a => a.BehavioralEvidence != null).ToList();
            if (behavioralAnswers.Count > 0)
            {
                var groupedByComp = behavioralAnswers
                    .GroupBy(a => a.BehavioralEvidence!.Competency, StringComparer.OrdinalIgnoreCase);

                foreach (var group in groupedByComp)
                {
                    var compName = string.IsNullOrWhiteSpace(group.Key) ? "General" : group.Key;
                    var bestEvidence = group.Select(a => a.BehavioralEvidence!)
                        .OrderByDescending(e => e.EvidenceStrength == "Strong" ? 3 : (e.EvidenceStrength == "Moderate" ? 2 : 1))
                        .First();

                    double bScore;
                    string demLevel;
                    var covStatus = ConceptCoverageStatus.NOT_TESTED;
                    var conf = EvaluationConfidence.INSUFFICIENT_EVIDENCE;
                    bool isMet;
                    string rationale;

                    if (bestEvidence.EvidenceStrength == "Strong")
                    {
                        bScore = (bestEvidence.Ownership == "High") ? 9.0 : 8.0;
                        demLevel = "Senior";
                        covStatus = ConceptCoverageStatus.STRONG;
                        conf = EvaluationConfidence.HIGH;
                        isMet = true;
                        rationale = $"Ứng viên thể hiện câu chuyện STAR hoàn chỉnh về năng lực {compName} với minh chứng rõ ràng và trách nhiệm cá nhân cao.";
                    }
                    else if (bestEvidence.EvidenceStrength == "Moderate")
                    {
                        bScore = 7.0;
                        demLevel = "Middle";
                        covStatus = ConceptCoverageStatus.PARTIAL;
                        conf = EvaluationConfidence.MEDIUM;
                        isMet = true;
                        rationale = $"Ứng viên mô tả được tình huống và hành động liên quan đến {compName}, nhưng cần bổ sung thêm kết quả định lượng hoặc bài học.";
                    }
                    else
                    {
                        bScore = 4.0;
                        demLevel = "Below Target";
                        covStatus = ConceptCoverageStatus.WEAK;
                        conf = EvaluationConfidence.HIGH;
                        isMet = false;
                        var missingStr = bestEvidence.MissingComponents?.Count > 0 ? string.Join(", ", bestEvidence.MissingComponents) : "thiếu chi tiết";
                        rationale = $"Câu trả lời về {compName} thiếu các thành phần STAR căn bản ({missingStr}).";
                    }

                    var bEvidenceItems = group.Select(a => new EvidenceItem
                    {
                        ConceptId = $"behavioral-{compName.ToLowerInvariant()}",
                        ConceptName = compName,
                        TurnIndex = answers.IndexOf(a) + 1,
                        Type = EvidenceType.OBSERVED,
                        Confidence = conf,
                        Description = $"STAR: S={a.BehavioralEvidence!.Situation}; T={a.BehavioralEvidence!.Task}; A={a.BehavioralEvidence!.Action}; R={a.BehavioralEvidence!.Result}"
                    }).ToList();

                    var compEval = new CompetencyEvaluation
                    {
                        CompetencyId = $"behavioral-{compName.ToLowerInvariant()}",
                        CompetencyName = $"Behavioral: {compName}",
                        AreaName = "Behavioral (STAR)",
                        WeightPercentage = 20.0,
                        Priority = 2,
                        IsMandatory = false,
                        TargetLevel = targetLevel,
                        CoverageStatus = covStatus,
                        DemonstratedLevel = demLevel,
                        Score = bScore,
                        Confidence = conf,
                        IsMet = isMet,
                        EvidenceItems = bEvidenceItems,
                        Rationale = rationale
                    };

                    if (bScore >= 8.0) compEval.Strengths.Add($"Minh chứng hành vi xuất sắc trong {compName}");
                    else if (bScore < 6.0 && covStatus == ConceptCoverageStatus.WEAK) compEval.Gaps.Add($"Kỹ năng phản xạ hành vi {compName} còn hạn chế");

                    competencies.Add(compEval);
                }
            }

            // 2c. Evaluate Situational (Dilemma) competencies from answers if present
            var situationalAnswers = answers.Where(a => a.SituationalEvidence != null).ToList();
            if (situationalAnswers.Count > 0)
            {
                var groupedByCat = situationalAnswers
                    .GroupBy(a => a.SituationalEvidence!.Category, StringComparer.OrdinalIgnoreCase);

                foreach (var group in groupedByCat)
                {
                    var catName = string.IsNullOrWhiteSpace(group.Key) ? "General" : group.Key;
                    var bestEvidence = group.Select(a => a.SituationalEvidence!)
                        .OrderByDescending(e => e.EvidenceStrength == "Strong" ? 3 : (e.EvidenceStrength == "Moderate" ? 2 : 1))
                        .First();

                    double sScore;
                    string demLevel;
                    var covStatus = ConceptCoverageStatus.NOT_TESTED;
                    var conf = EvaluationConfidence.INSUFFICIENT_EVIDENCE;
                    bool isMet;
                    string rationale;

                    if (bestEvidence.EvidenceStrength == "Strong")
                    {
                        sScore = 9.0;
                        demLevel = "Senior";
                        covStatus = ConceptCoverageStatus.STRONG;
                        conf = EvaluationConfidence.HIGH;
                        isMet = true;
                        rationale = $"Ứng viên phân tích tình huống {catName} sắc bén, có nhận thức sâu sắc về đánh đổi (trade-offs) và kế hoạch hành động khả thi.";
                    }
                    else if (bestEvidence.EvidenceStrength == "Moderate")
                    {
                        sScore = 7.0;
                        demLevel = "Middle";
                        covStatus = ConceptCoverageStatus.PARTIAL;
                        conf = EvaluationConfidence.MEDIUM;
                        isMet = true;
                        rationale = $"Ứng viên đưa ra quyết định hợp lý cho tình huống {catName}, tuy nhiên nhận thức rủi ro hoặc kế hoạch giao tiếp cần làm rõ hơn.";
                    }
                    else
                    {
                        sScore = 4.0;
                        demLevel = "Below Target";
                        covStatus = ConceptCoverageStatus.WEAK;
                        conf = EvaluationConfidence.HIGH;
                        isMet = false;
                        var missingStr = bestEvidence.MissingEvidence?.Count > 0 ? string.Join(", ", bestEvidence.MissingEvidence) : "thiếu chi tiết";
                        rationale = $"Ứng viên chưa thể hiện được khả năng phân tích đa chiều cho tình huống {catName} (thiếu {missingStr}).";
                    }

                    var sEvidenceItems = group.Select(a => new EvidenceItem
                    {
                        ConceptId = $"situational-{catName.ToLowerInvariant()}",
                        ConceptName = catName,
                        TurnIndex = answers.IndexOf(a) + 1,
                        Type = EvidenceType.OBSERVED,
                        Confidence = conf,
                        Description = $"Dilemma Analysis: Quyết định={a.SituationalEvidence!.DecisionMaking}; Rủi ro={a.SituationalEvidence!.RiskAwareness}; Đánh đổi={a.SituationalEvidence!.TradeoffAwareness}"
                    }).ToList();

                    var compEval = new CompetencyEvaluation
                    {
                        CompetencyId = $"situational-{catName.ToLowerInvariant()}",
                        CompetencyName = $"Situational: {catName}",
                        AreaName = "Situational (Dilemma)",
                        WeightPercentage = 20.0,
                        Priority = 2,
                        IsMandatory = false,
                        TargetLevel = targetLevel,
                        CoverageStatus = covStatus,
                        DemonstratedLevel = demLevel,
                        Score = sScore,
                        Confidence = conf,
                        IsMet = isMet,
                        EvidenceItems = sEvidenceItems,
                        Rationale = rationale
                    };

                    if (sScore >= 8.0) compEval.Strengths.Add($"Tư duy xử lý tình huống {catName} rất tốt");
                    else if (sScore < 6.0 && covStatus == ConceptCoverageStatus.WEAK) compEval.Gaps.Add($"Khả năng ứng biến tình huống {catName} còn hạn chế");

                    competencies.Add(compEval);
                }
            }

            // 2d. Evaluate Candidate Questions from answers if present
            var candidateQAnswers = answers.Where(a => a.CandidateQuestionEvidence != null).ToList();
            if (candidateQAnswers.Count > 0)
            {
                var bestEvidence = candidateQAnswers
                    .Select(a => a.CandidateQuestionEvidence!)
                    .OrderByDescending(e => e.EvidenceStrength == "Strong" ? 3 : (e.EvidenceStrength == "Moderate" ? 2 : 1))
                    .First();

                double cqScore;
                string demLevel;
                var covStatus = ConceptCoverageStatus.NOT_TESTED;
                var conf = EvaluationConfidence.INSUFFICIENT_EVIDENCE;
                bool isMet;
                string rationale;

                if (bestEvidence.IsRefusalOrNoQuestions)
                {
                    cqScore = 5.0;
                    demLevel = "Middle";
                    covStatus = ConceptCoverageStatus.INTRODUCED;
                    conf = EvaluationConfidence.LOW;
                    isMet = false;
                    rationale = "Ứng viên không đặt thêm câu hỏi cho phía nhà tuyển dụng.";
                }
                else if (bestEvidence.EvidenceStrength == "Strong")
                {
                    cqScore = 9.0;
                    demLevel = "Senior";
                    covStatus = ConceptCoverageStatus.STRONG;
                    conf = EvaluationConfidence.HIGH;
                    isMet = true;
                    rationale = $"Ứng viên đặt câu hỏi sắc bén về {bestEvidence.Category}, thể hiện tầm nhìn và sự chủ động tìm hiểu vai trò.";
                }
                else if (bestEvidence.EvidenceStrength == "Moderate")
                {
                    cqScore = 7.0;
                    demLevel = "Middle";
                    covStatus = ConceptCoverageStatus.PARTIAL;
                    conf = EvaluationConfidence.MEDIUM;
                    isMet = true;
                    rationale = $"Ứng viên có câu hỏi tìm hiểu thông tin về {bestEvidence.Category} phù hợp với vị trí ứng tuyển.";
                }
                else
                {
                    cqScore = 4.0;
                    demLevel = "Below Target";
                    covStatus = ConceptCoverageStatus.WEAK;
                    conf = EvaluationConfidence.HIGH;
                    isMet = false;
                    rationale = "Câu hỏi của ứng viên còn chung chung hoặc chưa thể hiện rõ sự chuẩn bị về vị trí.";
                }

                var cqEvidenceItems = candidateQAnswers.Select(a => new EvidenceItem
                {
                    ConceptId = "candidate-question",
                    ConceptName = "Candidate Question & Curiosity",
                    TurnIndex = answers.IndexOf(a) + 1,
                    Type = EvidenceType.OBSERVED,
                    Confidence = conf,
                    Description = $"Hỏi: {a.CandidateQuestionEvidence!.QuestionText} (Category: {a.CandidateQuestionEvidence!.Category})"
                }).ToList();

                var compEval = new CompetencyEvaluation
                {
                    CompetencyId = "candidate-question",
                    CompetencyName = "Candidate Question & Curiosity",
                    AreaName = "Candidate Questions",
                    WeightPercentage = 10.0,
                    Priority = 3,
                    IsMandatory = false,
                    TargetLevel = targetLevel,
                    CoverageStatus = covStatus,
                    DemonstratedLevel = demLevel,
                    Score = cqScore,
                    Confidence = conf,
                    IsMet = isMet,
                    EvidenceItems = cqEvidenceItems,
                    Rationale = rationale
                };

                if (cqScore >= 8.0) compEval.Strengths.Add("Tư duy phản biện và sự chủ động tìm hiểu vai trò rất tốt");
                competencies.Add(compEval);
            }

            evaluation.Competencies = competencies;

            // 3. Domain Scores & Overall Score Calculation (Deterministic Weighted Aggregation)
            var techComps = competencies.Where(c => c.AreaName != "Behavioral (STAR)" && c.AreaName != "Situational (Dilemma)" && c.AreaName != "Candidate Questions").ToList();
            var assessedTech = techComps.Where(c => c.Confidence != EvaluationConfidence.INSUFFICIENT_EVIDENCE).ToList();

            var bComps = competencies.Where(c => c.AreaName == "Behavioral (STAR)").ToList();
            var assessedB = bComps.Where(c => c.Confidence != EvaluationConfidence.INSUFFICIENT_EVIDENCE).ToList();

            var sComps = competencies.Where(c => c.AreaName == "Situational (Dilemma)").ToList();
            var assessedS = sComps.Where(c => c.Confidence != EvaluationConfidence.INSUFFICIENT_EVIDENCE).ToList();

            var cqComps = competencies.Where(c => c.AreaName == "Candidate Questions").ToList();
            var assessedCq = cqComps.Where(c => c.Confidence != EvaluationConfidence.INSUFFICIENT_EVIDENCE).ToList();

            // Technical score
            double techScore = 0.0;
            if (assessedTech.Count > 0)
            {
                double totalWeight = assessedTech.Sum(c => c.WeightPercentage);
                techScore = totalWeight > 0 ? (assessedTech.Sum(c => c.Score * c.WeightPercentage) / totalWeight) : assessedTech.Average(c => c.Score);
            }
            else if (techComps.Count > 0 && techComps[0].CompetencyId == "general-tech")
            {
                techScore = techComps[0].Score;
            }
            evaluation.TechnicalScore = Math.Round(techScore, 1);

            // Behavioral score
            double finalBScore = assessedB.Count > 0 ? assessedB.Average(c => c.Score) : 0.0;
            evaluation.BehavioralScore = Math.Round(finalBScore, 1);

            // Situational score
            double finalSScore = assessedS.Count > 0 ? assessedS.Average(c => c.Score) : 0.0;
            evaluation.SituationalScore = Math.Round(finalSScore, 1);

            // Candidate Question score (Isolated domain)
            double finalCqScore = assessedCq.Count > 0 ? assessedCq.Average(c => c.Score) : 0.0;
            evaluation.CandidateQuestionScore = Math.Round(finalCqScore, 1);

            var assessedCompetencies = competencies.Where(c => c.Confidence != EvaluationConfidence.INSUFFICIENT_EVIDENCE).ToList();
            if (assessedCompetencies.Count == 0)
            {
                evaluation.OverallScore = 0.0;
                evaluation.OverallConfidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE;
                evaluation.OverallLevelAssessment = "Unassessed";
            }
            else
            {
                double finalScore;
                if (assessedB.Count == 0 && assessedS.Count == 0)
                {
                    // Pure technical session (legacy backward-compatibility): exact same calculation as before
                    var unassessedMandatoryCount = techComps.Count(c => c.IsMandatory && c.Confidence == EvaluationConfidence.INSUFFICIENT_EVIDENCE);
                    var totalMandatoryCount = techComps.Count(c => c.IsMandatory);
                    double coverageRatio = totalMandatoryCount > 0 ? (double)(totalMandatoryCount - unassessedMandatoryCount) / totalMandatoryCount : 1.0;
                    finalScore = Math.Round(techScore * coverageRatio, 1);
                }
                else
                {
                    // Multi-stage weighting: Tech (60%), Behavioral (20%), Situational (20%) proportional to assessed domains
                    double weightSum = 0;
                    double weightedTotal = 0;
                    if (assessedTech.Count > 0 || (techComps.Count > 0 && techComps[0].CompetencyId == "general-tech"))
                    {
                        weightSum += 0.6;
                        weightedTotal += 0.6 * techScore;
                    }
                    if (assessedB.Count > 0)
                    {
                        weightSum += 0.2;
                        weightedTotal += 0.2 * finalBScore;
                    }
                    if (assessedS.Count > 0)
                    {
                        weightSum += 0.2;
                        weightedTotal += 0.2 * finalSScore;
                    }
                    finalScore = weightSum > 0 ? Math.Round(weightedTotal / weightSum, 1) : 0.0;
                }

                evaluation.OverallScore = finalScore;

                // Overall Level Assessment
                if (finalScore >= 8.5) evaluation.OverallLevelAssessment = "Senior";
                else if (finalScore >= 7.0) evaluation.OverallLevelAssessment = "Middle";
                else if (finalScore >= 5.0) evaluation.OverallLevelAssessment = "Junior";
                else evaluation.OverallLevelAssessment = "Below Target";

                // Overall Confidence
                var unassessedMandatory = techComps.Count(c => c.IsMandatory && c.Confidence == EvaluationConfidence.INSUFFICIENT_EVIDENCE);
                if (unassessedMandatory > 0)
                {
                    evaluation.OverallConfidence = unassessedMandatory > 1 ? EvaluationConfidence.LOW : EvaluationConfidence.MEDIUM;
                }
                else if (assessedCompetencies.All(c => c.Confidence == EvaluationConfidence.HIGH))
                {
                    evaluation.OverallConfidence = EvaluationConfidence.HIGH;
                }
                else
                {
                    evaluation.OverallConfidence = EvaluationConfidence.MEDIUM;
                }
            }

            // 4. Key Strengths, Weaknesses, and Knowledge Gaps
            foreach (var comp in competencies)
            {
                if (comp.Score >= 7.5 && comp.Confidence == EvaluationConfidence.HIGH)
                {
                    evaluation.KeyStrengths.Add($"{comp.CompetencyName}: {comp.Rationale}");
                }
                else if (comp.CoverageStatus == ConceptCoverageStatus.WEAK)
                {
                    evaluation.KeyWeaknesses.Add($"{comp.CompetencyName}: {comp.Rationale}");
                    evaluation.KnowledgeGaps.Add(comp.CompetencyName);
                }
                else if (comp.CoverageStatus == ConceptCoverageStatus.NOT_TESTED && comp.IsMandatory)
                {
                    evaluation.MissingEvidence.Add($"Kỹ năng bắt buộc '{comp.CompetencyName}' chưa được kiểm chứng.");
                }
            }

            // 5. Risks Assessment
            // Risk 1: Contradictions
            var inconsistencies = new List<string>();
            if (state.DetectedInconsistencies != null && state.DetectedInconsistencies.Count > 0)
            {
                inconsistencies.AddRange(state.DetectedInconsistencies);
            }
            for (int i = 0; i < answers.Count; i++)
            {
                var a = answers[i];
                if (a.HasInconsistency && !string.IsNullOrWhiteSpace(a.InconsistencyDetail))
                {
                    var desc = $"Inconsistency on Turn {i + 1}: {a.InconsistencyDetail}";
                    if (!inconsistencies.Contains(desc) && !inconsistencies.Contains(a.InconsistencyDetail))
                    {
                        inconsistencies.Add(desc);
                    }
                }
            }

            foreach (var inc in inconsistencies)
            {
                evaluation.Risks.Add(new EvaluationRisk
                {
                    Type = EvaluationRiskType.CONTRADICTION,
                    Severity = "HIGH",
                    Description = inc,
                    Evidence = inc
                });
            }

            // Risk 2: Unverified High Claims
            var unverified = new List<string>();
            if (state.UnverifiedClaims != null && state.UnverifiedClaims.Count > 0)
            {
                unverified.AddRange(state.UnverifiedClaims);
            }
            for (int i = 0; i < answers.Count; i++)
            {
                var a = answers[i];
                if (a.UnverifiedClaims != null && a.UnverifiedClaims.Count > 0)
                {
                    foreach (var claim in a.UnverifiedClaims)
                    {
                        if (!unverified.Contains(claim)) unverified.Add(claim);
                    }
                }
            }

            foreach (var claim in unverified)
            {
                evaluation.Risks.Add(new EvaluationRisk
                {
                    Type = EvaluationRiskType.UNVERIFIED_HIGH_CLAIM,
                    Severity = "MEDIUM",
                    Description = "Tuyên bố kinh nghiệm chưa được kiểm chứng bằng bằng chứng thực tế.",
                    Evidence = claim
                });
            }

            // Risk 3: Budget Constrained
            if (evaluation.CompletionStatus == InterviewCompletionStatus.MAX_QUESTIONS_REACHED && evaluation.MissingEvidence.Count > 0)
            {
                evaluation.Risks.Add(new EvaluationRisk
                {
                    Type = EvaluationRiskType.BUDGET_CONSTRAINED,
                    Severity = "HIGH",
                    Description = "Buổi phỏng vấn chạm trần số lượng câu hỏi trước khi kiểm tra hết toàn bộ kỹ năng bắt buộc.",
                    Evidence = $"Còn {evaluation.MissingEvidence.Count} kỹ năng bắt buộc chưa có bằng chứng."
                });
            }

            // 6. Summary Synthesis
            evaluation.Summary = GenerateEvaluationSummary(evaluation);

            // 7. Phase 3 Step 3: Performance & Competency Analysis
            evaluation.PerformanceAssessment = _performanceService.AnalyzePerformance(session, evaluation);

            // 8. Phase 3 Step 4: Diagnostic Analysis
            evaluation.DiagnosticAnalysis = _diagnosticService.AnalyzeSession(session, evaluation);

            // 9. Phase 3 Step 5: Personalized Improvement Roadmap
            evaluation.ImprovementRoadmap = _roadmapService.GenerateRoadmap(session, evaluation);

            // 10. Phase 3 Step 6: Interview Preparation Ecosystem
            evaluation.PreparationPlan = _preparationService.GeneratePreparationPlan(session, evaluation);

            // 11. Phase 4 Step 5: Multi-Industry Interviewer Intelligence Summary
            if (session.EvidenceState?.Summary != null)
            {
                evaluation.IntelligenceSummary = session.EvidenceState.Summary;
            }

            return evaluation;
        }

        private static bool MatchesName(string candidateText, BlueprintConcept concept)
        {
            if (string.IsNullOrWhiteSpace(candidateText)) return false;
            return candidateText.IndexOf(concept.Name, StringComparison.OrdinalIgnoreCase) >= 0 ||
                   candidateText.IndexOf(concept.Id, StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string GenerateEvaluationSummary(FinalInterviewEvaluation eval)
        {
            if (eval.CompletionStatus == InterviewCompletionStatus.INSUFFICIENT_TURNS)
            {
                return "Chưa có câu trả lời nào được ghi nhận để thực hiện đánh giá năng lực.";
            }

            var strengthsPart = eval.KeyStrengths.Count > 0
                ? string.Join("; ", eval.KeyStrengths.Take(3))
                : "Chưa ghi nhận điểm mạnh nổi bật";

            var gapsPart = eval.KeyWeaknesses.Count > 0
                ? string.Join("; ", eval.KeyWeaknesses.Take(3))
                : (eval.MissingEvidence.Count > 0 ? string.Join("; ", eval.MissingEvidence.Take(2)) : "Không có lỗ hổng lớn");

            return $"Đánh giá tổng thể vị trí {eval.TargetPosition} ({eval.TargetLevel}): Điểm số {eval.OverallScore}/10.0 (Xếp loại: {eval.OverallLevelAssessment}, Độ tin cậy: {eval.OverallConfidence}). Điểm mạnh: {strengthsPart}. Lỗ hổng cần lưu ý: {gapsPart}.";
        }
    }
}
