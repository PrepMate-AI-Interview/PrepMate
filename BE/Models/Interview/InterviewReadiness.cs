using System.Collections.Generic;

namespace backend.Models
{
    public enum ReadinessStatus
    {
        READY,
        PARTIALLY_READY,
        NOT_READY
    }

    public class ReadinessIssue
    {
        public string Field { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Severity { get; set; } = "ERROR"; // ERROR, WARNING, INFO
        public string Message { get; set; } = string.Empty;
    }

    public class InterviewReadinessResult
    {
        public ReadinessStatus Status { get; set; } = ReadinessStatus.NOT_READY;
        public bool CanStart { get; set; } = false;
        public List<ReadinessIssue> Issues { get; set; } = new();
        public List<string> Suggestions { get; set; } = new();
        public Dictionary<string, string> NormalizedContext { get; set; } = new();
    }
}
