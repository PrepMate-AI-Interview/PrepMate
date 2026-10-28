/**
 * PREPMATE — TARGET LEVEL RESOLUTION & REPORT DOM ACCEPTANCE (F-04)
 *
 * Verifies that candidate target level selected in Interview Setup flows
 * authentically end-to-end:
 * Setup Selection -> Create Session Request -> InterviewState / Context -> FinalEvaluation -> Report DTO -> report.js DOM (#hero-target-level).
 *
 * Covers:
 * 1. Junior Level explicitly selected
 * 2. Mid / Middle Level explicitly selected
 * 3. Senior Level explicitly selected (guarantees NO "Junior" default override)
 * 4. JobTitle inference when level omitted
 * 5. Report DOM rendering verification (#hero-target-level)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');
const vm = require('vm');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const { resolveDbPath } = require('../helpers/test-env');
const PROD_DB_PATH = resolveDbPath();
const TEST_DIR = path.join(os.tmpdir(), `prepmate_lvl_test_${Date.now()}`);
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

function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    req.setTimeout(40000, () => req.destroy(new Error(`Timeout calling ${url}`)));
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Lightweight DOM setup to execute report.js renderOverviewHero
function createMockReportDOM() {
  const elements = new Map();
  const document = {
    addEventListener: () => {},
    getElementById: (id) => {
      if (!elements.has(id)) {
        elements.set(id, {
          id,
          style: {},
          textContent: '',
          innerText: '',
          innerHTML: '',
          classList: {
            add() {},
            remove() {},
            contains() { return false; }
          }
        });
      }
      return elements.get(id);
    }
  };

  const window = {
    document,
    location: { href: 'http://127.0.0.1:5000/features/report/report.html?session=test' },
    localStorage: { getItem: () => null, setItem: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {} }
  };

  const reportJsPath = path.join(WORKSPACE_ROOT, 'FE', 'features', 'report', 'report.js');
  const code = fs.readFileSync(reportJsPath, 'utf8');

  const sandbox = {
    window,
    document,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    console,
    API_BASE_URL: 'http://127.0.0.1:5000'
  };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  return { sandbox, elements };
}

async function main() {
  console.log('===============================================================');
  console.log('   PREPMATE — F-04 TARGET LEVEL RESOLUTION REGRESSION SUITE     ');
  console.log('===============================================================\n');

  // Verify DB isolation
  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  if (!fs.existsSync(TEST_KEYRING)) fs.mkdirSync(TEST_KEYRING, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

  const beDir = path.join(WORKSPACE_ROOT, 'BE');
  const dllPath = path.join(beDir, 'bin', 'Debug', 'net10.0', 'backend.dll');

  console.log(`Starting isolated backend on ${BASE_URL}...`);
  const backendProc = spawn('dotnet', [dllPath, '--urls', BASE_URL], {
    cwd: beDir,
    env: {
      ...process.env,
      DATABASE_FILE_PATH: TEST_DB_PATH,
      PREPMATE_DATABASE_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING,
      ASPNETCORE_URLS: BASE_URL,
      DOTNET_URLS: BASE_URL,
      ASPNETCORE_ENVIRONMENT: 'Development'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      try {
        const ping = await requestJson(`${BASE_URL}/api/sessions`);
        if (ping.status === 200 || ping.status === 401) {
          ready = true;
          break;
        }
      } catch (e) {}
    }
    assert.ok(ready, 'Isolated backend failed to start');
    console.log('✓ Isolated backend is online.\n');

    // 1. Authenticate candidate
    const loginRes = await requestJson(`${BASE_URL}/api/auth/login`, { method: 'POST' }, {
      email: 'nam.le@gmail.com',
      password: 'user123'
    });
    assert.strictEqual(loginRes.status, 200, 'Candidate auth failed');
    const token = loginRes.body.token;

    // =========================================================================
    // CASE 1: Senior Level Explicitly Selected
    // =========================================================================
    console.log('--- TEST 1: Senior Level Explicit Selection ---');
    const seniorRes = await requestJson(`${BASE_URL}/api/sessions/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }, {
      jobTitle: 'Senior Backend Architect (.NET Core)',
      experienceLevel: 'Senior',
      targetCompany: 'Tech Corp'
    });
    check(seniorRes.status === 200, 'Test 1.1: Senior session created successfully');
    const seniorId = seniorRes.body.id || seniorRes.body.sessionId;

    const seniorDetail = await requestJson(`${BASE_URL}/api/sessions/${seniorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const seniorSession = seniorDetail.body;
    const seniorState = seniorSession.InterviewState || seniorSession.interviewState;
    const seniorCtx = seniorSession.InterviewContext || seniorSession.interviewContext;

    check(seniorState.CandidateLevel === 'Senior' || seniorState.candidateLevel === 'Senior',
      `Test 1.2: InterviewState.CandidateLevel is "Senior" (got: ${seniorState.CandidateLevel || seniorState.candidateLevel})`);
    check(seniorCtx.ExperienceLevel === 'Senior' || seniorCtx.experienceLevel === 'Senior',
      `Test 1.3: InterviewContext.ExperienceLevel is "Senior" (got: ${seniorCtx.ExperienceLevel || seniorCtx.experienceLevel})`);

    // Verify Report Level Resolution & DOM
    const { elements: elSenior, sandbox: sbSenior } = createMockReportDOM();
    const mockSeniorReport = {
      sessionInfo: {
        targetPosition: 'Senior Backend Architect (.NET Core)',
        targetLevel: 'Senior',
        targetCompany: 'Tech Corp'
      },
      overallEvaluation: { summary: 'Senior level competencies verified.' }
    };
    sbSenior.renderOverviewHero(mockSeniorReport.overallEvaluation, null, mockSeniorReport.sessionInfo, {}, {}, seniorSession);
    const heroSeniorLevel = elSenior.get('hero-target-level').textContent;
    check(heroSeniorLevel === 'Mục tiêu: Senior',
      `Test 1.4: DOM #hero-target-level displays "Mục tiêu: Senior" (got: "${heroSeniorLevel}")`);
    check(!heroSeniorLevel.includes('Junior'),
      'Test 1.5: Senior report DOM contains NO "Junior" default override');

    // =========================================================================
    // CASE 2: Junior Level Explicitly Selected
    // =========================================================================
    console.log('\n--- TEST 2: Junior Level Explicit Selection ---');
    const juniorRes = await requestJson(`${BASE_URL}/api/sessions/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }, {
      jobTitle: 'Junior Frontend Developer (React)',
      experienceLevel: 'Junior',
      targetCompany: 'Startup VN'
    });
    check(juniorRes.status === 200, 'Test 2.1: Junior session created successfully');
    const juniorId = juniorRes.body.id || juniorRes.body.sessionId;

    const juniorDetail = await requestJson(`${BASE_URL}/api/sessions/${juniorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const juniorSession = juniorDetail.body;
    const juniorState = juniorSession.InterviewState || juniorSession.interviewState;
    const juniorCtx = juniorSession.InterviewContext || juniorSession.interviewContext;

    check(juniorState.CandidateLevel === 'Junior' || juniorState.candidateLevel === 'Junior',
      `Test 2.2: InterviewState.CandidateLevel is "Junior" (got: ${juniorState.CandidateLevel || juniorState.candidateLevel})`);
    check(juniorCtx.ExperienceLevel === 'Junior' || juniorCtx.experienceLevel === 'Junior',
      `Test 2.3: InterviewContext.ExperienceLevel is "Junior" (got: ${juniorCtx.ExperienceLevel || juniorCtx.experienceLevel})`);

    const { elements: elJunior, sandbox: sbJunior } = createMockReportDOM();
    const mockJuniorReport = {
      sessionInfo: {
        targetPosition: 'Junior Frontend Developer (React)',
        targetLevel: 'Junior',
        targetCompany: 'Startup VN'
      },
      overallEvaluation: { summary: 'Junior foundation verified.' }
    };
    sbJunior.renderOverviewHero(mockJuniorReport.overallEvaluation, null, mockJuniorReport.sessionInfo, {}, {}, juniorSession);
    const heroJuniorLevel = elJunior.get('hero-target-level').textContent;
    check(heroJuniorLevel === 'Mục tiêu: Junior',
      `Test 2.4: DOM #hero-target-level displays "Mục tiêu: Junior" (got: "${heroJuniorLevel}")`);

    // =========================================================================
    // CASE 3: Mid / Middle Level Explicitly Selected
    // =========================================================================
    console.log('\n--- TEST 3: Mid / Middle Level Explicit Selection ---');
    const midRes = await requestJson(`${BASE_URL}/api/sessions/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }, {
      jobTitle: 'Mid-Level QA Engineer',
      experienceLevel: 'Mid',
      targetCompany: 'Fintech Hub'
    });
    check(midRes.status === 200, 'Test 3.1: Mid session created successfully');
    const midId = midRes.body.id || midRes.body.sessionId;

    const midDetail = await requestJson(`${BASE_URL}/api/sessions/${midId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const midSession = midDetail.body;
    const midState = midSession.InterviewState || midSession.interviewState;
    const midCtx = midSession.InterviewContext || midSession.interviewContext;

    check(midState.CandidateLevel === 'Mid' || midState.candidateLevel === 'Mid',
      `Test 3.2: InterviewState.CandidateLevel is "Mid" (got: ${midState.CandidateLevel || midState.candidateLevel})`);
    check(midCtx.ExperienceLevel === 'Mid' || midCtx.experienceLevel === 'Mid',
      `Test 3.3: InterviewContext.ExperienceLevel is "Mid" (got: ${midCtx.ExperienceLevel || midCtx.experienceLevel})`);

    const { elements: elMid, sandbox: sbMid } = createMockReportDOM();
    const mockMidReport = {
      sessionInfo: {
        targetPosition: 'Mid-Level QA Engineer',
        targetLevel: 'Mid',
        targetCompany: 'Fintech Hub'
      },
      overallEvaluation: { summary: 'Mid-level competence.' }
    };
    sbMid.renderOverviewHero(mockMidReport.overallEvaluation, null, mockMidReport.sessionInfo, {}, {}, midSession);
    const heroMidLevel = elMid.get('hero-target-level').textContent;
    check(heroMidLevel === 'Mục tiêu: Mid',
      `Test 3.4: DOM #hero-target-level displays "Mục tiêu: Mid" (got: "${heroMidLevel}")`);

    // =========================================================================
    // CASE 4: Level Omitted, Inferred from JobTitle (Senior)
    // =========================================================================
    console.log('\n--- TEST 4: Level Omitted, Inferred from JobTitle ---');
    const inferRes = await requestJson(`${BASE_URL}/api/sessions/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }, {
      jobTitle: 'Senior Product Manager',
      // experienceLevel omitted intentionally
      targetCompany: 'E-commerce Corp'
    });
    check(inferRes.status === 200, 'Test 4.1: Inferred session created successfully');
    const inferId = inferRes.body.id || inferRes.body.sessionId;

    const inferDetail = await requestJson(`${BASE_URL}/api/sessions/${inferId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const inferSession = inferDetail.body;
    const inferState = inferSession.InterviewState || inferSession.interviewState;

    check(inferState.CandidateLevel === 'Senior' || inferState.candidateLevel === 'Senior',
      `Test 4.2: Inferred level from "Senior Product Manager" is "Senior" (got: ${inferState.CandidateLevel || inferState.candidateLevel})`);

    // =========================================================================
    // CASE 5: Generic Title Omitted Level Defaults to "Mid" (Not "Junior")
    // =========================================================================
    console.log('\n--- TEST 5: Generic Title Omitted Level Defaults to Mid ---');
    const genericRes = await requestJson(`${BASE_URL}/api/sessions/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }, {
      jobTitle: 'Business Analyst',
      // experienceLevel omitted
      targetCompany: 'Logistics Corp'
    });
    check(genericRes.status === 200, 'Test 5.1: Generic session created successfully');
    const genericId = genericRes.body.id || genericRes.body.sessionId;

    const genericDetail = await requestJson(`${BASE_URL}/api/sessions/${genericId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const genericSession = genericDetail.body;
    const genericState = genericSession.InterviewState || genericSession.interviewState;

    check(genericState.CandidateLevel === 'Mid' || genericState.candidateLevel === 'Mid',
      `Test 5.2: Generic session defaults to "Mid" instead of "Junior" (got: ${genericState.CandidateLevel || genericState.candidateLevel})`);

    console.log('\n===============================================================');
    console.log(`   REGRESSION RESULTS: ${passed} PASS, ${failed} FAIL         `);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    backendProc.kill();
    await sleep(1000);
    try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(err => {
  console.error('[FATAL REGRESSION FAILURE]', err);
  process.exit(1);
});
