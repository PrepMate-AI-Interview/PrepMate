using System;
using backend.Models;

namespace backend.Services
{
    public class PresenceObservationService : IPresenceObservationService
    {
        public PresenceObservation RecordObservation(Session session, PresenceObservation observation)
        {
            if (observation == null)
            {
                observation = CreateFallbackObservation(session.Answers?.Count ?? 0, "Null observation payload");
            }

            // Evaluate signal quality deterministically
            observation.SignalQuality = EvaluateSignalQuality(observation);

            // Attach to conduct state if initialized
            if (session.ConductState != null)
            {
                session.ConductState.PresenceObservations.Add(observation);
                session.ConductState.PresenceSignalQuality = observation.SignalQuality;

                if (!observation.IsCameraAvailable || observation.SignalQuality == SignalQualityLevel.UNAVAILABLE)
                {
                    session.ConductState.CameraInterruptionCount++;
                }
            }

            return observation;
        }

        public SignalQualityLevel EvaluateSignalQuality(PresenceObservation observation)
        {
            if (observation == null || !observation.IsCameraAvailable)
            {
                return SignalQualityLevel.UNAVAILABLE;
            }

            if (observation.FaceVisibility == FaceVisibility.NOT_VISIBLE)
            {
                return SignalQualityLevel.UNAVAILABLE;
            }

            if (observation.FaceVisibility == FaceVisibility.PARTIAL ||
                observation.EyeGaze == EyeGazeAvailability.UNAVAILABLE ||
                observation.Posture == PostureState.UNKNOWN)
            {
                return SignalQualityLevel.DEGRADED;
            }

            return SignalQualityLevel.GOOD;
        }

        public PresenceObservation CreateFallbackObservation(int turnIndex, string reason = "Camera unavailable")
        {
            return new PresenceObservation
            {
                TurnIndex = turnIndex,
                IsCameraAvailable = false,
                Posture = PostureState.UNKNOWN,
                EyeGaze = EyeGazeAvailability.UNKNOWN,
                FaceVisibility = FaceVisibility.NOT_VISIBLE,
                HeadMovement = MovementLevel.NONE,
                BodyMovement = MovementLevel.NONE,
                SignalQuality = SignalQualityLevel.UNAVAILABLE,
                TechnicalIssue = reason,
                Timestamp = DateTime.UtcNow
            };
        }
    }
}
