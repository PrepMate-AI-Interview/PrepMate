/**
 * PREPMATE TABS COMPONENT
 * Phase: H2 — Design System & Shared Layout
 */

const Tabs = {
  init(containerSelector = '.pm-tabs') {
    document.querySelectorAll(containerSelector).forEach(tabList => {
      const tabs = tabList.querySelectorAll('.pm-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const targetId = tab.getAttribute('data-tab-target');
          if (!targetId) return;

          // Deactivate siblings
          tabs.forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
          });

          // Activate this tab
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');

          // Toggle panels within parent scope or document
          const scope = tabList.closest('.pm-tabs-container') || document;
          scope.querySelectorAll('.pm-tab-panel').forEach(panel => {
            if (panel.id === targetId) {
              panel.classList.add('active');
              panel.removeAttribute('hidden');
            } else {
              panel.classList.remove('active');
              panel.setAttribute('hidden', 'true');
            }
          });
        });
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', () => Tabs.init());
window.PM_Tabs = Tabs;
