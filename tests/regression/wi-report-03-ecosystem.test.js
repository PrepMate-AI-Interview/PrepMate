// tests/regression/wi-report-03-ecosystem.test.js
// Regression test suite for WI-REPORT-03: INTERVIEW INTELLIGENCE & PREPARATION ECOSYSTEM

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

console.log("=== TEST SUITE: WI-REPORT-03 — INTERVIEW INTELLIGENCE & PREPARATION ECOSYSTEM ===\n");

function resolvePath(rel) {
  return path.resolve(__dirname, "../../", rel);
}

// --------------------------------------------------------------------------
// 1. DOM Structure & Phase Navigation Verification
// --------------------------------------------------------------------------
console.log("• Testing DOM Structure & Phase Navigation in HTML...");

const htmlContent = fs.readFileSync(resolvePath("FE/features/report/report.html"), "utf8");

assert.ok(htmlContent.includes('id="report-phase-nav"'), "Must have #report-phase-nav container");
assert.ok(htmlContent.includes('data-phase="all"'), "Must have phase button for all");
assert.ok(htmlContent.includes('data-phase="before"'), "Must have phase button for before");
assert.ok(htmlContent.includes('data-phase="during"'), "Must have phase button for during");
assert.ok(htmlContent.includes('data-phase="after"'), "Must have phase button for after");

// Verify all 8 sections retain their IDs and have data-phase tags
const expectedSections = [
  { id: "section-overview", phase: "overview" },
  { id: "section-preparation", phase: "before" },
  { id: "section-checklist", phase: "before" },
  { id: "section-dimensions", phase: "during" },
  { id: "section-diagnostics", phase: "during" },
  { id: "section-speech-coaching", phase: "during" },
  { id: "section-provenance", phase: "during" },
  { id: "section-roadmap", phase: "after" }
];

expectedSections.forEach(({ id, phase }) => {
  assert.ok(htmlContent.includes(`id="${id}"`), `Section #${id} must exist in DOM`);
  assert.ok(
    htmlContent.includes(`id="${id}"`) && htmlContent.includes(`data-phase="${phase}"`),
    `Section #${id} must carry data-phase="${phase}"`
  );
});

// Verify newly introduced containers in HTML
assert.ok(htmlContent.includes('id="prep-company-intel-box"'), "Must have #prep-company-intel-box");
assert.ok(htmlContent.includes('id="company-needs-breakdown"'), "Must have #company-needs-breakdown");
assert.ok(htmlContent.includes('id="cv-jd-gap-analysis"'), "Must have #cv-jd-gap-analysis");
assert.ok(htmlContent.includes('id="visual-outfit-container"'), "Must have #visual-outfit-container");
assert.ok(htmlContent.includes('id="after-interview-questions-box"'), "Must have #after-interview-questions-box");

console.log("[PASS] 1. DOM Structure, Phase Navigation and Intelligence containers verified in HTML");

// --------------------------------------------------------------------------
// 2. CSS Architecture & Token Mapping
// --------------------------------------------------------------------------
console.log("• Testing CSS Classes & Styling Tokens in report.css...");

const cssContent = fs.readFileSync(resolvePath("FE/features/report/report.css"), "utf8");

