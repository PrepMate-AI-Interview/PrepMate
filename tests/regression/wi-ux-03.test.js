/**
 * PREPMATE — WI-UX-03: JOBS, PROFILE & SETTINGS UX REFINEMENT REGRESSION SUITE
 * 
 * Verifies:
 * 1. WI-03A (Jobs):
 *    - Job application link classification: direct applyUrl vs job-specific sourceUrl vs generic search.
 *    - Deep-link target safety: target="_blank", rel="noopener noreferrer".
 *    - Removed practice distractions: no .btn-practice-jd on job cards or modal, no .ai-mock-box.
 *    - jobs.html line count strictly < 800.
 * 2. WI-03B (Profile):
 *    - Personal information management focus: fullname, email, phone, target-role, bio.
 *    - Save profile persistence and SSOT profile contract.
 *    - Redundant account hub (#account-hubs) removed from presentation.
 * 3. WI-03C (Settings):
 *    - System preferences focus: theme, language, voice speed, audio toggles, notifications.
 *    - Redundant account summary card (#account-summary-card) and profile redirects removed.
 *    - Security status preserved with authoritative indicator and draft cache clear.
 * 4. Production Database Invariant:
 *    - BE/data/db.json byte-for-byte unmodified.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { resolvePath, resolveDbPath, getBaselineDbHash } = require('../helpers/test-env');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const JOBS_HTML_PATH = resolvePath('FE/features/jobs/jobs.html');
const PROFILE_HTML_PATH = resolvePath('FE/features/profile/profile.html');
const SETTINGS_HTML_PATH = resolvePath('FE/features/profile/settings.html');
const JOBS_SERVICE_PATH = resolvePath('BE/Services/Jobs/JobAggregationService.cs');
const PROD_DB_PATH = resolveDbPath();
const BASELINE_HASH = getBaselineDbHash();

console.log('═══════════════════════════════════════════════════════════════');
console.log('   WI-UX-03: JOBS, PROFILE & SETTINGS REGRESSION SUITE         ');
console.log('═══════════════════════════════════════════════════════════════\n');

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

// -----------------------------------------------------------------------------
// SECTION 1: WI-03A — JOBS EXTERNAL APPLICATION LINKS & PRACTICE REMOVAL
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: Jobs External Links & Practice Removal ---');

const jobsHtml = fs.readFileSync(JOBS_HTML_PATH, 'utf8');
const jobsLines = jobsHtml.split(/\r?\n/).length;

check(jobsLines < 800, `jobs.html line count strictly < 800 (actual: ${jobsLines})`);
check(jobsHtml.includes('classifyJobUrl'), 'jobs.html defines classifyJobUrl function');
check(jobsHtml.includes('resolveJobApplyDestination'), 'jobs.html defines resolveJobApplyDestination function');
check(jobsHtml.includes('target="_blank"') && jobsHtml.includes('rel="noopener noreferrer"'), 'jobs.html enforces safe new-tab attributes on external links');

// Verify removal of practice buttons on cards & modal
check(!jobsHtml.includes('<button class="btn-practice-jd" onclick="practiceForJob'), 'Job cards do NOT contain .btn-practice-jd CTA');
check(!jobsHtml.includes('id="m-btn-practice"'), 'Job detail modal does NOT contain #m-btn-practice CTA');
check(!jobsHtml.includes('class="ai-mock-box"'), 'Job detail modal does NOT contain .ai-mock-box container');
check(jobsHtml.includes('id="m-btn-apply"'), 'Job detail modal retains #m-btn-apply button');

// Verify Backend benchmark catalog uses SourceUrl instead of fake ApplyUrl
const jobsServiceSrc = fs.readFileSync(JOBS_SERVICE_PATH, 'utf8');
const hasSearchInApply = /ApplyUrl\s*=\s*"https:\/\/[^"]+(tim-viec-lam|search|\?keyword|\?keywords)/i.test(jobsServiceSrc);
check(!hasSearchInApply, 'JobAggregationService does not assign generic search URLs to ApplyUrl');
check(jobsServiceSrc.includes('SourceUrl = "https://www.topcv.vn/tim-viec-lam?keyword=Business+Analyst"'), 'Benchmark catalog assigns TopCV search link to SourceUrl');
check(jobsServiceSrc.includes('ApplyUrl = null,'), 'Benchmark catalog sets ApplyUrl to null for synthetic samples');

// -----------------------------------------------------------------------------
// SECTION 2: WI-03B — PROFILE PERSONAL INFO MANAGEMENT FOCUS
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Profile Personal Information Management ---');

const profileHtml = fs.readFileSync(PROFILE_HTML_PATH, 'utf8');

check(profileHtml.includes('id="fullname"'), 'Profile retains #fullname field');
check(profileHtml.includes('id="email"'), 'Profile retains #email field');
check(profileHtml.includes('id="phone"'), 'Profile retains #phone field');
check(profileHtml.includes('id="target-role"'), 'Profile retains #target-role field');
check(profileHtml.includes('id="bio"'), 'Profile retains #bio field');
check(profileHtml.includes('saveProfile()'), 'Profile retains saveProfile() persistence handler');
check(profileHtml.includes('id="account-hubs"') && profileHtml.includes('display: none !important;'), 'Redundant #account-hubs is hidden from user presentation');

// -----------------------------------------------------------------------------
// SECTION 3: WI-03C — SETTINGS APPLICATION PREFERENCES FOCUS
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Settings Application Preferences Focus ---');

const settingsHtml = fs.readFileSync(SETTINGS_HTML_PATH, 'utf8');

check(!settingsHtml.includes('id="account-summary-card"'), 'Settings removes redundant #account-summary-card');
check(!settingsHtml.includes('class="btn-profile-bridge"'), 'Settings removes redundant .btn-profile-bridge');
check(!settingsHtml.includes('href="profile.html#account"'), 'Settings removes fake password redirect to profile.html');
check(settingsHtml.includes('Đã bảo vệ'), 'Settings provides authoritative security status badge');
check(settingsHtml.includes('clearDraftCache()'), 'Settings retains clearDraftCache() functionality');
check(settingsHtml.includes('setThemePreference('), 'Settings retains theme preference controls');
check(settingsHtml.includes('setLanguagePreference('), 'Settings retains language preference controls');
check(settingsHtml.includes('setVoiceSpeedPreference('), 'Settings retains voice speed preference controls');

// -----------------------------------------------------------------------------
// SECTION 4: PRODUCTION DATABASE INVARIANT
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Production Database Integrity ---');

const crypto = require('crypto');
const dbBuffer = fs.readFileSync(PROD_DB_PATH);
const currentDbHash = crypto.createHash('sha256').update(dbBuffer).digest('hex').toUpperCase();

check(currentDbHash === BASELINE_HASH, `Production DB hash unchanged (${currentDbHash})`);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`WI-UX-03 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('═══════════════════════════════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
}
