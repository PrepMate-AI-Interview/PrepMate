using System;
using System.Collections.Generic;

namespace backend.Models
{
    /// <summary>
    /// Phase 3 Step 6: A concrete actionable preparation item derived from JD, Blueprint, Diagnostic, and Roadmap.
    /// </summary>
    public class PreparationItem
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Title { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty; // "Technical", "Practical", "SystemDesign", "FollowUp", "Communication"
        public DiagnosticPriority Priority { get; set; } = DiagnosticPriority.HIGH;
        public string Reason { get; set; } = string.Empty;
        public string CurrentState { get; set; } = string.Empty;
        public string Objective { get; set; } = string.Empty;
        public List<string> Actions { get; set; } = new();
        public string ExpectedSignal { get; set; } = string.Empty;
        public RequirementSource SourceType { get; set; } = RequirementSource.OFFICIAL;
        public string DiagnosticReference { get; set; } = string.Empty;
        public string ConceptId { get; set; } = string.Empty;
        public string ConceptName { get; set; } = string.Empty;
        public List<int> TurnReferences { get; set; } = new();
        public bool IsMandatory { get; set; } = true;
    }

    /// <summary>
    /// Phase 3 Step 6: Behavioral interview preparation using STAR/PREP framework.
    /// </summary>
    public class BehavioralPreparationItem
    {
        public string StoryType { get; set; } = string.Empty; // "Self Introduction", "Project Ownership", "Failure / Mistake", "Conflict Resolution", "Problem Solving", "Learning & Adaptability"
        public string Prompt { get; set; } = string.Empty;
        public string Framework { get; set; } = "STAR"; // STAR, PREP
        public List<string> KeyPointsToCover { get; set; } = new();
        public string CandidateEvidenceStatus { get; set; } = "Need candidate preparation"; // "Demonstrated", "Need candidate preparation"
    }

    /// <summary>
    /// Phase 3 Step 6: Company and domain contextual preparation respecting fact reliability.
    /// </summary>
    public class CompanyPreparationItem
    {
        public string Topic { get; set; } = string.Empty;
        public string Information { get; set; } = string.Empty;
        public RequirementSource Reliability { get; set; } = RequirementSource.UNKNOWN;
        public string PreparationAdvice { get; set; } = string.Empty;
        public bool IsMandatory { get; set; } = false; // Strictly false for INFERRED facts!
    }

    /// <summary>
    /// Phase 3 Step 6: Interview execution strategy (Structuring, handling follow-up, clarification, pressure).
    /// </summary>
    public class ExecutionPreparationItem
    {
        public string Area { get; set; } = string.Empty; // "Answer Structuring (STAR/PREP)", "Follow-up Handling", "Time Management", "Clarification", "Handling Unknown Questions", "Questions for Interviewer"
        public string Guidance { get; set; } = string.Empty;
        public DiagnosticPriority Priority { get; set; } = DiagnosticPriority.MEDIUM;
    }

    /// <summary>
    /// Phase 3 Step 6: Recommended focus areas and scenarios for mock interview practice.
    /// </summary>
    public class MockInterviewFocusItem
    {
        public string FocusArea { get; set; } = string.Empty;
        public string Rationale { get; set; } = string.Empty;
        public DiagnosticPriority Priority { get; set; } = DiagnosticPriority.HIGH;
        public List<string> SuggestedScenarios { get; set; } = new();
    }

    /// <summary>
    /// Phase 3 Step 6: Individual item within the organized preparation checklist.
    /// </summary>
    public class ChecklistItem
    {
        public string Task { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty; // "Technical", "Behavioral", "Company", "Logistics"
        public bool IsEvidenceDerived { get; set; }
        public DiagnosticPriority Priority { get; set; } = DiagnosticPriority.MEDIUM;
    }

    /// <summary>
    /// Phase 3 Step 6: Structured preparation checklist organized by domain.
    /// </summary>
    public class PreparationChecklist
    {
        public List<ChecklistItem> TechnicalTasks { get; set; } = new();
        public List<ChecklistItem> BehavioralTasks { get; set; } = new();
        public List<ChecklistItem> CompanyTasks { get; set; } = new();
        public List<ChecklistItem> LogisticsTasks { get; set; } = new();
    }

    /// <summary>
    /// Phase 3 Step 6: Comprehensive Interview Preparation Ecosystem.
    /// Orchestrated from JD, Company Context, Blueprint, Strategy, Diagnostics, and Improvement Roadmap.
    /// </summary>
    public class InterviewPreparationPlan
    {
        public string SessionId { get; set; } = string.Empty;
        public string TargetPosition { get; set; } = string.Empty;
        public string TargetLevel { get; set; } = "Mid";
        public InterviewReadinessStatus OverallReadiness { get; set; } = InterviewReadinessStatus.NEEDS_MORE_EVIDENCE;
        public string ReadinessRationale { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public List<string> PreparationPriorities { get; set; } = new();

        public List<PreparationItem> TechnicalPreparation { get; set; } = new();
        public List<PreparationItem> PracticalPreparation { get; set; } = new();
        public List<PreparationItem> SystemDesignPreparation { get; set; } = new();
        public List<PreparationItem> FollowUpPreparation { get; set; } = new();
        public List<PreparationItem> CommunicationPreparation { get; set; } = new();

        public List<BehavioralPreparationItem> BehavioralPreparation { get; set; } = new();
        public List<CompanyPreparationItem> CompanyPreparation { get; set; } = new();
        public List<ExecutionPreparationItem> ExecutionPreparation { get; set; } = new();
        public List<MockInterviewFocusItem> MockInterviewRecommendations { get; set; } = new();

        public PreparationChecklist PreparationChecklist { get; set; } = new();
        public List<string> StrengthLeverageNotes { get; set; } = new();
        public List<string> ReadinessSignals { get; set; } = new();
        public List<string> Limitations { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
