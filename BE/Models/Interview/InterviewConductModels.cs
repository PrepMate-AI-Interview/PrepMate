using System;
using System.Collections.Generic;

namespace backend.Models
{
    // =========================================================================
    // MULTIMODAL CONSENT
    // =========================================================================
    public enum MultimodalConsentState
    {
        NONE = 0,
        AUDIO_ONLY = 1,
        VIDEO_ONLY = 2,
        AUDIO_VIDEO = 3,
        DECLINED = 4
    }

    // =========================================================================
    // OBSERVABLE PRESENCE SIGNALS (NO EMOTION / PERSONALITY / LIE DIAGNOSIS)
    // =========================================================================
    public enum PostureState
    {
        UNKNOWN = 0,
        STABLE = 1,
        SHIFTING = 2,
        FORWARD_LEAN = 3,
        BACKWARD_LEAN = 4
    }

    public enum EyeGazeAvailability
    {
        UNKNOWN = 0,
        AVAILABLE = 1,
        UNAVAILABLE = 2
    }

    public enum FaceVisibility
    {
        UNKNOWN = 0,
        CLEAR = 1,
        PARTIAL = 2,
        NOT_VISIBLE = 3
    }

    public enum MovementLevel
    {
        NONE = 0,
        LOW = 1,
        MODERATE = 2,
        HIGH = 3
    }

    public enum SignalQualityLevel
    {
        UNKNOWN = 0,
        GOOD = 1,
        DEGRADED = 2,
        UNAVAILABLE = 3
    }

    // =========================================================================
    // OBSERVABLE SPEECH SIGNALS (NO NERVOUSNESS / CONFIDENCE METRICS)
    // =========================================================================
    public enum SpeechRateLevel
    {
        UNKNOWN = 0,
        SLOW = 1,
        NORMAL = 2,
        FAST = 3
    }

    public enum PausePattern
    {
        NONE = 0,
        SHORT = 1,
        MODERATE = 2,
        LONG = 3
    }

    public enum FillerDensityLevel
    {
        LOW = 0,
        MODERATE = 1,
        HIGH = 2
    }

    public enum ObservationConfidenceLevel
    {
        UNKNOWN = 0,
        LOW = 1,
        MODERATE = 2,
        HIGH = 3
    }

    public enum TurnTakingStatus
    {
        SMOOTH = 0,
        INTERRUPTED = 1,
        OVERLAPPING = 2,
        LONG_SILENCE = 3
    }

    public enum CommunicationClarityLevel
    {
        UNKNOWN = 0,
        CLEAR = 1,
        MODERATE = 2,
        UNCLEAR = 3
    }

    // =========================================================================
    // CONDUCT ACTIONS (HOW THE INTERVIEWER ADAPTS PACING / DELIVERY)
    // =========================================================================
    public enum InterviewConductAction
    {
        NONE = 0,
        WAIT = 1,
        ALLOW_THINKING_TIME = 2,
        REPEAT_QUESTION = 3,
        REPHRASE_QUESTION = 4,
        SLOW_DOWN_INTERVIEWER = 5,
        ENCOURAGE_COMPLETION = 6,
        REDUCE_COGNITIVE_LOAD = 7,
        MOVE_ON = 8
    }

