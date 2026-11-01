/**
 * PREPMATE HEADER LAYOUT COMPONENT
 * Phase: H2 — Design System & Shared Layout
 */

const Header = {
  renderPublic(container) {
    if (!container) return;
    const root = window.PM_Routing ? window.PM_Routing.getRoot() : (window.location.pathname.includes('/features/') ? '../../' : './');
    const isAuth = window.PM_Auth ? window.PM_Auth.isAuthenticated() : false;

    container.innerHTML = `
      <header class="public-header">
        <div class="public-header-inner">
          <a href="${root}index.html" class="sidebar-brand" title="PrepMate - Về trang chủ">
            <div class="sidebar-brand-mark">P</div>
            <span class="sidebar-brand-name">PrepMate</span>
          </a>

          <nav class="public-nav-links" aria-label="Điều hướng công khai">
            <a href="${root}features/about/about.html">Về chúng tôi</a>
            <a href="${root}features/payment/pricing.html">Bảng giá</a>
            <a href="${root}features/help/help.html">Hỏi đáp & Hỗ trợ</a>
          </nav>

          <div class="d-flex align-center gap-3">
            ${isAuth ? `
              <a href="${root}features/dashboard/dashboard.html" class="btn btn-primary btn-sm">Vào Bảng điều khiển</a>
            ` : `
              <a href="${root}features/auth/auth.html" class="btn btn-secondary btn-sm">Đăng nhập</a>
              <a href="${root}features/auth/auth.html#register" class="btn btn-primary btn-sm">Đăng ký</a>
            `}
          </div>
        </div>
      </header>
    `;
  },

  renderApp(container, options = {}) {
    if (!container) return;
    const root = window.PM_Routing ? window.PM_Routing.getRoot() : (window.location.pathname.includes('/features/') ? '../../' : './');
    const title = options.title || 'PrepMate';
    const displayName = window.PM_User ? window.PM_User.getDisplayName() : 'Người dùng';
    const initial = window.PM_User ? window.PM_User.getInitial() : 'U';

    container.innerHTML = `
      <header class="app-header">
        <div class="d-flex align-center gap-3">
          <button type="button" class="btn btn-ghost btn-sm d-none" id="mobile-sidebar-toggle" onclick="PM_Sidebar.toggleCollapse()" aria-label="Mở menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span class="font-semibold text-secondary">${title}</span>
        </div>

        <div class="d-flex align-center gap-4">
          <div class="sidebar-user-widget" onclick="PM_UserMenu.toggle(event)" role="button" aria-haspopup="true" aria-expanded="false" title="Menu cá nhân">
            <div class="sidebar-user-avatar" style="width:30px;height:30px;font-size:12px;">${initial}</div>
            <span class="text-sm font-medium">${displayName}</span>
          </div>
        </div>
      </header>
    `;
  }
};

window.PM_Header = Header;
