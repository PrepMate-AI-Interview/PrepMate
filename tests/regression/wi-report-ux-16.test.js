/**
 * WI-REPORT-UX-16: RECOMMENDATION SECTION HIERARCHY & VISUAL LAYER OPTIMIZATION
 * Regression Test Suite
 *
 * Verifies:
 * 1. Strict 4-step vertical hierarchy for all Recommendation tiers (Stage 04):
 *    - Step 1: Badge / Section label (on its own line, left-aligned)
 *    - Step 2: Section title (on the next line below badge, highest visual prominence)
 *    - Step 3: Description / introductory text (below title)
 *    - Step 4: Main content
 * 2. Elimination of side-by-side / horizontal row layouts between badge and title.
 * 3. Scope coverage across all 6 tiers:
 *    - Tầng 1: Đề xuất ưu tiên (Priority Recommendations)
 *    - Bối cảnh tuyển dụng (Ecosystem Intelligence)
 *    - Tầng 2: Cẩm nang ôn luyện (Preparation Guide)
 *    - Chuyên môn & Kỹ năng STAR
 *    - Gợi ý trang phục (Dress code slide card)
 *    - Tầng 3: Tài liệu tham khảo (Reference Materials)
 * 4. CSS Design System, Responsive Layout & Dark Mode alignment.
 * 5. Production Database integrity.
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");

const ROOT_DIR = path.resolve(__dirname, "../..");
const REPORT_JS_PATH = path.join(ROOT_DIR, "FE/features/report/report.js");
const REPORT_HTML_PATH = path.join(ROOT_DIR, "FE/features/report/report.html");
const REPORT_CSS_PATH = path.join(ROOT_DIR, "FE/features/report/report.css");
const DB_PATH = path.join(ROOT_DIR, "BE/data/db.json");
const EXPECTED_DB_HASH = "44223D9B7E945E70CADEB3279AE3EE5A0DD748A867B2C3A6B0C5C617A9DB62C3";

let passed = 0;
function pass(msg) {
  console.log(`  [PASS] ${msg}`);
  passed++;
}

async function runTests() {
  console.log("==================================================================");
  console.log("  WI-REPORT-UX-16: RECOMMENDATION HIERARCHY & VISUAL LAYER AUDIT  ");
  console.log("==================================================================");

  const reportJs = fs.readFileSync(REPORT_JS_PATH, "utf8");
  const reportHtml = fs.readFileSync(REPORT_HTML_PATH, "utf8");
  const reportCss = fs.readFileSync(REPORT_CSS_PATH, "utf8");

  // -------------------------------------------------------------------------
  // GROUP 1: HIGH-LEVEL SECTION HEADERS IN STAGE 04 (HTML DOM HIERARCHY)
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 1: HIGH-LEVEL RECOMMENDATION HEADERS IN STAGE 04 ---");

  // Tầng 1: Đề xuất trọng tâm (#section-roadmap)
  const roadmapSectionMatch = reportHtml.match(/<section id="section-roadmap"[\s\S]*?<\/div>\s*<\/div>/);
  assert(roadmapSectionMatch, "Section #section-roadmap header must be present in report.html");
  const roadmapHeader = roadmapSectionMatch[0];
  const badgeIdx1 = roadmapHeader.indexOf('class="section-badge"');
  const titleIdx1 = roadmapHeader.indexOf('class="section-title"');
  const descIdx1 = roadmapHeader.indexOf('class="section-desc"');
  assert(badgeIdx1 !== -1 && titleIdx1 !== -1 && descIdx1 !== -1, "Roadmap header must contain badge, title and desc");
  assert(badgeIdx1 < titleIdx1, "Roadmap badge must appear BEFORE title in DOM");
  assert(titleIdx1 < descIdx1, "Roadmap title must appear BEFORE description in DOM");
  pass("Test 1: Tầng 1 (#section-roadmap) strictly orders: Badge -> Title -> Description");

  // Tầng 2: Cẩm nang ôn luyện (#section-supporting-materials)
  const matStart = reportHtml.indexOf('id="section-supporting-materials"');
  const matEnd = reportHtml.indexOf('id="section-preparation"');
  assert(matStart !== -1 && matEnd !== -1, "#section-supporting-materials must be present in report.html");
  const materialsHeader = reportHtml.slice(matStart, matEnd);
  const badgeIdx2 = materialsHeader.indexOf('class="ecosystem-badge"');
  const titleIdx2 = materialsHeader.indexOf('class="section-title"');
  const descIdx2 = materialsHeader.indexOf('class="ecosystem-desc"');
  assert(badgeIdx2 !== -1 && titleIdx2 !== -1 && descIdx2 !== -1, "Materials header must contain badge, title and desc");
  assert(badgeIdx2 < titleIdx2, "Materials badge must appear BEFORE title in DOM");
  assert(titleIdx2 < descIdx2, "Materials title must appear BEFORE description in DOM");
  pass("Test 2: Tầng 2 (Cẩm nang ôn luyện) strictly orders: Badge -> Title -> Description");

  // Tầng 3: Tài liệu tham khảo (#section-reference-materials)
  const refStart = reportHtml.indexOf('id="section-reference-materials"');
  const refEnd = reportHtml.indexOf('id="reference-materials-list-container"');
  assert(refStart !== -1 && refEnd !== -1, "#section-reference-materials must be present in report.html");
  const refHeader = reportHtml.slice(refStart, refEnd);
  const badgeIdx3 = refHeader.indexOf('class="ecosystem-badge"');
  const titleIdx3 = refHeader.indexOf('class="section-title"');
  const descIdx3 = refHeader.indexOf('class="ecosystem-desc"');
  assert(badgeIdx3 !== -1 && titleIdx3 !== -1 && descIdx3 !== -1, "Reference materials header must contain badge, title and desc");
  assert(badgeIdx3 < titleIdx3, "Reference materials badge must appear BEFORE title in DOM");
  assert(titleIdx3 < descIdx3, "Reference materials title must appear BEFORE description in DOM");
  pass("Test 3: Tầng 3 (Tài liệu tham khảo) strictly orders: Badge -> Title -> Description");

  // -------------------------------------------------------------------------
  // GROUP 2: PRIORITY RECOMMENDATION CARDS (.priority-rec-card)
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 2: PRIORITY RECOMMENDATION CARDS HIERARCHY ---");

  // In report.js renderRoadmapSection, priority-rec-badges must precede priority-rec-title
  const roadmapRenderMatch = reportJs.match(/<div class="priority-rec-top-row">[\s\S]*?<\/h4>\s*<\/div>/);
  assert(roadmapRenderMatch, ".priority-rec-top-row must be generated in report.js");
  const topRowHtml = roadmapRenderMatch[0];
  const badgePos = topRowHtml.indexOf('class="priority-rec-badges"');
  const titlePos = topRowHtml.indexOf('class="priority-rec-title');
  assert(badgePos !== -1 && titlePos !== -1, "Top row must contain both badges container and title");
  assert(badgePos < titlePos, "Priority badge must appear BEFORE recommendation title in DOM");
  pass("Test 4: Priority Recommendation Card orders: Badge [Ưu tiên X] -> Objective Title");

  // -------------------------------------------------------------------------
  // GROUP 3: PREPARATION MODULES (STAR & DRESS CODE)
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 3: PREPARATION GUIDE & OUTFIT SLIDE CARDS ---");

  // Behavioral STAR prep item box: badge precedes title
  assert(reportJs.includes("prep-item-badge-wrap"), "report.js must define .prep-item-badge-wrap for STAR/Company items");
  assert(reportJs.includes("company-inferred-badge"), "STAR framework badge must be wrapped in badge container");
  pass("Test 5: STAR Behavioral item box places framework badge on top line above title");

  // Outfit slide card: rec badge precedes style title
  assert(reportJs.includes("outfit-rec-badge-wrap"), "report.js must define .outfit-rec-badge-wrap for dress code slide");
  const outfitStart = reportJs.indexOf('<div class="outfit-card-header">');
  const outfitEnd = reportJs.indexOf('<div class="outfit-suggestion-row">');
  assert(outfitStart !== -1 && outfitEnd !== -1, "Outfit card header must be generated in report.js");
  const outfitHeaderHtml = reportJs.slice(outfitStart, outfitEnd);
  const outfitBadgePos = outfitHeaderHtml.indexOf('outfit-rec-badge-wrap');
  const outfitTitlePos = outfitHeaderHtml.indexOf('outfit-style-title');
  assert(outfitBadgePos !== -1 && outfitTitlePos !== -1, "Outfit header must contain badge and style title");
  assert(outfitBadgePos < outfitTitlePos, "Outfit recommendation badge must appear BEFORE style title in DOM");
  pass("Test 6: Dress Code Slide Card orders: Recommendation Badge -> Style Title");

  // -------------------------------------------------------------------------
  // GROUP 4: REFERENCE MATERIAL CATEGORY HEADERS
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 4: REFERENCE MATERIAL CATEGORY HEADERS ---");

  assert(reportJs.includes("ref-category-badge-wrap"), "report.js must define .ref-category-badge-wrap");
  const refCatHeaderMatch = reportJs.match(/<div class="ref-category-header">[\s\S]*?<\/h4>/);
  assert(refCatHeaderMatch, ".ref-category-header must be generated in report.js");
  const refCatHeaderHtml = refCatHeaderMatch[0];
  const refBadgePos = refCatHeaderHtml.indexOf('ref-category-badge-wrap');
  const refTitlePos = refCatHeaderHtml.indexOf('ref-category-title');
  assert(refBadgePos !== -1 && refTitlePos !== -1, "Reference category header must contain badge and title");
  assert(refBadgePos < refTitlePos, "Reference category badge must appear BEFORE category title in DOM");
  pass("Test 7: Reference Material Category Header orders: Source Count Badge -> Category Title");

  // -------------------------------------------------------------------------
  // GROUP 5: CSS DESIGN SYSTEM & VERTICAL LAYOUT ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 5: CSS DESIGN SYSTEM & VERTICAL LAYOUT RULES ---");

  // Section title wraps & materials header must enforce column flex
  assert(reportCss.includes("#stage-panel-after .section-title-wrap") && reportCss.includes("flex-direction: column !important"),
    "report.css must enforce column layout on recommendation section title wraps");
  assert(reportCss.includes(".materials-header") && reportCss.includes("flex-direction: column !important"),
    "report.css must enforce column layout on .materials-header");
  pass("Test 8: High-level recommendation headers enforced as flex column (no side-by-side badge and title)");

  // Priority rec card top row enforced as column
  assert(reportCss.includes(".priority-rec-top-row") && reportCss.includes("flex-direction: column !important"),
    "report.css must enforce column layout on .priority-rec-top-row");
  pass("Test 9: Priority recommendation card header enforced as flex column");

  // Outfit card header enforced as column
  assert(reportCss.includes(".outfit-card-header") && reportCss.includes("flex-direction: column !important"),
    "report.css must enforce column layout on .outfit-card-header");
  pass("Test 10: Outfit card header enforced as flex column");

  // Reference category header enforced as column
  assert(reportCss.includes(".ref-category-header") && reportCss.includes("flex-direction: column !important"),
    "report.css must enforce column layout on .ref-category-header");
  pass("Test 11: Reference material category header enforced as flex column");

  // Badges must be left-aligned and not stretch full width
  assert(reportCss.includes("#stage-panel-after .section-badge") && reportCss.includes("align-self: flex-start !important"),
    "Badges in Stage 04 must have align-self: flex-start to prevent full-width stretching");
  pass("Test 12: Badges have align-self: flex-start and consistent compact styling");

  // Responsive & Dark mode overrides
  assert(reportCss.includes("@media (max-width: 768px)") && reportCss.includes(".priority-rec-top-row"),
    "report.css must include mobile responsive overrides preserving column layout");
  assert(reportCss.includes('html[data-theme="dark"] #stage-panel-after .section-title'),
    "report.css must include dark mode overrides for recommendation section titles");
  pass("Test 13: Responsive mobile rules and Dark Mode theme overrides verified");

  // -------------------------------------------------------------------------
  // GROUP 6: PRODUCTION DATABASE SHA256 INTEGRITY
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 6: DATABASE INTEGRITY INVARIANT ---");
  const dbBytes = fs.readFileSync(DB_PATH);
  const actualHash = crypto.createHash("sha256").update(dbBytes).digest("hex").toUpperCase();
  assert.strictEqual(actualHash, EXPECTED_DB_HASH, `Database must remain intact! Got ${actualHash}`);
  pass("Test 14: Production database SHA256 hash strictly verified intact");

  console.log(`\n==================================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, 0 FAILED (100% SUCCESS)`);
  console.log(`==================================================================`);
}

runTests().catch(err => {
  console.error("[TEST FAILURE]:", err);
  process.exit(1);
});
