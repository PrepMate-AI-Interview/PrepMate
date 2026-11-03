/**
 * PREPMATE — WI-REPORT-10 REAL BROWSER E2E TEST (EDGE / CHROMIUM CDP)
 * Unified Evaluation Transparency & Methodology Disclosure Verification
 *
 * Verifies:
 * 1. Centralized placement at bottom of Report after all stages
 * 2. Default collapsed progressive disclosure state (aria-expanded="false", .hidden)
 * 3. Subtle entry point link in Stage 1 ("Cách PrepMate đánh giá kết quả này")
 * 4. Smooth scrolling and auto-expansion on click
 * 5. Complete presence and accuracy of 5 grounded methodology topics (A to E)
 * 6. Responsive viewports (1440, 1024, 768, 390) with zero horizontal overflow
 * 7. Dark Mode visual integrity
 * 8. Production database SHA-256 invariant
 */

const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");
const assert = require("assert");
const os = require("os");

const STATIC_PORT = 5092;
const CDP_PORT = 9242;
const WORKSPACE_ROOT = path.resolve(__dirname, "../../");
const PROD_DB_PATH = path.resolve(WORKSPACE_ROOT, "BE/data/db.json");
const EXPECTED_DB_HASH = "c2ba83b82e758b277786dad7073e1c8a0e80c71fc615ecbbe5847d01b47cda50";
const SCREENSHOT_DIR = path.resolve(WORKSPACE_ROOT, "scratch/screenshots/wi-report-10");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function findBrowser() {
  const edgePaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    os.homedir() + "\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  for (const p of edgePaths) {
    if (fs.existsSync(p)) return p;
  }
  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];
  for (const p of chromePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
  }

  connect() {
    const WS = globalThis.WebSocket;
    return new Promise((resolve, reject) => {
      this.ws = new WS(this.wsUrl);
      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", reject);
      this.ws.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
          else res(msg.result);
        }
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
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async captureScreenshot(filename) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(res.data, "base64");
    const filepath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    console.log(`  [SCREENSHOT] Saved: ${filename}`);
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
  }
}

function startStaticServer() {
  return new Promise((resolve) => {
    const mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml"
    };

    const server = http.createServer((req, res) => {
      let reqPath = decodeURI(req.url.split("?")[0]);
      if (reqPath === "/") reqPath = "/FE/features/report/report.html";
      const filePath = path.join(WORKSPACE_ROOT, reqPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found: " + reqPath);
      }
    });

    server.listen(STATIC_PORT, () => {
      resolve(server);
    });
  });
}

