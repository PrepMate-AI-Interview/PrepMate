using System;
using System.Collections.Generic;

namespace backend.Models
{
    // =========================================================================
    // PHASE 4 STEP 6: INTERVIEW QUALITY, REALISM & ADAPTIVE PRESSURE MODELS
    // =========================================================================

    public enum InterviewDifficultyLevel
    {
        FOUNDATION = 1,
        STANDARD = 2,
        ADVANCED = 3,
        CHALLENGING = 4
    }

    public enum InterviewPressureLevel
    {
        CALM = 1,
        NORMAL = 2,
        PROBING = 3,
        CHALLENGING = 4
    }

    public enum CandidateEngagementLevel
    {
        HIGH = 1,
        NORMAL = 2,
        LOW = 3
    }

    public enum FatigueSignalStatus
    {
        NONE,
        SHORT_ANSWER_PATTERN,
        POSSIBLE_FATIGUE,
        FATIGUE_CONFIRMED
    }

    public enum AnswerQualityLevel
    {
        VERY_WEAK = 1,
        WEAK = 2,
        ADEQUATE = 3,
        STRONG = 4,
        VERY_STRONG = 5
    }

    public enum NextInterviewAction
    {
        CLARIFY,
        PROBE,
        INCREASE_DIFFICULTY,
        MAINTAIN_DIFFICULTY,
        DECREASE_DIFFICULTY,
        MOVE_ON,
        CHANGE_TOPIC
    }

    public enum TopicTransitionReason
    {
        EVIDENCE_SUFFICIENT,
        PROBE_LIMIT_REACHED,
        COMPETENCY_COVERED,
        STAGE_BUDGET,
        CANDIDATE_FATIGUE,
        TOPIC_EXHAUSTED
    }

    public class SemanticQuestionFingerprint
    {
        public string Text { get; set; } = string.Empty;
        public List<string> CleanedTokens { get; set; } = new();
        public string? Competency { get; set; }
        public string? Pattern { get; set; }
        public string? Dimension { get; set; }
        public string? ParentQuestionId { get; set; }
        public string? TargetDomain { get; set; }
        public int TurnNumber { get; set; }
    }

    public class InterviewQualityState
    {
        public InterviewDifficultyLevel CurrentDifficulty { get; set; } = InterviewDifficultyLevel.STANDARD;
        public InterviewDifficultyLevel PreviousDifficulty { get; set; } = InterviewDifficultyLevel.STANDARD;
        public InterviewDifficultyLevel DifficultyCeiling { get; set; } = InterviewDifficultyLevel.ADVANCED;

        public InterviewPressureLevel PressureLevel { get; set; } = InterviewPressureLevel.NORMAL;
        public CandidateEngagementLevel EngagementLevel { get; set; } = CandidateEngagementLevel.NORMAL;

        public FatigueSignalStatus FatigueStatus { get; set; } = FatigueSignalStatus.NONE;
        public bool FatigueDetected { get; set; } = false;
        public int FatigueTriggerCount { get; set; } = 0;
        public int ConsecutiveShortAnswers { get; set; } = 0;

        public int ConsecutiveStrongAnswers { get; set; } = 0;
        public int ConsecutiveWeakAnswers { get; set; } = 0;
        public List<string> RecentStrongCompetencies { get; set; } = new();

        public NextInterviewAction LastAction { get; set; } = NextInterviewAction.MAINTAIN_DIFFICULTY;
        public string? LastProbeReason { get; set; }
        public TopicTransitionReason? LastTransitionReason { get; set; }

        public int QuestionsSinceTopicChange { get; set; } = 0;
        public int PreventedDuplicatesCount { get; set; } = 0;
        public int TotalTransitionsCount { get; set; } = 0;
        public int TotalProbesCount { get; set; } = 0;

        public List<SemanticQuestionFingerprint> RecentFingerprints { get; set; } = new();
        public Dictionary<string, int> QuestionsPerDifficulty { get; set; } = new();

        public double CumulativePressure { get; set; } = 0;
        public int PressureSamplesCount { get; set; } = 0;
    }

    public class InterviewQualitySummary
    {
        public InterviewDifficultyLevel InitialDifficulty { get; set; } = InterviewDifficultyLevel.STANDARD;
        public InterviewDifficultyLevel FinalDifficulty { get; set; } = InterviewDifficultyLevel.STANDARD;
        public InterviewDifficultyLevel MaxDifficultyReached { get; set; } = InterviewDifficultyLevel.STANDARD;
        public InterviewPressureLevel AveragePressureLevel { get; set; } = InterviewPressureLevel.NORMAL;

        public bool FatigueDetected { get; set; } = false;
        public int FatigueInstances { get; set; } = 0;

        public int PreventedRepetitionsCount { get; set; } = 0;
        public int TransitionsCount { get; set; } = 0;
        public int TotalProbesCount { get; set; } = 0;

        public Dictionary<string, int> QuestionsByDifficulty { get; set; } = new();
        public double RealismIndex { get; set; } = 9.0;
    }
}
