using System;

namespace backend.Models
{
    public enum InterviewStage
    {
        SETUP = 0,
        INTRODUCTION = 1,
        TECHNICAL_ASSESSMENT = 2,
        BEHAVIORAL_STAR = 3,
        SITUATIONAL_CASE = 4,
        CANDIDATE_QUESTIONS = 5,
        CLOSING = 6,
        COMPLETED = 7
    }

    public static class InterviewStageNames
    {
        public const string Setup = "SETUP";
        public const string Introduction = "INTRODUCTION";
        public const string TechnicalAssessment = "TECHNICAL_ASSESSMENT";
        public const string AdaptiveInterview = "ADAPTIVE_INTERVIEW"; // Legacy alias
        public const string BehavioralStar = "BEHAVIORAL_STAR";
        public const string SituationalCase = "SITUATIONAL_CASE";
        public const string CandidateQuestions = "CANDIDATE_QUESTIONS";
        public const string Closing = "CLOSING";
        public const string Completed = "COMPLETED";
    }

    public class StageHistoryRecord
    {
        public string Stage { get; set; } = string.Empty;
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedAt { get; set; }
        public int QuestionCount { get; set; } = 0;
        public string TransitionReason { get; set; } = string.Empty;
    }
}
