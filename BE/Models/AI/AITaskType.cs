using System;
using System.Collections.Generic;

namespace backend.Models.AI
{
    /// <summary>
    /// Canonical AI task classifications for task-based routing in PrepMate.
    /// Eliminates hardcoded model IDs from business logic services.
    /// </summary>
    public static class AITaskType
    {
        public const string IntroductionAnalysis = "IntroductionAnalysis";
        public const string QuestionGeneration = "QuestionGeneration";
        public const string AnswerEvaluation = "AnswerEvaluation";
        public const string TechnicalAssessment = "TechnicalAssessment";
        public const string BehavioralAssessment = "BehavioralAssessment";
        public const string SituationalAssessment = "SituationalAssessment";
        public const string CandidateQuestion = "CandidateQuestion";
        public const string Closing = "Closing";
        public const string ReportGeneration = "ReportGeneration";
        public const string CvAnalysis = "CvAnalysis";
        public const string JobRecommendation = "JobRecommendation";
        public const string CareerRoadmap = "CareerRoadmap";

        public static readonly IReadOnlyList<string> AllTasks = new[]
        {
            IntroductionAnalysis,
            QuestionGeneration,
            AnswerEvaluation,
            TechnicalAssessment,
            BehavioralAssessment,
            SituationalAssessment,
            CandidateQuestion,
            Closing,
            ReportGeneration,
            CvAnalysis,
            JobRecommendation,
            CareerRoadmap
        };

        public static bool IsValid(string taskType)
        {
            if (string.IsNullOrWhiteSpace(taskType)) return false;
            foreach (var t in AllTasks)
            {
                if (t.Equals(taskType.Trim(), StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }
    }
}
