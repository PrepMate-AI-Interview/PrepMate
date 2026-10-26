/**
 * PREPMATE — SCORING STANDARDIZATION REGRESSION TEST SUITE
 * Validates unified 0–100 point scale conversion, edge case clamping,
 * arithmetic mean calculation across 8 rubric dimensions, and DOM rendering.
 *
 * Usage: node tests/regression/scoring-standardization.test.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function resolvePath(rel) {
  return path.resolve(__dirname, '..', '..', rel);
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// --------------------------------------------------------------------------
// Create Lightweight DOM Environment for Testing
// --------------------------------------------------------------------------
function createMockDOM() {
  const elements = new Map();
  const document = {
    addEventListener: () => {},
    getElementById: (id) => {
      if (!elements.has(id)) {
        const el = {
          id,
          style: {},
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
          },
          attributes: {},
          setAttribute(k, v) { this.attributes[k] = v; },
          getAttribute(k) { return this.attributes[k] || null; },
          textContent: "",
          innerText: "",
          innerHTML: "",
          value: ""
        };
        elements.set(id, el);
      }
      return elements.get(id);
    },
    querySelectorAll: () => []
  };

  const window = {
    document,
    location: { search: "" },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    IntersectionObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  };

  return { window, document, elements };
}

function loadReportModule(mockDOM) {
  const context = {
    window: mockDOM.window,
    document: mockDOM.document,
    location: mockDOM.window.location,
    localStorage: mockDOM.window.localStorage,
    IntersectionObserver: mockDOM.window.IntersectionObserver,
    console,
    setTimeout,
    clearTimeout
  };
  context.window = context; // self reference so window.X works in global context

  const code = fs.readFileSync(resolvePath("FE/features/report/report.js"), "utf8");
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

function calculateCompositeScore(criteriaScores) {
  if (!Array.isArray(criteriaScores) || criteriaScores.length === 0) return 0;
  const validScores = criteriaScores.filter(s => typeof s === 'number' && !isNaN(s));
  if (validScores.length === 0) return 0;
  const sum = validScores.reduce((acc, s) => acc + s, 0);
  return sum / validScores.length;
}

async function runTests() {
  console.log("==================================================");
  console.log("   PREPMATE — SCORING STANDARDIZATION REGRESSION   ");
  console.log("==================================================\n");

  const dom = createMockDOM();
  const ctx = loadReportModule(dom);
  const normalize = ctx.window.normalizeScoreTo100 || ctx.normalizeScoreTo100;

  assert(typeof normalize === "function", "Test 1.1: normalizeScoreTo100 is exposed as a function");

  // TEST 2: 0-4 Scale to 0-100 Conversion
  console.log("\n--- TEST 2: 0-4 Scale to 0-100 Conversion ---");
  assert(normalize(4, "0-4") === 100, "Test 2.1: 4.0 / 4 converts to 100.0 / 100");
  assert(normalize(3, "0-4") === 75, "Test 2.2: 3.0 / 4 converts to 75.0 / 100");
  assert(normalize(2, "0-4") === 50, "Test 2.3: 2.0 / 4 converts to 50.0 / 100");
  assert(normalize(1, "0-4") === 25, "Test 2.4: 1.0 / 4 converts to 25.0 / 100");
  assert(normalize(0, "0-4") === 0, "Test 2.5: 0.0 / 4 converts to 0.0 / 100");
  assert(normalize(3.875, "0-4") === 96.9, "Test 2.6: Fractional 3.875 / 4 converts accurately to 96.9 / 100");

  // TEST 3: 0-10 Scale to 0-100 Conversion
  console.log("\n--- TEST 3: 0-10 Scale to 0-100 Conversion ---");
  assert(normalize(10, "0-10") === 100, "Test 3.1: 10.0 / 10 converts to 100.0 / 100");
  assert(normalize(8.5, "0-10") === 85, "Test 3.2: 8.5 / 10 converts to 85.0 / 100");
  assert(normalize(7.2, "0-10") === 72, "Test 3.3: 7.2 / 10 converts to 72.0 / 100");
  assert(normalize(0, "0-10") === 0, "Test 3.4: 0.0 / 10 converts to 0.0 / 100");
  assert(normalize(6.666, "0-10") === 66.7, "Test 3.5: Fractional 6.666 / 10 converts to 66.7 / 100");

  // TEST 4: Native 0-100 Scale Preservation
  console.log("\n--- TEST 4: Native 0-100 Scale Preservation ---");
  assert(normalize(85, "0-100") === 85, "Test 4.1: 85 on 0-100 scale preserved as 85");
  assert(normalize(100, "0-100") === 100, "Test 4.2: 100 on 0-100 scale preserved as 100");
  assert(normalize(0, "0-100") === 0, "Test 4.3: 0 on 0-100 scale preserved as 0");
  assert(normalize(96.875, "0-100") === 96.9, "Test 4.4: 96.875 rounded to 1 decimal place (96.9)");

  // TEST 5: Boundary Clamping & Overflow Protection
  console.log("\n--- TEST 5: Boundary Clamping & Overflow ---");
  assert(normalize(-10, "0-100") === 0, "Test 5.1: Negative score -10 clamped to 0");
  assert(normalize(-2.5, "0-10") === 0, "Test 5.2: Negative score -2.5 clamped to 0");
  assert(normalize(125, "0-100") === 100, "Test 5.3: Overflow score 125 clamped to 100");
  assert(normalize(15, "0-10") === 100, "Test 5.4: 15 / 10 scale overflow clamped to 100");
  assert(normalize(6, "0-4") === 100, "Test 5.5: 6 / 4 scale overflow clamped to 100");

  // TEST 6: Null Safety & Invalid Input Protection
  console.log("\n--- TEST 6: Null Safety & Invalid Inputs ---");
  assert(normalize(null) === null, "Test 6.1: null returns null");
  assert(normalize(undefined) === null, "Test 6.2: undefined returns null");
  assert(normalize("") === null, "Test 6.3: empty string returns null");
  assert(normalize("abc") === null, "Test 6.4: non-numeric string returns null");
  assert(normalize(NaN) === null, "Test 6.5: NaN returns null");
  assert(normalize(Infinity) === null, "Test 6.6: Infinity returns null");
  assert(normalize(-Infinity) === null, "Test 6.7: -Infinity returns null");
  assert(normalize(true) === null, "Test 6.8: boolean true returns null");
  assert(normalize(false) === null, "Test 6.9: boolean false returns null");

  // TEST 7: Arithmetic Mean Across 8 Rubric Dimensions
  console.log("\n--- TEST 7: 8 Rubric Dimensions Arithmetic Mean ---");
  const perfectRubric = [100, 100, 100, 100, 100, 100, 100, 100];
  assert(calculateCompositeScore(perfectRubric) === 100, "Test 7.1: Perfect 8-dimension rubric mean is 100.0");

  const mixedRubric = [100, 100, 100, 100, 100, 75, 100, 100];
  const meanMixed = calculateCompositeScore(mixedRubric);
  assert(meanMixed === 96.875, "Test 7.2: Unrounded mean preserved (96.875)");
  assert(normalize(meanMixed, "0-100") === 96.9, "Test 7.3: Display rounded to 96.9 / 100");

  const zeroScores = [];
  assert(calculateCompositeScore(zeroScores) === 0, "Test 7.4: Empty array guarded against zero division (returns 0)");

  // TEST 8: HTML and DOM Hero Score Verification
  console.log("\n--- TEST 8: HTML Template & Hero Scale Verification ---");
  const htmlContent = fs.readFileSync(resolvePath("FE/features/report/report.html"), "utf8");
  assert(htmlContent.includes('id="hero-score-scale">/ 100<'), "Test 8.1: report.html hero-score-scale contains '/ 100'");
  assert(!htmlContent.includes('/ 10.0</div>'), "Test 8.2: Zero leak of '/ 10.0' in report.html");

  // TEST 9: Full Report Render Hero Score Verification
  console.log("\n--- TEST 9: Full Report Hero Score DOM Binding ---");
  const testReport = {
    sessionInfo: { sessionId: "sess-std-100", targetPosition: "AI Architect", targetLevel: "Lead" },
    completionInfo: { status: "COMPLETED_NORMAL" },
    overallEvaluation: { score: 92.5, scoreScale: "0-100", demonstratedLevel: "Lead" },
    performanceAssessment: { dimensions: [] },
    diagnosticAnalysis: { strengthDiagnoses: [], weaknessDiagnoses: [], knowledgeGapDiagnoses: [], riskDiagnoses: [] },
    improvementRoadmap: { items: [] },
    preparationPlan: { technicalPreparation: [] },
    evidenceSummary: { totalEvidenceItems: 5, practicalExperienceEvidenceCount: 3, verifiedFactsCount: 6, turnProvenance: [] }
  };

  ctx.renderFullReport(testReport, { jobTitle: "AI Architect" });
  const scoreValEl = dom.elements.get("hero-score-value");
  const scoreScaleEl = dom.elements.get("hero-score-scale");
  const normScoreEl = dom.elements.get("hero-normalized-score");

  assert(scoreValEl.textContent === "92.5", "Test 9.1: Hero score value formatted to 92.5");
  assert(scoreScaleEl.textContent === "/ 100", "Test 9.2: Hero score scale displays / 100");
  assert(normScoreEl.textContent.includes("92.5 / 100"), "Test 9.3: Normalized score line displays 92.5 / 100");

  console.log("\n==================================================");
  console.log(`   TEST RESULTS: ${passed} PASS, ${failed} FAIL   `);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("[FATAL ERROR]", err);
  process.exit(1);
});
