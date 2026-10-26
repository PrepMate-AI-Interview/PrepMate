# PREPMATE — P1.3 INDUSTRY-NEUTRAL CONTENT & CONTEXT AUDIT REPORT

> **Document ID:** P1.3-AUDIT-20261007  
> **Status:** COMPLETED (READ-ONLY AUDIT)  
> **Date:** October 7, 2026  
> **Target Scope:** Entire Frontend (`FE/`) & Backend Content/Context Services (`BE/`)  
> **Auditor Role:** Senior Principal Quality, Architecture & Content Integrity Auditor  
> **Implementation State:** STRICTLY READ-ONLY — ZERO CODE MODIFIED  

---

## 1. EXECUTIVE SUMMARY

P1.2 stabilized the runtime UX and media lifecycles of the Live Interview room, establishing a professional simulation baseline. The core question posed by Phase P1.3 is:
> *"Has PrepMate genuinely evolved into a multi-industry professional interview preparation platform, or does it merely present an industry-neutral facade while operating internally under developer-first assumptions?"*

This comprehensive audit of all 18 HTML pages, 23 JavaScript files, and 138 C# backend files reveals a profound architectural dissonance:
1. **The UI Surface Layer is Largely Industry-Neutral:** Following P1.1 and P1.2, Setup and Live Interview dynamically receive and display non-SWE job titles and company names (e.g., Marketing Specialist, Financial Analyst).
2. **The Prompt, Context & Persona Core Remains Heavily SWE-Biased:** Deep within the backend and fallback pathways, critical components revert to Software Engineering assumptions:
   - `InterviewerPersona.CreateDefault` routes **all non-HR roles** (including Marketing, Finance, Sales, Supply Chain, Operations) directly to `Senior Engineer / Tech Lead Interviewer` with instructions to drill into *"architectural decisions"*, *"bottlenecks"*, and *"scale x10"*.
   - Backend system prompt in `QuestionPrompt.cs` (line 122 & 194) explicitly tells the model: *"Hãy nói như một Tech Lead thật sự"* and gives examples like *"Giả sử traffic tăng gấp 10 lần thì sao?"*.
   - `InterviewPreparationService.cs` (lines 472, 484, 549) gives hardcoded preparation advice for non-SWE roles on *"bài toán thiết kế hệ thống hoặc coding"*, *"scale người dùng, throughput kỳ vọng, latency SLA"*, *"tech debt"*, and recommends mock interviews in *"System Design & High Availability"*.
   - Report presentation in `report.js` and `report.html` brands the primary competence dimension as `"Kiến thức Kỹ thuật"` with a gear icon (`⚙️`) and `"Fact kỹ thuật chuẩn"`, evaluating a marketer or financial analyst as if they were a software engineer.
   - Fallback offline matching in `main.js` falls back directly to `MOCK_QUESTIONS["Frontend Developer"]` with questions about React, Vue, and Angular whenever an unrecognized career role is entered.

**Verdict Summary:** Due to the existence of 5 critical P0 context corruption vulnerabilities in the backend prompt, persona, and preparation generation pipeline, the audit verdict is **`P1.3 AUDIT — BLOCKED`** until these core semantic regressions are remediated in the subsequent implementation phase.

---

## 2. AUDIT SCOPE

The audit evaluated all user-facing surfaces, data propagation pipelines, and backend prompt/evaluation templates:
- **Public Surfaces:** `FE/index.html` (Landing), `FE/features/about/about.html`, `FE/features/help/help.html`, `FE/features/payment/pricing.html`.
- **Preparation & Setup:** `FE/features/interview/interview-info.html`, `FE/features/interview/interview-info.css`, `FE/features/interview/interview.js`.
- **Live Interview Chamber:** `FE/features/interview/interview-practice.html`, `FE/features/interview/interview-room.css`, `FE/features/interview/interview.js`, `avatar.js`.
- **Evaluation & Debrief:** `FE/features/report/report.html`, `FE/features/report/report.css`, `FE/features/report/report.js`.
- **Career Ecosystem:** `FE/features/jobs/jobs.html`, `FE/features/qbank/qbank.html`, `FE/features/dashboard/dashboard.html`, `FE/features/progress/progress.html`.
- **Candidate Profile & CV:** `FE/features/profile/profile.html`, `FE/features/profile/cv.html`, `FE/features/profile/profile.js`.
- **Administrative Portal:** `FE/features/admin/admin.html`.
- **Backend Context & Prompts:** `BE/Prompts/Interview/`, `BE/Services/Context/`, `BE/Services/Interview/`, `BE/Services/Evaluation/`, `BE/Services/Preparation/`, `BE/Services/AI/`, `BE/Models/Interview/`.

---

## 3. SEALED REGRESSION BASELINE VERIFICATION

To honor the strict read-only nature of P1.3, all regression suites were executed with zero changes applied to the codebase:

| Suite Name | Scope | Expected | Verified Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| `test_interview_setup_ux.js` | P1.1 Setup Stepper & Multi-domain UX | 20/20 PASS | **20/20 PASS** | **GREEN** |
| `test_live_interview_ux.js` | P1.2 Live Chamber UX & Telemetry | 12/12 PASS | **12/12 PASS** | **GREEN** |
| `test_interview_flow.js` | Live Interview Engine & TTS/State Machine | 30/30 PASS | **30/30 PASS** | **GREEN** |
| `test_report_ui.js` | 6-Dimension Report & Diagnostics Contract | 67/67 PASS | **67/67 PASS** | **GREEN** |
| `dotnet build BE/backend.csproj` | Backend .NET 10 Solution Integrity | 0W / 0E | **0 Warnings / 0 Errors** | **GREEN** |

All sealed baselines remain intact with 100% success rate.

---

## 4. STATIC SWE BIAS SCAN

A full repository regex scan across 191 active project files produced the following distribution:

| Keyword Group | Scope Queried | Occurrences | Primary Concentrations | Contextual Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Developer Defaults** | `Frontend Developer`, `Backend Developer`, `Fullstack`, `Software Engineer`, `Tech interview` | 36 matches | `main.js`, `admin.html`, `jobs.html`, `InterviewerPersona.cs`, `InterviewPreparationService.cs` | **High Bias:** Fallbacks in `main.js`, `InterviewerPersona.cs`, and `InterviewPreparationService.cs` default to developer roles. |
| **Technology Examples** | `React`, `Vue`, `Angular`, `Kafka`, `Redis`, `Docker`, `Kubernetes`, `Microservices`, `System Design` | 107 matches | `index.html`, `cv.html`, `qbank.html`, `jobs.html`, `main.js` | **Severe Concentration:** Landing visual mockups and profile CV skills showcase 100% web/cloud technologies. |
| **SWE Terminology** | `Coding`, `Deadlock`, `Concurrency`, `Latency`, `Throughput`, `Cache Stampede` | 15 matches | `index.html`, `qbank.html`, `InterviewPreparationService.cs` | **Noticeable Bias:** Landing features "Xử lý Deadlock" and "Redis Cache" as primary value propositions. |
| **AI / Model Leakage** | `Gemini`, `LLM`, `Token limit`, `Prompt`, `API Key` | 126 matches | `main.js`, `admin.html`, `profile.html`, `dashboard.html`, `GeminiService.cs` | **Controlled:** 90% internal BE or explicit BYOK settings in user profile. No prompt leakage observed during live interview turns. |

