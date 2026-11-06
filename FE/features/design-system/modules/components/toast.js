/**
 * PREPMATE TOAST NOTIFICATION COMPONENT
 * Phase: H2 — Design System & Shared Layout
 */

const Toast = {
  container: null,

  getContainer() {
    if (!this.container) {
      let el = document.getElementById('pm-toast-container');
      if (!el) {
        el = document.createElement('div');
        el.id = 'pm-toast-container';
        el.className = 'pm-toast-container';
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        document.body.appendChild(el);
      }
      this.container = el;
    }
    return this.container;
  },

  show(message, type = 'info', duration = 4000) {
    const container = this.getContainer();
    const toast = document.createElement('div');
    const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    toast.className = `pm-toast pm-toast-${safeType}`;
    toast.setAttribute('role', safeType === 'error' ? 'alert' : 'status');

        const iconNameMap = {
      success: 'check-circle',
      error: 'alert-circle',
      warning: 'alert-triangle',
      info: 'info'
    };
    const iconName = iconNameMap[safeType] || 'info';
    const iconMark = (typeof window !== 'undefined' && window.PrepMateIcons && typeof window.PrepMateIcons.svg === 'function')
      ? window.PrepMateIcons.svg(iconName, { size: 16, class: 'pm-icon' })
      : `<svg class="pm-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>`;

    const closeIcon = (typeof window !== 'undefined' && window.PrepMateIcons && typeof window.PrepMateIcons.svg === 'function')
      ? window.PrepMateIcons.svg('close', { size: 14, class: 'pm-icon' })
      : '<svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';

    toast.innerHTML = `
      <span style="display:inline-flex;align-items:center;">${iconMark}</span>
      <div class="pm-toast-content">${message}</div>
      <button type="button" class="pm-toast-close" aria-label="Đóng thông báo" onclick="this.parentElement.remove()">${closeIcon}</button>
    `;

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentElement) {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(-8px)';
          toast.style.transition = 'all 0.2s ease-out';
          setTimeout(() => toast.remove(), 200);
        }
      }, duration);
    }

    return toast;
  },

  success(msg, duration) { return this.show(msg, 'success', duration); },
  error(msg, duration) { return this.show(msg, 'error', duration); },
  warning(msg, duration) { return this.show(msg, 'warning', duration); },
  info(msg, duration) { return this.show(msg, 'info', duration); }
};

window.PM_Toast = Toast;

// Enhance existing global showToast if called by legacy scripts
const _originalShowToast = window.showToast;
window.showToast = function(message, type = 'info') {
  return Toast.show(message, type);
};
