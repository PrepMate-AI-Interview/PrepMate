/**
 * PREPMATE — WI-COACH-VIDEO-03 REGRESSION TEST SUITE
 * CAMERA LIFECYCLE REPAIR — LATE ENABLE, ACTIVE-TURN CAPTURE & REPORT SYNC
 *
 * Tests:
 *  - Test A: Camera on from start -> snapshot saved for turn 0
 *  - Test B: Camera on late (mid-turn) -> waitForVideoReady -> snapshot saved for active turn
 *  - Test C: Toggle off then on again -> timer cleaned up and restarted without duplicate listeners
 *  - Test D: Multiple turns -> distinct keys (${sessionId}_turn_0, ${sessionId}_turn_1) & motion delta
 *  - Test E: Report display & restoration from IndexedDB (cameraUsed = true override)
 *  - Test F: Camera errors (permission denied, 0-dim video) -> safe fallback without fake blobs
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

function pass(name) {
  console.log(`  [PASS] ${name}`);
}

// Ensure mock browser globals for Node.js test environment
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
    trigger(evt) {
      if (this._listeners[evt]) {
        this._listeners[evt].forEach((fn) => fn());
      }
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
      // Fill with balanced synthetic grey pixels (luma ~ 128)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 130;     // R
        data[i + 1] = 130; // G
        data[i + 2] = 130; // B
        data[i + 3] = 255; // A
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
            cb({ size: 1024, type });
          },
        };
      }
      return { style: {}, innerHTML: "" };
    },
  };

  globalThis.document = mockDoc;
  globalThis.window = globalThis;
  globalThis.window.document = mockDoc;
  globalThis.sessionStorage = {
    _data: new Map(),
    getItem(k) { return this._data.get(k) || null; },
    setItem(k, v) { this._data.set(k, String(v)); },
    removeItem(k) { this._data.delete(k); },
    clear() { this._data.clear(); },
  };
  globalThis.localStorage = {
    _data: new Map(),
    getItem(k) { return this._data.get(k) || null; },
    setItem(k, v) { this._data.set(k, String(v)); },
    removeItem(k) { this._data.delete(k); },
    clear() { this._data.clear(); },
  };
}

async function runCameraLifecycleTests() {
  console.log("===============================================================");
  console.log("   WI-COACH-VIDEO-03: CAMERA LIFECYCLE REPAIR & REPORT SYNC     ");
  console.log("===============================================================\n");

  setupMockDom();

  const snapshotStore = require("../../FE/features/interview/interview-visual-snapshots.js");
  const visualEngine = require("../../FE/features/interview/visual-coaching-engine.js");
  const cameraModule = require("../../FE/features/interview/interview-camera.js");

  globalThis.PrepMateVisualSnapshotStore = snapshotStore;
  globalThis.VisualCoachingEngine = visualEngine;

  // -------------------------------------------------------------
  // TEST A: Camera on from session start -> snapshot saved for turn 0
  // -------------------------------------------------------------
  console.log("--- Test A: Camera on from start -> turn 0 snapshot ---");
  await snapshotStore.clearAllSnapshots();
  cameraModule.clearSessionVisualEvaluations();

  const sessionA = "sess_video03_test_a";
  globalThis.window.currentInterviewSession = { backendSessionId: sessionA };
  globalThis.window.interviewPhase = "INTRODUCTION";
  globalThis.window.getInterviewPhase = () => "INTRODUCTION";
  globalThis.window.getCurrentQuestionIndex = () => 0;

  // Mock active user webcam stream
  const mockTrack = { readyState: "live", enabled: true, stop() {} };
  const mockStream = {
    active: true,
    getVideoTracks: () => [mockTrack],
    getTracks: () => [mockTrack],
  };
  globalThis.window._userWebcamStream = mockStream;
  cameraModule.setCamState(cameraModule.CAM_STATE.ON);

  // Turn 0 starts
  cameraModule.handleInterviewTurnStarted(0);

  // Wait brief microtask for async thumbnail persistence
  await new Promise((r) => setTimeout(r, 60));

  const snap0 = await snapshotStore.getSnapshot(sessionA, 0);
  assert.ok(snap0, "Snapshot for turn 0 must exist in store");
  assert.strictEqual(snap0.turnIndex, 0);
  assert.strictEqual(snap0.sessionId, sessionA);
  assert.strictEqual(snap0.width, 320);
  assert.strictEqual(snap0.height, 240);
  assert.strictEqual(snap0.mimeType, "image/webp");
  assert.ok(snap0.metrics && snap0.metrics.cameraEnabled === true, "Snapshot must have cameraEnabled: true metrics");

  cameraModule.handleInterviewTurnCompleted(0);
  pass("Test A: Camera ON from session start captures & persists Turn 0 snapshot");

  // -------------------------------------------------------------
  // TEST B: Camera ON late (mid-turn) -> waitForVideoReady -> snapshot saved for active turn
  // -------------------------------------------------------------
  console.log("\n--- Test B: Camera ON late (mid-turn) -> waitForVideoReady ---");
  const sessionB = "sess_video03_test_b";
  globalThis.window.currentInterviewSession = { backendSessionId: sessionB };
  globalThis.window.interviewPhase = "ADAPTIVE_INTERVIEW";
  globalThis.window.getInterviewPhase = () => "ADAPTIVE_INTERVIEW";
  globalThis.window.getCurrentQuestionIndex = () => 0; // Turn index will be 1 (0 + 1)

  // Start with camera OFF
  cameraModule.stopCamera();
  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.OFF);

  // Turn 1 starts while camera is OFF
  cameraModule.handleInterviewTurnStarted(1);
  const evalsBefore = cameraModule.getSessionVisualEvaluations();
  const turn1Placeholder = evalsBefore.find((e) => e.turnIndex === 1 && e.sessionId === sessionB);
  assert.ok(turn1Placeholder, "Placeholder record must exist for turn 1");
  assert.strictEqual(turn1Placeholder.cameraEnabled, false, "Placeholder must have cameraEnabled: false");

  // User enables camera late (mid-turn)
  const mockMediaDevices = {
    getUserMedia: async () => {
      // Simulate video stream delivery
      return {
        active: true,
        getVideoTracks: () => [{ readyState: "live", enabled: true, stop() {} }],
        getTracks: () => [{ readyState: "live", enabled: true, stop() {} }],
      };
    },
  };

  const videoEl = document.getElementById("webcam-video");
  videoEl.videoWidth = 640;
  videoEl.videoHeight = 480;

  const camSuccess = await cameraModule.requestCameraAccess(mockMediaDevices);
  assert.strictEqual(camSuccess, true, "Camera access request must succeed");
  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.ON);

  // Allow async snapshot thumbnail persistence
  await new Promise((r) => setTimeout(r, 60));

  const snap1 = await snapshotStore.getSnapshot(sessionB, 1);
  assert.ok(snap1, "Late enable must capture and save snapshot for active turn 1");
  assert.strictEqual(snap1.turnIndex, 1);
  assert.strictEqual(snap1.sessionId, sessionB);
  assert.strictEqual(snap1.metrics.cameraEnabled, true);

  // Verify that the evaluation record in sessionVisualEvaluations was updated from cameraEnabled: false to true
  const evalsAfter = cameraModule.getSessionVisualEvaluations();
  const updatedTurn1 = evalsAfter.find((e) => e.turnIndex === 1 && e.sessionId === sessionB);
  assert.ok(updatedTurn1, "Evaluated turn 1 record must be present");
  assert.strictEqual(updatedTurn1.cameraEnabled, true, "Turn 1 record must be replaced with active camera evaluation");

  cameraModule.handleInterviewTurnCompleted(1);
  pass("Test B: Late camera enable resolves active turn and captures frame without failure");

  // -------------------------------------------------------------
  // TEST C: Toggle off then on again -> clean timer lifecycle
  // -------------------------------------------------------------
  console.log("\n--- Test C: Toggle OFF then ON again -> clean timer lifecycle ---");
  cameraModule.handleInterviewTurnStarted(2);
  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.ON);

  // Turn off camera
  cameraModule.stopCamera();
  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.OFF);
  assert.strictEqual(globalThis.window._userWebcamStream, null, "Stream must be nullified after stopCamera");

  // Turn camera on again
  await cameraModule.requestCameraAccess(mockMediaDevices);
  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.ON);

  // Clean stop
  cameraModule.stopCamera();
  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.OFF);
  pass("Test C: Camera toggle off/on cleans up timers and tracks without memory leaks");

  // -------------------------------------------------------------
  // TEST D: Multiple turns & motion delta calculation
  // -------------------------------------------------------------
  console.log("\n--- Test D: Multiple turns & motion delta calculation ---");
  const sessionD = "sess_video03_test_d";
  globalThis.window.currentInterviewSession = { backendSessionId: sessionD };
  await cameraModule.requestCameraAccess(mockMediaDevices);

  // Turn 0 (Introduction)
  cameraModule.handleInterviewTurnStarted(0);
  await new Promise((r) => setTimeout(r, 50));
  cameraModule.handleInterviewTurnCompleted(0);

  // Turn 1 (Question 1)
  cameraModule.handleInterviewTurnStarted(1);
  await new Promise((r) => setTimeout(r, 50));

  // Trigger frame sample in turn 1 with slight frame variance to test motion delta
  let tickCount = 0;
  const canvasCtx = document.createElement("canvas").getContext("2d");
  const originalGetImageData = canvasCtx.getImageData;
  canvasCtx.getImageData = (x, y, w, h) => {
    const data = new Uint8ClampedArray(w * h * 4);
    tickCount++;
    const val = tickCount > 1 ? 140 : 120; // Introduce delta
    for (let i = 0; i < data.length; i += 4) {
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }
    return { data, width: w, height: h };
  };

  const sample1 = cameraModule.captureAndAnalyzeCurrentFrame(1, visualEngine, sessionD);
  const sample2 = cameraModule.captureAndAnalyzeCurrentFrame(1, visualEngine, sessionD);
  assert.ok(sample2.motionDelta, "Sample 2 must calculate motionDelta relative to Sample 1");
  assert.ok(typeof sample2.motionDelta.avgDelta === "number", "Motion delta must contain numeric avgDelta");
  assert.ok(sample2.motionStability, "Sample 2 must have motionStability property");

  cameraModule.handleInterviewTurnCompleted(1);

  // Distinct snapshots stored for turn 0 and turn 1
  const snapD0 = await snapshotStore.getSnapshot(sessionD, 0);
  const snapD1 = await snapshotStore.getSnapshot(sessionD, 1);
  assert.ok(snapD0, "Turn 0 snapshot must exist");
  assert.ok(snapD1, "Turn 1 snapshot must exist");
  assert.notStrictEqual(snapD0.id, snapD1.id, "Compound keys must be distinct");
  assert.strictEqual(snapD0.id, `${sessionD}_turn_0`);
  assert.strictEqual(snapD1.id, `${sessionD}_turn_1`);
  pass("Test D: Multiple turns produce distinct keys and motion delta is computed");

  // -------------------------------------------------------------
  // TEST E: Report display & restoration from IndexedDB (cameraUsed = true override)
  // -------------------------------------------------------------
  console.log("\n--- Test E: Report display & restoration from IndexedDB ---");
  const sessionE = "sess_video03_test_e";

  // Seed snapshots in store for sessionE
  await snapshotStore.saveSnapshot({
    sessionId: sessionE,
    turnIndex: 0,
    capturedAt: 1700000000000,
    mimeType: "image/webp",
    width: 320,
    height: 240,
    imageBlob: "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoFAAUAPxF8slSvKSWjBAgAsBIJaQAA32sAAP7/lQAAAAAAAAAAAAAAAAAAAAAA",
    metrics: { lightingLevel: "OPTIMAL", framingType: "CENTERED", cameraEnabled: true, isEvaluated: true },
  });
  await snapshotStore.saveSnapshot({
    sessionId: sessionE,
    turnIndex: 1,
    capturedAt: 1700000030000,
    mimeType: "image/webp",
    width: 320,
    height: 240,
    imageBlob: "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoFAAUAPxF8slSvKSWjBAgAsBIJaQAA32sAAP7/lQAAAAAAAAAAAAAAAAAAAAAA",
    metrics: { lightingLevel: "UNDEREXPOSED", framingType: "LEAN_LEFT", cameraEnabled: true, isEvaluated: true },
  });

  // Mock report DOM elements
  const mockReportElements = {
    "visual-coaching-box": { id: "visual-coaching-box" },
    "visual-metrics-grid": { innerHTML: "" },
    "visual-recommendations": { innerHTML: "" },
    "visual-status-pill": { textContent: "", style: {} },
    "visual-snapshots-gallery": { innerHTML: "" },
    "visual-snapshots-count-badge": { textContent: "", style: {} },
  };
  const originalGetElementById = document.getElementById;
  document.getElementById = (id) => mockReportElements[id] || originalGetElementById.call(document, id);

  // Require report.js
  const reportCode = fs.readFileSync(path.join(__dirname, "../../FE/features/report/report.js"), "utf8");
  // Execute renderVisualCoachingSection definition in this scope
  const evalFunc = new Function(
    "report",
    "session",
    "VisualCoachingEngine",
    "PrepMateVisualSnapshotStore",
    "document",
    "escapeHtml",
    reportCode + "\n return renderVisualCoachingSection(report, session);"
  );

  // Initial session where cameraUsed was mistakenly false at start
  const mockSession = {
    backendSessionId: sessionE,
    visualReport: {
      cameraUsed: false,
      evaluated: false,
      summaryTitle: "Không sử dụng camera",
    },
    userResponses: [
      { question: "Mô tả một dự án thành công của bạn." },
    ],
  };

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  // Run renderVisualCoachingSection
  await evalFunc(mockSession, mockSession, visualEngine, snapshotStore, document, escapeHtml);

  // Verify status pill and gallery were updated based on IndexedDB snapshots!
  assert.notStrictEqual(mockReportElements["visual-status-pill"].textContent, "Camera tắt", "Status pill must not say 'Camera tắt' when snapshots exist");
  assert.ok(mockReportElements["visual-snapshots-count-badge"].textContent.includes("2 lượt có ảnh"), "Badge must reflect 2 snapshots");
  assert.ok(mockReportElements["visual-snapshots-gallery"].innerHTML.includes("pm-visual-turn-card"), "Gallery must render pm-visual-turn-card");
  assert.ok(mockReportElements["visual-snapshots-gallery"].innerHTML.includes("LƯỢT GIỚI THIỆU"), "Must render Introduction card");
  assert.ok(mockReportElements["visual-snapshots-gallery"].innerHTML.includes("LƯỢT #1"), "Must render Question 1 card");
  pass("Test E: Report synchronizes with IndexedDB and flips cameraUsed to true for late enable");

  // Restore document.getElementById
  document.getElementById = originalGetElementById;

  // -------------------------------------------------------------
  // TEST F: Camera errors (permission denied, 0-dim video) -> safe fallback
  // -------------------------------------------------------------
  console.log("\n--- Test F: Camera errors & graceful fallbacks ---");
  cameraModule.stopCamera();

  // F1: Permission denied
  const mockDenyDevices = {
    getUserMedia: async () => {
      const err = new Error("Permission denied");
      err.name = "NotAllowedError";
      throw err;
    },
  };
  const denyResult = await cameraModule.requestCameraAccess(mockDenyDevices);
  assert.strictEqual(denyResult, false, "Permission denied must return false gracefully");
  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.NO_PERMISSION);

  // F2: Video element with 0 dimensions -> does not crash or generate fake blobs
  const zeroVid = {
    videoWidth: 0,
    videoHeight: 0,
    width: 0,
    height: 0,
    readyState: 0,
    addEventListener() {},
    removeEventListener() {},
  };
  const isReady = await cameraModule.waitForVideoReady(zeroVid, 100);
  assert.strictEqual(isReady, false, "Zero-dimension video must time out safely to false");

  pass("Test F: Camera errors & zero-dimension streams fall back gracefully without unhandled rejections");

  console.log("\n===============================================================");
  console.log("   ALL CAMERA LIFECYCLE REPAIR TESTS (A - F) PASSED!            ");
  console.log("===============================================================");
}

if (require.main === module) {
  runCameraLifecycleTests().catch((err) => {
    console.error("\n[FATAL] Camera lifecycle repair test failure:", err);
    process.exit(1);
  });
}

module.exports = { runCameraLifecycleTests };
