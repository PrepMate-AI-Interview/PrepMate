using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using backend.Models;

namespace backend.Services
{
    public class InterviewConductService : IInterviewConductService
    {
        public InterviewConductState InitializeConductState(Session session, MultimodalConsentState consent)
        {
            var state = new InterviewConductState
            {
                ConsentState = consent,
                SpeechPacing = SpeechRateLevel.NORMAL,
                PresenceSignalQuality = consent == MultimodalConsentState.AUDIO_VIDEO || consent == MultimodalConsentState.VIDEO_ONLY
                    ? SignalQualityLevel.GOOD
                    : SignalQualityLevel.UNAVAILABLE,
                CommunicationClarity = CommunicationClarityLevel.CLEAR,
                TurnTaking = TurnTakingStatus.SMOOTH,
                ObservationConfidence = ObservationConfidenceLevel.HIGH,
                RecommendedConductAction = InterviewConductAction.NONE
            };

            session.ConductState = state;
            if (session.InterviewState != null)
            {
                session.InterviewState.ConductState = state;
            }
            session.MultimodalConsent = consent;

            return state;
        }

        public (InterviewConductAction Action, string Guidance, SignalInterpretation? Interpretation) EvaluateConduct(
            Session session,
            SpeechObservation? speech,
            PresenceObservation? presence,
            int turnIndex)
        {
            var state = session.ConductState ?? InitializeConductState(session, session.MultimodalConsent);

            // Step 6 Fatigue Integration: Check existing fatigue state without creating a conflicting authority
            bool fatigueActive = session.QualityState?.FatigueDetected ?? session.InterviewState?.QualityState?.FatigueDetected ?? false;

            SignalInterpretation? interpretation = null;
            InterviewConductAction action = InterviewConductAction.NONE;
            string guidance = "Nhịp điệu phỏng vấn diễn ra tự nhiên và thuận lợi.";

            // Priority 1: Speech Recognition Uncertainty (Low transcript confidence)
            if (speech != null && speech.TranscriptConfidence > 0.0 && speech.TranscriptConfidence < 0.65)
            {
                action = InterviewConductAction.REPHRASE_QUESTION;
                guidance = "Tín hiệu âm thanh hoặc nhận diện từ khóa kỹ thuật chưa rõ nét; hãy diễn đạt lại câu hỏi một cách gãy gọn.";
                interpretation = new SignalInterpretation
                {
                    SignalType = "LOW_TRANSCRIPT_CONFIDENCE",
                    PossibleMeaning = "AUDIO_UNCERTAINTY",
                    Confidence = ObservationConfidenceLevel.HIGH,
                    AlternativeExplanations = new List<string>
                    {
                        "Khoảng cách microphone hoặc tiếng ồn xung quanh",
                        "Phát âm thuật ngữ kỹ thuật chuyên sâu đặc thù",
                        "Độ trễ truyền tải âm thanh mạng"
                    },
                    EvidenceSource = "Audio Transcription",
                    SafeCoachingTip = "Khi nói các thuật ngữ kỹ thuật, bạn có thể nói chậm lại một nhịp để hệ thống và người phỏng vấn nắm bắt chính xác nhất."
                };
            }
            // Priority 2: Prolonged Pauses (Thinking / recall time needed)
            else if (speech != null && speech.PausePattern == PausePattern.LONG)
            {
                action = InterviewConductAction.ALLOW_THINKING_TIME;
                guidance = "Dành khoảng lặng để ứng viên suy nghĩ và sắp xếp luận điểm, không ngắt lời hay hối thúc.";
                interpretation = new SignalInterpretation
                {
                    SignalType = "LONG_PAUSE",
                    PossibleMeaning = "THINKING_AND_RECALL",
                    Confidence = ObservationConfidenceLevel.MODERATE,
                    AlternativeExplanations = new List<string>
                    {
                        "Ứng viên đang suy ngẫm sâu để chọn lựa giải pháp kỹ thuật tối ưu",
                        "Ứng viên đang hồi tưởng lại số liệu hoặc bối cảnh dự án cụ thể",
                        "Độ trễ đường truyền hoặc xử lý âm thanh"
                    },
                    EvidenceSource = "Speech Timing",
                    SafeCoachingTip = "Dành một vài giây suy nghĩ trước khi trả lời là thói quen rất tốt để cấu trúc câu trả lời mạch lạc."
                };
            }
            // Priority 3: Fast Speech (Sustained or extreme rate)
            else if (speech != null && (speech.SpeechRate == SpeechRateLevel.FAST || state.ConsecutiveFastSpeechTurns >= 2))
            {
                action = InterviewConductAction.SLOW_DOWN_INTERVIEWER;
                guidance = "Người phỏng vấn chủ động điều chỉnh tốc độ nói chậm lại, đặt câu hỏi ngắn gọn tập trung vào một trọng tâm để ứng viên có không gian thở.";
                interpretation = new SignalInterpretation
                {
                    SignalType = "FAST_SPEECH",
                    PossibleMeaning = "HIGH_ENERGY_OR_CADENCE",
                    Confidence = ObservationConfidenceLevel.MODERATE,
                    AlternativeExplanations = new List<string>
                    {
                        "Ứng viên có năng lượng cao và đam mê với chủ đề đang chia sẻ",
                        "Thói quen giao tiếp nhịp độ nhanh tự nhiên",
                        "Nhiều ý tưởng muốn diễn đạt cùng lúc"
                    },
                    EvidenceSource = "Prosody Analysis",
                    SafeCoachingTip = "Điều chỉnh nhịp nói vừa phải giúp người phỏng vấn dễ dàng theo dõi và ghi nhận đầy đủ các ý chính."
                };
            }
            // Priority 4: Existing Fatigue Signal (from Step 6 Quality Service)
            else if (fatigueActive)
            {
                action = InterviewConductAction.REDUCE_COGNITIVE_LOAD;
                guidance = "Tín hiệu cần điều tiết nhịp độ phỏng vấn; giữ câu hỏi súc tích và tránh chuỗi truy vấn dồn dập.";
                interpretation = new SignalInterpretation
                {
                    SignalType = "PACING_ADAPTATION",
                    PossibleMeaning = "PACING_ADJUSTMENT_REQUESTED",
                    Confidence = ObservationConfidenceLevel.HIGH,
                    AlternativeExplanations = new List<string>
                    {
                        "Buổi phỏng vấn đã trải qua nhiều turn căng thẳng",
                        "Ứng viên muốn đi nhanh hơn tới các phần trọng tâm tiếp theo"
                    },
                    EvidenceSource = "Quality State Integration",
                    SafeCoachingTip = null
                };
            }
            // Priority 5: High Filler Density (Coaching guidance only, zero score impact)
            else if (speech != null && speech.FillerDensity == FillerDensityLevel.HIGH && state.ConsecutiveHighFillerTurns >= 2)
            {
                action = InterviewConductAction.NONE;
                guidance = "Tần suất từ đệm xuất hiện nhiều; interviewer giữ thái độ lắng nghe tích cực.";
                interpretation = new SignalInterpretation
                {
                    SignalType = "HIGH_FILLER_DENSITY",
                    PossibleMeaning = "COGNITIVE_TRANSITION",
                    Confidence = ObservationConfidenceLevel.LOW,
                    AlternativeExplanations = new List<string>
                    {
                        "Khoảng đệm suy nghĩ khi chuyển tiếp giữa các luận điểm phức tạp",
                        "Thói quen khẩu ngữ tự nhiên khi diễn đạt tự do",
                        "Đang tìm kiếm từ vựng phù hợp nhất"
                    },
                    EvidenceSource = "Lexical Prosody",
                    SafeCoachingTip = "Bạn có thể thử dừng một nhịp ngắn (pause) thay vì dùng từ đệm để tạo cảm giác tự tin và chuyên nghiệp."
                };
            }
            // Priority 6: Hardware Fallback (Camera / Microphone unavailable)
            else if (presence != null && !presence.IsCameraAvailable)
            {
                action = InterviewConductAction.NONE;
                guidance = "Camera không khả dụng. Tiến trình phỏng vấn tiếp tục bình thường bằng kênh âm thanh/văn bản.";
            }

            state.RecommendedConductAction = action;
            state.ConductReason = guidance;
            state.InterviewerDeliveryGuidance = guidance;

            if (interpretation != null)
            {
                state.Interpretations.Add(interpretation);
                if (!string.IsNullOrEmpty(interpretation.SafeCoachingTip) &&
                    !state.NonJudgmentalCoachingNotes.Contains(interpretation.SafeCoachingTip))
                {
                    state.NonJudgmentalCoachingNotes.Add(interpretation.SafeCoachingTip);
                }
            }

            return (action, guidance, interpretation);
        }

