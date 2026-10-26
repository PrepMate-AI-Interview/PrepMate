/**
 * PREPMATE — WI-DESIGN-10: PROGRESS & ANALYTICS EXPERIENCE AUDIT
 *
 * Verifies:
 * 1. Canonical Stylesheet Foundation & Token Mapping
 * 2. Visual Hierarchy & Preserved DOM Structural Elements
 * 3. Accessibility Standards & ARIA Landlords
 * 4. Data Contracts & 100-Point Normalized Scoring
 * 5. Domain-Aware Radar Dimensions & Unbiased Phrasing
 * 6. Charts, Heatmap & Interactive Modal Contracts
 * 7. Production Database SHA-256 Invariant (Zero Mutations)
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "progress", "progress.html");
const CSS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "progress", "progress.css");
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");

const BASELINE_DB_HASH = "C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7";

const htmlContent = fs.readFileSync(HTML_PATH, "utf8");
const cssContent = fs.readFileSync(CSS_PATH, "utf8");

console.log("===============================================================");
console.log("   WI-DESIGN-10: PROGRESS & ANALYTICS EXPERIENCE AUDIT SUITE   ");
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

runCheck(1, "1.1 Canonical stylesheets linked in progress.html head", () => {
  assert(htmlContent.includes('tokens.css'), "Must link tokens.css");
  assert(htmlContent.includes('base.css'), "Must link base.css");
  assert(htmlContent.includes('layout.css'), "Must link layout.css");
  assert(htmlContent.includes('components.css'), "Must link components.css");
  assert(htmlContent.includes('style.css'), "Must link style.css");
  assert(htmlContent.includes('new-dashboard.css'), "Must link new-dashboard.css");
  assert(htmlContent.includes('progress.css'), "Must link progress.css");
});

runCheck(1, "1.2 Progress custom properties map directly to canonical --pm-* tokens", () => {
  assert(/--prog-bg:\s*var\(--pm-bg/.test(cssContent), "--prog-bg must map to --pm-bg");
  assert(/--prog-surface:\s*var\(--pm-surface/.test(cssContent), "--prog-surface must map to --pm-surface");
  assert(/--prog-border:\s*var\(--pm-border/.test(cssContent), "--prog-border must map to --pm-border");
  assert(/--prog-primary:\s*var\(--pm-primary/.test(cssContent), "--prog-primary must map to --pm-primary");
  assert(/--prog-text-primary:\s*var\(--pm-text-primary/.test(cssContent), "--prog-text-primary must map to --pm-text-primary");
  assert(/--prog-text-secondary:\s*var\(--pm-text-secondary/.test(cssContent), "--prog-text-secondary must map to --pm-text-secondary");
  assert(/--prog-text-muted:\s*var\(--pm-text-muted/.test(cssContent), "--prog-text-muted must map to --pm-text-muted");
});

runCheck(1, "1.3 Clean hairline border and elevation hierarchy", () => {
  assert(/--prog-radius:\s*var\(--pm-radius-lg/.test(cssContent), "Card radius mapped to canonical radius");
  assert(/--prog-shadow-sm:\s*var\(--pm-shadow-sm/.test(cssContent), "Card shadow-sm mapped to canonical shadow");
  assert(/--prog-shadow-md:\s*var\(--pm-shadow-md/.test(cssContent), "Card shadow-md mapped to canonical shadow");
  assert(!htmlContent.includes('class="glow-bg"'), "Must not contain legacy glow-bg container");
});

// -------------------------------------------------------------
// GROUP 2: VISUAL HIERARCHY & PRESERVED DOM STRUCTURAL ELEMENTS
// -------------------------------------------------------------
console.log("\n--- GROUP 2: Visual Hierarchy & Preserved DOM Structural Elements ---");

runCheck(2, "2.1 Essential page structure elements exist", () => {
  assert(htmlContent.includes('class="progress-hero"'), "progress-hero container must exist");
  assert(htmlContent.includes('id="progress-empty-alert"'), "#progress-empty-alert container must exist");
  assert(htmlContent.includes('id="stats-grid"'), "#stats-grid container must exist");
  assert(htmlContent.includes('id="trend-chart"'), "#trend-chart canvas element must exist");
  assert(htmlContent.includes('id="radar-chart"'), "#radar-chart canvas element must exist");
  assert(htmlContent.includes('id="heatmap-grid"'), "#heatmap-grid container must exist");
  assert(htmlContent.includes('id="badges-grid"'), "#badges-grid container must exist");
  assert(htmlContent.includes('id="improvements-list"'), "#improvements-list container must exist");
  assert(htmlContent.includes('id="improvement-modal-overlay"'), "#improvement-modal-overlay element must exist");
});

runCheck(2, "2.2 Metrics overview preserved with accurate IDs", () => {
  assert(htmlContent.includes('id="stat-total"'), "#stat-total must exist");
  assert(htmlContent.includes('id="stat-best"'), "#stat-best must exist");
  assert(htmlContent.includes('id="stat-avg"'), "#stat-avg must exist");
  assert(htmlContent.includes('id="stat-improve"'), "#stat-improve must exist");
  assert(htmlContent.includes('id="stat-streak"'), "#stat-streak must exist");
});

runCheck(2, "2.3 Heatmap controls and filter preserved", () => {
  assert(htmlContent.includes('id="heatmap-year-select"'), "#heatmap-year-select must exist");
  assert(htmlContent.includes('id="heatmap-month-select"'), "#heatmap-month-select must exist");
});

// -------------------------------------------------------------
// GROUP 3: ACCESSIBILITY STANDARDS & ARIA LANDLORDS
// -------------------------------------------------------------
console.log("\n--- GROUP 3: Accessibility Standards & ARIA Landlords ---");

runCheck(3, "3.1 Empty state alerts have polite status roles", () => {
  assert(
    /<div[^>]*id="progress-empty-alert"[^>]*role="status"[^>]*aria-live="polite"/i.test(htmlContent) ||
    /<div[^>]*aria-live="polite"[^>]*role="status"[^>]*id="progress-empty-alert"/i.test(htmlContent) ||
    /<div[^>]*id="progress-empty-alert"[^>]*role="status"/i.test(htmlContent),
    "#progress-empty-alert must have role='status'"
  );
  assert(htmlContent.includes('aria-live="polite"'), "#progress-empty-alert must have aria-live='polite'");
});

runCheck(3, "3.2 Chart empty states have role='status'", () => {
  assert(/<div[^>]*id="trend-empty-state"[^>]*role="status"/i.test(htmlContent), "#trend-empty-state must have role='status'");
  assert(/<div[^>]*id="radar-empty-state"[^>]*role="status"/i.test(htmlContent), "#radar-empty-state must have role='status'");
});

// -------------------------------------------------------------
// GROUP 4: DATA CONTRACTS & 100-POINT NORMALIZED SCORING
// -------------------------------------------------------------
console.log("\n--- GROUP 4: Data Contracts & 100-Point Normalized Scoring ---");

runCheck(4, "4.1 normalizeSession extracts modern report overallEvaluation normalizedScore", () => {
  assert(htmlContent.includes('report?.overallEvaluation?.normalizedScore'), "Must extract report.overallEvaluation.normalizedScore");
  assert(htmlContent.includes('report?.overallEvaluation?.score'), "Must fallback to report.overallEvaluation.score");
});

runCheck(4, "4.2 normalizeSession converts 10-point scale to 100-point scale", () => {
  assert(
    htmlContent.includes('if (overall <= 10 && overall > 0) overall = overall * 10;'),
    "Must normalize <= 10 overall scores to 100-point scale"
  );
});

runCheck(4, "4.3 Metric values display honest '—' when no sessions exist", () => {
  assert(htmlContent.includes("'—'"), "Must use em-dash '—' for missing/empty metrics");
});

// -------------------------------------------------------------
// GROUP 5: DOMAIN-AWARE RADAR DIMENSIONS & UNBIASED PHRASING
// -------------------------------------------------------------
console.log("\n--- GROUP 5: Domain-Aware Radar Dimensions & Unbiased Phrasing ---");

runCheck(5, "5.1 getProgressDomainLabel function exists and supports multiple domains", () => {
  assert(htmlContent.includes('function getProgressDomainLabel'), "getProgressDomainLabel function must be defined");
  assert(htmlContent.includes("'Kỹ thuật'"), "Must support Kỹ thuật");
  assert(htmlContent.includes("'Marketing'"), "Must support Marketing");
  assert(htmlContent.includes("'Tài chính'"), "Must support Tài chính");
  assert(htmlContent.includes("'Phân tích Nghiệp vụ'"), "Must support Phân tích Nghiệp vụ");
  assert(htmlContent.includes("'Chuyên môn'"), "Must default to Chuyên môn");
});

runCheck(5, "5.2 Free of domain bias phrasing in improvements", () => {
  assert(!htmlContent.includes('giải pháp kỹ thuật'), "Must NOT contain hardcoded bias phrase 'giải pháp kỹ thuật'");
});

// -------------------------------------------------------------
// GROUP 6: CHARTS, HEATMAP & INTERACTIVE MODAL CONTRACTS
// -------------------------------------------------------------
console.log("\n--- GROUP 6: Charts, Heatmap & Interactive Modal Contracts ---");

runCheck(6, "6.1 Chart.js instances properly initialized and destroyed on refresh", () => {
  assert(htmlContent.includes('trendChartInstance'), "trendChartInstance tracker must exist");
  assert(htmlContent.includes('radarChartInstance'), "radarChartInstance tracker must exist");
  assert(htmlContent.includes('trendChartInstance.destroy()'), "Must destroy existing trend chart instance before recreate");
  assert(htmlContent.includes('radarChartInstance.destroy()'), "Must destroy existing radar chart instance before recreate");
});

runCheck(6, "6.2 Improvement modal controls exist and hook up events", () => {
  assert(htmlContent.includes('openImprovementModal'), "openImprovementModal function must exist");
  assert(htmlContent.includes('closeImprovementModal'), "closeImprovementModal function must exist");
  assert(htmlContent.includes('id="imp-modal-title"'), "#imp-modal-title must exist");
  assert(htmlContent.includes('id="imp-modal-tag"'), "#imp-modal-tag must exist");
  assert(htmlContent.includes('id="imp-modal-score"'), "#imp-modal-score must exist");
  assert(htmlContent.includes('id="imp-modal-diagnosis"'), "#imp-modal-diagnosis must exist");
  assert(htmlContent.includes('id="imp-modal-steps"'), "#imp-modal-steps must exist");
});

// -------------------------------------------------------------
// GROUP 7: PRODUCTION DATABASE SHA-256 INVARIANT
// -------------------------------------------------------------
console.log("\n--- GROUP 7: Production Database SHA-256 Invariant ---");

runCheck(7, "7.1 BE/data/db.json remains byte-for-byte identical", () => {
  const currentDbBytes = fs.readFileSync(PROD_DB_PATH);
  const currentHash = crypto.createHash("sha256").update(currentDbBytes).digest("hex").toUpperCase();
  assert.strictEqual(
    currentHash,
    BASELINE_DB_HASH,
    `Production database hash mismatch! Expected: ${BASELINE_DB_HASH}, Got: ${currentHash}`
  );
});

console.log("\n===============================================================");
console.log(`AUDIT RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log("===============================================================");

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
