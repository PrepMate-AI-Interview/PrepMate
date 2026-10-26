using System;
using System.Collections.Generic;

namespace backend.Models
{
    public class ReportSessionInfo
    {
        public string SessionId { get; set; } = string.Empty;
        public string TargetPosition { get; set; } = string.Empty;
        public string TargetLevel { get; set; } = "Middle";
        public string TargetCompany { get; set; } = string.Empty;
        public int QuestionCount { get; set; }
        public int TotalQuestionsBudget { get; set; }
        public int InterviewDurationMinutes { get; set; }
    }

    public class ReportCompletionInfo
    {
        public InterviewCompletionStatus Status { get; set; } = InterviewCompletionStatus.COMPLETED_NORMAL;
        public string Interpretation { get; set; } = string.Empty;
    }

    public class ReportOverallEvaluation
    {
        public double Score { get; set; } // 0 - 100 scale directly from FinalInterviewEvaluation (normalized)
        public double NormalizedScore { get; set; } // 0 - 100 scale for UI / backward compatibility
        public string ScoreScale { get; set; } = "0-100";
        public string OriginalScale { get; set; } = "0-10";
        public EvaluationConfidence Confidence { get; set; } = EvaluationConfidence.INSUFFICIENT_EVIDENCE;
        public string DemonstratedLevel { get; set; } = "Unassessed";
        public string Summary { get; set; } = string.Empty;
    }

    public class ReportCompetencyItem
    {
        public string ConceptId { get; set; } = string.Empty;
        public string ConceptName { get; set; } = string.Empty;
        public string AreaName { get; set; } = string.Empty;
        public double WeightPercentage { get; set; }
        public double Score { get; set; } // 0 - 100 scale
        public string ScoreScale { get; set; } = "0-100";
        public string OriginalScale { get; set; } = "0-10";
        public ConceptCoverageStatus CoverageStatus { get; set; } = ConceptCoverageStatus.NOT_TESTED;
        public string DemonstratedLevel { get; set; } = "Unassessed";
        public EvaluationConfidence Confidence { get; set; } = EvaluationConfidence.INSUFFICIENT_EVIDENCE;
        public bool IsMet { get; set; }
        public string Rationale { get; set; } = string.Empty;
        public List<string> EvidenceSummary { get; set; } = new();
        public List<EvidenceItem> EvidenceItems { get; set; } = new();
    }

    public class ReportStrengthItem
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<string> SupportingCompetencies { get; set; } = new();
        public List<string> EvidenceReferences { get; set; } = new(); // e.g. "Turn 1", "Turn 3"
    }

    public class ReportWeaknessItem
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public EvaluationConfidence Confidence { get; set; } = EvaluationConfidence.HIGH;
        public List<string> SupportingCompetencies { get; set; } = new();
        public List<string> EvidenceReferences { get; set; } = new();
    }

    public class ReportKnowledgeGapItem
    {
        public string ConceptName { get; set; } = string.Empty;
        public string AreaName { get; set; } = string.Empty;
        public KnowledgeGapType GapType { get; set; } = KnowledgeGapType.UNASSESSED;
        public string Description { get; set; } = string.Empty;
        public bool IsMandatory { get; set; } = true;
    }

    public class ReportRiskItem
    {
        public EvaluationRiskType Type { get; set; } = EvaluationRiskType.KNOWLEDGE_GAP;
        public string Severity { get; set; } = "MEDIUM"; // LOW, MEDIUM, HIGH, CRITICAL
        public string Description { get; set; } = string.Empty;
        public string Evidence { get; set; } = string.Empty;
        public string RelatedCompetency { get; set; } = string.Empty;
        public int? RelatedTurn { get; set; }
    }

    public class TurnEvidenceTrace
    {
        public int TurnIndex { get; set; }
        public string Question { get; set; } = string.Empty;
        public string AnswerSnippet { get; set; } = string.Empty;
        public string TargetConcept { get; set; } = string.Empty;
        public int Depth { get; set; }
        public bool ShowsPracticalExperience { get; set; }
        public List<string> VerifiedFacts { get; set; } = new();
        public List<string> UnverifiedClaims { get; set; } = new();
        public List<string> IncorrectConcepts { get; set; } = new();
        public bool HasInconsistency { get; set; }
    }

    public class ReportEvidenceSummary
    {
        public int TotalEvidenceItems { get; set; }
        public int ObservedEvidenceCount { get; set; }
        public int PracticalExperienceEvidenceCount { get; set; }
        public int VerifiedFactsCount { get; set; }
        public int InconsistenciesCount { get; set; }
        public List<TurnEvidenceTrace> TurnProvenance { get; set; } = new();
    }

    /// <summary>
    /// Phase 3 Step 2: Evidence-Based Interview Report presentation model.
    /// Pure projection of FinalInterviewEvaluation into a comprehensive, human-readable report.
    /// </summary>
    public class InterviewReport
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public ReportSessionInfo SessionInfo { get; set; } = new();
        public ReportCompletionInfo CompletionInfo { get; set; } = new();
        public ReportOverallEvaluation OverallEvaluation { get; set; } = new();
        public List<ReportCompetencyItem> Competencies { get; set; } = new();
        public List<ReportStrengthItem> Strengths { get; set; } = new();
        public List<ReportWeaknessItem> Weaknesses { get; set; } = new();
        public List<ReportKnowledgeGapItem> KnowledgeGaps { get; set; } = new();
        public List<ReportRiskItem> Risks { get; set; } = new();
        public ReportEvidenceSummary EvidenceSummary { get; set; } = new();
        // Phase 3 Step 3: Performance Assessment
        public InterviewPerformanceAssessment? PerformanceAssessment { get; set; }
        // Phase 3 Step 4: Diagnostic Analysis
        public DiagnosticAnalysis? DiagnosticAnalysis { get; set; }
        // Phase 3 Step 5: Personalized Improvement Roadmap
        public ImprovementRoadmap? ImprovementRoadmap { get; set; }
        // Phase 3 Step 6: Interview Preparation Ecosystem
        public InterviewPreparationPlan? PreparationPlan { get; set; }
        public List<string> Limitations { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
