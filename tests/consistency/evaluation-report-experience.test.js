/**
 * PREPMATE — WI-DESIGN-08: EVALUATION REPORT EXPERIENCE & EVIDENCE-BASED FEEDBACK AUDIT
 *
 * Verifies:
 * 1. Canonical Stylesheets Foundation & Design Token Integration
 * 2. Visual Hierarchy & Preserved DOM Sections / Structural Elements
 * 3. 100-Point Score Normalization & Verdict System
 * 4. 6 Core Performance Dimensions & 4 Diagnostic Categories
 * 5. UNASSESSED Invariant & Strength/Weakness Separation
 * 6. Speech & Visual Coaching Architectural Separation & Ethical Disclaimers
 * 7. Production Database SHA-256 Invariant (Zero Corruption)
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "report", "report.html");
const CSS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "report", "report.css");
const JS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "report", "report.js");
const SCE_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "interview", "speech-coaching-engine.js");
const VCE_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "interview", "visual-coaching-engine.js");
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");

const BASELINE_DB_HASH = "C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7";

const htmlContent = fs.readFileSync(HTML_PATH, "utf8");
const cssContent = fs.readFileSync(CSS_PATH, "utf8");
const jsContent = fs.readFileSync(JS_PATH, "utf8");
const sceContent = fs.readFileSync(SCE_PATH, "utf8");
const vceContent = fs.readFileSync(VCE_PATH, "utf8");

console.log("===============================================================");
console.log("   WI-DESIGN-08: EVALUATION REPORT CONSISTENCY & AUDIT SUITE   ");
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
// GROUP 1: CANONICAL STYLESHEET FOUNDATION & DESIGN TOKENS
// -------------------------------------------------------------
console.log("--- GROUP 1: Canonical Stylesheet Foundation & Design Tokens ---");

runCheck(1, "1.1 Canonical stylesheets linked in report.html head", () => {
  assert(htmlContent.includes('tokens.css'), "Must link tokens.css");
  assert(htmlContent.includes('base.css'), "Must link base.css");
  assert(htmlContent.includes('layout.css'), "Must link layout.css");
  assert(htmlContent.includes('components.css'), "Must link components.css");
  assert(htmlContent.includes('style.css'), "Must link style.css");
  assert(htmlContent.includes('report.css'), "Must link report.css");
});

runCheck(1, "1.2 Report custom properties map directly to canonical --pm-* tokens", () => {
  assert(/--rpt-bg:\s*var\(--pm-bg/.test(cssContent), "--rpt-bg must map to --pm-bg");
  assert(/--rpt-surface:\s*var\(--pm-surface/.test(cssContent), "--rpt-surface must map to --pm-surface");
  assert(/--rpt-border:\s*var\(--pm-border/.test(cssContent), "--rpt-border must map to --pm-border");
  assert(/--rpt-primary:\s*var\(--pm-primary/.test(cssContent), "--rpt-primary must map to --pm-primary");
  assert(/--rpt-text-primary:\s*var\(--pm-text-primary/.test(cssContent), "--rpt-text-primary must map to --pm-text-primary");
  assert(/--rpt-text-secondary:\s*var\(--pm-text-secondary/.test(cssContent), "--rpt-text-secondary must map to --pm-text-secondary");
  assert(/--rpt-text-muted:\s*var\(--pm-text-muted/.test(cssContent), "--rpt-text-muted must map to --pm-text-muted");
});

runCheck(1, "1.3 Clean hairline border and elevation hierarchy", () => {
  assert(/--rpt-radius:\s*var\(--pm-radius-lg/.test(cssContent), "Card radius mapped to canonical radius");
  assert(/--rpt-shadow-sm:\s*var\(--pm-shadow-sm/.test(cssContent), "Card shadow-sm mapped to canonical shadow");
  assert(/--rpt-shadow-md:\s*var\(--pm-shadow-md/.test(cssContent), "Card shadow-md mapped to canonical shadow");
});

// -------------------------------------------------------------
// GROUP 2: VISUAL HIERARCHY & PRESERVED DOM SECTIONS / IDS
// -------------------------------------------------------------
console.log("\n--- GROUP 2: Visual Hierarchy & Preserved DOM Sections ---");

runCheck(2, "2.1 All 8 structural sections exist in report.html", () => {
  const sections = [
    "section-overview",
    "section-dimensions",
    "section-diagnostics",
    "section-roadmap",
    "section-preparation",
    "section-checklist",
    "section-speech-coaching",
    "section-provenance"
  ];
  for (const s of sections) {
    assert(htmlContent.includes(`id="${s}"`), `Structural section #${s} must be present`);
  }
});

runCheck(2, "2.2 State container lifecycle elements preserved", () => {
  assert(htmlContent.includes('id="report-loading-state"'), "report-loading-state must exist");
  assert(htmlContent.includes('id="report-error-state"'), "report-error-state must exist");
  assert(htmlContent.includes('id="report-empty-state"'), "report-empty-state must exist");
  assert(htmlContent.includes('id="report-content-container"'), "report-content-container must exist");
});

runCheck(2, "2.3 Core score hero and metadata elements preserved", () => {
  const heroIds = [
    "hero-target-position",
    "hero-target-level",
    "hero-target-company",
    "hero-interviewer-name",
    "hero-summary-text",
    "hero-duration",
    "hero-question-count",
    "hero-date",
    "hero-completion-status",
    "hero-score-value",
    "hero-score-scale",
    "hero-demonstrated-level",
    "hero-readiness-pill",
    "hero-confidence-pill",
    "hero-readiness-rationale"
  ];
  for (const id of heroIds) {
    assert(htmlContent.includes(`id="${id}"`), `Hero element #${id} must be preserved`);
  }
});

// -------------------------------------------------------------
// GROUP 3: 100-POINT SCORE NORMALIZATION & VERDICT SYSTEM
// -------------------------------------------------------------
console.log("\n--- GROUP 3: 100-Point Score Normalization & Verdict System ---");

runCheck(3, "3.1 normalizeScoreTo100 implementation in report.js", () => {
  assert(jsContent.includes("function normalizeScoreTo100"), "report.js must define normalizeScoreTo100");
  assert(jsContent.includes("score <= 10"), "Handles 0-10 raw score conversion gracefully");
});

runCheck(3, "3.2 Hero score rendering uses 0-100 scale", () => {
  assert(htmlContent.includes('id="hero-score-scale">/ 100</div>'), "Score scale label displays / 100");
  assert(htmlContent.includes('id="hero-normalized-score"'), "Normalized score subtext indicator present");
});

runCheck(3, "3.3 Circular score wheel ring indicator configured", () => {
  assert(htmlContent.includes('class="score-wheel-ring"'), "score-wheel-ring container exists");
  assert(htmlContent.includes('class="score-main-number" id="hero-score-value"'), "Score main number element exists");
});

// -------------------------------------------------------------
// GROUP 4: 6 CORE PERFORMANCE DIMENSIONS & DIAGNOSTIC TABS
// -------------------------------------------------------------
console.log("\n--- GROUP 4: 6 Performance Dimensions & Diagnostic Tabs ---");

runCheck(4, "4.1 Dimensions grid container exists", () => {
  assert(htmlContent.includes('id="dimensions-grid"'), "dimensions-grid container must exist");
});

runCheck(4, "4.2 6 canonical performance dimensions defined in report.js", () => {
  const expectedDimensions = [
    "TECHNICAL_KNOWLEDGE",
    "PRACTICAL_APPLICATION",
    "REASONING_DEPTH",
    "FOLLOW_UP_HANDLING",
    "COMMUNICATION",
    "CONSISTENCY"
  ];
  for (const dim of expectedDimensions) {
    assert(jsContent.includes(dim), `Dimension '${dim}' must be defined in report.js`);
  }
});

runCheck(4, "4.3 4 diagnostic navigation pills & panels supported in DOM", () => {
  assert(htmlContent.includes("switchDiagTab('strengths')"), "Diagnostics strengths tab trigger exists");
  assert(htmlContent.includes("switchDiagTab('weaknesses')"), "Diagnostics weaknesses tab trigger exists");
  assert(htmlContent.includes("switchDiagTab('gaps')"), "Diagnostics gaps tab trigger exists");
  assert(htmlContent.includes("switchDiagTab('risks')"), "Diagnostics risks tab trigger exists");
  assert(htmlContent.includes('id="diag-strengths-list"'), "Strengths list container exists");
  assert(htmlContent.includes('id="diag-weaknesses-list"'), "Weaknesses list container exists");
  assert(htmlContent.includes('id="diag-gaps-list"'), "Gaps list container exists");
  assert(htmlContent.includes('id="diag-risks-list"'), "Risks list container exists");
});

// -------------------------------------------------------------
// GROUP 5: UNASSESSED INVARIANT & WEAKNESS CLASSIFICATION
// -------------------------------------------------------------
console.log("\n--- GROUP 5: UNASSESSED Invariant & Feedback Classification ---");

runCheck(5, "5.1 UNASSESSED status handling avoids false-negative penalty", () => {
  assert(jsContent.includes('rawType === "UNASSESSED"'), "report.js must recognize UNASSESSED status");
  assert(jsContent.includes("CHƯA ĐÁNH GIÁ (CƠ HỘI)"), "UNASSESSED items labeled as opportunities");
  assert(htmlContent.includes("UNASSESSED"), "HTML contains explicit UNASSESSED non-weakness explanation banner");
});

runCheck(5, "5.2 Structured distinction between strengths and weaknesses lists", () => {
  assert(htmlContent.includes('id="count-strengths"'), "count-strengths indicator exists");
  assert(htmlContent.includes('id="count-weaknesses"'), "count-weaknesses indicator exists");
  assert(htmlContent.includes('id="count-gaps"'), "count-gaps indicator exists");
  assert(htmlContent.includes('id="count-risks"'), "count-risks indicator exists");
});

// -------------------------------------------------------------
// GROUP 6: SPEECH & VISUAL COACHING ARCHITECTURAL SEPARATION
// -------------------------------------------------------------
console.log("\n--- GROUP 6: Speech & Visual Coaching Architectural Separation ---");

runCheck(6, "6.1 Speech coaching client-side metrics displayed with non-penalizing context", () => {
  assert(htmlContent.includes('id="section-speech-coaching"'), "section-speech-coaching container exists");
  assert(htmlContent.includes('id="speech-metrics-grid"'), "speech-metrics-grid container exists");
  assert(htmlContent.includes('id="speech-fillers-list"'), "speech-fillers-list container exists");
  assert(htmlContent.includes('id="speech-structure-summary"'), "speech-structure-summary container exists");
});

runCheck(6, "6.2 Visual coaching client-side heuristic disclaimer and ethical separation", () => {
  assert(htmlContent.includes('id="visual-coaching-box"'), "visual-coaching-box container exists");
  assert(htmlContent.includes('id="visual-metrics-grid"'), "visual-metrics-grid container exists");
  assert(htmlContent.includes('id="visual-disclaimer"'), "visual-disclaimer container exists");
  // Check ethical separation: affectsProfessionalScore is false
  assert(
    vceContent.includes("affectsProfessionalScore: false") || vceContent.includes("affectsProfessionalScore = false"),
    "Visual coaching engine specifies affectsProfessionalScore: false"
  );
  assert(
    vceContent.includes("NO deception or emotion guessing") || vceContent.includes("No emotion") || htmlContent.includes("nhận diện khuôn mặt/cảm xúc"),
    "Visual coaching contains ethical non-biometric assertion"
  );
});

runCheck(6, "6.3 Provenance and verification badge present", () => {
  assert(htmlContent.includes('id="section-provenance"'), "Provenance section exists");
  assert(htmlContent.includes('id="turn-provenance-list"'), "Turn provenance list container exists");
  assert(htmlContent.includes('id="report-limitations-list"'), "Report limitations disclaimers list exists");
});

// -------------------------------------------------------------
// GROUP 7: PRODUCTION DATABASE SHA-256 INVARIANT
// -------------------------------------------------------------
console.log("\n--- GROUP 7: Production Database SHA-256 Invariant ---");

runCheck(7, "7.1 Production database db.json SHA-256 unmodified", () => {
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
