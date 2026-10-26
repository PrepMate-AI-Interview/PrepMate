using System;
using System.Collections.Generic;

namespace backend.Models
{
    // =========================================================================
    // FEEDBACK TYPES (COACHING & CONDUCT ONLY - ZERO EMOTION/PERSONALITY/LIE)
    // =========================================================================
    public enum FeedbackType
    {
        NONE = 0,
        PACING = 1,
        CLARITY = 2,
        PAUSE = 3,
        COMPLETION = 4,
        QUESTION_REPHRASE = 5,
        THINKING_TIME = 6,
        COGNITIVE_LOAD = 7,
        DELIVERY = 8
    }

    // =========================================================================
    // FEEDBACK INTENSITY (CONTROLS TONE & FREQUENCY - NEVER SCORING)
    // =========================================================================
    public enum FeedbackIntensity
    {
        NONE = 0,
        SUBTLE = 1,
        STANDARD = 2,
        IMPORTANT = 3
    }

    // =========================================================================
    // REAL-TIME FEEDBACK EVENT (AUDIT RECORD OF CALIBRATED GUIDANCE)
    // =========================================================================
    public class RealTimeFeedbackEvent
    {
        public string EventId { get; set; } = Guid.NewGuid().ToString();
        public int TurnIndex { get; set; }
        public FeedbackType Type { get; set; } = FeedbackType.NONE;
        public FeedbackIntensity Intensity { get; set; } = FeedbackIntensity.NONE;
        public string CandidateGuidance { get; set; } = string.Empty;
        public string InterviewerActionSummary { get; set; } = string.Empty;
        public string TriggerSignal { get; set; } = string.Empty;
        public double SignalValue { get; set; }
        public bool WasFollowedOrImproved { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    // =========================================================================
    // REAL-TIME FEEDBACK DECISION
    // =========================================================================
    public class RealTimeFeedbackDecision
    {
        public FeedbackType Type { get; set; } = FeedbackType.NONE;
        public FeedbackIntensity Intensity { get; set; } = FeedbackIntensity.NONE;
        public string? CandidateGuidance { get; set; }
        public InterviewConductAction ConductAction { get; set; } = InterviewConductAction.NONE;
        public string Reason { get; set; } = string.Empty;
        public bool IsIntervention { get; set; }
        public string SignalSource { get; set; } = string.Empty;
        public bool IsSuppressedByCooldown { get; set; }
        public bool IsCalibratedReduction { get; set; }
    }

    // =========================================================================
    // REAL-TIME FEEDBACK STATE (TRACKS CALIBRATION, COOLDOWN, DEDUPLICATION)
    // =========================================================================
    public class RealTimeFeedbackState
    {
        public FeedbackType LastFeedbackType { get; set; } = FeedbackType.NONE;
        public int LastFeedbackTurn { get; set; } = 0;
        public int CooldownUntilTurn { get; set; } = 0;
        public int ConsecutiveSignalCount { get; set; } = 0;
        public int SuppressedDuplicateCount { get; set; } = 0;
        public int InterventionCount { get; set; } = 0;
        public FeedbackIntensity CurrentFeedbackIntensity { get; set; } = FeedbackIntensity.NONE;
        public string LastObservedSignal { get; set; } = string.Empty;
        public double LastObservedSignalValue { get; set; } = 0.0;
        public bool LastSignalImproved { get; set; } = false;

        public List<RealTimeFeedbackEvent> FeedbackHistory { get; set; } = new();

        // Invariants: STRICTLY ZERO SCORE/LIE/EMOTION FIELDS
    }
}
