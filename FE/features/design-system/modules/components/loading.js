/**
 * PREPMATE LOADING & SKELETON COMPONENT
 * Phase: H2 — Design System & Shared Layout
 */

const Loading = {
  setButtonLoading(buttonEl, isLoading = true) {
    if (!buttonEl) return;
    if (isLoading) {
      buttonEl.classList.add('loading');
      buttonEl.setAttribute('aria-busy', 'true');
      buttonEl.disabled = true;
    } else {
      buttonEl.classList.remove('loading');
      buttonEl.removeAttribute('aria-busy');
      buttonEl.disabled = false;
    }
  },

  renderTextSkeleton(lines = 3, targetContainer) {
    if (!targetContainer) return '';
    let html = '';
    for (let i = 0; i < lines; i++) {
      const isShort = i === lines - 1;
      html += `<div class="skeleton skeleton-text ${isShort ? 'short' : ''}"></div>`;
    }
    targetContainer.innerHTML = html;
  },

  renderTableSkeleton(rows = 5, cols = 4, targetTbody) {
    if (!targetTbody) return;
    let html = '';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += '<td><div class="skeleton skeleton-text" style="height: 16px; margin: 0;"></div></td>';
      }
      html += '</tr>';
    }
    targetTbody.innerHTML = html;
  }
};

window.PM_Loading = Loading;
