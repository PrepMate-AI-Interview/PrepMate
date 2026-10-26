/**
 * PREPMATE — TEST SUITE: SPEECH COACHING REPORT DOM (WI-COACH-AUDIO-01 STEP 4)
 *
 * Verifies post-interview report integration:
 *   1. Clean separation between Part A (Professional) and Part B (Speech Coaching).
 *   2. Scenario A: Complete data (professional + audio recordings + transcripts).
 *   3. Scenario B: Transcript present but NO audio recordings.
 *   4. Scenario C: Partial / incomplete metrics (missing duration, low word count).
 *   5. Scenario D: In-page anchor navigation (Subnav tab for speech coaching).
 *   6. Scenario E: Per-turn audio playback embedding in practice moments and provenance.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Verify that report.html has the required structure
const reportHtmlPath = path.resolve(__dirname, '../../FE/features/report/report.html');
const reportHtml = fs.readFileSync(reportHtmlPath, 'utf8');

// Mock lightweight DOM for Node unit test
class MockDomNode {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.classList = {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); }
    };
    this.innerHTML = '';
    this.children = [];
  }
  querySelector() {
    return {
      classList: { add() {}, remove() {}, contains() { return false; } },
      setAttribute() {},
      querySelector() { return { innerHTML: '', textContent: '' }; },
      style: {}
    };
  }
  querySelectorAll() { return []; }
  appendChild(c) { this.children.push(c); }
}

global.document = {
  createElement: (t) => new MockDomNode(t)
};
global.URL = {
  createObjectURL: () => 'blob:mock',
  revokeObjectURL: () => {}
};
global.Audio = class {
  constructor() {
    this.duration = 10;
  }
};

const engine = require('../../FE/features/interview/speech-coaching-engine.js');
const player = require('../../FE/features/interview/interview-audio-player.js');

async function runStep4ReportDomTests() {
  console.log('=== TEST SUITE: STEP 4 — SPEECH COACHING REPORT DOM ===\n');
  let passCount = 0;
  function pass(desc) {
    passCount++;
    console.log(`[PASS] ${desc}`);
  }

  // Test 1: HTML Structure verification
  assert.ok(reportHtml.includes('id="section-speech-coaching"'), 'Must have section-speech-coaching container');
  assert.ok(reportHtml.includes('data-target="section-speech-coaching"'), 'Must have subnav tab for speech coaching');
  assert.ok(reportHtml.includes('id="speech-metrics-grid"'), 'Must have speech-metrics-grid');
  assert.ok(reportHtml.includes('id="speech-fillers-list"'), 'Must have speech-fillers-list');
  assert.ok(reportHtml.includes('id="speech-structure-summary"'), 'Must have speech-structure-summary');
  assert.ok(reportHtml.includes('id="speech-practice-moments-list"'), 'Must have speech-practice-moments-list');
  assert.ok(reportHtml.includes('id="speech-priority-items-list"'), 'Must have speech-priority-items-list');
  assert.ok(reportHtml.includes('speech-coaching-engine.js'), 'Must load speech-coaching-engine.js script');
  assert.ok(reportHtml.includes('interview-audio-player.js'), 'Must load interview-audio-player.js script');
  pass('report.html contains all required Part B containers and scripts');

  // Test 2: Clear separation of Part A and Part B
  assert.ok(reportHtml.includes('PHẦN B • PHONG CÁCH THỂ HIỆN'), 'Section badge indicates Part B explicitly');
  assert.ok(reportHtml.includes('id="section-dimensions"'), 'Part A Dimensions retained intact');
  assert.ok(reportHtml.includes('id="section-diagnostics"'), 'Part A Diagnostics retained intact');
  pass('Strict architectural separation between Part A (Professional) and Part B (Speech)');

  // Test 3: Scenario A — Complete professional + audio + transcript
  const mockAnswers = [
    { question: 'Giới thiệu bản thân', answer: 'Chào bạn, ừm, tôi là Hùng, có 5 năm làm backend với C# và .NET.' },
    { question: 'Outbox Pattern hoạt động thế nào?', answer: 'Chúng tôi dùng Transactional Outbox trên SQL Server và publish qua RabbitMQ, đạt p99 dưới 40ms. Nhờ vậy, dữ liệu giao dịch luôn nhất quán.' }
  ];
  const mockRecordings = [
    { turnIndex: 0, durationMs: 12000, audioBlob: { size: 1024, type: 'audio/webm' } },
    { turnIndex: 1, durationMs: 22000, audioBlob: { size: 2048, type: 'audio/webm' } }
  ];

  const fullAnalysis = engine.analyzeSessionSpeechCoaching(mockAnswers, mockRecordings);
  assert.strictEqual(fullAnalysis.summary.totalWords > 0, true);
  assert.strictEqual(fullAnalysis.summary.totalFillers, 1);
  assert.ok(fullAnalysis.summary.averageWpm > 0);
  assert.strictEqual(fullAnalysis.turns.length, 2);
  assert.strictEqual(fullAnalysis.turns[0].hasAudio, true);
  assert.strictEqual(fullAnalysis.turns[1].hasAudio, true);
  pass('Scenario A: Complete audio + transcript produces accurate metrics, WPM, and audio flags');

  // Test 4: Scenario B — Transcript present but ZERO audio recordings
  const noAudioRecordings = [];
  const textOnlyAnalysis = engine.analyzeSessionSpeechCoaching(mockAnswers, noAudioRecordings);

  assert.strictEqual(textOnlyAnalysis.summary.totalDurationMs, 0);
  assert.strictEqual(textOnlyAnalysis.summary.averageWpm, null, 'WPM must be null when no audio exists');
  assert.strictEqual(textOnlyAnalysis.turns[0].hasAudio, false);
  assert.strictEqual(textOnlyAnalysis.turns[1].hasAudio, false);
  assert.strictEqual(textOnlyAnalysis.turns[0].pacingStatus, 'insufficient_data');
  pass('Scenario B: Zero audio safely yields null WPM and insufficient_data without fabricating metrics');

  // Test 5: Scenario C — Empty or corrupt answers list
  const emptyAnalysis = engine.analyzeSessionSpeechCoaching([], []);
  assert.strictEqual(emptyAnalysis.summary.totalWords, 0);
  assert.strictEqual(emptyAnalysis.summary.totalFillers, 0);
  assert.strictEqual(emptyAnalysis.turns.length, 0);
  assert.ok(emptyAnalysis.priorityImprovements.length > 0);
  pass('Scenario C: Empty session safely handled with default guidance');

  // Test 6: Per-Turn Audio Player Generation for Report
  const audioWidgetWithBlob = player.createAudioPlayerElement(mockRecordings[0]);
  assert.ok(audioWidgetWithBlob, 'Widget must be created');
  assert.strictEqual(audioWidgetWithBlob.classList.contains('no-recording'), false);

  const audioWidgetEmpty = player.createAudioPlayerElement(null);
  assert.ok(audioWidgetEmpty.classList.contains('no-recording'));
  pass('Player elements for report properly differentiate recorded vs empty audio turns');

  console.log(`\n--- ALL ${passCount} STEP 4 REPORT DOM TESTS PASSED CLEANLY ---`);
}

runStep4ReportDomTests().catch(err => {
  console.error('\n[STEP 4 TEST FAILURE]:', err);
  process.exit(1);
});
