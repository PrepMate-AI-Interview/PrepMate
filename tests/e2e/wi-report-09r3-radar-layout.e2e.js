/**
 * PREPMATE — WI-REPORT-09R3 REAL BROWSER E2E TEST (EDGE / CHROMIUM CDP)
 * Radar Chart Overflow Fix & Full-Width Overview Separation Verification
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
const EXPECTED_DB_HASH = "44223d9b7e945e70cadeb3279ae3ee5a0dd748a867b2c3a6b0c5c617a9db62c3";
const SCREENSHOT_DIR = path.resolve(WORKSPACE_ROOT, "scratch/screenshots/wi-report-09r3");

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
  console.log("   PREPMATE — WI-REPORT-09R3 RADAR OVERFLOW & LAYOUT E2E      ");
  console.log("===============================================================\n");

  // 1. Database Invariant Check
  const dbBuffer = fs.readFileSync(PROD_DB_PATH);
  const actualHash = crypto.createHash("sha256").update(dbBuffer).digest("hex").toLowerCase();
  assert.strictEqual(actualHash, EXPECTED_DB_HASH, "Production database must not be modified!");
  console.log("[PASS] 1. Baseline production db.json SHA-256 invariant verified");

  // 2. Static HTTP server
  const mimeTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png"
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split("?")[0];
    if (reqPath === "/") reqPath = "/FE/features/report/report.html";
    let filePath = path.join(WORKSPACE_ROOT, reqPath);
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("Not Found: " + reqPath);
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  await new Promise((r) => server.listen(STATIC_PORT, r));
  console.log(`[PASS] 2. Test HTTP server running at http://localhost:${STATIC_PORT}`);

  // 3. Launch Headless Browser
  const browserBin = findBrowser();
  assert.ok(browserBin, "Browser executable not found");

  const tempProfile = path.join(os.tmpdir(), "prepmate_e2e_09r3_" + Date.now());
  fs.mkdirSync(tempProfile, { recursive: true });

  const browserProc = spawn(browserBin, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tempProfile}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-sync",
    "--window-size=1440,900"
  ]);

  await sleep(1500);

  const targetsResp = await fetch(`http://localhost:${CDP_PORT}/json`);
  const targets = await targetsResp.json();
  const pageTarget = targets.find((t) => t.type === "page" && !t.url.includes("sync-confirmation")) || targets.find(t => t.type === "page");

  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  console.log("[PASS] 3. Connected to Chromium CDP endpoint");

  try {
    const reportUrl = `http://localhost:${STATIC_PORT}/FE/features/report/report.html`;
    await cdp.send("Page.navigate", { url: reportUrl });
    await sleep(1500);
    const curUrl = await cdp.eval("window.location.href");
    console.log("Current URL after navigate:", curUrl);

    // Inject rich mock session
    await cdp.eval(`
      (() => {
        const mockSession = {
          sessionId: "sess_09r3_test",
          role: "Senior Backend Architect",
          jobTitle: "Senior Backend Architect",
          targetLevel: "Middle",
          demonstratedLevel: "Senior",
          overallScore: 84,
          overallNormalizedScore: 84,
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
                observedStrengths: ["Triển khai Idempotent consumer trên Kafka", "Xử lý compensation logic chặt chẽ"],
                observedWeaknesses: ["Chưa nêu rõ giải pháp phân tán lock bằng Redis"],
                supportingEvidence: ["Turn 2: Trình bày quy trình giao dịch 2 pha phi tập trung"]
              },
              {
                dimension: "REASONING_DEPTH",
                score: 8.8,
                level: "Senior",
                confidence: "HIGH",
                summary: "Tư duy phân tích đa chiều giữa đánh đổi CAP theorem và chi phí vận hành đám mây.",
                observedStrengths: ["Lập luận sắc bén về consistency vs availability", "Dự báo điểm nghẽn mạng"],
                observedWeaknesses: [],
                supportingEvidence: ["Turn 2: Đối chiếu trade-offs giữa PostgreSQL và DynamoDB"]
              },
              {
                dimension: "FOLLOW_UP_HANDLING",
                score: 8.0,
                level: "Middle",
                confidence: "MEDIUM",
                summary: "Phản hồi nhanh nhạy khi phỏng vấn viên nâng độ khó về split-brain scenario.",
                observedStrengths: ["Bình tĩnh xử lý khi bị hỏi ép tải"],
                observedWeaknesses: ["Cần phân tích sâu hơn về thuật toán Raft consensus"],
                supportingEvidence: []
              },
              {
                dimension: "COMMUNICATION",
                score: 8.6,
                level: "Senior",
                confidence: "HIGH",
                summary: "Giao tiếp súc tích, mạch lạc, thuật ngữ chuyên ngành chuẩn xác.",
                observedStrengths: ["Cấu trúc câu trả lời theo chuẩn STAR", "Truyền đạt logic trực diện"],
                observedWeaknesses: [],
                supportingEvidence: []
              },
              {
                dimension: "CONSISTENCY",
                score: null,
                level: "Unassessed",
                confidence: "INSUFFICIENT_EVIDENCE",
                summary: "Chưa đủ số lượt câu hỏi để đo lường tính nhất quán giữa các tình huống áp lực cao.",
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
    await cdp.eval(`
      if (typeof window.goToStage === 'function') {
        window.goToStage('analysis');
      } else {
        const p = document.getElementById("stage-panel-during");
        if (p) p.style.display = "block";
      }
    `);
    await sleep(500);

    // =========================================================================
    // TEST 1: Full-Width Overview Positioned ABOVE Two-Column Layout (WI-09R3B)
    // =========================================================================
    console.log("\n--- TEST 1: Full-Width Overview Positioned ABOVE Two-Column Layout (WI-09R3B) ---");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(300);

    const layoutHierarchy = await cdp.eval(`
      (() => {
        const overviewCard = document.getElementById("radar-balance-snapshot");
        const analysisContainer = document.getElementById("radar-analysis-container");
        const chartCard = document.getElementById("radar-chart-card");
        const interpCard = document.getElementById("radar-interpretation-card");
        const detailPanel = document.getElementById("dim-selected-detail-panel");

        if (!overviewCard || !analysisContainer || !chartCard || !interpCard || !detailPanel) {
          return {
            error: "Element missing",
            hasOverview: !!overviewCard,
            hasContainer: !!analysisContainer,
            hasChart: !!chartCard,
            hasInterp: !!interpCard,
            hasDetail: !!detailPanel
          };
        }

        const oRect = overviewCard.getBoundingClientRect();
        const cRect = analysisContainer.getBoundingClientRect();
        const lRect = chartCard.getBoundingClientRect();
        const rRect = interpCard.getBoundingClientRect();

        const interpContainsSnapshot = interpCard.contains(overviewCard);
        const interpChildCount = interpCard.children.length;

        return {
          overviewWidth: Math.round(oRect.width),
          overviewHeight: Math.round(oRect.height),
          containerWidth: Math.round(cRect.width),
          containerTop: Math.round(cRect.top),
          overviewBottom: Math.round(oRect.bottom),
          gapBetween: Math.round(cRect.top - oRect.bottom),
          interpContainsSnapshot,
          interpChildCount,
          detailPanelParentId: detailPanel ? detailPanel.parentElement.id : null,
          leftCardWidth: Math.round(lRect.width),
          rightCardWidth: Math.round(rRect.width),
          topDiff: Math.abs(Math.round(lRect.top - rRect.top)),
          strongestName: document.getElementById("radar-strongest-name")?.textContent.trim(),
          strongestScore: document.getElementById("radar-strongest-score")?.textContent.trim(),
          weakestName: document.getElementById("radar-weakest-name")?.textContent.trim(),
          weakestScore: document.getElementById("radar-weakest-score")?.textContent.trim(),
          statusText: document.getElementById("radar-interp-status")?.textContent.trim()
        };
      })()
    `);

    console.log("overviewWidth:", layoutHierarchy.overviewWidth, "containerWidth:", layoutHierarchy.containerWidth);
    assert.ok(layoutHierarchy.overviewWidth >= layoutHierarchy.containerWidth - 2, "Overview card must be full width spanning the container");
    assert.ok(layoutHierarchy.containerTop >= layoutHierarchy.overviewBottom, "Overview card must be positioned strictly ABOVE two-column layout");
    assert.strictEqual(layoutHierarchy.gapBetween, 20, "Gap between overview and analysis container must be exactly 20px");
    assert.strictEqual(layoutHierarchy.interpContainsSnapshot, false, "Right interpretation card must NOT contain overall snapshot");
    assert.strictEqual(layoutHierarchy.interpChildCount, 1, "Right column must contain ONLY the detail inspector panel");
    assert.strictEqual(layoutHierarchy.detailPanelParentId, "radar-interpretation-card", "Detail panel must be direct child of radar-interpretation-card");
    assert.strictEqual(layoutHierarchy.topDiff, 0, "Both columns must start at the exact same vertical position (topDiff = 0)");
    assert.ok(layoutHierarchy.strongestName.includes("Chuyên môn") || layoutHierarchy.strongestName.includes("Kỹ thuật"), "Strongest dimension name correctly populated");
    assert.ok(layoutHierarchy.strongestScore.includes("92/100"), "Strongest score correctly mapped to 92/100");
    assert.ok(layoutHierarchy.weakestScore.includes("80/100"), "Weakest assessed score correctly mapped to 80/100");

    console.log(`[PASS] Full-Width Overview: width=${layoutHierarchy.overviewWidth}px, positioned above container (gap=${layoutHierarchy.gapBetween}px)`);
    console.log(`[PASS] Right column strictly dimension-specific: childCount=${layoutHierarchy.interpChildCount}, interpContainsSnapshot=${layoutHierarchy.interpContainsSnapshot}`);

    await cdp.screenshot(path.join(SCREENSHOT_DIR, "01-overview-above-chart-1440.png"));

    // =========================================================================
    // TEST 2: Radar Chart Zero Overflow Verification (WI-09R3A) Across Viewports
    // =========================================================================
    console.log("\n--- TEST 2: Radar Chart Zero Overflow Across 4 Viewports (WI-09R3A) ---");

    const viewports = [
      { name: "desktop-1440", w: 1440, h: 900, mobile: false },
      { name: "desktop-small-1024", w: 1024, h: 768, mobile: false },
      { name: "tablet-768", w: 768, h: 1024, mobile: false },
      { name: "mobile-390", w: 390, h: 844, mobile: true }
    ];

    for (const vp of viewports) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: vp.w,
        height: vp.h,
        deviceScaleFactor: 1,
        mobile: vp.mobile
      });
      await sleep(350);

      const overflowAudit = await cdp.eval(`
        (() => {
          const card = document.getElementById("radar-chart-card");
          const wrapper = document.getElementById("radar-svg-wrapper");
          const svg = wrapper.querySelector("svg");
          const cardRect = card.getBoundingClientRect();
          const wrapperRect = wrapper.getBoundingClientRect();
          const svgRect = svg.getBoundingClientRect();

          const labels = Array.from(svg.querySelectorAll(".radar-axis-label")).map(el => {
            const r = el.getBoundingClientRect();
            return {
              text: el.textContent,
              overflowsLeft: r.left < svgRect.left - 1,
              overflowsRight: r.right > svgRect.right + 1,
              overflowsTop: r.top < svgRect.top - 1,
              overflowsBottom: r.bottom > svgRect.bottom + 1,
              overflowsCardLeft: r.left < cardRect.left,
              overflowsCardRight: r.right > cardRect.right
            };
          });

          const badges = Array.from(svg.querySelectorAll(".radar-axis-score-badge")).map(el => {
            const r = el.getBoundingClientRect();
            return {
              text: el.textContent,
              overflowsBottom: r.bottom > svgRect.bottom + 1,
              overflowsLeft: r.left < svgRect.left - 1,
              overflowsRight: r.right > svgRect.right + 1
            };
          });

          const dots = Array.from(svg.querySelectorAll(".radar-score-dot, .radar-unassessed-marker")).map(el => {
            const r = el.getBoundingClientRect();
            return {
              overflowsSvg: r.left < svgRect.left - 1 || r.right > svgRect.right + 1 || r.top < svgRect.top - 1 || r.bottom > svgRect.bottom + 1
            };
          });

          return {
            vpName: "${vp.name}",
            cardWidth: Math.round(cardRect.width),
            cardHeight: Math.round(cardRect.height),
            svgWidth: Math.round(svgRect.width),
            svgHeight: Math.round(svgRect.height),
            wrapperWidth: Math.round(wrapperRect.width),
            wrapperHeight: Math.round(wrapperRect.height),
            svgExceedsCard: svgRect.width > cardRect.width,
            svgExceedsWrapper: svgRect.width > wrapperRect.width + 1,
            labelOverflowCount: labels.filter(l => l.overflowsLeft || l.overflowsRight || l.overflowsTop || l.overflowsBottom || l.overflowsCardLeft || l.overflowsCardRight).length,
            badgeOverflowCount: badges.filter(b => b.overflowsBottom || b.overflowsLeft || b.overflowsRight).length,
            dotOverflowCount: dots.filter(d => d.overflowsSvg).length,
            viewBox: svg.getAttribute("viewBox")
          };
        })()
      `);

      assert.strictEqual(overflowAudit.svgExceedsCard, false, `${vp.name}: SVG width must not exceed card width`);
      assert.strictEqual(overflowAudit.svgExceedsWrapper, false, `${vp.name}: SVG width must not exceed wrapper width`);
      assert.strictEqual(overflowAudit.labelOverflowCount, 0, `${vp.name}: Zero labels may overflow SVG bounds or card bounds`);
      assert.strictEqual(overflowAudit.badgeOverflowCount, 0, `${vp.name}: Zero score badges may overflow SVG bounds`);
      assert.strictEqual(overflowAudit.dotOverflowCount, 0, `${vp.name}: Zero score dots may overflow SVG bounds`);
      assert.strictEqual(overflowAudit.viewBox, "0 0 560 420", "SVG viewBox must be 0 0 560 420 for proportional padding");

      console.log(`  ✓ ${vp.name}: cardW=${overflowAudit.cardWidth}px, svgW=${overflowAudit.svgWidth}px, svgH=${overflowAudit.svgHeight}px | 0 overflows`);
      await cdp.screenshot(path.join(SCREENSHOT_DIR, `02-responsive-${vp.name}.png`));
    }
    console.log("[PASS] Radar Chart scales proportionally with zero clipping or container overflow across all 4 viewports");

    // =========================================================================
    // TEST 3: Interactive Selection Updates Exclusively Dimension Detail (WI-09R3C)
    // =========================================================================
    console.log("\n--- TEST 3: Dimension Selection Updates Detail Panel Exclusively (WI-09R3C) ---");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(250);

    const dimsToTest = [
      { key: "PRACTICAL_APPLICATION", expectedScore: "85", expectedLevel: "Senior" },
      { key: "REASONING_DEPTH", expectedScore: "88", expectedLevel: "Senior" },
      { key: "FOLLOW_UP_HANDLING", expectedScore: "80", expectedLevel: "Middle" },
      { key: "COMMUNICATION", expectedScore: "86", expectedLevel: "Senior" },
      { key: "CONSISTENCY", expectedScore: "Chưa ĐG", expectedLevel: "Chưa đánh giá trong phiên" },
      { key: "TECHNICAL_KNOWLEDGE", expectedScore: "92", expectedLevel: "Senior" }
    ];

    for (const d of dimsToTest) {
      await cdp.eval(`window.selectCompetencyDimension('${d.key}');`);
      await sleep(150);

      const panelState = await cdp.eval(`
        (() => {
          const inspector = document.getElementById("dim-selected-detail-panel");
          const name = inspector.querySelector(".dim-inspector-name")?.textContent.trim();
          const key = inspector.querySelector(".dim-inspector-key")?.textContent.trim();
          const scorePill = inspector.querySelector(".dim-inspector-score-pill strong")?.textContent.trim();
          const levelBadge = inspector.querySelector(".dim-level-badge")?.textContent.trim();
          const hasAnimateClass = inspector.classList.contains("dim-panel-animate");

          const svgGroup = document.querySelector("#radar-svg-wrapper .radar-axis-group[data-dimension='${d.key}']");
          const isSvgSelected = svgGroup ? svgGroup.classList.contains("selected") : false;

          const pill = document.querySelector("#radar-dim-selector-strip .radar-dim-pill-btn[data-dimension='${d.key}']");
          const isPillActive = pill ? pill.classList.contains("active") : false;

          // Ensure right card still does NOT contain snapshot
          const interpCard = document.getElementById("radar-interpretation-card");
          const hasSnapshot = interpCard.querySelector("#radar-balance-snapshot") !== null;

          return {
            name,
            key,
            scorePill,
            levelBadge,
            hasAnimateClass,
            isSvgSelected,
            isPillActive,
            hasSnapshot
          };
        })()
      `);

      assert.strictEqual(panelState.key, d.key, `Detail panel key mismatch for ${d.key}`);
      assert.strictEqual(panelState.scorePill, d.expectedScore, `Score mismatch for ${d.key}`);
      assert.strictEqual(panelState.levelBadge, d.expectedLevel, `Level mismatch for ${d.key}`);
      assert.strictEqual(panelState.isSvgSelected, true, `SVG axis group must be selected for ${d.key}`);
      assert.strictEqual(panelState.isPillActive, true, `Quick selector pill must be active for ${d.key}`);
      assert.strictEqual(panelState.hasSnapshot, false, "Right card must not acquire snapshot during selection updates");
      console.log(`  ✓ Dimension ${d.key}: score=${panelState.scorePill}, level="${panelState.levelBadge}", SVG selected=true, strip active=true`);
    }
    console.log("[PASS] Selection correctly transitions detail panel without snapshot pollution");

    // =========================================================================
    // TEST 4: Dark Mode Styling & Visual Consistency
    // =========================================================================
    console.log("\n--- TEST 4: Dark Mode Styling & Visual Consistency ---");
    await cdp.eval(`
      document.documentElement.setAttribute("data-theme", "dark");
    `);
    await sleep(250);

    const darkAudit = await cdp.eval(`
      (() => {
        const overview = document.getElementById("radar-balance-snapshot");
        const chartCard = document.getElementById("radar-chart-card");
        const interpCard = document.getElementById("radar-interpretation-card");
        const activeAxis = document.querySelector("#radar-svg-wrapper .radar-axis-group.selected .radar-axis-line");
        const activePill = document.querySelector("#radar-dim-selector-strip .radar-dim-pill-btn.active");

        return {
          overviewBg: window.getComputedStyle(overview).backgroundColor,
          chartCardBg: window.getComputedStyle(chartCard).backgroundColor,
          interpCardBg: window.getComputedStyle(interpCard).backgroundColor,
          axisStroke: activeAxis ? window.getComputedStyle(activeAxis).stroke : null,
          pillColor: activePill ? window.getComputedStyle(activePill).color : null
        };
      })()
    `);

    assert.ok(darkAudit.overviewBg !== "rgb(255, 255, 255)", "Overview background must adapt to Dark Mode");
    assert.ok(darkAudit.chartCardBg !== "rgb(255, 255, 255)", "Chart card background must adapt to Dark Mode");
    assert.ok(darkAudit.interpCardBg !== "rgb(255, 255, 255)", "Interpretation card background must adapt to Dark Mode");
    console.log(`[PASS] Dark Mode styling verified: overviewBg=${darkAudit.overviewBg}, chartCardBg=${darkAudit.chartCardBg}`);

    await cdp.screenshot(path.join(SCREENSHOT_DIR, "03-dark-mode-1440.png"));

    // Reset theme
    await cdp.eval(`document.documentElement.removeAttribute("data-theme");`);

    // =========================================================================
    // TEST 5: Production Database Invariant Post-Run
    // =========================================================================
    console.log("\n--- TEST 5: Production Database Invariant Post-Run ---");
    const dbPostBuffer = fs.readFileSync(PROD_DB_PATH);
    const postHash = crypto.createHash("sha256").update(dbPostBuffer).digest("hex").toLowerCase();
    assert.strictEqual(postHash, EXPECTED_DB_HASH, "Production database must remain completely unchanged!");
    console.log(`[PASS] Final db.json SHA-256 invariant verified (${postHash})`);

    console.log("\n===============================================================");
    console.log("   ALL WI-REPORT-09R3 REAL BROWSER TESTS PASSED!              ");
    console.log("===============================================================\n");
  } finally {
    cdp.close();
    browserProc.kill();
    server.close();
    await sleep(500);
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch (_) {}
  }
}

runE2E().catch((err) => {
  console.error("\n[E2E FATAL ERROR]", err);
  process.exit(1);
});
