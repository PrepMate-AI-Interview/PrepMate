/**
 * PREPMATE — TEST SUITE: SPEECH REPETITION & IDEA OVERLAP HEURISTICS (WI-COACH-AUDIO-02 BƯỚC B)
 *
 * Verifies tiered repetition detection:
 *   1. Immediate consecutive repetitions (words and 2-word phrases).
 *   2. Non-consecutive multi-word phrase repetitions across answer.
 *   3. Sentence idea overlap heuristic (high keyword overlap).
 *   4. Semantic repetition with different phrasing (documents heuristic boundary).
 *   5. Technical terms in different contexts (zero false positives).
 *   6. Normal non-repetitive answers.
 *   7. STT glitch resilience.
 */

const assert = require('assert');
const path = require('path');

const engine = require(path.resolve(__dirname, '../../FE/features/interview/speech-coaching-engine.js'));

function pass(name) {
  console.log(`  [PASS] ${name}`);
}

function runRepetitionHeuristicTests() {
  console.log('--- RUNNING TEST B: REPETITION TIERS & IDEA OVERLAP HEURISTICS ---');

  // Case 1: Lặp từ liên tiếp (Immediate consecutive repetitions)
  const text1 = 'Khi xử lý giao dịch, chúng tôi chúng tôi áp dụng Transactional Outbox Pattern và và đã bảo vệ dữ liệu toàn vẹn.';
  const rep1 = engine.analyzeRepetitions(text1);
  assert.strictEqual(rep1.immediateCount, 2, 'Must detect 2 immediate repetitions');
  assert.strictEqual(rep1.items[0].word.toLowerCase(), 'chúng tôi');
  assert.strictEqual(rep1.items[1].word.toLowerCase(), 'và');
  assert.strictEqual(rep1.phraseCount, 0, 'No non-consecutive phrase repetitions in text 1');
  assert.strictEqual(rep1.ideaOverlapCount, 0, 'No idea overlaps across sentences in text 1');
  pass('Case 1: Immediate consecutive repetitions detected accurately');

  // Case 2: Lặp cụm từ không liên tiếp (Multi-word phrase repeated across answer)
  const text2 = 'Đầu tiên chúng tôi tối ưu chỉ mục cơ sở dữ liệu trên bảng đơn hàng. Sau khi kiểm tra hiệu năng, giải pháp tối ưu chỉ mục cơ sở dữ liệu đã mang lại kết quả rõ rệt.';
  const rep2 = engine.analyzeRepetitions(text2);
  const phrases2 = engine.findLongestRepeatedPhrases(text2);
  assert.ok(phrases2.length >= 1, 'Must detect repeated phrase');
  assert.strictEqual(phrases2[0].phrase, 'tối ưu chỉ mục cơ sở dữ liệu');
  assert.strictEqual(phrases2[0].count, 2);
  assert.strictEqual(rep2.phraseCount, 1, 'Repetition analysis must include phraseCount');
  pass('Case 2: Longest non-consecutive repeated phrase detected and merged');

  // Case 3: Lặp ý bằng từ ngữ gần giống (Lexical content keyword overlap heuristic)
  const text3 = 'Hệ thống bị nghẽn do quá tải I/O ghi đĩa phân vùng cơ sở dữ liệu. Lưu lượng ghi đĩa quá tải làm cho hệ thống bị nghẽn I/O cơ sở dữ liệu.';
  const rep3 = engine.analyzeRepetitions(text3);
  const overlaps3 = engine.analyzeIdeaOverlaps(text3);
  assert.strictEqual(overlaps3.length, 1, 'Must detect 1 sentence idea overlap');
  assert.ok(overlaps3[0].overlapRatio >= 0.70, `Overlap ratio must be >= 0.70, got ${overlaps3[0].overlapRatio}`);
  assert.strictEqual(overlaps3[0].method, 'lexical_content_overlap_heuristic');
  assert.ok(overlaps3[0].explanation.includes('luận điểm'), 'Explanation must note shared core keywords');
  assert.strictEqual(rep3.ideaOverlapCount, 1);
  pass('Case 3: High keyword overlap across distinct sentences flagged with heuristic disclaimer');

  // Case 4: Lặp ý bằng cách diễn đạt khác (Documents semantic AI boundary)
  // S1 and S2 mean the same thing conceptually, but share almost zero identical words:
  const text4 = 'Hệ thống bị nghẽn do quá tải I/O ghi đĩa phân vùng. Phân vùng lưu trữ vật lý không đáp ứng kịp thông lượng truy xuất dữ liệu.';
  const overlaps4 = engine.analyzeIdeaOverlaps(text4);
  // Heuristic correctly does NOT falsely guess semantic similarity without shared content keywords
  assert.strictEqual(overlaps4.length, 0, 'Heuristic must not guess semantic meaning on distinct vocabulary without AI embedding');
  pass('Case 4: Heuristic boundary verified (semantic paraphrase requires Backend AI pipeline)');

  // Case 5: Nhắc lại cùng thuật ngữ kỹ thuật ở các khía cạnh khác nhau (Zero false positive)
  const text5 = 'Chúng tôi áp dụng Kafka để stream dữ liệu sự kiện giữa các microservices. Kafka cluster được cấu hình ba replica để đảm bảo tính sẵn sàng cao khi một node gặp sự cố.';
  const rep5 = engine.analyzeRepetitions(text5);
  const overlaps5 = engine.analyzeIdeaOverlaps(text5);
  assert.strictEqual(rep5.immediateCount, 0, 'No immediate repetition on Kafka');
  assert.strictEqual(overlaps5.length, 0, 'Different technical aspects of Kafka must not trigger idea overlap false positive');
  pass('Case 5: Technical term repeated in different contexts has zero false positives');

  // Case 6: Câu trả lời bình thường không lặp
  const text6 = 'Tôi đã xây dựng pipeline CI/CD trên GitHub Actions để tự động hoá việc build và deploy container lên AWS ECS. Nhờ vậy thời gian phát hành tính năng giảm từ hai ngày xuống ba mươi phút.';
  const rep6 = engine.analyzeRepetitions(text6);
  assert.strictEqual(rep6.totalCount, 0, 'Normal clean answer must have 0 repetitions');
  assert.strictEqual(rep6.immediateCount, 0);
  assert.strictEqual(rep6.phraseCount, 0);
  assert.strictEqual(rep6.ideaOverlapCount, 0);
  pass('Case 6: Clean professional response has 0 repetitions');

  // Case 7: STT glitch resilience (duplicated interim token)
  const text7 = 'Tôi tôi đã kiểm tra log của hệ thống và xử lý xong.';
  const rep7 = engine.analyzeRepetitions(text7);
  assert.strictEqual(rep7.immediateCount, 1, 'STT immediate stutter caught without throwing');
  assert.strictEqual(rep7.items[0].word.toLowerCase(), 'tôi');
  pass('Case 7: STT glitch repetition safely parsed');

  console.log('\n[TEST B PASS] All 7 repetition and idea overlap test cases passed.\n');
}

if (require.main === module) {
  runRepetitionHeuristicTests();
}

module.exports = { runRepetitionHeuristicTests };
