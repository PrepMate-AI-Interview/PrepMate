/**
 * PREPMATE — WI-REPORT-06 REAL BROWSER E2E VERIFICATION
 * Tests:
 * 1. 4-Stage Navigation switching (Overview -> Analysis -> Feedback -> Recommendations)
 * 2. Responsive layout across 1440px, 1024px, 768px, 390px (zero horizontal overflow)
 * 3. 4-part Question Feedback card structure and long answer expand/collapse toggle
 * 4. Overall Improvement Assessment box rendering in Stage 04
 * 5. Score wheel display without visible /100 suffix
 * 6. Production DB hash preservation
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const STATIC_PORT = 5123;
const CDP_PORT = 9248;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const EXPECTED_DB_HASH = "c2ba83b82e758b277786dad7073e1c8a0e80c71fc615ecbbe5847d01b47cda50";
const SCREENSHOT_DIR = path.join(WORKSPACE_ROOT, "tests", "e2e", "screenshots-wi06");

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function findBrowser() {
  const paths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];
  return paths.find(p => fs.existsSync(p));
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
    return new Promise((res, rej) => {
      const id = this.msgId++;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const r = await this.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(r.exceptionDetails)}`);
    }
    return r.result ? r.result.value : undefined;
  }

  async setViewport(width, height, isMobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile,
    });
  }

  async captureScreenshot(filename) {
    const r = await this.send("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(r.data, "base64");
    const fullPath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }
}

async function getJson(url) {
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

function startStaticServer() {
  const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
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
  console.log("   WI-REPORT-06: REAL BROWSER E2E VERIFICATION (EDGE / CDP)   ");
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
  const userDataDir = path.join(os.tmpdir(), `prepmate_e2e_${Date.now()}`);
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

  // Inject comprehensive mock session data for rich report rendering
  console.log("\n[5] Injecting mock interview report state...");
  await cdp.eval(`
    (() => {
      const mockSession = {
        id: "sess_test_wi06",
        targetPosition: "Senior Backend Engineer",
        targetLevel: "Senior",
        targetCompany: "Tech Global Inc",
        duration: 18,
        questionsAnswered: 3,
        date: "2026-11-01",
        score: 88,
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
          overallScore: 88,
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
            items: [
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
    })()
  `);
  await sleep(1000);

  // --------------------------------------------------------------------------
  // TEST VIEWPORTS & HORIZONTAL OVERFLOW
  // --------------------------------------------------------------------------
  console.log("\n[6] Testing responsive viewports & layout integrity...");
  const viewports = [
    { name: "Desktop 1440x900", width: 1440, height: 900, isMobile: false },
    { name: "Tablet Landscape 1024x768", width: 1024, height: 768, isMobile: false },
    { name: "Tablet Portrait 768x1024", width: 768, height: 1024, isMobile: false },
    { name: "Mobile Standard 390x844", width: 390, height: 844, isMobile: true }
  ];

  for (const vp of viewports) {
    await cdp.setViewport(vp.width, vp.height, vp.isMobile);
    await sleep(400);

    const overflowCheck = await cdp.eval(`
      (() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        const elements = document.querySelectorAll('*');
        const overflowing = [];
        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > winW + 2) {
            overflowing.push({
              tag: el.tagName,
              id: el.id,
              class: el.className,
              right: Math.round(rect.right),
              width: Math.round(rect.width)
            });
          }
        });
        return { docW, winW, hasOverflow: docW > winW, overflowing: overflowing.slice(0, 10) };
      })()
    `);
    if (overflowCheck.hasOverflow) {
      console.log('Overflowing elements on ' + vp.name + ':', JSON.stringify(overflowCheck.overflowing, null, 2));
    }

    assert.ok(
      !overflowCheck.hasOverflow,
      `Horizontal overflow detected on ${vp.name}! scrollWidth (${overflowCheck.docW}) > innerWidth (${overflowCheck.winW})`
    );
    console.log(`  ✓ ${vp.name}: Zero horizontal overflow (scrollWidth: ${overflowCheck.docW}px, innerWidth: ${overflowCheck.winW}px)`);
  }

  // Set viewport to Desktop for stage verification
  await cdp.setViewport(1440, 900, false);
  await sleep(300);

  // --------------------------------------------------------------------------
  // TEST STAGE NAVIGATION (WI-06A)
  // --------------------------------------------------------------------------
  console.log("\n[7] Testing 4-stage navigation switching & visibility...");

  // Test Stage 01: Tổng quan
  console.log("  • Switching to Giai đoạn 01 (Tổng quan)...");
  await cdp.eval(`goToStage('overview')`);
  await sleep(400);
  let activeCheck = await cdp.eval(`
    (() => {
      const p1 = document.getElementById("stage-panel-overview");
      const p2 = document.getElementById("stage-panel-during");
      const p3 = document.getElementById("stage-panel-feedback");
      const p4 = document.getElementById("stage-panel-after");
      const scoreVal = document.getElementById("hero-score-value")?.textContent?.trim();
      const scoreScale = window.getComputedStyle(document.getElementById("hero-score-scale")).display;
      return {
        p1Visible: p1 && p1.style.display !== "none" && p1.classList.contains("active"),
        p2Hidden: p2 && p2.style.display === "none",
        p3Hidden: p3 && p3.style.display === "none",
        p4Hidden: p4 && p4.style.display === "none",
        scoreVal,
        scoreScaleHidden: scoreScale === "none"
      };
    })()
  `);
  assert.ok(activeCheck.p1Visible, "stage-panel-overview must be visible and active");
  assert.ok(activeCheck.p2Hidden && activeCheck.p3Hidden && activeCheck.p4Hidden, "Other stage panels must be hidden");
  assert.ok(activeCheck.scoreScaleHidden, "hero-score-scale (/100) must be visually hidden via display:none");
  await cdp.captureScreenshot("stage-01-overview.png");
  console.log(`  ✓ Stage 01 (Tổng quan) verified: score=${activeCheck.scoreVal}, score-scale visually hidden`);

  // Test Stage 02: Phân tích
  console.log("  • Switching to Giai đoạn 02 (Phân tích)...");
  await cdp.eval(`goToStage('analysis')`);
  await sleep(400);
  activeCheck = await cdp.eval(`
    (() => {
      const p2 = document.getElementById("stage-panel-during");
      const p1 = document.getElementById("stage-panel-overview");
      const dimsCount = document.querySelectorAll("#dimensions-grid .dimension-card").length;
      const ctaBtn = document.querySelector(".analysis-to-feedback-box");
      return {
        p2Visible: p2 && p2.style.display !== "none" && p2.classList.contains("active"),
        p1Hidden: p1 && p1.style.display === "none",
        dimsCount,
        hasCta: Boolean(ctaBtn)
      };
    })()
  `);
  assert.ok(activeCheck.p2Visible, "stage-panel-during must be visible and active");
  assert.ok(activeCheck.p1Hidden, "stage-panel-overview must be hidden");
  assert.ok(activeCheck.hasCta, "CTA box pointing to Nhận xét must be present");
  await cdp.captureScreenshot("stage-02-analysis.png");
  console.log(`  ✓ Stage 02 (Phân tích) verified: ${activeCheck.dimsCount} dimensions rendered, clean CTA to Stage 03`);

  // Test Stage 03: Nhận xét
  console.log("  • Switching to Giai đoạn 03 (Nhận xét)...");
  await cdp.eval(`goToStage('feedback')`);
  await sleep(400);
  activeCheck = await cdp.eval(`
    (() => {
      const p3 = document.getElementById("stage-panel-feedback");
      const qCards = document.querySelectorAll("#question-feedback-list .qfb-card").length;
      const firstCard = document.querySelector("#qfb-card-1");
      const hasQTitle = Boolean(firstCard?.querySelector(".qfb-question-title"));
      const hasAnswer = Boolean(firstCard?.querySelector(".qfb-answer-container"));
      const hasCols = Boolean(firstCard?.querySelector(".qfb-feedback-cols"));
      const hasGuidance = Boolean(firstCard?.querySelector(".qfb-guidance-box"));
      const toggleBtn = firstCard?.querySelector(".btn-toggle-answer-text");
      return {
        p3Visible: p3 && p3.style.display !== "none" && p3.classList.contains("active"),
        qCards,
        has4Parts: hasQTitle && hasAnswer && hasCols && hasGuidance,
        hasLongToggle: Boolean(toggleBtn)
      };
    })()
  `);
  assert.ok(activeCheck.p3Visible, "stage-panel-feedback must be visible and active");
  assert.ok(activeCheck.qCards >= 3, `Expected at least 3 question cards, got ${activeCheck.qCards}`);
  assert.ok(activeCheck.has4Parts, "Question card must implement 4-part structure (Câu hỏi, Câu trả lời, Nhận xét, Hướng cải thiện)");
  assert.ok(activeCheck.hasLongToggle, "Long answer must offer expand/collapse toggle");

  // Test expanding long answer in card 1
  const toggleResult = await cdp.eval(`
    (() => {
      const btn = document.querySelector("#btn-toggle-answer-1");
      if (btn) btn.click();
      const fullEl = document.querySelector("#qfb-answer-full-1");
      return {
        expanded: fullEl && !fullEl.classList.contains("hidden")
      };
    })()
  `);
  assert.ok(toggleResult.expanded, "Long answer must expand upon toggle click");
  await cdp.captureScreenshot("stage-03-feedback.png");
  console.log(`  ✓ Stage 03 (Nhận xét) verified: ${activeCheck.qCards} question cards with 4-part structure & answer toggle`);

  // Test Stage 04: Đề xuất
  console.log("  • Switching to Giai đoạn 04 (Đề xuất)...");
  await cdp.eval(`goToStage('recommendations')`);
  await sleep(400);
  activeCheck = await cdp.eval(`
    (() => {
      const p4 = document.getElementById("stage-panel-after");
      const assessBox = document.getElementById("roadmap-overall-assessment-box");
      const prioritiesList = document.getElementById("roadmap-weakness-priorities-list");
      return {
        p4Visible: p4 && p4.style.display !== "none" && p4.classList.contains("active"),
        hasAssessmentBox: Boolean(assessBox),
        hasPrioritiesList: Boolean(prioritiesList)
      };
    })()
  `);
  assert.ok(activeCheck.p4Visible, "stage-panel-after must be visible and active");
  assert.ok(activeCheck.hasAssessmentBox, "Overall Improvement Assessment box must be present in Stage 04");
  assert.ok(activeCheck.hasPrioritiesList, "Weakness priorities list must be present in Stage 04");
  await cdp.captureScreenshot("stage-04-recommendations.png");
  console.log("  ✓ Stage 04 (Đề xuất) verified: Substantive Overall Improvement Assessment box & priorities list rendered");

  // Cleanup
  console.log("\n[8] Teardown & cleanup...");
  try {
    browserProc.kill();
  } catch (e) {}
  server.close();
  console.log("  ✓ Browser and server cleanly closed.");

  // Final Invariant Check
  const finalHash = crypto.createHash("sha256").update(fs.readFileSync(PROD_DB_PATH)).digest("hex").toLowerCase();
  assert.strictEqual(finalHash, EXPECTED_DB_HASH, "Production database must remain strictly unmodified!");
  console.log(`[9] Final DB Invariant Verified: ${finalHash}`);

  console.log("\n===============================================================");
  console.log("   ALL WI-REPORT-06 REAL BROWSER E2E CHECKS PASSED CLEANLY   ");
  console.log("===============================================================\n");
}

runBrowserTest().catch((err) => {
  console.error("\n[E2E ERROR]:", err);
  process.exit(1);
});
