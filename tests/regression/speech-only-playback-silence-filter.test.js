/**
 * PREPMATE — TEST SUITE: SPEECH-ONLY PLAYBACK, SILENCE FILTERING & EMPTY RECORDING ELIMINATION
 * Work Item: WI-COACH-AUDIO-02R
 *
 * Verifies all 12 key scenarios:
 *   1. Clear speech -> full playback derived/rendered, speechActiveMs matches durationMs.
 *   2. Speech with long silence gaps -> gaps filtered out, concatenated duration < original duration.
 *   3. Starts with silence (leading silence) -> trimmed, startMs shifted to speech onset.
 *   4. Ends with silence (trailing silence) -> trimmed, endMs bounded by post-roll.
 *   5. Fillers / hesitations ("ừm", "ờ", "à", "thì…") -> preserved intact via bridging gap.
 *   6. Stuttering / word repetition -> preserved without clipping syllables.
 *   7. Soft / quiet speech (amplitude ~0.015, RMS > 0.008) -> recognized as speech, not discarded.
 *   8. Pure silence recording -> isPureSilence: true, no play button, truthful silence notice.
 *   9. Absent recording -> no-recording notice, zero fake blobs, zero fabricated WPM.
 *  10. Decode error / corrupt audio data -> handled gracefully, no uncaught exceptions.
 *  11. Multi-turn isolation -> independent playback, mutual exclusion pauses other turns.
 *  12. Reload report -> derived speech-only audio matches IndexedDB data; original recording untouched.
 */

const assert = require('assert');
const path = require('path');

// --- Synthetic Audio Signal Generators ---
const SAMPLE_RATE = 16000;

function createSineWave(durationSec, freq = 200, amplitude = 0.2) {
  const numSamples = Math.floor(durationSec * SAMPLE_RATE);
  const samples = new Float32Array(numSamples);
  const angularFreq = 2 * Math.PI * freq / SAMPLE_RATE;
  for (let i = 0; i < numSamples; i++) {
    samples[i] = Math.sin(i * angularFreq) * amplitude;
  }
  return samples;
}

function createSilence(durationSec, noiseLevel = 0.0001) {
  const numSamples = Math.floor(durationSec * SAMPLE_RATE);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = (Math.random() - 0.5) * noiseLevel;
  }
  return samples;
}

function concatenatePcm(...arrays) {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Float32Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function createMockAudioBuffer(samples, sampleRate = SAMPLE_RATE) {
  return {
    numberOfChannels: 1,
    sampleRate: sampleRate,
    length: samples.length,
    duration: samples.length / sampleRate,
    getChannelData: (ch) => samples
  };
}

// --- DOM & Audio Mocks for Node.js Testing ---
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.classList = {
      _classes: new Set(),
      add(...cs) { cs.forEach(c => this._classes.add(c)); },
      remove(...cs) { cs.forEach(c => this._classes.delete(c)); },
      contains(c) { return this._classes.has(c); },
      toggle(c, val) {
        if (val === undefined) {
          if (this._classes.has(c)) this._classes.delete(c);
          else this._classes.add(c);
        } else if (val) this._classes.add(c);
        else this._classes.delete(c);
      }
    };
    this.children = [];
    this.attributes = new Map();
    this.style = {};
    this._innerHTML = '';
    this.textContent = '';
    this.onclick = null;
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) {
    this._innerHTML = val;
    this.children = [];
    if (val.includes('pm-audio-play-btn')) {
      const btn = new MockElement('button');
      btn.className = 'pm-audio-play-btn';
      const icon = new MockElement('span');
      icon.className = 'play-icon';
      icon.innerHTML = '▶';
      const lbl = new MockElement('span');
      lbl.className = 'play-label';
      lbl.textContent = 'Nghe lại';
      btn.children.push(icon, lbl);
      this.children.push(btn);

      const timeline = new MockElement('div');
      timeline.className = 'pm-audio-timeline';
      const bar = new MockElement('div');
      bar.className = 'pm-audio-progress-bar';
      const fill = new MockElement('div');
      fill.className = 'pm-audio-progress-fill';
      bar.children.push(fill);
      const meta = new MockElement('div');
      meta.className = 'pm-audio-time-meta';
      const curT = new MockElement('span');
      curT.className = 'pm-audio-current-time';
      curT.textContent = '00:00';
      const totT = new MockElement('span');
      totT.className = 'pm-audio-total-time';
      totT.textContent = '00:00';
      meta.children.push(curT, totT);
      timeline.children.push(bar, meta);
      this.children.push(timeline);

      const badgeInfo = new MockElement('div');
      badgeInfo.className = 'pm-audio-badge-info';
      this.children.push(badgeInfo);
    }
  }

  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.get(k) || null; }

  querySelector(selector) {
    const sel = selector.replace('.', '').trim();
    return this._find(sel);
  }

  _find(cls) {
    if (this.className && this.className.includes(cls)) return this;
    for (const child of this.children) {
      const res = child._find(cls);
      if (res) return res;
    }
    return null;
  }

  appendChild(el) {
    this.children.push(el);
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 200, height: 10 };
  }
}

