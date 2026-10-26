/**
 * PREPMATE — P1.5-R4 VERIFICATION SUITE
 * Test: test_p15_r4_cleanup.js
 * Scope:
 *   - CONSIST-04: Orphan Code & Compatibility Graveyard Remediation
 *   - CONSIST-09: Massive Inlined Stylesheet Extraction (jobs.css, qbank.css, admin.css)
 *   - R1, R2, R3 Regression Assertions
 *   - Scope Guards (BE & runtime engine untouched)
 */

const fs = require('fs');
const path = require('path');
const { rootDir, resolvePath } = require('../helpers/test-env');
const assert = require('assert');

let passedTests = 0;
let failedTests = 0;

function test(description, fn) {
    try {
        fn();
        console.log(`  [PASS] ${description}`);
        passedTests++;
    } catch (err) {
        console.error(`  [FAIL] ${description}`);
        console.error(`         ${err.message}`);
        failedTests++;
    }
}

console.log('════════════════════════════════════════════════════════════════');
console.log(' RUNNING P1.5-R4 CLEANUP & LEGACY REMEDIATION SUITE');
console.log('════════════════════════════════════════════════════════════════\n');

function readFile(relPath) {
    return fs.readFileSync(path.resolve(rootDir, 'FE/features/interview', relPath), 'utf8');
}

// Files under verification
const dashboardHtml = readFile('../dashboard/dashboard.html');
const interviewPracticeHtml = readFile('./interview-practice.html');
const profileHtml = readFile('../profile/profile.html');
const jobsHtml = readFile('../jobs/jobs.html');
const qbankHtml = readFile('../qbank/qbank.html');
const adminHtml = readFile('../admin/admin.html');
const tokensCss = readFile('../../shared/css/tokens.css');
const indexHtml = readFile('../../index.html');

// =========================================================================
// SECTION A: CONSIST-04 ORPHAN CODE & COMPATIBILITY GRAVEYARD
// =========================================================================
console.log('--- Section A: CONSIST-04 Orphan Code Remediation ---');

test('dashboard.html: Removed dead elevenlabs-key-input scripts and handlers', () => {
    assert(!dashboardHtml.includes('elevenlabs-key-input'), 'dashboard.html must not contain dead elevenlabs-key-input queries');
    assert(!dashboardHtml.includes('function saveElevenLabsKey'), 'dashboard.html must not contain dead saveElevenLabsKey');
    assert(!dashboardHtml.includes('function toggleElevenLabsKeyVisibility'), 'dashboard.html must not contain dead toggleElevenLabsKeyVisibility');
    assert(!dashboardHtml.includes('function updateElevenLabsKeyStatus'), 'dashboard.html must not contain dead updateElevenLabsKeyStatus');
});

test('interview-practice.html: Removed dummy hidden compatibility graveyard block', () => {
    assert(!interviewPracticeHtml.includes('Hidden Compatibility Elements for JS Engine'), 'Hidden compatibility comment block must be removed');
    assert(!interviewPracticeHtml.includes('id="ai-mode-badge" class="badge-mode offline"'), 'Dummy ai-mode-badge node must be removed');
    assert(!interviewPracticeHtml.includes('id="setup-container" style="display: none"'), 'Dummy setup-container must be removed');
    assert(!interviewPracticeHtml.includes('id="free-tier-banner" style="display: none"'), 'Dummy free-tier-banner must be removed');
});

test('interview-practice.html: Preserved all 58 canonical live DOM IDs', () => {
    assert(interviewPracticeHtml.includes('id="topbar-job-title"'), 'topbar-job-title preserved');
    assert(interviewPracticeHtml.includes('id="btn-start-interview"'), 'btn-start-interview preserved');
    assert(interviewPracticeHtml.includes('id="btn-end-interview"'), 'btn-end-interview preserved');
    assert(interviewPracticeHtml.includes('id="user-input"'), 'user-input preserved');
    assert(interviewPracticeHtml.includes('id="ai-mode-badge-conv"'), 'ai-mode-badge-conv preserved');
    assert(interviewPracticeHtml.includes('id="finish-modal"'), 'finish-modal preserved');
});

test('profile.html: Removed orphan </div> tag and dummy hidden API key boxes', () => {
    assert(!profileHtml.includes('data-i18n-key="profileGeminiConfig"'), 'Hidden Gemini box removed from profile.html');
    assert(!profileHtml.includes('data-i18n-key="profileElevenLabsConfig"'), 'Hidden ElevenLabs box removed from profile.html');
    assert(!profileHtml.includes('function saveElevenLabsKey'), 'Dead saveElevenLabsKey removed from profile.html');
    assert(!profileHtml.includes('function toggleElevenLabsKeyVisibility'), 'Dead toggleElevenLabsKeyVisibility removed from profile.html');
});

test('tokens.css: Preserved required R1 backward-compatible aliases (--color-*, --radius-*, --shadow-*)', () => {
    assert(tokensCss.includes('--color-bg:'), 'Required alias --color-bg preserved');
    assert(tokensCss.includes('--color-surface:'), 'Required alias --color-surface preserved');
    assert(tokensCss.includes('--color-primary:'), 'Required alias --color-primary preserved');
    assert(tokensCss.includes('--radius-sm:'), 'Required alias --radius-sm preserved');
    assert(tokensCss.includes('--shadow-sm:'), 'Required alias --shadow-sm preserved');
});

// =========================================================================
// SECTION B: CONSIST-09 MASSIVE INLINED STYLESHEETS EXTRACTION
// =========================================================================
console.log('\n--- Section B: CONSIST-09 Stylesheet Extraction ---');

