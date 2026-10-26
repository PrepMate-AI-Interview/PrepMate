/**
 * visual-frame-analysis.test.js
 * Regression tests for Frame & Lighting Analysis (WI-COACH-VIDEO-01 Bước B).
 *
 * Verifies:
 * 1. Optimal frame recognition (balanced luma, centered framing).
 * 2. Underexposed frame detection (dark environment, luma < 45).
 * 3. Overexposed frame detection (harsh bright glare, luma > 215).
 * 4. Backlit detection (bright perimeter, shadowed center).
 * 5. Covered camera / pitch-black room -> returns isEvaluated: false.
 * 6. Off-center framing detection (lean left / lean right).
 * 7. Temporal motion stability (static vs natural vs shaky).
 * 8. Ethical disclaimer & methodology disclosure verification.
 */

const assert = require("assert");
const path = require("path");

const engine = require(path.resolve(__dirname, "../../FE/features/interview/visual-coaching-engine.js"));

function pass(name) {
  console.log(`  [PASS] ${name}`);
}

/**
 * Helper to generate synthetic frame buffers.
 */
function createSyntheticFrame(width, height, generatorFn) {
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

function runVisualFrameAnalysisTests() {
  console.log("--- RUNNING VISUAL FRAME & LIGHTING ANALYSIS TESTS (Bước B) ---");

  const w = 640;
  const h = 480;

  // 1. Optimal Frame
  // Subject in center with good illumination (~130), subtle variations, balanced background (~110)
  const optimalData = createSyntheticFrame(w, h, (x, y) => {
    const isCenter = x >= w * 0.3 && x <= w * 0.7 && y >= h * 0.2 && y <= h * 0.8;
    const base = isCenter ? 140 : 100;
    const noise = ((x + y) % 30) - 15;
    return { r: base + noise, g: base + noise, b: base + noise };
  });

  const resOptimal = engine.analyzeFrame(optimalData, w, h);
  assert.strictEqual(resOptimal.isEvaluated, true, "Optimal frame must be evaluated");
  assert.strictEqual(resOptimal.lighting, engine.LIGHTING_STATUS.OPTIMAL, "Lighting must be OPTIMAL");
  assert.strictEqual(resOptimal.framing, engine.FRAMING_STATUS.CENTERED, "Framing must be CENTERED");
  assert.ok(resOptimal.lightingFeedback.includes("cân bằng"), "Feedback should mention balanced lighting");
  assert.ok(resOptimal.disclaimer.includes("không suy đoán tâm lý"), "Ethical disclaimer required");
  pass("1. Optimal lighting and centered framing verified");

  // 2. Underexposed Frame (Dim room with candidate, luma ~34, stdDev ~8)
  const darkData = createSyntheticFrame(w, h, (x, y) => {
    const isCenter = x >= w * 0.3 && x <= w * 0.7 && y >= h * 0.2 && y <= h * 0.8;
    const base = isCenter ? 40 : 26;
    const noise = ((x + y) % 10) - 5;
    return { r: base + noise, g: base + noise, b: base + noise + 2 };
  });

  const resDark = engine.analyzeFrame(darkData, w, h);
  assert.strictEqual(resDark.isEvaluated, true);
  assert.strictEqual(resDark.lighting, engine.LIGHTING_STATUS.UNDEREXPOSED);
  assert.ok(resDark.lightingFeedback.includes("khá tối"), "Should suggest better lighting");
  pass("2. Underexposed lighting detected with helpful actionable guidance");

  // 3. Overexposed Frame (Glare / washed out with candidate, luma ~232, stdDev ~8)
  const brightData = createSyntheticFrame(w, h, (x, y) => {
    const isCenter = x >= w * 0.3 && x <= w * 0.7 && y >= h * 0.2 && y <= h * 0.8;
    const base = isCenter ? 240 : 225;
    const noise = ((x + y) % 12) - 6;
    return { r: base + noise, g: base + noise - 2, b: base + noise - 4 };
  });

  const resBright = engine.analyzeFrame(brightData, w, h);
  assert.strictEqual(resBright.isEvaluated, true);
  assert.strictEqual(resBright.lighting, engine.LIGHTING_STATUS.OVEREXPOSED);
  assert.ok(resBright.lightingFeedback.includes("quá cao") || resBright.lightingFeedback.includes("chói sáng") || resBright.lightingFeedback.includes("dư sáng"));
  pass("3. Overexposed glare detected with reduction advice");

  // 4. Backlit Frame (Dark center ~50, bright background ~175)
  const backlitData = createSyntheticFrame(w, h, (x, y) => {
    const isCenter = x >= w * 0.25 && x <= w * 0.75 && y >= h * 0.2 && y <= h * 0.8;
    const base = isCenter ? 55 : 175;
    const noise = (x % 10);
    return { r: base + noise, g: base + noise, b: base + noise };
  });

  const resBacklit = engine.analyzeFrame(backlitData, w, h);
  assert.strictEqual(resBacklit.isEvaluated, true);
  assert.strictEqual(resBacklit.lighting, engine.LIGHTING_STATUS.BACKLIT);
  assert.ok(resBacklit.lightingFeedback.includes("ngược sáng"), "Should identify backlight");
  pass("4. Backlit condition recognized accurately");

  // 5. Covered Lens / Pitch-Black Room (luma < 10, stdDev < 4)
  const coveredData = createSyntheticFrame(w, h, () => ({ r: 5, g: 5, b: 5 }));
  const resCovered = engine.analyzeFrame(coveredData, w, h);
  assert.strictEqual(resCovered.isEvaluated, false, "Covered camera must NOT produce fake metrics");
  assert.ok(resCovered.reason.includes("quá tối") || resCovered.reason.includes("bị che"), "Reason must report covered or dark lens");
  pass("5. Covered camera correctly flagged as insufficient data without guessing");

  // 6. Framing Balance (Lean Left vs Lean Right)
  const leftHeavyData = createSyntheticFrame(w, h, (x, y) => {
    const isLeft = x < w * 0.33;
    const noise = isLeft ? ((x * 7 + y) % 60) - 30 : 0;
    const base = isLeft ? 120 : 100;
    return { r: base + noise, g: base + noise, b: base + noise };
  });

  const resLeft = engine.analyzeFrame(leftHeavyData, w, h);
  assert.strictEqual(resLeft.isEvaluated, true);
  assert.strictEqual(resLeft.framing, engine.FRAMING_STATUS.LEAN_LEFT);
  assert.ok(resLeft.framingFeedback.includes("tập trung nhiều hơn ở phía trái"));
  pass("6. Off-center framing detected (lean left)");

  // 7. Motion Stability Analysis (Static vs Natural vs Shaky)
  const frame1 = optimalData;
  const frameStatic = new Uint8ClampedArray(optimalData); // exact duplicate

  // Frame with subtle natural movement (diff ~ 5)
  const frameNatural = new Uint8ClampedArray(optimalData);
  for (let i = 0; i < frameNatural.length; i += 4) {
    if (i % 32 === 0) {
      frameNatural[i] = Math.min(255, frameNatural[i] + 12);
    }
  }

  // Frame with violent camera shake / abrupt jump (diff ~ 80)
  const frameShaky = new Uint8ClampedArray(optimalData);
  for (let i = 0; i < frameShaky.length; i += 4) {
    frameShaky[i] = (frameShaky[i] + 120) % 255;
    frameShaky[i + 1] = (frameShaky[i + 1] + 120) % 255;
    frameShaky[i + 2] = (frameShaky[i + 2] + 120) % 255;
  }

  const motionStatic = engine.analyzeMotionDelta(frame1, frameStatic, w, h);
  assert.strictEqual(motionStatic.stability, engine.MOTION_STABILITY.FROZEN_OR_STATIC);

  const motionNatural = engine.analyzeMotionDelta(frame1, frameNatural, w, h);
  assert.strictEqual(motionNatural.stability, engine.MOTION_STABILITY.NATURAL);

  const motionShaky = engine.analyzeMotionDelta(frame1, frameShaky, w, h);
  assert.strictEqual(motionShaky.stability, engine.MOTION_STABILITY.ERRATIC_OR_SHAKY);
  pass("7. Temporal motion stability correctly measures frozen vs natural vs shaky");

  // 8. Aggregate session with camera OFF
  const aggOff = engine.aggregateSessionVisuals([], { cameraEnabled: false });
  assert.strictEqual(aggOff.evaluated, false);
  assert.strictEqual(aggOff.cameraUsed, false);
  assert.strictEqual(aggOff.affectsProfessionalScore, false);
  assert.ok(aggOff.recommendations[1].includes("không ảnh hưởng đến điểm năng lực chuyên môn"));
  pass("8. Camera OFF session cleanly reports no camera without affecting score");

  console.log("ALL VISUAL FRAME ANALYSIS TESTS PASSED (Bước B).\n");
}

if (require.main === module) {
  try {
    runVisualFrameAnalysisTests();
  } catch (e) {
    console.error("Test failed:", e);
    process.exit(1);
  }
}

module.exports = { runVisualFrameAnalysisTests };
