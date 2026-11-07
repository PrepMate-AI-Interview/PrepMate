/**
 * PREPMATE — CANONICAL SHARED UI FOUNDATION AUDIT SUITE
 * Work Item: WI-GLOBAL-UI-STANDARDIZATION-01 (Phase 1)
 * Verifies canonical design tokens and shared component classes
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('===============================================================');
console.log('   WI-GLOBAL-UI-STANDARDIZATION-01: SHARED FOUNDATION AUDIT    ');
console.log('===============================================================');

const TOKENS_PATH = path.resolve(__dirname, '../../FE/shared/css/tokens.css');
const COMPONENTS_PATH = path.resolve(__dirname, '../../FE/shared/css/components.css');
const DB_PATH = path.resolve(__dirname, '../../BE/data/db.json');

const tokensContent = fs.readFileSync(TOKENS_PATH, 'utf8');
const componentsContent = fs.readFileSync(COMPONENTS_PATH, 'utf8');

// 1. Check conventional standard font weights in tokens.css
console.log('\n--- GROUP 1: Canonical Typography Weights & Design Tokens ---');
assert.ok(tokensContent.includes('--pm-font-weight-regular:  400;'), 'Standard 400 regular weight must exist');
assert.ok(tokensContent.includes('--pm-font-weight-bold:     700;'), 'Standard 700 bold weight must exist');
assert.ok(tokensContent.includes('--pm-font-weight-semibold: 600;'), 'Standard 600 semibold weight must exist');
assert.ok(tokensContent.includes('--pm-font-weight-medium:   500;'), 'Standard 500 medium weight must exist');
assert.ok(tokensContent.includes('--pm-font-weight-light:    300;'), 'Standard 300 light weight must exist');
console.log('  [PASS] 1.1 Conventional typography weights (300, 400, 500, 600, 700) verified');

// 2. Check canonical tokens exist
assert.ok(tokensContent.includes('--pm-ink:'), '--pm-ink must exist');
assert.ok(tokensContent.includes('--pm-ink-soft:'), '--pm-ink-soft must exist');
assert.ok(tokensContent.includes('--pm-text-primary:'), '--pm-text-primary must exist');
assert.ok(tokensContent.includes('--pm-text-secondary:'), '--pm-text-secondary must exist');
assert.ok(tokensContent.includes('--pm-text-muted:'), '--pm-text-muted must exist');
assert.ok(tokensContent.includes('--pm-space-2:'), '--pm-space-2 must exist');
assert.ok(tokensContent.includes('--pm-radius-card:'), '--pm-radius-card must exist');
console.log('  [PASS] 1.2 Canonical semantic color, space, and radius tokens verified');

// 3. Check Section 14 in components.css
console.log('\n--- GROUP 2: Canonical Shared UI Foundation Classes ---');
const requiredClasses = [
  '.pm-page-header',
  '.pm-page-title',
  '.pm-page-subtitle',
  '.pm-section-header',
  '.pm-section-heading',
  '.pm-section-subtitle',
  '.pm-section-desc',
  '.pm-card-heading',
  '.pm-heading-with-icon',
  '.pm-heading-text',
  '.pm-stat-card',
  '.pm-stat-label',
  '.pm-stat-value',
  '.pm-stat-delta',
  '.pm-stat-caption',
  '.pm-content-wrap',
  '.pm-truncate-constrained',
  '.pm-section-gap'
];

requiredClasses.forEach(cls => {
  assert.ok(componentsContent.includes(cls), `Required canonical class ${cls} must exist in components.css`);
});
console.log(`  [PASS] 2.1 All ${requiredClasses.length} canonical UI foundation classes verified in components.css`);

// 4. Verify Heading with Icon First-Line Optical Anchor
assert.ok(componentsContent.includes('align-items: flex-start'), '.pm-heading-with-icon must align-items: flex-start for multiline stability');
assert.ok(componentsContent.includes('.pm-heading-with-icon.pm-heading-center'), '.pm-heading-center variant must exist for compact action headers');
console.log('  [PASS] 2.2 Heading with icon optical anchor verified (first-line stability on multiline)');

// 5. Verify 3-tier metric hierarchy
assert.ok(componentsContent.includes('.pm-stat-card.pm-stat-stretch .pm-stat-delta'), '.pm-stat-stretch allows delta bottom anchor without global layout breaking');
console.log('  [PASS] 2.3 3-tier metric card hierarchy verified');

// 6. Database invariant
console.log('\n--- GROUP 3: Database & Production Integrity ---');
const crypto = require('crypto');
const dbHash = crypto.createHash('sha256').update(fs.readFileSync(DB_PATH)).digest('hex').toUpperCase();
assert.strictEqual(dbHash, '44223D9B7E945E70CADEB3279AE3EE5A0DD748A867B2C3A6B0C5C617A9DB62C3', 'Production db.json SHA-256 must match exactly');
console.log('  [PASS] 3.1 Production database SHA-256 invariant verified');

console.log('\n===============================================================');
console.log('   ALL SHARED FOUNDATION AUDIT CHECKS PASSED (100% SUCCESS)    ');
console.log('===============================================================\n');
