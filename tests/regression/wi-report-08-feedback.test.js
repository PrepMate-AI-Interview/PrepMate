/**
 * PREPMATE — WI-REPORT-08 REGRESSION TEST SUITE
 * Report Navigation & Question Feedback Display Optimization
 * 
 * Verifies:
 * 1. Compact Top Report Navigation (4 destinations, no oversized cards/duplicated descriptions)
 * 2. Initial Compact Question List (collapsed cards show only essential header metadata)
 * 3. Single-Open Accordion Interaction (clicking expands one card, closes others, re-click collapses)
 * 4. Complete Original Answer in Full (zero slice truncation, zero ..., pre-wrap preserved)
 * 5. Elimination of Redundant Archive UI ("Toàn bộ câu trả lời gốc đã lưu trữ" removed from UI)
 * 6. Production db.json SHA-256 Invariant
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

console.log('===============================================================');
console.log('   WI-REPORT-08: REPORT NAVIGATION & QUESTION FEEDBACK        ');
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
// GROUP 1: Compact Top Report Navigation (WI-08A)
// -------------------------------------------------------------
console.log('--- GROUP 1: Compact Top Report Navigation (WI-08A) ---');

check('1.1 Navigation contains exactly 4 primary destinations in strict sequence', () => {
  const stageNavIdx = html.indexOf('class="report-stage-nav"');
  assert.ok(stageNavIdx !== -1, 'Stage nav container exists');

  const navSlice = html.slice(stageNavIdx, html.indexOf('</nav>', stageNavIdx));
  const idx01 = navSlice.indexOf('id="phase-btn-overview"');
  const idx02 = navSlice.indexOf('id="phase-btn-feedback"');
  const idx03 = navSlice.indexOf('id="phase-btn-analysis"');
  const idx04 = navSlice.indexOf('id="phase-btn-recommendations"');

  assert.ok(idx01 !== -1 && idx02 !== -1 && idx03 !== -1 && idx04 !== -1, 'All 4 buttons present');
  assert.ok(idx01 < idx02 && idx02 < idx03 && idx03 < idx04, 'Buttons in strict sequence 01 < 02 < 03 < 04');
});

check('1.2 Top navigation buttons are compact without competing section descriptions', () => {
  assert.ok(css.includes('.stage-tab-desc') && css.includes('display: none !important;'), 'stage-tab-desc is hidden in CSS to keep nav compact');
  assert.ok(css.includes('.stage-tab-btn') && css.includes('height: 38px;'), 'stage-tab-btn defined with compact height');
});

check('1.3 Navigation items support keyboard navigation and visible focus rings', () => {
  assert.ok(css.includes('.stage-tab-btn:focus-visible'), 'focus-visible outline defined for accessibility');
});

// -------------------------------------------------------------
// GROUP 2: Question Feedback Compact Initial List (WI-08B)
// -------------------------------------------------------------
console.log('\n--- GROUP 2: Question Feedback Compact Initial List (WI-08B) ---');

check('2.1 Initial question list cards render with collapsed body (style="display: none;") by default', () => {
  assert.ok(js.includes('class="qfb-summary-body" id="qfb-body-') && js.includes('style="display: none;"'), 'qfb-summary-body initially hidden');
  assert.ok(js.includes('role="button"') && js.includes('aria-expanded="false"'), 'Header has role="button" with initial aria-expanded="false"');
});

check('2.2 Collapsed card header renders all essential metadata (number, concept, question, rating, chevron)', () => {
  assert.ok(js.includes('qfb-turn-badge'), 'Sequence badge rendered');
  assert.ok(js.includes('qfb-concept-tag'), 'Concept / category tag rendered');
  assert.ok(js.includes('qfb-question-title'), 'Question title rendered');
  assert.ok(js.includes('qfb-rating-pill'), 'Evaluation rating pill rendered');
  assert.ok(js.includes('qfb-expand-btn'), 'Expand chevron indicator rendered');
});

// -------------------------------------------------------------
// GROUP 3: Single-Open Accordion Interaction (WI-08B)
// -------------------------------------------------------------
console.log('\n--- GROUP 3: Single-Open Accordion Interaction (WI-08B) ---');

check('3.1 toggleQuestionFeedbackDetail implements single-open accordion behavior', () => {
  assert.ok(js.includes('function toggleQuestionFeedbackDetail('), 'toggleQuestionFeedbackDetail implemented');
  assert.ok(js.includes('allCards.forEach('), 'Closes all other open cards upon selection');
  assert.ok(js.includes('cBody.style.display = "none"'), 'Hides other bodies');
  assert.ok(js.includes('targetCard.classList.add("expanded")') || js.includes('card.classList.add("expanded")'), 'Expands selected card');
});

check('3.2 Re-clicking the currently open card toggles it closed', () => {
  assert.ok(js.includes('!isCurrentlyExpanded'), 'Toggles closed if already expanded');
});

check('3.3 Enter and Space keyboard support implemented on card header', () => {
  assert.ok(js.includes("event.key==='Enter'||event.key===' '"), 'Keyboard activation supported on header');
});

// -------------------------------------------------------------
// GROUP 4: Complete Original Answer in Full (WI-08C)
// -------------------------------------------------------------
console.log('\n--- GROUP 4: Complete Original Answer in Full (WI-08C) ---');

check('4.1 Expanded question displays complete original answer without truncation or slice ellipsis', () => {
  const qfbFuncIdx = js.indexOf('function renderQuestionLevelFeedback');
  const qfbFuncEnd = js.indexOf('function toggleAnswerText', qfbFuncIdx);
  const qfbCode = js.slice(qfbFuncIdx, qfbFuncEnd !== -1 ? qfbFuncEnd : qfbFuncIdx + 4000);

  assert.ok(!qfbCode.includes('rawAnswer.slice(0, 200)'), 'Zero slice(0, 200) answer truncation');
  assert.ok(!qfbCode.includes('"..."') && !qfbCode.includes("'...'"), 'Zero ellipsis truncation added to answer text');
  assert.ok(qfbCode.includes('qfb-answer-text'), 'qfb-answer-text used for verbatim answer');
});

check('4.2 CSS preserves verbatim whitespace and prevents line-clamp on answer text', () => {
  assert.ok(css.includes('.qfb-answer-text') && css.includes('white-space: pre-wrap;'), 'white-space: pre-wrap preserved');
  assert.ok(!css.includes('-webkit-line-clamp: 3') && !css.includes('-webkit-line-clamp: 4'), 'No line-clamp applied to answer');
});

check('4.3 Four structured parts present inside expanded view (A. Câu hỏi, B. Câu trả lời, C. Nhận xét, D. Hướng cải thiện)', () => {
  assert.ok(js.includes('qfb-question-title'), 'Part A: Câu hỏi title rendered');
  assert.ok(js.includes('Câu trả lời của bạn:'), 'Part B: Câu trả lời của bạn label rendered');
  assert.ok(js.includes('Nhận xét chuyên môn:'), 'Part C: Nhận xét chuyên môn label rendered');
  assert.ok(js.includes('Điểm tốt & Minh chứng ghi nhận'), 'Part C: Điểm tốt sub-column rendered');
  assert.ok(js.includes('Điểm còn thiếu & Cần làm rõ'), 'Part C: Điểm còn thiếu sub-column rendered');
  assert.ok(js.includes('Hướng cải thiện cụ thể:'), 'Part D: Hướng cải thiện cụ thể label rendered');
});

// -------------------------------------------------------------
// GROUP 5: Redundant Archive UI Removal (WI-08D)
// -------------------------------------------------------------
console.log('\n--- GROUP 5: Redundant Archive UI Removal (WI-08D) ---');

check('5.1 "Toàn bộ câu trả lời gốc đã lưu trữ" section is completely eliminated from question cards', () => {
  assert.ok(!js.includes('Toàn bộ câu trả lời gốc đã lưu trữ:'), 'Redundant archive header removed from report.js');
  assert.ok(!html.includes('Toàn bộ câu trả lời gốc đã lưu trữ'), 'Redundant archive header absent from report.html');
});

// -------------------------------------------------------------
// GROUP 6: Production Database Invariant
// -------------------------------------------------------------
console.log('\n--- GROUP 6: Production Database Invariant ---');

check('6.1 Production db.json SHA-256 strictly invariant', () => {
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
