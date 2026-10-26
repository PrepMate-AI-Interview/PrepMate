# PREPMATE — FULL RUNTIME & END-TO-END (E2E) SYSTEM AUDIT REPORT

**Audit Date:** 2026-10-07  
**Audit Mode:** AUDIT ONLY — STRICTLY ZERO SOURCE CODE MODIFICATIONS  
**Target Environment:** ASP.NET Core 10 Kestrel Server (`http://127.0.0.1:5000`)  
**Frontend Deployment:** Native Kestrel Static File Serving (`FE/` mapped to `WebRootPath`)  
**Auditor:** Antigravity Autonomous Security & Quality Assurance Team  
**Audit Status:** AUDIT COMPLETE  

---

## 1. EXECUTIVE SUMMARY & VERDICT

### Overall Runtime Verdict: PASS WITH PRODUCTION HARDENING NOTICES (CONDITIONALLY READY)

Following the completion of UX/UI remediation (P1.4-C, P1.5-R1 through R4) and structural codebase refactoring (P1.5-FR), a comprehensive runtime and end-to-end system audit of PrepMate was executed against the live application running on local port 5000.

The audit verified **429/429 static regression assertions**, **8/8 live conversational integration test cases**, and **41/41 live HTTP E2E operational assertions** with 0 functional failures. The entire core user loop—from guest onboarding and account creation to live adaptive AI interviewing, speech recognition/synthesis lifecycles, real-time timer progression, multi-criteria performance report scoring, CV parsing, job recommendations, and plan upgrades—is demonstrably functional.

No **P0 (Critical / Showstopper)** issues were found. However, **3 P1 (High Severity)** architectural hardening issues, **3 P2 (Medium Severity)** issues, and **3 P3 (Low Severity)** notices were identified in the server pipeline and error-resilience paths that must be addressed prior to public internet exposure.

| Severity Level | Count | Description / Summary |
| :--- | :---: | :--- |
| **P0 (Critical / Blocker)** | **0** | No crashes, data corruption, or broken core loops found. |
| **P1 (High)** | **3** | Missing HTTP security headers, commented-out rate limiter, AI 500/503 upstream resilience gap. |
| **P2 (Medium)** | **3** | Permissive CORS `AllowAnyOrigin`, synchronous full-disk `FileDb.Save()` lock overhead, login field alias constraint. |
| **P3 (Low)** | **3** | Dev JWT secret fallback notice, CDN dependency for PDF.js/fonts, roadmap CV payload redundancy. |

---

## 2. AUDIT ENVIRONMENT & METHODOLOGY

### 2.1 Host & Runtime Environment
- **Operating System:** Windows 11 Enterprise (x64)
- **Runtime Host:** .NET 10.0.100 (ASP.NET Core Kestrel)
- **Process ID / Task:** `task-15550` (listening on `http://127.0.0.1:5000`)
- **Node.js Environment:** v24.21.0
- **Database Engine:** `backend.Services.Storage.FileDb` persisting to `BE/bin/Debug/net10.0/db.json`
- **External AI Integration:** Vilao AI Gateway (`https://api.vilao.ai/v1/chat/completions` -> `ag/gemini-3.8-flash`)

### 2.2 Audit Methodology & Zero-Code Modification Mandate
- **Audit Mandate:** Absolute read-only compliance. Zero edits to `.cs`, `.html`, `.css`, `.js`, or production configuration.
- **Probe Vectors:**
  1. Live HTTP requests over loopback socket to all registered controller endpoints.
  2. Multi-turn AI conversational simulation mimicking realistic interview candidate behaviors.
  3. BOLA / IDOR privilege escalation and cross-tenant access attacks.
  4. Malicious boundary injection (null bytes, oversized payloads, invalid types, empty bodies).
  5. Concurrency stress testing (10 simultaneous parallel mutations against thread locks).
  6. Asset resolution crawler examining all 20 HTML files, script tags, stylesheets, and meta viewports.

---

## 3. SERVER BOOT, STATIC FILE SERVING & NETWORK BASELINE

### 3.1 Server Boot & Health Endpoint
- **Endpoint:** `GET http://127.0.0.1:5000/api/health`
- **Response Code:** `200 OK`
- **Response Headers:**
  - `Content-Type: application/json; charset=utf-8`
  - `Content-Encoding: gzip`
  - `Server: Kestrel`
- **Payload Verification:**
  ```json
  {
    "status": "ok",
    "message": "PrepMate server đang chạy!",
    "timestamp": "2026-10-07T11:31:19.2279087Z"
  }
  ```

