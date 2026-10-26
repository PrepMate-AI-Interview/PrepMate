/**
 * PREPMATE — P1.5-R1 DESIGN SYSTEM & SHELL REMEDIATION REGRESSION TEST
 * Verifies:
 * 1. Canonical tokens in tokens.css (SSOT)
 * 2. Feature pages mapping to canonical tokens
 * 3. Removal of .glow-bg from light candidate surfaces
 * 4. Button geometry standardization
 * 5. Profile page title correction
 */

const fs = require('fs');
const path = require('path');
const { resolvePath } = require('../helpers/test-env');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`[PASS] ${message}`);
        passCount++;
    } else {
        console.error(`[FAIL] ${message}`);
        failCount++;
    }
}

function readFile(relPath) {
    const fullPath = resolvePath(relPath);
    return fs.readFileSync(fullPath, 'utf8');
}

console.log('==================================================');
console.log('   P1.5-R1: DESIGN SYSTEM & SHELL REGRESSION      ');
console.log('==================================================\n');

// 1. CANONICAL TOKENS IN tokens.css
console.log('--- TEST GROUP 1: Canonical SSOT in tokens.css ---');
const tokensCss = readFile('FE/shared/css/tokens.css');
assert(tokensCss.includes('--pm-bg: #f8fafc;'), 'tokens.css defines canonical --pm-bg');
assert(tokensCss.includes('--pm-surface: #ffffff;'), 'tokens.css defines canonical --pm-surface');
assert(tokensCss.includes('--pm-border: #e2e8f0;'), 'tokens.css defines canonical --pm-border');
assert(tokensCss.includes('--pm-primary: #1d4ed8;'), 'tokens.css defines canonical --pm-primary');
assert(tokensCss.includes('--pm-radius-btn-sm:'), 'tokens.css defines canonical --pm-radius-btn-sm');
assert(tokensCss.includes('--pm-radius-btn-md:'), 'tokens.css defines canonical --pm-radius-btn-md');
assert(tokensCss.includes('--pm-radius-btn-lg:'), 'tokens.css defines canonical --pm-radius-btn-lg');
assert(tokensCss.includes('--pm-radius-card:'), 'tokens.css defines canonical --pm-radius-card');
assert(tokensCss.includes('--color-bg:               var(--pm-bg);'), 'tokens.css maps legacy --color-bg to --pm-bg');
assert(tokensCss.includes('--color-primary:          var(--pm-primary);'), 'tokens.css maps legacy --color-primary to --pm-primary');

// 2. FEATURE PAGES CONSUMING CANONICAL TOKENS
console.log('\n--- TEST GROUP 2: Feature Pages Token Mapping ---');
const styleCss = readFile('FE/shared/css/style.css');
assert(styleCss.includes('--primary: var(--pm-primary);'), 'style.css maps --primary to canonical var(--pm-primary)');
assert(styleCss.includes('--border-color: var(--pm-border);'), 'style.css maps --border-color to canonical var(--pm-border)');

const interviewInfoHtml = readFile('FE/features/interview/interview-info.html');
assert(interviewInfoHtml.includes('--prep-bg: var(--pm-bg);'), 'interview-info.html maps --prep-bg to var(--pm-bg)');
assert(interviewInfoHtml.includes('--prep-accent-dark: var(--pm-primary);'), 'interview-info.html maps --prep-accent-dark to var(--pm-primary)');
assert(!interviewInfoHtml.includes('body.dashboard-body .glow-bg'), 'interview-info.html removed obsolete glow-bg override');

const qbankHtml = readFile('FE/features/qbank/qbank.html');
assert(qbankHtml.includes('--qb-bg-body: var(--pm-bg);'), 'qbank.html maps --qb-bg-body to var(--pm-bg)');
assert(qbankHtml.includes('--qb-accent-blue-dark: var(--pm-primary);'), 'qbank.html maps --qb-accent-blue-dark to var(--pm-primary)');
assert(!qbankHtml.includes('body.dashboard-body .glow-bg'), 'qbank.html removed obsolete glow-bg override');

const jobsHtml = readFile('FE/features/jobs/jobs.html');
assert(jobsHtml.includes('--prep-bg: var(--pm-bg);'), 'jobs.html maps --prep-bg to var(--pm-bg)');
assert(jobsHtml.includes('--prep-accent-dark: var(--pm-primary);'), 'jobs.html maps --prep-accent-dark to var(--pm-primary)');
assert(!jobsHtml.includes('body.dashboard-body .glow-bg'), 'jobs.html removed obsolete glow-bg override');

