/**
 * PREPMATE — WI-DESIGN-09: SESSION HISTORY EXPERIENCE & DATA INTEGRITY AUDIT
 *
 * Verifies:
 * 1. Canonical Stylesheet Foundation & Token Mapping
 * 2. Visual Hierarchy & Preserved DOM Structural Elements
 * 3. Session Data Contracts & 100-Point Normalized Scoring
 * 4. Canonical Persona SSOT Integration & Interviewer Badge
 * 5. Session Status Mapping & Action Contracts
 * 6. Search, Filter & Empty State Integrity
 * 7. Production Database SHA-256 Invariant (Zero Mutations)
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "interview", "history.html");
const CSS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "interview", "history.css");
const MANIFEST_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "interview", "interview-persona-manifest.js");
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");

const BASELINE_DB_HASH = "C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7";

const htmlContent = fs.readFileSync(HTML_PATH, "utf8");
const cssContent = fs.readFileSync(CSS_PATH, "utf8");
const personasManifest = require(MANIFEST_PATH);

console.log("===============================================================");
console.log("   WI-DESIGN-09: SESSION HISTORY EXPERIENCE AUDIT SUITE        ");
console.log("===============================================================\n");

let passCount = 0;
let failCount = 0;

function runCheck(group, name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// GROUP 1: CANONICAL STYLESHEET FOUNDATION & TOKEN MAPPING
// -------------------------------------------------------------
console.log("--- GROUP 1: Canonical Stylesheet Foundation & Token Mapping ---");

runCheck(1, "1.1 Canonical stylesheets linked in history.html head", () => {
  assert(htmlContent.includes('tokens.css'), "Must link tokens.css");
  assert(htmlContent.includes('base.css'), "Must link base.css");
  assert(htmlContent.includes('layout.css'), "Must link layout.css");
  assert(htmlContent.includes('components.css'), "Must link components.css");
  assert(htmlContent.includes('style.css'), "Must link style.css");
  assert(htmlContent.includes('new-dashboard.css'), "Must link new-dashboard.css");
  assert(htmlContent.includes('history.css'), "Must link history.css");
});

runCheck(1, "1.2 History custom properties map directly to canonical --pm-* tokens", () => {
  assert(/--hist-bg:\s*var\(--pm-bg/.test(cssContent), "--hist-bg must map to --pm-bg");
  assert(/--hist-surface:\s*var\(--pm-surface/.test(cssContent), "--hist-surface must map to --pm-surface");
  assert(/--hist-border:\s*var\(--pm-border/.test(cssContent), "--hist-border must map to --pm-border");
  assert(/--hist-primary:\s*var\(--pm-primary/.test(cssContent), "--hist-primary must map to --pm-primary");
  assert(/--hist-text-primary:\s*var\(--pm-text-primary/.test(cssContent), "--hist-text-primary must map to --pm-text-primary");
  assert(/--hist-text-secondary:\s*var\(--pm-text-secondary/.test(cssContent), "--hist-text-secondary must map to --pm-text-secondary");
  assert(/--hist-text-muted:\s*var\(--pm-text-muted/.test(cssContent), "--hist-text-muted must map to --pm-text-muted");
});

runCheck(1, "1.3 Clean hairline border and elevation hierarchy", () => {
  assert(/--hist-radius:\s*var\(--pm-radius-lg/.test(cssContent), "Card radius mapped to canonical radius");
  assert(/--hist-shadow-sm:\s*var\(--pm-shadow-sm/.test(cssContent), "Card shadow-sm mapped to canonical shadow");
  assert(/--hist-shadow-md:\s*var\(--pm-shadow-md/.test(cssContent), "Card shadow-md mapped to canonical shadow");
});

// -------------------------------------------------------------
// GROUP 2: VISUAL HIERARCHY & PRESERVED DOM ELEMENTS
// -------------------------------------------------------------
console.log("\n--- GROUP 2: Visual Hierarchy & Preserved DOM Structural Elements ---");

runCheck(2, "2.1 Essential page structure elements exist", () => {
  assert(htmlContent.includes('class="history-page-header"'), "history-page-header container must exist");
  assert(htmlContent.includes('class="history-metrics-row"'), "history-metrics-row container must exist");
  assert(htmlContent.includes('class="history-filter-bar"'), "history-filter-bar container must exist");
  assert(htmlContent.includes('id="history-full-list"'), "history-full-list container must exist");
  assert(htmlContent.includes('id="main-sidebar"'), "main-sidebar container must exist");
});

runCheck(2, "2.2 Metrics overview preserved with accurate IDs", () => {
  assert(htmlContent.includes('id="hist-total-count"'), "#hist-total-count must exist");
  assert(htmlContent.includes('id="hist-avg-score"'), "#hist-avg-score must exist");
  assert(htmlContent.includes('id="hist-completed-count"'), "#hist-completed-count must exist");
  assert(htmlContent.includes('id="hist-total-minutes"'), "#hist-total-minutes must exist");
});

runCheck(2, "2.3 Filter & search toolbar inputs preserved with accurate IDs", () => {
  assert(htmlContent.includes('id="hist-search-input"'), "#hist-search-input must exist");
  assert(htmlContent.includes('id="hist-status-filter"'), "#hist-status-filter must exist");
  assert(htmlContent.includes('id="hist-level-filter"'), "#hist-level-filter must exist");
});

// -------------------------------------------------------------
// GROUP 3: SESSION DATA CONTRACTS & 100-POINT NORMALIZED SCORING
// -------------------------------------------------------------
console.log("\n--- GROUP 3: Session Data Contracts & 100-Point Normalized Scoring ---");

runCheck(3, "3.1 100-point score normalization logic in history render logic", () => {
  assert(htmlContent.includes("numericScore <= 10 && numericScore > 0 ? numericScore * 10 : numericScore"), "Normalizes 10-point scores to 100-point scale");
  assert(htmlContent.includes("displayScore = '—'"), "Honest null indicator '—' initialized for unassessed sessions");
});

runCheck(3, "3.2 Score classification tiers match semantic thresholds", () => {
  assert(htmlContent.includes("normalized >= 80 ? 'score-high' : normalized >= 60 ? 'score-mid' : 'score-low'"), "Semantic tiers: >=80 high, >=60 mid, <60 low");
  assert(cssContent.includes(".history-item-score.score-high"), "history.css styles high score with success colors");
  assert(cssContent.includes(".history-item-score.score-mid"), "history.css styles mid score with warning colors");
  assert(cssContent.includes(".history-item-score.score-low"), "history.css styles low score with danger colors");
  assert(cssContent.includes(".history-item-score.score-null"), "history.css styles null score with neutral surface");
});

runCheck(3, "3.3 Average score metrics calculation avoids fake zeros", () => {
  assert(htmlContent.includes("scores.reduce((a, b) => a + b, 0) / scores.length") || htmlContent.includes("filter(x => x > 0)"), "Excludes 0 scores from average computation");
});

// -------------------------------------------------------------
// GROUP 4: CANONICAL PERSONA SSOT & INTERVIEWER BADGE
// -------------------------------------------------------------
console.log("\n--- GROUP 4: Canonical Persona SSOT Integration ---");

runCheck(4, "4.1 interview-persona-manifest.js loaded", () => {
  assert(htmlContent.includes("interview-persona-manifest.js"), "history.html must load interview-persona-manifest.js");
});

runCheck(4, "4.2 Manifest defines canonical personas", () => {
  assert(personasManifest.getPersona("professional").name.includes("Trần Minh Vũ"), "Professional persona is Trần Minh Vũ");
  assert(personasManifest.getPersona("friendly").name.includes("Lê Lan Anh"), "Friendly persona is Lê Lan Anh");
  assert(personasManifest.getPersona("balanced").name.includes("Nguyễn Hoàng Nam"), "Balanced persona is Nguyễn Hoàng Nam");
});

runCheck(4, "4.3 Session card renders canonical interviewer badge", () => {
  assert(htmlContent.includes('pm-interviewer-badge'), "Session cards include pm-interviewer-badge");
  assert(htmlContent.includes('PrepMatePersonas.getPersona'), "Uses PrepMatePersonas SSOT to resolve persona name");
});

// -------------------------------------------------------------
// GROUP 5: STATUS MAPPING & ACTION CONTRACTS
// -------------------------------------------------------------
console.log("\n--- GROUP 5: Status Mapping & Action Contracts ---");

runCheck(5, "5.1 Session status pills differentiate completed, in-progress, and incomplete", () => {
  assert(htmlContent.includes('pm-status-pill done'), "Has status pill for completed");
  assert(htmlContent.includes('pm-status-pill in-progress'), "Has status pill for in-progress");
  assert(htmlContent.includes('pm-status-pill incomplete'), "Has status pill for incomplete");
});

runCheck(5, "5.2 Action buttons adhere to workflow routes", () => {
  assert(htmlContent.includes('report.html?sessionId='), "Completed sessions link to report.html with sessionId");
  assert(htmlContent.includes('interview-practice.html?resume='), "In-progress sessions provide resume route");
  assert(htmlContent.includes('repracticeFromHistory'), "Provides repracticeFromHistory re-practice trigger");
});

// -------------------------------------------------------------
// GROUP 6: SEARCH, FILTER & EMPTY STATE INTEGRITY
// -------------------------------------------------------------
console.log("\n--- GROUP 6: Search, Filter & Empty State Integrity ---");

runCheck(6, "6.1 Search and filter bar supports responsive reflow", () => {
  assert(cssContent.includes('.history-filter-bar'), "history.css styles filter toolbar");
  assert(cssContent.includes('flex-wrap: wrap;'), "Toolbar enables wrap for responsiveness");
  assert(cssContent.includes('min-width: 240px;'), "Search input preserves min-width: 240px;");
});

runCheck(6, "6.2 Empty state provides constructive action and clean vector icons", () => {
  assert(htmlContent.includes('empty-state-new'), "Contains empty-state-new component");
  assert(htmlContent.includes('interview-info.html'), "Empty state CTA links to new interview setup");
  assert(!htmlContent.includes('<span>▶</span>'), "Empty state does not use raw unicode play glyph");
});

// -------------------------------------------------------------
// GROUP 7: PRODUCTION DATABASE SHA-256 INVARIANT
// -------------------------------------------------------------
console.log("\n--- GROUP 7: Production Database SHA-256 Invariant ---");

runCheck(7, "7.1 Production database db.json unmodified", () => {
  assert(fs.existsSync(PROD_DB_PATH), "BE/data/db.json must exist");
  const dbBytes = fs.readFileSync(PROD_DB_PATH);
  const currentHash = crypto.createHash("sha256").update(dbBytes).digest("hex").toUpperCase();
  assert.strictEqual(
    currentHash,
    BASELINE_DB_HASH,
    `db.json SHA-256 must match baseline ${BASELINE_DB_HASH}, got: ${currentHash}`
  );
});

console.log("\n===============================================================");
console.log(`TOTAL AUDIT CHECKS: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);
console.log("===============================================================");

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
