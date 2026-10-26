/**
 * PREPMATE SIDEBAR LAYOUT COMPONENT
 * Phase: H2 — Design System & Shared Layout
 * Follows Section 15 sidebar specifications strictly:
 * - Clear hierarchy, compact, easy to scan, non-decorative, no excessive icons, clear active state.
 */

const Sidebar = {
  // Clean, meaningful, non-decorative SVG icons
  icons: {
    dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    play: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    history: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    compass: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
    chart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    user: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    lock: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    card: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    book: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    audit: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    login: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
    chevronLeft: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`
  },

  render(container) {
    if (!container) return;
    const root = window.PM_Routing ? window.PM_Routing.getRoot() : (window.location.pathname.includes('/features/') ? '../../' : './');
    const role = window.PM_User ? window.PM_User.getRole() : 'guest';
    const isItemActive = (file, hash = null) => {
      if (window.PM_Routing) {
        return window.PM_Routing.isActive(file, hash) ? 'active' : '';
      }
      return '';
    };

    let roleBadge = 'ỨNG VIÊN';
    if (role === 'admin') roleBadge = 'QUẢN TRỊ VIÊN';
    else if (role === 'manager') roleBadge = 'QUẢN LÝ';

    let navHtml = '';

    if (role === 'admin') {
      navHtml = `
        <div class="nav-section-title">QUẢN TRỊ</div>
        <a href="${root}features/admin/admin.html" class="nav-item ${isItemActive('admin.html', '')}">
          <span class="nav-icon">${this.icons.dashboard}</span>
          <span class="nav-label">Tổng quan</span>
        </a>
        <a href="${root}features/admin/admin.html#users-tab" class="nav-item ${isItemActive('admin.html', '#users-tab')}">
          <span class="nav-icon">${this.icons.users}</span>
          <span class="nav-label">Người dùng</span>
        </a>
        <a href="${root}features/admin/admin.html#roles-tab" class="nav-item ${isItemActive('admin.html', '#roles-tab')}">
          <span class="nav-icon">${this.icons.lock}</span>
          <span class="nav-label">Vai trò & quyền</span>
        </a>
        <a href="${root}features/admin/admin.html#plans-tab" class="nav-item ${isItemActive('admin.html', '#plans-tab')}">
          <span class="nav-icon">${this.icons.card}</span>
          <span class="nav-label">Gói dịch vụ & Giá</span>
        </a>
        <a href="${root}features/admin/admin.html#content-tab" class="nav-item ${isItemActive('admin.html', '#content-tab')}">
          <span class="nav-icon">${this.icons.book}</span>
          <span class="nav-label">Nội dung câu hỏi</span>
        </a>
        <a href="${root}features/admin/admin.html#reports-tab" class="nav-item ${isItemActive('admin.html', '#reports-tab')}">
          <span class="nav-icon">${this.icons.chart}</span>
          <span class="nav-label">Báo cáo chất lượng</span>
        </a>

        <div class="nav-section-title">HỆ THỐNG</div>
        <a href="${root}features/admin/admin.html#transactions-tab" class="nav-item ${isItemActive('admin.html', '#transactions-tab')}">
          <span class="nav-icon">${this.icons.card}</span>
          <span class="nav-label">Giao dịch doanh thu</span>
        </a>
        <a href="${root}features/admin/admin.html#settings-tab" class="nav-item ${isItemActive('admin.html', '#settings-tab')}">
          <span class="nav-icon">${this.icons.settings}</span>
          <span class="nav-label">Cấu hình hệ thống</span>
        </a>
        <a href="${root}features/admin/admin.html#audit-tab" class="nav-item ${isItemActive('admin.html', '#audit-tab')}">
          <span class="nav-icon">${this.icons.audit}</span>
          <span class="nav-label">Nhật ký hệ thống</span>
        </a>
        <a href="${root}features/profile/settings.html" class="nav-item ${isItemActive('settings.html')}">
          <span class="nav-icon">${this.icons.settings}</span>
          <span class="nav-label">Cài đặt cá nhân</span>
        </a>
      `;
    } else if (role === 'manager') {
      navHtml = `
        <div class="nav-section-title">QUẢN LÝ</div>
        <a href="${root}features/admin/admin.html" class="nav-item ${isItemActive('admin.html', '')}">
          <span class="nav-icon">${this.icons.dashboard}</span>
          <span class="nav-label">Tổng quan</span>
        </a>
        <a href="${root}features/admin/admin.html#users-tab" class="nav-item ${isItemActive('admin.html', '#users-tab')}">
          <span class="nav-icon">${this.icons.users}</span>
          <span class="nav-label">Người dùng</span>
        </a>
        <a href="${root}features/admin/admin.html#plans-tab" class="nav-item ${isItemActive('admin.html', '#plans-tab')}">
          <span class="nav-icon">${this.icons.card}</span>
          <span class="nav-label">Gói dịch vụ</span>
        </a>
        <a href="${root}features/admin/admin.html#content-tab" class="nav-item ${isItemActive('admin.html', '#content-tab')}">
          <span class="nav-icon">${this.icons.book}</span>
          <span class="nav-label">Nội dung câu hỏi</span>
        </a>
        <a href="${root}features/admin/admin.html#reports-tab" class="nav-item ${isItemActive('admin.html', '#reports-tab')}">
          <span class="nav-icon">${this.icons.chart}</span>
          <span class="nav-label">Báo cáo phân tích</span>
        </a>
        <a href="${root}features/admin/admin.html#audit-tab" class="nav-item ${isItemActive('admin.html', '#audit-tab')}">
          <span class="nav-icon">${this.icons.audit}</span>
          <span class="nav-label">Nhật ký hoạt động</span>
        </a>

        <div class="nav-section-title">HỆ THỐNG</div>
        <a href="${root}features/profile/settings.html" class="nav-item ${isItemActive('settings.html')}">
          <span class="nav-icon">${this.icons.settings}</span>
          <span class="nav-label">Cài đặt cá nhân</span>
        </a>
      `;
    } else if (role === 'user') {
      // User Navigation adhering 100% strictly to Section 15 specifications
      navHtml = `
        <div class="nav-section-title">TỔNG QUAN</div>
        <a href="${root}features/dashboard/dashboard.html" class="nav-item ${isItemActive('dashboard.html', '')}">
          <span class="nav-icon">${this.icons.dashboard}</span>
          <span class="nav-label">Tổng quan</span>
        </a>

        <div class="nav-section-title">PHỎNG VẤN</div>
        <a href="${root}features/interview/interview-info.html" class="nav-item ${isItemActive('interview-info.html')}">
          <span class="nav-icon">${this.icons.play}</span>
          <span class="nav-label">Phỏng vấn mới</span>
        </a>
        <a href="${root}features/dashboard/dashboard.html#history" class="nav-item ${isItemActive('dashboard.html', '#history')}">
          <span class="nav-icon">${this.icons.history}</span>
          <span class="nav-label">Lịch sử</span>
        </a>

        <div class="nav-section-title">KHÁM PHÁ</div>
        <a href="${root}features/jobs/jobs.html" class="nav-item ${isItemActive('jobs.html')}">
          <span class="nav-icon">${this.icons.compass}</span>
          <span class="nav-label">Nghề nghiệp</span>
        </a>

        <div class="nav-section-title">TIẾN BỘ</div>
        <a href="${root}features/progress/progress.html" class="nav-item ${isItemActive('progress.html')}">
          <span class="nav-icon">${this.icons.chart}</span>
          <span class="nav-label">Tiến độ</span>
        </a>

        <div class="nav-section-title">CÁ NHÂN</div>
        <a href="${root}features/profile/profile.html" class="nav-item ${isItemActive('profile.html')}">
          <span class="nav-icon">${this.icons.user}</span>
          <span class="nav-label">Hồ sơ</span>
        </a>
        <a href="${root}features/profile/settings.html" class="nav-item ${isItemActive('settings.html')}">
          <span class="nav-icon">${this.icons.settings}</span>
          <span class="nav-label">Cài đặt</span>
        </a>
      `;
    } else {
      // Guest Navigation
      navHtml = `
        <div class="nav-section-title">TỔNG QUAN</div>
        <a href="${root}index.html" class="nav-item">
          <span class="nav-icon">${this.icons.dashboard}</span>
          <span class="nav-label">Trang chủ</span>
        </a>

        <div class="nav-section-title">PHỎNG VẤN</div>
        <a href="${root}features/interview/interview-info.html" class="nav-item">
          <span class="nav-icon">${this.icons.play}</span>
          <span class="nav-label">Phỏng vấn trải nghiệm</span>
        </a>

        <div class="nav-section-title">TÀI KHOẢN</div>
        <a href="${root}features/auth/auth.html" class="nav-item">
          <span class="nav-icon">${this.icons.login}</span>
          <span class="nav-label">Đăng nhập tài khoản</span>
        </a>
      `;
    }

    const displayName = window.PM_User ? window.PM_User.getDisplayName() : 'Người dùng';
    const email = window.PM_User ? window.PM_User.getEmail() : '';
    const initial = window.PM_User ? window.PM_User.getInitial() : 'U';

    container.innerHTML = `
      <div class="sidebar-header">
        <a href="${root}index.html" class="sidebar-brand" title="PrepMate - Về trang chủ">
          <div class="sidebar-brand-mark">P</div>
          <span class="sidebar-brand-name">PrepMate</span>
          <span class="sidebar-badge">${roleBadge}</span>
        </a>
        <button type="button" class="sidebar-collapse-trigger" onclick="PM_Sidebar.toggleCollapse()" title="Thu gọn sidebar" aria-label="Thu gọn sidebar">
          ${this.icons.chevronLeft}
        </button>
      </div>

      <nav class="sidebar-nav" aria-label="Thanh điều hướng chính">
        ${navHtml}
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user-widget" onclick="PM_UserMenu.toggle(event)" role="button" aria-haspopup="true" aria-expanded="false" title="Menu tài khoản">
          <div class="sidebar-user-avatar">${initial}</div>
          <div class="sidebar-user-meta">
            <div class="sidebar-user-name">${displayName}</div>
            <div class="sidebar-user-role">${email || roleBadge}</div>
          </div>
        </div>
      </div>
    `;

    // Apply persisted collapse state
    const isCollapsed = localStorage.getItem('prepmate_sidebar_collapsed') === 'true';
    if (isCollapsed) {
      container.classList.add('collapsed');
    }
  },

  toggleCollapse() {
    const sidebar = document.querySelector('.app-sidebar, .sidebar-new, #main-sidebar');
    if (!sidebar) return;
    const willCollapse = !sidebar.classList.contains('collapsed');
    sidebar.classList.toggle('collapsed', willCollapse);
    localStorage.setItem('prepmate_sidebar_collapsed', willCollapse ? 'true' : 'false');
  }
};

window.PM_Sidebar = Sidebar;
