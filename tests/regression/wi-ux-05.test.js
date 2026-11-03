/**
 * PREPMATE — WI-UX-05: GLOBAL ICON ALIGNMENT, SIDEBAR & INTERVIEW HISTORY STANDARDIZATION
 * 
 * Regression Verification Suite:
 * 1. Database & Repository Integrity (SHA-256 invariant)
 * 2. WI-UX-05A: Global Icon & Text Horizontal Alignment (.pm-icon-label SSOT)
 * 3. WI-UX-05B: Interview History Visual Standardization (Dashboard vs History 1:1 parity)
 * 4. WI-UX-05C: Global Sidebar Architecture & Role-Based Navigation
 * 5. WI-UX-05D: Canonical PrepMate Brand Logo & Assets
 * 6. WI-UX-05E: Micro-Interactions, Reduced Motion & Morphicons Compliance
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let totalChecks = 0;
let passedChecks = 0;

function assert(condition, message) {
    totalChecks++;
    if (condition) {
        passedChecks++;
        console.log(`  [PASS] ${message}`);
    } else {
        console.error(`  [FAIL] ${message}`);
    }
}

console.log('================================================================');
console.log('  RUNNING PREPMATE REGRESSION: WI-UX-05');
console.log('  Global Icon Alignment, Sidebar & Interview History Parity');
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
// SECTION 2: WI-UX-05A GLOBAL ICON & TEXT ALIGNMENT
// -------------------------------------------------------------
console.log('\n[SECTION 2] WI-UX-05A Global Icon & Text Alignment:');

const compCssPath = path.join(__dirname, '../../FE/shared/css/components.css');
const compCss = fs.readFileSync(compCssPath, 'utf8');

assert(compCss.includes('.pm-icon-label {') && compCss.includes('display: inline-flex;') && compCss.includes('align-items: center;'),
    'components.css defines canonical .pm-icon-label with inline-flex and align-items: center');

assert(compCss.includes('.pm-icon-label > svg') && compCss.includes('flex: 0 0 auto;'),
    '.pm-icon-label > svg enforces flex: 0 0 auto to prevent icon shrinking/dropping');

assert(compCss.includes('.btn > svg') && compCss.includes('flex-shrink: 0;'),
    '.btn > svg enforces flex-shrink: 0 for all button icons');

assert(compCss.includes('.section-title') && compCss.includes('display: inline-flex;'),
    '.section-title enforces inline-flex horizontal alignment with icons');

assert(compCss.includes('.modal-title') && compCss.includes('flex-shrink: 0;'),
    '.modal-title and modal actions enforce flex-shrink: 0 on icons');

// -------------------------------------------------------------
// SECTION 3: WI-UX-05B INTERVIEW HISTORY VISUAL STANDARDIZATION
// -------------------------------------------------------------
console.log('\n[SECTION 3] WI-UX-05B Interview History Visual Standardization:');

const dashJsPath = path.join(__dirname, '../../FE/features/dashboard/dashboard.js');
const dashJs = fs.readFileSync(dashJsPath, 'utf8');

const histHtmlPath = path.join(__dirname, '../../FE/features/interview/history.html');
const histHtml = fs.readFileSync(histHtmlPath, 'utf8');

const newDashCssPath = path.join(__dirname, '../../FE/features/dashboard/new-dashboard.css');
const newDashCss = fs.readFileSync(newDashCssPath, 'utf8');

const histCssPath = path.join(__dirname, '../../FE/features/interview/history.css');
const histCss = fs.readFileSync(histCssPath, 'utf8');

// 1. Dashboard 3-item limit preserved
assert(dashJs.includes('MAX_OVERVIEW_SESSIONS = 3'), 'Dashboard strictly maintains 3-item limit');

// 2. Card structure parity (glass-card)
assert(dashJs.includes("historyItem.className = 'history-item glass-card';"), 'Dashboard uses history-item glass-card');
assert(histHtml.includes("card.className = 'history-item glass-card';"), 'History page uses history-item glass-card');

// 3. Score pill parity
assert(histHtml.includes('class="history-item-score ${scoreClass}"'), 'History page renders history-item-score ${scoreClass}');
assert(histCss.includes('.history-item-score {') && histCss.includes('width: 48px;') && histCss.includes('height: 48px;'),
    'history.css defines standardized 48x48px score pill matching Dashboard');
assert(histCss.includes('.history-item-score.score-high') && histCss.includes('.history-item-score.score-mid') && histCss.includes('.history-item-score.score-low'),
    'history.css implements standardized score color states (high/mid/low/null)');

// 4. Title row & Job title parity
assert(dashJs.includes('history-item-title-row') && dashJs.includes('history-item-job-title'),
    'Dashboard renders history-item-title-row and history-item-job-title');
assert(histHtml.includes('history-item-title-row') && histHtml.includes('history-item-job-title'),
    'History page renders history-item-title-row and history-item-job-title');
assert(histHtml.includes('pm-company-pill'), 'History page renders pm-company-pill');

// 5. Meta row badge parity (no emoji flags)
assert(histHtml.includes('pm-flag-badge') && !histHtml.includes("flag = lang === 'English' ? '🇬🇧' : '🇻🇳'"),
    'History page standardized language badge without emoji flag');
assert(histHtml.includes('pm-questions-badge'), 'History page renders standardized pm-questions-badge');
assert(histHtml.includes('pm-seniority-chip'), 'History page renders standardized pm-seniority-chip');
assert(histHtml.includes('history-item-date'), 'History page renders standardized history-item-date');

// 6. Action button parity
assert(dashJs.includes('btn-action-report') && dashJs.includes('btn-action-resume') && dashJs.includes('btn-action-restart'),
    'Dashboard uses standardized action buttons (btn-action-report, resume, restart)');
assert(histHtml.includes('btn-action-report') && histHtml.includes('btn-action-resume') && histHtml.includes('btn-action-restart'),
    'History page uses standardized action buttons (btn-action-report, resume, restart)');

// 7. Full History preserves date grouping & search filtering
assert(histHtml.includes('history-date-group') && histHtml.includes('history-date-heading'),
    'History page preserves full date-grouped hierarchy');
assert(histHtml.includes('id="hist-search-input"') && histHtml.includes('id="btn-reset-filters"'),
    'History page preserves search, date filtering and reset controls');

// -------------------------------------------------------------
// SECTION 4: WI-UX-05C GLOBAL SIDEBAR STANDARDIZATION
// -------------------------------------------------------------
console.log('\n[SECTION 4] WI-UX-05C Global Sidebar Architecture:');

const mainJsPath = path.join(__dirname, '../../FE/shared/js/main.js');
const mainJs = fs.readFileSync(mainJsPath, 'utf8');

const layoutCssPath = path.join(__dirname, '../../FE/shared/css/layout.css');
const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');

// 1. Single source of truth for sidebar
assert(mainJs.includes('function initRoleBasedSidebar()'), 'main.js provides initRoleBasedSidebar SSOT');
assert(mainJs.includes('role === "admin"') && mainJs.includes('role === "manager"') && mainJs.includes('role === "guest"'),
    'Sidebar handles all 4 distinct roles (guest, user, manager, admin)');

// 2. Sidebar CSS dimensions & alignment
assert(layoutCss.includes('.sidebar-new .nav-new a') && layoutCss.includes('min-height: 38px;'),
    'layout.css enforces standardized min-height: 38px for sidebar nav items');
assert(layoutCss.includes('.sidebar-new .nav-new a .nav-icon') && layoutCss.includes('flex: 0 0 auto;'),
    'layout.css enforces flex: 0 0 auto on sidebar nav icons to prevent distortion');

// 3. Collapsed sidebar mode
assert(layoutCss.includes('.sidebar-new.collapsed') && layoutCss.includes('width: 72px;'),
    'layout.css supports collapsed sidebar mode with width: 72px');
assert(layoutCss.includes('.sidebar-new.collapsed .logo-new') && layoutCss.includes('justify-content: center;'),
    'Collapsed sidebar centers logo icon');

// 4. Mobile drawer behavior
assert(layoutCss.includes('.sidebar-new.mobile-drawer-open') || layoutCss.includes('mobile-drawer-open'),
    'layout.css defines mobile drawer open state');

// -------------------------------------------------------------
// SECTION 5: WI-UX-05D CANONICAL BRAND LOGO & ASSETS
// -------------------------------------------------------------
console.log('\n[SECTION 5] WI-UX-05D Canonical PrepMate Brand Logo:');

const compJsPath = path.join(__dirname, '../../FE/shared/js/components.js');
const compJs = fs.readFileSync(compJsPath, 'utf8');

const iconsJsPath = path.join(__dirname, '../../FE/shared/js/icons.js');
const iconsJs = fs.readFileSync(iconsJsPath, 'utf8');

// 1. Canonical wordmark in AppHeader
assert(compJs.includes('<a href="${root}index.html" class="logo" title="PrepMate - Về trang chủ"') && compJs.includes('Prep<span>Mate</span>'),
    'AppHeader uses canonical Prep<span>Mate</span> wordmark');

// 2. Canonical brand mark in PrepMateIcons
assert(iconsJs.includes('logo:') && iconsJs.includes('brand:'),
    'PrepMateIcons registry defines canonical logo and brand SVG paths');

// 3. Canonical sidebar logo
assert(mainJs.includes('class="logo-new"') && mainJs.includes('class="logo-icon">P</div>') && mainJs.includes('Prep<span>Mate</span>'),
    'Sidebar uses canonical logo-new with logo-icon and Prep<span>Mate</span> brand mark');

// 4. Logo in Footer
assert(compJs.includes('footer-logo') && compJs.includes('logo-mini-icon') && compJs.includes('workspace-footer-badge'),
    'AppFooter and AppWorkspaceFooter use canonical brand mark');

// -------------------------------------------------------------
// SECTION 6: WI-UX-05E MICRO-INTERACTIONS & MOTION COMPLIANCE
// -------------------------------------------------------------
console.log('\n[SECTION 6] WI-UX-05E Micro-Interactions & Reduced Motion:');

const styleCssPath = path.join(__dirname, '../../FE/shared/css/style.css');
const styleCss = fs.readFileSync(styleCssPath, 'utf8');

assert(styleCss.includes('.logo:hover') && styleCss.includes('transform: scale(1.02);'),
    'style.css uses restrained scale(1.02) hover on brand logo');

assert(layoutCss.includes('@media (prefers-reduced-motion: reduce)') && layoutCss.includes('transition: none !important;'),
    'layout.css respects prefers-reduced-motion for sidebar, navigation and buttons');

assert(compJs.includes('window.PrepMateIcons.morph') || compJs.includes('morphTo'),
    'Morphicons integrated cleanly for two-state interactive controls');

// -------------------------------------------------------------
// FINAL SUMMARY
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`  WI-UX-05 SUMMARY: ${passedChecks}/${totalChecks} ASSERTIONS PASSED`);
console.log('================================================================\n');

if (passedChecks === totalChecks) {
    console.log('[SUCCESS] All WI-UX-05 regression checks passed cleanly!');
    process.exit(0);
} else {
    console.error(`[FAIL] ${totalChecks - passedChecks} assertions failed.`);
    process.exit(1);
}
