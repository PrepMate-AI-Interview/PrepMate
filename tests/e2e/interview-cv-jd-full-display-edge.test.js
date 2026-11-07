/**
 * PREPMATE — WI-CV-JD-FULL-DISPLAY-UX-01: Live Browser E2E Acceptance Suite
 * Validates 100% full content display for authenticated accounts:
 * - Expandable summary toggle (Xem thêm / Thu gọn)
 * - CV Experience overview section
 * - JD Responsibilities list & Meta section
 * - 0% data omission (no slice limits on skills, strengths, gaps, actions)
 * - Independent expand/collapse states
 * - Strict guest teaser boundary enforcement
 * - Multi-viewport responsiveness (1440, 1280, 768, 390, 375px) with 0px overflow
 * - Production database integrity verification
 */

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const assert = require("assert");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_PORT = 5009;
const CDP_PORT = 9244;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const EVIDENCE_DIR = path.join(WORKSPACE_ROOT, "docs", "evidence", "cv-jd-display");
const ARTIFACT_DIR = path.join(process.env.USERPROFILE || "", ".gemini", "antigravity", "brain", "f610d5b5-1bc7-401f-b150-db10fc554d9f", "evidence-cv-jd-display");
const TEST_DIR = path.join(os.tmpdir(), `prepmate_full_display_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, "isolated_test_db.json");
const TEST_KEYRING_PATH = path.join(TEST_DIR, "test_keys");

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
        Accept: "application/json",
        "Content-Type": "application/json",
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
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
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
            const cb = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) cb.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else cb.resolve(msg.result);
          }
        } catch (e) {
          console.error("[CDP Parse error]", e);
        }
      });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.callbacks.set(id, { resolve, reject });
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
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async setViewport(width, height) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
  }

  async captureScreenshot(filepath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, Buffer.from(res.data, "base64"));
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) { }
    }
  }
}

async function startIsolatedBackend() {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });

  const fixturePath = path.join(WORKSPACE_ROOT, "tests", "fixtures", "test_db_fixture.json");
  if (fs.existsSync(fixturePath)) {
    fs.copyFileSync(fixturePath, TEST_DB_PATH);
  } else {
    fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);
  }

  const env = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: "Development",
    ASPNETCORE_URLS: `http://127.0.0.1:${BACKEND_PORT}`,
    DATABASE_FILE_PATH: TEST_DB_PATH,
    DATABASE__FILEPATH: TEST_DB_PATH,
    JWT__SECRET: "test_jwt_secret_key_minimum_32_characters_for_testing!!",
    GUEST_TOKEN__SIGNING_KEY: "test_guest_token_key_minimum_32_characters_for_testing!!",
    KEYRING_DIR: TEST_KEYRING_PATH,
  };

  const beProcess = spawn("dotnet", ["run", "--no-launch-profile", "--no-build", "--project", path.join(WORKSPACE_ROOT, "BE", "backend.csproj")], {
    env,
    cwd: path.join(WORKSPACE_ROOT, "BE"),
    stdio: ["ignore", "pipe", "pipe"],
  });

  beProcess.stderr.on("data", (d) => {
    const str = d.toString();
    if (str.includes("fail") || str.includes("Error")) console.error(`[BACKEND ERROR] ${str.trim()}`);
  });

  console.log(`[SETUP] Launching isolated Backend on port ${BACKEND_PORT}...`);
  let isUp = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      const res = await requestJsonOnce(`${BASE_URL}/api/health`);
      if (res.status === 200) {
        isUp = true;
        break;
      }
    } catch (e) { }
  }

  if (!isUp) {
    beProcess.kill("SIGKILL");
    throw new Error(`Isolated Backend failed to start on port ${BACKEND_PORT}`);
  }
  console.log("  [PASS] Isolated Backend is UP & HEALTHY.\n");
  return beProcess;
}

