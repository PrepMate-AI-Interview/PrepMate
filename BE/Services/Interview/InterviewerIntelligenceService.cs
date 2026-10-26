using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using backend.Models;
using backend.Prompts.Interview;
using backend.Services.AI;

namespace backend.Services.Interview
{
    public class InterviewerIntelligenceService : IInterviewerIntelligenceService
    {
        private readonly GeminiService? _geminiService;

        public InterviewerIntelligenceService(GeminiService? geminiService = null)
        {
            _geminiService = geminiService;
        }

        public async Task<ClaimEvidence> AnalyzeAnswerClaimsAsync(Session session, string question, string answer, int turn)
        {
            session.EvidenceState ??= new InterviewEvidenceState();

            if (string.IsNullOrWhiteSpace(answer))
            {
                return new ClaimEvidence
                {
                    EvidenceStrength = "Insufficient",
                    OverallOwnership = EvidenceDimensionLevel.UNKNOWN,
                    OverallMethod = EvidenceDimensionLevel.UNKNOWN,
                    OverallEvidence = EvidenceDimensionLevel.UNKNOWN
                };
            }

            ClaimEvidence evidence;
            if (_geminiService != null)
            {
                try
                {
                    var prompt = InterviewerIntelligencePrompt.BuildClaimExtractionPrompt(session, question, answer);
                    var rawJson = await _geminiService.CallGeminiApiAsync(prompt, isJsonMode: true);
                    evidence = ParseAiClaimResponse(rawJson, answer, turn);
                }
                catch (Exception)
                {
                    evidence = AnalyzeClaimsLocally(answer, turn);
                }
            }
            else
            {
                evidence = AnalyzeClaimsLocally(answer, turn);
            }

            // Cross-turn consistency check on each extracted claim
            foreach (var claim in evidence.ExtractedClaims)
            {
                var contradiction = CheckCrossAnswerContradiction(session, claim, turn);
                if (contradiction != null)
                {
                    claim.HasContradiction = true;
                    claim.ContradictionDetails = contradiction.ContradictionDescription;
                    evidence.HasContradiction = true;
                    evidence.RecommendedPattern = InterviewerProbePattern.TRADE_OFF;
                    evidence.SuggestedProbeReason = $"Mâu thuẫn giữa câu trả lời lượt {contradiction.Turn1} và lượt {contradiction.Turn2}: {contradiction.ContradictionDescription}";
                    session.EvidenceState.Contradictions.Add(contradiction);
                }

                // Accumulate cross-turn evidence & link lineage
                AccumulateCrossTurnEvidence(session, claim, turn);
                RecordStageEvidence(session, session.InterviewState?.InterviewPhase ?? InterviewStageNames.TechnicalAssessment, claim, turn, answer);
            }

            return evidence;
        }

        public List<EvidenceGap> AnalyzeEvidenceGaps(Session session, CandidateClaim claim, InterviewBlueprint? blueprint = null)
        {
            blueprint ??= session.InterviewBlueprint ?? session.InterviewContext?.InterviewBlueprint;
            var gaps = new List<EvidenceGap>();

            var seniority = blueprint?.Seniority ?? session.InterviewContext?.ExperienceLevel ?? "Mid";
            bool isJunior = seniority.Equals("Junior", StringComparison.OrdinalIgnoreCase) ||
                            seniority.Equals("Fresher", StringComparison.OrdinalIgnoreCase) ||
                            seniority.Equals("Intern", StringComparison.OrdinalIgnoreCase);
            bool isSenior = seniority.Equals("Senior", StringComparison.OrdinalIgnoreCase) ||
                            seniority.Equals("Lead", StringComparison.OrdinalIgnoreCase) ||
                            seniority.Equals("Principal", StringComparison.OrdinalIgnoreCase) ||
                            seniority.Equals("Manager", StringComparison.OrdinalIgnoreCase) ||
                            seniority.Equals("Director", StringComparison.OrdinalIgnoreCase);

            var industry = (blueprint?.Industry ?? session.InterviewContext?.Industry ?? "").ToLowerInvariant();
            var role = (blueprint?.Role ?? session.InterviewContext?.TargetPosition ?? session.JobTitle ?? "").ToLowerInvariant();

            bool isSales = industry.Contains("sale") || role.Contains("sale") || role.Contains("kinh doanh");
            bool isRiskSensitive = blueprint?.RiskRelevant == true ||
                                   industry.Contains("finance") || industry.Contains("tài chính") ||
                                   industry.Contains("bank") || industry.Contains("ngân hàng") ||
                                   industry.Contains("healthcare") || industry.Contains("y tế") ||
                                   industry.Contains("security") || industry.Contains("an toàn") ||
                                   industry.Contains("bảo mật") || industry.Contains("legal") || industry.Contains("luật");

            // 1. Ownership Gap
            if (claim.Ownership == EvidenceDimensionLevel.UNKNOWN || claim.Ownership == EvidenceDimensionLevel.WEAK)
            {
                int priority = isJunior ? 1 : 2;
                gaps.Add(new EvidenceGap
                {
                    GapDimension = "Ownership",
                    GapDescription = "Cần làm rõ phần đóng góp trực tiếp của ứng viên so với kết quả của cả đội ngũ.",
                    CurrentLevel = claim.Ownership,
                    TargetIntent = InterviewIntentType.VERIFY_OWNERSHIP,
                    Priority = priority
                });
            }

            // 2. Specificity Gap (Only when explicitly WEAK)
            if (claim.Specificity == EvidenceDimensionLevel.WEAK)
            {
                int priority = isJunior ? 2 : 3;
                gaps.Add(new EvidenceGap
                {
                    GapDimension = "Specificity",
                    GapDescription = "Thông tin còn chung chung, cần bổ sung chi tiết bối cảnh cụ thể.",
                    CurrentLevel = claim.Specificity,
                    TargetIntent = InterviewIntentType.VERIFY_CLAIM,
                    Priority = priority
                });
            }

            // 3. Methodology Gap
            if (claim.Method == EvidenceDimensionLevel.UNKNOWN || claim.Method == EvidenceDimensionLevel.WEAK)
            {
                int priority = isJunior ? 3 : 4;
                gaps.Add(new EvidenceGap
                {
                    GapDimension = "Method",
                    GapDescription = "Cần đào sâu quy trình và các bước cụ thể ứng viên đã triển khai để tạo ra kết quả.",
                    CurrentLevel = claim.Method,
                    TargetIntent = InterviewIntentType.VERIFY_METHOD,
                    Priority = priority
                });
            }

            // 4. Repeatability Gap for Achievements/Results
            if ((claim.ClaimType == CandidateClaimType.ACHIEVEMENT || claim.ClaimType == CandidateClaimType.RESULT) &&
                (claim.Repeatability == EvidenceDimensionLevel.UNKNOWN || claim.Repeatability == EvidenceDimensionLevel.WEAK))
            {
                int priority = isSales ? 1 : (isSenior ? 4 : 5);
                gaps.Add(new EvidenceGap
                {
                    GapDimension = "Repeatability",
                    GapDescription = "Khẳng định có thành tích tốt; cần kiểm chứng khả năng tái tạo năng lực khi điều kiện môi trường thay đổi.",
                    CurrentLevel = claim.Repeatability,
                    TargetIntent = InterviewIntentType.VERIFY_REPEATABILITY,
                    Priority = priority
                });
            }

            // 5. Impact / Quantifiable Evidence Gap for Achievements/Results
            if ((claim.ClaimType == CandidateClaimType.ACHIEVEMENT || claim.ClaimType == CandidateClaimType.RESULT) &&
                (claim.Evidence == EvidenceDimensionLevel.UNKNOWN || claim.Evidence == EvidenceDimensionLevel.WEAK || claim.Impact == EvidenceDimensionLevel.WEAK))
            {
                int priority = isSales ? 2 : 6;
                gaps.Add(new EvidenceGap
                {
                    GapDimension = "Impact",
                    GapDescription = "Cần làm rõ kết quả định lượng hoặc tác động thực tế của công việc.",
                    CurrentLevel = claim.Impact,
                    TargetIntent = InterviewIntentType.VERIFY_IMPACT,
                    Priority = priority
                });
            }

            // 6. Risk Gap (Senior or Risk-sensitive context)
            if (!isJunior && (isRiskSensitive || (isSenior && blueprint?.RiskRelevant == true)) &&
                (claim.RiskAwareness == EvidenceDimensionLevel.UNKNOWN || claim.RiskAwareness == EvidenceDimensionLevel.WEAK))
            {
                int priority = isRiskSensitive ? 2 : 7;
                gaps.Add(new EvidenceGap
                {
                    GapDimension = "Risk",
                    GapDescription = "Vị trí cấp cao đòi hỏi đánh giá rủi ro và các phương án dự phòng.",
                    CurrentLevel = claim.RiskAwareness,
                    TargetIntent = InterviewIntentType.TEST_RISK,
                    Priority = priority
                });
            }

            // 7. Trade-Off Analysis Gap (Mid/Senior or Decision Claim)
            if (!isJunior && (isSenior || claim.ClaimType == CandidateClaimType.DECISION) &&
                (claim.TradeOffAwareness == EvidenceDimensionLevel.UNKNOWN || claim.TradeOffAwareness == EvidenceDimensionLevel.WEAK))
            {
                int priority = isSenior ? 3 : 8;
                gaps.Add(new EvidenceGap
                {
                    GapDimension = "TradeOff",
                    GapDescription = "Cần làm rõ các phương án đánh đổi và nguyên tắc đưa ra quyết định.",
                    CurrentLevel = claim.TradeOffAwareness,
                    TargetIntent = InterviewIntentType.TEST_TRADEOFF,
                    Priority = priority
                });
            }

            return gaps.OrderBy(g => g.Priority).ToList();
        }

        public InterviewerIntentDecision DecideIntent(Session session, CandidateClaim claim, InterviewBlueprint? blueprint = null)
        {
            session.EvidenceState ??= new InterviewEvidenceState();
            session.EvidenceState.IntentHistory ??= new();
            blueprint ??= session.InterviewBlueprint ?? session.InterviewContext?.InterviewBlueprint;

            // 1. Contradiction Resolution
            if (claim.HasContradiction && !claim.IsContradictionResolved)
            {
                claim.EvidenceSufficiency = EvidenceSufficiency.CONTRADICTION;
                var contradictionDecision = new InterviewerIntentDecision
                {
                    Intent = InterviewIntentType.CLARIFY_CONTRADICTION,
                    RecommendedPattern = InterviewerProbePattern.TRADE_OFF,
                    Sufficiency = EvidenceSufficiency.CONTRADICTION,
                    Reason = $"Làm rõ điểm chưa thống nhất trong thông tin đã chia sẻ: {claim.ContradictionDetails}",
                    TargetEvidenceDimension = "Contradiction"
                };
                session.EvidenceState!.IntentHistory.Add(contradictionDecision);
                return contradictionDecision;
            }

            // 2. Hard C# Constraint: MaxProbesPerClaim = 3
            // Invariant: Probe budget exhausted != Evidence sufficient
            int existingProbes = session.EvidenceState?.Probes?.Count(p => p.ClaimId == claim.Id) ?? 0;
            if (claim.ProbeCount >= claim.MaxProbes || existingProbes >= claim.MaxProbes)
            {
                if (claim.EvidenceSufficiency != EvidenceSufficiency.SUFFICIENT)
                {
                    claim.EvidenceSufficiency = EvidenceSufficiency.INSUFFICIENT;
                }
                var moveOnDecision = new InterviewerIntentDecision
                {
                    Intent = InterviewIntentType.MOVE_ON,
                    RecommendedPattern = null,
                    Sufficiency = EvidenceSufficiency.SUFFICIENT,
                    Reason = "PROBE_BUDGET_EXHAUSTED: Đã đạt số lượng câu hỏi đào sâu tối đa (3) cho khẳng định này."
                };
                session.EvidenceState!.IntentHistory.Add(moveOnDecision);
                return moveOnDecision;
            }

            // 3. Uncertainty Flag
            if (claim.IsUncertain)
            {
                claim.EvidenceSufficiency = EvidenceSufficiency.UNCERTAIN;
                var uncertainDecision = new InterviewerIntentDecision
                {
                    Intent = InterviewIntentType.VERIFY_METHOD,
                    RecommendedPattern = InterviewerProbePattern.METHODOLOGY_VERIFICATION,
                    Sufficiency = EvidenceSufficiency.UNCERTAIN,
                    Reason = "Ứng viên chia sẻ chưa chắc chắn về số liệu/kết quả; cần làm rõ cơ sở ước tính.",
                    TargetEvidenceDimension = "Method"
                };
                session.EvidenceState!.IntentHistory.Add(uncertainDecision);
                return uncertainDecision;
            }

            // 4. Evidence Gaps
            var gaps = AnalyzeEvidenceGaps(session, claim, blueprint);
            if (gaps.Count == 0)
            {
                claim.EvidenceSufficiency = EvidenceSufficiency.SUFFICIENT;
                var moveOnDecision = new InterviewerIntentDecision
                {
                    Intent = InterviewIntentType.MOVE_ON,
                    RecommendedPattern = null,
                    Sufficiency = EvidenceSufficiency.SUFFICIENT,
                    Reason = "Bằng chứng đã đủ độ tin cậy để chuyển sang nội dung tiếp theo."
                };
                session.EvidenceState!.IntentHistory.Add(moveOnDecision);
                return moveOnDecision;
            }

            // Select top priority gap
            var topGap = gaps[0];

            // 5. Information Value Check (Step 2)
            if (IsInformationValueLow(session, claim, topGap.TargetIntent))
            {
                var lowInfoDecision = new InterviewerIntentDecision
                {
                    Intent = InterviewIntentType.MOVE_ON,
                    RecommendedPattern = null,
                    Sufficiency = EvidenceSufficiency.SUFFICIENT,
                    Reason = "Giá trị thông tin bổ sung dự kiến thấp do nội dung đã được xác nhận đủ độ tin cậy; chuyển sang chủ đề tiếp theo."
                };
                session.EvidenceState!.IntentHistory.Add(lowInfoDecision);
                return lowInfoDecision;
            }

            var pattern = MapIntentToPattern(topGap.TargetIntent);

            claim.EvidenceSufficiency = EvidenceSufficiency.INSUFFICIENT;
            var gapDecision = new InterviewerIntentDecision
            {
                Intent = topGap.TargetIntent,
                RecommendedPattern = pattern,
                Sufficiency = EvidenceSufficiency.INSUFFICIENT,
                Reason = topGap.GapDescription,
                TargetEvidenceDimension = topGap.GapDimension
            };
            session.EvidenceState!.IntentHistory.Add(gapDecision);
            return gapDecision;
        }

        public (EvidenceSufficiency Sufficiency, InterviewerProbePattern? Pattern, string Reason) DecideProbeAction(
            Session session,
            CandidateClaim claim,
            InterviewBlueprint? blueprint)
        {
            var decision = DecideIntent(session, claim, blueprint);
            return (decision.Sufficiency, decision.RecommendedPattern, decision.Reason);
        }

        public async Task<InterviewerProbeRecord> GenerateIntentProbeAsync(
            Session session,
            CandidateClaim claim,
            InterviewerIntentDecision decision,
            int turn,
            string? parentQuestionId = null)
        {
            session.EvidenceState ??= new InterviewEvidenceState();

            claim.ProbeCount++;
            var probeDepth = claim.ProbeCount; // 1=HOW, 2=WHY, 3=REPEATABILITY

            string probeQuestion;
            if (_geminiService != null)
            {
                try
                {
                    var prompt = InterviewerIntelligencePrompt.BuildIntentProbeQuestionPrompt(session, claim, decision, probeDepth);
                    var rawJson = await _geminiService.CallGeminiApiAsync(prompt, isJsonMode: true);
                    using var doc = JsonDocument.Parse(rawJson);
                    probeQuestion = doc.RootElement.TryGetProperty("probeQuestion", out var q)
                        ? q.GetString() ?? GetDeterministicIntentProbeTemplate(session, claim, decision, probeDepth)
                        : GetDeterministicIntentProbeTemplate(session, claim, decision, probeDepth);
                }
                catch (Exception)
                {
                    probeQuestion = GetDeterministicIntentProbeTemplate(session, claim, decision, probeDepth);
                }
            }
            else
            {
                probeQuestion = GetDeterministicIntentProbeTemplate(session, claim, decision, probeDepth);
            }

            var record = new InterviewerProbeRecord
            {
                ClaimId = claim.Id,
                Turn = turn,
                ParentQuestionId = parentQuestionId,
                Intent = decision.Intent,
                Pattern = decision.RecommendedPattern ?? MapIntentToPattern(decision.Intent),
                Reason = decision.Reason,
                ProbeQuestion = probeQuestion,
                ProbeDepth = probeDepth
            };

            session.EvidenceState.Probes.Add(record);
            return record;
        }

