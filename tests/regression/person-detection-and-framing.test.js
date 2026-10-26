/**
 * person-detection-and-framing.test.js
 * Regression tests for On-Device Person Detection & Evidence-Based Framing (WI-COACH-VIDEO-02B).
 *
 * Verifies:
 * 1. Dark/covered frame -> POOR_VISIBILITY & UNVERIFIED_NO_SUBJECT (no guessing).
 * 2. Empty room / background wall -> NO_PERSON_DETECTED & UNVERIFIED_NO_SUBJECT (no guessing).
 * 3. Centered person presence -> CONFIDENT_DETECTION & OPTIMAL_CENTERED.
 * 4. Off-center left person -> CONFIDENT_DETECTION & LEAN_LEFT.
 * 5. Off-center right person -> CONFIDENT_DETECTION & LEAN_RIGHT.
 * 6. Person too close to camera -> CONFIDENT_DETECTION & TOO_CLOSE.
 * 7. Person too far from camera -> CONFIDENT_DETECTION & TOO_FAR.
 * 8. Top cut-off head position -> CONFIDENT_DETECTION & CUT_OFF_TOP.
 * 9. Honest posture/shoulder disclosure -> shouldersVisible: false, postureEvaluated: false.
 * 10. Session aggregation: personDetectionRate calculation and Part A independence (affectsProfessionalScore === false).
 */

const assert = require("assert");
const path = require("path");

const engine = require(path.resolve(__dirname, "../../FE/features/interview/visual-coaching-engine.js"));

function pass(name) {
  console.log(`  [PASS] ${name}`);
}

function createFrame(width, height, generatorFn) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const rgb = generatorFn(x, y, width, height);
      data[idx] = rgb.r;
      data[idx + 1] = rgb.g;
      data[idx + 2] = rgb.b;
      data[idx + 3] = 255;
    }
  }
  return data;
}

// Helper to draw realistic skin tone in YCbCr locus
function getSkinRgb() {
  return { r: 195, g: 142, b: 118 };
}

function getBackgroundRgb(x, y) {
  const v = 80 + ((x * 3 + y * 7) % 25);
  return { r: v, g: v, b: v + 5 };
}

