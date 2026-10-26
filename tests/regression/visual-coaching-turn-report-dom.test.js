/**
 * PREPMATE — TEST C: TURN-BY-TURN VISUAL EVIDENCE REPORT DOM TESTS
 * Tests Step C requirements:
 *  - Report displays real thumbnails for turns with snapshots
 *  - Proper captions & recommendations mapped to turn/session
 *  - No cross-session snapshot leakage
 *  - Clear empty state when camera was not used
 *  - No video recording replay buttons
 *  - Proper responsive classes
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

function pass(name) {
  console.log(`  [PASS] ${name}`);
}

async function runStepCTests() {
  console.log("===============================================================");
  console.log("   STEP C: TURN-BY-TURN VISUAL EVIDENCE REPORT DOM TESTS       ");
  console.log("===============================================================\n");

  // Verify HTML structure of report.html
  const reportHtml = fs.readFileSync(path.join(__dirname, "../../FE/features/report/report.html"), "utf8");
  assert.ok(reportHtml.includes('id="visual-snapshots-container"'), "visual-snapshots-container must exist in report.html");
  assert.ok(reportHtml.includes('id="visual-snapshots-gallery"'), "visual-snapshots-gallery must exist in report.html");
  assert.ok(reportHtml.includes('id="visual-snapshots-count-badge"'), "visual-snapshots-count-badge must exist in report.html");
  assert.ok(reportHtml.includes("interview-visual-snapshots.js"), "interview-visual-snapshots.js must be included in report.html");
  assert.ok(!reportHtml.includes("btn-replay-video"), "Must NOT contain full video replay buttons (video recording out of scope)");
  pass("1. HTML structure contains visual snapshots container without video replay controls");

  // Verify CSS responsive classes in report.css
  const reportCss = fs.readFileSync(path.join(__dirname, "../../FE/features/report/report.css"), "utf8");
  assert.ok(reportCss.includes(".pm-visual-turn-card"), ".pm-visual-turn-card must be defined in CSS");
  assert.ok(reportCss.includes(".pm-visual-thumb-wrapper"), ".pm-visual-thumb-wrapper must be defined in CSS");
  assert.ok(reportCss.includes(".pm-visual-thumbnail"), ".pm-visual-thumbnail must be defined in CSS");
  assert.ok(reportCss.includes("@media (max-width: 640px)"), "Mobile responsive media query must be defined");
  pass("2. CSS classes for desktop side-by-side and mobile stacked layout verified");

  // Mock DOM environment to test renderVisualSnapshotsGallery function
  const snapshotStore = require("../../FE/features/interview/interview-visual-snapshots.js");
  await snapshotStore.clearAllSnapshots();

  const sessionA = "report_test_sess_001";
  const sessionB = "report_test_sess_002";

  // Seed snapshot for sessionA turn 0 (Introduction) and turn 1
  await snapshotStore.saveSnapshot({
    sessionId: sessionA,
    turnIndex: 0,
    capturedAt: 1700000000000,
    mimeType: "image/webp",
    width: 320,
    height: 240,
    imageBlob: "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoFAAUAPxF8slSvKSWjBAgAsBIJaQAA32sAAP7/lQAAAAAAAAAAAAAAAAAAAAAA",
    metrics: { lightingLevel: "OPTIMAL", framingType: "CENTERED" },
  });

  await snapshotStore.saveSnapshot({
    sessionId: sessionA,
    turnIndex: 1,
    capturedAt: 1700000030000,
    mimeType: "image/webp",
    width: 320,
    height: 240,
    imageBlob: "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoFAAUAPxF8slSvKSWjBAgAsBIJaQAA32sAAP7/lQAAAAAAAAAAAAAAAAAAAAAA",
    metrics: { lightingLevel: "UNDEREXPOSED", framingType: "LEAN_LEFT" },
  });

  // Seed snapshot for sessionB (must not leak into sessionA)
  await snapshotStore.saveSnapshot({
    sessionId: sessionB,
    turnIndex: 0,
    capturedAt: 1700000050000,
    mimeType: "image/webp",
    width: 320,
    height: 240,
    imageBlob: "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoFAAUAPxF8slSvKSWjBAgAsBIJaQAA32sAAP7/lQAAAAAAAAAAAAAAAAAAAAAA",
    metrics: { lightingLevel: "OVEREXPOSED", framingType: "LEAN_RIGHT" },
  });

  // Load report.js functions
  const reportJsContent = fs.readFileSync(path.join(__dirname, "../../FE/features/report/report.js"), "utf8");

  // Create minimal DOM mocks
  const mockGallery = { innerHTML: "" };
  const mockCountBadge = { textContent: "", style: {} };
  const mockDoc = {
    getElementById: (id) => {
      if (id === "visual-snapshots-gallery") return mockGallery;
      if (id === "visual-snapshots-count-badge") return mockCountBadge;
      return null;
    },
  };

  // Evaluate renderVisualSnapshotsGallery in mock context
  const evalContext = {
    document: mockDoc,
    window: { _prepmateVisualBlobUrls: [] },
    PrepMateVisualSnapshotStore: snapshotStore,
    escapeHtml: (s) => String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    console: console,
    Blob: globalThis.Blob,
    URL: { createObjectURL: () => "blob:mock-url", revokeObjectURL: () => {} },
  };

  // Extract renderVisualSnapshotsGallery function
  const funcMatch = reportJsContent.match(/async function renderVisualSnapshotsGallery[\s\S]*?\n\}/);
  assert.ok(funcMatch, "renderVisualSnapshotsGallery function must be found in report.js");

  const runRender = new Function(
    "report",
    "session",
    "visualReport",
    "document",
    "window",
    "PrepMateVisualSnapshotStore",
    "escapeHtml",
    "URL",
    `
      const renderVisualSnapshotsGallery = ${funcMatch[0]};
      return renderVisualSnapshotsGallery(report, session, visualReport);
    `
  );

  // Test 3: Render sessionA (camera ON)
  const mockReportA = { sessionId: sessionA };
  const mockSessionA = {
    id: sessionA,
    userResponses: [
      { question: "Bạn có kinh nghiệm gì với ASP.NET Core và microservices?" }
    ],
  };
  const mockVisualReportOn = { cameraUsed: true, evaluated: true };

  await runRender(
    mockReportA,
    mockSessionA,
    mockVisualReportOn,
    mockDoc,
    evalContext.window,
    snapshotStore,
    evalContext.escapeHtml,
    evalContext.URL
  );

  assert.ok(mockGallery.innerHTML.includes("pm-visual-turn-card"), "Gallery must contain turn cards");
  assert.ok(mockGallery.innerHTML.includes("LƯỢT GIỚI THIỆU"), "Must display Intro turn badge");
  assert.ok(mockGallery.innerHTML.includes("LƯỢT #1"), "Must display Turn 1 badge");
  assert.ok(mockGallery.innerHTML.includes("ASP.NET Core"), "Must display Turn 1 question title");
  assert.ok(mockGallery.innerHTML.includes("Độ Sáng Cân Bằng"), "Must display Turn 0 lighting metric");
  assert.ok(mockGallery.innerHTML.includes("Khá Tối"), "Must display Turn 1 lighting metric");
  assert.ok(mockGallery.innerHTML.includes("không sử dụng mô hình nhận diện khuôn mặt"), "Must include honest technical disclaimer");
  assert.ok(mockCountBadge.textContent.includes("2 lượt có ảnh"), "Badge must reflect 2 snapshots");
  pass("3. Report renders turn-by-turn thumbnails and honest metrics for camera session");

  // Test 4: Camera OFF empty state
  const mockVisualReportOff = { cameraUsed: false, evaluated: false };
  await runRender(
    mockReportA,
    mockSessionA,
    mockVisualReportOff,
    mockDoc,
    evalContext.window,
    snapshotStore,
    evalContext.escapeHtml,
    evalContext.URL
  );

  assert.strictEqual(mockCountBadge.textContent, "Camera tắt");
  assert.ok(mockGallery.innerHTML.includes("Lượt này không có ảnh minh chứng vì camera chưa bật"));
  assert.ok(!mockGallery.innerHTML.includes("pm-visual-thumbnail"), "No images may be shown when camera was OFF");
  pass("4. Camera OFF renders clear empty state without fake placeholders");

  // Test 5: Session B isolation verification
  const mockReportB = { sessionId: sessionB };
  const mockSessionB = { id: sessionB, userResponses: [] };
  await runRender(
    mockReportB,
    mockSessionB,
    mockVisualReportOn,
    mockDoc,
    evalContext.window,
    snapshotStore,
    evalContext.escapeHtml,
    evalContext.URL
  );

  assert.ok(mockCountBadge.textContent.includes("1 lượt có ảnh"), "Session B must only have 1 snapshot");
  assert.ok(!mockGallery.innerHTML.includes("ASP.NET Core"), "Session B must not display Session A's question");
  pass("5. Session B completely isolated from Session A snapshots and questions");

  console.log("\nALL STEP C TESTS PASSED SUCCESSFULLY.\n");
}

if (require.main === module) {
  runStepCTests().catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
  });
}
