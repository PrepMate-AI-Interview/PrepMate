const fs = require('fs');
const { resolvePath } = require('../helpers/test-env');
const vm = require('vm');

let testResults = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

async function runFlowTest() {
  console.log('=== RUNNING ACCEPTANCE TESTS FOR INTERVIEW FLOW ===\n');

  // Helper to build a clean DOM and context
  async function createTestEnvironment(initialSessionStorage = {}, customFetchHandler = null) {
    const storage = { ...initialSessionStorage };
    const localStore = {};
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
          remove() {
            for (const key of Object.keys(elements)) {
              if (elements[key] === this) delete elements[key];
            }
          },
          focus() { this.focused = true; },
          listeners: {},
          addEventListener(event, handler) {
            this.listeners[event] = this.listeners[event] || [];
            this.listeners[event].push(handler);
          },
          dispatchEvent(event) {
            const eventType = typeof event === "string" ? event : (event && event.type ? event.type : "input");
            const handlers = this.listeners[eventType] || [];
            for (const h of handlers) h(event);
          },
          setAttribute() {},
          getAttribute() { return ''; },
          querySelector() { return null; },
          querySelectorAll() { return []; }
        };
      }
      return elements[id];
    }

    // Pre-create common elements
    const chatBox = getOrCreateEl('chat-box');
    const userInput = getOrCreateEl('user-input', 'textarea');
    const btnStart = getOrCreateEl('btn-start-interview', 'button');
    const btnEnd = getOrCreateEl('btn-end-interview', 'button');
    const btnPause = getOrCreateEl('btn-pause-interview', 'button');
    const btnSend = getOrCreateEl('btn-send', 'button');
    const btnMic = getOrCreateEl('btn-mic', 'button');
    const btnTts = getOrCreateEl('btn-tts', 'button');
    const currentQText = getOrCreateEl('current-question-text', 'h2');
    const currentQBadge = getOrCreateEl('current-question-badge', 'span');
    const questionCounter = getOrCreateEl('question-counter', 'span');
    const chatStatusText = getOrCreateEl('chat-status-text', 'span');
    const timerDisplay = getOrCreateEl('interview-timer-display', 'span');
    const modalConfirm = getOrCreateEl('zoom-start-confirm-modal', 'div');
    const avatarVisual = getOrCreateEl('ai-avatar-visual', 'div');
    const interviewRoom = getOrCreateEl('interview-room', 'div');
    const finishModal = getOrCreateEl('finish-modal', 'div');
    const btnResume = getOrCreateEl('btn-resume-interview', 'button');
    const btnDeepReport = getOrCreateEl('btn-view-deep-report', 'a');
    const finishScoreVal = getOrCreateEl('finish-score-value', 'div');
    const finishScoreVerdict = getOrCreateEl('finish-score-verdict', 'div');

    const dom = {
      readyState: 'complete',
      body: getOrCreateEl('body'),
      documentElement: getOrCreateEl('html'),
      addEventListener: () => {},
      getElementById: (id) => elements[id] || getOrCreateEl(id),
      querySelector: (sel) => {
        if (sel.includes('#user-input')) return userInput;
        if (sel.includes('#candidate-tile')) return getOrCreateEl('candidate-tile');
        if (sel.includes('#ai-avatar-visual')) return avatarVisual;
        return getOrCreateEl('mock-query');
      },
      querySelectorAll: () => [],
      createElement: (tag) => {
        return getOrCreateEl('created_' + Math.random(), tag);
      }
    };

    let fetchCalls = [];

    const mockFetch = async (url, opts) => {
      fetchCalls.push({ url, opts });
      if (customFetchHandler) return customFetchHandler(url, opts);
      return {
        ok: true,
        json: async () => ({ sessionId: 'test-session-123', status: 'in_progress', interviewPhase: 'INTRODUCTION' })
      };
    };

    let speechUtterances = [];
    const mockSpeechSynthesis = {
      speaking: false,
      paused: false,
      pauseCount: 0,
      resumeCount: 0,
      cancelCount: 0,
      speak: (utt) => {
        speechUtterances.push(utt);
        mockSpeechSynthesis.speaking = true;
        mockSpeechSynthesis.paused = false;
        setTimeout(() => {
          if (mockSpeechSynthesis.speaking && !mockSpeechSynthesis.paused) {
            mockSpeechSynthesis.speaking = false;
            if (utt.onend) utt.onend();
          }
        }, 1);
      },
      pause: () => {
        mockSpeechSynthesis.pauseCount++;
        mockSpeechSynthesis.paused = true;
      },
      resume: () => {
        mockSpeechSynthesis.resumeCount++;
        mockSpeechSynthesis.paused = false;
      },
      cancel: () => {
        mockSpeechSynthesis.cancelCount++;
        mockSpeechSynthesis.speaking = false;
        mockSpeechSynthesis.paused = false;
      },
      getVoices: () => []
    };

    const ctxObj = {
      window: null,
      document: dom,
      location: { protocol: 'http:', port: '5000', pathname: '/interview-practice.html', hash: '' },
      sessionStorage: {
        getItem: (k) => storage[k] || null,
        setItem: (k, v) => { storage[k] = String(v); },
        removeItem: (k) => { delete storage[k]; }
      },
      localStorage: {
        getItem: (k) => localStore[k] || null,
        setItem: (k, v) => { localStore[k] = String(v); },
        removeItem: (k) => { delete localStore[k]; }
      },
      fetch: mockFetch,
      speechSynthesis: mockSpeechSynthesis,
      SpeechSynthesisUtterance: function(text) { this.text = text; },
      SpeechRecognition: function MockSpeechRecognition() {
        this.lang = 'vi-VN';
        this.interimResults = false;
        this.maxAlternatives = 1;
        this.continuous = false;
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
        this.onresult = null;
        this.start = () => {
          if (typeof this.onstart === 'function') this.onstart();
        };
        this.stop = () => {
          if (typeof this.onend === 'function') this.onend();
        };
        this.abort = () => {
          if (typeof this.onend === 'function') this.onend();
        };
      },
      navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } },
      setInterval: () => 999,
      clearInterval: () => {},
      setTimeout: (fn, ms) => setTimeout(fn, ms || 1),
      clearTimeout: (id) => clearTimeout(id),
      Event: function MockEvent(type, opts) {
        this.type = type;
        this.bubbles = opts?.bubbles || false;
      },
      requestAnimationFrame: (fn) => setTimeout(fn, 1),
      addEventListener: () => {},
      removeEventListener: () => {},
      console,
      showToast: () => {},
      getCurrentUser: () => ({ id: 'user-1', fullname: 'Nguyễn Văn Hùng' }),
      applyUserSettings: () => {},
      updateUserAuthUI: () => {}
    };
    ctxObj.window = ctxObj;
    const ctx = vm.createContext(ctxObj);

    const mainCode = fs.readFileSync(resolvePath('FE/shared/js/main.js'), 'utf8');
    vm.runInContext(mainCode, ctx);

    const iconsCode = fs.readFileSync(resolvePath('FE/features/interview/interview-icons.js'), 'utf8');
    vm.runInContext(iconsCode, ctx);

    const agendaCode = fs.readFileSync(resolvePath('FE/features/interview/interview-agenda.js'), 'utf8');
    vm.runInContext(agendaCode, ctx);

    const parserCode = fs.readFileSync(resolvePath('FE/features/interview/interview-parser.js'), 'utf8');
    vm.runInContext(parserCode, ctx);

    const apiCode = fs.readFileSync(resolvePath('FE/features/interview/interview-api.js'), 'utf8');
    vm.runInContext(apiCode, ctx);

    const chatCode = fs.readFileSync(resolvePath('FE/features/interview/interview-chat.js'), 'utf8');
    vm.runInContext(chatCode, ctx);

    const restoreCode = fs.readFileSync(resolvePath('FE/features/interview/interview-restore.js'), 'utf8');
    vm.runInContext(restoreCode, ctx);

    const cameraCode = fs.readFileSync(resolvePath('FE/features/interview/interview-camera.js'), 'utf8');
    vm.runInContext(cameraCode, ctx);

    const timerCode = fs.readFileSync(resolvePath('FE/features/interview/interview-timer.js'), 'utf8');
    vm.runInContext(timerCode, ctx);

    const modalsCode = fs.readFileSync(resolvePath('FE/features/interview/interview-modals.js'), 'utf8');
    vm.runInContext(modalsCode, ctx);

    const ttsCode = fs.readFileSync(resolvePath('FE/features/interview/interview-tts.js'), 'utf8');
    vm.runInContext(ttsCode, ctx);

    const sttCode = fs.readFileSync(resolvePath('FE/features/interview/interview-stt.js'), 'utf8');
    vm.runInContext(sttCode, ctx);

    const finishCode = fs.readFileSync(resolvePath('FE/features/interview/interview-finish.js'), 'utf8');
    vm.runInContext(finishCode, ctx);

    const pauseCode = fs.readFileSync(resolvePath('FE/features/interview/interview-pause.js'), 'utf8');
    vm.runInContext(pauseCode, ctx);

    const interviewCode = fs.readFileSync(resolvePath('FE/features/interview/interview.js'), 'utf8');
    vm.runInContext(interviewCode, ctx);

    // Wait for async initInterviewPractice() to finish
    await new Promise(r => setTimeout(r, 60));

    return {
      ctx,
      elements,
      storage,
      localStore,
      sessionStorage: ctxObj.sessionStorage,
      localStorage: ctxObj.localStorage,
      getFetchCalls: () => fetchCalls,
      speechUtterances,
      getCancelCount: () => mockSpeechSynthesis.cancelCount,
      getPauseCount: () => mockSpeechSynthesis.pauseCount,
      getResumeCount: () => mockSpeechSynthesis.resumeCount,
      getMockSpeechSynthesis: () => mockSpeechSynthesis
    };
  }

  // TEST 1 — New interview
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Backend Engineer' }) },
      async (url, opts) => {
        if (url.includes('/api/sessions')) {
          return {
            ok: true,
            json: async () => ({ sessionId: 'sess-new-1', status: 'in_progress', interviewPhase: 'INTRODUCTION' })
          };
        }
        if (url.includes('/api/ai/introduction')) {
          return {
            ok: true,
            json: async () => ({
              sessionId: 'sess-new-1',
              question: 'Chào bạn, câu hỏi kỹ thuật 1: Bạn xử lý database bottleneck thế nào?',
              topic: 'Database Optimization',
              dimension: 'Technical',
              difficulty: 2
            })
          };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    // 1. Initial state check
    assert(env.ctx.window._isInterviewSessionStarted === false, 'Session must not be started before click');
    assert(env.elements['btn-start-interview'].style.display !== 'none', 'Start button must be visible');
    assert(env.elements['user-input'].disabled === true, 'Input must be disabled before start');

    // 2. Click start -> confirm modal
    env.ctx.startInterviewSession();
    assert(env.elements['zoom-start-confirm-modal'].style.display === 'flex', 'Confirm modal must show');

    // 3. Confirm start
    env.ctx.confirmAndStartInterview();
    assert(env.ctx.window._isInterviewSessionStarted === true, 'Session must be started after confirmation');
    assert(env.elements['btn-start-interview'].style.display === 'none', 'Start button must be hidden');
    assert(env.elements['btn-end-interview'].style.display === 'inline-flex', 'End button must be visible');

    await new Promise(r => setTimeout(r, 30));

    // 4. Intro text should be in chat box and prompter
    const chatBox = env.elements['chat-box'];
    assert(chatBox.children.length > 0, 'AI introduction must be appended to chat');

    // 5. User answers intro
    env.elements['user-input'].value = 'Tôi là Hùng, có 2 năm kinh nghiệm backend Node.js và SQL.';
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 400));

    // 6. Verify backend /api/ai/introduction called and response handled
    const calls = env.getFetchCalls();
    assert(calls.some(c => c.url.includes('/api/ai/introduction')), 'Must call /api/ai/introduction');

    // 7. Verify first question displayed in prompter, NOT in textarea
    assert(env.ctx.getInterviewPhase() === 'ADAPTIVE_INTERVIEW', 'Phase must switch to ADAPTIVE_INTERVIEW');
    assert(env.ctx.getCurrentQuestionIndex() === 0, 'First question index must be 0');
    assert(env.elements['current-question-text'].textContent.includes('database bottleneck'), 'First question must be in prompter');
    assert(!env.elements['user-input'].value.includes('database bottleneck'), 'Question must NEVER appear in textarea');

    testResults.push('[PASS] Test 1: New interview flow');
  } catch (e) {
    testResults.push('[FAIL] Test 1: New interview flow - ' + e.message);
  }

  // TEST 2 — Next question
  try {
    let qCount = 0;
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Backend Engineer' }) },
      async (url, opts) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-q2', status: 'in_progress' }) };
        }
        if (url.includes('/api/ai/introduction')) {
          return {
            ok: true,
            json: async () => ({
              nextQuestion: 'Q1: Trình bày về Indexing trong SQL',
              topic: 'Database'
            })
          };
        }
        if (url.includes('/api/ai/respond')) {
          qCount++;
          return {
            ok: true,
            json: async () => ({
              nextQuestion: 'Q2: Sự khác nhau giữa B-Tree và Hash Index?',
              topic: 'Database',
              isFollowUp: true
            })
          };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 30));

    env.elements['user-input'].value = 'Giới thiệu bản thân';
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 400));

    // Now on Q1. Answer Q1:
    env.elements['user-input'].value = 'Indexing giúp tăng tốc truy vấn tìm kiếm.';
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 400));

    assert(qCount === 1, 'Respond API must be called once for Q1');
    assert(env.ctx.getCurrentQuestionIndex() === 1, 'Current question index must be 1');
    assert(env.elements['current-question-text'].textContent.includes('B-Tree và Hash Index'), 'Q2 must be displayed in prompter');

    // Verify chat has user answer 1 and user answer intro
    const userMsgs = env.elements['chat-box'].children.filter(c => c.className && c.className.includes('user-msg'));
    assert(userMsgs.length === 2, 'Chat box must retain Intro answer and Q1 answer');

    testResults.push('[PASS] Test 2: Next question flow');
  } catch (e) {
    testResults.push('[FAIL] Test 2: Next question flow - ' + e.message);
  }

  // TEST 3 — Speech
  try {
    const env = await createTestEnvironment({
      interview_init_data: JSON.stringify({ jobTitle: 'Frontend' })
    });
    env.ctx.startInterviewSession(true);

    let sendCalls = 0;
    const origSend = env.ctx.sendMessage;
    env.ctx.sendMessage = () => { sendCalls++; };

    env.ctx.toggleMic();
    assert(env.ctx.recognition !== null, 'Recognition instance must be instantiated');

    env.ctx.recognition.onresult({
      resultIndex: 0,
      results: [[{ transcript: 'Tôi có kinh nghiệm React', isFinal: true }]]
    });

    assert(env.elements['user-input'].value.includes('Tôi có kinh nghiệm React'), 'Transcript must go to textarea');
    assert(sendCalls === 0, 'Speech result must NEVER auto-submit in normal mode');

    // Toggle mic off
    env.ctx.toggleMic();
    assert(sendCalls === 0, 'Toggling mic off must NEVER auto-submit');

    testResults.push('[PASS] Test 3: Speech recognition transcript without auto-send');
  } catch (e) {
    testResults.push('[FAIL] Test 3: Speech recognition transcript without auto-send - ' + e.message);
  }

  // TEST 4 — TTS OFF
  try {
    const env = await createTestEnvironment({
      interview_init_data: JSON.stringify({ jobTitle: 'Frontend' })
    });
    // Toggle TTS off cleanly via toggleTTS
    if (env.ctx.isTTSEnabled()) {
      env.ctx.toggleTTS();
    }
    assert(env.ctx.isTTSEnabled() === false, 'TTS must be toggled off');

    let callbackFired = false;
    await env.ctx.speakAI('Test question text', () => {
      callbackFired = true;
    });

    assert(callbackFired === true, 'Callback must fire immediately when TTS is OFF');
    assert(env.speechUtterances.length === 0, 'No audio should be spoken when TTS is OFF');

    testResults.push('[PASS] Test 4: TTS OFF does not hang and skips speech');
  } catch (e) {
    testResults.push('[FAIL] Test 4: TTS OFF does not hang and skips speech - ' + e.message);
  }

  // TEST 5 — TTS ON
  try {
    const env = await createTestEnvironment({
      interview_init_data: JSON.stringify({ jobTitle: 'Frontend' })
    });
    if (!env.ctx.isTTSEnabled()) {
      env.ctx.toggleTTS();
    }

    let callbackFired = false;
    await env.ctx.speakAI('Test question speech', () => {
      callbackFired = true;
    });

    await new Promise(r => setTimeout(r, 20));

    assert(env.speechUtterances.length > 0, 'Speech utterance must be dispatched');
    assert(callbackFired === true, 'Callback must fire after speech completes');

    testResults.push('[PASS] Test 5: TTS ON speaks audio and enables input on completion');
  } catch (e) {
    testResults.push('[FAIL] Test 5: TTS ON speaks audio and enables input on completion - ' + e.message);
  }

  // TEST 6 — Pause
  try {
    const env = await createTestEnvironment({
      interview_init_data: JSON.stringify({ jobTitle: 'Backend' })
    });
    env.ctx.startInterviewSession(true);

    assert(env.ctx.isInterviewPaused() === false, 'Initially not paused');
    env.ctx.pauseInterview();
    assert(env.ctx.isInterviewPaused() === true, 'isInterviewPaused must be true');
    assert(env.elements['user-input'].disabled === true, 'Input must be disabled when paused');
    assert(env.elements['btn-pause-interview'].innerHTML.includes('Tiếp tục'), 'Pause button must show Resume');

    // Unpause
    env.ctx.pauseInterview();
    assert(env.ctx.isInterviewPaused() === false, 'isInterviewPaused must be false after resume');
    assert(env.elements['btn-pause-interview'].innerHTML.includes('Tạm dừng'), 'Pause button must revert to Pause');

    testResults.push('[PASS] Test 6: Pause and resume interview');
  } catch (e) {
    testResults.push('[FAIL] Test 6: Pause and resume interview - ' + e.message);
  }

  // TEST 7 — Resume session
  try {
    const existingSession = {
      Id: 'resumed-sess-777',
      Status: 'in_progress',
      InterviewState: {
        InterviewPhase: 'ADAPTIVE_INTERVIEW',
        CurrentTopic: 'System Design'
      },
      Questions: [
        'Câu hỏi 1: Giới thiệu bản thân',
        'Câu hỏi 2: Thiết kế hệ thống Rate Limiter'
      ],
      Answers: [
        { question: 'Giới thiệu bản thân', answer: 'Tôi tên An' },
        { question: 'Câu hỏi 1: Giới thiệu bản thân', answer: 'Câu trả lời 1' }
      ]
    };

    const env = await createTestEnvironment(
      {
        prepmate_backend_session_id: 'resumed-sess-777',
        interview_init_data: JSON.stringify({ jobTitle: 'Architect' })
      },
      async (url) => {
        if (url.includes('resumed-sess-777')) {
          return { ok: true, json: async () => existingSession };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    // Check RESTORE rules:
    assert(env.ctx.window._isInterviewSessionStarted === false, 'Resumed session must NOT auto-start');
    assert(env.elements['btn-start-interview'].style.display !== 'none', 'Start button must be visible');
    assert(env.elements['user-input'].disabled === true, 'Input must be disabled before user clicks Start');
    assert(env.ctx.getInterviewPhase() === 'ADAPTIVE_INTERVIEW', 'Phase must be restored to ADAPTIVE_INTERVIEW');

    // Now user clicks start:
    env.ctx.startInterviewSession(true);
    assert(env.ctx.window._isInterviewSessionStarted === true, 'Session starts only when user confirms');
    assert(env.elements['btn-start-interview'].style.display === 'none', 'Start button must be hidden after start');

    testResults.push('[PASS] Test 7: Resume session without auto-start');
  } catch (e) {
    testResults.push('[FAIL] Test 7: Resume session without auto-start - ' + e.message);
  }

  // TEST 8 — New session state isolation
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'DevOps' }) },
      async () => ({ ok: true, json: async () => ({ sessionId: 'sess-new-8', status: 'in_progress' }) })
    );

    assert(env.ctx.getCurrentQuestionIndex() === 0, 'New session must have index 0');
    assert(env.ctx.getUserResponses().length === 0, 'New session must have empty user responses');
    assert(env.ctx.getInterviewQuestions().length === 0, 'New session must have empty questions array');

    testResults.push('[PASS] Test 8: New session state isolation');
  } catch (e) {
    testResults.push('[FAIL] Test 8: New session state isolation - ' + e.message);
  }

  // TEST 9 — Double click protection
  try {
    let apiCallCount = 0;
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'QA' }) },
      async (url) => {
        if (url.includes('/api/ai/introduction')) {
          apiCallCount++;
          return { ok: true, json: async () => ({ question: 'Q1' }) };
        }
        return { ok: true, json: async () => ({ sessionId: 'sess-9', status: 'in_progress' }) };
      }
    );

    env.ctx.startInterviewSession(true);
    // Double click start
    env.ctx.startInterviewSession(true);
    assert(env.ctx.window._isInterviewSessionStarted === true, 'Session started');

    env.elements['user-input'].value = 'Answer test';
    const p1 = env.ctx.sendMessage();
    // Immediate double click send while processing:
    env.elements['user-input'].value = 'Answer test 2';
    const p2 = env.ctx.sendMessage();

    await Promise.all([p1, p2]);
    assert(apiCallCount === 1, 'Double click Send must only trigger 1 API request');

    testResults.push('[PASS] Test 9: Double click protection');
  } catch (e) {
    testResults.push('[FAIL] Test 9: Double click protection - ' + e.message);
  }

  // TEST 10 — API failure handling
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Security' }) },
      async (url) => {
        if (url.includes('/api/ai/introduction')) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: 'Internal Server Error' })
          };
        }
        return { ok: true, json: async () => ({ sessionId: 'sess-10', status: 'in_progress' }) };
      }
    );

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    env.elements['user-input'].value = 'My intro answer';
    await env.ctx.sendMessage();

    // UI must not be stuck in processing
    assert(env.ctx.isProcessingAnswer() === false, 'isProcessingAnswer must be reset on error');
    assert(env.elements['user-input'].disabled === false, 'Input must be re-enabled for retry');

    testResults.push('[PASS] Test 10: API failure resilience and retry capability');
  } catch (e) {
    testResults.push('[FAIL] Test 10: API failure resilience and retry capability - ' + e.message);
  }

  // TEST 11 — Continuous Question Loop (Intro -> Q1 -> Q2 -> Finish)
  try {
    let questionCounter = 0;
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Fullstack Dev' }) },
      async (url, opts) => {
        if (url.includes('/api/ai/introduction')) {
          return {
            ok: true,
            json: async () => ({
              sessionId: 'sess-11',
              question: 'Q1: Trình bày kiến trúc MVC?',
              topic: 'Architecture'
            })
          };
        }
        if (url.includes('/api/ai/respond')) {
          questionCounter++;
          if (questionCounter === 1) {
            return {
              ok: true,
              json: async () => ({
                sessionId: 'sess-11',
                nextQuestion: 'Q2: Sự khác biệt giữa SQL và NoSQL?',
                topic: 'Database',
                isFinished: false
              })
            };
          } else {
            return {
              ok: true,
              json: async () => ({
                sessionId: 'sess-11',
                message: 'Phỏng vấn kết thúc.',
                isFinished: true
              })
            };
          }
        }
        if (url.includes('/api/ai/end-interview')) {
          return {
            ok: true,
            json: async () => ({
              overallScore: 85,
              scores: { tech: 85, comm: 80, soft: 85, star: 80 }
            })
          };
        }
        return { ok: true, json: async () => ({ sessionId: 'sess-11', status: 'in_progress' }) };
      }
    );

    // 1. Start session
    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    assert(env.ctx._isInterviewSessionStarted === true, 'Session must be started');
    assert(env.elements['btn-start-interview'].style.display === 'none', 'Start button must be hidden');
    assert(env.elements['btn-end-interview'].style.display === 'inline-flex', 'End button must be visible');

    // 2. Submit intro
    env.elements['user-input'].value = 'Xin chào tôi là Hùng, lập trình viên Fullstack.';
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    assert(env.ctx._isInterviewSessionStarted === true, 'Session must remain started after intro');
    assert(env.elements['btn-start-interview'].style.display === 'none', 'Start button must remain hidden after intro');
    assert(env.elements['current-question-text'].textContent === 'Q1: Trình bày kiến trúc MVC?', 'Q1 displayed in prompter');

    // 3. Answer Q1
    env.elements['user-input'].value = 'MVC chia nhỏ thành Model, View, Controller.';
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    assert(env.ctx._isInterviewSessionStarted === true, 'Session must remain started after Q1');
    assert(env.elements['btn-start-interview'].style.display === 'none', 'Start button must remain hidden after Q1');
    assert(env.elements['current-question-text'].textContent === 'Q2: Sự khác biệt giữa SQL và NoSQL?', 'Q2 displayed in prompter');

    // 4. Answer Q2 -> isFinished: true
    env.elements['user-input'].value = 'SQL có schema quan hệ, NoSQL linh hoạt phi quan hệ.';
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 600));

    // Finish modal must be shown
    assert(env.elements['finish-modal'].classList.contains('hidden') === false, 'Finish modal shown');
    assert(env.storage['prepmate_interview_started_sess-11'] === undefined, 'Started flag cleaned up');

    testResults.push('[PASS] Test 11: Continuous loop from Start to Finish without start button re-prompt');
  } catch (e) {
    testResults.push('[FAIL] Test 11: Continuous loop from Start to Finish - ' + e.message);
  }

  // TEST 12 — In-progress reload resilience (seamless continuation)
  try {
    const env = await createTestEnvironment(
      {
        interview_init_data: JSON.stringify({ jobTitle: 'DevOps' }),
        prepmate_backend_session_id: 'sess-12',
        'prepmate_interview_started_sess-12': 'true'
      },
      async (url) => {
        if (url.includes('/api/sessions/sess-12')) {
          return {
            ok: true,
            json: async () => ({
              id: 'sess-12',
              status: 'in_progress',
              interviewState: {
                interviewPhase: 'ADAPTIVE_INTERVIEW',
                currentTopic: 'CI/CD'
              },
              questions: ['Giải thích CI/CD pipeline'],
              answers: [
                { question: 'Giới thiệu bản thân', answer: 'Tôi làm DevOps 3 năm' }
              ]
            })
          };
        }
        return { ok: true, json: async () => ({ sessionId: 'sess-12', status: 'in_progress' }) };
      }
    );

    // Because prepmate_interview_started_sess-12 was 'true', it should resume seamlessly
    assert(env.ctx._isInterviewSessionStarted === true, 'Session must resume as already started');
    assert(env.elements['btn-start-interview'].style.display === 'none', 'Start button must NOT appear on in-progress reload');
    assert(env.elements['btn-end-interview'].style.display === 'inline-flex', 'End button must be visible');
    assert(env.elements['user-input'].disabled === false, 'User input must be enabled for active question');
    assert(env.elements['current-question-text'].textContent.includes('CI/CD pipeline'), 'Active question in prompter');

    testResults.push('[PASS] Test 12: In-progress reload resumes seamlessly without start button re-prompt');
  } catch (e) {
    testResults.push('[FAIL] Test 12: In-progress reload resilience - ' + e.message);
  }

  // TEST 13 — Elimination of fake fallback scores on failed/empty report
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Backend Dev' }) },
      async (url) => {
        if (url.includes('/api/ai/end-interview')) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: 'Chưa có câu trả lời nào được ghi nhận để thực hiện đánh giá năng lực.' })
          };
        }
        return { ok: true, json: async () => ({ sessionId: 'sess-13', status: 'in_progress' }) };
      }
    );

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Candidate ends session before providing any answer
    await env.ctx.endInterview(false);

    const sess = env.ctx.getCurrentInterviewSession();
    assert(sess.isEvaluated === false, 'Session must be marked unevaluated');
    assert(sess.score === 0, 'Score must be 0 instead of fake 65/70/78');
    assert(sess.scores.tech === 0 && sess.scores.comm === 0, 'Category scores must be 0');
    assert(env.elements['finish-score-value'].innerText === '—', 'Modal must show — instead of fake score');
    assert(env.elements['finish-score-verdict'].innerText.includes('Chưa hoàn tất'), 'Verdict must state unevaluated');
    assert(sess.status === 'in_progress', 'Session status must remain in_progress on finish rejection');
    assert(env.sessionStorage.getItem('prepmate_backend_session_id') === 'sess-13', 'sessionStorage must be preserved on rejected finish');
    assert(JSON.parse(env.localStorage.getItem('interview_sessions') || '[]').length === 0, 'No fake completed session saved into localStorage');

    testResults.push('[PASS] Test 13: Elimination of fake fallback scores on failed/empty report');
  } catch (e) {
    testResults.push('[FAIL] Test 13: Elimination of fake fallback scores - ' + e.message);
  }

  // TEST 14 — TTS is not cancelled when interacting with UI during speaking state
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Frontend Engineer' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-14', status: 'in_progress', interviewPhase: 'INTRODUCTION' }) };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    if (!env.ctx.isTTSEnabled()) {
      env.ctx.toggleTTS();
    }

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Keep speech synthesis speaking active without auto-ending immediately
    let speechFinished = false;
    env.ctx.speechSynthesis.speak = (utt) => {
      env.speechUtterances.push(utt);
      env.ctx.speechSynthesis.speaking = true;
    };

    const questionText = "Bạn hiểu thế nào về Event Loop trong JavaScript?";
    await env.ctx.speakAI(questionText, () => {
      speechFinished = true;
    });

    const initialCancels = env.getCancelCount();

    // Verify speaking state and strong reference held on window
    assert(env.ctx.window._activeUtterance !== null, 'Utterance must be referenced on window to prevent GC collection');
    assert(env.ctx.window._currentlySpeakingText === questionText, 'currentlySpeakingText must match the active question');
    assert(env.elements['user-input'].disabled === false, 'user-input must NOT be disabled during speaking so user can prepare answer');

    // Simulate candidate interacting with UI: focus, typing notes, clicking
    env.elements['user-input'].focus();
    env.elements['user-input'].value = "Event loop manages microtasks and macrotasks...";

    // Re-triggering speakAI with same question (e.g. from UI re-render) must be ignored, not cancel
    await env.ctx.speakAI(questionText);

    assert(env.getCancelCount() === initialCancels, 'TTS must NOT be cancelled when user focuses, types or re-renders UI with same question');
    assert(speechFinished === false, 'Speech should still be actively speaking');

    // Now end speech cleanly
    env.ctx.window._activeUtterance.onend();
    assert(speechFinished === true, 'Speech completion callback must fire on onend');
    assert(env.ctx.window._activeUtterance === null, 'Utterance reference cleared on completion');
    assert(env.ctx.window._currentlySpeakingText === null, 'currentlySpeakingText cleared on completion');

    testResults.push('[PASS] Test 14: TTS is not cancelled when interacting with UI during speaking state');
  } catch (e) {
    testResults.push('[FAIL] Test 14: TTS is not cancelled when interacting with UI during speaking state - ' + e.message);
  }

  // TEST 15 — Answer input is completely empty on Question 2 after submitting Question 1
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Fullstack Dev' }) },
      async (url, opts) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-15', status: 'in_progress', interviewPhase: 'INTRODUCTION' }) };
        }
        if (url.includes('/api/ai/introduction')) {
          return {
            ok: true,
            json: async () => ({
              sessionId: 'sess-15',
              question: 'Câu hỏi 1: Giới thiệu cấu trúc React Component?',
              topic: 'React'
            })
          };
        }
        if (url.includes('/api/ai/respond')) {
          return {
            ok: true,
            json: async () => ({
              sessionId: 'sess-15',
              nextQuestion: 'Câu hỏi 2: Giải thích Redux State Flow?',
              topic: 'State Management',
              isFinished: false
            })
          };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    // Start session and complete intro
    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    env.elements['user-input'].value = "Tôi là dev React có 3 năm kinh nghiệm.";
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    assert(env.elements['current-question-text'].textContent.includes('Câu hỏi 1'), 'Must be at Question 1');

    // Now candidate types answer for Question 1
    env.elements['user-input'].value = "React component gồm class component và functional component.";
    
    // Also simulate speech recognition buffer having text
    env.ctx._speechFinalTranscript = "React component gồm class component và functional component.";

    // Submit answer for Question 1
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    // Must be at Question 2 now
    assert(env.elements['current-question-text'].textContent.includes('Câu hỏi 2'), 'Must be at Question 2');
    assert(env.elements['user-input'].value === "", 'user-input must be completely empty on Question 2, no leftover answer');
    assert(env.ctx.getSpeechTranscript() === "", 'Speech transcript buffer must be completely cleared');

    testResults.push('[PASS] Test 15: Answer input is completely empty on Question 2 after submitting Question 1');
  } catch (e) {
    testResults.push('[FAIL] Test 15: Answer input is completely empty on Question 2 - ' + e.message);
  }

  // TEST 16 — Sequential interview questions have strictly isolated answers (no carry-over or appending)
  try {
    let questionIndex = 0;
    const questions = [
      'Câu hỏi 1: REST API vs GraphQL?',
      'Câu hỏi 2: Index trong SQL hoạt động thế nào?',
      'Câu hỏi 3: Microservices vs Monolith?'
    ];
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Backend Dev' }) },
      async (url, opts) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-16', status: 'in_progress', interviewPhase: 'INTRODUCTION' }) };
        }
        if (url.includes('/api/ai/introduction')) {
          return {
            ok: true,
            json: async () => ({
              sessionId: 'sess-16',
              question: questions[0],
              topic: 'API Design'
            })
          };
        }
        if (url.includes('/api/ai/respond')) {
          questionIndex++;
          if (questionIndex < questions.length) {
            return {
              ok: true,
              json: async () => ({
                sessionId: 'sess-16',
                nextQuestion: questions[questionIndex],
                topic: 'Tech Topic ' + questionIndex,
                isFinished: false
              })
            };
          } else {
            return {
              ok: true,
              json: async () => ({
                sessionId: 'sess-16',
                message: 'Phỏng vấn kết thúc.',
                isFinished: true
              })
            };
          }
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Submit Intro
    env.elements['user-input'].value = "Intro candidate answer";
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    // Question 1 -> Answer 1
    assert(env.elements['current-question-text'].textContent.includes(questions[0]), 'Question 1 active');
    env.elements['user-input'].value = "Answer 1: REST dùng HTTP methods, GraphQL dùng single endpoint với query";
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    // Question 2 -> Answer 2
    assert(env.elements['current-question-text'].textContent.includes(questions[1]), 'Question 2 active');
    assert(env.elements['user-input'].value === "", 'Input empty before answering Q2');
    env.elements['user-input'].value = "Answer 2: Index dùng cấu trúc B-Tree để tăng tốc truy vấn";
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    // Question 3 -> Answer 3
    assert(env.elements['current-question-text'].textContent.includes(questions[2]), 'Question 3 active');
    assert(env.elements['user-input'].value === "", 'Input empty before answering Q3');
    env.elements['user-input'].value = "Answer 3: Microservices chia nhỏ dịch vụ độc lập, Monolith gói chung 1 khối";
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    // Verify history integrity
    const responses = env.ctx.getUserResponses ? env.ctx.getUserResponses() : [];
    const history = (env.ctx.window._interviewHistory && env.ctx.window._interviewHistory.length) ? env.ctx.window._interviewHistory : responses;
    assert(history.length === 4, `History must contain Intro + 3 answers (actual: ${history.length})`);
    assert(history[1].answer === "Answer 1: REST dùng HTTP methods, GraphQL dùng single endpoint với query", 'Answer 1 isolated');
    assert(history[2].answer === "Answer 2: Index dùng cấu trúc B-Tree để tăng tốc truy vấn", 'Answer 2 isolated without Answer 1 carry-over');
    assert(history[3].answer === "Answer 3: Microservices chia nhỏ dịch vụ độc lập, Monolith gói chung 1 khối", 'Answer 3 isolated without Answer 1/2 carry-over');

    // Verify chat messages are not doubled or concatenated
    const chatBox = env.elements['chat-box'];
    const userMsgs = chatBox.children.filter(c => c.classList && c.classList.contains('user-msg'));
    assert(userMsgs.length === 4, 'Chat box must have exactly 4 user messages');
    assert(userMsgs[1].textContent.trim() === history[1].answer, 'User message 1 clean');
    assert(userMsgs[2].textContent.trim() === history[2].answer, 'User message 2 clean');
    assert(userMsgs[3].textContent.trim() === history[3].answer, 'User message 3 clean');

    testResults.push('[PASS] Test 16: Sequential interview questions have strictly isolated answers (no carry-over or appending)');
  } catch (e) {
    testResults.push('[FAIL] Test 16: Sequential interview questions have strictly isolated answers - ' + e.message);
  }

  // TEST 17 — API Submit failure preserves answer in user-input for retry (zero data loss)
  try {
    let failSubmit = true;
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Backend Dev' }) },
      async (url, opts) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-17', status: 'in_progress', interviewPhase: 'INTRODUCTION' }) };
        }
        if (url.includes('/api/ai/introduction')) {
          return {
            ok: true,
            json: async () => ({
              sessionId: 'sess-17',
              question: 'Câu hỏi 1: Trình bày thuật toán QuickSort?',
              topic: 'Algorithms'
            })
          };
        }
        if (url.includes('/api/ai/respond')) {
          if (failSubmit) {
            return {
              ok: false,
              status: 500,
              json: async () => ({ error: 'AI Gateway timeout / 500 error' })
            };
          }
          return {
            ok: true,
            json: async () => ({
              sessionId: 'sess-17',
              nextQuestion: 'Câu hỏi 2: Trình bày cấu trúc Heap?',
              topic: 'Algorithms',
              isFinished: false
            })
          };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Submit Intro
    env.elements['user-input'].value = "Candidate intro";
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    // Candidate types in-depth answer for Q1
    const valuableAnswer = "QuickSort là giải thuật chia để trị, chọn pivot phân vùng mảng, độ phức tạp trung bình O(N log N).";
    env.elements['user-input'].value = valuableAnswer;

    // First attempt fails (500)
    await env.ctx.sendMessage();

    // Verify zero data loss on failure
    assert(env.elements['user-input'].value === valuableAnswer, 'Answer in textarea MUST be preserved on API error');
    assert(env.elements['user-input'].disabled === false, 'Textarea must be re-enabled for user retry');
    assert(env.ctx.isProcessingAnswer() === false, 'Submission lock must be released');

    // Chat box must NOT show the failed message
    const chatBox = env.elements['chat-box'];
    const userMsgs = chatBox.children.filter(c => c.classList && c.classList.contains('user-msg'));
    assert(userMsgs.length === 1, 'Only Intro message in chat, failed answer must not appear in chat yet');

    // Now network recovers and user retries
    failSubmit = false;
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    // Verify success after retry
    assert(env.elements['user-input'].value === "", 'Textarea must be cleared after successful retry');
    assert(env.elements['current-question-text'].textContent.includes('Câu hỏi 2'), 'Successfully advanced to Question 2');
    
    const userMsgsAfter = chatBox.children.filter(c => c.classList && c.classList.contains('user-msg'));
    assert(userMsgsAfter.length === 2, 'Chat box now has exactly 2 user messages (Intro + Q1 Answer)');
    assert(userMsgsAfter[1].textContent.trim() === valuableAnswer, 'Chat message matches retried answer');

    testResults.push('[PASS] Test 17: API Submit failure preserves answer in user-input for retry (zero data loss)');
  } catch (e) {
    testResults.push('[FAIL] Test 17: API Submit failure preserves answer in user-input - ' + e.message);
  }

  // TEST 18 (Acceptance Test 1) — Toggle mute while AI is speaking
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'QA Engineer' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-18', status: 'in_progress', interviewPhase: 'INTRODUCTION' }) };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    // Keep speech synthesis speaking active without auto-ending
    env.ctx.speechSynthesis.speak = (utt) => {
      env.speechUtterances.push(utt);
      env.ctx.speechSynthesis.speaking = true;
    };

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Confirm AI is speaking intro question
    assert(env.ctx.speechSynthesis.speaking === true, 'AI must be speaking question');
    const questionTextBefore = env.elements['current-question-text'].textContent;
    const initialCancelCount = env.getCancelCount();
    const fetchCountBefore = env.getFetchCalls().length;

    // User types draft answer
    env.elements['user-input'].value = "Drafting initial notes...";

    // User clicks "Tắt âm thanh"
    env.ctx.toggleTTS();

    // Verify 1: TTS is muted & speech paused
    assert(env.ctx.isTTSEnabled() === false, 'TTS must be toggled off');
    assert(env.ctx.getSpeechState() === 'PAUSED', 'Speech state must transition to PAUSED on mute');
    assert(env.getPauseCount() > 0, 'Speech pause must be invoked on mute');

    // Verify 2: Question is unchanged
    assert(env.elements['current-question-text'].textContent === questionTextBefore, 'Current question must remain unchanged');

    // Verify 3: No submit, no question change, answer input not cleared
    assert(env.elements['user-input'].value === "Drafting initial notes...", 'Answer input must NOT be cleared');
    assert(env.getFetchCalls().length === fetchCountBefore, 'No new API requests must be sent on mute');

    // Verify 4: Answer timer must NOT automatically start
    assert(env.ctx.isQuestionCountdownRunning() === false, 'Answer timer must NOT start when user mutes TTS');

    testResults.push('[PASS] Test 18: Toggle mute while AI is speaking keeps question, input, and does not start timer');
  } catch (e) {
    testResults.push('[FAIL] Test 18: Toggle mute while AI is speaking - ' + e.message);
  }

  // TEST 19 (Acceptance Test 2) — Toggle mute when already in answering state
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'DevOps Engineer' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-19', status: 'in_progress', interviewPhase: 'INTRODUCTION' }) };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    // Start session and let speech naturally complete so answering timer starts
    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 30));

    // Natural completion transitions to listening and starts timer
    assert(env.ctx.isQuestionCountdownRunning() === true, 'Timer should be running in answering state');
    const remainingBefore = env.ctx.getQuestionCountdownRemaining();

    // Set candidate answer text
    env.elements['user-input'].value = "My DevOps answer in progress...";

    // Toggle mute off
    env.ctx.toggleTTS();
    assert(env.ctx.isTTSEnabled() === false, 'TTS is disabled');
    assert(env.elements['user-input'].value === "My DevOps answer in progress...", 'Answer must NOT be lost on mute');
    assert(env.ctx.isQuestionCountdownRunning() === true, 'Timer must NOT be stopped or reset on mute');
    assert(env.ctx.getQuestionCountdownRemaining() === remainingBefore, 'Countdown remaining must NOT reset on mute');

    // Toggle mute back on
    env.ctx.toggleTTS();
    assert(env.ctx.isTTSEnabled() === true, 'TTS is re-enabled');
    assert(env.elements['user-input'].value === "My DevOps answer in progress...", 'Answer must NOT be lost on unmute');
    assert(env.ctx.isQuestionCountdownRunning() === true, 'Timer must remain active on unmute');
    assert(env.ctx.getQuestionCountdownRemaining() === remainingBefore, 'Countdown remaining must NOT reset on unmute');

    testResults.push('[PASS] Test 19: Toggle mute when answering does not reset timer or lose answer');
  } catch (e) {
    testResults.push('[FAIL] Test 19: Toggle mute when answering - ' + e.message);
  }

  // TEST 20 (Acceptance Test 3) — Natural TTS completion starts answer timer
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Data Scientist' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-20', status: 'in_progress', interviewPhase: 'INTRODUCTION' }) };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    let callbackFired = 0;
    const testQuestion = "Bạn đã từng triển khai mô hình Machine Learning nào?";

    await env.ctx.speakAI(testQuestion, () => {
      callbackFired++;
      env.ctx.startQuestionCountdown(120);
    });

    // Natural completion fired via speech utterance onend
    await new Promise(r => setTimeout(r, 20));

    assert(callbackFired === 1, 'Natural TTS completion callback must fire exactly once');
    assert(env.ctx.isQuestionCountdownRunning() === true, 'Answer timer must start on natural TTS completion');
    assert(env.ctx.getQuestionCountdownRemaining() === 120, 'Timer countdown starts at 120s');

    testResults.push('[PASS] Test 20: Natural TTS completion starts answer timer exactly once');
  } catch (e) {
    testResults.push('[FAIL] Test 20: Natural TTS completion - ' + e.message);
  }

  // TEST 21 (Acceptance Test 4) — Mute cancellation does not mimic natural completion
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Security Engineer' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-21', status: 'in_progress', interviewPhase: 'INTRODUCTION' }) };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    let completionFired = false;

    // Simulate browser firing onerror('canceled') or trailing onend upon speechSynthesis.cancel()
    env.ctx.speechSynthesis.speak = (utt) => {
      env.speechUtterances.push(utt);
      env.ctx.speechSynthesis.speaking = true;
    };

    const cancelOriginal = env.ctx.speechSynthesis.cancel;
    env.ctx.speechSynthesis.cancel = () => {
      cancelOriginal();
      const activeUtt = env.ctx.window._activeUtterance;
      // Emit browser cancel event
      if (activeUtt && activeUtt.onerror) {
        activeUtt.onerror({ error: 'canceled' });
      }
    };

    await env.ctx.speakAI("Câu hỏi bảo mật hệ thống...", () => {
      completionFired = true;
      env.ctx.startQuestionCountdown(120);
    });

    assert(env.ctx.speechSynthesis.speaking === true, 'Speech must be speaking initially');

    // Candidate mutes TTS
    env.ctx.toggleTTS();

    await new Promise(r => setTimeout(r, 20));

    assert(completionFired === false, 'User mute / cancellation must NOT fire natural completion callback');
    assert(env.ctx.isQuestionCountdownRunning() === false, 'Answer timer must NOT start on user mute cancellation');

    testResults.push('[PASS] Test 21: Mute cancellation does not mimic natural completion');
  } catch (e) {
    testResults.push('[FAIL] Test 21: Mute cancellation does not mimic natural completion - ' + e.message);
  }

  // TEST 22 (Acceptance Test 5) — Rapid toggle during Introduction speech does not duplicate speech or callback
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Fullstack Architect' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-22', status: 'in_progress', interviewPhase: 'INTRODUCTION' }) };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    // Keep speech active without auto-ending immediately
    env.ctx.speechSynthesis.speak = (utt) => {
      env.speechUtterances.push(utt);
      env.ctx.speechSynthesis.speaking = true;
      env.ctx.speechSynthesis.paused = false;
    };

    // User starts interview -> Introduction speech triggers
    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    assert(env.ctx.getSpeechState() === 'SPEAKING', 'Initial speech state must be SPEAKING');
    assert(env.ctx.getSpeechIdentity() === 'intro', 'Speech identity must be intro');
    assert(env.speechUtterances.length === 1, 'Exactly one utterance must be created for intro');

    const introSessionId = env.ctx.getSpeechSessionId();

    // User rapidly spams toggleTTS 4 times: MUTE -> UNMUTE -> MUTE -> UNMUTE
    env.ctx.toggleTTS(); // 1: Mute
    assert(env.ctx.getSpeechState() === 'PAUSED', 'Toggled to mute must transition to PAUSED');
    assert(env.ctx.isQuestionCountdownRunning() === false, 'Countdown must not run while PAUSED');

    env.ctx.toggleTTS(); // 2: Unmute
    assert(env.ctx.getSpeechState() === 'SPEAKING', 'Toggled back to unmute must transition to SPEAKING');

    env.ctx.toggleTTS(); // 3: Mute
    assert(env.ctx.getSpeechState() === 'PAUSED', 'Toggled to mute must transition to PAUSED');

    env.ctx.toggleTTS(); // 4: Unmute
    assert(env.ctx.getSpeechState() === 'SPEAKING', 'Toggled back to unmute must transition to SPEAKING');

    // Crucial: No duplicate utterance created during toggles!
    assert(env.speechUtterances.length === 1, 'Audio toggles must NOT spawn duplicate utterances');
    assert(env.ctx.getSpeechSessionId() === introSessionId, 'Session ID must remain identical during toggles');

    // Now speech naturally ends
    const activeUtt = env.ctx.window._activeUtterance;
    assert(activeUtt !== null, 'Active utterance must be preserved during toggles');
    activeUtt.onend();

    await new Promise(r => setTimeout(r, 20));

    assert(env.ctx.getSpeechState() === 'FINISHED', 'Speech state must be FINISHED on natural end');
    assert(env.ctx.isQuestionCountdownRunning() === true, 'Countdown must start after speech naturally ends');
    assert(env.elements['user-input'].disabled === false, 'user-input must be enabled after completion');

    testResults.push('[PASS] Test 22: Rapid audio toggle during Introduction speech does not duplicate speech or callback');
  } catch (e) {
    testResults.push('[FAIL] Test 22: Rapid audio toggle during Introduction speech - ' + e.message);
  }

  // TEST 23 (Acceptance Test 6) — Rapid audio toggle during Adaptive Question speech
  try {
    let qCount = 0;
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Backend Dev' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-23', status: 'in_progress' }) };
        }
        if (url.includes('/api/ai/introduction')) {
          return {
            ok: true,
            json: async () => ({
              sessionId: 'sess-23',
              question: 'Câu hỏi 1: Kiến trúc Microservices khác gì Monolithic?',
              topic: 'Architecture'
            })
          };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    // Let Intro finish immediately
    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Keep Question 1 speech active so candidate can toggle during speech
    env.ctx.speechSynthesis.speak = (utt) => {
      env.speechUtterances.push(utt);
      env.ctx.speechSynthesis.speaking = true;
      env.ctx.speechSynthesis.paused = false;
    };

    // Submit Intro
    env.elements['user-input'].value = "Tôi là backend dev.";
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    assert(env.ctx.getInterviewPhase() === 'ADAPTIVE_INTERVIEW', 'Phase switched to ADAPTIVE_INTERVIEW');
    assert(env.ctx.getSpeechIdentity() === 'question_0', 'Identity is question_0');
    assert(env.ctx.getSpeechState() === 'SPEAKING', 'Question 1 must be in SPEAKING state');

    const utterCountBefore = env.speechUtterances.length;
    const q0SessionId = env.ctx.getSpeechSessionId();

    // Candidate rapidly toggles audio 6 times during Question 1
    env.ctx.toggleTTS(); // Mute -> PAUSED
    env.ctx.toggleTTS(); // Unmute -> SPEAKING
    env.ctx.toggleTTS(); // Mute -> PAUSED
    env.ctx.toggleTTS(); // Unmute -> SPEAKING
    env.ctx.toggleTTS(); // Mute -> PAUSED
    env.ctx.toggleTTS(); // Unmute -> SPEAKING

    assert(env.ctx.getSpeechState() === 'SPEAKING', 'Final state is SPEAKING');
    assert(env.speechUtterances.length === utterCountBefore, 'No extra utterances created during Question toggling');
    assert(env.ctx.getSpeechSessionId() === q0SessionId, 'Session ID is preserved across toggles');

    // Naturally finish Question 1 speech
    let callbackCount = 0;
    const origCb = env.ctx.window._activeSpeechCallback;
    env.ctx.window._activeSpeechCallback = () => {
      callbackCount++;
      if (origCb) origCb();
    };

    env.ctx.window._activeUtterance.onend();
    await new Promise(r => setTimeout(r, 20));

    assert(callbackCount === 1, 'Callback must fire exactly once upon completion');
    assert(env.ctx.getSpeechState() === 'FINISHED', 'Speech state is FINISHED');

    testResults.push('[PASS] Test 23: Rapid audio toggle during Adaptive Question speech');
  } catch (e) {
    testResults.push('[FAIL] Test 23: Rapid audio toggle during Adaptive Question speech - ' + e.message);
  }

  // TEST 24 (Acceptance Test 7) — Multiple toggles ending in PAUSED does not trigger premature answering
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'QA Lead' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-24', status: 'in_progress' }) };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    // Keep speech active
    env.ctx.speechSynthesis.speak = (utt) => {
      env.speechUtterances.push(utt);
      env.ctx.speechSynthesis.speaking = true;
      env.ctx.speechSynthesis.paused = false;
    };

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Toggle 3 times: MUTE -> UNMUTE -> MUTE (leaves it MUTED/PAUSED)
    env.ctx.toggleTTS();
    env.ctx.toggleTTS();
    env.ctx.toggleTTS();

    assert(env.ctx.isTTSEnabled() === false, 'TTS must be disabled');
    assert(env.ctx.getSpeechState() === 'PAUSED', 'Speech state must be PAUSED');

    // Wait simulated time
    await new Promise(r => setTimeout(r, 50));

    assert(env.ctx.isQuestionCountdownRunning() === false, 'Timer must NOT start while PAUSED');
    assert(env.elements['current-question-text'].textContent.includes('Xin chào'), 'Question content remains intact');

    // User can type notes in input box without resetting
    env.elements['user-input'].value = "Preparing answer while audio is paused...";
    assert(env.elements['user-input'].value === "Preparing answer while audio is paused...", 'User input preserved');

    testResults.push('[PASS] Test 24: Multiple toggles ending in PAUSED does not trigger premature answering');
  } catch (e) {
    testResults.push('[FAIL] Test 24: Multiple toggles ending in PAUSED - ' + e.message);
  }

  // TEST 25 (Acceptance Test 8) — Question transition while PAUSED cancels old speech session cleanly
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Security Analyst' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-25', status: 'in_progress' }) };
        }
        if (url.includes('/api/ai/introduction')) {
          return {
            ok: true,
            json: async () => ({
              sessionId: 'sess-25',
              question: 'Câu hỏi 1: Mô tả nguyên lý Zero Trust?',
              topic: 'Security'
            })
          };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    // Keep speech active
    env.ctx.speechSynthesis.speak = (utt) => {
      env.speechUtterances.push(utt);
      env.ctx.speechSynthesis.speaking = true;
      env.ctx.speechSynthesis.paused = false;
    };

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Pause audio
    env.ctx.toggleTTS();
    assert(env.ctx.getSpeechState() === 'PAUSED', 'Intro speech is PAUSED');

    const introUtt = env.ctx.window._activeUtterance;
    const introSessionId = env.ctx.getSpeechSessionId();

    // User submits intro answer directly while paused
    env.elements['user-input'].value = "Tôi là Security Analyst có 4 năm kinh nghiệm.";
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 350));

    // Old speech session must have been cancelled
    assert(env.ctx.getSpeechSessionId() > introSessionId, 'New speech session must have higher ID');
    assert(env.ctx.getSpeechIdentity() === 'question_0', 'Identity switched to question_0');

    // Trailing onend event from old utterance must be cleanly ignored and NOT affect question 1
    if (introUtt && introUtt.onend) {
      introUtt.onend();
    }
    assert(env.ctx.getSpeechIdentity() === 'question_0', 'Question 0 identity remains active');

    testResults.push('[PASS] Test 25: Question transition while PAUSED cancels old speech session cleanly');
  } catch (e) {
    testResults.push('[FAIL] Test 25: Question transition while PAUSED - ' + e.message);
  }

  // TEST 26 (NEW-001) — Async Race between In-Flight API and Interview End
  try {
    let resolveIntro;
    const introPromise = new Promise(resolve => { resolveIntro = resolve; });
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Backend Engineer' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-26', status: 'in_progress' }) };
        }
        if (url.includes('/api/ai/introduction')) {
          await introPromise;
          return {
            ok: true,
            json: async () => ({
              sessionId: 'sess-26',
              question: 'Câu hỏi 1: Late question arrival',
              topic: 'Architecture'
            })
          };
        }
        if (url.includes('/api/ai/end-interview')) {
          return { ok: true, json: async () => ({ report: { score: 85 } }) };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Submit intro (in flight)
    env.elements['user-input'].value = "Tôi là Backend Dev.";
    const sendPromise = env.ctx.sendMessage();

    // User ends interview before API responds
    await env.ctx.endInterview(false);
    assert(env.ctx.getInterviewPhase() === 'COMPLETED', 'Interview phase must be COMPLETED');

    // Now resolve in-flight intro API call
    resolveIntro();
    await sendPromise;
    await new Promise(r => setTimeout(r, 50));

    // Phase must remain COMPLETED and not regress to ADAPTIVE_INTERVIEW
    assert(env.ctx.getInterviewPhase() === 'COMPLETED', 'Interview phase must remain COMPLETED after in-flight response');

    testResults.push('[PASS] Test 26: Async race between in-flight API and interview end safely guarded');
  } catch (e) {
    testResults.push('[FAIL] Test 26: Async race between in-flight API and interview end - ' + e.message);
  }

  // TEST 27 (NEW-002) — Think time interval tracking and no timer leak
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Frontend Dev' }) },
      async (url) => ({ ok: true, json: async () => ({ sessionId: 'sess-27', status: 'in_progress' }) })
    );

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Request think time
    env.ctx.requestThinkTime();
    const firstInterval = env.ctx.window._thinkTimeInterval;
    assert(firstInterval !== null, 'Think time interval must be actively tracked');

    // Request think time again (should replace without leaking)
    env.ctx.requestThinkTime();
    const secondInterval = env.ctx.window._thinkTimeInterval;
    assert(secondInterval !== null, 'Second interval created');

    // Pause interview must clear think time interval
    env.ctx.pauseInterview();
    assert(env.ctx.window._thinkTimeInterval === null, 'Think time interval cleared on pause');

    // Request think time again then end interview
    env.ctx.pauseInterview(); // unpause
    env.ctx.requestThinkTime();
    assert(env.ctx.window._thinkTimeInterval !== null, 'Think time active before end');

    await env.ctx.endInterview(false);
    assert(env.ctx.window._thinkTimeInterval === null, 'Think time interval cleared on end interview');

    testResults.push('[PASS] Test 27: Think time interval lifecycle tracked with zero timer leaks');
  } catch (e) {
    testResults.push('[FAIL] Test 27: Think time interval lifecycle - ' + e.message);
  }

  // TEST 28 (NEW-003) — Double submission guard on endInterview
  try {
    let reportCalls = 0;
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'QA Engineer' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-28', status: 'in_progress' }) };
        }
        if (url.includes('/api/ai/end-interview')) {
          reportCalls++;
          return { ok: true, json: async () => ({ report: { score: 90 } }) };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Concurrently trigger endInterview twice
    const p1 = env.ctx.endInterview(false);
    const p2 = env.ctx.endInterview(false);
    await Promise.all([p1, p2]);

    assert(reportCalls === 1, 'End interview report API must be called exactly once; calls: ' + reportCalls);
    testResults.push('[PASS] Test 28: Double invocation mutex guard on endInterview verified');
  } catch (e) {
    testResults.push('[FAIL] Test 28: Double invocation mutex guard on endInterview - ' + e.message);
  }

  // TEST 29 (NEW-006 & TL-001) — Hardware & audio lifecycle cleanup on page unload / pagehide
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Dev' }) },
      async (url) => ({ ok: true, json: async () => ({ sessionId: 'sess-29', status: 'in_progress' }) })
    );

    let tracksStopped = false;
    env.ctx.window._userWebcamStream = {
      active: true,
      getTracks: () => [{ stop: () => { tracksStopped = true; } }]
    };

    // Override speak on mockSpeechSynthesis to keep speech actively in SPEAKING state
    const synth = env.getMockSpeechSynthesis();
    synth.speak = (utt) => {
      env.speechUtterances.push(utt);
      synth.speaking = true;
      synth.paused = false;
    };

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Request think time
    env.ctx.requestThinkTime();
    assert(env.ctx.window._thinkTimeInterval !== null, 'Think time active before unload');
    assert(env.ctx.getSpeechState() === 'SPEAKING', 'Speech must be SPEAKING before cleanup');

    // Trigger cleanupAllInterviewResources
    env.ctx.cleanupAllInterviewResources('test_unload');

    assert(tracksStopped === true, 'Camera tracks must be stopped on unload');
    assert(env.ctx.window._userWebcamStream === null, 'Camera stream cleared');
    assert(env.ctx.window._thinkTimeInterval === null, 'Think time timer cleared');
    assert(env.ctx.getSpeechState() === 'CANCELLED', 'Speech state must be CANCELLED after cleanup');

    testResults.push('[PASS] Test 29: Hardware and audio lifecycle cleaned up on page unload / pagehide');
  } catch (e) {
    testResults.push('[FAIL] Test 29: Hardware and audio lifecycle cleanup - ' + e.message);
  }

  // TEST 30 — Voice/typing synchronization (2-Way voice <-> manual typing sync)
  try {
    const env = await createTestEnvironment({
      interview_init_data: JSON.stringify({ jobTitle: 'Frontend Developer' })
    });
    env.ctx.startInterviewSession(true);

    // 1. User types manually while microphone is MUTED (off)
    assert(env.ctx.isListening === false, 'Microphone must be MUTED initially');
    env.elements['user-input'].value = "Tôi có 5 năm làm việc với Vue và React.";
    env.elements['user-input'].dispatchEvent(new env.ctx.Event('input', { bubbles: true }));

    // 2. Transcript buffer must be synchronized with the manual typing
    assert(env.ctx.getSpeechTranscript() === "Tôi có 5 năm làm việc với Vue và React.", 'Transcript buffer must synchronize from manual typing');

    // 3. Turn ON microphone -> text must be preserved and not wiped
    env.ctx.toggleMic();
    assert(env.ctx.isListening === true, 'Microphone must be listening now');
    assert(env.elements['user-input'].value === "Tôi có 5 năm làm việc với Vue và React.", 'user-input must preserve manual text when turning on mic');

    // 4. Speech recognition delivers new speech segment -> must append to manual text
    env.ctx.recognition.onresult({
      resultIndex: 0,
      results: [[{ transcript: 'và TypeScript', isFinal: true }]]
    });
    assert(env.elements['user-input'].value.includes("Tôi có 5 năm làm việc với Vue và React. và TypeScript"), 'Speech transcript must append to manual text');

    // 5. Turn OFF microphone
    env.ctx.toggleMic();
    assert(env.ctx.isListening === false, 'Microphone must be muted after toggle');

    testResults.push('[PASS] Test 30: Voice/typing synchronization preserves and appends text');
  } catch (e) {
    testResults.push('[FAIL] Test 30: Voice/typing synchronization - ' + e.message);
  }

  // TEST 31 — Failed-submit answer preservation (candidate answer preserved on API failure)
  try {
    let shouldFail = false;
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'DevOps Engineer' }) },
      async (url, opts) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-fail-1', status: 'in_progress', interviewPhase: 'INTRODUCTION' }) };
        }
        if (url.includes('/api/ai/introduction')) {
          if (shouldFail) {
            throw new Error('Network timeout during introduction submission');
          }
          return { ok: true, json: async () => ({ sessionId: 'sess-fail-1', question: 'Q1', topic: 'CI/CD' }) };
        }
        return { ok: true, json: async () => ({}) };
      }
    );
    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 50));

    const candidateAnswer = "Tôi chuyên về Docker, Kubernetes và Terraform.";
    env.elements['user-input'].value = candidateAnswer;
    env.elements['user-input'].dispatchEvent(new env.ctx.Event('input', { bubbles: true }));

    // Trigger failure
    shouldFail = true;
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 100));

    // Verify candidate answer is preserved in user-input textarea
    assert(env.elements['user-input'].value === candidateAnswer, 'Answer in textarea must be preserved on API error');
    assert(env.elements['user-input'].disabled === false, 'user-input must be re-enabled for candidate retry');

    // Verify transcript buffer is also restored
    assert(env.ctx.getSpeechTranscript() === candidateAnswer, 'Speech transcript buffer must be restored to previous answer');

    testResults.push('[PASS] Test 31: Failed-submit answer preservation in textarea and STT buffer');
  } catch (e) {
    testResults.push('[FAIL] Test 31: Failed-submit answer preservation - ' + e.message);
  }

  // TEST 32 (WI-02B3) — Interview lifecycle consistency & resume on HTTP 400 finish rejection
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Fullstack Dev' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-32-lifecycle', status: 'in_progress', interviewPhase: 'ADAPTIVE_INTERVIEW' }) };
        }
        if (url.includes('/api/ai/end-interview')) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: 'Phiên phỏng vấn chưa có đủ dữ liệu câu trả lời để tạo báo cáo đánh giá.' })
          };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Candidate attempts to end interview with insufficient data
    await env.ctx.endInterview(false);

    const sess = env.ctx.getCurrentInterviewSession();
    assert(sess.status === 'in_progress', 'Session status must stay in_progress after 400 rejection');
    assert(sess.isEvaluated === false, 'Session must not be marked evaluated');
    assert(env.sessionStorage.getItem('prepmate_backend_session_id') === 'sess-32-lifecycle', 'sessionStorage must be preserved');
    assert(env.sessionStorage.getItem('prepmate_interview_started_sess-32-lifecycle') === 'true', 'Session started flag must be preserved');
    assert(JSON.parse(env.localStorage.getItem('interview_sessions') || '[]').length === 0, 'localStorage must NOT record completed session');

    // Finish modal must show un-evaluated state with resume button
    assert(env.elements['finish-modal'].classList.contains('hidden') === false, 'Finish modal must be shown');
    assert(env.elements['finish-score-value'].innerText === '—', 'Score display must be —');
    assert(env.elements['finish-score-verdict'].innerText.includes('Chưa hoàn tất'), 'Verdict must be un-evaluated');

    const deepReportBtn = env.elements['btn-view-deep-report'];
    assert(deepReportBtn.style.display === 'none', 'Deep report button must be hidden for unevaluated session');

    const resumeBtn = env.elements['btn-resume-interview'];
    assert(resumeBtn !== undefined && resumeBtn !== null, 'Resume interview button must be present in modal');
    assert(resumeBtn.style.display !== 'none', 'Resume interview button must be displayed');

    // Candidate clicks "Tiếp tục phỏng vấn" (resume)
    env.ctx.resumeInterviewFromFinishModal();
    assert(env.elements['finish-modal'].classList.contains('hidden') === true, 'Finish modal must be dismissed on resume');
    assert(env.elements['interview-room'].style.filter === '', 'Room blur must be removed on resume');
    assert(sess.status === 'in_progress', 'Session must remain in_progress after resume');

    testResults.push('[PASS] Test 32: Interview lifecycle consistency & resume on HTTP 400 rejection');
  } catch (e) {
    testResults.push('[FAIL] Test 32: Interview lifecycle consistency & resume - ' + e.message);
  }

  // TEST 33 (WI-02B3) — Error differentiation: Network & 500 error lifecycle preservation
  try {
    let networkFail = true;
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'DevOps Engineer' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-33-netfail', status: 'in_progress' }) };
        }
        if (url.includes('/api/ai/end-interview')) {
          if (networkFail) {
            const err = new TypeError('Failed to fetch');
            throw err;
          } else {
            return {
              ok: false,
              status: 500,
              json: async () => ({ error: 'AI Gateway internal error' })
            };
          }
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // 1. Network failure during endInterview
    networkFail = true;
    await env.ctx.endInterview(false);

    let sess = env.ctx.getCurrentInterviewSession();
    assert(sess.status === 'in_progress', 'Session must remain in_progress on network error');
    assert(env.sessionStorage.getItem('prepmate_backend_session_id') === 'sess-33-netfail', 'sessionStorage preserved on network error');
    assert(env.elements['finish-modal'].classList.contains('hidden') === true, 'Finish modal must be hidden on network error');

    // 2. HTTP 500 server error during endInterview
    networkFail = false;
    await env.ctx.endInterview(false);

    sess = env.ctx.getCurrentInterviewSession();
    assert(sess.status === 'in_progress', 'Session must remain in_progress on 500 server error');
    assert(env.sessionStorage.getItem('prepmate_backend_session_id') === 'sess-33-netfail', 'sessionStorage preserved on 500 error');
    assert(env.elements['finish-modal'].classList.contains('hidden') === true, 'Finish modal must be hidden on 500 error');

    testResults.push('[PASS] Test 33: Error differentiation preserves session on Network and 500 server errors');
  } catch (e) {
    testResults.push('[FAIL] Test 33: Error differentiation preserves session - ' + e.message);
  }

  // TEST 34 (WI-02B3) — Successful end-interview state consistency
  try {
    const env = await createTestEnvironment(
      { interview_init_data: JSON.stringify({ jobTitle: 'Security Specialist' }) },
      async (url) => {
        if (url.includes('/api/sessions')) {
          return { ok: true, json: async () => ({ sessionId: 'sess-34-success', status: 'in_progress' }) };
        }
        if (url.includes('/api/ai/introduction')) {
          return { ok: true, json: async () => ({ question: 'Bạn áp dụng mô hình STAR thế nào?' }) };
        }
        if (url.includes('/api/ai/end-interview')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              report: {
                overallScore: 88,
                techScore: 90,
                commScore: 85,
                softScore: 84,
                starScore: 86,
                strengths: 'Kiến thức bảo mật chuyên sâu.',
                improvements: 'Cần bổ sung thêm ví dụ thực tế.',
                suggestion: 'Tiếp tục phát huy.'
              }
            })
          };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    env.ctx.startInterviewSession(true);
    await new Promise(r => setTimeout(r, 20));

    // Submit valid response
    env.elements['user-input'].value = "Tôi triển khai zero-trust architecture và TLS 1.3.";
    await env.ctx.sendMessage();
    await new Promise(r => setTimeout(r, 20));

    // Candidate ends session with success
    await env.ctx.endInterview(false);

    const sess = env.ctx.getCurrentInterviewSession();
    assert(sess.status === 'completed', 'Session status must be completed on report success');
    assert(sess.isEvaluated === true, 'Session must be marked evaluated');
    assert(sess.score === 88, 'Overall score must be 88');
    assert(env.ctx.getInterviewPhase() === 'COMPLETED', 'Phase must be COMPLETED');
    assert(env.sessionStorage.getItem('prepmate_backend_session_id') === null, 'sessionStorage must be cleared on true completion');

    const savedSessions = JSON.parse(env.localStorage.getItem('interview_sessions') || '[]');
    assert(savedSessions.length === 1, 'Completed session must be persisted in localStorage');
    assert(savedSessions[0].status === 'completed', 'Persisted session must have completed status');

    const deepReportBtn = env.elements['btn-view-deep-report'];
    assert(deepReportBtn.style.display !== 'none', 'Deep report button must be displayed on successful finish');

    testResults.push('[PASS] Test 34: Successful end-interview state consistency and storage clearance');
  } catch (e) {
    testResults.push('[FAIL] Test 34: Successful end-interview state consistency - ' + e.message);
  }

  // TEST 35 (Acceptance Test Final) — Full test suite regression verification
  try {
    const passedTests = testResults.filter(r => r.startsWith('[PASS]'));
    const failedTests = testResults.filter(r => r.startsWith('[FAIL]'));
    assert(failedTests.length === 0, 'Zero failed tests allowed. Failures: ' + failedTests.join(', '));
    assert(passedTests.length === 34, 'Expected 34 preceding PASS tests, found ' + passedTests.length);

    testResults.push('[PASS] Test 35: Full regression suite verified with 35/35 PASS');
  } catch (e) {
    testResults.push('[FAIL] Test 35: Full regression suite verification - ' + e.message);
  }

  console.log('\n--- FINAL ACCEPTANCE TEST RESULTS ---');
  console.log(testResults.join('\n'));
}

runFlowTest();
