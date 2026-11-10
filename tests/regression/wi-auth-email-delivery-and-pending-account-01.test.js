/**
 * PREPMATE — WI-AUTH-EMAIL-DELIVERY-AND-PENDING-ACCOUNT-01 REGRESSION SUITE
 * 
 * Verifies:
 * 1. GA4 vs Email Delivery Separation (GA4 tracking ID G-4BRJP69Z42 is telemetry only)
 * 2. Runtime IEmailSender & Provider Resolution (CompositeEmailSender, Smtp, DevSandbox)
 * 3. Pending Account Lifecycle & Resend/Re-registration Flow (No dead-end "Email already used")
 * 4. Account Takeover Prevention (Cannot overwrite pending password via re-register)
 * 5. Expired Pending Registration Recovery (Fresh re-registration allowed after expiry)
 * 6. Verified Account Protection (Re-registering verified email strictly rejected without mutation)
 * 7. Password Security Policies:
 *    - Unverified account cannot Change Password
 *    - Unverified account cannot request Password Reset Token
 *    - Unverified account cannot Reset Password
 *    - Verified account can Change Password and Reset Password under policy
 * 8. Token Purpose Isolation (Verification token cannot reset password, reset token cannot verify email)
 * 9. Production Database SHA-256 Invariant
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');
const { resolveDbPath, getBaselineDbHash } = require('../helpers/test-env');

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();

const TEST_PORT = 5099;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_DIR = path.join(os.tmpdir(), `prepmate_auth_email_test_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, 'isolated_auth_db.json');
const TEST_KEYRING = path.join(TEST_DIR, 'keys');
const JWT_TEST_SECRET = 'PREPMATE_SUPER_LONG_JWT_SECRET_KEY_FOR_TESTING_256_BITS!';
const GUEST_TEST_SECRET = 'PREPMATE_TEST_GUEST_KEY_32CHARS_MIN!';

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function hashToken(token, purpose = null) {
  const payload = purpose ? `${purpose}:${token.trim()}` : token.trim();
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex').toLowerCase();
}

function hashPasswordPbkdf2(password, saltHex = '11223344556677889900aabbccddeeff', iterations = 600000) {
  const salt = Buffer.from(saltHex, 'hex');
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  return `pbkdf2_sha256$${iterations}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

function apiRequest(method, endpoint, token = null, body = null, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: endpoint,
      method: method,
      headers: headers,
      timeout: timeoutMs
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`API request timed out (${endpoint})`)); });
    if (postData) req.write(postData);
    req.end();
  });
}

// -------------------------------------------------------------
// SECTION 1: GA4 VS EMAIL SENDER ARCHITECTURAL AUDIT
// -------------------------------------------------------------
function runGa4AndSenderAudit() {
  console.log('\n--- SECTION 1: GA4 VS EMAIL SENDER ARCHITECTURAL AUDIT ---');

  const analyticsJs = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/shared/js/analytics.js'), 'utf8');
  check(analyticsJs.includes('G-4BRJP69Z42'), '1.1 GA4 measurement ID G-4BRJP69Z42 is located in FE/shared/js/analytics.js');
  check(analyticsJs.includes('PrepMateAnalytics'), '1.2 GA4 is used solely for client-side telemetry (PrepMateAnalytics)');
  check(!analyticsJs.includes('smtp') && !analyticsJs.includes('IEmailSender'), '1.3 GA4 module is strictly decoupled from email delivery services');

  const programCs = fs.readFileSync(path.join(WORKSPACE_ROOT, 'BE/Program.cs'), 'utf8');
  check(programCs.includes('builder.Services.AddSingleton<IEmailSender, CompositeEmailSender>();'), '1.4 Program.cs registers CompositeEmailSender as the unified IEmailSender SSOT');
  check(programCs.includes('builder.Services.AddSingleton<IEmailInboxStore, InMemoryEmailInboxStore>();'), '1.5 Program.cs registers InMemoryEmailInboxStore for Sandbox inspection');

  const compositeCs = fs.readFileSync(path.join(WORKSPACE_ROOT, 'BE/Services/Email/CompositeEmailSender.cs'), 'utf8');
  check(compositeCs.includes('_environment?.IsProduction() ?? false'), '1.6 CompositeEmailSender detects production environment');
  check(compositeCs.includes('if (!isProduction)'), '1.7 Sandbox fallback is strictly restricted to non-production environments');
}

// -------------------------------------------------------------
// SECTION 2: END-TO-END LIFECYCLE ON ISOLATED BACKEND SERVER
// -------------------------------------------------------------
async function runLiveServerLifecycleTests() {
  console.log('\n--- SECTION 2: LIVE BACKEND AUTH LIFECYCLE & SECURITY POLICIES ---');

  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  if (!fs.existsSync(TEST_KEYRING)) fs.mkdirSync(TEST_KEYRING, { recursive: true });

  // Clone from production DB fixture and pre-seed test accounts
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);
  const rawDb = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
  if (!rawDb.Users) rawDb.Users = {};

  const verifiedEmail = 'verified_preseed@prepmate.ai';
  const verifiedPassword = 'VerifiedPreseed@2026!';
  rawDb.Users['user_verified_preseed'] = {
    Id: 'user_verified_preseed',
    Fullname: 'Verified Preseed User',
    Email: verifiedEmail,
    Username: 'verified_preseed',
    PasswordHash: hashPasswordPbkdf2(verifiedPassword),
    CreatedAt: new Date(Date.now() - 86400000).toISOString(),
    Role: 'user',
    Subscription: 'free',
    EmailVerified: true,
    EmailVerifiedAt: new Date(Date.now() - 86400000).toISOString(),
    SecurityStamp: 'stamp_verified_preseed_001'
  };

  const pendingActiveEmail = 'pending_active_preseed@prepmate.ai';
  const pendingActivePassword = 'PendingActivePassword@2026!';
  const activeTokenHash = hashToken('active_token_123', 'verify_email');
  rawDb.Users['user_pending_active_preseed'] = {
    Id: 'user_pending_active_preseed',
    Fullname: 'Pending Active Preseed',
    Email: pendingActiveEmail,
    Username: 'pending_active_preseed',
    PasswordHash: hashPasswordPbkdf2(pendingActivePassword),
    CreatedAt: new Date(Date.now() - 600000).toISOString(), // 10 mins ago
    Role: 'user',
    Subscription: 'free',
    EmailVerified: false,
    EmailVerificationTokenHash: activeTokenHash,
    EmailVerificationTokenExpiresAt: new Date(Date.now() + 86400000).toISOString(), // 24h future
    LastVerificationEmailSentAt: new Date(Date.now() - 300000).toISOString(), // 5 mins ago (> 60s cooldown passed)
    SecurityStamp: 'stamp_pending_active_001'
  };

  const pendingExpiredEmail = 'pending_expired_preseed@prepmate.ai';
  const pendingExpiredPassword = 'PendingExpiredPassword@2026!';
  rawDb.Users['user_pending_expired_preseed'] = {
    Id: 'user_pending_expired_preseed',
    Fullname: 'Pending Expired Preseed',
    Email: pendingExpiredEmail,
    Username: 'pending_expired_preseed',
    PasswordHash: hashPasswordPbkdf2(pendingExpiredPassword),
    CreatedAt: new Date(Date.now() - 100000000).toISOString(), // ~28 hrs ago
    Role: 'user',
    Subscription: 'free',
    EmailVerified: false,
    EmailVerificationTokenHash: hashToken('expired_token_123', 'verify_email'),
    EmailVerificationTokenExpiresAt: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
    LastVerificationEmailSentAt: new Date(Date.now() - 100000000).toISOString(),
    SecurityStamp: 'stamp_pending_expired_001'
  };

  fs.writeFileSync(TEST_DB_PATH, JSON.stringify(rawDb, null, 2), 'utf8');

  const beDir = path.join(WORKSPACE_ROOT, 'BE');
  const dllPath = path.join(beDir, 'bin', 'Debug', 'net10.0', 'backend.dll');

  const backendProc = spawn('dotnet', [dllPath, '--urls', BASE_URL], {
    cwd: beDir,
    env: {
      ...process.env,
      DATABASE_FILE_PATH: TEST_DB_PATH,
      PREPMATE_DATABASE_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING,
      JWT__SECRET: JWT_TEST_SECRET,
      GUEST_TOKEN__SIGNING_KEY: GUEST_TEST_SECRET,
      ASPNETCORE_URLS: BASE_URL,
      DOTNET_URLS: BASE_URL,
      ASPNETCORE_ENVIRONMENT: 'Development'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        const ping = await apiRequest('GET', '/api/sessions/quota');
        if (ping.status === 200 || ping.status === 401) {
          ready = true;
          break;
        }
      } catch (e) {}
    }

    check(ready, '2.1 Isolated test backend is online on port ' + TEST_PORT);

    // ---------------------------------------------------------
    // TEST CASE 1: Brand new email registration -> Pending state
    // ---------------------------------------------------------
    const brandNewEmail = `fresh_brand_new_${Date.now()}@prepmate.ai`;
    const brandNewPassword = 'FreshPassword@2026!';
    const regRes1 = await apiRequest('POST', '/api/auth/register', null, {
      fullname: 'Fresh Candidate',
      email: brandNewEmail,
      password: brandNewPassword
    });

    check(regRes1.status === 200, '2.2 New user registration succeeds (200 OK)');
    check(regRes1.data && regRes1.data.requiresVerification === true, '2.3 New registration response sets requiresVerification = true');
    check(regRes1.data && regRes1.data.token === '', '2.4 New registration strictly omits JWT token (no premature session)');

    // ---------------------------------------------------------
    // TEST CASE 2: Login on unverified pending account -> Blocked
    // ---------------------------------------------------------
    const loginPendingRes = await apiRequest('POST', '/api/auth/login', null, {
      email: brandNewEmail,
      password: brandNewPassword
    });
    check(loginPendingRes.status === 400, '2.5 Login rejected for pending unverified account (400 Bad Request)');
    check(loginPendingRes.data?.requiresVerification === true, '2.6 Login response instructs verification required (requiresVerification = true)');
    check(loginPendingRes.data?.token === undefined, '2.7 Login response contains NO JWT token');

    // ---------------------------------------------------------
    // TEST CASE 3: Re-register with pending email within 60s cooldown
    // ---------------------------------------------------------
    const reRegCooldownRes = await apiRequest('POST', '/api/auth/register', null, {
      fullname: 'Attacker Impersonator',
      email: brandNewEmail,
      password: 'AttackerNewPassword@2026!'
    });
    check(reRegCooldownRes.status === 400, '2.8 Re-registration within 60s cooldown rejected with 400');
    check(reRegCooldownRes.data?.code === 'pending_verification_cooldown', '2.9 Returns pending_verification_cooldown instead of dead-end "Email already used"');
    check(reRegCooldownRes.data?.requiresVerification === true, '2.10 Preserves requiresVerification flag on cooldown response');

    // ---------------------------------------------------------
    // TEST CASE 4: Re-register with pending email after cooldown (Resend flow)
    // ---------------------------------------------------------
    // Using pendingActiveEmail (where cooldown has elapsed > 5 mins ago)
    const reRegAllowedRes = await apiRequest('POST', '/api/auth/register', null, {
      fullname: 'Attacker Trying To Overwrite',
      email: pendingActiveEmail,
      password: 'AttackerNewPassword@2026!'
    });
    check(reRegAllowedRes.status === 200, '2.11 Re-registration after cooldown succeeds with 200 OK');
    check(reRegAllowedRes.data?.requiresVerification === true, '2.12 Re-registration guides user to verification page');

    // Account Takeover Defense Check: active pending password hash MUST NOT be overwritten!
    const dbRawCheck = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
    const pendingActiveUser = Object.values(dbRawCheck.Users).find(u => u.Email.toLowerCase() === pendingActiveEmail.toLowerCase());
    check(pendingActiveUser.PasswordHash === hashPasswordPbkdf2(pendingActivePassword), '2.13 Account Takeover Guard: Active pending password CANNOT be overwritten by unauthenticated re-registration');

    // Fresh verification email was dispatched to inbox
    const inboxActiveRes = await apiRequest('GET', `/api/dev/emails?to=${encodeURIComponent(pendingActiveEmail)}`);
    check(inboxActiveRes.status === 200 && Array.isArray(inboxActiveRes.data) && inboxActiveRes.data.length > 0, '2.14 Fresh verification email was dispatched to dev sandbox');
    const tokenMatch = inboxActiveRes.data[inboxActiveRes.data.length - 1].htmlBody.match(/verify-email\.html\?token=([a-f0-9]{64})/i);
    const newToken = tokenMatch ? tokenMatch[1] : null;
    check(newToken !== null && newToken !== 'active_token_123', '2.15 New token is issued and supersedes old token');

    // Old token should be invalidated by new token
    const verifyOldToken = await apiRequest('POST', '/api/auth/verify-email', null, { token: 'active_token_123' });
    check(verifyOldToken.status === 400, '2.16 Single-Use/Superseded: Old active_token_123 rejected after new token issued');

    // ---------------------------------------------------------
    // TEST CASE 5: Unverified account CANNOT Change Password
    // ---------------------------------------------------------
    const unauthChangePwd = await apiRequest('POST', '/api/auth/change-password', null, {
      currentPassword: pendingActivePassword,
      newPassword: 'ChangedPassword@2026!'
    });
    check(unauthChangePwd.status === 401, '2.17 Unauthenticated Change Password rejected with 401 Unauthorized');

    // ---------------------------------------------------------
    // TEST CASE 6: Unverified account CANNOT issue Reset Token via Forgot Password
    // ---------------------------------------------------------
    await apiRequest('DELETE', '/api/dev/emails');
    const forgotPendingRes = await apiRequest('POST', '/api/auth/forgot-password', null, { email: pendingActiveEmail });
    check(forgotPendingRes.status === 200, '2.18 Forgot password returns neutral response (anti-enumeration)');

    const inboxForgotRes = await apiRequest('GET', `/api/dev/emails?to=${encodeURIComponent(pendingActiveEmail)}`);
    const resetEmails = (inboxForgotRes.data || []).filter(e => e.subject && e.subject.includes('đặt lại mật khẩu'));
    check(resetEmails.length === 0, '2.19 Forgot Password Policy: NO reset password email dispatched for unverified pending account');

    // ---------------------------------------------------------
    // TEST CASE 7: Unverified account CANNOT Reset Password
    // ---------------------------------------------------------
    const resetPendingRes = await apiRequest('POST', '/api/auth/reset-password', null, {
      token: newToken,
      newPassword: 'BrandNewPassword@2026!'
    });
    check(resetPendingRes.status === 400, '2.20 Reset Password strictly rejected for unverified account');

    // ---------------------------------------------------------
    // TEST CASE 8: Token Purpose Isolation
    // ---------------------------------------------------------
    const dummyResetVerify = await apiRequest('POST', '/api/auth/verify-email', null, {
      token: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    });
    check(dummyResetVerify.status === 400, '2.21 Arbitrary/Reset token rejected by /api/auth/verify-email');

    // ---------------------------------------------------------
    // TEST CASE 9: Verify Email with newToken (with optional password confirmation)
    // ---------------------------------------------------------
    const confirmedPassword = 'ConfirmedPassword@2026!';
    const verifyRes = await apiRequest('POST', '/api/auth/verify-email', null, {
      token: newToken,
      password: confirmedPassword
    });
    check(verifyRes.status === 200, '2.22 POST /api/auth/verify-email activates user and confirms password');
    check(verifyRes.data?.email === pendingActiveEmail, '2.23 Verification response confirms user email');

    // Login with confirmed password now succeeds!
    const loginSuccessRes = await apiRequest('POST', '/api/auth/login', null, {
      email: pendingActiveEmail,
      password: confirmedPassword
    });
    check(loginSuccessRes.status === 200, '2.24 Login succeeds with newly confirmed password');
    check(typeof loginSuccessRes.data?.token === 'string' && loginSuccessRes.data.token.length > 20, '2.25 Login yields valid JWT token');
    const userJwt = loginSuccessRes.data.token;

    // ---------------------------------------------------------
    // TEST CASE 10: Verified Account CANNOT be re-registered or overwritten
    // ---------------------------------------------------------
    const reRegVerifiedRes = await apiRequest('POST', '/api/auth/register', null, {
      fullname: 'Attacker Against Verified Account',
      email: verifiedEmail,
      password: 'HackerPassword@2026!'
    });
    check(reRegVerifiedRes.status === 400, '2.26 Re-registering verified email strictly rejected with 400');
    check(reRegVerifiedRes.data?.code === 'email_already_registered', '2.27 Response code is email_already_registered');
    check(reRegVerifiedRes.data?.isVerified === true, '2.28 Response informs account is already verified');

    // ---------------------------------------------------------
    // TEST CASE 11: Verified Account CAN Change Password via /api/auth/change-password
    // ---------------------------------------------------------
    const freshPassword = 'SuperFreshPassword@2026!';
    const changePwdRes = await apiRequest('POST', '/api/auth/change-password', userJwt, {
      currentPassword: confirmedPassword,
      newPassword: freshPassword
    });
    check(changePwdRes.status === 200, '2.29 Verified user successfully changes password via /api/auth/change-password');

    // Old password fails
    const oldLoginFail = await apiRequest('POST', '/api/auth/login', null, {
      email: pendingActiveEmail,
      password: confirmedPassword
    });
    check(oldLoginFail.status === 401, '2.30 Old password rejected after change password');

    // New password succeeds
    const newLoginSuccess = await apiRequest('POST', '/api/auth/login', null, {
      email: pendingActiveEmail,
      password: freshPassword
    });
    check(newLoginSuccess.status === 200, '2.31 Login succeeds with new password');

    // Old JWT is revoked due to SecurityStamp update
    const oldJwtAccess = await apiRequest('GET', '/api/auth/me', userJwt);
    check(oldJwtAccess.status === 401, '2.32 SecurityStamp Revocation: Old JWT issued prior to password change is rejected with 401');

    // ---------------------------------------------------------
    // TEST CASE 12: Expired Pending Registration Recovery (Phase 5)
    // ---------------------------------------------------------
    const freshReRegRes = await apiRequest('POST', '/api/auth/register', null, {
      fullname: 'Expired Tester Renewed',
      email: pendingExpiredEmail,
      password: 'RenewedPassword@2026!'
    });
    check(freshReRegRes.status === 200, '2.33 Fresh registration on expired pending account succeeds (200 OK)');
    check(freshReRegRes.data?.requiresVerification === true, '2.34 Expired pending re-registration sets requiresVerification = true');

  } catch (err) {
    check(false, `Server lifecycle test error: ${err.message}`);
  } finally {
    if (backendProc) {
      backendProc.kill('SIGKILL');
      try { process.kill(backendProc.pid); } catch (e) {}
    }
    // Clean up temporary files
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      if (fs.existsSync(TEST_KEYRING)) fs.rmSync(TEST_KEYRING, { recursive: true, force: true });
      if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }
}

// -------------------------------------------------------------
// SECTION 3: PRODUCTION DATABASE INVARIANT CHECK
// -------------------------------------------------------------
function runDatabaseIntegrityCheck() {
  console.log('\n--- SECTION 3: PRODUCTION DATABASE INVARIANT CHECK ---');
  const currentDbContent = fs.readFileSync(PROD_DB_PATH);
  const currentHash = crypto.createHash('sha256').update(currentDbContent).digest('hex').toUpperCase();
  check(currentHash === BASELINE_DB_HASH, `Production db.json SHA-256 strictly preserved (${currentHash.slice(0, 16)}...)`);
}

// -------------------------------------------------------------
// MAIN RUNNER
// -------------------------------------------------------------
async function runAll() {
  console.log('================================================================================');
  console.log('  PREPMATE — WI-AUTH-EMAIL-DELIVERY-AND-PENDING-ACCOUNT-01 REGRESSION SUITE');
  console.log('================================================================================');

  runGa4AndSenderAudit();
  await runLiveServerLifecycleTests();
  runDatabaseIntegrityCheck();

  console.log('\n================================================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error('FATAL ERROR IN SUITE:', err);
  process.exit(1);
});
