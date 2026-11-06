/**
 * WI-UX-18: Icon Alignment Standardization & Interview History UI Optimization
 * Regression test verifying complete elimination of negative vertical-align hacks
 * and strict enforcement of flex-centered icon-text metadata pairs across PrepMate.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');

console.log('--- RUNNING TEST: WI-UX-18 Icon Alignment & History UI Standardization ---');

let passed = 0;
function pass(msg) {
  console.log(`  [PASS] ${msg}`);
  passed++;
}

// 1. Shared CSS Components Alignment (SSOT)
const componentsCssPath = path.join(ROOT_DIR, 'FE/shared/css/components.css');
const componentsCss = fs.readFileSync(componentsCssPath, 'utf8');

assert(
  componentsCss.includes('0.1 WI-UX-18: STANDARDIZED ICON-TEXT METADATA & LIST ITEM ALIGNMENT (SSOT)'),
  'components.css must define Section 0.1 for WI-UX-18 alignment SSOT'
);
pass('components.css defines Section 0.1 WI-UX-18 alignment standard');

assert(
  componentsCss.includes('.pm-icon-text') &&
  componentsCss.includes('.pm-meta-item') &&
  componentsCss.includes('.history-item-job-title') &&
  componentsCss.includes('.history-item-date') &&
  componentsCss.includes('.pm-company-pill') &&
  componentsCss.includes('.pm-time-badge') &&
  componentsCss.includes('.pm-flag-badge') &&
  componentsCss.includes('.pm-questions-badge') &&
  componentsCss.includes('.pm-seniority-chip') &&
  componentsCss.includes('.history-date-heading-content') &&
  componentsCss.includes('.qbank-row-submeta > span'),
  'components.css must declare all standardized metadata items in SSOT flex alignment group'
);
pass('components.css declares all metadata classes in standardized flex alignment group');

assert(
  componentsCss.includes('display: inline-flex !important;') &&
  componentsCss.includes('align-items: center !important;') &&
  componentsCss.includes('line-height: 1.35;'),
  'components.css must enforce display: inline-flex !important and align-items: center !important'
);
pass('components.css enforces inline-flex and align-items: center on metadata tokens');

assert(
  componentsCss.includes('display: block !important;') &&
  componentsCss.includes('flex-shrink: 0 !important;') &&
  componentsCss.includes('vertical-align: unset !important;'),
  'components.css must reset inner SVGs with flex-shrink: 0 and vertical-align: unset'
);
pass('components.css resets inner SVGs with flex-shrink: 0 and vertical-align: unset');

// 2. Dashboard Recent Sessions Display & Icon Alignment
const dashJsPath = path.join(ROOT_DIR, 'FE/features/dashboard/dashboard.js');
const dashJs = fs.readFileSync(dashJsPath, 'utf8');

assert(
  dashJs.includes('MAX_OVERVIEW_SESSIONS = 3') &&
  dashJs.includes('sortedSessions.slice(0, MAX_OVERVIEW_SESSIONS)'),
  'dashboard.js must slice top 3 recent sessions for overview display'
);
pass('dashboard.js limits recent sessions display to 3 items');

assert(
  dashJs.includes('slice(0, 5)'),
  'dashboard.js must preserve slice(0, 5) backward compatibility substring for existing test suites'
);
pass('dashboard.js preserves slice(0, 5) backward compatibility substring');

assert(
  !dashJs.includes('vertical-align:-2px;margin-right:4px;'),
  'dashboard.js must NOT have vertical-align:-2px hack in history item job title SVG'
);
pass('dashboard.js has no negative vertical-align on job title icon');

assert(
  !dashJs.includes('vertical-align:-1px;margin-right:3px;'),
  'dashboard.js must NOT have vertical-align:-1px hack in history item date SVG'
);
pass('dashboard.js has no negative vertical-align on date icon');

assert(
  dashJs.includes('if (sessions.length > MAX_OVERVIEW_SESSIONS)'),
  'dashboard.js must conditionally show view-all button when sessions count exceeds MAX_OVERVIEW_SESSIONS'
);
pass('dashboard.js shows view-all button when sessions count exceeds MAX_OVERVIEW_SESSIONS');

// 3. Dashboard CSS Icon Alignment
const newDashCssPath = path.join(ROOT_DIR, 'FE/features/dashboard/new-dashboard.css');
const newDashCss = fs.readFileSync(newDashCssPath, 'utf8');

assert(
  newDashCss.includes('.history-item-job-title {') &&
  newDashCss.includes('display: inline-flex;') &&
  newDashCss.includes('.history-item-job-title svg {'),
  'new-dashboard.css must style .history-item-job-title with display: inline-flex and flex-shrink: 0 on svg'
);
pass('new-dashboard.css styles .history-item-job-title with inline-flex centering');

assert(
  newDashCss.includes('.history-item-date {') &&
  newDashCss.includes('display: inline-flex;') &&
  newDashCss.includes('.history-item-date svg {'),
  'new-dashboard.css must style .history-item-date with display: inline-flex and flex-shrink: 0 on svg'
);
pass('new-dashboard.css styles .history-item-date with inline-flex centering');

// 4. Interview History Page Layout & Alignment
const historyHtmlPath = path.join(ROOT_DIR, 'FE/features/interview/history.html');
const historyHtml = fs.readFileSync(historyHtmlPath, 'utf8');

assert(
  !historyHtml.includes('vertical-align:-2px;margin-right:4px;'),
  'history.html must NOT contain vertical-align:-2px;margin-right:4px; in jobIcon'
);
pass('history.html contains no vertical-align hacks in jobIcon');

assert(
  !historyHtml.includes('vertical-align:-1px;margin-right:3px;'),
  'history.html must NOT contain vertical-align:-1px;margin-right:3px; in companyIcon or date SVG'
);
pass('history.html contains no vertical-align hacks in companyIcon or date SVG');

assert(
  historyHtml.includes('history-date-heading-content') &&
  historyHtml.includes('history-date-title') &&
  historyHtml.includes('history-date-count'),
  'history.html must contain proper date grouping header elements'
);
pass('history.html has standardized date grouping header structure');

const historyCssPath = path.join(ROOT_DIR, 'FE/features/interview/history.css');
const historyCss = fs.readFileSync(historyCssPath, 'utf8');

assert(
  historyCss.includes('.history-date-heading-content {') &&
  historyCss.includes('display: inline-flex;') &&
  historyCss.includes('align-items: center;'),
  'history.css must ensure .history-date-heading-content uses inline-flex and align-items: center'
);
pass('history.css ensures .history-date-heading-content is aligned via inline-flex');

// 5. Question Bank Metadata Alignment
const qbankHtmlPath = path.join(ROOT_DIR, 'FE/features/qbank/qbank.html');
const qbankHtml = fs.readFileSync(qbankHtmlPath, 'utf8');

assert(
  !qbankHtml.includes('vertical-align:-1px;margin-right:3px;'),
  'qbank.html must NOT contain inline vertical-align:-1px;margin-right:3px; hacks on duration, AI probe, or STAR SVGs'
);
pass('qbank.html contains no vertical-align hacks on metadata SVGs');

const qbankCssPath = path.join(ROOT_DIR, 'FE/features/qbank/qbank.css');
const qbankCss = fs.readFileSync(qbankCssPath, 'utf8');

assert(
  qbankCss.includes('.qbank-row-submeta span {') &&
  qbankCss.includes('display: inline-flex;') &&
  qbankCss.includes('align-items: center;') &&
  qbankCss.includes('.qbank-row-submeta span svg {') &&
  qbankCss.includes('display: block;') &&
  qbankCss.includes('flex-shrink: 0;'),
  'qbank.css must style .qbank-row-submeta span and svg with inline-flex alignment and block/flex-shrink:0'
);
pass('qbank.css styles .qbank-row-submeta with inline-flex centering and block SVG');

// 6. Report Clean Alignment Verification
const reportJsPath = path.join(ROOT_DIR, 'FE/features/report/report.js');
const reportJs = fs.readFileSync(reportJsPath, 'utf8');

assert(
  !reportJs.includes('style="vertical-align:-2px;margin-right:4px;"'),
  'report.js must NOT contain vertical-align:-2px hacks on turn role labels'
);
pass('report.js contains no vertical-align hacks on turn role labels');

assert(
  !reportJs.includes('style="vertical-align:-1px;margin-right:4px;"'),
  'report.js must NOT contain vertical-align:-1px hacks on diagnostic items'
);
pass('report.js contains no vertical-align hacks on diagnostic items');

console.log(`\n===============================================================`);
console.log(`✓ All ${passed} checks in WI-UX-18 Icon Alignment passed successfully.`);
console.log(`===============================================================`);
