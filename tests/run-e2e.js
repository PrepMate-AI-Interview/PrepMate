/**
 * PREPMATE — MASTER END-TO-END (E2E) TEST RUNNER
 *
 * Runs browser and live-inference end-to-end tests.
 * Note: These tests require an active VILAO_API_KEY and a compatible browser.
 * For offline fast regression, use: node tests/run-all.js
 *
 * Usage:
 *   node tests/run-e2e.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');

const e2eSuites = [
  { name: 'Cross-Industry Live AI & Report E2E', path: 'tests/e2e/cross-industry-live.test.js' }
];

console.log('===============================================================');
console.log('   PREPMATE — AUTOMATED E2E / LIVE INFERENCE RUNNER            ');
console.log('===============================================================\n');

const apiKey = process.env.VILAO_API_KEY || process.env.PREPMATE_AI_API_KEY;
if (!apiKey) {
  console.log('[NOTICE] VILAO_API_KEY or PREPMATE_AI_API_KEY is not set in environment.');
  console.log('To run live AI tests, set your key:');
  console.log('  Windows PowerShell: $env:VILAO_API_KEY="your-key-here"');
  console.log('  Linux / macOS     : export VILAO_API_KEY="your-key-here"');
  console.log('\nRunning offline regression instead...\n');
  execSync('node tests/run-all.js', { stdio: 'inherit', cwd: rootDir });
  process.exit(0);
}

for (const suite of e2eSuites) {
  const fullPath = path.join(rootDir, suite.path);
  console.log(`• Executing ${suite.name} (${suite.path})...\n`);
  try {
    execSync(`node "${fullPath}"`, { stdio: 'inherit', cwd: rootDir });
  } catch (err) {
    console.error(`\n[FAIL] E2E Suite ${suite.name} encountered an error.`);
    process.exit(1);
  }
}

console.log('\n===============================================================');
console.log('   ALL E2E SUITES FINISHED SUCCESSFULLY                        ');
console.log('===============================================================\n');
