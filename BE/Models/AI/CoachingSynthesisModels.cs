using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace backend.Models.AI
{
    public class CoachingSynthesisRequest
    {
        [JsonPropertyName("sessionId")]
        public string? SessionId { get; set; }

        [JsonPropertyName("language")]
        public string? Language { get; set; } = "vi";

        [JsonPropertyName("cameraUsed")]
        public bool CameraUsed { get; set; } = true;

        [JsonPropertyName("turns")]
        public List<CoachingTurnPayload>? Turns { get; set; }

        [JsonPropertyName("affectsProfessionalScore")]
        public bool AffectsProfessionalScore { get; set; } = false;
    }

    public class CoachingTurnPayload
    {
        [JsonPropertyName("turnIndex")]
        public int TurnIndex { get; set; }

        [JsonPropertyName("question")]
        public string? Question { get; set; }

        [JsonPropertyName("hasAudio")]
        public bool HasAudio { get; set; }

        [JsonPropertyName("hasVideo")]
        public bool HasVideo { get; set; }

        [JsonPropertyName("recordingDurationSec")]
        public double RecordingDurationSec { get; set; }

        [JsonPropertyName("recordId")]
        public string? RecordId { get; set; }

        [JsonPropertyName("speechMetrics")]
        public CoachingSpeechMetrics? SpeechMetrics { get; set; }

        [JsonPropertyName("bodyLanguageMetrics")]
        public CoachingBodyLanguageMetrics? BodyLanguageMetrics { get; set; }
    }

    public class CoachingSpeechMetrics
    {
        [JsonPropertyName("wpm")]
        public double? Wpm { get; set; }

        [JsonPropertyName("activeWpm")]
        public double? ActiveWpm { get; set; }

        [JsonPropertyName("speechActiveSec")]
        public double? SpeechActiveSec { get; set; }

        [JsonPropertyName("fillerCount")]
        public int FillerCount { get; set; }

        [JsonPropertyName("repetitionCount")]
        public int RepetitionCount { get; set; }
    }

    public class CoachingBodyLanguageMetrics
    {
        [JsonPropertyName("selectedTier")]
        public string? SelectedTier { get; set; }

        [JsonPropertyName("method")]
        public string? Method { get; set; }

        [JsonPropertyName("anatomicalLandmarksAvailable")]
        public bool AnatomicalLandmarksAvailable { get; set; }

        [JsonPropertyName("isReliable")]
        public bool IsReliable { get; set; } = true;

        [JsonPropertyName("insufficientVisualEvidenceReason")]
        public string? InsufficientVisualEvidenceReason { get; set; }

        [JsonPropertyName("movementFrequency")]
        public double? MovementFrequency { get; set; }

        [JsonPropertyName("postureLeanAngle")]
        public double? PostureLeanAngle { get; set; }

        [JsonPropertyName("postureCentroidOffset")]
        public double? PostureCentroidOffset { get; set; }

        [JsonPropertyName("events")]
        public List<CoachingEventPayload>? Events { get; set; }
    }

    public class CoachingEventPayload
    {
        [JsonPropertyName("eventId")]
        public string? EventId { get; set; }

        [JsonPropertyName("type")]
        public string? Type { get; set; }

        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("offsetSec")]
        public double OffsetSec { get; set; }

        [JsonPropertyName("hasVideoClip")]
        public bool HasVideoClip { get; set; }

        [JsonPropertyName("clipWindow")]
        public CoachingClipWindow? ClipWindow { get; set; }
    }

    public class CoachingClipWindow
    {
        [JsonPropertyName("startSec")]
        public double StartSec { get; set; }

        [JsonPropertyName("endSec")]
        public double EndSec { get; set; }

        [JsonPropertyName("durationSec")]
        public double DurationSec { get; set; }
    }

    public class CoachingSynthesisResponse
    {
        [JsonPropertyName("items")]
        public List<CoachingItemDto> Items { get; set; } = new();

        [JsonPropertyName("isDeterministicFallback")]
        public bool IsDeterministicFallback { get; set; }

        [JsonPropertyName("affectsProfessionalScore")]
        public bool AffectsProfessionalScore { get; set; } = false;
    }

    public class CoachingItemDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("turnIndex")]
        public int TurnIndex { get; set; }

        [JsonPropertyName("dimension")]
        public string Dimension { get; set; } = "voice";

        [JsonPropertyName("observation")]
        public string Observation { get; set; } = "";

        [JsonPropertyName("evidence")]
        public CoachingItemEvidenceDto Evidence { get; set; } = new();

        [JsonPropertyName("interpretation")]
        public string Interpretation { get; set; } = "";

        [JsonPropertyName("recommendation")]
        public string Recommendation { get; set; } = "";

        [JsonPropertyName("confidenceAndLimitations")]
        public CoachingItemConfidenceDto ConfidenceAndLimitations { get; set; } = new();

        [JsonPropertyName("affectsProfessionalScore")]
        public bool AffectsProfessionalScore { get; set; } = false;
    }

    public class CoachingItemEvidenceDto
    {
        [JsonPropertyName("signal")]
        public string Signal { get; set; } = "";

        [JsonPropertyName("measurementValue")]
        public string MeasurementValue { get; set; } = "";

        [JsonPropertyName("eventId")]
        public string? EventId { get; set; }

        [JsonPropertyName("mediaOffsetSec")]
        public double? MediaOffsetSec { get; set; }

        [JsonPropertyName("playbackWindow")]
        public CoachingClipWindow? PlaybackWindow { get; set; }

        [JsonPropertyName("selectedTier")]
        public string SelectedTier { get; set; } = "audio_analysis";

        [JsonPropertyName("method")]
        public string Method { get; set; } = "";

        [JsonPropertyName("anatomicalLandmarksAvailable")]
        public bool AnatomicalLandmarksAvailable { get; set; }

        [JsonPropertyName("hasVideoClip")]
        public bool HasVideoClip { get; set; }

        [JsonPropertyName("recordId")]
        public string? RecordId { get; set; }
    }

    public class CoachingItemConfidenceDto
    {
        [JsonPropertyName("status")]
        public string Status { get; set; } = "reliable_evidence";

        [JsonPropertyName("reason")]
        public string Reason { get; set; } = "";
    }
}
