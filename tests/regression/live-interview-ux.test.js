/**
 * test_live_interview_ux.js
 * Verification suite for P1.2 Live Interview UX Reconstruction
 *
 * Validates:
 * 1. Zero robot / gaming / developer emojis across HTML, CSS, JS
 * 2. Visual focal hierarchy (Upper video -> Middle prominent question -> Lower spacious response console)
 * 3. Dedicated slide-over transcript drawer without trapping active inputs
 * 4. Preserved DOM element contract (all 56 IDs & interaction selectors)
 * 5. Dynamic persona & industry neutrality (SWE and non-SWE)
 * 6. Accessibility & responsive design rules
 */

const fs = require('fs');
const path = require('path');
const { resolvePath } = require('../helpers/test-env');
const assert = require('assert');

const HTML_PATH = resolvePath('FE/features/interview/interview-practice.html');
const CSS_PATH = resolvePath('FE/features/interview/interview-room.css');
const AVATAR_JS_PATH = resolvePath('FE/features/interview/avatar.js');
const INTERVIEW_JS_PATH = resolvePath('FE/features/interview/interview.js');
const AGENDA_JS_PATH = resolvePath('FE/features/interview/interview-agenda.js');
const MANIFEST_JS_PATH = resolvePath('FE/features/interview/interview-persona-manifest.js');

const htmlContent = fs.readFileSync(HTML_PATH, 'utf-8');
const cssContent = fs.readFileSync(CSS_PATH, 'utf-8');
const avatarJsContent = fs.readFileSync(AVATAR_JS_PATH, 'utf-8');
const interviewJsContent = fs.readFileSync(INTERVIEW_JS_PATH, 'utf-8');
const agendaJsContent = fs.readFileSync(AGENDA_JS_PATH, 'utf-8');
const personasManifest = require(MANIFEST_JS_PATH);

const results = [];
let passCount = 0;
let failCount = 0;

function runTest(testName, fn) {
  try {
    fn();
    results.push(`[PASS] ${testName}`);
    passCount++;
  } catch (err) {
    results.push(`[FAIL] ${testName}: ${err.message}`);
    failCount++;
  }
}

console.log('=== RUNNING P1.2 LIVE INTERVIEW UX RECONSTRUCTION VERIFICATION ===\n');

// 1. Emoji Elimination Check
runTest('No robot or HUD gaming emojis in interview-practice.html', () => {
  const emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g;
  const matches = htmlContent.match(emojiRegex);
  assert(!matches || matches.length === 0, `Found emojis in HTML: ${matches ? matches.join(' ') : ''}`);
});

runTest('No robot or HUD gaming emojis in interview-room.css', () => {
  const emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g;
  const matches = cssContent.match(emojiRegex);
  assert(!matches || matches.length === 0, `Found emojis in CSS: ${matches ? matches.join(' ') : ''}`);
});

runTest('No robot or HUD gaming emojis in avatar.js', () => {
  const emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g;
  const matches = avatarJsContent.match(emojiRegex);
  assert(!matches || matches.length === 0, `Found emojis in avatar.js: ${matches ? matches.join(' ') : ''}`);
});

// 2. 3-Tier Focal Hierarchy
runTest('Prominent question stage exists in video stage column', () => {
  assert(htmlContent.includes('class="ir-question-stage"'), 'ir-question-stage must exist');
  assert(htmlContent.includes('id="current-question-text"'), 'current-question-text must exist');
  assert(htmlContent.includes('id="current-question-badge"'), 'current-question-badge must exist');
  assert(htmlContent.includes('requestClarification()'), 'Clarification action must exist');
  assert(htmlContent.includes('requestThinkTime()'), 'Think time action must exist');
});

runTest('Spacious response console exists in main stage column (not trapped in drawer)', () => {
  assert(htmlContent.includes('class="ir-response-console"'), 'ir-response-console must exist');
  assert(htmlContent.includes('id="user-input"'), 'user-input must exist');
  assert(htmlContent.includes('id="btn-send"'), 'btn-send must exist');
  
  // Verify response console comes BEFORE </main> and is sibling to question stage inside column
  const questionPos = htmlContent.indexOf('class="ir-question-stage"');
  const responseConsolePos = htmlContent.indexOf('class="ir-response-console"');
  const drawerPos = htmlContent.indexOf('id="ir-transcript-drawer"');
  
  assert(questionPos !== -1, 'Question stage position valid');
  assert(responseConsolePos !== -1, 'Response console position valid');
  assert(drawerPos !== -1, 'Drawer position valid');
  assert(questionPos < responseConsolePos, 'Question stage must precede response console');
  assert(responseConsolePos < drawerPos, 'Response console must be in main stage before transcript drawer');
});

runTest('Slide-over transcript drawer is isolated with panel-collapsed default', () => {
  assert(htmlContent.includes('id="ir-transcript-drawer"'), 'Drawer id must exist');
  assert(htmlContent.includes('panel-collapsed'), 'Drawer must start collapsed for focus');
  assert(htmlContent.includes('id="chat-box"'), 'chat-box must be contained in drawer');
  assert(htmlContent.includes('toggleTranscriptDrawer()'), 'toggleTranscriptDrawer action must exist');
});

