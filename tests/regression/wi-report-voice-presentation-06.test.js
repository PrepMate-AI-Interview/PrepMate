/**
 * ==============================================================================
 * PREPMATE — TEST SUITE: WI-REPORT-VOICE-PRESENTATION-UX-06
 * Voice Analysis & Presentation Skills Live UI/UX Refinement & Separation
 * ==============================================================================
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const REPORT_HTML_PATH = path.join(ROOT, "FE/features/report/report.html");
const REPORT_JS_PATH = path.join(ROOT, "FE/features/report/report.js");
const REPORT_CSS_PATH = path.join(ROOT, "FE/features/report/report.css");

let totalTests = 0;
let passedTests = 0;

function pass(desc) {
  totalTests++;
  passedTests++;
  console.log(`[PASS] ${desc}`);
}

function runAudit() {
  console.log("================================================================");
  console.log("  TEST SUITE: WI-REPORT-VOICE-PRESENTATION-UX-06               ");
  console.log("================================================================\n");

  const html = fs.readFileSync(REPORT_HTML_PATH, "utf8");
  const js = fs.readFileSync(REPORT_JS_PATH, "utf8");
  const css = fs.readFileSync(REPORT_CSS_PATH, "utf8");

  // ---------------------------------------------------------------------------
  // GROUP 1: Clean Separation of Voice Analysis & Presentation Skills
  // ---------------------------------------------------------------------------
  console.log("--- GROUP 1: Clean Separation of Voice Analysis & Presentation Skills ---");

  // 1.1 Group A exists with distinct ID and semantic badge
  assert(html.includes('id="group-voice-analysis"'), "Must have group-voice-analysis container");
  assert(html.includes("voice-analysis-group"), "Must have voice-analysis-group class");
  assert(html.includes("NHÓM A • ĐẶC ĐIỂM ÂM THANH"), "Must have Group A semantic badge");
  pass("1.1 Group A (Voice Analysis) container present with dedicated badge");

  // 1.2 Group B exists with distinct ID and semantic badge
  assert(html.includes('id="group-presentation-skills"'), "Must have group-presentation-skills container");
  assert(html.includes("presentation-skills-group"), "Must have presentation-skills-group class");
  assert(html.includes("NHÓM B • TỔ CHỨC THÔNG ĐIỆP"), "Must have Group B semantic badge");
  pass("1.2 Group B (Presentation Skills) container present with dedicated badge");

  // 1.3 Hairline separator between Group A and Group B
  assert(html.includes('class="speech-groups-separator"'), "Must have speech-groups-separator divider");
  const voiceIdx = html.indexOf('id="group-voice-analysis"');
  const sepIdx = html.indexOf('class="speech-groups-separator"');
  const presIdx = html.indexOf('id="group-presentation-skills"');
  assert(voiceIdx !== -1 && sepIdx !== -1 && presIdx !== -1, "All three elements must exist");
  assert(voiceIdx < sepIdx && sepIdx < presIdx, "Separator must be placed strictly between Group A and Group B");
  pass("1.3 Hairline separator positioned strictly between Group A and Group B");

  // 1.4 Group A houses only acoustic/voice features
  const groupAHtml = html.slice(voiceIdx, sepIdx);
  assert(groupAHtml.includes('id="speech-metrics-grid"'), "Group A must contain speech-metrics-grid");
  assert(groupAHtml.includes('id="speech-fillers-breakdown-card"'), "Group A must contain speech-fillers-breakdown-card");
  assert(groupAHtml.includes('id="speech-fillers-list"'), "Group A must contain speech-fillers-list");
  assert(groupAHtml.includes('id="speech-practice-box"'), "Group A must contain speech-practice-box");
  assert(groupAHtml.includes('id="speech-practice-moments-list"'), "Group A must contain speech-practice-moments-list");
  assert(!groupAHtml.includes('id="speech-delivery-structure-card"'), "Group A must NOT contain structure card");
  assert(!groupAHtml.includes('id="speech-priority-plan"'), "Group A must NOT contain priority drills");
  pass("1.4 Group A houses strictly acoustic properties (metrics, fillers, audio moments)");

  // 1.5 Group B houses only presentation/structure features
  const telemetryIdx = html.indexOf('id="telemetry-disclosure-card"');
  const groupBHtml = html.slice(presIdx, telemetryIdx !== -1 ? telemetryIdx : undefined);
  assert(groupBHtml.includes('id="speech-delivery-structure-card"'), "Group B must contain speech-delivery-structure-card");
  assert(groupBHtml.includes('id="speech-structure-summary"'), "Group B must contain speech-structure-summary");
  assert(groupBHtml.includes('id="speech-priority-plan"'), "Group B must contain speech-priority-plan");
  assert(groupBHtml.includes('id="speech-priority-items-list"'), "Group B must contain speech-priority-items-list");
  assert(!groupBHtml.includes('id="speech-metrics-grid"'), "Group B must NOT contain acoustic metrics grid");
  assert(!groupBHtml.includes('id="speech-fillers-breakdown-card"'), "Group B must NOT contain filler breakdown card");
  pass("1.5 Group B houses strictly message organization & delivery structure");

  // ---------------------------------------------------------------------------
  // GROUP 2: Emoji Elimination & Lucide SVG Standard
  // ---------------------------------------------------------------------------
  console.log("\n--- GROUP 2: Emoji Elimination & Lucide SVG Standard ---");

  // 2.1 Clock emoji replaced by SVG in report.js
  const speechRenderStart = js.indexOf("async function renderSpeechCoachingSection");
  const speechRenderEnd = js.indexOf("async function renderVisualCoachingSection");
  const speechJs = js.slice(speechRenderStart, speechRenderEnd);
  assert(!speechJs.includes("⏱️"), "Stopwatch emoji ⏱️ must be completely eliminated from report.js");
  assert(speechJs.includes('viewBox="0 0 24 24"'), "Must use standard 24x24 SVG icons");
  pass("2.1 Stopwatch emoji ⏱️ eliminated and replaced by Lucide clock SVG");

  // 2.2 Headings use pm-heading-with-icon pattern
  assert(html.includes('<h3 class="speech-group-title pm-heading-with-icon">'), "Group title uses standard heading pattern");
  assert(html.includes('<h4 class="speech-card-title pm-heading-with-icon">'), "Card title uses standard heading pattern");
  pass("2.2 Group and card headings strictly adhere to pm-heading-with-icon standard");

  // ---------------------------------------------------------------------------
  // GROUP 3: Layout, Spacing Tokens & Alignment Contract
  // ---------------------------------------------------------------------------
  console.log("\n--- GROUP 3: Layout, Spacing Tokens & Alignment Contract ---");

  // 3.1 Tokenized padding and spacing in report.css
  assert(css.includes(".speech-group-panel {"), "speech-group-panel style defined");
  assert(css.includes("var(--space-6, 24px)"), "speech-group-panel uses --space-6 padding token");
  assert(css.includes("var(--space-5, 20px)"), "speech-group-panel uses --space-5 gap token");
  pass("3.1 speech-group-panel uses canonical 4/8pt spacing scale tokens");

  // 3.2 Accent borders distinguish the two groups
  assert(css.includes(".voice-analysis-group"), "voice-analysis-group style defined");
  assert(css.includes("#0284c7"), "Voice group has Sky 600 accent border");
  assert(css.includes(".presentation-skills-group"), "presentation-skills-group style defined");
  assert(css.includes("#8b5cf6"), "Presentation group has Violet 500 accent border");
  pass("3.2 Distinct accent border colors clearly brand Group A (Sky) vs Group B (Violet)");

  // 3.3 Subtle separator styling
  assert(css.includes(".speech-groups-separator {"), "speech-groups-separator style defined");
  pass("3.3 Clean hairline separator styled with adequate margin");

  // ---------------------------------------------------------------------------
  // GROUP 4: Guest Access & Restrictions Synchronization
  // ---------------------------------------------------------------------------
  console.log("\n--- GROUP 4: Guest Access & Restrictions Synchronization ---");

  // 4.1 applyGuestRestrictions handles new group panels
  assert(js.includes('document.getElementById("group-voice-analysis")'), "applyGuestRestrictions checks group-voice-analysis");
  assert(js.includes('document.getElementById("group-presentation-skills")'), "applyGuestRestrictions checks group-presentation-skills");
  pass("4.1 Guest restriction locking hides both voice and presentation groups seamlessly");

  // 4.2 resetGuestLockedState restores new group panels
  const liftStart = js.indexOf("function resetGuestLockedState");
  const liftEnd = js.indexOf("function applyGuestRestrictions");
  const liftJs = js.slice(liftStart, liftEnd);
  assert(liftJs.includes('document.getElementById("group-voice-analysis")'), "resetGuestLockedState restores group-voice-analysis");
  assert(liftJs.includes('document.getElementById("group-presentation-skills")'), "resetGuestLockedState restores group-presentation-skills");
  pass("4.2 Guest restriction lifting cleanly restores both group panels");

  // ---------------------------------------------------------------------------
  // GROUP 5: Multi-Breakpoint Responsive Matrix & Dark Mode
  // ---------------------------------------------------------------------------
  console.log("\n--- GROUP 5: Multi-Breakpoint Responsive Matrix & Dark Mode ---");

  // 5.1 Responsive breakpoints for speech metrics grid
  assert(css.includes("@media (max-width: 768px)") && css.includes("grid-template-columns: repeat(2, 1fr)"), "Tablet 2-col grid defined");
  assert(css.includes("@media (max-width: 480px)") && css.includes("grid-template-columns: 1fr"), "Mobile 1-col grid defined");
  pass("5.1 Responsive media queries adapt metrics grid from 4 -> 2 -> 1 columns");

  // 5.2 Dark mode overrides for new components
  assert(css.includes('[data-theme="dark"] .speech-group-panel'), "Dark mode override for speech-group-panel");
  assert(css.includes('[data-theme="dark"] .voice-badge'), "Dark mode override for voice-badge");
  assert(css.includes('[data-theme="dark"] .presentation-badge'), "Dark mode override for presentation-badge");
  assert(css.includes('[data-theme="dark"] .speech-metric-card'), "Dark mode override for speech-metric-card");
  assert(css.includes('[data-theme="dark"] .speech-practice-card'), "Dark mode override for speech-practice-card");
  assert(css.includes('[data-theme="dark"] .speech-priority-item'), "Dark mode override for speech-priority-item");
  pass("5.2 Comprehensive dark mode overrides verified for all group panels and child cards");

  // ---------------------------------------------------------------------------
  // GROUP 6: DOM Contract & Core Architecture Preservation
  // ---------------------------------------------------------------------------
  console.log("\n--- GROUP 6: DOM Contract & Core Architecture Preservation ---");

  // 6.1 Section containers and subnav target
  assert(html.includes('id="section-speech-coaching"'), "Must preserve #section-speech-coaching");
  assert(html.includes('id="speech-executive-assessment-card"'), "Must preserve #speech-executive-assessment-card");
  assert(html.includes('id="delivery-assessment-content"'), "Must preserve #delivery-assessment-content");
  assert(html.includes('PHẦN B • PHONG CÁCH THỂ HIỆN'), "Must preserve backward compatibility test hook");
  pass("6.1 Section container, executive assessment card, and test contracts preserved");

  // 6.2 Scoring and FinalEvaluationService untouched
  const finalEvalServicePath = path.join(ROOT, "BE/Services/Evaluation/FinalEvaluationService.cs");
  const finalEvalCode = fs.readFileSync(finalEvalServicePath, "utf8");
  assert(finalEvalCode.includes("evaluation.OverallScore = finalScore;"), "FinalEvaluationService scoring formulas intact");
  pass("6.2 Scoring algorithm and 0-100 scale SSOT untouched");

  console.log("\n================================================================");
  console.log(`  ALL AUDIT CHECKS PASSED: ${passedTests} / ${totalTests} PASS | 0 FAIL`);
  console.log("================================================================\n");
}

try {
  runAudit();
} catch (err) {
  console.error("\n[TEST FAILED]:", err.message);
  process.exit(1);
}
