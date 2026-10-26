// ==============================================================================
// PREPMATE — P1.4-B INFORMATION ARCHITECTURE & NAVIGATION AUTOMATED TEST SUITE
// Verifies all IA, Sidebar, Account Center, Bridges, Checkout Shell, and 404 specs.
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { resolvePath } = require('../helpers/test-env');
const assert = require('assert');

console.log('===============================================================');
console.log('   P1.4-B: INFORMATION ARCHITECTURE & NAVIGATION TEST SUITE     ');
console.log('===============================================================');

// File paths
const mainJsPath = resolvePath('FE/shared/js/main.js');
const profileHtmlPath = resolvePath('FE/features/profile/profile.html');
const cvHtmlPath = resolvePath('FE/features/profile/cv.html');
const historyHtmlPath = resolvePath('FE/features/interview/history.html');
const dashboardHtmlPath = resolvePath('FE/features/dashboard/dashboard.html');
const dashboardJsPath = resolvePath('FE/features/dashboard/dashboard.js');
const interviewInfoHtmlPath = resolvePath('FE/features/interview/interview-info.html');
const reportHtmlPath = resolvePath('FE/features/report/report.html');
const reportJsPath = resolvePath('FE/features/report/report.js');
const paymentHtmlPath = resolvePath('FE/features/payment/payment.html');
const notFoundHtmlPath = resolvePath('FE/404.html');

const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
const profileHtmlContent = fs.readFileSync(profileHtmlPath, 'utf8');
const cvHtmlContent = fs.readFileSync(cvHtmlPath, 'utf8');
const dashboardHtmlContent = fs.readFileSync(dashboardHtmlPath, 'utf8');
const dashboardJsContent = fs.readFileSync(dashboardJsPath, 'utf8');
const interviewInfoHtmlContent = fs.readFileSync(interviewInfoHtmlPath, 'utf8');
const reportHtmlContent = fs.readFileSync(reportHtmlPath, 'utf8');
const reportJsContent = fs.readFileSync(reportJsPath, 'utf8');
const paymentHtmlContent = fs.readFileSync(paymentHtmlPath, 'utf8');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 1: Candidate Sidebar & Navigation IA
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 1: Candidate Sidebar & Navigation IA ---');

// 1. Candidate sidebar has QBank
assert(mainJsContent.includes('qbank.html') && mainJsContent.includes('Ngân hàng câu hỏi'), 'Candidate sidebar exposes QBank (qbank.html)');
// 2. Candidate sidebar has CV Management
assert(mainJsContent.includes('cv.html') && mainJsContent.includes('Quản lý CV'), 'Candidate sidebar exposes CV Management (cv.html)');
// 3. Candidate sidebar has dedicated History
assert(mainJsContent.includes('history.html') && mainJsContent.includes('Lịch sử'), 'Candidate sidebar exposes dedicated History (history.html)');
// 4. Candidate sidebar has Profile link
assert(mainJsContent.includes('profile.html') && mainJsContent.includes('Hồ sơ tài khoản'), 'Candidate sidebar exposes Profile');
// 5. Candidate sidebar has Settings link
assert(mainJsContent.includes('settings.html') && mainJsContent.includes('Cài đặt'), 'Candidate sidebar exposes Settings');
// 6. User dropdown contains full access links
assert(mainJsContent.includes('user-dropdown-menu'), 'User dropdown menu exists');
assert(mainJsContent.includes('Quản lý CV') && mainJsContent.includes('cv.html'), 'User dropdown contains CV link');
assert(mainJsContent.includes('Lịch sử phỏng vấn') && mainJsContent.includes('history.html'), 'User dropdown contains History link');

console.log('[PASS] Suite 1: Candidate Sidebar & Navigation IA verified.');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 2: Guest Isolation (No Authenticated Leakage)
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 2: Guest Isolation ---');

