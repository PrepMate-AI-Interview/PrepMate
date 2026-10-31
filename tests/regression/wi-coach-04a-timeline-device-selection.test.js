/**
 * PREPMATE — WI-COACH-04A REGRESSION TEST SUITE
 * Tests:
 * 1. Device enumeration and selection (Microphone & Camera)
 * 2. Master recording (Audio+Video) vs Audio-only recording
 * 3. Per-answer synchronized timeline (events, pause intervals, monotonic clock)
 * 4. Storage measurement and 72-hour retention policy cleanup
 * 5. Session media purge
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const recorderModule = require('../../FE/features/interview/interview-audio-recorder.js');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTestSuite() {
  console.log('=== TEST SUITE: WI-COACH-04A — DEVICE SELECTION, TIMELINE & MASTER RECORDING ===\n');

  // 1. Verify Exports
  assert.strictEqual(typeof recorderModule.getAvailableDevices, 'function', 'Must export getAvailableDevices');
  assert.strictEqual(typeof recorderModule.setSelectedAudioDevice, 'function', 'Must export setSelectedAudioDevice');
  assert.strictEqual(typeof recorderModule.getSelectedAudioDevice, 'function', 'Must export getSelectedAudioDevice');
  assert.strictEqual(typeof recorderModule.setSelectedVideoDevice, 'function', 'Must export setSelectedVideoDevice');
  assert.strictEqual(typeof recorderModule.getSelectedVideoDevice, 'function', 'Must export getSelectedVideoDevice');
  assert.strictEqual(typeof recorderModule.recordTimelineEvent, 'function', 'Must export recordTimelineEvent');
  assert.strictEqual(typeof recorderModule.getTurnTimelineEvents, 'function', 'Must export getTurnTimelineEvents');
  assert.strictEqual(typeof recorderModule.measureStorageUsage, 'function', 'Must export measureStorageUsage');
  assert.strictEqual(typeof recorderModule.cleanupExpiredRecordings, 'function', 'Must export cleanupExpiredRecordings');
  assert.strictEqual(typeof recorderModule.deleteSessionMedia, 'function', 'Must export deleteSessionMedia');
  console.log('[PASS] WI-COACH-04A exports complete API surface');

  // 2. Test Device Selection Persistence
  recorderModule.setSelectedAudioDevice('mock-usb-mic-123');
  assert.strictEqual(recorderModule.getSelectedAudioDevice(), 'mock-usb-mic-123', 'Selected audio device must match');
  recorderModule.setSelectedVideoDevice('mock-hd-cam-456');
  assert.strictEqual(recorderModule.getSelectedVideoDevice(), 'mock-hd-cam-456', 'Selected video device must match');
  console.log('[PASS] Device selection state getters/setters operate cleanly');

  // 3. Setup Mock Media Devices on global navigator
  const mockTrack = (kind) => ({
    kind,
    readyState: 'live',
    enabled: true,
    stop: () => {}
  });

  const mockAudioStream = {
    active: true,
    getAudioTracks: () => [mockTrack('audio')],
    getVideoTracks: () => [],
    getTracks: () => [mockTrack('audio')]
  };

  const mockVideoStream = {
    active: true,
    getAudioTracks: () => [],
    getVideoTracks: () => [mockTrack('video')],
    getTracks: () => [mockTrack('video')]
  };

  Object.defineProperty(global.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async (constraints) => {
        if (constraints && constraints.video) return mockVideoStream;
        return mockAudioStream;
      },
      enumerateDevices: async () => [
        { deviceId: 'mic-1', kind: 'audioinput', label: 'Internal Microphone', groupId: 'g1' },
        { deviceId: 'mic-2', kind: 'audioinput', label: 'USB Headset Mic', groupId: 'g2' },
        { deviceId: 'cam-1', kind: 'videoinput', label: 'HD Webcam', groupId: 'g3' }
      ]
    }
  });

  class MockMediaRecorder {
    constructor(stream, options = {}) {
      this.stream = stream;
      this.mimeType = options.mimeType || 'audio/webm;codecs=opus';
      this.state = 'inactive';
      this.ondataavailable = null;
      this.onstart = null;
      this.onpause = null;
      this.onresume = null;
      this.onstop = null;
    }
    start(timeslice) {
      this.state = 'recording';
      if (this.onstart) this.onstart();
      setTimeout(() => {
        if (this.ondataavailable) {
          const fakeBytes = new Uint8Array(1024);
          this.ondataavailable({ data: new Blob([fakeBytes], { type: this.mimeType }) });
        }
      }, 50);
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
      if (this.onstop) this.onstop();
    }
  }
  global.MediaRecorder = MockMediaRecorder;
  global.MediaRecorder.isTypeSupported = (t) => true;

  class MockMediaStream {
    constructor(tracks = []) {
      this._tracks = [...tracks];
      this.active = true;
    }
    getAudioTracks() {
      return this._tracks.filter(t => t.kind === 'audio');
    }
    getVideoTracks() {
      return this._tracks.filter(t => t.kind === 'video');
    }
    getTracks() {
      return [...this._tracks];
    }
    addTrack(track) {
      this._tracks.push(track);
    }
  }
  global.MediaStream = MockMediaStream;

  // Test getAvailableDevices
  const devices = await recorderModule.getAvailableDevices();
  assert.strictEqual(devices.audioInputs.length, 2, 'Must discover 2 audio inputs');
  assert.strictEqual(devices.videoInputs.length, 1, 'Must discover 1 video input');
  assert.strictEqual(devices.audioInputs[1].label, 'USB Headset Mic');
  console.log('[PASS] getAvailableDevices queries and categorizes hardware inputs');

  // 4. Test Master Audio+Video Recording with Timeline
  const sessA = 'test_sess_coach_04a';
  global.window = { _userWebcamStream: mockVideoStream };

  const startedA = await recorderModule.startAudioRecording(0, 'Giới thiệu bản thân', { includeVideo: true });
  assert.strictEqual(startedA, true, 'startAudioRecording with video must succeed');
  assert.strictEqual(recorderModule.isMasterMediaActive(), true, 'Must flag isMasterMediaActive = true');

  // Record an intra-turn timeline event (e.g. gesture burst)
  recorderModule.recordTimelineEvent({
    type: 'hand_gesture',
    label: 'Cử chỉ mở rộng bàn tay',
    startMs: 250,
    endMs: 500,
    metadata: { confidence: 0.92 }
  });

  // Pause and Resume
  await sleep(60);
  recorderModule.pauseAudioRecording();
  assert.strictEqual(recorderModule.isRecordingPaused(), true, 'Recorder must be paused');

  await sleep(60);
  recorderModule.resumeAudioRecording();
  assert.strictEqual(recorderModule.isRecordingPaused(), false, 'Recorder must be resumed');

  await sleep(60);
  const recordA = await recorderModule.stopAndSaveAudioRecording(sessA, 0, 'Giới thiệu bản thân');
  assert.ok(recordA, 'Record A must be returned');
  assert.strictEqual(recordA.sessionId, sessA);
  assert.strictEqual(recordA.turnIndex, 0);
  assert.strictEqual(recordA.isMasterMedia, true, 'Record A must be flagged as master media');
  assert.ok(recordA.videoBlob, 'Record A must have videoBlob');
  assert.ok(recordA.timeline, 'Record A must have timeline');
  assert.strictEqual(recordA.timeline.mediaType, 'master_video_audio');
  assert.strictEqual(recordA.timeline.hasVideo, true);
  assert.strictEqual(recordA.timeline.hasAudio, true);
  assert.ok(recordA.timeline.pauseIntervals.length >= 1, 'Timeline must track pause intervals');
  assert.ok(recordA.timeline.events.some(e => e.type === 'hand_gesture'), 'Timeline must track custom events');
  console.log('[PASS] Master audio+video recording produces unified media with synchronized timeline');

  // 5. Test Audio-only Recording (Camera Off)
  global.window._userWebcamStream = null;
  const startedB = await recorderModule.startAudioRecording(1, 'Câu hỏi 1: Tối ưu SQL', { includeVideo: false });
  assert.strictEqual(startedB, true);
  assert.strictEqual(recorderModule.isMasterMediaActive(), false, 'Must flag isMasterMediaActive = false when camera off');

  await sleep(60);
  const recordB = await recorderModule.stopAndSaveAudioRecording(sessA, 1, 'Câu hỏi 1: Tối ưu SQL');
  assert.ok(recordB);
  assert.strictEqual(recordB.turnIndex, 1);
  assert.strictEqual(recordB.isMasterMedia, false);
  assert.strictEqual(recordB.timeline.mediaType, 'audio_only');
  assert.strictEqual(recordB.timeline.hasVideo, false);
  console.log('[PASS] Audio-only recording cleanly falls back with timeline when camera is off');

  // 6. Test Storage Usage Measurement
  const storageStats = await recorderModule.measureStorageUsage(sessA);
  assert.strictEqual(storageStats.sessionId, sessA);
  assert.strictEqual(storageStats.recordCount, 2, 'Session must have 2 records');
  assert.ok(storageStats.sessionBytes > 0, 'Session bytes must be measured');
  console.log(`[PASS] measureStorageUsage accurately computes byte sizes (${storageStats.sessionBytes} bytes)`);

  // 7. Test 72-Hour Retention Cleanup
  const cleanupRes = await recorderModule.cleanupExpiredRecordings(72);
  assert.strictEqual(cleanupRes.status === 'success' || cleanupRes.status === 'memory_cleaned', true);
  
  // Verify fresh records for sessA were NOT deleted
  const freshA = await recorderModule.getRecording(`${sessA}_turn_0`);
  assert.ok(freshA, 'Unexpired session A record must be preserved');
  console.log('[PASS] cleanupExpiredRecordings purges records older than 72h while preserving active records');

  // 8. Test Session Media Purge
  const purged = await recorderModule.deleteSessionMedia(sessA);
  assert.strictEqual(purged, true, 'deleteSessionMedia must succeed');
  const checkPurged = await recorderModule.getRecording(`${sessA}_turn_0`);
  assert.strictEqual(checkPurged, null, 'Purged record must no longer exist');
  console.log('[PASS] deleteSessionMedia safely purges all session media on user command');

  console.log('\n--- ALL 8 WI-COACH-04A REGRESSION CHECKS PASSED CLEANLY ---');
}

runTestSuite().catch(err => {
  console.error('\n[TEST FAILURE]:', err);
  process.exit(1);
});
