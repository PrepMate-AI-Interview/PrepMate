using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;

namespace backend.Services.Email
{
    public class StoredEmail
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public string To { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string HtmlBody { get; set; } = string.Empty;
        public string? PlainTextBody { get; set; }
        public string Sender { get; set; } = string.Empty;
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public EmailDeliveryStatus Status { get; set; } = EmailDeliveryStatus.DeliveredToSandbox;
    }

    public interface IEmailInboxStore
    {
        void Store(StoredEmail email);
        IReadOnlyList<StoredEmail> GetAll();
        StoredEmail? GetLatestFor(string recipient);
        void Clear();
    }

    public class InMemoryEmailInboxStore : IEmailInboxStore
    {
        private readonly ConcurrentQueue<StoredEmail> _emails = new();
        private const int MaxItems = 100;

        public void Store(StoredEmail email)
        {
            _emails.Enqueue(email);
            while (_emails.Count > MaxItems && _emails.TryDequeue(out _)) { }
        }

        public IReadOnlyList<StoredEmail> GetAll()
        {
            return _emails.Reverse().ToList();
        }

        public StoredEmail? GetLatestFor(string recipient)
        {
            if (string.IsNullOrWhiteSpace(recipient)) return null;
            return _emails.Reverse().FirstOrDefault(e =>
                string.Equals(e.To, recipient.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        public void Clear()
        {
            while (_emails.TryDequeue(out _)) { }
        }
    }
}
