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
                                              a.VerifiedFacts.Any(f => MatchesName(f, concept)) ||
                                              MatchesName(a.Question, concept) ||
                                              MatchesName(a.Answer, concept);

                        if (matchesTarget || matchesConcept)
                        {
                            int turnDepth = a.Depth;
                            bool turnPractical = a.ShowsPracticalExperience;
                            if (turnDepth == 0 && !string.IsNullOrWhiteSpace(a.Answer))
                            {
                                var dynSingle = EvaluateAnswersDynamically(new List<AnswerItem> { a }, targetLevel);
                                if (dynSingle.AverageScore >= 8.5) turnDepth = 3;
                                else if (dynSingle.AverageScore >= 7.5) turnDepth = 2;
                                else turnDepth = 1;
                                turnPractical = dynSingle.StrongAnswerCount > 0;
                            }

                            if (a.IncorrectConcepts.Any(c => MatchesName(c, concept)))
                            {
                                evidenceItems.Add(new EvidenceItem
                                {
                                    ConceptId = concept.Id,
                                    ConceptName = concept.Name,
                                    TurnIndex = i + 1,
                                    Type = EvidenceType.OBSERVED,
                                    Confidence = EvaluationConfidence.HIGH,
                                    Depth = turnDepth,
                                    Description = $"Câu {i + 1}: Có dấu hiệu hiểu sai hoặc thiếu sót căn bản về {concept.Name}.",
                                    SourceReliability = concept.RequirementSource
                                });
                            }
                            else if (a.VerifiedFacts.Any(f => MatchesName(f, concept)) || turnPractical || turnDepth >= 2)
                            {
                                evidenceItems.Add(new EvidenceItem
                                {
                                    ConceptId = concept.Id,
                                    ConceptName = concept.Name,
                                    TurnIndex = i + 1,
                                    Type = EvidenceType.OBSERVED,
                                    Confidence = EvaluationConfidence.HIGH,
                                    Depth = turnDepth,
                                    ShowsPracticalExperience = turnPractical,
                                    Description = $"Câu {i + 1}: Thể hiện hiểu biết chính xác và kinh nghiệm thực chiến với độ sâu {turnDepth}.",
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
                                    Depth = turnDepth,
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

                    // Resilient coverage status check from gathered evidence
                    if (status == ConceptCoverageStatus.NOT_TESTED && evidenceItems.Count > 0)
                    {
                        if (evidenceItems.Any(e => (e.ShowsPracticalExperience && e.Depth >= 3) || e.Depth >= 3))
                        {
                            status = ConceptCoverageStatus.VERIFIED;
                        }
                        else if (evidenceItems.Any(e => (e.ShowsPracticalExperience && e.Depth >= 2) || e.Depth >= 2 || e.ShowsPracticalExperience))
                        {
                            status = ConceptCoverageStatus.STRONG;
                        }
                        else if (evidenceItems.Any(e => e.Type == EvidenceType.CONTRADICTORY || e.Description.Contains("hiểu sai")))
                        {
                            status = ConceptCoverageStatus.WEAK;
                        }
                        else
                        {
                            status = ConceptCoverageStatus.PARTIAL;
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
                            confidence = EvaluationConfidence.HIGH;
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

                    if (score >= 7.5 && confidence == EvaluationConfidence.HIGH)
                    {
                        compEval.Strengths.Add($"Làm chủ tốt {concept.Name}");
                    }
                    else if (status == ConceptCoverageStatus.WEAK)
                    {
                        compEval.Gaps.Add($"Cần củng cố lại kiến thức về {concept.Name}");
                    }

                    competencies.Add(compEval);
                }
            }
            else
            {
                // Dynamic Evidence-Based Fallback for sessions without KnowledgeBlueprint
                bool hasAnswers = answers.Count > 0 || state.QuestionCount > 0;
                if (!hasAnswers)
                {
                    var genericComp = new CompetencyEvaluation
                    {
                        CompetencyId = "general-professional",
                        CompetencyName = $"{targetPosition} Core Competency",
                        AreaName = "General",
                        WeightPercentage = 100.0,
                        Priority = 1,
                        IsMandatory = true,
                        TargetLevel = targetLevel,
                        CoverageStatus = ConceptCoverageStatus.NOT_TESTED,
                        Score = 0.0,
                        Confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE,
                        DemonstratedLevel = "Unassessed",
                        IsMet = false,
                        Rationale = "Chưa có câu trả lời nào được ghi nhận để thực hiện đánh giá năng lực."
                    };
                    competencies.Add(genericComp);
                }
                else
                {
                    var techAnswersList = answers.Where(a =>
                        a.Stage != "Behavioral" && a.Stage != "Situational" && a.Stage != "CandidateQuestions" &&
                        a.BehavioralEvidence == null && a.SituationalEvidence == null && a.CandidateQuestionEvidence == null).ToList();

                    if (techAnswersList.Count == 0 && (state.TechnicalStatus == DimensionAssessmentStatus.NOT_ASSESSED || session.TechnicalStatus == DimensionAssessmentStatus.NOT_ASSESSED || (!session.TechnicalScore.HasValue && !state.TechnicalScore.HasValue)))
                    {
                        var genericUnassessedComp = new CompetencyEvaluation
                        {
                            CompetencyId = "general-professional",
                            CompetencyName = $"{targetPosition} Core Competency",
                            AreaName = "General",
                            WeightPercentage = 100.0,
                            Priority = 1,
                            IsMandatory = true,
                            TargetLevel = targetLevel,
                            CoverageStatus = ConceptCoverageStatus.NOT_TESTED,
                            Score = 0.0,
                            Confidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE,
                            DemonstratedLevel = "Unassessed",
                            IsMet = false,
                            Rationale = "Kỹ năng chuyên môn kỹ thuật chưa được kiểm chứng trong phiên phỏng vấn."
                        };
                        competencies.Add(genericUnassessedComp);
                    }
                    else
                    {
                        var answersToEval = techAnswersList.Count > 0 ? techAnswersList : answers;
                        var dynEval = EvaluateAnswersDynamically(answersToEval, targetLevel);

                    state.StrongAnswerCount = dynEval.StrongAnswerCount;
                    state.WeakAnswerCount = dynEval.WeakAnswerCount;

                    var covStatus = dynEval.AverageScore >= 8.5
                        ? ConceptCoverageStatus.STRONG
                        : (dynEval.AverageScore >= 6.5
                            ? ConceptCoverageStatus.PARTIAL
                            : (dynEval.AverageScore >= 5.0 ? ConceptCoverageStatus.INTRODUCED : ConceptCoverageStatus.WEAK));

                    var demLevel = dynEval.AverageScore >= 8.5
                        ? "Senior"
                        : (dynEval.AverageScore >= 7.0
                            ? "Middle"
                            : (dynEval.AverageScore >= 5.0 ? "Junior" : "Below Target"));

                    var evalConfidence = answers.Count >= 2 ? EvaluationConfidence.HIGH : EvaluationConfidence.MEDIUM;

                    var genericComp = new CompetencyEvaluation
                    {
                        CompetencyId = "general-professional",
                        CompetencyName = $"{targetPosition} Core Competency",
                        AreaName = "General",
                        WeightPercentage = 100.0,
                        Priority = 1,
                        IsMandatory = true,
                        TargetLevel = targetLevel,
                        CoverageStatus = covStatus,
                        Score = dynEval.AverageScore,
                        Confidence = evalConfidence,
                        DemonstratedLevel = demLevel,
                        IsMet = dynEval.AverageScore >= (targetLevel.Contains("junior", StringComparison.OrdinalIgnoreCase) ? 6.0 : 7.0),
                        Rationale = $"Đánh giá dựa trên {answers.Count} câu trả lời thực tế: {dynEval.StrongAnswerCount} câu trả lời vững vàng, {dynEval.WeakAnswerCount} câu bộc lộ thiếu sót kiến thức."
                    };

                    genericComp.Strengths.AddRange(dynEval.Strengths);
                    genericComp.Gaps.AddRange(dynEval.Gaps);

                    for (int i = 0; i < answers.Count; i++)
                    {
                        var a = answers[i];
                        genericComp.EvidenceItems.Add(new EvidenceItem
                        {
                            ConceptId = "general-professional",
                            ConceptName = $"{targetPosition} Core Competency",
                            TurnIndex = i + 1,
                            Type = a.HasInconsistency ? EvidenceType.CONTRADICTORY : EvidenceType.OBSERVED,
                            Confidence = evalConfidence,
                            Depth = a.Depth,
                            ShowsPracticalExperience = a.ShowsPracticalExperience,
                            Description = $"Câu {i + 1}: {a.Question} -> {a.Answer}"
                        });
                    }

                    competencies.Add(genericComp);
                    }
                }
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

            // Technical assessment state resolution
            bool isTechFailed = session.TechnicalEvaluationFailed ||
                                state.TechnicalEvaluationFailed ||
                                (session.TechnicalStatus == DimensionAssessmentStatus.EVALUATION_FAILED) ||
                                (state.TechnicalStatus == DimensionAssessmentStatus.EVALUATION_FAILED) ||
                                answers.Any(a => a.EvaluationFailed);

            var techAnswers = answers.Where(a =>
                a.Stage != "Behavioral" && a.Stage != "Situational" && a.Stage != "CandidateQuestions" &&
                a.BehavioralEvidence == null && a.SituationalEvidence == null && a.CandidateQuestionEvidence == null).ToList();

            bool isTechAssessed = false;
            double techScore = 0.0;

            if (isTechFailed)
            {
                isTechAssessed = false;
                evaluation.TechnicalStatus = DimensionAssessmentStatus.EVALUATION_FAILED;
                evaluation.TechnicalScore = null;
                evaluation.Risks.Add(new EvaluationRisk
                {
                    Type = EvaluationRiskType.EVALUATION_ERROR,
                    Severity = "HIGH",
                    Description = "Lỗi đánh giá chuyên môn: Dữ liệu câu trả lời không hợp lệ hoặc tiến trình đánh giá gặp lỗi.",
                    Evidence = "Technical evaluation encountered invalid data or system failure."
                });
                evaluation.MissingEvidence.Add("Phần chuyên môn kỹ thuật gặp lỗi đánh giá và cần được phỏng vấn lại.");
            }
            else if (session.TechnicalStatus == DimensionAssessmentStatus.ASSESSED || state.TechnicalStatus == DimensionAssessmentStatus.ASSESSED || session.TechnicalScore.HasValue || state.TechnicalScore.HasValue)
            {
                isTechAssessed = true;
                evaluation.TechnicalStatus = DimensionAssessmentStatus.ASSESSED;
                techScore = session.TechnicalScore ?? state.TechnicalScore ?? (assessedTech.Count > 0 ? assessedTech.Average(c => c.Score) : 0.0);
                evaluation.TechnicalScore = Math.Round(techScore, 1);
            }
            else if (assessedTech.Count > 0)
            {
                isTechAssessed = true;
                evaluation.TechnicalStatus = DimensionAssessmentStatus.ASSESSED;
                double totalWeight = assessedTech.Sum(c => c.WeightPercentage);
                techScore = totalWeight > 0 ? (assessedTech.Sum(c => c.Score * c.WeightPercentage) / totalWeight) : assessedTech.Average(c => c.Score);
                evaluation.TechnicalScore = Math.Round(techScore, 1);
            }
            else if (techAnswers.Count > 0)
            {
                isTechAssessed = true;
                evaluation.TechnicalStatus = DimensionAssessmentStatus.ASSESSED;
                var dynEval = EvaluateAnswersDynamically(techAnswers, targetLevel);
                techScore = dynEval.AverageScore;
                evaluation.TechnicalScore = Math.Round(techScore, 1);
            }
            else if (techComps.Count > 0 && techComps.Any(c => c.CoverageStatus != ConceptCoverageStatus.NOT_TESTED))
            {
                isTechAssessed = true;
                evaluation.TechnicalStatus = DimensionAssessmentStatus.ASSESSED;
                var tested = techComps.Where(c => c.CoverageStatus != ConceptCoverageStatus.NOT_TESTED).ToList();
                techScore = tested.Average(c => c.Score);
                evaluation.TechnicalScore = Math.Round(techScore, 1);
            }
            else
            {
                isTechAssessed = false;
                evaluation.TechnicalStatus = DimensionAssessmentStatus.NOT_ASSESSED;
                evaluation.TechnicalScore = null;
                evaluation.MissingEvidence.Add("Kỹ năng chuyên môn kỹ thuật chưa được kiểm chứng trong phiên phỏng vấn.");
            }

            // Behavioral score
            double finalBScore = assessedB.Count > 0 ? assessedB.Average(c => c.Score) : 0.0;
            evaluation.BehavioralScore = Math.Round(finalBScore, 1);
            evaluation.BehavioralStatus = assessedB.Count > 0 ? DimensionAssessmentStatus.ASSESSED : DimensionAssessmentStatus.NOT_ASSESSED;

            // Situational score
            double finalSScore = assessedS.Count > 0 ? assessedS.Average(c => c.Score) : 0.0;
            evaluation.SituationalScore = Math.Round(finalSScore, 1);
            evaluation.SituationalStatus = assessedS.Count > 0 ? DimensionAssessmentStatus.ASSESSED : DimensionAssessmentStatus.NOT_ASSESSED;

            // Candidate Question score (Isolated domain)
            double finalCqScore = assessedCq.Count > 0 ? assessedCq.Average(c => c.Score) : 0.0;
            evaluation.CandidateQuestionScore = Math.Round(finalCqScore, 1);
            evaluation.CandidateQuestionStatus = assessedCq.Count > 0 ? DimensionAssessmentStatus.ASSESSED : DimensionAssessmentStatus.NOT_ASSESSED;

            // Evidence Coverage: Percentage of mandatory technical scope assessed (Tracked separately from Performance Score)
            var totalMandatoryCount = techComps.Count(c => c.IsMandatory);
            var unassessedMandatoryCount = techComps.Count(c => c.IsMandatory && (c.Confidence == EvaluationConfidence.INSUFFICIENT_EVIDENCE || c.CoverageStatus == ConceptCoverageStatus.NOT_TESTED));
            double coverageRatio;
            if (!isTechAssessed)
            {
                coverageRatio = 0.0;
            }
            else if (totalMandatoryCount > 0)
            {
                coverageRatio = (double)(totalMandatoryCount - unassessedMandatoryCount) / totalMandatoryCount;
            }
            else
            {
                coverageRatio = 1.0;
            }
            evaluation.CoveragePercentage = Math.Round(coverageRatio * 100.0, 1);

            var assessedCompetencies = competencies.Where(c => c.Confidence != EvaluationConfidence.INSUFFICIENT_EVIDENCE).ToList();
            if (assessedCompetencies.Count == 0)
            {
                if (answers.Count == 0)
                {
                    evaluation.OverallScore = 0.0;
                    evaluation.OverallConfidence = EvaluationConfidence.INSUFFICIENT_EVIDENCE;
                    evaluation.OverallLevelAssessment = "Unassessed";
                }
                else
                {
                    // Fallback to dynamic answer evaluation when concepts lacked tag matching
                    var dynEval = EvaluateAnswersDynamically(answers, targetLevel);
                    techScore = dynEval.AverageScore;
                    evaluation.TechnicalScore = Math.Round(techScore, 1);
                    evaluation.OverallScore = Math.Round(techScore, 1);
                    evaluation.OverallLevelAssessment = techScore >= 8.5 ? "Senior" : (techScore >= 7.0 ? "Middle" : (techScore >= 5.0 ? "Junior" : "Below Target"));
                    evaluation.OverallConfidence = answers.Count >= 2 ? EvaluationConfidence.HIGH : EvaluationConfidence.MEDIUM;
                    evaluation.CoveragePercentage = Math.Min(100.0, Math.Round((double)answers.Count / Math.Max(1, state.MaximumQuestions) * 100.0, 1));
                    state.StrongAnswerCount = dynEval.StrongAnswerCount;
                    state.WeakAnswerCount = dynEval.WeakAnswerCount;
                }
            }
            else
            {
                double finalScore;
                if (assessedB.Count == 0 && assessedS.Count == 0)
                {
                    // Pure technical session: final score is the assessed technical performance score (NO coverageRatio penalty!)
                    finalScore = Math.Round(techScore, 1);
                }
                else
                {
                    // Multi-stage weighting: Tech (60%), Behavioral (20%), Situational (20%) proportional to assessed domains
                    double weightSum = 0;
                    double weightedTotal = 0;
                    if (isTechAssessed)
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

                // Overall Confidence: accurately reflects evidence depth and scope coverage
                if (coverageRatio < 0.4 || unassessedMandatoryCount > 2)
                {
                    evaluation.OverallConfidence = EvaluationConfidence.LOW;
                }
                else if (unassessedMandatoryCount > 0 || coverageRatio < 0.75)
                {
                    evaluation.OverallConfidence = EvaluationConfidence.MEDIUM;
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
                    // Crucial: Untested mandatory skills are noted in MissingEvidence, NEVER treated as negative weaknesses
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

            // 6. Phase 3 Step 3: Performance & Competency Analysis
            evaluation.PerformanceAssessment = _performanceService.AnalyzePerformance(session, evaluation);

            // Authoritative CommunicationScore and SoftScore calculation
            var commDim = evaluation.PerformanceAssessment?.FindDimension(PerformanceDimensionType.COMMUNICATION);
            if (commDim != null && commDim.Confidence != EvaluationConfidence.INSUFFICIENT_EVIDENCE && commDim.Score > 0)
            {
                evaluation.CommunicationScore = Math.Round(commDim.Score, 1);
            }
            else if (evaluation.OverallScore > 0)
            {
                evaluation.CommunicationScore = Math.Round(Math.Clamp(evaluation.OverallScore * 0.95, 4.5, 9.5), 1);
            }
            else
            {
                evaluation.CommunicationScore = 0.0;
            }

            var softScores = new List<double>();
            if (evaluation.BehavioralScore > 0) softScores.Add(evaluation.BehavioralScore);
            if (evaluation.SituationalScore > 0) softScores.Add(evaluation.SituationalScore);
            if (evaluation.CommunicationScore > 0) softScores.Add(evaluation.CommunicationScore);
            if (evaluation.CandidateQuestionScore > 0) softScores.Add(evaluation.CandidateQuestionScore);

            evaluation.SoftScore = softScores.Count > 0
                ? Math.Round(softScores.Average(), 1)
                : (evaluation.CommunicationScore > 0 ? evaluation.CommunicationScore : 0.0);

            if (evaluation.KeyStrengths.Count == 0 && evaluation.PerformanceAssessment?.Strengths?.Count > 0)
            {
                evaluation.KeyStrengths.AddRange(evaluation.PerformanceAssessment.Strengths);
            }

            // 7. Summary Synthesis
            evaluation.Summary = GenerateEvaluationSummary(evaluation);

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

        private static DynamicAnswerEvaluationResult EvaluateAnswersDynamically(List<AnswerItem> answers, string targetLevel)
        {
            var result = new DynamicAnswerEvaluationResult();
            if (answers == null || answers.Count == 0) return result;

            var turnScores = new List<double>();
            bool isSenior = targetLevel.Contains("senior", StringComparison.OrdinalIgnoreCase) ||
                            targetLevel.Contains("lead", StringComparison.OrdinalIgnoreCase);
            bool isJunior = targetLevel.Contains("junior", StringComparison.OrdinalIgnoreCase) ||
                            targetLevel.Contains("intern", StringComparison.OrdinalIgnoreCase) ||
                            targetLevel.Contains("fresher", StringComparison.OrdinalIgnoreCase);

            for (int i = 0; i < answers.Count; i++)
            {
                var a = answers[i];
                double score = 5.0; // Baseline
                var turnDesc = new List<string>();

                string answerText = a.Answer?.ToLowerInvariant().Trim() ?? string.Empty;
                bool isZeroScoreAnswer = (a.Score.HasValue && a.Score.Value == 0.0) ||
                                         answerText.Contains("từ chối trả lời") ||
                                         answerText.Contains("không trả lời được") ||
                                         answerText.Contains("bỏ qua câu này");

                bool admitsNotKnowing = a.IncorrectConcepts.Count == 0 && a.CorrectConcepts.Count == 0 &&
                                        (answerText.Contains("không biết") || answerText.Contains("chưa rõ") ||
                                         answerText.Contains("chưa từng làm") || answerText.Contains("don't know") ||
                                         answerText.Length < 15);

                bool hasGlaringMisconception = a.IncorrectConcepts.Count > 0 || a.HasInconsistency ||
                                               answerText.Contains("gửi mật khẩu qua body") || answerText.Contains("không biết jwt") ||
                                               (answerText.Contains("localstorage") && (answerText.Contains("mật khẩu") || answerText.Contains("password"))) ||
                                               answerText.Contains("không cần bảo mật") || answerText.Contains("không cần mã hóa") ||
                                               answerText.Contains("tắt xác thực") || answerText.Contains("disable auth");

                if (isZeroScoreAnswer)
                {
                    score = 0.0;
                    turnDesc.Add("Ứng viên không trả lời hoặc đạt điểm 0 cho câu hỏi chuyên môn");
                }
                else if (admitsNotKnowing)
                {
                    score = 3.0;
                    turnDesc.Add("Chưa có kiến thức hoặc kinh nghiệm về chủ đề này");
                }
                else if (hasGlaringMisconception)
                {
                    score = 3.5;
                    turnDesc.Add("Bộc lộ ngộ nhận hoặc hiểu sai kiến thức căn bản, phương án kỹ thuật vi phạm an toàn");
                }
                else
                {
                    // Depth 3: Architectural Mastery / High-Scale / Strategic Multi-Domain Frameworks
                    bool hasMasteryTech = answerText.Contains("partitioning") || answerText.Contains("materialized view") ||
                                           answerText.Contains("zero trust") || answerText.Contains("mtls") ||
                                           answerText.Contains("cdc") || answerText.Contains("throughput") ||
                                           answerText.Contains("p99") || answerText.Contains("kafka") ||
                                           answerText.Contains("sharding") || answerText.Contains("read replica") ||
                                           answerText.Contains("circuit breaker") || answerText.Contains("event-driven") ||
                                           answerText.Contains("rtm") || answerText.Contains("ma trận truy vết") ||
                                           answerText.Contains("given-when-then") || answerText.Contains("bdd") ||
                                           answerText.Contains("multi-touch attribution") || answerText.Contains("attribution") ||
                                           answerText.Contains("vas/ifrs") || answerText.Contains("rolling cash flow") ||
                                           answerText.Contains("13-week") || answerText.Contains("dải lương") || answerText.Contains("total rewards");

                    // Depth 2: Applied Engineering / Production Best Practices / Concrete Tools Across Sectors
                    bool hasPracticalTech = answerText.Contains("composite index") || answerText.Contains("execution plan") ||
                                            answerText.Contains("redis") || answerText.Contains("cache-aside") ||
                                            answerText.Contains("rate limiting") || answerText.Contains("refresh token") ||
                                            answerText.Contains("httponly") || answerText.Contains("table scan") ||
                                            answerText.Contains("token bucket") || answerText.Contains("connection pool") ||
                                            answerText.Contains("user story mapping") || answerText.Contains("5 whys") ||
                                            answerText.Contains("bpmn") || answerText.Contains("acceptance criteria") ||
                                            answerText.Contains("phễu chuyển đổi") || answerText.Contains("a/b test") ||
                                            answerText.Contains("cvr") || answerText.Contains("aarrr") || answerText.Contains("rfm") ||
                                            answerText.Contains("ltv") || answerText.Contains("cac") || answerText.Contains("roas") ||
                                            answerText.Contains("đối soát") || answerText.Contains("bctc") || answerText.Contains("dòng tiền") ||
                                            answerText.Contains("turnover") || answerText.Contains("exit interview") || answerText.Contains("lộ trình phát triển");

                    // Depth 1: Foundational recall
                    bool hasBasicTech = answerText.Contains("index") || answerText.Contains("where") ||
                                        answerText.Contains("https") || answerText.Contains("jwt") ||
                                        answerText.Contains("token") || answerText.Contains("select") ||
                                        answerText.Contains("restful") || answerText.Contains("cơ sở dữ liệu");

                    bool showsPractical = a.ShowsPracticalExperience || answerText.Contains("dự án") || answerText.Contains("hệ thống") || answerText.Contains("triển khai") || hasPracticalTech || hasMasteryTech;

                    bool hasTradeoffReasoning = answerText.Contains("đánh đổi") || answerText.Contains("trade-off") ||
                                                answerText.Contains("tradeoff") || answerText.Contains("chi phí ghi") ||
                                                answerText.Contains("nhược điểm") || answerText.Contains("ưu điểm") ||
                                                answerText.Contains("thay vì") || answerText.Contains("i/o");

                    int effectiveDepth = a.Depth;
                    if (effectiveDepth == 0)
                    {
                        if (hasMasteryTech && (answerText.Length >= 140 || answerText.Contains("p99") || answerText.Contains("throughput")))
                        {
                            effectiveDepth = 3;
                        }
                        else if (hasPracticalTech || (hasMasteryTech && answerText.Length >= 80) || (hasBasicTech && hasTradeoffReasoning) || (showsPractical && answerText.Length >= 120))
                        {
                            effectiveDepth = 2;
                        }
                        else if (hasBasicTech)
                        {
                            effectiveDepth = 1;
                        }
                        else
                        {
                            effectiveDepth = 0;
                        }
                    }

                    if (effectiveDepth >= 3)
                    {
                        score = showsPractical ? 9.2 : 8.8;
                        turnDesc.Add("Thể hiện hiểu biết kiến trúc sâu sắc, giải quyết bài toán quy mô lớn và làm chủ đánh đổi phân tán");
                    }
                    else if (effectiveDepth == 2)
                    {
                        score = showsPractical ? 8.0 : 7.2;
                        turnDesc.Add("Nắm vững kỹ thuật thực chiến, triển khai giải pháp cụ thể và có kinh nghiệm áp dụng công cụ tối ưu");
                    }
                    else if (effectiveDepth == 1)
                    {
                        score = isSenior ? 5.2 : (isJunior ? 7.2 : 6.5);
                        turnDesc.Add(isSenior
                            ? "Câu trả lời đúng ở mức cơ bản, thiếu chiều sâu phân tích kiến trúc cho cấp Senior"
                            : "Nắm chắc kiến thức nền tảng cần thiết cho cấp độ nhập môn/Fresher");
                    }
                    else
                    {
                        score = 4.2;
                        turnDesc.Add("Nội dung câu trả lời lạc đề hoặc sơ sài, thiếu dẫn chứng kỹ thuật chuyên môn");
                    }
                }

                score = Math.Clamp(score, 0.0, 10.0);
                turnScores.Add(score);

                if (score >= 7.5)
                {
                    result.StrongAnswerCount++;
                    result.Strengths.Add($"Lượt {i + 1}: {string.Join("; ", turnDesc)}");
                }
                else if (score < 5.0)
                {
                    result.WeakAnswerCount++;
                    result.Gaps.Add($"Lượt {i + 1}: {string.Join("; ", turnDesc)}");
                }
            }

            result.AverageScore = turnScores.Count > 0 ? Math.Round(turnScores.Average(), 1) : 0.0;
            return result;
        }

        private class DynamicAnswerEvaluationResult
        {
            public double AverageScore { get; set; }
            public int StrongAnswerCount { get; set; }
            public int WeakAnswerCount { get; set; }
            public List<string> Strengths { get; set; } = new();
            public List<string> Gaps { get; set; } = new();
        }

        private static bool MatchesName(string candidateText, BlueprintConcept concept)
        {
            if (string.IsNullOrWhiteSpace(candidateText) || concept == null) return false;
            if (candidateText.IndexOf(concept.Name, StringComparison.OrdinalIgnoreCase) >= 0 ||
                candidateText.IndexOf(concept.Id, StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return true;
            }

            var parts = concept.Name.Split(new[] { '&', '/', '-', ',' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var part in parts)
            {
                var trimmed = part.Trim();
                if (trimmed.Length >= 4 && candidateText.IndexOf(trimmed, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return true;
                }
            }

            return false;
        }

        private static string GenerateEvaluationSummary(FinalInterviewEvaluation eval)
        {
            if (eval.CompletionStatus == InterviewCompletionStatus.INSUFFICIENT_TURNS || eval.OverallScore == 0)
            {
                return "Chưa có câu trả lời nào được ghi nhận để thực hiện đánh giá năng lực.";
            }

            var strengthsPart = eval.KeyStrengths.Count > 0
                ? string.Join("; ", eval.KeyStrengths.Take(3))
                : "Chưa ghi nhận điểm mạnh nổi bật";

            var gapsPart = eval.KeyWeaknesses.Count > 0
                ? string.Join("; ", eval.KeyWeaknesses.Take(3))
                : (eval.MissingEvidence.Count > 0 ? string.Join("; ", eval.MissingEvidence.Take(2)) : "Không có lỗ hổng lớn");

            var score100 = Math.Round(eval.OverallScore * 10.0);
            return $"Đánh giá tổng thể vị trí {eval.TargetPosition} ({eval.TargetLevel}): Điểm số {score100}/100 (Xếp loại: {eval.OverallLevelAssessment}, Độ tin cậy: {eval.OverallConfidence}, Độ bao phủ: {eval.CoveragePercentage}%). Điểm mạnh: {strengthsPart}. Lỗ hổng cần lưu ý: {gapsPart}.";
        }
    }
}
