# PREPMATE — P1.5 FINAL UX/UI CONSISTENCY AUDIT REPORT

> **Document Version:** 1.0.0  
> **Date:** October 7, 2026  
> **Audit Status:** P1.5 — AUDIT COMPLETE *(Awaiting Review — Do Not Seal)*  
> **Scope:** Entire PrepMate Application (18 Surfaces, 4 User Roles: Guest, Candidate/User, Manager, Administrator)  
> **Regression Baseline:** 302/302 Automated Checks PASS | .NET Build: 0 Warnings / 0 Errors  

---

## 1. EXECUTIVE SUMMARY

PrepMate has successfully completed structural, functional, and semantic remediation phases (P0 Architecture, P1.1 Setup UX, P1.2 Live Practice Room, P1.3 Multi-Industry Neutrality, P1.4-B Information Architecture, and P1.4-C Accessibility & Responsive Hardening). All 302 automated regression tests pass without regression.

However, an exhaustive manual and architectural UX/UI consistency audit across all **18 user-facing surfaces** reveals that PrepMate suffers from significant **design system fragmentation, visual styling divergence, inconsistent token implementations, and cosmetic AI clutter**.

### Key Overall Findings:
1. **Design Token Fragmentation:** Rather than relying on a single source of truth (`tokens.css`), at least 6 competing CSS token namespaces exist across different pages (`--prep-*`, `--pm-*`, `--qb-*`, `--auth-*`, `--about-*`, `--pm-admin-*`). Pages frequently resort to `!important` declarations to override parent styles.
2. **Visual Inconsistency & "AI Glow" Overuse:** 10 out of 18 surfaces render a background ambient blob (`.glow-bg`) with high-saturation indigo/purple gradients, while the core practice and setup chambers (`interview-info.html`, `qbank.html`, `jobs.html`) explicitly suppress it via inline `display: none !important`.
3. **Emoji vs. Vector Icon Divergence:** Emojis are heavily used as primary UI iconography in prominent user surfaces (Dashboard, Report, Profile, 404), while Practice Room, Setup Wizard, and Navbar use crisp SVG line vectors. Emojis render inconsistently across Windows, iOS, and Android platforms and convey a toy-like aesthetic.
4. **Card Nesting & Glassmorphism Clutter:** Candidate surfaces suffer from redundant "glass-card inside glass-card" nesting and overloaded badge pills (some cards displaying 4 to 5 simultaneous colored badges and tags).
5. **Dead Code & Phantom DOM Elements:** Legacy compatibility elements (`elevenlabs-key-input`, `api-key-box`, unused dropdowns) linger inside `dashboard.html` and `interview-practice.html`, with orphaned JavaScript event handlers bound in `<script>` blocks.
6. **Multi-Industry Content Misalignment on Landing:** While the backend and setup engines are 100% industry-neutral, the public landing page hero simulator remains 100% hardcoded to a Software Engineering Redis Cache Stampede scenario.

---

## 2. AUDIT METHODOLOGY & SCOPE

### 2.1 Scope of Surfaces Audited (18 Surfaces)
1. **Public Landing:** `FE/index.html`
2. **Public Auth:** `FE/features/auth/auth.html`
3. **Public About:** `FE/features/about/about.html`
4. **Public Help / FAQ:** `FE/features/help/help.html`
5. **Public Pricing:** `FE/features/payment/pricing.html`
6. **Public 404:** `FE/404.html`
7. **Candidate Dashboard:** `FE/features/dashboard/dashboard.html`
8. **Interview Setup Chamber:** `FE/features/interview/interview-info.html`
9. **Virtual Practice Room:** `FE/features/interview/interview-practice.html`
10. **Interview History:** `FE/features/interview/history.html`
11. **Evaluation Report:** `FE/features/report/report.html`
12. **Progress Analytics:** `FE/features/progress/progress.html`
13. **Question Bank:** `FE/features/qbank/qbank.html`
14. **Job Matching:** `FE/features/jobs/jobs.html`
15. **Candidate Profile:** `FE/features/profile/profile.html`
16. **CV Management:** `FE/features/profile/cv.html`
17. **System Settings:** `FE/features/profile/settings.html`
18. **Admin/Manager Console:** `FE/features/admin/admin.html`

### 2.2 Evaluation Criteria
- **Visual & Style Consistency:** Colors, borders, elevation, background treatment.
- **Design Tokens & SSOT:** CSS custom properties coherence.
- **Component Consistency:** Buttons, cards, modals, tabs, forms.
- **Navigation & Shell:** Consistency across headers, sidebars, breadcrumbs, footers.
- **Typography & Iconography:** Type scale, font families, SVG vs emoji usage.
- **Information Density & Cognitive Load:** Clutter, card nesting, badge overload.
- **State Completeness:** Loading, empty, error, success handling.
- **Product Fit & Tone:** Professional interview simulation vs "AI gadget" feel.

---

## 3. DESIGN SYSTEM & TOKENS AUDIT

