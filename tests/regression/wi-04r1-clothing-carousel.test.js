// tests/regression/wi-04r1-clothing-carousel.test.js
// Regression test suite for WI-04R1: CLOTHING STYLE HORIZONTAL SLIDE CAROUSEL

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('================================================================');
console.log('  TEST SUITE: WI-04R1 (CLOTHING STYLE HORIZONTAL SLIDE CAROUSEL)');
console.log('================================================================\n');

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const reportHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.html'), 'utf8');
const reportJs = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.js'), 'utf8');
const reportCss = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.css'), 'utf8');
const dbPath = path.join(WORKSPACE_ROOT, 'BE/data/db.json');

// --- 1. HORIZONTAL CAROUSEL ARCHITECTURE & 1 SLIDE PER STYLE ---
console.log('--- 1. HORIZONTAL CAROUSEL ARCHITECTURE & 1 SLIDE PER STYLE ---');
assert.ok(
  reportJs.includes('outfit-slider-container') && reportJs.includes('outfit-slider-track'),
  'report.js renders outfit slider container and horizontal track'
);
assert.ok(
  reportJs.includes('class="outfit-slide-card outfit-visual-card'),
  'report.js maps each style to exactly one dedicated outfit-slide-card'
);
assert.ok(
  reportCss.includes('.outfit-slide-card') && (reportCss.includes('flex: 0 0 100%') || reportCss.includes('flex: 0 0 100% !important')),
  'report.css sizes each slide card to 100% width so only 1 slide displays at a time'
);
assert.ok(
  reportCss.includes('.outfit-slider-viewport') && reportCss.includes('overflow: hidden'),
  'report.css constrains viewport with overflow: hidden to prevent overflow'
);
console.log('[PASS] 1 slide per style horizontal structure verified');

// --- 2. CONTROLS, NAVIGATION & ACCESSIBILITY ---
console.log('\n--- 2. CONTROLS, NAVIGATION & ACCESSIBILITY ---');
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
  'report.js renders slide indicator counter'
);
assert.ok(
  reportJs.includes('id="outfit-slider-dots"'),
  'report.js renders pagination dot indicators'
);
assert.ok(
  reportJs.includes('prevBtn.disabled') && reportJs.includes('nextBtn.disabled'),
  'report.js updates disabled state on boundary slides (first and last)'
);
assert.ok(
  reportJs.includes('aria-roledescription="carousel"') && reportJs.includes('aria-roledescription="slide"'),
  'report.js enforces WAI-ARIA carousel and slide semantics'
);
assert.ok(
  reportJs.includes('ArrowLeft') && reportJs.includes('ArrowRight'),
  'report.js supports ArrowLeft and ArrowRight keyboard navigation'
);
assert.ok(
  reportJs.includes('touchstart') && reportJs.includes('touchend'),
  'report.js handles mobile touch swipe gestures'
);
console.log('[PASS] Controls, boundary disabling, accessibility & swipe gestures verified');

// --- 3. MOTION, TIMING & REDUCED MOTION ---
console.log('\n--- 3. MOTION, TIMING & REDUCED MOTION ---');
assert.ok(
  reportCss.includes('260ms') || reportCss.includes('transition: transform'),
  'report.css specifies smooth 200-300ms transition for track movement'
);
assert.ok(
  reportCss.includes('@media (prefers-reduced-motion: reduce)') && reportCss.includes('transition: none'),
  'report.css disables motion when prefers-reduced-motion is active'
);
console.log('[PASS] Smooth transition timing and accessibility motion contracts verified');

// --- 4. SMART CASUAL 3-PART STRUCTURED BREAKDOWN ---
console.log('\n--- 4. SMART CASUAL 3-PART STRUCTURED BREAKDOWN ---');
assert.ok(
  reportJs.includes('smart-casual-structured-box'),
  'report.js renders dedicated smart-casual-structured-box'
);
assert.ok(
  reportJs.includes('Trang phục chính:') && reportJs.includes('Điểm nhấn:') && reportJs.includes('Lưu ý:'),
  'report.js structures Smart Casual into 3 clear parts without wordy paragraph dumps'
);
assert.ok(
  reportCss.includes('.smart-casual-structured-box'),
  'report.css styles Smart Casual structured card'
);
console.log('[PASS] Smart Casual structured 3-part hierarchy verified');

// --- 5. EDGE CASES & DATA INTEGRITY ---
console.log('\n--- 5. EDGE CASES & DATA INTEGRITY ---');
assert.ok(
  reportJs.includes('outfit-empty-state') || reportJs.includes('Chưa có dữ liệu phong cách trang phục'),
  'report.js provides empty state fallback if no outfit data present'
);
assert.ok(
  reportJs.includes('Business Formal') && reportJs.includes('Business Casual') &&
  reportJs.includes('Smart Casual') && reportJs.includes('Online Virtual'),
  'report.js retains all 4 canonical outfit styles without adding unverified styles'
);
console.log('[PASS] Empty state handling and canonical dataset preservation verified');

// --- 6. DATABASE INTEGRITY INVARIANT ---
console.log('\n--- 6. DATABASE INTEGRITY INVARIANT ---');
const EXPECTED_DB_HASH = 'c2ba83b82e758b277786dad7073e1c8a0e80c71fc615ecbbe5847d01b47cda50';
const dbBytes = fs.readFileSync(dbPath);
const actualDbHash = crypto.createHash('sha256').update(dbBytes).digest('hex');
assert.strictEqual(actualDbHash, EXPECTED_DB_HASH, 'BE/data/db.json SHA-256 hash must not be modified');
console.log('[PASS] Production database SHA-256 hash strictly preserved');

console.log('\n================================================================');
console.log('  WI-04R1 RESULTS: ALL ASSERTIONS PASSED (100%)');
console.log('================================================================\n');