---

## 5. LANDING PAGE AUDIT (`FE/index.html`)

- **Hero Headline & Lead:**
  - *Headline:* *"Luyện tập đối mặt với nhà tuyển dụng trước khi phỏng vấn thật."* (Neutral, professional).
  - *Lead:* Mentions AI mock interview simulator without mentioning coding or developers.
- **Hero Visual Simulator Mockup (Lines 75–150):**
  - Room Badge: `Phòng phỏng vấn: FPT Software — Senior Backend`
  - Interviewer: `Trần Minh Vũ, Technical Lead • Doanh nghiệp`
  - AI Speech Box: `"Bạn vừa nói đã giảm 40% latency nhờ Redis cache. Nếu xảy ra cache stampede khi key hết hạn đột ngột, giải pháp fallback và khóa phân tán của bạn là gì?"`
  - Candidate Transcript: `"Tôi đã dùng Mutex Lock trên Redis kết hợp cơ chế cache warming định kỳ để tránh tải dồn về Database..."`
  - Telemetry: `Bám sát JD: Cao (Distributed System)`, `Dự đoán câu hỏi tới: Xử lý Deadlock`.
  - *Assessment:* 100% Backend Software Engineering. A marketing or financial candidate landing on the home page will assume PrepMate is exclusively for software developers.
- **4-Step Interactive Workflow (Lines 265–365):**
  - *Step 1 Pane:* Target: `Senior Backend Engineer`, Company: `Tập đoàn Công nghệ Hàng đầu`, Round: `Kiến trúc Hệ thống & Kỹ thuật`, Focus: `Database Deadlock, Concurrency & Microservices`.
  - *Step 2 Pane:* Question: `"Tôi thấy trong CV bạn từng xử lý hệ thống 100,000 CCU. Bạn đã giám sát và phát hiện hiện tượng nghẽn mạng (bottleneck) ở tầng nào đầu tiên?"`.
  - *Step 3 Pane:* Answer: `"Tôi chọn kiến trúc Event-Driven với Apache Kafka để giảm tải xử lý đồng bộ."` $\rightarrow$ AI Probe: `"Nếu consumer group bị lag và xảy ra duplicate message, giải pháp bảo đảm idempotency của bạn là gì?"`.
  - *Step 4 Pane:* STAR Debrief.
  - *Assessment:* Every single concrete interview illustration on the landing page is deep software architecture.
- **Stats Claims (Lines 434–497):**
  - `"Ngân hàng 100+ câu hỏi chuyên môn cơ bản"`
  - `"Toàn bộ ngân hàng 1.000+ câu hỏi STAR thực tế"`
  - `"Bảo mật 100% dữ liệu phỏng vấn & nội dung CV"`
  - *Assessment:* Claims are generic platform capabilities rather than fabricated marketing statistics (e.g., no unverified "98% pass rate at Google"). Acceptable.
- **CTAs:**
  - `Bắt đầu phỏng vấn ngay` links cleanly to `interview-info.html` without role pre-selection parameters.

---

## 6. INTERVIEW SETUP AUDIT (`FE/features/interview/interview-info.html`)

- **Default Input State:**
  - `#job-title` input is empty with placeholder: `"Ví dụ: Business Analyst, Software Engineer, Marketing Manager, Kế toán trưởng..."`. (Industry-neutral).
  - Career Quick Chips: 8 categories (Software Engineer, Business Analyst, Marketing, Sales B2B, Tài chính, HR Recruiter, PM, UI/UX). (Well-balanced).
- **Validation Guard:**
  - Advancing beyond Step 1 requires `#job-title`. User cannot leave role blank.
- **Fallback Company Context (Lines 1891 & 1960):**
  - If company name is omitted, `updateReadinessSummary()` and `syncBriefing()` fall back to:
    `companyName || 'Doanh nghiệp công nghệ'` (Technology enterprise).
  - *Assessment:* Noticeable bias. A non-tech candidate should fall back to `"Doanh nghiệp tuyển dụng"` or `"Doanh nghiệp mục tiêu"`.
- **Persona Selector:**
  - Options: Professional, Balanced, Friendly. Free of robot emojis.

---

## 7. LIVE INTERVIEW AUDIT (`FE/features/interview/interview-practice.html` & `interview.js`)

- **Dynamic Role Propagation:**
  - `#topbar-job-title` dynamically renders `${jobTitle} — ${companyName}`.
  - Confirm start modal displays dynamic `${jobTitle} • ${companyName}`.
- **Stage Agenda Configuration (`interview.js` lines 1945–1985):**
  - Stages: `INTRODUCTION`, `TECHNICAL_ASSESSMENT`, `BEHAVIORAL_STAR`, `SITUATIONAL_CASE`, `CANDIDATE_QUESTIONS`, `CLOSING`.
  - Badge for `TECHNICAL_ASSESSMENT`: `"Phỏng vấn Chuyên môn Trọng tâm"` (Good, uses "Chuyên môn").
  - Guidance: *"Tập trung vào kiến trúc thực tế, giải pháp chuyên môn và các phương án tối ưu trong công việc..."*.
  - *Fallback Trap:* Line 1985: `STAGE_AGENDA[normKey] || STAGE_AGENDA["TECHNICAL_ASSESSMENT"]`.
- **End-Interview Fallback (`interview.js` line 2628):**
  - Line 2628: `const jobTitle = currentInterviewSession?.jobTitle || "Chuyên viên Kỹ thuật";`
  - *Assessment:* If `jobTitle` is mysteriously lost in session state, it falls back to `"Chuyên viên Kỹ thuật"` instead of `"Ứng viên"`.
- **Debrief Modal Metrics (`interview.js` line 2854):**
  - Line 2854: `<span class="debrief-metric-label">Kỹ thuật</span>`
  - *Assessment:* Hardcoded metric label in end-of-interview popup reads "Kỹ thuật" even for a Marketer or Financial Analyst. Should be "Chuyên môn".

---

## 8. REPORT AUDIT (`FE/features/report/report.html`, `report.js`, & Backend Report Services)

