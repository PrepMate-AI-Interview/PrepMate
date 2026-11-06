/**
 * TEST SUITE: WI-UX-02 — FOOTER, QUESTION BANK & PROGRESS UX REFINEMENT
 *
 * Verifies:
 * 1. WI-02A: Footer Consistency & Workspace Simplification
 *    - Sticky footer CSS contracts (flex-col, min-height 100vh/100svh, margin-top: auto)
 *    - No position: fixed or absolute positioning on footers
 *    - Simplified workspace footer in components.js (no duplicate sidebar feature links)
 * 2. WI-02B: Question Bank Reference & Answer Guidance
 *    - Absence of practice CTAs (.btn-practice-quick, #modal-practice-link)
 *    - Structured guidance: interviewer goal, STAR, keywords, common pitfalls (#modal-pitfalls)
 *    - Reference disclaimer banner
 *    - Copy question action (#modal-copy-btn)
 * 3. WI-02C: Progress Dedicated Monitoring & Insights
 *    - Absence of practice redirects (.empty-alert-btn removed, no interview-info or qbank practice CTAs)
 *    - Direct past interview report access (reports list & ../report/report.html?id=...)
 *    - Honest data handling for 0, 1, and 2+ sessions (no fake drop-offs, no fake 0% improvement)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST SUITE: WI-UX-02 — FOOTER, QUESTION BANK & PROGRESS UX REFINEMENT ===\n');

let passCount = 0;
let failCount = 0;

function check(desc, fn) {
    try {
        fn();
        console.log(`  [PASS] ${desc}`);
        passCount++;
    } catch (err) {
        console.error(`  [FAIL] ${desc}: ${err.message}`);
        failCount++;
    }
}

// ────────────────────────────────────────────────────────────
// GROUP 1: WI-02A — FOOTER CONSISTENCY & WORKSPACE SIMPLIFICATION
// ────────────────────────────────────────────────────────────
console.log('--- Group 1: WI-02A Footer Consistency & Workspace Simplification ---');

const layoutCss = fs.readFileSync(path.join(__dirname, '../../FE/shared/css/layout.css'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, '../../FE/shared/css/style.css'), 'utf8');
const componentsJs = fs.readFileSync(path.join(__dirname, '../../FE/shared/js/components.js'), 'utf8');

check('layout.css: .main-content-new has flex column layout and min-height: 100vh / 100svh', () => {
    assert(layoutCss.includes('.main-content-new {'), '.main-content-new must exist in layout.css');
    assert(layoutCss.includes('min-height: 100vh;'), 'min-height: 100vh missing in layout.css');
    assert(layoutCss.includes('min-height: 100svh;'), 'min-height: 100svh missing in layout.css');
    assert(layoutCss.includes('display: flex;'), 'display: flex missing in layout.css');
    assert(layoutCss.includes('flex-direction: column;'), 'flex-direction: column missing in layout.css');
});

check('layout.css: app-workspace-footer and .app-workspace-footer use margin-top: auto', () => {
    assert(layoutCss.includes('app-workspace-footer {'), 'app-workspace-footer selector must exist in layout.css');
    assert(layoutCss.includes('margin-top: auto;'), 'margin-top: auto missing in layout.css');
});

check('layout.css & style.css: footers do not use position: fixed or absolute', () => {
    assert(!layoutCss.match(/\.app-workspace-footer\s*\{[^}]*position:\s*(fixed|absolute)/i), '.app-workspace-footer must not be fixed or absolute');
    assert(!layoutCss.match(/\.app-footer\s*\{[^}]*position:\s*(fixed|absolute)/i), '.app-footer must not be fixed or absolute');
    assert(!styleCss.match(/\.app-workspace-footer\s*\{[^}]*position:\s*(fixed|absolute)/i), 'style.css .app-workspace-footer must not be fixed or absolute');
});

check('components.js: AppWorkspaceFooter does not contain redundant sidebar links', () => {
    const wsFooterMatch = componentsJs.match(/class AppWorkspaceFooter[\s\S]*?customElements\.define\('app-workspace-footer'/);
    const wsFooterCode = wsFooterMatch ? wsFooterMatch[0] : '';
    assert(wsFooterCode, 'AppWorkspaceFooter class must be found');
    assert(!wsFooterCode.includes('Bảng giá PRO'), 'Workspace footer must not contain Bảng giá PRO link');
    assert(!wsFooterCode.includes('Phỏng vấn AI'), 'Workspace footer must not contain Phỏng vấn AI link');
    assert(!wsFooterCode.includes('Ngân hàng câu hỏi'), 'Workspace footer must not contain Ngân hàng câu hỏi link');
    assert(!wsFooterCode.includes('Cơ hội việc làm'), 'Workspace footer must not contain Cơ hội việc làm link');
    assert(!wsFooterCode.includes('CV của tôi'), 'Workspace footer must not contain CV của tôi link');
});

check('components.js: AppWorkspaceFooter preserves essential legal, support, status, and copyright', () => {
    assert(componentsJs.includes('legal-center.html'), 'Workspace footer must link to legal center');
    assert(componentsJs.includes('help.html'), 'Workspace footer must link to help center');
    assert(componentsJs.includes('about.html'), 'Workspace footer must link to about page');
    assert(componentsJs.includes('© 2026 PrepMate AI Inc.'), 'Workspace footer must contain copyright');
    assert(componentsJs.includes('workspace-footer-status'), 'Workspace footer must contain status indicator');
});

// ────────────────────────────────────────────────────────────
// GROUP 2: WI-02B — QUESTION BANK REFERENCE & ANSWER GUIDANCE
// ────────────────────────────────────────────────────────────
console.log('\n--- Group 2: WI-02B Question Bank Reference & Answer Guidance ---');

const qbankHtml = fs.readFileSync(path.join(__dirname, '../../FE/features/qbank/qbank.html'), 'utf8');
const qbankCss = fs.readFileSync(path.join(__dirname, '../../FE/features/qbank/qbank.css'), 'utf8');

check('qbank.html: Hero text does not promote starting an interview or simulation room', () => {
    assert(!qbankHtml.includes('hoặc "Luyện tập" trên từng câu hỏi để vào phòng mô phỏng'), 'Hero text must not promote practice entry');
    assert(qbankHtml.includes('Cẩm nang tra cứu và định hướng trả lời câu hỏi phỏng vấn chuẩn hóa'), 'Hero text should explain reference & guidance role');
});

check('qbank.html: Question cards do not render .btn-practice-quick', () => {
    assert(!qbankHtml.includes('class="btn-practice-quick"'), 'btn-practice-quick must be removed from question cards');
    assert(qbankHtml.includes('class="btn-detail-popup"'), 'btn-detail-popup must be retained for viewing guidance');
});

check('qbank.html: Modal does not render #modal-practice-link', () => {
    assert(!qbankHtml.includes('id="modal-practice-link"'), 'modal-practice-link must be removed from modal');
    assert(!qbankHtml.includes('Luyện chuyên đề này ngay →'), 'Practice prompt must be removed from modal');
});

check('qbank.html: Modal contains complete structured guidance (Interviewer goal, STAR, Keywords, Common Pitfalls)', () => {
    assert(qbankHtml.includes('id="modal-context"'), 'Interviewer goal / context (#modal-context) must exist');
    assert(qbankHtml.includes('id="modal-followup"'), 'AI followup probe (#modal-followup) must exist');
    assert(qbankHtml.includes('id="modal-star-s"'), 'STAR S must exist');
    assert(qbankHtml.includes('id="modal-star-t"'), 'STAR T must exist');
    assert(qbankHtml.includes('id="modal-star-a"'), 'STAR A must exist');
    assert(qbankHtml.includes('id="modal-star-r"'), 'STAR R must exist');
    assert(qbankHtml.includes('id="modal-tags-container"'), 'Keywords container (#modal-tags-container) must exist');
    assert(qbankHtml.includes('id="modal-pitfalls"'), 'Common pitfalls container (#modal-pitfalls) must exist');
});

check('qbank.html: Modal contains framework disclaimer banner', () => {
    assert(qbankHtml.includes('modal-disclaimer-box'), 'Modal must have disclaimer box');
    assert(qbankHtml.includes('Lưu ý phương pháp luận:'), 'Disclaimer must mention methodology reference');
    assert(qbankHtml.includes('không phải văn bản học thuộc lòng'), 'Disclaimer must clarify it is not a script to memorize');
});

check('qbank.html: Modal contains copy question button (#modal-copy-btn) with copy function', () => {
    assert(qbankHtml.includes('id="modal-copy-btn"'), 'Copy question button must exist in modal footer');
    assert(qbankHtml.includes('copyCurrentQuestion()'), 'copyCurrentQuestion handler must exist');
    assert(qbankHtml.includes('getQuestionPitfalls'), 'getQuestionPitfalls helper must exist');
});

check('qbank.css: Contains styles for modal-pitfalls-block, modal-disclaimer-box, and modal-copy-action', () => {
    assert(qbankCss.includes('.modal-pitfalls-block'), 'CSS for modal-pitfalls-block must exist');
    assert(qbankCss.includes('.modal-disclaimer-box'), 'CSS for modal-disclaimer-box must exist');
    assert(qbankCss.includes('.modal-copy-action'), 'CSS for modal-copy-action must exist');
});

// ────────────────────────────────────────────────────────────
// GROUP 3: WI-02C — PROGRESS DEDICATED MONITORING & INSIGHTS
// ────────────────────────────────────────────────────────────
console.log('\n--- Group 3: WI-02C Progress Dedicated Monitoring & Insights ---');

const progressHtml = fs.readFileSync(path.join(__dirname, '../../FE/features/progress/progress.html'), 'utf8');
const progressCss = fs.readFileSync(path.join(__dirname, '../../FE/features/progress/progress.css'), 'utf8');

check('progress.html: Empty alert (#progress-empty-alert) does not contain practice redirect button', () => {
    assert(!progressHtml.includes('class="empty-alert-btn"'), 'empty-alert-btn must be removed from progress empty state');
    assert(!progressHtml.includes('Thực hiện phỏng vấn đầu tiên</a>'), 'Practice CTA link must be removed from empty state');
    assert(progressHtml.includes('id="progress-empty-alert"'), 'progress-empty-alert container must exist');
});

check('progress.html: Action plans in renderImprovements do not redirect to interview practice or QBank', () => {
    assert(!progressHtml.includes("btnText: 'Luyện lại câu hỏi này →'"), 'Practice CTA must be removed from weakQ');
    assert(!progressHtml.includes("btnText: 'Luyện tập lại lượt này →'"), 'Practice CTA must be removed from feedback');
    assert(!progressHtml.includes('category=behavioral'), 'QBank category=behavioral redirect must be removed');
    assert(!progressHtml.includes('category=technical'), 'QBank category=technical redirect must be removed');
});

check('progress.html: Action plans link to session reports when session exists', () => {
    assert(progressHtml.includes('latestReportUrl'), 'latestReportUrl must be defined');
    assert(progressHtml.includes('../report/report.html?id='), 'Must link to past report with session id');
});

check('progress.html: Contains dedicated Past Interview Reports section (#reports-list-container)', () => {
    assert(progressHtml.includes('id="reports-list-container"'), 'reports-list-container must exist in DOM');
    assert(progressHtml.includes('Báo cáo Đánh giá Chi tiết từ Buổi Phỏng vấn'), 'Reports section title must exist');
    assert(progressHtml.includes('renderReportsList'), 'renderReportsList function must exist');
});

check('progress.html: Honest data handling for 0, 1, and 2+ sessions', () => {
    // 0 session handling
    assert(progressHtml.includes("document.getElementById('stat-total').textContent = '0'"), '0 sessions total count must be 0');
    assert(progressHtml.includes("document.getElementById('stat-best').textContent = '—'"), '0 sessions best must be dash');
    assert(progressHtml.includes("document.getElementById('stat-improve').textContent = '—'"), '0 sessions improve must be dash');

    // 1 session handling
    assert(progressHtml.includes('Cần từ 2 buổi để so sánh xu hướng'), '1 session must indicate that trend comparison requires 2 sessions');
    assert(progressHtml.includes('trend-single-session-hint'), 'Single session hint container must exist in DOM');
    assert(progressHtml.includes('Lượt đầu tiên (chưa có so sánh)'), '1 session avgDelta must indicate first session');

    // 2+ sessions handling
    assert(progressHtml.includes('so với buổi đầu'), '2+ sessions must explain comparison baseline to first session');
    assert(progressHtml.includes('so với buổi trước'), '2+ sessions must explain session-over-session baseline');
});

check('progress.css: Contains styles for reports section, rows, score pills, and single-session hint', () => {
    assert(progressCss.includes('.reports-section'), 'CSS for .reports-section must exist');
    assert(progressCss.includes('.progress-reports-grid'), 'CSS for .progress-reports-grid must exist');
    assert(progressCss.includes('.btn-open-report'), 'CSS for .btn-open-report must exist');
    assert(progressCss.includes('.trend-single-hint'), 'CSS for .trend-single-hint must exist');
});

// ────────────────────────────────────────────────────────────
// SUMMARY
// ────────────────────────────────────────────────────────────
console.log('\n===============================================================');
console.log(`TOTAL CHECKS: ${passCount + failCount}`);
console.log(`PASSED      : ${passCount}`);
console.log(`FAILED      : ${failCount}`);
console.log('===============================================================');

if (failCount > 0) {
    process.exit(1);
} else {
    console.log('\nAll WI-UX-02 specification checks PASSED successfully!');
}
