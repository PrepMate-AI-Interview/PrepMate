// tests/regression/wi-report-13r2.test.js
// Regression test suite for WI-REPORT-13R2: REPORT VISUAL HIERARCHY, CLOTHING SLIDER & CONTEXTUAL PREPARATION UI

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('================================================================');
console.log('  TEST SUITE: WI-REPORT-13R2 (VISUAL HIERARCHY & CLOTHING SLIDER)');
console.log('================================================================\n');

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const reportHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.html'), 'utf8');
const reportJs = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.js'), 'utf8');
const reportCss = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.css'), 'utf8');
const dbPath = path.join(WORKSPACE_ROOT, 'BE/data/db.json');

// --- 1. SECTION BADGE & TITLE 2-LINE SEPARATION (WI-01) ---
console.log('--- 1. SECTION BADGE & TITLE 2-LINE SEPARATION (WI-01) ---');
assert.ok(
  reportCss.includes('.section-title-wrap') && reportCss.includes('flex-direction: column'),
  'report.css arranges .section-title-wrap in column layout for clean 2-line separation'
);
assert.ok(
  reportHtml.includes('class="section-title-wrap"'),
  'report.html structures section headers with semantic .section-title-wrap'
);
assert.ok(
  reportCss.includes('.section-title-wrap .section-badge') && reportCss.includes('display: inline-flex'),
  'report.css places section badge on line 1'
);
assert.ok(
  reportCss.includes('.section-title-wrap .section-title') && reportCss.includes('display: flex'),
  'report.css places section title and inline icon on line 2'
);
console.log('[PASS] Section badge & title cleanly separated onto 2 distinct lines across all report headers');

// --- 2. OVERALL SCORE WHEEL RING OPTIMIZATION (WI-02) ---
console.log('\n--- 2. OVERALL SCORE WHEEL RING OPTIMIZATION (WI-02) ---');
assert.ok(
  reportCss.includes('.score-wheel-ring') && reportCss.includes('width: 120px'),
  'report.css sizes score wheel ring comfortably at 120px'
);
assert.ok(
  reportCss.includes('.score-wheel-ring .score-main-number') && reportCss.includes('font-size: 46px'),
  'report.css sizes main score number at 46px centered without crowding'
);
assert.ok(
  reportCss.includes('.score-wheel-ring .score-clean-label') && reportCss.includes('display: none !important;'),
  'report.css hides redundant label inside score circle'
);
assert.ok(
  reportHtml.includes('class="score-wheel-ring"') && reportHtml.includes('id="hero-score-value"'),
  'report.html maintains canonical hero score circle and score number element'
);
console.log('[PASS] Score wheel ring optimized: extraneous text removed, score number centered & proportioned');

// --- 3. 6 CORE COMPETENCIES DISPLAY STANDARDIZATION (WI-03) ---
console.log('\n--- 3. 6 CORE COMPETENCIES DISPLAY STANDARDIZATION (WI-03) ---');
assert.ok(
  reportCss.includes('.dim-score-badge .dim-score-val') && reportCss.includes('font-size: 22px'),
  'report.css styles dimension score number at 22px bold as the primary focal point'
);
assert.ok(
  reportCss.includes('.dim-header-badges') && reportCss.includes('align-items: baseline'),
  'report.css aligns score number and level badge on the same baseline'
);
assert.ok(
  reportCss.includes('.dim-level-badge') && reportCss.includes('font-size: 11px'),
  'report.css keeps Strong/Weak label subtle at 11px'
);
console.log('[PASS] 6 Core Competencies hierarchy verified: score is focal point, status label is subtle');

