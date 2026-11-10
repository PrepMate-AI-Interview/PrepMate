using System;
using System.Net.Http;
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
        private readonly ResendEmailSender _resendSender;

        public CompositeEmailSender(
            EmailOptions options,
            IEmailInboxStore inboxStore,
            IWebHostEnvironment? environment = null)
            : this(options, inboxStore, environment, null)
        {
        }

        public CompositeEmailSender(
            EmailOptions options,
            IEmailInboxStore inboxStore,
            IWebHostEnvironment? environment,
            HttpClient? httpClient)
        {
            _options = options;
            _inboxStore = inboxStore;
            _environment = environment;
            _smtpSender = new SmtpEmailSender(options, environment);
            _sandboxSender = new DevSandboxEmailSender(inboxStore);
            _resendSender = new ResendEmailSender(options, httpClient);
        }

        public async Task<EmailSendResult> SendEmailAsync(EmailMessage message, CancellationToken cancellationToken = default)
        {
            var isProduction = _environment?.IsProduction() ?? false;

            // 1. Explicit Sandbox mode
            if (string.Equals(_options.Provider, "Sandbox", StringComparison.OrdinalIgnoreCase))
            {
                return await _sandboxSender.SendEmailAsync(message, cancellationToken);
            }

            // 2. Explicit Resend API mode
            if (string.Equals(_options.Provider, "Resend_Api", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(_options.Provider, "Resend", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(_options.Provider, "HttpApi", StringComparison.OrdinalIgnoreCase))
            {
                if (!isProduction)
                {
                    await _sandboxSender.SendEmailAsync(message, cancellationToken);
                }
                return await _resendSender.SendEmailAsync(message, cancellationToken);
            }

            // 3. Explicit SMTP mode
            if (string.Equals(_options.Provider, "Smtp", StringComparison.OrdinalIgnoreCase))
            {
                if (!isProduction)
                {
                    await _sandboxSender.SendEmailAsync(message, cancellationToken);
                }
                return await _smtpSender.SendEmailAsync(message, cancellationToken);
            }

            // 4. Auto mode:
            // Prefer Resend API if ResendApiKey is provided (especially optimal on Render Free Web Services)
            if (_options.HasResendConfiguration)
            {
                if (!isProduction)
                {
                    await _sandboxSender.SendEmailAsync(message, cancellationToken);
                }
                return await _resendSender.SendEmailAsync(message, cancellationToken);
            }

            // Fall back to SMTP if SMTP host is configured
            if (_options.HasSmtpConfiguration)
            {
                if (!isProduction)
                {
                    await _sandboxSender.SendEmailAsync(message, cancellationToken);
                }
                return await _smtpSender.SendEmailAsync(message, cancellationToken);
            }

            // Fallback for Development/Testing when no external credentials are provided
            if (!isProduction)
            {
                return await _sandboxSender.SendEmailAsync(message, cancellationToken);
            }

            // In Production, do not pretend email was sent if credentials are missing
            Console.WriteLine("[EMAIL CONFIG ERROR] Cannot deliver email: neither Resend API key nor SMTP host is configured in Production environment.");
            return new EmailSendResult(false, null, "Hệ thống gửi email chưa được cấu hình cho môi trường Production (cần EMAIL__RESEND_API_KEY hoặc cấu hình SMTP).", EmailDeliveryStatus.Failed);
        }
    }
}
