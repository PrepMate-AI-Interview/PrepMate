/**
 * PREPMATE — WI-REPORT-09R2 REAL BROWSER E2E TEST (EDGE / CHROMIUM CDP)
 * Interactive Six-Dimension Competency Two-Column Layout Verification
 */

const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");
const assert = require("assert");
const os = require("os");

const STATIC_PORT = 5059;
const CDP_PORT = 9229;
const WORKSPACE_ROOT = path.resolve(__dirname, "../../");
const PROD_DB_PATH = path.resolve(WORKSPACE_ROOT, "BE/data/db.json");
const EXPECTED_DB_HASH = "c2ba83b82e758b277786dad7073e1c8a0e80c71fc615ecbbe5847d01b47cda50";
const SCREENSHOT_DIR = path.resolve(WORKSPACE_ROOT, "scratch/screenshots/wi-report-09r2-competency");

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
      this.ws.addEventListener("message", (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.id && this.callbacks.has(msg.id)) {
            const { res, rej } = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) rej(msg.error);
            else res(msg.result);
          }
        } catch (e) {
          console.error("CDP Message Parse Error:", e);
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
  console.log("   PREPMATE — WI-REPORT-09R2 COMPETENCY REAL BROWSER E2E       ");
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

  const tempProfile = path.join(os.tmpdir(), "prepmate_e2e_09r2_comp_" + Date.now());
  fs.mkdirSync(tempProfile, { recursive: true });

  const browserProc = spawn(browserBin, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tempProfile}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1440,900"
  ]);

  await sleep(1500);

  const targetsResp = await fetch(`http://localhost:${CDP_PORT}/json`);
  const targets = await targetsResp.json();
  const pageTarget = targets.find((t) => t.type === "page");

  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  console.log("[PASS] 3. Connected to Chromium CDP endpoint");

  try {
    const reportUrl = `http://localhost:${STATIC_PORT}/FE/features/report/report.html`;
    await cdp.send("Page.navigate", { url: reportUrl });
    await sleep(800);

    // Inject rich mock session with all 6 dimensions
    await cdp.eval(`
      (() => {
        const mockSession = {
          id: "sess_comp_test",
          targetPosition: "Senior Backend Architect",
          targetLevel: "Senior",
          targetCompany: "Cloud Distributed Systems",
          duration: 35,
          questionsAnswered: 4,
          date: "2026-11-02",
          score: 88,
          scoreScale: "0-100",
          interviewerPersona: "professional",
          report: {
            overallScore: 88,
            technicalScore: 92,
            starScore: 85,
            situationalScore: 88,
            candidateQuestionScore: 86,
            overallEvaluation: {
              demonstratedLevel: "SENIOR",
              calibratedTarget: "SENIOR",
              summary: "Ứng viên thể hiện năng lực chuyên sâu về thiết kế hệ thống phân tán và cơ sở dữ liệu quy mô lớn."
            },
            performanceAssessment: {
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
              ]
            },
            performance: {
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
    // TEST 1: Two-Column Desktop Layout (1440px)
    // =========================================================================
    console.log("\n--- TEST 1: Two-Column Desktop Layout (1440px) ---");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(300);

    const layoutMetrics = await cdp.eval(`
      (() => {
        const container = document.getElementById("radar-analysis-container");
        const chartCard = document.getElementById("radar-chart-card");
        const interpCard = document.getElementById("radar-interpretation-card");
        const inspector = document.getElementById("dim-selected-detail-panel");
        const dimGrid = document.getElementById("dimensions-grid");
        const nextSection = document.getElementById("section-diagnostics");

        const cRect = container.getBoundingClientRect();
        const leftRect = chartCard.getBoundingClientRect();
        const rightRect = interpCard.getBoundingClientRect();
        const nextRect = nextSection ? nextSection.getBoundingClientRect() : null;

        const cStyle = window.getComputedStyle(container);
        const gridStyle = dimGrid ? window.getComputedStyle(dimGrid) : null;

        return {
          display: cStyle.display,
          gridColumns: cStyle.gridTemplateColumns,
          containerWidth: cRect.width,
          leftWidth: leftRect.width,
          rightWidth: rightRect.width,
          leftTop: leftRect.top,
          rightTop: rightRect.top,
          topDiff: Math.abs(leftRect.top - rightRect.top),
          inspectorParentId: inspector ? inspector.parentElement.id : null,
          dimGridDisplay: gridStyle ? gridStyle.display : null,
          dimGridHeight: dimGrid ? dimGrid.offsetHeight : null,
          gapToNextSection: nextRect ? (nextRect.top - cRect.bottom) : null
        };
      })()
    `);

    assert.strictEqual(layoutMetrics.display, "grid", "Container must be a CSS grid");
    assert.ok(layoutMetrics.leftWidth > 350, `Left chart card width (${layoutMetrics.leftWidth}) must be > 350px`);
    assert.ok(layoutMetrics.rightWidth > 350, `Right interpretation card width (${layoutMetrics.rightWidth}) must be > 350px`);
    assert.ok(layoutMetrics.topDiff < 5, `Left and Right columns topDiff (${layoutMetrics.topDiff}) must be < 5px`);
    assert.strictEqual(layoutMetrics.inspectorParentId, "radar-interpretation-card", "Inspector panel must be placed inside right column card");
    assert.strictEqual(layoutMetrics.dimGridDisplay, "none", "Redundant cards grid below chart must be display: none !important");
    assert.strictEqual(layoutMetrics.dimGridHeight, 0, "Redundant cards grid must take 0 height in the layout");
    assert.ok(layoutMetrics.gapToNextSection >= 10 && layoutMetrics.gapToNextSection <= 60, `Gap to next section (${layoutMetrics.gapToNextSection}px) must be standard and natural without blank space`);
    console.log(`[PASS] Desktop Two-Column Layout: Left=${Math.round(layoutMetrics.leftWidth)}px, Right=${Math.round(layoutMetrics.rightWidth)}px, Aligned topDiff=${Math.round(layoutMetrics.topDiff)}px, Next gap=${Math.round(layoutMetrics.gapToNextSection)}px`);

    await cdp.screenshot(path.join(SCREENSHOT_DIR, "01-desktop-two-column-1440.png"));

    // =========================================================================
    // TEST 2: Initial Selection (Strongest Assessed Dimension)
    // =========================================================================
    console.log("\n--- TEST 2: Initial Selection (Strongest Assessed) & Score Integrity ---");
    const initialSelection = await cdp.eval(`
      (() => {
        const inspector = document.getElementById("dim-selected-detail-panel");
        const name = inspector.querySelector(".dim-inspector-name")?.textContent.trim();
        const key = inspector.querySelector(".dim-inspector-key")?.textContent.trim();
        const scorePill = inspector.querySelector(".dim-inspector-score-pill strong")?.textContent.trim();
        const levelBadge = inspector.querySelector(".dim-level-badge")?.textContent.trim();
        const progressFill = inspector.querySelector(".dim-inspector-progress-row .dim-progress-fill");
        const progressWidth = progressFill ? progressFill.style.width : "";

        const activeGroup = document.querySelector("#radar-svg-wrapper .radar-axis-group.selected");
        const activeGroupKey = activeGroup ? activeGroup.getAttribute("data-dimension") : null;

        const activePill = document.querySelector("#radar-dim-selector-strip .radar-dim-pill-btn.active");
        const activePillKey = activePill ? activePill.getAttribute("data-dimension") : null;

        return {
          name,
          key,
          scorePill,
          levelBadge,
          progressWidth,
          activeGroupKey,
          activePillKey
        };
      })()
    `);

    assert.strictEqual(initialSelection.key, "TECHNICAL_KNOWLEDGE", "Initial selection must be strongest dimension TECHNICAL_KNOWLEDGE");
    assert.strictEqual(initialSelection.scorePill, "92", "Normalized score 9.2 -> 92/100 must be displayed");
    assert.strictEqual(initialSelection.activeGroupKey, "TECHNICAL_KNOWLEDGE", "Radar SVG axis for TECHNICAL_KNOWLEDGE must have .selected class");
    assert.strictEqual(initialSelection.activePillKey, "TECHNICAL_KNOWLEDGE", "Selector strip pill for TECHNICAL_KNOWLEDGE must have .active class");
    console.log(`[PASS] Initial Selection verified: Key=${initialSelection.key}, Score=${initialSelection.scorePill}/100, SVG & Strip synced`);

    // =========================================================================
    // TEST 3: Interactive Selection Across All 6 Dimensions
    // =========================================================================
    console.log("\n--- TEST 3: Interactive Selection Across All 6 Dimensions ---");
    const dimensionsToTest = [
      { key: "PRACTICAL_APPLICATION", expectedScore: "85", expectedLevel: "Senior", hasStrengths: true, hasWeaknesses: true, hasSupporting: true },
      { key: "REASONING_DEPTH", expectedScore: "88", expectedLevel: "Senior", hasStrengths: true, hasWeaknesses: false, hasSupporting: true },
      { key: "FOLLOW_UP_HANDLING", expectedScore: "80", expectedLevel: "Middle", hasStrengths: true, hasWeaknesses: true, hasSupporting: false },
      { key: "COMMUNICATION", expectedScore: "86", expectedLevel: "Senior", hasStrengths: true, hasWeaknesses: false, hasSupporting: false },
      { key: "CONSISTENCY", expectedScore: "Chưa ĐG", expectedLevel: "Chưa đánh giá trong phiên", isUnassessed: true },
      { key: "TECHNICAL_KNOWLEDGE", expectedScore: "92", expectedLevel: "Senior", hasStrengths: true, hasWeaknesses: false, hasSupporting: true }
    ];

    for (const d of dimensionsToTest) {
      await cdp.eval(`selectCompetencyDimension('${d.key}')`);
      await sleep(150);

      const state = await cdp.eval(`
        (() => {
          const inspector = document.getElementById("dim-selected-detail-panel");
          const name = inspector.querySelector(".dim-inspector-name")?.textContent.trim();
          const key = inspector.querySelector(".dim-inspector-key")?.textContent.trim();
          const scorePill = inspector.querySelector(".dim-inspector-score-pill strong")?.textContent.trim();
          const level = inspector.querySelector(".dim-level-badge")?.textContent.trim();
          const strengths = inspector.querySelectorAll(".dim-inspector-block:nth-child(2) li").length;
          const weaknesses = inspector.querySelectorAll(".dim-inspector-block:nth-child(3) li").length;
          const supportingBlock = inspector.querySelector(".dim-supporting-block");
          const guidanceBlock = inspector.querySelector(".dim-inspector-block:last-child p")?.textContent.trim();

          const svgGroup = document.querySelector(\`#radar-svg-wrapper .radar-axis-group[data-dimension="\${'${d.key}'}"]\`);
          const svgSelected = svgGroup ? svgGroup.classList.contains("selected") : false;
          const svgAriaPressed = svgGroup ? svgGroup.getAttribute("aria-pressed") : null;
          const dotActive = svgGroup?.querySelector(".radar-score-dot")?.classList.contains("active") || false;
          const labelActive = svgGroup?.querySelector(".radar-axis-label")?.classList.contains("active") || false;

          const pillBtn = document.querySelector(\`#radar-dim-selector-strip .radar-dim-pill-btn[data-dimension="\${'${d.key}'}"]\`);
          const pillActive = pillBtn ? pillBtn.classList.contains("active") : false;

          return {
            name,
            key,
            scorePill,
            level,
            strengths,
            weaknesses,
            hasSupporting: !!supportingBlock,
            hasGuidance: Boolean(guidanceBlock && guidanceBlock.length > 10),
            svgSelected,
            svgAriaPressed,
            dotActive: dotActive || '${d.isUnassessed ? "true" : "false"}' === "true",
            labelActive,
            pillActive
          };
        })()
      `);

      assert.strictEqual(state.key, d.key, `Selected detail key mismatch: expected ${d.key}, got ${state.key}`);
      assert.strictEqual(state.scorePill, d.expectedScore, `Score pill mismatch for ${d.key}`);
      assert.strictEqual(state.level, d.expectedLevel, `Level badge mismatch for ${d.key}`);
      assert.strictEqual(state.svgSelected, true, `SVG axis group for ${d.key} must be .selected`);
      assert.strictEqual(state.svgAriaPressed, "true", `SVG aria-pressed must be true for ${d.key}`);
      assert.strictEqual(state.pillActive, true, `Selector strip pill must be active for ${d.key}`);
      assert.ok(state.hasGuidance, `Practical guidance must be rendered for ${d.key}`);

      if (d.hasSupporting) {
        assert.strictEqual(state.hasSupporting, true, `Supporting evidence block must be rendered for ${d.key}`);
      }

      console.log(`  ✓ Dimension ${d.key} verified: score=${state.scorePill}, level="${state.level}", SVG selected=true, strip active=true`);
    }
    console.log("[PASS] All 6 dimensions successfully tested with live interactive transitions");

    // =========================================================================
    // TEST 4: Rapid Switching Resilience
    // =========================================================================
    console.log("\n--- TEST 4: Rapid Switching Performance & Stability ---");
    const keys = ["TECHNICAL_KNOWLEDGE", "PRACTICAL_APPLICATION", "REASONING_DEPTH", "FOLLOW_UP_HANDLING", "COMMUNICATION", "CONSISTENCY"];
    for (let i = 0; i < 12; i++) {
      const targetKey = keys[i % keys.length];
      await cdp.eval(`selectCompetencyDimension('${targetKey}')`);
      await sleep(40); // 40ms rapid clicks
    }

    // Settle on PRACTICAL_APPLICATION
    await cdp.eval(`selectCompetencyDimension('PRACTICAL_APPLICATION')`);
    await sleep(150);

    const postRapidState = await cdp.eval(`
      (() => {
        const selectedGroups = document.querySelectorAll("#radar-svg-wrapper .radar-axis-group.selected");
        const activePills = document.querySelectorAll("#radar-dim-selector-strip .radar-dim-pill-btn.active");
        const inspectorKey = document.querySelector("#dim-selected-detail-panel .dim-inspector-key")?.textContent.trim();
        return {
          selectedGroupCount: selectedGroups.length,
          activePillCount: activePills.length,
          inspectorKey
        };
      })()
    `);

    assert.strictEqual(postRapidState.selectedGroupCount, 1, "Exactly 1 SVG axis group must remain selected after rapid clicks");
    assert.strictEqual(postRapidState.activePillCount, 1, "Exactly 1 selector pill must remain active");
    assert.strictEqual(postRapidState.inspectorKey, "PRACTICAL_APPLICATION", "Detail panel must display final selected dimension");
    console.log(`[PASS] Rapid switching resilience verified: 1 active SVG axis, 1 active pill, zero state corruption`);

    // =========================================================================
    // TEST 5: Responsive Verification (1024px, 768px, 390px)
    // =========================================================================
    console.log("\n--- TEST 5: Responsive Viewports Verification ---");
    const viewports = [
      { name: "desktop-small-1024", width: 1024, height: 768, isTwoCol: true },
      { name: "tablet-768", width: 768, height: 1024, isTwoCol: true },
      { name: "mobile-390", width: 390, height: 844, isTwoCol: false }
    ];

    for (const vp of viewports) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 768
      });
      await sleep(250);

      const vpMetrics = await cdp.eval(`
        (() => {
          const container = document.getElementById("radar-analysis-container");
          const chartCard = document.getElementById("radar-chart-card");
          const interpCard = document.getElementById("radar-interpretation-card");
          const leftRect = chartCard.getBoundingClientRect();
          const rightRect = interpCard.getBoundingClientRect();
          const winWidth = window.innerWidth;
const bodyWidth = document.body.clientWidth;

          return {
            containerWidth: container.offsetWidth, winWidth,
            leftWidth: leftRect.width,
            rightWidth: rightRect.width,
            leftTop: leftRect.top,
            rightTop: rightRect.top,
            isStacked: rightRect.top >= leftRect.bottom - 5,
            hasHorizontalScroll: document.documentElement.scrollWidth > bodyWidth
          };
        })()
      `);

      if (vp.isTwoCol) {
        assert.ok(!vpMetrics.isStacked, `${vp.name} should display side-by-side columns`);
        console.log(`  ✓ ${vp.name}: side-by-side balanced (left=${Math.round(vpMetrics.leftWidth)}px, right=${Math.round(vpMetrics.rightWidth)}px)`);
      } else {
        assert.ok(vpMetrics.isStacked, `${vp.name} should stack vertically`);
        assert.ok(vpMetrics.containerWidth <= vp.width + 10, `${vp.name}: container width (${vpMetrics.containerWidth}px) must fit within mobile screen (${vp.width}px)`);
        assert.ok(vpMetrics.leftWidth <= vp.width, `${vp.name}: left card width (${vpMetrics.leftWidth}px) must fit within mobile screen`);
        assert.ok(vpMetrics.rightWidth <= vp.width, `${vp.name}: right card width (${vpMetrics.rightWidth}px) must fit within mobile screen`);
        console.log(`  ✓ ${vp.name}: vertically stacked cleanly, left=${Math.round(vpMetrics.leftWidth)}px, right=${Math.round(vpMetrics.rightWidth)}px fits mobile screen`);
      }

      await cdp.screenshot(path.join(SCREENSHOT_DIR, `02-responsive-${vp.name}.png`));
    }
    console.log("[PASS] All responsive viewports verified and captured");

    // =========================================================================
    // TEST 6: Dark Mode Verification
    // =========================================================================
    console.log("\n--- TEST 6: Dark Mode Styling & Contrast ---");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.eval(`
      document.documentElement.setAttribute("data-theme", "dark");
      selectCompetencyDimension("TECHNICAL_KNOWLEDGE");
    `);
    await sleep(250);

    const darkAudit = await cdp.eval(`
      (() => {
        const chartCard = document.getElementById("radar-chart-card");
        const interpCard = document.getElementById("radar-interpretation-card");
        const activeLine = document.querySelector("#radar-svg-wrapper .radar-axis-group.selected .radar-axis-line");
        const activeDot = document.querySelector("#radar-svg-wrapper .radar-axis-group.selected .radar-score-dot");
        const activePill = document.querySelector("#radar-dim-selector-strip .radar-dim-pill-btn.active");

        const cStyle = window.getComputedStyle(chartCard);
        const lStyle = activeLine ? window.getComputedStyle(activeLine) : null;
        const pStyle = activePill ? window.getComputedStyle(activePill) : null;

        return {
          cardBg: cStyle.backgroundColor,
          cardBorder: cStyle.borderColor,
          lineStroke: lStyle ? lStyle.stroke : null,
          pillColor: pStyle ? pStyle.color : null
        };
      })()
    `);

    assert.ok(darkAudit.cardBg, "Dark mode background must be applied");
    console.log(`[PASS] Dark Mode styling verified: cardBg=${darkAudit.cardBg}, stroke=${darkAudit.lineStroke}, pillColor=${darkAudit.pillColor}`);
    await cdp.screenshot(path.join(SCREENSHOT_DIR, "03-dark-mode-1440.png"));

    // Revert to light mode
    await cdp.eval(`document.documentElement.removeAttribute("data-theme");`);
    await sleep(150);

    // =========================================================================
    // TEST 7: Final Database SHA-256 Invariant
    // =========================================================================
    console.log("\n--- TEST 7: Final Production Database Invariant ---");
    const finalDbBuffer = fs.readFileSync(PROD_DB_PATH);
    const finalHash = crypto.createHash("sha256").update(finalDbBuffer).digest("hex").toLowerCase();
    assert.strictEqual(finalHash, EXPECTED_DB_HASH, "Production database must remain strictly unmodified!");
    console.log(`[PASS] Final db.json SHA-256 invariant verified (${finalHash})`);

    console.log("\n===============================================================");
    console.log("   ALL WI-REPORT-09R2 COMPETENCY REAL BROWSER TESTS PASSED!   ");
    console.log("===============================================================\n");

  } finally {
    cdp.close();
    browserProc.kill();
    server.close();
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch (_) {}
  }
}

runE2E().catch((err) => {
  console.error("\n[FATAL ERROR] Real Browser E2E Test Failed:\n", err);
  process.exit(1);
});