### 3.2 Static Asset Delivery & MIME Types
Kestrel is configured to serve static assets directly from `Path.Combine(Directory.GetCurrentDirectory(), "..", "FE")`:
- `GET /index.html` -> `200 OK` (`text/html; charset=utf-8`)
- `GET /shared/css/style.css` -> `200 OK` (`text/css`)
- `GET /shared/js/main.js` -> `200 OK` (`application/javascript`)
- Root redirect `GET /` automatically delivers `/index.html` via `app.UseDefaultFiles()`.
- Legacy alias `GET /auth.html` cleanly redirects with HTTP 302 to `/features/auth/auth.html`.

---

## 4. GUEST USER FLOW AUDIT

### 4.1 Anonymous Session Creation
- **Endpoint:** `POST /api/sessions`
- **Payload:** `{"jobTitle": "Frontend Engineer", "targetCompany": "Tech Corp", "difficulty": "mid", "maximumQuestions": 3}`
- **Result:** `200 OK`
- **Evidence:** Session created successfully with server-assigned `UserId: "guest"`, generating unique ID `session_1791211xxx`.

### 4.2 Guest Readiness Evaluation
- **Endpoint:** `POST /api/sessions/readiness`
- **Result:** `200 OK`
- **Readiness Response:** Correctly returns readiness verification object with system checks for audio/camera and question budget calibration.

### 4.3 Guest Multi-Turn Interview & Completion
1. **Introduction:** `POST /api/ai/introduction` with candidate introduction -> `200 OK` (`"Xin chào! Cảm ơn bạn..."`).
2. **Answer Response:** `POST /api/ai/respond` -> `200 OK`. Adaptive AI evaluates input and returns relevant deepening questions.
3. **End Session & Report:** `POST /api/ai/end-interview` -> `200 OK`. Full diagnostic scorecard returned.
4. **Detail Fetch:** `GET /api/sessions/{guestSessionId}` -> `200 OK`. State shows `"completed"`.

---

## 5. AUTHENTICATION — REGISTRATION AUDIT (VALID & INVALID BOUNDARY)

| Boundary Test Case | Input Payload | Expected HTTP | Actual HTTP | Result |
| :--- | :--- | :---: | :---: | :---: |
| Empty Request | `{}` | 400 Bad Request | 400 Bad Request | **PASS** |
| Short Password (<6 chars) | `{"password": "123"}` | 400 Bad Request | 400 Bad Request | **PASS** |
| Null Byte Injection | `{"username": "null\x00user"}` | 400 Bad Request | 400 Bad Request | **PASS** |
| Malformed Email Format | `{"email": "invalid-email"}` | 400 Bad Request | 400 Bad Request | **PASS** |
| Oversized Username (>20 chars) | `{"username": "a".repeat(25)}` | 400 Bad Request | 400 Bad Request | **PASS** |
| Valid Registration | Fullname, Email, Username, Password | 200 OK | 200 OK | **PASS** |
| Duplicate Username/Email | Same registration resent | 400 Bad Request | 400 Bad Request | **PASS** |

**Password Storage Proof:** User record in `FileDb` stores zero plaintext passwords (`Password: ""`), strictly persisting 64-character PBKDF2 salted hashes (`PasswordHash: "zONWg...=="`).

---

## 6. AUTHENTICATION — LOGIN & TOKEN LIFECYCLE AUDIT

### 6.1 Credential Verification
- **Login by Username:** `POST /api/auth/login` with `{"email": "u_cand_a_123", "password": "Password@123"}` -> `200 OK`.
- **Login by Email:** `POST /api/auth/login` with `{"email": "cand_a_123@example.com", "password": "Password@123"}` -> `200 OK`.
- **Invalid Password:** `POST /api/auth/login` with invalid password -> `401 Unauthorized` (`{"error":"Email/username hoặc mật khẩu không chính xác."}`).
- **Non-existent User:** `POST /api/auth/login` with non-existent user -> `401 Unauthorized`.

### 6.2 JWT Token Mechanics & Claims
- **Issuer / Audience:** `PrepMateBackend` / `PrepMateFrontend`
- **Signing Algorithm:** HMAC-SHA256 with 256-bit symmetric key.
- **Claims Verified:**
  - `ClaimTypes.NameIdentifier`: Unique user ID (`user_1791211xxx`).
  - `ClaimTypes.Role`: User role (`user`, `manager`, `admin`).
