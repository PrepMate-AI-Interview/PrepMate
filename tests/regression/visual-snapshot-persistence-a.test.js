/**
 * PREPMATE — TEST A: VISUAL SNAPSHOT PERSISTENCE & CAPTURE
 * Tests Step A requirements:
 *  - Snapshot Blob persistence with dimensions and mimeType
 *  - Distinct keys for distinct turns
 *  - No fake snapshots when camera is OFF or permission denied
 *  - Video without dimensions safe fallback
 *  - Non-interference with audio DB
 */

const assert = require("assert");
const path = require("path");

// Load modules
const snapshotStore = require("../../FE/features/interview/interview-visual-snapshots.js");
const cameraModule = require("../../FE/features/interview/interview-camera.js");
const visualEngine = require("../../FE/features/interview/visual-coaching-engine.js");

function pass(name) {
  console.log(`  [PASS] ${name}`);
}

async function runStepATests() {
  console.log("===============================================================");
  console.log("   STEP A: VISUAL SNAPSHOT PERSISTENCE & CAPTURE TESTS         ");
  console.log("===============================================================\n");

  // Reset store
  await snapshotStore.clearAllSnapshots();
  cameraModule.clearSessionVisualEvaluations();

  // Test 1: Snapshot storage with real Blob-like data
  const testSessionId = "test_sess_alpha_001";
  const mockBlob = {
    size: 4096,
    type: "image/webp",
  };

  const saveSuccess = await snapshotStore.saveSnapshot({
    sessionId: testSessionId,
    turnIndex: 0,
    capturedAt: 1700000000000,
    mimeType: "image/webp",
    width: 320,
    height: 240,
    imageBlob: mockBlob,
    metrics: { lightingLevel: "OPTIMAL", framingType: "CENTERED" },
  });

  assert.strictEqual(saveSuccess, true, "Snapshot must be saved successfully");

  const retrieved = await snapshotStore.getSnapshot(testSessionId, 0);
  assert.ok(retrieved, "Retrieved snapshot must not be null");
  assert.strictEqual(retrieved.id, `${testSessionId}_turn_0`);
  assert.strictEqual(retrieved.sessionId, testSessionId);
  assert.strictEqual(retrieved.turnIndex, 0);
  assert.strictEqual(retrieved.width, 320);
  assert.strictEqual(retrieved.height, 240);
  assert.strictEqual(retrieved.mimeType, "image/webp");
  assert.strictEqual(retrieved.imageBlob.size, 4096);
  assert.strictEqual(retrieved.metrics.lightingLevel, "OPTIMAL");
  pass("1. Snapshot Blob persistence with dimensions and mimeType verified");

  // Test 2: Two distinct turns save under distinct keys
  const mockBlobTurn1 = {
    size: 5120,
    type: "image/webp",
  };
  await snapshotStore.saveSnapshot({
    sessionId: testSessionId,
    turnIndex: 1,
    capturedAt: 1700000005000,
    mimeType: "image/webp",
    width: 320,
    height: 240,
    imageBlob: mockBlobTurn1,
    metrics: { lightingLevel: "OPTIMAL", framingType: "LEAN_LEFT" },
  });

  const turn0 = await snapshotStore.getSnapshot(testSessionId, 0);
  const turn1 = await snapshotStore.getSnapshot(testSessionId, 1);
  assert.strictEqual(turn0.id, `${testSessionId}_turn_0`);
  assert.strictEqual(turn1.id, `${testSessionId}_turn_1`);
  assert.strictEqual(turn0.imageBlob.size, 4096);
  assert.strictEqual(turn1.imageBlob.size, 5120);
  assert.notStrictEqual(turn0.id, turn1.id);
  pass("2. Two distinct turns store separate snapshot keys without overwrite");

  // Test 3: Camera OFF produces cameraEnabled=false, hasSnapshot=false, and NO fake snapshot
  cameraModule.stopCamera();
  const offRecord = cameraModule.captureAndAnalyzeCurrentFrame(2, visualEngine, testSessionId);
  assert.strictEqual(offRecord.cameraEnabled, false, "Camera must be reported as OFF");
  assert.strictEqual(offRecord.isEvaluated, false, "Must not be evaluated when camera is OFF");
  assert.strictEqual(offRecord.hasSnapshot, false, "Must not claim snapshot when camera is OFF");

  const uncaptured = await snapshotStore.getSnapshot(testSessionId, 2);
  assert.strictEqual(uncaptured, null, "No fake snapshot may exist in store for turn with camera OFF");
  pass("3. Camera OFF produces no fake snapshot in store");

  // Test 4: Video element without valid dimensions handles gracefully
  globalThis.window._userWebcamStream = { active: true, getVideoTracks: () => [{ readyState: "live", enabled: true }] };
  globalThis.document = {
    getElementById: (id) => {
      if (id === "webcam-video") {
        return { videoWidth: 0, videoHeight: 0, width: 0, height: 0 };
      }
      return null;
    },
  };

  const zeroDimRecord = cameraModule.captureAndAnalyzeCurrentFrame(3, visualEngine, testSessionId);
  assert.strictEqual(zeroDimRecord.cameraEnabled, true);
  assert.strictEqual(zeroDimRecord.isEvaluated, false);
  assert.strictEqual(zeroDimRecord.hasSnapshot, false);
  assert.ok(zeroDimRecord.reason.includes("chưa có kích thước"));

  const noZeroDimSnapshot = await snapshotStore.getSnapshot(testSessionId, 3);
  assert.strictEqual(noZeroDimSnapshot, null, "Zero-dimension video must not save snapshot");
  pass("4. Zero-dimension video handles safely without saving invalid snapshot");

  // Clean mock globals
  delete globalThis.document;
  globalThis.window._userWebcamStream = null;

  // Test 5: Audio database separation
  assert.notStrictEqual(snapshotStore.DB_NAME, "prepmate_audio_db", "Visual DB must not collide with audio DB");
  assert.strictEqual(snapshotStore.DB_NAME, "prepmate_visual_snapshots_db");
  assert.strictEqual(snapshotStore.STORE_NAME, "turn_snapshots");
  pass("5. Audio database and visual snapshot database cleanly decoupled");

  console.log("\nALL STEP A TESTS PASSED SUCCESSFULLY.\n");
}

if (require.main === module) {
  runStepATests().catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
  });
}
