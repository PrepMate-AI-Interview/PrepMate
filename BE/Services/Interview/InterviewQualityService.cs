using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using backend.Models;

namespace backend.Services.Interview
{
    public class InterviewQualityService : IInterviewQualityService
    {
        private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
        {
            "là", "gì", "hãy", "cho", "biết", "bạn", "của", "và", "như", "thế", "nào",
            "ra", "sao", "có", "thể", "nêu", "trình", "bày", "về", "trong", "đã", "được",
            "với", "khi", "làm", "một", "các", "những", "tại", "sao", "để", "thì", "mà",
            "what", "is", "how", "why", "can", "you", "tell", "me", "about", "your",
            "the", "a", "an", "in", "to", "of", "and", "explain", "describe", "please"
        };

        private static readonly string[] FatiguePhrases = new[]
        {
            "mệt", "đuối", "nhanh hơn", "kết thúc sớm", "dừng lại", "bỏ qua", "chuyển câu",
            "hơi mệt", "khá mệt", "mỏi", "tired", "exhausted", "move fast", "skip this",
            "đi nhanh hơn", "muốn đi nhanh hơn", "nhanh hơn được không"
        };

        private static readonly string[] IgnorancePhrases = new[]
        {
            "không biết", "chưa tìm hiểu", "chưa rõ", "chưa làm bao giờ", "em chịu",
            "don't know", "no idea", "haven't learned", "haven't used", "chưa nắm"
        };

        public InterviewQualityState InitializeQualityState(Session session, string? seniority = null)
        {
            var levelStr = seniority
                ?? session.InterviewContext?.ExperienceLevel
                ?? session.InterviewState?.CandidateLevel
                ?? "Junior";

            var normalizedSeniority = NormalizeSeniority(levelStr);

            InterviewDifficultyLevel initialDifficulty;
            InterviewDifficultyLevel ceiling;
            InterviewPressureLevel initialPressure;

            switch (normalizedSeniority)
            {
                case "Intern":
                case "Fresher":
                    initialDifficulty = InterviewDifficultyLevel.FOUNDATION;
                    ceiling = InterviewDifficultyLevel.ADVANCED;
                    initialPressure = InterviewPressureLevel.CALM;
                    break;

                case "Junior":
                    initialDifficulty = InterviewDifficultyLevel.STANDARD;
                    ceiling = InterviewDifficultyLevel.ADVANCED;
                    initialPressure = InterviewPressureLevel.NORMAL;
                    break;

                case "Mid":
                    initialDifficulty = InterviewDifficultyLevel.STANDARD;
                    ceiling = InterviewDifficultyLevel.CHALLENGING;
                    initialPressure = InterviewPressureLevel.NORMAL;
                    break;

                case "Senior":
                case "Lead":
                default:
                    initialDifficulty = InterviewDifficultyLevel.STANDARD;
                    ceiling = InterviewDifficultyLevel.CHALLENGING;
                    initialPressure = InterviewPressureLevel.NORMAL;
                    break;
            }

            var state = new InterviewQualityState
            {
                CurrentDifficulty = initialDifficulty,
                PreviousDifficulty = initialDifficulty,
                DifficultyCeiling = ceiling,
                PressureLevel = initialPressure,
                EngagementLevel = CandidateEngagementLevel.NORMAL,
                FatigueDetected = false,
                ConsecutiveShortAnswers = 0,
                ConsecutiveStrongAnswers = 0,
                ConsecutiveWeakAnswers = 0,
                LastAction = NextInterviewAction.MAINTAIN_DIFFICULTY,
                QuestionsSinceTopicChange = 0,
                PreventedDuplicatesCount = 0,
                TotalTransitionsCount = 0,
                TotalProbesCount = 0,
                CumulativePressure = (int)initialPressure,
                PressureSamplesCount = 1,
                QuestionsPerDifficulty = new Dictionary<string, int>
                {
                    [initialDifficulty.ToString()] = 0
                }
            };

            session.QualityState = state;
            if (session.InterviewState != null)
            {
                session.InterviewState.QualityState = state;
            }

            return state;
        }

