using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

namespace backend.Services.Email
{
    public class CompositeEmailSender : IEmailSender
    {
        private readonly EmailOptions _options;
        private readonly IEmailInboxStore _inboxStore;
        private readonly IWebHostEnvironment? _environment;
        private readonly SmtpEmailSender _smtpSender;
        private readonly DevSandboxEmailSender _sandboxSender;

        public CompositeEmailSender(
            EmailOptions options,
            IEmailInboxStore inboxStore,
            IWebHostEnvironment? environment = null)
        {
            _options = options;
            _inboxStore = inboxStore;
            _environment = environment;
            _smtpSender = new SmtpEmailSender(options, environment);
            _sandboxSender = new DevSandboxEmailSender(inboxStore);
        }

        public async Task<EmailSendResult> SendEmailAsync(EmailMessage message, CancellationToken cancellationToken = default)
        {
            var isProduction = _environment?.IsProduction() ?? false;

            // Explicit Sandbox mode
            if (string.Equals(_options.Provider, "Sandbox", StringComparison.OrdinalIgnoreCase))
            {
                return await _sandboxSender.SendEmailAsync(message, cancellationToken);
            }

            // If SMTP is explicitly configured or Provider is Smtp
            if (_options.HasSmtpConfiguration || string.Equals(_options.Provider, "Smtp", StringComparison.OrdinalIgnoreCase))
            {
                // Also mirror to sandbox store in non-prod for debugging/testing transparency
                if (!isProduction)
                {
                    await _sandboxSender.SendEmailAsync(message, cancellationToken);
                }

                return await _smtpSender.SendEmailAsync(message, cancellationToken);
            }

            // Fallback for Development/Testing when no SMTP credentials are provided
            if (!isProduction)
            {
                return await _sandboxSender.SendEmailAsync(message, cancellationToken);
            }

            // In Production, do not pretend email was sent if SMTP is missing
            Console.WriteLine("[EMAIL CONFIG ERROR] Cannot deliver email: SMTP host is not configured in Production environment.");
            return new EmailSendResult(false, null, "Hệ thống gửi email chưa được cấu hình cho môi trường Production.", EmailDeliveryStatus.Failed);
        }
    }
}
