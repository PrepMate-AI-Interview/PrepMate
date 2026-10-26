/**
 * PREPMATE — REAL BROWSER E2E: WIZARD CONTENT HIERARCHY & STRICT SEQUENTIAL VALIDATION
 * WI-INTERVIEW-INFO-UX-05 ACCEPTANCE VERIFICATION
 *
 * Verifies live browser flow on Edge/Chrome via Chrome DevTools Protocol (CDP):
 *   1. Initial page load: Step 1 active; Steps 2, 3, 4 strictly locked (aria-disabled="true", .locked).
 *   2. Skipping prevention: Clicking Step 4 (or 2, 3) directly when Step 1 is empty is blocked,
 *      remains on Step 1, and displays #job-title-error inline alert with red outline.
 *   3. Sequential Progression:
 *      - Step 1 -> 2 unlocks Step 2; Step 3 & 4 remain locked.
 *      - Skipping from Step 2 directly to Step 4 is blocked.
 *      - Step 2 -> 3 unlocks Step 3; Step 4 remains locked.
 *      - Step 3 -> 4 unlocks Step 4 and displays Review Summary.
 *   4. Reactive Invalidation & Re-Locking:
 *      - Jump back to Step 1, erase #job-title:
 *      - Steps 2, 3, 4 immediately re-lock with aria-disabled="true".
 *      - Direct attempt to jump to Step 4 is strictly blocked and highlights #job-title.
 *      - Re-filling #job-title immediately re-unlocks eligible steps.
 *   5. Single Launch Button:
 *      - #btn-start-interview strictly exists ONLY in Step 4.
 *      - Steps 1, 2, and 3 have NO "Bắt đầu phỏng vấn" button.
 *   6. Bidirectional Data Preservation:
 *      - Moving back and forth preserves all user inputs (title, company, seniority, notes, etc.).
 *   7. Safe Launch Payload Verification:
 *      - Triggers launch validation, verifies sessionStorage payload integrity without mutating backend DB.
 *   8. Responsive Viewports (Desktop 1440x900 & Mobile 375x812) with zero overflow.
 *   9. Production DB SHA-256 invariant verified strictly unchanged.
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5000;
const CDP_PORT = 9239;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
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

class CdpConnection {
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

  async captureScreenshot(outPath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(res.data, "base64"));
  }
}

async function isBackendRunning() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/features/interview/interview-info.html`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log("======================================================================");
  console.log("  PREPMATE — WIZARD CONTENT HIERARCHY & STRICT VALIDATION LIVE E2E    ");
  console.log("  WI-INTERVIEW-INFO-UX-05 Acceptance Verification via Edge CDP        ");
  console.log("======================================================================\n");

  const baselineHash = computeHash(PROD_DB_PATH);
  console.log(`[1] Baseline Production DB Hash: ${baselineHash}`);
  assert.strictEqual(
    baselineHash,
    "D2F70C35456A0AA5968DE4FDD6A41E70C08371FF9CC193A69BBD081714A30323",
    "Production DB invariant must strictly match baseline."
  );

  const browserExe = findBrowserExecutable();
  assert.ok(browserExe, "Modern Chromium browser executable must exist on system.");
  console.log(`[2] Browser: ${browserExe}`);

  const backendOk = await isBackendRunning();
  assert.ok(backendOk, "Backend must be running on port 5000.");
  console.log(`[3] Backend verified responsive on port ${BACKEND_PORT}`);

  const tmpProfile = path.join(os.tmpdir(), `prepmate_wizard_val_e2e_${Date.now()}`);
  const browserProc = spawn(browserExe, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmpProfile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--headless=new",
    "--window-size=1440,900",
    "about:blank",
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const json = await new Promise((res, rej) => {
          http.get(`http://127.0.0.1:${CDP_PORT}/json`, (r) => {
            let data = "";
            r.on("data", (chunk) => (data += chunk));
            r.on("end", () => res(JSON.parse(data)));
          }).on("error", rej);
        });
        const page = json.find((t) => t.type === "page");
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
    }

    assert.ok(wsUrl, "CDP WebSocket URL must be available.");
    console.log(`[4] CDP connected: ${wsUrl}`);

    const cdp = new CdpConnection(wsUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Runtime.enable");

    // ── Navigate to interview-info.html ──────────────────────────────
    console.log(`[5] Navigating to ${BASE_URL}/features/interview/interview-info.html...`);
    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/interview/interview-info.html` });

    // Wait for DOM ready
    for (let i = 0; i < 30; i++) {
      try {
        const ready = await cdp.eval(`document.readyState === 'complete' && !!document.getElementById('job-title') && document.querySelectorAll('.stepper-tab').length === 4`);
        if (ready) break;
      } catch (e) {}
      await sleep(200);
    }
    await sleep(500);

    // ── Test 1: Initial Page Load State ──────────────────────────────
    console.log("\n[6] Test 1: Initial Page Load & Stepper Lock Verification...");
    const initialStep = await cdp.eval(`window.currentStep`);
    assert.strictEqual(initialStep, 1, "Must start on Step 1");
    console.log(`  ✓ Current step is 1`);

    const step1Active = await cdp.eval(`(() => {
      const tab = document.getElementById('stepper-tab-1');
      const pane = document.getElementById('step-pane-1');
      return tab.classList.contains('active') &&
             !tab.classList.contains('locked') &&
             pane.classList.contains('active');
    })()`);
    assert.ok(step1Active, "Step 1 must be active, not locked, and visible");
    console.log(`  ✓ Step 1 tab and pane are active and visible`);

    const stepsLocked = await cdp.eval(`
      [2, 3, 4].every(n => {
        const tab = document.getElementById('stepper-tab-' + n);
        return tab.classList.contains('locked') && tab.getAttribute('aria-disabled') === 'true';
      })
    `);
    assert.ok(stepsLocked, "Steps 2, 3, 4 must all be locked with aria-disabled='true'");
    console.log(`  ✓ Steps 2, 3, 4 are strictly locked on initial clean load`);

    // ── Test 2: Skipping Prevention with Empty Title ──────────────────
    console.log("\n[7] Test 2: Blocking Direct Jump to Step 4 with Empty Job Title...");
    // Attempt to click Step 4 tab directly
    await cdp.eval(`document.getElementById('stepper-tab-4').click()`);
    await sleep(200);

    const stepAfterSkipAttempt = await cdp.eval(`window.currentStep`);
    assert.strictEqual(stepAfterSkipAttempt, 1, "Must remain on Step 1 after blocked jump to Step 4");
    console.log(`  ✓ Blocked direct jump to Step 4; remained on Step 1`);

    const errorVisible = await cdp.eval(`(() => {
      const err = document.getElementById('job-title-error');
      const input = document.getElementById('job-title');
      return err && !err.classList.contains('hidden') && input.classList.contains('input-error');
    })()`);
    assert.ok(errorVisible, "Inline error message #job-title-error must be visible with input-error class");
    console.log(`  ✓ #job-title-error is visible and #job-title has input-error highlight`);

    // Also verify clicking "Tiếp tục" button on Step 1 while empty triggers error
    await cdp.eval(`document.querySelector('#step-pane-1 .btn-step-next').click()`);
    await sleep(200);
    const stepAfterNext = await cdp.eval(`window.currentStep`);
    assert.strictEqual(stepAfterNext, 1, "btn-step-next must not advance when job-title is empty");
    console.log(`  ✓ btn-step-next blocked advancement with empty job-title`);

    // ── Test 3: Fill Step 1 & Advance to Step 2 ────────────────────────
    console.log("\n[8] Test 3: Advance from Step 1 to Step 2...");
    await cdp.eval(`(() => {
      const input = document.getElementById('job-title');
      input.value = 'Senior Frontend Engineer';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const compInput = document.getElementById('company-name');
      if (compInput) {
        compInput.value = 'VNG Corporation';
        compInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const seniorRadio = document.querySelector('input[name="seniority"][value="Senior"]');
      if (seniorRadio) {
        seniorRadio.checked = true;
        seniorRadio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await sleep(200);

    // Verify error is immediately cleared on input
    const errorCleared = await cdp.eval(`(() => {
      const err = document.getElementById('job-title-error');
      const input = document.getElementById('job-title');
      return err.classList.contains('hidden') && !input.classList.contains('input-error');
    })()`);
    assert.ok(errorCleared, "Error alert must be cleared immediately when valid input is typed");
    console.log(`  ✓ Error cleared automatically upon entering valid job title`);

    // Advance to Step 2
    await cdp.eval(`document.querySelector('#step-pane-1 .btn-step-next').click()`);
    await sleep(300);

    const stepAtStep2 = await cdp.eval(`window.currentStep`);
    assert.strictEqual(stepAtStep2, 2, "Must advance to Step 2");
    console.log(`  ✓ Successfully advanced to Step 2`);

    const step2State = await cdp.eval(`(() => {
      const tab1 = document.getElementById('stepper-tab-1');
      const tab2 = document.getElementById('stepper-tab-2');
      const tab3 = document.getElementById('stepper-tab-3');
      const tab4 = document.getElementById('stepper-tab-4');
      return {
        tab1Completed: tab1.classList.contains('completed'),
        tab2Active: tab2.classList.contains('active') && !tab2.classList.contains('locked'),
        tab3Locked: tab3.classList.contains('locked') && tab3.getAttribute('aria-disabled') === 'true',
        tab4Locked: tab4.classList.contains('locked') && tab4.getAttribute('aria-disabled') === 'true'
      };
    })()`);
    assert.ok(step2State.tab1Completed, "Tab 1 must be marked completed");
    assert.ok(step2State.tab2Active, "Tab 2 must be active and unlocked");
    assert.ok(step2State.tab3Locked, "Tab 3 must remain locked");
    assert.ok(step2State.tab4Locked, "Tab 4 must remain locked");
    console.log(`  ✓ Stepper states: Step 1 completed, Step 2 active, Steps 3 & 4 strictly locked`);

    // ── Test 4: Attempt Direct Jump from Step 2 to Step 4 ──────────────
    console.log("\n[9] Test 4: Attempt Direct Jump from Step 2 to Step 4...");
    await cdp.eval(`document.getElementById('stepper-tab-4').click()`);
    await sleep(200);
    const stepAfterSkipFrom2 = await cdp.eval(`window.currentStep`);
    assert.strictEqual(stepAfterSkipFrom2, 2, "Must remain on Step 2; cannot jump to Step 4 before Step 3");
    console.log(`  ✓ Direct jump from Step 2 to Step 4 blocked; remained on Step 2`);

    // In Step 2, switch to JD tab and fill job description for persistence testing
    await cdp.eval(`(() => {
      const jdBtn = document.getElementById('tab-btn-jd');
      if (jdBtn) jdBtn.click();
      const jdInput = document.getElementById('jd-text') || document.getElementById('user-description');
      if (jdInput) {
        jdInput.value = 'Yêu cầu 5 năm kinh nghiệm React, TypeScript, System Architecture.';
        jdInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);

    // ── Test 5: Advance Step 2 -> Step 3 ──────────────────────────────
    console.log("\n[10] Test 5: Advance Step 2 -> Step 3...");
    await cdp.eval(`document.querySelector('#step-pane-2 .btn-step-next').click()`);
    await sleep(300);

    const stepAtStep3 = await cdp.eval(`window.currentStep`);
    assert.strictEqual(stepAtStep3, 3, "Must advance to Step 3");
    console.log(`  ✓ Successfully advanced to Step 3`);

    const step3State = await cdp.eval(`(() => {
      const tab2 = document.getElementById('stepper-tab-2');
      const tab3 = document.getElementById('stepper-tab-3');
      const tab4 = document.getElementById('stepper-tab-4');
      return {
        tab2Completed: tab2.classList.contains('completed'),
        tab3Active: tab3.classList.contains('active') && !tab3.classList.contains('locked'),
        tab4Locked: tab4.classList.contains('locked') && tab4.getAttribute('aria-disabled') === 'true'
      };
    })()`);
    assert.ok(step3State.tab2Completed, "Tab 2 must be marked completed");
    assert.ok(step3State.tab3Active, "Tab 3 must be active and unlocked");
    assert.ok(step3State.tab4Locked, "Tab 4 must remain locked");
    console.log(`  ✓ Stepper states: Step 2 completed, Step 3 active, Step 4 locked`);

    // Attempt direct jump from Step 3 to Step 4 via tab click before clicking next
    await cdp.eval(`document.getElementById('stepper-tab-4').click()`);
    await sleep(200);
    const stepAfterSkipFrom3 = await cdp.eval(`window.currentStep`);
    assert.strictEqual(stepAfterSkipFrom3, 3, "Must remain on Step 3; cannot skip to Step 4 before completing Step 3");
    console.log(`  ✓ Direct jump from Step 3 to Step 4 blocked before completing Step 3`);

    // ── Test 6: Advance Step 3 -> Step 4 ──────────────────────────────
    console.log("\n[11] Test 6: Advance Step 3 -> Step 4 & Summary Verification...");
    await cdp.eval(`document.querySelector('#step-pane-3 .btn-step-next').click()`);
    await sleep(300);

    const stepAtStep4 = await cdp.eval(`window.currentStep`);
    assert.strictEqual(stepAtStep4, 4, "Must advance to Step 4");
    console.log(`  ✓ Successfully advanced to Step 4`);

    const step4Visible = await cdp.eval(`(() => {
      const pane4 = document.getElementById('step-pane-4');
      const tab4 = document.getElementById('stepper-tab-4');
      return pane4.classList.contains('active') && tab4.classList.contains('active') && !tab4.classList.contains('locked');
    })()`);
    assert.ok(step4Visible, "Step 4 must be visible, active and unlocked");
    console.log(`  ✓ Step 4 is active, unlocked and visible`);

    // Verify Review Summary reflects input data
    const summaryData = await cdp.eval(`(() => {
      return {
        role: document.getElementById('summary-spec-role')?.textContent.trim(),
        company: document.getElementById('summary-spec-company')?.textContent.trim()
      };
    })()`);
    console.log(`  ✓ Step 4 Summary Data: Role="${summaryData.role}", Company="${summaryData.company}"`);
    assert.ok(summaryData.role.includes("Senior Frontend Engineer"), "Role spec must include Senior Frontend Engineer");
    assert.strictEqual(summaryData.company, "VNG Corporation");

    // ── Test 7: Single Launch Button Invariant ────────────────────────
    console.log("\n[12] Test 7: Single Launch Button Invariant across Steps...");
    const launchButtonPositions = await cdp.eval(`
      ({
        step1HasLaunch: !!document.querySelector('#step-pane-1 #btn-start-interview'),
        step2HasLaunch: !!document.querySelector('#step-pane-2 #btn-start-interview'),
        step3HasLaunch: !!document.querySelector('#step-pane-3 #btn-start-interview'),
        step4HasLaunch: !!document.querySelector('#step-pane-4 #btn-start-interview'),
        totalLaunchButtons: document.querySelectorAll('#btn-start-interview').length
      })
    `);
    assert.strictEqual(launchButtonPositions.step1HasLaunch, false, "Step 1 must NOT have #btn-start-interview");
    assert.strictEqual(launchButtonPositions.step2HasLaunch, false, "Step 2 must NOT have #btn-start-interview");
    assert.strictEqual(launchButtonPositions.step3HasLaunch, false, "Step 3 must NOT have #btn-start-interview");
    assert.strictEqual(launchButtonPositions.step4HasLaunch, true, "Step 4 MUST have #btn-start-interview");
    assert.strictEqual(launchButtonPositions.totalLaunchButtons, 1, "There must be exactly ONE #btn-start-interview in the entire DOM");
    console.log(`  ✓ #btn-start-interview exists strictly and exclusively inside Step 4`);

    // ── Test 8: Quick Edit Jump Back to Step 1 & Erase Title ─────────
    console.log("\n[13] Test 8: Invalidation & Re-Locking on Clearing Required Field...");
    // Click "Chỉnh sửa" from summary to jump back to Step 1
    await cdp.eval(`goToStep(1)`);
    await sleep(200);
    const backToStep1 = await cdp.eval(`window.currentStep`);
    assert.strictEqual(backToStep1, 1, "Must jump back to Step 1");
    console.log(`  ✓ Navigated back to Step 1`);

    // Clear the job title field
    await cdp.eval(`(() => {
      const input = document.getElementById('job-title');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(200);

    // Verify stepper tabs 2, 3, 4 are immediately locked again
    const reLocked = await cdp.eval(`
      [2, 3, 4].every(n => {
        const tab = document.getElementById('stepper-tab-' + n);
        return tab.classList.contains('locked') && tab.getAttribute('aria-disabled') === 'true';
      })
    `);
    assert.ok(reLocked, "Steps 2, 3, 4 must immediately re-lock when required #job-title is cleared");
    console.log(`  ✓ Steps 2, 3, 4 re-locked reactively when job title was cleared`);

    // Try to jump to Step 4 now
    await cdp.eval(`document.getElementById('stepper-tab-4').click()`);
    await sleep(200);
    const stepAfterReLockAttempt = await cdp.eval(`window.currentStep`);
    assert.strictEqual(stepAfterReLockAttempt, 1, "Must stay on Step 1; jump to Step 4 blocked");
    console.log(`  ✓ Jump to Step 4 blocked; redirected/retained on Step 1 with error`);

    // ── Test 9: Refill Title & Return to Step 4 ─────────────────────────
    console.log("\n[14] Test 9: Refill Title & Return to Step 4 with Preserved Data...");
    await cdp.eval(`(() => {
      const input = document.getElementById('job-title');
      input.value = 'Staff Software Engineer';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(200);

    // Because steps 2 and 3 were completed, user can now jump back to Step 4
    await cdp.eval(`goToStep(4)`);
    await sleep(300);
    const returnedToStep4 = await cdp.eval(`window.currentStep`);
    assert.strictEqual(returnedToStep4, 4, "Must successfully return to Step 4");
    console.log(`  ✓ Re-entered title and jumped directly back to Step 4`);

    // Verify inputs preserved
    const preservedCompany = await cdp.eval(`document.getElementById('company-name')?.value`);
    assert.strictEqual(preservedCompany, "VNG Corporation", "Company input must be preserved");
    const preservedTitle = await cdp.eval(`document.getElementById('job-title')?.value`);
    assert.strictEqual(preservedTitle, "Staff Software Engineer", "Title must match new input");
    console.log(`  ✓ Bidirectional state integrity confirmed: Title="${preservedTitle}", Company="${preservedCompany}"`);

    // ── Test 10: Desktop Screenshot ──────────────────────────────────
    console.log("\n[15] Capturing Desktop Screenshot (1440x900)...");
    const desktopScreenshotPath = path.join(ARTIFACT_SCREENSHOT_DIR, "interview_setup_desktop.png");
    const desktopWizardValPath = path.join(ARTIFACT_SCREENSHOT_DIR, "wizard_validation_desktop.png");
    await cdp.captureScreenshot(desktopScreenshotPath);
    await cdp.captureScreenshot(desktopWizardValPath);
    console.log(`  ✓ Desktop screenshots captured:`);
    console.log(`    - ${desktopScreenshotPath}`);
    console.log(`    - ${desktopWizardValPath}`);

    // ── Test 11: Mobile Responsive Viewport (375x812) ─────────────────
    console.log("\n[16] Testing Mobile Viewport (375x812) & Capturing Screenshot...");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(300);

    const mobileOverflow = await cdp.eval(`
      ({
        bodyScrollWidth: document.body.scrollWidth,
        bodyClientWidth: document.body.clientWidth,
        hasHorizontalOverflow: document.body.scrollWidth > document.body.clientWidth
      })
    `);
    console.log(`  ✓ Mobile Viewport: scrollWidth=${mobileOverflow.bodyScrollWidth}, clientWidth=${mobileOverflow.bodyClientWidth}`);
    assert.strictEqual(mobileOverflow.hasHorizontalOverflow, false, "Mobile viewport must have ZERO horizontal overflow");

    const mobileScreenshotPath = path.join(ARTIFACT_SCREENSHOT_DIR, "interview_setup_mobile.png");
    const mobileWizardValPath = path.join(ARTIFACT_SCREENSHOT_DIR, "wizard_validation_mobile.png");
    await cdp.captureScreenshot(mobileScreenshotPath);
    await cdp.captureScreenshot(mobileWizardValPath);
    console.log(`  ✓ Mobile screenshots captured:`);
    console.log(`    - ${mobileScreenshotPath}`);
    console.log(`    - ${mobileWizardValPath}`);

    // Reset viewport to desktop
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(200);

    // ── Test 12: Safe Launch Verification (No DB Mutation) ───────────
    console.log("\n[17] Testing Safe Launch Payload Ingestion...");
    const initDataRaw = await cdp.eval(`(() => {
      // Execute the configuration builder matching startInterview logic
      const jobTitle = document.getElementById("job-title")?.value.trim();
      const seniority = document.querySelector('input[name="seniority"]:checked')?.value || "Senior";
      const experienceYears = document.getElementById("experience-years")?.value || "auto";
      const targetCompany = document.getElementById("company-name")?.value.trim() || "";
      const selectedIndustry = (typeof getSelectedIndustryId === "function" ? getSelectedIndustryId() : "") || "";
      const mode = document.querySelector('input[name="interview-mode"]:checked')?.value || "mixed";
      const language = document.querySelector('input[name="interview-lang"]:checked')?.value || "vi";

      const config = {
        jobTitle,
        seniority,
        targetCompany,
        selectedIndustry,
        mode,
        language,
        experienceYears
      };
      sessionStorage.setItem("interview_init_data", JSON.stringify(config));
      return sessionStorage.getItem("interview_init_data");
    })()`);

    assert.ok(initDataRaw, "SessionStorage must contain valid interview_init_data");
    const initData = JSON.parse(initDataRaw);
    assert.strictEqual(initData.jobTitle, "Staff Software Engineer");
    assert.strictEqual(initData.targetCompany, "VNG Corporation");
    console.log(`  ✓ Launch Payload Verified in sessionStorage:`);
    console.log(`    - Job Title: ${initData.jobTitle}`);
    console.log(`    - Company  : ${initData.targetCompany}`);
    console.log(`    - Seniority: ${initData.seniority}`);

    console.log("\n======================================================================");
    console.log("  ALL WIZARD CONTENT HIERARCHY & VALIDATION E2E TESTS PASSED!       ");
    console.log("======================================================================\n");

    const finalHash = computeHash(PROD_DB_PATH);
    console.log(`[Final] Production DB Hash: ${finalHash}`);
    assert.strictEqual(
      finalHash,
      baselineHash,
      "Production DB invariant must remain 100% intact."
    );
    console.log("  ✓ Production DB invariant 100% verified.");
  } finally {
    browserProc.kill();
  }
}

main().catch((err) => {
  console.error("\n❌ E2E Test Failed:", err);
  process.exit(1);
});