async function main() {
  console.log("==================================================================");
  console.log("  PREPMATE — WI-CV-JD-FULL-DISPLAY-UX-01: Full Display E2E Suite  ");
  console.log("==================================================================\n");

  const initialProdHash = computeHash(PROD_DB_PATH);
  console.log(`[INIT] Production db.json initial SHA-256:\n       ${initialProdHash}\n`);

  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  let beProcess = null;
  let browserProcess = null;
  let cdp = null;

  try {
    beProcess = await startIsolatedBackend();

    // 1. Launch Browser
    const browserExe = findBrowserExecutable();
    assert(browserExe, "Microsoft Edge / Chrome executable not found");

    const userDataDir = path.join(os.tmpdir(), `prepmate_edge_full_disp_${Date.now()}`);
    console.log(`[SETUP] Launching Edge browser on CDP port ${CDP_PORT}...`);
    browserProcess = spawn(browserExe, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--headless=new",
      "--disable-gpu",
      "about:blank",
    ]);

    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const json = await requestJsonOnce(`http://127.0.0.1:${CDP_PORT}/json`);
        if (Array.isArray(json.data)) {
          const pageTarget = json.data.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
          if (pageTarget) {
            wsUrl = pageTarget.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (e) { }
    }
    assert(wsUrl, "Could not discover CDP WebSocket URL");
    console.log("  [PASS] Edge browser launched.\n");

    cdp = new CDPClient(wsUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Runtime.enable");

    // 2. Obtain Candidate Auth Token
    console.log("[AUTH] Logging in candidate 'nam.le@gmail.com'...");
    const loginRes = await requestJsonOnce(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { email: "nam.le@gmail.com", password: "user123" });
    assert(loginRes.status === 200 && loginRes.data && loginRes.data.token, "Candidate login must succeed");
    const candToken = loginRes.data.token;
    console.log("  [PASS] Candidate login successful, JWT acquired.\n");

    // 3. Navigate to interview-info.html
    const targetUrl = `${BASE_URL}/features/interview/interview-info.html`;
    console.log(`[NAV] Navigating to: ${targetUrl}`);
    await cdp.send("Page.navigate", { url: targetUrl });
    await sleep(2000);

    // Set authenticated state in browser session
    await cdp.eval(`(() => {
      localStorage.setItem('prepmate_auth_token', ${JSON.stringify(candToken)});
      localStorage.setItem('prepmate_current_user', JSON.stringify({
        id: 'user_001',
        fullname: 'Lê Hoàng Nam',
        token: ${JSON.stringify(candToken)}
      }));
    })()`);

    // Verify session helper
    const isAuthedInBrowser = await cdp.eval(`isSessionAuthenticated()`);
    assert.strictEqual(isAuthedInBrowser, true, "isSessionAuthenticated() must return true for logged-in user");
    console.log("  [PASS] Browser session is authenticated via getActiveAuthToken().\n");

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO A: AUTHENTICATED CV ANALYSIS FULL DISPLAY & EXPANDABLE
    // ─────────────────────────────────────────────────────────────────
    console.log("--- SCENARIO A: Authenticated CV Analysis Full Display & Expandable Details ---");

    const fullCvAnalysisData = {
      summary: "Kỹ sư Phần mềm Cấp cao (Senior Software Engineer) với hơn 6 năm kinh nghiệm chuyên sâu trong việc kiến trúc, phát triển và tối ưu hóa hệ thống backend phân tán quy mô lớn. Có nền tảng vững chắc về kiến trúc vi dịch vụ (Microservices), cơ sở dữ liệu phân tán có khả năng chịu lỗi cao và đường ống dữ liệu thời gian thực. Đã từng dẫn dắt kỹ thuật cho nhiều sản phẩm tài chính phục vụ hàng triệu người dùng hoạt động mỗi ngày với độ sẵn sàng đạt 99.99%.",
      keySkills: ["Java", "Spring Boot", "Kafka", "PostgreSQL", "Redis", "Docker", "Kubernetes", "AWS Cloud", "System Design", "CI/CD"],
      experience: "Từ năm 2020 đến nay: Lead Backend Engineer tại Tập đoàn Tài chính Công nghệ ABC. Thiết kế và vận hành hệ thống thanh toán xử lý 25,000 giao dịch/giây với độ trễ p99 dưới 40ms. Áp dụng cơ chế event-driven streaming qua Apache Kafka, phân vùng cơ sở dữ liệu PostgreSQL và cache Redis đa tầng. Giai đoạn 2018-2020: Backend Engineer tại Công ty Giải pháp Phần mềm XYZ, phụ trách xây dựng RESTful APIs và module tích hợp cổng thanh toán.",
      suitability: 92,
      strengths: [
        "Nền tảng kiến trúc backend và microservices xuất sắc với các chứng chỉ chuyên môn và dự án thực chiến quy mô lớn.",
        "Kinh nghiệm dày dạn trong tối ưu hóa truy vấn cơ sở dữ liệu và xây dựng hệ thống chịu tải cao.",
        "Năng lực lãnh đạo kỹ thuật và định hướng kiến trúc rõ ràng cho các thành viên trong đội ngũ kỹ thuật.",
        "Khả năng phối hợp liên chức năng hiệu quả giữa Product, DevOps và Security."
      ],
      gaps: [
        "Cần chuẩn bị kỹ hơn về các kịch bản đối phó sự cố phân vùng mạng (network partition) và dữ liệu không nhất quán.",
        "Nên bổ sung số liệu định lượng về chi phí hạ tầng cloud đã tối ưu hóa được trong các dự án gần nhất.",
        "Cần làm rõ phương pháp giải quyết mâu thuẫn kỹ thuật giữa các team trong quá trình tái cấu trúc hệ thống."
      ],
      actionItems: [
        { level: "high", label: "Ưu tiên Cao", text: "Hệ thống hóa lại các số liệu hiệu năng (TPS, latency, cloud cost) của hệ thống thanh toán." },
        { level: "high", label: "Ưu tiên Cao", text: "Chuẩn bị dẫn chứng xử lý sự cố rủi ro theo phương pháp STAR cho 2 tình huống phức tạp nhất." },
        { level: "medium", label: "Ưu tiên Vừa", text: "Rà soát lại các câu hỏi chuyên sâu về CAP Theorem và cơ chế đồng thuận phân tán." },
        { level: "low", label: "Ưu tiên Thấp", text: "Chuẩn bị 3 câu hỏi chiến lược dành cho Ban Giám đốc Công nghệ về lộ trình phát triển sản phẩm." }
      ]
    };

    // Render CV Analysis in browser
    await cdp.eval(`renderCvAnalysis(${JSON.stringify(fullCvAnalysisData)}, 'Senior Software Engineer')`);
    await sleep(500);

    // Verify CV Analysis DOM
    const cvDom = await cdp.eval(`(() => {
      const panel = document.getElementById('cv-analysis-panel');
      const isVisible = panel && !panel.classList.contains('hidden');
      const summaryText = document.getElementById('cv-analysis-summary')?.innerText || '';
      const summaryClamped = document.getElementById('cv-analysis-summary')?.classList.contains('is-clamped');
      const btnExpandSummary = document.getElementById('btn-expand-cv-summary');
      const btnSummaryVisible = btnExpandSummary && !btnExpandSummary.classList.contains('hidden') && btnExpandSummary.style.display !== 'none';
      const btnSummaryText = btnExpandSummary?.innerText.trim();
      const btnSummaryAria = btnExpandSummary?.getAttribute('aria-expanded');

      const skills = Array.from(document.querySelectorAll('#cv-key-skills .skill-tag')).map(el => el.innerText.trim());
      const hasGatedSkillTag = skills.some(s => s.includes('Mở khóa'));

      const expContainer = document.getElementById('cv-experience-container');
      const expVisible = expContainer && !expContainer.classList.contains('hidden') && expContainer.style.display !== 'none';
      const expText = document.getElementById('cv-experience-text')?.innerText || '';
      const expClamped = document.getElementById('cv-experience-text')?.classList.contains('is-clamped');
      const btnExpandExp = document.getElementById('btn-expand-cv-experience');
      const btnExpVisible = btnExpandExp && !btnExpandExp.classList.contains('hidden') && btnExpandExp.style.display !== 'none';

      const strengths = Array.from(document.querySelectorAll('#cv-strengths-list li')).map(el => el.innerText.trim());
      const gaps = Array.from(document.querySelectorAll('#cv-gaps-list li')).map(el => el.innerText.trim());
      const actions = Array.from(document.querySelectorAll('#cv-action-items-list li')).map(el => el.innerText.trim());
      const badgeText = document.getElementById('cv-analysis-suitability')?.innerText || '';

      return {
        isVisible,
        summaryText,
        summaryClamped,
        btnSummaryVisible,
        btnSummaryText,
        btnSummaryAria,
        skills,
        hasGatedSkillTag,
        expVisible,
        expText,
        expClamped,
        btnExpVisible,
        strengths,
        gaps,
        actions,
        badgeText
      };
    })()`);

    assert(cvDom.isVisible, "CV analysis panel must be visible");
    assert.strictEqual(cvDom.badgeText, "Độ phù hợp sơ bộ: 92%");
    assert(cvDom.summaryText.length > 200, "Full summary text must be present");
    assert.strictEqual(cvDom.summaryClamped, true, "Long summary must be initially clamped with .is-clamped");
    assert.strictEqual(cvDom.btnSummaryVisible, true, "Expand button for CV summary must be visible");
    assert.strictEqual(cvDom.btnSummaryText, "Xem thêm", "Button text must be 'Xem thêm'");
    assert.strictEqual(cvDom.btnSummaryAria, "false", "aria-expanded must be false initially");

    // Verify 100% of skills are rendered (10 skills, no slice)
    assert.strictEqual(cvDom.skills.length, 10, `All 10 skills must be rendered, got ${cvDom.skills.length}`);
    assert.strictEqual(cvDom.hasGatedSkillTag, false, "Gated '+ Mở khóa' tag must NOT appear for authenticated user");

    // Verify Experience section
    assert.strictEqual(cvDom.expVisible, true, "CV Experience container must be visible");
    assert(cvDom.expText.includes("Lead Backend Engineer"), "CV Experience text must be rendered");
    assert.strictEqual(cvDom.expClamped, true, "Long experience text must be initially clamped");
    assert.strictEqual(cvDom.btnExpVisible, true, "Expand button for CV experience must be visible");

    // Verify 100% of strengths, gaps, actions rendered (no slice(0, 3))
    assert.strictEqual(cvDom.strengths.length, 4, `All 4 strengths must be rendered, got ${cvDom.strengths.length}`);
    assert.strictEqual(cvDom.gaps.length, 3, `All 3 gaps must be rendered, got ${cvDom.gaps.length}`);
    assert.strictEqual(cvDom.actions.length, 4, `All 4 action items must be rendered, got ${cvDom.actions.length}`);
    console.log("  [PASS] Authenticated CV Analysis renders 100% data: 10 skills, 4 strengths, 3 gaps, 4 actions.");

    // Toggle Expand CV Summary
    await cdp.eval(`document.getElementById('btn-expand-cv-summary').click()`);
    await sleep(200);

    const cvSummaryExpanded = await cdp.eval(`(() => {
      const summary = document.getElementById('cv-analysis-summary');
      const btn = document.getElementById('btn-expand-cv-summary');
      return {
        isExpandedClass: summary.classList.contains('is-expanded'),
        isClampedClass: summary.classList.contains('is-clamped'),
        btnText: btn.innerText.trim(),
        ariaExpanded: btn.getAttribute('aria-expanded')
      };
    })()`);

    assert.strictEqual(cvSummaryExpanded.isExpandedClass, true, "Summary must have .is-expanded class after clicking Xem thêm");
    assert.strictEqual(cvSummaryExpanded.isClampedClass, false, "Summary must not have .is-clamped class");
    assert.strictEqual(cvSummaryExpanded.btnText, "Thu gọn", "Button text must toggle to 'Thu gọn'");
    assert.strictEqual(cvSummaryExpanded.ariaExpanded, "true", "aria-expanded must be true");
    console.log("  [PASS] Clicking 'Xem thêm' on CV summary expands text and switches button to 'Thu gọn'.");

    // Toggle Collapse CV Summary back
    await cdp.eval(`document.getElementById('btn-expand-cv-summary').click()`);
    await sleep(200);

    const cvSummaryCollapsed = await cdp.eval(`(() => {
      const summary = document.getElementById('cv-analysis-summary');
      const btn = document.getElementById('btn-expand-cv-summary');
      return {
        isExpandedClass: summary.classList.contains('is-expanded'),
        isClampedClass: summary.classList.contains('is-clamped'),
        btnText: btn.innerText.trim(),
        ariaExpanded: btn.getAttribute('aria-expanded')
      };
    })()`);

    assert.strictEqual(cvSummaryCollapsed.isClampedClass, true, "Summary must collapse back to .is-clamped");
    assert.strictEqual(cvSummaryCollapsed.btnText, "Xem thêm", "Button text must return to 'Xem thêm'");
    assert.strictEqual(cvSummaryCollapsed.ariaExpanded, "false", "aria-expanded must return to false");
    console.log("  [PASS] Clicking 'Thu gọn' collapses CV summary back cleanly.\n");

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO B: AUTHENTICATED JD ANALYSIS FULL DISPLAY & EXPANDABLE
    // ─────────────────────────────────────────────────────────────────
    console.log("--- SCENARIO B: Authenticated JD Analysis Full Display & Expandable Details ---");

    const fullJdAnalysisData = {
      targetRole: "Kỹ sư Trưởng Hạ tầng Dữ liệu (Principal Data Platform Engineer)",
      summary: "Doanh nghiệp công nghệ tài chính hàng đầu khu vực tìm kiếm Kỹ sư Trưởng Hạ tầng Dữ liệu nhằm định hình và dẫn dắt chiến lược kiến trúc hồ dữ liệu (Data Lakehouse) thế hệ mới. Ứng viên chịu trách nhiệm trực tiếp trong việc xây dựng hệ sinh thái dữ liệu mở rộng có khả năng xử lý hàng chục Terabyte dữ liệu mỗi ngày, đảm bảo tính toàn vẹn dữ liệu tài chính khắt khe, tuân thủ các quy chuẩn bảo mật quốc tế và cung cấp năng lực phân tích thời gian thực cho hơn 200 chuyên viên phân tích dữ liệu trên toàn hệ thống.",
      keySkills: ["Apache Spark", "Delta Lake", "Trino / Presto", "Apache Kafka", "dbt", "Airflow", "Terraform", "AWS / Kubernetes", "Data Governance"],
      responsibilities: [
        "Chủ trì thiết kế kiến trúc và định hướng lộ trình công nghệ cho nền tảng Lakehouse đa vùng (Multi-region).",
        "Xây dựng và tối ưu hóa các pipeline xử lý dữ liệu streaming thời gian thực với độ trễ dưới 2 giây.",
        "Thiết lập chuẩn mực Data Governance, Data Lineage và bảo mật mã hóa dữ liệu theo chuẩn PCI-DSS.",
        "Cố vấn chuyên môn và nâng cao năng lực cho đội ngũ 15 kỹ sư dữ liệu trong tổ chức."
      ],
      strengths: [
        "Yêu cầu chuyên môn cực kỳ rõ ràng về quy mô hệ thống dữ liệu lớn và tính sẵn sàng cao.",
        "Bộ tiêu chí tuyển dụng tập trung vào năng lực dẫn dắt kiến trúc thay vì chỉ thao tác vận hành đơn thuần.",
        "Môi trường kỹ thuật hiện đại với hệ sinh thái mã nguồn mở tiên tiến nhất hiện nay.",
        "Định hướng sản phẩm rõ ràng, gắn liền với giá trị kinh doanh cốt lõi của doanh nghiệp."
      ],
      gaps: [
        "Người phỏng vấn sẽ đào sâu vào các bài toán tối ưu hóa chi phí lưu trữ và tính toán trên hạ tầng cloud.",
        "Dự kiến có câu hỏi về xử lý xung đột ghi đồng thời (concurrent write conflicts) trong Delta Lake.",
        "Cần chuẩn bị phương án kiểm thử hồi quy tự động cho các đường ống dữ liệu tài chính phức tạp."
      ],
      actionItems: [
        { level: "high", label: "Ưu tiên Cao", text: "Chuẩn bị sơ đồ kiến trúc Lakehouse chi tiết mà bạn đã từng triển khai trong thực tế." },
        { level: "high", label: "Ưu tiên Cao", text: "Ôn tập các kỹ thuật partition pruning và file compaction trong Delta Lake/Parquet." },
        { level: "medium", label: "Ưu tiên Vừa", text: "Chuẩn bị kịch bản phân bổ chi phí và giám sát tài nguyên giữa các phòng ban." },
        { level: "low", label: "Ưu tiên Thấp", text: "Xem xét các tiêu chuẩn Data Mesh và cơ chế chia sẻ dữ liệu liên miền." }
      ],
      experienceRequirement: "Tối thiểu 7 năm kinh nghiệm với Data Engineering, trong đó có ít nhất 3 năm ở vai trò Lead hoặc Principal.",
      domainKnowledge: "Hiểu biết sâu sắc về dữ liệu tài chính (Fintech, Banking, Fraud Detection) và tiêu chuẩn tuân thủ bảo mật."
    };

    // Render JD Analysis in browser
    await cdp.eval(`renderJdAnalysis(${JSON.stringify(fullJdAnalysisData)}, 'Principal Data Platform Engineer')`);
    await sleep(500);

    // Verify JD Analysis DOM
    const jdDom = await cdp.eval(`(() => {
      const panel = document.getElementById('jd-analysis-panel');
      const isVisible = panel && !panel.classList.contains('hidden');
      const summaryText = document.getElementById('jd-analysis-summary')?.innerText || '';
      const summaryClamped = document.getElementById('jd-analysis-summary')?.classList.contains('is-clamped');
      const btnExpandSummary = document.getElementById('btn-expand-jd-summary');
      const btnSummaryVisible = btnExpandSummary && !btnExpandSummary.classList.contains('hidden') && btnExpandSummary.style.display !== 'none';
      const btnSummaryText = btnExpandSummary?.innerText.trim();
      const btnSummaryAria = btnExpandSummary?.getAttribute('aria-expanded');

      const skills = Array.from(document.querySelectorAll('#jd-key-skills .skill-tag')).map(el => el.innerText.trim());
      const hasGatedSkillTag = skills.some(s => s.includes('Mở khóa'));

      const respContainer = document.getElementById('jd-responsibilities-container');
      const respVisible = respContainer && !respContainer.classList.contains('hidden') && respContainer.style.display !== 'none';
      const responsibilities = Array.from(document.querySelectorAll('#jd-responsibilities-list li')).map(el => el.innerText.trim());

      const metaContainer = document.getElementById('jd-meta-container');
      const metaVisible = metaContainer && !metaContainer.classList.contains('hidden') && metaContainer.style.display !== 'none';
      const expReqText = document.getElementById('jd-experience-req-text')?.innerText || '';
      const domKnowText = document.getElementById('jd-domain-knowledge-text')?.innerText || '';

      const strengths = Array.from(document.querySelectorAll('#jd-strengths-list li')).map(el => el.innerText.trim());
      const gaps = Array.from(document.querySelectorAll('#jd-gaps-list li')).map(el => el.innerText.trim());
      const actions = Array.from(document.querySelectorAll('#jd-action-items-list li')).map(el => el.innerText.trim());
      const badgeText = document.getElementById('jd-analysis-suitability')?.innerText || '';

      return {
        isVisible,
        summaryText,
        summaryClamped,
        btnSummaryVisible,
        btnSummaryText,
        btnSummaryAria,
        skills,
        hasGatedSkillTag,
        respVisible,
        responsibilities,
        metaVisible,
        expReqText,
        domKnowText,
        strengths,
        gaps,
        actions,
        badgeText
      };
    })()`);

    assert(jdDom.isVisible, "JD analysis panel must be visible");
    assert(jdDom.summaryText.length > 200, "Full JD summary text must be present");
    assert.strictEqual(jdDom.summaryClamped, true, "Long JD summary must be initially clamped with .is-clamped");
    assert.strictEqual(jdDom.btnSummaryVisible, true, "Expand button for JD summary must be visible");
    assert.strictEqual(jdDom.btnSummaryText, "Xem thêm", "Button text must be 'Xem thêm'");
    assert.strictEqual(jdDom.btnSummaryAria, "false", "aria-expanded must be false initially");

    // Verify 100% of skills are rendered (9 skills, no slice)
    assert.strictEqual(jdDom.skills.length, 9, `All 9 skills must be rendered, got ${jdDom.skills.length}`);
    assert.strictEqual(jdDom.hasGatedSkillTag, false, "Gated '+ Mở khóa' tag must NOT appear for authenticated user");

    // Verify Responsibilities section
    assert.strictEqual(jdDom.respVisible, true, "JD Responsibilities container must be visible");
    assert.strictEqual(jdDom.responsibilities.length, 4, `All 4 responsibilities must be rendered, got ${jdDom.responsibilities.length}`);

    // Verify Meta block
    assert.strictEqual(jdDom.metaVisible, true, "JD Meta container must be visible");
    assert(jdDom.expReqText.includes("Tối thiểu 7 năm"), "Experience requirement text must be rendered");
    assert(jdDom.domKnowText.includes("Fintech, Banking"), "Domain knowledge text must be rendered");

    // Verify 100% of strengths, gaps, actions rendered (no slice(0, 3))
    assert.strictEqual(jdDom.strengths.length, 4, `All 4 strengths must be rendered, got ${jdDom.strengths.length}`);
    assert.strictEqual(jdDom.gaps.length, 3, `All 3 gaps must be rendered, got ${jdDom.gaps.length}`);
    assert.strictEqual(jdDom.actions.length, 4, `All 4 action items must be rendered, got ${jdDom.actions.length}`);
    console.log("  [PASS] Authenticated JD Analysis renders 100% data: 9 skills, 4 responsibilities, 4 strengths, 3 gaps, 4 actions, experience & domain meta.");

    // Toggle Expand JD Summary
    await cdp.eval(`document.getElementById('btn-expand-jd-summary').click()`);
    await sleep(200);

    const jdSummaryExpanded = await cdp.eval(`(() => {
      const summary = document.getElementById('jd-analysis-summary');
      const btn = document.getElementById('btn-expand-jd-summary');
      return {
        isExpandedClass: summary.classList.contains('is-expanded'),
        isClampedClass: summary.classList.contains('is-clamped'),
        btnText: btn.innerText.trim(),
        ariaExpanded: btn.getAttribute('aria-expanded')
      };
    })()`);

    assert.strictEqual(jdSummaryExpanded.isExpandedClass, true, "JD Summary must have .is-expanded class after clicking Xem thêm");
    assert.strictEqual(jdSummaryExpanded.isClampedClass, false, "JD Summary must not have .is-clamped class");
    assert.strictEqual(jdSummaryExpanded.btnText, "Thu gọn", "Button text must toggle to 'Thu gọn'");
    assert.strictEqual(jdSummaryExpanded.ariaExpanded, "true", "aria-expanded must be true");
    console.log("  [PASS] Clicking 'Xem thêm' on JD summary expands text and switches button to 'Thu gọn'.\n");

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO C: INDEPENDENCE OF EXPANDABLE STATES
    // ─────────────────────────────────────────────────────────────────
    console.log("--- SCENARIO C: Independence of Expandable States ---");

    // JD summary is currently EXPANDED.
    // Check CV summary state: it was collapsed earlier, so it must still be CLAMPED!
    const cvStillClamped = await cdp.eval(`document.getElementById('cv-analysis-summary').classList.contains('is-clamped')`);
    assert.strictEqual(cvStillClamped, true, "CV summary clamp state must remain independent of JD summary expansion");
    console.log("  [PASS] CV summary remains clamped when JD summary is expanded (Full state independence verified).");

    // Dismissing JD panel resets JD state cleanly
    await cdp.eval(`closeJdAnalysisPanel()`);
    await sleep(200);

    const jdAfterClose = await cdp.eval(`(() => {
      const panel = document.getElementById('jd-analysis-panel');
      const isHidden = panel.classList.contains('hidden');
      const respContainer = document.getElementById('jd-responsibilities-container');
      const isRespCleaned = !respContainer || respContainer.classList.contains('hidden') || respContainer.style.display === 'none';
      const metaContainer = document.getElementById('jd-meta-container');
      const isMetaCleaned = !metaContainer || metaContainer.classList.contains('hidden') || metaContainer.style.display === 'none';
      return { isHidden, isRespCleaned, isMetaCleaned };
    })()`);

    assert.strictEqual(jdAfterClose.isHidden, true, "JD panel must be hidden after dismissal");
    assert.strictEqual(jdAfterClose.isRespCleaned, true, "Responsibilities container must be cleaned up");
    assert.strictEqual(jdAfterClose.isMetaCleaned, true, "Meta container must be cleaned up");
    console.log("  [PASS] Dismissing JD panel resets all expandable elements and sub-containers cleanly.\n");

    // Re-render JD panel to restore it for visual regression screenshots
    await cdp.eval(`window._jdAnalysisDismissed = false; renderJdAnalysis(${JSON.stringify(fullJdAnalysisData)}, 'Principal Data Platform Engineer')`);
    await sleep(200);

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO D: STRICT GUEST BOUNDARY ENFORCEMENT
    // ─────────────────────────────────────────────────────────────────
    console.log("--- SCENARIO D: Strict Guest Boundary Enforcement ---");

    // Clear session to emulate Guest
    await cdp.eval(`(() => {
      localStorage.clear();
      sessionStorage.clear();
    })()`);

    const isGuestNow = await cdp.eval(`!isSessionAuthenticated()`);
    assert.strictEqual(isGuestNow, true, "Session must be unauthenticated (Guest)");

    // Render as Guest
    const guestCvData = {
      summary: "Kỹ sư phần mềm có kinh nghiệm phát triển hệ thống backend Java và cơ sở dữ liệu...",
      keySkills: ["Java", "Spring Boot"]
    };
    await cdp.eval(`renderCvAnalysis(${JSON.stringify(guestCvData)}, 'Developer', { isGuest: true })`);

    const guestJdData = {
      targetRole: "Backend Engineer",
      summary: "Tuyển dụng Backend Engineer phụ trách thiết kế cơ sở dữ liệu và API...",
      keySkills: ["Java", "SQL"]
    };
    await cdp.eval(`renderJdAnalysis(${JSON.stringify(guestJdData)}, 'Backend Engineer', { isGuest: true })`);
    await sleep(300);

    const guestDom = await cdp.eval(`(() => {
      const btnCvSummary = document.getElementById('btn-expand-cv-summary');
      const cvBtnHidden = !btnCvSummary || btnCvSummary.classList.contains('hidden') || btnCvSummary.style.display === 'none';
      const cvExpContainer = document.getElementById('cv-experience-container');
      const cvExpHidden = !cvExpContainer || cvExpContainer.classList.contains('hidden') || cvExpContainer.style.display === 'none';
      const cvSkills = Array.from(document.querySelectorAll('#cv-key-skills .skill-tag')).map(el => el.innerText.trim());

      const btnJdSummary = document.getElementById('btn-expand-jd-summary');
      const jdBtnHidden = !btnJdSummary || btnJdSummary.classList.contains('hidden') || btnJdSummary.style.display === 'none';
      const jdRespContainer = document.getElementById('jd-responsibilities-container');
      const jdRespHidden = !jdRespContainer || jdRespContainer.classList.contains('hidden') || jdRespContainer.style.display === 'none';
      const jdMetaContainer = document.getElementById('jd-meta-container');
      const jdMetaHidden = !jdMetaContainer || jdMetaContainer.classList.contains('hidden') || jdMetaContainer.style.display === 'none';
      const jdSkills = Array.from(document.querySelectorAll('#jd-key-skills .skill-tag')).map(el => el.innerText.trim());

      const guestCta = document.getElementById('shared-profile-guest-cta');
      const isGuestCtaVisible = guestCta && !guestCta.classList.contains('hidden') && guestCta.style.display !== 'none';

      return {
        cvBtnHidden,
        cvExpHidden,
        cvSkills,
        jdBtnHidden,
        jdRespHidden,
        jdMetaHidden,
        jdSkills,
        isGuestCtaVisible
      };
    })()`);

    assert.strictEqual(guestDom.cvBtnHidden, true, "Expand button for CV summary must be hidden for Guest");
    assert.strictEqual(guestDom.cvExpHidden, true, "CV Experience container must be hidden for Guest");
    assert(guestDom.cvSkills.some(s => s.includes("Mở khóa toàn bộ sau khi đăng nhập")), "CV skills must include guest unlock prompt");

    assert.strictEqual(guestDom.jdBtnHidden, true, "Expand button for JD summary must be hidden for Guest");
    assert.strictEqual(guestDom.jdRespHidden, true, "JD Responsibilities container must be hidden for Guest");
    assert.strictEqual(guestDom.jdMetaHidden, true, "JD Meta container must be hidden for Guest");
    assert(guestDom.jdSkills.some(s => s.includes("Mở khóa sau khi đăng nhập")), "JD skills must include guest unlock prompt");

    assert.strictEqual(guestDom.isGuestCtaVisible, true, "Unified Guest CTA must be visible for guest session");
    console.log("  [PASS] Strict Guest Protection verified: zero leakage of full details, gated containers hidden, CTA visible.\n");

    // Re-authenticate candidate for visual verification in Light & Dark modes
    await cdp.eval(`(() => {
      localStorage.setItem('prepmate_auth_token', ${JSON.stringify(candToken)});
      localStorage.setItem('prepmate_current_user', JSON.stringify({
        id: 'user_001',
        fullname: 'Lê Hoàng Nam',
        token: ${JSON.stringify(candToken)}
      }));
      window._cvAnalysisDismissed = false;
      window._jdAnalysisDismissed = false;
    })()`);
    await cdp.eval(`renderCvAnalysis(${JSON.stringify(fullCvAnalysisData)}, 'Senior Software Engineer')`);
    await cdp.eval(`renderJdAnalysis(${JSON.stringify(fullJdAnalysisData)}, 'Principal Data Platform Engineer')`);
    await sleep(500);

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO E: MULTI-VIEWPORT RESPONSIVENESS & SCREENSHOT EVIDENCE
    // ─────────────────────────────────────────────────────────────────
    console.log("--- SCENARIO E: Multi-Viewport Responsiveness & Screenshots ---");

    const viewports = [
      { name: "desktop-1440", width: 1440, height: 900 },
      { name: "desktop-1280", width: 1280, height: 800 },
      { name: "tablet-768", width: 768, height: 1024 },
      { name: "mobile-390", width: 390, height: 844 },
      { name: "mobile-375", width: 375, height: 667 },
    ];

    for (const vp of viewports) {
      await cdp.setViewport(vp.width, vp.height);
      await sleep(200);

      const overflow = await cdp.eval(`(() => {
        const root = document.documentElement;
        return {
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          hasOverflow: root.scrollWidth > root.clientWidth
        };
      })()`);

      assert.strictEqual(overflow.hasOverflow, false, `Viewport ${vp.name} must have 0px horizontal overflow, got scrollWidth=${overflow.scrollWidth} vs clientWidth=${overflow.clientWidth}`);
      console.log(`  [PASS] Viewport ${vp.name} (${vp.width}x${vp.height}): 0px overflow (scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth})`);
    }

    // Capture Light Mode Screenshots
    await cdp.setViewport(1440, 900);
    await cdp.eval(`document.documentElement.setAttribute('data-theme', 'light'); document.body.classList.remove('dark-mode');`);
    await sleep(300);
    const lightPath = path.join(EVIDENCE_DIR, "cv-jd-full-display-desktop-light.png");
    const lightArtifact = path.join(ARTIFACT_DIR, "cv-jd-full-display-desktop-light.png");
    await cdp.captureScreenshot(lightPath);
    fs.copyFileSync(lightPath, lightArtifact);

    await cdp.setViewport(390, 844);
    await sleep(300);
    const lightMobilePath = path.join(EVIDENCE_DIR, "cv-jd-full-display-mobile-light.png");
    const lightMobileArtifact = path.join(ARTIFACT_DIR, "cv-jd-full-display-mobile-light.png");
    await cdp.captureScreenshot(lightMobilePath);
    fs.copyFileSync(lightMobilePath, lightMobileArtifact);

    // Capture Dark Mode Screenshots
    await cdp.setViewport(1440, 900);
    await cdp.eval(`document.documentElement.setAttribute('data-theme', 'dark'); document.body.classList.add('dark-mode');`);
    await sleep(300);
    const darkPath = path.join(EVIDENCE_DIR, "cv-jd-full-display-desktop-dark.png");
    const darkArtifact = path.join(ARTIFACT_DIR, "cv-jd-full-display-desktop-dark.png");
    await cdp.captureScreenshot(darkPath);
    fs.copyFileSync(darkPath, darkArtifact);

    await cdp.setViewport(390, 844);
    await sleep(300);
    const darkMobilePath = path.join(EVIDENCE_DIR, "cv-jd-full-display-mobile-dark.png");
    const darkMobileArtifact = path.join(ARTIFACT_DIR, "cv-jd-full-display-mobile-dark.png");
    await cdp.captureScreenshot(darkMobilePath);
    fs.copyFileSync(darkMobilePath, darkMobileArtifact);

    console.log("  [PASS] Screenshots captured for Light and Dark modes at 1440px and 390px.\n");

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO F: PRODUCTION DATABASE INTEGRITY CHECK
    // ─────────────────────────────────────────────────────────────────
    console.log("--- SCENARIO F: Production Database Integrity Check ---");
    const finalProdHash = computeHash(PROD_DB_PATH);
    console.log(`[CHECK] Final SHA-256:\n        ${finalProdHash}`);
    assert.strictEqual(finalProdHash, initialProdHash, "Production db.json SHA-256 hash must remain exactly unchanged!");
    console.log("  [PASS] Production database is 100% UNTOUCHED and pristine.\n");

    console.log("==================================================================");
    console.log("  ALL WI-CV-JD-FULL-DISPLAY-UX-01 ACCEPTANCE CHECKS PASSED (100%) ");
    console.log("==================================================================");

  } finally {
    if (cdp) cdp.close();
    if (browserProcess) {
      try { browserProcess.kill("SIGKILL"); } catch (e) { }
    }
    if (beProcess) {
      try { beProcess.kill("SIGKILL"); } catch (e) { }
    }
    // Clean up temporary isolated directory
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) { }
  }
}

main().catch((err) => {
  console.error("\n[FATAL ERROR IN SUITE]", err);
  process.exit(1);
});
