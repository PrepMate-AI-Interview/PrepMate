namespace backend.Models
{
    public class IntroductionRequest
    {
        public string SessionId { get; set; } =
            string.Empty;

        public string Introduction { get; set; } =
            string.Empty;
    }


    public class EndInterviewRequest
    {
        public string SessionId { get; set; } =
            string.Empty;
    }
}