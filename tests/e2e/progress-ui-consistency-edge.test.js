/**
 * WI-PROGRESS-UI-CONSISTENCY-01: Progress Page Full UI Consistency Audit & Refinement
 * Real Edge E2E Test Suite via CDP (Chrome DevTools Protocol)
 */

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const assert = require("assert");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5009;
const CDP_PORT = 9245;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const TEST_DIR = path.join(os.tmpdir(), `prepmate_progress_edge_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, "isolated_test_db.json");
const TEST_KEYRING_PATH = path.join(TEST_DIR, "test_keys");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots-progress-ui");

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
        Accept: "application/json",
        "Content-Type": "application/json",
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
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.msgId = 1;
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
      const id = this.msgId++;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const r = await this.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(r.exceptionDetails)}`);
    }
    return r.result ? r.result.value : undefined;
  }

  async screenshot(filepath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(filepath, Buffer.from(res.data, "base64"));
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runTests() {
  console.log("======================================================================");
  console.log("  PREPMATE — PROGRESS PAGE FULL UI CONSISTENCY AUDIT (EDGE CDP)        ");
  console.log("======================================================================");

  const initialHash = computeHash(PROD_DB_PATH);
  console.log(`[1] Production DB Hash: ${initialHash}`);

  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

  const browserPath = findBrowserExecutable();
  assert.ok(browserPath, "Supported Chromium-based browser not found.");
  console.log(`[2] Browser: ${browserPath}`);

  // 1. Launch backend
  console.log(`[3] Launching backend on port ${BACKEND_PORT}...`);
  const backendProc = spawn("dotnet", ["run", "--no-launch-profile"], {
    cwd: path.join(WORKSPACE_ROOT, "BE"),
    env: {
      ...process.env,
      ASPNETCORE_URLS: BASE_URL,
      PREPMATE_DB_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING_PATH,
      DATABASE_PATH: TEST_DB_PATH,
    },
    stdio: "pipe",
  });

  let backendReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const ping = await requestJsonOnce(`${BASE_URL}/api/health`);
      if (ping.status === 200 || ping.status === 404) {
        backendReady = true;
        break;
      }
    } catch (e) {
      await sleep(500);
    }
  }
  assert.ok(backendReady, "Backend failed to start on isolated port.");
  console.log(`[+] Backend ready on ${BASE_URL}`);

  // 2. Launch Browser
  const userDataDir = path.join(TEST_DIR, "browser_profile");
  fs.mkdirSync(userDataDir, { recursive: true });

  console.log(`[4] Launching Browser with CDP port ${CDP_PORT}...`);
  const browserProc = spawn(
    browserPath,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--headless=new",
      "--disable-gpu",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let targets = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await requestJsonOnce(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        targets = res.data;
        break;
      }
    } catch (e) {
      await sleep(400);
    }
  }
  assert.ok(targets && targets.length > 0, "Failed to connect to CDP target list.");
  const pageTarget = targets.find((t) => t.type === "page") || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  console.log(`[+] Connected to Edge CDP: ${pageTarget.webSocketDebuggerUrl}`);

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");

  try {
    // Navigate to blank to seed localStorage
    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/auth/auth.html` });
    await sleep(1000);

    // Mock candidate login session with 2 realistic completed interview sessions
    await cdp.eval(`
      const testUser = {
        id: "cand_001",
        email: "candidate.test@prepmate.ai",
        fullName: "Nguyen Van A",
        role: "candidate",
        token: "mock_jwt_token_for_progress_test_12345"
      };
      localStorage.setItem("prepmate_current_user", JSON.stringify(testUser));
      localStorage.setItem("prepmate_user", JSON.stringify(testUser));

      const mockSessions = [
        {
          id: "sess_001",
          jobTitle: "Senior Frontend Engineer",
          date: new Date(Date.now() - 86400000 * 2).toISOString(),
          overallScore: 78,
          techScore: 80,
          starScore: 75,
          situationalScore: 76,
          candidateQuestionScore: 82,
          analysis: {
            improvements: "Cần cải thiện cấu trúc câu trả lời STAR ở phần Action và Result.",
            suggestion: "Nên đưa thêm số liệu đo lường hiệu quả cụ thể."
          },
          knowledgeAnalysis: [
            {
              question: "Giải thích cơ chế Virtual DOM và Reconciliation trong React?",
              rating: "Cần bổ sung",
              analysis: "Chưa nêu rõ thuật toán Diffing và vai trò của keys.",
              supplement: "Cần đọc sâu về React Fiber architecture."
            }
          ]
        },
        {
          id: "sess_002",
          jobTitle: "Fullstack Tech Lead",
          date: new Date().toISOString(),
          overallScore: 88,
          techScore: 90,
          starScore: 86,
          situationalScore: 85,
          candidateQuestionScore: 90,
          analysis: {
            improvements: "Thể hiện xuất sắc phản xạ lãnh đạo và kiến trúc hệ thống.",
            suggestion: "Duy trì năng lượng và phong thái tự tin này."
          }
        }
      ];
      localStorage.setItem("prepmate_interviews_cand_001", JSON.stringify(mockSessions));
      localStorage.setItem("interview_sessions", JSON.stringify(mockSessions));
    `);

    // Navigate to progress.html
    const progressUrl = `${BASE_URL}/features/progress/progress.html`;
    console.log(`[5] Navigating to ${progressUrl}...`);
    await cdp.send("Page.navigate", { url: progressUrl });
    await sleep(2000);

    // ── AUDIT 1: HEADINGS & ICON ALIGNMENT ──
    console.log("\n--- [Audit 1: Headings & Icons Alignment] ---");
    const headingAudit = await cdp.eval(`
      (() => {
        const results = [];
        const headings = [
          { name: "Hero Heading", selector: ".progress-hero h1" },
          { name: "Trend Chart Heading", selector: ".chart-card h3 span", parent: ".chart-card:first-child" },
          { name: "STAR Radar Heading", selector: ".chart-card h3 span", parent: ".chart-card:last-child" },
          { name: "Heatmap Heading", selector: ".heatmap-title-wrap h3" },
          { name: "Streak Heading", selector: ".streak-card:first-child h3" },
          { name: "Badges Heading", selector: ".streak-card:last-child h3" },
          { name: "AI Improvement Heading", selector: ".improvements-header-left h3" },
          { name: "Reports Heading", selector: ".reports-header-left h3" }
        ];

        for (const item of headings) {
          let el = null;
          if (item.parent) {
            const parent = document.querySelector(item.parent);
            el = parent ? parent.querySelector("h3 span") : null;
          } else {
            el = document.querySelector(item.selector);
          }

          if (!el) {
            results.push({ name: item.name, found: false });
            continue;
          }

          const cs = window.getComputedStyle(el);
          const svg = el.querySelector("svg");
          const svgCs = svg ? window.getComputedStyle(svg) : null;

          const rect = el.getBoundingClientRect();
          const svgRect = svg ? svg.getBoundingClientRect() : null;

          // Check if svg and text are on the same line horizontally
          // SVG must be on the left of el's content
          const isSvgOnLeft = svgRect ? (svgRect.left <= rect.left + 5) : false;
          // SVG vertical center should align closely with text
          const verticalDiff = svgRect ? Math.abs((svgRect.top + svgRect.height/2) - (rect.top + rect.height/2)) : 0;

          results.push({
            name: item.name,
            found: true,
            display: cs.display,
            alignItems: cs.alignItems,
            gap: cs.gap,
            hasSvg: !!svg,
            svgFlexShrink: svgCs ? svgCs.flexShrink : null,
            isSvgOnLeft,
            verticalDiff,
            text: el.textContent.trim()
          });
        }
        return results;
      })()
    `);

    for (const h of headingAudit) {
      assert.ok(h.found, `Heading not found: ${h.name}`);
      console.log(`  ✓ ${h.name}: text="${h.text}", display="${h.display}", alignItems="${h.alignItems}", gap="${h.gap}", svgShrink="${h.svgFlexShrink}", svgOnLeft=${h.isSvgOnLeft}`);
      assert.ok(h.display.includes("flex"), `${h.name} display should be flex/inline-flex, got ${h.display}`);
      assert.strictEqual(h.alignItems, "center", `${h.name} alignItems should be center`);
      assert.strictEqual(h.hasSvg, true, `${h.name} must have an SVG icon`);
      assert.strictEqual(h.svgFlexShrink, "0", `${h.name} SVG flex-shrink must be 0`);
      assert.strictEqual(h.isSvgOnLeft, true, `${h.name} SVG must be aligned on the left`);
    }

    // ── AUDIT 2: STAT CARDS HIERARCHY & LAYOUT ──
    console.log("\n--- [Audit 2: Stat Cards Hierarchy & Alignment] ---");
    const statsAudit = await cdp.eval(`
      (() => {
        const grid = document.getElementById("stats-grid");
        if (!grid) return { found: false };

        const cards = Array.from(grid.querySelectorAll(".progress-stat")).map(card => {
          const lbl = card.querySelector(".stat-lbl");
          const num = card.querySelector(".stat-num");
          const delta = card.querySelector(".stat-delta");

          const cardCs = window.getComputedStyle(card);
          const lblCs = lbl ? window.getComputedStyle(lbl) : null;
          const numCs = num ? window.getComputedStyle(num) : null;
          const deltaCs = delta ? window.getComputedStyle(delta) : null;

          const cardRect = card.getBoundingClientRect();
          const lblRect = lbl ? lbl.getBoundingClientRect() : null;
          const numRect = num ? num.getBoundingClientRect() : null;
          const deltaRect = delta ? delta.getBoundingClientRect() : null;

          // Vertical hierarchy check: lbl.top < num.top < delta.top
          const verticalOrderCorrect = (lblRect && numRect && deltaRect)
            ? (lblRect.top < numRect.top && numRect.top < deltaRect.top)
            : false;

          return {
            className: card.className,
            display: cardCs.display,
            flexDirection: cardCs.flexDirection,
            lblText: lbl ? lbl.textContent.trim() : null,
            lblSize: lblCs ? lblCs.fontSize : null,
            lblColor: lblCs ? lblCs.color : null,
            numText: num ? num.textContent.trim() : null,
            numSize: numCs ? numCs.fontSize : null,
            deltaText: delta ? delta.textContent.trim() : null,
            deltaRadius: deltaCs ? deltaCs.borderRadius : null,
            verticalOrderCorrect,
            cardHeight: cardRect.height
          };
        });

        return { found: true, cards };
      })()
    `);

    assert.ok(statsAudit.found, "#stats-grid must exist");
    assert.strictEqual(statsAudit.cards.length, 5, "Must render exactly 5 stat cards");

    for (const sc of statsAudit.cards) {
      console.log(`  ✓ Card: Label="${sc.lblText}" | Value="${sc.numText}" | Delta="${sc.deltaText}" (Vertical Order=${sc.verticalOrderCorrect}, Display=${sc.display}/${sc.flexDirection})`);
      assert.strictEqual(sc.display, "flex", "Card display must be flex");
      assert.strictEqual(sc.flexDirection, "column", "Card flex-direction must be column");
      assert.strictEqual(sc.verticalOrderCorrect, true, `Card ${sc.lblText} vertical order (Label -> Num -> Delta) must be strictly top-to-bottom`);
      assert.ok(parseFloat(sc.numSize) >= 28, "Num font size should be prominent (>= 28px)");
      assert.ok(parseFloat(sc.lblSize) <= 14, "Label font size should be compact (<= 14px)");
    }

    // ── AUDIT 3: MULTI-VIEWPORT VERIFICATION (1440, 1280, 768, 390, 375) ──
    console.log("\n--- [Audit 3: Multi-viewport Responsiveness & Zero Horizontal Overflow] ---");
    const viewports = [
      { name: "Desktop 1440px", width: 1440, height: 900 },
      { name: "Laptop 1280px", width: 1280, height: 800 },
      { name: "Tablet 768px", width: 768, height: 1024 },
      { name: "Mobile Large 390px", width: 390, height: 844 },
      { name: "Mobile Compact 375px", width: 375, height: 667 }
    ];

    for (const vp of viewports) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 768,
      });
      await sleep(600);

      const overflow = await cdp.eval(`
        (() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
          const clientW = window.innerWidth;
          return {
            scrollWidth: scrollW,
            clientWidth: clientW,
            hasOverflow: scrollW > clientW + 1
          };
        })()
      `);

      const screenshotFile = path.join(SCREENSHOT_DIR, `progress_${vp.width}x${vp.height}.png`);
      await cdp.screenshot(screenshotFile);
      console.log(`  ✓ Viewport ${vp.name} (${vp.width}x${vp.height}): ScrollWidth=${overflow.scrollWidth}, ClientWidth=${overflow.clientWidth}, Overflow=${overflow.hasOverflow} -> Saved screenshot`);
      assert.strictEqual(overflow.hasOverflow, false, `Viewport ${vp.name} has unexpected horizontal overflow!`);
    }

    // Reset viewport to desktop
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(400);

    // ── AUDIT 4: MODAL SECTION TITLE ALIGNMENT ──
    console.log("\n--- [Audit 4: AI Improvement Modal Section Title Alignment] ---");
    await cdp.eval(`openImprovementModal(0);`);
    await sleep(500);

    const modalAudit = await cdp.eval(`
      (() => {
        const overlay = document.getElementById("improvement-modal-overlay");
        const isOverlayActive = overlay && (overlay.classList.contains("active") || overlay.style.display === "flex");

        const titles = Array.from(document.querySelectorAll(".imp-modal-section-title")).map(el => {
          const cs = window.getComputedStyle(el);
          const svg = el.querySelector("svg");
          const svgCs = svg ? window.getComputedStyle(svg) : null;
          return {
            text: el.textContent.trim(),
            display: cs.display,
            alignItems: cs.alignItems,
            gap: cs.gap,
            svgShrink: svgCs ? svgCs.flexShrink : null
          };
        });

        return { isOverlayActive, titles };
      })()
    `);

    console.log(`  ✓ Modal Active: ${modalAudit.isOverlayActive}`);
    assert.strictEqual(modalAudit.isOverlayActive, true, "Improvement modal must be active");
    assert.ok(modalAudit.titles.length >= 2, "Modal must have at least 2 section titles");

    for (const mt of modalAudit.titles) {
      console.log(`  ✓ Modal Section: "${mt.text}", display="${mt.display}", alignItems="${mt.alignItems}", gap="${mt.gap}", svgShrink="${mt.svgShrink}"`);
      assert.ok(mt.display.includes("flex"), "Modal title display must be flex/inline-flex");
      assert.strictEqual(mt.alignItems, "center", "Modal title alignItems must be center");
      assert.strictEqual(mt.svgShrink, "0", "Modal title SVG flex-shrink must be 0");
    }

    // Close modal
    await cdp.eval(`closeImprovementModal();`);
    await sleep(300);

    // ── AUDIT 5: PRODUCTION DB INTEGRITY ──
    console.log("\n--- [Audit 5: Database Integrity Check] ---");
    const finalHash = computeHash(PROD_DB_PATH);
    console.log(`[+] Final Production DB Hash: ${finalHash}`);
    assert.strictEqual(finalHash, initialHash, "Production DB hash was modified during test!");

    console.log("\n======================================================================");
    console.log("  ALL PROGRESS PAGE UI AUDIT CHECKS PASSED (100% SUCCESS)              ");
    console.log("======================================================================");
  } finally {
    cdp.close();
    try {
      browserProc.kill();
    } catch (e) {}
    try {
      backendProc.kill();
    } catch (e) {}
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }
}

runTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
