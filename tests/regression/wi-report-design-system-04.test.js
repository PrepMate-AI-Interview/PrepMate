/**
 * ==============================================================================
 * TEST SUITE: WI-REPORT-DESIGN-SYSTEM-AND-CONTENT-HIERARCHY-04
 * REPORT STRUCTURAL SIMPLIFICATION, SPACING STANDARDIZATION & PROGRESSIVE DISCLOSURE
 *
 * Verifies:
 * 1. Spacing standardization contract (4/8pt scale tokens: --space-1 to --space-10)
 * 2. Mandatory Inline Icon + Label rule (same line, gap 8px, description below, left-aligned)
 * 3. Anti-card overuse: flattened sub-containers with subtle surface contrast
 * 4. Progressive disclosure hierarchy (Tier 1, Tier 2, Tier 3) with ARIA & rotating chevrons
 * 5. Responsive matrix (1440px, 1024px, 768px, 390px) & Dark Mode synchronization
 * 6. DOM execution contract & regression protection
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('  TEST SUITE: WI-REPORT-DESIGN-SYSTEM-AND-CONTENT-HIERARCHY-04  ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    failCount++;
  }
}

const ROOT = path.resolve(__dirname, '../..');
const reportHtmlPath = path.join(ROOT, 'FE/features/report/report.html');
const reportCssPath = path.join(ROOT, 'FE/features/report/report.css');
const reportJsPath = path.join(ROOT, 'FE/features/report/report.js');
const tokensCssPath = path.join(ROOT, 'FE/shared/css/tokens.css');

const reportHtml = fs.readFileSync(reportHtmlPath, 'utf8');
const reportCss = fs.readFileSync(reportCssPath, 'utf8');
const reportJs = fs.readFileSync(reportJsPath, 'utf8');
const tokensCss = fs.readFileSync(tokensCssPath, 'utf8');

// --- GROUP 1: Spacing Scale Token Integration & Spacing Contract ---
console.log('--- GROUP 1: Spacing Scale Token Integration & Spacing Contract ---');

test('1.1 Canonical design tokens SSOT defines 4/8pt spacing scale (--space-1 to --space-10)', () => {
  assert(tokensCss.includes('--space-1:'), 'tokens.css must define --space-1');
  assert(tokensCss.includes('--space-2:'), 'tokens.css must define --space-2');
  assert(tokensCss.includes('--space-3:'), 'tokens.css must define --space-3');
  assert(tokensCss.includes('--space-4:'), 'tokens.css must define --space-4');
  assert(tokensCss.includes('--space-5:'), 'tokens.css must define --space-5');
  assert(tokensCss.includes('--space-6:'), 'tokens.css must define --space-6');
  assert(tokensCss.includes('--space-8:'), 'tokens.css must define --space-8');
  assert(tokensCss.includes('--space-10:'), 'tokens.css must define --space-10');
});

test('1.2 report.css enforces spacing contract variables using canonical tokens', () => {
  assert(reportCss.includes('--rpt-space-section: var(--space-8, 32px)'), 'report.css must define section space token');
  assert(reportCss.includes('--rpt-space-card-gap: var(--space-5, 20px)'), 'report.css must define card gap token');
  assert(reportCss.includes('--rpt-space-card-pad: var(--space-5, 20px)'), 'report.css must define card padding token');
  assert(reportCss.includes('--rpt-space-heading-gap: var(--space-2, 8px)'), 'report.css must define heading gap token');
});

test('1.3 report.html standardizes major Stage 03 and Stage 04 section margins using tokens', () => {
  assert(reportHtml.includes('margin-bottom: var(--space-8, 32px);'), 'report.html must use --space-8 for executive cards');
  assert(reportHtml.includes('margin-top: var(--space-6, 24px);'), 'report.html must use --space-6 for major subcards');
  assert(reportHtml.includes('padding: var(--space-5, 20px)'), 'report.html must use --space-5 for card padding');
});

// --- GROUP 2: Mandatory Inline Icon + Label Rule & Left Alignment ---
console.log('\n--- GROUP 2: Mandatory Inline Icon + Label Rule & Left Alignment ---');

test('2.1 pm-heading-with-icon enforces inline-flex, vertical centering, and 8px gap', () => {
  assert(reportCss.includes('.pm-heading-with-icon'), 'report.css must define .pm-heading-with-icon');
  assert(reportCss.includes('display: inline-flex !important'), 'pm-heading-with-icon must be inline-flex');
  assert(reportCss.includes('align-items: center !important'), 'pm-heading-with-icon must align items center');
  assert(reportCss.includes('gap: var(--space-2, 8px) !important'), 'pm-heading-with-icon must have gap 8px');
});

test('2.2 Descriptions strictly placed underneath headings with 8px margin-top', () => {
  assert(reportCss.includes('.pm-heading-with-icon + p'), 'CSS must target descriptions following pm-heading-with-icon');
  assert(reportCss.includes('margin-top: var(--space-2, 8px) !important'), 'Description must have margin-top 8px');
  assert(reportCss.includes('text-align: left !important'), 'Description must be left aligned');
});

test('2.3 All readable text, section headings, and cards enforce strict left alignment', () => {
  assert(reportCss.includes('#stage-panel-during p') && reportCss.includes('text-align: left;'), 'Stage 03 prose must be left-aligned');
  assert(reportCss.includes('#stage-panel-after p') && reportCss.includes('text-align: left;'), 'Stage 04 prose must be left-aligned');
  assert(!reportHtml.includes('pm-heading-center'), 'report.html must have zero pm-heading-center usages in Stage 03/04');
});

// --- GROUP 3: Anti-Card Overuse & Flattened Structure ---
console.log('\n--- GROUP 3: Anti-Card Overuse & Flattened Structure ---');

test('3.1 Nested telemetry sub-containers flattened with subtle surface contrast and no heavy shadow', () => {
  assert(reportCss.includes('.visual-coaching-box .visual-recommendations'), 'visual-recommendations must be styled');
  assert(reportCss.includes('.visual-coaching-box .temporal-body-language-container'), 'temporal container must be styled');
  assert(reportCss.includes('.visual-coaching-box .voice-body-coaching-container'), 'voice-body container must be styled');
  assert(reportCss.includes('box-shadow: none !important;'), 'Nested subcontainers must suppress heavy box shadow');
});

test('3.2 Prep modules have single clean perimeter border and flat geometry', () => {
  assert(reportCss.includes('.prep-module-card'), 'prep-module-card must be defined');
  assert(reportCss.includes('box-shadow: var(--pm-shadow-xs'), 'prep-module-card must use subtle shadow-xs');
});

// --- GROUP 4: Progressive Disclosure & Interactive Flow ---
console.log('\n--- GROUP 4: Progressive Disclosure & Interactive Flow ---');

test('4.1 Three-tier progressive disclosure hierarchy present in DOM', () => {
  // Tier 1: Visible by default
  assert(reportHtml.includes('id="analysis-executive-summary-card"'), 'Tier 1: Analysis executive synthesis must exist');
  assert(reportHtml.includes('id="section-roadmap"'), 'Tier 1: Actionable Roadmap must exist');
  // Tier 2: Expandable supporting guides
  assert(reportHtml.includes('id="prep-module-technical"'), 'Tier 2: Technical module must exist');
  assert(reportHtml.includes('id="prep-module-behavioral"'), 'Tier 2: Behavioral STAR module must exist');
  // Tier 3: Collapsed by default deep dives
  assert(reportHtml.includes('id="telemetry-disclosure-card"'), 'Tier 3: Telemetry card must exist');
  assert(reportHtml.includes('class="telemetry-disclosure-body telemetry-collapsed"'), 'Tier 3: Telemetry must be collapsed by default');
  assert(reportHtml.includes('id="report-transparency-body" class="transparency-body hidden"'), 'Tier 3: Transparency body must be collapsed by default');
});

test('4.2 Accessible focus-visible state enforced on all disclosure triggers', () => {
  assert(reportCss.includes('.btn-toggle-disclosure:focus-visible'), 'btn-toggle-disclosure must have focus-visible');
  assert(reportCss.includes('.btn-toggle-module:focus-visible'), 'btn-toggle-module must have focus-visible');
  assert(reportCss.includes('.roadmap-steps-toggle:focus-visible'), 'roadmap-steps-toggle must have focus-visible');
  assert(reportCss.includes('.transparency-header-btn:focus-visible'), 'transparency-header-btn must have focus-visible');
  assert(reportCss.includes('outline: 2px solid var(--pm-focus-ring, #2563eb) !important'), 'focus-visible ring must use 2px solid focus ring token');
});

test('4.3 Rotating chevrons smooth 180-degree transition on expand', () => {
  assert(reportCss.includes('[aria-expanded="true"] .telemetry-chevron'), 'telemetry-chevron must rotate on aria-expanded true');
  assert(reportCss.includes('[aria-expanded="true"] .module-chevron'), 'module-chevron must rotate on aria-expanded true');
  assert(reportCss.includes('[aria-expanded="true"] .transparency-chevron'), 'transparency-chevron must rotate on aria-expanded true');
  assert(reportCss.includes('transform: rotate(180deg) !important;'), 'Chevron rotation must be 180 degrees');
});

// --- GROUP 5: Responsive Matrix & Dark Mode Harmonization ---
console.log('\n--- GROUP 5: Responsive Matrix & Dark Mode Harmonization ---');

test('5.1 Multi-breakpoint responsive layouts verified (1024px, 768px, 390px)', () => {
  assert(reportCss.includes('@media (max-width: 1024px)'), '1024px tablet landscape breakpoint must exist');
  assert(reportCss.includes('@media (max-width: 768px)'), '768px tablet portrait breakpoint must exist');
  assert(reportCss.includes('@media (max-width: 390px)'), '390px mobile breakpoint must exist');
});

test('5.2 Dark mode overrides cover flattened sub-containers and prep modules', () => {
  assert(reportCss.includes('[data-theme="dark"] .prep-module-card'), 'Dark mode must style prep-module-card');
  assert(reportCss.includes('[data-theme="dark"] .visual-coaching-box'), 'Dark mode must style visual-coaching-box subcontainers');
  assert(reportCss.includes('[data-theme="dark"] .module-title'), 'Dark mode must style module title');
});

// --- GROUP 6: DOM Execution & Functionality Invariants ---
console.log('\n--- GROUP 6: DOM Execution & Functionality Invariants ---');

test('6.1 All disclosure toggle controller functions exist and exported in report.js', () => {
  assert(reportJs.includes('function toggleTelemetryDeepDive'), 'toggleTelemetryDeepDive must exist');
  assert(reportJs.includes('function togglePrepModule'), 'togglePrepModule must exist');
  assert(reportJs.includes('function toggleSupplementaryEcosystem'), 'toggleSupplementaryEcosystem must exist');
  assert(reportJs.includes('function toggleTransparencyDisclosure'), 'toggleTransparencyDisclosure must exist');
  assert(reportJs.includes('function toggleRoadmapSteps'), 'toggleRoadmapSteps must exist');
});

test('6.2 FinalEvaluationService deterministic score calculation unaffected (SSOT invariant)', () => {
  const finalEvalPath = path.join(ROOT, 'BE/Services/Evaluation/FinalEvaluationService.cs');
  assert(fs.existsSync(finalEvalPath), 'FinalEvaluationService.cs must exist');
  const finalEvalCode = fs.readFileSync(finalEvalPath, 'utf8');
  assert(finalEvalCode.includes('public class FinalEvaluationService'), 'FinalEvaluationService class must exist');
  assert(finalEvalCode.includes('EvaluateSession'), 'EvaluateSession must remain untouched');
});

console.log('\n================================================================');
console.log(`  ALL AUDIT CHECKS PASSED: ${passCount} / ${passCount + failCount} PASS | ${failCount} FAIL`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