### 3.1 Token Namespace Fragmentation
| File / Surface | Primary Token Prefix | Primary Brand Color | Background Token | Observation |
| :--- | :--- | :--- | :--- | :--- |
| `shared/css/tokens.css` (SSOT) | `--color-*` | `#2563eb` (`--color-primary`) | `#0f172a` (dark) / `#f8fafc` | Defined as system master, but ignored by most feature pages |
| `shared/css/style.css` | `--primary`, `--text-*` | `#6366f1` / `#2563eb` | `#0f172a` (`--bg-dark`) | Mixed legacy dark theme tokens with new light defaults |
| `dashboard/new-dashboard.css` | `--pm-*` | `#1d4ed8` (`--pm-primary`) | `#f8fafc` (`--pm-bg-body`) | Introduced during dashboard refactor |
| `interview-info.html` | `--prep-*` | `#1d4ed8` / `#2563eb` | `#f8fafc` (`--prep-bg`) | Redefined in local `<style>` block |
| `qbank.html` | `--qb-*` | `#2563eb` (`--qb-accent-blue`) | `#f8fafc` (`--qb-bg-body`) | Redefined in local `<style>` block |
| `jobs.html` | `--prep-*` | `#2563eb` / `#1d4ed8` | `#f8fafc` (`--prep-bg`) | Duplicate inline tokens |
| `admin.html` | `--pm-admin-*` | `#1d4ed8` / `#3b82f6` | `#f8fafc` / `#0f172a` | Redefined for admin console |
| `auth.html` | `--auth-*` | `#1d4ed8` | `#f8fafc` / `#0f172a` | Redefined for auth views |
| `report.html` | Hardcoded / Local | `#1d4ed8` / `#2563eb` | `#f8fafc` / Glass | Inlined hex colors without token linkage |

### 3.2 Typography Font Families Loaded
- **Outfit:** Loaded in `dashboard.html`, `interview-info.html`, `interview-practice.html`, `jobs.html`, `qbank.html`, `admin.html`, `pricing.html`, `auth.html`, `about.html`, `help.html`.
- **Plus Jakarta Sans & Inter:** Loaded specifically in `report.html`.
- **Inter (Fallback):** Defined in `style.css` base body.
- **Verdict:** Two distinct visual personalities exist: the main app uses geometric sans (`Outfit`), while the Report surface uses editorial sans (`Plus Jakarta Sans`). While the Report typography is visually crisp, it should explicitly share token font variables.

---

## 4. BACKGROUNDS, "AI GLOW" & VISUAL NOISE AUDIT

### 4.1 `.glow-bg` Audit
The class `.glow-bg` (rendering large blurry purple/blue radial gradients) is present in 10 HTML templates:
- `admin.html`
- `dashboard.html`
- `progress.html`
- `auth.html`
- `history.html`
- `payment.html`
- `cv.html`
- `profile.html`
- `settings.html`
- `index.html`

**The Inconsistency:**
- Modernized surfaces (`interview-info.html`, `qbank.html`, `jobs.html`) had to inject aggressive CSS overrides:
  ```css
  body.dashboard-body .glow-bg {
      display: none !important;
  }
  ```
- This proves that `.glow-bg` causes unacceptable contrast and visual clutter on light themes, yet half the codebase continues to instantiate the div in markup while the other half disables it.

### 4.2 Glassmorphism & Card Overkill
- In `dashboard.html` and `profile.html`, `.glass-card` elements are nested inside other `.glass-card` elements, creating jarring semi-transparent border stacking and blur artifacts.
- Background noise undermines the enterprise, high-stakes coaching tone of PrepMate.

---

## 5. ICONOGRAPHY & EMOJI AUDIT

### 5.1 Emojis Used as Core UI Icons
Across several prominent candidate surfaces, system navigation and status indicators rely on Unicode emojis instead of vector SVG icons:
- `dashboard.html`: `👋`, `⚙️`, `💬`, `⭐`, `⚡`, `📋`, `🎯`, `💡`, `🔒`, `👁️`
- `report.html`: `🎯`, `🏢`, `🖨️`, `🔄`, `📊`, `📌`, `🔍`, `🚀`, `📋`, `💬`, `⚠️`, `📝`, `💪`, `ℹ️`, `🛡️`
- `profile.html`: `👤`, `💼`, `🔒`, `⚡`, `⚙️`
- `history.html`: `📅`, `⏱️`, `🎯`, `📊`, `🔍`
- `404.html`: `⚠️`, `🧭`

### 5.2 Critical Issues with Emojis:
1. **Platform Inconsistency:** On Windows 10/11, Segoe UI Emoji renders flat, colorful, or 2D outlines; on macOS/iOS, Apple Color Emoji renders glossy 3D; on Linux/Android, Noto Color Emoji renders differently.
2. **Visual Hierarchy Pollution:** Emojis cannot inherit CSS `currentColor`, making them impossible to harmonize with active/hover/focus states.
3. **Amateur Aesthetic:** PrepMate is designed as an executive, professional interview coaching suite. Using `⚙️`, `💬`, and `⭐` side-by-side with precision SVG icons creates visual discord.

---

## 6. NAVIGATION & SHELL CONSISTENCY

