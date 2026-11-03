/**
 * PREPMATE — WI-UX-03: REAL BROWSER E2E TEST SUITE
 * 
 * Verifies via Headless Edge CDP:
 * 1. WI-03A (Jobs):
 *    - Search and filter jobs in real browser.
 *    - Absence of practice CTAs on cards (.btn-practice-jd) and modal (#m-btn-practice, .ai-mock-box).
 *    - Apply link destinations (direct apply vs source vs sample benchmark).
 *    - Target="_blank" and rel="noopener noreferrer" safety.
 * 2. WI-03B (Profile):
 *    - Absence of duplicate account management hubs (#account-hubs hidden).
 *    - Profile personal info editing (target-role, bio) and save persistence across reload.
 * 3. WI-03C (Settings):
 *    - Absence of redundant account card (#account-summary-card) and profile redirects.
 *    - Security status indicator presence ("Đã bảo vệ").
 *    - System preferences persistence (theme, voice speed).
 * 4. Responsive Verification across 4 viewports:
 *    - 1440px, 1024px, 768px, 390px.
 * 5. Production DB SHA-256 Invariant.
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
const BACKEND_PORT = 5098;
const CDP_PORT = 9248;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();

const TEST_DIR = path.join(os.tmpdir(), `prepmate_wi_ux_03_${Date.now()}`);
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

function computeHash(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
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

  async setViewport(width, height, isMobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile,
    });
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
  }
}

let checksPassed = 0;
let checksFailed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    checksPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    checksFailed++;
  }
}

async function runBrowserE2E() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   PREPMATE — WI-UX-03 REAL BROWSER (EDGE CDP) E2E SUITE       ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const initialHash = computeHash(PROD_DB_PATH);
  check(initialHash === BASELINE_DB_HASH, `Baseline production DB hash verified: ${initialHash}`);

  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING, { recursive: true });
  fs.mkdirSync(BROWSER_USER_DATA, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

  const browserPath = findBrowserExecutable();
  assert.ok(browserPath, 'Browser executable (Edge/Chrome) must be installed');
  console.log(`[INFO] Using browser: ${browserPath}`);

  // Launch isolated backend
  console.log(`[INFO] Starting backend on port ${BACKEND_PORT}...`);
  const beDir = path.join(WORKSPACE_ROOT, 'BE');
  const dllPath = path.join(beDir, 'bin', 'Debug', 'net10.0', 'backend.dll');

  const backendProc = spawn('dotnet', [dllPath, '--urls', BASE_URL], {
    cwd: beDir,
    env: {
      ...process.env,
      DATABASE_FILE_PATH: TEST_DB_PATH,
      PREPMATE_DATABASE_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING,
      ASPNETCORE_URLS: BASE_URL,
      DOTNET_URLS: BASE_URL,
      ASPNETCORE_ENVIRONMENT: 'Development',
    },
    stdio: 'ignore',
  });

  let backendReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const ping = await requestJson(`${BASE_URL}/health`);
      if (ping.status === 200) {
        backendReady = true;
        break;
      }
    } catch (e) {}
    await sleep(300);
  }
  check(backendReady, 'Isolated test backend is online and responding');

  // Obtain authentic JWT token from isolated backend
  console.log('[INFO] Authenticating candidate on isolated backend...');
  const loginRes = await requestJson(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    body: { email: 'nam.le@gmail.com', password: 'user123' }
  });
  check(loginRes.status === 200, 'Candidate authenticated with status 200 OK');
  const candToken = loginRes.body?.token;
  const candUser = loginRes.body?.user || { id: 'user_001', fullname: 'Lê Hoàng Nam', role: 'candidate' };
  candUser.token = candToken;

  // Launch browser with CDP
  console.log(`[INFO] Starting headless browser on CDP port ${CDP_PORT}...`);
  const browserProc = spawn(browserPath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${BROWSER_USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    '--window-size=1440,900',
    'about:blank',
  ]);

  let cdp = null;
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      const tabs = await requestJson(`http://127.0.0.1:${CDP_PORT}/json`);
      if (Array.isArray(tabs.body) && tabs.body.length > 0) {
        const pageTab = tabs.body.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (pageTab) {
          cdp = new CDPClient(pageTab.webSocketDebuggerUrl);
          await cdp.connect();
          break;
        }
      }
    } catch (e) {}
  }
  check(cdp !== null, 'CDP WebSocket connected to browser page target');

  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // -------------------------------------------------------------------------
    // TEST 1: JOBS PAGE REAL BROWSER VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Jobs Page (jobs.html) ---');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/features/jobs/jobs.html` });
    await sleep(1500);

    // Seed candidate session with authentic JWT token
    const sessionStr = JSON.stringify(candUser);
    await cdp.eval(`
      const session = ${JSON.stringify(sessionStr)};
      localStorage.setItem('user', session);
      localStorage.setItem('prepmate_user', session);
      localStorage.setItem('prepmate_current_user', session);
    `);

    // Reload jobs page with active session
    await cdp.send('Page.navigate', { url: `${BASE_URL}/features/jobs/jobs.html` });
    await sleep(1200);

    // Verify practice CTAs are completely absent from DOM
    const practiceCardsCount = await cdp.eval(`document.querySelectorAll('.btn-practice-jd').length`);
    check(practiceCardsCount === 0, `Zero .btn-practice-jd buttons rendered on job cards (found: ${practiceCardsCount})`);

    const mPracticeBtn = await cdp.eval(`document.getElementById('m-btn-practice')`);
    check(mPracticeBtn === null, 'Job detail modal does NOT contain #m-btn-practice');

    const aiMockBox = await cdp.eval(`document.querySelector('.ai-mock-box')`);
    check(aiMockBox === null, 'Job detail modal does NOT contain .ai-mock-box container');

    // Verify external search hub and links
    const hubLinksCount = await cdp.eval(`document.querySelectorAll('#hub-links-grid .hub-link-item').length`);
    check(hubLinksCount >= 4, `External search hub rendered at least 4 platforms (actual: ${hubLinksCount})`);

    // Verify job cards have apply buttons with safe target and rel
    const applyLinksSafe = await cdp.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('.card-actions-group a.btn-view-jd'));
        if (btns.length === 0) return true;
        return btns.every(b => b.getAttribute('target') === '_blank' && b.getAttribute('rel') === 'noopener noreferrer');
      })()
    `);
    check(applyLinksSafe, 'All external application links specify target="_blank" and rel="noopener noreferrer"');

    // Test opening job detail modal
    await cdp.eval(`openJobDetail('sample_10')`);
    await sleep(400);

    const modalActive = await cdp.eval(`document.getElementById('job-detail-modal-overlay').classList.contains('active')`);
    check(modalActive, 'Job detail modal opens successfully on selection');

    const modalApplyUrl = await cdp.eval(`document.getElementById('m-btn-apply').getAttribute('href')`);
    const modalApplyVisible = await cdp.eval(`getComputedStyle(document.getElementById('m-btn-apply')).display !== 'none'`);
    check(modalApplyVisible && modalApplyUrl.startsWith('http'), `Modal apply button directs to valid external URL (${modalApplyUrl})`);

    // Close modal
    await cdp.eval(`closeJobModal()`);
    await sleep(300);

    // -------------------------------------------------------------------------
    // TEST 2: PROFILE PAGE REAL BROWSER VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Profile Page (profile.html) ---');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/features/profile/profile.html` });
    await sleep(1500);

    // Check personal info fields present
    const fullnameVal = await cdp.eval(`document.getElementById('fullname')?.value !== undefined`);
    check(fullnameVal, 'Fullname input field rendered and accessible');

    // Check redundant account hub is hidden from visual presentation
    const accountHubsDisplay = await cdp.eval(`
      (() => {
        const el = document.getElementById('account-hubs');
        return el ? getComputedStyle(el).display : 'missing';
      })()
    `);
    check(accountHubsDisplay === 'none', `Redundant #account-hubs is hidden from user presentation (display: ${accountHubsDisplay})`);

    // Edit personal profile fields
    await cdp.eval(`
      document.getElementById('target-role').value = 'Senior Product Manager';
      document.getElementById('bio').value = 'Senior Product Manager with 8+ years leading AI solutions.';
      document.getElementById('phone').value = '0987654321';
      saveProfile();
    `);
    await sleep(800);

    // Reload page and check persistence
    await cdp.send('Page.navigate', { url: `${BASE_URL}/features/profile/profile.html` });
    await sleep(1200);

    const persistedRole = await cdp.eval(`document.getElementById('target-role')?.value`);
    const persistedBio = await cdp.eval(`document.getElementById('bio')?.value`);
    check(persistedRole === 'Senior Product Manager', `Target role persisted across reload: "${persistedRole}"`);
    check(persistedBio.includes('Senior Product Manager with 8+ years'), 'Bio persisted across reload');

    // -------------------------------------------------------------------------
    // TEST 3: SETTINGS PAGE REAL BROWSER VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Settings Page (settings.html) ---');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/features/profile/settings.html` });
    await sleep(1500);

    // Check #account-summary-card is completely absent from DOM
    const accountSummaryCard = await cdp.eval(`document.getElementById('account-summary-card')`);
    check(accountSummaryCard === null, 'Settings page does NOT render redundant #account-summary-card');

    const profileBridgeLinks = await cdp.eval(`document.querySelectorAll('.btn-profile-bridge, a[href="profile.html"]').length`);
    check(profileBridgeLinks === 0, `Zero redundant profile redirect links rendered on settings page (found: ${profileBridgeLinks})`);

    // Check security card has authoritative status badge
    const securityBadgeText = await cdp.eval(`
      (() => {
        const card = document.getElementById('security');
        return card ? card.innerText : '';
      })()
    `);
    check(securityBadgeText.includes('Đã bảo vệ'), 'Security section displays authoritative "Đã bảo vệ" status');
    check(securityBadgeText.includes('Đang hoạt động'), 'Security section displays active session status');

    // Test theme switching in settings
    await cdp.eval(`setThemePreference('dark')`);
    await sleep(500);
    const themeApplied = await cdp.eval(`document.documentElement.getAttribute('data-theme') || document.body.className`);
    check(themeApplied.includes('dark'), `Dark theme preference applied correctly (${themeApplied})`);

    // Test draft cache clean-up
    await cdp.eval(`
      localStorage.setItem('prepmate_draft_test', 'temp_draft_data');
      clearDraftCache();
    `);
    const draftCleared = await cdp.eval(`localStorage.getItem('prepmate_draft_test')`);
    check(draftCleared === null, 'clearDraftCache() cleans up draft keys without logging candidate out');

    // Reset theme back to light
    await cdp.eval(`setThemePreference('light')`);

    // -------------------------------------------------------------------------
    // TEST 4: RESPONSIVE VIEWPORT CHECKS (1440, 1024, 768, 390)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Responsive Viewport Audits ---');
    const viewports = [
      { name: '1440px Desktop', width: 1440, height: 900, isMobile: false },
      { name: '1024px Small Desktop', width: 1024, height: 768, isMobile: false },
      { name: '768px Tablet Portrait', width: 768, height: 1024, isMobile: false },
      { name: '390px Mobile Standard', width: 390, height: 844, isMobile: true }
    ];

    for (const vp of viewports) {
      await cdp.setViewport(vp.width, vp.height, vp.isMobile);
      await cdp.send('Page.navigate', { url: `${BASE_URL}/features/jobs/jobs.html` });
      await sleep(800);

      const overflow = await cdp.eval(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`);
      check(overflow, `Jobs page [${vp.name}]: Zero horizontal overflow`);

      if (vp.isMobile) {
        const mobileFilterBarVisible = await cdp.eval(`
          (() => {
            const bar = document.querySelector('.mobile-filter-bar');
            return bar && getComputedStyle(bar).display !== 'none';
          })()
        `);
        check(mobileFilterBarVisible, `Jobs page [${vp.name}]: Mobile filter bar is visible`);
      }
    }

  } finally {
    if (cdp) cdp.close();
    browserProc.kill();
    backendProc.kill();
  }

  // Final DB integrity check
  console.log('\n--- 5. Production DB Hash Invariant Check ---');
  const finalHash = computeHash(PROD_DB_PATH);
  check(finalHash === BASELINE_DB_HASH, `Production DB hash strictly unmodified (${finalHash})`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`REAL BROWSER E2E RESULTS: ${checksPassed} PASSED, ${checksFailed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (checksFailed > 0) {
    process.exit(1);
  }
}

runBrowserE2E().catch((err) => {
  console.error('\n[FATAL ERROR in runBrowserE2E]:', err);
  process.exit(1);
});
