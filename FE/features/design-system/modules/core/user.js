/**
 * PREPMATE USER CORE
 * Phase: H2 — Design System & Shared Layout
 */

const User = {
  getCurrentUser() {
    if (typeof window.getCurrentUser === 'function') {
      return window.getCurrentUser();
    }
    const raw = localStorage.getItem('prepmate_user') || localStorage.getItem('currentUser');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getRole() {
    const user = this.getCurrentUser();
    if (!user || !user.role) return 'guest';
    const role = String(user.role).toLowerCase();
    if (role === 'admin') return 'admin';
    if (role === 'manager') return 'manager';
    return 'user';
  },

  isGuest() {
    return this.getRole() === 'guest';
  },

  isUser() {
    return this.getRole() === 'user';
  },

  isManager() {
    return this.getRole() === 'manager';
  },

  isAdmin() {
    return this.getRole() === 'admin';
  },

  isPro() {
    const user = this.getCurrentUser();
    return !!(user && user.subscription === 'pro');
  },

  getDisplayName() {
    const user = this.getCurrentUser();
    if (!user) return 'Khách';
    return user.fullname || user.username || 'Người dùng';
  },

  getEmail() {
    const user = this.getCurrentUser();
    return user?.email || '';
  },

  getInitial() {
    const name = this.getDisplayName();
    return (name.charAt(0) || 'U').toUpperCase();
  }
};

window.PM_User = User;
