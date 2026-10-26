# PrepMate Quality — Testing Architecture & Guide

## 1. Overview
The PrepMate automated testing framework is centralized in `tests/` and decoupled from production source trees. It consists of **22 static regression suites (665 checks PASS)**, 1 live conversational integration suite, and an end-to-end browser acceptance suite driving headless Edge/Chrome via Chrome DevTools Protocol (CDP).

---

## 2. Test Directory Structure

```text
tests/
├── README.md                              # Testing documentation
├── run-all.js                             # Master regression runner (22 suites, 665 assertions)
├── run-integration.js                     # Live server integration test runner
├── run-e2e.js                             # Live AI E2E and browser test runner
├── helpers/
│   └── test-env.js                        # Standardized path resolver helper
├── regression/                            # 16 core regression suites
│   ├── industry-context.test.js           # 54 checks: Multi-industry context & JobFamily
│   ├── presentation-layer.test.js         # 66 checks: Multi-industry scorecards & layout
│   ├── interview-setup-ux.test.js         # 20 checks: Setup wizard & CV dropzone
│   ├── live-interview-ux.test.js          # 12 checks: Conference HUD & media controls
│   ├── interview-flow.test.js             # 35 checks: FSM transitions, TTS & Gemini fallback
│   ├── navigation-architecture.test.js    # 10 checks: Information architecture & routes
│   ├── report-ui.test.js                  # 69 checks: STAR scorecard & 100-point hero score
│   ├── interview-api-config.test.js       # 9 checks: Environment-independent API config
│   ├── interview-ai-resilience.test.js    # 10 checks: Gateway error recovery & timeouts
│   ├── admin-ai-config.test.js            # 53 checks: Presets, precedence & credential masking
│   ├── admin-ai-registry.test.js          # 63 checks: Provider adapters & registry
│   ├── ai-architecture-reconstruction.test.js # 13 checks: AIRouter & IPrepMateAIClient
│   ├── combo-root-alias.test.js           # 15 checks: Single alias PrepMate & Combo Root
│   ├── vilao-model-discovery.test.js      # 13 checks: Dynamic model discovery
│   ├── evidence-ledger-consistency.test.js # 14 checks: EvidenceLedger claim/fact isolation
│   └── scoring-standardization.test.js    # 39 checks: 100-point scale, clamping, unrounded mean
├── accessibility/                         # WCAG 2.1 AA compliance
│   └── accessibility.test.js              # 24 checks: Focus rings, ARIA landmarks, keyboard nav
├── responsive/                            # Multi-viewport responsiveness (375px - 1024px)
│   └── responsive.test.js                 # 19 checks: Breakpoints, table layout, mobile cards
├── consistency/                           # Design tokens & UI consistency
│   ├── design-tokens.test.js              # 45 checks: Canonical --pm-* tokens SSOT
│   ├── ui-iconography.test.js             # 51 checks: Inline SVG vector icons & Outfit typography
│   ├── product-showcase.test.js           # 17 checks: 5-industry interactive showcase
│   └── stylesheet-extraction.test.js      # 14 checks: External CSS & 58 HUD IDs preservation
├── integration/                           # Server-authoritative integration tests
│   └── conversational-persona.test.js     # 8 cases: Multi-turn live AI conversational turns
└── e2e/                                   # Full browser CDP acceptance tests
    └── cross-industry-live.test.js        # 20 scenarios across 5 industries + DOM report audit
```

---

## 3. How to Execute Tests

### 3.1 Static Regression Runner (CI/CD Baseline, Fast, Offline)
Runs all 22 test suites completely offline without live AI credentials:
```bash
node tests/run-all.js
```
*Expected Result: 22/22 suites pass, 665/665 assertions PASS (~30s).*

### 3.2 Single Test Suite Execution
```bash
node tests/regression/scoring-standardization.test.js
node tests/regression/combo-root-alias.test.js
node tests/regression/report-ui.test.js
node tests/accessibility/accessibility.test.js
```

### 3.3 Live End-to-End & Browser Acceptance Test
Executes the 20-scenario cross-industry benchmark with headless Edge/Chrome:
```bash
# Set your Vilao API key:
# Windows PowerShell: $env:VILAO_API_KEY="sk-..."
# Linux / macOS: export VILAO_API_KEY="sk-..."

node tests/run-e2e.js
```

---

## 4. Database Safety During Testing
- **Production Database Protection:** Production database (`BE/data/db.json`) has baseline SHA-256 hash `D2F70C35456A0AA5968DE4FDD6A41E70C08371FF9CC193A69BBD081714A30323`.
- **Zero-Pollution Guarantee:** Integration and E2E test suites redirect storage using `DATABASE_FILE_PATH` to temporary directories (`os.tmpdir()`), ensuring the production database is never modified during tests.
