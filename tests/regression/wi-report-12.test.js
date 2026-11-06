/**
 * PREPMATE — REGRESSION TEST SUITE: WI-REPORT-12
 * Ecosystem Single-Column Presentation & Interview Recommendations Note Sheet Restructuring
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

console.log('================================================================');
console.log('  TEST SUITE: WI-REPORT-12 (ECOSYSTEM & NOTE SHEET RESTRUCTURING) ');
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
const dbPath = path.resolve(__dirname, '../../BE/data/db.json');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

// -------------------------------------------------------------
// 1. SINGLE-COLUMN ECOSYSTEM PRESENTATION (WI-01)
// -------------------------------------------------------------
console.log('--- 1. SINGLE-COLUMN ECOSYSTEM PRESENTATION ---');

check('report.css enforces single-column layout for Ecosystem preparation modules', () => {
  assert(css.includes('.prep-modules-grid'), 'Must define .prep-modules-grid');
  assert(css.includes('flex-direction: column'), 'Must stack items vertically in column');
  assert(css.includes('max-width: 960px'), 'Must constrain reading width comfortably');
});

check('report.css enforces single-column layout for 6 recruiting needs categories', () => {
  assert(css.includes('.needs-grid'), 'Must define .needs-grid');
  assert(css.includes('.needs-category-card'), 'Must style .needs-category-card');
});

// -------------------------------------------------------------
// 2. PROFESSIONAL INTERVIEW NOTE SHEET (WI-02)
// -------------------------------------------------------------
console.log('\n--- 2. PROFESSIONAL INTERVIEW NOTE SHEET ---');

check('report.js renders interview-prep-note-sheet structure', () => {
  assert(js.includes('interview-prep-note-sheet'), 'Must create .interview-prep-note-sheet');
  assert(js.includes('note-sheet-header'), 'Must have note-sheet-header');
  assert(js.includes('GHI CHÚ DÀNH CHO BẠN'), 'Must have note sheet badge');
  assert(js.includes('note-sheet-intro'), 'Must have explanatory intro sentence');
});

check('report.js formats recommendations as distinct bullet points with bold titles', () => {
  assert(js.includes('note-bullet-item'), 'Each recommendation must be a note-bullet-item');
  assert(js.includes('note-bullet'), 'Must render bullet symbol');
  assert(js.includes('note-bullet-title'), 'Must render bold title');
  assert(js.includes('note-bullet-action'), 'Must render concrete action');
  assert(js.includes('note-bullet-why'), 'Must render rationale');
});

check('report.js does not contain form checkboxes or completion ticks in note view', () => {
  // In the note-bullet-list, recommendations are strictly <li> bullets without interactive completion checkboxes
  assert(!js.includes('<li class="note-bullet-item"><input type="checkbox"'), 'No completion checkboxes in note items');
});

// -------------------------------------------------------------
// 3. INFORMATION ARCHITECTURE SEPARATION (WI-03 & WI-04)
// -------------------------------------------------------------
console.log('\n--- 3. INFORMATION ARCHITECTURE SEPARATION ---');

check('report.html maintains independent Ecosystem and Recommendations sections', () => {
  assert(html.includes('id="supplementary-info-panel"'), 'Ecosystem supplementary panel exists');
  assert(html.includes('id="section-supporting-materials"'), 'Supporting materials section exists');
  assert(html.includes('id="section-checklist"'), 'Recommendations section exists');
  assert(html.includes('id="prep-company-intel-box"'), 'Company intelligence box exists');
  assert(html.includes('id="company-needs-breakdown"'), 'Company needs breakdown exists');
  assert(html.includes('id="cv-jd-gap-analysis"'), 'CV-JD gap analysis exists');
});

check('report.js organizes recommendations into 2 vertical canonical groups', () => {
  assert(js.includes('note-group-onsite'), 'Must have Onsite note group');
  assert(js.includes('note-group-online'), 'Must have Online note group');
  assert(js.includes('Phỏng Vấn Trực Tiếp (Tại Doanh Nghiệp)'), 'Must have Onsite title');
  assert(js.includes('Phỏng Vấn Trực Tuyến (Online / Video Call)'), 'Must have Online title');
  assert(js.includes('note-group-divider'), 'Must separate groups with divider');
});

check('report.js includes 4 canonical Onsite recommendations', () => {
  assert(js.includes('rec-onsite-dresscode'), 'Dresscode recommendation');
  assert(js.includes('rec-onsite-timing'), 'Timing recommendation');
  assert(js.includes('rec-onsite-documents'), 'Documents recommendation');
  assert(js.includes('rec-onsite-etiquette'), 'Etiquette recommendation');
});

check('report.js includes 4 canonical Online recommendations', () => {
  assert(js.includes('rec-online-platform'), 'Platform recommendation');
  assert(js.includes('rec-online-camera'), 'Camera recommendation');
  assert(js.includes('rec-online-audio'), 'Audio recommendation');
  assert(js.includes('rec-online-network'), 'Network recommendation');
});

// -------------------------------------------------------------
// 4. CSS STYLING & DARK THEME INTEGRITY (WI-05)
// -------------------------------------------------------------
console.log('\n--- 4. CSS STYLING & DARK THEME INTEGRITY ---');

check('report.css defines typography and spacing for Note Sheet', () => {
  assert(css.includes('.interview-prep-note-sheet'), 'Styles .interview-prep-note-sheet');
  assert(css.includes('.note-sheet-header'), 'Styles .note-sheet-header');
  assert(css.includes('.note-bullet-item'), 'Styles .note-bullet-item');
  assert(css.includes('.note-bullet-title'), 'Styles .note-bullet-title');
  assert(css.includes('.note-group-divider'), 'Styles .note-group-divider');
});

check('report.css provides full Dark Mode overrides for Note Sheet', () => {
  assert(css.includes('[data-theme="dark"] .interview-prep-note-sheet'), 'Dark mode sheet background');
  assert(css.includes('[data-theme="dark"] .note-sheet-badge'), 'Dark mode badge');
  assert(css.includes('[data-theme="dark"] .note-bullet-title'), 'Dark mode bullet title');
  assert(css.includes('[data-theme="dark"] .note-group-divider'), 'Dark mode divider');
});

// -------------------------------------------------------------
// 5. DATABASE INTEGRITY INVARIANT
// -------------------------------------------------------------
console.log('\n--- 5. DATABASE INTEGRITY INVARIANT ---');

check('BE/data/db.json SHA-256 hash strictly preserved', () => {
  const dbBytes = fs.readFileSync(dbPath);
  const hash = crypto.createHash('sha256').update(dbBytes).digest('hex');
  const expected = '44223d9b7e945e70cadeb3279ae3ee5a0dd748a867b2c3a6b0c5c617a9db62c3';
  assert.strictEqual(hash, expected, `DB hash modified: ${hash}`);
});

console.log('\n================================================================');
console.log(`  WI-REPORT-12 RESULTS: ${passCount} PASS, ${failCount} FAIL`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
}
