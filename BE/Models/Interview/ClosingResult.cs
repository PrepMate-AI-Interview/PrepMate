namespace backend.Models
{
    public class ClosingResult
    {
        public string ClosingStatement { get; set; } = string.Empty;
        public bool IsCompleted { get; set; } = false;
        public ClosingEvidence? Evidence { get; set; }
    }
}
