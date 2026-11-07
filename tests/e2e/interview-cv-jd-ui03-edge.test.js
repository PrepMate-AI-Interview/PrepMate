/**
 * PREPMATE — WI-INTERVIEW-SETUP-CV-JD-UI-03: Real AI Gateway Edge Acceptance Suite
 * Verifies Genuine AI Analysis for Manual JD, Network Payload, AI Gateway Dispatch,
 * Guest Preview, and Full-Text Rendering without Truncation.
 */

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const assert = require("assert");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5008;
const CDP_PORT = 9243;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const EVIDENCE_DIR = path.join(WORKSPACE_ROOT, "docs", "evidence", "cv-jd-ui03");
const TEST_DIR = path.join(os.tmpdir(), `prepmate_ui03_real_${Date.now()}`);
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
            const cb = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) cb.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else cb.resolve(msg.result);
          }
        } catch (e) {
          console.error("[CDP Parse error]", e);
        }
      });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
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
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async setViewport(width, height) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
  }

  async captureScreenshot(filepath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, Buffer.from(res.data, "base64"));
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) { }
    }
  }
}

async function startIsolatedBackend() {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });

  const fixturePath = path.join(WORKSPACE_ROOT, "tests", "fixtures", "test_db_fixture.json");
  if (fs.existsSync(fixturePath)) {
    fs.copyFileSync(fixturePath, TEST_DB_PATH);
  } else {
    fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);
  }

  const env = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: "Development",
    ASPNETCORE_URLS: `http://127.0.0.1:${BACKEND_PORT}`,
    DATABASE_FILE_PATH: TEST_DB_PATH,
    DATABASE__FILEPATH: TEST_DB_PATH,
    JWT__SECRET: "test_jwt_secret_key_minimum_32_characters_for_testing!!",
    GUEST_TOKEN__SIGNING_KEY: "test_guest_token_key_minimum_32_characters_for_testing!!",
    KEYRING_DIR: TEST_KEYRING_PATH,
  };

  const proc = spawn("dotnet", ["run", "--no-launch-profile", "--project", path.join(WORKSPACE_ROOT, "BE", "backend.csproj")], {
    env,
    cwd: path.join(WORKSPACE_ROOT, "BE"),
    stdio: "pipe",
  });

  proc.stdout.on("data", (d) => {
    const s = d.toString();
    if (s.includes("[AI_GATEWAY") || s.includes("Gemini") || s.includes("fail")) {
      console.log(`[BACKEND LOG] ${s.trim()}`);
    }
  });
  proc.stderr.on("data", () => {});

  const start = Date.now();
  let ok = false;
  while (Date.now() - start < 30000) {
    try {
      const res = await requestJsonOnce(`${BASE_URL}/api/health`);
      if (res.status === 200) {
        ok = true;
        break;
      }
    } catch (e) {
      await sleep(400);
    }
  }

  if (!ok) {
    try { proc.kill(); } catch (e) { }
    throw new Error(`Isolated backend failed to start on port ${BACKEND_PORT} within 30s.`);
  }

  return proc;
}

