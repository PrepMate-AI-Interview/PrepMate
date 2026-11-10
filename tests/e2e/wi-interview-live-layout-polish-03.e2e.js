/**
 * PREPMATE — REAL EDGE/CDP E2E VERIFICATION SUITE: WI-INTERVIEW-LIVE-LAYOUT-POLISH-03
 * Verifies:
 *   1. Layout & Proportions Standardization (Question stage vs Answer console alignment & sizing)
 *   2. Expand/Collapse Optimization ("Xem thêm / Thu gọn", real DOM overflow, eliminate pseudo-buttons)
 *   3. AI Direction Typography & Visual Hierarchy (Step 4 Section heading 21px, Subheadings 16.5px, Body 14.5px, Labels 13px)
 *   4. Candidate Mic Level Redesign (4-bar dynamic soundwave equalizer, RMS reactivity, zero layout shift)
 *   5. Video Tile & Nameplate Sizing & Stability
 *   6. Responsive Layout Across 6 Viewports (1440, 1280, 1024, 768, 390, 375)
 *   7. Screenshot Audit Artifacts
 *   8. Production DB Invariant
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5096;
const CDP_PORT = 9296;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const TEST_DIR = path.join(os.tmpdir(), `prepmate_layout_polish03_e2e_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, "isolated_test_db.json");
const TEST_KEYRING_PATH = path.join(TEST_DIR, "test_keys");
const SCREENSHOT_DIR = path.join(WORKSPACE_ROOT, "tests", "audit-artifacts", "screenshots");

function findBrowserExecutable() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function computeHash(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex").toUpperCase();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function requestJsonOnce(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || "GET",
      headers: {
        Accept: "text/html,application/json",
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error(`Timeout calling ${url}`));
    });

    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

class SimpleCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    const WS = globalThis.WebSocket;
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WS(this.wsUrl);
      } catch (e) {
        return reject(e);
      }

      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", reject);
      this.ws.addEventListener("message", (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.id && this.callbacks.has(msg.id)) {
            const { resolve, reject } = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else resolve(msg.result);
          }
        } catch (e) {}
      });
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async setViewport(width, height, isMobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile,
    });
  }

  async captureScreenshot(filepath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    if (res && res.data) {
      fs.writeFileSync(filepath, Buffer.from(res.data, "base64"));
    }
  }

  async close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }
  }
}

async function main() {
  console.log("======================================================================");
  console.log("  PREPMATE — REAL EDGE/CDP E2E: WI-INTERVIEW-LIVE-LAYOUT-POLISH-03   ");
  console.log("  Layout Alignment, Expand Optimization, Typography & Equalizer Meter ");
  console.log("======================================================================\n");

  const baselineHash = computeHash(PROD_DB_PATH);
  console.log(`[1] Baseline Production DB Hash: ${baselineHash}`);

  const browserExe = findBrowserExecutable();
  assert.ok(browserExe, "Compatible Edge or Chrome browser executable required");
  console.log(`[2] Browser: ${browserExe}`);

  let backendProc = null;
  let browserProc = null;
  let cdp = null;

  try {
    if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
    if (!fs.existsSync(TEST_KEYRING_PATH)) fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

    const beDir = path.join(WORKSPACE_ROOT, "BE");
    const dllPath = path.join(beDir, "bin", "Debug", "net10.0", "backend.dll");

    console.log(`[3] Launching isolated backend on port ${BACKEND_PORT}...`);
    backendProc = spawn("dotnet", [dllPath, "--urls", BASE_URL], {
      cwd: beDir,
      env: {
        ...process.env,
        DATABASE_FILE_PATH: TEST_DB_PATH,
        DATABASE__FILEPATH: TEST_DB_PATH,
        DATABASE__FILE_PATH: TEST_DB_PATH,
        "Database:FilePath": TEST_DB_PATH,
        PREPMATE_DATABASE_PATH: TEST_DB_PATH,
        PREPMATE_KEYRING_PATH: TEST_KEYRING_PATH,
        ASPNETCORE_URLS: BASE_URL,
        DOTNET_URLS: BASE_URL,
      },
      stdio: "ignore",
    });

    let backendReady = false;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try {
        const ping = await requestJsonOnce(`${BASE_URL}/features/interview/interview-info.html`);
        if (ping.status === 200) {
          backendReady = true;
          break;
        }
      } catch (e) {}
    }
    assert.ok(backendReady, "Backend failed to start within timeout");
    console.log("[PASS] Isolated backend is live and serving static FE assets.");

    const userDataDir = path.join(TEST_DIR, "edge_profile");
    console.log(`[4] Launching headless browser on CDP port ${CDP_PORT}...`);
    browserProc = spawn(browserExe, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-background-networking",
      "--window-size=1440,900",
      "about:blank",
    ]);

    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(400);
      try {
        const res = await requestJsonOnce(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (Array.isArray(res.body) && res.body.length > 0) {
          const pageTarget = res.body.find((t) => t.type === "page") || res.body[0];
          if (pageTarget && pageTarget.webSocketDebuggerUrl) {
            wsUrl = pageTarget.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (e) {}
    }
    assert.ok(wsUrl, "Failed to connect to browser CDP endpoint");
    console.log(`[PASS] Browser CDP ready at: ${wsUrl}`);

    cdp = new SimpleCDP(wsUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.PREPMATE_API_BASE_URL = "${BASE_URL}";
        try { localStorage.setItem("prepmate_api_base_url", "${BASE_URL}"); } catch(e){}
      `,
    });
    await cdp.setViewport(1440, 900);

    // =========================================================================
    // CHECK 1: STEP 4 AI DIRECTION TYPOGRAPHY & VISUAL HIERARCHY
    // =========================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("  CHECK 1: Step 4 AI Direction Typography Hierarchy                  ");
    console.log("----------------------------------------------------------------------");

    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/interview/interview-info.html` });
    await sleep(1500);

    // Seed mock config and activate Step 4
    await cdp.eval(`
      sessionStorage.setItem("interview_init_data", JSON.stringify({
        jobTitle: "Senior Frontend Engineer",
        companyName: "TechCorp Global",
        interviewRound: "round2",
        industryId: "software-tech",
        experienceLevel: "Senior",
        targetLevel: "Senior",
        cvText: "React, TypeScript, CSS Architecture, Performance Optimization, Web Audio API, Micro-frontends",
        jdText: "Seeking a Senior Frontend Engineer proficient in modern JS/TS, state management, and real-time audio/video streaming."
      }));
      const jobInput = document.getElementById("job-title");
      if (jobInput) {
        jobInput.value = "Senior Frontend Engineer";
        jobInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (typeof goToStep === "function") {
        goToStep(4, true);
      }
      if (typeof updateReadinessSummary === "function") {
        updateReadinessSummary();
      }
    `);
    await sleep(600);

    const typographyMeasurements = await cdp.eval(`
      (() => {
        const titleEl = document.querySelector('.ai-preview-title');
        const headerEl = document.querySelector('.ai-preview-header');
        const headerSvg = document.querySelector('.ai-preview-header svg');
        const sections = Array.from(document.querySelectorAll('.ai-preview-section'));
        const subheadings = Array.from(document.querySelectorAll('.ai-preview-section-title'));
        const metaRows = Array.from(document.querySelectorAll('.ai-preview-meta-row'));
        const metaLabels = Array.from(document.querySelectorAll('.ai-preview-meta-row strong'));
        const disclaimerEl = document.querySelector('.ai-preview-disclaimer');

        const titleStyle = titleEl ? window.getComputedStyle(titleEl) : null;
        const subStyle = subheadings.length > 0 ? window.getComputedStyle(subheadings[0]) : null;
        const bodyStyle = metaRows.length > 0 ? window.getComputedStyle(metaRows[0]) : null;
        const labelStyle = metaLabels.length > 0 ? window.getComputedStyle(metaLabels[0]) : null;
        const headerSvgStyle = headerSvg ? window.getComputedStyle(headerSvg) : null;

        return {
          titleFontSize: titleStyle ? parseFloat(titleStyle.fontSize) : 0,
          titleFontWeight: titleStyle ? titleStyle.fontWeight : '',
          subheadingCount: subheadings.length,
          subheadingFontSize: subStyle ? parseFloat(subStyle.fontSize) : 0,
          subheadingFontWeight: subStyle ? subStyle.fontWeight : '',
          bodyFontSize: bodyStyle ? parseFloat(bodyStyle.fontSize) : 0,
          labelFontSize: labelStyle ? parseFloat(labelStyle.fontSize) : 0,
          labelFontWeight: labelStyle ? labelStyle.fontWeight : '',
          headerSvgMarginTop: headerSvgStyle ? headerSvgStyle.marginTop : '',
          disclaimerExists: Boolean(disclaimerEl),
          sectionCount: sections.length
        };
      })()
    `);

    console.log("Step 4 Typography Measurements:", typographyMeasurements);

    // Assert Section Heading (20-22px range, font-weight 600-700)
    assert.ok(
      typographyMeasurements.titleFontSize >= 20 && typographyMeasurements.titleFontSize <= 23,
      `Section heading font-size must be between 20px and 23px (got ${typographyMeasurements.titleFontSize}px)`
    );
    assert.ok(
      typographyMeasurements.titleFontWeight === "700" || typographyMeasurements.titleFontWeight === "600",
      `Section heading weight must be 600 or 700 (got ${typographyMeasurements.titleFontWeight})`
    );

    // Assert Subheadings (16-18px range, font-weight 600)
    assert.strictEqual(typographyMeasurements.subheadingCount, 4, "Must have 4 subheadings (A, B, C, D)");
    assert.ok(
      typographyMeasurements.subheadingFontSize >= 16 && typographyMeasurements.subheadingFontSize <= 18.5,
      `Subheading font-size must be between 16px and 18.5px (got ${typographyMeasurements.subheadingFontSize}px)`
    );

    // Assert Body (14-16px range) & Labels (12-13.5px, weight 600)
    assert.ok(
      typographyMeasurements.bodyFontSize >= 14 && typographyMeasurements.bodyFontSize <= 16,
      `Body text font-size must be between 14px and 16px (got ${typographyMeasurements.bodyFontSize}px)`
    );
    assert.ok(
      typographyMeasurements.labelFontSize >= 12 && typographyMeasurements.labelFontSize <= 13.5,
      `Label font-size must be between 12px and 13.5px (got ${typographyMeasurements.labelFontSize}px)`
    );

    const step4ShotPath = path.join(SCREENSHOT_DIR, "wi-interview-live-layout-polish-03-step4-typography.png");
    await cdp.captureScreenshot(step4ShotPath);
    console.log(`[PASS] Step 4 Typography verified. Screenshot saved: ${step4ShotPath}`);

    // =========================================================================
    // CHECK 2: EXPAND/COLLAPSE BUTTON OPTIMIZATION (REAL OVERFLOW DETECTION)
    // =========================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("  CHECK 2: Expand/Collapse DOM Overflow & Elimination of Pseudo-Buttons");
    console.log("----------------------------------------------------------------------");

    const expandBehavior = await cdp.eval(`
      (async () => {
        // Create an isolated expandable test harness in the page
        const testWrap = document.createElement('div');
        testWrap.id = 'e2e-expand-test-wrap';
        testWrap.className = 'expandable-text-wrap';
        testWrap.style.width = '350px';
        testWrap.style.position = 'relative';

        const testText = document.createElement('p');
        testText.id = 'e2e-test-text';
        testText.className = 'analysis-summary-text';

        const testBtn = document.createElement('button');
        testBtn.id = 'e2e-test-btn';
        testBtn.className = 'btn-expand-text hidden';
        testBtn.style.display = 'none';
        testBtn.setAttribute('aria-expanded', 'false');
        testBtn.innerHTML = '<span>Xem thêm</span>';
        testBtn.onclick = () => window.toggleExpandText('e2e-test-text', 'e2e-test-btn');

        testWrap.appendChild(testText);
        testWrap.appendChild(testBtn);
        document.body.appendChild(testWrap);

        // Case A: Short content (should NOT show expand button)
        window.setupExpandableText('e2e-test-text', 'e2e-test-btn', 'Đây là nội dung ngắn 1 dòng.');
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 60));

        const shortBtnDisplay = window.getComputedStyle(testBtn).display;
        const shortIsClamped = testText.classList.contains('is-clamped');
        const shortAria = testBtn.getAttribute('aria-expanded');

        // Case B: Long overflowing content (exceeding 4 lines in 350px container)
        const longText = 'Nội dung phân tích hồ sơ chuyên sâu: Ứng viên có hơn 5 năm kinh nghiệm thực chiến phát triển các giải pháp phần mềm phân tán, xây dựng microservices trên nền tảng .NET Core và Node.js. Năng lực làm việc nhóm tốt, tư duy thiết kế hệ thống vững vàng, có kinh nghiệm trực tiếp với Docker, Kubernetes, CI/CD pipeline và tối ưu hiệu năng cơ sở dữ liệu quy mô lớn.';
        window.setupExpandableText('e2e-test-text', 'e2e-test-btn', longText);
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 60));

        const longBtnDisplay = window.getComputedStyle(testBtn).display;
        const longIsClamped = testText.classList.contains('is-clamped');
        const longAriaBeforeClick = testBtn.getAttribute('aria-expanded');
        const longLabelBeforeClick = testBtn.querySelector('span').textContent;

        // Case C: User clicks "Xem thêm" -> expands
        testBtn.click();
        await new Promise(r => setTimeout(r, 60));

        const expandedIsExpanded = testText.classList.contains('is-expanded');
        const expandedAria = testBtn.getAttribute('aria-expanded');
        const expandedLabel = testBtn.querySelector('span').textContent;

        // Case D: User clicks "Thu gọn" -> collapses
        testBtn.click();
        await new Promise(r => setTimeout(r, 60));

        const collapsedIsClamped = testText.classList.contains('is-clamped');
        const collapsedAria = testBtn.getAttribute('aria-expanded');
        const collapsedLabel = testBtn.querySelector('span').textContent;

        // Cleanup test harness
        testWrap.remove();

        return {
          shortBtnDisplay,
          shortIsClamped,
          shortAria,
          longBtnDisplay,
          longIsClamped,
          longAriaBeforeClick,
          longLabelBeforeClick,
          expandedIsExpanded,
          expandedAria,
          expandedLabel,
          collapsedIsClamped,
          collapsedAria,
          collapsedLabel
        };
      })()
    `);

    console.log("Expand/Collapse Behavior Results:", expandBehavior);

    // Verify Short Text (pseudo-button eliminated)
    assert.strictEqual(expandBehavior.shortBtnDisplay, "none", "Short text button must have display: none");
    assert.strictEqual(expandBehavior.shortIsClamped, false, "Short text must not have is-clamped");
    assert.strictEqual(expandBehavior.shortAria, "false", "Short text button aria-expanded must be false");

    // Verify Long Text (real button shown)
    assert.strictEqual(expandBehavior.longBtnDisplay, "inline-flex", "Overflowing text button must have display: inline-flex");
    assert.strictEqual(expandBehavior.longIsClamped, true, "Overflowing text must have is-clamped");
    assert.strictEqual(expandBehavior.longAriaBeforeClick, "false", "Aria-expanded before click must be false");
    assert.strictEqual(expandBehavior.longLabelBeforeClick, "Xem thêm", "Button label before click must be 'Xem thêm'");

    // Verify Expanded state
    assert.strictEqual(expandBehavior.expandedIsExpanded, true, "Text must have is-expanded class after clicking");
    assert.strictEqual(expandBehavior.expandedAria, "true", "Aria-expanded must be true after clicking");
    assert.strictEqual(expandBehavior.expandedLabel, "Thu gọn", "Button label must be 'Thu gọn' after clicking");

    // Verify Collapsed state
    assert.strictEqual(expandBehavior.collapsedIsClamped, true, "Text must return to is-clamped after clicking Thu gọn");
    assert.strictEqual(expandBehavior.collapsedAria, "false", "Aria-expanded must be false after collapsing");
    assert.strictEqual(expandBehavior.collapsedLabel, "Xem thêm", "Button label must return to 'Xem thêm'");

    console.log("[PASS] Expand/Collapse DOM overflow detection & pseudo-button elimination 100% verified.");

    // =========================================================================
    // CHECK 3: CANDIDATE MIC LEVEL REDESIGN (DYNAMIC 4-BAR SOUNDWAVE EQUALIZER)
    // =========================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("  CHECK 3: Candidate Mic Dynamic Soundwave Equalizer                 ");
    console.log("----------------------------------------------------------------------");

    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/interview/interview-practice.html` });
    await sleep(2000);

    const initialEqualizer = await cdp.eval(`
      (() => {
        const wrap = document.getElementById('candidate-mic-level-wrap');
        const bars = wrap ? Array.from(wrap.querySelectorAll('.eq-bar')) : [];
        const compatBar = document.getElementById('candidate-mic-level-bar');
        const tile = document.getElementById('candidate-tile');
        const tileRect = tile ? tile.getBoundingClientRect() : null;

        return {
          hasWrap: Boolean(wrap),
          isEqualizer: wrap ? wrap.classList.contains('candidate-mic-equalizer') : false,
          barCount: bars.length,
          hasCompatBar: Boolean(compatBar),
          wrapActive: wrap ? wrap.classList.contains('active') : false,
          barHeights: bars.map(b => parseFloat(window.getComputedStyle(b).height)),
          tileWidth: tileRect ? tileRect.width : 0,
          tileHeight: tileRect ? tileRect.height : 0
        };
      })()
    `);

    console.log("Initial Idle Equalizer State:", initialEqualizer);
    assert.ok(initialEqualizer.hasWrap, "Candidate mic level wrap element must exist");
    assert.ok(initialEqualizer.isEqualizer, "Wrap element must have 'candidate-mic-equalizer' class");
    assert.strictEqual(initialEqualizer.barCount, 4, "Must have exactly 4 dynamic soundwave equalizer bars");
    assert.ok(initialEqualizer.hasCompatBar, "Legacy compat bar must exist for test invariance");
    assert.strictEqual(initialEqualizer.wrapActive, false, "Equalizer must not be active when idle");
    initialEqualizer.barHeights.forEach((h, idx) => {
      assert.ok(h <= 4, `Idle bar ${idx + 1} height must be compact baseline <= 4px (got ${h}px)`);
    });

    const eqIdleShotPath = path.join(SCREENSHOT_DIR, "wi-interview-live-layout-polish-03-equalizer-idle.png");
    await cdp.captureScreenshot(eqIdleShotPath);
    console.log(`[PASS] Equalizer idle state verified. Screenshot saved: ${eqIdleShotPath}`);

    // Simulate Active Speech Activity (Voice RMS level = 50)
    console.log("Simulating candidate speech activity (RMS level = 50)...");
    const activeEqualizer = await cdp.eval(`
      (async () => {
        if (typeof window.stopMicPreflightTest === 'function') {
          window.stopMicPreflightTest();
        }
        if (typeof window.setPreflightMicMuted === 'function') {
          window.setPreflightMicMuted(false);
        }
        if (typeof handleCandidateVoiceActivity === 'function') {
          handleCandidateVoiceActivity(50);
        }

        // Wait for CSS transition (0.08s) to complete
        await new Promise(r => setTimeout(r, 100));

        const wrap = document.getElementById('candidate-mic-level-wrap');
        const bars = wrap ? Array.from(wrap.querySelectorAll('.eq-bar')) : [];
        const tile = document.getElementById('candidate-tile');
        const tileRect = tile ? tile.getBoundingClientRect() : null;

        return {
          wrapActive: wrap ? wrap.classList.contains('active') : false,
          barHeights: bars.map(b => parseFloat(window.getComputedStyle(b).height)),
          barInlineHeights: bars.map(b => b.style.height),
          barColors: bars.map(b => window.getComputedStyle(b).backgroundColor),
          tileWidth: tileRect ? tileRect.width : 0,
          tileHeight: tileRect ? tileRect.height : 0
        };
      })()
    `);

    console.log("Active Speaking Equalizer State:", activeEqualizer);
    assert.strictEqual(activeEqualizer.wrapActive, true, "Equalizer must have 'active' class when speaking");
    activeEqualizer.barHeights.forEach((h, idx) => {
      assert.ok(h > 3, `Active bar ${idx + 1} height must react dynamically > 3px (got ${h}px)`);
    });
    // Verify zero layout shift: tile width and height remain stable
    assert.strictEqual(activeEqualizer.tileWidth, initialEqualizer.tileWidth, "Candidate tile width must not change during speech");
    assert.strictEqual(activeEqualizer.tileHeight, initialEqualizer.tileHeight, "Candidate tile height must not change during speech");

    const eqSpeakingShotPath = path.join(SCREENSHOT_DIR, "wi-interview-live-layout-polish-03-equalizer-speaking.png");
    await cdp.captureScreenshot(eqSpeakingShotPath);
    console.log(`[PASS] Dynamic Equalizer speech reactivity & stability verified. Screenshot saved: ${eqSpeakingShotPath}`);

    // =========================================================================
    // CHECK 4: QUESTION STAGE VS ANSWER CONSOLE LAYOUT ALIGNMENT & PROPORTIONS
    // =========================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("  CHECK 4: Question Stage vs Answer Console Layout & Proportions     ");
    console.log("----------------------------------------------------------------------");

    const layoutMeasurements = await cdp.eval(`
      (() => {
        const questionStage = document.querySelector('.ir-question-stage');
        const responseConsole = document.querySelector('.ir-response-console');
        const stageColumn = document.querySelector('.ir-video-stage-column');
        const videoGrid = document.querySelector('.ir-video-grid');

        const qRect = questionStage.getBoundingClientRect();
        const rRect = responseConsole.getBoundingClientRect();
        const qStyle = window.getComputedStyle(questionStage);
        const rStyle = window.getComputedStyle(responseConsole);

        return {
          questionWidth: Math.round(qRect.width),
          responseWidth: Math.round(rRect.width),
          questionPadding: qStyle.padding,
          responsePadding: rStyle.padding,
          questionBorderRadius: qStyle.borderRadius,
          responseBorderRadius: rStyle.borderRadius,
          questionHeight: Math.round(qRect.height),
          responseHeight: Math.round(rRect.height),
          questionOverflowY: qStyle.overflowY,
          hasStageColumn: Boolean(stageColumn),
          hasVideoGrid: Boolean(videoGrid)
        };
      })()
    `);

    console.log("Live Layout Measurements:", layoutMeasurements);

    // Assert Question Stage & Response Console horizontal alignment (same width)
    assert.strictEqual(
      layoutMeasurements.questionWidth,
      layoutMeasurements.responseWidth,
      `Question stage width (${layoutMeasurements.questionWidth}px) must exactly match Response console width (${layoutMeasurements.responseWidth}px)`
    );

    // Assert Padding standardization (14px 20px)
    assert.strictEqual(layoutMeasurements.questionPadding, "14px 20px", "Question stage padding must be 14px 20px");
    assert.strictEqual(layoutMeasurements.responsePadding, "14px 20px", "Response console padding must be 14px 20px");

    // Assert Border radius standardization (14px)
    assert.strictEqual(layoutMeasurements.questionBorderRadius, "14px", "Question stage border radius must be 14px");
    assert.strictEqual(layoutMeasurements.responseBorderRadius, "14px", "Response console border radius must be 14px");

    // Assert Height proportions (question stage min-height ~84px, response console min-height ~160px)
    assert.ok(layoutMeasurements.questionHeight >= 80 && layoutMeasurements.questionHeight <= 160, `Question height must be well-proportioned (got ${layoutMeasurements.questionHeight}px)`);
    assert.ok(layoutMeasurements.responseHeight >= 150 && layoutMeasurements.responseHeight <= 420, `Response console height must be spacious (got ${layoutMeasurements.responseHeight}px)`);

    const liveLayout1440ShotPath = path.join(SCREENSHOT_DIR, "wi-interview-live-layout-polish-03-live-layout-1440.png");
    await cdp.captureScreenshot(liveLayout1440ShotPath);
    console.log(`[PASS] Question and Answer console layout alignment verified. Screenshot saved: ${liveLayout1440ShotPath}`);

    // =========================================================================
    // CHECK 5: RESPONSIVE LAYOUT VERIFICATION ACROSS 6 VIEWPORTS
    // =========================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("  CHECK 5: Responsive Layout Across 6 Viewports                      ");
    console.log("----------------------------------------------------------------------");

    const viewports = [
      { width: 1440, height: 900, name: "Desktop (1440x900)" },
      { width: 1280, height: 800, name: "Laptop (1280x800)" },
      { width: 1024, height: 768, name: "Tablet Landscape (1024x768)" },
      { width: 768, height: 1024, name: "Portrait Tablet (768x1024)" },
      { width: 390, height: 844, name: "Mobile iPhone (390x844)", mobile: true },
      { width: 375, height: 667, name: "Mobile Small (375x667)", mobile: true },
    ];

    for (const vp of viewports) {
      await cdp.setViewport(vp.width, vp.height, vp.mobile || false);
      await sleep(300);

      const vpStatus = await cdp.eval(`
        (() => {
          const docEl = document.documentElement;
          const body = document.body;
          const qStage = document.querySelector('.ir-question-stage');
          const rConsole = document.querySelector('.ir-response-console');

          const hasHorizontalOverflow = docEl.scrollWidth > window.innerWidth;
          return {
            windowWidth: window.innerWidth,
            scrollWidth: docEl.scrollWidth,
            hasHorizontalOverflow,
            qStageVisible: Boolean(qStage && qStage.offsetParent !== null),
            rConsoleVisible: Boolean(rConsole && rConsole.offsetParent !== null)
          };
        })()
      `);

      console.log(`Viewport ${vp.name}:`, vpStatus);
      assert.strictEqual(vpStatus.hasHorizontalOverflow, false, `Viewport ${vp.name} must not have horizontal scrollbar`);
      assert.ok(vpStatus.qStageVisible, `Question stage must remain visible on ${vp.name}`);
      assert.ok(vpStatus.rConsoleVisible, `Response console must remain visible on ${vp.name}`);
    }

    // Capture mobile screenshot
    const mobileShotPath = path.join(SCREENSHOT_DIR, "wi-interview-live-layout-polish-03-live-layout-mobile.png");
    await cdp.captureScreenshot(mobileShotPath);
    console.log(`[PASS] All 6 viewports responsive without horizontal overflow. Screenshot saved: ${mobileShotPath}`);

    // Restore desktop viewport
    await cdp.setViewport(1440, 900);

    // =========================================================================
    // CHECK 6: PRODUCTION DATABASE SHA-256 INVARIANT
    // =========================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("  CHECK 6: Production Database Integrity & Invariant                 ");
    console.log("----------------------------------------------------------------------");

    const endingHash = computeHash(PROD_DB_PATH);
    console.log(`Ending Production DB Hash: ${endingHash}`);
    assert.strictEqual(endingHash, baselineHash, "Production database BE/data/db.json was altered during test execution!");
    console.log("[PASS] Production database remained 100% untouched and pristine.");

    console.log("\n======================================================================");
    console.log("  ALL WI-INTERVIEW-LIVE-LAYOUT-POLISH-03 E2E CHECKS PASSED (100%)    ");
    console.log("======================================================================\n");
  } finally {
    if (cdp) await cdp.close();
    if (browserProc) {
      browserProc.kill();
      try { process.kill(browserProc.pid); } catch (e) {}
    }
    if (backendProc) {
      backendProc.kill();
      try { process.kill(backendProc.pid); } catch (e) {}
    }
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }
}

main().catch((err) => {
  console.error("\n[FATAL ERROR IN E2E SUITE]:", err);
  process.exit(1);
});
