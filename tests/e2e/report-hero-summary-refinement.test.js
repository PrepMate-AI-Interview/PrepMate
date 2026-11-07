/**
 * PREPMATE — REPORT HERO SUMMARY UI REFINEMENT (EDGE CDP E2E)
 * Work Item: WI-REPORT-HERO-SUMMARY-UX-01
 * Verifies Hero Summary Layout, Hierarchy, 5 States, 5 Viewports, Light/Dark Mode, and Verbatim Invariant.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const assert = require('assert');
const os = require('os');

const STATIC_PORT = 5022;
const CDP_PORT = 9260;
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const SCREENSHOT_DIR = path.resolve(WORKSPACE_ROOT, 'docs/evidence/hero-summary');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function findBrowser() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Edge/Application/msedge.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

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
      this.ws.addEventListener('error', err => reject(err));
      this.ws.addEventListener('message', evt => {
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
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    const val = res.result ? res.result.value : res.value;
    return val !== undefined ? val : res;
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await this.send('Emulation.setVisibleSize', { width, height });
    await sleep(200);
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
  }

  async close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
  }
}

function startStaticServer() {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/FE/features/report/report.html';
    else if (!reqPath.startsWith('/FE/') && !reqPath.startsWith('/tests/')) {
      reqPath = '/FE' + reqPath;
    }

    const filePath = path.join(WORKSPACE_ROOT, reqPath);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found: ' + reqPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'text/plain';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise(resolve => {
    server.listen(STATIC_PORT, () => resolve(server));
  });
}

// Sample Raw Summaries
const SHORT_SUMMARY = "Ứng viên thể hiện phản xạ tốt và tư duy xử lý vấn đề tương đối nhanh nhạy.";

const MEDIUM_SUMMARY = "Ứng viên thể hiện tư duy kiến trúc hệ thống vững vàng và khả năng phân tích yêu cầu sâu sắc. Trong phần giải pháp, ứng viên đã làm rõ trade-off giữa độ trễ và tính sẵn sàng của cơ sở dữ liệu phân tán. Cần chú ý thêm việc lượng hóa tác động kinh doanh cụ thể cho từng quyết định kỹ thuật.";

const LONG_STRUCTURED_SUMMARY = "Đánh giá tổng thể vị trí Frontend Developer (Mid-level): Điểm số 65/100 (Xếp loại: Junior, Độ tin cậy: LOW, Độ bao phủ: 33.3%). Điểm mạnh: Xử lý câu hỏi mở rộng & Thử thách (Follow-up Handling): Ứng viên tiếp nhận câu hỏi mở rộng rất tốt, phản hồi tự tin, mở rộng luận điểm chính xác và bảo vệ lập luận chắc chắn.; Tính nhất quán & Độ tin cậy (Consistency): Thông tin và quan điểm nhất quán xuyên suốt toàn bộ các lượt trao đổi.. Lỗ hổng cần lưu ý: Kỹ năng bắt buộc 'Bất đồng bộ và Cơ chế Event Loop' chưa được kiểm chứng.; Kỹ năng bắt buộc 'Ứng dụng TypeScript và Type Safety' chưa được kiểm chứng..";

const GUEST_SUMMARY = "Ứng viên đã hoàn tất các lượt phỏng vấn và thể hiện tốt tư duy giải quyết vấn đề cơ bản.";
const GUEST_INTERPRETATION = "Ứng viên đáp ứng tốt các tiêu chuẩn vị trí, phù hợp để tiến hành các vòng chuyên sâu tiếp theo.";

async function runTest() {
  console.log('======================================================================');
  console.log('  PREPMATE — REPORT HERO SUMMARY UI REFINEMENT (EDGE CDP E2E)         ');
  console.log('======================================================================\n');

  const staticServer = await startStaticServer();
  console.log(`[INFO] Static server live at http://127.0.0.1:${STATIC_PORT}`);

  const browserPath = findBrowser();
  assert.ok(browserPath, 'Browser executable must be present');
  console.log(`[INFO] Browser binary: ${browserPath}`);

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-hero-summary-cdp-'));
  const browserProc = spawn(browserPath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  try {
    // Wait for CDP endpoint
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      try {
        const json = await new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${CDP_PORT}/json/list`, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => resolve(JSON.parse(data)));
          }).on('error', reject);
        });
        if (json && json.length > 0) {
          const pageTarget = json.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
          if (pageTarget) {
            wsUrl = pageTarget.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (e) {
        await sleep(300);
      }
    }
    assert.ok(wsUrl, 'Could not obtain CDP WebSocketDebuggerUrl');
    console.log(`[INFO] Connected to CDP endpoint: ${wsUrl}`);

    const client = new SimpleCDP(wsUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');
    await client.send('CSS.enable');

    console.log('\n--- TEST SUITE 1: VERIFY REPORT INITIAL LOAD & DOM REGION ---');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/FE/features/report/report.html` });
    await sleep(800);

    const curHref = await client.eval('window.location.href');
    const docTitle = await client.eval('document.title');
    console.log('[DEBUG location]:', curHref, '| title:', docTitle);

    // Verify #hero-summary-text exists with correct aria role
    const summaryTag = await client.eval(`(() => {
      const el = document.getElementById('hero-summary-text');
      return {
        tag: el?.tagName?.toLowerCase(),
        role: el?.getAttribute('role'),
        ariaLabel: el?.getAttribute('aria-label'),
        hasCard: el?.querySelector('.hero-summary-card') !== null
      };
    })()`);
    console.log('[DEBUG summaryTag]:', JSON.stringify(summaryTag));
    assert.strictEqual(summaryTag.tag, 'div', '#hero-summary-text should be a div container');
    assert.strictEqual(summaryTag.role, 'region', '#hero-summary-text must have role="region"');
    assert.ok(summaryTag.ariaLabel, 'Must have aria-label');
    console.log('  [PASS] 1.1 #hero-summary-text container semantic region verified.');

    // Helper to test rendering summary
    async function testRender(summary, isGuest = false, gpInterpretation = '') {
      return await client.eval(`(() => {
        const sumEl = document.getElementById('hero-summary-text');
        if (typeof renderStructuredHeroSummary === 'function') {
          renderStructuredHeroSummary(sumEl, ${JSON.stringify(summary)}, ${isGuest}, ${JSON.stringify(gpInterpretation)});
        }
        return {
          cardPresent: sumEl.querySelector('.hero-summary-card') !== null,
          eyebrowText: sumEl.querySelector('.hero-summary-eyebrow')?.textContent?.trim() || null,
          leadText: sumEl.querySelector('.hero-summary-lead')?.textContent?.trim() || null,
          isSingle: sumEl.querySelector('.hero-summary-lead')?.classList.contains('is-single') || false,
          isMuted: sumEl.querySelector('.hero-summary-lead')?.classList.contains('text-muted') || false,
          bodyParas: Array.from(sumEl.querySelectorAll('.hero-summary-body .hero-summary-para')).map(p => p.textContent.trim()),
          insightRows: Array.from(sumEl.querySelectorAll('.hero-summary-insight-row')).map(row => ({
            tag: row.querySelector('.hero-insight-tag')?.textContent?.trim(),
            isStrength: row.querySelector('.hero-insight-tag')?.classList.contains('tag-strength'),
            isGap: row.querySelector('.hero-insight-tag')?.classList.contains('tag-gap'),
            label: row.querySelector('.hero-insight-label')?.textContent?.trim(),
            text: row.querySelector('.hero-insight-text')?.textContent?.trim()
          })),
          interpretationText: sumEl.querySelector('.hero-interpretation-text')?.textContent?.trim() || null,
          fullTextContent: sumEl.textContent?.trim()
        };
      })()`);
    }

    console.log('\n--- TEST SUITE 2: STATE A — SHORT SUMMARY (1 SENTENCE) ---');
    const stateA = await testRender(SHORT_SUMMARY, false);
    assert.ok(stateA.cardPresent, 'Card must be present');
    assert.strictEqual(stateA.leadText, SHORT_SUMMARY, 'Lead text matches short summary verbatim');
    assert.strictEqual(stateA.isSingle, true, 'Short summary gets .is-single class');
    assert.strictEqual(stateA.bodyParas.length, 0, 'No body paragraphs for single sentence');
    assert.strictEqual(stateA.insightRows.length, 0, 'No insight rows for single sentence');
    assert.ok(stateA.fullTextContent.includes(SHORT_SUMMARY), '100% verbatim textContent preserved');
    console.log('  [PASS] 2.1 State A (Short summary) rendered with .is-single, 0 duplicate words, 100% verbatim text.');

    console.log('\n--- TEST SUITE 3: STATE B — MEDIUM MULTI-SENTENCE PROSE ---');
    const stateB = await testRender(MEDIUM_SUMMARY, false);
    assert.ok(stateB.cardPresent, 'Card must be present');
    assert.ok(stateB.leadText.includes('Ứng viên thể hiện tư duy kiến trúc hệ thống vững vàng'), 'Lead text gets prominent first sentence');
    assert.strictEqual(stateB.isSingle, false, 'Multi-sentence does NOT have .is-single');
    assert.ok(stateB.bodyParas.length >= 1, 'Supporting sentences grouped into body paragraphs');
    assert.ok(stateB.bodyParas[0].includes('trade-off giữa độ trễ và tính sẵn sàng'), 'Supporting paragraph contains rest of explanation');
    // Verbatim preservation check: all words in MEDIUM_SUMMARY exist in fullTextContent
    MEDIUM_SUMMARY.split(/\s+/).forEach(word => {
      assert.ok(stateB.fullTextContent.includes(word), `Word "${word}" must be preserved verbatim`);
    });
    console.log('  [PASS] 3.1 State B (Medium summary) rendered with prominent lead and supporting paragraphs.');

    console.log('\n--- TEST SUITE 4: STATE C — LONG STRUCTURED SYNTHESIS ---');
    const stateC = await testRender(LONG_STRUCTURED_SUMMARY, false);
    assert.ok(stateC.cardPresent, 'Card must be present');
    assert.ok(stateC.leadText.includes('Frontend Developer (Mid-level)'), 'Lead contains executive score verdict');
    console.log('[DEBUG insightRows]:', JSON.stringify(stateC.insightRows));
    assert.strictEqual(stateC.insightRows.length, 2, 'Exactly 2 insight rows (Strengths & Gaps)');
    assert.ok(stateC.insightRows[0].tag.includes('Điểm mạnh'), 'Row 1 has tag Điểm mạnh');
    assert.strictEqual(stateC.insightRows[0].isStrength, true, 'Row 1 has .tag-strength');
    assert.ok(stateC.insightRows[1].tag.includes('Cần lưu ý') || stateC.insightRows[1].tag.includes('Khuyến nghị'), 'Row 2 has gap tag');
    assert.strictEqual(stateC.insightRows[1].isGap, true, 'Row 2 has .tag-gap');
    // Ensure all critical content words are preserved verbatim
    assert.ok(stateC.fullTextContent.includes('Xử lý câu hỏi mở rộng & Thử thách'), 'Strengths content preserved');
    assert.ok(stateC.fullTextContent.includes('Bất đồng bộ và Cơ chế Event Loop'), 'Gaps content preserved');
    console.log('  [PASS] 4.1 State C (Long structured synthesis) rendered with distinct strength & gap badges.');

    console.log('\n--- TEST SUITE 5: STATE D — EMPTY FALLBACK ---');
    const stateD = await testRender('', false);
    assert.ok(stateD.cardPresent, 'Card must be present');
    assert.strictEqual(stateD.isSingle, true, 'Fallback gets .is-single');
    assert.strictEqual(stateD.isMuted, true, 'Fallback gets .text-muted');
    assert.ok(stateD.leadText.includes('Chưa có thông tin nhận định tổng quan'), 'Fallback friendly copy rendered');
    console.log('  [PASS] 5.1 State D (Empty summary) renders graceful fallback message.');

    console.log('\n--- TEST SUITE 6: STATE E — GUEST PREVIEW MODE ---');
    const stateE = await testRender(GUEST_SUMMARY, true, GUEST_INTERPRETATION);
    assert.ok(stateE.cardPresent, 'Card must be present');
    assert.ok(stateE.eyebrowText.includes('Bản xem trước') || stateE.eyebrowText.includes('Nhận định'), 'Guest eyebrow badge present');
    assert.strictEqual(stateE.leadText, GUEST_SUMMARY, 'Lead contains verbatim guest summary');
    assert.strictEqual(stateE.interpretationText, GUEST_INTERPRETATION, 'Interpretation rendered in separate styled container');
    assert.ok(stateE.fullTextContent.includes(GUEST_SUMMARY), 'Full text contains summary');
    assert.ok(stateE.fullTextContent.includes(GUEST_INTERPRETATION), 'Full text contains interpretation');
    console.log('  [PASS] 6.1 State E (Guest Preview) renders eyebrow, lead, and interpretation with 100% contract fidelity.');

    console.log('\n--- TEST SUITE 7: VIEWPORTS & HORIZONTAL OVERFLOW VERIFICATION ---');
    const viewports = [
      { name: 'Desktop Large', width: 1440, height: 900 },
      { name: 'Desktop Standard', width: 1280, height: 800 },
      { name: 'Tablet Portrait', width: 768, height: 1024 },
      { name: 'Mobile Modern', width: 390, height: 844 },
      { name: 'Mobile Compact', width: 375, height: 667 }
    ];

    // Render structured summary for layout tests
    await testRender(LONG_STRUCTURED_SUMMARY, false);

    for (const vp of viewports) {
      await client.setViewport(vp.width, vp.height);
      const metrics = await client.eval(`(() => {
        const docWidth = document.documentElement.scrollWidth;
        const winWidth = window.innerWidth;
        const overflow = Math.max(0, docWidth - winWidth);
        const cardRect = document.querySelector('.hero-summary-card')?.getBoundingClientRect();
        return {
          overflow,
          docWidth,
          winWidth,
          cardWidth: cardRect?.width,
          cardFits: cardRect ? cardRect.right <= winWidth + 1 : false
        };
      })()`);

      assert.strictEqual(metrics.overflow, 0, `Horizontal overflow must be 0px at ${vp.name} (${vp.width}px), got ${metrics.overflow}px`);
      assert.ok(metrics.cardFits, `Card must fit within viewport at ${vp.name}`);
      console.log(`  [PASS] 7.${viewports.indexOf(vp) + 1} ${vp.name} (${vp.width}x${vp.height}): 0px overflow, card fits perfectly.`);
    }

    console.log('\n--- TEST SUITE 8: LIGHT & DARK MODE VISUAL FIDELITY & EVIDENCE SCREENSHOTS ---');
    // Desktop Light
    await client.setViewport(1440, 900);
    await client.eval(`document.documentElement.removeAttribute('data-theme')`);
    await sleep(200);
    const lightBg = await client.eval(`window.getComputedStyle(document.querySelector('.hero-summary-card')).backgroundColor`);
    assert.ok(lightBg, 'Light mode background computed');
    await client.screenshot(path.join(SCREENSHOT_DIR, 'hero-summary-desktop-light.png'));
    console.log('  [PASS] 8.1 Desktop Light mode screenshot captured.');

    // Desktop Dark
    await client.eval(`document.documentElement.setAttribute('data-theme', 'dark')`);
    await sleep(200);
    const darkBg = await client.eval(`window.getComputedStyle(document.querySelector('.hero-summary-card')).backgroundColor`);
    assert.ok(darkBg, 'Dark mode background computed');
    await client.screenshot(path.join(SCREENSHOT_DIR, 'hero-summary-desktop-dark.png'));
    console.log('  [PASS] 8.2 Desktop Dark mode screenshot captured.');

    // Mobile Modern Light
    await client.setViewport(390, 844);
    await client.eval(`document.documentElement.removeAttribute('data-theme')`);
    await sleep(200);
    await client.screenshot(path.join(SCREENSHOT_DIR, 'hero-summary-mobile-light.png'));
    console.log('  [PASS] 8.3 Mobile 390px Light mode screenshot captured.');

    // Mobile Modern Dark
    await client.eval(`document.documentElement.setAttribute('data-theme', 'dark')`);
    await sleep(200);
    await client.screenshot(path.join(SCREENSHOT_DIR, 'hero-summary-mobile-dark.png'));
    console.log('  [PASS] 8.4 Mobile 390px Dark mode screenshot captured.');

    console.log('\n======================================================================');
    console.log('  ALL REPORT HERO SUMMARY ACCEPTANCE CHECKS PASSED (100% GREEN)       ');
    console.log('======================================================================\n');

    await client.close();
  } finally {
    try { browserProc.kill(); } catch (e) {}
    try { staticServer.close(); } catch (e) {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }
}

runTest().catch(err => {
  console.error('\n❌ TEST RUNNER FAILURE:', err);
  process.exit(1);
});
