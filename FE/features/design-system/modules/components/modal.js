/**
 * PREPMATE MODAL COMPONENT CONTROLLER
 * Phase: H2 — Design System & Shared Layout
 */

const Modal = {
  activeModal: null,
  previousFocusEl: null,

  open(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) {
      console.warn(`[Modal] Modal #${modalId} not found`);
      return;
    }

    this.previousFocusEl = document.activeElement;
    this.activeModal = modalEl;

    // Show backdrop
    modalEl.classList.add('open');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Focus first focusable element
    const focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length > 0) {
      setTimeout(() => focusable[0].focus(), 50);
    }
  },

  close(modalId = null) {
    const modalEl = modalId ? document.getElementById(modalId) : this.activeModal;
    if (!modalEl) return;

    modalEl.classList.remove('open');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (this.previousFocusEl && typeof this.previousFocusEl.focus === 'function') {
      this.previousFocusEl.focus();
    }

    this.activeModal = null;
    this.previousFocusEl = null;
  },

  init() {
    // Backdrop click listener
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('pm-modal-backdrop')) {
        this.close();
      }
    });

    // Close on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModal) {
        this.close();
      }
    });
  }
};

Modal.init();
window.PM_Modal = Modal;
