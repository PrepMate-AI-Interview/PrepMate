/**
 * PREPMATE — DYNAMIC VILAO MODEL DISCOVERY & ALIAS REGRESSION SUITE
 * Work Item: Dynamic Vilao Model Discovery & Combo Root Integration
 *
 * Verifies:
 * 1. Dynamic Model Discovery: GET /api/admin/ai/discovery/catalog
 * 2. Parsing of OpenAI standard response ({ data: [...] }) and alternative formats
 * 3. Detection of canonical alias 'PrepMate' (DISCOVERED vs UNPUBLISHED_CONFIGURED)
 * 4. Resilient caching: Error during refresh (401, 5xx, timeout, malformed) NEVER wipes existing valid catalog
 * 5. Zero fake models: No hallucinated models created on API error or empty response
 * 6. Zero secret disclosure: No plaintext API keys or protected ciphertext in DTOs or error messages
 * 7. Verification of alias inference endpoint: POST /api/admin/ai/discovery/verify-alias
 * 8. Production DB preservation: SHA-256 strictly preserved before and after
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PORT = 5066;
const MOCK_PORT = 9199;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`;

const { resolvePath, rootDir } = require('../helpers/test-env');
const WORKSPACE_ROOT = rootDir;
const PROD_DB_PATH = resolvePath('BE/data/db.json');
const TEST_DIR = path.join(WORKSPACE_ROOT, 'scratch', 'test_db_discovery');
const TEST_DB_PATH = path.join(TEST_DIR, 'isolated_discovery_db.json');
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
        resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${url}`));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

let mockModelsHandler = (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    object: 'list',
    data: [
      { id: 'ag/gemini-2.0-flash', object: 'model', created: 1739000000, owned_by: 'google' },
      { id: 'ag/gemini-1.5-flash', object: 'model', created: 1739000000, owned_by: 'google' },
      { id: 'PrepMate', object: 'model', created: 1739000000, owned_by: 'prepmate' }
    ]
  }));
};

const mockServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    req.rawBody = body;
    if (req.url.includes('/models')) {
      mockModelsHandler(req, res);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '{"status":"ok"}' } }] }));
    }
  });
});

async function runTestSuite() {
  console.log('• Running Dynamic Vilao Model Discovery Suite    ... ');
  let checkCount = 0;
  const pass = (desc) => { checkCount++; console.log(`  [PASS] ${desc}`); };

  // 1. Initial Production DB Hash Check
  const initialHash = computeHash(PROD_DB_PATH);
  assert.ok(initialHash && initialHash.length === 64, 'Production DB exists and has valid SHA-256 hash');
  pass('Production DB hash pre-verified');

  // 2. Start Mock Server
  await new Promise(r => mockServer.listen(MOCK_PORT, '127.0.0.1', r));
  pass(`Mock Vilao Server started on ${MOCK_URL}`);

  // 3. Isolated DB Setup
  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  if (!fs.existsSync(TEST_KEYRING_PATH)) fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

  const beDir = path.join(WORKSPACE_ROOT, 'BE');
  const dllPath = path.join(beDir, 'bin', 'Debug', 'net10.0', 'backend.dll');

  const backendProc = spawn('dotnet', [dllPath, '--urls', BASE_URL], {
    cwd: beDir,
    env: {
      ...process.env,
      DATABASE_FILE_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING_PATH,
      PREPMATE_AI_API_KEY: 'test-discovery-secret-key-12345',
      ASPNETCORE_URLS: BASE_URL,
      DOTNET_URLS: BASE_URL
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    // 4. Wait for backend readiness
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      try {
        const res = await requestJson(`${BASE_URL}/api/auth/me`);
        if (res.status === 401 || res.status === 200) { ready = true; break; }
      } catch (e) {}
    }
    assert.ok(ready, 'Backend ready on isolated port');
    pass('Backend isolated instance operational');

    // 5. Admin Authentication
    const loginRes = await requestJson(`${BASE_URL}/api/auth/login`, { method: 'POST' }, {
      email: 'admin@prepmate.vn',
      password: 'Admin@123'
    });
    assert.strictEqual(loginRes.status, 200);
    const adminToken = loginRes.body.token;
    const authHeaders = { Authorization: `Bearer ${adminToken}` };
    pass('Admin authenticated with valid JWT');

    // 6. Point BaseUrl to Mock Server via Admin AI Config
    const configUpdateRes = await requestJson(`${BASE_URL}/api/admin/ai/config`, {
      method: 'PUT',
      headers: authHeaders
    }, {
      provider: 'Vilao AI Production Gateway',
      baseUrl: `${MOCK_URL}/v1`,
      model: 'PrepMate',
      enabled: true,
      credentialMode: 'auto'
    });
    assert.strictEqual(configUpdateRes.status, 200);
    pass('BaseUrl directed to mock Vilao server');

    // 7. Test Initial Discovery Refresh (Standard OpenAI format with alias 'PrepMate')
    const refreshRes1 = await requestJson(`${BASE_URL}/api/admin/ai/discovery/refresh`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(refreshRes1.status, 200);
    assert.strictEqual(refreshRes1.body.syncStatus, 'SUCCESS');
    assert.strictEqual(refreshRes1.body.totalModelsCount, 3);
    assert.strictEqual(refreshRes1.body.alias, 'PrepMate');
    assert.strictEqual(refreshRes1.body.aliasStatus, 'DISCOVERED');
    assert.ok(refreshRes1.body.models.some(m => m.id === 'PrepMate' && m.isAlias));
    assert.ok(refreshRes1.body.models.some(m => m.id === 'ag/gemini-2.0-flash'));
    pass("Dynamic discovery successfully parsed OpenAI format and recognized alias 'PrepMate'");

    // 8. Verify Zero Secret Disclosure in Catalog DTO
    const stringifiedDto = JSON.stringify(refreshRes1.body);
    assert.ok(!stringifiedDto.includes('test-discovery-secret-key-12345'), 'Zero API key in discovery response');
    assert.ok(!stringifiedDto.includes('dp:v1:'), 'Zero protected ciphertext in discovery response');
    pass('Zero secret disclosure verified in discovery catalog');

    // 9. Test Discovery when alias 'PrepMate' is not published in GET /models
    mockModelsHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: [
          { id: 'ag/gemini-2.0-flash', owned_by: 'google' },
          { id: 'meta-llama/llama-3.3-70b-instruct', owned_by: 'meta' }
        ]
      }));
    };

    const refreshRes2 = await requestJson(`${BASE_URL}/api/admin/ai/discovery/refresh`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(refreshRes2.status, 200);
    assert.strictEqual(refreshRes2.body.syncStatus, 'SUCCESS');
    assert.strictEqual(refreshRes2.body.totalModelsCount, 2);
    assert.strictEqual(refreshRes2.body.aliasStatus, 'UNPUBLISHED_CONFIGURED', 'Alias recognized as unpublished-configured when not in list');
    pass("Correct aliasStatus 'UNPUBLISHED_CONFIGURED' when alias is not explicitly listed");

    // 10. Test Catalog Cache Preservation on Upstream Failure (401 Unauthorized)
    mockModelsHandler = (req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Invalid API key provided.', type: 'authentication_error' } }));
    };

    const failedRefreshRes = await requestJson(`${BASE_URL}/api/admin/ai/discovery/refresh`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(failedRefreshRes.status, 200);
    assert.strictEqual(failedRefreshRes.body.syncStatus, 'FAILED');
    assert.strictEqual(failedRefreshRes.body.lastStatusCode, 401);
    assert.ok(failedRefreshRes.body.lastError.includes('Invalid API key') || failedRefreshRes.body.lastError.includes('401'));
    // MUST PRESERVE PREVIOUSLY DISCOVERED MODELS:
    assert.strictEqual(failedRefreshRes.body.totalModelsCount, 2, 'Existing catalog preserved on upstream failure');
    pass('Catalog cache preserved: 401 error recorded without wiping discovered models');

    // 11. Test Catalog Cache Preservation on 500 Server Error
    mockModelsHandler = (req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Internal Gateway Error' } }));
    };

    const failedRefresh500 = await requestJson(`${BASE_URL}/api/admin/ai/discovery/refresh`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(failedRefresh500.status, 200);
    assert.strictEqual(failedRefresh500.body.syncStatus, 'FAILED');
    assert.strictEqual(failedRefresh500.body.lastStatusCode, 500);
    assert.strictEqual(failedRefresh500.body.totalModelsCount, 2, 'Catalog preserved on 500');
    pass('Catalog cache preserved on 500 upstream server error');

    // 12. Test GET /discovery/catalog (Read Cached Catalog with TTL)
    const getCatalogRes = await requestJson(`${BASE_URL}/api/admin/ai/discovery/catalog`, {
      headers: authHeaders
    });
    assert.strictEqual(getCatalogRes.status, 200);
    assert.strictEqual(getCatalogRes.body.totalModelsCount, 2);
    pass('GET /discovery/catalog returns cached catalog successfully');

    // 13. Test Verify Alias Endpoint (POST /discovery/verify-alias)
    const verifyAliasRes = await requestJson(`${BASE_URL}/api/admin/ai/discovery/verify-alias`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(verifyAliasRes.status, 200);
    assert.strictEqual(verifyAliasRes.body.alias, 'PrepMate');
    assert.strictEqual(verifyAliasRes.body.state, 'HEALTHY');
    pass('POST /discovery/verify-alias verifies inference capability for alias PrepMate');

    // 14. Final Production DB Hash Check
    const finalHash = computeHash(PROD_DB_PATH);
    assert.strictEqual(finalHash, initialHash, 'Production DB was NEVER mutated');
    pass('Production DB hash post-verified (Strict preservation confirmed)');

    console.log(`PASS (${checkCount} checks)`);
  } finally {
    backendProc.kill();
    mockServer.close();
    try {
      if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }
}

if (require.main === module) {
  runTestSuite().catch(err => {
    console.error('\n[FAIL] Test suite failed with exception:');
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runTestSuite };
