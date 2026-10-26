/**
 * visual-coaching-report-dom.test.js
 * Regression tests for Visual Presence Coaching & Report Integration (WI-COACH-VIDEO-01 Bước C & D).
 *
 * Verifies:
 * 1. HTML structure and script imports in report.html.
 * 2. Strict separation between Part A (Professional) and Part B (Presentation / Visual).
 * 3. Scenario A: Camera active with optimal lighting and centered framing.
 * 4. Scenario B: Camera OFF (clean fallback banner, no fake deductions).
 * 5. Scenario C: Camera covered / insufficient data (graceful explanation).
 * 6. Turn sampling & session aggregation via VisualCoachingEngine.
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");

function pass(name) {
  console.log(`  [PASS] ${name}`);
}

const engine = require(path.resolve(__dirname, "../../FE/features/interview/visual-coaching-engine.js"));
const cameraModule = require(path.resolve(__dirname, "../../FE/features/interview/interview-camera.js"));

function runVisualCoachingReportDomTests() {
  console.log("--- RUNNING VISUAL COACHING REPORT DOM & INTEGRATION TESTS (Bước C & D) ---");

  // 1. Verify HTML Structure in report.html
  const reportHtmlPath = path.resolve(__dirname, "../../FE/features/report/report.html");
  const reportHtml = fs.readFileSync(reportHtmlPath, "utf8");

  assert.ok(reportHtml.includes('id="visual-coaching-box"'), "report.html must contain visual-coaching-box");
  assert.ok(reportHtml.includes('id="visual-metrics-grid"'), "report.html must contain visual-metrics-grid");
  assert.ok(reportHtml.includes('id="visual-recommendations"'), "report.html must contain visual-recommendations");
  assert.ok(reportHtml.includes('id="visual-status-pill"'), "report.html must contain visual-status-pill");
  assert.ok(reportHtml.includes('id="visual-disclaimer"'), "report.html must contain visual-disclaimer");
  assert.ok(reportHtml.includes('visual-coaching-engine.js'), "report.html must include visual-coaching-engine.js");
  pass("1. report.html contains all required Visual Coaching DOM containers and engine script");

  // 2. Strict Independence of Part A (Professional Score)
  assert.ok(reportHtml.includes('PHẦN B • PHONG CÁCH THỂ HIỆN'), "Part B section header exists");
  assert.ok(reportHtml.includes('id="section-speech-coaching"'), "Part B container exists");
  assert.ok(reportHtml.includes('id="section-dimensions"'), "Part A Dimensions exists");

  const offSession = engine.aggregateSessionVisuals([], { cameraEnabled: false });
  assert.strictEqual(offSession.affectsProfessionalScore, false);
  assert.ok(offSession.disclaimer.includes("không ảnh hưởng đến điểm năng lực chuyên môn"));
  pass("2. Strict architectural isolation between Part A (Professional) and Visual Coaching confirmed");

  // 3. Scenario A: Camera ON with multiple turn samples
  const turn1Eval = {
    isEvaluated: true,
    lighting: engine.LIGHTING_STATUS.OPTIMAL,
    framing: engine.FRAMING_STATUS.CENTERED,
    metrics: { meanLuma: 125, stdDevLuma: 22 },
  };
  const turn2Eval = {
    isEvaluated: true,
    lighting: engine.LIGHTING_STATUS.OPTIMAL,
    framing: engine.FRAMING_STATUS.CENTERED,
    metrics: { meanLuma: 130, stdDevLuma: 24 },
  };
  const activeSessionReport = engine.aggregateSessionVisuals([turn1Eval, turn2Eval], { cameraEnabled: true });

  assert.strictEqual(activeSessionReport.evaluated, true);
  assert.strictEqual(activeSessionReport.cameraUsed, true);
  assert.strictEqual(activeSessionReport.dominantLighting, engine.LIGHTING_STATUS.OPTIMAL);
  assert.strictEqual(activeSessionReport.dominantFraming, engine.FRAMING_STATUS.CENTERED);
  assert.ok(activeSessionReport.avgLuma >= 120 && activeSessionReport.avgLuma <= 135);
  assert.ok(activeSessionReport.recommendations.length >= 2);
  pass("3. Scenario A: Multi-turn active camera session aggregates lighting and framing accurately");

  // 4. Scenario B: Camera was OFF throughout interview
  const offSessionReport = engine.aggregateSessionVisuals([], { cameraEnabled: false });
  assert.strictEqual(offSessionReport.evaluated, false);
  assert.strictEqual(offSessionReport.cameraUsed, false);
  assert.strictEqual(offSessionReport.summaryBadge, "Camera tắt");
  assert.ok(offSessionReport.recommendations[1].includes("không ảnh hưởng đến điểm năng lực chuyên môn"));
  pass("4. Scenario B: Camera OFF session handled cleanly without penalization or errors");

  // 5. Scenario C: Camera was ON but covered / dark throughout
  const coveredEval = {
    isEvaluated: false,
    reason: "Khung hình quá tối hoặc ống kính camera bị che",
  };
  const coveredSessionReport = engine.aggregateSessionVisuals([coveredEval], { cameraEnabled: true });
  assert.strictEqual(coveredSessionReport.evaluated, false);
  assert.strictEqual(coveredSessionReport.cameraUsed, true);
  assert.strictEqual(coveredSessionReport.summaryBadge, "Chưa đủ dữ liệu");
  assert.ok(coveredSessionReport.recommendations[0].includes("nắp che camera") || coveredSessionReport.recommendations[0].includes("ánh sáng"));
  pass("5. Scenario C: Covered camera handled with constructive troubleshooting guidance");

  // 6. Camera sampling functions in interview-camera.js
  cameraModule.clearSessionVisualEvaluations();
  assert.strictEqual(cameraModule.getSessionVisualEvaluations().length, 0);

  // Sample turn when camera is off
  const offRecord = cameraModule.captureAndAnalyzeCurrentFrame(0, engine);
  assert.strictEqual(offRecord.cameraEnabled, false);
  assert.strictEqual(offRecord.isEvaluated, false);
  assert.strictEqual(cameraModule.getSessionVisualEvaluations().length, 1);

  // Aggregation from cameraModule
  const reportFromCam = cameraModule.getSessionVisualReport({}, engine);
  assert.strictEqual(reportFromCam.cameraUsed, false);
  assert.strictEqual(reportFromCam.evaluated, false);
  pass("6. interview-camera.js sampling and session reporting functions verified");

  console.log("ALL VISUAL COACHING REPORT DOM TESTS PASSED (Bước C & D).\n");
}

if (require.main === module) {
  try {
    runVisualCoachingReportDomTests();
  } catch (err) {
    console.error("Test failure:", err);
    process.exit(1);
  }
}

module.exports = { runVisualCoachingReportDomTests };
