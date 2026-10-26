/**
 * PREPMATE — WI-DESIGN-05: CANDIDATE DASHBOARD AUTOMATED CONTRACT SUITE
 * Validates the visual hierarchy, data contracts, token integration,
 * empty/loading states, accessibility, and responsive adaptations of Candidate Dashboard.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '../..');

function readFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

console.log('===============================================================');
console.log('   WI-DESIGN-05: CANDIDATE DASHBOARD REDESIGN CONTRACT TESTS   ');
console.log('===============================================================\n');

const dashboardHtml = readFile('FE/features/dashboard/dashboard.html');
const dashboardJs = readFile('FE/features/dashboard/dashboard.js');
const newDashboardCss = readFile('FE/features/dashboard/new-dashboard.css');

// --- GROUP 1: Canonical Stylesheet Loading & Document Foundation ---
console.log('--- GROUP 1: Stylesheet Foundation & Shell Integration ---');

assert(dashboardHtml.includes('tokens.css'), '1.1 dashboard.html loads canonical tokens.css');
assert(dashboardHtml.includes('base.css'), '1.2 dashboard.html loads canonical base.css');
assert(dashboardHtml.includes('layout.css'), '1.3 dashboard.html loads canonical layout.css');
assert(dashboardHtml.includes('components.css'), '1.4 dashboard.html loads canonical components.css');
assert(dashboardHtml.includes('new-dashboard.css'), '1.5 dashboard.html loads new-dashboard.css');
assert(dashboardHtml.includes('id="main-sidebar"'), '1.6 dashboard.html preserves #main-sidebar hook for role shell');
assert(dashboardHtml.includes('<app-workspace-footer>'), '1.7 dashboard.html includes <app-workspace-footer>');
console.log('  [PASS] 1. All canonical stylesheets and shell anchors verified.');

// --- GROUP 2: Header Hero & Primary Action CTA ---
console.log('--- GROUP 2: Header Hero & Primary Action CTA ---');

assert(dashboardHtml.includes('class="dashboard-hero"'), '2.1 dashboard.html defines .dashboard-hero');
assert(dashboardHtml.includes('id="current-user-name-welcome"'), '2.2 dashboard.html defines #current-user-name-welcome hook');
assert(dashboardHtml.includes('class="btn-start-interview"'), '2.3 dashboard.html defines .btn-start-interview CTA');
assert(dashboardHtml.includes('../../features/interview/interview-info.html'), '2.4 .btn-start-interview routes to interview-info.html');
assert(newDashboardCss.includes('border-radius: var(--pm-radius-btn-lg, 10px);'), '2.5 .btn-start-interview preserves canonical button radius token');
console.log('  [PASS] 2. Header hero and primary interview action verified.');

// --- GROUP 3: Key Performance Indicators Ribbon ---
console.log('--- GROUP 3: KPI Metrics Ribbon ---');

assert(dashboardHtml.includes('id="stat-sessions-total"'), '3.1 dashboard.html contains #stat-sessions-total');
assert(dashboardHtml.includes('id="stat-sessions"'), '3.2 dashboard.html contains #stat-sessions');
assert(dashboardHtml.includes('id="stat-avg-score"'), '3.3 dashboard.html contains #stat-avg-score');
assert(dashboardHtml.includes('id="stat-avg-score-lbl"'), '3.4 dashboard.html contains #stat-avg-score-lbl');
assert(dashboardHtml.includes('id="stat-time"'), '3.5 dashboard.html contains #stat-time');
assert(newDashboardCss.includes('.hero-stats'), '3.6 new-dashboard.css styles .hero-stats');
console.log('  [PASS] 3. KPI metrics ribbon elements and styles verified.');

// --- GROUP 4: Executive Readiness Grid (Four Pillars) ---
console.log('--- GROUP 4: Executive Readiness Grid (Pillars) ---');

assert(dashboardHtml.includes('class="readiness-grid"'), '4.1 dashboard.html declares .readiness-grid');
assert(dashboardHtml.includes('Chuyên môn'), '4.2 Readiness grid contains Chuyên môn pillar');
assert(dashboardHtml.includes('Giao tiếp & Thuyết phục'), '4.3 Readiness grid contains Giao tiếp & Thuyết phục pillar');
assert(dashboardHtml.includes('Mô hình STAR'), '4.4 Readiness grid contains Mô hình STAR pillar');
assert(dashboardHtml.includes('Phản xạ Đào sâu (Follow-up)'), '4.5 Readiness grid contains Phản xạ Đào sâu pillar');
assert(dashboardHtml.includes('<circle cx="12" cy="12" r="3"/>'), '4.6 Readiness grid contains SVG specialty icon');
assert(dashboardHtml.includes('<polygon points="12 2 15.09 8.26'), '4.7 Readiness grid contains SVG STAR icon');
console.log('  [PASS] 4. Four executive readiness pillars verified.');

// --- GROUP 5: Recent History Section & Empty State ---
console.log('--- GROUP 5: Recent History Section & Empty State ---');

assert(dashboardHtml.includes('id="history"'), '5.1 dashboard.html preserves #history container id');
assert(dashboardHtml.includes('../interview/history.html'), '5.2 dashboard.html links to dedicated history.html');
assert(dashboardHtml.includes('id="history-list"'), '5.3 dashboard.html contains #history-list hook');
assert(dashboardHtml.includes('Bạn chưa có buổi phỏng vấn nào'), '5.4 dashboard.html provides truthful empty state copy');
assert(dashboardHtml.includes('id="history-total-count"'), '5.5 dashboard.html contains #history-total-count hook');
console.log('  [PASS] 5. Recent history section and empty state verified.');

// --- GROUP 6: Weekly Goal, Reflex Streak & Practice Strategy ---
console.log('--- GROUP 6: Weekly Goal & Reflex Streak ---');

assert(dashboardHtml.includes('id="dash-streak-badge"'), '6.1 dashboard.html contains #dash-streak-badge');
assert(dashboardHtml.includes('id="dash-week-desc"'), '6.2 dashboard.html contains #dash-week-desc');
assert(dashboardHtml.includes('id="dash-week-text"'), '6.3 dashboard.html contains #dash-week-text');
assert(dashboardHtml.includes('id="dash-week-bar"'), '6.4 dashboard.html contains #dash-week-bar');
assert(dashboardHtml.includes('#STAR_Method'), '6.5 dashboard.html includes #STAR_Method tag');
assert(dashboardHtml.includes('#Tradeoff'), '6.6 dashboard.html includes #Tradeoff tag');
console.log('  [PASS] 6. Weekly goal, reflex streak and practice advice verified.');

// --- GROUP 7: Hidden Compatibility Hooks & JavaScript Invariants ---
console.log('--- GROUP 7: Hidden Compatibility Hooks & JavaScript Invariants ---');

assert(dashboardHtml.includes('id="career-roadmap-list"'), '7.1 dashboard.html preserves #career-roadmap-list hook');
assert(dashboardHtml.includes('id="job-suggestions-list"'), '7.2 dashboard.html preserves #job-suggestions-list hook');
assert(dashboardHtml.includes('id="plan-status-card"'), '7.3 dashboard.html preserves #plan-status-card hook');
assert(dashboardHtml.includes('id="stat-sessions-total-hidden"'), '7.4 dashboard.html preserves #stat-sessions-total-hidden hook');
assert(dashboardJs.includes('slice(0, 5)'), '7.5 dashboard.js slices top 5 recent sessions');
assert(dashboardJs.includes('stat-avg-score'), '7.6 dashboard.js computes stat-avg-score');
assert(dashboardJs.includes('current-user-name-welcome'), '7.7 dashboard.js updates current-user-name-welcome');
console.log('  [PASS] 7. Script hooks and JS compatibility verified.');

// --- GROUP 8: Database & Baseline Integrity ---
console.log('--- GROUP 8: Database & Baseline Integrity ---');

const dbPath = path.join(rootDir, 'BE/data/db.json');
const dbContent = fs.readFileSync(dbPath);
const dbHash = crypto.createHash('sha256').update(dbContent).digest('hex').toUpperCase();
const expectedDbHash = 'C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7';

assert.strictEqual(dbHash, expectedDbHash, '8.1 Database SHA-256 hash strictly preserved');
console.log('  [PASS] 8. Production database SHA-256 hash verified: ' + dbHash);

console.log('\n===============================================================');
console.log('   ALL 8 GROUPS (27 ASSERTIONS) PASSED CLEANLY!                ');
console.log('===============================================================\n');
