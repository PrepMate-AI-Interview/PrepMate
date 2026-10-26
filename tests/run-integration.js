/**
 * PREPMATE — LIVE INTEGRATION TEST RUNNER
 * Runs live API integration tests against a running ASP.NET Core backend instance on port 5000.
 *
 * Prerequisite:
 * Start backend first with:
 *   dotnet run --project BE/backend.csproj
 *
 * Usage: node tests/run-integration.js
 */

const http = require('http');
const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const integrationTestPath = path.join(rootDir, 'tests/integration/conversational-persona.test.js');

console.log('===============================================================');
console.log('   PREPMATE — LIVE INTEGRATION TEST RUNNER                     ');
console.log('===============================================================\n');

function checkBackendAvailable() {
  return new Promise((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port: 5000, path: '/api/health', method: 'GET', timeout: 2000 }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function run() {
  process.stdout.write('• Checking backend connection at http://127.0.0.1:5000 ... ');
  const isUp = await checkBackendAvailable();
  if (!isUp) {
    console.log('OFFLINE');
    console.warn('\n[SKIPPED] Backend is not running on port 5000.');
    console.warn('To execute integration tests:');
    console.warn('  1. Start backend: dotnet run --project BE/backend.csproj');
    console.warn('  2. In another terminal: node tests/run-integration.js\n');
    process.exit(0);
  }

  console.log('ONLINE');
  console.log('• Running tests/integration/conversational-persona.test.js ...\n');

  try {
    const out = execSync(`node "${integrationTestPath}"`, { cwd: rootDir, encoding: 'utf8', stdio: 'inherit' });
    console.log('\n[SUCCESS] INTEGRATION TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n[FAIL] Integration tests encountered failures.');
    process.exit(1);
  }
}

run();
