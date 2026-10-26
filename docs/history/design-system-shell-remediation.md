# PREPMATE — P1.5-R1 DESIGN SYSTEM & SHELL REMEDIATION REPORT

> **Document Version:** 1.0.0  
> **Date:** October 7, 2026  
> **Phase:** P1.5-R1 — DESIGN SYSTEM & SHELL REMEDIATION  
> **Status:** P1.5-R1 — DESIGN SYSTEM & SHELL REMEDIATION COMPLETE  
> **Regression Verification:** 347/347 PASS | .NET Build: 0 Warnings / 0 Errors  

---

## 1. EXECUTIVE SUMMARY

P1.5-R1 represents the first remediation wave of the P1.5 Final UX/UI Consistency initiative. In this wave, PrepMate's fragmented visual foundations were harmonized without altering underlying business logic, API contracts, or conversational interview lifecycles.

### Remediation Objectives Delivered:
1. **CONSIST-01 (Design Token Harmonization):** Established `FE/shared/css/tokens.css` as the authoritative Single Source of Truth (SSOT). Eliminated hardcoded variable duplications across 8 feature pages (`interview-info.html`, `qbank.html`, `jobs.html`, `admin.html`, `pricing.html`, `about.html`, `help.html`, `auth.html`) and bound `style.css` and `new-dashboard.css` directly to canonical `--pm-*` tokens.
2. **CONSIST-02 (Background Glow & Visual Noise Removal):** Purged obsolete `<div class="glow-bg"></div>` markup from 10 light application surfaces, eliminating purple/pink haze and removing unnecessary `display: none !important;` overrides from modern feature pages. Preserved the intentional marketing dark hero presentation on `FE/index.html`.
3. **CONSIST-08 (Button & Control Geometry Standardization):** Formally codified button radius tokens (`--pm-radius-btn-sm: 6px;`, `--pm-radius-btn-md: 8px;`, `--pm-radius-btn-lg: 10px;`, `--pm-radius-btn-pill: 9999px;`) across `components.css`, `style.css`, and `new-dashboard.css`.
4. **CONSIST-10 (Legacy Profile Title Correction):** Corrected `FE/features/profile/profile.html` `<title>` from `PrepMate - Hồ sơ & Cài đặt` to `PrepMate — Hồ sơ năng lực cá nhân`.

---

## 2. BASELINE BEFORE REMEDIATION

Prior to P1.5-R1 modifications, all existing regression suites and the backend build were confirmed passing:

```text
Regression Baseline:
- test_p14c_accessibility.js: 24/24 PASS
- test_p14c_responsive.js: 19/19 PASS
- test_p14_navigation.js: 10/10 PASS
- test_industry_context.js: 54/54 PASS
- test_p13_presentation.js: 66/66 PASS
- test_interview_setup_ux.js: 20/20 PASS
- test_live_interview_ux.js: 12/12 PASS
- test_interview_flow.js: 30/30 PASS
- test_report_ui.js: 67/67 PASS
Total: 302/302 PASS

.NET Backend Build:
0 Warning(s) / 0 Error(s)
```

---

## 3. CONSIST-01 — TOKEN HARMONIZATION

### 3.1 Before Remediation
- `tokens.css` defined only `--color-*` and `--radius-*` tokens, which were largely ignored by feature stylesheets.
- Major feature pages independently declared duplicate hex color palettes under disparate prefixes (`--prep-*`, `--qb-*`, `--auth-*`, `--about-*`, `--help-*`, `--pm-admin-*`).
- Specificity battles led pages to rely on `!important` to force body and container backgrounds.

### 3.2 Changes Implemented
1. **SSOT Definition in `tokens.css`:**
   - Established the `--pm-*` canonical namespace for all shared colors, surfaces, borders, typography, geometry, and elevation.
   - Preserved backward compatibility by mapping legacy `--color-*`, `--radius-*`, and `--shadow-*` tokens 1:1 to `--pm-*`.
