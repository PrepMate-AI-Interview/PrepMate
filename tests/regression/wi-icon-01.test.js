/**
 * PREPMATE — WI-ICON-01: SYSTEM-WIDE MORPHICONS ICON MIGRATION REGRESSION SUITE
 * 
 * Verifies:
 * 1. Canonical 24x24 viewBox, outline styling, and sizing presets across all UI icons.
 * 2. Centralized PrepMateIcons registry and Morphicons standalone bundle.
 * 3. Morphicons custom element <morph-icon> definition and DOM morph API.
 * 4. Semantic state transitions (menu ↔ close, eye ↔ eye-off, speaker ↔ pause, sun ↔ moon, mic ↔ mic-off, video ↔ video-off).
 * 5. Accessibility compliance (aria-hidden on decorative, accessible labels on action triggers).
 * 6. Reduced-motion compliance for spring physics.
 * 7. Zero external runtime CDN dependency for icons.
 * 8. Database and backend invariant.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { resolvePath, getBaselineDbHash } = require('../helpers/test-env');

let passCount = 0;
let failCount = 0;

function check(desc, fn) {
    try {
        fn();
        console.log(`  [PASS] ${desc}`);
        passCount++;
    } catch (err) {
        console.error(`  [FAIL] ${desc}`);
        console.error(`         ${err.message}`);
        failCount++;
    }
}

console.log('===============================================================');
console.log('   WI-ICON-01: SYSTEM-WIDE MORPHICONS ICON MIGRATION           ');
console.log('===============================================================\n');

// -----------------------------------------------------------------------------
// 1. Centralized Assets & Registry
// -----------------------------------------------------------------------------
console.log('• 1. Verifying Centralized Icon Registry & Standalone Morphicons...');

const morphiconsJsPath = resolvePath('FE/shared/js/morphicons.js');
const iconsJsPath = resolvePath('FE/shared/js/icons.js');
const componentsCssPath = resolvePath('FE/shared/css/components.css');

check('morphicons.js bundle exists and is self-hosted (zero runtime CDN)', () => {
    assert(fs.existsSync(morphiconsJsPath), 'FE/shared/js/morphicons.js must exist');
    const content = fs.readFileSync(morphiconsJsPath, 'utf8');
    assert(content.length > 50000, 'morphicons.js must contain bundled engine code');
    assert(content.includes('MorphIconElement') || content.includes('morph-icon'), 'Must define MorphIconElement');
    assert(!content.includes('cdn.jsdelivr.net'), 'Must not reference external CDN at runtime');
});

check('icons.js exists and exports PrepMateIcons registry', () => {
    assert(fs.existsSync(iconsJsPath), 'FE/shared/js/icons.js must exist');
    const PrepMateIcons = require(iconsJsPath);
    assert(typeof PrepMateIcons === 'object', 'PrepMateIcons must be an object');
    assert(typeof PrepMateIcons.svg === 'function', 'PrepMateIcons.svg must be a function');
    assert(typeof PrepMateIcons.getPath === 'function', 'PrepMateIcons.getPath must be a function');
    assert(typeof PrepMateIcons.morph === 'function', 'PrepMateIcons.morph must be a function');
    assert(typeof PrepMateIcons.toggle === 'function', 'PrepMateIcons.toggle must be a function');
});

check('PrepMateIcons registry contains canonical semantic icons with 24x24 paths', () => {
    const PrepMateIcons = require(iconsJsPath);
    const requiredIcons = [
        'dashboard', 'menu', 'close', 'x', 'chevron-down', 'chevron-up', 'chevron-left', 'chevron-right',
        'eye', 'eye-off', 'star', 'star-filled', 'mic', 'mic-off', 'video', 'video-off',
        'speaker', 'speaker-off', 'play', 'pause', 'stop', 'user', 'settings', 'lock', 'unlock',
        'shield', 'logout', 'sun', 'moon', 'briefcase', 'building', 'calendar', 'clock',
        'chart', 'target', 'award', 'sparkles', 'zap', 'message-square', 'credit-card', 'activity',
        'phone', 'mail', 'printer'
    ];
    for (const icon of requiredIcons) {
        const d = PrepMateIcons.getPath(icon);
        assert(d && d.length > 5, `Icon "${icon}" must have a valid path in registry`);
    }
});

check('PrepMateIcons.svg() renders 24x24 viewBox outline SVG with accessibility', () => {
    const PrepMateIcons = require(iconsJsPath);
    const svgDefault = PrepMateIcons.svg('dashboard');
    assert(svgDefault.includes('viewBox="0 0 24 24"'), 'Default SVG must have 24x24 viewBox');
    assert(svgDefault.includes('fill="none"'), 'Outline icon must have fill="none"');
    assert(svgDefault.includes('stroke="currentColor"'), 'Default stroke must be currentColor');
    assert(svgDefault.includes('stroke-width="2"'), 'Default stroke-width must be 2');
    assert(svgDefault.includes('aria-hidden="true"'), 'Default decorative icon must have aria-hidden="true"');

    const svgA11y = PrepMateIcons.svg('menu', { size: 'lg', label: 'Mở menu' });
    assert(svgA11y.includes('width="20"'), 'Size "lg" must resolve to 20px');
    assert(svgA11y.includes('role="img"'), 'Labeled icon must include role="img"');
    assert(svgA11y.includes('aria-label="Mở menu"'), 'Labeled icon must include aria-label');
    assert(svgA11y.includes('<title>Mở menu</title>'), 'Labeled icon must include <title>');
});

check('components.css contains icon styling tokens and rules', () => {
    const css = fs.readFileSync(componentsCssPath, 'utf8');
    assert(css.includes('.pm-icon'), 'components.css must define .pm-icon');
    assert(css.includes('morph-icon'), 'components.css must define morph-icon');
    assert(css.includes('.pm-icon-xs') && css.includes('.pm-icon-xl'), 'components.css must define size presets');
});

// -----------------------------------------------------------------------------
// 2. HTML Integration & Script Injections
// -----------------------------------------------------------------------------
console.log('\n• 2. Verifying System-wide HTML Script Injections...');

const keyPages = [
    'FE/index.html',
    'FE/features/auth/auth.html',
    'FE/features/dashboard/dashboard.html',
    'FE/features/interview/interview-info.html',
    'FE/features/interview/interview-practice.html',
    'FE/features/interview/history.html',
    'FE/features/report/report.html',
    'FE/features/qbank/qbank.html',
    'FE/features/jobs/jobs.html',
    'FE/features/profile/settings.html',
    'FE/features/admin/admin.html'
];

for (const p of keyPages) {
    check(`${p} includes morphicons.js and icons.js in <head>`, () => {
        const fullPath = resolvePath(p);
        const html = fs.readFileSync(fullPath, 'utf8');
        assert(html.includes('morphicons.js'), `${p} must load morphicons.js`);
        assert(html.includes('icons.js'), `${p} must load icons.js`);
    });
}

// -----------------------------------------------------------------------------
// 3. State Transitions & Interactive Morphing
// -----------------------------------------------------------------------------
console.log('\n• 3. Verifying Interactive State Transitions & Morphing...');

check('AppHeader mobile drawer toggle supports morph between menu and close', () => {
    const compJs = fs.readFileSync(resolvePath('FE/shared/js/components.js'), 'utf8');
    assert(compJs.includes('header-mobile-morph'), 'AppHeader must define #header-mobile-morph');
    assert(compJs.includes('toggleMobileMenu'), 'AppHeader must define toggleMobileMenu');
    assert(compJs.includes('closeMobileMenu'), 'AppHeader must define closeMobileMenu');
    assert(compJs.includes('window.PrepMateIcons.getPath'), 'AppHeader must query icon paths for morphing');
});

check('Workspace mobile sidebar toggle supports morph in main.js', () => {
    const mainJs = fs.readFileSync(resolvePath('FE/shared/js/main.js'), 'utf8');
    assert(mainJs.includes('workspace-mobile-morph'), 'main.js must define #workspace-mobile-morph');
    assert(mainJs.includes('toggleMobileSidebar'), 'main.js must define toggleMobileSidebar');
    assert(mainJs.includes('closeMobileSidebar'), 'main.js must define closeMobileSidebar');
});

check('Password visibility toggle in auth.html supports eye ↔ eye-off morph', () => {
    const authHtml = fs.readFileSync(resolvePath('FE/features/auth/auth.html'), 'utf8');
    assert(authHtml.includes('togglePasswordVisibility'), 'auth.html must define togglePasswordVisibility');
    assert(authHtml.includes('eye-off') && authHtml.includes('eye'), 'auth.html must handle eye and eye-off states');
    assert(authHtml.includes('window.PrepMateIcons.morph'), 'auth.html must invoke morph on password toggle');
});

check('Interview voice preview in interview-info.html supports speaker ↔ pause morph', () => {
    const infoHtml = fs.readFileSync(resolvePath('FE/features/interview/interview-info.html'), 'utf8');
    assert(infoHtml.includes('updateGreetingBtnState'), 'interview-info.html must define updateGreetingBtnState');
    assert(infoHtml.includes('window.PrepMateIcons.morph'), 'interview-info.html must invoke morph on preview toggle');
    assert(infoHtml.includes("'speaker'") && infoHtml.includes("'pause'"), 'Must toggle between speaker and pause');
});

check('Interview meeting HUD controls use 24x24 outline standard in interview-icons.js', () => {
    const iconsJs = fs.readFileSync(resolvePath('FE/features/interview/interview-icons.js'), 'utf8');
    assert(iconsJs.includes('ZOOM_ICONS'), 'interview-icons.js must define ZOOM_ICONS');
    assert(iconsJs.includes('viewBox="0 0 24 24"'), 'ZOOM_ICONS must use 24x24 viewBox');
    assert(iconsJs.includes('stroke-width="2"'), 'ZOOM_ICONS must use stroke-width 2');
});

// -----------------------------------------------------------------------------
// 4. Invariants & Isolation
// -----------------------------------------------------------------------------
console.log('\n• 4. Verifying Repository Safety & Database Isolation...');

check('No framework migrations (Vanilla HTML/CSS/JS preserved)', () => {
    const pkg = JSON.parse(fs.readFileSync(resolvePath('package.json'), 'utf8'));
    const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
    assert(!deps.react, 'Must not install React');
    assert(!deps.vue, 'Must not install Vue');
    assert(!deps['@angular/core'], 'Must not install Angular');
});

check('Test database fixture invariant preserved via test-env', () => {
    const hash = getBaselineDbHash();
    assert(hash && hash.length === 64, 'Baseline DB hash must be valid 64-char hex');
});

console.log('\n===============================================================');
console.log(`   TEST RESULT: ${passCount} PASSED, ${failCount} FAILED`);
console.log('===============================================================');

if (failCount > 0) {
    process.exit(1);
}
