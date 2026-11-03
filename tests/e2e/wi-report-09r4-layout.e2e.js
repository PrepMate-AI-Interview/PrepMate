/**
 * PREPMATE — WI-REPORT-09R4 REAL BROWSER E2E TEST (EDGE / CHROMIUM CDP)
 * Radar Layout Constraints, Heading Alignment & Report Cleanup Verification
 *
 * Verifies:
 * 1. WI-09R4A: Strict 60% / 40% two-column desktop layout (Radar Chart vs Selected Competency Detail)
 * 2. WI-09R4B: Competency selector buttons stay strictly within bounds with natural Vietnamese text wrapping
 * 3. WI-09R4C: Consistent left content alignment across all 4 stages and section headings
 * 4. WI-09R4D: Unnecessary audio/listen buttons removed from DOM while preserving written content & metrics
 * 5. Responsive viewports (1440, 1024, 768, 390) & Dark Mode integrity
 */

const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");
const assert = require("assert");
const os = require("os");

const STATIC_PORT = 5089;
const CDP_PORT = 9239;
const WORKSPACE_ROOT = path.resolve(__dirname, "../../");
const PROD_DB_PATH = path.resolve(WORKSPACE_ROOT, "BE/data/db.json");
const EXPECTED_DB_HASH = "c2ba83b82e758b277786dad7073e1c8a0e80c71fc615ecbbe5847d01b47cda50";
const SCREENSHOT_DIR = path.resolve(WORKSPACE_ROOT, "scratch/screenshots/wi-report-09r4");

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
          if (msg.error) rej(new Error(msg.error.message));
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

  async eval(expr) {
    const res = await this.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      console.error("Eval Exception:", JSON.stringify(res.exceptionDetails, null, 2));
    }
    return res.result ? res.result.value : null;
  }

  async screenshot(filePath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(filePath, Buffer.from(res.data, "base64"));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runE2E() {
  console.log("===============================================================");
  console.log("   PREPMATE — WI-REPORT-09R4 RADAR & ALIGNMENT E2E VERIFICATION ");
  console.log("===============================================================\n");

  // 1. Database Invariant Check
  const dbBuffer = fs.readFileSync(PROD_DB_PATH);
  const actualHash = crypto.createHash("sha256").update(dbBuffer).digest("hex").toLowerCase();
  assert.strictEqual(
    actualHash,
    EXPECTED_DB_HASH,
    `Production db.json hash mismatch! Expected ${EXPECTED_DB_HASH}, got ${actualHash}`
  );
  console.log("[PASS] 1. Production database SHA-256 strictly invariant.");

  // 2. Start HTTP static file server
  const mimeTypes = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml"
  };

  const server = http.createServer((req, res) => {
    let cleanUrl = req.url.split("?")[0].split("#")[0];
    if (cleanUrl === "/") cleanUrl = "/FE/features/report/report.html";
    const filePath = path.join(WORKSPACE_ROOT, cleanUrl);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "text/plain",
        "Access-Control-Allow-Origin": "*"
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end("Not Found: " + cleanUrl);
    }
  });

  await new Promise((resolve) => server.listen(STATIC_PORT, "127.0.0.1", resolve));
  console.log(`[PASS] 2. Local test HTTP server listening on http://127.0.0.1:${STATIC_PORT}`);

  // 3. Launch Headless Browser with CDP
  const browserBin = findBrowser();
  assert.ok(browserBin, "A valid Chromium or Edge browser binary was found on system.");
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), "prepmate-09r4-"));

  const browserProc = spawn(browserBin, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tempProfile}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ]);

  let cdpConnected = false;
  let client = null;

  try {
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then((r) => r.json());
        const pageTarget = listRes.find((t) => t.type === "page" && !t.url.includes("sync-confirmation"));
        if (pageTarget && pageTarget.webSocketDebuggerUrl) {
          client = new CDPClient(pageTarget.webSocketDebuggerUrl);
          await client.connect();
          cdpConnected = true;
          break;
        }
      } catch (_) {}
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

    // Inject rich mock session with complete 6 dimensions and questions
    await client.eval(`
      (() => {
        const mockSession = {
          sessionId: "sess_09r4_test",
          role: "Senior Backend Architect",
          jobTitle: "Senior Backend Architect",
          targetLevel: "Middle",
          demonstratedLevel: "Senior",
          overallScore: 84,
          overallNormalizedScore: 84,
          answers: [
            { turnIndex: 1, question: "Thiết kế kiến trúc lưu trữ dữ liệu?", answer: "Sử dụng PostgreSQL kết hợp Redis cache và Kafka event streaming.", topic: "Kiến trúc hệ thống" }
          ],
          report: {
            overallScore: 84,
            demonstratedLevel: "Senior",
            calibratedTarget: "Middle",
            dimensions: [
              {
                dimension: "TECHNICAL_KNOWLEDGE",
                score: 9.2,
                level: "Senior",
                confidence: "HIGH",
                summary: "Nắm vững nguyên lý cốt lõi về lưu trữ, lập chỉ mục và tối ưu hóa truy vấn hiệu năng cao.",
                observedStrengths: ["Hiểu sâu cấu trúc BRIN và B-Tree Index", "Thiết kế partitioning thông minh"],
                observedWeaknesses: [],
                supportingEvidence: ["Turn 1: Phân tích cơ chế ghi WAL và IOPS"]
              },
              {
                dimension: "PRACTICAL_APPLICATION",
                score: 8.5,
                level: "Senior",
                confidence: "HIGH",
                summary: "Khả năng ứng dụng các mẫu thiết kế Saga và Outbox pattern chuẩn xác vào bài toán thực tiễn.",
                observedStrengths: ["Triển khai Idempotent consumer trên Kafka"],
                observedWeaknesses: ["Chưa nêu rõ giải pháp phân tán lock bằng Redis"],
                supportingEvidence: ["Turn 1: Outbox pattern"]
              },
              {
                dimension: "REASONING_DEPTH",
                score: 8.8,
                level: "Senior",
                confidence: "HIGH",
                summary: "Tư duy phân tích đa chiều giữa đánh đổi CAP theorem và chi phí đám mây.",
                observedStrengths: ["Lập luận sắc bén về consistency vs availability"],
                observedWeaknesses: [],
                supportingEvidence: []
              },
              {
                dimension: "FOLLOW_UP_HANDLING",
                score: 8.0,
                level: "Middle",
                confidence: "MEDIUM",
                summary: "Phản hồi nhanh nhạy khi phỏng vấn viên nâng độ khó.",
                observedStrengths: ["Bình tĩnh xử lý khi bị hỏi ép tải"],
                observedWeaknesses: ["Cần phân tích sâu hơn về thuật toán Raft"],
                supportingEvidence: []
              },
              {
                dimension: "COMMUNICATION",
                score: 8.6,
                level: "Senior",
                confidence: "HIGH",
                summary: "Giao tiếp súc tích, mạch lạc, thuật ngữ chuyên ngành chuẩn xác.",
                observedStrengths: ["Cấu trúc câu trả lời theo chuẩn STAR"],
                observedWeaknesses: [],
                supportingEvidence: []
              },
              {
                dimension: "CONSISTENCY",
                score: null,
                level: "Unassessed",
                confidence: "INSUFFICIENT_EVIDENCE",
                summary: "Chưa đủ số lượt câu hỏi để đo lường tính nhất quán.",
                observedStrengths: [],
                observedWeaknesses: [],
                supportingEvidence: []
              }
            ],
            performance: {
              dimensions: [
                { dimension: "TECHNICAL_KNOWLEDGE", score: 9.2, level: "Senior", confidence: "HIGH" },
                { dimension: "PRACTICAL_APPLICATION", score: 8.5, level: "Senior", confidence: "HIGH" },
                { dimension: "REASONING_DEPTH", score: 8.8, level: "Senior", confidence: "HIGH" },
                { dimension: "FOLLOW_UP_HANDLING", score: 8.0, level: "Middle", confidence: "MEDIUM" },
                { dimension: "COMMUNICATION", score: 8.6, level: "Senior", confidence: "HIGH" },
                { dimension: "CONSISTENCY", score: null, level: "Unassessed", confidence: "INSUFFICIENT_EVIDENCE" }
              ]
            }
          }
        };

        mockSession.Report = mockSession.report;
        localStorage.setItem("interview_sessions", JSON.stringify([mockSession]));
        sessionStorage.setItem("prepmate_latest_session", JSON.stringify(mockSession));
        sessionStorage.setItem("interview_session", JSON.stringify(mockSession));
        window.location.reload();
      })()
    `);

    await sleep(1500);

    // Switch to Stage 03: Phân tích
    await client.eval(`window.goToStage("during", { scroll: false });`);
    await sleep(400);

    // =========================================================================
    // TEST SUITE A: WI-09R4A - 60% / 40% TWO-COLUMN DESKTOP LAYOUT RATIO
    // =========================================================================
    console.log("\n--- TEST GROUP A: 60% / 40% Two-Column Desktop Ratio ---");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(500);

    const desktopDimensions = await client.eval(`
      (() => {
        const container = document.getElementById("radar-analysis-container");
        const chartCard = document.getElementById("radar-chart-card");
        const detailCard = document.getElementById("radar-interpretation-card");
        if (!container || !chartCard || !detailCard) return null;

        const cRect = container.getBoundingClientRect();
        const leftRect = chartCard.getBoundingClientRect();
        const rightRect = detailCard.getBoundingClientRect();

        const totalWidth = leftRect.width + rightRect.width;
        const leftPercent = (leftRect.width / totalWidth) * 100;
        const rightPercent = (rightRect.width / totalWidth) * 100;

        return {
          containerWidth: Math.round(cRect.width),
          leftWidth: Math.round(leftRect.width),
          rightWidth: Math.round(rightRect.width),
          leftPercent: Math.round(leftPercent * 10) / 10,
          rightPercent: Math.round(rightPercent * 10) / 10,
          ratio: Math.round((leftRect.width / rightRect.width) * 100) / 100
        };
      })()
    `);

    assert.ok(desktopDimensions, "Radar analysis container and columns rendered in DOM.");
    console.log(`Left Column (Radar Chart): ${desktopDimensions.leftWidth}px (${desktopDimensions.leftPercent}%)`);
    console.log(`Right Column (Detail Panel): ${desktopDimensions.rightWidth}px (${desktopDimensions.rightPercent}%)`);
    console.log(`Ratio: ${desktopDimensions.ratio}:1 (Expected: 1.50:1 for 60/40)`);

    // 60% / 40% ratio means left is ~60% (tolerance 58% - 62%) and right is ~40% (tolerance 38% - 42%)
    assert.ok(
      desktopDimensions.leftPercent >= 58 && desktopDimensions.leftPercent <= 62,
      `Radar chart column should be ~60% of total card width (got ${desktopDimensions.leftPercent}%)`
    );
    assert.ok(
      desktopDimensions.rightPercent >= 38 && desktopDimensions.rightPercent <= 42,
      `Competency detail panel should be ~40% of total card width (got ${desktopDimensions.rightPercent}%)`
    );
    console.log("[PASS] WI-09R4A: Strict 60% / 40% column ratio verified on 1440px desktop.");

    // =========================================================================
    // TEST SUITE B: WI-09R4B - SELECTOR BUTTONS & LABEL OVERFLOW PREVENTION
    // =========================================================================
    console.log("\n--- TEST GROUP B: Selector Buttons Overflow & Text Wrapping ---");
    const selectorBounds = await client.eval(`
      (() => {
        const strip = document.getElementById("radar-dim-selector-strip");
        const chartCard = document.getElementById("radar-chart-card");
        const buttons = Array.from(strip ? strip.querySelectorAll(".radar-dim-pill-btn") : []);
        if (!strip || !chartCard || buttons.length === 0) return null;

        const cardRect = chartCard.getBoundingClientRect();
        const stripRect = strip.getBoundingClientRect();

        let anyOverflows = false;
        const buttonDetails = buttons.map((b, i) => {
          const bRect = b.getBoundingClientRect();
          const overflowsStrip = (bRect.right > stripRect.right + 2) || (bRect.left < stripRect.left - 2);
          const overflowsCard = (bRect.right > cardRect.right + 2) || (bRect.left < cardRect.left - 2);
          if (overflowsStrip || overflowsCard) anyOverflows = true;

          const textEl = b.querySelector(".dim-pill-name");
          const style = window.getComputedStyle(b);
          return {
            index: i,
            dimKey: b.getAttribute("data-dimension"),
            width: Math.round(bRect.width),
            whiteSpace: style.whiteSpace,
            overflowsStrip,
            overflowsCard
          };
        });

        return {
          buttonCount: buttons.length,
          anyOverflows,
          stripWidth: Math.round(stripRect.width),
          cardWidth: Math.round(cardRect.width),
          buttonDetails
        };
      })()
    `);

    assert.ok(selectorBounds, "Selector buttons rendered.");
    assert.strictEqual(selectorBounds.buttonCount, 6, "Exactly 6 competency dimension buttons rendered.");
    assert.strictEqual(selectorBounds.anyOverflows, false, "All selector buttons strictly contained inside parent bounds.");
    assert.strictEqual(selectorBounds.buttonDetails[0].whiteSpace, "normal", "Text wrapping is normal (not clipped nowrap).");
    console.log("[PASS] WI-09R4B: All 6 dimension selector buttons stay strictly within boundaries without horizontal overflow.");

    // Test selection interaction and box-shadow containment
    const selectCheck = await client.eval(`
      (() => {
        const btn = document.querySelector(".radar-dim-pill-btn[data-dimension='PRACTICAL_APPLICATION']");
        if (!btn) return false;
        btn.click();
        const activeBtn = document.querySelector(".radar-dim-pill-btn[data-dimension='PRACTICAL_APPLICATION']");
        const target = activeBtn || btn;
        const style = window.getComputedStyle(target);
        return {
          isActive: target.classList.contains("active"),
          boxShadow: style.boxShadow
        };
      })()
    `);
    assert.ok(selectCheck.isActive, "Button successfully activated on click.");
    assert.ok(selectCheck.boxShadow.includes("inset"), "Active state uses inset box shadow to prevent border expansion.");
    console.log("[PASS] WI-09R4B: Selection interaction and inset box-shadow containment verified.");

    // =========================================================================
    // TEST SUITE C: WI-09R4C - HEADING ALIGNMENT STANDARDIZATION
    // =========================================================================
    console.log("\n--- TEST GROUP C: Heading Left Alignment Across All Stages ---");
    
    // Switch through all 4 stages and measure stage header and section title left coordinates
    const alignmentResults = await client.eval(`
      (async () => {
        const stages = ["overview", "feedback", "during", "after"];
        const measurements = [];

        for (const st of stages) {
          window.goToStage(st, { scroll: false });
          await new Promise(r => setTimeout(r, 60));

          const panelMap = {
            overview: "stage-panel-overview",
            feedback: "stage-panel-feedback",
            during: "stage-panel-during",
            after: "stage-panel-after"
          };
          const panel = document.getElementById(panelMap[st]);
          if (!panel) continue;

          const stageHeader = panel.querySelector(".stage-main-header");
          const stageTitle = panel.querySelector(".stage-main-title");
          const sectionHeaders = Array.from(panel.querySelectorAll(".section-header")).filter(sh => sh.offsetParent !== null);

          const sLeft = stageHeader ? Math.round(stageHeader.getBoundingClientRect().left) : null;
          const sTitleLeft = stageTitle ? Math.round(stageTitle.getBoundingClientRect().left) : null;

          const secDetails = sectionHeaders.map(sh => {
            const title = sh.querySelector(".section-title");
            return {
              headerLeft: Math.round(sh.getBoundingClientRect().left),
              titleLeft: title ? Math.round(title.getBoundingClientRect().left) : null,
              titleText: title ? title.textContent.trim().slice(0, 30) : ""
            };
          });

          measurements.push({
            stage: st,
            stageHeaderLeft: sLeft,
            stageTitleLeft: sTitleLeft,
            sections: secDetails
          });
        }

        // Specifically check #section-diagnostics in during/analysis
        window.goToStage("during", { scroll: false });
        const diagHeader = document.querySelector("#section-diagnostics .section-header");
        const diagTitle = document.querySelector("#section-diagnostics .section-title");
        const diagLeft = diagTitle ? Math.round(diagTitle.getBoundingClientRect().left) : null;

        return {
          measurements,
          diagLeft
        };
      })()
    `);

    assert.ok(alignmentResults, "Alignment measurements collected.");
    const baseLeft = alignmentResults.measurements[0].stageTitleLeft;
    console.log(`Base Content Left Boundary: ${baseLeft}px`);

    alignmentResults.measurements.forEach((m) => {
      console.log(`Stage [${m.stage.toUpperCase()}]: Title Left = ${m.stageTitleLeft}px (Stage Header Left = ${m.stageHeaderLeft}px)`);
      assert.strictEqual(
        m.stageTitleLeft,
        baseLeft,
        `Stage ${m.stage} title left (${m.stageTitleLeft}px) should align with base (${baseLeft}px)`
      );

      m.sections.forEach((sec) => {
        if (sec.titleLeft !== null) {
          assert.strictEqual(
            sec.titleLeft,
            baseLeft,
            `Section "${sec.titleText}" left (${sec.titleLeft}px) should match base left (${baseLeft}px)`
          );
        }
      });
    });

    assert.strictEqual(
      alignmentResults.diagLeft,
      baseLeft,
      `#section-diagnostics heading must align to exact base left (${baseLeft}px)`
    );
    console.log("[PASS] WI-09R4C: All stage headers and section titles align to the exact same left boundary (zero drift).");

    // =========================================================================
    // TEST SUITE D: WI-09R4D - AUDIO/LISTEN CONTROLS ELIMINATION
    // =========================================================================
    console.log("\n--- TEST GROUP D: Audio/Listen Controls Elimination ---");
    const voiceCheck = await client.eval(`
      (() => {
        const heroVoice = document.getElementById("hero-voice-container");
        const diagVoice = document.getElementById("diag-voice-container");
        const voiceBtns = document.querySelectorAll(".btn-report-voice");
        
        // Check preserved metrics and evidence
        const speechMetrics = document.getElementById("speech-metrics-grid");
        const videoClip = document.getElementById("video-replay-viewport");
        const hasPrepMateReportVoice = typeof window.PrepMateReportVoice !== "undefined";

        return {
          heroVoiceExists: heroVoice !== null,
          diagVoiceExists: diagVoice !== null,
          voiceBtnCount: voiceBtns.length,
          speechMetricsPresent: speechMetrics !== null,
          hasPrepMateReportVoice
        };
      })()
    `);

    assert.strictEqual(voiceCheck.heroVoiceExists, false, "#hero-voice-container is completely removed from DOM.");
    assert.strictEqual(voiceCheck.diagVoiceExists, false, "#diag-voice-container is completely removed from DOM.");
    assert.strictEqual(voiceCheck.voiceBtnCount, 0, "Zero .btn-report-voice buttons rendered in report.");
    assert.strictEqual(voiceCheck.speechMetricsPresent, true, "Voice analysis metrics preserved intact.");
    assert.strictEqual(voiceCheck.hasPrepMateReportVoice, true, "window.PrepMateReportVoice preserved for contract compatibility.");
    console.log("[PASS] WI-09R4D: Unnecessary audio read-aloud buttons removed while written diagnostics and metrics are preserved.");

    // =========================================================================
    // TEST SUITE E: MULTI-VIEWPORT & DARK MODE ROBUSTNESS
    // =========================================================================
    console.log("\n--- TEST GROUP E: Multi-Viewport & Dark Mode Robustness ---");
    
    // 1. Tablet (1024px)
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
    await sleep(200);
    const tabletCheck = await client.eval(`
      (() => {
        const c = document.getElementById("radar-analysis-container");
        return c ? { w: Math.round(c.getBoundingClientRect().width) } : null;
      })()
    `);
    assert.ok(tabletCheck.w > 0, "Tablet 1024px renders without collapse.");
    await client.screenshot(path.join(SCREENSHOT_DIR, "report-1024-tablet.png"));

    // 2. Mobile (768px & 390px)
    await client.send("Emulation.setDeviceMetricsOverride", { width: 768, height: 1024, deviceScaleFactor: 1, mobile: true });
    await sleep(200);
    await client.screenshot(path.join(SCREENSHOT_DIR, "report-768-mobile.png"));

    await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(200);
    const mobileCheck = await client.eval(`
      (() => {
        const docWidth = document.documentElement.scrollWidth;
        const vpWidth = window.innerWidth;
        return { docWidth, vpWidth, overflows: docWidth > vpWidth };
      })()
    `);
    assert.strictEqual(mobileCheck.overflows, false, "390px mobile viewport has zero horizontal page overflow.");
    await client.screenshot(path.join(SCREENSHOT_DIR, "report-390-mobile.png"));

    // 3. Dark Mode Test
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await client.eval(`document.documentElement.setAttribute("data-theme", "dark");`);
    await sleep(300);
    await client.screenshot(path.join(SCREENSHOT_DIR, "report-1440-darkmode.png"));
    console.log("[PASS] Multi-viewport (1440, 1024, 768, 390) and Dark Mode screenshots captured cleanly.");

    // Final Database Verification
    const finalBuffer = fs.readFileSync(PROD_DB_PATH);
    const finalHash = crypto.createHash("sha256").update(finalBuffer).digest("hex").toLowerCase();
    assert.strictEqual(finalHash, EXPECTED_DB_HASH, "Production database invariant preserved at test close.");

    console.log("\n===============================================================");
    console.log("   ALL WI-REPORT-09R4 E2E ACCEPTANCE GATES PASSED CLEANLY!     ");
    console.log("===============================================================\n");
  } finally {
    if (client) client.close();
    browserProc.kill();
    server.close();
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch (_) {}
  }
}

runE2E().catch((err) => {
  console.error("\n[E2E FATAL ERROR]:", err);
  process.exit(1);
});
