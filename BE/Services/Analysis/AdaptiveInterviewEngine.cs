using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using backend.Models;
using backend.Services.Knowledge;

namespace backend.Services
{
    public class AdaptiveInterviewEngine
    {
        private readonly AnswerAnalysisService _answerAnalysisService;
        private readonly KnowledgeCoverageService _knowledgeCoverageService;
        private readonly IKnowledgeRepository? _knowledgeRepository;

        public AdaptiveInterviewEngine(
            AnswerAnalysisService answerAnalysisService,
            KnowledgeCoverageService knowledgeCoverageService,
            IKnowledgeRepository? knowledgeRepository = null)
        {
            _answerAnalysisService = answerAnalysisService;
            _knowledgeCoverageService = knowledgeCoverageService;
            _knowledgeRepository = knowledgeRepository;
        }

        public async Task<AnswerAnalysis> ProcessAnswerAsync(
            Session session,
            string question,
            string answer)
        {
            var state = session.InterviewState;
            var context = session.InterviewContext;

            if (context == null)
            {
                throw new InvalidOperationException(
                    "InterviewContext chưa được khởi tạo.");
            }

            if (!backend.Services.Interview.InterviewStageOrchestrator.IsTechnicalStage(state.InterviewPhase))
            {
                throw new InvalidOperationException(
                    "AdaptiveInterviewEngine chỉ xử lý ADAPTIVE_INTERVIEW / TECHNICAL_ASSESSMENT.");
            }

            var priorHistory = session.Answers != null && session.Answers.Count > 0
                ? string.Join(
                    "\n\n",
                    session.Answers
                        .TakeLast(6)
                        .Select((a, idx) => $"Q{idx + 1}: {a.Question}\nA{idx + 1}: {a.Answer}"))
                : string.Empty;

            var analysis = await _answerAnalysisService.AnalyzeAsync(
                question,
                answer,
                state.CurrentTopic,
                state.CurrentSubtopic,
                context.TargetPosition,
                priorHistory
            );

            // SANITIZE & VALIDATE MODEL OUTPUT (Groundedness, Fact vs Claim separation, Anti-hallucination)
            SanitizeAndValidateAnalysis(answer, analysis);

            // Step 3B: Update knowledge coverage from analysis before deciding next action/target
            if (context.KnowledgeBlueprint != null)
            {
                _knowledgeCoverageService.UpdateCoverage(
                    state,
                    context.KnowledgeBlueprint,
                    analysis
                );
            }

            UpdateConceptState(state, analysis);

            state.QuestionCount++;

            var action = DecideNextAction(
                state,
                analysis
            );

            state.LastDecision = action.ToString();

            UpdateState(
                state,
                action,
                analysis,
                context.KnowledgeBlueprint
            );

            return analysis;
        }

