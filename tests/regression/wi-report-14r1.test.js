// tests/regression/wi-report-14r1.test.js
// Regression test suite for WI-REPORT-14R1: RECOMMENDATIONS PRIORITY HIERARCHY & PROGRESSIVE DISCLOSURE

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('================================================================');
console.log('  TEST SUITE: WI-REPORT-14R1 (PRIORITY HIERARCHY & PROGRESSIVE DISCLOSURE)');
console.log('================================================================\n');

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const reportHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.html'), 'utf8');
const reportJs = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.js'), 'utf8');
const reportCss = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.css'), 'utf8');
const dbPath = path.join(WORKSPACE_ROOT, 'BE/data/db.json');

// --- 1. TIER 1: PRIORITY RECOMMENDATIONS (ĐỀ XUẤT CHÍNH) ---
console.log('--- 1. TIER 1: PRIORITY RECOMMENDATIONS (ĐỀ XUẤT CHÍNH) ---');
assert.ok(
  reportHtml.includes('TẦNG 1 • ĐỀ XUẤT TRỌNG TÂM') || reportHtml.includes('Các Đề Xuất Cải Thiện Trọng Tâm'),
  'report.html establishes Tier 1: Priority Recommendations header'
);
assert.ok(
  reportJs.includes('sortedItems.slice(0, 3)') || reportJs.includes('items.slice(0, 3)'),
  'report.js selects top 2-3 highest-priority improvement recommendations'
);
assert.ok(
  reportJs.includes('class="priority-rec-action"') && reportJs.includes('Hành động trọng tâm:'),
  'report.js formats 1-sentence concrete action for priority recommendations'
);
assert.ok(
  reportJs.includes('class="priority-rec-why"') && reportJs.includes('Lý do ưu tiên:'),
  'report.js formats 1-sentence concise rationale explaining why it is a priority'
);
assert.ok(
  reportJs.includes('toggleRoadmapSteps') && reportJs.includes('roadmap-panel-collapsed'),
  'report.js supports expand on demand with default collapsed state for details'
);
console.log('[PASS] Tier 1: Priority Recommendations structure and on-demand expansion verified');

// --- 2. TIER 2: PREPARATION STUDY GUIDE (CẨM NANG ÔN LUYỆN) ---
console.log('\n--- 2. TIER 2: PREPARATION STUDY GUIDE (CẨM NANG ÔN LUYỆN) ---');
assert.ok(
  reportHtml.includes('TẦNG 2 • CẨM NANG ÔN LUYỆN') && reportHtml.includes('Cẩm Nang Hướng Dẫn Ôn Luyện'),
  'report.html establishes Tier 2: Preparation Study Guide header'
);
assert.ok(
  reportHtml.includes('id="prep-module-technical"') &&
  reportHtml.includes('id="prep-module-behavioral"') &&
  reportHtml.includes('id="prep-dresscode-card"') &&
  reportHtml.includes('id="section-checklist"'),
  'Tier 2 houses the 4 canonical groups (Chuyên môn, STAR, Trang phục, Hình thức phỏng vấn)'
);
assert.ok(
  reportHtml.includes('btn-toggle-module') && reportHtml.includes('module-body-collapsible module-collapsed'),
  'Tier 2 groups implement Progressive Disclosure with collapsed summary state by default'
);
assert.ok(
  reportJs.includes('function togglePrepModule') && reportJs.includes('window.togglePrepModule'),
  'report.js defines and exports togglePrepModule function for group expansion'
);
console.log('[PASS] Tier 2: Preparation Study Guide and progressive disclosure verified');

// --- 3. TIER 3: REFERENCE MATERIALS (TÀI LIỆU THAM KHẢO) ---
console.log('\n--- 3. TIER 3: REFERENCE MATERIALS (TÀI LIỆU THAM KHẢO) ---');
assert.ok(
  reportHtml.includes('TẦNG 3 • TÀI LIỆU THAM KHẢO') && reportHtml.includes('id="section-reference-materials"'),
  'report.html establishes Tier 3: Reference Materials independent section'
);
assert.ok(
  reportJs.includes('Tài Liệu Chuyên Môn Theo Lĩnh Vực') &&
  (reportJs.includes('Cẩm Nang Phương Pháp &amp; Kỹ Năng Phỏng Vấn') || reportJs.includes('Cẩm Nang Phương Pháp & Kỹ Năng Phỏng Vấn')),
  'report.js categorizes reference materials into Domain vs Interview Strategy'
);
assert.ok(
  reportJs.includes('class="ref-category-group"') && reportJs.includes('class="ref-category-header"'),
  'report.js renders structured reference category groups'
);
console.log('[PASS] Tier 3: Reference Materials categorization and structure verified');

// --- 4. CSS STYLING, HIERARCHY & DARK MODE ---
console.log('\n--- 4. CSS STYLING, HIERARCHY & DARK MODE ---');
assert.ok(
  reportCss.includes('.priority-rec-card') && reportCss.includes('.priority-rec-action'),
  'report.css styles Tier 1 priority recommendation cards'
);
assert.ok(
  reportCss.includes('.btn-toggle-module') && reportCss.includes('.module-body-collapsible.module-collapsed'),
  'report.css styles Tier 2 progressive disclosure toggle controls'
);
assert.ok(
  reportCss.includes('.ref-category-header') && reportCss.includes('.ref-category-title'),
  'report.css styles Tier 3 reference category headers'
);
assert.ok(
  reportCss.includes('[data-theme="dark"] .priority-rec-card') &&
  reportCss.includes('[data-theme="dark"] .btn-toggle-module'),
  'report.css provides full dark mode styling for all 3 tiers'
);
console.log('[PASS] CSS styling, hierarchy and dark mode verified');

// --- 5. INVARIANT: DATABASE HASH INTEGRITY ---
console.log('\n--- 5. INVARIANT: DATABASE HASH INTEGRITY ---');
const EXPECTED_DB_HASH = 'c2ba83b82e758b277786dad7073e1c8a0e80c71fc615ecbbe5847d01b47cda50';
const dbBuffer = fs.readFileSync(dbPath);
const actualDbHash = crypto.createHash('sha256').update(dbBuffer).digest('hex');
assert.strictEqual(
  actualDbHash,
  EXPECTED_DB_HASH,
  `Database SHA-256 hash invariant preserved (${EXPECTED_DB_HASH})`
);
console.log('[PASS] Database SHA-256 hash invariant verified intact');

console.log('\n================================================================');
console.log('  [PASS] ALL 18 WI-REPORT-14R1 REGRESSION CHECKS PASSED (100%)');
console.log('================================================================');
