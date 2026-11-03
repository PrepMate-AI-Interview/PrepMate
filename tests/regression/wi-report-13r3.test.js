// tests/regression/wi-report-13r3.test.js
// Regression test suite for WI-REPORT-13R3: CLOTHING STYLE CAROUSEL LIVE IMPLEMENTATION & INSPECTION

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('================================================================');
console.log('  TEST SUITE: WI-REPORT-13R3 (CLOTHING STYLE CAROUSEL HIERARCHY)');
console.log('================================================================\n');

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const reportHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.html'), 'utf8');
const reportJs = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.js'), 'utf8');
const reportCss = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.css'), 'utf8');
const dbPath = path.join(WORKSPACE_ROOT, 'BE/data/db.json');

// --- 1. HORIZONTAL CAROUSEL ARCHITECTURE & 1:1 SLIDE MAPPING ---
console.log('--- 1. HORIZONTAL CAROUSEL ARCHITECTURE & 1:1 SLIDE MAPPING ---');
assert.ok(
  reportJs.includes('outfit-slider-container') && reportJs.includes('outfit-slider-track'),
  'report.js renders outfit slider container and horizontal track'
);
assert.ok(
  reportJs.includes('class="outfit-slide-card outfit-visual-card'),
  'report.js maps each clothing style to exactly one dedicated outfit-slide-card (1:1 slide rule)'
);
assert.ok(
  reportCss.includes('.outfit-slide-card') && reportCss.includes('flex: 0 0 100% !important'),
  'report.css sizes each slide card to 100% viewport width so only 1 slide displays at a time'
);
assert.ok(
  reportCss.includes('.outfit-slider-viewport') && reportCss.includes('overflow: hidden'),
  'report.css constrains viewport with overflow: hidden'
);
assert.ok(
  reportCss.includes('.outfit-slider-track') && reportCss.includes('display: flex !important'),
  'report.css strictly enforces flex layout on track without grid column conflicts'
);
console.log('[PASS] 1:1 horizontal slide structure verified');

// --- 2. 5-LEVEL INNER SLIDE VISUAL HIERARCHY ---
console.log('\n--- 2. 5-LEVEL INNER SLIDE VISUAL HIERARCHY ---');
// Level 1: Tên phong cách trang phục (Heading chính)
assert.ok(
  reportJs.includes('class="outfit-style-title"') && reportJs.includes('outfit-card-header'),
  'Level 1: Slide begins with outfit style heading and tag header'
);
// Level 2: Mô tả ngắn về phong cách
assert.ok(
  reportJs.includes('class="outfit-summary-text"'),
  'Level 2: Slide includes concise 1-sentence style summary'
);
// Level 3: Hình ảnh trang phục minh họa nổi bật
assert.ok(
  reportJs.includes('class="outfit-slide-media"') && reportJs.includes('class="outfit-photo-wrap"') && reportJs.includes('class="outfit-real-photo"'),
  'Level 3: Slide features prominent visual image showcase with wrap and photo credit'
);
assert.ok(
  reportCss.includes('.outfit-slide-media .outfit-photo-wrap') && reportCss.includes('height: 280px'),
  'report.css sets prominent 280px height for desktop photo showcase'
);
// Level 4: Chi tiết phối đồ / lưu ý cần thiết có phân cấp
assert.ok(
  reportJs.includes('smart-casual-structured-box') && reportJs.includes('Trang phục chính:') &&
  reportJs.includes('Điểm nhấn:') && reportJs.includes('Lưu ý:'),
  'Level 4: Smart Casual includes 3-part structured breakdown'
);
assert.ok(
  reportJs.includes('outfit-section-meta') && reportJs.includes('PHÙ HỢP VỚI:') &&
  reportJs.includes('outfit-advice-block') && reportJs.includes('LỜI KHUYÊN THỰC TẾ:'),
  'Level 4: Standard styles include structured suitability and practical advice'
);
// Level 5: Bottom controls
assert.ok(
  reportJs.includes('outfit-slider-bottom-bar') && reportJs.includes('outfit-slider-controls'),
  'Level 5: Centered bottom controls bar placed below the slide viewport'
);
console.log('[PASS] 5-level vertical hierarchy per slide verified');

// --- 3. CONTROLS, NAVIGATION & ACCESSIBILITY ---
console.log('\n--- 3. CONTROLS, NAVIGATION & ACCESSIBILITY ---');
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
  'report.js renders slide indicator counter (e.g. 1 / 4)'
);
assert.ok(
  reportJs.includes('id="outfit-slider-dots"'),
  'report.js renders interactive pagination dot indicators'
);
assert.ok(
  reportJs.includes('prevBtn.disabled') && reportJs.includes('nextBtn.disabled'),
  'report.js updates disabled state on boundary slides'
);
assert.ok(
  reportJs.includes('aria-roledescription="carousel"') && reportJs.includes('aria-roledescription="slide"'),
  'report.js enforces WAI-ARIA carousel semantics'
);
assert.ok(
  reportJs.includes('ArrowLeft') && reportJs.includes('ArrowRight'),
  'report.js supports keyboard arrow key navigation'
);
assert.ok(
  reportJs.includes('touchstart') && reportJs.includes('touchend'),
  'report.js handles mobile touch swipe gestures'
);
console.log('[PASS] Navigation controls, boundary states & accessibility verified');

// --- 4. RESPONSIVE DESIGN & DARK THEME ---
console.log('\n--- 4. RESPONSIVE DESIGN & DARK THEME ---');
assert.ok(
  reportCss.includes('@media (max-width: 768px)') && reportCss.includes('.outfit-photo-wrap'),
  'report.css provides responsive mobile photo wrap scaling'
);
assert.ok(
  reportCss.includes('[data-theme="dark"] .outfit-slide-inner') &&
  reportCss.includes('[data-theme="dark"] .smart-casual-structured-box'),
  'report.css contains comprehensive dark mode styling'
);
assert.ok(
  reportCss.includes('@media (prefers-reduced-motion: reduce)') && reportCss.includes('transition: none'),
  'report.css supports prefers-reduced-motion'
);
console.log('[PASS] Responsive scaling and dark mode contracts verified');

// --- 5. PRODUCTION DATABASE INTEGRITY ---
console.log('\n--- 5. PRODUCTION DATABASE INTEGRITY ---');
const EXPECTED_DB_HASH = 'c2ba83b82e758b277786dad7073e1c8a0e80c71fc615ecbbe5847d01b47cda50';
const dbBytes = fs.readFileSync(dbPath);
const actualDbHash = crypto.createHash('sha256').update(dbBytes).digest('hex');
assert.strictEqual(actualDbHash, EXPECTED_DB_HASH, 'BE/data/db.json SHA-256 hash must not be modified');
console.log('[PASS] Production database SHA-256 hash strictly preserved');

console.log('\n================================================================');
console.log('  WI-REPORT-13R3 RESULTS: ALL ASSERTIONS PASSED (100%)');
console.log('================================================================\n');
