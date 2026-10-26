// ==========================================
// PREPMATE — STAGE AGENDA & CONTEXTUAL PRESENTATION
// ARCHITECTURE: INTERVIEW STAGE & HUD PRESENTATION
// ==========================================

const STAGE_AGENDA = {
  "INTRODUCTION": {
    badge: "Phần mở đầu • Giới thiệu",
    counter: "Giới thiệu bản thân",
    guidance: "Hãy giới thiệu ngắn gọn về bản thân, các thế mạnh và mục tiêu nghề nghiệp của bạn."
  },
  "TECHNICAL_ASSESSMENT": {
    badge: "Phỏng vấn Chuyên môn Trọng tâm",
    counter: "Chuyên môn trọng tâm",
    guidance: "Tập trung vào kiến trúc thực tế, giải pháp chuyên môn và các phương án tối ưu trong công việc bạn đã từng xử lý."
  },
  "BEHAVIORAL_STAR": {
    badge: "Tác phong & Hành vi (STAR)",
    counter: "Tác phong & Hành vi",
    guidance: "Chia sẻ tình huống cụ thể: bối cảnh, vai trò trực tiếp của bạn, hành động đã thực hiện và kết quả đạt được."
  },
  "SITUATIONAL_CASE": {
    badge: "Tình huống Xử lý & Ra quyết định",
    counter: "Tình huống giả định",
    guidance: "Phân tích tình huống đa chiều, cân nhắc rủi ro hệ thống và giải thích lý do lựa chọn phương án."
  },
  "CANDIDATE_QUESTIONS": {
    badge: "Phần hỏi đáp của Ứng viên",
    counter: "Ứng viên đặt câu hỏi",
    guidance: "Cơ hội để bạn tìm hiểu sâu hơn về công ty và vị trí. Bạn có thể đặt câu hỏi về: Định hướng chuyên môn • Quy trình & Đội ngũ • Lộ trình phát triển • Văn hóa làm việc."
  },
  "CLOSING": {
    badge: "Tổng kết Buổi phỏng vấn",
    counter: "Tổng kết buổi phỏng vấn",
    guidance: "Tổng kết buổi phỏng vấn. Bạn có thể chia sẻ lời cảm ơn hoặc nhận xét ngắn gọn trước khi nhận báo cáo đánh giá."
  },
  "COMPLETED": {
    badge: "Hoàn tất Phỏng vấn",
    counter: "Đã hoàn thành",
    guidance: "Buổi phỏng vấn đã hoàn tất. Báo cáo đánh giá năng lực chi tiết đã sẵn sàng."
  }
};

function updateStagePresentation(stageKey, isFollowUp = false, questionNum = 1, isTransition = false) {
  const normKey = (stageKey || "TECHNICAL_ASSESSMENT").toUpperCase();
  const cfg = STAGE_AGENDA[normKey] || STAGE_AGENDA["TECHNICAL_ASSESSMENT"];

  const badgeEl = document.getElementById("current-question-badge");
  if (badgeEl) {
    badgeEl.className = isFollowUp ? "ir-question-badge follow-up" : "ir-question-badge";
    badgeEl.textContent = isFollowUp ? "Đào sâu • Phản biện" : cfg.badge;
  }

  const counterEl = document.getElementById("question-counter");
  if (counterEl) {
    counterEl.className = "ir-progress-pill pm-status-pill active";
    let counterLabel = `<span>${cfg.counter} • <strong>Câu ${questionNum}</strong></span>`;
    if (isTransition || normKey === "CANDIDATE_QUESTIONS") {
      counterLabel = `<span>${cfg.counter} • <strong>Trao đổi hai chiều</strong></span>`;
    } else if (normKey === "INTRODUCTION") {
      counterLabel = `<span>${cfg.counter} • <strong>Khởi động</strong></span>`;
    } else if (normKey === "CLOSING") {
      counterLabel = `<span>${cfg.counter} • <strong>Hoàn tất</strong></span>`;
    } else if (normKey === "COMPLETED") {
      counterLabel = `<span>${cfg.counter}</span>`;
    }
    counterEl.innerHTML = `
      <span class="pm-status-dot active"></span>
      ${counterLabel}
    `;
  }

  const guidanceEl = document.getElementById("stage-context-guidance");
  if (guidanceEl) {
    if (isFollowUp) {
      guidanceEl.style.display = "block";
      guidanceEl.innerHTML = `<strong>Định hướng Đào sâu:</strong> Hãy bổ sung dẫn chứng cụ thể, phân tích nguyên nhân gốc hoặc làm rõ quyết định cá nhân của bạn.`;
    } else if (cfg.guidance) {
      guidanceEl.style.display = "block";
      guidanceEl.innerHTML = `<strong>Định hướng:</strong> ${cfg.guidance}`;
    } else {
      guidanceEl.style.display = "none";
    }
  }
}

if (typeof window !== "undefined") {
  window.STAGE_AGENDA = STAGE_AGENDA;
  window.updateStagePresentation = updateStagePresentation;
}