- **Presentation Dimensions (`report.js` lines 295–302):**
  ```javascript
  const STANDARD_DIMENSIONS = [
    { key: "TECHNICAL_KNOWLEDGE", name: "Kiến thức Kỹ thuật", icon: "⚙️" },
    { key: "PRACTICAL_APPLICATION", name: "Ứng dụng Thực tế", icon: "🛠️" },
    { key: "REASONING_DEPTH", name: "Độ sâu Tư duy & Lập luận", icon: "🧠" },
    { key: "FOLLOW_UP_HANDLING", name: "Xử lý Câu hỏi Đào sâu", icon: "🎯" },
    { key: "COMMUNICATION", name: "Giao tiếp & Cấu trúc STAR", icon: "💬" },
    { key: "CONSISTENCY", name: "Tính Nhất quán", icon: "⚖️" }
  ];
  ```
  - *Assessment:* In backend `InterviewPerformanceService.cs`, this dimension is titled `"Kiến thức chuyên môn (Technical Knowledge)"`. But `report.js` translates it into `"Kiến thức Kỹ thuật"` with a mechanical gear icon (`⚙️`).
- **Report HTML Hardcoded Snippets (`report.html`):**
  - Line 118: `<span class="badge-role" id="hero-target-position">Vị trí: Backend Engineer</span>` (Default placeholder before JS load).
  - Line 194: `<div class="stat-bubble" title="Fact kỹ thuật chuẩn"><span class="stat-name">Fact chuẩn</span></div>`.
  - Line 212: `"Phân tích toàn diện cách ứng viên thể hiện tư duy, kỹ thuật và xử lý áp lực..."`.
  - Line 345: `<p class="text-muted">Chưa có nội dung kỹ thuật bổ sung.</p>`.
- **Backend Preparation Module (`InterviewPreparationService.cs` lines 472, 484, 549):**
  - Execution Guidance: *"Trước khi trả lời bài toán thiết kế hệ thống hoặc coding, luôn đặt 1-2 câu hỏi làm rõ phạm vi: scale người dùng, throughput kỳ vọng, latency SLA và các ràng buộc dữ liệu."*
  - Questions for Interviewer: *"Văn hóa xử lý tech debt, lộ trình nâng cấp kiến trúc trong 12 tháng tới..."*
  - Mock recommendations: *"Mô phỏng System Design & High Availability"* or *"Mô phỏng Kỹ thuật Tổng hợp & Coding Best Practices"*.
  - *Assessment:* **Severe Domain Corruption (P0).** Non-SWE candidates receive system design and coding advice in their generated debrief preparation plan.

---

## 9. JOBS AUDIT (`FE/features/jobs/jobs.html`)

- **Job Representation Distribution:**
  Total Mock Jobs: 12 cards.
  1. Senior Frontend Developer (React/Next.js) — *IT/Dev*
  2. Full Stack Engineer (.NET 8 + React) — *IT/Dev*
  3. Product UI/UX Designer — *Design*
  4. Backend Engineer (Python / FastAPI / Cloud) — *IT/Dev*
  5. Data Platform Engineer — *Data/Dev*
  6. Mobile App Developer (React Native / Flutter) — *IT/Dev*
  7. DevOps / Cloud Infrastructure Engineer — *DevOps*
  8. Technical Product Manager (TPM) — *Tech PM*
  9. Junior Frontend Developer (Mentorship) — *IT/Dev*
  10. AI / Machine Learning Engineer — *AI/Dev*
  11. Growth Marketing & Digital Specialist — *Marketing*
  12. Graphic & Brand Identity Designer — *Design*
- **Category Proportions:**
  - Tech / Engineering / DevOps / AI: **9 / 12 (75%)**
  - Design / UI / UX: **2 / 12 (16.7%)**
  - Marketing: **1 / 12 (8.3%)**
  - Finance / Accounting / Banking: **0 / 12 (0%)**
  - Business Analyst / Strategy: **0 / 12 (0%)**
  - HR / Talent Acquisition: **0 / 12 (0%)**
  - Sales / Business Development: **0 / 12 (0%)**
- **Filter Discrepancy:**
  The category filter provides `<option value="business">Kinh doanh / Tài chính / HR</option>`, but selecting this filter returns **zero results**. This represents a severe representation void.

---

## 10. QBANK AUDIT (`FE/features/qbank/qbank.html`)

- **Taxonomy & Balance:**
  `QBANK_DATA` contains 24 curated questions across 8 industry families:
  - IT / Software Engineering: 6 questions (25%)
  - Marketing & Communications: 3 questions (12.5%)
  - UI/UX & Brand Design: 3 questions (12.5%)
  - Enterprise Sales & Customer Success: 3 questions (12.5%)
  - Professional Translation: 3 questions (12.5%)
  - Finance & Auditing: 2 questions (8.3%)
  - HR & Talent Acquisition: 2 questions (8.3%)
  - Project Management & Agile: 2 questions (8.3%)
- **Taxonomy Assessment:**
  The taxonomy is commendable and genuinely multi-disciplinary.
- **Search Input Bias:**
  - Line 1081: `placeholder="Tìm theo câu hỏi, vị trí, từ khóa (VD: Deadlock, React, B2B)..."`.
  - 2 out of 3 suggested search terms are technical software engineering concepts.

---

## 11. DASHBOARD AUDIT (`FE/features/dashboard/dashboard.html` & `dashboard.js`)

- **Welcome & Action Copy:**
  - Header: `"Sẵn sàng cho buổi phỏng vấn tiếp theo?"` (Neutral).
  - Feature 3 Description (lines 192, 326): `"Hỗ trợ đa dạng vai trò từ Frontend, Backend, UI/UX Designer đến Quản lý dự án."` (Noticeably tech-weighted examples).
- **Recent Sessions & Fallback Company (lines 560–566):**
  - Fallback company name: `const compName = session.company || 'Doanh nghiệp Tech';`
  - *Assessment:* Non-tech session without explicit company name receives "Doanh nghiệp Tech" badge.
- **Role Icon Logic:**
  - Explicit icon rules for Frontend (`⚛️`), Backend (`⚙️`), Designer (`🎨`), DevOps (`☁️`), with generic briefcase (`💼`) fallback.

---

## 12. PROGRESS AUDIT (`FE/features/progress/progress.html`)

- **Radar Chart Metrics (lines 1612, 1673):**
  - Axis labels: `labels: ['Kỹ thuật', 'Giao tiếp', 'Kỹ năng mềm', 'STAR', 'Tổng thể']`.
  - Dimension mapped: `s.techScore || s.overallScore || 0`.
  - *Assessment:* Axis label is explicitly titled `'Kỹ thuật'` rather than `'Chuyên môn'`. A Marketing or Finance candidate sees their competence charted under "Kỹ thuật".