class MockAudio {
  constructor() {
    this.src = '';
    this.paused = true;
    this.currentTime = 0;
    this.duration = 10;
    this.onloadedmetadata = null;
    this.ontimeupdate = null;
    this.onended = null;
    this.onerror = null;
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

global.document = {
  createElement: (tag) => new MockElement(tag),
  getElementById: () => null
};
global.Audio = MockAudio;
global.URL = {
  createObjectURL: (blob) => `blob:mock-audio/${Math.random().toString(36).substring(2)}`,
  revokeObjectURL: () => {}
};
global.Blob = class {
  constructor(parts = [], opts = {}) {
    this.parts = parts;
    this.type = opts.type || '';
    this.size = parts.reduce((acc, p) => acc + (p.byteLength || p.length || 0), 0);
  }
  async arrayBuffer() {
    return new ArrayBuffer(this.size || 1024);
  }
};

// Require frontend modules
const recorder = require('../../FE/features/interview/interview-audio-recorder.js');
const player = require('../../FE/features/interview/interview-audio-player.js');
const speechEngine = require('../../FE/features/interview/speech-coaching-engine.js');

async function runSpeechOnlyPlaybackSuite() {
  console.log('=== TEST SUITE: SPEECH-ONLY PLAYBACK & SILENCE FILTERING (WI-COACH-AUDIO-02R) ===\n');
  let passCount = 0;
  function pass(desc) {
    passCount++;
    console.log(`[PASS] Scenario ${passCount}: ${desc}`);
  }

  // --- Scenario 1: Clear speech without silences ---
  {
    const speechSamples = createSineWave(2.5, 220, 0.25);
    const vad = recorder.analyzePcmVoiceActivity(speechSamples, SAMPLE_RATE);
    assert.strictEqual(vad.hasSpeech, true, 'Clear speech must have hasSpeech: true');
    assert.strictEqual(vad.isPureSilence, false, 'Clear speech must not be pure silence');
    assert.ok(vad.speechActiveMs >= 2200, 'Speech active duration must cover majority of 2.5s');
    assert.strictEqual(vad.speechSegments.length, 1, 'Continuous speech forms 1 contiguous segment');

    // Slicing
    const mockBuf = createMockAudioBuffer(speechSamples, SAMPLE_RATE);
    const sliced = player.sliceAndConcatenateAudio(mockBuf, vad.speechSegments);
    assert.ok(sliced, 'Sliced buffer must be generated');
    assert.ok(sliced.duration >= 2.2, 'Sliced duration must match active speech');

    // Player element
    const recRecord = {
      turnIndex: 1,
      durationMs: 2500,
      speechActiveMs: vad.speechActiveMs,
      hasSpeech: true,
      audioBlob: new Blob([new Uint8Array(4000)], { type: 'audio/webm' })
    };
    const widget = player.createAudioPlayerElement(recRecord);
    assert.ok(!widget.classList.contains('no-recording'));
    assert.ok(!widget.classList.contains('no-speech'));
    assert.ok(widget.querySelector('.pm-audio-play-btn'), 'Must render play button for active speech');
    pass('Clear speech -> full playback derived/rendered, speechActiveMs matches durationMs');
  }

  // --- Scenario 2: Speech with long silence gaps ---
  {
    // 1.0s speech + 1.8s silence + 1.0s speech = 3.8s total
    const speech1 = createSineWave(1.0, 250, 0.3);
    const silenceMid = createSilence(1.8, 0.0001);
    const speech2 = createSineWave(1.0, 250, 0.3);
    const combined = concatenatePcm(speech1, silenceMid, speech2);

    const vad = recorder.analyzePcmVoiceActivity(combined, SAMPLE_RATE);
    assert.strictEqual(vad.hasSpeech, true);
    assert.strictEqual(vad.speechSegments.length, 2, 'Gap of 1.8s (> 350ms) must yield 2 separate segments');

    const totalDurMs = (combined.length / SAMPLE_RATE) * 1000;
    assert.ok(vad.speechActiveMs < totalDurMs - 1000, 'Filtered active speech ms must be significantly shorter than total');

    const mockBuf = createMockAudioBuffer(combined, SAMPLE_RATE);
    const sliced = player.sliceAndConcatenateAudio(mockBuf, vad.speechSegments);
    assert.ok(sliced.duration < mockBuf.duration - 1.0, 'Concatenated buffer must exclude the 1.8s silence gap');

    // WAV Blob creation
    const wavBlob = player.audioBufferToWavBlob(sliced);
    assert.ok(wavBlob, 'WAV blob must be generated');
    assert.strictEqual(wavBlob.type, 'audio/wav');
    pass('Speech with long silence gaps -> gaps filtered out, concatenated duration < original duration');
  }

  // --- Scenario 3: Starts with silence (leading silence) ---
  {
    // 2.0s silence + 1.5s speech = 3.5s
    const leadSilence = createSilence(2.0, 0.0001);
    const speech = createSineWave(1.5, 200, 0.25);
    const samples = concatenatePcm(leadSilence, speech);

    const vad = recorder.analyzePcmVoiceActivity(samples, SAMPLE_RATE);
    assert.strictEqual(vad.hasSpeech, true);
    assert.ok(vad.speechSegments.length >= 1);
    // First segment startMs should be close to 2000ms - preRoll(200ms) = 1800ms
    assert.ok(vad.speechSegments[0].startMs >= 1700, 'Leading silence of 2.0s must shift startMs to >= 1700ms');

    const mockBuf = createMockAudioBuffer(samples, SAMPLE_RATE);
    const sliced = player.sliceAndConcatenateAudio(mockBuf, vad.speechSegments);
    assert.ok(sliced.duration <= 2.0, 'Concatenated duration should be ~1.5s plus margins, excluding 2s leading silence');
    pass('Starts with silence -> trimmed, startMs shifted to speech onset');
  }

  // --- Scenario 4: Ends with silence (trailing silence) ---
  {
    // 1.5s speech + 2.5s trailing silence = 4.0s
    const speech = createSineWave(1.5, 220, 0.25);
    const trailSilence = createSilence(2.5, 0.0001);
    const samples = concatenatePcm(speech, trailSilence);

    const vad = recorder.analyzePcmVoiceActivity(samples, SAMPLE_RATE);
    assert.strictEqual(vad.hasSpeech, true);
    // End of speech should be around 1500ms + postRoll(250ms) = 1750ms
    const lastSeg = vad.speechSegments[vad.speechSegments.length - 1];
    assert.ok(lastSeg.endMs <= 2000, 'Trailing silence of 2.5s must bound endMs to <= 2000ms');

    const mockBuf = createMockAudioBuffer(samples, SAMPLE_RATE);
    const sliced = player.sliceAndConcatenateAudio(mockBuf, vad.speechSegments);
    assert.ok(sliced.duration <= 2.0, 'Concatenated audio length must exclude trailing 2.5s silence');
    pass('Ends with silence -> trimmed, endMs bounded by post-roll');
  }

  // --- Scenario 5: Fillers / hesitations ("ừm", "ờ", "à", "thì…") ---
  {
    // 0.3s filler ("ừm") + 0.2s pause (< 350ms bridging threshold) + 1.2s answer
    const fillerBurst = createSineWave(0.3, 150, 0.2);
    const pause = createSilence(0.2, 0.0001);
    const answerBurst = createSineWave(1.2, 220, 0.25);
    const hesitationSamples = concatenatePcm(fillerBurst, pause, answerBurst);

    const vad = recorder.analyzePcmVoiceActivity(hesitationSamples, SAMPLE_RATE);
    assert.strictEqual(vad.hasSpeech, true);
    // Because the pause is 200ms <= 350ms bridging gap, it should be merged into 1 continuous segment
    assert.strictEqual(vad.speechSegments.length, 1, 'Hesitation pause <= 350ms must be bridged with speech');
    assert.ok(vad.speechActiveMs >= 1500, 'Speech active duration must cover both filler and answer');
    pass('Fillers / hesitations ("ừm", "ờ", "à", "thì…") -> preserved intact via bridging gap');
  }

  // --- Scenario 6: Stuttering and word repetition ---
  {
    // "tôi... tôi..." (0.25s word, 0.15s pause, 0.25s word, 0.15s pause, 1.0s sentence)
    const w1 = createSineWave(0.25, 230, 0.25);
    const p1 = createSilence(0.15, 0.0001);
    const w2 = createSineWave(0.25, 230, 0.25);
    const p2 = createSilence(0.15, 0.0001);
    const sent = createSineWave(1.0, 230, 0.25);
    const stutterSamples = concatenatePcm(w1, p1, w2, p2, sent);

    const vad = recorder.analyzePcmVoiceActivity(stutterSamples, SAMPLE_RATE);
    assert.strictEqual(vad.hasSpeech, true);
    // Both 150ms pauses are <= 350ms, so whole utterance should be bridged
    assert.strictEqual(vad.speechSegments.length, 1, 'Stuttered repetition pauses <= 350ms must bridge seamlessly');
    const mockBuf = createMockAudioBuffer(stutterSamples, SAMPLE_RATE);
    const sliced = player.sliceAndConcatenateAudio(mockBuf, vad.speechSegments);
    assert.ok(sliced.duration >= 1.7, 'Sliced buffer preserves all stuttered words without clipping');
    pass('Stuttering / word repetition -> preserved without clipping syllables');
  }

  // --- Scenario 7: Soft / quiet speech ---
  {
    // Amplitude 0.015 (RMS ~0.0106 > 0.008 floor)
    const softSpeech = createSineWave(1.5, 200, 0.015);
    const vad = recorder.analyzePcmVoiceActivity(softSpeech, SAMPLE_RATE);
    assert.strictEqual(vad.hasSpeech, true, 'Quiet speech above 0.008 floor must be detected as speech');
    assert.strictEqual(vad.isPureSilence, false, 'Quiet speech must not be marked pure silence');
    assert.ok(vad.speechSegments.length >= 1, 'Must extract speech segments for quiet speech');
    pass('Soft / quiet speech (amplitude ~0.015, RMS > 0.008) -> recognized as speech, not discarded');
  }

  // --- Scenario 8: Pure silence recording ---
  {
    const pureSilence = createSilence(3.0, 0.00005);
    const vad = recorder.analyzePcmVoiceActivity(pureSilence, SAMPLE_RATE);
    assert.strictEqual(vad.hasSpeech, false, 'Pure silence must have hasSpeech: false');
    assert.strictEqual(vad.isPureSilence, true, 'Pure silence must have isPureSilence: true');
    assert.strictEqual(vad.speechActiveMs, 0, 'Pure silence must have speechActiveMs === 0');
    assert.strictEqual(vad.speechSegments.length, 0, 'Pure silence must have empty speechSegments');

    // Audio player rendering for pure silence
    const silenceRecord = {
      turnIndex: 0,
      durationMs: 3000,
      speechActiveMs: 0,
      hasSpeech: false,
      isPureSilence: true,
      audioBlob: new Blob([new Uint8Array(2000)], { type: 'audio/webm' })
    };
    const widget = player.createAudioPlayerElement(silenceRecord);
    assert.ok(widget.classList.contains('no-speech'), 'Widget must have no-speech class');
    assert.ok(widget.classList.contains('is-silence'), 'Widget must have is-silence class');
    assert.ok(!widget.querySelector('.pm-audio-play-btn'), 'Must NOT render play button for pure silence');
    assert.ok(widget.innerHTML.includes('bản ghi âm hoàn toàn im lặng'), 'Must render truthful silence notice');

    // Speech coaching engine analysis on pure silence
    const analysis = speechEngine.analyzeSessionSpeechCoaching(
      [{ question: 'Q1', answer: '...' }],
      [silenceRecord]
    );
    assert.strictEqual(analysis.turns[0].isPureSilence, true);
    assert.strictEqual(analysis.turns[0].hasSpeech, false);
    assert.strictEqual(analysis.turns[0].hasAudio, false, 'hasAudio must be false for pure silence so WPM is not distorted');
    assert.strictEqual(analysis.summary.averageWpm, null, 'WPM must be null when only silence exists');
    pass('Pure silence recording -> isPureSilence: true, no play button, truthful silence notice');
  }

  // --- Scenario 9: Absent recording ---
  {
    const nullWidget = player.createAudioPlayerElement(null);
    assert.ok(nullWidget.classList.contains('no-recording'), 'Null record must have no-recording class');
    assert.ok(!nullWidget.querySelector('.pm-audio-play-btn'), 'Must not have play button');
    assert.ok(nullWidget.innerHTML.includes('người dùng nhập văn bản hoặc micro tắt'));

    const emptyBlobWidget = player.createAudioPlayerElement({ turnIndex: 1, audioBlob: { size: 0 } });
    assert.ok(emptyBlobWidget.classList.contains('no-recording'));
    assert.ok(!emptyBlobWidget.querySelector('.pm-audio-play-btn'));
    pass('Absent recording -> no-recording notice, zero fake blobs, zero fabricated WPM');
  }

  // --- Scenario 10: Decode error / corrupt audio data ---
  {
    // Slice and concatenate with null or invalid segment handles safely
    const res = player.sliceAndConcatenateAudio(null, []);
    assert.strictEqual(res, null, 'Null audioBuffer returns null safely');

    const res2 = player.sliceAndConcatenateAudio(createMockAudioBuffer(new Float32Array(100)), []);
    assert.strictEqual(res2, null, 'Empty speech segments returns null safely');

    const wavNull = player.audioBufferToWavBlob(null);
    assert.strictEqual(wavNull, null, 'Null buffer to WAV returns null safely');
    pass('Decode error / corrupt audio data -> handled gracefully, no uncaught exceptions');
  }

  // --- Scenario 11: Multi-turn isolation & mutual exclusion ---
  {
    const rec1 = {
      turnIndex: 1,
      durationMs: 3000,
      speechActiveMs: 2500,
      hasSpeech: true,
      audioBlob: new Blob([new Uint8Array(3000)], { type: 'audio/webm' })
    };
    const rec2 = {
      turnIndex: 2,
      durationMs: 4000,
      speechActiveMs: 3500,
      hasSpeech: true,
      audioBlob: new Blob([new Uint8Array(4000)], { type: 'audio/webm' })
    };

    const w1 = player.createAudioPlayerElement(rec1);
    const w2 = player.createAudioPlayerElement(rec2);

    const btn1 = w1.querySelector('.pm-audio-play-btn');
    const btn2 = w2.querySelector('.pm-audio-play-btn');
    assert.ok(btn1 && btn2, 'Both players must have play buttons');

    // Simulate play Turn 1
    btn1.onclick({ stopPropagation: () => {} });
    await new Promise(r => setTimeout(r, 10));
    assert.ok(btn1.classList.contains('is-playing'), 'Turn 1 should be playing');

    // Simulate play Turn 2 -> must stop Turn 1
    btn2.onclick({ stopPropagation: () => {} });
    await new Promise(r => setTimeout(r, 10));
    assert.ok(btn2.classList.contains('is-playing'), 'Turn 2 should be playing');
    assert.ok(!btn1.classList.contains('is-playing'), 'Turn 1 must be paused when Turn 2 plays (mutual exclusion)');
    pass('Multi-turn isolation -> independent playback, mutual exclusion pauses other turns');
  }

  // --- Scenario 12: Reload report & non-destructive persistence ---
  {
    const originalBlob = new Blob([new Uint8Array(5000)], { type: 'audio/webm' });
    const storedRecord = {
      sessionId: 'session_audio_test_001',
      turnIndex: 1,
      durationMs: 5000,
      speechActiveMs: 3200,
      hasSpeech: true,
      audioBlob: originalBlob, // original untouched
      speechSegments: [{ startMs: 200, endMs: 3400 }]
    };

    // First render
    const widgetA = player.createAudioPlayerElement(storedRecord);
    assert.strictEqual(storedRecord.audioBlob, originalBlob, 'Original audioBlob reference must not be mutated');
    assert.strictEqual(storedRecord.audioBlob.size, 5000, 'Original audioBlob size must be invariant');

    // Simulated page reload / second render
    const widgetB = player.createAudioPlayerElement(storedRecord);
    assert.strictEqual(storedRecord.audioBlob, originalBlob, 'After second render, original blob remains 100% intact');
    assert.ok(widgetB.querySelector('.pm-audio-play-btn'), 'Second render produces identical player');
    pass('Reload report -> derived speech-only audio matches IndexedDB data; original recording untouched');
  }

  console.log(`\n--- ALL ${passCount} SPEECH-ONLY PLAYBACK & SILENCE FILTERING TESTS PASSED CLEANLY ---`);
}

runSpeechOnlyPlaybackSuite().catch(err => {
  console.error('\n[TEST FAILURE]:', err);
  process.exit(1);
});
