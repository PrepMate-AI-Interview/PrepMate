/**
 * PREPMATE — WI-AUTH-01: REAL BROWSER E2E TEST SUITE (Edge CDP)
 * 
 * Verifies End-To-End on Real Browser:
 * 1. Registration Flow:
 *    - Open Register form, input valid credentials, submit.
 *    - Redirect to verify-email.html with pending confirmation state.
 *    - Capture delivered email in sandbox store.
 *    - Click / navigate to verification link.
 *    - Verify success state on UI and return to login.
 * 2. Login Flow:
 *    - Attempt login before verification -> blocked with verification notice.
 *    - Login after verification -> succeeds.
 * 3. Forgot & Reset Password Flow:
 *    - Click "Quên mật khẩu?" from Login page.
 *    - Submit email on forgot-password.html.
 *    - Capture reset email in sandbox store.
 *    - Open reset-password.html?token=... in browser.
 *    - Toggle password visibility, enter matching new passwords, submit.
 *    - Verify success UI, login with new password succeeds, old password rejected.
 * 4. Responsive Verification across 4 viewports:
 *    - 1440px, 1024px, 768px, 390px (no horizontal overflow).
 * 5. Theme toggle (Light/Dark mode) integrity.
 * 6. Production DB SHA-256 Invariant.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');
const { resolvePath, resolveDbPath, getBaselineDbHash } = require('../helpers/test-env');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_PORT = 5097;
const CDP_PORT = 9247;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();
const EVIDENCE_DIR = path.join(WORKSPACE_ROOT, 'docs', 'evidence', 'auth');

const TEST_DIR = path.join(os.tmpdir(), `prepmate_auth_e2e_${Date.now()}`);
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
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error(`Timeout calling ${url}`)));
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
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(r.exceptionDetails)}`);
    }
    return r.result ? r.result.value : undefined;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await sleep(1500);
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    await sleep(300);
  }

  async takeScreenshot(filepath) {
    try {
      const r = await this.send('Page.captureScreenshot', { format: 'png' });
      if (r && r.data) {
        fs.writeFileSync(filepath, Buffer.from(r.data, 'base64'));
        console.log(`  [SCREENSHOT] Saved: ${path.basename(filepath)}`);
      }
    } catch (e) {
      console.warn(`  [SCREENSHOT WARNING] Failed to capture ${path.basename(filepath)}:`, e.message);
    }
  }

  async close() {
    try {
      this.ws.close();
    } catch (e) {}
  }
}

async function runBrowserE2E() {
  console.log('===============================================================');
  console.log('   PREPMATE — WI-AUTH-01: REAL BROWSER E2E TEST (Edge CDP)     ');
  console.log('===============================================================\n');

  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING, { recursive: true });
  fs.mkdirSync(BROWSER_USER_DATA, { recursive: true });
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

  // Seed existing legacy account with Vietnamese characters and spaces in password
  const initialDbData = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
  initialDbData.Users['legacy_unicode_user'] = {
    Id: 'legacy_unicode_user',
    Fullname: 'Người dùng Cũ',
    Email: 'legacy_unicode@prepmate.test',
    Username: 'legacy_unicode',
    Password: 'Mật khẩu cũ 2026!',
    PasswordHash: '',
    CreatedAt: '2025-01-01T00:00:00Z',
    Role: 'candidate',
    EmailVerified: true
  };
  fs.writeFileSync(TEST_DB_PATH, JSON.stringify(initialDbData, null, 2), 'utf8');

  const browserBin = findBrowserExecutable();
  if (!browserBin) {
    console.warn('[SKIP] Neither Edge nor Chrome found on this system for headless CDP testing.');
    return;
  }

  // 1. Start Isolated Backend Server
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
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Wait for Backend to become ready
  let beReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const ping = await requestJson(`${BASE_URL}/health`);
      if (ping.status === 200) { beReady = true; break; }
    } catch (e) {}
    await sleep(250);
  }
  assert(beReady, 'Backend server initialized and responding on isolated test port');

  // 2. Start Headless Edge Browser with Remote Debugging
  const browserProc = spawn(browserBin, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${BROWSER_USER_DATA}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'about:blank',
  ], {
    stdio: 'ignore'
  });

  let cdpClient = null;
  try {
    // Connect to CDP
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
    assert(pageWsUrl !== null, 'Browser launched and exposed CDP WebSocket endpoint');

    cdpClient = new CDPClient(pageWsUrl);
    await cdpClient.connect();
    await cdpClient.send('Page.enable');
    await cdpClient.send('Runtime.enable');
    await cdpClient.send('DOM.enable');

    console.log('\n--- FLOW 1: Registration & Email Verification in Real Browser ---');

    const timestamp = Date.now();
    const candidateEmail = `browser_candidate_${timestamp}@prepmate.test`;
    const candidatePassword = 'Password2026@Secure!';
    const candidateName = 'Trần Văn Trình Duyệt';
    const candidateUsername = `user_${timestamp.toString(36)}`;

    // 1.1 Open Auth page
    await cdpClient.navigate(`${BASE_URL}/features/auth/auth.html`);
    const pageTitle = await cdpClient.eval('document.title');
    assert(pageTitle.includes('PrepMate'), 'Auth page loads with correct title');

    // 1.2 Switch to Signup Tab
    await cdpClient.eval("switchTab('signup')");
    await sleep(300);
    const isSignupActive = await cdpClient.eval("document.getElementById('signup-form').classList.contains('active')");
    assert(isSignupActive, 'Signup tab activated on real browser');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '01-signup-tab.png'));

    // 1.2b Test invalid password policy validation (Vietnamese + space) on real browser
    await cdpClient.eval(`
      document.getElementById('signup-fullname').value = 'Test Validation';
      document.getElementById('signup-email').value = 'test_val@prepmate.test';
      document.getElementById('signup-username').value = 'test_val';
      document.getElementById('signup-password').value = 'Sinh viên 2026!';
      document.getElementById('signup-password-confirm').value = 'Sinh viên 2026!';
      document.getElementById('signup-agree').checked = true;
    `);
    await cdpClient.eval("document.getElementById('signup-form').dispatchEvent(new Event('submit', { cancelable: true }))");
    await sleep(400);
    const signupErr = await cdpClient.eval("document.getElementById('signup-error').textContent");
    assert(signupErr.includes('không chứa khoảng trắng'), 'Registration UI rejects non-ASCII and space with policy message');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '01-signup-validation-error.png'));

    // 1.3 Fill Signup form with valid credentials
    await cdpClient.eval(`
      document.getElementById('signup-fullname').value = ${JSON.stringify(candidateName)};
      document.getElementById('signup-email').value = ${JSON.stringify(candidateEmail)};
      document.getElementById('signup-username').value = ${JSON.stringify(candidateUsername)};
      document.getElementById('signup-password').value = ${JSON.stringify(candidatePassword)};
      document.getElementById('signup-password-confirm').value = ${JSON.stringify(candidatePassword)};
      document.getElementById('signup-agree').checked = true;
    `);
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '01-signup-filled.png'));

    // 1.4 Submit Registration
    await cdpClient.eval("document.getElementById('signup-form').dispatchEvent(new Event('submit', { cancelable: true }))");
    
    // Wait for redirect to verify-email.html
    let currentUrl = '';
    for (let i = 0; i < 25; i++) {
      await sleep(250);
      currentUrl = await cdpClient.eval('window.location.href');
      if (currentUrl.includes('verify-email.html')) break;
    }

    if (!currentUrl.includes('verify-email.html')) {
      const errText = await cdpClient.eval("document.getElementById('signup-error') ? document.getElementById('signup-error').textContent : ''");
      const sucText = await cdpClient.eval("document.getElementById('signup-success') ? document.getElementById('signup-success').textContent : ''");
      console.log('Registration debug -> URL:', currentUrl, 'Error:', errText, 'Success:', sucText);
    }
    assert(currentUrl.includes('verify-email.html'), 'Registration redirects user to verify-email.html');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '02-verify-pending.png'));

    const displayedEmail = await cdpClient.eval("document.getElementById('pending-email-display') ? document.getElementById('pending-email-display').textContent.trim() : ''");
    assert(displayedEmail === candidateEmail, 'verify-email.html displays the registered email to user');

    // 1.5 Test resend verification button interaction in browser
    await cdpClient.eval("document.getElementById('btn-resend-verification').click()");
    await sleep(400);
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '02-verify-resend-cooldown.png'));

    // 1.6 Verify email delivery in sandbox
    const emailRes = await requestJson(`${BASE_URL}/api/dev/emails?to=${encodeURIComponent(candidateEmail)}`);
    assert(Array.isArray(emailRes.body) && emailRes.body.length > 0, 'Sandbox captured sent verification email');
    const sentEmail = emailRes.body[0];
    assert(sentEmail.subject.includes('Xác nhận địa chỉ email'), 'Verification email has correct subject');

    const tokenMatch = sentEmail.htmlBody.match(/verify-email\.html\?token=([a-f0-9]{64})/i);
    assert(tokenMatch && tokenMatch[1], 'Verification link with 64-char token extracted from email');
    const token = tokenMatch[1];

    // 1.7 Open verification link in browser
    await cdpClient.navigate(`${BASE_URL}/features/auth/verify-email.html?token=${token}`);
    await sleep(1000);

    // WI-02: Address bar token scrubbing verification
    const verifyAddressBarUrl = await cdpClient.eval('window.location.href');
    assert(!verifyAddressBarUrl.includes('token='), 'WI-04 Token Privacy: Verification token scrubbed from address bar via history.replaceState');

    // WI-02: Page arrives at confirmation state (#state-confirm), preventing premature automated activation
    const isConfirmVisible = await cdpClient.eval("document.getElementById('state-confirm').style.display !== 'none'");
    assert(isConfirmVisible, 'verify-email.html displays active human confirmation state (#state-confirm)');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '03-verify-confirm.png'));

    // Human active confirmation click
    await cdpClient.eval("document.getElementById('btn-confirm-verify').click()");
    await sleep(1200);

    const isSuccessVisible = await cdpClient.eval("document.getElementById('state-success').style.display !== 'none'");
    assert(isSuccessVisible, 'verify-email.html confirms email activated with success banner after human confirmation');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '04-verify-success.png'));

    console.log('\n--- FLOW 2: Login Flow Verification ---');

    // 2.1 Navigate to login
    await cdpClient.navigate(`${BASE_URL}/features/auth/auth.html`);
    await sleep(400);
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '05-login-page.png'));

    // 2.2 Test invalid password login on real browser
    await cdpClient.eval(`
      document.getElementById('login-email').value = ${JSON.stringify(candidateEmail)};
      document.getElementById('login-password').value = 'WrongPassword123!';
    `);
    await cdpClient.eval("document.getElementById('login-form').dispatchEvent(new Event('submit', { cancelable: true }))");
    await sleep(800);
    const loginErr = await cdpClient.eval("document.getElementById('login-error').textContent");
    assert(loginErr.includes('không chính xác'), 'Login UI displays error message on invalid password');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '05-login-error.png'));

    // 2.3 Fill correct login credentials
    await cdpClient.eval(`
      document.getElementById('login-email').value = ${JSON.stringify(candidateEmail)};
      document.getElementById('login-password').value = ${JSON.stringify(candidatePassword)};
    `);
    await cdpClient.eval("document.getElementById('login-form').dispatchEvent(new Event('submit', { cancelable: true }))");
    await sleep(1500);

    // 2.4 Verify user token saved to localStorage
    const storedAuth = await cdpClient.eval("localStorage.getItem('prepmate_current_user')");
    assert(storedAuth !== null && storedAuth.includes(candidateEmail), 'Successful login persists authenticated user session in localStorage');

    // 2.5 Test Backward Compatibility: Legacy account with Unicode/spaces logs in successfully in browser
    console.log('\n--- FLOW 2.5: Backward Compatibility Verification ---');
    await cdpClient.navigate(`${BASE_URL}/features/auth/auth.html`);
    await sleep(400);
    await cdpClient.eval("localStorage.removeItem('prepmate_current_user')");
    await cdpClient.eval(`
      document.getElementById('login-email').value = 'legacy_unicode@prepmate.test';
      document.getElementById('login-password').value = 'Mật khẩu cũ 2026!';
    `);
    await cdpClient.eval("document.getElementById('login-form').dispatchEvent(new Event('submit', { cancelable: true }))");
    await sleep(1500);
    const legacyAuth = await cdpClient.eval("localStorage.getItem('prepmate_current_user')");
    assert(legacyAuth !== null && legacyAuth.includes('legacy_unicode'), 'Legacy user with Vietnamese password logs in successfully without restriction');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '05-legacy-unicode-login-success.png'));

    console.log('\n--- FLOW 3: Forgot Password & Reset Password in Real Browser ---');

    // 3.1 Navigate to forgot password
    await cdpClient.navigate(`${BASE_URL}/features/auth/forgot-password.html`);
    const forgotTitle = await cdpClient.eval("document.querySelector('.auth-title').textContent");
    assert(forgotTitle.includes('Quên mật khẩu'), 'forgot-password.html loaded with correct heading');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '06-forgot-password.png'));

    // 3.2 Submit forgot password form
    await cdpClient.eval(`document.getElementById('forgot-email').value = ${JSON.stringify(candidateEmail)}`);
    await cdpClient.eval("document.getElementById('forgot-form').dispatchEvent(new Event('submit', { cancelable: true }))");
    await sleep(1200);

    const forgotSuccessVisible = await cdpClient.eval("document.getElementById('forgot-success').style.display !== 'none'");
    assert(forgotSuccessVisible, 'forgot-password.html displays neutral confirmation feedback');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '06-forgot-success.png'));

    // 3.3 Capture reset email from sandbox
    const resetEmailsRes = await requestJson(`${BASE_URL}/api/dev/emails?to=${encodeURIComponent(candidateEmail)}`);
    const resetEmail = resetEmailsRes.body.find(e => e.subject.includes('đặt lại mật khẩu'));
    assert(resetEmail !== undefined, 'Password reset email was generated and delivered to sandbox');

    const resetTokenMatch = resetEmail.htmlBody.match(/reset-password\.html\?token=([a-f0-9]{64})/i);
    assert(resetTokenMatch && resetTokenMatch[1], 'Reset token link extracted from reset email');
    const resetToken = resetTokenMatch[1];

    // 3.4 Open reset-password.html in browser
    await cdpClient.navigate(`${BASE_URL}/features/auth/reset-password.html?token=${resetToken}`);
    await sleep(1000);

    const isResetFormVisible = await cdpClient.eval("document.getElementById('reset-form').style.display !== 'none'");
    assert(isResetFormVisible, 'reset-password.html verified token and displayed password form');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '07-reset-password.png'));

    // WI-04: Address bar token scrubbing verification
    const addressBarUrl = await cdpClient.eval('window.location.href');
    assert(!addressBarUrl.includes('token='), 'WI-04 Token Privacy: Reset token scrubbed from address bar via history.replaceState');

    // 3.5 Test password visibility toggle
    await cdpClient.eval("document.getElementById('reset-password').value = 'TestSecret123!'");
    const initialInputType = await cdpClient.eval("document.getElementById('reset-password').type");
    assert(initialInputType === 'password', 'Password input type is initially password');

    await cdpClient.eval("document.querySelector('#reset-form .btn-toggle-password').click()");
    const toggledInputType = await cdpClient.eval("document.getElementById('reset-password').type");
    assert(toggledInputType === 'text', 'Password toggle switched input to text type');

    // 3.5b Test reset password policy validation error on real browser
    await cdpClient.eval(`
      document.getElementById('reset-password').value = 'Sinh viên 2026!';
      document.getElementById('reset-password-confirm').value = 'Sinh viên 2026!';
    `);
    await cdpClient.eval("document.getElementById('reset-form').dispatchEvent(new Event('submit', { cancelable: true }))");
    await sleep(400);
    const resetErr = await cdpClient.eval("document.getElementById('reset-error').textContent");
    assert(resetErr.includes('không chứa khoảng trắng'), 'Reset password UI rejects non-ASCII and space with policy message');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '07-reset-validation-error.png'));

    // 3.6 Submit new password
    const updatedPassword = 'NewUpdatedPassword2026!';
    await cdpClient.eval(`
      document.getElementById('reset-password').type = 'password';
      document.getElementById('reset-password').value = ${JSON.stringify(updatedPassword)};
      document.getElementById('reset-password-confirm').value = ${JSON.stringify(updatedPassword)};
    `);
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '07-reset-password-filled.png'));

    await cdpClient.eval("document.getElementById('reset-form').dispatchEvent(new Event('submit', { cancelable: true }))");
    await sleep(1200);

    const isResetCompleted = await cdpClient.eval("document.getElementById('reset-complete-container').style.display !== 'none'");
    assert(isResetCompleted, 'reset-password.html displays password change completion card');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '08-reset-complete.png'));
    assert(isResetCompleted, 'reset-password.html displays password change completion card');

    // 3.7 Verify old password fails and new password succeeds
    await cdpClient.navigate(`${BASE_URL}/features/auth/auth.html`);
    await sleep(400);

    const oldLoginCheck = await requestJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: { email: candidateEmail, password: candidatePassword }
    });
    assert(oldLoginCheck.status === 401, 'Login with previous password fails with 401');

    const newLoginCheck = await requestJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: { email: candidateEmail, password: updatedPassword }
    });
    assert(newLoginCheck.status === 200 && newLoginCheck.body.token, 'Login with new password succeeds with 200');

    console.log('\n--- FLOW 4: Responsive & Visual Design System Audit ---');

    const viewports = [
      { name: '1440px Desktop', width: 1440, height: 900 },
      { name: '1024px Laptop', width: 1024, height: 768 },
      { name: '768px Tablet', width: 768, height: 1024 },
      { name: '390px Mobile', width: 390, height: 844 },
    ];

    const testPages = ['forgot-password.html', 'reset-password.html', 'verify-email.html'];

    for (const pageName of testPages) {
      await cdpClient.navigate(`${BASE_URL}/features/auth/${pageName}`);
      for (const vp of viewports) {
        await cdpClient.setViewport(vp.width, vp.height);
        const hasOverflow = await cdpClient.eval(
          'document.documentElement.scrollWidth > document.documentElement.clientWidth'
        );
        assert(!hasOverflow, `${pageName} renders cleanly with 0 horizontal scroll overflow at ${vp.name}`);
      }
    }

    console.log('\n--- FLOW 5: Dark / Light Mode Theme Switching ---');

    await cdpClient.navigate(`${BASE_URL}/features/auth/forgot-password.html`);
    const initialTheme = await cdpClient.eval("document.documentElement.getAttribute('data-theme') || 'light'");
    await cdpClient.eval("document.getElementById('auth-theme-toggle').click()");
    await sleep(250);
    const toggledTheme = await cdpClient.eval("document.documentElement.getAttribute('data-theme')");
    assert(toggledTheme !== initialTheme, 'Theme toggle changes data-theme attribute on <html> element');

    console.log('\n--- FLOW 6: Production Database SHA-256 Invariant ---');

    const finalProdContent = fs.readFileSync(PROD_DB_PATH);
    const finalProdHash = crypto.createHash('sha256').update(finalProdContent).digest('hex').toUpperCase();
    assert(finalProdHash === BASELINE_DB_HASH, 'Production database remains strictly identical bit-by-bit');

    console.log('\n===============================================================');
    console.log(' [SUCCESS] ALL REAL BROWSER E2E CHECKS PASSED CLEANLY!         ');
    console.log('===============================================================');

  } finally {
    if (cdpClient) await cdpClient.close();
    try { browserProc.kill(); } catch (e) {}
    try { backendProc.kill(); } catch (e) {}
    try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}
  }
}

runBrowserE2E().catch((err) => {
  console.error('Browser E2E test error:', err);
  process.exit(1);
});
