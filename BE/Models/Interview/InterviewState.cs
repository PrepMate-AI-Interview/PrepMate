using System;
using System.Collections.Generic;
using backend.Services.Interview;

namespace backend.Models
{
    public class InterviewState
    {
        // =========================================================
        // INTERVIEW PHASE & LIFECYCLE (PHASE 4 STEP 2)
        // =========================================================

        // SETUP, INTRODUCTION, TECHNICAL_ASSESSMENT, BEHAVIORAL_STAR,
        // SITUATIONAL_CASE, CANDIDATE_QUESTIONS, CLOSING, COMPLETED
        // (Legacy alias: ADAPTIVE_INTERVIEW maps to TECHNICAL_ASSESSMENT)
        public string InterviewPhase { get; set; } =
            "INTRODUCTION";

        public int CurrentStageQuestionCount { get; set; } = 0;

        public DateTime? StageStartedAt { get; set; }

        public DateTime? StageCompletedAt { get; set; }

        public List<StageHistoryRecord> StageHistory { get; set; } =
            new();

        public InterviewStageBudget? StageBudget { get; set; }

        public InterviewStage CurrentStage =>
            InterviewStageOrchestrator.NormalizeStage(InterviewPhase);

        public bool IsTechnicalStage =>
            InterviewStageOrchestrator.IsTechnicalStage(InterviewPhase);

        public string IntroductionAnswer { get; set; } =
            string.Empty;

        public bool IntroductionCompleted { get; set; } =
            false;

        public int IntroductionDurationSeconds { get; set; } =
            120;


        // =========================================================
        // CURRENT INTERVIEW POSITION
        // =========================================================

        public string CurrentTopic { get; set; } =
            string.Empty;

        public string CurrentSubtopic { get; set; } =
            string.Empty;

        public string CurrentDimension { get; set; } =
            string.Empty;

        // Phase 4 Step 3: Behavioral & Situational State
        public string? ActiveBehavioralCompetency { get; set; }
        public string? ActiveSituationalCategory { get; set; }
        public string? LastParentQuestionId { get; set; }

        // Phase 4 Step 4: Candidate Q&A & Closing State
        public bool CandidateQuestionsCompleted { get; set; } = false;
        public bool ClosingCompleted { get; set; } = false;
        public string? LastCandidateQuestion { get; set; }
        public string? LastInterviewerAnswer { get; set; }
        public string? LastClosingStatement { get; set; }


        // =========================================================
        // ADAPTIVE STATE
        // =========================================================

        public int TopicDepth { get; set; } = 0;

        public int FollowUpCount { get; set; } = 0;

        public string LastDecision { get; set; } =
            string.Empty;


        // =========================================================
        // TOPICS
        // =========================================================

        public List<string> TopicsCovered { get; set; } =
            new();

        public List<string> TopicsRemaining { get; set; } =
            new();


        // =========================================================
        // ANSWER / CONCEPT STATE
        // =========================================================

        public List<string> LastAnswerConcepts { get; set; } =
            new();

        public List<string> DiscoveredConcepts { get; set; } =
            new();

        public List<string> StrongConcepts { get; set; } =
            new();

        public List<string> WeakConcepts { get; set; } =
            new();

        public List<string> UnknownConcepts { get; set; } =
            new();

        // =========================================================
        // FACTS, CLAIMS & CONSISTENCY MEMORY
        // =========================================================

        public List<string> VerifiedFacts { get; set; } =
            new();

        public List<string> UnverifiedClaims { get; set; } =
            new();

        public List<string> DetectedInconsistencies { get; set; } =
            new();


        // =========================================================
        // QUESTION STATE
        // =========================================================

        public int QuestionCount { get; set; } = 0;

        public int MaximumQuestions { get; set; } = 15;

        public bool IsReadyToFinish { get; set; } =
            false;

        public List<string> QuestionTypesUsed { get; set; } =
            new();

        // =========================================================
        // AI DECISION MEMORY
        // =========================================================

        public double KnowledgeConfidence { get; set; } = 0;

        public string CandidateLevel { get; set; } =
            "Mid";


        public int TopicFollowUpLimit { get; set; } = 3;


        public List<string> DecisionHistory { get; set; } =
            new();


        public List<string> ConceptsToVerify { get; set; } =
            new();


        // =========================================================
        // INTERVIEW QUALITY SIGNALS
        // =========================================================

        public int StrongAnswerCount { get; set; } = 0;

        public int WeakAnswerCount { get; set; } = 0;

        public int PracticalExperienceCount { get; set; } = 0;

        // =========================================================
        // PHASE 2: KNOWLEDGE COVERAGE & TARGET EVALUATION
        // =========================================================

        public Dictionary<string, ConceptCoverageStatus> KnowledgeCoverage { get; set; } = new();

        public TargetEvaluationContext? ActiveTargetEvaluation { get; set; }

        // Phase 2 Step 7: Interview Strategy & Coverage Planning
        public InterviewStrategy? Strategy { get; set; }

        // Phase 4 Step 6: Interview Quality, Realism & Adaptive Pressure
        public InterviewQualityState? QualityState { get; set; }

        // Phase 4 Step 7: Interview Conduct State
        public InterviewConductState? ConductState { get; set; }
    }
}