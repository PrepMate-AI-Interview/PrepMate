/**
 * PREPMATE — WI-UX-20 REGRESSION TEST SUITE
 * Global Navigation Duplication Removal & Full-Page UI Cleanup
 *
 * Verifies:
 * 1. jobs.html: Complete removal of duplicate .jobs-breadcrumb (Tổng quan / Chuẩn bị / Cơ hội việc làm).
 * 2. jobs.html: Elimination of redundant decorative .jobs-header-badge.
 * 3. jobs.html: Title standardized to "Cơ hội việc làm" matching Sidebar.
 * 4. jobs.html: Preserves all functional components (search dock, filter panel, toolbar tabs, external search hub).
 * 5. jobs.html: Enforces strict line count constraint < 800.
 * 6. interview-info.html: Complete removal of redundant .chamber-breadcrumb.
 * 7. interview-info.html: Preserves functional 4-step wizard stepper (.setup-stepper-nav).
 * 8. company-intelligence.html: Complete removal of duplicate .company-breadcrumb while retaining primary header back button.
 * 9. Cross-page Navigation Consistency: Core pages rely on Global Sidebar as the single primary navigation.
 * 10. Design System & CSS Invariants: jobs.css maintains >= 700 lines.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..', '..');
let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

console.log('===============================================================');
console.log('   WI-UX-20: GLOBAL NAVIGATION DUPLICATION REMOVAL AUDIT     ');
console.log('===============================================================\n');

// 1. JOBS.HTML VERIFICATION
console.log('--- 1. Job Opportunities (jobs.html) ---');
const jobsHtmlPath = path.join(rootDir, 'FE', 'features', 'jobs', 'jobs.html');
assert.ok(fs.existsSync(jobsHtmlPath), 'jobs.html exists');
const jobsHtml = fs.readFileSync(jobsHtmlPath, 'utf8');
const jobsLines = jobsHtml.split('\n').length;

check(!jobsHtml.includes('jobs-breadcrumb'), 'jobs.html has completely removed .jobs-breadcrumb');
check(!jobsHtml.includes('Tổng quan</a><span class="sep">/</span><span>Chuẩn bị</span>'), 'jobs.html has no redundant breadcrumb path');
check(!jobsHtml.includes('jobs-header-badge'), 'jobs.html has removed redundant .jobs-header-badge');
check(!jobsHtml.includes('Thị trường Tuyển dụng & Xu hướng Kỹ năng'), 'jobs.html has no multi-layered decorative badge');
check(jobsHtml.includes('<h1 class="jobs-page-title">Cơ hội việc làm</h1>'), 'jobs.html title standardized to "Cơ hội việc làm" matching Sidebar');
check(jobsHtml.includes('id="main-sidebar"'), 'jobs.html retains Global Sidebar container');
check(jobsHtml.includes('jobs-search-dock'), 'jobs.html retains search dock contextual controls');
check(jobsHtml.includes('id="jobs-sidebar-filters"'), 'jobs.html retains left filter sidebar');
check(jobsHtml.includes('class="jobs-tabs"'), 'jobs.html retains local tab navigation (All vs Saved)');
check(jobsHtml.includes('id="external-search-hub"'), 'jobs.html retains external search deep-link hub');
check(jobsLines < 800, `jobs.html line count strictly < 800 (actual: ${jobsLines})`);

// 2. INTERVIEW-INFO.HTML VERIFICATION
console.log('\n--- 2. Interview Setup (interview-info.html) ---');
const infoHtmlPath = path.join(rootDir, 'FE', 'features', 'interview', 'interview-info.html');
assert.ok(fs.existsSync(infoHtmlPath), 'interview-info.html exists');
const infoHtml = fs.readFileSync(infoHtmlPath, 'utf8');

check(!infoHtml.includes('chamber-breadcrumb'), 'interview-info.html has removed redundant .chamber-breadcrumb');
check(!infoHtml.includes('Thiết lập phòng phỏng vấn</span>\r\n            </div>') && !infoHtml.includes('Thiết lập phòng phỏng vấn</span>\n            </div>'), 'interview-info.html has no breadcrumb trail');
check(infoHtml.includes('setup-stepper-nav'), 'interview-info.html preserves functional 4-step wizard navigation');
check(infoHtml.includes('id="main-sidebar"'), 'interview-info.html retains Global Sidebar container');

// 3. COMPANY-INTELLIGENCE.HTML VERIFICATION
console.log('\n--- 3. Company Intelligence (company-intelligence.html) ---');
const companyHtmlPath = path.join(rootDir, 'FE', 'features', 'report', 'company-intelligence.html');
assert.ok(fs.existsSync(companyHtmlPath), 'company-intelligence.html exists');
const companyHtml = fs.readFileSync(companyHtmlPath, 'utf8');

check(!companyHtml.includes('company-breadcrumb'), 'company-intelligence.html has removed duplicate in-page .company-breadcrumb');
check(companyHtml.includes('id="btn-back-to-report"'), 'company-intelligence.html preserves primary header back button to report');

// 4. CSS ASSETS AND DESIGN SYSTEM CONSTRAINTS
console.log('\n--- 4. Stylesheet Integrity & Design Constraints ---');
const jobsCssPath = path.join(rootDir, 'FE', 'features', 'jobs', 'jobs.css');
assert.ok(fs.existsSync(jobsCssPath), 'jobs.css exists');
const jobsCss = fs.readFileSync(jobsCssPath, 'utf8');
const jobsCssLines = jobsCss.split('\n').length;

check(jobsCssLines >= 700, `jobs.css line count maintains >= 700 constraint (actual: ${jobsCssLines})`);
check(jobsCss.includes('.jobs-header-section'), 'jobs.css maintains .jobs-header-section');
check(jobsCss.includes('.jobs-page-title'), 'jobs.css maintains .jobs-page-title');

// 5. GLOBAL NAVIGATION & CORE PAGE PURITY
console.log('\n--- 5. Global Navigation & Header Cleanliness Across Core Pages ---');
const corePages = [
  { name: 'Dashboard', file: 'FE/features/dashboard/dashboard.html' },
  { name: 'History', file: 'FE/features/interview/history.html' },
  { name: 'Question Bank', file: 'FE/features/qbank/qbank.html' },
  { name: 'Progress', file: 'FE/features/progress/progress.html' },
  { name: 'Profile', file: 'FE/features/profile/profile.html' },
  { name: 'Settings', file: 'FE/features/profile/settings.html' }
];

for (const p of corePages) {
  const content = fs.readFileSync(path.join(rootDir, p.file), 'utf8');
  check(content.includes('id="main-sidebar"') || content.includes('sidebar-new'), `${p.name} integrates unified Global Sidebar`);
  check(!content.includes('class="breadcrumb"') && !content.includes('class="jobs-breadcrumb"') && !content.includes('class="chamber-breadcrumb"'), `${p.name} does not contain redundant top breadcrumb`);
}

console.log('\n===============================================================');
console.log(`   WI-UX-20 TEST SUMMARY: ${passed} PASS, ${failed} FAIL   `);
console.log('===============================================================');

if (failed > 0) {
  process.exit(1);
}
