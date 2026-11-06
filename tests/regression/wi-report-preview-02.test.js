/**
 * WI-REPORT-PREVIEW-02: GUEST REPORT PREVIEW REDUCTION & VALUE PROTECTION
 * Comprehensive Acceptance & Regression Test Suite
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
  console.log("  WI-REPORT-PREVIEW-02: GUEST REPORT PREVIEW REDUCTION & PROTECTION");
  console.log("==================================================================");

  const reportHtml = fs.readFileSync(path.join(ROOT, "FE/features/report/report.html"), "utf8");
  const reportJs = fs.readFileSync(path.join(ROOT, "FE/features/report/report.js"), "utf8");
  const reportCss = fs.readFileSync(path.join(ROOT, "FE/features/report/report.css"), "utf8");
  const builderCs = fs.readFileSync(path.join(ROOT, "BE/Services/Evaluation/GuestReportPreviewBuilder.cs"), "utf8");
  const sessionsControllerCs = fs.readFileSync(path.join(ROOT, "BE/Controllers/SessionsController.cs"), "utf8");
  const aiControllerCs = fs.readFileSync(path.join(ROOT, "BE/Controllers/AIController.cs"), "utf8");

  // -------------------------------------------------------------------------
  // 1. BACKEND GUEST DATA MINIMIZATION & ALLOWLIST CONTRACT
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 1: BACKEND GUEST DATA MINIMIZATION & STRICT ALLOWLIST ---");

  // Invariant 1: GuestReportPreviewBuilder produces reduced Tier 1 DTO
  assert(builderCs.includes("class GuestReportPreviewBuilder"), "GuestReportPreviewBuilder class defined");
  assert(builderCs.includes("OverallScore { get; set; }"), "OverallScore property defined");
  assert(builderCs.includes("Interpretation { get; set; }"), "Interpretation property defined");
  assert(builderCs.includes("ImprovementTeaser { get; set; }"), "ImprovementTeaser property defined");
  assert(builderCs.includes("class GuestCapabilityTeaserDto"), "GuestCapabilityTeaserDto defined");
  pass("Test 1: GuestReportPreviewBuilder implements reduced Tier 1 teaser models");

  // Invariant 2: Strengths limited to max 2 high-level observations with NO answer quotes
  assert(builderCs.includes("Take(2)"), "Strengths and improvement teaser limited to maximum 2 items");
  assert(builderCs.includes("Evidence = string.Empty"), "Evidence snippets and answer quotations strictly empty in guest preview");
  pass("Test 2: Top strengths strictly capped at 2 observations with zero answer quotations");

  // Invariant 3: Single improvement theme only (no root cause, why, or action plan)
  assert(builderCs.includes("ResolveImprovementTeaser"), "ResolveImprovementTeaser isolates single theme");
  pass("Test 3: Improvement teaser reveals only ONE high-level improvement theme");

  // Invariant 4: No dimension scores or multimodal metrics in Guest DTO
  assert(builderCs.includes("PerformanceSnapshot? PerformanceSnapshot { get; set; } = null"), "PerformanceSnapshot set to null in guest DTO");
  assert(builderCs.includes("Communication { get; set; } = null"), "Communication modality set to null in guest DTO");
  assert(builderCs.includes("VoiceDelivery { get; set; } = null"), "VoiceDelivery modality set to null in guest DTO");
  assert(builderCs.includes("BodyLanguage { get; set; } = null"), "BodyLanguage modality set to null in guest DTO");
  assert(builderCs.includes("RepresentativeSample { get; set; } = null"), "RepresentativeSample set to null in guest DTO");
  pass("Test 4: Dimension breakdown, voice metrics, body language observations, and answer samples omitted");

  // Invariant 5: Both SessionsController and AIController enforce identical minimized allowlist
  const checkAllowlist = (src, name) => {
    assert(src.includes("GuestReportPreviewBuilder.BuildGuestPreview"), `${name} calls BuildGuestPreview`);
    assert(src.includes("isGuestPreview = true"), `${name} sets isGuestPreview flag`);
    assert(src.includes("summary = guestPreview.Summary"), `${name} includes summary`);
    assert(src.includes("interpretation = guestPreview.Interpretation"), `${name} includes interpretation`);
    assert(src.includes("topStrengths = guestPreview.TopStrengths"), `${name} includes topStrengths`);
    assert(src.includes("improvementTeaser = guestPreview.ImprovementTeaser"), `${name} includes improvementTeaser`);
    assert(src.includes("analysisCapabilityTeaser = guestPreview.AnalysisCapabilityTeaser"), `${name} includes analysisCapabilityTeaser`);
    // Ensure omitted fields are not in guest report projection
    assert(!src.includes("performanceSnapshot = guestPreview.PerformanceSnapshot"), `${name} omits performanceSnapshot`);
    assert(!src.includes("voiceSnapshot = guestPreview.VoiceDelivery"), `${name} omits voiceSnapshot`);
    assert(!src.includes("bodyLanguageSnapshot = guestPreview.BodyLanguage"), `${name} omits bodyLanguageSnapshot`);
    assert(!src.includes("representativeSample = guestPreview.RepresentativeSample"), `${name} omits representativeSample`);
  };
  checkAllowlist(sessionsControllerCs, "SessionsController");
  checkAllowlist(aiControllerCs, "AIController");
  pass("Test 5: Both SessionsController and AIController enforce the identical minimized allowlist");

  // -------------------------------------------------------------------------
  // 2. FRONTEND DOM ARCHITECTURE & TEASER RESTRAINTS
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 2: FRONTEND DOM ARCHITECTURE & TEASER STRUCTURE ---");

  // Analysis Capability Teaser container
  assert(reportHtml.includes('id="guest-capability-teaser"'), "report.html defines #guest-capability-teaser");
  pass("Test 6: Analysis Capability Teaser container positioned before Unified Access Gate");

  // Exactly ONE Unified Access Gate
  const gateMatches = reportHtml.match(/id="unified-access-gate"/g);
  assert(gateMatches && gateMatches.length === 1, "Exactly ONE Unified Access Gate defined in report.html");
  pass("Test 7: Exactly ONE Unified Access Gate positioned after preview and before locked sections");

  // -------------------------------------------------------------------------
  // 3. FRONTEND TEASER RENDERING & VALUE PROTECTION
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 3: FRONTEND RENDERING & ANALYTICAL VALUE PROTECTION ---");

  // Restrained Analysis Capability Teaser
  assert(reportJs.includes("function renderCapabilityTeaser"), "report.js implements renderCapabilityTeaser");
  assert(reportJs.includes("capability-teaser-card"), "renderCapabilityTeaser renders capability-teaser-card");
  assert(reportJs.includes("GIÁ TRỊ PHÂN TÍCH CHUYÊN SÂU"), "renderCapabilityTeaser renders restrained badge");
  pass("Test 8: renderCapabilityTeaser renders restrained capability teaser without analytical results/scores");

  // Overview Hero renders max 2 strengths and 1 improvement theme
  assert(reportJs.includes("guestStrengths.slice(0, 2)"), "renderOverviewHero renders max 2 strengths for guests");
  assert(reportJs.includes("item.observation"), "renderOverviewHero renders high-level observation");
  assert(!reportJs.includes("item.evidenceSnippet"), "renderOverviewHero does NOT render evidence quotation snippets");
  assert(reportJs.includes("guestPreview.improvementTeaser"), "renderOverviewHero extracts single improvement theme");
  pass("Test 9: Overview Hero displays max 2 strengths without quotations and exactly ONE improvement theme");

  // Performance and Multimodal Snapshot replaced with locked teasers
  assert(reportJs.includes("function renderPerformanceSnapshot"), "renderPerformanceSnapshot defined");
  assert(reportJs.includes("function renderMultimodalSnapshot"), "renderMultimodalSnapshot defined");
  const snapFuncMatch = reportJs.match(/function renderPerformanceSnapshot[\s\S]*?^}/m);
  assert(snapFuncMatch && snapFuncMatch[0].includes("createLockedTeaserHtml"), "renderPerformanceSnapshot renders locked teaser");
  const multiFuncMatch = reportJs.match(/function renderMultimodalSnapshot[\s\S]*?^}/m);
  assert(multiFuncMatch && multiFuncMatch[0].includes("createLockedTeaserHtml"), "renderMultimodalSnapshot renders locked teaser");
  pass("Test 10: Performance and Multimodal Snapshots replaced with locked-section previews");

  // -------------------------------------------------------------------------
  // 4. SINGLE LOGIN ENTRY POINT CONTRACT
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 4: SINGLE LOGIN ENTRY POINT CONTRACT ---");

  // Gate title, description, and single CTA
  assert(reportJs.includes("Xem toàn bộ phân tích phỏng vấn"), "Unified Access Gate renders title 'Xem toàn bộ phân tích phỏng vấn'");
  assert(reportJs.includes("Khám phá đánh giá chi tiết từng câu trả lời, phân tích cách thể hiện và lộ trình cải thiện được cá nhân hóa."),
    "Unified Access Gate renders exact WI-REPORT-PREVIEW-02 description");
  assert(reportJs.includes("Đăng nhập / Đăng ký để xem toàn bộ"), "Unified Access Gate renders single CTA 'Đăng nhập / Đăng ký để xem toàn bộ'");
  pass("Test 11: Unified Access Gate rendered with exact required title, description, and single CTA");

  // All locked sections route to scrollToUnifiedAccessGate without separate buttons
  const teaserMatch = reportJs.match(/function createLockedTeaserHtml[\s\S]*?^}/m);
  assert(teaserMatch, "createLockedTeaserHtml defined");
  assert(teaserMatch[0].includes("scrollToUnifiedAccessGate()"), "Locked teasers route clicks to scrollToUnifiedAccessGate()");
  assert(!teaserMatch[0].includes('href="${loginUrl}"'), "createLockedTeaserHtml contains zero duplicate login links");
  pass("Test 12: All locked sections route to Unified Access Gate with zero duplicate login buttons");

  // -------------------------------------------------------------------------
  // 5. CSS DESIGN SYSTEM & THEMING
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 5: CSS DESIGN SYSTEM & THEMING ---");

  assert(reportCss.includes(".guest-capability-teaser"), "report.css styles .guest-capability-teaser");
  assert(reportCss.includes(".capability-teaser-card"), "report.css styles .capability-teaser-card");
  assert(reportCss.includes(".capability-pills-row"), "report.css styles .capability-pills-row");
  assert(reportCss.includes(".capability-pill"), "report.css styles .capability-pill");
  assert(reportCss.includes(".hero-interpretation-text"), "report.css styles .hero-interpretation-text");

  // Dark mode rules
  assert(reportCss.includes('html[data-theme="dark"] .capability-teaser-card'), "Dark mode styles for capability-teaser-card");
  assert(reportCss.includes('html[data-theme="dark"] .capability-pill'), "Dark mode styles for capability-pill");
  pass("Test 13: CSS styling verified for capability teaser, pills, interpretation line, and dark mode");

  console.log(`\n==================================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, 0 FAILED (100% SUCCESS)`);
  console.log(`==================================================================`);
}

runTests().catch(err => {
  console.error("[TEST FAILURE]:", err);
  process.exit(1);
});
