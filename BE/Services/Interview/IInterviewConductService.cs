using backend.Models;

namespace backend.Services
{
    public interface IInterviewConductService
    {
        InterviewConductState InitializeConductState(Session session, MultimodalConsentState consent);

        (InterviewConductAction Action, string Guidance, SignalInterpretation? Interpretation) EvaluateConduct(
            Session session,
            SpeechObservation? speech,
            PresenceObservation? presence,
            int turnIndex);

        string FormatInterviewerDeliveryPrefix(InterviewConductAction action);

        ConductSummary GenerateConductSummary(Session session);

        string SanitizeAdversarialAiPayload(string aiJson);
    }
}
