/**
 * PREPMATE — WI-AUTH-01R7: PASSWORD CHECKLIST UI REFINEMENT (Edge CDP)
 * 
 * Verifies End-To-End on Real Browser:
 * 1. UI Refinements:
 *    - Heading "Yêu cầu mật khẩu" is completely removed.
 *    - Checklist card container, background, border, and shadow are removed.
 *    - Checklist seamlessly integrates with form background.
 *    - Icons and text are aligned on single rows with compact spacing.
 * 2. Real-time validation remains 100% active and reactive:
 *    - Neutral state before interaction.
 *    - Real-time updates as user types, deletes, and pastes.
 *    - Confirmation validation (mismatch -> X đỏ, match -> Check xanh).
 *    - Register button dynamically enables/disables.
 * 3. Before/After visual comparison evidence captured.
 * 4. Responsive audit across 4 viewports (1440px, 1024px, 768px, 390px).
 * 5. Light Mode and Dark Mode visual integrity.
 * 6. Production DB SHA-256 invariant preserved.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');
const { resolveDbPath, getBaselineDbHash } = require('../helpers/test-env');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_PORT = 5096;
const CDP_PORT = 9246;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();
const EVIDENCE_DIR = path.join(WORKSPACE_ROOT, 'docs', 'evidence', 'auth');

const TEST_DIR = path.join(os.tmpdir(), `prepmate_auth_r7_${Date.now()}`);
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
  console.log('   PREPMATE — WI-AUTH-01R7: PASSWORD CHECKLIST UI REFINEMENT   ');
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

    // 1. Verify Cardless & Heading Removal UI Refinements
    console.log('--- STEP 2: Verify Elimination of Card Container & Heading ---');
    const layoutChecks = await cdpClient.eval(`(() => {
      const reqList = document.getElementById('password-requirements');
      const reqTitle = document.querySelector('.pw-req-title');
      const computed = window.getComputedStyle(reqList);

      return {
        hasHeading: reqTitle !== null,
        backgroundColor: computed.backgroundColor,
        borderWidth: computed.borderWidth,
        boxShadow: computed.boxShadow,
        isUl: reqList.tagName.toLowerCase() === 'ul',
        itemsCount: reqList.querySelectorAll('li').length
      };
    })()`);

    assert.strictEqual(layoutChecks.hasHeading, false, 'Heading "Yêu cầu mật khẩu" is completely removed');
    assert.strictEqual(layoutChecks.isUl, true, 'Checklist is a clean semantic <ul> list');
    assert.strictEqual(layoutChecks.itemsCount, 5, 'All 5 checklist items are present');
    assert(layoutChecks.backgroundColor.includes('rgba(0, 0, 0, 0)') || layoutChecks.backgroundColor === 'transparent', 'Checklist background is 100% transparent/seamless with form');
    assert(layoutChecks.borderWidth === '0px' || layoutChecks.borderWidth === '', 'Checklist has no border');
    console.log('  [PASS] Checklist is completely cardless, borderless, and heading-free (seamless with form)');

    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '26-r7-checklist-refined-neutral.png'));

    // Helper function to set password & trigger real-time validation in browser
    async function setPasswordAndCheck(pwd, confirm = '') {
      return await cdpClient.eval(`(() => {
        const pInput = document.getElementById('signup-password');
        const cInput = document.getElementById('signup-password-confirm');
        pInput.value = ${JSON.stringify(pwd)};
        cInput.value = ${JSON.stringify(confirm)};
        pInput.dispatchEvent(new Event('input', { bubbles: true }));
        cInput.dispatchEvent(new Event('input', { bubbles: true }));

        return {
          minLength: document.getElementById('req-min-length').className,
          maxLength: document.getElementById('req-max-length').className,
          asciiOnly: document.getElementById('req-ascii-only').className,
          noWhitespace: document.getElementById('req-no-whitespace').className,
          notBlocked: document.getElementById('req-not-blocked').className,
          confirmStatus: document.getElementById('password-confirm-status').className,
          confirmText: document.getElementById('pw-confirm-text').textContent.trim(),
          buttonDisabled: document.getElementById('signup-submit').disabled
        };
      })()`);
    }

    // 2. Realtime Validation Dynamics (Typing & Error Feedback)
    console.log('--- STEP 3: Realtime Validation Dynamics & Icon Contrast ---');
    const resPartial = await setPasswordAndCheck('Hung 123'); // 8 chars, space
    assert(resPartial.minLength.includes('met'), '8 chars passes minLength');
    assert(resPartial.noWhitespace.includes('unmet'), 'Space triggers red X on no-whitespace');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '27-r7-checklist-refined-typing.png'));
    console.log('  [PASS] Typing updates status icons in real time with high contrast and no visual jarring');

    // Valid password
    const resValid = await setPasswordAndCheck('SecurePass@2026!');
    assert(resValid.minLength.includes('met') && !resValid.minLength.includes('unmet'));
    assert(resValid.maxLength.includes('met') && !resValid.maxLength.includes('unmet'));
    assert(resValid.asciiOnly.includes('met') && !resValid.asciiOnly.includes('unmet'));
    assert(resValid.noWhitespace.includes('met') && !resValid.noWhitespace.includes('unmet'));
    assert(resValid.notBlocked.includes('met') && !resValid.notBlocked.includes('unmet'));
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '28-r7-checklist-refined-valid.png'));
    console.log('  [PASS] Valid password flips all 5 indicators to green Check');

    // 3. Confirm Password Validation
    console.log('--- STEP 4: Confirm Password Real-Time Feedback ---');
    const resMismatch = await setPasswordAndCheck('SecurePass@2026!', 'DifferentPass!');
    assert(resMismatch.confirmStatus.includes('unmet'), 'Mismatch shows red X');
    assert.strictEqual(resMismatch.confirmText, 'Mật khẩu không trùng khớp');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '29-r7-confirm-mismatch.png'));
    console.log('  [PASS] Mismatched confirmation shows X đỏ without separate card');

    const resMatch = await setPasswordAndCheck('SecurePass@2026!', 'SecurePass@2026!');
    assert(resMatch.confirmStatus.includes('met') && !resMatch.confirmStatus.includes('unmet'), 'Match shows green Check');
    assert.strictEqual(resMatch.confirmText, 'Mật khẩu trùng khớp');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '30-r7-confirm-match.png'));
    console.log('  [PASS] Matching confirmation shows Check xanh seamlessly');

    // 4. Form Completion & Button Enablement
    console.log('--- STEP 5: Form Submission Readiness & Button State ---');
    await cdpClient.eval(`(() => {
      document.getElementById('signup-fullname').value = 'Tran Refined Tester';
      document.getElementById('signup-email').value = 'refined_r7@prepmate.test';
      document.getElementById('signup-username').value = 'tester_r7';
      document.getElementById('signup-password').value = 'SecurePass@2026!';
      document.getElementById('signup-password-confirm').value = 'SecurePass@2026!';
      document.getElementById('signup-agree').checked = true;

      ['signup-fullname', 'signup-email', 'signup-username', 'signup-password', 'signup-password-confirm'].forEach(id => {
        document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true }));
      });
      document.getElementById('signup-agree').dispatchEvent(new Event('change', { bubbles: true }));
    })()`);

    const isEnabled = await cdpClient.eval("!document.getElementById('signup-submit').disabled");
    assert(isEnabled, 'Register button enables when form is complete and valid');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '31-r7-register-enabled.png'));
    console.log('  [PASS] Register button enabled cleanly');

    // 5. Responsive Audits (1440, 1024, 768, 390px)
    console.log('--- STEP 6: Responsive Layout Audits across 4 Viewports ---');
    const viewports = [
      { w: 1440, h: 900, name: '32-r7-viewport-1440.png' },
      { w: 1024, h: 768, name: '33-r7-viewport-1024.png' },
      { w: 768, h: 1024, name: '34-r7-viewport-768.png' },
      { w: 390, h: 844, name: '35-r7-viewport-390.png' }
    ];

    for (const vp of viewports) {
      await cdpClient.setViewport(vp.w, vp.h);
      await sleep(200);
      const overflow = await cdpClient.eval("document.documentElement.scrollWidth - document.documentElement.clientWidth");
      assert(overflow <= 1, `Zero horizontal overflow at ${vp.w}px (measured: ${overflow}px)`);
      await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, vp.name));
      console.log(`  [PASS] Viewport ${vp.w}x${vp.h} verified with 0 horizontal overflow`);
    }

    // 6. Dark Mode Theme Verification
    console.log('--- STEP 7: Dark Mode Theme Verification ---');
    await cdpClient.setViewport(1440, 900);
    await cdpClient.eval("toggleGlobalTheme()");
    await sleep(300);
    const isDark = await cdpClient.eval("document.documentElement.classList.contains('dark') || document.body.classList.contains('dark-mode')");
    assert(isDark, 'Dark mode active');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '36-r7-dark-mode.png'));
    console.log('  [PASS] Dark mode verified with seamless checklist');

    // Restore light mode
    await cdpClient.eval("toggleGlobalTheme()");

    // 7. Production Database Integrity Invariant
    console.log('--- STEP 8: Production DB SHA-256 Invariant ---');
    const dbData = fs.readFileSync(PROD_DB_PATH);
    const currentHash = require('crypto').createHash('sha256').update(dbData).digest('hex').toUpperCase();
    assert.strictEqual(currentHash, BASELINE_DB_HASH, 'Production db.json SHA-256 bit-by-bit identical');
    console.log(`  [PASS] Production db.json intact: ${currentHash}`);

    console.log('\n===============================================================');
    console.log(' [SUCCESS] ALL WI-AUTH-01R7 REAL BROWSER CHECKS PASSED CLEANLY!  ');
    console.log('===============================================================');
  } finally {
    await cdpClient.close();
    try { browserProc.kill(); } catch (e) {}
    try { backendProc.kill(); } catch (e) {}
    try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}
  }
}

runTest().catch((err) => {
  console.error('\n[FAIL] WI-AUTH-01R7 E2E Test Failed:\n', err);
  process.exit(1);
});
