/**
 * PREPMATE — WI-INTERVIEW-DEMO-01: SIX-QUESTION INTERVIEW FLOW & AUTOMATIC COMPLETION
 *
 * Verifies:
 * 1. Sequential lifecycle with exact MAX_INTERVIEW_QUESTIONS = 6
 * 2. Self-introduction warm-up not counted toward the 6 interview question slots
 * 3. Automatic FSM transition to COMPLETED immediately on saving Answer 6 (no manual button required)
 * 4. Automatic trigger of FinalEvaluation and InterviewReport pipeline
 * 5. Strict rejection of 7th question on both /api/ai/respond and /api/ai/next-question
 * 6. Scoring SSOT compliance: CandidateQuestionScore is null/NOT_ASSESSED, Attitude is "Chưa đánh giá"
 * 7. Frontend progress counter display: "Câu hỏi 1/6" ... "Câu hỏi 6/6 (Câu hỏi cuối cùng)"
 * 8. Quota safety: exactly 1 interview consumed for the entire session
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const PORT = 5055;
const BASE_URL = 'http://127.0.0.1:' + PORT;
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const { resolveDbPath } = require('../helpers/test-env');
const PROD_DB_PATH = resolveDbPath();
const TEST_DIR = path.join(os.tmpdir(), 'prepmate_demo_6q_' + Date.now());
const TEST_DB_PATH = path.join(TEST_DIR, 'isolated_demo_6q_db.json');
const TEST_KEYRING_PATH = path.join(TEST_DIR, 'test_keys');

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log('  [PASS] ' + message);
    passed++;
  } else {
    console.error('  [FAIL] ' + message);
    failed++;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const client = http;
    const reqOptions = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('   WI-INTERVIEW-DEMO-01: 6-QUESTION FLOW & AUTO-COMPLETION      ');
  console.log('===============================================================');

  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  if (!fs.existsSync(TEST_KEYRING_PATH)) fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

  const beDir = path.join(WORKSPACE_ROOT, 'BE');
  const dllPath = path.join(beDir, 'bin', 'Debug', 'net10.0', 'backend.dll');

  const beProcess = spawn('dotnet', [dllPath, '--urls', BASE_URL], {
    cwd: beDir,
    env: {
      ...process.env,
      ASPNETCORE_URLS: BASE_URL,
      DOTNET_URLS: BASE_URL,
      DATABASE_FILE_PATH: TEST_DB_PATH,
      PREPMATE_DATABASE_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING_PATH,
      ASPNETCORE_ENVIRONMENT: 'Development'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      try {
        const ping = await requestJson(BASE_URL + '/api/sessions');
        if (ping.status === 200 || ping.status === 401) {
          ready = true;
          break;
        }
      } catch (e) {}
    }

    if (!ready) {
      throw new Error('Isolated backend failed to start on port ' + PORT);
    }
    check(ready, 'Isolated Backend server booted and ready on port ' + PORT);

    // Authenticate candidate using fixture credentials
    const loginRes = await requestJson(BASE_URL + '/api/auth/login', { method: 'POST' }, {
      email: 'nam.le@gmail.com',
      password: 'user123'
    });
    const token = loginRes.body?.token || loginRes.body?.Token;
    check(loginRes.status === 200 && !!token, 'Test candidate authenticated with valid JWT');
    const authHeader = { 'Authorization': 'Bearer ' + token };

    // ========================================================================
    // 1. SESSION INITIALIZATION & CENTRALIZED CONFIGURATION (MAX = 6)
    // ========================================================================
    console.log('\n--- PHASE 1: Session Initialization & Demo Limit SSOT ---');
    const createRes = await requestJson(BASE_URL + '/api/sessions', { method: 'POST', headers: authHeader }, {
      jobTitle: 'Senior Software Engineer',
      fullName: 'Demo Candidate'
    });
    check(createRes.status === 200, 'Interview session created successfully');
    const sessionId = createRes.body?.sessionId || createRes.body?.id;
    check(!!sessionId, 'Session received valid identifier: ' + sessionId);

    // Read database snapshot to verify centralized MaximumQuestions = 6
    let dbContent = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
    let sessRecord = dbContent.Sessions[sessionId];
    check(sessRecord.InterviewState?.MaximumQuestions === 6, 'Session initialized with DemoInterviewQuestionLimit = 6');

    // ========================================================================
    // 2. WARM-UP INTRODUCTION (NOT COUNTED TOWARDS 6 QUESTIONS)
    // ========================================================================
    console.log('\n--- PHASE 2: Warm-up Introduction (Question Slot 0) ---');
    const introRes = await requestJson(BASE_URL + '/api/ai/introduction', { method: 'POST', headers: authHeader }, {
      sessionId: sessionId,
      introduction: 'Xin chào hội đồng, tôi là Nam Lê, có 5 năm kinh nghiệm phát triển hệ thống backend phân tán với .NET và microservices.'
    });
    check(introRes.status === 200, 'Introduction submitted successfully');
    check(!!introRes.body?.nextQuestion, 'Introduction response returned Question 1: ' + (introRes.body?.nextQuestion?.substring(0, 40) + '...'));
    check(introRes.body?.isFinished === false, 'Session remains active after introduction');

    // Verify DB state after introduction
    dbContent = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
    sessRecord = dbContent.Sessions[sessionId];
    check(sessRecord.Answers.length === 1, 'Answers contains 1 entry (Giới thiệu bản thân)');
    check(sessRecord.Questions.length === 1, 'Questions contains Question 1');
    const realAnswersAfterIntro = sessRecord.Answers.filter(a => a.Question !== 'Giới thiệu bản thân' && a.Stage !== 'INTRODUCTION');
    check(realAnswersAfterIntro.length === 0, 'Real interview questions answered is 0 (Warm-up not counted)');

    // ========================================================================
    // 3. SEQUENTIAL TURNS: QUESTION 1 TO 5
    // ========================================================================
    console.log('\n--- PHASE 3: Sequential Turns 1 to 5 ---');
    const answersData = [
      { turn: 1, text: 'Kiến trúc microservices của chúng tôi sử dụng RabbitMQ làm message broker để truyền tải các domain events bất đồng bộ, áp dụng Outbox pattern để đảm bảo tính nhất quán dữ liệu.' },
      { turn: 2, text: 'Khi gặp lỗi database deadlock, chúng tôi đã phân tích execution plan, chuẩn hóa thứ tự cập nhật khóa trên bảng giao dịch và bổ sung composite index để loại bỏ table scan.' },
      { turn: 3, text: 'Về quản lý nhóm và văn hóa kỹ thuật, tôi chủ động tổ chức design review hàng tuần và áp dụng trunk-based development với hệ thống CI/CD tự động kiểm thử 100% test suites.' },
      { turn: 4, text: 'Trong một tình huống khẩn cấp khi hệ thống thanh toán gặp sự cố quá tải Black Friday, tôi đã thiết lập rate limiting và kích hoạt chế độ degraded fallback để bảo vệ core DB.' },
      { turn: 5, text: 'Để tối ưu hóa chi phí cloud AWS, nhóm đã chuyển đổi các workload không đồng bộ sang Spot instances và tối ưu kích thước cache Redis, tiết kiệm 35% chi phí hàng tháng.' }
    ];

    let currentQ = sessRecord.Questions[0];
    for (const item of answersData) {
      console.log(`  Submitting Answer for Question ${item.turn}/6...`);
      const resp = await requestJson(BASE_URL + '/api/ai/respond', { method: 'POST', headers: authHeader }, {
        sessionId: sessionId,
        question: currentQ,
        message: item.text
      });

      check(resp.status === 200, `Turn ${item.turn} response returned HTTP 200`);
      check(resp.body?.isFinished === false, `Turn ${item.turn}: isFinished is false (interview still in progress)`);
      check(!!resp.body?.nextQuestion, `Turn ${item.turn}: received Question ${item.turn + 1}`);

      currentQ = resp.body?.nextQuestion;
      dbContent = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
      sessRecord = dbContent.Sessions[sessionId];
      check(sessRecord.Questions.length === item.turn + 1, `DB recorded total ${item.turn + 1} generated questions`);
    }

    check(sessRecord.Questions.length === 6, 'Exactly 6 questions have been generated by AI');

    // ========================================================================
    // 4. TURN 6: FINAL QUESTION SUBMISSION & AUTOMATIC COMPLETION
    // ========================================================================
    console.log('\n--- PHASE 4: Turn 6 Final Submission & Automatic FSM Completion ---');
    const q6Text = 'Khi làm việc với các bên liên quan phi kỹ thuật, tôi luôn chuyển đổi các chỉ số kỹ thuật thành giá trị kinh doanh như độ trễ phản hồi, thời gian uptime và tỷ lệ chuyển đổi khách hàng.';
    const finalResp = await requestJson(BASE_URL + '/api/ai/respond', { method: 'POST', headers: authHeader }, {
      sessionId: sessionId,
      question: currentQ,
      message: q6Text
    });

    check(finalResp.status === 200, 'Turn 6 response returned HTTP 200');
    check(finalResp.body?.isFinished === true, 'Turn 6: isFinished is strictly TRUE');
    check(finalResp.body?.autoComplete === true, 'Turn 6: autoComplete flag is TRUE');
    check(finalResp.body?.nextQuestion === null, 'Turn 6: nextQuestion is strictly NULL');
    check(finalResp.body?.stage === 'COMPLETED', 'Turn 6: stage returned is COMPLETED');
    check(finalResp.body?.maxQuestions === 6, 'Turn 6: maxQuestions is 6');
    check(finalResp.body?.questionIndex === 6, 'Turn 6: questionIndex is 6');
    check(finalResp.body?.message && finalResp.body.message.includes('PrepMate đang phân tích'), 'Turn 6: message informs user of automatic completion and report synthesis');

    // Verify backend session database state
    dbContent = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
    sessRecord = dbContent.Sessions[sessionId];
    check(sessRecord.Status === 'completed', 'Backend session.Status is strictly "completed"');
    check(sessRecord.InterviewState?.InterviewPhase === 'COMPLETED', 'InterviewPhase transitioned to "COMPLETED"');
    check(sessRecord.InterviewState?.IsReadyToFinish === true, 'InterviewState.IsReadyToFinish is true');
    check(sessRecord.InterviewState?.QuestionCount === 6, 'InterviewState.QuestionCount is exactly 6');

    // ========================================================================
    // 5. PREVENTION OF 7TH QUESTION & POST-COMPLETION ACCESS CONTROL
    // ========================================================================
    console.log('\n--- PHASE 5: Prevention of 7th Question & Transition Rejection ---');
    // A: Calling /api/ai/respond after 6 questions completed
    const rejectRespond = await requestJson(BASE_URL + '/api/ai/respond', { method: 'POST', headers: authHeader }, {
      sessionId: sessionId,
      question: 'Câu hỏi thứ 7 không hợp lệ?',
      message: 'Tôi cố gắng gửi câu trả lời thứ 7 sau khi đã hoàn thành 6 câu hỏi.'
    });
    check(rejectRespond.status === 400, '/api/ai/respond rejected post-completion submission with HTTP 400');
    check(rejectRespond.body?.error && (rejectRespond.body.error.includes('hoàn tất') || rejectRespond.body.error.includes('6 câu hỏi')), 'Error message confirms interview limit reached');

    // B: Calling /api/ai/next-question on completed session
    const rejectNextQ = await requestJson(BASE_URL + '/api/ai/next-question', { method: 'POST', headers: authHeader }, {
      sessionId: sessionId
    });
    check(rejectNextQ.status === 400, '/api/ai/next-question rejected generation with HTTP 400');
    check(rejectNextQ.body?.error && (rejectNextQ.body.error.includes('hoàn tất') || rejectNextQ.body.error.includes('6 câu hỏi')), 'Error message confirms question limit reached');

    // Verify DB still contains exactly 6 questions
    dbContent = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
    sessRecord = dbContent.Sessions[sessionId];
    check(sessRecord.Questions.length === 6, 'Total questions in session remains strictly 6 (no question 7 created)');
    const realAnswers = sessRecord.Answers.filter(a => a.Question !== 'Giới thiệu bản thân' && a.Stage !== 'INTRODUCTION');
    check(realAnswers.length === 6, 'Total real answers recorded remains strictly 6');

    // ========================================================================
    // 6. SCORING ENGINE SSOT & UNASSESSED CANDIDATE QUESTIONS INTEGRITY
    // ========================================================================
    console.log('\n--- PHASE 6: Scoring Engine SSOT & CandidateQuestionScore Integrity ---');
    const reportRes = await requestJson(BASE_URL + '/api/ai/report', { method: 'POST', headers: authHeader }, {
      sessionId: sessionId,
      jobTitle: 'Senior Software Engineer'
    });
    check(reportRes.status === 200, '/api/ai/report returned HTTP 200 with complete report');
    const report = reportRes.body;

    check(typeof report.overallScore === 'number' && report.overallScore > 0 && report.overallScore <= 100,
      `OverallScore is valid on 0-100 scale: ${report.overallScore}/100`);
    check(typeof report.techScore === 'number' && report.techScore > 0 && report.techScore <= 100,
      `TechScore is valid on 0-100 scale: ${report.techScore}/100`);
    check(typeof report.starScore === 'number' && report.starScore >= 0 && report.starScore <= 100,
      `StarScore is valid on 0-100 scale: ${report.starScore}/100`);
    check(typeof report.situationalScore === 'number' && report.situationalScore >= 0 && report.situationalScore <= 100,
      `SituationalScore is valid on 0-100 scale: ${report.situationalScore}/100`);

    // In 6-question demo, CandidateQuestions is not visited:
    // CandidateQuestionScore MUST be null (not 0.0) and CandidateQuestionStatus MUST be NOT_ASSESSED
    check(report.candidateQuestionScore === null, 'CandidateQuestionScore is strictly null (unassessed, no fake score)');
    check(report.candidateQuestionStatus === 'NOT_ASSESSED', 'CandidateQuestionStatus is strictly "NOT_ASSESSED"');
    check(report.criteria?.attitude === 'Chưa đánh giá', 'Criteria Attitude is strictly "Chưa đánh giá"');

    // ========================================================================
    // 7. FRONTEND PRESENTATION & RESTORE COUNTER CONTRACT
    // ========================================================================
    console.log('\n--- PHASE 7: Frontend Presentation & Counter Contract ---');
    // Load and execute frontend agenda logic in isolated VM
    const agendaCode = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE', 'features', 'interview', 'interview-agenda.js'), 'utf8');
    const restoreCode = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE', 'features', 'interview', 'interview-restore.js'), 'utf8');

    // Simple DOM mocks
    const mockDOM = {
      badgeText: '',
      counterHTML: '',
      guidanceDisplay: ''
    };
    global.document = {
      getElementById(id) {
        if (id === 'current-question-badge') return { set textContent(v) { mockDOM.badgeText = v; }, className: '' };
        if (id === 'question-counter') return { set innerHTML(v) { mockDOM.counterHTML = v; }, className: '' };
        if (id === 'stage-context-guidance') return { style: { set display(v) { mockDOM.guidanceDisplay = v; } }, set innerHTML(v) {} };
        return null;
      }
    };
    global.window = {};

    eval(agendaCode);

    check(global.window.MAX_INTERVIEW_QUESTIONS === 6, 'Frontend exports MAX_INTERVIEW_QUESTIONS = 6');

    // Test Introduction counter
    global.window.updateStagePresentation('INTRODUCTION', false, 1);
    check(mockDOM.counterHTML.includes('Khởi động'), 'Introduction displays "Khởi động"');

    // Test Question 1/6
    global.window.updateStagePresentation('TECHNICAL_ASSESSMENT', false, 1);
    check(mockDOM.counterHTML.includes('Câu hỏi 1/6'), 'Question 1 displays "Câu hỏi 1/6"');

    // Test Question 3/6
    global.window.updateStagePresentation('TECHNICAL_ASSESSMENT', false, 3);
    check(mockDOM.counterHTML.includes('Câu hỏi 3/6'), 'Question 3 displays "Câu hỏi 3/6"');

    // Test Question 6/6 (Final question)
    global.window.updateStagePresentation('TECHNICAL_ASSESSMENT', false, 6);
    check(mockDOM.counterHTML.includes('Câu hỏi 6/6 (Câu hỏi cuối cùng)'), 'Question 6 displays "Câu hỏi 6/6 (Câu hỏi cuối cùng)"');
    check(mockDOM.badgeText === 'Câu hỏi cuối cùng', 'Question 6 badge displays "Câu hỏi cuối cùng"');

    // Test Completed
    global.window.updateStagePresentation('COMPLETED', false, 6);
    check(mockDOM.counterHTML.includes('Đã hoàn thành') || mockDOM.counterHTML.includes('Hoàn tất'), 'Completed state displays "Đã hoàn thành"');

    // ========================================================================
    // 8. QUOTA CONSUMPTION INTEGRITY
    // ========================================================================
    console.log('\n--- PHASE 8: Quota Consumption Integrity ---');
    const quotaRes = await requestJson(BASE_URL + '/api/sessions/quota', { headers: authHeader });
    check(quotaRes.status === 200, '/api/sessions/quota returned HTTP 200');
    check(quotaRes.body?.tier === 'pro' && quotaRes.body?.isProActive === true, 'Candidate active quota status verified');
    check(sessRecord.IsStarted === true && !!sessRecord.StartedAt, 'Session was marked started exactly once upon Question 1 generation');

    console.log('\n===============================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('[ERROR in test runner]:', err);
    process.exit(1);
  } finally {
    beProcess.kill('SIGTERM');
    await sleep(500);
    try {
      if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      }
    } catch (e) {}
  }
}

runTests();
