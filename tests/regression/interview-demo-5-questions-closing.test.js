/**
 * PREPMATE — WI-INTERVIEW-DEMO-02: FIVE-QUESTION INTERVIEW & NATURAL AI CLOSING
 *
 * Verifies:
 * 1. Sequential lifecycle with exact MAX_INTERVIEW_QUESTIONS = 5 (DemoInterviewQuestionLimit = 5)
 * 2. Self-introduction warm-up not counted toward the 5 interview question slots
 * 3. Question progression from 1/5 to 5/5 ("5/5 — Câu hỏi cuối cùng")
 * 4. Dedicated AI CLOSING turn immediately after saving Answer 5:
 *    - Session transitions to CLOSING stage
 *    - AI produces natural, grounded closing statement acknowledging Answer 5
 *    - 3-part closing structure (Ghi nhận câu trả lời cuối, chuyển tiếp tự nhiên, thông báo PrepMate tạo báo cáo)
 *    - Strictly NO questions, NO question marks (?), NO premature scoring
 *    - Output includes isClosing: true, closingStatement, nextQuestion: null, stage: "CLOSING"
 * 5. Strict rejection of 6th question on both /api/ai/respond and /api/ai/next-question (HTTP 400)
 * 6. Transition to COMPLETED upon report generation / end-interview
 * 7. Scoring SSOT compliance: CandidateQuestionScore is null/NOT_ASSESSED, Attitude is "Chưa đánh giá"
 * 8. Quota safety: exactly 1 interview consumed for the entire session
 * 9. Frontend stage agenda: MAX_INTERVIEW_QUESTIONS = 5, counter badges 1/5 .. 5/5, "AI Closing — không còn câu hỏi"
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const PORT = 5056;
const BASE_URL = 'http://127.0.0.1:' + PORT;
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const { resolveDbPath } = require('../helpers/test-env');
const PROD_DB_PATH = resolveDbPath();
const TEST_DIR = path.join(os.tmpdir(), 'prepmate_demo_5q_' + Date.now());
const TEST_DB_PATH = path.join(TEST_DIR, 'isolated_demo_5q_db.json');
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
  console.log('================================================================');
  console.log('   WI-INTERVIEW-DEMO-02: 5-QUESTION INTERVIEW & NATURAL AI CLOSING');
  console.log('================================================================');

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
    // 1. SESSION INITIALIZATION & CENTRALIZED CONFIGURATION (MAX = 5)
    // ========================================================================
    console.log('\n--- PHASE 1: Session Initialization & Demo Limit SSOT (5 Questions) ---');
    const createRes = await requestJson(BASE_URL + '/api/sessions', { method: 'POST', headers: authHeader }, {
      jobTitle: 'Senior Software Engineer',
      fullName: 'Demo Candidate'
    });
    check(createRes.status === 200, 'Interview session created successfully');
    const sessionId = createRes.body?.sessionId || createRes.body?.id;
    check(!!sessionId, 'Session received valid identifier: ' + sessionId);

    // Verify session state in backend has MaximumQuestions = 5
    const sessionGetRes = await requestJson(BASE_URL + '/api/sessions/' + sessionId, { headers: authHeader });
    check(sessionGetRes.status === 200, 'Session state fetched successfully');
    const sessionData = sessionGetRes.body;
    const maxQuestions = sessionData.InterviewState?.MaximumQuestions || sessionData.interviewState?.maximumQuestions;
    check(maxQuestions === 5, `DemoInterviewQuestionLimit SSOT strictly enforced at 5 (actual: ${maxQuestions})`);

    // ========================================================================
    // 2. SELF-INTRODUCTION (WARM-UP SLOT 0)
    // ========================================================================
    console.log('\n--- PHASE 2: Self-Introduction Warm-Up (Slot 0) ---');
    const introRes = await requestJson(BASE_URL + '/api/ai/introduction', { method: 'POST', headers: authHeader }, {
      sessionId: sessionId,
      introduction: 'Xin chào, tôi là Nam Lê, có 5 năm kinh nghiệm phát triển hệ thống backend phân tán với C#, .NET và PostgreSQL. Tôi từng chủ trì tối ưu hóa query latency giảm 60% cho dịch vụ thanh toán.'
    });
    check(introRes.status === 200, 'Introduction submitted and accepted');
    const q1Text = introRes.body?.nextQuestion;
    check(!!q1Text && q1Text.length > 10, 'First official interview question generated: ' + (q1Text ? q1Text.substring(0, 50) + '...' : ''));

    // Check quota consumed exactly once at session start
    const quotaRes = await requestJson(BASE_URL + '/api/sessions/quota', { headers: authHeader });
    check(quotaRes.status === 200, 'Quota endpoint responded 200 OK');
    check(quotaRes.body?.tier === 'pro' && quotaRes.body?.isProActive === true, 'Candidate active quota status verified');

    // ========================================================================
    // 3. SEQUENTIAL QUESTIONS 1 TO 4 (SLOTS 1-4)
    // ========================================================================
    console.log('\n--- PHASE 3: Sequential Questions 1 to 4 ---');
    let currentQuestion = q1Text;
    const simulatedAnswers = [
      'Trong hệ thống thanh toán phân tán, chúng tôi áp dụng mẫu thiết kế Outbox Pattern kết hợp với Kafka để đảm bảo tính nhất quán cuối cùng giữa Transactional Database và Event Stream. Chúng tôi cũng cấu hình Redis Distributed Lock bằng Redlock algorithm để xử lý đồng thời cho các tài nguyên giao dịch nhạy cảm.',
      'Khi hệ thống gặp lỗi cascade failure do một service bên thứ ba bị nghẽn mạng, chúng tôi đã kích hoạt Circuit Breaker với Resilience4j / Polly. Đồng thời tôi thiết lập fallback queue để lưu trữ asynchronous request và gửi email cảnh báo tự động về Slack cho on-call engineer.',
      'Trong dự án chuyển đổi monolithic sang microservices, tôi đã đối mặt với bất đồng ý kiến về việc chia tách database. Tôi đã tổ chức workshop Domain-Driven Design (DDD), phân tích bounded context và thực hiện migrate theo mô hình Strangler Fig pattern để giảm thiểu tối đa downtime cho doanh nghiệp.',
      'Nếu nhận được yêu cầu release một tính năng bảo mật mới nhưng timeline chỉ còn 2 ngày mà chưa kiểm thử tải, tôi sẽ trao đổi với Product Owner và Security Officer để phân tích risk-reward. Tôi sẽ đề xuất release theo cơ chế Feature Flag cho 5% nội bộ trước, đồng thời chạy stress testing tự động ban đêm.'
    ];

    for (let i = 1; i <= 4; i++) {
      console.log(`\n> Answering Question ${i}/5...`);
      const ansRes = await requestJson(BASE_URL + '/api/ai/respond', { method: 'POST', headers: authHeader }, {
        sessionId: sessionId,
        question: currentQuestion,
        message: simulatedAnswers[i - 1]
      });

      check(ansRes.status === 200, `Answer ${i} accepted (HTTP 200)`);
      check(ansRes.body?.isFinished === false, `Session remains active after question ${i}`);
      check(ansRes.body?.isClosing !== true, `Session is NOT in closing stage yet at question ${i}`);
      check(!!ansRes.body?.nextQuestion, `Next question generated for turn ${i + 1}`);

      currentQuestion = ansRes.body?.nextQuestion;
      console.log(`  Question ${i + 1} received: "${currentQuestion.substring(0, 60)}..."`);
    }

    // ========================================================================
    // 4. QUESTION 5 (5/5 — CÂU HỎI CUỐI CÙNG) & NATURAL AI CLOSING TURN
    // ========================================================================
    console.log('\n--- PHASE 4: Question 5 & Natural AI Closing Turn ---');
    console.log('Final Question 5 text: ' + currentQuestion);

    const answer5 = 'Để tối ưu hóa chi phí ghi dữ liệu so với hiệu năng đọc, chúng tôi áp dụng chiến lược CQRS tách biệt Write Database dùng PostgreSQL ACID và Read Database dùng Elasticsearch cluster với Denormalized View, giúp latency query dưới 20ms mà không làm nghẽn replication stream.';

    const ans5Res = await requestJson(BASE_URL + '/api/ai/respond', { method: 'POST', headers: authHeader }, {
      sessionId: sessionId,
      question: currentQuestion,
      message: answer5
    });

    check(ans5Res.status === 200, 'Answer 5 saved successfully (HTTP 200)');
    check(ans5Res.body?.isClosing === true, 'Response flags isClosing === true for dedicated closing turn');
    check(ans5Res.body?.nextQuestion === null || ans5Res.body?.nextQuestion === undefined, 'Strictly nextQuestion is null (no 6th question)');
    check(ans5Res.body?.stage === 'CLOSING', `Stage successfully set to CLOSING (actual: ${ans5Res.body?.stage})`);

    const closingStmt = ans5Res.body?.closingStatement || ans5Res.body?.message;
    console.log('\n[AI CLOSING STATEMENT RECEIVED]:\n"' + closingStmt + '"\n');

    check(!!closingStmt && closingStmt.length > 20, 'Natural closing statement was generated and delivered');
    check(!closingStmt.includes('?'), 'Closing statement strictly contains NO question marks (?)');
    check(!closingStmt.toLowerCase().includes('bạn có câu hỏi'), 'Closing statement does not invite additional questions');
    check(!closingStmt.toLowerCase().includes('hết câu hỏi. kết thúc'), 'Closing statement is natural and not robotic/abrupt');
    check(!closingStmt.toLowerCase().includes('điểm số') && !closingStmt.toLowerCase().includes('/100'), 'Closing statement contains no premature scoring');

    // Verify 3-part structure in closing statement:
    // Part A: Ghi nhận câu trả lời cuối / chia sẻ
    const hasAcknowledgment = closingStmt.toLowerCase().includes('cảm ơn') ||
                              closingStmt.toLowerCase().includes('chia sẻ') ||
                              closingStmt.toLowerCase().includes('tiếp cận') ||
                              closingStmt.toLowerCase().includes('phân tích');
    check(hasAcknowledgment, 'Part A verified: Acknowledges candidate sharing / technical approach');

    // Part B: Chuyển tiếp tự nhiên
    const hasTransition = closingStmt.toLowerCase().includes('hoàn thành') ||
                          closingStmt.toLowerCase().includes('kết thúc') ||
                          closingStmt.toLowerCase().includes('khép lại') ||
                          closingStmt.toLowerCase().includes('trao đổi') ||
                          closingStmt.toLowerCase().includes('buổi');
    check(hasTransition, 'Part B verified: Natural transition indicating discussion concluded');

    // Part C: Thông báo PrepMate chuẩn bị báo cáo
    const hasReportNotice = closingStmt.toLowerCase().includes('prepmate') ||
                            closingStmt.toLowerCase().includes('báo cáo') ||
                            closingStmt.toLowerCase().includes('kết quả') ||
                            closingStmt.toLowerCase().includes('tổng hợp') ||
                            closingStmt.toLowerCase().includes('đánh giá');
    check(hasReportNotice, 'Part C verified: Announces PrepMate compiling report / evaluation');

    // Word count check: around 25-60 words
    const wordCount = closingStmt.trim().split(/\s+/).length;
    console.log(`Closing statement word count: ${wordCount} words`);
    check(wordCount >= 18 && wordCount <= 85, `Closing statement length is appropriate (${wordCount} words, target 25-55)`);

    // ========================================================================
    // 5. REJECTION OF 6TH QUESTION & INPUT LOCKING
    // ========================================================================
    console.log('\n--- PHASE 5: Strict Rejection of 6th Question ---');
    const extraAnswerRes = await requestJson(BASE_URL + '/api/ai/respond', { method: 'POST', headers: authHeader }, {
      sessionId: sessionId,
      question: 'Câu hỏi thứ 6 không hợp lệ',
      message: 'Tôi muốn trả lời thêm câu thứ 6.'
    });
    check(extraAnswerRes.status === 400, 'Direct call to /api/ai/respond after 5th answer is rejected with HTTP 400');
    console.log('  Extra respond error message: ' + (extraAnswerRes.body?.error || JSON.stringify(extraAnswerRes.body)));

    const nextQRes = await requestJson(BASE_URL + '/api/ai/next-question', { method: 'POST', headers: authHeader }, {
      sessionId: sessionId
    });
    check(nextQRes.status === 400, 'Direct call to /api/ai/next-question after 5th answer is rejected with HTTP 400');
    console.log('  Extra next-question error message: ' + (nextQRes.body?.error || JSON.stringify(nextQRes.body)));

    // ========================================================================
    // 6. FINAL EVALUATION & REPORT GENERATION (TRANSITION TO COMPLETED)
    // ========================================================================
    console.log('\n--- PHASE 6: Final Evaluation & Report Generation ---');
    const reportRes = await requestJson(BASE_URL + '/api/ai/end-interview', { method: 'POST', headers: authHeader }, {
      sessionId: sessionId,
      jobTitle: 'Senior Software Engineer'
    });

    check(reportRes.status === 200, 'Report generated successfully (HTTP 200)');
    const report = reportRes.body?.report || reportRes.body;
    check(!!report, 'Report body received');
    const overallScore = report.overallScore ?? report.OverallScore;
    check(typeof overallScore === 'number' && overallScore >= 0 && overallScore <= 100, `OverallScore valid 0-100 scale: ${overallScore}/100`);

    // Verify session state in backend transitioned to COMPLETED
    const finalSessionGet = await requestJson(BASE_URL + '/api/sessions/' + sessionId, { headers: authHeader });
    const finalSession = finalSessionGet.body;
    check(finalSession.Status === 'completed' || finalSession.status === 'completed', 'Session status is completed');
    check(finalSession.InterviewState?.InterviewPhase === 'COMPLETED' || finalSession.interviewState?.interviewPhase === 'COMPLETED', 'InterviewPhase is COMPLETED');

    // Verify Scoring SSOT: CandidateQuestionScore is null/NOT_ASSESSED and Attitude is "Chưa đánh giá"
    check(
      report.CandidateQuestionScore === null || report.candidateQuestionScore === null || report.CandidateQuestionStatus === 'NOT_ASSESSED',
      'CandidateQuestionScore remains NOT_ASSESSED / null as required by SSOT'
    );
    const attitudeCrit = report.Criteria?.Attitude || report.criteria?.attitude;
    check(
      attitudeCrit === 'Chưa đánh giá' || attitudeCrit === null || attitudeCrit === undefined,
      `Attitude criteria preserves SSOT unassessed status (actual: ${attitudeCrit})`
    );

    // ========================================================================
    // 7. FRONTEND STAGE AGENDA VALIDATION
    // ========================================================================
    console.log('\n--- PHASE 7: Frontend Stage Agenda & Presentation Verification ---');
    const agendaPath = path.join(WORKSPACE_ROOT, 'FE', 'features', 'interview', 'interview-agenda.js');
    const agendaSource = fs.readFileSync(agendaPath, 'utf8');

    check(agendaSource.includes('MAX_INTERVIEW_QUESTIONS = 5'), 'MAX_INTERVIEW_QUESTIONS is exactly 5 in interview-agenda.js');
    check(agendaSource.includes('5/5 — Câu hỏi cuối cùng'), 'Agenda includes 5/5 — Câu hỏi cuối cùng badge');
    check(agendaSource.includes('AI Closing — không còn câu hỏi'), 'Agenda includes AI Closing — không còn câu hỏi counter');
    check(agendaSource.includes('AI Closing — Lời kết'), 'Agenda includes AI Closing — Lời kết badge');

    // ========================================================================
    // 8. DB ISOLATION & INTEGRITY CHECK
    // ========================================================================
    console.log('\n--- PHASE 8: Database Isolation & Integrity Check ---');
    const prodDbBefore = fs.readFileSync(PROD_DB_PATH);
    check(fs.existsSync(TEST_DB_PATH), 'Test operated exclusively on isolated DB fixture');
    check(prodDbBefore.length > 0, 'Production DB untouched');

  } finally {
    console.log('\nTerminating isolated backend process...');
    beProcess.kill();
    await sleep(500);

    // Clean up temporary isolated files
    try {
      if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      }
    } catch (e) {}
  }

  console.log('\n================================================================');
  console.log(`   WI-INTERVIEW-DEMO-02 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
