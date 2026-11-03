const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let totalChecks = 0;
let passedChecks = 0;

function assert(condition, message) {
    totalChecks++;
    if (condition) {
        passedChecks++;
        console.log(`  ✓ ${message}`);
    } else {
        console.error(`  ✗ FAIL: ${message}`);
    }
}

console.log('================================================================');
console.log('  RUNNING PREPMATE REGRESSION: WI-UX-04');
console.log('  Global Footer, Color Contrast & Interview History Consistency');
console.log('================================================================\n');

// -------------------------------------------------------------
// SECTION 1: ARCHITECTURAL INVARIANTS & REPOSITORY SAFETY
// -------------------------------------------------------------
console.log('[SECTION 1] Architectural Invariants & Database Integrity:');

const dbPath = path.join(__dirname, '../../BE/data/db.json');
const dbContent = fs.readFileSync(dbPath);
const dbHash = crypto.createHash('sha256').update(dbContent).digest('hex').toUpperCase();
const EXPECTED_HASH = 'C2BA83B82E758B277786DAD7073E1C8A0E80C71FC615ECBBE5847D01B47CDA50';

assert(dbHash === EXPECTED_HASH, `db.json SHA-256 hash intact (${dbHash})`);

// -------------------------------------------------------------
// SECTION 2: WI-04A GLOBAL FOOTER STANDARDIZATION
// -------------------------------------------------------------
console.log('\n[SECTION 2] WI-04A Global Footer Standardization:');

const publicPages = [
    'FE/index.html',
    'FE/404.html',
    'FE/features/about/about.html',
    'FE/features/help/help.html',
    'FE/features/payment/pricing.html',
    'FE/features/legal/legal-center.html'
];

const workspacePages = [
    'FE/features/admin/admin.html',
    'FE/features/dashboard/dashboard.html',
    'FE/features/interview/history.html',
    'FE/features/interview/interview-info.html',
    'FE/features/jobs/jobs.html',
    'FE/features/payment/payment.html',
    'FE/features/profile/cv.html',
    'FE/features/profile/profile.html',
    'FE/features/profile/settings.html',
    'FE/features/progress/progress.html',
    'FE/features/qbank/qbank.html',
    'FE/features/report/company-intelligence.html',
    'FE/features/report/report.html'
];

publicPages.forEach(page => {
    const filePath = path.join(__dirname, '../../', page);
    const content = fs.readFileSync(filePath, 'utf8');
    const appFooterCount = (content.match(/<app-footer>/gi) || []).length;
    const workspaceFooterCount = (content.match(/<app-workspace-footer>/gi) || []).length;
    assert(appFooterCount === 1, `${page} has exactly 1 <app-footer>`);
    assert(workspaceFooterCount === 0, `${page} has 0 workspace footers`);
});

workspacePages.forEach(page => {
    const filePath = path.join(__dirname, '../../', page);
    const content = fs.readFileSync(filePath, 'utf8');
    const appFooterCount = (content.match(/<app-footer>/gi) || []).length;
    const workspaceFooterCount = (content.match(/<app-workspace-footer>/gi) || []).length;
    assert(workspaceFooterCount === 1, `${page} has exactly 1 <app-workspace-footer>`);
    assert(appFooterCount === 0, `${page} has 0 marketing footers`);
});

// Check sticky footer flexbox rules (no fixed or absolute footer positioning)
const cssDir = path.join(__dirname, '../../FE/shared/css');
const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));

let fixedFootersFound = 0;
cssFiles.forEach(f => {
    const content = fs.readFileSync(path.join(cssDir, f), 'utf8');
    // Search for fixed/absolute footers
    const matches = content.match(/(?:app-footer|\.app-footer|app-workspace-footer|\.app-workspace-footer)\s*\{[^}]*position\s*:\s*(?:fixed|absolute)[^}]*\}/gi);
    if (matches) {
        fixedFootersFound += matches.length;
    }
});
assert(fixedFootersFound === 0, 'Zero occurrences of position: fixed or absolute on footers');

// Check layout.css contains sticky flex column and margin-top: auto
const layoutCss = fs.readFileSync(path.join(cssDir, 'layout.css'), 'utf8');
assert(layoutCss.includes('app-footer {\n  display: block;\n  width: 100%;\n  margin-top: auto;') ||
       layoutCss.includes('app-footer {\r\n  display: block;\r\n  width: 100%;\r\n  margin-top: auto;') ||
       layoutCss.includes('margin-top: auto;'), 'app-footer uses margin-top: auto');

assert(layoutCss.includes('app-workspace-footer {\n  display: block;') ||
       layoutCss.includes('app-workspace-footer {\r\n  display: block;') ||
       layoutCss.includes('app-workspace-footer'), 'app-workspace-footer has block layout in layout.css');

assert(layoutCss.includes('.main-content-new {') && layoutCss.includes('min-height: 100vh') && layoutCss.includes('flex-direction: column'),
    '.main-content-new shell implements flex-direction: column and min-height: 100vh');

// -------------------------------------------------------------
// SECTION 3: WI-04B SYSTEM-WIDE COLOR CONTRAST & READABILITY
// -------------------------------------------------------------
console.log('\n[SECTION 3] WI-04B System-Wide Color Contrast & Readability:');

const tokensCss = fs.readFileSync(path.join(cssDir, 'tokens.css'), 'utf8');
assert(tokensCss.includes('--pm-on-primary:'), 'tokens.css defines --pm-on-primary semantic foreground');
assert(tokensCss.includes('--pm-on-success:'), 'tokens.css defines --pm-on-success semantic foreground');
assert(tokensCss.includes('--pm-on-danger:'), 'tokens.css defines --pm-on-danger semantic foreground');
assert(tokensCss.includes('--pm-on-warning:'), 'tokens.css defines --pm-on-warning semantic foreground');
assert(tokensCss.includes('--pm-on-info:'), 'tokens.css defines --pm-on-info semantic foreground');
assert(tokensCss.includes('--pm-primary-text-on-dark:'), 'tokens.css defines --pm-primary-text-on-dark');
assert(tokensCss.includes('--pm-placeholder:'), 'tokens.css defines --pm-placeholder for WCAG AA compliance');

