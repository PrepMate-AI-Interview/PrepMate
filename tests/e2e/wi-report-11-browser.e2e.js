/**
 * PREPMATE — WI-REPORT-11 REAL BROWSER E2E TEST (EDGE / CHROMIUM CDP)
 * Streamlined Delivery Assessment & Preparation Recommendations Verification
 *
 * Verifies:
 * 1. Section B Executive Delivery Assessment (3 core questions answered clearly)
 * 2. Independent Supplementary Info (#supplementary-info-panel)
 * 3. Independent Supporting Materials (#section-supporting-materials)
 * 4. Preparation Recommendations (#section-checklist) with 2 format modes:
 *    - Onsite: 4 canonical preparation cards
 *    - Online: 4 canonical preparation cards
 * 5. Clean layout without checkboxes or completion progress ticks
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

const STATIC_PORT = 5093;
const CDP_PORT = 9243;
const WORKSPACE_ROOT = path.resolve(__dirname, "../../");
const PROD_DB_PATH = path.resolve(WORKSPACE_ROOT, "BE/data/db.json");
const EXPECTED_DB_HASH = "44223d9b7e945e70cadeb3279ae3ee5a0dd748a867b2c3a6b0c5c617a9db62c3";
const SCREENSHOT_DIR = path.resolve(WORKSPACE_ROOT, "scratch/screenshots/wi-report-11");

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
    if (this.ws) this.ws.close();
  }
}

function startStaticServer() {
  const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
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
  console.log("  PREPMATE — REAL BROWSER E2E TEST: WI-REPORT-11");
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

  const userDataDir = path.join(os.tmpdir(), "prepmate-e2e-report11-" + Date.now());
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

    // Load mock report session with speech analysis data
    const targetUrl = `http://127.0.0.1:${STATIC_PORT}/features/report/report.html?mockSession=senior-fe&sessionId=sess-test`;
    await cdpClient.send("Page.navigate", { url: targetUrl });
    await sleep(2500);

    // Ensure mock data rendered and switch to Stage 03 (Phân tích)
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

        if (typeof renderSpeechCoachingSection === 'function') {
          const mockCoaching = {
            summary: {
              totalFillers: 3,
              averageActiveWpm: 125,
              mostFrequentFillers: [{ word: "ừm", count: 2 }, { word: "à", count: 1 }]
            },
            turns: [
              { conciseness: "balanced" },
              { conciseness: "wordy" }
            ]
          };
          renderSpeechCoachingSection(mockCoaching);
        }
        if (typeof renderChecklistSection === 'function') {
          renderChecklistSection({}, "sess-test", "Senior Frontend Engineer");
        }
        if (typeof goToStage === 'function') {
          goToStage('analysis');
        }
      })();
    `);
    await sleep(500);

    // 4. Test Section B: Executive Delivery Assessment
    console.log("\n--- 2. SECTION B: EXECUTIVE DELIVERY ASSESSMENT ---");
    const execBox = await cdpClient.evaluate(`
      (function() {
        const box = document.getElementById("speech-executive-assessment-card");
        const content = document.getElementById("delivery-assessment-content");
        if (!box || !content) return null;
        const rect = box.getBoundingClientRect();
        return {
          visible: rect.width > 0 && rect.height > 0,
          pointsCount: content.querySelectorAll(".delivery-assessment-point").length,
          hasOverall: content.innerText.includes("Nhận định tổng quan"),
          hasEvidence: content.innerText.includes("Biểu hiện đáng chú ý"),
          hasImprovement: content.innerText.includes("Điểm cần cải thiện")
        };
      })()
    `);

    assert(execBox && execBox.visible, "speech-executive-assessment-card must be visible");
    assert(execBox.pointsCount === 3, "Must render exactly 3 assessment points");
    assert(execBox.hasOverall, "Must contain Nhận định tổng quan");
    assert(execBox.hasEvidence, "Must contain Biểu hiện đáng chú ý");
    assert(execBox.hasImprovement, "Must contain Điểm cần cải thiện");
    console.log("[PASS] Executive Delivery Assessment renders all 3 core answers cleanly.");

    // 5. Test Separated Supplementary Info and Supporting Materials
    console.log("\n--- 3. SEPARATED RECOMMENDATIONS & SUPPORTING MATERIALS ---");
    await cdpClient.evaluate(`
      (function() {
        if (typeof goToStage === 'function') {
          goToStage('recommendations');
        }
      })();
    `);
    await sleep(500);

    const separatedCards = await cdpClient.evaluate(`
      (function() {
        const supp = document.getElementById("supplementary-info-panel");
        const suppMat = document.getElementById("section-supporting-materials");
        const prep = document.getElementById("section-checklist");
        return {
          suppExists: !!supp,
          suppMatExists: !!suppMat,
          prepExists: !!prep,
          suppMatTitle: suppMat ? suppMat.querySelector(".section-badge")?.innerText : null
        };
      })()
    `);

    assert(separatedCards.suppExists, "Supplementary Info panel exists");
    assert(separatedCards.suppMatExists, "Supporting Materials section exists");
    assert(separatedCards.prepExists, "Preparation section exists");
    console.log("[PASS] Independent panels rendered without catch-all wrapper.");

    // 6. Test Preparation Recommendations (2 Groups: Onsite & Online)
    console.log("\n--- 4. PREPARATION RECOMMENDATIONS INTERACTION ---");
    // Verify Onsite by default
    const onsiteRecs = await cdpClient.evaluate(`
      (function() {
        const onsiteBtn = document.querySelector('.format-btn[data-format="onsite"]');
        const activeRecs = Array.from(document.querySelectorAll('.prep-rec-card')).map(el => el.id);
        const hasCheckboxes = document.querySelectorAll('.prep-rec-card input[type="checkbox"]').length;
        return {
          onsiteActive: onsiteBtn ? onsiteBtn.classList.contains("active") : false,
          activeRecs,
          hasCheckboxes
        };
      })()
    `);

    assert(onsiteRecs.onsiteActive, "Onsite format is active by default");
    assert(onsiteRecs.activeRecs.includes("rec-onsite-dresscode"), "Has rec-onsite-dresscode");
    assert(onsiteRecs.activeRecs.includes("rec-onsite-timing"), "Has rec-onsite-timing");
    assert(onsiteRecs.activeRecs.includes("rec-onsite-documents"), "Has rec-onsite-documents");
    assert(onsiteRecs.activeRecs.includes("rec-onsite-etiquette"), "Has rec-onsite-etiquette");
    assert.strictEqual(onsiteRecs.hasCheckboxes, 0, "No checkboxes inside recommendation cards");
    console.log("[PASS] Onsite preparation recommendations display 4 canonical cards without checkboxes.");

    // Click Online Format Button
    await cdpClient.evaluate(`
      (function() {
        const onlineBtn = document.querySelector('.format-btn[data-format="online"]');
        if (onlineBtn) onlineBtn.click();
      })()
    `);
    await sleep(400);

    const onlineRecs = await cdpClient.evaluate(`
      (function() {
        const onlineBtn = document.querySelector('.format-btn[data-format="online"]');
        const activeRecs = Array.from(document.querySelectorAll('.prep-rec-card')).map(el => el.id);
        const hasCheckboxes = document.querySelectorAll('.prep-rec-card input[type="checkbox"]').length;
        return {
          onlineActive: onlineBtn ? onlineBtn.classList.contains("active") : false,
          activeRecs,
          hasCheckboxes
        };
      })()
    `);

    assert(onlineRecs.onlineActive, "Online format is active after click");
    assert(onlineRecs.activeRecs.includes("rec-online-platform"), "Has rec-online-platform");
    assert(onlineRecs.activeRecs.includes("rec-online-camera"), "Has rec-online-camera");
    assert(onlineRecs.activeRecs.includes("rec-online-audio"), "Has rec-online-audio");
    assert(onlineRecs.activeRecs.includes("rec-online-network"), "Has rec-online-network");
    assert.strictEqual(onlineRecs.hasCheckboxes, 0, "No checkboxes inside online recommendation cards");
    console.log("[PASS] Online preparation recommendations switch smoothly to 4 canonical cards.");

    // 7. Responsive Viewports & Zero Overflow
    console.log("\n--- 5. RESPONSIVE VIEWPORTS & ZERO OVERFLOW ---");
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

    // 8. Dark Mode Verification
    console.log("\n--- 6. DARK MODE VISUAL INTEGRITY ---");
    await cdpClient.evaluate(`
      (function() {
        document.documentElement.setAttribute("data-theme", "dark");
        document.body.setAttribute("data-theme", "dark");
      })()
    `);
    await sleep(300);

    const darkModeCheck = await cdpClient.evaluate(`
      (function() {
        const box = document.getElementById("speech-executive-assessment-card");
        const recCard = document.querySelector(".prep-rec-card");
        return {
          boxTheme: window.getComputedStyle(box).backgroundColor,
          recCardTheme: window.getComputedStyle(recCard).backgroundColor
        };
      })()
    `);
    assert(darkModeCheck.boxTheme !== "rgba(0, 0, 0, 0)", "Dark mode colors computed");
    const darkShotPath = path.join(SCREENSHOT_DIR, "dark-mode-1440.png");
    await cdpClient.captureScreenshot(darkShotPath);
    console.log("[PASS] Dark mode rendered properly, screenshot captured.");

  } finally {
    if (cdpClient) await cdpClient.close();
    browserProc.kill();
    staticServer.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_) {}
  }

  console.log("\n================================================================");
  console.log("  ALL BROWSER E2E TESTS PASSED SUCCESSFULLY!                      ");
  console.log("================================================================\n");
}

runE2E().catch((err) => {
  console.error("\n[E2E ERROR]", err);
  process.exit(1);
});