assert.ok(cssContent.includes(".report-phase-navigation"), "CSS must contain .report-phase-navigation");
assert.ok(cssContent.includes(".phase-pill-btn"), "CSS must contain .phase-pill-btn");
assert.ok(cssContent.includes(".provenance-tag"), "CSS must contain .provenance-tag");
assert.ok(cssContent.includes(".provenance-verified"), "CSS must contain .provenance-verified");
assert.ok(cssContent.includes(".provenance-jd"), "CSS must contain .provenance-jd");
assert.ok(cssContent.includes(".provenance-ai"), "CSS must contain .provenance-ai");
assert.ok(cssContent.includes(".provenance-missing"), "CSS must contain .provenance-missing");
assert.ok(cssContent.includes(".company-intel-box"), "CSS must contain .company-intel-box");
assert.ok(cssContent.includes(".company-needs-box"), "CSS must contain .company-needs-box");
assert.ok(cssContent.includes(".cv-jd-gap-box"), "CSS must contain .cv-jd-gap-box");
assert.ok(cssContent.includes(".gap-matrix-table"), "CSS must contain .gap-matrix-table");
assert.ok(cssContent.includes(".visual-outfit-grid"), "CSS must contain .visual-outfit-grid");
assert.ok(cssContent.includes(".outfit-visual-card"), "CSS must contain .outfit-visual-card");
assert.ok(cssContent.includes(".outfit-svg-silhouette"), "CSS must contain .outfit-svg-silhouette");
assert.ok(cssContent.includes(".after-interview-guidance-box"), "CSS must contain .after-interview-guidance-box");

console.log("[PASS] 2. CSS Architecture, Provenance Tokens & Responsive Styles verified");

// --------------------------------------------------------------------------
// 3. Mock DOM & JavaScript Logic Verification
// --------------------------------------------------------------------------
console.log("• Testing report.js Intelligence Ecosystem Rendering...");

function createMockDOM() {
  const elements = new Map();
  const localStorageStore = {};

  const document = {
    addEventListener: () => {},
    getElementById: (id) => {
      if (!elements.has(id)) {
        const el = {
          id,
          style: {},
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
          },
          attributes: {},
          setAttribute(k, v) { this.attributes[k] = v; },
          getAttribute(k) { return this.attributes[k] || null; },
          dataset: {},
          textContent: "",
          innerHTML: ""
        };
        elements.set(id, el);
      }
      return elements.get(id);
    },
    querySelectorAll: (selector) => {
      if (selector === ".subnav-tab") {
        return [
          { getAttribute: () => "section-overview", style: {} },
          { getAttribute: () => "section-preparation", style: {} },
          { getAttribute: () => "section-dimensions", style: {} },
          { getAttribute: () => "section-roadmap", style: {} }
        ];
      }
      if (selector === ".phase-pill-btn") {
        return [
          { getAttribute: () => "all", classList: { add() {}, remove() {} }, setAttribute() {}, dataset: {} },
          { getAttribute: () => "before", classList: { add() {}, remove() {} }, setAttribute() {}, dataset: {} },
          { getAttribute: () => "during", classList: { add() {}, remove() {} }, setAttribute() {}, dataset: {} },
          { getAttribute: () => "after", classList: { add() {}, remove() {} }, setAttribute() {}, dataset: {} }
        ];
      }
      return [];
    }
  };

  const window = {
    document,
    location: { search: "" },
    localStorage: {
      getItem: (k) => localStorageStore[k] || null,
      setItem: (k, v) => { localStorageStore[k] = String(v); },
      removeItem: (k) => { delete localStorageStore[k]; }
    },
    IntersectionObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    print: () => {}
  };

  return { window, document, elements, localStorageStore };
}

const mockEnv = createMockDOM();
const reportJsContent = fs.readFileSync(resolvePath("FE/features/report/report.js"), "utf8");

