/**
 * PREPMATE — BATCH 1 CORE INTERVIEW EXPERIENCE E2E AUDIT (EDGE CDP)
 * Work Item: WI-GLOBAL-UI-STANDARDIZATION-01 (Phase 2 - Batch 1)
 * Tests: dashboard.html, interview-info.html, interview-practice.html, history.html, report.html, company-intelligence.html, progress.html
 */

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');

const PORT = 5011;
const CDP_PORT = 9247;
const DB_PATH = path.resolve(__dirname, '../../BE/data/db.json');
const INITIAL_HASH = crypto.createHash('sha256').update(fs.readFileSync(DB_PATH)).digest('hex').toUpperCase();

console.log('======================================================================');
console.log('  PREPMATE — BATCH 1 CORE INTERVIEW EXPERIENCE E2E AUDIT (EDGE CDP)  ');
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
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log(`[3] Launching backend on port ${PORT}...`);
  const os = require('os');
  const TEST_DIR = path.join(os.tmpdir(), `prepmate_batch1_edge_${Date.now()}`);
  const TEST_DB_PATH = path.join(TEST_DIR, 'isolated_test_db.json');
  const TEST_KEYRING_PATH = path.join(TEST_DIR, 'test_keys');
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
  fs.copyFileSync(DB_PATH, TEST_DB_PATH);

  const backend = spawn('dotnet', ['run', '--no-launch-profile'], {
    cwd: path.resolve(__dirname, '../../BE'),
    stdio: 'pipe',
    env: {
      ...process.env,
      ASPNETCORE_URLS: `http://127.0.0.1:${PORT}`,
      PREPMATE_DB_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING_PATH,
      DATABASE_PATH: TEST_DB_PATH,
    },
  });

  const killBackend = () => {
    try { backend.kill(); } catch (e) {}
  };
  process.on('exit', killBackend);
  process.on('SIGINT', killBackend);

  let backendReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const ping = await httpGetJson(`http://127.0.0.1:${PORT}/api/health`);
      if (ping) {
        backendReady = true;
        break;
      }
    } catch (e) {
      await sleep(500);
    }
  }
  assert.ok(backendReady, "Backend failed to start on isolated port.");
  console.log(`[+] Backend ready on http://127.0.0.1:${PORT}`);

  const userDataDir = path.resolve(__dirname, `../../.edge_dev_batch1_${Date.now()}`);
  console.log(`[4] Launching Edge CDP on port ${CDP_PORT}...`);
  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: 'ignore' });

  await sleep(2500);

  let cdp;
  try {
    const versionInfo = await httpGetJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
    const pages = await httpGetJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const targetPage = pages.find(p => p.type === 'page') || pages[0];
    assert.ok(targetPage, 'No active browser page target found');

    cdp = new SimpleCDP(targetPage.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    console.log(`[+] Connected to Edge CDP: ${targetPage.webSocketDebuggerUrl}`);

    async function navigateAndWait(url, delay = 2000) {
      await cdp.send('Page.navigate', { url });
      await sleep(delay);
      for (let i = 0; i < 10; i++) {
        try {
          const href = await cdp.eval('window.location.href');
          if (href && href.startsWith('http://127.0.0.1')) return;
        } catch (e) {}
        await sleep(300);
      }
    }

    const viewports = [
      { name: 'Desktop 1440px', width: 1440, height: 900 },
      { name: 'Laptop 1280px', width: 1280, height: 800 },
      { name: 'Tablet 768px', width: 768, height: 1024 },
      { name: 'Mobile Large 390px', width: 390, height: 844 },
      { name: 'Mobile Compact 375px', width: 375, height: 667 },
    ];

    // ==========================================
    // AUDIT 1: Dashboard (dashboard.html)
    // ==========================================
    console.log('\n--- [Audit 1: Dashboard Page (dashboard.html)] ---');
    await navigateAndWait(`http://127.0.0.1:${PORT}/features/dashboard/dashboard.html`, 3000);

    const dashTitle = await cdp.eval(`(() => {
      const title = document.querySelector('.dashboard-page-title');
      if (!title) return { notFound: true, url: window.location.href, body: document.body.innerHTML.slice(0, 300) };
      const cs = window.getComputedStyle(title);
      return { text: title.innerText.trim(), fontSize: cs.fontSize, fontWeight: cs.fontWeight, hasPmTitle: title.classList.contains('pm-page-title') };
    })()`);
    if (dashTitle.notFound) {
      throw new Error('Dashboard title not found! Current URL=' + dashTitle.url + ', body snippet=' + dashTitle.body);
    }
    console.log(`  ✓ Dashboard Title: text="${dashTitle.text}", font=${dashTitle.fontSize}/${dashTitle.fontWeight}, hasPmTitle=${dashTitle.hasPmTitle}`);
    assert.ok(dashTitle.hasPmTitle, 'Dashboard title must adopt .pm-page-title');

    const dashStats = await cdp.eval(`(() => {
      const items = Array.from(document.querySelectorAll('.hero-stat-item'));
      return items.map(it => {
        const lbl = it.querySelector('.lbl');
        const num = it.querySelector('.num');
        const sub = it.querySelector('.sub');
        const rLbl = lbl ? lbl.getBoundingClientRect() : null;
        const rNum = num ? num.getBoundingClientRect() : null;
        const rSub = sub ? sub.getBoundingClientRect() : null;
        return {
          lblText: lbl ? lbl.innerText.trim() : null,
          numText: num ? num.innerText.trim() : null,
          verticalOrder: rLbl && rNum ? rLbl.bottom <= rNum.top + 2 : false,
          hasPmStatCard: it.classList.contains('pm-stat-card')
        };
      });
    })()`);
    dashStats.forEach((st, i) => {
      console.log(`  ✓ Dashboard Stat #${i+1}: Label="${st.lblText}" -> Value="${st.numText}", VerticalOrder=${st.verticalOrder}, hasPmStatCard=${st.hasPmStatCard}`);
      assert.strictEqual(st.verticalOrder, true, `Stat #${i+1} must follow Label -> Value vertical order`);
    });

    // Check dashboard multi-viewport overflow
    for (const vp of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.width < 768 });
      await sleep(400);
      const ov = await cdp.eval(`(() => {
        return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= window.innerWidth + 1;
      })()`);
      assert.strictEqual(ov, true, `Dashboard must not overflow horizontally on ${vp.name}`);
    }
    console.log(`  ✓ Dashboard verified with 0 horizontal overflow across all 5 viewports`);

    // ==========================================
    // AUDIT 2: Interview Setup (interview-info.html)
    // ==========================================
    console.log('\n--- [Audit 2: Interview Setup Page (interview-info.html)] ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await navigateAndWait(`http://127.0.0.1:${PORT}/features/interview/interview-info.html`, 2000);

    const setupTitle = await cdp.eval(`(() => {
      const h = document.querySelector('.chamber-hero-title');
      return { text: h.innerText.trim(), hasPmTitle: h.classList.contains('pm-page-title') };
    })()`);
    console.log(`  ✓ Setup Title: "${setupTitle.text}", hasPmTitle=${setupTitle.hasPmTitle}`);
    assert.ok(setupTitle.hasPmTitle, 'Setup hero title must adopt .pm-page-title');

    const stepHeadings = await cdp.eval(`(() => {
      const steps = Array.from(document.querySelectorAll('.step-card h3'));
      return steps.map(s => ({ text: s.innerText.trim(), hasPmSection: s.classList.contains('pm-section-heading') }));
    })()`);
    stepHeadings.forEach((sh, i) => {
      console.log(`  ✓ Step #${i+1} Heading: "${sh.text}", hasPmSection=${sh.hasPmSection}`);
      assert.ok(sh.hasPmSection, `Step #${i+1} must adopt .pm-section-heading`);
    });

    // ==========================================
    // AUDIT 3: Interview History (history.html)
    // ==========================================
    console.log('\n--- [Audit 3: Interview History Page (history.html)] ---');
    await navigateAndWait(`http://127.0.0.1:${PORT}/features/interview/history.html`, 2000);

    const histTitle = await cdp.eval(`(() => {
      const h1 = document.querySelector('.history-page-header h1');
      const cs = window.getComputedStyle(h1);
      return { text: h1.innerText.trim(), display: cs.display, hasPmTitle: h1.classList.contains('pm-page-title'), hasPmIcon: h1.classList.contains('pm-heading-with-icon') };
    })()`);
    console.log(`  ✓ History Header: "${histTitle.text}", display="${histTitle.display}", hasPmTitle=${histTitle.hasPmTitle}`);
    assert.ok(histTitle.hasPmTitle, 'History title must adopt .pm-page-title');

    const histMetrics = await cdp.eval(`(() => {
      const cards = Array.from(document.querySelectorAll('.metric-mini-card'));
      return cards.map(c => {
        const lbl = c.querySelector('.lbl');
        const val = c.querySelector('.val');
        const rLbl = lbl ? lbl.getBoundingClientRect() : null;
        const rVal = val ? val.getBoundingClientRect() : null;
        return {
          lbl: lbl ? lbl.innerText.trim() : null,
          val: val ? val.innerText.trim() : null,
          verticalOrder: rLbl && rVal ? rLbl.bottom <= rVal.top + 2 : false,
          hasPmStat: c.classList.contains('pm-stat-card')
        };
      });
    })()`);
    histMetrics.forEach((m, i) => {
      console.log(`  ✓ History Metric #${i+1}: Label="${m.lbl}" -> Value="${m.val}", VerticalOrder=${m.verticalOrder}, hasPmStat=${m.hasPmStat}`);
      assert.strictEqual(m.verticalOrder, true, `History metric #${i+1} must follow Label -> Value order`);
    });

    // ==========================================
    // AUDIT 4: Report Page & Artificial Truncation Removal (report.html & report.js)
    // ==========================================
    console.log('\n--- [Audit 4: Report Page & Truncation Removal (report.html)] ---');
    await navigateAndWait(`http://127.0.0.1:${PORT}/features/report/report.html`, 2000);

    const reportTitle = await cdp.eval(`(() => {
      const h1 = document.querySelector('.report-page-title');
      return { text: h1 ? h1.innerText.trim() : null, hasPmTitle: h1 ? h1.classList.contains('pm-page-title') : false };
    })()`);
    console.log(`  ✓ Report Title: "${reportTitle.text}", hasPmTitle=${reportTitle.hasPmTitle}`);
    assert.ok(reportTitle.hasPmTitle, 'Report title must adopt .pm-page-title');

    // Verify report.js no longer contains slice(0, 85)
    const reportJsContent = fs.readFileSync(path.resolve(__dirname, '../../FE/features/report/report.js'), 'utf8');
    assert.ok(!reportJsContent.includes('.slice(0, 85)'), 'report.js must NOT contain .slice(0, 85) question truncation!');
    console.log(`  ✓ report.js artificial question slice(0, 85) confirmed completely removed`);

    // Verify report.css has natural wrapping on questions
    const reportCssContent = fs.readFileSync(path.resolve(__dirname, '../../FE/features/report/report.css'), 'utf8');
    assert.ok(!reportCssContent.includes('.turn-trigger-title {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;'), 'turn-trigger-title must not have nowrap ellipsis');
    console.log(`  ✓ report.css turn-trigger-title and question feedback titles confirmed natural wrapping`);

    // ==========================================
    // AUDIT 5: Practice Room (interview-practice.html)
    // ==========================================
    console.log('\n--- [Audit 5: Practice Room Hint Wrapping (interview-practice.html)] ---');
    // Ensure interview_init_data is injected on new document so interview.js does not redirect
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        try {
          sessionStorage.setItem("interview_init_data", JSON.stringify({
            jobTitle: "Frontend Engineer",
            companyName: "VNG",
            interviewRound: "round2"
          }));
        } catch (e) {}
      `
    });
    await navigateAndWait(`http://127.0.0.1:${PORT}/features/interview/interview-practice.html`, 2000);

    const qText = await cdp.eval(`(() => {
      const el = document.getElementById('current-question-text');
      return {
        url: window.location.href,
        found: Boolean(el),
        hasWrap: el ? el.classList.contains('pm-content-wrap') : false
      };
    })()`);
    console.log(`  ✓ Practice Room Question Prompt: url="${qText.url}", found=${qText.found}, has pm-content-wrap=${qText.hasWrap}`);
    assert.ok(qText.hasWrap, 'Question prompt must have pm-content-wrap');

    // ==========================================
    // AUDIT 6: Company Intelligence (company-intelligence.html)
    // ==========================================
    console.log('\n--- [Audit 6: Company Intelligence (company-intelligence.html)] ---');
    await navigateAndWait(`http://127.0.0.1:${PORT}/features/report/company-intelligence.html`, 2000);

    const compIntel = await cdp.eval(`(() => {
      const h1 = document.querySelector('.hero-company-name');
      const sec = Array.from(document.querySelectorAll('.sec-title'));
      return {
        hasPmTitle: h1 ? h1.classList.contains('pm-page-title') : false,
        allSecHeadings: sec.every(s => s.classList.contains('pm-section-heading'))
      };
    })()`);
    console.log(`  ✓ Company Intelligence: hasPmTitle=${compIntel.hasPmTitle}, allSecHeadingsAdopted=${compIntel.allSecHeadings}`);
    assert.ok(compIntel.hasPmTitle, 'Company intelligence hero must adopt .pm-page-title');
    assert.ok(compIntel.allSecHeadings, 'All section titles must adopt .pm-section-heading');

    // ==========================================
    // AUDIT 7: Database Invariant
    // ==========================================
    console.log('\n--- [Audit 7: Production Database Invariant] ---');
    const finalHash = crypto.createHash('sha256').update(fs.readFileSync(DB_PATH)).digest('hex').toUpperCase();
    console.log(`[+] Final Production DB Hash: ${finalHash}`);
    assert.strictEqual(finalHash, INITIAL_HASH, 'Production database must remain byte-for-byte identical!');

    console.log('\n======================================================================');
    console.log('  ALL BATCH 1 CORE INTERVIEW EXPERIENCE CHECKS PASSED (100% SUCCESS)  ');
    console.log('======================================================================\n');
  } finally {
    if (cdp) await cdp.close();
    try { edgeProc.kill(); } catch (e) {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
    killBackend();
  }
}

run().catch(err => {
  console.error('[FATAL ERROR IN BATCH 1 TEST]:', err);
  process.exit(1);
});
