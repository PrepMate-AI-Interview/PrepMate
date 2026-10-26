/**
 * PrepMate — Shared UI Components Foundation Test Suite
 * Work Item: WI-DESIGN-03
 *
 * Verifies canonical shared UI component contracts in FE/shared/css/components.css:
 * 1. Button System & Icon Buttons
 * 2. Form Controls & Accessible Switches
 * 3. Cards & Content Surfaces
 * 4. Badges, Chips & Status Pills (including Personas)
 * 5. Tabs & Segmented Controls
 * 6. Tables & Numeric Cells
 * 7. Modals & Dropdown Popovers
 * 8. Inline Alerts & Toast System
 * 9. Loading & Empty States
 * 10. Progress Bars & Steppers
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('===============================================================');
console.log('   WI-DESIGN-03: SHARED UI COMPONENTS FOUNDATION TESTS        ');
console.log('===============================================================\n');

const componentsCssPath = path.join(__dirname, '../../FE/shared/css/components.css');
assert.ok(fs.existsSync(componentsCssPath), 'components.css must exist');
const css = fs.readFileSync(componentsCssPath, 'utf8');

let passCount = 0;
let failCount = 0;

function runCheck(desc, fn) {
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}: ${err.message}`);
    failCount++;
  }
}

// ── 1. BUTTON SYSTEM ────────────────────────────────────────────────────────
console.log('--- GROUP 1: Button System & Geometries ---');
runCheck('1.1 Canonical button radius tokens preserved exactly', () => {
  assert(css.includes('border-radius: var(--pm-radius-btn-md, 8px);'), '.btn uses canonical medium radius');
  assert(css.includes('border-radius: var(--pm-radius-btn-sm, 6px);'), '.btn-sm uses canonical small radius');
  assert(css.includes('border-radius: var(--pm-radius-btn-lg, 10px);'), '.btn-lg uses canonical large radius');
  assert(css.includes('border-radius: var(--pm-radius-btn-pill, 9999px);'), '.btn-pill uses canonical pill radius');
});

runCheck('1.2 Primary, secondary, outline, ghost, danger, link variants defined', () => {
  assert(css.includes('.btn-primary'), '.btn-primary must be defined');
  assert(css.includes('.btn-secondary'), '.btn-secondary must be defined');
  assert(css.includes('.btn-outline'), '.btn-outline must be defined');
  assert(css.includes('.btn-ghost'), '.btn-ghost must be defined');
  assert(css.includes('.btn-danger'), '.btn-danger must be defined');
  assert(css.includes('.btn-link'), '.btn-link must be defined');
});

runCheck('1.3 Icon button support (.btn-icon) with size variations', () => {
  assert(css.includes('.btn-icon'), '.btn-icon class must exist');
  assert(css.includes('.btn-icon.btn-sm'), '.btn-icon.btn-sm must exist');
  assert(css.includes('.btn-icon.btn-lg'), '.btn-icon.btn-lg must exist');
});

runCheck('1.4 Loading states supported (.btn.loading and .btn.is-loading)', () => {
  assert(css.includes('.btn.loading'), '.btn.loading must exist');
  assert(css.includes('.btn.is-loading'), '.btn.is-loading must exist');
});

// ── 2. FORM SYSTEM ──────────────────────────────────────────────────────────
console.log('\n--- GROUP 2: Form Controls & Inputs ---');
runCheck('2.1 Canonical form controls (.form-control, .pm-input, .pm-select, .pm-textarea)', () => {
  assert(css.includes('.form-control'), '.form-control must exist');
  assert(css.includes('.pm-input'), '.pm-input must exist');
  assert(css.includes('.pm-select'), '.pm-select must exist');
  assert(css.includes('.pm-textarea'), '.pm-textarea must exist');
});

runCheck('2.2 Validation state styling (.is-invalid)', () => {
  assert(css.includes('.form-control.is-invalid'), '.form-control.is-invalid must exist');
  assert(css.includes('.pm-input.is-invalid'), '.pm-input.is-invalid must exist');
});

runCheck('2.3 Accessible switch / toggle control (.pm-switch / .form-switch)', () => {
  assert(css.includes('.pm-switch'), '.pm-switch class must exist');
  assert(css.includes('.form-switch'), '.form-switch class must exist');
});

// ── 3. CARDS & CONTENT SURFACES ─────────────────────────────────────────────
console.log('\n--- GROUP 3: Cards & Content Surfaces ---');
runCheck('3.1 Canonical card surface (.pm-card, .card) uses tokens and subtle border', () => {
  assert(css.includes('.pm-card') && css.includes('.card'), '.pm-card and .card must be defined');
  assert(css.includes('var(--pm-radius-card, 16px)'), 'card must use canonical card radius token');
});

runCheck('3.2 Compact card (.pm-card-sm) and interactive surface (.pm-card-interactive)', () => {
  assert(css.includes('.pm-card-sm'), '.pm-card-sm must exist');
  assert(css.includes('.pm-card-interactive'), '.pm-card-interactive must exist');
});

runCheck('3.3 Card structure (.pm-card-header, .pm-card-title, .pm-card-body, .pm-card-footer)', () => {
  assert(css.includes('.pm-card-header'), '.pm-card-header must exist');
  assert(css.includes('.pm-card-title'), '.pm-card-title must exist');
  assert(css.includes('.pm-card-body'), '.pm-card-body must exist');
  assert(css.includes('.pm-card-footer'), '.pm-card-footer must exist');
});

// ── 4. BADGES, CHIPS & STATUS PILLS ─────────────────────────────────────────
console.log('\n--- GROUP 4: Badges, Chips & Status Pills ---');
runCheck('4.1 Canonical status badges (.badge, .pm-badge) with semantic variants', () => {
  assert(css.includes('.badge-success'), '.badge-success must exist');
  assert(css.includes('.badge-warning'), '.badge-warning must exist');
  assert(css.includes('.badge-danger'), '.badge-danger must exist');
  assert(css.includes('.badge-info'), '.badge-info must exist');
  assert(css.includes('.badge-neutral'), '.badge-neutral must exist');
});

runCheck('4.2 Interviewer persona badges SSOT (.badge-professional, .badge-friendly, .badge-balanced)', () => {
  assert(css.includes('.badge-professional'), '.badge-professional must exist');
  assert(css.includes('.badge-friendly'), '.badge-friendly must exist');
  assert(css.includes('.badge-balanced'), '.badge-balanced must exist');
});

runCheck('4.3 Neutral filter chips (.pm-chip, .chip)', () => {
  assert(css.includes('.pm-chip'), '.pm-chip must exist');
  assert(css.includes('.chip'), '.chip must exist');
});

runCheck('4.4 Live status pills with dot pulse (.pm-status-pill, .pm-status-dot)', () => {
  assert(css.includes('.pm-status-pill'), '.pm-status-pill must exist');
  assert(css.includes('.pm-status-dot'), '.pm-status-dot must exist');
  assert(css.includes('pmDotPulse'), 'pmDotPulse keyframes must exist');
});

// ── 5. TABS & SEGMENTED CONTROLS ────────────────────────────────────────────
console.log('\n--- GROUP 5: Tabs & Segmented Controls ---');
runCheck('5.1 Tab system (.pm-tabs, .pm-tab, .pm-tab-panel)', () => {
  assert(css.includes('.pm-tabs'), '.pm-tabs must exist');
  assert(css.includes('.pm-tab'), '.pm-tab must exist');
  assert(css.includes('.pm-tab-panel'), '.pm-tab-panel must exist');
});

runCheck('5.2 Mobbin-canonical segmented controls (.pm-segmented-control, .pm-segment-btn)', () => {
  assert(css.includes('.pm-segmented-control'), '.pm-segmented-control must exist');
  assert(css.includes('.pm-segment-btn'), '.pm-segment-btn must exist');
});

// ── 6. TABLE SYSTEM ─────────────────────────────────────────────────────────
console.log('\n--- GROUP 6: Tables & Numeric Formatting ---');
runCheck('6.1 Table wrapper and table styles (.table-responsive, .pm-table)', () => {
  assert(css.includes('.table-responsive'), '.table-responsive must exist');
  assert(css.includes('.pm-table'), '.pm-table must exist');
});

runCheck('6.2 Compact table (.pm-table-sm) and tabular figures (.pm-cell-numeric, .text-num)', () => {
  assert(css.includes('.pm-table-sm'), '.pm-table-sm must exist');
  assert(css.includes('.pm-cell-numeric'), '.pm-cell-numeric must exist');
  assert(css.includes('.text-num'), '.text-num must exist');
});

// ── 7. MODALS & DROPDOWNS ───────────────────────────────────────────────────
console.log('\n--- GROUP 7: Modals & Dropdown Popovers ---');
runCheck('7.1 Modal dialog system (.pm-modal, .pm-modal-backdrop, .pm-modal-header, etc.)', () => {
  assert(css.includes('.pm-modal'), '.pm-modal must exist');
  assert(css.includes('.pm-modal-backdrop'), '.pm-modal-backdrop must exist');
  assert(css.includes('.pm-modal-header'), '.pm-modal-header must exist');
  assert(css.includes('.pm-modal-body'), '.pm-modal-body must exist');
  assert(css.includes('.pm-modal-footer'), '.pm-modal-footer must exist');
});

runCheck('7.2 Dropdown popovers (.pm-dropdown, .pm-dropdown-menu, .pm-dropdown-item)', () => {
  assert(css.includes('.pm-dropdown'), '.pm-dropdown must exist');
  assert(css.includes('.pm-dropdown-menu'), '.pm-dropdown-menu must exist');
  assert(css.includes('.pm-dropdown-item'), '.pm-dropdown-item must exist');
});

// ── 8. ALERTS & TOASTS ──────────────────────────────────────────────────────
console.log('\n--- GROUP 8: Alerts & Toast Feedback ---');
runCheck('8.1 Toast notifications (.pm-toast-container, .pm-toast and semantic variants)', () => {
  assert(css.includes('.pm-toast-container'), '.pm-toast-container must exist');
  assert(css.includes('.pm-toast'), '.pm-toast must exist');
  assert(css.includes('.pm-toast-success'), '.pm-toast-success must exist');
  assert(css.includes('.pm-toast-error'), '.pm-toast-error must exist');
});

runCheck('8.2 Inline alerts (.pm-alert, .alert with semantic variants)', () => {
  assert(css.includes('.pm-alert') && css.includes('.alert'), '.pm-alert and .alert must exist');
  assert(css.includes('.pm-alert-success'), '.pm-alert-success must exist');
  assert(css.includes('.pm-alert-warning'), '.pm-alert-warning must exist');
  assert(css.includes('.pm-alert-danger'), '.pm-alert-danger must exist');
  assert(css.includes('.pm-alert-info'), '.pm-alert-info must exist');
});

// ── 9. LOADING & EMPTY STATES ───────────────────────────────────────────────
console.log('\n--- GROUP 9: Loading & Empty States ---');
runCheck('9.1 Empty and error states (.pm-empty-state, .pm-error-state, .pm-state-mark)', () => {
  assert(css.includes('.pm-empty-state'), '.pm-empty-state must exist');
  assert(css.includes('.pm-error-state'), '.pm-error-state must exist');
  assert(css.includes('.pm-state-mark'), '.pm-state-mark must exist');
});

runCheck('9.2 Spinner and skeleton placeholders (.pm-spinner, .skeleton, .pm-loading-overlay)', () => {
  assert(css.includes('.pm-spinner'), '.pm-spinner must exist');
  assert(css.includes('.skeleton'), '.skeleton must exist');
  assert(css.includes('.pm-loading-overlay'), '.pm-loading-overlay must exist');
});

// ── 10. PROGRESS & STEPPER ──────────────────────────────────────────────────
console.log('\n--- GROUP 10: Progress Bars & Steppers ---');
runCheck('10.1 Progress bar (.pm-progress, .pm-progress-bar)', () => {
  assert(css.includes('.pm-progress'), '.pm-progress must exist');
  assert(css.includes('.pm-progress-bar'), '.pm-progress-bar must exist');
});

runCheck('10.2 Workflow stepper (.pm-stepper, .pm-step, .pm-step-num)', () => {
  assert(css.includes('.pm-stepper'), '.pm-stepper must exist');
  assert(css.includes('.pm-step'), '.pm-step must exist');
  assert(css.includes('.pm-step-num'), '.pm-step-num must exist');
});

console.log('\n===============================================================');
console.log(`   TEST RESULTS: ${passCount} PASS, ${failCount} FAIL`);
console.log('===============================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
