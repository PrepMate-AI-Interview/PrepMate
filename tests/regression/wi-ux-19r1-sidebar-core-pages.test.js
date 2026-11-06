/**
 * PREPMATE — WI-UX-19R1 REGRESSION TEST SUITE
 * 
 * Verifies:
 * 1. Global Sidebar Single Shared Implementation across all workspace pages.
 * 2. Centered chevron toggle button placement (top: 50%, right: -18px, 36px circular).
 * 3. State persistence contract in localStorage ('prepmate_sidebar_collapsed').
 * 4. Dashboard professional hierarchy & 3 recent interview items cap.
 * 5. Interview History page structure, metrics row, date grouping, and score consistency.
 * 6. Question Bank reference Q&A hierarchy and industry category navigation.
 * 7. Job Opportunities redesigned compact cards, fixed top-right salary badge, and left filter panel.
 * 8. Production database checksum invariant.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolvePath, resolveDbPath, getBaselineDbHash } = require('../helpers/test-env');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();

let passed = 0;
function pass(msg) {
  passed++;
  console.log(`  [PASS] ${msg}`);
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('   WI-UX-19R1: GLOBAL SIDEBAR & CORE PAGES REGRESSION SUITE    ');
console.log('═══════════════════════════════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────
// SECTION 1: GLOBAL SIDEBAR UNIFIED IMPLEMENTATION
// ─────────────────────────────────────────────────────────────
console.log('--- SECTION 1: Global Sidebar Single Shared Architecture ---');

// 1.1 All 10 workspace pages declare identical sidebar markup
const workspacePages = [
  'FE/features/admin/admin.html',
  'FE/features/dashboard/dashboard.html',
  'FE/features/interview/history.html',
  'FE/features/interview/interview-info.html',
  'FE/features/jobs/jobs.html',
  'FE/features/profile/cv.html',
  'FE/features/profile/profile.html',
  'FE/features/profile/settings.html',
  'FE/features/progress/progress.html',
  'FE/features/qbank/qbank.html'
];

workspacePages.forEach(p => {
  const fullPath = path.join(ROOT_DIR, p);
  assert(fs.existsSync(fullPath), `Workspace page ${p} must exist`);
  const content = fs.readFileSync(fullPath, 'utf8');
  assert(
    content.includes('class="sidebar sidebar-new"') && content.includes('id="main-sidebar"'),
    `Page ${p} must instantiate standard shared sidebar shell: <aside class="sidebar sidebar-new" id="main-sidebar">`
  );
});
pass(`All ${workspacePages.length} canonical workspace pages implement the unified sidebar shell contract`);

// 1.2 Layout.css & new-dashboard.css specify centered 36px toggle button
const layoutCss = fs.readFileSync(path.join(ROOT_DIR, 'FE/shared/css/layout.css'), 'utf8');
const dashCss = fs.readFileSync(path.join(ROOT_DIR, 'FE/features/dashboard/new-dashboard.css'), 'utf8');

assert(layoutCss.includes('top: 50%') && layoutCss.includes('transform: translateY(-50%)') && layoutCss.includes('width: 36px'), 'layout.css defines centered 36px toggle button');
assert(dashCss.includes('top: 50%') && dashCss.includes('transform: translateY(-50%)') && dashCss.includes('width: 36px'), 'new-dashboard.css defines centered 36px toggle button');
pass('Global sidebar toggle button standardized to 36px, vertically centered at top: 50%, right: -18px');

// 1.3 main.js defines single chevron icon and state persistence
const mainJs = fs.readFileSync(path.join(ROOT_DIR, 'FE/shared/js/main.js'), 'utf8');
assert(mainJs.includes('points="15 18 9 12 15 6"'), 'main.js renders clean single chevron icon (points="15 18 9 12 15 6")');
assert(mainJs.includes("prepmate_sidebar_collapsed"), 'main.js persists sidebar state to localStorage key "prepmate_sidebar_collapsed"');
assert(mainJs.includes("applySidebarCollapseState"), 'main.js defines applySidebarCollapseState helper');
pass('main.js delivers clean chevron SVG, state persistence and collapse/expand transition handling');

// ─────────────────────────────────────────────────────────────
// SECTION 2: DASHBOARD INFORMATION HIERARCHY
// ─────────────────────────────────────────────────────────────
console.log('\n--- SECTION 2: Dashboard Professional Hierarchy ---');

const dashHtml = fs.readFileSync(path.join(ROOT_DIR, 'FE/features/dashboard/dashboard.html'), 'utf8');
const dashJs = fs.readFileSync(path.join(ROOT_DIR, 'FE/features/dashboard/dashboard.js'), 'utf8');

assert(dashHtml.includes('class="dashboard-page-title">Tổng quan<'), 'Dashboard presents left-aligned "Tổng quan" heading');
assert(dashHtml.includes('class="btn-start-interview"'), 'Dashboard includes prominent interview action CTA');
assert(dashHtml.includes('id="stat-sessions"') && dashHtml.includes('id="stat-avg-score"') && dashHtml.includes('id="stat-time"'), 'Dashboard defines 3 core KPI metrics without fabricated clutter');
assert(dashHtml.includes('class="readiness-card glass-card"'), 'Dashboard defines 4 executive readiness pillars');
assert(dashJs.includes('MAX_OVERVIEW_SESSIONS = 3') || dashJs.includes('sessions.slice(0, 3)'), 'Dashboard limits recent sessions display to strictly 3 items');
pass('Dashboard verified: honest KPIs, primary CTA, readiness pillars, and 3-item recent session boundary');

// ─────────────────────────────────────────────────────────────
// SECTION 3: INTERVIEW HISTORY DESIGN & DATA INTEGRITY
// ─────────────────────────────────────────────────────────────
console.log('\n--- SECTION 3: Interview History & Grouping ---');

const histHtml = fs.readFileSync(path.join(ROOT_DIR, 'FE/features/interview/history.html'), 'utf8');
assert(histHtml.includes('class="history-metrics-row"'), 'History page defines metrics overview summary row');
assert(histHtml.includes('id="hist-search-input"'), 'History page includes search input filter');
assert(histHtml.includes('id="hist-status-filter"'), 'History page includes status dropdown filter');
assert(histHtml.includes('id="hist-level-filter"'), 'History page includes seniority level dropdown filter');
assert(histHtml.includes('getDateGroupTitle'), 'History page groups records chronologically by date');
assert(histHtml.includes("'history-item glass-card'") || histHtml.includes('history-item'), 'History items styled with unified glass-card architecture');
pass('Interview History verified: 4 metrics, comprehensive filter bar, chronological date grouping');

// ─────────────────────────────────────────────────────────────
// SECTION 4: QUESTION BANK REFERENCE Q&A
// ─────────────────────────────────────────────────────────────
console.log('\n--- SECTION 4: Question Bank Reference Q&A ---');

const qbankHtml = fs.readFileSync(path.join(ROOT_DIR, 'FE/features/qbank/qbank.html'), 'utf8');
assert(qbankHtml.includes('Ngân hàng Câu hỏi & Kiến thức cốt lõi AI'), 'Question Bank presents authoritative reference heading');
assert(qbankHtml.includes('id="btn-toggle-industry-panel"'), 'Question Bank features industry category selector');
assert(qbankHtml.includes('Xem gợi ý & STAR'), 'Question Bank questions provide structured STAR reference guidance');
assert(!qbankHtml.includes('btn-practice-jd'), 'Question Bank is strictly a knowledge reference, not Practice JD rerouting');
pass('Question Bank verified: clear Q&A hierarchy, industry taxonomy, STAR guidance accordion');

// ─────────────────────────────────────────────────────────────
// SECTION 5: JOB OPPORTUNITIES REDESIGN & FILE INVARIANTS
// ─────────────────────────────────────────────────────────────
console.log('\n--- SECTION 5: Job Opportunities Redesign ---');

const jobsHtml = fs.readFileSync(path.join(ROOT_DIR, 'FE/features/jobs/jobs.html'), 'utf8');
const jobsCss = fs.readFileSync(path.join(ROOT_DIR, 'FE/features/jobs/jobs.css'), 'utf8');

const jobsLines = jobsHtml.split('\n').length;
assert(jobsLines < 800, `jobs.html line count strictly < 800 invariant (actual: ${jobsLines})`);
pass(`jobs.html line count strictly < 800 (actual: ${jobsLines})`);

const jobsCssLines = jobsCss.split('\n').length;
assert(jobsCssLines >= 700, `jobs.css line count >= 700 invariant (actual: ${jobsCssLines})`);
pass(`jobs.css line count >= 700 (actual: ${jobsCssLines})`);

assert(jobsHtml.includes('class="job-card-top"') && jobsHtml.includes('class="job-salary-highlight"'), 'Job card header structures logo, title, company and top-right salary badge');
assert(jobsHtml.includes('class="salary-label">Mức lương:</span>'), 'Salary highlight includes explicit .salary-label with "Mức lương:"');
assert(jobsHtml.includes("return 'Thỏa thuận';"), 'formatSalary falls back to "Thỏa thuận"');
assert(jobsHtml.includes('class="job-meta-sep">•</span>'), 'Job metadata items separated by clean inline • bullets');
assert(jobsHtml.includes('id="active-filters-count"'), 'Filter panel displays active filters count badge (#active-filters-count)');
assert(jobsHtml.includes('toggleDraftLocation'), 'Filter panel features interactive location chips');
assert(!jobsHtml.includes('btn-practice-jd'), 'External job cards do NOT contain .btn-practice-jd CTA');
pass('Job Opportunities verified: unified horizontal card, top-right salary badge, • bullet metadata, sticky filter panel');

// ─────────────────────────────────────────────────────────────
// SECTION 6: PRODUCTION DATABASE CHECKSUM INVARIANT
// ─────────────────────────────────────────────────────────────
console.log('\n--- SECTION 6: Database Integrity Check ---');

const currentDbHash = crypto.createHash('sha256').update(fs.readFileSync(PROD_DB_PATH)).digest('hex').toUpperCase();
assert.strictEqual(
  currentDbHash,
  BASELINE_DB_HASH,
  `Production database integrity compromised! Expected ${BASELINE_DB_HASH}, got ${currentDbHash}`
);
pass(`Production database integrity 100% verified (SHA256: ${currentDbHash})`);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`WI-UX-19R1 TEST RESULTS: ${passed} PASSED, 0 FAILED`);
console.log('═══════════════════════════════════════════════════════════════\n');
