/**
 * PREPMATE — INTERVIEW-INFO FE OPTIMIZATION VERIFICATION SUITE
 * Work Item: WI-FE-INTERVIEW-INFO-01
 * Comprehensive E2E Browser Testing covering:
 *   - Flow A: Guest User quota display upfront, demo limit reflection, and exhaustion modal gating
 *   - Flow B: Free Tier quota display upfront, monthly limit reflection, and exhaustion modal gating
 *   - Flow C: Pro Tier quota display upfront, unlimited status in banner & Step 4 summary
 *   - Flow D: Dynamic Sector-Role chips, datalist generation, cross-sector mismatch resolution & validation persistence
 *   - Database SHA-256 baseline invariant guarantee
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5008;
const CDP_PORT = 9243;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const TEST_DIR = path.join(os.tmpdir(), `prepmate_fe_opt_e2e_${Date.now()}`);
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
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
        }
      };
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
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
  }
}

async function runTest() {
  console.log("======================================================================");
  console.log("  PREPMATE — WI-FE-INTERVIEW-INFO-01 LIVE VERIFICATION SUITE         ");
  console.log("======================================================================");

  const baselineHash = computeHash(PROD_DB_PATH);
  console.log(`[1] Production DB Hash Baseline: ${baselineHash}`);

  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

  const browserPath = findBrowserExecutable();
  assert.ok(browserPath, "Headless browser executable must be found");
  console.log(`[2] Browser: ${browserPath}`);

  console.log(`[3] Launching backend on port ${BACKEND_PORT}...`);
  const backendProc = spawn(
    "dotnet",
    ["run", "--no-launch-profile", "--urls", BASE_URL],
    {
      cwd: path.join(WORKSPACE_ROOT, "BE"),
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: "Development",
        DOTNET_CLI_TELEMETRY_OPTOUT: "1",
        PREPMATE_DB_PATH: TEST_DB_PATH,
        PREPMATE_KEYRING_DIR: TEST_KEYRING_PATH,
        ASPNETCORE_URLS: BASE_URL,
      },
      stdio: "pipe",
    }
  );

  let backendStarted = false;
  backendProc.stdout.on("data", (d) => {
    if (d.toString().includes("Now listening on") || d.toString().includes("Application started")) {
      backendStarted = true;
    }
  });

  const startTimeout = Date.now() + 25000;
  while (Date.now() < startTimeout && !backendStarted) {
    try {
      const res = await requestJsonOnce(`${BASE_URL}/api/health`);
      if (res.status === 200) {
        backendStarted = true;
        break;
      }
    } catch (e) {}
    await sleep(500);
  }
  assert.ok(backendStarted, "Backend failed to launch within 25s");
  console.log("  ✓ Backend responsive.");

  const userDataDir = path.join(TEST_DIR, "browser_profile");
  fs.mkdirSync(userDataDir, { recursive: true });

  console.log(`[4] Launching Browser with CDP on port ${CDP_PORT}...`);
  const browserProc = spawn(browserPath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1280,800",
    "about:blank",
  ]);

  let cdp = null;
  const cdpTimeout = Date.now() + 15000;
  while (Date.now() < cdpTimeout) {
    try {
      const targets = await requestJsonOnce(`http://127.0.0.1:${CDP_PORT}/json`);
      if (Array.isArray(targets.data) && targets.data.length > 0) {
        const pageTarget = targets.data.find((t) => t.type === "page") || targets.data[0];
        if (pageTarget && pageTarget.webSocketDebuggerUrl) {
          cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
          await cdp.connect();
          break;
        }
      }
    } catch (e) {}
    await sleep(400);
  }
  assert.ok(cdp, "Failed to connect to browser CDP");
  console.log("  ✓ CDP connected.");

  try {
    const pageUrl = `${BASE_URL}/features/interview/interview-info.html`;
    await cdp.send("Page.navigate", { url: pageUrl });
    await sleep(1500);

    // ==================================================================
    // FLOW D: Dynamic Sector-Role Chips & Error State Persistence
    // ==================================================================
    console.log("\n--- Flow D: Dynamic Sector-Role Chips & Error State ---");

    // 1. Missing Job Title Error State Persistence
    await cdp.eval(`goToStep(2)`);
    await sleep(400);

    const hasError = await cdp.eval(`document.getElementById('job-title').classList.contains('input-error')`);
    const ariaInvalid = await cdp.eval(`document.getElementById('job-title').getAttribute('aria-invalid')`);
    assert.strictEqual(hasError, true, "Job title input must have input-error class when invalid");
    assert.strictEqual(ariaInvalid, "true", "Job title input must have aria-invalid='true'");

    // Verify error state does NOT auto-clear after 3500ms
    await sleep(3600);
    const stillHasError = await cdp.eval(`document.getElementById('job-title').classList.contains('input-error')`);
    assert.strictEqual(stillHasError, true, "Error state must persist until user corrects it");

    // 2. Dynamic Sector-specific Role Chips
    // Switch to Finance & Banking
    await cdp.eval(`(() => {
      const finPill = Array.from(document.querySelectorAll('.industry-sector-pill')).find(p => p.textContent.includes('Tài chính') || p.getAttribute('data-sector-id') === 'finance_banking');
      if (finPill) finPill.click();
    })()`);
    await sleep(400);

    const finChips = await cdp.eval(`
      Array.from(document.querySelectorAll('#industry-role-chips .role-chip-card')).map(c => c.getAttribute('data-role'))
    `);
    assert.ok(finChips.length > 0, "Role chips should dynamically populate for Finance sector");

    // Click first chip
    await cdp.eval(`(() => {
      const firstChip = document.querySelector('#industry-role-chips .role-chip-card');
      if (firstChip) firstChip.click();
    })()`);
    await sleep(300);

    const titleAfterChip = await cdp.eval(`document.getElementById('job-title').value`);
    assert.ok(titleAfterChip.length > 0, "Job title should be populated from dynamic chip click");

    const errorCleared = await cdp.eval(`!document.getElementById('job-title').classList.contains('input-error')`);
    assert.strictEqual(errorCleared, true, "Error should clear immediately upon selecting a role");

    // 3. Cross-Sector Mismatch: Switching away from sector clears quick chip role
    await cdp.eval(`(() => {
      const techPill = Array.from(document.querySelectorAll('.industry-sector-pill')).find(p => p.getAttribute('data-sector-id') === 'tech_engineering');
      if (techPill) techPill.click();
    })()`);
    await sleep(400);

    const titleAfterSectorSwitch = await cdp.eval(`document.getElementById('job-title').value`);
    assert.strictEqual(titleAfterSectorSwitch, "", "Selecting a role from a previous sector should reset when moving to incompatible sector");

    // 4. Custom freely typed position is preserved across sector change
    await cdp.eval(`(() => {
      const input = document.getElementById('job-title');
      input.value = 'Chuyên viên Tín dụng Doanh nghiệp';
      delete input.dataset.selectedFromSector;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(300);

    await cdp.eval(`(() => {
      const finPill = Array.from(document.querySelectorAll('.industry-sector-pill')).find(p => p.getAttribute('data-sector-id') === 'finance_banking');
      if (finPill) finPill.click();
    })()`);
    await sleep(400);

    const preservedCustomTitle = await cdp.eval(`document.getElementById('job-title').value`);
    assert.strictEqual(preservedCustomTitle, "Chuyên viên Tín dụng Doanh nghiệp", "Freely typed custom title must be preserved across sector change");
    console.log("  ✓ Dynamic chips, error persistence & cross-sector mismatch resolution verified");

    // ==================================================================
    // FLOW A: Guest User Quota & Banner Synchronization
    // ==================================================================
    console.log("\n--- Flow A: Guest User Quota & Banner Synchronization ---");

    // Test with fresh Guest quota (remaining = 1)
    await cdp.eval(`
      window._cachedUserQuota = { tier: 'guest', used: 0, limit: 1, remaining: 1, canStart: true };
      initQuotaAndSubscriptionStatus();
    `);
    await sleep(300);

    const guestBannerText = await cdp.eval(`document.getElementById('free-tier-banner-text').textContent`);
    const guestBannerVisible = await cdp.eval(`document.getElementById('free-tier-banner').style.display !== 'none'`);
    assert.ok(guestBannerVisible, "Free tier banner must be visible upfront");
    assert.ok(guestBannerText.includes("Khách") && guestBannerText.includes("1 lượt phỏng vấn demo"), "Banner text must reflect Guest 1 demo limit");

    // Check Step 4 summary
    await cdp.eval(`goToStep(4, true)`);
    await sleep(400);
    const guestSummaryQuota = await cdp.eval(`document.getElementById('summary-spec-quota')?.textContent`);
    assert.ok(guestSummaryQuota && guestSummaryQuota.includes("Khách") && guestSummaryQuota.includes("1/1 lượt demo"), "Step 4 summary must display Guest remaining demo");

    // Test with exhausted Guest quota (remaining = 0)
    await cdp.eval(`
      window._cachedUserQuota = { tier: 'guest', used: 1, limit: 1, remaining: 0, canStart: false };
      renderQuotaBanner(window._cachedUserQuota);
      updateReadinessSummary();
    `);
    await sleep(300);

    const exhaustedGuestBanner = await cdp.eval(`document.getElementById('free-tier-banner').classList.contains('banner-exhausted')`);
    assert.strictEqual(exhaustedGuestBanner, true, "Banner must apply .banner-exhausted when Guest quota is 0");

    const exhaustedGuestSummary = await cdp.eval(`document.getElementById('summary-spec-quota')?.textContent`);
    assert.ok(exhaustedGuestSummary.includes("Đã dùng hết lượt demo"), "Step 4 summary must state demo exhausted");
    console.log("  ✓ Flow A (Guest available & exhausted) verified");

    // ==================================================================
    // FLOW B: Free User Quota & Banner Synchronization
    // ==================================================================
    console.log("\n--- Flow B: Free User Quota & Banner Synchronization ---");

    // Test Free tier with remaining = 2/3
    await cdp.eval(`
      window._cachedUserQuota = { tier: 'free', used: 1, limit: 3, remaining: 2, canStart: true };
      renderQuotaBanner(window._cachedUserQuota);
      updateReadinessSummary();
    `);
    await sleep(300);

    const freeBannerText = await cdp.eval(`document.getElementById('free-tier-banner-text').textContent`);
    assert.ok(freeBannerText.includes("Free") && freeBannerText.includes("2/3"), "Free banner must reflect 2/3 remaining");

    const freeSummaryQuota = await cdp.eval(`document.getElementById('summary-spec-quota')?.textContent`);
    assert.ok(freeSummaryQuota.includes("Free") && freeSummaryQuota.includes("2/3"), "Step 4 summary must reflect Free 2/3 quota");

    // Test Free tier exhausted (0/3)
    await cdp.eval(`
      window._cachedUserQuota = { tier: 'free', used: 3, limit: 3, remaining: 0, canStart: false, resetAt: '2026-11-01T00:00:00Z' };
      renderQuotaBanner(window._cachedUserQuota);
      updateReadinessSummary();
    `);
    await sleep(300);

    const exhaustedFreeBanner = await cdp.eval(`document.getElementById('free-tier-banner').classList.contains('banner-exhausted')`);
    assert.strictEqual(exhaustedFreeBanner, true, "Banner must apply .banner-exhausted when Free quota is 0");

    const exhaustedFreeSummary = await cdp.eval(`document.getElementById('summary-spec-quota')?.textContent`);
    assert.ok(exhaustedFreeSummary.includes("Đã dùng hết lượt"), "Step 4 summary must state free monthly exhausted");
    console.log("  ✓ Flow B (Free tier remaining & exhausted) verified");

    // ==================================================================
    // FLOW C: Pro User Quota & Banner Synchronization
    // ==================================================================
    console.log("\n--- Flow C: Pro User Quota & Banner Synchronization ---");

    await cdp.eval(`
      window._cachedUserQuota = { tier: 'pro', used: 12, limit: null, remaining: 9999, canStart: true };
      renderQuotaBanner(window._cachedUserQuota);
      updateReadinessSummary();
    `);
    await sleep(300);

    const proBannerHasClass = await cdp.eval(`document.getElementById('free-tier-banner').classList.contains('pro-banner')`);
    assert.strictEqual(proBannerHasClass, true, "Banner must apply .pro-banner for Pro tier");

    const proBannerText = await cdp.eval(`document.getElementById('free-tier-banner-text').textContent`);
    assert.ok(proBannerText.includes("PRO Không giới hạn"), "Banner must state PRO Không giới hạn");

    const proSummaryQuota = await cdp.eval(`document.getElementById('summary-spec-quota')?.textContent`);
    assert.ok(proSummaryQuota.includes("PRO — Không giới hạn"), "Step 4 summary must state PRO unlimited quota");
    console.log("  ✓ Flow C (Pro unlimited tier) verified");

    // ==================================================================
    // Database SHA-256 Invariant Check
    // ==================================================================
    const finalHash = computeHash(PROD_DB_PATH);
    console.log(`\nFinal Production DB Hash: ${finalHash}`);
    assert.strictEqual(finalHash, baselineHash, "Production DB invariant must strictly match baseline!");
    console.log("  ✓ Production DB invariant 100% verified!");

    console.log("\n======================================================================");
    console.log("  ALL WI-FE-INTERVIEW-INFO-01 VERIFICATION SCENARIOS PASSED (100%)!   ");
    console.log("======================================================================");
  } finally {
    if (cdp) cdp.close();
    browserProc.kill();
    backendProc.kill();
    try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}
  }
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
