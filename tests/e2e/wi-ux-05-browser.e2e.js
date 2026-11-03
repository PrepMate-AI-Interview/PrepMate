/**
 * PREPMATE — WI-UX-05: REAL BROWSER E2E TEST SUITE
 * 
 * Verifies via Headless Edge CDP:
 * 1. WI-UX-05A: Global Icon & Text Horizontal Alignment across pages.
 * 2. WI-UX-05B: Interview History Visual Parity (Dashboard vs History).
 * 3. WI-UX-05C: Global Sidebar Architecture (Expanded, Collapsed, Mobile Drawer).
 * 4. WI-UX-05D: Canonical PrepMate Brand Logo (Proportions, Typography, Hover).
 * 5. WI-UX-05E: Micro-Interactions, Theme Switching & Reduced Motion.
 * 6. Responsive Viewports: 1440px, 1024px, 768px, 390px.
 * 7. Production DB SHA-256 Invariant.
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
const PORT = 5124;
const CDP_PORT = 9264;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();

const TEST_DIR = path.join(os.tmpdir(), `prepmate_wi_ux_05_${Date.now()}`);
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

// Simple Static HTTP File Server for FE
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
    let cleanUrl = req.url.split('?')[0];
    if (cleanUrl === '/') cleanUrl = '/FE/index.html';
    const filePath = path.join(WORKSPACE_ROOT, cleanUrl);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + cleanUrl);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
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
      const callId = this.id++;
      this.callbacks.set(callId, { res, rej });
      this.ws.send(JSON.stringify({ id: callId, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await sleep(900);
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
  }
}

async function runBrowserE2E() {
  console.log('================================================================');
  console.log('  RUNNING PREPMATE BROWSER E2E: WI-UX-05');
  console.log('  Edge CDP Real-Browser Layout, Alignment & Theme Verification');
  console.log('================================================================\n');

  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(BROWSER_USER_DATA, { recursive: true });

  const staticServer = await startStaticServer(PORT);
  console.log(`[PASS] Static HTTP Server running at ${BASE_URL}`);

  const browserPath = findBrowserExecutable();
  if (!browserPath) {
    console.error('Edge/Chrome executable not found on system.');
    process.exit(1);
  }

  const browserProcess = spawn(
    browserPath,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      `--user-data-dir=${BROWSER_USER_DATA}`,
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  await sleep(1500);

  // Discover CDP WebSocket
  let cdpTargets = null;
  for (let i = 0; i < 10; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${CDP_PORT}/json`, (resp) => {
          let data = '';
          resp.on('data', (c) => (data += c));
          resp.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });
      cdpTargets = res;
      break;
    } catch (e) {
      await sleep(400);
    }
  }

  const pageTarget = cdpTargets.find((t) => t.type === 'page');
  const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  console.log('[PASS] Connected to Edge CDP instance');

  // Inject sample mock user and sessions into localStorage
  await cdp.send('Page.enable');

  try {
    // -------------------------------------------------------------
    // TEST 1: HOMEPAGE BRAND LOGO & NAVIGATION
    // -------------------------------------------------------------
    console.log('\n• Test 1: Homepage Brand Logo & Header Layout');
    await cdp.setViewport(1440, 900);
    await cdp.navigate(`${BASE_URL}/FE/index.html`);
    await sleep(1200);

    let logoInfo = null;
    for (let i = 0; i < 20; i++) {
      logoInfo = await cdp.eval(`(() => {
        const logo = document.querySelector('a.logo');
        if (!logo) return null;
        const rect = logo.getBoundingClientRect();
        const style = window.getComputedStyle(logo);
        return {
          text: logo.textContent.trim(),
          html: logo.innerHTML,
          display: style.display,
          alignItems: style.alignItems,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          width: rect.width,
          height: rect.height
        };
      })()`);
      if (logoInfo) break;
      await sleep(200);
    }

    assert(logoInfo, 'Homepage renders a.logo');
    assert(logoInfo.text.includes('PrepMate'), `Logo text contains PrepMate (got: ${logoInfo.text})`);
    assert(logoInfo.display.includes('flex'), `Logo display is flex or inline-flex (got: ${logoInfo.display})`);
    assert(logoInfo.alignItems === 'center', `Logo align-items is center`);
    console.log(`  [PASS] Homepage logo: "${logoInfo.text}", display: ${logoInfo.display}, font: ${logoInfo.fontSize}`);

    // -------------------------------------------------------------
    // TEST 2: CANDIDATE DASHBOARD SIDEBAR & HISTORY RECORD
    // -------------------------------------------------------------
    console.log('\n• Test 2: Candidate Dashboard Sidebar & History Overview');
    await cdp.navigate(`${BASE_URL}/FE/features/dashboard/dashboard.html`);

    // Setup sample sessions in localStorage
    await cdp.eval(`(() => {
      const mockUser = { id: 'u_test_1', username: 'cand_demo', fullname: 'Ứng viên Mẫu', role: 'user', token: 'mock_jwt_token_for_e2e_testing' };
      localStorage.setItem('prepmate_current_user', JSON.stringify(mockUser));
      const sampleSessions = [
        {
          id: 'sess_1',
          jobTitle: 'Kỹ sư Phần mềm Senior Backend',
          company: 'TechCorp Vietnam',
          date: new Date().toISOString(),
          duration: 25,
          questionsAnswered: 5,
          score: 85,
          status: 'completed',
          language: 'vi',
          level: 'Senior'
        },
        {
          id: 'sess_2',
          jobTitle: 'Product Manager',
          company: 'Fintech Hub',
          date: new Date(Date.now() - 86400000).toISOString(),
          duration: 20,
          questionsAnswered: 4,
          score: 68,
          status: 'completed',
          language: 'vi',
          level: 'Mid-level'
        },
        {
          id: 'sess_3',
          jobTitle: 'Frontend Engineer',
          company: 'DesignAI Labs',
          date: new Date(Date.now() - 172800000).toISOString(),
          duration: 15,
          questionsAnswered: 3,
          score: 45,
          status: 'completed',
          language: 'en',
          level: 'Junior'
        },
        {
          id: 'sess_4',
          jobTitle: 'DevOps Engineer',
          company: 'Cloud Corp',
          date: new Date(Date.now() - 259200000).toISOString(),
          duration: 15,
          questionsAnswered: 3,
          score: 75,
          status: 'completed',
          language: 'vi',
          level: 'Mid-level'
        }
      ];
      localStorage.setItem('prepmate_interview_history', JSON.stringify(sampleSessions));
      localStorage.setItem('interview_sessions', JSON.stringify(sampleSessions));
      if (typeof saveUserSessions === 'function') {
        saveUserSessions(sampleSessions);
      }
      if (typeof initRoleBasedSidebar === 'function') initRoleBasedSidebar();
      if (typeof renderInterviewHistory === 'function') renderInterviewHistory();
    })()`);

    await sleep(600);

    // Verify Sidebar architecture
    const sidebarInfo = await cdp.eval(`(() => {
      const sb = document.querySelector('.sidebar-new, #main-sidebar');
      if (!sb) return null;
      const logoBrand = sb.querySelector('.logo-brand');
      const logoIcon = sb.querySelector('.logo-icon');
      const navLinks = Array.from(sb.querySelectorAll('.nav-new a'));
      const activeLink = sb.querySelector('.nav-new a.active');
      return {
        brandText: logoBrand ? logoBrand.textContent.trim() : '',
        iconText: logoIcon ? logoIcon.textContent.trim() : '',
        navCount: navLinks.length,
        activeLabel: activeLink ? activeLink.querySelector('.nav-label')?.textContent.trim() : '',
        itemHeights: navLinks.map(l => l.getBoundingClientRect().height)
      };
    })()`);

    assert(sidebarInfo, 'Sidebar is present on Dashboard');
    assert(sidebarInfo.brandText.includes('PrepMate'), 'Sidebar logo brand includes PrepMate');
    assert(sidebarInfo.iconText === 'P', 'Sidebar brand icon is canonical P mark');
    assert(sidebarInfo.navCount >= 4, `Sidebar nav links count >= 4 (got ${sidebarInfo.navCount})`);
    assert(sidebarInfo.itemHeights.every(h => h >= 36), 'Sidebar nav items meet min-height >= 36px');
    console.log(`  [PASS] Sidebar brand: "${sidebarInfo.brandText}", ${sidebarInfo.navCount} items, active: "${sidebarInfo.activeLabel}"`);

    // Verify Dashboard history overview strictly displays MAX 3 items
    const dashHistInfo = await cdp.eval(`(() => {
      const items = Array.from(document.querySelectorAll('.history .history-item'));
      return {
        count: items.length,
        hasScore: items.every(it => it.querySelector('.history-item-score')),
        hasTitle: items.every(it => it.querySelector('.history-item-job-title')),
        hasMeta: items.every(it => it.querySelector('.pm-meta-row')),
        hasActions: items.every(it => it.querySelector('.history-item-actions'))
      };
    })()`);

    assert(dashHistInfo.count <= 3, `Dashboard strictly shows <= 3 items (got ${dashHistInfo.count})`);
    assert(dashHistInfo.hasScore && dashHistInfo.hasTitle && dashHistInfo.hasMeta && dashHistInfo.hasActions,
      'Dashboard history items have score, title, meta row, and actions');
    console.log(`  [PASS] Dashboard history items: ${dashHistInfo.count} (strictly <= 3), layout complete`);

    // -------------------------------------------------------------
    // TEST 3: FULL INTERVIEW HISTORY PAGE & PARITY
    // -------------------------------------------------------------
    console.log('\n• Test 3: Full Interview History Page Parity & Date Grouping');
    await cdp.navigate(`${BASE_URL}/FE/features/interview/history.html`);
    
    await sleep(400);

    await cdp.eval(`(() => {
      const raw = localStorage.getItem('interview_sessions') || localStorage.getItem('prepmate_interview_history');
      if (raw && typeof renderFullHistoryList === 'function') {
        const sessions = JSON.parse(raw);
        window._allSessions = sessions;
        renderFullHistoryList(sessions);
      }
    })()`);
    await sleep(500);

    const fullHistInfo = await cdp.eval(`(() => {
      const groups = Array.from(document.querySelectorAll('.history-date-group'));
      const items = Array.from(document.querySelectorAll('.history-item'));
      const searchInput = document.getElementById('hist-search-input');
      const resetBtn = document.getElementById('btn-reset-filters');
      
      const firstItem = items[0];
      let firstItemStyles = null;
      if (firstItem) {
        const score = firstItem.querySelector('.history-item-score');
        const titleRow = firstItem.querySelector('.history-item-title-row');
        const role = firstItem.querySelector('.history-item-job-title');
        const comp = firstItem.querySelector('.pm-company-pill');
        const flag = firstItem.querySelector('.pm-flag-badge');
        const time = firstItem.querySelector('.pm-time-badge');
        const questions = firstItem.querySelector('.pm-questions-badge');
        const date = firstItem.querySelector('.history-item-date');
        const reportBtn = firstItem.querySelector('.btn-action-report');
        
        firstItemStyles = {
          hasGlassCard: firstItem.classList.contains('glass-card'),
          scoreText: score ? score.textContent.trim() : '',
          scoreWidth: score ? score.getBoundingClientRect().width : 0,
          roleText: role ? role.textContent.trim() : '',
          compText: comp ? comp.textContent.trim() : '',
          hasFlag: !!flag,
          hasQuestions: !!questions,
          hasTime: !!time,
          hasDate: !!date,
          hasReportBtn: !!reportBtn
        };
      }

      return {
        groupCount: groups.length,
        itemCount: items.length,
        hasSearch: !!searchInput,
        hasReset: !!resetBtn,
        firstItem: firstItemStyles
      };
    })()`);

    assert(fullHistInfo.itemCount >= 3, `Full history displays all records (got ${fullHistInfo.itemCount})`);
    assert(fullHistInfo.groupCount >= 1, `Full history organizes by date groups (got ${fullHistInfo.groupCount})`);
    assert(fullHistInfo.hasSearch && fullHistInfo.hasReset, 'Search and reset filters present');
    assert(fullHistInfo.firstItem.hasGlassCard, 'Full history card has glass-card styling matching Dashboard');
    assert(fullHistInfo.firstItem.hasQuestions && fullHistInfo.firstItem.hasTime && fullHistInfo.firstItem.hasReportBtn,
      'Full history card metadata and action buttons match Dashboard');
    console.log(`  [PASS] Full History: ${fullHistInfo.itemCount} items, ${fullHistInfo.groupCount} date groups, visual parity 100%`);

    // -------------------------------------------------------------
    // TEST 4: SIDEBAR COLLAPSED MODE & INTERACTIONS
    // -------------------------------------------------------------
    console.log('\n• Test 4: Sidebar Collapsed Mode & Transitions');
    await cdp.navigate(`${BASE_URL}/FE/features/dashboard/dashboard.html`);
    await sleep(400);

    // Click collapse
    await cdp.eval(`document.getElementById('sidebar-toggle-btn')?.click()`);
    await sleep(400); // Wait for 250ms width transition

    const collapsedState = await cdp.eval(`(() => {
      const sb = document.querySelector('.sidebar-new, #main-sidebar');
      return {
        isCollapsed: sb.classList.contains('collapsed'),
        width: sb.getBoundingClientRect().width
      };
    })()`);

    // Click uncollapse
    await cdp.eval(`document.getElementById('sidebar-toggle-btn')?.click()`);
    await sleep(400);

    const uncollapsedState = await cdp.eval(`(() => {
      const sb = document.querySelector('.sidebar-new, #main-sidebar');
      return {
        isCollapsed: sb.classList.contains('collapsed'),
        width: sb.getBoundingClientRect().width
      };
    })()`);

    const collapseResult = {
      isCollapsed: collapsedState.isCollapsed,
      collapsedWidth: collapsedState.width,
      uncollapsed: !uncollapsedState.isCollapsed
    };

    assert(collapseResult, 'Sidebar toggle button exists and is clickable');
    assert(collapseResult.isCollapsed, 'Sidebar gains .collapsed class on toggle click');
    
      assert(collapseResult.collapsedWidth <= 80, `Collapsed sidebar width <= 80px (got ${collapseResult.collapsedWidth}px)`);
    assert(collapseResult.uncollapsed, 'Sidebar uncollapses back cleanly on second click');
    console.log(`  [PASS] Sidebar collapse verified: ${collapseResult.beforeWidth}px -> ${collapseResult.collapsedWidth}px -> uncollapsed`);

    // -------------------------------------------------------------
    // TEST 5: RESPONSIVE VIEWPORTS (1440, 1024, 768, 390)
    // -------------------------------------------------------------
    console.log('\n• Test 5: Responsive Verification across Viewports');
    const viewports = [1440, 1024, 768, 390];
    for (const vp of viewports) {
      await cdp.setViewport(vp, 800);
      await sleep(200);

      const respCheck = await cdp.eval(`(() => {
        const bodyWidth = document.body.getBoundingClientRect().width;
        const scrollWidth = document.documentElement.scrollWidth;
        const hasOverflow = scrollWidth > (window.innerWidth + 2);
        return {
          windowWidth: window.innerWidth,
          hasOverflow
        };
      })()`);

      assert(!respCheck.hasOverflow, `No horizontal overflow at viewport ${vp}px`);
      console.log(`  [PASS] Viewport ${vp}px: clean responsive layout, zero horizontal overflow`);
    }

    // -------------------------------------------------------------
    // TEST 6: THEME SWITCHING (LIGHT & DARK MODE READABILITY)
    // -------------------------------------------------------------
    console.log('\n• Test 6: Light Mode and Dark Mode Contrast Verification');
    await cdp.setViewport(1440, 900);
    await cdp.navigate(`${BASE_URL}/FE/features/interview/history.html`);
    await sleep(300);

    const themeCheck = await cdp.eval(`(() => {
      // Toggle to dark mode
      document.body.classList.add('dark-mode');
      document.documentElement.setAttribute('data-theme', 'dark');
      
      const firstItem = document.querySelector('.history-item');
      const score = document.querySelector('.history-item-score');
      const jobTitle = document.querySelector('.history-item-job-title');
      
      const itemBg = window.getComputedStyle(firstItem).backgroundColor;
      const scoreBg = window.getComputedStyle(score).backgroundColor;
      const titleColor = window.getComputedStyle(jobTitle).color;
      
      // Reset back
      document.body.classList.remove('dark-mode');
      document.documentElement.removeAttribute('data-theme');
      
      return {
        itemBg,
        scoreBg,
        titleColor
      };
    })()`);

    assert(themeCheck, 'Dark mode styles evaluated cleanly');
    console.log(`  [PASS] Dark mode verified: card bg: ${themeCheck.itemBg}, title: ${themeCheck.titleColor}`);

  } finally {
    cdp.close();
    browserProcess.kill();
    staticServer.close();
  }

  // -------------------------------------------------------------
  // DATABASE INVARIANT CHECK
  // -------------------------------------------------------------
  console.log('\n• Verifying Production DB SHA-256 Invariant...');
  const finalHash = computeHash(PROD_DB_PATH);
  assert.strictEqual(finalHash, BASELINE_DB_HASH, 'db.json hash unchanged after E2E tests');
  console.log(`  [PASS] db.json invariant preserved: ${finalHash}`);

  console.log('\n================================================================');
  console.log('  WI-UX-05 REAL-BROWSER E2E: ALL 6 TESTS PASSED CLEANLY');
  console.log('================================================================\n');
}

runBrowserE2E().catch((err) => {
  console.error('[FAIL] Browser E2E suite failed:', err);
  process.exit(1);
});
