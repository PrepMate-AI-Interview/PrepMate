# PrepMate — Documentation Index

Welcome to the **PrepMate** documentation directory. All technical specifications, architectural decisions, feature contracts, and quality assurances are categorized into semantic domains.

---

## 1. System Architecture & Foundation (`docs/system/`)
Core architectural specifications and platform design standards:
- [System Overview](system/SYSTEM_OVERVIEW.md): Mission, supported industries, and high-level platform capabilities.
- [System Architecture](system/SYSTEM_ARCHITECTURE.md): Monolithic Kestrel architecture, technology stack, and component diagram.
- [Feature Overview](system/FEATURE_OVERVIEW.md): Comprehensive feature directory and page routing index across all 20 HTML views.
- [User Roles & Permissions](system/USER_ROLES.md): Complete RBAC permissions matrix (Guest, User, Manager, Admin).
- [Data Model & Entities](system/DATA_MODEL.md): JSON entity schemas (`User`, `Session`, `CandidateCV`, `PaymentTransaction`, `AIConfiguration`).
- [System Flows](system/SYSTEM_FLOWS.md): Sequence diagrams for authentication, live interview turns, and STAR reporting.
- [Design System](system/DESIGN_SYSTEM.md): Design tokens SSOT (`--pm-*`), typography, button geometry, and HUD styling rules.

---

## 2. Feature Specifications (`docs/features/`)
In-depth technical guides for each platform capability:
- [Authentication & Identity](features/AUTHENTICATION.md): Registration, login, PBKDF2 hashing, and JWT lifecycle.
- [Virtual Interview Experience](features/INTERVIEW.md): 4-step wizard, Live HUD room, webcam/mic streams, and UI state machine.
- [Adaptive AI Interview Engine](features/ADAPTIVE_INTERVIEW.md): Conversational deepening, contradiction detection, and evidence verification.
- [CV Upload & Parsing](features/CV_ANALYSIS.md): Resume parsing, skill extraction, and suitability scoring.
- [Job Recommendations](features/JOB_RECOMMENDATION.md): AI-driven matching between candidate skills and market job roles.
- [Career Roadmap](features/CAREER_ROADMAP.md): Phased skill acquisition milestones and career acceleration advice.
- [STAR Performance Reporting](features/REPORTING.md): Multi-dimensional performance evaluation and diagnostic scoring.
- [Subscription & Payments](features/PAYMENT.md): Multi-channel checkout simulation (MoMo, ZaloPay, Card) and Pro tier provisioning.
- [Administration Console](features/ADMINISTRATION.md): Candidate directory, role modification, tier overrides, and live AI configuration.

---

## 3. Quality & Security Assurance (`docs/quality/`)
Quality engineering, security defenses, and testing guidelines:
- [Testing Architecture & Guide](quality/TESTING.md): Centralized test runner, suite descriptions, and regression assertions.
- [Runtime & E2E System Audit](quality/RUNTIME_E2E.md): 40-dimension runtime audit verifying all live operational flows.
- [Security Architecture](quality/SECURITY.md): Cryptographic hashing, BOLA/IDOR defenses, input validation, and hardening gates.
- [Data Integrity & Concurrency](quality/DATA_INTEGRITY.md): FileDb persistence, monitor locking, atomic file moves, and crash recovery.
- [Accessibility Compliance](quality/ACCESSIBILITY.md): WCAG 2.1 AA focus rings, semantic ARIA landmarks, and live status announcers.
- [Performance & Optimization](quality/PERFORMANCE.md): Response compression, stylesheet extraction, and zero-framework performance.
- [Repository Normalization Report](quality/REPOSITORY_DOCUMENTATION.md): Documentation reorganization audit report.

---

## 4. Deployment & Operations (`docs/deployment/`)
Environment setup and deployment readiness:
- [Local Development Setup](deployment/DEVELOPMENT_SETUP.md): Prerequisites (.NET 10, Node.js), server launch, and testing execution.
- [Configuration Reference](deployment/CONFIGURATION.md): Environment variables, app settings, and AI gateway parameters.
- [Production Readiness](deployment/PRODUCTION_READINESS.md): Production checklist, actionable security gates, and current limitations.

---

## 5. History & Decision Archive (`docs/history/`)
Project evolution and historical audit reports:
- [Changelog](history/CHANGELOG.md): Major milestone evolution log.
- [Architecture Decision Records (ADRs)](history/ARCHITECTURE_DECISIONS.md): Key technical decisions and tradeoffs.
- **Historical Audit Reports:** Archive of 20 detailed historical development reports moved and preserved with descriptive titles.
