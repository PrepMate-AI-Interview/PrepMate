// ==========================================
// INTERVIEW CONFIRMATION MODALS
// ==========================================

function showZoomStartConfirmModal() {
  const modal = document.getElementById("zoom-start-confirm-modal");
  if (!modal) {
    startInterviewSession(true);
    return;
  }

  try {
    const configStr = sessionStorage.getItem("interview_init_data");
    if (configStr) {
      const config = JSON.parse(configStr);
      const jobEl = document.getElementById("confirm-modal-job-title");
      if (jobEl) {
        let roleTitle = config.jobTitle || "Ứng viên";
        if (config.companyName) roleTitle += ` • ${config.companyName}`;
        jobEl.textContent = roleTitle;
      }
    }
  } catch (e) {}

  modal.classList.remove("hidden");
  modal.style.display = "flex";
}

function closeStartConfirmModal() {
  const modal = document.getElementById("zoom-start-confirm-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
}

function confirmAndStartInterview() {
  closeStartConfirmModal();
  startInterviewSession(true);
}

function showZoomEndConfirmDialog(answeredCount, totalCount) {
  return new Promise((resolve) => {
    const existing = document.getElementById("zoom-end-confirm-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "zoom-end-confirm-modal";
    modal.className = "zoom-confirm-overlay";
    modal.innerHTML = `
      <div class="zoom-confirm-card">
        <div class="zoom-confirm-header">
          <div class="zoom-confirm-badge">
            <span class="zoom-confirm-dot"></span>
            XÁC NHẬN KẾT THÚC PHÒNG HỌP
          </div>
          <button type="button" class="zoom-confirm-close" id="zoom-confirm-close-btn">&times;</button>
        </div>
        <div class="zoom-confirm-body">
          <div class="zoom-confirm-icon-box">
            <div class="zoom-confirm-icon">🔴</div>
          </div>
          <h3 class="zoom-confirm-title">Kết thúc buổi phỏng vấn?</h3>
          <p class="zoom-confirm-text">
            ${
              answeredCount > 0
                ? `Bạn đã hoàn thành <strong>${answeredCount} câu trả lời</strong> trong buổi phỏng vấn mô phỏng này.`
                : "Bạn chưa hoàn thành câu hỏi nào trong phiên phỏng vấn."
            }
          </p>
          <div class="zoom-confirm-tip">
            💡 AI sẽ phân tích toàn diện các câu trả lời theo <strong>chuẩn STAR</strong>, tính toán điểm năng lực và xuất <strong>Báo cáo Phân tích Phỏng vấn Chuyên sâu</strong>.
          </div>
        </div>
        <div class="zoom-confirm-actions">
          <button type="button" class="btn-zoom-cancel" id="zoom-confirm-cancel-btn">
            Tiếp tục phỏng vấn
          </button>
          <button type="button" class="btn-zoom-confirm-end" id="zoom-confirm-ok-btn">
            🔴 Kết thúc & Xuất báo cáo AI
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = (result) => {
      modal.classList.add("closing");
      setTimeout(() => {
        modal.remove();
        resolve(result);
      }, 150);
    };

    document.getElementById("zoom-confirm-ok-btn")?.addEventListener("click", () => closeModal(true));
    document.getElementById("zoom-confirm-cancel-btn")?.addEventListener("click", () => closeModal(false));
    document.getElementById("zoom-confirm-close-btn")?.addEventListener("click", () => closeModal(false));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal(false);
    });
  });
}

// Global exports for classic script interop & VM regression runner
window.showZoomStartConfirmModal = showZoomStartConfirmModal;
window.closeStartConfirmModal = closeStartConfirmModal;
window.confirmAndStartInterview = confirmAndStartInterview;
window.showZoomEndConfirmDialog = showZoomEndConfirmDialog;
