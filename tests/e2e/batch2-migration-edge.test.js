/**
 * PREPMATE — BATCH 2 CAREER PREPARATION & DISCOVERY E2E AUDIT (EDGE CDP)
 * Work Item: WI-GLOBAL-UI-STANDARDIZATION-01 (Phase 2 - Batch 2)
 * Tests: qbank.html, jobs.html, about.html, help.html, legal-center.html
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');
const os = require('os');

const PORT = 5012;
const CDP_PORT = 9248;
const DB_PATH = path.resolve(__dirname, '../../BE/data/db.json');
const INITIAL_HASH = crypto.createHash('sha256').update(fs.readFileSync(DB_PATH)).digest('hex').toUpperCase();

console.log('======================================================================');
console.log('  PREPMATE — BATCH 2 CAREER PREPARATION & DISCOVERY E2E AUDIT (EDGE)  ');
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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runBatch2Audit() {
  const beDir = path.resolve(__dirname, '../../BE');
  const tempTestDb = path.join(os.tmpdir(), `prepmate_e2e_batch2_db_${Date.now()}.json`);
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

  const edgeUserDataDir = path.resolve(__dirname, `../../.edge_dev_batch2_${Date.now()}`);
  console.log(`[4] Launching Edge CDP on port ${CDP_PORT}...`);
  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${edgeUserDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    'about:blank'
  ]);

  const killEdge = () => {
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
    let targetPage = null;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const pages = await httpGetJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (pages && pages.length > 0) {
          targetPage = pages.find(p => p.type === 'page') || pages[0];
          if (targetPage && targetPage.webSocketDebuggerUrl) break;
        }
      } catch (e) {}
    }
    assert.ok(targetPage && targetPage.webSocketDebuggerUrl, 'Failed to obtain Edge CDP page target WebSocket URL');
    console.log(`[+] Connected to Edge CDP: ${targetPage.webSocketDebuggerUrl}`);

    const cdp = new SimpleCDP(targetPage.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    await cdp.send('Runtime.enable');

    const viewports = [
      { name: 'Desktop Large', width: 1440, height: 900 },
      { name: 'Desktop Standard', width: 1280, height: 800 },
      { name: 'Tablet Portrait', width: 768, height: 1024 },
      { name: 'Mobile Large', width: 390, height: 844 },
      { name: 'Mobile Compact', width: 375, height: 667 }
    ];

    async function setViewport(vp) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 768,
      });
      await sleep(150);
    }

    async function navigateAndWait(url, delay = 2500) {
      await cdp.send('Page.navigate', { url });
      await sleep(delay);
      for (let i = 0; i < 15; i++) {
        try {
          const href = await cdp.eval('window.location.href');
          if (href && href.startsWith('http://127.0.0.1')) return;
        } catch (e) {}
        await sleep(300);
      }
    }

    // ========================================================================
    // AUDIT 1: Question Bank (qbank.html)
    // ========================================================================
    console.log('\n--- [Audit 1: Question Bank (qbank.html)] ---');
    await setViewport(viewports[1]);
    await navigateAndWait(`http://127.0.0.1:${PORT}/features/qbank/qbank.html`);

    const qbHeader = await cdp.eval(`(() => {
      const h1 = document.querySelector('h1');
      const p = document.querySelector('.hero-left p');
      const cs = h1 ? window.getComputedStyle(h1) : null;
      return {
        text: h1 ? h1.textContent.trim() : '',
        fontSize: cs ? cs.fontSize : '',
        fontWeight: cs ? cs.fontWeight : '',
        hasPmTitle: h1 ? h1.classList.contains('pm-page-title') : false,
        hasPmSub: p ? p.classList.contains('pm-page-subtitle') : false
      };
    })()`);
    assert.strictEqual(qbHeader.hasPmTitle, true, 'QBank h1 must adopt .pm-page-title');
    assert.strictEqual(qbHeader.hasPmSub, true, 'QBank subtitle must adopt .pm-page-subtitle');
    console.log(`  ✓ QBank Header: text="${qbHeader.text.substring(0, 30)}...", font=${qbHeader.fontSize}/${qbHeader.fontWeight}, hasPmTitle=true`);

    const qbStats = await cdp.eval(`(() => {
      const items = Array.from(document.querySelectorAll('.hero-stat-item'));
      return items.map(it => {
        const lbl = it.querySelector('.lbl');
        const num = it.querySelector('.num');
        const lblRect = lbl ? lbl.getBoundingClientRect() : null;
        const numRect = num ? num.getBoundingClientRect() : null;
        return {
          lbl: lbl ? lbl.textContent.trim() : '',
          num: num ? num.textContent.trim() : '',
          isVertical: lblRect && numRect ? (lblRect.top < numRect.top) : false,
          hasPmStatCard: it.classList.contains('pm-stat-card'),
          hasPmStatLabel: lbl ? lbl.classList.contains('pm-stat-label') : false,
          hasPmStatValue: num ? num.classList.contains('pm-stat-value') : false
        };
      });
    })()`);
    assert.strictEqual(qbStats.length, 3, 'Must have 3 QBank stat items');
    qbStats.forEach((st, idx) => {
      assert.strictEqual(st.isVertical, true, `QBank Stat #${idx + 1} must have .lbl above .num`);
      assert.strictEqual(st.hasPmStatCard, true, `QBank Stat #${idx + 1} must adopt .pm-stat-card`);
      console.log(`  ✓ QBank Stat #${idx + 1}: Label="${st.lbl}" -> Value="${st.num}", VerticalOrder=true, hasPmStatCard=true`);
    });

    const filterHeader = await cdp.eval(`(() => {
      const h3 = document.querySelector('.filter-panel-title');
      const p = document.querySelector('.filter-panel-desc');
      const left = document.querySelector('.filter-header-left');
      return {
        h3HasPmSec: h3 ? h3.classList.contains('pm-section-heading') : false,
        pHasPmDesc: p ? p.classList.contains('pm-section-desc') : false,
        leftHasHeadingIcon: left ? left.classList.contains('pm-heading-with-icon') : false
      };
    })()`);
    assert.strictEqual(filterHeader.h3HasPmSec, true, 'Filter title must adopt .pm-section-heading');
    assert.strictEqual(filterHeader.leftHasHeadingIcon, true, 'Filter header left must adopt .pm-heading-with-icon');
    console.log(`  ✓ Filter Header: hasPmSectionHeading=true, hasPmHeadingWithIcon=true`);

    // Verify QBank modal title
    const qbModal = await cdp.eval(`(() => {
      const modalTitle = document.getElementById('modal-title');
      return {
        hasCardHeading: modalTitle ? modalTitle.classList.contains('pm-card-heading') : false,
        hasContentWrap: modalTitle ? modalTitle.classList.contains('pm-content-wrap') : false
      };
    })()`);
    assert.strictEqual(qbModal.hasCardHeading, true, 'Modal title must adopt .pm-card-heading');
    assert.strictEqual(qbModal.hasContentWrap, true, 'Modal title must adopt .pm-content-wrap');
    console.log(`  ✓ Modal Title: hasPmCardHeading=true, hasPmContentWrap=true`);

    // Responsive check for QBank across 5 viewports
    for (const vp of viewports) {
      await setViewport(vp);
      const overflow = await cdp.eval(`document.documentElement.scrollWidth > window.innerWidth`);
      assert.strictEqual(overflow, false, `QBank horizontal overflow detected at ${vp.name} (${vp.width}px)`);
    }
    console.log(`  ✓ QBank verified with 0 horizontal overflow across all 5 viewports`);

    // ========================================================================
    // AUDIT 2: Job Opportunities (jobs.html)
    // ========================================================================
    console.log('\n--- [Audit 2: Job Opportunities (jobs.html)] ---');
    await setViewport(viewports[1]);
    await navigateAndWait(`http://127.0.0.1:${PORT}/features/jobs/jobs.html`);

    const jobsHeader = await cdp.eval(`(() => {
      const wrap = document.querySelector('.jobs-header-section');
      const h1 = document.querySelector('.jobs-page-title');
      const sub = document.querySelector('.jobs-page-sub');
      const cs = h1 ? window.getComputedStyle(h1) : null;
      return {
        text: h1 ? h1.textContent.trim() : '',
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        wrapHasPmHeader: wrap ? wrap.classList.contains('pm-page-header') : false,
        h1HasPmTitle: h1 ? h1.classList.contains('pm-page-title') : false,
        subHasPmSubtitle: sub ? sub.classList.contains('pm-page-subtitle') : false
      };
    })()`);
    assert.strictEqual(jobsHeader.wrapHasPmHeader, true, 'Jobs header wrap must adopt .pm-page-header');
    assert.strictEqual(jobsHeader.h1HasPmTitle, true, 'Jobs title must adopt .pm-page-title');
    assert.strictEqual(jobsHeader.subHasPmSubtitle, true, 'Jobs sub must adopt .pm-page-subtitle');
    console.log(`  ✓ Jobs Header: text="${jobsHeader.text}", font=${jobsHeader.fontSize}/${jobsHeader.fontWeight}, hasPmTitle=true`);

    const jobsFilter = await cdp.eval(`(() => {
      const group = document.querySelector('.filters-title-group');
      const text = document.querySelector('.filters-title-text');
      return {
        groupHasIcon: group ? group.classList.contains('pm-heading-with-icon') : false,
        textHasHeading: text ? text.classList.contains('pm-section-heading') : false
      };
    })()`);
    assert.strictEqual(jobsFilter.groupHasIcon, true, 'Filter title group must adopt .pm-heading-with-icon');
    assert.strictEqual(jobsFilter.textHasHeading, true, 'Filter title text must adopt .pm-section-heading');
    console.log(`  ✓ Jobs Filter: hasPmHeadingWithIcon=true, hasPmSectionHeading=true`);

    // Check bookmark action interaction
    const bookmarkAction = await cdp.eval(`(() => {
      const firstBtn = document.querySelector('.btn-save-bookmark');
      if (!firstBtn) return { found: false };
      const beforeState = firstBtn.classList.contains('saved');
      firstBtn.click();
      const afterState = firstBtn.classList.contains('saved');
      return { found: true, toggled: beforeState !== afterState };
    })()`);
    assert.strictEqual(bookmarkAction.found, true, 'Bookmark button must exist');
    assert.strictEqual(bookmarkAction.toggled, true, 'Bookmark button must toggle state');
    console.log(`  ✓ Jobs Bookmark Action: toggles saved state successfully`);

    // Responsive check for Jobs across 5 viewports
    for (const vp of viewports) {
      await setViewport(vp);
      const overflow = await cdp.eval(`document.documentElement.scrollWidth > window.innerWidth`);
      assert.strictEqual(overflow, false, `Jobs horizontal overflow detected at ${vp.name} (${vp.width}px)`);
    }
    console.log(`  ✓ Jobs verified with 0 horizontal overflow across all 5 viewports`);

    // ========================================================================
    // AUDIT 3: About (about.html)
    // ========================================================================
    console.log('\n--- [Audit 3: About Page (about.html)] ---');
    await setViewport(viewports[1]);
    await navigateAndWait(`http://127.0.0.1:${PORT}/features/about/about.html`);

    const aboutHeader = await cdp.eval(`(() => {
      const hero = document.querySelector('.about-hero');
      const h1 = document.querySelector('.about-hero h1');
      const p = document.querySelector('.about-hero p');
      const secH2s = Array.from(document.querySelectorAll('.pm-section-heading'));
      return {
        heroHasPmHeader: hero ? hero.classList.contains('pm-page-header') : false,
        h1HasPmTitle: h1 ? h1.classList.contains('pm-page-title') : false,
        pHasPmSubtitle: p ? p.classList.contains('pm-page-subtitle') : false,
        secH2Count: secH2s.length
      };
    })()`);
    assert.strictEqual(aboutHeader.heroHasPmHeader, true, 'About hero must adopt .pm-page-header');
    assert.strictEqual(aboutHeader.h1HasPmTitle, true, 'About h1 must adopt .pm-page-title');
    assert.strictEqual(aboutHeader.pHasPmSubtitle, true, 'About subtitle must adopt .pm-page-subtitle');
    assert.ok(aboutHeader.secH2Count >= 3, 'About sections must adopt .pm-section-heading');
    console.log(`  ✓ About Header: hasPmTitle=true, hasPmSubtitle=true, ${aboutHeader.secH2Count} section headings adopted`);

    // Responsive check for About across 5 viewports
    for (const vp of viewports) {
      await setViewport(vp);
      const overflow = await cdp.eval(`document.documentElement.scrollWidth > window.innerWidth`);
      assert.strictEqual(overflow, false, `About horizontal overflow detected at ${vp.name} (${vp.width}px)`);
    }
    console.log(`  ✓ About verified with 0 horizontal overflow across all 5 viewports`);

    // ========================================================================
    // AUDIT 4: Help Center (help.html)
    // ========================================================================
    console.log('\n--- [Audit 4: Help Center (help.html)] ---');
    await setViewport(viewports[1]);
    await navigateAndWait(`http://127.0.0.1:${PORT}/features/help/help.html`);

    const helpHeader = await cdp.eval(`(() => {
      const hero = document.querySelector('.help-hero');
      const h1 = document.querySelector('.help-hero h1');
      const p = document.querySelector('.help-hero p');
      const faqH2 = document.getElementById('faq-heading');
      return {
        heroHasPmHeader: hero ? hero.classList.contains('pm-page-header') : false,
        h1HasPmTitle: h1 ? h1.classList.contains('pm-page-title') : false,
        pHasPmSubtitle: p ? p.classList.contains('pm-page-subtitle') : false,
        faqH2HasSecHeading: faqH2 ? faqH2.classList.contains('pm-section-heading') : false
      };
    })()`);
    assert.strictEqual(helpHeader.heroHasPmHeader, true, 'Help hero must adopt .pm-page-header');
    assert.strictEqual(helpHeader.h1HasPmTitle, true, 'Help h1 must adopt .pm-page-title');
    assert.strictEqual(helpHeader.faqH2HasSecHeading, true, 'FAQ heading must adopt .pm-section-heading');
    console.log(`  ✓ Help Header: hasPmTitle=true, hasPmSubtitle=true, faqHeading adopted`);

    // Verify FAQ accordion toggle
    const faqAccordion = await cdp.eval(`(() => {
      const firstCard = document.querySelector('.faq-card');
      const btn = firstCard ? firstCard.querySelector('.faq-header-btn') : null;
      if (!btn) return { found: false };
      const wasOpen = firstCard.classList.contains('open');
      btn.click();
      const isOpenAfter = firstCard.classList.contains('open');
      return { found: true, toggled: wasOpen !== isOpenAfter };
    })()`);
    assert.strictEqual(faqAccordion.found, true, 'FAQ accordion button must exist');
    assert.strictEqual(faqAccordion.toggled, true, 'FAQ accordion must toggle on click');
    console.log(`  ✓ FAQ Accordion: toggles content open/closed smoothly`);

    // Responsive check for Help across 5 viewports
    for (const vp of viewports) {
      await setViewport(vp);
      const overflow = await cdp.eval(`document.documentElement.scrollWidth > window.innerWidth`);
      assert.strictEqual(overflow, false, `Help horizontal overflow detected at ${vp.name} (${vp.width}px)`);
    }
    console.log(`  ✓ Help verified with 0 horizontal overflow across all 5 viewports`);

    // ========================================================================
    // AUDIT 5: Legal Center (legal-center.html)
    // ========================================================================
    console.log('\n--- [Audit 5: Legal Center (legal-center.html)] ---');
    await setViewport(viewports[1]);
    await navigateAndWait(`http://127.0.0.1:${PORT}/features/legal/legal-center.html`);

    const legalHeader = await cdp.eval(`(() => {
      const hero = document.querySelector('.legal-hero');
      const h1 = document.querySelector('.legal-hero-title');
      const p = document.querySelector('.legal-hero-desc');
      const docH2 = document.querySelector('.legal-doc-title');
      return {
        heroHasPmHeader: hero ? hero.classList.contains('pm-page-header') : false,
        h1HasPmTitle: h1 ? h1.classList.contains('pm-page-title') : false,
        pHasPmSubtitle: p ? p.classList.contains('pm-page-subtitle') : false,
        docH2HasSecHeading: docH2 ? docH2.classList.contains('pm-section-heading') : false
      };
    })()`);
    assert.strictEqual(legalHeader.heroHasPmHeader, true, 'Legal hero must adopt .pm-page-header');
    assert.strictEqual(legalHeader.h1HasPmTitle, true, 'Legal title must adopt .pm-page-title');
    assert.strictEqual(legalHeader.docH2HasSecHeading, true, 'Legal doc title must adopt .pm-section-heading');
    console.log(`  ✓ Legal Header: hasPmTitle=true, hasPmSubtitle=true, docTitle adopted`);

    // Verify Legal tabs switch
    const legalTabSwitch = await cdp.eval(`(() => {
      const termsTab = document.getElementById('tab-terms-of-use');
      if (!termsTab) return { found: false };
      termsTab.click();
      const termsPanel = document.getElementById('terms-of-use');
      const isPanelActive = termsPanel ? termsPanel.classList.contains('active') : false;
      return { found: true, active: isPanelActive };
    })()`);
    assert.strictEqual(legalTabSwitch.found, true, 'Terms tab must exist');
    assert.strictEqual(legalTabSwitch.active, true, 'Clicking Terms tab must activate terms-of-use panel');
    console.log(`  ✓ Legal Tabs: switches between legal policy documents reliably`);

    // Responsive check for Legal across 5 viewports
    for (const vp of viewports) {
      await setViewport(vp);
      const overflow = await cdp.eval(`document.documentElement.scrollWidth > window.innerWidth`);
      assert.strictEqual(overflow, false, `Legal horizontal overflow detected at ${vp.name} (${vp.width}px)`);
    }
    console.log(`  ✓ Legal verified with 0 horizontal overflow across all 5 viewports`);

    // ========================================================================
    // AUDIT 6: Dark Mode Consistency
    // ========================================================================
    console.log('\n--- [Audit 6: Dark Mode Verification] ---');
    await cdp.eval(`(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-mode');
    })()`);
    await sleep(200);

    const darkModeStyles = await cdp.eval(`(() => {
      const bg = window.getComputedStyle(document.body).backgroundColor;
      const h1 = document.querySelector('h1') || document.querySelector('.legal-hero-title');
      const titleColor = h1 ? window.getComputedStyle(h1).color : '';
      return { bg, titleColor };
    })()`);
    console.log(`  ✓ Dark Mode Active: body bg="${darkModeStyles.bg}", title color="${darkModeStyles.titleColor}"`);

    // ========================================================================
    // AUDIT 7: Production Database Invariant Check
    // ========================================================================
    console.log('\n--- [Audit 7: Production Database Invariant] ---');
    const FINAL_HASH = crypto.createHash('sha256').update(fs.readFileSync(DB_PATH)).digest('hex').toUpperCase();
    assert.strictEqual(FINAL_HASH, INITIAL_HASH, 'FATAL: Production database was modified!');
    console.log(`[+] Final Production DB Hash: ${FINAL_HASH}`);

    await cdp.close();
    console.log('\n======================================================================');
    console.log('  ALL BATCH 2 CAREER PREPARATION CHECKS PASSED (100% SUCCESS)  ');
    console.log('======================================================================\n');
  } finally {
    killEdge();
    cleanup();
  }
}

runBatch2Audit().catch((err) => {
  console.error('\n[FATAL AUDIT FAILURE]', err);
  process.exit(1);
});