// Extract guest sidebar slice from main.js
const guestSidebarMatch = mainJsContent.match(/if\s*\(\s*role\s*===\s*["']guest["']\s*\)\s*\{([\s\S]*?)\}\s*else\s*if/);
assert(guestSidebarMatch, 'Guest sidebar block located in main.js');
const guestBlock = guestSidebarMatch[1];

// Guest must NOT receive private workspace links
assert(!guestBlock.includes('history.html'), 'Guest sidebar does NOT leak history.html');
assert(!guestBlock.includes('cv.html'), 'Guest sidebar does NOT leak cv.html');
assert(!guestBlock.includes('progress.html'), 'Guest sidebar does NOT leak progress.html');
assert(!guestBlock.includes('profile.html'), 'Guest sidebar does NOT leak profile.html');
// Guest must have login CTA
assert(guestBlock.includes('auth.html') && guestBlock.includes('guest-login-btn'), 'Guest sidebar provides login CTA');

console.log('[PASS] Suite 2: Guest Isolation verified.');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 3: Profile De-monolith & Account Center Architecture
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 3: Profile De-monolith & Account Center ---');

// 1. Profile retains personal info form
assert(profileHtmlContent.includes('id="account"'), 'profile.html retains personal info section (#account)');
assert(profileHtmlContent.includes('id="fullname"'), 'profile.html has #fullname');
assert(profileHtmlContent.includes('id="email"'), 'profile.html has #email');
assert(profileHtmlContent.includes('id="target-role"'), 'profile.html has #target-role');
assert(profileHtmlContent.includes('Marketing Manager, Financial Analyst, Software Engineer'), 'profile.html preserves industry-neutral placeholder');

// 2. Profile removes duplicated full CV upload dropzone
assert(!profileHtmlContent.includes('id="cv-upload-dropzone"'), 'profile.html removed duplicated #cv-upload-dropzone');
assert(!profileHtmlContent.includes('Kéo thả CV của bạn vào đây'), 'profile.html removed duplicated CV dropzone text');

// 3. Profile removes duplicated system settings panel
assert(!profileHtmlContent.includes('Chế độ giao diện (Dark / Light)'), 'profile.html removed duplicated theme mode setting');
assert(!profileHtmlContent.includes('id="notification-toggle"'), 'profile.html removed duplicated notification toggle');

// 4. Profile removes duplicated full billing/pricing tables
assert(!profileHtmlContent.includes('id="plan-card-bg"'), 'profile.html removed duplicated subscription plan card');
assert(!profileHtmlContent.includes('id="payment-history"'), 'profile.html removed duplicated payment history table');

// 5. Profile exposes Account Hub navigation cards
assert(profileHtmlContent.includes('id="account-hubs"'), 'profile.html includes Account Hub section');
assert(profileHtmlContent.includes('href="cv.html"'), 'profile.html links to cv.html in hub');
assert(profileHtmlContent.includes('href="settings.html"'), 'profile.html links to settings.html in hub');
assert(profileHtmlContent.includes('href="../payment/pricing.html"'), 'profile.html links to pricing.html in hub');

// 6. Hash redirects for backwards compatibility
assert(profileHtmlContent.includes("window.location.replace('cv.html')"), 'profile.html redirects #cv to cv.html');
assert(profileHtmlContent.includes("window.location.replace('settings.html')"), 'profile.html redirects #system-settings to settings.html');
assert(profileHtmlContent.includes("window.location.replace('../payment/pricing.html')"), 'profile.html redirects #billing to pricing.html');

console.log('[PASS] Suite 3: Profile De-monolith & Account Center verified.');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 4: CV -> Interview Bridge
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 4: CV -> Interview Bridge ---');

// 1. cv.html has primary CTA
assert(cvHtmlContent.includes('id="btn-practice-cv"') || cvHtmlContent.includes('startInterviewFromCv()'), 'cv.html has primary CTA button to start interview');
assert(cvHtmlContent.includes('Luyện tập phỏng vấn theo CV này'), 'cv.html has canonical CTA text "Luyện tập phỏng vấn theo CV này"');

// 2. startInterviewFromCv function preserves CV context
assert(cvHtmlContent.includes('function startInterviewFromCv()'), 'cv.html defines startInterviewFromCv()');
assert(cvHtmlContent.includes('prepmate_interview_source'), 'cv.html stores interview source context');
assert(cvHtmlContent.includes('interview-info.html?source=cv'), 'cv.html navigates to interview setup with source=cv');

// 3. interview-info.html handles source=cv
assert(interviewInfoHtmlContent.includes("sourceParam === 'cv'") || interviewInfoHtmlContent.includes("urlParams.get('source') === 'cv'"), 'interview-info.html checks source=cv');
assert(interviewInfoHtmlContent.includes("switchContextTab('cv')"), 'interview-info.html auto-switches to CV context tab');
assert(interviewInfoHtmlContent.includes('setup-context-banner'), 'interview-info.html has setup-context-banner');

console.log('[PASS] Suite 4: CV -> Interview Bridge verified.');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 5: QBank -> Interview Bridge
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 5: QBank -> Interview Bridge ---');

assert(interviewInfoHtmlContent.includes('topicParam'), 'interview-info.html reads topic query param');
assert(interviewInfoHtmlContent.includes('Ngân hàng câu hỏi'), 'interview-info.html indicates QBank context in banner');
assert(interviewInfoHtmlContent.includes('user-description'), 'interview-info.html binds topic to description');

console.log('[PASS] Suite 5: QBank -> Interview Bridge verified.');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 6: Report -> Re-practice Bridge
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 6: Report -> Re-practice Bridge ---');

// 1. report.html has Re-practice action
assert(reportHtmlContent.includes('repracticeCurrentSession()'), 'report.html calls repracticeCurrentSession()');
assert(reportHtmlContent.includes('Luyện tập lại'), 'report.html displays "Luyện tập lại" button');

// 2. report.js defines repracticeCurrentSession()
assert(reportJsContent.includes('function repracticeCurrentSession()'), 'report.js defines repracticeCurrentSession()');
assert(reportJsContent.includes('prepmate_repractice_config'), 'report.js serializes setup configuration');
assert(reportJsContent.includes('interview-info.html?from=repractice'), 'report.js navigates to setup with from=repractice');

// 3. interview-info.html receives repractice config
assert(interviewInfoHtmlContent.includes('fromParam === \'repractice\'') || interviewInfoHtmlContent.includes('prepmate_repractice_config'), 'interview-info.html reads repractice config');
assert(interviewInfoHtmlContent.includes('Luyện tập lại:'), 'interview-info.html confirms repractice banner message');

console.log('[PASS] Suite 6: Report -> Re-practice Bridge verified.');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 7: Dedicated History Surface & Dashboard History Preview
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 7: Dedicated History Surface & Dashboard ---');

// 1. history.html exists
assert(fs.existsSync(historyHtmlPath), 'FE/features/interview/history.html exists');
const historyHtmlContent = fs.readFileSync(historyHtmlPath, 'utf8');

// 2. history.html has required elements
assert(historyHtmlContent.includes('hist-search-input'), 'history.html has search input');
assert(historyHtmlContent.includes('hist-status-filter'), 'history.html has status filter');
assert(historyHtmlContent.includes('hist-level-filter'), 'history.html has level filter');
assert(historyHtmlContent.includes('hist-total-count'), 'history.html has total sessions metric');
assert(historyHtmlContent.includes('repracticeFromHistory'), 'history.html provides re-practice action');
assert(historyHtmlContent.includes('report.html'), 'history.html links to evaluation report');

// 3. dashboard.html has history anchor and link to history.html
assert(dashboardHtmlContent.includes('id="history"'), 'dashboard.html preserves #history id for backward compatibility');
assert(dashboardHtmlContent.includes('../interview/history.html'), 'dashboard.html links to dedicated history.html');

// 4. dashboard.js slices recent 5 sessions and adds view all link
assert(dashboardJsContent.includes('slice(0, 5)'), 'dashboard.js slices recent 5 sessions');
assert(dashboardJsContent.includes('../interview/history.html'), 'dashboard.js appends view all history link');

console.log('[PASS] Suite 7: Dedicated History Surface & Dashboard verified.');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 8: Payment Focused Checkout Shell
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 8: Payment Focused Checkout Shell ---');

// 1. payment.html does NOT contain sidebar
assert(!paymentHtmlContent.includes('id="main-sidebar"'), 'payment.html has removed #main-sidebar');
assert(!paymentHtmlContent.includes('sidebar-new'), 'payment.html has removed .sidebar-new');
assert(paymentHtmlContent.includes('class="checkout-body"'), 'payment.html uses focused .checkout-body class');

// 2. payment.html has steps indicator
assert(paymentHtmlContent.includes('checkout-steps'), 'payment.html renders checkout-steps indicator');
assert(paymentHtmlContent.includes('Chọn gói') && paymentHtmlContent.includes('Thanh toán'), 'payment.html indicates checkout steps');

// 3. payment.html has clear return link to pricing
assert(paymentHtmlContent.includes('href="./pricing.html"') && paymentHtmlContent.includes('Quay lại bảng giá'), 'payment.html has return link to pricing.html');

console.log('[PASS] Suite 8: Payment Focused Checkout Shell verified.');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 9: 404 Surface
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 9: 404 Surface ---');

// 1. 404.html exists in FE root
assert(fs.existsSync(notFoundHtmlPath), 'FE/404.html exists');
const notFoundHtmlContent = fs.readFileSync(notFoundHtmlPath, 'utf8');

// 2. 404.html uses public shell
assert(notFoundHtmlContent.includes('<app-header></app-header>'), '404.html includes canonical <app-header>');
assert(notFoundHtmlContent.includes('<app-footer></app-footer>'), '404.html includes canonical <app-footer>');

// 3. 404.html provides clear recovery CTAs
assert(notFoundHtmlContent.includes('href="index.html"') && notFoundHtmlContent.includes('Về trang chủ'), '404.html has "Về trang chủ" CTA');
assert(notFoundHtmlContent.includes('href="features/auth/auth.html"') && notFoundHtmlContent.includes('Đăng nhập'), '404.html has "Đăng nhập" CTA');
assert(notFoundHtmlContent.includes('Trang bạn tìm không tồn tại hoặc đã được di chuyển'), '404.html has professional error message');

console.log('[PASS] Suite 9: 404 Surface verified.');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 10: Navigation Matrix Cross-Links
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 10: Navigation Matrix Cross-Links ---');

const navMatrix = [
    { from: 'Dashboard', to: 'Interview', file: dashboardHtmlContent, target: 'interview-info.html' },
    { from: 'Dashboard', to: 'History', file: dashboardHtmlContent, target: 'history.html' },
    { from: 'CV', to: 'Interview', file: cvHtmlContent, target: 'interview-info.html' },
    { from: 'Report', to: 'Re-practice', file: reportJsContent, target: 'interview-info.html' },
    { from: 'Payment', to: 'Pricing', file: paymentHtmlContent, target: 'pricing.html' },
    { from: '404', to: 'Landing', file: notFoundHtmlContent, target: 'index.html' },
];

navMatrix.forEach(entry => {
    assert(entry.file.includes(entry.target), `Navigation from ${entry.from} to ${entry.to} (${entry.target}) exists`);
});

console.log('[PASS] Suite 10: Navigation Matrix Cross-Links verified.');

console.log('\n===============================================================');
console.log('   ALL P1.4-B IA & NAVIGATION TESTS PASSED (10/10 SUITES)       ');
console.log('===============================================================');
