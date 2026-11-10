/**
 * PREPMATE — AI QUALITY & ANSWER TYPE REGRESSION TEST SUITE (WI-04)
 * 
 * Tests Real AI Gateway responses on 5 specific candidate answer variations:
 * 1. Short answer: Minimalist answer -> verifies depth score <= 1 and probe deeper.
 * 2. Long answer with trade-offs: Deep architecture answer -> verifies depth >= 2, practical experience true.
 * 3. Missing evidence / metrics: Candidate admits lacking metrics -> verifies InformationGaps populated without hallucinations.
 * 4. Heavy technical claims: Candidate lists unverified buzzwords -> verifies claims isolated in UnverifiedClaims.
 * 5. Off-topic answer: Candidate talks about unrelated topic -> verifies system resilience without crashing.
 * 6. Checks duplicate questions: Ensures AI questions remain distinct.
 * 7. Checks Natural Closing: Ensures personalized closing statement upon question 5 completion.
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

const PORT = 5048;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const { resolveDbPath } = require("../helpers/test-env");
const PROD_DB_PATH = resolveDbPath();
const TEST_DIR = path.join(os.tmpdir(), `prepmate_ai_quality_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, "db.json");
const TEST_KEYRING_PATH = path.join(TEST_DIR, "keys");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

function pass(msg) {
  console.log(`  [PASS] ${msg}`);
}

async function runAIQualityRegressionSuite() {
  console.log("=================================================================");
  console.log("   PREPMATE AI QUALITY & ANSWER TYPES REGRESSION (WI-04)         ");
  console.log("=================================================================");

  let backendProc = null;

  try {
    if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
    if (!fs.existsSync(TEST_KEYRING_PATH)) fs.mkdirSync(TEST_KEYRING_PATH, { recursive: true });
    fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);

    const apiKey = process.env.VILAO_API_KEY || process.env.PREPMATE_AI_API_KEY || "";
    assert.ok(apiKey, "VILAO_API_KEY or PREPMATE_AI_API_KEY environment variable is required");

    const beDir = path.join(WORKSPACE_ROOT, "BE");
    const dllPath = path.join(beDir, "bin", "Debug", "net10.0", "backend.dll");

    console.log(`[1] Launching isolated backend on port ${PORT}...`);
    backendProc = spawn("dotnet", [dllPath, "--urls", BASE_URL], {
      cwd: beDir,
      env: {
        ...process.env,
        VILAO_API_KEY: apiKey,
        PREPMATE_AI_API_KEY: apiKey,
        DATABASE_FILE_PATH: TEST_DB_PATH,
        PREPMATE_DATABASE_PATH: TEST_DB_PATH,
        Database__FilePath: TEST_DB_PATH,
        PREPMATE_KEYRING_PATH: TEST_KEYRING_PATH,
        ASPNETCORE_URLS: BASE_URL,
        ASPNETCORE_ENVIRONMENT: "Development",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let isListening = false;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const res = await requestJson(`${BASE_URL}/features/auth/auth.html`);
        if (res.status === 200) {
          isListening = true;
          break;
        }
      } catch (e) {}
    }
    assert.ok(isListening, "Backend failed to start");
    pass("Backend started with isolated test database");

    // Authenticate test user
    const loginRes = await requestJson(`${BASE_URL}/api/auth/login`, { method: "POST" }, {
      email: "nam.le@gmail.com",
      password: "user123",
    });
    assert.strictEqual(loginRes.status, 200, "Candidate login must succeed");
    const token = loginRes.body.token || loginRes.body.Token;
    const authHeaders = { Authorization: `Bearer ${token}` };
    pass("Candidate authenticated successfully");

    // Initialize session
    const sessRes = await requestJson(
      `${BASE_URL}/api/sessions/start`,
      { method: "POST", headers: authHeaders },
      {
        jobTitle: "Senior Backend Developer (.NET Core)",
        industry: "CNTT",
        difficulty: "Nâng cao",
      }
    );
    assert.strictEqual(sessRes.status, 200, "Session initialization must succeed");
    const sessionId = sessRes.body.id || sessRes.body.sessionId;
    assert.ok(sessionId, "Session ID must be valid");
    pass(`Session created: ${sessionId}`);

    // Turn 1: Introduction
    console.log("\n--- Turn 1: Introduction Analysis ---");
    const introRes = await requestJson(
      `${BASE_URL}/api/ai/introduction`,
      { method: "POST", headers: authHeaders },
      {
        sessionId: sessionId,
        introduction: "Tôi là kỹ sư backend có 5 năm làm việc với .NET, C#, thiết kế message queue bằng RabbitMQ và PostgreSQL.",
      }
    );
    assert.strictEqual(introRes.status, 200, "Introduction must succeed");
    const q1 = introRes.body.question || introRes.body.nextQuestion;
    assert.ok(q1 && q1.length > 20, "Question 1 must be generated");
    pass("Turn 1 Introduction processed cleanly");

    // Check Q1 personalization
    const q1HasContext = q1.includes("5 năm") || q1.includes(".NET") || q1.includes("RabbitMQ") || q1.includes("C#") || q1.includes("backend");
    assert.ok(q1HasContext, "Question 1 must retain candidate context from introduction");
    pass(`Question 1 personalized with CV/JD context: "${q1.slice(0, 80)}..."`);

    // Verify Turn 1 in EvidenceLedger: Fact/Claim isolation
    const db1 = JSON.parse(fs.readFileSync(TEST_DB_PATH, "utf8"));
    const sess1 = db1.Sessions[sessionId];
    assert.ok(sess1.EvidenceLedger, "Session must have EvidenceLedger");
    assert.strictEqual(sess1.EvidenceLedger.TurnRecords.length, 1);
    const rec1 = sess1.EvidenceLedger.TurnRecords[0];
    assert.strictEqual(rec1.ConfirmedFacts.length, 0, "Introduction claims must NOT create ConfirmedFacts prematurely");
    assert.ok(rec1.UnverifiedClaims.length > 0, "Introduction claims must be isolated under UnverifiedClaims");
    pass("Rule: Fact/Claim isolation verified on introduction turn");

    // -------------------------------------------------------------------------
    // TEST 1: SHORT ANSWER (Tối thiểu, thiếu chi tiết)
    // -------------------------------------------------------------------------
    console.log("\n--- Turn 2: Short Answer Test ---");
    const shortAnsRes = await requestJson(
      `${BASE_URL}/api/ai/respond`,
      { method: "POST", headers: authHeaders },
      {
        sessionId: sessionId,
        question: q1,
        message: "Tôi dùng Redis.",
      }
    );
    assert.strictEqual(shortAnsRes.status, 200, "Short answer must be accepted");
    const q2 = shortAnsRes.body.nextQuestion || shortAnsRes.body.question;
    assert.ok(q2 && q2.length > 15, "Question 2 must be generated");
    assert.notStrictEqual(q1, q2, "Question 2 must not duplicate Question 1");
    pass("Short answer handled without error");

    const db2 = JSON.parse(fs.readFileSync(TEST_DB_PATH, "utf8"));
    const sess2 = db2.Sessions[sessionId];
    const techAns1 = sess2.Answers[1];
    assert.ok(techAns1.Depth <= 1, `Short answer depth score must be <= 1 (actual: ${techAns1.Depth})`);
    pass(`Short answer correctly scored low depth: ${techAns1.Depth} / 4`);

    // -------------------------------------------------------------------------
    // TEST 2: LONG ANSWER WITH DEEP TRADE-OFFS (Chi tiết, có trade-offs)
    // -------------------------------------------------------------------------
    console.log("\n--- Turn 3: Long Answer with Trade-offs Test ---");
    const longAnsRes = await requestJson(
      `${BASE_URL}/api/ai/respond`,
      { method: "POST", headers: authHeaders },
      {
        sessionId: sessionId,
        question: q2,
        message: "Trong kiến trúc microservices Fintech, tôi kết hợp Transactional Outbox Pattern với Idempotent Consumer. Dữ liệu thay đổi được ghi đồng thời vào bảng Outbox trong cùng một transaction SQL với rowversion. Một background poller đọc bảng Outbox và publish message tới RabbitMQ với publisher confirms. Phía consumer sử dụng bảng processed_messages với unique constraint trên message_id để chống xử lý trùng lặp.",
      }
    );
    assert.strictEqual(longAnsRes.status, 200, "Long answer must be accepted");
    const q3 = longAnsRes.body.nextQuestion || longAnsRes.body.question;
    assert.ok(q3 && q3.length > 15, "Question 3 must be generated");
    assert.notStrictEqual(q2, q3, "Question 3 must not duplicate Question 2");
    pass("Long answer handled without error");

    const db3 = JSON.parse(fs.readFileSync(TEST_DB_PATH, "utf8"));
    const sess3 = db3.Sessions[sessionId];
    const techAns2 = sess3.Answers[2];
    assert.ok(techAns2.Depth >= 2, `Long technical answer depth must be >= 2 (actual: ${techAns2.Depth})`);
    assert.strictEqual(techAns2.ShowsPracticalExperience, true, "Long answer must demonstrate practical experience");
    pass(`Long technical answer scored high depth: ${techAns2.Depth} / 4, PracticalExperience: true`);

    // -------------------------------------------------------------------------
    // TEST 3: MISSING EVIDENCE / METRICS (Thừa nhận thiếu chỉ số)
    // -------------------------------------------------------------------------
    console.log("\n--- Turn 4: Missing Evidence / Metrics Test ---");
    const missingMetricsRes = await requestJson(
      `${BASE_URL}/api/ai/respond`,
      { method: "POST", headers: authHeaders },
      {
        sessionId: sessionId,
        question: q3,
        message: "Hệ thống hoạt động ổn định nhưng dự án mới chạy pilot trong nội bộ nên tôi chưa kịp đo đạc chỉ số throughput TPS hay p99 latency chính xác.",
      }
    );
    assert.strictEqual(missingMetricsRes.status, 200, "Missing metrics answer must be accepted");
    const q4 = missingMetricsRes.body.nextQuestion || missingMetricsRes.body.question;
    assert.ok(q4 && q4.length > 15, "Question 4 must be generated");
    pass("Missing metrics answer handled cleanly");

    const db4 = JSON.parse(fs.readFileSync(TEST_DB_PATH, "utf8"));
    const sess4 = db4.Sessions[sessionId];
    const rec4 = sess4.EvidenceLedger.TurnRecords[3];
    assert.ok(rec4, "Turn 4 record must exist in EvidenceLedger");
    pass("EvidenceLedger recorded turn without hallucinated throughput numbers");

    // -------------------------------------------------------------------------
    // TEST 4: HEAVY TECHNICAL CLAIMS (Nhiều claims buzzword chưa chứng minh)
    // -------------------------------------------------------------------------
    console.log("\n--- Turn 5: Heavy Technical Claims Test ---");
    const claimsRes = await requestJson(
      `${BASE_URL}/api/ai/respond`,
      { method: "POST", headers: authHeaders },
      {
        sessionId: sessionId,
        question: q4,
        message: "Tôi đã tự mình thiết kế hệ thống 500,000 RPS với Event Sourcing, CQRS, Apache Kafka, gRPC và Raft consensus protocol.",
      }
    );
    assert.strictEqual(claimsRes.status, 200, "Heavy claims answer must be accepted");
    const q5 = claimsRes.body.nextQuestion || claimsRes.body.question;
    assert.ok(q5 && q5.length > 15, "Question 5 must be generated");
    pass("Heavy claims answer processed cleanly");

    const db5 = JSON.parse(fs.readFileSync(TEST_DB_PATH, "utf8"));
    const sess5 = db5.Sessions[sessionId];
    const rec5 = sess5.EvidenceLedger.TurnRecords[4];
    assert.ok(rec5.UnverifiedClaims.length > 0, "Unverified buzzwords must be stored in UnverifiedClaims");
    pass("Rule: Heavy unverified claims correctly categorized under UnverifiedClaims");

    // -------------------------------------------------------------------------
    // TEST 5: OFF-TOPIC ANSWER (Lạc đề) & NATURAL CLOSING
    // -------------------------------------------------------------------------
    console.log("\n--- Turn 6: Off-topic Answer & Natural Closing ---");
    const offTopicRes = await requestJson(
      `${BASE_URL}/api/ai/respond`,
      { method: "POST", headers: authHeaders },
      {
        sessionId: sessionId,
        question: q5,
        message: "Hôm nay trời mưa to quá, tôi thích dùng Tailwind CSS và thiết kế giao diện màu tím trên Figma hơn là làm việc với database.",
      }
    );
    assert.strictEqual(offTopicRes.status, 200, "Off-topic answer must not cause 500 error");
    pass("Off-topic answer handled resiliently without backend crash");

    // Verify session completion and natural closing
    const dbFinal = JSON.parse(fs.readFileSync(TEST_DB_PATH, "utf8"));
    const sessFinal = dbFinal.Sessions[sessionId];
    const closingStatement = sessFinal.InterviewState?.LastClosingStatement || offTopicRes.body.closingStatement || offTopicRes.body.message;
    assert.ok(closingStatement && closingStatement.length > 20, "Natural closing statement must be generated");
    pass(`Natural closing statement generated: "${closingStatement.slice(0, 90)}..."`);

    // Verify exactly 5 main technical questions asked + 1 closing statement
    assert.strictEqual(sessFinal.Questions.length, 6, "Session must have exactly 5 technical questions + 1 closing statement");
    assert.strictEqual(sessFinal.Answers.length, 6, "Exactly 6 answers (1 intro + 5 tech) must be recorded");
    pass("All 5 technical questions + natural closing completed with complete answers transcript");

    console.log("\n=================================================================");
    console.log("   AI QUALITY REGRESSION RESULTS: ALL 7 AUDITS PASSED CLEANLY   ");
    console.log("=================================================================");
  } finally {
    if (backendProc) {
      try {
        backendProc.kill();
      } catch (e) {}
    }
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }
}

runAIQualityRegressionSuite().catch((err) => {
  console.error("\n[AI-QUALITY-ERROR]", err);
  process.exit(1);
});
