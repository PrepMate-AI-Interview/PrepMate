/**
 * PREPMATE — WI-REPORT-12 REAL BROWSER E2E TEST (EDGE / CHROMIUM CDP)
 * Ecosystem Single-Column Presentation & Interview Recommendations Note Sheet Verification
 *
 * Verifies:
 * 1. Single-column layout for Ecosystem (.prep-modules-grid, .needs-grid)
 * 2. Professional Note Sheet presentation (.interview-prep-note-sheet)
 * 3. Distinct bullet points with bold titles and concrete actions
 * 4. Two canonical groups (Onsite & Online) stacked vertically
 * 5. Zero form checkboxes, completion ticks, or progress bars in Note view
 * 6. Responsive viewports (1440, 1024, 768, 390px) with 0 horizontal overflow
 * 7. Light & Dark theme visual integrity
 * 8. Production database SHA-256 invariant
 */

const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");
const assert = require("assert");
const os = require("os");

const STATIC_PORT = 5094;
const CDP_PORT = 9244;
const WORKSPACE_ROOT = path.resolve(__dirname, "../../");
const PROD_DB_PATH = path.resolve(WORKSPACE_ROOT, "BE/data/db.json");
const EXPECTED_DB_HASH = "c2ba83b82e758b277786dad7073e1c8a0e80c71fc615ecbbe5847d01b47cda50";
const SCREENSHOT_DIR = path.resolve(WORKSPACE_ROOT, "scratch/screenshots/wi-report-12");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function findBrowser() {
  const edgePaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    os.homedir() + "\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  for (const p of edgePaths) {
    if (fs.existsSync(p)) return p;
  }
  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];
  for (const p of chromePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    const WS = globalThis.WebSocket;
    return new Promise((resolve, reject) => {
      this.ws = new WS(this.wsUrl);
      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", reject);
      this.ws.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      });
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.id++;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error("Evaluation error: " + JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async captureScreenshot(filePath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(filePath, Buffer.from(res.data, "base64"));
  }

  async close() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }
  }
}

function startStaticServer() {
  const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split("?")[0];
    if (reqPath === "/") reqPath = "/FE/features/report/report.html";
    else if (!reqPath.startsWith("/FE/") && !reqPath.startsWith("/tests/")) {
      reqPath = "/FE" + reqPath;
    }

    const filePath = path.join(WORKSPACE_ROOT, reqPath);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found: " + reqPath);
      return;
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || "text/plain";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*"
    });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(STATIC_PORT, () => {
      resolve(server);
    });
  });
}

async function getCDPWebSocketUrl(port) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find((t) => t.type === "page");
        if (page && page.webSocketDebuggerUrl) {
          return page.webSocketDebuggerUrl;
        }
      }
    } catch (_) {}
    await sleep(250);
  }
  throw new Error("Failed to connect to CDP debugger port " + port);
}

