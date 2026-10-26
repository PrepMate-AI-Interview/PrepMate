using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using backend.Models;

namespace backend.Services
{
    public class SpeechObservationService : ISpeechObservationService
    {
        private static readonly string[] FillerPatterns = new[]
        {
            @"\bờ\b",
            @"\bừm\b",
            @"\bừ\b",
            @"\bà\b",
            @"\bkiểu như\b",
            @"\bkiểu\b",
            @"\bthì\b",
            @"\bnhư là\b",
            @"\bum\b",
            @"\buh\b",
            @"\blike\b",
            @"\byou know\b"
        };

        public SpeechObservation AnalyzeSpeech(
            Session session,
            string transcript,
            double speakingDurationSeconds,
            double pauseDurationSeconds,
            double transcriptConfidence = 1.0,
            int turnIndex = 1)
        {
            if (string.IsNullOrWhiteSpace(transcript) && speakingDurationSeconds <= 0)
            {
                return CreateFallbackObservation(turnIndex, "No speech signal detected");
            }

            var cleanTranscript = transcript?.Trim() ?? string.Empty;
            var words = cleanTranscript.Split(new[] { ' ', '\t', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
            int wordCount = words.Length;

            // Calculate Words Per Minute (WPM)
            double durationMinutes = speakingDurationSeconds > 0 ? (speakingDurationSeconds / 60.0) : (wordCount > 0 ? (wordCount / 130.0) : 0.1);
            double wpm = durationMinutes > 0 ? Math.Round(wordCount / durationMinutes, 1) : 0;

            // Extract filler words
            var detectedFillers = new List<string>();
            int fillerCount = 0;
            var lowerTranscript = cleanTranscript.ToLowerInvariant();

            foreach (var pattern in FillerPatterns)
            {
                var matches = Regex.Matches(lowerTranscript, pattern);
                if (matches.Count > 0)
                {
                    fillerCount += matches.Count;
                    detectedFillers.Add(pattern.Replace(@"\b", string.Empty));
                }
            }

            // Deterministic classification
            var (rate, pause, filler) = ClassifySpeechMetrics(wpm, pauseDurationSeconds, fillerCount, wordCount);

            var observation = new SpeechObservation
            {
                TurnIndex = turnIndex,
                SpeakingDurationSeconds = speakingDurationSeconds,
                PauseDurationSeconds = pauseDurationSeconds,
                SilenceDurationSeconds = pauseDurationSeconds,
                WordsPerMinute = wpm,
                WordCount = wordCount,
                FillerWordCount = fillerCount,
                DetectedFillerWords = detectedFillers,
                TranscriptLength = cleanTranscript.Length,
                TranscriptConfidence = Math.Clamp(transcriptConfidence, 0.0, 1.0),
                SpeechRate = rate,
                PausePattern = pause,
                FillerDensity = filler,
                IsMicrophoneAvailable = true,
                Timestamp = DateTime.UtcNow
            };

            // Attach to conduct state
            if (session.ConductState != null)
            {
                session.ConductState.SpeechObservations.Add(observation);
                session.ConductState.SpeechPacing = rate;
                session.ConductState.ResponseTiming = pauseDurationSeconds;

                if (rate == SpeechRateLevel.FAST)
                {
                    session.ConductState.ConsecutiveFastSpeechTurns++;
                }
                else
                {
                    session.ConductState.ConsecutiveFastSpeechTurns = 0;
                }

                if (pause == PausePattern.LONG)
                {
                    session.ConductState.ConsecutiveLongPauseTurns++;
                }
                else
                {
                    session.ConductState.ConsecutiveLongPauseTurns = 0;
                }

                if (filler == FillerDensityLevel.HIGH)
                {
                    session.ConductState.ConsecutiveHighFillerTurns++;
                }
                else
                {
                    session.ConductState.ConsecutiveHighFillerTurns = 0;
                }

                if (observation.TranscriptConfidence < 0.65)
                {
                    session.ConductState.LowTranscriptConfidenceTurns++;
                }
            }

            return observation;
        }

        public (SpeechRateLevel rate, PausePattern pause, FillerDensityLevel filler) ClassifySpeechMetrics(
            double wpm,
            double pauseDuration,
            int fillerCount,
            int wordCount)
        {
            // Speech Rate: Slow < 100, Normal 100-165, Fast > 165
            SpeechRateLevel rate;
            if (wpm <= 0) rate = SpeechRateLevel.UNKNOWN;
            else if (wpm < 100) rate = SpeechRateLevel.SLOW;
            else if (wpm > 165) rate = SpeechRateLevel.FAST;
            else rate = SpeechRateLevel.NORMAL;

            // Pause Pattern: None < 1.0s, Short 1.0-2.5s, Moderate 2.5-4.0s, Long > 4.0s
            PausePattern pause;
            if (pauseDuration < 1.0) pause = PausePattern.NONE;
            else if (pauseDuration <= 2.5) pause = PausePattern.SHORT;
            else if (pauseDuration <= 4.0) pause = PausePattern.MODERATE;
            else pause = PausePattern.LONG;

            // Filler Density: per 100 words
            FillerDensityLevel filler;
            if (wordCount <= 0)
            {
                filler = FillerDensityLevel.LOW;
            }
            else
            {
                double density = (fillerCount * 100.0) / wordCount;
                if (density < 3.5) filler = FillerDensityLevel.LOW;
                else if (density <= 7.5) filler = FillerDensityLevel.MODERATE;
                else filler = FillerDensityLevel.HIGH;
            }

            return (rate, pause, filler);
        }

        public SpeechObservation CreateFallbackObservation(int turnIndex, string reason = "Microphone unavailable")
        {
            return new SpeechObservation
            {
                TurnIndex = turnIndex,
                SpeakingDurationSeconds = 0,
                PauseDurationSeconds = 0,
                SilenceDurationSeconds = 0,
                WordsPerMinute = 0,
                WordCount = 0,
                FillerWordCount = 0,
                TranscriptLength = 0,
                TranscriptConfidence = 0.0,
                SpeechRate = SpeechRateLevel.UNKNOWN,
                PausePattern = PausePattern.NONE,
                FillerDensity = FillerDensityLevel.LOW,
                IsMicrophoneAvailable = false,
                TechnicalIssue = reason,
                Timestamp = DateTime.UtcNow
            };
        }
    }
}
