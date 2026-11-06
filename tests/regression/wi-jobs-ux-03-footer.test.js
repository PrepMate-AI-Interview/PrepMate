/**
 * tests/regression/wi-jobs-ux-03-footer.test.js
 * Regression test suite for WI-JOBS-UX-03 — Job Card Footer Redesign & Action Hierarchy
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

console.log('=== Running WI-JOBS-UX-03 Footer Redesign & Action Hierarchy Tests ===');

const htmlPath = path.resolve(__dirname, '../../FE/features/jobs/jobs.html');
const cssPath = path.resolve(__dirname, '../../FE/features/jobs/jobs.css');
const dbPath = path.resolve(__dirname, '../../BE/data/db.json');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// 1. Line count constraints
it('jobs.html line count strictly < 800', () => {
  const lines = html.split('\n').length;
  assert.ok(lines < 800, `Expected < 800 lines, found ${lines}`);
});

it('jobs.css line count >= 700', () => {
  const lines = css.split('\n').length;
  assert.ok(lines >= 700, `Expected >= 700 lines, found ${lines}`);
});

// 2. Database hash invariant
it('BE/data/db.json SHA-256 integrity maintained', () => {
  if (fs.existsSync(dbPath)) {
    const dbBuf = fs.readFileSync(dbPath);
    const hash = crypto.createHash('sha256').update(dbBuf).digest('hex').toUpperCase();
    const EXPECTED_HASH = '44223D9B7E945E70CADEB3279AE3EE5A0DD748A867B2C3A6B0C5C617A9DB62C3';
    assert.strictEqual(hash, EXPECTED_HASH, `Database SHA-256 altered: got ${hash}`);
  }
});

// 3. HTML DOM Structure in renderJobCard
it('renderJobCard defines .job-card-footer with posted time and action group', () => {
  assert.ok(html.includes('<div class="job-card-footer">'), 'Footer container missing');
  assert.ok(html.includes('postedHtml'), 'postedHtml variable missing');
  assert.ok(html.includes('<div class="job-footer-actions card-actions-group">'), 'Actions group container missing');
});

it('Action hierarchy order in footer is Save -> Details -> Apply', () => {
  const footerActionBlock = html.substring(
    html.indexOf('<div class="job-footer-actions card-actions-group">'),
    html.indexOf('</div>\' +\n            \'</div>\' +\n        \'</div>\';')
  );
  assert.ok(footerActionBlock, 'Could not isolate footerActionBlock');
  
  const saveIdx = footerActionBlock.indexOf('btn-save-bookmark');
  const viewIdx = footerActionBlock.indexOf('btn-view-jd');
  const applyIdx = footerActionBlock.indexOf('applyBtn');

  assert.ok(saveIdx !== -1, 'Bookmark button not found');
  assert.ok(viewIdx !== -1, 'View JD button not found');
  assert.ok(applyIdx !== -1, 'Apply button reference not found');

  assert.ok(saveIdx < viewIdx, `Save (${saveIdx}) should come before View JD (${viewIdx})`);
  assert.ok(viewIdx < applyIdx, `View JD (${viewIdx}) should come before Apply (${applyIdx})`);
});

it('Bookmark button has correct accessible attributes and stopPropagation logic', () => {
  assert.ok(html.includes('class="btn-save-bookmark'), 'btn-save-bookmark class missing');
  assert.ok(html.includes('aria-label="\' + (isSaved ? \'Bỏ lưu tin tuyển dụng\' : \'Lưu tin tuyển dụng\')'), 'aria-label dynamic attribute missing');
  assert.ok(html.includes('title="\' + (isSaved ? \'Bỏ lưu tin tuyển dụng\' : \'Lưu tin tuyển dụng\')'), 'title tooltip missing');
  assert.ok(html.includes('saveJob(event, \\\'\' + safeId + \'\\\')') || html.includes('saveJob(event, \' + safeId + \')') || html.includes('saveJob(event'), 'saveJob call missing');
  assert.ok(html.includes('function saveJob(event, id)'), 'saveJob function definition missing');
  assert.ok(html.includes('if (event && event.stopPropagation) event.stopPropagation();'), 'stopPropagation missing in saveJob');
});

it('Secondary Action (Chi tiết JD) triggers openJobDetail with safeId', () => {
  assert.ok(html.includes("onclick=\"openJobDetail(\\'' + safeId + '\\')\""), 'openJobDetail call on View JD missing');
  assert.ok(html.includes('<span>Chi tiết JD</span>'), 'Chi tiết JD label missing');
});

it('Primary Action (Ứng tuyển / Apply) uses external target and noopener', () => {
  assert.ok(html.includes('target="_blank"'), 'target="_blank" missing on apply button');
  assert.ok(html.includes('rel="noopener noreferrer"'), 'rel="noopener noreferrer" missing on apply button');
  assert.ok(html.includes('btn-apply-link'), 'btn-apply-link class missing');
});

it('Posted time logic correctly formats "hôm nay", "1 ngày trước", "X ngày trước" without faking', () => {
  assert.ok(html.includes("job.postedDays === 0 ? 'hôm nay'"), 'hôm nay formatting missing');
  assert.ok(html.includes("job.postedDays === 1 ? '1 ngày trước'"), '1 ngày trước formatting missing');
  assert.ok(html.includes("job.postedDays + ' ngày trước'"), 'X ngày trước formatting missing');
  assert.ok(html.includes("job.postedDate ? new Date(job.postedDate)"), 'fallback date parsing present');
  assert.ok(html.includes('<div class="job-posted-time"></div>'), 'clean empty placeholder present when no date data exists');
});

// 4. CSS Styling rules
it('CSS styles .job-card-footer with flex, space-between, and top border', () => {
  assert.ok(css.includes('.job-card-footer'), '.job-card-footer class missing in CSS');
  assert.ok(css.includes('justify-content: space-between'), 'space-between missing in CSS');
  assert.ok(css.includes('border-top: 1px solid'), 'border-top missing in CSS');
});

it('CSS styles .btn-save-bookmark as 32x32px centered icon button', () => {
  assert.ok(css.includes('width: 32px;'), 'width: 32px missing for bookmark button');
  assert.ok(css.includes('height: 32px;'), 'height: 32px missing for bookmark button');
  assert.ok(css.includes('.btn-save-bookmark.saved'), 'saved state missing for bookmark button');
});

it('CSS styles .btn-view-jd as 32px outline button with balanced typography', () => {
  assert.ok(css.includes('.btn-view-jd'), '.btn-view-jd missing in CSS');
  assert.ok(css.includes('height: 32px'), 'height: 32px missing for .btn-view-jd');
  assert.ok(css.includes('font-weight: 500'), 'font-weight: 500 missing for .btn-view-jd');
});

it('CSS styles .btn-apply-link as prominent primary button with emerald background', () => {
  assert.ok(css.includes('.btn-apply-link'), '.btn-apply-link missing in CSS');
  assert.ok(css.includes('var(--prep-emerald'), 'prep-emerald missing for primary apply button');
  assert.ok(css.includes('color: #ffffff'), 'white text missing for primary apply button');
});

it('CSS provides responsive layout for mobile (<= 640px)', () => {
  assert.ok(css.includes('@media (max-width: 640px)'), 'Mobile media query missing');
  assert.ok(css.includes('flex-direction: column'), 'Column layout on mobile missing');
});

it('CSS includes Dark Mode enhancements for footer, buttons, and posted time', () => {
  assert.ok(css.includes('html[data-theme="dark"] .job-card-footer'), 'Dark mode footer missing');
  assert.ok(css.includes('html[data-theme="dark"] .btn-save-bookmark'), 'Dark mode bookmark missing');
  assert.ok(css.includes('html[data-theme="dark"] .btn-view-jd'), 'Dark mode view-jd missing');
  assert.ok(css.includes('html[data-theme="dark"] .btn-apply-link'), 'Dark mode apply-link missing');
  assert.ok(css.includes('html[data-theme="dark"] .job-posted-time'), 'Dark mode posted time missing');
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL WI-JOBS-UX-03 FOOTER REGRESSION CHECKS PASSED!');
}
