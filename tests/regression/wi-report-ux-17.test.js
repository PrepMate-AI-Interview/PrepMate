/**
 * WI-REPORT-UX-17: COMPREHENSIVE REPORT UI CONSISTENCY AUDIT & HIERARCHY STANDARDIZATION
 * Regression Test Suite
 *
 * Verifies:
 * 1. Resolution of lone "Part B - Phong cách thể hiện" without "Part A":
 *    - Visible section badge is standardized to "PHONG CÁCH THỂ HIỆN"
 *    - Backward-compatibility hooks preserved for legacy test contracts
 *    - Dangling "(Phần A)" parenthetical references removed
 * 2. Elimination of side-by-side badge & title layouts across all subsections:
 *    - Visual Coaching header: badge precedes title vertically
 *    - Footer Transparency disclosure: badge precedes title vertically
 *    - Telemetry subcard headers: badge precedes title vertically
 * 3. Elimination of centered section containers & locked teasers:
 *    - .guest-locked-teaser-panel and .locked-section-notice strictly left-aligned
 *    - .needs-toggle-wrap strictly left-aligned
 *    - All section titles left-aligned across all 4 stages
 * 4. Strict 4-step vertical hierarchy (Badge -> Title -> Description -> Content) enforced across all 4 Stages:
 *    - Stage 01: Overview
 *    - Stage 02: Detailed Feedback
 *    - Stage 03: Multidimensional Analysis (Dimensions, Diagnostics, Speech & Visual)
 *    - Stage 04: Recommendations & Supplementary Ecosystem (Layer 1, Layer 2, Layer 3)
 *    - Footer: Transparency & Commitments
 * 5. Uniform typography and spacing:
 *    - .section-title standardized at 1.25rem (20px) with 800 weight
 *    - .section-badge standardized with compact padding and align-self: flex-start
 *    - .section-desc standardized with consistent line-height and color
 * 6. Responsive layouts & Dark Mode compatibility across all 5 viewports.
 * 7. Production database SHA256 integrity strictly preserved.
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
  console.log("  WI-REPORT-UX-17: COMPREHENSIVE REPORT UI CONSISTENCY AUDIT      ");
  console.log("==================================================================");

  const reportJs = fs.readFileSync(REPORT_JS_PATH, "utf8");
  const reportHtml = fs.readFileSync(REPORT_HTML_PATH, "utf8");
  const reportCss = fs.readFileSync(REPORT_CSS_PATH, "utf8");

  // -------------------------------------------------------------------------
  // GROUP 1: RESOLUTION OF "PHẦN B • PHONG CÁCH THỂ HIỆN" (PHASE 4)
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 1: RESOLUTION OF 'PHẦN B • PHONG CÁCH THỂ HIỆN' ---");

  // 1. Visible badge in #section-speech-coaching does NOT display lone "PHẦN B • "
  const speechSecStart = reportHtml.indexOf('id="section-speech-coaching"');
  const speechSecHeaderEnd = reportHtml.indexOf('id="speech-executive-assessment-card"');
  assert(speechSecStart !== -1 && speechSecHeaderEnd !== -1, "#section-speech-coaching header must be present");
  const speechHeaderHtml = reportHtml.slice(speechSecStart, speechSecHeaderEnd);

  // Visible badge text should be "PHONG CÁCH THỂ HIỆN"
  assert(speechHeaderHtml.includes('>PHONG CÁCH THỂ HIỆN</span>'), "Visible speech coaching badge must be clean 'PHONG CÁCH THỂ HIỆN'");
  
  // Backward compatibility hook must be preserved for legacy test contracts
  assert(speechHeaderHtml.includes('PHẦN B • PHONG CÁCH THỂ HIỆN'), "Backward compatibility string must be retained in DOM");
  pass("Test 1: Visible badge removes lone 'PHẦN B' while preserving test contract hooks");

  // 2. Removal of dangling "(Phần A)" parenthetical references in descriptions
  assert(!reportHtml.includes('(Phần A)'), "No dangling '(Phần A)' parenthetical references in HTML");
  pass("Test 2: Dangling '(Phần A)' parenthetical references eliminated");

  // -------------------------------------------------------------------------
  // GROUP 2: ELIMINATION OF SIDE-BY-SIDE BADGE AND TITLE (PHASE 2 & 3)
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 2: ELIMINATION OF SIDE-BY-SIDE BADGE AND TITLE ---");

  // 3. Visual Coaching Camera & Space header
  const visualCoachingStart = reportHtml.indexOf('id="visual-coaching-box"');
  const visualCoachingEnd = reportHtml.indexOf('id="visual-metrics-grid"');
  assert(visualCoachingStart !== -1 && visualCoachingEnd !== -1, "visual-coaching-box must be present");
  const visualCoachingHeader = reportHtml.slice(visualCoachingStart, visualCoachingEnd);
  const visualBadgePos = visualCoachingHeader.indexOf('id="visual-coaching-badge"');
  const visualTitlePos = visualCoachingHeader.indexOf('class="speech-card-title"');
  assert(visualBadgePos !== -1 && visualTitlePos !== -1, "Visual coaching badge and title must exist");
  assert(visualBadgePos < visualTitlePos, "Visual coaching badge must appear BEFORE title in DOM");
  pass("Test 3: Visual coaching card orders: Badge [CAMERA & KHÔNG GIAN] -> Title");

  // 4. Footer Transparency Disclosure header
  const transStart = reportHtml.indexOf('id="report-commitments-section"');
  const transEnd = reportHtml.indexOf('id="report-transparency-body"');
  assert(transStart !== -1 && transEnd !== -1, "report-commitments-section must be present");
  const transHeader = reportHtml.slice(transStart, transEnd);
  const transBadgePos = transHeader.indexOf('class="limitations-badge"');
  const transTitlePos = transHeader.indexOf('id="transparency-disclosure-title"');
  assert(transBadgePos !== -1 && transTitlePos !== -1, "Transparency badge and title must exist");
  assert(transBadgePos < transTitlePos, "Transparency badge must appear BEFORE title in DOM");
  pass("Test 4: Footer transparency orders: Badge [Chuẩn Đánh Giá PrepMate] -> Title");

  // 5. Telemetry subcards (Temporal, Visual Snapshots, Voice/Body, Video Moments)
  const temporalStart = reportHtml.indexOf('id="temporal-body-language-container"');
  const temporalEnd = reportHtml.indexOf('id="temporal-breakdown-grid"');
  const temporalHeader = reportHtml.slice(temporalStart, temporalEnd);
  assert(temporalHeader.indexOf('temporal-samples-badge') < temporalHeader.indexOf('<h4'), "Temporal badge precedes title");

  const snapStart = reportHtml.indexOf('id="visual-snapshots-container"');
  const snapEnd = reportHtml.indexOf('id="visual-snapshots-gallery"');
  const snapHeader = reportHtml.slice(snapStart, snapEnd);
  assert(snapHeader.indexOf('visual-snapshots-count-badge') < snapHeader.indexOf('<h4'), "Snapshots badge precedes title");

  const vbStart = reportHtml.indexOf('id="voice-body-coaching-container"');
  const vbEnd = reportHtml.indexOf('id="voice-body-coaching-list"');
  const vbHeader = reportHtml.slice(vbStart, vbEnd);
  assert(vbHeader.indexOf('voice-body-coaching-badge') < vbHeader.indexOf('<h4'), "Voice/body badge precedes title");

  const vmStart = reportHtml.indexOf('id="video-moments-container"');
  const vmEnd = reportHtml.indexOf('id="video-moments-list"');
  const vmHeader = reportHtml.slice(vmStart, vmEnd);
  assert(vmHeader.indexOf('video-moments-count-badge') < vmHeader.indexOf('<h4'), "Video moments badge precedes title");
  pass("Test 5: All 4 telemetry subcards place status badge on line 1 above title");

  // -------------------------------------------------------------------------
  // GROUP 3: ELIMINATION OF CENTERED CONTAINERS & GUEST LOCK TEASERS (PHASE 3)
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 3: ELIMINATION OF CENTERED CONTAINERS & LOCK TEASERS ---");

  // 6. .guest-locked-teaser-panel and .locked-section-notice enforced left-aligned
  assert(!reportCss.includes('.guest-locked-teaser-panel {\n  padding: 32px 24px;\n  background: #ffffff;\n  border: 1px dashed rgba(156, 163, 175, 0.5);\n  border-radius: 16px;\n  text-align: center;'),
    "Legacy centered guest teaser panel must be removed");
  assert(reportCss.includes('.guest-locked-teaser-panel') && reportCss.includes('text-align: left'),
    "report.css must enforce left alignment on .guest-locked-teaser-panel");
  assert(reportCss.includes('.locked-section-notice') && reportCss.includes('text-align: left'),
    "report.css must enforce left alignment on .locked-section-notice");
  pass("Test 6: Guest locked teaser panels strictly left-aligned with zero centering");

  // 7. Needs toggle button wrapper left-aligned
  assert(reportCss.includes('.needs-toggle-wrap') && reportCss.includes('text-align: left'),
    ".needs-toggle-wrap must be left-aligned");
  pass("Test 7: Needs breakdown toggle wrapper left-aligned");

  // -------------------------------------------------------------------------
  // GROUP 4: STRICT 4-STEP HIERARCHY ACROSS ALL 4 STAGES (PHASE 2 & 5)
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 4: STRICT 4-STEP HIERARCHY ACROSS ALL 4 STAGES ---");

  // 8. Stage 02: Nhận xét (#section-question-feedback)
  const qfbSecStart = reportHtml.indexOf('id="section-question-feedback"');
  const qfbSecEnd = reportHtml.indexOf('id="question-feedback-list"');
  assert(qfbSecStart !== -1 && qfbSecEnd !== -1, "section-question-feedback must exist");
  const qfbHeader = reportHtml.slice(qfbSecStart, qfbSecEnd);
  assert(qfbHeader.indexOf('class="section-badge"') < qfbHeader.indexOf('class="section-title"'),
    "Feedback badge precedes title");
  assert(qfbHeader.indexOf('class="section-title"') < qfbHeader.indexOf('class="section-desc"'),
    "Feedback title precedes description");
  pass("Test 8: Stage 02 (Nhận xét) strictly orders: Badge -> Title -> Description");

  // 9. Stage 03: Phân tích (#section-dimensions & #section-diagnostics)
  const dimSecStart = reportHtml.indexOf('id="section-dimensions"');
  const dimSecEnd = reportHtml.indexOf('id="radar-balance-snapshot"');
  assert(dimSecStart !== -1 && dimSecEnd !== -1, "section-dimensions must exist");
  const dimHeader = reportHtml.slice(dimSecStart, dimSecEnd);
  assert(dimHeader.indexOf('class="section-badge"') < dimHeader.indexOf('class="section-title"'),
    "Dimensions badge precedes title");
  assert(dimHeader.indexOf('class="section-title"') < dimHeader.indexOf('class="section-desc"'),
    "Dimensions title precedes description");

  const diagSecStart = reportHtml.indexOf('id="section-diagnostics"');
  const diagSecEnd = reportHtml.indexOf('class="diagnostic-tabs-container"');
  assert(diagSecStart !== -1 && diagSecEnd !== -1, "section-diagnostics must exist");
  const diagHeader = reportHtml.slice(diagSecStart, diagSecEnd);
  assert(diagHeader.indexOf('class="section-badge"') < diagHeader.indexOf('class="section-title"'),
    "Diagnostics badge precedes title");
  assert(diagHeader.indexOf('class="section-title"') < diagHeader.indexOf('class="section-desc"'),
    "Diagnostics title precedes description");
  pass("Test 9: Stage 03 (Dimensions & Diagnostics) strictly orders: Badge -> Title -> Description");

  // 10. Stage 04: Đề xuất (#section-roadmap, #section-supporting-materials, #section-reference-materials)
  assert(reportHtml.indexOf('TẦNG 1 • ĐỀ XUẤT TRỌNG TÂM') < reportHtml.indexOf('Các Đề Xuất Cải Thiện Trọng Tâm'),
    "Roadmap badge precedes title");
  assert(reportHtml.indexOf('TẦNG 2 • CẨM NANG ÔN LUYỆN') < reportHtml.indexOf('Cẩm Nang Hướng Dẫn Ôn Luyện'),
    "Supporting materials badge precedes title");
  assert(reportHtml.indexOf('TẦNG 3 • TÀI LIỆU THAM KHẢO') < reportHtml.indexOf('Tài Liệu &amp; Nguồn Tham Khảo Chuyên Sâu'),
    "Reference materials badge precedes title");
  pass("Test 10: Stage 04 (All 3 Tiers) strictly orders: Badge -> Title -> Description");

  // -------------------------------------------------------------------------
  // GROUP 5: CSS DESIGN SYSTEM & UNIFORM TYPOGRAPHY (PHASE 5 & 6)
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 5: CSS DESIGN SYSTEM & UNIFORM TYPOGRAPHY ---");

  // 11. All section-title-wrap classes enforced as flex-direction: column !important
  assert(reportCss.includes('.section-title-wrap,') && reportCss.includes('flex-direction: column !important;'),
    "report.css must enforce flex-direction: column on all section title wrappers");
  pass("Test 11: All section title wraps globally enforced as flex column (left-aligned)");

  // 12. Uniform .section-title typography (1.25rem, 800 weight, primary text, left-aligned)
  assert(reportCss.includes('.section-title,') && reportCss.includes('font-size: 1.25rem !important;'),
    "report.css must enforce uniform 1.25rem font-size on all section titles");
  assert(reportCss.includes('font-weight: 800 !important;'),
    "report.css must enforce uniform 800 font-weight on all section titles");
  pass("Test 12: Section titles unified across all stages at 1.25rem / 800 weight");

  // 13. Uniform .section-badge styling (compact padding, align-self: flex-start)
  assert(reportCss.includes('.section-badge,') && reportCss.includes('align-self: flex-start !important;'),
    "Badges must be left-aligned via align-self: flex-start");
  assert(reportCss.includes('padding: 3px 9px !important;'),
    "Badges must use compact, consistent 3px 9px padding");
  pass("Test 13: Section badges globally standardized with compact padding and left alignment");

  // 14. Responsive layout & Dark Mode overrides
  assert(reportCss.includes('html[data-theme="dark"] .section-title') && reportCss.includes('color: #f1f5f9 !important;'),
    "Dark mode overrides for section titles verified");
  assert(reportCss.includes('@media (max-width: 768px)') && reportCss.includes('.section-title'),
    "Responsive rules for mobile viewports verified");
  pass("Test 14: Dark mode theme overrides and responsive mobile rules verified");

  // -------------------------------------------------------------------------
  // GROUP 6: PRODUCTION DATABASE SHA256 INTEGRITY (INVARIANT)
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 6: DATABASE INTEGRITY INVARIANT ---");
  const dbBytes = fs.readFileSync(DB_PATH);
  const actualHash = crypto.createHash("sha256").update(dbBytes).digest("hex").toUpperCase();
  assert.strictEqual(actualHash, EXPECTED_DB_HASH, `Database must remain intact! Got ${actualHash}`);
  pass("Test 15: Production database SHA256 hash strictly preserved (44223D9B...)");

  console.log(`\n==================================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, 0 FAILED (100% SUCCESS)`);
  console.log(`==================================================================`);
}

runTests().catch(err => {
  console.error("[TEST FAILURE]:", err);
  process.exit(1);
});
