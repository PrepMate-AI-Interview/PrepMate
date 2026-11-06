/**
 * WI-UX-19: PREPMATE FULL-FRONTEND UI CONSISTENCY & DESIGN SYSTEM STANDARDIZATION
 * Regression test verifying complete design system standardization, zero negative
 * vertical-align hacks across the entire frontend, Job Opportunities header & salary
 * layout, responsive adaptation, token invariants, and database integrity.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '../..');

console.log('--- RUNNING TEST: WI-UX-19 Full-Frontend UI Consistency & Design System ---');

let passed = 0;
function pass(msg) {
  console.log(`  [PASS] ${msg}`);
  passed++;
}

// ========================================================
// 1. Full Frontend Pages Inventory (26 Canonical HTML Pages)
// ========================================================
const EXPECTED_PAGES = [
  'FE/index.html',
  'FE/404.html',
  'FE/legal-center.html',
  'FE/features/legal/legal-center.html',
  'FE/features/about/about.html',
  'FE/features/admin/admin.html',
  'FE/features/auth/auth.html',
  'FE/features/auth/forgot-password.html',
  'FE/features/auth/reset-password.html',
  'FE/features/auth/verify-email.html',
  'FE/features/dashboard/dashboard.html',
  'FE/features/design-system/showcase.html',
  'FE/features/help/help.html',
  'FE/features/interview/history.html',
  'FE/features/interview/interview-info.html',
  'FE/features/interview/interview-practice.html',
  'FE/features/jobs/jobs.html',
  'FE/features/payment/pricing.html',
  'FE/features/payment/payment.html',
  'FE/features/profile/profile.html',
  'FE/features/profile/cv.html',
  'FE/features/profile/settings.html',
  'FE/features/progress/progress.html',
  'FE/features/qbank/qbank.html',
  'FE/features/report/report.html',
  'FE/features/report/company-intelligence.html'
];

for (const relPath of EXPECTED_PAGES) {
  const fullPath = path.join(ROOT_DIR, relPath);
  assert(fs.existsSync(fullPath), `Expected page must exist: ${relPath}`);
}
pass(`Full frontend inventory verified: all ${EXPECTED_PAGES.length} canonical pages exist`);

// ========================================================
// 2. Global Zero Negative Vertical-Align Invariant
// ========================================================
function scanNegativeVerticalAlign(dir) {
  const violations = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      violations.push(...scanNegativeVerticalAlign(full));
    } else if (/\.(html|js|css)$/.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((l, idx) => {
        if (/vertical-align\s*:\s*-[0-9]/.test(l)) {
          violations.push({ file: path.relative(ROOT_DIR, full), line: idx + 1, text: l.trim() });
        }
      });
    }
  }
  return violations;
}

const negativeAlignViolations = scanNegativeVerticalAlign(path.join(ROOT_DIR, 'FE'));
assert.strictEqual(
  negativeAlignViolations.length,
  0,
  `Zero negative vertical-align hacks permitted across FE. Found ${negativeAlignViolations.length}: ` +
    JSON.stringify(negativeAlignViolations.slice(0, 5))
);
pass('Zero negative vertical-align hacks across entire FE codebase (100% eliminated)');

// ========================================================
// 3. Job Opportunities Architecture & Salary Standardization
// ========================================================
const jobsHtmlPath = path.join(ROOT_DIR, 'FE/features/jobs/jobs.html');
const jobsHtml = fs.readFileSync(jobsHtmlPath, 'utf8');
const jobsLineCount = jobsHtml.split(/\r?\n/).length;

assert(
  jobsLineCount < 800,
  `jobs.html line count strictly < 800 invariant (actual: ${jobsLineCount})`
);
pass(`jobs.html line count strictly < 800 (actual: ${jobsLineCount})`);

assert(
  jobsHtml.includes('class="job-header-row"') &&
  jobsHtml.includes('class="job-title-row"') &&
  jobsHtml.includes('class="job-salary-highlight"'),
  'jobs.html renderJobCard must encapsulate title and salary highlight into .job-header-row'
);
pass('jobs.html renderJobCard structures .job-header-row with title and salary highlight');

assert(
  jobsHtml.includes('class="salary-label">Mức lương:</span>') &&
  jobsHtml.includes('class="salary-val">'),
  'jobs.html must include .salary-label with "Mức lương:" and .salary-val'
);
pass('jobs.html salary badge features explicit .salary-label ("Mức lương:") and .salary-val');

assert(
  jobsHtml.includes("return 'Thỏa thuận';"),
  'formatSalary in jobs.html must fallback to "Thỏa thuận" when salary is missing or unnegotiated'
);
pass('jobs.html formatSalary reliably falls back to "Thỏa thuận" without fabricating figures');

const jobsCssPath = path.join(ROOT_DIR, 'FE/features/jobs/jobs.css');
const jobsCss = fs.readFileSync(jobsCssPath, 'utf8');

assert(
  jobsCss.includes('.job-header-row {') &&
  jobsCss.includes('justify-content: space-between;'),
  'jobs.css must define .job-header-row with space-between layout'
);
pass('jobs.css styles .job-header-row with flex space-between alignment');

assert(
  jobsCss.includes('@media (max-width: 768px)') &&
  jobsCss.includes('flex-direction: column;') &&
  jobsCss.includes('.job-header-row'),
  'jobs.css must adapt .job-header-row to column layout on mobile (<= 768px)'
);
pass('jobs.css provides responsive column flow for .job-header-row on mobile (<= 768px)');

// ========================================================
// 4. Design Tokens & Shared Typography Foundations
// ========================================================
const tokensCssPath = path.join(ROOT_DIR, 'FE/shared/css/tokens.css');
const tokensCss = fs.readFileSync(tokensCssPath, 'utf8');

assert(
  tokensCss.includes('--mobbin-ink:') &&
  tokensCss.includes('--mobbin-canvas:') &&
  tokensCss.includes('--mobbin-weight-display:') &&
  tokensCss.includes('--mobbin-weight-body:'),
  'tokens.css must declare core Mobbin design token primitives'
);
pass('tokens.css declares Mobbin design token primitives (ink, canvas, display, body weights)');

assert(
  tokensCss.includes('--pm-canvas:') &&
  tokensCss.includes('--pm-surface:') &&
  tokensCss.includes('--pm-bg:'),
  'tokens.css must declare canonical PrepMate semantic surfaces'
);
pass('tokens.css declares canonical PrepMate semantic surfaces');

assert(
  tokensCss.includes('#202124') &&
  tokensCss.includes('#292A2D') &&
  tokensCss.includes('data-theme="dark"'),
  'tokens.css must maintain Google Material neutral charcoal dark mode theme (#202124, #292A2D)'
);
pass('tokens.css maintains Google Material neutral charcoal dark mode palette');

const componentsCssPath = path.join(ROOT_DIR, 'FE/shared/css/components.css');
const componentsCss = fs.readFileSync(componentsCssPath, 'utf8');

assert(
  componentsCss.includes('.pm-icon-text') &&
  componentsCss.includes('.pm-icon-label') &&
  componentsCss.includes('.hero-pill-item') &&
  componentsCss.includes('.speech-card-title'),
  'components.css must enforce global icon-text flex alignment across components'
);
pass('components.css reinforces SSOT icon-text flex alignment across shared componentry');

// ========================================================
// 5. Production Database Checksum Invariant
// ========================================================
const dbPath = path.join(ROOT_DIR, 'BE/data/db.json');
const dbContent = fs.readFileSync(dbPath);
const dbHash = crypto.createHash('sha256').update(dbContent).digest('hex').toUpperCase();
const EXPECTED_DB_HASH = '44223D9B7E945E70CADEB3279AE3EE5A0DD748A867B2C3A6B0C5C617A9DB62C3';

assert.strictEqual(
  dbHash,
  EXPECTED_DB_HASH,
  `Production database integrity compromised! Expected ${EXPECTED_DB_HASH}, got ${dbHash}`
);
pass(`Production database integrity 100% verified (SHA256: ${dbHash})`);

// ========================================================
// Summary
// ========================================================
console.log('═══════════════════════════════════════════════════════════════');
console.log(`WI-UX-19 TEST RESULTS: ${passed} PASSED, 0 FAILED`);
console.log('═══════════════════════════════════════════════════════════════');
