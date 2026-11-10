/**
 * PREPMATE — REAL EDGE/CDP E2E VERIFICATION SUITE: WI-INTERVIEW-ROOM-UX-02
 * Verifies:
 *   1. Step 4 Summary vs AI Direction (Non-redundant, clean hierarchy)
 *   2. Microphone Semantic Normalization (No green-on-red, proper Zoom/Meet color mapping)
 *   3. Real Audio Speaking Indicator Animation (RMS threshold, 120ms/350ms hysteresis)
 *   4. Notification Spam Prevention (No routine toggle toasts, keyed deduplication)
 *   5. Whitespace Elimination Below Answer Area (Spacious console flex expansion)
 *   6. Video Overlays & Nameplate Contrast (Dark translucent badges, crisp text)
 *   7. Screenshot Audit Artifacts
 *   8. Production DB Invariant
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5094;
const CDP_PORT = 9294;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const TEST_DIR = path.join(os.tmpdir(), `prepmate_room_ux02_e2e_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, "isolated_test_db.json");
const TEST_KEYRING_PATH = path.join(TEST_DIR, "test_keys");
const SCREENSHOT_DIR = path.join(WORKSPACE_ROOT, "tests", "audit-artifacts", "screenshots");

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
            const { resolve, reject } = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else resolve(msg.result);
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

  async setViewport(width, height, isMobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile,
    });
  }

  async captureScreenshot(filepath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    if (res && res.data) {
      fs.writeFileSync(filepath, Buffer.from(res.data, "base64"));
    }
  }

  async close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }
  }
}

async function main() {
  console.log("======================================================================");
  console.log("  PREPMATE — REAL EDGE/CDP E2E: WI-INTERVIEW-ROOM-UX-02              ");
  console.log("  Setup Summary, Live Audio States, Toast System & Console Layout     ");
  console.log("======================================================================\n");

  const baselineHash = computeHash(PROD_DB_PATH);
  console.log(`[1] Baseline Production DB Hash: ${baselineHash}`);

  const browserExe = findBrowserExecutable();
  assert.ok(browserExe, "Compatible Edge or Chrome browser executable required");
  console.log(`[2] Browser: ${browserExe}`);

  let backendProc = null;
  let browserProc = null;
  let cdp = null;

  try {
    if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
    if (!fs.existsSync(TEST_KEYRING_PATH)) fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

    const beDir = path.join(WORKSPACE_ROOT, "BE");
    const dllPath = path.join(beDir, "bin", "Debug", "net10.0", "backend.dll");

    console.log(`[3] Launching isolated backend on port ${BACKEND_PORT}...`);
    backendProc = spawn("dotnet", [dllPath, "--urls", BASE_URL], {
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
    console.log(`[4] Isolated Backend online at ${BASE_URL}`);

    // Launch Edge with remote debugging
    const userDataDir = path.join(TEST_DIR, "browser_profile");
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
    console.log(`[5] Launching Edge with CDP on port ${CDP_PORT}...`);
    browserProc = spawn(browserExe, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-gpu",
      "--headless=new",
      "about:blank",
    ]);

    let targetPageWs = null;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        const list = await requestJsonOnce(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (Array.isArray(list.body) && list.body.length > 0) {
          const pageTarget = list.body.find((t) => t.type === "page") || list.body[0];
          if (pageTarget.webSocketDebuggerUrl) {
            targetPageWs = pageTarget.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (e) {}
    }
    assert.ok(targetPageWs, "Failed to connect to browser CDP target");
    console.log(`[6] CDP connected: ${targetPageWs}`);

    cdp = new SimpleCDP(targetPageWs);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("DOM.enable");

    // Pre-inject BASE_URL
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.PREPMATE_API_BASE_URL = "${BASE_URL}";
        try { localStorage.setItem("prepmate_api_base_url", "${BASE_URL}"); } catch(e){}
      `,
    });

    // -------------------------------------------------------------------------
    // TEST 1: Step 4 Confirmation & AI Direction
    // -------------------------------------------------------------------------
    console.log("\n[TEST 1] Step 4 Confirmation & Non-Redundant AI Direction...");
    await cdp.setViewport(1440, 900);
    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/interview/interview-info.html` });
    await sleep(1500);

    // Seed mock config and activate Step 4
    await cdp.eval(`
      sessionStorage.setItem("interview_init_data", JSON.stringify({
        jobTitle: "Senior Frontend Engineer",
        companyName: "TechCorp Global",
        interviewRound: "round2",
        industryId: "software-tech",
        experienceLevel: "Senior",
        targetLevel: "Senior",
        cvText: "React, TypeScript, CSS Architecture, Performance Optimization, Web Audio API, Micro-frontends",
        jdText: "Seeking a Senior Frontend Engineer proficient in modern JS/TS, state management, and real-time audio/video streaming."
      }));
      const jobInput = document.getElementById("job-title");
      if (jobInput) {
        jobInput.value = "Senior Frontend Engineer";
        jobInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (typeof goToStep === "function") {
        goToStep(4, true);
      }
      if (typeof updateReadinessSummary === "function") {
        updateReadinessSummary();
      }
    `);
    await sleep(600);

    const step4Check = await cdp.eval(`(() => {
      const summaryCard = document.querySelector(".readiness-summary-card");
      const jobEl = document.getElementById("summary-spec-role");
      const compEl = document.getElementById("summary-spec-company");
      const roundEl = document.getElementById("summary-spec-round");
      const modeEl = document.getElementById("summary-spec-mode");
      const aiBody = document.getElementById("ai-preview-body");

      // Verify AI Direction sections
      const sections = aiBody ? Array.from(aiBody.querySelectorAll(".ai-preview-section-title")).map(el => el.textContent.trim()) : [];
      const hasStrategy = sections.some(s => s.includes("Chiến Lược"));
      const hasFocus = sections.some(s => s.includes("Trọng Tâm Năng Lực"));
      const hasRoadmap = sections.some(s => s.includes("Tiến Trình"));
      const hasAdapt = sections.some(s => s.includes("Thích Ứng"));

      // Verify no duplicate job title or company raw pill inside ai-preview-body
      const rawDuplicates = aiBody ? aiBody.querySelectorAll(".ai-meta-item") : [];

      return {
        summaryVisible: Boolean(summaryCard && summaryCard.offsetParent !== null),
        jobText: jobEl ? jobEl.textContent.trim() : "",
        compText: compEl ? compEl.textContent.trim() : "",
        roundText: roundEl ? roundEl.textContent.trim() : "",
        modeText: modeEl ? modeEl.textContent.trim() : "",
        sectionCount: sections.length,
        hasStrategy,
        hasFocus,
        hasRoadmap,
        hasAdapt,
        rawDuplicatesCount: rawDuplicates.length
      };
    })()`);

    console.log("  Step 4 Check:", step4Check);
    assert.strictEqual(step4Check.summaryVisible, true, "Summary card must be visible in Step 4");
    assert.ok(step4Check.jobText.includes("Senior Frontend"), "Job spec must display target job");
    assert.ok(step4Check.hasStrategy && step4Check.hasFocus && step4Check.hasRoadmap, "AI Direction must display all structured pillars");
    assert.strictEqual(step4Check.rawDuplicatesCount, 0, "AI preview must not duplicate raw metadata pills");

    const step4Screenshot = path.join(SCREENSHOT_DIR, "wi-interview-room-ux-02-step4-summary.png");
    await cdp.captureScreenshot(step4Screenshot);
    console.log(`  Saved screenshot: ${path.basename(step4Screenshot)}`);

    // -------------------------------------------------------------------------
    // TEST 2: Live Room Microphone Semantic Normalization (No Green-on-Red)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Microphone Semantic Normalization in Live Room...");
    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/interview/interview-practice.html` });
    await sleep(1500);

    const micNormCheck = await cdp.eval(`(() => {
      const micBtn = document.getElementById("btn-mic");
      if (!micBtn) return { error: "btn-mic not found" };

      // In initial not_started state:
      const initialHasRecording = micBtn.classList.contains("recording");
      const initialComputedBg = window.getComputedStyle(micBtn).backgroundColor;

      // Start preflight preview
      if (typeof startMicPreflightTest === "function") {
        startMicPreflightTest();
      }

      const preflightHasRecording = micBtn.classList.contains("recording");
      const preflightComputedBg = window.getComputedStyle(micBtn).backgroundColor;
      const svgEl = micBtn.querySelector("svg");
      const svgStroke = svgEl ? (svgEl.getAttribute("stroke") || "") : "";

      // Check if there's any hardcoded green stroke inside svg when button is active
      const hasHardcodedGreenStroke = svgStroke === "#22c55e";

      // Test Mute toggle
      if (typeof toggleMicPreflight === "function") {
        toggleMicPreflight();
      }
      const mutedHasOff = micBtn.classList.contains("off");
      const mutedBg = window.getComputedStyle(micBtn).backgroundColor;

      return {
        initialHasRecording,
        preflightHasRecording,
        preflightComputedBg,
        hasHardcodedGreenStroke,
        svgStroke,
        mutedHasOff,
        mutedBg
      };
    })()`);

    console.log("  Mic Semantic Check:", micNormCheck);
    assert.strictEqual(micNormCheck.preflightHasRecording, false, "Preflight unmuted mic MUST NOT contain class 'recording'");
    assert.ok(!micNormCheck.preflightComputedBg.includes("239, 68, 68"), "Unmuted mic MUST NOT have red background");
    assert.strictEqual(micNormCheck.hasHardcodedGreenStroke, false, "Unmuted mic MUST NOT have hardcoded green stroke (no green-on-red)");
    assert.strictEqual(micNormCheck.mutedHasOff, true, "Muting mic must add class 'off'");

    const micUnmutedScreenshot = path.join(SCREENSHOT_DIR, "wi-interview-room-ux-02-mic-unmuted.png");
    await cdp.captureScreenshot(micUnmutedScreenshot);
    console.log(`  Saved screenshot: ${path.basename(micUnmutedScreenshot)}`);

    // -------------------------------------------------------------------------
    // TEST 3: Real Audio Speaking Indicator Animation with Hysteresis
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] Real Audio Voice Activity Detection & Speaking Feedback...");
    // Simulate candidate voice activity > 14
    const diag = await cdp.eval(`(() => {
      // Unmute preflight in test so voice activity is accepted
      if (typeof window.setPreflightMicMuted === "function") {
        window.setPreflightMicMuted(false);
      } else {
        window._preflightMicMuted = false;
        const micBtn = document.getElementById("btn-mic");
        if (micBtn) micBtn.classList.remove("off");
      }
      const micBtn = document.getElementById("btn-mic");
      const beforeState = {
        hasSetFn: typeof window.setPreflightMicMuted,
        winMuted: window._preflightMicMuted,
        micBtnClasses: micBtn ? micBtn.className : "null",
        currentMicState: typeof currentMicState !== "undefined" ? currentMicState : "undef"
      };
      // Send speech signal
      window.handleCandidateVoiceActivity(25);
      const levelBar = document.getElementById("candidate-mic-level-bar");
      return {
        beforeState,
        levelBarImmediateWidth: levelBar ? levelBar.style.width : "null"
      };
    })()`);
    console.log("  Voice Activity Diagnostic:", diag);

    // Wait 160ms for turn-on hysteresis (threshold >= 120ms)
    await sleep(180);

    const speakingOnCheck = await cdp.eval(`(() => {
      const tile = document.getElementById("candidate-tile");
      const micBtn = document.getElementById("btn-mic");
      const levelBar = document.getElementById("candidate-mic-level-bar");
      return {
        tileHasSpeaking: tile ? tile.classList.contains("speaking") : false,
        micHasSpeaking: micBtn ? micBtn.classList.contains("candidate-speaking") : false,
        levelBarWidth: levelBar ? levelBar.style.width : "0%",
        levelBarActive: levelBar ? levelBar.classList.contains("active") : false
      };
    })()`);

    console.log("  Speaking ON Check (post 180ms):", speakingOnCheck);
    assert.strictEqual(speakingOnCheck.tileHasSpeaking, true, "Candidate tile must have 'speaking' class when speaking");
    assert.strictEqual(speakingOnCheck.micHasSpeaking, true, "Mic button must have 'candidate-speaking' class when speaking");
    assert.ok(parseInt(speakingOnCheck.levelBarWidth) > 20, "Level bar must reflect audio level");
    assert.strictEqual(speakingOnCheck.levelBarActive, true, "Level bar must have 'active' class");

    const speakingScreenshot = path.join(SCREENSHOT_DIR, "wi-interview-room-ux-02-speaking-feedback.png");
    await cdp.captureScreenshot(speakingScreenshot);
    console.log(`  Saved screenshot: ${path.basename(speakingScreenshot)}`);

    // Now simulate silence
    await cdp.eval(`window.handleCandidateVoiceActivity(0);`);

    // Wait 420ms for turn-off hysteresis (threshold >= 350ms)
    await sleep(440);

    const speakingOffCheck = await cdp.eval(`(() => {
      const tile = document.getElementById("candidate-tile");
      const micBtn = document.getElementById("btn-mic");
      const levelBar = document.getElementById("candidate-mic-level-bar");
      return {
        tileHasSpeaking: tile ? tile.classList.contains("speaking") : false,
        micHasSpeaking: micBtn ? micBtn.classList.contains("candidate-speaking") : false,
        levelBarWidth: levelBar ? levelBar.style.width : "0%"
      };
    })()`);

    console.log("  Speaking OFF Check (post 440ms):", speakingOffCheck);
    assert.strictEqual(speakingOffCheck.tileHasSpeaking, false, "Candidate tile must remove 'speaking' when silent");
    assert.strictEqual(speakingOffCheck.micHasSpeaking, false, "Mic button must remove 'candidate-speaking' when silent");
    assert.strictEqual(speakingOffCheck.levelBarWidth, "0%", "Level bar width must reset to 0%");

    // -------------------------------------------------------------------------
    // TEST 4: Notification Spam Prevention & Deduplication
    // -------------------------------------------------------------------------
    console.log("\n[TEST 4] Notification Spam Prevention & Deduplication...");
    const toastCheck = await cdp.eval(`(() => {
      let toastError = null;
      try {
        // Clear container
        const container = document.getElementById("prepmate-toast-container");
        if (container) container.innerHTML = "";

        // 1. Rapidly toggle camera 6 times (should generate ZERO routine toasts)
        for (let i = 0; i < 6; i++) {
          if (typeof toggleCamera === "function") toggleCamera();
        }

        const routineToastCount = container ? container.querySelectorAll(".prepmate-toast-item").length : 0;

        // 2. Dispatch 3 toasts with the same key
        if (typeof showToast === "function") {
          showToast("Thiết bị âm thanh đã sẵn sàng", "info", "test-key");
          showToast("Thiết bị âm thanh đã sẵn sàng (cập nhật)", "info", "test-key");
          showToast("Thiết bị âm thanh đã sẵn sàng (mới nhất)", "info", "test-key");
        } else {
          toastError = "showToast is not a function: " + typeof showToast;
        }

        const toastContainer = document.getElementById("prepmate-toast-container");
        const keyedToastCount = toastContainer ? toastContainer.querySelectorAll('[data-toast-key="test-key"]').length : 0;
        const latestText = (toastContainer && toastContainer.querySelector('[data-toast-key="test-key"]')) ? toastContainer.querySelector('[data-toast-key="test-key"]').textContent : "";

        // 3. Dispatch different toasts to test 3-toast cap
        if (typeof showToast === "function") {
          showToast("Thông báo 1", "info", "k1");
          showToast("Thông báo 2", "info", "k2");
          showToast("Thông báo 3", "info", "k3");
          showToast("Thông báo 4", "info", "k4");
        }

        const totalToastsAfterCap = toastContainer ? toastContainer.querySelectorAll(".prepmate-toast-item:not(.prepmate-toast-leaving)").length : 0;

        return {
          toastError,
          routineToastCount,
          keyedToastCount,
          latestText,
          totalToastsAfterCap
        };
      } catch (e) {
        return { toastError: e.message + "\\n" + e.stack };
      }
    })()`);

    console.log("  Toast Check:", toastCheck);
    assert.strictEqual(toastCheck.routineToastCount, 0, "Routine camera toggles must not generate toasts");
    assert.strictEqual(toastCheck.keyedToastCount, 1, "Keyed toasts must deduplicate and maintain exactly 1 element");
    assert.ok(toastCheck.latestText.includes("mới nhất"), "Keyed toast must update to latest message");
    assert.ok(toastCheck.totalToastsAfterCap <= 3, "Total active toasts must be capped at 3");

    // -------------------------------------------------------------------------
    // TEST 5: Whitespace Elimination Below Answer Area & Layout Stability
    // -------------------------------------------------------------------------
    console.log("\n[TEST 5] Spacious Response Console & Whitespace Elimination...");
    const layoutCheck = await cdp.eval(`(() => {
      const stageCol = document.querySelector(".ir-video-stage-column");
      const consoleEl = document.querySelector(".ir-response-console");
      const inputEl = document.getElementById("user-input");
      const videoGrid = document.querySelector(".ir-video-grid");

      const stageRect = stageCol.getBoundingClientRect();
      const consoleRect = consoleEl.getBoundingClientRect();
      const inputRect = inputEl.getBoundingClientRect();
      const gridRect = videoGrid.getBoundingClientRect();

      // Whitespace gap between bottom of response console and bottom of stage column
      const bottomWhitespace = Math.max(0, stageRect.bottom - consoleRect.bottom);

      return {
        stageHeight: stageRect.height,
        consoleHeight: consoleRect.height,
        inputHeight: inputRect.height,
        gridHeight: gridRect.height,
        bottomWhitespace: Math.round(bottomWhitespace)
      };
    })()`);

    console.log("  Layout Check:", layoutCheck);
    assert.ok(layoutCheck.consoleHeight >= 160, "Response console must expand to at least 160px");
    assert.ok(layoutCheck.inputHeight >= 80, "Response textarea must be spacious (at least 80px)");
    assert.ok(layoutCheck.bottomWhitespace <= 26, `Bottom whitespace (${layoutCheck.bottomWhitespace}px) must be <= 26px padding`);

    const consoleScreenshot = path.join(SCREENSHOT_DIR, "wi-interview-room-ux-02-spacious-console.png");
    await cdp.captureScreenshot(consoleScreenshot);
    console.log(`  Saved screenshot: ${path.basename(consoleScreenshot)}`);

    // -------------------------------------------------------------------------
    // TEST 6: Video Overlays & Nameplate Contrast
    // -------------------------------------------------------------------------
    console.log("\n[TEST 6] Video Overlays & Nameplate Contrast...");
    const contrastCheck = await cdp.eval(`(() => {
      const nameplate = document.querySelector(".zoom-nameplate");
      const nameText = document.getElementById("interviewer-name-display");
      const candidateTag = document.querySelector(".tile-tag.candidate");
      const liveTag = document.querySelector(".tile-tag.live");

      const npStyle = window.getComputedStyle(nameplate);
      const nameStyle = window.getComputedStyle(nameText);
      const candStyle = window.getComputedStyle(candidateTag);
      const liveStyle = window.getComputedStyle(liveTag);

      return {
        nameplateBg: npStyle.backgroundColor,
        nameplateBorder: npStyle.borderColor,
        nameTextColor: nameStyle.color,
        candidateTagBg: candStyle.backgroundColor,
        candidateTagColor: candStyle.color,
        liveTagColor: liveStyle.color
      };
    })()`);

    console.log("  Contrast Check:", contrastCheck);
    assert.ok(contrastCheck.nameplateBg.includes("15, 23, 42"), "Nameplate must have dark surface");
    assert.ok(contrastCheck.nameTextColor.includes("255, 255, 255"), "User name must be white");
    assert.ok(contrastCheck.candidateTagColor.includes("52, 211, 153") || contrastCheck.candidateTagColor.includes("167, 243, 208"), "Candidate tag must have clear emerald/mint text");

    // -------------------------------------------------------------------------
    // TEST 7: Production Database Invariant
    // -------------------------------------------------------------------------
    console.log("\n[TEST 7] Production DB Integrity Invariant...");
    const finalHash = computeHash(PROD_DB_PATH);
    console.log(`  Baseline Hash: ${baselineHash}`);
    console.log(`  Final Hash:    ${finalHash}`);
    assert.strictEqual(finalHash, baselineHash, "Production database must remain completely unmodified");
    console.log("  Production DB Invariant: PASSED (100% UNTOUCHED)\n");

    console.log("======================================================================");
    console.log("  ALL WI-INTERVIEW-ROOM-UX-02 E2E CHECKS PASSED SUCCESSFULLY!         ");
    console.log("======================================================================");

  } finally {
    if (cdp) await cdp.close();
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

main().catch((err) => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