        public AnswerQualityLevel EvaluateAnswerQuality(
            string answer,
            AnswerAnalysis? analysis = null,
            ClaimEvidence? claimEvidence = null,
            BehavioralEvidence? star = null,
            SituationalEvidence? sit = null)
        {
            if (string.IsNullOrWhiteSpace(answer) || answer.Trim().Length < 15)
            {
                return AnswerQualityLevel.VERY_WEAK;
            }

            var trimmed = answer.Trim();
            var lower = trimmed.ToLowerInvariant();

            foreach (var phrase in IgnorancePhrases)
            {
                if (lower.Contains(phrase) && trimmed.Length < 40)
                {
                    return AnswerQualityLevel.VERY_WEAK;
                }
            }

            // Evidence source 1: ClaimEvidence
            if (claimEvidence != null)
            {
                if (claimEvidence.EvidenceStrength == "Strong" && claimEvidence.OverallSpecificity == EvidenceDimensionLevel.STRONG)
                {
                    return AnswerQualityLevel.VERY_STRONG;
                }
                if (claimEvidence.EvidenceStrength == "Strong")
                {
                    return AnswerQualityLevel.STRONG;
                }
                if (claimEvidence.EvidenceStrength == "Moderate")
                {
                    return AnswerQualityLevel.ADEQUATE;
                }
                if (claimEvidence.EvidenceStrength == "Weak")
                {
                    return AnswerQualityLevel.WEAK;
                }
            }

            // Evidence source 2: STAR Behavioral
            if (star != null)
            {
                if (star.EvidenceStrength == "Strong" && star.IsComplete && star.Ownership == "High") return AnswerQualityLevel.VERY_STRONG;
                if (star.EvidenceStrength == "Strong" || star.IsComplete) return AnswerQualityLevel.STRONG;
                if (star.EvidenceStrength == "Moderate" || star.MissingComponents.Count <= 1) return AnswerQualityLevel.ADEQUATE;
                return AnswerQualityLevel.WEAK;
            }

            // Evidence source 3: Situational Case
            if (sit != null)
            {
                if (sit.EvidenceStrength == "Strong" && sit.ReasoningQuality == "High") return AnswerQualityLevel.VERY_STRONG;
                if (sit.EvidenceStrength == "Strong" || sit.ActionPlan.Count >= 2) return AnswerQualityLevel.STRONG;
                if (sit.EvidenceStrength == "Moderate" || !string.IsNullOrWhiteSpace(sit.DecisionMaking)) return AnswerQualityLevel.ADEQUATE;
                return AnswerQualityLevel.WEAK;
            }

            // Evidence source 4: Technical Answer Analysis
            if (analysis != null)
            {
                if (analysis.CorrectConcepts.Count >= 3 && analysis.IncorrectConcepts.Count == 0) return AnswerQualityLevel.VERY_STRONG;
                if (analysis.CorrectConcepts.Count >= 1 && analysis.IncorrectConcepts.Count == 0) return AnswerQualityLevel.STRONG;
                if (analysis.IncorrectConcepts.Count > analysis.CorrectConcepts.Count) return AnswerQualityLevel.WEAK;
                return AnswerQualityLevel.ADEQUATE;
            }

            // Fallback heuristic based on length and structure
            bool hasMetricsOrTech = Regex.IsMatch(lower, @"\d+\s*(k|m|%|rps|ms|s|user|tps|triệu|nghìn)") ||
                                    lower.Contains("redis") || lower.Contains("kafka") || lower.Contains("sql") ||
                                    lower.Contains("cache") || lower.Contains("index") || lower.Contains("docker") ||
                                    lower.Contains("tối ưu") || lower.Contains("thực tế") || lower.Contains("kiến trúc");

            if (trimmed.Length >= 60 && hasMetricsOrTech)
            {
                return AnswerQualityLevel.STRONG;
            }
            if (trimmed.Length > 200 && (lower.Contains("vì") || lower.Contains("bởi vì") || lower.Contains("do đó") || lower.Contains("thực tế") || lower.Contains("ví dụ")))
            {
                return AnswerQualityLevel.STRONG;
            }
            if (trimmed.Length >= 40)
            {
                return AnswerQualityLevel.ADEQUATE;
            }

            return AnswerQualityLevel.WEAK;
        }