---

## 13. PROFILE / CV / ACCOUNT AUDIT (`profile.html` & `cv.html`)

- **Profile Target Role Input (`profile.html` line 89):**
  - `placeholder="Ví dụ: Senior Backend Engineer"` (Developer default).
- **Saved CV Skill Extraction Demonstration (`cv.html` lines 216–235):**
  - Under *"Kỹ năng AI đã nhận diện"*:
    - Chuyên môn kỹ thuật: `React.js`, `TypeScript`, `Next.js`, `Tailwind CSS`, `RESTful API`, `Redux Toolkit`.
    - Công cụ & Hệ thống: `Git / GitHub`, `Docker`, `CI/CD Pipeline`, `Webpack / Vite`.
  - *Assessment:* Static mock demonstration on the CV page is 100% Frontend Developer skills.

---

## 14. CAREER RECOMMENDATIONS & ROADMAP AUDIT (`BE/Services/AI/`)

- **`CareerRoadmapService.cs` (line 46):**
  - Prompt fallback: `Dựa vào hồ sơ ứng viên và vị trí: {{request.JobTitle ?? "Developer"}}`
- **`JobRecommendationService.cs` (line 46):**
  - Prompt fallback: `Dựa trên CV ứng viên và vị trí: {{request.JobTitle ?? "Developer"}}`
- **`ImprovementRoadmapService.cs` (line 20):**
  - Service fallback: `(!string.IsNullOrWhiteSpace(evaluation.TargetPosition) ? evaluation.TargetPosition : "Software Engineer")`
- *Assessment:* If `JobTitle` is missing from the request, recommendations and career roadmap generate advice for a Software Developer.

---

## 15. PERSONA & INTERVIEWER CONTENT AUDIT (`InterviewerPersona.cs` & Prompts)

- **`InterviewerPersona.CreateDefault` (`BE/Models/Interview/InterviewerPersona.cs`):**
  ```csharp
  public static InterviewerPersona CreateDefault(string targetPosition = "")
  {
      var isHr = targetPosition.Contains("HR", ...) || targetPosition.Contains("Talent", ...) || targetPosition.Contains("Recruiter", ...);
      if (isHr) {
          return new InterviewerPersona { Role = "HR / Culture & Behavioral Interviewer", ... };
      }
      return new InterviewerPersona {
          Role = "Senior Engineer / Tech Lead Interviewer",
          CommunicationStyle = "Direct, professional, analytical, concise",
          Strictness = "High",
          FollowUpStyle = "Drill into practical implementation, architectural decisions, and trade-offs",
          ChallengeStyle = "System scale x10, bottleneck identification, failure recovery, trade-off justification"
      };
  }
  ```
- **Semantic Suitability:**
  Because only "HR" triggers the alternative persona, a **Marketing Specialist**, **Financial Analyst**, **Business Analyst**, **Supply Chain Lead**, or **Sales Executive** receives a "Senior Engineer / Tech Lead Interviewer" whose prompt instructions are to probe *"architectural decisions"* and *"system scale x10"*.
- **Question Prompt Enforcement (`QuestionPrompt.cs` lines 122 & 194):**
  - Line 122: *"Hãy nói như một Tech Lead thật sự."*
  - Line 194: *"Bạn là một Tech Lead / Interviewer thật sự ngồi trước mặt ứng viên."*
  - Line 197: *"Giả sử traffic tăng gấp 10 lần thì sao?".*

---

## 16. STATIC DEMO & MOCK DATA AUDIT

- **`FE/shared/js/main.js` `getMockQuestionsForJob()` (lines 292, 547):**
  - If `jobTitle` is unmapped or empty:
    `if (!jobTitle) return MOCK_QUESTIONS["Frontend Developer"];`
    `// Fallback mặc định: return MOCK_QUESTIONS["Frontend Developer"];`
  - Any niche or unmapped professional role (e.g. "Luật sư Doanh nghiệp", "Bác sĩ", "Trưởng phòng Mua hàng") falls back to React, Vue, and Angular questions.
- **`FE/features/admin/admin.html` (lines 1420, 1540):**
  - Question creator role input: `placeholder="Ví dụ: Backend Developer (Golang / Java)"`.
  - Question curriculum seed: 2 IT (Backend Concurrency, Frontend React), 1 Marketing, 1 Translation.

---

## 17. ERROR / EMPTY / LOADING STATES AUDIT

- **Loading States:**
  - Setup & practice loading states are neutral: *"Đang phân tích thông tin...", "Đang kết nối phòng phỏng vấn..."*.
- **Empty States:**
  - QBank: `"Không tìm thấy câu hỏi phù hợp với bộ lọc."` (Neutral).
  - Progress: `"Chưa có dữ liệu phỏng vấn. Hãy hoàn thành ít nhất một buổi phỏng vấn..."` (Neutral).
  - Jobs: `"Không có việc làm phù hợp."` (Neutral).
- **Error States:**
  - AI error in `interview.js`: `"Không thể tải báo cáo đánh giá từ AI."` (Neutral, acceptable).
  - No technical backend stack trace or database error strings exposed to candidate.

---

## 18. AI & IMPLEMENTATION LEAKAGE AUDIT

- **Classification Summary:**
  - `A — Internal implementation only`: `GeminiService.cs`, `GeminiClient` in BE (34 occurrences). Clean.
  - `B — Admin diagnostic`: `admin.html` Gemini model selector (`gemini-1.5-flash`, `gemini-1.5-pro`). Clean.
  - `C — User-facing BYOK setting`: `profile.html` & `dashboard.html` input fields for personal Gemini/ElevenLabs API Keys. Transparent and documented.
  - `D — User-facing implementation leakage`: **0 instances**. No raw prompts, token limits, or model internals leaked in the Live Interview prompter drawer.

---

## 19. CONTEXT PROPAGATION AUDIT

Tracing data propagation across all lifecycle phases:

```text
[Step 1] Interview Setup (interview-info.html)
         User inputs: JobTitle="Marketing Specialist", Company="Unilever", Seniority="Senior"
         ↓ (Verified: saved to sessionStorage "interview_init_data")
[Step 2] Live Interview Client (interview.js)
         Reads sessionStorage, populates Topbar: "Marketing Specialist — Unilever"
         Calls POST /api/interview/start
         ↓ (Verified: JobTitle and TargetCompany sent in JSON payload)
[Step 3] Backend Context Builder (InterviewContextBuilder.cs)
         Binds TargetPosition="Marketing Specialist", TargetCompany="Unilever"
         Calls InterviewerPersona.CreateDefault("Marketing Specialist")
         ❌ CRITICAL BREAKAGE: Not an HR role! 
         Persona defaults to "Senior Engineer / Tech Lead Interviewer"!
         ↓
[Step 4] Question Generation (QuestionPrompt.cs)
         Injects Persona: "Senior Engineer / Tech Lead Interviewer"
         ❌ Prompt instructs: "Hãy nói như một Tech Lead thật sự", "Giả sử traffic tăng x10"
         ↓
[Step 5] Turn Navigation & Finish (interview.js)
         Finish summary requests end-interview report
         ⚠️ Fallback jobTitle if session lost: "Chuyên viên Kỹ thuật"
         ❌ Debrief metric label hardcoded: "Kỹ thuật"
         ↓
[Step 6] Report & Debrief (InterviewPerformanceService.cs & report.js)
         Report evaluates dimension TECHNICAL_KNOWLEDGE
         ❌ FE report.js renders card titled: "Kiến thức Kỹ thuật" (icon ⚙️)
         ❌ InterviewPreparationService generates guidance on system design & coding trade-offs!
         ↓
[Step 7] Recommendations & Roadmap (CareerRoadmapService.cs)
         ⚠️ If JobTitle missing: Fallback to "Developer" / "Software Engineer"
```

**Context Preservation Verdict:** While `JobTitle` and `TargetCompany` strings propagate successfully across the network payloads, their semantic meaning is corrupted at Steps 3, 4, 6, and 7 by hardcoded software engineering assumptions.

---

## 20. INDUSTRY COVERAGE MATRIX

| Surface | Software Engineering | Finance & Banking | Marketing & Growth | Business Analysis | HR & People | Generic Professional |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Landing** | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#ef4444;font-weight:700;">RED</span> | <span style="color:#ef4444;font-weight:700;">RED</span> | <span style="color:#ef4444;font-weight:700;">RED</span> | <span style="color:#ef4444;font-weight:700;">RED</span> | <span style="color:#f59e0b;font-weight:700;">YELLOW</span> |
| **Setup (P1.1)** | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> |
| **Live Interview UI** | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> |
| **Live Interview Persona** | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#ef4444;font-weight:700;">RED</span> | <span style="color:#ef4444;font-weight:700;">RED</span> | <span style="color:#ef4444;font-weight:700;">RED</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> |
| **Report Dimensions** | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> |
| **Report Guidance** | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#ef4444;font-weight:700;">RED</span> | <span style="color:#ef4444;font-weight:700;">RED</span> | <span style="color:#ef4444;font-weight:700;">RED</span> | <span style="color:#ef4444;font-weight:700;">RED</span> | <span style="color:#ef4444;font-weight:700;">RED</span> |
| **Jobs Board** | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#ef4444;font-weight:700;">RED</span> (0 jobs) | <span style="color:#f97316;font-weight:700;">ORANGE</span> (1 job) | <span style="color:#ef4444;font-weight:700;">RED</span> (0 jobs) | <span style="color:#ef4444;font-weight:700;">RED</span> (0 jobs) | <span style="color:#f97316;font-weight:700;">ORANGE</span> |
| **QBank** | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#10b981;font-weight:700;">GREEN</span> |
| **Dashboard** | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#f59e0b;font-weight:700;">YELLOW</span> | <span style="color:#f59e0b;font-weight:700;">YELLOW</span> | <span style="color:#f59e0b;font-weight:700;">YELLOW</span> | <span style="color:#f59e0b;font-weight:700;">YELLOW</span> | <span style="color:#f59e0b;font-weight:700;">YELLOW</span> |
| **Progress Metrics** | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> |
| **Profile & CV** | <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> | <span style="color:#f97316;font-weight:700;">ORANGE</span> |
| **Roadmap Services**| <span style="color:#10b981;font-weight:700;">GREEN</span> | <span style="color:#f59e0b;font-weight:700;">YELLOW</span> | <span style="color:#f59e0b;font-weight:700;">YELLOW</span> | <span style="color:#f59e0b;font-weight:700;">YELLOW</span> | <span style="color:#f59e0b;font-weight:700;">YELLOW</span> | <span style="color:#f59e0b;font-weight:700;">YELLOW</span> |

*Legend:*  
- **GREEN:** Context-aware, fully supported.  
- **YELLOW:** Generic but acceptable.  
- **ORANGE:** Noticeable SWE-biased presentation/labeling.  
- **RED:** Hardcoded SWE defaults, incorrect persona, or total data absence.

---

## 21. END-TO-END ROLE SIMULATION MATRIX

Simulating the 4 mandatory test cases through the entire pipeline:

### Case A — Marketing Specialist @ Unilever
- **Setup:** Inputs accepted cleanly. Role and company correctly stored.
- **Session & Question:** Backend receives role, but `InterviewerPersona.CreateDefault` creates `Senior Engineer / Tech Lead Interviewer`. Question prompt instructs interviewer: *"Hãy nói như một Tech Lead thật sự"*.
- **Debrief & Report:** Debrief modal labels primary metric `"Kỹ thuật"`. Report labels Dimension 1 `"Kiến thức Kỹ thuật"` (`⚙️`). Preparation item instructs candidate to clarify scope on *"bài toán thiết kế hệ thống hoặc coding"* before answering!
- **Evaluation Status:** **FAILED DOMAIN CONTEXT.**

### Case B — Financial Analyst @ Vietcombank
- **Setup:** Inputs accepted cleanly.
- **Session & Question:** Persona defaults to Tech Lead. Follow-up style instructs to challenge on *"trade-offs and architecture"*.
- **Debrief & Report:** Radar chart axis is titled `"Kỹ thuật"`. Preparation item recommends: *"Mô phỏng System Design & High Availability"*.
- **Evaluation Status:** **FAILED DOMAIN CONTEXT.**

### Case C — Business Analyst @ FPT
- **Setup:** Inputs accepted cleanly.
- **Session & Question:** BA role receives Tech Lead persona. System design bias clashes with business requirements and process engineering.
- **Debrief & Report:** Report dimension displays gear icon (`⚙️`) with "Fact kỹ thuật chuẩn".
- **Evaluation Status:** **PARTIAL CONTEXT FAILURE.**

### Case D — Software Engineer @ Google
- **Setup:** Inputs accepted cleanly.
- **Session & Question:** Persona matches perfectly (`Tech Lead`). Question prompts match domain. Follow-up and trade-off challenges are natural.
- **Debrief & Report:** "Kiến thức Kỹ thuật", "System Design", and coding guidance align 100% with domain requirements.
- **Evaluation Status:** **PASSED DOMAIN CONTEXT.**

---