- **Token Protection on `/api/auth/me`:**
  - Valid Token: `200 OK` with full user profile.
  - Missing Token: `401 Unauthorized`.
  - Tampered/Invalid Signature: `401 Unauthorized`.

---

## 7. RBAC & AUTHORIZATION MATRIX AUDIT

A rigorous privilege-boundary matrix was tested across all four authorization levels: Anonymous, User, Manager, and Admin.

| Endpoint | Anonymous | User (`role: user`) | Manager (`role: manager`) | Admin (`role: admin`) |
| :--- | :---: | :---: | :---: | :---: |
| `GET /api/admin/users` | 401 Unauthorized | 403 Forbidden | **200 OK** | **200 OK** |
| `POST /api/admin/users/{id}/upgrade` | 401 Unauthorized | 403 Forbidden | **403 Forbidden** | **200 OK** |
| `POST /api/admin/users/{id}/downgrade` | 401 Unauthorized | 403 Forbidden | **403 Forbidden** | **200 OK** |
| `POST /api/admin/users/{id}/role` | 401 Unauthorized | 403 Forbidden | **403 Forbidden** | **200 OK** |
| `DELETE /api/admin/users/{id}` | 401 Unauthorized | 403 Forbidden | **403 Forbidden** | **200 OK** |
| `GET /api/admin/transactions` | 401 Unauthorized | 403 Forbidden | **200 OK** | **200 OK** |
| `GET /api/admin/ai/config` | 401 Unauthorized | 403 Forbidden | **403 Forbidden** | **200 OK** |
| `PUT /api/admin/ai/config` | 401 Unauthorized | 403 Forbidden | **403 Forbidden** | **200 OK** |
| `GET /api/profile` | 401 Unauthorized | **200 OK** | **200 OK** | **200 OK** |
| `POST /api/cv` | 401 Unauthorized | **200 OK** | **200 OK** | **200 OK** |

### 7.1 Broken Object Level Authorization (BOLA / IDOR) Defense
- **Cross-User CV Snooping:** User B attempted to fetch User A's CV via `GET /api/cv/user/{userA_Id}`.
  - **Result:** `403 Forbidden` (`{"error":"Bạn không có quyền truy cập CV của người dùng này."}`).
- **Session Hijacking:** User B attempted to submit an answer to User A's active interview session via `POST /api/ai/respond`.
  - **Result:** `403 Forbidden` (`{"error":"Bạn không có quyền thao tác trên phiên phỏng vấn của người dùng khác."}`).
- **Admin Privilege Verification:** Admin accessing User A's CV via `GET /api/cv/user/{userA_Id}` succeeded with `200 OK`.

---

## 8. FRONTEND ROUTE NAVIGATION & ASSET INTEGRITY AUDIT

All 20 frontend HTML pages were scanned using an automated DOM link crawler checking every `<script src>`, `<link rel="stylesheet">`, and `<img>` tag:

