namespace backend.Services.Security
{
    public interface ICredentialProtectionService
    {
        string Protect(string rawSecret);
        string Unprotect(string cipherText);
        bool IsProtected(string value);
        string GetStorageStatus(string? value);
    }
}
