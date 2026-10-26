/**
 * PREPMATE — P1.5-R3 VERIFICATION SUITE
 * Test: test_p15_r3_product_fit.js
 * Scope: CONSIST-05 Landing Page SWE Assumption Residue & Multi-Industry Showcase
 */

const fs = require('fs');
const path = require('path');
const { resolvePath } = require('../helpers/test-env');
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
console.log(' RUNNING P1.5-R3 PRODUCT FIT & MULTI-INDUSTRY SHOWCASE SUITE');
console.log('════════════════════════════════════════════════════════════════\n');

const indexHtmlPath = resolvePath('FE/index.html');
const landingCssPath = resolvePath('FE/shared/css/landing.css');
const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
const landingCssContent = fs.readFileSync(landingCssPath, 'utf8');

// =========================================================================
// SUITE 1: Hero Simulator Multi-Industry Architecture & Selector
// =========================================================================
console.log('--- Suite 1: Hero Simulator Multi-Industry Architecture & Tabs ---');

test('index.html contains .lp-industry-selector-bar with role="tablist"', () => {
    assert(indexHtmlContent.includes('class="lp-industry-selector-bar"'), 'Selector bar container missing');
    assert(indexHtmlContent.includes('role="tablist"'), 'tablist ARIA role missing on selector bar');
});

test('index.html contains at least 5 industry selector tabs matching core JobFamilies', () => {
    const roles = ['tech', 'marketing', 'finance', 'hr', 'ba'];
    roles.forEach(role => {
        assert(
            indexHtmlContent.includes(`data-role="${role}"`),
            `Missing selector tab for role: ${role}`
        );
    });
});

test('Industry tabs include accessible ARIA attributes (role="tab", aria-selected)', () => {
    assert(indexHtmlContent.includes('role="tab"'), 'role="tab" missing');
    assert(indexHtmlContent.includes('aria-selected="true"'), 'Active tab aria-selected="true" missing');
    assert(indexHtmlContent.includes('aria-selected="false"'), 'Inactive tab aria-selected="false" missing');
});

test('Industry tabs feature SVG vector iconography without emoji reliance', () => {
    const selectorSection = indexHtmlContent.substring(
        indexHtmlContent.indexOf('lp-industry-selector-bar'),
        indexHtmlContent.indexOf('lp-simulator-mockup')
    );
    assert(selectorSection.includes('<svg'), 'Industry tabs must feature SVG vectors');
    assert(!/[\u{1F300}-\u{1FAFF}]/u.test(selectorSection), 'No emojis should be in the selector tabs');
});

// =========================================================================
// SUITE 2: Dynamic Role Scenarios & Elimination of SWE Hardcoded Lock
// =========================================================================
console.log('\n--- Suite 2: Elimination of SWE Lock & Scenario Dataset ---');

test('index.html defines client-side switchHeroIndustry function', () => {
    assert(indexHtmlContent.includes('function switchHeroIndustry('), 'switchHeroIndustry function missing');
});

test('index.html includes HERO_INDUSTRY_SCENARIOS dataset with 5 diverse industries', () => {
    assert(indexHtmlContent.includes('const HERO_INDUSTRY_SCENARIOS = {'), 'HERO_INDUSTRY_SCENARIOS missing');
    assert(indexHtmlContent.includes('tech: {'), 'Tech scenario missing');
    assert(indexHtmlContent.includes('marketing: {'), 'Marketing scenario missing');
    assert(indexHtmlContent.includes('finance: {'), 'Finance scenario missing');
    assert(indexHtmlContent.includes('hr: {'), 'HR scenario missing');
    assert(indexHtmlContent.includes('ba: {'), 'BA scenario missing');
});

test('Hero simulator DOM elements have dedicated IDs for dynamic updates', () => {
    const requiredIds = [
        'heroRoomTitle',
        'heroAiName',
        'heroAiRole',
        'heroAiQuestion',
        'heroCandidateAnswer',
        'heroMetric1Label',
        'heroMetric1Val',
        'heroMetric2Label',
        'heroMetric2Val',
        'heroMetric3Label',
        'heroMetric3Val'
    ];
    requiredIds.forEach(id => {
        assert(indexHtmlContent.includes(`id="${id}"`), `Missing element id: ${id}`);
    });
});

// =========================================================================
// SUITE 3: Domain-Specific Realism Across Scenarios
// =========================================================================
console.log('\n--- Suite 3: Domain-Specific Questioning & STAR Depth ---');

