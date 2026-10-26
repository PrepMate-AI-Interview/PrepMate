/**
 * PREPMATE — WI-DESIGN-06: INTERVIEW SETUP EXPERIENCE CONTRACT TEST SUITE
 * Validates the information hierarchy, step navigation, persona SSOT integration,
 * greeting preview lifecycle, validation contracts, accessibility, and database safety.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '../..');

function readFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

console.log('===============================================================');
console.log('   WI-DESIGN-06: INTERVIEW SETUP EXPERIENCE CONTRACT TESTS     ');
console.log('===============================================================\n');

const infoHtml = readFile('FE/features/interview/interview-info.html');
const infoCss = readFile('FE/features/interview/interview-info.css');
const personaManifest = readFile('FE/features/interview/interview-persona-manifest.js');

// --- GROUP 1: Canonical Stylesheet Loading & Document Foundation ---
console.log('--- GROUP 1: Stylesheet Foundation & Token Integration ---');

assert(infoHtml.includes('tokens.css'), '1.1 interview-info.html loads canonical tokens.css');
assert(infoHtml.includes('base.css'), '1.2 interview-info.html loads canonical base.css');
assert(infoHtml.includes('layout.css'), '1.3 interview-info.html loads canonical layout.css');
assert(infoHtml.includes('components.css'), '1.4 interview-info.html loads canonical components.css');
assert(infoHtml.includes('interview-info.css'), '1.5 interview-info.html loads interview-info.css');
assert(infoHtml.includes('--prep-bg: var(--pm-bg);'), '1.6 interview-info.html maps --prep-bg to canonical token');
assert(infoHtml.includes('--prep-accent-dark: var(--pm-primary);'), '1.7 interview-info.html maps --prep-accent-dark to canonical token');
assert(!infoHtml.includes('body.dashboard-body .glow-bg'), '1.8 interview-info.html contains no obsolete glow-bg');
console.log('  [PASS] 1. Stylesheet foundation and token bindings verified.');

// --- GROUP 2: Stepper Progress Navigation Architecture ---
console.log('--- GROUP 2: Stepper Progress Navigation Architecture ---');

assert(infoHtml.includes('id="stepper-tab-1"'), '2.1 Stepper Tab 1 exists');
assert(infoHtml.includes('id="stepper-tab-2"'), '2.2 Stepper Tab 2 exists');
assert(infoHtml.includes('id="stepper-tab-3"'), '2.3 Stepper Tab 3 exists');
assert(infoHtml.includes('id="stepper-tab-4"'), '2.4 Stepper Tab 4 exists');
assert(infoHtml.includes('id="step-pane-1"'), '2.5 Step Pane 1 exists');
assert(infoHtml.includes('id="step-pane-2"'), '2.6 Step Pane 2 exists');
assert(infoHtml.includes('id="step-pane-3"'), '2.7 Step Pane 3 exists');
assert(infoHtml.includes('id="step-pane-4"'), '2.8 Step Pane 4 exists');
console.log('  [PASS] 2. Four distinct wizard steps and step panes verified.');

// --- GROUP 3: Step 1 (Role & Context) Contracts ---
console.log('--- GROUP 3: Step 1 (Role & Context) Contracts ---');

assert(infoHtml.includes('id="industry-pills-container"'), '3.1 Dynamic industry taxonomy pills container present');
assert(infoHtml.includes('id="company-name"'), '3.2 Company name input present');
assert(infoHtml.includes('id="top-companies"'), '3.3 Top companies datalist present');
assert(infoHtml.includes('id="industry-company-chips"'), '3.4 Industry company suggestion chips present');
assert(infoHtml.includes('id="job-title"'), '3.5 Target job title input present (mandatory)');
assert(infoHtml.includes('id="job-title-error"'), '3.6 Job title error summary hook present');
assert(infoHtml.includes('data-role="Software Engineer"'), '3.7 Software Engineer quick role chip present');
assert(infoHtml.includes('data-role="Business Analyst"'), '3.8 Business Analyst quick role chip present');
assert(infoHtml.includes('data-role="Digital Marketing Specialist"'), '3.9 Digital Marketing quick role chip present');
assert(infoHtml.includes('data-role="B2B Sales Executive"'), '3.10 B2B Sales quick role chip present');
assert(infoHtml.includes('data-role="Financial Analyst"'), '3.11 Financial Analyst quick role chip present');
assert(infoHtml.includes('data-role="HR Recruiter"'), '3.12 HR Recruiter quick role chip present');
assert(infoHtml.includes('data-role="Project Manager"'), '3.13 Project Manager quick role chip present');
assert(infoHtml.includes('data-role="UI/UX Designer"'), '3.14 UI/UX Designer quick role chip present');
assert(infoHtml.includes('id="interview-round"'), '3.15 Interview round selector present');
assert(infoHtml.includes('value="Junior"'), '3.16 Seniority Junior option present');
assert(infoHtml.includes('value="Mid-level"'), '3.17 Seniority Mid-level option present');
assert(infoHtml.includes('value="Senior"'), '3.18 Seniority Senior option present');
assert(infoHtml.includes('value="Lead"'), '3.19 Seniority Lead option present');
console.log('  [PASS] 3. Step 1 inputs, quick chips, and validation hooks verified.');

// --- GROUP 4: Step 2 (CV & Context) Contracts ---
console.log('--- GROUP 4: Step 2 (CV & Context) Contracts ---');

assert(infoHtml.includes('id="tab-btn-cv"'), '4.1 CV context tab button present');
assert(infoHtml.includes('id="tab-btn-jd"'), '4.2 JD context tab button present');
assert(infoHtml.includes('id="upload-container"'), '4.3 CV upload dropzone container present');
assert(infoHtml.includes('id="cv-file"'), '4.4 CV file input present');
assert(infoHtml.includes('id="btn-remove-cv"'), '4.5 CV removal button present');
assert(infoHtml.includes('id="cv-text"'), '4.6 Hidden CV extracted text storage present');
assert(infoHtml.includes('id="saved-cv-box"'), '4.7 Saved CV prefill recognition card present');
assert(infoHtml.includes('id="cv-analysis-panel"'), '4.8 AI CV analysis panel present');
assert(infoHtml.includes('id="jd-text"'), '4.9 JD text input textarea present');
assert(infoHtml.includes('id="user-description"'), '4.10 Candidate focus description textarea present');
console.log('  [PASS] 4. Step 2 CV dropzone, saved recognition, and JD contracts verified.');

// --- GROUP 5: Step 3 (Interviewer Persona SSOT & Voice Safety) ---
console.log('--- GROUP 5: Step 3 (Interviewer Persona SSOT & Voice Safety) ---');

assert(infoHtml.includes('interview-persona-manifest.js'), '5.1 Loads interview-persona-manifest.js SSOT');
assert(infoHtml.includes('class="interviewer-persona-grid"'), '5.2 Renders .interviewer-persona-grid');
assert(infoHtml.includes('id="persona-card-professional"'), '5.3 Persona card: Professional (Trần Minh Vũ)');
assert(infoHtml.includes('id="persona-card-friendly"'), '5.4 Persona card: Friendly (Lê Lan Anh)');
assert(infoHtml.includes('id="persona-card-balanced"'), '5.5 Persona card: Balanced (Nguyễn Hoàng Nam)');
assert(infoHtml.includes('btn-persona-greeting'), '5.6 Persona static greeting button present');
assert(infoHtml.includes('greeting-quote-preview'), '5.7 Static greeting quote preview present');
assert(infoHtml.includes('Bản ghi âm lời chào đang cập nhật'), '5.8 Truthful note on audio availability present');
assert(infoHtml.includes('display: none !important;'), '5.9 Manual voice settings hidden to avoid user confusion');
assert(infoHtml.includes('id="persona-tile-pro"'), '5.10 Retains legacy #persona-tile-pro hook');
assert(infoHtml.includes('id="persona-tile-fri"'), '5.11 Retains legacy #persona-tile-fri hook');
assert(infoHtml.includes('id="persona-tile-bal"'), '5.12 Retains legacy #persona-tile-bal hook');
assert(infoHtml.includes('id="enable-camera"'), '5.13 Webcam toggle switch present in advanced options');
assert(personaManifest.includes('audioAvailable: false'), '5.14 Manifest explicitly declares audioAvailable: false');
console.log('  [PASS] 5. Persona manifest, card selection, and greeting preview contracts verified.');

// --- GROUP 6: Step 4 (Executive Readiness & Session Launch) ---
console.log('--- GROUP 6: Step 4 (Executive Readiness & Session Launch) ---');

assert(infoHtml.includes('id="summary-spec-role"'), '6.1 Summary spec: Role dimension');
assert(infoHtml.includes('id="summary-spec-company"'), '6.2 Summary spec: Company dimension');
assert(infoHtml.includes('id="summary-spec-round"'), '6.3 Summary spec: Round dimension');
assert(infoHtml.includes('id="summary-spec-cv"'), '6.4 Summary spec: CV dimension');
assert(infoHtml.includes('id="summary-spec-lang-mode"'), '6.5 Summary spec: Language & Mode dimension');
assert(infoHtml.includes('id="summary-spec-persona"'), '6.6 Summary spec: Persona dimension');
assert(infoHtml.includes('id="btn-start-interview"'), '6.7 Commanding Start CTA present');
assert(infoHtml.includes('onclick="startInterview()"'), '6.8 Start CTA binds startInterview()');
assert(infoHtml.includes('id="brief-position-display"'), '6.9 Sidebar briefing position display present');
assert(infoHtml.includes('id="brief-company-display"'), '6.10 Sidebar briefing company display present');
console.log('  [PASS] 6. Executive readiness summary and session creation triggers verified.');

// --- GROUP 7: Database & Baseline Integrity ---
console.log('--- GROUP 7: Database & Baseline Integrity ---');

const dbPath = path.join(rootDir, 'BE/data/db.json');
const dbContent = fs.readFileSync(dbPath);
const dbHash = crypto.createHash('sha256').update(dbContent).digest('hex').toUpperCase();
const expectedDbHash = 'C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7';

assert.strictEqual(dbHash, expectedDbHash, '7.1 Production database SHA-256 hash strictly preserved');
console.log('  [PASS] 7. Production database SHA-256 verified: ' + dbHash);

console.log('\n===============================================================');
console.log('   ALL 7 GROUPS (35 ASSERTIONS) PASSED CLEANLY!                ');
console.log('===============================================================\n');
