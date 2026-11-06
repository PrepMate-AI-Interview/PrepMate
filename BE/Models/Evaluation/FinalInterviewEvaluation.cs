using System;
using System.Collections.Generic;

namespace backend.Models
{
    public class FinalInterviewEvaluation
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string SessionId { get; set; } = string.Empty;
        public string CandidateName { get; set; } = string.Empty;
        public string TargetPosition { get; set; } = string.Empty;
        public string TargetLevel { get; set; } = "Mid";
        public string TargetCompany { get; set; } = string.Empty;
        public InterviewCompletionStatus CompletionStatus { get; set; } = InterviewCompletionStatus.COMPLETED_NORMAL;
        public int TotalQuestionsAsked { get; set; }
        public int MaximumQuestions { get; set; }
        public double OverallScore { get; set; } // 0.0 - 10.0 scale (authoritative SSOT)
        // Domain-Specific Isolated Scores (0.0 - 10.0 scale)
        public double? TechnicalScore { get; set; }
        public DimensionAssessmentStatus TechnicalStatus { get; set; } = DimensionAssessmentStatus.NOT_ASSESSED;
        public bool IsTechnicalAssessed => TechnicalStatus == DimensionAssessmentStatus.ASSESSED && TechnicalScore.HasValue;
        public double BehavioralScore { get; set; }
        public DimensionAssessmentStatus BehavioralStatus { get; set; } = DimensionAssessmentStatus.NOT_ASSESSED;
        public double SituationalScore { get; set; }
        public DimensionAssessmentStatus SituationalStatus { get; set; } = DimensionAssessmentStatus.NOT_ASSESSED;
        public double CandidateQuestionScore { get; set; }
        public DimensionAssessmentStatus CandidateQuestionStatus { get; set; } = DimensionAssessmentStatus.NOT_ASSESSED;
        public double CommunicationScore { get; set; }
        public double SoftScore { get; set; }
        // Evidence Coverage: Percentage of mandatory scope assessed (0.0 - 100.0%) - separated from Performance Score
        public double CoveragePercentage { get; set; } = 100.0;
        public EvaluationConfidence OverallConfidence { get; set; } = EvaluationConfidence.INSUFFICIENT_EVIDENCE;
        public string OverallLevelAssessment { get; set; } = "Unassessed"; // Senior, Middle, Junior, Below Target, Unassessed
        public List<CompetencyEvaluation> Competencies { get; set; } = new();
        public List<string> KeyStrengths { get; set; } = new();
        public List<string> KeyWeaknesses { get; set; } = new();
        public List<string> KnowledgeGaps { get; set; } = new();
        public List<EvaluationRisk> Risks { get; set; } = new();
        public List<string> MissingEvidence { get; set; } = new();
        // Phase 3 Step 3: Performance & Competency Analysis
        public InterviewPerformanceAssessment? PerformanceAssessment { get; set; }
        // Phase 3 Step 4: Diagnostic Analysis
        public DiagnosticAnalysis? DiagnosticAnalysis { get; set; }
        // Phase 3 Step 5: Personalized Improvement Roadmap
        public ImprovementRoadmap? ImprovementRoadmap { get; set; }
        // Phase 3 Step 6: Interview Preparation Ecosystem
        public InterviewPreparationPlan? PreparationPlan { get; set; }
        // Phase 4 Step 5: Multi-Industry Interviewer Intelligence Summary
        public InterviewerIntelligenceSummary? IntelligenceSummary { get; set; }
        // Phase 4 Step 6: Interview Quality Summary
        public InterviewQualitySummary? QualitySummary { get; set; }
        public string Summary { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
