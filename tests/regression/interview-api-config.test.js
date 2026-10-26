/**
 * PREPMATE — INTERVIEW API CONFIGURATION & URL RESOLUTION REGRESSION SUITE
 * Verifies WI-02B4 requirements:
 * 1. localhost with backend at port 5000
 * 2. localhost with backend test at port 5002 (no forced 5000)
 * 3. Deployment hostname other than localhost
 * 4. Invalid or missing configuration on file://
 * 5. Relative API endpoint joining without double slashes
 * 6. Query string, path, and slash preservation
 * 7. Authorization header and request payload preservation
 * 8. Explicit backend configuration strictly respected (no fallback to 5000)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { resolvePath } = require('../helpers/test-env');

let testResults = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

function createApiContext(locationOpts = {}, windowProps = {}) {
  let capturedRequests = [];

  const mockFetch = async (url, options = {}) => {
    capturedRequests.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, url })
    };
  };

  const ctxObj = {
    window: null,
    location: {
      protocol: locationOpts.protocol || 'http:',
      hostname: locationOpts.hostname || 'localhost',
      port: locationOpts.port !== undefined ? locationOpts.port : '5000',
      pathname: locationOpts.pathname || '/features/interview/interview-practice.html',
      href: locationOpts.href || 'http://localhost:5000/features/interview/interview-practice.html'
    },
    fetch: mockFetch,
    console,
    URL: globalThis.URL,
    getCurrentUser: () => windowProps.currentUser || null,
    showToast: () => {},
    ...windowProps
  };
  ctxObj.window = ctxObj;

  const ctx = vm.createContext(ctxObj);
  const apiCode = fs.readFileSync(resolvePath('FE/features/interview/interview-api.js'), 'utf8');
  vm.runInContext(apiCode, ctx);

  return {
    ctx,
    getRequests: () => capturedRequests,
    client: ctx.InterviewApiClient
  };
}

async function runConfigTests() {
  console.log('=== RUNNING TESTS FOR INTERVIEW API BASE URL CONFIGURATION (WI-02B4) ===\n');

  // TEST 1: localhost with backend at port 5000
  try {
    const env = createApiContext({ protocol: 'http:', hostname: 'localhost', port: '5000' });
    await env.client.getSession('sess-5000');
    const reqs = env.getRequests();
    assert(reqs.length === 1, 'Exactly one request sent');
    assert(reqs[0].url === '/api/sessions/sess-5000', 'URL must be relative /api/sessions/sess-5000 for same-origin port 5000; got: ' + reqs[0].url);

    testResults.push('[PASS] Test 1: localhost with backend at port 5000 resolves to same-origin relative URL');
  } catch (e) {
    testResults.push('[FAIL] Test 1: localhost with backend at port 5000 - ' + e.message);
  }

  // TEST 2: localhost with backend test at port 5002 (no forced 5000)
  try {
    const env = createApiContext({ protocol: 'http:', hostname: 'localhost', port: '5002' });
    await env.client.createSession({ jobTitle: 'QA Engineer' });
    const reqs = env.getRequests();
    assert(reqs.length === 1, 'Exactly one request sent');
    assert(reqs[0].url === '/api/sessions', 'URL must remain relative /api/sessions for port 5002; got: ' + reqs[0].url);
    assert(!reqs[0].url.includes(':5000'), 'URL must NOT contain port 5000 on a port 5002 origin');

    testResults.push('[PASS] Test 2: localhost with backend test at port 5002 does not force 5000');
  } catch (e) {
    testResults.push('[FAIL] Test 2: localhost with backend test at port 5002 - ' + e.message);
  }

  // TEST 3: Hostname deployment other than localhost
  try {
    const env = createApiContext({ protocol: 'https:', hostname: 'app.prepmate.vn', port: '' });
    await env.client.getSession('sess-prod-1');
    const reqs = env.getRequests();
    assert(reqs.length === 1, 'Exactly one request sent');
    assert(reqs[0].url === '/api/sessions/sess-prod-1', 'Production URL must be relative /api/sessions/...; got: ' + reqs[0].url);
    assert(!reqs[0].url.includes('localhost'), 'Production request must not target localhost');

    testResults.push('[PASS] Test 3: Hostname deployment other than localhost routes to same-origin');
  } catch (e) {
    testResults.push('[FAIL] Test 3: Hostname deployment other than localhost - ' + e.message);
  }

  // TEST 4: Invalid configuration or missing configuration on file://
  try {
    // 4A: Missing base URL on file:// protocol
    const envFile = createApiContext({ protocol: 'file:', hostname: '', port: '' });
    let threwFileError = false;
    try {
      await envFile.client.getSession('sess-file');
    } catch (err) {
      threwFileError = true;
      assert(err.message.includes('API_BASE_URL is not configured for file://'), 'Error must explain file:// requirement; got: ' + err.message);
    }
    assert(threwFileError, 'Must throw descriptive error on file:// without API_BASE_URL');

    // 4B: Invalid URL format provided
    const envBad = createApiContext({ protocol: 'http:', hostname: 'localhost', port: '5000' });
    let threwBadUrl = false;
    try {
      envBad.client.setBaseUrl('htt://invalid url with spaces');
      await envBad.client.getSession('sess-bad');
    } catch (err) {
      threwBadUrl = true;
      assert(err.message.includes('Invalid API_BASE_URL'), 'Error must report invalid URL; got: ' + err.message);
    }
    assert(threwBadUrl, 'Must throw error on invalid API_BASE_URL syntax');

    testResults.push('[PASS] Test 4: Invalid and missing configurations throw descriptive errors instead of silent fallbacks');
  } catch (e) {
    testResults.push('[FAIL] Test 4: Invalid and missing configurations - ' + e.message);
  }

  // TEST 5: Relative API endpoint joining without double slashes
  try {
    const env = createApiContext({ protocol: 'http:', hostname: 'localhost', port: '5000' });
    
    // Test without leading slash
    const u1 = env.client.buildUrl('api/sessions');
    assert(u1 === '/api/sessions', 'Leading slash normalized: ' + u1);

    // Test with leading slash
    const u2 = env.client.buildUrl('/api/sessions');
    assert(u2 === '/api/sessions', 'Leading slash preserved: ' + u2);

    // Test with explicit base containing trailing slash
    env.client.setBaseUrl('http://localhost:5002/');
    const u3 = env.client.buildUrl('/api/sessions');
    assert(u3 === 'http://localhost:5002/api/sessions', 'Trailing slash trimmed: ' + u3);

    const u4 = env.client.buildUrl('api/sessions');
    assert(u4 === 'http://localhost:5002/api/sessions', 'Clean join with explicit base: ' + u4);

    assert(!u3.includes('//api'), 'No double slashes before api');

    testResults.push('[PASS] Test 5: Relative API endpoint joining prevents double slashes and missing slashes');
  } catch (e) {
    testResults.push('[FAIL] Test 5: Relative API endpoint joining - ' + e.message);
  }

  // TEST 6: Query string, path, and slash preservation
  try {
    const env = createApiContext({ protocol: 'http:', hostname: 'localhost', port: '5000' });
    env.client.setBaseUrl('http://localhost:5002');
    
    await env.client.request('/api/sessions/sess-123/report?format=pdf&detailed=true');
    const reqs = env.getRequests();
    assert(reqs.length === 1, 'Request captured');
    assert(reqs[0].url === 'http://localhost:5002/api/sessions/sess-123/report?format=pdf&detailed=true', 'Full path and query params preserved: ' + reqs[0].url);

    testResults.push('[PASS] Test 6: Query string, path, and slash preservation verified');
  } catch (e) {
    testResults.push('[FAIL] Test 6: Query string, path, and slash preservation - ' + e.message);
  }

  // TEST 7: Authorization header and request payload preservation
  try {
    const testUser = { id: 'u-101', token: 'jwt.mock.token.signature.999' };
    const env = createApiContext(
      { protocol: 'http:', hostname: 'localhost', port: '5000' },
      { currentUser: testUser }
    );

    await env.client.submitAnswer('sess-7', 'Explain polymorphism', 'Polymorphism allows objects to be treated as instances of their parent class.');
    const reqs = env.getRequests();
    assert(reqs.length === 1, 'Request sent');
    
    const headers = reqs[0].options.headers;
    assert(headers['Authorization'] === 'Bearer jwt.mock.token.signature.999', 'JWT Bearer token preserved in headers');
    assert(headers['Content-Type'] === 'application/json', 'Content-Type header preserved');

    const body = JSON.parse(reqs[0].options.body);
    assert(body.sessionId === 'sess-7', 'sessionId preserved in payload');
    assert(body.question === 'Explain polymorphism', 'question preserved in payload');
    assert(body.message.includes('Polymorphism allows'), 'message preserved in payload');

    testResults.push('[PASS] Test 7: Authorization header and request payload preserved intact');
  } catch (e) {
    testResults.push('[FAIL] Test 7: Authorization header and request payload - ' + e.message);
  }

  // TEST 8: Explicit backend configuration strictly respected (no fallback to 5000)
  try {
    // 8A: Explicit PREPMATE_API_BASE_URL on localhost:5000 pointing to 5003
    const envA = createApiContext(
      { protocol: 'http:', hostname: 'localhost', port: '5000' },
      { PREPMATE_API_BASE_URL: 'http://localhost:5003' }
    );
    await envA.client.getSession('sess-8a');
    const reqsA = envA.getRequests();
    assert(reqsA[0].url === 'http://localhost:5003/api/sessions/sess-8a', 'Explicit PREPMATE_API_BASE_URL respected: ' + reqsA[0].url);

    // 8B: Explicit client.setBaseUrl
    const envB = createApiContext({ protocol: 'http:', hostname: 'localhost', port: '5000' });
    envB.client.setBaseUrl('https://api.isolated-test.internal:8443');
    await envB.client.createSession({ test: true });
    const reqsB = envB.getRequests();
    assert(reqsB[0].url === 'https://api.isolated-test.internal:8443/api/sessions', 'Explicit client.baseUrl respected: ' + reqsB[0].url);
    assert(!reqsB[0].url.includes('5000'), 'Must never fallback to 5000');

    // 8C: Pollution guard: If legacy auth.js/main.js assigned window.API_BASE_URL = 'http://localhost:5000'
    // while document is on port 5002, interview-api must NOT use 5000
    const envC = createApiContext(
      { protocol: 'http:', hostname: 'localhost', port: '5002' },
      { API_BASE_URL: 'http://localhost:5000' }
    );
    await envC.client.getSession('sess-8c');
    const reqsC = envC.getRequests();
    assert(reqsC[0].url === '/api/sessions/sess-8c', 'Legacy forced 5000 on port 5002 neutralized to same-origin relative URL; got: ' + reqsC[0].url);
    assert(!reqsC[0].url.includes(':5000'), 'Request must not route to port 5000 on port 5002');

    testResults.push('[PASS] Test 8: Explicit backend configuration strictly respected with zero silent fallbacks');
  } catch (e) {
    testResults.push('[FAIL] Test 8: Explicit backend configuration - ' + e.message);
  }

  // TEST 9: Normalization of legacy URL before guard (WI-02B4-C1)
  try {
    const legacyVariations = [
      'http://localhost:5000',
      'http://localhost:5000/',
      'http://localhost:5000///',
      ' http://localhost:5000 ',
      '  http://localhost:5000/  ',
      'http://127.0.0.1:5000',
      'http://127.0.0.1:5000/',
      ' http://127.0.0.1:5000/// '
    ];

    for (const legacyVal of legacyVariations) {
      const env = createApiContext(
        { protocol: 'http:', hostname: 'localhost', port: '5002' },
        { API_BASE_URL: legacyVal }
      );
      const resolved = env.client.resolveApiBaseUrl();
      assert(resolved === '', `Legacy URL "${legacyVal}" on port 5002 must be normalized & neutralized to empty string; got "${resolved}"`);

      await env.client.getSession('sess-norm');
      const reqs = env.getRequests();
      assert(reqs[0].url === '/api/sessions/sess-norm', `Request URL must be relative /api/sessions/sess-norm for "${legacyVal}"; got "${reqs[0].url}"`);
      assert(!reqs[0].url.includes(':5000'), `Request must never target port 5000 when running on 5002 with legacy "${legacyVal}"`);
    }

    // 9B: Port 5000 with valid URL is NOT mistakenly neutralized
    const env5000 = createApiContext(
      { protocol: 'http:', hostname: 'localhost', port: '5000' },
      { API_BASE_URL: 'http://localhost:5000/' }
    );
    const resolved5000 = env5000.client.resolveApiBaseUrl();
    assert(resolved5000 === 'http://localhost:5000', `Valid URL on port 5000 must be preserved as "http://localhost:5000"; got "${resolved5000}"`);

    // 9C: Precedence: PREPMATE_API_BASE_URL overrides legacy API_BASE_URL even if legacy has trailing slash
    const envPrec = createApiContext(
      { protocol: 'http:', hostname: 'localhost', port: '5002' },
      {
        API_BASE_URL: '  http://localhost:5000/  ',
        PREPMATE_API_BASE_URL: 'http://localhost:8080/'
      }
    );
    assert(envPrec.client.resolveApiBaseUrl() === 'http://localhost:8080', 'PREPMATE_API_BASE_URL overrides legacy API_BASE_URL');

    // 9D: Precedence: InterviewApiClient.setBaseUrl() has highest priority over all
    envPrec.client.setBaseUrl('https://api.prepmate.vn/');
    assert(envPrec.client.resolveApiBaseUrl() === 'https://api.prepmate.vn', 'client.setBaseUrl() has highest priority');

    testResults.push('[PASS] Test 9: Legacy API URL variations with slashes/whitespace normalized before guard (WI-02B4-C1)');
  } catch (e) {
    testResults.push('[FAIL] Test 9: Legacy API URL normalization - ' + e.message);
  }

  console.log('\n--- INTERVIEW API CONFIGURATION TEST SUMMARY ---');
  console.log(testResults.join('\n'));

  const failedTests = testResults.filter(r => r.startsWith('[FAIL]'));
  if (failedTests.length > 0) {
    throw new Error(`${failedTests.length} tests failed!`);
  }
}

runConfigTests();
