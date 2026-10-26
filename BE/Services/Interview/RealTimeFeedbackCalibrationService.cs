using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using backend.Models;

namespace backend.Services
{
    public class RealTimeFeedbackCalibrationService : IRealTimeFeedbackCalibrationService
    {
        private readonly IInterviewConductService _conductService;

        public RealTimeFeedbackCalibrationService(IInterviewConductService? conductService = null)
        {
            _conductService = conductService ?? new InterviewConductService();
        }

        public RealTimeFeedbackDecision EvaluateAndCalibrateFeedback(
            Session session,
            SpeechObservation? speech,
            PresenceObservation? presence,
            int turnIndex,
            InterviewContext? context = null)
        {
            if (session == null)
            {
                return new RealTimeFeedbackDecision
                {
                    Type = FeedbackType.NONE,
                    Reason = "Session is null."
                };
            }

            // Invariant: Completed session receives zero feedback and zero mutations
            if (string.Equals(session.Status, "completed", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(session.InterviewState?.InterviewPhase, InterviewStageNames.Completed, StringComparison.OrdinalIgnoreCase))
            {
                return new RealTimeFeedbackDecision
                {
                    Type = FeedbackType.NONE,
                    Reason = "Session is completed; feedback is closed."
                };
            }

            // Invariant: Consent verification (Consent rules Section 7)
            var consent = session.MultimodalConsent;
            if (consent == MultimodalConsentState.NONE || consent == MultimodalConsentState.DECLINED)
            {
                return new RealTimeFeedbackDecision
                {
                    Type = FeedbackType.NONE,
                    Reason = consent == MultimodalConsentState.DECLINED
                        ? "Multimodal observation declined by candidate; text-only interview proceeds without penalty."
                        : "No multimodal consent granted."
                };
            }

            // Mask observation channels based on consent
            if (consent == MultimodalConsentState.AUDIO_ONLY)
            {
                presence = null;
            }
            else if (consent == MultimodalConsentState.VIDEO_ONLY)
            {
                speech = null;
            }

            // Initialize or retrieve RealTimeFeedbackState
            session.EvidenceState ??= new InterviewEvidenceState();
            session.EvidenceState.RealTimeFeedback ??= new RealTimeFeedbackState();
            var feedbackState = session.EvidenceState.RealTimeFeedback;
            session.FeedbackState = feedbackState;

            // Step 1: Calibration Delta Check (Did the candidate improve since last feedback?)
            CheckAndCalibrateSignalImprovement(feedbackState, speech, presence);

            // Step 2: Signal Evaluation via Priority Matrix (Section 15)
            var candidateFeedback = DetermineHighestPriorityFeedback(session, speech, presence, turnIndex, context);

            if (candidateFeedback.Type == FeedbackType.NONE)
            {
                feedbackState.CurrentFeedbackIntensity = FeedbackIntensity.NONE;
                return candidateFeedback;
            }

            // Step 3: Cooldown and Deduplication Handling (Section 14 & 16)
            bool isSameTypeAsLast = (candidateFeedback.Type == feedbackState.LastFeedbackType);
            bool isWithinCooldown = (turnIndex <= feedbackState.CooldownUntilTurn);

            if (isSameTypeAsLast && isWithinCooldown)
            {
                // Suppress immediate back-to-back duplicate feedback
                feedbackState.SuppressedDuplicateCount++;
                feedbackState.ConsecutiveSignalCount++;

                return new RealTimeFeedbackDecision
                {
                    Type = FeedbackType.NONE,
                    Intensity = FeedbackIntensity.NONE,
                    IsSuppressedByCooldown = true,
                    Reason = $"Suppressed duplicate {candidateFeedback.Type} feedback within cooldown window (Turn {turnIndex} <= {feedbackState.CooldownUntilTurn}).",
                    SignalSource = candidateFeedback.SignalSource
                };
            }

            // Step 4: Determine Intensity & Formulate Calibrated Guidance
            bool isPersistentPattern = isSameTypeAsLast && (feedbackState.ConsecutiveSignalCount >= 2);
            var intensity = isPersistentPattern
                ? FeedbackIntensity.IMPORTANT
                : (candidateFeedback.Intensity != FeedbackIntensity.NONE ? candidateFeedback.Intensity : FeedbackIntensity.STANDARD);

            string naturalGuidance = FormatCalibratedGuidance(candidateFeedback.Type, intensity, context ?? session.InterviewContext, isPersistentPattern);

            // Step 5: Update State & Record Feedback Event
            feedbackState.LastFeedbackType = candidateFeedback.Type;
            feedbackState.LastFeedbackTurn = turnIndex;
            feedbackState.CooldownUntilTurn = turnIndex + 2; // At least 2 turns cooldown
            feedbackState.CurrentFeedbackIntensity = intensity;
            feedbackState.InterventionCount++;
            if (isSameTypeAsLast)
            {
                feedbackState.ConsecutiveSignalCount++;
            }
            else
            {
                feedbackState.ConsecutiveSignalCount = 1;
            }

            var feedbackEvent = new RealTimeFeedbackEvent
            {
                TurnIndex = turnIndex,
                Type = candidateFeedback.Type,
                Intensity = intensity,
                CandidateGuidance = naturalGuidance,
                InterviewerActionSummary = candidateFeedback.ConductAction.ToString(),
                TriggerSignal = candidateFeedback.SignalSource,
                SignalValue = candidateFeedback.SignalSource == "WPM" && speech != null ? speech.WordsPerMinute : 0.0,
                WasFollowedOrImproved = false,
                Timestamp = DateTime.UtcNow
            };
            feedbackState.FeedbackHistory.Add(feedbackEvent);

            return new RealTimeFeedbackDecision
            {
                Type = candidateFeedback.Type,
                Intensity = intensity,
                CandidateGuidance = naturalGuidance,
                ConductAction = candidateFeedback.ConductAction,
                Reason = candidateFeedback.Reason,
                IsIntervention = true,
                SignalSource = candidateFeedback.SignalSource,
                IsSuppressedByCooldown = false
            };
        }

        public void AcknowledgeCandidateAdjustment(Session session, int turnIndex)
        {
            var feedbackState = session?.EvidenceState?.RealTimeFeedback;
            if (feedbackState == null) return;

            var lastEvent = feedbackState.FeedbackHistory.LastOrDefault();
            if (lastEvent != null && !lastEvent.WasFollowedOrImproved)
            {
                lastEvent.WasFollowedOrImproved = true;
                feedbackState.LastSignalImproved = true;
                feedbackState.ConsecutiveSignalCount = 0;
            }
        }

        public string FormatCalibratedGuidance(
            FeedbackType type,
            FeedbackIntensity intensity,
            InterviewContext? context = null,
            bool isPersistentPattern = false)
        {
            string domain = !string.IsNullOrWhiteSpace(context?.Industry)
                ? context.Industry.ToUpperInvariant()
                : (!string.IsNullOrWhiteSpace(context?.InterviewBlueprint?.Industry)
                    ? context.InterviewBlueprint.Industry.ToUpperInvariant()
                    : "GENERIC");

            return type switch
            {
                FeedbackType.PACING => isPersistentPattern
                    ? "Chúng ta vẫn đang đi với tốc độ tương đối nhanh, bạn cứ thong thả trình bày từng luận điểm chính nhé."
                    : (intensity == FeedbackIntensity.SUBTLE
                        ? "Bạn có thể đi chậm lại một nhịp để phần trình bày thêm rõ ràng."
                        : "Bạn có thể chậm lại một chút để làm rõ từng ý."),

                FeedbackType.THINKING_TIME or FeedbackType.PAUSE =>
                    "Bạn có thể dành thêm vài giây để sắp xếp ý trước khi trả lời.",

                FeedbackType.QUESTION_REPHRASE or FeedbackType.CLARITY =>
                    "Tôi chưa nghe rõ phần cuối câu trả lời. Bạn có thể nói lại ý đó được không?",

                FeedbackType.COMPLETION =>
                    "Bạn có thể tiếp tục hoàn thiện câu trả lời nếu còn ý muốn bổ sung nhé.",

                FeedbackType.COGNITIVE_LOAD =>
                    "Để buổi trao đổi diễn ra nhẹ nhàng và tập trung, chúng ta hãy nhìn vào khía cạnh cốt lõi sau: ",

                FeedbackType.DELIVERY =>
                    "Bạn có thể ngồi ổn định hơn một chút nếu thấy thoải mái.",

                _ => string.Empty
            };
        }

        public string SanitizeAdversarialFeedbackPayload(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return "{}";

            try
            {
                var node = JsonNode.Parse(json);
                if (node is JsonObject obj)
                {
                    string[] prohibitedFields = new[]
                    {
                        "candidateEmotion", "emotion",
                        "candidateIsLying", "isLying", "lieProbability", "deceptionDetected",
                        "personality", "personalityType", "nervousness", "nervousnessLevel",
                        "scorePenalty", "penalty", "candidateScore", "technicalScore", "behavioralScore", "situationalScore", "overallScore",
                        "stage", "currentStage", "nextStage",
                        "difficulty", "currentDifficulty", "pressure",
                        "additionalQuestions", "budget", "questionBudget",
                        "fatigueConfirmed", "roadmap", "preparation",
                        "feedbackTypeOverride", "forcedFeedback"
                    };

                    foreach (var field in prohibitedFields)
                    {
                        obj.Remove(field);
                    }

                    var scoreKeys = obj.Select(kv => kv.Key)
                                       .Where(k => k.IndexOf("score", StringComparison.OrdinalIgnoreCase) >= 0)
                                       .ToList();
                    foreach (var k in scoreKeys)
                    {
                        obj.Remove(k);
                    }

                    return obj.ToJsonString();
                }
            }
            catch
            {
                // Fallback safe payload
            }

            return "{}";
        }

        public bool ValidateAuthorityIntegrity(Session session)
        {
            if (session == null) return true;

            // 1. Contradictions must never conclude LieVerdict
            if (session.EvidenceState?.Contradictions != null)
            {
                foreach (var c in session.EvidenceState.Contradictions)
                {
                    if (c.LieVerdict) return false;
                }
            }

            // 2. Multimodal consent DECLINED must have zero score penalty
            if (session.MultimodalConsent == MultimodalConsentState.DECLINED)
            {
                // Must not have artificially lowered scores solely due to consent
                if (session.ConductState != null && session.ConductState.ConsentState != MultimodalConsentState.DECLINED)
                {
                    return false;
                }
            }

            // 3. Score authority is strictly preserved in FinalEvaluationService
            return true;
        }

        private void CheckAndCalibrateSignalImprovement(
            RealTimeFeedbackState state,
            SpeechObservation? speech,
            PresenceObservation? presence)
        {
            if (state == null || state.FeedbackHistory.Count == 0) return;

            var lastEvent = state.FeedbackHistory.LastOrDefault();
            if (lastEvent == null) return;

            if (lastEvent.Type == FeedbackType.PACING && speech != null)
            {
                // If previous was FAST and now NORMAL or SLOW, candidate calibrated!
                if (speech.SpeechRate == SpeechRateLevel.NORMAL || speech.SpeechRate == SpeechRateLevel.SLOW)
                {
                    lastEvent.WasFollowedOrImproved = true;
                    state.LastSignalImproved = true;
                    state.CurrentFeedbackIntensity = FeedbackIntensity.SUBTLE;
                }
                else
                {
                    state.LastSignalImproved = false;
                }
            }
            else if ((lastEvent.Type == FeedbackType.THINKING_TIME || lastEvent.Type == FeedbackType.PAUSE) && speech != null)
            {
                if (speech.PausePattern == PausePattern.SHORT || speech.PausePattern == PausePattern.NONE)
                {
                    lastEvent.WasFollowedOrImproved = true;
                    state.LastSignalImproved = true;
                    state.CurrentFeedbackIntensity = FeedbackIntensity.NONE;
                }
                else
                {
                    state.LastSignalImproved = false;
                }
            }
            else if ((lastEvent.Type == FeedbackType.QUESTION_REPHRASE || lastEvent.Type == FeedbackType.CLARITY) && speech != null)
            {
                if (speech.TranscriptConfidence >= 0.65)
                {
                    lastEvent.WasFollowedOrImproved = true;
                    state.LastSignalImproved = true;
                }
            }
        }

        private RealTimeFeedbackDecision DetermineHighestPriorityFeedback(
            Session session,
            SpeechObservation? speech,
            PresenceObservation? presence,
            int turnIndex,
            InterviewContext? context)
        {
            // Priority 1: Speech Recognition Uncertainty (Low transcript confidence)
            if (speech != null && speech.TranscriptConfidence > 0.0 && speech.TranscriptConfidence < 0.65)
            {
                return new RealTimeFeedbackDecision
                {
                    Type = FeedbackType.QUESTION_REPHRASE,
                    Intensity = FeedbackIntensity.IMPORTANT,
                    ConductAction = InterviewConductAction.REPHRASE_QUESTION,
                    Reason = "Transcript confidence is below 0.65; rephrase requested for conversational clarity.",
                    SignalSource = "LowTranscriptConfidence",
                    IsIntervention = true
                };
            }

            // Priority 2: Candidate Incompletion
            if (speech != null && !speech.TurnCompletion && speech.SpeakingDurationSeconds > 3.0)
            {
                return new RealTimeFeedbackDecision
                {
                    Type = FeedbackType.COMPLETION,
                    Intensity = FeedbackIntensity.STANDARD,
                    ConductAction = InterviewConductAction.ENCOURAGE_COMPLETION,
                    Reason = "Turn completion indicator signaled incomplete response.",
                    SignalSource = "TurnCompletionIncomplete",
                    IsIntervention = true
                };
            }

            // Priority 3: Cognitive Load (From deterministic QualityState Fatigue authority)
            bool fatigueActive = session.QualityState?.FatigueDetected ?? session.InterviewState?.QualityState?.FatigueDetected ?? false;
            if (fatigueActive)
            {
                return new RealTimeFeedbackDecision
                {
                    Type = FeedbackType.COGNITIVE_LOAD,
                    Intensity = FeedbackIntensity.STANDARD,
                    ConductAction = InterviewConductAction.REDUCE_COGNITIVE_LOAD,
                    Reason = "QualityState signaled fatigue pattern; reducing cognitive load on interviewer prompts.",
                    SignalSource = "CognitiveLoadFatigue",
                    IsIntervention = true
                };
            }

            // Priority 4: Fast Speech Pacing
            if (speech != null && speech.SpeechRate == SpeechRateLevel.FAST)
            {
                return new RealTimeFeedbackDecision
                {
                    Type = FeedbackType.PACING,
                    Intensity = FeedbackIntensity.STANDARD,
                    ConductAction = InterviewConductAction.SLOW_DOWN_INTERVIEWER,
                    Reason = $"Speech rate is FAST ({speech.WordsPerMinute} WPM); gentle pacing guidance recommended.",
                    SignalSource = "WPM",
                    IsIntervention = true
                };
            }

            // Priority 5: Long Pause (Thinking Time)
            if (speech != null && speech.PausePattern == PausePattern.LONG)
            {
                return new RealTimeFeedbackDecision
                {
                    Type = FeedbackType.THINKING_TIME,
                    Intensity = FeedbackIntensity.SUBTLE,
                    ConductAction = InterviewConductAction.ALLOW_THINKING_TIME,
                    Reason = "Long pause observed; giving candidate space to structure thoughts.",
                    SignalSource = "LongPause",
                    IsIntervention = true
                };
            }

            // Priority 6: Presence Posture (Only if signal quality is GOOD)
            if (presence != null && presence.SignalQuality == SignalQualityLevel.GOOD && presence.Posture == PostureState.SHIFTING)
            {
                return new RealTimeFeedbackDecision
                {
                    Type = FeedbackType.DELIVERY,
                    Intensity = FeedbackIntensity.SUBTLE,
                    ConductAction = InterviewConductAction.NONE,
                    Reason = "Posture state shifting observed under good signal quality.",
                    SignalSource = "PostureShifting",
                    IsIntervention = true
                };
            }

            return new RealTimeFeedbackDecision
            {
                Type = FeedbackType.NONE,
                Intensity = FeedbackIntensity.NONE,
                ConductAction = InterviewConductAction.NONE,
                Reason = "All observable signals within normal limits; zero intervention needed.",
                IsIntervention = false
            };
        }
    }
}
