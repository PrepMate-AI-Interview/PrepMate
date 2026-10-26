using System;
using System.Linq;
using backend.Models;

namespace backend.Services.Interview
{
    public class InterviewStageOrchestrator : IInterviewStageOrchestrator
    {
        public static InterviewStage NormalizeStage(string? phase)
        {
            if (string.IsNullOrWhiteSpace(phase)) return InterviewStage.SETUP;
            var p = phase.Trim().ToUpperInvariant();
            return p switch
            {
                "SETUP" => InterviewStage.SETUP,
                "INTRODUCTION" => InterviewStage.INTRODUCTION,
                "TECHNICAL_ASSESSMENT" or "ADAPTIVE_INTERVIEW" or "TECHNICAL" => InterviewStage.TECHNICAL_ASSESSMENT,
                "BEHAVIORAL_STAR" or "BEHAVIORAL" => InterviewStage.BEHAVIORAL_STAR,
                "SITUATIONAL_CASE" or "SITUATIONAL" => InterviewStage.SITUATIONAL_CASE,
                "CANDIDATE_QUESTIONS" or "CANDIDATE_QUESTION" => InterviewStage.CANDIDATE_QUESTIONS,
                "CLOSING" => InterviewStage.CLOSING,
                "COMPLETED" => InterviewStage.COMPLETED,
                _ => InterviewStage.TECHNICAL_ASSESSMENT
            };
        }

        public static string ToStageName(InterviewStage stage)
        {
            return stage switch
            {
                InterviewStage.SETUP => InterviewStageNames.Setup,
                InterviewStage.INTRODUCTION => InterviewStageNames.Introduction,
                InterviewStage.TECHNICAL_ASSESSMENT => InterviewStageNames.TechnicalAssessment,
                InterviewStage.BEHAVIORAL_STAR => InterviewStageNames.BehavioralStar,
                InterviewStage.SITUATIONAL_CASE => InterviewStageNames.SituationalCase,
                InterviewStage.CANDIDATE_QUESTIONS => InterviewStageNames.CandidateQuestions,
                InterviewStage.CLOSING => InterviewStageNames.Closing,
                InterviewStage.COMPLETED => InterviewStageNames.Completed,
                _ => InterviewStageNames.TechnicalAssessment
            };
        }

        public static bool IsTechnicalStage(string? phase)
        {
            var stage = NormalizeStage(phase);
            return stage == InterviewStage.TECHNICAL_ASSESSMENT;
        }

        public InterviewStage GetCurrentStage(Session session)
        {
            if (session?.InterviewState == null) return InterviewStage.SETUP;
            return NormalizeStage(session.InterviewState.InterviewPhase);
        }

        public InterviewStage GetNextStage(InterviewStage currentStage)
        {
            return currentStage switch
            {
                InterviewStage.SETUP => InterviewStage.INTRODUCTION,
                InterviewStage.INTRODUCTION => InterviewStage.TECHNICAL_ASSESSMENT,
                InterviewStage.TECHNICAL_ASSESSMENT => InterviewStage.BEHAVIORAL_STAR,
                InterviewStage.BEHAVIORAL_STAR => InterviewStage.SITUATIONAL_CASE,
                InterviewStage.SITUATIONAL_CASE => InterviewStage.CANDIDATE_QUESTIONS,
                InterviewStage.CANDIDATE_QUESTIONS => InterviewStage.CLOSING,
                InterviewStage.CLOSING => InterviewStage.COMPLETED,
                InterviewStage.COMPLETED => InterviewStage.COMPLETED,
                _ => InterviewStage.COMPLETED
            };
        }

        public bool IsStageComplete(Session session, InterviewStage stage, InterviewStageBudget? budget = null)
        {
            if (session?.InterviewState == null) return true;
            var state = session.InterviewState;
            var currentBudget = budget ?? state.StageBudget ?? new InterviewStageBudget
            {
                TechnicalMaxQuestions = state.MaximumQuestions
            };

            switch (stage)
            {
                case InterviewStage.SETUP:
                    return true;

                case InterviewStage.INTRODUCTION:
                    return state.IntroductionCompleted;

                case InterviewStage.TECHNICAL_ASSESSMENT:
                    // Complete if marked ready to finish by engine, or reaches technical max budget
                    if (state.IsReadyToFinish) return true;
                    if (state.QuestionCount >= state.MaximumQuestions) return true;
                    if (state.CurrentStageQuestionCount >= currentBudget.TechnicalMaxQuestions) return true;
                    return false;

                case InterviewStage.BEHAVIORAL_STAR:
                    return state.CurrentStageQuestionCount >= currentBudget.BehavioralMaxQuestions;

                case InterviewStage.SITUATIONAL_CASE:
                    return state.CurrentStageQuestionCount >= currentBudget.SituationalMaxQuestions;

                case InterviewStage.CANDIDATE_QUESTIONS:
                    return state.CandidateQuestionsCompleted || state.CurrentStageQuestionCount >= currentBudget.CandidateQuestionsMax;

                case InterviewStage.CLOSING:
                    return state.ClosingCompleted || state.CurrentStageQuestionCount >= 1;

                case InterviewStage.COMPLETED:
                default:
                    return true;
            }
        }

