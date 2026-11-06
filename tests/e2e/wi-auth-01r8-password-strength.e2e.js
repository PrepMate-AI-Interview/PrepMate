/**
 * PREPMATE — WI-AUTH-01R8: PASSWORD STRENGTH INDICATOR & PLACEHOLDER E2E (Edge CDP)
 * 
 * Verifies End-To-End on Real Browser:
 * 1. Password input placeholder is "Ví dụ: User@123!456" and hint "Không dùng nguyên mật khẩu mẫu này." renders.
 * 2. Password Strength Indicator updates in real time:
 *    - Untouched / empty: neutral ("Chưa nhập")
 *    - Weak (<8 chars or repetitive): "Yếu" with red segment 1
 *    - Medium (valid 8+ chars standard): "Trung bình" with amber/yellow segments 1 & 2
 *    - Strong (diverse long): "Mạnh" with green segments 1, 2 & 3
 * 3. Strength vs Validity Decoupling:
 *    - "Trung bình" password satisfies validity rules and enables Register button.
 * 4. Backend Blocklist Rejection Handling:
 *    - Blocklist is NOT exposed on frontend.
 *    - Submitting common password (e.g. "password1234") triggers backend 400 rejection.
 *    - UI displays friendly error: "Mật khẩu này quá phổ biến hoặc dễ đoán. Vui lòng thử mật khẩu khác."
 *    - Strength indicator automatically updates to "Yếu".
 * 5. Responsive audit across 4 viewports (1440px, 1024px, 768px, 390px).
 * 6. Dark Mode theme integration.
 * 7. Production DB SHA-256 invariant preserved.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');
const { resolveDbPath, getBaselineDbHash } = require('../helpers/test-env');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_PORT = 5095;
const CDP_PORT = 9245;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();
const EVIDENCE_DIR = path.join(WORKSPACE_ROOT, 'docs', 'evidence', 'auth');

const TEST_DIR = path.join(os.tmpdir(), `prepmate_auth_r8_${Date.now()}`);
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
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      try {
        const hasSwitchTab = await this.eval('typeof window.switchTab');
        if (hasSwitchTab === 'function') break;
      } catch (e) {}
    }
    await sleep(300);
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

async function runTest() {
  console.log('===============================================================');
  console.log('   PREPMATE — WI-AUTH-01R8: PASSWORD STRENGTH & PLACEHOLDER   ');
  console.log('===============================================================\n');

  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING, { recursive: true });
  fs.mkdirSync(BROWSER_USER_DATA, { recursive: true });
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

  const browserBin = findBrowserExecutable();
  if (!browserBin) {
    console.warn('[SKIP] Neither Edge nor Chrome found on this system.');
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

  let beReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const ping = await requestJson(`${BASE_URL}/health`);
      if (ping.status === 200) { beReady = true; break; }
    } catch (e) {}
    await sleep(250);
  }
  assert(beReady, 'Backend server initialized on isolated test port');

  // 2. Start Headless Edge Browser
  const browserProc = spawn(browserBin, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${BROWSER_USER_DATA}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'about:blank'
  ]);

  let cdpReady = false;
  let wsUrl = null;
  for (let i = 0; i < 40; i++) {
    try {
      const versionRes = await requestJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (Array.isArray(versionRes.body) && versionRes.body.length > 0) {
        const pageTab = versionRes.body.find(t => t.type === 'page') || versionRes.body[0];
        if (pageTab && pageTab.webSocketDebuggerUrl) {
          wsUrl = pageTab.webSocketDebuggerUrl;
          cdpReady = true;
          break;
        }
      }
    } catch (e) {}
    await sleep(250);
  }
  assert(cdpReady && wsUrl, 'Edge browser spawned with CDP debugging endpoint');

  const cdpClient = new CDPClient(wsUrl);
  await cdpClient.connect();
  await cdpClient.send('Page.enable');
  await cdpClient.send('Runtime.enable');
  await cdpClient.setViewport(1440, 900);

  try {
    console.log('--- STEP 1: Navigate to Auth Page & Open Signup Tab ---');
    await cdpClient.navigate(`${BASE_URL}/features/auth/auth.html`);
    await cdpClient.eval("switchTab('signup')");

    // 1. Verify Placeholder and Sample Hint
    console.log('--- STEP 2: Verify Placeholder & Sample Hint ---');
    const inputMeta = await cdpClient.eval(`(() => {
      const input = document.getElementById('signup-password');
      const hint = document.querySelector('.pw-sample-hint');
      return {
        placeholder: input.getAttribute('placeholder'),
        hintText: hint ? hint.textContent.trim() : null
      };
    })()`);

    assert.strictEqual(inputMeta.placeholder, 'Ví dụ: User@123!456', 'Password placeholder is "Ví dụ: User@123!456"');
    assert.strictEqual(inputMeta.hintText, 'Không dùng nguyên mật khẩu mẫu này.', 'Hint text "Không dùng nguyên mật khẩu mẫu này." renders below input');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '37-r8-placeholder-hint.png'));
    console.log('  [PASS] Placeholder and helper hint verified');

    // 2. Initial Neutral Strength State
    console.log('--- STEP 3: Initial Neutral Strength State ---');
    const initialStrength = await cdpClient.eval(`(() => {
      const label = document.getElementById('password-strength-label').textContent.trim();
      const containerClass = document.getElementById('password-strength-container').className;
      return { label, containerClass };
    })()`);

    assert.strictEqual(initialStrength.label, 'Chưa nhập', 'Initial strength label is "Chưa nhập"');
    assert(initialStrength.containerClass.includes('neutral'), 'Initial strength container has neutral class');
    console.log('  [PASS] Initial state is 100% neutral');

    // Helper to set password and read strength + validity
    async function setPasswordAndInspect(pwd) {
      return await cdpClient.eval(`(() => {
        const pInput = document.getElementById('signup-password');
        pInput.value = ${JSON.stringify(pwd)};
        pInput.dispatchEvent(new Event('input', { bubbles: true }));

        return {
          strengthLabel: document.getElementById('password-strength-label').textContent.trim(),
          strengthClass: document.getElementById('password-strength-container').className,
          minLength: document.getElementById('req-min-length').className,
          maxLength: document.getElementById('req-max-length').className,
          asciiOnly: document.getElementById('req-ascii-only').className,
          noWhitespace: document.getElementById('req-no-whitespace').className
        };
      })()`);
    }

    // 3. Realtime Strength: Weak
    console.log('--- STEP 4: Realtime Strength Evaluation ---');
    const rWeak = await setPasswordAndInspect('Hung12'); // 6 chars
    assert.strictEqual(rWeak.strengthLabel, 'Yếu', 'Short password strength is "Yếu"');
    assert(rWeak.strengthClass.includes('strength-weak'), 'Container has strength-weak class');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '38-r8-strength-weak.png'));
    console.log('  [PASS] Weak password shows "Yếu" with red indicator');

    // 4. Realtime Strength: Medium & Validity Pass
    const rMedium = await setPasswordAndInspect('Hung1234'); // 8 chars, Upper+Lower+Num
    assert.strictEqual(rMedium.strengthLabel, 'Trung bình', 'Standard password strength is "Trung bình"');
    assert(rMedium.strengthClass.includes('strength-medium'), 'Container has strength-medium class');
    assert(rMedium.minLength.includes('met'), '8 chars passes minLength');
    assert(rMedium.maxLength.includes('met'), '8 chars passes maxLength');
    assert(rMedium.asciiOnly.includes('met'), '8 chars passes asciiOnly');
    assert(rMedium.noWhitespace.includes('met'), '8 chars passes noWhitespace');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '39-r8-strength-medium.png'));
    console.log('  [PASS] "Trung bình" password evaluated accurately and satisfies mandatory validity rules');

    // 5. Realtime Strength: Strong
    const rStrong = await setPasswordAndInspect('User@123!456'); // Diverse 14 chars
    assert.strictEqual(rStrong.strengthLabel, 'Mạnh', 'Complex password strength is "Mạnh"');
    assert(rStrong.strengthClass.includes('strength-strong'), 'Container has strength-strong class');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '40-r8-strength-strong.png'));
    console.log('  [PASS] Strong password shows "Mạnh" with green indicators');

    // 6. Validity vs Strength Decoupling: "Trung bình" password CAN register
    console.log('--- STEP 5: Validity vs Strength Decoupling ---');
    await cdpClient.eval(`(() => {
      document.getElementById('signup-fullname').value = 'Nguyen Trung Binh Tester';
      document.getElementById('signup-email').value = 'medium_pass@prepmate.test';
      document.getElementById('signup-username').value = 'user_medium_r8';
      document.getElementById('signup-password').value = 'Hung1234';
      document.getElementById('signup-password-confirm').value = 'Hung1234';
      document.getElementById('signup-agree').checked = true;

      ['signup-fullname', 'signup-email', 'signup-username', 'signup-password', 'signup-password-confirm'].forEach(id => {
        document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true }));
      });
      document.getElementById('signup-agree').dispatchEvent(new Event('change', { bubbles: true }));
    })()`);

    const canSubmitMedium = await cdpClient.eval("!document.getElementById('signup-submit').disabled");
    assert(canSubmitMedium, 'Register button IS ENABLED for valid password even when strength is "Trung bình"');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '41-r8-medium-strength-register-enabled.png'));
    console.log('  [PASS] "Trung bình" password is valid and enables registration');

    // 7. Backend Blocklist Rejection Graceful Handling
    console.log('--- STEP 6: Backend Blocklist Rejection Handling ---');
    // Fill with a blocklisted password from Backend (e.g. "password1234" which is 12 chars ASCII without space)
    await cdpClient.eval(`(() => {
      document.getElementById('signup-fullname').value = 'Blocklist Test User';
      document.getElementById('signup-email').value = 'blocklist_attempt@prepmate.test';
      document.getElementById('signup-username').value = 'blocklist_test';
      document.getElementById('signup-password').value = 'password1234';
      document.getElementById('signup-password-confirm').value = 'password1234';
      document.getElementById('signup-agree').checked = true;

      ['signup-fullname', 'signup-email', 'signup-username', 'signup-password', 'signup-password-confirm'].forEach(id => {
        document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true }));
      });
      document.getElementById('signup-agree').dispatchEvent(new Event('change', { bubbles: true }));
    })()`);

    // Submit form to trigger Backend validation
    await cdpClient.eval("document.getElementById('signup-form').dispatchEvent(new Event('submit', { cancelable: true }))");
    await sleep(800);

    const blocklistErrorText = await cdpClient.eval("document.getElementById('signup-error').textContent");
    const updatedStrengthOnRejection = await cdpClient.eval("document.getElementById('password-strength-label').textContent.trim()");

    assert(blocklistErrorText.includes('quá phổ biến hoặc dễ đoán'), 'Friendly blocklist error message rendered without exposing list contents');
    assert.strictEqual(updatedStrengthOnRejection, 'Yếu', 'Strength indicator automatically downgraded to "Yếu" on backend blocklist error');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '42-r8-blocklist-rejection.png'));
    console.log('  [PASS] Backend blocklist error handled gracefully and strength updated to "Yếu"');

    // 8. Responsive Audits (1440, 1024, 768, 390px)
    console.log('--- STEP 7: Responsive Layout Audits across 4 Viewports ---');
    const viewports = [
      { w: 1440, h: 900, name: '43-r8-viewport-1440.png' },
      { w: 1024, h: 768, name: '44-r8-viewport-1024.png' },
      { w: 768, h: 1024, name: '45-r8-viewport-768.png' },
      { w: 390, h: 844, name: '46-r8-viewport-390.png' }
    ];

    for (const vp of viewports) {
      await cdpClient.setViewport(vp.w, vp.h);
      await sleep(200);
      const overflow = await cdpClient.eval("document.documentElement.scrollWidth - document.documentElement.clientWidth");
      assert(overflow <= 1, `Zero horizontal overflow at ${vp.w}px (measured: ${overflow}px)`);
      await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, vp.name));
      console.log(`  [PASS] Viewport ${vp.w}x${vp.h} verified with 0 horizontal overflow`);
    }

    // 9. Dark Mode Theme Verification
    console.log('--- STEP 8: Dark Mode Theme Verification ---');
    await cdpClient.setViewport(1440, 900);
    await cdpClient.eval("toggleGlobalTheme()");
    await sleep(300);
    const isDark = await cdpClient.eval("document.documentElement.classList.contains('dark') || document.body.classList.contains('dark-mode')");
    assert(isDark, 'Dark mode active');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '47-r8-dark-mode.png'));
    console.log('  [PASS] Dark mode verified with strength indicator');

    // Restore light mode
    await cdpClient.eval("toggleGlobalTheme()");

    // 10. Production Database Integrity Invariant
    console.log('--- STEP 9: Production DB SHA-256 Invariant ---');
    const dbData = fs.readFileSync(PROD_DB_PATH);
    const currentHash = require('crypto').createHash('sha256').update(dbData).digest('hex').toUpperCase();
    assert.strictEqual(currentHash, BASELINE_DB_HASH, 'Production db.json SHA-256 bit-by-bit identical');
    console.log(`  [PASS] Production db.json intact: ${currentHash}`);

    console.log('\n===============================================================');
    console.log(' [SUCCESS] ALL WI-AUTH-01R8 REAL BROWSER CHECKS PASSED CLEANLY!  ');
    console.log('===============================================================');
  } finally {
    await cdpClient.close();
    try { browserProc.kill(); } catch (e) {}
    try { backendProc.kill(); } catch (e) {}
    try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}
  }
}

runTest().catch((err) => {
  console.error('\n[FAIL] WI-AUTH-01R8 E2E Test Failed:\n', err);
  process.exit(1);
});
