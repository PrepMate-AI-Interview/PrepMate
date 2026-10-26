using System;
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

namespace backend.Services.Security
{
    public class DataProtectionCredentialService : ICredentialProtectionService
    {
        public const string ProtectedPrefix = "dp:v1:";
        private readonly IDataProtector _protector;

        public DataProtectionCredentialService(IDataProtectionProvider provider)
        {
            if (provider == null)
            {
                throw new ArgumentNullException(nameof(provider));
            }
            _protector = provider.CreateProtector("PrepMate.AI.CredentialProtection.v1");
        }

        public string Protect(string rawSecret)
        {
            if (string.IsNullOrWhiteSpace(rawSecret))
            {
                return string.Empty;
            }
            var protectedData = _protector.Protect(rawSecret.Trim());
            return ProtectedPrefix + protectedData;
        }

        public string Unprotect(string cipherText)
        {
            if (string.IsNullOrWhiteSpace(cipherText))
            {
                return string.Empty;
            }
            var trimmed = cipherText.Trim();
            if (IsProtected(trimmed))
            {
                var payload = trimmed.Substring(ProtectedPrefix.Length);
                try
                {
                    return _protector.Unprotect(payload);
                }
                catch (CryptographicException ex)
                {
                    throw new InvalidOperationException(
                        "Không thể giải mã khóa bí mật AI với key ring bảo vệ dữ liệu hiện tại. Vui lòng kiểm tra cấu hình ASP.NET Core Data Protection hoặc nhập lại khóa mới.",
                        ex
                    );
                }
            }

            // Legacy plaintext fallback: returns as-is without re-encrypting automatically
            return trimmed;
        }

        public bool IsProtected(string value)
        {
            return !string.IsNullOrWhiteSpace(value) && value.Trim().StartsWith(ProtectedPrefix, StringComparison.Ordinal);
        }

        public string GetStorageStatus(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return "empty";
            }
            return IsProtected(value) ? "encrypted" : "legacy_plaintext";
        }
    }
}
