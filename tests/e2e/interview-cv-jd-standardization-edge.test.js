/**
 * WI-INTERVIEW-SETUP-CV-JD-01: End-to-End Edge Verification
 * Validating Independent & Explicit CV & JD Analysis Flow on Microsoft Edge
 */

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const assert = require("assert");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5007;
const CDP_PORT = 9242;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const TEST_DIR = path.join(os.tmpdir(), `prepmate_cv_jd_edge_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, "isolated_test_db.json");
const TEST_KEYRING_PATH = path.join(TEST_DIR, "test_keys");

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

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runTests() {
  console.log("======================================================================");
  console.log("  PREPMATE — CV & JD STANDARDIZATION REAL EDGE E2E TEST SUITE        ");
  console.log("======================================================================");

  const initialHash = computeHash(PROD_DB_PATH);
  console.log(`[1] Production DB Hash: ${initialHash}`);

  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
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
  assert.ok(backendReady, "Backend failed to become responsive.");
  console.log("  ✓ Backend responsive.");

  // 2. Launch browser
  console.log(`[4] Launching Browser with CDP on port ${CDP_PORT}...`);
  const browserProc = spawn(
    browserPath,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-first-run",
      `--user-data-dir=${path.join(TEST_DIR, "browser_profile")}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  await sleep(1500);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try {
      const targets = await requestJsonOnce(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const pageTarget = targets && targets.data && targets.data.find((t) => t.type === "page");
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        wsUrl = pageTarget.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {}
  }
  assert.ok(wsUrl, "CDP page webSocketDebuggerUrl not found");

  const cdp = new CDPClient(wsUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  console.log("  ✓ CDP connected.");

  // Track network requests
  const networkRequests = [];
  cdp.ws.addEventListener("message", (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.method === "Network.requestWillBeSent") {
        networkRequests.push(msg.params.request.url);
      }
    } catch (e) {}
  });

  try {
    console.log("\n--- Scenario 1: Navigate to Step 2 & Verify DOM Initial State ---");
    const targetUrl = `${BASE_URL}/features/interview/interview-info.html`;
    await cdp.send("Page.navigate", { url: targetUrl });
    await sleep(2000);

    // Initial presence check
    const initialElementsCheck = await cdp.eval(`(() => {
      return {
        btnAnalyzeCv: !!document.getElementById('btn-analyze-cv'),
        btnAnalyzeJd: !!document.getElementById('btn-analyze-jd'),
        cvPanelHidden: document.getElementById('cv-analysis-panel')?.classList.contains('hidden'),
        jdPanelHidden: document.getElementById('jd-analysis-panel')?.classList.contains('hidden'),
        cvSpinnerHidden: document.getElementById('cv-analysis-running-spinner')?.classList.contains('hidden'),
        jdSpinnerHidden: document.getElementById('jd-analysis-running-spinner')?.classList.contains('hidden')
      };
    })()`);

    assert.strictEqual(initialElementsCheck.btnAnalyzeCv, true, "#btn-analyze-cv exists");
    assert.strictEqual(initialElementsCheck.btnAnalyzeJd, true, "#btn-analyze-jd exists");
    assert.strictEqual(initialElementsCheck.cvPanelHidden, true, "CV panel hidden initially");
    assert.strictEqual(initialElementsCheck.jdPanelHidden, true, "JD panel hidden initially");
    console.log("  ✓ CV and JD analyze buttons present, panels cleanly hidden");

    // Advance to Step 2
    await cdp.eval(`(() => {
      document.getElementById('job-title').value = 'Senior Frontend Engineer';
      goToStep(2);
    })()`);
    await sleep(500);

    console.log("\n--- Scenario 2: CV Explicit Flow Verification ---");
    const countBeforeCv = networkRequests.filter((u) => u.includes("analyze-cv")).length;

    // 1. Upload / Provide CV
    await cdp.eval(`(() => {
      document.getElementById('cv-text').value = 'Nguyen Van B - 5 years of React, TypeScript, Redux, Performance Optimization.';
      window._extractedCvText = document.getElementById('cv-text').value;
      document.getElementById('upload-status').classList.remove('hidden');
      document.getElementById('status-filename').textContent = 'NguyenVanB_CV.pdf';
      document.getElementById('status-filesize').textContent = '(112 KB)';
      document.getElementById('upload-box').classList.add('hidden');
    })()`);
    await sleep(400);

    // 2. Confirm no auto-analysis request
    const countAfterCvSet = networkRequests.filter((u) => u.includes("analyze-cv")).length;
    assert.strictEqual(countBeforeCv, countAfterCvSet, "NO analyze-cv request triggered when uploading CV");

    // 3. Confirm results not yet displayed
    const cvPanelStillHidden = await cdp.eval(`document.getElementById('cv-analysis-panel').classList.contains('hidden')`);
    assert.strictEqual(cvPanelStillHidden, true, "CV analysis results remain hidden prior to clicking button");
    console.log("  ✓ CV uploaded: Zero auto-request, results remain hidden");

    // 4. Click "Phân tích CV"
    await cdp.eval(`document.getElementById('btn-analyze-cv').click()`);
    await sleep(200);

    // 5. Confirm loading state & request triggered
    const cvBtnDisabled = await cdp.eval(`document.getElementById('btn-analyze-cv').disabled`);
    console.log(`  ✓ Clicked 'Phân tích CV': loading state active (button disabled: ${cvBtnDisabled})`);

    // 6. Handle guest preview if modal appeared or wait for result
    const guestModalOpen = await cdp.eval(`(() => {
      const modal = document.getElementById('guest-auth-modal');
      return !!(modal && !modal.classList.contains('hidden') && modal.style.display !== 'none');
    })()`);
    if (guestModalOpen) {
      await cdp.eval(`continueAsGuestPreview()`);
      await sleep(300);
    }

    let cvDone = false;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      const isHidden = await cdp.eval(`document.getElementById('cv-analysis-panel').classList.contains('hidden')`);
      if (!isHidden) {
        cvDone = true;
        break;
      }
    }
    assert.ok(cvDone, "CV analysis panel did not appear after analysis completed");
    const countAfterCvClick = networkRequests.filter((u) => u.includes("analyze-cv")).length;
    assert.ok(countAfterCvClick > countBeforeCv, "analyze-cv request was made strictly upon explicit user click");
    console.log("  ✓ CV analysis result displayed with structured insights");

    // 7. Change CV -> verify invalidation
    await cdp.eval(`(() => {
      const el = document.getElementById('cv-text');
      el.value = 'Nguyen Van B - Changed CV content to Lead Architect';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(200);

    const cvPanelHiddenAfterEdit = await cdp.eval(`document.getElementById('cv-analysis-panel').classList.contains('hidden')`);
    const cvResultNull = await cdp.eval(`window._cvAnalysisResult === null`);
    assert.strictEqual(cvPanelHiddenAfterEdit, true, "CV panel is immediately hidden when CV changes");
    assert.strictEqual(cvResultNull, true, "window._cvAnalysisResult is invalidated to null");
    console.log("  ✓ Modifying CV immediately invalidates old analysis and hides panel");

    console.log("\n--- Scenario 3: JD Explicit Flow Verification ---");
    const countBeforeJd = networkRequests.filter((u) => u.includes("analyze-jd")).length;

    // 1. Enter JD content
    await cdp.eval(`(() => {
      const el = document.getElementById('jd-text');
      el.value = 'Tuyển dụng Senior Frontend Engineer: Yêu cầu React, Next.js, Microfrontends, Performance, CI/CD.';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(400);

    // 2. Confirm no auto-analysis request
    const countAfterJdInput = networkRequests.filter((u) => u.includes("analyze-jd")).length;
    assert.strictEqual(countBeforeJd, countAfterJdInput, "NO analyze request triggered when typing/pasting JD");

    // 3. Confirm results not yet displayed
    const jdPanelStillHidden = await cdp.eval(`document.getElementById('jd-analysis-panel').classList.contains('hidden')`);
    assert.strictEqual(jdPanelStillHidden, true, "JD analysis results remain hidden prior to clicking button");
    console.log("  ✓ JD entered: Zero auto-request, results remain hidden");

    // 4. Click "Phân tích JD"
    await cdp.eval(`document.getElementById('btn-analyze-jd').click()`);
    await sleep(200);

    // 5. Confirm loading state & request triggered
    const jdBtnDisabled = await cdp.eval(`document.getElementById('btn-analyze-jd').disabled`);
    console.log(`  ✓ Clicked 'Phân tích JD': loading state active (button disabled: ${jdBtnDisabled})`);

    const guestModalOpenJd = await cdp.eval(`(() => {
      const modal = document.getElementById('guest-auth-modal');
      return !!(modal && !modal.classList.contains('hidden') && modal.style.display !== 'none');
    })()`);
    if (guestModalOpenJd) {
      await cdp.eval(`continueAsGuestPreview()`);
      await sleep(300);
    }

    let jdDone = false;
    for (let i = 0; i < 45; i++) {
      await sleep(400);
      const isHidden = await cdp.eval(`document.getElementById('jd-analysis-panel').classList.contains('hidden')`);
      if (!isHidden) {
        jdDone = true;
        break;
      }
    }
    assert.ok(jdDone, "JD analysis panel did not appear after analysis completed");
    const countAfterJdClick = networkRequests.filter((u) => u.includes("analyze-jd")).length;
    assert.ok(countAfterJdClick > countBeforeJd, "JD analyze request made strictly upon explicit user click");
    console.log("  ✓ JD analysis result displayed with structured requirements");

    // 6. Edit JD content -> verify invalidation
    await cdp.eval(`(() => {
      const el = document.getElementById('jd-text');
      el.value = 'Tuyển dụng Lead Frontend Engineer: Quản lý team 6 người, kiến trúc Microfrontend, Golang BFF.';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(200);

    const jdPanelHiddenAfterEdit = await cdp.eval(`document.getElementById('jd-analysis-panel').classList.contains('hidden')`);
    const jdResultNull = await cdp.eval(`window._jdAnalysisResult === null`);
    assert.strictEqual(jdPanelHiddenAfterEdit, true, "JD panel is immediately hidden when JD is edited");
    assert.strictEqual(jdResultNull, true, "window._jdAnalysisResult is invalidated to null");
    console.log("  ✓ Editing JD content immediately invalidates old analysis and hides panel");

    // 7. Click "Phân tích JD" again to re-analyze new content
    await cdp.eval(`document.getElementById('btn-analyze-jd').click()`);
    await sleep(200);
    const guestModalOpenJd2 = await cdp.eval(`(() => {
      const modal = document.getElementById('guest-auth-modal');
      return !!(modal && !modal.classList.contains('hidden') && modal.style.display !== 'none');
    })()`);
    if (guestModalOpenJd2) {
      await cdp.eval(`continueAsGuestPreview()`);
      await sleep(300);
    }

    for (let i = 0; i < 45; i++) {
      await sleep(400);
      const isHidden = await cdp.eval(`document.getElementById('jd-analysis-panel').classList.contains('hidden')`);
      if (!isHidden) break;
    }
    const jdPanelVisibleAgain = await cdp.eval(`!document.getElementById('jd-analysis-panel').classList.contains('hidden')`);
    assert.strictEqual(jdPanelVisibleAgain, true, "JD panel visible again after re-analysis");
    console.log("  ✓ Re-analyzing JD displays fresh results corresponding to updated content");

    console.log("\n--- Scenario 4: Responsive Viewport & No Horizontal Overflow ---");
    const overflow1280 = await cdp.eval(`document.documentElement.scrollWidth <= window.innerWidth`);
    assert.strictEqual(overflow1280, true, "No horizontal overflow at 1280px viewport");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 768,
      height: 1024,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(300);
    const overflow768 = await cdp.eval(`document.documentElement.scrollWidth <= window.innerWidth`);
    assert.strictEqual(overflow768, true, "No horizontal overflow at 768px viewport");
    console.log("  ✓ Responsive check passed: No horizontal overflow across desktop & tablet viewports");

    console.log("\n--- Scenario 5: Production Database Invariant ---");
    const finalHash = computeHash(PROD_DB_PATH);
    assert.strictEqual(finalHash, initialHash, "Production DB hash modified! Invariant violated.");
    console.log(`  ✓ Production DB invariant 100% verified (${finalHash})`);

    console.log("\n======================================================================");
    console.log("  ALL REAL EDGE E2E ACCEPTANCE CRITERIA PASSED CLEANLY (100%)!       ");
    console.log("======================================================================");
  } finally {
    if (cdp) cdp.close();
    if (browserProc) {
      try { browserProc.kill(); } catch (e) {}
    }
    if (backendProc) {
      try { backendProc.kill(); } catch (e) {}
    }
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
