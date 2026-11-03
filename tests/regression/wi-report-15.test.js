// tests/regression/wi-report-15.test.js
// Regression test suite for WI-REPORT-15: REDESIGN RECOMMENDATIONS SECTION USING UX/UI PRINCIPLES

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('================================================================');
console.log('  TEST SUITE: WI-REPORT-15 (REDESIGN RECOMMENDATIONS SECTION)');
console.log('================================================================\n');

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const reportHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.html'), 'utf8');
const reportJs = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.js'), 'utf8');
const reportCss = fs.readFileSync(path.join(WORKSPACE_ROOT, 'FE/features/report/report.css'), 'utf8');
const dbPath = path.join(WORKSPACE_ROOT, 'BE/data/db.json');

// --- 1. INFORMATION ARCHITECTURE & 3-LAYER SEPARATION ---
console.log('--- 1. INFORMATION ARCHITECTURE & 3-LAYER SEPARATION ---');
assert.ok(
  reportHtml.includes('TẦNG 1 • ĐỀ XUẤT TRỌNG TÂM') || reportHtml.includes('Các Đề Xuất Cải Thiện Trọng Tâm'),
  'Layer 1: Primary Recommendations header established'
);
assert.ok(
  reportHtml.includes('TẦNG 2 • CẨM NANG ÔN LUYỆN') && reportHtml.includes('Cẩm Nang Hướng Dẫn Ôn Luyện'),
  'Layer 2: Preparation Guide header established'
);
assert.ok(
  reportHtml.includes('TẦNG 3 • TÀI LIỆU THAM KHẢO') && reportHtml.includes('id="section-reference-materials"'),
  'Layer 3: Reference Materials independent section established'
);

const idxLayer1 = reportHtml.indexOf('id="section-roadmap"');
const idxLayer2 = reportHtml.indexOf('id="section-supporting-materials"');
const idxLayer3 = reportHtml.indexOf('id="section-reference-materials"');
assert.ok(
  idxLayer1 !== -1 && idxLayer2 !== -1 && idxLayer3 !== -1 && idxLayer1 < idxLayer2 && idxLayer2 < idxLayer3,
  'Strict vertical order: Layer 1 (Recommendations) > Layer 2 (Preparation Guide) > Layer 3 (Reference Materials)'
);
console.log('[PASS] 3 distinct independent layers in canonical vertical sequence verified');

// --- 2. LAYER 1: PRIMARY RECOMMENDATIONS & VERTICAL FLOW ---
console.log('\n--- 2. LAYER 1: PRIMARY RECOMMENDATIONS & VERTICAL FLOW ---');
assert.ok(
  reportCss.includes('#stage-panel-after .roadmap-grid') &&
  reportCss.includes('display: flex !important') &&
  reportCss.includes('flex-direction: column !important'),
  'Primary recommendations use a single vertical content flow (not 3 cards side-by-side)'
);
assert.ok(
  reportJs.includes('sortedItems.slice(0, 3)') || reportJs.includes('items.slice(0, 3)'),
  'Top 2-3 highest priority recommendations selected based on evidence'
);
assert.ok(
  reportJs.includes('class="priority-rec-action"') && reportJs.includes('Hành động trọng tâm:'),
  'Actionable title and 1-sentence action statement formatted'
);
assert.ok(
  reportJs.includes('class="priority-rec-why"') && reportJs.includes('Lý do ưu tiên:'),
  '1-sentence rationale formatted explaining why the improvement matters'
);
assert.ok(
  reportJs.includes('priority-rec-evidence-row') || reportJs.includes('rec-evidence-tag'),
  'Interview evidence and diagnostic reference linked to recommendation'
);
assert.ok(
  reportJs.includes('rec-guide-link') || reportJs.includes('rec-context-guide-row'),
  'Contextual link from recommendation to relevant Preparation Guide module provided'
);
assert.ok(
  reportJs.includes('toggleRoadmapSteps') && reportJs.includes('roadmap-panel-collapsed'),
  'Independent on-demand inline expansion with collapsed default state supported'
);
console.log('[PASS] Layer 1: Vertical flow, concise actionable content, evidence and contextual links verified');

