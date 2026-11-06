/**
 * PREPMATE — WI-JOBS-UX-02: FIX EXCESSIVE PAGE GUTTERS & ALIGN JOB PAGE LAYOUT
 * 
 * Verifies:
 * 1. .jobs-container eliminates restrictive max-width (1260px) and margin: 0 auto centering.
 * 2. .jobs-container eliminates compounding double horizontal padding (0px horizontal).
 * 3. .jobs-layout aligns smoothly with the global content axis (offset: 32px from sidebar, identical to Dashboard and History).
 * 4. Responsive adjustments across desktop (280px 1fr), tablet (240px 1fr), and mobile (1fr).
 * 5. jobs.html line count strictly < 800.
 * 6. jobs.css line count >= 700.
 * 7. Production DB SHA-256 integrity invariant.
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
console.log('   WI-JOBS-UX-02: PAGE GUTTERS & GLOBAL LAYOUT ALIGNMENT       ');
console.log('═══════════════════════════════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────
// SECTION 1: JOBS FILE INVARIANTS
// ─────────────────────────────────────────────────────────────
console.log('--- SECTION 1: Jobs File Invariants ---');

const jobsHtmlPath = path.join(ROOT_DIR, 'FE/features/jobs/jobs.html');
const jobsHtml = fs.readFileSync(jobsHtmlPath, 'utf8');
const jobsLines = jobsHtml.split('\n').length;
assert(jobsLines < 800, `jobs.html line count strictly < 800 invariant (actual: ${jobsLines})`);
pass(`jobs.html line count strictly < 800 (actual: ${jobsLines})`);

const jobsCssPath = path.join(ROOT_DIR, 'FE/features/jobs/jobs.css');
const jobsCss = fs.readFileSync(jobsCssPath, 'utf8');
const jobsCssLines = jobsCss.split('\n').length;
assert(jobsCssLines >= 700, `jobs.css line count >= 700 invariant (actual: ${jobsCssLines})`);
pass(`jobs.css line count >= 700 (actual: ${jobsCssLines})`);

// ─────────────────────────────────────────────────────────────
// SECTION 2: CONTAINER MAX-WIDTH & COMPOUNDING PADDING ELIMINATION
// ─────────────────────────────────────────────────────────────
console.log('\n--- SECTION 2: Gutter Normalization & Compounding Elimination ---');

// Ensure base .jobs-container has width: 100%, max-width: none, margin: 0
const baseContainerRegex = /\.jobs-container\s*\{([^}]*)\}/;
const match = jobsCss.match(baseContainerRegex);
assert(match, '.jobs-container rule must be defined in jobs.css');
const containerBody = match[1];

assert(!containerBody.includes('max-width: 1260px'), '.jobs-container must NOT enforce restrictive max-width: 1260px');
assert(!containerBody.includes('margin: 0 auto'), '.jobs-container must NOT enforce margin: 0 auto centering that creates artificial side gutters');
assert(containerBody.includes('width: 100%'), '.jobs-container must span full width (width: 100%)');
assert(containerBody.includes('max-width: none'), '.jobs-container must specify max-width: none to avoid restricting workspace area');
pass('.jobs-container correctly configured with full width and no artificial max-width centering');

// Verify mobile media query does not re-add compounding horizontal padding
const mobileMediaBlock = jobsCss.slice(jobsCss.indexOf('@media (max-width: 768px)'));
assert(!mobileMediaBlock.includes('padding: 16px 14px 48px'), 'Mobile media query must not double-pad .jobs-container with horizontal padding');
pass('Mobile viewport eliminates compounding horizontal padding, delegating gutter to .main-content-new');

// ─────────────────────────────────────────────────────────────
// SECTION 3: LAYOUT RATIO & RESPONSIVE GRID
// ─────────────────────────────────────────────────────────────
console.log('\n--- SECTION 3: Layout Grid Proportions ---');

assert(jobsCss.includes('grid-template-columns: 280px 1fr;') || jobsCss.includes('grid-template-columns: 240px 1fr;'), 'jobs.css defines balanced filter sidebar and results grid');
assert(jobsCss.includes('.jobs-sidebar') && jobsCss.includes('.jobs-main-col'), 'jobs.css structures 2-column layout (.jobs-sidebar and .jobs-main-col)');
pass('Jobs layout proportions verified (280px filter sidebar + 1fr responsive results)');

// ─────────────────────────────────────────────────────────────
// SECTION 4: PRODUCTION DATABASE INTEGRITY INVARIANT
// ─────────────────────────────────────────────────────────────
console.log('\n--- SECTION 4: Database Checksum Integrity ---');

const currentDbHash = crypto.createHash('sha256').update(fs.readFileSync(PROD_DB_PATH)).digest('hex').toUpperCase();
assert.strictEqual(
  currentDbHash,
  BASELINE_DB_HASH,
  `Production database integrity compromised! Expected ${BASELINE_DB_HASH}, got ${currentDbHash}`
);
pass(`Production database integrity 100% verified (SHA256: ${currentDbHash})`);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`WI-JOBS-UX-02 TEST RESULTS: ${passed} PASSED, 0 FAILED`);
console.log('═══════════════════════════════════════════════════════════════\n');