    // =========================================================================
    // PRESENCE OBSERVATION ENTITY
    // =========================================================================
    public class PresenceObservation
    {
        public int TurnIndex { get; set; }
        public PostureState Posture { get; set; } = PostureState.UNKNOWN;
        public EyeGazeAvailability EyeGaze { get; set; } = EyeGazeAvailability.UNKNOWN;
        public FaceVisibility FaceVisibility { get; set; } = FaceVisibility.UNKNOWN;
        public MovementLevel HeadMovement { get; set; } = MovementLevel.NONE;
        public MovementLevel BodyMovement { get; set; } = MovementLevel.NONE;
        public SignalQualityLevel SignalQuality { get; set; } = SignalQualityLevel.UNKNOWN;
        public double ObservationDurationSeconds { get; set; }
        public bool IsCameraAvailable { get; set; } = true;
        public string? TechnicalIssue { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    // =========================================================================
    // SPEECH OBSERVATION ENTITY
    // =========================================================================
    public class SpeechObservation
    {
        public int TurnIndex { get; set; }
        public double SpeakingDurationSeconds { get; set; }
        public double PauseDurationSeconds { get; set; }
        public double SilenceDurationSeconds { get; set; }
        public double WordsPerMinute { get; set; }
        public int WordCount { get; set; }
        public int FillerWordCount { get; set; }
        public List<string> DetectedFillerWords { get; set; } = new();
        public int SelfCorrectionCount { get; set; }
        public bool TurnCompletion { get; set; } = true;
        public int TranscriptLength { get; set; }
        public double TranscriptConfidence { get; set; } = 1.0;
        public SpeechRateLevel SpeechRate { get; set; } = SpeechRateLevel.UNKNOWN;
        public PausePattern PausePattern { get; set; } = PausePattern.NONE;
        public FillerDensityLevel FillerDensity { get; set; } = FillerDensityLevel.LOW;
        public bool IsMicrophoneAvailable { get; set; } = true;
        public string? TechnicalIssue { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    // =========================================================================
    // MULTI-HYPOTHESIS SIGNAL INTERPRETATION (OBSERVATION != INTERPRETATION)
    // =========================================================================
    public class SignalInterpretation
    {
        public string SignalType { get; set; } = string.Empty;
        public string PossibleMeaning { get; set; } = string.Empty;
        public ObservationConfidenceLevel Confidence { get; set; } = ObservationConfidenceLevel.MODERATE;
        public List<string> AlternativeExplanations { get; set; } = new();
        public string EvidenceSource { get; set; } = "Observable";
        public string? SafeCoachingTip { get; set; }
    }

    // =========================================================================
    // INTERVIEW CONDUCT STATE
    // =========================================================================
    public class InterviewConductState
    {
        public MultimodalConsentState ConsentState { get; set; } = MultimodalConsentState.NONE;
        public SpeechRateLevel SpeechPacing { get; set; } = SpeechRateLevel.NORMAL;
        public double ResponseTiming { get; set; }
        public SignalQualityLevel PresenceSignalQuality { get; set; } = SignalQualityLevel.UNKNOWN;
        public CommunicationClarityLevel CommunicationClarity { get; set; } = CommunicationClarityLevel.CLEAR;
        public TurnTakingStatus TurnTaking { get; set; } = TurnTakingStatus.SMOOTH;
        public ObservationConfidenceLevel ObservationConfidence { get; set; } = ObservationConfidenceLevel.HIGH;
        public InterviewConductAction RecommendedConductAction { get; set; } = InterviewConductAction.NONE;
        public string ConductReason { get; set; } = string.Empty;
        public string InterviewerDeliveryGuidance { get; set; } = string.Empty;

        public List<SpeechObservation> SpeechObservations { get; set; } = new();
        public List<PresenceObservation> PresenceObservations { get; set; } = new();
        public List<SignalInterpretation> Interpretations { get; set; } = new();
        public List<string> NonJudgmentalCoachingNotes { get; set; } = new();

        // Observation window tracking
        public int ConsecutiveFastSpeechTurns { get; set; }
        public int ConsecutiveLongPauseTurns { get; set; }
        public int ConsecutiveHighFillerTurns { get; set; }
        public int LowTranscriptConfidenceTurns { get; set; }
        public int CameraInterruptionCount { get; set; }
        public int MicrophoneInterruptionCount { get; set; }
    }

    // =========================================================================
    // CONDUCT SUMMARY (FOR REPORT / FEEDBACK WITHOUT SCORE PENALTY)
    // =========================================================================
    public class ConductSummary
    {
        public MultimodalConsentState ConsentState { get; set; }
        public double AverageWordsPerMinute { get; set; }
        public SpeechRateLevel DominantSpeechRate { get; set; }
        public int TotalFillerWords { get; set; }
        public FillerDensityLevel OverallFillerDensity { get; set; }
        public double AveragePauseDurationSeconds { get; set; }
        public SignalQualityLevel OverallPresenceQuality { get; set; }
        public List<string> ConstructiveCoachingTips { get; set; } = new();
        public List<SignalInterpretation> SummaryInterpretations { get; set; } = new();
    }
}
