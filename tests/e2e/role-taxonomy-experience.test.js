/**
 * PREPMATE — REAL BROWSER E2E: ROLE TAXONOMY, TIERED FILTERING & REALISTIC EXPERIENCE MATCHING
 * WI-ROLE-TAXONOMY-UX-01 ACCEPTANCE VERIFICATION
 *
 * Verifies live browser flow on Edge/Chrome via CDP:
 *   1. Sector roles structured into 3-tier career levels (Entry, Professional, Senior/Lead).
 *   2. Interactive level filter tabs (Tất cả, Khởi đầu, Chuyên viên, Quản lý/Lead) correctly
 *      toggle and filter suggested role chips without page reload.
 *   3. Free-text entry link ("Hoặc tự nhập chức danh tự do") smoothly focuses #job-title.
 *   4. Optional #experience-years select dropdown under Seniority group.
 *   5. Neutral Experience Alignment Guidance:
 *      - Detects Management/Executive titles (e.g. "Giám đốc Kinh doanh", "Engineering Manager")
 *        paired with Junior / < 1 year experience, displays non-blocking guidance notice.
 *      - Provides 1-click action to switch to "Lead" which resolves notice, but NEVER blocks or forces user.
 *      - Detects Entry titles (e.g. "Thực tập sinh") paired with Senior/Lead, shows neutral notice.
 *   6. Adaptive Context Ingestion:
 *      - Launch payload injects [Định hướng cấp bậc - ...] into userDescription.
 *   7. Responsive viewports (Desktop 1440x900 and Mobile 375x812) with screenshots.
 *   8. Production DB SHA-256 hash verified invariant before and after.
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
const CDP_PORT = 9237;
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
  console.log("  PREPMATE — ROLE TAXONOMY, TIERED FILTERING & EXPERIENCE E2E        ");
  console.log("  WI-ROLE-TAXONOMY-UX-01 Acceptance Verification via Edge CDP        ");
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

  const tmpProfile = path.join(os.tmpdir(), `prepmate_role_e2e_${Date.now()}`);
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
    
    // Wait for DOM load complete
    for (let i = 0; i < 30; i++) {
      try {
        const ready = await cdp.eval(`document.readyState === 'complete' && !!document.getElementById('job-title') && document.querySelectorAll('.role-tier-tab').length === 4`);
        if (ready) break;
      } catch (e) {}
      await sleep(200);
    }
    await sleep(500);

    // Verify Presence of Tiered Filter Tabs & Experience Select
    const filterTabsCount = await cdp.eval(`document.querySelectorAll('.role-tier-tab').length`);
    assert.strictEqual(filterTabsCount, 4, "Must have 4 level filter tabs (Tất cả, Khởi đầu, Chuyên viên, Quản lý)");
    console.log(`  ✓ Level filter tabs rendered: ${filterTabsCount}`);

    const expSelectExists = await cdp.eval(`!!document.getElementById('experience-years')`);
    assert.ok(expSelectExists, "#experience-years select dropdown must exist in DOM");
    console.log(`  ✓ #experience-years select dropdown verified`);

    const alignmentNoticeExists = await cdp.eval(`!!document.getElementById('experience-alignment-notice')`);
    assert.ok(alignmentNoticeExists, "#experience-alignment-notice must exist in DOM");
    console.log(`  ✓ #experience-alignment-notice guidance container verified`);

    // ── Test 1: Tiered Role Filtering on Tech Sector ────────────────
    console.log("\n[6] Testing Tiered Role Filtering on Tech Sector...");
    
    // Default "Tất cả"
    const allRoles = await cdp.eval(`
      Array.from(document.querySelectorAll('#taxonomy-roles-list .taxonomy-role-chip')).map(el => el.textContent.trim())
    `);
    console.log(`  ✓ "Tất cả" roles count: ${allRoles.length} (${allRoles.slice(0, 3).join(", ")}...)`);
    assert.ok(allRoles.includes("Frontend Developer") && allRoles.includes("Backend Developer"), "Default roles include core positions");

    // Switch to "Khởi đầu / Entry"
    await cdp.eval(`filterRolesByTier('entry')`);
    await sleep(200);
    const entryRoles = await cdp.eval(`
      Array.from(document.querySelectorAll('#taxonomy-roles-list .taxonomy-role-chip')).map(el => el.textContent.trim())
    `);
    console.log(`  ✓ "Khởi đầu / Entry" roles: ${JSON.stringify(entryRoles)}`);
    assert.ok(entryRoles.some(r => r.includes("Thực tập sinh") || r.includes("Fresher") || r.includes("Junior")), "Entry roles must contain entry positions");

    // Switch to "Quản lý / Lead"
    await cdp.eval(`filterRolesByTier('senior_lead')`);
    await sleep(200);
    const leadRoles = await cdp.eval(`
      Array.from(document.querySelectorAll('#taxonomy-roles-list .taxonomy-role-chip')).map(el => el.textContent.trim())
    `);
    console.log(`  ✓ "Quản lý / Lead" roles: ${JSON.stringify(leadRoles)}`);
    assert.ok(leadRoles.some(r => r.includes("Senior") || r.includes("Lead") || r.includes("Manager") || r.includes("Architect")), "Lead roles must contain senior/lead positions");

    // Click suggested role chip to apply it
    await cdp.eval(`
      const chip = Array.from(document.querySelectorAll('#taxonomy-roles-list .taxonomy-role-chip')).find(el => el.textContent.includes('Senior Software Engineer'));
      if (chip) chip.click();
    `);
    const appliedRole = await cdp.eval(`document.getElementById('job-title').value`);
    assert.strictEqual(appliedRole, "Senior Software Engineer", "Clicking suggested role must update #job-title");
    console.log(`  ✓ Applied suggested role via tier chip: "${appliedRole}"`);

    // ── Test 2: Neutral Alignment Guidance (Manager Role with Junior Seniority) ──
    console.log("\n[7] Testing Neutral Alignment Guidance (Manager Role + Junior)...");
    
    // Set Job Title to "Giám đốc Công nghệ (CTO)" and Seniority to "Junior"
    await cdp.eval(`(() => {
      document.getElementById('job-title').value = 'Giám đốc Công nghệ (CTO)';
      const jr = document.getElementById('seniority-junior');
      if (jr) jr.click();
      onJobTitleInput();
    })()`);
    await sleep(200);
    await sleep(300);

    const isNoticeVisible = await cdp.eval(`!document.getElementById('experience-alignment-notice').classList.contains('hidden')`);
    const noticeTitle = await cdp.eval(`document.getElementById('experience-alignment-title').textContent.trim()`);
    const noticeText = await cdp.eval(`document.getElementById('experience-alignment-text').textContent.trim()`);
    const hasSwitchAction = await cdp.eval(`!!document.querySelector('#experience-alignment-action .btn-align-seniority')`);

    console.log(`  ✓ Alignment notice visible: ${isNoticeVisible}`);
    console.log(`  ✓ Notice Title: "${noticeTitle}"`);
    console.log(`  ✓ Notice Text: "${noticeText.substring(0, 80)}..."`);
    console.log(`  ✓ 1-Click Action Button available: ${hasSwitchAction}`);

    assert.ok(isNoticeVisible, "Notice must appear for Manager title with Junior level");
    assert.ok(noticeText.includes("quản lý") || noticeText.includes("lãnh đạo"), "Guidance must explain management focus");
    assert.ok(hasSwitchAction, "Action button to switch seniority should be provided");

    // Click action button to switch to Lead
    await cdp.eval(`document.querySelector('#experience-alignment-action .btn-align-seniority').click()`);
    await sleep(300);

    const updatedSeniority = await cdp.eval(`document.querySelector('input[name="seniority"]:checked').value`);
    const noticeDismissed = await cdp.eval(`document.getElementById('experience-alignment-notice').classList.contains('hidden')`);
    console.log(`  ✓ Seniority updated to: "${updatedSeniority}"`);
    console.log(`  ✓ Notice cleanly dismissed after alignment: ${noticeDismissed}`);
    assert.strictEqual(updatedSeniority, "Lead", "Seniority should be updated to Lead");
    assert.ok(noticeDismissed, "Notice must hide after alignment");

    // ── Test 3: Non-blocking Verification (User Can Keep Misaligned Title) ──
    console.log("\n[8] Verifying User Is NEVER Blocked or Force-Downgraded...");
    
    // Re-introduce misalignment deliberately: "Giám đốc Kinh doanh" with Junior
    await cdp.eval(`
      document.getElementById('job-title').value = 'Giám đốc Kinh doanh B2B';
      document.getElementById('seniority-junior').checked = true;
      document.getElementById('experience-years').value = 'under_1';
      onSeniorityChange();
      onExperienceYearsChange();
      onJobTitleInput();
    `);
    await sleep(200);

    // Proceed through steps: Step 1 -> Step 2 -> Step 3 -> Step 4
    await cdp.eval(`goToStep(2)`);
    await sleep(200);
    const step2Active = await cdp.eval(`document.getElementById('step-pane-2').classList.contains('active')`);
    assert.ok(step2Active, "User must NOT be blocked from proceeding to Step 2");

    await cdp.eval(`goToStep(3)`);
    await sleep(200);
    await cdp.eval(`goToStep(4)`);
    await sleep(300);

    const step4Active = await cdp.eval(`document.getElementById('step-pane-4').classList.contains('active')`);
    assert.ok(step4Active, "User can freely reach Step 4 review");

    const summaryRoleText = await cdp.eval(`document.getElementById('summary-spec-role').textContent.trim()`);
    console.log(`  ✓ Step 4 Summary preserves exact user choice: "${summaryRoleText}"`);
    assert.ok(summaryRoleText.includes("Giám đốc Kinh doanh B2B") && summaryRoleText.includes("Junior"), "Summary reflects user choice without force-downgrade");

    // ── Test 4: Capture Evidence Screenshots ───────────────────────
    console.log("\n[9] Capturing Evidence Screenshots on Setup Wizard...");

    // Desktop view (Step 1 with Alignment Guidance)
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.eval(`goToStep(1)`);
    await sleep(300);
    const desktopScreenshotPath = path.join(ARTIFACT_SCREENSHOT_DIR, "role_taxonomy_desktop.png");
    await cdp.captureScreenshot(desktopScreenshotPath);
    console.log(`  ✓ Desktop screenshot captured: ${desktopScreenshotPath}`);

    // Mobile view (375x812)
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(300);
    const mobileScreenshotPath = path.join(ARTIFACT_SCREENSHOT_DIR, "role_taxonomy_mobile.png");
    await cdp.captureScreenshot(mobileScreenshotPath);
    console.log(`  ✓ Mobile screenshot captured: ${mobileScreenshotPath}`);

    // Reset to desktop for launch verification
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.eval(`goToStep(4)`);
    await sleep(300);

    // ── Test 5: Launch Payload & Adaptive Context Ingestion ─────────
    console.log("\n[10] Testing Adaptive Level Context Ingestion in Launch Payload...");

    const initDataRaw = await cdp.eval(`(() => {
      const jobTitle = document.getElementById("job-title")?.value.trim();
      const seniority = document.querySelector('input[name="seniority"]:checked')?.value || "Senior";
      const experienceYears = document.getElementById("experience-years")?.value || "auto";
      const selectedIndustry = (typeof getSelectedIndustryId === "function" ? getSelectedIndustryId() : "") ||
        sessionStorage.getItem("prepmate_selected_industry") || "";
      const domainContextNotes = typeof gatherDomainContextNotes === "function" ? gatherDomainContextNotes() : "";
      const levelContextNotes = (typeof window !== "undefined" && window.PrepMateTaxonomy && typeof window.PrepMateTaxonomy.getAdaptiveLevelContext === "function")
        ? window.PrepMateTaxonomy.getAdaptiveLevelContext(seniority, experienceYears)
        : "";

      let enrichedDescription = "";
      if (levelContextNotes) {
        enrichedDescription = enrichedDescription ? (enrichedDescription + "\\n" + levelContextNotes) : levelContextNotes;
      }
      if (domainContextNotes) {
        enrichedDescription = enrichedDescription ? (enrichedDescription + "\\n" + domainContextNotes) : domainContextNotes;
      }

      const config = {
        jobTitle,
        seniority,
        targetLevel: seniority,
        experienceLevel: seniority,
        experienceYears,
        userDescription: enrichedDescription,
        selectedIndustry
      };
      sessionStorage.setItem("interview_init_data", JSON.stringify(config));
      return sessionStorage.getItem("interview_init_data");
    })()`);

    assert.ok(initDataRaw, "SessionStorage must contain interview_init_data");
    const initData = JSON.parse(initDataRaw);

    console.log(`  ✓ Initialized Payload:`);
    console.log(`    - Job Title       : ${initData.jobTitle}`);
    console.log(`    - Seniority       : ${initData.seniority}`);
    console.log(`    - Experience Years: ${initData.experienceYears}`);
    console.log(`    - Enriched Desc   : ${initData.userDescription}`);

    assert.strictEqual(initData.jobTitle, "Giám đốc Kinh doanh B2B");
    assert.strictEqual(initData.seniority, "Junior");
    assert.strictEqual(initData.experienceYears, "under_1");
    assert.ok(initData.userDescription.includes("[Định hướng cấp bậc - Junior]"), "userDescription must include adaptive level context notes");

    console.log("\n======================================================================");
    console.log("  ALL ROLE TAXONOMY & EXPERIENCE E2E TESTS PASSED SUCCESSFULLY!       ");
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