        public string FormatInterviewerDeliveryPrefix(InterviewConductAction action)
        {
            return action switch
            {
                InterviewConductAction.ALLOW_THINKING_TIME =>
                    "Bạn cứ thoải mái suy nghĩ nhé, khi nào sẵn sàng hãy chia sẻ cùng mình: ",

                InterviewConductAction.SLOW_DOWN_INTERVIEWER =>
                    "Chúng ta hãy cùng đi chậm lại một chút để xem xét kỹ phần này nhé: ",

                InterviewConductAction.REPHRASE_QUESTION =>
                    "Để mình diễn đạt lại câu hỏi cho rõ ràng và cụ thể hơn nhé: ",

                InterviewConductAction.REPEAT_QUESTION =>
                    "Mình xin phép nhắc lại câu hỏi vừa rồi: ",

                InterviewConductAction.REDUCE_COGNITIVE_LOAD =>
                    "Để buổi trao đổi diễn ra nhẹ nhàng và tập trung, chúng ta hãy nhìn vào khía cạnh cốt lõi sau: ",

                _ => string.Empty
            };
        }

        public ConductSummary GenerateConductSummary(Session session)
        {
            var state = session.ConductState;
            if (state == null || state.SpeechObservations.Count == 0)
            {
                return new ConductSummary
                {
                    ConsentState = session.MultimodalConsent,
                    AverageWordsPerMinute = 0,
                    DominantSpeechRate = SpeechRateLevel.NORMAL,
                    TotalFillerWords = 0,
                    OverallFillerDensity = FillerDensityLevel.LOW,
                    AveragePauseDurationSeconds = 0,
                    OverallPresenceQuality = SignalQualityLevel.UNAVAILABLE,
                    ConstructiveCoachingTips = new List<string>(),
                    SummaryInterpretations = new List<SignalInterpretation>()
                };
            }

            var speeches = state.SpeechObservations;
            double avgWpm = speeches.Count > 0 ? Math.Round(speeches.Average(s => s.WordsPerMinute), 1) : 0;
            double avgPause = speeches.Count > 0 ? Math.Round(speeches.Average(s => s.PauseDurationSeconds), 2) : 0;
            int totalFillers = speeches.Sum(s => s.FillerWordCount);
            int totalWords = speeches.Sum(s => s.WordCount);

            FillerDensityLevel overallFiller;
            if (totalWords <= 0) overallFiller = FillerDensityLevel.LOW;
            else
            {
                double density = (totalFillers * 100.0) / totalWords;
                if (density < 3.5) overallFiller = FillerDensityLevel.LOW;
                else if (density <= 7.5) overallFiller = FillerDensityLevel.MODERATE;
                else overallFiller = FillerDensityLevel.HIGH;
            }

            var rateGroups = speeches.GroupBy(s => s.SpeechRate)
                                     .OrderByDescending(g => g.Count())
                                     .FirstOrDefault();
            var dominantRate = rateGroups?.Key ?? SpeechRateLevel.NORMAL;

            return new ConductSummary
            {
                ConsentState = state.ConsentState,
                AverageWordsPerMinute = avgWpm,
                DominantSpeechRate = dominantRate,
                TotalFillerWords = totalFillers,
                OverallFillerDensity = overallFiller,
                AveragePauseDurationSeconds = avgPause,
                OverallPresenceQuality = state.PresenceSignalQuality,
                ConstructiveCoachingTips = new List<string>(state.NonJudgmentalCoachingNotes),
                SummaryInterpretations = new List<SignalInterpretation>(state.Interpretations)
            };
        }

