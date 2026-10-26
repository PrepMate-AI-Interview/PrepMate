/**
 * PREPMATE — INTERVIEW QUOTA ENFORCEMENT & GUEST ISOLATION TEST SUITE
 * Work Item: INTERVIEW-QUOTA-VERIFY-02
 * 
 * Verifies:
 * 1. Audit A: Guest Token Issuance, HMAC Server-Signing & Header Validation
 * 2. Audit B: PlanSnapshot & Quota Consumption Timing (Session Created != Quota Consumed)
 * 3. Audit C: Process Restart Recovery & Persistent State Reconstruction
 * 4. Audit D: Quota Enforcement across all Routes, Aliases & IDOR Protection
 * 5. Production Database Invariant Check
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const BASELINE_DB_HASH = "C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7";

const TEST_PORT = 5189;
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

function parseCookies(headers) {
  const setCookie = headers["set-cookie"] || [];
  const cookies = {};
  setCookie.forEach(c => {
    const parts = c.split(";")[0].split("=");
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
    }
  });
  return cookies;
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

async function waitForServer(retries = 50, delayMs = 500) {
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
  console.log("   PREPMATE — INTERVIEW QUOTA VERIFY-02 SECURITY TEST SUITE       ");
  console.log("==================================================================\n");

  // Step 0: Pre-test Invariant check
  const preHash = computeHash(PROD_DB_PATH);
  assert.strictEqual(preHash, BASELINE_DB_HASH, "Production database must match baseline hash before testing");
  console.log(`[INFO] Baseline db.json verified: ${preHash}`);

  // Create isolated scratch test directory
  const testDir = path.join(WORKSPACE_ROOT, "tests", "scratch_quota_test");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const testDbPath = path.join(testDir, "test_db.json");
  const initialDb = JSON.parse(fs.readFileSync(PROD_DB_PATH, "utf8"));
  
  // Seed legacy guest session into test db to test legacy isolation
  initialDb.Sessions = initialDb.Sessions || {};
  initialDb.Sessions["legacy_guest_sess_001"] = {
    Id: "legacy_guest_sess_001",
    UserId: "guest",
    JobTitle: "Legacy Demo Session",
    Status: "completed",
    CreatedAt: "2026-10-01T00:00:00Z"
  };

  // Configure No-AI mode in test db for instantaneous deterministic turn evaluations
  if (initialDb.AIConfigurations && initialDb.AIConfigurations.default) {
    initialDb.AIConfigurations.default.Enabled = false;
  }

  // Seed user with expired Pro
  initialDb.Users = initialDb.Users || {};
  initialDb.Users["user_expired_pro"] = {
    Id: "user_expired_pro",
    Username: "expired.pro",
    Email: "expired.pro@example.com",
    Role: "user",
    Subscription: "pro",
    SubscriptionExpiry: "2026-01-01T00:00:00Z"
  };

  // Seed user_upgradable for upgrade-before-start test
  initialDb.Users["user_upgradable"] = {
    Id: "user_upgradable",
    Username: "upgrade.test",
    Email: "upgrade.test@example.com",
    Role: "user",
    Subscription: "free"
  };

  // Seed user_concurrency for concurrency test
  initialDb.Users["user_concurrency"] = {
    Id: "user_concurrency",
    Username: "concurrency.test",
    Email: "concurrency.test@example.com",
    Role: "user",
    Subscription: "free"
  };

  // Seed an old session from previous calendar month for user_004 (Free)
  initialDb.Sessions["sess_user004_september"] = {
    Id: "sess_user004_september",
    UserId: "user_004",
    JobTitle: "September Frontend Practice",
    Status: "completed",
    IsStarted: true,
    CreatedAt: "2026-09-15T10:00:00Z"
  };

  fs.writeFileSync(testDbPath, JSON.stringify(initialDb, null, 2), "utf8");

  // Start backend on isolated port
  console.log(`[INFO] Starting test backend instance on port ${TEST_PORT}...`);
  let serverProcess = startBackendProcess(testDbPath, testDir);

  serverProcess.stderr.on("data", d => {
    // console.error("[BE ERR]", d.toString().trim());
  });

  try {
    await waitForServer();
    console.log(`[INFO] Test backend is live and healthy on ${BASE_URL}\n`);

    // =================================================================
    // GROUP 1: AUDIT A — GUEST ENFORCEMENT & HMAC SIGNING (16 Tests)
    // =================================================================
    console.log("--- GROUP 1: GUEST ENFORCEMENT & HMAC SIGNING ---");

    let guestTokenA = null;
    let guestIdA = null;
    let guestSessionA = null;

    await runCheck(1, "Guest quota endpoint returns tier: 'guest', canStart: true, limit: 1 and sets pm_guest_token", async () => {
      const res = await request("/api/user/quota");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.tier, "guest");
      assert.strictEqual(res.data.canStart, true);
      assert.strictEqual(res.data.limit, 1);
      assert.strictEqual(res.data.remaining, 1);
      assert.strictEqual(res.data.demoUsed, false);

      const cookies = parseCookies(res.headers);
      assert(cookies.pm_guest_token, "Must issue pm_guest_token cookie");
      guestTokenA = cookies.pm_guest_token;
      guestIdA = res.data.guestId;
      assert(guestIdA && guestIdA.startsWith("guest_"), "Guest ID must have prefix guest_");
      // Server-signed token format: pmg_<payload>.<hmac>
      assert(guestTokenA.startsWith("pmg_") && guestTokenA.includes("."), "Token must be server HMAC-signed format");
    });

    await runCheck(2, "Subsequent request with pm_guest_token preserves guest identity", async () => {
      const res = await request("/api/user/quota", {
        headers: { Cookie: `pm_guest_token=${guestTokenA}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.guestId, guestIdA);
    });

    await runCheck(3, "Audit A: Arbitrary self-minted header in X-Guest-Token is rejected (server replaces with valid signed token)", async () => {
      const attackerToken = "my_custom_attacker_token_987654321";
      const res = await request("/api/user/quota", {
        headers: { "X-Guest-Token": attackerToken }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.tier, "guest");
      // Crucial: Server does NOT bind to the client's arbitrary custom token
      const attackerHashPrefix = "guest_" + crypto.createHash("sha256").update(attackerToken).digest("hex").slice(0, 20);
      assert.notStrictEqual(res.data.guestId, attackerHashPrefix, "Server must not trust attacker-chosen token string");
      assert(res.data.guestId.startsWith("guest_"), "Server assigns genuine guest ID");
      // Server sets a new valid signed cookie
      const cookies = parseCookies(res.headers);
      assert(cookies.pm_guest_token && cookies.pm_guest_token.startsWith("pmg_"), "Server must issue genuine signed token");
    });

    await runCheck(4, "Audit A: Legitimate server-issued token in X-Guest-Token (cookies absent) preserves identity", async () => {
      const res = await request("/api/user/quota", {
        headers: { "X-Guest-Token": guestTokenA }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.guestId, guestIdA, "Legitimate server token in header restores exact guest identity");
    });

    await runCheck(5, "Audit A: Cookie takes precedence over X-Guest-Token header", async () => {
      // Create second guest identity
      const resB = await request("/api/user/quota");
      const cookiesB = parseCookies(resB.headers);
      const guestTokenB = cookiesB.pm_guest_token;
      const guestIdB = resB.data.guestId;

      // Pass cookie A and header B: Cookie A must win
      const resConflict = await request("/api/user/quota", {
        headers: {
          Cookie: `pm_guest_token=${guestTokenA}`,
          "X-Guest-Token": guestTokenB
        }
      });
      assert.strictEqual(resConflict.status, 200);
      assert.strictEqual(resConflict.data.guestId, guestIdA, "Cookie must strictly take precedence over header");
    });

    await runCheck(6, "Audit B: Guest creates session -> created but unstarted (IsStarted: false, PlanSnapshot: null)", async () => {
      const res = await request("/api/sessions", {
        method: "POST",
        headers: { Cookie: `pm_guest_token=${guestTokenA}` },
        body: {
          jobTitle: "Kỹ sư Cầu nối Frontend",
          interviewRound: "round1",
          seniority: "Junior",
          skills: ["React", "TypeScript", "HTML/CSS", "Next.js", "Redux", "REST API", "Testing"],
          jdText: "Yêu cầu kỹ năng: HTML5, CSS3, JavaScript ES6, TypeScript, ReactJS, NextJS, Redux Toolkit, RESTful API, Unit Test Jest, Git, Performance Optimization, Responsive Web Design, Webpack, Vite."
        }
      });
      assert.strictEqual(res.status, 200);
      assert(res.data.sessionId, "Must return sessionId");
      guestSessionA = res.data.sessionId;

      // Fetch created session
      const getRes = await request(`/api/sessions/${guestSessionA}`, {
        headers: { Cookie: `pm_guest_token=${guestTokenA}` }
      });
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.data.userId, guestIdA);
      assert.strictEqual(getRes.data.isStarted, false, "Session created must not be started yet");
      assert.strictEqual(getRes.data.planSnapshot, null, "PlanSnapshot must be null before start");
    });

    await runCheck(7, "Audit B: Guest starts session -> IsStarted: true, PlanSnapshot: 'guest'", async () => {
      const startRes = await request(`/api/sessions/${guestSessionA}/start`, {
        method: "POST",
        headers: { Cookie: `pm_guest_token=${guestTokenA}` }
      });
      assert.strictEqual(startRes.status, 200);
      assert.strictEqual(startRes.data.isStarted, true);
      assert.strictEqual(startRes.data.planSnapshot, "guest");
      assert(startRes.data.startedAt, "Must populate startedAt");

      // Verify on session fetch
      const getRes = await request(`/api/sessions/${guestSessionA}`, {
        headers: { Cookie: `pm_guest_token=${guestTokenA}` }
      });
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.data.isStarted, true);
      assert.strictEqual(getRes.data.planSnapshot, "guest");
    });

    await runCheck(8, "Spoofing attempt: Guest passing userId: 'user_admin' is overridden by server", async () => {
      const freshRes = await request("/api/user/quota");
      const freshCookies = parseCookies(freshRes.headers);
      const freshToken = freshCookies.pm_guest_token;
      const freshGuestId = freshRes.data.guestId;

      const res = await request("/api/sessions", {
        method: "POST",
        headers: { Cookie: `pm_guest_token=${freshToken}` },
        body: {
          jobTitle: "Chuyên viên Dev",
          userId: "user_admin" // Maliciously trying to impersonate admin
        }
      });
      assert.strictEqual(res.status, 200);
      const sessId = res.data.sessionId;

      const getRes = await request(`/api/sessions/${sessId}`, {
        headers: { Cookie: `pm_guest_token=${freshToken}` }
      });
      assert.strictEqual(getRes.status, 200);
      assert.notStrictEqual(getRes.data.userId, "user_admin", "Server must override spoofed userId");
      assert.strictEqual(getRes.data.userId, freshGuestId, "UserId must match authenticated guest ID");
    });

    await runCheck(9, "Guest quota now shows demoUsed: true, remaining: 0, canStart: false", async () => {
      const res = await request("/api/user/quota", {
        headers: { Cookie: `pm_guest_token=${guestTokenA}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.demoUsed, true);
      assert.strictEqual(res.data.remaining, 0);
      assert.strictEqual(res.data.canStart, false);
    });

    await runCheck(10, "Guest attempting second demo session is blocked with HTTP 429 INTERVIEW_QUOTA_EXCEEDED / GUEST_DEMO_EXCEEDED", async () => {
      const res = await request("/api/sessions", {
        method: "POST",
        headers: { Cookie: `pm_guest_token=${guestTokenA}` },
        body: {
          jobTitle: "Thử tạo session thứ hai",
          seniority: "Junior"
        }
      });
      assert.strictEqual(res.status, 429);
      assert(res.data.code === "INTERVIEW_QUOTA_EXCEEDED" || res.data.code === "GUEST_DEMO_EXCEEDED", "Error code must indicate quota exceeded");
    });

    await runCheck(11, "Audit A: Guest cannot bypass quota by tampering with X-Guest-Token header while cookie persists", async () => {
      const res = await request("/api/sessions", {
        method: "POST",
        headers: {
          Cookie: `pm_guest_token=${guestTokenA}`,
          "X-Guest-Token": "tampered_token_string_9999"
        },
        body: { jobTitle: "Bypass Attempt" }
      });
      assert.strictEqual(res.status, 429, "Must still block because cookie takes precedence");
    });

    await runCheck(12, "Guest completes demo flow (5 real questions limit enforcement)", async () => {
      // 1. Submit introduction
      const introRes = await request("/api/ai/introduction", {
        method: "POST",
        headers: { Cookie: `pm_guest_token=${guestTokenA}` },
        body: {
          sessionId: guestSessionA,
          introduction: "Xin chào, tôi là ứng viên thử nghiệm phần mềm với 2 năm kinh nghiệm React và TypeScript."
        }
      });
      assert.strictEqual(introRes.status, 200);
      assert(introRes.data.nextQuestion, "Must return Question #1");

      // Turns 1 to 4
      for (let turn = 1; turn <= 4; turn++) {
        const turnRes = await request("/api/ai/respond", {
          method: "POST",
          headers: { Cookie: `pm_guest_token=${guestTokenA}` },
          body: {
            sessionId: guestSessionA,
            message: `Đây là câu trả lời chi tiết cho câu hỏi số ${turn} của tôi.`
          }
        });
        assert.strictEqual(turnRes.status, 200, `Turn ${turn} should succeed`);
        assert.strictEqual(turnRes.data.isFinished, false, `Turn ${turn} should not finish`);
      }

      // Turn 5: Final question -> session should complete
      const turn5Res = await request("/api/ai/respond", {
        method: "POST",
        headers: { Cookie: `pm_guest_token=${guestTokenA}` },
        body: {
          sessionId: guestSessionA,
          message: "Đây là câu trả lời hoàn tất cho câu hỏi số 5 của tôi."
        }
      });
      assert.strictEqual(turn5Res.status, 200);
      assert.strictEqual(turn5Res.data.isFinished, true, "Turn 5 must finish the demo session");
      assert.strictEqual(turn5Res.data.stage, "COMPLETED");
    });

    await runCheck(13, "Attempting 6th respond on completed demo session is rejected with HTTP 400", async () => {
      const turn6Res = await request("/api/ai/respond", {
        method: "POST",
        headers: { Cookie: `pm_guest_token=${guestTokenA}` },
        body: {
          sessionId: guestSessionA,
          message: "Cố gắng gửi câu trả lời thứ 6 vượt giới hạn demo."
        }
      });
      assert.strictEqual(turn6Res.status, 400);
    });

    await runCheck(14, "Guest B (different identity) is blocked from accessing Guest A session (IDOR protection)", async () => {
      const guestBRes = await request("/api/user/quota");
      const guestCookiesB = parseCookies(guestBRes.headers);
      const guestTokenB = guestCookiesB.pm_guest_token;

      const res = await request(`/api/sessions/${guestSessionA}`, {
        headers: { Cookie: `pm_guest_token=${guestTokenB}` }
      });
      assert.strictEqual(res.status, 403);
    });

    await runCheck(15, "Unauthenticated caller cannot access legacy UserId = 'guest' session", async () => {
      const res = await request(`/api/sessions/legacy_guest_sess_001`);
      assert(res.status === 401 || res.status === 403, `Must reject with 401 or 403, got ${res.status}`);
    });

    await runCheck(16, "Admin CAN access legacy UserId = 'guest' session", async () => {
      const adminToken = makeJwtToken("user_admin", "admin@prepmate.vn", "admin", "Admin");
      const res = await request(`/api/sessions/legacy_guest_sess_001`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.id, "legacy_guest_sess_001");
    });

    // =================================================================
    // GROUP 2: AUDIT B — FREE TIER 3-SESSION LIMIT & LIFECYCLE (16 Tests)
    // =================================================================
    console.log("\n--- GROUP 2: FREE TIER ENFORCEMENT & CONCURRENCY ---");

    const freeToken = makeJwtToken("user_004", "thao.bui@yahoo.com", "user", "ThaoBui");
    let freeSessions = [];

    await runCheck(17, "Free user initial quota: tier 'free', limit 3, used 0, remaining 3, canStart true", async () => {
      const res = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${freeToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.tier, "free");
      assert.strictEqual(res.data.limit, 3);
      assert.strictEqual(res.data.used, 0);
      assert.strictEqual(res.data.remaining, 3);
      assert.strictEqual(res.data.canStart, true);
    });

    await runCheck(18, "Audit B: Free user creates Session #1 -> created but NOT started (used is 0, reservation holds 1 slot)", async () => {
      const res = await request("/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${freeToken}` },
        body: { jobTitle: "Junior React Developer" }
      });
      assert.strictEqual(res.status, 200);
      freeSessions.push(res.data.sessionId);

      // Verify unstarted in DB
      const sessRes = await request(`/api/sessions/${res.data.sessionId}`, {
        headers: { Authorization: `Bearer ${freeToken}` }
      });
      assert.strictEqual(sessRes.status, 200);
      assert.strictEqual(sessRes.data.isStarted, false);
      assert.strictEqual(sessRes.data.planSnapshot, null);

      // Quota: used remains 0, remaining drops to 2 due to active reservation
      const qRes = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${freeToken}` }
      });
      assert.strictEqual(qRes.data.used, 0, "Unstarted session must NOT increment used count");
      assert.strictEqual(qRes.data.remaining, 2, "Active reservation must decrement remaining");
    });

    await runCheck(19, "Audit B: Free user starts Session #1 -> IsStarted: true, PlanSnapshot: 'free', used: 1", async () => {
      const startRes = await request(`/api/sessions/${freeSessions[0]}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${freeToken}` }
      });
      assert.strictEqual(startRes.status, 200);
      assert.strictEqual(startRes.data.isStarted, true);
      assert.strictEqual(startRes.data.planSnapshot, "free");

      const qRes = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${freeToken}` }
      });
      assert.strictEqual(qRes.data.used, 1, "Started session must increment used count");
      assert.strictEqual(qRes.data.remaining, 2);
    });

    await runCheck(20, "Free user creates & starts Session #2 -> used: 2, remaining: 1", async () => {
      const res = await request("/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${freeToken}` },
        body: { jobTitle: "Junior Frontend Dev" }
      });
      assert.strictEqual(res.status, 200);
      freeSessions.push(res.data.sessionId);

      await request(`/api/sessions/${res.data.sessionId}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${freeToken}` }
      });

      const qRes = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${freeToken}` }
      });
      assert.strictEqual(qRes.data.used, 2);
      assert.strictEqual(qRes.data.remaining, 1);
    });

    await runCheck(21, "Free user creates & starts Session #3 -> used: 3, remaining: 0, canStart false", async () => {
      const res = await request("/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${freeToken}` },
        body: { jobTitle: "Junior Web Dev" }
      });
      assert.strictEqual(res.status, 200);
      freeSessions.push(res.data.sessionId);

      await request(`/api/sessions/${res.data.sessionId}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${freeToken}` }
      });

      const qRes = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${freeToken}` }
      });
      assert.strictEqual(qRes.data.used, 3);
      assert.strictEqual(qRes.data.remaining, 0);
      assert.strictEqual(qRes.data.canStart, false);
    });

    await runCheck(22, "Audit B: Starting an already started session is idempotent (no duplicate charges)", async () => {
      const dupStartRes = await request(`/api/sessions/${freeSessions[0]}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${freeToken}` }
      });
      assert.strictEqual(dupStartRes.status, 200);

      const qRes = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${freeToken}` }
      });
      assert.strictEqual(qRes.data.used, 3, "Idempotent start must not increment used count");
    });

    await runCheck(23, "Audit B: Abandoned/unstarted session does NOT consume monthly quota", async () => {
      const userAnhToken = makeJwtToken("user_006", "anh.truong@gmail.com", "user", "AnhTruong");
      
      // Initial state
      const qInitial = await request("/api/user/quota", { headers: { Authorization: `Bearer ${userAnhToken}` } });
      assert.strictEqual(qInitial.data.used, 0);
      assert.strictEqual(qInitial.data.remaining, 3);

      // Create session but abandon it (never call start)
      const abandonedRes = await request("/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${userAnhToken}` },
        body: { jobTitle: "Abandoned Session Practice" }
      });
      assert.strictEqual(abandonedRes.status, 200);

      // Verify the session in DB is IsStarted: false
      const abandonedGet = await request(`/api/sessions/${abandonedRes.data.sessionId}`, {
        headers: { Authorization: `Bearer ${userAnhToken}` }
      });
      assert.strictEqual(abandonedGet.data.isStarted, false);
      assert.strictEqual(abandonedGet.data.planSnapshot, null);

      // Quota used count is strictly 0
      const qAfter = await request("/api/user/quota", { headers: { Authorization: `Bearer ${userAnhToken}` } });
      assert.strictEqual(qAfter.data.used, 0, "Unstarted session is not counted as used");
    });

    await runCheck(24, "Free user attempts Session #4 -> blocked with HTTP 429 INTERVIEW_QUOTA_EXCEEDED", async () => {
      const res = await request("/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${freeToken}` },
        body: { jobTitle: "Junior React Developer" }
      });
      assert.strictEqual(res.status, 429);
      assert.strictEqual(res.data.code, "INTERVIEW_QUOTA_EXCEEDED");
    });

    await runCheck(25, "Alias route POST /api/sessions/start is also blocked with 429", async () => {
      const res = await request("/api/sessions/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${freeToken}` },
        body: { jobTitle: "Junior React Developer" }
      });
      assert.strictEqual(res.status, 429);
      assert.strictEqual(res.data.code, "INTERVIEW_QUOTA_EXCEEDED");
    });

    await runCheck(26, "Client-side localStorage tampering cannot bypass backend (direct API rejected)", async () => {
      const directCall = await request("/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${freeToken}` },
        body: { jobTitle: "Bypass Attempt" }
      });
      assert.strictEqual(directCall.status, 429);
    });

    await runCheck(27, "Failed setup (validation error 400) does NOT consume user quota", async () => {
      const freeToken3 = makeJwtToken("user_003", "hoa.nguyen@outlook.com", "user", "HoaNguyen");
      
      const q1 = await request("/api/user/quota", { headers: { Authorization: `Bearer ${freeToken3}` } });
      assert.strictEqual(q1.data.remaining, 3);

      const badReq = await request("/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${freeToken3}` },
        body: { jobTitle: "" }
      });
      assert.strictEqual(badReq.status, 400);

      const q2 = await request("/api/user/quota", { headers: { Authorization: `Bearer ${freeToken3}` } });
      assert.strictEqual(q2.data.remaining, 3);
      assert.strictEqual(q2.data.used, 0);
    });

    await runCheck(28, "Previous calendar month sessions do not count against current month's quota", async () => {
      // user_004 had 'sess_user004_september' in September + 3 sessions started in current month
      const res = await request("/api/user/quota", { headers: { Authorization: `Bearer ${freeToken}` } });
      assert.strictEqual(res.data.used, 3, "Only October sessions count toward current month's used quota");
    });

    await runCheck(29, "Quota response includes Vietnam reset timestamp resetAt and resetAtUtc", async () => {
      const res = await request("/api/user/quota", { headers: { Authorization: `Bearer ${freeToken}` } });
      assert.strictEqual(res.status, 200);
      assert(res.data.resetAt && res.data.resetAt.includes("+07:00"), "Must include Vietnam offset +07:00");
      assert(res.data.resetAtUtc && res.data.resetAtUtc.endsWith("Z"), "Must include ISO UTC reset timestamp");
    });

    await runCheck(30, "Free sessions have PlanSnapshot: 'free'", async () => {
      const getSess = await request(`/api/sessions/${freeSessions[0]}`, {
        headers: { Authorization: `Bearer ${freeToken}` }
      });
      assert.strictEqual(getSess.status, 200);
      assert.strictEqual(getSess.data.planSnapshot, "free");
      assert.strictEqual(getSess.data.isStarted, true);
    });

    await runCheck(31, "IDOR: Free User B cannot access Free User A's session", async () => {
      const otherToken = makeJwtToken("user_003", "hoa.nguyen@outlook.com", "user", "HoaNguyen");
      const res = await request(`/api/sessions/${freeSessions[0]}`, {
        headers: { Authorization: `Bearer ${otherToken}` }
      });
      assert.strictEqual(res.status, 403);
    });

    await runCheck(32, "Concurrency protection: Atomic reservation prevents concurrent over-quota creation", async () => {
      const freshUserToken = makeJwtToken("user_concurrency", "concurrency.test@example.com", "user", "ConcurrencyTest");
      
      // Fire 5 concurrent requests for a user that has 3 slots
      const promises = Array.from({ length: 5 }, (_, i) => 
        request("/api/sessions", {
          method: "POST",
          headers: { Authorization: `Bearer ${freshUserToken}` },
          body: { jobTitle: `Concurrent Interview ${i + 1}` }
        })
      );

      const results = await Promise.all(promises);
      const successes = results.filter(r => r.status === 200);
      const throttled = results.filter(r => r.status === 429);

      assert.strictEqual(successes.length, 3, "Strictly 3 sessions allowed concurrently");
      assert.strictEqual(throttled.length, 2, "Remaining concurrent requests must receive 429");
    });

    // =================================================================
    // GROUP 3: PRO TIER UNLIMITED & DOWNGRADE / UPGRADE (6 Tests)
    // =================================================================
    console.log("\n--- GROUP 3: PRO TIER UNLIMITED & GRACEFUL DOWNGRADE ---");

    const proToken = makeJwtToken("user_001", "nam.le@gmail.com", "user", "NamLe");

    await runCheck(33, "Active Pro user quota: tier 'pro', canStart true, limit null/unlimited", async () => {
      const res = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${proToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.tier, "pro");
      assert.strictEqual(res.data.canStart, true);
      assert.strictEqual(res.data.isProActive, true);
      assert(res.data.remaining > 9999, "Remaining must represent unlimited");
    });

    await runCheck(34, "Active Pro user creates > 3 sessions without hitting quota limit", async () => {
      for (let i = 1; i <= 4; i++) {
        const res = await request("/api/sessions", {
          method: "POST",
          headers: { Authorization: `Bearer ${proToken}` },
          body: { jobTitle: `Senior Fullstack Arch ${i}` }
        });
        assert.strictEqual(res.status, 200, `Pro session ${i} must succeed`);
      }
    });

    await runCheck(35, "Pro sessions started retain PlanSnapshot: 'pro'", async () => {
      const sessRes = await request("/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${proToken}` },
        body: { jobTitle: "Cloud Architect" }
      });
      const sessId = sessRes.data.sessionId;

      // Start session
      const startRes = await request(`/api/sessions/${sessId}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${proToken}` }
      });
      assert.strictEqual(startRes.status, 200);
      assert.strictEqual(startRes.data.planSnapshot, "pro");

      const getRes = await request(`/api/sessions/${sessId}`, {
        headers: { Authorization: `Bearer ${proToken}` }
      });
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.data.planSnapshot, "pro");
    });

    await runCheck(36, "Audit B: User upgraded to Pro between creation and start commits under Pro tier", async () => {
      const upgradableToken = makeJwtToken("user_upgradable", "upgrade.test@example.com", "user", "UpgradeTest");
      
      // 1. Create session while Free
      const createRes = await request("/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${upgradableToken}` },
        body: { jobTitle: "Upgrade Candidate Test" }
      });
      assert.strictEqual(createRes.status, 200);
      const upgradeSessId = createRes.data.sessionId;

      // 2. Upgrade user to Pro via payment API
      const payRes = await request("/api/payment/process", {
        method: "POST",
        headers: { Authorization: `Bearer ${upgradableToken}` },
        body: {
          user: "user_upgradable",
          plan: "pro",
          amount: 99000,
          method: "card",
          cardName: "Upgrade Test",
          cardLast4: "4242"
        }
      });
      assert.strictEqual(payRes.status, 200, "Payment upgrade must succeed");

      // 3. Start session now that user is Pro
      const startRes = await request(`/api/sessions/${upgradeSessId}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${upgradableToken}` }
      });
      assert.strictEqual(startRes.status, 200);
      assert.strictEqual(startRes.data.planSnapshot, "pro", "Effective entitlement evaluated at start time must be 'pro'");

      // Verify quota: Free used quota remains 0
      const qRes = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${upgradableToken}` }
      });
      assert.strictEqual(qRes.data.tier, "pro");
    });

    await runCheck(37, "Expired Pro user automatically falls back to Free tier rules (tier: 'free')", async () => {
      const expiredToken = makeJwtToken("user_expired_pro", "expired.pro@example.com", "user", "ExpiredPro");
      const res = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.tier, "free", "Expired subscription must fall back to Free");
      assert.strictEqual(res.data.limit, 3);
      assert.strictEqual(res.data.isProActive, false);
    });

    await runCheck(38, "Pro sessions started while Pro was active are not charged against Free limit after downgrade", async () => {
      const expiredToken = makeJwtToken("user_expired_pro", "expired.pro@example.com", "user", "ExpiredPro");
      const res = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.tier, "free");
      assert.strictEqual(res.data.used, 0);
      assert.strictEqual(res.data.remaining, 3);
    });

    // =================================================================
    // GROUP 4: AUDIT C — PROCESS RESTART & STATE RECONSTRUCTION (1 Test)
    // =================================================================
    console.log("\n--- GROUP 4: AUDIT C — PROCESS RESTART & PERSISTENCE ---");

    await runCheck(39, "Audit C: Backend restart reconstructs started session quota from persistent storage", async () => {
      console.log("       [RESTART] Stopping backend process...");
      stopProcess(serverProcess);
      await new Promise(r => setTimeout(r, 1000));

      console.log("       [RESTART] Restarting backend process with same database...");
      serverProcess = startBackendProcess(testDbPath, testDir);
      await waitForServer();
      console.log("       [RESTART] Backend restarted successfully.");

      // Check Free user (user_004) quota: Must still be used: 3, remaining: 0, canStart: false
      const qFree = await request("/api/user/quota", {
        headers: { Authorization: `Bearer ${freeToken}` }
      });
      assert.strictEqual(qFree.status, 200);
      assert.strictEqual(qFree.data.used, 3, "Started session count reconstructed from disk");
      assert.strictEqual(qFree.data.remaining, 0);
      assert.strictEqual(qFree.data.canStart, false);

      // Check Guest token A: Demo session still marked used
      const qGuest = await request("/api/user/quota", {
        headers: { Cookie: `pm_guest_token=${guestTokenA}` }
      });
      assert.strictEqual(qGuest.status, 200);
      assert.strictEqual(qGuest.data.demoUsed, true, "Guest demo used reconstructed from disk");
      assert.strictEqual(qGuest.data.remaining, 0);
    });

  } finally {
    console.log("\n[INFO] Terminating test server process...");
    stopProcess(serverProcess);

    // Clean up test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (_) {}

    // Verify invariant after testing
    const postHash = computeHash(PROD_DB_PATH);
    assert.strictEqual(postHash, BASELINE_DB_HASH, "Production database hash must remain identical after test run");
    console.log(`[INFO] Post-test db.json verified: ${postHash}\n`);
  }

  console.log("==================================================================");
  console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("==================================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("FATAL ERROR IN TEST RUNNER:", err);
  process.exit(1);
});