| Surface | Header Type | Sidebar Present? | Breadcrumb Present? | Back Navigation |
| :--- | :--- | :--- | :--- | :--- |
| Landing (`index.html`) | `<app-header>` | No | No | N/A |
| About / Help / Pricing | `<app-header>` | No | Yes (Breadcrumb) | Breadcrumb / Logo |
| 404 (`404.html`) | `<app-header>` | No | No | Back Button / Dashboard Link |
| Auth (`auth.html`) | Custom `.auth-top-bar` | No | No | `<a href="../../index.html">` |
| Payment / Checkout | Custom Top Bar | No | Yes (Checkout Steps) | `<a href="pricing.html">` |
| Dashboard | Dynamic Workspace Shell | Yes (`#main-sidebar`) | No | N/A |
| Interview Setup | Dynamic Workspace Shell | Yes (`#main-sidebar`) | Yes | Breadcrumb to Dashboard |
| Practice Room | Immersion Top Bar | No (Full screen mode) | No | Exit Room Button (Confirmation) |
| Report (`report.html`) | Custom Report Navbar + Sticky Subnav | No (Dedicated report canvas) | In-header meta pill | "Dashboard" button in top right |
| History / Progress | Dynamic Workspace Shell | Yes (`#main-sidebar`) | Yes | Breadcrumb |
| Jobs / QBank | Dynamic Workspace Shell | Yes (`#main-sidebar`) | Yes | Breadcrumb |
| Profile / CV / Settings | Dynamic Workspace Shell | Yes (`#main-sidebar`) | Yes | Breadcrumb |
| Admin (`admin.html`) | Custom Admin Header | Yes (`#main-sidebar`) | No | Role Switcher Pills |

### Findings:
- Navigation shells are largely consistent within role boundaries (Candidate Portal uses `#main-sidebar` + `.main-content-new`).
- The Exit button in `interview-practice.html` properly triggers safety confirmation modals.
- `report.html` functions effectively as an exportable/printable document with a dedicated document navbar, but lacks a standard PrepMate breadcrumb trail back to Interview History.

---

## 7. TYPOGRAPHY & HIERARCHY AUDIT

### 7.1 Font Sizing & Scale Inconsistencies
- Primary Headings (`h1`):
  - Landing: `clamp(2.5rem, 5vw, 4rem)` (Heavy gradient fill)
  - Dashboard: `24px / 28px` (Font-weight 800)
  - Report: `28px` (Font-weight 800)
  - Jobs: `26px` (Font-weight 800)
  - Admin: `24px` (Font-weight 850)
  - Pricing: `32px` (Font-weight 850)
- Section Headings (`h2` / `h3`):
  - Range from `14.5px` to `20px` with conflicting font weights (`700`, `750`, `800`, `850`).
- Line Heights:
  - Several cards in `dashboard.html` have tight line-heights (`1.2` - `1.3`) on descriptive text, reducing readability.

---

## 8. BUTTONS & CTA CONSISTENCY

### 8.1 Primary Action Inconsistencies
- Standard Button: `.btn.btn-primary` (`#1d4ed8`, 8px border-radius, white text).
- Dashboard Hero CTA: `.btn-start-interview` (Custom inline style, gradient background, 10px radius).
- Practice Room Send CTA: `.btn-send-answer` (Custom pill button, SVG stroke icon).
- Progress Empty CTA: `.empty-alert-btn` (Inline `#1d4ed8`, custom box-shadow).
- Report Navbar Actions: `.btn-nav-action` (Transparent with light borders).

### 8.2 Inconsistent Radius and States
- Border radii vary arbitrarily: `6px`, `8px`, `9px`, `10px`, `12px`, and `100px` (pill).
- Primary buttons in `dashboard.html` use `border-radius: 9px;`, while `jobs.html` uses `border-radius: 8px;`, and `pricing.html` uses `border-radius: 10px;`.
- Focus rings vary between `outline: none; box-shadow: 0 0 0 3px rgba(37,99,235,0.2)` and `outline: 2px solid #2563eb`.

---

## 9. CARDS & CONTAINERS AUDIT

### 9.1 Container Clutter & Layering
- **Dashboard Mid-Grid:** In `dashboard.html`, the left history container wraps items in `.glass-card`, which in turn contains `.empty-state-new` with an inner `.empty-icon` bordered circle.
- **Profile Page:** In `profile.html`, lines 25-48 contain `.api-key-box.glass-card` divs inside hidden blocks directly above `<main>`, leading to DOM nesting inconsistencies.
- **Card Shadows:** 4 distinct shadow elevations are declared across stylesheets:
  - `box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);`
  - `box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.06);`
  - `box-shadow: 0 10px 25px -4px rgba(37, 99, 235, 0.08);`
  - `box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.5);` (Dark mode auth)

---

## 10. FORMS, INPUTS & CONTROLS AUDIT

### 10.1 Input Inconsistencies
- Text inputs in `profile.html` use `border: 1px solid var(--border-color); padding: 10px 14px; border-radius: 8px;`.
- Text inputs in `qbank.html` use `border: 1px solid var(--qb-border); padding: 12px 16px; border-radius: 12px;`.
- Text inputs in `history.html` use `border: 1px solid #cbd5e1; padding: 9px 14px; border-radius: 9px;`.
- Focus rings vary between blue 2px offset, 3px box shadow, and native browser outlines.