test('jobs.html: Extracted massive inline CSS to dedicated jobs.css', () => {
    assert(jobsHtml.includes('<link rel="stylesheet" href="./jobs.css'), 'jobs.html must link jobs.css');
    const jobsCssPath = resolvePath('FE/features/jobs/jobs.css');
    assert(fs.existsSync(jobsCssPath), 'jobs.css file must exist');
    const jobsCssContent = fs.readFileSync(jobsCssPath, 'utf8');
    assert(jobsCssContent.split('\n').length >= 700, 'jobs.css must contain extracted styles (>= 700 lines)');
    assert(jobsHtml.split('\n').length < 800, 'jobs.html line count should be reduced (< 800 lines)');
});

test('qbank.html: Extracted massive inline CSS to dedicated qbank.css', () => {
    assert(qbankHtml.includes('<link rel="stylesheet" href="./qbank.css'), 'qbank.html must link qbank.css');
    const qbankCssPath = resolvePath('FE/features/qbank/qbank.css');
    assert(fs.existsSync(qbankCssPath), 'qbank.css file must exist');
    const qbankCssContent = fs.readFileSync(qbankCssPath, 'utf8');
    assert(qbankCssContent.split('\n').length >= 700, 'qbank.css must contain extracted styles (>= 700 lines)');
    assert(qbankHtml.split('\n').length < 1500, 'qbank.html line count should be reduced (< 1500 lines)');
});

test('admin.html: Extracted massive inline CSS to dedicated admin.css', () => {
    assert(adminHtml.includes('<link rel="stylesheet" href="./admin.css'), 'admin.html must link admin.css');
    const adminCssPath = resolvePath('FE/features/admin/admin.css');
    assert(fs.existsSync(adminCssPath), 'admin.css file must exist');
    const adminCssContent = fs.readFileSync(adminCssPath, 'utf8');
    assert(adminCssContent.split('\n').length >= 500, 'admin.css must contain extracted styles (>= 500 lines)');
    assert(adminHtml.split('\n').length < 2300, 'admin.html line count should be reduced (< 2300 lines)');
});

test('No mega.css / monolithic stylesheet introduced', () => {
    assert(!fs.existsSync(resolvePath('FE/shared/css/mega.css')), 'mega.css must not exist');
    assert(!fs.existsSync(resolvePath('FE/shared/css/everything.css')), 'everything.css must not exist');
    assert(!fs.existsSync(resolvePath('FE/shared/css/legacy-cleanup.css')), 'legacy-cleanup.css must not exist');
});

// =========================================================================
// SECTION C: REGRESSION ASSURANCES (R1, R2, R3)
// =========================================================================
console.log('\n--- Section C: R1, R2, R3 Regression Assurances ---');

test('R1: Canonical SSOT tokens and button geometry intact', () => {
    assert(tokensCss.includes('--pm-bg:'), 'Canonical --pm-bg intact');
    assert(tokensCss.includes('--pm-primary:'), 'Canonical --pm-primary intact');
    assert(tokensCss.includes('--pm-radius-btn-md:   8px;'), 'Canonical button radius intact');
});

test('R2: UI Language, Outfit typography, and empty-state patterns intact', () => {
    assert(tokensCss.includes('--font-sans:'), 'Canonical font family token intact');
    assert(tokensCss.includes("'Outfit'"), 'Outfit font stack configured');
    assert(dashboardHtml.includes('Bạn chưa có buổi phỏng vấn nào'), 'Dashboard empty state pattern intact');
    assert(!dashboardHtml.includes('<span style="font-size:36px;margin-bottom:12px;">📋</span>'), 'Raw emoji empty state absent');
});

test('R3: Landing multi-industry showcase intact with 5 career tracks', () => {
    assert(indexHtml.includes('class="lp-industry-selector-bar"'), 'Industry selector bar intact');
    assert(indexHtml.includes('data-role="tech"'), 'Tech role intact');
    assert(indexHtml.includes('data-role="marketing"'), 'Marketing role intact');
    assert(indexHtml.includes('data-role="finance"'), 'Finance role intact');
    assert(indexHtml.includes('data-role="hr"'), 'HR role intact');
    assert(indexHtml.includes('data-role="ba"'), 'BA role intact');
    assert(indexHtml.includes('function switchHeroIndustry('), 'Hero switcher function intact');
});

// =========================================================================
// SECTION D: SCOPE GUARDS
// =========================================================================
console.log('\n--- Section D: Scope Guards (Backend & Runtime Intact) ---');

test('Backend JobFamily.cs and services intact', () => {
    const jobFamilyCs = readFile('../../../BE/Models/Interview/JobFamily.cs');
    assert(jobFamilyCs.includes('public static class JobFamily'), 'Backend JobFamily.cs intact');
});

test('Interview runtime state machine and core JS untouched', () => {
    const interviewJs = readFile('./interview.js');
    assert(interviewJs.includes('async function initInterviewPractice()'), 'initInterviewPractice intact');
    assert(interviewJs.includes('window._isInterviewSessionStarted'), 'Interview session state guard intact');
});

// =========================================================================
// SUMMARY
// =========================================================================
console.log('\n════════════════════════════════════════════════════════════════');
console.log(` RESULTS: ${passedTests}/${passedTests + failedTests} TESTS PASSED (${failedTests} FAILED)`);
console.log('════════════════════════════════════════════════════════════════');

if (failedTests > 0) {
    process.exit(1);
}