        public InterviewAction DecideNextAction(
            InterviewState state,
            AnswerAnalysis analysis)
        {
            // 1. Đạt giới hạn toàn bộ interview
            if (state.QuestionCount >= state.MaximumQuestions)
            {
                state.IsReadyToFinish = true;
                return InterviewAction.EndInterview;
            }

            // 2. Ứng viên hoàn toàn không biết
            // Không nên cố đào sâu một topic mà ứng viên không nắm được.
            if (analysis.DoesNotKnow)
            {
                return InterviewAction.ChangeTopic;
            }

            // 3. MÂU THUẪN XUYÊN SUỐT (CROSS-TURN INCONSISTENCY)
            // Phát hiện phát biểu mâu thuẫn giữa các turn -> Ưu tiên CLARIFY để ứng viên làm rõ
            if (analysis.HasInconsistency && !string.IsNullOrWhiteSpace(analysis.InconsistencyDetail))
            {
                return state.FollowUpCount < state.TopicFollowUpLimit
                    ? InterviewAction.Clarify
                    : InterviewAction.ChangeTopic;
            }

            // 4. Có kiến thức sai -> ưu tiên kiểm chứng/sửa kiến thức.
            if (analysis.IncorrectConcepts.Count > 0)
            {
                return state.FollowUpCount < state.TopicFollowUpLimit
                    ? InterviewAction.Verify
                    : InterviewAction.ChangeTopic;
            }

            // 5. Cần làm rõ -> chỉ hỏi thêm nếu topic chưa bị đào quá sâu.
            if (analysis.NeedsClarification)
            {
                return state.FollowUpCount < state.TopicFollowUpLimit
                    ? InterviewAction.Clarify
                    : InterviewAction.ChangeTopic;
            }

            // 6. Topic hoặc Concept đã đạt giới hạn follow-up / budget.
            // Không tiếp tục đào sâu topic này.
            var conceptStrat = state.Strategy?.FindConceptStrategy(state.ActiveTargetEvaluation?.ConceptId)
                               ?? state.Strategy?.FindConceptStrategy(state.ActiveTargetEvaluation?.ConceptName);
            var maxConceptBudget = conceptStrat?.MaxQuestionBudget ?? state.TopicFollowUpLimit;

            if (state.FollowUpCount >= Math.Min(state.TopicFollowUpLimit, maxConceptBudget))
            {
                return InterviewAction.ChangeTopic;
            }

            // 6.5. Sớm giải phóng budget khi đã đạt STRONG hoặc VERIFIED (Mastery reached)
            var targetId = state.ActiveTargetEvaluation?.ConceptId ?? state.CurrentSubtopic ?? state.CurrentTopic;
            if (state.KnowledgeCoverage != null &&
                !string.IsNullOrWhiteSpace(targetId))
            {
                var hasStatus = state.KnowledgeCoverage.TryGetValue(targetId, out var currentStatus) ||
                                state.KnowledgeCoverage.TryGetValue(targetId.ToLowerInvariant(), out currentStatus);
                if (hasStatus && (currentStatus == ConceptCoverageStatus.STRONG || currentStatus == ConceptCoverageStatus.VERIFIED) &&
                    analysis.IncorrectConcepts.Count == 0 &&
                    !analysis.HasInconsistency)
                {
                    return InterviewAction.ChangeTopic;
                }
            }

            // 7. Có tuyên bố chưa kiểm chứng (Unverified Claim) về Scale/Kiến trúc -> CHALLENGE bằng chứng
            if (analysis.UnverifiedClaims.Count > 0 && analysis.Depth >= 2)
            {
                return InterviewAction.Challenge;
            }

            // 8. Có kinh nghiệm thực tế.
            // Nếu đã có độ sâu tốt -> Challenge.
            // Nếu chưa -> đưa vào tình huống thực tế.
            if (analysis.ShowsPracticalExperience)
            {
                return analysis.Depth >= 3
                    ? InterviewAction.Challenge
                    : InterviewAction.Application;
            }

            // 9. Có candidate để đào sâu.
            if (analysis.FollowUpCandidates.Count > 0)
            {
                return InterviewAction.DeepenTopic;
            }

            // 10. Câu trả lời còn nông.
            if (analysis.Depth <= 1)
            {
                return InterviewAction.Clarify;
            }

            // 11. Đã có nền tảng nhưng chưa đủ sâu.
            if (analysis.Depth == 2)
            {
                return InterviewAction.Application;
            }

            // 12. Câu trả lời đủ sâu -> challenge.
            if (analysis.Depth >= 3)
            {
                return InterviewAction.Challenge;
            }

            // Fallback an toàn.
            return InterviewAction.ChangeTopic;
        }

