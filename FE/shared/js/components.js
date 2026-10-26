// =========================================================================
// PREPMATE EARLY GLOBAL THEME INITIALIZATION (SSOT - ZERO FOUC)
// =========================================================================
(function earlyInitTheme() {
    try {
        const savedTheme = localStorage.getItem("prepmate_theme") || localStorage.getItem("pm_theme") || "light";
        let eff = savedTheme;
        if (savedTheme === "auto") {
            eff = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
        }
        document.documentElement.setAttribute("data-theme", eff);
        if (eff === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    } catch (e) {}
})();

function getGlobalTheme() {
    return localStorage.getItem("prepmate_theme") || "light";
}

function applyGlobalTheme(mode) {
    const root = document.documentElement;
    const body = document.body;
    let effective = mode;
    if (mode === "auto") {
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        effective = prefersDark ? "dark" : "light";
    }

    if (effective === "dark") {
        root.setAttribute("data-theme", "dark");
        root.classList.add("dark");
        if (body) {
            body.classList.remove("light-mode");
            body.classList.add("dark-mode");
        }
    } else {
        root.setAttribute("data-theme", "light");
        root.classList.remove("dark");
        if (body) {
            body.classList.remove("dark-mode");
            body.classList.add("light-mode");
        }
    }

    // Sync all header theme switches (SSOT)
    document.querySelectorAll(".header-theme-toggle, .header-theme-switch, #header-theme-toggle-btn").forEach(btn => {
        const isDark = effective === "dark";
        btn.setAttribute("role", "switch");
        btn.setAttribute("aria-checked", isDark ? "true" : "false");
        btn.setAttribute("data-theme-state", isDark ? "dark" : "light");
        btn.setAttribute("aria-label", isDark ? "Chuyển sang chế độ Sáng" : "Chuyển sang chế độ Tối");
        btn.title = isDark ? "Đang bật chế độ Tối (Nhấp để chuyển sang Sáng)" : "Đang bật chế độ Sáng (Nhấp để chuyển sang Tối)";
        const lightIcon = btn.querySelector(".header-theme-icon-light");
        const darkIcon = btn.querySelector(".header-theme-icon-dark");
        if (lightIcon && darkIcon) {
            lightIcon.style.display = isDark ? "none" : "inline-flex";
            darkIcon.style.display = isDark ? "inline-flex" : "none";
        }
    });
}

function toggleGlobalTheme(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const current = getGlobalTheme();
    const nextTheme = current === "dark" ? "light" : "dark";
    try {
        localStorage.setItem("prepmate_theme", nextTheme); localStorage.setItem("pm_theme", nextTheme);
    } catch (err) {}
    applyGlobalTheme(nextTheme);
}

// Global auto apply on ready
if (typeof window !== "undefined") {
    window.getGlobalTheme = getGlobalTheme;
    window.applyGlobalTheme = applyGlobalTheme;
    window.toggleGlobalTheme = toggleGlobalTheme;

    document.addEventListener("DOMContentLoaded", () => {
        applyGlobalTheme(getGlobalTheme());
    });
}

class AppHeader extends HTMLElement {
    connectedCallback() {
        const isFeatures = window.location.pathname.includes('/features/');
        const root = isFeatures ? '../../' : './';
        const currentPath = (window.location.pathname || '').toLowerCase();
        const isPricing = currentPath.includes('/pricing.html');
        const isAbout = currentPath.includes('/about.html');
        const isHelp = currentPath.includes('/help.html');
        const isDashboard = currentPath.includes('/dashboard.html');
        const isQbank = currentPath.includes('/qbank.html');
        const isJobs = currentPath.includes('/jobs.html');
        const isProductsActive = isDashboard || isQbank || isJobs;
        
        this.innerHTML = `
        <header class="app-header-main">
            <div class="container navbar">
                <a href="${root}index.html" class="logo" title="PrepMate - Về trang chủ" style="cursor: pointer; text-decoration: none;">Prep<span>Mate</span></a>
                <nav class="nav-container">
                    <div class="nav-public-links">
                        <!-- Dropdown Sản phẩm (Khám phá tính năng thực tế — HEADER-PRODUCT-07) -->
                        <div class="header-nav-dropdown-wrap" id="header-products-dropdown">
                            <button type="button" class="header-nav-dropdown-trigger${isProductsActive ? ' active' : ''}" id="header-products-trigger" onclick="AppHeader.toggleProductsMenu(event)" aria-haspopup="true" aria-expanded="false" title="Khám phá các sản phẩm PrepMate">
                                <span>Sản phẩm</span>
                                <svg class="header-dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                            <div class="header-nav-dropdown-menu" id="header-products-menu" style="display: none;" onclick="event.stopPropagation()">
                                <a href="${root}features/dashboard/dashboard.html" class="header-dropdown-item${isDashboard ? ' active' : ''}">
                                    <div class="header-dropdown-item-content">
                                        <strong class="header-dropdown-item-title">Luyện phỏng vấn AI</strong>
                                        <span class="header-dropdown-item-desc">Giả lập phỏng vấn 1-1 với AI theo chuẩn STAR</span>
                                    </div>
                                </a>
                                <a href="${root}features/qbank/qbank.html" class="header-dropdown-item${isQbank ? ' active' : ''}">
                                    <div class="header-dropdown-item-content">
                                        <strong class="header-dropdown-item-title">Ngân hàng câu hỏi</strong>
                                        <span class="header-dropdown-item-desc">1.000+ câu hỏi phỏng vấn STAR theo chuyên ngành</span>
                                    </div>
                                </a>
                                <a href="${root}features/jobs/jobs.html" class="header-dropdown-item${isJobs ? ' active' : ''}">
                                    <div class="header-dropdown-item-content">
                                        <strong class="header-dropdown-item-title">Khám phá việc làm</strong>
                                        <span class="header-dropdown-item-desc">Thị trường tuyển dụng & phân tích yêu cầu JD</span>
                                    </div>
                                </a>
                            </div>
                        </div>

                        <!-- Các liên kết điều hướng chính thức -->
                        <a href="${root}features/payment/pricing.html" class="${isPricing ? 'active' : ''}">Bảng giá</a>
                        <a href="${root}features/about/about.html" class="${isAbout ? 'active' : ''}">Về chúng tôi</a>
                        <a href="${root}features/help/help.html" class="${isHelp ? 'active' : ''}">Trung tâm hỗ trợ</a>
                    </div>
                    
                    <!-- Công tắc chuyển đổi Theme Sáng / Tối Toàn Cục (True Toggle Switch) -->
                    <button type="button" class="header-theme-switch" id="header-theme-toggle-btn" role="switch" aria-checked="false" onclick="toggleGlobalTheme(event)" onkeydown="if(event.key==='Enter'||event.key===' '){toggleGlobalTheme(event);}" aria-label="Chuyển sang chế độ Tối" title="Chuyển sang chế độ Tối">
                        <span class="theme-switch-track" aria-hidden="true">
                            <span class="theme-switch-icon sun" aria-hidden="true">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                            </span>
                            <span class="theme-switch-icon moon" aria-hidden="true">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                            </span>
                            <span class="theme-switch-thumb"></span>
                        </span>
                    </button>

                    <!-- Khối hiển thị khi CHƯA đăng nhập -->
                    <div id="header-guest-group" class="header-auth-group">
                        <a id="login-btn" href="${root}features/auth/auth.html" class="btn btn-outline btn-sm">Đăng nhập</a>
                    </div>

                    <!-- Khối hiển thị khi ĐÃ đăng nhập -->
                    <div id="header-user-group" class="header-auth-group" style="display: none;">
                        <!-- User Profile Capsule Dropdown Trigger -->
                        <div class="header-user-dropdown-wrap" id="header-user-dropdown-wrap">
                            <button type="button" class="header-user-trigger" id="header-user-trigger" onclick="AppHeader.toggleUserMenu(event)" aria-haspopup="true" aria-expanded="false" title="Menu tài khoản cá nhân">
                                <div class="header-user-avatar" id="header-user-avatar">U</div>
                                <span class="header-user-name" id="header-user-name">Người dùng</span>
                                <svg class="header-user-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>

                            <!-- Dropdown Menu -->
                            <div class="header-user-menu" id="header-user-menu" style="display: none;" onclick="event.stopPropagation()">
                                <div class="header-menu-top">
                                    <div class="header-menu-avatar" id="header-menu-avatar">U</div>
                                    <div class="header-menu-meta">
                                        <strong id="header-menu-name">Người dùng</strong>
                                        <span id="header-menu-email">email@example.com</span>
                                        <span class="header-menu-badge" id="header-menu-badge">Gói Trải Nghiệm</span>
                                    </div>
                                </div>
                                <div class="header-menu-divider"></div>
                                <a href="${root}features/dashboard/dashboard.html" class="header-menu-link">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                                    <span>Tổng quan (Dashboard)</span>
                                </a>
                                <a href="${root}features/profile/cv.html" class="header-menu-link">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                    <span>CV của tôi & Hồ sơ</span>
                                </a>
                                <a href="${root}features/progress/progress.html" class="header-menu-link">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                                    <span>Tiến độ & Điểm số</span>
                                </a>
                                <a href="${root}features/payment/pricing.html" class="header-menu-link">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                    <span>Bảng giá & Gói PRO</span>
                                </a>
                                <a href="${root}features/profile/settings.html" class="header-menu-link">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                    <span>Cài đặt cá nhân</span>
                                </a>
                                <div class="header-menu-divider"></div>
                                <button type="button" class="header-menu-link text-danger" onclick="logoutUser()">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                    <span>Đăng xuất</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </nav>
            </div>
            <!-- Nút mở menu di động (Mobile Menu Trigger) -->
                    <button type="button" class="header-mobile-toggle" id="header-mobile-toggle" onclick="AppHeader.toggleMobileMenu(event)" aria-label="Mở menu điều hướng" aria-expanded="false" title="Menu điều hướng">
                        <svg class="mobile-icon-bars" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                        <svg class="mobile-icon-close" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:none;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </nav>
            </div>
            <!-- Mobile Navigation Drawer -->
            <div class="header-mobile-drawer" id="header-mobile-drawer" style="display: none;" onclick="event.stopPropagation()">
                <div class="mobile-drawer-section">
                    <span class="mobile-drawer-label">SẢN PHẨM</span>
                    <a href="${root}features/dashboard/dashboard.html" class="mobile-drawer-link${isDashboard ? ' active' : ''}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                        <span>Luyện phỏng vấn AI</span>
                    </a>
                    <a href="${root}features/qbank/qbank.html" class="mobile-drawer-link${isQbank ? ' active' : ''}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                        <span>Ngân hàng câu hỏi STAR</span>
                    </a>
                    <a href="${root}features/jobs/jobs.html" class="mobile-drawer-link${isJobs ? ' active' : ''}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                        <span>Khám phá việc làm</span>
                    </a>
                </div>
                <div class="mobile-drawer-divider"></div>
                <div class="mobile-drawer-section">
                    <span class="mobile-drawer-label">THÔNG TIN & BẢNG GIÁ</span>
                    <a href="${root}features/payment/pricing.html" class="mobile-drawer-link${isPricing ? ' active' : ''}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                        <span>Bảng giá & Gói PRO</span>
                    </a>
                    <a href="${root}features/about/about.html" class="mobile-drawer-link${isAbout ? ' active' : ''}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        <span>Về chúng tôi</span>
                    </a>
                    <a href="${root}features/help/help.html" class="mobile-drawer-link${isHelp ? ' active' : ''}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <span>Trung tâm hỗ trợ</span>
                    </a>
                    <a href="${root}features/legal/legal-center.html" class="mobile-drawer-link">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span>Trung tâm pháp lý</span>
                    </a>
                </div>
            </div>
            <div class="header-mobile-backdrop" id="header-mobile-backdrop" style="display: none;" onclick="AppHeader.closeMobileMenu()"></div>
        </header>
        `;

        this.updateAuthState();
    }

    static toggleProductsMenu(event) {
        if (event) event.stopPropagation();
        const wrap = document.getElementById('header-products-dropdown');
        const menu = document.getElementById('header-products-menu');
        const trigger = document.getElementById('header-products-trigger');
        if (!menu) return;
        const isOpen = menu.style.display === 'block';
        menu.style.display = isOpen ? 'none' : 'block';
        if (wrap) wrap.classList.toggle('open', !isOpen);
        if (trigger) trigger.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');

        // Close user menu if opening products
        if (!isOpen) {
            const userMenu = document.getElementById('header-user-menu');
            const userWrap = document.getElementById('header-user-dropdown-wrap');
            const userTrigger = document.getElementById('header-user-trigger');
            if (userMenu) userMenu.style.display = 'none';
            if (userWrap) userWrap.classList.remove('open');
            if (userTrigger) userTrigger.setAttribute('aria-expanded', 'false');
        }
    }

    static toggleUserMenu(event) {
        // Close products menu if open
        const prodMenu = document.getElementById('header-products-menu');
        const prodWrap = document.getElementById('header-products-dropdown');
        const prodTrigger = document.getElementById('header-products-trigger');
        if (prodMenu) prodMenu.style.display = 'none';
        if (prodWrap) prodWrap.classList.remove('open');
        if (prodTrigger) prodTrigger.setAttribute('aria-expanded', 'false');
        if (event) event.stopPropagation();
        const wrap = document.getElementById('header-user-dropdown-wrap');
        const menu = document.getElementById('header-user-menu');
        const trigger = document.getElementById('header-user-trigger');
        if (!menu) return;
        const isOpen = menu.style.display === 'block';
        menu.style.display = isOpen ? 'none' : 'block';
        if (wrap) wrap.classList.toggle('open', !isOpen);
        if (trigger) trigger.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
    }

    static toggleMobileMenu(event) {
        if (event) event.stopPropagation();
        const drawer = document.getElementById('header-mobile-drawer');
        const backdrop = document.getElementById('header-mobile-backdrop');
        const toggle = document.getElementById('header-mobile-toggle');
        if (!drawer) return;
        const isOpen = drawer.style.display === 'block';
        drawer.style.display = isOpen ? 'none' : 'block';
        if (backdrop) backdrop.style.display = isOpen ? 'none' : 'block';
        if (toggle) {
            toggle.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
            const bars = toggle.querySelector('.mobile-icon-bars');
            const close = toggle.querySelector('.mobile-icon-close');
            if (bars && close) {
                bars.style.display = isOpen ? 'inline-flex' : 'none';
                close.style.display = isOpen ? 'none' : 'inline-flex';
            }
        }
    }

    static closeMobileMenu() {
        const drawer = document.getElementById('header-mobile-drawer');
        const backdrop = document.getElementById('header-mobile-backdrop');
        const toggle = document.getElementById('header-mobile-toggle');
        if (drawer) drawer.style.display = 'none';
        if (backdrop) backdrop.style.display = 'none';
        if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
            const bars = toggle.querySelector('.mobile-icon-bars');
            const close = toggle.querySelector('.mobile-icon-close');
            if (bars && close) {
                bars.style.display = 'inline-flex';
                close.style.display = 'none';
            }
        }
    }

    updateAuthState() {
        const renderUser = () => {
            let user = null;
            if (typeof getCurrentUser === 'function') {
                user = getCurrentUser();
            } else {
                try {
                    const raw = localStorage.getItem('prepmate_current_user') || localStorage.getItem('prepmate_user');
                    if (raw) user = JSON.parse(raw);
                } catch (e) {}
            }
            const guestGroup = this.querySelector('#header-guest-group');
            const userGroup = this.querySelector('#header-user-group');

            // Synchronize Hero Primary CTA on Homepage (HEADER-DASHBOARD-CTA-02)
            const heroCta = document.getElementById('heroPrimaryCta');
            if (heroCta) {
                const isFeatures = window.location.pathname.includes('/features/');
                const root = isFeatures ? '../../' : './';
                if (user) {
                    const targetDashboard = (user.role === 'admin' || user.role === 'manager')
                        ? `${root}features/admin/admin.html`
                        : `${root}features/dashboard/dashboard.html`;
                    heroCta.setAttribute('href', targetDashboard);
                    heroCta.innerHTML = `
                        <span>Vào Dashboard</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    `;
                    heroCta.setAttribute('title', 'Đi tới Bảng điều khiển');
                } else {
                    heroCta.setAttribute('href', `${root}features/interview/interview-info.html`);
                    heroCta.innerHTML = `
                        <span>Bắt đầu luyện tập</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    `;
                    heroCta.removeAttribute('title');
                }
            }

            if (user) {
                if (guestGroup) guestGroup.style.display = 'none';
                if (userGroup) userGroup.style.display = 'inline-flex';

                const displayName = user.fullname || user.username || 'Người dùng';
                const displayEmail = user.email || 'candidate@prepmate.ai';
                const initial = (displayName.charAt(0) || 'U').toUpperCase();

                const avatarEl = this.querySelector('#header-user-avatar');
                const nameEl = this.querySelector('#header-user-name');
                const menuAvatar = this.querySelector('#header-menu-avatar');
                const menuName = this.querySelector('#header-menu-name');
                const menuEmail = this.querySelector('#header-menu-email');
                const menuBadge = this.querySelector('#header-menu-badge');

                if (avatarEl) avatarEl.textContent = initial;
                if (nameEl) nameEl.textContent = displayName;
                if (menuAvatar) menuAvatar.textContent = initial;
                if (menuName) menuName.textContent = displayName;
                if (menuEmail) menuEmail.textContent = displayEmail;

                if (menuBadge) {
                    const isStaff = user.role === 'admin' ? 'Quản trị viên' : user.role === 'manager' ? 'Quản lý' : null;
                    if (isStaff) {
                        menuBadge.textContent = isStaff;
                        menuBadge.className = 'header-menu-badge badge-staff';
                    } else if (user.subscription === 'pro') {
                        menuBadge.textContent = 'Gói PRO';
                        menuBadge.className = 'header-menu-badge badge-pro';
                    } else {
                        menuBadge.textContent = 'Gói Trải Nghiệm';
                        menuBadge.className = 'header-menu-badge badge-free';
                    }
                }
            } else {
                if (guestGroup) guestGroup.style.display = 'inline-flex';
                if (userGroup) userGroup.style.display = 'none';
            }
        };

        renderUser();
        // Check once more after tiny delay in case auth.js script evaluates right after
        setTimeout(renderUser, 100);
    }
}