### 10.2 Select Dropdown Styling
- Native `<select>` elements in `interview-info.html` are styled with custom SVG chevron arrows, whereas in `profile.html` and `history.html`, native OS select chevrons are displayed.

---

## 11. MODALS, TOASTS & OVERLAYS AUDIT

### 11.1 Confirmation & Exit Modals
- `interview-practice.html` implements an accessible modal with backdrop blur, trapped focus, and escape key handling.
- `admin.html` uses a separate modal implementation with different animation curves and different header layouts.
- Toast notifications: `showToast()` in `main.js` correctly renders bottom-right toast alerts, but some script blocks (`dashboard.html` line 258) still maintain fallbacks to native browser `alert()`.

---

## 12. STATES AUDIT (LOADING, EMPTY, ERROR, SUCCESS)

### 12.1 State Handling Status Across 18 Surfaces
| Surface | Loading State | Empty State | Error State | Success Feedback |
| :--- | :--- | :--- | :--- | :--- |
| **Landing** | N/A (Static) | N/A | N/A | Toast / Redirect |
| **Auth** | Button spinner | N/A | Inline red alert banner | Green alert / Redirect |
| **Dashboard** | Skeleton loader (JS) | Card with icon + CTA | Fallback text | Toast |
| **Interview Setup** | Micro-spinners | Dynamic fallback cards | Error banner | Step transition |
| **Practice Room** | Live TTS/AI indicator | N/A | Retry connection modal | Completion debrief |
| **Report** | Spinner with status copy | Structured empty box | Glass error panel + retry | Visual score badge |
| **Progress** | Chart placeholder | Blue alert banner + CTA | Graceful empty fallback | N/A |
| **History** | Spinner list | Empty folder card + CTA | Empty state | Delete toast |
| **QBank** | Spinner list | No questions found card | "Không tìm thấy kết quả" | Save toast |
| **Jobs** | Skeletons | No jobs matched banner | Graceful fallback | Applied pill |
| **Profile** | N/A | Default empty fields | Input validation text | Success toast |
| **CV** | Parsing indicator | "Chưa có CV" card | Upload error text | Parsed pill |
| **Settings** | N/A | N/A | N/A | Auto-save toast |
| **Pricing** | N/A | N/A | Checkout error modal | Success badge |
| **404** | N/A | N/A | Full-page 404 card | Navigation links |
| **Admin** | Table spinner | Empty table row | Toast error | Toast success |

### Findings:
- Empty states and loading indicators are present across almost all surfaces.
- **Inconsistency:** Empty states use completely different layouts and visual accents. `dashboard.html` uses a rounded dashed border box with emoji `📋`; `progress.html` uses a solid blue-left-border banner (`.progress-empty-alert`); `history.html` uses a centered text block.

---

## 13. INFORMATION DENSITY & COGNITIVE LOAD AUDIT

### 13.1 Badge & Pill Overload
- **Dashboard:** The Executive Readiness Grid presents 4 colored cards (`⚙️ Chuyên môn`, `💬 Giao tiếp`, `⭐ STAR`, `⚡ Phản xạ`), followed immediately by weekly streak badges, follow-up tip cards, and tag pills (`#STAR_Method`, `#Tradeoff`, `#ProblemSolving`).
- **Jobs Card:** Each job item displays up to 6 distinct badges:
  1. `.job-badge.remote` (Location pill)
  2. `.match-score` (Green match percentage)
  3. `.featured-badge` (Orange highlight)
  4. Salary pill
  5. 2–3 skill tags
- **Cognitive Assessment:** Visual clutter creates high cognitive fatigue. Badges should be categorized into primary status vs metadata tags, with uniform padding and font sizing.

---

## 14. TERMINOLOGY & CONTENT AUDIT

### 14.1 Language Mixing (Vietnamese & English)
- **Report Surface:** Mixes English terminology heavily into Vietnamese copy:
  - `READY • SẴN SÀNG`
  - `6 Chiều Năng Lực Cốt Lõi (Performance Dimensions)`
  - `Bằng Chứng & Chẩn Đoán Chi Tiết (Evidence & Diagnostics)`
  - `Turn Provenance`
  - `UNASSESSED`
- **Dashboard & Settings:**
  - "Free Tier Banner", "API Key", "ElevenLabs Voice Key", "Dark Mode", "STAR Method".
- **Recommendation:** Standardize on consistent bilingual nomenclature where professional recruitment terminology is paired with clean Vietnamese explanations without awkward hyphenation.

### 14.2 Landing Page Multi-Industry Alignment
- **Discrepancy:** The Landing page copy promises preparation for Technology, Finance, Marketing, HR, and Sales. However, the interactive Hero Simulation card hardcodes:
  - Role: `FPT Software — Senior Backend Engineer`
  - Question: `Redis cache stampede & Mutex Lock`
  - Candidate Answer: `Distributed Lock with Redlock & TTL`
- **Verdict:** Visitors outside of software engineering immediately perceive PrepMate as a coding-only tool.

---

## 15. PAGE-BY-PAGE AUDIT (18 SURFACES)

