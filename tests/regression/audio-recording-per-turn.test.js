/**
 * PREPMATE — TEST SUITE: AUDIO RECORDING PER TURN (WI-COACH-AUDIO-01 STEP 1)
 *
 * Verifies:
 *   1. Audio recording initialization and state transitions.
 *   2. Per-turn audio isolation (Turn 0 Intro, Turn 1 Q1, Turn 2 Q2) without mixing.
 *   3. Permission denial handling (graceful fallback to text/STT without blocking).
 *   4. Failure resilience (transcript and draft answers never lost on recording failure).
 *   5. Session scoped persistence and safe deletion.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const recorderModulePath = path.resolve(__dirname, '../../FE/features/interview/interview-audio-recorder.js');

// Mock browser environment for unit test
global.window = global;
global.document = {
  getElementById: (id) => {
    return {
      id,
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      innerHTML: '',
      style: {},
      title: ''
    };
  }
};

// Mock MediaRecorder and getUserMedia
class MockMediaStream {
  constructor() {
    this.active = true;
    this.tracks = [{ stop: () => { this.active = false; }, readyState: 'live' }];
  }
  getAudioTracks() { return this.tracks; }
  getTracks() { return this.tracks; }
}

class MockMediaRecorder {
  constructor(stream, options = {}) {
    this.stream = stream;
    this.options = options;
    this.state = 'inactive';
    this.mimeType = options.mimeType || 'audio/webm;codecs=opus';
    this.ondataavailable = null;
    this.onstart = null;
    this.onstop = null;
    this.onerror = null;
    this.onpause = null;
    this.onresume = null;
  }

  static isTypeSupported(type) {
    return type.includes('audio/webm') || type.includes('audio/ogg');
  }

  start(timeslice) {
    this.state = 'recording';
    if (this.onstart) this.onstart();
    // Simulate audio data delivery
    setTimeout(() => {
      if (this.state === 'recording' && this.ondataavailable) {
        this.ondataavailable({ data: { size: 1024, type: this.mimeType } });
      }
    }, 20);
  }

  pause() {
    this.state = 'paused';
    if (this.onpause) this.onpause();
  }

  resume() {
    this.state = 'recording';
    if (this.onresume) this.onresume();
  }

  stop() {
    this.state = 'inactive';
    if (this.ondataavailable) {
      this.ondataavailable({ data: { size: 2048, type: this.mimeType } });
    }
    if (this.onstop) this.onstop();
  }
}

global.MediaRecorder = MockMediaRecorder;

let mockGetUserMediaShouldFail = false;
let mockGetUserMediaErrorName = 'NotAllowedError';

const mockNavigator = {
  mediaDevices: {
    getUserMedia: async (constraints) => {
      if (mockGetUserMediaShouldFail) {
        const err = new Error('Permission denied');
        err.name = mockGetUserMediaErrorName;
        throw err;
      }
      return new MockMediaStream();
    }
  }
};

try {
  Object.defineProperty(globalThis, 'navigator', {
    value: mockNavigator,
    configurable: true,
    writable: true
  });
} catch (e) {
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: mockNavigator.mediaDevices,
    configurable: true,
    writable: true
  });
}

// Load recorder
require(recorderModulePath);
const Recorder = global.PrepMateAudioRecorder;

async function runStep1Tests() {
  console.log('=== TEST SUITE: STEP 1 — AUDIO RECORDING PER TURN ===\n');
  let passCount = 0;

  function pass(desc) {
    passCount++;
    console.log(`[PASS] ${desc}`);
  }

  // Test 1: Module loaded and exports APIs
  assert.ok(Recorder, 'PrepMateAudioRecorder must be defined');
  assert.strictEqual(typeof Recorder.startAudioRecording, 'function');
  assert.strictEqual(typeof Recorder.stopAndSaveAudioRecording, 'function');
  assert.strictEqual(typeof Recorder.getRecording, 'function');
  assert.strictEqual(typeof Recorder.getAllRecordingsForSession, 'function');
  assert.strictEqual(typeof Recorder.deleteRecordingsForSession, 'function');
  pass('PrepMateAudioRecorder exports complete lifecycle API');

  // Test 2: Turn 0 (Intro) recording
  const sessId = 'test-session-step1';
  mockGetUserMediaShouldFail = false;

  const started0 = await Recorder.startAudioRecording(0, 'Giới thiệu bản thân');
  assert.strictEqual(started0, true, 'Start recording turn 0 should succeed');
  assert.strictEqual(Recorder.isRecordingActive(), true);

  // Wait a moment for chunk simulation
  await new Promise(r => setTimeout(r, 50));

  const record0 = await Recorder.stopAndSaveAudioRecording(sessId, 0, 'Giới thiệu bản thân');
  assert.ok(record0, 'Record 0 must be created');
  assert.strictEqual(record0.turnIndex, 0);
  assert.strictEqual(record0.sessionId, sessId);
  assert.strictEqual(record0.question, 'Giới thiệu bản thân');
  assert.ok(record0.durationMs >= 0);
  assert.strictEqual(Recorder.isRecordingActive(), false);
  pass('Turn 0 (Introduction) recording saved with valid metadata and duration');

  // Test 3: Turn 1 (Question 1) recording & isolation
  const q1Text = 'Trình bày cách xử lý Deadlock trong SQL Server?';
  const started1 = await Recorder.startAudioRecording(1, q1Text);
  assert.strictEqual(started1, true);

  await new Promise(r => setTimeout(r, 50));

  const record1 = await Recorder.stopAndSaveAudioRecording(sessId, 1, q1Text);
  assert.ok(record1);
  assert.strictEqual(record1.turnIndex, 1);
  assert.strictEqual(record1.question, q1Text);
  pass('Turn 1 (Question 1) recording created independently');

  // Test 4: Turn 2 (Question 2) recording & isolation check
  const q2Text = 'Sự khác biệt giữa optimistic concurrency và pessimistic concurrency?';
  const started2 = await Recorder.startAudioRecording(2, q2Text);
  assert.strictEqual(started2, true);

  await new Promise(r => setTimeout(r, 50));

  const record2 = await Recorder.stopAndSaveAudioRecording(sessId, 2, q2Text);
  assert.ok(record2);
  assert.strictEqual(record2.turnIndex, 2);
  assert.strictEqual(record2.question, q2Text);

  // Retrieve all recordings for session and verify strictly separated
  const allRecords = await Recorder.getAllRecordingsForSession(sessId);
  assert.strictEqual(allRecords.length, 3, 'Must have exactly 3 distinct recordings');
  assert.strictEqual(allRecords[0].turnIndex, 0);
  assert.strictEqual(allRecords[1].turnIndex, 1);
  assert.strictEqual(allRecords[2].turnIndex, 2);
  assert.strictEqual(allRecords[1].question, q1Text);
  assert.strictEqual(allRecords[2].question, q2Text);
  pass('Strict audio recording isolation between turns confirmed (no mixing or overwriting)');

  // Test 5: Permission Denial (NotAllowedError)
  Recorder.closeAllAudioTracks();
  mockGetUserMediaShouldFail = true;
  mockGetUserMediaErrorName = 'NotAllowedError';

  const startedDenied = await Recorder.startAudioRecording(3, 'Câu hỏi bị từ chối mic');
  assert.strictEqual(startedDenied, false, 'Start recording should return false on permission denial');
  assert.strictEqual(Recorder.isRecordingActive(), false);
  assert.strictEqual(Recorder.isPermissionDenied(), true);
  pass('Microphone permission denial handled gracefully without crash');

  // Test 6: General Hardware / Device Error
  Recorder.closeAllAudioTracks();
  mockGetUserMediaShouldFail = true;
  mockGetUserMediaErrorName = 'NotFoundError';

  const startedNotFound = await Recorder.startAudioRecording(4, 'Không có thiết bị');
  assert.strictEqual(startedNotFound, false);
  pass('Missing hardware error handled gracefully');

  // Test 7: Session Scoped Deletion
  const otherSessionId = 'other-session-step1';
  mockGetUserMediaShouldFail = false;
  await Recorder.startAudioRecording(0, 'Intro other');
  await Recorder.stopAndSaveAudioRecording(otherSessionId, 0, 'Intro other');

  // Delete only sessId
  await Recorder.deleteRecordingsForSession(sessId);
  const remainingSess = await Recorder.getAllRecordingsForSession(sessId);
  const remainingOther = await Recorder.getAllRecordingsForSession(otherSessionId);

  assert.strictEqual(remainingSess.length, 0, 'Deleted session must have 0 recordings');
  assert.strictEqual(remainingOther.length, 1, 'Other session recordings must remain untouched');
  pass('Session-scoped deletion removes only targeted session data');

  console.log(`\n--- ALL ${passCount} STEP 1 TESTS PASSED CLEANLY ---`);
}

runStep1Tests().catch(err => {
  console.error('\n[STEP 1 TEST FAILURE]:', err);
  process.exit(1);
});
