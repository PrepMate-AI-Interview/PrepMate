using System;

namespace backend.Models
{
    public class PaymentTransaction
    {
        public string Method { get; set; } = string.Empty;
        public int Amount { get; set; }
        public string Currency { get; set; } = "VND";
        public string Timestamp { get; set; } = string.Empty;
        public string User { get; set; } = string.Empty; // User ID
        public string? CardLast4 { get; set; }
        public string? CardName { get; set; }
        public string? MomoPhone { get; set; }
        public string? TransactionId { get; set; }
        public string? ZalopayPhone { get; set; }
        public string? BankReference { get; set; }
        public string? StripeEmail { get; set; }
        public string? Plan { get; set; }
        public string? PlanName { get; set; }
    }
}
