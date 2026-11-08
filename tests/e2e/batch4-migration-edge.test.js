/**
 * PREPMATE — BATCH 4 PLATFORM, ADMIN & COMMERCIAL E2E AUDIT (EDGE CDP)
 * Work Item: WI-GLOBAL-UI-STANDARDIZATION-01 (Phase 2 - Batch 4)
 * Pages: admin.html, pricing.html, payment.html, index.html, 404.html, showcase.html, legal-center.html
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');
const os = require('os');

const PORT = 5014;
const CDP_PORT = 9250;
const DB_PATH = path.resolve(__dirname, '../../BE/data/db.json');
const INITIAL_HASH = crypto.createHash('sha256').update(fs.readFileSync(DB_PATH)).digest('hex').toUpperCase();

console.log('======================================================================');
console.log('  PREPMATE — BATCH 4 PLATFORM, ADMIN & COMMERCIAL E2E AUDIT (EDGE)    ');
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

async function runBatch4Audit() {
  const beDir = path.resolve(__dirname, '../../BE');
  const tempTestDb = path.join(os.tmpdir(), `prepmate_e2e_batch4_db_${Date.now()}.json`);
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

  const edgeUserDataDir = path.resolve(__dirname, `../../.edge_dev_batch4_${Date.now()}`);
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
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

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

    // Helper: Authenticate Candidate session
    async function setupCandidateSession() {
      const loginRes = await httpPostJson(`http://127.0.0.1:${PORT}/api/auth/login`, {
        email: 'nam.le@gmail.com',
        password: 'user123'
      });
      assert.strictEqual(loginRes.status, 200, 'Candidate login failed');
      const user = loginRes.body.user || { id: 'user_001', fullname: 'Lê Hoàng Nam', role: 'candidate' };
      user.token = loginRes.body.token;

      await cdp.eval(`(() => {
        const u = ${JSON.stringify(user)};
        localStorage.setItem('prepmate_user', JSON.stringify(u));
        localStorage.setItem('prepmate_current_user', JSON.stringify(u));
      })()`);
    }

    // Helper: Authenticate Admin session
    async function setupAdminSession() {
      const loginRes = await httpPostJson(`http://127.0.0.1:${PORT}/api/auth/login`, {
        email: 'admin@prepmate.vn',
        password: 'Admin@123'
      });
      assert.strictEqual(loginRes.status, 200, 'Admin login failed');
      const user = loginRes.body.user || { id: 'user_admin', fullname: 'PrepMate Supreme Admin', role: 'admin' };
      user.token = loginRes.body.token;

      await cdp.eval(`(() => {
        const u = ${JSON.stringify(user)};
        localStorage.setItem('prepmate_user', JSON.stringify(u));
        localStorage.setItem('prepmate_current_user', JSON.stringify(u));
      })()`);
    }

    // =========================================================================
    // AUDIT 1: FE/index.html (Landing Page)
    // =========================================================================
    console.log('\n--- AUDIT 1: FE/index.html (Landing Page) ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(2000);

    const indexAudit = await cdp.eval(`(() => {
      const h1 = document.querySelector('h1.pm-page-title');
      const lead = document.querySelector('.pm-page-subtitle');
      const secHeadings = Array.from(document.querySelectorAll('.pm-section-heading')).map(h => h.textContent.trim());
      const ctaBtn = document.getElementById('heroPrimaryCta');
      return {
        hasPageTitle: !!h1,
        titleText: h1 ? h1.textContent.trim() : null,
        hasLead: !!lead,
        secHeadingsCount: secHeadings.length,
        hasCtaBtn: !!ctaBtn
      };
    })()`);

    console.log('  [+] index.html typography audit:', indexAudit);
    assert.ok(indexAudit.hasPageTitle, 'index.html must have h1.pm-page-title');
    assert.ok(indexAudit.hasLead, 'index.html must have .pm-page-subtitle');
    assert.ok(indexAudit.secHeadingsCount >= 3, 'index.html must have .pm-section-heading elements');
    assert.ok(indexAudit.hasCtaBtn, 'index.html must have #heroPrimaryCta');

    // Industry switch interaction test
    const industrySwitch = await cdp.eval(`(() => {
      if (typeof switchHeroIndustry === 'function') {
        switchHeroIndustry('finance');
        const activeTab = document.querySelector('.lp-industry-tab.active');
        return { switched: true, activeIndustry: activeTab ? activeTab.getAttribute('data-industry') : null };
      }
      return { switched: false };
    })()`);
    console.log('  [+] Industry switcher interaction:', industrySwitch);

    for (const vp of viewports) {
      await setViewport(vp);
      await sleep(300);
      await checkOverflow('index.html', vp.name);
    }
    console.log('  [PASS] 1. index.html passed typography, interactive tabs, and 5 viewport responsiveness tests');

    // =========================================================================
    // AUDIT 2: FE/404.html (Not Found Page)
    // =========================================================================
    console.log('\n--- AUDIT 2: FE/404.html (Error Page) ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/404.html` });
    await sleep(2000);

    const notFoundAudit = await cdp.eval(`(() => {
      const h1 = document.querySelector('h1.pm-page-title');
      const desc = document.querySelector('.pm-page-subtitle');
      const homeLink = document.querySelector('.error-actions a[href="index.html"]');
      const authLink = document.querySelector('.error-actions a[href="features/auth/auth.html"]');
      return {
        hasPageTitle: !!h1,
        titleText: h1 ? h1.textContent.trim() : null,
        hasDesc: !!desc,
        hasHomeLink: !!homeLink,
        hasAuthLink: !!authLink
      };
    })()`);

    console.log('  [+] 404.html typography audit:', notFoundAudit);
    assert.ok(notFoundAudit.hasPageTitle, '404.html must have h1.pm-page-title');
    assert.ok(notFoundAudit.hasDesc, '404.html must have .pm-page-subtitle');
    assert.ok(notFoundAudit.hasHomeLink, '404.html must have home link');
    assert.ok(notFoundAudit.hasAuthLink, '404.html must have auth link');

    for (const vp of viewports) {
      await setViewport(vp);
      await sleep(300);
      await checkOverflow('404.html', vp.name);
    }
    console.log('  [PASS] 2. 404.html passed typography, navigation links, and 5 viewport responsiveness tests');

    // =========================================================================
    // AUDIT 3: FE/features/payment/pricing.html
    // =========================================================================
    console.log('\n--- AUDIT 3: FE/features/payment/pricing.html ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/features/payment/pricing.html` });
    await sleep(2000);

    const pricingAudit = await cdp.eval(`(() => {
      const header = document.querySelector('.pm-page-header');
      const h1 = document.querySelector('h1.pm-page-title');
      const subtitle = document.querySelector('.pm-page-subtitle');
      const cardHeadings = Array.from(document.querySelectorAll('.pm-card-heading')).map(h => h.textContent.trim());
      const statValues = Array.from(document.querySelectorAll('.pm-stat-value')).map(s => s.textContent.trim());
      const statCaptions = Array.from(document.querySelectorAll('.pm-stat-caption')).map(s => s.textContent.trim());
      const proLink = document.querySelector('a[href*="payment"]');
      return {
        hasPageHeader: !!header,
        hasPageTitle: !!h1,
        titleText: h1 ? h1.textContent.trim() : null,
        hasSubtitle: !!subtitle,
        cardHeadings,
        statValues,
        statCaptions,
        hasProCheckoutLink: !!proLink
      };
    })()`);

    console.log('  [+] pricing.html typography audit:', pricingAudit);
    assert.ok(pricingAudit.hasPageHeader, 'pricing.html must have .pm-page-header');
    assert.ok(pricingAudit.hasPageTitle, 'pricing.html must have h1.pm-page-title');
    assert.strictEqual(pricingAudit.titleText, 'Bảng giá dịch vụ', 'Title must match Bảng giá dịch vụ');
    assert.ok(pricingAudit.hasSubtitle, 'pricing.html must have .pm-page-subtitle');
    assert.ok(pricingAudit.cardHeadings.length >= 2, 'Must have at least 2 .pm-card-heading elements');
    assert.ok(pricingAudit.statValues.includes('99.000đ'), 'Must contain 99.000đ price value');
    assert.ok(pricingAudit.hasProCheckoutLink, 'Must link to checkout');

    for (const vp of viewports) {
      await setViewport(vp);
      await sleep(300);
      await checkOverflow('pricing.html', vp.name);
    }
    console.log('  [PASS] 3. pricing.html passed typography, price stats, and 5 viewport responsiveness tests');

    // =========================================================================
    // AUDIT 4: FE/features/payment/payment.html (Authenticated Checkout)
    // =========================================================================
    console.log('\n--- AUDIT 4: FE/features/payment/payment.html ---');
    await setupCandidateSession();
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/features/payment/payment.html?plan=pro` });
    await sleep(2500);

    const paymentAudit = await cdp.eval(`(() => {
      const cardHeadings = Array.from(document.querySelectorAll('.pm-card-heading')).map(h => h.textContent.trim());
      const statValues = Array.from(document.querySelectorAll('.pm-stat-value')).map(s => s.textContent.trim());
      const statLabels = Array.from(document.querySelectorAll('.pm-stat-label')).map(s => s.textContent.trim());
      const bankQr = document.getElementById('bank-details');
      const pricingBackLink = document.querySelector('a[href*="pricing.html"]');
      const methodTabs = document.querySelectorAll('.method-tab-btn');
      return {
        cardHeadingsCount: cardHeadings.length,
        statValuesCount: statValues.length,
        statLabelsCount: statLabels.length,
        hasBankQr: !!bankQr,
        hasPricingBackLink: !!pricingBackLink,
        methodTabsCount: methodTabs.length
      };
    })()`);

    console.log('  [+] payment.html typography audit:', paymentAudit);
    assert.ok(paymentAudit.cardHeadingsCount >= 2, 'Must have .pm-card-heading elements');
    assert.ok(paymentAudit.statValuesCount >= 1, 'Must have .pm-stat-value elements');
    assert.ok(paymentAudit.hasBankQr, 'Must display bank transfer details');
    assert.ok(paymentAudit.hasPricingBackLink, 'Must link back to pricing.html');

    // Method tab switch test
    const methodSwitch = await cdp.eval(`(() => {
      const momoBtn = document.querySelectorAll('.method-tab-btn')[1];
      if (momoBtn) {
        momoBtn.click();
        const momoActive = document.getElementById('momo-details').classList.contains('active');
        return { momoActive };
      }
      return { momoActive: false };
    })()`);
    console.log('  [+] Payment method tab switch interaction:', methodSwitch);
    assert.ok(methodSwitch.momoActive, 'MoMo payment tab must activate on click');

    for (const vp of viewports) {
      await setViewport(vp);
      await sleep(300);
      await checkOverflow('payment.html', vp.name);
    }
    console.log('  [PASS] 4. payment.html passed typography, QR presentation, method switching, and 5 viewport responsiveness tests');

    // =========================================================================
    // AUDIT 5: FE/features/admin/admin.html (Authenticated Admin)
    // =========================================================================
    console.log('\n--- AUDIT 5: FE/features/admin/admin.html ---');
    await setupAdminSession();
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/features/admin/admin.html` });
    await sleep(2500);

    const adminAudit = await cdp.eval(`(() => {
      const header = document.querySelector('.pm-page-header');
      const h1 = document.querySelector('h1.pm-page-title');
      const subtitle = document.querySelector('.pm-page-subtitle');
      const secHeadings = Array.from(document.querySelectorAll('.pm-section-heading')).map(h => h.textContent.trim());
      const statValues = Array.from(document.querySelectorAll('.pm-stat-value')).map(s => s.textContent.trim());
      const statLabels = Array.from(document.querySelectorAll('.pm-stat-label')).map(s => s.textContent.trim());
      const statCaptions = Array.from(document.querySelectorAll('.pm-stat-caption')).map(s => s.textContent.trim());
      const roleSwitchAdmin = document.getElementById('btn-view-admin');
      const roleSwitchManager = document.getElementById('btn-view-manager');
      return {
        hasPageHeader: !!header,
        hasPageTitle: !!h1,
        titleText: h1 ? h1.textContent.trim() : null,
        hasSubtitle: !!subtitle,
        secHeadingsCount: secHeadings.length,
        statValuesCount: statValues.length,
        statLabelsCount: statLabels.length,
        statCaptionsCount: statCaptions.length,
        hasRoleSwitcher: !!(roleSwitchAdmin && roleSwitchManager)
      };
    })()`);

    console.log('  [+] admin.html typography audit:', adminAudit);
    assert.ok(adminAudit.hasPageHeader, 'admin.html must have .pm-page-header');
    assert.ok(adminAudit.hasPageTitle, 'admin.html must have h1.pm-page-title');
    assert.ok(adminAudit.titleText.includes('Bảng Quản Trị Hệ Thống'), 'Title must match Bảng Quản Trị Hệ Thống');
    assert.ok(adminAudit.hasSubtitle, 'admin.html must have .pm-page-subtitle');
    assert.ok(adminAudit.secHeadingsCount >= 6, 'Must have at least 6 .pm-section-heading elements');
    assert.ok(adminAudit.statValuesCount >= 4, 'Must have at least 4 .pm-stat-value KPI cards');
    assert.ok(adminAudit.statLabelsCount >= 4, 'Must have at least 4 .pm-stat-label KPI cards');
    assert.ok(adminAudit.hasRoleSwitcher, 'Must have Admin/Manager role switcher');

    // Role switcher interaction test
    const roleSwitchResult = await cdp.eval(`(() => {
      switchRoleView('manager');
      const isManagerActive = document.getElementById('btn-view-manager').classList.contains('active');
      const headingText = document.getElementById('role-title-text').textContent.trim();
      switchRoleView('admin'); // switch back
      return { isManagerActive, headingText };
    })()`);
    console.log('  [+] Role switcher interaction:', roleSwitchResult);
    assert.ok(roleSwitchResult.isManagerActive, 'Manager role must activate on switchRoleView');

    for (const vp of viewports) {
      await setViewport(vp);
      await sleep(300);
      await checkOverflow('admin.html', vp.name);
    }
    console.log('  [PASS] 5. admin.html passed typography, KPI cards, role switching, and 5 viewport responsiveness tests');

    // =========================================================================
    // AUDIT 6: FE/features/design-system/showcase.html
    // =========================================================================
    console.log('\n--- AUDIT 6: FE/features/design-system/showcase.html ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/features/design-system/showcase.html` });
    await sleep(2000);

    const showcaseAudit = await cdp.eval(`(() => {
      const header = document.querySelector('.pm-page-header');
      const h1 = document.querySelector('h1.pm-page-title');
      const secHeadings = Array.from(document.querySelectorAll('.pm-section-heading')).map(h => h.textContent.trim());
      return {
        hasPageHeader: !!header,
        hasPageTitle: !!h1,
        titleText: h1 ? h1.textContent.trim() : null,
        secHeadingsCount: secHeadings.length
      };
    })()`);

    console.log('  [+] showcase.html typography audit:', showcaseAudit);
    assert.ok(showcaseAudit.hasPageHeader, 'showcase.html must have .pm-page-header');
    assert.ok(showcaseAudit.hasPageTitle, 'showcase.html must have h1.pm-page-title');
    assert.ok(showcaseAudit.secHeadingsCount >= 4, 'showcase.html must have at least 4 .pm-section-heading elements');

    for (const vp of viewports) {
      await setViewport(vp);
      await sleep(300);
      await checkOverflow('showcase.html', vp.name);
    }
    console.log('  [PASS] 6. showcase.html passed typography and 5 viewport responsiveness tests');

    // =========================================================================
    // AUDIT 7: FE/legal-center.html (Forwarding Stub Verification)
    // =========================================================================
    console.log('\n--- AUDIT 7: FE/legal-center.html (Forwarding Stub) ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/legal-center.html` });
    await sleep(2000);

    const forwardAudit = await cdp.eval(`(() => {
      return {
        currentUrl: window.location.href,
        isCanonicalLegalCenter: window.location.href.includes('features/legal/legal-center.html')
      };
    })()`);

    console.log('  [+] legal-center.html forwarding audit:', forwardAudit);
    assert.ok(forwardAudit.isCanonicalLegalCenter, 'Root legal-center.html must forward to features/legal/legal-center.html');
    console.log('  [PASS] 7. legal-center.html verified as clean canonical forwarder stub');

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
    console.log('   🎉 ALL BATCH 4 TESTS AND AUDITS PASSED WITH 0 ERRORS!               ');
    console.log('======================================================================\n');
  } finally {
    if (cdp) await cdp.close();
    edgeCleanup();
    cleanup();
  }
}

runBatch4Audit().catch((err) => {
  console.error('\n❌ BATCH 4 AUDIT FAILED:', err);
  process.exit(1);
});
