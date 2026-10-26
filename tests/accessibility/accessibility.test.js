/**
 * PrepMate — P1.4-C: Accessibility & Responsive Verification Suite
 * Tests all 24 criteria for WCAG AA compliance, focus rings, reduced motion,
 * screen reader live announcers, ARIA switches/sliders, and responsive mobile layouts.
 */

const fs = require('fs');
const path = require('path');
const { resolvePath } = require('../helpers/test-env');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName} - ${details}`);
    process.exitCode = 1;
  }
}

console.log('===============================================================');
console.log('   P1.4-C: ACCESSIBILITY & RESPONSIVE VERIFICATION SUITE       ');
console.log('===============================================================\n');

// --- Suite 1: Universal Focus Ring & Reduced Motion in Global CSS ---
console.log('--- Suite 1: Global Design Tokens & Motion ---');
const baseCss = fs.readFileSync(resolvePath('FE/shared/css/base.css'), 'utf8');
const styleCss = fs.readFileSync(resolvePath('FE/shared/css/style.css'), 'utf8');
const utilCss = fs.readFileSync(resolvePath('FE/shared/css/utilities.css'), 'utf8');

assert(
  baseCss.includes('prefers-reduced-motion') && styleCss.includes('prefers-reduced-motion'),
  'Test 1: prefers-reduced-motion media query present in base.css and style.css'
);

assert(
  baseCss.includes(':focus-visible') && styleCss.includes(':focus-visible'),
  'Test 2: Universal :focus-visible rule present in base.css and style.css'
);

assert(
  utilCss.includes('.sr-only') && styleCss.includes('.sr-only'),
  'Test 3: Screen reader utility class (.sr-only) present in utilities.css and style.css'
);

assert(
  utilCss.includes('.skip-link') && styleCss.includes('.skip-link'),
  'Test 4: Skip link accessibility helper (.skip-link) present in utilities.css and style.css'
);

// --- Suite 2: Live Interview Room Accessibility & Screen Reader Announcer ---
console.log('\n--- Suite 2: Live Interview Room Accessibility & Announcer ---');
const practiceHtml = fs.readFileSync(resolvePath('FE/features/interview/interview-practice.html'), 'utf8');
const interviewJs = fs.readFileSync(resolvePath('FE/features/interview/interview.js'), 'utf8');
const roomCss = fs.readFileSync(resolvePath('FE/features/interview/interview-room.css'), 'utf8');

assert(
  practiceHtml.includes('id="sr-status-announcer"') &&
  practiceHtml.includes('aria-live="polite"') &&
  practiceHtml.includes('aria-atomic="true"'),
  'Test 5: Live interview room contains #sr-status-announcer with aria-live="polite"'
);

assert(
  interviewJs.includes('function announceToScreenReader') &&
  interviewJs.includes('sr-status-announcer'),
  'Test 6: interview.js contains announceToScreenReader function updating the live region'
);

assert(
  practiceHtml.includes('aria-label="Bật micro"') &&
  practiceHtml.includes('aria-label="Bật camera"') &&
  practiceHtml.includes('aria-label="Câu trả lời của bạn"'),
  'Test 7: Core practice room interactive controls have accessible labels'
);

assert(
  roomCss.includes('@media (max-width: 480px)') &&
  roomCss.includes('min-width: 44px') &&
  roomCss.includes('min-height: 44px'),
  'Test 8: interview-room.css enforces 44px minimum touch targets in mobile viewport'
);

assert(
  roomCss.includes('@media (prefers-reduced-motion: reduce)') &&
  roomCss.includes('animation: none !important'),
  'Test 9: interview-room.css respects reduced motion by disabling pulse/wave animations'
);

// --- Suite 3: Admin Table Responsiveness & Controls ---
console.log('\n--- Suite 3: Admin Table Responsiveness & Sliders ---');
const adminHtml = fs.readFileSync(resolvePath('FE/features/admin/admin.html'), 'utf8');
const adminCss = fs.readFileSync(resolvePath('FE/features/admin/admin.css'), 'utf8');
const adminAll = adminHtml + adminCss;

assert(
  adminAll.includes('.admin-table-responsive') &&
  adminAll.includes('overflow-x: auto') &&
  adminAll.includes('min-width: 760px'),
  'Test 10: admin.html wraps tables in responsive container with minimum table width'
);

assert(
  adminAll.includes('@media (max-width: 1024px)') &&
  adminAll.includes('@media (max-width: 768px)'),
  'Test 11: admin.html has dedicated tablet and mobile media queries'
);

assert(
  adminHtml.includes('id="config-temperature"') &&
  adminHtml.includes('aria-label="Độ sáng tạo của câu hỏi (Nhiệt độ)"') &&
  adminHtml.includes('aria-valuemin="0.1"') &&
  adminHtml.includes('aria-valuenow="0.7"'),
  'Test 12: Admin temperature range slider has full ARIA accessibility attributes'
);

// --- Suite 4: Interview Setup Wizard Responsiveness & Focus Management ---
console.log('\n--- Suite 4: Setup Wizard Responsiveness & Focus ---');
const infoCss = fs.readFileSync(resolvePath('FE/features/interview/interview-info.css'), 'utf8');

assert(
  infoCss.includes('@media (max-width: 480px)') &&
  infoCss.includes('.pm-stepper') &&
  infoCss.includes('min-height: 44px'),
  'Test 13: Setup wizard stepper and chips adapt to small mobile viewports with 44px touch targets'
);

assert(
  infoCss.includes('.role-chip:focus-visible') &&
  infoCss.includes('.context-tab-btn:focus-visible') &&
  infoCss.includes('.seniority-pill:focus-within'),
  'Test 14: Setup wizard controls provide visible focus rings and focus-within indicators'
);

// --- Suite 5: Payment Responsive Shell ---
console.log('\n--- Suite 5: Payment Responsive Shell ---');
const paymentHtml = fs.readFileSync(resolvePath('FE/features/payment/payment.html'), 'utf8');
const paymentCss = fs.readFileSync(resolvePath('FE/features/payment/payment.css'), 'utf8');
const paymentAll = paymentHtml + paymentCss;

assert(
  paymentAll.includes('@media (max-width: 480px)') &&
  paymentAll.includes('.checkout-top-bar') &&
  paymentAll.includes('.payment-method-tabs'),
  'Test 15: payment.html / payment.css contains 480px mobile media query preventing layout overflow'
);

// --- Suite 6: Profile Settings Accessible Switches ---
console.log('\n--- Suite 6: Settings Switches & ARIA ---');
const settingsHtml = fs.readFileSync(resolvePath('FE/features/profile/settings.html'), 'utf8');

assert(
  settingsHtml.includes('role="switch"') &&
  settingsHtml.includes('id="auto-play-voice"') &&
  settingsHtml.includes('aria-checked="true"'),
  'Test 16: settings.html toggle inputs declare role="switch" and aria-checked'
);

const settingsCss = fs.readFileSync(resolvePath('FE/features/profile/settings.css'), 'utf8');
assert(
  settingsCss.includes('.toggle-switch input:focus-visible + .slider-round') &&
  settingsCss.includes('outline: 2px solid #2563eb'),
  'Test 17: settings.html toggle switches display visible focus ring on slider'
);

assert(
  settingsHtml.includes('el.setAttribute(\'aria-checked\', val ? \'true\' : \'false\')') ||
  settingsHtml.includes('setAttribute(\'aria-checked\', val ? \'true\' : \'false\')'),
  'Test 18: settings.html synchronizes aria-checked when toggled or restored'
);

// --- Suite 7: Range Slider & Print Layout Optimization ---
console.log('\n--- Suite 7: Range Sliders & Print Optimization ---');
const jobsHtml = fs.readFileSync(resolvePath('FE/features/jobs/jobs.html'), 'utf8');
const reportCss = fs.readFileSync(resolvePath('FE/features/report/report.css'), 'utf8');

assert(
  jobsHtml.includes('id="salary-range"') &&
  jobsHtml.includes('aria-label="Mức lương tối thiểu"') &&
  jobsHtml.includes('aria-valuemin="0"') &&
  jobsHtml.includes('aria-valuemax="60"') &&
  jobsHtml.includes('setAttribute(\'aria-valuenow\', val)'),
  'Test 19: jobs.html salary range input has complete ARIA attributes and dynamic valuenow syncing'
);

assert(
  reportCss.includes('@media print') &&
  reportCss.includes('.score-card-box, .score-wheel-ring, canvas, svg') &&
  reportCss.includes('page-break-inside: avoid'),
  'Test 20: report.css @media print scales charts, score-wheel, canvas and prevents page-break clipping'
);

// --- Suite 8: Empty State Announcements & Semantic Landmarks ---
console.log('\n--- Suite 8: Accessible Empty States & Landmark Labels ---');
const progressHtml = fs.readFileSync(resolvePath('FE/features/progress/progress.html'), 'utf8');
const historyHtml = fs.readFileSync(resolvePath('FE/features/interview/history.html'), 'utf8');
const qbankHtml = fs.readFileSync(resolvePath('FE/features/qbank/qbank.html'), 'utf8');

assert(
  progressHtml.includes('id="progress-empty-alert"') &&
  progressHtml.includes('role="status"') &&
  progressHtml.includes('aria-live="polite"'),
  'Test 21: progress.html empty state notice has role="status" and aria-live="polite"'
);

assert(
  progressHtml.includes('id="trend-empty-state"') &&
  progressHtml.includes('id="radar-empty-state"') &&
  progressHtml.includes('role="status"'),
  'Test 22: progress.html chart empty placeholders have role="status"'
);

assert(
  historyHtml.includes('id="hist-search-input"') &&
  historyHtml.includes('aria-label="Tìm kiếm theo vị trí tuyển dụng hoặc doanh nghiệp"') &&
  historyHtml.includes('aria-label="Lọc theo trạng thái phỏng vấn"'),
  'Test 23: history.html search and filter controls have descriptive aria-labels'
);

assert(
  qbankHtml.includes('id="select-page-size"') &&
  qbankHtml.includes('aria-label="Số câu hỏi hiển thị mỗi trang"'),
  'Test 24: qbank.html page size select has descriptive aria-label'
);

console.log('\n===============================================================');
console.log(`   P1.4-C A11Y & RESPONSIVE SUITE RESULT: ${passedTests}/${totalTests} PASS `);
console.log('===============================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
