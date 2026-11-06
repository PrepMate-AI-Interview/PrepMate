using System;
using System.Threading;
using System.Threading.Tasks;

namespace backend.Services.Email
{
    public class DevSandboxEmailSender : IEmailSender
    {
        private readonly IEmailInboxStore _inboxStore;

        public DevSandboxEmailSender(IEmailInboxStore inboxStore)
        {
            _inboxStore = inboxStore;
        }

        public Task<EmailSendResult> SendEmailAsync(EmailMessage message, CancellationToken cancellationToken = default)
        {
            var stored = new StoredEmail
            {
                To = message.To,
                Subject = message.Subject,
                HtmlBody = message.HtmlBody,
                PlainTextBody = message.PlainTextBody,
                Sender = message.SenderEmail ?? "no-reply@prepmate.vn",
                SentAt = DateTime.UtcNow,
                Status = EmailDeliveryStatus.DeliveredToSandbox
            };

            _inboxStore.Store(stored);
            Console.WriteLine($"[EMAIL SANDBOX] Email stored for {message.To} (Subject: {message.Subject}) [MessageId: {stored.Id}]");

            return Task.FromResult(new EmailSendResult(true, stored.Id, null, EmailDeliveryStatus.DeliveredToSandbox));
        }
    }
}