// Global click handler to close navbar user dropdown when clicking outside
document.addEventListener('click', (e) => {
    const mobileDrawer = document.getElementById('header-mobile-drawer');
    const mobileToggle = document.getElementById('header-mobile-toggle');
    if (mobileDrawer && mobileDrawer.style.display === 'block' && (!mobileToggle || !mobileToggle.contains(e.target))) {
        AppHeader.closeMobileMenu();
    }
    const prodMenu = document.getElementById('header-products-menu');
    const prodWrap = document.getElementById('header-products-dropdown');
    const prodTrigger = document.getElementById('header-products-trigger');
    if (prodMenu && prodMenu.style.display === 'block' && (!prodWrap || !prodWrap.contains(e.target))) {
        prodMenu.style.display = 'none';
        if (prodWrap) prodWrap.classList.remove('open');
        if (prodTrigger) prodTrigger.setAttribute('aria-expanded', 'false');
    }
    const wrap = document.getElementById('header-user-dropdown-wrap');
    const menu = document.getElementById('header-user-menu');
    const trigger = document.getElementById('header-user-trigger');
    if (menu && menu.style.display === 'block' && (!wrap || !wrap.contains(e.target))) {
        menu.style.display = 'none';
        if (wrap) wrap.classList.remove('open');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
});

// Close open dropdowns with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
        AppHeader.closeMobileMenu();
    }
    if (e.key === 'Escape' || e.key === 'Esc') {
        const prodMenu = document.getElementById('header-products-menu');
        const prodWrap = document.getElementById('header-products-dropdown');
        const prodTrigger = document.getElementById('header-products-trigger');
        if (prodMenu && prodMenu.style.display === 'block') {
            prodMenu.style.display = 'none';
            if (prodWrap) prodWrap.classList.remove('open');
            if (prodTrigger) {
                prodTrigger.setAttribute('aria-expanded', 'false');
                prodTrigger.focus();
            }
        }
        const userWrap = document.getElementById('header-user-dropdown-wrap');
        const userMenu = document.getElementById('header-user-menu');
        const userTrigger = document.getElementById('header-user-trigger');
        if (userMenu && userMenu.style.display === 'block') {
            userMenu.style.display = 'none';
            if (userWrap) userWrap.classList.remove('open');
            if (userTrigger) {
                userTrigger.setAttribute('aria-expanded', 'false');
                userTrigger.focus();
            }
        }
    }
});

