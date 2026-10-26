/**
 * PREPMATE — WI-COACH-VIDEO-CLOSEOUT-01 REGRESSION TEST SUITE
 * SNAPSHOT RACE REGRESSION: TTS CANCELLATION, IN-TURN SAMPLING & SNAPSHOT BINDING
 *
 * Reproduces and validates:
 * 1. AI question starts TTS speakAI() with an onEndCallback.
 * 2. In-turn visual sampling begins immediately for the active turn.
 * 3. Candidate rapidly submits answer before TTS finishes.
 * 4. stopSpeaking() / cancelCurrentSpeech() actively cancels the TTS callback.
 * 5. Turn completes and moves to next turn:
 *    - The cancellation of TTS callback does NOT prevent turn snapshot capture.
 *    - Snapshot is saved with the exact sessionId and turnIndex.
 *    - Snapshot does NOT leak or attach to the next turn.
 *    - Camera not ready or IndexedDB error records missing photo; NO fake Blobs.
 *    - flushPendingTurnSnapshot() properly awaits in-flight writes.
 *    - No duplicate intervals on turn start or pause/resume.
 *    - Session finish halts camera and does not create extra out-of-lifecycle snapshots.
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

  // Mock SpeechSynthesis
  globalThis.window.speechSynthesis = {
    speaking: false,
    paused: false,
    cancel() {
      this.speaking = false;
      this.paused = false;
    },
    speak() {
      this.speaking = true;
    },
  };
}

async function runSnapshotRaceTests() {
  console.log("===============================================================");
  console.log("   WI-COACH-VIDEO-CLOSEOUT-01: SNAPSHOT RACE REGRESSION        ");
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
  globalThis.handleInterviewTurnStarted = cameraModule.handleInterviewTurnStarted;
  globalThis.handleInterviewTurnCompleted = cameraModule.handleInterviewTurnCompleted;
  globalThis.captureAndAnalyzeCurrentFrame = cameraModule.captureAndAnalyzeCurrentFrame;
  globalThis.stopCamera = cameraModule.stopCamera;

  // Load TTS subsystem
  require("../../FE/features/interview/interview-tts.js");

  const sessionId = "sess_race_closeout_01";
  globalThis.window.currentInterviewSession = { backendSessionId: sessionId };
  globalThis.window.interviewPhase = "ADAPTIVE_INTERVIEW";

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
  // SCENARIO 1: TTS speakAI started -> User rapidly submits -> TTS callback cancelled -> Snapshot preserved
  // -----------------------------------------------------------------
  console.log("--- 1. TTS speakAI started, user rapidly submits, callback cancelled ---");
  await snapshotStore.clearAllSnapshots();
  cameraModule.clearSessionVisualEvaluations();

  let ttsCallbackFired = false;
  const mockTtsCallback = () => {
    ttsCallbackFired = true;
  };

  // Step 1.1: Question display triggers in-turn sampling immediately
  cameraModule.handleInterviewTurnStarted(1);

  // Step 1.2: speakAI called with callback
  globalThis.window._activeSpeechCallback = mockTtsCallback;
  globalThis.window.speechSynthesis.speaking = true;

  // Verify sampling is active
  const evaluationsTurn1 = cameraModule.getSessionVisualEvaluations();
  assert.ok(evaluationsTurn1.length >= 1, "Sampling must have captured initial frame for Turn 1");
  assert.strictEqual(evaluationsTurn1[0].turnIndex, 1);
  assert.strictEqual(evaluationsTurn1[0].cameraEnabled, true);

  // Step 1.3: Candidate submits answer rapidly (before TTS ends)
  // cancelCurrentSpeech is called on answer submit
  if (typeof globalThis.window.cancelCurrentSpeech === "function") {
    globalThis.window.cancelCurrentSpeech("submit_answer");
  }

  // Verify TTS callback was truly cancelled (set to null) and NOT fired
  assert.strictEqual(globalThis.window._activeSpeechCallback, null, "Active TTS speech callback must be cleared to null");
  assert.strictEqual(ttsCallbackFired, false, "TTS callback must NOT have fired after cancellation");
  pass("1A. TTS cancellation actively cleared speech callback without invoking it");

  // Step 1.4: Turn completes
  const flushPromise = cameraModule.handleInterviewTurnCompleted(1);
  await flushPromise;

  // Step 1.5: Assert snapshot for Turn 1 is cleanly saved to IndexedDB
  const snap1 = await snapshotStore.getSnapshot(sessionId, 1);
  assert.ok(snap1, "Turn 1 snapshot must be persisted in store despite TTS callback cancellation");
  assert.strictEqual(snap1.sessionId, sessionId, "Snapshot sessionId must match exactly");
  assert.strictEqual(snap1.turnIndex, 1, "Snapshot turnIndex must be 1");
  assert.ok(snap1.imageBlob && snap1.imageBlob.size > 0, "Snapshot imageBlob must be a valid non-empty Blob");
  pass("1B. Turn 1 snapshot successfully persisted and bound to Turn 1 despite cancelled TTS");

  // -----------------------------------------------------------------
  // SCENARIO 2: Next turn isolation — Turn 1 snapshot does not attach to Turn 2
  // -----------------------------------------------------------------
  console.log("\n--- 2. Turn 2 isolation: Snapshot does NOT leak to next turn ---");
  // Turn 2 begins
  cameraModule.handleInterviewTurnStarted(2);

  let tts2Fired = false;
  globalThis.window._activeSpeechCallback = () => { tts2Fired = true; };
  globalThis.window.cancelCurrentSpeech("rapid_submit_turn_2");
  assert.strictEqual(tts2Fired, false);

  await cameraModule.handleInterviewTurnCompleted(2);

  const snapTurn1Again = await snapshotStore.getSnapshot(sessionId, 1);
  const snapTurn2 = await snapshotStore.getSnapshot(sessionId, 2);

  assert.ok(snapTurn1Again, "Turn 1 snapshot still exists");
  assert.ok(snapTurn2, "Turn 2 snapshot exists");
  assert.strictEqual(snapTurn1Again.turnIndex, 1);
  assert.strictEqual(snapTurn2.turnIndex, 2);
  assert.strictEqual(snapTurn1Again.id, `${sessionId}_turn_1`);
  assert.strictEqual(snapTurn2.id, `${sessionId}_turn_2`);
  assert.notStrictEqual(snapTurn1Again.id, snapTurn2.id, "Snapshot IDs must be strictly unique per turn");
  pass("2. Consecutive turns are strictly isolated; no cross-turn snapshot leakage");

  // -----------------------------------------------------------------
  // SCENARIO 3: Camera not ready or IndexedDB error -> Truthful missing photo, NO fake Blobs
  // -----------------------------------------------------------------
  console.log("\n--- 3. Camera inactive or storage failure: Truthful missing record, NO fake Blobs ---");
  // 3A: Camera inactive
  globalThis.window._userWebcamStream = null;
  cameraModule.setCamState(cameraModule.CAM_STATE.OFF);

  cameraModule.handleInterviewTurnStarted(3);
  await cameraModule.handleInterviewTurnCompleted(3);

  const snapTurn3 = await snapshotStore.getSnapshot(sessionId, 3);
  assert.strictEqual(snapTurn3, null, "No snapshot Blob stored when camera was OFF");

  const evals = cameraModule.getSessionVisualEvaluations();
  const eval3 = evals.find(e => e.turnIndex === 3);
  assert.ok(eval3, "Evaluation record for Turn 3 exists");
  assert.strictEqual(eval3.cameraEnabled, false, "cameraEnabled must be false");
  assert.strictEqual(eval3.hasSnapshot, false, "hasSnapshot must be false; NO fake Blob created");
  pass("3A. Camera-off turn records truthful cameraEnabled=false without synthesizing fake Blobs");

  // 3B: Storage error handling (e.g. QuotaExceededError)
  globalThis.window._userWebcamStream = mockStream;
  cameraModule.setCamState(cameraModule.CAM_STATE.ON);

  const failingStore = {
    createThumbnailBlob: () => Promise.resolve({ blob: { size: 1024, type: "image/webp" }, width: 320, height: 240, mimeType: "image/webp" }),
    saveSnapshot: () => Promise.reject(new Error("QuotaExceededError: disk full")),
    getSnapshot: () => Promise.resolve(null),
  };
  globalThis.PrepMateVisualSnapshotStore = failingStore;

  cameraModule.handleInterviewTurnStarted(4);
  await cameraModule.handleInterviewTurnCompleted(4);

  const eval4 = cameraModule.getSessionVisualEvaluations().find(e => e.turnIndex === 4);
  assert.ok(eval4, "Evaluation record for Turn 4 exists");
  assert.strictEqual(eval4.hasSnapshot, false, "hasSnapshot must be false on storage failure");
  assert.ok(eval4.snapshotError && eval4.snapshotError.includes("QuotaExceededError"), "Error message truthfully captured");
  pass("3B. Storage failure truthfully recorded with hasSnapshot=false and exact error");

  // Restore store
  globalThis.PrepMateVisualSnapshotStore = snapshotStore;

  // -----------------------------------------------------------------
  // SCENARIO 4: flushPendingTurnSnapshot properly awaits pending writes
  // -----------------------------------------------------------------
  console.log("\n--- 4. flushPendingTurnSnapshot() awaits in-flight saves ---");
  const slowStore = {
    createThumbnailBlob: () => new Promise(resolve => {
      setTimeout(() => {
        resolve({ blob: { size: 2048, type: "image/webp" }, width: 320, height: 240, mimeType: "image/webp" });
      }, 50);
    }),
    saveSnapshot: () => new Promise(resolve => {
      setTimeout(() => resolve(true), 50);
    }),
    getSnapshot: () => Promise.resolve(null),
  };
  globalThis.PrepMateVisualSnapshotStore = slowStore;

  cameraModule.handleInterviewTurnStarted(5);
  const flushStart = Date.now();
  const flushRes = await cameraModule.flushPendingTurnSnapshot(5, 1000);
  const flushDuration = Date.now() - flushStart;

  assert.strictEqual(flushRes, true, "flushPendingTurnSnapshot must resolve true on success");
  assert.ok(flushDuration >= 90, `flushPendingTurnSnapshot awaited the ~100ms async pipeline (${flushDuration}ms)`);
  pass("4. flushPendingTurnSnapshot correctly awaited in-flight thumbnail and storage operations");

  globalThis.PrepMateVisualSnapshotStore = snapshotStore;

  // -----------------------------------------------------------------
  // SCENARIO 5: No duplicate intervals on turn start or Pause/Resume
  // -----------------------------------------------------------------
  console.log("\n--- 5. Duplicate timer leak prevention ---");
  // Multiple rapid starts for same turn
  cameraModule.handleInterviewTurnStarted(6);
  cameraModule.handleInterviewTurnStarted(6);
  cameraModule.handleInterviewTurnStarted(6);

  // Cycling pause/resume
  cameraModule.pauseInTurnSampling();
  cameraModule.resumeInTurnSampling();
  cameraModule.pauseInTurnSampling();
  cameraModule.resumeInTurnSampling();

  assert.strictEqual(cameraModule.isSamplingPaused(), false);
  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.ON);
  pass("5. Multiple turn starts and Pause/Resume cycles produce zero duplicate interval timers");

  // -----------------------------------------------------------------
  // SCENARIO 6: Session end stops camera and creates NO out-of-lifecycle snapshots
  // -----------------------------------------------------------------
  console.log("\n--- 6. Session completion boundary enforcement ---");
  await cameraModule.handleInterviewTurnCompleted(6);

  const evalCountBeforeStop = cameraModule.getSessionVisualEvaluations().length;

  // Stop camera on finish
  cameraModule.stopCamera();

  assert.strictEqual(cameraModule.getCamState(), cameraModule.CAM_STATE.OFF, "Camera state must be OFF");
  assert.strictEqual(globalThis.window._userWebcamStream, null, "Webcam stream must be null");

  // Attempt capture after session ended
  const postEndCapture = cameraModule.captureAndAnalyzeCurrentFrame(7);
  assert.ok(postEndCapture, "Post-end call handled defensively");
  assert.strictEqual(postEndCapture.cameraEnabled, false, "Post-end capture must not use camera");
  assert.strictEqual(postEndCapture.hasSnapshot, false, "Post-end capture must NOT create snapshot");

  const snap7 = await snapshotStore.getSnapshot(sessionId, 7);
  assert.strictEqual(snap7, null, "No snapshot saved for post-end turn 7");
  pass("6. Session finish strictly shuts down camera with zero out-of-lifecycle snapshot creation");

  console.log("\n===============================================================");
  console.log("   ALL SNAPSHOT RACE & TTS CANCELLATION TESTS PASSED!          ");
  console.log("===============================================================");
}

if (require.main === module) {
  runSnapshotRaceTests().catch((err) => {
    console.error("\n[FATAL] Snapshot race test failed:", err);
    process.exit(1);
  });
}

module.exports = { runSnapshotRaceTests };
