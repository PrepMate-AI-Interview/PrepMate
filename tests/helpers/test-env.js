/**
 * PrepMate — Centralized Test Environment Helper
 * Provides stable repository-root relative path resolution for all test suites.
 */
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '../..');
const CANONICAL_DB_FIXTURE_PATH = path.join(rootDir, 'scratch', 'baseline_prod_db_backup.json');

function ensureCanonicalFixture() {
  const scratchDir = path.join(rootDir, 'scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  if (!fs.existsSync(CANONICAL_DB_FIXTURE_PATH)) {
    const prodDb = path.join(rootDir, 'BE', 'data', 'db.json');
    if (fs.existsSync(prodDb)) {
      fs.copyFileSync(prodDb, CANONICAL_DB_FIXTURE_PATH);
    }
  }
}

function resolvePath(relativePath) {
  if (process.env.TEST_USE_CANONICAL_FIXTURE && (relativePath === 'BE/data/db.json' || relativePath === 'BE\\data\\db.json')) {
    ensureCanonicalFixture();
    return CANONICAL_DB_FIXTURE_PATH;
  }
  return path.join(rootDir, relativePath);
}

function resolveDbPath(canonicalOnly = false) {
  if (canonicalOnly || process.env.TEST_USE_CANONICAL_FIXTURE) {
    ensureCanonicalFixture();
    return CANONICAL_DB_FIXTURE_PATH;
  }
  return path.join(rootDir, 'BE', 'data', 'db.json');
}

function read(relativePath, encoding = 'utf8') {
  return fs.readFileSync(resolvePath(relativePath), encoding);
}

function exists(relativePath) {
  return fs.existsSync(resolvePath(relativePath));
}

module.exports = {
  rootDir,
  resolvePath,
  resolveDbPath,
  CANONICAL_DB_FIXTURE_PATH,
  read,
  exists
};