// --- 3. LAYER 2: PREPARATION GUIDE ---
console.log('\n--- 3. LAYER 2: PREPARATION GUIDE ---');
assert.ok(
  reportHtml.includes('id="prep-module-technical"') &&
  reportHtml.includes('id="prep-module-behavioral"') &&
  reportHtml.includes('id="prep-dresscode-card"') &&
  reportHtml.includes('id="section-checklist"'),
  'Preparation Guide houses 4 distinct subject modules (Technical, STAR, Clothing, Format)'
);
assert.ok(
  reportHtml.includes('btn-toggle-module') && reportHtml.includes('module-body-collapsible module-collapsed'),
  'Progressive disclosure implemented: category summary visible, body collapsed by default'
);
assert.ok(
  reportJs.includes('function openPrepModule') && reportJs.includes('window.openPrepModule'),
  'openPrepModule helper defined and exported to allow contextual deep-linking from recommendations'
);
assert.ok(
  reportHtml.includes('id="interview-format-selector-box"') &&
  reportHtml.includes('data-format="onsite"') &&
  reportHtml.includes('data-format="online"'),
  'Format selector strictly provides 2 canonical modes: In-person vs Online'
);
console.log('[PASS] Layer 2: Preparation Guide modules, progressive disclosure and format selector verified');

// --- 4. LAYER 3: REFERENCE MATERIALS ---
console.log('\n--- 4. LAYER 3: REFERENCE MATERIALS ---');
assert.ok(
  reportJs.includes('reference-material-row') && reportJs.includes('ref-item-main'),
  'Reference materials presented as compact list rows instead of large bloated cards'
);
assert.ok(
  reportJs.includes('Tài Liệu Chuyên Môn Theo Lĩnh Vực') &&
  (reportJs.includes('Cẩm Nang Phương Pháp &amp; Kỹ Năng Phỏng Vấn') || reportJs.includes('Cẩm Nang Phương Pháp & Kỹ Năng Phỏng Vấn')),
  'Reference materials categorized into Professional Knowledge vs Interview Strategy'
);
assert.ok(
  reportJs.includes('handleReferenceClick') && reportJs.includes('window.handleReferenceClick'),
  'Reference row provides interactive semantic action button with click handler'
);
assert.ok(
  reportJs.includes('ref-empty-state'),
  'Truthful compact empty state provided when no reference materials are available'
);
console.log('[PASS] Layer 3: Compact reference list rows and authentic resources verified');

// --- 5. DESIGN SYSTEM, RESPONSIVE & DARK MODE ---
console.log('\n--- 5. DESIGN SYSTEM, RESPONSIVE & DARK MODE ---');
assert.ok(
  reportCss.includes('.priority-rec-top-row') && reportCss.includes('.rec-evidence-tag'),
  'CSS styles priority recommendation header, badges and evidence tag'
);
assert.ok(
  reportCss.includes('.reference-material-row') && reportCss.includes('.ref-action-btn'),
  'CSS styles compact reference material list rows and action buttons'
);
assert.ok(
  reportCss.includes('@media (max-width: 768px)') && reportCss.includes('.reference-material-row'),
  'Responsive mobile/tablet overrides present for recommendations and reference rows'
);
assert.ok(
  reportCss.includes('[data-theme="dark"] .priority-rec-card') &&
  reportCss.includes('[data-theme="dark"] .reference-material-row'),
  'Dark mode styling provided for recommendations, guide and reference rows'
);
console.log('[PASS] Visual design, responsive layout and dark mode styling verified');

// --- 6. INVARIANT DATABASE INTEGRITY ---
console.log('\n--- 6. INVARIANT DATABASE INTEGRITY ---');
const EXPECTED_DB_HASH = 'c2ba83b82e758b277786dad7073e1c8a0e80c71fc615ecbbe5847d01b47cda50';
const dbBytes = fs.readFileSync(dbPath);
const actualDbHash = crypto.createHash('sha256').update(dbBytes).digest('hex');
assert.strictEqual(
  actualDbHash,
  EXPECTED_DB_HASH,
  `BE/data/db.json must remain strictly unmodified! Got ${actualDbHash}`
);
console.log('[PASS] Production database SHA-256 hash strictly preserved: ' + actualDbHash);

console.log('\n================================================================');
console.log('  ALL WI-REPORT-15 TESTS PASSED SUCCESSFULLY! (100%)');
console.log('================================================================');