const compCss = fs.readFileSync(path.join(cssDir, 'components.css'), 'utf8');
assert(compCss.includes('.btn-primary:active') && compCss.includes('color: var(--pm-on-primary-active, #ffffff);'),
    '.btn-primary:active maintains explicit high-contrast foreground');
assert(compCss.includes('.btn-danger:hover') && compCss.includes('color: var(--pm-on-danger, #ffffff);'),
    '.btn-danger:hover maintains explicit high-contrast foreground');
assert(compCss.includes('.btn-success'), '.btn-success defined with accessible contrast in components.css');
assert(compCss.includes('input::placeholder') && compCss.includes('color: var(--pm-placeholder, #64748b) !important;'),
    'Form controls enforce WCAG AA compliant placeholder contrast');
assert(compCss.includes('.tooltip, [data-tooltip]') && compCss.includes('color: #ffffff;'),
    'Tooltips enforce high-contrast foreground text (#ffffff)');

const mainJs = fs.readFileSync(path.join(__dirname, '../../FE/shared/js/main.js'), 'utf8');
assert(mainJs.includes('background: linear-gradient(135deg, #f59e0b, #d97706); color: #ffffff;'),
    'User pro avatar defines explicit color: #ffffff;');
assert(mainJs.includes('background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #ffffff;'),
    'User standard avatar defines explicit color: #ffffff;');
assert(mainJs.includes('background: linear-gradient(135deg, #4338ca, #6366f1); color: #ffffff;'),
    'Manager avatar defines explicit color: #ffffff;');
assert(mainJs.includes('background: linear-gradient(135deg, #059669, #10b981); color: #ffffff;'),
    'Admin avatar defines explicit color: #ffffff;');

// -------------------------------------------------------------
// SECTION 4: WI-04C UNIFIED INTERVIEW HISTORY CONSISTENCY
// -------------------------------------------------------------
console.log('\n[SECTION 4] WI-04C Unified Interview History:');

const dashJs = fs.readFileSync(path.join(__dirname, '../../FE/features/dashboard/dashboard.js'), 'utf8');
const historyHtml = fs.readFileSync(path.join(__dirname, '../../FE/features/interview/history.html'), 'utf8');
const newDashCss = fs.readFileSync(path.join(__dirname, '../../FE/features/dashboard/new-dashboard.css'), 'utf8');
const historyCss = fs.readFileSync(path.join(__dirname, '../../FE/features/interview/history.css'), 'utf8');

// 1. Dashboard 3-item limit
assert(dashJs.includes('MAX_OVERVIEW_SESSIONS = 3') && dashJs.includes('sortedSessions.slice(0, MAX_OVERVIEW_SESSIONS)'),
    'Dashboard strictly limits recent interviews overview to 3 items');

// 2. Score class consistency
assert(dashJs.includes('scoreClass = normalized >= 80 ? \'score-high\' : normalized >= 60 ? \'score-mid\' : \'score-low\';'),
    'Dashboard calculates scoreClass identically to History page');
assert(dashJs.includes('history-item-score ${scoreClass}'),
    'Dashboard renders history-item-score with scoreClass attribute');
assert(historyHtml.includes('history-item-score ${scoreClass}'),
    'History renders history-item-score with scoreClass attribute');

// 3. Unified CSS score rules
assert(newDashCss.includes('.history-item-score.score-high') && newDashCss.includes('.history-item-score.score-mid') && newDashCss.includes('.history-item-score.score-low'),
    'new-dashboard.css defines .score-high, .score-mid, .score-low, .score-null');
assert(historyCss.includes('.history-item-score.score-high') && historyCss.includes('.history-item-score.score-mid'),
    'history.css defines .score-high, .score-mid, .score-low');

// 4. Role and date icon consistency
assert(dashJs.includes('history-item-job-title') && dashJs.includes('<svg') && dashJs.includes('viewBox="0 0 24 24"'),
    'Dashboard includes job role icon matching History page');
assert(dashJs.includes('history-item-date') && dashJs.includes('<svg') && dashJs.includes('rect x="3" y="4"'),
    'Dashboard includes calendar date icon matching History page');

// 5. Full History date filtering and reset capabilities
assert(historyHtml.includes('id="btn-reset-filters"') && historyHtml.includes('resetHistoryFilters()'),
    'History page has working Reset Filters action');
assert(historyHtml.includes('id="hist-date-exact"') && historyHtml.includes('id="hist-date-start"') && historyHtml.includes('id="hist-date-end"'),
    'History page provides exact date and date range inputs');
assert(historyHtml.includes('Ngày bắt đầu không được sau ngày kết thúc'),
    'History page provides date range validation');

// 6. View all history link on Dashboard
assert(dashJs.includes('href="../interview/history.html"') && dashJs.includes('Xem toàn bộ lịch sử'),
    'Dashboard provides clear link/affordance to full History page');

console.log('\n================================================================');
console.log(`  TEST RESULTS: ${passedChecks}/${totalChecks} CHECKS PASSED`);
if (passedChecks === totalChecks) {
    console.log('  STATUS: ALL CHECKS PASSED (100% SUCCESS)');
} else {
    console.log('  STATUS: SOME CHECKS FAILED');
}
console.log('================================================================');

process.exit(passedChecks === totalChecks ? 0 : 1);
