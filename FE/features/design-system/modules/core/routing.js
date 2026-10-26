/**
 * PREPMATE ROUTING CORE
 * Phase: H2 — Design System & Shared Layout
 */

const Routing = {
  getRoot() {
    const isFeatures = window.location.pathname.includes('/features/');
    return isFeatures ? '../../' : './';
  },

  getCurrentPath() {
    return window.location.pathname.toLowerCase();
  },

  getCurrentHash() {
    return window.location.hash.toLowerCase();
  },

  isActive(targetFile, targetHash = null) {
    const path = this.getCurrentPath();
    const hash = this.getCurrentHash();
    const file = targetFile.toLowerCase();

    const matches = path.endsWith(file) || path.endsWith('/' + file) || (file.includes('/') && path.endsWith(file.split('/').pop()));
    if (!matches) return false;

    if (targetHash !== null) {
      return hash === targetHash.toLowerCase();
    }
    return true;
  }
};

window.PM_Routing = Routing;