### Surface 1: Public Landing (`FE/index.html`)
- **Visual Design:** High quality modern dark hero fading to clean content sections.
- **Consistency Score:** 8/10.
- **Issues:** Hero mock interview is 100% Backend SWE; does not rotate between Marketing, Finance, or Management roles.

### Surface 2: Public Auth (`FE/features/auth/auth.html`)
- **Visual Design:** Dedicated light/dark gradient container, tabbed login/signup.
- **Consistency Score:** 7.5/10.
- **Issues:** Uses isolated `--auth-*` tokens; does not share token variables from `tokens.css`.

### Surface 3: Public About (`FE/features/about/about.html`)
- **Visual Design:** Clean typography, mission statement, core values.
- **Consistency Score:** 8.5/10.
- **Issues:** Defines custom `--about-*` tokens; button border radii slightly mismatch landing page buttons.

### Surface 4: Public Help / FAQ (`FE/features/help/help.html`)
- **Visual Design:** Accordion FAQ items, search filter input.
- **Consistency Score:** 8.5/10.
- **Issues:** Accordion expand chevrons use inline SVGs with different stroke widths than the rest of the application.

### Surface 5: Public Pricing (`FE/features/payment/pricing.html`)
- **Visual Design:** 3-tier pricing table (Free, PRO, Enterprise) with billing frequency switch.
- **Consistency Score:** 8.5/10.
- **Issues:** Feature comparison table uses custom bullet icons that differ from the checkmark icons used in `about.html`.

### Surface 6: Public 404 (`FE/404.html`)
- **Visual Design:** Centered error card with canonical header.
- **Consistency Score:** 8/10.
- **Issues:** Uses raw emoji `⚠️` in the top badge instead of an SVG alert triangle.

### Surface 7: Candidate Dashboard (`FE/features/dashboard/dashboard.html`)
- **Visual Design:** Clean 2-column layout, stats grid, recent history, readiness cards.
- **Consistency Score:** 6.5/10.
- **Issues:**
  - Contains `.glow-bg` div causing purple haze.
  - Raw emojis throughout cards (`⚙️`, `💬`, `⭐`, `⚡`, `📋`, `🎯`, `💡`).
  - Contains dead JavaScript event handlers for `elevenlabs-key-input` which no longer exists on this page.
  - Uses native `alert()` fallback instead of pure `showToast()`.

### Surface 8: Interview Setup Chamber (`FE/features/interview/interview-info.html`)
- **Visual Design:** High quality 4-step wizard with real-time briefing summary panel.
- **Consistency Score:** 9/10.
- **Issues:** Suppresses `.glow-bg` via `!important`; uses local `--prep-*` tokens instead of `tokens.css`.

### Surface 9: Virtual Practice Room (`FE/features/interview/interview-practice.html`)
- **Visual Design:** Immersive split layout (AI Interviewer canvas + candidate response chamber).
- **Consistency Score:** 8.5/10.
- **Issues:** Carries lines 28-96 of hidden legacy compatibility elements (`api-key-box`, `elevenlabs-key-input`, `cv-analysis-panel`, `upload-box`).

### Surface 10: Interview History (`FE/features/interview/history.html`)
- **Visual Design:** Table/card list of completed sessions with search filter and pagination.
- **Consistency Score:** 7.5/10.
- **Issues:** Emojis in metric mini cards; border-radius values (`9px`, `12px`, `14px`) diverge from dashboard.

### Surface 11: Evaluation Report (`FE/features/report/report.html`)
- **Visual Design:** Comprehensive executive assessment dossier with score wheel, dimensions, and diagnostics.
- **Consistency Score:** 7.5/10.
- **Issues:**
  - Loads different fonts (`Plus Jakarta Sans` instead of `Outfit`).
  - Heavy emoji usage in top navigation, subnav tabs, and diagnostic panels (`💪`, `⚠️`, `🔍`, `🛡️`).
  - Fallback markup before JS hydration still shows `Backend Engineer / Tech Global`.

### Surface 12: Progress Analytics (`FE/features/progress/progress.html`)
- **Visual Design:** Radar and line charts with skill progression tracking.
- **Consistency Score:** 8/10.
- **Issues:** Empty state banner styling (`.progress-empty-alert`) does not match the empty state card pattern used in Dashboard and History.

### Surface 13: Question Bank (`FE/features/qbank/qbank.html`)
- **Visual Design:** Filterable repository of STAR questions and core concepts.
- **Consistency Score:** 8/10.
- **Issues:** Defines `--qb-*` tokens; massive inlined `<style>` block (over 600 lines) that should be modularized.

### Surface 14: Job Matching (`FE/features/jobs/jobs.html`)
- **Visual Design:** Job board matching target roles to open JD requirements.
- **Consistency Score:** 7.5/10.
- **Issues:** Massive 700-line inline `<style>` block; badge overload on individual job cards (up to 6 tags per card).

### Surface 15: Candidate Profile (`FE/features/profile/profile.html`)
- **Visual Design:** Form fields for identity, target role, experience, and contact data.
- **Consistency Score:** 6.5/10.
- **Issues:**
  - Page title tag reads legacy `PrepMate - Hồ sơ & Cài đặt` despite settings being migrated to `settings.html`.
  - Orphan closing `</div>` tag on line 49.
  - Hidden legacy API key inputs remain in markup.

