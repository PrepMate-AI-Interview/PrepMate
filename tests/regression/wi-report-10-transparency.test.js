/**
 * PREPMATE — WI-REPORT-10: UNIFIED EVALUATION TRANSPARENCY & METHODOLOGY DISCLOSURE AUDIT
 *
 * Verifies:
 * 1. Single Centralized Placement (No duplicated transparency blocks across stages)
 * 2. Proper Titles & Subtitles matching canonical specification
 * 3. Default Collapsed State (Progressive disclosure, aria-expanded="false")
 * 4. Five Grounded Topics (A. Dữ liệu, B. Cách điểm số, C. Minh chứng, D. Chưa đủ dữ liệu, E. Giới hạn AI)
 * 5. Stage 1 Subtle Entry Link ("Cách PrepMate đánh giá kết quả này" with smooth disclosure opener)
 * 6. Responsive & Dark Mode Stylesheet tokens
 * 7. Backward Compatibility Hooks (report-limitations-list, renderLimitationsFooter)
 * 8. Production Database SHA-256 Invariant
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const htmlPath = path.join(ROOT, 'FE/features/report/report.html');
const jsPath = path.join(ROOT, 'FE/features/report/report.js');
const cssPath = path.join(ROOT, 'FE/features/report/report.css');
const dbPath = path.join(ROOT, 'BE/data/db.json');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

console.log('===============================================================');
console.log('   WI-REPORT-10: UNIFIED EVALUATION TRANSPARENCY DISCLOSURE    ');
console.log('===============================================================\n');

let passCount = 0;
let failCount = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`[PASS] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${desc}\n       Error: ${err.message}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// GROUP 1: Single Centralized Placement & Structure
// -------------------------------------------------------------
console.log('--- GROUP 1: Single Centralized Placement & Structure ---');

check('1.1 Disclosure exists as a centralized section outside stages-viewport before main closes', () => {
  const vpEnd = html.indexOf('</div> <!-- /stages-viewport -->');
  const sectionIdx = html.indexOf('id="report-commitments-section"');
  const mainEnd = html.indexOf('</main>');

  assert.ok(vpEnd !== -1, 'stages-viewport closing tag must exist');
  assert.ok(sectionIdx !== -1, 'report-commitments-section must exist');
  assert.ok(mainEnd !== -1, '</main> must exist');
  assert.ok(sectionIdx > vpEnd && sectionIdx < mainEnd, 'Disclosure must be placed after stages-viewport and before </main>');
});

check('1.2 Section has exact required title and explanatory subtitle', () => {
  assert.ok(html.includes('Nguyên tắc đánh giá & minh bạch'), 'Title must match exact specification');
  assert.ok(
    html.includes('Tìm hiểu dữ liệu, cách diễn giải kết quả và giới hạn của đánh giá AI.'),
    'Subtitle must match exact specification'
  );
});

check('1.3 Exactly one transparency disclosure section across the entire report', () => {
  const matches = html.match(/id="report-commitments-section"/g);
  assert.strictEqual(matches ? matches.length : 0, 1, 'Only 1 transparency section should exist');
});

// -------------------------------------------------------------
// GROUP 2: Default Collapsed State & Accessible Controller
// -------------------------------------------------------------
console.log('\n--- GROUP 2: Default Collapsed State & Accessible Controller ---');

check('2.1 Body container is collapsed by default using .hidden class', () => {
  assert.ok(
    html.includes('id="report-transparency-body" class="transparency-body hidden"'),
    'report-transparency-body must be hidden by default'
  );
});

check('2.2 Toggle header button has accessible aria-expanded="false" by default', () => {
  assert.ok(html.includes('id="transparency-toggle-btn" aria-expanded="false"'), 'Toggle button must have aria-expanded="false"');
  assert.ok(html.includes('aria-controls="report-transparency-body"'), 'Toggle button must point to body container');
});

check('2.3 toggleTransparencyDisclosure controller is implemented in report.js and exported to window', () => {
  assert.ok(js.includes('function toggleTransparencyDisclosure('), 'toggleTransparencyDisclosure function defined');
  assert.ok(js.includes('window.toggleTransparencyDisclosure = toggleTransparencyDisclosure'), 'Exported to window');
});

// -------------------------------------------------------------
// GROUP 3: Five Grounded Methodology Topics
// -------------------------------------------------------------
console.log('\n--- GROUP 3: Five Grounded Methodology Topics ---');

check('3.1 Topic A: Dữ liệu được sử dụng covers answers, questions, role, CV/JD, audio/video telemetry', () => {
  assert.ok(html.includes('data-topic="data-sources"'), 'data-sources topic card present');
  assert.ok(html.includes('A. Dữ liệu được sử dụng'), 'Topic A title present');
  assert.ok(html.includes('Câu trả lời đối thoại'), 'Candidate dialogue answers covered');
  assert.ok(html.includes('Ngữ cảnh phỏng vấn'), 'Interview context covered');
  assert.ok(html.includes('Chỉ số âm thanh & hình ảnh'), 'Audio/video local telemetry covered');
});

check('3.2 Topic B: Cách điểm số được hình thành covers 0-100 normalization, rubrics, and deterministic engine', () => {
  assert.ok(html.includes('data-topic="scoring-method"'), 'scoring-method topic card present');
  assert.ok(html.includes('B. Cách điểm số được hình thành'), 'Topic B title present');
  assert.ok(html.includes('Chuẩn hóa 0–100 điểm'), '0-100 scale normalization covered');
  assert.ok(html.includes('Khung Rubric năng lực'), 'Role rubrics covered');
  assert.ok(html.includes('Động cơ xác định (Deterministic Engine)'), 'Deterministic engine covered');
});

check('3.3 Topic C: Minh chứng và nhận xét separates candidate responses, facts, claims, and STAR comments', () => {
  assert.ok(html.includes('data-topic="evidence-observations"'), 'evidence-observations topic card present');
  assert.ok(html.includes('C. Minh chứng và nhận xét'), 'Topic C title present');
  assert.ok(html.includes('Bóc tách cấu trúc'), 'Structure separation covered');
  assert.ok(html.includes('Nhận xét định tính'), 'STAR qualitative feedback covered');
  assert.ok(html.includes('Định hướng hành động'), 'Action-oriented recommendations covered');
});

check('3.4 Topic D: Dữ liệu chưa đủ để đánh giá distinguishes unassessed vs low performance without zero penalty', () => {
  assert.ok(html.includes('data-topic="unassessed-handling"'), 'unassessed-handling topic card present');
  assert.ok(html.includes('D. Dữ liệu chưa đủ để đánh giá'), 'Topic D title present');
  assert.ok(html.includes('Phân định rõ trạng thái'), 'Status distinction covered');
  assert.ok(html.includes('Nguyên tắc công bằng'), 'Fairness principle covered');
  assert.ok(html.includes('UNASSESSED'), 'UNASSESSED code notation covered');
});

check('3.5 Topic E: Giới hạn của AI frames evaluation as preparation aid and highlights input dependence', () => {
  assert.ok(html.includes('data-topic="ai-limitations"'), 'ai-limitations topic card present');
  assert.ok(html.includes('E. Giới hạn của AI'), 'Topic E title present');
  assert.ok(html.includes('Mục đích luyện tập'), 'Preparation purpose clarified');
  assert.ok(html.includes('Phụ thuộc dữ liệu đầu vào'), 'Input data dependence stated');
  assert.ok(html.includes('Bảo vệ quyền riêng tư'), 'Privacy protection assured');
});

// -------------------------------------------------------------
// GROUP 4: Stage 1 Subtle Entry Link & Smooth Opener
// -------------------------------------------------------------
console.log('\n--- GROUP 4: Stage 1 Subtle Entry Link & Smooth Opener ---');

check('4.1 Subtle text link present in Stage 1 near overall assessment scores', () => {
  assert.ok(html.includes('id="hero-transparency-link"'), 'hero-transparency-link element exists');
  assert.ok(html.includes('Cách PrepMate đánh giá kết quả này'), 'Link text matches specification');
  assert.ok(html.includes('onclick="openTransparencyDisclosure(event)"'), 'Link triggers openTransparencyDisclosure');
});

check('4.2 openTransparencyDisclosure expands disclosure and scrolls cleanly with offset buffer', () => {
  assert.ok(js.includes('function openTransparencyDisclosure('), 'openTransparencyDisclosure function defined');
  assert.ok(js.includes('toggleTransparencyDisclosure(true)'), 'Forces disclosure to expand');
  assert.ok(js.includes('scrollIntoView') || js.includes('window.scrollTo'), 'Performs smooth scroll');
  assert.ok(js.includes('window.openTransparencyDisclosure = openTransparencyDisclosure'), 'Exported to window');
});

// -------------------------------------------------------------
// GROUP 5: Styling & Dark Mode Compliance
// -------------------------------------------------------------
console.log('\n--- GROUP 5: Styling & Dark Mode Compliance ---');

check('5.1 CSS definitions for transparency container, toggle button, and topics grid', () => {
  assert.ok(css.includes('.report-transparency-disclosure'), 'Disclosure container styled');
  assert.ok(css.includes('.transparency-header-btn'), 'Header toggle button styled');
  assert.ok(css.includes('.transparency-topics-grid'), 'Topics grid styled');
  assert.ok(css.includes('.transparency-chevron'), 'Chevron transition styled');
  assert.ok(css.includes('.transparency-entry-link'), 'Stage 1 entry link styled');
});

check('5.2 Dark mode overrides defined for transparency disclosure and topic badges', () => {
  assert.ok(css.includes('[data-theme="dark"] .transparency-header-btn') || css.includes('[data-theme="dark"] .topic-icon'), 'Dark mode styles defined');
  assert.ok(css.includes('[data-theme="dark"] .topic-icon.icon-blue'), 'Dark mode blue icon badge adjusted');
});

// -------------------------------------------------------------
// GROUP 6: Backward Compatibility & Invariants
// -------------------------------------------------------------
console.log('\n--- GROUP 6: Backward Compatibility & Invariants ---');

check('6.1 Preserved #report-limitations-list and renderLimitationsFooter', () => {
  assert.ok(html.includes('id="report-limitations-list"'), 'report-limitations-list container preserved');
  assert.ok(js.includes('function renderLimitationsFooter('), 'renderLimitationsFooter preserved in JS');
});

check('6.2 Production db.json SHA-256 strictly invariant', () => {
  const EXPECTED_HASH = '44223d9b7e945e70cadeb3279ae3ee5a0dd748a867b2c3a6b0c5c617a9db62c3';
  const content = fs.readFileSync(dbPath);
  const actualHash = crypto.createHash('sha256').update(content).digest('hex').toLowerCase();
  assert.strictEqual(actualHash, EXPECTED_HASH, `Database SHA-256 hash mismatch! Actual: ${actualHash}`);
});

console.log('===============================================================');
console.log(`TOTAL AUDIT CHECKS: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);
console.log('===============================================================\n');

if (failCount > 0) {
  process.exit(1);
}
