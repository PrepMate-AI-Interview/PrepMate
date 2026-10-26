# PrepMate Feature — Authentication & Identity Management

## 1. Overview
Authentication in PrepMate is server-authoritative, using stateless JWT Bearer tokens for API access and PBKDF2 password hashing for persistent credentials.

---

## 2. API Endpoints

### 2.1 User Registration
- **Route:** `POST /api/auth/register`
- **Request Body:**
  ```json
  {
    "fullname": "Tran Thi B",
    "email": "user@example.com",
    "username": "candidate_b",
    "password": "SecurePassword@123"
  }
  ```
- **Validation Rules:**
  - `fullname`: Required, max 100 characters, no null bytes (`\0`).
  - `email`: Required, RFC 5322 regex validation, max 100 characters.
  - `username`: Required, 6–20 characters, no whitespace, unique in system.
  - `password`: Required, 6–100 characters.
- **Response (`200 OK`):**
  ```json
  {
    "id": "user_1791211245000",
    "fullname": "Tran Thi B",
    "email": "user@example.com",
    "username": "candidate_b",
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "role": "user",
    "subscription": "free",
    "subscriptionExpiry": null
  }
  ```

### 2.2 User Login
- **Route:** `POST /api/auth/login`
- **Request Body:**
  ```json
  {
    "email": "candidate_b",
    "password": "SecurePassword@123"
  }
  ```
  *Note: The `email` field accepts either an email address or a username.*
- **Response (`200 OK`):** Returns updated JWT Bearer token and user profile object.
- **Failure (`401 Unauthorized`):** Returns standard error message without disclosing whether the identifier or password was incorrect.

### 2.3 Identity Introspection (`/me`)
- **Route:** `GET /api/auth/me`
- **Header:** `Authorization: Bearer <token>`
- **Response (`200 OK`):** Returns authoritative server-derived profile data (subscription, role, skills, experience level).

---

## 3. Client-Side Persistence
- Stored exclusively in `localStorage.getItem("prepmate_current_user")`.
- State normalization function (`normalizeUser`) ensures defensive fallbacks for missing properties.
- Expiration or invalid token responses automatically trigger notification and session cleanup.