### Surface 16: CV Management (`FE/features/profile/cv.html`)
- **Visual Design:** Drag-and-drop upload zone with parsed skills pills.
- **Consistency Score:** 8/10.
- **Issues:** Uses raw emojis in header icon box; uses distinct `--border-color` variable from `style.css`.

### Surface 17: System Settings (`FE/features/profile/settings.html`)
- **Visual Design:** Preference toggles for theme, language, voice speed, and API keys.
- **Consistency Score:** 8.5/10.
- **Issues:** Clean toggle switches, but theme toggle button radius diverges from button system standards.

### Surface 18: Admin/Manager Console (`FE/features/admin/admin.html`)
- **Visual Design:** Operations dashboard with metrics, user table, system prompts, and role switcher.
- **Consistency Score:** 8/10.
- **Issues:**
  - Inlines 2800+ lines of HTML/CSS/JS in a single file.
  - Custom `--pm-admin-*` tokens instead of system tokens.
  - Role switcher button group has custom styling not reused anywhere else.

---

## 16. CROSS-PAGE CONSISTENCY MATRIX

| Component / Pattern | Dashboard | Setup Wizard | Practice Room | Report | History | Progress | Profile | Settings | Admin |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Font** | Outfit | Outfit | Outfit | Plus Jakarta Sans | Outfit | Outfit | Outfit | Outfit | Outfit |
| **CSS Token Prefix** | `--pm-*` | `--prep-*` | Hardcoded | Local / Hardcoded | `--border-color` | `--pm-*` | Mixed | Mixed | `--pm-admin-*` |
| **`.glow-bg` Present?** | Yes | No (Hidden) | No | No | Yes | Yes | Yes | Yes | Yes |
| **Primary Button Radius** | `9px` | `10px` | `24px` (Pill) | `8px` | `9px` | `10px` | `8px` | `8px` | `7px` |
| **Card Border Radius** | `14px` | `16px` | `16px` | `16px` | `12px` | `16px` | `16px` | `16px` | `12px` |
| **Card Shadow** | `0 1px 3px` | `0 4px 16px` | `0 8px 24px` | `Glass blur` | `0 1px 3px` | `0 1px 3px` | `0 1px 3px` | `0 1px 3px` | `0 1px 3px` |
| **Icon Standard** | Emojis | Vector SVG | Vector SVG | Emojis | Emojis | Vector SVG | Emojis | Vector SVG | Vector SVG |
| **Empty State Style** | Dashed Icon Card | Dynamic Card | N/A | Glass Error Box | Centered Text | Blue Banner | N/A | N/A | Table Row |
| **Toast Framework** | Mixed (Alert/Toast) | Toast | Toast | Toast | Toast | Toast | Toast | Toast | Toast |

---

## 17. COMPREHENSIVE ISSUE INVENTORY

### Issue 1: Design Token Fragmentation
- **ID:** `CONSIST-01`
- **Severity:** `P1`
- **Page:** Global (`tokens.css`, `style.css`, `new-dashboard.css`, `interview-info.html`, `qbank.html`, `jobs.html`, `admin.html`)
- **Category:** Architecture / Design Tokens
- **Current Behavior:** 6 distinct token prefixes (`--prep-*`, `--pm-*`, `--qb-*`, `--auth-*`, `--about-*`, `--pm-admin-*`) are declared across feature templates.
- **Why it is a problem:** Makes global theme adjustments impossible, creates specificity wars, and forces developers to use `!important`.
- **Expected Behavior:** Single SSOT token set in `FE/shared/css/tokens.css` with semantic variables (`--pm-color-primary`, `--pm-radius-md`, etc.) imported by all pages.
- **Recommended Fix:** Unify variables across stylesheets under `--pm-*` or `--color-*` and remove conflicting local definitions.
- **Scope:** Global CSS Refactor.

### Issue 2: Background Glow & Visual Noise Overuse
- **ID:** `CONSIST-02`
- **Severity:** `P1`
- **Page:** `dashboard.html`, `admin.html`, `progress.html`, `auth.html`, `history.html`, `payment.html`, `profile.html`, `settings.html`
- **Category:** Visual Consistency / Cognitive Load
- **Current Behavior:** Persistent purple/blue radial blur (`.glow-bg`) renders in the background on light pages, while newer pages manually inject `display: none !important`.
- **Why it is a problem:** Diminishes contrast, introduces distracting visual artifacts, and conveys a low-budget "AI crypto gadget" feel.
- **Expected Behavior:** Clean, crisp neutral canvas (`#f8fafc`) for light mode, with subtle clean borders and zero ambient purple glow.
- **Recommended Fix:** Remove `.glow-bg` from HTML templates or set default display to none in `tokens.css` for light mode.
- **Scope:** HTML templates & Shared CSS.

