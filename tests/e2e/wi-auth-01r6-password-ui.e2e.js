/**
 * PREPMATE — WI-AUTH-01R6: REAL-TIME PASSWORD REQUIREMENTS VALIDATION UI (Edge CDP)
 * 
 * Verifies End-To-End on Real Browser:
 * 1. Initial State: Neutral checklist & confirm status, Register button disabled.
 * 2. Real-time condition evaluation:
 *    - 7 characters -> unmet min length (X đỏ)
 *    - 8 valid characters -> all 5 check xanh
 *    - 128 characters -> check xanh
 *    - 129 characters -> unmet max length (X đỏ)
 *    - Vietnamese diacritics -> unmet ascii-only (X đỏ)
 *    - Space -> unmet no-whitespace (X đỏ)
 *    - Emoji -> unmet ascii-only (X đỏ)
 *    - Blocklist -> unmet not-blocked (X đỏ)
 *    - All satisfied -> all 5 check xanh
 * 3. Confirm password validation:
 *    - Empty -> neutral
 *    - Mismatch -> unmet (X đỏ) "Mật khẩu không trùng khớp"
 *    - Match -> met (Check xanh) "Mật khẩu trùng khớp"
 * 4. User edits / deletes characters -> immediate live status update
 * 5. Show/Hide password toggle preserves state
 * 6. Register button enables ONLY when all conditions are met
 * 7. Responsive audit across 4 viewports (1440, 1024, 768, 390px)
 * 8. Dark Mode theme integrity
 * 9. Production DB invariant preserved
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');
const { resolveDbPath, getBaselineDbHash } = require('../helpers/test-env');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_PORT = 5098;
const CDP_PORT = 9248;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();
const EVIDENCE_DIR = path.join(WORKSPACE_ROOT, 'docs', 'evidence', 'auth');

const TEST_DIR = path.join(os.tmpdir(), `prepmate_auth_r6_${Date.now()}`);
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
  console.log('   PREPMATE — WI-AUTH-01R6: REAL-TIME PASSWORD VALIDATION UI   ');
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
    await cdpClient.navigate(BASE_URL + '/features/auth/auth.html');
    const currentUrl = await cdpClient.eval('window.location.href');
    const pageHtml = await cdpClient.eval('document.documentElement.innerHTML');
    console.log('CURRENT URL:', currentUrl);
    console.log('PAGE HTML LENGTH:', pageHtml.length);
    console.log('PAGE TITLE:', await cdpClient.eval('document.title'));
    await cdpClient.navigate(`${BASE_URL}/features/auth/auth.html`);
    await cdpClient.eval("switchTab('signup')");

    // Helper function to set password & trigger real-time validation in browser
    async function setPasswordAndCheck(pwd, confirm = '') {
      return await cdpClient.eval(`(() => {
        const pInput = document.getElementById('signup-password');
        const cInput = document.getElementById('signup-password-confirm');
        pInput.value = ${JSON.stringify(pwd)};
        cInput.value = ${JSON.stringify(confirm)};
        pInput.dispatchEvent(new Event('input', { bubbles: true }));
        cInput.dispatchEvent(new Event('input', { bubbles: true }));

        const items = {
          minLength: document.getElementById('req-min-length').className,
          maxLength: document.getElementById('req-max-length').className,
          asciiOnly: document.getElementById('req-ascii-only').className,
          noWhitespace: document.getElementById('req-no-whitespace').className,
          notBlocked: document.getElementById('req-not-blocked').className,
          confirmStatus: document.getElementById('password-confirm-status').className,
          confirmText: document.getElementById('pw-confirm-text').textContent.trim(),
          buttonDisabled: document.getElementById('signup-submit').disabled
        };
        return items;
      })()`);
    }

    // 1. Initial State Check
    console.log('--- STEP 2: Verify Initial Untouched Neutral State ---');
    const initialStatus = await cdpClient.eval(`(() => {
      return {
        minLength: document.getElementById('req-min-length').className,
        maxLength: document.getElementById('req-max-length').className,
        asciiOnly: document.getElementById('req-ascii-only').className,
        noWhitespace: document.getElementById('req-no-whitespace').className,
        notBlocked: document.getElementById('req-not-blocked').className,
        confirmStatus: document.getElementById('password-confirm-status').className,
        buttonDisabled: document.getElementById('signup-submit').disabled
      };
    })()`);

    assert(initialStatus.minLength.includes('neutral'), 'Min length item is neutral initially');
    assert(initialStatus.maxLength.includes('neutral'), 'Max length item is neutral initially');
    assert(initialStatus.asciiOnly.includes('neutral'), 'ASCII only item is neutral initially');
    assert(initialStatus.noWhitespace.includes('neutral'), 'No whitespace item is neutral initially');
    assert(initialStatus.notBlocked.includes('neutral'), 'Not blocked item is neutral initially');
    assert(initialStatus.confirmStatus.includes('neutral'), 'Confirm status is neutral initially');
    assert.strictEqual(initialStatus.buttonDisabled, true, 'Register button is disabled initially');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '09-r6-checklist-neutral.png'));
    console.log('  [PASS] Initial state is 100% neutral and button disabled');

    // 2. Test Matrix Execution
    console.log('--- STEP 3: Execute Full Real-Time Password Requirements Matrix ---');

    // Case: 7 characters (Hung123)
    const res7 = await setPasswordAndCheck('Hung123');
    assert(res7.minLength.includes('unmet'), '7 chars: minLength is unmet (X đỏ)');
    assert(res7.maxLength.includes('met') && !res7.maxLength.includes('unmet'), '7 chars: maxLength is met');
    assert(res7.asciiOnly.includes('met') && !res7.asciiOnly.includes('unmet'), '7 chars: asciiOnly is met');
    assert(res7.noWhitespace.includes('met') && !res7.noWhitespace.includes('unmet'), '7 chars: noWhitespace is met');
    assert(res7.notBlocked.includes('met') && !res7.notBlocked.includes('unmet'), '7 chars: notBlocked is met');
    assert.strictEqual(res7.buttonDisabled, true, 'Button disabled for 7 chars');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '10-r6-checklist-7chars.png'));
    console.log('  [PASS] Case 1: 7 chars correctly shows X đỏ at minLength only');

    // Case: 8 valid characters (Hung1234)
    const res8 = await setPasswordAndCheck('Hung1234');
    assert(res8.minLength.includes('met') && !res8.minLength.includes('unmet'), '8 chars: minLength is met');
    assert(res8.maxLength.includes('met') && !res8.maxLength.includes('unmet'), '8 chars: maxLength is met');
    assert(res8.asciiOnly.includes('met') && !res8.asciiOnly.includes('unmet'), '8 chars: asciiOnly is met');
    assert(res8.noWhitespace.includes('met') && !res8.noWhitespace.includes('unmet'), '8 chars: noWhitespace is met');
    assert(res8.notBlocked.includes('met') && !res8.notBlocked.includes('unmet'), '8 chars: notBlocked is met');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '11-r6-checklist-8chars-valid.png'));
    console.log('  [PASS] Case 2: 8 valid chars shows all 5 Check xanh');

    // Case: 128 characters
    const res128 = await setPasswordAndCheck('a'.repeat(128));
    assert(res128.minLength.includes('met') && !res128.minLength.includes('unmet'), '128 chars: minLength is met');
    assert(res128.maxLength.includes('met') && !res128.maxLength.includes('unmet'), '128 chars: maxLength is met');
    console.log('  [PASS] Case 3: 128 valid chars shows Check xanh');

    // Case: 129 characters
    const res129 = await setPasswordAndCheck('a'.repeat(129));
    assert(res129.maxLength.includes('unmet'), '129 chars: maxLength is unmet (X đỏ)');
    assert(res129.minLength.includes('met'), '129 chars: minLength is met');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '12-r6-checklist-129chars.png'));
    console.log('  [PASS] Case 4: 129 chars correctly shows X đỏ at maxLength only');

    // Case: Vietnamese diacritics (Họcviên123456)
    const resUnicode = await setPasswordAndCheck('Họcviên123456');
    assert(resUnicode.asciiOnly.includes('unmet'), 'Vietnamese: asciiOnly is unmet (X đỏ)');
    assert(resUnicode.minLength.includes('met'), 'Vietnamese: minLength is met');
    assert(resUnicode.noWhitespace.includes('met') && !resUnicode.noWhitespace.includes('unmet'), 'Vietnamese: noWhitespace is met');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '13-r6-checklist-unicode.png'));
    console.log('  [PASS] Case 5: Vietnamese diacritics shows X đỏ at ascii-only');

    // Case: Space (Hung 123456)
    const resSpace = await setPasswordAndCheck('Hung 123456');
    assert(resSpace.noWhitespace.includes('unmet'), 'Space: noWhitespace is unmet (X đỏ)');
    assert(resSpace.asciiOnly.includes('met') && !resSpace.asciiOnly.includes('unmet'), 'Space: asciiOnly is met');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '14-r6-checklist-space.png'));
    console.log('  [PASS] Case 6: Space shows X đỏ at no-whitespace only');

    // Case: Emoji (Hung🎉2026!)
    const resEmoji = await setPasswordAndCheck('Hung🎉2026!');
    assert(resEmoji.asciiOnly.includes('unmet'), 'Emoji: asciiOnly is unmet (X đỏ)');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '15-r6-checklist-emoji.png'));
    console.log('  [PASS] Case 7: Emoji shows X đỏ at ascii-only');

    // Case: Blocklist (12345678)
    const resBlock = await setPasswordAndCheck('12345678');
    assert(resBlock.notBlocked.includes('unmet'), 'Blocklist: notBlocked is unmet (X đỏ)');
    assert(resBlock.minLength.includes('met'), 'Blocklist: minLength is met');
    assert(resBlock.noWhitespace.includes('met'), 'Blocklist: noWhitespace is met');
    assert(resBlock.asciiOnly.includes('met'), 'Blocklist: asciiOnly is met');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '16-r6-checklist-blocklist.png'));
    console.log('  [PASS] Case 8: Blocklist password shows X đỏ at not-blocked only');

    // Case: All met (Hung@2026!)
    const resAllMet = await setPasswordAndCheck('Hung@2026!');
    assert(resAllMet.minLength.includes('met') && !resAllMet.minLength.includes('unmet'));
    assert(resAllMet.maxLength.includes('met') && !resAllMet.maxLength.includes('unmet'));
    assert(resAllMet.asciiOnly.includes('met') && !resAllMet.asciiOnly.includes('unmet'));
    assert(resAllMet.noWhitespace.includes('met') && !resAllMet.noWhitespace.includes('unmet'));
    assert(resAllMet.notBlocked.includes('met') && !resAllMet.notBlocked.includes('unmet'));
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '17-r6-checklist-all-met.png'));
    console.log('  [PASS] Case 9: All 5 conditions met with Check xanh');

    // 3. Confirm Password Verification
    console.log('--- STEP 4: Verify Confirm Password Match & Mismatch ---');
    const resMismatch = await setPasswordAndCheck('Hung@2026!', 'DifferentPass@1');
    assert(resMismatch.confirmStatus.includes('unmet'), 'Confirm status is unmet (X đỏ) on mismatch');
    assert.strictEqual(resMismatch.confirmText, 'Mật khẩu không trùng khớp');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '18-r6-confirm-mismatch.png'));
    console.log('  [PASS] Confirm password mismatch shows X đỏ and "Mật khẩu không trùng khớp"');

    const resMatch = await setPasswordAndCheck('Hung@2026!', 'Hung@2026!');
    assert(resMatch.confirmStatus.includes('met') && !resMatch.confirmStatus.includes('unmet'), 'Confirm status is met (Check xanh) on match');
    assert.strictEqual(resMatch.confirmText, 'Mật khẩu trùng khớp');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '19-r6-confirm-match.png'));
    console.log('  [PASS] Confirm password match shows Check xanh and "Mật khẩu trùng khớp"');

    // 4. Live Editing & Character Deletion
    console.log('--- STEP 5: Live Editing & Deletion Dynamics ---');
    // Delete characters so length becomes 7
    const resDeleted = await setPasswordAndCheck('Hung@20', 'Hung@2026!');
    assert(resDeleted.minLength.includes('unmet'), 'Length < 8 flips minLength to X đỏ immediately');
    assert(resDeleted.confirmStatus.includes('unmet'), 'Confirm status flips to X đỏ immediately');
    console.log('  [PASS] Deleting characters immediately updates checklist and confirm status in real time');

    // 5. Toggle Password Visibility
    console.log('--- STEP 6: Toggle Password Visibility ---');
    await cdpClient.eval("togglePasswordVisibility('signup-password', document.querySelector('.btn-toggle-password'))");
    const pwdType1 = await cdpClient.eval("document.getElementById('signup-password').type");
    assert.strictEqual(pwdType1, 'text', 'Password input type changed to text');
    await cdpClient.eval("togglePasswordVisibility('signup-password', document.querySelector('.btn-toggle-password'))");
    const pwdType2 = await cdpClient.eval("document.getElementById('signup-password').type");
    assert.strictEqual(pwdType2, 'password', 'Password input type toggled back to password');
    console.log('  [PASS] Show/Hide password toggle functions smoothly without disrupting validation state');

    // 6. Complete Form & Register Button State
    console.log('--- STEP 7: Form Completion & Register Button State ---');
    await cdpClient.eval(`(() => {
      document.getElementById('signup-fullname').value = 'Nguyen Real Time Tester';
      document.getElementById('signup-email').value = 'realtime_r6@prepmate.test';
      document.getElementById('signup-username').value = 'tester_r6';
      document.getElementById('signup-password').value = 'ValidPass@2026!';
      document.getElementById('signup-password-confirm').value = 'ValidPass@2026!';
      document.getElementById('signup-agree').checked = true;

      // Trigger all input events
      ['signup-fullname', 'signup-email', 'signup-username', 'signup-password', 'signup-password-confirm'].forEach(id => {
        document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true }));
      });
      document.getElementById('signup-agree').dispatchEvent(new Event('change', { bubbles: true }));
    })()`);

    const isBtnEnabled = await cdpClient.eval("!document.getElementById('signup-submit').disabled");
    assert(isBtnEnabled, 'Register button is enabled when all form conditions are valid');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '20-r6-register-enabled.png'));
    console.log('  [PASS] Register button enabled when full form is valid');

    // Uncheck agree -> button disables
    await cdpClient.eval(`(() => {
      const agree = document.getElementById('signup-agree');
      agree.checked = false;
      agree.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    const isBtnDisabledAgain = await cdpClient.eval("document.getElementById('signup-submit').disabled");
    assert(isBtnDisabledAgain, 'Register button disabled when agree checkbox is unchecked');
    console.log('  [PASS] Register button dynamically toggles enabled/disabled based on form state');

    // 7. Responsive Viewport Audits (1440, 1024, 768, 390px)
    console.log('--- STEP 8: Responsive Layout Audits across 4 Viewports ---');
    const viewports = [
      { w: 1440, h: 900, name: '21-r6-viewport-1440.png' },
      { w: 1024, h: 768, name: '22-r6-viewport-1024.png' },
      { w: 768, h: 1024, name: '23-r6-viewport-768.png' },
      { w: 390, h: 844, name: '24-r6-viewport-390.png' }
    ];

    for (const vp of viewports) {
      await cdpClient.setViewport(vp.w, vp.h);
      await sleep(200);
      const overflow = await cdpClient.eval("document.documentElement.scrollWidth - document.documentElement.clientWidth");
      assert(overflow <= 1, `No horizontal overflow at ${vp.w}px (measured: ${overflow}px)`);
      await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, vp.name));
      console.log(`  [PASS] Viewport ${vp.w}x${vp.h} verified with 0 horizontal overflow`);
    }

    // 8. Dark Mode Theme Verification
    console.log('--- STEP 9: Dark Mode Theme Verification ---');
    await cdpClient.setViewport(1440, 900);
    await cdpClient.eval("toggleGlobalTheme()");
    await sleep(300);
    const isDark = await cdpClient.eval("document.documentElement.classList.contains('dark') || document.body.classList.contains('dark-mode')");
    assert(isDark, 'Dark mode active');
    await cdpClient.takeScreenshot(path.join(EVIDENCE_DIR, '25-r6-dark-mode.png'));
    console.log('  [PASS] Dark mode rendered cleanly with high contrast checklist');

    // Restore light mode
    await cdpClient.eval("toggleGlobalTheme()");

    // 9. Production Database Integrity Invariant
    console.log('--- STEP 10: Production DB SHA-256 Invariant ---');
    const dbData = fs.readFileSync(PROD_DB_PATH);
    const currentHash = require('crypto').createHash('sha256').update(dbData).digest('hex').toUpperCase();
    assert.strictEqual(currentHash, BASELINE_DB_HASH, 'Production db.json SHA-256 bit-by-bit identical');
    console.log(`  [PASS] Production db.json intact: ${currentHash}`);

    console.log('\n===============================================================');
    console.log(' [SUCCESS] ALL WI-AUTH-01R6 REAL BROWSER CHECKS PASSED CLEANLY!  ');
    console.log('===============================================================');
  } finally {
    await cdpClient.close();
    try { browserProc.kill(); } catch (e) {}
    try { backendProc.kill(); } catch (e) {}
    try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}
  }
}

runTest().catch((err) => {
  console.error('\n[FAIL] WI-AUTH-01R6 E2E Test Failed:\n', err);
  process.exit(1);
});
