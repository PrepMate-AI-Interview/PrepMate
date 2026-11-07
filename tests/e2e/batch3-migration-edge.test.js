/**
 * PREPMATE — BATCH 3 ACCOUNT & IDENTITY E2E AUDIT (EDGE CDP)
 * Work Item: WI-GLOBAL-UI-STANDARDIZATION-01 (Phase 2 - Batch 3)
 * Tests: auth.html, forgot-password.html, reset-password.html, verify-email.html,
 *        profile.html, cv.html, settings.html
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');
const os = require('os');

const PORT = 5013;
const CDP_PORT = 9249;
const DB_PATH = path.resolve(__dirname, '../../BE/data/db.json');
const INITIAL_HASH = crypto.createHash('sha256').update(fs.readFileSync(DB_PATH)).digest('hex').toUpperCase();

console.log('======================================================================');
console.log('       PREPMATE — BATCH 3 ACCOUNT & IDENTITY E2E AUDIT (EDGE)         ');
console.log('======================================================================');
console.log(`[1] Production DB Hash: ${INITIAL_HASH}`);

function findEdgePath() {
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of edgePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const edgePath = findEdgePath();
assert.ok(edgePath, 'Microsoft Edge executable not found!');
console.log(`[2] Browser: ${edgePath}`);

class SimpleCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.ws = null;
    this.pending = new Map();
  }

  async connect() {
    const WS = globalThis.WebSocket;
    assert.ok(WS, 'globalThis.WebSocket must be available');

    return new Promise((resolve, reject) => {
      this.ws = new WS(this.wsUrl);
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', (err) => reject(err));
      this.ws.addEventListener('message', (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

async function httpPostJson(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runBatch3Audit() {
  const beDir = path.resolve(__dirname, '../../BE');
  const tempTestDb = path.join(os.tmpdir(), `prepmate_e2e_batch3_db_${Date.now()}.json`);
  fs.copyFileSync(DB_PATH, tempTestDb);

  console.log(`[3] Launching backend on port ${PORT}...`);
  const backendProc = spawn('dotnet', ['run', '--no-launch-profile', '--project', 'backend.csproj'], {
    cwd: beDir,
    env: {
      ...process.env,
      ASPNETCORE_URLS: `http://127.0.0.1:${PORT}`,
      DOTNET_URLS: `http://127.0.0.1:${PORT}`,
      DATABASE_FILE_PATH: tempTestDb,
      PREPMATE_DATABASE_PATH: tempTestDb,
      ASPNETCORE_ENVIRONMENT: 'Development'
    },
    stdio: 'ignore'
  });

  const cleanup = () => {
    try {
      if (process.platform === 'win32' && backendProc.pid) {
        require('child_process').execSync(`taskkill /pid ${backendProc.pid} /t /f`, { stdio: 'ignore' });
      } else {
        backendProc.kill('SIGKILL');
      }
    } catch (e) {}
    try { fs.unlinkSync(tempTestDb); } catch (e) {}
  };

  let backendReady = false;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    try {
      const res = await new Promise((resolve) => {
        http.get(`http://127.0.0.1:${PORT}/api/health`, (r) => resolve(r.statusCode)).on('error', () => resolve(0));
      });
      if (res === 200) { backendReady = true; break; }
    } catch (e) {}
  }

  if (!backendReady) {
    cleanup();
    throw new Error(`Backend failed to start on isolated port ${PORT}`);
  }
  console.log(`[+] Backend ready on http://127.0.0.1:${PORT}`);

  const edgeUserDataDir = path.resolve(__dirname, `../../.edge_dev_batch3_${Date.now()}`);
  console.log(`[4] Launching Edge CDP on port ${CDP_PORT}...`);
  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${edgeUserDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    'about:blank'
  ]);

  let cdp = null;
  const edgeCleanup = () => {
    try {
      if (process.platform === 'win32' && edgeProc.pid) {
        require('child_process').execSync(`taskkill /pid ${edgeProc.pid} /t /f`, { stdio: 'ignore' });
      } else {
        edgeProc.kill('SIGKILL');
      }
    } catch (e) {}
    try { fs.rmSync(edgeUserDataDir, { recursive: true, force: true }); } catch (e) {}
  };

  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        targets = await httpGetJson(`http://127.0.0.1:${CDP_PORT}/json`);
        if (Array.isArray(targets) && targets.length > 0) break;
      } catch (e) {}
    }

    assert.ok(targets && targets.length > 0, 'Could not query Edge CDP targets');
    const pageTarget = targets.find(p => p.type === 'page') || targets[0];
    console.log(`[+] Edge CDP Target connected: ${pageTarget.webSocketDebuggerUrl}`);

    cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');

    const viewports = [
      { name: 'Desktop Large (1440px)', width: 1440, height: 900 },
      { name: 'Desktop Small (1280px)', width: 1280, height: 800 },
      { name: 'Tablet (768px)', width: 768, height: 1024 },
      { name: 'Mobile Standard (390px)', width: 390, height: 844 },
      { name: 'Mobile Compact (375px)', width: 375, height: 667 },
    ];

    async function setViewport(vp) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 768,
      });
    }

    async function checkOverflow(pageName, vpName) {
      const overflow = await cdp.eval(`(() => {
        const docWidth = document.documentElement.offsetWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const diff = scrollWidth - docWidth;
        let offenders = [];
        if (diff > 1) {
          const all = document.querySelectorAll('*');
          for (const el of all) {
            const rect = el.getBoundingClientRect();
            if (rect.right > docWidth + 2) {
              offenders.push({
                tag: el.tagName,
                cls: el.className,
                id: el.id,
                right: rect.right,
                docWidth: docWidth
              });
            }
          }
        }
        return { diff, offenders: offenders.slice(0, 3) };
      })()`);

      if (overflow.diff > 2) {
        console.warn(`    ⚠️ [OVERFLOW] ${pageName} on ${vpName}: diff=${overflow.diff}px offenders:`, overflow.offenders);
      }
      assert.ok(overflow.diff <= 5, `Horizontal overflow detected on ${pageName} (${vpName}): ${overflow.diff}px`);
    }

    // Helper to inject authenticated user with valid JWT
    async function setupMockUser() {
      const loginRes = await httpPostJson(`http://127.0.0.1:${PORT}/api/auth/login`, {
        email: 'nam.le@gmail.com',
        password: 'user123'
      });
      assert.strictEqual(loginRes.status, 200, 'Candidate login failed');
      const realToken = loginRes.body.token;
      const realUser = loginRes.body.user || { id: 'user_001', fullname: 'Lê Hoàng Nam', role: 'candidate' };
      realUser.token = realToken;

      await cdp.eval(`(() => {
        const user = ${JSON.stringify(realUser)};
        localStorage.setItem('prepmate_user', JSON.stringify(user));
        localStorage.setItem('prepmate_current_user', JSON.stringify(user));
      })()`);
    }

    // =========================================================================
    // AUDIT 1: auth.html
    // =========================================================================
    console.log('\n--- AUDIT 1: FE/features/auth/auth.html ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/features/auth/auth.html` });
    await sleep(2000);

    const authAudit = await cdp.eval(`(() => {
      const h1 = document.querySelector('h1.pm-page-title');
      const header = document.querySelector('.pm-page-header');
      const subtitle = document.querySelector('.pm-page-subtitle');
      const loginTab = document.querySelector('[data-tab="login"]');
      const signupTab = document.querySelector('[data-tab="signup"]');
      const pwToggle = document.querySelector('.btn-toggle-password');
      return {
        hasPageHeader: !!header,
        hasPageTitle: !!h1,
        titleText: h1 ? h1.textContent.trim() : null,
        hasSubtitle: !!subtitle,
        hasTabs: !!(loginTab && signupTab),
        hasPwToggle: !!pwToggle
      };
    })()`);

    console.log('  [+] auth.html typography audit:', authAudit);
    assert.ok(authAudit.hasPageHeader, 'auth.html must have .pm-page-header');
    assert.ok(authAudit.hasPageTitle, 'auth.html must have h1.pm-page-title');
    assert.strictEqual(authAudit.titleText, 'Đăng nhập', 'Title must be Đăng nhập');
    assert.ok(authAudit.hasSubtitle, 'auth.html must have .pm-page-subtitle');

    // Tab switch check
    const switchedTab = await cdp.eval(`(() => {
      switchTab('signup');
      const signupActive = document.getElementById('signup-form').classList.contains('active');
      const title = document.getElementById('form-title').textContent.trim();
      return { signupActive, title };
    })()`);
    console.log('  [+] Tab switch interaction:', switchedTab);
    assert.ok(switchedTab.signupActive, 'Signup form must activate upon switchTab');

    for (const vp of viewports) {
      await setViewport(vp);
      await sleep(300);
      await checkOverflow('auth.html', vp.name);
    }
    console.log('  [PASS] 1. auth.html passed typography, interaction, and 5 viewport responsiveness tests');

    // =========================================================================
    // AUDIT 2: forgot-password.html
    // =========================================================================
    console.log('\n--- AUDIT 2: FE/features/auth/forgot-password.html ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/features/auth/forgot-password.html` });
    await sleep(2000);

    const forgotAudit = await cdp.eval(`(() => {
      const h1 = document.querySelector('h1.pm-page-title');
      const header = document.querySelector('.pm-page-header');
      const subtitle = document.querySelector('.pm-page-subtitle');
      const emailInput = document.getElementById('forgot-email');
      const submitBtn = document.getElementById('forgot-submit');
      return {
        hasPageHeader: !!header,
        hasPageTitle: !!h1,
        titleText: h1 ? h1.textContent.trim() : null,
        hasSubtitle: !!subtitle,
        hasEmailInput: !!emailInput,
        hasSubmitBtn: !!submitBtn
      };
    })()`);

    console.log('  [+] forgot-password.html typography audit:', forgotAudit);
    assert.ok(forgotAudit.hasPageHeader, 'forgot-password.html must have .pm-page-header');
    assert.ok(forgotAudit.hasPageTitle, 'forgot-password.html must have h1.pm-page-title');
    assert.strictEqual(forgotAudit.titleText, 'Quên mật khẩu?', 'Title must be Quên mật khẩu?');
    assert.ok(forgotAudit.hasSubtitle, 'forgot-password.html must have .pm-page-subtitle');

    for (const vp of viewports) {
      await setViewport(vp);
      await sleep(300);
      await checkOverflow('forgot-password.html', vp.name);
    }
    console.log('  [PASS] 2. forgot-password.html passed typography and 5 viewport responsiveness tests');

    // =========================================================================
    // AUDIT 3: reset-password.html
    // =========================================================================
    console.log('\n--- AUDIT 3: FE/features/auth/reset-password.html ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/features/auth/reset-password.html` });
    await sleep(2000);

    const resetAudit = await cdp.eval(`(() => {
      const h1 = document.querySelector('h1.pm-page-title');
      const header = document.querySelector('.pm-page-header');
      const subtitle = document.querySelector('.pm-page-subtitle');
      const loadingState = document.getElementById('token-loading');
      return {
        hasPageHeader: !!header,
        hasPageTitle: !!h1,
        titleText: h1 ? h1.textContent.trim() : null,
        hasSubtitle: !!subtitle,
        hasLoadingState: !!loadingState
      };
    })()`);

    console.log('  [+] reset-password.html typography audit:', resetAudit);
    assert.ok(resetAudit.hasPageHeader, 'reset-password.html must have .pm-page-header');
    assert.ok(resetAudit.hasPageTitle, 'reset-password.html must have h1.pm-page-title');
    assert.strictEqual(resetAudit.titleText, 'Đặt lại mật khẩu', 'Title must be Đặt lại mật khẩu');
    assert.ok(resetAudit.hasSubtitle, 'reset-password.html must have .pm-page-subtitle');

    for (const vp of viewports) {
      await setViewport(vp);
      await sleep(300);
      await checkOverflow('reset-password.html', vp.name);
    }
    console.log('  [PASS] 3. reset-password.html passed typography and 5 viewport responsiveness tests');

    // =========================================================================
    // AUDIT 4: verify-email.html
    // =========================================================================
    console.log('\n--- AUDIT 4: FE/features/auth/verify-email.html ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/features/auth/verify-email.html?email=candidate.e2e@example.com` });
    await sleep(2000);

    const verifyAudit = await cdp.eval(`(() => {
      const h1 = document.querySelector('h1.pm-page-title');
      const header = document.querySelector('.pm-page-header');
      const subtitle = document.querySelector('.pm-page-subtitle');
      const cardHeadings = Array.from(document.querySelectorAll('.pm-card-heading')).map(h => h.textContent.trim());
      const confirmBtn = document.getElementById('btn-confirm-verify');
      return {
        hasPageHeader: !!header,
        hasPageTitle: !!h1,
        titleText: h1 ? h1.textContent.trim() : null,
        hasSubtitle: !!subtitle,
        cardHeadings,
        hasConfirmBtn: !!confirmBtn
      };
    })()`);

    console.log('  [+] verify-email.html typography audit:', verifyAudit);
    assert.ok(verifyAudit.hasPageHeader, 'verify-email.html must have .pm-page-header');
    assert.ok(verifyAudit.hasPageTitle, 'verify-email.html must have h1.pm-page-title');
    assert.ok(['Kiểm tra Email', 'Xác thực Email', 'Xác minh không thành công'].includes(verifyAudit.titleText), 'Title must match email verification state');
    assert.ok(verifyAudit.hasSubtitle, 'verify-email.html must have .pm-page-subtitle');
    assert.ok(verifyAudit.cardHeadings.length >= 2, 'Must have at least 2 .pm-card-heading elements');

    for (const vp of viewports) {
      await setViewport(vp);
      await sleep(300);
      await checkOverflow('verify-email.html', vp.name);
    }
    console.log('  [PASS] 4. verify-email.html passed typography and 5 viewport responsiveness tests');

    // =========================================================================
    // AUDIT 5: profile.html (Authenticated)
    // =========================================================================
    console.log('\n--- AUDIT 5: FE/features/profile/profile.html ---');
    await setupMockUser();
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/features/profile/profile.html` });
    await sleep(2500);

    const profileAudit = await cdp.eval(`(() => {
      const h1 = document.querySelector('h1.pm-page-title');
      const header = document.querySelector('.pm-page-header');
      const subtitle = document.querySelector('.pm-page-subtitle');
      const secHeadings = Array.from(document.querySelectorAll('.pm-section-heading')).map(h => h.textContent.trim());
      const statValues = Array.from(document.querySelectorAll('.pm-stat-value')).map(s => s.textContent.trim());
      const statLabels = Array.from(document.querySelectorAll('.pm-stat-label')).map(s => s.textContent.trim());
      const fullnameInput = document.getElementById('fullname');
      const targetRoleInput = document.getElementById('target-role');
      return {
        hasPageHeader: !!header,
        hasPageTitle: !!h1,
        titleText: h1 ? h1.textContent.trim() : null,
        hasSubtitle: !!subtitle,
        secHeadings,
        statValuesCount: statValues.length,
        statLabelsCount: statLabels.length,
        hasInputs: !!(fullnameInput && targetRoleInput)
      };
    })()`);

    console.log('  [+] profile.html typography audit:', profileAudit);
    assert.ok(profileAudit.hasPageHeader, 'profile.html must have .pm-page-header');
    assert.ok(profileAudit.hasPageTitle, 'profile.html must have h1.pm-page-title');
    assert.strictEqual(profileAudit.titleText, 'Hồ sơ năng lực cá nhân', 'Title must match');
    assert.ok(profileAudit.hasSubtitle, 'profile.html must have .pm-page-subtitle');
    assert.ok(profileAudit.secHeadings.length >= 1, 'Must have .pm-section-heading');
    assert.ok(profileAudit.statValuesCount >= 2, 'Must have .pm-stat-value elements');
    assert.ok(profileAudit.statLabelsCount >= 2, 'Must have .pm-stat-label elements');

    for (const vp of viewports) {
      await setViewport(vp);
      await sleep(300);
      await checkOverflow('profile.html', vp.name);
    }
    console.log('  [PASS] 5. profile.html passed typography and 5 viewport responsiveness tests');

    // =========================================================================
    // AUDIT 6: cv.html (Authenticated)
    // =========================================================================
    console.log('\n--- AUDIT 6: FE/features/profile/cv.html ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/features/profile/cv.html` });
    await sleep(2000);

    const cvAudit = await cdp.eval(`(() => {
      const h1 = document.querySelector('h1.pm-page-title');
      const header = document.querySelector('.pm-page-header');
      const subtitle = document.querySelector('.pm-page-subtitle');
      const cardHeadings = Array.from(document.querySelectorAll('.pm-card-heading')).map(h => h.textContent.trim());
      const statValues = Array.from(document.querySelectorAll('.pm-stat-value')).map(s => s.textContent.trim());
      const statLabels = Array.from(document.querySelectorAll('.pm-stat-label')).map(s => s.textContent.trim());
      const dropzone = document.getElementById('cv-upload-drop');
      const practiceBtn = document.getElementById('btn-practice-cv');
      return {
        hasPageHeader: !!header,
        hasPageTitle: !!h1,
        titleText: h1 ? h1.textContent.trim() : null,
        hasSubtitle: !!subtitle,
        cardHeadingsCount: cardHeadings.length,
        statValuesCount: statValues.length,
        statLabelsCount: statLabels.length,
        hasDropzone: !!dropzone,
        hasPracticeBtn: !!practiceBtn
      };
    })()`);

    console.log('  [+] cv.html typography audit:', cvAudit);
    assert.ok(cvAudit.hasPageHeader, 'cv.html must have .pm-page-header');
    assert.ok(cvAudit.hasPageTitle, 'cv.html must have h1.pm-page-title');
    assert.strictEqual(cvAudit.titleText, 'CV của tôi & Hồ sơ năng lực', 'Title must match');
    assert.ok(cvAudit.hasSubtitle, 'cv.html must have .pm-page-subtitle');
    assert.ok(cvAudit.cardHeadingsCount >= 3, 'Must have at least 3 .pm-card-heading elements');
    assert.ok(cvAudit.statValuesCount >= 2, 'Must have at least 2 .pm-stat-value elements');
    assert.ok(cvAudit.statLabelsCount >= 2, 'Must have at least 2 .pm-stat-label elements');
    assert.ok(cvAudit.hasDropzone, 'cv.html must have #cv-upload-drop');
    assert.ok(cvAudit.hasPracticeBtn, 'cv.html must have #btn-practice-cv');

    for (const vp of viewports) {
      await setViewport(vp);
      await sleep(300);
      await checkOverflow('cv.html', vp.name);
    }
    console.log('  [PASS] 6. cv.html passed typography and 5 viewport responsiveness tests');

    // =========================================================================
    // AUDIT 7: settings.html (Authenticated & Theme Switch)
    // =========================================================================
    console.log('\n--- AUDIT 7: FE/features/profile/settings.html ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/features/profile/settings.html` });
    await sleep(2000);

    const settingsAudit = await cdp.eval(`(() => {
      const h1 = document.querySelector('h1.pm-page-title');
      const header = document.querySelector('.pm-page-header');
      const subtitle = document.querySelector('.pm-page-subtitle');
      const cardHeadings = Array.from(document.querySelectorAll('.pm-card-heading')).map(h => h.textContent.trim());
      const statValues = Array.from(document.querySelectorAll('.pm-stat-value')).map(s => s.textContent.trim());
      const statLabels = Array.from(document.querySelectorAll('.pm-stat-label')).map(s => s.textContent.trim());
      const switches = document.querySelectorAll('[role="switch"]');
      const themeBtnDark = document.getElementById('theme-btn-dark');
      const themeBtnLight = document.getElementById('theme-btn-light');
      return {
        hasPageHeader: !!header,
        hasPageTitle: !!h1,
        titleText: h1 ? h1.textContent.trim() : null,
        hasSubtitle: !!subtitle,
        cardHeadingsCount: cardHeadings.length,
        statValuesCount: statValues.length,
        statLabelsCount: statLabels.length,
        switchCount: switches.length,
        hasThemeButtons: !!(themeBtnDark && themeBtnLight)
      };
    })()`);

    console.log('  [+] settings.html typography audit:', settingsAudit);
    assert.ok(settingsAudit.hasPageHeader, 'settings.html must have .pm-page-header');
    assert.ok(settingsAudit.hasPageTitle, 'settings.html must have h1.pm-page-title');
    assert.strictEqual(settingsAudit.titleText, 'Cài đặt cá nhân & Trải nghiệm', 'Title must match');
    assert.ok(settingsAudit.hasSubtitle, 'settings.html must have .pm-page-subtitle');
    assert.ok(settingsAudit.cardHeadingsCount >= 4, 'Must have at least 4 .pm-card-heading elements');
    assert.ok(settingsAudit.statValuesCount >= 2, 'Must have at least 2 .pm-stat-value elements');
    assert.ok(settingsAudit.statLabelsCount >= 2, 'Must have at least 2 .pm-stat-label elements');
    assert.ok(settingsAudit.switchCount >= 4, 'Must have at least 4 role="switch" elements');

    // Test Theme Switch interaction
    const themeSwitchResult = await cdp.eval(`(() => {
      setThemePreference('dark', false);
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark-mode');
      const statText = document.getElementById('current-theme-stat').textContent.trim();
      return { isDark, statText };
    })()`);
    console.log('  [+] Theme switch interaction (Dark Mode):', themeSwitchResult);
    assert.ok(themeSwitchResult.isDark, 'Theme mode must switch to dark');
    assert.strictEqual(themeSwitchResult.statText, 'Tối', 'Stat text must update to Tối');

    // Switch back to light mode
    await cdp.eval(`(() => { setThemePreference('light', false); })()`);

    for (const vp of viewports) {
      await setViewport(vp);
      await sleep(300);
      await checkOverflow('settings.html', vp.name);
    }
    console.log('  [PASS] 7. settings.html passed typography, WCAG switch, theme toggle, and 5 viewport responsiveness tests');

    // =========================================================================
    // AUDIT 8: Database Integrity Verification
    // =========================================================================
    console.log('\n--- AUDIT 8: Database Invariant Verification ---');
    const finalHash = crypto.createHash('sha256').update(fs.readFileSync(DB_PATH)).digest('hex').toUpperCase();
    console.log(`  Initial Hash: ${INITIAL_HASH}`);
    console.log(`  Final Hash:   ${finalHash}`);
    assert.strictEqual(finalHash, INITIAL_HASH, 'BE/data/db.json was modified during testing!');
    console.log('  [PASS] 8. Production database SHA-256 invariant verified unmodified');

    console.log('\n======================================================================');
    console.log('   🎉 ALL BATCH 3 (7 PAGES) TESTS AND AUDITS PASSED WITH 0 ERRORS!     ');
    console.log('======================================================================\n');
  } finally {
    if (cdp) await cdp.close();
    edgeCleanup();
    cleanup();
  }
}

runBatch3Audit().catch((err) => {
  console.error('\n❌ BATCH 3 AUDIT FAILED:', err);
  process.exit(1);
});
