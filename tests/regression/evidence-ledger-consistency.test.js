/**
 * PREPMATE — EVIDENCE LEDGER CONSISTENCY & FACT/CLAIM ISOLATION TEST SUITE
 * 
 * Verifies:
 * 1. Evidence is appended after each turn in EvidenceLedger.
 * 2. Cross-session isolation: zero evidence leakage between sessions.
 * 3. Missing metrics: when candidate admits missing latency/throughput metrics, zero hallucinated numbers are created.
 * 4. Groundedness: technologies not mentioned by candidate (e.g. Redis, Kafka) are NEVER attributed to them.
 * 5. Validation gate: candidate self-reported claims (Outbox, RabbitMQ, gRPC) are categorized under UnverifiedClaims, NOT VerifiedFacts.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');

const PORT = 5044;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const { resolveDbPath } = require('../helpers/test-env');
const PROD_DB_PATH = resolveDbPath();
const TEST_DIR = path.join(os.tmpdir(), `prepmate_ledger_test_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, 'isolated_ledger_test_db.json');
const TEST_KEYRING_PATH = path.join(TEST_DIR, 'test_keys');

function computeHash(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
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
    req.setTimeout(40000, () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${url}`));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function pass(msg) {
  console.log(`  [PASS] ${msg}`);
}

async function runSuite() {
  console.log('--- Starting Evidence Ledger Consistency & Fact/Claim Isolation Tests ---');
  let backendProc = null;

  const baselineHash = computeHash(PROD_DB_PATH);

  try {
    if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
    if (!fs.existsSync(TEST_KEYRING_PATH)) fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
    fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

    let apiKey = '';
    try {
      apiKey = require('child_process').execSync(
        "powershell -NoProfile -Command \"[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment').GetValue('VILAO_API_KEY')\"",
        { encoding: 'utf8' }
      ).trim();
    } catch (e) {}

    const beDir = path.join(WORKSPACE_ROOT, 'BE');
    const dllPath = path.join(beDir, 'bin', 'Debug', 'net10.0', 'backend.dll');

    backendProc = spawn('dotnet', [dllPath, '--urls', BASE_URL], {
      cwd: beDir,
      env: {
        ...process.env,
        VILAO_API_KEY: apiKey,
        PREPMATE_AI_API_KEY: apiKey,
        DATABASE_FILE_PATH: TEST_DB_PATH,
        PREPMATE_DATABASE_PATH: TEST_DB_PATH,
        PREPMATE_KEYRING_PATH: TEST_KEYRING_PATH,
        ASPNETCORE_URLS: BASE_URL,
        DOTNET_URLS: BASE_URL,
        ASPNETCORE_ENVIRONMENT: 'Development'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let isListening = false;
    for (let i = 0; i < 30; i++) {
      await sleep(250);
      try {
        const res = await requestJson(`${BASE_URL}/features/auth/auth.html`);
        if (res.status === 200) {
          isListening = true;
          break;
        }
      } catch (e) {}
    }

    assert.ok(isListening, 'Backend must start and respond on health endpoint');
    pass('Backend started with isolated test database');

    // Authenticate candidate
    const candLogin = await requestJson(`${BASE_URL}/api/auth/login`, { method: 'POST' }, {
      email: 'nam.le@gmail.com',
      password: 'user123'
    });
    assert.strictEqual(candLogin.status, 200);
    const candToken = candLogin.body.token || candLogin.body.Token;
    assert.ok(candToken, 'Candidate JWT token must be returned');
    const authHeaders = {
      Authorization: `Bearer ${candToken}`
    };

    // STEP 1: CREATE SESSION A
    const resA = await requestJson(`${BASE_URL}/api/sessions/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${candToken}` }
    }, {
      jobTitle: 'Senior Backend Developer (.NET Core)',
      industry: 'CNTT',
      difficulty: 'Nâng cao'
    });
    assert.strictEqual(resA.status, 200);
    const sessionAId = resA.body.id || resA.body.sessionId;
    assert.ok(sessionAId, 'Session A must have valid ID');
    pass('Session A initialized');

    // STEP 2: CREATE SESSION B (To test session isolation)
    const resB = await requestJson(`${BASE_URL}/api/sessions/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${candToken}` }
    }, {
      jobTitle: 'Marketing Director',
      industry: 'Marketing',
      difficulty: 'Trung cấp'
    });
    assert.strictEqual(resB.status, 200);
    const sessionBId = resB.body.id || resB.body.sessionId;
    assert.ok(sessionBId && sessionBId !== sessionAId, 'Session B must have distinct ID');
    pass('Session B initialized independently');

    // STEP 3: SUBMIT TURN 1 INTRODUCTION ON SESSION A
    const introResA = await requestJson(`${BASE_URL}/api/ai/introduction`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${candToken}` }
    }, {
      sessionId: sessionAId,
      introduction: 'Tôi là Nam, kỹ sư phần mềm backend .NET Core chuyên về vi dịch vụ.'
    });
    if (introResA.status !== 200) {
      console.log('Intro response failed:', introResA.status, introResA.body);
    }
    assert.strictEqual(introResA.status, 200, 'Introduction must succeed');
    pass('Turn 1 (Introduction) processed on Session A');

    // Read Session A ledger after Turn 1
    const testDb1 = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
    const sessA1 = testDb1.Sessions[sessionAId];
    assert.ok(sessA1.EvidenceLedger, 'Session A must have EvidenceLedger');
    assert.strictEqual(sessA1.EvidenceLedger.TurnRecords.length, 1, 'Session A must have 1 TurnRecord after Turn 1');
    const turn1A = sessA1.EvidenceLedger.TurnRecords[0];
    assert.strictEqual(turn1A.TurnNumber, 1);
    assert.strictEqual(turn1A.TargetCompetency, 'Introduction');

    // Check Fact vs Claim in Turn 1: Introduction claims are unverified claims, not confirmed facts!
    const introComp = sessA1.EvidenceLedger.Competencies['Introduction'];
    assert.ok(introComp, 'Introduction competency must be created in ledger');
    assert.strictEqual(introComp.ConfirmedFacts.length, 0, 'Self-introduction must NOT create confirmed facts prematurely');
    assert.ok(introComp.UnverifiedClaims.length > 0, 'Self-introduction must populate UnverifiedClaims');
    pass('Rule: Self-reported introduction is recorded under UnverifiedClaims without false VerifiedFacts');

    // STEP 4: SUBMIT TURN 2 ON SESSION A (Constrained answer: Outbox, RabbitMQ, gRPC; NO metrics)
    const currentQ = sessA1.Questions[0] || 'Dịch vụ cốt lõi và ranh giới service boundary';
    const answerResA = await requestJson(`${BASE_URL}/api/ai/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${candToken}` }
    }, {
      sessionId: sessionAId,
      question: currentQ,
      message: 'Trong dự án này, tôi áp dụng Outbox Pattern kết hợp RabbitMQ để gửi message bất đồng bộ nhằm đảm bảo tính nhất quán dữ liệu giữa các service, đồng thời sử dụng gRPC cho các giao tiếp đồng bộ nội bộ cần tốc độ cao. Do hệ thống đang ở giai đoạn pilot thử nghiệm nội bộ nên chúng tôi chưa tiến hành đo đạc các con số cụ thể về latency (độ trễ) hay throughput (thông lượng tải).'
    });
    if (answerResA.status !== 200) {
      console.log('Turn 2 response failed:', answerResA.status, answerResA.body);
    }
    assert.strictEqual(answerResA.status, 200, 'Turn 2 answer submission must succeed');
    pass('Turn 2 processed on Session A');

    // Read Session A ledger after Turn 2
    const testDb2 = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
    const sessA2 = testDb2.Sessions[sessionAId];
    const sessB2 = testDb2.Sessions[sessionBId];

    // Check TurnRecords incremented
    assert.strictEqual(sessA2.EvidenceLedger.TurnRecords.length, 2, 'Session A must have 2 TurnRecords after Turn 2');
    pass('Evidence is appended after each turn in EvidenceLedger');

    // Check Session Isolation: Session B must NOT have any TurnRecords from Session A
    assert.strictEqual(sessB2.EvidenceLedger?.TurnRecords?.length || 0, 0, 'Session B must NOT receive any evidence from Session A');
    assert.strictEqual(sessA2.EvidenceLedger.SessionId, sessionAId, 'Ledger SessionId must strictly match Session A');
    assert.strictEqual(sessB2.EvidenceLedger.SessionId, sessionBId, 'Ledger SessionId must strictly match Session B');
    pass('Cross-session isolation verified: zero evidence leakage between sessions');

    // Check Turn 2 Evidence in Competencies
    const turn2Record = sessA2.EvidenceLedger.TurnRecords[1];
    assert.strictEqual(turn2Record.TurnNumber, 2);
    const compName = turn2Record.TargetCompetency;
    const targetComp = sessA2.EvidenceLedger.Competencies[compName];
    assert.ok(targetComp, `Target competency ${compName} must exist in ledger`);

    // Verify Outbox, RabbitMQ, gRPC in UnverifiedClaims
    const allClaims = (targetComp.UnverifiedClaims || []).concat(turn2Record.UnverifiedClaims || []);
    const claimsStr = allClaims.join(' ').toLowerCase();
    assert.ok(claimsStr.includes('outbox'), 'Outbox Pattern must be captured in UnverifiedClaims');
    assert.ok(claimsStr.includes('rabbitmq'), 'RabbitMQ must be captured in UnverifiedClaims');
    assert.ok(claimsStr.includes('grpc'), 'gRPC must be captured in UnverifiedClaims');
    pass('Candidate self-reported claims (Outbox, RabbitMQ, gRPC) recorded under UnverifiedClaims');

    // Verify VerifiedFacts is NOT falsely populated with unproven claims
    assert.strictEqual(targetComp.ConfirmedFacts.length, 0, 'Unproven self-declarations must NOT be recorded in ConfirmedFacts');
    pass('Validation gate: Model output not recorded directly as VerifiedFacts without proof');

    // Verify InformationGaps contains missing latency/throughput metrics
    const allGaps = (targetComp.InformationGaps || []).concat(turn2Record.InformationGaps || []);
    const gapsStr = allGaps.join(' ').toLowerCase();
    assert.ok(
      gapsStr.includes('số liệu') || gapsStr.includes('latency') || gapsStr.includes('throughput') || gapsStr.includes('pilot'),
      'Missing latency/throughput metrics must be recorded in InformationGaps'
    );
    pass('Missing metrics acknowledged by candidate are recorded under InformationGaps');

    // Verify NO fabricated metrics (e.g. 350ms, 45ms, 10.000 RPS) in ledger or turn record
    const fullLedgerStr = JSON.stringify(sessA2.EvidenceLedger).toLowerCase();
    assert.ok(!fullLedgerStr.includes('350ms'), 'Must NOT hallucinate 350ms');
    assert.ok(!fullLedgerStr.includes('10.000'), 'Must NOT hallucinate 10.000');
    assert.ok(!fullLedgerStr.includes('15.000'), 'Must NOT hallucinate 15.000');
    pass('Rule: Zero fabricated numbers/metrics in EvidenceLedger');

    // Verify NO unmentioned technologies (e.g. Redis, Kafka) in ledger
    assert.ok(!fullLedgerStr.includes('redis'), 'Must NOT attribute unmentioned technology Redis');
    assert.ok(!fullLedgerStr.includes('kafka'), 'Must NOT attribute unmentioned technology Kafka');
    pass('Rule: Technologies not mentioned by candidate are NEVER attributed to them');

    pass('All Evidence Ledger Consistency checks passed cleanly');
  } finally {
    if (backendProc) {
      backendProc.kill();
      await sleep(1500);
    }
    try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}

    // Final production DB check
    const postHash = computeHash(PROD_DB_PATH);
    assert.strictEqual(baselineHash, postHash, 'Production BE/data/db.json must remain 100% UNTOUCHED');
  }
}

runSuite().catch(err => {
  console.error('\n[TEST FAILURE]', err);
  process.exit(1);
});