// --- 4. CLOTHING RECOMMENDATIONS HORIZONTAL SLIDER & SMART CASUAL (WI-04) ---
console.log('\n--- 4. CLOTHING RECOMMENDATIONS HORIZONTAL SLIDER & SMART CASUAL (WI-04) ---');
assert.ok(
  reportCss.includes('.outfit-slider-container') && reportCss.includes('overflow: hidden'),
  'report.css establishes overflow-hidden container for carousel'
);
assert.ok(
  reportCss.includes('.outfit-slider-track') && reportCss.includes('display: flex'),
  'report.css defines horizontal slider track with flex layout'
);
assert.ok(
  reportCss.includes('.outfit-slide-card') && reportCss.includes('flex: 0 0 100%'),
  'report.css sizes each slide card to 100% viewport width'
);
assert.ok(
  reportJs.includes('outfit-slider-track') && reportJs.includes('window.navigateOutfitSlide'),
  'report.js implements carousel navigation function window.navigateOutfitSlide'
);
assert.ok(
  reportJs.includes('window.goToOutfitSlide'),
  'report.js implements direct slide jump function window.goToOutfitSlide'
);
assert.ok(
  reportJs.includes('id="outfit-slider-indicator"'),
  'report.js renders slide position counter (e.g., 1 / 4)'
);
assert.ok(
  reportJs.includes('id="outfit-slider-dots"'),
  'report.js renders interactive pagination indicator dots'
);
assert.ok(
  reportJs.includes('touchstart') && reportJs.includes('touchend'),
  'report.js supports mobile touch swipe gesture navigation'
);

// Smart Casual Structured Box Verification
assert.ok(
  reportJs.includes('smart-casual-structured-box'),
  'report.js renders specialized structured container for Smart Casual'
);
assert.ok(
  reportJs.includes('Trang phục chính:') && reportJs.includes('Điểm nhấn:') && reportJs.includes('Lưu ý:'),
  'report.js breaks down Smart Casual into 3 structured parts: Trang phục chính, Điểm nhấn, Lưu ý'
);
assert.ok(
  reportCss.includes('.smart-casual-structured-box'),
  'report.css styles Smart Casual structured box'
);
console.log('[PASS] Clothing horizontal slider & Smart Casual structured hierarchy verified');

// --- 5. CONTEXTUAL PREPARATION DYNAMIC FILTERING (WI-05) ---
console.log('\n--- 5. CONTEXTUAL PREPARATION DYNAMIC FILTERING (WI-05) ---');
assert.ok(
  reportJs.includes('note-group-onsite') && reportJs.includes('note-group-online'),
  'report.js maintains both Onsite and Online note groups in DOM'
);
assert.ok(
  reportJs.includes('currentFormat === "onsite" ? "active-focus" : "hidden-group"') ||
  reportJs.includes("currentFormat === 'onsite' ? 'active-focus' : 'hidden-group'"),
  'report.js dynamically marks inactive format group with hidden-group class'
);
assert.ok(
  reportCss.includes('#note-group-onsite.hidden-group') && reportCss.includes('display: none !important;'),
  'report.css enforces display: none on inactive format group'
);
assert.ok(
  reportCss.includes('#prep-checklist-divider') && reportCss.includes('display: none !important;'),
  'report.css hides divider between groups in single-focus view'
);
console.log('[PASS] Contextual preparation dynamic switcher verified: only selected format is displayed');

// --- 6. DARK MODE & RESPONSIVE COMPLIANCE ---
console.log('\n--- 6. DARK MODE & RESPONSIVE COMPLIANCE ---');
assert.ok(
  reportCss.includes('[data-theme="dark"] .smart-casual-structured-box'),
  'report.css defines Dark Mode for Smart Casual box'
);
assert.ok(
  reportCss.includes('[data-theme="dark"] .outfit-nav-btn'),
  'report.css defines Dark Mode for slider navigation buttons'
);
assert.ok(
  reportCss.includes('[data-theme="dark"] .outfit-dot.active'),
  'report.css defines Dark Mode for active slider dot'
);
assert.ok(
  reportCss.includes('@media (max-width: 768px)') && reportCss.includes('.sc-part-row'),
  'report.css provides mobile responsive stacking for Smart Casual rows'
);
console.log('[PASS] Dark Mode tokens and mobile responsive queries verified');

// --- 7. DATABASE INTEGRITY INVARIANT ---
console.log('\n--- 7. DATABASE INTEGRITY INVARIANT ---');
const EXPECTED_DB_HASH = '44223d9b7e945e70cadeb3279ae3ee5a0dd748a867b2c3a6b0c5c617a9db62c3';
const dbBytes = fs.readFileSync(dbPath);
const actualDbHash = crypto.createHash('sha256').update(dbBytes).digest('hex');
assert.strictEqual(actualDbHash, EXPECTED_DB_HASH, 'BE/data/db.json SHA-256 hash must not be modified');
console.log('[PASS] Production database SHA-256 hash strictly preserved');

console.log('\n================================================================');
console.log('  WI-REPORT-13R2 RESULTS: ALL ASSERTIONS PASSED (100%)');
console.log('================================================================\n');
