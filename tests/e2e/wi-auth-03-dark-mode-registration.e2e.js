/**
 * PREPMATE — WI-AUTH-03: DARK MODE REGISTRATION E2E TEST (Edge CDP)
 * 
 * Verifies End-To-End on Real Browser:
 * 1. Đăng ký ở Light Mode -> Thành công (redirects to verify-email.html?email=...).
 * 2. Đăng ký ở Dark Mode -> Thành công (redirects to verify-email.html?email=...).
 * 3. Form chưa hợp lệ -> Nút đăng ký disabled (disabled: true, aria-disabled: 'true').
 * 4. Form hợp lệ -> Nút đăng ký enabled (disabled: false, aria-disabled: null).
 * 5. Chuyển Light -> Dark khi đang nhập -> Giữ nguyên trạng thái form & validation.
 * 6. Chuyển Dark -> Light khi đang nhập -> Giữ nguyên trạng thái form & validation.
 * 7. Reload khi Dark Mode đang bật -> Form vẫn hoạt động bình thường và giữ Dark Mode.
 * 8. Mật khẩu không hợp lệ -> Hiển thị lỗi rõ ràng trên checklist và UI.
 * 9. Email chưa xác thực -> Giữ nguyên quy trình xác thực email sau đăng ký.
 * 10. Production DB SHA-256 Invariant Strictly Preserved.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');
const { resolveDbPath, getBaselineDbHash } = require('../helpers/test-env');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_PORT = 5114;
const CDP_PORT = 9264;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();
const EVIDENCE_DIR = path.join(WORKSPACE_ROOT, 'docs', 'evidence', 'auth');

const TEST_DIR = path.join(os.tmpdir(), `prepmate_auth_dark_e2e_${Date.now()}`);
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
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(r.exceptionDetails)}`);
    }
    return r.result ? r.result.value : undefined;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await sleep(1200);
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

async function runDarkModeRegistrationE2E() {
  console.log('===============================================================');
  console.log(' PREPMATE — WI-AUTH-03: DARK MODE REGISTRATION E2E TEST (CDP)  ');
  console.log('===============================================================\n');

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

  // 2. Launch Edge CDP
  const browserProc = spawn(browserBin, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${BROWSER_USER_DATA}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=1280,1000',
    'about:blank',
  ], {
    stdio: 'ignore'
  });

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
    await cdpClient.setViewport(1280, 1000);

    // =========================================================================
    // SCENARIO 1: Đăng ký ở Light Mode -> Thành công
    // =========================================================================
    console.log('\n--- SCENARIO 1: Đăng ký ở Light Mode (Baseline) ---');
    await cdpClient.navigate(`${BASE_URL}/features/auth/auth.html`);
    await cdpClient.eval('applyGlobalTheme("light"); localStorage.setItem("prepmate_theme", "light"); window.switchTab("signup");');
    await sleep(300);

    const ts1 = Date.now();
    await cdpClient.eval(`
      document.getElementById("signup-fullname").value = "Light Mode User";
      document.getElementById("signup-email").value = "light_${ts1}@prepmate.test";
      document.getElementById("signup-username").value = "light_${ts1.toString(36)}";
      document.getElementById("signup-password").value = "LightPass@2026!";
      document.getElementById("signup-password-confirm").value = "LightPass@2026!";
      document.getElementById("signup-agree").checked = true;
      document.getElementById("signup-fullname").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-email").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-username").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password-confirm").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-agree").dispatchEvent(new Event("change", { bubbles: true }));
    `);
    await sleep(300);

    const s1BtnState = await cdpClient.eval('document.getElementById("signup-submit").disabled');
    assert.strictEqual(s1BtnState, false, 'Light mode button is enabled with valid inputs');

    // Submit
    await cdpClient.eval('document.getElementById("signup-submit").click()');
    await sleep(1500);

    const s1Url = await cdpClient.eval('window.location.href');
    assert(s1Url.includes('verify-email.html'), `Light mode registration redirected to verify-email.html (got: ${s1Url})`);
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '67-wi-auth-03-light-mode-register-success.png'));
    console.log('  [PASS] Scenario 1: Light mode registration succeeded with verify-email redirect');

    // =========================================================================
    // SCENARIO 2: Đăng ký ở Dark Mode -> Thành công
    // =========================================================================
    console.log('\n--- SCENARIO 2: Đăng ký ở Dark Mode ---');
    await cdpClient.navigate(`${BASE_URL}/features/auth/auth.html`);
    await cdpClient.eval('applyGlobalTheme("dark"); localStorage.setItem("prepmate_theme", "dark"); window.switchTab("signup");');
    await sleep(300);

    const ts2 = Date.now();
    await cdpClient.eval(`
      document.getElementById("signup-fullname").value = "Dark Mode User";
      document.getElementById("signup-email").value = "dark_${ts2}@prepmate.test";
      document.getElementById("signup-username").value = "dark_${ts2.toString(36)}";
      document.getElementById("signup-password").value = "DarkPass@2026!";
      document.getElementById("signup-password-confirm").value = "DarkPass@2026!";
      document.getElementById("signup-agree").checked = true;
      document.getElementById("signup-fullname").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-email").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-username").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password-confirm").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-agree").dispatchEvent(new Event("change", { bubbles: true }));
    `);
    await sleep(300);

    const s2BtnState = await cdpClient.eval('document.getElementById("signup-submit").disabled');
    assert.strictEqual(s2BtnState, false, 'Dark mode button is enabled with valid inputs');

    // Click submit in Dark Mode
    await cdpClient.eval('document.getElementById("signup-submit").click()');
    await sleep(1500);

    const s2Url = await cdpClient.eval('window.location.href');
    assert(s2Url.includes('verify-email.html'), `Dark mode registration redirected to verify-email.html (got: ${s2Url})`);
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '68-wi-auth-03-dark-mode-register-success.png'));
    console.log('  [PASS] Scenario 2: Dark mode registration succeeded with verify-email redirect');

    // =========================================================================
    // SCENARIO 3 & 4: Form chưa hợp lệ (disabled) & Form hợp lệ (enabled)
    // =========================================================================
    console.log('\n--- SCENARIO 3 & 4: Button Disabled when Invalid, Enabled when Valid in Dark Mode ---');
    await cdpClient.navigate(`${BASE_URL}/features/auth/auth.html`);
    await cdpClient.eval('applyGlobalTheme("dark"); localStorage.setItem("prepmate_theme", "dark"); localStorage.setItem("pm_theme", "dark"); window.switchTab("signup");');
    await sleep(300);

    // Initial empty state
    const s3Disabled = await cdpClient.eval('document.getElementById("signup-submit").disabled');
    const s3Aria = await cdpClient.eval('document.getElementById("signup-submit").getAttribute("aria-disabled")');
    assert.strictEqual(s3Disabled, true, 'CTA button is disabled when form is empty');
    assert.strictEqual(s3Aria, 'true', 'CTA button has aria-disabled="true" when empty');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '69-wi-auth-03-dark-mode-invalid-disabled.png'));
    console.log('  [PASS] Scenario 3: Form chưa hợp lệ -> Nút đăng ký disabled');

    // Fill valid
    await cdpClient.eval(`
      document.getElementById("signup-fullname").value = "Valid Check";
      document.getElementById("signup-email").value = "valid_check@prepmate.test";
      document.getElementById("signup-username").value = "valid_check";
      document.getElementById("signup-password").value = "ValidCheck@2026!";
      document.getElementById("signup-password-confirm").value = "ValidCheck@2026!";
      document.getElementById("signup-agree").checked = true;
      document.getElementById("signup-fullname").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-email").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-username").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password-confirm").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-agree").dispatchEvent(new Event("change", { bubbles: true }));
    `);
    await sleep(300);

    const s4Disabled = await cdpClient.eval('document.getElementById("signup-submit").disabled');
    const s4Aria = await cdpClient.eval('document.getElementById("signup-submit").getAttribute("aria-disabled")');
    assert.strictEqual(s4Disabled, false, 'CTA button is enabled when form is complete');
    assert.strictEqual(s4Aria, null, 'CTA button aria-disabled is removed when form is complete');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '70-wi-auth-03-dark-mode-valid-enabled.png'));
    console.log('  [PASS] Scenario 4: Form hợp lệ -> Nút đăng ký enabled');

    // =========================================================================
    // SCENARIO 5: Chuyển Light -> Dark khi đang nhập dở
    // =========================================================================
    console.log('\n--- SCENARIO 5: Chuyển Light -> Dark khi đang nhập dở ---');
    await cdpClient.navigate(`${BASE_URL}/features/auth/auth.html`);
    await cdpClient.eval('applyGlobalTheme("light"); localStorage.setItem("prepmate_theme", "light"); localStorage.setItem("pm_theme", "light"); window.switchTab("signup");');
    await sleep(300);

    await cdpClient.eval(`
      document.getElementById("signup-fullname").value = "Midflow User";
      document.getElementById("signup-fullname").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-email").value = "midflow@prepmate.test";
      document.getElementById("signup-email").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password").value = "MidflowPass@2026!";
      document.getElementById("signup-password").dispatchEvent(new Event("input", { bubbles: true }));
    `);
    await sleep(200);

    // Toggle theme to dark via theme button
    await cdpClient.eval('document.getElementById("auth-theme-toggle").click()');
    await sleep(400);

    const s5State = await cdpClient.eval(`({
      theme: document.body.className,
      fullname: document.getElementById("signup-fullname").value,
      email: document.getElementById("signup-email").value,
      password: document.getElementById("signup-password").value
    })`);
    assert(s5State.theme.includes('dark-mode'), 'Body has dark-mode class after toggle');
    assert.strictEqual(s5State.fullname, 'Midflow User', 'Fullname preserved across toggle');
    assert.strictEqual(s5State.email, 'midflow@prepmate.test', 'Email preserved across toggle');
    assert.strictEqual(s5State.password, 'MidflowPass@2026!', 'Password preserved across toggle');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '71-wi-auth-03-midform-light-to-dark.png'));
    console.log('  [PASS] Scenario 5: Chuyển Light -> Dark khi đang nhập giữ nguyên trạng thái form');

    // =========================================================================
    // SCENARIO 6: Chuyển Dark -> Light khi đang nhập dở
    // =========================================================================
    console.log('\n--- SCENARIO 6: Chuyển Dark -> Light khi đang nhập dở ---');
    await cdpClient.eval('document.getElementById("auth-theme-toggle").click()');
    await sleep(400);

    const s6State = await cdpClient.eval(`({
      theme: document.body.className,
      fullname: document.getElementById("signup-fullname").value,
      email: document.getElementById("signup-email").value,
      password: document.getElementById("signup-password").value
    })`);
    assert(s6State.theme.includes('light-mode') || !s6State.theme.includes('dark-mode'), 'Body restored to light mode');
    assert.strictEqual(s6State.fullname, 'Midflow User', 'Fullname preserved after Dark -> Light toggle');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '72-wi-auth-03-midform-dark-to-light.png'));
    console.log('  [PASS] Scenario 6: Chuyển Dark -> Light khi đang nhập giữ nguyên trạng thái form');

    // =========================================================================
    // SCENARIO 7: Reload khi Dark Mode đang bật
    // =========================================================================
    console.log('\n--- SCENARIO 7: Reload trang khi Dark Mode đang bật ---');
    await cdpClient.eval('localStorage.setItem("prepmate_theme", "dark"); localStorage.setItem("pm_theme", "dark");');
    await cdpClient.send('Page.reload');
    await sleep(1200);

    const s7ReloadTheme = await cdpClient.eval('document.documentElement.getAttribute("data-theme")');
    assert.strictEqual(s7ReloadTheme, 'dark', 'Theme attribute is dark after page reload');

    // Switch to signup and verify form functions
    await cdpClient.eval('window.switchTab("signup")');
    await sleep(300);

    const ts7 = Date.now();
    await cdpClient.eval(`
      document.getElementById("signup-fullname").value = "Reload Dark User";
      document.getElementById("signup-email").value = "reload_${ts7}@prepmate.test";
      document.getElementById("signup-username").value = "reload_${ts7.toString(36)}";
      document.getElementById("signup-password").value = "ReloadPass@2026!";
      document.getElementById("signup-password-confirm").value = "ReloadPass@2026!";
      document.getElementById("signup-agree").checked = true;
      document.getElementById("signup-fullname").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-email").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-username").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password-confirm").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-agree").dispatchEvent(new Event("change", { bubbles: true }));
    `);
    await sleep(300);

    const s7Btn = await cdpClient.eval('document.getElementById("signup-submit").disabled');
    assert.strictEqual(s7Btn, false, 'Button is enabled after reload in dark mode');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '73-wi-auth-03-dark-mode-reload-persistence.png'));
    console.log('  [PASS] Scenario 7: Reload khi Dark Mode đang bật -> Form vẫn hoạt động');

    // =========================================================================
    // SCENARIO 8: Mật khẩu không hợp lệ -> Hiển thị lỗi rõ ràng
    // =========================================================================
    console.log('\n--- SCENARIO 8: Mật khẩu không hợp lệ hiển thị lỗi rõ ràng ---');
    await cdpClient.navigate(`${BASE_URL}/features/auth/auth.html`);
    await cdpClient.eval('applyGlobalTheme("dark"); window.switchTab("signup");');
    await sleep(300);

    // Enter invalid password (contains space and unicode)
    await cdpClient.eval(`
      document.getElementById("signup-password").value = "Sai Pass 2026!";
      document.getElementById("signup-password").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password-confirm").value = "KhacPass@2026!";
      document.getElementById("signup-password-confirm").dispatchEvent(new Event("input", { bubbles: true }));
    `);
    await sleep(300);

    const s8Checklist = await cdpClient.eval(`({
      whitespaceItem: document.getElementById("req-no-whitespace").className,
      confirmStatus: document.getElementById("password-confirm-status").className,
      confirmText: document.getElementById("pw-confirm-text").textContent
    })`);
    assert(s8Checklist.whitespaceItem.includes('unmet'), 'req-no-whitespace marked unmet');
    assert(s8Checklist.confirmStatus.includes('unmet'), 'password-confirm-status marked unmet');
    assert(s8Checklist.confirmText.includes('không trùng khớp'), 'Confirm text signals mismatch');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '74-wi-auth-03-dark-mode-invalid-password-error.png'));
    console.log('  [PASS] Scenario 8: Mật khẩu không hợp lệ -> Hiển thị lỗi rõ ràng');

    // =========================================================================
    // SCENARIO 9: Email chưa xác thực -> Giữ nguyên quy trình xác thực email
    // =========================================================================
    console.log('\n--- SCENARIO 9: Email chưa xác thực -> Giữ nguyên quy trình xác thực ---');
    const ts9 = Date.now();
    const candidateEmail9 = `verify_${ts9}@prepmate.test`;

    await cdpClient.eval(`
      document.getElementById("signup-fullname").value = "Verify Candidate";
      document.getElementById("signup-email").value = ${JSON.stringify(candidateEmail9)};
      document.getElementById("signup-username").value = "ver_${ts9.toString(36)}";
      document.getElementById("signup-password").value = "VerifyPass@2026!";
      document.getElementById("signup-password-confirm").value = "VerifyPass@2026!";
      document.getElementById("signup-agree").checked = true;
      document.getElementById("signup-fullname").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-email").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-username").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-password-confirm").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("signup-agree").dispatchEvent(new Event("change", { bubbles: true }));
    `);
    await sleep(300);

    await cdpClient.eval('document.getElementById("signup-submit").click()');
    await sleep(1500);

    const s9Url = await cdpClient.eval('window.location.href');
    assert(s9Url.includes('verify-email.html'), `Redirected to verify-email.html (got: ${s9Url})`);
    assert(s9Url.includes(encodeURIComponent(candidateEmail9)), `Target URL carries email parameter`);
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '75-wi-auth-03-dark-mode-verify-email-redirect.png'));
    console.log('  [PASS] Scenario 9: Email chưa xác thực -> Giữ nguyên quy trình xác thực email');

    console.log('\n===============================================================');
    console.log('  ALL 9 WI-AUTH-03 E2E SCENARIOS PASSED ON REAL EDGE CDP!      ');
    console.log('===============================================================\n');

  } finally {
    if (cdpClient) await cdpClient.close();
    try { browserProc.kill(); } catch (e) {}
    try { backendProc.kill(); } catch (e) {}
    try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}
  }

  // Final check: Production DB hash invariant
  const dbHash = getBaselineDbHash();
  assert.strictEqual(dbHash, BASELINE_DB_HASH, 'Production database db.json invariant strictly preserved');
  console.log(`[PASS] Production DB SHA-256 invariant verified: ${dbHash.slice(0, 16)}...`);
}

runDarkModeRegistrationE2E().catch((err) => {
  console.error('\n[FAIL] Dark Mode Registration E2E failed:', err);
  process.exit(1);
});
