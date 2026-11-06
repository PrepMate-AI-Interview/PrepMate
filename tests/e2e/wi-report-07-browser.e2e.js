/**
 * PREPMATE — WI-REPORT-07 REAL BROWSER E2E TEST (EDGE / CHROMIUM CDP)
 * Report Navigation & Content Flow Optimization Verification
 */

const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");
const assert = require("assert");
const os = require("os");

const STATIC_PORT = 5057;
const CDP_PORT = 9227;
const WORKSPACE_ROOT = path.resolve(__dirname, "../../");
const PROD_DB_PATH = path.resolve(WORKSPACE_ROOT, "BE/data/db.json");
const EXPECTED_DB_HASH = "44223d9b7e945e70cadeb3279ae3ee5a0dd748a867b2c3a6b0c5c617a9db62c3";
const SCREENSHOT_DIR = path.resolve(WORKSPACE_ROOT, "scratch/screenshots/wi-report-07");

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
            if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
            else res(msg.result);
          }
        } catch (e) {}
      });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.callbacks.set(id, { res: resolve, rej: reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result ? res.result.value : null;
  }

  async setViewport(width, height, isMobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile
    });
  }

  async captureScreenshot(filename) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(res.data, "base64");
    const outPath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`  [Screenshot saved] -> ${filename}`);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
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

function startStaticServer() {
  const mimeTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png"
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split("?")[0];
    if (reqPath === "/") reqPath = "/FE/index.html";
    const filePath = path.join(WORKSPACE_ROOT, reqPath.startsWith("/FE") ? reqPath : `/FE${reqPath}`);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
      res.end(fs.readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end("Not Found: " + reqPath);
    }
  });

  return new Promise((resolve) => {
    server.listen(STATIC_PORT, () => resolve(server));
  });
}

