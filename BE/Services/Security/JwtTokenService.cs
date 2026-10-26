using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using backend.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

namespace backend.Services.Security
{
    public interface IJwtTokenService
    {
        string GenerateToken(User user);
        ClaimsPrincipal? ValidateToken(string token);
    }

    public class JwtTokenService : IJwtTokenService
    {
        private readonly byte[] _key;
        private readonly string _issuer;
        private readonly string _audience;
        private readonly TimeSpan _expiry = TimeSpan.FromDays(7);

        public const string DefaultDevSecret = "PrepMate_Secure_Production_Hardened_Key_2026_Minimum_256_Bits_Super_Secret!";

        public JwtTokenService(IConfiguration configuration, IWebHostEnvironment? environment = null)
        {
            var envName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");
            var isProduction = string.Equals(envName, "Production", StringComparison.OrdinalIgnoreCase);

            var secret = configuration["Jwt:Secret"]
                ?? Environment.GetEnvironmentVariable("JWT__SECRET");

            if (string.IsNullOrWhiteSpace(secret))
            {
                if (isProduction)
                {
                    throw new InvalidOperationException("Production configuration error: JWT signing key (Jwt:Secret or JWT__SECRET) is required and cannot be empty.");
                }
                secret = DefaultDevSecret;
            }
            else if (secret.Length < 32)
            {
                if (isProduction)
                {
                    throw new InvalidOperationException("Production configuration error: JWT signing key (Jwt:Secret or JWT__SECRET) must be at least 32 characters (256 bits).");
                }
                secret = secret.PadRight(32, '!');
            }

            _key = Encoding.UTF8.GetBytes(secret);
            _issuer = configuration["Jwt:Issuer"] ?? "PrepMateBackend";
            _audience = configuration["Jwt:Audience"] ?? "PrepMateFrontend";
        }

        public string GenerateToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(JwtRegisteredClaimNames.Sub, user.Id),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("subscription", user.Subscription),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.Add(_expiry),
                Issuer = _issuer,
                Audience = _audience,
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(_key),
                    SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        public ClaimsPrincipal? ValidateToken(string token)
        {
            if (string.IsNullOrWhiteSpace(token)) return null;

            var tokenHandler = new JwtSecurityTokenHandler();
            try
            {
                var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(_key),
                    ValidateIssuer = true,
                    ValidIssuer = _issuer,
                    ValidateAudience = true,
                    ValidAudience = _audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                    RoleClaimType = ClaimTypes.Role,
                    NameClaimType = ClaimTypes.NameIdentifier
                }, out _);

                return principal;
            }
            catch
            {
                return null;
            }
        }
    }
}
