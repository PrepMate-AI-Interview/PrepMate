using System;

namespace backend.Features.Interview.Models
{
    public class InterviewMessage
    {
        public string Role { get; set; } = string.Empty;

        // AI
        // CANDIDATE
        public string Content { get; set; } = string.Empty;


        public DateTime Timestamp { get; set; }
            = DateTime.UtcNow;


        // thời gian ứng viên trả lời
        public int DurationSeconds { get; set; }


        public string MessageType { get; set; }
            = "TEXT";

        // TEXT
        // SYSTEM
        // QUESTION
        // ANSWER
    }
}