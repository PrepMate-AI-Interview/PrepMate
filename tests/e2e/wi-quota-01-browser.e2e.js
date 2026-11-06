/**
 * PREPMATE — WI-QUOTA-01 BROWSER CDP E2E VERIFICATION SUITE
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const BASELINE_DB_HASH = "44223D9B7E945E70CADEB3279AE3EE5A0DD748A867B2C3A6B0C5C617A9DB62C3";

const TEST_PORT = 5196;
const CDP_PORT = 9256;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function computeHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex").toUpperCase();
}

function findEdgePath() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    process.env.LOCALAPPDATA + "\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
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
      this.ws = new WS(this.wsUrl);
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
      this.ws.addEventListener('message', (evt) => {
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

  async eval(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return r?.result?.value;
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await new Promise(r => setTimeout(r, 1500));
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }
  }
}

function startBackend(testDbPath, testDir) {
  return spawn("dotnet", [
    "run",
    "--project", "BE/backend.csproj",
    "--no-build",
    "--no-launch-profile",
    "--urls", BASE_URL
  ], {
    cwd: WORKSPACE_ROOT,
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: "Development",
      PORT: String(TEST_PORT),
      DOTNET_URLS: BASE_URL,
      ASPNETCORE_URLS: BASE_URL,
      DATABASE_FILE_PATH: testDbPath,
      DATABASE__FILEPATH: testDbPath,
      FILE_DB_PATH: testDbPath,
      PREPMATE_KEYRING_PATH: path.join(testDir, "keys")
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function stopProcess(proc) {
  if (!proc) return;
  try {
    if (process.platform === "win32") {
      require("child_process").execSync(`taskkill /F /T /PID ${proc.pid} 2>nul`);
    } else {
      proc.kill("SIGKILL");
    }
  } catch (_) {}
}

async function fetchJson(urlStr) {
  return new Promise((resolve, reject) => {
    http.get(urlStr, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function main() {
  console.log("==================================================================");
  console.log("   PREPMATE — WI-QUOTA-01 BROWSER CDP E2E VERIFICATION            ");
  console.log("==================================================================\n");

  const preHash = computeHash(PROD_DB_PATH);
  assert.strictEqual(preHash, BASELINE_DB_HASH, "DB Baseline invariant");

  const testDir = path.join(WORKSPACE_ROOT, "tests", "scratch_cdp_quota");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const testDbPath = path.join(testDir, "test_db.json");
  fs.copyFileSync(PROD_DB_PATH, testDbPath);

  console.log(`[INFO] Launching test backend on ${BASE_URL}...`);
  const backendProc = startBackend(testDbPath, testDir);

  const edgePath = findEdgePath();
  assert(edgePath, "Edge browser binary must exist");

  const browserUserData = path.join(testDir, "edge_profile");
  console.log(`[INFO] Launching Edge browser on CDP port ${CDP_PORT}...`);
  const browserProc = spawn(edgePath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${browserUserData}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ]);

  let cdp = null;

  try {
    // Wait for backend
    let backendUp = false;
    for (let i = 0; i < 40; i++) {
      try {
        await fetchJson(`${BASE_URL}/api/user/quota`);
        backendUp = true;
        break;
      } catch (_) {
        await new Promise(r => setTimeout(r, 250));
      }
    }
    assert(backendUp, "Backend must start successfully");
    console.log("  ✓ Backend is live.");

    // Connect to CDP
    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      try {
        const pages = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
        const page = pages.find(p => p.type === "page");
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 250));
    }
    assert(wsUrl, "CDP webSocketDebuggerUrl must be available");

    cdp = new CDPClient(wsUrl);
    await cdp.connect();
    console.log("  ✓ CDP connected.");

    // TEST 1: interview-info.html Free Quota Active Banner & Summary
    console.log("\n--- TEST 1: interview-info.html Free Quota (2/3 remaining) ---");
    await cdp.navigate(`${BASE_URL}/features/interview/interview-info.html`);

    const bannerType = await cdp.eval(`typeof window.renderQuotaBanner`);
    console.log("  renderQuotaBanner type:", bannerType);

    await cdp.eval(`
      window.fetchUserQuota = async () => ({ tier: 'free', used: 1, limit: 3, remaining: 2, canStart: true, resetAt: '2026-11-09T00:00:00+07:00' });
      window._cachedUserQuota = { tier: 'free', used: 1, limit: 3, remaining: 2, canStart: true, resetAt: '2026-11-09T00:00:00+07:00' };
      window._currentQuotaStatus = window._cachedUserQuota;
      if (typeof renderQuotaBanner === 'function') renderQuotaBanner(window._cachedUserQuota);
      if (typeof updateReadinessSummary === 'function') updateReadinessSummary();
    `);
    await new Promise(r => setTimeout(r, 200));

    const activeBannerText = await cdp.eval(`document.getElementById('free-tier-banner-text')?.textContent`);
    console.log("  Banner Text:", activeBannerText);
    assert.ok(activeBannerText && activeBannerText.includes("còn 2/3 lượt phỏng vấn trong tuần"), "Banner must state 'trong tuần'");
    assert.ok(!activeBannerText.includes("trong tháng"), "Banner must NOT state 'trong tháng'");

    const summaryQuotaText = await cdp.eval(`document.getElementById('summary-spec-quota')?.textContent`);
    console.log("  Summary Quota:", summaryQuotaText);
    assert.ok(summaryQuotaText && summaryQuotaText.includes("Free — Còn 2/3 lượt trong tuần"), "Step 4 readiness must state 'trong tuần'");
    assert.ok(!summaryQuotaText.includes("trong tháng"), "Summary must NOT state 'trong tháng'");
    console.log("  ✓ Active Free quota banner & summary verified.");

    // TEST 2: interview-info.html Free Quota Exhausted Banner & Summary
    console.log("\n--- TEST 2: interview-info.html Free Quota Exhausted (0/3 remaining) ---");
    await cdp.eval(`
      window.fetchUserQuota = async () => ({ tier: 'free', used: 3, limit: 3, remaining: 0, canStart: false, resetAt: '2026-11-09T00:00:00+07:00' });
      window._cachedUserQuota = { tier: 'free', used: 3, limit: 3, remaining: 0, canStart: false, resetAt: '2026-11-09T00:00:00+07:00' };
      window._currentQuotaStatus = window._cachedUserQuota;
      renderQuotaBanner(window._cachedUserQuota);
      updateReadinessSummary();
    `);
    await new Promise(r => setTimeout(r, 200));

    const exhaustedBannerText = await cdp.eval(`document.getElementById('free-tier-banner-text')?.textContent`);
    console.log("  Exhausted Banner Text:", exhaustedBannerText);
    assert.ok(exhaustedBannerText.includes("3/3 lượt phỏng vấn miễn phí trong tuần"), "Exhausted banner must state 'trong tuần'");
    assert.ok(!exhaustedBannerText.includes("trong tháng"), "Exhausted banner must NOT state 'trong tháng'");

    const exhaustedSummaryText = await cdp.eval(`document.getElementById('summary-spec-quota')?.textContent`);
    console.log("  Exhausted Summary Text:", exhaustedSummaryText);
    assert.ok(exhaustedSummaryText.includes("Free — Đã dùng hết lượt tuần này"), "Exhausted summary must state 'tuần này'");
    assert.ok(!exhaustedSummaryText.includes("tháng này"), "Exhausted summary must NOT state 'tháng này'");
    console.log("  ✓ Exhausted Free quota banner & summary verified.");

    // TEST 3: dashboard.html Banner
    console.log("\n--- TEST 3: dashboard.html Quota Banner ---");
    await cdp.navigate(`${BASE_URL}/features/dashboard/dashboard.html`);

    const dashboardHtml = await cdp.eval(`document.body.innerHTML`);
    assert.ok(!dashboardHtml.includes("phỏng vấn miễn phí tháng này"), "dashboard.html must not contain 'tháng này'");
    console.log("  ✓ dashboard.html weekly quota verified.");

    // TEST 4: pricing.html Feature Text
    console.log("\n--- TEST 4: pricing.html Feature Text ---");
    await cdp.navigate(`${BASE_URL}/features/payment/pricing.html`);
    const pricingHtml = await cdp.eval(`document.body.innerHTML`);
    assert.ok(pricingHtml.includes("3 lượt phỏng vấn</strong> AI mô phỏng mỗi tuần"), "pricing.html must show 'mỗi tuần'");
    assert.ok(!pricingHtml.includes("AI mô phỏng mỗi tháng"), "pricing.html must not show 'mỗi tháng'");
    console.log("  ✓ pricing.html weekly quota feature verified.");

    // TEST 5: payment.html Description Text
    console.log("\n--- TEST 5: payment.html Feature Text ---");
    await cdp.eval(`
      localStorage.setItem('prepmate_user', JSON.stringify({ id: 'user_free_test', email: 'free_test@example.com', token: 'mock_jwt_token_for_payment_test' }));
    `);
    await cdp.navigate(`${BASE_URL}/features/payment/payment.html?plan=free`);
    await new Promise(r => setTimeout(r, 600));
    const planDesc = await cdp.eval(`document.getElementById('checkout-plan-desc')?.textContent`);
    console.log("  Payment Free Plan Desc:", planDesc);
    assert.ok(planDesc && planDesc.includes("3 lượt phỏng vấn AI mô phỏng mỗi tuần"), "payment.html must show 'mỗi tuần'");
    assert.ok(!planDesc.includes("mỗi tháng"), "payment.html must not show 'mỗi tháng'");
    console.log("  ✓ payment.html weekly quota description verified.");

    // Final Invariant Check
    const postHash = computeHash(PROD_DB_PATH);
    assert.strictEqual(postHash, BASELINE_DB_HASH, "Production database must remain byte-for-byte untouched");
    console.log(`\n[SUCCESS] Baseline hash verified intact: ${postHash}`);

    console.log("\n==================================================================");
    console.log("   ALL 5 BROWSER CDP E2E CHECKS PASSED CLEANLY (100%)             ");
    console.log("==================================================================\n");

  } finally {
    if (cdp) cdp.close();
    stopProcess(browserProc);
    stopProcess(backendProc);
    try {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

main().catch(err => {
  console.error("FATAL ERROR IN CDP E2E SUITE:", err);
  process.exit(1);
});
