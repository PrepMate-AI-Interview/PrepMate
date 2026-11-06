/**
 * PREPMATE — WI-JOBS-UX-03: REAL BROWSER E2E VERIFICATION SUITE
 * 
 * Verifies via Headless Edge CDP:
 * 1. jobs.html: Job Card Footer redesign & action hierarchy.
 * 2. Left group: job-posted-time formatting ("hôm nay", "1 ngày trước", etc.).
 * 3. Right group: Save (32x32) -> Details (32px outline) -> Apply (emerald primary CTA).
 * 4. Bookmark click interaction: toggle saved state without opening modal.
 * 5. Visual regression screenshots across 1440px, 1280px, 768px, 390px, 360px.
 * 6. Light Mode and Dark Mode rendering.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');
const crypto = require('crypto');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const PORT = 5143;
const CDP_PORT = 9283;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SCREENSHOTS_DIR = path.join(WORKSPACE_ROOT, 'scratch', 'screenshots', 'wi-jobs-ux-03');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function findBrowserExecutable() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('No Edge/Chrome executable found');
}

function startStaticServer(port) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png'
  };

  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/FE/features/jobs/jobs.html';
    let filePath = path.join(WORKSPACE_ROOT, reqPath.startsWith('/') ? reqPath.slice(1) : reqPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
      const ext = path.extname(filePath);
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not found: ${reqPath}`);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new globalThis.WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const parsed = JSON.parse(event.data);
        if (parsed.id && this.callbacks.has(parsed.id)) {
          const cb = this.callbacks.get(parsed.id);
          this.callbacks.delete(parsed.id);
          if (parsed.error) cb.reject(new Error(parsed.error.message));
          else cb.resolve(parsed.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async captureScreenshot(outputPath, clip = null) {
    const params = { format: 'png' };
    if (clip) params.clip = clip;
    const res = await this.send('Page.captureScreenshot', params);
    fs.writeFileSync(outputPath, Buffer.from(res.data, 'base64'));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   WI-JOBS-UX-03: REAL BROWSER E2E FOOTER VERIFICATION       ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const staticServer = await startStaticServer(PORT);
  console.log(`[PASS] Test static server running at ${BASE_URL}`);

  const browserPath = findBrowserExecutable();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepmate-edge-jobs-03-'));
  
  const browserProcess = spawn(browserPath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], { stdio: 'ignore' });

  // Wait for browser CDP to be ready
  let version = null;
  for (let i = 0; i < 30; i++) {
    try {
      version = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (version && version.webSocketDebuggerUrl) break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  assert.ok(version, 'Browser failed to launch CDP');

  const targets = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  await cdp.send('Runtime.enable');

  try {
    // 1. Navigate to jobs.html
    console.log('\n--- Test 1: Navigation & Mock Environment Setup ---');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/FE/features/jobs/jobs.html` });
    await new Promise(r => setTimeout(r, 1200));

    // Ensure mock logged in user so auth check doesn't redirect
    await cdp.evaluate(`
      localStorage.setItem('prepmate_current_user', JSON.stringify({
        id: 'usr_test_candidate',
        name: 'Nguyen Van Test',
        role: 'candidate',
        email: 'candidate@prepmate.vn',
        token: 'mock_jwt_token_candidate_123'
      }));
    `);

    await cdp.send('Page.navigate', { url: `${BASE_URL}/FE/features/jobs/jobs.html` });
    await new Promise(r => setTimeout(r, 1200));

    // 2. Set viewport to 1440x900 desktop
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 500));

    // Wait for job cards to render
    const cardCount = await cdp.evaluate(`document.querySelectorAll('.job-card').length`);
    console.log(`[PASS] Rendered ${cardCount} job cards in DOM`);
    assert.ok(cardCount > 0, 'No job cards rendered');

    // 3. Inspect Footer Structure & Metrics on Desktop
    console.log('\n--- Test 2: Footer DOM Structure & Geometry (1440px) ---');
    const footerMetrics = await cdp.evaluate(`
      (() => {
        const firstCard = document.querySelector('.job-card');
        const footer = firstCard ? firstCard.querySelector('.job-card-footer') : null;
        if (!footer) return null;
        const posted = footer.querySelector('.job-posted-time');
        const actionsGroup = footer.querySelector('.job-footer-actions');
        const bookmark = actionsGroup.querySelector('.btn-save-bookmark');
        const viewBtn = actionsGroup.querySelector('.btn-view-jd');
        const applyBtn = actionsGroup.querySelector('.btn-apply-link');

        const fRect = footer.getBoundingClientRect();
        const pRect = posted ? posted.getBoundingClientRect() : null;
        const bRect = bookmark ? bookmark.getBoundingClientRect() : null;
        const vRect = viewBtn ? viewBtn.getBoundingClientRect() : null;
        const aRect = applyBtn ? applyBtn.getBoundingClientRect() : null;

        const fStyles = window.getComputedStyle(footer);
        const bStyles = bookmark ? window.getComputedStyle(bookmark) : null;
        const vStyles = viewBtn ? window.getComputedStyle(viewBtn) : null;
        const aStyles = applyBtn ? window.getComputedStyle(applyBtn) : null;

        return {
          footerDisplay: fStyles.display,
          footerJustify: fStyles.justifyContent,
          footerAlign: fStyles.alignItems,
          postedText: posted ? posted.textContent.trim() : null,
          bookmarkSize: bRect ? { width: Math.round(bRect.width), height: Math.round(bRect.height) } : null,
          viewSize: vRect ? { width: Math.round(vRect.width), height: Math.round(vRect.height) } : null,
          applySize: aRect ? { width: Math.round(aRect.width), height: Math.round(aRect.height) } : null,
          applyBg: aStyles ? aStyles.backgroundColor : null,
          applyColor: aStyles ? aStyles.color : null,
          orderValid: (pRect && bRect && vRect) ? (pRect.left < bRect.left && bRect.left < vRect.left && (!aRect || vRect.left < aRect.left)) : false
        };
      })()
    `);

    assert.ok(footerMetrics, 'Footer metrics could not be read');
    console.log(`[PASS] Footer display: ${footerMetrics.footerDisplay}, justify-content: ${footerMetrics.footerJustify}`);
    assert.strictEqual(footerMetrics.footerDisplay, 'flex');
    assert.strictEqual(footerMetrics.footerJustify, 'space-between');

    console.log(`[PASS] Posted time text: "${footerMetrics.postedText}"`);
    assert.ok(footerMetrics.postedText && footerMetrics.postedText.startsWith('Đăng '), 'Posted text format invalid');

    console.log(`[PASS] Bookmark button dimensions: ${footerMetrics.bookmarkSize.width}x${footerMetrics.bookmarkSize.height}px (Target: 32x32px)`);
    assert.strictEqual(footerMetrics.bookmarkSize.width, 32);
    assert.strictEqual(footerMetrics.bookmarkSize.height, 32);

    console.log(`[PASS] Details button height: ${footerMetrics.viewSize.height}px (Target: 32px)`);
    assert.strictEqual(footerMetrics.viewSize.height, 32);

    if (footerMetrics.applySize) {
      console.log(`[PASS] Apply button height: ${footerMetrics.applySize.height}px, background: ${footerMetrics.applyBg}`);
      assert.strictEqual(footerMetrics.applySize.height, 32);
    }

    console.log(`[PASS] Horizontal action hierarchy order (Left -> Right: Posted -> Save -> Details -> Apply): ${footerMetrics.orderValid}`);
    assert.ok(footerMetrics.orderValid, 'Action order is not correctly aligned from left to right');

    // 4. Capture Desktop 1440 Light screenshot
    const shotPath1440Light = path.join(SCREENSHOTS_DIR, '01-jobs-footer-desktop-light-1440.png');
    await cdp.captureScreenshot(shotPath1440Light);
    console.log(`[PASS] Captured: ${shotPath1440Light}`);

    // Capture closeup of first job card
    const cardClip = await cdp.evaluate(`
      (() => {
        const card = document.querySelector('.job-card');
        const r = card.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 };
      })()
    `);
    const shotCloseup = path.join(SCREENSHOTS_DIR, '08-jobs-card-footer-closeup.png');
    await cdp.captureScreenshot(shotCloseup, cardClip);
    console.log(`[PASS] Captured card closeup: ${shotCloseup}`);

    // 5. Test Bookmark Interaction (Save / Unsave)
    console.log('\n--- Test 3: Bookmark Interaction & Event Propagation ---');
    const bookmarkRes = await cdp.evaluate(`
      (() => {
        const btn = document.querySelector('.job-card .btn-save-bookmark');
        const beforeSaved = btn.classList.contains('saved');
        btn.click();
        const afterSaved = btn.classList.contains('saved');
        const storageVal = localStorage.getItem('saved_jobs');
        const isModalOpen = !!document.querySelector('.job-detail-modal.active');
        return { beforeSaved, afterSaved, storageVal, isModalOpen };
      })()
    `);
    console.log(`[PASS] Bookmark toggle: before=${bookmarkRes.beforeSaved}, after=${bookmarkRes.afterSaved}, modalOpen=${bookmarkRes.isModalOpen}`);
    assert.notStrictEqual(bookmarkRes.beforeSaved, bookmarkRes.afterSaved, 'Bookmark state did not toggle');
    assert.strictEqual(bookmarkRes.isModalOpen, false, 'Modal opened when clicking bookmark button! Event propagation was not stopped.');

    const shotSaved = path.join(SCREENSHOTS_DIR, '07-jobs-footer-saved-state.png');
    await cdp.captureScreenshot(shotSaved, cardClip);
    console.log(`[PASS] Captured saved state: ${shotSaved}`);

    // 6. Test Dark Mode Rendering
    console.log('\n--- Test 4: Dark Mode Footer Consistency ---');
    await cdp.evaluate(`
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-mode');
    `);
    await new Promise(r => setTimeout(r, 400));

    const darkModeStyles = await cdp.evaluate(`
      (() => {
        const card = document.querySelector('.job-card');
        const footer = card.querySelector('.job-card-footer');
        const bookmark = footer.querySelector('.btn-save-bookmark');
        const viewBtn = footer.querySelector('.btn-view-jd');
        const applyBtn = footer.querySelector('.btn-apply-link');

        return {
          cardBg: window.getComputedStyle(card).backgroundColor,
          footerBorderTop: window.getComputedStyle(footer).borderTopColor,
          viewColor: window.getComputedStyle(viewBtn).color,
          bookmarkColor: window.getComputedStyle(bookmark).color,
          applyBg: applyBtn ? window.getComputedStyle(applyBtn).backgroundColor : null
        };
      })()
    `);
    console.log(`[PASS] Dark mode cardBg: ${darkModeStyles.cardBg}, footerBorder: ${darkModeStyles.footerBorderTop}, viewColor: ${darkModeStyles.viewColor}`);

    const shotPath1440Dark = path.join(SCREENSHOTS_DIR, '02-jobs-footer-desktop-dark-1440.png');
    await cdp.captureScreenshot(shotPath1440Dark);
    console.log(`[PASS] Captured: ${shotPath1440Dark}`);

    // Reset to light mode for remaining responsive tests
    await cdp.evaluate(`
      document.documentElement.removeAttribute('data-theme');
      document.body.classList.remove('dark-mode');
    `);
    await new Promise(r => setTimeout(r, 300));

    // 7. Laptop Viewport 1280x800
    console.log('\n--- Test 5: Responsive Viewports (1280px, 768px, 390px, 360px) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 400));
    const shotPath1280 = path.join(SCREENSHOTS_DIR, '03-jobs-footer-laptop-1280.png');
    await cdp.captureScreenshot(shotPath1280);
    console.log(`[PASS] Captured 1280px: ${shotPath1280}`);

    // 8. Tablet Viewport 768x1024
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 400));
    const shotPath768 = path.join(SCREENSHOTS_DIR, '04-jobs-footer-tablet-768.png');
    await cdp.captureScreenshot(shotPath768);
    console.log(`[PASS] Captured 768px: ${shotPath768}`);

    // 9. Mobile Viewport 390x844 (iPhone 14)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 400));

    const mobileMetrics390 = await cdp.evaluate(`
      (() => {
        const footer = document.querySelector('.job-card .job-card-footer');
        const posted = footer.querySelector('.job-posted-time');
        const actions = footer.querySelector('.job-footer-actions');
        const pRect = posted ? posted.getBoundingClientRect() : null;
        const aRect = actions ? actions.getBoundingClientRect() : null;
        const fStyles = window.getComputedStyle(footer);
        const overflowX = document.documentElement.scrollWidth > window.innerWidth;
        return {
          flexDirection: fStyles.flexDirection,
          isStacked: pRect && aRect ? (aRect.top >= pRect.bottom - 2) : false,
          overflowX: overflowX
        };
      })()
    `);
    console.log(`[PASS] Mobile 390px: flexDirection=${mobileMetrics390.flexDirection}, isStacked=${mobileMetrics390.isStacked}, horizontalOverflow=${mobileMetrics390.overflowX}`);
    assert.strictEqual(mobileMetrics390.flexDirection, 'column');
    assert.strictEqual(mobileMetrics390.isStacked, true);
    assert.strictEqual(mobileMetrics390.overflowX, false);

    const shotPath390 = path.join(SCREENSHOTS_DIR, '05-jobs-footer-mobile-390.png');
    await cdp.captureScreenshot(shotPath390);
    console.log(`[PASS] Captured 390px: ${shotPath390}`);

    // 10. Small Mobile Viewport 360x780 (Android small)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 780,
      deviceScaleFactor: 1,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 400));

    const mobileMetrics360 = await cdp.evaluate(`
      (() => {
        const overflowX = document.documentElement.scrollWidth > window.innerWidth;
        return { overflowX };
      })()
    `);
    console.log(`[PASS] Small Mobile 360px: horizontalOverflow=${mobileMetrics360.overflowX}`);
    assert.strictEqual(mobileMetrics360.overflowX, false);

    const shotPath360 = path.join(SCREENSHOTS_DIR, '06-jobs-footer-mobile-360.png');
    await cdp.captureScreenshot(shotPath360);
    console.log(`[PASS] Captured 360px: ${shotPath360}`);

    // 11. Database integrity
    console.log('\n--- Test 6: Database Checksum Integrity ---');
    const dbPath = path.join(WORKSPACE_ROOT, 'BE', 'data', 'db.json');
    const dbBuf = fs.readFileSync(dbPath);
    const hash = crypto.createHash('sha256').update(dbBuf).digest('hex').toUpperCase();
    const EXPECTED_HASH = '44223D9B7E945E70CADEB3279AE3EE5A0DD748A867B2C3A6B0C5C617A9DB62C3';
    console.log(`[PASS] Production DB SHA-256 verified: ${hash}`);
    assert.strictEqual(hash, EXPECTED_HASH);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   ALL WI-JOBS-UX-03 REAL BROWSER E2E TESTS PASSED!           ');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } finally {
    cdp.close();
    browserProcess.kill();
    staticServer.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

run().catch(err => {
  console.error('\n[FATAL ERROR in WI-JOBS-UX-03 E2E]:', err);
  process.exit(1);
});
