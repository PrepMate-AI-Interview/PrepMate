/**
 * PREPMATE — WI-REPORT-09 REGRESSION TEST SUITE
 * Report Visual Hierarchy & Interactive Assessment Optimization
 * 
 * Verifies:
 * 1. WI-09A: Floating Sticky Navigation Capsule & Responsive Single-Row Layout
 * 2. WI-09B: Recommendations Whitespace Elimination (Compact Padding/Margins)
 * 3. WI-09C: Two-Row Question Feedback Header & Full Answer Verbatim Display
 * 4. WI-09D: Interactive 6-Dimension Competency Analysis & Detail Inspector
 * 5. Production db.json SHA-256 Invariant
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

console.log('===============================================================');
console.log('   WI-REPORT-09: VISUAL HIERARCHY & INTERACTIVE ASSESSMENT     ');
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
// GROUP 1: Floating Sticky Navigation Capsule (WI-09A)
// -------------------------------------------------------------
console.log('--- GROUP 1: Floating Sticky Navigation Capsule (WI-09A) ---');

check('1.1 Navigation defined as floating sticky capsule with top: 74px and 14px breathing gap', () => {
  assert.ok(css.includes('top: 74px;'), 'CSS defines top: 74px for desktop floating nav');
  assert.ok(css.includes('backdrop-filter: blur(12px);') || css.includes('backdrop-filter: blur('), 'Glassmorphism backdrop-filter enabled');
  assert.ok(css.includes('border-radius: 14px;') || css.includes('border-radius: 12px;'), 'Capsule border-radius defined');
});

check('1.2 Dark Mode styling defined for floating navigation capsule', () => {
  assert.ok(css.includes('[data-theme="dark"] .report-stage-nav'), 'Dark theme override defined for report-stage-nav');
});

check('1.3 Responsive single-row layout preserved across mobile without vertical multi-row wrap', () => {
  assert.ok(css.includes('flex-direction: row !important;'), 'Mobile stage-tabs-wrap enforces single-row flex-direction');
  assert.ok(css.includes('overflow-x: auto !important;'), 'Mobile stage-tabs-wrap allows horizontal scroll when needed');
  assert.ok(css.includes('flex-wrap: nowrap !important;'), 'Mobile stage-tabs-wrap prevents wrapping into vertical stack');
});

check('1.4 goToStage offset includes buffer for floating nav clearance', () => {
  assert.ok(js.includes('const buffer = 36;'), 'Buffer configured for floating nav gap clearance');
  assert.ok(js.includes('totalOffset = navbarHeight + navHeight + buffer'), 'totalOffset dynamically calculated');
});

check('1.5 Navigation expanded to 100% full content width with enlarged 46px buttons (WI-09R1B)', () => {
  assert.ok(css.includes('.stage-nav-container') && css.includes('max-width: 100%;'), 'stage-nav-container max-width expanded to 100%');
  assert.ok(css.includes('.stage-tabs-wrap') && css.includes('max-width: 100%;'), 'stage-tabs-wrap max-width expanded to 100%');
  assert.ok(css.includes('min-height: 46px;') && css.includes('height: 46px;'), 'stage-tab-btn height enlarged to 46px');
  assert.ok(css.includes('font-size: 14.5px;'), 'stage-tab-btn font size enlarged to 14.5px');
});

// -------------------------------------------------------------
// GROUP 2: Recommendations Section Whitespace Elimination (WI-09B)
// -------------------------------------------------------------
console.log('\n--- GROUP 2: Recommendations Section Whitespace Elimination (WI-09B) ---');

check('2.1 Roadmap and recommendations containers have compact, content-proportional margins', () => {
  assert.ok(css.includes('#stage-panel-after #section-roadmap'), 'Compact roadmap section styling targeted');
  assert.ok(css.includes('#stage-panel-after .improvement-overall-assessment-box'), 'Compact overall assessment box spacing targeted');
  assert.ok(css.includes('#stage-panel-after .after-interview-guidance-box'), 'Compact guidance box spacing targeted');
  assert.ok(css.includes('#stage-panel-after .supplementary-ecosystem-section'), 'Compact ecosystem section spacing targeted');
});

check('2.2 All required recommendation components remain present and intact', () => {
  assert.ok(html.includes('id="roadmap-overall-assessment-box"'), 'Overall assessment box present');
  assert.ok(html.includes('id="roadmap-weakness-priorities-wrap"'), 'Weakness priorities wrap present');
  assert.ok(html.includes('id="roadmap-items-grid"'), 'Roadmap items grid present');
  assert.ok(html.includes('id="after-interview-questions-box"'), 'Employer/interviewer guidance box present');
  assert.ok(html.includes('id="section-supplementary-ecosystem"'), 'Supplementary ecosystem present');
});

check('2.3 Obsolete placeholder div roadmap-items-placeholder-hidden is eliminated (WI-09R1C)', () => {
  assert.ok(!html.includes('roadmap-items-placeholder-hidden'), 'Empty placeholder div roadmap-items-placeholder-hidden is removed');
});

check('2.4 Recommendations panel strictly contained inside stages-viewport with zero reserved height (WI-09R2)', () => {
  const vpStart = html.indexOf('<div class="stages-viewport" id="stages-viewport">');
  const vpEnd = html.indexOf('</div> <!-- /stages-viewport -->');
  const afterPanelIdx = html.indexOf('id="stage-panel-after"');

  assert.ok(vpStart !== -1, 'stages-viewport must exist in HTML');
  assert.ok(vpEnd !== -1, 'stages-viewport closing tag must exist in HTML');
  assert.ok(afterPanelIdx > vpStart && afterPanelIdx < vpEnd, 'stage-panel-after must be strictly enclosed inside stages-viewport');
  assert.ok(css.includes('.stages-viewport') && (css.includes('min-height: 0;') || css.includes('min-height: auto;')), 'stages-viewport min-height must be 0 to avoid reserved blank space');
});

// -------------------------------------------------------------
// GROUP 3: Two-Row Question Feedback Header & Full Answer (WI-09C)
// -------------------------------------------------------------
console.log('\n--- GROUP 3: Two-Row Question Feedback Header & Full Answer (WI-09C) ---');

check('3.1 Question header structured in two-row hierarchy (Row 1: Metadata, Row 2: Question)', () => {
  assert.ok(js.includes('qfb-header-meta-row'), 'Row 1: qfb-header-meta-row rendered');
  assert.ok(js.includes('qfb-header-question-row'), 'Row 2: qfb-header-question-row rendered');
  assert.ok(css.includes('.qfb-header-meta-row'), 'CSS defines .qfb-header-meta-row');
  assert.ok(css.includes('.qfb-header-question-row'), 'CSS defines .qfb-header-question-row');
});

check('3.2 Question title placed on dedicated full-width line with natural wrapping', () => {
  assert.ok(css.includes('.qfb-header-question-row .qfb-question-title') || css.includes('.qfb-card-header .qfb-question-title'), 'Question title styled for dedicated row');
  assert.ok(js.includes('<h4 class="qfb-question-title">${escapeHtml(questionText)}</h4>'), 'Title rendered inside row 2');
});

check('3.3 Original candidate answer displayed verbatim without truncation, slice or ellipsis', () => {
  assert.ok(!js.includes('rawAnswer.slice(0,'), 'No slice truncation applied to candidate answer');
  assert.ok(!js.includes('rawAnswer.substr('), 'No substring truncation applied');
  assert.ok(css.includes('.qfb-answer-text') && css.includes('white-space: pre-wrap;'), 'Verbatim whitespace preserved with pre-wrap');
});

check('3.4 Single-open accordion collapses other cards upon selecting a new question', () => {
  assert.ok(js.includes('allCards.forEach('), 'Closes other cards on expand');
  assert.ok(js.includes('!isCurrentlyExpanded'), 'Toggles card closed on second click');
});

// -------------------------------------------------------------
// GROUP 4: Interactive 6-Dimension Competency Analysis (WI-09D)
// -------------------------------------------------------------
console.log('\n--- GROUP 4: Interactive 6-Dimension Competency Analysis (WI-09D) ---');

check('4.1 All 6 canonical dimensions covered in standard order', () => {
  assert.ok(js.includes('"TECHNICAL_KNOWLEDGE"'), 'TECHNICAL_KNOWLEDGE dimension defined');
  assert.ok(js.includes('"PRACTICAL_APPLICATION"'), 'PRACTICAL_APPLICATION dimension defined');
  assert.ok(js.includes('"REASONING_DEPTH"'), 'REASONING_DEPTH dimension defined');
  assert.ok(js.includes('"FOLLOW_UP_HANDLING"'), 'FOLLOW_UP_HANDLING dimension defined');
  assert.ok(js.includes('"COMMUNICATION"'), 'COMMUNICATION dimension defined');
  assert.ok(js.includes('"CONSISTENCY"'), 'CONSISTENCY dimension defined');
});

check('4.2 Horizontal comparison cards are interactive and selectable (role="tab", onclick, onkeydown)', () => {
  assert.ok(js.includes('selectCompetencyDimension('), 'selectCompetencyDimension function implemented');
  assert.ok(js.includes('role="tab"'), 'role="tab" defined on dimension card for accessible navigation');
  assert.ok(js.includes('aria-selected='), 'aria-selected dynamically updated based on selection');
  assert.ok(js.includes('aria-controls="dim-selected-detail-panel"'), 'aria-controls links cards to detail inspector');
});

check('4.3 Dedicated Detail Inspector Panel renders structured 5-part assessment for selected dimension', () => {
  assert.ok(js.includes('id="dim-selected-detail-panel"'), 'dim-selected-detail-panel rendered');
  assert.ok(js.includes('renderDimensionDetailPanel('), 'renderDimensionDetailPanel implemented');
  assert.ok(js.includes('Nhận Định Quan Sát Thực Tế'), 'Part 1: Observation/rationale block rendered');
  assert.ok(js.includes('Điểm Mạnh Đã Kiểm Chứng'), 'Part 2: Observed strengths block rendered');
  assert.ok(js.includes('Điểm Cần Chú Ý & Hoàn Thiện'), 'Part 3: Observed weaknesses/gaps block rendered');
  assert.ok(js.includes('Định Hướng Phát Triển & Hành Động'), 'Part 4: Actionable development guidance rendered');
});

check('4.4 Honest unassessed state and 0-100 score standardization preserved', () => {
  assert.ok(js.includes('Chưa đánh giá trong phiên'), 'Honest unassessed label displayed');
  assert.ok(js.includes('normalizeScoreTo100'), 'Standardized 0-100 score normalization used');
  assert.ok(js.includes('dim-progress-track') && js.includes('dim-progress-fill'), 'Progress track and fill indicators rendered');
});

check('4.5 Backward compatibility hooks preserved for legacy test contracts', () => {
  assert.ok(js.includes('dim-details-panel dim-panel-collapsed'), 'dim-details-panel dim-panel-collapsed preserved in DOM');
  assert.ok(js.includes('toggleDimensionDetails'), 'toggleDimensionDetails function preserved');
  assert.ok(js.includes('toggleAllDimensions'), 'toggleAllDimensions function preserved');
});

check('4.6 Six-axis interactive Radar Chart container and DOM elements present (WI-09R1A)', () => {
  assert.ok(html.includes('id="radar-analysis-container"'), 'radar-analysis-container present in report.html');
  assert.ok(html.includes('id="radar-chart-card"'), 'radar-chart-card present');
  assert.ok(html.includes('id="radar-svg-wrapper"'), 'radar-svg-wrapper present');
  assert.ok(html.includes('id="radar-legend"'), 'radar-legend present with score and benchmark dots');
  assert.ok(html.includes('id="radar-interpretation-card"'), 'radar-interpretation-card present');
  assert.ok(html.includes('id="radar-highlight-boxes"'), 'radar-highlight-boxes present');
});

check('4.7 Vanilla SVG Radar Chart rendering and interpretation functions implemented (WI-09R1A)', () => {
  assert.ok(js.includes('function renderRadarChart('), 'renderRadarChart function implemented');
  assert.ok(js.includes('function renderRadarInterpretation('), 'renderRadarInterpretation function implemented');
  assert.ok(js.includes('radar-grid-ring'), 'Concentric grid rings rendered in SVG');
  assert.ok(js.includes('radar-target-polygon'), 'Benchmark target polygon rendered at score 75');
  assert.ok(js.includes('radar-score-polygon'), 'Candidate score polygon rendered connecting vertices');
  assert.ok(js.includes('selectCompetencyDimension('), 'Vertex dots and axes trigger dimension selection');
});

check('4.8 Radar Chart styles and Dark Mode overrides defined (WI-09R1A)', () => {
  assert.ok(css.includes('.radar-analysis-container'), 'radar-analysis-container grid layout defined');
  assert.ok(css.includes('.radar-score-polygon'), 'radar-score-polygon styling defined');
  assert.ok(css.includes('.radar-score-dot'), 'radar-score-dot styling defined');
  assert.ok(css.includes('[data-theme="dark"] .radar-chart-card') || css.includes('[data-theme="dark"] .radar-score-polygon'), 'Dark mode overrides defined for radar chart');
});

// -------------------------------------------------------------
// GROUP 5: Production Database Invariant
// -------------------------------------------------------------
console.log('\n--- GROUP 5: Production Database Invariant ---');

check('5.1 Production db.json SHA-256 strictly invariant', () => {
  const EXPECTED_HASH = 'c2ba83b82e758b277786dad7073e1c8a0e80c71fc615ecbbe5847d01b47cda50';
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
