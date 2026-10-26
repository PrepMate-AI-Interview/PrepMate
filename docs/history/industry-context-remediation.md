# PREPMATE — P1.3 WAVE A CONTEXT CORE REMEDIATION REPORT

**Author:** Senior Principal Software Architect + Backend/AI Context Engineer  
**Date:** October 2026  
**Status:** **SEALED & VERIFIED** (0 Failures, 0 Warnings, 0 Regressions)

---

## 1. Executive Summary

PrepMate completed **P1.3 Wave A — Context Core Remediation**. Prior to this wave, the core interview context pipeline harbored hardcoded Software Engineering (SWE) assumptions:
* Fallback titles defaulted universally to `"Software Engineer"` or `"Developer"`.
* Default interviewer personas were locked to `"Senior Technical Interviewer / Tech Lead"`.
* AI system prompts contained directives such as `"Hãy nói như một Tech Lead thật sự"` and forced microservices/Redis database examples regardless of the candidate's actual profession.
* Candidate question answering explicitly referenced technical interview bounds (`"phạm vi phỏng vấn kỹ thuật"`).
* Frontend offline fallback returned 4 React/Vue/GraphQL questions for every non-IT candidate.

**Wave A Resolution:**
1. Established a 12-domain professional taxonomy (`JobFamily.cs`) and deterministic keyword/regex classification engine (`ProfessionalDomainClassifier`).
2. Transformed `InterviewerPersona.cs` into a dynamic domain-aware factory matching 12 specific industry leadership roles.
3. Completely neutralized `QuestionPrompt.cs` to gate technical depth, tone directives, clarification queries, challenge scenarios, and transition examples by profession.
4. Purged hardcoded `"Software Engineer"` and `"Developer"` fallbacks across all 8 backend evaluation, interview, preparation, and AI roadmap services, binding them to `ProfessionalDomainClassifier.DefaultPositionTitle` (`"Chuyên viên chuyên môn"`).
5. Domain-gated preparation scoping, clarification advice, and mock interview scenario recommendations in `InterviewPreparationService.cs`.
6. Enriched frontend offline questions (`FE/shared/js/main.js`) with a 6-question universal professional bank (`MOCK_QUESTIONS["General Professional"]`) and neutralized fallback labels in `interview.js`.
7. Engineered a 54-test automated verification suite (`test_industry_context.js`) proving end-to-end neutrality across 6 multi-industry test scenarios (Cases A–F) with **54/54 PASS**.

---

## 2. Sealed Baseline Verification

Before and after Wave A changes, all sealed verification test suites and build scripts executed with zero regressions:

| Verification Suite / Artifact | Scope | Baseline Before Wave A | Result After Wave A | Delta |
| :--- | :--- | :--- | :--- | :--- |
| `dotnet build BE/backend.csproj` | .NET 10 Solution Compilation | 0 Warning, 0 Error | **0 Warning, 0 Error** | Clean |
| `test_interview_setup_ux.js` | 4-step setup UX, inputs, chips | 20 / 20 PASS | **20 / 20 PASS** | 0 regressions |
| `test_live_interview_ux.js` | Live interview room UI/UX & agenda | 12 / 12 PASS | **12 / 12 PASS** | 0 regressions |
| `test_interview_flow.js` | Audio/TTS, state machine, timers, API | 30 / 30 PASS | **30 / 30 PASS** | 0 regressions |
| `test_report_ui.js` | 6 dimensions, checklist, localStorage | 67 / 67 PASS | **67 / 67 PASS** | 0 regressions |
| `test_industry_context.js` | 12 domains, personas, prompts, cases A–F | *New in Wave A* | **54 / 54 PASS** | Complete coverage |

---

## 3. Professional Domain Taxonomy & Classification Architecture (`JobFamily.cs`)

Located in [`BE/Models/Interview/JobFamily.cs`](../../BE/Models/Interview/JobFamily.cs), the taxonomy defines 12 standard job families and a deterministic classifier:

```csharp
public enum JobFamily
{
    SOFTWARE_ENGINEERING,
    DATA_ANALYTICS,
    PRODUCT_PROJECT,
    BUSINESS_ANALYSIS,
    MARKETING_GROWTH,
    SALES_BUSINESS_DEVELOPMENT,
    FINANCE_ACCOUNTING,
    HR_PEOPLE,
    DESIGN_UX,
    OPERATIONS_SUPPLY_CHAIN,
    CUSTOMER_SUCCESS,
    GENERAL_PROFESSIONAL
}
```

### Deterministic Classifier Highlights
* **Diacritics Normalization:** Strips Vietnamese diacritics using Unicode `FormD` + non-spacing mark regex (`\p{IsCombiningDiacriticalMarks}+`), converting all tokens to clean lowercase ASCII.
* **Regex / Keyword Boundary Matching:** Matches multi-word profession patterns safely without false positives (e.g., distinguishing "business analyst" from generic "analyst").
* **Canonical Default:** `ProfessionalDomainClassifier.DefaultPositionTitle = "Chuyên viên chuyên môn"` provides a culturally natural, industry-neutral Vietnamese default position title.

---

## 4. Dynamic Interviewer Persona Adaptation Engine (`InterviewerPersona.cs`)

Updated [`BE/Models/Interview/InterviewerPersona.cs`](../../BE/Models/Interview/InterviewerPersona.cs):
* Replaced static singleton with `CreateDefault(string targetPosition)` dynamic factory.
* Default persona title changed from `"Senior Technical Interviewer / Tech Lead"` to `"Senior Hiring Manager / Professional Interviewer"`.

### Persona Matrix Mappings
1. **SOFTWARE_ENGINEERING:** `Senior Engineering Interviewer / Tech Lead` (Focus: system scale, architecture, concurrency, trade-offs).
2. **DATA_ANALYTICS:** `Data & Analytics Lead Interviewer` (Focus: methodological rigor, metric selection, data anomalies, causal inference).
3. **BUSINESS_ANALYSIS:** `Business Analysis Lead Interviewer` (Focus: requirements elicitation, edge cases, scope creep, stakeholder conflicts).
4. **MARKETING_GROWTH:** `Marketing & Growth Director Interviewer` (Focus: campaign ROI, CAC/LTV, channel attribution, conversion bottlenecks).
5. **SALES_BUSINESS_DEVELOPMENT:** `Sales & Commercial Director Interviewer` (Focus: commercial acumen, qualification, objection handling, closing).
6. **FINANCE_ACCOUNTING:** `Finance Controller & Senior Auditor Interviewer` (Focus: financial precision, liquidity shocks, audit compliance, variance analysis).
7. **HR_PEOPLE:** `HR Director / People & Culture Interviewer` (Focus: talent retention, organizational dynamics, conflict resolution, labor regulations).
8. **DESIGN_UX:** `Design Director & UX Lead Interviewer` (Focus: user empathy, design systems, usability trade-offs, developer handoff).
9. **PRODUCT_PROJECT:** `Head of Product & Program Management Interviewer` (Focus: product discovery, backlog prioritization, stakeholder alignment).
10. **OPERATIONS_SUPPLY_CHAIN:** `Operations & Supply Chain Director Interviewer` (Focus: operational efficiency, supply chain bottlenecks, vendor SLAs).
11. **CUSTOMER_SUCCESS:** `Head of Customer Success & Experience Interviewer` (Focus: CSAT/NPS, escalation de-escalation, churn reduction).
12. **GENERAL_PROFESSIONAL:** `Senior Hiring Manager / Professional Interviewer` (Focus: competency-based inquiry, resource management, goal execution).

---

## 5. Context Pipeline Remediation (`InterviewContextBuilder.cs`)

In [`BE/Services/Context/InterviewContextBuilder.cs`](../../BE/Services/Context/InterviewContextBuilder.cs):
* Session context builder previously allowed `context.Industry` to remain blank or untyped.
* Updated fallback logic to automatically populate `context.Industry` and `aiContext.Industry` using `ProfessionalDomainClassifier.Classify(request.TargetPosition).ToString()` whenever industry is not explicitly supplied in request payloads.
* Bound initial persona to `InterviewerPersona.CreateDefault(request.TargetPosition)`.