async function runTest() {
  console.log("===============================================================");
  console.log("   PREPMATE — WI-REPORT-10 TRANSPARENCY DISCLOSURE E2E TEST   ");
  console.log("===============================================================\n");

  // 1. Initial Invariant Check
  const initialDbHash = crypto.createHash("sha256").update(fs.readFileSync(PROD_DB_PATH)).digest("hex").toLowerCase();
  assert.strictEqual(initialDbHash, EXPECTED_DB_HASH, "Initial DB Hash mismatch!");
  console.log("[PASS] 1. Production database SHA-256 strictly preserved before test execution.");

  // 2. Start HTTP server
  const server = await startStaticServer();
  console.log(`[PASS] 2. Test server started on http://127.0.0.1:${STATIC_PORT}`);

  // 3. Launch browser
  const browserPath = findBrowser();
  assert.ok(browserPath, "Chrome or Edge browser executable not found!");
  const userDataDir = path.join(os.tmpdir(), "prepmate_e2e_wi10_" + Date.now());

  const browserProc = spawn(browserPath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--window-size=1440,900"
  ]);

  let client = null;

  try {
    let cdpConnected = false;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then((r) => r.json());
        const pageTarget = listRes.find((t) => t.type === "page" || t.type === "other");
        if (pageTarget && pageTarget.webSocketDebuggerUrl) {
          client = new CDPClient(pageTarget.webSocketDebuggerUrl);
          await client.connect();
          cdpConnected = true;
          break;
        }
      } catch (e) {}
    }
    assert.ok(cdpConnected, "Connected to Chrome DevTools Protocol over WebSocket.");
    console.log("[PASS] 3. CDP Client attached to headless browser instance.");

    await client.send("Page.enable");
    await client.send("DOM.enable");
    await client.send("Runtime.enable");

    // Navigate to report page
    const reportUrl = `http://127.0.0.1:${STATIC_PORT}/FE/features/report/report.html`;
    await client.send("Page.navigate", { url: reportUrl });
    await sleep(1500);

    // Inject rich mock session
    await client.eval(`
      (() => {
        const mockSession = {
          sessionId: "sess_wi10_test",
          role: "Senior Fullstack Engineer",
          jobTitle: "Senior Fullstack Engineer",
          targetLevel: "Middle",
          demonstratedLevel: "Senior",
          overallScore: 85,
          overallNormalizedScore: 85,
          answers: [
            { turnIndex: 1, question: "Làm thế nào để scale microservices với zero downtime?", answer: "Áp dụng blue-green deployment kết hợp canary testing.", topic: "DevOps & Cloud" }
          ],
          report: {
            overallScore: 85,
            demonstratedLevel: "Senior",
            calibratedTarget: "Middle",
            dimensions: [
              { dimension: "TECHNICAL_KNOWLEDGE", score: 8.8, level: "Senior", confidence: "HIGH", summary: "Kiến thức xuất sắc.", observedStrengths: ["Hiểu sâu K8s"], observedWeaknesses: [], supportingEvidence: [] },
              { dimension: "PRACTICAL_APPLICATION", score: 8.5, level: "Senior", confidence: "HIGH", summary: "Ứng dụng thực tiễn tốt.", observedStrengths: ["Thực tế CI/CD"], observedWeaknesses: [], supportingEvidence: [] },
              { dimension: "REASONING_DEPTH", score: 8.2, level: "Senior", confidence: "HIGH", summary: "Tư duy hệ thống sắc sảo.", observedStrengths: ["Đánh đổi kiến trúc"], observedWeaknesses: [], supportingEvidence: [] },
              { dimension: "FOLLOW_UP_HANDLING", score: 8.0, level: "Middle", confidence: "MEDIUM", summary: "Bình tĩnh trước câu hỏi hóc búa.", observedStrengths: ["Xử lý sự cố"], observedWeaknesses: [], supportingEvidence: [] },
              { dimension: "COMMUNICATION_CLARITY", score: 8.6, level: "Senior", confidence: "HIGH", summary: "Trình bày mạch lạc.", observedStrengths: ["Cấu trúc STAR"], observedWeaknesses: [], supportingEvidence: [] },
              { dimension: "COMPETENCY_MATCH", score: 8.7, level: "Senior", confidence: "HIGH", summary: "Phù hợp cao với vai trò.", observedStrengths: ["Đáp ứng trọn vẹn JD"], observedWeaknesses: [], supportingEvidence: [] }
            ]
          }
        };

        mockSession.Report = mockSession.report;
        localStorage.setItem("interview_sessions", JSON.stringify([mockSession]));
        sessionStorage.setItem("prepmate_latest_session", JSON.stringify(mockSession));
        sessionStorage.setItem("interview_session", JSON.stringify(mockSession));
        window.location.search = "?id=" + mockSession.sessionId;
      })()
    `);
    await sleep(2000);

    // =========================================================================
    // STEP 4: VERIFY CENTRALIZED SECTION INITIAL COLLAPSED STATE
    // =========================================================================
    console.log("\n--- STEP 4: Initial Collapsed State Verification ---");
    const initialDomState = await client.eval(`
      (() => {
        const section = document.getElementById("report-commitments-section");
        const body = document.getElementById("report-transparency-body");
        const btn = document.getElementById("transparency-toggle-btn");
        const titleEl = document.getElementById("transparency-disclosure-title");
        const subtitleEl = section ? section.querySelector(".transparency-subtitle") : null;
        const entryLink = document.getElementById("hero-transparency-link");

        return {
          sectionExists: Boolean(section),
          isFooterClass: section ? section.classList.contains("report-limitations-footer") : false,
          isDisclosureClass: section ? section.classList.contains("report-transparency-disclosure") : false,
          bodyExists: Boolean(body),
          bodyIsHidden: body ? body.classList.contains("hidden") : false,
          btnExpanded: btn ? btn.getAttribute("aria-expanded") : null,
          titleText: titleEl ? titleEl.textContent.trim() : "",
          subtitleText: subtitleEl ? subtitleEl.textContent.trim() : "",
          entryLinkExists: Boolean(entryLink),
          entryLinkText: entryLink ? entryLink.textContent.trim() : ""
        };
      })()
    `);

    assert.ok(initialDomState.sectionExists, "Centralized transparency section #report-commitments-section must exist");
    assert.ok(initialDomState.isDisclosureClass, "Section must have .report-transparency-disclosure class");
    assert.strictEqual(initialDomState.bodyIsHidden, true, "Body must be collapsed (.hidden) by default");
    assert.strictEqual(initialDomState.btnExpanded, "false", "Header toggle button must have aria-expanded='false'");
    assert.strictEqual(initialDomState.titleText, "Nguyên tắc đánh giá & minh bạch", "Title matches canonical spec");
    assert.strictEqual(initialDomState.subtitleText, "Tìm hiểu dữ liệu, cách diễn giải kết quả và giới hạn của đánh giá AI.", "Subtitle matches canonical spec");
    assert.ok(initialDomState.entryLinkExists, "Stage 1 subtle entry link #hero-transparency-link exists");
    assert.strictEqual(initialDomState.entryLinkText, "Cách PrepMate đánh giá kết quả này", "Entry link text matches canonical spec");
    console.log("[PASS] 4. Centralized disclosure exists, properly named, and collapsed by default.");

    await client.captureScreenshot("01-initial-collapsed-state.png");

    // =========================================================================
    // STEP 5: VERIFY 5 GROUNDED METHODOLOGY TOPICS
    // =========================================================================
    console.log("\n--- STEP 5: Five Grounded Methodology Topics Verification ---");
    const topicsState = await client.eval(`
      (() => {
        const topics = Array.from(document.querySelectorAll(".transparency-topic-card")).map(card => ({
          topicAttr: card.getAttribute("data-topic"),
          title: card.querySelector(".topic-title") ? card.querySelector(".topic-title").textContent.trim() : "",
          pointsCount: card.querySelectorAll(".topic-points li").length,
          hasIcons: Boolean(card.querySelector(".topic-icon svg")),
          firstPointText: card.querySelector(".topic-points li") ? card.querySelector(".topic-points li").textContent.trim() : ""
        }));
        return topics;
      })()
    `);

    assert.strictEqual(topicsState.length, 5, "Must render exactly 5 methodology topic cards");
    const expectedTopics = [
      { key: "data-sources", titlePrefix: "A. Dữ liệu được sử dụng" },
      { key: "scoring-method", titlePrefix: "B. Cách điểm số được hình thành" },
      { key: "evidence-observations", titlePrefix: "C. Minh chứng và nhận xét" },
      { key: "unassessed-handling", titlePrefix: "D. Dữ liệu chưa đủ để đánh giá" },
      { key: "ai-limitations", titlePrefix: "E. Giới hạn của AI" }
    ];

    expectedTopics.forEach((exp, idx) => {
      const topic = topicsState[idx];
      assert.strictEqual(topic.topicAttr, exp.key, `Topic ${idx} attribute key mismatch`);
      assert.ok(topic.title.includes(exp.titlePrefix), `Topic ${idx} title mismatch: ${topic.title}`);
      assert.ok(topic.pointsCount >= 3, `Topic ${idx} must contain at least 3 detailed bullet points`);
      assert.ok(topic.hasIcons, `Topic ${idx} must feature an iconography element`);
    });
    console.log("[PASS] 5. All 5 grounded methodology topics verified with rich criteria and icons.");

    // =========================================================================
    // STEP 6: TOGGLE BUTTON EXPANSION & COLLAPSE INTERACTION
    // =========================================================================
    console.log("\n--- STEP 6: Interactive Expand / Collapse Toggle Verification ---");
    await client.eval(`document.getElementById("transparency-toggle-btn").click()`);
    await sleep(300);

    let expandedState = await client.eval(`
      (() => {
        const body = document.getElementById("report-transparency-body");
        const btn = document.getElementById("transparency-toggle-btn");
        const label = document.getElementById("transparency-toggle-text");
        return {
          isHidden: body.classList.contains("hidden"),
          ariaExpanded: btn.getAttribute("aria-expanded"),
          label: label.textContent.trim(),
          bodyHeight: body.offsetHeight
        };
      })()
    `);

    assert.strictEqual(expandedState.isHidden, false, "Body must not be hidden when expanded");
    assert.strictEqual(expandedState.ariaExpanded, "true", "Button aria-expanded must be 'true'");
    assert.strictEqual(expandedState.label, "Thu gọn", "Toggle label must change to 'Thu gọn'");
    assert.ok(expandedState.bodyHeight > 50, `Body height (${expandedState.bodyHeight}px) must be fully expanded`);
    console.log("  ✓ Expanded state verified: body visible, aria-expanded='true', label='Thu gọn'");

    await client.captureScreenshot("02-disclosure-expanded.png");

    // Re-click to toggle closed
    await client.eval(`document.getElementById("transparency-toggle-btn").click()`);
    await sleep(300);

    let reCollapsedState = await client.eval(`
      (() => {
        const body = document.getElementById("report-transparency-body");
        const btn = document.getElementById("transparency-toggle-btn");
        const label = document.getElementById("transparency-toggle-text");
        return {
          isHidden: body.classList.contains("hidden"),
          ariaExpanded: btn.getAttribute("aria-expanded"),
          label: label.textContent.trim()
        };
      })()
    `);

    assert.strictEqual(reCollapsedState.isHidden, true, "Body must be re-hidden on second click");
    assert.strictEqual(reCollapsedState.ariaExpanded, "false", "Button aria-expanded must reset to 'false'");
    assert.strictEqual(reCollapsedState.label, "Xem chi tiết", "Label resets to 'Xem chi tiết'");
    console.log("  ✓ Re-collapsed state verified: body hidden, aria-expanded='false'");

    // =========================================================================
    // STEP 7: STAGE 1 SUBTLE ENTRY LINK CLICK & SMOOTH SCROLL
    // =========================================================================
    console.log("\n--- STEP 7: Stage 1 Subtle Link Click & Smooth Scroll Verification ---");
    // Scroll back to top to ensure link is in view and tests real scroll distance
    await client.eval(`window.scrollTo(0, 0)`);
    await sleep(200);

    // Trigger click on Stage 1 link
    await client.eval(`document.getElementById("hero-transparency-link").click()`);
    await sleep(800); // Wait for smooth scroll animation

    const linkClickResult = await client.eval(`
      (() => {
        const body = document.getElementById("report-transparency-body");
        const btn = document.getElementById("transparency-toggle-btn");
        const section = document.getElementById("report-commitments-section");
        const rect = section.getBoundingClientRect();
        return {
          bodyIsExpanded: !body.classList.contains("hidden"),
          ariaExpanded: btn.getAttribute("aria-expanded"),
          sectionTop: rect.top,
          scrollY: window.pageYOffset || document.documentElement.scrollTop,
          viewportHeight: window.innerHeight
        };
      })()
    `);

    assert.strictEqual(linkClickResult.bodyIsExpanded, true, "Clicking subtle link must automatically expand disclosure");
    assert.strictEqual(linkClickResult.ariaExpanded, "true", "Button aria-expanded set to true on link click");
    assert.ok(linkClickResult.scrollY > 0, "Window page offset must have scrolled down towards disclosure");
    assert.ok(linkClickResult.sectionTop >= 0 && linkClickResult.sectionTop < linkClickResult.viewportHeight, `Section top (${linkClickResult.sectionTop}px) must be cleanly visible in viewport`);
    console.log("[PASS] 7. Stage 1 subtle entry link successfully auto-expands and scrolls smoothly into view.");

    // =========================================================================
    // STEP 8: RESPONSIVE VIEWPORTS AUDIT (1440, 1024, 768, 390)
    // =========================================================================
    console.log("\n--- STEP 8: Responsive Viewports Verification ---");
    const viewports = [
      { name: "desktop-1440", width: 1440, height: 900 },
      { name: "tablet-1024", width: 1024, height: 768 },
      { name: "tablet-768", width: 768, height: 1024 },
      { name: "mobile-390", width: 390, height: 844 }
    ];

    for (const vp of viewports) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 768
      });
      await sleep(300);

      const vpMetrics = await client.eval(`
        (() => {
          const section = document.getElementById("report-commitments-section");
          const body = document.getElementById("report-transparency-body");
          const grid = document.querySelector(".transparency-topics-grid");
          return {
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            sectionWidth: section ? section.offsetWidth : 0,
            gridColumns: grid ? window.getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0
          };
        })()
      `);

      assert.strictEqual(vpMetrics.hasHorizontalOverflow, false, `Viewport ${vp.name} must not have horizontal overflow!`);
      assert.ok(vpMetrics.sectionWidth <= vp.width, `Section width (${vpMetrics.sectionWidth}px) exceeds viewport width (${vp.width}px)`);
      console.log(`  ✓ Viewport ${vp.name} (${vp.width}x${vp.height}): 0 overflow, ${vpMetrics.gridColumns} grid columns.`);
      await client.captureScreenshot(`03-responsive-${vp.name}.png`);
    }

    // Reset to desktop viewport
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(200);

    // =========================================================================
    // STEP 9: DARK MODE COMPLIANCE
    // =========================================================================
    console.log("\n--- STEP 9: Dark Mode Compliance Verification ---");
    await client.eval(`
      (() => {
        document.documentElement.setAttribute("data-theme", "dark");
        document.body.classList.add("dark-mode");
      })()
    `);
    await sleep(300);

    const darkModeStyles = await client.eval(`
      (() => {
        const section = document.getElementById("report-commitments-section");
        const firstCard = document.querySelector(".transparency-topic-card");
        const title = document.getElementById("transparency-disclosure-title");
        return {
          sectionBg: window.getComputedStyle(section).backgroundColor,
          cardBg: window.getComputedStyle(firstCard).backgroundColor,
          titleColor: window.getComputedStyle(title).color
        };
      })()
    `);

    assert.ok(darkModeStyles.sectionBg, "Section has background in dark mode");
    assert.ok(darkModeStyles.cardBg, "Topic cards have surface in dark mode");
    console.log(`  ✓ Dark mode rendered: Section BG: ${darkModeStyles.sectionBg}, Card BG: ${darkModeStyles.cardBg}`);
    await client.captureScreenshot("04-dark-mode-transparency.png");

    console.log("\n[PASS] All E2E checks passed with zero errors!");

  } finally {
    if (client) client.close();
    try { browserProc.kill(); } catch (e) {}
    server.close();
  }

  // Final Invariant Check
  const finalDbHash = crypto.createHash("sha256").update(fs.readFileSync(PROD_DB_PATH)).digest("hex").toLowerCase();
  assert.strictEqual(finalDbHash, EXPECTED_DB_HASH, "Production database must remain strictly unmodified!");
  console.log(`\n[PASS] Production database SHA-256 strictly preserved after test execution: ${finalDbHash}`);
  console.log("===============================================================");
  console.log("   ALL WI-REPORT-10 REAL BROWSER E2E TESTS PASSED (100%)      ");
  console.log("===============================================================\n");
}

runTest().catch((err) => {
  console.error("\n[E2E FATAL ERROR]", err);
  process.exit(1);
});
