/**
 * PREPMATE AUTH CORE
 * Phase: H2 — Design System & Shared Layout
 */

const Auth = {
  getToken() {
    return localStorage.getItem('prepmate_token') || localStorage.getItem('token') || '';
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  logout(redirectUrl) {
    if (typeof window.logoutUser === 'function') {
      window.logoutUser();
      return;
    }
    localStorage.removeItem('prepmate_auth_user');
    localStorage.removeItem('prepmate_current_user');
    localStorage.removeItem('prepmate_token');
    localStorage.removeItem('prepmate_user');
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('prepmate_uploaded_cv_name');
    localStorage.removeItem('interview_init_data');
    localStorage.removeItem('prefill_jd');
    sessionStorage.clear();
    const isFeatures = window.location.pathname.includes('/features/');
    const target = redirectUrl || (isFeatures ? '../../index.html' : './index.html');
    window.location.href = target;
  },

  requireAuth(requiredRole = null) {
    const isFeatures = typeof window !== 'undefined' && window.location.pathname.includes('/features/');
    if (!this.isAuthenticated()) {

      const authUrl = isFeatures ? '../auth/auth.html' : './features/auth/auth.html';
      const currentPath = window.location.pathname + window.location.search + window.location.hash;
      window.location.href = `${authUrl}?redirect=${encodeURIComponent(currentPath)}`;
      return false;
    }
    if (requiredRole && window.PM_User) {
      const currentRole = window.PM_User.getRole();
      if (requiredRole === 'admin' && currentRole !== 'admin') {
        alert('Bạn không có quyền truy cập trang quản trị viên.');
        window.location.href = isFeatures ? '../dashboard/dashboard.html' : './features/dashboard/dashboard.html';
        return false;
      }
    }
    return true;
  }
};

window.PM_Auth = Auth;