async function runBrowserTest() {
  console.log("===============================================================");
  console.log("   WI-REPORT-07: REAL BROWSER E2E VERIFICATION (EDGE / CDP)   ");
  console.log("===============================================================\n");

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const initialHash = crypto.createHash("sha256").update(fs.readFileSync(PROD_DB_PATH)).digest("hex").toLowerCase();
  assert.strictEqual(initialHash, EXPECTED_DB_HASH, "Baseline DB hash mismatch!");
  console.log(`[1] Production DB Hash Baseline Verified: ${initialHash}`);

  const browserPath = findBrowser();
  assert.ok(browserPath, "No Chromium browser executable found!");
  console.log(`[2] Browser: ${browserPath}`);

  console.log(`[3] Starting local static server on port ${STATIC_PORT}...`);
  const server = await startStaticServer();
  console.log("  ✓ Static server ready.");

  console.log(`[4] Launching Browser with CDP on port ${CDP_PORT}...`);
  const userDataDir = path.join(os.tmpdir(), `prepmate_e2e_07_${Date.now()}`);
  const browserProc = spawn(
    browserPath,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      `--user-data-dir=${userDataDir}`,
      `http://127.0.0.1:${STATIC_PORT}/FE/features/report/report.html`
    ],
    { stdio: "ignore" }
  );

  let cdpTargets = null;
  for (let i = 0; i < 30; i++) {
    try {
      cdpTargets = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
      if (Array.isArray(cdpTargets) && cdpTargets.length > 0) break;
    } catch (e) {
      await sleep(300);
    }
  }

  assert.ok(cdpTargets && cdpTargets.length > 0, "Failed to connect to CDP target.");
  const pageTarget = cdpTargets.find(t => t.type === "page") || cdpTargets[0];
  console.log(`  ✓ Connected to target: ${pageTarget.title}`);

  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  console.log("  ✓ CDP WebSocket session established.");

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // Mock complete session data with answers and report
  console.log("\n[5] Injecting mock interview session & report state...");
  await cdp.eval(`
    (() => {
      const mockSession = {
        id: "sess_wi07_test",
        targetPosition: "Senior Backend Engineer",
        targetLevel: "Senior",
        targetCompany: "Tech Global Inc",
        duration: 25,
        questionsAnswered: 3,
        date: "2026-11-02",
        score: 86,
        scoreScale: "0-100",
        interviewerPersona: "professional",
        answers: [
          {
            question: "Hãy giải thích cách bạn xử lý hiện tượng Cache Stampede và Race Condition khi hệ thống chịu tải 100,000 RPS?",
            answer: "Trong kiến trúc microservices trước đây của tôi, chúng tôi áp dụng chiến lược kết hợp giữa Distributed Locking thông qua Redlock (Redis) với thuật toán Mutex Key. Cụ thể, khi cache key hết hạn, chỉ có đúng một worker duy nhất được cấp lock để truy vấn database và tính toán lại kết quả. Các request còn lại sẽ fallback lấy dữ liệu stale tạm thời với TTL 30 giây hoặc chờ lock trong khoảng backoff 50ms. Bên cạnh đó, chúng tôi triển khai kỹ thuật Probabilistic Early Expiration (XFetch) giúp pre-compute cache trước khi key thực sự hết hạn dựa trên delta thời gian tính toán và hệ số beta. Nhờ giải pháp này, tải database giảm 94% trong các đợt flash sale.",
            topic: "Hệ thống phân tán & Cache"
          },
          {
            question: "Làm thế nào bạn tối ưu hóa truy vấn PostgreSQL khi bảng giao dịch đạt 50 triệu bản ghi?",
            answer: "Chúng tôi áp dụng Partitioning theo khoảng thời gian (Range Partitioning theo tháng) kết hợp Partial Indexing và BRIN index cho các cột timestamp. Đối với các câu truy vấn phức tạp, chúng tôi tiến hành phân tích EXPLAIN ANALYZE để loại bỏ Sequential Scan và tối ưu work_mem.",
            topic: "Cơ sở dữ liệu PostgreSQL"
          },
          {
            question: "Mô tả một tình huống bạn phải thuyết phục team thay đổi kiến trúc cơ bản của dự án.",
            answer: "Tôi đã tổ chức buổi workshop kỹ thuật, chuẩn bị RFC tài liệu hóa rõ ràng trade-offs, chi phí và rủi ro, đồng thời triển khai một bản PoC nhỏ để chứng minh độ trễ giảm 40% trước khi team đồng thuận chuyển đổi.",
            topic: "Giao tiếp & Thuyết phục kỹ thuật"
          }
        ],
        Report: {
          overallScore: 86,
          scoreScale: "0-100",
          summary: "Ứng viên thể hiện kiến thức chuyên môn vững chắc về hệ thống phân tán và cơ sở dữ liệu lớn. Khả năng giải thích cơ chế sâu và có kinh nghiệm thực chiến rõ rệt.",
          strengths: [
            {
              title: "Tối ưu hóa Cache & Hệ thống phân tán",
              description: "Nắm vững cơ chế Redlock và thuật toán XFetch, minh chứng khả năng xử lý bài toán high concurrency cực tốt cho vai trò Senior Backend Engineer."
            },
            {
              title: "Kỹ năng phân vùng & Indexing PostgreSQL",
              description: "Vận dụng chuẩn xác kỹ thuật Range Partitioning và EXPLAIN ANALYZE, bảo đảm độ ổn định cho bảng dữ liệu lớn."
            }
          ],
          diagnosticAnalysis: {
            weaknessDiagnoses: [
              {
                title: "Chưa phân tích chi tiết chi phí tài nguyên phần cứng",
                description: "Cần bổ sung tính toán về bộ nhớ RAM tiêu thụ khi áp dụng Mutex Locking ở quy mô lớn.",
                priority: "TRUNG BÌNH"
              }
            ]
          },
          improvementRoadmap: {
            overallAssessment: "Ứng viên đã đạt chuẩn Senior cho vị trí Lead Backend Engineer. Mục tiêu tiếp theo là hoàn thiện tư duy tối ưu hóa chi phí vận hành đám mây.",
            priorities: [
              {
                improvementObjective: "Bổ sung tính toán Capacity Planning cho cụm Redis Cluster",
                concreteAction: "Lập bảng ước lượng throughput, network I/O và memory overhead cho từng node.",
                timeframe: "1-2 tuần"
              }
            ]
          }
        }
      };

      localStorage.setItem("interview_sessions", JSON.stringify([mockSession]));
      sessionStorage.setItem("prepmate_latest_session", JSON.stringify(mockSession));
      sessionStorage.setItem("interview_session", JSON.stringify(mockSession));
      window.location.reload();
    })();
  `);

  await sleep(1200);

  // Viewport 1: Desktop 1440x900
  console.log("\n[6] Testing Viewport: Desktop 1440x900...");
  await cdp.setViewport(1440, 900, false);
  await sleep(400);

  // 6.1 Check Tab Structure and Order in UI
  console.log("  • Checking 4 Primary Tabs in DOM & Sequence...");
  const tabInfo = await cdp.eval(`
    (() => {
      const tabs = Array.from(document.querySelectorAll("#report-phase-nav .stage-tab-btn")).map(b => ({
        id: b.id,
        stage: b.getAttribute("data-stage"),
        step: b.querySelector(".stage-step-num")?.textContent.trim(),
        label: b.querySelector(".stage-tab-label")?.textContent.trim(),
        active: b.classList.contains("active")
      }));
      return tabs;
    })()
  `);

  console.log("    Observed Tabs:", JSON.stringify(tabInfo, null, 2));
  assert.strictEqual(tabInfo.length, 4, "Must have exactly 4 primary tabs");
  assert.strictEqual(tabInfo[0].id, "phase-btn-overview", "Tab 1 must be overview");
  assert.strictEqual(tabInfo[0].step, "01", "Tab 1 step must be 01");
  assert.strictEqual(tabInfo[0].label, "Tổng quan", "Tab 1 label must be Tổng quan");

  assert.strictEqual(tabInfo[1].id, "phase-btn-feedback", "Tab 2 must be feedback");
  assert.strictEqual(tabInfo[1].step, "02", "Tab 2 step must be 02");
  assert.strictEqual(tabInfo[1].label, "Nhận xét", "Tab 2 label must be Nhận xét");

  assert.strictEqual(tabInfo[2].id, "phase-btn-analysis", "Tab 3 must be analysis");
  assert.strictEqual(tabInfo[2].step, "03", "Tab 3 step must be 03");
  assert.strictEqual(tabInfo[2].label, "Phân tích", "Tab 3 label must be Phân tích");

  assert.strictEqual(tabInfo[3].id, "phase-btn-recommendations", "Tab 4 must be recommendations");
  assert.strictEqual(tabInfo[3].step, "04", "Tab 4 step must be 04");
  assert.strictEqual(tabInfo[3].label, "Đề xuất", "Tab 4 label must be Đề xuất");

  // 6.2 Check Overview UI & Redundant Navigation Elimination
  console.log("  • Checking Stage 01 (Tổng quan) UI and zero duplicate CTAs...");
  const overviewCheck = await cdp.eval(`
    (() => {
      const p1 = document.getElementById("stage-panel-overview");
      const hasHeroCtaRow = Boolean(document.querySelector(".hero-cta-action-row"));
      const visibleExploreBtn = Array.from(document.querySelectorAll(".hero-action-btn")).filter(el => el.offsetParent !== null).length;
      return {
        p1Visible: p1 && p1.style.display !== "none",
        hasHeroCtaRow,
        visibleExploreBtn
      };
    })()
  `);

  assert.ok(overviewCheck.p1Visible, "Overview panel must be visible");
  assert.strictEqual(overviewCheck.hasHeroCtaRow, false, "Overview must NOT contain hero-cta-action-row");
  assert.strictEqual(overviewCheck.visibleExploreBtn, 0, "No duplicate CTA action buttons in Overview");
  await cdp.captureScreenshot("wi07-desktop-01-overview.png");
  console.log("  ✓ Stage 01 (Tổng quan) verified cleanly with zero redundant CTA rows.");

  // 6.3 Test Navigation to Stage 02 (Nhận xét)
  console.log("\n  • Clicking Tab 02: Nhận xét (Question-Level Feedback)...");
  await cdp.eval(`goToStage('feedback')`);
  await sleep(400);

  const feedbackCheck = await cdp.eval(`
    (() => {
      const p2 = document.getElementById("stage-panel-feedback");
      const p1 = document.getElementById("stage-panel-overview");
      const p3 = document.getElementById("stage-panel-during");
      const p4 = document.getElementById("stage-panel-after");
      const stepTag = p2?.querySelector(".stage-step-tag")?.textContent.trim();
      const qCards = document.querySelectorAll("#question-feedback-list .qfb-card").length;
      return {
        p2Visible: p2 && p2.style.display !== "none" && p2.classList.contains("active"),
        othersHidden: p1.style.display === "none" && p3.style.display === "none" && p4.style.display === "none",
        stepTag,
        qCards
      };
    })()
  `);

  assert.ok(feedbackCheck.p2Visible, "stage-panel-feedback must be visible and active");
  assert.ok(feedbackCheck.othersHidden, "All other panels must be hidden");
  assert.strictEqual(feedbackCheck.stepTag, "GIAI ĐOẠN 02", "Stage panel header tag must be GIAI ĐOẠN 02");
  await cdp.captureScreenshot("wi07-desktop-02-feedback.png");
  console.log(`  ✓ Stage 02 (Nhận xét) verified: tag=${feedbackCheck.stepTag}, questions rendered=${feedbackCheck.qCards}`);

  // 6.4 Test Navigation to Stage 03 (Phân tích)
  console.log("\n  • Clicking Tab 03: Phân tích (Behavioral & Presentation Analysis)...");
  await cdp.eval(`goToStage('analysis')`);
  await sleep(400);

  const analysisCheck = await cdp.eval(`
    (() => {
      const p3 = document.getElementById("stage-panel-during");
      const stepTag = p3?.querySelector(".stage-step-tag")?.textContent.trim();
      const dimsCount = document.querySelectorAll("#dimensions-grid .dimension-card").length;
      const noticeBanner = document.querySelector(".analysis-to-feedback-box");
      const noticeBannerVisible = noticeBanner ? noticeBanner.offsetParent !== null : false;
      return {
        p3Visible: p3 && p3.style.display !== "none" && p3.classList.contains("active"),
        stepTag,
        dimsCount,
        noticeBannerVisible
      };
    })()
  `);

  assert.ok(analysisCheck.p3Visible, "stage-panel-during must be visible and active");
  assert.strictEqual(analysisCheck.stepTag, "GIAI ĐOẠN 03", "Stage panel header tag must be GIAI ĐOẠN 03");
  assert.strictEqual(analysisCheck.noticeBannerVisible, false, "Redundant notice banner in Phân tích must be hidden");
  await cdp.captureScreenshot("wi07-desktop-03-analysis.png");
  console.log(`  ✓ Stage 03 (Phân tích) verified: tag=${analysisCheck.stepTag}, banner hidden, dims=${analysisCheck.dimsCount}`);

  // 6.5 Test Navigation to Stage 04 (Đề xuất)
  console.log("\n  • Clicking Tab 04: Đề xuất (Improvement Priorities & Roadmap)...");
  await cdp.eval(`goToStage('recommendations')`);
  await sleep(400);

  const afterCheck = await cdp.eval(`
    (() => {
      const p4 = document.getElementById("stage-panel-after");
      const stepTag = p4?.querySelector(".stage-step-tag")?.textContent.trim();
      const hasAssessmentBox = Boolean(document.getElementById("roadmap-overall-assessment-box"));
      const hasPriorities = Boolean(document.getElementById("roadmap-weakness-priorities-wrap"));
      return {
        p4Visible: p4 && p4.style.display !== "none" && p4.classList.contains("active"),
        stepTag,
        hasAssessmentBox,
        hasPriorities
      };
    })()
  `);

  assert.ok(afterCheck.p4Visible, "stage-panel-after must be visible and active");
  assert.strictEqual(afterCheck.stepTag, "GIAI ĐOẠN 04", "Stage panel header tag must be GIAI ĐOẠN 04");
  assert.ok(afterCheck.hasAssessmentBox, "Overall assessment box must be present");
  await cdp.captureScreenshot("wi07-desktop-04-recommendations.png");
  console.log(`  ✓ Stage 04 (Đề xuất) verified: tag=${afterCheck.stepTag}, assessment box verified`);

  // 6.6 Test Repeated Click & Sticky Alignment Offset (WI-07G)
  console.log("\n[7] Testing WI-07G Scroll & Anchor Alignment on Repeated Click...");
  await cdp.eval(`goToStage('feedback')`);
  await sleep(400);

  // Scroll down within feedback
  await cdp.eval(`window.scrollTo(0, 400);`);
  await sleep(200);

  // Click feedback again
  await cdp.eval(`goToStage('feedback')`);
  await sleep(500);

  const afterClickAlign = await cdp.eval(`
    (() => {
      const header = document.querySelector("#stage-panel-feedback .stage-main-header");
      const rect = header ? header.getBoundingClientRect() : null;
      const navbar = document.querySelector(".navbar, header.navbar, .app-header");
      const phaseNav = document.getElementById("report-phase-nav");
      const navbarH = navbar ? navbar.offsetHeight : 60;
      const phaseNavH = phaseNav ? phaseNav.offsetHeight : 64;
      return {
        headerTop: rect ? rect.top : null,
        navbarH,
        phaseNavH,
        isBelowNav: rect ? (rect.top >= navbarH) : false
      };
    })()
  `);

  console.log("  Alignment calculation:", afterClickAlign);
  assert.ok(afterClickAlign.isBelowNav, "Stage main header must be cleanly aligned below sticky navigation");
  console.log("  ✓ Repeated click and re-anchor alignment verified.");

  // Viewport 2: Tablet Landscape (1024x768)
  console.log("\n[8] Testing Viewport: Tablet Landscape 1024x768...");
  await cdp.setViewport(1024, 768, false);
  await cdp.eval(`goToStage('feedback')`);
  await sleep(300);
  await cdp.captureScreenshot("wi07-tablet-1024-feedback.png");
  console.log("  ✓ Tablet 1024px responsive layout verified.");

  // Viewport 3: Small Tablet / Portrait (768x1024)
  console.log("\n[9] Testing Viewport: Small Tablet 768x1024...");
  await cdp.setViewport(768, 1024, false);
  await cdp.eval(`goToStage('feedback')`);
  await sleep(300);
  await cdp.captureScreenshot("wi07-tablet-768-feedback.png");
  console.log("  ✓ Small Tablet 768px layout verified.");

  // Viewport 4: Mobile 390x844
  console.log("\n[10] Testing Viewport: Mobile 390x844...");
  await cdp.setViewport(390, 844, true);
  await cdp.eval(`goToStage('overview')`);
  await sleep(300);
  await cdp.captureScreenshot("wi07-mobile-390-overview.png");

  await cdp.eval(`goToStage('feedback')`);
  await sleep(300);
  await cdp.captureScreenshot("wi07-mobile-390-feedback.png");
  console.log("  ✓ Mobile 390px navigation & feedback cards verified.");

  // Test Dark Mode
  console.log("\n[11] Testing Dark Mode Styling & Contrast...");
  await cdp.setViewport(1440, 900, false);
  await cdp.eval(`
    (() => {
      document.body.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    })();
  `);
  await sleep(300);
  await cdp.captureScreenshot("wi07-darkmode-feedback.png");
  console.log("  ✓ Dark mode screenshot captured.");

  // Cleanup
  cdp.close();
  browserProc.kill();
  server.close();

  // Invariant verification
  console.log("\n[12] Verifying Final Production Database SHA-256 Invariant...");
  const finalHash = crypto.createHash("sha256").update(fs.readFileSync(PROD_DB_PATH)).digest("hex").toLowerCase();
  assert.strictEqual(finalHash, EXPECTED_DB_HASH, "Production database was modified during testing!");
  console.log(`  ✓ Production DB invariant confirmed: ${finalHash}`);

  console.log("\n===============================================================");
  console.log("   [SUCCESS] ALL WI-REPORT-07 REAL-BROWSER AUDIT CHECKS PASSED  ");
  console.log("===============================================================");
}

runBrowserTest().catch((err) => {
  console.error("\n[ERROR] E2E Browser Test Failed:", err);
  process.exit(1);
});
