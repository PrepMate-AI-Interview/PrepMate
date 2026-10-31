/**
 * WI-LANG-02: FINAL UI LANGUAGE CLEANUP & REMEDIATION REGRESSION TEST SUITE
 * 
 * Verifies that:
 * 1. Design System Showcase breadcrumb uses "Bảng điều khiển".
 * 2. Interview Practice, Setup & Legal consistently use "Micro" / "micro" (no "Microphone" / "Mic").
 * 3. Report page section headers/descriptions have unnecessary English subtitles removed.
 * 4. Landing page and About have replaced "Debrief", "Turn Provenance", "Job Offer", "Speech-to-Speech" with natural Vietnamese.
 * 5. QBank uses "Kiến thức cốt lõi AI" and "AI hỏi đào sâu".
 * 6. Settings tooltips have removed "(Light Mode)" and "(Dark Mode)".
 * 7. History and Profile have unified experience level to "Trung cấp (Mid-level)" while keeping internal codes intact.
 * 8. Admin uses "Xóa khóa API đã lưu trong cơ sở dữ liệu".
 * 9. Progress displays "Chuỗi ngày luyện tập".
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { resolvePath, getBaselineDbHash } = require('../helpers/test-env');

console.log('=== TEST SUITE: WI-LANG-02 — FINAL UI LANGUAGE CLEANUP & REMEDIATION ===\n');

// 1. Design System Showcase
console.log('• Testing Design System Showcase in showcase.html...');
const showcaseHtml = fs.readFileSync(resolvePath('FE/features/design-system/showcase.html'), 'utf8');
assert(showcaseHtml.includes('>Bảng điều khiển</a>'), 'showcase.html uses "Bảng điều khiển" in navigation');
assert(!showcaseHtml.includes('>Dashboard</a>'), 'showcase.html has removed "Dashboard" from navigation');
console.log('[PASS] 1. Showcase navigation normalized');

// 2. Practice HUD, Setup & Legal: Micro Normalization
console.log('• Testing Micro normalization in practice HUD, setup wizard & legal center...');
const practiceHtml = fs.readFileSync(resolvePath('FE/features/interview/interview-practice.html'), 'utf8');
assert(practiceHtml.includes('>Micro:</label>'), 'practice room device label normalized to "Micro:"');
assert(!practiceHtml.includes('>Microphone:</label>'), 'practice room has removed "Microphone:"');
assert(practiceHtml.includes('Bật micro trên camera hoặc nhập nội dung'), 'practice speech hint uses "micro"');

const infoHtml = fs.readFileSync(resolvePath('FE/features/interview/interview-info.html'), 'utf8');
assert(infoHtml.includes('Đảm bảo tai nghe và micro hoạt động rõ ràng nếu chọn chế độ Giọng nói'), 'setup wizard summary uses "micro"');
assert(infoHtml.includes('Không bắt buộc micro'), 'setup wizard chat mode uses "micro"');

const legalHtml = fs.readFileSync(resolvePath('FE/features/legal/legal-center.html'), 'utf8');
assert(legalHtml.includes('luồng âm thanh từ micro được chuyển hóa'), 'legal center voice data uses "micro"');
assert(legalHtml.includes('cấp quyền micro/camera trên trình duyệt'), 'legal center consent clause uses "micro/camera"');
assert(legalHtml.includes('hỏng micro, đường truyền internet'), 'legal center refund policy uses "hỏng micro"');
assert(!legalHtml.includes('hỏng microphone'), 'legal center removed "hỏng microphone"');
assert(legalHtml.includes('báo cáo phân tích chuyên sâu chuẩn STAR'), 'legal center PRO package description uses Vietnamese STAR debrief');
console.log('[PASS] 2. Micro and legal terminology normalized');

// 3. Report Page: English Subtitles Removed
console.log('• Testing Report page subtitle cleanup in report.html...');
const reportHtml = fs.readFileSync(resolvePath('FE/features/report/report.html'), 'utf8');
assert(reportHtml.includes('Minh chứng từ từng lượt trả lời giúp chẩn đoán chính xác'), 'report.html removed (Turn Provenance) from diagnostics description');
assert(!reportHtml.includes('(Turn Provenance) giúp chẩn đoán'), 'report.html does not contain (Turn Provenance) in desc');
assert(reportHtml.includes('<h2 class="section-title">Đánh Giá Giọng Nói & Kỹ Năng Trình Bày</h2>'), 'report.html removed (Speech Coaching) from speech section title');
assert(!reportHtml.includes('(Speech Coaching)</h2>'), 'report.html does not contain (Speech Coaching) in section header');
console.log('[PASS] 3. Report page subtitles cleaned');

// 4. Landing Page and About Page Phrasing
console.log('• Testing Landing page & About page natural phrasing...');
const indexHtml = fs.readFileSync(resolvePath('FE/index.html'), 'utf8');
assert(indexHtml.includes('PREPMATE · CHUẨN BỊ SỰ NGHIỆP CÙNG AI'), 'index.html eyebrow normalized to Vietnamese');
assert(!indexHtml.includes('PREPMATE · AI CAREER PREPARATION'), 'index.html removed English eyebrow');
assert(indexHtml.includes('Phân tích chuyên sâu từng lượt (STAR):'), 'index.html feature comparison uses Vietnamese');
assert(!indexHtml.includes('Debrief chuyên sâu từng lượt (STAR):'), 'index.html removed Debrief');
assert(indexHtml.includes('Minh chứng theo từng lượt đối thoại:'), 'index.html feature item uses Vietnamese');
assert(!indexHtml.includes('Minh chứng Turn Provenance:'), 'index.html removed Turn Provenance');

const aboutHtml = fs.readFileSync(resolvePath('FE/features/about/about.html'), 'utf8');
assert(aboutHtml.includes('nhận lời mời làm việc sau khi hoàn thành'), 'about.html removed (Job Offer)');
assert(!aboutHtml.includes('(Job Offer)'), 'about.html has no (Job Offer)');
assert(aboutHtml.includes('Phân tích mổ xẻ chuẩn STAR'), 'about.html removed Debrief');
assert(!aboutHtml.includes('Debrief mổ xẻ chuẩn STAR'), 'about.html has no Debrief');
assert(aboutHtml.includes('chuyển đổi giọng nói đối thoại hai chiều với độ trễ thấp'), 'about.html natural Vietnamese speech description');
console.log('[PASS] 4. Landing & About natural phrasing verified');

// 5. QBank Normalization
console.log('• Testing QBank terminology in qbank.html...');
const qbankHtml = fs.readFileSync(resolvePath('FE/features/qbank/qbank.html'), 'utf8');
assert(qbankHtml.includes('Ngân hàng Câu hỏi & Kiến thức cốt lõi AI'), 'qbank.html title & heading uses "Kiến thức cốt lõi AI"');
assert(!qbankHtml.includes('Core Knowledge AI'), 'qbank.html removed "Core Knowledge AI"');
assert(qbankHtml.includes('Tích hợp AI hỏi đào sâu & STAR'), 'qbank.html hero pill uses "AI hỏi đào sâu"');
assert(qbankHtml.includes('Kèm AI hỏi đào sâu'), 'qbank.html stat item uses "AI hỏi đào sâu"');
assert(!qbankHtml.includes('Kèm AI Follow-up'), 'qbank.html removed "AI Follow-up"');
assert(qbankHtml.includes('Tình huống AI hỏi đào sâu'), 'qbank.html probe modal header normalized');
console.log('[PASS] 5. QBank terminology normalized');

// 6. Settings Tooltip Cleanup
console.log('• Testing Settings tooltips in settings.html...');
const settingsHtml = fs.readFileSync(resolvePath('FE/features/profile/settings.html'), 'utf8');
assert(settingsHtml.includes('title="Chế độ Sáng"'), 'settings.html light mode tooltip cleaned');
assert(!settingsHtml.includes('title="Chế độ Sáng (Light Mode)"'), 'settings.html removed (Light Mode)');
assert(settingsHtml.includes('title="Chế độ Tối"'), 'settings.html dark mode tooltip cleaned');
assert(!settingsHtml.includes('title="Chế độ Tối (Dark Mode)"'), 'settings.html removed (Dark Mode)');
console.log('[PASS] 6. Settings tooltips verified');

// 7. Experience Level Consistency across History, Profile & QBank
console.log('• Testing Experience Level consistency in history.html & profile.html...');
const historyHtml = fs.readFileSync(resolvePath('FE/features/interview/history.html'), 'utf8');
assert(historyHtml.includes('<option value="Middle">Trung cấp (Mid-level)</option>'), 'history.html uses "Trung cấp (Mid-level)" with value="Middle" preserved');
const profileHtml = fs.readFileSync(resolvePath('FE/features/profile/profile.html'), 'utf8');
assert(profileHtml.includes('<option value="Mid-level">Trung cấp (Mid-level, 2 – 4 năm)</option>'), 'profile.html uses "Trung cấp (Mid-level, 2 – 4 năm)" with value="Mid-level" preserved');
console.log('[PASS] 7. Experience level consistency verified');

// 8. Admin & Progress
console.log('• Testing Admin & Progress page wording...');
const adminHtml = fs.readFileSync(resolvePath('FE/features/admin/admin.html'), 'utf8');
assert(adminHtml.includes('Xóa khóa API đã lưu trong cơ sở dữ liệu'), 'admin.html uses Vietnamese for clear API key label');
assert(!adminHtml.includes('(Clear stored key)'), 'admin.html removed (Clear stored key)');

const progressHtml = fs.readFileSync(resolvePath('FE/features/progress/progress.html'), 'utf8');
assert(progressHtml.includes('<span class="stat-lbl">Chuỗi ngày luyện tập</span>'), 'progress.html uses "Chuỗi ngày luyện tập"');
assert(!progressHtml.includes('<span class="stat-lbl">Streak hiện tại</span>'), 'progress.html removed "Streak hiện tại"');
console.log('[PASS] 8. Admin & Progress verified');

// 9. Technical & Architecture Invariants
console.log('• Testing Technical & Architecture Invariants...');
const BASELINE_DB_HASH = '00D0B91EABC1646F291B879DA5EE8F1F056B072C36EC864522FAE58E6ABBEA1A';
const crypto = require('crypto');
const PROD_DB_PATH = path.resolve(__dirname, '../../BE/data/db.json');
assert(fs.existsSync(PROD_DB_PATH), 'db.json must exist');
const dbBytes = fs.readFileSync(PROD_DB_PATH);
const currentHash = crypto.createHash('sha256').update(dbBytes).digest('hex').toUpperCase();
assert.strictEqual(currentHash, BASELINE_DB_HASH, 'Production database must remain strictly unchanged');
console.log('[PASS] 9. Technical Invariants verified');

console.log('\n--- ALL 9 WI-LANG-02 REGRESSION CHECKS PASSED CLEANLY ---');
