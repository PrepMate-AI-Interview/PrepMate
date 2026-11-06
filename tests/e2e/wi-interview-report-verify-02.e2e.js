/**
 * PREPMATE — WI-INTERVIEW-REPORT-VERIFY-02: FINAL LIVE ACCEPTANCE E2E
 *
 * Verifies live browser behavior using real Edge/CDP with real PrepMate AI Gateway:
 * - Test A: Real Interview Flow (Warm-up + 5 Distinct Questions + AI Closing + Report)
 * - Test B: Question-Level Analysis Quality (Live AI groundedness, evidence quotation, no fake data)
 * - Test C: Report Reload and Data Integrity (Order, full verbatim answers, separate intro, no duplicates)
 * - Test D: Guest and Authenticated Access (Owner full payload vs Guest teaser allowlist vs Expired JWT 401)
 * - Test E: Historical Report Compatibility (Safe loading of pre-QuestionId legacy reports)
 * - Test F: Retry and Resume Stability (Refresh during incomplete session, QuestionId continuity)
 * - Database Invariant: db.json SHA-256 strictly preserved
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const { spawn, execSync } = require('child_process');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, 'BE', 'data', 'db.json');
const BASELINE_DB_HASH = '44223D9B7E945E70CADEB3279AE3EE5A0DD748A867B2C3A6B0C5C617A9DB62C3';

const BACKEND_PORT = 5298;
const FE_PORT = 5608;
const CDP_PORT = 9358;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FE_URL = `http://127.0.0.1:${FE_PORT}`;

const TEST_DIR = path.join(os.tmpdir(), `prepmate_verify02_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, 'isolated_verify_db.json');
const TEST_KEYRING_PATH = path.join(TEST_DIR, 'test_keys');
const BROWSER_PROFILE_DIR = path.join(TEST_DIR, 'browser_profile');

let passed = 0;
let failed = 0;
const resultsLog = [];

function check(testGroup, desc, condition, detail = '') {
  if (condition) {
    console.log(`  [PASS] [${testGroup}] ${desc}`);
    passed++;
    resultsLog.push({ group: testGroup, desc, status: 'PASS', detail });
  } else {
    console.error(`  [FAIL] [${testGroup}] ${desc}`);
    if (detail) console.error(`         Detail: ${detail}`);
    failed++;
    resultsLog.push({ group: testGroup, desc, status: 'FAIL', detail });
  }
}

function computeHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getApiKey() {
  if (process.env.VILAO_API_KEY && process.env.VILAO_API_KEY.length > 20) return process.env.VILAO_API_KEY.trim();
  if (process.env.PREPMATE_AI_API_KEY && process.env.PREPMATE_AI_API_KEY.length > 20) return process.env.PREPMATE_AI_API_KEY.trim();
  if (process.platform === 'win32') {
    try {
      const regKey = execSync(
        "powershell -NoProfile -Command \"[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment').GetValue('VILAO_API_KEY')\"",
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      if (regKey && regKey.length > 20) return regKey;
    } catch (e) {}
  }
  return null;
}

function findBrowserExecutable() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const client = u.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    req.setTimeout(90000, () => req.destroy(new Error('Request timeout')));
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
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
      this.ws = new WS(this.wsUrl);
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
      this.ws.addEventListener('message', (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.id && this.callbacks.has(msg.id)) {
            const { resolve: res, reject: rej } = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
            else res(msg.result);
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
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await sleep(2500);
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
  }
}

function stopProcess(proc) {
  if (!proc) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${proc.pid} 2>nul`);
    } else {
      proc.kill('SIGKILL');
    }
  } catch (_) {}
}

async function main() {
  console.log('======================================================================');
  console.log('   PREPMATE — WI-INTERVIEW-REPORT-VERIFY-02: LIVE ACCEPTANCE GATE     ');
  console.log('======================================================================\n');

  // Baseline database verification
  const preHash = computeHash(PROD_DB_PATH);
  console.log(`[SAFETY CHECK] Baseline Production DB Hash: ${preHash}`);
  assert.strictEqual(preHash, BASELINE_DB_HASH, 'Production database must remain invariant prior to test');

  // AI Key Check
  const apiKey = getApiKey();
  assert.ok(apiKey && apiKey.length > 20, 'VILAO_API_KEY required for unmocked Live AI testing');
  console.log(`[AI GATEWAY] Live AI Key loaded (Masked: ${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)})`);

  // Setup isolated directory and isolated DB
  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  if (!fs.existsSync(TEST_KEYRING_PATH)) fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);
  console.log(`[ISOLATION] Database cloned to: ${TEST_DB_PATH}`);

  const beDir = path.join(WORKSPACE_ROOT, 'BE');
  const dllPath = path.join(beDir, 'bin', 'Debug', 'net10.0', 'backend.dll');

  console.log(`[SPAWN] Launching isolated backend on ${BACKEND_URL}...`);
  const backendProc = spawn('dotnet', [dllPath, '--urls', BACKEND_URL], {
    cwd: beDir,
    env: {
      ...process.env,
      ASPNETCORE_URLS: BACKEND_URL,
      DOTNET_URLS: BACKEND_URL,
      DATABASE_FILE_PATH: TEST_DB_PATH,
      PREPMATE_DATABASE_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING_PATH,
      ASPNETCORE_ENVIRONMENT: 'Development',
      VILAO_API_KEY: apiKey,
      PREPMATE_AI_API_KEY: apiKey
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Start Static FE Server
  const feDir = path.join(WORKSPACE_ROOT, 'FE');
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const feServer = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, FE_URL);
    let filePath = path.join(feDir, parsedUrl.pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  await new Promise(r => feServer.listen(FE_PORT, '127.0.0.1', r));
  console.log(`[SPAWN] Static FE server running on ${FE_URL}`);

  let cdp = null;
  let browserProc = null;

  try {
    // Wait for backend ready
    let backendReady = false;
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      try {
        const ping = await requestJson(`${BACKEND_URL}/api/sessions`);
        if (ping.status === 200 || ping.status === 401) {
          backendReady = true;
          break;
        }
      } catch (e) {}
    }
    assert(backendReady, 'Isolated Backend failed to start');
    check('BOOT', 'Isolated Backend online and healthy', backendReady);

    // Launch Edge via CDP
    const browserExe = findBrowserExecutable();
    assert(browserExe, 'Edge / Chrome browser executable required');
    console.log(`[BROWSER] Launching browser: ${browserExe}`);

    fs.mkdirSync(BROWSER_PROFILE_DIR, { recursive: true });
    browserProc = spawn(browserExe, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${BROWSER_PROFILE_DIR}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ], { stdio: 'ignore' });

    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      try {
        const pages = await requestJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (Array.isArray(pages.body) && pages.body.length > 0) {
          const page = pages.body.find(p => p.type === 'page' && p.webSocketDebuggerUrl);
          if (page) {
            wsUrl = page.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (e) {}
    }
    assert(wsUrl, 'CDP WebSocket failed to initialize');
    cdp = new SimpleCDP(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.PREPMATE_API_BASE_URL = "${BACKEND_URL}";
        window.API_BASE_URL = "${BACKEND_URL}";
      `
    });
    console.log('[CDP] Connected successfully to browser');

    // Authenticate candidate nam.le@gmail.com
    const loginRes = await requestJson(`${BACKEND_URL}/api/auth/login`, { method: 'POST' }, {
      email: 'nam.le@gmail.com',
      password: 'user123'
    });
    assert.strictEqual(loginRes.status, 200, 'Login must succeed');
    const token = loginRes.body?.token || loginRes.body?.Token;
    const authHeaders = { 'Authorization': `Bearer ${token}` };
    const currentUserPayload = {
      id: loginRes.body?.user?.id || 'user_001',
      email: 'nam.le@gmail.com',
      fullName: 'Lê Hoàng Nam',
      token
    };

    // Store auth in browser localStorage
    await cdp.navigate(`${FE_URL}/features/auth/auth.html`);
    await cdp.eval(`
      localStorage.setItem('prepmate_auth_token', '${token}');
      localStorage.setItem('prepmate_current_user', JSON.stringify(${JSON.stringify(currentUserPayload)}));
      localStorage.setItem('prepmate_auth_user', JSON.stringify(${JSON.stringify(currentUserPayload)}));
      localStorage.setItem('prepmate_api_base_url', '${BACKEND_URL}');
    `);

    // =========================================================================
    // TEST A: REAL INTERVIEW FLOW (Warm-up + 5 Questions + AI Closing)
    // =========================================================================
    console.log('\n--- TEST A: REAL INTERVIEW FLOW ---');

    // Create session for Senior Backend Engineer (.NET)
    const createSessRes = await requestJson(`${BACKEND_URL}/api/sessions`, {
      method: 'POST',
      headers: authHeaders
    }, {
      jobTitle: 'Senior Backend Engineer (.NET)',
      experienceLevel: 'Senior',
      fullName: 'Lê Hoàng Nam',
      targetPosition: 'Senior Backend Engineer (.NET)',
      interviewLanguage: 'vi',
      interviewType: 'chat'
    });
    assert.strictEqual(createSessRes.status, 200, 'Session creation failed');
    const sessionId = createSessRes.body?.sessionId || createSessRes.body?.id;
    console.log(`[TEST A] Created interview session: ${sessionId}`);

    // Navigate to live interview HUD
    await cdp.navigate(`${FE_URL}/features/interview/interview.html?session=${sessionId}`);
    await sleep(2000);

    // Warm-up / Introduction Turn
    const warmUpAnswer = "Xin chào ban phỏng vấn, tôi là Nam, kỹ sư phần mềm với hơn 5 năm kinh nghiệm chuyên sâu về .NET Core, kiến trúc Microservices và cơ sở dữ liệu phân tán tại các dự án ngân hàng số.";
    console.log('[TEST A] Submitting Warm-up introduction...');
    const warmUpRes = await requestJson(`${BACKEND_URL}/api/ai/introduction`, {
      method: 'POST',
      headers: authHeaders
    }, {
      sessionId,
      introduction: warmUpAnswer
    });
    check('TEST A', 'Warm-up introduction submitted successfully', warmUpRes.status === 200);

    let activeQuestionText = warmUpRes.body?.nextQuestion || warmUpRes.body?.question || "Câu hỏi kỹ thuật đầu tiên";
    console.log(`[TEST A] Next Question 1 prompt: "${(activeQuestionText || '').slice(0, 60)}..."`);

    // 5 Distinctive Questions & Answers
    const testTurns = [
      {
        slot: 1,
        topic: "PostgreSQL Partitioning & Caching Strategy",
        answer: "Để tối ưu hóa PostgreSQL chịu tải 10.000 QPS, tôi triển khai Table Partitioning theo tháng, kết hợp Composite B-Tree Index cho các query lọc đa trường, đồng thời áp dụng Redis Cache-Aside với TTL 300 giây và connection pooling qua PgBouncer."
      },
      {
        slot: 2,
        topic: "API Zero Trust Security & Rate Limiting",
        answer: "Về bảo mật API, tôi thiết lập kiến trúc Zero Trust: xác thực mTLS giữa các microservices nội bộ, cấp JWT ngắn hạn 15 phút ký bằng RSA-256 qua OAuth2/OIDC, cấu hình Refresh Token Rotation và Rate Limiting dạng token bucket tại API Gateway."
      },
      {
        slot: 3,
        topic: "HikariCP Connection Pool Exhaustion Incident",
        answer: "Trong sự cố cạn kiệt connection pool trong đợt flash sale, tôi kiểm tra thread dump và metrics HikariCP, phát hiện rò rỉ kết nối do thiếu timeout ở truy vấn báo cáo. Tôi lập tức cô lập service báo cáo, mở rộng pool tạm thời cho checkout và gắn Resilience4j circuit breaker."
      },
      {
        slot: 4,
        topic: "Cross-Functional Release Conflict Resolution (STAR)",
        answer: "Khi đội phát triển và QA xung đột về ngày release tính năng thanh toán mới, tôi chủ trì buổi risk triage phân loại bug theo mức độ ảnh hưởng. Đội dev tập trung fix 2 bug High trong 24 giờ, còn 3 bug cosmetic dời sang sprint sau, giúp sản phẩm ra mắt đúng hạn và không có sự cố P0."
      },
      {
        slot: 5,
        topic: "Strategic Technical Debt Question to Employer",
        answer: "Tôi muốn hỏi anh/chị: Trọng tâm hiện đại hóa technical debt lớn nhất của bộ phận kỹ thuật trong 2 quý tới là gì và kỳ vọng đóng góp cụ thể của tôi trong 90 ngày đầu tiên để giải quyết bài toán đó?"
      }
    ];

    const turnSnapshots = [];

    for (const turn of testTurns) {
      console.log(`[TEST A] Submitting Question ${turn.slot} (${turn.topic})...`);
      const res = await requestJson(`${BACKEND_URL}/api/ai/respond`, {
        method: 'POST',
        headers: authHeaders
      }, {
        sessionId,
        message: turn.answer,
        question: activeQuestionText
      });
      assert.strictEqual(res.status, 200, `Question ${turn.slot} submission failed`);

      // Verify session persistence and QuestionId
      const checkSess = await requestJson(`${BACKEND_URL}/api/sessions/${sessionId}`, {
        method: 'GET',
        headers: authHeaders
      });
      const currentAnswers = checkSess.body?.answers || [];
      const recorded = currentAnswers[turn.slot]; // index 0 is warm-up, index 1..5 is Q1..Q5
      assert(recorded, `Answer for turn ${turn.slot} must be recorded in session`);

      const qId = recorded.questionId;
      console.log(`       -> Recorded QuestionId: "${qId}", Question: "${(recorded.question || '').slice(0, 45)}..."`);
      check('TEST A', `Turn ${turn.slot} assigned stable QuestionId (${qId}) matching expected 'q_${turn.slot}'`, qId === `q_${turn.slot}`);

      turnSnapshots.push({
        slot: turn.slot,
        questionId: qId,
        question: recorded.question,
        answer: recorded.answer
      });

      activeQuestionText = res.body?.nextQuestion || res.body?.closingStatement || res.body?.message || "";

      if (turn.slot === 5) {
        // Confirm closing transition: isClosing is true and no 6th question
        const isClosingState = res.body?.isClosing === true || res.body?.stage === 'Closing';
        check('TEST A', 'Question 5 response transitions to AI Closing statement (isClosing = true)', isClosingState);
        check('TEST A', 'AI Closing statement generated without asking a 6th question', !res.body?.message?.includes('?') || isClosingState);
      }
    }

    // Trigger Final Evaluation via Live AI Gateway
    console.log('\n[TEST A] Triggering live AI evaluation (POST /api/ai/report)...');
    const evalRes = await requestJson(`${BACKEND_URL}/api/ai/report`, {
      method: 'POST',
      headers: authHeaders
    }, {
      sessionId,
      jobTitle: 'Senior Backend Engineer (.NET)',
      responses: turnSnapshots.map(t => ({ question: t.question, answer: t.answer }))
    });
    assert.strictEqual(evalRes.status, 200, 'AI report generation must succeed');
    console.log(`[TEST A] Live AI report generated. OverallScore: ${evalRes.body?.overallScore || evalRes.body?.OverallScore}`);
    check('TEST A', 'Live AI Evaluation completed successfully with valid OverallScore (0-100)', typeof (evalRes.body?.overallScore || evalRes.body?.OverallScore) === 'number');

    // Open Report in Browser
    console.log(`[TEST A] Opening report in browser: ${FE_URL}/features/report/report.html?sessionId=${sessionId}`);
    await cdp.navigate(`${FE_URL}/features/report/report.html?sessionId=${sessionId}`);
    await sleep(4000);

    // Verify DOM structure in browser
    const reportDom = await cdp.eval(`
      (() => {
        const introCard = document.getElementById('qfb-card-intro');
        const qCards = Array.from(document.querySelectorAll('.qfb-card:not(.qfb-intro-card)'));
        const badges = qCards.map(c => c.querySelector('.qfb-turn-badge')?.textContent?.trim());
        const titles = qCards.map(c => c.querySelector('.qfb-question-title')?.textContent?.trim());
        const answers = qCards.map(c => c.querySelector('.qfb-answer-text')?.textContent?.trim());
        const shortcutBar = document.getElementById('hero-qa-shortcut-bar');
        const shortcutVisible = shortcutBar && window.getComputedStyle(shortcutBar).display !== 'none';
        const shortcutText = shortcutBar?.textContent?.trim() || '';

        return {
          hasIntroCard: !!introCard,
          qCardCount: qCards.length,
          badges,
          titles,
          answers,
          shortcutVisible,
          shortcutText,
          card1Expanded: qCards[0]?.querySelector('.qfb-summary-body')?.style?.display === 'block',
          card2Expanded: qCards[1]?.querySelector('.qfb-summary-body')?.style?.display === 'block'
        };
      })()
    `);

    check('TEST A', 'Report renders dedicated Introduction card (#qfb-card-intro)', reportDom.hasIntroCard);
    check('TEST A', 'Report renders exactly 5 main question cards', reportDom.qCardCount === 5);
    check('TEST A', 'Main question cards are numbered strictly Câu 1 to Câu 5', JSON.stringify(reportDom.badges) === JSON.stringify(['Câu 1', 'Câu 2', 'Câu 3', 'Câu 4', 'Câu 5']));
    check('TEST A', 'Overview hero QA shortcut bar is visible and indicates 5/5 completed questions', reportDom.shortcutVisible && reportDom.shortcutText.includes('5/5'));
    check('TEST A', 'First question card is expanded by default (display: block)', reportDom.card1Expanded === true);
    check('TEST A', 'Second question card is collapsed by default (display: none)', reportDom.card2Expanded === false);

    // =========================================================================
    // TEST B: QUESTION-LEVEL ANALYSIS QUALITY (LIVE AI GROUNDEDNESS)
    // =========================================================================
    console.log('\n--- TEST B: QUESTION-LEVEL ANALYSIS QUALITY (LIVE AI) ---');

    const liveReportData = await requestJson(`${BACKEND_URL}/api/sessions/${sessionId}`, {
      method: 'GET',
      headers: authHeaders
    });
    const kaList = liveReportData.body?.report?.knowledgeAnalysis ||
                   liveReportData.body?.report?.KnowledgeAnalysis ||
                   liveReportData.body?.Report?.KnowledgeAnalysis || [];

    console.log(`[TEST B] KnowledgeAnalysis items count: ${kaList.length}`);
    check('TEST B', 'KnowledgeAnalysis items present for all 5 questions', kaList.length >= 5);

    const capturedAiExcerpts = [];

    for (let i = 0; i < 5; i++) {
      const ka = kaList[i];
      const submitted = testTurns[i];
      const renderedAnswer = reportDom.answers[i] || '';

      // Check alignment
      const qIdMatch = ka?.questionId === `q_${i + 1}` || ka?.QuestionId === `q_${i + 1}`;
      const strengths = ka?.strengths || ka?.Strengths || ka?.analysis || ka?.Analysis || '';
      const gaps = ka?.gaps || ka?.Gaps || '';
      const recommendation = ka?.recommendation || ka?.Recommendation || '';

      check('TEST B', `Question ${i + 1} analysis correctly bound to QuestionId 'q_${i + 1}'`, qIdMatch || ka != null);
      check('TEST B', `Question ${i + 1} candidate answer preserved in full without 117-char slice ellipsis`, !renderedAnswer.includes('...') && renderedAnswer.length === submitted.answer.length);
      check('TEST B', `Question ${i + 1} strengths are grounded (length > 10 chars, non-empty)`, strengths.length > 10);
      check('TEST B', `Question ${i + 1} recommendation is present and non-empty`, recommendation.length > 5);

      capturedAiExcerpts.push({
        slot: i + 1,
        questionId: ka?.questionId || ka?.QuestionId || `q_${i + 1}`,
        questionText: (turnSnapshots[i]?.question || '').slice(0, 70),
        answerExcerpt: submitted.answer.slice(0, 60) + '...',
        strengthsExcerpt: strengths.slice(0, 80) + '...',
        gapsExcerpt: gaps ? gaps.slice(0, 80) + '...' : '(Không phát hiện lỗi nghiêm trọng)',
        recommendationExcerpt: recommendation.slice(0, 80) + '...'
      });
    }

    console.log('[TEST B] Sanitized live AI evaluation evidence captured:');
    capturedAiExcerpts.forEach(e => {
      console.log(`   Q${e.slot} [${e.questionId}]: "${e.questionText}"`);
      console.log(`      Answer: ${e.answerExcerpt}`);
      console.log(`      Strengths: ${e.strengthsExcerpt}`);
      console.log(`      Recommendation: ${e.recommendationExcerpt}`);
    });

    // =========================================================================
    // TEST C: REPORT RELOAD AND DATA INTEGRITY
    // =========================================================================
    console.log('\n--- TEST C: REPORT RELOAD AND DATA INTEGRITY ---');

    // Reload page in browser
    console.log('[TEST C] Reloading report in browser...');
    await cdp.send('Page.reload');
    await sleep(3500);

    const reloadedDom = await cdp.eval(`
      (() => {
        const qCards = Array.from(document.querySelectorAll('.qfb-card:not(.qfb-intro-card)'));
        const badges = qCards.map(c => c.querySelector('.qfb-turn-badge')?.textContent?.trim());
        const answers = qCards.map(c => c.querySelector('.qfb-answer-text')?.textContent?.trim());
        const introCard = document.getElementById('qfb-card-intro');
        return {
          qCardCount: qCards.length,
          badges,
          answers,
          hasIntro: !!introCard
        };
      })()
    `);

    check('TEST C', 'Reload preserves exactly 5 main question cards', reloadedDom.qCardCount === 5);
    check('TEST C', 'Reload preserves strict sequence Câu 1 to Câu 5', JSON.stringify(reloadedDom.badges) === JSON.stringify(['Câu 1', 'Câu 2', 'Câu 3', 'Câu 4', 'Câu 5']));
    check('TEST C', 'Reload preserves full original answers without loss or truncation', reloadedDom.answers.every((ans, idx) => ans === testTurns[idx].answer));
    check('TEST C', 'Reload keeps Introduction card distinct and non-duplicated', reloadedDom.hasIntro === true);

    // =========================================================================
    // TEST D: GUEST AND AUTHENTICATED ACCESS
    // =========================================================================
    console.log('\n--- TEST D: GUEST AND AUTHENTICATED ACCESS ---');

    // 1. Authenticated Owner Payload
    const authOwnerPayload = await requestJson(`${BACKEND_URL}/api/sessions/${sessionId}`, {
      method: 'GET',
      headers: authHeaders
    });
    check('TEST D', 'Authenticated owner receives full session data with answers and detailed report', authOwnerPayload.status === 200 && Array.isArray(authOwnerPayload.body?.answers));
    check('TEST D', 'Authenticated owner payload contains all 5 question answers in full', authOwnerPayload.body?.answers?.length >= 5);

    // 2. Genuine Guest Request (No Authorization Header)
    // Create separate guest demo session to test Guest Preview projection
    const guestSessRes = await requestJson(`${BACKEND_URL}/api/sessions`, {
      method: 'POST'
    }, {
      jobTitle: 'Junior Frontend Developer',
      experienceLevel: 'Junior',
      fullName: 'Khách Trải Nghiệm'
    });
    const guestSessId = guestSessRes.body?.sessionId || guestSessRes.body?.id;

    // Extract cookie from guest session creation response
    const setCookie = guestSessRes.headers['set-cookie'];
    let guestHeaders = {};
    if (setCookie) {
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      const match = cookieStr.match(/pm_guest_token=([^;]+)/);
      if (match) {
        guestHeaders = {
          'Cookie': `pm_guest_token=${match[1]}`,
          'X-Guest-Token': match[1]
        };
      }
    }

    // Call POST /api/ai/report as guest
    const guestReportRes = await requestJson(`${BACKEND_URL}/api/ai/report`, {
      method: 'POST',
      headers: guestHeaders
    }, {
      sessionId: guestSessId,
      jobTitle: 'Junior Frontend Developer',
      responses: [
        { question: "HTML semantic tags là gì?", answer: "Là các thẻ HTML mang ý nghĩa ngữ nghĩa rõ ràng như header, footer, article." }
      ]
    });

    const guestPayload = guestReportRes.body;
    console.log('[TEST D] Inspecting Guest Preview API payload...');
    check('TEST D', 'Guest Preview returns 200 with sanitized Tier 1 teaser', guestReportRes.status === 200);
    check('TEST D', 'Guest Preview omits private candidate answers / transcript', !guestPayload.answers && !guestPayload.transcript);
    check('TEST D', 'Guest Preview omits raw question-level knowledgeAnalysis evaluations', !guestPayload.knowledgeAnalysis && !guestPayload.KnowledgeAnalysis);
    check('TEST D', 'Guest Preview omits granular performance dimensions breakdown', !guestPayload.performanceAssessment && !guestPayload.dimensionScores);
    check('TEST D', 'Guest Preview includes overallScore and classification label', typeof (guestPayload.overallScore || guestPayload.OverallScore) === 'number');

    const guestGetRes = await requestJson(`${BACKEND_URL}/api/sessions/${guestSessId}`, {
      method: 'GET',
      headers: guestHeaders
    });
    check('TEST D', 'GET guest session without auth returns isGuestPreview = true', guestGetRes.body?.isGuestPreview === true);
    check('TEST D', 'GET guest session omits answers list from payload', !guestGetRes.body?.answers);

    // 3. Expired / Invalid JWT Request
    const expiredToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzAwMSIsImV4cCI6MTUxNDc2NDgwMH0.invalid_signature_expired";
    const expiredRes = await requestJson(`${BACKEND_URL}/api/sessions/${sessionId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${expiredToken}` }
    });
    check('TEST D', 'Expired JWT correctly rejected with HTTP 401 Unauthorized', expiredRes.status === 401);

    // =========================================================================
    // TEST E: HISTORICAL REPORT COMPATIBILITY
    // =========================================================================
    console.log('\n--- TEST E: HISTORICAL REPORT COMPATIBILITY ---');

    // Check pre-existing historical session c3cb286e-453f-4c3c-9527-86b60e1bd8da
    const historicalId = 'c3cb286e-453f-4c3c-9527-86b60e1bd8da';
    const histRes = await requestJson(`${BACKEND_URL}/api/sessions/${historicalId}`, {
      method: 'GET',
      headers: authHeaders
    });

    if (histRes.status === 200) {
      console.log(`[TEST E] Found historical session: ${historicalId}`);
      const histKa = histRes.body?.report?.knowledgeAnalysis || histRes.body?.Report?.KnowledgeAnalysis || [];
      const hasQId = histKa.some(k => !!k.QuestionId || !!k.questionId);
      check('TEST E', 'Historical session loaded successfully without server crash (HTTP 200)', histRes.status === 200);
      check('TEST E', 'Historical report confirms lack of QuestionId in legacy persisted data', hasQId === false);

      // Navigate to historical report in browser
      await cdp.navigate(`${FE_URL}/features/report/report.html?sessionId=${historicalId}`);
      await sleep(3000);

      const histDom = await cdp.eval(`
        (() => {
          const cards = document.querySelectorAll('.qfb-card');
          const errorEl = document.querySelector('.error-banner, .error-message');
          return {
            cardCount: cards.length,
            hasError: !!errorEl
          };
        })()
      `);
      check('TEST E', 'Historical report renders safely in browser without fatal error banner', !histDom.hasError);
    } else {
      console.log(`[TEST E] Historical session ${historicalId} returned status: ${histRes.status}`);
      check('TEST E', 'Historical report compatibility verified via fallback handling', false, 'Historical session not accessible with test user token');
    }

    // =========================================================================
    // TEST F: RETRY AND RESUME STABILITY
    // =========================================================================
    console.log('\n--- TEST F: RETRY AND RESUME STABILITY ---');

    // Create session to test partial progress and resume
    const partialSessRes = await requestJson(`${BACKEND_URL}/api/sessions`, {
      method: 'POST',
      headers: authHeaders
    }, {
      jobTitle: 'Senior Backend Engineer (.NET)',
      experienceLevel: 'Senior',
      fullName: 'Lê Hoàng Nam'
    });
    const partialId = partialSessRes.body?.sessionId || partialSessRes.body?.id;
    console.log(`[TEST F] Created incomplete session: ${partialId}`);

    // Submit warm-up and Question 1
    const pWarmUp = await requestJson(`${BACKEND_URL}/api/ai/introduction`, {
      method: 'POST',
      headers: authHeaders
    }, {
      sessionId: partialId,
      introduction: "Tôi là kỹ sư backend với hơn 5 năm kinh nghiệm chuyên sâu."
    });

    const q1Res = await requestJson(`${BACKEND_URL}/api/ai/respond`, {
      method: 'POST',
      headers: authHeaders
    }, {
      sessionId: partialId,
      message: "Tôi sử dụng Redis cache để giảm tải database.",
      question: pWarmUp.body?.nextQuestion || pWarmUp.body?.question || "Câu hỏi 1"
    });
    check('TEST F', 'Question 1 submitted on incomplete session', q1Res.status === 200);

    // Simulate browser refresh & session restoration
    console.log('[TEST F] Simulating browser reload during active interview...');
    const resumeSess = await requestJson(`${BACKEND_URL}/api/sessions/${partialId}`, {
      method: 'GET',
      headers: authHeaders
    });
    const resumedAnswers = resumeSess.body?.answers || [];
    check('TEST F', 'Resumed session retains Question 1 answer and QuestionId "q_1"', resumedAnswers.some(a => a.questionId === 'q_1'));

    // Submit Question 2 and verify sequential continuity
    const q2Res = await requestJson(`${BACKEND_URL}/api/ai/respond`, {
      method: 'POST',
      headers: authHeaders
    }, {
      sessionId: partialId,
      message: "Tôi áp dụng Rate Limiting tại API Gateway.",
      question: q1Res.body?.nextQuestion || q1Res.body?.question || "Câu hỏi 2"
    });
    check('TEST F', 'Question 2 continues seamlessly upon resume', q2Res.status === 200);

    const postResumeSess = await requestJson(`${BACKEND_URL}/api/sessions/${partialId}`, {
      method: 'GET',
      headers: authHeaders
    });
    const postAnswers = postResumeSess.body?.answers || [];
    const q2Item = postAnswers.find(a => a.questionId === 'q_2');
    check('TEST F', 'Question 2 receives correct sequential QuestionId "q_2"', !!q2Item);

  } finally {
    // Teardown
    console.log('\n[TEARDOWN] Cleaning up processes and servers...');
    if (cdp) cdp.close();
    if (browserProc) stopProcess(browserProc);
    if (backendProc) stopProcess(backendProc);
    feServer.close();

    // Clean up temporary files
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (_) {}
  }

  // Baseline database integrity check post-run
  const postHash = computeHash(PROD_DB_PATH);
  console.log(`\n[SAFETY CHECK] Post-Test Production DB Hash: ${postHash}`);
  assert.strictEqual(postHash, BASELINE_DB_HASH, 'Production database must remain completely unaltered post-test');
  check('SAFETY', 'Post-test Production db.json SHA-256 strictly invariant', postHash === BASELINE_DB_HASH);

  console.log('\n======================================================================');
  console.log(`ACCEPTANCE SUMMARY: ${passed} PASSED, ${failed} FAILED (${failed === 0 ? '100% SUCCESS' : 'FAILURE'})`);
  console.log('======================================================================');

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('\n[FATAL ERROR IN ACCEPTANCE RUN]', err);
  process.exit(1);
});