class AppFooter extends HTMLElement {
    connectedCallback() {
        const isFeatures = window.location.pathname.includes('/features/');
        const root = isFeatures ? '../../' : './';
        this.innerHTML = `
        <footer class="app-footer">
            <div class="container footer-grid-layout">
                <!-- Group 1: Nhận diện thương hiệu PrepMate -->
                <div class="footer-col brand-col">
                    <a href="${root}index.html" class="footer-logo" title="PrepMate - Về trang chủ" style="text-decoration: none;">
                        <span class="logo-mini-icon">P</span>
                        <span>Prep<span class="footer-logo-accent">Mate</span></span>
                    </a>
                    <p class="footer-desc">
                        Nền tảng luyện phỏng vấn AI thực chiến theo phương pháp STAR.
                    </p>
                    <div class="footer-social">
                        <div class="social-icons">
                            <a href="https://www.facebook.com/profile.php?id=61594859141620" target="_blank" rel="noopener noreferrer" aria-label="Facebook PrepMate" title="Facebook PrepMate">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.312h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
                            </a>
                            <a href="https://zalo.me/0964871054" target="_blank" rel="noopener noreferrer" aria-label="Zalo PrepMate" title="Zalo PrepMate (096 487 10 54)">
                                <span style="font-weight: 800; font-size: 11px; letter-spacing: -0.2px;">Zalo</span>
                            </a>
                            <a href="tel:+84964871054" aria-label="Hotline 096 487 10 54" title="Hotline: 096 487 10 54">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            </a>
                            <a href="mailto:interviewprepmate@gmail.com" aria-label="Email hỗ trợ" title="Email: interviewprepmate@gmail.com">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Group 2: Điều hướng -->
                <div class="footer-col">
                    <h4>Điều hướng</h4>
                    <ul>
                        <li><a href="${root}index.html">Trang chủ</a></li>
                        <li><a href="${root}features/interview/interview-info.html">Phòng phỏng vấn AI</a></li>
                        <li><a href="${root}features/qbank/qbank.html">Ngân hàng câu hỏi STAR</a></li>
                        <li><a href="${root}features/payment/pricing.html">Bảng giá & Gói PRO (99k)</a></li>
                    </ul>
                </div>

                <!-- Group 3: Hỗ trợ & Pháp lý -->
                <div class="footer-col">
                    <h4>Hỗ trợ & Pháp lý</h4>
                    <ul>
                        <li><a href="${root}features/help/help.html">Trung tâm hỗ trợ</a></li>
                        <li><a href="${root}features/about/about.html">Về chúng tôi</a></li>
                        <li><a href="${root}features/legal/legal-center.html">Trung tâm pháp lý</a></li>
                        <li><a href="${root}features/legal/legal-center.html#privacy-policy">Chính sách bảo mật</a></li>
                        <li><a href="${root}features/legal/legal-center.html#terms-of-use">Điều khoản sử dụng</a></li>
                        <li><a href="${root}features/legal/legal-center.html#payment-policy">Quy định thanh toán</a></li>
                    </ul>
                </div>

                <!-- Group 4: Liên hệ -->
                <div class="footer-col">
                    <h4>Kênh liên hệ</h4>
                    <ul>
                        <li><a href="tel:+84964871054" title="Gọi trực tiếp hotline">Hotline: 096 487 10 54</a></li>
                        <li><a href="https://zalo.me/0964871054" target="_blank" rel="noopener noreferrer" title="Nhắn tin Zalo">Zalo: 096 487 10 54</a></li>
                        <li><a href="mailto:interviewprepmate@gmail.com" title="Gửi thư điện tử">interviewprepmate@gmail.com</a></li>
                        <li><a href="https://www.facebook.com/profile.php?id=61594859141620" target="_blank" rel="noopener noreferrer" title="Fanpage Facebook chính thức">Facebook: PrepMate AI</a></li>
                        <li><span style="color: var(--pm-text-muted, #94a3b8); font-size: 13px;">LinkedIn: Đang cập nhật</span></li>
                    </ul>
                </div>
            </div>
            
            <div class="footer-bottom container">
                <p>© 2026 PrepMate AI Inc. Tất cả quyền được bảo lưu.</p>
                <div class="footer-bottom-meta">
                    <span>Hệ thống chuẩn bị phỏng vấn AI thực chiến • Hotline: 096 487 10 54</span>
                </div>
            </div>
        </footer>
        `;

        // After footer renders, apply language if available
        setTimeout(() => {
            if (typeof applyUserSettings === 'function') {
                applyUserSettings();
            }
        }, 150);
    }
}

