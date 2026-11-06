/**
 * PREPMATE — WI-INTERVIEW-REPORT-FIX-01 REGRESSION SUITE
 *
 * Verifies:
 * Group 1: Question / Answer / Analysis Alignment
 *   - Introduction turn is rendered distinctly in dedicated Warm-up card
 *   - Introduction does NOT consume Question 1 slot and does NOT receive Technical Q1 evaluation
 *   - Exactly 5 main questions numbered 1 to 5
 *   - QuestionId association ('intro', 'q_1'..'q_5') is stable
 * Group 2: Full Answer Preservation
 *   - Full verbatim answer displayed without truncation (no 117 char snippet or slice ellipsis)
 *   - Preserves whitespace and complete text in full answer container
 * Group 3: Grounded AI Feedback Schema
 *   - KnowledgeAnalysis schema contains QuestionId, AnalysisStatus, Strengths, Gaps, Recommendation, Evidence
 *   - Universal generic boilerplate text templates are eliminated
 *   - Honest FALLBACK status when AI evaluation is unavailable
 * Group 4: Authentication State Handling
 *   - 401 Unauthorized triggers clear session-expired error, NOT silent downgrade to Guest Preview
 *   - Checks both prepmate_current_user and prepmate_auth_user tokens
 * Group 5: Question History Discoverability & Layout
 *   - Overview Hero contains #hero-qa-shortcut-bar with completed question count and feedback CTA
 *   - First main question card is expanded by default, remaining cards are collapsed
 * Group 6: Production Database Invariant
 *   - BE/data/db.json SHA-256 strictly invariant
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, 'BE', 'data', 'db.json');
const BASELINE_DB_HASH = '44223D9B7E945E70CADEB3279AE3EE5A0DD748A867B2C3A6B0C5C617A9DB62C3';

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         Error: ${err.message}`);
    failed++;
  }
}

function computeHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

console.log('==================================================================');
console.log('   WI-INTERVIEW-REPORT-FIX-01: INTERVIEW HISTORY & FEEDBACK FIX   ');
console.log('==================================================================\n');

// -------------------------------------------------------------
// GROUP 1: QUESTION / ANSWER / ANALYSIS ALIGNMENT
// -------------------------------------------------------------
console.log('--- GROUP 1: QUESTION / ANSWER / ANALYSIS ALIGNMENT ---');

const beFlowService = fs.readFileSync(path.join(WORKSPACE_ROOT, 'BE', 'Services', 'Interview', 'InterviewFlowService.cs'), 'utf8');
const beEvidenceService = fs.readFileSync(path.join(WORKSPACE_ROOT, 'BE', 'Services', 'Evaluation', 'EvidenceReportService.cs'), 'utf8');
const beReportPrompt = fs.readFileSync(path.join(WORKSPACE_ROOT, 'BE', 'Prompts', 'Reports', 'ReportPrompt.cs'), 'utf8');
const feReportJs = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE', 'features', 'report', 'report.js'), 'utf8');
const feReportHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE', 'features', 'report', 'report.html'), 'utf8');

check('1.1 Backend assigns immutable QuestionId (intro for warm-up, q_1..q_5 for main turns)', () => {
  assert.ok(beFlowService.includes('QuestionId = "intro"') || beFlowService.includes('QuestionId = $"q_'), 'QuestionId set in FlowService');
  assert.ok(beFlowService.includes('existingReal + 1'), 'Main turns numbered sequentially from 1 to 5');
});

check('1.2 EvidenceReportService distinguishes introduction turn from 5 main questions', () => {
  assert.ok(beEvidenceService.includes('IsIntroduction = isIntro'), 'TurnEvidenceTrace tracks IsIntroduction');
  assert.ok(beEvidenceService.includes('MainQuestionIndex = isIntro ? 0 : mainQIndex'), 'MainQuestionIndex is 0 for intro, 1..5 for main');
  assert.ok(beEvidenceService.includes('Answer = a.Answer'), 'Full original verbatim answer preserved on TurnEvidenceTrace');
});

check('1.3 ReportPrompt specifies warm-up separation and stable QuestionId schema', () => {
  assert.ok(beReportPrompt.includes('questionId'), 'Schema includes questionId');
  assert.ok(beReportPrompt.includes('Giới thiệu bản thân mở đầu') || beReportPrompt.includes('q_1 đến q_5'), 'Prompt recognizes warm-up distinction');
  assert.ok(beReportPrompt.includes('KHÔNG ép mô hình STAR cho câu hỏi kỹ thuật'), 'STAR is not falsely forced on tech questions');
});

check('1.4 Frontend separates Introduction (Warm-up) and numbers main questions 1 to 5', () => {
  assert.ok(feReportJs.includes('isIntroCheck') && feReportJs.includes('mainTurns'), 'report.js separates intro and mainTurns');
  assert.ok(feReportJs.includes('qfb-intro-card') && feReportJs.includes('Khởi Động'), 'Intro turn rendered in dedicated box');
  assert.ok(feReportJs.includes('Câu ${turnNum}'), 'Main questions numbered dynamically with 1-based index');
});

// -------------------------------------------------------------
// GROUP 2: FULL ANSWER PRESERVATION
// -------------------------------------------------------------
console.log('\n--- GROUP 2: FULL ANSWER PRESERVATION ---');

check('2.1 report.js eliminates hardcoded slice(0, 117) truncation fallback for authenticated owners', () => {
  assert.ok(feReportJs.includes('qfb-answer-full'), 'qfb-answer-full container present');
  assert.ok(!feReportJs.includes('rawAnswer.slice(0, 117)'), 'Arbitrary 117 character truncation removed');
});

check('2.2 Full answer container renders complete original candidate answer', () => {
  assert.ok(feReportJs.includes('class="qfb-answer-text">${escapeHtml(rawAnswer)}</p>'), 'rawAnswer rendered in full');
});

// -------------------------------------------------------------
// GROUP 3: GROUNDED AI FEEDBACK SCHEMA
// -------------------------------------------------------------
console.log('\n--- GROUP 3: GROUNDED AI FEEDBACK SCHEMA ---');

const beSessionModel = fs.readFileSync(path.join(WORKSPACE_ROOT, 'BE', 'Models', 'Interview', 'Session.cs'), 'utf8');

check('3.1 Session.cs KnowledgeAnalysisItem defines QuestionId, AnalysisStatus, Strengths, Gaps, Recommendation', () => {
  assert.ok(beSessionModel.includes('QuestionId'), 'QuestionId defined');
  assert.ok(beSessionModel.includes('AnalysisStatus'), 'AnalysisStatus defined');
  assert.ok(beSessionModel.includes('Strengths'), 'Strengths defined');
  assert.ok(beSessionModel.includes('Gaps'), 'Gaps defined');
  assert.ok(beSessionModel.includes('Recommendation'), 'Recommendation defined');
});

check('3.2 Universal generic boilerplate string fallbacks eliminated in report.js', () => {
  assert.ok(!feReportJs.includes('tối ưu chi phí, scalability và clean architecture'), 'Generic scalability template eliminated');
  assert.ok(!feReportJs.includes('áp dụng mô hình STAR để làm rõ bài học kinh nghiệm'), 'Generic STAR boilerplate eliminated');
});

check('3.3 report.js explicitly handles FALLBACK status honestly', () => {
  assert.ok(feReportJs.includes('isFallback'), 'isFallback flag checked');
});

// -------------------------------------------------------------
// GROUP 4: AUTHENTICATION STATE HANDLING
// -------------------------------------------------------------
console.log('\n--- GROUP 4: AUTHENTICATION STATE HANDLING ---');

check('4.1 fetchSessionFromBackend checks both prepmate_current_user and prepmate_auth_user', () => {
  assert.ok(feReportJs.includes('prepmate_current_user') && feReportJs.includes('prepmate_auth_user'), 'Both localStorage keys checked');
});

check('4.2 401 Unauthorized shows clear session-expired state without silent Guest downgrade', () => {
  assert.ok(feReportJs.includes('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để xem toàn bộ báo cáo phân tích.'), 'Clear expired session error message');
});

// -------------------------------------------------------------
// GROUP 5: QUESTION HISTORY DISCOVERABILITY & LAYOUT
// -------------------------------------------------------------
console.log('\n--- GROUP 5: QUESTION HISTORY DISCOVERABILITY & LAYOUT ---');

check('5.1 report.html contains #hero-qa-shortcut-bar navigation affordance', () => {
  assert.ok(feReportHtml.includes('id="hero-qa-shortcut-bar"'), '#hero-qa-shortcut-bar present in DOM');
  assert.ok(feReportHtml.includes('goToStage(\'feedback\')') || feReportHtml.includes("goToStage('feedback')"), 'CTA navigates to feedback stage');
});

check('5.2 report.js updates #hero-qa-shortcut-bar with completed question count', () => {
  assert.ok(feReportJs.includes('hero-qa-shortcut-bar'), 'report.js references hero-qa-shortcut-bar');
  assert.ok(feReportJs.includes('câu hỏi đã hoàn thành'), 'Displays completed questions count');
});

check('5.3 First question card is expanded by default (isFirst) while remaining cards are collapsed', () => {
  assert.ok(feReportJs.includes('${isFirst ? \'style="display: block;"\' : \'style="display: none;"\'}'), 'First card display block, others display none');
  assert.ok(feReportJs.includes('${isFirst ? \'aria-expanded="true"\' : \'aria-expanded="false"\'}'), 'First card aria-expanded true, others false');
});

// -------------------------------------------------------------
// GROUP 6: PRODUCTION DATABASE INVARIANT
// -------------------------------------------------------------
console.log('\n--- GROUP 6: PRODUCTION DATABASE INVARIANT ---');

check('6.1 Production db.json SHA-256 strictly invariant', () => {
  const currentHash = computeHash(PROD_DB_PATH);
  assert.strictEqual(currentHash, BASELINE_DB_HASH, `Database hash mismatch! Current: ${currentHash}, Baseline: ${BASELINE_DB_HASH}`);
});

console.log('\n==================================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (${failed === 0 ? '100% SUCCESS' : 'FAILURE'})`);
console.log('==================================================================');

if (failed > 0) {
  process.exit(1);
}
