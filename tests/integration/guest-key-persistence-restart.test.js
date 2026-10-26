/**
 * PREPMATE — GUEST SIGNING-KEY PERSISTENCE & RESTART AUDIT
 * Work Item: INTERVIEW-QUOTA-VERIFY-03
 * 
 * Verifies:
 * 1. HMAC-SHA256 signing key persistence across backend restarts.
 * 2. Old guest cookie sent after restart preserves exact identity.
 * 3. Guest who consumed demo is blocked from second demo after restart (HTTP 429).
 * 4. Fresh guest visiting after restart is issued new valid identity and can start demo.
 * 5. Forged and tampered tokens after restart are rejected.
 * 6. Production database SHA-256 invariant strictly preserved.
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

const TEST_PORT = 5195;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const PERSISTENT_TEST_SECRET = "PrepMate_Persistent_Secret_Verification_Key_2026_Test!";

let passCount = 0;
let failCount = 0;

function computeHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex").toUpperCase();
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

function startBackend(dbPath, testDir) {
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
      DATABASE_FILE_PATH: dbPath,
      DATABASE__FILEPATH: dbPath,
      DATABASE__FILE_PATH: dbPath,
      FILE_DB_PATH: dbPath,
      JWT__SECRET: PERSISTENT_TEST_SECRET,
      "Jwt:Secret": PERSISTENT_TEST_SECRET,
      PREPMATE_KEYRING_PATH: path.join(testDir, "keys")
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function stopBackend(proc) {
  if (!proc) return;
  try {
    if (process.platform === "win32") {
      require("child_process").execSync(`taskkill /F /T /PID ${proc.pid} 2>nul`);
    } else {
      proc.kill("SIGKILL");
    }
  } catch (_) {}
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

async function main() {
  console.log("==================================================================");
  console.log("   PREPMATE — GUEST KEY PERSISTENCE & RESTART AUDIT SUITE        ");
  console.log("   Work Item: INTERVIEW-QUOTA-VERIFY-03                          ");
  console.log("==================================================================\n");

  // Step 0: Invariant check before any test execution
  const preHash = computeHash(PROD_DB_PATH);
  assert.strictEqual(preHash, BASELINE_DB_HASH, "Production database must match baseline hash before testing");
  console.log(`[INFO] Baseline db.json verified: ${preHash}`);

  // Setup isolated scratch test directory
  const testDir = path.join(WORKSPACE_ROOT, "tests", "scratch_guest_key_test");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const testDbPath = path.join(testDir, "test_db.json");
  const initialDb = JSON.parse(fs.readFileSync(PROD_DB_PATH, "utf8"));
  if (initialDb.AIConfigurations && initialDb.AIConfigurations.default) {
    initialDb.AIConfigurations.default.Enabled = false;
  }
  fs.writeFileSync(testDbPath, JSON.stringify(initialDb, null, 2), "utf8");

  let serverProcess = null;
  let savedGuestCookie = null;
  let savedGuestId = null;
  let savedSessionId = null;

  try {
    // =================================================================
    // PHASE 1: PRE-RESTART EXECUTION
    // =================================================================
    console.log("\n--- PHASE 1: PRE-RESTART GUEST LIFECYCLE ---");
    console.log(`[INFO] Starting Backend Instance #1 on port ${TEST_PORT}...`);
    serverProcess = startBackend(testDbPath, testDir);
    await waitForServer();
    console.log(`[INFO] Instance #1 is healthy on ${BASE_URL}\n`);

    await runCheck(1, "Instance #1 issues valid server-signed pm_guest_token", async () => {
      const res = await request("/api/user/quota");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.tier, "guest");
      assert.strictEqual(res.data.demoUsed, false);
      assert.strictEqual(res.data.canStart, true);

      const cookies = parseCookies(res.headers);
      assert(cookies.pm_guest_token, "Must issue pm_guest_token cookie");
      assert(cookies.pm_guest_token.startsWith("pmg_"), "Must have pmg_ prefix");
      assert(cookies.pm_guest_token.includes("."), "Must contain signature dot separator");

      savedGuestCookie = cookies.pm_guest_token;
      savedGuestId = res.data.guestId;
      assert(savedGuestId && savedGuestId.startsWith("guest_"), "Guest ID must have guest_ prefix");
    });

    await runCheck(2, "Instance #1: Guest creates demo session", async () => {
      const res = await request("/api/sessions", {
        method: "POST",
        headers: { Cookie: `pm_guest_token=${savedGuestCookie}` },
        body: { jobTitle: "Junior React QA Engineer" }
      });
      assert.strictEqual(res.status, 200);
      assert(res.data.sessionId, "Must return sessionId");
      savedSessionId = res.data.sessionId;
    });

    await runCheck(3, "Instance #1: Guest starts demo session (consuming demo entitlement)", async () => {
      const startRes = await request(`/api/sessions/${savedSessionId}/start`, {
        method: "POST",
        headers: { Cookie: `pm_guest_token=${savedGuestCookie}` }
      });
      assert.strictEqual(startRes.status, 200);
      assert.strictEqual(startRes.data.isStarted, true);
      assert.strictEqual(startRes.data.planSnapshot, "guest");

      // Verify quota is marked demoUsed: true
      const qRes = await request("/api/user/quota", {
        headers: { Cookie: `pm_guest_token=${savedGuestCookie}` }
      });
      assert.strictEqual(qRes.data.demoUsed, true);
      assert.strictEqual(qRes.data.remaining, 0);
      assert.strictEqual(qRes.data.canStart, false);
    });

    // =================================================================
    // PHASE 2: RESTART BACKEND (SIMULATING PRODUCTION RESTART)
    // =================================================================
    console.log("\n--- PHASE 2: RESTART BACKEND WITH IDENTICAL CONFIGURATION ---");
    console.log("[INFO] Stopping Instance #1...");
    stopBackend(serverProcess);
    await new Promise(r => setTimeout(r, 1200));

    console.log("[INFO] Starting Backend Instance #2 with exact same configuration & database...");
    serverProcess = startBackend(testDbPath, testDir);
    await waitForServer();
    console.log(`[INFO] Instance #2 is healthy on ${BASE_URL}\n`);

    // =================================================================
    // PHASE 3: POST-RESTART VERIFICATION
    // =================================================================
    console.log("--- PHASE 3: POST-RESTART IDENTITY & SIGNING KEY PERSISTENCE ---");

    await runCheck(4, "Instance #2 validates original cookie & reconstructs identical guestId", async () => {
      const res = await request("/api/user/quota", {
        headers: { Cookie: `pm_guest_token=${savedGuestCookie}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.tier, "guest");
      assert.strictEqual(res.data.guestId, savedGuestId, "Guest ID must match pre-restart identity exactly");
      assert.strictEqual(res.data.demoUsed, true, "demoUsed state must be reconstructed from persistent db");
      assert.strictEqual(res.data.remaining, 0);
      assert.strictEqual(res.data.canStart, false);
    });

    await runCheck(5, "Instance #2 blocks second demo creation from old guest (HTTP 429)", async () => {
      const res = await request("/api/sessions", {
        method: "POST",
        headers: { Cookie: `pm_guest_token=${savedGuestCookie}` },
        body: { jobTitle: "Second Demo Attempt After Restart" }
      });
      assert.strictEqual(res.status, 429, "Must return HTTP 429");
      assert(res.data.code === "INTERVIEW_QUOTA_EXCEEDED" || res.data.code === "GUEST_DEMO_EXCEEDED");
    });

    await runCheck(6, "Instance #2 can still issue fresh valid guest token to new visitor", async () => {
      const res = await request("/api/user/quota");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.tier, "guest");
      assert.strictEqual(res.data.demoUsed, false);
      assert.strictEqual(res.data.remaining, 1);
      assert.strictEqual(res.data.canStart, true);

      const cookies = parseCookies(res.headers);
      assert(cookies.pm_guest_token, "Must issue new cookie to fresh guest");
      assert.notStrictEqual(res.data.guestId, savedGuestId, "New guest must have distinct identity");
    });

    await runCheck(7, "Instance #2 rejects forged token (tampered HMAC signature)", async () => {
      // Create tampered token by modifying the signature part
      const dotIndex = savedGuestCookie.indexOf(".");
      const prefix = savedGuestCookie.substring(0, dotIndex);
      const originalSig = savedGuestCookie.substring(dotIndex + 1);
      // Flip last character of hex signature
      const lastChar = originalSig.slice(-1);
      const flippedChar = lastChar === "a" ? "b" : "a";
      const tamperedCookie = `${prefix}.${originalSig.slice(0, -1)}${flippedChar}`;

      const res = await request("/api/user/quota", {
        headers: { Cookie: `pm_guest_token=${tamperedCookie}` }
      });
      assert.strictEqual(res.status, 200);
      // Tampered token fails HMAC verification -> server discards it and issues fresh identity
      assert.notStrictEqual(res.data.guestId, savedGuestId, "Tampered token must not grant original guest identity");
      const cookies = parseCookies(res.headers);
      assert(cookies.pm_guest_token, "Server must issue replacement signed cookie");
      assert.notStrictEqual(cookies.pm_guest_token, tamperedCookie, "Server must replace invalid cookie");
    });

    await runCheck(8, "Instance #2 rejects completely arbitrary self-minted token string", async () => {
      const fakeToken = "pmg_fakeentropy1234567890abcdef.invalidsignature000000000000000000000000000000000000000000000000";
      const res = await request("/api/user/quota", {
        headers: { Cookie: `pm_guest_token=${fakeToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.notStrictEqual(res.data.guestId, savedGuestId);
      const cookies = parseCookies(res.headers);
      assert(cookies.pm_guest_token && cookies.pm_guest_token !== fakeToken);
    });

  } finally {
    console.log("\n[INFO] Terminating backend process...");
    stopBackend(serverProcess);

    // Clean up temporary test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (_) {}

    // Step Final: Verify production DB hash invariant
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
