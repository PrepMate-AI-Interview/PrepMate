/**
 * PREPMATE — REPORT OVERALL ASSESSMENT REFINEMENT (EDGE CDP E2E)
 * Work Item: WI-REPORT-OVERALL-ASSESSMENT-UX-01
 * Verifies:
 * 1. Executive Heading "Nhận định tổng thể" (Eyebrow, Icon, Accessible Label)
 * 2. State A: Single short sentence (Lead weighted, .is-single, 0 duplicate words, 0 expand btn)
 * 3. State B: Medium narrative prose (Prominent lead + clean supporting paragraphs)
 * 4. State C: Elimination of mechanical boilerplate / score / position duplication; No mini sub-cards; Expand/Collapse interactive toggle
 * 5. State D: Graceful empty fallback
 * 6. State E: Guest Preview protection (teaser only, no data leaks)
 * 7. Multi-viewport validation (1440, 1280, 768, 390, 375px) with 0px overflow
 * 8. Light & Dark mode visual evidence capture
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const assert = require('assert');
const os = require('os');

const STATIC_PORT = 5026;
const CDP_PORT = 9264;
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const SCREENSHOT_DIR = path.resolve(WORKSPACE_ROOT, 'docs/evidence/overall-assessment');
const ARTIFACT_DIR = path.resolve('C:/Users/hungd/.gemini/antigravity/brain/f610d5b5-1bc7-401f-b150-db10fc554d9f/evidence-overall-assessment');

[SCREENSHOT_DIR, ARTIFACT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

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
    this.ws = new WS(this.wsUrl);

    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = msg => {
        const data = JSON.parse(msg.data);
        if (data.id && this.pending.has(data.id)) {
          const { res, rej } = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (data.error) rej(data.error);
          else res(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
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
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filePath, buf);
    const basename = path.basename(filePath);
    const artifactPath = path.join(ARTIFACT_DIR, basename);
    fs.writeFileSync(artifactPath, buf);
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

// Test Data Sets
const STATE_A_SHORT = "Ứng viên thể hiện phản xạ tốt và tư duy xử lý vấn đề kỹ thuật tương đối nhanh nhạy.";

const STATE_B_MEDIUM = "Ứng viên thể hiện tư duy kiến trúc hệ thống vững vàng và khả năng phân tích yêu cầu sâu sắc. Trong phần giải pháp, ứng viên đã làm rõ trade-off giữa độ trễ và tính sẵn sàng của cơ sở dữ liệu phân tán. Cần chú ý thêm việc lượng hóa tác động kinh doanh cụ thể cho từng quyết định kỹ thuật.";

const STATE_C_LONG_BOILERPLATE = "Đánh giá tổng thể vị trí Frontend Developer (Mid-level): Điểm số 78/100 (Xếp loại: Good, Độ tin cậy: High, Độ bao phủ: 85%). Điểm mạnh: Xử lý câu hỏi mở rộng & Thử thách kỹ thuật tốt; khả năng phân tích sự cố và tư duy debug hệ thống mạch lạc. Lỗ hổng cần lưu ý: Bất đồng bộ và Cơ chế Event Loop trong Node.js cần được đào sâu và minh chứng rõ ràng hơn trong các tình huống thực tế.";

const STATE_E_GUEST_SUMMARY = "Ứng viên đã hoàn tất các lượt phỏng vấn và thể hiện tốt tư duy giải quyết vấn đề cơ bản.";
const STATE_E_GUEST_INTERPRETATION = "Đăng nhập để xem toàn bộ phân tích chi tiết, điểm số và kế hoạch hành động.";

async function runTest() {
  console.log('======================================================================');
  console.log('  PREPMATE — REPORT OVERALL ASSESSMENT REFINEMENT (EDGE CDP E2E)       ');
  console.log('======================================================================\n');

  const staticServer = await startStaticServer();
  console.log(`[INFO] Static server live at http://127.0.0.1:${STATIC_PORT}`);

  const browserPath = findBrowser();
  assert.ok(browserPath, 'Browser executable must be present');
  console.log(`[INFO] Browser binary: ${browserPath}`);

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-overall-assess-cdp-'));
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
      } catch (e) {}
      await sleep(200);
    }

    assert.ok(wsUrl, 'CDP WebSocket URL must be discovered');
    console.log(`[INFO] Connected to CDP WebSocket: ${wsUrl}`);

    const cdp = new SimpleCDP(wsUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');

    console.log('\n--- NAVIGATING TO REPORT PAGE ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/FE/features/report/report.html` });
    await sleep(1500);

    const testRender = async (summaryText, isGuest = false, guestInterp = null, perf = null, report = null, ev = null) => {
      return await cdp.eval(`
        (() => {
          const sumEl = document.getElementById("hero-summary-text");
          renderStructuredHeroSummary(
            sumEl,
            ${JSON.stringify(summaryText)},
            ${JSON.stringify(isGuest)},
            ${JSON.stringify(guestInterp)},
            ${JSON.stringify(perf)},
            ${JSON.stringify(report)},
            ${JSON.stringify(ev)}
          );
          const card = sumEl.querySelector(".hero-summary-card");
          const eyebrow = sumEl.querySelector(".hero-summary-eyebrow span");
          const lead = sumEl.querySelector(".hero-summary-lead");
          const body = sumEl.querySelector(".hero-summary-body");
          const bodyParas = Array.from(sumEl.querySelectorAll(".hero-summary-para")).map(p => p.textContent.trim());
          const insightRows = sumEl.querySelectorAll(".hero-summary-insight-row");
          const expandBtn = sumEl.querySelector("#btn-expand-hero-summary");
          const interp = sumEl.querySelector(".hero-interpretation-text");

          return {
            cardPresent: Boolean(card),
            eyebrowText: eyebrow ? eyebrow.textContent.trim() : "",
            ariaLabel: sumEl.getAttribute("aria-label"),
            leadText: lead ? lead.textContent.trim() : "",
            leadIsSingle: lead ? lead.classList.contains("is-single") : false,
            bodyPresent: Boolean(body),
            bodyIsClamped: body ? body.classList.contains("is-clamped") : false,
            bodyIsExpanded: body ? body.classList.contains("is-expanded") : false,
            bodyParas,
            insightRowsCount: insightRows.length,
            expandBtnPresent: Boolean(expandBtn),
            expandBtnText: expandBtn ? expandBtn.textContent.trim() : "",
            interpText: interp ? interp.textContent.trim() : "",
            fullTextContent: sumEl.textContent
          };
        })()
      `);
    };

    console.log('\n--- TEST SUITE 1: CANONICAL DOM STRUCTURE & ACCESSIBLE EYEBROW ---');
    const initialDOM = await cdp.eval(`
      (() => {
        const sumEl = document.getElementById("hero-summary-text");
        return {
          ariaLabel: sumEl.getAttribute("aria-label")
        };
      })()
    `);
    assert.strictEqual(initialDOM.ariaLabel, 'Nhận định tổng thể phỏng vấn', 'Initial DOM aria-label must be canonical');

    const htmlContent = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.html'), 'utf8');
    assert.ok(htmlContent.includes('<span>Nhận định tổng thể</span>'), 'Static HTML has <span>Nhận định tổng thể</span>');
    assert.ok(htmlContent.includes('aria-label="Nhận định tổng thể phỏng vấn"'), 'Static HTML has canonical aria-label');
    console.log('  [PASS] 1.1 Canonical Eyebrow and aria-label verified in static template and live DOM.');

    console.log('\n--- TEST SUITE 2: STATE A — SINGLE SHORT SENTENCE ---');
    const stateA = await testRender(STATE_A_SHORT, false);
    assert.ok(stateA.cardPresent, 'Card must be present');
    assert.strictEqual(stateA.eyebrowText, 'Nhận định tổng thể');
    assert.strictEqual(stateA.leadText, STATE_A_SHORT, 'Lead text matches short summary verbatim');
    assert.strictEqual(stateA.leadIsSingle, true, 'Short summary gets .is-single class');
    assert.strictEqual(stateA.bodyParas.length, 0, 'No body paragraphs for single sentence');
    assert.strictEqual(stateA.insightRowsCount, 0, 'No insight rows / sub-cards');
    assert.strictEqual(stateA.expandBtnPresent, false, 'No expand button for single short sentence');
    console.log('  [PASS] 2.1 State A rendered cleanly without body, insight rows, or expand button.');

    console.log('\n--- TEST SUITE 3: STATE B — MEDIUM NARRATIVE PROSE ---');
    const stateB = await testRender(STATE_B_MEDIUM, false);
    assert.ok(stateB.cardPresent, 'Card must be present');
    assert.strictEqual(stateB.eyebrowText, 'Nhận định tổng thể');
    assert.ok(stateB.leadText.includes('Ứng viên thể hiện tư duy kiến trúc hệ thống vững vàng'), 'Lead text gets first prominent sentence');
    assert.strictEqual(stateB.leadIsSingle, false, 'Multi-sentence does NOT have .is-single');
    assert.ok(stateB.bodyParas.length >= 1, 'Supporting sentences grouped into body paragraphs');
    assert.ok(stateB.bodyParas[0].includes('trade-off giữa độ trễ và tính sẵn sàng'), 'Supporting paragraph contains rest of explanation');
    assert.strictEqual(stateB.insightRowsCount, 0, 'No insight sub-cards');
    console.log('  [PASS] 3.1 State B rendered with prominent lead and supporting paragraphs.');

    console.log('\n--- TEST SUITE 4: STATE C — LONG STRUCTURED INPUT & DUPLICATION ELIMINATION ---');
    const stateC = await testRender(STATE_C_LONG_BOILERPLATE, false);
    assert.ok(stateC.cardPresent, 'Card must be present');
    assert.strictEqual(stateC.eyebrowText, 'Nhận định tổng thể');
    
    // Zero duplication verification:
    assert.ok(!stateC.leadText.includes('Điểm số 78/100'), 'Score must NOT be repeated in lead text');
    assert.ok(!stateC.leadText.includes('Frontend Developer (Mid-level)'), 'Position title must NOT be repeated in lead text');
    assert.strictEqual(stateC.insightRowsCount, 0, 'Mini sub-cards (.hero-summary-insight-row) MUST be 0 (no duplicate tags)');
    
    // Check paragraphs:
    assert.ok(stateC.bodyParas.length >= 2, 'Strengths and Gaps observations distilled into executive paragraphs');
    assert.ok(stateC.bodyParas[0].includes('Xử lý câu hỏi mở rộng & Thử thách kỹ thuật tốt'), 'Strengths insight preserved in flowing narrative');
    assert.ok(stateC.bodyParas[1].includes('Bất đồng bộ và Cơ chế Event Loop'), 'Gaps insight preserved in flowing narrative');
    
    // Expand / Collapse interactivity test:
    assert.strictEqual(stateC.expandBtnPresent, true, 'Expand button present for long content');
    assert.strictEqual(stateC.bodyIsClamped, true, 'Initial state is clamped');
    assert.ok(stateC.expandBtnText.includes('Xem thêm'), 'Button text is "Xem thêm"');

    // Click to Expand:
    const expandResult = await cdp.eval(`
      (() => {
        const btn = document.getElementById("btn-expand-hero-summary");
        if (btn) btn.click();
        const body = document.querySelector(".hero-summary-body");
        return {
          isExpanded: body.classList.contains("is-expanded"),
          isClamped: body.classList.contains("is-clamped"),
          btnText: btn.textContent.trim(),
          ariaExpanded: btn.getAttribute("aria-expanded")
        };
      })()
    `);
    assert.strictEqual(expandResult.isExpanded, true, 'Body receives .is-expanded on click');
    assert.strictEqual(expandResult.isClamped, false, 'Body drops .is-clamped on click');
    assert.ok(expandResult.btnText.includes('Thu gọn'), 'Button text changes to "Thu gọn"');
    assert.strictEqual(expandResult.ariaExpanded, 'true', 'aria-expanded updated to "true"');

    // Click to Collapse:
    const collapseResult = await cdp.eval(`
      (() => {
        const btn = document.getElementById("btn-expand-hero-summary");
        if (btn) btn.click();
        const body = document.querySelector(".hero-summary-body");
        return {
          isExpanded: body.classList.contains("is-expanded"),
          isClamped: body.classList.contains("is-clamped"),
          btnText: btn.textContent.trim(),
          ariaExpanded: btn.getAttribute("aria-expanded")
        };
      })()
    `);
    assert.strictEqual(collapseResult.isClamped, true, 'Body restored to .is-clamped');
    assert.ok(collapseResult.btnText.includes('Xem thêm'), 'Button text restored to "Xem thêm"');
    assert.strictEqual(collapseResult.ariaExpanded, 'false', 'aria-expanded restored to "false"');
    console.log('  [PASS] 4.1 State C: 0 score/position duplication, 0 sub-cards, interactive expand/collapse fully verified.');

    console.log('\n--- TEST SUITE 5: STATE D — EMPTY / MISSING FALLBACK ---');
    const stateD = await testRender('', false);
    assert.ok(stateD.cardPresent, 'Card must be present');
    assert.strictEqual(stateD.eyebrowText, 'Nhận định tổng thể');
    assert.strictEqual(stateD.leadIsSingle, true, 'Fallback gets .is-single');
    assert.ok(stateD.leadText.includes('Chưa có thông tin nhận định'), 'Fallback message rendered');
    console.log('  [PASS] 5.1 State D: Graceful fallback message rendered.');

    console.log('\n--- TEST SUITE 6: STATE E — GUEST PREVIEW PROTECTION ---');
    const stateE = await testRender(STATE_E_GUEST_SUMMARY, true, STATE_E_GUEST_INTERPRETATION);
    assert.ok(stateE.cardPresent, 'Card must be present');
    assert.strictEqual(stateE.eyebrowText, 'Nhận định tổng thể (Bản xem trước)', 'Eyebrow indicates guest preview');
    assert.strictEqual(stateE.leadText, STATE_E_GUEST_SUMMARY, 'Lead contains verbatim guest summary');
    assert.strictEqual(stateE.interpText, STATE_E_GUEST_INTERPRETATION, 'Interpretation rendered in separate styled container');
    assert.strictEqual(stateE.insightRowsCount, 0, 'No internal evaluation details leaked');
    console.log('  [PASS] 6.1 State E: Guest preview rendered with protection; zero analytical leaks.');

    console.log('\n--- TEST SUITE 7: MULTI-VIEWPORT RESPONSIVENESS & ZERO OVERFLOW ---');
    // Re-render state C for responsive check
    await testRender(STATE_C_LONG_BOILERPLATE, false);
    const viewports = [
      { w: 1440, h: 900, name: 'Desktop Large' },
      { w: 1280, h: 800, name: 'Desktop Standard' },
      { w: 768, h: 1024, name: 'Tablet' },
      { w: 390, h: 844, name: 'Mobile iPhone 12/13/14' },
      { w: 375, h: 667, name: 'Mobile iPhone SE' }
    ];

    for (const vp of viewports) {
      await cdp.setViewport(vp.w, vp.h);
      const metrics = await cdp.eval(`
        (() => {
          const card = document.querySelector(".hero-summary-card");
          const docEl = document.documentElement;
          const bodyEl = document.body;
          return {
            docScrollWidth: docEl.scrollWidth,
            docClientWidth: docEl.clientWidth,
            cardOffsetWidth: card ? card.offsetWidth : 0,
            cardScrollWidth: card ? card.scrollWidth : 0
          };
        })()
      `);
      assert.ok(metrics.docScrollWidth <= metrics.docClientWidth + 1, `Zero horizontal page overflow at ${vp.w}px`);
      assert.ok(metrics.cardScrollWidth <= metrics.cardOffsetWidth + 1, `Zero card overflow at ${vp.w}px`);
      console.log(`  [PASS] 7.x Viewport ${vp.w}px (${vp.name}): 0px horizontal overflow verified.`);
    }

    console.log('\n--- TEST SUITE 8: VISUAL EVIDENCE SCREENSHOTS (LIGHT & DARK) ---');
    // Desktop Light
    await cdp.setViewport(1440, 900);
    await cdp.eval(`document.documentElement.removeAttribute("data-theme"); document.body.classList.remove("dark-mode");`);
    await sleep(300);
    await cdp.screenshot(path.join(SCREENSHOT_DIR, 'overall-assessment-desktop-light.png'));
    console.log('  [CAPTURED] Desktop Light mode screenshot');

    // Desktop Dark
    await cdp.eval(`document.documentElement.setAttribute("data-theme", "dark"); document.body.classList.add("dark-mode");`);
    await sleep(300);
    await cdp.screenshot(path.join(SCREENSHOT_DIR, 'overall-assessment-desktop-dark.png'));
    console.log('  [CAPTURED] Desktop Dark mode screenshot');

    // Mobile Light
    await cdp.setViewport(390, 844);
    await cdp.eval(`document.documentElement.removeAttribute("data-theme"); document.body.classList.remove("dark-mode");`);
    await sleep(300);
    await cdp.screenshot(path.join(SCREENSHOT_DIR, 'overall-assessment-mobile-light.png'));
    console.log('  [CAPTURED] Mobile Light mode screenshot');

    // Mobile Dark
    await cdp.eval(`document.documentElement.setAttribute("data-theme", "dark"); document.body.classList.add("dark-mode");`);
    await sleep(300);
    await cdp.screenshot(path.join(SCREENSHOT_DIR, 'overall-assessment-mobile-dark.png'));
    console.log('  [CAPTURED] Mobile Dark mode screenshot');

    console.log('\n======================================================================');
    console.log('  ALL E2E ACCEPTANCE CRITERIA VERIFIED WITH 100% PASS RATE!           ');
    console.log('======================================================================\n');

    await cdp.close();
  } finally {
    browserProc.kill();
    staticServer.close();
  }
}

runTest().catch(err => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  process.exit(1);
});