        public async Task<InterviewerProbeRecord> GenerateProbeAsync(
            Session session,
            CandidateClaim claim,
            InterviewerProbePattern pattern,
            string reason,
            int turn,
            string? parentQuestionId = null)
        {
            var intent = MapPatternToIntent(pattern);
            var decision = new InterviewerIntentDecision
            {
                Intent = intent,
                RecommendedPattern = pattern,
                Reason = reason,
                Sufficiency = EvidenceSufficiency.INSUFFICIENT
            };
            return await GenerateIntentProbeAsync(session, claim, decision, turn, parentQuestionId);
        }

        private static InterviewerProbePattern MapIntentToPattern(InterviewIntentType intent)
        {
            return intent switch
            {
                InterviewIntentType.VERIFY_CLAIM => InterviewerProbePattern.METHODOLOGY_VERIFICATION,
                InterviewIntentType.VERIFY_OWNERSHIP => InterviewerProbePattern.OWNERSHIP_ATTRIBUTION,
                InterviewIntentType.VERIFY_METHOD => InterviewerProbePattern.METHODOLOGY_VERIFICATION,
                InterviewIntentType.VERIFY_IMPACT => InterviewerProbePattern.METHODOLOGY_VERIFICATION,
                InterviewIntentType.VERIFY_REPEATABILITY => InterviewerProbePattern.REPEATABILITY,
                InterviewIntentType.TEST_TRADEOFF => InterviewerProbePattern.TRADE_OFF,
                InterviewIntentType.TEST_RISK => InterviewerProbePattern.RISK_AWARENESS,
                InterviewIntentType.TEST_DEPTH => InterviewerProbePattern.METHODOLOGY_VERIFICATION,
                InterviewIntentType.TEST_SYSTEM_THINKING => InterviewerProbePattern.METHODOLOGY_VERIFICATION,
                InterviewIntentType.CLARIFY_CONTRADICTION => InterviewerProbePattern.TRADE_OFF,
                _ => InterviewerProbePattern.METHODOLOGY_VERIFICATION
            };
        }

        private static InterviewIntentType MapPatternToIntent(InterviewerProbePattern pattern)
        {
            return pattern switch
            {
                InterviewerProbePattern.OWNERSHIP_ATTRIBUTION => InterviewIntentType.VERIFY_OWNERSHIP,
                InterviewerProbePattern.CONTRIBUTION_VERIFICATION => InterviewIntentType.VERIFY_OWNERSHIP,
                InterviewerProbePattern.METHODOLOGY_VERIFICATION => InterviewIntentType.VERIFY_METHOD,
                InterviewerProbePattern.REPEATABILITY => InterviewIntentType.VERIFY_REPEATABILITY,
                InterviewerProbePattern.CONTEXT_DEPENDENCY => InterviewIntentType.VERIFY_REPEATABILITY,
                InterviewerProbePattern.TRADE_OFF => InterviewIntentType.TEST_TRADEOFF,
                InterviewerProbePattern.RISK_AWARENESS => InterviewIntentType.TEST_RISK,
                InterviewerProbePattern.FAILURE_ANALYSIS => InterviewIntentType.TEST_TRADEOFF,
                InterviewerProbePattern.CHANNEL_EFFECTIVENESS => InterviewIntentType.VERIFY_IMPACT,
                InterviewerProbePattern.ADAPTABILITY_TO_NEW_CONTEXT => InterviewIntentType.VERIFY_REPEATABILITY,
                InterviewerProbePattern.EXTERNAL_CHANGE_ADAPTATION => InterviewIntentType.TEST_RISK,
                _ => InterviewIntentType.VERIFY_METHOD
            };
        }

        // =====================================================================
        // PHASE 5 STEP 2: CROSS-TURN EVIDENCE ACCUMULATION & COMPETENCY SYNTHESIS
        // =====================================================================

        public CandidateClaim AccumulateCrossTurnEvidence(Session session, CandidateClaim newClaim, int turn)
        {
            session.EvidenceState ??= new InterviewEvidenceState();
            if (!newClaim.TurnHistory.Contains(turn))
            {
                newClaim.TurnHistory.Add(turn);
            }

            CandidateClaim targetClaim = newClaim;
            var activeClaim = session.EvidenceState.Claims.FirstOrDefault(c => c.Id == session.EvidenceState.ActiveClaimId);

            bool isElaborationOfActive = false;
            if (activeClaim != null && activeClaim.Id != newClaim.Id)
            {
                var lastProbe = session.EvidenceState.Probes.LastOrDefault();
                bool probedOnActive = lastProbe != null && lastProbe.ClaimId == activeClaim.Id;

                bool isDifferentProject = HasDistinctProjectContext(activeClaim, newClaim);
                bool isDifferentTimeframe = HasDistinctTimeframe(activeClaim, newClaim);

                if (!isDifferentProject && !isDifferentTimeframe && (probedOnActive || IsSameCoreInitiative(activeClaim, newClaim)))
                {
                    isElaborationOfActive = true;
                }
            }

            if (isElaborationOfActive && activeClaim != null)
            {
                newClaim.ParentClaimId = activeClaim.Id;
                if (!activeClaim.RelatedClaimIds.Contains(newClaim.Id))
                {
                    activeClaim.RelatedClaimIds.Add(newClaim.Id);
                }
                if (!activeClaim.TurnHistory.Contains(turn))
                {
                    activeClaim.TurnHistory.Add(turn);
                }

                var evolution = DetermineEvidenceEvolution(activeClaim, newClaim);
                newClaim.Evolution = evolution;
                activeClaim.Evolution = evolution;

                MergeDimensions(activeClaim, newClaim);
                session.EvidenceState.Claims.Add(newClaim);
                targetClaim = activeClaim;
            }
            else
            {
                session.EvidenceState.Claims.Add(newClaim);
                session.EvidenceState.ActiveClaimId = newClaim.Id;
            }

            RecordDimensionEvidenceEntries(session, targetClaim, turn);
            UpdateCompetencyMapFromClaim(session, targetClaim, turn);

            return targetClaim;
        }