// ── WORKSPACE FOOTER (FOR INTERNAL DASHBOARD PAGES) ──
class AppWorkspaceFooter extends HTMLElement {
    connectedCallback() {
        const isFeatures = window.location.pathname.includes('/features/');
        const root = isFeatures ? '../../' : './';
        this.innerHTML = `
        <footer class="app-workspace-footer">
            <div class="workspace-footer-left">
                <a href="${root}index.html" class="workspace-footer-badge" title="PrepMate - Về trang chủ" style="text-decoration: none;">
                    <span class="logo-mini">P</span>
                    <span class="workspace-logo-text">Prep<span>Mate</span></span>
                </a>
                <span class="workspace-footer-status">
                    <span class="workspace-footer-status-dot"></span>
                    <span>AI Engine Sẵn sàng (99.9%)</span>
                </span>
                <span style="color:#94a3b8; font-size:12px;">v2.9</span>
            </div>
            <div class="workspace-footer-right">
                <ul class="workspace-footer-links">
                    <li><a href="${root}features/about/about.html">Về chúng tôi</a></li>
                    <li><a href="${root}features/help/help.html">Trung tâm hỗ trợ</a></li>
                    <li><a href="${root}features/legal/legal-center.html">Trung tâm pháp lý</a></li>
                    <li><a href="${root}features/payment/pricing.html">Bảng giá PRO</a></li>
                    <li><a href="${root}features/interview/interview-info.html">Phỏng vấn AI</a></li>
                    <li><a href="${root}features/qbank/qbank.html">Ngân hàng câu hỏi</a></li>
                    <li><a href="${root}features/jobs/jobs.html">Cơ hội việc làm</a></li>
                    <li><a href="${root}features/profile/cv.html">CV của tôi</a></li>
                </ul>
                <span style="color:#cbd5e1;">•</span>
                <span>© 2026 PrepMate AI Inc.</span>
            </div>
        </footer>
        `;
    }
}

