/**
 * PrepMate — P1.4-C: Responsive Verification Test Suite
 * File: tests/responsive/responsive.test.js
 */

const fs = require('fs');
const path = require('path');

let testResults = {
  passed: 0,
  failed: 0,
  blocked: 0,
  notRun: 0,
  details: []
};

function recordTest(status, category, name, expected, actual) {
  if (status === 'PASS') {
    testResults.passed++;
    console.log(`[PASS] [${category}] ${name}`);
  } else if (status === 'FAIL') {
    testResults.failed++;
    console.error(`[FAIL] [${category}] ${name} | Expected: ${expected} | Actual: ${actual}`);
    process.exitCode = 1;
  } else if (status === 'BLOCKED') {
    testResults.blocked++;
    console.warn(`[BLOCKED] [${category}] ${name} | ${actual}`);
  } else {
    testResults.notRun++;
    console.warn(`[NOT RUN] [${category}] ${name}`);
  }
  testResults.details.push({ status, category, name, expected, actual });
}

console.log('===============================================================');
console.log('   P1.4-C: RESPONSIVE BREAKPOINT VERIFICATION SUITE            ');
console.log('===============================================================\n');

// Load target CSS and HTML surfaces
const { rootDir } = require('../helpers/test-env');
const files = {
  baseCss: fs.readFileSync(path.join(rootDir, 'FE/shared/css/base.css'), 'utf8'),
  styleCss: fs.readFileSync(path.join(rootDir, 'FE/shared/css/style.css'), 'utf8'),
  newDashboardCss: fs.readFileSync(path.join(rootDir, 'FE/features/dashboard/new-dashboard.css'), 'utf8'),
  interviewInfoCss: fs.readFileSync(path.join(rootDir, 'FE/features/interview/interview-info.css'), 'utf8'),
  interviewRoomCss: fs.readFileSync(path.join(rootDir, 'FE/features/interview/interview-room.css'), 'utf8'),
  reportCss: fs.readFileSync(path.join(rootDir, 'FE/features/report/report.css'), 'utf8'),
  adminHtml: fs.readFileSync(path.join(rootDir, 'FE/features/admin/admin.html'), 'utf8'),
  adminCss: fs.readFileSync(path.join(rootDir, 'FE/features/admin/admin.css'), 'utf8'),
  paymentHtml: fs.readFileSync(path.join(rootDir, 'FE/features/payment/payment.html'), 'utf8'),
  paymentCss: fs.readFileSync(path.join(rootDir, 'FE/features/payment/payment.css'), 'utf8'),
  interviewPracticeHtml: fs.readFileSync(path.join(rootDir, 'FE/features/interview/interview-practice.html'), 'utf8'),
  interviewInfoHtml: fs.readFileSync(path.join(rootDir, 'FE/features/interview/interview-info.html'), 'utf8'),
  historyHtml: fs.readFileSync(path.join(rootDir, 'FE/features/interview/history.html'), 'utf8'),
  historyCss: fs.readFileSync(path.join(rootDir, 'FE/features/interview/history.css'), 'utf8'),
  qbankHtml: fs.readFileSync(path.join(rootDir, 'FE/features/qbank/qbank.html'), 'utf8'),
  jobsHtml: fs.readFileSync(path.join(rootDir, 'FE/features/jobs/jobs.html'), 'utf8'),
  progressHtml: fs.readFileSync(path.join(rootDir, 'FE/features/progress/progress.html'), 'utf8')
};

// 1. BREAKPOINT: 1024px
console.log('--- Breakpoint 1: 1024px (Tablet Landscape) ---');
const adminAll = files.adminHtml + files.adminCss;
const paymentAll = files.paymentHtml + files.paymentCss;
const admin1024Match = adminAll.includes('@media (max-width: 1024px)') &&
  adminAll.includes('.main-content-new') &&
  adminAll.includes('.admin-top-header') &&
  adminAll.includes('flex-direction: column');
recordTest(admin1024Match ? 'PASS' : 'FAIL', '1024px', 'Admin console header stacks and contains controls', 'Media query at 1024px', admin1024Match ? 'Configured' : 'Missing');

const sidebar1024Match = files.newDashboardCss.includes('@media (max-width: 1024px)') &&
  files.newDashboardCss.includes('.sidebar-new { width: 220px; }') &&
  files.newDashboardCss.includes('.main-content-new { margin-left: 220px;');
recordTest(sidebar1024Match ? 'PASS' : 'FAIL', '1024px', 'Dashboard sidebar adapts width to 220px for tablet landscape', 'width: 220px', sidebar1024Match ? 'Applied' : 'Missing');