function runPersonDetectionTests() {
  console.log("--- RUNNING PERSON DETECTION & EVIDENCE-BASED FRAMING TESTS (WI-COACH-VIDEO-02B) ---");

  const w = 640;
  const h = 480;

  // 1. Dark / covered frame
  const darkFrame = createFrame(w, h, () => ({ r: 8, g: 8, b: 8 }));
  const darkRes = engine.analyzeFrame(darkFrame, w, h);
  assert.strictEqual(darkRes.isEvaluated, false, "Dark frame must not be evaluated");
  assert.strictEqual(darkRes.detection.status, engine.DETECTION_STATUS.POOR_VISIBILITY);
  assert.strictEqual(darkRes.evidenceFraming, engine.EVIDENCE_FRAMING.UNVERIFIED_NO_SUBJECT);
  pass("1. Dark/covered camera flagged as POOR_VISIBILITY & UNVERIFIED_NO_SUBJECT without guessing");

  // 2. Empty room / background wall without person
  const wallFrame = createFrame(w, h, (x, y) => getBackgroundRgb(x, y));
  const wallRes = engine.analyzeFrame(wallFrame, w, h);
  assert.strictEqual(wallRes.isEvaluated, true);
  assert.strictEqual(wallRes.detection.status, engine.DETECTION_STATUS.NO_PERSON_DETECTED);
  assert.strictEqual(wallRes.evidenceFraming, engine.EVIDENCE_FRAMING.UNVERIFIED_NO_SUBJECT);
  assert.ok(wallRes.evidenceFramingFeedback.includes("Chưa phát hiện người"));
  pass("2. Empty background flagged as NO_PERSON_DETECTED & UNVERIFIED_NO_SUBJECT (honest feedback)");

  // 3. Centered person presence
  // Face centered: x from 0.40 to 0.60, y from 0.22 to 0.58
  const centeredFrame = createFrame(w, h, (x, y) => {
    const isFace = x >= w * 0.40 && x <= w * 0.60 && y >= h * 0.22 && y <= h * 0.58;
    return isFace ? getSkinRgb() : getBackgroundRgb(x, y);
  });
  const centeredRes = engine.analyzeFrame(centeredFrame, w, h);
  assert.strictEqual(centeredRes.isEvaluated, true);
  assert.strictEqual(centeredRes.detection.status, engine.DETECTION_STATUS.CONFIDENT_DETECTION);
  assert.strictEqual(centeredRes.evidenceFraming, engine.EVIDENCE_FRAMING.OPTIMAL_CENTERED);
  assert.ok(centeredRes.evidenceFramingFeedback.includes("cân đối ở trung tâm"));
  pass("3. Centered person detected with CONFIDENT_DETECTION & OPTIMAL_CENTERED");

  // 4. Lean left person (x from 0.08 to 0.28)
  const leftFrame = createFrame(w, h, (x, y) => {
    const isFace = x >= w * 0.08 && x <= w * 0.28 && y >= h * 0.22 && y <= h * 0.58;
    return isFace ? getSkinRgb() : getBackgroundRgb(x, y);
  });
  const leftRes = engine.analyzeFrame(leftFrame, w, h);
  assert.strictEqual(leftRes.isEvaluated, true);
  assert.strictEqual(leftRes.detection.status, engine.DETECTION_STATUS.CONFIDENT_DETECTION);
  assert.strictEqual(leftRes.evidenceFraming, engine.EVIDENCE_FRAMING.LEAN_LEFT);
  assert.ok(leftRes.evidenceFramingFeedback.includes("bên trái"));
  pass("4. Left-shifted person detected with LEAN_LEFT");

  // 5. Lean right person (x from 0.72 to 0.92)
  const rightFrame = createFrame(w, h, (x, y) => {
    const isFace = x >= w * 0.72 && x <= w * 0.92 && y >= h * 0.22 && y <= h * 0.58;
    return isFace ? getSkinRgb() : getBackgroundRgb(x, y);
  });
  const rightRes = engine.analyzeFrame(rightFrame, w, h);
  assert.strictEqual(rightRes.isEvaluated, true);
  assert.strictEqual(rightRes.detection.status, engine.DETECTION_STATUS.CONFIDENT_DETECTION);
  assert.strictEqual(rightRes.evidenceFraming, engine.EVIDENCE_FRAMING.LEAN_RIGHT);
  assert.ok(rightRes.evidenceFramingFeedback.includes("bên phải"));
  pass("5. Right-shifted person detected with LEAN_RIGHT");

  // 6. Person too close to camera (large face: height 75%, width 65%)
  const closeFrame = createFrame(w, h, (x, y) => {
    const isFace = x >= w * 0.18 && x <= w * 0.82 && y >= h * 0.12 && y <= h * 0.88;
    return isFace ? getSkinRgb() : getBackgroundRgb(x, y);
  });
  const closeRes = engine.analyzeFrame(closeFrame, w, h);
  assert.strictEqual(closeRes.isEvaluated, true);
  assert.strictEqual(closeRes.detection.status, engine.DETECTION_STATUS.CONFIDENT_DETECTION);
  assert.strictEqual(closeRes.evidenceFraming, engine.EVIDENCE_FRAMING.TOO_CLOSE);
  assert.ok(closeRes.evidenceFramingFeedback.includes("quá gần camera"));
  pass("6. Close-up framing detected with TOO_CLOSE");

  // 7. Person too far from camera (tiny face: height 12%, width 10%)
  const farFrame = createFrame(w, h, (x, y) => {
    const isFace = x >= w * 0.45 && x <= w * 0.55 && y >= h * 0.35 && y <= h * 0.47;
    return isFace ? getSkinRgb() : getBackgroundRgb(x, y);
  });
  const farRes = engine.analyzeFrame(farFrame, w, h);
  assert.strictEqual(farRes.isEvaluated, true);
  assert.strictEqual(farRes.detection.status, engine.DETECTION_STATUS.CONFIDENT_DETECTION);
  assert.strictEqual(farRes.evidenceFraming, engine.EVIDENCE_FRAMING.TOO_FAR);
  assert.ok(farRes.evidenceFramingFeedback.includes("quá xa camera"));
  pass("7. Distant framing detected with TOO_FAR");

  // 8. Cut off top head position (y from 0.01 to 0.35)
  const cutTopFrame = createFrame(w, h, (x, y) => {
    const isFace = x >= w * 0.40 && x <= w * 0.60 && y >= h * 0.01 && y <= h * 0.35;
    return isFace ? getSkinRgb() : getBackgroundRgb(x, y);
  });
  const cutTopRes = engine.analyzeFrame(cutTopFrame, w, h);
  assert.strictEqual(cutTopRes.isEvaluated, true);
  assert.strictEqual(cutTopRes.detection.status, engine.DETECTION_STATUS.CONFIDENT_DETECTION);
  assert.strictEqual(cutTopRes.evidenceFraming, engine.EVIDENCE_FRAMING.CUT_OFF_TOP);
  assert.ok(cutTopRes.evidenceFramingFeedback.includes("Đỉnh đầu có nguy cơ bị cắt"));
  pass("8. Top edge proximity detected with CUT_OFF_TOP");

  // 9. Honest posture/shoulder disclosure
  assert.strictEqual(centeredRes.landmarksStatus.shouldersVisible, false);
  assert.strictEqual(centeredRes.landmarksStatus.postureEvaluated, false);
  assert.ok(centeredRes.landmarksStatus.feedback.includes("chưa hiển thị đủ phần vai"));
  pass("9. Honest posture disclosure: shoulders unverified, emotion/deception not guessed");

  // 10. Session Aggregation
  const sessionEvals = [centeredRes, centeredRes, leftRes];
  const aggregated = engine.aggregateSessionVisuals(sessionEvals);
  assert.strictEqual(aggregated.evaluated, true);
  assert.strictEqual(aggregated.cameraUsed, true);
  assert.strictEqual(aggregated.personDetectionRate, 1.0, "Detection rate should be 100%");
  assert.strictEqual(aggregated.dominantEvidenceFraming, engine.EVIDENCE_FRAMING.OPTIMAL_CENTERED);
  assert.ok(aggregated.personDetectionSummary.includes("100%"));
  assert.strictEqual(aggregated.affectsProfessionalScore, false, "Must not affect Part A score");
  pass("10. Session visual aggregation verifies personDetectionRate and Part A score isolation");

  console.log("\nALL PERSON DETECTION & EVIDENCE-BASED FRAMING TESTS PASSED (WI-COACH-VIDEO-02B)!\n");
}

if (require.main === module) {
  runPersonDetectionTests();
}

module.exports = { runPersonDetectionTests };
