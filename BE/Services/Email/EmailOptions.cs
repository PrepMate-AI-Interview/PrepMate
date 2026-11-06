using System;
using Microsoft.Extensions.Configuration;

namespace backend.Services.Email
{
    public class EmailOptions
    {
        public string SmtpHost { get; set; } = string.Empty;
        public int SmtpPort { get; set; } = 587;
        public string SmtpUsername { get; set; } = string.Empty;
        public string SmtpPassword { get; set; } = string.Empty;
        public bool EnableSsl { get; set; } = true;
        public string SenderEmail { get; set; } = "no-reply@prepmate.vn";
        public string SenderName { get; set; } = "PrepMate AI";
        public string FrontendBaseUrl { get; set; } = "http://localhost:5000";
        public string Provider { get; set; } = "Auto"; // "Auto" | "Smtp" | "Sandbox"

        public bool HasSmtpConfiguration => !string.IsNullOrWhiteSpace(SmtpHost);

        /// <summary>
        /// Reconciles email settings from IConfiguration and environment variables.
        /// Fully unifies EMAIL__* and SMTP__* naming conventions across hierarchical
        /// (double underscore) and flat (single underscore) formats.
        /// </summary>
        public static EmailOptions FromConfiguration(IConfiguration configuration)
        {
            var options = new EmailOptions();

            // 1. Host (unified resolution: EMAIL__ takes precedence, SMTP__ as fallback)
            var host = configuration["Email:Smtp:Host"]
                ?? configuration["Email:Host"]
                ?? Environment.GetEnvironmentVariable("EMAIL__SMTP_HOST")
                ?? Environment.GetEnvironmentVariable("EMAIL_SMTP_HOST")
                ?? Environment.GetEnvironmentVariable("SMTP__HOST")
                ?? Environment.GetEnvironmentVariable("SMTP_HOST");
            if (!string.IsNullOrWhiteSpace(host)) options.SmtpHost = host.Trim();

            // 2. Port (unified resolution)
            var portStr = configuration["Email:Smtp:Port"]
                ?? configuration["Email:Port"]
                ?? Environment.GetEnvironmentVariable("EMAIL__SMTP_PORT")
                ?? Environment.GetEnvironmentVariable("EMAIL_SMTP_PORT")
                ?? Environment.GetEnvironmentVariable("SMTP__PORT")
                ?? Environment.GetEnvironmentVariable("SMTP_PORT");
            if (int.TryParse(portStr, out var port) && port > 0) options.SmtpPort = port;

            // 3. Username (unified resolution: handles EMAIL__SMTP_USER, EMAIL__SMTP_USERNAME, SMTP__USERNAME)
            var user = configuration["Email:Smtp:Username"]
                ?? configuration["Email:Username"]
                ?? Environment.GetEnvironmentVariable("EMAIL__SMTP_USER")
                ?? Environment.GetEnvironmentVariable("EMAIL_SMTP_USER")
                ?? Environment.GetEnvironmentVariable("EMAIL__SMTP_USERNAME")
                ?? Environment.GetEnvironmentVariable("EMAIL_SMTP_USERNAME")
                ?? Environment.GetEnvironmentVariable("SMTP__USERNAME")
                ?? Environment.GetEnvironmentVariable("SMTP_USERNAME");
            if (!string.IsNullOrWhiteSpace(user)) options.SmtpUsername = user.Trim();

            // 4. Password (unified resolution: handles EMAIL__SMTP_PASS, EMAIL__SMTP_PASSWORD, SMTP__PASSWORD)
            var pass = configuration["Email:Smtp:Password"]
                ?? configuration["Email:Password"]
                ?? Environment.GetEnvironmentVariable("EMAIL__SMTP_PASS")
                ?? Environment.GetEnvironmentVariable("EMAIL_SMTP_PASS")
                ?? Environment.GetEnvironmentVariable("EMAIL__SMTP_PASSWORD")
                ?? Environment.GetEnvironmentVariable("EMAIL_SMTP_PASSWORD")
                ?? Environment.GetEnvironmentVariable("SMTP__PASSWORD")
                ?? Environment.GetEnvironmentVariable("SMTP_PASSWORD");
            if (!string.IsNullOrWhiteSpace(pass)) options.SmtpPassword = pass;

            // 5. SSL / TLS (unified resolution: handles EMAIL__ENABLE_SSL, EMAIL__SMTP_ENABLE_SSL, SMTP__ENABLE_SSL)
            var sslStr = configuration["Email:Smtp:EnableSsl"]
                ?? configuration["Email:EnableSsl"]
                ?? Environment.GetEnvironmentVariable("EMAIL__ENABLE_SSL")
                ?? Environment.GetEnvironmentVariable("EMAIL_ENABLE_SSL")
                ?? Environment.GetEnvironmentVariable("EMAIL__SMTP_ENABLE_SSL")
                ?? Environment.GetEnvironmentVariable("EMAIL_SMTP_ENABLE_SSL")
                ?? Environment.GetEnvironmentVariable("SMTP__ENABLE_SSL")
                ?? Environment.GetEnvironmentVariable("SMTP_ENABLE_SSL");
            if (bool.TryParse(sslStr, out var ssl)) options.EnableSsl = ssl;

            // 6. Sender Email (unified resolution: handles EMAIL__FROM_ADDRESS, EMAIL__SENDER_EMAIL, SMTP__SENDER_EMAIL)
            var senderEmail = configuration["Email:SenderEmail"]
                ?? configuration["Email:Smtp:SenderEmail"]
                ?? Environment.GetEnvironmentVariable("EMAIL__FROM_ADDRESS")
                ?? Environment.GetEnvironmentVariable("EMAIL_FROM_ADDRESS")
                ?? Environment.GetEnvironmentVariable("EMAIL__SENDER_EMAIL")
                ?? Environment.GetEnvironmentVariable("EMAIL_SENDER_EMAIL")
                ?? Environment.GetEnvironmentVariable("SMTP__SENDER_EMAIL")
                ?? Environment.GetEnvironmentVariable("SMTP_SENDER_EMAIL");
            if (!string.IsNullOrWhiteSpace(senderEmail)) options.SenderEmail = senderEmail.Trim();

            // 7. Sender Name (unified resolution: handles EMAIL__FROM_NAME, EMAIL__SENDER_NAME, SMTP__SENDER_NAME)
            var senderName = configuration["Email:SenderName"]
                ?? configuration["Email:Smtp:SenderName"]
                ?? Environment.GetEnvironmentVariable("EMAIL__FROM_NAME")
                ?? Environment.GetEnvironmentVariable("EMAIL_FROM_NAME")
                ?? Environment.GetEnvironmentVariable("EMAIL__SENDER_NAME")
                ?? Environment.GetEnvironmentVariable("EMAIL_SENDER_NAME")
                ?? Environment.GetEnvironmentVariable("SMTP__SENDER_NAME")
                ?? Environment.GetEnvironmentVariable("SMTP_SENDER_NAME");
            if (!string.IsNullOrWhiteSpace(senderName)) options.SenderName = senderName.Trim();

            // 8. Frontend Base URL (unified resolution)
            var feUrl = configuration["Email:FrontendBaseUrl"]
                ?? configuration["FrontendBaseUrl"]
                ?? Environment.GetEnvironmentVariable("FRONTEND_BASE_URL")
                ?? Environment.GetEnvironmentVariable("PUBLIC_FRONTEND_BASE_URL");
            if (!string.IsNullOrWhiteSpace(feUrl))
            {
                options.FrontendBaseUrl = feUrl.Trim().TrimEnd('/');
            }

            // 9. Provider mode (Auto, Smtp, Sandbox)
            var provider = configuration["Email:Provider"]
                ?? Environment.GetEnvironmentVariable("EMAIL__PROVIDER")
                ?? Environment.GetEnvironmentVariable("EMAIL_PROVIDER");
            if (!string.IsNullOrWhiteSpace(provider)) options.Provider = provider.Trim();

            return options;
        }
    }
}