## 22. DETAILED FINDINGS BY SEVERITY

---

### P1.3-001 — Backend InterviewerPersona.CreateDefault Assigns Tech Lead to All Non-HR Roles

Location:
`BE/Models/Interview/InterviewerPersona.cs` (`CreateDefault`, lines 21–51)

Current behavior:
The method checks only for "HR", "Talent", or "Recruiter". Any other position—such as Marketing, Finance, Business Analyst, Sales, Logistics, or Healthcare—returns `Role = "Senior Engineer / Tech Lead Interviewer"` with `FollowUpStyle = "Drill into practical implementation, architectural decisions, and trade-offs"` and `ChallengeStyle = "System scale x10, bottleneck identification, failure recovery"`.

Expected behavior:
Persona factory should map candidate target position to an industry-appropriate interviewer persona (e.g., Marketing Director, Financial Controller, Business Operations Lead, Senior Product Lead) or provide a neutral Senior Hiring Manager persona.

Affected roles:
Marketing, Finance, Business Analysis, Sales, Customer Success, Legal, Operations, Healthcare.

Classification:
D — Incorrect context

Severity:
P0

Evidence:
```csharp
var isHr = targetPosition.Contains("HR", ...) || targetPosition.Contains("Talent", ...);
if (isHr) return new InterviewerPersona { Role = "HR / Culture & Behavioral Interviewer", ... };
return new InterviewerPersona { Role = "Senior Engineer / Tech Lead Interviewer", ... };
```

Recommendation:
Introduce a multi-family persona mapping in `InterviewerPersona.cs` with proper fallback to `Professional Domain Interviewer / Department Lead`.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-002 — Backend Evaluation & Interview Services Hardcode Fallback TargetPosition to "Software Engineer"

Location:
`BE/Prompts/Interview/CandidateQuestionPrompt.cs` (line 26)  
`BE/Services/Evaluation/FinalEvaluationService.cs` (line 46)  
`BE/Services/Evaluation/InterviewPerformanceService.cs` (line 23)  
`BE/Services/Evaluation/ImprovementRoadmapService.cs` (line 20)  
`BE/Services/Interview/BehavioralInterviewService.cs` (lines 35, 126)  
`BE/Services/Interview/SituationalInterviewService.cs` (lines 33, 123)  

Current behavior:
When `session.JobTitle` or `context.TargetPosition` is null or whitespace, the fallback role is explicitly hardcoded as `"Software Engineer"`.

Expected behavior:
Fallback should be a neutral token such as `"Chuyên viên"` or `"Ứng viên chuyên nghiệp"`, or reject evaluation if job title is absent.

Affected roles:
All non-SWE roles in degraded or legacy session states.

Classification:
C — SWE-biased default

Severity:
P0

Evidence:
```csharp
sb.AppendLine($"Vị trí ứng tuyển: {session.JobTitle ?? context?.TargetPosition ?? "Software Engineer"}");
```

Recommendation:
Replace `"Software Engineer"` fallback with `"Chuyên viên chuyên môn"` or throw `InvalidOperationException` if session metadata is missing.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-003 — InterviewPreparationService Injects Hardcoded System Design & Coding Guidance Regardless of Role

Location:
`BE/Services/Preparation/InterviewPreparationService.cs` (lines 472, 484, 549)

Current behavior:
Generates static preparation guidance for all candidates:
- Line 472: *"Trước khi trả lời bài toán thiết kế hệ thống hoặc coding, luôn đặt 1-2 câu hỏi làm rõ phạm vi: scale người dùng, throughput kỳ vọng, latency SLA và các ràng buộc dữ liệu."*
- Line 484: *"Chuẩn bị 2-3 câu hỏi thông minh thể hiện tầm nhìn: Văn hóa xử lý tech debt, lộ trình nâng cấp kiến trúc..."*
- Line 549: `FocusArea = isSenior ? "Mô phỏng System Design & High Availability" : "Mô phỏng Kỹ thuật Tổng hợp & Coding Best Practices"`

Expected behavior:
Preparation items and mock interview recommendations should adapt to candidate domain (e.g. Marketing campaigns & CAC/LTV, Financial statement auditing & DCF modeling, Sales pipeline & objection handling).

Affected roles:
100% of non-SWE candidates receiving debrief reports.

Classification:
D — Incorrect context

Severity:
P0

Evidence:
Inspected lines 472, 484, and 549 in `BE/Services/Preparation/InterviewPreparationService.cs`.

Recommendation:
Refactor preparation guidance generator to branch on `JobFamily` or prompt Gemini for domain-adapted preparation strategies.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-004 — CareerRoadmapService and JobRecommendationService Fallback to "Developer"

Location:
`BE/Services/AI/CareerRoadmapService.cs` (line 46)  
`BE/Services/AI/JobRecommendationService.cs` (line 46)  

Current behavior:
Prompt templates specify:
`Dựa vào hồ sơ ứng viên và vị trí: {{request.JobTitle ?? "Developer"}}`

Expected behavior:
If `JobTitle` is not provided in CV request, prompt should state:
`Dựa vào hồ sơ ứng viên và kinh nghiệm thể hiện trong CV...` without imposing "Developer".

Affected roles:
Non-SWE CV analysis requests with unpopulated target title.

Classification:
C — SWE-biased default

Severity:
P0

Evidence:
Inspected lines 46 in both services.

Recommendation:
Remove `"Developer"` fallback; use contextual extraction from CV text when `JobTitle` is omitted.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-005 — Frontend getMockQuestionsForJob Falls Back to "Frontend Developer" (React/Vue/Angular)

Location:
`FE/shared/js/main.js` (lines 292, 547)

Current behavior:
When offline or when backend is unreachable, `getMockQuestionsForJob(jobTitle)` attempts keyword matching. If the position is unmapped or blank, it executes:
`return MOCK_QUESTIONS["Frontend Developer"];`
Asking the user: *"Sự khác biệt giữa React, Vue, và Angular là gì?"*.

Expected behavior:
Fallback should return a neutral behavioral/competence question set (e.g., STAR self-introduction, conflict resolution, work achievement).

Affected roles:
Any candidate in offline mode with an unmapped job title.

Classification:
C — SWE-biased default / D — Incorrect context

Severity:
P0

Evidence:
Lines 292 and 547 in `FE/shared/js/main.js`.

Recommendation:
Replace fallback dictionary key with `"General Professional"` questions.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-006 — QuestionPrompt.cs Enforces Tech Lead Tone and System Scale Examples

Location:
`BE/Prompts/Interview/QuestionPrompt.cs` (lines 122, 194, 197)

