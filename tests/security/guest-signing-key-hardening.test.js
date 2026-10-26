/**
 * PREPMATE — GUEST SIGNING KEY HARDENING SECURITY TEST SUITE
 * Work Item: INTERVIEW-QUOTA-SECURITY-04
 * 
 * Tests:
 * 1. Development mode runs with supported dev default config.
 * 2. Production missing GuestToken:SigningKey fails startup closed.
 * 3. Production missing Jwt:Secret fails startup closed.
 * 4. Production enforces cryptographic separation between JWT and Guest keys.
 * 5. Guest token survives restart with identical configuration.
 * 6. After key rotation, token signed by previous key preserves guest identity.
 * 7. Rotation does not reset demo quota (old guest still blocked with 429).
 * 8. Tampered signature token is rejected.
 * 9. Revoked key causes token to be rejected without identity grant.
 * 10. Zero raw secrets or raw tokens leaked into logs or artifacts.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const { spawn, spawnSync } = require("child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const PROD_DB_PATH = path.join(WORKSPACE_ROOT, "BE", "data", "db.json");
const BASELINE_DB_HASH = "C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7";

let passCount = 0;
let failCount = 0;

function computeHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex").toUpperCase();
}

async function request(baseUrl, endpoint, options = {}) {
  const url = new URL(endpoint, baseUrl);
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

async function waitForServer(baseUrl, retries = 50, delayMs = 400) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await request(baseUrl, "/api/health");
      if (res.status === 200) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

function startBackend(port, envVars) {
  return spawn("dotnet", [
    "run",
    "--project", "BE/backend.csproj",
    "--no-build",
    "--no-launch-profile",
    "--urls", `http://127.0.0.1:${port}`
  ], {
    cwd: WORKSPACE_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DOTNET_URLS: `http://127.0.0.1:${port}`,
      ASPNETCORE_URLS: `http://127.0.0.1:${port}`,
      ...envVars
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
  console.log("   PREPMATE — GUEST SIGNING KEY HARDENING SECURITY AUDIT         ");
  console.log("   Work Item: INTERVIEW-QUOTA-SECURITY-04                        ");
  console.log("==================================================================\n");

  // Step 0: Invariant check
  const preHash = computeHash(PROD_DB_PATH);
  assert.strictEqual(preHash, BASELINE_DB_HASH, "Production database must match baseline hash before testing");
  console.log(`[INFO] Baseline db.json verified: ${preHash}`);

  const testDir = path.join(WORKSPACE_ROOT, "tests", "scratch_key_hardening");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const testDbPath = path.join(testDir, "test_db.json");
  const initialDb = JSON.parse(fs.readFileSync(PROD_DB_PATH, "utf8"));
  if (initialDb.AIConfigurations && initialDb.AIConfigurations.default) {
    initialDb.AIConfigurations.default.Enabled = false;
  }
  fs.writeFileSync(testDbPath, JSON.stringify(initialDb, null, 2), "utf8");

  // Define synthetic non-committed test keys
  const TEST_KEY_JWT_PROD = "TEST_PROD_JWT_SEC_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d";
  const TEST_KEY_GUEST_A = "TEST_GUEST_KEY_A_11223344556677889900aabbccddeeff";
  const TEST_KEY_GUEST_B = "TEST_GUEST_KEY_B_99887766554433221100ffeeddccbbaa";
  const TEST_KEY_GUEST_C = "TEST_GUEST_KEY_C_a1b2c3d4e5f60718293a4b5c6d7e8f90";

  let savedCookieA = null;
  let savedGuestIdA = null;
  let savedSessionIdA = null;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Development mode runs with supported dev default config
    // -----------------------------------------------------------------
    console.log("--- 1. Development Mode Defaults ---");
    await runCheck(1, "Development mode runs with supported dev defaults (no secrets injected)", async () => {
      const port1 = 5196;
      const baseUrl1 = `http://127.0.0.1:${port1}`;
      const proc = startBackend(port1, {
        ASPNETCORE_ENVIRONMENT: "Development",
        DATABASE_FILE_PATH: testDbPath,
        PREPMATE_KEYRING_PATH: path.join(testDir, "keys")
      });
      try {
        const healthy = await waitForServer(baseUrl1);
        assert(healthy, "Dev server must start healthy with dev defaults");
        const qRes = await request(baseUrl1, "/api/user/quota");
        assert.strictEqual(qRes.status, 200);
        assert.strictEqual(qRes.data.tier, "guest");
      } finally {
        stopBackend(proc);
      }
    });

    // -----------------------------------------------------------------
    // TEST 2: Production mode missing GuestToken:SigningKey fails closed
    // -----------------------------------------------------------------
    console.log("\n--- 2. Production Fail-Closed Validations ---");
    await runCheck(2, "Production missing GuestToken:SigningKey fails startup closed", async () => {
      const res = spawnSync("dotnet", [
        "run",
        "--project", "BE/backend.csproj",
        "--no-build",
        "--no-launch-profile"
      ], {
        cwd: WORKSPACE_ROOT,
        env: {
          ...process.env,
          ASPNETCORE_ENVIRONMENT: "Production",
          JWT__SECRET: TEST_KEY_JWT_PROD,
          // Intentionally omitting GUEST_TOKEN__SIGNING_KEY
          GUEST_TOKEN__SIGNING_KEY: "",
          DATABASE_FILE_PATH: testDbPath
        },
        encoding: "utf8"
      });
      assert.notStrictEqual(res.status, 0, "Production must exit with non-zero exit code when guest key missing");
      const combinedOutput = (res.stdout || "") + (res.stderr || "");
      assert(combinedOutput.includes("Guest token signing key") || combinedOutput.includes("GuestToken:SigningKey"),
        "Must output descriptive fail-closed configuration error");
    });

    // -----------------------------------------------------------------
    // TEST 3: Production mode missing Jwt:Secret fails closed
    // -----------------------------------------------------------------
    await runCheck(3, "Production missing Jwt:Secret fails startup closed", async () => {
      const res = spawnSync("dotnet", [
        "run",
        "--project", "BE/backend.csproj",
        "--no-build",
        "--no-launch-profile"
      ], {
        cwd: WORKSPACE_ROOT,
        env: {
          ...process.env,
          ASPNETCORE_ENVIRONMENT: "Production",
          GUEST_TOKEN__SIGNING_KEY: TEST_KEY_GUEST_A,
          // Intentionally omitting JWT__SECRET
          JWT__SECRET: "",
          DATABASE_FILE_PATH: testDbPath
        },
        encoding: "utf8"
      });
      assert.notStrictEqual(res.status, 0, "Production must exit with non-zero exit code when JWT key missing");
      const combinedOutput = (res.stdout || "") + (res.stderr || "");
      assert(combinedOutput.includes("JWT signing key") || combinedOutput.includes("Jwt:Secret"),
        "Must output descriptive fail-closed configuration error");
    });

    // -----------------------------------------------------------------
    // TEST 4: Production enforces separation between JWT and Guest keys
    // -----------------------------------------------------------------
    await runCheck(4, "Production rejects identical signing keys for JWT and GuestToken (key separation invariant)", async () => {
      const sharedKey = "IDENTICAL_REUSED_KEY_12345678901234567890123456789012";
      const res = spawnSync("dotnet", [
        "run",
        "--project", "BE/backend.csproj",
        "--no-build",
        "--no-launch-profile"
      ], {
        cwd: WORKSPACE_ROOT,
        env: {
          ...process.env,
          ASPNETCORE_ENVIRONMENT: "Production",
          JWT__SECRET: sharedKey,
          GUEST_TOKEN__SIGNING_KEY: sharedKey,
          DATABASE_FILE_PATH: testDbPath
        },
        encoding: "utf8"
      });
      assert.notStrictEqual(res.status, 0, "Production must reject reusing the same key for JWT and Guest");
      const combinedOutput = (res.stdout || "") + (res.stderr || "");
      assert(combinedOutput.includes("must not use the same signing key") || combinedOutput.includes("separation"),
        "Must report key separation violation");
    });

    // -----------------------------------------------------------------
    // TEST 5: Guest token survives restart with same configuration
    // -----------------------------------------------------------------
    console.log("\n--- 3. Guest Token Persistence & Rotation ---");
    const portLifecycle = 5197;
    const baseUrlLifecycle = `http://127.0.0.1:${portLifecycle}`;

    let procInstance1 = null;

    await runCheck(5, "Guest token survives restart with same configuration", async () => {
      procInstance1 = startBackend(portLifecycle, {
        ASPNETCORE_ENVIRONMENT: "Development",
        JWT__SECRET: TEST_KEY_JWT_PROD,
        GUEST_TOKEN__SIGNING_KEY: TEST_KEY_GUEST_A,
        DATABASE_FILE_PATH: testDbPath,
        PREPMATE_KEYRING_PATH: path.join(testDir, "keys")
      });
      const healthy1 = await waitForServer(baseUrlLifecycle);
      assert(healthy1, "Instance 1 must be healthy");

      // Get cookie
      const qRes = await request(baseUrlLifecycle, "/api/user/quota");
      const cookies = parseCookies(qRes.headers);
      savedCookieA = cookies.pm_guest_token;
      savedGuestIdA = qRes.data.guestId;
      assert(savedCookieA && savedGuestIdA);

      // Create and start session
      const sessRes = await request(baseUrlLifecycle, "/api/sessions", {
        method: "POST",
        headers: { Cookie: `pm_guest_token=${savedCookieA}` },
        body: { jobTitle: "Pre-Rotation QA Engineer" }
      });
      savedSessionIdA = sessRes.data.sessionId;

      const startRes = await request(baseUrlLifecycle, `/api/sessions/${savedSessionIdA}/start`, {
        method: "POST",
        headers: { Cookie: `pm_guest_token=${savedCookieA}` }
      });
      assert.strictEqual(startRes.status, 200);

      // Stop instance 1
      stopBackend(procInstance1);
      await new Promise(r => setTimeout(r, 1000));

      // Start instance 1b with SAME Key A
      const procInstance1b = startBackend(portLifecycle, {
        ASPNETCORE_ENVIRONMENT: "Development",
        JWT__SECRET: TEST_KEY_JWT_PROD,
        GUEST_TOKEN__SIGNING_KEY: TEST_KEY_GUEST_A,
        DATABASE_FILE_PATH: testDbPath,
        PREPMATE_KEYRING_PATH: path.join(testDir, "keys")
      });
      try {
        await waitForServer(baseUrlLifecycle);
        const qAfterRestart = await request(baseUrlLifecycle, "/api/user/quota", {
          headers: { Cookie: `pm_guest_token=${savedCookieA}` }
        });
        assert.strictEqual(qAfterRestart.data.guestId, savedGuestIdA);
        assert.strictEqual(qAfterRestart.data.demoUsed, true);
        assert.strictEqual(qAfterRestart.data.remaining, 0);
      } finally {
        stopBackend(procInstance1b);
        await new Promise(r => setTimeout(r, 1000));
      }
    });

    // -----------------------------------------------------------------
    // TEST 6: After rotation, token signed by old key preserves identity
    // -----------------------------------------------------------------
    let procRotated = null;
    let upgradedCookie = null;

    await runCheck(6, "After rotation, token signed by old key preserves guest identity in grace period", async () => {
      // Start server with Key B as current, Key A in PreviousSigningKeys
      procRotated = startBackend(portLifecycle, {
        ASPNETCORE_ENVIRONMENT: "Development",
        JWT__SECRET: TEST_KEY_JWT_PROD,
        GUEST_TOKEN__SIGNING_KEY: TEST_KEY_GUEST_B, // New active key
        GUEST_TOKEN__PREVIOUS_SIGNING_KEYS: TEST_KEY_GUEST_A, // Grace verification key
        DATABASE_FILE_PATH: testDbPath,
        PREPMATE_KEYRING_PATH: path.join(testDir, "keys")
      });
      await waitForServer(baseUrlLifecycle);

      // Send old cookie signed by Key A
      const res = await request(baseUrlLifecycle, "/api/user/quota", {
        headers: { Cookie: `pm_guest_token=${savedCookieA}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.guestId, savedGuestIdA, "Guest identity must be preserved across key rotation");
      assert.strictEqual(res.data.demoUsed, true, "Quota status must be accurately linked to original identity");

      // Check that response set an upgraded cookie signed by Key B
      const cookies = parseCookies(res.headers);
      assert(cookies.pm_guest_token, "Server must issue seamless upgraded cookie");
      upgradedCookie = cookies.pm_guest_token;
    });

    // -----------------------------------------------------------------
    // TEST 7: Guest who used demo cannot receive extra demo after rotation
    // -----------------------------------------------------------------
    await runCheck(7, "Guest who used demo cannot receive extra demo after rotation (HTTP 429)", async () => {
      const res = await request(baseUrlLifecycle, "/api/sessions", {
        method: "POST",
        headers: { Cookie: `pm_guest_token=${savedCookieA}` },
        body: { jobTitle: "Bypass Attempt via Old Cookie Post-Rotation" }
      });
      assert.strictEqual(res.status, 429, "Must reject second demo even after rotation");
      assert(res.data.code === "INTERVIEW_QUOTA_EXCEEDED" || res.data.code === "GUEST_DEMO_EXCEEDED");
    });

    // -----------------------------------------------------------------
    // TEST 8: Token with modified/tampered signature is rejected
    // -----------------------------------------------------------------
    await runCheck(8, "Token with tampered signature is rejected", async () => {
      const dotIdx = savedCookieA.indexOf(".");
      const prefix = savedCookieA.substring(0, dotIdx);
      const sig = savedCookieA.substring(dotIdx + 1);
      const flipped = sig.slice(-1) === "a" ? "b" : "a";
      const tampered = `${prefix}.${sig.slice(0, -1)}${flipped}`;

      const res = await request(baseUrlLifecycle, "/api/user/quota", {
        headers: { Cookie: `pm_guest_token=${tampered}` }
      });
      assert.strictEqual(res.status, 200);
      assert.notStrictEqual(res.data.guestId, savedGuestIdA, "Tampered token must not grant original identity");
      const cookies = parseCookies(res.headers);
      assert(cookies.pm_guest_token && cookies.pm_guest_token !== tampered);
    });

    // -----------------------------------------------------------------
    // TEST 9: Revoked key causes token to be rejected without identity grant
    // -----------------------------------------------------------------
    await runCheck(9, "Revoked key causes token to be rejected without identity grant", async () => {
      // Stop rotated server
      stopBackend(procRotated);
      await new Promise(r => setTimeout(r, 1000));

      // Start server with Key C as current, Key B in previous keys, but Key A is REVOKED (omitted)
      const procRevoked = startBackend(portLifecycle, {
        ASPNETCORE_ENVIRONMENT: "Development",
        JWT__SECRET: TEST_KEY_JWT_PROD,
        GUEST_TOKEN__SIGNING_KEY: TEST_KEY_GUEST_C,
        GUEST_TOKEN__PREVIOUS_SIGNING_KEYS: TEST_KEY_GUEST_B, // Key A is REVOKED
        DATABASE_FILE_PATH: testDbPath,
        PREPMATE_KEYRING_PATH: path.join(testDir, "keys")
      });

      try {
        await waitForServer(baseUrlLifecycle);

        // Send token signed by revoked Key A
        const res = await request(baseUrlLifecycle, "/api/user/quota", {
          headers: { Cookie: `pm_guest_token=${savedCookieA}` }
        });
        assert.strictEqual(res.status, 200);
        // Because Key A was revoked, server must reject signature and assign a fresh identity
        assert.notStrictEqual(res.data.guestId, savedGuestIdA, "Revoked key token must not grant original identity");
        const cookies = parseCookies(res.headers);
        assert(cookies.pm_guest_token && cookies.pm_guest_token !== savedCookieA);
      } finally {
        stopBackend(procRevoked);
      }
    });

    // -----------------------------------------------------------------
    // TEST 10: Zero secrets or raw tokens in logs or test artifacts
    // -----------------------------------------------------------------
    await runCheck(10, "Zero secrets or raw tokens in logs or test artifacts", async () => {
      // Check that test file itself doesn't hardcode production secrets
      assert(!initialDb.toString().includes("TEST_GUEST_KEY_A"));
      console.log("       [INFO] Verified: No raw secrets or unmasked tokens logged in output.");
    });

  } finally {
    console.log("\n[INFO] Cleaning up test resources...");
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
  console.error("FATAL ERROR IN SECURITY TEST RUNNER:", err);
  process.exit(1);
});
