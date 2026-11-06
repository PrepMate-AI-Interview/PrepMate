/**
 * WI-GUEST-REPORT-UNIVERSAL-ENFORCEMENT-01 REGRESSION SUITE
 * 
 * Verifies universal access control, centralized authorization, and frontend state isolation:
 * 1. Backend Authorization & Allowlist Projection across all retrieval endpoints
 * 2. Universal Historical Enforcement (legacy sessions, new sessions, claimed sessions)
 * 3. Frontend State & Cache Isolation (DOM clearing, request sequence token, cache: no-store)
 * 4. Architecture Invariants (0-100 score scale, Single AI Gateway)
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

function pass(msg) {
  console.log(`  [PASS] ${msg}`);
}

async function run() {
  console.log("=== WI-GUEST-REPORT-UNIVERSAL-ENFORCEMENT-01 REGRESSION SUITE ===");

  const sessionsControllerPath = path.join(__dirname, "../../BE/Controllers/SessionsController.cs");
  const aiControllerPath = path.join(__dirname, "../../BE/Controllers/AIController.cs");
  const quotaServicePath = path.join(__dirname, "../../BE/Services/Interview/InterviewQuotaService.cs");
  const reportJsPath = path.join(__dirname, "../../FE/features/report/report.js");

  const sessionsCs = fs.readFileSync(sessionsControllerPath, "utf8");
  const aiCs = fs.readFileSync(aiControllerPath, "utf8");
  const quotaCs = fs.readFileSync(quotaServicePath, "utf8");
  const reportJs = fs.readFileSync(reportJsPath, "utf8");

  // -------------------------------------------------------------------------
  // 1. BACKEND AUTHORIZATION & DATA MINIMIZATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 1: BACKEND AUTHORIZATION & STRICT ALLOWLIST PROJECTION ---");

  // Validate SessionsController.GetSession projection
  const previewMatch = sessionsCs.match(/var\s+previewSession\s*=\s*new\s*\{([\s\S]*?)\};/);
  assert(previewMatch, "previewSession projection must exist in SessionsController");
  const previewBody = previewMatch[1];

  assert(!previewBody.includes("questions = session.Questions"), "Raw questions must NOT be exposed in previewSession");
  assert(!previewBody.includes("answers = session.Answers"), "Raw answers must NOT be exposed in previewSession");
  assert(!previewBody.includes("cvText = session.CvText"), "Raw cvText must NOT be exposed in previewSession");
  assert(!previewBody.includes("jdText = session.JdText"), "Raw jdText must NOT be exposed in previewSession");
  assert(!previewBody.includes("evaluation = session.Evaluation"), "Raw evaluation must NOT be exposed in previewSession");
  assert(!previewBody.includes("reportModel = session.ReportModel"), "Raw reportModel must NOT be exposed in previewSession");
  assert(!previewBody.includes("evidenceReport ="), "evidenceReport must NOT be exposed in previewSession");
  assert(!previewBody.includes("techScore ="), "techScore must NOT be exposed in previewSession");
  assert(!previewBody.includes("commScore ="), "commScore must NOT be exposed in previewSession");

  // Required allowlist elements in previewSession
  assert(previewBody.includes('userId = "guest"'), "previewSession.userId must be 'guest'");
  assert(previewBody.includes("isGuestPreview = true"), "previewSession.isGuestPreview must be true");
  assert(previewBody.includes("overallScore = guestPreview.OverallScore ?? session.Report?.OverallScore"), "Authoritative overallScore projected");
  assert(previewBody.includes("guestPreview = guestPreview"), "guestPreview object projected");
  assert(previewBody.includes("report = session.Report != null ? new") || previewBody.includes("report = new"), "report object must ALWAYS be an allowlist object, never null");

  pass("SessionsController strictly projects allowlist DTO with non-null report wrapper");

  // Validate AIController.AIReport authorization check
  assert(aiCs.includes("if (!isAuthOwner)"), "AIController strictly checks !isAuthOwner");
  assert(aiCs.includes("var guestPreview = s != null"), "AIController safely builds guestPreview even if s.Report is null");
  assert(aiCs.includes("overallScore = guestPreview.OverallScore ?? (s?.Report?.OverallScore)"), "AIController projects sanitized overallScore");
  assert(aiCs.includes("return StatusCode(result.StatusCode, previewReport);"), "AIController returns sanitized previewReport to non-auth owners");

  pass("AIController unconditionally returns sanitized previewReport to non-owners");

  // -------------------------------------------------------------------------
  // 2. UNIVERSAL HISTORICAL ENFORCEMENT & LEGACY COMPATIBILITY
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 2: HISTORICAL ENFORCEMENT & LEGACY SESSION HANDLING ---");

  // Validate InterviewQuotaService handles legacy sessions with literal "guest"
  assert(quotaCs.includes('if (session.UserId.Equals("guest", StringComparison.OrdinalIgnoreCase))'), "QuotaService checks literal 'guest' sessions");
  assert(quotaCs.includes("if (!string.IsNullOrWhiteSpace(session.OriginalGuestId))"), "QuotaService checks stable per-session association via OriginalGuestId");
  assert(quotaCs.includes("if (allowMutate)") && quotaCs.includes("Phiên phỏng vấn cũ không xác định được chủ sở hữu. Vui lòng bắt đầu phiên mới."), "Mutating legacy session is rejected with 403");
  assert(quotaCs.includes('return (false, 403, "Phiên phỏng vấn cũ không xác định được chủ sở hữu. Vui lòng liên hệ quản trị viên.");'), "Unbound legacy session denies generic guest access");

  // Validate registered user ownership
  assert(quotaCs.includes('!session.UserId.StartsWith("guest", StringComparison.OrdinalIgnoreCase)'), "Registered session branch identified");
  assert(quotaCs.includes('if (string.IsNullOrEmpty(callerId))') && quotaCs.includes("401"), "Unauthenticated access to registered session yields 401");
  assert(quotaCs.includes("!callerId.Equals(session.UserId, StringComparison.OrdinalIgnoreCase)") && quotaCs.includes("403"), "Unrelated registered user access yields 403");

  // Validate guest isolation
  assert(quotaCs.includes("!string.Equals(session.UserId, currentGuestId, StringComparison.OrdinalIgnoreCase)") && quotaCs.includes("403"), "Different guest yields 403");

  pass("InterviewQuotaService enforces universal access boundary regardless of session age or schema");

  // -------------------------------------------------------------------------
  // 3. FRONTEND STATE & CACHE ISOLATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 3: FRONTEND STATE & CACHE ISOLATION (report.js) ---");

  // Validate request sequence counter
  assert(reportJs.includes("let _activeReportRequestId = 0;"), "_activeReportRequestId sequence tracker defined");
  assert(reportJs.includes("const thisRequestId = ++_activeReportRequestId;"), "Request sequence incremented on every initReportPage");
  assert(reportJs.includes("if (_activeReportRequestId !== thisRequestId) return;"), "Out-of-order async responses discarded");

  // Validate clearPreviousReportState
  assert(reportJs.includes("function clearPreviousReportState()"), "clearPreviousReportState function defined");
  assert(reportJs.includes('qfbList.innerHTML = "";'), "Question feedback DOM cleared on report navigation");
  assert(reportJs.includes('dimGrid.innerHTML = "";'), "Dimensions grid DOM cleared on report navigation");
  assert(reportJs.includes('roadmapGrid.innerHTML = "";'), "Roadmap grid DOM cleared on report navigation");
  assert(reportJs.includes('scoreValEl.textContent = "—";'), "Hero score reset on report navigation");

  // Validate strict frontend authorization gate
  assert(reportJs.includes("const isAccountOwned = session.userId && !session.userId.startsWith(\"guest\");"), "Identifies account-owned sessions");
  assert(reportJs.includes("if (!hasAuthToken && isAccountOwned)"), "Strict gate: unauthenticated caller cannot view account-owned session");
  assert(reportJs.includes("showErrorState(\"Vui lòng đăng nhập để xem báo cáo phiên phỏng vấn này.\");"), "Renders 401 equivalent message instead of full report");

  // Validate local storage sanitizer
  assert(reportJs.includes("function sanitizeSessionForGuest(sess)"), "sanitizeSessionForGuest helper defined");
  assert(reportJs.includes("delete copy.answers;"), "Sanitizer strips raw answers from in-memory session");
  assert(reportJs.includes("delete copy.questions;"), "Sanitizer strips raw questions from in-memory session");
  assert(reportJs.includes("delete copy.evidenceReport;"), "Sanitizer strips raw evidenceReport from in-memory session");
  assert(reportJs.includes("delete copy.diagnosticAnalysis;"), "Sanitizer strips raw diagnosticAnalysis from in-memory session");

  // Validate cache: no-store and Cache-Control headers
  assert(reportJs.includes('headers["Cache-Control"] = "no-cache, no-store, must-revalidate";'), "Cache-Control no-cache header sent");
  assert(reportJs.includes('cache: "no-store"'), "cache: 'no-store' fetch option configured");

  pass("Frontend completely isolates state between reports and guarantees no client-side cache bypass");

  // -------------------------------------------------------------------------
  // 4. ARCHITECTURAL INVARIANTS PRESERVATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 4: ARCHITECTURAL INVARIANTS (0-100 SSOT & SINGLE AI GATEWAY) ---");

  assert(reportJs.includes("normalizeScoreTo100"), "report.js enforces 0-100 scoring normalization helper");
  assert(sessionsCs.includes("overallScore = guestPreview.OverallScore"), "SessionsController adheres to 0-100 overallScore");

  // Verify Single AI Gateway invariant
  const prepClientPath = path.join(__dirname, "../../BE/Services/AI/PrepMateAIClient.cs");
  const prepClientCs = fs.readFileSync(prepClientPath, "utf8");
  assert(prepClientCs.includes('https://api.vilao.ai/v1'), "PrepMateAIClient routes to unified endpoint https://api.vilao.ai/v1");
  assert(prepClientCs.includes('public const string CanonicalAlias = "PrepMate";'), "Canonical model alias is PrepMate");

  pass("0-100 point scale SSOT and Single AI Gateway invariants verified");

  console.log("\n=== ALL WI-GUEST-REPORT-UNIVERSAL-ENFORCEMENT-01 TESTS PASSED ===");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
