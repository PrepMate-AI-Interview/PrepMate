# PrepMate — System Changelog & Evolution History

## Overview
This changelog documents the key architectural milestones and quality remediations achieved throughout the development of PrepMate.

---

## Evolution Milestones

### Milestone 6 — Repository Normalization & Canonical Documentation
- Centralized documentation catalog into semantic domains (`system`, `features`, `quality`, `deployment`, `history`).
- Renamed all phase-based test suites to semantic responsibility names (`presentation-layer.test.js`, `navigation-architecture.test.js`, `design-tokens.test.js`, `ui-iconography.test.js`, `product-showcase.test.js`, `stylesheet-extraction.test.js`).
- Migrated 20 historical development reports into `docs/history/` with clean descriptive titles.
- Re-indexed root `README.md` and `docs/README.md`.

### Milestone 5 — Full Runtime & End-to-End System Audit
- Executed comprehensive 40-dimension runtime audit against live ASP.NET Core 10 Kestrel server.
- Verified 41/41 operational checks across Guest, Register, Login, RBAC, IDOR, AI Turns, STAR Report, CV Parsing, and MoMo Payment.
- Identified 0 P0 showstoppers, 3 P1 security/resilience notices, 3 P2 medium notices, and 3 P3 low notices.

### Milestone 4 — Codebase Structural Refactoring & Normalization
- Centralized all testing code into decoupled `tests/` directory.
- Removed dead 0-byte C# stubs and orphan root scripts.
- Verified 13 regression suites (429/429 assertions pass) and 0 backend build warnings.

### Milestone 3 — UI/UX & Design System Consistency Remediation
- **Design Tokens SSOT:** Unified colors, surfaces, and spacing under canonical `--pm-*` CSS tokens. Standardized button geometry (8px radius).
- **Iconography Standardization:** Replaced raw Unicode emojis with inline SVG vector icons. Standardized typography to Google Outfit typeface.
- **Multi-Industry Product Showcase:** Transformed landing page simulator from software-only assumptions into 5 realistic industry tracks (IT, Marketing, Finance, HR, BA).
- **Stylesheet Extraction:** Extracted over 2,600 lines of inline CSS into dedicated stylesheets (`admin.css`, `jobs.css`, `qbank.css`).

### Milestone 2 — Information Architecture, Navigation & Accessibility
- Clean separation between User Profile (`profile.html`) and System Settings (`settings.html`).
- Created dedicated error route (`404.html`) with fallback navigation.
- Remediated WCAG 2.1 AA accessibility (focus rings, ARIA landmarks, screen reader announcements) and responsive layouts (375px–1024px).

### Milestone 1 — Core Interview Engine & Multi-Industry Expansion
- Established 4-step interview setup wizard and live Zoom-style conference HUD room.
- Built adaptive AI interview engine with question deepening, contradiction detection, and unverified metric challenges.
- Implemented STAR performance scoring breakdown across 6 evaluation dimensions.
- Hardened authentication with PBKDF2 password hashing, JWT Bearer tokens, and BOLA/IDOR protection.