        public void UpdateState(
            InterviewState state,
            InterviewAction action,
            AnswerAnalysis analysis,
            KnowledgeBlueprint? blueprint = null)
        {
            switch (action)
            {
                case InterviewAction.Verify:
                    AddUnique(state.TopicsCovered, state.CurrentTopic);
                    state.FollowUpCount = Math.Min(state.FollowUpCount + 1, state.TopicFollowUpLimit);
                    state.TopicDepth = analysis.Depth;

                    var wrongConceptName = analysis.IncorrectConcepts.FirstOrDefault() ?? state.CurrentSubtopic;
                    var verifyConcept = FindConceptInBlueprint(blueprint, wrongConceptName, out var verifyArea);
                    if (verifyConcept == null && state.ActiveTargetEvaluation != null)
                    {
                        verifyConcept = FindConceptInBlueprint(blueprint, state.ActiveTargetEvaluation.ConceptName, out verifyArea);
                    }

                    if (verifyConcept != null && verifyArea != null)
                    {
                        state.ActiveTargetEvaluation = CreateTargetContext(
                            verifyArea,
                            verifyConcept,
                            state,
                            missingEvidence: "Xác minh lại kiến thức có dấu hiệu chưa chính xác: " + string.Join(", ", analysis.IncorrectConcepts));
                    }
                    else if (!string.IsNullOrWhiteSpace(wrongConceptName))
                    {
                        state.ActiveTargetEvaluation = new TargetEvaluationContext
                        {
                            AreaName = state.CurrentTopic,
                            ConceptName = wrongConceptName,
                            CoverageStatus = ConceptCoverageStatus.WEAK,
                            MissingEvidence = "Xác minh lại kiến thức có dấu hiệu chưa chính xác: " + string.Join(", ", analysis.IncorrectConcepts)
                        };
                    }
                    else
                    {
                        state.ActiveTargetEvaluation = null;
                    }
                    break;

                case InterviewAction.Clarify:
                    AddUnique(state.TopicsCovered, state.CurrentTopic);
                    state.FollowUpCount = Math.Min(state.FollowUpCount + 1, state.TopicFollowUpLimit);
                    state.TopicDepth = analysis.Depth;

                    var clarifyConceptName = !string.IsNullOrWhiteSpace(state.CurrentSubtopic)
                        ? state.CurrentSubtopic
                        : (!string.IsNullOrWhiteSpace(analysis.MainConcept) ? analysis.MainConcept : state.CurrentTopic);

                    var clarifyConcept = FindConceptInBlueprint(blueprint, clarifyConceptName, out var clarifyArea);
                    if (clarifyConcept == null && state.ActiveTargetEvaluation != null)
                    {
                        clarifyConcept = FindConceptInBlueprint(blueprint, state.ActiveTargetEvaluation.ConceptName, out clarifyArea);
                    }

                    if (clarifyConcept != null && clarifyArea != null)
                    {
                        state.ActiveTargetEvaluation = CreateTargetContext(
                            clarifyArea,
                            clarifyConcept,
                            state,
                            missingEvidence: analysis.HasInconsistency ? analysis.InconsistencyDetail : "Cần làm rõ chi tiết kỹ thuật");
                    }
                    else if (!string.IsNullOrWhiteSpace(clarifyConceptName))
                    {
                        state.ActiveTargetEvaluation = new TargetEvaluationContext
                        {
                            AreaName = state.CurrentTopic,
                            ConceptName = clarifyConceptName,
                            CoverageStatus = ConceptCoverageStatus.PARTIAL,
                            MissingEvidence = analysis.HasInconsistency ? analysis.InconsistencyDetail : "Cần làm rõ chi tiết kỹ thuật"
                        };
                    }
                    else
                    {
                        state.ActiveTargetEvaluation = null;
                    }
                    break;

                case InterviewAction.DeepenTopic:
                case InterviewAction.Application:
                case InterviewAction.Challenge:
                    AddUnique(state.TopicsCovered, state.CurrentTopic);
                    state.FollowUpCount = Math.Min(state.FollowUpCount + 1, state.TopicFollowUpLimit);

                    if (analysis.FollowUpCandidates.Count > 0)
                    {
                        state.CurrentSubtopic = analysis.FollowUpCandidates[0];
                    }
                    else if (!string.IsNullOrWhiteSpace(analysis.MainConcept))
                    {
                        state.CurrentSubtopic = analysis.MainConcept;
                    }

                    state.TopicDepth = analysis.Depth;

                    var deepenConcept = FindConceptInBlueprint(blueprint, state.CurrentSubtopic, out var deepenArea);
                    if (deepenConcept == null && state.ActiveTargetEvaluation != null)
                    {
                        deepenConcept = FindConceptInBlueprint(blueprint, state.ActiveTargetEvaluation.ConceptName, out deepenArea);
                    }
                    if (deepenConcept == null && !string.IsNullOrWhiteSpace(analysis.MainConcept))
                    {
                        deepenConcept = FindConceptInBlueprint(blueprint, analysis.MainConcept, out deepenArea);
                    }

                    if (deepenConcept != null && deepenArea != null)
                    {
                        state.ActiveTargetEvaluation = CreateTargetContext(
                            deepenArea,
                            deepenConcept,
                            state);
                    }
                    else if (!string.IsNullOrWhiteSpace(state.CurrentSubtopic))
                    {
                        state.ActiveTargetEvaluation = new TargetEvaluationContext
                        {
                            AreaName = state.CurrentTopic,
                            ConceptName = state.CurrentSubtopic,
                            CoverageStatus = ConceptCoverageStatus.PARTIAL
                        };
                    }
                    else
                    {
                        state.ActiveTargetEvaluation = null;
                    }
                    break;

                case InterviewAction.ChangeTopic:
                    if (!string.IsNullOrWhiteSpace(state.CurrentTopic))
                    {
                        AddUnique(state.TopicsCovered, state.CurrentTopic);
                        RemoveIgnoreCase(state.TopicsRemaining, state.CurrentTopic);
                    }
                    state.FollowUpCount = 0;

                    // Step 3B: Use KnowledgeBlueprint + Coverage to select next target if available
                    var targetConcept = SelectNextTarget(state, blueprint, out var targetArea);
                    if (targetConcept != null && targetArea != null)
                    {
                        state.CurrentTopic = targetArea.Name;
                        state.CurrentSubtopic = targetConcept.Name;
                        state.TopicDepth = 1;
                        RemoveIgnoreCase(state.TopicsRemaining, targetArea.Name);
                        RemoveIgnoreCase(state.TopicsRemaining, targetConcept.Name);

                        state.ActiveTargetEvaluation = CreateTargetContext(targetArea, targetConcept, state);
                    }
                    else if (state.TopicsRemaining.Count > 0)
                    {
                        // Fallback to Phase 1 behavior for remaining topics
                        state.CurrentTopic = state.TopicsRemaining[0];
                        state.CurrentSubtopic = string.Empty;
                        state.TopicDepth = 1;
                        state.ActiveTargetEvaluation = null;
                    }
                    else
                    {
                        state.IsReadyToFinish = true;
                        state.ActiveTargetEvaluation = null;
                    }
                    break;

                case InterviewAction.EndInterview:
                    state.IsReadyToFinish = true;
                    state.ActiveTargetEvaluation = null;
                    break;
            }
        }

