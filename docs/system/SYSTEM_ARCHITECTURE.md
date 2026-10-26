# PrepMate — System Architecture

## 1. High-Level Architecture

PrepMate is constructed as a modern, lightweight single-tier application with clean separation between client presentation and server capabilities:

```mermaid
graph TD
    Client["Browser Client (HTML5 / Vanilla JS / CSS3)"]
    Kestrel["Kestrel Web Server (.NET 10.0)"]
    StaticFiles["Static File Middleware (FE/ Assets)"]
    APIRoutes["ASP.NET Core Controllers (/api/*)"]
    AuthService["JWT Bearer Authentication & PasswordHasher"]
    InterviewEngine["Adaptive Interview & Flow Orchestrator"]
    EvaluationService["Evidence Report & Evaluation Engine"]
    StorageEngine["Thread-Safe FileDb (Atomic JSON Storage)"]
    AIRouter["AIRouter (Task Dispatcher)"]
    PrepMateClient["IPrepMateAIClient (Resilient Client)"]
    AIGateway["Vilao AI Gateway (https://api.vilao.ai/v1)"]
    ComboRoot["Vilao Combo Root (Upstream Model Orchestrator)"]

    Client -->|HTTP GET / Static Assets| StaticFiles
    Client -->|RESTful JSON Requests / Authorization: Bearer| APIRoutes
    StaticFiles --- Kestrel
    APIRoutes --- Kestrel
    APIRoutes --> AuthService
    APIRoutes --> InterviewEngine
    APIRoutes --> EvaluationService
    APIRoutes --> StorageEngine
    InterviewEngine --> AIRouter
    EvaluationService --> AIRouter
    AIRouter --> PrepMateClient
    PrepMateClient -->|POST /chat/completions (Alias: PrepMate)| AIGateway
    AIGateway --> ComboRoot
```

---

## 2. Technology Stack

### 2.1 Backend Core (.NET 10)
- **Framework:** ASP.NET Core 10.0 Kestrel Web Server.
- **Authentication:** JWT Bearer Token (`Microsoft.AspNetCore.Authentication.JwtBearer`) with symmetric HMAC-SHA256 signing.
- **Password Security:** PBKDF2 hashing (`PasswordHasher.cs`) with 100,000 iterations, 128-bit random salt, and zero plaintext storage.
- **Response Optimization:** Gzip and Brotli response compression (`Microsoft.AspNetCore.ResponseCompression`).
- **Static Hosting:** Native Kestrel static file provider serving `FE/` directly as `WebRootPath`.

### 2.2 Frontend Presentation (Vanilla Web Platform)
- **Architecture:** Zero-framework, dependency-free HTML5, CSS3 Custom Properties (Design Tokens), and modern ES6+ JavaScript.
- **Design Tokens SSOT:** Canonical `--pm-*` design tokens in `tokens.css` powering colors, spacing, borders, and typography.
- **Typography:** Google Outfit sans-serif typeface across all candidate interfaces.
- **Iconography:** Pure inline SVG vector icons (Zoom-style media controls, navigation glyphs).
- **Audio & Media:** Browser Web Speech API (`SpeechRecognition` / `SpeechSynthesis`) and WebRTC `navigator.mediaDevices.getUserMedia`.

### 2.3 Data Storage
- **Engine:** `backend.Services.Storage.FileDb`.
- **Concurrency Model:** In-memory `ConcurrentDictionary<TKey, TValue>` coupled with process-wide re-entrant monitor locks (`lock (_lock)`).
- **Durability Guarantee:** Atomic file replacement via `.tmp` file write and atomic `File.Move(..., overwrite: true)`.
- **Auto-Seeding:** Automatically seeds fresh development data if `db.json` is not present during Development mode.

---

## 3. AI Subsystem Architecture (Single Gateway & PrepMate Alias)

### 3.1 Single AI Gateway & Model Alias
All AI use cases in PrepMate communicate with a single provider endpoint:
- **Base URL:** `https://api.vilao.ai/v1`
- **Protocol:** OpenAI-compatible Chat Completions protocol (`POST /v1/chat/completions`).
- **Logical Model Alias:** **`PrepMate`**. Business logic interacts exclusively with this logical alias; provider-specific internal model strings are strictly isolated from the application domain.

### 3.2 Combo Root & Upstream Responsibility
The fallback, routing, and selection between underlying LLM engines (e.g., Gemini 3.8 Flash, GPT-4o, Claude 3.5 Sonnet) is the responsibility of **Vilao's Combo Root** infrastructure upstream. PrepMate does not manage individual member models locally; it dispatches requests to `PrepMate` and receives orchestrated responses from the gateway.

### 3.3 Core AI Components
- **`IPrepMateAIClient`:** The unified HTTP client managing authentication headers, request formatting, timeouts, retry logic, and JSON response extraction.
- **`AIRouter`:** Dispatches AI requests according to `AITaskType` (Interview Turn, Question Generation, Answer Evaluation, CV Analysis, Career Roadmap, Report Generation).
- **`GeminiService` (Facade):** Maintains backward compatibility for legacy callers while routing all traffic through `AIRouter` and `IPrepMateAIClient`.
- **`NoAiModeService`:** Detects missing credentials or gateway outages, seamlessly switching the session to deterministic fallback logic without disruption.

---

## 4. Evidence Ledger & Scoring Standardization

### 4.1 Evidence Ledger (Candidate Claims vs. Verified Facts)
To prevent hallucinations across turns and sessions, PrepMate maintains a structured `EvidenceLedger`:
- **`ObservedFacts`:** Technical mechanisms, code structures, or quantitative numbers backed by candidate explanations.
- **`CandidateClaims`:** Unsubstantiated claims (e.g. "I improved speed by 80%") flagged for follow-up challenges.
- **`Contradictions`:** Discrepancies between statements made in different turns.
- **`InformationGaps`:** Core competencies required by the target job family that have not yet been evaluated.

### 4.2 Standardized 100-Point Scoring Contract
All AI evaluations, competency ratings, and report presentation metrics follow a unified **0–100 point scale**:
- **Overall Score:** $0.0 - 100.0$ (`OverallScore` in `ReportModel` and `InterviewReport`).
- **Dimension Scores:** Technical Knowledge, Practical Application, Reasoning Depth, Follow-up Handling, Communication, and Consistency are all calibrated to the $0 - 100$ scale.
- **Mathematical Congruence:** Composite scores are calculated from unrounded raw criteria scores via arithmetic mean:
  $$\text{MeanScore}_{100} = \frac{\sum_{i=1}^{N} \text{Score}_i}{N}$$
- **Frontend Normalization:** `normalizeScoreTo100` acts as the single mapping layer, ensuring hero displays (`#hero-score-value`) render 0–100 values with `#hero-score-scale` displaying `/ 100`.
