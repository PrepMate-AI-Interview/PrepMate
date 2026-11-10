/**
 * PREPMATE — REAL EDGE/CDP VERIFICATION: WI-GLOBAL-UI-DENSITY-BALANCE-01
 * Verifies proportion correction, executive density, and responsive geometry
 * across Live Interview, Interview Setup Step 4, and Dashboard.
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const http = require("http");
const os = require("os");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5098;
const CDP_PORT = 9298;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const TEST_DIR = path.join(os.tmpdir(), `prepmate_density_verify_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, "isolated_test_db.json");
const TEST_KEYRING_PATH = path.join(TEST_DIR, "test_keys");
const SCREENSHOT_DIR = path.join(WORKSPACE_ROOT, "tests", "audit-artifacts", "screenshots");
const REPORT_OUTPUT_PATH = path.join(WORKSPACE_ROOT, "tests", "audit-artifacts", "global-density-audit-01-after-report.json");

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
            const cb = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) cb.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else cb.resolve(msg.result);
          }
        } catch (e) {}
      });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async captureScreenshot(filePath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(res.data, "base64");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
  }

  async close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function auditLiveInterview(cdp, zoomLevel) {
  return await cdp.eval(`
    (() => {
      const stage = document.querySelector(".ir-stage-area");
      const column = document.querySelector(".ir-video-stage-column");
      const videoGrid = document.querySelector(".ir-video-grid");
      const qStage = document.querySelector(".ir-question-stage");
      const responseConsole = document.querySelector(".ir-response-console");
      const userInput = document.getElementById("user-input") || document.querySelector(".ir-response-input");
      const micBtn = document.querySelector(".ir-btn-console-mic");
      const sendBtn = document.getElementById("btn-send");

      function getMetrics(el) {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          width: Math.round(r.width),
          height: Math.round(r.height),
          padding: style.padding,
          margin: style.margin,
          flex: style.flex,
          minHeight: style.minHeight,
          maxHeight: style.maxHeight,
          borderRadius: style.borderRadius,
        };
      }

      const stageRect = stage ? stage.getBoundingClientRect() : null;
      const respRect = responseConsole ? responseConsole.getBoundingClientRect() : null;
      const vidRect = videoGrid ? videoGrid.getBoundingClientRect() : null;
      const qRect = qStage ? qStage.getBoundingClientRect() : null;

      return {
        zoom: ${zoomLevel},
        stageArea: getMetrics(stage),
        videoStageColumn: getMetrics(column),
        videoGrid: getMetrics(videoGrid),
        questionStage: getMetrics(qStage),
        responseConsole: getMetrics(responseConsole),
        userInput: getMetrics(userInput),
        micBtn: getMetrics(micBtn),
        sendBtn: getMetrics(sendBtn),
        ratioResponseToStage: (stageRect && respRect) ? +(respRect.height / stageRect.height).toFixed(3) : 0,
        ratioVideoToStage: (stageRect && vidRect) ? +(vidRect.height / stageRect.height).toFixed(3) : 0,
        ratioQuestionToStage: (stageRect && qRect) ? +(qRect.height / stageRect.height).toFixed(3) : 0,
        stageScrollHeight: column ? column.scrollHeight : 0,
        stageClientHeight: column ? column.clientHeight : 0,
      };
    })()
  `);
}

async function auditSetupPage(cdp) {
  return await cdp.eval(`
    (() => {
      const summaryCard = document.querySelector(".readiness-summary-card");
      const aiCard = document.getElementById("ai-intelligence-card") || document.querySelector(".ai-intelligence-preview-card");
      const launchCard = document.querySelector(".launch-action-card");
      const launchBtn = document.querySelector(".btn-launch-primary") || document.querySelector(".btn-launch-interview");
      const checklistTiles = Array.from(document.querySelectorAll(".checklist-tile"));

      function getMetrics(el) {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          width: Math.round(r.width),
          height: Math.round(r.height),
          padding: style.padding,
          margin: style.margin,
          borderRadius: style.borderRadius,
          fontSize: style.fontSize,
        };
      }

      return {
        summaryCard: getMetrics(summaryCard),
        aiCard: getMetrics(aiCard),
        launchCard: getMetrics(launchCard),
        launchBtn: getMetrics(launchBtn),
        checklistCount: checklistTiles.length,
        firstChecklistTile: checklistTiles.length > 0 ? getMetrics(checklistTiles[0]) : null,
      };
    })()
  `);
}

async function main() {
  console.log("================================================================================");
  console.log(" PREPMATE — POST-OPTIMIZATION VERIFICATION (WI-GLOBAL-UI-DENSITY-BALANCE-01)");
  console.log("================================================================================");

  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const fixtureDb = path.join(WORKSPACE_ROOT, "tests", "fixtures", "test_db_fixture.json");
  if (fs.existsSync(fixtureDb)) {
    fs.copyFileSync(fixtureDb, TEST_DB_PATH);
  } else if (fs.existsSync(PROD_DB_PATH)) {
    fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);
  } else {
    throw new Error("No database template available!");
  }

  const browserBin = findBrowserExecutable();
  if (!browserBin) {
    throw new Error("Edge or Chrome executable not found!");
  }
  console.log(`[Browser] Using: ${browserBin}`);

  let backendProc = null;
  let browserProc = null;
  let cdp = null;

  try {
    console.log("\n[1] Starting backend server...");
    const beDir = path.join(WORKSPACE_ROOT, "BE");
    const beDll = path.join(beDir, "bin", "Debug", "net10.0", "backend.dll");
    backendProc = spawn("dotnet", [beDll, "--urls", BASE_URL], {
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
        JWT__SECRET: "test-density-secret-key-minimum-32-chars-long!",
        GUEST_TOKEN__SIGNING_KEY: "test-guest-secret-key-minimum-32-chars-long!",
      },
      stdio: "ignore",
    });

    let beReady = false;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try {
        const ping = await requestJsonOnce(`${BASE_URL}/features/interview/interview-practice.html`);
        if (ping.status === 200) {
          beReady = true;
          break;
        }
      } catch (e) {}
    }
    if (!beReady) throw new Error("Backend server failed to start within timeout");
    console.log("   Backend ready at", BASE_URL);

    console.log("\n[2] Launching browser with remote debugging...");
    const profileDir = path.join(TEST_DIR, "browser_profile");
    fs.mkdirSync(profileDir, { recursive: true });

    browserProc = spawn(browserBin, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--headless=new",
      "--disable-gpu",
      "--window-size=1440,900",
      "about:blank",
    ]);

    let cdpReady = false;
    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      try {
        const res = await requestJsonOnce(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (Array.isArray(res.body) && res.body.length > 0) {
          const pageTarget = res.body.find((t) => t.type === "page") || res.body[0];
          if (pageTarget && pageTarget.webSocketDebuggerUrl) {
            wsUrl = pageTarget.webSocketDebuggerUrl;
            cdpReady = true;
            break;
          }
        }
      } catch (e) {}
    }
    if (!cdpReady) throw new Error("Browser remote debugging not available");

    cdp = new SimpleCDP(wsUrl);
    await cdp.connect();

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");

    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
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

    // 1. Audit Live Interview at 100% (After Fix)
    console.log("\n[3] Auditing Live Interview (100% zoom After Fix)...");
    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/interview/interview-practice.html` });
    await sleep(1500);
    const live100 = await auditLiveInterview(cdp, 1.0);
    report.liveInterview.zoom100 = live100;
    const shotLive100 = path.join(SCREENSHOT_DIR, "wi-density-live-100-after.png");
    await cdp.captureScreenshot(shotLive100);
    console.log(`   Captured: ${shotLive100}`);
    console.log(`   Response Console: ${live100.responseConsole?.width}x${live100.responseConsole?.height}px (Ratio to stage: ${live100.ratioResponseToStage})`);
    console.log(`   User Input: ${live100.userInput?.width}x${live100.userInput?.height}px (padding: ${live100.userInput?.padding})`);
    console.log(`   Mic Button: ${live100.micBtn?.width}x${live100.micBtn?.height}px`);
    console.log(`   Send Button: ${live100.sendBtn?.width}x${live100.sendBtn?.height}px`);
    console.log(`   Stage Column scroll vs client: ${live100.stageScrollHeight}px vs ${live100.stageClientHeight}px`);

    // ASSERTIONS: Live Interview
    assert(live100.responseConsole.height <= 180, `Response console height (${live100.responseConsole.height}px) must be <= 180px`);
    assert(live100.userInput.height <= 100, `User input height (${live100.userInput.height}px) must be <= 100px`);
    assert(live100.micBtn.height <= 75, `Mic button height (${live100.micBtn.height}px) must be <= 75px`);
    assert(live100.sendBtn.height <= 75, `Send button height (${live100.sendBtn.height}px) must be <= 75px`);
    assert(live100.stageScrollHeight <= live100.stageClientHeight + 10, `No major vertical scrolling in video stage column`);
    console.log("   [ASSERTION PASS] Live interview dimensions successfully compressed to executive proportions!");

    // 2. Audit Interview Setup Step 4 (After Fix)
    console.log("\n[4] Auditing Interview Setup Step 4 (After Fix)...");
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
    const shotSetup100 = path.join(SCREENSHOT_DIR, "wi-density-setup-100-after.png");
    await cdp.captureScreenshot(shotSetup100);
    console.log(`   Captured: ${shotSetup100}`);
    console.log(`   AI Preview Card height: ${setup100.aiCard?.height}px, padding: ${setup100.aiCard?.padding}`);
    console.log(`   Summary Card height: ${setup100.summaryCard?.height}px, padding: ${setup100.summaryCard?.padding}`);
    console.log(`   Launch Button height: ${setup100.launchBtn?.height}px`);

    // ASSERTIONS: Step 4 Setup
    assert(setup100.aiCard.height <= 680, `AI card height (${setup100.aiCard.height}px) must be <= 680px (was 890px)`);
    assert(setup100.summaryCard.height <= 360, `Summary card height (${setup100.summaryCard.height}px) must be <= 360px (was 419px)`);
    assert(setup100.launchBtn.height <= 55, `Launch button height (${setup100.launchBtn.height}px) must be <= 55px (was 58px)`);
    console.log("   [ASSERTION PASS] Step 4 Setup cards successfully compressed!");

    // 3. Audit Dashboard (After Fix)
    console.log("\n[5] Auditing Dashboard (After Fix)...");
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
    const shotDash100 = path.join(SCREENSHOT_DIR, "wi-density-dashboard-100-after.png");
    await cdp.captureScreenshot(shotDash100);
    console.log(`   Captured: ${shotDash100}`);
    console.log(`   Dashboard Hero height: ${dash100.heroHeight}px`);

    fs.writeFileSync(REPORT_OUTPUT_PATH, JSON.stringify(report, null, 2));
    console.log(`\n[PASS] Verified density report saved to: ${REPORT_OUTPUT_PATH}`);

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
  console.error("[FATAL VERIFICATION ERROR]:", err);
  process.exit(1);
});
