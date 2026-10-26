const fs = require('fs');
const path = require('path');
const { resolvePath } = require('../helpers/test-env');

console.log('================================================================');
console.log('   P1.1 VERIFICATION: INTERVIEW SETUP RECONSTRUCTION AUDIT      ');
console.log('================================================================\n');

const htmlPath = resolvePath('FE/features/interview/interview-info.html');
const content = fs.readFileSync(htmlPath, 'utf8');

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`[PASS] ${testName}`);
        passCount++;
    } else {
        console.error(`[FAIL] ${testName}: ${details}`);
        failCount++;
    }
}

// 1. Wizard Stepper with 4 Steps
assert(
    content.includes('id="stepper-tab-1"') &&
    content.includes('id="stepper-tab-2"') &&
    content.includes('id="stepper-tab-3"') &&
    content.includes('id="stepper-tab-4"'),
    'Test 1: Stepper contains 4 structured step tabs (Context, Profile, Interview, Readiness)'
);

// 2. 4 Step Panes
assert(
    content.includes('id="step-pane-1"') &&
    content.includes('id="step-pane-2"') &&
    content.includes('id="step-pane-3"') &&
    content.includes('id="step-pane-4"'),
    'Test 2: Setup form decomposed into 4 distinct step panes'
);

// 3. Elimination of SWE-only Hardcoded Default
const jobInputMatch = content.match(/<input[^>]+id="job-title"[^>]*>/);
const hasHardcodedFrontend = jobInputMatch && jobInputMatch[0].includes('value="Frontend Developer"');
assert(
    !hasHardcodedFrontend,
    'Test 3: Eliminated hardcoded "Frontend Developer" default value from #job-title input'
);

// 4. Diverse Career Quick Chips (8 distinct domains)
const expectedRoles = [
    'Software Engineer',
    'Business Analyst',
    'Digital Marketing Specialist',
    'B2B Sales Executive',
    'Financial Analyst',
    'HR Recruiter',
    'Project Manager',
    'UI/UX Designer'
];
const allRolesPresent = expectedRoles.every(r => content.includes(`data-role="${r}"`));
assert(
    allRolesPresent,
    'Test 4: Diverse career quick chips present across 8 major domains (Tech, BA, Marketing, Sales, Finance, HR, PM, Design)'
);

// 5. Seniority Selector Integrity
const seniorityLevels = ['Junior', 'Mid-level', 'Senior', 'Lead'];
const allSeniorityPresent = seniorityLevels.every(s => content.includes(`value="${s}"`));
assert(
    allSeniorityPresent,
    'Test 5: Seniority radio group preserves Junior, Mid-level, Senior, and Lead options'
);

// 6. Target Company Datalist Diversity
const diverseCompanies = ['FPT', 'Viettel', 'Techcombank', 'Shopee', 'Vinamilk', 'Unilever'];
const companiesPresent = diverseCompanies.every(c => content.includes(c));
assert(
    companiesPresent,
    'Test 6: Target companies datalist expanded beyond pure tech to banking, retail, FMCG'
);

// 7. Interview Round Selector Contract
assert(
    content.includes('id="interview-round"') &&
    content.includes('value="round1"') &&
    content.includes('value="round2"') &&
    content.includes('value="round3"'),
    'Test 7: Interview round selector preserves round1, round2, round3 values'
);

// 8. CV Upload & Dropzone Contract
const cvUploadElements = [
    'id="upload-container"',
    'id="upload-box"',
    'id="cv-file"',
    'id="upload-status"',
    'id="status-filename"',
    'id="status-filesize"',
    'id="btn-remove-cv"',
    'id="cv-text"'
];
const allCvElementsPresent = cvUploadElements.every(el => content.includes(el));
assert(
    allCvElementsPresent,
    'Test 8: CV upload dropzone, status, and hidden text storage contracts preserved'
);

// 9. Saved CV Recognition & Re-entry Prevention
assert(
    content.includes('id="saved-cv-box"') &&
    content.includes('id="saved-cv-name"') &&
    content.includes('id="saved-cv-status-badge"'),
    'Test 9: Saved CV recognition UI card present for seamless server prefill'
);