2. **Consumer Page Migration:**
   - `FE/shared/css/style.css`: `:root` mapped to `var(--pm-*)`.
   - `FE/features/interview/interview-info.html`: `:root` mapped to `var(--pm-*)`.
   - `FE/features/qbank/qbank.html`: `:root` mapped to `var(--pm-*)`.
   - `FE/features/jobs/jobs.html`: `:root` mapped to `var(--pm-*)`.
   - `FE/features/admin/admin.html`: `:root` mapped to `var(--pm-*)`.
   - `FE/features/payment/pricing.html`: `:root` mapped to `var(--pm-*)`.
   - `FE/features/about/about.html`: `:root` mapped to `var(--pm-*)`.
   - `FE/features/help/help.html`: `:root` mapped to `var(--pm-*)`.
   - `FE/features/auth/auth.html`: `:root` light mode mapped to `var(--pm-*)`.
3. **Removal of `!important` Workarounds:**
   - Removed `!important` from `body.dashboard-body` and `.main-content-new` in `interview-info.html`, `qbank.html`, and `jobs.html`.

### 3.3 Remaining Feature-Specific Tokens
- Dark mode gradients in `auth.html` (`--auth-bg-grad`, `--auth-shadow`) were intentionally retained as feature-specific tokens because they serve unique modal authentication card presentation.
- Dark theme admin variables in `admin.html` (`[data-theme="dark"]`) were retained for administrator dark mode operations.

### 3.4 Verification
- Verified by automated assertions in `test_p15_r1_consistency.js` (Test Groups 1 and 2: 24 assertions PASS).

---

## 4. CONSIST-02 — REMOVE AI GLOW NOISE

### 4.1 Before Remediation
- Obsolete `<div class="glow-bg"></div>` tags were present in 10 HTML templates.
- On light-mode pages, this rendered large blurry radial gradients (pink/purple/indigo), causing visual distortion behind clean enterprise cards.
- Pages like `interview-info.html`, `qbank.html`, and `jobs.html` were forced to add hacky overrides: `body.dashboard-body .glow-bg { display: none; }`.

### 4.2 Removed Glow Surfaces
Obsolete `<div class="glow-bg"></div>` markup was completely removed from the following 10 light application surfaces:
1. `FE/features/dashboard/dashboard.html`
2. `FE/features/admin/admin.html`
3. `FE/features/progress/progress.html`
4. `FE/features/interview/history.html`
5. `FE/features/jobs/jobs.html`
6. `FE/features/payment/payment.html`
7. `FE/features/profile/cv.html`
8. `FE/features/profile/profile.html`
9. `FE/features/profile/settings.html`
10. `FE/features/auth/auth.html`

Obsolete CSS suppressions (`body.dashboard-body .glow-bg { display: none; }`) were removed from:
- `FE/features/interview/interview-info.html`
- `FE/features/qbank/qbank.html`
- `FE/features/jobs/jobs.html`

### 4.3 Intentional Exceptions Preserved
- **Public Landing Page (`FE/index.html`):** The marketing landing page utilizes intentional hero dark-mode styling (`.hero-glow` / `.hero-section`) to showcase the platform's initial branding. This was preserved unchanged.

### 4.4 Verification
- Verified by automated assertions in `test_p15_r1_consistency.js` (Test Group 3: 10 assertions PASS).

---

## 5. CONSIST-08 — BUTTON GEOMETRY

### 5.1 Canonical Geometry Standardized
Standardized in `FE/shared/css/tokens.css`:
- **Small Button / Pill Tag:** `--pm-radius-btn-sm: 6px;`
- **Default Action Button:** `--pm-radius-btn-md: 8px;`
- **Hero CTA / Primary Action:** `--pm-radius-btn-lg: 10px;`
- **Pill Button / Status Pill:** `--pm-radius-btn-pill: 9999px;`

### 5.2 Migrated Stylesheets & Controls
1. **`FE/shared/css/components.css`:**
   - `.btn`: `border-radius: var(--pm-radius-btn-md, 8px);`
   - `.btn-sm`: `border-radius: var(--pm-radius-btn-sm, 6px);`
   - `.btn-md`: `border-radius: var(--pm-radius-btn-md, 8px);`
   - `.btn-lg`: `border-radius: var(--pm-radius-btn-lg, 10px);`
   - `.btn-pill`: `border-radius: var(--pm-radius-btn-pill, 9999px);`
2. **`FE/shared/css/style.css`:**
   - `.btn`: `border-radius: var(--pm-radius-btn-md, 8px);` (migrated from hardcoded 10px).
