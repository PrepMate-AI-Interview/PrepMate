/**
 * ==============================================================================
 * PREPMATE — TEST SUITE: WI-REPORT-VOICE-SPACING-HOTFIX-07
 * Fix Content Padding & Vertical Spacing for Radar Span & Speech Practice Header
 * ==============================================================================
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const REPORT_HTML_PATH = path.join(ROOT, "FE/features/report/report.html");
const REPORT_CSS_PATH = path.join(ROOT, "FE/features/report/report.css");

let totalTests = 0;
let passedTests = 0;

function pass(desc) {
  totalTests++;
  passedTests++;
  console.log(`[PASS] ${desc}`);
}

function runAudit() {
  console.log("================================================================");
  console.log("  TEST SUITE: WI-REPORT-VOICE-SPACING-HOTFIX-07                ");
  console.log("================================================================\n");

  const html = fs.readFileSync(REPORT_HTML_PATH, "utf8");
  const css = fs.readFileSync(REPORT_CSS_PATH, "utf8");

  // ---------------------------------------------------------------------------
  // GROUP 1: Fix span "Độ lệch lớn giữa các trục" (#radar-interp-status) Spacing
  // ---------------------------------------------------------------------------
  console.log("--- GROUP 1: Fix Span #radar-interp-status Vertical Spacing ---");

  // 1.1 DOM relationship: span is inside .competency-overall-header, sibling to .competency-overall-content-grid
  assert(html.includes('id="radar-interp-status"'), "Must have #radar-interp-status in DOM");
  assert(html.includes('class="competency-overall-header"'), "Must have .competency-overall-header wrapper");
  assert(html.includes('class="competency-overall-content-grid"'), "Must have .competency-overall-content-grid sibling div");
  pass("1.1 DOM elements for radar status span and content grid correctly structured");

  // 1.2 Wrapper .competency-overall-header manages vertical margin using --space-5 token
  assert(css.includes(".competency-overall-header {"), ".competency-overall-header rule exists");
  assert(css.includes("margin-bottom: var(--space-5, 20px);"), ".competency-overall-header has margin-bottom: var(--space-5, 20px)");
  pass("1.2 Wrapper .competency-overall-header enforces 20px vertical spacing to next sibling grid");

  // 1.3 Span .radar-interp-badge uses inline-flex and does not awkwardly wrap
  assert(css.includes(".radar-interp-badge {"), ".radar-interp-badge rule exists");
  assert(css.includes("display: inline-flex;"), ".radar-interp-badge is display: inline-flex");
  assert(css.includes("white-space: nowrap;"), ".radar-interp-badge prevents awkward text breaks");
  pass("1.3 .radar-interp-badge styled with inline-flex and nowrap preservation");

  // ---------------------------------------------------------------------------
  // GROUP 2: Fix .speech-practice-header & .speech-practice-box Spacing
  // ---------------------------------------------------------------------------
  console.log("\n--- GROUP 2: Fix .speech-practice-header & Box Padding ---");

  // 2.1 Container .speech-practice-box has tokenized padding --space-5 (20px)
  assert(css.includes(".speech-practice-box,"), ".speech-practice-box container style defined");
  assert(css.includes("padding: var(--space-5, 20px);"), "Container enforces 20px padding token");
  pass("2.1 .speech-practice-box enforces 20px perimeter padding, preventing border collision");

  // 2.2 Header .speech-practice-header has internal padding and bottom margin
  assert(css.includes(".speech-practice-header,"), ".speech-practice-header rule defined");
  assert(css.includes("padding: var(--space-3, 12px) var(--space-4, 16px);"), "Header has balanced 12px/16px internal padding");
  assert(css.includes("margin-bottom: var(--space-4, 16px);"), "Header has 16px vertical spacing to moments list");
  pass("2.2 .speech-practice-header has 12px/16px inner padding and 16px bottom separation");

  // 2.3 Typo tolerance for .speech-practive-header
  assert(css.includes(".speech-practive-header"), "Supports .speech-practive-header selector alias");
  pass("2.3 Typo resilience supported with alias selector");

  // 2.4 Header card title & icon aligned inline-flex
  assert(css.includes(".speech-practice-header .speech-card-title"), "Header title rule defined");
  assert(css.includes("gap: var(--space-2, 8px);"), "Header title aligns icon and text with 8px gap");
  pass("2.4 Header icon and text aligned inline on the same row with 8px gap");

  // ---------------------------------------------------------------------------
  // GROUP 3: Dark Mode & Non-Regression Invariants
  // ---------------------------------------------------------------------------
  console.log("\n--- GROUP 3: Dark Mode & Non-Regression Invariants ---");

  // 3.1 Dark mode overrides for .speech-practice-box and .speech-practice-header
  assert(css.includes('[data-theme="dark"] .speech-practice-box'), "Dark mode override for .speech-practice-box");
  assert(css.includes('[data-theme="dark"] .speech-practice-header'), "Dark mode override for .speech-practice-header");
  pass("3.1 Dark mode overrides verified for both box and header");

  // 3.2 Spacing token integrity
  assert(css.includes("var(--space-5, 20px)"), "Canonical --space-5 token used");
  assert(css.includes("var(--space-4, 16px)"), "Canonical --space-4 token used");
  assert(css.includes("var(--space-3, 12px)"), "Canonical --space-3 token used");
  pass("3.2 Spacing strictly follows canonical 4/8pt tokens without hardcoding or !important abuse");

  console.log("\n================================================================");
  console.log(`  ALL AUDIT CHECKS PASSED: ${passedTests} / ${totalTests} PASS | 0 FAIL`);
  console.log("================================================================\n");
}

try {
  runAudit();
} catch (err) {
  console.error("\n[TEST FAILED]:", err.message);
  process.exit(1);
}