        public (CandidateEngagementLevel Level, bool FatigueDetected) DetectEngagementAndFatigue(
            Session session,
            string answer,
            int turn)
        {
            var state = session.QualityState ?? session.InterviewState?.QualityState ?? InitializeQualityState(session);
            var lower = (answer ?? string.Empty).ToLowerInvariant();

            bool explicitFatigue = FatiguePhrases.Any(p => lower.Contains(p));
            bool isShort = (answer ?? string.Empty).Trim().Length <= 20;

            if (isShort)
            {
                state.ConsecutiveShortAnswers++;
            }
            else
            {
                state.ConsecutiveShortAnswers = 0;
            }

            // Case B & C: Explicit fatigue statement triggers confirmed fatigue adaptation immediately
            if (explicitFatigue)
            {
                state.FatigueStatus = FatigueSignalStatus.FATIGUE_CONFIRMED;
                state.FatigueDetected = true;
                state.FatigueTriggerCount++;
                state.EngagementLevel = CandidateEngagementLevel.LOW;
                return (CandidateEngagementLevel.LOW, true);
            }

            // Case E: Persistent pattern of short answers (>= 4 consecutive) activates possible fatigue / low engagement signal
            if (state.ConsecutiveShortAnswers >= 4)
            {
                state.FatigueStatus = FatigueSignalStatus.POSSIBLE_FATIGUE;
                state.FatigueDetected = true;
                state.FatigueTriggerCount++;
                state.EngagementLevel = CandidateEngagementLevel.LOW;
                return (CandidateEngagementLevel.LOW, true);
            }

            // Case A: 2 or 3 short answers without fatigue statement is a SHORT_ANSWER_PATTERN, NOT automatic fatigue diagnosis
            if (state.ConsecutiveShortAnswers >= 2)
            {
                state.FatigueStatus = FatigueSignalStatus.SHORT_ANSWER_PATTERN;
                state.FatigueDetected = false;
                state.EngagementLevel = CandidateEngagementLevel.NORMAL;
                return (CandidateEngagementLevel.NORMAL, false);
            }

            state.FatigueStatus = FatigueSignalStatus.NONE;
            state.FatigueDetected = false;

            // Case D: Rich detailed answer (>= 100 chars) clears short streak and sets engagement HIGH
            if ((answer ?? string.Empty).Trim().Length >= 100)
            {
                state.EngagementLevel = CandidateEngagementLevel.HIGH;
                return (CandidateEngagementLevel.HIGH, false);
            }

            state.EngagementLevel = CandidateEngagementLevel.NORMAL;
            return (CandidateEngagementLevel.NORMAL, false);
        }

