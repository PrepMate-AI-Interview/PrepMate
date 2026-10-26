using backend.Models;

namespace backend.Services
{
    public interface IPresenceObservationService
    {
        PresenceObservation RecordObservation(Session session, PresenceObservation observation);
        SignalQualityLevel EvaluateSignalQuality(PresenceObservation observation);
        PresenceObservation CreateFallbackObservation(int turnIndex, string reason = "Camera unavailable");
    }
}
