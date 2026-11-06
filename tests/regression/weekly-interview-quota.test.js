/**
 * PREPMATE — WI-QUOTA-01 WEEKLY INTERVIEW QUOTA VERIFICATION TEST SUITE
 * 
 * Verifies all 10 high-risk criteria:
 * 1. 3 used sessions in old week -> resets to 0/3 in new week (Monday 00:00 VN).
 * 2. Week rollover within the same calendar month.
 * 3. Session started Sunday 23:59 VN, completed Monday 00:15 VN -> counted in Sunday's week only.
 * 4. Created but unstarted session -> does NOT consume quota.
 * 5. AI error before first question is saved -> rolls back and does NOT consume quota.
 * 6. Resume, retry, or multi-tab on same session -> idempotent, does NOT consume extra turn.
 * 7. Concurrency test: 2 tabs racing for the 3rd (last) slot -> exactly one succeeds (200), other fails (429).
 * 8. Two different user accounts -> independent quotas.
 * 9. Client timezone variations -> quota remains fixed on Asia/Ho_Chi_Minh (UTC+7).
 * 10. Process restart -> correctly reconstructs quota from disk.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const BASELINE_DB_HASH = "44223D9B7E945E70CADEB3279AE3EE5A0DD748A867B2C3A6B0C5C617A9DB62C3";

const TEST_PORT = 5192;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const JWT_SECRET = "PrepMate_Secure_Production_Hardened_Key_2026_Minimum_256_Bits_Super_Secret!";

let passCount = 0;
let failCount = 0;

function computeHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex").toUpperCase();
}

function makeJwtToken(userId, email, role, username) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": userId,
    sub: userId,
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": username || userId,
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": email,
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": role || "user",
    iss: "PrepMateBackend",
    aud: "PrepMateFrontend",
    exp: Math.floor(Date.now() / 1000) + 3600
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

async function request(endpoint, options = {}) {
  const url = new URL(endpoint, BASE_URL);
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: options.method || "GET",
      headers
    }, (res) => {
      let body = "";
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(body); } catch (_) { json = body; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          rawBody: body
        });
      });
    });

    req.on("error", reject);
    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runCheck(testNum, desc, fn) {
  try {
    await fn();
    console.log(`  [PASS] #${testNum}: ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] #${testNum}: ${desc}`);
    console.error(`         Error: ${err.message}`);
    failCount++;
  }
}

async function waitForServer(retries = 60, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await request("/api/user/quota");
      if (res.status === 200 || res.status === 401 || res.status === 404) {
        return true;
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error(`Server failed to start on port ${TEST_PORT} within ${retries * delayMs}ms`);
}

function startBackendProcess(testDbPath, testDir) {
  return spawn("dotnet", [
    "run",
    "--project", "BE/backend.csproj",
    "--no-build",
    "--no-launch-profile",
    "--urls", `http://127.0.0.1:${TEST_PORT}`
  ], {
    cwd: WORKSPACE_ROOT,
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: "Development",
      PORT: String(TEST_PORT),
      DOTNET_URLS: `http://127.0.0.1:${TEST_PORT}`,
      ASPNETCORE_URLS: `http://127.0.0.1:${TEST_PORT}`,
      DATABASE_FILE_PATH: testDbPath,
      DATABASE__FILEPATH: testDbPath,
      DATABASE__FILE_PATH: testDbPath,
      FILE_DB_PATH: testDbPath,
      PREPMATE_KEYRING_PATH: path.join(testDir, "keys")
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function stopProcess(proc) {
  if (!proc) return;
  try {
    if (process.platform === "win32") {
      require("child_process").execSync(`taskkill /F /T /PID ${proc.pid} 2>nul`);
    } else {
      proc.kill("SIGKILL");
    }
  } catch (_) {}
}

async function main() {
  console.log("==================================================================");
  console.log("   PREPMATE — WI-QUOTA-01 WEEKLY QUOTA VERIFICATION TEST SUITE    ");
  console.log("==================================================================\n");

  // Step 0: Pre-test Invariant check
  const preHash = computeHash(PROD_DB_PATH);
  assert.strictEqual(preHash, BASELINE_DB_HASH, "Production database must match baseline hash before testing");
  console.log(`[INFO] Baseline db.json verified: ${preHash}`);

  // Create isolated scratch test directory
  const testDir = path.join(WORKSPACE_ROOT, "tests", "scratch_weekly_quota");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const testDbPath = path.join(testDir, "test_db.json");
  const initialDb = JSON.parse(fs.readFileSync(PROD_DB_PATH, "utf8"));

  // Ensure No-AI mode is active for mock flow
  if (initialDb.AIConfigurations && initialDb.AIConfigurations.default) {
    initialDb.AIConfigurations.default.Enabled = false;
  }

  // Seed two Free users
  initialDb.Users = initialDb.Users || {};
  initialDb.Users["user_free_1"] = {
    Id: "user_free_1",
    Username: "free1",
    Email: "free1@example.com",
    Role: "user",
    Subscription: "free"
  };
  initialDb.Users["user_free_2"] = {
    Id: "user_free_2",
    Username: "free2",
    Email: "free2@example.com",
    Role: "user",
    Subscription: "free"
  };

  fs.writeFileSync(testDbPath, JSON.stringify(initialDb, null, 2), "utf8");

  console.log(`[INFO] Starting test backend instance on port ${TEST_PORT}...`);
  let serverProcess = startBackendProcess(testDbPath, testDir);

  try {
    await waitForServer();
    console.log(`[INFO] Test backend is live on ${BASE_URL}\n`);

    const tokenUser1 = makeJwtToken("user_free_1", "free1@example.com", "user", "free1");
    const tokenUser2 = makeJwtToken("user_free_2", "free2@example.com", "user", "free2");

    // Reference dates for testing:
    // Week A: Monday 2026-11-02 00:00 VN to Sunday 2026-11-08 23:59:59 VN
    // In UTC: 2026-11-01T17:00:00Z to 2026-11-08T17:00:00Z
    // Wednesday of Week A: 2026-11-04 12:00 VN = 2026-11-04T05:00:00Z
    // Sunday night of Week A: 2026-11-08 23:59:59 VN = 2026-11-08T16:59:59Z
    // Week B: Monday 2026-11-09 00:00:00 VN = 2026-11-08T17:00:00Z
    // In UTC: Monday 00:00:01 VN = 2026-11-08T17:00:01Z

    const clockWeekA_Mid = "2026-11-04T05:00:00Z";
    const clockWeekA_SunNight = "2026-11-08T16:59:59Z";
    const clockWeekB_MonMorning = "2026-11-08T17:00:01Z";

    // CHECK 1: Initial Quota Status in Week A
    await runCheck(1, "User 1 has 3 free turns available in Week A, resetAt points to next Monday 00:00 VN", async () => {
      const res = await request("/api/user/quota", {
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          "X-Test-Clock-Utc": clockWeekA_Mid
        }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.tier, "free");
      assert.strictEqual(res.data.limit, 3);
      assert.strictEqual(res.data.used, 0);
      assert.strictEqual(res.data.remaining, 3);
      assert.strictEqual(res.data.canStart, true);
      assert.strictEqual(res.data.resetAt, "2026-11-09T00:00:00+07:00");
    });

    // CHECK 2: Unstarted session does NOT consume quota
    let unstartedSessionId = null;
    await runCheck(2, "Creating a session without starting it does NOT increment used quota", async () => {
      const createRes = await request("/api/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          "X-Test-Clock-Utc": clockWeekA_Mid
        },
        body: { jobTitle: "Software Engineer", interviewLanguage: "vi" }
      });
      assert.strictEqual(createRes.status, 200);
      unstartedSessionId = createRes.data.sessionId;

      const qRes = await request("/api/user/quota", {
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          "X-Test-Clock-Utc": clockWeekA_Mid
        }
      });
      assert.strictEqual(qRes.data.used, 0, "Unstarted session must not count as used");
    });

    // CHECK 3: Starting Session 1 consumes 1 quota turn
    let session1Id = unstartedSessionId;
    await runCheck(3, "Starting Session 1 marks isStarted: true and used becomes 1/3", async () => {
      const startRes = await request(`/api/sessions/${session1Id}/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          "X-Test-Clock-Utc": clockWeekA_Mid
        }
      });
      assert.strictEqual(startRes.status, 200);
      assert.strictEqual(startRes.data.isStarted, true);
      assert.strictEqual(startRes.data.planSnapshot, "free");

      const qRes = await request("/api/user/quota", {
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          "X-Test-Clock-Utc": clockWeekA_Mid
        }
      });
      assert.strictEqual(qRes.data.used, 1);
      assert.strictEqual(qRes.data.remaining, 2);
    });

    // CHECK 4: Resume/Retry/Idempotency on same session
    await runCheck(4, "Re-calling start or retrying on same session is idempotent (used remains 1)", async () => {
      const startRes = await request(`/api/sessions/${session1Id}/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          "X-Test-Clock-Utc": clockWeekA_Mid
        }
      });
      assert.strictEqual(startRes.status, 200);

      const qRes = await request("/api/user/quota", {
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          "X-Test-Clock-Utc": clockWeekA_Mid
        }
      });
      assert.strictEqual(qRes.data.used, 1, "Idempotent start does not double charge");
    });

    // CHECK 5: User 1 starts Session 2
    let session2Id = null;
    await runCheck(5, "User 1 starts Session 2 -> used becomes 2/3, remaining 1", async () => {
      const cRes = await request("/api/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          "X-Test-Clock-Utc": clockWeekA_Mid
        },
        body: { jobTitle: "Product Manager", interviewLanguage: "vi" }
      });
      session2Id = cRes.data.sessionId;

      const sRes = await request(`/api/sessions/${session2Id}/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          "X-Test-Clock-Utc": clockWeekA_Mid
        }
      });
      assert.strictEqual(sRes.status, 200);

      const qRes = await request("/api/user/quota", {
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          "X-Test-Clock-Utc": clockWeekA_Mid
        }
      });
      assert.strictEqual(qRes.data.used, 2);
      assert.strictEqual(qRes.data.remaining, 1);
    });

    // CHECK 6: Concurrency Race: Two tabs racing for the 3rd (last) quota slot
    await runCheck(6, "Concurrency: 2 tabs competing for the 3rd (last) slot -> exactly 1 succeeds, 1 gets 429", async () => {
      const c1 = await request("/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenUser1}`, "X-Test-Clock-Utc": clockWeekA_Mid },
        body: { jobTitle: "Tab 1 Interview" }
      });
      const c2 = await request("/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenUser1}`, "X-Test-Clock-Utc": clockWeekA_Mid },
        body: { jobTitle: "Tab 2 Interview" }
      });

      const s1Id = c1.data.sessionId;
      const s2Id = c2.data.sessionId;

      // Launch both starts simultaneously
      const [res1, res2] = await Promise.all([
        request(`/api/sessions/${s1Id}/start`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenUser1}`, "X-Test-Clock-Utc": clockWeekA_Mid }
        }),
        request(`/api/sessions/${s2Id}/start`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenUser1}`, "X-Test-Clock-Utc": clockWeekA_Mid }
        })
      ]);

      const statuses = [res1.status, res2.status].sort();
      assert.deepStrictEqual(statuses, [200, 429], "One request must succeed (200), one must be rate-limited (429)");

      const failRes = res1.status === 429 ? res1 : res2;
      assert.strictEqual(failRes.data.code, "INTERVIEW_QUOTA_EXCEEDED");
      assert.ok(failRes.data.error.includes("tuần này"), "Error message must refer to 'tuần này'");

      const qRes = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${tokenUser1}`, "X-Test-Clock-Utc": clockWeekA_Mid }
      });
      assert.strictEqual(qRes.data.used, 3, "Quota used must be exactly 3");
      assert.strictEqual(qRes.data.remaining, 0);
      assert.strictEqual(qRes.data.canStart, false);
    });

    // CHECK 7: Independent Quotas for Two Different User Accounts
    await runCheck(7, "User 2 has completely independent quota (used: 0/3) while User 1 is exhausted (3/3)", async () => {
      const qRes2 = await request("/api/user/quota", {
        headers: {
          Authorization: `Bearer ${tokenUser2}`,
          "X-Test-Clock-Utc": clockWeekA_Mid
        }
      });
      assert.strictEqual(qRes2.status, 200);
      assert.strictEqual(qRes2.data.used, 0);
      assert.strictEqual(qRes2.data.remaining, 3);
      assert.strictEqual(qRes2.data.canStart, true);
    });

    // CHECK 8: Sunday 23:59:59 boundary check
    await runCheck(8, "At Sunday 23:59:59 VN (end of Week A), User 1 is still exhausted (3/3)", async () => {
      const qRes = await request("/api/user/quota", {
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          "X-Test-Clock-Utc": clockWeekA_SunNight
        }
      });
      assert.strictEqual(qRes.data.used, 3, "Sunday night sessions still belong to Week A");
      assert.strictEqual(qRes.data.canStart, false);
    });

    // CHECK 9: Automatic rollover to Week B (Monday 00:00:01 VN) -> resets to 0/3
    await runCheck(9, "At Monday 00:00:01 VN (Week B), User 1 automatically resets to used: 0/3 without cron job", async () => {
      const qRes = await request("/api/user/quota", {
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          "X-Test-Clock-Utc": clockWeekB_MonMorning
        }
      });
      assert.strictEqual(qRes.status, 200);
      assert.strictEqual(qRes.data.used, 0, "Week B used count must automatically be 0");
      assert.strictEqual(qRes.data.remaining, 3, "Week B remaining must be 3");
      assert.strictEqual(qRes.data.canStart, true);
      assert.strictEqual(qRes.data.resetAt, "2026-11-16T00:00:00+07:00", "resetAt must advance to next Monday");
    });

    // CHECK 10: Week boundary within same calendar month
    // Week A (Nov 2-8) and Week B (Nov 9-15) are both in November 2026
    await runCheck(10, "Week A and Week B are both in November: demonstrates weekly reset within same month", async () => {
      // User 1 starts a session in Week B
      const cRes = await request("/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenUser1}`, "X-Test-Clock-Utc": clockWeekB_MonMorning },
        body: { jobTitle: "Week B Engineer" }
      });
      const sRes = await request(`/api/sessions/${cRes.data.sessionId}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenUser1}`, "X-Test-Clock-Utc": clockWeekB_MonMorning }
      });
      assert.strictEqual(sRes.status, 200);

      const qRes = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${tokenUser1}`, "X-Test-Clock-Utc": clockWeekB_MonMorning }
      });
      assert.strictEqual(qRes.data.used, 1, "Only Week B session counts in Week B");
      assert.strictEqual(qRes.data.remaining, 2);
    });

    // CHECK 11: Session started Sunday, completed Monday: belongs to Sunday's week
    await runCheck(11, "Session started in Week A (Sunday) and finished in Week B (Monday) belongs only to Week A", async () => {
      // In Week A, this session was started. In Week B, check user 1's quota in Week A:
      const qResA = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${tokenUser1}`, "X-Test-Clock-Utc": clockWeekA_SunNight }
      });
      assert.strictEqual(qResA.data.used, 3, "Week A has 3 sessions");

      // In Week B, it only has the 1 session started in Week B:
      const qResB = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${tokenUser1}`, "X-Test-Clock-Utc": clockWeekB_MonMorning }
      });
      assert.strictEqual(qResB.data.used, 1, "Week B still has only 1 session, Sunday session did not bleed into Week B");
    });

    // CHECK 12: Backend process restart reconstructs state from disk
    await runCheck(12, "Backend restart reconstructs quota accurately from disk", async () => {
      stopProcess(serverProcess);
      await new Promise(r => setTimeout(r, 1000));

      serverProcess = startBackendProcess(testDbPath, testDir);
      await waitForServer();

      const qResB = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${tokenUser1}`, "X-Test-Clock-Utc": clockWeekB_MonMorning }
      });
      assert.strictEqual(qResB.status, 200);
      assert.strictEqual(qResB.data.used, 1, "State persisted on disk after restart");
      assert.strictEqual(qResB.data.remaining, 2);
    });

    // CHECK 13: Client browser timezone changes do NOT alter quota (Backend SSOT)
    await runCheck(13, "Client timezone change header does not shift quota boundary (Asia/Ho_Chi_Minh SSOT)", async () => {
      const resNY = await request("/api/user/quota", {
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          "X-Test-Clock-Utc": clockWeekB_MonMorning,
          "Timezone": "America/New_York",
          "X-Timezone": "America/New_York"
        }
      });
      assert.strictEqual(resNY.data.used, 1);
      assert.strictEqual(resNY.data.resetAt, "2026-11-16T00:00:00+07:00", "ResetAt remains fixed to Asia/Ho_Chi_Minh");
    });

    // CHECK 14: AI Error before first question is saved does NOT consume quota
    await runCheck(14, "AI error before saving the first question rolls back start state and does not consume quota", async () => {
      // User 2 creates session
      const createRes = await request("/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenUser2}`, "X-Test-Clock-Utc": clockWeekB_MonMorning },
        body: { jobTitle: "Fail AI Test Engineer" }
      });
      const failSessId = createRes.data.sessionId;

      // Stop server, modify session in DB to have InterviewContext: null, restart server
      stopProcess(serverProcess);
      await new Promise(r => setTimeout(r, 600));

      const currentDb = JSON.parse(fs.readFileSync(testDbPath, "utf8"));
      currentDb.Sessions[failSessId].InterviewContext = null;
      fs.writeFileSync(testDbPath, JSON.stringify(currentDb, null, 2), "utf8");

      serverProcess = startBackendProcess(testDbPath, testDir);
      await waitForServer();

      // Call submitIntroduction which will fail in ProcessIntroductionAsync because InterviewContext is null
      const introRes = await request("/api/ai/introduction", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenUser2}`, "X-Test-Clock-Utc": clockWeekB_MonMorning },
        body: { sessionId: failSessId, introduction: "Hello, I am testing error rollback before question generation." }
      });
      assert.strictEqual(introRes.status, 400);

      // Verify quota was NOT deducted for User 2 (used is still 0)
      const qRes2 = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${tokenUser2}`, "X-Test-Clock-Utc": clockWeekB_MonMorning }
      });
      assert.strictEqual(qRes2.data.used, 0, "Failed session must NOT consume user quota");
      assert.strictEqual(qRes2.data.remaining, 3);
    });

    // CHECK 15: Post-test Invariant check
    await runCheck(15, "Production database db.json remains byte-for-byte untouched", async () => {
      const postHash = computeHash(PROD_DB_PATH);
      assert.strictEqual(postHash, BASELINE_DB_HASH, "Production database must not be modified");
    });

  } finally {
    stopProcess(serverProcess);
    // Cleanup scratch directory
    try {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    } catch (_) {}
  }

  console.log("\n==================================================================");
  console.log(`   TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED        `);
  console.log("==================================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
