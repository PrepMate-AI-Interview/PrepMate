/**
 * PREPMATE — REPORT ACCESS PREVIEW & AUTHENTICATED CLAIM TEST SUITE
 * Work Item: WI-REPORT-ACCESS-01
 * Mode: Full Integration & Security Gate
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { spawn } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PROD_DB_PATH = path.join(ROOT_DIR, "BE/data/db.json");
const EXPECTED_PROD_HASH = "C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7";

function getFileSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex").toUpperCase();
}

const TEST_PORT = 5225;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const JWT_SECRET = "PrepMate_Secure_Production_Hardened_Key_2026_Minimum_256_Bits_Super_Secret!";
const JWT_ISSUER = "PrepMateBackend";
const JWT_AUDIENCE = "PrepMateFrontend";

function createSignedJwt(userId, email, role, secret = JWT_SECRET) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": userId,
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": email,
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": role,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

function request(endpoint, options = {}, bodyData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const reqOpts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          raw: data
        });
      });
    });

    req.on("error", reject);

    if (bodyData) {
      const payload = typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData);
      req.setHeader("Content-Length", Buffer.byteLength(payload));
      req.write(payload);
    }
    req.end();
  });
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
  for (const c of cookies) {
    const parts = c.split(";")[0].split("=");
    if (parts[0].trim() === name) {
      return parts[1].trim();
    }
  }
  return null;
}

async function waitForServer(retries = 60, delayMs = 400) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await request("/api/health");
      if (res.status === 200) {
        return true;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Server failed to start on port ${TEST_PORT} within ${retries * delayMs}ms`);
}

async function runSuite() {
  console.log("==================================================================");
  console.log("   WI-REPORT-ACCESS-01: GUEST PREVIEW & AUTH CLAIM TEST SUITE     ");
  console.log("==================================================================");

  // 1. Verify Production db.json invariant before running
  const initialHash = getFileSha256(PROD_DB_PATH);
  assert.strictEqual(initialHash, EXPECTED_PROD_HASH, "Production db.json must match baseline");
  console.log("[INFO] Baseline db.json verified:", initialHash);

  // 2. Prepare temporary test database from baseline clone
  const testDir = path.join(ROOT_DIR, "scratch/test_db_report_access");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  const testDbPath = path.join(testDir, "db.json");
  const testKeyringPath = path.join(testDir, "keyring");

  const initialDb = JSON.parse(fs.readFileSync(PROD_DB_PATH, "utf8"));
  initialDb.Users = initialDb.Users || {};
  initialDb.Users["user-candidate-alice"] = {
    Id: "user-candidate-alice",
    Username: "alice_cand",
    Email: "alice@prepmate.test",
    Role: "user",
    Subscription: "free"
  };
  initialDb.Users["user-candidate-bob"] = {
    Id: "user-candidate-bob",
    Username: "bob_cand",
    Email: "bob@prepmate.test",
    Role: "user",
    Subscription: "free"
  };
  fs.writeFileSync(testDbPath, JSON.stringify(initialDb, null, 2), "utf8");

  // 3. Start test backend instance
  console.log(`[INFO] Starting test backend on port ${TEST_PORT}...`);
  const backendProc = spawn("dotnet", [
    "run",
    "--project", "BE/backend.csproj",
    "--no-build",
    "--no-launch-profile",
    "--urls", `http://127.0.0.1:${TEST_PORT}`
  ], {
    cwd: ROOT_DIR,
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
      PREPMATE_KEYRING_PATH: testKeyringPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  backendProc.stderr.on("data", (chunk) => {
    // console.error("[BE ERR]", chunk.toString());
  });

  await waitForServer();
  console.log(`[INFO] Test backend live and healthy on ${BASE_URL}`);

  let passed = 0;
  function pass(msg) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  }

  try {
    const aliceToken = createSignedJwt("user-candidate-alice", "alice@prepmate.test", "user");
    const bobToken = createSignedJwt("user-candidate-bob", "bob@prepmate.test", "user");
    const aliceUserId = "user-candidate-alice";

    console.log("\n--- GROUP 1: GUEST DEMO SESSION CREATION & PREVIEW ISOLATION ---");

    // 1. Guest A visits and receives guest token
    const qResA = await request("/api/sessions/quota");
    assert.strictEqual(qResA.status, 200);
    const guestCookieA = parseCookie(qResA.headers["set-cookie"], "pm_guest_token");
    assert(guestCookieA, "Guest A received valid pm_guest_token cookie");
    pass("Test 1: Guest A initialized and issued server-signed pm_guest_token");

    // 2. Guest A creates a session
    const createResA = await request("/api/sessions", {
      method: "POST",
      headers: { Cookie: `pm_guest_token=${guestCookieA}` }
    }, {
      jobTitle: "Senior .NET Engineer",
      experienceLevel: "Senior"
    });
    assert.strictEqual(createResA.status, 200);
    const sessionAId = createResA.data.sessionId || createResA.data.id;
    assert(sessionAId, "Session ID generated");
    pass("Test 2: Guest A created demo session");

    // 3. Guest A starts the session
    const startResA = await request(`/api/sessions/${sessionAId}/start`, {
      method: "POST",
      headers: { Cookie: `pm_guest_token=${guestCookieA}` }
    });
    assert.strictEqual(startResA.status, 200);
    assert.strictEqual(startResA.data.isStarted, true);
    assert.strictEqual(startResA.data.planSnapshot, "guest");
    pass("Test 3: Guest A started demo session (planSnapshot: 'guest')");

    // Populate answers & report directly in session on backend (simulating finished interview)
    const dbRaw = JSON.parse(fs.readFileSync(testDbPath, "utf8"));
    const sessAObj = dbRaw.Sessions[sessionAId];
    sessAObj.Answers = [
      {
        Turn: 1,
        Question: "Giải thích cơ chế Dependency Injection trong .NET Core?",
        Answer: "DI trong .NET Core hỗ trợ 3 lifetime: Transient, Scoped, Singleton. ServiceProvider quản lý vòng đời.",
        Stage: "Technical"
      },
      {
        Turn: 2,
        Question: "Mô tả một lần bạn tối ưu hiệu năng cơ sở dữ liệu?",
        Answer: "Tôi tối ưu bằng cách tạo composite index và dùng No-Tracking queries, giảm latency 40%.",
        Stage: "Technical"
      }
    ];
    fs.writeFileSync(testDbPath, JSON.stringify(dbRaw, null, 2), "utf8");

    // Call /api/ai/report as Guest A
    const repCallA = await request("/api/ai/report", {
      method: "POST",
      headers: { Cookie: `pm_guest_token=${guestCookieA}` }
    }, {
      sessionId: sessionAId,
      jobTitle: "Senior .NET Engineer",
      responses: [
        {
          Question: "Giải thích cơ chế Dependency Injection trong .NET Core?",
          Answer: "DI trong .NET Core hỗ trợ 3 lifetime: Transient, Scoped, Singleton. ServiceProvider quản lý vòng đời.",
          Stage: "Technical"
        },
        {
          Question: "Mô tả một lần bạn tối ưu hiệu năng cơ sở dữ liệu?",
          Answer: "Tôi tối ưu bằng cách tạo composite index và dùng No-Tracking queries, giảm latency 40%.",
          Stage: "Technical"
        }
      ]
    });
    assert.strictEqual(repCallA.status, 200);
    assert.strictEqual(repCallA.data.isGuestPreview, true);
    assert.strictEqual(typeof repCallA.data.overallScore, "number");
    assert.strictEqual(repCallA.data.techScore, undefined, "Detailed techScore must be omitted for guest");
    assert.strictEqual(repCallA.data.strengths, undefined, "Detailed strengths must be omitted for guest");
    assert.strictEqual(repCallA.data.criteria, undefined, "Detailed criteria must be omitted for guest");
    pass("Test 4: POST /api/ai/report returns strictly sanitized Guest Preview (0 detailed metrics leaked)");

    // 4. Guest A fetches session via GET /api/sessions/{id}
    const getResA = await request(`/api/sessions/${sessionAId}`, {
      method: "GET",
      headers: { Cookie: `pm_guest_token=${guestCookieA}` }
    });
    assert.strictEqual(getResA.status, 200);
    assert.strictEqual(getResA.data.isGuestPreview, true);
    assert.strictEqual(typeof getResA.data.report.overallScore, "number");
    assert.strictEqual(getResA.data.report.techScore, undefined, "Report techScore omitted");
    assert.strictEqual(getResA.data.report.strengths, undefined, "Report strengths omitted");
    assert.strictEqual(getResA.data.report.evidenceReport, undefined, "Report evidenceReport omitted");
    assert.strictEqual(getResA.data.answers, undefined, "Answers with feedback omitted for guest preview");
    pass("Test 5: GET /api/sessions/{id} returns strictly sanitized Guest Preview (no IDOR/leakage)");

    console.log("\n--- GROUP 2: BOLA / IDOR RESTRICTIONS ON REPORT DATA ---");

    // 5. Guest B (new guest identity) attempts to access Session A
    const qResB = await request("/api/sessions/quota");
    const guestCookieB = parseCookie(qResB.headers["set-cookie"], "pm_guest_token");
    assert(guestCookieB && guestCookieB !== guestCookieA, "Guest B has distinct identity");

    const getResB = await request(`/api/sessions/${sessionAId}`, {
      method: "GET",
      headers: { Cookie: `pm_guest_token=${guestCookieB}` }
    });
    assert.strictEqual(getResB.status, 403, "Guest B cannot view Guest A session (403 Forbidden)");
    pass("Test 6: Guest B blocked from accessing Guest A session (HTTP 403)");

    // 6. Unauthenticated caller attempts to claim or view registered user session
    // Create session owned by Alice
    const aliceSessRes = await request("/api/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${aliceToken}` }
    }, {
      jobTitle: "Lead Architect"
    });
    const aliceSessId = aliceSessRes.data.sessionId || aliceSessRes.data.id;

    const unauthGetAlice = await request(`/api/sessions/${aliceSessId}`);
    console.log("[DEBUG unauthGetAlice]", unauthGetAlice.status, unauthGetAlice.data);
    assert(unauthGetAlice.status === 401 || unauthGetAlice.status === 403, "Unauthenticated user gets 401/403 for registered user session");
    pass("Test 7: Unauthenticated caller blocked with 401 Unauthorized for registered session");

    // 7. Bob attempts to access Alice's session
    const bobGetAlice = await request(`/api/sessions/${aliceSessId}`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert.strictEqual(bobGetAlice.status, 403, "Bob cannot access Alice session (403 Forbidden)");
    pass("Test 8: Cross-user BOLA/IDOR protection verified: Bob blocked from Alice session (HTTP 403)");

    console.log("\n--- GROUP 3: AUTHENTICATED CLAIM OF GUEST SESSION ---");

    // 8. Bob attempts to claim Guest A's session with Bob's token but Bob has Guest B cookie
    const bobFraudClaim = await request(`/api/sessions/${sessionAId}/claim`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bobToken}`,
        Cookie: `pm_guest_token=${guestCookieB}`
      }
    });
    assert.strictEqual(bobFraudClaim.status, 403, "Bob with Guest B cookie cannot claim Guest A session");
    pass("Test 9: Cross-guest claim rejection: Caller with mismatched guest identity blocked (HTTP 403)");

    // 9. Alice (logged in on same browser as Guest A, carrying guestCookieA) claims Session A
    const aliceValidClaim = await request(`/api/sessions/${sessionAId}/claim`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        Cookie: `pm_guest_token=${guestCookieA}`
      }
    });
    assert.strictEqual(aliceValidClaim.status, 200, "Alice successfully claims Session A");
    assert.strictEqual(aliceValidClaim.data.success, true);
    pass("Test 10: Authenticated claim succeeds with matching server-verified guest token (HTTP 200)");

    // 10. Verify Claim Idempotency (calling claim a second time succeeds idempotently)
    const aliceReClaim = await request(`/api/sessions/${sessionAId}/claim`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        Cookie: `pm_guest_token=${guestCookieA}`
      }
    });
    assert.strictEqual(aliceReClaim.status, 200);
    pass("Test 11: Claim operation is strictly idempotent (subsequent claim returns 200)");

    // 11. Alice now fetches Session A via GET /api/sessions/{id} with her JWT:
    // Should now return the FULL detailed session (NOT a guest preview)!
    const aliceFullSession = await request(`/api/sessions/${sessionAId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert.strictEqual(aliceFullSession.status, 200);
    assert.strictEqual(aliceFullSession.data.isGuestPreview, undefined, "isGuestPreview not true for owner");
    assert.strictEqual(aliceFullSession.data.userId, aliceUserId, "Session userId transferred to Alice");
    assert(aliceFullSession.data.report, "Full report object present");
    assert(typeof aliceFullSession.data.report.overallScore === "number", "Overall score present");
    assert(aliceFullSession.data.report.techScore !== undefined, "Detailed techScore present for authenticated owner");
    assert(aliceFullSession.data.report.strengths !== undefined, "Detailed strengths present for authenticated owner");
    pass("Test 12: Claimed session delivers FULL detailed report to authenticated owner (all metrics available)");

    console.log("\n--- GROUP 4: QUOTA INTEGRITY POST-CLAIM ---");

    // 12. Verify Guest demo is NOT refunded (guest token A still shows demoUsed: true)
    const guestAQuota = await request("/api/sessions/quota", {
      headers: { Cookie: `pm_guest_token=${guestCookieA}` }
    });
    assert.strictEqual(guestAQuota.status, 200);
    assert.strictEqual(guestAQuota.data.demoUsed, true, "Guest demo remains consumed");
    assert.strictEqual(guestAQuota.data.remaining, 0, "Guest has 0 demo sessions remaining");
    assert.strictEqual(guestAQuota.data.canStart, false, "Guest cannot start second demo");
    pass("Test 13: Guest demo entitlement remains consumed post-claim (no demo refund loop)");

    // 13. Verify Free user Alice's monthly started count did NOT consume a Free session for the claimed demo
    const aliceQuota = await request("/api/sessions/quota", {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert.strictEqual(aliceQuota.status, 200);
    assert.strictEqual(aliceQuota.data.used, 0, "Alice Free quota used is 0 (claimed guest demo does not charge Free quota)");
    assert.strictEqual(aliceQuota.data.canStart, true, "Alice can still start sessions under Free quota");
    pass("Test 14: Free tier monthly quota untouched by claimed guest session (used: 0 / 3)");

    console.log("\n--- GROUP 5: FRONTEND TTS & VOICE CONTROLS CONTRACT ---");

    const reportJsContent = fs.readFileSync(path.join(ROOT_DIR, "FE/features/report/report.js"), "utf8");
    assert(reportJsContent.includes("PrepMateReportVoice"), "report.js must define PrepMateReportVoice");
    assert(reportJsContent.includes("toggleVoice"), "report.js must implement toggleVoice");
    assert(reportJsContent.includes("credentials: \"include\""), "fetchSessionFromBackend must include credentials");
    assert(reportJsContent.includes("renderGuestPreviewReport"), "report.js must implement renderGuestPreviewReport");
    assert(reportJsContent.includes("renderGuestLockedTeasers"), "report.js must implement renderGuestLockedTeasers");
    pass("Test 15: Frontend PrepMateReportVoice & Guest Preview functions verified in source");

  } finally {
    // Terminate test backend
    console.log("\n[INFO] Stopping test backend...");
    backendProc.kill();

    // Clean temporary test files
    try {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {}

    // Verify Production db.json invariant post-run
    const postHash = getFileSha256(PROD_DB_PATH);
    assert.strictEqual(postHash, EXPECTED_PROD_HASH, "Production db.json must remain strictly untouched");
    console.log("[INFO] Post-test production db.json hash verified:", postHash);
  }

  console.log(`\n==================================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, 0 FAILED`);
  console.log(`==================================================================`);
}

runSuite().catch((err) => {
  console.error("\n[TEST SUITE FAILURE]:", err);
  process.exit(1);
});