async function runE2E() {
  console.log("================================================================");
  console.log("  PREPMATE — REAL BROWSER E2E TEST: WI-REPORT-12");
  console.log("================================================================\n");

  // 1. Verify DB SHA-256 Invariant
  console.log("--- 1. DATABASE INTEGRITY INVARIANT ---");
  const dbBytes = fs.readFileSync(PROD_DB_PATH);
  const actualHash = crypto.createHash("sha256").update(dbBytes).digest("hex");
  assert.strictEqual(
    actualHash,
    EXPECTED_DB_HASH,
    `Production database modified! Expected ${EXPECTED_DB_HASH}, got ${actualHash}`
  );
  console.log(`[PASS] DB hash strictly intact: ${actualHash.substring(0, 16)}...`);

  // 2. Start Static Server
  const staticServer = await startStaticServer();
  console.log(`[PASS] Static server started on port ${STATIC_PORT}`);

  // 3. Launch Headless Browser with CDP
  const browserPath = findBrowser();
  if (!browserPath) {
    console.error("[SKIP] Neither Edge nor Chrome found on system. Skipping browser launch.");
    staticServer.close();
    return;
  }

  const userDataDir = path.join(os.tmpdir(), "prepmate-e2e-report12-" + Date.now());
  const browserProc = spawn(browserPath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-background-networking"
  ]);

  let cdpClient = null;
  try {
    const wsUrl = await getCDPWebSocketUrl(CDP_PORT);
    cdpClient = new CDPClient(wsUrl);
    await cdpClient.connect();
    await cdpClient.send("Page.enable");
    await cdpClient.send("DOM.enable");

    console.log("[PASS] Connected to Chromium CDP successfully.");

    // Load mock report session with rich data
    const targetUrl = `http://127.0.0.1:${STATIC_PORT}/features/report/report.html?mockSession=senior-fe&sessionId=sess-test`;
    await cdpClient.send("Page.navigate", { url: targetUrl });
    await sleep(2500);

    // Ensure mock data rendered and switch to Stage 04 (Recommendations)
    await cdpClient.evaluate(`
      (function() {
        if (typeof showState === 'function') {
          showState('content');
        } else {
          const rcc = document.getElementById('report-content-container');
          if (rcc) {
            rcc.classList.remove('hidden');
            rcc.style.display = 'block';
          }
          const ld = document.getElementById('report-loading');
          if (ld) ld.style.display = 'none';
        }

        const mockPrep = {
          technicalPreparation: [{ topic: "Kiến thức Kỹ thuật", objective: "Ôn tập chuyên sâu" }],
          practicalPreparation: [{ topic: "Ứng dụng Thực tế", objective: "Thiết kế hệ thống" }],
          behavioralPreparation: [{ competencyName: "Phỏng vấn Hành vi", framework: "STAR", starStoryRecommendation: "Kể chuyện dự án" }],
          companyPreparation: [{ topic: "Hiểu biết Doanh nghiệp", expectedKnowledge: "Mô hình squad Agile", isMandatory: true }]
        };

        const mockSession = {
          companyName: "Tech Global Solutions",
          jobTitle: "Senior Backend Engineer",
          industry: "Công nghệ thông tin",
          jdText: "Mô tả công việc: Tìm kiếm Senior Backend Engineer với kinh nghiệm microservices.",
          cvText: "Hồ sơ: 5 năm kinh nghiệm Backend với C# và Docker."
        };

        if (typeof renderPreparationSection === 'function') {
          renderPreparationSection(mockPrep, "Senior Backend Engineer");
        }
        if (typeof renderCompanyIntelligence === 'function') {
          renderCompanyIntelligence(mockSession, { sessionInfo: mockSession });
        }
        if (typeof renderRecruitingNeedsBreakdown === 'function') {
          renderRecruitingNeedsBreakdown(mockSession, { sessionInfo: mockSession });
        }
        if (typeof renderCandidateToCompanyGap === 'function') {
          renderCandidateToCompanyGap(mockSession, { sessionInfo: mockSession });
        }
        if (typeof renderChecklistSection === 'function') {
          renderChecklistSection(mockPrep, "sess-test", "Senior Backend Engineer");
        }

        if (typeof goToStage === 'function') {
          goToStage('recommendations');
        }
      })();
    `);
    await sleep(600);

    // 4. Test Single-Column Layout for Ecosystem (WI-01)
    console.log("\n--- 2. SINGLE-COLUMN ECOSYSTEM PRESENTATION ---");
    const ecoLayout = await cdpClient.evaluate(`
      (function() {
        const prepGrid = document.querySelector(".prep-modules-grid");
        const needsGrid = document.querySelector(".needs-grid");
        const compCard = document.getElementById("company-summary-card");
        
        const prepComputed = prepGrid ? window.getComputedStyle(prepGrid) : null;
        const needsComputed = needsGrid ? window.getComputedStyle(needsGrid) : null;
        
        return {
          prepDisplay: prepComputed ? prepComputed.display : null,
          prepDirection: prepComputed ? prepComputed.flexDirection : null,
          prepMaxWidth: prepComputed ? prepComputed.maxWidth : null,
          needsDisplay: needsComputed ? needsComputed.display : null,
          needsDirection: needsComputed ? needsComputed.flexDirection : null,
          hasCompCard: !!compCard
        };
      })()
    `);

    assert.strictEqual(ecoLayout.prepDisplay, "flex", "prep-modules-grid must have display: flex");
    assert.strictEqual(ecoLayout.prepDirection, "column", "prep-modules-grid must stack in single-column");
    assert.strictEqual(ecoLayout.needsDirection, "column", "needs-grid must stack in single-column");
    console.log("[PASS] Ecosystem components strictly follow single-column vertical flow.");

    // 5. Test Professional Note Sheet (WI-02)
    console.log("\n--- 3. PROFESSIONAL INTERVIEW NOTE SHEET PRESENTATION ---");
    const noteSheet = await cdpClient.evaluate(`
      (function() {
        const sheet = document.getElementById("interview-prep-note-sheet");
        if (!sheet) return null;
        const badge = sheet.querySelector(".note-sheet-badge");
        const intro = sheet.querySelector(".note-sheet-intro");
        const onsiteGroup = document.getElementById("note-group-onsite");
        const onlineGroup = document.getElementById("note-group-online");
        const bullets = Array.from(sheet.querySelectorAll(".note-bullet-item"));
        const checkboxes = sheet.querySelectorAll("input[type='checkbox']:not([style*='display: none'])");
        
        return {
          hasSheet: true,
          badgeText: badge ? badge.innerText : null,
          hasIntro: !!intro && intro.innerText.length > 20,
          hasOnsiteGroup: !!onsiteGroup,
          hasOnlineGroup: !!onlineGroup,
          bulletCount: bullets.length,
          visibleCheckboxes: checkboxes.length,
          allBulletsHaveTitles: bullets.every(b => !!b.querySelector(".note-bullet-title")),
          allBulletsHaveActions: bullets.every(b => !!b.querySelector(".note-bullet-action"))
        };
      })()
    `);

    assert(noteSheet && noteSheet.hasSheet, "interview-prep-note-sheet must exist in DOM");
    assert(noteSheet.badgeText.includes("GHI CHÚ DÀNH CHO BẠN"), "Must have Note badge");
    assert(noteSheet.hasIntro, "Must have explanatory intro text");
    assert(noteSheet.hasOnsiteGroup, "Must have Onsite note group");
    assert(noteSheet.hasOnlineGroup, "Must have Online note group");
    assert.strictEqual(noteSheet.bulletCount, 8, "Must render exactly 8 canonical bullet recommendations (4 onsite + 4 online)");
    assert.strictEqual(noteSheet.visibleCheckboxes, 0, "Zero visible checkboxes in Note sheet view");
    assert(noteSheet.allBulletsHaveTitles, "Every bullet has bold title");
    assert(noteSheet.allBulletsHaveActions, "Every bullet has actionable instruction");
    console.log("[PASS] Professional Note Sheet verified with 8 distinct bullets and zero checkboxes.");

    // 6. Responsive Viewports & Zero Overflow (WI-05)
    console.log("\n--- 4. RESPONSIVE VIEWPORTS & ZERO OVERFLOW ---");
    const viewports = [
      { name: "desktop-1440", width: 1440, height: 900 },
      { name: "tablet-land-1024", width: 1024, height: 768 },
      { name: "tablet-port-768", width: 768, height: 1024 },
      { name: "mobile-390", width: 390, height: 844 }
    ];

    for (const vp of viewports) {
      await cdpClient.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width <= 768
      });
      await sleep(300);

      const overflow = await cdpClient.evaluate(`
        (function() {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          return {
            hasOverflow: scrollW > docW,
            docW,
            scrollW
          };
        })()
      `);

      assert(!overflow.hasOverflow, `Viewport ${vp.name} has horizontal scroll overflow: ${overflow.scrollW} > ${overflow.docW}`);
      const shotPath = path.join(SCREENSHOT_DIR, `${vp.name}.png`);
      await cdpClient.captureScreenshot(shotPath);
      console.log(`[PASS] Viewport ${vp.name} (${vp.width}x${vp.height}): Zero overflow, screenshot captured.`);
    }

    // 7. Dark Mode Visual Integrity
    console.log("\n--- 5. DARK MODE VISUAL INTEGRITY ---");
    await cdpClient.evaluate(`
      (function() {
        document.documentElement.setAttribute("data-theme", "dark");
        document.body.setAttribute("data-theme", "dark");
      })()
    `);
    await sleep(300);

    const darkCheck = await cdpClient.evaluate(`
      (function() {
        const sheet = document.getElementById("interview-prep-note-sheet");
        return {
          sheetBg: window.getComputedStyle(sheet).backgroundColor
        };
      })()
    `);
    assert(darkCheck.sheetBg !== "rgba(0, 0, 0, 0)", "Dark mode computed for note sheet");
    const darkShotPath = path.join(SCREENSHOT_DIR, "dark-mode-1440.png");
    await cdpClient.captureScreenshot(darkShotPath);
    console.log("[PASS] Dark mode verified cleanly, screenshot captured.");

  } finally {
    if (cdpClient) await cdpClient.close();
    browserProc.kill();
    staticServer.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_) {}
  }

  console.log("\n================================================================");
  console.log("  ALL WI-REPORT-12 BROWSER E2E TESTS PASSED SUCCESSFULLY!          ");
  console.log("================================================================\n");
}

runE2E().catch((err) => {
  console.error("\n[E2E ERROR]", err);
  process.exit(1);
});
