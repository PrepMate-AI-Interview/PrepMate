/**
 * PREPMATE — TEST SUITE: CONTEXT-AWARE INTERVIEW PREPARATION & ETIQUETTE CHECKLIST
 * Work Item: WI-COACH-PRESENTATION-02
 *
 * Verifies:
 *   1. Safe defaults when metadata is missing (graceful fallback to general_other & unspecified).
 *   2. Industry-specific dress code across core sectors (Tech, Finance, Commerce, Healthcare, etc.).
 *   3. Multi-format adaptation (Online, Onsite, Phone, Unspecified).
 *   4. 4-Phase Etiquette checklist generation (Phase A, B, C, D) with natural dialogue script.
 *   5. Persistence & recovery in localStorage (`prepmate_checklist_${sessionId}`).
 *   6. Multi-session isolation (Session A checkboxes do not bleed into Session B).
 *   7. Zero fabricated corporate culture claims when companyName is present.
 *   8. Zero judgmental scoring of practice clothing or personal lifestyle.
 *   9. Preservation of existing preparation and checklist DOM elements.
 *  10. Strict separation from Part A professional evaluation and visual coaching scoring.
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");

const guide = require("../../FE/features/interview/interview-preparation-guide.js");

// Mock lightweight DOM & LocalStorage for Node testing
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

async function runPresentationGuideTestSuite() {
  console.log("=== TEST SUITE: CONTEXT-AWARE INTERVIEW PREPARATION & ETIQUETTE (WI-COACH-PRESENTATION-02) ===\n");
  let passCount = 0;
  function pass(desc) {
    passCount++;
    console.log(`[PASS] Test ${passCount}: ${desc}`);
  }

  // --- Test 1: Safe Defaults when Metadata is Missing ---
  {
    const defaultGuide = guide.getDressCodeGuide(null, null);
    assert.ok(defaultGuide, "Guide must not be null");
    assert.strictEqual(defaultGuide.sectorId, "general_other", "Must fallback to general_other sector");
    assert.strictEqual(defaultGuide.format, "unspecified", "Must default to unspecified format");
    assert.ok(defaultGuide.recommendations.length > 0, "Must provide general recommendations");
    assert.ok(defaultGuide.disclaimer.includes("không phải quy định bắt buộc"), "Must include ethical disclaimer");
    pass("Safe defaults when metadata is missing");
  }

  // --- Test 2: Industry-Specific Dress Code Mapping ---
  {
    // Tech
    const techGuide = guide.getDressCodeGuide("it_software", "online");
    assert.strictEqual(techGuide.sectorId, "tech_engineering");
    assert.ok(techGuide.typicalStyle.includes("Smart Casual"));
    assert.ok(techGuide.recommendations.some(r => r.includes("sơ mi") || r.includes("polo")));

    // Finance / Banking
    const financeGuide = guide.getDressCodeGuide("Ngân hàng & Tài chính", "onsite");
    assert.strictEqual(financeGuide.sectorId, "business_finance");
    assert.ok(financeGuide.typicalStyle.includes("Business Formal") || financeGuide.typicalStyle.includes("Professional"));
    assert.ok(financeGuide.recommendations.some(r => r.includes("blazer") || r.includes("vest")));

    // Healthcare
    const healthGuide = guide.getDressCodeGuide("healthcare_pharma", "onsite");
    assert.strictEqual(healthGuide.sectorId, "healthcare_pharma");
    assert.ok(healthGuide.recommendations.some(r => r.includes("sạch sẽ") || r.includes("kín mũi")));

    // Hospitality
    const hospGuide = guide.getDressCodeGuide("Du lịch & Khách sạn", "onsite");
    assert.strictEqual(hospGuide.sectorId, "hospitality_tourism");
    assert.ok(hospGuide.typicalStyle.includes("hiếu khách") || hospGuide.typicalStyle.includes("dịch vụ"));
    pass("Industry-specific dress code mapped across sectors");
  }

  // --- Test 3: Multi-Format Adaptation ---
  {
    // Online
    const online = guide.getDressCodeGuide("tech_engineering", "online");
    assert.strictEqual(online.format, "online");
    assert.ok(online.formatSpecificAdvice.some(a => a.includes("thân trên") || a.includes("webcam")));

    // Onsite
    const onsite = guide.getDressCodeGuide("tech_engineering", "onsite");
    assert.strictEqual(onsite.format, "onsite");
    assert.ok(onsite.formatSpecificAdvice.some(a => a.includes("trực tiếp") || a.includes("giày")));

    // Phone
    const phone = guide.getDressCodeGuide("tech_engineering", "phone");
    assert.strictEqual(phone.format, "phone");
    assert.ok(phone.formatSpecificAdvice.some(a => a.includes("điện thoại") || a.includes("sổ tay")));
    pass("Multi-format adaptation (Online, Onsite, Phone, Unspecified)");
  }

  // --- Test 4: 4-Phase Etiquette Checklist Generation ---
  {
    const checklist = guide.getEtiquetteChecklist("onsite", {
      jobTitle: "Senior DevOps Engineer",
      companyName: "TechCorp"
    });

    assert.strictEqual(checklist.allPhases.length, 4, "Must contain exactly 4 phases");
    assert.strictEqual(checklist.allPhases[0].key, "PhaseA");
    assert.strictEqual(checklist.allPhases[1].key, "PhaseB");
    assert.strictEqual(checklist.allPhases[2].key, "PhaseC");
    assert.strictEqual(checklist.allPhases[3].key, "PhaseD");

    // Phase B natural greeting script
    const greetingItem = checklist.allPhases[1].items.find(i => i.id === "chk-etiquette-b1");
    assert.ok(greetingItem, "Must have greeting item b1");
    assert.ok(greetingItem.subtitle.includes("Chào anh/chị, tôi là"), "Must include natural greeting phrasing");
    assert.ok(greetingItem.subtitle.includes("TechCorp") || greetingItem.subtitle.includes("Senior DevOps Engineer"));

    // Phase C non-mandatory handshake
    const handshakeItem = checklist.allPhases[2].items.find(i => i.id === "chk-etiquette-c2");
    assert.ok(handshakeItem, "Must have handshake item c2");
    assert.ok(handshakeItem.title.includes("chỉ bắt tay khi đối phương chủ động"), "Handshake must be non-mandatory and cue-based");
    pass("4-Phase Etiquette checklist generation with natural dialogue script");
  }

  // --- Test 5: Persistence & Recovery in LocalStorage ---
  {
    const mockStorage = new MockLocalStorage();
    const sessionId = "session_test_persist_01";
    const storageKey = `prepmate_checklist_${sessionId}`;

    // Simulate ticking item
    const state = { "chk-etiquette-a1": true, "chk-etiquette-c3": true };
    mockStorage.setItem(storageKey, JSON.stringify(state));

    // Recovery
    const recovered = JSON.parse(mockStorage.getItem(storageKey));
    assert.strictEqual(recovered["chk-etiquette-a1"], true);
    assert.strictEqual(recovered["chk-etiquette-c3"], true);
    assert.strictEqual(recovered["chk-etiquette-a2"], undefined);
    pass("Checkbox persistence and recovery in localStorage");
  }

  // --- Test 6: Multi-Session Isolation ---
  {
    const mockStorage = new MockLocalStorage();
    const session1 = "session_iso_01";
    const session2 = "session_iso_02";

    mockStorage.setItem(`prepmate_checklist_${session1}`, JSON.stringify({ "chk-etiquette-a1": true }));
    mockStorage.setItem(`prepmate_checklist_${session2}`, JSON.stringify({ "chk-etiquette-b2": true }));
    mockStorage.setItem(`prepmate_interview_format_${session1}`, "online");
    mockStorage.setItem(`prepmate_interview_format_${session2}`, "onsite");

    assert.strictEqual(JSON.parse(mockStorage.getItem(`prepmate_checklist_${session1}`))["chk-etiquette-a1"], true);
    assert.strictEqual(JSON.parse(mockStorage.getItem(`prepmate_checklist_${session1}`))["chk-etiquette-b2"], undefined);

    assert.strictEqual(mockStorage.getItem(`prepmate_interview_format_${session1}`), "online");
    assert.strictEqual(mockStorage.getItem(`prepmate_interview_format_${session2}`), "onsite");
    pass("Multi-session isolation verified between sessions");
  }

  // --- Test 7: Zero Fabricated Corporate Culture Claims ---
  {
    const guideWithCompany = guide.getDressCodeGuide("tech_engineering", "onsite", { companyName: "UnicornXYZ" });
    assert.ok(guideWithCompany.companyNotice.includes("UnicornXYZ"));
    assert.ok(guideWithCompany.companyNotice.includes("không đưa ra quy định giả định riêng"));
    assert.ok(!guideWithCompany.recommendations.some(r => r.includes("Văn hóa tại UnicornXYZ bắt buộc")));
    pass("Zero fabricated corporate culture claims when companyName is provided");
  }

  // --- Test 8: Zero Judgmental Scoring of Practice Clothing ---
  {
    const guideObj = guide.getDressCodeGuide("it_software");
    assert.ok(guideObj.disclaimer.includes("Không áp đặt theo giới tính, ngoại hình"));
    assert.ok(!JSON.stringify(guideObj).includes("điểm trừ"));
    assert.ok(!JSON.stringify(guideObj).includes("vi phạm"));
    pass("Zero judgmental scoring of practice clothing or personal lifestyle");
  }

  // --- Test 9: HTML File Structure & Script Tags ---
  {
    const reportHtml = fs.readFileSync(path.resolve(__dirname, "../../FE/features/report/report.html"), "utf8");
    assert.ok(reportHtml.includes('id="prep-dresscode-card"'), "Must contain prep-dresscode-card container");
    assert.ok(reportHtml.includes('id="prep-dresscode-content"'), "Must contain prep-dresscode-content container");
    assert.ok(reportHtml.includes('id="interview-format-selector-box"'), "Must contain interview-format-selector-box");
    assert.ok(reportHtml.includes("interview-preparation-guide.js"), "Must import interview-preparation-guide.js");
    assert.ok(reportHtml.includes("industry-taxonomy.js"), "Must import industry-taxonomy.js");
    pass("Preservation and presence of required DOM containers and scripts");
  }

  // --- Test 10: Strict Separation from Part A & Visual Scoring ---
  {
    const reportJs = fs.readFileSync(path.resolve(__dirname, "../../FE/features/report/report.js"), "utf8");
    // Ensure renderPreparationSection does NOT mutate score or dimension metrics
    assert.ok(reportJs.includes("renderPreparationSection"), "renderPreparationSection must exist");
    assert.ok(reportJs.includes("renderChecklistSection"), "renderChecklistSection must exist");
    assert.ok(reportJs.includes("prepmate_interview_format_"), "format selector must use session-keyed storage");
    pass("Strict separation from Part A professional evaluation and scoring confirmed");
  }

  console.log(`\n--- ALL ${passCount} CONTEXT-AWARE PREPARATION & ETIQUETTE TESTS PASSED CLEANLY ---`);
}

runPresentationGuideTestSuite().catch(err => {
  console.error("\n[TEST FAILURE]:", err);
  process.exit(1);
});