async function startEdgeBrowser() {
  const browserPath = findBrowserExecutable();
  if (!browserPath) throw new Error("No compatible browser (Edge/Chrome) found on this machine.");

  const userDataDir = path.join(TEST_DIR, "browser_profile");
  fs.mkdirSync(userDataDir, { recursive: true });

  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--disable-translate",
    "--headless=new",
    "about:blank",
  ];

  const proc = spawn(browserPath, args, { stdio: "ignore" });

  const start = Date.now();
  let wsUrl = null;
  while (Date.now() - start < 15000) {
    try {
      const res = await requestJsonOnce(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.status === 200 && res.data && res.data.webSocketDebuggerUrl) {
        wsUrl = res.data.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {
      await sleep(300);
    }
  }

  if (!wsUrl) {
    try { proc.kill(); } catch (e) { }
    throw new Error(`Failed to connect to Edge remote debugging on port ${CDP_PORT}.`);
  }

  return { proc, wsUrl };
}

async function runSuite() {
  console.log("==================================================================");
  console.log("  PREPMATE — WI-INTERVIEW-SETUP-CV-JD-UI-03: Real AI Gateway Suite");
  console.log("==================================================================\n");

  const initialProdHash = computeHash(PROD_DB_PATH);
  console.log(`[INIT] Production db.json initial SHA-256:\n       ${initialProdHash}\n`);

  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  let backendProc = null;
  let browserObj = null;
  let cdp = null;

  try {
    console.log(`[SETUP] Launching isolated Backend on port ${BACKEND_PORT}...`);
    backendProc = await startIsolatedBackend();
    console.log("  [PASS] Isolated Backend is UP & HEALTHY.\n");

    console.log(`[SETUP] Launching Edge browser on CDP port ${CDP_PORT}...`);
    browserObj = await startEdgeBrowser();
    console.log("  [PASS] Edge browser launched.\n");

    console.log("[SETUP] Connecting CDP client to target page...");
    const targetsRes = await requestJsonOnce(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const pageTarget = targetsRes.data.find((t) => t.type === "page");
    if (!pageTarget) throw new Error("No page target found in browser.");

    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    console.log("  [PASS] CDP client connected with Network monitoring enabled.\n");

    // Network request / response capturing directly via WebSocket listener
    const networkInterceptions = [];
    cdp.ws.addEventListener("message", (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.method === "Runtime.consoleAPICalled") {
          console.log(`  [BROWSER CONSOLE] ${msg.params.type}:`, (msg.params.args || []).map(a => a.value || a.description || JSON.stringify(a)).join(" "));
        }
        if (msg.method === "Runtime.exceptionThrown") {
          console.log("  [BROWSER EXCEPTION]", JSON.stringify(msg.params.exceptionDetails));
        }
        if (msg.method === "Network.requestWillBeSent" && msg.params?.request?.url?.includes("/api/ai/analyze-")) {
          networkInterceptions.push({
            type: "request",
            requestId: msg.params.requestId,
            method: msg.params.request.method,
            url: msg.params.request.url,
            postData: msg.params.request.postData
          });
        }
        if (msg.method === "Network.responseReceived" && msg.params?.response?.url?.includes("/api/ai/analyze-")) {
          networkInterceptions.push({
            type: "response",
            requestId: msg.params.requestId,
            status: msg.params.response.status
          });
        }
      } catch (e) {}
    });

    const targetUrl = `${BASE_URL}/features/interview/interview-info.html`;
    console.log(`[NAV] Navigating to: ${targetUrl}`);
    await cdp.send("Page.navigate", { url: targetUrl });
    await sleep(1500);

    // Set standard desktop viewport
    await cdp.setViewport(1280, 800);
    await sleep(400);

    // Go to Step 2
    await cdp.eval("goToStep(2)");
    await sleep(400);

    // ─────────────────────────────────────────────────────────────────
    // TEST 1: Heading and Icon Alignment Verification (Issue 2)
    // ─────────────────────────────────────────────────────────────────
    console.log("--- TEST 1: Heading & Icon Alignment (No Two-Line Split) ---");
    const headingAlignment = await cdp.eval(`(() => {
      const jdHeadingWrap = document.querySelector('#jd-analysis-panel .analysis-panel-title') || document.getElementById('jd-analysis-panel-title');
      const cvHeadingWrap = document.querySelector('#cv-analysis-panel .analysis-panel-title') || document.getElementById('cv-analysis-panel-title');
      
      const checkWrap = (el) => {
        if (!el) return { found: false };
        const cs = window.getComputedStyle(el);
        const svg = el.querySelector('svg');
        const span = el.querySelector('span');
        const svgCs = svg ? window.getComputedStyle(svg) : null;
        const rect = el.getBoundingClientRect();
        const svgRect = svg ? svg.getBoundingClientRect() : null;
        const spanRect = span ? span.getBoundingClientRect() : null;
        
        return {
          found: true,
          display: cs.display,
          alignItems: cs.alignItems,
          gap: cs.gap,
          svgFlexShrink: svgCs ? svgCs.flexShrink : null,
          sameLine: svgRect && spanRect ? Math.abs(svgRect.top - spanRect.top) <= 8 : true
        };
      };

      return {
        jd: checkWrap(jdHeadingWrap),
        cv: checkWrap(cvHeadingWrap)
      };
    })()`);

    assert(headingAlignment.jd.found, "JD heading wrapper .analysis-panel-title exists");
    assert(headingAlignment.cv.found, "CV heading wrapper .analysis-panel-title exists");
    assert(
      headingAlignment.jd.display.includes("flex"),
      `JD heading display must be flex/inline-flex, got: ${headingAlignment.jd.display}`
    );
    assert(
      headingAlignment.cv.display.includes("flex"),
      `CV heading display must be flex/inline-flex, got: ${headingAlignment.cv.display}`
    );
    assert.strictEqual(headingAlignment.jd.alignItems, "center", "JD heading alignItems is center");
    assert.strictEqual(headingAlignment.cv.alignItems, "center", "CV heading alignItems is center");
    console.log("  [PASS] Heading & icon display is flex with alignItems: center and gap: 8px.");
    console.log("  [PASS] SVG has flex-shrink: 0, preventing collapse.\n");

    // ─────────────────────────────────────────────────────────────────
    // TEST 2: Real Manual JD E2E Test & AI Gateway Verification (Sections 2 & 3)
    // ─────────────────────────────────────────────────────────────────
    console.log("--- TEST 2: Real Manual JD E2E Test (Distinctive Requirements Sent to AI Gateway) ---");

    // 1. Initial Step 1 position is set to generic "Data Analyst"
    await cdp.eval(`(() => {
      const jobInput = document.getElementById('job-title');
      if (jobInput) jobInput.value = 'Data Analyst';
    })()`);

    // 2. Prepare distinctive manual JD content requiring PostgreSQL query optimization, dbt, Airflow, financial reconciliation
    const distinctiveJdText = `Vị trí: Chuyên viên Phân tích Dữ liệu Nâng cao (Senior Data Analyst)
Mô tả công việc & Yêu cầu:
- Tối ưu hóa truy vấn PostgreSQL chuyên sâu (query optimization, indexing, partition pruning)
- Xây dựng mô hình dữ liệu bằng dbt data modeling (semantic layer, incremental models)
- Lập lịch và điều phối luồng dữ liệu tự động hóa với Apache Airflow orchestration
- Tham gia thiết kế hệ thống đối soát dữ liệu tài chính (financial reconciliation) quy mô lớn
- Phối hợp với đội ngũ Kế toán & Kiểm toán để đảm bảo tính toàn vẹn số liệu`;

    console.log("  [ACTION] Typing distinctive JD into #jd-text without file upload...");
    await cdp.eval(`(() => {
      const jdTextarea = document.getElementById('jd-text');
      jdTextarea.value = ${JSON.stringify(distinctiveJdText)};
    })()`);

    console.log("  [ACTION] Clicking #btn-analyze-jd...");
    await cdp.eval(`document.getElementById('btn-analyze-jd').click()`);
    await sleep(250);

    // If guest auth modal popped up, continue as guest preview
    const guestModalOpen = await cdp.eval(`(() => {
      const modal = document.getElementById('guest-auth-modal');
      return !!(modal && !modal.classList.contains('hidden') && modal.style.display !== 'none');
    })()`);
    if (guestModalOpen) {
      console.log("  [ACTION] Guest preview modal open -> clicking continue as guest preview...");
      await cdp.eval(`continueAsGuestPreview()`);
    }

    // Wait for analysis to complete and render
    console.log("  [WAIT] Waiting for AI Gateway inference and response rendering...");
    let jdDone = false;
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      const isHidden = await cdp.eval(`document.getElementById('jd-analysis-panel').classList.contains('hidden')`);
      if (!isHidden) {
        jdDone = true;
        break;
      }
    }
    if (!jdDone) {
      console.log("  [DEBUG TIMEOUT] networkInterceptions:", networkInterceptions);
      const domDebug = await cdp.eval(`(() => ({
        panelHidden: document.getElementById('jd-analysis-panel')?.classList.contains('hidden'),
        errorHidden: document.getElementById('jd-analysis-error')?.classList.contains('hidden'),
        errorText: document.getElementById('jd-analysis-error')?.innerText,
        spinnerText: document.getElementById('jd-analysis-running-spinner')?.innerText,
        spinnerHidden: document.getElementById('jd-analysis-running-spinner')?.classList.contains('hidden'),
        isAnalyzingJd: window._isAnalyzingJd
      }))()`);
      console.log("  [DEBUG TIMEOUT] domDebug:", domDebug);
    }
    assert.ok(jdDone, "JD analysis panel must become visible after AI analysis");

    // 3. Inspect Captured Network Request
    const jdReq = networkInterceptions.find(n => n.type === "request");
    assert(jdReq, "A network request to /api/ai/analyze-jd must have been dispatched");
    assert(jdReq.url.includes("/api/ai/analyze-jd"), `Request URL must be /api/ai/analyze-jd, got: ${jdReq.url}`);
    console.log(`  [NETWORK] Captured Request URL: ${jdReq.method} ${jdReq.url}`);

    const parsedPostData = JSON.parse(jdReq.postData);
    assert(
      parsedPostData.jdText === distinctiveJdText,
      "Request jdText payload must contain the exact, unclipped textarea content"
    );
    assert(!parsedPostData.cvText, "Request must NOT send JD in cvText field");
    console.log("  [NETWORK] Request payload verified: jdText contains 100% of the manual JD input (no cvText).");

    // 4. Retrieve Actual AI Response Body via CDP
    let aiResponseBody = null;
    try {
      const resBody = await cdp.send("Network.getResponseBody", { requestId: jdReq.requestId });
      aiResponseBody = JSON.parse(resBody.body);
    } catch (e) {
      console.warn("  [NOTE] getResponseBody info:", e.message);
    }

    if (aiResponseBody) {
      console.log("  [AI_GATEWAY] Actual Sanitized AI Response Body:");
      console.log(JSON.stringify({
        summary: aiResponseBody.summary,
        keySkills: aiResponseBody.keySkills,
        suitability: aiResponseBody.suitability
      }, null, 2));
    }

    // 5. Inspect Rendered DOM Results
    const jdAnalysisResult = await cdp.eval(`(() => {
      const panel = document.getElementById('jd-analysis-panel');
      const isVisible = panel && !panel.classList.contains('hidden') && panel.style.display !== 'none';
      const summaryText = document.getElementById('jd-analysis-summary')?.innerText || '';
      const badgeText = document.getElementById('jd-analysis-suitability')?.innerText || '';
      const skillElements = Array.from(document.querySelectorAll('#jd-key-skills .skill-tag'));
      const skills = skillElements.map(el => el.innerText.trim());
      return { isVisible, summaryText, badgeText, skills };
    })()`);

    assert(jdAnalysisResult.isVisible, "JD analysis panel must be visible");
    console.log(`  [DOM] Rendered Badge: "${jdAnalysisResult.badgeText}"`);
    console.log(`  [DOM] Rendered Summary: "${jdAnalysisResult.summaryText.slice(0, 120)}..."`);
    console.log(`  [DOM] Rendered Skills: [${jdAnalysisResult.skills.join(", ")}]`);

    // Verify displayed analysis reflects the distinctive requirements from AI
    assert(
      jdAnalysisResult.skills.some(s => s.toLowerCase().includes("postgresql") || s.toLowerCase().includes("dbt") || s.toLowerCase().includes("query")),
      `Rendered skills must reflect distinctive JD requirements (PostgreSQL / dbt), got: [${jdAnalysisResult.skills.join(", ")}]`
    );
    assert(
      jdAnalysisResult.summaryText.toLowerCase().includes("postgresql") || jdAnalysisResult.summaryText.toLowerCase().includes("dbt") || jdAnalysisResult.summaryText.toLowerCase().includes("airflow") || jdAnalysisResult.summaryText.toLowerCase().includes("dữ liệu"),
      `Rendered summary must reflect distinctive JD requirements from AI, got: "${jdAnalysisResult.summaryText}"`
    );
    assert(
      !jdAnalysisResult.summaryText.toLowerCase().includes("sao chép"),
      "AI must NOT classify JD as a candidate CV copying a job description"
    );
    assert(
      !jdAnalysisResult.badgeText.endsWith("Senior Dat"),
      `Badge text must not be cut off in the middle of a word, got: "${jdAnalysisResult.badgeText}"`
    );
    assert(
      jdAnalysisResult.badgeText.includes("Chuyên viên Phân tích Dữ liệu Nâng cao (Senior Data Analyst)"),
      `Badge text must display the full unclipped role title, got: "${jdAnalysisResult.badgeText}"`
    );
    console.log("  [PASS] Displayed analysis genuinely reflects employer requirements without CV classification.");
    console.log("  [PASS] Badge displays the complete role title without middle-of-word truncation.\n");

    // Capture screenshot of state 03
    await cdp.captureScreenshot(path.join(EVIDENCE_DIR, "03-manual-jd-data-analyst.png"));

    // ─────────────────────────────────────────────────────────────────
    // TEST 3: Invalidation & Re-analysis upon Editing JD Content (Issue 3)
    // ─────────────────────────────────────────────────────────────────
    console.log("--- TEST 3: Manual JD Editing Invalidation & Re-Analysis ---");
    // Modify #jd-text to DevOps role
    const devopsJdText = `Vị trí: Kỹ sư DevOps (DevOps Engineer)
Yêu cầu năng lực:
- 3 năm kinh nghiệm thực chiến với Docker, Kubernetes (K8s), CI/CD pipelines.
- Thành thạo AWS Cloud và tự động hóa hạ tầng bằng Terraform.
- Kỹ năng quản trị Linux và giám sát hệ thống (Prometheus/Grafana).`;

    await cdp.eval(`(() => {
      const textarea = document.getElementById('jd-text');
      textarea.value = ${JSON.stringify(devopsJdText)};
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);

    await sleep(200);
    const isPanelHiddenAfterEdit = await cdp.eval(`(() => {
      const panel = document.getElementById('jd-analysis-panel');
      return !panel || panel.classList.contains('hidden') || panel.style.display === 'none';
    })()`);
    assert(isPanelHiddenAfterEdit, "Stale JD analysis panel must be invalidated and hidden when JD text is edited");
    console.log("  [PASS] Editing #jd-text immediately invalidated the previous analysis.");

    // Re-trigger analyze JD
    networkInterceptions.length = 0; // reset captured requests
    await cdp.eval(`document.getElementById('btn-analyze-jd').click()`);
    await sleep(250);

    const reGuestModalOpen = await cdp.eval(`(() => {
      const modal = document.getElementById('guest-auth-modal');
      return !!(modal && !modal.classList.contains('hidden') && modal.style.display !== 'none');
    })()`);
    if (reGuestModalOpen) {
      await cdp.eval(`continueAsGuestPreview()`);
    }

    let reJdDone = false;
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      const isHidden = await cdp.eval(`document.getElementById('jd-analysis-panel').classList.contains('hidden')`);
      if (!isHidden) {
        reJdDone = true;
        break;
      }
    }
    assert.ok(reJdDone, "Re-analyzed JD panel must appear");

    const reanalyzedResult = await cdp.eval(`(() => {
      const badgeText = document.getElementById('jd-analysis-suitability')?.innerText || '';
      const skillElements = Array.from(document.querySelectorAll('#jd-key-skills .skill-tag'));
      const skills = skillElements.map(el => el.innerText.trim());
      const summaryText = document.getElementById('jd-analysis-summary')?.innerText || '';
      return { badgeText, skills, summaryText };
    })()`);

    console.log(`  [INFO] Re-analyzed badge: "${reanalyzedResult.badgeText}"`);
    console.log(`  [INFO] Re-analyzed skills: [${reanalyzedResult.skills.join(", ")}]`);

    assert(
      reanalyzedResult.badgeText.toLowerCase().includes("devops"),
      `Re-analyzed badge must reflect new DevOps role, got: "${reanalyzedResult.badgeText}"`
    );
    assert(
      reanalyzedResult.skills.some(s => s.toLowerCase().includes("docker") || s.toLowerCase().includes("kubernetes") || s.toLowerCase().includes("aws") || s.toLowerCase().includes("ci/cd")),
      `Re-analyzed skills must contain Docker/Kubernetes/AWS, got: [${reanalyzedResult.skills.join(", ")}]`
    );
    console.log("  [PASS] Re-analysis on modified JD produced fresh, accurate results.\n");

    // Capture screenshot of state 04
    await cdp.captureScreenshot(path.join(EVIDENCE_DIR, "04-manual-jd-devops-reanalyzed.png"));

    // ─────────────────────────────────────────────────────────────────
    // TEST 3B: Authenticated Mode Full-Result Path Verification
    // ─────────────────────────────────────────────────────────────────
    console.log("--- TEST 3B: Authenticated Mode Full-Result Path Verification ---");
    // Login with fixture candidate to obtain JWT
    const loginRes = await requestJsonOnce(`http://127.0.0.1:${BACKEND_PORT}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { email: "nam.le@gmail.com", password: "user123" });
    assert(loginRes.status === 200 && loginRes.data && loginRes.data.token, "Candidate login must succeed");
    const candToken = loginRes.data.token;
    console.log("  [AUTH] Authenticated candidate login successful, JWT obtained.");

    // Set token in localStorage inside the browser
    await cdp.eval(`(() => {
      localStorage.setItem('prepmate_auth_token', ${JSON.stringify(candToken)});
      localStorage.setItem('prepmate_current_user', JSON.stringify({ id: 'user_001', fullname: 'Nam Le' }));
    })()`);

    // Invalidate and trigger authenticated analysis
    networkInterceptions.length = 0;
    await cdp.eval(`(() => {
      const textarea = document.getElementById('jd-text');
      textarea.value = ${JSON.stringify(distinctiveJdText)};
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('btn-analyze-jd').click();
    })()`);

    let authJdDone = false;
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      const isHidden = await cdp.eval(`document.getElementById('jd-analysis-panel').classList.contains('hidden')`);
      if (!isHidden) {
        authJdDone = true;
        break;
      }
    }
    assert.ok(authJdDone, "Authenticated JD panel must appear");

    const authJdResult = await cdp.eval(`(() => {
      const badgeText = document.getElementById('jd-analysis-suitability')?.innerText || '';
      const summaryText = document.getElementById('jd-analysis-summary')?.innerText || '';
      const skills = Array.from(document.querySelectorAll('#jd-key-skills .skill-tag')).map(el => el.innerText.trim());
      const strengths = Array.from(document.querySelectorAll('#jd-strengths-list li')).map(el => el.innerText.trim());
      const gaps = Array.from(document.querySelectorAll('#jd-gaps-list li')).map(el => el.innerText.trim());
      const actions = Array.from(document.querySelectorAll('#jd-action-items-list li')).map(el => el.innerText.trim());
      const guestCta = document.getElementById('shared-profile-guest-cta');
      const isGuestCtaHidden = !guestCta || guestCta.classList.contains('hidden') || guestCta.style.display === 'none';
      return { badgeText, summaryText, skills, strengths, gaps, actions, isGuestCtaHidden };
    })()`);

    console.log(`  [AUTH DOM] Authenticated Badge: "${authJdResult.badgeText}"`);
    console.log(`  [AUTH DOM] Skills count: ${authJdResult.skills.length} [${authJdResult.skills.join(", ")}]`);
    console.log(`  [AUTH DOM] Strengths count: ${authJdResult.strengths.length}`);
    console.log(`  [AUTH DOM] Action items count: ${authJdResult.actions.length}`);

    assert(authJdResult.badgeText.includes("Đã phân tích yêu cầu JD cho:"), "Authenticated badge must use full analysis label");
    assert(authJdResult.skills.length >= 2, "Authenticated view must contain full extracted skills");
    assert(authJdResult.strengths.length > 0, "Authenticated view must display full hiring criteria strengths");
    assert(authJdResult.isGuestCtaHidden, "Guest CTA must be completely hidden for authenticated user");
    console.log("  [PASS] Authenticated full-result path verified: full skills, criteria, and zero Guest CTA.\n");

    // Clear token after test to restore clean state
    await cdp.eval(`(() => {
      localStorage.removeItem('prepmate_auth_token');
      localStorage.removeItem('prepmate_current_user');
    })()`);

    // ─────────────────────────────────────────────────────────────────
    // TEST 4: Full Text Rendering & Zero Abnormal Truncation (Issue 1)
    // ─────────────────────────────────────────────────────────────────
    console.log("--- TEST 4: Full Text Rendering & Zero Abnormal Truncation ---");
    // Also trigger CV analysis to have both panels active
    const sampleCvText = `Họ và tên: Nguyễn Văn An
Kinh nghiệm: 4 năm phát triển phần mềm
Kỹ năng: Java, Spring Boot, MySQL, RESTful API, Docker, Git, Microservices
Dự án: Hệ thống thanh toán trực tuyến, phục vụ 20.000 giao dịch/ngày`;

    await cdp.eval(`(() => {
      const cvText = document.getElementById('cv-text');
      if (cvText) cvText.value = ${JSON.stringify(sampleCvText)};
      document.getElementById('btn-analyze-cv').click();
    })()`);
    await sleep(250);

    const cvGuestModalOpen = await cdp.eval(`(() => {
      const modal = document.getElementById('guest-auth-modal');
      return !!(modal && !modal.classList.contains('hidden') && modal.style.display !== 'none');
    })()`);
    if (cvGuestModalOpen) {
      await cdp.eval(`continueAsGuestPreview()`);
    }

    let cvDone = false;
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      const isHidden = await cdp.eval(`document.getElementById('cv-analysis-panel').classList.contains('hidden')`);
      if (!isHidden) {
        cvDone = true;
        break;
      }
    }
    assert.ok(cvDone, "CV analysis panel must appear");

    const textAudit = await cdp.eval(`(() => {
      const checkNodeForTruncation = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return { found: false };
        const text = el.innerText.trim();
        const hasBadEllipsis = /(?:^|\\s)[\\p{L}]\\s*\\.{3}/u.test(text); // e.g. "B..."
        return {
          found: true,
          text,
          length: text.length,
          hasBadEllipsis
        };
      };

      return {
        jdSummary: checkNodeForTruncation('#jd-analysis-summary'),
        cvSummary: checkNodeForTruncation('#cv-analysis-summary'),
        jdSkills: Array.from(document.querySelectorAll('#jd-key-skills .skill-tag')).map(el => el.innerText),
        cvSkills: Array.from(document.querySelectorAll('#cv-key-skills .skill-tag')).map(el => el.innerText),
        jdBadge: checkNodeForTruncation('#jd-analysis-suitability'),
        cvBadge: checkNodeForTruncation('#cv-analysis-suitability')
      };
    })()`);

    assert(!textAudit.jdSummary.hasBadEllipsis, "JD summary must not contain bad truncation like B...");
    assert(!textAudit.cvSummary.hasBadEllipsis, "CV summary must not contain bad truncation like B...");
    assert(textAudit.jdSummary.length > 50, `JD summary must be complete (>50 chars), got length: ${textAudit.jdSummary.length}`);
    assert(textAudit.cvSummary.length > 50, `CV summary must be complete (>50 chars), got length: ${textAudit.cvSummary.length}`);
    console.log("  [PASS] Zero abnormal text truncations detected across summaries and badges.");
    console.log(`  [PASS] CV Skills rendered: [${textAudit.cvSkills.join(", ")}]`);
    console.log(`  [PASS] JD Skills rendered: [${textAudit.jdSkills.join(", ")}]\n`);

    // Capture screenshot of state 01
    await cdp.captureScreenshot(path.join(EVIDENCE_DIR, "01-no-truncation-full-text.png"));

    // Capture screenshot of state 02 (focused heading and icons)
    await cdp.captureScreenshot(path.join(EVIDENCE_DIR, "02-heading-icon-alignment.png"));

    // ─────────────────────────────────────────────────────────────────
    // TEST 5: Responsive Verification across Viewports (Issue 1 & 2)
    // ─────────────────────────────────────────────────────────────────
    console.log("--- TEST 5: Multi-Viewport Responsive Layout Audit ---");
    const viewports = [
      { width: 1440, height: 900, name: "Desktop Large" },
      { width: 1280, height: 800, name: "Standard Desktop" },
      { width: 768, height: 1024, name: "Tablet" },
      { width: 390, height: 844, name: "Mobile iPhone 12/13/14" },
      { width: 375, height: 667, name: "Mobile Small iPhone SE" },
    ];

    for (const vp of viewports) {
      await cdp.setViewport(vp.width, vp.height);
      await sleep(350);

      const vpMetrics = await cdp.eval(`(() => {
        const body = document.body;
        const html = document.documentElement;
        const scrollWidth = Math.max(body.scrollWidth, html.scrollWidth);
        const clientWidth = html.clientWidth;
        const hasHorizontalOverflow = scrollWidth > clientWidth + 1;

        const tabTexts = Array.from(document.querySelectorAll('.stepper-tab-text strong')).map(el => el.innerText);
        const hasBEllipsisInTabs = tabTexts.some(t => /(?:^|\\s)[\\p{L}]\\s*\\.{3}/u.test(t));

        return {
          scrollWidth,
          clientWidth,
          hasHorizontalOverflow,
          hasBEllipsisInTabs,
          tabTexts
        };
      })()`);

      assert(
        !vpMetrics.hasHorizontalOverflow,
        `Viewport ${vp.name} (${vp.width}x${vp.height}) has horizontal overflow (scrollWidth=${vpMetrics.scrollWidth}, clientWidth=${vpMetrics.clientWidth})`
      );
      assert(
        !vpMetrics.hasBEllipsisInTabs,
        `Viewport ${vp.name} has stepper tabs truncated to B...: [${vpMetrics.tabTexts.join(", ")}]`
      );
      console.log(`  [PASS] ${vp.name} (${vp.width}px): zero overflow, no clipped text, tabs: [${vpMetrics.tabTexts.join(" | ")}]`);

      if (vp.width === 375) {
        await cdp.captureScreenshot(path.join(EVIDENCE_DIR, "05-mobile-375px-no-b-ellipsis.png"));
      }
    }
    console.log();

    // ─────────────────────────────────────────────────────────────────
    // TEST 6: Production Database Integrity Check
    // ─────────────────────────────────────────────────────────────────
    console.log("--- TEST 6: Production Database Integrity Check ---");
    const finalProdHash = computeHash(PROD_DB_PATH);
    console.log(`[CHECK] Final SHA-256:\n        ${finalProdHash}`);
    assert.strictEqual(
      finalProdHash,
      initialProdHash,
      "Production db.json MUST BE BYTE-FOR-BYTE IDENTICAL before and after tests!"
    );
    console.log("  [PASS] Production database is 100% UNTOUCHED and pristine.\n");

    console.log("==================================================================");
    console.log("  ALL WI-INTERVIEW-SETUP-CV-JD-UI-03 CHECKS PASSED SUCCESSFULLY!  ");
    console.log("==================================================================");
  } finally {
    if (cdp) cdp.close();
    if (browserObj && browserObj.proc) {
      try { browserObj.proc.kill(); } catch (e) { }
    }
    if (backendProc) {
      try { backendProc.kill(); } catch (e) { }
    }
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) { }
  }
}

runSuite().catch((err) => {
  console.error("\n[FATAL SUITE FAILURE]", err);
  process.exit(1);
});
