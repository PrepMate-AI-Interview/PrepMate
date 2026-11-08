/**
 * PREPMATE — REGRESSION SUITE: WI-UX-06
 * Sidebar Interaction Polish & Dashboard Overview Optimization
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

console.log('================================================================');
console.log('  RUNNING PREPMATE REGRESSION: WI-UX-06');
console.log('  Sidebar Interaction Polish & Dashboard Overview Optimization');
console.log('================================================================\n');

let passCount = 0;
function test(desc, fn) {
    try {
        fn();
        console.log(`  [PASS] ${desc}`);
        passCount++;
    } catch (err) {
        console.error(`  [FAIL] ${desc}:`, err.message);
        throw err;
    }
}

// -------------------------------------------------------------
// SECTION 1: ARCHITECTURAL INVARIANTS & DB INTEGRITY
// -------------------------------------------------------------
console.log('[SECTION 1] Architectural Invariants & Database Integrity:');

test('db.json SHA-256 hash intact (44223D9B7E945E70CADEB3279AE3EE5A0DD748A867B2C3A6B0C5C617A9DB62C3)', () => {
    const dbPath = path.resolve(__dirname, '../../BE/data/db.json');
    const content = fs.readFileSync(dbPath, 'utf8');
    const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex').toUpperCase();
    assert.strictEqual(hash, '44223D9B7E945E70CADEB3279AE3EE5A0DD748A867B2C3A6B0C5C617A9DB62C3');
});

// -------------------------------------------------------------
// SECTION 2: SIDEBAR TOGGLE BUTTON & SMOOTH TRANSITION (WI-01)
// -------------------------------------------------------------
console.log('\n[SECTION 2] Sidebar Toggle Button & Smooth Transition (WI-01):');

const layoutCss = fs.readFileSync(path.resolve(__dirname, '../../FE/shared/css/layout.css'), 'utf8');
const newDashCss = fs.readFileSync(path.resolve(__dirname, '../../FE/features/dashboard/new-dashboard.css'), 'utf8');
const mainJs = fs.readFileSync(path.resolve(__dirname, '../../FE/shared/js/main.js'), 'utf8');

test('layout.css defines .sidebar-toggle-btn with inline-flex, centered SVG, and zero line-height', () => {
    assert.ok(layoutCss.includes('.sidebar-toggle-btn'), '.sidebar-toggle-btn defined in layout.css');
    assert.ok(layoutCss.includes('display: inline-flex;'), 'Uses inline-flex display');
    assert.ok(layoutCss.includes('align-items: center;'), 'Centered vertically');
    assert.ok(layoutCss.includes('justify-content: center;'), 'Centered horizontally');
    assert.ok(layoutCss.includes('line-height: 0;'), 'Zero line-height for subpixel icon centering');
    assert.ok(layoutCss.includes('flex: 0 0 auto;'), 'Prevents flex distortion');
});

test('layout.css enables pointer-events: none on .sidebar-toggle-btn svg for reliable hit target', () => {
    assert.ok(layoutCss.includes('.sidebar-toggle-btn svg') && layoutCss.includes('pointer-events: none;'), 'SVG does not intercept clicks');
});

test('layout.css prevents label wrapping during sidebar collapse/expand animation', () => {
    assert.ok(layoutCss.includes('.logo-text-group') && layoutCss.includes('white-space: nowrap;'), 'Logo text does not wrap during animation');
    assert.ok(layoutCss.includes('.nav-section-label') && layoutCss.includes('white-space: nowrap;'), 'Nav section labels do not wrap');
    assert.ok(layoutCss.includes('.nav-new a .nav-label') && layoutCss.includes('white-space: nowrap;'), 'Nav link labels do not wrap');
});

test('layout.css respects prefers-reduced-motion for sidebar and toggle button', () => {
    assert.ok(layoutCss.includes('@media (prefers-reduced-motion: reduce)'), 'prefers-reduced-motion media query present');
    assert.ok(layoutCss.includes('.sidebar-new,') && layoutCss.includes('.sidebar-toggle-btn,'), 'Includes sidebar and toggle button');
});

test('main.js handles toggleSidebarCollapse and saves state in localStorage', () => {
    assert.ok(mainJs.includes('function toggleSidebarCollapse()'), 'toggleSidebarCollapse defined');
    assert.ok(mainJs.includes('prepmate_sidebar_collapsed'), 'Saves prepmate_sidebar_collapsed state');
    assert.ok(mainJs.includes('applySidebarCollapseState(willCollapse)'), 'Applies state synchronously');
});

// -------------------------------------------------------------
// SECTION 3: DASHBOARD INFORMATION HIERARCHY & HERO (WI-02, WI-03, WI-04)
// -------------------------------------------------------------
console.log('\n[SECTION 3] Dashboard Information Hierarchy & Hero (WI-02, WI-03, WI-04):');

const dashHtml = fs.readFileSync(path.resolve(__dirname, '../../FE/features/dashboard/dashboard.html'), 'utf8');

test('dashboard.html defines structured page title row (.dashboard-header-row)', () => {
    assert.ok(/class="[^"]*dashboard-header-row[^"]*"/.test(dashHtml), 'dashboard-header-row present');
    assert.ok(/class="[^"]*dashboard-page-title[^"]*"/.test(dashHtml), 'dashboard-page-title present');
    assert.ok(dashHtml.includes('Tổng quan'), 'Features concise "Tổng quan" title');
});

test('dashboard.html preserves primary interview action CTA (.btn-start-interview)', () => {
    assert.ok(dashHtml.includes('class="btn-start-interview"'), 'btn-start-interview present');
    assert.ok(dashHtml.includes('Bắt đầu phỏng vấn mới'), 'Direct CTA label');
    assert.ok(dashHtml.includes('../../features/interview/interview-info.html'), 'Routes to interview-info.html');
});

test('dashboard.html displays 3 core KPI metrics with honest empty state hooks', () => {
    assert.ok(dashHtml.includes('id="stat-sessions"'), 'Hook for completed sessions');
    assert.ok(dashHtml.includes('id="stat-avg-score"'), 'Hook for average score');
    assert.ok(dashHtml.includes('id="stat-avg-score-lbl"'), 'Hook for average score label');
    assert.ok(dashHtml.includes('id="stat-time"'), 'Hook for practice time');
    assert.ok(dashHtml.includes('id="stat-sessions-total"'), 'Hook for total sessions compatibility');
});

test('dashboard.html retains executive readiness pillars with compact styling', () => {
    assert.ok(dashHtml.includes('class="readiness-grid"'), 'readiness-grid preserved');
    assert.ok(dashHtml.includes('Chuyên môn'), 'Specialty pillar present');
    assert.ok(dashHtml.includes('Giao tiếp & Thuyết phục'), 'Communication pillar present');
    assert.ok(dashHtml.includes('Mô hình STAR'), 'STAR methodology pillar present');
    assert.ok(dashHtml.includes('Phản xạ Đào sâu (Follow-up)'), 'Follow-up pillar present');
});

test('new-dashboard.css defines compact and high-contrast styles for .readiness-card', () => {
    assert.ok(newDashCss.includes('.readiness-card'), 'readiness-card styled');
    assert.ok(newDashCss.includes('.readiness-icon-box'), 'readiness-icon-box styled');
    assert.ok(newDashCss.includes('.dashboard-badge-pill'), 'dashboard-badge-pill styled');
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('================================================================');
console.log(`  WI-UX-06 SUMMARY: ${passCount}/${passCount} ASSERTIONS PASSED`);
console.log('================================================================\n');
console.log('[SUCCESS] All WI-UX-06 regression checks passed cleanly!');
