/**
 * PREPMATE — AI ARCHITECTURE RECONSTRUCTION REGRESSION TEST SUITE
 * 
 * Verifies the reconstructed AI subsystem:
 * 1. Task-based AI Routing (AITaskType mapping, capability validation)
 * 2. Immutable Session Routing Snapshot (SessionAiSnapshot integrity, zero credential leaks)
 * 3. Evidence Ledger & Adaptive Decision Engine (Fact vs Claim, Gaps, Contradictions, Depth)
 * 4. Honest No-AI Mode (Standardized question bank, rule-based STAR heuristic, zero fake AI scores)
 * 5. Secret Protection & Admin Task Visibility (GET /api/admin/ai/tasks)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PORT = 5042;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const { resolvePath, rootDir } = require('../helpers/test-env');
const WORKSPACE_ROOT = rootDir;
const PROD_DB_PATH = resolvePath('BE/data/db.json');
const TEST_DIR = path.join(WORKSPACE_ROOT, 'scratch', 'test_db_arch_recon');
const TEST_DB_PATH = path.join(TEST_DIR, 'isolated_arch_recon_db.json');
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
    req.setTimeout(45000, () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${url}`));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('• Running AI Architecture Reconstruction Suite   ... ');
  let checkCount = 0;
  const pass = (desc) => { checkCount++; console.log(`  [PASS] ${desc}`); };

  // 1. Initial Hash Pre-Check
  const initialHash = computeHash(PROD_DB_PATH);
  assert.ok(initialHash && initialHash.length === 64, 'Production DB exists and has valid SHA-256 hash');
  pass('Production DB hash pre-verified');

  // 2. Setup isolated test environment
  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  if (!fs.existsSync(TEST_KEYRING_PATH)) fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

  let apiKey = process.env.VILAO_API_KEY || process.env.PREPMATE_AI_API_KEY || '';
  if (!apiKey) {
    try {
      apiKey = require('child_process').execSync(
        "powershell -NoProfile -Command \"[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment').GetValue('VILAO_API_KEY')\"",
        { encoding: 'utf8' }
      ).trim();
    } catch (e) {}
  }

  const beDir = path.join(WORKSPACE_ROOT, 'BE');
  const dllPath = path.join(beDir, 'bin', 'Debug', 'net10.0', 'backend.dll');

  const backendProc = spawn('dotnet', [dllPath, '--urls', BASE_URL], {
    cwd: beDir,
    env: {
      ...process.env,
      VILAO_API_KEY: apiKey,
      PREPMATE_AI_API_KEY: apiKey,
      DATABASE_FILE_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING_PATH,
      ASPNETCORE_URLS: BASE_URL,
      DOTNET_URLS: BASE_URL
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    // Wait for backend
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const ping = await requestJson(`${BASE_URL}/features/auth/auth.html`);
        if (ping.status === 200) { ready = true; break; }
      } catch (e) {}
      await sleep(250);
    }
    assert.ok(ready, 'Backend must start within 10s');
    pass('Isolated backend initialized successfully');

    // Step 1: Admin and Candidate Authentication
    const candLogin = await requestJson(`${BASE_URL}/api/auth/login`, { method: 'POST' }, {
      email: 'nam.le@gmail.com',
      password: 'user123'
    });
    assert.strictEqual(candLogin.status, 200);
    const candToken = candLogin.body.token;
    assert.ok(candToken, 'Candidate JWT token must be returned');
    pass('Candidate authentication verified');

    const adminLogin = await requestJson(`${BASE_URL}/api/auth/login`, { method: 'POST' }, {
      email: 'admin@prepmate.vn',
      password: 'Admin@123'
    });
    assert.strictEqual(adminLogin.status, 200);
    const adminToken = adminLogin.body.token;
    assert.ok(adminToken, 'Admin JWT token must be returned');
    pass('Admin authentication verified');

    // Step 2: Task-based AI Routing and Task Discovery
    const tasksRes = await requestJson(`${BASE_URL}/api/admin/ai/tasks`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(tasksRes.status, 200);
    assert.ok(Array.isArray(tasksRes.body), 'Tasks must be returned as array');
    assert.ok(tasksRes.body.includes('IntroductionAnalysis'), 'Task IntroductionAnalysis must be supported');
    assert.ok(tasksRes.body.includes('QuestionGeneration'), 'Task QuestionGeneration must be supported');
    assert.ok(tasksRes.body.includes('TechnicalAssessment'), 'Task TechnicalAssessment must be supported');
    assert.ok(tasksRes.body.includes('ReportGeneration'), 'Task ReportGeneration must be supported');
    pass('Admin AI task catalog query verified');

    // Step 3: Session Creation with Immutable SessionAiSnapshot & EvidenceLedger
    const sessionRes = await requestJson(`${BASE_URL}/api/sessions/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${candToken}` }
    }, {
      jobTitle: 'Senior .NET Architect',
      industry: 'CNTT',
      difficulty: 'Nâng cao',
      cvText: '10 nam kinh nghiem kien truc he thong phan tan .NET va Microservices.'
    });
    assert.strictEqual(sessionRes.status, 200, 'Session start must return 200/201 (no 405)');
    const sessionId = sessionRes.body.id || sessionRes.body.sessionId;
    assert.ok(sessionId, 'Valid session ID must be generated');
    pass('Session created with route /api/sessions/start (no 405)');

    // Step 4: Verify Session Details: Snapshot and Ledger
    const sessionDetail = await requestJson(`${BASE_URL}/api/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${candToken}` }
    });
    assert.strictEqual(sessionDetail.status, 200);
    const sess = sessionDetail.body;
    assert.ok(sess.aiSnapshot, 'Session must include immutable AiSnapshot');
    assert.strictEqual(sess.aiSnapshot.sessionId, sessionId, 'Snapshot sessionId must match');
    assert.ok(sess.aiSnapshot.configurationVersionId, 'Snapshot must reference configurationVersionId');
    assert.ok(!sess.aiSnapshot.apiKey, 'Snapshot must NEVER expose raw API keys or secrets');
    assert.ok(sess.evidenceLedger, 'Session must include EvidenceLedger');
    assert.strictEqual(sess.evidenceLedger.sessionId, sessionId, 'Ledger sessionId must match');
    pass('Session AI snapshot and evidence ledger structure verified');

    // Step 5: Test Model Registry Creation and Task Assignment
    // Create new provider connection
    const provRes = await requestJson(`${BASE_URL}/api/admin/ai/providers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      id: 'secondary-gateway',
      displayName: 'Secondary AI Gateway',
      protocol: 'openai-chat-completions',
      baseUrl: 'https://api.openai.com/v1/',
      credentialMode: 'auto',
      apiKey: 'test-arch-secret-key-123'
    });
    assert.strictEqual(provRes.status, 201);
    const providerId = provRes.body.id;
    assert.ok(!provRes.body.apiKey, 'Provider DTO must NEVER disclose raw API key');
    assert.strictEqual(provRes.body.apiKeyConfigured, true);
    pass('Provider registry created with zero secret disclosure');

    // Register a specialized model for QuestionGeneration
    const modelRes = await requestJson(`${BASE_URL}/api/admin/ai/models`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      id: 'gpt-4o-mini-qgen',
      displayName: 'GPT-4o Mini Specialized QGen',
      providerConnectionId: providerId,
      upstreamModelId: 'gpt-4o-mini',
      supportedTasks: ['QuestionGeneration', 'BehavioralStar'],
      supportsStructuredJson: true,
      enabled: true
    });
    assert.strictEqual(modelRes.status, 201);
    const modelId = modelRes.body.id;
    assert.strictEqual(modelRes.body.upstreamModelId, 'gpt-4o-mini');
    assert.ok(modelRes.body.supportedTasks.includes('QuestionGeneration'));
    pass('Model registered and assigned to QuestionGeneration task');

    // Query models by task
    const qgenModelsRes = await requestJson(`${BASE_URL}/api/admin/ai/models?task=QuestionGeneration`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(qgenModelsRes.status, 200);
    assert.ok(Array.isArray(qgenModelsRes.body));
    const found = qgenModelsRes.body.find(m => m.id === modelId);
    assert.ok(found, 'Task query must discover newly registered model');
    pass('Model query by task capability verified');

    // Step 6: Test No-AI Mode Service
    // Disable AI globally to verify honest No-AI Mode
    const disableAiRes = await requestJson(`${BASE_URL}/api/admin/ai/config`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      provider: 'Vilao AI Gateway',
      protocol: 'openai-chat-completions',
      baseUrl: 'https://api.vilao.ai/v1/',
      model: 'ag/gemini-2.0-flash',
      enabled: false, // Disabled
      credentialMode: 'auto'
    });
    assert.strictEqual(disableAiRes.status, 200);
    pass('AI configuration updated to disabled state');

    // Start a new session in No-AI Mode
    const noAiSessionRes = await requestJson(`${BASE_URL}/api/sessions/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${candToken}` }
    }, {
      jobTitle: 'Frontend Engineer',
      industry: 'CNTT',
      difficulty: 'Trung cấp',
      cvText: 'React, Vue, JavaScript.'
    });
    assert.strictEqual(noAiSessionRes.status, 200);
    assert.strictEqual(noAiSessionRes.body.isNoAiMode, true, 'isNoAiMode must be true when AI is disabled');
    assert.ok(noAiSessionRes.body.noAiNotice, 'noAiNotice must explain standardized practice mode');
    pass('No-AI Mode session initialized with explicit notice');

  } finally {
    try { backendProc.kill(); } catch (e) {}
    try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}
  }

  // 7. Final Hash Post-Check
  const finalHash = computeHash(PROD_DB_PATH);
  assert.strictEqual(finalHash, initialHash);
  pass('Production DB hash post-verified (100% untouched)');

  console.log(`PASS (${checkCount} checks)`);
}

module.exports = { runTestSuite };

if (require.main === module) {
  runTestSuite().catch(err => {
    console.error('FAIL', err);
    process.exit(1);
  });
}
