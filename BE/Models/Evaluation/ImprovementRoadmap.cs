using System;
using System.Collections.Generic;

namespace backend.Models
{
    /// <summary>
    /// Phase 3 Step 5: A concrete learning or practice step within an improvement item.
    /// </summary>
    public class ImprovementActionItem
    {
        public int StepIndex { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ActionType { get; set; } = string.Empty; // e.g. "Concept Review", "Deep Dive", "Hands-on Exercise", "Trade-off Analysis", "Drill"
    }

    /// <summary>
    /// Phase 3 Step 5: An individual personalized improvement item derived strictly from Diagnostic Analysis.
    /// </summary>
    public class ImprovementItem
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string DiagnosticReference { get; set; } = string.Empty; // Refers to WeaknessDiagnosis Title / ID
        public string ConceptId { get; set; } = string.Empty;
        public string ConceptName { get; set; } = string.Empty;
        public string RelatedCompetency { get; set; } = string.Empty;
        public DiagnosticRootCause RootCause { get; set; } = DiagnosticRootCause.KNOWLEDGE_GAP;
        public DiagnosticPriority Priority { get; set; } = DiagnosticPriority.HIGH;
        public DiagnosticImpact Impact { get; set; } = DiagnosticImpact.HIGH;
        public string CurrentState { get; set; } = string.Empty;
        public string ImprovementObjective { get; set; } = string.Empty;
        public List<ImprovementActionItem> Actions { get; set; } = new();
        public string ExpectedOutcome { get; set; } = string.Empty;
        public string VerificationCriteria { get; set; } = string.Empty;
        public List<string> EvidenceRequired { get; set; } = new();
        public string EstimatedEffort { get; set; } = "MEDIUM"; // LOW, MEDIUM, HIGH
        public List<string> Dependencies { get; set; } = new();
        public List<int> TurnReferences { get; set; } = new();
    }

    /// <summary>
    /// Phase 3 Step 5: Item in the verification plan for unassessed competencies or re-test scenarios.
    /// </summary>
    public class VerificationPlanItem
    {
        public string TargetConcept { get; set; } = string.Empty;
        public string VerificationMethod { get; set; } = string.Empty;
        public string ScenarioDescription { get; set; } = string.Empty;
        public List<string> ExpectedSignals { get; set; } = new();
    }

    /// <summary>
    /// Phase 3 Step 5: Personalized Improvement Roadmap.
    /// Synthesized from Diagnostic Analysis (Root Cause, Priority, Impact, Evidence).
    /// </summary>
    public class ImprovementRoadmap
    {
        public string SessionId { get; set; } = string.Empty;
        public string TargetPosition { get; set; } = string.Empty;
        public string TargetLevel { get; set; } = "Mid";
        public string Summary { get; set; } = string.Empty;
        public List<ImprovementItem> Items { get; set; } = new();
        public List<string> TopPriorities { get; set; } = new();
        public List<string> StrengthLeverageNotes { get; set; } = new();
        public List<VerificationPlanItem> VerificationPlan { get; set; } = new();
        public List<string> Limitations { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
