/**
 * PREPMATE — SUBSCRIPTION LIFECYCLE & PAYMENT BUSINESS LOGIC INTEGRATION SUITE
 * Work Item: SUBSCRIPTION-BIZ-01
 * 
 * Verifies:
 * 1. Plan catalog discovery (GET /api/payment/plans)
 * 2. Subscription status query & permissions (GET /api/payment/subscription)
 * 3. Checkout pre-validation & duplicate purchase blocks (GET /api/payment/validate-checkout)
 * 4. Active Pro duplicate checkout block on payment processing (POST /api/payment/process)
 * 5. Free user upgrade to Pro (POST /api/payment/process with 99.000 VNĐ)
 * 6. Payment replay & tampering protection (409 Conflict on replay, 400 on price mismatch)
 * 7. Non-monetary Pro to Free downgrade (scheduled and immediate, zero transactions)
 * 8. Cancel scheduled downgrade (POST /api/payment/cancel-downgrade)
 * 9. Automatic subscription expiry sync to Free (GET /api/auth/me)
 * 10. Production database bit-by-bit SHA-256 hash invariant
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');
const { resolveDbPath } = require('../helpers/test-env');

let passCount = 0;
let failCount = 0;

const TEST_PORT = process.env.SUB_TEST_PORT ? parseInt(process.env.SUB_TEST_PORT, 10) : 5049;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failCount++;
  }
}

const JWT_SECRET = 'PrepMate_Secure_Production_Hardened_Key_2026_Minimum_256_Bits_Super_Secret!';

function generateToken({ userId, username, role = 'user', subscription = 'free', expired = false }) {
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
    exp: expired ? (now - 3600) : (now + 7200)
  };

  const b64H = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const b64P = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${b64H}.${b64P}`).digest('base64url');
  return `${b64H}.${b64P}.${sig}`;
}

function apiRequest(method, endpoint, token = null, body = null, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const headers = {
      'Accept': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: endpoint,
      method: method,
      headers: headers,
      timeout: timeoutMs
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`API request timed out (${endpoint})`)); });
    if (postData) req.write(postData);
    req.end();
  });
}

async function runSubscriptionLifecycleSuite() {
  const prodDbPath = path.resolve(__dirname, '../../BE/data/db.json');
  const initialProdContent = fs.readFileSync(prodDbPath);
  const initialProdHash = crypto.createHash('sha256').update(initialProdContent).digest('hex').toUpperCase();

  const testDir = path.join(os.tmpdir(), `prepmate_sub_biz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(testDir, { recursive: true });
  const testDbPath = path.join(testDir, 'isolated_sub_db.json');
  const testKeyringPath = path.join(testDir, 'test_keys');
  fs.mkdirSync(testKeyringPath, { recursive: true });

  const sourceDb = resolveDbPath();
  const rawDb = JSON.parse(fs.readFileSync(sourceDb, 'utf8'));

  // Seed test users into isolated database dictionary
  // 1. Free candidate
  rawDb.Users['user_free_test'] = {
    Id: 'user_free_test',
    Username: 'free_candidate',
    Password: '',
    PasswordHash: '6HdlR0rXg09LO1tpZP5pNA==.0ZEI1IG8sjdkB4ubGQ6YMvdZesjR/CnZAteJrgRmM7E=',
    Email: 'free_candidate@test.local',
    Fullname: 'Free Candidate',
    Role: 'user',
    Subscription: 'free',
    CreatedAt: new Date().toISOString()
  };

  // 2. Active Pro candidate
  const futureExpiry = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString();
  rawDb.Users['user_active_pro_test'] = {
    Id: 'user_active_pro_test',
    Username: 'pro_candidate',
    Password: '',
    PasswordHash: '6HdlR0rXg09LO1tpZP5pNA==.0ZEI1IG8sjdkB4ubGQ6YMvdZesjR/CnZAteJrgRmM7E=',
    Email: 'pro_candidate@test.local',
    Fullname: 'Active Pro Candidate',
    Role: 'user',
    Subscription: 'pro',
    SubscriptionDate: new Date().toISOString(),
    SubscriptionExpiry: futureExpiry,
    CreatedAt: new Date().toISOString()
  };

  // 3. Expired Pro candidate
  const pastExpiry = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  rawDb.Users['user_expired_pro_test'] = {
    Id: 'user_expired_pro_test',
    Username: 'expired_pro_candidate',
    Password: '',
    PasswordHash: '6HdlR0rXg09LO1tpZP5pNA==.0ZEI1IG8sjdkB4ubGQ6YMvdZesjR/CnZAteJrgRmM7E=',
    Email: 'expired_pro@test.local',
    Fullname: 'Expired Pro Candidate',
    Role: 'user',
    Subscription: 'pro',
    SubscriptionDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    SubscriptionExpiry: pastExpiry,
    CreatedAt: new Date().toISOString()
  };

  fs.writeFileSync(testDbPath, JSON.stringify(rawDb, null, 2), 'utf8');

  const beDir = path.resolve(__dirname, '../../BE');
  const dllPath = path.join(beDir, 'bin', 'Debug', 'net10.0', 'backend.dll');

  const backendProc = spawn('dotnet', [dllPath, '--urls', BASE_URL], {
    cwd: beDir,
    env: {
      ...process.env,
      DATABASE_FILE_PATH: testDbPath,
      DATABASE__FILEPATH: testDbPath,
      DATABASE__FILE_PATH: testDbPath,
      PREPMATE_KEYRING_PATH: testKeyringPath,
      ASPNETCORE_URLS: BASE_URL,
      DOTNET_URLS: BASE_URL
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  console.log('===============================================================');
  console.log('   PREPMATE — SUBSCRIPTION LIFECYCLE & PAYMENT TEST SUITE      ');
  console.log(`   Isolated Backend: ${BASE_URL} (SUBSCRIPTION-BIZ-01)          `);
  console.log('===============================================================\n');

  try {
    // Wait for backend to be ready
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await apiRequest('GET', '/api/health', null, null, 1000);
        if (res.status === 200) { ready = true; break; }
      } catch (e) {
        await new Promise(r => setTimeout(r, 250));
      }
    }
    if (!ready) throw new Error('Backend failed to start in isolated test environment');

    const freeToken = generateToken({ userId: 'user_free_test', username: 'free_candidate', subscription: 'free' });
    const proToken = generateToken({ userId: 'user_active_pro_test', username: 'pro_candidate', subscription: 'pro' });
    const expiredToken = generateToken({ userId: 'user_expired_pro_test', username: 'expired_pro_candidate', subscription: 'pro' });

    // --- 1. Plan Catalog Discovery ---
    console.log('--- 1. Plan Catalog Discovery (GET /api/payment/plans) ---');
    const plansRes = await apiRequest('GET', '/api/payment/plans');
    assert(plansRes.status === 200, 'GET /api/payment/plans is publicly accessible (got 200)');
    assert(Array.isArray(plansRes.data) && plansRes.data.length >= 2, 'Catalog returns at least Free and Pro plans');
    const freePlan = plansRes.data.find(p => p.id === 'free');
    const proPlan = plansRes.data.find(p => p.id === 'pro');
    assert(freePlan && freePlan.price === 0, 'Free plan price is strictly 0đ');
    assert(proPlan && proPlan.price === 99000, 'Pro plan price is authoritative 99.000 VNĐ');

    // --- 2. Subscription Status API ---
    console.log('\n--- 2. Subscription Status API (GET /api/payment/subscription) ---');
    const subAnon = await apiRequest('GET', '/api/payment/subscription');
    assert(subAnon.status === 401, 'Anonymous request to /api/payment/subscription returns 401 Unauthorized');

    const subFree = await apiRequest('GET', '/api/payment/subscription', freeToken);
    assert(subFree.status === 200 && subFree.data.status === 'free', 'Free user subscription status is "free"');
    assert(subFree.data.canPurchasePro === true, 'Free user can purchase Pro (canPurchasePro: true)');

    const subPro = await apiRequest('GET', '/api/payment/subscription', proToken);
    assert(subPro.status === 200 && subPro.data.status === 'pro', 'Active Pro user subscription status is "pro"');
    assert(subPro.data.canPurchasePro === false, 'Active Pro user cannot purchase Pro again (canPurchasePro: false)');

    // --- 3. Checkout Pre-Validation API ---
    console.log('\n--- 3. Checkout Pre-Validation API (GET /api/payment/validate-checkout) ---');
    const valAnon = await apiRequest('GET', '/api/payment/validate-checkout?plan=pro');
    assert(valAnon.status === 401, 'Anonymous validate-checkout returns 401 Unauthorized');

    const valFreeOnFree = await apiRequest('GET', '/api/payment/validate-checkout?plan=free', freeToken);
    assert(valFreeOnFree.status === 400, 'Checking out Free plan returns 400 Bad Request (0đ non-monetary)');

    const valProOnActivePro = await apiRequest('GET', '/api/payment/validate-checkout?plan=pro', proToken);
    assert(valProOnActivePro.status === 409, 'Active Pro user checking out Pro returns 409 Conflict');
    assert(valProOnActivePro.data.error === 'DUPLICATE_ACTIVE_SUBSCRIPTION', 'Conflict error code is DUPLICATE_ACTIVE_SUBSCRIPTION');

    const valProOnFree = await apiRequest('GET', '/api/payment/validate-checkout?plan=pro', freeToken);
    assert(valProOnFree.status === 200 && valProOnFree.data.valid === true, 'Free user checking out Pro is valid (got 200)');

    // --- 4. Payment Processing & Duplicate Purchase Prevention ---
    console.log('\n--- 4. Payment Processing & Duplicate Purchase Prevention ---');
    const dupTxId = `TX_DUP_${Date.now()}`;
    const dupPaymentRes = await apiRequest('POST', '/api/payment/process', proToken, {
      method: 'bank',
      plan: 'pro',
      amount: 99000,
      user: 'user_active_pro_test',
      transactionId: dupTxId
    });
    assert(dupPaymentRes.status === 409, 'Active Pro user duplicate payment attempt blocked with 409 Conflict');
    assert(dupPaymentRes.data.error === 'DUPLICATE_ACTIVE_SUBSCRIPTION', 'Returns code DUPLICATE_ACTIVE_SUBSCRIPTION');

    // --- 5. Valid Free User Upgrade to Pro ---
    console.log('\n--- 5. Valid Free User Upgrade to Pro ---');
    const validTxId = `TX_VALID_${Date.now()}`;
    const validPaymentRes = await apiRequest('POST', '/api/payment/process', freeToken, {
      method: 'card',
      plan: 'pro',
      amount: 99000,
      user: 'user_free_test',
      cardName: 'FREE CANDIDATE',
      cardLast4: '4242',
      transactionId: validTxId
    });
    assert(validPaymentRes.status === 200, 'Valid payment for Free user responds 200 OK');
    assert(validPaymentRes.data.user && validPaymentRes.data.user.subscription === 'pro', 'User subscription upgraded to "pro"');

    // Verify user is now Pro and subsequent checkout is blocked
    const afterUpgradeSub = await apiRequest('GET', '/api/payment/subscription', freeToken);
    assert(afterUpgradeSub.data.status === 'pro' && afterUpgradeSub.data.canPurchasePro === false, 'After upgrade, user is Pro and cannot repurchase');

    // --- 6. Payment Replay & Amount Tampering Protection ---
    console.log('\n--- 6. Payment Replay & Amount Tampering Protection ---');
    const replayRes = await apiRequest('POST', '/api/payment/process', freeToken, {
      method: 'card',
      cardName: 'FREE CANDIDATE',
      cardLast4: '4242',
      amount: 99000,
      user: 'user_free_test',
      transactionId: validTxId
    });
    assert(replayRes.status === 409, 'Replayed transaction ID is blocked with 409 Conflict');

    const tamperedRes = await apiRequest('POST', '/api/payment/process', freeToken, {
      method: 'card',
      plan: 'pro',
      amount: 50000,
      user: 'user_free_test',
      transactionId: `TX_TAMP_${Date.now()}`
    });
    assert(tamperedRes.status === 400, 'Tampered payment amount (50.000đ != 99.000đ) rejected with 400 Bad Request');

    // --- 7. Non-Monetary Pro to Free Downgrade ---
    console.log('\n--- 7. Non-Monetary Pro to Free Downgrade ---');
    // Read transaction count before downgrade
    const dbBeforeDowngrade = JSON.parse(fs.readFileSync(testDbPath, 'utf8'));
    const txCountBefore = (dbBeforeDowngrade.Transactions || []).length;

    // Test scheduled downgrade
    const schedDowngradeRes = await apiRequest('POST', '/api/payment/downgrade', proToken, { scheduled: true });
    assert(schedDowngradeRes.status === 200, 'POST /api/payment/downgrade responds 200 OK');
    assert(schedDowngradeRes.data.scheduledDowngrade === true, 'scheduledDowngrade flag set to true');
    assert(schedDowngradeRes.data.currentSubscription === 'pro', 'Current subscription remains "pro" until period ends');

    // Verify ZERO transactions generated
    const dbAfterDowngrade = JSON.parse(fs.readFileSync(testDbPath, 'utf8'));
    const txCountAfter = (dbAfterDowngrade.Transactions || []).length;
    assert(txCountAfter === txCountBefore, 'Downgrade is non-monetary: zero transactions generated');

    // --- 8. Cancel Scheduled Downgrade ---
    console.log('\n--- 8. Cancel Scheduled Downgrade ---');
    const cancelDowngradeRes = await apiRequest('POST', '/api/payment/cancel-downgrade', proToken);
    assert(cancelDowngradeRes.status === 200, 'POST /api/payment/cancel-downgrade responds 200 OK');
    assert(cancelDowngradeRes.data.scheduledDowngrade === false, 'scheduledDowngrade reverted to false');

    // Immediate downgrade test
    const immDowngradeRes = await apiRequest('POST', '/api/payment/downgrade', proToken, { scheduled: false });
    assert(immDowngradeRes.status === 200, 'Immediate downgrade responds 200 OK');
    assert(immDowngradeRes.data.currentSubscription === 'free', 'Subscription immediately reverted to "free"');

    // --- 9. Automatic Subscription Expiry Sync ---
    console.log('\n--- 9. Automatic Subscription Expiry Sync ---');
    // expiredToken is for user_expired_pro_test who had subscription: "pro" and past expiry date
    const syncRes = await apiRequest('GET', '/api/auth/me', expiredToken);
    assert(syncRes.status === 200, 'GET /api/auth/me responds 200 OK for expired user');
    assert(syncRes.data.subscription === 'free', 'Expired user automatically transitioned to "free"');

    // Now expired user should be allowed to purchase Pro anew
    const valExpiredCanBuy = await apiRequest('GET', '/api/payment/validate-checkout?plan=pro', expiredToken);
    assert(valExpiredCanBuy.status === 200 && valExpiredCanBuy.data.valid === true, 'Expired user can checkout Pro plan anew');

    // --- 10. Production Database SHA-256 Invariant ---
    console.log('\n--- 10. Production Database SHA-256 Invariant ---');
    const currentProdContent = fs.readFileSync(prodDbPath);
    const currentProdHash = crypto.createHash('sha256').update(currentProdContent).digest('hex').toUpperCase();
    assert(currentProdHash === 'C8D6CA48DFAC2DD4C9FC3F5793E36222506220F07DC4DE9E17102B92295662A7', 'Production BE/data/db.json byte-for-byte integrity preserved');
    assert(currentProdHash === initialProdHash, 'Production database remains completely untouched throughout test suite');

  } finally {
    backendProc.kill('SIGKILL');
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {}
  }

  console.log('\n===============================================================');
  console.log(` RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('===============================================================');

  if (failCount > 0) process.exit(1);
}

runSubscriptionLifecycleSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