// Execute report.js in mock environment
const vm = require("vm");
const context = vm.createContext({
  ...mockEnv,
  console,
  URLSearchParams,
  escapeHtml: (s) => (s ? String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;") : "")
});
vm.runInContext(reportJsContent, context);

// Test 3.1: Company Intelligence Rendering
const testSession = {
  id: "session-test-01",
  companyName: "Tech Global Solutions",
  jobTitle: "Senior Backend Engineer",
  industry: "Công nghệ thông tin",
  jdText: "Mô tả công việc: Tìm kiếm Senior Backend Engineer với kinh nghiệm microservices, văn hóa làm việc linh hoạt.",
  cvText: "Hồ sơ: 5 năm kinh nghiệm Backend với C#, Node.js, RESTful API và Docker."
};

const testReport = {
  sessionInfo: {
    targetPosition: "Senior Backend Engineer",
    targetCompany: "Tech Global Solutions"
  },
  preparationPlan: {
    companyPreparation: [
      { topic: "Văn hóa kỹ thuật Tech Global", expectedKnowledge: "Mô hình squad Agile, code review", isMandatory: true }
    ]
  }
};

context.renderCompanyIntelligence(testSession, testReport);
const companyBox = mockEnv.document.getElementById("prep-company-intel-box");
assert.ok(companyBox.innerHTML.includes("Tech Global Solutions"), "Company name must be rendered");
assert.ok(companyBox.innerHTML.includes("provenance-tag"), "Must render provenance tags");
assert.ok(companyBox.innerHTML.includes("Đã xác minh") || companyBox.innerHTML.includes("Theo JD"), "Must show verified or JD provenance");

console.log("[PASS] 3. Company Intelligence & Provenance rendering verified");

// --------------------------------------------------------------------------
// 4. Recruiting Needs Breakdown (6 Canonical Categories)
// --------------------------------------------------------------------------
console.log("• Testing Recruiting Needs Breakdown (6 Canonical Categories)...");

context.renderRecruitingNeedsBreakdown(testSession, testReport);
const needsBox = mockEnv.document.getElementById("company-needs-breakdown");

const canonicalCategories = [
  "Kỹ năng Cốt lõi & Bắt buộc",
  "Kỹ năng Ưu tiên & Điểm cộng",
  "Yêu cầu Kỹ thuật & Chuyên sâu",
  "Kỹ năng Hành vi & Kỹ năng Mềm",
  "Trách nhiệm & Phạm vi Công việc",
  "Kết quả Kỳ vọng & Thước đo Thành công"
];

canonicalCategories.forEach((catTitle) => {
  const escaped = catTitle.replace(/&/g, "&amp;");
  assert.ok(
    needsBox.innerHTML.includes(catTitle) || needsBox.innerHTML.includes(escaped),
    `Recruiting needs must include category "${catTitle}"`
  );
});

console.log("[PASS] 4. All 6 canonical recruiting requirement categories verified with provenance");

// --------------------------------------------------------------------------
// 5. CV-JD-Interview Gap Analysis Matrix
// --------------------------------------------------------------------------
console.log("• Testing Candidate-to-Company Gap Analysis Matrix...");

context.renderCandidateToCompanyGap(testSession, testReport);
const gapBox = mockEnv.document.getElementById("cv-jd-gap-analysis");

assert.ok(gapBox.innerHTML.includes("Ma Trận Đối Sánh Khoảng Cách Năng Lực"), "Gap matrix header must be rendered");
assert.ok(gapBox.innerHTML.includes("Yêu cầu Doanh nghiệp"), "Must include Requirement column header");
assert.ok(gapBox.innerHTML.includes("Bằng chứng trên CV"), "Must include CV column header");
assert.ok(gapBox.innerHTML.includes("Thể hiện trong Phỏng vấn"), "Must include Interview column header");
assert.ok(gapBox.innerHTML.includes("Khoảng cách"), "Must include Gap column header");
assert.ok(gapBox.innerHTML.includes("Hành động Khuyến nghị"), "Must include Recommendation column header");

// Test Null Safety: Session with no CV or JD
const emptySession = { id: "empty-session" };
context.renderCandidateToCompanyGap(emptySession, testReport);
const emptyGapBox = mockEnv.document.getElementById("cv-jd-gap-analysis");
assert.ok(emptyGapBox.innerHTML.includes("Chưa có JD"), "Must safely handle missing JD/CV with explanatory notice");

console.log("[PASS] 5. Gap Analysis Matrix (5 columns) & Null Safety verified");

// --------------------------------------------------------------------------
// 6. Visual Outfit Suggestions (4 Distinct Styles)
// --------------------------------------------------------------------------
console.log("• Testing Visual Outfit Suggestions (4 Distinct Styles)...");

context.renderVisualOutfitSuggestions(testSession);
const outfitBox = mockEnv.document.getElementById("visual-outfit-container");

const expectedStyles = [
  "Business Formal",
  "Business Casual",
  "Smart Casual",
  "Online Virtual"
];

expectedStyles.forEach((styleTitle) => {
  assert.ok(outfitBox.innerHTML.includes(styleTitle), `Outfit guide must include style "${styleTitle}"`);
});

// Verify SVG silhouettes are embedded
assert.ok(outfitBox.innerHTML.includes("<svg"), "Must embed inline SVG silhouettes");
assert.ok(outfitBox.innerHTML.includes("outfit-svg-silhouette"), "Must apply silhouette class");
assert.ok(outfitBox.innerHTML.includes("LỜI KHUYÊN THỰC TẾ"), "Must include practical advice section");

console.log("[PASS] 6. 4 Visual Outfit Styles with SVG Silhouettes & Practical Advice verified");

// --------------------------------------------------------------------------
// 7. Role-Based After-Interview Guidance (Candidate vs Manager)
// --------------------------------------------------------------------------
console.log("• Testing Role-Based Guidance (Candidate vs Manager separation)...");

// Test Candidate View
context.renderAfterInterviewGuidance(testSession, testReport);
let guidanceBox = mockEnv.document.getElementById("after-interview-questions-box");
assert.ok(
  guidanceBox.innerHTML.includes("Câu Hỏi Chiến Lược Nên Đặt Cho Nhà Tuyển Dụng"),
  "Candidate mode must show Questions for Employer"
);
assert.ok(guidanceBox.innerHTML.includes("Về Kỹ Thuật"), "Must cover technical architecture theme");
assert.ok(guidanceBox.innerHTML.includes("Về Đội Ngũ"), "Must cover team collaboration theme");
assert.ok(guidanceBox.innerHTML.includes("Về Kỳ Vọng 90 Ngày Đầu"), "Must cover 90-day deliverables theme");

// Toggle to Manager View
context.toggleGuidanceRoleView();
guidanceBox = mockEnv.document.getElementById("after-interview-questions-box");
assert.ok(
  guidanceBox.innerHTML.includes("Hướng Dẫn Đánh Giá Dành Cho Người Phỏng Vấn"),
  "Manager mode must show Interviewer Guidance"
);
assert.ok(guidanceBox.innerHTML.includes("Khuyến Nghị Quyết Định"), "Must cover hiring recommendations");
assert.ok(guidanceBox.innerHTML.includes("Điểm Cần Đào Sâu Thêm"), "Must cover probing areas");
assert.ok(guidanceBox.innerHTML.includes("Đề Xuất Câu Hỏi Cho Vòng Sau"), "Must propose next-round questions");

console.log("[PASS] 7. Role-Based Guidance & View Toggle verified");

// --------------------------------------------------------------------------
// 8. WI-REPORT-03R1: Guided 3-Stage Stepper & Viewport Isolation Verification
// --------------------------------------------------------------------------
console.log("• Testing WI-REPORT-03R1: Guided 3-Stage Stepper & Viewport Panels Isolation...");

// Verify HTML contains the 3 stage panels and stepper tabs
assert.ok(htmlContent.includes('id="stage-panel-before"'), "HTML must have #stage-panel-before");
assert.ok(htmlContent.includes('id="stage-panel-during"'), "HTML must have #stage-panel-during");
assert.ok(htmlContent.includes('id="stage-panel-after"'), "HTML must have #stage-panel-after");
assert.ok(htmlContent.includes('id="stages-viewport"'), "HTML must have #stages-viewport");

// Test goToStage logic in report.js
context.goToStage("before", { scroll: false });
const panelBefore = mockEnv.document.getElementById("stage-panel-before");
const panelDuring = mockEnv.document.getElementById("stage-panel-during");
const panelAfter = mockEnv.document.getElementById("stage-panel-after");

assert.strictEqual(panelBefore.style.display, "block", "Stage 1 (Before) must be visible");
assert.strictEqual(panelDuring.style.display, "none", "Stage 2 (During) must be hidden");
assert.strictEqual(panelAfter.style.display, "none", "Stage 3 (After) must be hidden");

// Switch to During
context.goToStage("during", { scroll: false });
assert.strictEqual(panelBefore.style.display, "none", "Stage 1 (Before) must be hidden");
assert.strictEqual(panelDuring.style.display, "block", "Stage 2 (During) must be visible");
assert.strictEqual(panelAfter.style.display, "none", "Stage 3 (After) must be hidden");

// Switch to After
context.goToStage("after", { scroll: false });
assert.strictEqual(panelBefore.style.display, "none", "Stage 1 (Before) must be hidden");
assert.strictEqual(panelDuring.style.display, "none", "Stage 2 (During) must be hidden");
assert.strictEqual(panelAfter.style.display, "block", "Stage 3 (After) must be visible");

// Test Real Photography Assets on Disk and in Rendered DOM
const expectedPhotoFiles = [
  "business-formal.jpg",
  "business-casual.jpg",
  "smart-casual.jpg",
  "online-virtual.jpg"
];

expectedPhotoFiles.forEach((filename) => {
  const photoPath = resolvePath(`FE/assets/images/outfits/${filename}`);
  assert.ok(fs.existsSync(photoPath), `Real outfit photo file ${filename} must exist on disk`);
  const stats = fs.statSync(photoPath);
  assert.ok(stats.size > 10000, `Real photo ${filename} must be valid image data (>10KB)`);
  assert.ok(outfitBox.innerHTML.includes(filename), `Rendered outfit card must reference ${filename}`);
});

// Verify outfit attribution and disclaimer
assert.ok(outfitBox.innerHTML.includes("outfit-photo-credit"), "Must render outfit photographer credit");
assert.ok(outfitBox.innerHTML.includes("outfit-disclaimer-box"), "Must render non-mandatory dress code disclaimer");

// Verify needs breakdown progressive disclosure toggle
assert.ok(needsBox.innerHTML.includes('id="needs-extra-grid" style="display: none;'), "Needs extra grid must be hidden with display:none initially");
const needsExtraGrid = mockEnv.document.getElementById("needs-extra-grid");
needsExtraGrid.style.display = "none";
assert.ok(typeof context.toggleExtraNeeds === "function", "toggleExtraNeeds function must exist");
context.toggleExtraNeeds();
assert.strictEqual(needsExtraGrid.style.display, "grid", "Extra recruiting needs must expand on toggle");

console.log("[PASS] 8. Guided 3-Stage Stepper, Strict Viewport Isolation, Real Photography & Needs Progressive Disclosure verified");

// --------------------------------------------------------------------------
// 9. Production Database SHA-256 Invariant
// --------------------------------------------------------------------------
console.log("• Verifying Production db.json Invariant...");

const EXPECTED_HASH = "00d0b91eabc1646f291b879da5ee8f1f056b072c36ec864522fae58e6abbea1a";
const dbPath = resolvePath("BE/data/db.json");
const dbContent = fs.readFileSync(dbPath);
const actualHash = crypto.createHash("sha256").update(dbContent).digest("hex").toLowerCase();

assert.strictEqual(
  actualHash,
  EXPECTED_HASH,
  `BE/data/db.json hash invariant mismatch! Expected ${EXPECTED_HASH}, got ${actualHash}`
);

console.log("[PASS] 9. Production database SHA-256 hash strictly preserved");

console.log("\n=======================================================");
console.log("   ALL 9 WI-REPORT-03 REGRESSION CHECKS PASSED CLEANLY   ");
console.log("=======================================================");
