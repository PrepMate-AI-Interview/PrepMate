# PrepMate Deployment — Production Readiness & Current Limitations

## 1. Readiness Overview
PrepMate is currently **100% operational for local development, staging environments, and demonstration testing**. To transition port 5000 directly to public internet production traffic, the following specific architectural and security gates must be met.

---

## 2. Current System Limitations

1. **Simulated Payment Gateway:** Payment transactions via MoMo, ZaloPay, Card, and Stripe are currently simulated on the server. Real third-party bank webhooks with cryptographic IPN signatures are not implemented.
2. **Browser-Based Speech Engine:** Audio voice communication uses browser Web Speech APIs (`SpeechRecognition` / `SpeechSynthesis`) rather than bidirectional binary audio streaming over WebSockets.
3. **Single-File JSON Storage:** The application uses `FileDb` (atomic JSON writes). Under heavy concurrent write traffic (>50 writes/second), disk I/O lock contention will occur. Migration to PostgreSQL or SQLite is recommended for scale.

---

## 3. Production Deployment Checklist (Actionable Gates)

- [ ] **Security Headers Middleware:** Activate middleware in `Program.cs` to inject `X-Content-Type-Options: nosniff` and `X-Frame-Options: SAMEORIGIN`.
- [ ] **Rate Limiting:** Uncomment and configure `app.UseMiddleware<RateLimitMiddleware>()` to throttle auth and AI endpoints against abuse.
- [ ] **CORS Restriction:** Constrain `policy.AllowAnyOrigin()` to explicit production frontend domains.
- [ ] **Mandatory JWT Secret:** Enforce non-empty `JWT__SECRET` environment variable during server boot; throw exception if dev fallback is detected in production mode.
- [ ] **Local PDF.js Bundle:** Host `pdf.worker.min.js` locally in `FE/assets` to eliminate third-party CDN dependency.
