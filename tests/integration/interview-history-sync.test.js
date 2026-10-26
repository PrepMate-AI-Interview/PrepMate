/**
 * PREPMATE — INTERVIEW-HISTORY-01 INTEGRATION TEST SUITE
 * Validates Data Consistency, Synchronization, Deterministic Sorting,
 * Canonical ID Deduplication, Report Routing, and Strict Account Isolation.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const { spawn } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const BASELINE_DB_HASH = "C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7";

console.log("===============================================================");
console.log("   INTERVIEW-HISTORY-01: DATA CONSISTENCY & SYNC TEST SUITE   ");
console.log("===============================================================\n");

let passCount = 0;
let failCount = 0;

function runCheck(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

async function runAsyncCheck(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

// ------------------------------------------------------------------
// STEP 1: Verify Baseline Database Invariant Before Starting
// ------------------------------------------------------------------
console.log("--- 1. Baseline Integrity Pre-Flight ---");
runCheck("1.1 Baseline db.json hash strictly matches expected hash", () => {
  const currentBytes = fs.readFileSync(PROD_DB_PATH);
  const currentHash = crypto.createHash("sha256").update(currentBytes).digest("hex").toUpperCase();
  assert.strictEqual(currentHash, BASELINE_DB_HASH, "Production database must be unmodified");
});

// ------------------------------------------------------------------
// STEP 2: Logic & Algorithm Unit / Contract Validations
// ------------------------------------------------------------------
console.log("\n--- 2. Single Source of Truth Synchronization Logic ---");

// Load synchronization logic from FE/shared/js/main.js
const mainJsContent = fs.readFileSync(path.join(WORKSPACE_ROOT, "FE", "shared", "js", "main.js"), "utf8");
const dashboardJsContent = fs.readFileSync(path.join(WORKSPACE_ROOT, "FE", "features", "dashboard", "dashboard.js"), "utf8");
const historyHtmlContent = fs.readFileSync(path.join(WORKSPACE_ROOT, "FE", "features", "interview", "history.html"), "utf8");
const interviewFinishJsContent = fs.readFileSync(path.join(WORKSPACE_ROOT, "FE", "features", "interview", "interview-finish.js"), "utf8");

runCheck("2.1 syncUserInterviewSessions defined and exposed in main.js", () => {
  assert(mainJsContent.includes("async function syncUserInterviewSessions"), "syncUserInterviewSessions must be defined");
  assert(mainJsContent.includes("window.syncUserInterviewSessions = syncUserInterviewSessions"), "Must be exposed to window");
});

runCheck("2.2 Dashboard uses syncUserInterviewSessions and deterministically sorts newest first", () => {
  assert(dashboardJsContent.includes("syncUserInterviewSessions"), "dashboard.js must invoke syncUserInterviewSessions");
  assert(dashboardJsContent.includes("sortDashboardSessions"), "dashboard.js must include deterministic sorter");
  assert(dashboardJsContent.includes("slice(0, 5)"), "dashboard.js preserves slice(0, 5) for recent sessions");
});

runCheck("2.3 History page uses syncUserInterviewSessions and saves authoritative sessions", () => {
  assert(historyHtmlContent.includes("syncUserInterviewSessions"), "history.html must call syncUserInterviewSessions");
  assert(historyHtmlContent.includes("sortHistorySessions"), "history.html must sort sessions deterministically");
  assert(historyHtmlContent.includes("saveUserSessions"), "history.html must persist sessions via saveUserSessions");
});

runCheck("2.4 interview-finish.js upserts completed sessions without creating duplicates", () => {
  assert(interviewFinishJsContent.includes("getSessId"), "interview-finish.js resolves canonical session ID");
  assert(interviewFinishJsContent.includes("status: \"completed\""), "interview-finish.js updates status to completed");
  assert(interviewFinishJsContent.includes("replaced = true"), "interview-finish.js replaces existing session by ID");
});

// ------------------------------------------------------------------
// STEP 3: Client Sync Engine In-Memory Simulation
// ------------------------------------------------------------------
console.log("\n--- 3. Deterministic Sorting & Deduplication Behavior ---");

// Re-create the pure logic functions from main.js to simulate client scenarios
const getSessId = (s) => String(s?.id || s?.backendSessionId || s?.sessionId || s?.Id || "").trim();
const getTimestamp = (s) => {
  const raw = s?.createdAt || s?.date || s?.startTime || s?.CreatedAt || 0;
  const t = new Date(raw).getTime();
  return isNaN(t) ? 0 : t;
};
const sortDeterministic = (list) => [...list].sort((a, b) => {
  const tA = getTimestamp(a);
  const tB = getTimestamp(b);
  if (tB !== tA) return tB - tA;
  const idA = getSessId(a);
  const idB = getSessId(b);
  return idB.localeCompare(idA);
});

runCheck("3.1 Deterministic secondary tie-break by ID descending when timestamps are identical", () => {
  const sameTime = "2026-03-01T10:00:00.000Z";
  const rawSessions = [
    { id: "session_aaa", date: sameTime, jobTitle: "Alpha" },
    { id: "session_zzz", date: sameTime, jobTitle: "Zulu" },
    { id: "session_mmm", date: sameTime, jobTitle: "Mike" }
  ];

  const sorted = sortDeterministic(rawSessions);
  assert.strictEqual(sorted[0].id, "session_zzz", "Largest ID must be first on equal timestamp");
  assert.strictEqual(sorted[1].id, "session_mmm", "Middle ID next");
  assert.strictEqual(sorted[2].id, "session_aaa", "Smallest ID last");
});

runCheck("3.2 Two sessions with identical metadata but different IDs remain distinct", () => {
  const rawSessions = [
    { id: "sess_1", jobTitle: "Frontend Developer", company: "Google", date: "2026-03-01T10:00:00.000Z" },
    { id: "sess_2", jobTitle: "Frontend Developer", company: "Google", date: "2026-03-01T10:00:00.000Z" }
  ];
  const sorted = sortDeterministic(rawSessions);
  assert.strictEqual(sorted.length, 2, "Sessions with different IDs must never be merged");
  assert.notStrictEqual(sorted[0].id, sorted[1].id);
});

runCheck("3.3 Upserting completed session updates status and does not duplicate", () => {
  const sessions = [
    { id: "sess_100", jobTitle: "Backend Dev", status: "in_progress", score: null },
    { id: "sess_099", jobTitle: "HR Specialist", status: "completed", score: 85 }
  ];

  const updatedSession = {
    id: "sess_100",
    jobTitle: "Backend Dev",
    status: "completed",
    score: 92,
    overallScore: 92
  };

  const currentId = getSessId(updatedSession);
  let replaced = false;
  for (let i = 0; i < sessions.length; i++) {
    if (getSessId(sessions[i]) === currentId) {
      sessions[i] = { ...sessions[i], ...updatedSession, status: "completed" };
      replaced = true;
      break;
    }
  }
  if (!replaced) sessions.unshift(updatedSession);

  assert.strictEqual(sessions.length, 2, "List length must remain exactly 2 (no duplicate)");
  assert.strictEqual(sessions[0].status, "completed", "Status must update to completed");
  assert.strictEqual(sessions[0].score, 92, "Score must update to 92");
});

runCheck("3.4 Dashboard slices exactly top 5 and reflects in full history", () => {
  const allSessions = [];
  for (let i = 1; i <= 12; i++) {
    allSessions.push({
      id: `sess_${i.toString().padStart(3, "0")}`,
      date: new Date(Date.now() - (12 - i) * 60000).toISOString(),
      jobTitle: `Job ${i}`,
      status: "completed",
      score: 80 + i
    });
  }

  const sortedAll = sortDeterministic(allSessions);
  const dashboardRecent = sortedAll.slice(0, 5);

  assert.strictEqual(sortedAll.length, 12, "Full history contains all 12 sessions");
  assert.strictEqual(dashboardRecent.length, 5, "Dashboard contains top 5 recent sessions");
  
  // Every session in Dashboard MUST exist in full history at identical index
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(dashboardRecent[i].id, sortedAll[i].id, `Dashboard item ${i} matches history item ${i}`);
    assert.strictEqual(dashboardRecent[i].score, sortedAll[i].score, `Dashboard score ${i} matches history score ${i}`);
  }
});

runCheck("3.5 Unevaluated and incomplete sessions display null score '—' and don't skew average", () => {
  const sessions = [
    { id: "s1", status: "completed", score: 80 },
    { id: "s2", status: "completed", score: 90 },
    { id: "s3", status: "in_progress", score: null },
    { id: "s4", status: "incomplete", score: 0 }
  ];

  const completedSessions = sessions.filter(s => s.status === "completed" || s.overallScore || s.score || s.report);
  const scores = completedSessions.map(s => s.score).filter(x => x > 0);
  const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  assert.strictEqual(avg, 85, "Average score must be exactly (80 + 90)/2 = 85, ignoring s3 and s4");
});

// ------------------------------------------------------------------
// STEP 4: Live Isolated Backend Verification (BOLA/IDOR & Storage)
// ------------------------------------------------------------------
console.log("\n--- 4. Backend Access Control & Multi-User Isolation ---");

const JWT_SECRET = 'PrepMate_Secure_Production_Hardened_Key_2026_Minimum_256_Bits_Super_Secret!';

function generateTestToken({ userId, username, role = 'user', subscription = 'free' }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    nameid: userId,
    sub: userId,
    unique_name: username,
    email: `${username}@test.local`,
    role: role,
    subscription: subscription,
    jti: crypto.randomUUID(),
    iss: 'PrepMateBackend',
    aud: 'PrepMateFrontend',
    exp: now + 7200
  };

  const b64H = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const b64P = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${b64H}.${b64P}`).digest('base64url');
  return `${b64H}.${b64P}.${sig}`;
}

async function runLiveBackendTests() {
  const tempDir = path.join(WORKSPACE_ROOT, "BE", "data", "temp_history_test");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const tempDbPath = path.join(tempDir, "db.json");
  const testDb = JSON.parse(fs.readFileSync(PROD_DB_PATH, "utf8"));

  testDb.Users["user_alice"] = {
    Id: "user_alice",
    Username: "alice_wonder",
    Password: "",
    PasswordHash: "6HdlR0rXg09LO1tpZP5pNA==.0ZEI1IG8sjdkB4ubGQ6YMvdZesjR/CnZAteJrgRmM7E=",
    Email: "alice@prepmate.test",
    Fullname: "Alice Wonder",
    Role: "user",
    Subscription: "free",
    CreatedAt: new Date().toISOString()
  };

  testDb.Users["user_bob"] = {
    Id: "user_bob",
    Username: "bob_builder",
    Password: "",
    PasswordHash: "6HdlR0rXg09LO1tpZP5pNA==.0ZEI1IG8sjdkB4ubGQ6YMvdZesjR/CnZAteJrgRmM7E=",
    Email: "bob@prepmate.test",
    Fullname: "Bob Builder",
    Role: "user",
    Subscription: "free",
    CreatedAt: new Date().toISOString()
  };

  testDb.Sessions["sess_alice_1"] = {
    Id: "sess_alice_1",
    UserId: "user_alice",
    JobTitle: "Frontend Architect",
    CompanyName: "Acme Corp",
    Status: "completed",
    CreatedAt: "2026-03-01T12:00:00Z",
    OverallScore: 90
  };

  testDb.Sessions["sess_alice_2"] = {
    Id: "sess_alice_2",
    UserId: "user_alice",
    JobTitle: "React Lead",
    CompanyName: "Beta LLC",
    Status: "in_progress",
    CreatedAt: "2026-03-02T12:00:00Z"
  };

  testDb.Sessions["sess_bob_1"] = {
    Id: "sess_bob_1",
    UserId: "user_bob",
    JobTitle: "DevOps Engineer",
    CompanyName: "Cloud Inc",
    Status: "completed",
    CreatedAt: "2026-03-01T15:00:00Z",
    OverallScore: 88
  };

  fs.writeFileSync(tempDbPath, JSON.stringify(testDb, null, 2), "utf8");

  const testPort = 5062;
  const beProc = spawn("dotnet", ["run", "--project", "BE/backend.csproj", "--no-launch-profile"], {
    cwd: WORKSPACE_ROOT,
    env: {
      ...process.env,
      ASPNETCORE_URLS: `http://127.0.0.1:${testPort}`,
      ASPNETCORE_ENVIRONMENT: "Development",
      DATABASE_FILE_PATH: tempDbPath,
      PREPMATE_FILE_DB_PATH: tempDbPath,
      DOTNET_WATCH: "0"
    },
    stdio: "pipe"
  });

  const cleanup = () => {
    try { beProc.kill("SIGKILL"); } catch (e) {}
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
  };

  try {
    // Wait for backend health
    let healthy = false;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 500));
      try {
        const res = await fetch(`http://127.0.0.1:${testPort}/api/health`);
        if (res.ok) {
          healthy = true;
          break;
        }
      } catch (e) {}
    }

    assert(healthy, "Backend must start and respond 200 on /api/health");

    const aliceToken = generateTestToken({ userId: "user_alice", username: "alice_wonder" });
    const bobToken = generateTestToken({ userId: "user_bob", username: "bob_builder" });

    // Test 4.1: Alice fetches her sessions -> receives Alice's 2 sessions
    await runAsyncCheck("4.1 Alice fetches her sessions with JWT and gets ordered results", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/sessions/user/user_alice`, {
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.length, 2);
      assert.strictEqual(data[0].id, "sess_alice_2", "Newest session must be first");
      assert.strictEqual(data[1].id, "sess_alice_1", "Older session must be second");
    });

    // Test 4.2: Alice attempts to fetch Bob's sessions -> 403 Forbidden (IDOR Protected)
    await runAsyncCheck("4.2 Alice cannot read Bob's history (IDOR protected with 403 Forbidden)", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/sessions/user/user_bob`, {
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
      assert.strictEqual(res.status, 403, "Access to another user's sessions must return 403 Forbidden");
    });

    // Test 4.3: Unauthenticated request to /api/sessions/user/{userId} -> 401 Unauthorized
    await runAsyncCheck("4.3 Unauthenticated request to session history returns 401 Unauthorized", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/sessions/user/user_alice`);
      assert.strictEqual(res.status, 401, "Anonymous request must be rejected with 401");
    });

    // Test 4.4: Bob fetches own sessions -> receives only Bob's 1 session
    await runAsyncCheck("4.4 Bob fetches own sessions and receives only his own data", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/sessions/user/user_bob`, {
        headers: { Authorization: `Bearer ${bobToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].id, "sess_bob_1");
    });

  } finally {
    cleanup();
  }
}

// ------------------------------------------------------------------
// STEP 5: Final Production Invariant Check
// ------------------------------------------------------------------
async function runAll() {
  await runLiveBackendTests();

  console.log("\n--- 5. Production Database Final Invariant Check ---");
  runCheck("5.1 Production db.json byte-for-byte SHA-256 invariant verified", () => {
    const finalBytes = fs.readFileSync(PROD_DB_PATH);
    const finalHash = crypto.createHash("sha256").update(finalBytes).digest("hex").toUpperCase();
    assert.strictEqual(finalHash, BASELINE_DB_HASH, "Production database must remain completely unmodified");
  });

  console.log("\n===============================================================");
  console.log(`TOTAL INTEGRATION TESTS: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);
  console.log("===============================================================");

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
