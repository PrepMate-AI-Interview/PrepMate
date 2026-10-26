namespace backend.Models
{
    public class InterviewStageBudget
    {
        public int TechnicalMinQuestions { get; set; } = 3;
        public int TechnicalMaxQuestions { get; set; } = 15;

        public int BehavioralMinQuestions { get; set; } = 0;
        public int BehavioralMaxQuestions { get; set; } = 3;

        public int SituationalMinQuestions { get; set; } = 0;
        public int SituationalMaxQuestions { get; set; } = 2;

        public int CandidateQuestionsMin { get; set; } = 1;
        public int CandidateQuestionsMax { get; set; } = 2;

        public int TotalQuestionBudget =>
            TechnicalMaxQuestions + BehavioralMaxQuestions + SituationalMaxQuestions + CandidateQuestionsMax;

        public int GetMaxQuestionsForStage(InterviewStage stage)
        {
            return stage switch
            {
                InterviewStage.TECHNICAL_ASSESSMENT => TechnicalMaxQuestions,
                InterviewStage.BEHAVIORAL_STAR => BehavioralMaxQuestions,
                InterviewStage.SITUATIONAL_CASE => SituationalMaxQuestions,
                InterviewStage.CANDIDATE_QUESTIONS => CandidateQuestionsMax,
                InterviewStage.INTRODUCTION => 1,
                InterviewStage.CLOSING => 1,
                _ => 1
            };
        }

        public int GetMinQuestionsForStage(InterviewStage stage)
        {
            return stage switch
            {
                InterviewStage.TECHNICAL_ASSESSMENT => TechnicalMinQuestions,
                InterviewStage.BEHAVIORAL_STAR => BehavioralMinQuestions,
                InterviewStage.SITUATIONAL_CASE => SituationalMinQuestions,
                InterviewStage.CANDIDATE_QUESTIONS => CandidateQuestionsMin,
                _ => 0
            };
        }
    }
}