3. **`FE/features/dashboard/new-dashboard.css`:**
   - `.btn-start-interview`: `border-radius: var(--pm-radius-btn-lg, 10px);` (migrated from hardcoded 12px).

### 5.3 Intentional Exceptions Preserved
- Floating audio and live interview controls in `interview-practice.html` (e.g., `.btn-send-answer`, `.room-control-btn`) intentionally utilize pill/circular geometry (`9999px` / `50%`) to support immersive video-conferencing interaction patterns.

---

## 6. CONSIST-10 — PROFILE PAGE TITLE

### 6.1 Title Corrected
In `FE/features/profile/profile.html`:
- **Before:** `<title>PrepMate - Hồ sơ & Cài đặt</title>`
- **After:** `<title>PrepMate — Hồ sơ năng lực cá nhân</title>`
- **Rationale:** Since P1.4-B separated System Settings into `settings.html`, `profile.html` now exclusively handles identity, professional bio, target role, and career background. The updated title eliminates semantic ambiguity.

---

## 7. REGRESSION VERIFICATION MATRIX

All 10 automated regression suites were executed sequentially alongside the .NET backend build:

| Test Suite | Scope | Result | Details |
| :--- | :--- | :---: | :--- |
| `test_industry_context.js` | Multi-Industry Context Engine | **PASS** | 54/54 assertions pass |
| `test_p13_presentation.js` | Presentation & Industry Neutrality | **PASS** | 66/66 assertions pass |
| `test_interview_setup_ux.js` | 4-Step Setup Wizard Experience | **PASS** | 20/20 assertions pass |
| `test_live_interview_ux.js` | Live Interview Room Interaction | **PASS** | 12/12 assertions pass |
| `test_interview_flow.js` | Adaptive Interview Lifecycle & State Machine | **PASS** | 30/30 assertions pass |
| `test_report_ui.js` | Evaluation Report Architecture | **PASS** | 67/67 assertions pass |
| `test_p14_navigation.js` | Information Architecture & Nav Flows | **PASS** | 10/10 assertions pass |
| `test_p14c_accessibility.js` | WCAG 2.1 AA Accessibility | **PASS** | 24/24 assertions pass |
| `test_p14c_responsive.js` | Responsive Breakpoints & Viewports | **PASS** | 19/19 assertions pass |
| `test_p15_r1_consistency.js` | **Design System & Shell Remediation (NEW)** | **PASS** | **45/45 assertions pass** |
| `.NET Backend Build` | C# / ASP.NET Core Compilation | **PASS** | **0 Warnings / 0 Errors** |
| **TOTAL** | **Full System Regression Baseline** | **PASS** | **347/347 Assertions (100%)** |

---

## 8. FINAL VERIFICATION CHECKLIST

- [x] Baseline regression passed before making any edits.
- [x] Canonical shared tokens established in `FE/shared/css/tokens.css`.
- [x] Local token migration completed across all consumer feature pages.
- [x] Unnecessary `!important` background overrides eliminated.
- [x] Unwanted light-theme `.glow-bg` noise removed from all 10 candidate surfaces.
- [x] Intentional marketing glow exceptions preserved on `FE/index.html`.
- [x] Button geometry standardized with canonical radius tokens.
- [x] Profile page title corrected to reflect genuine profile focus.
- [x] No unrelated scope changes (zero modifications to emojis, copy, or business logic).
- [x] New `test_p15_r1_consistency.js` regression suite authored and passing (45/45).
- [x] Full existing regression suite passing (347/347 total assertions).
- [x] Backend compilation verified clean (0 warnings / 0 errors).
- [x] Comprehensive documentation report generated.

---

## 9. CONCLUSION & STATUS

Wave P1.5-R1 has successfully unified PrepMate's design tokens and cleansed its application shell without altering interview behavior or introducing design regressions. The design token architecture now provides a stable single source of truth for upcoming consistency phases.

> **P1.5-R1 — DESIGN SYSTEM & SHELL REMEDIATION COMPLETE**  
> *(Note: P1.5 remains open. Subsequent waves will address R2 — UI Language & Iconography, R3 — Product Fit, and R4 — Codebase Cleanup.)*