---

## 6. Adaptive Question Prompt Domain Gating (`QuestionPrompt.cs`)

Remediated [`BE/Prompts/Interview/QuestionPrompt.cs`](../../BE/Prompts/Interview/QuestionPrompt.cs):
1. **Persona Directive Neutralization:**
   * Removed: `"Hãy nói như một Tech Lead thật sự..."`
   * Replaced with: `$"Hãy đối thoại đĩnh đạc, tự nhiên đúng với vị thế người phỏng vấn ({persona.Role}). Không dùng lời khen sáo rỗng hoặc câu chào mừng máy móc."`
2. **Domain-Gated Expected Lines:**
   * Software Engineering: Architecture decisions, data modeling, concurrency, failure modes, trade-offs.
   * Non-SWE: Specific methodology, execution evidence, measurable KPIs, risk management, trade-offs.
3. **Tone Directive Domain-Gating:**
   * Direct, analytical, solution-focused for SWE/Analytics.
   * Strategic, commercially focused for Marketing/Sales/Finance.
   * Methodical, empathetic for HR/Operations/General.
4. **Transition Examples Neutralized:**
   * Eliminated unconditional references to "Redis caching", "database bottleneck", or "microservice communication".
   * Replaced with domain-appropriate transition examples reflecting the candidate's actual job family.

---

## 7. Candidate Question Reverse Prompt Remediation (`CandidateQuestionPrompt.cs`)

Remediated [`BE/Prompts/Interview/CandidateQuestionPrompt.cs`](../../BE/Prompts/Interview/CandidateQuestionPrompt.cs):
* Replaced line 26: `session.JobTitle ?? context?.TargetPosition ?? "Software Engineer"` $\rightarrow$ `ProfessionalDomainClassifier.DefaultPositionTitle`.
* Neutralized line 51: `"Khu vực công nghệ / Blueprint Areas:"` $\rightarrow$ `"Khu vực chuyên môn / Blueprint Areas:"`.
* Neutralized line 63: `"trong phạm vi phỏng vấn kỹ thuật"` $\rightarrow$ `"trong phạm vi phỏng vấn chuyên môn"`.

---

## 8. Evaluation Service Fallback Normalization

Purged `"Software Engineer"` fallbacks across core evaluation engines:
* **`BE/Services/Evaluation/FinalEvaluationService.cs`:** Bound line 46 fallback `TargetPosition` to `ProfessionalDomainClassifier.DefaultPositionTitle`.
* **`BE/Services/Evaluation/InterviewPerformanceService.cs`:** Bound line 23 fallback `TargetPosition` to `ProfessionalDomainClassifier.DefaultPositionTitle`.
* **`BE/Services/Evaluation/ImprovementRoadmapService.cs`:** Bound line 20 fallback `TargetPosition` to `ProfessionalDomainClassifier.DefaultPositionTitle`.

---

## 9. Behavioral & Situational Engine Neutralization

Remediated [`BE/Services/Interview/BehavioralInterviewService.cs`](../../BE/Services/Interview/BehavioralInterviewService.cs) and [`BE/Services/Interview/SituationalInterviewService.cs`](../../BE/Services/Interview/SituationalInterviewService.cs):
* Lines 35 & 126 in Behavioral Service: replaced `session.JobTitle ?? "Software Engineer"` with `ProfessionalDomainClassifier.DefaultPositionTitle`.
* Lines 33 & 123 in Situational Service: replaced `session.JobTitle ?? "Software Engineer"` with `ProfessionalDomainClassifier.DefaultPositionTitle`.
* Prompt generators now supply the genuine profession or `"Chuyên viên chuyên môn"` to Gemini LLM for STAR and Situational synthesis.

---

## 10. AI Career Guidance Fallback Alignment