| # | Route / Page | HTTP Status | Local Assets | External Assets | Viewport Meta |
| :---: | :--- | :---: | :---: | :---: | :---: |
| 1 | `/index.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 2 | `/404.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 3 | `/features/about/about.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 4 | `/features/admin/admin.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 5 | `/features/auth/auth.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 6 | `/features/dashboard/dashboard.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 7 | `/features/design-system/showcase.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 8 | `/features/help/help.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 9 | `/features/interview/history.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 10 | `/features/interview/interview-info.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 11 | `/features/interview/interview-practice.html`| 200 OK | 100% Resolved | 0 Broken | Present |
| 12 | `/features/jobs/jobs.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 13 | `/features/payment/payment.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 14 | `/features/payment/pricing.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 15 | `/features/profile/cv.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 16 | `/features/profile/profile.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 17 | `/features/profile/settings.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 18 | `/features/progress/progress.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 19 | `/features/qbank/qbank.html` | 200 OK | 100% Resolved | 0 Broken | Present |
| 20 | `/features/report/report.html` | 200 OK | 100% Resolved | 0 Broken | Present |

**Result:** 20/20 pages served with HTTP 200. Zero broken relative links. Zero missing viewport tags.

---

## 9. CORE USER JOURNEY: REGISTRATION TO INTERVIEW HISTORY

The complete end-to-end user lifecycle was executed sequentially in real time:
1. **User Registration:** Created candidate `u_cand_a_123` via `/api/auth/register` (Token issued).
2. **Profile Enrichment:** Updated target role to "Senior Backend Architect" via `PUT /api/profile`.
3. **CV Upload:** Posted full text CV via `POST /api/cv`. Verified retrieval via `GET /api/cv`.
4. **AI CV Diagnostic:** Evaluated CV via `/api/ai/analyze-cv` (Generated suitability index: 85%).
5. **Job Matches:** Generated role recommendations via `/api/ai/job-recommendations`.
6. **Career Roadmap:** Generated milestone progression via `/api/ai/career-roadmap`.
7. **Session Setup:** Initialized interview session via `/api/sessions`.
8. **Live Room Run:** Performed Introduction -> Question 1 -> Answer 1 -> Question 2 -> Answer 2.
9. **Final Report:** Closed session via `/api/ai/end-interview`. Report scorecard persisted.
10. **History Audit:** Retrieved user's completed sessions via `GET /api/sessions/user/{userId}` (Session present in list).
11. **Plan Upgrade:** Simulated MoMo payment processing via `/api/payment/process`. User upgraded to Pro.

**Journey Result:** 11/11 lifecycle milestones completed without any state or data breakage.

---

## 10. LIVE INTERVIEW STATE MACHINE: TRANSITION, BRANCHING & RECOVERY

### 10.1 UI State Machine Audit
The frontend state machine in `interview.js` enforces a single source of truth (`setInterviewUIState`):
- `not_started`: Start button visible, Send/Mic/Inputs disabled.
- `speaking`: AI TTS reading question. End button active, input enabled for early typing.
- `listening`: Mic live, text input active, timer running, Enter to submit.
- `processing`: User inputs locked, thinking indicator active, Send button disabled to prevent duplicate turns.
- `paused`: Media paused, timer frozen, inputs disabled until resumed.
- `completed`: All inputs locked, room controls hidden, report redirection triggered.

### 10.2 State Machine Protection Rules
- **Anti-Revert Guard:** If `_isInterviewSessionStarted` is true, attempts to transition to `not_started` are automatically coerced to `listening`.
- **Post-Completion Lockout:** Once a session reaches `"completed"`, backend returns `400 Bad Request` (`"Phiên phỏng vấn đã hoàn tất, không thể tiếp tục gửi câu trả lời."`) on any subsequent attempts to call `respond`.

---

## 11. ADAPTIVE INTERVIEW LOGIC & PERSONA CONSISTENCY AUDIT

Verified via `tests/integration/conversational-persona.test.js` (8/8 PASS):
- **First Question Generation:** Contextualized based on candidate's background rather than a canned static question.
- **Deepening Follow-up (Case A):** Strong initial answers trigger follow-ups exploring edge cases and scale.
- **Evidence Challenge (Case F):** Unsupported metric claims trigger polite challenges requesting specific architecture and KPIs.
- **Contradiction Detection (Case E):** Cross-turn contradictions trigger clarification questions rather than silent acceptance.
- **Graceful Handling of "Unknown" (Case D):** Candidate stating "Tôi chưa nắm rõ" prompts supportive pivoting to related fundamentals.

---

## 12. AUDIO, TTS, STT & MEDIA STREAM LIFECYCLE AUDIT

### 12.1 Camera Stream Lifecycle
- `requestCameraAccess()` safely invokes `navigator.mediaDevices.getUserMedia({ video: true })`.
- Handles `NotAllowedError` and `NotFoundError` gracefully by setting camera state to `NO_PERMISSION` without crashing the interview.
- `stopCamera()` iterates `window._userWebcamStream.getTracks().forEach(t => t.stop())` and clears the pointer.
- Hooked to `window.addEventListener("beforeunload")`, `endInterview()`, and manual toggle. Zero orphan camera tracks remain after navigation.

### 12.2 Microphone & STT Lifecycle
- Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) is isolated with explicit `isListening` state.
- `stopSpeechRecognitionSilently()` shuts down recognition cleanly during AI speaking turns to prevent echo feedback loops.

### 12.3 Text-to-Speech (TTS) Unified State
- Managed via `SPEECH_STATE` (`IDLE`, `SPEAKING`, `PAUSED`, `FINISHED`, `CANCELLED`).
- Muting TTS via `toggleTTS()` halts audio playback without terminating the interview session or altering the question state.

---

## 13. TIMER MECHANICS, EXPIRATION & ANTI-TAMPERING AUDIT

### 13.1 Interview Duration & Think Time Timers
- Global session elapsed timer is driven by interval increments based on initial timestamp.
- Think time countdown (configured per question) automatically transitions from `listening` to auto-submission or warning toast if time elapses.
- Pausing the interview (`setInterviewUIState("paused")`) reliably freezes both the elapsed time ticker and question countdown.

### 13.2 Server-Side Integrity
- Question budgets (`MaximumQuestions`) and turn indices are tracked authoritatively in `Session.InterviewState` on the server. Clients cannot skip questions or tamper with turn indices without validation failure.

---

## 14. DOUBLE SUBMIT & RACE CONDITION PROTECTION AUDIT

### 14.1 Frontend Submit Debouncing
- In `interview.js`, submitting an answer immediately shifts UI state to `processing`, setting `sendBtn.disabled = true` and `inputEl.disabled = true`.

### 14.2 Backend Concurrent Ingestion Test
- **Test:** Fired 5 simultaneous HTTP requests to `/api/ai/respond` targeting the same session.
- **Result:** Thread-safe execution managed by `backend.Services.Storage.SessionLockManager`. No unhandled race exceptions occurred, and no 500 status codes were returned.

---

## 15. AI FAILURE MODES, TIMEOUT & DEGRADATION RESILIENCE AUDIT

### 15.1 Upstream Timeout Configuration
- `GeminiService` HTTP client is configured with a 60-second timeout:
  ```csharp
  builder.Services.AddHttpClient<GeminiService>(client => {
      client.Timeout = TimeSpan.FromSeconds(60);
  });
  ```

### 15.2 Fallback Synthesis on Quota Exhaustion
- If the upstream provider returns HTTP 402 or `insufficient_quota`, `GeminiService.GenerateUpstreamFallback()` synthesizes deterministic domain responses for questions, introductions, and scorecards.

### 15.3 Resilient Degradation Finding (P1-RES-03)
- If the upstream provider returns an unexpected HTTP 500 or 503, the exception is propagated to the global middleware, returning a generic error rather than triggering an in-room fallback question.

---

## 16. REPORT GENERATION, SCORING FIDELITY & BREAKDOWN ACCURACY AUDIT

### 16.1 Multi-Dimensional Scoring
Scorecard evaluation in `InterviewReportService` and `FinalEvaluationService` produces a comprehensive breakdown across:
1. `overallScore` (1-100)
2. `techScore` (Technical depth & concept correctness)
3. `commScore` (Clarity and conciseness)
4. `softScore` (Problem-solving and teamwork)
5. `starScore` (Situation, Task, Action, Result structured reasoning)
6. `situationalScore` (Handling realistic workplace dilemmas)

### 16.2 Output Format & Presentation
- Frontend `report.js` receives valid JSON matching `ReportResponse` schema.
- Progress bars, strengths, improvements, and suggested next steps render without clipping or missing fields.

---

## 17. CV UPLOAD, PARSING & JOB RECOMMENDATION FLOW AUDIT

- **Upload Endpoint:** `POST /api/cv` accepts raw text or extracted PDF text (up to 100,000 characters).
- **Security Check:** Reject payloads with negative `FileSize` or invalid `ReadinessScore`.
- **Parsing & AI Extraction:** `/api/ai/analyze-cv` extracts candidate key skills, detects missing proficiencies, and assigns suitability ratings.
- **Job Recommendations:** `/api/ai/job-recommendations` maps detected candidate skills to matching tech job profiles.

---

## 18. CAREER ROADMAP & MILESTONE PERSISTENCE AUDIT

- **Roadmap Generation:** `/api/ai/career-roadmap` returns phased career milestones (Step 1 -> Step 2 -> Step 3) with actionable study topics.
- **Roadmap Progress:** Rendered on `features/progress/progress.html`.

---

## 19. PAYMENT CHECKOUT & PLAN UPGRADE SIMULATION AUDIT

- **Endpoint:** `POST /api/payment/process`
- **Supported Methods:** `card`, `momo`, `zalopay`, `stripe`.
- **Validation Rules:**
  - Enforces `transaction.User == callerId` (preventing paying for or modifying other user accounts).
  - Method-specific parameter checks (e.g., `MomoPhone` and `TransactionId` required for MoMo).
- **State Transition:** Successful simulation updates `user.Subscription` to `"pro"` and extends `SubscriptionExpiry` by 30 days.

---

## 20. ADMIN & MANAGER MANAGEMENT CONSOLE AUDIT

### 20.1 User Directory & Actions
- `GET /api/admin/users`: Returns users ordered by creation date. Accessible by both Admin and Manager.
- `POST /api/admin/users/{id}/upgrade`: Pro-tier upgrade. Restricted strictly to Admin.
- `POST /api/admin/users/{id}/downgrade`: Free-tier downgrade. Restricted strictly to Admin.
- `POST /api/admin/users/{id}/role`: Updates user role (`user`, `manager`, `admin`). Strict validation rejects homoglyphs, non-ASCII characters, and unauthorized strings.
- `DELETE /api/admin/users/{id}`: Deletes user. Admin cannot delete their own account (prevents accidental lockout).

### 20.2 AI Provider Configuration Console
- `GET /api/admin/ai/config`: Returns active provider, model, temperature, and token budget.
- `PUT /api/admin/ai/config`: Live updates AI provider settings without restarting the server. Restricted strictly to Admin.

---

## 21. FILEDB PERSISTENCE, CONCURRENCY & DATA INTEGRITY AUDIT

### 21.1 Atomic File Storage Mechanics
- `FileDb.Save()` serializes all collections under a process-wide `lock (_lock)`.
- Writes JSON payload to `db.json.tmp` first, followed by an atomic `File.Move(..., overwrite: true)`.
- If an interrupted write leaves a `.tmp` file, boot sequence automatically recovers the database from the temporary file.

### 21.2 Concurrency Stress Test
- **Test:** Dispatched 10 simultaneous asynchronous HTTP requests executing `UpdateUser` on the live database.
- **Result:** All 10 requests completed with `200 OK`. The database file remained structurally valid JSON without corrupt records or race conditions.

---

## 22. RESPONSIVE RUNTIME & VIEWPORT RENDERING VERIFICATION

- All 20 HTML documents include `<meta name="viewport" content="width=device-width, initial-scale=1.0">`.
- Responsive layout verification in `tests/responsive/responsive.test.js` passed across standard mobile (375px), tablet (768px), and desktop (1024px+) viewports.
- Design tokens in `tokens.css` correctly map container max-widths and responsive padding variables.

---

## 23. CONSOLE WARNING & NETWORK ERROR ZERO-TOLERANCE AUDIT

- **Missing Asset 404s:** 0 (all scripts, images, and styles exist).
- **Unhandled JavaScript Errors:** 0 unhandled syntax or runtime exceptions across client modules.
- **Unhandled Server Exceptions:** Sanitized by global middleware; no raw callstacks leaked.

---

## 24. CROSS-CUTTING CONCERNS: SECURITY HEADERS, CORS, RATE LIMITING & INPUT SANITIZATION

### 24.1 Security Headers Assessment (P1-SEC-01)
- Current Kestrel responses lack:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy`