const room1024Match = files.interviewRoomCss.includes('@media (max-width: 1024px)') &&
  files.interviewRoomCss.includes('.ir-video-grid') &&
  files.interviewRoomCss.includes('grid-template-columns: 1fr;');
recordTest(room1024Match ? 'PASS' : 'FAIL', '1024px', 'Interview room video grid stacks cleanly without overflowing', 'grid-template-columns: 1fr', room1024Match ? 'Applied' : 'Missing');

// 2. BREAKPOINT: 834px & 768px
console.log('\n--- Breakpoint 2: 834px & 768px (Tablet Portrait) ---');
const adminTableContainment = adminAll.includes('.admin-table-responsive') &&
  adminAll.includes('overflow-x: auto;') &&
  adminAll.includes('max-width: 100%;') &&
  adminAll.includes('min-width: 760px;');
recordTest(adminTableContainment ? 'PASS' : 'FAIL', '834px / 768px', 'Admin table horizontal scroll container prevents viewport blowout', 'overflow-x: auto, min-width: 760px', adminTableContainment ? 'Verified' : 'Missing');

const sidebar768Match = files.newDashboardCss.includes('@media (max-width: 768px)') &&
  files.newDashboardCss.includes('.sidebar-new { display: none; }') &&
  files.newDashboardCss.includes('.main-content-new { margin-left: 0;');
recordTest(sidebar768Match ? 'PASS' : 'FAIL', '768px', 'Candidate sidebar hides to release full viewport for mobile content', 'display: none, margin-left: 0', sidebar768Match ? 'Verified' : 'Missing');

const room768Match = files.interviewRoomCss.includes('@media (max-width: 768px)') &&
  files.interviewRoomCss.includes('.ir-response-input-row') &&
  files.interviewRoomCss.includes('flex-direction: column;') &&
  files.interviewRoomCss.includes('width: 100%;');
recordTest(room768Match ? 'PASS' : 'FAIL', '768px', 'Interview console input and send button stack full width', 'flex-direction: column, width: 100%', room768Match ? 'Verified' : 'Missing');

const setup768Match = files.interviewInfoCss.includes('@media (max-width: 768px)') &&
  files.interviewInfoCss.includes('.seniority-selector-group') &&
  files.interviewInfoCss.includes('grid-template-columns: repeat(2, 1fr);');
recordTest(setup768Match ? 'PASS' : 'FAIL', '768px', 'Setup wizard seniority selection reflows to 2 columns', 'repeat(2, 1fr)', setup768Match ? 'Verified' : 'Missing');

const payment768Match = paymentAll.includes('@media (max-width: 768px)') &&
  paymentAll.includes('.checkout-steps') &&
  paymentAll.includes('.product-table-row') &&
  paymentAll.includes('grid-template-columns: 1fr;');
recordTest(payment768Match ? 'PASS' : 'FAIL', '768px', 'Payment checkout table stacks to single-column product rows', 'grid-template-columns: 1fr', payment768Match ? 'Verified' : 'Missing');

// 3. BREAKPOINT: 600px & 480px
console.log('\n--- Breakpoint 3: 600px & 480px (Mobile Boundary) ---');
const room600Match = files.interviewRoomCss.includes('@media (max-width: 600px)') &&
  files.interviewRoomCss.includes('.debrief-metrics-grid') &&
  files.interviewRoomCss.includes('.criteria-matrix-grid');
recordTest(room600Match ? 'PASS' : 'FAIL', '600px', 'Interview room debrief and criteria matrices adapt to mobile cards', '600px query present', room600Match ? 'Verified' : 'Missing');

const stepper480Match = files.interviewInfoCss.includes('@media (max-width: 480px)') &&
  files.interviewInfoCss.includes('.pm-stepper') &&
  files.interviewInfoCss.includes('flex-wrap: wrap;') &&
  files.interviewInfoCss.includes('width: 100%;');
recordTest(stepper480Match ? 'PASS' : 'FAIL', '480px', 'Setup wizard stepper wraps without clipping or viewport blowout', 'flex-wrap: wrap, width: 100%', stepper480Match ? 'Verified' : 'Missing');

const touchTarget480Match = files.interviewInfoCss.includes('@media (max-width: 480px)') &&
  files.interviewInfoCss.includes('.role-chip') &&
  files.interviewInfoCss.includes('min-height: 44px;');
recordTest(touchTarget480Match ? 'PASS' : 'FAIL', '480px', 'Setup role chips enforce 44px touch target height (WCAG 2.5.5/2.5.8)', 'min-height: 44px', touchTarget480Match ? 'Verified' : 'Missing');