// Auto-enhance any static .app-workspace-footer in DOM
document.addEventListener('DOMContentLoaded', () => {
    const isFeatures = window.location.pathname.includes('/features/');
    const root = isFeatures ? '../../' : './';
    document.querySelectorAll('footer.app-workspace-footer').forEach(footer => {
        // If the footer has raw minimal content, enrich it
        if (!footer.querySelector('.workspace-footer-left')) {
            footer.removeAttribute('style');
            footer.innerHTML = `
            <div class="workspace-footer-left">
                <a href="${root}index.html" class="workspace-footer-badge" title="PrepMate - Về trang chủ" style="text-decoration: none;">
                    <span class="logo-mini">P</span>
                    <span class="workspace-logo-text">Prep<span>Mate</span></span>
                </a>
                <span class="workspace-footer-status">
                    <span class="workspace-footer-status-dot"></span>
                    <span>AI Engine Hoạt động 100%</span>
                </span>
                <span style="color:#94a3b8; font-size:12px;">v2.9</span>
            </div>
            <div class="workspace-footer-right">
                <ul class="workspace-footer-links">
                    <li><a href="${root}features/about/about.html">Về chúng tôi</a></li>
                    <li><a href="${root}features/help/help.html">Trung tâm hỗ trợ</a></li>
                    <li><a href="${root}features/legal/legal-center.html">Trung tâm pháp lý</a></li>
                    <li><a href="${root}features/payment/pricing.html">Bảng giá PRO</a></li>
                    <li><a href="${root}features/interview/interview-info.html">Phỏng vấn AI</a></li>
                    <li><a href="${root}features/qbank/qbank.html">Ngân hàng câu hỏi</a></li>
                    <li><a href="${root}features/jobs/jobs.html">Cơ hội việc làm</a></li>
                    <li><a href="${root}features/profile/cv.html">CV của tôi</a></li>
                </ul>
                <span style="color:#cbd5e1;">•</span>
                <span>© 2026 PrepMate AI Inc.</span>
            </div>
            `;
        }
    });
});

customElements.define('app-header', AppHeader);
customElements.define('app-footer', AppFooter);
customElements.define('app-workspace-footer', AppWorkspaceFooter);
