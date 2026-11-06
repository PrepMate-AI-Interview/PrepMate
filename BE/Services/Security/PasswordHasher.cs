using System;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;

namespace backend.Services.Security
{
    public static class PasswordHasher
    {
        public const int SaltSize = 16; // 128 bits
        public const int KeySize = 32;  // 256 bits
        public const int CurrentIterations = 600_000; // OWASP recommended baseline for PBKDF2-HMAC-SHA256
        public const int LegacyIterations = 100_000;
        public const int MinIterations = 50_000;
        public const int MaxIterations = 1_000_000; // Safety threshold against CPU exhaustion DOS from malformed hashes

        private const string FormatPrefix = "pbkdf2:sha256:";

        /// <summary>
        /// Hashes a password using PBKDF2 with HMAC-SHA256 and a random 128-bit salt.
        /// Modern format: pbkdf2:sha256:{iterations}:{salt_base64}:{hash_base64}
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
                iterationCount: CurrentIterations,
                numBytesRequested: KeySize);

            return $"{FormatPrefix}{CurrentIterations}:{Convert.ToBase64String(salt)}:{Convert.ToBase64String(subkey)}";
        }

        /// <summary>
        /// Verifies a password against a stored PBKDF2 hash using constant-time comparison.
        /// Supports both modern versioned format (pbkdf2:sha256:{iterations}:{salt}:{hash})
        /// and legacy format ({salt}.{hash} with 100,000 iterations).
        /// </summary>
        public static bool VerifyPassword(string password, string? storedHash)
        {
            if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(storedHash))
            {
                return false;
            }

            try
            {
                // 1. Modern versioned format: pbkdf2:sha256:{iterations}:{salt}:{hash}
                if (storedHash.StartsWith(FormatPrefix, StringComparison.OrdinalIgnoreCase))
                {
                    var remainder = storedHash.Substring(FormatPrefix.Length);
                    var parts = remainder.Split(':');
                    if (parts.Length != 3)
                    {
                        return false;
                    }

                    if (!int.TryParse(parts[0], out var iterations) || iterations < MinIterations || iterations > MaxIterations)
                    {
                        return false;
                    }

                    byte[] salt = Convert.FromBase64String(parts[1]);
                    byte[] expectedSubkey = Convert.FromBase64String(parts[2]);

                    if (salt.Length != SaltSize || expectedSubkey.Length != KeySize)
                    {
                        return false;
                    }

                    byte[] actualSubkey = KeyDerivation.Pbkdf2(
                        password: password,
                        salt: salt,
                        prf: KeyDerivationPrf.HMACSHA256,
                        iterationCount: iterations,
                        numBytesRequested: KeySize);

                    return CryptographicOperations.FixedTimeEquals(actualSubkey, expectedSubkey);
                }

                // 2. Legacy format: {salt_base64}.{hash_base64} (100,000 iterations)
                var legacyParts = storedHash.Split('.');
                if (legacyParts.Length == 2)
                {
                    byte[] salt = Convert.FromBase64String(legacyParts[0]);
                    byte[] expectedSubkey = Convert.FromBase64String(legacyParts[1]);

                    if (salt.Length != SaltSize || expectedSubkey.Length != KeySize)
                    {
                        return false;
                    }

                    byte[] actualSubkey = KeyDerivation.Pbkdf2(
                        password: password,
                        salt: salt,
                        prf: KeyDerivationPrf.HMACSHA256,
                        iterationCount: LegacyIterations,
                        numBytesRequested: KeySize);

                    return CryptographicOperations.FixedTimeEquals(actualSubkey, expectedSubkey);
                }

                return false;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Checks whether a stored hash needs to be re-hashed (e.g. legacy 100k format or lower iterations).
        /// </summary>
        public static bool NeedsRehash(string? storedHash)
        {
            if (string.IsNullOrEmpty(storedHash)) return true;

            if (!storedHash.StartsWith(FormatPrefix, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            var remainder = storedHash.Substring(FormatPrefix.Length);
            var parts = remainder.Split(':');
            if (parts.Length != 3 || !int.TryParse(parts[0], out var iter) || iter < CurrentIterations || iter > MaxIterations)
            {
                return true;
            }

            return false;
        }

        /// <summary>
        /// Checks whether the stored value is formatted as a valid PBKDF2 hash.
        /// </summary>
        public static bool IsHashed(string? stored)
        {
            if (string.IsNullOrEmpty(stored)) return false;

            if (stored.StartsWith(FormatPrefix, StringComparison.OrdinalIgnoreCase))
            {
                var remainder = stored.Substring(FormatPrefix.Length);
                var parts = remainder.Split(':');
                return parts.Length == 3 && int.TryParse(parts[0], out var iter) && iter >= MinIterations && iter <= MaxIterations;
            }

            var legacyParts = stored.Split('.');
            return legacyParts.Length == 2 && legacyParts[0].Length > 10 && legacyParts[1].Length > 10;
        }
    }
}
