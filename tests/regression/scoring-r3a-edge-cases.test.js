/**
 * PREPMATE — WI-SCORE-01R3A: ZERO-SCORE VS NOT-ASSESSED FINAL EDGE CASES
 *
 * Verifies:
 * 1. Case A: Technical assessed, score = 0 (OverallScore = 0*60% + 90*20% + 90*20% = 36/100)
 * 2. Case B: Technical not assessed (TechScore is null, OverallScore = 90/100 normalized, coverage 0%, confidence LOW)
 * 3. Case C: Technical evaluation failed (TechScore is null, not 0; failure is not treated as poor performance, OverallScore = 90, failure recorded)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const PORT = 5054;
const BASE_URL = 'http://127.0.0.1:' + PORT;
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const { resolveDbPath } = require('../helpers/test-env');
const PROD_DB_PATH = resolveDbPath();
const TEST_DIR = path.join(os.tmpdir(), 'prepmate_scoring_r3a_' + Date.now());
const TEST_DB_PATH = path.join(TEST_DIR, 'isolated_scoring_r3a_db.json');
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
  console.log('   WI-SCORE-01R3A: ZERO-SCORE VS NOT-ASSESSED EDGE CASES       ');
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
    check(ready, 'Isolated Backend server booted and ready');

    // Authenticate candidate using fixture user
    const loginRes = await requestJson(BASE_URL + '/api/auth/login', { method: 'POST' }, {
      email: 'nam.le@gmail.com',
      password: 'user123'
    });
    const token = loginRes.body?.token || loginRes.body?.Token;
    check(loginRes.status === 200 && !!token, 'Test candidate authenticated');
    const authHeader = { 'Authorization': 'Bearer ' + token };

    // ========================================================================
    // CASE A: TECHNICAL ASSESSED, SCORE = 0
    // ========================================================================
    console.log('\n--- CASE A: Technical Assessed, Score = 0 ---');
    const sessA = await requestJson(BASE_URL + '/api/sessions', { method: 'POST', headers: authHeader }, {
      jobTitle: 'Senior Backend Engineer',
      fullName: 'Zero Technical Candidate'
    });
    const sessAId = sessA.body?.sessionId || sessA.body?.id;

    // Turn 1: Technical question answered with explicit refusal / complete failure (score = 0)
    // Turn 2: Behavioral STAR question answered strongly (score = 90)
    // Turn 3: Situational Dilemma question answered strongly (score = 90)
    const repA = await requestJson(BASE_URL + '/api/ai/report', { method: 'POST', headers: authHeader }, {
      sessionId: sessAId,
      jobTitle: 'Senior Backend Engineer',
      responses: [
        {
          stage: 'TECHNICAL_ASSESSMENT',
          question: 'Làm thế nào để scale database PostgreSQL lên hàng triệu write/giây?',
          answer: 'Em từ chối trả lời câu hỏi này và hoàn toàn không có kiến thức kỹ thuật về chủ đề này.',
          score: 0.0
        },
        {
          stage: 'Behavioral',
          question: 'Kể về một lần bạn xử lý xung đột trong nhóm.',
          answer: 'Khi có bất đồng về kiến trúc giữa hai tech lead, em đã tổ chức buổi workshop đối chiếu benchmark thực tế, giúp nhóm thống nhất phương án tối ưu trong 2 ngày.',
          behavioralEvidence: {
            competency: 'Teamwork',
            situation: 'Bất đồng thiết kế kiến trúc hệ thống',
            task: 'Thống nhất giải pháp kỹ thuật trước deadline',
            action: 'Tổ chức workshop benchmark đo lường throughput thực tế',
            result: 'Nhóm đạt đồng thuận 100% và hoàn thành milestone đúng hạn',
            evidenceStrength: 'Strong',
            ownership: 'High'
          }
        },
        {
          stage: 'Situational',
          question: 'Nếu deadline cận kề nhưng tính năng chưa test xong, bạn xử lý thế nào?',
          answer: 'Em sẽ phân loại rủi ro, release phần cốt lõi an toàn và hoãn phần chưa test kèm rollback plan.',
          situationalEvidence: {
            decisionMaking: 'Release theo phase với rollback plan bảo vệ dữ liệu',
            riskAwareness: 'Nhận thức sâu sắc về rủi ro downtime và tổn thất dữ liệu khách hàng',
            tradeoffAwareness: 'Đánh đổi hoãn tính năng phụ để giữ vững uy tín chất lượng sản phẩm',
            evidenceStrength: 'Strong',
            ownership: 'High'
          }
        }
      ]
    });

    console.log('  Case A Results:');
    console.log('    - TechnicalScore: ' + repA.body?.techScore);
    console.log('    - StarScore     : ' + repA.body?.starScore);
    console.log('    - Situational   : ' + repA.body?.situationalScore);
    console.log('    - OverallScore  : ' + repA.body?.overallScore);
    console.log('    - TechStatus    : ' + repA.body?.technicalStatus);

    check(repA.status === 200, 'Case A: Report generated successfully (HTTP 200)');
    check(repA.body?.techScore === 0, 'Case A: TechnicalScore is preserved as exactly 0 (actual: ' + repA.body?.techScore + ')');
    check(repA.body?.starScore === 90, 'Case A: STAR Score is populated from evidence (90)');
    check(repA.body?.situationalScore === 90, 'Case A: Situational Score is populated from evidence (90)');
    check(repA.body?.overallScore === 36, 'Case A: OverallScore is exactly 36 (0*60% + 90*20% + 90*20% = 36, actual: ' + repA.body?.overallScore + ')');
    check(repA.body?.technicalStatus === 'ASSESSED', 'Case A: Technical is explicitly marked as ASSESSED');
    check(repA.body?.criteria?.technicalKnowledge === 'Chưa tốt', 'Case A: TechnicalKnowledge criteria reflects poor candidate performance ("Chưa tốt")');

    // ========================================================================
    // CASE B: TECHNICAL NOT ASSESSED
    // ========================================================================
    console.log('\n--- CASE B: Technical Not Assessed ---');
    const sessB = await requestJson(BASE_URL + '/api/sessions', { method: 'POST', headers: authHeader }, {
      jobTitle: 'Product Manager',
      fullName: 'Non-Technical Candidate'
    });
    const sessBId = sessB.body?.sessionId || sessB.body?.id;

    // Session has ONLY Behavioral (STAR = 90) and Situational (Dilemma = 90), NO technical questions
    const repB = await requestJson(BASE_URL + '/api/ai/report', { method: 'POST', headers: authHeader }, {
      sessionId: sessBId,
      jobTitle: 'Product Manager',
      responses: [
        {
          stage: 'Behavioral',
          question: 'Kể về một lần bạn dẫn dắt dự án thành công.',
          answer: 'Em đã chủ trì tái cấu trúc backlog và thiết lập quy trình sprint 2 tuần, giúp velocity tăng 35%.',
          behavioralEvidence: {
            competency: 'Leadership',
            situation: 'Quy trình phát triển chậm trễ',
            task: 'Tối ưu velocity và năng suất đội ngũ',
            action: 'Tổ chức sprint grooming và chuẩn hóa Definition of Done',
            result: 'Velocity tăng 35% và release đúng hạn 4 sprint liên tiếp',
            evidenceStrength: 'Strong',
            ownership: 'High'
          }
        },
        {
          stage: 'Situational',
          question: 'Nếu stakeholder yêu cầu thay đổi scope giữa sprint, bạn làm gì?',
          answer: 'Em sẽ đánh giá business impact, trao đổi trade-off và hoãn các task ít quan trọng sang sprint sau.',
          situationalEvidence: {
            decisionMaking: 'Đàm phán hoãn task ưu tiên thấp thay vì ép overtime',
            riskAwareness: 'Nguy cơ kiệt sức đội ngũ và lỗi sản phẩm khi thay đổi đột ngột',
            tradeoffAwareness: 'Cân bằng giữa kỳ vọng stakeholder và tính khả thi kỹ thuật',
            evidenceStrength: 'Strong',
            ownership: 'High'
          }
        }
      ]
    });

    console.log('  Case B Results:');
    console.log('    - TechnicalScore: ' + repB.body?.techScore);
    console.log('    - StarScore     : ' + repB.body?.starScore);
    console.log('    - Situational   : ' + repB.body?.situationalScore);
    console.log('    - OverallScore  : ' + repB.body?.overallScore);
    console.log('    - TechStatus    : ' + repB.body?.technicalStatus);
    console.log('    - Confidence    : ' + repB.body?.evaluationConfidence);

    check(repB.status === 200, 'Case B: Report generated successfully (HTTP 200)');
    check(repB.body?.techScore === null || repB.body?.techScore === undefined, 'Case B: TechnicalScore is NOT fabricated as 0 (techScore is null/undefined)');
    check(repB.body?.technicalStatus === 'NOT_ASSESSED', 'Case B: TechnicalStatus is explicitly NOT_ASSESSED');
    check(repB.body?.starScore === 90, 'Case B: STAR Score is evaluated (90)');
    check(repB.body?.situationalScore === 90, 'Case B: Situational Score is evaluated (90)');
    check(repB.body?.overallScore === 90, 'Case B: OverallScore normalizes assessed dimensions to 90 (actual: ' + repB.body?.overallScore + ')');
    check(repB.body?.evaluationConfidence === 'LOW', 'Case B: Confidence is reduced to LOW because mandatory technical scope is unassessed');
    check(repB.body?.criteria?.technicalKnowledge === 'Chưa đánh giá', 'Case B: Criteria reflects "Chưa đánh giá" rather than candidate deficiency');

    // ========================================================================
    // CASE C: TECHNICAL EVALUATION FAILED
    // ========================================================================
    console.log('\n--- CASE C: Technical Evaluation Failed ---');
    const sessC = await requestJson(BASE_URL + '/api/sessions', { method: 'POST', headers: authHeader }, {
      jobTitle: 'Senior Software Engineer',
      fullName: 'Evaluation Failure Candidate'
    });
    const sessCId = sessC.body?.sessionId || sessC.body?.id;

    // Technical question where evaluation process failed or returned invalid data
    const repC = await requestJson(BASE_URL + '/api/ai/report', { method: 'POST', headers: authHeader }, {
      sessionId: sessCId,
      jobTitle: 'Senior Software Engineer',
      responses: [
        {
          stage: 'TECHNICAL_ASSESSMENT',
          question: 'Làm thế nào để thiết kế cache architecture?',
          answer: 'Dữ liệu câu trả lời bị lỗi phân tích từ gateway parser.',
          evaluationFailed: true,
          evaluationFailureReason: 'AI Gateway JSON schema parser error: corrupted token stream'
        },
        {
          stage: 'Behavioral',
          question: 'Kể về một tình huống bạn giải quyết mâu thuẫn.',
          answer: 'Em đã hòa giải và đưa ra giải pháp kỹ thuật dựa trên dữ liệu thực nghiệm.',
          behavioralEvidence: {
            competency: 'Conflict Resolution',
            situation: 'Bất đồng giải pháp',
            task: 'Đạt đồng thuận kỹ thuật',
            action: 'Thực nghiệm A/B đo lường thực tế',
            result: 'Nhóm đồng thuận và hoàn thành đúng hạn',
            evidenceStrength: 'Strong',
            ownership: 'High'
          }
        },
        {
          stage: 'Situational',
          question: 'Cách xử lý khi phát hiện bảo mật bị xâm phạm?',
          answer: 'Em lập tức cô lập hệ thống, thu hồi token và báo cáo sự cố theo quy trình.',
          situationalEvidence: {
            decisionMaking: 'Cô lập ngay lập tức vùng bị ảnh hưởng và thu hồi toàn bộ phiên đăng nhập',
            riskAwareness: 'Nguy cơ rò rỉ dữ liệu người dùng nghiêm trọng',
            tradeoffAwareness: 'Chấp nhận downtime cục bộ để bảo vệ toàn vẹn dữ liệu khách hàng',
            evidenceStrength: 'Strong',
            ownership: 'High'
          }
        }
      ]
    });

    console.log('  Case C Results:');
    console.log('    - TechnicalScore: ' + repC.body?.techScore);
    console.log('    - StarScore     : ' + repC.body?.starScore);
    console.log('    - Situational   : ' + repC.body?.situationalScore);
    console.log('    - OverallScore  : ' + repC.body?.overallScore);
    console.log('    - TechStatus    : ' + repC.body?.technicalStatus);
    console.log('    - Confidence    : ' + repC.body?.evaluationConfidence);

    check(repC.status === 200, 'Case C: Report generated successfully (HTTP 200)');
    check(repC.body?.techScore === null || repC.body?.techScore === undefined, 'Case C: TechnicalScore is NOT fabricated as 0 (techScore is null/undefined)');
    check(repC.body?.technicalStatus === 'EVALUATION_FAILED', 'Case C: TechnicalStatus is explicitly EVALUATION_FAILED');
    check(repC.body?.overallScore === 90, 'Case C: Candidate is NOT penalized for evaluation failure (OverallScore = 90, actual: ' + repC.body?.overallScore + ')');
    check(repC.body?.evaluationConfidence === 'LOW', 'Case C: Confidence is marked LOW due to evaluation error');
    check(repC.body?.criteria?.technicalKnowledge.includes('Chưa thể đánh giá'), 'Case C: Criteria reflects "Chưa thể đánh giá (dữ liệu không hợp lệ)"');

  } finally {
    beProcess.kill('SIGKILL');
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }

  console.log('\n===============================================================');
  console.log(`   R3A EDGE CASES SUMMARY: ${passed} PASS, ${failed} FAIL   `);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('[FATAL TEST ERROR]', err);
  process.exit(1);
});
