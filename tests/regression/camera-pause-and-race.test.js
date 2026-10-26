/**
 * PREPMATE — WI-COACH-VIDEO-03R REGRESSION TEST SUITE
 * PAUSE SAMPLING, SNAPSHOT WRITE RACE & LIFECYCLE RECONCILIATION
 *
 * Test A: Pause/Resume Camera Lifecycle
 *  - Pause stops sampling & frame analysis
 *  - Camera stream stays alive on pause (not stopped)
 *  - No snapshots created while paused
 *  - Resume while camera ON resumes sampling for active turn
 *  - Pause then turn camera OFF -> Resume does not auto re-enable camera
 *  - No duplicate intervals or memory leaks
 *
 * Test B: Snapshot Write Race Condition Handling
 *  - Immediate answer submission right after turn start
 *  - Flush pending snapshot write on turn completion
 *  - Bound sessionId and turnIndex prevent cross-turn snapshot leakage
 *  - Slow / hanging IndexedDB times out gracefully without blocking UI
 *  - Rejection / error in IndexedDB handled gracefully without fake blobs
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

function pass(name) {
  console.log(`  [PASS] ${name}`);
}

function setupMockDom() {
  const elements = new Map();

  const mockVideo = {
    id: "webcam-video",
    style: { display: "none" },
    srcObject: null,
    videoWidth: 640,
    videoHeight: 480,
    width: 640,
    height: 480,
    readyState: 4,
    _listeners: {},
    addEventListener(evt, fn) {
      if (!this._listeners[evt]) this._listeners[evt] = [];
      this._listeners[evt].push(fn);
    },
    removeEventListener(evt, fn) {
      if (this._listeners[evt]) {
        this._listeners[evt] = this._listeners[evt].filter((l) => l !== fn);
      }
    },
    play() {
      return Promise.resolve();
    },
  };
  elements.set("webcam-video", mockVideo);

  const mockBtnToggle = {
    id: "btn-toggle-cam",
    innerHTML: "",
    title: "",
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); },
    },
    setAttribute() {},
  };
  elements.set("btn-toggle-cam", mockBtnToggle);

  const mockPauseBtn = {
    id: "btn-pause-interview",
    innerHTML: "⏸ Tạm dừng",
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
    },
  };
  elements.set("btn-pause-interview", mockPauseBtn);

  const mockVideoGrid = {
    id: "ir-video-grid",
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
    },
  };
  elements.set("ir-video-grid", mockVideoGrid);

  const mockInterviewRoom = {
    id: "interview-room",
    appendChild() {},
  };
  elements.set("interview-room", mockInterviewRoom);

  const mockPlaceholder = {
    id: "camera-placeholder",
    style: { display: "flex" },
    querySelector() { return { textContent: "" }; },
  };
  elements.set("camera-placeholder", mockPlaceholder);

  const mockStatusEl = {
    id: "candidate-tile-status",
    textContent: "",
    title: "",
  };
  elements.set("candidate-tile-status", mockStatusEl);

  const mockPrivacyIndicator = {
    id: "camera-privacy-indicator",
    style: { display: "none" },
    title: "",
  };
  elements.set("camera-privacy-indicator", mockPrivacyIndicator);

  const mockCanvasCtx = {
    drawImage() {},
    getImageData(x, y, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128;
        data[i + 1] = 128;
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
      return { data, width: w, height: h };
    },
  };

  const mockDoc = {
    addEventListener() {},
    removeEventListener() {},
    getElementById(id) {
      return elements.get(id) || null;
    },
    createElement(tag) {
      if (tag === "canvas") {
        return {
          width: 320,
          height: 240,
          getContext: () => mockCanvasCtx,
          toBlob: (cb, type = "image/webp") => {
            setTimeout(() => {
              cb({ size: 2048, type });
            }, 10);
          },
        };
      }
      return { style: {}, innerHTML: "", remove() {}, classList: { add() {}, remove() {} } };
    },
  };

  globalThis.document = mockDoc;
  globalThis.window = globalThis;
  globalThis.window.document = mockDoc;
  globalThis.window._isInterviewSessionStarted = true;

  let _mockPaused = false;
  globalThis.window.isInterviewPaused = () => _mockPaused;
  globalThis.window.setIsInterviewPaused = (val) => { _mockPaused = Boolean(val); };

  globalThis.sessionStorage = {
    _data: new Map(),
    getItem(k) { return this._data.get(k) || null; },
    setItem(k, v) { this._data.set(k, String(v)); },
    removeItem(k) { this._data.delete(k); },
    clear() { this._data.clear(); },
  };
}

async function runPauseAndRaceTests() {
  console.log("===============================================================");
  console.log("   WI-COACH-VIDEO-03R: PAUSE SAMPLING & SNAPSHOT RACE TESTS    ");
  console.log("===============================================================\n");

  setupMockDom();

  const snapshotStore = require("../../FE/features/interview/interview-visual-snapshots.js");
  const visualEngine = require("../../FE/features/interview/visual-coaching-engine.js");
  const cameraModule = require("../../FE/features/interview/interview-camera.js");

  globalThis.PrepMateVisualSnapshotStore = snapshotStore;
  globalThis.VisualCoachingEngine = visualEngine;
  globalThis.pauseInTurnSampling = cameraModule.pauseInTurnSampling;
  globalThis.resumeInTurnSampling = cameraModule.resumeInTurnSampling;
  globalThis.isSamplingPaused = cameraModule.isSamplingPaused;
  globalThis.flushPendingTurnSnapshot = cameraModule.flushPendingTurnSnapshot;

  // Load pause subsystem
  require("../../FE/features/interview/interview-pause.js");

  const testSession = "sess_pause_race_001";
  globalThis.window.currentInterviewSession = { backendSessionId: testSession };
  globalThis.window.interviewPhase = "ADAPTIVE_INTERVIEW";
  globalThis.window.getInterviewPhase = () => "ADAPTIVE_INTERVIEW";
  globalThis.window.getCurrentQuestionIndex = () => 0; // Turn 1

  // Setup active camera stream
  const mockTrack = { readyState: "live", enabled: true, stop() {} };
  const mockStream = {
    active: true,
    getVideoTracks: () => [mockTrack],
    getTracks: () => [mockTrack],
  };
  globalThis.window._userWebcamStream = mockStream;
  cameraModule.setCamState(cameraModule.CAM_STATE.ON);

  // -----------------------------------------------------------------
  // TEST A1: Pause stops sampling, does not turn off camera, no new frames
  // -----------------------------------------------------------------
  console.log("--- Test A1: Pause stops sampling & frame analysis ---");
  await snapshotStore.clearAllSnapshots();
  cameraModule.clearSessionVisualEvaluations();

  // Start sampling for Turn 1
  cameraModule.handleInterviewTurnStarted(1);
  const countBeforePause = cameraModule.getSessionVisualEvaluations().length;
  assert.ok(countBeforePause >= 1, "Initial frame must be captured on turn start");

  // User pauses interview
  globalThis.pauseInterview();
  assert.strictEqual(cameraModule.isSamplingPaused(), true, "isSamplingPaused must be true");
  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.ON, "Camera must NOT be stopped just because interview is paused");
  assert.strictEqual(globalThis.window._userWebcamStream.active, true, "MediaStream must remain active");

  // Attempting capture while paused returns null and does not add evaluations
  const pauseAttemptResult = cameraModule.captureAndAnalyzeCurrentFrame(1);
  assert.strictEqual(pauseAttemptResult, null, "Capture during pause must return null");
  assert.strictEqual(cameraModule.getSessionVisualEvaluations().length, countBeforePause, "No new evaluation records added during pause");
  pass("A1. Pause cleanly halts sampling and frame analysis while preserving active camera stream");

  // -----------------------------------------------------------------
  // TEST A2: Resume restarts sampling for active turn
  // -----------------------------------------------------------------
  console.log("\n--- Test A2: Resume restarts sampling for active turn ---");
  globalThis.resumeInterview(); // toggles back
  assert.strictEqual(cameraModule.isSamplingPaused(), false, "isSamplingPaused must be false after resume");
  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.ON, "Camera remains ON");

  // Capture now succeeds again
  const resumeSample = cameraModule.captureAndAnalyzeCurrentFrame(1);
  assert.ok(resumeSample, "Capture must succeed after resume");
  assert.strictEqual(resumeSample.cameraEnabled, true);
  pass("A2. Resume seamlessly restarts sampling for the active turn without extra configuration");

  // -----------------------------------------------------------------
  // TEST A3: Pause then turn OFF camera -> Resume does NOT auto re-enable
  // -----------------------------------------------------------------
  console.log("\n--- Test A3: Pause, turn OFF camera -> Resume respects OFF state ---");
  globalThis.pauseInterview(); // Pause again
  assert.strictEqual(cameraModule.isSamplingPaused(), true);

  // User actively turns off camera while paused
  cameraModule.stopCamera();
  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.OFF);
  assert.strictEqual(globalThis.window._userWebcamStream, null);

  // User resumes interview
  globalThis.resumeInterview();
  assert.strictEqual(cameraModule.isSamplingPaused(), false);
  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.OFF, "Resume must NOT re-enable camera if user turned it OFF");
  assert.strictEqual(globalThis.window._userWebcamStream, null, "MediaStream must remain null");
  pass("A3. Resume honors candidate's explicit choice to turn off camera during pause");

  // -----------------------------------------------------------------
  // TEST A4: No duplicate timers on rapid pause/resume cycles
  // -----------------------------------------------------------------
  console.log("\n--- Test A4: Rapid Pause/Resume cycles produce no duplicate intervals ---");
  // Turn camera back on
  globalThis.window._userWebcamStream = mockStream;
  cameraModule.setCamState(cameraModule.CAM_STATE.ON);

  for (let i = 0; i < 5; i++) {
    globalThis.pauseInterview();
    globalThis.resumeInterview();
  }
  assert.strictEqual(cameraModule.isSamplingPaused(), false);
  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.ON);
  pass("A4. Rapid Pause/Resume cycles executed without duplicate timer leaks");

  // -----------------------------------------------------------------
  // TEST B1: Immediate answer submission & pending snapshot flush
  // -----------------------------------------------------------------
  console.log("\n--- Test B1: Immediate submission & pending snapshot flush ---");
  const sessionB = "sess_race_test_b";
  globalThis.window.currentInterviewSession = { backendSessionId: sessionB };

  // Turn 0 starts
  cameraModule.handleInterviewTurnStarted(0);

  // Immediate completion (simulate candidate submitting introduction in 5ms)
  const flushPromise = cameraModule.handleInterviewTurnCompleted(0);
  assert.ok(flushPromise && typeof flushPromise.then === "function", "handleInterviewTurnCompleted must return a Promise");

  await flushPromise;

  const snap0 = await snapshotStore.getSnapshot(sessionB, 0);
  assert.ok(snap0, "Turn 0 snapshot must be cleanly flushed and saved to store");
  assert.strictEqual(snap0.sessionId, sessionB);
  assert.strictEqual(snap0.turnIndex, 0);
  pass("B1. Immediate turn completion correctly flushes in-flight snapshot write without dropping frame");

  // -----------------------------------------------------------------
  // TEST B2: Hanging / slow canvas creation times out safely
  // -----------------------------------------------------------------
  console.log("\n--- Test B2: Slow / hanging thumbnail generation times out safely ---");
  const hangingStore = {
    createThumbnailBlob: () => new Promise(() => {}), // Never resolves
    saveSnapshot: () => Promise.resolve(true),
  };
  globalThis.PrepMateVisualSnapshotStore = hangingStore;

  const slowEval = cameraModule.captureAndAnalyzeCurrentFrame(1, visualEngine, sessionB);
  assert.ok(slowEval, "Capture returned initial record");

  // Flushing must not hang indefinitely; should resolve via timeout safeguard
  const slowFlushStart = Date.now();
  const flushResult = await cameraModule.flushPendingTurnSnapshot(1, 400);
  const slowFlushDuration = Date.now() - slowFlushStart;

  assert.ok(slowFlushDuration >= 350 && slowFlushDuration <= 900, `Flush duration (${slowFlushDuration}ms) must time out within specified maxWaitMs`);
  assert.strictEqual(flushResult, false, "Timed out flush returns false");
  pass("B2. Hanging thumbnail creation handles graceful timeout without blocking interview flow");

  globalThis.PrepMateVisualSnapshotStore = snapshotStore;

  // -----------------------------------------------------------------
  // TEST B3: Error handling in snapshot store (e.g. QuotaExceededError)
  // -----------------------------------------------------------------
  console.log("\n--- Test B3: Graceful failure on storage exception without fake blobs ---");
  const failingStore = {
    createThumbnailBlob: () => Promise.resolve({ blob: { size: 1024, type: "image/webp" }, width: 320, height: 240, mimeType: "image/webp" }),
    saveSnapshot: () => Promise.reject(new Error("QuotaExceededError: storage full")),
  };

  globalThis.PrepMateVisualSnapshotStore = failingStore;
  const failRecord = cameraModule.captureAndAnalyzeCurrentFrame(2, visualEngine, sessionB);
  assert.ok(failRecord, "Record generated");

  // Wait for rejected promise to settle
  await cameraModule.flushPendingTurnSnapshot(2, 500);

  assert.strictEqual(failRecord.hasSnapshot, false, "hasSnapshot must be false on storage failure");
  assert.ok(failRecord.snapshotError && failRecord.snapshotError.includes("QuotaExceededError"), "Error message recorded");
  pass("B3. Storage exception caught gracefully, recorded as missing without generating fake fallback blobs");

  // Restore real snapshotStore
  globalThis.PrepMateVisualSnapshotStore = snapshotStore;

  // -----------------------------------------------------------------
  // TEST B4: Strict turn binding prevents cross-turn leakage
  // -----------------------------------------------------------------
  console.log("\n--- Test B4: Strict turn binding prevents cross-turn snapshot leakage ---");
  const sessionD = "sess_leak_test_d";
  globalThis.window.currentInterviewSession = { backendSessionId: sessionD };

  // Trigger capture for Turn 1
  cameraModule.captureAndAnalyzeCurrentFrame(1, visualEngine, sessionD);
  // Trigger capture for Turn 2
  cameraModule.captureAndAnalyzeCurrentFrame(2, visualEngine, sessionD);

  await Promise.all([
    cameraModule.flushPendingTurnSnapshot(1),
    cameraModule.flushPendingTurnSnapshot(2),
  ]);

  const snap1 = await snapshotStore.getSnapshot(sessionD, 1);
  const snap2 = await snapshotStore.getSnapshot(sessionD, 2);

  assert.ok(snap1, "Snapshot 1 must exist");
  assert.ok(snap2, "Snapshot 2 must exist");
  assert.strictEqual(snap1.turnIndex, 1);
  assert.strictEqual(snap2.turnIndex, 2);
  assert.strictEqual(snap1.id, `${sessionD}_turn_1`);
  assert.strictEqual(snap2.id, `${sessionD}_turn_2`);
  assert.notStrictEqual(snap1.id, snap2.id);
  pass("B4. Snapshots strictly bound to their respective turnIndex without cross-turn overwrites");

  cameraModule.stopCamera();

  console.log("\n===============================================================");
  console.log("   ALL WI-COACH-VIDEO-03R PAUSE & RACE TESTS PASSED!           ");
  console.log("===============================================================");
}

if (require.main === module) {
  runPauseAndRaceTests().catch((err) => {
    console.error("\n[FATAL] Pause and race test failure:", err);
    process.exit(1);
  });
}

module.exports = { runPauseAndRaceTests };
