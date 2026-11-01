// ==========================================================================
// PREPMATE — PHASE 3 STEP 7 REPORT UI AUTOMATED ACCEPTANCE SUITE
// Tests all 20 presentation, parsing, null safety, and responsive criteria.
// ==========================================================================

const fs = require("fs");
const path = require("path");
const { resolvePath } = require("../helpers/test-env");
const vm = require("vm");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// --------------------------------------------------------------------------
// Create Lightweight DOM Environment for Testing
// --------------------------------------------------------------------------
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
          textContent: "",
          innerText: "",
          innerHTML: "",
          checked: false,
          value: ""
        };
        elements.set(id, el);
      }
      return elements.get(id);
    },
    querySelectorAll: (selector) => {
      // Return simple array of mock elements based on selector
      if (selector === ".chk-input") {
        return Array.from(elements.values()).filter(e => e.id && e.id.startsWith("chk-"));
      }
      if (selector === ".chk-input:checked") {
        return Array.from(elements.values()).filter(e => e.id && e.id.startsWith("chk-") && e.checked);
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

// Load report.js in sandbox
function loadReportModule(context) {
  const code = fs.readFileSync(resolvePath("FE/features/report/report.js"), "utf8");
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

async function runTests() {
  console.log("==================================================");
  console.log("   PHASE 3 STEP 7: REPORT UI / UX VERIFICATION    ");
  console.log("==================================================\n");

  // TEST 1: Files Existence
  console.log("--- TEST 1: Files Existence ---");
  const htmlPath = resolvePath("FE/features/report/report.html");
  const cssPath = resolvePath("FE/features/report/report.css");
  const jsPath = resolvePath("FE/features/report/report.js");

  assert(fs.existsSync(htmlPath), "Test 1.1: report.html exists");
  assert(fs.existsSync(cssPath), "Test 1.2: report.css exists");
  assert(fs.existsSync(jsPath), "Test 1.3: report.js exists");

  const htmlContent = fs.readFileSync(htmlPath, "utf8");
  assert(htmlContent.includes("section-overview"), "Test 1.4: report.html contains section-overview");
  assert(htmlContent.includes("section-dimensions"), "Test 1.5: report.html contains section-dimensions");
  assert(htmlContent.includes("section-diagnostics"), "Test 1.6: report.html contains section-diagnostics");
  assert(htmlContent.includes("section-roadmap"), "Test 1.7: report.html contains section-roadmap");
  assert(htmlContent.includes("section-preparation"), "Test 1.8: report.html contains section-preparation");
  assert(htmlContent.includes("section-checklist"), "Test 1.9: report.html contains section-checklist");

  // TEST 2: Modern Full Report Rendering
  console.log("\n--- TEST 2: Modern Full Report Rendering ---");
  const { window, document, elements } = createMockDOM();
  const ctx = loadReportModule({
    window,
    document,
    console,
    URLSearchParams,
    localStorage: window.localStorage,
    escapeHtml: (s) => s
  });

  const sampleFullReport = {
    sessionInfo: {
      targetPosition: "Lead Backend Engineer",
      targetLevel: "Senior",
      targetCompany: "VNG Corporation",
      interviewDurationMinutes: 25,
      questionCount: 6
    },
    completionInfo: {
      status: "COMPLETED_NORMAL",
      interpretation: "Hoàn thành toàn diện tất cả các lượt hỏi"
    },
    overallEvaluation: {
      score: 85,
      normalizedScore: 85,
      scoreScale: "0-100",
      confidence: "HIGH",
      demonstratedLevel: "SENIOR",
      summary: "Ứng viên có kiến thức chuyên sâu về distributed systems và database indexing."
    },
    performanceAssessment: {
      demonstratedLevel: "SENIOR",
      readiness: "READY",
      readinessRationale: "Đáp ứng xuất sắc mọi tiêu chí kỹ thuật và giao tiếp cho vai trò Lead Backend.",
      confidence: "HIGH",
      dimensions: [
        {
          dimension: "TECHNICAL_KNOWLEDGE",
          demonstratedLevel: "SENIOR",
          confidence: "HIGH",
          rationale: "Nắm vững cơ chế B-Tree, ACID và Replication.",
          observedStrengths: ["Database indexing", "Caching strategies"],
          observedWeaknesses: []
        },
        {
          dimension: "PRACTICAL_APPLICATION",
          demonstratedLevel: "SENIOR",
          confidence: "HIGH",
          rationale: "Trích dẫn số liệu triển khai thực tế trên production.",
          observedStrengths: ["High-traffic handling"],
          observedWeaknesses: []
        }
      ]
    },
    diagnosticAnalysis: {
      strengthDiagnoses: [
        { conceptId: "PostgreSQL Indexing", evidence: "Giải thích cặn kẽ B-Tree vs Hash index", turnReferences: ["Turn 1", "Turn 3"] }
      ],
      weaknessDiagnoses: [
        { conceptId: "Kafka Consumer Groups", rootCause: "Chưa trực tiếp xử lý rebalance storm", impact: "Ảnh hưởng throughput khi scale consumer", priority: "MEDIUM", turnReferences: ["Turn 4"] }
      ],
      knowledgeGapDiagnoses: [
        { conceptName: "gRPC Streaming", gapType: "UNASSESSED", isMandatory: false, description: "Chưa được kiểm tra trong phiên." }
      ],
      riskDiagnoses: [
        { severity: "LOW", description: "Cần lưu ý kiểm tra rebalance strategy trong Kafka." }
      ]
    },
    improvementRoadmap: {
      strengthLeverageNotes: ["Tận dụng kinh nghiệm RDBMS để hướng dẫn tối ưu NoSQL"],
      items: [
        {
          timeframe: "SHORT_TERM",
          priority: "HIGH",
          targetObjective: "Rà soát kịch bản Kafka Consumer Rebalance",
          concreteStepActions: ["Đọc tài liệu về Cooperative Sticky assignor", "Làm bài tập mô phỏng rebalance"],
          verificationCriteria: "Giải thích được cách giảm thiểu downtime khi thêm consumer"
        }
      ]
    },
    preparationPlan: {
      technicalPreparation: [{ topic: "Kafka Internals", objective: "Nắm vững partition rebalance" }],
      practicalPreparation: [{ topic: "Database Partitioning", objective: "Thiết kế bảng sharding" }],
      behavioralPreparation: [{ competencyName: "Technical Leadership", starStoryRecommendation: "Kể về lần tối ưu latency giảm 40%" }],
      companyPreparation: [{ topic: "VNG Cloud Culture", expectedKnowledge: "Hiểu văn hóa high performance", isMandatory: false, reliabilityBadge: "INFERRED" }],
      mockInterviewRecommendations: [{ focusArea: "Kafka Rebalance Drills", rationale: "Khắc phục điểm nghẽn duy nhất" }],
      preparationChecklist: {
        items: [
          { category: "Technical", task: "Review Kafka assignor strategies", timing: "Trước phỏng vấn 1 ngày" },
          { category: "Company", task: "Tìm hiểu văn hóa kỹ thuật VNG", timing: "Trước phỏng vấn 2 ngày" }
        ]
      }
    },
    evidenceSummary: {
      totalEvidenceItems: 10,
      practicalExperienceEvidenceCount: 5,
      verifiedFactsCount: 14,
      turnProvenance: [
        {
          turnIndex: 1,
          question: "Giải thích cơ chế B-Tree Index trong PostgreSQL?",
          answerSnippet: "B-Tree chia thành Root, Internal và Leaf pages...",
          targetConcept: "PostgreSQL Indexing",
          showsPracticalExperience: true,
          verifiedFacts: ["Root to leaf navigation", "O(log N) lookup"]
        }
      ]
    }
  };

  ctx.renderFullReport(sampleFullReport, { jobTitle: "Lead Backend Engineer" });

  // TEST 3: Deterministic Score Display (No Recalculation)
  console.log("\n--- TEST 3: Deterministic Score Display ---");
  const scoreNumEl = elements.get("hero-score-value");
  const normScoreEl = elements.get("hero-normalized-score");
  assert(scoreNumEl.textContent === "85", "Test 3.1: Score matches exact backend 100-point score 85");
  assert(elements.get("hero-score-scale").textContent === "/ 100", "Test 3.1b: Score scale displays / 100");
  assert(normScoreEl.textContent.includes("85 / 100"), "Test 3.2: Normalized score displays 85 / 100");

  // TEST 4: Demonstrated Level & Target Level
  console.log("\n--- TEST 4: Level Calibration ---");
  const demoLvlEl = elements.get("hero-demonstrated-level");
  const targetLvlEl = elements.get("hero-calibrated-target");
  assert(demoLvlEl.textContent === "SENIOR", "Test 4.1: Demonstrated level is SENIOR");
  assert(targetLvlEl.textContent === "SENIOR", "Test 4.2: Target level is calibrated to SENIOR");

  // TEST 5: Readiness Pill & Confidence
  console.log("\n--- TEST 5: Readiness Pill & Confidence ---");
  const readinessPill = elements.get("hero-readiness-pill");
  const confidencePill = elements.get("hero-confidence-pill");
  assert(readinessPill.className.includes("ready"), "Test 5.1: Readiness pill has ready class");
  assert(readinessPill.textContent.includes("SẴN SÀNG"), "Test 5.2: Readiness pill label is accurate");
  assert(confidencePill.textContent.includes("CAO"), "Test 5.3: Confidence pill displays CAO");

  // TEST 6: 6 Performance Dimensions Rendered
  console.log("\n--- TEST 6: 6 Performance Dimensions ---");
  const dimGrid = elements.get("dimensions-grid");
  assert(dimGrid.innerHTML.includes("TECHNICAL_KNOWLEDGE"), "Test 6.1: Technical Knowledge dimension rendered");
  assert(dimGrid.innerHTML.includes("PRACTICAL_APPLICATION"), "Test 6.2: Practical Application dimension rendered");
  assert(dimGrid.innerHTML.includes("REASONING_DEPTH"), "Test 6.3: Reasoning Depth dimension rendered");
  assert(dimGrid.innerHTML.includes("FOLLOW_UP_HANDLING"), "Test 6.4: Follow-up Handling dimension rendered");
  assert(dimGrid.innerHTML.includes("COMMUNICATION"), "Test 6.5: Communication dimension rendered");
  assert(dimGrid.innerHTML.includes("CONSISTENCY"), "Test 6.6: Consistency dimension rendered");

  // TEST 7: Strengths Diagnosis with Turn Provenance
  console.log("\n--- TEST 7: Strengths Diagnosis ---");
  const strContainer = elements.get("diag-strengths-list");
  assert(strContainer.innerHTML.includes("PostgreSQL Indexing"), "Test 7.1: Strength title rendered");
  assert(strContainer.innerHTML.includes("Turn 1"), "Test 7.2: Turn 1 reference rendered");
  assert(strContainer.innerHTML.includes("Turn 3"), "Test 7.3: Turn 3 reference rendered");

  // TEST 8: Weaknesses Diagnosis with Root Cause & Impact
  console.log("\n--- TEST 8: Weaknesses Diagnosis ---");
  const weakContainer = elements.get("diag-weaknesses-list");
  assert(weakContainer.innerHTML.includes("Kafka Consumer Groups"), "Test 8.1: Weakness title rendered");
  assert(weakContainer.innerHTML.includes("rebalance storm"), "Test 8.2: Root cause rendered");
  assert(weakContainer.innerHTML.includes("throughput"), "Test 8.3: Impact rendered");
  assert(weakContainer.innerHTML.includes("Ưu tiên MEDIUM"), "Test 8.4: Priority badge rendered");

  // TEST 9: UNASSESSED Invariant (Never Weakness)
  console.log("\n--- TEST 9: UNASSESSED Invariant ---");
  const gapContainer = elements.get("diag-gaps-list");
  assert(gapContainer.innerHTML.includes("gRPC Streaming"), "Test 9.1: Gap concept name rendered");
  assert(gapContainer.innerHTML.includes("CHƯA ĐÁNH GIÁ (CƠ HỘI)"), "Test 9.2: UNASSESSED explicitly labeled as opportunity");
  assert(!weakContainer.innerHTML.includes("gRPC Streaming"), "Test 9.3: UNASSESSED item is NOT present in Weaknesses list");

  // TEST 10: Potential Risks Rendering (Non-Accusatory)
  console.log("\n--- TEST 10: Potential Risks ---");
  const riskContainer = elements.get("diag-risks-list");
  assert(riskContainer.innerHTML.includes("Mức độ: LOW"), "Test 10.1: Risk severity rendered");
  assert(riskContainer.innerHTML.includes("Kafka"), "Test 10.2: Risk description rendered");

  // TEST 11: Roadmap Priorities & Verification Criteria
  console.log("\n--- TEST 11: Improvement Roadmap ---");
  const roadmapContainer = elements.get("roadmap-items-grid");
  assert(roadmapContainer.innerHTML.includes("1 - 3 Ngày"), "Test 11.1: Short-term badge rendered");
  assert(roadmapContainer.innerHTML.includes("Ưu tiên HIGH"), "Test 11.2: Priority HIGH rendered");
  assert(roadmapContainer.innerHTML.includes("Cooperative Sticky assignor"), "Test 11.3: Concrete step rendered");
  assert(roadmapContainer.innerHTML.includes("Tiêu chí Tự Kiểm Chứng"), "Test 11.4: Verification criteria rendered");

  // TEST 12: Strength Leverage Notes
  console.log("\n--- TEST 12: Strength Leverage Notes ---");
  const strengthText = elements.get("roadmap-strength-leverage-text");
  assert(strengthText.textContent.includes("Tận dụng kinh nghiệm RDBMS"), "Test 12.1: Strength leverage notes rendered");

  // TEST 13: Preparation Modules
  console.log("\n--- TEST 13: Preparation Modules ---");
  const prepTech = elements.get("prep-technical-content");
  const prepPrac = elements.get("prep-practical-content");
  const prepBeh = elements.get("prep-behavioral-content");
  const prepMock = elements.get("prep-mock-content");

  assert(prepTech.innerHTML.includes("Kafka Internals"), "Test 13.1: Technical preparation rendered");
  assert(prepPrac.innerHTML.includes("Database Partitioning"), "Test 13.2: Practical preparation rendered");
  assert(prepBeh.innerHTML.includes("STAR Story"), "Test 13.3: Behavioral STAR story rendered");
  assert(prepMock.innerHTML.includes("Kafka Rebalance Drills"), "Test 13.4: Mock recommendations rendered");

  // TEST 14: Company Non-Mandatory / Inferred Badge
  console.log("\n--- TEST 14: Company Inference Non-Mandatory ---");
  const prepComp = elements.get("prep-company-content");
  assert(prepComp.innerHTML.includes("Gợi ý tham khảo"), "Test 14.1: Inferred company context marked as non-mandatory");

  // TEST 15: Interactive Checklist & Progress Calculation
  console.log("\n--- TEST 15: Interactive Checklist ---");
  const checklistContainer = elements.get("checklist-container");
  const progressText = elements.get("checklist-progress-text");
  const progressBar = elements.get("checklist-progress-bar");

  assert(checklistContainer.innerHTML.includes("Kiến thức Kỹ thuật"), "Test 15.1: Technical checklist group rendered");
  assert(checklistContainer.innerHTML.includes("Hiểu biết Doanh nghiệp"), "Test 15.2: Company checklist group rendered");
  assert(progressText.textContent.includes("0 / 2 việc (0%)"), "Test 15.3: Initial progress is 0%");

  // Toggle item 0
  const chk0 = document.getElementById("chk-0");
  chk0.checked = false; // toggle to true
  ctx.toggleChecklistItem("chk-0", "sess-test");
  assert(chk0.checked === true, "Test 15.4: Checklist item toggled to checked");
  assert(window.localStorage.getItem("prepmate_checklist_sess-test").includes('"chk-0":true'), "Test 15.5: State persisted in localStorage");

  // TEST 16: Turn Provenance & Dialogue Trace
  console.log("\n--- TEST 16: Turn Provenance ---");
  const turnContainer = elements.get("turn-provenance-list");
  assert(turnContainer.innerHTML.includes("Lượt 1"), "Test 16.1: Turn index 1 rendered");
  assert(turnContainer.innerHTML.includes("B-Tree Index"), "Test 16.2: Turn question rendered");
  assert(turnContainer.innerHTML.includes("Có kinh nghiệm thực tế"), "Test 16.3: Practical experience badge rendered");
  assert(turnContainer.innerHTML.includes("Fact: Root to leaf navigation"), "Test 16.4: Verified fact tag rendered");

  // TEST 17: Unevaluated Session Handling (Zero Fake Scores)
  console.log("\n--- TEST 17: Unevaluated Session Null Safety ---");
  const unevaluatedSession = {
    jobTitle: "Frontend Intern",
    score: null,
    overallScore: null,
    isEvaluated: false
  };
  ctx.renderOverviewHero({}, null, {}, {}, {}, unevaluatedSession);
  assert(scoreNumEl.textContent === "—", "Test 17.1: Unevaluated score renders '—'");
  assert(normScoreEl.textContent === "Chưa đủ dữ liệu để chấm điểm", "Test 17.2: Honest null explanation");

  // TEST 18: Legacy Session Fallback Handling
  console.log("\n--- TEST 18: Legacy Session Fallback ---");
  const legacySession = {
    jobTitle: "Fullstack Dev",
    score: 75,
    criteria: { technicalKnowledge: "Tốt" },
    analysis: { strengths: "Nắm vững JavaScript", improvements: "Cần cải thiện CSS Grid", suggestion: "Luyện thêm layout" },
    answers: [
      { question: "Closure là gì?", answer: "Closure giữ lexical scope...", topic: "JavaScript" }
    ]
  };

  const extractedLegacy = ctx.extractReportPayload(legacySession);
  ctx.renderFullReport(extractedLegacy, legacySession);
  assert(scoreNumEl.textContent === "75", "Test 18.1: Legacy score standardized to 75 / 100");
  assert(elements.get("hero-score-scale").textContent === "/ 100", "Test 18.1b: Hero scale displays / 100");
  assert(normScoreEl.textContent.includes("75 / 100"), "Test 18.2: Legacy normalized score is 75 / 100");

  // TEST 19: State Transitions
  console.log("\n--- TEST 19: State Transitions ---");
  ctx.showLoadingState();
  assert(!elements.get("report-loading-state").classList.contains("hidden"), "Test 19.1: Loading shown");
  ctx.showContentState();
  assert(elements.get("report-loading-state").classList.contains("hidden"), "Test 19.2: Loading hidden");
  assert(!elements.get("report-content-container").classList.contains("hidden"), "Test 19.3: Content shown");
  ctx.showErrorState("Lỗi kết nối");
  assert(!elements.get("report-error-state").classList.contains("hidden"), "Test 19.4: Error shown");
  ctx.showEmptyState("Chưa có báo cáo");
  assert(!elements.get("report-empty-state").classList.contains("hidden"), "Test 19.5: Empty shown");

  // TEST 20: Responsive CSS Validation
  console.log("\n--- TEST 20: Responsive CSS Validation ---");
  const cssContent = fs.readFileSync(cssPath, "utf8");
  assert(cssContent.includes("@media (max-width: 992px)"), "Test 20.1: Tablet media query exists");
  assert(cssContent.includes("@media (max-width: 768px)"), "Test 20.2: Mobile media query exists");
  assert(cssContent.includes("@media print"), "Test 20.3: Print media query exists");
  assert(!cssContent.includes("overflow-x: scroll"), "Test 20.4: No forced horizontal scrolling on containers");
  assert(cssContent.includes("page-break-inside: avoid"), "Test 20.5: Print page-break optimization verified");

  console.log("\n==================================================");
  console.log(`   TEST RESULTS: ${passed} PASS, ${failed} FAIL   `);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
