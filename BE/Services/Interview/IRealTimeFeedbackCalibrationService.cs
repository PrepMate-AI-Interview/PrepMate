using System.Collections.Generic;
using backend.Models;

namespace backend.Services
{
    public interface IRealTimeFeedbackCalibrationService
    {
        RealTimeFeedbackDecision EvaluateAndCalibrateFeedback(
            Session session,
            SpeechObservation? speech,
            PresenceObservation? presence,
            int turnIndex,
            InterviewContext? context = null);

        void AcknowledgeCandidateAdjustment(Session session, int turnIndex);

        string FormatCalibratedGuidance(
            FeedbackType type,
            FeedbackIntensity intensity,
            InterviewContext? context = null,
            bool isPersistentPattern = false);

        string SanitizeAdversarialFeedbackPayload(string json);

        bool ValidateAuthorityIntegrity(Session session);
    }
}
