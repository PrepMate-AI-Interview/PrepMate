/**
 * PREPMATE — ELEVENLABS TTS & VOICE DESIGN HTTP CONTRACT VERIFICATION
 * Work Item: WI-INTERVIEWER-VOICE-03A
 *
 * Verifies exact HTTP request URLs, headers, and outgoing JSON payloads sent
 * by ElevenLabsTtsService / TTSController to ElevenLabs using a mock HTTP server.
 * Requires NO real API key and makes ZERO real external network calls.
 */

const assert = require("assert");
const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");

const MOCK_ELEVENLABS_PORT = 19283;
const BACKEND_PORT = 5002;
const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const { resolveDbPath } = require('../helpers/test-env');
const PROD_DB_PATH = resolveDbPath();
const TEST_DIR = path.join(os.tmpdir(), `prepmate_contract_${Date.now()}`);
const ISOLATED_DB_PATH = path.join(TEST_DIR, "isolated_contract_db.json");

function computeHash(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex").toUpperCase();
}

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
        "Content-Type": "application/json",
        ...(options.headers || {}),
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
    req.setTimeout(10000, () => req.destroy(new Error(`Timeout calling ${url}`)));

    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function pass(desc) {
  console.log(`  [PASS] ${desc}`);
}

async function runTestSuite() {
  console.log("===============================================================");
  console.log("   WI-INTERVIEWER-VOICE-03A: HTTP CONTRACT VERIFICATION       ");
  console.log("===============================================================\n");

  const baselineHash = computeHash(PROD_DB_PATH);
  console.log(`[PRE-CHECK] Baseline DB Hash: ${baselineHash}`);
  assert.ok(baselineHash && baselineHash.length === 64, "Baseline DB hash must be a valid 64-char SHA-256");

  let checksPassed = 0;
  const capturedRequests = [];

  // Start Fake ElevenLabs Mock Server
  const mockServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let parsed = null;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        parsed = body;
      }

      capturedRequests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: parsed,
      });

      // Handle endpoints
      if (req.method === "GET" && req.url === "/v1/voices") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            voices: [
              {
                voice_id: "vi_namminh",
                name: "Nam Minh",
                category: "cloned",
                labels: { language: "Vietnamese", gender: "male" },
              },
            ],
          })
        );
      }

      if (req.method === "POST" && req.url.startsWith("/v1/text-to-speech")) {
        if (req.url.includes("err_restricted")) {
          res.writeHead(401, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              detail: {
                status: "detected_unusual_activity",
                message: "Unusual activity has been detected on your account, so Free Tier access has been disabled.",
              },
            })
          );
        }
        if (req.url.includes("err_quota")) {
          res.writeHead(429, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              detail: {
                status: "quota_exceeded",
                message: "Quota exceeded for current billing cycle.",
              },
            })
          );
        }
        if (req.url.includes("err_unauthorized")) {
          res.writeHead(401, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              detail: "Invalid API key provided.",
            })
          );
        }

        res.writeHead(200, { "Content-Type": "audio/mpeg" });
        return res.end(Buffer.from("ID3_MOCK_MP3_AUDIO_STREAM_BYTES"));
      }

      if (req.method === "POST" && req.url === "/v1/text-to-voice/design") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            previews: [
              {
                generated_voice_id: "gen_voice_contract_01",
                audio_base_64: "UklGRg==",
                duration_secs: 5.2,
                media_type: "audio/mpeg",
                language: "vi",
              },
            ],
            text: "Xin chào bạn, tôi là người phỏng vấn được tạo tự động.",
          })
        );
      }

      if (req.method === "POST" && req.url === "/v1/text-to-voice") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            voice_id: "saved_voice_contract_999",
            name: parsed.voice_name || "Saved Voice",
          })
        );
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Endpoint not found on mock server" }));
    });
  });

  await new Promise((resolve) => mockServer.listen(MOCK_ELEVENLABS_PORT, "127.0.0.1", resolve));
  console.log(`[MOCK] ElevenLabs mock server running on port ${MOCK_ELEVENLABS_PORT}`);

  // Launch isolated ASP.NET Core backend instance
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.copyFileSync(PROD_DB_PATH, ISOLATED_DB_PATH);

  const beDir = path.join(WORKSPACE_ROOT, "BE");
  const dllPath = path.join(beDir, "bin", "Debug", "net10.0", "backend.dll");

  const backendProc = spawn(
    "dotnet",
    [dllPath, "--urls", `http://127.0.0.1:${BACKEND_PORT}`],
    {
      cwd: beDir,
      env: {
        ...process.env,
        ELEVENLABS_API_KEY: "test_contract_api_key_mock_123",
        ELEVENLABS_BASE_URL: `http://127.0.0.1:${MOCK_ELEVENLABS_PORT}`,
        ElevenLabs__BaseUrl: `http://127.0.0.1:${MOCK_ELEVENLABS_PORT}`,
        ElevenLabs__ApiKey: "test_contract_api_key_mock_123",
        DATABASE_FILE_PATH: ISOLATED_DB_PATH,
        PREPMATE_DATABASE_PATH: ISOLATED_DB_PATH,
        ASPNETCORE_URLS: `http://127.0.0.1:${BACKEND_PORT}`,
      },
      stdio: "ignore",
    }
  );

  let backendReady = false;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    try {
      const ping = await requestJson(`http://127.0.0.1:${BACKEND_PORT}/api/tts/status`);
      if (ping.status === 200 && ping.body.configured === true) {
        backendReady = true;
        break;
      }
    } catch (e) {}
  }

  assert.ok(backendReady, "Isolated backend failed to start with mock ElevenLabs config");
  console.log(`[BACKEND] Isolated backend running on port ${BACKEND_PORT} with mock ElevenLabs proxy.`);

  try {
    // ------------------------------------------------------------------------
    // CHECK 1 & 2: TTS MODEL & VOICE DESIGN MODEL SEPARATION
    // ------------------------------------------------------------------------
    console.log("\n--- CONTRACT 1 & 2: Model Separation & Voice Design Enum ---");
    const statusRes = await requestJson(`http://127.0.0.1:${BACKEND_PORT}/api/tts/status`);
    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusRes.body.defaultTtsModel, "eleven_flash_v2_5", "TTS model defaults to eleven_flash_v2_5");
    assert.strictEqual(
      statusRes.body.defaultVoiceDesignModel,
      "eleven_multilingual_ttv_v2",
      "Voice Design model defaults to eleven_multilingual_ttv_v2"
    );
    assert.notStrictEqual(
      statusRes.body.defaultTtsModel,
      statusRes.body.defaultVoiceDesignModel,
      "TTS and Voice Design models are strictly separate configurations"
    );
    pass("1. TTS model (eleven_flash_v2_5) and Voice Design model (eleven_multilingual_ttv_v2) are separate configurations");
    checksPassed++;

    // ------------------------------------------------------------------------
    // CHECK 3 & 4: VOICE DESIGN PREVIEW PAYLOAD & AUTO-GENERATE TEXT CONTRACT
    // ------------------------------------------------------------------------
    console.log("\n--- CONTRACT 3 & 4: Voice Design Preview HTTP Contract ---");
    capturedRequests.length = 0;

    const previewRes = await requestJson(
      `http://127.0.0.1:${BACKEND_PORT}/api/tts/voice-design/preview`,
      { method: "POST" },
      {
        description: "Giọng nam tiếng Việt tự nhiên, điềm tĩnh nhưng kiên định, chuyên phỏng vấn kỹ thuật.",
        industryContext: "Công nghệ thông tin",
      }
    );

    assert.strictEqual(previewRes.status, 200, "Preview returns 200 OK");
    assert.strictEqual(capturedRequests.length, 1, "Exactly one outgoing request sent to mock ElevenLabs");

    const req1 = capturedRequests[0];
    assert.strictEqual(req1.method, "POST");
    assert.strictEqual(req1.url, "/v1/text-to-voice/design", "Outgoing URL must be /v1/text-to-voice/design");
    assert.strictEqual(req1.headers["xi-api-key"], "test_contract_api_key_mock_123", "xi-api-key sent by backend proxy");
    assert.strictEqual(req1.body.model_id, "eleven_multilingual_ttv_v2", "Voice Design sends eleven_multilingual_ttv_v2");
    assert.strictEqual(req1.body.auto_generate_text, true, "auto_generate_text: true sent when text is omitted");
    assert.strictEqual(req1.body.text, undefined, "text field omitted from JSON payload when auto-generating text");
    assert.ok(req1.body.voice_description.includes("Giọng nam tiếng Việt"), "voice_description received");
    pass("2. Voice Design sends POST /v1/text-to-voice/design with model_id=eleven_multilingual_ttv_v2 and auto_generate_text=true");
    checksPassed++;

    // Check preview response preserves language
    assert.strictEqual(previewRes.body.previews[0].generatedVoiceId, "gen_voice_contract_01");
    assert.strictEqual(previewRes.body.previews[0].language, "vi", "Preview item preserves language field");
    assert.strictEqual(previewRes.body.previews[0].durationSecs, 5.2, "Preview item preserves durationSecs");
    assert.strictEqual(previewRes.body.previews[0].mediaType, "audio/mpeg", "Preview item preserves mediaType");
    pass("3. Preview item response correctly preserves generated_voice_id, duration_secs, media_type, and language");
    checksPassed++;

    // ------------------------------------------------------------------------
    // CHECK 5: VOICE DESIGN WITH CUSTOM TEXT (100-1000 CHARS)
    // ------------------------------------------------------------------------
    console.log("\n--- CONTRACT 5: Voice Design with Custom Text (100-1000 chars) ---");
    capturedRequests.length = 0;

    const customText120 = "Xin chào bạn, tôi là người phỏng vấn của bạn hôm nay tại PrepMate. Tôi sẽ cùng bạn rà soát các kỹ năng và kinh nghiệm cần thiết cho vị trí này.";
    assert.ok(customText120.length >= 100 && customText120.length <= 1000, "Test string is between 100 and 1000 chars");

    await requestJson(
      `http://127.0.0.1:${BACKEND_PORT}/api/tts/voice-design/preview`,
      { method: "POST" },
      {
        description: "Giọng nữ tiếng Việt truyền cảm, rõ ràng, phong thái phỏng vấn nhân sự chuyên nghiệp.",
        text: customText120,
      }
    );

    assert.strictEqual(capturedRequests.length, 1);
    const req2 = capturedRequests[0];
    assert.strictEqual(req2.url, "/v1/text-to-voice/design");
    assert.strictEqual(req2.body.auto_generate_text, false, "auto_generate_text: false when custom text provided");
    assert.strictEqual(req2.body.text, customText120, "Exact custom text sent in payload");
    pass("4. Custom text (100-1000 chars) sets auto_generate_text=false and transmits valid text string");
    checksPassed++;

    // ------------------------------------------------------------------------
    // CHECK 6 & 7: SAVE VOICE URL & 3 REQUIRED FIELDS
    // ------------------------------------------------------------------------
    console.log("\n--- CONTRACT 6 & 7: Save Voice URL & Required Fields ---");
    capturedRequests.length = 0;

    const saveRes = await requestJson(
      `http://127.0.0.1:${BACKEND_PORT}/api/tts/voice-design/save`,
      { method: "POST" },
      {
        voiceName: "Giám đốc Kỹ thuật Minh Vũ",
        voiceDescription: "Chuyên gia phỏng vấn hệ thống và tư duy logic",
        generatedVoiceId: "gen_voice_contract_01",
      }
    );

    assert.strictEqual(saveRes.status, 200, "Save voice returns 200 OK");
    assert.strictEqual(capturedRequests.length, 1);

    const req3 = capturedRequests[0];
    assert.strictEqual(req3.method, "POST");
    assert.strictEqual(req3.url, "/v1/text-to-voice", "Save voice URL must be exactly /v1/text-to-voice");
    assert.strictEqual(req3.body.voice_name, "Giám đốc Kỹ thuật Minh Vũ", "voice_name transmitted");
    assert.strictEqual(req3.body.voice_description, "Chuyên gia phỏng vấn hệ thống và tư duy logic", "voice_description transmitted");
    assert.strictEqual(req3.body.generated_voice_id, "gen_voice_contract_01", "generated_voice_id transmitted");
    assert.strictEqual(saveRes.body.voiceId, "saved_voice_contract_999", "Returns saved voiceId");
    pass("5. Save voice invokes POST /v1/text-to-voice with all 3 required fields (voice_name, voice_description, generated_voice_id)");
    checksPassed++;

    // ------------------------------------------------------------------------
    // CHECK 8: TTS SPEAK CALL VERIFIES DEFAULT POLICY (NO enable_logging=false)
    // ------------------------------------------------------------------------
    console.log("\n--- CONTRACT 8: TTS Speak Policy & Execution ---");
    capturedRequests.length = 0;

    const speakRes = await requestJson(
      `http://127.0.0.1:${BACKEND_PORT}/api/tts/speak`,
      { method: "POST" },
      {
        text: "Hãy giới thiệu về bản thân bạn và kinh nghiệm làm việc liên quan.",
        voiceId: "vi_namminh",
        speed: 1.0,
      }
    );

    assert.strictEqual(speakRes.status, 200, "TTS speak returns 200 OK");
    assert.strictEqual(capturedRequests.length, 1);

    const req4 = capturedRequests[0];
    assert.strictEqual(req4.url, "/v1/text-to-speech/vi_namminh", "Default TTS speak URL must NOT contain ?enable_logging=false");
    assert.strictEqual(req4.body.model_id, "eleven_flash_v2_5", "TTS speak sends model_id=eleven_flash_v2_5 (TTS model)");
    pass("6. Default TTS speak invokes /v1/text-to-speech/{id} without enable_logging parameter");
    checksPassed++;

    // ------------------------------------------------------------------------
    // CHECK 9: CLIENT PAYLOAD CANNOT FORCE ZERO RETENTION / ENABLE_LOGGING
    // ------------------------------------------------------------------------
    console.log("\n--- CONTRACT 9: Client Tamper Resistance for Zero Retention ---");
    capturedRequests.length = 0;

    const tamperRes = await requestJson(
      `http://127.0.0.1:${BACKEND_PORT}/api/tts/speak`,
      { method: "POST" },
      {
        text: "Kiểm tra client không thể tự bật Zero Retention qua request payload.",
        voiceId: "vi_namminh",
        speed: 1.0,
        enable_logging: false,
        zeroRetention: true,
      }
    );

    assert.strictEqual(tamperRes.status, 200, "TTS speak returns 200 OK");
    assert.strictEqual(capturedRequests.length, 1);
    assert.strictEqual(
      capturedRequests[0].url,
      "/v1/text-to-speech/vi_namminh",
      "Client payload cannot force enable_logging=false on URL"
    );
    pass("7. Client payload cannot force Zero Retention / enable_logging parameter");
    checksPassed++;

    // ------------------------------------------------------------------------
    // CHECK 10: PROVIDER ERROR CLASSIFICATION (ACCOUNT RESTRICTED, QUOTA, UNAUTHORIZED)
    // ------------------------------------------------------------------------
    console.log("\n--- CONTRACT 10: Provider Error Classification ---");

    // Case A: Upstream 401 with detected_unusual_activity
    const errRestrictedRes = await requestJson(
      `http://127.0.0.1:${BACKEND_PORT}/api/tts/speak`,
      { method: "POST" },
      {
        text: "Test account restricted",
        voiceId: "err_restricted",
        speed: 1.0,
      }
    );
    assert.strictEqual(errRestrictedRes.status, 401, "Restricted account returns HTTP 401");
    assert.strictEqual(errRestrictedRes.body.error, "ELEVENLABS_ACCOUNT_RESTRICTED");
    assert.ok(
      errRestrictedRes.body.message.includes("hoạt động bất thường"),
      "Message explains unusual activity account restriction"
    );
    pass("8. Upstream detected_unusual_activity classified as ELEVENLABS_ACCOUNT_RESTRICTED");
    checksPassed++;

    // Case B: Upstream 429 quota exceeded
    const errQuotaRes = await requestJson(
      `http://127.0.0.1:${BACKEND_PORT}/api/tts/speak`,
      { method: "POST" },
      {
        text: "Test quota exceeded",
        voiceId: "err_quota",
        speed: 1.0,
      }
    );
    assert.strictEqual(errQuotaRes.status, 429, "Quota exceeded returns HTTP 429");
    assert.strictEqual(errQuotaRes.body.error, "ELEVENLABS_QUOTA_EXCEEDED");
    pass("9. Upstream 429 quota classified as ELEVENLABS_QUOTA_EXCEEDED");
    checksPassed++;

    // Case C: Upstream 401 generic unauthorized
    const errUnauthRes = await requestJson(
      `http://127.0.0.1:${BACKEND_PORT}/api/tts/speak`,
      { method: "POST" },
      {
        text: "Test unauthorized",
        voiceId: "err_unauthorized",
        speed: 1.0,
      }
    );
    assert.strictEqual(errUnauthRes.status, 401, "Generic unauthorized returns HTTP 401");
    assert.strictEqual(errUnauthRes.body.error, "ELEVENLABS_UNAUTHORIZED");
    pass("10. Upstream standard 401 classified as ELEVENLABS_UNAUTHORIZED");
    checksPassed++;

    // ------------------------------------------------------------------------
    // CHECK 11: SERVER-SIDE ZERO RETENTION EXPLICIT ACTIVATION
    // ------------------------------------------------------------------------
    console.log("\n--- CONTRACT 11: Server-Side Zero Retention Enabled ---");
    const BACKEND_PORT_ZR = 5003;
    const backendProcZr = spawn(
      "dotnet",
      [dllPath, "--urls", `http://127.0.0.1:${BACKEND_PORT_ZR}`],
      {
        cwd: beDir,
        env: {
          ...process.env,
          ELEVENLABS_API_KEY: "test_contract_api_key_mock_123",
          ELEVENLABS_BASE_URL: `http://127.0.0.1:${MOCK_ELEVENLABS_PORT}`,
          DATABASE_FILE_PATH: ISOLATED_DB_PATH,
          PREPMATE_DATABASE_PATH: ISOLATED_DB_PATH,
          ASPNETCORE_URLS: `http://127.0.0.1:${BACKEND_PORT_ZR}`,
          ELEVENLABS_ZERO_RETENTION_ENABLED: "true",
          ElevenLabs__BaseUrl: `http://127.0.0.1:${MOCK_ELEVENLABS_PORT}`,
          ElevenLabs__ApiKey: "test_contract_api_key_mock_123",
        },
        stdio: "ignore",
      }
    );

    let zrReady = false;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const ping = await requestJson(`http://127.0.0.1:${BACKEND_PORT_ZR}/api/tts/status`);
        if (ping.status === 200 && ping.body.zeroRetentionEnabled === true) {
          zrReady = true;
          break;
        }
      } catch (e) {}
    }

    assert.ok(zrReady, "Backend with ELEVENLABS_ZERO_RETENTION_ENABLED=true failed to initialize");
    capturedRequests.length = 0;

    const zrSpeakRes = await requestJson(
      `http://127.0.0.1:${BACKEND_PORT_ZR}/api/tts/speak`,
      { method: "POST" },
      {
        text: "Kiểm tra Zero Retention khi server bật cờ cấu hình.",
        voiceId: "vi_namminh",
        speed: 1.0,
      }
    );

    assert.strictEqual(zrSpeakRes.status, 200, "ZR backend speak returns 200");
    assert.strictEqual(capturedRequests.length, 1);
    assert.strictEqual(
      capturedRequests[0].url,
      "/v1/text-to-speech/vi_namminh?enable_logging=false",
      "When Zero Retention is enabled server-side, outgoing URL must include ?enable_logging=false"
    );
    pass("11. Outgoing URL includes ?enable_logging=false strictly when server-side Zero Retention is enabled");
    checksPassed++;

    try {
      backendProcZr.kill();
    } catch (e) {}

    // ------------------------------------------------------------------------
    // CHECK 12: ISOLATION & ZERO ACCIDENTAL MUTATIONS
    // ------------------------------------------------------------------------
    console.log("\n--- CONTRACT 12: Database & Data Safety Invariants ---");
    const postHash = computeHash(PROD_DB_PATH);
    assert.strictEqual(postHash, baselineHash, "Production database remains 100% untouched");
    pass("12. Production database hash invariant preserved with zero mutations");
    checksPassed++;

    console.log("\n===============================================================");
    console.log(`   ALL ${checksPassed} HTTP CONTRACT CHECKS PASSED (100%)!`);
    console.log("===============================================================\n");
  } finally {
    if (backendProc) {
      try {
        backendProc.kill();
      } catch (e) {}
    }
    await new Promise((resolve) => mockServer.close(resolve));
    console.log("[MOCK] Mock server and isolated backend terminated.");
  }
}

runTestSuite().catch((err) => {
  console.error("\n[CONTRACT TEST ERROR]", err);
  process.exit(1);
});