Remediated AI auxiliary services:
* **`BE/Services/AI/CareerRoadmapService.cs`:** Line 46 `{{request.JobTitle ?? "Developer"}}` $\rightarrow$ `{{request.JobTitle ?? ProfessionalDomainClassifier.DefaultPositionTitle}}`.
* **`BE/Services/AI/JobRecommendationService.cs`:** Line 46 `{{request.JobTitle ?? "Developer"}}` $\rightarrow$ `{{request.JobTitle ?? ProfessionalDomainClassifier.DefaultPositionTitle}}`.

---

## 11. Preparation & Mock Recommendation Strategy Remodeling (`InterviewPreparationService.cs`)

Updated [`BE/Services/Preparation/InterviewPreparationService.cs`](../../BE/Services/Preparation/InterviewPreparationService.cs):
1. **Fallback Normalization:** Line 20 now utilizes `ProfessionalDomainClassifier.DefaultPositionTitle`.
2. **Domain-Gated Scoping Clarification Guidance:**
   * Tech (`SOFTWARE_ENGINEERING`, `DATA_ANALYTICS`): Scale, throughput, latency SLA, data constraints.
   * Non-Tech: Business context, primary goals, available resources, and key stakeholders.
3. **Domain-Gated Questions for Interviewer:**
   * Tech: Tech debt culture, architectural upgrade roadmap, technical success metrics.
   * Non-Tech: Department strategic goals, cross-functional collaboration culture, role success metrics.
4. **Domain-Gated Mock Interview Recommendations:**
   * `SOFTWARE_ENGINEERING`: System Design & High Availability / Coding Best Practices.
   * `MARKETING_GROWTH`: Growth Strategy & Budget Allocation / Campaign Planning & Channel Analytics.
   * `FINANCE_ACCOUNTING`: Financial Governance & Capital Strategy / Financial Statements & Cost Control.
   * `BUSINESS_ANALYSIS`: Product Planning & Stakeholder Management / Requirements Specification & Backlog Management.
   * `SALES_BUSINESS_DEVELOPMENT`: Market Expansion & Enterprise Deal Negotiation / B2B Sales Pipeline & Objection Handling.
   * `HR_PEOPLE`: Organizational Development & Talent Strategy / Recruitment & Employee Engagement.
   * `GENERAL_PROFESSIONAL`: Strategic Leadership & Domain Planning / Comprehensive Professional Mock Interview.

---

## 12. Frontend Offline & Default Mock Questions Remediation (`FE/shared/js/main.js`)

In [`FE/shared/js/main.js`](../../FE/shared/js/main.js):
1. Added `MOCK_QUESTIONS["General Professional"]` containing 6 universal competency questions:
   - Tổng quan bản thân, kinh nghiệm & thế mạnh nổi bật.
   - Mục tiêu / dự án quan trọng hoàn thành xuất sắc & đóng góp cá nhân.
   - Phương pháp ưu tiên & xử lý khi phát sinh sự cố / deadline gấp.
   - Thuyết phục đồng nghiệp / đối tác đồng thuận với đề xuất.
   - Phương pháp liên tục cập nhật kiến thức & nâng cao chuyên môn.
   - Mục tiêu phát triển sự nghiệp trong 2-3 năm tới.
2. Prioritized `Business Analyst` keyword recognition above generic `analyst` (Data Scientist).
3. Added explicit `Frontend Developer` keyword matcher before backend matching.
4. Updated empty/null and ultimate default fallbacks in `getMockQuestionsForJob(jobTitle)` to return `MOCK_QUESTIONS["General Professional"]` instead of `"Frontend Developer"`.

---

## 13. Live Interview Debrief Fallback Alignment (`FE/features/interview/interview.js`)

In [`FE/features/interview/interview.js`](../../FE/features/interview/interview.js):
* Line 2628: Default `jobTitle` fallback updated from `"Chuyên viên Kỹ thuật"` to `"Chuyên viên chuyên môn"`.
* Line 2854: Debrief metric score card label neutralized from `"Kỹ thuật"` to `"Chuyên môn"`.

---

## 14. Automated Industry-Neutral Verification Suite (`test_industry_context.js`)

