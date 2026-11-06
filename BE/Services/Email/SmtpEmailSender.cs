using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using MimeKit;

namespace backend.Services.Email
{
    public class SmtpEmailSender : IEmailSender
    {
        private readonly EmailOptions _options;
        private readonly IWebHostEnvironment? _environment;

        public SmtpEmailSender(EmailOptions options, IWebHostEnvironment? environment = null)
        {
            _options = options;
            _environment = environment;
        }

        public async Task<EmailSendResult> SendEmailAsync(EmailMessage message, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(_options.SmtpHost))
            {
                return new EmailSendResult(false, null, "SMTP host is not configured.", EmailDeliveryStatus.Failed);
            }

            var isProduction = _environment?.IsProduction() ?? false;

            // WI-05 SMTP Production TLS Enforcement:
            // In Production, unencrypted SMTP (SecureSocketOptions.None) is strictly disallowed (fail-fast).
            if (isProduction && !_options.EnableSsl)
            {
                Console.WriteLine("[SMTP SECURITY ERROR] Production email requires TLS encryption. Plaintext SMTP is forbidden.");
                return new EmailSendResult(
                    false,
                    null,
                    "Production security policy violation: SMTP delivery requires TLS encryption (EnableSsl = true). SecureSocketOptions.None is disallowed in Production.",
                    EmailDeliveryStatus.Failed);
            }

            try
            {
                using var client = new SmtpClient
                {
                    Timeout = 15000 // 15 seconds timeout
                };

                // Enforce strict TLS certificate chain and validity verification via standard system store
                client.ServerCertificateValidationCallback = null;

                // Determine secure socket options based on configuration and port
                var secureOptions = SecureSocketOptions.Auto;
                if (!_options.EnableSsl)
                {
                    secureOptions = SecureSocketOptions.None;
                }
                else if (_options.SmtpPort == 465)
                {
                    secureOptions = SecureSocketOptions.SslOnConnect; // Implicit TLS
                }
                else if (_options.SmtpPort == 587 || _options.SmtpPort == 25)
                {
                    secureOptions = SecureSocketOptions.StartTls; // Explicit STARTTLS
                }

                await client.ConnectAsync(_options.SmtpHost, _options.SmtpPort, secureOptions, cancellationToken);

                if (!string.IsNullOrWhiteSpace(_options.SmtpUsername) && !string.IsNullOrWhiteSpace(_options.SmtpPassword))
                {
                    await client.AuthenticateAsync(_options.SmtpUsername, _options.SmtpPassword, cancellationToken);
                }

                var senderEmail = !string.IsNullOrWhiteSpace(message.SenderEmail) ? message.SenderEmail : _options.SenderEmail;
                var senderName = !string.IsNullOrWhiteSpace(message.SenderName) ? message.SenderName : _options.SenderName;

                var mimeMessage = new MimeMessage();
                mimeMessage.From.Add(new MailboxAddress(senderName, senderEmail));
                mimeMessage.To.Add(new MailboxAddress(message.To, message.To));
                mimeMessage.Subject = message.Subject;

                var builder = new BodyBuilder();
                if (!string.IsNullOrWhiteSpace(message.PlainTextBody))
                {
                    builder.TextBody = message.PlainTextBody;
                }
                builder.HtmlBody = message.HtmlBody;

                mimeMessage.Body = builder.ToMessageBody();

                var messageId = Guid.NewGuid().ToString("N");
                mimeMessage.Headers.Add("X-Message-ID", messageId);
                mimeMessage.Headers.Add("X-Mailer", "PrepMate-MailKit/4.18");

                await client.SendAsync(mimeMessage, cancellationToken);
                await client.DisconnectAsync(true, cancellationToken);

                Console.WriteLine($"[SMTP-MailKit] Successfully delivered email via {_options.SmtpHost}:{_options.SmtpPort} to {message.To}");
                return new EmailSendResult(true, messageId, null, EmailDeliveryStatus.AcceptedByProvider);
            }
            catch (SmtpCommandException scEx)
            {
                Console.WriteLine($"[SMTP ERROR] MailKit command failed: {scEx.StatusCode} - {scEx.Message}");
                return new EmailSendResult(false, null, $"SMTP delivery rejected: {scEx.Message}", EmailDeliveryStatus.Failed);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SMTP ERROR] MailKit send failed: {ex.Message}");
                return new EmailSendResult(false, null, $"SMTP delivery failed: {ex.Message}", EmailDeliveryStatus.Failed);
            }
        }
    }
}
