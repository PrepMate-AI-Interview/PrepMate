/**
 * PREPMATE — WI-REPORT-07 REGRESSION TEST SUITE
 * Report Navigation & Content Flow Optimization
 * 
 * Verifies:
 * 1. Strict sequence: 01 Tổng quan -> 02 Nhận xét -> 03 Phân tích -> 04 Đề xuất
 * 2. Question-by-question feedback appears before behavioral/voice/presentation analysis
 * 3. Step tags match: 01 (Tổng quan), 02 (Nhận xét), 03 (Phân tích), 04 (Đề xuất)
 * 4. Elimination of redundant navigation (hero-cta-action-row & during analysis notice banner removed from visible UI)
 * 5. WI-07G Scroll & Anchor Integrity (offset calculation, RAF execution, scroll-margin-top)
 * 6. Production db.json SHA-256 Invariant
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

console.log('===============================================================');
console.log('   WI-REPORT-07: NAVIGATION & CONTENT FLOW OPTIMIZATION       ');
console.log('===============================================================\n');

let totalChecks = 0;
let passedChecks = 0;

function check(title, fn) {
  totalChecks++;
  try {
    fn();
    console.log(`[PASS] ${title}`);
    passedChecks++;
  } catch (err) {
    console.error(`[FAIL] ${title}`);
    console.error(`       Error: ${err.message}`);
  }
}

const htmlPath = path.resolve(__dirname, '../../FE/features/report/report.html');
const jsPath = path.resolve(__dirname, '../../FE/features/report/report.js');
const cssPath = path.resolve(__dirname, '../../FE/features/report/report.css');
const dbPath = path.resolve(__dirname, '../../BE/data/db.json');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

// -------------------------------------------------------------
// GROUP 1: Primary Navigation Tab Sequence
// -------------------------------------------------------------
console.log('--- GROUP 1: Primary Navigation Tab Sequence ---');

check('1.1 Exactly 4 visible primary tabs in strict sequence (01 Tổng quan -> 02 Nhận xét -> 03 Phân tích -> 04 Đề xuất)', () => {
  const stageNavIdx = html.indexOf('class="report-stage-nav"');
  assert.ok(stageNavIdx !== -1, 'Stage nav container exists');
  const stageNavEnd = html.indexOf('</nav>', stageNavIdx);
  const navSlice = html.slice(stageNavIdx, stageNavEnd !== -1 ? stageNavEnd : stageNavIdx + 4000);

  const idx01 = navSlice.indexOf('id="phase-btn-overview"');
  const idx02 = navSlice.indexOf('id="phase-btn-feedback"');
  const idx03 = navSlice.indexOf('id="phase-btn-analysis"');
  const idx04 = navSlice.indexOf('id="phase-btn-recommendations"');

  assert.ok(idx01 !== -1, 'Tab 01 (Tổng quan) exists');
  assert.ok(idx02 !== -1, 'Tab 02 (Nhận xét) exists');
  assert.ok(idx03 !== -1, 'Tab 03 (Phân tích) exists');
  assert.ok(idx04 !== -1, 'Tab 04 (Đề xuất) exists');

  assert.ok(idx01 < idx02, 'Tab 01 (Tổng quan) precedes Tab 02 (Nhận xét)');
  assert.ok(idx02 < idx03, 'Tab 02 (Nhận xét) precedes Tab 03 (Phân tích)');
  assert.ok(idx03 < idx04, 'Tab 03 (Phân tích) precedes Tab 04 (Đề xuất)');
});

check('1.2 Tab numbered badges match 01, 02, 03, 04 in sequence', () => {
  const stageNavIdx = html.indexOf('class="report-stage-nav"');
  const stageNavEnd = html.indexOf('</nav>', stageNavIdx);
  const navSlice = html.slice(stageNavIdx, stageNavEnd !== -1 ? stageNavEnd : stageNavIdx + 4000);

  const b01 = navSlice.indexOf('>01</span>');
  const b02 = navSlice.indexOf('>02</span>');
  const b03 = navSlice.indexOf('>03</span>');
  const b04 = navSlice.indexOf('>04</span>');

  assert.ok(b01 !== -1 && b02 !== -1 && b03 !== -1 && b04 !== -1, 'All step badges present in nav');
  assert.ok(b01 < b02 && b02 < b03 && b03 < b04, 'Step numbers ordered strictly 01 < 02 < 03 < 04');
});

// -------------------------------------------------------------
// GROUP 2: Stage Panels & Content Ordering
// -------------------------------------------------------------
console.log('\n--- GROUP 2: Stage Panels & Content Ordering ---');

check('2.1 Panels sequence in DOM follows 01 Overview -> 02 Feedback -> 03 Analysis -> 04 Recommendations', () => {
  const pOverview = html.indexOf('id="stage-panel-overview"');
  const pFeedback = html.indexOf('id="stage-panel-feedback"');
  const pDuring = html.indexOf('id="stage-panel-during"');
  const pAfter = html.indexOf('id="stage-panel-after"');

  assert.ok(pOverview !== -1 && pFeedback !== -1 && pDuring !== -1 && pAfter !== -1, 'All 4 stage panels exist');
  assert.ok(pOverview < pFeedback, 'Overview panel precedes Feedback panel');
  assert.ok(pFeedback < pDuring, 'Feedback panel precedes During/Analysis panel');
  assert.ok(pDuring < pAfter, 'During/Analysis panel precedes After/Recommendations panel');
});

check('2.2 GIAI ĐOẠN headers align strictly with the stage numbers', () => {
  const fbIdx = html.indexOf('id="stage-panel-feedback"');
  const fbSlice = html.slice(fbIdx, fbIdx + 300);
  assert.ok(fbSlice.includes('GIAI ĐOẠN 02'), 'Feedback panel displays GIAI ĐOẠN 02');

  const durIdx = html.indexOf('id="stage-panel-during"');
  const durSlice = html.slice(durIdx, durIdx + 300);
  assert.ok(durSlice.includes('GIAI ĐOẠN 03'), 'Analysis panel displays GIAI ĐOẠN 03');

  const ovIdx = html.indexOf('id="stage-panel-overview"');
  const ovSlice = html.slice(ovIdx, ovIdx + 300);
  assert.ok(ovSlice.includes('GIAI ĐOẠN 01'), 'Overview panel displays GIAI ĐOẠN 01');

  const aftIdx = html.indexOf('id="stage-panel-after"');
  const aftSlice = html.slice(aftIdx, aftIdx + 300);
  assert.ok(aftSlice.includes('GIAI ĐOẠN 04'), 'Recommendations panel displays GIAI ĐOẠN 04');
});

// -------------------------------------------------------------
// GROUP 3: Elimination of Redundant Navigation (WI-07F)
// -------------------------------------------------------------
console.log('\n--- GROUP 3: Elimination of Redundant Navigation (WI-07F) ---');

check('3.1 Overview hero CTA action row eliminated from visible UI', () => {
  assert.ok(!html.includes('class="hero-cta-action-row"'), 'hero-cta-action-row removed from Overview');
});

check('3.2 Redundant analysis-to-feedback banner notice hidden from UI', () => {
  assert.ok(html.includes('analysis-to-feedback-box') && html.includes('display: none !important;'), 'analysis-to-feedback-box is visually suppressed');
});

// -------------------------------------------------------------
// GROUP 4: Scroll & Anchor Integrity (WI-07G)
// -------------------------------------------------------------
console.log('\n--- GROUP 4: Scroll & Anchor Integrity (WI-07G) ---');

check('4.1 report.js goToStage calculates exact sticky nav offset with double RAF/timeout', () => {
  assert.ok(js.includes('totalOffset = navbarHeight + navHeight + buffer'), 'totalOffset calculated dynamically');
  assert.ok(js.includes('stage-panel-feedback') && js.includes('stage-panel-during'), 'panelMap covers feedback and during');
  assert.ok(js.includes('prefersReducedMotion'), 'Accessible prefers-reduced-motion respected');
  assert.ok(js.includes('requestAnimationFrame'), 'requestAnimationFrame used for post-layout reflow anchor alignment');
});

check('4.2 CSS stage-main-header defines scroll-margin-top for sticky nav accommodation', () => {
  assert.ok(css.includes('.stage-main-header') && css.includes('scroll-margin-top: 148px;'), 'stage-main-header has scroll-margin-top: 148px');
});

// -------------------------------------------------------------
// GROUP 5: Production Database Invariant
// -------------------------------------------------------------
console.log('\n--- GROUP 5: Production Database Invariant ---');

check('5.1 Production db.json SHA-256 strictly invariant', () => {
  const EXPECTED_HASH = '44223d9b7e945e70cadeb3279ae3ee5a0dd748a867b2c3a6b0c5c617a9db62c3';
  const content = fs.readFileSync(dbPath);
  const actualHash = crypto.createHash('sha256').update(content).digest('hex').toLowerCase();

  assert.strictEqual(
    actualHash,
    EXPECTED_HASH,
    `Production db.json hash mismatch! Expected ${EXPECTED_HASH}, got ${actualHash}`
  );
});

console.log('\n===============================================================');
console.log(`TOTAL AUDIT CHECKS: ${totalChecks} | PASS: ${passedChecks} | FAIL: ${totalChecks - passedChecks}`);
console.log('===============================================================');

if (totalChecks - passedChecks > 0) {
  process.exit(1);
}
