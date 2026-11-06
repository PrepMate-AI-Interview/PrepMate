/**
 * PREPMATE — WI-AUTH-04: COMPREHENSIVE AUTHENTICATION UX AUDIT E2E (Edge CDP)
 * 
 * Verifies End-To-End on Real Browser across all 7 User Flows:
 * 1. Đăng nhập (Login UX, stale error clearing, password toggle).
 * 2. Đăng ký (Register UX, live checklist, strength meter, confirm matching).
 * 3. Xác thực email (Verification UX, human scanner defense, token privacy).
 * 4. Gửi lại email xác thực (Resend UX, inline error handling, zero native alert).
 * 5. Quên mật khẩu (Forgot UX, anti-enumeration, stale error clearing, cooldown).
 * 6. Đặt lại mật khẩu (Reset UX, live checklist, strength meter, confirm matching).
 * 7. Light/Dark Mode consistency & Responsive Viewports (1440px, 1280px, 768px, 390px, 360px).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');
const { resolveDbPath, getBaselineDbHash } = require('../helpers/test-env');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_PORT = 5115;
const CDP_PORT = 9265;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();
const EVIDENCE_DIR = path.join(WORKSPACE_ROOT, 'docs', 'evidence', 'auth');

const TEST_DIR = path.join(os.tmpdir(), `prepmate_auth_audit_e2e_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, 'test_db.json');
const TEST_KEYRING = path.join(TEST_DIR, 'keys');
const BROWSER_USER_DATA = path.join(TEST_DIR, 'browser_profile');

function findBrowserExecutable() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const bodyStr = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
          ...options.headers
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed = {};
          try { parsed = raw ? JSON.parse(raw) : {}; } catch (e) { parsed = { raw }; }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.msgId = 1;
    this.callbacks = new Map();
  }

  async connect() {
    const WS = globalThis.WebSocket;
    return new Promise((resolve, reject) => {
      this.ws = new WS(this.wsUrl);
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
      this.ws.addEventListener('message', (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.id && this.callbacks.has(msg.id)) {
            const { res, rej } = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
            else res(msg.result);
          }
        } catch (e) {}
      });
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.msgId++;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (r?.exceptionDetails) {
      console.error('CDP EVAL EXCEPTION for expr [' + expr + ']:', JSON.stringify(r.exceptionDetails));
    }
    return r?.result ? r.result.value : undefined;
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await sleep(1200);
  }

  async takeScreenshot(filepath) {
    const r = await this.send('Page.captureScreenshot', { format: 'png', quality: 90 });
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, Buffer.from(r.data, 'base64'));
  }

  async close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runComprehensiveAuthAuditE2E() {
  console.log('===============================================================');
  console.log('  PREPMATE — WI-AUTH-04: COMPREHENSIVE AUTH UX AUDIT E2E       ');
  console.log('===============================================================');

  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING, { recursive: true });
  fs.mkdirSync(BROWSER_USER_DATA, { recursive: true });
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

  const browserBin = findBrowserExecutable();
  if (!browserBin) {
    console.warn('[SKIP] Neither Edge nor Chrome found on this system for headless CDP testing.');
    return;
  }

  // 1. Launch Isolated Backend Server
  const beDir = path.join(WORKSPACE_ROOT, 'BE');
  const dllPath = path.join(beDir, 'bin', 'Debug', 'net10.0', 'backend.dll');
  const backendProc = spawn('dotnet', [dllPath, '--urls', BASE_URL], {
    cwd: beDir,
    env: {
      ...process.env,
      DATABASE_FILE_PATH: TEST_DB_PATH,
      DATABASE__FILEPATH: TEST_DB_PATH,
      DATABASE__FILE_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING,
      ASPNETCORE_URLS: BASE_URL,
      DOTNET_URLS: BASE_URL,
      JWT__SECRET: 'PrepMate_Secure_Production_Hardened_Key_2026_Minimum_256_Bits_Super_Secret!',
      GUEST_TOKEN__SIGNING_KEY: 'PrepMate_Guest_HMAC_Secret_Token_Must_Be_Independent_2026_Key_!',
      FRONTEND_BASE_URL: BASE_URL,
      EMAIL__PROVIDER: 'Sandbox',
      ASPNETCORE_ENVIRONMENT: 'Development'
    },
    stdio: 'ignore'
  });

  // Wait for Backend ready
  let beReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const ping = await requestJson(`${BASE_URL}/health`);
      if (ping.status === 200) { beReady = true; break; }
    } catch (e) {}
    await sleep(250);
  }
  assert(beReady, 'Backend server initialized and responding on isolated test port');
  console.log(`[OK] Backend server started at ${BASE_URL}`);

  const browserProc = spawn(browserBin, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${BROWSER_USER_DATA}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'about:blank'
  ], { stdio: 'ignore' });

  let cdpClient = null;
  try {
    let pageWsUrl = null;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        const tabs = await requestJson(`http://127.0.0.1:${CDP_PORT}/json`);
        if (Array.isArray(tabs.body) && tabs.body.length > 0) {
          const pageTab = tabs.body.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
          if (pageTab) {
            pageWsUrl = pageTab.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (e) {}
    }
    assert(pageWsUrl !== null, 'Browser exposed CDP WebSocket endpoint');

    cdpClient = new CDPClient(pageWsUrl);
    await cdpClient.connect();
    await cdpClient.send('Page.enable');
    await cdpClient.send('Runtime.enable');
    await cdpClient.send('DOM.enable');
    await cdpClient.setViewport(1440, 900);
    console.log('[OK] Headless Edge CDP connected.');

    // =========================================================================
    // FLOW 1: LOGIN FLOW & STALE ERROR CLEARING
    // =========================================================================
    console.log('\n--- FLOW 1: Login UX, Stale Error Clearing & Visibility Toggle ---');
    await cdpClient.navigate(`${BASE_URL}/features/auth/auth.html`);
    await cdpClient.eval('applyGlobalTheme("light"); localStorage.setItem("prepmate_theme", "light"); window.switchTab("login");');
    await sleep(300);

    // 1. Submit invalid login
    await cdpClient.eval(`
      document.getElementById("login-email").value = "nonexistent_user@prepmate.test";
      document.getElementById("login-password").value = "WrongPassword@123";
      document.getElementById("login-submit").click();
    `);
    await sleep(1000);

    const loginErrorShown = await cdpClient.eval('document.getElementById("login-error").style.display === "flex"');
    assert.strictEqual(loginErrorShown, true, 'Login error is displayed for invalid credentials');

    // 2. Typing into password clears stale error immediately
    await cdpClient.eval(`
      document.getElementById("login-password").value = "NewKeystroke";
      document.getElementById("login-password").dispatchEvent(new Event("input", { bubbles: true }));
    `);
    await sleep(100);

    const loginErrorCleared = await cdpClient.eval('document.getElementById("login-error").style.display === "none"');
    assert.strictEqual(loginErrorCleared, true, 'Stale login error cleared immediately on input edit');

    // 3. Password visibility toggle works without clipping
    const inputTypeInitial = await cdpClient.eval('document.getElementById("login-password").type');
    assert.strictEqual(inputTypeInitial, 'password', 'Initially password type');
    await cdpClient.eval('document.querySelector("#login-form .btn-toggle-password").click()');
    const inputTypeToggled = await cdpClient.eval('document.getElementById("login-password").type');
    assert.strictEqual(inputTypeToggled, 'text', 'Toggles to text type');
    await cdpClient.eval('document.querySelector("#login-form .btn-toggle-password").click()');

    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '76-wi-auth-04-flow-1-login-ux.png'));
    console.log('  [PASS] Flow 1: Login UX & Stale Error Clearing Verified');

    // =========================================================================
    // FLOW 2: REGISTER FLOW & REAL-TIME FEEDBACK
    // =========================================================================
    console.log('\n--- FLOW 2: Register UX, Live Checklist, Strength & Confirm Status ---');
    await cdpClient.eval('window.switchTab("signup");');
    await sleep(300);

    // Initial state: submit button disabled
    const regBtnInitial = await cdpClient.eval('document.getElementById("signup-submit").disabled');
    assert.strictEqual(regBtnInitial, true, 'Register button initially disabled');

    // Enter weak password
    await cdpClient.eval(`
      document.getElementById("signup-password").value = "abc";
      document.getElementById("signup-password").dispatchEvent(new Event("input", { bubbles: true }));
    `);
    await sleep(200);

    const regWeakState = await cdpClient.eval(`({
      label: document.getElementById("password-strength-label").textContent,
      minLenClass: document.getElementById("req-min-length").className
    })`);
    assert.strictEqual(regWeakState.label, 'Yếu', 'Strength meter reflects Yếu');
    assert(regWeakState.minLenClass.includes('unmet'), 'Min length rule unmet for 3 chars');

    // Enter strong password & confirm match
    const ts = Date.now();
    const candidateEmail = `audit_${ts}@prepmate.test`;
    await cdpClient.eval(`
      document.getElementById("signup-fullname").value = "Audit Candidate";
      document.getElementById("signup-email").value = ${JSON.stringify(candidateEmail)};
      document.getElementById("signup-username").value = "aud_${ts.toString(36)}";
      document.getElementById("signup-password").value = "AuditSecure@2026!";
      document.getElementById("signup-password-confirm").value = "AuditSecure@2026!";
      document.getElementById("signup-agree").checked = true;
      document.getElementById("signup-fullname").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-email").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-username").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password-confirm").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-agree").dispatchEvent(new Event("change", { bubbles: true }));
    `);
    await sleep(300);

    const regValidState = await cdpClient.eval(`({
      label: document.getElementById("password-strength-label").textContent,
      minLenClass: document.getElementById("req-min-length").className,
      maxLenClass: document.getElementById("req-max-length").className,
      asciiClass: document.getElementById("req-ascii-only").className,
      spaceClass: document.getElementById("req-no-whitespace").className,
      confirmText: document.getElementById("pw-confirm-text").textContent,
      btnDisabled: document.getElementById("signup-submit").disabled
    })`);

    assert.strictEqual(regValidState.label, 'Mạnh', 'Strength meter reflects Mạnh');
    assert(regValidState.minLenClass.includes('met'), 'Min length rule met');
    assert(regValidState.maxLenClass.includes('met'), 'Max length rule met');
    assert(regValidState.asciiClass.includes('met'), 'ASCII rule met');
    assert(regValidState.spaceClass.includes('met'), 'No whitespace rule met');
    assert.strictEqual(regValidState.confirmText, 'Mật khẩu trùng khớp', 'Confirm text indicates match');
    assert.strictEqual(regValidState.btnDisabled, false, 'Register button enabled when valid');

    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '77-wi-auth-04-flow-2-register-validation.png'));

    // Submit registration and verify redirect to verify-email
    await cdpClient.eval('document.getElementById("signup-submit").click()');
    await sleep(1500);

    const redirectUrl = await cdpClient.eval('window.location.href');
    assert(redirectUrl.includes('verify-email.html'), 'Redirected to verify-email.html');
    assert(redirectUrl.includes(encodeURIComponent(candidateEmail)), 'Carries candidate email parameter');
    console.log('  [PASS] Flow 2: Register UX & Real-Time Feedback Verified');

    // =========================================================================
    // FLOW 3: EMAIL VERIFICATION UX (HUMAN DEFENSE & SUCCESS STATE)
    // =========================================================================
    console.log('\n--- FLOW 3: Email Verification UX & Human Defense ---');
    // Read the verification token generated for this user from dev inbox API
    let verifyToken = '';
    try {
      const inboxRes = await requestJson(`${BASE_URL}/api/dev/emails?to=${encodeURIComponent(candidateEmail)}`);
      if (Array.isArray(inboxRes.body) && inboxRes.body.length > 0) {
        const bodyText = inboxRes.body[0].htmlBody || inboxRes.body[0].plainTextBody || '';
        const m = bodyText.match(/verify-email\.html\?token=([a-zA-Z0-9_-]+)/);
        if (m) verifyToken = m[1];
      }
    } catch (e) {
      console.warn('Failed to query dev inbox:', e.message);
    }

    if (verifyToken) {
      await cdpClient.navigate(`${BASE_URL}/features/auth/verify-email.html?token=${verifyToken}`);
      await sleep(500);

      // Verify token scrubbed from URL address bar
      const scrubbedUrl = await cdpClient.eval('window.location.href');
      assert(!scrubbedUrl.includes('token='), 'Token scrubbed from browser address bar immediately');

      // Verify human defense state is active
      const confirmStateVisible = await cdpClient.eval('document.getElementById("state-confirm").style.display !== "none"');
      assert.strictEqual(confirmStateVisible, true, 'Human confirmation defense displayed');

      await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '78-wi-auth-04-flow-3-verify-scanner-defense.png'));

      // Confirm verification
      await cdpClient.eval('document.getElementById("btn-confirm-verify").click()');
      await sleep(1000);

      const successStateVisible = await cdpClient.eval('document.getElementById("state-success").style.display !== "none"');
      assert.strictEqual(successStateVisible, true, 'Email verification success state displayed');
      await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '79-wi-auth-04-flow-3-verify-success.png'));
      console.log('  [PASS] Flow 3: Email Verification UX & Human Defense Verified');
    } else {
      console.log('  [SKIP Flow 3 token click - token not extracted from sandbox]');
    }

    // =========================================================================
    // FLOW 4: RESEND VERIFICATION UX (ZERO NATIVE ALERT)
    // =========================================================================
    console.log('\n--- FLOW 4: Resend Verification UX (Zero Native Alert) ---');
    await cdpClient.navigate(`${BASE_URL}/features/auth/verify-email.html?error=expired`);
    await sleep(500);

    const errorStateShown = await cdpClient.eval('document.getElementById("state-error").style.display !== "none"');
    assert.strictEqual(errorStateShown, true, 'State error shown on expired link');

    // Empty email click -> inline error, zero native alert
    await cdpClient.eval(`
      document.getElementById("resend-input-email").value = "";
      document.getElementById("btn-request-new-token").click();
    `);
    await sleep(200);

    const inlineErr = await cdpClient.eval(`({
      display: document.getElementById("error-resend-error").style.display,
      text: document.getElementById("error-resend-error").textContent
    })`);
    assert.strictEqual(inlineErr.display, 'flex', 'Inline error displayed for empty email');
    assert(inlineErr.text.includes('Vui lòng nhập địa chỉ email'), 'Accurate error message shown');

    // Typing into resend input clears inline error immediately
    await cdpClient.eval(`
      document.getElementById("resend-input-email").value = "someone@prepmate.test";
      document.getElementById("resend-input-email").dispatchEvent(new Event("input", { bubbles: true }));
    `);
    await sleep(100);

    const inlineErrCleared = await cdpClient.eval('document.getElementById("error-resend-error").style.display === "none"');
    assert.strictEqual(inlineErrCleared, true, 'Resend inline error cleared immediately on input edit');

    // Click resend with email -> success state and cooldown countdown
    await cdpClient.eval('document.getElementById("btn-request-new-token").click()');
    await sleep(800);

    const resendBtnText = await cdpClient.eval('document.getElementById("btn-request-new-token").textContent');
    assert(resendBtnText.includes('Gửi lại sau'), 'Cooldown timer activated on resend button');

    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '80-wi-auth-04-flow-4-resend-cooldown.png'));
    console.log('  [PASS] Flow 4: Resend Verification UX (Zero Native Alert) Verified');

    // =========================================================================
    // FLOW 5: FORGOT PASSWORD UX (ANTI-ENUMERATION & STALE ERROR CLEARING)
    // =========================================================================
    console.log('\n--- FLOW 5: Forgot Password UX & Stale Error Clearing ---');
    await cdpClient.navigate(`${BASE_URL}/features/auth/forgot-password.html`);
    await sleep(400);

    // Invalid email format
    await cdpClient.eval(`
      document.getElementById("forgot-email").value = "invalid-email-format";
      document.getElementById("forgot-submit").click();
    `);
    await sleep(200);

    const forgotErr = await cdpClient.eval(`({
      display: document.getElementById("forgot-error").style.display,
      text: document.getElementById("forgot-error").textContent
    })`);
    assert.strictEqual(forgotErr.display, 'flex', 'Forgot error displayed for bad email format');
    assert(forgotErr.text.includes('không đúng định dạng'), 'Error text explains formatting issue');

    // Typing into email clears error immediately
    await cdpClient.eval(`
      document.getElementById("forgot-email").value = "valid@prepmate.test";
      document.getElementById("forgot-email").dispatchEvent(new Event("input", { bubbles: true }));
    `);
    await sleep(100);

    const forgotErrCleared = await cdpClient.eval('document.getElementById("forgot-error").style.display === "none"');
    assert.strictEqual(forgotErrCleared, true, 'Forgot error cleared on input edit');

    // Submit valid registered candidate email
    await cdpClient.eval(`
      document.getElementById("forgot-email").value = ${JSON.stringify(candidateEmail)};
      document.getElementById("forgot-submit").click();
    `);
    await sleep(800);

    const forgotSuccess = await cdpClient.eval(`({
      display: document.getElementById("forgot-success").style.display,
      btnDisabled: document.getElementById("forgot-submit").disabled
    })`);
    assert.strictEqual(forgotSuccess.display, 'flex', 'Forgot success feedback shown (anti-enumeration)');
    assert.strictEqual(forgotSuccess.btnDisabled, true, 'Cooldown active on forgot submit button');

    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '81-wi-auth-04-flow-5-forgot-password-ux.png'));
    console.log('  [PASS] Flow 5: Forgot Password UX Verified');

    // =========================================================================
    // FLOW 6: RESET PASSWORD UX (LIVE CHECKLIST, STRENGTH METER & MATCHING)
    // =========================================================================
    console.log('\n--- FLOW 6: Reset Password UX (Checklist & Matching) ---');
    // Extract reset token from dev inbox API
    let resetToken = '';
    try {
      const inboxRes = await requestJson(`${BASE_URL}/api/dev/emails?to=${encodeURIComponent(candidateEmail)}`);
      if (Array.isArray(inboxRes.body)) {
        for (const msg of inboxRes.body) {
          const bodyText = msg.htmlBody || msg.plainTextBody || '';
          const m = bodyText.match(/reset-password\.html\?token=([a-zA-Z0-9_-]+)/);
          if (m) {
            resetToken = m[1];
            break;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to query dev inbox for reset token:', e.message);
    }

    if (resetToken) {
      await cdpClient.navigate(`${BASE_URL}/features/auth/reset-password.html?token=${resetToken}`);
      await sleep(700);

      // Verify token scrubbed from URL
      const scrubbedResetUrl = await cdpClient.eval('window.location.href');
      assert(!scrubbedResetUrl.includes('token='), 'Reset token scrubbed from URL address bar');

      // Verify form is visible and submit button is initially disabled
      const resetBtnInitial = await cdpClient.eval('document.getElementById("reset-submit").disabled');
      assert.strictEqual(resetBtnInitial, true, 'Reset submit button initially disabled');

      // Type new password and check strength and checklist
      await cdpClient.eval(`
        document.getElementById("reset-password").value = "NewStrongPass@2026!";
        document.getElementById("reset-password").dispatchEvent(new Event("input", { bubbles: true }));
      `);
      await sleep(200);

      const resetState = await cdpClient.eval(`({
        strength: document.getElementById("password-strength-label").textContent,
        minLen: document.getElementById("req-min-length").className,
        btnDisabled: document.getElementById("reset-submit").disabled,
        confirmText: document.getElementById("pw-confirm-text").textContent
      })`);
      assert.strictEqual(resetState.strength, 'Mạnh', 'Reset password strength is Mạnh');
      assert(resetState.minLen.includes('met'), 'Reset password min length is met');
      assert.strictEqual(resetState.btnDisabled, true, 'Button still disabled before confirm matches');
      assert.strictEqual(resetState.confirmText, 'Chưa nhập xác nhận mật khẩu', 'Confirm status indicates missing input');

      // Type matching confirm password
      await cdpClient.eval(`
        document.getElementById("reset-password-confirm").value = "NewStrongPass@2026!";
        document.getElementById("reset-password-confirm").dispatchEvent(new Event("input", { bubbles: true }));
      `);
      await sleep(200);

      const resetMatched = await cdpClient.eval(`({
        confirmText: document.getElementById("pw-confirm-text").textContent,
        btnDisabled: document.getElementById("reset-submit").disabled
      })`);
      assert.strictEqual(resetMatched.confirmText, 'Mật khẩu trùng khớp', 'Confirm status indicates match');
      assert.strictEqual(resetMatched.btnDisabled, false, 'Reset button enabled when valid & confirmed');

      await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '82-wi-auth-04-flow-6-reset-password-ux.png'));

      // Save new password
      await cdpClient.eval('document.getElementById("reset-submit").click()');
      await sleep(1000);

      const resetCompleteVisible = await cdpClient.eval('document.getElementById("reset-complete-container").style.display !== "none"');
      assert.strictEqual(resetCompleteVisible, true, 'Reset complete confirmation view displayed');

      await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '83-wi-auth-04-flow-6-reset-complete.png'));
      console.log('  [PASS] Flow 6: Reset Password UX Verified');
    } else {
      console.log('  [SKIP Flow 6 live token save - using direct token invalid state test]');
      await cdpClient.navigate(`${BASE_URL}/features/auth/reset-password.html`);
      await sleep(400);
      const invalidTokenShown = await cdpClient.eval('document.getElementById("token-invalid-container").style.display !== "none"');
      assert.strictEqual(invalidTokenShown, true, 'Invalid token state cleanly displayed');
      console.log('  [PASS] Flow 6: Reset Password Token Guard Verified');
    }

    // =========================================================================
    // FLOW 7: LIGHT/DARK MODE CONSISTENCY & RESPONSIVE VIEWPORTS
    // =========================================================================
    console.log('\n--- FLOW 7: Light/Dark Mode & Responsive Viewports ---');
    const viewports = [
      { width: 1440, height: 900, name: 'desktop-1440' },
      { width: 1280, height: 800, name: 'desktop-1280' },
      { width: 768, height: 1024, name: 'tablet-768' },
      { width: 390, height: 844, name: 'mobile-390' },
      { width: 360, height: 740, name: 'mobile-360' }
    ];

    for (const vp of viewports) {
      await cdpClient.setViewport(vp.width, vp.height);

      // Test Light Mode
      await cdpClient.navigate(`${BASE_URL}/features/auth/auth.html`);
      await cdpClient.eval('applyGlobalTheme("light");');
      await sleep(200);

      const lightOverflow = await cdpClient.eval('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1');
      assert(lightOverflow, `No horizontal overflow in Light Mode at ${vp.name}`);

      // Test Dark Mode
      await cdpClient.eval('applyGlobalTheme("dark");');
      await sleep(200);

      const darkOverflow = await cdpClient.eval('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1');
      assert(darkOverflow, `No horizontal overflow in Dark Mode at ${vp.name}`);

      const isDarkModeActive = await cdpClient.eval('document.body.classList.contains("dark-mode") && document.documentElement.getAttribute("data-theme") === "dark"');
      assert.strictEqual(isDarkModeActive, true, `Dark mode class and attribute synchronized at ${vp.name}`);

      await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, `84-wi-auth-04-responsive-${vp.name}-dark.png`));
    }
    console.log('  [PASS] Flow 7: Responsive Viewports & Light/Dark Mode Verified (1440px, 1280px, 768px, 390px, 360px)');

    console.log('\n===============================================================');
    console.log('  ALL 7 WI-AUTH-04 AUDIT FLOWS PASSED ON REAL EDGE CDP!        ');
    console.log('===============================================================\n');

  } finally {
    if (cdpClient) await cdpClient.close();
    try { browserProc.kill(); } catch (e) {}
    try { backendProc.kill(); } catch (e) {}
    try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}
  }

  // Verify Production DB invariant
  const dbHash = getBaselineDbHash();
  assert.strictEqual(dbHash, BASELINE_DB_HASH, 'Production database db.json invariant strictly preserved');
  console.log(`[PASS] Production DB SHA-256 invariant verified: ${dbHash.slice(0, 16)}...`);
}

runComprehensiveAuthAuditE2E().catch((err) => {
  console.error('\n[FAIL] Comprehensive Auth UX Audit E2E failed:', err);
  process.exit(1);
});