        public (NextInterviewAction Action, InterviewDifficultyLevel NewDifficulty, string Reason) DecideNextAdaptiveAction(
            Session session,
            AnswerQualityLevel quality,
            bool fatigueDetected,
            bool evidenceSufficient,
            int currentProbeCount,
            int probeLimit = 3,
            string? currentCompetency = null)
        {
            var state = session.QualityState ?? session.InterviewState?.QualityState ?? InitializeQualityState(session);
            var seniority = session.InterviewContext?.ExperienceLevel ?? session.InterviewState?.CandidateLevel ?? "Mid";

            // Track answer streaks
            if (quality >= AnswerQualityLevel.STRONG)
            {
                state.ConsecutiveStrongAnswers++;
                state.ConsecutiveWeakAnswers = 0;
                var comp = currentCompetency ?? session.InterviewState?.CurrentTopic ?? "General";
                state.RecentStrongCompetencies.Add(comp);
            }
            else if (quality <= AnswerQualityLevel.WEAK)
            {
                state.ConsecutiveWeakAnswers++;
                state.ConsecutiveStrongAnswers = 0;
            }
            else
            {
                // Adequate resets extreme streaks
                state.ConsecutiveStrongAnswers = Math.Max(0, state.ConsecutiveStrongAnswers - 1);
                state.ConsecutiveWeakAnswers = Math.Max(0, state.ConsecutiveWeakAnswers - 1);
            }

            // Priority 1: Fatigue detected -> Ease pressure and transition
            if (fatigueDetected)
            {
                var lowerDiff = (int)state.CurrentDifficulty > (int)InterviewDifficultyLevel.FOUNDATION
                    ? (InterviewDifficultyLevel)((int)state.CurrentDifficulty - 1)
                    : InterviewDifficultyLevel.FOUNDATION;

                lowerDiff = EnforceSeniorityCeiling(lowerDiff, seniority);
                state.PreviousDifficulty = state.CurrentDifficulty;
                state.CurrentDifficulty = lowerDiff;
                state.LastAction = NextInterviewAction.MOVE_ON;
                state.LastTransitionReason = TopicTransitionReason.CANDIDATE_FATIGUE;

                return (NextInterviewAction.MOVE_ON, lowerDiff, "Candidate fatigue signal detected; moving forward and reducing pressure.");
            }

            // Priority 2: Probe limit reached
            if (currentProbeCount >= probeLimit)
            {
                state.LastAction = NextInterviewAction.MOVE_ON;
                state.LastTransitionReason = TopicTransitionReason.PROBE_LIMIT_REACHED;
                return (NextInterviewAction.MOVE_ON, state.CurrentDifficulty, $"Probe limit of {probeLimit} reached on current topic.");
            }

            // Priority 3: Dynamic difficulty step-up on consecutive strong answers
            if (state.ConsecutiveStrongAnswers >= 2)
            {
                // Hardening: Do NOT increase global difficulty if merely repeating narrow basic questions on the same basic competency (e.g. REST basics)
                bool isNarrowBasicsRepeat = false;
                if (state.RecentStrongCompetencies.Count >= 2)
                {
                    var c1 = state.RecentStrongCompetencies[^2].ToLowerInvariant();
                    var c2 = state.RecentStrongCompetencies[^1].ToLowerInvariant();
                    if (c1 == c2 && (c1.Contains("basic") || c1.Contains("cơ bản") || c1.Contains("foundational")))
                    {
                        isNarrowBasicsRepeat = true;
                    }
                }

                if (isNarrowBasicsRepeat)
                {
                    state.LastAction = NextInterviewAction.MOVE_ON;
                    state.LastTransitionReason = TopicTransitionReason.EVIDENCE_SUFFICIENT;
                    return (NextInterviewAction.MOVE_ON, state.CurrentDifficulty, "Narrow basic competency demonstrated; moving on to next topic without premature difficulty escalation.");
                }

                if (state.CurrentDifficulty < state.DifficultyCeiling)
                {
                    var targetDiff = (InterviewDifficultyLevel)((int)state.CurrentDifficulty + 1);
                    var enforced = EnforceSeniorityCeiling(targetDiff, seniority);

                    if (enforced > state.CurrentDifficulty)
                    {
                        state.PreviousDifficulty = state.CurrentDifficulty;
                        state.CurrentDifficulty = enforced;
                        state.ConsecutiveStrongAnswers = 0;
                        state.LastAction = NextInterviewAction.INCREASE_DIFFICULTY;
                        return (NextInterviewAction.INCREASE_DIFFICULTY, enforced, "Consecutive strong answers demonstrate capability; stepping up difficulty.");
                    }
                }

                state.LastAction = NextInterviewAction.MOVE_ON;
                state.LastTransitionReason = TopicTransitionReason.EVIDENCE_SUFFICIENT;
                return (NextInterviewAction.MOVE_ON, state.CurrentDifficulty, "Candidate at ceiling with strong evidence; moving to next topic.");
            }

            // Priority 4: Evidence sufficient
            if (evidenceSufficient || quality == AnswerQualityLevel.VERY_STRONG)
            {
                state.LastAction = NextInterviewAction.MOVE_ON;
                state.LastTransitionReason = TopicTransitionReason.EVIDENCE_SUFFICIENT;
                return (NextInterviewAction.MOVE_ON, state.CurrentDifficulty, "Sufficient evidence obtained for current competency.");
            }

            // Priority 4: Weak answers & struggle
            if (quality == AnswerQualityLevel.VERY_WEAK || state.ConsecutiveWeakAnswers >= 2)
            {
                if ((int)state.CurrentDifficulty > (int)InterviewDifficultyLevel.FOUNDATION)
                {
                    var lowerDiff = (InterviewDifficultyLevel)((int)state.CurrentDifficulty - 1);
                    lowerDiff = EnforceSeniorityCeiling(lowerDiff, seniority);

                    state.PreviousDifficulty = state.CurrentDifficulty;
                    state.CurrentDifficulty = lowerDiff;
                    state.ConsecutiveWeakAnswers = 0;
                    state.LastAction = NextInterviewAction.DECREASE_DIFFICULTY;
                    return (NextInterviewAction.DECREASE_DIFFICULTY, lowerDiff, "Candidate struggling; stepping down difficulty to re-anchor foundation.");
                }

                if (currentProbeCount < 1)
                {
                    state.LastAction = NextInterviewAction.CLARIFY;
                    return (NextInterviewAction.CLARIFY, state.CurrentDifficulty, "Clarifying foundational concept.");
                }

                state.LastAction = NextInterviewAction.MOVE_ON;
                state.LastTransitionReason = TopicTransitionReason.TOPIC_EXHAUSTED;
                return (NextInterviewAction.MOVE_ON, state.CurrentDifficulty, "Topic exhausted after weak responses at foundation level.");
            }

            // Priority 5: Missing detail -> Probe or Clarify
            if (currentProbeCount < probeLimit)
            {
                if (quality == AnswerQualityLevel.WEAK)
                {
                    state.LastAction = NextInterviewAction.CLARIFY;
                    return (NextInterviewAction.CLARIFY, state.CurrentDifficulty, "Clarifying incomplete points.");
                }

                state.LastAction = NextInterviewAction.PROBE;
                state.TotalProbesCount++;
                return (NextInterviewAction.PROBE, state.CurrentDifficulty, "Probing deeper into technical reasoning and evidence.");
            }

            // Priority 6: Default maintain pace
            state.LastAction = NextInterviewAction.MAINTAIN_DIFFICULTY;
            return (NextInterviewAction.MAINTAIN_DIFFICULTY, state.CurrentDifficulty, "Maintaining current interview pace.");
        }

