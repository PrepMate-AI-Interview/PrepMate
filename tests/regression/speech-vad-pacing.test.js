/**
 * PREPMATE — TEST SUITE: SPEECH VAD & PACING ACCURACY (WI-COACH-AUDIO-02 BƯỚC A)
 *
 * Verifies Voice Activity Detection (VAD) and pacing calculations across:
 *   1. Continuous speech audio.
 *   2. Speech with long silence gaps (ensures WPM measures speech-active time).
 *   3. Pure silence audio (no speech detected, WPM insufficient data).
 *   4. Non-speech acoustic noise (isolated clicks, pops, steady low noise).
 *   5. No recording / empty buffer fallback.
 */

const assert = require('assert');
const path = require('path');

const engine = require(path.resolve(__dirname, '../../FE/features/interview/speech-coaching-engine.js'));
const recorder = require(path.resolve(__dirname, '../../FE/features/interview/interview-audio-recorder.js'));

function pass(name) {
  console.log(`  [PASS] ${name}`);
}

const sampleRate = 16000;

function generateVoicedSpeechBuffer(durationSec, wordCount = 25) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buf = new Float32Array(numSamples);
  const cadence = durationSec / wordCount; // average time per word

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const cycle = t % cadence;
    // 75% of cadence is speech phonemes, 25% is natural inter-word syllable gap
    if (cycle < cadence * 0.75) {
      buf[i] = 0.28 * Math.sin(2 * Math.PI * 220 * t) +
               0.15 * Math.sin(2 * Math.PI * 440 * t) +
               0.02 * (Math.random() - 0.5);
    } else {
      buf[i] = 0.0015 * (Math.random() - 0.5); // room noise floor
    }
  }
  return buf;
}

