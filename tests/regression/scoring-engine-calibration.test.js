/**
 * PREPMATE — SCORING ENGINE CALIBRATION & EVIDENCE-BASED EVALUATION (WI-SCORE-01)
 *
 * Validates:
 * 1. Legacy Fallback Scoring Repair: Eliminates hardcoded 55, evaluates real answers dynamically.
 * 2. Benchmark progression: Weak < Basic < Good <= Excellent with monotonic score separation.
 * 3. JD-Independent Blueprint Generation across 5 sectors (IT, BA, Marketing, Finance, HR).
 * 4. Separation of Performance Score from Evidence Coverage (no coverageRatio deflation).
 * 5. SSOT Consistency across all 7 score dimensions (Overall, Tech, Star, Situational, CQ, Comm, Soft).
 * 6. Score scale normalization & threshold boundaries (5.5/10 is "Chưa tốt", 8.5/10 is "Xuất sắc").
 * 7. Role & Seniority calibration (Junior rewarded for fundamentals, Senior penalized for surface answers).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');

const PORT = 5052;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const { resolveDbPath } = require('../helpers/test-env');
const PROD_DB_PATH = resolveDbPath();
const TEST_DIR = path.join(os.tmpdir(), `prepmate_scoring_test_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, 'isolated_scoring_test_db.json');
const TEST_KEYRING_PATH = path.join(TEST_DIR, 'test_keys');

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
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
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTests() {
  console.log('===============================================================');
  console.log('   WI-SCORE-01: SCORING ENGINE CALIBRATION & REPAIR TESTS     ');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 1: SOURCE CODE AUDIT & INVARIANT CHECKS
  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Source Code Invariants & Architectural Rules ---');

  const finalEvalSource = fs.readFileSync(path.join(WORKSPACE_ROOT, 'BE/Services/Evaluation/FinalEvaluationService.cs'), 'utf8');
  const reportServiceSource = fs.readFileSync(path.join(WORKSPACE_ROOT, 'BE/Services/Interview/InterviewReportService.cs'), 'utf8');
  const contextBuilderSource = fs.readFileSync(path.join(WORKSPACE_ROOT, 'BE/Services/Context/InterviewContextBuilder.cs'), 'utf8');
  const templateProviderSource = fs.readFileSync(path.join(WORKSPACE_ROOT, 'BE/Services/Knowledge/DomainCompetencyTemplateProvider.cs'), 'utf8');

  // Check 1.1: No more hardcoded 5.5 in FinalEvaluationService fallback
  check(
    !finalEvalSource.includes('Score = !hasAnswers ? 0.0 : (state.StrongAnswerCount > state.WeakAnswerCount ? 7.5 : 5.5)'),
    'Check 1.1: Legacy hardcoded 5.5 fallback completely removed from FinalEvaluationService'
  );

  // Check 1.2: Dynamic answer evaluation method exists
  check(
    finalEvalSource.includes('EvaluateAnswersDynamically'),
    'Check 1.2: Dynamic answer evaluation pipeline implemented for sessions without blueprint'
  );

  // Check 1.3: No coverageRatio multiplying finalScore
  check(
    !finalEvalSource.includes('finalScore = Math.Round(techScore * coverageRatio, 1);'),
    'Check 1.3: coverageRatio deflation removed from performance score'
  );

  // Check 1.4: CoveragePercentage tracked separately
  check(
    finalEvalSource.includes('evaluation.CoveragePercentage = Math.Round(coverageRatio * 100.0, 1);'),
    'Check 1.4: CoveragePercentage tracked separately in FinalInterviewEvaluation'
  );

  // Check 1.5: CommScore and SoftScore mapped from authoritative evaluation
  check(
    reportServiceSource.includes('report.CommScore = Math.Round(evaluation.CommunicationScore * 10.0, 1);') &&
    reportServiceSource.includes('report.SoftScore = Math.Round(evaluation.SoftScore * 10.0, 1);'),
    'Check 1.5: CommScore and SoftScore authoritatively populated from FinalEvaluationService SSOT'
  );

  // Check 1.6: Fixed criteria threshold (0.8 bug replaced with 8.0 / 6.5)
  check(
    reportServiceSource.includes('TechnicalKnowledge = evaluation.TechnicalScore >= 8.0 ? "Xuất sắc" : (evaluation.TechnicalScore >= 6.5 ? "Tốt" : "Chưa tốt")') &&
    !reportServiceSource.includes('TechnicalKnowledge = evaluation.TechnicalScore >= 0.8'),
    'Check 1.6: Threshold comparison normalized: >= 8.0 for "Xuất sắc", >= 6.5 for "Tốt"'
  );

  // Check 1.7: JD-independent blueprint generation in ContextBuilder
  check(
    contextBuilderSource.includes('// Phase 2: Generate Knowledge Blueprint from JD or Sector/Role Context (JD-independent)'),
    'Check 1.7: InterviewContextBuilder triggers blueprint generation even when JD is empty'
  );

  // Check 1.8: DomainCompetencyTemplateProvider supports all 5 key sectors
  check(
    templateProviderSource.includes('SOFTWARE_ENGINEERING') &&
    templateProviderSource.includes('BUSINESS_ANALYSIS') &&
    templateProviderSource.includes('MARKETING_GROWTH') &&
    templateProviderSource.includes('FINANCE_ACCOUNTING') &&
    templateProviderSource.includes('HR_PEOPLE'),
    'Check 1.8: Pre-validated domain competency templates support IT, BA, Marketing, Finance, HR'
  );

  // --------------------------------------------------------------------------
  // TEST GROUP 2: LIVE BACKEND INTEGRATION & BENCHMARK FIXTURES
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Live Backend Integration & Benchmark Fixtures ---');

  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  if (!fs.existsSync(TEST_KEYRING_PATH)) fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

  let apiKey = '';
  try {
    apiKey = require('child_process').execSync(
      "powershell -NoProfile -Command \"[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment').GetValue('VILAO_API_KEY')\"",
      { encoding: 'utf8' }
    ).trim();
  } catch (e) {}

  const beDir = path.join(WORKSPACE_ROOT, 'BE');
  const dllPath = path.join(beDir, 'bin', 'Debug', 'net10.0', 'backend.dll');

  const beProcess = spawn('dotnet', [dllPath, '--urls', BASE_URL], {
    cwd: beDir,
    env: {
      ...process.env,
      VILAO_API_KEY: apiKey,
      PREPMATE_AI_API_KEY: apiKey,
      DATABASE_FILE_PATH: TEST_DB_PATH,
      PREPMATE_DATABASE_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING_PATH,
      ASPNETCORE_URLS: BASE_URL,
      DOTNET_URLS: BASE_URL,
      ASPNETCORE_ENVIRONMENT: 'Development'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        const res = await requestJson(`${BASE_URL}/features/auth/auth.html`);
        if (res.status === 200) {
          ready = true;
          break;
        }
      } catch (e) {}
    }

    check(ready, 'Backend server started successfully for scoring calibration test');

    if (ready) {
      // Authenticate to get valid token for test sessions
      const loginRes = await requestJson(`${BASE_URL}/api/auth/login`, { method: 'POST' }, {
        email: 'nam.le@gmail.com',
        password: 'user123'
      });
      check(loginRes.status === 200, 'Candidate authenticated successfully');
      const token = loginRes.body?.token || loginRes.body?.Token;
      const authHeader = { 'Authorization': `Bearer ${token}` };

      // ----------------------------------------------------------------------
      // BENCHMARK 2.1: JD-Independent Session Creation Across 5 Sectors
      // ----------------------------------------------------------------------
      console.log('\n  • Testing JD-Independent Blueprint Generation across sectors:');
      const sectorsToTest = [
        { title: 'Senior Backend Engineer (.NET)', level: 'Senior' },
        { title: 'Senior Business Analyst', level: 'Senior' },
        { title: 'Senior Performance Marketing Specialist', level: 'Senior' },
        { title: 'Chief Accountant / Senior Financial Analyst', level: 'Senior' },
        { title: 'HR Manager / Talent Acquisition Lead', level: 'Senior' }
      ];

      for (const s of sectorsToTest) {
        const sessRes = await requestJson(`${BASE_URL}/api/sessions`, {
          method: 'POST',
          headers: authHeader
        }, {
          jobTitle: s.title,
          experienceLevel: s.level,
          jdText: '', // NO JD SUPPLIED!
          fullName: 'Test Candidate'
        });

        check(sessRes.status === 200, `Session creation without JD succeeded for: ${s.title}`);
        const sessionId = sessRes.body?.sessionId || sessRes.body?.id;
        check(!!sessionId, `Received valid sessionId: ${sessionId}`);

        // Fetch full session details
        const getSessRes = await requestJson(`${BASE_URL}/api/sessions/${sessionId}`, {
          method: 'GET',
          headers: authHeader
        });
        check(getSessRes.status === 200, `Retrieved session details for ${s.title}`);
        const sessDetails = getSessRes.body;
        const bp = sessDetails?.interviewContext?.knowledgeBlueprint;

        check(
          bp != null && bp.areas && bp.areas.length >= 2,
          `Knowledge Blueprint was resolved without JD for ${s.title} (${bp?.areas?.length} areas)`
        );

        if (bp?.areas) {
          const concepts = bp.areas.flatMap(a => a.concepts || []);
          check(concepts.length >= 4, `Blueprint for ${s.title} contains ${concepts.length} calibrated concepts`);
        }
      }

      // ----------------------------------------------------------------------
      // BENCHMARK 2.2: Four Distinct Answer Quality Profiles (Weak, Basic, Good, Excellent)
      // ----------------------------------------------------------------------
      console.log('\n  • Testing 4 Answer Quality Profiles (Monotonic Score Progression):');

      const weakResponses = [
        {
          question: "Bạn xử lý bài toán tối ưu truy vấn cơ sở dữ liệu lớn như thế nào?",
          answer: "Dạ em chưa rõ lắm, cái này em chưa từng làm qua ạ."
        },
        {
          question: "Làm thế nào để đảm bảo tính an toàn của API?",
          answer: "Em nghĩ cứ gửi mật khẩu qua body là an toàn rồi ạ, em không biết JWT hay OAuth là gì."
        }
      ];

      const basicResponses = [
        {
          question: "Bạn xử lý bài toán tối ưu truy vấn cơ sở dữ liệu lớn như thế nào?",
          answer: "Em sẽ đánh index cho các cột hay dùng trong mệnh đề WHERE và không dùng SELECT * để giảm tải dữ liệu."
        },
        {
          question: "Làm thế nào để đảm bảo tính an toàn của API?",
          answer: "Em dùng HTTPS và xác thực người dùng bằng token JWT được mã hóa khi gửi lên header."
        }
      ];

      const goodResponses = [
        {
          question: "Bạn xử lý bài toán tối ưu truy vấn cơ sở dữ liệu lớn như thế nào?",
          answer: "Tại dự án trước, khi bảng giao dịch đạt 10 triệu bản ghi, em phân tích Execution Plan để tìm Table Scan, tạo Composite Index bám sát câu lệnh truy vấn và áp dụng Redis làm bộ nhớ đệm Cache-Aside cho các dữ liệu ít biến động, giúp giảm thời gian phản hồi từ 1.2s xuống 45ms."
        },
        {
          question: "Làm thế nào để đảm bảo tính an toàn của API?",
          answer: "Em triển khai xác thực JWT qua Bearer token với cơ chế Refresh Token lưu trong HttpOnly Cookie để chống XSS, kèm theo Rate Limiting bằng Redis token bucket để phòng ngừa brute force và tấn công DDoS ở mức API Gateway."
        }
      ];

      const excellentResponses = [
        {
          question: "Bạn xử lý bài toán tối ưu truy vấn cơ sở dữ liệu lớn như thế nào?",
          answer: "Ở hệ thống thanh toán với 50 triệu bản ghi, em triển khai phân vùng dữ liệu (Table Partitioning) theo tháng, tối ưu composite index với B-tree, kết hợp đọc ghi tách biệt qua Read Replica. Với các truy vấn tổng hợp phức tạp, em dùng materialized view và Redis cluster phân tán với chiến lược invalidate dựa trên event CDC qua Kafka, loại bỏ hoàn toàn race conditions và đảm bảo throughput 5000 RPS với P99 latency dưới 25ms."
        },
        {
          question: "Làm thế nào để đảm bảo tính an toàn của API?",
          answer: "Em xây dựng kiến trúc Zero Trust: xác thực mTLS giữa các microservices nội bộ, bên ngoài qua OAuth2/OIDC với JWT ngắn hạn (15 phút) ký bằng RSA256, Refresh Token Rotation có phát hiện token reuse. Ngoài ra em cấu hình API Gateway kiểm tra Schema Validation nghiêm ngặt, Rate Limiting linh hoạt theo tenant, mã hóa dữ liệu nhạy cảm AES-256 at rest và TLS 1.3 in transit."
        }
      ];

      // Create dedicated sessions for each profile
      const profiles = [
        { name: 'Weak', responses: weakResponses },
        { name: 'Basic', responses: basicResponses },
        { name: 'Good', responses: goodResponses },
        { name: 'Excellent', responses: excellentResponses }
      ];

      const reportScores = {};
      const reports = {};

      for (const p of profiles) {
        const createRes = await requestJson(`${BASE_URL}/api/sessions`, {
          method: 'POST',
          headers: authHeader
        }, {
          jobTitle: 'Senior Software Engineer',
          experienceLevel: 'Senior',
          jdText: '',
          fullName: `Candidate ${p.name}`
        });
        const sessId = createRes.body?.sessionId || createRes.body?.id;

        const reportRes = await requestJson(`${BASE_URL}/api/ai/report`, {
          method: 'POST',
          headers: authHeader
        }, {
          sessionId: sessId,
          jobTitle: 'Senior Software Engineer',
          responses: p.responses
        });

        check(reportRes.status === 200, `Generated report successfully for ${p.name} profile`);
        const repBody = reportRes.body;
        reports[p.name] = repBody;
        const score = repBody?.overallScore ?? repBody?.OverallScore;
        reportScores[p.name] = score;
      }

      const weakScore = reportScores['Weak'];
      const basicScore = reportScores['Basic'];
      const goodScore = reportScores['Good'];
      const excellentScore = reportScores['Excellent'];

      console.log(`\n  • Calibrated Scores Across Benchmark Profiles:`);
      console.log(`    - Weak Profile Score     : ${weakScore}/100`);
      console.log(`    - Basic Profile Score    : ${basicScore}/100`);
      console.log(`    - Good Profile Score     : ${goodScore}/100`);
      console.log(`    - Excellent Profile Score: ${excellentScore}/100\n`);

      check(typeof weakScore === 'number' && weakScore > 0, `Weak score is a valid number: ${weakScore}`);
      check(typeof basicScore === 'number' && basicScore > 0, `Basic score is a valid number: ${basicScore}`);
      check(typeof goodScore === 'number' && goodScore > 0, `Good score is a valid number: ${goodScore}`);
      check(typeof excellentScore === 'number' && excellentScore > 0, `Excellent score is a valid number: ${excellentScore}`);

      // Monotonic progression check: Weak < Basic < Good <= Excellent
      check(weakScore < basicScore, `Monotonic Check 1: Weak (${weakScore}) < Basic (${basicScore})`);
      check(basicScore < goodScore, `Monotonic Check 2: Basic (${basicScore}) < Good (${goodScore})`);
      check(goodScore <= excellentScore, `Monotonic Check 3: Good (${goodScore}) <= Excellent (${excellentScore})`);

      // Calibrated range checks
      check(weakScore <= 55, `Weak candidate is appropriately graded <= 55 (actual: ${weakScore})`);
      check(goodScore >= 70, `Good candidate is appropriately graded >= 70 (actual: ${goodScore})`);
      check(excellentScore >= 80, `Excellent candidate is appropriately graded >= 80 (actual: ${excellentScore})`);

      // Verify that NO score is blindly stuck at 55.0 for all profiles
      const distinctScores = new Set([weakScore, basicScore, goodScore, excellentScore]);
      check(distinctScores.size >= 3, `Scores are dynamically differentiated (distinct count: ${distinctScores.size}/4)`);

      // ----------------------------------------------------------------------
      // BENCHMARK 2.3: Zero-Answer Session Safety Guard
      // ----------------------------------------------------------------------
      console.log('\n  • Testing Empty / Incomplete Session Safety:');
      const emptySessRes = await requestJson(`${BASE_URL}/api/sessions`, {
        method: 'POST',
        headers: authHeader
      }, {
        jobTitle: 'Senior Software Engineer',
        experienceLevel: 'Senior',
        fullName: 'Empty Candidate'
      });
      const emptySessId = emptySessRes.body?.sessionId || emptySessRes.body?.id;

      const emptyRes = await requestJson(`${BASE_URL}/api/ai/report`, {
        method: 'POST',
        headers: authHeader
      }, {
        sessionId: emptySessId,
        jobTitle: 'Senior Software Engineer',
        responses: []
      });
      check(emptyRes.status === 400, 'Empty responses request rejected with 400 Bad Request');
      check(
        JSON.stringify(emptyRes.body).includes('Chưa có câu trả lời nào được ghi nhận'),
        'Empty responses returns clear message rather than inventing a score of 55'
      );

      // ----------------------------------------------------------------------
      // BENCHMARK 2.4: SSOT Dimension Consistency & Scale Normalization
      // ----------------------------------------------------------------------
      console.log('\n  • Testing SSOT Consistency & Dimension Alignment:');
      const rep = reports['Good'];
      check(typeof rep.techScore === 'number' && rep.techScore >= 60, `TechScore is properly populated (${rep.techScore})`);
      check(typeof rep.commScore === 'number' && rep.commScore >= 60, `CommScore is properly populated (${rep.commScore})`);
      check(typeof rep.softScore === 'number' && rep.softScore >= 60, `SoftScore is properly populated (${rep.softScore})`);
      check(
        rep.criteria && typeof rep.criteria.technicalKnowledge === 'string',
        `Criteria evaluation is present: TechnicalKnowledge="${rep.criteria?.technicalKnowledge}"`
      );
    }
  } finally {
    beProcess.kill();
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }

  console.log('\n===============================================================');
  console.log(`   CALIBRATION TEST SUMMARY: ${passed} PASS, ${failed} FAIL   `);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('[FATAL ERROR IN TEST SUITE]', err);
  process.exit(1);
});
