using System;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;

namespace backend.Services.Security
{
    public static class PasswordHasher
    {
        private const int SaltSize = 16; // 128 bits
        private const int KeySize = 32;  // 256 bits
        private const int Iterations = 100_000;

        /// <summary>
        /// Hashes a password using PBKDF2 with HMAC-SHA256 and a random 128-bit salt.
        /// Stored format: {salt_base64}.{hash_base64}
        /// </summary>
        public static string HashPassword(string password)
        {
            if (string.IsNullOrEmpty(password))
            {
                throw new ArgumentException("Mật khẩu không được để trống.", nameof(password));
            }

            byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
            byte[] subkey = KeyDerivation.Pbkdf2(
                password: password,
                salt: salt,
                prf: KeyDerivationPrf.HMACSHA256,
                iterationCount: Iterations,
                numBytesRequested: KeySize);

            return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(subkey)}";
        }

        /// <summary>
        /// Verifies a password against a stored PBKDF2 hash using constant-time comparison.
        /// </summary>
        public static bool VerifyPassword(string password, string? storedHash)
        {
            if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(storedHash))
            {
                return false;
            }

            var parts = storedHash.Split('.');
            if (parts.Length != 2)
            {
                return false;
            }

            try
            {
                byte[] salt = Convert.FromBase64String(parts[0]);
                byte[] expectedSubkey = Convert.FromBase64String(parts[1]);

                if (salt.Length != SaltSize || expectedSubkey.Length != KeySize)
                {
                    return false;
                }

                byte[] actualSubkey = KeyDerivation.Pbkdf2(
                    password: password,
                    salt: salt,
                    prf: KeyDerivationPrf.HMACSHA256,
                    iterationCount: Iterations,
                    numBytesRequested: KeySize);

                return CryptographicOperations.FixedTimeEquals(actualSubkey, expectedSubkey);
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Checks whether the stored value is formatted as a valid PBKDF2 hash.
        /// </summary>
        public static bool IsHashed(string? stored)
        {
            if (string.IsNullOrEmpty(stored)) return false;
            var parts = stored.Split('.');
            return parts.Length == 2 && parts[0].Length > 10 && parts[1].Length > 10;
        }
    }
}
