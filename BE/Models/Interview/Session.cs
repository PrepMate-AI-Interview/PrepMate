using System.Collections.Generic;

namespace backend.Models
{
    public class AnswerItem
    {
        public string Question { get; set; } = string.Empty;
        public string Answer { get; set; } = string.Empty;

        // Phase 3 Step 1: Turn-by-turn evidence preservation
        public string? TargetConceptId { get; set; }
        public string? TargetConceptName { get; set; }
        public int Depth { get; set; }
        public bool ShowsPracticalExperience { get; set; }
        public List<string> CorrectConcepts { get; set; } = new();
        public List<string> IncorrectConcepts { get; set; } = new();
        public List<string> VerifiedFacts { get; set; } = new();
        public List<string> UnverifiedClaims { get; set; } = new();
        public bool HasInconsistency { get; set; }
        public string InconsistencyDetail { get; set; } = string.Empty;

        // Phase 4 Step 2: Multi-Stage Lifecycle Metadata
        public string? QuestionId { get; set; }
        public string? ParentQuestionId { get; set; }
        public string QuestionType { get; set; } = "Technical";
        public string Stage { get; set; } = "TECHNICAL_ASSESSMENT";
        public int DurationSeconds { get; set; } = 0;

        // Phase 4 Step 3: Behavioral & Situational Evidence
        public BehavioralEvidence? BehavioralEvidence { get; set; }
        public SituationalEvidence? SituationalEvidence { get; set; }

        // Phase 4 Step 4: Candidate Q&A & Closing Evidence
        public CandidateQuestionEvidence? CandidateQuestionEvidence { get; set; }
        public ClosingEvidence? ClosingEvidence { get; set; }
        public string? InterviewerAnswer { get; set; }

        // Phase 4 Step 5: Multi-Industry Claim & Evidence Probing
        public List<CandidateClaim>? Claims { get; set; }
        public string? ProbePattern { get; set; }
        public string? ProbeReason { get; set; }

        // Phase 4 Step 7: Presence & Speech Observations
        public SpeechObservation? SpeechObservation { get; set; }
        public PresenceObservation? PresenceObservation { get; set; }
        public SignalInterpretation? Interpretation { get; set; }

        // Phase 5 Step 4: Natural Interviewer Conversation Specification
        public InterviewQuestionSpecification? QuestionSpecification { get; set; }

        // Phase 5 Step 6: Real-Time Adaptive Feedback Decision
        public RealTimeFeedbackDecision? RealTimeFeedback { get; set; }
    }


    public class ReportCriteria
    {
        public string TechnicalKnowledge { get; set; } =
            string.Empty;

        public string Communication { get; set; } =
            string.Empty;

        public string ProblemSolving { get; set; } =
            string.Empty;

        public string Attitude { get; set; } =
            string.Empty;
    }


    public class KnowledgeAnalysisItem
    {
        public string Question { get; set; } =
            string.Empty;

        public string Rating { get; set; } =
            string.Empty;

        public string Analysis { get; set; } =
            string.Empty;

        public string Supplement { get; set; } =
            string.Empty;
    }


    public class ReportModel
    {
        public double OverallScore { get; set; }

        public double TechScore { get; set; }

        public double CommScore { get; set; }

        public double SoftScore { get; set; }

        public double StarScore { get; set; }
        public double SituationalScore { get; set; }
        public double CandidateQuestionScore { get; set; }


        public ReportCriteria Criteria { get; set; } =
            new();


        public string Strengths { get; set; } =
            string.Empty;

        public string Improvements { get; set; } =
            string.Empty;

        public string Suggestion { get; set; } =
            string.Empty;


        public List<KnowledgeAnalysisItem>
            KnowledgeAnalysis
        { get; set; } =
            new();

        // Phase 3 Step 2: Evidence-based report projection
        public InterviewReport? EvidenceReport { get; set; }

        // Phase 4 Step 5: Interviewer Intelligence Summary
        public InterviewerIntelligenceSummary? IntelligenceSummary { get; set; }

        // Phase 4 Step 6: Interview Quality Summary
        public InterviewQualitySummary? QualitySummary { get; set; }

        // Phase 4 Step 7: Interview Conduct Summary
        public ConductSummary? ConductSummary { get; set; }
    }


    public class Session
    {
        public string Id { get; set; } =
            string.Empty;

        public string UserId { get; set; } =
            string.Empty;

        public string JobTitle { get; set; } =
            string.Empty;

        public string JdText { get; set; } =
            string.Empty;

        public string CvText { get; set; } =
            string.Empty;



        public List<string>? Questions { get; set; }

        public List<AnswerItem> Answers { get; set; } =
            new();


        public List<string> Feedbacks { get; set; } =
            new();


        public string CreatedAt { get; set; } =
            string.Empty;

        public string Status { get; set; } =
            "in_progress";


        public ReportModel? Report { get; set; }

        // Phase 3 Step 1: Evidence-backed Final Evaluation
        public FinalInterviewEvaluation? Evaluation { get; set; }

        public InterviewContext? InterviewContext { get; set; }

        public InterviewState InterviewState { get; set; } =
            new();

        // Phase 4 Step 5: Multi-Industry Evidence State & Blueprint
        public InterviewEvidenceState? EvidenceState { get; set; }
        public InterviewBlueprint? InterviewBlueprint { get; set; }

        // Phase 4 Step 6: Interview Quality State
        public InterviewQualityState? QualityState { get; set; }

        // Phase 4 Step 7: Interview Conduct State & Multimodal Consent
        public InterviewConductState? ConductState { get; set; }
        public MultimodalConsentState MultimodalConsent { get; set; } = MultimodalConsentState.NONE;

        // Phase 5 Step 6: Real-Time Adaptive Feedback State
        public RealTimeFeedbackState? FeedbackState { get; set; }

        // Language Contract - Single Source of Truth
        public string Language { get; set; } = InterviewLanguage.Vietnamese;

        // AI Architecture Reconstruction: Immutable Session Routing Snapshot & Evidence Ledger
        public backend.Models.AI.SessionAiSnapshot? AiSnapshot { get; set; }
        public backend.Models.AI.EvidenceLedger? EvidenceLedger { get; set; }
        public bool IsNoAiMode { get; set; } = false;
        public string? NoAiNotice { get; set; }

        // Quota & Entitlement Tracking
        public bool IsStarted { get; set; } = true;
        public string? StartedAt { get; set; }
        public string? PlanSnapshot { get; set; }
        public string? OriginalGuestId { get; set; }
        public string? ClaimedAt { get; set; }
    }
}