// 10. AI CV Analysis Panel
assert(
    content.includes('id="cv-analysis-panel"') &&
    content.includes('id="cv-analysis-summary"') &&
    content.includes('id="cv-key-skills"') &&
    content.includes('id="cv-analysis-suitability"') &&
    content.includes('id="cv-analysis-suggestions"'),
    'Test 10: AI CV analysis panel contracts fully preserved'
);

// 11. JD Textarea & Focus Description Contract
assert(
    content.includes('id="jd-text"') &&
    content.includes('id="user-description"'),
    'Test 11: JD input and candidate focus description textareas preserved'
);

// 12. Context Tabs Contract (CV vs JD)
assert(
    content.includes('id="tab-btn-cv"') &&
    content.includes('id="tab-btn-jd"') &&
    content.includes('id="tab-content-cv"') &&
    content.includes('id="tab-content-jd"'),
    'Test 12: Context switcher tabs preserved for tab switching compatibility'
);

// 13. Language Tiles & Hidden Contracts
assert(
    content.includes('id="lang-tile-vn"') &&
    content.includes('id="lang-tile-en"') &&
    content.includes('id="interview-language"') &&
    content.includes('id="interviewer-country"'),
    'Test 13: Language tiles and underlying hidden select contracts preserved'
);

// 14. Response Mode (Chat vs Voice AI)
assert(
    content.includes('id="mode-tile-text"') &&
    content.includes('id="mode-tile-voice"') &&
    content.includes('id="enable-text"') &&
    content.includes('id="enable-handsfree"'),
    'Test 14: Response mode tiles and underlying radio inputs preserved'
);

// 15. Human Professional Personas (Zero Robot Emojis)
const hasRobotEmoji = content.includes('🤖');
assert(
    !hasRobotEmoji,
    'Test 15: Zero robot emojis (🤖) - interviewer personas fully humanized and professionalized'
);

assert(
    content.includes('id="persona-tile-pro"') &&
    content.includes('id="persona-tile-bal"') &&
    content.includes('id="persona-tile-fri"') &&
    content.includes('id="interviewer-persona"') &&
    content.includes('Giám đốc Chuyên môn') &&
    content.includes('Trưởng nhóm Tuyển dụng') &&
    content.includes('Chuyên viên Nhân sự'),
    'Test 16: Professional interviewer personas configured (Technical Lead, Hiring Manager, HR Partner)'
);

// 17. Collapsible Advanced Options & Webcam Toggle
assert(
    content.includes('class="advanced-options-card"') &&
    content.includes('id="enable-camera"'),
    'Test 17: Collapsible advanced options card with webcam toggle switch'
);

// 18. Step 4 Readiness Summary & Hardware Checklist
assert(
    content.includes('id="summary-spec-role"') &&
    content.includes('id="summary-spec-company"') &&
    content.includes('id="summary-spec-round"') &&
    content.includes('id="summary-spec-cv"') &&
    content.includes('id="summary-spec-lang-mode"') &&
    content.includes('id="summary-spec-persona"'),
    'Test 18: Step 4 executive readiness summary card with 6 live spec dimensions'
);

// 19. Start Interview CTA & Sidebar Briefing Elements
assert(
    content.includes('id="btn-start-interview"') &&
    content.includes('onclick="startInterview()"') &&
    content.includes('id="brief-position-display"') &&
    content.includes('id="brief-company-display"') &&
    content.includes('id="brief-round-display"') &&
    content.includes('id="brief-lang-badge"') &&
    content.includes('id="brief-mode-badge"'),
    'Test 19: Single commanding start CTA and sidebar live briefing contracts preserved'
);

// 20. Compatibility with Query Params, Jobs Prefill, and Server Profile/CV
assert(
    content.includes('urlParams.get(\'role\')') &&
    content.includes('localStorage.getItem(\'prefill_job_title\')') &&
    content.includes('fetch(\'/api/profile\'') &&
    content.includes('fetch(\'/api/cv\''),
    'Test 20: Full compatibility with query parameters, job exploration prefill, and authenticated server profile/CV'
);

console.log('\n================================================================');
console.log(`   TOTAL TESTS: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);
console.log('================================================================\n');

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
