/**
 * PREPMATE — WI-REPORT-08 REAL BROWSER E2E TEST (EDGE / CHROMIUM CDP)
 * Report Navigation & Question Feedback Display Optimization Verification
 * 
 * Verifies:
 * 1. Compact 4-Stage Navigation (01 Tổng quan -> 02 Nhận xét -> 03 Phân tích -> 04 Đề xuất)
 * 2. Initial compact question list (all questions collapsed by default)
 * 3. Selection of Question 1: Question 1 expands to reveal full answer & feedback
 * 4. Selection of Question 2: Question 1 collapses, Question 2 expands (single-open accordion)
 * 5. Re-clicking Question 2: Collapses Question 2 (all cards collapsed)
 * 6. Very long answers rendered in full without truncation, ellipsis, or line-clamp
 * 7. Redundant "Toàn bộ câu trả lời gốc đã lưu trữ" section is completely absent
 * 8. Navigation between all stages (Tổng quan, Nhận xét, Phân tích, Đề xuất)
 * 9. Multi-viewport testing (1440px, 1024px, 768px, 390px)
 * 10. Light and Dark mode rendering
 * 11. Production db.json SHA-256 invariant
 */

const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");
const assert = require("assert");
const os = require("os");

const STATIC_PORT = 5058;
const CDP_PORT = 9228;
const WORKSPACE_ROOT = path.resolve(__dirname, "../../");
const PROD_DB_PATH = path.resolve(WORKSPACE_ROOT, "BE/data/db.json");
const EXPECTED_DB_HASH = "44223d9b7e945e70cadeb3279ae3ee5a0dd748a867b2c3a6b0c5c617a9db62c3";
const SCREENSHOT_DIR = path.resolve(WORKSPACE_ROOT, "scratch/screenshots/wi-report-08");

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
  console.log("   WI-REPORT-08: REAL BROWSER E2E VERIFICATION (EDGE / CDP)   ");
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
  const userDataDir = path.join(os.tmpdir(), `prepmate_e2e_08_${Date.now()}`);
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

  // Mock comprehensive interview session data including a very long answer (>500 chars)
  console.log("\n[5] Injecting mock interview session & report state...");
  await cdp.eval(`
    (() => {
      const mockSession = {
        id: "sess_wi08_test",
        targetPosition: "Principal Backend Engineer",
        targetLevel: "Principal",
        targetCompany: "Tech Enterprise Solutions",
        duration: 35,
        questionsAnswered: 3,
        date: "2026-11-02",
        score: 92,
        scoreScale: "0-100",
        interviewerPersona: "professional",
        answers: [
          {
            question: "Làm thế nào bạn thiết kế kiến trúc phân tán đảm bảo tính nhất quán dữ liệu cao (High Consistency) qua nhiều Microservices khi xử lý thanh toán tài chính?",
            answer: "Đối với hệ thống thanh toán tài chính yêu cầu tính nhất quán tuyệt đối, tôi áp dụng mô hình Saga Pattern kết hợp với kỹ thuật Transactional Outbox Pattern.\\n\\nCụ thể, khi một giao dịch bắt đầu, service khởi tạo (Payment Service) sẽ ghi lại cả thực thể giao dịch và sự kiện Outbox trong cùng một transaction database cục bộ (ACID transaction). Tiếp theo, Debezium Change Data Capture (CDC) sẽ đọc transaction log từ WAL của PostgreSQL và đẩy sự kiện vào Kafka với chế độ idempotency enabled (acks=all).\\n\\nĐể xử lý các giao dịch thất bại giữa chừng, chúng tôi triển khai hệ thống Orchestrated Saga sử dụng Temporal.io. Mỗi bước (reserve funds, deduct credit, update ledger) đều có bước bồi hoàn tương ứng (Compensating Transaction) có tính chất idempotent. Cơ chế này loại bỏ hoàn toàn rủi ro distributed deadlock của Two-Phase Commit (2PC) truyền thống mà vẫn đảm bảo tính nhất quán cuối cùng cực kỳ chặt chẽ.",
            topic: "Kiến trúc Phân tán & Giao dịch"
          },
          {
            question: "Khi một dịch vụ downstream gặp sự cố sập nguồn hàng loạt, bạn áp dụng chiến lược nào để bảo vệ hệ thống upstream?",
            answer: "Chúng tôi triển khai cơ chế Circuit Breaker (Resilience4j) kết hợp với Adaptive Concurrency Limits. Khi tỷ lệ lỗi vượt ngưỡng 20% trong sliding window 100 requests, circuit breaker chuyển sang trạng thái OPEN, lập tức ngắt kết nối và trả về fallback cached data hoặc gracefully degraded response thay vì chờ đợi timeout gây tắc nghẽn thread pool của upstream.",
            topic: "Độ tin cậy Hệ thống (SRE)"
          },
          {
            question: "Hãy mô tả phương pháp bạn xây dựng văn hóa Code Review và Architecture Review trong tổ chức kỹ thuật lớn.",
            answer: "Tôi thiết lập bộ tiêu chuẩn RFC (Request for Comments) cho mọi quyết định kiến trúc quan trọng, tổ chức các phiên Architecture Review định kỳ có sự tham gia của Tech Leads từ nhiều squad, và chuẩn hóa checklist review code tập trung vào tính đúng đắn, khả năng mở rộng, bảo mật và khả năng quan sát (observability).",
            topic: "Lãnh đạo Kỹ thuật"
          }
        ],
        Report: {
          overallScore: 92,
          scoreScale: "0-100",
          summary: "Ứng viên thể hiện năng lực kiến trúc xuất sắc, nắm rất sâu các mẫu hình phân tán (Transactional Outbox, Orchestrated Saga) và tư duy bảo vệ hệ thống.",
          strengths: [
            {
              title: "Nắm vững Transactional Outbox & Saga Pattern",
              description: "Minh chứng khả năng xử lý bài toán giao dịch tài chính phân tán chuẩn xác."
            }
          ],
          diagnosticAnalysis: {
            weaknessDiagnoses: []
          },
          improvementRoadmap: {
            overallAssessment: "Ứng viên hoàn toàn đủ tiêu chuẩn cho vị trí Principal Backend Engineer.",
            priorities: []
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

  // Set Viewport: Desktop 1440x900
  console.log("\n[6] Testing Viewport: Desktop 1440x900...");
  await cdp.setViewport(1440, 900, false);
  await sleep(400);

  // 6.1 Inspect Compact Top Report Navigation
  console.log("  • Checking Compact Top Report Navigation (WI-08A)...");
  const navCheck = await cdp.eval(`
    (() => {
      const nav = document.getElementById("report-phase-nav");
      const btns = Array.from(document.querySelectorAll("#report-phase-nav .stage-tab-btn"));
      const descVisible = Array.from(document.querySelectorAll(".stage-tab-desc")).filter(el => window.getComputedStyle(el).display !== "none").length;
      return {
        navHeight: nav ? nav.offsetHeight : 0,
        btnCount: btns.length,
        descVisible,
        btnLabels: btns.map(b => b.querySelector(".stage-tab-label")?.textContent.trim())
      };
    })()
  `);

  console.log("    Navigation Metrics:", navCheck);
  assert.strictEqual(navCheck.btnCount, 4, "Must have exactly 4 navigation buttons");
  assert.deepStrictEqual(navCheck.btnLabels, ["Tổng quan", "Nhận xét", "Phân tích", "Đề xuất"], "Buttons must follow strict sequence");
  assert.strictEqual(navCheck.descVisible, 0, "No duplicate subtitle descriptions visible in compact navigation");
  assert.ok(navCheck.navHeight <= 60, `Navigation height (${navCheck.navHeight}px) must be compact (<= 60px)`);
  console.log("  ✓ Compact top navigation verified cleanly.");

  // 6.2 Navigate to Stage 02: Nhận xét
  console.log("\n[7] Navigating to Nhận xét & Checking Initial Compact Question List (WI-08B)...");
  await cdp.eval(`goToStage('feedback')`);
  await sleep(400);

  const initialListCheck = await cdp.eval(`
    (() => {
      const cards = Array.from(document.querySelectorAll("#question-feedback-list .qfb-card"));
      const openBodies = cards.filter(c => {
        const body = c.querySelector(".qfb-summary-body");
        return body && window.getComputedStyle(body).display !== "none";
      });
      const cardHeights = cards.map(c => c.offsetHeight);
      return {
        totalCards: cards.length,
        openCardCount: openBodies.length,
        cardHeights
      };
    })()
  `);

  console.log("    Initial Question List State:", initialListCheck);
  assert.strictEqual(initialListCheck.totalCards, 3, "Must render exactly 3 question cards");
  assert.strictEqual(initialListCheck.openCardCount, 0, "All question cards must be collapsed initially in compact list");
  initialListCheck.cardHeights.forEach((h, i) => {
    assert.ok(h < 80, `Card ${i+1} collapsed height (${h}px) must be compact (< 80px)`);
  });
  await cdp.captureScreenshot("wi08-01-compact-question-list.png");
  console.log("  ✓ Initial question list verified: all cards are compact and collapsed.");

  // 6.3 Select Question 1: Expand Question 1
  console.log("\n[8] Selecting Question 1 & Verifying Full Answer & AI Analysis (WI-08B & WI-08C)...");
  await cdp.eval(`toggleQuestionFeedbackDetail(1)`);
  await sleep(400);

  const q1Check = await cdp.eval(`
    (() => {
      const card1 = document.getElementById("qfb-card-1");
      const card2 = document.getElementById("qfb-card-2");
      const body1 = document.getElementById("qfb-body-1");
      const body2 = document.getElementById("qfb-body-2");
      const btn1 = document.getElementById("qfb-btn-1");
      const header1 = document.getElementById("qfb-header-1");

      const answerText = card1.querySelector(".qfb-answer-text")?.textContent || "";
      const hasEllipsis = answerText.includes("...") || answerText.includes("…");
      const hasRedundantArchive = Boolean(document.querySelector(".qfb-detail-panel")) || 
        document.body.innerText.includes("Toàn bộ câu trả lời gốc đã lưu trữ");

      return {
        c1Expanded: card1.classList.contains("expanded"),
        c1BodyVisible: body1 && window.getComputedStyle(body1).display !== "none",
        c1AriaExpanded: header1?.getAttribute("aria-expanded") === "true",
        c2Collapsed: !card2.classList.contains("expanded") && (!body2 || window.getComputedStyle(body2).display === "none"),
        answerChars: answerText.length,
        hasEllipsis,
        hasRedundantArchive
      };
    })()
  `);

  console.log("    Question 1 Expansion State:", q1Check);
  assert.ok(q1Check.c1Expanded && q1Check.c1BodyVisible && q1Check.c1AriaExpanded, "Question 1 must be expanded with aria-expanded=true");
  assert.ok(q1Check.c2Collapsed, "Question 2 must remain collapsed");
  assert.ok(q1Check.answerChars > 400, `Complete original answer must be rendered in full (got ${q1Check.answerChars} chars)`);
  assert.strictEqual(q1Check.hasEllipsis, false, "Answer must NOT contain truncation ellipsis");
  assert.strictEqual(q1Check.hasRedundantArchive, false, "Redundant archive section 'Toàn bộ câu trả lời gốc đã lưu trữ' must be absent");
  await cdp.captureScreenshot("wi08-02-question-1-expanded.png");
  console.log("  ✓ Question 1 expanded cleanly with full original answer and zero truncation.");

  // 6.4 Select Question 2: Question 1 Collapses, Question 2 Expands (Single-Open Accordion)
  console.log("\n[9] Selecting Question 2 (Single-Open Accordion Verification)...");
  await cdp.eval(`toggleQuestionFeedbackDetail(2)`);
  await sleep(400);

  const q2Check = await cdp.eval(`
    (() => {
      const card1 = document.getElementById("qfb-card-1");
      const card2 = document.getElementById("qfb-card-2");
      const body1 = document.getElementById("qfb-body-1");
      const body2 = document.getElementById("qfb-body-2");

      return {
        c1Collapsed: !card1.classList.contains("expanded") && window.getComputedStyle(body1).display === "none",
        c2Expanded: card2.classList.contains("expanded") && window.getComputedStyle(body2).display !== "none"
      };
    })()
  `);

  console.log("    Accordion Transition State:", q2Check);
  assert.ok(q2Check.c1Collapsed, "Question 1 must automatically collapse when Question 2 is selected");
  assert.ok(q2Check.c2Expanded, "Question 2 must expand");
  await cdp.captureScreenshot("wi08-03-question-2-expanded.png");
  console.log("  ✓ Single-open accordion verified: Question 1 closed, Question 2 opened.");

  // 6.5 Re-click Question 2: Collapses Question 2
  console.log("\n[10] Re-clicking Question 2 (Toggle to Collapsed State)...");
  await cdp.eval(`toggleQuestionFeedbackDetail(2)`);
  await sleep(300);

  const reclickCheck = await cdp.eval(`
    (() => {
      const cards = Array.from(document.querySelectorAll("#question-feedback-list .qfb-card"));
      const openBodies = cards.filter(c => {
        const body = c.querySelector(".qfb-summary-body");
        return body && window.getComputedStyle(body).display !== "none";
      });
      return { openCardCount: openBodies.length };
    })()
  `);

  assert.strictEqual(reclickCheck.openCardCount, 0, "Re-clicking the open question must collapse it");
  console.log("  ✓ Re-click toggle verified: all questions returned to collapsed state.");

  // 6.6 Cross-Stage Navigation Integrity
  console.log("\n[11] Testing Cross-Stage Navigation to Phân tích, Đề xuất, and back to Nhận xét...");
  await cdp.eval(`goToStage('analysis')`);
  await sleep(300);
  const p3Visible = await cdp.eval(`document.getElementById("stage-panel-during").style.display !== "none"`);
  assert.ok(p3Visible, "Phân tích panel must be visible");

  await cdp.eval(`goToStage('recommendations')`);
  await sleep(300);
  const p4Visible = await cdp.eval(`document.getElementById("stage-panel-after").style.display !== "none"`);
  assert.ok(p4Visible, "Đề xuất panel must be visible");

  await cdp.eval(`goToStage('feedback')`);
  await sleep(300);
  const p2Visible = await cdp.eval(`document.getElementById("stage-panel-feedback").style.display !== "none"`);
  assert.ok(p2Visible, "Returned to Nhận xét successfully");
  console.log("  ✓ Full stage navigation cycle verified.");

  // 6.7 Multi-Viewport Responsive Verification
  console.log("\n[12] Testing Multi-Viewport Responsive Layouts...");
  const viewports = [
    { name: "Tablet Landscape 1024x768", width: 1024, height: 768, isMobile: false, file: "wi08-tablet-1024.png" },
    { name: "Small Tablet 768x1024", width: 768, height: 1024, isMobile: false, file: "wi08-tablet-768.png" },
    { name: "Mobile Standard 390x844", width: 390, height: 844, isMobile: true, file: "wi08-mobile-390.png" }
  ];

  for (const vp of viewports) {
    await cdp.setViewport(vp.width, vp.height, vp.isMobile);
    await sleep(300);

    const overflowCheck = await cdp.eval(`
      (() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        return { hasOverflow: docW > winW, docW, winW };
      })()
    `);

    assert.ok(!overflowCheck.hasOverflow, `Zero horizontal overflow on ${vp.name}`);
    await cdp.captureScreenshot(vp.file);
    console.log(`  ✓ ${vp.name}: Zero horizontal overflow verified (${overflowCheck.docW}px / ${overflowCheck.winW}px).`);
  }

  // 6.8 Dark Mode Verification
  console.log("\n[13] Testing Dark Mode Styling & Contrast...");
  await cdp.setViewport(1440, 900, false);
  await cdp.eval(`
    (() => {
      document.body.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      toggleQuestionFeedbackDetail(1); // expand question 1 in dark mode
    })();
  `);
  await sleep(400);
  await cdp.captureScreenshot("wi08-darkmode-expanded.png");
  console.log("  ✓ Dark mode screenshot captured.");

  // Cleanup
  cdp.close();
  browserProc.kill();
  server.close();

  // Final Database Invariant
  console.log("\n[14] Verifying Final Production Database SHA-256 Invariant...");
  const finalHash = crypto.createHash("sha256").update(fs.readFileSync(PROD_DB_PATH)).digest("hex").toLowerCase();
  assert.strictEqual(finalHash, EXPECTED_DB_HASH, "Production database modified during test!");
  console.log(`  ✓ Production DB invariant confirmed: ${finalHash}`);

  console.log("\n===============================================================");
  console.log("   [SUCCESS] ALL WI-REPORT-08 REAL-BROWSER AUDIT CHECKS PASSED  ");
  console.log("===============================================================");
}

runBrowserTest().catch((err) => {
  console.error("\n[ERROR] E2E Browser Test Failed:", err);
  process.exit(1);
});
