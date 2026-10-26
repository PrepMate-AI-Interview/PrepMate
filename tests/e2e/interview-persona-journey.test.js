/**
 * PREPMATE — REAL BROWSER E2E: FULL INTERVIEW JOURNEY UI/UX & PERSONA SYNC
 * WI-INTERVIEW-UI-01 ACCEPTANCE VERIFICATION
 *
 * Real browser test on Edge via CDP:
 *   1. Persona Selector & Static Greeting on interview-info.html (Step 3).
 *   2. Step 4 Readiness Review synchronization.
 *   3. Room Launch & Interview Room (interview-practice.html) persona sync:
 *      - Interviewer nameplate (#interviewer-name-display)
 *      - Avatar initials & badge
 *      - Dynamic welcome message in Chat
 *      - Confirmation modal
 *   4. Report page (report.html) interviewer badge sync.
 *   5. History page (history.html) session cards interviewer badge sync.
 *   6. Production database hash invariant strictly verified.
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5005;
const CDP_PORT = 9245;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const BASELINE_DB_HASH = "C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7";

const TEST_DIR = path.join(os.tmpdir(), "PrepMate-Interview-UI-01");
const SCREENSHOT_DIR = path.join(TEST_DIR, "screenshots");
const TEST_DB_PATH = path.join(TEST_DIR, "isolated_test_db.json");

if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

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

function requestJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
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
          if (msg.id && this.pending.has(msg.id)) {
            const { res, rej } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
            else res(msg.result);
          }
        } catch (e) {}
      });
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, { res, rej });
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
    return res.result ? res.result.value : undefined;
  }

  async captureScreenshot(filename) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    const fullPath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(res.data, "base64"));
    console.log(`    [SCREENSHOT SAVED] ${filename}`);
    return fullPath;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
  }
}

async function runTest() {
  console.log("=== WI-INTERVIEW-UI-01: REAL BROWSER JOURNEY E2E TEST ===\n");

  const initialDbHash = computeHash(PROD_DB_PATH);
  console.log(`[PRE-FLIGHT] Production DB SHA-256: ${initialDbHash}`);
  assert.strictEqual(initialDbHash, BASELINE_DB_HASH, "Production database must not be modified before test!");

  // Copy DB to isolated test location
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);
  console.log(`[ISOLATION] Created isolated database at: ${TEST_DB_PATH}`);

  // 1. Launch Backend
  console.log(`[BACKEND] Starting backend on port ${BACKEND_PORT} with isolated database...`);
  const beDir = path.join(WORKSPACE_ROOT, "BE");
  const dllPath = path.join(beDir, "bin", "Debug", "net10.0", "backend.dll");

  const backendProc = spawn(
    "dotnet",
    [dllPath, "--urls", BASE_URL],
    {
      cwd: beDir,
      env: {
        ...process.env,
        DATABASE_FILE_PATH: TEST_DB_PATH,
        PREPMATE_DATABASE_PATH: TEST_DB_PATH,
        ASPNETCORE_URLS: BASE_URL,
        DOTNET_URLS: BASE_URL,
        ASPNETCORE_ENVIRONMENT: "Development",
      },
      stdio: "pipe",
    }
  );

  let backendReady = false;
  backendProc.stdout.on("data", (d) => {
    if (d.toString().includes("Now listening on") || d.toString().includes("Application started")) {
      backendReady = true;
    }
  });

  for (let i = 0; i < 40; i++) {
    try {
      const ping = await new Promise((resolve, reject) => {
        http.get(`${BASE_URL}/features/interview/interview-info.html`, (r) => resolve(r.statusCode)).on("error", reject);
      });
      if (ping === 200) {
        backendReady = true;
        break;
      }
    } catch (e) {}
    await sleep(400);
  }

  if (!backendReady) {
    console.log("Backend did not respond within 16s. Waiting another 5s...");
    await sleep(5000);
  }
  console.log("  ✓ Backend is up and serving static features.");

  // 2. Launch Browser
  const browserBin = findBrowserExecutable();
  assert.ok(browserBin, "A valid Edge or Chrome executable must be present on the system");
  console.log(`[BROWSER] Launching browser: ${browserBin} (CDP port ${CDP_PORT})`);

  const browserUserDataDir = path.join(TEST_DIR, "browser_profile");
  if (!fs.existsSync(browserUserDataDir)) fs.mkdirSync(browserUserDataDir, { recursive: true });

  const browserProc = spawn(browserBin, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${browserUserDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--headless=new",
    "--window-size=1280,900",
    "about:blank",
  ]);

  await sleep(2000);

  // 3. Connect CDP
  console.log("[CDP] Connecting to DevTools protocol...");
  const versionInfo = await requestJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
  const targets = await requestJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const pageTarget = targets.find((t) => t.type === "page") || targets[0];
  assert.ok(pageTarget && pageTarget.webSocketDebuggerUrl, "Must obtain webSocketDebuggerUrl from browser");

  const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  console.log("  ✓ CDP connected.");

  try {
    // ── STAGE 1: INTERVIEW SETUP WIZARD (interview-info.html) ─────────────
    console.log("\n[STAGE 1] Navigating to Setup Wizard: interview-info.html...");
    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/interview/interview-info.html` });
    for (let i = 0; i < 20; i++) {
      try {
        const ready = await cdp.eval(`Boolean(document.getElementById('job-title'))`);
        if (ready) break;
      } catch (e) {}
      await sleep(300);
    }

    // Fill Step 1
    console.log("  Filling Step 1 inputs...");
    await cdp.eval(`
      document.getElementById('job-title').value = 'Senior Backend Engineer';
      document.getElementById('company-name').value = 'Tech Global Corp';
      const leadRadio = document.querySelector('input[name="seniority"][value="Senior"]');
      if (leadRadio) leadRadio.checked = true;
      if (typeof onSeniorityChange === 'function') onSeniorityChange(true);
    `);

    // Navigate to Step 2 then Step 3
    console.log("  Advancing Step 1 -> Step 2 -> Step 3...");
    await cdp.eval(`goToStep(2);`);
    await sleep(400);
    await cdp.eval(`goToStep(3);`);
    await sleep(600);

    // Verify 3 Persona Cards visible
    const personaCardsCount = await cdp.eval(`document.querySelectorAll('.interviewer-persona-grid .persona-card').length`);
    assert.strictEqual(personaCardsCount, 3, "Step 3 must render exactly 3 persona cards");
    console.log("  ✓ Step 3 contains 3 persona cards.");

    // Verify manual voice dropdown is hidden
    const isManualVoiceHidden = await cdp.eval(`
      (() => {
        const el = document.getElementById('chamber-voice-settings-group');
        if (!el) return true;
        const style = window.getComputedStyle(el);
        return style.display === 'none';
      })()
    `);
    assert.ok(isManualVoiceHidden, "Manual voice dropdown container must be hidden from user view");
    console.log("  ✓ Manual voice settings dropdown is strictly hidden.");

    // Test greeting preview button on Professional card
    console.log("  Testing 'Nghe lời chào' preview button...");
    await cdp.eval(`togglePersonaGreeting('professional');`);
    await sleep(400);

    const proQuoteShown = await cdp.eval(`
      (() => {
        const q = document.getElementById('greeting-quote-professional');
        return Boolean(q && q.style.display !== 'none' && q.textContent.includes('Bản ghi âm lời chào đang cập nhật'));
      })()
    `);
    assert.ok(proQuoteShown, "Greeting quote with truthful asset notice must be shown when preview clicked");
    console.log("  ✓ Greeting quote displayed with truthful asset status notice.");

    // Select Friendly Persona (Lê Lan Anh)
    console.log("  Selecting Persona: Friendly (Lê Lan Anh)...");
    await cdp.eval(`selectPersonaCard('friendly');`);
    await sleep(400);

    const isFriendlyActive = await cdp.eval(`
      document.getElementById('persona-card-friendly').classList.contains('active') &&
      document.getElementById('interviewer-persona').value === 'friendly'
    `);
    assert.ok(isFriendlyActive, "Friendly persona card must be active and select element synchronized");
    console.log("  ✓ Friendly persona card active and synchronized.");

    // Advance to Step 4 (Readiness Review)
    console.log("  Advancing to Step 4 (Readiness Review)...");
    await cdp.eval(`goToStep(4);`);
    await sleep(600);

    const summaryPersona = await cdp.eval(`document.getElementById('summary-spec-persona')?.textContent.trim()`);
    console.log(`  Step 4 Readiness Persona Summary: "${summaryPersona}"`);
    assert.ok(summaryPersona.includes("Lê Lan Anh"), "Step 4 readiness summary must display Lê Lan Anh");
    console.log("  ✓ Step 4 readiness summary properly reflects selected persona (Lê Lan Anh).");

    await cdp.captureScreenshot("01_interview_setup_step4_readiness_persona.png");

    // ── STAGE 2: LAUNCH & PRACTICE ROOM (interview-practice.html) ───────────
    console.log("\n[STAGE 2] Clicking #btn-start-interview to launch room...");
    await cdp.eval(`document.getElementById('btn-start-interview').click();`);
    await sleep(3000);

    const currentUrl = await cdp.eval(`window.location.href`);
    console.log(`  Current page URL: ${currentUrl}`);
    assert.ok(currentUrl.includes("interview-practice.html"), "Must navigate to interview-practice.html");

    // Verify Room topbar, nameplate, avatar initials
    const interviewerNameplate = await cdp.eval(`document.getElementById('interviewer-name-display')?.textContent.trim()`);
    const interviewerInitials = await cdp.eval(`document.querySelector('#interviewer-avatar-preview span')?.textContent.trim()`);
    const confirmModalInterviewer = await cdp.eval(`document.getElementById('confirm-modal-interviewer')?.textContent.trim()`);

    console.log(`  Room Nameplate: "${interviewerNameplate}"`);
    console.log(`  Avatar Initials: "${interviewerInitials}"`);
    console.log(`  Confirm Modal Interviewer: "${confirmModalInterviewer}"`);

    assert.strictEqual(interviewerNameplate, "Lê Lan Anh", "Room nameplate must be Lê Lan Anh");
    assert.strictEqual(interviewerInitials, "LA", "Room avatar initials must be LA");
    assert.ok(confirmModalInterviewer.includes("Lê Lan Anh"), "Confirmation modal must state Lê Lan Anh");

    // Verify dynamic initial welcome message in Chat
    const chatWelcomeText = await cdp.eval(`document.querySelector('.ai-msg .msg-text')?.textContent.trim() || ''`);
    const chatWelcomeInitials = await cdp.eval(`document.querySelector('.ai-msg .msg-avatar-badge span')?.textContent.trim() || ''`);
    console.log(`  Chat Welcome Initials: "${chatWelcomeInitials}"`);
    console.log(`  Chat Welcome Text preview: "${chatWelcomeText.substring(0, 70)}..."`);

    assert.strictEqual(chatWelcomeInitials, "LA", "Chat message badge must be LA");
    assert.ok(chatWelcomeText.includes("Lê Lan Anh"), "Chat welcome text must introduce Lê Lan Anh");
    console.log("  ✓ Virtual interview room fully synchronized with persona Lê Lan Anh (LA).");

    await cdp.captureScreenshot("02_interview_room_synced_persona.png");

    // ── STAGE 3: REPORT PAGE SYNCHRONIZATION ───────────────────────────────
    console.log("\n[STAGE 3] Injecting evaluated session and navigating to report.html...");
    await cdp.eval(`
      (() => {
        const sampleSession = [{
          id: "sess_persona_e2e_01",
          jobTitle: "Senior Backend Engineer",
          companyName: "Tech Global Corp",
          interviewerPersona: "friendly",
          status: "completed",
          score: 85,
          overallScore: 85,
          duration: 18,
          questionsAnswered: 5,
          level: "Senior",
          createdAt: new Date().toISOString(),
          report: {
            overallEvaluation: { normalizedScore: 85, score: 85, demonstratedLevel: "SENIOR", targetLevel: "SENIOR", readyStatus: "READY", confidence: "CAO" },
            sessionInfo: { targetPosition: "Senior Backend Engineer", targetLevel: "Senior", targetCompany: "Tech Global Corp" },
            performanceDimensions: []
          }
        }];
        localStorage.setItem("interview_sessions", JSON.stringify(sampleSession));
      })()
    `);

    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/report/report.html` });
    await sleep(2500);

    const reportInterviewer = await cdp.eval(`document.getElementById('hero-interviewer-name')?.textContent.trim() || ''`);
    console.log(`  Report Interviewer Badge: "${reportInterviewer}"`);
    assert.ok(reportInterviewer.includes("Lê Lan Anh"), "Report overview badge must display Lê Lan Anh");
    console.log("  ✓ Report hero badge displays synchronized interviewer persona.");

    await cdp.captureScreenshot("03_report_hero_interviewer_badge.png");

    // ── STAGE 4: HISTORY PAGE SYNCHRONIZATION ──────────────────────────────
    console.log("\n[STAGE 4] Navigating to history.html...");
    // Inject auth user and completed test session in localStorage to verify card rendering
    await cdp.eval(`
      (() => {
        localStorage.setItem("prepmate_current_user", JSON.stringify({
          id: "test_candidate_01",
          token: "dummy_valid_jwt_token",
          email: "candidate@prepmate.vn",
          fullname: "Nguyễn Văn Test"
        }));
        const sampleSession = [{
          id: "sess_persona_e2e_01",
          jobTitle: "Senior Backend Engineer",
          companyName: "Tech Global Corp",
          interviewerPersona: "friendly",
          status: "completed",
          score: 85,
          duration: 18,
          questionsAnswered: 5,
          level: "Senior",
          createdAt: new Date().toISOString()
        }];
        localStorage.setItem("interview_sessions", JSON.stringify(sampleSession));
        localStorage.setItem("prepmate_test_candidate_01_interview_sessions", JSON.stringify(sampleSession));
      })()
    `);

    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/interview/history.html` });
    for (let i = 0; i < 20; i++) {
      try {
        const cnt = await cdp.eval(`document.querySelectorAll('.history-item').length`);
        if (cnt > 0) break;
      } catch (e) {}
      await sleep(300);
    }

    const histLocation = await cdp.eval(`window.location.href`);
    console.log(`  History Page Location: ${histLocation}`);
    const itemsCount = await cdp.eval(`document.querySelectorAll('.history-item').length`);
    console.log(`  History Items Rendered Count: ${itemsCount}`);

    const historyBadgeText = await cdp.eval(`document.querySelector('.pm-interviewer-badge')?.textContent.trim() || ''`);
    console.log(`  History Card Interviewer Badge: "${historyBadgeText}"`);
    assert.ok(historyBadgeText.includes("Lê Lan Anh"), "History card must display Lê Lan Anh badge");
    console.log("  ✓ History session cards display synchronized interviewer persona badge.");

    await cdp.captureScreenshot("04_history_session_interviewer_badge.png");

  } finally {
    cdp.close();
    try { browserProc.kill(); } catch (e) {}
    try { backendProc.kill(); } catch (e) {}
  }

  // ── FINAL INTEGRITY CHECK ────────────────────────────────────────────────
  console.log("\n[FINAL CHECK] Validating production database invariant...");
  const finalDbHash = computeHash(PROD_DB_PATH);
  console.log(`  Production DB Hash: ${finalDbHash}`);
  assert.strictEqual(
    finalDbHash,
    BASELINE_DB_HASH,
    `Production DB was modified during test! Expected ${BASELINE_DB_HASH}, got ${finalDbHash}`
  );
  console.log("  ✓ Production DB SHA-256 invariant strictly preserved (Zero Mutations).");

  console.log("\n===============================================================");
  console.log("   ALL REAL BROWSER E2E TESTS PASSED SUCCESSFULLY!             ");
  console.log("===============================================================\n");
}

runTest().catch((err) => {
  console.error("\n[TEST FAILED]:", err);
  process.exit(1);
});
