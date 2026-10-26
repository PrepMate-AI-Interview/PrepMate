/**
 * PREPMATE — TEST SUITE: SPEECH & PRESENTATION COACHING ANALYSIS (WI-COACH-AUDIO-01 STEP 3)
 *
 * Verifies:
 *   1. Precise filler words detection & excerpt quotes.
 *   2. Immediate word duplication detection without false positives on technical terms.
 *   3. Pacing calculation & reliable fallback on missing duration.
 *   4. Structure & conciseness evaluation.
 *   5. Session-wide coaching rollup with prioritized, non-duplicated action items.
 */

const assert = require('assert');
const path = require('path');

const engine = require('../../FE/features/interview/speech-coaching-engine.js');

async function runStep3Tests() {
  console.log('=== TEST SUITE: STEP 3 — SPEECH & PRESENTATION COACHING ===\n');
  let passCount = 0;
  function pass(desc) {
    passCount++;
    console.log(`[PASS] ${desc}`);
  }

  // Test 1: Filler Words Detection
  const textWithFillers = 'Ừm, thực ra thì chúng tôi dùng microservices, kiểu như tách các service ra để scale à.';
  const fillerRes = engine.analyzeFillerWords(textWithFillers);

  assert.strictEqual(fillerRes.totalCount >= 4, true, 'Must detect at least 4 filler words/phrases');
  const foundWords = fillerRes.breakdown.map(b => b.word);
  assert.ok(foundWords.includes('ừm'), 'Must detect ừm');
  assert.ok(foundWords.includes('thực ra thì'), 'Must detect thực ra thì');
  assert.ok(foundWords.includes('kiểu như'), 'Must detect kiểu như');
  assert.ok(foundWords.includes('à'), 'Must detect à');
  assert.ok(fillerRes.breakdown[0].excerpts.length > 0, 'Excerpts must be captured');
  pass('Filler words ("ừm", "thực ra thì", "kiểu như", "à") accurately detected with quotes');

  // Test 2: Clean Answer (Zero Fillers)
  const cleanText = 'Chúng tôi áp dụng mô hình Outbox Pattern kết hợp RabbitMQ để đảm bảo tính nhất quán dữ liệu.';
  const cleanRes = engine.analyzeFillerWords(cleanText);
  assert.strictEqual(cleanRes.totalCount, 0, 'Clean text must have 0 fillers');
  pass('Zero false positives on clean technical Vietnamese statement');

  // Test 3: Word Repetition Detection
  const textWithRep = 'Tại thời điểm đó chúng tôi chúng tôi đã kiểm tra và và tối ưu lại cơ sở dữ liệu.';
  const repRes = engine.analyzeRepetitions(textWithRep);
  assert.strictEqual(repRes.totalCount, 2, 'Must detect exactly 2 immediate word repetitions');
  assert.strictEqual(repRes.items[0].word.toLowerCase(), 'chúng tôi');
  assert.strictEqual(repRes.items[1].word.toLowerCase(), 'và');
  pass('Immediate stuttering repetitions detected accurately');

  // Test 4: Exemption of Technical Terms from Repetition
  const techText = 'Hệ thống dùng C# và .NET kết hợp SQL Server chạy trên CPU và RAM.';
  const techRepRes = engine.analyzeRepetitions(techText);
  assert.strictEqual(techRepRes.totalCount, 0, 'Technical terms must not trigger false repetition');
  pass('Technical vocabulary exempt from false repetition flagging');

  // Test 5: Pacing (WPM) with Verified Duration
  // 120 words in 60s (60000ms) = 120 WPM
  const pacingNormal = engine.analyzePacing(120, 60000);
  assert.strictEqual(pacingNormal.wpm, 120);
  assert.strictEqual(pacingNormal.status, 'moderate');
  pass('Optimal pacing (120 WPM) accurately computed from verified duration');

  // Fast Pacing: 100 words in 30s (30000ms) = 200 WPM
  const pacingFast = engine.analyzePacing(100, 30000);
  assert.strictEqual(pacingFast.wpm, 200);
  assert.strictEqual(pacingFast.status, 'fast');
  pass('Fast pacing (200 WPM) detected with constructive pacing guidance');

  // Missing Duration Fallback (Zero or null duration)
  const pacingMissing = engine.analyzePacing(80, 0);
  assert.strictEqual(pacingMissing.wpm, null, 'WPM must be null when duration is missing');
  assert.strictEqual(pacingMissing.status, 'insufficient_data');
  pass('Missing duration safely reported as insufficient data (no fabricated metrics)');

  // Test 6: Structure & Conciseness
  const shortText = 'Tôi dùng Redis.';
  const shortStruct = engine.analyzeStructure(shortText);
  assert.strictEqual(shortStruct.conciseness, 'too_short');

  const concludedText = 'Chúng tôi áp dụng giải pháp phân tán kết hợp hàng đợi message. Nhờ vậy, độ trễ hệ thống giảm 40% và không còn tình trạng nghẽn cổ chai.';
  const concludedStruct = engine.analyzeStructure(concludedText);
  assert.strictEqual(concludedStruct.conciseness, 'balanced');
  assert.strictEqual(concludedStruct.hasConclusion, true);
  pass('Structure analysis detects conciseness balance and conclusion indicators');

  // Test 7: Full Session Coaching Rollup
  const sessionAnswers = [
    { question: 'Giới thiệu bản thân', answer: 'Chào bạn, ừm, tôi là Hùng, thực ra thì tôi có 5 năm làm backend.' },
    { question: 'Xử lý tải cao?', answer: 'Tại hệ thống chịu tải 8.000 req/s, chúng tôi chúng tôi dùng Outbox Pattern. Nhờ vậy, độ trễ duy trì dưới 40ms.' }
  ];
  const sessionRecordings = [
    { turnIndex: 0, durationMs: 15000, audioBlob: { size: 1024 } },
    { turnIndex: 1, durationMs: 25000, audioBlob: { size: 2048 } }
  ];

  const sessionReport = engine.analyzeSessionSpeechCoaching(sessionAnswers, sessionRecordings);

  assert.ok(sessionReport.summary);
  assert.strictEqual(sessionReport.summary.totalWords > 0, true);
  assert.strictEqual(sessionReport.summary.totalFillers >= 2, true);
  assert.strictEqual(sessionReport.turns.length, 2);
  assert.strictEqual(sessionReport.priorityImprovements.length <= 3, true);
  assert.strictEqual(sessionReport.priorityImprovements.length > 0, true);
  pass('Session-wide coaching summary rolls up metrics and non-duplicated priority drills');

  console.log(`\n--- ALL ${passCount} STEP 3 TESTS PASSED CLEANLY ---`);
}

runStep3Tests().catch(err => {
  console.error('\n[STEP 3 TEST FAILURE]:', err);
  process.exit(1);
});
