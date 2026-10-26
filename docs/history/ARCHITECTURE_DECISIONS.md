# PrepMate — Architecture Decision Records (ADRs)

## Overview
This document records key architectural decisions, rationale, tradeoffs, and consequences made throughout the design and construction of PrepMate.

---

### ADR-01: Single-Tier Web Application with Kestrel Static Asset Serving
- **Context:** PrepMate needs a simple, robust deployment model that requires minimal DevOps overhead while delivering low-latency frontend and API performance.
- **Decision:** Host both RESTful API controllers and static HTML/CSS/JS assets directly on ASP.NET Core Kestrel (`WebRootPath = "../FE"`).
- **Consequences:**
  - *Pros:* Single process to build, launch, and monitor. Port 5000 delivers both UI and API. Zero CORS configuration needed in unified deployments.
  - *Cons:* Frontend and backend lifecycle updates are coupled during deployment.

---

### ADR-02: Zero-Framework Vanilla Frontend Architecture
- **Context:** Candidates access PrepMate from varying devices and network speeds.
- **Decision:** Build the frontend using standard HTML5, CSS3, ES6+ JavaScript, and native Web Components rather than heavy single-page application frameworks (React, Angular).
- **Consequences:**
  - *Pros:* Zero client-side bundle compile time, instant initial page load, low memory footprint.
  - *Cons:* State synchronization across views requires discipline and structured DOM patterns.

---

### ADR-03: Thread-Safe Atomic JSON Storage (`FileDb`)
- **Context:** The project requires a functional database without mandating external SQL/NoSQL daemon installation for developers or evaluation testers.
- **Decision:** Implement `FileDb.cs` using in-memory `ConcurrentDictionary` collections synchronized to `db.json` via process monitor locks and atomic temporary file moves.
- **Consequences:**
  - *Pros:* Zero external dependencies, trivial backup and migration, thread-safe operation.
  - *Cons:* Not designed for massive multi-node scale; entire file rewritten on disk saves.

---

### ADR-04: PBKDF2 Password Cryptography
- **Context:** Candidate credentials must never be stored in plaintext.
- **Decision:** Implement salted PBKDF2 hashing via `Rfc2898DeriveBytes` with HMAC-SHA256, 100,000 iterations, and 128-bit random salts.
- **Consequences:**
  - *Pros:* Industry standard, resistant to GPU/ASIC rainbow table attacks, zero plaintext exposure.
  - *Cons:* Slightly higher CPU work during login/registration (intentionally designed).

---

### ADR-05: Client-Side Web Speech STT/TTS Integration
- **Context:** Providing natural voice interaction in the virtual interview room.
- **Decision:** Leverage browser-native Web Speech API (`webkitSpeechRecognition` / `SpeechSynthesis`) for candidate speech-to-text and interviewer reading.
- **Consequences:**
  - *Pros:* Zero server audio streaming bandwidth cost, low latency, no extra cloud STT fees.
  - *Cons:* Quality varies depending on the candidate's browser engine and OS voice packages.

---

### ADR-06: Deterministic Domain Fallback on LLM Quota Exhaustion
- **Context:** External LLM API gateways can encounter rate limits or temporary maintenance.
- **Decision:** Equip `GeminiService` with `GenerateUpstreamFallback()` synthesizing context-aware domain questions, introductions, and scorecards.
- **Consequences:**
  - *Pros:* Live interview sessions never crash mid-conversation due to external API hiccups.
  - *Cons:* Fallback responses lack the deep personalization of live LLM generation.
