namespace backend.Services.Email
{
    public record EmailMessage(
        string To,
        string Subject,
        string HtmlBody,
        string? PlainTextBody = null,
        string? SenderName = null,
        string? SenderEmail = null
    );

    public enum EmailDeliveryStatus
    {
        DeliveredToSandbox,
        SentToProvider,
        AcceptedByProvider,
        Failed
    }

    public record EmailSendResult(
        bool Success,
        string? MessageId = null,
        string? Error = null,
        EmailDeliveryStatus Status = EmailDeliveryStatus.SentToProvider
    );

    public interface IEmailSender
    {
        Task<EmailSendResult> SendEmailAsync(EmailMessage message, CancellationToken cancellationToken = default);
    }
}
