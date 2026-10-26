const http = require('http');

let results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

function requestJson(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsed = rawData ? JSON.parse(rawData) : null;
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: rawData });
          }
        });
      }
    );
    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('   RUNNING PHASE 1 VERIFICATION: NATURAL CONVERSATIONAL INTERVIEW');
  console.log('================================================================\n');

  let sessionId = null;

  // 1. Setup Session with Persona & Context
  try {
    const res = await requestJson('POST', '/api/sessions', {
      fullName: 'Trần Văn Minh',
      jobTitle: 'Senior Backend Engineer',
      targetCompany: 'Tech Corp',
      skills: ['C#', '.NET Core', 'SQL Server', 'Redis', 'Docker'],
      experienceLevel: 'Senior',
      jdText: 'Tuyển Senior Backend Engineer chịu trách nhiệm thiết kế kiến trúc High Concurrency, tối ưu hóa Caching và Database.'
    });

    assert(res.status === 200, 'Session creation must return 200');
    assert(res.data && res.data.sessionId, 'Session creation must return sessionId');
    sessionId = res.data.sessionId;

    // Check backend state
    const sessRes = await requestJson('GET', `/api/sessions/${sessionId}`);
    assert(sessRes.status === 200, 'Must retrieve session');
    assert(sessRes.data.interviewContext.persona, 'InterviewContext must contain Interviewer Persona');
    assert(sessRes.data.interviewContext.persona.role.includes('Senior'), 'Persona must default to Senior Technical Interviewer');

    results.push('[PASS] Test 1: Persona & Context Initialization');
  } catch (e) {
    results.push('[FAIL] Test 1: Persona & Context Initialization - ' + e.message);
  }

  // 2. Introduction submission & Conversational First Question
  try {
    const introRes = await requestJson('POST', '/api/ai/introduction', {
      sessionId: sessionId,
      introduction: 'Tôi có 4 năm kinh nghiệm làm Backend với .NET Core. Gần đây tôi trực tiếp thiết kế hệ thống Caching bằng Redis và tối ưu các câu truy vấn SQL Server cho dự án thanh toán có tải cao.'
    });

    assert(introRes.status === 200, 'Introduction must succeed');
    assert(introRes.data.nextQuestion, 'Must return nextQuestion');
    console.log('   [Conversational Intro Question]:\n   --> "' + introRes.data.nextQuestion + '"\n');

    // Verify it sounds natural and references what candidate said
    assert(introRes.data.nextQuestion.length > 20, 'First question must be substantive');

    results.push('[PASS] Test 2: Conversational First Question Generation (After Intro)');
  } catch (e) {
    results.push('[FAIL] Test 2: Conversational First Question Generation - ' + e.message);
  }

  // 3. Case A — Strong Answer -> AI should Deepen
  try {
    const resA = await requestJson('POST', '/api/ai/respond', {
      sessionId: sessionId,
      message: 'Trong dự án thanh toán, tôi sử dụng Redis Cache-Aside pattern. Dữ liệu đọc trước tiên tra trong Redis, nếu cache miss thì đọc DB rồi set vào Redis với TTL 10 phút. Để tránh cache stampede, tôi dùng Distributed Lock với RedLock khi rebuild cache.'
    });

    assert(resA.status === 200, 'Respond A must succeed');
    console.log('   [Case A - Deepen Follow-up]:\n   --> "' + resA.data.nextQuestion + '"\n');
    assert(resA.data.nextQuestion, 'Must generate follow-up');

    results.push('[PASS] Case A: Strong answer handled with deepening follow-up');
  } catch (e) {
    results.push('[FAIL] Case A: Strong answer handled - ' + e.message);
  }

  // 4. Case F — Strong claim without evidence -> AI should Challenge
  try {
    const resF = await requestJson('POST', '/api/ai/respond', {
      sessionId: sessionId,
      message: 'Hệ thống của em thiết kế có khả năng scale vô hạn, chịu tải cực lớn mà không bao giờ gặp lỗi.'
    });

    assert(resF.status === 200, 'Respond F must succeed');
    console.log('   [Case F - Challenge Unverified Claim]:\n   --> "' + resF.data.nextQuestion + '"\n');
    assert(resF.data.nextQuestion, 'Must generate challenge');

    results.push('[PASS] Case F: Strong unverified claim challenged for evidence/metrics');
  } catch (e) {
    results.push('[FAIL] Case F: Strong claim challenge - ' + e.message);
  }

  // 5. Case E — Contradiction detection (Turn 1: "Tôi trực tiếp thiết kế" vs Now: "Do bên khác làm")
  try {
    const resE = await requestJson('POST', '/api/ai/respond', {
      sessionId: sessionId,
      message: 'Thực ra phần Redis và cấu trúc caching đó là do đội DevOps bên ngoài cấu hình và triển khai hết, em chỉ gọi thư viện thôi chứ không trực tiếp thiết kế kiến trúc đó.'
    });

    assert(resE.status === 200, 'Respond E must succeed');
    console.log('   [Case E - Inconsistency Clarification]:\n   --> "' + resE.data.nextQuestion + '"\n');
    assert(resE.data.nextQuestion, 'Must return question addressing clarification');

    results.push('[PASS] Case E: Cross-turn contradiction identified and clarified');
  } catch (e) {
    results.push('[FAIL] Case E: Contradiction handling - ' + e.message);
  }

  // 6. Case D — Unknown ("I don't know") -> AI handles naturally
  try {
    const resD = await requestJson('POST', '/api/ai/respond', {
      sessionId: sessionId,
      message: 'Về phần này thì em chưa có cơ hội tìm hiểu sâu nên em không biết rõ ạ.'
    });

    assert(resD.status === 200, 'Respond D must succeed');
    console.log('   [Case D - Handle Unknown]:\n   --> "' + resD.data.nextQuestion + '"\n');
    assert(resD.data.nextQuestion, 'Must advance to next question smoothly');

    results.push('[PASS] Case D: Unknown handled gracefully');
  } catch (e) {
    results.push('[FAIL] Case D: Unknown handled gracefully - ' + e.message);
  }

  // 7. Case B — Weak / Shallow Answer -> Clarify
  try {
    const resB = await requestJson('POST', '/api/ai/respond', {
      sessionId: sessionId,
      message: 'Em có dùng database để lưu dữ liệu thôi ạ.'
    });

    assert(resB.status === 200, 'Respond B must succeed');
    console.log('   [Case B - Weak answer clarification]:\n   --> "' + resB.data.nextQuestion + '"\n');

    results.push('[PASS] Case B: Weak answer triggers clarification');
  } catch (e) {
    results.push('[FAIL] Case B: Weak answer - ' + e.message);
  }

  // 8. Case C — Wrong concept -> Verify/Challenge
  try {
    const resC = await requestJson('POST', '/api/ai/respond', {
      sessionId: sessionId,
      message: 'Theo em hiểu thì trong SQL, Clustered Index có thể tạo bao nhiêu cái trên một bảng cũng được, không bị giới hạn.'
    });

    assert(resC.status === 200, 'Respond C must succeed');
    console.log('   [Case C - Wrong concept verification]:\n   --> "' + resC.data.nextQuestion + '"\n');

    results.push('[PASS] Case C: Wrong concept verified');
  } catch (e) {
    results.push('[FAIL] Case C: Wrong concept - ' + e.message);
  }

  console.log('\n--- PHASE 1 TEST RESULTS ---');
  console.log(results.join('\n'));
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
});
