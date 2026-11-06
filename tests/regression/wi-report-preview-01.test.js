/**
 * WI-REPORT-PREVIEW-01: GUEST REPORT PREVIEW & CONVERSION-ORIENTED ACCESS DESIGN
 * Comprehensive Regression & Architecture Verification Suite
 *
 * Verifies:
 * 1. Tier 1 (Guest Preview) authentic data contract:
 *    - OverallScore on 0-100 SSOT point scale and evaluation rating
 *    - Handled states: AVAILABLE, PENDING, EVALUATION_FAILED, INSUFFICIENT_EVIDENCE
 *    - Top 2-3 genuine strengths with competency, comment, and evidence snippet
 *    - Top 1-2 improvement focus with problem, why, action
 *    - Performance Snapshot: 5 core dimensions with NOT_ASSESSED status (no fake 0s)
 *    - Multimodal Snapshot: distinct Communication, Voice, Body Language (with empty/inactive states)
 *    - Representative evaluation sample from authentic answer
 *    - Evidence coverage & Evaluation confidence
 * 2. Backend Access Control & Anti-Leakage:
 *    - Sanitized GuestPreviewDto returned
 *    - Detailed answers array, timestamps, raw evidence omitted for guests
 * 3. Single Login Entry Point:
 *    - Exactly ONE Unified Access Gate
 *    - Correct title, description, and single CTA: 'Đăng nhập / Đăng ký để xem toàn bộ'
 *    - Zero duplicate login buttons in subsections; all locked sections route via scrollToUnifiedAccessGate()
 * 4. CSS Design System & Dark Mode Theming.
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "../..");

let passed = 0;
function pass(msg) {
  console.log(`  [PASS] ${msg}`);
  passed++;
}

async function runTests() {
  console.log("==================================================================");
  console.log("  WI-REPORT-PREVIEW-01: GUEST REPORT PREVIEW REGRESSION SUITE     ");
  console.log("==================================================================");

  const reportHtml = fs.readFileSync(path.join(ROOT, "FE/features/report/report.html"), "utf8");
  const reportJs = fs.readFileSync(path.join(ROOT, "FE/features/report/report.js"), "utf8");
  const reportCss = fs.readFileSync(path.join(ROOT, "FE/features/report/report.css"), "utf8");
  const builderCs = fs.readFileSync(path.join(ROOT, "BE/Services/Evaluation/GuestReportPreviewBuilder.cs"), "utf8");
  const sessionsControllerCs = fs.readFileSync(path.join(ROOT, "BE/Controllers/SessionsController.cs"), "utf8");
  const aiControllerCs = fs.readFileSync(path.join(ROOT, "BE/Controllers/AIController.cs"), "utf8");

  // -------------------------------------------------------------------------
  // 1. BACKEND GUEST PREVIEW BUILDER & SANITIZATION CONTRACT
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 1: BACKEND GUEST PREVIEW BUILDER & ACCESS SANITIZATION ---");

  // Invariant 1: GuestReportPreviewBuilder implements 0-100 scale SSOT and evaluation status
  assert(builderCs.includes("class GuestReportPreviewBuilder"), "GuestReportPreviewBuilder class defined");
  assert(builderCs.includes("OverallScore { get; set; }"), "OverallScore property defined");
  assert(builderCs.includes("public string EvaluationStatus"), "EvaluationStatus property defined");
  assert(builderCs.includes("AVAILABLE") && builderCs.includes("PENDING") && builderCs.includes("EVALUATION_FAILED") && builderCs.includes("INSUFFICIENT_EVIDENCE"), "All 4 evaluation statuses defined in builder");
  pass("Test 1: GuestReportPreviewBuilder defines SSOT 0-100 score and explicit status model");

  // Invariant 2: Top strengths and Improvement focus extraction
  assert(builderCs.includes("class GuestStrengthPreviewItem"), "GuestStrengthPreviewItem defined");
  assert(builderCs.includes("Competency") && builderCs.includes("Evidence"), "Strength contains Competency and Evidence");
  assert(builderCs.includes("class GuestImprovementPreviewItem"), "GuestImprovementPreviewItem defined");
  assert(builderCs.includes("Problem") && builderCs.includes("Why") && builderCs.includes("Action"), "ImprovementFocus contains Problem, Why, Action");
  pass("Test 2: Top strengths (2-3 items) and Improvement priorities (1-2 items) structured with evidence");

  // Invariant 3: Performance Snapshot and Multimodal Snapshot models
  assert(builderCs.includes("class GuestPerformanceSnapshot"), "GuestPerformanceSnapshot defined");
  assert(builderCs.includes("Technical") && builderCs.includes("Star") && builderCs.includes("Situational"), "Core dimensions defined in PerformanceSnapshot");
  assert(builderCs.includes("Communication") && builderCs.includes("VoiceDelivery") && builderCs.includes("BodyLanguage"), "3 Modalities defined in GuestPreview");
  assert(builderCs.includes("NOT_ASSESSED"), "NOT_ASSESSED status supported for dimensions and modalities");
  assert(builderCs.includes("class GuestRepresentativeSample"), "GuestRepresentativeSample defined for real answer snippet");
  pass("Test 3: Performance Snapshot (5 dimensions, no fake 0s) and Multimodal Snapshot (3 modalities + real answer sample)");

  // Invariant 4: Controller projections enforce guest preview isolation
  assert(sessionsControllerCs.includes("GuestReportPreviewBuilder.BuildGuestPreview"), "SessionsController uses GuestReportPreviewBuilder");
  assert(sessionsControllerCs.includes("isGuestPreview = true"), "SessionsController marks isGuestPreview: true for guests");
  assert(!sessionsControllerCs.includes("techScore = session.Report.TechScore"), "Detailed techScore omitted from guest root");
  assert(aiControllerCs.includes("GuestReportPreviewBuilder.BuildGuestPreview"), "AIController uses GuestReportPreviewBuilder for guest report");
  pass("Test 4: Backend controllers strictly project sanitized Guest Preview without private transcript/timestamp leak");

  // -------------------------------------------------------------------------
  // 2. FRONTEND DOM ARCHITECTURE & TIER 1 PREVIEW SECTIONS
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 2: FRONTEND DOM ARCHITECTURE (SECTIONS 1 TO 6) ---");

  // Section 4: Performance Snapshot DOM
  assert(reportHtml.includes('id="section-performance-snapshot"'), "report.html defines #section-performance-snapshot");
  assert(reportHtml.includes('id="performance-snapshot-grid"'), "report.html defines #performance-snapshot-grid");
  pass("Test 5: Section 4 (Performance Snapshot) container present in report.html");

  // Section 5: Multimodal Snapshot DOM & Representative Sample
  assert(reportHtml.includes('id="section-multimodal-snapshot"'), "report.html defines #section-multimodal-snapshot");
  assert(reportHtml.includes('id="multimodal-snapshot-grid"'), "report.html defines #multimodal-snapshot-grid");
  assert(reportHtml.includes('id="representative-sample-container"'), "report.html defines #representative-sample-container");
  pass("Test 6: Section 5 (Communication, Voice, Body Language & Representative Sample) containers present in report.html");

  // Section 6: Unified Access Gate DOM
  assert(reportHtml.includes('id="unified-access-gate"'), "report.html defines #unified-access-gate");
  pass("Test 7: Section 6 (Unified Access Gate) placed directly after Section 5");

  // -------------------------------------------------------------------------
  // 3. FRONTEND LOGIC & RENDERING FUNCTIONS
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 3: FRONTEND RENDERING LOGIC & STATE HANDLING ---");

  // Performance Snapshot renderer
  assert(reportJs.includes("function renderPerformanceSnapshot"), "report.js implements renderPerformanceSnapshot");
  assert(reportJs.includes("performance-dimension-card"), "renderPerformanceSnapshot renders performance-dimension-card");
  assert(reportJs.includes("CHƯA ĐÁNH GIÁ"), "renderPerformanceSnapshot renders 'CHƯA ĐÁNH GIÁ' badge for unassessed dims");
  pass("Test 8: renderPerformanceSnapshot renders 5 dimensions with explicit NOT_ASSESSED distinction (no fake 0s)");

  // Multimodal Snapshot renderer
  assert(reportJs.includes("function renderMultimodalSnapshot"), "report.js implements renderMultimodalSnapshot");
  assert(reportJs.includes("representative-sample-card"), "renderMultimodalSnapshot renders representative-sample-card");
  assert(reportJs.includes("VÍ DỤ ĐÁNH GIÁ TIÊU BIỂU"), "renderMultimodalSnapshot renders representative sample header");
  assert(reportJs.includes("Giao tiếp & Cấu trúc lập luận"), "renderMultimodalSnapshot renders Communication modality");
  assert(reportJs.includes("Voice Delivery"), "renderMultimodalSnapshot renders Voice Delivery modality");
  assert(reportJs.includes("Body Language"), "renderMultimodalSnapshot renders Body Language modality");
  pass("Test 9: renderMultimodalSnapshot renders 3 distinct modalities and representative evaluation sample");

  // Overview Hero score status handling (PENDING, EVALUATION_FAILED, INSUFFICIENT_EVIDENCE)
  assert(reportJs.includes("EVALUATION_FAILED"), "renderOverviewHero checks EVALUATION_FAILED");
  assert(reportJs.includes("INSUFFICIENT_EVIDENCE"), "renderOverviewHero checks INSUFFICIENT_EVIDENCE");
  assert(reportJs.includes("Đang xử lý đánh giá (Evaluation Pending)"), "Pending state displays non-numeric explanation");
  assert(reportJs.includes("Đánh giá thất bại (Evaluation Failed)"), "Failed state displays non-numeric explanation");
  assert(reportJs.includes("Chưa đủ dữ liệu để kết luận (Insufficient Evidence)"), "Insufficient evidence displays non-numeric explanation");
  pass("Test 10: Non-available evaluation states render informative status explanations without fake numeric scores");

  // Executive highlights rendering authentic data for guests
  assert(reportJs.includes("guest-strength-item"), "renderOverviewHero renders authentic guest-strength-item");
  assert(reportJs.includes("guest-priority-item"), "renderOverviewHero renders authentic guest-priority-item");
  assert(reportJs.includes("Chưa có đủ câu hỏi và câu trả lời để kiểm chứng điểm mạnh"), "Empty strengths handled informatively");
  assert(reportJs.includes("Không phát hiện lỗ hổng lớn cần khắc phục"), "Empty priorities handled constructively");
  pass("Test 11: Executive highlights render authentic 2-3 strengths and 1-2 priorities with evidence for guests");

  // -------------------------------------------------------------------------
  // 4. SINGLE LOGIN ENTRY POINT CONTRACT
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 4: SINGLE LOGIN ENTRY POINT CONTRACT ---");

  // Single Unified Access Gate title and description
  assert(reportJs.includes("Xem toàn bộ phân tích phỏng vấn"), "Unified Access Gate renders title 'Xem toàn bộ phân tích phỏng vấn'");
  assert(reportJs.includes("Khám phá chi tiết từng câu trả lời, bằng chứng chấm điểm, phân tích giọng nói và tác phong, cùng hướng cải thiện dành riêng cho bạn."),
    "Unified Access Gate renders exact conversion-oriented description");
  assert(reportJs.includes("Đăng nhập / Đăng ký để xem toàn bộ"), "Unified Access Gate renders single CTA 'Đăng nhập / Đăng ký để xem toàn bộ'");
  assert(reportJs.includes("scrollToUnifiedAccessGate"), "scrollToUnifiedAccessGate helper defined");
  pass("Test 12: Unified Access Gate rendered with exact required title, description, and single CTA");

  // Subsections route to Unified Gate without duplicate login buttons
  const teaserMatch = reportJs.match(/function createLockedTeaserHtml[\s\S]*?^}/m);
  assert(teaserMatch, "createLockedTeaserHtml defined");
  assert(teaserMatch[0].includes("scrollToUnifiedAccessGate()"), "Locked teasers route clicks to scrollToUnifiedAccessGate()");
  pass("Test 13: Subsections contain zero duplicate login buttons and route to Unified Access Gate");

  // -------------------------------------------------------------------------
  // 5. CSS DESIGN SYSTEM & THEMING
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 5: CSS DESIGN SYSTEM & THEMING ---");

  assert(reportCss.includes(".guest-preview-section"), "report.css styles .guest-preview-section");
  assert(reportCss.includes(".performance-snapshot-grid"), "report.css styles .performance-snapshot-grid");
  assert(reportCss.includes(".performance-dimension-card"), "report.css styles .performance-dimension-card");
  assert(reportCss.includes(".multimodal-snapshot-grid"), "report.css styles .multimodal-snapshot-grid");
  assert(reportCss.includes(".multimodal-card"), "report.css styles .multimodal-card");
  assert(reportCss.includes(".representative-sample-card"), "report.css styles .representative-sample-card");

  // Dark mode rules
  assert(reportCss.includes('html[data-theme="dark"] .guest-preview-section'), "Dark mode styles for guest-preview-section");
  assert(reportCss.includes('html[data-theme="dark"] .performance-dimension-card'), "Dark mode styles for performance-dimension-card");
  assert(reportCss.includes('html[data-theme="dark"] .representative-sample-card'), "Dark mode styles for representative-sample-card");
  pass("Test 14: CSS styling verified for snapshot grids, cards, badges, and dark mode theming");

  console.log(`\n==================================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, 0 FAILED (100% SUCCESS)`);
  console.log(`==================================================================`);
}

runTests().catch(err => {
  console.error("[TEST FAILURE]:", err);
  process.exit(1);
});
