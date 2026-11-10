/**
 * PREPMATE — REAL EDGE/CDP VISUAL AUDIT: WI-GLOBAL-UI-DENSITY-BALANCE-01
 * Measures component dimensions, padding, margins, font sizes, and proportions
 * at 80% (benchmark), 90%, and 100% zoom levels across key PrepMate pages.
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const http = require("http");
const os = require("os");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5099;
const CDP_PORT = 9299;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const TEST_DIR = path.join(os.tmpdir(), `prepmate_density_audit_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, "isolated_test_db.json");
const TEST_KEYRING_PATH = path.join(TEST_DIR, "test_keys");
const SCREENSHOT_DIR = path.join(WORKSPACE_ROOT, "tests", "audit-artifacts", "screenshots");
const REPORT_OUTPUT_PATH = path.join(WORKSPACE_ROOT, "tests", "audit-artifacts", "global-density-audit-01-report.json");

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

  async setViewport(width, height) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
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

async function auditLiveInterview(cdp, zoomLevel) {
  await sleep(400);

  return await cdp.eval(`
    (() => {
      const stageArea = document.querySelector(".ir-stage-area");
      const videoGrid = document.querySelector(".ir-video-grid");
      const aiTile = document.getElementById("interviewer-tile");
      const cTile = document.getElementById("candidate-tile");
      const questionStage = document.querySelector(".ir-question-stage");
      const questionText = document.getElementById("current-question-text");
      const responseConsole = document.querySelector(".ir-response-console");
      const userInput = document.getElementById("user-input");
      const consoleMic = document.getElementById("btn-console-mic");
      const btnSend = document.getElementById("btn-send");
      const hud = document.querySelector(".ir-top-hud");

      const getRect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return {
          width: Math.round(r.width),
          height: Math.round(r.height),
          top: Math.round(r.top),
          left: Math.round(r.left),
          padding: s.padding,
          margin: s.margin,
          fontSize: s.fontSize,
          lineHeight: s.lineHeight,
        };
      };

      return {
        url: window.location.href,
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        },
        hud: getRect(hud),
        stageArea: getRect(stageArea),
        videoGrid: getRect(videoGrid),
        aiTile: getRect(aiTile),
        candidateTile: getRect(cTile),
        questionStage: getRect(questionStage),
        questionText: getRect(questionText),
        responseConsole: getRect(responseConsole),
        userInput: getRect(userInput),
        consoleMic: getRect(consoleMic),
        btnSend: getRect(btnSend),
        ratioResponseToStage: (responseConsole && stageArea) ? ((responseConsole.getBoundingClientRect().height / stageArea.getBoundingClientRect().height) * 100).toFixed(1) + "%" : null,
        ratioVideoToStage: (videoGrid && stageArea) ? ((videoGrid.getBoundingClientRect().height / stageArea.getBoundingClientRect().height) * 100).toFixed(1) + "%" : null,
      };
    })()
  `);
}

async function auditSetupPage(cdp) {
  return await cdp.eval(`
    (() => {
      const card = document.querySelector(".chamber-card") || document.querySelector(".setup-section-card");
      const summaryCard = document.querySelector(".readiness-summary-card");
      const aiCard = document.getElementById("ai-intelligence-card");
      const primaryCta = document.getElementById("launch-action-card");
      const btnStart = document.getElementById("btn-start-interview");
      const stickyBar = document.getElementById("step4-sticky-action-bar");

      const getRect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return {
          width: Math.round(r.width),
          height: Math.round(r.height),
          padding: s.padding,
          margin: s.margin,
          fontSize: s.fontSize,
        };
      };

      return {
        card: getRect(card),
        summaryCard: getRect(summaryCard),
        aiCard: getRect(aiCard),
        primaryCta: getRect(primaryCta),
        btnStart: getRect(btnStart),
        stickyBar: getRect(stickyBar),
      };
    })()
  `);
}

async function main() {
  console.log("======================================================================");
  console.log("  PREPMATE — 80% VISUAL BENCHMARK & GLOBAL DENSITY AUDIT (CDP)       ");
  console.log("======================================================================\n");

  const browserExe = findBrowserExecutable();
  assert.ok(browserExe, "Compatible Edge or Chrome browser executable required");

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

    console.log(`[1] Launching isolated backend on port ${BACKEND_PORT}...`);
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
        const ping = await requestJsonOnce(`${BASE_URL}/features/interview/interview-practice.html`);
        if (ping.status === 200) {
          backendReady = true;
          break;
        }
      } catch (e) {}
    }
    assert.ok(backendReady, "Backend failed to start within timeout");
    console.log("[PASS] Isolated backend is live.");

    const userDataDir = path.join(TEST_DIR, "edge_profile");
    console.log(`[2] Launching browser on CDP port ${CDP_PORT}...`);
    browserProc = spawn(browserExe, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
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
        try {
          sessionStorage.setItem("interview_init_data", JSON.stringify({
            jobTitle: "Senior Frontend Engineer",
            companyName: "TechCorp Global",
            interviewRound: "round2",
            industryId: "software-tech",
            experienceLevel: "Senior",
            targetLevel: "Senior",
            cvText: "React, TypeScript, CSS Architecture",
            jdText: "Senior Frontend Engineer"
          }));
        } catch(e) {}
      `,
    });
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const report = {
      timestamp: new Date().toISOString(),
      viewport: { width: 1440, height: 900 },
      liveInterview: {},
      interviewSetup: {},
      dashboard: {},
    };

    // 1. Audit Live Interview at 100% (Baseline)
    console.log("\n[3] Auditing Live Interview (100% zoom)...");
    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/interview/interview-practice.html` });
    await sleep(1500);
    const live100 = await auditLiveInterview(cdp, 1.0);
    report.liveInterview.zoom100 = live100;
    const shotLive100 = path.join(SCREENSHOT_DIR, "wi-density-live-100-before.png");
    await cdp.captureScreenshot(shotLive100);
    console.log(`   Captured: ${shotLive100}`);
    console.log(`   Response Console: ${live100.responseConsole?.width}x${live100.responseConsole?.height}px (Ratio to stage: ${live100.ratioResponseToStage})`);
    console.log(`   User Input: ${live100.userInput?.width}x${live100.userInput?.height}px (padding: ${live100.userInput?.padding})`);
    console.log(`   Video Grid: ${live100.videoGrid?.width}x${live100.videoGrid?.height}px (Ratio to stage: ${live100.ratioVideoToStage})`);

    // 2. Audit Live Interview at 80% (Benchmark)
    console.log("\n[4] Auditing Live Interview (80% benchmark)...");
    // At 80% zoom on 1440x900 physical window, effective CSS viewport becomes 1800x1125
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: Math.round(1440 / 0.8),
      height: Math.round(900 / 0.8),
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(400);
    const live80 = await auditLiveInterview(cdp, 0.8);
    report.liveInterview.zoom80 = live80;
    const shotLive80 = path.join(SCREENSHOT_DIR, "wi-density-live-80-benchmark.png");
    await cdp.captureScreenshot(shotLive80);
    console.log(`   Captured: ${shotLive80}`);
    console.log(`   Response Console at 80%: ${live80.responseConsole?.width}x${live80.responseConsole?.height}px (Ratio to stage: ${live80.ratioResponseToStage})`);

    // Reset viewport to 1440x900
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 3. Audit Interview Setup (Step 4)
    console.log("\n[5] Auditing Interview Setup Step 4...");
    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/interview/interview-info.html` });
    await sleep(1500);
    await cdp.eval(`
      sessionStorage.setItem("interview_init_data", JSON.stringify({
        jobTitle: "Senior Frontend Engineer",
        companyName: "TechCorp Global",
        interviewRound: "round2",
        industryId: "software-tech",
        experienceLevel: "Senior",
      }));
      const jobInput = document.getElementById("job-title");
      if (jobInput) {
        jobInput.value = "Senior Frontend Engineer";
        jobInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      goToStep(4, true);
      updateReadinessSummary();
      window.scrollTo(0, 0);
    `);
    await sleep(500);

    const setup100 = await auditSetupPage(cdp);
    report.interviewSetup.zoom100 = setup100;
    const shotSetup100 = path.join(SCREENSHOT_DIR, "wi-density-setup-100-before.png");
    await cdp.captureScreenshot(shotSetup100);
    console.log(`   Captured: ${shotSetup100}`);
    console.log(`   AI Preview Card height: ${setup100.aiCard?.height}px, padding: ${setup100.aiCard?.padding}`);
    console.log(`   Summary Card height: ${setup100.summaryCard?.height}px, padding: ${setup100.summaryCard?.padding}`);

    // Audit Setup at 80% benchmark
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: Math.round(1440 / 0.8),
      height: Math.round(900 / 0.8),
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(400);
    const setup80 = await auditSetupPage(cdp);
    report.interviewSetup.zoom80 = setup80;
    const shotSetup80 = path.join(SCREENSHOT_DIR, "wi-density-setup-80-benchmark.png");
    await cdp.captureScreenshot(shotSetup80);
    console.log(`   Captured: ${shotSetup80}`);

    // Reset to 1440x900
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 4. Audit Dashboard
    console.log("\n[6] Auditing Dashboard...");
    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/dashboard/new-dashboard.html` });
    await sleep(1500);
    const dash100 = await cdp.eval(`
      (() => {
        const hero = document.querySelector(".dashboard-hero") || document.querySelector(".hero-section");
        const cards = Array.from(document.querySelectorAll(".stat-card, .metric-card, .dashboard-card, .pm-card"));
        return {
          cardCount: cards.length,
          heroHeight: hero ? hero.getBoundingClientRect().height : 0,
          firstCard: cards.length > 0 ? {
            width: cards[0].getBoundingClientRect().width,
            height: cards[0].getBoundingClientRect().height,
            padding: window.getComputedStyle(cards[0]).padding,
          } : null,
        };
      })()
    `);
    report.dashboard.zoom100 = dash100;
    const shotDash100 = path.join(SCREENSHOT_DIR, "wi-density-dashboard-100-before.png");
    await cdp.captureScreenshot(shotDash100);
    console.log(`   Captured: ${shotDash100}`);

    fs.writeFileSync(REPORT_OUTPUT_PATH, JSON.stringify(report, null, 2));
    console.log(`\n[PASS] Baseline density report saved to: ${REPORT_OUTPUT_PATH}`);

  } finally {
    if (cdp) {
      try { await cdp.close(); } catch (e) {}
    }
    if (browserProc) {
      try { browserProc.kill(); } catch (e) {}
    }
    if (backendProc) {
      try { backendProc.kill(); } catch (e) {}
    }
    try {
      if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      }
    } catch (e) {}
  }
}

main().catch((err) => {
  console.error("[FATAL AUDIT ERROR]:", err);
  process.exit(1);
});
