/**
 * PREPMATE — WI-INTERVIEW-DURATION-AGGREGATION-01 REGRESSION SUITE
 * 
 * Verifies End-to-End Interview Duration Flow, Persistence, and Aggregation:
 * 1. Duration Formatting Rules (0s, <60s, minutes, exact hours, hours + minutes)
 * 2. Second-Level Aggregation Invariant (3 x 40s = 120s = 2 min, NOT 0+0+0=0)
 * 3. Frontend Source Code Invariants (SSOT formatDuration, no fake 15min default, syncUserInterviewSessions)
 * 4. Backend Model Invariants (Session.DurationSeconds, Session.Duration, dynamic fallback, negative protection)
 * 5. Isolated Backend API Verification (/api/sessions/guest and /api/sessions/user/{userId})
 * 6. Database Immutability Check (db.json SHA-256 untouched)
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const { resolveDbPath, getBaselineDbHash } = require("../helpers/test-env");
const PROD_DB_PATH = resolveDbPath();
const BASELINE_DB_HASH = getBaselineDbHash();

const TEST_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_DIR = path.join(os.tmpdir(), `prepmate_duration_test_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, "isolated_duration_db.json");
const TEST_KEYRING = path.join(TEST_DIR, "keys");
const TEST_GUEST_SECRET = "PREPMATE_TEST_GUEST_KEY_32CHARS_MIN!";

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

function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || "GET",
      headers: options.headers || {}
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on("error", reject);

    if (body) {
      const payload = typeof body === "string" ? body : JSON.stringify(body);
      req.setHeader("Content-Type", "application/json");
      req.setHeader("Content-Length", Buffer.byteLength(payload));
      req.write(payload);
    }
    req.end();
  });
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

// -------------------------------------------------------------
// SECTION 1: FORMATTING AND PRECISION UNIT TESTS
// -------------------------------------------------------------
function runUnitFormattingTests() {
  console.log("\n--- SECTION 1: DURATION FORMATTING & PRECISION CONTRACTS ---");
  const mainJsContent = fs.readFileSync(path.join(WORKSPACE_ROOT, "FE/shared/js/main.js"), "utf8");

  const fnMatch1 = mainJsContent.match(/function formatDuration\s*\([\s\S]*?\n\}/);
  const fnMatch2 = mainJsContent.match(/function getSessionDurationSeconds\s*\([\s\S]*?\n\}/);

  check(fnMatch1 !== null, "formatDuration exists in FE/shared/js/main.js");
  check(fnMatch2 !== null, "getSessionDurationSeconds exists in FE/shared/js/main.js");

  const runCode = new Function("exports", `${fnMatch2[0]}\n${fnMatch1[0]}\nreturn { formatDuration, getSessionDurationSeconds };`);
  const { formatDuration, getSessionDurationSeconds } = runCode({});

  // Formatting tests per specification table
  check(formatDuration(0) === "0 phút", "0s formats to '0 phút'");
  check(formatDuration(35) === "Dưới 1 phút", "35s card formats to 'Dưới 1 phút'");
  check(formatDuration(35, { isAggregate: true }) === "< 1 phút", "35s aggregate formats to '< 1 phút'");
  check(formatDuration(80) === "1 phút", "80s formats to '1 phút'");
  check(formatDuration(765) === "13 phút", "765s formats to '13 phút'");
  check(formatDuration(3600) === "1 giờ", "3600s formats to '1 giờ'");
  check(formatDuration(5400) === "1 giờ 30 phút", "5400s formats to '1 giờ 30 phút'");
  check(formatDuration(7500) === "2 giờ 5 phút", "7500s formats to '2 giờ 5 phút'");
  check(formatDuration(null) === "Chưa xác định", "null formats to 'Chưa xác định'");
  check(formatDuration(null, { isAggregate: true }) === "0 phút", "null aggregate formats to '0 phút'");

  // Second-level aggregation test (avoid 0 + 0 = 0 rounding error)
  const sessions = [
    { durationSeconds: 40, status: "completed" },
    { durationSeconds: 40, status: "completed" },
    { durationSeconds: 40, status: "completed" }
  ];
  const totalSec = sessions.reduce((acc, s) => acc + getSessionDurationSeconds(s), 0);
  check(totalSec === 120, "Total seconds correctly sums to 120 seconds for three 40s sessions");
  check(formatDuration(totalSec, { isAggregate: true }) === "2 phút", "Total aggregate formats to '2 phút', not 0");

  // Fallback timestamp difference resolution
  const timeSession = {
    startedAt: "2026-03-30T10:00:00.000Z",
    completedAt: "2026-03-30T10:15:30.000Z"
  };
  check(getSessionDurationSeconds(timeSession) === 930, "Fallback calculates exact difference (930s)");
  check(formatDuration(getSessionDurationSeconds(timeSession)) === "16 phút", "930s formats to '16 phút'");

  // Negative timestamp guard
  const invalidSession = {
    startedAt: "2026-03-30T10:15:00.000Z",
    completedAt: "2026-03-30T10:00:00.000Z"
  };
  check(getSessionDurationSeconds(invalidSession) === 0, "Invalid negative timestamp returns 0");
}

// -------------------------------------------------------------
// SECTION 2: FRONTEND SOURCE CODE AUDIT
// -------------------------------------------------------------
function runFrontendSourceAudit() {
  console.log("\n--- SECTION 2: FRONTEND SOURCE CODE AUDIT ---");

  // 1. Dashboard.js
  const dashboardJs = fs.readFileSync(path.join(WORKSPACE_ROOT, "FE/features/dashboard/dashboard.js"), "utf8");
  check(!dashboardJs.includes("${session.duration || 15} phút"), "Dashboard history list no longer hardcodes '|| 15 phút'");
  check(dashboardJs.includes("getSessionDurationSeconds"), "Dashboard utilizes getSessionDurationSeconds for accurate calculation");
  check(dashboardJs.includes("totalSec = completedSessions.reduce"), "Dashboard aggregates completed sessions in seconds");

  // 2. History.html
  const historyHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, "FE/features/interview/history.html"), "utf8");
  check(!historyHtml.includes("sessions.reduce((acc, s) => acc + (s.duration || 0), 0)"), "History page no longer naively sums raw integer duration");
  check(historyHtml.includes("getSessionDurationSeconds"), "History page uses getSessionDurationSeconds");
  check(historyHtml.includes("formatDuration"), "History page formats duration using SSOT formatDuration");

  // 3. Interview-finish.js
  const finishJs = fs.readFileSync(path.join(WORKSPACE_ROOT, "FE/features/interview/interview-finish.js"), "utf8");
  check(finishJs.includes("currentInterviewSession.durationSeconds = elapsedSec;"), "interview-finish.js persists durationSeconds");
  check(finishJs.includes("currentInterviewSession.completedAt = new Date().toISOString();"), "interview-finish.js sets completedAt");

  // 4. Main.js sync
  const mainJs = fs.readFileSync(path.join(WORKSPACE_ROOT, "FE/shared/js/main.js"), "utf8");
  check(mainJs.includes("window.formatDuration = formatDuration;"), "formatDuration is exported to window");
  check(mainJs.includes("window.getSessionDurationSeconds = getSessionDurationSeconds;"), "getSessionDurationSeconds is exported to window");
  check(mainJs.includes("durationSeconds: bs.durationSeconds"), "syncUserInterviewSessions maps backend durationSeconds");
  check(mainJs.includes("durationSeconds: gs.durationSeconds"), "syncUserInterviewSessions maps guest durationSeconds");
}

// -------------------------------------------------------------
// SECTION 3: BACKEND C# SOURCE CONTRACT AUDIT
// -------------------------------------------------------------
function runBackendSourceAudit() {
  console.log("\n--- SECTION 3: BACKEND C# SOURCE CONTRACT AUDIT ---");

  const sessionCs = fs.readFileSync(path.join(WORKSPACE_ROOT, "BE/Models/Interview/Session.cs"), "utf8");
  check(sessionCs.includes("public int? DurationSeconds"), "BE/Models/Interview/Session.cs declares DurationSeconds");
  check(sessionCs.includes("public int? Duration"), "BE/Models/Interview/Session.cs declares Duration in minutes");
  check(sessionCs.includes("public string? CompletedAt"), "BE/Models/Interview/Session.cs declares CompletedAt");
  check(sessionCs.includes("(end - start).TotalSeconds"), "Session.cs computes duration from timestamp difference without fabricating defaults");

  const sessionsControllerCs = fs.readFileSync(path.join(WORKSPACE_ROOT, "BE/Controllers/SessionsController.cs"), "utf8");
  check(sessionsControllerCs.includes("durationSeconds = s.DurationSeconds"), "SessionsController maps durationSeconds for guest sessions");
  check(sessionsControllerCs.includes("completedAt = s.CompletedAt"), "SessionsController maps completedAt for guest sessions");

  const reportServiceCs = fs.readFileSync(path.join(WORKSPACE_ROOT, "BE/Services/Interview/InterviewReportService.cs"), "utf8");
  check(reportServiceCs.includes("session.CompletedAt = nowUtc.ToString(\"o\");"), "InterviewReportService sets CompletedAt on session finish");
  check(reportServiceCs.includes("session.DurationSeconds ="), "InterviewReportService computes DurationSeconds on session finish");

  const orchestratorCs = fs.readFileSync(path.join(WORKSPACE_ROOT, "BE/Services/Interview/InterviewStageOrchestrator.cs"), "utf8");
  check(orchestratorCs.includes("session.CompletedAt = state.StageCompletedAt.Value.ToString(\"o\");"), "InterviewStageOrchestrator records CompletedAt on stage completion");
}

// -------------------------------------------------------------
// SECTION 4: INTEGRATION TEST WITH ISOLATED BACKEND SERVER
// -------------------------------------------------------------
async function runIntegrationBackendTest() {
  console.log("\n--- SECTION 4: ISOLATED BACKEND API VERIFICATION ---");

  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  if (!fs.existsSync(TEST_KEYRING)) fs.mkdirSync(TEST_KEYRING, { recursive: true });

  // Clone from production DB to preserve valid schema
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);
  const rawDb = JSON.parse(fs.readFileSync(TEST_DB_PATH, "utf8"));
  if (!rawDb.Sessions) rawDb.Sessions = {};

  const guest = mintGuestToken(TEST_GUEST_SECRET);
  const testUserId = "user_001"; // Alice in seed fixture

  // Pre-seed test sessions
  rawDb.Sessions["sess_user_dur_1"] = {
    Id: "sess_user_dur_1",
    UserId: testUserId,
    JobTitle: "Frontend Engineer",
    Company: "TechCorp",
    Status: "completed",
    StartedAt: "2026-03-30T10:00:00.000Z",
    CompletedAt: "2026-03-30T10:12:45.000Z",
    DurationSeconds: 765,
    CreatedAt: "2026-03-30T09:59:00.000Z"
  };

  rawDb.Sessions["sess_user_dur_2"] = {
    Id: "sess_user_dur_2",
    UserId: testUserId,
    JobTitle: "Backend Engineer",
    Company: "CloudGlobal",
    Status: "completed",
    StartedAt: "2026-03-30T11:00:00.000Z",
    CompletedAt: "2026-03-30T11:45:00.000Z",
    DurationSeconds: 2700,
    CreatedAt: "2026-03-30T10:58:00.000Z"
  };

  rawDb.Sessions["sess_guest_dur_1"] = {
    Id: "sess_guest_dur_1",
    UserId: guest.guestId,
    OriginalGuestId: guest.guestId,
    JobTitle: "Fullstack Engineer",
    Company: "GuestCorp",
    Status: "completed",
    StartedAt: "2026-03-30T14:00:00.000Z",
    CompletedAt: "2026-03-30T14:15:00.000Z",
    DurationSeconds: 900,
    CreatedAt: "2026-03-30T13:58:00.000Z"
  };

  rawDb.Sessions["sess_in_progress"] = {
    Id: "sess_in_progress",
    UserId: testUserId,
    JobTitle: "DevOps Engineer",
    Company: "InfraCorp",
    Status: "in_progress",
    StartedAt: "2026-03-30T12:00:00.000Z",
    CreatedAt: "2026-03-30T12:00:00.000Z"
  };

  fs.writeFileSync(TEST_DB_PATH, JSON.stringify(rawDb, null, 2), "utf8");

  const beDir = path.join(WORKSPACE_ROOT, "BE");
  const dllPath = path.join(beDir, "bin", "Debug", "net10.0", "backend.dll");

  const backendProc = spawn("dotnet", [dllPath, "--urls", BASE_URL], {
    cwd: beDir,
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

  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        const ping = await requestJson(`${BASE_URL}/api/sessions/quota`);
        if (ping.status === 200 || ping.status === 401) {
          ready = true;
          break;
        }
      } catch (e) {}
    }

    check(ready, "Isolated test backend online");

    // Authenticate as registered user (user_001)
    const loginRes = await requestJson(`${BASE_URL}/api/auth/login`, { method: "POST" }, {
      email: "nam.le@gmail.com",
      password: "user123"
    });
    check(loginRes.status === 200, "Registered user authenticated successfully");
    const userToken = loginRes.body?.token;

    // Test 1: Fetch user sessions via /api/sessions/user/{userId} with Auth
    const userRes = await requestJson(`${BASE_URL}/api/sessions/user/${testUserId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    check(userRes.status === 200, "GET /api/sessions/user/{userId} returns 200 OK");
    check(Array.isArray(userRes.body), "Response is an array of sessions");

    const s1 = userRes.body.find((s) => (s.id || s.Id) === "sess_user_dur_1");
    check(s1 !== undefined, "Found sess_user_dur_1");
    check((s1?.durationSeconds ?? s1?.DurationSeconds) === 765, "Session 1 durationSeconds is exactly 765s");
    check((s1?.duration ?? s1?.Duration) === 13, "Session 1 duration in minutes is 13 (765/60 rounded up)");
    check((s1?.completedAt ?? s1?.CompletedAt) === "2026-03-30T10:12:45.000Z", "Session 1 has exact completedAt");

    const s2 = userRes.body.find((s) => (s.id || s.Id) === "sess_user_dur_2");
    check(s2 !== undefined, "Found sess_user_dur_2");
    check((s2?.durationSeconds ?? s2?.DurationSeconds) === 2700, "Session 2 durationSeconds is exactly 2700s");
    check((s2?.duration ?? s2?.Duration) === 45, "Session 2 duration in minutes is 45");

    const s3 = userRes.body.find((s) => (s.id || s.Id) === "sess_in_progress");
    check(s3 !== undefined, "Found sess_in_progress");
    check((s3?.durationSeconds ?? s3?.DurationSeconds) === null || (s3?.durationSeconds ?? s3?.DurationSeconds) === undefined, "In-progress session has null durationSeconds");
    check((s3?.duration ?? s3?.Duration) === null || (s3?.duration ?? s3?.Duration) === undefined, "In-progress session has null duration");

    // Test 2: Fetch guest history via /api/sessions/guest with Token
    const guestRes = await requestJson(`${BASE_URL}/api/sessions/guest`, {
      headers: { Cookie: `pm_guest_token=${guest.token}`, "X-Guest-Token": guest.token }
    });
    check(guestRes.status === 200, "GET /api/sessions/guest returns 200 OK");
    check(Array.isArray(guestRes.body), "Guest response is an array of sessions");
    const gs = guestRes.body.find((s) => (s.id || s.Id) === "sess_guest_dur_1");
    check(gs !== undefined, "Found guest session sess_guest_dur_1");
    check((gs?.durationSeconds ?? gs?.DurationSeconds) === 900, "Guest session durationSeconds is 900s");
    check((gs?.duration ?? gs?.Duration) === 15, "Guest session duration in minutes is 15");
    check((gs?.completedAt ?? gs?.CompletedAt) === "2026-03-30T14:15:00.000Z", "Guest session completedAt preserved");

  } catch (err) {
    check(false, `Backend integration test error: ${err.message}`);
  } finally {
    if (backendProc) {
      backendProc.kill("SIGKILL");
      try {
        process.kill(backendProc.pid);
      } catch (e) {}
    }
    // Clean up temporary test files
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      if (fs.existsSync(TEST_KEYRING)) fs.rmSync(TEST_KEYRING, { recursive: true, force: true });
      if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }
}

// -------------------------------------------------------------
// SECTION 5: DATABASE IMMUTABILITY VERIFICATION
// -------------------------------------------------------------
function runDatabaseIntegrityCheck() {
  console.log("\n--- SECTION 5: DATABASE IMMUTABILITY VERIFICATION ---");
  const currentDbContent = fs.readFileSync(PROD_DB_PATH);
  const currentHash = crypto.createHash("sha256").update(currentDbContent).digest("hex").toUpperCase();
  check(currentHash === BASELINE_DB_HASH, `Production db.json SHA-256 matches baseline (${currentHash.slice(0, 16)}...)`);
}

// -------------------------------------------------------------
// MAIN RUNNER
// -------------------------------------------------------------
async function runAll() {
  console.log("================================================================================");
  console.log("  PREPMATE — WI-INTERVIEW-DURATION-AGGREGATION-01 REGRESSION SUITE");
  console.log("================================================================================");

  runUnitFormattingTests();
  runFrontendSourceAudit();
  runBackendSourceAudit();
  await runIntegrationBackendTest();
  runDatabaseIntegrityCheck();

  console.log("\n================================================================================");
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
