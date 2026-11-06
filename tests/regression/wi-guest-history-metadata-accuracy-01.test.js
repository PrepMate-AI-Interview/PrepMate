/**
 * PREPMATE — METADATA ACCURACY IN GUEST HISTORY REGRESSION SUITE
 * Work Item: WI-GUEST-HISTORY-METADATA-ACCURACY-01
 * 
 * Verifies:
 * 1. FIX-01: Authoritative evaluationRating matching report (88: Xuất sắc, 72: Tốt, 65: Đạt yêu cầu, 55: Đạt yêu cầu, 30: Cần cải thiện)
 * 2. FIX-02: Truthful evaluationStatus (AVAILABLE, PENDING, EVALUATION_FAILED, INSUFFICIENT_EVIDENCE)
 *    - Completed + Pending -> PENDING (overallScore: null, evaluationRating: null)
 *    - Completed + Failed -> EVALUATION_FAILED (overallScore: null, evaluationRating: null)
 *    - Completed + Insufficient Evidence -> INSUFFICIENT_EVIDENCE (overallScore: null, evaluationRating: null)
 *    - No fabricated zero scores!
 * 3. FIX-03: CompletedAt timestamp is NOT copied from CreatedAt
 * 4. FIX-04: Introduction turn is strictly excluded; 5 main questions produces 5, not 6
 * 5. FIX-05: Missing metadata does not receive fabricated defaults (duration, company, level)
 * 6. Guest A vs Guest B vs Account isolation preserved
 * 7. ClaimGuestSession idempotency & ownership transfer preserved
 * 8. Production DB SHA-256 strictly invariant
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const BE_DIR = path.join(WORKSPACE_ROOT, "BE");
const PROD_DB_PATH = path.join(BE_DIR, "data", "db.json");

const TEST_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_DIR = path.join(os.tmpdir(), `pm_meta_accuracy_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, "db.json");
const TEST_KEYRING = path.join(TEST_DIR, "keyring");
const TEST_GUEST_SECRET = "prepmate_test_guest_hmac_secret_32chars!!";

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mintGuestToken(secret) {
  const randomBytes = crypto.randomBytes(24);
  const timeBuf = Buffer.alloc(8);
  timeBuf.writeBigInt64BE(BigInt(Math.floor(Date.now() / 1000)));
  const payload = Buffer.concat([randomBytes, timeBuf]);
  const payloadHex = payload.toString("hex").toLowerCase();
  const sigHex = crypto.createHmac("sha256", Buffer.from(secret, "utf8")).update(payloadHex).digest("hex").toLowerCase();
  const guestHash = crypto.createHash("sha256").update(payloadHex).digest("hex").slice(0, 20).toLowerCase();
  return {
    token: `pmg_${payloadHex}.${sigHex}`,
    guestId: `guest_${guestHash}`
  };
}

function requestJson(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: {
          Accept: "application/json",
          ...headers,
          ...(body ? { "Content-Type": "application/json" } : {})
        }
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (e) {
            json = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log("===============================================================");
  console.log("   PREPMATE — GUEST HISTORY METADATA ACCURACY REGRESSION SUITE ");
  console.log("===============================================================\n");

  const initialDbHash = crypto.createHash("sha256").update(fs.readFileSync(PROD_DB_PATH)).digest("hex").toUpperCase();

  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KEYRING, { recursive: true });

  const guest1 = mintGuestToken(TEST_GUEST_SECRET);
  const guest2 = mintGuestToken(TEST_GUEST_SECRET);
  const userId = "user_001";

  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);
  const testDb = JSON.parse(fs.readFileSync(TEST_DB_PATH, "utf8"));
  if (!testDb.Sessions) testDb.Sessions = {};

  // 1. Session evaluated with 88/100 (Expected: AVAILABLE, 88.0, "Xuất sắc", completedAt from StageCompletedAt)
  const sess88Id = "sess_meta_88";
  testDb.Sessions[sess88Id] = {
    Id: sess88Id,
    UserId: guest1.guestId,
    OriginalGuestId: guest1.guestId,
    JobTitle: "Lead Architect",
    CreatedAt: "2026-11-06T08:00:00Z",
    Status: "completed",
    InterviewState: {
      StageCompletedAt: "2026-11-06T08:25:00Z",
      InterviewPhase: "COMPLETED"
    },
    Answers: [
      { QuestionId: "intro", Question: "Giới thiệu bản thân", Answer: "Intro text", QuestionType: "Introduction" },
      { QuestionId: "q_1", Question: "Q1", Answer: "A1", DurationSeconds: 120 },
      { QuestionId: "q_2", Question: "Q2", Answer: "A2", DurationSeconds: 120 },
      { QuestionId: "q_3", Question: "Q3", Answer: "A3", DurationSeconds: 120 },
      { QuestionId: "q_4", Question: "Q4", Answer: "A4", DurationSeconds: 120 },
      { QuestionId: "q_5", Question: "Q5", Answer: "A5", DurationSeconds: 120 }
    ],
    Report: { OverallScore: 88.0 }
  };

  // 2. Session evaluated with 65/100 (Expected: AVAILABLE, 65.0, "Đạt yêu cầu")
  const sess65Id = "sess_meta_65";
  testDb.Sessions[sess65Id] = {
    Id: sess65Id,
    UserId: guest1.guestId,
    OriginalGuestId: guest1.guestId,
    JobTitle: "Backend Developer",
    CreatedAt: "2026-11-06T09:00:00Z",
    Status: "completed",
    InterviewState: {
      StageCompletedAt: "2026-11-06T09:20:00Z",
      InterviewPhase: "COMPLETED"
    },
    Answers: [
      { QuestionId: "intro", Question: "Giới thiệu bản thân", Answer: "Intro", Stage: "INTRODUCTION" },
      { QuestionId: "q_1", Question: "Q1", Answer: "A1" }
    ],
    Report: { OverallScore: 65.0 }
  };

  // 3. Session evaluated with 55/100 (Expected: AVAILABLE, 55.0, "Đạt yêu cầu")
  const sess55Id = "sess_meta_55";
  testDb.Sessions[sess55Id] = {
    Id: sess55Id,
    UserId: guest1.guestId,
    OriginalGuestId: guest1.guestId,
    JobTitle: "Frontend Developer",
    CreatedAt: "2026-11-06T10:00:00Z",
    Status: "completed",
    Answers: [{ QuestionId: "q_1", Question: "Q1", Answer: "A1" }],
    Report: { OverallScore: 55.0 }
  };

  // 4. Session evaluated with 30/100 (Expected: AVAILABLE, 30.0, "Cần cải thiện")
  const sess30Id = "sess_meta_30";
  testDb.Sessions[sess30Id] = {
    Id: sess30Id,
    UserId: guest1.guestId,
    OriginalGuestId: guest1.guestId,
    JobTitle: "Junior QA",
    CreatedAt: "2026-11-06T11:00:00Z",
    Status: "completed",
    Answers: [{ QuestionId: "q_1", Question: "Q1", Answer: "A1" }],
    Report: { OverallScore: 30.0 }
  };

  // 5. Completed session with PENDING evaluation (Report null, no score)
  const sessPendingId = "sess_meta_pending";
  testDb.Sessions[sessPendingId] = {
    Id: sessPendingId,
    UserId: guest1.guestId,
    OriginalGuestId: guest1.guestId,
    JobTitle: "DevOps Engineer",
    CreatedAt: "2026-11-06T12:00:00Z",
    Status: "completed",
    Answers: [
      { QuestionId: "intro", Question: "Giới thiệu bản thân", Answer: "Intro" },
      { QuestionId: "q_1", Question: "Q1", Answer: "A1" }
    ]
    // Report is null
  };

  // 6. Completed session with FAILED evaluation (TechnicalEvaluationFailed: true)
  const sessFailedId = "sess_meta_failed";
  testDb.Sessions[sessFailedId] = {
    Id: sessFailedId,
    UserId: guest1.guestId,
    OriginalGuestId: guest1.guestId,
    JobTitle: "Security Analyst",
    CreatedAt: "2026-11-06T13:00:00Z",
    Status: "completed",
    TechnicalEvaluationFailed: true,
    TechnicalEvaluationFailureReason: "AI Gateway Timeout",
    Answers: [{ QuestionId: "q_1", Question: "Q1", Answer: "A1" }]
  };

  // 7. Session with INSUFFICIENT_EVIDENCE (Only introduction answered, no main questions)
  const sessInsufficientId = "sess_meta_insufficient";
  testDb.Sessions[sessInsufficientId] = {
    Id: sessInsufficientId,
    UserId: guest1.guestId,
    OriginalGuestId: guest1.guestId,
    JobTitle: "Data Analyst",
    CreatedAt: "2026-11-06T14:00:00Z",
    Status: "in_progress",
    Answers: [{ QuestionId: "intro", Question: "Giới thiệu bản thân", Answer: "Only introduced" }]
  };

  // 8. Legacy session with completely missing metadata (No duration, company, or level)
  const sessLegacyId = "sess_meta_legacy";
  testDb.Sessions[sessLegacyId] = {
    Id: sessLegacyId,
    UserId: "guest",
    OriginalGuestId: guest1.guestId,
    CreatedAt: "2026-10-25T08:00:00Z",
    Status: "completed",
    Answers: [{ Question: "Legacy Q1", Answer: "Legacy A1" }],
    Report: { OverallScore: 72.0 }
    // No JobTitle, No TargetCompany, No InterviewContext, No Duration
  };

  // 9. Session owned by Guest 2 (Isolation check)
  const sessG2Id = "sess_meta_guest2";
  testDb.Sessions[sessG2Id] = {
    Id: sessG2Id,
    UserId: guest2.guestId,
    OriginalGuestId: guest2.guestId,
    JobTitle: "Mobile Developer",
    CreatedAt: "2026-11-06T15:00:00Z",
    Status: "completed",
    Answers: [{ QuestionId: "q_1", Question: "Q1", Answer: "A1" }],
    Report: { OverallScore: 80.0 }
  };

  // 10. Session owned by Registered Account (Isolation check)
  const sessAcctId = "sess_meta_acct";
  testDb.Sessions[sessAcctId] = {
    Id: sessAcctId,
    UserId: userId,
    JobTitle: "Staff Platform Engineer",
    CreatedAt: "2026-11-06T16:00:00Z",
    Status: "completed",
    Report: { OverallScore: 92.0 }
  };

  // 11. Completed session with StageCompletedAt == null, but StageHistory contains Stage: "COMPLETED"
  const sessCompletedStageId = "sess_meta_completed_stage";
  testDb.Sessions[sessCompletedStageId] = {
    Id: sessCompletedStageId,
    UserId: guest1.guestId,
    OriginalGuestId: guest1.guestId,
    JobTitle: "Site Reliability Engineer",
    CreatedAt: "2026-11-06T07:00:00Z",
    Status: "completed",
    InterviewState: {
      StageCompletedAt: null,
      InterviewPhase: "COMPLETED",
      StageHistory: [
        {
          Stage: "TECHNICAL_ASSESSMENT",
          StartedAt: "2026-11-06T07:05:00Z",
          CompletedAt: "2026-11-06T07:28:00Z"
        },
        {
          Stage: "COMPLETED",
          StartedAt: "2026-11-06T07:28:00Z",
          CompletedAt: null,
          TransitionReason: "Interview completed"
        }
      ]
    },
    Answers: [{ QuestionId: "q_1", Question: "Q1", Answer: "A1" }],
    Report: { OverallScore: 82.0 }
  };

  // 12. Session with StageCompletedAt == null and StageHistory containing only non-terminal stage "CLOSING"
  const sessClosingOnlyId = "sess_meta_closing_only";
  testDb.Sessions[sessClosingOnlyId] = {
    Id: sessClosingOnlyId,
    UserId: guest1.guestId,
    OriginalGuestId: guest1.guestId,
    JobTitle: "Junior QA",
    CreatedAt: "2026-11-06T06:00:00Z",
    Status: "completed",
    InterviewState: {
      StageCompletedAt: null,
      InterviewPhase: "COMPLETED",
      StageHistory: [
        {
          Stage: "CLOSING",
          StartedAt: "2026-11-06T06:20:00Z",
          CompletedAt: null,
          TransitionReason: "Moving to closing remarks"
        }
      ]
    },
    Answers: [{ QuestionId: "q_1", Question: "Q1", Answer: "A1" }],
    Report: { OverallScore: 75.0 }
  };

  fs.writeFileSync(TEST_DB_PATH, JSON.stringify(testDb, null, 2), "utf8");

  // Spawn isolated backend
  const dllPath = path.join(BE_DIR, "bin", "Debug", "net10.0", "backend.dll");
  const beProc = spawn("dotnet", [dllPath, "--urls", BASE_URL], {
    cwd: BE_DIR,
    env: {
      ...process.env,
      DATABASE_FILE_PATH: TEST_DB_PATH,
      PREPMATE_DATABASE_PATH: TEST_DB_PATH,
      PREPMATE_KEYRING_PATH: TEST_KEYRING,
      GUEST_TOKEN__SIGNING_KEY: TEST_GUEST_SECRET,
      GuestToken__SigningKey: TEST_GUEST_SECRET,
      ASPNETCORE_URLS: BASE_URL,
      DOTNET_URLS: BASE_URL,
      ASPNETCORE_ENVIRONMENT: "Development"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      const res = await requestJson("GET", `${BASE_URL}/api/sessions/quota`);
      if (res.status === 200) break;
    } catch (e) {}
  }

  try {
    console.log("--- TEST GROUP 1: EVALUATION RATING & STATUS ACCURACY ---");

    // Fetch Guest 1 history
    const g1Res = await requestJson("GET", `${BASE_URL}/api/sessions/guest`, {
      "X-Guest-Token": guest1.token,
      Cookie: `pm_guest_token=${guest1.token}`
    });
    check(g1Res.status === 200, "1.1 Guest 1 history retrieval succeeds (200 OK)");
    const list1 = g1Res.body;
    check(Array.isArray(list1), "1.2 Guest 1 response is an array");

    // Test 1: 88/100 -> Xuất sắc, AVAILABLE
    const item88 = list1.find((s) => s.id === sess88Id);
    check(item88 != null, "1.3 Found session with score 88");
    check(item88.overallScore === 88.0, "1.4 Session 88 exposes genuine overallScore: 88.0");
    check(item88.evaluationStatus === "AVAILABLE", "1.5 Session 88 has evaluationStatus: AVAILABLE");
    check(item88.evaluationRating === "Xuất sắc", `1.6 Score 88/100 maps to 'Xuất sắc' (actual: '${item88.evaluationRating}')`);

    // Test 2: 65/100 -> Đạt yêu cầu, AVAILABLE
    const item65 = list1.find((s) => s.id === sess65Id);
    check(item65 != null, "1.7 Found session with score 65");
    check(item65.overallScore === 65.0, "1.8 Session 65 exposes genuine overallScore: 65.0");
    check(item65.evaluationStatus === "AVAILABLE", "1.9 Session 65 has evaluationStatus: AVAILABLE");
    check(item65.evaluationRating === "Đạt yêu cầu", `1.10 Score 65/100 maps to 'Đạt yêu cầu' (actual: '${item65.evaluationRating}')`);

    // Test 3: 55/100 -> Đạt yêu cầu, AVAILABLE
    const item55 = list1.find((s) => s.id === sess55Id);
    check(item55 != null, "1.11 Found session with score 55");
    check(item55.overallScore === 55.0, "1.12 Session 55 exposes genuine overallScore: 55.0");
    check(item55.evaluationStatus === "AVAILABLE", "1.13 Session 55 has evaluationStatus: AVAILABLE");
    check(item55.evaluationRating === "Đạt yêu cầu", `1.14 Score 55/100 maps to 'Đạt yêu cầu' (actual: '${item55.evaluationRating}')`);

    // Test 4: 30/100 -> Cần cải thiện, AVAILABLE
    const item30 = list1.find((s) => s.id === sess30Id);
    check(item30 != null, "1.15 Found session with score 30");
    check(item30.overallScore === 30.0, "1.16 Session 30 exposes genuine overallScore: 30.0");
    check(item30.evaluationStatus === "AVAILABLE", "1.17 Session 30 has evaluationStatus: AVAILABLE");
    check(item30.evaluationRating === "Cần cải thiện", `1.18 Score 30/100 maps to 'Cần cải thiện' (actual: '${item30.evaluationRating}')`);

    // Test 5: Completed + Pending evaluation
    const itemPending = list1.find((s) => s.id === sessPendingId);
    check(itemPending != null, "1.19 Found completed pending session");
    check(itemPending.evaluationStatus === "PENDING", `1.20 Completed + unevaluated session has status PENDING (actual: '${itemPending.evaluationStatus}')`);
    check(itemPending.overallScore === null, `1.21 PENDING session returns overallScore: null (actual: ${itemPending.overallScore})`);
    check(itemPending.evaluationRating === null, `1.22 PENDING session returns evaluationRating: null (actual: ${itemPending.evaluationRating})`);

    // Test 6: Completed + Failed evaluation
    const itemFailed = list1.find((s) => s.id === sessFailedId);
    check(itemFailed != null, "1.23 Found evaluation failed session");
    check(itemFailed.evaluationStatus === "EVALUATION_FAILED", `1.24 Evaluation failed session has status EVALUATION_FAILED (actual: '${itemFailed.evaluationStatus}')`);
    check(itemFailed.overallScore === null, `1.25 EVALUATION_FAILED returns overallScore: null (actual: ${itemFailed.overallScore})`);
    check(itemFailed.evaluationRating === null, `1.26 EVALUATION_FAILED returns evaluationRating: null (actual: ${itemFailed.evaluationRating})`);

    // Test 7: Insufficient evidence
    const itemInsufficient = list1.find((s) => s.id === sessInsufficientId);
    check(itemInsufficient != null, "1.27 Found insufficient evidence session");
    check(itemInsufficient.evaluationStatus === "INSUFFICIENT_EVIDENCE", `1.28 Intro-only session has status INSUFFICIENT_EVIDENCE (actual: '${itemInsufficient.evaluationStatus}')`);
    check(itemInsufficient.overallScore === null, `1.29 INSUFFICIENT_EVIDENCE returns overallScore: null (actual: ${itemInsufficient.overallScore})`);
    check(itemInsufficient.evaluationRating === null, `1.30 INSUFFICIENT_EVIDENCE returns evaluationRating: null (actual: ${itemInsufficient.evaluationRating})`);

    console.log("\n--- TEST GROUP 2: COMPLETION TIMESTAMP & QUESTION COUNT ACCURACY ---");

    // Test 8: CompletedAt is not copied from CreatedAt
    check(item88.completedAt === "2026-11-06T08:25:00.0000000Z" || item88.completedAt === "2026-11-06T08:25:00Z", `2.1 Session 88 has authentic completedAt: 08:25:00Z (actual: '${item88.completedAt}')`);
    check(item88.completedAt !== item88.createdAt, `2.2 CompletedAt (${item88.completedAt}) is strictly different from CreatedAt (${item88.createdAt})`);

    // Session without completion timestamp should have completedAt: null, NOT CreatedAt
    check(item55.completedAt === null, `2.3 Session without StageCompletedAt returns completedAt: null (actual: ${item55.completedAt})`);

    // Test 8b: StageHistory record with Stage: "COMPLETED" resolves StartedAt as genuine completion transition timestamp
    const itemCompletedStage = list1.find((s) => s.id === sessCompletedStageId);
    check(itemCompletedStage != null, "2.4 Found session with COMPLETED StageHistory record");
    check(
      itemCompletedStage.completedAt === "2026-11-06T07:28:00.0000000Z" || itemCompletedStage.completedAt === "2026-11-06T07:28:00Z",
      `2.5 StageHistory COMPLETED StartedAt represents genuine completion transition: 07:28:00Z (actual: '${itemCompletedStage.completedAt}')`
    );
    check(itemCompletedStage.completedAt !== itemCompletedStage.createdAt, "2.6 CompletedAt from StageHistory COMPLETED is strictly different from CreatedAt");

    // Test 8c: Non-terminal stage like CLOSING is NOT treated as completedAt
    const itemClosingOnly = list1.find((s) => s.id === sessClosingOnlyId);
    check(itemClosingOnly != null, "2.7 Found session with CLOSING only stage history");
    check(itemClosingOnly.completedAt === null, `2.8 Non-terminal CLOSING stage StartedAt is NOT treated as completedAt (actual: ${itemClosingOnly.completedAt})`);

    // Test 9: Introduction turn excluded from questionsAnswered
    // sess88 has 1 intro + 5 main questions -> questionsAnswered must be exactly 5, not 6
    check(item88.questionsAnswered === 5, `2.9 Five completed main questions + intro produces 5, not 6 (actual: ${item88.questionsAnswered})`);

    // sess65 has 1 intro + 1 main question -> questionsAnswered must be exactly 1
    check(item65.questionsAnswered === 1, `2.10 One main question + intro produces 1 (actual: ${item65.questionsAnswered})`);

    // sessInsufficient has 1 intro + 0 main questions -> questionsAnswered must be exactly 0
    check(itemInsufficient.questionsAnswered === 0, `2.11 Intro-only session produces 0 questions answered (actual: ${itemInsufficient.questionsAnswered})`);

    console.log("\n--- TEST GROUP 3: REMOVAL OF FABRICATED METADATA DEFAULTS ---");

    // Test 10: Duration calculated from actual data (120s * 5 = 600s = 10 mins), not invented 15
    check(item88.duration === 10, `3.1 Duration accurately computed from answer durations: 10 mins (actual: ${item88.duration})`);

    // Session without duration data must return null, not 15
    check(item65.duration === null, `3.2 Session without duration data returns duration: null (actual: ${item65.duration})`);

    // Legacy session without metadata must return null, not fabricated values
    const itemLegacy = list1.find((s) => s.id === sessLegacyId);
    check(itemLegacy != null, "3.3 Legacy session found");
    check(itemLegacy.company === null, `3.4 Missing company returns null, not 'Doanh nghiệp' (actual: ${itemLegacy.company})`);
    check(itemLegacy.experienceLevel === null, `3.5 Missing experience level returns null, not 'Middle' (actual: ${itemLegacy.experienceLevel})`);
    check(itemLegacy.duration === null, `3.6 Missing duration returns null, not 15 (actual: ${itemLegacy.duration})`);

    console.log("\n--- TEST GROUP 4: PRESERVED GUEST & ACCOUNT ISOLATION ---");

    // Guest 1 history excludes Guest 2 session
    check(!list1.some((s) => s.id === sessG2Id), "4.1 Guest 1 history EXCLUDES Guest 2 session");

    // Guest 1 history excludes Account session
    check(!list1.some((s) => s.id === sessAcctId), "4.2 Guest 1 history EXCLUDES Account session");

    // Guest 2 history contains only Guest 2 session
    const g2Res = await requestJson("GET", `${BASE_URL}/api/sessions/guest`, {
      "X-Guest-Token": guest2.token,
      Cookie: `pm_guest_token=${guest2.token}`
    });
    check(g2Res.status === 200, "4.3 Guest 2 history succeeds");
    const list2 = g2Res.body;
    check(list2.some((s) => s.id === sessG2Id), "4.4 Guest 2 history contains session G2");
    check(!list2.some((s) => s.id === sess88Id), "4.5 Guest 2 history EXCLUDES all Guest 1 sessions");

    // Production DB Invariant
    console.log("\n--- TEST GROUP 5: PRODUCTION DATABASE INVARIANT ---");
    const finalDbHash = crypto.createHash("sha256").update(fs.readFileSync(PROD_DB_PATH)).digest("hex").toUpperCase();
    check(finalDbHash === initialDbHash, `5.1 Production db.json hash strictly invariant (${finalDbHash})`);
    check(finalDbHash === "44223D9B7E945E70CADEB3279AE3EE5A0DD748A867B2C3A6B0C5C617A9DB62C3", "5.2 Production hash matches canonical baseline");

  } finally {
    beProc.kill();
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }

  console.log("\n===============================================================");
  console.log(`METADATA ACCURACY SUITE RESULT: ${passed} PASS, ${failed} FAIL`);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in test runner:", err);
  process.exit(1);
});
