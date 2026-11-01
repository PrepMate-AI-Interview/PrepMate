/**
 * PREPMATE — ADMIN AI PROVIDER & MODEL REGISTRY REGRESSION SUITE
 * Work Item: WI-AI-ARCH-02
 *
 * Verifies:
 * 1. Provider connection CRUD operations (Create, Read, Update, Delete)
 * 2. Model registration CRUD operations with Provider foreign-key validation
 * 3. Strict validation rules: URL scheme (reject remote HTTP, permit loopback/localhost), protocol whitelist, limits
 * 4. Referential integrity & deletion protection: Cannot delete provider referenced by registered models
 * 5. Copy-on-Write version generation on every provider and model mutation
 * 6. Zero secret leakage: No plaintext API keys or protected ciphertext in DTOs or logs
 * 7. Projection compatibility: AIConfigurations["default"] remains coherent and passes FileDb validation
 * 8. Zero database contamination: Production db.json is never mutated (SHA-256 verified before and after)
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolvePath } = require('../helpers/test-env');

const TEST_PORT = 5022;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const PROD_DB_PATH = resolvePath('BE/data/db.json');
const TEST_DIR = resolvePath('scratch/test_db_registry');
const TEST_DB_PATH = path.join(TEST_DIR, 'isolated_registry_db.json');
const TEST_KEYRING_PATH = path.join(TEST_DIR, 'test_keys');

let passCount = 0;
let failCount = 0;
const testResults = [];

function assert(condition, message) {
  if (!condition) {
    failCount++;
    console.error(`  [FAIL] ${message}`);
    throw new Error(`ASSERTION FAILED: ${message}`);
  } else {
    passCount++;
    console.log(`  [PASS] ${message}`);
  }
}

function computeFileHash(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function requestJson(url, method, postData = null, token = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = {};
    let bodyStr = null;

    if (postData) {
      bodyStr = JSON.stringify(postData);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: method,
      headers: headers,
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, raw: data });
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function spawnBackend() {
  const env = {
    PREPMATE_AI_API_KEY: process.env.PREPMATE_AI_API_KEY || 'AIzaSyTestMockKey123456789',
    ...process.env,
    DATABASE_FILE_PATH: TEST_DB_PATH,
    PREPMATE_KEYRING_PATH: TEST_KEYRING_PATH,
    ASPNETCORE_URLS: BASE_URL,
    DOTNET_URLS: BASE_URL
  };

  const dllPath = resolvePath('BE/bin/Debug/net10.0/backend.dll');
  const proc = spawn('dotnet', [dllPath, '--urls', BASE_URL], {
    cwd: resolvePath('.'),
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  proc.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg && !msg.includes('Microsoft.Hosting.Lifetime')) {
      // console.error('[BE STDERR]', msg);
    }
  });

  return proc;
}

async function waitForBackendReady(maxWaitMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await requestJson(`${BASE_URL}/features/auth/auth.html`, 'GET');
      if (res.status === 200 || res.status === 404) return true;
    } catch (e) {}
    await sleep(250);
  }
  throw new Error('Backend failed to start within timeout');
}

async function main() {
  console.log('===============================================================');
  console.log('   PREPMATE — ADMIN AI PROVIDER & MODEL REGISTRY REGRESSION    ');
  console.log('===============================================================\n');

  // STEP 0: Baseline Verification
  const initialHash = computeFileHash(PROD_DB_PATH);
  console.log(`[Step 0] Initial Production DB Hash: ${initialHash}`);
  assert(initialHash && initialHash.length === 64, 'Production DB exists and has valid SHA-256 hash');

  // STEP 1: Code Structure & Contract Checks
  console.log('\n--- Group 1: Architecture & Model Contract Verification ---');
  const providerModelSrc = fs.readFileSync(resolvePath('BE/Models/AI/ProviderConnection.cs'), 'utf8');
  assert(providerModelSrc.includes('public string Id'), 'ProviderConnection defines Id');
  assert(providerModelSrc.includes('public string CredentialSlotId'), 'ProviderConnection defines CredentialSlotId');
  assert(providerModelSrc.includes('public string StoredApiKey'), 'ProviderConnection defines StoredApiKey');
  assert(providerModelSrc.includes('public string CurrentVersionId'), 'ProviderConnection defines CurrentVersionId');

  const modelRegSrc = fs.readFileSync(resolvePath('BE/Models/AI/ModelRegistration.cs'), 'utf8');
  assert(modelRegSrc.includes('public string ProviderConnectionId'), 'ModelRegistration references ProviderConnectionId');
  assert(modelRegSrc.includes('public string UpstreamModelId'), 'ModelRegistration defines UpstreamModelId');
  assert(modelRegSrc.includes('public List<string> SupportedTasks'), 'ModelRegistration defines SupportedTasks');
  assert(modelRegSrc.includes('public string VerificationStatus'), 'ModelRegistration defines VerificationStatus');

  const versionSrc = fs.readFileSync(resolvePath('BE/Models/AI/ConfigurationVersion.cs'), 'utf8');
  assert(versionSrc.includes('public string VersionId'), 'ConfigurationVersion defines VersionId');
  assert(versionSrc.includes('public string SnapshotJson'), 'ConfigurationVersion defines SnapshotJson');

  const fileDbSrc = fs.readFileSync(resolvePath('BE/Services/Storage/FileDb.cs'), 'utf8');
  assert(fileDbSrc.includes('public ConcurrentDictionary<string, ProviderConnection> ProviderConnections'), 'FileDb exposes ProviderConnections dictionary');
  assert(fileDbSrc.includes('public ConcurrentDictionary<string, ModelRegistration> ModelRegistrations'), 'FileDb exposes ModelRegistrations dictionary');
  assert(fileDbSrc.includes('public ConcurrentDictionary<string, ConfigurationVersion> ConfigurationVersions'), 'FileDb exposes ConfigurationVersions dictionary');
  assert(fileDbSrc.includes('data.AIConfigurations.ContainsKey("default")'), 'FileDb preserves AIConfigurations["default"] database completeness check');

  // STEP 2: Start Isolated Backend
  console.log('\n--- Group 2: Isolated Environment Setup & Auth ---');
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);
  console.log(`[Setup] Isolated DB copied to: ${TEST_DB_PATH}`);

  const backendProc = spawnBackend();
  try {
    await waitForBackendReady();
    console.log(`[Setup] Test backend running at ${BASE_URL} (PID: ${backendProc.pid})`);

    // Authenticate as Admin
    const loginRes = await requestJson(`${BASE_URL}/api/auth/login`, 'POST', {
      email: 'admin@prepmate.vn',
      password: 'Admin@123'
    });
    assert(loginRes.status === 200, 'Admin login succeeded');
    const token = loginRes.body.token;
    assert(!!token, 'Received valid JWT admin token');

    // STEP 3: Auto-Projection & Existing Defaults
    console.log('\n--- Group 3: Default Projection & Secret Masking ---');
    const initialProviders = await requestJson(`${BASE_URL}/api/admin/ai/providers`, 'GET', null, token);
    assert(initialProviders.status === 200, 'GET /api/admin/ai/providers returns 200');
    assert(Array.isArray(initialProviders.body) && initialProviders.body.length >= 1, 'Auto-projected default provider exists');

    const defaultProvider = initialProviders.body.find(p => p.id === 'default');
    assert(!!defaultProvider, "Default provider 'default' is auto-projected");
    assert(defaultProvider.apiKeyConfigured === true, 'apiKeyConfigured is true for default provider');
    assert(defaultProvider.storedApiKey === undefined, 'No storedApiKey field leaked in ProviderConnectionDto');
    assert(defaultProvider.credentialSlotId !== undefined, 'CredentialSlotId is present');
    assert(!JSON.stringify(defaultProvider).includes('AIzaSy'), 'Raw API key secret is NOT leaked in JSON payload');

    const initialModels = await requestJson(`${BASE_URL}/api/admin/ai/models`, 'GET', null, token);
    assert(initialModels.status === 200, 'GET /api/admin/ai/models returns 200');
    assert(Array.isArray(initialModels.body) && initialModels.body.length >= 1, 'Auto-projected default model exists');
    const defaultModel = initialModels.body.find(m => m.id === 'default');
    assert(!!defaultModel, "Default model 'default' is auto-projected");
    assert(defaultModel.providerConnectionId === 'default', 'Default model references default provider');
    assert(defaultModel.supportedTasks.includes('QuestionGeneration'), 'Default model supports QuestionGeneration');

    // STEP 4: Provider Validation & Creation
    console.log('\n--- Group 4: Provider Validation & Creation ---');
    // 4a: Remote HTTP rejection
    const remoteHttpRes = await requestJson(`${BASE_URL}/api/admin/ai/providers`, 'POST', {
      id: 'insecure-provider',
      displayName: 'Insecure Provider',
      baseUrl: 'http://api.remote-ai.com/v1',
      protocol: 'openai-chat-completions'
    }, token);
    assert(remoteHttpRes.status === 400, 'Rejects insecure HTTP for remote endpoints with 400 Bad Request');

    // 4b: Unsupported protocol rejection
    const invalidProtoRes = await requestJson(`${BASE_URL}/api/admin/ai/providers`, 'POST', {
      id: 'grpc-provider',
      displayName: 'gRPC Provider',
      baseUrl: 'https://api.grpc.com/v1',
      protocol: 'grpc-streaming'
    }, token);
    assert(invalidProtoRes.status === 400, 'Rejects unsupported API protocol with 400 Bad Request');

    // 4c: Loopback HTTP allowed (e.g. local Ollama)
    const loopbackRes = await requestJson(`${BASE_URL}/api/admin/ai/providers`, 'POST', {
      id: 'local-ollama',
      displayName: 'Local Ollama Instance',
      baseUrl: 'http://127.0.0.1:11434/v1',
      protocol: 'openai-chat-completions',
      credentialMode: 'auto'
    }, token);
    assert(loopbackRes.status === 201, 'Permits loopback HTTP endpoint for local development/testing with 201 Created');

    // 4d: Create valid provider with API key
    const secretKey = 'gsk_super_secret_groq_api_key_45678';
    const createProviderRes = await requestJson(`${BASE_URL}/api/admin/ai/providers`, 'POST', {
      id: 'groq-provider',
      displayName: 'Groq Cloud Inference',
      baseUrl: 'https://api.groq.com/openai/v1',
      protocol: 'openai-chat-completions',
      apiKey: secretKey,
      credentialMode: 'admin',
      timeoutSeconds: 45,
      maxRetries: 2
    }, token);
    assert(createProviderRes.status === 201, 'Creates valid HTTPS provider with 201 Created');
    assert(createProviderRes.body.id === 'groq-provider', 'Created provider has correct ID');
    assert(createProviderRes.body.apiKeyConfigured === true, 'apiKeyConfigured is reported as true');
    assert(createProviderRes.body.credentialStorageStatus === 'encrypted', 'credentialStorageStatus is encrypted');
    assert(!createProviderRes.raw.includes(secretKey), 'Secret API key is NEVER leaked in response payload');

    // 4e: Duplicate ID rejection
    const duplicateRes = await requestJson(`${BASE_URL}/api/admin/ai/providers`, 'POST', {
      id: 'groq-provider',
      displayName: 'Groq Cloud Duplicate',
      baseUrl: 'https://api.groq.com/openai/v1'
    }, token);
    assert(duplicateRes.status === 409, 'Rejects duplicate provider ID with 409 Conflict');

    // STEP 5: Provider Update & Copy-on-Write Versioning
    console.log('\n--- Group 5: Provider Update & Copy-on-Write Versioning ---');
    const updateRes = await requestJson(`${BASE_URL}/api/admin/ai/providers/groq-provider`, 'PUT', {
      displayName: 'Groq Cloud Ultra Fast',
      baseUrl: 'https://api.groq.com/openai/v1',
      timeoutSeconds: 30,
      maxRetries: 3
    }, token);
    assert(updateRes.status === 200, 'Updates provider with 200 OK');
    assert(updateRes.body.displayName === 'Groq Cloud Ultra Fast', 'DisplayName updated successfully');
    assert(updateRes.body.timeoutSeconds === 30, 'Timeout updated successfully');

    // Verify Copy-on-Write version audit trail
    const provVersionsRes = await requestJson(`${BASE_URL}/api/admin/ai/versions/provider/groq-provider`, 'GET', null, token);
    assert(provVersionsRes.status === 200, 'GET versions for provider returns 200');
    assert(Array.isArray(provVersionsRes.body) && provVersionsRes.body.length >= 2, 'Two Copy-on-Write versions recorded (create and update)');
    assert(provVersionsRes.body.some(v => v.versionNumber === 1), 'Version 1 recorded for initial creation');
    assert(provVersionsRes.body.some(v => v.versionNumber === 2), 'Version 2 recorded for update');

    // STEP 6: Model Registration & Foreign Key Validation
    console.log('\n--- Group 6: Model Registration & Foreign Key Validation ---');
    // 6a: Reject model referencing nonexistent provider
    const badProvModelRes = await requestJson(`${BASE_URL}/api/admin/ai/models`, 'POST', {
      id: 'orphan-model',
      displayName: 'Orphan Model',
      providerConnectionId: 'nonexistent-provider-id',
      upstreamModelId: 'gpt-4o'
    }, token);
    assert(badProvModelRes.status === 404, 'Rejects model referencing nonexistent provider with 404 Not Found');

    // 6b: Reject invalid task type
    const badTaskModelRes = await requestJson(`${BASE_URL}/api/admin/ai/models`, 'POST', {
      id: 'bad-task-model',
      displayName: 'Bad Task Model',
      providerConnectionId: 'groq-provider',
      upstreamModelId: 'llama-3.3-70b-versatile',
      supportedTasks: ['UnsupportedFictionWritingTask']
    }, token);
    assert(badTaskModelRes.status === 400, 'Rejects unsupported task capability with 400 Bad Request');

    // 6c: Create valid model
    const createModelRes = await requestJson(`${BASE_URL}/api/admin/ai/models`, 'POST', {
      id: 'groq-llama-70b',
      displayName: 'Llama 3.3 70B Versatile',
      providerConnectionId: 'groq-provider',
      upstreamModelId: 'llama-3.3-70b-versatile',
      supportedTasks: ['QuestionGeneration', 'AnswerAnalysis', 'InterviewIntroduction', 'InterviewClosing'],
      maxContextTokens: 128000,
      defaultMaxTokens: 1500,
      defaultTemperature: 0.6,
      supportsStructuredJson: true
    }, token);
    assert(createModelRes.status === 201, 'Creates valid model registration with 201 Created');
    assert(createModelRes.body.id === 'groq-llama-70b', 'Created model has correct ID');
    assert(createModelRes.body.providerDisplayName === 'Groq Cloud Ultra Fast', 'Model includes provider display name');
    assert(createModelRes.body.verificationStatus === 'UNTESTED', 'Initial verification status is UNTESTED');

    // 6d: Model Update & Versioning
    const updateModelRes = await requestJson(`${BASE_URL}/api/admin/ai/models/groq-llama-70b`, 'PUT', {
      displayName: 'Llama 3.3 70B Turbo',
      providerConnectionId: 'groq-provider',
      upstreamModelId: 'llama-3.3-70b-versatile',
      supportedTasks: ['QuestionGeneration', 'AnswerAnalysis'],
      maxContextTokens: 128000,
      defaultMaxTokens: 2000,
      defaultTemperature: 0.7,
      supportsStructuredJson: true
    }, token);
    assert(updateModelRes.status === 200, 'Updates model registration with 200 OK');
    assert(updateModelRes.body.defaultMaxTokens === 2000, 'Model max tokens updated');

    const modelVersionsRes = await requestJson(`${BASE_URL}/api/admin/ai/versions/model/groq-llama-70b`, 'GET', null, token);
    assert(modelVersionsRes.status === 200, 'GET versions for model returns 200');
    assert(Array.isArray(modelVersionsRes.body) && modelVersionsRes.body.length === 2, 'Two Copy-on-Write versions recorded for model');
    assert(modelVersionsRes.body.some(v => v.versionNumber === 1), 'Version 1 recorded for model');
    assert(modelVersionsRes.body.some(v => v.versionNumber === 2), 'Version 2 recorded for model');

    // STEP 7: Referential Integrity & Deletion Protection
    console.log('\n--- Group 7: Referential Integrity & Deletion Safety ---');
    // 7a: Cannot delete provider referenced by registered models
    const deleteReferencedProvRes = await requestJson(`${BASE_URL}/api/admin/ai/providers/groq-provider`, 'DELETE', null, token);
    assert(deleteReferencedProvRes.status === 409, 'Rejects deletion of provider with active model dependencies with 409 Conflict');
    assert(deleteReferencedProvRes.body.error.includes('groq-llama-70b'), 'Error message identifies the blocking dependent model(s)');

    // 7b: Delete dependent model
    const deleteModelRes = await requestJson(`${BASE_URL}/api/admin/ai/models/groq-llama-70b`, 'DELETE', null, token);
    assert(deleteModelRes.status === 200, 'Deletes model registration with 200 OK');

    // 7c: Now provider deletion succeeds
    const deleteProvSuccessRes = await requestJson(`${BASE_URL}/api/admin/ai/providers/groq-provider`, 'DELETE', null, token);
    assert(deleteProvSuccessRes.status === 200, 'Deletes provider after dependencies removed with 200 OK');

    // 7d: Cannot delete default provider if sole provider
    const deleteDefaultProvRes = await requestJson(`${BASE_URL}/api/admin/ai/providers/default`, 'DELETE', null, token);
    assert(deleteDefaultProvRes.status === 409, 'Rejects deletion of default provider when sole provider with 409 Conflict');

    // STEP 8: Zero Production DB Contamination Check
    console.log('\n--- Group 8: Zero Production DB Contamination Verification ---');
    const finalProdHash = computeFileHash(PROD_DB_PATH);
    console.log(`[Step 8] Final Production DB Hash: ${finalProdHash}`);
    assert(finalProdHash === initialHash, 'Production BE/data/db.json remains byte-for-byte identical (ZERO MUTATION)');
  } finally {
    // Gracefully stop backend process
    backendProc.kill('SIGTERM');
    await sleep(500);
  }

  console.log('\n===============================================================');
  console.log(`REGRESSION SUMMARY: ${passCount} passed, ${failCount} failed`);
  console.log('===============================================================');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});
