/**
 * PREPMATE — ADMIN AI PROVIDER CONFIGURATION & MODEL PRESET REGRESSION SUITE
 * Verifies WI-AI-RECOVERY-03 requirements:
 * 1. Provider Presets: OpenAI, Google Gemini, Groq, DeepSeek, Vilao AI, Local Ollama.
 * 2. Vilao Preset Model validation: Uses active model candidate (ag/gemini-2.0-flash), not MODEL_INACTIVE.
 * 3. Credential Safety: Applying presets preserves the existing API key input value.
 * 4. Trailing Slash Normalization on Base URL during save.
 * 5. Distinct 3-tier explanation (Saved Config vs Health Check Ping vs Live Inference).
 * 6. Truthful Error Rendering & ModelInactive Guidance.
 * 7. Zero Secret Leakage in DOM or logs.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    failCount++;
    console.error(`[FAIL] ${message}`);
    throw new Error(`ASSERTION FAILED: ${message}`);
  } else {
    passCount++;
    console.log(`[PASS] ${message}`);
  }
}

function createMockDom() {
  const elements = {};

  const makeElement = (id, tag = 'input') => ({
    id,
    tagName: tag.toUpperCase(),
    value: '',
    checked: false,
    innerText: '',
    innerHTML: '',
    type: 'text',
    placeholder: '',
    disabled: false,
    style: { display: '', background: '', color: '', border: '' },
    setAttribute: function(attr, val) { this[attr] = val; },
    getAttribute: function(attr) { return this[attr] || null; }
  });

  const getElementById = (id) => {
    if (!elements[id]) {
      elements[id] = makeElement(id);
    }
    return elements[id];
  };

  return { elements, getElementById, makeElement };
}

function setupAdminHealthContext(customProps = {}) {
  const { elements, getElementById } = createMockDom();

  // Prepopulate standard form elements
  getElementById('config-ai-preset');
  getElementById('config-ai-provider');
  getElementById('config-ai-protocol');
  getElementById('config-ai-base-url');
  getElementById('config-ai-model');
  getElementById('config-api-key');
  getElementById('config-clear-api-key');
  getElementById('config-credential-mode');
  getElementById('config-temperature');
  getElementById('config-max-tokens');
  getElementById('config-ai-enabled');
  getElementById('config-free-quota');
  getElementById('config-enable-voice');
  getElementById('btn-save-config');
  getElementById('ai-health-badge');
  getElementById('ai-health-detail');
  getElementById('ai-health-guidance');
  getElementById('btn-test-ai-health');
  getElementById('ai-health-checked-at');
  getElementById('config-api-key-status');
  getElementById('temp-val');

  let fetchCalls = [];
  const mockFetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });
    if (url.includes('/api/admin/ai/health-check')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          state: 'HEALTHY',
          message: 'Kết nối AI Gateway hoạt động bình thường',
          latencyMs: 120,
          provider: 'OpenAI-Compatible',
          model: 'gpt-4o-mini',
          lastCheckedAt: new Date().toISOString()
        })
      };
    }
    if (url.includes('/api/admin/ai/config')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          provider: 'OpenAI',
          protocol: 'openai-chat-completions',
          baseUrl: 'https://api.openai.com/v1/',
          model: 'gpt-4o-mini',
          apiKeyConfigured: true,
          credentialStorageStatus: 'encrypted',
          credentialSource: 'admin:encrypted',
          isEnvironmentManaged: false,
          temperature: 0.7,
          maxTokens: 1000,
          enabled: true
        })
      };
    }
    if (url.includes('/api/admin/ai/health')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          state: 'NOT_CHECKED',
          message: 'Chưa thực hiện kiểm tra kết nối',
          credentialSource: 'admin:encrypted',
          credentialStorageStatus: 'encrypted'
        })
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };

  const sandbox = {
    document: {
      getElementById: (id) => getElementById(id)
    },
    window: {},
    fetch: mockFetch,
    fetchCalls,
    activeRoleView: 'admin',
    API_BASE_URL: 'http://localhost:5000',
    getAdminAuthHeaders: (custom = {}) => ({ 'Authorization': 'Bearer test-admin-token', ...custom }),
    showToast: () => {},
    addAuditLog: () => {},
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    console,
    ...customProps
  };
  sandbox.window = sandbox;

  const scriptPath = path.resolve(__dirname, '../../FE/features/admin/admin-ai-health.js');
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');

  const context = vm.createContext(sandbox);
  vm.runInContext(scriptContent, context);

  return { context, elements, getElementById, fetchCalls };
}

// -------------------------------------------------------------
// Test 1: Provider Presets Configuration Matrix
// -------------------------------------------------------------
function testProviderPresetsMatrix() {
  const { context, getElementById } = setupAdminHealthContext();

  const presets = [
    {
      id: 'openai',
      expectedProvider: 'OpenAI',
      expectedBaseUrl: 'https://api.openai.com/v1/',
      expectedModel: 'gpt-4o-mini'
    },
    {
      id: 'gemini-openai',
      expectedProvider: 'Google Gemini',
      expectedBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      expectedModel: 'gemini-1.5-flash'
    },
    {
      id: 'groq',
      expectedProvider: 'Groq Cloud',
      expectedBaseUrl: 'https://api.groq.com/openai/v1/',
      expectedModel: 'llama-3.3-70b-versatile'
    },
    {
      id: 'deepseek',
      expectedProvider: 'DeepSeek',
      expectedBaseUrl: 'https://api.deepseek.com/v1/',
      expectedModel: 'deepseek-chat'
    },
    {
      id: 'vilao',
      expectedProvider: 'Vilao AI',
      expectedBaseUrl: 'https://api.vilao.ai/v1/',
      expectedModel: 'ag/gemini-2.0-flash' // Active candidate, NOT inactive ag/gemini-3.8-flash
    },
    {
      id: 'local-ollama',
      expectedProvider: 'Local Ollama / vLLM',
      expectedBaseUrl: 'http://127.0.0.1:11434/v1/',
      expectedModel: 'llama3.2'
    }
  ];

  for (const preset of presets) {
    context.applyProviderPreset(preset.id);

    const provider = getElementById('config-ai-provider').value;
    const baseUrl = getElementById('config-ai-base-url').value;
    const model = getElementById('config-ai-model').value;
    const protocol = getElementById('config-ai-protocol').value;

    assert(provider === preset.expectedProvider, `Preset ${preset.id} sets Provider Name to ${preset.expectedProvider}`);
    assert(baseUrl === preset.expectedBaseUrl, `Preset ${preset.id} sets BaseUrl to ${preset.expectedBaseUrl}`);
    assert(model === preset.expectedModel, `Preset ${preset.id} sets Model to ${preset.expectedModel}`);
    assert(protocol === 'openai-chat-completions', `Preset ${preset.id} maintains openai-chat-completions protocol`);
  }
}

// -------------------------------------------------------------
// Test 2: Vilao Preset Never Injects Inactive Model ag/gemini-3.8-flash
// -------------------------------------------------------------
function testVilaoPresetAvoidsInactiveModel() {
  const { context, getElementById } = setupAdminHealthContext();

  context.applyProviderPreset('vilao');
  const model = getElementById('config-ai-model').value;

  assert(model !== 'ag/gemini-3.8-flash', 'Vilao preset does NOT default to MODEL_INACTIVE model ag/gemini-3.8-flash');
  assert(model === 'ag/gemini-2.0-flash', 'Vilao preset defaults to active candidate ag/gemini-2.0-flash');
}

// -------------------------------------------------------------
// Test 3: Preset Application Strictly Preserves Existing API Key
// -------------------------------------------------------------
function testPresetPreservesExistingApiKey() {
  const { context, getElementById } = setupAdminHealthContext();

  const apiKeyEl = getElementById('config-api-key');
  apiKeyEl.value = 'sk-secret-do-not-overwrite-12345';

  // Apply all presets in sequence
  const allPresets = ['openai', 'gemini-openai', 'groq', 'deepseek', 'vilao', 'local-ollama'];
  for (const p of allPresets) {
    context.applyProviderPreset(p);
    assert(
      apiKeyEl.value === 'sk-secret-do-not-overwrite-12345',
      `Applying preset "${p}" preserves the existing API key without overwriting`
    );
  }
}

// -------------------------------------------------------------
// Test 4: Trailing Slash Normalization on Base URL
// -------------------------------------------------------------
async function testTrailingSlashNormalization() {
  const { context, getElementById, fetchCalls } = setupAdminHealthContext();

  getElementById('config-ai-base-url').value = 'https://api.deepseek.com/v1'; // Missing trailing slash
  getElementById('config-ai-provider').value = 'DeepSeek';
  getElementById('config-ai-model').value = 'deepseek-chat';

  await context.saveSystemConfig();

  const saveCall = fetchCalls.find(c => c.url.includes('/api/admin/ai/config') && c.options.method === 'PUT');
  assert(Boolean(saveCall), 'saveSystemConfig sends PUT /api/admin/ai/config');

  const payload = JSON.parse(saveCall.options.body);
  assert(payload.baseUrl.endsWith('/'), `Base URL is normalized with trailing slash: ${payload.baseUrl}`);
  assert(payload.baseUrl === 'https://api.deepseek.com/v1/', 'Normalized Base URL matches expected value with trailing slash');
}

// -------------------------------------------------------------
// Test 5: Distinct 3-Tier Explanation in admin.html
// -------------------------------------------------------------
function testThreeTierCapabilityExplanation() {
  const htmlPath = path.resolve(__dirname, '../../FE/features/admin/admin.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  assert(
    htmlContent.includes('Phân biệt cấp độ trạng thái AI'),
    'admin.html includes clear 3-tier capability status distinction'
  );
  assert(
    htmlContent.includes('Cấu hình máy chủ'),
    'admin.html explains level 1: Server saved configuration'
  );
  assert(
    htmlContent.includes('Health Check Ping'),
    'admin.html explains level 2: Gateway connectivity ping'
  );
  assert(
    htmlContent.includes('Suy luận phỏng vấn'),
    'admin.html explains level 3: Live interview inference requirements (Active model & tokens)'
  );
}

// -------------------------------------------------------------
// Test 6: Model Datalist in admin.html contains verified models & flags inactive
// -------------------------------------------------------------
function testModelDatalistEntries() {
  const htmlPath = path.resolve(__dirname, '../../FE/features/admin/admin.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Verified active suggestions
  assert(htmlContent.includes('value="gpt-4o-mini"'), 'Model suggestions include gpt-4o-mini');
  assert(htmlContent.includes('value="gemini-1.5-flash"'), 'Model suggestions include gemini-1.5-flash');
  assert(htmlContent.includes('value="gemini-2.0-flash"'), 'Model suggestions include gemini-2.0-flash');
  assert(htmlContent.includes('value="llama-3.3-70b-versatile"'), 'Model suggestions include llama-3.3-70b-versatile');
  assert(htmlContent.includes('value="deepseek-chat"'), 'Model suggestions include deepseek-chat');
  assert(htmlContent.includes('value="ag/gemini-2.0-flash"'), 'Model suggestions include ag/gemini-2.0-flash');

  // Inactive model explicitly flagged
  assert(
    htmlContent.includes('value="ag/gemini-3.8-flash"') && htmlContent.includes('MODEL_INACTIVE'),
    'Model suggestions explicitly flag ag/gemini-3.8-flash as MODEL_INACTIVE'
  );
}

// -------------------------------------------------------------
// Test 7: Truthful Health Status Rendering & ModelInactive Guidance
// -------------------------------------------------------------
function testModelInactiveGuidanceRendering() {
  const { context, getElementById } = setupAdminHealthContext();

  const mockInactiveHealth = {
    state: 'UNHEALTHY',
    statusCode: 400,
    errorCategory: 'ModelInactive',
    message: 'Upstream gateway returned MODEL_INACTIVE for ag/gemini-3.8-flash',
    model: 'ag/gemini-3.8-flash',
    credentialSource: 'admin:encrypted'
  };

  context.renderAiHealth(mockInactiveHealth);

  const badge = getElementById('ai-health-badge');
  const guidance = getElementById('ai-health-guidance');

  assert(badge.innerHTML.includes('Lỗi kết nối'), 'Health badge reflects UNHEALTHY state');
  assert(guidance.style.display === 'block', 'Guidance block is displayed for ModelInactive');
  assert(guidance.innerHTML.includes('MODEL_INACTIVE'), 'Guidance highlights MODEL_INACTIVE condition');
  assert(guidance.innerHTML.includes('ag/gemini-2.0-flash'), 'Guidance suggests active alternative ag/gemini-2.0-flash');
  assert(guidance.innerHTML.includes('gemini-1.5-flash'), 'Guidance suggests active alternative gemini-1.5-flash');
}

// -------------------------------------------------------------
// Test 8: Zero Secret Leakage in DOM or Guidance
// -------------------------------------------------------------
function testZeroSecretLeakage() {
  const { context, getElementById } = setupAdminHealthContext();

  const secretApiKey = 'sk-prod-super-secret-1234567890abcdef';
  const healthData = {
    state: 'HEALTHY',
    message: 'Ping OK',
    apiKey: secretApiKey,
    credentialSource: 'admin:encrypted',
    credentialStorageStatus: 'encrypted'
  };

  context.renderAiHealth(healthData);

  const detailHtml = getElementById('ai-health-detail').innerHTML;
  const guidanceHtml = getElementById('ai-health-guidance').innerHTML;

  assert(!detailHtml.includes(secretApiKey), 'ai-health-detail does not leak raw API key');
  assert(!guidanceHtml.includes(secretApiKey), 'ai-health-guidance does not leak raw API key');
}

// -------------------------------------------------------------
// Execute All Tests
// -------------------------------------------------------------
async function runAll() {
  console.log('Running Admin AI Provider Configuration & Model Preset Suite...');

  try {
    testProviderPresetsMatrix();
    testVilaoPresetAvoidsInactiveModel();
    testPresetPreservesExistingApiKey();
    await testTrailingSlashNormalization();
    testThreeTierCapabilityExplanation();
    testModelDatalistEntries();
    testModelInactiveGuidanceRendering();
    testZeroSecretLeakage();

    console.log(`\nAll checks passed: ${passCount}/${passCount} assertions verified.`);
    process.exit(0);
  } catch (err) {
    console.error(`\nSuite failed with errors:`, err.message);
    process.exit(1);
  }
}

runAll();