        public string SanitizeAdversarialAiPayload(string aiJson)
        {
            if (string.IsNullOrWhiteSpace(aiJson)) return "{}";

            try
            {
                var node = JsonNode.Parse(aiJson);
                if (node is JsonObject obj)
                {
                    // Strictly strip prohibited diagnostic, lie, emotion, score, stage, and difficulty fields
                    string[] prohibitedFields = new[]
                    {
                        "candidateEmotion", "emotion",
                        "candidateIsLying", "isLying", "lieProbability", "deceptionDetected",
                        "personality", "personalityType", "nervousness", "nervousnessLevel",
                        "scorePenalty", "penalty", "candidateScore", "technicalScore", "behavioralScore", "situationalScore", "overallScore",
                        "stage", "currentStage", "nextStage",
                        "difficulty", "currentDifficulty", "pressure",
                        "additionalQuestions", "budget", "questionBudget",
                        "fatigueConfirmed", "roadmap", "preparation"
                    };

                    foreach (var field in prohibitedFields)
                    {
                        obj.Remove(field);
                    }

                    // Also remove any remaining keys containing "score"
                    var scoreKeys = obj.Select(kv => kv.Key).Where(k => k.IndexOf("score", StringComparison.OrdinalIgnoreCase) >= 0).ToList();
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
    }
}
