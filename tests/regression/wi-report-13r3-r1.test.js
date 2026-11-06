// tests/regression/wi-report-13r3-r1.test.js
// Regression test suite for WI-REPORT-13R3-R1: COMPACT CLOTHING SUGGESTION CAROUSEL

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('================================================================');
console.log('  TEST SUITE: WI-REPORT-13R3-R1 (COMPACT CLOTHING SUGGESTION CAROUSEL)');
console.log('================================================================\n');

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const reportHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.html'), 'utf8');
const reportJs = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.js'), 'utf8');
const reportCss = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.css'), 'utf8');
const dbPath = path.join(WORKSPACE_ROOT, 'BE/data/db.json');

// --- 1. COMPACT FOOTPRINT & 2-COLUMN SIDE-BY-SIDE DESKTOP LAYOUT ---
console.log('--- 1. COMPACT FOOTPRINT & 2-COLUMN SIDE-BY-SIDE DESKTOP LAYOUT ---');
assert.ok(
  reportCss.includes('grid-template-columns: 140px 1fr'),
  'report.css arranges thumbnail and content side-by-side on desktop to minimize vertical height'
);
assert.ok(
  reportCss.includes('.outfit-slide-media .outfit-photo-wrap') && reportCss.includes('height: 110px !important'),
  'report.css sizes thumbnail to compact 110px height instead of hero/banner size'
);
assert.ok(
  reportCss.includes('.outfit-slide-card') && reportCss.includes('flex: 0 0 100% !important'),
  'report.css sizes each slide card strictly to 100% viewport width'
);
assert.ok(
  reportCss.includes('.outfit-slider-viewport') && reportCss.includes('overflow: hidden'),
  'report.css constrains carousel viewport with overflow: hidden'
);
console.log('[PASS] Compact footprint and side-by-side layout contracts verified');

// --- 2. CONCISE CONTENT HIERARCHY (TÊN - GỢI Ý - LƯU Ý) ---
console.log('\n--- 2. CONCISE CONTENT HIERARCHY (TÊN - GỢI Ý - LƯU Ý) ---');
assert.ok(
  reportJs.includes('class="outfit-style-title"'),
  'report.js renders concise style title'
);
assert.ok(
  reportJs.includes('class="outfit-suggestion-row"') && reportJs.includes('Gợi ý:'),
  'report.js renders focused 1-sentence outfit suggestion row'
);
assert.ok(
  reportJs.includes('class="outfit-caution-row"') && reportJs.includes('Lưu ý:'),
  'report.js renders concise caution note row'
);
assert.ok(
  reportJs.includes('Business Formal') && reportJs.includes('Business Casual') &&
  reportJs.includes('Smart Casual') && reportJs.includes('Online Virtual'),
  'report.js retains all 4 canonical clothing styles without adding unverified data'
);
console.log('[PASS] Concise content hierarchy verified');

// --- 3. CONTROLS, ACCESSIBILITY & SWIPE GESTURES ---
console.log('\n--- 3. CONTROLS, ACCESSIBILITY & SWIPE GESTURES ---');
assert.ok(
  reportJs.includes('id="outfit-slider-prev"') && reportJs.includes('navigateOutfitSlide(-1)'),
  'report.js renders Previous slide navigation button'
);
assert.ok(
  reportJs.includes('id="outfit-slider-next"') && reportJs.includes('navigateOutfitSlide(1)'),
  'report.js renders Next slide navigation button'
);
assert.ok(
  reportJs.includes('id="outfit-slider-indicator"'),
  'report.js renders compact slide counter'
);
assert.ok(
  reportJs.includes('id="outfit-slider-dots"'),
  'report.js renders small pagination dots'
);
assert.ok(
  reportJs.includes('ArrowLeft') && reportJs.includes('ArrowRight'),
  'report.js supports keyboard arrow key navigation'
);
assert.ok(
  reportJs.includes('touchstart') && reportJs.includes('touchend'),
  'report.js handles mobile touch swipe gestures'
);
console.log('[PASS] Navigation controls and gesture handling verified');

// --- 4. RESPONSIVE COMPACT LAYOUT & DARK MODE ---
console.log('\n--- 4. RESPONSIVE COMPACT LAYOUT & DARK MODE ---');
assert.ok(
  reportCss.includes('@media (max-width: 768px)') && reportCss.includes('height: 125px !important'),
  'report.css handles responsive mobile scaling with compact 125px thumbnail'
);
assert.ok(
  reportCss.includes('[data-theme="dark"] .outfit-slide-inner') &&
  reportCss.includes('[data-theme="dark"] .outfit-nav-btn'),
  'report.css maintains dark theme tokens for compact carousel'
);
assert.ok(
  reportCss.includes('@media (prefers-reduced-motion: reduce)') && reportCss.includes('transition: none'),
  'report.css honors prefers-reduced-motion'
);
console.log('[PASS] Responsive scaling and dark mode verified');

// --- 5. DATABASE INTEGRITY INVARIANT ---
console.log('\n--- 5. DATABASE INTEGRITY INVARIANT ---');
const EXPECTED_DB_HASH = '44223d9b7e945e70cadeb3279ae3ee5a0dd748a867b2c3a6b0c5c617a9db62c3';
const dbBytes = fs.readFileSync(dbPath);
const actualDbHash = crypto.createHash('sha256').update(dbBytes).digest('hex');
assert.strictEqual(actualDbHash, EXPECTED_DB_HASH, 'BE/data/db.json SHA-256 hash must not be modified');
console.log('[PASS] Production database SHA-256 hash strictly preserved');

console.log('\n================================================================');
console.log('  WI-REPORT-13R3-R1 RESULTS: ALL ASSERTIONS PASSED (100%)');
console.log('================================================================\n');
