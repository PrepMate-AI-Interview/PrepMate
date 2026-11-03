/**
 * PREPMATE — REGRESSION TEST SUITE: WI-REPORT-11
 * Report Analysis (Section B Delivery Style) & Recommendations UX Refinement
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('  TEST SUITE: WI-REPORT-11 (ANALYSIS & RECOMMENDATIONS REFINEMENT) ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`[PASS] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${desc}: ${err.message}`);
    failCount++;
  }
}

const htmlPath = path.resolve(__dirname, '../../FE/features/report/report.html');
const cssPath = path.resolve(__dirname, '../../FE/features/report/report.css');
const jsPath = path.resolve(__dirname, '../../FE/features/report/report.js');
const enginePath = path.resolve(__dirname, '../../FE/features/interview/speech-coaching-engine.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');
const engine = fs.readFileSync(enginePath, 'utf8');

// -------------------------------------------------------------
// 1. SECTION B — PHONG CÁCH THỂ HIỆN (ANALYSIS)
// -------------------------------------------------------------
console.log('--- 1. SECTION B: PHONG CÁCH THỂ HIỆN ---');

check('report.html has speech-executive-assessment-card container', () => {
  assert(html.includes('id="speech-executive-assessment-card"'), 'Must have speech-executive-assessment-card');
  assert(html.includes('id="delivery-assessment-content"'), 'Must have delivery-assessment-content');
  assert(html.includes('Tổng Quan Phong Cách Thể Hiện & Giao Tiếp'), 'Must have section title');
});

check('report.js renders Executive Delivery Assessment answering the 3 core questions', () => {
  assert(js.includes('delivery-assessment-content'), 'Must reference delivery-assessment-content');
  assert(js.includes('Nhận định tổng quan:'), 'Must answer question 1: General synthesis');
  assert(js.includes('Biểu hiện đáng chú ý:'), 'Must answer question 2: Notable evidence & metrics');
  assert(js.includes('Điểm cần cải thiện:'), 'Must answer question 3: Key actionable improvement');
});

check('speech-coaching-engine.js has streamlined, evidence-based recommendations without fluff', () => {
  assert(engine.includes('Tiếp tục rèn luyện các câu hỏi đào sâu với độ phức tạp cao hơn.'), 'Contains concise speech coaching');
  assert(!engine.includes('đạt được sự lưu loát vượt bậc và ghi điểm trọn vẹn trong mắt phỏng vấn viên'), 'Generic fluff removed');
  assert(!engine.includes('Bạn có tiềm năng diễn đạt rất tốt'), 'Complimentary fluff removed');
});

// -------------------------------------------------------------
// 2. SEPARATED RECOMMENDATIONS & SUPPORTING MATERIALS
// -------------------------------------------------------------
console.log('\n--- 2. SEPARATED RECOMMENDATIONS & SUPPORTING MATERIALS ---');

check('report.html separates Supplementary Info and Supporting Materials into distinct sections', () => {
  assert(html.includes('id="supplementary-info-panel"'), 'Must have supplementary-info-panel');
  assert(html.includes('id="section-supporting-materials"'), 'Must have section-supporting-materials');
  assert(html.includes('id="section-checklist"'), 'Must have section-checklist');
  assert(html.includes('THÔNG TIN BỔ SUNG'), 'Has uppercase distinct label for Supplementary Info');
  assert(html.includes('TÀI LIỆU HỖ TRỢ'), 'Has uppercase distinct label for Supporting Materials');
});

check('report.html does not lump all supplementary and reference content into generic "Tài liệu bổ trợ"', () => {
  // Should not have a top-level unified section heading "Tài liệu bổ trợ" wrapping both company intel and prep materials
  const hasCatchallWrapper = html.includes('<h2>Tài liệu bổ trợ</h2>') || html.includes('<h3>Tài liệu bổ trợ</h3>');
  assert(!hasCatchallWrapper, 'Generic catch-all "Tài liệu bổ trợ" wrapper heading should not exist');
});

// -------------------------------------------------------------
// 3. PREPARATION RECOMMENDATIONS (2 GROUPS: ONSITE & ONLINE)
// -------------------------------------------------------------
console.log('\n--- 3. PREPARATION RECOMMENDATIONS (ONSITE & ONLINE) ---');

check('report.html displays Đề Xuất Chuẩn Bị Phỏng Vấn with format selector buttons', () => {
  assert(html.includes('ĐỀ XUẤT CHUẨN BỊ') && html.includes('Chuẩn Bị Cho Buổi Phỏng Vấn'), 'Must display preparation recommendations header');
  assert(html.includes('data-format="onsite"'), 'Has onsite format selector');
  assert(html.includes('data-format="online"'), 'Has online format selector');
  assert(html.includes('Phỏng vấn trực tiếp'), 'Has Onsite button label');
  assert(html.includes('Phỏng vấn trực tuyến'), 'Has Online button label');
});

check('report.js implements canonical Onsite recommendations (4 items)', () => {
  assert(js.includes('rec-onsite-dresscode'), 'Has Onsite Dress code recommendation');
  assert(js.includes('rec-onsite-timing'), 'Has Onsite Timing/Punctuality recommendation');
  assert(js.includes('rec-onsite-documents'), 'Has Onsite CV Print/Documents recommendation');
  assert(js.includes('rec-onsite-etiquette'), 'Has Onsite Etiquette recommendation');
});

check('report.js implements canonical Online recommendations (4 items)', () => {
  assert(js.includes('rec-online-platform'), 'Has Online Platform/App recommendation');
  assert(js.includes('rec-online-camera'), 'Has Online Camera & Lighting recommendation');
  assert(js.includes('rec-online-audio'), 'Has Online Microphone/Audio recommendation');
  assert(js.includes('rec-online-network'), 'Has Online Space & 4G Hotspot recommendation');
});

check('report.js displays recommendation action and why it matters', () => {
  assert(js.includes('Nên chuẩn bị:'), 'Explains what candidate should prepare');
  assert(js.includes('Tại sao quan trọng:'), 'Explains why the recommendation is important');
});

// -------------------------------------------------------------
// 4. CSS STYLES & DARK MODE CONTRACTS
// -------------------------------------------------------------
console.log('\n--- 4. CSS STYLES & DARK MODE CONTRACTS ---');

check('report.css includes styles for Executive Assessment and Recommendations', () => {
  assert(css.includes('.speech-executive-assessment-card'), 'Contains .speech-executive-assessment-card');
  assert(css.includes('.delivery-assessment-grid'), 'Contains .delivery-assessment-grid');
  assert(css.includes('.delivery-assessment-point'), 'Contains .delivery-assessment-point');
  assert(css.includes('.action-highlight'), 'Contains .action-highlight');
  assert(css.includes('.prep-recommendations-wrapper'), 'Contains .prep-recommendations-wrapper');
  assert(css.includes('.prep-rec-card'), 'Contains .prep-rec-card');
});

check('report.css includes Dark Mode styles for all WI-REPORT-11 components', () => {
  assert(css.includes('[data-theme="dark"] .speech-executive-assessment-card'), 'Dark mode speech-executive-assessment-card');
  assert(css.includes('[data-theme="dark"] .delivery-assessment-point'), 'Dark mode delivery-assessment-point');
  assert(css.includes('[data-theme="dark"] .prep-rec-card'), 'Dark mode prep-rec-card');
  assert(css.includes('[data-theme="dark"] .action-highlight'), 'Dark mode action-highlight');
});

console.log('\n================================================================');
console.log(`  WI-REPORT-11 RESULTS: ${passCount} PASS, ${failCount} FAIL`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
}