### Issue 3: Unicode Emojis Used as Core Interface Icons
- **ID:** `CONSIST-03`
- **Severity:** `P1`
- **Page:** `dashboard.html`, `report.html`, `profile.html`, `history.html`, `404.html`
- **Category:** Visual Consistency / Platform Fidelity
- **Current Behavior:** Unicode emojis (`⚙️`, `💬`, `⭐`, `⚡`, `📋`, `🎯`, `💡`, `🖨️`, `🔄`, `📊`, `📌`, `🔍`, `🚀`, `💪`) are rendered inside buttons, badges, and tabs.
- **Why it is a problem:** Emojis render inconsistently across Windows, Android, and macOS, cannot inherit hover colors, and look unpolished.
- **Expected Behavior:** Consistent, sharp Feather/Lucide-style SVG vector icons that inherit `currentColor`.
- **Recommended Fix:** Replace all decorative and structural emojis with inline SVG vector icons.
- **Scope:** Frontend HTML / Components.

### Issue 4: Orphan Code & Compatibility Graveyard in Dashboard & Practice Room
- **ID:** `CONSIST-04`
- **Severity:** `P1`
- **Page:** `dashboard.html`, `interview-practice.html`, `profile.html`
- **Category:** Code Quality / Maintenance
- **Current Behavior:**
  - `dashboard.html` contains lines 235-279 with dead scripts for `elevenlabs-key-input` which was moved to `settings.html`.
  - `interview-practice.html` carries 70 lines of hidden fake DOM nodes purely to prevent null errors in legacy JS.
  - `profile.html` has an orphan `</div>` tag on line 49 and hidden API key blocks.
- **Why it is a problem:** Creates confusion during maintenance, increases payload, and risks event handler exceptions.
- **Expected Behavior:** Clean DOM templates with null-safe JavaScript guards in `interview.js` and `dashboard.js`.
- **Recommended Fix:** Add defensive `if (element)` checks in JS and remove orphan DOM nodes from HTML templates.
- **Scope:** Frontend Templates & Script Cleanup.

### Issue 5: Landing Page SWE Assumption Residue
- **ID:** `CONSIST-05`
- **Severity:** `P2`
- **Page:** `FE/index.html`
- **Category:** Product Concept / Multi-Industry Alignment
- **Current Behavior:** The hero mock interview interactive card hardcodes a Senior Backend Engineer scenario with Redis Lock questions.
- **Why it is a problem:** Contradicts the P1.3 multi-industry promise (Marketing, Finance, HR, Operations) and deters non-technical candidates.
- **Expected Behavior:** Dynamic or multi-industry preview showcasing questions across Business, Finance, Marketing, and Tech.
- **Recommended Fix:** Update hero preview to rotate scenarios or display a multi-industry question showcase.
- **Scope:** Landing Page Content.

### Issue 6: Typography Font Divergence on Evaluation Report
- **ID:** `CONSIST-06`
- **Severity:** `P2`
- **Page:** `FE/features/report/report.html`
- **Category:** Typography Consistency
- **Current Behavior:** Report page loads `Plus Jakarta Sans` and `Inter`, whereas the rest of the application loads `Outfit`.
- **Why it is a problem:** Creates a jarring visual break when transitioning from Practice Room to Evaluation Report.
- **Expected Behavior:** Shared typography hierarchy or intentional pairing defined in global tokens.
- **Recommended Fix:** Align Report font definitions with system typography variables.
- **Scope:** `report.html` and `report.css`.

### Issue 7: Inconsistent Empty State Implementations
- **ID:** `CONSIST-07`
- **Severity:** `P2`
- **Page:** `dashboard.html`, `history.html`, `progress.html`, `qbank.html`
- **Category:** Component Consistency
- **Current Behavior:** Each page invents its own empty state markup, icon treatment, border styling, and CTA layout.
- **Expected Behavior:** A reusable, consistent empty state component pattern (`.empty-state`) across all candidate surfaces.
- **Recommended Fix:** Standardize on a single clean empty-state pattern with vector icon, title, description, and primary CTA.
- **Scope:** Shared CSS & HTML templates.

### Issue 8: Inconsistent Button Border Radius and Sizing
- **ID:** `CONSIST-08`
- **Severity:** `P2`
- **Page:** Global
- **Category:** Component Styling
- **Current Behavior:** Button radii vary unpredictably (`7px`, `8px`, `9px`, `10px`, `12px`, `24px`).
- **Expected Behavior:** Standardized button radii defined in design tokens: `btn-sm` (6px), `btn-md` (8px), `btn-pill` (100px).
- **Recommended Fix:** Bind all button classes to `--pm-radius-*` tokens.
- **Scope:** CSS Tokens & Utility classes.

### Issue 9: Massive Inlined Stylesheets in Feature Pages
- **ID:** `CONSIST-09`
- **Severity:** `P3`
- **Page:** `jobs.html` (700+ lines CSS), `qbank.html` (600+ lines CSS), `admin.html` (500+ lines CSS)
- **Category:** Maintainability / Architecture
- **Current Behavior:** Large blocks of CSS are embedded directly within `<style>` tags in HTML files instead of external stylesheets.
- **Why it is a problem:** Prevents browser caching, bloats initial HTML transfer, and makes code navigation cumbersome.
- **Expected Behavior:** Modular feature stylesheets (`jobs.css`, `qbank.css`, `admin.css`) linked via `<link rel="stylesheet">`.
- **Recommended Fix:** Extract inline style blocks to external CSS files during remediation.
- **Scope:** Frontend Asset Extraction.

