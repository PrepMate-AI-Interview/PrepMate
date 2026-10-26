/**
 * PREPMATE — FRONTEND AI ERROR RESILIENCE & RECOVERY REGRESSION TEST SUITE
 * Work Item: WI-AI-RECOVERY-02
 *
 * Verifies:
 * 1. Categorization of 7 error types (MODEL_INACTIVE, GATEWAY_UNAVAILABLE, TIMEOUT, AUTH_ERROR, VALIDATION_ERROR, NETWORK_ERROR, SERVER_ERROR)
 * 2. Proper Vietnamese guidance, action prompts, and error metadata
 * 3. Introduction phase resilience: candidate input preserved on 503 MODEL_INACTIVE, phase unchanged, zero data loss
 * 4. Adaptive interview resilience: candidate input preserved on 503/504 errors, index not advanced, zero data loss
 * 5. In-situ retry mechanism: stage guidance displays retry action, retryInterviewSubmission re-attempts and cleans up on success
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { resolvePath } = require('../helpers/test-env');

let testResults = [];
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

function runTest(testName, fn) {
  try {
    fn();
    testResults.push(`[PASS] ${testName}`);
    passCount++;
  } catch (err) {
    testResults.push(`[FAIL] ${testName}: ${err.message}`);
    failCount++;
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn();
    testResults.push(`[PASS] ${testName}`);
    passCount++;
  } catch (err) {
    testResults.push(`[FAIL] ${testName}: ${err.message}`);
    failCount++;
  }
}

console.log('===============================================================');
console.log('   PREPMATE — AI ERROR RESILIENCE & RECOVERY TEST SUITE        ');
console.log('===============================================================\n');

// Load API client to test categorizeInterviewError directly
const apiCode = fs.readFileSync(resolvePath('FE/features/interview/interview-api.js'), 'utf8');
const apiCtxObj = {
  window: {},
  location: { protocol: 'http:', hostname: 'localhost', port: '5000', pathname: '/' },
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  console,
  getCurrentUser: () => null,
  showToast: () => {},
};
apiCtxObj.window = apiCtxObj;
const apiVmCtx = vm.createContext(apiCtxObj);
vm.runInContext(apiCode, apiVmCtx);
const categorizeInterviewError = apiVmCtx.window.categorizeInterviewError;

// -------------------------------------------------------------
// GROUP 1: Error Categorization Unit Tests
// -------------------------------------------------------------
runTest('Error categorization: HTTP 503 with MODEL_INACTIVE', () => {
  const err = new Error("Mô hình AI 'ag/gemini-3.8-flash' hiện đang ở trạng thái ngừng hoạt động phía nhà cung cấp (MODEL_INACTIVE).");
  err.status = 503;
  err.data = { error: err.message };

  const info = categorizeInterviewError(err);
  assert(info.type === 'MODEL_INACTIVE', 'Type must be MODEL_INACTIVE');
  assert(info.status === 503, 'Status must be 503');
  assert(info.canRetry === true, 'canRetry must be true');
  assert(info.title.includes('Mô hình AI'), 'Title must mention AI model');
  assert(info.shortStatus.includes('MODEL_INACTIVE'), 'shortStatus must mention MODEL_INACTIVE');
  assert(info.actionPrompt.includes('Thử lại'), 'actionPrompt must guide retry');
});

runTest('Error categorization: HTTP 503 General Service Unavailable', () => {
  const err = new Error("Service Unavailable");
  err.status = 503;

  const info = categorizeInterviewError(err);
  assert(info.type === 'GATEWAY_UNAVAILABLE', 'Type must be GATEWAY_UNAVAILABLE');
  assert(info.canRetry === true, 'canRetry must be true');
  assert(info.shortStatus.includes('gián đoạn'), 'shortStatus must note service interruption');
});

runTest('Error categorization: HTTP 504 / Gateway Timeout', () => {
  const err = new Error("Gateway Timeout");
  err.status = 504;

  const info = categorizeInterviewError(err);
  assert(info.type === 'TIMEOUT', 'Type must be TIMEOUT');
  assert(info.canRetry === true, 'canRetry must be true');
  assert(info.title.includes('thời gian chờ'), 'Title must mention timeout');
});

runTest('Error categorization: Network Timeout Error without status code', () => {
  const err = new Error("Network timeout during introduction submission");

  const info = categorizeInterviewError(err);
  assert(info.type === 'TIMEOUT', 'Type must be TIMEOUT');
  assert(info.canRetry === true, 'canRetry must be true');
});

runTest('Error categorization: HTTP 401 Unauthorized / Token Expired', () => {
  const err = new Error("Unauthorized");
  err.status = 401;

  const info = categorizeInterviewError(err);
  assert(info.type === 'AUTH_ERROR', 'Type must be AUTH_ERROR');
  assert(info.title.includes('hết hạn'), 'Title must mention expiration');
});

runTest('Error categorization: HTTP 400 Bad Request / Validation Error', () => {
  const err = new Error("Thiếu nội dung câu hỏi");
  err.status = 400;
  err.data = { error: 'Thiếu nội dung câu hỏi' };

  const info = categorizeInterviewError(err);
  assert(info.type === 'VALIDATION_ERROR', 'Type must be VALIDATION_ERROR');
  assert(info.message === 'Thiếu nội dung câu hỏi', 'Preserves backend validation message');
});

runTest('Error categorization: Network TypeError (Failed to fetch)', () => {
  const err = new TypeError("Failed to fetch");

  const info = categorizeInterviewError(err);
  assert(info.type === 'NETWORK_ERROR', 'Type must be NETWORK_ERROR');
  assert(info.title.includes('kết nối mạng'), 'Title must mention network');
  assert(info.canRetry === true, 'canRetry must be true');
});

runTest('Error categorization: HTTP 500 General Server Error', () => {
  const err = new Error("Internal Server Error");
  err.status = 500;

  const info = categorizeInterviewError(err);
  assert(info.type === 'SERVER_ERROR', 'Type must be SERVER_ERROR');
  assert(info.canRetry === true, 'canRetry must be true');
});

// -------------------------------------------------------------
// GROUP 2: Integrated Interview Flow Resilience Simulation
// -------------------------------------------------------------

function createSimulationEnvironment(customFetchHandler) {
  const elements = {};
  function getOrCreateEl(id, tagName = 'div') {
    if (!elements[id]) {
      let _className = '';
      const classSet = new Set();
      elements[id] = {
        id,
        tagName,
        style: {},
        get className() { return _className; },
        set className(val) {
          _className = String(val || '');
          classSet.clear();
          if (val) _className.split(/\s+/).filter(Boolean).forEach(c => classSet.add(c));
        },
        classList: {
          get classes() { return classSet; },
          add(c) { classSet.add(c); _className = Array.from(classSet).join(' '); },
          remove(c) { classSet.delete(c); _className = Array.from(classSet).join(' '); },
          toggle(c, val) {
            if (val === undefined) {
              if (classSet.has(c)) classSet.delete(c);
              else classSet.add(c);
            } else if (val) classSet.add(c);
            else classSet.delete(c);
            _className = Array.from(classSet).join(' ');
          },
          contains(c) { return classSet.has(c); }
        },
        children: [],
        value: '',
        innerText: '',
        textContent: '',
        innerHTML: '',
        disabled: false,
        placeholder: '',
        appendChild(child) { this.children.push(child); },
        focus() { this.focused = true; },
        setAttribute() {},
        getAttribute() { return ''; },
        removeAttribute() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {},
        querySelector() { return null; },
        querySelectorAll() { return []; }
      };
    }
    return elements[id];
  }

  // Common UI elements
  getOrCreateEl('chat-box');
  getOrCreateEl('user-input', 'textarea');
  getOrCreateEl('btn-start-interview', 'button');
  getOrCreateEl('btn-end-interview', 'button');
  getOrCreateEl('btn-pause-interview', 'button');
  getOrCreateEl('btn-send', 'button');
  getOrCreateEl('btn-mic', 'button');
  getOrCreateEl('btn-tts', 'button');
  getOrCreateEl('current-question-text', 'h2');
  getOrCreateEl('current-question-badge', 'span');
  getOrCreateEl('chat-status-text', 'span');
  getOrCreateEl('stage-context-guidance', 'div');

  const sessionStorageStore = {
    interview_init_data: JSON.stringify({ jobTitle: 'Fullstack Dev' })
  };
  const sessionStorage = {
    getItem: (k) => (k in sessionStorageStore ? sessionStorageStore[k] : null),
    setItem: (k, v) => { sessionStorageStore[k] = String(v); },
    removeItem: (k) => { delete sessionStorageStore[k]; },
    clear: () => { Object.keys(sessionStorageStore).forEach(k => delete sessionStorageStore[k]); }
  };

  const localStorageStore = {};
  const localStorage = {
    getItem: (k) => (k in localStorageStore ? localStorageStore[k] : null),
    setItem: (k, v) => { localStorageStore[k] = String(v); },
    removeItem: (k) => { delete localStorageStore[k]; },
    clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
  };

  let toasts = [];
  const ctxObj = {
    window: null,
    document: {
      readyState: 'complete',
      getElementById: (id) => elements[id] || getOrCreateEl(id),
      querySelector: () => getOrCreateEl('mock-q'),
      querySelectorAll: () => [],
      createElement: (tag) => getOrCreateEl('el_' + Math.random(), tag),
      body: getOrCreateEl('body'),
      documentElement: getOrCreateEl('html'),
      addEventListener: () => {}
    },
    location: { protocol: 'http:', hostname: 'localhost', port: '5000', pathname: '/features/interview/interview-practice.html', hash: '' },
    fetch: customFetchHandler,
    sessionStorage,
    localStorage,
    speechSynthesis: {
      speaking: false,
      paused: false,
      speak: (utt) => {
        setTimeout(() => { if (utt && utt.onend) utt.onend(); }, 1);
      },
      cancel: () => {},
      pause: () => {},
      resume: () => {},
      getVoices: () => []
    },
    SpeechSynthesisUtterance: function (text) { this.text = text; },
    webkitSpeechRecognition: function () { this.start = () => {}; this.stop = () => {}; this.abort = () => {}; },
    navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } },
    setInterval: () => 999,
    clearInterval: () => {},
    setTimeout: (fn, ms) => setTimeout(fn, ms || 1),
    clearTimeout: (id) => clearTimeout(id),
    requestAnimationFrame: (fn) => setTimeout(fn, 1),
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    console,
    showToast: (msg, type) => { toasts.push({ msg, type }); },
    getCurrentUser: () => ({ id: 'user-resilience', fullname: 'Nguyễn Văn Test' }),
    applyUserSettings: () => {},
    updateUserAuthUI: () => {}
  };
  ctxObj.window = ctxObj;

  const ctx = vm.createContext(ctxObj);

  // Load modules in order
  const files = [
    'FE/shared/js/main.js',
    'FE/features/interview/interview-icons.js',
    'FE/features/interview/interview-agenda.js',
    'FE/features/interview/interview-parser.js',
    'FE/features/interview/interview-api.js',
    'FE/features/interview/interview-chat.js',
    'FE/features/interview/interview-restore.js',
    'FE/features/interview/interview-camera.js',
    'FE/features/interview/interview-timer.js',
    'FE/features/interview/interview-modals.js',
    'FE/features/interview/interview-tts.js',
    'FE/features/interview/interview-stt.js',
    'FE/features/interview/interview-finish.js',
    'FE/features/interview/interview-pause.js',
    'FE/features/interview/interview.js'
  ];

  for (const f of files) {
    const code = fs.readFileSync(resolvePath(f), 'utf8');
    vm.runInContext(code, ctx);
  }

  // Intercept toast calls into test array
  ctx.showToast = (msg, type) => { toasts.push({ msg, type }); };
  ctx.window.showToast = ctx.showToast;

  return { ctx, elements, toasts };
}

async function runSimulationTests() {
  // TEST: Introduction Phase 503 MODEL_INACTIVE Resilience & Retry
  await runAsyncTest('Introduction 503 MODEL_INACTIVE preserves candidate answer, displays guidance & recovers on retry', async () => {
    let failIntro = true;
    const env = createSimulationEnvironment(async (url) => {
      if (url.includes('/api/sessions')) {
        return { ok: true, json: async () => ({ sessionId: 'sess-model-inactive', status: 'in_progress', interviewPhase: 'INTRODUCTION' }) };
      }
      if (url.includes('/api/ai/introduction')) {
        if (failIntro) {
          return {
            ok: false,
            status: 503,
            json: async () => ({
              error: "Mô hình AI 'ag/gemini-3.8-flash' hiện đang ở trạng thái ngừng hoạt động phía nhà cung cấp (MODEL_INACTIVE)."
            })
          };
        }
        return {
          ok: true,
          json: async () => ({
            sessionId: 'sess-model-inactive',
            question: 'Câu hỏi 1: Hãy giải thích Dependency Injection trong C#?',
            topic: 'Architecture'
          })
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    // Start session
    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    const introText = "Tôi là kỹ sư phần mềm với 3 năm kinh nghiệm phát triển microservices.";
    env.elements['user-input'].value = introText;

    // Send introduction (fails with 503 MODEL_INACTIVE)
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 50));

    // Invariants check on failure:
    assert(env.elements['user-input'].value === introText, 'Introduction text must be preserved in textarea');
    assert(env.elements['user-input'].disabled === false, 'Textarea must be re-enabled');
    assert(env.ctx.isProcessingAnswer() === false, 'Processing lock must be released');
    assert(env.ctx.getInterviewPhase() === 'INTRODUCTION', 'Phase must remain INTRODUCTION');

    // UI guidance check:
    const guidanceEl = env.elements['stage-context-guidance'];
    assert(guidanceEl.style.display === 'block', 'Stage guidance banner must be displayed');
    assert(guidanceEl.className.includes('is-error'), 'Stage guidance must have is-error class');
    assert(guidanceEl.innerHTML.includes('Mô hình AI'), 'Guidance must mention AI model');
    assert(guidanceEl.innerHTML.includes('Thử lại'), 'Guidance must contain retry action');

    // Chat box check:
    const chatBox = env.elements['chat-box'];
    const userMsgs = chatBox.children.filter(c => c.classList && c.classList.contains('user-msg'));
    assert(userMsgs.length === 0, 'No user message in chat yet');

    const errorMsgs = chatBox.children.filter(c => c.classList && c.classList.contains('error-msg'));
    assert(errorMsgs.length === 1, 'Chat box must show error notification card');

    // Toast check:
    assert(env.toasts.some(t => t.type === 'danger' && t.msg.includes('MODEL_INACTIVE')), 'Toast displayed for MODEL_INACTIVE');

    // Status bar check:
    const statusText = env.elements['chat-status-text'].innerText;
    assert(statusText.includes('MODEL_INACTIVE'), 'HUD status bar must display MODEL_INACTIVE information');

    // Now recovery: AI provider comes back up, user triggers retry
    failIntro = false;
    await env.ctx.retryInterviewSubmission();
    await new Promise(r => setTimeout(r, 350));

    // Post-recovery invariants:
    assert(env.elements['user-input'].value === '', 'Textarea cleared after successful retry');
    assert(env.ctx.getInterviewPhase() === 'ADAPTIVE_INTERVIEW', 'Phase advanced to ADAPTIVE_INTERVIEW');
    assert(env.elements['current-question-text'].textContent.includes('Dependency Injection'), 'First question shown in prompter');
    assert(!guidanceEl.className.includes('is-error'), 'Stage error guidance not in error state on success');
    assert(!guidanceEl.innerHTML.includes('Mô hình AI'), 'Error text cleared on success');

    const userMsgsAfter = chatBox.children.filter(c => c.classList && c.classList.contains('user-msg'));
    assert(userMsgsAfter.length === 1, 'Chat box has confirmed introduction message');
    assert(userMsgsAfter[0].textContent.trim() === introText, 'Chat message matches candidate answer');

    const errorMsgsAfter = chatBox.children.filter(c => c.classList && c.classList.contains('error-msg'));
    assert(errorMsgsAfter.length === 0, 'Previous error messages cleared from chat after successful retry');
  });

  // TEST: Adaptive Question 504 Timeout Resilience & In-Situ Retry
  await runAsyncTest('Adaptive question 504 timeout preserves answer, index unchanged & recovers on retry', async () => {
    let failAnswer = true;
    const env = createSimulationEnvironment(async (url) => {
      if (url.includes('/api/sessions')) {
        return { ok: true, json: async () => ({ sessionId: 'sess-timeout', status: 'in_progress', interviewPhase: 'INTRODUCTION' }) };
      }
      if (url.includes('/api/ai/introduction')) {
        return {
          ok: true,
          json: async () => ({
            sessionId: 'sess-timeout',
            question: 'Câu hỏi 1: Nêu các nguyên lý SOLID?',
            topic: 'OOP'
          })
        };
      }
      if (url.includes('/api/ai/respond')) {
        if (failAnswer) {
          return {
            ok: false,
            status: 504,
            json: async () => ({ error: 'AI Gateway timeout / 504 error' })
          };
        }
        return {
          ok: true,
          json: async () => ({
            sessionId: 'sess-timeout',
            nextQuestion: 'Câu hỏi 2: Phân biệt Interface và Abstract Class?',
            topic: 'OOP',
            isFinished: false
          })
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    // Start session and complete intro
    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    env.elements['user-input'].value = "Tôi là Fullstack Developer.";
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    assert(env.ctx.getCurrentQuestionIndex() === 0, 'Question index must be 0');

    // Candidate answers Question 1
    const solidAnswer = "SOLID bao gồm Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation và Dependency Inversion.";
    env.elements['user-input'].value = solidAnswer;

    // Send answer (fails with 504 timeout)
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 50));

    // Verify invariants on failure:
    assert(env.elements['user-input'].value === solidAnswer, 'Answer in textarea must be preserved');
    assert(env.elements['user-input'].disabled === false, 'Textarea must be enabled for retry');
    assert(env.ctx.isProcessingAnswer() === false, 'Submission lock must be released');
    assert(env.ctx.getCurrentQuestionIndex() === 0, 'Question index must NOT advance on failure');

    const guidanceEl = env.elements['stage-context-guidance'];
    assert(guidanceEl.style.display === 'block', 'Stage guidance must show timeout error');
    assert(guidanceEl.innerHTML.includes('thời gian chờ'), 'Guidance notes timeout');

    // Candidate retries
    failAnswer = false;
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    // Verify successful progression after retry:
    assert(env.elements['user-input'].value === '', 'Textarea cleared on success');
    assert(env.ctx.getCurrentQuestionIndex() === 1, 'Question index advanced to 1');
    assert(env.elements['current-question-text'].textContent.includes('Abstract Class'), 'Question 2 displayed in prompter');
    assert(!guidanceEl.className.includes('is-error'), 'Stage guidance not in error state on success');
    assert(!guidanceEl.innerHTML.includes('thời gian chờ'), 'Timeout error guidance cleared on success');
  });

  // Final summary report
  console.log('\n--- AI ERROR RESILIENCE TEST RESULTS ---');
  console.log(testResults.join('\n'));
  console.log(`\nPassed: ${passCount} | Failed: ${failCount}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runSimulationTests().catch((err) => {
  console.error("Test execution aborted:", err);
  process.exit(1);
});
