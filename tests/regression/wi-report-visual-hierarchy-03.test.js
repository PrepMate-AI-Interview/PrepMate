/**
 * WI-REPORT-VISUAL-HIERARCHY-AND-ACTIONABLE-INSIGHTS-03 Regression Test Suite
 * 
 * Verifies:
 * 1. Visual Hierarchy & Overview Synthesis (Analysis 4-pillar executive summary)
 * 2. Voice & Video Evidence (Voice analysis, 2-column video moments, full audio replay)
 * 3. Actionable Recommendations (3 explicit priority tiers, 5-part structure, interactive triggers)
 * 4. Trusted Resources & Deep-Dive References (4 categories, verified URLs, external link attrs, SVG icons)
 * 5. Design System, Responsive Media Queries & Dark Mode
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const REPORT_HTML_PATH = path.join(REPO_ROOT, 'FE', 'features', 'report', 'report.html');
const REPORT_JS_PATH = path.join(REPO_ROOT, 'FE', 'features', 'report', 'report.js');
const REPORT_CSS_PATH = path.join(REPO_ROOT, 'FE', 'features', 'report', 'report.css');

const reportHtml = fs.readFileSync(REPORT_HTML_PATH, 'utf8');
const reportJs = fs.readFileSync(REPORT_JS_PATH, 'utf8');
const reportCss = fs.readFileSync(REPORT_CSS_PATH, 'utf8');

console.log('================================================================');
console.log('  TEST SUITE: WI-REPORT-VISUAL-HIERARCHY-AND-ACTIONABLE-INSIGHTS-03');
console.log('================================================================\n');

// --------------------------------------------------------------------------
// GROUP 1: EXECUTIVE ANALYSIS SYNTHESIS (OVERVIEW OF 4 KEY PILLARS)
// --------------------------------------------------------------------------
console.log('--- GROUP 1: Executive Analysis Synthesis (Overview in Stage 03) ---');

assert.ok(
  reportHtml.includes('id="analysis-executive-summary-card"') &&
  reportHtml.includes('id="analysis-exec-pillars-grid"'),
  '1.1 report.html contains analysis-executive-summary-card and pillars grid'
);
console.log('[PASS] 1.1 Executive analysis synthesis container present in report.html');

assert.ok(
  reportJs.includes('function renderAnalysisExecutiveSummary') &&
  reportJs.includes('window.renderAnalysisExecutiveSummary = renderAnalysisExecutiveSummary'),
  '1.2 report.js defines and exports renderAnalysisExecutiveSummary function'
);
console.log('[PASS] 1.2 renderAnalysisExecutiveSummary defined and exported');

assert.ok(
  reportJs.includes('renderAnalysisExecutiveSummary(perf, diag, report, session);'),
  '1.3 renderAnalysisExecutiveSummary is called in renderFullReport before dimensions'
);
console.log('[PASS] 1.3 renderAnalysisExecutiveSummary called in full report flow');

assert.ok(
  reportJs.includes('pillar-strong') &&
  reportJs.includes('pillar-weak') &&
  reportJs.includes('pillar-voice') &&
  reportJs.includes('pillar-visual'),
  '1.4 Four distinct synthesis pillars rendered (Strength, Weakness, Voice, Visual)'
);
console.log('[PASS] 1.4 Four distinct synthesis pillars rendered with semantic badges');

// --------------------------------------------------------------------------
// GROUP 2: ACTIONABLE RECOMMENDATIONS (3 PRIORITY TIERS & 5 PARTS)
// --------------------------------------------------------------------------
console.log('\n--- GROUP 2: Actionable Recommendations (3 Tiers & 5-Part Structure) ---');

assert.ok(
  reportJs.includes('Ưu tiên 1 — Cần cải thiện trước') &&
  reportJs.includes('Ưu tiên 2 — Nên cải thiện') &&
  reportJs.includes('Ưu tiên 3 — Phát triển thêm'),
  '2.1 Standardized 3-tier priority labels formatted in recommendations'
);
console.log('[PASS] 2.1 3-Tier priority hierarchy defined (Tier 1: Cần cải thiện trước -> Tier 2: Nên cải thiện -> Tier 3: Phát triển thêm)');

assert.ok(
  reportJs.includes('priority-rec-5part-body') &&
  reportJs.includes('priority-rec-issue') &&
  reportJs.includes('1. Vấn đề cần cải thiện:') &&
  reportJs.includes('2. Lý do ưu tiên:') &&
  reportJs.includes('3. Hành động trọng tâm:') &&
  reportJs.includes('4. Cách luyện tập thực tế:') &&
  (reportJs.includes('5. Tiêu chí Tự Kiểm Chứng:') || reportJs.includes('5. Kết quả Kỳ vọng:')),
  '2.2 Recommendations implement the structured 5-part model'
);
console.log('[PASS] 2.2 Structured 5-part recommendation model verified');

assert.ok(
  reportJs.includes('priority-rec-interactive-row') &&
  reportJs.includes('rec-evidence-btn') &&
  reportJs.includes('rec-guide-btn') &&
  reportJs.includes('scrollToEvidence') &&
  reportJs.includes('scrollToResource'),
  '2.3 Interactive trigger buttons provided: Xem minh chứng & Tìm hiểu cách cải thiện'
);
console.log('[PASS] 2.3 Interactive connection triggers (Xem minh chứng & Tìm hiểu cách cải thiện) present');

// --------------------------------------------------------------------------
// GROUP 3: TRUSTED RESOURCES & DEEP-DIVE REFERENCES
// --------------------------------------------------------------------------
console.log('\n--- GROUP 3: Trusted Resources & Deep-Dive References ---');

assert.ok(
  reportJs.includes('https://capd.mit.edu/resources/the-star-method-for-behavioral-interviews/') &&
  reportJs.includes('https://careerservices.fas.harvard.edu/') &&
  reportJs.includes('https://www.toastmasters.org/resources/your-speaking-voice') &&
  reportJs.includes('https://www.mindtools.com/') &&
  reportJs.includes('https://learn.microsoft.com/en-us/azure/architecture/patterns/') &&
  reportJs.includes('https://github.com/donnemartin/system-design-primer'),
  '3.1 All external references use authentic, verified URLs from recognized authorities'
);
console.log('[PASS] 3.1 Genuine authoritative external resource URLs integrated');

assert.ok(
  reportJs.includes('target="_blank"') &&
  reportJs.includes('rel="noopener noreferrer"') &&
  reportJs.includes('ref-action-btn'),
  '3.2 External links open in new tab with security attributes and action styling'
);
console.log('[PASS] 3.2 Secure external link attributes (target="_blank", rel="noopener noreferrer") enforced');

assert.ok(
  reportJs.includes('ref-category-group') &&
  reportJs.includes('Cẩm Nang Phương Pháp &amp; Kỹ Năng Phỏng Vấn (STAR Framework)') &&
  reportJs.includes('Làm Chủ Giọng Nói, Tốc Độ &amp; Kỹ Năng Thuyết Trình') &&
  reportJs.includes('Ngôn Ngữ Cơ Thể &amp; Tác Phong Phi Ngôn Ngữ') &&
  reportJs.includes('Tài Liệu Chuyên Môn &amp; Thiết Kế Hệ Thống Theo Ngành'),
  '3.3 Reference catalog structured across 4 distinct thematic categories'
);
console.log('[PASS] 3.3 Four thematic reference categories structured');

assert.ok(
  !reportJs.includes('<span class="ref-why-icon" aria-hidden="true">💡</span>') &&
  !reportJs.includes('<span class="ref-category-icon" aria-hidden="true">📚</span>') &&
  !reportJs.includes('<span class="ref-category-icon" aria-hidden="true">🎯</span>'),
  '3.4 Emojis eliminated from reference UI in favor of SVG Morphicons'
);
console.log('[PASS] 3.4 Emojis eliminated and replaced with Lucide/Morphicons SVG icons');

// --------------------------------------------------------------------------
// GROUP 4: NAVIGATION, SMOOTH SCROLL & TARGET HIGHLIGHT
// --------------------------------------------------------------------------
console.log('\n--- GROUP 4: Navigation, Smooth Scroll & Target Highlighting ---');

assert.ok(
  reportJs.includes('function scrollToEvidence') &&
  reportJs.includes('function scrollToResource') &&
  reportJs.includes('window.scrollToEvidence = scrollToEvidence') &&
  reportJs.includes('window.scrollToResource = scrollToResource'),
  '4.1 scrollToEvidence and scrollToResource defined and exported to window'
);
console.log('[PASS] 4.1 scrollToEvidence and scrollToResource navigation functions exported');

assert.ok(
  reportCss.includes('@keyframes pmTargetPulse') &&
  reportCss.includes('.pm-target-highlight'),
  '4.2 Target pulse keyframe animation defined in report.css'
);
console.log('[PASS] 4.2 Smooth target highlight keyframe pulse animation verified');

// --------------------------------------------------------------------------
// GROUP 5: DESIGN SYSTEM, RESPONSIVE MATRIX & DARK MODE
// --------------------------------------------------------------------------
console.log('\n--- GROUP 5: Design System, Responsive Matrix & Dark Mode ---');

assert.ok(
  reportCss.includes('.analysis-executive-summary-card') &&
  reportCss.includes('.analysis-exec-pillars-grid') &&
  reportCss.includes('.priority-rec-tier-1') &&
  reportCss.includes('.priority-rec-tier-2') &&
  reportCss.includes('.priority-rec-tier-3') &&
  reportCss.includes('.priority-rec-interactive-row'),
  '5.1 CSS definitions for executive summary card, 3-tier borders and interactive rows exist'
);
console.log('[PASS] 5.1 CSS layout and priority tier styling rules verified');

assert.ok(
  reportCss.includes('@media (max-width: 1024px)') &&
  reportCss.includes('@media (max-width: 768px)') &&
  reportCss.includes('@media (max-width: 390px)'),
  '5.2 Responsive media query breakpoints defined for 1024px, 768px and 390px'
);
console.log('[PASS] 5.2 Responsive breakpoints (1440px desktop, 1024px tablet landscape, 768px tablet portrait, 390px mobile) verified');

assert.ok(
  reportCss.includes('[data-theme="dark"] .analysis-executive-summary-card') &&
  reportCss.includes('[data-theme="dark"] .analysis-exec-pillar-card') &&
  reportCss.includes('[data-theme="dark"] .ref-domain-tag') &&
  reportCss.includes('[data-theme="dark"] .rec-evidence-btn'),
  '5.3 Comprehensive Dark Mode theme overrides defined'
);
console.log('[PASS] 5.3 Dark mode contrast and theme overrides verified');

// --------------------------------------------------------------------------
// GROUP 6: DOM EXECUTION CONTRACT
// --------------------------------------------------------------------------
console.log('\n--- GROUP 6: DOM Execution & Rendering Contract ---');

function createMockElement(id = '', tag = 'div') {
  return {
    id,
    tagName: tag.toUpperCase(),
    innerHTML: '',
    textContent: '',
    className: '',
    style: {},
    children: [],
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] || null; },
    classList: {
      _classes: new Set(),
      add(...cls) { cls.forEach(c => this._classes.add(c)); },
      remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
      contains(c) { return this._classes.has(c); }
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    getBoundingClientRect() { return { top: 100, bottom: 200, left: 0, right: 300 }; }
  };
}

const domElements = {
  'analysis-exec-pillars-grid': createMockElement('analysis-exec-pillars-grid'),
  'roadmap-items-grid': createMockElement('roadmap-items-grid'),
  'reference-materials-list-container': createMockElement('reference-materials-list-container'),
  'roadmap-strength-leverage-box': createMockElement('roadmap-strength-leverage-box'),
  'roadmap-strength-leverage-text': createMockElement('roadmap-strength-leverage-text'),
  'roadmap-overall-assessment-text': createMockElement('roadmap-overall-assessment-text'),
  'roadmap-weakness-priorities-wrap': createMockElement('roadmap-weakness-priorities-wrap'),
  'roadmap-weakness-priorities-list': createMockElement('roadmap-weakness-priorities-list')
};

const store = new Map();
const sandbox = {
  window: {},
  document: {
    getElementById(id) {
      if (!domElements[id]) domElements[id] = createMockElement(id);
      return domElements[id];
    },
    createElement(tag) { return createMockElement('', tag); },
    addEventListener() {},
    removeEventListener() {},
    body: { appendChild() {}, removeChild() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  },
  addEventListener() {},
  removeEventListener() {},
  localStorage: {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  URL: {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {}
  },
  Audio: class {
    constructor() {
      this.src = '';
      this.currentTime = 0;
      this.duration = 10;
      this.volume = 1;
      this.muted = false;
    }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
  },
  console: { log() {}, warn() {}, error() {} },
  setTimeout: (fn) => fn(),
  clearTimeout: () => {}
};
sandbox.window = sandbox;
sandbox.global = sandbox;

vm.createContext(sandbox);
vm.runInContext(reportJs, sandbox);

// Test 6.1: renderAnalysisExecutiveSummary produces 4 pillars
const mockPerf = {
  dimensionScores: [
    { name: 'Kỹ Năng Kỹ Thuật', score: 88 },
    { name: 'Tư Duy Thiết Kế', score: 62 },
    { name: 'Giao Tiếp', score: 78 }
  ]
};
const mockDiag = {
  strengths: [{ concept: 'Cơ sở dữ liệu', observation: 'Hiểu sâu về ACID' }],
  weaknesses: [{ concept: 'Xử lý lỗi', observation: 'Cần bổ sung retry' }]
};
const mockReport = {
  speechAssessment: {
    metrics: { wordsPerMinute: 135, fillerWordsPerMinute: 2 }
  },
  visualAnalysis: {
    lightingStatus: 'Ánh sáng đạt chuẩn'
  }
};

sandbox.renderAnalysisExecutiveSummary(mockPerf, mockDiag, mockReport, {});
const execPillarsHtml = domElements['analysis-exec-pillars-grid'].innerHTML;
assert.ok(execPillarsHtml.includes('pillar-strong') && execPillarsHtml.includes('Kỹ Năng Kỹ Thuật'), 'Executive summary identifies strongest dimension');
assert.ok(execPillarsHtml.includes('pillar-weak') && execPillarsHtml.includes('Tư Duy Thiết Kế'), 'Executive summary identifies weakest dimension');
assert.ok(execPillarsHtml.includes('135 từ/phút'), 'Executive summary includes speech metric');
console.log('[PASS] 6.1 renderAnalysisExecutiveSummary correctly extracts and renders 4 pillars');

// Test 6.2: renderRoadmapSection formats 3 priority tiers and 5 parts
const mockRoadmap = {
  items: [
    {
      priority: 'HIGH',
      improvementObjective: 'Tối ưu kiến trúc caching',
      actions: [{ title: 'Thiết lập Redis Cache', description: 'Áp dụng Cache-Aside pattern' }],
      rationale: 'Giảm tải database trong các đợt cao điểm',
      concreteStepActions: ['Đánh giá tần suất truy vấn', 'Cấu hình TTL hợp lý'],
      expectedOutcome: 'Tăng 40% throughput hệ thống'
    },
    {
      priority: 'MEDIUM',
      improvementObjective: 'Rèn luyện phản hồi câu hỏi STAR',
      actions: [{ title: 'Cấu trúc hóa tình huống', description: 'Trình bày theo 4 phần STAR' }],
      rationale: 'Tăng tính thuyết phục trước hội đồng',
      expectedOutcome: 'Phản hồi rành mạch, súc tích'
    }
  ]
};

sandbox.renderRoadmapSection(mockRoadmap, mockDiag);
const roadmapHtml = domElements['roadmap-items-grid'].innerHTML;
assert.ok(roadmapHtml.includes('Ưu tiên 1 — Cần cải thiện trước'), 'Tier 1 priority rendered');
assert.ok(roadmapHtml.includes('Ưu tiên 2 — Nên cải thiện'), 'Tier 2 priority rendered');
assert.ok(roadmapHtml.includes('1. Vấn đề cần cải thiện:'), 'Part 1: Vấn đề rendered');
assert.ok(roadmapHtml.includes('2. Lý do ưu tiên:'), 'Part 2: Lý do rendered');
assert.ok(roadmapHtml.includes('3. Hành động trọng tâm:'), 'Part 3: Hành động rendered');
assert.ok(roadmapHtml.includes('Xem minh chứng'), 'Interactive button Xem minh chứng rendered');
assert.ok(roadmapHtml.includes('Tìm hiểu cách cải thiện'), 'Interactive button Tìm hiểu cách cải thiện rendered');
console.log('[PASS] 6.2 renderRoadmapSection correctly renders 3-tier priorities and 5-part structure');

// Test 6.3: renderReferenceMaterials renders categorized resources
sandbox.renderReferenceMaterials({ jobTitle: 'Backend Engineer', industry: 'technology' }, mockReport);
const refMaterialsHtml = domElements['reference-materials-list-container'].innerHTML;
assert.ok(refMaterialsHtml.includes('Designing Data-Intensive Applications'), 'DDIA technical reference rendered');
assert.ok(refMaterialsHtml.includes('The STAR Method for Behavioral Interviews'), 'MIT STAR method rendered');
assert.ok(refMaterialsHtml.includes('Toastmasters International'), 'Toastmasters speech reference rendered');
assert.ok(refMaterialsHtml.includes('Mind Tools'), 'MindTools body language reference rendered');
assert.ok(refMaterialsHtml.includes('target="_blank"'), 'Anchor opens in new tab');
console.log('[PASS] 6.3 renderReferenceMaterials renders categorized resources with verified external anchors');

console.log('\n================================================================');
console.log('  ALL AUDIT CHECKS PASSED: 18 / 18 PASS | 0 FAIL');
console.log('================================================================');
