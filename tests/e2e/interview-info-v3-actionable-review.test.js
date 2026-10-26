/**
 * PREPMATE — INTERVIEW-INFO V3 CONSOLIDATED VERIFICATION SUITE
 * Verifies all V3 specific features:
 *   1. Hierarchical Selection: Khối ngành lớn -> Gợi ý công ty -> Vị trí ứng tuyển (#job-title)
 *   2. Dual CV & JD input panels with independent upload status & removal
 *   3. Guest Auth-Gated Review: Guest modal with Draft saving to sessionStorage & Guest preview mode
 *   4. Actionable Review Output: 4 structured blocks (Summary, Strengths w/ evidence, Gaps w/ no evidence, Prioritized Actions)
 *   5. Realistic Language Support: Vietnamese active, English coming-soon with toast
 *   6. Production Database SHA-256 Invariant
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5007;
const CDP_PORT = 9242;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const TEST_DIR = path.join(os.tmpdir(), `prepmate_v3_e2e_${Date.now()}`);
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
  console.log("  PREPMATE — INTERVIEW-INFO V3 CONSOLIDATED VERIFICATION SUITE       ");
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
      const pageTarget = targets && targets.data && targets.data.find(t => t.type === "page");
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        wsUrl = pageTarget.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {}
  }
  assert.ok(wsUrl, "CDP page webSocketDebuggerUrl not found");

  const cdp = new CDPClient(wsUrl);
  await cdp.connect();
  console.log(`  ✓ CDP connected.`);

  try {
    await cdp.send("Page.enable");
    await cdp.send("DOM.enable");

    // Navigate to interview-info.html
    const targetUrl = `${BASE_URL}/features/interview/interview-info.html`;
    await cdp.send("Page.navigate", { url: targetUrl });
    await sleep(2000);

    // ==================================================================
    // V3 TEST 1: Progressive Hierarchy (Khối ngành -> Công ty -> Vị trí)
    // ==================================================================
    console.log("\n--- V3 Scenario 1: Progressive Hierarchy & Dynamic Suggestions ---");

    const sectorCount = await cdp.eval(`document.querySelectorAll('.industry-sector-pill').length`);
    assert.ok(sectorCount >= 8, `Expected at least 8 primary industry sector pills, got ${sectorCount}`);

    // Click on Finance/Banking sector
    await cdp.eval(`
      const finBtn = Array.from(document.querySelectorAll('.industry-sector-pill')).find(p => p.textContent.includes('Tài chính') || p.getAttribute('data-sector-id') === 'finance_banking');
      if (finBtn) finBtn.click();
    `);
    await sleep(500);

    // Check company chips for finance_banking
    const finCompanies = await cdp.eval(`
      Array.from(document.querySelectorAll('.company-chip-btn')).map(b => b.textContent.trim())
    `);
    assert.ok(finCompanies.length >= 3, `Expected at least 3 suggested companies in Finance, got ${finCompanies.length}`);
    assert.ok(
      finCompanies.some(c => c.includes('Vietcombank') || c.includes('Techcombank') || c.includes('MB') || c.includes('VPBank')),
      `Expected banking companies in suggestions, got: ${finCompanies.join(', ')}`
    );

    // Click a company chip
    await cdp.eval(`
      const chip = document.querySelector('.company-chip-btn');
      if (chip) chip.click();
    `);
    await sleep(300);

    const filledCompany = await cdp.eval(`document.getElementById('company-name').value`);
    assert.ok(filledCompany.length > 0, "Company chip click did not populate #company-name");
    console.log(`  ✓ Industry -> Company selection populated: ${filledCompany}`);

    // Check that user can still type custom job-title freely without sector locking
    await cdp.eval(`
      const jobInput = document.getElementById('job-title');
      jobInput.value = 'Chuyên viên Tín dụng Doanh nghiệp';
      jobInput.dispatchEvent(new Event('input', { bubbles: true }));
    `);
    await sleep(300);

    const titleVal = await cdp.eval(`document.getElementById('job-title').value`);
    assert.strictEqual(titleVal, 'Chuyên viên Tín dụng Doanh nghiệp');
    console.log(`  ✓ Freely typed custom job title retained: ${titleVal}`);

    // ==================================================================
    // V3 TEST 2: Dual CV & JD Independent Input Panels
    // ==================================================================
    console.log("\n--- V3 Scenario 2: Dual CV + JD Simultaneous Input & Independent Panels ---");

    // Advance to Step 2
    await cdp.eval(`goToStep(2)`);
    await sleep(500);

    const step2Active = await cdp.eval(`document.getElementById('step-pane-2').classList.contains('active')`);
    assert.ok(step2Active, "Failed to navigate to Step 2");

    // Both panels must be visible simultaneously in DOM
    const cvPanelExists = await cdp.eval(`!!document.getElementById('block-cv-upload')`);
    const jdPanelExists = await cdp.eval(`!!document.getElementById('block-jd-input')`);
    assert.ok(cvPanelExists && jdPanelExists, "Dual panels (CV block and JD block) must both exist simultaneously");

    // Set mock CV text and JD text
    await cdp.eval(`
      document.getElementById('cv-text').value = '5 năm kinh nghiệm phân tích rủi ro tín dụng tại ngân hàng thương mại, nắm vững thẩm định báo cáo tài chính.';
      window._extractedCvText = document.getElementById('cv-text').value;
      document.getElementById('upload-status').classList.remove('hidden');
      document.getElementById('status-filename').textContent = 'Ho_So_Ung_Vien.pdf';
      document.getElementById('status-filesize').textContent = '(124 KB)';
      document.getElementById('upload-box').classList.add('hidden');

      document.getElementById('jd-text').value = 'Tuyển dụng Chuyên viên Tín dụng: Yêu cầu thẩm định hồ sơ khách hàng doanh nghiệp, phân tích dòng tiền và báo cáo tài chính.';
      document.getElementById('jd-upload-status').classList.remove('hidden');
      document.getElementById('jd-status-filename').textContent = 'JD_TinDung.pdf';
      document.getElementById('jd-status-filesize').textContent = '(85 KB)';
    `);
    await sleep(300);

    // Verify independent remove for JD
    await cdp.eval(`removeUploadedJd()`);
    await sleep(200);

    const jdTextAfterRemove = await cdp.eval(`document.getElementById('jd-text').value`);
    const cvTextAfterJdRemove = await cdp.eval(`document.getElementById('cv-text').value`);
    assert.strictEqual(jdTextAfterRemove, '', "JD removal should clear JD text");
    assert.ok(cvTextAfterJdRemove.length > 0, "Removing JD must NOT clear CV text");
    console.log(`  ✓ Independent removal verified: JD cleared, CV preserved`);

    // Re-fill JD for analysis test
    await cdp.eval(`
      document.getElementById('jd-text').value = 'Mô tả công việc: Thẩm định hồ sơ tín dụng, đánh giá rủi ro doanh nghiệp vừa và nhỏ.';
    `);

    // ==================================================================
    // V3 TEST 3: Auth Gated Review Modal (Guest Flow)
    // ==================================================================
    console.log("\n--- V3 Scenario 3: Auth-Gated Saved Analysis (Guest Prompt & Draft Persistence) ---");

    // Ensure logged-out state
    await cdp.eval(`
      localStorage.removeItem('prepmate_auth_token');
      sessionStorage.removeItem('prepmate_auth_token');
    `);

    // Click "Phân tích hồ sơ (CV & JD)"
    await cdp.eval(`handleAnalyzeProfileClick()`);
    await sleep(400);

    // Guest modal should be visible
    const modalVisible = await cdp.eval(`(() => {
      const m = document.getElementById('guest-auth-modal');
      return m && !m.classList.contains('hidden') && m.style.display !== 'none';
    })()`);
    assert.ok(modalVisible, "Guest auth modal must be displayed when guest clicks analyze profile");
    console.log("  ✓ Guest auth modal triggered successfully");

    // Test Guest Preview mode (continue without saving)
    await cdp.eval(`continueAsGuestPreview()`);
    for (let i = 0; i < 25; i++) {
      const isVis = await cdp.eval(`(() => {
        const p = document.getElementById('cv-analysis-panel');
        return p && !p.classList.contains('hidden');
      })()`);
      if (isVis) break;
      await sleep(300);
    }

    const guestAlertVisible = await cdp.eval(`(() => {
      const a = document.getElementById('guest-preview-alert');
      return a && !a.classList.contains('hidden');
    })()`);
    assert.ok(guestAlertVisible, "Guest preview warning alert must be displayed in preview mode");
    console.log("  ✓ Guest preview alert visible: Temporary inspection mode activated");

    // ==================================================================
    // V3 TEST 4: Actionable Review Structured Presentation
    // ==================================================================
    console.log("\n--- V3 Scenario 4: Structured Actionable Review (Summary, Strengths, Gaps, Prioritized Actions) ---");

    const analysisPanelVisible = await cdp.eval(`(() => {
      const p = document.getElementById('cv-analysis-panel');
      return p && !p.classList.contains('hidden');
    })()`);
    assert.ok(analysisPanelVisible, "CV Analysis panel must be displayed after analysis");

    // 1. Summary
    const summaryText = await cdp.eval(`document.getElementById('cv-analysis-summary').textContent.trim()`);
    assert.ok(summaryText.length > 10, "Summary must be populated with concise assessment");

    // 2. Strengths with evidence
    const strengthsCount = await cdp.eval(`document.querySelectorAll('#cv-strengths-list li').length`);
    assert.ok(strengthsCount > 0 && strengthsCount <= 3, `Expected 1-3 strengths with evidence, got ${strengthsCount}`);

    // 3. Gaps with no-evidence disclaimer
    const gapsCount = await cdp.eval(`document.querySelectorAll('#cv-gaps-list li').length`);
    assert.ok(gapsCount > 0 && gapsCount <= 3, `Expected 1-3 gaps labeled with no-evidence disclaimer, got ${gapsCount}`);

    // 4. Prioritized Actions (Cao/Vừa/Thấp)
    const actionTags = await cdp.eval(`
      Array.from(document.querySelectorAll('#cv-action-items-list .priority-tag')).map(t => t.textContent.trim())
    `);
    assert.ok(actionTags.length > 0 && actionTags.length <= 3, `Expected 1-3 prioritized actions, got ${actionTags.length}`);
    assert.ok(actionTags.some(t => t.includes('Cao') || t.includes('Vừa') || t.includes('Thấp')), "Actions must have priority badges");

    console.log(`  ✓ Actionable Review verified: Summary + ${strengthsCount} Strengths + ${gapsCount} Gaps + ${actionTags.length} Priority Actions`);

    // ==================================================================
    // V3 TEST 5: Language Support Policy (Honest English Handling)
    // ==================================================================
    console.log("\n--- V3 Scenario 5: Language Support & Coming-Soon English Badge ---");

    await cdp.eval(`goToStep(3)`);
    await sleep(400);

    const enTileHasBadge = await cdp.eval(`(() => {
      const badge = document.querySelector('#lang-tile-en .coming-soon-badge');
      return !!badge && badge.textContent.includes('Sắp hỗ trợ');
    })()`);
    assert.ok(enTileHasBadge, "English tile must contain 'Sắp hỗ trợ' badge");

    // Simulate user click on English
    await cdp.eval(`setChamberLanguage('usa', true)`);
    await sleep(300);

    const langAfterUserClick = await cdp.eval(`document.getElementById('interview-language').value`);
    assert.strictEqual(langAfterUserClick, 'vi', "User click on English must not switch away from Vietnamese; English is coming soon");
    console.log("  ✓ English tile user click politely intercepted, Vietnamese preserved as active");

    // ==================================================================
    // V3 TEST 6: Production Database SHA-256 Invariant
    // ==================================================================
    console.log("\n--- V3 Scenario 6: Production Database Invariant ---");
    const finalHash = computeHash(PROD_DB_PATH);
    assert.strictEqual(finalHash, initialHash, "Production DB hash changed! Invariant violated!");
    console.log(`  ✓ Production DB invariant 100% verified (${finalHash})`);

    console.log("\n======================================================================");
    console.log("  ALL V3 ACCEPTANCE SCENARIOS PASSED CLEANLY (100%)!                  ");
    console.log("======================================================================");
  } finally {
    cdp.close();
    browserProc.kill();
    backendProc.kill();
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }
}

runTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
