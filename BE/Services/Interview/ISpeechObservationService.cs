using backend.Models;

namespace backend.Services
{
    public interface ISpeechObservationService
    {
        SpeechObservation AnalyzeSpeech(
            Session session,
            string transcript,
            double speakingDurationSeconds,
            double pauseDurationSeconds,
            double transcriptConfidence = 1.0,
            int turnIndex = 1);

        (SpeechRateLevel rate, PausePattern pause, FillerDensityLevel filler) ClassifySpeechMetrics(
            double wpm,
            double pauseDuration,
            int fillerCount,
            int wordCount);

        SpeechObservation CreateFallbackObservation(int turnIndex, string reason = "Microphone unavailable");
    }
}