function runVadPacingTests() {
  console.log('--- RUNNING TEST A: VOICE ACTIVITY DETECTION & PACING ACCURACY ---');

  // Test 1: Continuous Speech (10s, 25 words)
  const speech10s = generateVoicedSpeechBuffer(10, 25);
  const vad1 = engine.analyzePcmVoiceActivity(speech10s, sampleRate);

  assert.strictEqual(vad1.isReliable, true, 'Continuous speech must be reliable');
  assert.strictEqual(vad1.basis, 'speech_active', 'Basis must be speech_active');
  assert.ok(vad1.speechActiveMs >= 7000 && vad1.speechActiveMs <= 10000, `Speech active time should be ~7.5-10s, got ${vad1.speechActiveMs}`);

  const pacing1 = engine.analyzePacing(25, 10000, vad1.speechActiveMs, vad1);
  assert.strictEqual(pacing1.basis, 'speech_active');
  assert.ok(pacing1.wpm >= 140 && pacing1.wpm <= 200, `WPM should be ~150-180 WPM, got ${pacing1.wpm}`);
  assert.ok(pacing1.feedback.includes('phát âm thực tế'), 'Feedback must disclose speech-active basis');
  pass('Test 1: Continuous speech VAD and active WPM verified');

  // Test 2: Speech (10s, 25 words) + Long Silence (20s) = Total 30s
  // Without VAD: 25 words / 30s = 50 WPM (falsely flagged as extremely slow!)
  // With VAD: 25 words / ~9.5s = ~158 WPM (accurately reflects true speech pace during talking!)
  const speechWithLongSilence = new Float32Array(sampleRate * 30);
  speechWithLongSilence.set(speech10s, 0);
  for (let i = sampleRate * 10; i < speechWithLongSilence.length; i++) {
    speechWithLongSilence[i] = 0.0015 * (Math.random() - 0.5);
  }

  const vad2 = engine.analyzePcmVoiceActivity(speechWithLongSilence, sampleRate);
  assert.strictEqual(vad2.isReliable, true, 'Speech with silence must still be reliable');
  assert.strictEqual(vad2.basis, 'speech_active');
  assert.ok(vad2.silenceMs >= 18000, `Silence duration should be >= 18s, got ${vad2.silenceMs}`);
  assert.ok(vad2.speechActiveMs >= 7000 && vad2.speechActiveMs <= 11000, `Speech active time should be isolated to ~7.5-11s, got ${vad2.speechActiveMs}`);

  const pacing2 = engine.analyzePacing(25, 30000, vad2.speechActiveMs, vad2);
  assert.strictEqual(pacing2.basis, 'speech_active');
  assert.ok(pacing2.activeWpm >= 135 && pacing2.activeWpm <= 200, `Active WPM should measure speaking pace (~150 WPM), got ${pacing2.activeWpm}`);
  assert.strictEqual(pacing2.turnWpm, 50, 'Turn WPM must be 50 WPM based on 30s total turn');
  assert.ok(pacing2.feedback.includes('đã trừ khoảng lặng'), 'Feedback must disclose silence was excluded');
  pass('Test 2: Speech with long silence isolates active speech and prevents WPM distortion');

  // Test 3: Pure Silence (10s)
  const pureSilence = new Float32Array(sampleRate * 10);
  for (let i = 0; i < pureSilence.length; i++) {
    pureSilence[i] = 0.001 * (Math.random() - 0.5);
  }
  const vad3 = engine.analyzePcmVoiceActivity(pureSilence, sampleRate);
  assert.strictEqual(vad3.speechActiveMs, 0, 'Pure silence must have 0 speech active ms');
  assert.strictEqual(vad3.isReliable, false, 'Pure silence cannot be reliable');

  const pacing3 = engine.analyzePacing(0, 10000, vad3.speechActiveMs, vad3);
  assert.strictEqual(pacing3.wpm, null, 'WPM must be null on zero speech / word count');
  assert.strictEqual(pacing3.status, 'insufficient_data');
  pass('Test 3: Pure silence correctly reports insufficient data without fabricated metrics');

  // Test 4: Non-speech Acoustic Noise (Isolated clicks/pops)
  const clickBuffer = new Float32Array(sampleRate * 10);
  for (let k = 0; k < 6; k++) {
    const pos = Math.floor(sampleRate * (1 + k * 1.5));
    clickBuffer[pos] = 0.85;
    clickBuffer[pos + 1] = -0.75;
  }
  const vad4 = engine.analyzePcmVoiceActivity(clickBuffer, sampleRate);
  assert.strictEqual(vad4.speechActiveMs, 0, 'Isolated clicks must be filtered by spike smoothing');
  assert.strictEqual(vad4.isReliable, false, 'Clicks must not be marked as speech');
  pass('Test 4: Non-speech impulsive clicks eliminated by VAD filter');

  // Test 5: No recording / Empty buffer fallback
  const emptyBuf = new Float32Array(0);
  const vad5 = engine.analyzePcmVoiceActivity(emptyBuf, sampleRate);
  assert.strictEqual(vad5.speechActiveMs, 0);
  assert.strictEqual(vad5.isReliable, false);
  assert.strictEqual(vad5.basis, 'insufficient_data');

  const pacing5 = engine.analyzePacing(0, 0, null, null);
  assert.strictEqual(pacing5.wpm, null);
  assert.strictEqual(pacing5.basis, 'insufficient_data');
  pass('Test 5: Empty buffer / no recording safely returns missing data state');

  // Test 6: Verify recorder module exposes VAD methods
  assert.strictEqual(typeof recorder.analyzePcmVoiceActivity, 'function', 'Recorder must export analyzePcmVoiceActivity');
  assert.strictEqual(typeof recorder.analyzeVoiceActivityFromBlob, 'function', 'Recorder must export analyzeVoiceActivityFromBlob');
  pass('Test 6: PrepMateAudioRecorder exports VAD capabilities cleanly');

  console.log('\n[TEST A PASS] All 6 VAD & Pacing accuracy assertions passed.\n');
}

if (require.main === module) {
  runVadPacingTests();
}

module.exports = { runVadPacingTests };