### 24.2 CORS Configuration Assessment (P2-SEC-04)
- `Program.cs` currently applies `policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()`. Wildcard origins should be constrained to explicit origins in production.

### 24.3 Rate Limiting Assessment (P1-SEC-02)
- Rate limiting middleware is commented out in `Program.cs` (`// app.UseMiddleware<RateLimitMiddleware>();`).

### 24.4 Input Sanitization & Null Byte Protection
- DTO validation and input checks systematically verify maximum lengths (e.g. 100 chars for names, 20,000 for answers, 100,000 for CV text). Null byte characters (`\0`) are proactively rejected on auth registration.

---

## 25. COMPREHENSIVE FINDINGS CATALOG (P0, P1, P2, P3)

### Priority P0 (Critical / Blocker): 0 FINDINGS

*(None found. All core journeys, authentication, AI flows, and persistence mechanisms operate cleanly.)*

---

### Priority P1 (High Severity): 3 FINDINGS

#### [P1-SEC-01] Missing HTTP Security Headers in Kestrel Pipeline
- **Severity:** P1 (High)
- **Component:** `BE/Program.cs`
- **Reproduction:** Send any HTTP GET request to `http://127.0.0.1:5000/api/health` or `/index.html`.
- **Expected:** Responses contain `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` or `DENY`, and `Referrer-Policy`.
- **Actual:** Headers are completely absent.
- **Risk:** Vulnerability to clickjacking attacks via iframe embedding and MIME-sniffing exploits in legacy browsers.

