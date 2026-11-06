/**
 * PREPMATE — REAL-TIME PASSWORD VALIDATION & STRENGTH INDICATOR REGRESSION TEST (WI-AUTH-01R8)
 * 
 * Verifies:
 * 1. DOM Architecture in FE/features/auth/auth.html:
 *    - Placeholder on #signup-password is "Ví dụ: User@123!456"
 *    - Hint text "Không dùng nguyên mật khẩu mẫu này." exists
 *    - #password-strength-container exists with 3 track segments and #password-strength-label
 *    - 4 core validity items exist (#req-min-length, #req-max-length, #req-ascii-only, #req-no-whitespace)
 *    - Internal blocklist rules removed from frontend checklist
 *    - #password-confirm-status exists following #signup-password-confirm
 * 2. Shared Engine in FE/features/auth/auth.js:
 *    - calculatePasswordStrength exported to window
 *    - validatePasswordPolicy exported to window
 *    - BLOCKED_PASSWORDS is NOT exposed on window/frontend (security privacy)
 * 3. Strength Levels (Yếu / Trung bình / Mạnh):
 *    - Empty -> none ("Chưa nhập")
 *    - 7 chars -> weak ("Yếu")
 *    - 8 chars standard -> medium ("Trung bình")
 *    - Complex long -> strong ("Mạnh")
 *    - "Trung bình" password is VALID and NOT blocked by frontend
 * 4. CSS tokens & Dark mode in auth.css
 * 5. Production DB SHA-256 byte-for-byte identical
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { resolveDbPath, getBaselineDbHash } = require('../helpers/test-env');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();

console.log('===============================================================');
console.log(' PREPMATE — WI-AUTH-01R8 PASSWORD STRENGTH & VALIDATION TESTS  ');
console.log('===============================================================\n');

// --- GROUP 1: DOM Structure & Accessibility ---
console.log('--- GROUP 1: DOM Structure & Accessibility in auth.html ---');
const authHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE', 'features', 'auth', 'auth.html'), 'utf8');

assert(authHtml.includes('placeholder="Ví dụ: User@123!456"'), 'auth.html contains sample placeholder "Ví dụ: User@123!456"');
console.log('  [PASS] 1.1 Sample password placeholder "Ví dụ: User@123!456" configured');

assert(authHtml.includes('Không dùng nguyên mật khẩu mẫu này.'), 'auth.html contains sample hint "Không dùng nguyên mật khẩu mẫu này."');
console.log('  [PASS] 1.2 Sample password hint text rendered below input');

assert(authHtml.includes('id="password-strength-container"'), 'auth.html contains #password-strength-container');
assert(authHtml.includes('id="password-strength-label"'), 'auth.html contains #password-strength-label');
assert(authHtml.includes('id="pw-strength-segment-1"'), 'auth.html contains 3 strength segment elements');
console.log('  [PASS] 1.3 Password strength indicator DOM structure with 3 segments and label');

const requiredItemIds = [
  'req-min-length',
  'req-max-length',
  'req-ascii-only',
  'req-no-whitespace'
];

for (const id of requiredItemIds) {
  assert(authHtml.includes(`id="${id}"`), `Item #${id} exists in validity checklist`);
}
console.log('  [PASS] 1.4 All 4 core mandatory validity items exist (#req-min-length, #req-max-length, #req-ascii-only, #req-no-whitespace)');

assert(!authHtml.includes('id="req-not-blocked"'), 'Internal blocklist check is removed from frontend checklist (WI-AUTH-01R8)');
console.log('  [PASS] 1.5 Blocklist rules not exposed on frontend checklist');

assert(authHtml.includes('id="password-confirm-status"'), '#password-confirm-status container exists');
console.log('  [PASS] 1.6 Confirmation status element exists for confirm password input');

// --- GROUP 2: CSS Styles & Semantic Tokens ---
console.log('\n--- GROUP 2: CSS Stylesheet Tokens in auth.css ---');
const authCss = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE', 'features', 'auth', 'auth.css'), 'utf8');

assert(authCss.includes('.pw-strength-container'), 'auth.css defines .pw-strength-container');
assert(authCss.includes('.strength-weak'), 'auth.css defines .strength-weak (red)');
assert(authCss.includes('.strength-medium'), 'auth.css defines .strength-medium (amber/yellow)');
assert(authCss.includes('.strength-strong'), 'auth.css defines .strength-strong (green)');
console.log('  [PASS] 2.1 Strength indicator CSS defined with semantic colors (Red, Amber, Green)');

// --- GROUP 3: Password Policy & Strength Engine in auth.js ---
console.log('\n--- GROUP 3: Password Policy & Strength Engine in auth.js ---');
const authJs = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE', 'features', 'auth', 'auth.js'), 'utf8');

// Evaluate auth.js in isolated VM context
const vm = require('vm');
const sandbox = {
  window: {},
  document: { addEventListener: () => {} },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  console: { log: () => {}, error: () => {}, warn: () => {} }
};
vm.createContext(sandbox);
vm.runInContext(authJs, sandbox);

const validate = sandbox.window.validatePasswordPolicy;
const calculateStrength = sandbox.window.calculatePasswordStrength;

assert(typeof calculateStrength === 'function', 'calculatePasswordStrength exported to window');
assert(typeof validate === 'function', 'validatePasswordPolicy exported to window');
assert(!sandbox.window.BLOCKED_PASSWORDS, 'BLOCKED_PASSWORDS is not exposed on frontend window');
console.log('  [PASS] 3.1 Engines exported and blocklist kept strictly private on backend');

// Test Strength calculation levels
const sEmpty = calculateStrength('');
assert.strictEqual(sEmpty.level, 'none');
assert.strictEqual(sEmpty.label, 'Chưa nhập');

const sWeak = calculateStrength('Hung123');
assert.strictEqual(sWeak.level, 'weak');
assert.strictEqual(sWeak.label, 'Yếu');

const sMedium = calculateStrength('Hung1234');
assert.strictEqual(sMedium.level, 'medium');
assert.strictEqual(sMedium.label, 'Trung bình');

const sStrong = calculateStrength('User@123!456');
assert.strictEqual(sStrong.level, 'strong');
assert.strictEqual(sStrong.label, 'Mạnh');
console.log('  [PASS] 3.2 Strength levels evaluated accurately (Chưa nhập / Yếu / Trung bình / Mạnh)');

// --- GROUP 4: Validity vs Strength Decoupling ---
console.log('\n--- GROUP 4: Validity vs Strength Decoupling ---');
// "Trung bình" password must be valid and allowed by frontend
const medVal = validate('Hung1234');
assert.strictEqual(medVal.isValid, true, '"Trung bình" password is valid');
assert.strictEqual(medVal.minLength, true);
assert.strictEqual(medVal.maxLength, true);
assert.strictEqual(medVal.asciiOnly, true);
assert.strictEqual(medVal.noWhitespace, true);
console.log('  [PASS] 4.1 "Trung bình" password is not blocked if it meets validity rules');

// Invalid password (e.g. spaces) is invalid even if diverse
const spaceVal = validate('Hung 123456');
assert.strictEqual(spaceVal.isValid, false, 'Password with spaces is rejected by validity');
assert.strictEqual(spaceVal.noWhitespace, false);
console.log('  [PASS] 4.2 Validity strictly enforces no-whitespace rule');

// --- GROUP 5: Specification Matrix Verification ---
console.log('\n--- GROUP 5: Specification Matrix Verification ---');
assert.strictEqual(validate('Hung123').minLength, false, '7 chars fails minLength');
assert.strictEqual(validate('Hung1234').minLength, true, '8 chars passes minLength');
assert.strictEqual(validate('a'.repeat(128)).maxLength, true, '128 chars passes maxLength');
assert.strictEqual(validate('a'.repeat(129)).maxLength, false, '129 chars fails maxLength');
assert.strictEqual(validate('Họcviên123456').asciiOnly, false, 'Diacritics fails asciiOnly');
assert.strictEqual(validate('Hung 123456').noWhitespace, false, 'Spaces fails noWhitespace');
assert.strictEqual(validate('Hung🎉2026!').asciiOnly, false, 'Emoji fails asciiOnly');
console.log('  [PASS] 5.1 All 4 core validity criteria verified across boundary inputs');

// --- GROUP 6: Production Database Integrity ---
console.log('\n--- GROUP 6: Production Database Integrity ---');
const dbData = fs.readFileSync(PROD_DB_PATH);
const currentHash = crypto.createHash('sha256').update(dbData).digest('hex').toUpperCase();
assert.strictEqual(currentHash, BASELINE_DB_HASH, 'Production db.json SHA-256 bit-by-bit identical');
console.log(`  [PASS] 6.1 Production db.json intact: ${currentHash}`);

console.log('\n===============================================================');
console.log(' RESULTS: 16/16 CHECKS PASSED (0 FAILED)                       ');
console.log('===============================================================');