        public InterviewPressureLevel AdjustPressureLevel(
            Session session,
            string role,
            InterviewDifficultyLevel difficulty,
            CandidateEngagementLevel engagement,
            bool fatigueDetected,
            int turn)
        {
            var state = session.QualityState ?? session.InterviewState?.QualityState ?? InitializeQualityState(session);
            var seniority = NormalizeSeniority(session.InterviewContext?.ExperienceLevel ?? session.InterviewState?.CandidateLevel ?? "Junior");

            InterviewPressureLevel level;

            if (fatigueDetected || engagement == CandidateEngagementLevel.LOW)
            {
                level = InterviewPressureLevel.CALM;
            }
            else if (seniority == "Intern" || seniority == "Fresher")
            {
                level = InterviewPressureLevel.CALM;
            }
            else if (seniority == "Junior")
            {
                level = difficulty >= InterviewDifficultyLevel.ADVANCED ? InterviewPressureLevel.PROBING : InterviewPressureLevel.NORMAL;
            }
            else if (seniority == "Mid")
            {
                level = difficulty == InterviewDifficultyLevel.CHALLENGING ? InterviewPressureLevel.PROBING : InterviewPressureLevel.NORMAL;
            }
            else // Senior / Lead
            {
                if (difficulty == InterviewDifficultyLevel.CHALLENGING)
                {
                    level = InterviewPressureLevel.CHALLENGING;
                }
                else if (difficulty >= InterviewDifficultyLevel.ADVANCED)
                {
                    level = InterviewPressureLevel.PROBING;
                }
                else
                {
                    level = InterviewPressureLevel.NORMAL;
                }
            }

            state.PressureLevel = level;
            state.CumulativePressure += (int)level;
            state.PressureSamplesCount++;

            return level;
        }