#### [P1-SEC-02] Rate Limiting Middleware Inactive in Server Pipeline
- **Severity:** P1 (High)
- **Component:** `BE/Program.cs` (Line 161)
- **Reproduction:** Inspect middleware registration in `Program.cs`. Line 161 is commented out: `// app.UseMiddleware<RateLimitMiddleware>();`.
- **Expected:** Critical endpoints (`/api/auth/login`, `/api/auth/register`, `/api/ai/*`) are throttled against brute-force attacks and quota exhaustion.
- **Actual:** Endpoints accept unlimited rapid requests without throttling.
- **Risk:** Susceptibility to credential stuffing and uncontrolled upstream AI API quota exhaustion.

#### [P1-RES-03] AI Upstream Exception Handling Leaves Client in 500 State for Non-402 Errors
- **Severity:** P1 (High)
- **Component:** `BE/Services/AI/GeminiService.cs` (Lines 128-141)
- **Reproduction:** When Vilao AI gateway returns HTTP 500, 502, 503, or 429, `GeminiService` throws an exception, returning generic HTTP 500 `{"error":"Đã xảy ra sự cố nội bộ trong quá trình xử lý."}`.
- **Expected:** Fallback response generated similarly to HTTP 402 quota exhaustion, allowing the interview room to continue smoothly.
- **Actual:** Live interview room displays error toast and halts question progression.