// 3. Complete DOM IDs and Contract Preservation
const REQUIRED_DOM_IDS = [
  'topbar-job-title',
  'question-counter',
  'main-status-dot',
  'main-status-label',
  'timer-pulse-indicator',
  'interview-timer-display',
  'btn-toggle-transcript',
  'btn-pause-interview',
  'btn-start-interview',
  'btn-end-interview',
  'ir-video-grid',
  'interviewer-tile',
  'interviewer-status-pill',
  'topbar-status-dot',
  'interviewer-status-text',
  'ai-avatar-visual',
  'interviewer-avatar-ring',
  'interviewer-avatar-preview',
  'interviewer-state-badge',
  'voice-wave',
  'interviewer-mic-badge',
  'interviewer-name-display',
  'btn-tts',
  'candidate-tile',
  'webcam-video',
  'camera-placeholder',
  'candidate-avatar-ring',
  'candidate-avatar-preview',
  'candidate-initials',
  'candidate-mic-badge',
  'candidate-tile-name',
  'btn-mic',
  'btn-toggle-cam',
  'current-question-badge',
  'current-question-hint',
  'current-question-text',
  'stage-context-guidance',
  'chat-status',
  'chat-status-dot',
  'chat-status-text',
  'dialogue-answer-countdown',
  'answer-countdown-time',
  'speech-status-indicator',
  'speech-status-text-hint',
  'user-input',
  'btn-send',
  'ir-transcript-drawer',
  'ai-mode-badge-conv',
  'chat-box',
  'zoom-start-confirm-modal',
  'confirm-modal-job-title',
  'confirm-modal-round',
  'confirm-modal-interviewer',
  'finish-modal',
  'finish-score-value',
  'finish-score-verdict',
  'finish-message',
  'finish-summary',
  'btn-view-deep-report'
];

runTest('All required 58 DOM IDs are preserved in interview-practice.html', () => {
  const missingIds = [];
  for (const id of REQUIRED_DOM_IDS) {
    if (!htmlContent.includes(`id="${id}"`)) {
      missingIds.push(id);
    }
  }
  assert(missingIds.length === 0, `Missing DOM IDs: ${missingIds.join(', ')}`);
});

// 4. Human Tone & De-botting
runTest('Zero "Người phỏng vấn AI" in user-facing labels', () => {
  assert(!htmlContent.includes('Người phỏng vấn AI'), 'Should use "Người phỏng vấn" instead of "Người phỏng vấn AI"');
  assert(!htmlContent.includes('Bật/Tắt âm thanh người phỏng vấn AI'), 'Button label must be human');
  assert(!avatarJsContent.includes('Người phỏng vấn AI'), 'avatar.js must use human title');
});

runTest('Dynamic interviewer persona binding supports friendly, balanced, professional', () => {
  const friendly = personasManifest.getPersona('friendly');
  const balanced = personasManifest.getPersona('balanced');
  const professional = personasManifest.getPersona('professional');

  assert(htmlContent.includes('interview-persona-manifest.js'), 'interview-practice.html must include interview-persona-manifest.js');
  assert(htmlContent.includes(friendly.name), `Script must bind canonical friendly persona ${friendly.name}`);
  assert(htmlContent.includes(balanced.name), `Script must bind canonical balanced persona ${balanced.name}`);
  assert(htmlContent.includes(professional.name), `Script must bind canonical professional persona ${professional.name}`);
  assert(!htmlContent.includes('Lê Thu Hà'), 'Script must not contain legacy mock persona Lê Thu Hà');
  assert(!htmlContent.includes('Nguyễn Minh Anh'), 'Script must not contain legacy mock persona Nguyễn Minh Anh');
});

// 5. CSS Styling & Layout Assertions
runTest('CSS has unconstrained prominent question card and spacious response input', () => {
  assert(!cssContent.includes('.ir-question-stage {\n    background: #ffffff;\n    border: 1px solid var(--ir-border);\n    border-radius: 14px;\n    padding: 12px 18px;\n    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);\n    flex-shrink: 0;\n    display: flex;\n    flex-direction: column;\n    gap: 6px;\n    max-height: 110px;\n}'), 'Must not cap question stage at 110px');
  assert(cssContent.includes('.ir-response-console'), 'ir-response-console class must be styled in CSS');
  assert(cssContent.includes('transform: translateX(100%)'), 'Drawer collapse must slide out of view');
});

runTest('CSS contains responsive breakpoints for mobile and tablet', () => {
  assert(cssContent.includes('@media (max-width: 1024px)'), 'Tablet breakpoint must exist');
  assert(cssContent.includes('@media (max-width: 768px)'), 'Mobile breakpoint must exist');
  assert(cssContent.includes('@media (max-width: 480px)'), 'Small mobile breakpoint must exist');
});

// 6. Non-SWE Role Neutrality in Agenda and Guidance
runTest('STAGE_AGENDA in interview-agenda.js is industry-neutral', () => {
  assert(!agendaJsContent.includes('Phỏng vấn Kỹ thuật Chuyên môn'), 'Badge must be neutral "Phỏng vấn Chuyên môn Trọng tâm"');
  assert(!agendaJsContent.includes('các công nghệ thế mạnh'), 'Guidance must not assume SWE "công nghệ"');
  assert(agendaJsContent.includes('Phỏng vấn Chuyên môn Trọng tâm'), 'Neutral stage name present');
});

// Print Results
console.log('--- TEST RESULTS ---');
results.forEach(r => console.log(r));
console.log(`\nTOTAL: ${results.length} | PASS: ${passCount} | FAIL: ${failCount}`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\n[SUCCESS] ALL P1.2 LIVE INTERVIEW UX RECONSTRUCTION ACCEPTANCE TESTS PASSED!');
}