        public bool IsQuestionSimilarOrDuplicate(
            Session session,
            string questionCandidate,
            string? competency = null,
            string? pattern = null,
            string? dimension = null,
            string? parentQuestionId = null)
        {
            if (string.IsNullOrWhiteSpace(questionCandidate)) return true;

            var state = session.QualityState ?? session.InterviewState?.QualityState ?? InitializeQualityState(session);
            var candTokens = CleanAndTokenize(questionCandidate);
            if (candTokens.Count == 0) return true;

            var normalizedCand = NormalizeText(questionCandidate);

            // 1. Check exact or near-exact match against all prior session questions
            if (session.Questions != null)
            {
                foreach (var q in session.Questions)
                {
                    if (NormalizeText(q) == normalizedCand)
                    {
                        state.PreventedDuplicatesCount++;
                        return true;
                    }
                }
            }

            if (session.Answers != null)
            {
                foreach (var a in session.Answers)
                {
                    if (NormalizeText(a.Question) == normalizedCand)
                    {
                        state.PreventedDuplicatesCount++;
                        return true;
                    }
                }
            }

            // 2. Check semantic fingerprints in quality state
            foreach (var fp in state.RecentFingerprints)
            {
                // Exact text match
                if (NormalizeText(fp.Text) == normalizedCand)
                {
                    state.PreventedDuplicatesCount++;
                    return true;
                }

                // If explicit dimension is specified and differs (e.g. OWNERSHIP vs DECISION),
                // they test completely different aspects -> ALLOW!
                if (!string.IsNullOrEmpty(dimension) && !string.IsNullOrEmpty(fp.Dimension) &&
                    !string.Equals(dimension, fp.Dimension, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                // If explicit pattern is specified and differs (e.g. METHOD vs EVIDENCE / VALIDATION),
                // they test different aspects -> ALLOW!
                if (!string.IsNullOrEmpty(pattern) && !string.IsNullOrEmpty(fp.Pattern) &&
                    !string.Equals(pattern, fp.Pattern, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                // Context discriminators: e.g. "team" vs "khách hàng" / "customer" / "client"
                var normCand = normalizedCand;
                var normFp = NormalizeText(fp.Text);
                bool candIsCustomer = normCand.Contains("khách") || normCand.Contains("customer") || normCand.Contains("client");
                bool fpIsCustomer = normFp.Contains("khách") || normFp.Contains("customer") || normFp.Contains("client");
                bool candIsTeam = normCand.Contains("team") || normCand.Contains("đội ngũ") || normCand.Contains("đồng nghiệp");
                bool fpIsTeam = normFp.Contains("team") || normFp.Contains("đội ngũ") || normFp.Contains("đồng nghiệp");

                if ((candIsCustomer && !fpIsCustomer && fpIsTeam) || (candIsTeam && !fpIsTeam && fpIsCustomer))
                {
                    // Different stakeholder / context (team conflict vs customer conflict) -> ALLOW!
                    continue;
                }

                // Method vs Validation discriminators
                bool candIsValidation = normCand.Contains("kiểm chứng") || normCand.Contains("đo lường") || normCand.Contains("hiệu quả");
                bool fpIsValidation = normFp.Contains("kiểm chứng") || normFp.Contains("đo lường") || normFp.Contains("hiệu quả");
                bool candIsMethod = (normCand.Contains("cách nào") || normCand.Contains("như thế nào") || normCand.Contains("phương pháp")) && !candIsValidation;
                bool fpIsMethod = (normFp.Contains("cách nào") || normFp.Contains("như thế nào") || normFp.Contains("phương pháp")) && !fpIsValidation;

                if ((candIsValidation && fpIsMethod) || (candIsMethod && fpIsValidation))
                {
                    // One asks for execution method, other asks for outcome validation -> ALLOW!
                    continue;
                }

                // Jaccard similarity of cleaned tokens
                double jaccard = CalculateJaccard(candTokens, fp.CleanedTokens);
                if (jaccard >= 0.50)
                {
                    state.PreventedDuplicatesCount++;
                    return true;
                }

                // Overlap coefficient: intersection / min(cand, fp)
                int intersection = candTokens.Count(t => fp.CleanedTokens.Contains(t, StringComparer.OrdinalIgnoreCase));
                int minTokens = Math.Min(candTokens.Count, fp.CleanedTokens.Count);
                if (minTokens >= 4 && ((double)intersection / minTokens) >= 0.75)
                {
                    state.PreventedDuplicatesCount++;
                    return true;
                }

                // If same competency & same pattern with domain term overlap
                if (!string.IsNullOrEmpty(competency) && !string.IsNullOrEmpty(fp.Competency) &&
                    string.Equals(competency, fp.Competency, StringComparison.OrdinalIgnoreCase))
                {
                    bool samePattern = !string.IsNullOrEmpty(pattern) && !string.IsNullOrEmpty(fp.Pattern) &&
                                       string.Equals(pattern, fp.Pattern, StringComparison.OrdinalIgnoreCase);

                    if (samePattern && (intersection >= 2 || jaccard >= 0.25))
                    {
                        state.PreventedDuplicatesCount++;
                        return true;
                    }
                }

                // Same parent question and identical probe intent
                if (!string.IsNullOrEmpty(parentQuestionId) && !string.IsNullOrEmpty(fp.ParentQuestionId) &&
                    parentQuestionId == fp.ParentQuestionId &&
                    string.Equals(pattern, fp.Pattern, StringComparison.OrdinalIgnoreCase))
                {
                    state.PreventedDuplicatesCount++;
                    return true;
                }
            }

            return false;
        }

        public void RecordQuestionFingerprint(
            Session session,
            string question,
            string? competency = null,
            string? pattern = null,
            string? dimension = null,
            string? parentQuestionId = null,
            int turn = 1)
        {
            var state = session.QualityState ?? session.InterviewState?.QualityState ?? InitializeQualityState(session);
            var tokens = CleanAndTokenize(question);

            var fp = new SemanticQuestionFingerprint
            {
                Text = question,
                CleanedTokens = tokens,
                Competency = competency,
                Pattern = pattern,
                Dimension = dimension,
                ParentQuestionId = parentQuestionId,
                TargetDomain = session.JobTitle,
                TurnNumber = turn
            };

            state.RecentFingerprints.Add(fp);

            var diffKey = state.CurrentDifficulty.ToString();
            if (!state.QuestionsPerDifficulty.ContainsKey(diffKey))
            {
                state.QuestionsPerDifficulty[diffKey] = 0;
            }
            state.QuestionsPerDifficulty[diffKey]++;
        }

        public string NaturalizeQuestionWithTransition(
            Session session,
            string rawQuestion,
            NextInterviewAction action,
            TopicTransitionReason? reason,
            AnswerQualityLevel lastQuality)
        {
            if (string.IsNullOrWhiteSpace(rawQuestion)) return rawQuestion;

            var trimmed = rawQuestion.Trim();

            // Do not double-prefix if already contains conversational greeting/bridge
            if (trimmed.StartsWith("Cảm ơn", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("Tuyệt vời", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("Rất tốt", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("Không sao", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("Chúng ta hãy", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("Được rồi", StringComparison.OrdinalIgnoreCase))
            {
                return trimmed;
            }

            var state = session.QualityState ?? session.InterviewState?.QualityState ?? InitializeQualityState(session);
            state.TotalTransitionsCount++;

            string prefix = action switch
            {
                NextInterviewAction.INCREASE_DIFFICULTY =>
                    "Rất tốt, câu trả lời vừa rồi cho thấy bạn nắm kiến thức khá vững chắc. Bây giờ, chúng ta hãy nâng mức độ phức tạp lên một chút: ",

                NextInterviewAction.DECREASE_DIFFICULTY =>
                    "Không sao cả, hãy lùi lại một bước để cùng xem xét nền tảng cốt lõi của phần này nhé: ",

                NextInterviewAction.MOVE_ON or NextInterviewAction.CHANGE_TOPIC =>
                    reason switch
                    {
                        TopicTransitionReason.EVIDENCE_SUFFICIENT =>
                            "Cảm ơn bạn, mình đã nắm đủ thông tin ở phần này. Chúng ta hãy chuyển sang chủ đề tiếp theo: ",
                        TopicTransitionReason.CANDIDATE_FATIGUE =>
                            "Được rồi, để buổi phỏng vấn diễn ra nhịp nhàng và thoải mái, chúng ta hãy chuyển tiếp sang câu hỏi sau: ",
                        TopicTransitionReason.PROBE_LIMIT_REACHED =>
                            "Mình đã ghi nhận câu trả lời của bạn. Hãy cùng bước sang nội dung tiếp theo: ",
                        _ => "Được rồi, chúng ta hãy cùng chuyển sang nội dung kế tiếp: "
                    },

                NextInterviewAction.CLARIFY =>
                    "Để mình hiểu rõ hơn chi tiết này, ",

                NextInterviewAction.PROBE =>
                    "Điểm này khá thú vị, ",

                _ => string.Empty
            };

            return prefix + trimmed;
        }

        public InterviewDifficultyLevel EnforceSeniorityCeiling(InterviewDifficultyLevel requested, string seniority)
        {
            var norm = NormalizeSeniority(seniority);

            // Junior / Intern can NEVER exceed ADVANCED
            if (norm == "Intern" || norm == "Fresher" || norm == "Junior")
            {
                if ((int)requested > (int)InterviewDifficultyLevel.ADVANCED)
                {
                    return InterviewDifficultyLevel.ADVANCED;
                }
            }

            return requested;
        }

        public InterviewQualitySummary CalculateQualitySummary(Session session)
        {
            var state = session.QualityState ?? session.InterviewState?.QualityState;
            if (state == null)
            {
                return new InterviewQualitySummary
                {
                    InitialDifficulty = InterviewDifficultyLevel.STANDARD,
                    FinalDifficulty = InterviewDifficultyLevel.STANDARD,
                    MaxDifficultyReached = InterviewDifficultyLevel.STANDARD,
                    AveragePressureLevel = InterviewPressureLevel.NORMAL,
                    FatigueDetected = false,
                    FatigueInstances = 0,
                    PreventedRepetitionsCount = 0,
                    TransitionsCount = 0,
                    TotalProbesCount = 0,
                    RealismIndex = 8.5
                };
            }

            var avgPressureVal = state.PressureSamplesCount > 0
                ? Math.Round(state.CumulativePressure / state.PressureSamplesCount)
                : (int)InterviewPressureLevel.NORMAL;

            var avgPressure = (InterviewPressureLevel)Math.Clamp((int)avgPressureVal, 1, 4);

            InterviewDifficultyLevel maxDiff = state.CurrentDifficulty;
            if (state.QuestionsPerDifficulty.ContainsKey(InterviewDifficultyLevel.CHALLENGING.ToString()) &&
                state.QuestionsPerDifficulty[InterviewDifficultyLevel.CHALLENGING.ToString()] > 0)
            {
                maxDiff = InterviewDifficultyLevel.CHALLENGING;
            }
            else if (state.QuestionsPerDifficulty.ContainsKey(InterviewDifficultyLevel.ADVANCED.ToString()) &&
                     state.QuestionsPerDifficulty[InterviewDifficultyLevel.ADVANCED.ToString()] > 0)
            {
                maxDiff = InterviewDifficultyLevel.ADVANCED;
            }

            var summary = new InterviewQualitySummary
            {
                InitialDifficulty = state.PreviousDifficulty,
                FinalDifficulty = state.CurrentDifficulty,
                MaxDifficultyReached = maxDiff,
                AveragePressureLevel = avgPressure,
                FatigueDetected = state.FatigueDetected,
                FatigueInstances = state.FatigueTriggerCount,
                PreventedRepetitionsCount = state.PreventedDuplicatesCount,
                TransitionsCount = state.TotalTransitionsCount,
                TotalProbesCount = state.TotalProbesCount,
                QuestionsByDifficulty = new Dictionary<string, int>(state.QuestionsPerDifficulty),
                RealismIndex = 9.2
            };

            return summary;
        }

        // =====================================================================
        // HELPER UTILITIES
        // =====================================================================

        private static string NormalizeSeniority(string level)
        {
            if (string.IsNullOrWhiteSpace(level)) return "Junior";
            var lower = level.Trim().ToLowerInvariant();
            if (lower.Contains("intern")) return "Intern";
            if (lower.Contains("fresher")) return "Fresher";
            if (lower.Contains("junior")) return "Junior";
            if (lower.Contains("mid") || lower.Contains("middle")) return "Mid";
            if (lower.Contains("senior")) return "Senior";
            if (lower.Contains("lead") || lower.Contains("principal") || lower.Contains("staff")) return "Lead";
            return "Junior";
        }

        private static string NormalizeText(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;
            var clean = Regex.Replace(text.ToLowerInvariant(), @"[^\w\s]", " ");
            return Regex.Replace(clean, @"\s+", " ").Trim();
        }

        private static List<string> CleanAndTokenize(string text)
        {
            var normalized = NormalizeText(text);
            var words = normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var result = new List<string>();

            foreach (var w in words)
            {
                if (w.Length >= 2 && !StopWords.Contains(w))
                {
                    result.Add(w);
                }
            }

            return result;
        }

        private static double CalculateJaccard(List<string> setA, List<string> setB)
        {
            if (setA == null || setB == null || setA.Count == 0 || setB.Count == 0) return 0.0;
            var hashA = new HashSet<string>(setA, StringComparer.OrdinalIgnoreCase);
            var hashB = new HashSet<string>(setB, StringComparer.OrdinalIgnoreCase);

            int intersection = hashA.Count(hashB.Contains);
            int union = hashA.Count + hashB.Count - intersection;

            if (union == 0) return 0.0;
            return (double)intersection / union;
        }
    }
}
