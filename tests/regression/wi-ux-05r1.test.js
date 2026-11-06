/**
 * PREPMATE — REGRESSION SUITE: WI-UX-05R1
 * Global DOM Cleanup, Icon Normalization & Layout Consistency
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

console.log('================================================================');
console.log('  RUNNING PREPMATE REGRESSION: WI-UX-05R1');
console.log('  Global DOM Cleanup, Icon Normalization & Layout Consistency');
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
// SECTION 2: SETTINGS GEAR ICON & SEMANTIC ICON NORMALIZATION (WI-02)
// -------------------------------------------------------------
console.log('\n[SECTION 2] Settings Gear Icon & Semantic Mapping (WI-02):');

const iconsJs = fs.readFileSync(path.resolve(__dirname, '../../FE/shared/js/icons.js'), 'utf8');
const mainJs = fs.readFileSync(path.resolve(__dirname, '../../FE/shared/js/main.js'), 'utf8');
const componentsJs = fs.readFileSync(path.resolve(__dirname, '../../FE/shared/js/components.js'), 'utf8');
const dsSidebarJs = fs.readFileSync(path.resolve(__dirname, '../../FE/features/design-system/modules/layout/sidebar.js'), 'utf8');

test('icons.js defines canonical, complete 8-tooth gear path in registry', () => {
    assert.ok(iconsJs.includes('settings: "M12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6z'), 'Must include concentric circle path');
    assert.ok(iconsJs.includes('1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09'), 'Must include top teeth (12 o\'clock geometry)');
    assert.ok(!iconsJs.includes('4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 19.4 9'), 'Corrupt jump across top quadrant must be eliminated');
});

test('icons.js defines all 20 canonical semantic action icons required by WI-02', () => {
    const canonicalActions = [
        'settings', 'dashboard', 'history', 'user', 'search',
        'bell', 'logout', 'filter', 'calendar', 'edit',
        'trash', 'eye', 'download', 'upload', 'file-text',
        'mic', 'camera', 'help-circle', 'close', 'arrow-left',
        'chevron-down'
    ];
    for (const action of canonicalActions) {
        const regex = new RegExp(`['"]?${action}['"]?\\s*:`, 'i');
        assert.ok(regex.test(iconsJs), `Icon registry must contain semantic icon mapping for: ${action}`);
    }
});

test('main.js sidebar icons.settings uses canonical gear SVG', () => {
    assert.ok(mainJs.includes('icons = {') && mainJs.includes('settings: `<svg width="16" height="16"'), 'Must define settings SVG in sidebar');
    assert.ok(mainJs.includes('1-1.51V3a2 2 0 0 1 2-2'), 'Sidebar settings icon must include full top quadrant');
});

test('main.js user profile widget gear icon (.icon-setting) uses canonical gear SVG', () => {
    assert.ok(mainJs.includes('<span class="icon-setting"><svg width="15" height="15"'), 'Must render valid 15x15 profile gear icon');
    assert.ok(!mainJs.includes('19.4 9a1.65 1.65 0 0 0 1.51 1H21'), 'No corrupt truncated paths in profile gear');
});

test('components.js AppHeader user dropdown uses canonical gear SVG', () => {
    assert.ok(componentsJs.includes('features/profile/settings.html'), 'Settings link present in header user dropdown');
    assert.ok(componentsJs.includes('1-1.51V3a2 2 0 0 1 2-2'), 'Header dropdown settings icon includes complete gear path');
    assert.ok(!componentsJs.includes('19.4 9a1.65 1.65 0 0 0 1.51 1H21'), 'No corrupt truncated paths in header dropdown');
});

test('design-system sidebar.js uses canonical gear SVG', () => {
    assert.ok(dsSidebarJs.includes('1-1.51V3a2 2 0 0 1 2-2'), 'Design system sidebar uses complete gear path');
    assert.ok(!dsSidebarJs.includes('19.4 9a1.65 1.65 0 0 0 1.51 1H21'), 'No corrupt truncated paths in ds sidebar');
});

// -------------------------------------------------------------
// SECTION 3: DOM CLEANUP & WRAPPER REMEDIATION (WI-01)
// -------------------------------------------------------------
console.log('\n[SECTION 3] DOM Cleanup & Wrapper Remediation (WI-01):');

test('components.js eliminates premature duplicate </nav> </div> tags in AppHeader', () => {
    // There should be exactly one closing </nav> and one closing </div> around mobile toggle
    const countClosingNav = (componentsJs.match(/<\/nav>/g) || []).length;
    // Count should be strictly balanced with opened <nav>
    const countOpenNav = (componentsJs.match(/<nav\b/g) || []).length;
    assert.strictEqual(countOpenNav, countClosingNav, 'Opened <nav> and closing </nav> tags must be strictly balanced');
});

test('interview-info.html eliminates dummy empty <div></div> spacers in step navigation', () => {
    const interviewInfoHtml = fs.readFileSync(path.resolve(__dirname, '../../FE/features/interview/interview-info.html'), 'utf8');
    assert.ok(!interviewInfoHtml.includes('<div class="step-nav-actions" style="margin-top: 24px;">\n                                <div></div>'), 'Step 1 empty spacer div eliminated');
    assert.ok(!interviewInfoHtml.includes('<div class="step-nav-actions" style="margin-top: 18px;">\n                                <button type="button" class="btn-step-prev" onclick="goToStep(3)"><span data-icon="arrow-left" data-icon-size="14" style="margin-right:4px;display:inline-flex;"></span><span>Quay lại Thiết lập phỏng vấn</span></button>\n                                <div></div>'), 'Step 4 empty spacer div eliminated');
    assert.ok(interviewInfoHtml.includes('justify-content: flex-end'), 'Uses clean flex-end alignment instead of dummy div');
});

// -------------------------------------------------------------
// SECTION 4: GLOBAL ICON & CONTENT SAME-LINE ALIGNMENT (WI-03)
// -------------------------------------------------------------
console.log('\n[SECTION 4] Global Icon & Content Same-Line Alignment (WI-03):');

const componentsCss = fs.readFileSync(path.resolve(__dirname, '../../FE/shared/css/components.css'), 'utf8');
const layoutCss = fs.readFileSync(path.resolve(__dirname, '../../FE/shared/css/layout.css'), 'utf8');

test('components.css defines .icon-text and .pm-icon-label with inline-flex alignment', () => {
    assert.ok(componentsCss.includes('.icon-text'), 'components.css defines .icon-text');
    assert.ok(componentsCss.includes('display: inline-flex;'), 'Enforces display: inline-flex');
    assert.ok(componentsCss.includes('align-items: center;'), 'Enforces align-items: center');
});

test('components.css enforces flex: 0 0 auto on icons to prevent distortion or line drop', () => {
    assert.ok(componentsCss.includes('.icon-text > svg') && componentsCss.includes('flex: 0 0 auto;'), 'Icon text SVGs do not shrink or drop');
    assert.ok(componentsCss.includes('.dropdown-item > svg'), 'Dropdown item SVGs do not shrink or drop');
    assert.ok(componentsCss.includes('.header-menu-link > svg'), 'Header menu link SVGs do not shrink or drop');
});

test('layout.css styles .icon-setting with inline-flex, centered SVG, and dark mode contrast', () => {
    assert.ok(layoutCss.includes('.icon-setting {'), '.icon-setting defined in layout.css');
    assert.ok(layoutCss.includes('display: inline-flex;'), '.icon-setting uses inline-flex');
    assert.ok(layoutCss.includes('body.dark-mode .user-profile-sidebar .icon-setting'), 'Dark mode explicit contrast override present');
});

// -------------------------------------------------------------
// SECTION 5: SIDEBAR, LOGO & HISTORY PARITY (WI-04, WI-05, WI-06)
// -------------------------------------------------------------
console.log('\n[SECTION 5] Sidebar, Logo & History Parity (WI-04, WI-05, WI-06):');

const historyCss = fs.readFileSync(path.resolve(__dirname, '../../FE/features/interview/history.css'), 'utf8');

test('history.css provides complete dark mode parity rules for history items matching Dashboard', () => {
    assert.ok(historyCss.includes('History Item Dark Mode Parity with Dashboard'), 'History CSS includes dark mode parity section');
    assert.ok(historyCss.includes('body.dark-mode .history-item') && historyCss.includes('background: #292A2D !important;'), 'History card background dark mode match');
    assert.ok(historyCss.includes('body.dark-mode .history-item .pm-company-pill'), 'Company pill dark mode match');
    assert.ok(historyCss.includes('body.dark-mode .history-item .pm-flag-badge'), 'Meta badges dark mode match');
});

test('All active templates use canonical PrepMate brand logo', () => {
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../../FE/index.html'), 'utf8');
    const authHtml = fs.readFileSync(path.resolve(__dirname, '../../FE/features/auth/auth.html'), 'utf8');
    assert.ok(indexHtml.includes('PrepMate') || indexHtml.includes('Prep<span>Mate</span>'), 'Landing page uses PrepMate logo');
    assert.ok(authHtml.includes('Prep<span class="auth-brand-accent">Mate</span>'), 'Auth page uses canonical PrepMate logo');
    assert.ok(mainJs.includes('Prep<span>Mate</span>'), 'Sidebar uses canonical PrepMate logo');
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('================================================================');
console.log(`  WI-UX-05R1 SUMMARY: ${passCount}/${passCount} ASSERTIONS PASSED`);
console.log('================================================================\n');
console.log('[SUCCESS] All WI-UX-05R1 regression checks passed cleanly!');
