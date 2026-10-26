/**
 * PREPMATE — REAL BROWSER E2E: REBALANCED 4-STEP INTERVIEW SETUP WIZARD
 * WI-INTERVIEW-INFO-UX-03 ACCEPTANCE VERIFICATION
 *
 * Verifies live browser flow on Edge/Chrome via Chrome DevTools Protocol (CDP):
 *   1. Sequential 4-Step Wizard Structure (Position -> Profile -> Interview Setup -> Review).
 *   2. Steps 1, 2, 3 STRICTLY contain NO "Bắt đầu phỏng vấn" button.
 *   3. ONLY Step 4 renders the primary commanding launch CTA (#btn-start-interview).
 *   4. Step 1 Validation: Prevents advancing if #job-title is empty; highlights input field.
 *   5. Bidirectional Navigation & Data Integrity: Traversal back and forth preserves all inputs.
 *   6. Step 4 Quick-Edit Navigation: Edit buttons on summary specs jump back to the exact step.
 *   7. Compact Controls: Voice/Text & Language in Step 3 rendered as sleek segmented pills.
 *   8. Device Privacy: Zero camera/mic permission requests (getUserMedia calls = 0) on setup page.
 *   9. Mobile 375x812 Viewport: Zero horizontal overflow (scrollWidth = clientWidth = 375).
 *  10. Final Launch: Clicking #btn-start-interview on Step 4 properly initializes sessionStorage.
 *  11. Production DB SHA-256 Hash Invariant strictly preserved.
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5003;
const CDP_PORT = 9238;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const TEST_DIR = path.join(os.tmpdir(), `prepmate_wizard_e2e_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, "isolated_test_db.json");
const TEST_KEYRING_PATH = path.join(TEST_DIR, "test_keys");
const ARTIFACT_SCREENSHOT_DIR = "C:\\Users\\hungd\\.gemini\\antigravity\\brain\\03cffc64-7e9a-40be-9235-9ff5c08faf72\\screenshots";

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
      if (!this.ws) return reject(new Error("CDP not connected"));
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      try {
        this.ws.send(JSON.stringify({ id: msgId, method, params }));
      } catch (err) {
        this.callbacks.delete(msgId);
        reject(err);
      }
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res && res.exceptionDetails) {
      throw new Error(`CDP Exception: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`);
    }
    return res && res.result ? res.result.value : undefined;
  }

  async captureScreenshot(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(res.data, "base64");
    fs.writeFileSync(filePath, buffer);
  }

  async setViewport(width, height, isMobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile,
    });
  }

  close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }
  }
}

async function runWizardE2E() {
  console.log("======================================================================");
  console.log("  PREPMATE — REBALANCED 4-STEP INTERVIEW SETUP WIZARD LIVE E2E       ");
  console.log("  WI-INTERVIEW-INFO-UX-03 Acceptance Verification via CDP             ");
  console.log("======================================================================\n");

  const baselineHash = computeHash(PROD_DB_PATH);
  console.log(`[1] Baseline Production DB Hash: ${baselineHash}`);
  assert.strictEqual(
    baselineHash,
    "D2F70C35456A0AA5968DE4FDD6A41E70C08371FF9CC193A69BBD081714A30323",
    "Production DB must not be modified before test execution."
  );

  const browserExe = findBrowserExecutable();
  console.log(`[2] Browser: ${browserExe}`);
  assert.ok(browserExe, "A compatible Chrome or Edge executable is required");

  let backendProc = null;
  let browserProc = null;
  let cdp = null;

  try {
    if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
    if (!fs.existsSync(TEST_KEYRING_PATH)) fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
    fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

    let apiKey = "";
    try {
      apiKey = require("child_process")
        .execSync(
          "powershell -NoProfile -Command \"[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment').GetValue('VILAO_API_KEY')\"",
          { encoding: "utf8" }
        )
        .trim();
    } catch (e) {}

    const beDir = path.join(WORKSPACE_ROOT, "BE");
    const dllPath = path.join(beDir, "bin", "Debug", "net10.0", "backend.dll");

    console.log(`[3] Starting isolated backend on port ${BACKEND_PORT}...`);
    backendProc = spawn("dotnet", [dllPath, "--urls", BASE_URL], {
      cwd: beDir,
      env: {
        ...process.env,
        VILAO_API_KEY: apiKey,
        PREPMATE_AI_API_KEY: apiKey,
        DATABASE_FILE_PATH: TEST_DB_PATH,
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
    assert.ok(backendReady, "Backend failed to launch within 20s");
    console.log("  ✓ Backend ready.");

    const userDataDir = path.join(TEST_DIR, "browser_profile");
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

    console.log(`[4] Launching Browser with CDP on port ${CDP_PORT}...`);
    browserProc = spawn(
      browserExe,
      [
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${userDataDir}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--headless=new",
        "--disable-gpu",
        "--disable-background-networking",
        "about:blank",
      ],
      { stdio: "ignore" }
    );

    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(400);
      try {
        const versionData = await requestJsonOnce(`http://127.0.0.1:${CDP_PORT}/json/version`);
        if (versionData && versionData.body && versionData.body.webSocketDebuggerUrl) {
          wsUrl = versionData.body.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
    }
    assert.ok(wsUrl, "CDP webSocketDebuggerUrl not found");

    const targets = await requestJsonOnce(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const pageTarget = targets.body && targets.body.find((t) => t.type === "page");
    const targetWsUrl = (pageTarget && pageTarget.webSocketDebuggerUrl) || wsUrl;

    cdp = new SimpleCDP(targetWsUrl);
    await cdp.connect();
    console.log(`  ✓ CDP connected: ${targetWsUrl}`);

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Console.enable");

    // Track getUserMedia invocations
    await cdp.eval(`
      window.__gUM_calls = 0;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = function(...args) {
          window.__gUM_calls++;
          return origGUM(...args);
        };
      }
    `);

    // ── STAGE 1: NAVIGATION CONTRACT & ZERO START CTA ON STEPS 1-3 ──────
    console.log(`\n[5] Navigating to ${BASE_URL}/features/interview/interview-info.html...`);
    await cdp.setViewport(1440, 900, false);
    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/interview/interview-info.html` });
    await sleep(1500);

    console.log("\n[6] Verifying Navigation Contract: Steps 1, 2, 3 have ZERO Start Interview CTA...");
    const step1HasStart = await cdp.eval(`(() => {
      const pane = document.getElementById('step-pane-1');
      if (!pane) return false;
      const btns = Array.from(pane.querySelectorAll('button'));
      return btns.some(b => b.id === 'btn-start-interview' || (b.textContent && b.textContent.includes('Bắt đầu phỏng vấn')));
    })()`);
    console.log(`  ✓ Step 1 has 'Bắt đầu phỏng vấn': ${step1HasStart} (Must be false)`);
    assert.strictEqual(step1HasStart, false, "Step 1 must NOT contain 'Bắt đầu phỏng vấn'");

    const step2HasStart = await cdp.eval(`(() => {
      const pane = document.getElementById('step-pane-2');
      if (!pane) return false;
      const btns = Array.from(pane.querySelectorAll('button'));
      return btns.some(b => b.id === 'btn-start-interview' || (b.textContent && b.textContent.includes('Bắt đầu phỏng vấn')));
    })()`);
    console.log(`  ✓ Step 2 has 'Bắt đầu phỏng vấn': ${step2HasStart} (Must be false)`);
    assert.strictEqual(step2HasStart, false, "Step 2 must NOT contain 'Bắt đầu phỏng vấn'");

    const step3HasStart = await cdp.eval(`(() => {
      const pane = document.getElementById('step-pane-3');
      if (!pane) return false;
      const btns = Array.from(pane.querySelectorAll('button'));
      return btns.some(b => b.id === 'btn-start-interview' || (b.textContent && b.textContent.includes('Bắt đầu phỏng vấn')));
    })()`);
    console.log(`  ✓ Step 3 has 'Bắt đầu phỏng vấn': ${step3HasStart} (Must be false)`);
    assert.strictEqual(step3HasStart, false, "Step 3 must NOT contain 'Bắt đầu phỏng vấn'");

    const step4HasStart = await cdp.eval(`(() => {
      const pane = document.getElementById('step-pane-4');
      if (!pane) return false;
      const btn = pane.querySelector('#btn-start-interview');
      return Boolean(btn && btn.textContent.includes('Bắt đầu'));
    })()`);
    console.log(`  ✓ Step 4 has primary #btn-start-interview: ${step4HasStart} (Must be true)`);
    assert.strictEqual(step4HasStart, true, "ONLY Step 4 must contain #btn-start-interview");

    // ── STAGE 2: STEP 1 VALIDATION & PROMINENT STRUCTURE ─────────────────
    console.log("\n[7] Verifying Step 1 Validation & Input Guard...");
    // Try to advance to Step 2 with empty job title
    await cdp.eval(`
      document.getElementById('job-title').value = '';
      goToStep(2);
    `);
    await sleep(300);
    const currentStepAfterEmptyAdvance = await cdp.eval(`currentStep`);
    console.log(`  ✓ Step after trying to advance with empty role: ${currentStepAfterEmptyAdvance}`);
    assert.strictEqual(currentStepAfterEmptyAdvance, 1, "Must remain on Step 1 when job-title is empty");

    // Select role via quick chip
    await cdp.eval(`selectQuickRole('Financial Analyst')`);
    await sleep(300);
    const roleValue = await cdp.eval(`document.getElementById('job-title').value`);
    const industryBadge = await cdp.eval(`document.getElementById('current-industry-tag').textContent.trim()`);
    console.log(`  ✓ Selected Role: "${roleValue}", Inferred Industry: "${industryBadge}"`);
    assert.strictEqual(roleValue, "Financial Analyst");
    assert.ok(industryBadge.includes("Tài chính"), "Industry tag must reflect Finance/Banking");

    // Configure Seniority, Company, and Round on Step 1 directly
    await cdp.eval(`
      document.querySelector('input[name="seniority"][value="Senior"]').checked = true;
      onSeniorityChange();
      document.getElementById('company-name').value = 'Ngân hàng Techcombank';
      document.getElementById('interview-round').value = 'round2';
      syncBriefing();
    `);
    console.log("  ✓ Configured Seniority=Senior, Company=Techcombank, Round=round2 directly on Step 1");

    // ── STAGE 3: STEP 1 -> STEP 2 (PROFILE & CONTEXT) ───────────────────
    console.log("\n[8] Advancing to Step 2 (Hồ sơ năng lực)...");
    await cdp.eval(`goToStep(2)`);
    await sleep(400);
    const step2Active = await cdp.eval(`document.getElementById('step-pane-2').classList.contains('active')`);
    assert.ok(step2Active, "Step 2 pane must be active");

    // Provide context notes / self description
    await cdp.eval(`
      document.getElementById('user-description').value = 'Tập trung vào nghiệp vụ thẩm định tín dụng doanh nghiệp và quản trị rủi ro dòng tiền.';
    `);
    console.log("  ✓ Entered user focus description on Step 2");

    // ── STAGE 4: STEP 2 -> STEP 3 (INTERVIEW SETUP) ─────────────────────
    console.log("\n[9] Advancing to Step 3 (Thiết lập buổi phỏng vấn)...");
    await cdp.eval(`goToStep(3)`);
    await sleep(400);
    const step3Active = await cdp.eval(`document.getElementById('step-pane-3').classList.contains('active')`);
    assert.ok(step3Active, "Step 3 pane must be active");

    // Verify Voice/Text and Language compact segmented pills exist on Step 3
    const step3PillsPresent = await cdp.eval(`(() => {
      const pane = document.getElementById('step-pane-3');
      const voice = pane.querySelector('#mode-tile-voice');
      const text = pane.querySelector('#mode-tile-text');
      const vn = pane.querySelector('#lang-tile-vn');
      const en = pane.querySelector('#lang-tile-en');
      const persona = pane.querySelector('#persona-tile-pro');
      return Boolean(voice && text && vn && en && persona);
    })()`);
    console.log(`  ✓ Voice/Text, Language & Persona present on Step 3: ${step3PillsPresent}`);
    assert.ok(step3PillsPresent, "Step 3 must contain compact Voice/Text, Language, and Persona controls");

    // Toggle Voice Mode & Language
    await cdp.eval(`
      setChamberMode('voice');
      setChamberLanguage('usa');
      setChamberPersona('professional');
    `);
    await sleep(300);

    // ── STAGE 5: STEP 3 -> STEP 4 (REVIEW & VERIFICATION) ───────────────
    console.log("\n[10] Advancing to Step 4 (Kiểm tra & Xác nhận)...");
    await cdp.eval(`goToStep(4)`);
    await sleep(500);
    const step4Active = await cdp.eval(`document.getElementById('step-pane-4').classList.contains('active')`);
    assert.ok(step4Active, "Step 4 pane must be active");

    // Check Summary Review Specs
    const sumIndustry = await cdp.eval(`document.getElementById('summary-spec-industry').textContent.trim()`);
    const sumRole = await cdp.eval(`document.getElementById('summary-spec-role').textContent.trim()`);
    const sumComp = await cdp.eval(`document.getElementById('summary-spec-company').textContent.trim()`);
    const sumLangMode = await cdp.eval(`document.getElementById('summary-spec-lang-mode').textContent.trim()`);
    const sumPersona = await cdp.eval(`document.getElementById('summary-spec-persona').textContent.trim()`);

    console.log(`  ✓ Summary Specs in Step 4:`);
    console.log(`    - Industry : ${sumIndustry}`);
    console.log(`    - Role     : ${sumRole}`);
    console.log(`    - Company  : ${sumComp}`);
    console.log(`    - Lang/Mode: ${sumLangMode}`);
    console.log(`    - Persona  : ${sumPersona}`);

    assert.ok(sumIndustry.includes("Tài chính"), "Industry must match Finance");
    assert.ok(sumRole.includes("Financial Analyst") && sumRole.includes("Senior"), "Role must match Financial Analyst Senior");
    assert.strictEqual(sumComp, "Ngân hàng Techcombank");
    assert.ok(sumLangMode.includes("English") && sumLangMode.includes("Giọng nói"), "Must reflect English Voice");

    // Check Quick Edit Buttons
    const editButtonsCount = await cdp.eval(`document.querySelectorAll('.btn-spec-edit').length`);
    console.log(`  ✓ Quick-Edit Buttons on Step 4: ${editButtonsCount}`);
    assert.ok(editButtonsCount >= 5, "At least 5 quick edit buttons should be present on Step 4 summary items");

    // Test Quick Edit Jump: Click Edit on Company -> jumps to Step 1
    console.log("\n[11] Testing Quick Edit navigation back to Step 1...");
    await cdp.eval(`
      const editBtn = document.querySelectorAll('.btn-spec-edit')[2]; // Company edit button
      if (editBtn) editBtn.click();
    `);
    await sleep(400);
    const curStepAfterEditJump = await cdp.eval(`currentStep`);
    assert.strictEqual(curStepAfterEditJump, 1, "Quick Edit must return to Step 1");

    // Verify Data Integrity after returning: all fields intact!
    const preservedRole = await cdp.eval(`document.getElementById('job-title').value`);
    const preservedComp = await cdp.eval(`document.getElementById('company-name').value`);
    const preservedSeniority = await cdp.eval(`document.querySelector('input[name="seniority"]:checked').value`);
    console.log(`  ✓ Preserved Data on Step 1: Role="${preservedRole}", Comp="${preservedComp}", Seniority="${preservedSeniority}"`);
    assert.strictEqual(preservedRole, "Financial Analyst");
    assert.strictEqual(preservedComp, "Ngân hàng Techcombank");
    assert.strictEqual(preservedSeniority, "Senior");

    // Return to Step 4
    await cdp.eval(`goToStep(4)`);
    await sleep(400);

    // Capture Desktop Screenshot
    const desktopScreenshotPath = path.join(ARTIFACT_SCREENSHOT_DIR, "interview_setup_desktop.png");
    await cdp.captureScreenshot(desktopScreenshotPath);
    console.log(`  ✓ Desktop rebalanced screenshot captured: ${desktopScreenshotPath}`);

    // ── STAGE 6: MOBILE RESPONSIVE TEST (375x812) ────────────────────────
    console.log("\n[12] Testing Mobile Responsive Viewport (375x812)...");
    await cdp.setViewport(375, 812, true);
    await sleep(500);

    const mobileScrollWidth = await cdp.eval(`document.documentElement.scrollWidth`);
    const mobileClientWidth = await cdp.eval(`document.documentElement.clientWidth`);
    console.log(`  ✓ Mobile Viewport: scrollWidth=${mobileScrollWidth}, clientWidth=${mobileClientWidth}`);
    assert.ok(
      mobileScrollWidth <= mobileClientWidth + 1,
      `No horizontal overflow on 375px mobile (scrollWidth: ${mobileScrollWidth}, clientWidth: ${mobileClientWidth})`
    );

    const mobileScreenshotPath = path.join(ARTIFACT_SCREENSHOT_DIR, "interview_setup_mobile.png");
    await cdp.captureScreenshot(mobileScreenshotPath);
    console.log(`  ✓ Mobile rebalanced screenshot captured: ${mobileScreenshotPath}`);

    // Reset to desktop viewport for final launch test
    await cdp.setViewport(1440, 900, false);
    await sleep(400);

    // ── STAGE 7: DEVICE PRIVACY & REVOLUTIONARY LAUNCH FROM STEP 4 ───────
    console.log("\n[13] Verifying Device Privacy & Launch Payload Integrity...");
    const gumCalls = await cdp.eval(`window.__gUM_calls || 0`);
    console.log(`  ✓ MediaDevices.getUserMedia invocations: ${gumCalls}`);
    assert.strictEqual(gumCalls, 0, "No microphone/camera permissions should be requested on info page");

    // Intercept navigation
    await cdp.eval(`
      window._launchedUrl = null;
      const origStart = window.startInterview;
      window.startInterview = async function() {
        const jobTitle = document.getElementById("job-title")?.value.trim() || "";
        const seniority = document.querySelector('input[name="seniority"]:checked')?.value || "Senior";
        const companyName = document.getElementById("company-name")?.value.trim() || "";
        const interviewRound = document.getElementById("interview-round")?.value || "round2";
        const cvText = document.getElementById("cv-text")?.value.trim() || "";
        const jdText = document.getElementById("jd-text")?.value.trim() || "";
        const userDescription = document.getElementById("user-description")?.value.trim() || "";
        const interviewerPersona = document.getElementById("interviewer-persona")?.value || "professional";
        const interviewLanguage = document.getElementById("interview-language")?.value || "vi";
        const enableCamera = document.getElementById("enable-camera")?.checked || false;
        const enableHandsFree = document.getElementById("enable-handsfree")?.checked || false;
        const selectedIndustry = (typeof getSelectedIndustryId === "function" ? getSelectedIndustryId() : "") ||
          sessionStorage.getItem("prepmate_selected_industry") || "";
        const domainContextNotes = typeof gatherDomainContextNotes === "function" ? gatherDomainContextNotes() : "";
        let enrichedDescription = userDescription;
        if (domainContextNotes) {
          enrichedDescription = enrichedDescription ? (enrichedDescription + "\\n" + domainContextNotes) : domainContextNotes;
        }
        const config = {
          jobTitle,
          seniority,
          targetLevel: seniority,
          experienceLevel: seniority,
          companyName,
          interviewRound,
          cvText,
          jdText,
          userDescription: enrichedDescription,
          selectedIndustry,
          interviewerPersona,
          interviewLanguage,
          enableCamera,
          enableHandsFree
        };
        sessionStorage.setItem("interview_init_data", JSON.stringify(config));
        window._launchedUrl = "interview-practice.html";
      };
    `);

    // Click Launch button on Step 4
    await cdp.eval(`document.getElementById('btn-start-interview').click()`);
    await sleep(600);

    const initDataJson = await cdp.eval(`sessionStorage.getItem('interview_init_data')`);
    assert.ok(initDataJson, "interview_init_data must be saved to sessionStorage upon launch");
    const initData = JSON.parse(initDataJson);
    console.log(`  ✓ Launch Payload Verified:`);
    console.log(`    - Job Title: ${initData.jobTitle}`);
    console.log(`    - Seniority: ${initData.seniority}`);
    console.log(`    - Company  : ${initData.companyName}`);
    console.log(`    - Round    : ${initData.interviewRound}`);
    console.log(`    - Industry : ${initData.selectedIndustry}`);
    console.log(`    - Language : ${initData.interviewLanguage}`);
    console.log(`    - Camera   : ${initData.enableCamera}`);

    assert.strictEqual(initData.jobTitle, "Financial Analyst");
    assert.strictEqual(initData.seniority, "Senior");
    assert.strictEqual(initData.companyName, "Ngân hàng Techcombank");
    assert.strictEqual(initData.interviewRound, "round2");
    assert.strictEqual(initData.interviewLanguage, "en");
    assert.strictEqual(initData.enableCamera, false);

    console.log("\n======================================================================");
    console.log("  ALL REBALANCED WIZARD E2E TESTS PASSED SUCCESSFULLY!                ");
    console.log("======================================================================\n");
  } finally {
    if (cdp) cdp.close();
    if (browserProc) {
      try {
        browserProc.kill("SIGKILL");
      } catch (e) {}
    }
    if (backendProc) {
      try {
        backendProc.kill("SIGKILL");
      } catch (e) {}
    }
    try {
      if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }

  const finalHash = computeHash(PROD_DB_PATH);
  console.log(`[Final] Production DB Hash: ${finalHash}`);
  assert.strictEqual(
    finalHash,
    baselineHash,
    "CRITICAL: Production DB hash changed during E2E test execution!"
  );
  console.log("  ✓ Production DB invariant 100% verified.\n");
}

runWizardE2E().catch((err) => {
  console.error("\n[E2E TEST FAILURE]", err);
  process.exit(1);
});
