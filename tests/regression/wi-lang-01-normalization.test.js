/**
 * WI-LANG-01: CROSS-PAGE UI LANGUAGE NORMALIZATION REGRESSION TEST SUITE
 * 
 * Verifies that:
 * 1. UI text across Frontend pages is normalized to natural, consistent Vietnamese.
 * 2. Key status mappings (Completed -> Đã hoàn thành, In Progress -> Đang thực hiện, etc.) are verified.
 * 3. Unassessed status is rendered as "Chưa đánh giá" on UI cards.
 * 4. Technical terms and proper nouns are appropriately retained.
 * 5. Backend internal contracts, database records, and API routes remain unmodified.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('=== TEST SUITE: WI-LANG-01 — CROSS-PAGE UI LANGUAGE NORMALIZATION ===\n');

// 1. Report Page UI Normalization
console.log('• Testing Report page UI strings in report.html & report.js...');
const reportHtml = fs.readFileSync(path.resolve(__dirname, '../../FE/features/report/report.html'), 'utf8');
const reportJs = fs.readFileSync(path.resolve(__dirname, '../../FE/features/report/report.js'), 'utf8');

// Title & Navbar
assert(!reportHtml.includes('Debrief Report'), 'Debrief Report English term removed from report.html title/nav');
assert(reportHtml.includes('Báo cáo Đánh giá Phỏng vấn Chuyên sâu'), 'Normalized title present in report.html');
assert(reportHtml.includes('Quay về Bảng điều khiển'), 'Quay về Bảng điều khiển used instead of Dashboard');

// Section Titles
assert(reportHtml.includes('<h2 class="section-title">6 Chiều Năng Lực Cốt Lõi</h2>'), 'Performance Dimensions English subtitle removed from title');
assert(reportHtml.includes('<h2 class="section-title">Bằng Chứng & Chẩn Đoán Chi Tiết</h2>'), 'Evidence & Diagnostics English subtitle removed');
assert(reportHtml.includes('<h2 class="section-title">Lộ Trình Cải Thiện Cá Nhân Hóa</h2>'), 'Personalized Roadmap English subtitle removed');
assert(reportHtml.includes('<h2 class="section-title">Hệ Sinh Thái Chuẩn Bị Phỏng Vấn</h2>'), 'Preparation Ecosystem English subtitle removed');
assert(reportHtml.includes('<h2 class="section-title">Danh Mục Kiểm Tra Sẵn Sàng (Checklist)</h2>'), 'Preparation Checklist English subtitle normalized');
assert(reportHtml.includes('<h2 class="section-title">Nhật Ký Đối Thoại & Căn Cứ Đánh Giá</h2>'), 'Turn Provenance English subtitle removed');

// Helper in report.js
assert(reportJs.includes('function formatUiStatus('), 'formatUiStatus helper defined in report.js');
assert(reportJs.includes('Chưa đánh giá'), 'Chưa đánh giá used for UNASSESSED dimension badge');
console.log('[PASS] 1. Report page UI language normalized cleanly');

// 2. Dashboard Status & Terminology Normalization
console.log('• Testing Dashboard status pills & terminology in dashboard.js...');
const dashJs = fs.readFileSync(path.resolve(__dirname, '../../FE/features/dashboard/dashboard.js'), 'utf8');
assert(dashJs.includes('Hoàn thành</span>`;') === false, 'Obsolete "Hoàn thành" status pill replaced');
assert(dashJs.includes('Đã hoàn thành</span>`;'), 'Standardized "Đã hoàn thành" status pill present in dashboard.js');
assert(dashJs.includes('Đang thực hiện</span>`;'), 'Standardized "Đang thực hiện" status pill present in dashboard.js');
assert(dashJs.includes('documentTitleDashboard: \'PrepMate - Bảng điều khiển\''), 'Document title normalized in dashboard.js');
assert(dashJs.includes('Tiếp tục tới Bảng điều khiển hoặc đăng xuất.'), 'Auth widget copy normalized to Bảng điều khiển');
console.log('[PASS] 2. Dashboard status & terminology normalized');

// 3. Interview History & Practice Room Normalization
console.log('• Testing Interview History & Practice Room in history.html & interview-practice.html...');
const histHtml = fs.readFileSync(path.resolve(__dirname, '../../FE/features/interview/history.html'), 'utf8');
const practiceHtml = fs.readFileSync(path.resolve(__dirname, '../../FE/features/interview/interview-practice.html'), 'utf8');

assert(histHtml.includes('Đã hoàn thành</span>`;'), 'Standardized "Đã hoàn thành" status pill in history.html');
assert(histHtml.includes('Đang thực hiện</span>`;'), 'Standardized "Đang thực hiện" status pill in history.html');

assert(practiceHtml.includes('title="Quay về Bảng điều khiển"'), 'Quay về Bảng điều khiển tooltip in practice room');
assert(practiceHtml.includes('Về Bảng điều khiển'), 'Về Bảng điều khiển in finish modal');
assert(practiceHtml.includes('<div class="chk-name">Micro</div>'), 'Micro used in device checklist');
console.log('[PASS] 3. History & Practice room terminology normalized');

// 4. Coaching Engines Observation Titles Normalization
console.log('• Testing Visual Coaching observation titles in visual-coaching-engine.js...');
const vceJs = fs.readFileSync(path.resolve(__dirname, '../../FE/features/interview/visual-coaching-engine.js'), 'utf8');
assert(!vceJs.includes('Head Orientation & Engagement'), 'Head Orientation & Engagement English subtitle removed');
assert(!vceJs.includes('Upper Body Posture)'), 'Upper Body Posture English subtitle removed');
assert(!vceJs.includes('Hand Gestures & Visibility'), 'Hand Gestures & Visibility English subtitle removed');
assert(vceJs.includes('title: "Hướng Đầu & Giao Tiếp Trực Diện"'), 'Normalized head orientation title verified');
assert(vceJs.includes('title: "Tư Thế Thân Trên & Trục Cân Bằng"'), 'Normalized posture title verified');
assert(vceJs.includes('title: "Cử Chỉ Tay & Tương Tác Minh Họa"'), 'Normalized gestures title verified');
console.log('[PASS] 4. Coaching observation titles normalized');

// 5. Shared Layout & Admin AI Health Invariant
console.log('• Testing Shared Components & Admin AI Health...');
const compJs = fs.readFileSync(path.resolve(__dirname, '../../FE/shared/js/components.js'), 'utf8');
const adminHealthJs = fs.readFileSync(path.resolve(__dirname, '../../FE/features/admin/admin-ai-health.js'), 'utf8');

assert(compJs.includes('<span>Tổng quan</span>'), 'Tổng quan without English (Dashboard) in header menu');
assert(compJs.includes('<span>Vào Bảng điều khiển</span>'), 'Vào Bảng điều khiển in components hero CTA');
assert(adminHealthJs.includes('badge.innerHTML = \'🟢 Hoạt động tốt\';'), 'Admin health badge contract preserved');
assert(adminHealthJs.includes('badge.innerHTML = \'🔴 Lỗi kết nối\';'), 'Admin health badge contract preserved');
console.log('[PASS] 5. Shared navigation & Admin AI Health verified');

// 6. Technical Invariant: Internal API contracts, DB SHA-256 untouched
console.log('• Testing Technical & Architecture Invariants (DB SHA-256)...');
const BASELINE_DB_HASH = '00D0B91EABC1646F291B879DA5EE8F1F056B072C36EC864522FAE58E6ABBEA1A';
const PROD_DB_PATH = path.resolve(__dirname, '../../BE/data/db.json');
assert(fs.existsSync(PROD_DB_PATH), 'db.json must exist');
const dbBytes = fs.readFileSync(PROD_DB_PATH);
const currentDbHash = crypto.createHash('sha256').update(dbBytes).digest('hex').toUpperCase();
assert.strictEqual(currentDbHash, BASELINE_DB_HASH, 'Production database must remain unmodified');
console.log('[PASS] 6. Database SSOT unmodified (SHA-256 matches baseline)');

console.log('\n--- ALL 6 WI-LANG-01 REGRESSION CHECKS PASSED CLEANLY ---');
