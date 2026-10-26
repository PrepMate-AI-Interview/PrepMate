using System.Collections.Generic;

namespace backend.Models
{
    public class AnswerAnalysis
    {
        public string MainConcept { get; set; } = "";

        public string AnswerType { get; set; } = "UNCERTAIN";

        public int Depth { get; set; }

        public double Confidence { get; set; }

        public List<string> Concepts { get; set; } = new();

        public List<string> CorrectConcepts { get; set; } = new();

        public List<string> MissingConcepts { get; set; } = new();

        public List<string> IncorrectConcepts { get; set; } = new();

        public List<string> FollowUpCandidates { get; set; } = new();

        public bool NeedsClarification { get; set; }

        public bool ShowsPracticalExperience { get; set; }

        public bool DoesNotKnow { get; set; }
 
        public string Summary { get; set; } = "";

        // =========================================================
        // CROSS-TURN CONSISTENCY & FACT VS CLAIM
        // =========================================================
        public bool HasInconsistency { get; set; } = false;

        public string InconsistencyDetail { get; set; } = "";

        public string ContradictedPriorStatement { get; set; } = "";

        public List<string> VerifiedFacts { get; set; } = new();

        public List<string> UnverifiedClaims { get; set; } = new();

        public string ChallengeTrigger { get; set; } = "";
    }
}
