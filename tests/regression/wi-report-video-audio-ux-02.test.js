/**
 * PREPMATE — WI-REPORT-VIDEO-AUDIO-UX-02 REGRESSION TEST SUITE
 * Report Analysis Localization, Video Highlights & Full Interview Audio
 *
 * Verifies:
 * 1. Phase 1: Localization Mapping SSOT (formatAssessmentLevel & formatPriorityLevel)
 * 2. Phase 2: Elimination of duplicate still snapshot gallery from UI
 * 3. Phase 3: Khoảnh khắc tác phong nổi bật (Video Highlights & Behavior Analysis)
 * 4. Phase 4: Bản ghi âm cuộc phỏng vấn (Full Interview Audio player & download)
 * 5. Phase 5: Design tokens, CSS layout & responsive behavior
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('===============================================================');
console.log('   WI-REPORT-VIDEO-AUDIO-UX-02: VIDEO, AUDIO & LOCALIZATION    ');
console.log('===============================================================\n');

const rootDir = path.resolve(__dirname, '../..');
const htmlPath = path.join(rootDir, 'FE', 'features', 'report', 'report.html');
const jsPath = path.join(rootDir, 'FE', 'features', 'report', 'report.js');
const cssPath = path.join(rootDir, 'FE', 'features', 'report', 'report.css');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

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
    throw err;
  }
}

// Setup lightweight VM sandbox for evaluating report.js functions
function createReportSandbox() {
  const store = new Map();
  const sandbox = {
    window: {},
    document: {
      getElementById: () => null,
      createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        classList: { add() {}, remove() {}, contains() { return false; } },
        setAttribute() {},
        querySelector: () => null,
        querySelectorAll: () => [],
        appendChild() {},
        style: {}
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
      body: { appendChild() {}, removeChild() {} }
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear()
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    URL: {
      createObjectURL: () => 'blob:mock-url',
      revokeObjectURL: () => {}
    },
    Audio: class {
      constructor() {
        this.src = '';
        this.currentTime = 0;
        this.duration = 10;
        this.volume = 1;
        this.muted = false;
      }
      play() { return Promise.resolve(); }
      pause() {}
      addEventListener() {}
    },
    console: { log() {}, warn() {}, error() {} }
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(js, sandbox);
  return sandbox;
}

// --------------------------------------------------------------------------
// GROUP 1: Phase 1 — Analysis Localization Mapping
// --------------------------------------------------------------------------
console.log('--- GROUP 1: Phase 1 — Analysis Localization Mapping ---');

check('1.1 formatAssessmentLevel function correctly maps all assessment levels to Vietnamese', () => {
  const sb = createReportSandbox();
  const fn = sb.formatAssessmentLevel;
  assert.strictEqual(typeof fn, 'function', 'formatAssessmentLevel is a function');
  assert.strictEqual(fn('STRONG'), 'Điểm mạnh');
  assert.strictEqual(fn('Strong'), 'Điểm mạnh');
  assert.strictEqual(fn('WEAK'), 'Cần cải thiện');
  assert.strictEqual(fn('Weak'), 'Cần cải thiện');
  assert.strictEqual(fn('MODERATE'), 'Mức độ trung bình');
  assert.strictEqual(fn('Middle'), 'Mức độ trung bình');
  assert.strictEqual(fn('GOOD'), 'Tốt');
  assert.strictEqual(fn('EXCELLENT'), 'Xuất sắc');
  assert.strictEqual(fn('NEEDS_IMPROVEMENT'), 'Cần cải thiện');
  assert.strictEqual(fn('UNASSESSED'), 'Chưa được đánh giá');
  assert.strictEqual(fn('NOT_ASSESSED'), 'Chưa được đánh giá');
  assert.strictEqual(fn('INSUFFICIENT_EVIDENCE'), 'Chưa đủ dữ liệu đánh giá');
  assert.strictEqual(fn('LIMITED'), 'Hạn chế');
});

check('1.2 formatPriorityLevel function correctly maps priority levels to Vietnamese', () => {
  const sb = createReportSandbox();
  const fn = sb.formatPriorityLevel;
  assert.strictEqual(typeof fn, 'function', 'formatPriorityLevel is a function');
  assert.strictEqual(fn('HIGH'), 'Cao');
  assert.strictEqual(fn('MEDIUM'), 'Trung bình');
  assert.strictEqual(fn('LOW'), 'Thấp');
  assert.strictEqual(fn('CRITICAL'), 'Nghiêm trọng');
});

check('1.3 Radar interpretation & Dimension details use localized assessment levels', () => {
  assert.ok(js.includes('formatAssessmentLevel(strongest.level)'), 'Radar strongest uses formatAssessmentLevel');
  assert.ok(js.includes('formatAssessmentLevel(weakest.level)'), 'Radar weakest uses formatAssessmentLevel');
  assert.ok(js.includes('formatAssessmentLevel(dim.level'), 'Dimension detail panel uses formatAssessmentLevel');
  assert.ok(js.includes('formatAssessmentLevel(d.level)'), 'Dimension card badges use formatAssessmentLevel');
});

// --------------------------------------------------------------------------
// GROUP 2: Phase 2 — Still Evidence Snapshots Removal
// --------------------------------------------------------------------------
console.log('\n--- GROUP 2: Phase 2 — Still Evidence Snapshots Removal ---');

check('2.1 #visual-snapshots-container is suppressed from UI display via inline style and CSS', () => {
  assert.ok(html.includes('id="visual-snapshots-container" style="display: none !important;" aria-hidden="true"'), 'Snapshots container has inline display:none and aria-hidden');
  assert.ok(css.includes('#visual-snapshots-container') && css.includes('display: none !important;'), 'CSS enforces display: none !important on snapshots container');
});

check('2.2 #visual-snapshots-container remains in DOM for backwards compatibility', () => {
  assert.ok(html.includes('id="visual-snapshots-container"'), 'id="visual-snapshots-container" exists in DOM');
  assert.ok(html.includes('id="visual-snapshots-gallery"'), 'id="visual-snapshots-gallery" exists in DOM');
});

// --------------------------------------------------------------------------
// GROUP 3: Phase 3 — Video Highlights & Behavior Analysis
// --------------------------------------------------------------------------
console.log('\n--- GROUP 3: Phase 3 — Video Highlights & Behavior Analysis ---');

check('3.1 Video Highlights container header is updated in report.html', () => {
  assert.ok(html.includes('Khoảnh Khắc Tác Phong Nổi Bật'), 'Header text is Khoảnh Khắc Tác Phong Nổi Bật');
  assert.ok(html.includes('id="video-moments-container"'), 'id="video-moments-container" exists');
  assert.ok(html.includes('id="video-moments-list"'), 'id="video-moments-list" exists');
  assert.ok(html.includes('id="video-moments-count-badge"'), 'id="video-moments-count-badge" exists');
});

check('3.2 renderVideoMomentsSection produces 2-column highlight cards with structured behavior analysis', () => {
  assert.ok(js.includes('pm-video-highlight-card'), 'pm-video-highlight-card class generated');
  assert.ok(js.includes('pm-highlight-grid'), 'pm-highlight-grid 2-column structure created');
  assert.ok(js.includes('pm-highlight-player-col'), 'pm-highlight-player-col player column exists');
  assert.ok(js.includes('pm-highlight-analysis-col'), 'pm-highlight-analysis-col analysis column exists');
  assert.ok(js.includes('Nhận xét tác phong phi ngôn ngữ:'), 'Behavior analysis item 1 present');
  assert.ok(js.includes('Tầm quan trọng trong phỏng vấn:'), 'Behavior analysis item 2 present');
  assert.ok(js.includes('Gợi ý cải thiện cụ thể:'), 'Behavior analysis item 3 present');
});

check('3.3 Video Highlights bounds capped at 3-5 representative moments', () => {
  assert.ok(js.includes('Math.min(5, Math.max(3, selectedItems.length))'), 'Caps display at 3 to 5 highlights');
});

// --------------------------------------------------------------------------
// GROUP 4: Phase 4 — Full Interview Audio Recording Replay & Download
// --------------------------------------------------------------------------
console.log('\n--- GROUP 4: Phase 4 — Full Interview Audio Recording Replay & Download ---');

check('4.1 Full interview audio container elements exist in report.html', () => {
  assert.ok(html.includes('id="full-interview-audio-card"'), 'id="full-interview-audio-card" present');
  assert.ok(html.includes('Bản Ghi Âm Toàn Bộ Buổi Phỏng Vấn'), 'Title present in card header');
  assert.ok(html.includes('id="full-audio-status-pill"'), 'id="full-audio-status-pill" present');
  assert.ok(html.includes('id="full-interview-audio-container"'), 'id="full-interview-audio-container" present');
});

check('4.2 checkSessionMediaAccess enforces authentication & session ownership rules', () => {
  const sb = createReportSandbox();
  const checkFn = sb.checkSessionMediaAccess;
  assert.strictEqual(typeof checkFn, 'function', 'checkSessionMediaAccess is a function');

  // Guest session
  assert.strictEqual(checkFn({ isGuestSession: true }).allowed, true, 'Guest session allowed');
  assert.strictEqual(checkFn({ userId: 'guest' }).allowed, true, 'Guest user allowed');

  // Admin access
  sb.localStorage.setItem('prepmate_current_user', JSON.stringify({ id: 'user_admin', role: 'admin' }));
  assert.strictEqual(checkFn({ userId: 'user_other' }).allowed, true, 'Admin has access');

  // Owner access
  sb.localStorage.setItem('prepmate_current_user', JSON.stringify({ id: 'user_123', role: 'user' }));
  assert.strictEqual(checkFn({ userId: 'user_123' }).allowed, true, 'Owner has access');

  // Other user access denied
  assert.strictEqual(checkFn({ userId: 'user_999' }).allowed, false, 'Non-owner denied');
});

check('4.3 renderFullInterviewAudioSection provides full playback controls, seek scrubber & download button', () => {
  assert.ok(js.includes('full-audio-player-widget'), 'Player widget created');
  assert.ok(js.includes('btn-full-audio-play'), 'Play button created');
  assert.ok(js.includes('btn-full-audio-prev'), 'Prev button created');
  assert.ok(js.includes('btn-full-audio-next'), 'Next button created');
  assert.ok(js.includes('full-audio-scrubber'), 'Scrubber slider created');
  assert.ok(js.includes('btn-download-full-audio'), 'Download button created');
  assert.ok(js.includes('Tải bản ghi âm'), 'Download button label is Tải bản ghi âm');
  assert.ok(js.includes('full-audio-playlist-chips'), 'Playlist chips for jumping turns created');
});

// --------------------------------------------------------------------------
// GROUP 5: Phase 5 — CSS & Responsive Design
// --------------------------------------------------------------------------
console.log('\n--- GROUP 5: Phase 5 — CSS & Responsive Design ---');

check('5.1 CSS definitions for 2-column video highlights grid and mobile stacking', () => {
  assert.ok(css.includes('.pm-highlight-grid'), '.pm-highlight-grid defined');
  assert.ok(css.includes('.full-interview-audio-card'), '.full-interview-audio-card defined');
  assert.ok(css.includes('.full-audio-player-widget'), '.full-audio-player-widget defined');
  assert.ok(css.includes('.btn-download-audio'), '.btn-download-audio defined');
  assert.ok(css.includes('@media (max-width: 768px)'), 'Mobile media queries present for highlight & audio controls');
});

check('5.2 Dark mode overrides defined for video highlights and full interview audio', () => {
  assert.ok(css.includes('html[data-theme="dark"] .pm-video-highlight-card'), 'Dark mode defined for highlight card');
  assert.ok(css.includes('html[data-theme="dark"] .full-interview-audio-card'), 'Dark mode defined for full audio card');
});

console.log('\n===============================================================');
console.log(`TOTAL AUDIT CHECKS: ${totalChecks} | PASS: ${passedChecks} | FAIL: 0`);
console.log('===============================================================');
