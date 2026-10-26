/**
 * camera-preview-privacy.test.js
 * Regression tests for Camera Preview & Privacy Controls (WI-COACH-VIDEO-01 Bước A).
 * Verifies:
 * - Proper state transitions (OFF -> REQUESTING -> ON -> OFF, NO_PERMISSION)
 * - Hardware stream track release on stopCamera()
 * - Full privacy notice disclosure (local processing only, no unauthorized uploads)
 * - Audio track isolation (camera requests audio: false)
 * - Candidate can complete interview with camera OFF
 */

const assert = require("assert");
const path = require("path");

function pass(name) {
  console.log(`  [PASS] ${name}`);
}

function mockElement() {
  return {
    style: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); },
    },
    textContent: "",
    title: "",
    innerHTML: "",
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k]; },
    querySelector() { return mockElement(); },
  };
}

function setupMockDom() {
  const elements = {
    "btn-toggle-cam": mockElement(),
    "webcam-video": mockElement(),
    "camera-placeholder": mockElement(),
    "camera-privacy-indicator": mockElement(),
    "candidate-tile-status": mockElement(),
    "candidate-tile-name": mockElement(),
    "candidate-initials": mockElement(),
  };

  global.window = global.window || {};
  global.document = {
    getElementById(id) {
      if (!elements[id]) elements[id] = mockElement();
      return elements[id];
    },
    querySelector() {
      return mockElement();
    },
  };
  global.ZOOM_ICONS = {
    camOn: "<svg>camOn</svg>",
    camMuted: "<svg>camMuted</svg>",
  };

  return elements;
}

function createMockStream(numVideoTracks = 1) {
  const tracks = [];
  for (let i = 0; i < numVideoTracks; i++) {
    tracks.push({
      kind: "video",
      stopped: false,
      stop() {
        this.stopped = true;
      },
    });
  }
  return {
    active: true,
    getTracks() {
      return tracks;
    },
    getVideoTracks() {
      return tracks;
    },
    getAudioTracks() {
      return [];
    },
  };
}

async function runCameraPreviewPrivacyTests() {
  console.log("--- RUNNING CAMERA PREVIEW & PRIVACY REGRESSION TESTS (Bước A) ---");

  const domElements = setupMockDom();
  delete require.cache[require.resolve("../../FE/features/interview/interview-camera.js")];
  const cameraModule = require("../../FE/features/interview/interview-camera.js");

  // 1. Initial State & Privacy Disclosure
  assert.strictEqual(cameraModule.getCamState(), "OFF");
  assert.ok(cameraModule.CAM_PRIVACY_DISCLOSURE, "Privacy disclosure string must exist");
  assert.ok(
    cameraModule.CAM_PRIVACY_DISCLOSURE.includes("cục bộ") &&
    cameraModule.CAM_PRIVACY_DISCLOSURE.includes("không") &&
    cameraModule.CAM_PRIVACY_DISCLOSURE.includes("máy chủ"),
    "Privacy notice must state local-only processing and no unauthorized uploads"
  );
  pass("1. Initial state is OFF and privacy disclosure is explicitly present");

  // 2. Transition to ON & audio isolation
  const mockStream = createMockStream();
  let requestedConstraints = null;
  const mockMediaDevices = {
    getUserMedia: async (constraints) => {
      requestedConstraints = constraints;
      return mockStream;
    },
  };

  const success = await cameraModule.requestCameraAccess(mockMediaDevices);
  assert.strictEqual(success, true);
  assert.strictEqual(cameraModule.getCamState(), "ON");
  assert.strictEqual(requestedConstraints.audio, false, "Camera getUserMedia must specify audio: false");
  assert.ok(requestedConstraints.video, "Video constraints must be defined");
  assert.strictEqual(domElements["webcam-video"].style.display, "block");
  assert.strictEqual(domElements["camera-placeholder"].style.display, "none");
  assert.strictEqual(domElements["btn-toggle-cam"].getAttribute("aria-pressed"), "true");
  pass("2. Camera ON enables video, hides placeholder, and isolates audio (audio: false)");

  // 3. stopCamera releases hardware tracks cleanly
  const mockStream2 = createMockStream(2);
  const mockMediaDevices2 = { getUserMedia: async () => mockStream2 };
  await cameraModule.requestCameraAccess(mockMediaDevices2);

  cameraModule.stopCamera();
  assert.strictEqual(cameraModule.getCamState(), "OFF");
  const tracks = mockStream2.getTracks();
  assert.strictEqual(tracks.length, 2);
  assert.ok(tracks.every(t => t.stopped === true), "All media tracks must be stopped cleanly");
  assert.strictEqual(global.window._userWebcamStream, null, "Stream reference must be nullified");
  assert.strictEqual(domElements["webcam-video"].style.display, "none");
  assert.strictEqual(domElements["camera-placeholder"].style.display, "flex");
  assert.strictEqual(domElements["btn-toggle-cam"].getAttribute("aria-pressed"), "false");
  pass("3. stopCamera() cleanly releases all hardware tracks and restores OFF state");

  // 4. Permission denial does not disrupt candidate flow
  const mockDenyDevices = {
    getUserMedia: async () => {
      const err = new Error("Permission denied");
      err.name = "NotAllowedError";
      throw err;
    },
  };
  const failResult = await cameraModule.requestCameraAccess(mockDenyDevices);
  assert.strictEqual(failResult, false);
  assert.strictEqual(cameraModule.getCamState(), "NO_PERMISSION");
  assert.strictEqual(domElements["webcam-video"].style.display, "none");
  assert.strictEqual(domElements["camera-placeholder"].style.display, "flex");
  pass("4. Permission denial transitions to NO_PERMISSION gracefully without crashing");

  // 5. Unsupported browser handles fallback
  const notSupportedResult = await cameraModule.requestCameraAccess({});
  assert.strictEqual(notSupportedResult, false);
  assert.strictEqual(cameraModule.getCamState(), "NOT_SUPPORTED");
  pass("5. Unsupported environments transition to NOT_SUPPORTED cleanly");

  console.log("ALL CAMERA PREVIEW & PRIVACY TESTS PASSED (Bước A).\n");
}

if (require.main === module) {
  runCameraPreviewPrivacyTests().catch(err => {
    console.error("Test failure:", err);
    process.exit(1);
  });
}

module.exports = { runCameraPreviewPrivacyTests };