Created [`tests/regression/industry-context.test.js`](../../tests/regression/industry-context.test.js) containing 54 rigorous assertions covering:
* Taxonomy completeness (12/12 JobFamilies).
* Classifier default title.
* Dynamic persona creation and role naming.
* Question prompt and reverse prompt neutralization.
* All 8 backend evaluation, interview, roadmap, and preparation services fallbacks.
* Frontend `main.js` sandbox execution across diverse test cases.
* Frontend `interview.js` fallback neutralization.

**Result:** **54 Tests | 54 PASS | 0 FAIL**.

---

## 15. Cross-Industry Simulation Test Results (Cases A through F)

| Case | Scenario Input | Classified Domain | Assigned Interviewer Persona | Questions Assigned | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Case A** | Marketing Specialist @ Unilever | `MARKETING_GROWTH` | Marketing & Growth Director Interviewer | Digital Marketing Specialist (ROI, CPA, Funnel) | **PASS** (Zero tech/coding questions) |
| **Case B** | Financial Analyst @ Vietcombank | `FINANCE_ACCOUNTING` | Finance Controller & Senior Auditor Interviewer | Chuyên viên Kế toán / Kiểm toán (Thuế, Báo cáo tài chính) | **PASS** (Zero CSS/React questions) |
| **Case C** | Business Analyst @ FPT | `BUSINESS_ANALYSIS` | Business Analysis Lead Interviewer | Business Analyst (Stakeholders, Scope creep, Docs) | **PASS** (Prioritized over Data Scientist) |
| **Case D** | Software Engineer @ Google | `SOFTWARE_ENGINEERING` | Senior Engineering Interviewer / Tech Lead | Frontend Developer / Backend Developer | **PASS** (SWE tech depth fully preserved) |
| **Case E** | Corporate Lawyer (Non-tech) | `GENERAL_PROFESSIONAL` | Senior Hiring Manager / Professional Interviewer | General Professional (6 universal competency questions) | **PASS** (Zero tech jargon) |
| **Case F** | Missing / Empty JobTitle | `GENERAL_PROFESSIONAL` | Senior Hiring Manager / Professional Interviewer | General Professional (6 universal competency questions) | **PASS** (Clean neutral fallback) |

---

## 16. Zero-Regression & Baseline Invariant Audit

All previously established invariants were verified:
1. **Contract Invariants:** REST endpoints (`/api/sessions`, `/api/ai/question`, `/api/ai/introduction`, `/api/interviews/end`), DTO definitions, database schema, and session keys (`interview_init_data`) remained 100% untouched.
2. **State Machine & Lifecycle Invariants:** Turn sequencing, TTS session locks, mute toggles, speech recognition buffers, and timer lifecycles function identically with 30/30 PASS in `test_interview_flow.js`.
3. **DOM ID Invariants:** All 58 required DOM IDs in `interview-practice.html` and 4 step panes in `interview-info.html` are preserved.
4. **SWE Integrity:** Candidates interviewing for Software Engineering positions retain full access to System Design, High Concurrency, DB bottleneck, and coding questions without degradation.

---

## 17. Deferred Scope for Wave B & Wave C

In accordance with architectural planning:
* **Wave B (Visual & Component Presentation):**
  - Polishing multi-domain visuals, badges, and icon sets across interview room and report UI.
  - Dynamically mapping dimension titles in report UI based on session domain (e.g. "Chuyên môn Nghiệp vụ" for non-tech vs "Kiến thức Kỹ thuật" for tech) while maintaining backward-compatibility with test fixtures.
* **Wave C (Question Bank & Blueprint Seeding):**
  - Expanding Knowledge Blueprint schemas and pre-seeded concept graphs for non-IT domains (Finance, Healthcare, FMCG Marketing, Legal).

---

## 18. Final Architect Verdict & Wave A Sign-Off

> **VERDICT: P1.3 WAVE A — CONTEXT CORE REMEDIATION IS SEALED AND PRODUCTION-READY.**  
>
> All SWE assumptions in core session contexts, interviewer personas, prompts, evaluations, preparation plans, and offline fallbacks have been systematically dismantled and replaced with a deterministic, multi-industry classification architecture. PrepMate now delivers authentic, profession-tailored interview simulations for any modern career discipline.
