// tests/regression/wi-report-14.test.js
// Regression test suite for WI-REPORT-14: RECOMMENDATIONS INFORMATION ARCHITECTURE & STUDY GUIDE / RESOURCE SEPARATION

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('================================================================');
console.log('  TEST SUITE: WI-REPORT-14 (RECOMMENDATIONS IA & RESOURCE SEPARATION)');
console.log('================================================================\n');

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const reportHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.html'), 'utf8');
const reportJs = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.js'), 'utf8');
const reportCss = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.css'), 'utf8');
const dbPath = path.join(WORKSPACE_ROOT, 'BE/data/db.json');

// --- 1. SEPARATION OF PREPARATION GUIDE AND REFERENCE MATERIALS ---
console.log('--- 1. SEPARATION OF PREPARATION GUIDE AND REFERENCE MATERIALS ---');
assert.ok(
  reportHtml.includes('id="section-supporting-materials"') && reportHtml.includes('CẨM NANG ÔN LUYỆN'),
  'report.html establishes Section A: Cẩm nang ôn luyện (Preparation Guide) as an independent section'
);
assert.ok(
  reportHtml.includes('id="section-reference-materials"') && reportHtml.includes('TÀI LIỆU THAM KHẢO'),
  'report.html establishes Section B: Tài liệu tham khảo (Reference Materials) as an independent section'
);
assert.ok(
  reportHtml.includes('id="reference-materials-list-container"'),
  'report.html provides dedicated container for reference materials list'
);
console.log('[PASS] Independent separation between Preparation Guide and Reference Materials verified');

// --- 2. PREPARATION GUIDE: 4 STRUCTURED SUBGROUPS ---
console.log('\n--- 2. PREPARATION GUIDE: 4 STRUCTURED SUBGROUPS ---');
assert.ok(
  reportHtml.includes('id="prep-technical-content"') && reportHtml.includes('id="prep-practical-content"'),
  'Preparation Guide includes Subgroup 1: Chuyên môn (Technical knowledge & Practical/System Design)'
);
assert.ok(
  reportHtml.includes('id="prep-behavioral-content"') && reportHtml.includes('STAR Framework'),
  'Preparation Guide includes Subgroup 2: Kỹ năng phỏng vấn (Behavioral & STAR Framework)'
);
assert.ok(
  reportHtml.includes('id="prep-dresscode-card"') && reportHtml.includes('id="visual-outfit-container"'),
  'Preparation Guide includes Subgroup 3: Trang phục phỏng vấn (Preserving compact carousel)'
);
assert.ok(
  reportHtml.includes('id="section-checklist"') && reportHtml.includes('id="interview-format-selector-box"'),
  'Preparation Guide includes Subgroup 4: Chuẩn bị theo hình thức phỏng vấn (Segmented Onsite/Online note)'
);
console.log('[PASS] All 4 Preparation Guide subgroups verified');

// --- 3. REFERENCE MATERIALS: CURATED DATA & INFORMATION ARCHITECTURE ---
console.log('\n--- 3. REFERENCE MATERIALS: CURATED DATA & INFORMATION ARCHITECTURE ---');
assert.ok(
  reportJs.includes('function renderReferenceMaterials') && reportJs.includes('window.renderReferenceMaterials'),
  'report.js defines and exports renderReferenceMaterials function'
);
assert.ok(
  reportJs.includes('renderReferenceMaterials(session, report);'),
  'report.js calls renderReferenceMaterials inside renderFullReport'
);
assert.ok(
  reportJs.includes('Designing Data-Intensive Applications') &&
  reportJs.includes('The System Design Primer') &&
  reportJs.includes('Clean Architecture'),
  'report.js includes authentic, curated engineering references'
);
assert.ok(
  reportJs.includes('Cẩm Nang Cấu Trúc STAR & PREP') &&
  reportJs.includes('Chiến Lược Đối Thoại Kỹ Thuật & Tương Tác Hai Chiều'),
  'report.js includes cross-industry interview communication references'
);
assert.ok(
  reportJs.includes('class="ref-item-main"') &&
  reportJs.includes('class="ref-type-badge') &&
  reportJs.includes('class="ref-item-title"') &&
  reportJs.includes('class="ref-why-box"'),
  'report.js renders structured reference cards with title, type, description, and why it matters'
);
console.log('[PASS] Curated reference materials data and structure verified');

// --- 4. CSS STYLING, SINGLE-COLUMN LAYOUT & DARK MODE ---
console.log('\n--- 4. CSS STYLING, SINGLE-COLUMN LAYOUT & DARK MODE ---');
assert.ok(
  reportCss.includes('.reference-materials-card') && reportCss.includes('.reference-materials-grid'),
  'report.css styles reference materials card and grid'
);
assert.ok(
  reportCss.includes('.reference-materials-grid') && reportCss.includes('flex-direction: column !important'),
  'report.css enforces single-column vertical layout for reference items'
);
assert.ok(
  reportCss.includes('.reference-material-item') && reportCss.includes('.ref-why-box'),
  'report.css styles individual reference material items and why-box'
);
assert.ok(
  reportCss.includes('[data-theme="dark"] .reference-materials-card') &&
  reportCss.includes('[data-theme="dark"] .reference-material-item'),
  'report.css provides comprehensive dark mode overrides for reference materials'
);
console.log('[PASS] CSS styling, single-column layout and dark mode verified');

// --- 5. INVARIANT: DATABASE HASH INTEGRITY ---
console.log('\n--- 5. INVARIANT: DATABASE HASH INTEGRITY ---');
const EXPECTED_DB_HASH = '44223d9b7e945e70cadeb3279ae3ee5a0dd748a867b2c3a6b0c5c617a9db62c3';
const dbBuffer = fs.readFileSync(dbPath);
const actualDbHash = crypto.createHash('sha256').update(dbBuffer).digest('hex');
assert.strictEqual(
  actualDbHash,
  EXPECTED_DB_HASH,
  `Database SHA-256 hash invariant preserved (${EXPECTED_DB_HASH})`
);
console.log('[PASS] Database SHA-256 hash invariant verified intact');

console.log('\n================================================================');
console.log('  [PASS] ALL 18 WI-REPORT-14 REGRESSION CHECKS PASSED (100%)');
console.log('================================================================');