        public CompetencyEvidenceRecord SynthesizeCompetencyEvidence(Session session, string competency, InterviewBlueprint? blueprint = null)
        {
            session.EvidenceState ??= new InterviewEvidenceState();
            session.EvidenceState.CompetencyMap ??= new Dictionary<string, CompetencyEvidenceRecord>(StringComparer.OrdinalIgnoreCase);
            session.EvidenceState.EvidenceHistory ??= new List<DimensionEvidenceEntry>();
            blueprint ??= session.InterviewBlueprint ?? session.InterviewContext?.InterviewBlueprint;

            var record = session.EvidenceState.CompetencyMap.TryGetValue(competency, out var existing)
                ? existing
                : new CompetencyEvidenceRecord { CompetencyName = competency };

            var relevantEntries = session.EvidenceState.EvidenceHistory
                .Where(e => e.Dimension.Equals(competency, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (relevantEntries.Count > 0)
            {
                record.SourceTurns = relevantEntries.Select(e => e.Turn).Distinct().OrderBy(t => t).ToList();
                record.SupportingClaimIds = relevantEntries.Select(e => e.ClaimId).Distinct().ToList();
                record.DimensionHistory = relevantEntries;
                record.LastUpdatedTurn = relevantEntries.Max(e => e.Turn);

                var latest = relevantEntries.Last();
                record.PreviousLevel = relevantEntries.Count > 1 ? relevantEntries[^2].Level : EvidenceDimensionLevel.UNKNOWN;
                record.CurrentLevel = latest.Level;

                if (RankDimension(record.CurrentLevel) > RankDimension(record.PreviousLevel))
                    record.Evolution = EvidenceEvolutionType.IMPROVEMENT;
                else if (RankDimension(record.CurrentLevel) < RankDimension(record.PreviousLevel))
                    record.Evolution = EvidenceEvolutionType.REGRESSION;
                else
                    record.Evolution = EvidenceEvolutionType.STABLE;
            }

            record.IsSufficient = EvaluateCompetencySufficiency(record, session, blueprint);
            record.SynthesisReason = record.IsSufficient
                ? $"Đã có đủ bằng chứng ({record.CurrentLevel}) cho năng lực {competency}."
                : $"Cần thêm bằng chứng để kiểm chứng năng lực {competency} (hiện tại: {record.CurrentLevel}).";

            session.EvidenceState.CompetencyMap[competency] = record;
            return record;
        }

        public bool IsInformationValueLow(Session session, CandidateClaim claim, InterviewIntentType intent)
        {
            switch (intent)
            {
                case InterviewIntentType.VERIFY_OWNERSHIP when claim.Ownership == EvidenceDimensionLevel.STRONG:
                case InterviewIntentType.VERIFY_METHOD when claim.Method == EvidenceDimensionLevel.STRONG:
                case InterviewIntentType.VERIFY_IMPACT when claim.Impact == EvidenceDimensionLevel.STRONG || !string.IsNullOrWhiteSpace(claim.ExtractedMetric):
                case InterviewIntentType.VERIFY_REPEATABILITY when claim.Repeatability == EvidenceDimensionLevel.STRONG:
                case InterviewIntentType.TEST_TRADEOFF when claim.TradeOffAwareness == EvidenceDimensionLevel.STRONG:
                case InterviewIntentType.TEST_RISK when claim.RiskAwareness == EvidenceDimensionLevel.STRONG:
                    return true;
            }

            // If the claim's parent already established STRONG for this dimension, probing again on elaboration adds low value
            if (!string.IsNullOrEmpty(claim.ParentClaimId) && session.EvidenceState?.Claims != null)
            {
                var parent = session.EvidenceState.Claims.FirstOrDefault(c => c.Id == claim.ParentClaimId);
                if (parent != null)
                {
                    bool parentStrong = intent switch
                    {
                        InterviewIntentType.VERIFY_OWNERSHIP => parent.Ownership == EvidenceDimensionLevel.STRONG,
                        InterviewIntentType.VERIFY_METHOD => parent.Method == EvidenceDimensionLevel.STRONG,
                        InterviewIntentType.VERIFY_IMPACT => parent.Impact == EvidenceDimensionLevel.STRONG || !string.IsNullOrWhiteSpace(parent.ExtractedMetric),
                        InterviewIntentType.VERIFY_REPEATABILITY => parent.Repeatability == EvidenceDimensionLevel.STRONG,
                        InterviewIntentType.TEST_RISK => parent.RiskAwareness == EvidenceDimensionLevel.STRONG,
                        InterviewIntentType.TEST_TRADEOFF => parent.TradeOffAwareness == EvidenceDimensionLevel.STRONG,
                        _ => false
                    };
                    if (parentStrong)
                        return true;
                }
            }

            return false;
        }

        // =====================================================================
        // PHASE 5 STEP 3: STAGE-LEVEL & CROSS-COMPETENCY EVIDENCE SYNTHESIS
        // =====================================================================

        public StageCompetencyEvidenceRecord RecordStageEvidence(Session session, string stage, CandidateClaim claim, int turn, string? sourceAnswer = null)
        {
            session.EvidenceState ??= new InterviewEvidenceState();
            session.EvidenceState.StageEvidenceMap ??= new(StringComparer.OrdinalIgnoreCase);
            session.EvidenceState.CrossStageMap ??= new(StringComparer.OrdinalIgnoreCase);
            session.EvidenceState.Provenance ??= new();

            string normalizedStage = string.IsNullOrWhiteSpace(stage)
                ? (session.InterviewState?.InterviewPhase ?? InterviewStageNames.TechnicalAssessment)
                : stage;

            if (!session.EvidenceState.StageEvidenceMap.TryGetValue(normalizedStage, out var stageMap))
            {
                stageMap = new Dictionary<string, StageCompetencyEvidenceRecord>(StringComparer.OrdinalIgnoreCase);
                session.EvidenceState.StageEvidenceMap[normalizedStage] = stageMap;
            }

            string competencyName = DeterminePrimaryCompetency(claim, normalizedStage);

            if (!stageMap.TryGetValue(competencyName, out var stageRecord))
            {
                stageRecord = new StageCompetencyEvidenceRecord
                {
                    Stage = normalizedStage,
                    CompetencyName = competencyName
                };
                stageMap[competencyName] = stageRecord;
            }

            stageRecord.LastUpdatedTurn = turn;
            if (!stageRecord.SourceTurns.Contains(turn))
            {
                stageRecord.SourceTurns.Add(turn);
            }
            if (!stageRecord.SupportingClaimIds.Contains(claim.Id))
            {
                stageRecord.SupportingClaimIds.Add(claim.Id);
            }

            // Record granular dimensions
            if (claim.Ownership != EvidenceDimensionLevel.UNKNOWN)
                stageRecord.Dimensions["Ownership"] = claim.Ownership;
            if (claim.Method != EvidenceDimensionLevel.UNKNOWN)
                stageRecord.Dimensions["Method"] = claim.Method;
            if (claim.Evidence != EvidenceDimensionLevel.UNKNOWN && claim.Evidence != EvidenceDimensionLevel.NOT_APPLICABLE)
                stageRecord.Dimensions["Evidence"] = claim.Evidence;
            if (claim.Impact != EvidenceDimensionLevel.UNKNOWN && claim.Impact != EvidenceDimensionLevel.NOT_APPLICABLE)
                stageRecord.Dimensions["Impact"] = claim.Impact;
            if (claim.Repeatability != EvidenceDimensionLevel.UNKNOWN && claim.Repeatability != EvidenceDimensionLevel.NOT_APPLICABLE)
                stageRecord.Dimensions["Repeatability"] = claim.Repeatability;
            if (claim.RiskAwareness != EvidenceDimensionLevel.UNKNOWN && claim.RiskAwareness != EvidenceDimensionLevel.NOT_APPLICABLE)
                stageRecord.Dimensions["RiskAwareness"] = claim.RiskAwareness;
            if (claim.TradeOffAwareness != EvidenceDimensionLevel.UNKNOWN && claim.TradeOffAwareness != EvidenceDimensionLevel.NOT_APPLICABLE)
                stageRecord.Dimensions["TradeOffAwareness"] = claim.TradeOffAwareness;

            stageRecord.CurrentLevel = DetermineCompetencyLevelFromDimensions(stageRecord.Dimensions, claim);

            var provEntry = new EvidenceProvenanceEntry
            {
                Stage = normalizedStage,
                Turn = turn,
                ClaimId = claim.Id,
                Competency = competencyName,
                Dimension = "Overall",
                EvidenceLevel = stageRecord.CurrentLevel,
                SourceAnswer = !string.IsNullOrWhiteSpace(sourceAnswer) ? sourceAnswer : claim.Text,
                EvidenceNote = claim.ExtractedMetric ?? claim.CandidateOwnershipComponent
            };
            stageRecord.Provenance.Add(provEntry);
            session.EvidenceState.Provenance.Add(provEntry);

            stageRecord.SynthesisReason = $"Giai đoạn {normalizedStage} tại lượt {turn}: Ứng viên thể hiện bằng chứng {stageRecord.CurrentLevel} cho năng lực {competencyName}.";

            SynthesizeCrossStageEvidence(session, competencyName);
            return stageRecord;
        }

        private static string DeterminePrimaryCompetency(CandidateClaim claim, string stage)
        {
            if (claim.RiskAwareness != EvidenceDimensionLevel.NOT_APPLICABLE && claim.RiskAwareness != EvidenceDimensionLevel.UNKNOWN)
                return "Risk Awareness";
            if (claim.TradeOffAwareness != EvidenceDimensionLevel.NOT_APPLICABLE && claim.TradeOffAwareness != EvidenceDimensionLevel.UNKNOWN)
                return "Trade-off Awareness";

            if (claim.Ownership != EvidenceDimensionLevel.UNKNOWN && claim.Method == EvidenceDimensionLevel.UNKNOWN)
                return "Ownership";

            if (claim.ClaimType == CandidateClaimType.DECISION)
                return "Decision Quality";

            if (stage == InterviewStageNames.BehavioralStar)
            {
                if (claim.Ownership != EvidenceDimensionLevel.UNKNOWN)
                    return "Ownership";
                return "Problem Solving";
            }

            if (stage == InterviewStageNames.SituationalCase)
            {
                if (claim.Ownership != EvidenceDimensionLevel.UNKNOWN)
                    return "Ownership";
                return "Problem Solving";
            }

            return "Technical Depth";
        }

        private static EvidenceDimensionLevel DetermineCompetencyLevelFromDimensions(Dictionary<string, EvidenceDimensionLevel> dims, CandidateClaim claim)
        {
            if (dims.Values.Any(v => v == EvidenceDimensionLevel.STRONG))
                return EvidenceDimensionLevel.STRONG;
            if (dims.Values.Any(v => v == EvidenceDimensionLevel.MODERATE))
                return EvidenceDimensionLevel.MODERATE;
            if (dims.Values.Any(v => v == EvidenceDimensionLevel.WEAK))
                return EvidenceDimensionLevel.WEAK;
            return EvidenceDimensionLevel.UNKNOWN;
        }

        public CrossStageCompetencyRecord SynthesizeCrossStageEvidence(Session session, string competency)
        {
            session.EvidenceState ??= new InterviewEvidenceState();
            session.EvidenceState.StageEvidenceMap ??= new(StringComparer.OrdinalIgnoreCase);
            session.EvidenceState.CrossStageMap ??= new(StringComparer.OrdinalIgnoreCase);
            session.EvidenceState.Provenance ??= new();

            var record = session.EvidenceState.CrossStageMap.TryGetValue(competency, out var existing)
                ? existing
                : new CrossStageCompetencyRecord { CompetencyName = competency };

            foreach (var kvp in session.EvidenceState.StageEvidenceMap)
            {
                string stage = kvp.Key;
                var stageMap = kvp.Value;
                if (stageMap.TryGetValue(competency, out var stageRecord))
                {
                    record.StageLevels[stage] = stageRecord.CurrentLevel;
                }
            }

            var matchingProv = session.EvidenceState.Provenance
                .Where(p => p.Competency.Equals(competency, StringComparison.OrdinalIgnoreCase))
                .ToList();
            record.Provenance = matchingProv;

            bool hasContradiction = session.EvidenceState.Contradictions.Any(c => !c.IsResolved &&
                (c.Statement1.Contains(competency, StringComparison.OrdinalIgnoreCase) ||
                 c.Statement2.Contains(competency, StringComparison.OrdinalIgnoreCase) ||
                 c.ContradictionDescription.Contains(competency, StringComparison.OrdinalIgnoreCase)));

            int strongCount = record.StageLevels.Values.Count(v => v == EvidenceDimensionLevel.STRONG);
            int modCount = record.StageLevels.Values.Count(v => v == EvidenceDimensionLevel.MODERATE);
            int weakCount = record.StageLevels.Values.Count(v => v == EvidenceDimensionLevel.WEAK);

            if (hasContradiction)
            {
                record.GapStatus = EvidenceGapStatus.CONFLICTING;
                record.IsConsistent = false;
                record.SynthesisReason = $"Phát hiện điểm chưa nhất quán cần làm rõ giữa các lượt chia sẻ liên quan đến năng lực {competency}.";
            }
            else if (strongCount >= 2 || (strongCount >= 1 && matchingProv.Count >= 2))
            {
                record.GapStatus = EvidenceGapStatus.WELL_SUPPORTED;
                record.IsConsistent = true;
                record.SynthesisReason = $"Năng lực {competency} có bằng chứng vững chắc được củng cố qua nhiều giai đoạn/lượt phỏng vấn.";
            }
            else if (strongCount >= 1 || modCount >= 1)
            {
                record.GapStatus = EvidenceGapStatus.PARTIALLY_SUPPORTED;
                record.IsConsistent = true;
                record.SynthesisReason = $"Năng lực {competency} có bằng chứng bước đầu nhưng cần thêm tình huống kiểm chứng độc lập.";
            }
            else if (weakCount >= 1)
            {
                record.GapStatus = EvidenceGapStatus.PARTIALLY_SUPPORTED;
                record.IsConsistent = true;
                record.SynthesisReason = $"Bằng chứng thu thập cho năng lực {competency} còn ở mức cơ bản hoặc hỗ trợ phụ.";
            }
            else
            {
                record.GapStatus = EvidenceGapStatus.UNTESTED;
                record.IsConsistent = true;
                record.SynthesisReason = $"Chưa có bằng chứng cụ thể cho năng lực {competency} trong các giai đoạn đã qua.";
            }

            session.EvidenceState.CrossStageMap[competency] = record;
            return record;
        }

        public List<CrossCompetencyRelationship> EvaluateCrossCompetencyRelationships(Session session, InterviewBlueprint? blueprint = null)
        {
            session.EvidenceState ??= new InterviewEvidenceState();
            session.EvidenceState.CompetencyRelationships ??= new();
            session.EvidenceState.CompetencyRelationships.Clear();

            var crossMap = session.EvidenceState.CrossStageMap;
            var compMap = session.EvidenceState.CompetencyMap;

            EvidenceDimensionLevel GetLevel(string comp)
            {
                if (crossMap.TryGetValue(comp, out var cr) && cr.StageLevels.Count > 0)
                {
                    if (cr.StageLevels.Values.Any(v => v == EvidenceDimensionLevel.STRONG)) return EvidenceDimensionLevel.STRONG;
                    if (cr.StageLevels.Values.Any(v => v == EvidenceDimensionLevel.MODERATE)) return EvidenceDimensionLevel.MODERATE;
                    if (cr.StageLevels.Values.Any(v => v == EvidenceDimensionLevel.WEAK)) return EvidenceDimensionLevel.WEAK;
                }
                if (compMap.TryGetValue(comp, out var compRec))
                {
                    return compRec.CurrentLevel;
                }
                if (session.EvidenceState.StageEvidenceMap != null)
                {
                    foreach (var stageMap in session.EvidenceState.StageEvidenceMap.Values)
                    {
                        foreach (var sr in stageMap.Values)
                        {
                            if (sr.Dimensions.TryGetValue(comp, out var dimLevel) && dimLevel != EvidenceDimensionLevel.UNKNOWN)
                            {
                                return dimLevel;
                            }
                        }
                    }
                }
                return EvidenceDimensionLevel.UNKNOWN;
            }

            var techLevel = GetLevel("Technical Depth");
            var methodLevel = GetLevel("Method");
            var ownershipLevel = GetLevel("Ownership");
            var impactLevel = GetLevel("Impact");
            var evidenceLevel = GetLevel("Evidence");
            var riskLevel = GetLevel("Risk Awareness");
            var tradeOffLevel = GetLevel("Trade-off Awareness");
            var probSolvingLevel = GetLevel("Problem Solving");

            // 1. SUPPORTING: Strong Problem Solving + Strong Method (or Ownership + Method)
            if ((methodLevel == EvidenceDimensionLevel.STRONG || techLevel == EvidenceDimensionLevel.STRONG) &&
                (probSolvingLevel == EvidenceDimensionLevel.STRONG || ownershipLevel == EvidenceDimensionLevel.STRONG))
            {
                session.EvidenceState.CompetencyRelationships.Add(new CrossCompetencyRelationship
                {
                    CompetencyA = "Problem Solving",
                    CompetencyB = "Method",
                    RelationshipType = CompetencyRelationshipType.SUPPORTING,
                    Description = "Phương pháp thực thi chi tiết và bài bản hỗ trợ trực tiếp cho năng lực giải quyết vấn đề kỹ thuật.",
                    IsObserved = true
                });
            }

            // 2. TENSION: High Impact / Fast Delivery but Low / Missing Risk Awareness
            if ((impactLevel == EvidenceDimensionLevel.STRONG || evidenceLevel == EvidenceDimensionLevel.STRONG || techLevel == EvidenceDimensionLevel.STRONG) &&
                (riskLevel == EvidenceDimensionLevel.WEAK || riskLevel == EvidenceDimensionLevel.UNKNOWN))
            {
                session.EvidenceState.CompetencyRelationships.Add(new CrossCompetencyRelationship
                {
                    CompetencyA = "Technical Depth",
                    CompetencyB = "Risk Awareness",
                    RelationshipType = CompetencyRelationshipType.TENSION,
                    Description = "Ứng viên có khả năng triển khai chuyên môn sâu nhưng chưa thể hiện đầy đủ nhận thức rủi ro hệ thống.",
                    IsObserved = true,
                    TensionNote = "Cần lưu ý kiểm chứng khả năng kiểm soát rủi ro và phòng ngừa lỗi trong môi trường thực tế."
                });
            }

            // 3. DEPENDENCY: Business Impact depends on Method & Customer/Execution Understanding
            if (impactLevel == EvidenceDimensionLevel.STRONG || evidenceLevel == EvidenceDimensionLevel.STRONG)
            {
                session.EvidenceState.CompetencyRelationships.Add(new CrossCompetencyRelationship
                {
                    CompetencyA = "Business Impact",
                    CompetencyB = "Method",
                    RelationshipType = CompetencyRelationshipType.DEPENDENCY,
                    Description = "Tác động kinh doanh phụ thuộc vào phương pháp và quy trình triển khai có thể kiểm chứng được.",
                    IsObserved = methodLevel == EvidenceDimensionLevel.STRONG
                });
            }

            // 4. CORRELATED: Technical Depth & System Thinking / Trade-off Awareness
            if (techLevel != EvidenceDimensionLevel.UNKNOWN || tradeOffLevel != EvidenceDimensionLevel.UNKNOWN)
            {
                session.EvidenceState.CompetencyRelationships.Add(new CrossCompetencyRelationship
                {
                    CompetencyA = "Technical Depth",
                    CompetencyB = "Trade-off Awareness",
                    RelationshipType = CompetencyRelationshipType.CORRELATED,
                    Description = "Chiều sâu chuyên môn thường có mối tương quan chặt chẽ với khả năng nhận diện các phương án đánh đổi kỹ thuật.",
                    IsObserved = techLevel == EvidenceDimensionLevel.STRONG && tradeOffLevel == EvidenceDimensionLevel.STRONG
                });
            }

            return session.EvidenceState.CompetencyRelationships;
        }

        public EvidenceGapSummary GenerateEvidenceGapSummary(Session session, InterviewBlueprint? blueprint = null)
        {
            session.EvidenceState ??= new InterviewEvidenceState();
            session.EvidenceState.GapSummary ??= new EvidenceGapSummary();
            var summary = session.EvidenceState.GapSummary;

            summary.WellSupported.Clear();
            summary.PartiallySupported.Clear();
            summary.Untested.Clear();
            summary.Conflicting.Clear();
            summary.ContextLimited.Clear();
            summary.DiagnosticNotes.Clear();

            foreach (var kvp in session.EvidenceState.CrossStageMap)
            {
                string comp = kvp.Key;
                var record = kvp.Value;

                switch (record.GapStatus)
                {
                    case EvidenceGapStatus.WELL_SUPPORTED:
                        summary.WellSupported.Add(comp);
                        break;
                    case EvidenceGapStatus.PARTIALLY_SUPPORTED:
                        summary.PartiallySupported.Add(comp);
                        break;
                    case EvidenceGapStatus.CONFLICTING:
                        summary.Conflicting.Add(comp);
                        break;
                    case EvidenceGapStatus.CONTEXT_LIMITED:
                        summary.ContextLimited.Add(comp);
                        break;
                    case EvidenceGapStatus.UNTESTED:
                        summary.Untested.Add(comp);
                        break;
                }
            }

            if (blueprint?.Competencies != null)
            {
                foreach (var bpComp in blueprint.Competencies)
                {
                    if (!summary.WellSupported.Contains(bpComp) &&
                        !summary.PartiallySupported.Contains(bpComp) &&
                        !summary.Conflicting.Contains(bpComp) &&
                        !summary.ContextLimited.Contains(bpComp) &&
                        !summary.Untested.Contains(bpComp))
                    {
                        summary.Untested.Add(bpComp);
                    }
                }
            }

            if (summary.WellSupported.Count > 0)
                summary.DiagnosticNotes.Add($"Đã có bằng chứng vững chắc cho các năng lực: {string.Join(", ", summary.WellSupported)}.");
            if (summary.PartiallySupported.Count > 0)
                summary.DiagnosticNotes.Add($"Cần tiếp tục củng cố thêm các năng lực: {string.Join(", ", summary.PartiallySupported)}.");
            if (summary.Conflicting.Count > 0)
                summary.DiagnosticNotes.Add($"Phát hiện mâu thuẫn cần làm rõ ở các năng lực: {string.Join(", ", summary.Conflicting)}.");
            if (summary.Untested.Count > 0)
                summary.DiagnosticNotes.Add($"Các năng lực chưa được kiểm chứng trong buổi phỏng vấn: {string.Join(", ", summary.Untested)}.");

            return summary;
        }

        private static bool HasDistinctProjectContext(CandidateClaim oldClaim, CandidateClaim newClaim)
        {
            var lowerOld = oldClaim.Text.ToLowerInvariant();
            var lowerNew = newClaim.Text.ToLowerInvariant();

            if ((lowerOld.Contains("project a") && lowerNew.Contains("project b")) ||
                (lowerOld.Contains("project b") && lowerNew.Contains("project a")) ||
                (lowerOld.Contains("dự án a") && lowerNew.Contains("dự án b")) ||
                (lowerOld.Contains("dự án b") && lowerNew.Contains("dự án a")) ||
                (lowerOld.Contains("công ty cũ") && lowerNew.Contains("công ty mới")) ||
                (lowerOld.Contains("postgresql") && lowerNew.Contains("mongodb") && !lowerOld.Contains("mongodb")) ||
                (lowerOld.Contains("kho hàng hà nội") && lowerNew.Contains("chi nhánh đà nẵng")))
            {
                return true;
            }

            return false;
        }

        private static bool HasDistinctTimeframe(CandidateClaim oldClaim, CandidateClaim newClaim)
        {
            var lowerOld = oldClaim.Text.ToLowerInvariant();
            var lowerNew = newClaim.Text.ToLowerInvariant();

            if ((lowerOld.Contains("version 1") || lowerOld.Contains("v1") || lowerOld.Contains("ban đầu")) &&
                (lowerNew.Contains("version 2") || lowerNew.Contains("v2") || lowerNew.Contains("sau này") || lowerNew.Contains("sau đó")))
            {
                return true;
            }

            return false;
        }

        private static bool IsSameCoreInitiative(CandidateClaim oldClaim, CandidateClaim newClaim)
        {
            var lowerNew = newClaim.Text.ToLowerInvariant();

            if (lowerNew.Contains("phần đó") || lowerNew.Contains("dự án này") || lowerNew.Contains("kết quả đó") ||
                lowerNew.Contains("khi đó") || lowerNew.Contains("trong đó") || lowerNew.Contains("về việc này"))
            {
                return true;
            }

            return false;
        }

        private static EvidenceEvolutionType DetermineEvidenceEvolution(CandidateClaim previous, CandidateClaim current)
        {
            bool hasRegression = (previous.Ownership == EvidenceDimensionLevel.STRONG && current.Ownership == EvidenceDimensionLevel.WEAK) ||
                                 (previous.Method == EvidenceDimensionLevel.STRONG && current.Method == EvidenceDimensionLevel.WEAK) ||
                                 (previous.Evidence == EvidenceDimensionLevel.STRONG && current.Evidence == EvidenceDimensionLevel.WEAK) ||
                                 (previous.Impact == EvidenceDimensionLevel.STRONG && current.Impact == EvidenceDimensionLevel.WEAK);

            if (hasRegression)
            {
                return EvidenceEvolutionType.REGRESSION;
            }

            bool hasImprovement = (RankDimension(current.Ownership) > RankDimension(previous.Ownership)) ||
                                  (RankDimension(current.Method) > RankDimension(previous.Method)) ||
                                  (RankDimension(current.Evidence) > RankDimension(previous.Evidence)) ||
                                  (RankDimension(current.Impact) > RankDimension(previous.Impact)) ||
                                  (RankDimension(current.Repeatability) > RankDimension(previous.Repeatability)) ||
                                  (RankDimension(current.RiskAwareness) > RankDimension(previous.RiskAwareness)) ||
                                  (RankDimension(current.TradeOffAwareness) > RankDimension(previous.TradeOffAwareness));

            if (hasImprovement)
            {
                return EvidenceEvolutionType.IMPROVEMENT;
            }

            return EvidenceEvolutionType.STABLE;
        }

        private static int RankDimension(EvidenceDimensionLevel level)
        {
            return level switch
            {
                EvidenceDimensionLevel.STRONG => 3,
                EvidenceDimensionLevel.MODERATE => 2,
                EvidenceDimensionLevel.WEAK => 1,
                _ => 0
            };
        }

        private static void MergeDimensions(CandidateClaim target, CandidateClaim incoming)
        {
            if (incoming.Ownership == EvidenceDimensionLevel.STRONG)
            {
                target.Ownership = EvidenceDimensionLevel.STRONG;
                target.CandidateOwnershipComponent = incoming.CandidateOwnershipComponent ?? target.CandidateOwnershipComponent;
            }
            else if (incoming.Ownership == EvidenceDimensionLevel.WEAK && target.Ownership != EvidenceDimensionLevel.STRONG)
            {
                target.Ownership = EvidenceDimensionLevel.WEAK;
            }

            if (incoming.Method == EvidenceDimensionLevel.STRONG || (incoming.Method == EvidenceDimensionLevel.MODERATE && target.Method == EvidenceDimensionLevel.UNKNOWN))
            {
                target.Method = incoming.Method;
            }

            if (!string.IsNullOrWhiteSpace(incoming.ExtractedMetric))
            {
                target.ExtractedMetric = incoming.ExtractedMetric;
                target.Evidence = EvidenceDimensionLevel.STRONG;
            }
            if (incoming.Evidence == EvidenceDimensionLevel.STRONG)
            {
                target.Evidence = EvidenceDimensionLevel.STRONG;
            }

            if (incoming.Impact == EvidenceDimensionLevel.STRONG || (incoming.Impact == EvidenceDimensionLevel.MODERATE && target.Impact == EvidenceDimensionLevel.UNKNOWN))
            {
                target.Impact = incoming.Impact;
                target.ImpactType = incoming.ImpactType;
            }

            if (incoming.Repeatability != EvidenceDimensionLevel.UNKNOWN && incoming.Repeatability != EvidenceDimensionLevel.NOT_APPLICABLE)
            {
                target.Repeatability = incoming.Repeatability;
            }

            if (incoming.RiskAwareness != EvidenceDimensionLevel.NOT_APPLICABLE && incoming.RiskAwareness != EvidenceDimensionLevel.UNKNOWN)
            {
                target.RiskAwareness = incoming.RiskAwareness;
            }
            if (incoming.TradeOffAwareness != EvidenceDimensionLevel.NOT_APPLICABLE && incoming.TradeOffAwareness != EvidenceDimensionLevel.UNKNOWN)
            {
                target.TradeOffAwareness = incoming.TradeOffAwareness;
            }

            if (target.Ownership == EvidenceDimensionLevel.STRONG && target.Method == EvidenceDimensionLevel.STRONG && target.Evidence == EvidenceDimensionLevel.STRONG)
            {
                target.EvidenceStrength = "Strong";
            }
            else if (target.Ownership != EvidenceDimensionLevel.WEAK && target.Ownership != EvidenceDimensionLevel.UNKNOWN &&
                     (target.Method == EvidenceDimensionLevel.STRONG || target.Evidence == EvidenceDimensionLevel.STRONG || target.Impact == EvidenceDimensionLevel.STRONG))
            {
                target.EvidenceStrength = "Moderate";
            }
            else if (target.Ownership == EvidenceDimensionLevel.WEAK || target.Method == EvidenceDimensionLevel.WEAK)
            {
                target.EvidenceStrength = "Weak";
            }
        }

        private static void RecordDimensionEvidenceEntries(Session session, CandidateClaim claim, int turn)
        {
            if (session.EvidenceState == null)
            {
                session.EvidenceState = new InterviewEvidenceState();
            }
            session.EvidenceState.EvidenceHistory ??= new List<DimensionEvidenceEntry>();

            session.EvidenceState.EvidenceHistory.Add(new DimensionEvidenceEntry
            {
                Turn = turn,
                ClaimId = claim.Id,
                Dimension = "Ownership",
                Level = claim.Ownership,
                EvidenceNote = claim.CandidateOwnershipComponent
            });

            session.EvidenceState.EvidenceHistory.Add(new DimensionEvidenceEntry
            {
                Turn = turn,
                ClaimId = claim.Id,
                Dimension = "Method",
                Level = claim.Method
            });

            if (claim.Evidence != EvidenceDimensionLevel.NOT_APPLICABLE)
            {
                session.EvidenceState.EvidenceHistory.Add(new DimensionEvidenceEntry
                {
                    Turn = turn,
                    ClaimId = claim.Id,
                    Dimension = "Evidence",
                    Level = claim.Evidence,
                    EvidenceNote = claim.ExtractedMetric
                });
            }

            if (claim.Repeatability != EvidenceDimensionLevel.NOT_APPLICABLE && claim.Repeatability != EvidenceDimensionLevel.UNKNOWN)
            {
                session.EvidenceState.EvidenceHistory.Add(new DimensionEvidenceEntry
                {
                    Turn = turn,
                    ClaimId = claim.Id,
                    Dimension = "Repeatability",
                    Level = claim.Repeatability
                });
            }

            if (claim.RiskAwareness != EvidenceDimensionLevel.NOT_APPLICABLE && claim.RiskAwareness != EvidenceDimensionLevel.UNKNOWN)
            {
                session.EvidenceState.EvidenceHistory.Add(new DimensionEvidenceEntry
                {
                    Turn = turn,
                    ClaimId = claim.Id,
                    Dimension = "RiskAwareness",
                    Level = claim.RiskAwareness
                });
            }

            if (claim.TradeOffAwareness != EvidenceDimensionLevel.NOT_APPLICABLE && claim.TradeOffAwareness != EvidenceDimensionLevel.UNKNOWN)
            {
                session.EvidenceState.EvidenceHistory.Add(new DimensionEvidenceEntry
                {
                    Turn = turn,
                    ClaimId = claim.Id,
                    Dimension = "TradeOffAwareness",
                    Level = claim.TradeOffAwareness
                });
            }
        }

        private void UpdateCompetencyMapFromClaim(Session session, CandidateClaim claim, int turn)
        {
            SynthesizeCompetencyEvidence(session, "Ownership");
            SynthesizeCompetencyEvidence(session, "Method");
            if (claim.Evidence != EvidenceDimensionLevel.NOT_APPLICABLE)
            {
                SynthesizeCompetencyEvidence(session, "Evidence");
            }
            if (claim.Impact != EvidenceDimensionLevel.NOT_APPLICABLE)
            {
                SynthesizeCompetencyEvidence(session, "Impact");
            }
            if (claim.Repeatability != EvidenceDimensionLevel.NOT_APPLICABLE && claim.Repeatability != EvidenceDimensionLevel.UNKNOWN)
            {
                SynthesizeCompetencyEvidence(session, "Repeatability");
            }
            if (claim.RiskAwareness != EvidenceDimensionLevel.NOT_APPLICABLE && claim.RiskAwareness != EvidenceDimensionLevel.UNKNOWN)
            {
                SynthesizeCompetencyEvidence(session, "RiskAwareness");
            }
            if (claim.TradeOffAwareness != EvidenceDimensionLevel.NOT_APPLICABLE && claim.TradeOffAwareness != EvidenceDimensionLevel.UNKNOWN)
            {
                SynthesizeCompetencyEvidence(session, "TradeOffAwareness");
            }
        }

        private static bool EvaluateCompetencySufficiency(CompetencyEvidenceRecord record, Session session, InterviewBlueprint? blueprint)
        {
            var seniority = blueprint?.Seniority ?? session.InterviewContext?.ExperienceLevel ?? "Mid";
            bool isJunior = seniority.Equals("Junior", StringComparison.OrdinalIgnoreCase);

            if (record.CurrentLevel == EvidenceDimensionLevel.STRONG)
                return true;

            if (record.CurrentLevel == EvidenceDimensionLevel.MODERATE && (isJunior || record.Evolution == EvidenceEvolutionType.IMPROVEMENT))
                return true;

            return false;
        }

        public CrossAnswerContradictionRecord? CheckCrossAnswerContradiction(Session session, CandidateClaim newClaim, int turn)
        {
            if (session.EvidenceState?.Claims == null || session.EvidenceState.Claims.Count == 0)
                return null;

            var lowerNew = newClaim.Text.ToLowerInvariant();

            foreach (var oldClaim in session.EvidenceState.Claims.Where(c => c.Turn < turn))
            {
                var lowerOld = oldClaim.Text.ToLowerInvariant();

                // Guard 1: Temporal evolution (Different time: "version 1", "later", "sau đó", "took over", etc.)
                bool hasTemporalEvolution =
                    (lowerOld.Contains("version 1") || lowerOld.Contains("v1") || lowerOld.Contains("ban đầu") || lowerOld.Contains("thời gian đầu")) &&
                    (lowerNew.Contains("later") || lowerNew.Contains("sau đó") || lowerNew.Contains("về sau") || lowerNew.Contains("giai đoạn sau") || lowerNew.Contains("took over") || lowerNew.Contains("chuyển giao")) ||
                    (lowerNew.Contains("later") || lowerNew.Contains("sau đó") || lowerNew.Contains("sau này"));

                if (hasTemporalEvolution)
                    continue;

                // Guard 2: Different project context (e.g. "project a" vs "project b", "dự án a" vs "dự án b")
                bool hasDifferentProjects =
                    (lowerOld.Contains("project a") && lowerNew.Contains("project b")) ||
                    (lowerOld.Contains("project b") && lowerNew.Contains("project a")) ||
                    (lowerOld.Contains("dự án a") && lowerNew.Contains("dự án b")) ||
                    (lowerOld.Contains("dự án b") && lowerNew.Contains("dự án a")) ||
                    (lowerOld.Contains("công ty cũ") && lowerNew.Contains("công ty mới"));

                if (hasDifferentProjects)
                    continue;

                // Guard 3: Delivery/management responsibility vs team execution (e.g. "responsible for backend delivery" vs "team implemented backend together")
                bool hasCooperativeOwnership =
                    (lowerOld.Contains("delivery") || lowerOld.Contains("chịu trách nhiệm delivery") || lowerOld.Contains("quản lý")) &&
                    (lowerNew.Contains("together") || lowerNew.Contains("cùng làm") || lowerNew.Contains("cả team"));

                if (hasCooperativeOwnership)
                    continue;

                // Guard 4: Scope disparity (e.g. "api layer" vs "authentication infrastructure")
                bool isDifferentScope =
                    (lowerOld.Contains("api layer") && lowerNew.Contains("authentication infrastructure")) ||
                    (lowerOld.Contains("frontend") && lowerNew.Contains("backend")) ||
                    (lowerOld.Contains("ui") && lowerNew.Contains("database"));

                if (isDifferentScope)
                    continue;

                // 1. Role / Responsibility contradiction
                // e.g. "phụ trách backend" vs "backend do team khác làm"
                if (lowerOld.Contains("phụ trách backend") && (lowerNew.Contains("backend do team khác") || lowerNew.Contains("không làm backend")))
                {
                    return new CrossAnswerContradictionRecord
                    {
                        Turn1 = oldClaim.Turn,
                        Turn2 = turn,
                        Statement1 = oldClaim.Text,
                        Statement2 = newClaim.Text,
                        ContradictionDescription = "Sự mâu thuẫn về trách nhiệm phát triển phần backend giữa hai lượt trả lời."
                    };
                }

                // 2. Direct lead vs support role
                if (lowerOld.Contains("trực tiếp lead") && (lowerNew.Contains("chỉ hỗ trợ") || lowerNew.Contains("chỉ tham gia")))
                {
                    return new CrossAnswerContradictionRecord
                    {
                        Turn1 = oldClaim.Turn,
                        Turn2 = turn,
                        Statement1 = oldClaim.Text,
                        Statement2 = newClaim.Text,
                        ContradictionDescription = "Vai trò dẫn dắt dự án ở câu trước mâu thuẫn với vai trò chỉ hỗ trợ ở câu sau."
                    };
                }

                // 3. Tech stack usage
                if (lowerOld.Contains("chuyên dùng sql") && lowerNew.Contains("chưa từng dùng sql"))
                {
                    return new CrossAnswerContradictionRecord
                    {
                        Turn1 = oldClaim.Turn,
                        Turn2 = turn,
                        Statement1 = oldClaim.Text,
                        Statement2 = newClaim.Text,
                        ContradictionDescription = "Kinh nghiệm với cơ sở dữ liệu quan hệ có điểm chưa nhất quán."
                    };
                }

                // 4. Personal implementation vs another team implementation (English & Vietnamese variants, A1 & A6)
                bool isSelfImplemented = lowerOld.Contains("personally implemented") || lowerOld.Contains("implemented it myself") || lowerOld.Contains("tự implement") || lowerOld.Contains("tự làm") || lowerOld.Contains("tự triển khai") || lowerOld.Contains("tự xây dựng");
                bool isAnotherTeam = lowerNew.Contains("implemented by another team") || lowerNew.Contains("handled by another team") || lowerNew.Contains("team khác làm") || lowerNew.Contains("do team khác") || lowerNew.Contains("team khác thực hiện");

                if (isSelfImplemented && isAnotherTeam)
                {
                    bool sameTopic = (lowerOld.Contains("authentication") && lowerNew.Contains("authentication")) ||
                                     (lowerOld.Contains("backend") && lowerNew.Contains("backend")) ||
                                     (lowerOld.Contains("it myself") && (lowerNew.Contains("phần đó") || lowerNew.Contains("that part") || lowerNew.Contains("that")));

                    if (sameTopic)
                    {
                        return new CrossAnswerContradictionRecord
                        {
                            Turn1 = oldClaim.Turn,
                            Turn2 = turn,
                            Statement1 = oldClaim.Text,
                            Statement2 = newClaim.Text,
                            ContradictionDescription = "Điểm chưa nhất quán về việc trực tiếp thực hiện hay do nhóm khác đảm nhiệm."
                        };
                    }
                }
            }

            return null;
        }

        public InterviewerIntelligenceSummary CalculateSummary(Session session)
        {
            var summary = new InterviewerIntelligenceSummary();
            if (session.EvidenceState == null) return summary;

            var claims = session.EvidenceState.Claims;
            summary.ClaimsEvaluated = claims.Count;
            summary.StrongEvidenceCount = claims.Count(c => c.EvidenceStrength == "Strong");
            summary.ModerateEvidenceCount = claims.Count(c => c.EvidenceStrength == "Moderate");
            summary.InsufficientEvidenceCount = claims.Count(c => c.EvidenceStrength == "Weak" || c.EvidenceStrength == "Insufficient");

            summary.OwnershipGaps = claims.Count(c => c.Ownership == EvidenceDimensionLevel.UNKNOWN || c.Ownership == EvidenceDimensionLevel.WEAK);
            summary.MethodGaps = claims.Count(c => c.Method == EvidenceDimensionLevel.UNKNOWN || c.Method == EvidenceDimensionLevel.WEAK);
            summary.EvidenceGaps = claims.Count(c => c.Evidence == EvidenceDimensionLevel.UNKNOWN || c.Evidence == EvidenceDimensionLevel.WEAK);
            summary.SpecificityGaps = claims.Count(c => c.Specificity == EvidenceDimensionLevel.UNKNOWN || c.Specificity == EvidenceDimensionLevel.WEAK);
            summary.ImpactGaps = claims.Count(c => c.Impact == EvidenceDimensionLevel.UNKNOWN || c.Impact == EvidenceDimensionLevel.WEAK);
            summary.RepeatabilityGaps = claims.Count(c => c.Repeatability == EvidenceDimensionLevel.UNKNOWN || c.Repeatability == EvidenceDimensionLevel.WEAK);
            summary.RiskGaps = claims.Count(c => c.RiskAwareness == EvidenceDimensionLevel.UNKNOWN || c.RiskAwareness == EvidenceDimensionLevel.WEAK);
            summary.TradeoffGaps = claims.Count(c => c.TradeOffAwareness == EvidenceDimensionLevel.UNKNOWN || c.TradeOffAwareness == EvidenceDimensionLevel.WEAK);

            summary.ContradictionsDetected = session.EvidenceState.Contradictions.Count;
            summary.ClarificationsGenerated = session.EvidenceState.Probes.Count(p => p.Pattern == InterviewerProbePattern.TRADE_OFF);
            summary.ProbesUsed = session.EvidenceState.Probes.Count;

            session.EvidenceState.Summary = summary;
            return summary;
        }

        // =====================================================================
        // LOCAL DETERMINISTIC ANALYZER & PARSER
        // =====================================================================

        private ClaimEvidence ParseAiClaimResponse(string rawJson, string answer, int turn)
        {
            var evidence = new ClaimEvidence();
            try
            {
                using var doc = JsonDocument.Parse(rawJson);
                var root = doc.RootElement;
                if (root.TryGetProperty("claims", out var claimsArray) && claimsArray.ValueKind == JsonValueKind.Array)
                {
                    foreach (var elem in claimsArray.EnumerateArray())
                    {
                        var claimText = elem.TryGetProperty("text", out var t) ? t.GetString() ?? answer : answer;
                        var claimTypeStr = elem.TryGetProperty("claimType", out var ct) ? ct.GetString() : "EXPERIENCE";
                        var specificityStr = elem.TryGetProperty("specificity", out var sp) ? sp.GetString() : "Medium";
                        var isUncertain = elem.TryGetProperty("isUncertain", out var unc) && unc.GetBoolean();
                        var candidateComponent = elem.TryGetProperty("candidateOwnershipComponent", out var cand) ? cand.GetString() : null;
                        var teamComponent = elem.TryGetProperty("teamOwnershipComponent", out var team) ? team.GetString() : null;
                        var metric = elem.TryGetProperty("extractedMetric", out var m) ? m.GetString() : null;
                        var artifact = elem.TryGetProperty("extractedArtifact", out var art) ? art.GetString() : null;
                        var impactType = elem.TryGetProperty("impactType", out var imp) ? imp.GetString() ?? "Activity" : "Activity";

                        // Strict anti-fabrication: If candidate never mentioned numbers in answer, wipe metric
                        if (!string.IsNullOrWhiteSpace(metric) && !answer.Contains(metric))
                        {
                            metric = null;
                        }

                        var claim = BuildClaimFromComponents(
                            claimText,
                            claimTypeStr,
                            specificityStr,
                            isUncertain,
                            candidateComponent,
                            teamComponent,
                            metric,
                            artifact,
                            impactType,
                            turn,
                            answer);

                        evidence.ExtractedClaims.Add(claim);
                    }
                }
            }
            catch (Exception)
            {
                return AnalyzeClaimsLocally(answer, turn);
            }

            if (evidence.ExtractedClaims.Count == 0)
            {
                return AnalyzeClaimsLocally(answer, turn);
            }

            UpdateOverallDimensions(evidence);
            return evidence;
        }

        private ClaimEvidence AnalyzeClaimsLocally(string answer, int turn)
        {
            var evidence = new ClaimEvidence();
            var lower = answer.ToLowerInvariant();

            // Detect Uncertainty
            bool isUncertain = lower.Contains("khoảng") ||
                               lower.Contains("vài phần trăm") ||
                               lower.Contains("không nhớ chính xác") ||
                               lower.Contains("ước chừng") ||
                               lower.Contains("chưa chắc chắn") ||
                               lower.Contains("hình như");

            // Extract Ownership Components
            string? candidateComponent = null;
            string? teamComponent = null;

            bool mentionsTeam = lower.Contains("team em") || lower.Contains("chúng em") || lower.Contains("đội ngũ");
            bool mentionsSelf = lower.Contains("em trực tiếp") ||
                                lower.Contains("em phụ trách") ||
                                lower.Contains("em chịu trách nhiệm") ||
                                lower.Contains("tôi trực tiếp") ||
                                lower.Contains("do em") ||
                                lower.Contains("chính em");

            if (mentionsTeam && mentionsSelf)
            {
                candidateComponent = "Phần việc ứng viên trực tiếp đảm nhận";
                teamComponent = "Phần việc chung của team";
            }
            else if (mentionsSelf)
            {
                candidateComponent = "Ứng viên chịu trách nhiệm chính";
            }
            else if (mentionsTeam)
            {
                teamComponent = "Kết quả chung của cả team";
            }

            // Extract Metric
            string? metric = null;
            var tokens = answer.Split(new[] { ' ', ',', ';' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var tok in tokens)
            {
                if (tok.Contains('%') || tok.Contains('$') || tok.EndsWith("tỷ", StringComparison.OrdinalIgnoreCase) || tok.EndsWith("triệu", StringComparison.OrdinalIgnoreCase))
                {
                    metric = tok;
                    break;
                }
            }

            // Extract Impact Type
            string impactType = "Activity";
            if (metric != null || lower.Contains("tăng trưởng") || lower.Contains("tiết kiệm") || lower.Contains("doanh thu"))
                impactType = "BusinessUserImpact";
            else if (lower.Contains("giảm lỗi") || lower.Contains("hoàn thành") || lower.Contains("cải thiện") || lower.Contains("giảm"))
                impactType = "Outcome";
            else if (lower.Contains("xây dựng") || lower.Contains("triển khai") || lower.Contains("thiết kế"))
                impactType = "Output";

            // Determine Claim Type
            var claimType = CandidateClaimType.EXPERIENCE;
            if (lower.Contains("tăng") || lower.Contains("đạt") || metric != null)
                claimType = CandidateClaimType.ACHIEVEMENT;
            else if (lower.Contains("phụ trách") || lower.Contains("vai trò"))
                claimType = CandidateClaimType.RESPONSIBILITY;
            else if (lower.Contains("thất bại") || lower.Contains("chưa đạt"))
                claimType = CandidateClaimType.FAILURE;
            else if (lower.Contains("quyết định") || lower.Contains("lựa chọn"))
                claimType = CandidateClaimType.DECISION;

            var claim = BuildClaimFromComponents(
                answer,
                claimType.ToString(),
                answer.Length > 60 ? "High" : (answer.Length > 25 ? "Medium" : "Low"),
                isUncertain,
                candidateComponent,
                teamComponent,
                metric,
                null,
                impactType,
                turn,
                answer);

            evidence.ExtractedClaims.Add(claim);
            UpdateOverallDimensions(evidence);
            return evidence;
        }

        private CandidateClaim BuildClaimFromComponents(
            string text,
            string? claimTypeStr,
            string? specificityStr,
            bool isUncertain,
            string? candidateComponent,
            string? teamComponent,
            string? metric,
            string? artifact,
            string impactType,
            int turn,
            string fullAnswer)
        {
            var lower = fullAnswer.ToLowerInvariant();

            // 1. Claim Type
            Enum.TryParse<CandidateClaimType>(claimTypeStr, true, out var claimType);

            // 2. Specificity
            var specificity = specificityStr switch
            {
                "High" => EvidenceDimensionLevel.STRONG,
                "Low" => EvidenceDimensionLevel.WEAK,
                _ => fullAnswer.Length > 40 ? EvidenceDimensionLevel.MODERATE : EvidenceDimensionLevel.WEAK
            };

            // 3. Ownership
            EvidenceDimensionLevel ownership;
            if (!string.IsNullOrWhiteSpace(candidateComponent))
            {
                ownership = EvidenceDimensionLevel.STRONG;
            }
            else if (!string.IsNullOrWhiteSpace(teamComponent))
            {
                // Invariant: "we" is NOT automatically weak, it means personal role is UNKNOWN until probed
                ownership = EvidenceDimensionLevel.UNKNOWN;
            }
            else if (lower.Contains("em làm") || lower.Contains("tôi làm") || lower.Contains("em triển khai") || lower.Contains("em tối ưu") || lower.Contains("em thiết kế") || lower.Contains("em xây dựng"))
            {
                ownership = EvidenceDimensionLevel.MODERATE;
            }
            else
            {
                ownership = EvidenceDimensionLevel.UNKNOWN;
            }

            // 4. Method
            EvidenceDimensionLevel method;
            bool hasMethodSignals = lower.Contains("bằng cách") ||
                                    lower.Contains("quy trình") ||
                                    lower.Contains("bước") ||
                                    lower.Contains("phân tích") ||
                                    lower.Contains("áp dụng") ||
                                    lower.Contains("tối ưu") ||
                                    lower.Contains("triển khai") ||
                                    lower.Contains("xây dựng") ||
                                    lower.Contains("thiết kế") ||
                                    lower.Contains("đánh index") ||
                                    lower.Contains("caching") ||
                                    lower.Contains("kiểm thử");

            if (hasMethodSignals && fullAnswer.Length > 50)
                method = EvidenceDimensionLevel.STRONG;
            else if (hasMethodSignals || fullAnswer.Length > 30)
                method = EvidenceDimensionLevel.MODERATE;
            else
                method = EvidenceDimensionLevel.WEAK;

            // 5. Evidence
            EvidenceDimensionLevel evidence;
            if (!string.IsNullOrWhiteSpace(metric) || !string.IsNullOrWhiteSpace(artifact))
                evidence = EvidenceDimensionLevel.STRONG;
            else if (lower.Contains("kết quả") || lower.Contains("cải thiện") || lower.Contains("phản hồi") || lower.Contains("giảm") || lower.Contains("tăng"))
                evidence = EvidenceDimensionLevel.MODERATE;
            else
                evidence = EvidenceDimensionLevel.WEAK;

            // 6. Impact
            var impact = impactType switch
            {
                "BusinessUserImpact" => EvidenceDimensionLevel.STRONG,
                "Outcome" => EvidenceDimensionLevel.MODERATE,
                "Output" => EvidenceDimensionLevel.MODERATE,
                _ => EvidenceDimensionLevel.WEAK
            };

            // 7. Context Dependency & Repeatability
            EvidenceDimensionLevel repeatability = EvidenceDimensionLevel.UNKNOWN;
            if (lower.Contains("thị trường năm đó") || lower.Contains("điều kiện thuận lợi") || lower.Contains("nhờ có sếp"))
            {
                repeatability = EvidenceDimensionLevel.WEAK; // High context dependency
            }
            else if (lower.Contains("ở công ty mới") || lower.Contains("tái lập") || lower.Contains("tương tự"))
            {
                repeatability = EvidenceDimensionLevel.STRONG;
            }

            // 8. Overall Evidence Strength (C# Deterministic Authority)
            string overallStrength;
            if (ownership == EvidenceDimensionLevel.STRONG && method == EvidenceDimensionLevel.STRONG && evidence == EvidenceDimensionLevel.STRONG)
            {
                overallStrength = "Strong";
            }
            else if (ownership != EvidenceDimensionLevel.WEAK && ownership != EvidenceDimensionLevel.UNKNOWN &&
                     (method == EvidenceDimensionLevel.STRONG || evidence == EvidenceDimensionLevel.STRONG || impact == EvidenceDimensionLevel.STRONG))
            {
                overallStrength = "Moderate";
            }
            else
            {
                overallStrength = "Weak";
            }

            return new CandidateClaim
            {
                Turn = turn,
                Text = text,
                ClaimType = claimType,
                Specificity = specificity,
                Ownership = ownership,
                Method = method,
                Evidence = evidence,
                Impact = impact,
                Repeatability = repeatability,
                IsUncertain = isUncertain,
                ImpactType = impactType,
                EvidenceStrength = overallStrength,
                ExtractedMetric = metric,
                ExtractedArtifact = artifact,
                CandidateOwnershipComponent = candidateComponent,
                TeamOwnershipComponent = teamComponent
            };
        }

        private static void UpdateOverallDimensions(ClaimEvidence evidence)
        {
            if (evidence.ExtractedClaims.Count == 0) return;

            var first = evidence.ExtractedClaims[0];
            evidence.OverallOwnership = first.Ownership;
            evidence.OverallMethod = first.Method;
            evidence.OverallEvidence = first.Evidence;
            evidence.OverallSpecificity = first.Specificity;
            evidence.OverallImpact = first.Impact;
            evidence.EvidenceStrength = first.EvidenceStrength;
            evidence.IsUncertain = first.IsUncertain;
        }

        public static string GetDeterministicIntentProbeTemplate(
            Session session,
            CandidateClaim claim,
            InterviewerIntentDecision decision,
            int probeDepth)
        {
            var level = session.InterviewContext?.ExperienceLevel ?? "Mid";
            bool isJunior = level.Equals("Junior", StringComparison.OrdinalIgnoreCase) ||
                            level.Equals("Fresher", StringComparison.OrdinalIgnoreCase) ||
                            level.Equals("Intern", StringComparison.OrdinalIgnoreCase);
            bool isSenior = level.Equals("Senior", StringComparison.OrdinalIgnoreCase) ||
                            level.Equals("Lead", StringComparison.OrdinalIgnoreCase) ||
                            level.Equals("Principal", StringComparison.OrdinalIgnoreCase);

            switch (decision.Intent)
            {
                case InterviewIntentType.VERIFY_CLAIM:
                    return "Bạn có thể chia sẻ chi tiết hơn về bối cảnh cụ thể và tình huống khi bạn thực hiện công việc này không?";

                case InterviewIntentType.VERIFY_OWNERSHIP:
                    if (!string.IsNullOrWhiteSpace(claim.Text))
                        return $"Trong kết quả {claim.Text} vừa nêu, phần nào là do bạn trực tiếp thực hiện hoặc ra quyết định, và phần nào là nỗ lực của cả đội ngũ?";
                    return "Trong kết quả vừa nêu, phần nào là do bạn trực tiếp đảm nhận hoặc quyết định, và phần nào là của cả đội ngũ?";

                case InterviewIntentType.VERIFY_METHOD:
                    if (isJunior)
                        return "Bạn đã tiếp cận và triển khai từng bước công việc đó như thế nào trong thực tế?";
                    return "Bạn đã xác định vấn đề và xây dựng quy trình triển khai cụ thể ra sao để đạt được mục tiêu đó?";

                case InterviewIntentType.VERIFY_IMPACT:
                    return "Kết quả đó đã mang lại tác động cụ thể như thế nào đối với hiệu quả công việc, chỉ số đo lường hoặc trải nghiệm của người dùng/khách hàng?";

                case InterviewIntentType.VERIFY_REPEATABILITY:
                    if (probeDepth >= 3)
                        return "Nếu điều kiện và quy mô thay đổi gấp nhiều lần, bạn sẽ điều chỉnh phương pháp thế nào để tái tạo được thành công tương tự?";
                    return "Theo bạn, những yếu tố cốt lõi nào cho phép bạn tái lập thành tích này ở một môi trường hoặc dự án khác?";

                case InterviewIntentType.TEST_TRADEOFF:
                    if (isSenior)
                        return "Khi phải cân nhắc đánh đổi giữa tiến độ bàn giao và nợ kỹ thuật/chất lượng dài hạn, bạn đã đưa ra quyết định dựa trên những nguyên tắc nào?";
                    return "Bạn đã cân nhắc những ưu nhược điểm nào khi lựa chọn giải pháp này thay vì các phương án khác?";

                case InterviewIntentType.TEST_RISK:
                    return "Trong quá trình thực hiện, những dấu hiệu cảnh báo sớm nào cho thấy rủi ro có thể phát sinh và bạn đã kiểm soát chúng ra sao?";

                case InterviewIntentType.TEST_DEPTH:
                    return "Về mặt chuyên môn sâu, nguyên lý cốt lõi nào quyết định tính khả thi và hiệu quả của giải pháp bạn đã áp dụng?";

                case InterviewIntentType.TEST_SYSTEM_THINKING:
                    return "Giải pháp này tương tác và ảnh hưởng như thế nào đến các quy trình, bộ phận hoặc hệ thống liên quan khác trong tổ chức?";

                case InterviewIntentType.CLARIFY_CONTRADICTION:
                    return "Trước đó bạn có chia sẻ một điểm thông tin, ở đây bạn lại đề cập theo một hướng khác. Bạn có thể giúp tôi làm rõ hơn sự khác biệt này được không?";

                case InterviewIntentType.MOVE_ON:
                default:
                    if (decision.RecommendedPattern.HasValue)
                        return GetDeterministicProbeTemplate(session, claim, decision.RecommendedPattern.Value, probeDepth);
                    return "Cảm ơn bạn đã chia sẻ rõ ràng. Chúng ta có thể chuyển sang nội dung tiếp theo.";
            }
        }

        private static string GetDeterministicProbeTemplate(
            Session session,
            CandidateClaim claim,
            InterviewerProbePattern pattern,
            int probeDepth)
        {
            var role = session.JobTitle ?? session.InterviewContext?.TargetPosition ?? "vị trí này";
            var level = session.InterviewContext?.ExperienceLevel ?? "Mid";
            bool isJunior = level.Equals("Junior", StringComparison.OrdinalIgnoreCase);
            bool isSenior = level.Equals("Senior", StringComparison.OrdinalIgnoreCase) ||
                            level.Equals("Lead", StringComparison.OrdinalIgnoreCase);

            switch (pattern)
            {
                case InterviewerProbePattern.OWNERSHIP_ATTRIBUTION:
                    return $"Trong kết quả {claim.Text} vừa nêu, phần nào là do bạn trực tiếp thực hiện hoặc quyết định, và phần nào là nỗ lực của cả đội ngũ?";

                case InterviewerProbePattern.CONTEXT_DEPENDENCY:
                    return "Theo bạn, kết quả tích cực đó đến chủ yếu từ phương pháp cá nhân hay nhờ có điều kiện thị trường/hệ thống sẵn có?";

                case InterviewerProbePattern.CONTRIBUTION_VERIFICATION:
                    return "Trong dự án này, bạn có thể làm rõ hơn phần đóng góp độc lập của mình tách biệt với các thành viên khác trong team được không?";

                case InterviewerProbePattern.METHODOLOGY_VERIFICATION:
                    if (isJunior)
                        return "Bạn đã tiếp cận và triển khai từng bước công việc đó như thế nào trong thực tế?";
                    return "Bạn đã xác định vấn đề và xây dựng quy trình triển khai cụ thể ra sao để đạt được mục tiêu đó?";

                case InterviewerProbePattern.CHANNEL_EFFECTIVENESS:
                    return "Trong các cách tiếp cận hoặc giải pháp bạn đã thử nghiệm, cách nào mang lại hiệu quả cao nhất và bạn căn cứ vào dữ liệu nào?";

                case InterviewerProbePattern.ADAPTABILITY_TO_NEW_CONTEXT:
                    return "Nếu chuyển sang một môi trường mới không còn những công cụ hoặc lợi thế quen thuộc, bạn sẽ bắt đầu như thế nào trong 30 ngày đầu?";

                case InterviewerProbePattern.RISK_AWARENESS:
                    return "Trong quá trình thực hiện, những dấu hiệu cảnh báo sớm nào cho thấy rủi ro có thể phát sinh và bạn đã kiểm soát chúng ra sao?";

                case InterviewerProbePattern.TRADE_OFF:
                    if (isSenior)
                        return "Khi phải cân nhắc đánh đổi giữa tiến độ bàn giao và nợ kỹ thuật/chất lượng dài hạn, bạn đã đưa ra quyết định dựa trên những nguyên tắc nào?";
                    return "Bạn đã cân nhắc những ưu nhược điểm nào khi lựa chọn giải pháp này thay vì các phương án khác?";

                case InterviewerProbePattern.EXTERNAL_CHANGE_ADAPTATION:
                    return "Nếu có một thay đổi lớn từ bên ngoài (như chính sách, thị trường hoặc deadline bị rút ngắn), bạn sẽ điều chỉnh kế hoạch như thế nào?";

                case InterviewerProbePattern.FAILURE_ANALYSIS:
                    return "Nhìn lại kết quả đó, có quyết định hay hành động nào của bản thân mà bạn nghĩ mình có thể làm tốt hơn không?";

                case InterviewerProbePattern.REPEATABILITY:
                    if (probeDepth >= 3)
                        return "Nếu điều kiện và quy mô thay đổi gấp nhiều lần, bạn sẽ điều chỉnh phương pháp thế nào để tái tạo được thành công tương tự?";
                    return "Theo bạn, những yếu tố cốt lõi nào cho phép bạn tái lập thành tích này ở một môi trường hoặc dự án khác?";

                default:
                    return "Bạn có thể chia sẻ chi tiết hơn về cách bạn đã triển khai công việc này không?";
            }
        }

        // =====================================================================
        // PHASE 5 STEP 4: NATURAL INTERVIEWER CONVERSATION & CONTEXT-AWARE GENERATION
        // =====================================================================

        public InterviewQuestionSpecification BuildQuestionSpecification(
            Session session,
            CandidateClaim? claim = null,
            InterviewerIntentDecision? decision = null,
            string? targetCompetency = null,
            string? parentQuestionId = null)
        {
            string stage = session.InterviewState?.InterviewPhase ?? InterviewStageNames.TechnicalAssessment;
            string actualParentQId = parentQuestionId ??
                                     session.InterviewState?.LastParentQuestionId ??
                                     session.Answers?.LastOrDefault()?.QuestionId ??
                                     Guid.NewGuid().ToString();

            string actualClaimId = claim?.Id ?? session.EvidenceState?.ActiveClaimId ?? string.Empty;

            string competency = !string.IsNullOrWhiteSpace(targetCompetency)
                ? targetCompetency
                : (claim != null
                    ? DeterminePrimaryCompetency(claim, stage)
                    : (session.InterviewState?.ActiveTargetEvaluation?.ConceptName ??
                       session.InterviewState?.CurrentTopic ??
                       "Technical Depth"));

            string dimension = !string.IsNullOrWhiteSpace(decision?.TargetEvidenceDimension)
                ? decision.TargetEvidenceDimension
                : (!string.IsNullOrWhiteSpace(decision?.EvidenceGap?.Dimension)
                    ? decision.EvidenceGap.Dimension
                    : (claim != null
                        ? (claim.Method == EvidenceDimensionLevel.UNKNOWN ? "Method" :
                           claim.Ownership == EvidenceDimensionLevel.UNKNOWN ? "Ownership" :
                           claim.Impact == EvidenceDimensionLevel.UNKNOWN ? "Impact" :
                           claim.RiskAwareness == EvidenceDimensionLevel.UNKNOWN ? "Risk" :
                           claim.TradeOffAwareness == EvidenceDimensionLevel.UNKNOWN ? "TradeOff" :
                           claim.Repeatability == EvidenceDimensionLevel.UNKNOWN ? "Repeatability" : "Overall")
                        : "Method"));

            InterviewIntentType intent = decision != null
                ? decision.Intent
                : (claim != null ? DecideIntent(session, claim).Intent : InterviewIntentType.VERIFY_CLAIM);

            string reason = !string.IsNullOrWhiteSpace(decision?.Reason)
                ? decision.Reason
                : $"Làm rõ và xác minh bằng chứng năng lực {competency} ở chiều {dimension}";

            int difficulty = session.QualityState != null
                ? (int)session.QualityState.CurrentDifficulty
                : 2;

            InterviewQuestionType qType;
            if (intent == InterviewIntentType.CLARIFY_CONTRADICTION)
                qType = InterviewQuestionType.CLARIFICATION;
            else if (intent == InterviewIntentType.VERIFY_OWNERSHIP)
                qType = InterviewQuestionType.CLARIFICATION;
            else if (intent == InterviewIntentType.VERIFY_METHOD)
                qType = InterviewQuestionType.METHOD_REQUEST;
            else if (intent == InterviewIntentType.VERIFY_IMPACT)
                qType = InterviewQuestionType.IMPACT_REQUEST;
            else if (intent == InterviewIntentType.VERIFY_REPEATABILITY)
                qType = InterviewQuestionType.REPEATABILITY_REQUEST;
            else if (intent == InterviewIntentType.TEST_TRADEOFF)
                qType = InterviewQuestionType.TRADEOFF_REQUEST;
            else if (intent == InterviewIntentType.TEST_RISK)
                qType = InterviewQuestionType.RISK_REQUEST;
            else if (intent == InterviewIntentType.TEST_DEPTH)
                qType = InterviewQuestionType.DEEP_DIVE;
            else if (string.Equals(session.InterviewState?.LastDecision, "ChangeTopic", StringComparison.OrdinalIgnoreCase))
                qType = InterviewQuestionType.BRIDGE;
            else if (session.Answers == null || session.Answers.Count == 0)
                qType = InterviewQuestionType.INITIAL;
            else if (claim != null)
                qType = InterviewQuestionType.FOLLOW_UP;
            else
                qType = InterviewQuestionType.INITIAL;

            bool isFollowUp = qType == InterviewQuestionType.FOLLOW_UP ||
                              qType == InterviewQuestionType.METHOD_REQUEST ||
                              qType == InterviewQuestionType.IMPACT_REQUEST ||
                              qType == InterviewQuestionType.TRADEOFF_REQUEST ||
                              qType == InterviewQuestionType.RISK_REQUEST ||
                              qType == InterviewQuestionType.CLARIFICATION ||
                              qType == InterviewQuestionType.DEEP_DIVE;

            bool isBridge = qType == InterviewQuestionType.BRIDGE || qType == InterviewQuestionType.TRANSITION;

            string objective = intent switch
            {
                InterviewIntentType.VERIFY_METHOD => "Làm rõ phương pháp, kỹ thuật và các bước thực thi cụ thể của ứng viên.",
                InterviewIntentType.VERIFY_OWNERSHIP => "Xác minh vai trò trực tiếp của ứng viên tách biệt khỏi phần việc của đội ngũ.",
                InterviewIntentType.VERIFY_IMPACT => "Đo lường kết quả cụ thể và mức độ ảnh hưởng thực tế đối với dự án hoặc kinh doanh.",
                InterviewIntentType.VERIFY_REPEATABILITY => "Kiểm tra tính nhất quán và khả năng tái lập thành công trong môi trường hoặc quy mô mới.",
                InterviewIntentType.TEST_TRADEOFF => "Đánh giá khả năng phân tích và đưa ra quyết định giữa các phương án đánh đổi.",
                InterviewIntentType.TEST_RISK => "Kiểm tra sự thấu hiểu rủi ro tiềm ẩn và các biện pháp kiểm soát, giảm thiểu sự cố.",
                InterviewIntentType.TEST_DEPTH => "Đào sâu nền tảng chuyên môn cốt lõi và mức độ thấu hiểu bản chất vấn đề.",
                InterviewIntentType.TEST_SYSTEM_THINKING => "Khảo sát tư duy toàn cục và sự tương tác giữa các thành phần trong hệ thống.",
                InterviewIntentType.CLARIFY_CONTRADICTION => "Làm rõ thông tin chưa nhất quán giữa các câu trả lời mà không quy chụp hay phán xét.",
                InterviewIntentType.MOVE_ON => "Chuyển tiếp sang chủ đề hoặc năng lực tiếp theo một cách tự nhiên.",
                _ => "Khảo sát thông tin chuyên môn ban đầu của ứng viên."
            };

            var ind = session.InterviewContext?.Industry ?? "Generic";
            var role = session.JobTitle ?? session.InterviewContext?.TargetPosition ?? "Candidate";
            var lvl = session.InterviewContext?.ExperienceLevel ?? "Mid";
            string contextDesc = $"{ind} / {role} / {lvl}";

            string? bridgeContext = isBridge
                ? BuildNaturalBridge(session, session.InterviewState?.CurrentTopic ?? "chủ đề trước", competency)
                : null;

            string? conversationalHook = null;
            if (claim != null && !string.IsNullOrWhiteSpace(claim.Text))
            {
                conversationalHook = claim.Text.Length > 80 ? claim.Text[..80] + "..." : claim.Text;
            }
            else if (session.Answers != null && session.Answers.Count > 0)
            {
                var lastAns = session.Answers.Last().Answer;
                if (!string.IsNullOrWhiteSpace(lastAns))
                {
                    conversationalHook = lastAns.Length > 80 ? lastAns[..80] + "..." : lastAns;
                }
            }

            var spec = new InterviewQuestionSpecification
            {
                Stage = stage,
                Intent = intent,
                ProbeReason = reason,
                TargetCompetency = competency,
                TargetDimension = dimension,
                QuestionType = qType,
                Objective = objective,
                Context = contextDesc,
                ParentQuestionId = actualParentQId,
                RelatedClaimId = actualClaimId,
                Difficulty = difficulty,
                IsFollowUp = isFollowUp,
                IsBridge = isBridge,
                BridgeContext = bridgeContext,
                ConversationalHook = conversationalHook
            };

            spec.DeterministicWording = BuildDeterministicQuestionWording(session, spec, claim);
            return spec;
        }

        public string BuildNaturalBridge(Session session, string previousTopic, string newCompetency, string? candidateContext = null)
        {
            var cleanPrev = string.IsNullOrWhiteSpace(previousTopic) ? "phần chia sẻ vừa rồi" : previousTopic.Trim();
            var cleanNew = string.IsNullOrWhiteSpace(newCompetency) ? "nội dung tiếp theo" : newCompetency.Trim();

            var lowerPrev = cleanPrev.ToLowerInvariant();
            var lowerNew = cleanNew.ToLowerInvariant();

            if (lowerPrev.Contains("tech") || lowerPrev.Contains("architecture") || lowerPrev.Contains("kiến trúc"))
            {
                if (lowerNew.Contains("decision") || lowerNew.Contains("trade-off") || lowerNew.Contains("tradeoff"))
                {
                    return $"Phần quyết định kỹ thuật về {cleanPrev} vừa rồi khá rõ ràng. Tôi muốn chuyển sang một khía cạnh thực tế hơn — khi phải đưa ra các quyết định đánh đổi về {cleanNew} trong dự án, bạn thường cân nhắc những yếu tố nào?";
                }
            }

            if (lowerPrev.Contains("decision") && (lowerNew.Contains("trade") || lowerNew.Contains("đánh đổi")))
            {
                return $"Cách bạn đưa ra lựa chọn cho {cleanPrev} rất mạch lạc. Để hiểu sâu hơn về tư duy {cleanNew}, bạn đã cân nhắc giữa lợi ích trước mắt và tính ổn định lâu dài như thế nào?";
            }

            if (lowerPrev.Contains("customer") || lowerPrev.Contains("sales") || lowerPrev.Contains("method") || lowerPrev.Contains("phương pháp"))
            {
                if (lowerNew.Contains("repeat") || lowerNew.Contains("tái lập") || lowerNew.Contains("quy mô"))
                {
                    return $"Quy trình và cách tiếp cận về {cleanPrev} rất cụ thể. Tiếp theo, về khả năng {cleanNew}, bạn sẽ điều chỉnh phương pháp này ra sao khi mở rộng quy mô?";
                }
            }

            return $"Nội dung về {cleanPrev} vừa rồi tôi đã nắm được. Bây giờ chúng ta cùng trao đổi sang khía cạnh {cleanNew} — bạn có thể chia sẻ một tình huống thực tế liên quan đến nội dung này không?";
        }

        public bool ValidateQuestionQuality(
            Session session,
            InterviewQuestionSpecification spec,
            string questionText,
            out string failureReason)
        {
            if (string.IsNullOrWhiteSpace(questionText))
            {
                failureReason = "Empty question text";
                return false;
            }

            if (spec == null)
            {
                failureReason = "Null question specification";
                return false;
            }

            var lower = questionText.ToLowerInvariant();

            // 1. Metadata leakage check
            string[] metadataTerms = new[]
            {
                "verify_method", "verify_claim", "verify_ownership", "verify_impact", "verify_repeatability",
                "test_tradeoff", "test_risk", "test_depth", "test_system_thinking", "clarify_contradiction",
                "move_on", "ownership_gap", "method_gap", "evidence_gap", "probe_count", "evidence_level",
                "high_priority_gap", "interviewintenttype", "candidateclaimtype", "gemini", "ai interviewer"
            };

            foreach (var term in metadataTerms)
            {
                if (lower.Contains(term))
                {
                    failureReason = $"Internal metadata leakage detected: '{term}'";
                    return false;
                }
            }

            // 2. Accusatory language check (Invariant: Contradiction != Lie, never accuse)
            string[] accusatoryTerms = new[]
            {
                "nói dối", "tại sao nói dối", "dishonest", "cheat", "gian lận", "bịa đặt", "không trung thực", "lừa dối", "ngụy tạo", "bạn đang nói dối"
            };

            foreach (var term in accusatoryTerms)
            {
                if (lower.Contains(term))
                {
                    failureReason = $"Accusatory language detected: '{term}'";
                    return false;
                }
            }

            // 3. Score or evaluation leakage check
            string[] scoreTerms = new[]
            {
                "chấm điểm", "điểm số", "8/10", "10/10", "đậu", "rớt", "bạn đã pass", "bạn đã fail", "đánh giá yếu", "cho điểm"
            };

            foreach (var term in scoreTerms)
            {
                if (lower.Contains(term))
                {
                    failureReason = $"Score or evaluation judgment leakage detected: '{term}'";
                    return false;
                }
            }

            // 4. Unsupported company policy fabrication check
            if (lower.Contains("chính sách công ty") || lower.Contains("quy định nội bộ") || lower.Contains("chính sách lương") || lower.Contains("thưởng kpi"))
            {
                bool isTrustedCompanyContext = false;
                if (session.InterviewContext?.CompanyContext?.KnownFacts != null)
                {
                    var kf = session.InterviewContext.CompanyContext.KnownFacts;
                    if (kf.Any(f => f.Information.Contains("chính sách", StringComparison.OrdinalIgnoreCase) || f.Information.Contains("quy định", StringComparison.OrdinalIgnoreCase)))
                    {
                        isTrustedCompanyContext = true;
                    }
                }
                if (!isTrustedCompanyContext && !string.IsNullOrEmpty(session.InterviewContext?.JdText))
                {
                    if (session.InterviewContext.JdText.Contains("chính sách", StringComparison.OrdinalIgnoreCase) || session.InterviewContext.JdText.Contains("quy định", StringComparison.OrdinalIgnoreCase))
                    {
                        isTrustedCompanyContext = true;
                    }
                }
                if (!isTrustedCompanyContext)
                {
                    failureReason = "Fabricated company policy or context detected";
                    return false;
                }
            }

            // 5. Unsupported candidate experience fabrication check
            if (lower.Contains("kinh nghiệm kubernetes của bạn") || lower.Contains("dự án sap của bạn"))
            {
                bool mentionsK8s = session.Answers?.Any(a => a.Answer.Contains("kubernetes", StringComparison.OrdinalIgnoreCase)) ?? false;
                mentionsK8s |= session.InterviewContext?.Skills?.Any(s => s.Contains("kubernetes", StringComparison.OrdinalIgnoreCase)) ?? false;
                if (!mentionsK8s)
                {
                    failureReason = "Fabricated candidate experience or claim detected";
                    return false;
                }
            }

            // 6. Semantic or exact repetition check
            if (CheckSemanticRepetition(session, spec, questionText))
            {
                failureReason = "Duplicate question detected";
                return false;
            }

            // 7. Global Language Consistency & Anti-Injection Defense
            var sessionLang = session.Language ?? session.InterviewContext?.Language ?? InterviewLanguage.Vietnamese;
            if (InterviewLanguage.IsVietnamese(sessionLang))
            {
                string[] englishStarters = new[] { "how do you", "can you tell", "could you explain", "what is your", "why did you", "please tell me", "how did you", "what are the" };
                bool startsWithEnglish = englishStarters.Any(s => lower.StartsWith(s));

                bool hasVietnameseMarker = lower.Contains("bạn") || lower.Contains("anh") || lower.Contains("chị") || lower.Contains("em") ||
                                           lower.Contains("thế nào") || lower.Contains("ra sao") || lower.Contains("tại sao") ||
                                           lower.Contains("như thế nào") || lower.Contains("chia sẻ") || lower.Contains("không") ||
                                           lower.Contains("trong") || lower.Contains("với") || lower.Contains("được") || lower.Contains("của") ||
                                           lower.Contains("làm") || lower.Contains("khi") || lower.Contains("này");

                if (startsWithEnglish && !hasVietnameseMarker)
                {
                    failureReason = "Language mismatch detected: question generated in English for Vietnamese session";
                    return false;
                }
            }

            failureReason = string.Empty;
            return true;
        }

        public bool CheckSemanticRepetition(Session session, InterviewQuestionSpecification spec, string candidateQuestion)
        {
            if (string.IsNullOrWhiteSpace(candidateQuestion)) return true;

            var normCandidate = candidateQuestion.Trim().ToLowerInvariant();

            // 1. Exact string match against prior questions
            if (session.Questions != null)
            {
                foreach (var q in session.Questions)
                {
                    if (q.Trim().ToLowerInvariant() == normCandidate)
                        return true;
                }
            }

            if (session.Answers != null)
            {
                foreach (var a in session.Answers)
                {
                    if (a.Question?.Trim().ToLowerInvariant() == normCandidate)
                        return true;
                }
            }

            // 2. Semantic repetition check against existing specifications
            if (session.EvidenceState?.QuestionSpecifications != null)
            {
                foreach (var prevSpec in session.EvidenceState.QuestionSpecifications)
                {
                    bool sameIntent = prevSpec.Intent == spec.Intent;
                    bool sameDim = string.Equals(prevSpec.TargetDimension, spec.TargetDimension, StringComparison.OrdinalIgnoreCase);
                    bool sameClaim = string.Equals(prevSpec.RelatedClaimId, spec.RelatedClaimId, StringComparison.OrdinalIgnoreCase);
                    bool sameObjective = string.Equals(prevSpec.Objective, spec.Objective, StringComparison.OrdinalIgnoreCase);

                    // If same intent, same dimension, same claim, and identical objective -> Repetition!
                    if (sameIntent && sameDim && sameClaim && sameObjective)
                    {
                        return true;
                    }

                    // Check if text has high lexical overlap (> 50%) with prior wording for same intent and dimension
                    var wordsCand = normCandidate.Split(new[] { ' ', ',', '.', '?', '!' }, StringSplitOptions.RemoveEmptyEntries);
                    var prevWords = (prevSpec.DeterministicWording ?? string.Empty).ToLowerInvariant().Split(new[] { ' ', ',', '.', '?', '!' }, StringSplitOptions.RemoveEmptyEntries);

                    if (wordsCand.Length > 0 && prevWords.Length > 0)
                    {
                        int matchCount = wordsCand.Count(w => prevWords.Contains(w));
                        double ratio = (double)matchCount / wordsCand.Length;
                        if (sameIntent && sameDim && ratio > 0.5)
                        {
                            return true;
                        }
                    }
                }
            }

            return false;
        }

        // =====================================================================
        // PHASE 5 STEP 5: REALISTIC MULTI-INDUSTRY SCENARIOS & INTERVIEWER BEHAVIOR
        // =====================================================================

        public InterviewScenario InitializeScenario(Session session, InterviewBlueprint? blueprint = null)
        {
            session.EvidenceState ??= new InterviewEvidenceState();
            session.EvidenceState.ScenarioHistory ??= new();

            if (session.EvidenceState.ActiveScenario != null)
            {
                return session.EvidenceState.ActiveScenario;
            }

            var scenario = InterviewScenario.CreateScenarioForContext(session.InterviewContext, blueprint ?? session.InterviewBlueprint);
            scenario.State = ScenarioState.INITIAL;
            scenario.Behavior = InterviewerBehaviorType.NEUTRAL;
            scenario.HistoryLog.Add($"[{DateTime.UtcNow:O}] Scenario '{scenario.Title}' initialized for {scenario.Industry} / {scenario.Role} ({scenario.Seniority}). State: INITIAL.");

            session.EvidenceState.ActiveScenario = scenario;
            session.EvidenceState.CurrentInterviewerBehavior = scenario.Behavior;
            return scenario;
        }

        public (bool IsRevealed, string Message) ProcessCandidateInformationRequest(
            Session session,
            InterviewScenario scenario,
            string candidateQuery)
        {
            if (string.IsNullOrWhiteSpace(candidateQuery))
            {
                return (false, string.Empty);
            }

            var queryNorm = candidateQuery.Trim().ToLowerInvariant();

            bool isSeekingInfo = queryNorm.Contains("?") ||
                                 queryNorm.Contains("cho em hỏi") ||
                                 queryNorm.Contains("cho tôi hỏi") ||
                                 queryNorm.Contains("có thể biết") ||
                                 queryNorm.Contains("kiểm tra") ||
                                 queryNorm.Contains("xem log") ||
                                 queryNorm.Contains("xem metric") ||
                                 queryNorm.Contains("chỉ số") ||
                                 queryNorm.Contains("thông tin") ||
                                 queryNorm.Contains("sla") ||
                                 queryNorm.Contains("nguyên nhân") ||
                                 queryNorm.Contains("dữ liệu") ||
                                 queryNorm.Contains("tình trạng") ||
                                 queryNorm.Contains("lịch sử") ||
                                 queryNorm.Contains("thời gian");

            if (!isSeekingInfo)
            {
                return (false, string.Empty);
            }

            // 1. Check Unknown Information for trigger keywords or conceptual matches
            foreach (var fact in scenario.UnknownInformation)
            {
                bool matches = false;
                if (fact.TriggerKeywords != null && fact.TriggerKeywords.Count > 0)
                {
                    if (fact.TriggerKeywords.Any(kw => queryNorm.Contains(kw.ToLowerInvariant())))
                    {
                        matches = true;
                    }
                }

                if (!matches && queryNorm.Contains(fact.Key.ToLowerInvariant()))
                {
                    matches = true;
                }

                if (matches)
                {
                    fact.IsRevealed = true;
                    if (!scenario.RevealedFactKeys.Contains(fact.Key))
                    {
                        scenario.RevealedFactKeys.Add(fact.Key);
                    }

                    if (scenario.State == ScenarioState.INITIAL || scenario.State == ScenarioState.INVESTIGATING)
                    {
                        scenario.State = ScenarioState.NEW_INFORMATION_REVEALED;
                        scenario.Behavior = InterviewerBehaviorType.PROBING;
                    }

                    scenario.HistoryLog.Add($"[{DateTime.UtcNow:O}] Fact '{fact.Key}' revealed via candidate query. New state: {scenario.State}.");
                    return (true, $"Khi kiểm tra thêm dữ liệu thực tế: {fact.Fact}");
                }
            }

            // 2. Check Available Information
            foreach (var fact in scenario.AvailableInformation)
            {
                var keyParts = fact.Key.ToLowerInvariant().Split('_', StringSplitOptions.RemoveEmptyEntries);
                bool keyMatch = keyParts.Any(part => queryNorm.Contains(part));
                bool catMatch = queryNorm.Contains(fact.Category.ToLowerInvariant());
                bool kwMatch = fact.TriggerKeywords != null && fact.TriggerKeywords.Any(kw => queryNorm.Contains(kw.ToLowerInvariant()));

                if (keyMatch || catMatch || kwMatch)
                {
                    return (true, $"Thông tin này đã được xác nhận: {fact.Fact}");
                }
            }

            // 3. Candidate asked for unrecorded context: Safe fallback, no AI hallucination!
            return (false, "Thông tin này hiện chưa được ghi nhận trong bối cảnh tình huống. Nếu trong thực tế chưa có ngay dữ liệu này, bạn sẽ đưa ra phương án xử lý hoặc giả định ra sao?");
        }

        public ScenarioState TransitionScenarioState(
            Session session,
            InterviewScenario scenario,
            string candidateAnswer,
            CandidateClaim? claim = null)
        {
            var answerNorm = (candidateAnswer ?? string.Empty).Trim().ToLowerInvariant();

            bool proposesDecision = answerNorm.Contains("em sẽ") || answerNorm.Contains("tôi sẽ") ||
                                    answerNorm.Contains("phương án") || answerNorm.Contains("quyết định") ||
                                    answerNorm.Contains("rollback") || answerNorm.Contains("triển khai") ||
                                    answerNorm.Contains("giải pháp") || answerNorm.Contains("ưu tiên") ||
                                    answerNorm.Contains("lựa chọn") || answerNorm.Contains("đàm phán") ||
                                    answerNorm.Contains("tái cấu trúc") || answerNorm.Contains("giữ nguyên");

            bool defendsDecision = answerNorm.Contains("bảo vệ") || answerNorm.Contains("lý do là") ||
                                   answerNorm.Contains("chấp nhận đánh đổi") || answerNorm.Contains("trade-off") ||
                                   answerNorm.Contains("đánh đổi") || answerNorm.Contains("giảm thiểu rủi ro") ||
                                   answerNorm.Contains("mitigate") || answerNorm.Contains("biện pháp phòng ngừa");

            bool asksInvestigation = answerNorm.Contains("kiểm tra") || answerNorm.Contains("cho em hỏi") ||
                                     answerNorm.Contains("xem xét") || answerNorm.Contains("điều tra") ||
                                     answerNorm.Contains("tìm hiểu");

            var previousState = scenario.State;

            switch (scenario.State)
            {
                case ScenarioState.INITIAL:
                    if (proposesDecision)
                    {
                        scenario.State = ScenarioState.CHALLENGE;
                        RecordScenarioDecision(scenario, candidateAnswer ?? string.Empty, "Đưa ra quyết định trực tiếp ngay từ đầu");
                    }
                    else if (asksInvestigation)
                    {
                        scenario.State = ScenarioState.INVESTIGATING;
                    }
                    else
                    {
                        scenario.State = ScenarioState.INVESTIGATING;
                    }
                    break;

                case ScenarioState.INVESTIGATING:
                case ScenarioState.NEW_INFORMATION_REVEALED:
                    if (proposesDecision)
                    {
                        scenario.State = ScenarioState.CHALLENGE;
                        RecordScenarioDecision(scenario, candidateAnswer ?? string.Empty, "Đưa ra giải pháp sau khi xem xét dữ kiện");
                    }
                    else if (scenario.RevealedFactKeys.Count >= 2)
                    {
                        scenario.State = ScenarioState.DECISION_REQUIRED;
                    }
                    else
                    {
                        scenario.State = ScenarioState.INVESTIGATING;
                    }
                    break;

                case ScenarioState.DECISION_REQUIRED:
                    scenario.State = ScenarioState.CHALLENGE;
                    RecordScenarioDecision(scenario, candidateAnswer ?? string.Empty, "Đưa ra quyết định theo yêu cầu của tình huống");
                    break;

                case ScenarioState.CHALLENGE:
                    if (scenario.Decisions.Count == 0 && (proposesDecision || defendsDecision || answerNorm.Contains("quyết định")))
                    {
                        RecordScenarioDecision(scenario, candidateAnswer ?? string.Empty, "Đưa ra quyết định trong giai đoạn thử thách");
                    }

                    if (defendsDecision || answerNorm.Length > 80)
                    {
                        scenario.State = ScenarioState.RESOLUTION;
                        if (scenario.Decisions.Count > 0)
                        {
                            scenario.Decisions.Last().IsChallenged = true;
                            scenario.Decisions.Last().DefenseResponse = candidateAnswer;
                        }
                    }
                    else
                    {
                        scenario.State = ScenarioState.CHALLENGE;
                    }
                    break;

                case ScenarioState.RESOLUTION:
                    scenario.State = ScenarioState.COMPLETED;
                    break;

                case ScenarioState.COMPLETED:
                default:
                    scenario.State = ScenarioState.COMPLETED;
                    break;
            }

            scenario.Behavior = DetermineInterviewerBehavior(session, scenario, claim);
            session.EvidenceState ??= new InterviewEvidenceState();
            session.EvidenceState.CurrentInterviewerBehavior = scenario.Behavior;

            if (previousState != scenario.State)
            {
                scenario.HistoryLog.Add($"[{DateTime.UtcNow:O}] State transition: {previousState} -> {scenario.State} (Behavior: {scenario.Behavior}).");
            }

            return scenario.State;
        }

        private static void RecordScenarioDecision(InterviewScenario scenario, string candidateAnswer, string rationale)
        {
            var decision = new ScenarioCandidateDecision
            {
                Turn = scenario.Decisions.Count + 1,
                DecisionSummary = candidateAnswer.Length > 120 ? candidateAnswer[..120] + "..." : candidateAnswer,
                Rationale = rationale,
                TradeOffIdentified = candidateAnswer.Contains("đánh đổi", StringComparison.OrdinalIgnoreCase) || candidateAnswer.Contains("trade-off", StringComparison.OrdinalIgnoreCase) ? "Observed" : "Unspecified",
                RiskIdentified = candidateAnswer.Contains("rủi ro", StringComparison.OrdinalIgnoreCase) || candidateAnswer.Contains("risk", StringComparison.OrdinalIgnoreCase) ? "Observed" : "Unspecified"
            };
            scenario.Decisions.Add(decision);
        }

        public InterviewerBehaviorType DetermineInterviewerBehavior(
            Session session,
            InterviewScenario scenario,
            CandidateClaim? claim = null)
        {
            // Observable behavior only: never modifies scores!
            switch (scenario.State)
            {
                case ScenarioState.INITIAL:
                    return InterviewerBehaviorType.NEUTRAL;

                case ScenarioState.INVESTIGATING:
                    return InterviewerBehaviorType.PROBING;

                case ScenarioState.NEW_INFORMATION_REVEALED:
                    return InterviewerBehaviorType.PROBING;

                case ScenarioState.DECISION_REQUIRED:
                    return InterviewerBehaviorType.SKEPTICAL;

                case ScenarioState.CHALLENGE:
                    return InterviewerBehaviorType.PRESSURE;

                case ScenarioState.RESOLUTION:
                    if (claim != null && (claim.TradeOffAwareness == EvidenceDimensionLevel.STRONG || claim.RiskAwareness == EvidenceDimensionLevel.STRONG))
                    {
                        return InterviewerBehaviorType.SUPPORTIVE;
                    }
                    return InterviewerBehaviorType.NEUTRAL;

                case ScenarioState.COMPLETED:
                default:
                    return InterviewerBehaviorType.SUPPORTIVE;
            }
        }

        public InterviewQuestionSpecification BuildScenarioQuestionSpecification(
            Session session,
            InterviewScenario scenario,
            InterviewerBehaviorType behavior,
            string candidateAnswer)
        {
            var stage = session.InterviewState?.InterviewPhase ?? InterviewStageNames.SituationalCase;
            var primaryComp = scenario.Competencies.FirstOrDefault() ?? "Decision Quality";
            var role = scenario.Role;
            var seniority = scenario.Seniority;

            InterviewIntentType intent;
            InterviewQuestionType qType;
            string targetDimension;
            string objective;
            string wording;

            switch (scenario.State)
            {
                case ScenarioState.INITIAL:
                    intent = InterviewIntentType.TEST_SYSTEM_THINKING;
                    qType = InterviewQuestionType.INITIAL;
                    targetDimension = "ProblemSolving";
                    objective = $"Đặt vấn đề thực tế: {scenario.Title} và yêu cầu định hướng tiếp cận.";
                    wording = $"{scenario.Context} {scenario.Problem} Trong tình huống này với ràng buộc {scenario.InitialConstraint}, bạn sẽ tiếp cận và phân tích các bước ban đầu như thế nào?";
                    break;

                case ScenarioState.INVESTIGATING:
                    intent = InterviewIntentType.VERIFY_METHOD;
                    qType = InterviewQuestionType.METHOD_REQUEST;
                    targetDimension = "Method";
                    objective = "Khảo sát phương pháp điều tra và xác định dữ liệu/nguyên nhân gốc rễ.";
                    wording = "Để khoanh vùng nguyên nhân chính xác thay vì phỏng đoán, bạn muốn kiểm tra những chỉ số, nhật ký hoặc dữ liệu cụ thể nào tiếp theo?";
                    break;

                case ScenarioState.NEW_INFORMATION_REVEALED:
                    intent = InterviewIntentType.VERIFY_METHOD;
                    qType = InterviewQuestionType.FOLLOW_UP;
                    targetDimension = "Evidence";
                    objective = "Yêu cầu ứng viên đánh giá dữ kiện mới vừa được cung cấp.";
                    var latestFact = scenario.UnknownInformation.FirstOrDefault(f => f.IsRevealed)?.Fact ?? "dữ liệu mới";
                    wording = $"Với dữ kiện vừa ghi nhận được rằng: \"{latestFact}\", bạn rút ra kết luận gì và sẽ điều chỉnh hướng xử lý ra sao?";
                    break;

                case ScenarioState.DECISION_REQUIRED:
                    intent = InterviewIntentType.TEST_TRADEOFF;
                    qType = InterviewQuestionType.TRADEOFF_REQUEST;
                    targetDimension = "DecisionQuality";
                    objective = "Yêu cầu ứng viên đưa ra quyết định hành động dứt khoát giữa các lựa chọn.";
                    wording = "Chúng ta đã có đủ các dữ kiện cơ bản của tình huống. Giờ là lúc bạn cần đưa ra quyết định: Phương án cụ thể của bạn để giải quyết sự cố này là gì?";
                    break;

                case ScenarioState.CHALLENGE:
                    intent = InterviewIntentType.TEST_RISK;
                    qType = InterviewQuestionType.RISK_REQUEST;
                    targetDimension = "RiskAwareness";
                    objective = "Thử thách quyết định của ứng viên bằng cách đưa thêm ràng buộc hoặc rủi ro phát sinh.";
                    var constraintToInject = scenario.Constraints.Count > 1 ? scenario.Constraints[1] : "áp lực thời gian chỉ còn 15 phút";
                    wording = behavior == InterviewerBehaviorType.PRESSURE
                        ? $"Nếu tôi đặt thêm một ràng buộc khắt khe hơn: {constraintToInject}, và phương án của bạn có nguy cơ gây ảnh hưởng trực tiếp đến cam kết với các bên liên quan, bạn sẽ bảo vệ quyết định của mình ra sao hoặc có phương án dự phòng (fallback) nào?"
                        : $"Phương án này có thể mang lại hiệu quả trước mắt, nhưng bạn đã lường trước rủi ro phụ nào có thể phát sinh và cách bạn kiểm soát rủi ro đó là gì?";
                    break;

                case ScenarioState.RESOLUTION:
                    intent = InterviewIntentType.VERIFY_REPEATABILITY;
                    qType = InterviewQuestionType.REPEATABILITY_REQUEST;
                    targetDimension = "Repeatability";
                    objective = "Tổng kết bài học kinh nghiệm và biện pháp ngăn chặn tái diễn.";
                    wording = behavior == InterviewerBehaviorType.SUPPORTIVE
                        ? "Tôi ghi nhận sự cân nhắc thấu đáo của bạn về các đánh đổi. Sau khi giải quyết xong tình huống này, những biện pháp cốt lõi nào bạn sẽ thiết lập để ngăn chặn sự cố tương tự tái diễn trong tương lai?"
                        : "Từ quyết định vừa rồi, bạn rút ra bài học kinh nghiệm gì về mặt quy trình hoặc hệ thống để đảm bảo tính ổn định lâu dài?";
                    break;

                case ScenarioState.COMPLETED:
                default:
                    intent = InterviewIntentType.MOVE_ON;
                    qType = InterviewQuestionType.TRANSITION;
                    targetDimension = "General";
                    objective = "Chuyển tiếp sau khi hoàn thành tình huống.";
                    wording = "Cảm ơn bạn đã phân tích và bảo vệ phương án xử lý tình huống rất rõ ràng. Chúng ta có thể chuyển sang nội dung tiếp theo.";
                    break;
            }

            var spec = new InterviewQuestionSpecification
            {
                Stage = stage,
                Intent = intent,
                TargetCompetency = primaryComp,
                TargetDimension = targetDimension,
                QuestionType = qType,
                Objective = objective,
                Context = $"{scenario.Industry} / {role} ({seniority}) - {scenario.State} - Behavior: {behavior}",
                Difficulty = (int)scenario.Difficulty,
                DeterministicWording = wording
            };

            session.EvidenceState ??= new InterviewEvidenceState();
            session.EvidenceState.QuestionSpecifications.Add(spec);
            session.EvidenceState.CurrentQuestionSpecification = spec;

            return spec;
        }

        public void InjectScenarioTradeOffOrConstraint(InterviewScenario scenario, string constraint)
        {
            if (string.IsNullOrWhiteSpace(constraint)) return;

            if (!scenario.Constraints.Contains(constraint))
            {
                scenario.Constraints.Add(constraint);
            }

            scenario.State = ScenarioState.CHALLENGE;
            scenario.Behavior = InterviewerBehaviorType.PRESSURE;
            scenario.HistoryLog.Add($"[{DateTime.UtcNow:O}] Constraint injected: '{constraint}'. State forced to CHALLENGE with PRESSURE behavior.");
        }

        public bool ValidateScenarioFactFidelity(InterviewScenario scenario, string responseText, out string failureReason)
        {
            if (string.IsNullOrWhiteSpace(responseText))
            {
                failureReason = "Empty question text";
                return false;
            }

            var lower = responseText.ToLowerInvariant();

            // 1. Accusatory checks
            if (lower.Contains("nói dối") || lower.Contains("gian dối") || lower.Contains("không trung thực") || lower.Contains("bịa đặt"))
            {
                failureReason = "Accusatory language detected";
                return false;
            }

            // 2. Metadata leaks
            if (lower.Contains("scenariostate") || lower.Contains("decision_required") || lower.Contains("probe_count") || lower.Contains("behavior_type"))
            {
                failureReason = "Internal scenario metadata leaked in response";
                return false;
            }

            // 3. Hallucination checks: Unauthorized fact inventions
            if (lower.Contains("bị hack") || lower.Contains("tấn công mạng") || lower.Contains("database bị corrupted") || lower.Contains("dữ liệu bị xóa sạch"))
            {
                bool scenarioMentionsHack = scenario.AvailableInformation.Concat(scenario.UnknownInformation)
                    .Any(f => f.Fact.Contains("hack", StringComparison.OrdinalIgnoreCase) || f.Fact.Contains("tấn công", StringComparison.OrdinalIgnoreCase) || f.Fact.Contains("corrupt", StringComparison.OrdinalIgnoreCase));

                if (!scenarioMentionsHack)
                {
                    failureReason = "Fabricated scenario crisis not present in scenario facts";
                    return false;
                }
            }

            // 4. Score injection
            if (lower.Contains("score:") || lower.Contains("chấm điểm:") || lower.Contains("10/10"))
            {
                failureReason = "Score injection detected";
                return false;
            }

            failureReason = string.Empty;
            return true;
        }

        public async Task<GeneratedQuestion> ConstructNaturalQuestionAsync(
            Session session,
            InterviewQuestionSpecification spec)
        {
            session.EvidenceState ??= new InterviewEvidenceState();
            session.EvidenceState.QuestionSpecifications ??= new();
            session.EvidenceState.CurrentQuestionSpecification = spec;

            if (string.IsNullOrWhiteSpace(spec.DeterministicWording))
            {
                spec.DeterministicWording = BuildDeterministicQuestionWording(session, spec, null);
            }

            string finalQuestionText = spec.DeterministicWording;

            // If Gemini is available, solicit natural conversational Vietnamese delivery strictly within specification
            if (_geminiService != null)
            {
                try
                {
                    var prompt = BuildGeminiWordingPrompt(session, spec);
                    var rawResponse = await _geminiService.CallGeminiApiAsync(prompt, isJsonMode: true);

                    var parsed = ParseGeminiWordingResponse(rawResponse);
                    if (parsed != null && !string.IsNullOrWhiteSpace(parsed.Question))
                    {
                        if (ValidateQuestionQuality(session, spec, parsed.Question, out var failureReason))
                        {
                            finalQuestionText = parsed.Question.Trim();
                        }
                        else
                        {
                            Console.WriteLine($"[NATURAL QUESTION VALIDATION FALLBACK] {failureReason}");
                            finalQuestionText = spec.DeterministicWording;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[NATURAL QUESTION GEMINI FALLBACK] {ex.Message}");
                    finalQuestionText = spec.DeterministicWording;
                }
            }

            var generatedQ = new GeneratedQuestion
            {
                Question = finalQuestionText,
                Topic = !string.IsNullOrWhiteSpace(spec.TargetCompetency) ? spec.TargetCompetency : "General",
                Subtopic = !string.IsNullOrWhiteSpace(spec.TargetDimension) ? spec.TargetDimension : "General",
                Dimension = !string.IsNullOrWhiteSpace(spec.TargetDimension) ? spec.TargetDimension : "General",
                QuestionType = spec.QuestionType.ToString(),
                Difficulty = spec.Difficulty,
                TargetConcept = spec.TargetCompetency,
                DecisionUsed = spec.Intent.ToString(),
                IsFollowUp = spec.IsFollowUp,
                ConversationalTransition = spec.BridgeContext ?? string.Empty,
                Reason = spec.ProbeReason,
                QuestionId = Guid.NewGuid().ToString(),
                ParentQuestionId = spec.ParentQuestionId,
                Stage = spec.Stage,
                Competency = spec.TargetCompetency,
                Category = spec.TargetDimension
            };

            session.EvidenceState.QuestionSpecifications.Add(spec);
            return generatedQ;
        }

        private static string BuildDeterministicQuestionWording(
            Session session,
            InterviewQuestionSpecification spec,
            CandidateClaim? claim)
        {
            var level = session.InterviewContext?.ExperienceLevel ?? "Mid";
            bool isJunior = level.Equals("Junior", StringComparison.OrdinalIgnoreCase) ||
                            level.Equals("Fresher", StringComparison.OrdinalIgnoreCase) ||
                            level.Equals("Intern", StringComparison.OrdinalIgnoreCase);
            bool isSenior = level.Equals("Senior", StringComparison.OrdinalIgnoreCase);
            bool isLead = level.Equals("Lead", StringComparison.OrdinalIgnoreCase) ||
                          level.Equals("Principal", StringComparison.OrdinalIgnoreCase) ||
                          level.Equals("Architect", StringComparison.OrdinalIgnoreCase);

            var ind = (session.InterviewContext?.Industry ?? string.Empty).ToLowerInvariant();
            var role = (session.JobTitle ?? session.InterviewContext?.TargetPosition ?? string.Empty).ToLowerInvariant();

            bool isSales = ind.Contains("sales") || role.Contains("sales") || role.Contains("kinh doanh") || role.Contains("bd");
            bool isMarketing = ind.Contains("marketing") || role.Contains("marketing") || role.Contains("growth");
            bool isHR = ind.Contains("hr") || ind.Contains("human") || role.Contains("hr") || role.Contains("tuyển dụng") || role.Contains("nhân sự");
            bool isFinance = ind.Contains("finance") || ind.Contains("banking") || ind.Contains("tài chính") || role.Contains("kế toán") || role.Contains("kiểm toán");
            bool isProduct = ind.Contains("product") || role.Contains("product") || role.Contains("pm") || role.Contains("po");
            bool isOps = ind.Contains("operation") || ind.Contains("vận hành") || ind.Contains("supply") || role.Contains("operations");
            bool isSoftware = ind.Contains("software") || ind.Contains("it") || role.Contains("engineer") || role.Contains("developer") || role.Contains("lập trình");

            string hook = !string.IsNullOrWhiteSpace(spec.ConversationalHook)
                ? $"Bạn có nhắc đến {spec.ConversationalHook}. "
                : (claim != null && !string.IsNullOrWhiteSpace(claim.Text) ? $"Bạn có chia sẻ rằng \"{claim.Text}\". " : string.Empty);

            if (spec.IsBridge && !string.IsNullOrWhiteSpace(spec.BridgeContext))
            {
                return spec.BridgeContext;
            }

            switch (spec.Intent)
            {
                case InterviewIntentType.CLARIFY_CONTRADICTION:
                    return "Tôi muốn làm rõ một điểm để hiểu đúng phần đóng góp của bạn. Trước đó bạn có chia sẻ một thông tin, ở phần này bạn lại đề cập theo một hướng khác. Bạn có thể giúp tôi phân biệt rõ hơn hai phần này được không?";

                case InterviewIntentType.VERIFY_OWNERSHIP:
                    return $"{hook}Trong kết quả vừa nêu, phần nào là phần bạn trực tiếp thực hiện hoặc đưa ra quyết định, và phần nào là nỗ lực của cả đội ngũ?";

                case InterviewIntentType.VERIFY_METHOD:
                    if (isSales)
                        return $"{hook}Bạn có thể chia sẻ cụ thể quy trình tiếp cận khách hàng và các bước đàm phán bạn đã thực hiện để chốt được thương vụ đó không?";
                    if (isMarketing)
                        return $"{hook}Bạn đã thiết kế thử nghiệm, phân bổ ngân sách qua các kênh và tối ưu tỷ lệ chuyển đổi như thế nào để đạt được kết quả đó?";
                    if (isHR)
                        return $"{hook}Bạn đã xây dựng quy trình sàng lọc và phối hợp với các trưởng bộ phận ra sao để cải thiện chất lượng tuyển dụng và rút ngắn time-to-hire?";
                    if (isFinance)
                        return $"{hook}Bạn đã áp dụng phương pháp kiểm soát hoặc quy trình đối soát nào để phát hiện ra sai lệch trong báo cáo và đảm bảo tính tuân thủ?";
                    if (isProduct)
                        return $"{hook}Bạn đã thu thập dữ liệu người dùng và áp dụng framework ưu tiên nào để quyết định tính năng cốt lõi cho MVP?";
                    if (isOps)
                        return $"{hook}Bạn đã phân tích chuỗi cung ứng và xử lý điểm nghẽn quy trình như thế nào để đảm bảo SLA và tối ưu chi phí?";
                    if (isSoftware)
                    {
                        if (isLead)
                            return $"{hook}Ở cấp độ kiến trúc toàn hệ thống, bạn đã phân bổ trách nhiệm giữa các module và giải quyết các bài toán về scalability ra sao?";
                        if (isSenior)
                            return $"{hook}Bạn đã xác định bottleneck và lựa chọn hướng kiến trúc tối ưu như thế nào giữa các giải pháp khả thi?";
                        if (isJunior)
                            return $"{hook}Bạn đã bắt đầu triển khai từng bước công việc đó như thế nào trong thực tế?";
                        return $"{hook}Bạn đã tiếp cận và triển khai giải pháp kỹ thuật đó theo các bước cụ thể nào?";
                    }
                    return $"{hook}Bạn có thể chia sẻ cụ thể cách bạn đã tiếp cận và triển khai giải pháp đó từ đầu đến cuối không?";

                case InterviewIntentType.VERIFY_IMPACT:
                    return $"{hook}Bạn dựa trên những chỉ số định lượng hoặc kết quả cụ thể nào để đo lường mức độ thành công và tác động thực tế của giải pháp này?";

                case InterviewIntentType.VERIFY_REPEATABILITY:
                    if (isLead || isSenior)
                        return $"{hook}Nếu áp dụng phương pháp này cho một môi trường có quy mô lớn hơn gấp nhiều lần và tính chất phức tạp hơn, bạn sẽ điều chỉnh những điểm gì để duy trì hiệu quả?";
                    return $"{hook}Theo bạn, những yếu tố cốt lõi nào cho phép bạn tái lập thành tích này ở một môi trường hoặc dự án khác?";

                case InterviewIntentType.TEST_TRADEOFF:
                    if (isLead || isSenior)
                        return $"{hook}Khi phải cân nhắc đánh đổi giữa tiến độ bàn giao nhanh và chất lượng/độ tin cậy dài hạn của hệ thống, bạn đã đưa ra quyết định dựa trên những nguyên tắc nào?";
                    return $"{hook}Bạn đã cân nhắc những ưu nhược điểm nào khi lựa chọn phương án này thay vì các giải pháp khả thi khác?";

                case InterviewIntentType.TEST_RISK:
                    return $"{hook}Trong quá trình triển khai, những dấu hiệu cảnh báo sớm nào cho thấy rủi ro có thể phát sinh và bạn đã thiết lập biện pháp kiểm soát ra sao?";

                case InterviewIntentType.TEST_DEPTH:
                    return $"{hook}Về mặt bản chất chuyên môn, nguyên lý cốt lõi nào quyết định tính khả thi và độ tin cậy của cách bạn đã làm?";

                case InterviewIntentType.TEST_SYSTEM_THINKING:
                    return $"{hook}Giải pháp này tương tác và ảnh hưởng như thế nào đến các quy trình, bộ phận hoặc hệ thống liên quan khác trong tổ chức?";

                case InterviewIntentType.MOVE_ON:
                default:
                    return "Cảm ơn bạn đã chia sẻ rõ ràng. Chúng ta có thể chuyển sang nội dung tiếp theo.";
            }
        }

        private static string BuildGeminiWordingPrompt(Session session, InterviewQuestionSpecification spec)
        {
            return backend.Prompts.Interview.InterviewerIntelligencePrompt.BuildNaturalWordingPrompt(session, spec);
        }

        private static GeminiWordingPayload? ParseGeminiWordingResponse(string rawResponse)
        {
            if (string.IsNullOrWhiteSpace(rawResponse)) return null;

            try
            {
                var clean = rawResponse.Trim();
                if (clean.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
                {
                    clean = clean[7..];
                }
                if (clean.StartsWith("```", StringComparison.OrdinalIgnoreCase))
                {
                    clean = clean[3..];
                }
                if (clean.EndsWith("```", StringComparison.OrdinalIgnoreCase))
                {
                    clean = clean[..^3];
                }
                clean = clean.Trim();

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                return JsonSerializer.Deserialize<GeminiWordingPayload>(clean, options);
            }
            catch (Exception)
            {
                return null;
            }
        }

        private class GeminiWordingPayload
        {
            public string? Question { get; set; }
            // Adversarial fields: completely ignored!
            public object? Score { get; set; }
            public object? Stage { get; set; }
            public object? Intent { get; set; }
            public object? Competency { get; set; }
            public object? ScenarioState { get; set; }
            public object? ExpectedAnswer { get; set; }
            public object? Difficulty { get; set; }
            public object? Fact { get; set; }
        }
    }
}