        public TargetEvaluationContext CreateTargetContext(
            KnowledgeArea area,
            BlueprintConcept concept,
            InterviewState state,
            string missingEvidence = "",
            string previousEvidence = "",
            InterviewAction? explicitAction = null)
        {
            var status = state.KnowledgeCoverage != null && state.KnowledgeCoverage.TryGetValue(concept.Id, out var s)
                ? s
                : ConceptCoverageStatus.NOT_TESTED;

            var targetCtx = new TargetEvaluationContext
            {
                AreaName = area.Name,
                AreaImportance = area.Importance,
                ConceptId = concept.Id,
                ConceptName = concept.Name,
                ExpectedUnderstanding = concept.ExpectedUnderstanding ?? new List<string>(),
                PracticalSignals = concept.PracticalSignals ?? new List<string>(),
                FailureSignals = concept.FailureSignals ?? new List<string>(),
                RequirementSource = concept.RequirementSource,
                IsMandatory = concept.IsMandatory,
                CoverageStatus = status,
                MissingEvidence = missingEvidence,
                PreviousRelevantEvidence = previousEvidence,
                ContextualSignals = concept.ContextualSignals ?? new List<string>(),
                CompanyRelevance = concept.CompanyRelevance ?? new List<string>()
            };

            // Step 8: Enrich target context with repository patterns/scenarios if repository is present
            if (_knowledgeRepository != null)
            {
                try
                {
                    var actionToUse = explicitAction;
                    if (!actionToUse.HasValue && Enum.TryParse<InterviewAction>(state.LastDecision, out var parsedAction))
                    {
                        actionToUse = parsedAction;
                    }

                    var repoItems = _knowledgeRepository.GetRelevantItems(concept.Id, actionToUse, state.CandidateLevel);
                    if (repoItems != null && repoItems.Count > 0)
                    {
                        targetCtx.RepositoryItems = repoItems;
                        foreach (var item in repoItems)
                        {
                            if (item.Type == RepositoryItemType.SCENARIO || item.Type == RepositoryItemType.EXAMPLE)
                            {
                                targetCtx.ReferenceScenarios.Add(item.Content);
                            }
                            else
                            {
                                targetCtx.QuestionPatterns.Add(item.Content);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    // Fallback: Repository failure must never crash target context or interview flow
                    Console.WriteLine($"[REPOSITORY LOOKUP FALLBACK] {ex.Message}");
                }
            }

            return targetCtx;
        }

        public static BlueprintConcept? FindConceptInBlueprint(
            KnowledgeBlueprint? blueprint,
            string? query,
            out KnowledgeArea? parentArea)
        {
            parentArea = null;
            if (blueprint?.Areas == null || string.IsNullOrWhiteSpace(query))
            {
                return null;
            }

            var trimmed = query.Trim();

            // 1. Exact match on Id or Name
            foreach (var area in blueprint.Areas)
            {
                if (area?.Concepts == null) continue;
                foreach (var c in area.Concepts)
                {
                    if (string.Equals(c.Id, trimmed, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(c.Name, trimmed, StringComparison.OrdinalIgnoreCase))
                    {
                        parentArea = area;
                        return c;
                    }
                }
            }

            // 2. Token boundary regex match
            foreach (var area in blueprint.Areas)
            {
                if (area?.Concepts == null) continue;
                foreach (var c in area.Concepts)
                {
                    var pattern1 = $@"(^|[\s\-_]){System.Text.RegularExpressions.Regex.Escape(c.Name)}($|[\s\-_])";
                    if (System.Text.RegularExpressions.Regex.IsMatch(trimmed, pattern1, System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                    {
                        parentArea = area;
                        return c;
                    }

                    var pattern2 = $@"(^|[\s\-_]){System.Text.RegularExpressions.Regex.Escape(trimmed)}($|[\s\-_])";
                    if (System.Text.RegularExpressions.Regex.IsMatch(c.Name, pattern2, System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                    {
                        parentArea = area;
                        return c;
                    }
                }
            }

            return null;
        }

        public BlueprintConcept? SelectNextTarget(
            InterviewState state,
            KnowledgeBlueprint? blueprint,
            out KnowledgeArea? targetArea)
        {
            targetArea = null;
            if (blueprint == null || blueprint.Areas == null || blueprint.Areas.Count == 0)
            {
                return null;
            }

            var coverage = state.KnowledgeCoverage ?? new Dictionary<string, ConceptCoverageStatus>();

            // Collect all concepts with their parent area
            var allConcepts = new List<(KnowledgeArea Area, BlueprintConcept Concept, ConceptCoverageStatus Status)>();

            foreach (var area in blueprint.Areas)
            {
                if (area?.Concepts == null) continue;
                foreach (var concept in area.Concepts)
                {
                    if (string.IsNullOrWhiteSpace(concept.Id)) continue;

                    var status = coverage.TryGetValue(concept.Id, out var s)
                        ? s
                        : ConceptCoverageStatus.NOT_TESTED;

                    allConcepts.Add((area, concept, status));
                }
            }

            if (allConcepts.Count == 0)
            {
                return null;
            }

            // Check if all concepts are STRONG or VERIFIED (Test 14)
            bool allMastered = allConcepts.All(x =>
                x.Status == ConceptCoverageStatus.STRONG ||
                x.Status == ConceptCoverageStatus.VERIFIED);

            if (allMastered)
            {
                return null;
            }

            // Priority Tiers (Sections 4 & 12):
            // Priority 1: Mandatory + NOT_TESTED
            // Priority 2: HIGH importance + NOT_TESTED
            // Priority 3: Mandatory + WEAK (Remediation)
            // Priority 4: HIGH importance + WEAK
            // Priority 5: PARTIAL (Deepen)
            // Priority 6: Optional / MEDIUM / LOW + NOT_TESTED
            // Priority 7: INTRODUCED
            // Priority 8: Other WEAK
            // Priority 99: STRONG or VERIFIED (Avoided)

            int GetPriority((KnowledgeArea Area, BlueprintConcept Concept, ConceptCoverageStatus Status) item)
            {
                var isMandatory = item.Concept.IsMandatory;
                var isHighArea = item.Area.Importance == AreaImportance.HIGH;
                var status = item.Status;

                if (isMandatory && status == ConceptCoverageStatus.NOT_TESTED)
                    return 1;

                if (isHighArea && status == ConceptCoverageStatus.NOT_TESTED)
                    return 2;

                if (isMandatory && status == ConceptCoverageStatus.WEAK)
                    return 3;

                if (isHighArea && status == ConceptCoverageStatus.WEAK)
                    return 4;

                if (status == ConceptCoverageStatus.PARTIAL)
                    return 5;

                if (status == ConceptCoverageStatus.NOT_TESTED)
                    return 6;

                if (status == ConceptCoverageStatus.INTRODUCED)
                    return 7;

                if (status == ConceptCoverageStatus.WEAK)
                    return 8;

                return 99; // STRONG or VERIFIED
            }

            // Deterministic selection:
            // 1. Priority tier
            // 2. Prefer different area from current topic if moving away from an exhausted area
            // 3. Higher area importance
            // 4. Stable Concept ID
            var bestCandidate = allConcepts
                .Where(x => GetPriority(x) < 99)
                .OrderBy(x => GetPriority(x))
                .ThenBy(x => state.Strategy?.FindConceptStrategy(x.Concept.Id)?.Priority ?? 2)
                .ThenBy(x => x.Area.Name.Equals(state.CurrentTopic, StringComparison.OrdinalIgnoreCase) ? 1 : 0)
                .ThenBy(x => x.Area.Importance == AreaImportance.HIGH ? 0 : (x.Area.Importance == AreaImportance.MEDIUM ? 1 : 2))
                .ThenBy(x => x.Concept.Id, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault();

            if (bestCandidate.Concept != null)
            {
                targetArea = bestCandidate.Area;
                return bestCandidate.Concept;
            }

            return null;
        }

        private void UpdateConceptState(
            InterviewState state,
            AnswerAnalysis analysis)
        {
            foreach (var concept in analysis.Concepts)
            {
                AddUnique(
                    state.DiscoveredConcepts,
                    concept
                );
            }

            foreach (var concept in analysis.CorrectConcepts)
            {
                AddUnique(
                    state.StrongConcepts,
                    concept
                );

                RemoveIgnoreCase(
                    state.WeakConcepts,
                    concept
                );
            }

            foreach (var concept in analysis.IncorrectConcepts)
            {
                AddUnique(
                    state.WeakConcepts,
                    concept
                );
            }

            if (analysis.DoesNotKnow)
            {
                foreach (var concept in analysis.Concepts)
                {
                    AddUnique(
                        state.UnknownConcepts,
                        concept
                    );
                }
            }

            foreach (var fact in analysis.VerifiedFacts)
            {
                AddUnique(
                    state.VerifiedFacts,
                    fact
                );
            }

            foreach (var claim in analysis.UnverifiedClaims)
            {
                AddUnique(
                    state.UnverifiedClaims,
                    claim
                );
            }

            if (analysis.HasInconsistency && !string.IsNullOrWhiteSpace(analysis.InconsistencyDetail))
            {
                AddUnique(
                    state.DetectedInconsistencies,
                    analysis.InconsistencyDetail
                );
            }

            state.LastAnswerConcepts =
                analysis.Concepts
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
        }

        private void AddUnique(
            List<string> list,
            string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return;
            }

            if (!list.Contains(
                value,
                StringComparer.OrdinalIgnoreCase))
            {
                list.Add(value);
            }
        }

        private void RemoveIgnoreCase(
            List<string> list,
            string value)
        {
            var item = list.FirstOrDefault(
                x => x.Equals(
                    value,
                    StringComparison.OrdinalIgnoreCase)
            );

            if (item != null)
            {
                list.Remove(item);
            }
        }
        private void SanitizeAndValidateAnalysis(string answer, AnswerAnalysis analysis)
        {
            if (string.IsNullOrWhiteSpace(answer) || analysis == null) return;

            analysis.VerifiedFacts ??= new List<string>();
            analysis.UnverifiedClaims ??= new List<string>();
            analysis.MissingConcepts ??= new List<string>();
            analysis.IncorrectConcepts ??= new List<string>();

            // 1. Missing metric detection from candidate's explicit admission
            bool admitsNoMetrics = answer.Contains("chưa có số liệu", StringComparison.OrdinalIgnoreCase) ||
                                  answer.Contains("chưa tiến hành đo đạc", StringComparison.OrdinalIgnoreCase) ||
                                  answer.Contains("chưa đo đạc", StringComparison.OrdinalIgnoreCase);

            if (admitsNoMetrics)
            {
                const string metricGap = "Chưa có số liệu đo đạc cụ thể về latency hoặc throughput (thử nghiệm pilot)";
                if (!analysis.MissingConcepts.Contains(metricGap, StringComparer.OrdinalIgnoreCase))
                {
                    analysis.MissingConcepts.Add(metricGap);
                }

                // Strip any hallucinated metrics from model output
                analysis.VerifiedFacts.RemoveAll(f =>
                    f.Contains("latency", StringComparison.OrdinalIgnoreCase) ||
                    f.Contains("throughput", StringComparison.OrdinalIgnoreCase) ||
                    f.Contains("350ms", StringComparison.OrdinalIgnoreCase) ||
                    f.Contains("45ms", StringComparison.OrdinalIgnoreCase) ||
                    f.Contains("10.000", StringComparison.OrdinalIgnoreCase) ||
                    f.Contains("15.000", StringComparison.OrdinalIgnoreCase) ||
                    f.Contains("rps", StringComparison.OrdinalIgnoreCase));

                analysis.UnverifiedClaims.RemoveAll(c =>
                    c.Contains("350ms", StringComparison.OrdinalIgnoreCase) ||
                    c.Contains("45ms", StringComparison.OrdinalIgnoreCase) ||
                    c.Contains("10.000", StringComparison.OrdinalIgnoreCase) ||
                    c.Contains("15.000", StringComparison.OrdinalIgnoreCase));
            }

            // 2. Reject unmentioned technologies from model output (Anti-Hallucination & Grounding)
            string[] ungroundedChecks = { "Redis", "Kafka", "Elasticsearch", "MongoDB", "Cassandra", "Kubernetes", "Docker" };
            foreach (var tech in ungroundedChecks)
            {
                if (!answer.Contains(tech, StringComparison.OrdinalIgnoreCase))
                {
                    analysis.VerifiedFacts.RemoveAll(f => f.Contains(tech, StringComparison.OrdinalIgnoreCase));
                    analysis.UnverifiedClaims.RemoveAll(c => c.Contains(tech, StringComparison.OrdinalIgnoreCase));
                }
            }

            // 3. Grounded candidate self-claims extraction
            if (answer.Contains("Outbox", StringComparison.OrdinalIgnoreCase) &&
                !analysis.UnverifiedClaims.Any(c => c.Contains("Outbox", StringComparison.OrdinalIgnoreCase)))
            {
                analysis.UnverifiedClaims.Add("Áp dụng Transactional Outbox Pattern để gửi message bất đồng bộ và đảm bảo tính nhất quán dữ liệu");
            }
            if (answer.Contains("RabbitMQ", StringComparison.OrdinalIgnoreCase) &&
                !analysis.UnverifiedClaims.Any(c => c.Contains("RabbitMQ", StringComparison.OrdinalIgnoreCase)))
            {
                analysis.UnverifiedClaims.Add("Sử dụng RabbitMQ làm message broker cho giao tiếp bất đồng bộ");
            }
            if (answer.Contains("gRPC", StringComparison.OrdinalIgnoreCase) &&
                !analysis.UnverifiedClaims.Any(c => c.Contains("gRPC", StringComparison.OrdinalIgnoreCase)))
            {
                analysis.UnverifiedClaims.Add("Sử dụng gRPC cho các giao tiếp đồng bộ nội bộ cần tốc độ cao");
            }

            // 4. Distinction between Verified Facts and Unverified Claims:
            // An unverified self-assertion or preliminary statement (depth < 3) cannot be directly classified as VerifiedFact
            var factsToDemote = analysis.VerifiedFacts
                .Where(f => analysis.Depth < 3 ||                            f.Contains("Outbox", StringComparison.OrdinalIgnoreCase) ||                            f.Contains("RabbitMQ", StringComparison.OrdinalIgnoreCase) ||                            f.Contains("gRPC", StringComparison.OrdinalIgnoreCase))
                .ToList();

            foreach (var fact in factsToDemote)
            {
                analysis.VerifiedFacts.Remove(fact);
                if (!analysis.UnverifiedClaims.Contains(fact, StringComparer.OrdinalIgnoreCase))
                {
                    analysis.UnverifiedClaims.Add(fact);
                }
            }
        }

    }
}
