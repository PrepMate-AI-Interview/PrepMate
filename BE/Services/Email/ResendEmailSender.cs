using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace backend.Services.Email
{
    public class ResendEmailSender : IEmailSender
    {
        private readonly HttpClient _httpClient;
        private readonly EmailOptions _options;

        public ResendEmailSender(EmailOptions options, HttpClient? httpClient = null)
        {
            _options = options;
            _httpClient = httpClient ?? new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        }

        public async Task<EmailSendResult> SendEmailAsync(EmailMessage message, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(_options.ResendApiKey))
            {
                return new EmailSendResult(
                    false,
                    null,
                    "Resend API key is not configured.",
                    EmailDeliveryStatus.Failed
                );
            }

            var senderEmail = !string.IsNullOrWhiteSpace(message.SenderEmail) ? message.SenderEmail : _options.SenderEmail;
            var senderName = !string.IsNullOrWhiteSpace(message.SenderName) ? message.SenderName : _options.SenderName;
            var formattedFrom = !string.IsNullOrWhiteSpace(senderName)
                ? $"{senderName} <{senderEmail}>"
                : senderEmail;

            var payload = new
            {
                from = formattedFrom,
                to = new[] { message.To },
                subject = message.Subject,
                html = message.HtmlBody,
                text = !string.IsNullOrWhiteSpace(message.PlainTextBody) ? message.PlainTextBody : null
            };

            var jsonContent = JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            });

            using var request = new HttpRequestMessage(HttpMethod.Post, _options.ResendApiUrl)
            {
                Content = new StringContent(jsonContent, Encoding.UTF8, "application/json")
            };

            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ResendApiKey.Trim());
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            try
            {
                var response = await _httpClient.SendAsync(request, cancellationToken);
                var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    string? messageId = null;
                    try
                    {
                        using var doc = JsonDocument.Parse(responseBody);
                        if (doc.RootElement.TryGetProperty("id", out var idProp))
                        {
                            messageId = idProp.GetString();
                        }
                    }
                    catch
                    {
                        // Fallback if response JSON parsing fails
                    }

                    Console.WriteLine($"[ResendEmailSender] Provider accepted email delivery. MessageId: {messageId ?? "unknown"}");
                    return new EmailSendResult(
                        true,
                        messageId,
                        null,
                        EmailDeliveryStatus.AcceptedByProvider
                    );
                }

                // Error response handling without leaking API key
                string errorMessage;
                try
                {
                    using var errDoc = JsonDocument.Parse(responseBody);
                    var msg = errDoc.RootElement.TryGetProperty("message", out var m) ? m.GetString() : null;
                    var name = errDoc.RootElement.TryGetProperty("name", out var n) ? n.GetString() : null;
                    errorMessage = $"Resend API error ({(int)response.StatusCode} {name}): {msg}";
                }
                catch
                {
                    errorMessage = $"Resend API returned HTTP {(int)response.StatusCode}.";
                }

                Console.WriteLine($"[ResendEmailSender] Email delivery failed: HTTP {(int)response.StatusCode}");
                return new EmailSendResult(
                    false,
                    null,
                    errorMessage,
                    EmailDeliveryStatus.Failed
                );
            }
            catch (TaskCanceledException)
            {
                Console.WriteLine("[ResendEmailSender] Request timed out while connecting to Resend API.");
                return new EmailSendResult(false, null, "Resend API connection timed out.", EmailDeliveryStatus.Failed);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ResendEmailSender] Exception communicating with Resend API: {ex.GetType().Name}");
                return new EmailSendResult(false, null, $"Resend API connection error: {ex.Message}", EmailDeliveryStatus.Failed);
            }
        }
    }
}