Current behavior:
Prompt instructs LLM:
- Line 122: *"Hãy nói như một Tech Lead thật sự."*
- Line 194: *"Bạn là một Tech Lead / Interviewer thật sự ngồi trước mặt ứng viên."*
- Line 197: Gives example probe: *"Giả sử traffic tăng gấp 10 lần thì sao?".*

Expected behavior:
System prompt should instruct: *"Hãy nói như một Trưởng bộ phận / Người phỏng vấn chuyên nghiệp"* and use domain-appropriate probing examples.

Affected roles:
All non-SWE interview sessions.

Classification:
C — SWE-biased default

Severity:
P1

Evidence:
Direct strings in `BE/Prompts/Interview/QuestionPrompt.cs`.

Recommendation:
Parameterize prompt instructions with `persona.Role` and remove hardcoded "Tech Lead" strings.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-007 — Report Presentation Labels Dimension 1 as "Kiến thức Kỹ thuật" with Gear Icon (⚙️)

Location:
`FE/features/report/report.js` (lines 296, 331)  
`FE/features/report/report.html` (lines 194, 212, 345)  

Current behavior:
`STANDARD_DIMENSIONS[0]` renders as:
`{ key: "TECHNICAL_KNOWLEDGE", name: "Kiến thức Kỹ thuật", icon: "⚙️" }`
Report header claims: *"Fact kỹ thuật chuẩn"* and *"Phân tích toàn diện cách ứng viên thể hiện tư duy, kỹ thuật..."*.

Expected behavior:
The dimension should be presented as `"Kiến thức Chuyên môn"` (Domain / Professional Knowledge) with a neutral icon (e.g. `🎯` or `📚`), reflecting the backend's naming of `"Kiến thức chuyên môn (Technical Knowledge)"`.

Affected roles:
All non-technical candidates viewing their evaluation report.

Classification:
C — SWE-biased default

Severity:
P1

Evidence:
Lines 296 in `report.js` and lines 194, 212 in `report.html`.

Recommendation:
Update label in `STANDARD_DIMENSIONS` to `"Kiến thức Chuyên môn"` and icon to `🎯`.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-008 — Landing Page Hero and 4-Step Panes Exclusively Feature Senior Backend Examples

Location:
`FE/index.html` (lines 75–150, 265–365)

Current behavior:
The landing mockup and all 4 workflow step visualizations depict:
- `Senior Backend Engineer`, `FPT Software`
- `Redis Cache`, `Cache Stampede`, `Distributed Lock`
- `100,000 CCU`, `Bottleneck`
- `Apache Kafka`, `Idempotency`
- `Deadlock`

Expected behavior:
Landing page should rotate or display diverse professional examples (e.g., Marketing Campaign ROI, Financial Risk Assessment, Supply Chain Bottleneck, Software Architecture).

Affected roles:
Prospective non-tech users evaluating the platform.

Classification:
F — Demo/sample content / G — Potentially misleading marketing claim

Severity:
P1

Evidence:
Inspected lines in `FE/index.html`.

Recommendation:
Introduce dynamic role tabs or multi-domain rotating cards in the landing hero mockup and workflow section.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-009 — Jobs Board Has 75% Tech Representation and 0 Business/Finance/HR Jobs

Location:
`FE/features/jobs/jobs.html` (lines 1170–1300)

Current behavior:
9 of 12 jobs are IT/Dev/DevOps/AI. The filter `<option value="business">Kinh doanh / Tài chính / HR</option>` returns zero matching jobs.

Expected behavior:
Job catalog should include realistic representative mock jobs for Business Analyst, Financial Analyst, HR Specialist, and B2B Sales.

Affected roles:
Candidates exploring jobs outside software development.

Classification:
F — Demo/sample content

Severity:
P1

Evidence:
Inspected `jobs.html` array of 12 jobs.

Recommendation:
Add 4–6 balanced job entries in finance, business analysis, and human resources.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-010 — Live Interview Fallback Job Title and Debrief Metric Hardcoded to "Kỹ thuật"

Location:
`FE/features/interview/interview.js` (lines 2628, 2854)

Current behavior:
- Line 2628: `const jobTitle = currentInterviewSession?.jobTitle || "Chuyên viên Kỹ thuật";`
- Line 2854: `<span class="debrief-metric-label">Kỹ thuật</span>`

Expected behavior:
- Fallback job title should be `"Chuyên viên chuyên môn"` or `"Ứng viên"`.
- Debrief modal metric label should read `"Chuyên môn"`.

Affected roles:
Non-SWE candidates completing interviews.

Classification:
C — SWE-biased default

Severity:
P1

Evidence:
Inspected lines 2628 and 2854 in `interview.js`.

Recommendation:
Change fallback string to `"Chuyên viên chuyên môn"` and metric label to `"Chuyên môn"`.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-011 — Progress Radar Chart Axis Labeled "Kỹ thuật"

Location:
`FE/features/progress/progress.html` (lines 1612, 1673)

Current behavior:
Radar chart displays axes:
`labels: ['Kỹ thuật', 'Giao tiếp', 'Kỹ năng mềm', 'STAR', 'Tổng thể']`

Expected behavior:
The first axis should be labeled `'Chuyên môn'` (Professional Competence).

Affected roles:
All candidates tracking progress across non-engineering disciplines.

Classification:
C — SWE-biased default

Severity:
P1

Evidence:
Line 1673 in `progress.html`.

Recommendation:
Update radar chart labels array to `['Chuyên môn', 'Giao tiếp', 'Kỹ năng mềm', 'STAR', 'Tổng thể']`.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-012 — Profile CV Page Demonstrates 100% Frontend Developer Mock Skills

Location:
`FE/features/profile/cv.html` (lines 218–235)

Current behavior:
Pre-rendered skills under *"Kỹ năng AI đã nhận diện"* include React, TypeScript, Next.js, Tailwind, REST API, Git, Docker, CI/CD, Vite.

Expected behavior:
Demonstration should show diverse domain skills or an empty state until the candidate uploads their CV.

Affected roles:
Non-developer candidates visiting CV profile page.

Classification:
F — Demo/sample content

Severity:
P2

Evidence:
Lines 218–235 in `cv.html`.

Recommendation:
Replace hardcoded React/Docker chips with dynamic rendering from uploaded CV, or show a domain-neutral preview.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-013 — Profile Target Role Input Placeholder Defaults to "Senior Backend Engineer"

Location:
`FE/features/profile/profile.html` (line 89)

Current behavior:
`<input type="text" id="target-role" placeholder="Ví dụ: Senior Backend Engineer">`

Expected behavior:
Placeholder should read: `"Ví dụ: Business Analyst, Marketing Manager, Senior Backend Engineer..."`.

Affected roles:
Users setting up profile target career.

Classification:
C — SWE-biased default