test('Marketing scenario tests funnel drop-off, CAC/LTV, and ROAS optimization', () => {
    assert(indexHtmlContent.includes('Shopee — Growth Marketing Lead'), 'Marketing role missing');
    assert(indexHtmlContent.includes('Lê Thảo My'), 'Marketing interviewer name missing');
    assert(indexHtmlContent.includes('Conversion Rate'), 'Marketing funnel question missing');
    assert(indexHtmlContent.includes('ROAS'), 'Marketing ROAS metric missing');
    assert(indexHtmlContent.includes('voucher freeship'), 'Marketing STAR action missing');
});

test('Finance scenario tests OPEX variance, stress-testing, and cash flow', () => {
    assert(indexHtmlContent.includes('Techcombank — Senior Financial Analyst'), 'Finance role missing');
    assert(indexHtmlContent.includes('Nguyễn Hoàng Long'), 'Finance interviewer name missing');
    assert(indexHtmlContent.includes('OPEX'), 'Finance OPEX probe missing');
    assert(indexHtmlContent.includes('Stress-test'), 'Finance stress-testing missing');
    assert(indexHtmlContent.includes('DPO'), 'Finance working capital action missing');
});

test('HR scenario tests performance turnaround, PIP coaching, and legal compliance', () => {
    assert(indexHtmlContent.includes('VNG Corporation — HR Business Partner'), 'HR role missing');
    assert(indexHtmlContent.includes('Phạm Hương Giang'), 'HR interviewer name missing');
    assert(indexHtmlContent.includes('PIP'), 'HR PIP probe missing');
    assert(indexHtmlContent.includes('tuân thủ lao động'), 'HR compliance response missing');
});

test('BA scenario tests requirement trade-offs, scope creep, and reconciliation risks', () => {
    assert(indexHtmlContent.includes('MoMo — Senior Business Analyst'), 'BA role missing');
    assert(indexHtmlContent.includes('Đỗ Thanh Hải'), 'BA interviewer name missing');
    assert(indexHtmlContent.includes('cổng thanh toán'), 'BA payment feature context missing');
    assert(indexHtmlContent.includes('ma trận rủi ro'), 'BA risk matrix response missing');
});

test('Tech scenario maintains authentic distributed systems and high-availability depth', () => {
    assert(indexHtmlContent.includes('FPT Software — Senior Backend'), 'Tech role missing');
    assert(indexHtmlContent.includes('Trần Minh Vũ'), 'Tech interviewer name missing');
    assert(indexHtmlContent.includes('cache stampede'), 'Tech cache stampede probe preserved');
    assert(indexHtmlContent.includes('Mutex Lock'), 'Tech response preserved');
});

// =========================================================================
// SUITE 4: Design System & Styling Compliance
// =========================================================================
console.log('\n--- Suite 4: Design System Tokens & Styling in landing.css ---');

test('landing.css defines .lp-industry-selector-bar and .lp-industry-tab rules', () => {
    assert(landingCssContent.includes('.lp-industry-selector-bar {'), '.lp-industry-selector-bar CSS missing');
    assert(landingCssContent.includes('.lp-industry-tab {'), '.lp-industry-tab CSS missing');
    assert(landingCssContent.includes('.lp-industry-tab.active {'), '.lp-industry-tab.active CSS missing');
});

test('landing.css uses Design System tokens for tab geometry and typography', () => {
    assert(landingCssContent.includes('var(--pm-font-family'), 'Tab should use --pm-font-family');
    assert(landingCssContent.includes('var(--pm-radius-full'), 'Tab should use --pm-radius-full');
});

test('Industry tabs include focus-visible accessibility styles', () => {
    assert(landingCssContent.includes('.lp-industry-tab:focus-visible'), 'focus-visible style missing');
});

// =========================================================================
// SUITE 5: Core Value Proposition & Scope Boundaries
// =========================================================================
console.log('\n--- Suite 5: Core Value Proposition & Scope Boundaries ---');

test('Hero section preserves core tagline and primary CTA', () => {
    assert(
        indexHtmlContent.includes('Luyện tập đối mặt với nhà tuyển dụng') ||
        indexHtmlContent.includes('Đừng chỉ học câu trả lời'),
        'Hero headline missing'
    );
    assert(
        indexHtmlContent.includes('AI Mock Interview Simulator') ||
        indexHtmlContent.includes('Khám phá theo chuyên ngành') ||
        indexHtmlContent.includes('lp-eyebrow'),
        'Eyebrow tag missing'
    );
    assert(
        indexHtmlContent.includes('Bắt đầu phỏng vấn ngay') ||
        indexHtmlContent.includes('Bắt đầu luyện tập'),
        'Primary CTA missing'
    );
});

test('Backend files remain untouched (No BE changes in R3)', () => {
    const jobFamilyCs = fs.readFileSync(resolvePath('BE/Models/Interview/JobFamily.cs'), 'utf8');
    assert(jobFamilyCs.includes('public static class JobFamily'), 'Backend JobFamily.cs modified unexpectedly');
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
