using System;
using System.Collections.Generic;

namespace backend.Services.Security
{
    public static class PasswordPolicy
    {
        public const int MinLength = 8;
        public const int MaxLength = 128;

        public const string PolicyDescription = "Mật khẩu cần từ 8–128 ký tự, gồm chữ không dấu, số hoặc ký tự đặc biệt; không chứa khoảng trắng.";

        private static readonly HashSet<string> BlockedPasswords = new(StringComparer.OrdinalIgnoreCase)
        {
            "12345678",
            "123456789",
            "1234567890",
            "password",
            "passwords",
            "password1",
            "password123",
            "password1234",
            "passwordpassword",
            "password12345678",
            "prepmate",
            "prepmate123",
            "prepmate123456",
            "prepmate12345678",
            "admin123",
            "admin1234",
            "admin123456",
            "adminadmin",
            "adminadminadmin1",
            "administrator123",
            "qwerty123",
            "qwertyui",
            "qwertyuiop",
            "qwertyuiopasdfg",
            "iloveyou",
            "iloveyou123",
            "iloveyouiloveyou",
            "welcome1",
            "welcome123",
            "welcome123456",
            "welcome12345678",
            "letmein1",
            "letmein123",
            "letmein123456789",
            "changeme",
            "changeme123",
            "changeme12345678",
            "11111111",
            "00000000",
            "1111111111111111",
            "0000000000000000",
            "aaaaaaaa",
            "bbbbbbbb",
            "abcdefgh",
            "correcthorsebatterystaple"
        };

        /// <summary>
        /// Validates password compliance for PrepMate (WI-AUTH-01R5):
        /// - Minimum 8 characters, maximum 128 characters
        /// - Strictly printable ASCII without spaces (code points 33 to 126: '!' to '~')
        /// - Rejects spaces, tabs, newlines, control characters, and non-ASCII Unicode (diacritics, emoji)
        /// - No arbitrary character-composition rules (uppercase/number/symbol not mandatory)
        /// - Protection against common, compromised and contextually weak passwords via blocklist
        /// </summary>
        public static bool Validate(string? password, out string? errorMessage)
        {
            if (string.IsNullOrEmpty(password))
            {
                errorMessage = "Mật khẩu không được để trống.";
                return false;
            }

            if (password.Length < MinLength || password.Length > MaxLength)
            {
                errorMessage = PolicyDescription;
                return false;
            }

            // Enforce printable ASCII only without spaces (code points 33 to 126 inclusive)
            // Code 32 is space, < 32 are control chars/tabs/newlines, > 126 are DEL/Unicode/diacritics/emoji
            foreach (char c in password)
            {
                if (c < 33 || c > 126)
                {
                    errorMessage = PolicyDescription;
                    return false;
                }
            }

            // Check common/compromised password blocklist (exact match without trim)
            if (BlockedPasswords.Contains(password))
            {
                errorMessage = "Mật khẩu quá phổ biến hoặc dễ đoán. Vui lòng chọn mật khẩu khác an toàn hơn.";
                return false;
            }

            errorMessage = null;
            return true;
        }
    }
}