const statusBar480Match = files.interviewRoomCss.includes('@media (max-width: 480px)') &&
  files.interviewRoomCss.includes('.ir-response-status-bar') &&
  files.interviewRoomCss.includes('flex-direction: column;') &&
  files.interviewRoomCss.includes('.ir-response-status-right');
recordTest(statusBar480Match ? 'PASS' : 'FAIL', '480px', 'Interview room response status bar stacks vertically', 'flex-direction: column', statusBar480Match ? 'Verified' : 'Missing');

const roomTileControls44px = files.interviewRoomCss.includes('@media (max-width: 480px)') &&
  files.interviewRoomCss.includes('.in-tile-icon-btn') &&
  files.interviewRoomCss.includes('min-width: 44px;') &&
  files.interviewRoomCss.includes('min-height: 44px;');
recordTest(roomTileControls44px ? 'PASS' : 'FAIL', '480px', 'Video tile floating controls maintain >= 44px touch targets', 'min-width/height: 44px', roomTileControls44px ? 'Verified' : 'Missing');

// 4. BREAKPOINT: 430px, 390px, 375px
console.log('\n--- Breakpoint 4: 430px, 390px, 375px (Mobile Viewports) ---');
const paymentMobileReflow = paymentAll.includes('@media (max-width: 480px)') &&
  paymentAll.includes('.checkout-top-bar') &&
  paymentAll.includes('.payment-method-tabs') &&
  paymentAll.includes('grid-template-columns: 1fr;');
recordTest(paymentMobileReflow ? 'PASS' : 'FAIL', '430px / 390px / 375px', 'Payment checkout top bar and method tabs stack for compact screens', 'Top bar column, tabs 1fr', paymentMobileReflow ? 'Verified' : 'Missing');

const adminPadding375 = adminAll.includes('@media (max-width: 480px)') &&
  adminAll.includes('padding: 16px 12px 32px !important;') &&
  adminAll.includes('.role-switch-container');
recordTest(adminPadding375 ? 'PASS' : 'FAIL', '430px / 390px / 375px', 'Admin console compact padding prevents viewport blowout down to 375px', 'padding: 16px 12px 32px', adminPadding375 ? 'Verified' : 'Missing');

const contextTab44px = files.interviewInfoCss.includes('@media (max-width: 480px)') &&
  files.interviewInfoCss.includes('.context-tab-btn') &&
  files.interviewInfoCss.includes('min-height: 44px;');
recordTest(contextTab44px ? 'PASS' : 'FAIL', '430px / 390px / 375px', 'Setup wizard context tab buttons enforce 44px height for touch access', 'min-height: 44px', contextTab44px ? 'Verified' : 'Missing');

const transcriptDrawerFullWidth = files.interviewRoomCss.includes('@media (max-width: 768px)') &&
  files.interviewRoomCss.includes('.ir-transcript-drawer') &&
  files.interviewRoomCss.includes('width: 100%;') &&
  files.interviewRoomCss.includes('max-width: 100%;');
recordTest(transcriptDrawerFullWidth ? 'PASS' : 'FAIL', '430px / 390px / 375px', 'Slide-over transcript drawer conforms to 100% width on mobile devices', 'width: 100%, max-width: 100%', transcriptDrawerFullWidth ? 'Verified' : 'Missing');

const reportChartResponsive = files.reportCss.includes('.overview-hero-card') &&
  files.reportCss.includes('grid-template-columns: 1fr;') &&
  files.reportCss.includes('.score-card-box');
recordTest(reportChartResponsive ? 'PASS' : 'FAIL', '430px / 390px / 375px', 'Report overview card stacks score card and radar cleanly for mobile', 'Card centered, responsive containment', reportChartResponsive ? 'Verified' : 'Missing');

const historyAll = files.historyHtml + files.historyCss;
const historyFilterBarResponsive = historyAll.includes('.history-filter-bar') &&
  historyAll.includes('flex-wrap: wrap;') &&
  historyAll.includes('min-width: 240px;');
recordTest(historyFilterBarResponsive ? 'PASS' : 'FAIL', '430px / 390px / 375px', 'History filter toolbar wraps search input and dropdown selects', 'flex-wrap: wrap', historyFilterBarResponsive ? 'Verified' : 'Missing');

console.log('\n===============================================================');
console.log('   P1.4-C RESPONSIVE VERIFICATION MATRIX SUMMARY               ');
console.log('===============================================================');
console.log(`TOTAL CHECKS  : ${testResults.details.length}`);
console.log(`PASS          : ${testResults.passed}`);
console.log(`FAIL          : ${testResults.failed}`);
console.log(`BLOCKED       : ${testResults.blocked}`);
console.log(`NOT RUN       : ${testResults.notRun}`);
console.log('===============================================================');

if (testResults.failed > 0) {
  process.exit(1);
}
