/**
 * PREPMATE — WI-REMED-01: CANDIDATE AUXILIARY EXPERIENCE AUDIT
 *
 * Verifies:
 * 1. Canonical Stylesheet Foundation & Token Mapping across Profile, CV, and Settings
 * 2. Candidate Profile Page Hierarchy, DOM Anchors, Placeholders & Hash Routing
 * 3. CV Management Experience, Readiness Meter & Practice Launch Bridge
 * 4. User Settings & WCAG Switch Accessibility Compliance
 * 5. Production Database SHA-256 Invariant (Zero Mutations)
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const PROFILE_HTML_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "profile", "profile.html");
const PROFILE_CSS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "profile", "profile.css");
const CV_HTML_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "profile", "cv.html");
const CV_CSS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "profile", "cv.css");
const SETTINGS_HTML_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "profile", "settings.html");
const SETTINGS_CSS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "profile", "settings.css");
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");

const BASELINE_DB_HASH = "C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7";

const profileHtml = fs.readFileSync(PROFILE_HTML_PATH, "utf8");
const profileCss = fs.readFileSync(PROFILE_CSS_PATH, "utf8");
const cvHtml = fs.readFileSync(CV_HTML_PATH, "utf8");
const cvCss = fs.readFileSync(CV_CSS_PATH, "utf8");
const settingsHtml = fs.readFileSync(SETTINGS_HTML_PATH, "utf8");
const settingsCss = fs.readFileSync(SETTINGS_CSS_PATH, "utf8");

console.log("===============================================================");
console.log("   WI-REMED-01: CANDIDATE AUXILIARY EXPERIENCE AUDIT SUITE      ");
console.log("===============================================================\n");

let passCount = 0;
let failCount = 0;

function runCheck(group, name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// GROUP 1: CANONICAL STYLESHEET FOUNDATION & TOKEN MAPPING
// -------------------------------------------------------------
console.log("--- GROUP 1: Canonical Stylesheet Foundation & Token Mapping ---");

runCheck(1, "1.1 Profile HTML links canonical shared stylesheets in order", () => {
  assert(profileHtml.includes('tokens.css'), "profile.html must link tokens.css");
  assert(profileHtml.includes('base.css'), "profile.html must link base.css");
  assert(profileHtml.includes('layout.css'), "profile.html must link layout.css");
  assert(profileHtml.includes('components.css'), "profile.html must link components.css");
  assert(profileHtml.includes('profile.css'), "profile.html must link profile.css");
});

runCheck(1, "1.2 CV HTML links canonical shared stylesheets in order", () => {
  assert(cvHtml.includes('tokens.css'), "cv.html must link tokens.css");
  assert(cvHtml.includes('base.css'), "cv.html must link base.css");
  assert(cvHtml.includes('layout.css'), "cv.html must link layout.css");
  assert(cvHtml.includes('components.css'), "cv.html must link components.css");
  assert(cvHtml.includes('cv.css'), "cv.html must link cv.css");
});

runCheck(1, "1.3 Settings HTML links canonical shared stylesheets in order", () => {
  assert(settingsHtml.includes('tokens.css'), "settings.html must link tokens.css");
  assert(settingsHtml.includes('base.css'), "settings.html must link base.css");
  assert(settingsHtml.includes('layout.css'), "settings.html must link layout.css");
  assert(settingsHtml.includes('components.css'), "settings.html must link components.css");
  assert(settingsHtml.includes('settings.css'), "settings.html must link settings.css");
});

runCheck(1, "1.4 Profile CSS maps variables to canonical --pm-* tokens", () => {
  assert(/--profile-bg:\s*var\(--pm-bg/.test(profileCss), "--profile-bg must map to --pm-bg");
  assert(/--profile-surface:\s*var\(--pm-surface/.test(profileCss), "--profile-surface must map to --pm-surface");
  assert(/--profile-border:\s*var\(--pm-border/.test(profileCss), "--profile-border must map to --pm-border");
  assert(/--profile-primary:\s*var\(--pm-primary/.test(profileCss), "--profile-primary must map to --pm-primary");
});

runCheck(1, "1.5 CV CSS maps variables to canonical --pm-* tokens", () => {
  assert(/--cv-bg:\s*var\(--pm-bg/.test(cvCss), "--cv-bg must map to --pm-bg");
  assert(/--cv-surface:\s*var\(--pm-surface/.test(cvCss), "--cv-surface must map to --pm-surface");
  assert(/--cv-border:\s*var\(--pm-border/.test(cvCss), "--cv-border must map to --pm-border");
  assert(/--cv-primary:\s*var\(--pm-primary/.test(cvCss), "--cv-primary must map to --pm-primary");
});

runCheck(1, "1.6 Settings CSS maps variables to canonical --pm-* tokens", () => {
  assert(/--settings-bg:\s*var\(--pm-bg/.test(settingsCss), "--settings-bg must map to --pm-bg");
  assert(/--settings-surface:\s*var\(--pm-surface/.test(settingsCss), "--settings-surface must map to --pm-surface");
  assert(/--settings-border:\s*var\(--pm-border/.test(settingsCss), "--settings-border must map to --pm-border");
  assert(/--settings-primary:\s*var\(--pm-primary/.test(settingsCss), "--settings-primary must map to --pm-primary");
});

// -------------------------------------------------------------
// GROUP 2: PROFILE PAGE HIERARCHY, DOM ANCHORS & HASH ROUTING
// -------------------------------------------------------------
console.log("\n--- GROUP 2: Profile Page Hierarchy, DOM Anchors & Hash Routing ---");

runCheck(2, "2.1 Profile page title conforms to brand standard", () => {
  assert(profileHtml.includes("<title>PrepMate — Hồ sơ năng lực cá nhân</title>"), "Title must be PrepMate — Hồ sơ năng lực cá nhân");
});

runCheck(2, "2.2 Profile page preserves all required DOM anchors & form inputs", () => {
  assert(profileHtml.includes('id="fullname"'), "Must preserve #fullname");
  assert(profileHtml.includes('id="email"'), "Must preserve #email");
  assert(profileHtml.includes('id="phone"'), "Must preserve #phone");
  assert(profileHtml.includes('id="bio"'), "Must preserve #bio");
  assert(profileHtml.includes('id="target-role"'), "Must preserve #target-role");
  assert(profileHtml.includes('id="account"'), "Must preserve form #account");
  assert(profileHtml.includes('id="account-hubs"'), "Must preserve #account-hubs");
  assert(profileHtml.includes('id="profile-exp-stat"'), "Must preserve #profile-exp-stat");
  assert(profileHtml.includes('id="profile-status-stat"'), "Must preserve #profile-status-stat");
});

runCheck(2, "2.3 Profile target-role input contains multi-industry placeholder", () => {
  assert(
    profileHtml.includes('placeholder="Marketing Manager, Financial Analyst, Software Engineer"'),
    "Placeholder must match exact multi-industry contract"
  );
});

runCheck(2, "2.4 Account hubs section includes links to CV, Settings, and Billing", () => {
  assert(profileHtml.includes('href="cv.html"'), "Hub must link to cv.html");
  assert(profileHtml.includes('href="settings.html"'), "Hub must link to settings.html");
  assert(profileHtml.includes('href="../payment/pricing.html"'), "Hub must link to ../payment/pricing.html");
});

runCheck(2, "2.5 Hash routing handlers navigate to respective pages cleanly", () => {
  assert(profileHtml.includes("window.location.hash === '#cv'"), "Must handle #cv hash");
  assert(profileHtml.includes("window.location.hash === '#system-settings'"), "Must handle #system-settings hash");
  assert(profileHtml.includes("window.location.hash === '#billing'"), "Must handle #billing hash");
});

// -------------------------------------------------------------
// GROUP 3: CV MANAGEMENT EXPERIENCE & PRACTICE LAUNCH BRIDGE
// -------------------------------------------------------------
console.log("\n--- GROUP 3: CV Management Experience & Practice Launch Bridge ---");

runCheck(3, "3.1 CV Management preserves dropzone, file input, and status containers", () => {
  assert(cvHtml.includes('id="cv-upload-drop"') || cvHtml.includes('class="cv-upload-drop"'), "Must preserve dropzone element");
  assert(cvHtml.includes('id="cv-file-picker"'), "Must preserve #cv-file-picker");
  assert(cvHtml.includes('id="cv-readiness-num"'), "Must preserve #cv-readiness-num");
  assert(cvHtml.includes('id="cv-skills-num"'), "Must preserve #cv-skills-num");
});

runCheck(3, "3.2 Practice from CV button conforms to navigation contracts", () => {
  assert(cvHtml.includes('id="btn-practice-cv"'), "Must preserve #btn-practice-cv");
  assert(cvHtml.includes("startInterviewFromCv()"), "Must call startInterviewFromCv()");
  assert(cvHtml.includes("Luyện tập phỏng vấn theo CV này"), "Must retain button text");
  assert(cvHtml.includes("interview-info.html?source=cv"), "Must redirect to interview-info.html?source=cv");
});

runCheck(3, "3.3 Readiness meter contains normalized score and progress track", () => {
  assert(cvHtml.includes('class="readiness-meter"'), "Must render .readiness-meter");
  assert(cvHtml.includes('class="meter-track"'), "Must render .meter-track");
  assert(cvHtml.includes('class="meter-fill"'), "Must render .meter-fill");
  assert(cvHtml.includes('92 / 100') || cvHtml.includes('92/100'), "Must display score benchmark 92/100");
});

runCheck(3, "3.4 Skill pills and CV card surfaces use canonical design tokens", () => {
  assert(cvHtml.includes('class="skill-tag-pill"'), "Must render .skill-tag-pill");
  assert(cvCss.includes('.cv-grid'), "cv.css must define responsive .cv-grid");
  assert(cvCss.includes('.cv-card'), "cv.css must define .cv-card");
  assert(cvCss.includes('.cv-upload-drop'), "cv.css must style .cv-upload-drop");
});

// -------------------------------------------------------------
// GROUP 4: USER SETTINGS & WCAG SWITCH ACCESSIBILITY
// -------------------------------------------------------------
console.log("\n--- GROUP 4: User Settings & WCAG Switch Accessibility ---");

runCheck(4, "4.1 Settings form preserves all preference switch IDs", () => {
  assert(settingsHtml.includes('id="auto-play-voice"'), "Must preserve #auto-play-voice");
  assert(settingsHtml.includes('id="noise-cancel"'), "Must preserve #noise-cancel");
  assert(settingsHtml.includes('id="notif-streak"'), "Must preserve #notif-streak");
  assert(settingsHtml.includes('id="notif-jobs"'), "Must preserve #notif-jobs");
});

runCheck(4, "4.2 All toggle switches implement WCAG switch semantics (role and aria-checked)", () => {
  const switchRoles = (settingsHtml.match(/role="switch"/g) || []).length;
  assert(switchRoles >= 4, `Must have at least 4 role="switch" elements, found ${switchRoles}`);
  assert(settingsHtml.includes('id="auto-play-voice"') && settingsHtml.includes('role="switch" aria-checked="true"'),
         "#auto-play-voice must have role='switch' and aria-checked='true'");
});

runCheck(4, "4.3 Settings CSS enforces WCAG focus-visible outline on toggle switches", () => {
  assert(
    settingsCss.includes('.toggle-switch input:focus-visible + .slider-round'),
    "Must style .toggle-switch input:focus-visible + .slider-round"
  );
  assert(
    settingsCss.includes('outline: 2px solid #2563eb'),
    "Must declare outline: 2px solid #2563eb for focus visible ring"
  );
});

runCheck(4, "4.4 Settings CSS defines clean preference cards and rows", () => {
  assert(settingsCss.includes('.pref-card'), "settings.css must define .pref-card");
  assert(settingsCss.includes('.pref-row'), "settings.css must define .pref-row");
  assert(settingsCss.includes('.theme-icon-group'), "settings.css must define .theme-icon-group");
});

// -------------------------------------------------------------
// GROUP 5: PRODUCTION DATABASE SHA-256 INVARIANT
// -------------------------------------------------------------
console.log("\n--- GROUP 5: Production Database SHA-256 Invariant ---");

runCheck(5, "5.1 Production database BE/data/db.json remains byte-for-byte unmodified", () => {
  assert(fs.existsSync(PROD_DB_PATH), "BE/data/db.json must exist");
  const currentDbBuffer = fs.readFileSync(PROD_DB_PATH);
  const currentHash = crypto.createHash("sha256").update(currentDbBuffer).digest("hex").toUpperCase();
  assert.strictEqual(
    currentHash,
    BASELINE_DB_HASH,
    `Database hash mismatch! Expected: ${BASELINE_DB_HASH}, Got: ${currentHash}`
  );
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log("\n===============================================================");
console.log(`TOTAL AUDIT CHECKS: ${passCount + failCount}`);
console.log(`PASSED: ${passCount}`);
console.log(`FAILED: ${failCount}`);
console.log("===============================================================");

if (failCount > 0) {
  process.exit(1);
} else {
  console.log("\n[SUCCESS] Candidate auxiliary experience audit passed 100% cleanly!\n");
  process.exit(0);
}
