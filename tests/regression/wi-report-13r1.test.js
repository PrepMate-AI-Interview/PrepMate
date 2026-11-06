/**
 * WI-REPORT-13R1 REGRESSION TEST SUITE
 * 
 * Verifies:
 * 1. Visual Hierarchy: Redundant inner module headers suppressed; Ecosystem note sheet is direct primary content.
 * 2. Secondary Controls: Format selector refined to segmented control pill-track with inline icon and text.
 * 3. Accessibility & State: format-btn tabs carry proper aria-selected and active state toggling.
 * 4. Visual Outfit Cards: Real photography integration, proper aspect ratio, metadata hierarchy, and practical advice.
 * 5. Responsive & Dark Mode: Responsive media queries and theme tokens verified.
 * 6. Database Integrity: db.json SHA-256 hash strictly preserved.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('================================================================');
console.log('  TEST SUITE: WI-REPORT-13R1 (ECOSYSTEM VISUAL HIERARCHY & AUDIT)');
console.log('================================================================\n');

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const reportHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.html'), 'utf8');
const reportJs = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.js'), 'utf8');
const reportCss = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.css'), 'utf8');
const dbPath = path.join(WORKSPACE_ROOT, 'BE/data/db.json');

// --- 1. VISUAL HIERARCHY & TITLE CLARITY ---
console.log('--- 1. VISUAL HIERARCHY & TITLE CLARITY ---');
assert.ok(
  reportCss.includes('#supplementary-info-panel .prep-module-card > .module-header'),
  'report.css must suppress redundant intermediate module header in ecosystem panel'
);
assert.ok(
  reportHtml.includes('class="ecosystem-title">Hệ Sinh Thái &amp; Bối Cảnh Tuyển Dụng Thực Tế</h3>'),
  'report.html maintains distinct level-1 title for ecosystem'
);
console.log('[PASS] Visual hierarchy streamlined: redundant headers suppressed');

// --- 2. FORMAT SELECTOR SEGMENTED CONTROL ---
console.log('\n--- 2. FORMAT SELECTOR SEGMENTED CONTROL ---');
assert.ok(
  reportHtml.includes('class="format-selector-inner"'),
  'report.html includes semantic format-selector-inner container'
);
assert.ok(
  reportHtml.includes('class="format-selector-label-wrap"'),
  'report.html includes semantic format-selector-label-wrap'
);
assert.ok(
  reportHtml.includes('role="tablist"'),
  'report.html provides tablist role for format switcher'
);
assert.ok(
  reportHtml.includes('data-format="onsite"') && reportHtml.includes('data-format="online"'),
  'report.html defines both Onsite and Online options'
);
assert.ok(
  reportCss.includes('.format-options-group .format-btn') && reportCss.includes('white-space: nowrap'),
  'report.css styles format buttons with white-space: nowrap to prevent text wrapping'
);
assert.ok(
  reportCss.includes('height: 32px') || reportCss.includes('min-height: 32px'),
  'report.css constrains format button height to sleek 32px'
);
console.log('[PASS] Format selector refined as compact, non-wrapping segmented control');

// --- 3. ACCESSIBILITY & STATE TOGGLING ---
console.log('\n--- 3. ACCESSIBILITY & STATE TOGGLING ---');
assert.ok(
  reportJs.includes('setAttribute("aria-selected", "true")'),
  'report.js toggles aria-selected="true" on active format tab'
);
assert.ok(
  reportJs.includes('setAttribute("aria-selected", "false")'),
  'report.js toggles aria-selected="false" on inactive format tab'
);
assert.ok(
  reportJs.includes('renderPreparationSection(prep, jobTitle)'),
  'Format switcher triggers dress code re-rendering'
);
console.log('[PASS] Format switcher accessibility and state synchronization verified');

// --- 4. VISUAL OUTFIT CARD PRESENTATION ---
console.log('\n--- 4. VISUAL OUTFIT CARD PRESENTATION ---');
assert.ok(
  reportJs.includes('online-virtual.jpg'),
  'report.js references valid online-virtual.jpg image'
);
assert.ok(
  reportJs.includes('class="outfit-meta-label">PHÙ HỢP VỚI:'),
  'report.js renders structured suitability label'
);
assert.ok(
  reportJs.includes('class="outfit-meta-label">LỜI KHUYÊN THỰC TẾ:'),
  'report.js renders practical advice section label'
);
assert.ok(
  reportCss.includes('.outfit-visual-card .outfit-photo-wrap') && reportCss.includes('height: 160px'),
  'report.css styles outfit photo wrap with crisp 160px height'
);
assert.ok(
  reportCss.includes('.outfit-visual-card .outfit-photo-credit'),
  'report.css styles photo attribution credit'
);
console.log('[PASS] Visual outfit presentation balanced with photography, metadata & advice');

// --- 5. RESPONSIVE & DARK MODE CONTRACTS ---
console.log('\n--- 5. RESPONSIVE & DARK MODE CONTRACTS ---');
assert.ok(
  reportCss.includes('@media (max-width: 768px)') && reportCss.includes('.format-selector-inner'),
  'report.css adjusts format selector for mobile viewports'
);
assert.ok(
  reportCss.includes('[data-theme="dark"] .interview-format-selector-box'),
  'report.css provides Dark Mode for format selector box'
);
assert.ok(
  reportCss.includes('[data-theme="dark"] .format-options-group'),
  'report.css provides Dark Mode for format options track'
);
assert.ok(
  reportCss.includes('[data-theme="dark"] .outfit-visual-card .outfit-photo-wrap'),
  'report.css provides Dark Mode for outfit photo wrapper'
);
console.log('[PASS] Responsive media queries and Dark Mode tokens verified');

// --- 6. DATABASE INTEGRITY INVARIANT ---
console.log('\n--- 6. DATABASE INTEGRITY INVARIANT ---');
const EXPECTED_DB_HASH = '44223d9b7e945e70cadeb3279ae3ee5a0dd748a867b2c3a6b0c5c617a9db62c3';
const dbBytes = fs.readFileSync(dbPath);
const actualDbHash = crypto.createHash('sha256').update(dbBytes).digest('hex');
assert.strictEqual(actualDbHash, EXPECTED_DB_HASH, 'BE/data/db.json SHA-256 hash must not be modified');
console.log('[PASS] Database hash strictly preserved');

console.log('\n================================================================');
console.log('  WI-REPORT-13R1 RESULTS: ALL ASSERTIONS PASSED (100%)');
console.log('================================================================\n');