        public StageTransitionResult EvaluateTransition(Session session, InterviewStageBudget? customBudget = null)
        {
            if (session?.InterviewState == null)
            {
                return StageTransitionResult.NoChange(InterviewStage.SETUP);
            }

            var currentStage = GetCurrentStage(session);
            if (currentStage == InterviewStage.COMPLETED)
            {
                return StageTransitionResult.NoChange(InterviewStage.COMPLETED);
            }

            var budget = customBudget ?? session.InterviewState.StageBudget ?? new InterviewStageBudget
            {
                TechnicalMaxQuestions = session.InterviewState.MaximumQuestions
            };

            bool isComplete = IsStageComplete(session, currentStage, budget);
            if (!isComplete)
            {
                return StageTransitionResult.NoChange(currentStage);
            }

            var nextStage = GetNextStage(currentStage);

            // If the next stage has a max budget of 0 (e.g. behavioral or situational disabled),
            // seamlessly advance to the subsequent stage or COMPLETED.
            while (nextStage != InterviewStage.COMPLETED &&
                   nextStage != InterviewStage.CLOSING &&
                   budget.GetMaxQuestionsForStage(nextStage) <= 0)
            {
                nextStage = GetNextStage(nextStage);
            }

            var message = GetStageTransitionMessage(currentStage, nextStage);
            var reason = $"Stage {currentStage} completed (Question count: {session.InterviewState.CurrentStageQuestionCount}). Advancing to {nextStage}.";

            return StageTransitionResult.Transition(currentStage, nextStage, reason, message, nextStage == InterviewStage.COMPLETED);
        }

        public void ApplyTransition(Session session, InterviewStage targetStage, string reason = "")
        {
            if (session?.InterviewState == null) return;

            var state = session.InterviewState;
            var currentStage = NormalizeStage(state.InterviewPhase);

            if (currentStage == InterviewStage.COMPLETED)
            {
                // Terminal stage cannot be transitioned away from
                return;
            }

            // Record completion of previous stage if different
            if (state.StageHistory != null && state.StageHistory.Count > 0)
            {
                var lastRecord = state.StageHistory.LastOrDefault();
                if (lastRecord != null && lastRecord.CompletedAt == null)
                {
                    lastRecord.CompletedAt = DateTime.UtcNow;
                    lastRecord.QuestionCount = state.CurrentStageQuestionCount;
                }
            }

            state.InterviewPhase = ToStageName(targetStage);
            state.CurrentStageQuestionCount = 0;
            state.StageStartedAt = DateTime.UtcNow;
            if (targetStage != InterviewStage.COMPLETED)
            {
                state.IsReadyToFinish = false;
            }

            state.StageHistory ??= new();
            state.StageHistory.Add(new StageHistoryRecord
            {
                Stage = ToStageName(targetStage),
                StartedAt = DateTime.UtcNow,
                TransitionReason = string.IsNullOrWhiteSpace(reason)
                    ? $"Transitioned from {currentStage} to {targetStage}"
                    : reason
            });

            if (targetStage == InterviewStage.COMPLETED)
            {
                state.IsReadyToFinish = true;
                state.StageCompletedAt = DateTime.UtcNow;
                session.Status = "completed";
            }
        }

        public string GetStageTransitionMessage(InterviewStage fromStage, InterviewStage toStage)
        {
            if (fromStage == InterviewStage.TECHNICAL_ASSESSMENT && toStage == InterviewStage.BEHAVIORAL_STAR)
            {
                return "Cảm ơn bạn. Tôi đã có đủ thông tin về phần kỹ thuật chuyên môn. Bây giờ chúng ta sẽ chuyển sang một vài câu hỏi về kinh nghiệm làm việc nhóm và cách bạn xử lý các tình huống thực tế.";
            }

            if (fromStage == InterviewStage.BEHAVIORAL_STAR && toStage == InterviewStage.SITUATIONAL_CASE)
            {
                return "Rất tốt. Tiếp theo, tôi muốn đưa ra một tình huống cụ thể trong dự án để xem cách bạn tiếp cận và giải quyết vấn đề khi gặp sự cố bất ngờ.";
            }

            if ((fromStage == InterviewStage.TECHNICAL_ASSESSMENT || fromStage == InterviewStage.SITUATIONAL_CASE) &&
                toStage == InterviewStage.CANDIDATE_QUESTIONS)
            {
                return "Cảm ơn bạn đã chia sẻ góc nhìn. Ở phần tiếp theo của buổi phỏng vấn, tôi rất muốn lắng nghe câu hỏi từ phía bạn. Bạn có thắc mắc hay muốn tìm hiểu thêm điều gì về vị trí hoặc công ty chúng tôi không?";
            }

            if (toStage == InterviewStage.CLOSING)
            {
                return "Cảm ơn những trao đổi rất cởi mở của bạn. Buổi phỏng vấn hôm nay đến đây là kết thúc.";
            }

            if (toStage == InterviewStage.COMPLETED)
            {
                return "Buổi phỏng vấn đã hoàn tất. Báo cáo đánh giá năng lực chi tiết đã sẵn sàng.";
            }

            return string.Empty;
        }
    }
}