### Issue 10: Legacy Page Title on Profile Surface
- **ID:** `CONSIST-10`
- **Severity:** `P3`
- **Page:** `FE/features/profile/profile.html`
- **Category:** Navigation / Terminology
- **Current Behavior:** `<title>` tag is still set to `PrepMate - Hồ sơ & Cài đặt`.
- **Why it is a problem:** Confusing to users and inaccurate since settings were separated into `settings.html` in P1.4-B.
- **Expected Behavior:** `<title>PrepMate — Hồ sơ năng lực cá nhân</title>`.
- **Recommended Fix:** Update title tag.
- **Scope:** `profile.html`.

---

## 18. ISSUE SEVERITY SUMMARY

| Severity | Count | Impact Description |
| :--- | :--- | :--- |
| **P0 (Blocker)** | **0** | No critical functional failures or broken user flows exist. |
| **P1 (Critical Consistency)** | **4** | Design token fragmentation, `.glow-bg` visual noise, Unicode emoji overuse, and orphan DOM/script graveyards. |
| **P2 (Major Polish & Fit)** | **4** | Landing SWE bias, typography font divergence, empty state fragmentation, button radius variance. |
| **P3 (Minor Cleanliness)** | **2** | Inlined mega-stylesheets and outdated page titles. |
| **TOTAL ISSUES** | **10** | **10 Actionable Consistency Remediation Targets** |

---

## 19. RECOMMENDED REMEDIATION ORDER & PHASING

To systematically resolve these issues without risking functional regression, the following phased execution plan is recommended:

### Wave 1: Design Token Harmonization & Shell Cleanliness (P1 Focus)
1. **SSOT Token Unification:** Harmonize `tokens.css`, `style.css`, and `new-dashboard.css`. Eliminate conflicting local `--prep-*`, `--qb-*`, `--auth-*`, and `--pm-admin-*` definitions.
2. **Eliminate Background Glow:** Remove `.glow-bg` elements from candidate and admin surfaces; establish clean neutral background `#f8fafc`.
3. **Dead Code & Orphan Cleanup:** Remove dead script blocks and hidden legacy compatibility containers from `dashboard.html`, `interview-practice.html`, and `profile.html`. Add defensive checks in JS.

### Wave 2: Iconography & Typography Standardization (P1 & P2 Focus)
1. **Emoji Replacement:** Replace all structural Unicode emojis in `dashboard.html`, `report.html`, `profile.html`, and `history.html` with clean inline SVG vector icons.
2. **Typography Harmonization:** Link `report.html` to system font tokens and establish a consistent typography scale.
3. **Button & Card Geometry:** Standardize border radii (`8px` default, `16px` cards) and elevation shadows across all components.

### Wave 3: Content Polish & Component Extraction (P2 & P3 Focus)
1. **Landing Page Hero Multi-Industry Showcase:** Update the hero simulator preview on `index.html` to reflect diverse industries (Marketing, Finance, Operations, Tech).
2. **Standardized Empty States:** Unify empty state markup across Dashboard, History, Progress, and QBank.
3. **CSS Extraction:** Extract inline `<style>` blocks from `jobs.html`, `qbank.html`, and `admin.html` into dedicated external stylesheets.

---

## 20. VERIFICATION PLAN FOR REMEDIATION PHASE

Any subsequent implementation phase must enforce strict verification gates:
1. **Zero Automated Regression:**
   - `test_p14c_accessibility.js` (24/24 PASS)
   - `test_p14c_responsive.js` (19/19 PASS)
   - `test_p14_navigation.js` (10/10 PASS)
   - `test_industry_context.js` (54/54 PASS)
   - `test_p13_presentation.js` (66/66 PASS)
   - `test_interview_setup_ux.js` (20/20 PASS)
   - `test_live_interview_ux.js` (12/12 PASS)
   - `test_interview_flow.js` (30/30 PASS)
   - `test_report_ui.js` (67/67 PASS)
   - .NET Backend Build (0 Warnings / 0 Errors)
2. **New Consistency Regression Suite:**
   - Create `test_p15_consistency.js` to verify:
     - No orphan `.glow-bg` elements active on light theme.
     - Zero raw emojis inside key interactive buttons and tabs.
     - Single unified CSS token usage across all 18 surfaces.
     - Zero dead script error logs in browser console.
3. **Multi-Platform Visual Inspection:**
   - Verify layout rendering on Chromium, Firefox, WebKit, and mobile viewport breakpoints (375px, 768px, 1024px, 1440px).

---

## 21. CONCLUSION & STATUS

This audit completes the comprehensive evaluation of the entire PrepMate UX/UI design system, component hierarchy, and cross-surface coherence. While the platform's core functional mechanics, AI interview pipelines, and evaluation engines are highly robust and fully tested, the user experience currently exhibits noticeable styling fragmentation and superficial AI embellishments that detract from its enterprise value proposition.

Adopting the recommended 3-wave remediation plan will elevate PrepMate to an executive-tier, cohesive, and refined professional interview coaching platform.

**P1.5 — AUDIT COMPLETE**  
*(This phase is strictly concluded as an audit report. No code changes have been applied. Awaiting review and approval before proceeding to implementation.)*
