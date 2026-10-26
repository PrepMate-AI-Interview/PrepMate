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

    let mark = 'ℹ';
    if (safeType === 'success') mark = '✓';
    else if (safeType === 'error') mark = '✕';
    else if (safeType === 'warning') mark = '⚠';

    toast.innerHTML = `
      <span style="font-weight: bold; font-size: 14px; line-height: 1;">${mark}</span>
      <div class="pm-toast-content">${message}</div>
      <button type="button" class="pm-toast-close" aria-label="Đóng thông báo" onclick="this.parentElement.remove()">✕</button>
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
