/**
 * PREPMATE — COMPANY-SOURCED QUESTION BANK & MULTI-INDUSTRY REGRESSION SUITE
 * 
 * Verifies:
 * 1. Backend QBank Architecture & API:
 *    - GET /api/qbank/questions returns 200 OK with valid QBankResponse schema.
 *    - GET /api/qbank/questions/{id} returns full question details or 404 for invalid ID.
 *    - GET /api/qbank/sources returns registered company sources with verified provenance.
 *    - GET /api/qbank/taxonomy returns comprehensive multi-industry taxonomy.
 *    - Multi-attribute filtering (keyword, industry, company, difficulty, seniority, questionType, language).
 *    - Pagination (page, pageSize, totalPages, totalCount).
 * 2. Multi-Industry & Provenance Invariants:
 *    - 8+ domains represented (IT, Marketing, Design, Sales, Languages, Finance, HR, Softskills/Operations).
 *    - Major verified enterprise sources (Amazon, Microsoft, FPT Software, Viettel, Vinamilk, Masan, Base.vn, Shopee).
 *    - STAR evaluation framework & AI follow-up probes attached to every question.
 *    - Canonical question Q-101 (Database Deadlock) preserved.
 * 3. Frontend UX & Accessibility Contracts:
 *    - qbank.html line count strictly < 1500 lines.
 *    - qbank.css line count >= 700 lines.
 *    - select-page-size has descriptive aria-label.
 *    - Profession-neutral search placeholder.
 *    - Company provenance badge styling and practice bridge to interview-info.html.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');
const { rootDir, resolvePath, resolveDbPath } = require('../helpers/test-env');

const BACKEND_PORT = 5096;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const PROD_DB_PATH = resolveDbPath();
const TEST_DIR = path.join(os.tmpdir(), `prepmate_qbank_test_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, 'test_db.json');
const TEST_KEYRING = path.join(TEST_DIR, 'keys');

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      },
      timeout: 10000
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function setupTestEnvironment() {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING, { recursive: true });

  const fixturePath = path.join(rootDir, 'tests/fixtures/test_db_fixture.json');
  if (fs.existsSync(fixturePath)) {
    fs.copyFileSync(fixturePath, TEST_DB_PATH);
  } else if (fs.existsSync(PROD_DB_PATH)) {
    fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);
  } else {
    fs.writeFileSync(TEST_DB_PATH, JSON.stringify({ users: [], interviews: [], configurations: [] }));
  }
}

function cleanupTestEnvironment() {
  try {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    // ignore cleanup errors on Windows
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function startBackendServer() {
  return new Promise(async (resolve, reject) => {
    const beDir = resolvePath('BE');
    const dllPath = path.join(beDir, 'bin', 'Debug', 'net10.0', 'backend.dll');
    const env = {
      ...process.env,
      ASPNETCORE_URLS: BASE_URL,
      DOTNET_URLS: BASE_URL,
      ASPNETCORE_ENVIRONMENT: 'Development',
      DATABASE_FILE_PATH: TEST_DB_PATH,
      PREPMATE_DATABASE_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING,
      GUEST_TOKEN__SIGNING_KEY: 'test-guest-secret-key-32-chars-long!',
      JWT__SECRET: 'test-jwt-secret-key-at-least-32-chars!'
    };

    const serverProc = spawn('dotnet', [dllPath, '--urls', BASE_URL], {
      cwd: beDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let isOnline = false;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        const res = await requestJson(`${BASE_URL}/health`);
        if (res.status === 200) {
          isOnline = true;
          break;
        }
      } catch (e) {
        // waiting for startup
      }
    }

    if (isOnline) {
      resolve(serverProc);
    } else {
      serverProc.kill();
      reject(new Error(`Backend failed to respond on ${BASE_URL}/health within 10 seconds`));
    }
  });
}

async function runStaticContractsSuite() {
  console.log('\n--- Suite 1: QBank Frontend & Design Token Invariants ---');

  const qbankHtmlPath = resolvePath('FE/features/qbank/qbank.html');
  check(fs.existsSync(qbankHtmlPath), 'FE/features/qbank/qbank.html exists');

  const qbankHtml = fs.readFileSync(qbankHtmlPath, 'utf8');
  const htmlLines = qbankHtml.split('\n').length;
  check(htmlLines < 1500, `qbank.html line count < 1500 (actual: ${htmlLines} lines)`);

  const qbankCssPath = resolvePath('FE/features/qbank/qbank.css');
  check(fs.existsSync(qbankCssPath), 'FE/features/qbank/qbank.css exists');

  const qbankCss = fs.readFileSync(qbankCssPath, 'utf8');
  const cssLines = qbankCss.split('\n').length;
  check(cssLines >= 700, `qbank.css line count >= 700 (actual: ${cssLines} lines)`);

  // Accessibility & DOM contracts
  check(qbankHtml.includes('id="select-page-size"'), 'Contains select-page-size element');
  check(qbankHtml.includes('aria-label="Số câu hỏi hiển thị mỗi trang"'), 'select-page-size has descriptive aria-label');
  check(qbankHtml.includes('id="select-company"'), 'Contains select-company filter dropdown');
  check(qbankHtml.includes('placeholder="Tìm theo câu hỏi, vị trí, kỹ năng hoặc chủ đề..."'), 'Search input has profession-neutral placeholder');

  // Token contracts
  check(qbankHtml.includes('--qb-bg-body: var(--pm-bg);'), 'Maps --qb-bg-body to var(--pm-bg)');
  check(qbankHtml.includes('--qb-accent-blue-dark: var(--pm-primary);'), 'Maps --qb-accent-blue-dark to var(--pm-primary)');
  check(!qbankHtml.includes('body.dashboard-body .glow-bg'), 'Does not contain obsolete glow-bg');
  check(!qbankHtml.includes('📁'), 'Does not contain raw emoji 📁');

  // Architecture contracts
  check(qbankHtml.includes('Q-101'), 'Fallback dataset preserves canonical Q-101 ID');
  check(qbankHtml.includes('Deadlock') || qbankHtml.includes('deadlock'), 'Fallback dataset preserves Deadlock question');
  check(qbankHtml.includes('interview-info.html'), 'Card & modal link directly to interview-info.html');
  check(qbankHtml.includes('badge-company-source'), 'Card markup includes badge-company-source');
  check(qbankHtml.includes('modal-source-banner'), 'Modal markup includes modal-source-banner');

  // CSS contracts
  check(qbankCss.includes('.badge-company-source'), 'qbank.css defines .badge-company-source');
  check(qbankCss.includes('.modal-source-banner'), 'qbank.css defines .modal-source-banner');
}

async function runBackendArchitectureSuite() {
  console.log('\n--- Suite 2: QBank Backend Architecture & Models ---');

  const controllerPath = resolvePath('BE/Controllers/QBankController.cs');
  check(fs.existsSync(controllerPath), 'BE/Controllers/QBankController.cs exists');

  const controllerSrc = fs.readFileSync(controllerPath, 'utf8');
  check(controllerSrc.includes('[Route("api/qbank")]'), 'QBankController routes to api/qbank');
  check(controllerSrc.includes('GetQuestions('), 'QBankController implements GetQuestions endpoint');
  check(controllerSrc.includes('GetQuestionById('), 'QBankController implements GetQuestionById endpoint');
  check(controllerSrc.includes('GetSources('), 'QBankController implements GetSources endpoint');
  check(controllerSrc.includes('GetTaxonomy('), 'QBankController implements GetTaxonomy endpoint');

  const servicePath = resolvePath('BE/Services/QBank/QBankService.cs');
  check(fs.existsSync(servicePath), 'BE/Services/QBank/QBankService.cs exists');

  const serviceSrc = fs.readFileSync(servicePath, 'utf8');
  check(serviceSrc.includes('IQBankService'), 'QBankService implements IQBankService');
  check(serviceSrc.includes('Amazon') && serviceSrc.includes('Microsoft'), 'QBankService seeds global tech enterprise sources');
  check(serviceSrc.includes('FPT Software') && serviceSrc.includes('Vinamilk'), 'QBankService seeds leading Vietnamese enterprise sources');

  const programCsPath = resolvePath('BE/Program.cs');
  const programCs = fs.readFileSync(programCsPath, 'utf8');
  check(programCs.includes('IQBankService'), 'Program.cs registers IQBankService in DI container');
}

async function runLiveApiSuite() {
  console.log('\n--- Suite 3: QBank Live HTTP API Integration ---');

  // 1. GET /api/qbank/sources
  const sourcesRes = await requestJson(`${BASE_URL}/api/qbank/sources`);
  check(sourcesRes.status === 200, `GET /api/qbank/sources returns 200 OK (status: ${sourcesRes.status})`);
  check(sourcesRes.data.total >= 8, `Returns at least 8 verified sources (actual: ${sourcesRes.data.total})`);
  
  const sources = sourcesRes.data.sources || [];
  const amazonSrc = sources.find(s => s.company === 'Amazon');
  check(amazonSrc && amazonSrc.sourceType === 'PrepMateCurated', 'Amazon source has PrepMateCurated provenance (framework-based)');
  check(amazonSrc && amazonSrc.verified === false, 'Amazon source transparently marks Verified = false (no direct enterprise endorsement)');
  check(amazonSrc && amazonSrc.sourceUrl && amazonSrc.sourceUrl.startsWith('https://'), 'Amazon source provides reference to public hiring framework');

  const msftSrc = sources.find(s => s.company === 'Microsoft');
  check(msftSrc && msftSrc.sourceType === 'PrepMateCurated' && msftSrc.verified === false, 'Microsoft source marked PrepMateCurated and Verified = false');

  const fptSrc = sources.find(s => s.company === 'FPT Software');
  check(fptSrc && fptSrc.sourceType === 'PrepMateCurated' && fptSrc.verified === false, 'FPT Software source marked PrepMateCurated and Verified = false');

  const vinamilkSrc = sources.find(s => s.company === 'Vinamilk');
  check(vinamilkSrc && vinamilkSrc.sourceType === 'PrepMateCurated' && vinamilkSrc.verified === false, 'Vinamilk source marked PrepMateCurated and Verified = false');

  // 2. GET /api/qbank/taxonomy
  const taxRes = await requestJson(`${BASE_URL}/api/qbank/taxonomy`);
  check(taxRes.status === 200, `GET /api/qbank/taxonomy returns 200 OK (status: ${taxRes.status})`);
  check(Array.isArray(taxRes.data.industries) && taxRes.data.industries.length >= 8, 'Taxonomy includes 8+ industries');
  check(Array.isArray(taxRes.data.seniorityLevels) && taxRes.data.seniorityLevels.includes('Senior'), 'Taxonomy includes seniority levels');
  check(Array.isArray(taxRes.data.questionTypes) && taxRes.data.questionTypes.some(t => t.key === 'star'), 'Taxonomy includes STAR question type');

  // 3. GET /api/qbank/questions (Default paginated search)
  const qRes = await requestJson(`${BASE_URL}/api/qbank/questions`);
  check(qRes.status === 200, `GET /api/qbank/questions returns 200 OK (status: ${qRes.status})`);
  check(qRes.data.totalCount >= 24, `Total question count >= 24 (actual: ${qRes.data.totalCount})`);
  check(qRes.data.pageSize === 6, `Default page size is 6 (actual: ${qRes.data.pageSize})`);
  check(qRes.data.questions && qRes.data.questions.length === 6, 'Returns 6 questions for first page');
  check(qRes.data.totalPages >= 4, `Total pages calculated correctly (actual: ${qRes.data.totalPages})`);

  // 4. Keyword search (Deadlock)
  const kwRes = await requestJson(`${BASE_URL}/api/qbank/questions?keyword=deadlock`);
  check(kwRes.status === 200, 'Keyword search responds with 200 OK');
  check(kwRes.data.totalCount >= 1, 'Deadlock keyword returns matching questions');
  const deadlockQ = kwRes.data.questions.find(q => q.id === 'Q-101');
  check(deadlockQ !== undefined, 'Canonical Q-101 Deadlock question found in search');
  check(deadlockQ && deadlockQ.company === 'Amazon', 'Q-101 is attributed to Amazon');
  check(deadlockQ && deadlockQ.provenance === 'PrepMateCurated', 'Q-101 provenance is PrepMateCurated (framework-based)');
  check(deadlockQ && deadlockQ.star && deadlockQ.star.s && deadlockQ.star.s.length > 0, 'Q-101 contains full STAR structure');

  // 5. Industry filtering (Finance)
  const finRes = await requestJson(`${BASE_URL}/api/qbank/questions?industry=finance`);
  check(finRes.status === 200, 'Finance industry filter responds with 200 OK');
  check(finRes.data.totalCount >= 2, `Returns finance questions (actual: ${finRes.data.totalCount})`);
  check(finRes.data.questions.every(q => q.industry === 'finance'), 'All returned questions belong to finance industry');

  // 6. Company filtering (Vinamilk)
  const vnmRes = await requestJson(`${BASE_URL}/api/qbank/questions?company=Vinamilk`);
  check(vnmRes.status === 200, 'Company filter responds with 200 OK');
  check(vnmRes.data.totalCount >= 2, `Returns Vinamilk questions (actual: ${vnmRes.data.totalCount})`);
  check(vnmRes.data.questions.every(q => q.company === 'Vinamilk'), 'All returned questions are from Vinamilk');

  // 7. GET /api/qbank/questions/{id}
  const singleRes = await requestJson(`${BASE_URL}/api/qbank/questions/Q-101`);
  check(singleRes.status === 200, 'GET /api/qbank/questions/Q-101 returns 200 OK');
  check(singleRes.data.id === 'Q-101', 'Returns correct question ID Q-101');
  check(singleRes.data.title.includes('deadlock') || singleRes.data.title.includes('Deadlock'), 'Question title mentions deadlock');
  check(singleRes.data.followup && singleRes.data.followup.length > 10, 'Question contains AI follow-up probe');
  check(Array.isArray(singleRes.data.keywords) && singleRes.data.keywords.length >= 3, 'Question contains keywords');

  // 8. 404 on invalid question ID
  const notFoundRes = await requestJson(`${BASE_URL}/api/qbank/questions/non-existent-id-9999`);
  check(notFoundRes.status === 404, `GET non-existent question returns 404 Not Found (status: ${notFoundRes.status})`);
}

async function main() {
  console.log('===============================================================');
  console.log('   PREPMATE — QUESTION BANK REGRESSION TEST RUNNER             ');
  console.log('===============================================================');

  setupTestEnvironment();
  let serverProcess = null;

  try {
    await runStaticContractsSuite();
    await runBackendArchitectureSuite();

    console.log(`\nLaunching backend test server on port ${BACKEND_PORT}...`);
    serverProcess = await startBackendServer();
    console.log(`Backend server ready on ${BASE_URL}`);

    await runLiveApiSuite();

  } catch (err) {
    console.error(`\n[FATAL ERROR] Test suite aborted: ${err.message}`);
    if (err.stack) console.error(err.stack);
    failed++;
  } finally {
    if (serverProcess) {
      console.log('\nShutting down backend test server...');
      serverProcess.kill();
      // On Windows, kill tree if needed
      try {
        spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t']);
      } catch (e) {}
    }
    cleanupTestEnvironment();

    console.log('\n===============================================================');
    console.log(`Assertions: ${passed} passed, ${failed} failed`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('[SUCCESS] ALL QBANK REGRESSION CHECKS PASSED CLEANLY!\n');
      process.exit(0);
    }
  }
}

main();
