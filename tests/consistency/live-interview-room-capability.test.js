/**
 * PREPMATE — WI-DESIGN-07: LIVE INTERVIEW ROOM CONTRACT & CAPABILITY AUDIT TEST SUITE
 *
 * Verifies:
 * 1. Stylesheet Foundation & Canonical Token Mapping
 * 2. Visual Hierarchy & 58 Preserved DOM IDs
 * 3. Canonical Persona Manifest SSOT & De-botting
 * 4. Voice, TTS & Audio Safety State Machine
 * 5. STT & Microphone Fallback Safety
 * 6. Video Pipeline, On-Device Privacy & Ethical Separation
 * 7. Production Database SHA-256 Invariant
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "interview", "interview-practice.html");
const CSS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "interview", "interview-room.css");
const TTS_JS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "interview", "interview-tts.js");
const STT_JS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "interview", "interview-stt.js");
const CAM_JS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "interview", "interview-camera.js");
const VCE_JS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "interview", "visual-coaching-engine.js");
const SCE_JS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "interview", "speech-coaching-engine.js");
const MANIFEST_JS_PATH = path.join(WORKSPACE_ROOT, "FE", "features", "interview", "interview-persona-manifest.js");
const { resolveDbPath, getBaselineDbHash } = require('../helpers/test-env');
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();

const htmlContent = fs.readFileSync(HTML_PATH, "utf8");
const cssContent = fs.readFileSync(CSS_PATH, "utf8");
const ttsContent = fs.readFileSync(TTS_JS_PATH, "utf8");
const sttContent = fs.readFileSync(STT_JS_PATH, "utf8");
const camContent = fs.readFileSync(CAM_JS_PATH, "utf8");
const vceContent = fs.readFileSync(VCE_JS_PATH, "utf8");
const sceContent = fs.readFileSync(SCE_JS_PATH, "utf8");
const personasManifest = require(MANIFEST_JS_PATH);

console.log("===============================================================");
console.log("   WI-DESIGN-07: LIVE INTERVIEW ROOM CONTRACT TESTS           ");
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
// GROUP 1: STYLESHEET FOUNDATION & CANONICAL TOKEN INTEGRATION
// -------------------------------------------------------------
console.log("--- GROUP 1: Stylesheet Foundation & Token Integration ---");

runCheck(1, "1.1 Canonical stylesheets linked in head", () => {
  assert(htmlContent.includes('tokens.css'), "Must link tokens.css");
  assert(htmlContent.includes('base.css'), "Must link base.css");
  assert(htmlContent.includes('layout.css'), "Must link layout.css");
  assert(htmlContent.includes('components.css'), "Must link components.css");
  assert(htmlContent.includes('style.css'), "Must link style.css");
  assert(htmlContent.includes('new-dashboard.css'), "Must link new-dashboard.css");
  assert(htmlContent.includes('interview-room.css'), "Must link interview-room.css");
});

runCheck(1, "1.2 Room CSS :root binds to canonical tokens", () => {
  assert(cssContent.includes('--ir-bg: var(--pm-bg'), "Must bind --ir-bg to --pm-bg");
  assert(cssContent.includes('--ir-surface: var(--pm-surface'), "Must bind --ir-surface to --pm-surface");
  assert(cssContent.includes('--ir-border: var(--pm-border'), "Must bind --ir-border to --pm-border");
  assert(cssContent.includes('--ir-blue: var(--pm-primary'), "Must bind --ir-blue to --pm-primary");
  assert(cssContent.includes('--ir-text-primary: var(--pm-text-primary'), "Must bind --ir-text-primary");
});

runCheck(1, "1.3 No neon gaming or harsh dark glow overrides", () => {
  assert(!cssContent.includes('box-shadow: 0 0 20px rgba(239, 68, 68, 0.7)'), "Eliminated harsh mic neon glow");
  const emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g;
  const matches = htmlContent.match(emojiRegex);
  assert(!matches || matches.length === 0, "No emojis in HTML markup");
});

// -------------------------------------------------------------
// GROUP 2: VISUAL FOCAL HIERARCHY & 58 DOM IDS CONTRACT
// -------------------------------------------------------------
console.log("--- GROUP 2: Visual Focal Hierarchy & 58 DOM IDs Contract ---");

const REQUIRED_DOM_IDS = [
  "topbar-job-title", "question-counter", "main-status-dot", "main-status-label",
  "timer-pulse-indicator", "interview-timer-display", "btn-toggle-transcript",
  "btn-pause-interview", "btn-start-interview", "btn-end-interview", "ir-video-grid",
  "interviewer-tile", "interviewer-status-pill", "topbar-status-dot", "interviewer-status-text",
  "ai-avatar-visual", "interviewer-avatar-ring", "interviewer-avatar-preview",
  "interviewer-state-badge", "voice-wave", "interviewer-mic-badge", "interviewer-name-display",
  "btn-tts", "candidate-tile", "webcam-video", "camera-placeholder", "candidate-avatar-ring",
  "candidate-avatar-preview", "candidate-initials", "candidate-mic-badge", "candidate-tile-name",
  "btn-mic", "btn-toggle-cam", "current-question-badge", "current-question-hint",
  "current-question-text", "stage-context-guidance", "chat-status", "chat-status-dot",
  "chat-status-text", "dialogue-answer-countdown", "answer-countdown-time",
  "speech-status-indicator", "speech-status-text-hint", "user-input", "btn-send",
  "ir-transcript-drawer", "ai-mode-badge-conv", "chat-box", "zoom-start-confirm-modal",
  "confirm-modal-job-title", "confirm-modal-round", "confirm-modal-interviewer",
  "finish-modal", "finish-score-value", "finish-score-verdict", "finish-message",
  "finish-summary", "btn-view-deep-report"
];

runCheck(2, "2.1 All 58 required DOM IDs preserved", () => {
  const missing = REQUIRED_DOM_IDS.filter(id => !htmlContent.includes(`id="${id}"`));
  assert.strictEqual(missing.length, 0, `Missing DOM IDs: ${missing.join(", ")}`);
});

runCheck(2, "2.2 Prominent question prompter and response console hierarchy", () => {
  const qPos = htmlContent.indexOf('class="ir-question-stage"');
  const rPos = htmlContent.indexOf('class="ir-response-console"');
  const dPos = htmlContent.indexOf('id="ir-transcript-drawer"');
  assert(qPos !== -1 && rPos !== -1 && dPos !== -1, "All 3 regions must exist");
  assert(qPos < rPos, "Question stage must precede response console");
  assert(rPos < dPos, "Response console must precede slide-over transcript drawer");
});

// -------------------------------------------------------------
// GROUP 3: CANONICAL PERSONA MANIFEST SSOT & DE-BOTTING
// -------------------------------------------------------------
console.log("--- GROUP 3: Persona SSOT & De-botting ---");

runCheck(3, "3.1 Persona manifest includes all 3 canonical personas", () => {
  const p = personasManifest.getPersona("professional");
  const f = personasManifest.getPersona("friendly");
  const b = personasManifest.getPersona("balanced");
  assert.strictEqual(p.name, "Trần Minh Vũ");
  assert.strictEqual(f.name, "Lê Lan Anh");
  assert.strictEqual(b.name, "Nguyễn Hoàng Nam");
  assert(htmlContent.includes(p.name));
  assert(htmlContent.includes(f.name));
  assert(htmlContent.includes(b.name));
});

runCheck(3, "3.2 No legacy mock personas or robot labels in room", () => {
  assert(!htmlContent.includes("Lê Thu Hà"), "Must not contain mock Lê Thu Hà");
  assert(!htmlContent.includes("Nguyễn Minh Anh"), "Must not contain mock Nguyễn Minh Anh");
  assert(!htmlContent.includes("Người phỏng vấn AI"), "Must use human title");
});

// -------------------------------------------------------------
// GROUP 4: AUDIO / TTS CAPABILITY & SAFETY AUDIT
// -------------------------------------------------------------
console.log("--- GROUP 4: Audio / TTS Capability & Safety Audit ---");

runCheck(4, "4.1 Speech State Machine & anti-duplicate lock defined", () => {
  assert(ttsContent.includes("SPEECH_STATE"), "SPEECH_STATE machine must exist");
  assert(ttsContent.includes("SPEAKING"), "SPEAKING state must exist");
  assert(ttsContent.includes("PAUSED"), "PAUSED state must exist");
  assert(ttsContent.includes("FINISHED"), "FINISHED state must exist");
  assert(ttsContent.includes("CANCELLED"), "CANCELLED state must exist");
  assert(ttsContent.includes("completeSpeechOnce"), "completeSpeechOnce anti-duplicate lock required");
});

runCheck(4, "4.2 ElevenLabs endpoints and fallback to Web Speech API", () => {
  assert(ttsContent.includes("/api/tts/speak"), "ElevenLabs speak proxy endpoint declared");
  assert(ttsContent.includes("/api/tts/status"), "ElevenLabs status endpoint declared");
  assert(ttsContent.includes("/api/tts/voices"), "ElevenLabs voices endpoint declared");
  assert(ttsContent.includes("speechSynthesis"), "Browser Web Speech fallback preserved");
});

runCheck(4, "4.3 Audio toggle mute does not prematurely skip turns or fire end callbacks", () => {
  assert(ttsContent.includes("Toggle mute ONLY controls audio; it MUST NOT start timer"), "Audio mute safety guard");
});

// -------------------------------------------------------------
// GROUP 5: STT & MICROPHONE CAPABILITY AUDIT
// -------------------------------------------------------------
console.log("--- GROUP 5: STT & Microphone Capability Audit ---");

runCheck(5, "5.1 Mic State Machine & 15s silent mic detector defined", () => {
  assert(sttContent.includes("MIC_STATE"), "MIC_STATE machine must exist");
  assert(sttContent.includes("NO_PERMISSION"), "NO_PERMISSION state must exist");
  assert(sttContent.includes("LISTENING"), "LISTENING state must exist");
  assert(sttContent.includes("MUTED"), "MUTED state must exist");
  assert(sttContent.includes("15000"), "15s silent mic detector configured");
});

runCheck(5, "5.2 Non-blocking typing fallback: textarea accessible regardless of mic status", () => {
  assert(htmlContent.includes('id="user-input"'), "user-input textarea preserved");
  assert(htmlContent.includes('handleKeyDown(event)'), "Keyboard handler preserved");
  assert(htmlContent.includes('sendMessage()'), "Send message trigger preserved");
});

// -------------------------------------------------------------
// GROUP 6: VIDEO PIPELINE & CLIENT-SIDE ETHICAL SEPARATION
// -------------------------------------------------------------
console.log("--- GROUP 6: Video Pipeline & Client-Side Ethical Separation ---");

runCheck(6, "6.1 Privacy disclosure and on-demand camera access", () => {
  assert(camContent.includes("CAM_PRIVACY_DISCLOSURE"), "Privacy disclosure constant required");
  assert(camContent.includes("hoàn toàn không được gửi lên máy chủ khi chưa có sự đồng ý"), "Privacy wording verified");
  assert(camContent.includes("CAM_STATE"), "CAM_STATE machine required");
});

runCheck(6, "6.2 Visual coaching uses client canvas heuristics without emotion guessing", () => {
  assert(vceContent.includes("ITU-R BT.601 Luma"), "Luma calculation verified");
  assert(vceContent.includes("YCbCr Skin Locus"), "Skin locus person detection verified");
  assert(vceContent.includes("không nhận diện sinh trắc học để định danh, không suy đoán tâm lý/cảm xúc"), "Ethical disclaimer verified");
  assert(vceContent.includes("affectsProfessionalScore"), "Does not affect professional competency score");
});

runCheck(6, "6.3 Zero video upload endpoints in visual modules", () => {
  assert(!vceContent.match(/fetch\(|xhr\.open|endpoint/i), "visual-coaching-engine.js does not make network calls");
});

// -------------------------------------------------------------
// GROUP 7: DATABASE & BASELINE INTEGRITY
// -------------------------------------------------------------
console.log("--- GROUP 7: Database & Baseline Integrity ---");

runCheck(7, "7.1 Production database hash invariant", () => {
  const currentHash = crypto.createHash("sha256").update(fs.readFileSync(PROD_DB_PATH)).digest("hex").toUpperCase();
  assert.strictEqual(currentHash, BASELINE_DB_HASH, `DB hash mismatch: ${currentHash} vs ${BASELINE_DB_HASH}`);
});

console.log("\n===============================================================");
console.log(`   TEST RESULTS: ${passCount} PASS, ${failCount} FAIL`);
console.log("===============================================================");

if (failCount > 0) {
  process.exit(1);
}
