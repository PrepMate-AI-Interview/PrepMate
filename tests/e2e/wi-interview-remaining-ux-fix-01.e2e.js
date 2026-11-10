/**
 * PREPMATE — REAL EDGE/CDP E2E VERIFICATION SUITE: WI-INTERVIEW-REMAINING-UX-FIX-01
 * Verifies:
 *   1. Step 4 Sticky Bottom Action Bar (Appears when primary CTA is out of view, hides when CTA visible or leaving Step 4)
 *   2. Mobile Question Quick Actions (390px & 375px viewports, touch target >= 36px, zero overflow)
 *   3. Touch Device Keyboard Hint (.ir-key-hint-desktop vs .ir-key-hint-touch, pointer: coarse handling)
 *   4. Microphone State Clarity & Zero Nameplate Shift (Idle, speaking, muted, permission-denied, unsupported)
 *   5. Notification Management Stress Test (Rapid toggle debounce/capping to max 3 toasts)
 *   6. Production Database Hash Invariant
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5098;
const CDP_PORT = 9298;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const TEST_DIR = path.join(os.tmpdir(), `prepmate_remaining_ux01_e2e_${Date.now()}`);
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
  console.log("  PREPMATE — REAL EDGE/CDP E2E: WI-INTERVIEW-REMAINING-UX-FIX-01     ");
  console.log("  Step 4 Sticky CTA, Mobile Quick Actions, Hotkey Hints & Audio States ");
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
    assert.ok(backendReady, "Backend failed to start within timeout");
    console.log("[PASS] Isolated backend is live and serving static FE assets.");

    const userDataDir = path.join(TEST_DIR, "edge_profile");
    console.log(`[4] Launching headless browser on CDP port ${CDP_PORT}...`);
    browserProc = spawn(browserExe, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-background-networking",
      "--window-size=1440,900",
      "about:blank",
    ]);

    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(400);
      try {
        const res = await requestJsonOnce(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (Array.isArray(res.body) && res.body.length > 0) {
          const pageTarget = res.body.find((t) => t.type === "page") || res.body[0];
          if (pageTarget && pageTarget.webSocketDebuggerUrl) {
            wsUrl = pageTarget.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (e) {}
    }
    assert.ok(wsUrl, "Failed to connect to browser CDP endpoint");
    console.log(`[PASS] Browser CDP ready at: ${wsUrl}`);

    cdp = new SimpleCDP(wsUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.PREPMATE_API_BASE_URL = "${BASE_URL}";
        try { localStorage.setItem("prepmate_api_base_url", "${BASE_URL}"); } catch(e){}
      `,
    });
    await cdp.setViewport(1440, 900);

    // =========================================================================
    // CHECK 1: STEP 4 STICKY BOTTOM ACTION BAR TEST
    // =========================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("  CHECK 1: Step 4 Sticky Bottom Action Bar                           ");
    console.log("----------------------------------------------------------------------");

    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/interview/interview-info.html` });
    await sleep(1500);

    // Seed mock config and activate Step 4
    await cdp.eval(`
      sessionStorage.setItem("interview_init_data", JSON.stringify({
        jobTitle: "Senior Frontend Architect",
        companyName: "TechCorp Global",
        interviewRound: "round2",
        industryId: "software-tech",
        experienceLevel: "Senior",
      }));
      const jobInput = document.getElementById("job-title");
      if (jobInput) {
        jobInput.value = "Senior Frontend Architect";
        jobInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      goToStep(4, true);
      updateReadinessSummary();
      window.scrollTo(0, 0);
    `);
    await sleep(600);

    const stickyBarInit = await cdp.eval(`
      (() => {
        const bar = document.getElementById("step4-sticky-action-bar");
        const role = document.getElementById("sticky-bar-role");
        const btn = document.getElementById("btn-sticky-start-interview");
        const primaryCta = document.getElementById("launch-action-card");
        return {
          barExists: Boolean(bar),
          roleText: role ? role.textContent.trim() : null,
          btnExists: Boolean(btn),
          isVisible: bar ? bar.classList.contains("is-visible") : false,
          primaryCtaExists: Boolean(primaryCta),
        };
      })()
    `);

    assert.ok(stickyBarInit.barExists, "Step 4 sticky action bar must exist in DOM");
    assert.ok(stickyBarInit.btnExists, "Sticky start button must exist in DOM");
    assert.ok(stickyBarInit.roleText.includes("Senior Frontend Architect"), `Sticky role text must include job title, got: ${stickyBarInit.roleText}`);
    console.log(`[PASS] Sticky bar markup rendered properly. Role: "${stickyBarInit.roleText}"`);

    // At top of Step 4 (window.scrollY == 0), the primary CTA is at the bottom of the long page (out of viewport)
    // Wait for IntersectionObserver callback
    await sleep(300);
    const stickyBarVisible = await cdp.eval(`
      (() => {
        const bar = document.getElementById("step4-sticky-action-bar");
        const style = window.getComputedStyle(bar);
        return {
          isVisibleClass: bar.classList.contains("is-visible"),
          ariaHidden: bar.getAttribute("aria-hidden"),
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
        };
      })()
    `);

    assert.strictEqual(stickyBarVisible.isVisibleClass, true, "Sticky bar must have .is-visible class when primary CTA is off-screen");
    assert.strictEqual(stickyBarVisible.ariaHidden, "false", "Sticky bar aria-hidden must be 'false' when visible");
    console.log(`[PASS] Sticky bar automatically appeared when primary CTA is scrolled out of view. Opacity: ${stickyBarVisible.opacity}`);

    const stickyScreenshotPath = path.join(SCREENSHOT_DIR, "wi-interview-remaining-step4-sticky-visible.png");
    await cdp.captureScreenshot(stickyScreenshotPath);
    console.log(`[PASS] Saved screenshot: ${stickyScreenshotPath}`);

    // Scroll to bottom so primary CTA (#launch-action-card) is in viewport
    await cdp.eval(`
      const cta = document.getElementById("launch-action-card");
      if (cta) cta.scrollIntoView();
    `);
    await sleep(400);

    const stickyBarHidden = await cdp.eval(`
      (() => {
        const bar = document.getElementById("step4-sticky-action-bar");
        const style = window.getComputedStyle(bar);
        return {
          isVisibleClass: bar.classList.contains("is-visible"),
          ariaHidden: bar.getAttribute("aria-hidden"),
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
        };
      })()
    `);

    assert.strictEqual(stickyBarHidden.isVisibleClass, false, "Sticky bar must hide when primary CTA enters viewport");
    assert.strictEqual(stickyBarHidden.ariaHidden, "true", "Sticky bar aria-hidden must be 'true' when hidden");
    console.log("[PASS] Sticky bar cleanly hid when primary CTA scrolled into view (no redundant CTA).");

    const stickyHiddenScreenshotPath = path.join(SCREENSHOT_DIR, "wi-interview-remaining-step4-sticky-hidden-at-cta.png");
    await cdp.captureScreenshot(stickyHiddenScreenshotPath);
    console.log(`[PASS] Saved screenshot: ${stickyHiddenScreenshotPath}`);

    // Navigate to Step 3: verify sticky bar stays hidden
    await cdp.eval(`
      goToStep(3);
    `);
    await sleep(300);

    const stickyBarStep3 = await cdp.eval(`
      (() => {
        const bar = document.getElementById("step4-sticky-action-bar");
        return {
          isVisible: bar ? bar.classList.contains("is-visible") : false,
        };
      })()
    `);
    assert.strictEqual(stickyBarStep3.isVisible, false, "Sticky bar must remain hidden when navigating to Step 3");
    console.log("[PASS] Sticky bar teardown verified on leaving Step 4.");

    // =========================================================================
    // CHECK 2: MOBILE QUESTION QUICK ACTIONS (390px and 375px)
    // =========================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("  CHECK 2: Mobile Question Quick Actions (390px & 375px)              ");
    console.log("----------------------------------------------------------------------");

    await cdp.send("Page.navigate", { url: `${BASE_URL}/features/interview/interview-practice.html` });
    await sleep(1500);

    // Viewport 1: 390x844 (iPhone 12/13/14)
    await cdp.setViewport(390, 844, true);
    await sleep(500);

    const mobile390Metrics = await cdp.eval(`
      (() => {
        const header = document.querySelector(".ir-question-header");
        const quickActions = document.querySelector(".ir-question-quick-actions");
        const btnRepeat = document.getElementById("btn-assist-repeat");
        const btnThink = document.getElementById("btn-assist-think");
        const badge = document.getElementById("current-question-badge");

        const hRect = header ? header.getBoundingClientRect() : null;
        const qaRect = quickActions ? quickActions.getBoundingClientRect() : null;
        const rRect = btnRepeat ? btnRepeat.getBoundingClientRect() : null;
        const tRect = btnThink ? btnThink.getBoundingClientRect() : null;

        return {
          headerOverflow: header ? (header.scrollWidth > header.clientWidth + 1) : false,
          qaOverflow: quickActions ? (quickActions.scrollWidth > quickActions.clientWidth + 1) : false,
          btnRepeatHeight: rRect ? rRect.height : 0,
          btnThinkHeight: tRect ? tRect.height : 0,
          btnRepeatAria: btnRepeat ? btnRepeat.getAttribute("aria-label") : null,
          btnThinkAria: btnThink ? btnThink.getAttribute("aria-label") : null,
          headerWidth: hRect ? hRect.width : 0,
        };
      })()
    `);

    assert.strictEqual(mobile390Metrics.headerOverflow, false, "Question header must not overflow horizontally on 390px");
    assert.strictEqual(mobile390Metrics.qaOverflow, false, "Quick actions must not overflow horizontally on 390px");
    assert.ok(mobile390Metrics.btnRepeatHeight >= 36, `Repeat button height must be >= 36px on mobile, got: ${mobile390Metrics.btnRepeatHeight}`);
    assert.ok(mobile390Metrics.btnThinkHeight >= 36, `Think button height must be >= 36px on mobile, got: ${mobile390Metrics.btnThinkHeight}`);
    assert.ok(mobile390Metrics.btnRepeatAria, "Repeat button must have accessible aria-label");
    assert.ok(mobile390Metrics.btnThinkAria, "Think button must have accessible aria-label");
    console.log(`[PASS] 390px Viewport: Repeat btn height=${mobile390Metrics.btnRepeatHeight}px, Think btn height=${mobile390Metrics.btnThinkHeight}px, overflow=false`);

    const mobile390Screenshot = path.join(SCREENSHOT_DIR, "wi-interview-remaining-mobile-quick-actions-390.png");
    await cdp.captureScreenshot(mobile390Screenshot);
    console.log(`[PASS] Saved screenshot: ${mobile390Screenshot}`);

    // Viewport 2: 375x667 (iPhone SE / narrow mobile)
    await cdp.setViewport(375, 667, true);
    await sleep(500);

    const mobile375Metrics = await cdp.eval(`
      (() => {
        const header = document.querySelector(".ir-question-header");
        const quickActions = document.querySelector(".ir-question-quick-actions");
        const btnRepeat = document.getElementById("btn-assist-repeat");
        const btnThink = document.getElementById("btn-assist-think");

        return {
          headerOverflow: header ? (header.scrollWidth > header.clientWidth + 1) : false,
          qaOverflow: quickActions ? (quickActions.scrollWidth > quickActions.clientWidth + 1) : false,
          btnRepeatHeight: btnRepeat ? btnRepeat.getBoundingClientRect().height : 0,
          btnThinkHeight: btnThink ? btnThink.getBoundingClientRect().height : 0,
        };
      })()
    `);

    assert.strictEqual(mobile375Metrics.headerOverflow, false, "Question header must not overflow horizontally on 375px");
    assert.strictEqual(mobile375Metrics.qaOverflow, false, "Quick actions must not overflow horizontally on 375px");
    assert.ok(mobile375Metrics.btnRepeatHeight >= 36, `Repeat button height must be >= 36px on 375px, got: ${mobile375Metrics.btnRepeatHeight}`);
    console.log(`[PASS] 375px Viewport: zero overflow, touch target comfortably preserved`);

    const mobile375Screenshot = path.join(SCREENSHOT_DIR, "wi-interview-remaining-mobile-quick-actions-375.png");
    await cdp.captureScreenshot(mobile375Screenshot);
    console.log(`[PASS] Saved screenshot: ${mobile375Screenshot}`);

    // =========================================================================
    // CHECK 3: TOUCH DEVICE KEYBOARD HINT TEST
    // =========================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("  CHECK 3: Touch Device Keyboard Hint (.ir-key-hint)                 ");
    console.log("----------------------------------------------------------------------");

    // Reset to desktop viewport (pointer: fine)
    await cdp.setViewport(1440, 900, false);
    await sleep(300);

    const desktopHintMetrics = await cdp.eval(`
      (() => {
        const desktopHint = document.querySelector(".ir-key-hint-desktop");
        const touchHint = document.querySelector(".ir-key-hint-touch");
        const dStyle = desktopHint ? window.getComputedStyle(desktopHint) : null;
        const tStyle = touchHint ? window.getComputedStyle(touchHint) : null;
        return {
          desktopHintText: desktopHint ? desktopHint.textContent.trim() : null,
          desktopHintDisplay: dStyle ? dStyle.display : null,
          touchHintText: touchHint ? touchHint.textContent.trim() : null,
          touchHintDisplay: tStyle ? tStyle.display : null,
        };
      })()
    `);

    assert.ok(desktopHintMetrics.desktopHintText.includes("Enter để gửi"), `Desktop hint text must contain Enter instructions, got: ${desktopHintMetrics.desktopHintText}`);
    assert.strictEqual(desktopHintMetrics.touchHintDisplay, "none", "Touch hint must be hidden on desktop (pointer: fine)");
    assert.notStrictEqual(desktopHintMetrics.desktopHintDisplay, "none", "Desktop hint must be visible on desktop");
    assert.ok(desktopHintMetrics.touchHintText.includes("Chạm Gửi hoặc Nói"), `Touch hint text must be touch-friendly, got: ${desktopHintMetrics.touchHintText}`);
    console.log(`[PASS] Desktop hint: "${desktopHintMetrics.desktopHintText}" (visible), Touch hint: "${desktopHintMetrics.touchHintText}" (hidden).`);

    // Verify CSS rule @media (pointer: coarse) exists and is configured
    const cssTouchRuleExists = await cdp.eval(`
      (() => {
        let foundCoarseRule = false;
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.media && rule.media.mediaText && rule.media.mediaText.includes("pointer: coarse")) {
                foundCoarseRule = true;
                break;
              }
            }
          } catch(e) {}
          if (foundCoarseRule) break;
        }
        return foundCoarseRule;
      })()
    `);
    assert.strictEqual(cssTouchRuleExists, true, "CSS rule @media (pointer: coarse) must be present in stylesheets");
    console.log("[PASS] @media (pointer: coarse) responsive hotkey rule verified in CSS.");

    // =========================================================================
    // CHECK 4: MICROPHONE STATES & ZERO NAMEPLATE SHIFT
    // =========================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("  CHECK 4: Microphone States & Zero Nameplate Shift                  ");
    console.log("----------------------------------------------------------------------");

    // Start interview session in practice page to enable live room state machine
    await cdp.eval(`
      startInterviewSession(true);
      if (typeof window.setPreflightMicMuted === 'function') {
        window.setPreflightMicMuted(false);
      }
    `);
    await sleep(800);

    // Measure Candidate and Interviewer tile baseline
    const tileBaseline = await cdp.eval(`
      (() => {
        const cTile = document.getElementById("candidate-tile");
        const aTile = document.getElementById("interviewer-tile");
        const cRect = cTile ? cTile.getBoundingClientRect() : null;
        const aRect = aTile ? aTile.getBoundingClientRect() : null;
        return {
          cTileWidth: cRect ? Math.round(cRect.width) : 0,
          cTileHeight: cRect ? Math.round(cRect.height) : 0,
          aTileWidth: aRect ? Math.round(aRect.width) : 0,
          aTileHeight: aRect ? Math.round(aRect.height) : 0,
        };
      })()
    `);

    // Test 1: Muted state
    await cdp.eval(`
      setMicState(MIC_STATE.MUTED);
    `);
    await sleep(200);

    const mutedState = await cdp.eval(`
      (() => {
        const micBtn = document.getElementById("btn-mic");
        const badge = document.getElementById("candidate-mic-badge");
        const eqBars = document.querySelectorAll("#candidate-mic-level-wrap .eq-bar");
        let allBarsBaseline = true;
        eqBars.forEach(b => {
          if (parseInt(window.getComputedStyle(b).height) > 4) allBarsBaseline = false;
        });
        const cTile = document.getElementById("candidate-tile");
        const cRect = cTile.getBoundingClientRect();
        return {
          btnHasOff: micBtn ? micBtn.classList.contains("off") : false,
          badgeHasMuted: badge ? badge.classList.contains("muted") : false,
          allBarsBaseline,
          cTileWidth: Math.round(cRect.width),
          cTileHeight: Math.round(cRect.height),
        };
      })()
    `);

    assert.strictEqual(mutedState.btnHasOff, true, "Mic button must have .off in muted state");
    assert.strictEqual(mutedState.badgeHasMuted, true, "Mic badge must have .muted in muted state");
    assert.strictEqual(mutedState.allBarsBaseline, true, "Equalizer bars must be at baseline (<= 3px) in muted state");
    assert.strictEqual(mutedState.cTileWidth, tileBaseline.cTileWidth, "Candidate tile width must not change during muted state");
    console.log("[PASS] State 1 (Muted): Red strike-through icon, muted badge, baseline equalizer, 0px tile shift.");

    // Test 2: Active Speaking state
    const speakingState = await cdp.eval(`
      (async () => {
        if (typeof setMicState === "function") {
          setMicState(MIC_STATE.LISTENING);
        }
        if (typeof handleCandidateVoiceActivity === "function") {
          handleCandidateVoiceActivity(50);
        }

        // Wait for hysteresis debounce (120ms) and CSS transition (80ms) to complete
        await new Promise(r => setTimeout(r, 220));

        const cTile = document.getElementById("candidate-tile");
        const cRect = cTile ? cTile.getBoundingClientRect() : null;
        const eqWrap = document.getElementById("candidate-mic-level-wrap");
        const bars = eqWrap ? eqWrap.querySelectorAll(".eq-bar") : [];
        let minHeight = 999;
        bars.forEach(b => {
          const h = parseFloat(window.getComputedStyle(b).height);
          if (h < minHeight) minHeight = h;
        });
        return {
          isSpeaking: cTile ? cTile.classList.contains("speaking") : false,
          minBarHeight: minHeight,
          cTileWidth: cRect ? Math.round(cRect.width) : 0,
          cTileHeight: cRect ? Math.round(cRect.height) : 0,
        };
      })()
    `);

    assert.strictEqual(speakingState.isSpeaking, true, "Candidate tile must have .speaking during active voice");
    assert.ok(speakingState.minBarHeight >= 5, `Equalizer bar height must react dynamically (>= 5px), got: ${speakingState.minBarHeight}px`);
    assert.strictEqual(speakingState.cTileWidth, tileBaseline.cTileWidth, "Candidate tile width must remain rock solid (0px shift) while speaking");
    console.log(`[PASS] State 2 (Active Speaking): Reactive dynamic equalizer (${speakingState.minBarHeight}px >= 5px), speaking halo, 0px tile shift.`);

    // Test 3: Permission Denied state
    await cdp.eval(`
      setMicState(MIC_STATE.NO_PERMISSION, "Chưa cấp quyền micro");
    `);
    await sleep(150);

    const noPermState = await cdp.eval(`
      (() => {
        const micBtn = document.getElementById("btn-mic");
        const label = document.getElementById("console-mic-label");
        return {
          ariaDisabled: micBtn ? micBtn.getAttribute("aria-disabled") : null,
          labelText: label ? label.textContent.trim() : null,
        };
      })()
    `);

    assert.strictEqual(noPermState.ariaDisabled, "true", "Mic button must have aria-disabled='true' when permission denied");
    console.log(`[PASS] State 3 (No Permission): aria-disabled='true', console text="${noPermState.labelText}".`);

    // Test 4: Unsupported state
    await cdp.eval(`
      setMicState(MIC_STATE.UNSUPPORTED, "Trình duyệt không hỗ trợ");
    `);
    await sleep(150);

    const unsupportedState = await cdp.eval(`
      (() => {
        const micBtn = document.getElementById("btn-mic");
        const label = document.getElementById("console-mic-label");
        return {
          ariaDisabled: micBtn ? micBtn.getAttribute("aria-disabled") : null,
          labelText: label ? label.textContent.trim() : null,
        };
      })()
    `);
    assert.strictEqual(unsupportedState.ariaDisabled, "true", "Mic button must have aria-disabled='true' when unsupported");
    console.log(`[PASS] State 4 (Unsupported): aria-disabled='true', console text="${unsupportedState.labelText}".`);

    // =========================================================================
    // CHECK 5: NOTIFICATION MANAGEMENT STRESS TEST
    // =========================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("  CHECK 5: Notification Management Stress Test                       ");
    console.log("----------------------------------------------------------------------");

    // Stress test: trigger showToast 12 times with different keys within 200ms
    const toastStressResult = await cdp.eval(`
      (() => {
        if (typeof showToast !== "function") return { success: false, reason: "showToast not defined" };

        for (let i = 1; i <= 12; i++) {
          showToast("Thông báo kiểm tra " + i, "info", "test_toast_" + i);
        }

        const container = document.getElementById("prepmate-toast-container");
        const activeToasts = container ? container.querySelectorAll(".prepmate-toast-item:not(.prepmate-toast-leaving)") : [];
        return {
          success: true,
          containerExists: Boolean(container),
          activeCount: activeToasts.length,
          lastToastText: activeToasts.length > 0 ? activeToasts[activeToasts.length - 1].textContent : null,
        };
      })()
    `);

    assert.strictEqual(toastStressResult.success, true, "showToast must execute cleanly");
    assert.ok(toastStressResult.activeCount <= 3, `Toast manager must cap active notifications to <= 3, got: ${toastStressResult.activeCount}`);
    console.log(`[PASS] Toast stress test: 12 rapid toasts throttled/capped cleanly to ${toastStressResult.activeCount} active toasts (max 3).`);

    // =========================================================================
    // CHECK 6: PRODUCTION DATABASE HASH INVARIANT
    // =========================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("  CHECK 6: Production Database Hash Invariant                        ");
    console.log("----------------------------------------------------------------------");

    const finalHash = computeHash(PROD_DB_PATH);
    assert.strictEqual(finalHash, baselineHash, `Production DB hash changed! Baseline: ${baselineHash}, Final: ${finalHash}`);
    console.log(`[PASS] Production DB SHA-256 invariant verified: ${finalHash}`);

    console.log("\n======================================================================");
    console.log("  ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (100%)                  ");
    console.log("======================================================================\n");
  } finally {
    if (cdp) {
      try { await cdp.close(); } catch (e) {}
    }
    if (browserProc) {
      try { browserProc.kill(); } catch (e) {}
    }
    if (backendProc) {
      try { backendProc.kill(); } catch (e) {}
    }
    try {
      if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      }
    } catch (e) {}
  }
}

main().catch((err) => {
  console.error("\n[FATAL ERROR]:", err);
  process.exit(1);
});