Severity:
P2

Evidence:
Line 89 in `profile.html`.

Recommendation:
Update placeholder to list multi-industry examples.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-014 — Setup Page Fallback Company Defaults to "Doanh nghiệp công nghệ"

Location:
`FE/features/interview/interview-info.html` (lines 1891, 1960)

Current behavior:
`const company = document.getElementById('company-name')?.value.trim() || 'Doanh nghiệp công nghệ';`

Expected behavior:
Fallback should be `"Doanh nghiệp mục tiêu"` or `"Doanh nghiệp tuyển dụng"`.

Affected roles:
Candidates not specifying a company name.

Classification:
C — SWE-biased default

Severity:
P2

Evidence:
Lines 1891 and 1960 in `interview-info.html`.

Recommendation:
Change fallback string to `'Doanh nghiệp mục tiêu'`.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-015 — Dashboard Fallback Company Defaults to 'Doanh nghiệp Tech'

Location:
`FE/features/dashboard/dashboard.js` (line 566)

Current behavior:
`const compName = session.company || 'Doanh nghiệp Tech';`

Expected behavior:
Fallback should be `'Doanh nghiệp tuyển dụng'`.

Affected roles:
Candidates viewing completed sessions on dashboard.

Classification:
C — SWE-biased default

Severity:
P2

Evidence:
Line 566 in `dashboard.js`.

Recommendation:
Change fallback string to `'Doanh nghiệp tuyển dụng'`.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-016 — QBank Search Input Placeholder Suggests Developer Keywords

Location:
`FE/features/qbank/qbank.html` (line 1081)

Current behavior:
`placeholder="Tìm theo câu hỏi, vị trí, từ khóa (VD: Deadlock, React, B2B)..."`

Expected behavior:
`placeholder="Tìm theo câu hỏi, vị trí, từ khóa (VD: B2B, STAR, Marketing, Kế toán, React)..."`

Affected roles:
Candidates searching the question bank.

Classification:
B — Generic but acceptable / C — SWE-biased default

Severity:
P3

Evidence:
Line 1081 in `qbank.html`.

Recommendation:
Rebalance example keywords to cover diverse professions.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

### P1.3-017 — Admin Question Role Placeholder Defaults to Backend Developer

Location:
`FE/features/admin/admin.html` (line 1420)

Current behavior:
`placeholder="Ví dụ: Backend Developer (Golang / Java)"`

Expected behavior:
`placeholder="Ví dụ: Chuyên viên Phân tích Dữ liệu, Backend Developer, Marketing Manager..."`

Affected roles:
Administrators adding custom curriculum questions.

Classification:
C — SWE-biased default

Severity:
P3

Evidence:
Line 1420 in `admin.html`.

Recommendation:
Broaden placeholder example string.

Implementation:
NOT IMPLEMENTED IN THIS AUDIT

---

## 23. RECOMMENDED FIX ORDER (FOR FUTURE IMPLEMENTATION PHASE)

When an implementation phase is authorized, fixes should be executed in this order:

1. **Phase 1 — Core Context & Persona Factory (P0):**
   - Remediate `InterviewerPersona.CreateDefault` in `BE/Models/Interview/InterviewerPersona.cs` to support industry-specific personas (Marketing, Finance, Business Analysis, Sales, Operations, Neutral Manager).
   - Eliminate hardcoded `"Software Engineer"` fallbacks in `CandidateQuestionPrompt.cs`, `FinalEvaluationService.cs`, `InterviewPerformanceService.cs`, `BehavioralInterviewService.cs`, and `SituationalInterviewService.cs`.
2. **Phase 2 — Preparation Plan & Prompt Remediation (P0 / P1):**
   - Refactor `InterviewPreparationService.cs` to eliminate hardcoded system design, SLA, latency, and coding guidance for non-SWE roles.
   - Remove `"Hãy nói như một Tech Lead thật sự"` and scale x10 assumptions from `QuestionPrompt.cs`.
   - Neutralize fallbacks in `CareerRoadmapService.cs` and `JobRecommendationService.cs`.
3. **Phase 3 — Debrief & Report Harmonization (P1):**
   - Rename `"Kiến thức Kỹ thuật"` $\rightarrow$ `"Kiến thức Chuyên môn"` and update gear icon (`⚙️`) $\rightarrow$ `🎯` in `report.js`.
   - Update debrief modal in `interview.js` line 2854 and radar chart axis in `progress.html` line 1673 from `"Kỹ thuật"` $\rightarrow$ `"Chuyên môn"`.
4. **Phase 4 — Public Presentation & Catalog Balance (P1 / P2):**
   - Diversify landing page visual mockups in `FE/index.html` to showcase Marketing, Finance, and Business roles alongside Tech.
   - Populate missing business/finance/HR mock job cards in `jobs.html`.
   - Neutralize default company and role placeholders in `interview-info.html`, `dashboard.js`, `profile.html`, and `cv.html`.

---

## 24. DEFERRED ITEMS

- **Deep Automated CV Parsing for Non-Technical Certificates:** Parsing specialized CPA, CFA, ACCA, PMP credentials into structured competency blueprints is deferred to future AI model capability updates.
- **Dynamic AI Video Avatars for Diverse Industries:** Tailoring visual attire of avatars (e.g., suit and tie for banking, casual for tech) is deferred as the current neutral 2D canvas avatar is professional and functional.

---

## 25. OUT OF SCOPE

- Rewriting the core Gemini integration architecture.
- Altering the REST API contracts between frontend and backend.
- Modifying the sealed TTS lifecycle and state machine in Live Interview.
- Changing database schema or entity relationships.

---

## 26. FINAL VERDICT

Per the strict verdict rules defined in Section 28 of the audit mandate:
- *Condition for PASS:* 0 P0 findings, all P1 identified, context propagation traced, industry matrix complete, regressions passing.
- *Condition for CONDITIONAL PASS:* 0 P0 findings, but P1/P2 findings remain.
- *Condition for BLOCKED:* Any P0 finding remains unresolved.

Because this audit uncovered **5 critical P0 architectural and semantic context failures** (`P1.3-001`, `P1.3-002`, `P1.3-003`, `P1.3-004`, `P1.3-005`) that corrupt the interviewer persona, evaluation criteria, and preparation roadmap for all non-software candidates:

```text
================================================================================
   FINAL VERDICT: P1.3 AUDIT — BLOCKED
================================================================================
   Reason: 5 Critical P0 context corruption vulnerabilities identified.
   Status: Strictly Read-Only Audit Completed. Zero code modified.
   Baseline: 100% Passing (Setup: 20/20, Live: 12/12, Flow: 30/30, Report: 67/67, BE: 0W/0E).
================================================================================
```
