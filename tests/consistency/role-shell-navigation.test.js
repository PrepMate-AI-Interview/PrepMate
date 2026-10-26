/**
 * PrepMate — Role Shell & Navigation Foundation Test Suite
 * Work Item: WI-DESIGN-04
 *
 * Verifies multi-role shell architecture, sidebar structures, and navigation contracts:
 * 1. Public / Guest Header & Navigation Shell
 * 2. Candidate Workspace Shell & Sidebar IA
 * 3. Manager Workspace Shell & Operational Boundaries
 * 4. Admin Workspace Shell & Full Management Controls
 * 5. Sidebar Collapse, Persistence & Geometry
 * 6. Responsive Breakpoints & Mobile Adaptation
 * 7. Shared Footers (Public & Workspace)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('===============================================================');
console.log('   WI-DESIGN-04: ROLE SHELL & NAVIGATION FOUNDATION TESTS     ');
console.log('===============================================================\n');

const layoutCssPath = path.join(__dirname, '../../FE/shared/css/layout.css');
const mainJsPath = path.join(__dirname, '../../FE/shared/js/main.js');
const componentsJsPath = path.join(__dirname, '../../FE/shared/js/components.js');
const adminHtmlPath = path.join(__dirname, '../../FE/features/admin/admin.html');

assert.ok(fs.existsSync(layoutCssPath), 'layout.css must exist');
assert.ok(fs.existsSync(mainJsPath), 'main.js must exist');
assert.ok(fs.existsSync(componentsJsPath), 'components.js must exist');
assert.ok(fs.existsSync(adminHtmlPath), 'admin.html must exist');

const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');
const mainJs = fs.readFileSync(mainJsPath, 'utf8');
const componentsJs = fs.readFileSync(componentsJsPath, 'utf8');
const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');

let passCount = 0;
let failCount = 0;

function runCheck(desc, fn) {
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}: ${err.message}`);
    failCount++;
  }
}

// ── 1. PUBLIC / GUEST HEADER & NAVIGATION ───────────────────────────────────
console.log('--- GROUP 1: Public / Guest Header & Navigation Shell ---');
runCheck('1.1 layout.css defines canonical header.app-header-main & .navbar rules', () => {
  assert(layoutCss.includes('header.app-header-main'), 'header.app-header-main must be styled in layout.css');
  assert(layoutCss.includes('.navbar'), '.navbar must be styled in layout.css');
  assert(layoutCss.includes('.nav-public-links'), '.nav-public-links must be styled in layout.css');
});

runCheck('1.2 Public header auth controls & user dropdown (.header-user-trigger, .header-user-menu)', () => {
  assert(layoutCss.includes('.header-user-trigger'), '.header-user-trigger must be styled in layout.css');
  assert(layoutCss.includes('.header-user-menu'), '.header-user-menu must be styled in layout.css');
  assert(layoutCss.includes('.header-dashboard-btn'), '.header-dashboard-btn must be styled in layout.css');
});

runCheck('1.3 Custom element <app-header> renders public links and handles auth state', () => {
  assert(componentsJs.includes('class AppHeader extends HTMLElement'), 'AppHeader custom element defined');
  assert(componentsJs.includes('customElements.define(\'app-header\', AppHeader)'), 'app-header registered');
  assert(componentsJs.includes('Về chúng tôi') && componentsJs.includes('Bảng giá'), 'Public links present');
});

// ── 2. CANDIDATE WORKSPACE SHELL ────────────────────────────────────────────
console.log('\n--- GROUP 2: Candidate Workspace Shell & Sidebar IA ---');
runCheck('2.1 Candidate sidebar declares structured navigation sections', () => {
  assert(mainJs.includes('TỔNG QUAN'), 'Candidate has TỔNG QUAN section');
  assert(mainJs.includes('PHỎNG VẤN'), 'Candidate has PHỎNG VẤN section');
  assert(mainJs.includes('NGHỀ NGHIỆP & HỒ SƠ'), 'Candidate has NGHỀ NGHIỆP & HỒ SƠ section');
  assert(mainJs.includes('TIẾN BỘ'), 'Candidate has TIẾN BỘ section');
  assert(mainJs.includes('TÀI KHOẢN & CÀI ĐẶT'), 'Candidate has TÀI KHOẢN & CÀI ĐẶT section');
});

runCheck('2.2 Candidate sidebar includes all core feature links', () => {
  assert(mainJs.includes('dashboard.html') && mainJs.includes('Tổng quan'), 'Dashboard link');
  assert(mainJs.includes('interview-info.html') && mainJs.includes('Phỏng vấn mới'), 'Interview link');
  assert(mainJs.includes('history.html') && mainJs.includes('Lịch sử'), 'History link');
  assert(mainJs.includes('qbank.html') && mainJs.includes('Ngân hàng câu hỏi'), 'QBank link');
  assert(mainJs.includes('jobs.html') && mainJs.includes('Cơ hội việc làm'), 'Jobs link');
  assert(mainJs.includes('cv.html') && mainJs.includes('Quản lý CV'), 'CV link');
  assert(mainJs.includes('progress.html') && mainJs.includes('Tiến độ'), 'Progress link');
  assert(mainJs.includes('profile.html') && mainJs.includes('Hồ sơ tài khoản'), 'Profile link');
  assert(mainJs.includes('settings.html') && mainJs.includes('Cài đặt'), 'Settings link');
});

runCheck('2.3 Candidate profile widget (.user-profile-sidebar) with dropdown popover', () => {
  assert(mainJs.includes('user-profile-sidebar'), 'user-profile-sidebar container present');
  assert(mainJs.includes('user-dropdown-menu'), 'user-dropdown-menu present in sidebar');
  assert(mainJs.includes('logoutUser()'), 'Logout action available');
});

// ── 3. MANAGER WORKSPACE SHELL ──────────────────────────────────────────────
console.log('\n--- GROUP 3: Manager Workspace Shell & Operational Boundaries ---');
runCheck('3.1 Manager sidebar includes operational tabs without system admin leakage', () => {
  assert(mainJs.includes('role === "manager"'), 'Manager role handled in sidebar');
  assert(mainJs.includes('QUẢN LÝ VẬN HÀNH'), 'Manager role badge defined');
  assert(mainJs.includes('admin.html#users-tab'), 'Manager has users-tab access');
  assert(mainJs.includes('admin.html#plans-tab'), 'Manager has plans-tab access');
  assert(mainJs.includes('admin.html#content-tab'), 'Manager has content-tab access');
  assert(mainJs.includes('admin.html#reports-tab'), 'Manager has reports-tab access');
  assert(mainJs.includes('admin.html#audit-tab'), 'Manager has audit-tab access');
});

runCheck('3.2 Manager cannot access admin-only settings or roles tabs in sidebar', () => {
  const managerBlockMatch = mainJs.match(/else\s+if\s*\(\s*role\s*===\s*["']manager["']\s*\)\s*\{([\s\S]*?)\}\s*else\s+if/);
  assert(managerBlockMatch, 'Manager block extracted');
  const mgrBlock = managerBlockMatch[1];
  assert(!mgrBlock.includes('admin.html#settings-tab'), 'Manager sidebar does not expose #settings-tab (AI Engine config)');
  assert(!mgrBlock.includes('admin.html#roles-tab'), 'Manager sidebar does not expose #roles-tab (Role assignments)');
  assert(!mgrBlock.includes('admin.html#transactions-tab'), 'Manager sidebar does not expose #transactions-tab');
});

runCheck('3.3 admin.html enforces permission checks for Manager vs Admin', () => {
  assert(adminHtml.includes('role === \'admin\''), 'admin.html checks for admin role');
  assert(adminHtml.includes('switchRoleView'), 'admin.html supports role switching / preview');
  assert(adminHtml.includes('role-change-warning'), 'admin.html displays warning when Manager views roles');
});

// ── 4. ADMIN WORKSPACE SHELL ────────────────────────────────────────────────
console.log('\n--- GROUP 4: Admin Workspace Shell & Full Management Controls ---');
runCheck('4.1 Admin sidebar declares complete administration and system controls', () => {
  assert(mainJs.includes('role === "admin"'), 'Admin role handled in sidebar');
  assert(mainJs.includes('QUẢN TRỊ VIÊN'), 'Admin role badge defined');
  assert(mainJs.includes('admin.html#roles-tab'), 'Admin has roles-tab access');
  assert(mainJs.includes('admin.html#settings-tab'), 'Admin has settings-tab access (AI Engine)');
  assert(mainJs.includes('admin.html#transactions-tab'), 'Admin has transactions-tab access');
  assert(mainJs.includes('admin.html#audit-tab'), 'Admin has audit-tab access');
});

// ── 5. SIDEBAR COLLAPSE, PERSISTENCE & GEOMETRY ─────────────────────────────
console.log('\n--- GROUP 5: Sidebar Collapse & Persistence ---');
runCheck('5.1 Sidebar toggle button and collapse mode in layout.css', () => {
  assert(layoutCss.includes('.sidebar-new.collapsed'), '.sidebar-new.collapsed defined in layout.css');
  assert(layoutCss.includes('width: 72px;'), 'Collapsed sidebar is 72px width');
  assert(layoutCss.includes('.sidebar-toggle-btn'), '.sidebar-toggle-btn defined in layout.css');
});

runCheck('5.2 Sidebar collapse state persists in localStorage in main.js', () => {
  assert(mainJs.includes('prepmate_sidebar_collapsed'), 'main.js uses prepmate_sidebar_collapsed key');
  assert(mainJs.includes('toggleSidebarCollapse'), 'main.js defines toggleSidebarCollapse()');
  assert(mainJs.includes('applySidebarCollapseState'), 'main.js defines applySidebarCollapseState()');
});

// ── 6. RESPONSIVE BREAKPOINTS ───────────────────────────────────────────────
console.log('\n--- GROUP 6: Responsive Breakpoints & Shell Adaptation ---');
runCheck('6.1 Tablet breakpoint (1024px) adapts sidebar to 220px', () => {
  assert(layoutCss.includes('@media (max-width: 1024px)'), '1024px media query present');
  assert(layoutCss.includes('.sidebar-new { width: 220px; }'), 'Sidebar width is 220px at 1024px');
  assert(layoutCss.includes('.main-content-new { margin-left: 220px;'), 'Main content adapts margin at 1024px');
});

runCheck('6.2 Mobile breakpoint (768px) hides fixed sidebar for full-width layout', () => {
  assert(layoutCss.includes('@media (max-width: 768px)'), '768px media query present');
  assert(layoutCss.includes('.sidebar-new { display: none; }'), 'Sidebar hidden at 768px');
  assert(layoutCss.includes('.main-content-new { margin-left: 0;'), 'Main content margin is 0 at 768px');
});

// ── 7. SHARED FOOTERS ───────────────────────────────────────────────────────
console.log('\n--- GROUP 7: Shared Footers (Public & Workspace) ---');
runCheck('7.1 Public marketing footer (.app-footer, .footer-grid-layout) styled in layout.css', () => {
  assert(layoutCss.includes('.app-footer'), '.app-footer defined in layout.css');
  assert(layoutCss.includes('.footer-grid-layout'), '.footer-grid-layout defined in layout.css');
});

runCheck('7.2 Internal workspace footer (.app-workspace-footer) styled in layout.css', () => {
  assert(layoutCss.includes('.app-workspace-footer'), '.app-workspace-footer defined in layout.css');
  assert(layoutCss.includes('.workspace-footer-left'), '.workspace-footer-left defined in layout.css');
  assert(layoutCss.includes('.workspace-footer-right'), '.workspace-footer-right defined in layout.css');
});

runCheck('7.3 Custom elements <app-footer> and <app-workspace-footer> registered in components.js', () => {
  assert(componentsJs.includes('customElements.define(\'app-footer\', AppFooter)'), 'app-footer registered');
  assert(componentsJs.includes('customElements.define(\'app-workspace-footer\', AppWorkspaceFooter)'), 'app-workspace-footer registered');
});

console.log('\n===============================================================');
console.log(`   TEST RESULTS: ${passCount} PASS, ${failCount} FAIL`);
console.log('===============================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
