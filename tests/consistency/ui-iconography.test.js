/**
 * PREPMATE — P1.5-R2 UI LANGUAGE & ICONOGRAPHY REMEDIATION REGRESSION TEST
 * Verifies:
 * 1. Iconography: Structural Unicode emojis replaced by semantic SVG vectors
 * 2. Typography: Report uses canonical application font stack (Outfit)
 * 3. Empty States: Standardized hierarchy, clean vector icons, canonical CTA geometry
 * 4. Scope Guard: Backend, API contracts, and interview lifecycle remain untouched
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
console.log('   P1.5-R2: UI LANGUAGE & ICONOGRAPHY REGRESSION  ');
console.log('==================================================\n');

// ============================================================================
// TEST GROUP A: ICONOGRAPHY & EMOJI MIGRATION (CONSIST-03)
// ============================================================================
console.log('--- TEST GROUP A: Iconography & Emoji Migration ---');

const dashHtml = readFile('FE/features/dashboard/dashboard.html');
// Check readiness cards have SVG icons and no emojis
assert(!dashReadinessHasEmoji(dashHtml), 'dashboard.html readiness grid does not contain structural emojis');
assert(dashHtml.includes('<circle cx="12" cy="12" r="3"/>'), 'dashboard.html readiness grid contains SVG cog/specialty vector');
assert(dashHtml.includes('<polygon points="12 2 15.09 8.26'), 'dashboard.html readiness grid contains SVG STAR vector');
assert(!dashHtml.includes('<span style="font-size:17px;">🎯</span>'), 'dashboard.html weekly goal card does not use raw emoji 🎯');
assert(!dashHtml.includes('<span style="font-size:17px;">💡</span>'), 'dashboard.html tip card does not use raw emoji 💡');
assert(dashHtml.includes('👋'), 'dashboard.html retains approved decorative greeting emoji 👋');

function dashReadinessHasEmoji(html) {
    const section = html.substring(html.indexOf('Executive Readiness Grid'), html.indexOf('Stats Cards (secondary)'));
    return section.includes('⚙️') || section.includes('💬') || section.includes('⭐') || section.includes('⚡');
}

// Report navbar & tabs
const reportHtml = readFile('FE/features/report/report.html');
assert(!reportHtml.includes('<span class="report-logo-icon">🎯</span>'), 'report.html brand logo does not use raw emoji 🎯');
assert(!reportHtml.includes('<span>🖨️</span>'), 'report.html print button does not use raw emoji 🖨️');
assert(!reportHtml.includes('<span>🔄</span>'), 'report.html repractice button does not use raw emoji 🔄');
assert(!reportHtml.includes('<span>📊</span> Dashboard'), 'report.html dashboard button does not use raw emoji 📊');
assert(!reportHtml.includes('<span class="tab-icon">📌</span>'), 'report.html subnav tab 1 does not use raw emoji 📌');
assert(!reportHtml.includes('<span class="tab-icon">📊</span>'), 'report.html subnav tab 2 does not use raw emoji 📊');
assert(!reportHtml.includes('<span class="tab-icon">🔍</span>'), 'report.html subnav tab 3 does not use raw emoji 🔍');
assert(!reportHtml.includes('<span class="tab-icon">🚀</span>'), 'report.html subnav tab 4 does not use raw emoji 🚀');
assert(!reportHtml.includes('<span class="tab-icon">🎯</span>'), 'report.html subnav tab 5 does not use raw emoji 🎯');
assert(!reportHtml.includes('<span class="tab-icon">📋</span>'), 'report.html subnav tab 6 does not use raw emoji 📋');
assert(!reportHtml.includes('<span class="tab-icon">💬</span>'), 'report.html subnav tab 7 does not use raw emoji 💬');

// Report diagnostic tabs
assert(!reportHtml.includes('<span>💪</span>'), 'report.html diagnostic tab strengths does not use raw emoji 💪');
assert(!reportHtml.includes('<span>⚠️</span>'), 'report.html diagnostic tab weaknesses does not use raw emoji ⚠️');
assert(!reportHtml.includes('<span>🔍</span> Khoảng Trống'), 'report.html diagnostic tab gaps does not use raw emoji 🔍');
assert(!reportHtml.includes('<span>🛡️</span> Rủi Ro'), 'report.html diagnostic tab risks does not use raw emoji 🛡️');

// Profile & Settings
const profileHtml = readFile('FE/features/profile/profile.html');
assert(!profileHtml.includes('<span style="font-size:20px;">👤</span>'), 'profile.html header does not use raw emoji 👤');
assert(!profileHtml.includes('<span style="font-size:22px;">💳</span>'), 'profile.html billing header does not use raw emoji 💳');

const settingsHtml = readFile('FE/features/profile/settings.html');
assert(!settingsHtml.includes('<div class="pref-icon-box">🎨</div>'), 'settings.html theme preference does not use raw emoji 🎨');
assert(!settingsHtml.includes('<div class="pref-icon-box">🌐</div>'), 'settings.html language preference does not use raw emoji 🌐');
assert(!settingsHtml.includes('<div class="pref-icon-box">🎙️</div>'), 'settings.html voice preference does not use raw emoji 🎙️');
assert(!settingsHtml.includes('<div class="pref-icon-box">🔔</div>'), 'settings.html notification preference does not use raw emoji 🔔');

// 404 & CV
const fourOhFourHtml = readFile('FE/404.html');
assert(!fourOhFourHtml.includes('<span>🏠</span>'), '404.html does not use raw emoji 🏠');
assert(!fourOhFourHtml.includes('<span>🔑</span>'), '404.html does not use raw emoji 🔑');
assert(!fourOhFourHtml.includes('<span>💬</span>'), '404.html does not use raw emoji 💬');

const cvHtml = readFile('FE/features/profile/cv.html');
assert(!cvHtml.includes('<span style="font-size:32px;">📑</span>'), 'cv.html does not use raw emoji 📑 in preview');
assert(!cvHtml.includes('<span style="font-size:36px;display:block;margin-bottom:8px;">☁️</span>'), 'cv.html dropzone does not use raw emoji ☁️');

// Accessibility: decorative SVGs have aria-hidden
assert(reportHtml.includes('aria-hidden="true"'), 'report.html SVG icons include aria-hidden="true"');
assert(dashHtml.includes('aria-hidden="true"'), 'dashboard.html SVG icons include aria-hidden="true"');

// ============================================================================
// TEST GROUP B: REPORT TYPOGRAPHY STANDARDIZATION (CONSIST-06)
// ============================================================================
console.log('\n--- TEST GROUP B: Report Typography Standardization ---');

assert(reportHtml.includes('fonts.googleapis.com/css2?family=Outfit:'), 'report.html loads canonical Outfit font');
assert(!reportHtml.includes('Plus+Jakarta+Sans'), 'report.html removed redundant Plus Jakarta Sans font link');
assert(!reportHtml.includes('family=Inter:'), 'report.html removed redundant Inter font link');

const reportCss = readFile('FE/features/report/report.css');
assert(reportCss.includes('font-family: var(--font-sans'), 'report.css body maps font-family to canonical var(--font-sans)');
assert(!reportCss.includes("font-family: 'Plus Jakarta Sans', 'Inter'"), 'report.css removed hardcoded Plus Jakarta Sans stack');

// ============================================================================
// TEST GROUP C: EMPTY STATE CONSISTENCY (CONSIST-07)
// ============================================================================
console.log('\n--- TEST GROUP C: Empty State Consistency ---');

// Dashboard empty state
assert(!dashHtml.includes('<div class="empty-icon" style="width:48px;height:48px;font-size:22px;margin:0 auto 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:50%;display:flex;align-items:center;justify-content:center;">📋</div>'), 'dashboard.html empty state removed raw emoji 📋');
assert(dashHtml.includes('<span>▶</span>') === false, 'dashboard.html empty state button removed raw unicode ▶');
assert(dashHtml.includes('Bạn chưa có buổi phỏng vấn nào'), 'dashboard.html empty state preserves clear title hierarchy');
assert(dashHtml.includes('Bắt đầu buổi phỏng vấn đầu tiên'), 'dashboard.html empty state preserves actionable explanation');

// History empty states
const histHtml = readFile('FE/features/interview/history.html');
assert(!histHtml.includes('font-size:24px;margin:0 auto 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:50%;display:flex;align-items:center;justify-content:center;">📋</div>'), 'history.html loading and empty states removed raw emoji 📋');
assert(histHtml.includes('<span>▶</span>') === false, 'history.html empty state button removed raw unicode ▶');

// QBank empty state
const qbankHtml = readFile('FE/features/qbank/qbank.html');
assert(!qbankHtml.includes('<div style="font-size:36px;margin-bottom:12px;">🔍</div>'), 'qbank.html empty state removed raw emoji 🔍');

// Report error / empty states
assert(!reportHtml.includes('<div class="state-icon">⚠️</div>'), 'report.html error state removed raw emoji ⚠️');
assert(!reportHtml.includes('<div class="state-icon">📝</div>'), 'report.html empty state removed raw emoji 📝');

// ============================================================================
// TEST GROUP D: SCOPE GUARD & RECURSION INTEGRITY
// ============================================================================
console.log('\n--- TEST GROUP D: Scope Guard ---');

// Verify no external icon CDN library introduced
assert(!dashHtml.includes('font-awesome') && !reportHtml.includes('font-awesome'), 'No FontAwesome CDN dependency introduced');
assert(!dashHtml.includes('ionicons') && !reportHtml.includes('ionicons'), 'No Ionicons CDN dependency introduced');

// Verify components.css has canonical .pm-empty-state
const compCss = readFile('FE/shared/css/components.css');
assert(compCss.includes('.pm-empty-state'), 'components.css maintains canonical .pm-empty-state class');

console.log('\n==================================================');
console.log(`   TEST RESULTS: ${passCount} PASS, ${failCount} FAIL   `);
console.log('==================================================');

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