---

### Priority P2 (Medium Severity): 3 FINDINGS

#### [P2-SEC-04] Permissive Global CORS Policy (`AllowAnyOrigin`)
- **Severity:** P2 (Medium)
- **Component:** `BE/Program.cs` (Lines 21-29)
- **Reproduction:** Inspect CORS policy named `"AllowAll"`.
- **Expected:** Origin restricted to trusted hostnames in production configuration.
- **Actual:** Any origin is permitted (`policy.AllowAnyOrigin()`).

#### [P2-PERF-01] Synchronous Full-Database Flush on Every Write Mutation
- **Severity:** P2 (Medium)
- **Component:** `BE/Services/Storage/FileDb.cs` (`Save()` method)
- **Reproduction:** Every profile update, answer submission, and payment invokes `_fileDb.Save()`, rewriting the entire database JSON file to disk under a lock.
- **Impact:** Acceptable for single-tenant local usage, but under high concurrent user loads, disk I/O lock contention will cause latency spikes.

#### [P2-UX-01] Rigid Login Request Model Property Name
- **Severity:** P2 (Medium)
- **Component:** `BE/Models/DTOs/RequestResponseDtos.cs` & `BE/Controllers/AuthController.cs`
- **Reproduction:** Sending `{"username": "admin", "password": "..."}` fails validation because the DTO only maps `Email`.
- **Expected:** Request model supports `Username` as an alias or binds flexibly.
- **Impact:** Third-party API consumers or integrations expecting standard `username` field receive unexpected 400 Bad Request.

---

### Priority P3 (Low Severity / Polish): 3 FINDINGS

#### [P3-CODE-01] Dev Secret Fallback for JWT Token Signing
- **Severity:** P3 (Low)
- **Component:** `BE/Program.cs` (Line 102)
- **Reproduction:** When `Jwt:Secret` or `JWT__SECRET` environment variables are omitted, Kestrel falls back to `JwtTokenService.DefaultDevSecret`.
- **Recommendation:** Server should log a warning or enforce mandatory environment variable in production mode.

#### [P3-FE-01] Third-Party CDN Dependency for PDF.js Worker
- **Severity:** P3 (Low)
- **Component:** `FE/features/interview/interview.js` (Line 20)
- **Reproduction:** References `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`.
- **Impact:** Candidates in restricted offline networks cannot parse PDF CVs client-side without internet access.

#### [P3-UX-02] Career Roadmap Endpoint Requires Redundant Full CV Text
- **Severity:** P3 (Low)
- **Component:** `BE/Controllers/AIController.cs` (`/career-roadmap`)
- **Reproduction:** Endpoint requires `CvText` in request body even if the authenticated candidate already has an active CV saved on the server.

---

## 26. VERIFIED WORKING CAPABILITIES (LIVE EVIDENCE)

The following capabilities have been proven to work on the live server:

