/**
 * PREPMATE — WI-GUEST-HISTORY-SEPARATION-01 REGRESSION SUITE
 * 
 * Verifies Separated Guest History & Account History Implementation:
 * 1. Backend Dedicated Guest History Endpoint (/api/sessions/guest & /api/sessions/guest/history)
 * 2. Strict Identity & Cross-Guest Isolation (Guest A vs Guest B vs Account Owner)
 * 3. Minimal Allowlist DTO & Anti-Leakage Contracts
 * 4. ClaimGuestSession Flow (Removes from Guest History, adds to Account History, revokes old guest access)
 * 5. Legacy Session Exclusion (Unbound legacy sessions excluded; bound legacy included)
 * 6. Frontend History Page Contracts (No guest redirect, banner visibility, async race token)
 * 7. Production Database SHA-256 Invariant
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

const TEST_PORT = 5096;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_DIR = path.join(os.tmpdir(), `prepmate_guest_hist_test_${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, "isolated_hist_db.json");
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
        ...options.headers
      }
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
    req.setTimeout(25000, () => req.destroy(new Error(`Timeout calling ${url}`)));
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
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

async function runStaticContracts() {
  console.log("--- GROUP 1: SOURCE CODE INVARIANTS & CONTRACT AUDIT ---");

  const sessionsCs = fs.readFileSync(path.join(WORKSPACE_ROOT, "BE/Controllers/SessionsController.cs"), "utf8");
  const histHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, "FE/features/interview/history.html"), "utf8");
  const mainJs = fs.readFileSync(path.join(WORKSPACE_ROOT, "FE/shared/js/main.js"), "utf8");

  // 1.1 Dedicated Guest History endpoints defined
  check(
    sessionsCs.includes('[HttpGet("guest")]') && sessionsCs.includes('[HttpGet("guest/history")]'),
    "1.1 SessionsController defines [HttpGet(\"guest\")] and [HttpGet(\"guest/history\")] routes"
  );

  // 1.2 Uses server-verified guest identity resolution
  check(
    sessionsCs.includes("_quotaService.ResolveOrCreateGuestIdentity(HttpContext)"),
    "1.2 GetGuestSessions resolves caller guest identity via authoritative QuotaService"
  );

  // 1.3 Excludes claimed sessions and registered account sessions
  check(
    sessionsCs.includes("string.IsNullOrWhiteSpace(s.ClaimedAt)") &&
    sessionsCs.includes('s.UserId.StartsWith("guest"'),
    "1.3 GetGuestSessions excludes claimed sessions and registered-account sessions"
  );

  // 1.4 Response payload minimization (No sensitive answers, CV, JD, evidence)
  const guestHistMatch = sessionsCs.match(/public\s+IActionResult\s+GetGuestSessions\(\)[\s\S]*?return\s+Ok\(guestSessions\);/);
  assert(guestHistMatch, "GetGuestSessions implementation must exist");
  const guestHistCode = guestHistMatch[0];

  check(!guestHistCode.includes("answers = s.Answers"), "1.4a Raw candidate answers strictly excluded from Guest History DTO");
  check(!guestHistCode.includes("questions = s.Questions"), "1.4b Raw questions strictly excluded from Guest History DTO");
  check(!guestHistCode.includes("cvText ="), "1.4c CV text strictly excluded from Guest History DTO");
  check(!guestHistCode.includes("jdText ="), "1.4d JD text strictly excluded from Guest History DTO");
  check(!guestHistCode.includes("evidenceReport ="), "1.4e Evidence report strictly excluded from Guest History DTO");
  check(!guestHistCode.includes("techScore ="), "1.4f Detailed techScore strictly excluded from Guest History DTO");
  check(!guestHistCode.includes("commScore ="), "1.4g Detailed commScore strictly excluded from Guest History DTO");
  check(guestHistCode.includes("isGuestPreview = true"), "1.4h isGuestPreview flag explicitly set to true");

  // 1.5 Frontend history.html identity-aware behavior
  check(
    !histHtml.includes("window.location.replace('../auth/auth.html?redirect='"),
    "1.5a Automatic guest redirect to auth.html removed from history.html"
  );
  check(
    histHtml.includes("id=\"hist-guest-banner\""),
    "1.5b Guest context notice banner (#hist-guest-banner) present in history.html"
  );
  check(
    histHtml.includes("_activeHistoryRequestId"),
    "1.5c _activeHistoryRequestId sequence token implemented to prevent async race conditions"
  );
  check(
    histHtml.includes("fetch(`${apiBase}/api/sessions/guest`"),
    "1.5d history.html loads dedicated guest history from /api/sessions/guest"
  );
  check(
    mainJs.includes("fetch(`${apiBase}/api/sessions/guest`"),
    "1.5e main.js syncUserInterviewSessions fetches /api/sessions/guest for unauthenticated callers"
  );
}

async function runLiveBackendIntegration() {
  console.log("\n--- GROUP 2: LIVE BACKEND END-TO-END GUEST & ACCOUNT HISTORY ISOLATION ---");

  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  if (!fs.existsSync(TEST_KEYRING)) fs.mkdirSync(TEST_KEYRING, { recursive: true });

  // 2.0 Mint deterministic Guest Tokens for Guest A and Guest B
  const guestA = mintGuestToken(TEST_GUEST_SECRET);
  const guestB = mintGuestToken(TEST_GUEST_SECRET);
  const guestTokenA = guestA.token;
  const guestIdA = guestA.guestId;
  const guestTokenB = guestB.token;
  const guestIdB = guestB.guestId;
  const userId = "user_001";

  // 2.1 Prepare and pre-seed isolated database BEFORE spawning backend
  fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH);
  const rawDb = JSON.parse(fs.readFileSync(TEST_DB_PATH, "utf8"));
  if (!rawDb.Sessions) rawDb.Sessions = {};

  const sessA1Id = "sess_guest_a1";
  rawDb.Sessions[sessA1Id] = {
    Id: sessA1Id,
    UserId: guestIdA,
    OriginalGuestId: guestIdA,
    JobTitle: "Senior .NET Engineer",
    TargetCompany: "Tech Corp",
    CreatedAt: "2026-11-06T09:00:00Z",
    Status: "completed",
    Answers: [{ Question: "Q1", Answer: "Private answer 1" }],
    Questions: ["Q1"],
    Report: { OverallScore: 82.0, Strengths: "Good", Weaknesses: "None" }
  };

  const sessA2Id = "sess_guest_a2";
  rawDb.Sessions[sessA2Id] = {
    Id: sessA2Id,
    UserId: guestIdA,
    OriginalGuestId: guestIdA,
    JobTitle: "Frontend React Developer",
    TargetCompany: "Startup VN",
    CreatedAt: "2026-11-06T10:00:00Z",
    Status: "in_progress",
    Answers: [],
    Questions: []
  };

  const sessB1Id = "sess_guest_b1";
  rawDb.Sessions[sessB1Id] = {
    Id: sessB1Id,
    UserId: guestIdB,
    OriginalGuestId: guestIdB,
    JobTitle: "QA Automation Lead",
    TargetCompany: "Quality Inc",
    CreatedAt: "2026-11-06T11:00:00Z",
    Status: "completed",
    Answers: [{ Question: "QB1", Answer: "Private answer B1" }],
    Report: { OverallScore: 78.0 }
  };

  const sessU1Id = "sess_user_u1";
  rawDb.Sessions[sessU1Id] = {
    Id: sessU1Id,
    UserId: userId,
    JobTitle: "Enterprise Cloud Architect",
    TargetCompany: "Global Cloud",
    CreatedAt: "2026-11-05T12:00:00Z",
    Status: "completed",
    Report: { OverallScore: 88.0 }
  };

  const sessLegUnboundId = "sess_legacy_unbound";
  rawDb.Sessions[sessLegUnboundId] = {
    Id: sessLegUnboundId,
    UserId: "guest",
    OriginalGuestId: null,
    JobTitle: "Legacy Unbound Session",
    CreatedAt: "2026-10-20T08:00:00Z",
    Status: "completed",
    Report: { OverallScore: 60.0 }
  };

  const sessLegBoundAId = "sess_legacy_bound_a";
  rawDb.Sessions[sessLegBoundAId] = {
    Id: sessLegBoundAId,
    UserId: "guest",
    OriginalGuestId: guestIdA,
    JobTitle: "Legacy Bound Session A",
    CreatedAt: "2026-10-22T08:00:00Z",
    Status: "completed",
    Report: { OverallScore: 70.0 }
  };

  fs.writeFileSync(TEST_DB_PATH, JSON.stringify(rawDb, null, 2), "utf8");

  const beDir = path.join(WORKSPACE_ROOT, "BE");
  const dllPath = path.join(beDir, "bin", "Debug", "net10.0", "backend.dll");

  console.log(`Starting isolated test backend on ${BASE_URL}...`);
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

    assert(ready, "Isolated test backend failed to start");
    console.log("Isolated backend online.\n");

    // 2.2 Verify Guest A identity recognition
    const quotaResA = await requestJson(`${BASE_URL}/api/sessions/quota`, {
      headers: { Cookie: `pm_guest_token=${guestTokenA}`, "X-Guest-Token": guestTokenA }
    });
    check(quotaResA.body?.guestId === guestIdA, `2.2 Guest A identity verified: ${guestIdA}`);

    // 2.3 Verify Guest B identity recognition
    const quotaResB = await requestJson(`${BASE_URL}/api/sessions/quota`, {
      headers: { Cookie: `pm_guest_token=${guestTokenB}`, "X-Guest-Token": guestTokenB }
    });
    check(quotaResB.body?.guestId === guestIdB, `2.3 Guest B distinct identity verified: ${guestIdB}`);

    // 2.4 Authenticate Registered User (nam.le@gmail.com / user_001)
    const loginRes = await requestJson(`${BASE_URL}/api/auth/login`, { method: "POST" }, {
      email: "nam.le@gmail.com",
      password: "user123"
    });
    check(loginRes.status === 200, "2.4 Registered user authenticated (Alice / user_001)");
    const userToken = loginRes.body?.token;

    // 2.5 Test Guest A History Retrieval
    console.log("\n  • Testing Guest A History (/api/sessions/guest with Token A):");
    const histResA = await requestJson(`${BASE_URL}/api/sessions/guest`, {
      headers: { Cookie: `pm_guest_token=${guestTokenA}`, "X-Guest-Token": guestTokenA }
    });
    check(histResA.status === 200, "2.5.1 Guest A successfully retrieves guest history (200 OK)");
    const listA = histResA.body;
    check(Array.isArray(listA), "2.5.2 Guest A history response is an array");

    const idsA = listA.map((s) => s.id || s.sessionId);
    check(idsA.includes(sessA1Id), "2.5.3 Guest A history contains session A1");
    check(idsA.includes(sessA2Id), "2.5.4 Guest A history contains session A2");
    check(idsA.includes(sessLegBoundAId), "2.5.5 Guest A history contains legacy bound session");
    check(!idsA.includes(sessB1Id), "2.5.6 Cross-guest isolation: Guest A history EXCLUDES Guest B session B1");
    check(!idsA.includes(sessU1Id), "2.5.7 Account isolation: Guest A history EXCLUDES Account session U1");
    check(!idsA.includes(sessLegUnboundId), "2.5.8 Legacy isolation: Guest A history EXCLUDES unbound legacy session");

    // Check payload minimization on item A1
    const itemA1 = listA.find((s) => (s.id || s.sessionId) === sessA1Id);
    check(itemA1.isGuestPreview === true, "2.5.9 Item A1 marked as isGuestPreview: true");
    check(itemA1.overallScore === 82.0, "2.5.10 Item A1 carries overallScore 82");
    check(itemA1.answers === undefined, "2.5.11 Item A1 does NOT leak answers");
    check(itemA1.questions === undefined, "2.5.12 Item A1 does NOT leak questions");

    // Check unevaluated item A2: overallScore must be null
    const itemA2 = listA.find((s) => (s.id || s.sessionId) === sessA2Id);
    check(itemA2.overallScore === null, "2.5.13 In-progress item A2 has overallScore: null (no fabricated zero)");

    // 2.6 Test Guest B History Retrieval
    console.log("\n  • Testing Guest B History (/api/sessions/guest with Token B):");
    const histResB = await requestJson(`${BASE_URL}/api/sessions/guest`, {
      headers: { Cookie: `pm_guest_token=${guestTokenB}`, "X-Guest-Token": guestTokenB }
    });
    check(histResB.status === 200, "2.6.1 Guest B successfully retrieves guest history");
    const listB = histResB.body;
    const idsB = listB.map((s) => s.id || s.sessionId);
    check(idsB.includes(sessB1Id), "2.6.2 Guest B history contains session B1");
    check(!idsB.includes(sessA1Id) && !idsB.includes(sessA2Id), "2.6.3 Guest B history EXCLUDES all Guest A sessions");

    // 2.7 Guest B attempts to open Guest A's report -> 403 Forbidden
    const reportCrossRes = await requestJson(`${BASE_URL}/api/sessions/${sessA1Id}`, {
      headers: { Cookie: `pm_guest_token=${guestTokenB}`, "X-Guest-Token": guestTokenB }
    });
    check(reportCrossRes.status === 403, `2.7 Cross-guest report access blocked: ${reportCrossRes.status} Forbidden`);

    // 2.8 Test Authenticated User Account History (/api/sessions/user/{userId})
    console.log("\n  • Testing Account History (/api/sessions/user/user_001):");
    const userHistRes = await requestJson(`${BASE_URL}/api/sessions/user/${userId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    check(userHistRes.status === 200, "2.8.1 Account user retrieves account history");
    const listUser = userHistRes.body;
    const idsUser = listUser.map((s) => s.Id || s.id);
    check(idsUser.includes(sessU1Id), "2.8.2 Account history contains session U1");
    check(!idsUser.includes(sessA1Id) && !idsUser.includes(sessB1Id), "2.8.3 Account history EXCLUDES unclaimed guest sessions");

    // 2.9 Claim Guest Session Flow: User claims Session A1
    console.log("\n  • Testing ClaimGuestSession (User claims Session A1):");
    const claimRes = await requestJson(`${BASE_URL}/api/sessions/${sessA1Id}/claim`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        Cookie: `pm_guest_token=${guestTokenA}`,
        "X-Guest-Token": guestTokenA
      }
    });
    check(claimRes.status === 200, "2.9.1 ClaimGuestSession succeeded (200 OK)");

    // 2.10 Verify Claim Transition:
    // A1 must disappear from Guest A History
    const histAAfterClaim = await requestJson(`${BASE_URL}/api/sessions/guest`, {
      headers: { Cookie: `pm_guest_token=${guestTokenA}`, "X-Guest-Token": guestTokenA }
    });
    const idsAAfter = histAAfterClaim.body.map((s) => s.id || s.sessionId);
    check(!idsAAfter.includes(sessA1Id), "2.10.1 Claimed session A1 successfully REMOVED from Guest A history");

    // A1 must now appear in User Account History
    const userHistAfterClaim = await requestJson(`${BASE_URL}/api/sessions/user/${userId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    const idsUserAfter = userHistAfterClaim.body.map((s) => s.Id || s.id);
    check(idsUserAfter.includes(sessA1Id), "2.10.2 Claimed session A1 successfully TRANSFERRED to Account history");

    // Former Guest Token attempting to open claimed session A1 -> 401 Unauthorized
    const guestOpenClaimedRes = await requestJson(`${BASE_URL}/api/sessions/${sessA1Id}`, {
      headers: { Cookie: `pm_guest_token=${guestTokenA}`, "X-Guest-Token": guestTokenA }
    });
    check(
      guestOpenClaimedRes.status === 401,
      `2.10.3 Old Guest token access to claimed session rejected with ${guestOpenClaimedRes.status} Unauthorized`
    );

  } finally {
    backendProc.kill();
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  }
}

function verifyDatabaseInvariant() {
  console.log("\n--- GROUP 3: PRODUCTION DATABASE INVARIANT ---");
  const currentHash = crypto.createHash("sha256").update(fs.readFileSync(PROD_DB_PATH)).digest("hex").toUpperCase();
  check(currentHash === BASELINE_DB_HASH, `3.1 Production db.json hash strictly invariant (${currentHash})`);
}

async function main() {
  console.log("===============================================================");
  console.log("   PREPMATE — WI-GUEST-HISTORY-SEPARATION-01 REGRESSION SUITE  ");
  console.log("===============================================================\n");

  await runStaticContracts();
  await runLiveBackendIntegration();
  verifyDatabaseInvariant();

  console.log("\n===============================================================");
  console.log(`TOTAL SUITE CHECKS: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in test execution:", err);
  process.exit(1);
});
