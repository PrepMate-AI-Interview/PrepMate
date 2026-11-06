/**
 * PREPMATE — WI-REPORT-13 REGRESSION SUITE
 * Ecosystem Section Live Audit & Report Visual Balancing
 *
 * Verifies:
 * 1. Semantic Clarity: Distinct "Hệ Sinh Thái" section heading & descriptive subtitle
 * 2. Single-Column Vertical Flow: 3 canonical bullet groups (.ecosystem-sheet-card, .ecosystem-note-group)
 * 3. Information Architecture Separation: Future mock recommendations removed from company ecosystem
 * 4. Visual Balance & Compact Presentation: Streamlined outfit cards and reduced vertical footprint
 * 5. Dark Mode compliance for new ecosystem components
 * 6. Production Database SHA-256 invariant
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

console.log("================================================================");
console.log("  TEST SUITE: WI-REPORT-13 (ECOSYSTEM LIVE AUDIT & VISUAL BALANCE)");
console.log("================================================================\n");

const WORKSPACE_ROOT = path.resolve(__dirname, "../../");
const htmlPath = path.resolve(WORKSPACE_ROOT, "FE/features/report/report.html");
const jsPath = path.resolve(WORKSPACE_ROOT, "FE/features/report/report.js");
const cssPath = path.resolve(WORKSPACE_ROOT, "FE/features/report/report.css");
const dbPath = path.resolve(WORKSPACE_ROOT, "BE/data/db.json");

const html = fs.readFileSync(htmlPath, "utf8");
const js = fs.readFileSync(jsPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`[PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${desc}\n       ${err.message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// GROUP 1: Semantic Clarity & Section Heading
// -------------------------------------------------------------
console.log("--- 1. SEMANTIC CLARITY & SECTION HEADING ---");

check("report.html has clear Ecosystem heading with badge", () => {
  assert.ok(
    html.includes("Hệ Sinh Thái &amp; Bối Cảnh Tuyển Dụng Thực Tế") || html.includes("Hệ Sinh Thái"),
    "Ecosystem heading must be clear and prominent"
  );
  assert.ok(html.includes("HỆ SINH THÁI THỰC TẾ"), "Badge must identify real interview ecosystem");
  assert.ok(
    html.includes("Bối cảnh tổ chức, vị trí ứng tuyển và yêu cầu tuyển dụng thực tế đối chiếu từ phiên phỏng vấn."),
    "Clear descriptive subtitle must accompany heading"
  );
});

// -------------------------------------------------------------
// GROUP 2: Single-Column Vertical Flow (3 Canonical Groups)
// -------------------------------------------------------------
console.log("\n--- 2. SINGLE-COLUMN FLOW & 3 CANONICAL BULLET GROUPS ---");

check("report.js renders ecosystem-sheet-card with single-column note structure", () => {
  assert.ok(js.includes('class="ecosystem-sheet-card"'), "Must render .ecosystem-sheet-card container");
  assert.ok(js.includes('class="ecosystem-note-group"'), "Must group information into .ecosystem-note-group blocks");
  assert.ok(js.includes('class="ecosystem-bullet-list"'), "Must use .ecosystem-bullet-list for readable items");
  assert.ok(js.includes('class="bullet-bold-title"'), "Must format items with bold titles");
});

check("Group 1: Bối Cảnh Doanh Nghiệp & Vị Trí Ứng Tuyển is rendered with bullets", () => {
  assert.ok(js.includes("Bối Cảnh Doanh Nghiệp &amp; Vị Trí Ứng Tuyển"), "Group 1 title present");
  assert.ok(js.includes("Đơn vị ứng tuyển:"), "Bullet for company name present");
  assert.ok(js.includes("Vị trí mục tiêu:"), "Bullet for target role present");
  assert.ok(js.includes("Đặc thù môi trường:"), "Bullet for workplace culture present");
});

check("Group 2: Nhu Cầu Tuyển Dụng Trọng Tâm is rendered with 3 key requirements", () => {
  assert.ok(js.includes("Nhu Cầu Tuyển Dụng Trọng Tâm"), "Group 2 title present");
  assert.ok(js.includes("Kỹ năng chuyên môn cốt lõi"), "Requirement 1 present");
  assert.ok(js.includes("Năng lực thực chiến"), "Requirement 2 present");
  assert.ok(js.includes("Tác phong &amp; Phối hợp") || js.includes("Tác phong & Phối hợp"), "Requirement 3 present");
});

check("Group 3: Đối Sánh Hồ Sơ & Kỳ Vọng Tuyển Dụng is rendered with alignment bullets", () => {
  assert.ok(js.includes("Đối Sánh Hồ Sơ &amp; Kỳ Vọng Tuyển Dụng"), "Group 3 title present");
  assert.ok(js.includes("Điểm tựa phù hợp"), "Strengths alignment bullet present");
  assert.ok(js.includes("Trọng tâm cần lưu ý"), "Gaps & focus bullet present");
});

// -------------------------------------------------------------
// GROUP 3: Information Architecture Separation
// -------------------------------------------------------------
console.log("\n--- 3. INFORMATION ARCHITECTURE SEPARATION ---");

check("Future mock recommendations are suppressed from company ecosystem", () => {
  assert.ok(
    html.includes('id="prep-mock-content"') && html.includes('style="display:none;"'),
    "Mock interview module suppressed from company context while preserving DOM ID"
  );
});

check("Company CTA button links cleanly to detailed company intelligence page", () => {
  assert.ok(js.includes('id="btn-view-company-intelligence"'), "CTA button exists in report.js");
  assert.ok(js.includes("company-intelligence.html"), "CTA button links to company intelligence view");
});

// -------------------------------------------------------------
// GROUP 4: Visual Balancing & CSS Contracts
// -------------------------------------------------------------
console.log("\n--- 4. VISUAL BALANCING & CSS CONTRACTS ---");

check("report.css includes styles for .ecosystem-sheet-card and bullet layout", () => {
  assert.ok(css.includes(".ecosystem-sheet-card"), ".ecosystem-sheet-card defined");
  assert.ok(css.includes(".ecosystem-note-group"), ".ecosystem-note-group defined");
  assert.ok(css.includes(".ecosystem-bullet-list"), ".ecosystem-bullet-list defined");
  assert.ok(css.includes(".ecosystem-bullet-item"), ".ecosystem-bullet-item defined");
});

check("report.css streamlines visual outfit cards to eliminate vertical bloat", () => {
  assert.ok(css.includes(".outfit-visual-card"), ".outfit-visual-card styled");
  assert.ok(css.includes(".outfit-visual-card .outfit-card-image-wrap"), "Image wrap overridden to avoid 2000px bloat");
});

check("report.css defines Dark Mode overrides for all WI-REPORT-13 components", () => {
  assert.ok(css.includes('[data-theme="dark"] .ecosystem-sheet-card'), "Dark mode for sheet card");
  assert.ok(css.includes('[data-theme="dark"] .ecosystem-group-title'), "Dark mode for group title");
  assert.ok(css.includes('[data-theme="dark"] .ecosystem-bullet-item'), "Dark mode for bullet items");
});

// -------------------------------------------------------------
// GROUP 5: Database Integrity Invariant
// -------------------------------------------------------------
console.log("\n--- 5. DATABASE INTEGRITY INVARIANT ---");

check("BE/data/db.json SHA-256 hash strictly preserved", () => {
  const EXPECTED_HASH = "44223d9b7e945e70cadeb3279ae3ee5a0dd748a867b2c3a6b0c5c617a9db62c3";
  const content = fs.readFileSync(dbPath);
  const actualHash = crypto.createHash("sha256").update(content).digest("hex").toLowerCase();
  assert.strictEqual(
    actualHash,
    EXPECTED_HASH,
    `Production db.json hash mismatch! Expected ${EXPECTED_HASH}, got ${actualHash}`
  );
});

console.log("\n================================================================");
console.log(`  WI-REPORT-13 RESULTS: ${passed} PASS, ${failed} FAIL`);
console.log("================================================================\n");

if (failed > 0) {
  process.exit(1);
}
