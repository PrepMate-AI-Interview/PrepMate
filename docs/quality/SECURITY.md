# PrepMate Quality — Security Architecture & Hardening

## 1. Overview
PrepMate employs defense-in-depth security principles covering password cryptography, stateless token authorization, privilege boundary defense (BOLA/IDOR), input boundary validation, and exception sanitization.

---

## 2. Cryptographic Controls

### 2.1 Password Hashing (PBKDF2)
- Implemented in `backend.Services.Security.PasswordHasher`.
- Uses `Rfc2898DeriveBytes.Pbkdf2` with `HMACSHA256`, 100,000 iterations, and a cryptographically secure 128-bit random salt.
- Stored as `{Base64Salt}.{Base64Hash}`.
- Plaintext passwords are zeroed out before in-memory storage or disk persistence.

### 2.2 JWT Bearer Tokens
- Implemented in `backend.Services.Security.JwtTokenService`.
- Signed via HMAC-SHA256 with 256-bit symmetric key.
- Validated via standard ASP.NET Core `AddJwtBearer` middleware (validates lifetime, issuer, audience, and signing key).

---

## 3. Authorization & Privilege Boundaries

### 3.1 Broken Object Level Authorization (BOLA / IDOR) Defense
- **Session Protection:** `AIController.ValidateSessionAccess` ensures that non-guest sessions can only be viewed or modified by the session owner or an administrator. Cross-tenant mutation attempts return `403 Forbidden`.
- **CV Access:** `CVController.GetUserCV` strictly prevents Candidate B from retrieving Candidate A's CV (`403 Forbidden`).
- **Payment Operations:** `PaymentController.ProcessPayment` verifies that the paying user ID matches the token identity.

### 3.2 Role-Based Privilege Boundaries (RBAC)
- Admin endpoints (`/api/admin/users/{id}/upgrade`, `/api/admin/users/{id}/role`, `/api/admin/ai/config`) are guarded by `[Authorize(Roles = "admin")]`.
- Manager role allows viewing user lists (`[Authorize(Roles = "admin,manager")]`), but rejects role modification or plan changes (`403 Forbidden`).

---

## 4. Input Boundary Validation & Sanitization

- **Null Byte Rejection:** Registration rejects usernames, emails, or names containing `\0`.
- **Length Caps:** Strict upper bounds enforced on all strings (e.g. 100 chars for names/emails, 20 chars for usernames, 20,000 chars for interview answers, 100,000 chars for CV text).
- **Format Validation:** Email strings undergo RFC-compliant validation; usernames reject whitespace.

---

## 5. Information Disclosure Prevention

- **Global Exception Middleware:** Configured in `Program.cs` to intercept unhandled exceptions and return a sanitized JSON error:
  ```json
  {"error":"Đã xảy ra sự cố nội bộ trong quá trình xử lý."}
  ```
  Internal stack traces, file paths, and database query details are never leaked to clients.

---

## 6. Production Security Notices (Hardening Gates)

From the runtime security audit:
1. **Security Headers:** Must enable middleware injecting `X-Content-Type-Options: nosniff` and `X-Frame-Options: SAMEORIGIN`.
2. **Rate Limiting:** Must uncomment and activate `RateLimitMiddleware` to throttle auth and AI endpoints.
3. **CORS Restrictions:** Must restrict `AllowAnyOrigin()` to explicit production hostnames.
