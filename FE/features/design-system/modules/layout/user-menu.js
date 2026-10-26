/**
 * PREPMATE USER MENU COMPONENT
 * Phase: H2 — Design System & Shared Layout
 */

const UserMenu = {
  menuEl: null,

  init() {
    if (this.menuEl) return;
    const root = window.PM_Routing ? window.PM_Routing.getRoot() : (window.location.pathname.includes('/features/') ? '../../' : './');
    const user = window.PM_User ? window.PM_User.getCurrentUser() : null;
    const displayName = window.PM_User ? window.PM_User.getDisplayName() : 'Người dùng';
    const email = window.PM_User ? window.PM_User.getEmail() : '';
    const initial = window.PM_User ? window.PM_User.getInitial() : 'U';
    const isPro = window.PM_User ? window.PM_User.isPro() : false;

    let badgeText = 'Gói Miễn phí';
    let badgeClass = 'badge-neutral';
    if (user?.role === 'admin') {
      badgeText = 'Quản trị viên';
      badgeClass = 'badge-info';
    } else if (user?.role === 'manager') {
      badgeText = 'Quản lý';
      badgeClass = 'badge-info';
    } else if (isPro) {
      badgeText = 'Gói PRO';
      badgeClass = 'badge-warning';
    }

    const menu = document.createElement('div');
    menu.id = 'pm-global-user-menu';
    menu.className = 'pm-user-dropdown';
    menu.style.cssText = `
      position: fixed;
      display: none;
      z-index: var(--z-dropdown);
      width: 240px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      padding: var(--space-2);
      animation: pm-modal-in 0.15s ease-out;
    `;

    menu.innerHTML = `
      <div style="padding: var(--space-3); border-bottom: 1px solid var(--color-border-subtle); margin-bottom: var(--space-1);">
        <div style="font-weight: var(--font-weight-semibold); color: var(--color-text);">${displayName}</div>
        <div style="font-size: var(--font-size-caption); color: var(--color-text-muted); margin-top: 2px;">${email}</div>
        <div style="margin-top: 6px;"><span class="badge ${badgeClass}">${badgeText}</span></div>
      </div>
      <a href="${root}features/profile/profile.html" class="nav-item" style="padding: 8px 12px; font-size: 13px;">
        <span>Hồ sơ cá nhân</span>
      </a>
      <a href="${root}features/profile/settings.html" class="nav-item" style="padding: 8px 12px; font-size: 13px;">
        <span>Cài đặt hệ thống</span>
      </a>
      <a href="${root}features/payment/pricing.html" class="nav-item" style="padding: 8px 12px; font-size: 13px;">
        <span>Bảng giá & Gói PRO</span>
      </a>
      <div style="border-top: 1px solid var(--color-border-subtle); margin: 4px 0;"></div>
      <button type="button" class="nav-item text-danger" style="width: 100%; text-align: left; padding: 8px 12px; font-size: 13px;" onclick="PM_Auth.logout()">
        <span>Đăng xuất</span>
      </button>
    `;

    document.body.appendChild(menu);
    this.menuEl = menu;

    document.addEventListener('click', (e) => {
      if (this.menuEl && !this.menuEl.contains(e.target) && !e.target.closest('.sidebar-user-widget')) {
        this.hide();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.menuEl && this.menuEl.style.display === 'block') {
        this.hide();
      }
    });
  },

  toggle(event) {
    if (event) event.stopPropagation();
    if (!this.menuEl) this.init();
    if (this.menuEl.style.display === 'block') {
      this.hide();
    } else {
      this.show(event ? event.currentTarget : null);
    }
  },

  show(targetEl) {
    if (!this.menuEl) this.init();
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      const fitsAbove = window.innerHeight - rect.bottom < 240;
      if (fitsAbove) {
        this.menuEl.style.bottom = `${window.innerHeight - rect.top + 8}px`;
        this.menuEl.style.top = 'auto';
      } else {
        this.menuEl.style.top = `${rect.bottom + 8}px`;
        this.menuEl.style.bottom = 'auto';
      }
      this.menuEl.style.left = `${Math.max(16, rect.left)}px`;
    }
    this.menuEl.style.display = 'block';
  },

  hide() {
    if (this.menuEl) {
      this.menuEl.style.display = 'none';
    }
  }
};

window.PM_UserMenu = UserMenu;
