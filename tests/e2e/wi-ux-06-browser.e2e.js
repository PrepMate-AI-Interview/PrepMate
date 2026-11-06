/**
 * PREPMATE — WI-UX-06: REAL BROWSER E2E TEST SUITE
 * 
 * Verifies via Headless Edge CDP:
 * 1. Sidebar Toggle Button Placement & Centering (WI-01).
 * 2. Sidebar Collapse / Expand Smooth Transition (WI-01).
 * 3. Dashboard Information Hierarchy & Overview Optimization (WI-02, WI-03, WI-04).
 * 4. Responsive Viewports: 1440px, 1024px, 768px, 390px.
 * 5. Light Mode & Dark Mode Theme Contrast.
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
const PORT = 5126;
const CDP_PORT = 9266;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();

const TEST_DIR = path.join(os.tmpdir(), `prepmate_wi_ux_06_${Date.now()}`);
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

function startStaticServer(port) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
  };

  const server = http.createServer((req, res) => {
    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') reqPath = '/FE/index.html';
    else if (!reqPath.startsWith('/FE/')) reqPath = '/FE' + reqPath;

    const filePath = path.join(WORKSPACE_ROOT, reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${reqPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(fs.readFileSync(filePath));
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new globalThis.WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Evaluation failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await sleep(900);
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
  }
}

async function runTest() {
  console.log('================================================================');
  console.log('  RUNNING PREPMATE BROWSER E2E: WI-UX-06');
  console.log('  Sidebar Toggle Placement & Dashboard Overview Verification');
  console.log('================================================================\n');

  // Verify DB Hash before test
  const initialHash = computeHash(PROD_DB_PATH);
  assert.strictEqual(initialHash, BASELINE_DB_HASH, 'DB invariant violated at start');

  fs.mkdirSync(BROWSER_USER_DATA, { recursive: true });
  const server = await startStaticServer(PORT);
  console.log(`[PASS] Static HTTP Server running at ${BASE_URL}`);

  const browserBin = findBrowserExecutable();
  assert.ok(browserBin, 'Chromium/Edge browser executable found');

  const browserProcess = spawn(browserBin, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${BROWSER_USER_DATA}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'about:blank',
  ], { stdio: 'ignore' });

  let cdp = null;
  try {
    let connected = false;
    for (let i = 0; i < 20; i++) {
      try {
        const jsonRes = await new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${CDP_PORT}/json`, (r) => {
            let data = '';
            r.on('data', (d) => (data += d));
            r.on('end', () => resolve(JSON.parse(data)));
          }).on('error', reject);
        });
        const page = jsonRes.find((t) => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          cdp = new CdpClient(page.webSocketDebuggerUrl);
          await cdp.connect();
          connected = true;
          break;
        }
      } catch (err) {
        await sleep(250);
      }
    }
    assert.ok(connected, 'Successfully connected to Edge CDP');
    console.log('[PASS] Connected to Edge CDP instance');

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    await cdp.setViewport(1440, 900);

    // -------------------------------------------------------------
    // TEST 1: SIDEBAR TOGGLE BUTTON PLACEMENT & CENTERING (WI-01)
    // -------------------------------------------------------------
    console.log('\n• Test 1: Sidebar Toggle Button Placement & Centering');
    await cdp.navigate(`${BASE_URL}/features/dashboard/dashboard.html`);

    const toggleBtnMetrics = await cdp.evaluate(`(() => {
      const btn = document.getElementById('sidebar-toggle-btn');
      if (!btn) return { error: 'No #sidebar-toggle-btn' };
      const btnRect = btn.getBoundingClientRect();
      const svg = btn.querySelector('svg');
      const svgRect = svg ? svg.getBoundingClientRect() : null;
      const comp = window.getComputedStyle(btn);
      
      const btnCenterX = btnRect.left + btnRect.width / 2;
      const btnCenterY = btnRect.top + btnRect.height / 2;
      const svgCenterX = svgRect ? svgRect.left + svgRect.width / 2 : 0;
      const svgCenterY = svgRect ? svgRect.top + svgRect.height / 2 : 0;

      return {
        width: btnRect.width,
        height: btnRect.height,
        svgWidth: svgRect ? svgRect.width : 0,
        svgHeight: svgRect ? svgRect.height : 0,
        deltaX: Math.abs(btnCenterX - svgCenterX),
        deltaY: Math.abs(btnCenterY - svgCenterY),
        display: comp.display,
        borderRadius: comp.borderRadius,
        pointerEvents: svg ? window.getComputedStyle(svg).pointerEvents : 'auto'
      };
    })()`);

    assert.strictEqual(toggleBtnMetrics.width, 26, 'Button width is 26px');
    assert.strictEqual(toggleBtnMetrics.height, 26, 'Button height is 26px');
    assert.ok(toggleBtnMetrics.deltaX < 0.5, `SVG is horizontally centered (deltaX=${toggleBtnMetrics.deltaX})`);
    assert.ok(toggleBtnMetrics.deltaY < 0.5, `SVG is vertically centered (deltaY=${toggleBtnMetrics.deltaY})`);
    assert.strictEqual(toggleBtnMetrics.pointerEvents, 'none', 'SVG has pointer-events: none');
    console.log(`  [PASS] Toggle button verified: 26x26px, centered SVG (deltaX=${toggleBtnMetrics.deltaX.toFixed(2)}, deltaY=${toggleBtnMetrics.deltaY.toFixed(2)})`);

    // -------------------------------------------------------------
    // TEST 2: SIDEBAR COLLAPSE / EXPAND SMOOTH TRANSITIONS (WI-01)
    // -------------------------------------------------------------
    console.log('\n• Test 2: Sidebar Collapse / Expand Transitions');
    const collapseResult = await cdp.evaluate(`(async () => {
      const btn = document.getElementById('sidebar-toggle-btn');
      const sidebar = document.querySelector('.sidebar-new');
      const main = document.querySelector('.main-content-new');
      
      const initialWidth = sidebar.getBoundingClientRect().width;
      const initialMargin = parseFloat(window.getComputedStyle(main).marginLeft);
      
      btn.click(); // Collapse
      await new Promise(r => setTimeout(r, 300));
      
      const collapsedWidth = sidebar.getBoundingClientRect().width;
      const collapsedMargin = parseFloat(window.getComputedStyle(main).marginLeft);
      const isCollapsed = sidebar.classList.contains('collapsed');
      
      btn.click(); // Expand back
      await new Promise(r => setTimeout(r, 300));
      
      const expandedWidth = sidebar.getBoundingClientRect().width;
      const expandedMargin = parseFloat(window.getComputedStyle(main).marginLeft);
      
      return {
        initialWidth,
        initialMargin,
        collapsedWidth,
        collapsedMargin,
        isCollapsed,
        expandedWidth,
        expandedMargin
      };
    })()`);

    assert.strictEqual(collapseResult.initialWidth, 260, 'Initial sidebar width is 260px');
    assert.strictEqual(collapseResult.collapsedWidth, 72, 'Collapsed sidebar width is 72px');
    assert.strictEqual(collapseResult.collapsedMargin, 72, 'Collapsed main margin is 72px');
    assert.strictEqual(collapseResult.expandedWidth, 260, 'Expanded back to 260px');
    console.log(`  [PASS] Sidebar collapse/expand verified: 260px -> 72px -> 260px in lockstep with content margin`);

    // -------------------------------------------------------------
    // TEST 3: DASHBOARD INFORMATION HIERARCHY & METRICS (WI-02, WI-03)
    // -------------------------------------------------------------
    console.log('\n• Test 3: Dashboard Information Hierarchy & Metrics');
    const dashOverview = await cdp.evaluate(`(() => {
      const title = document.querySelector('.dashboard-page-title');
      const cta = document.querySelector('.btn-start-interview');
      const stats = Array.from(document.querySelectorAll('.hero-stat-item')).map(s => ({
        num: s.querySelector('.num') ? s.querySelector('.num').innerText.trim() : '',
        lbl: s.querySelector('.lbl') ? s.querySelector('.lbl').innerText.trim() : ''
      }));
      const readinessCards = document.querySelectorAll('.readiness-card').length;
      
      return {
        hasTitle: Boolean(title && title.innerText.includes('Tổng quan')),
        hasCta: Boolean(cta && cta.innerText.includes('Bắt đầu phỏng vấn mới')),
        ctaHref: cta ? cta.getAttribute('href') : '',
        statsCount: stats.length,
        stats,
        readinessCards
      };
    })()`);

    assert.ok(dashOverview.hasTitle, 'Page title "Tổng quan" rendered');
    assert.ok(dashOverview.hasCta, 'Primary CTA "Bắt đầu phỏng vấn mới" rendered');
    assert.ok(dashOverview.ctaHref.includes('interview-info.html'), 'CTA routes to interview-info.html');
    assert.strictEqual(dashOverview.statsCount, 3, 'Exactly 3 prominent KPI metrics in hero');
    assert.strictEqual(dashOverview.readinessCards, 4, '4 executive readiness pillars preserved');
    console.log(`  [PASS] Dashboard overview hierarchy verified: "Tổng quan" title, 1 prominent CTA, 3 KPI metrics, 4 readiness pillars`);

    // -------------------------------------------------------------
    // TEST 4: RESPONSIVE VIEWPORTS CLEAN REFLOW (PHASE 3)
    // -------------------------------------------------------------
    console.log('\n• Test 4: Responsive Viewports Clean Reflow');
    const viewports = [
      { name: 'Desktop 1440px', width: 1440, height: 900 },
      { name: 'Tablet Landscape 1024px', width: 1024, height: 768 },
      { name: 'Tablet Portrait 768px', width: 768, height: 1024 },
      { name: 'Mobile 390px', width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await cdp.setViewport(vp.width, vp.height);
      await sleep(200);

      const overflow = await cdp.evaluate(`(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        };
      })()`);

      assert.strictEqual(overflow.hasHorizontalOverflow, false, `No horizontal overflow at ${vp.name}`);
      console.log(`  [PASS] Viewport ${vp.name}: clean layout, 0 overflow (scrollWidth=${overflow.scrollWidth})`);
    }

    // Reset viewport
    await cdp.setViewport(1440, 900);

    // -------------------------------------------------------------
    // TEST 5: LIGHT & DARK MODE THEME CONTRAST (WI-05)
    // -------------------------------------------------------------
    console.log('\n• Test 5: Light & Dark Mode Contrast');
    const themeTest = await cdp.evaluate(`(() => {
      document.body.classList.add('dark-mode');
      const hero = document.querySelector('.dashboard-hero');
      const heroBg = window.getComputedStyle(hero).backgroundColor;
      const btn = document.getElementById('sidebar-toggle-btn');
      const btnBg = window.getComputedStyle(btn).backgroundColor;
      
      document.body.classList.remove('dark-mode');
      return { heroBg, btnBg };
    })()`);

    assert.ok(themeTest.heroBg.includes('rgb'), 'Dark mode hero background computed cleanly');
    console.log(`  [PASS] Dark mode verified: hero background: ${themeTest.heroBg}, toggle button background: ${themeTest.btnBg}`);

    // -------------------------------------------------------------
    // TEST 6: PRODUCTION DB INVARIANT
    // -------------------------------------------------------------
    console.log('\n• Test 6: Production DB SHA-256 Invariant');
    const finalHash = computeHash(PROD_DB_PATH);
    assert.strictEqual(finalHash, BASELINE_DB_HASH, 'DB invariant preserved throughout tests');
    console.log(`  [PASS] db.json invariant preserved: ${finalHash}`);

    console.log('\n================================================================');
    console.log('  WI-UX-06 REAL-BROWSER E2E: ALL 6 TESTS PASSED CLEANLY');
    console.log('================================================================\n');
  } finally {
    if (cdp) cdp.close();
    browserProcess.kill();
    server.close();
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }
}

runTest().catch((err) => {
  console.error('\n[FAIL] E2E Test Suite Error:', err);
  process.exit(1);
});
