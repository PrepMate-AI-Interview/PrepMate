/**
 * ==============================================================================
 * TEST SUITE: P1.3 WAVE B — EVALUATION & PRESENTATION LAYER REMEDIATION
 * File: FE/features/interview/test_p13_presentation.js
 * 
 * Verifies that all presentation layers (Report, Progress, Dashboard, Profile,
 * CV, Jobs, QBank, Admin, Landing Page) reflect a multi-disciplinary interview
 * platform while strictly preserving deep technical evaluation for SWE roles.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { resolvePath } = require('../helpers/test-env');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  [PASS] ${message}`);
    } else {
        failedTests++;
        console.error(`  [FAIL] ${message}`);
    }
}

console.log('════════════════════════════════════════════════════════════════');
console.log(' RUNNING P1.3 WAVE B PRESENTATION LAYER VERIFICATION SUITE');
console.log('════════════════════════════════════════════════════════════════\n');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 1: Report Domain Knowledge Dynamic Mapping & Neutralization
// ──────────────────────────────────────────────────────────────────────────────
console.log('--- Suite 1: Report Domain Knowledge Dynamic Mapping (report.js) ---');
const reportJsPath = resolvePath('FE/features/report/report.js');
const reportJsContent = fs.readFileSync(reportJsPath, 'utf8');

// Load function definitions in isolated scope with mock DOM
const vm = require('vm');
const reportContext = {
    document: {
        addEventListener: () => {},
        getElementById: () => ({ innerHTML: '', textContent: '', style: {}, classList: { add() {}, remove() {}, contains() { return false; } } }),
        querySelector: () => null,
        querySelectorAll: () => []
    },
    window: {
        location: { search: '' }
    },
    localStorage: {
        getItem: () => null,
        setItem: () => {}
    },
    console: console
};
vm.runInNewContext(reportJsContent + '\nthis.getDomainKnowledgeLabel = getDomainKnowledgeLabel;\nthis.getDomainKnowledgeIcon = getDomainKnowledgeIcon;', reportContext);

const getLabel = reportContext.getDomainKnowledgeLabel;
const getIcon = reportContext.getDomainKnowledgeIcon;

assert(typeof getLabel === 'function', 'getDomainKnowledgeLabel is defined and exported/accessible');
assert(getLabel('Software Engineer') === 'Kiến thức Kỹ thuật', 'SWE returns "Kiến thức Kỹ thuật"');
assert(getLabel('Lead Backend Engineer') === 'Kiến thức Kỹ thuật', 'Backend Engineer returns "Kiến thức Kỹ thuật"');
assert(getLabel('Frontend Developer') === 'Kiến thức Kỹ thuật', 'Frontend Dev returns "Kiến thức Kỹ thuật"');
assert(getLabel('DevOps Cloud Engineer') === 'Kiến thức Kỹ thuật', 'DevOps returns "Kiến thức Kỹ thuật"');
assert(getLabel('Marketing Manager') === 'Năng lực Marketing', 'Marketing Manager returns "Năng lực Marketing"');
assert(getLabel('Chuyên viên Digital Growth Marketer') === 'Năng lực Marketing', 'Growth Marketer returns "Năng lực Marketing"');
assert(getLabel('Financial Analyst') === 'Năng lực Tài chính', 'Financial Analyst returns "Năng lực Tài chính"');
assert(getLabel('Kế toán tổng hợp') === 'Năng lực Tài chính', 'Accountant returns "Năng lực Tài chính"');
assert(getLabel('Business Analyst') === 'Năng lực Phân tích Nghiệp vụ', 'Business Analyst returns "Năng lực Phân tích Nghiệp vụ"');
assert(getLabel('Chuyên viên Phân tích Nghiệp vụ') === 'Năng lực Phân tích Nghiệp vụ', 'Chuyên viên Phân tích Nghiệp vụ returns "Năng lực Phân tích Nghiệp vụ"');
assert(getLabel('Product Owner') === 'Năng lực Quản lý Dự án', 'Product Owner returns "Năng lực Quản lý Dự án"');
assert(getLabel('HR Specialist') === 'Năng lực Nhân sự', 'HR Specialist returns "Năng lực Nhân sự"');
assert(getLabel('Chuyên viên Tuyển dụng Nhân sự') === 'Năng lực Nhân sự', 'Recruiter returns "Năng lực Nhân sự"');
assert(getLabel('B2B Account Executive') === 'Năng lực Bán hàng', 'B2B AE returns "Năng lực Bán hàng"');
assert(getLabel('Supply Chain & Operations Lead') === 'Năng lực Vận hành', 'Supply Chain returns "Năng lực Vận hành"');
assert(getLabel('Product Designer UI/UX') === 'Năng lực Thiết kế', 'UI/UX returns "Năng lực Thiết kế"');
assert(getLabel('Chuyên viên Dự án') === 'Năng lực Quản lý Dự án', 'Project specialist returns "Năng lực Quản lý Dự án"');
assert(getLabel('Data Scientist') === 'Năng lực Dữ liệu & AI', 'Data Scientist returns "Năng lực Dữ liệu & AI"');
assert(getLabel('') === 'Năng lực Chuyên môn', 'Empty targetPosition defaults gracefully to "Năng lực Chuyên môn"');
assert(getLabel(null) === 'Năng lực Chuyên môn', 'Null targetPosition defaults gracefully to "Năng lực Chuyên môn"');

assert(getIcon('Software Engineer') === '💻', 'SWE icon is 💻');
assert(getIcon('Marketing Specialist') === '📢', 'Marketing icon is 📢');
assert(getIcon('Financial Analyst') === '📈', 'Finance icon is 📈');
assert(getIcon('Business Analyst') === '📊', 'BA icon is 📊');
assert(getIcon('HRBP') === '👥', 'HR icon is 👥');
assert(getIcon('General') === '💼', 'General icon is 💼');

assert(!reportJsContent.includes("'Doanh nghiệp Tech'"), 'report.js does not contain hardcoded "Doanh nghiệp Tech"');
assert(!reportJsContent.includes('"Doanh nghiệp Tech"'), 'report.js does not contain string "Doanh nghiệp Tech"');

const reportHtmlPath = resolvePath('FE/features/report/report.html');
const reportHtmlContent = fs.readFileSync(reportHtmlPath, 'utf8');
assert(!reportHtmlContent.includes('Chuyên viên Kỹ thuật'), 'report.html does not hardcode "Chuyên viên Kỹ thuật"');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 2: Progress Page Neutralization (progress.html)
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 2: Progress Neutralization (progress.html) ---');
const progressHtmlPath = resolvePath('FE/features/progress/progress.html');
const progressHtmlContent = fs.readFileSync(progressHtmlPath, 'utf8');

assert(progressHtmlContent.includes('getProgressDomainLabel'), 'progress.html contains getProgressDomainLabel function');
assert(progressHtmlContent.includes("'Kỹ thuật'"), 'progress.html radar chart supports "Kỹ thuật" for SWE');
assert(progressHtmlContent.includes("'Marketing'"), 'progress.html radar chart supports "Marketing"');
assert(progressHtmlContent.includes("'Tài chính'"), 'progress.html radar chart supports "Tài chính"');
assert(progressHtmlContent.includes("'Phân tích Nghiệp vụ'"), 'progress.html radar chart supports "Phân tích Nghiệp vụ"');
assert(progressHtmlContent.includes("'Chuyên môn'"), 'progress.html radar chart defaults to "Chuyên môn"');
assert(!progressHtmlContent.includes('giải pháp kỹ thuật'), 'progress.html improvements cards do not bias with "giải pháp kỹ thuật"');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 3: Dashboard Neutralization (dashboard.js & dashboard.html)
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 3: Dashboard Neutralization (dashboard.js & dashboard.html) ---');
const dashJsPath = resolvePath('FE/features/dashboard/dashboard.js');
const dashJsContent = fs.readFileSync(dashJsPath, 'utf8');
const dashHtmlPath = resolvePath('FE/features/dashboard/dashboard.html');
const dashHtmlContent = fs.readFileSync(dashHtmlPath, 'utf8');

assert(!dashJsContent.includes("'Doanh nghiệp Tech'"), 'dashboard.js does not fallback to "Doanh nghiệp Tech"');
assert(dashJsContent.includes('năng lực chuyên môn'), 'dashboard.js features mention neutral "năng lực chuyên môn"');
assert(dashJsContent.includes('Marketing') && dashJsContent.includes('Tài chính'), 'dashboard.js features represent diverse roles');
assert(dashHtmlContent.includes('Chuyên môn'), 'dashboard.html readiness card uses "Chuyên môn"');
assert(!dashHtmlContent.includes('#Concurrency'), 'dashboard.html readiness card replaced SWE hashtag #Concurrency');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 4: Profile & CV Neutralization (profile.html & cv.html)
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 4: Profile & CV Neutralization (profile.html & cv.html) ---');
const profileHtmlPath = resolvePath('FE/features/profile/profile.html');
const profileHtmlContent = fs.readFileSync(profileHtmlPath, 'utf8');
const cvHtmlPath = resolvePath('FE/features/profile/cv.html');
const cvHtmlContent = fs.readFileSync(cvHtmlPath, 'utf8');

assert(profileHtmlContent.includes('Marketing Manager, Financial Analyst, Software Engineer'), 'profile.html placeholder illustrates diverse roles');
assert(cvHtmlContent.includes('Chuyên môn cốt lõi'), 'cv.html demo card uses "Chuyên môn cốt lõi"');
assert(cvHtmlContent.includes('kế hoạch chiến lược') || cvHtmlContent.includes('Phân tích dữ liệu'), 'cv.html skills include diverse capabilities');
assert(!cvHtmlContent.includes('React bundle size'), 'cv.html predicted questions do not force React bundle size on generic demo card');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 5: Jobs Catalog & Database Diversity (jobs.html)
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 5: Jobs Catalog & Database Diversity (jobs.html) ---');
const jobsHtmlPath = resolvePath('FE/features/jobs/jobs.html');
const jobsHtmlContent = fs.readFileSync(jobsHtmlPath, 'utf8');

assert(jobsHtmlContent.includes('Senior Business Analyst'), 'jobs.html contains Business Analyst job posting');
assert(jobsHtmlContent.includes('Financial Planning & Analysis'), 'jobs.html contains FP&A job posting');
assert(jobsHtmlContent.includes('B2B Enterprise Account Executive'), 'jobs.html contains Sales AE job posting');
assert(jobsHtmlContent.includes('HR Business Partner'), 'jobs.html contains HRBP job posting');
assert(jobsHtmlContent.includes('Supply Chain & Operations Specialist'), 'jobs.html contains Supply Chain job posting');

assert(jobsHtmlContent.includes('value="business"'), 'jobs.html includes business analysis category filter');
assert(jobsHtmlContent.includes('value="finance"'), 'jobs.html includes finance category filter');
assert(jobsHtmlContent.includes('value="marketing"'), 'jobs.html includes marketing category filter');
assert(jobsHtmlContent.includes('value="sales"'), 'jobs.html includes sales category filter');
assert(jobsHtmlContent.includes('value="hr"'), 'jobs.html includes hr category filter');
assert(jobsHtmlContent.includes('value="operations"'), 'jobs.html includes operations category filter');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 6: QBank & Admin Placeholders (qbank.html & admin.html)
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 6: QBank & Admin Placeholders (qbank.html & admin.html) ---');
const qbankHtmlPath = resolvePath('FE/features/qbank/qbank.html');
const qbankHtmlContent = fs.readFileSync(qbankHtmlPath, 'utf8');
const adminHtmlPath = resolvePath('FE/features/admin/admin.html');
const adminHtmlContent = fs.readFileSync(adminHtmlPath, 'utf8');

assert(qbankHtmlContent.includes('placeholder="Tìm theo câu hỏi, vị trí, kỹ năng hoặc chủ đề..."'), 'qbank.html search placeholder is profession-neutral');
assert(adminHtmlContent.includes('placeholder="Ví dụ: Business Analyst, Financial Analyst, Software Engineer..."'), 'admin.html question role placeholder is multi-disciplinary');
// Verify authentic SWE questions in QBank & Admin were preserved
assert(qbankHtmlContent.includes('Q-101') || qbankHtmlContent.includes('Deadlock'), 'qbank.html preserved technical interview questions');
assert(adminHtmlContent.includes('Backend Developer') && adminHtmlContent.includes('Concurrency'), 'admin.html preserved authentic technical question data');

// ──────────────────────────────────────────────────────────────────────────────
// SUITE 7: Landing Page Neutralization (index.html)
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 7: Landing Page Neutralization (index.html) ---');
const indexHtmlPath = resolvePath('FE/index.html');
const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

assert(indexHtmlContent.includes('Đa ngành nghề: Tech, BA, Tài chính, Marketing...'), 'index.html hero trust bar highlights multi-industry support');
assert(indexHtmlContent.includes('Business Analyst • Marketing • Software Engineer'), 'index.html Step 1 visual illustrates diverse target positions');
assert(indexHtmlContent.includes('Unilever, Vietcombank, FPT Software, MoMo'), 'index.html Step 1 visual features diverse enterprise examples');
assert(indexHtmlContent.includes('Năng lực Chuyên môn'), 'index.html Step 4 scorecard uses "Năng lực Chuyên môn"');
assert(indexHtmlContent.includes('chi tiết chuyên môn hoặc thử thách khả năng chịu áp lực'), 'index.html Step 3 description uses neutral phrasing');

// ──────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════════════════');
console.log(` RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
console.log('════════════════════════════════════════════════════════════════');

if (failedTests > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
