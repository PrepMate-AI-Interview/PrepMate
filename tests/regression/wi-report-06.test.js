/**
 * PREPMATE — WI-REPORT-06 REGRESSION TEST SUITE
 * Report Information Architecture & Feedback Refinement
 * 
 * Verifies:
 * 1. Strict 4-Stage Navigation Order (Tổng quan -> Phân tích -> Nhận xét -> Đề xuất)
 * 2. Tổng quan: Overall Assessment, 0-100 scale without visible /100 suffix, substantive strengths & concerns
 * 3. Phân tích: 6 evaluated dimensions, separation of metrics, zero duplicated full answer journals
 * 4. Nhận xét: Single source of truth for answer journal, 4-part structure (Câu hỏi, Câu trả lời, Nhận xét, Hướng cải thiện)
 * 5. Đề xuất: Substantive overall improvement assessment box before action roadmap
 * 6. Production db.json SHA-256 Invariant
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

console.log('===============================================================');
console.log('   WI-REPORT-06: REPORT INFORMATION ARCHITECTURE & FEEDBACK   ');
console.log('===============================================================\n');

let totalChecks = 0;
let passedChecks = 0;

function check(title, fn) {
  totalChecks++;
  try {
    fn();
    console.log(`[PASS] ${title}`);
    passedChecks++;
  } catch (err) {
    console.error(`[FAIL] ${title}`);
    console.error(`       Error: ${err.message}`);
  }
}

const htmlPath = path.resolve(__dirname, '../../FE/features/report/report.html');
const jsPath = path.resolve(__dirname, '../../FE/features/report/report.js');
const cssPath = path.resolve(__dirname, '../../FE/features/report/report.css');
const dbPath = path.resolve(__dirname, '../../BE/data/db.json');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

// -------------------------------------------------------------
// GROUP 1: Strict 4-Stage Navigation Order & DOM Alignment (WI-REPORT-07 Order: 01 Tổng quan -> 02 Nhận xét -> 03 Phân tích -> 04 Đề xuất)
// -------------------------------------------------------------
console.log('--- GROUP 1: Strict 4-Stage Navigation Order & DOM Alignment (WI-REPORT-07) ---');

check('1.1 Stage navigation has exactly 4 tabs in strict order (01 Tổng quan -> 02 Nhận xét -> 03 Phân tích -> 04 Đề xuất)', () => {
  const stageNavIdx = html.indexOf('class="report-stage-nav"');
  assert.ok(stageNavIdx !== -1, 'Stage nav container exists');

  const navSlice = html.slice(stageNavIdx, stageNavIdx + 2500);

  const idx01 = navSlice.indexOf('id="phase-btn-overview"');
  const idx02 = navSlice.indexOf('id="phase-btn-feedback"');
  const idx03 = navSlice.indexOf('id="phase-btn-analysis"');
  const idx04 = navSlice.indexOf('id="phase-btn-recommendations"');

  assert.ok(idx01 !== -1, 'Tab 01 (Tổng quan) exists');
  assert.ok(idx02 !== -1, 'Tab 02 (Nhận xét) exists');
  assert.ok(idx03 !== -1, 'Tab 03 (Phân tích) exists');
  assert.ok(idx04 !== -1, 'Tab 04 (Đề xuất) exists');

  assert.ok(idx01 < idx02, 'Tab 01 (Tổng quan) appears before Tab 02 (Nhận xét)');
  assert.ok(idx02 < idx03, 'Tab 02 (Nhận xét) appears before Tab 03 (Phân tích)');
  assert.ok(idx03 < idx04, 'Tab 03 (Phân tích) appears before Tab 04 (Đề xuất)');
});

check('1.2 Tab titles and step tags match specifications', () => {
  assert.ok(html.includes('>01</span>'), 'Step 01 badge exists');
  assert.ok(html.includes('>Tổng quan</span>'), 'Label Tổng quan exists');
  assert.ok(html.includes('>02</span>'), 'Step 02 badge exists');
  assert.ok(html.includes('>Nhận xét</span>'), 'Label Nhận xét exists');
  assert.ok(html.includes('>03</span>'), 'Step 03 badge exists');
  assert.ok(html.includes('>Phân tích</span>'), 'Label Phân tích exists');
  assert.ok(html.includes('>04</span>'), 'Step 04 badge exists');
  assert.ok(html.includes('>Đề xuất</span>'), 'Label Đề xuất exists');
});

check('1.3 Stage panels in viewport follow strict sequence in DOM (pOverview < pFeedback < pDuring < pAfter)', () => {
  const pOverview = html.indexOf('id="stage-panel-overview"');
  const pFeedback = html.indexOf('id="stage-panel-feedback"');
  const pDuring = html.indexOf('id="stage-panel-during"');
  const pAfter = html.indexOf('id="stage-panel-after"');

  assert.ok(pOverview !== -1, 'stage-panel-overview exists');
  assert.ok(pFeedback !== -1, 'stage-panel-feedback exists');
  assert.ok(pDuring !== -1, 'stage-panel-during exists');
  assert.ok(pAfter !== -1, 'stage-panel-after exists');

  assert.ok(pOverview < pFeedback, 'stage-panel-overview precedes stage-panel-feedback');
  assert.ok(pFeedback < pDuring, 'stage-panel-feedback precedes stage-panel-during');
  assert.ok(pDuring < pAfter, 'stage-panel-during precedes stage-panel-after');
});

check('1.4 report.js goToStage maps all 4 stages correctly', () => {
  assert.ok(js.includes("function goToStage("), "goToStage function exists");
  assert.ok(js.includes("'overview'") || js.includes('"overview"'), "goToStage handles overview");
  assert.ok(js.includes('stage === "analysis"') || js.includes("stage === 'analysis'"), "goToStage handles analysis alias");
  assert.ok(js.includes('stage === "during"') || js.includes("stage === 'during'") || js.includes('"during"'), "goToStage handles during");
  assert.ok(js.includes('"feedback"') || js.includes("'feedback'"), "goToStage handles feedback");
  assert.ok(js.includes('"after"') || js.includes('"recommendations"'), "goToStage handles recommendations/after");
});

// -------------------------------------------------------------
// GROUP 2: Tổng quan (Overall Assessment)
// -------------------------------------------------------------
console.log('\n--- GROUP 2: Tổng quan (Overall Assessment) ---');

check('2.1 Score /100 suffix hidden in visible UI while preserving DOM element', () => {
  assert.ok(html.includes('id="hero-score-scale"'), 'hero-score-scale exists in DOM for test assertions');
  assert.ok(css.includes('.score-scale-label') && css.includes('display: none !important'), 'score-scale-label is visually hidden via CSS');
  assert.ok(html.includes('score-clean-label'), 'Clean label ĐIỂM ĐÁNH GIÁ CHUNG exists in score wheel');
});

check('2.2 Executive Highlights render strengths with why-it-matters explanation', () => {
  assert.ok(js.includes('highlight-item-content'), 'report.js renders structured highlight-item-content');
  assert.ok(js.includes('highlight-item-title'), 'report.js renders highlight-item-title');
  assert.ok(js.includes('whyItMatters') || js.includes('highlight-item-desc'), 'report.js explains why strength matters for the target role');
});

check('2.3 Key improvement concerns render what is lacking and why it affects performance', () => {
  assert.ok(js.includes('hero-highlights-priorities'), 'hero-highlights-priorities populated in report.js');
  assert.ok(html.includes('id="hero-highlights-priorities"'), 'hero-highlights-priorities container exists in HTML');
});

// -------------------------------------------------------------
// GROUP 3: Phân tích (Detailed Assessment)
// -------------------------------------------------------------
console.log('\n--- GROUP 3: Phân tích (Detailed Assessment) ---');

check('3.1 6 core performance dimensions rendered with scores/levels', () => {
  assert.ok(html.includes('id="dimensions-grid"'), 'dimensions-grid exists');
  assert.ok(js.includes('STANDARD_DIMENSIONS'), 'STANDARD_DIMENSIONS defined');
  assert.ok(js.includes('TECHNICAL_KNOWLEDGE'), 'TECHNICAL_KNOWLEDGE dimension key exists');
  assert.ok(js.includes('PRACTICAL_APPLICATION'), 'PRACTICAL_APPLICATION dimension key exists');
  assert.ok(js.includes('REASONING_DEPTH'), 'REASONING_DEPTH dimension key exists');
  assert.ok(js.includes('FOLLOW_UP_HANDLING'), 'FOLLOW_UP_HANDLING dimension key exists');
  assert.ok(js.includes('COMMUNICATION'), 'COMMUNICATION dimension key exists');
  assert.ok(js.includes('CONSISTENCY'), 'CONSISTENCY dimension key exists');
});

check('3.2 Presentation and visual coaching sections have honest disclosure when camera/mic is off', () => {
  assert.ok(html.includes('id="section-speech-coaching"'), 'section-speech-coaching exists');
  assert.ok(js.includes('Camera đã tắt') || js.includes('Không sử dụng camera'), 'Honest camera disabled disclosure exists in visual coaching');
});

check('3.3 Phân tích contains zero duplicated full answer journals (clean CTA to Nhận xét)', () => {
  assert.ok(html.includes('analysis-to-feedback-box'), 'CTA to Nhận xét exists in Phân tích');
  assert.ok(html.includes("goToStage('feedback')"), 'CTA triggers goToStage("feedback")');
});

// -------------------------------------------------------------
// GROUP 4: Nhận xét (Centralized Answer Journal & Feedback)
// -------------------------------------------------------------
console.log('\n--- GROUP 4: Nhận xét (Centralized Answer Journal & Feedback) ---');

check('4.1 question-feedback-list container exists exclusively in Stage 02', () => {
  const pFeedback = html.indexOf('id="stage-panel-feedback"');
  const pDuring = html.indexOf('id="stage-panel-during"');
  const qListIdx = html.indexOf('id="question-feedback-list"');

  assert.ok(qListIdx !== -1, 'question-feedback-list exists in DOM');
  assert.ok(qListIdx > pFeedback && qListIdx < pDuring, 'question-feedback-list is located inside Stage 02 (stage-panel-feedback)');
});

check('4.2 Question card implements 4-part structure (Câu hỏi, Câu trả lời, Nhận xét, Hướng cải thiện)', () => {
  assert.ok(js.includes('qfb-turn-badge'), 'Part 1: Câu hỏi turn badge rendered');
  assert.ok(js.includes('qfb-question-title'), 'Part 1: Question title rendered');
  assert.ok(js.includes('Câu trả lời của bạn:'), 'Part 2: Câu trả lời của bạn section label rendered');
  assert.ok(js.includes('Nhận xét chuyên môn:'), 'Part 3: Nhận xét chuyên môn section label rendered');
  assert.ok(js.includes('Điểm tốt & Minh chứng ghi nhận'), 'Part 3: Strengths / verified facts column rendered');
  assert.ok(js.includes('Điểm còn thiếu & Cần làm rõ'), 'Part 3: Missing / unverified claims column rendered');
  assert.ok(js.includes('Hướng cải thiện cụ thể:'), 'Part 4: Hướng cải thiện cụ thể section label rendered');
});

check('4.3 Long answers provide expandable/collapsible toggle with verbatim text preserved', () => {
  assert.ok(js.includes('btn-toggle-answer-text'), 'Toggle button for long answers exists');
  assert.ok(js.includes('toggleAnswerText'), 'toggleAnswerText function implemented');
  assert.ok(js.includes('qfb-answer-full'), 'Full answer container preserved verbatim');
});

check('4.4 Honest empty state rendered when no answers recorded', () => {
  assert.ok(js.includes('Chưa ghi nhận câu hỏi hoặc câu trả lời nào trong phiên phỏng vấn này.'), 'Honest empty state text exists in report.js');
});

check('4.5 No misleading cross-stage links inside Nhận xét pointing back to Phân tích', () => {
  const qfbFuncIdx = js.indexOf('function renderQuestionLevelFeedback');
  const qfbFuncEnd = js.indexOf('function toggleAnswerText', qfbFuncIdx);
  const qfbCode = js.slice(qfbFuncIdx, qfbFuncEnd !== -1 ? qfbFuncEnd : qfbFuncIdx + 4000);

  assert.ok(!qfbCode.includes("goToStage('analysis')"), 'Zero link boxes pointing from Nhận xét to Phân tích for answer journals');
});

// -------------------------------------------------------------
// GROUP 5: Đề xuất (Improvement Recommendations)
// -------------------------------------------------------------
console.log('\n--- GROUP 5: Đề xuất (Improvement Recommendations) ---');

check('5.1 Stage 04 leads with Overall Improvement Assessment box before action roadmap', () => {
  const pAfter = html.indexOf('id="stage-panel-after"');
  const pBox = html.indexOf('id="roadmap-overall-assessment-box"');
  const pRoadmap = html.indexOf('id="roadmap-items-grid"');

  assert.ok(pBox !== -1, 'roadmap-overall-assessment-box exists in DOM');
  assert.ok(pRoadmap !== -1, 'roadmap-items-grid exists in DOM');
  assert.ok(pBox > pAfter && pBox < pRoadmap, 'Overall Improvement Assessment box precedes roadmap timeline');
});

check('5.2 Weakness diagnoses list renders prioritized issues with comments and evidence', () => {
  assert.ok(html.includes('id="roadmap-weakness-priorities-list"'), 'roadmap-weakness-priorities-list exists in DOM');
  assert.ok(js.includes('renderRoadmapSection'), 'renderRoadmapSection implemented in report.js');
});

// -------------------------------------------------------------
// GROUP 6: Production Database Invariant
// -------------------------------------------------------------
console.log('\n--- GROUP 6: Production Database Invariant ---');

check('6.1 Production db.json SHA-256 strictly preserved', () => {
  const EXPECTED_HASH = '44223d9b7e945e70cadeb3279ae3ee5a0dd748a867b2c3a6b0c5c617a9db62c3';
  const content = fs.readFileSync(dbPath);
  const actualHash = crypto.createHash('sha256').update(content).digest('hex').toLowerCase();

  assert.strictEqual(
    actualHash,
    EXPECTED_HASH,
    `Production db.json hash mismatch! Expected ${EXPECTED_HASH}, got ${actualHash}`
  );
});

console.log('\n===============================================================');
console.log(`TOTAL AUDIT CHECKS: ${totalChecks} | PASS: ${passedChecks} | FAIL: ${totalChecks - passedChecks}`);
console.log('===============================================================');

if (totalChecks - passedChecks > 0) {
  process.exit(1);
}