1. **Server Boot & Asset Delivery:** Kestrel successfully serves all static files, HTML pages, CSS, and JS modules on port 5000 with gzip compression.
2. **Guest Interview Journey:** Complete execution of anonymous session setup, readiness evaluation, AI introduction, conversational Q&A, and diagnostic report generation.
3. **Authentication & Token Lifecycle:** User registration with PBKDF2 hashing, login via username or email, JWT issuance, and authenticated identity retrieval on `/api/auth/me`.
4. **Role-Based Access Control (RBAC):** Strict authorization separation between `user`, `manager`, and `admin` roles on user management, plan upgrades, and AI configurations.
5. **BOLA / IDOR Protection:** Complete prevention of cross-user CV viewing and unauthorized session modification.
6. **Live Multi-Turn Adaptive AI:** Real-time integration with Gemini AI handling questions, clarification follow-ups, and contradiction detection.
7. **Scorecard & Report Scoring:** Automated generation of overall, technical, communication, soft-skill, and STAR ratings.
8. **CV Diagnostic & Job Recommendation:** Automated extraction of candidate strengths and mapping to relevant career tracks.
9. **Career Roadmap:** Phased milestone generation for career progression.
10. **Simulated Payment Processing:** Multi-channel checkout handling (MoMo, ZaloPay, Card) with automatic Pro-tier subscription updates.
11. **Concurrency Safety:** Multi-threaded profile updates handled safely via FileDb locks without database corruption.
12. **Frontend State Machine & Hardware Teardown:** Clean UI state transitions and deterministic microphone/camera hardware release upon session termination.

---

## 27. UNVERIFIED / INOPERABLE CAPABILITIES (LIVE EVIDENCE)

The following capabilities cannot be verified as fully production-ready in the current deployment:

1. **Third-Party Real Payment Gateway Webhooks:** Actual banking webhooks (VNPay, MoMo IPN, Stripe Webhooks) are simulated locally; production gateway credentials are not attached.
2. **Live WebSocket Voice Streaming:** Audio is currently handled via client-side Web Speech STT and synthesis rather than full-duplex WebSocket audio streaming to the backend.
3. **Rate Limiting Enforcement:** IP-level throttling is currently disabled in the server pipeline.

---

## 28. CRITICAL BLOCKERS & PRODUCTION READINESS ASSESSMENT

### Critical Blockers for Local / Internal Staging: 0 BLOCKERS
PrepMate is 100% operational for internal staging, user demonstration, and local development.

### Blockers for Public Internet Deployment: 2 ACTIONABLE GATES
Before exposing port 5000 directly to the public internet:
1. **Security Headers & Rate Limiting Gate:** Must enable security headers middleware (`X-Content-Type-Options`, `X-Frame-Options`) and activate `RateLimitMiddleware`.
2. **CORS Hardening Gate:** Restrict `AllowAnyOrigin()` to authorized production domains.

---

## 29. PRIORITIZED REMEDIATION ROADMAP

```mermaid
flowchart TD
    subgraph Wave 1: Immediate Security Hardening
        W1A["Enable Security Headers Middleware (P1-SEC-01)"]
        W1B["Reactivate RateLimitMiddleware in Program.cs (P1-SEC-02)"]
    end
    subgraph Wave 2: Resilience & Robustness
        W2A["Extend GeminiService Upstream Fallback to 500/503/429 (P1-RES-03)"]
        W2B["Constrain CORS Policy to Trusted Origins (P2-SEC-04)"]
        W2C["Add Username alias to LoginRequest DTO (P2-UX-01)"]
    end
    subgraph Wave 3: Performance & Offline Polish
        W3A["Bundle PDF.js worker locally in FE/assets (P3-FE-01)"]
        W3B["Enforce mandatory JWT Secret in production boot (P3-CODE-01)"]
        W3C["Optimize FileDb write batching (P2-PERF-01)"]
    end

    Wave 1 --> Wave 2
    Wave 2 --> Wave 3
```

---

## 30. AUDIT SIGN-OFF & FINAL SEAL GATE

```text
================================================================================
PREPMATE — SYSTEM RUNTIME & E2E AUDIT SIGN-OFF
================================================================================
Audit Mode               : AUDIT ONLY (STRICTLY ZERO CODE MODIFICATIONS)
Static Regression Suite  : 13/13 SUITES PASS (429/429 ASSERTIONS)
Backend Build            : net10.0 (0 WARNINGS, 0 ERRORS)
Conversational Suite     : 8/8 INTEGRATION CASES PASS
Live Runtime E2E Matrix  : 41/41 CHECKS PASS (100% SUCCESS)
Frontend HTML Pages      : 20/20 SERVED (0 BROKEN ASSETS, 100% VIEWPORT COMPLIANT)
================================================================================
CRITICAL SHOWSTOPPERS (P0) : 0
HIGH SEVERITY ISSUES (P1)  : 3
MEDIUM SEVERITY ISSUES (P2): 3
LOW SEVERITY NOTICES (P3)  : 3
================================================================================
VERDICT                  : PASS WITH PRODUCTION HARDENING NOTICES
NEXT RECOMMENDED PHASE   : P1.6 — SECURITY & RESILIENCE HARDENING
================================================================================
```
