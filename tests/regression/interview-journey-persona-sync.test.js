/**
 * PrepMate — WI-INTERVIEW-UI-01
 * Comprehensive Journey Persona Synchronization & UI Verification Test
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

console.log('===============================================================');
console.log('   WI-INTERVIEW-UI-01: PERSONA JOURNEY SYNCHRONIZATION TESTS   ');
console.log('===============================================================\n');

const BASELINE_DB_HASH = 'C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7';

// ── 1. MANIFEST VERIFICATION ──────────────────────────────────────────────
console.log('--- GROUP 1: Persona Manifest SSOT Contract ---');
const manifestModule = require('../../FE/features/interview/interview-persona-manifest.js');
assert.ok(manifestModule, 'Manifest module must export an object');
assert.ok(manifestModule.MANIFEST, 'Manifest must have MANIFEST registry');

const personas = manifestModule.getAllPersonas();
assert.strictEqual(personas.length, 3, 'Must define exactly 3 personas (professional, friendly, balanced)');

const pro = manifestModule.getPersona('professional');
assert.strictEqual(pro.name, 'Trần Minh Vũ');
assert.strictEqual(pro.avatarInitials, 'MV');
assert.strictEqual(pro.audioAvailable, false, 'audioAvailable must be false when static audio file is absent');
console.log('  [PASS] 1. Professional persona (Trần Minh Vũ - MV) defined with truthful audio availability');

const fri = manifestModule.getPersona('friendly');
assert.strictEqual(fri.name, 'Lê Lan Anh');
assert.strictEqual(fri.avatarInitials, 'LA');
assert.strictEqual(fri.audioAvailable, false);
console.log('  [PASS] 2. Friendly persona (Lê Lan Anh - LA) defined with truthful audio availability');

const bal = manifestModule.getPersona('balanced');
assert.strictEqual(bal.name, 'Nguyễn Hoàng Nam');
assert.strictEqual(bal.avatarInitials, 'HN');
assert.strictEqual(bal.audioAvailable, false);
console.log('  [PASS] 3. Balanced persona (Nguyễn Hoàng Nam - HN) defined with truthful audio availability');

// Test playback controller graceful fallback
let unavailableTriggered = false;
manifestModule.playGreeting('professional', {
  onUnavailable: (persona) => {
    unavailableTriggered = true;
    assert.strictEqual(persona.id, 'professional');
  }
}).then(result => {
  assert.strictEqual(result, false, 'playGreeting must return false when audio is unavailable');
  assert.ok(unavailableTriggered, 'onUnavailable callback must fire when audio is missing');
  console.log('  [PASS] 4. Greeting playback controller invokes onUnavailable without errors or fake audio');
});

// ── 2. INTERVIEW-INFO.HTML VERIFICATION ────────────────────────────────────
console.log('\n--- GROUP 2: Preparation Page (interview-info.html) ---');
const infoHtml = fs.readFileSync(path.join(__dirname, '../../FE/features/interview/interview-info.html'), 'utf8');

assert.ok(infoHtml.includes('interview-persona-manifest.js'), 'interview-info.html must include interview-persona-manifest.js');
assert.ok(infoHtml.includes('class="interviewer-persona-grid"'), 'Must contain .interviewer-persona-grid');
assert.ok(infoHtml.includes('id="persona-card-professional"'), 'Must contain #persona-card-professional');
assert.ok(infoHtml.includes('id="persona-card-friendly"'), 'Must contain #persona-card-friendly');
assert.ok(infoHtml.includes('id="persona-card-balanced"'), 'Must contain #persona-card-balanced');
console.log('  [PASS] 5. 3 Persona cards rendered in place of manual voice dropdown');

// Verify buttons, quotes, and avatars
assert.ok(infoHtml.includes('btn-persona-greeting'), 'Must contain greeting buttons');
assert.ok(infoHtml.includes('greeting-quote-preview'), 'Must contain static greeting quote previews');
assert.ok(infoHtml.includes('Bản ghi âm lời chào đang cập nhật'), 'Must communicate audio asset status transparently');
assert.ok(infoHtml.includes('display: none !important;'), 'Must hide manual voice dropdown container (#chamber-voice-settings-group)');
console.log('  [PASS] 6. Static greeting buttons, quote previews, and hidden manual voice dropdown verified');

// Verify test backward compatibility
assert.ok(infoHtml.includes('id="persona-tile-pro"'), 'Must retain legacy ID persona-tile-pro');
assert.ok(infoHtml.includes('id="persona-tile-bal"'), 'Must retain legacy ID persona-tile-bal');
assert.ok(infoHtml.includes('id="persona-tile-fri"'), 'Must retain legacy ID persona-tile-fri');
console.log('  [PASS] 7. Legacy test IDs retained for full backward compatibility');

// ── 3. PRACTICE ROOM (interview-practice.html) VERIFICATION ───────────────
console.log('\n--- GROUP 3: Interview Room (interview-practice.html) ---');
const practiceHtml = fs.readFileSync(path.join(__dirname, '../../FE/features/interview/interview-practice.html'), 'utf8');

assert.ok(/interview-room\.css\?v=30["'\s\n\r]*\/>/.test(practiceHtml), 'Line 20 link tag must be properly closed');
assert.ok(practiceHtml.includes('interview-persona-manifest.js'), 'interview-practice.html must include interview-persona-manifest.js');
assert.ok(practiceHtml.includes('PrepMatePersonas.getPersona'), 'interview-practice.html must resolve persona via manifest');
console.log('  [PASS] 8. Interview room markup syntax valid and persona dynamically resolved from manifest');

// ── 4. CHAT SUBSYSTEM (interview-chat.js) VERIFICATION ────────────────────
console.log('\n--- GROUP 4: Interview Chat Subsystem (interview-chat.js) ---');
const chatJs = fs.readFileSync(path.join(__dirname, '../../FE/features/interview/interview-chat.js'), 'utf8');

assert.ok(chatJs.includes('getActiveInterviewerDisplayName'), 'Must use getActiveInterviewerDisplayName');
assert.ok(chatJs.includes('getActiveInterviewerInitials'), 'Must use getActiveInterviewerInitials');
console.log('  [PASS] 9. Dynamic interviewer welcome message uses active persona name and initials');

// ── 5. REPORT PAGE (report.html & report.js) VERIFICATION ──────────────────
console.log('\n--- GROUP 5: Evaluation Report (report.html & report.js) ---');
const reportHtml = fs.readFileSync(path.join(__dirname, '../../FE/features/report/report.html'), 'utf8');
const reportJs = fs.readFileSync(path.join(__dirname, '../../FE/features/report/report.js'), 'utf8');

assert.ok(reportHtml.includes('hero-interviewer-name') || reportHtml.includes('hero-interviewer-badge'), 'report.html must contain interviewer badge');
assert.ok(reportHtml.includes('interview-persona-manifest.js'), 'report.html must include interview-persona-manifest.js');
assert.ok(reportJs.includes('hero-interviewer-name'), 'report.js must update interviewer name badge in hero overview');
console.log('  [PASS] 10. Report hero section displays synchronized interviewer persona badge');

// ── 6. HISTORY PAGE (history.html) VERIFICATION ───────────────────────────
console.log('\n--- GROUP 6: Session History (history.html) ---');
const historyHtml = fs.readFileSync(path.join(__dirname, '../../FE/features/interview/history.html'), 'utf8');

assert.ok(historyHtml.includes('interview-persona-manifest.js'), 'history.html must include interview-persona-manifest.js');
assert.ok(historyHtml.includes('pm-interviewer-badge'), 'history.html must render interviewer badge in session cards');
console.log('  [PASS] 11. History cards display persona name badge along with title and status');

// ── 7. DATABASE INTEGRITY INVARIANT ───────────────────────────────────────
console.log('\n--- GROUP 7: Database & Safety Invariants ---');
const dbContent = fs.readFileSync(path.join(__dirname, '../../BE/data/db.json'), 'utf8');
const currentDbHash = crypto.createHash('sha256').update(dbContent, 'utf8').digest('hex').toUpperCase();

assert.strictEqual(
  currentDbHash,
  BASELINE_DB_HASH,
  `Database SHA-256 MUST NOT CHANGE! Expected ${BASELINE_DB_HASH}, got ${currentDbHash}`
);
console.log(`  [PASS] 12. Database SHA-256 preserved exactly (${currentDbHash})`);

console.log('\n===============================================================');
console.log('   ALL 12 PERSONA JOURNEY SYNCHRONIZATION CHECKS PASSED!       ');
console.log('===============================================================\n');