const adminHtml = readFile('FE/features/admin/admin.html');
assert(adminHtml.includes('--pm-admin-bg: var(--pm-bg);'), 'admin.html maps --pm-admin-bg to var(--pm-bg)');
assert(adminHtml.includes('--pm-admin-primary: var(--pm-primary);'), 'admin.html maps --pm-admin-primary to var(--pm-primary)');

const pricingCss = readFile('FE/features/payment/pricing.css');
assert(pricingCss.includes('--prep-bg: var(--pm-bg);'), 'pricing.css maps --prep-bg to var(--pm-bg)');

const aboutCss = readFile('FE/features/about/about.css');
assert(aboutCss.includes('--about-accent: var(--pm-primary);'), 'about.css maps --about-accent to var(--pm-primary)');

const helpCss = readFile('FE/features/help/help.css');
assert(helpCss.includes('--help-accent: var(--pm-primary);'), 'help.css maps --help-accent to var(--pm-primary)');

const authCss = readFile('FE/features/auth/auth.css');
assert(authCss.includes('--auth-bg-main: var(--pm-bg);'), 'auth.css maps --auth-bg-main to var(--pm-bg)');

// 3. GLOW REMOVAL FROM LIGHT SURFACES
console.log('\n--- TEST GROUP 3: Light Surface Glow Removal ---');
const lightSurfaces = [
    { name: 'dashboard.html', content: readFile('FE/features/dashboard/dashboard.html') },
    { name: 'admin.html', content: readFile('FE/features/admin/admin.html') },
    { name: 'progress.html', content: readFile('FE/features/progress/progress.html') },
    { name: 'history.html', content: readFile('FE/features/interview/history.html') },
    { name: 'jobs.html', content: readFile('FE/features/jobs/jobs.html') },
    { name: 'payment.html', content: readFile('FE/features/payment/payment.html') },
    { name: 'cv.html', content: readFile('FE/features/profile/cv.html') },
    { name: 'profile.html', content: readFile('FE/features/profile/profile.html') },
    { name: 'settings.html', content: readFile('FE/features/profile/settings.html') },
    { name: 'auth.html', content: readFile('FE/features/auth/auth.html') }
];

lightSurfaces.forEach(surface => {
    assert(!surface.content.includes('<div class="glow-bg"></div>'), `${surface.name} has no obsolete <div class="glow-bg"></div>`);
});

// 4. BUTTON GEOMETRY
console.log('\n--- TEST GROUP 4: Button Geometry ---');
const componentsCss = readFile('FE/shared/css/components.css');
assert(componentsCss.includes('border-radius: var(--pm-radius-btn-md, 8px);'), 'components.css .btn uses canonical medium radius');
assert(componentsCss.includes('border-radius: var(--pm-radius-btn-sm, 6px);'), 'components.css .btn-sm uses canonical small radius');
assert(componentsCss.includes('border-radius: var(--pm-radius-btn-lg, 10px);'), 'components.css .btn-lg uses canonical large radius');
assert(componentsCss.includes('border-radius: var(--pm-radius-btn-pill, 9999px);'), 'components.css .btn-pill uses canonical pill radius');

assert(styleCss.includes('border-radius: var(--pm-radius-btn-md, 8px);'), 'style.css .btn uses canonical medium radius');

const newDashboardCss = readFile('FE/features/dashboard/new-dashboard.css');
assert(newDashboardCss.includes('border-radius: var(--pm-radius-btn-lg, 10px);'), 'new-dashboard.css .btn-start-interview uses canonical large radius');

// 5. PROFILE PAGE TITLE
console.log('\n--- TEST GROUP 5: Profile Title Correction ---');
const profileHtml = readFile('FE/features/profile/profile.html');
assert(profileHtml.includes('<title>PrepMate — Hồ sơ năng lực cá nhân</title>'), 'profile.html title updated to "PrepMate — Hồ sơ năng lực cá nhân"');
assert(!profileHtml.includes('<title>PrepMate - Hồ sơ & Cài đặt</title>'), 'profile.html old title completely removed');

console.log('\n==================================================');
console.log(`   TEST RESULTS: ${passCount} PASS, ${failCount} FAIL   `);
console.log('==================================================');

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
