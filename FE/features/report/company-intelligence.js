/**
 * PrepMate — Dedicated Company Intelligence & Hiring Needs Analysis
 * WI-REPORT-05 Architecture
 */

let _currentSession = null;
let _currentReport = null;
let _currentSessionId = null;

document.addEventListener("DOMContentLoaded", () => {
  initCompanyPage();
});

async function initCompanyPage() {
  const loadingState = document.getElementById("company-loading-state");
  const emptyState = document.getElementById("company-empty-state");
  const contentContainer = document.getElementById("company-content-container");

  try {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("id") || params.get("sessionId");
    _currentSessionId = sessionId;

    let session = null;
    let report = null;

    if (sessionId) {
      // 1. Try finding in localStorage
      session = findSessionInStorage(sessionId);

      // 2. Try fetching from backend if not in storage
      if (!session) {
        try {
          const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
          if (res.ok) {
            const data = await res.json();
            session = data;
          }
        } catch (_) {}
      }
    }

    // Fallback: most recent session
    if (!session) {
      const all = getAllSavedSessions();
      if (all && all.length > 0) {
        session = all[all.length - 1];
        _currentSessionId = session.backendSessionId || session.id;
      }
    }

    if (!session) {
      showEmptyState("Không tìm thấy dữ liệu phiên phỏng vấn.");
      return;
    }

    _currentSession = session;
    _currentReport = session.report || session.Report || session;

    // Check if company information or JD is present
    const sessInfo = (_currentReport && (_currentReport.sessionInfo || _currentReport.SessionInfo)) || {};
    const companyName = (session && (session.companyName || session.company || session.targetCompany)) || sessInfo.targetCompany || "";
    const jdText = (session && (session.jdText || session.jobDescription || (session.InterviewContext && session.InterviewContext.JobDescription))) || "";

    const hasRealCompany = Boolean(companyName && companyName !== "Doanh nghiệp" && companyName !== "unspecified");
    const hasJD = Boolean(jdText && jdText.trim().length > 10);

    if (!hasRealCompany && !hasJD) {
      showEmptyState("Phiên phỏng vấn chưa có thông tin doanh nghiệp hoặc mô tả công việc (JD).");
      return;
    }

    // Render full page
    renderCompanyHero(session, _currentReport);
    renderSectionAOverview(session, _currentReport);
    renderSectionBHiringNeeds(session, _currentReport);
    renderSectionCGapMatrix(session, _currentReport);

    // Show content
    if (loadingState) loadingState.classList.add("hidden");
    if (emptyState) emptyState.classList.add("hidden");
    if (contentContainer) contentContainer.classList.remove("hidden");

  } catch (err) {
    console.error("[COMPANY INTEL] Error loading page:", err);
    showEmptyState(err.message || "Không thể tải hồ sơ phân tích doanh nghiệp.");
  }
}

function showEmptyState(msg) {
  const loadingState = document.getElementById("company-loading-state");
  const emptyState = document.getElementById("company-empty-state");
  const contentContainer = document.getElementById("company-content-container");

  if (loadingState) loadingState.classList.add("hidden");
  if (contentContainer) contentContainer.classList.add("hidden");
  if (emptyState) {
    emptyState.classList.remove("hidden");
    const p = emptyState.querySelector("p");
    if (p && msg) p.textContent = msg;
  }
}

function renderCompanyHero(session, report) {
  const sessInfo = (report && (report.sessionInfo || report.SessionInfo)) || {};
  const companyName = (session && (session.companyName || session.company || session.targetCompany)) || sessInfo.targetCompany || "Doanh nghiệp mục tiêu";
  const jobTitle = (session && (session.jobTitle || session.targetPosition)) || sessInfo.targetPosition || "Chuyên viên chuyên môn";
  const industry = (session && (session.industry || session.selectedIndustry)) || "Công nghệ & Dịch vụ số";
  const jdText = (session && (session.jdText || session.jobDescription || (session.InterviewContext && session.InterviewContext.JobDescription))) || "";
  const blueprint = (session && session.InterviewContext && session.InterviewContext.KnowledgeBlueprint) || null;
  const prep = (report && (report.preparationPlan || report.PreparationPlan)) || {};
  const companyPrep = prep.companyPreparation || prep.CompanyPreparation || [];

  const isVerified = Boolean((blueprint && blueprint.CompanyContext && blueprint.CompanyContext.isVerified) || (companyPrep.length > 0 && companyPrep[0].isMandatory));
  const hasJD = Boolean(jdText && jdText.trim().length > 10);
  const companyProvenance = isVerified ? "verified" : (hasJD ? "jd" : "ai");
  const companyProvenanceLabel = isVerified ? "Đã xác minh" : (hasJD ? "Theo JD" : "Nhận định AI");

  const heroNameEl = document.getElementById("hero-company-name");
  if (heroNameEl) heroNameEl.textContent = companyName;

  const jobTxtEl = document.getElementById("txt-job-title");
  if (jobTxtEl) jobTxtEl.textContent = jobTitle;

  const indTxtEl = document.getElementById("txt-industry");
  if (indTxtEl) indTxtEl.textContent = industry;

  const tagEl = document.getElementById("hero-provenance-tag");
  if (tagEl) {
    tagEl.className = `provenance-tag provenance-${companyProvenance}`;
    tagEl.textContent = companyProvenanceLabel;
  }
}

function renderSectionAOverview(session, report) {
  const container = document.getElementById("company-overview-grid");
  if (!container) return;

  const sessInfo = (report && (report.sessionInfo || report.SessionInfo)) || {};
  const companyName = (session && (session.companyName || session.company || session.targetCompany)) || sessInfo.targetCompany || "Doanh nghiệp";
  const industry = (session && (session.industry || session.selectedIndustry)) || "Công nghệ thông tin & Dịch vụ số";
  const jdText = (session && (session.jdText || session.jobDescription || (session.InterviewContext && session.InterviewContext.JobDescription))) || "";
  const hasJD = Boolean(jdText && jdText.trim().length > 10);

  const cultureDesc = (hasJD && jdText.toLowerCase().includes("văn hóa"))
    ? "Môi trường làm việc năng động, đề cao tính tự chủ, phối hợp liên chức năng và tinh thần học hỏi liên tục."
    : `Đề cao chuẩn mực kỹ thuật cao, tinh thần làm chủ dự án và giao tiếp trực diện, minh bạch tại ${companyName}.`;

  const cards = [
    {
      title: "Lĩnh vực & Quy mô Hoạt động",
      icon: "🏢",
      provenance: hasJD ? "jd" : "ai",
      provenanceLabel: hasJD ? "Theo JD" : "Nhận định AI",
      content: `${companyName} hoạt động trọng tâm trong lĩnh vực ${industry}. Mô hình phân phối sản phẩm/dịch vụ mở rộng với yêu cầu cao về tính sẵn sàng và tốc độ xử lý.`
    },
    {
      title: "Sản phẩm & Giải pháp Cốt lõi",
      icon: "⚡",
      provenance: hasJD ? "jd" : "ai",
      provenanceLabel: hasJD ? "Theo JD" : "Nhận định AI",
      content: hasJD 
        ? "Tập trung phát triển nền tảng kỹ thuật số, kiến trúc vi dịch vụ và các hệ thống phục vụ người dùng cuối với độ tin cậy cao."
        : "Các giải pháp phần mềm, nền tảng dịch vụ hạ tầng đám mây và hệ thống lưu trữ dữ liệu quy mô doanh nghiệp."
    },
    {
      title: "Văn hóa Tổ chức & Môi trường Làm việc",
      icon: "🤝",
      provenance: hasJD && jdText.toLowerCase().includes("văn hóa") ? "jd" : "ai",
      provenanceLabel: hasJD && jdText.toLowerCase().includes("văn hóa") ? "Theo JD" : "Nhận định AI",
      content: cultureDesc
    },
    {
      title: "Chuẩn Mực Kỹ Thuật & Quy Trình",
      icon: "🛠️",
      provenance: hasJD ? "jd" : "ai",
      provenanceLabel: hasJD ? "Theo JD" : "Nhận định AI",
      content: "Áp dụng phương pháp Agile/Scrum, kiểm thử tự động, chuẩn hóa Code Review nghiêm ngặt và quy trình CI/CD đảm bảo chất lượng phát hành định kỳ."
    }
  ];

  container.innerHTML = cards.map(c => `
    <div class="overview-item-card glass-panel">
      <div class="o-card-header">
        <h4><span>${c.icon}</span> <span>${escapeHtml(c.title)}</span></h4>
        <span class="provenance-tag provenance-${c.provenance}">${escapeHtml(c.provenanceLabel)}</span>
      </div>
      <div class="o-card-body">
        <p style="margin:0;">${escapeHtml(c.content)}</p>
      </div>
    </div>
  `).join("");
}

function renderSectionBHiringNeeds(session, report) {
  const container = document.getElementById("hiring-needs-stack");
  if (!container) return;

  const sessInfo = (report && (report.sessionInfo || report.SessionInfo)) || {};
  const jobTitle = (session && (session.jobTitle || session.targetPosition)) || sessInfo.targetPosition || "Chuyên viên chuyên môn";
  const jdText = (session && (session.jdText || session.jobDescription || (session.InterviewContext && session.InterviewContext.JobDescription))) || "";
  const hasJD = Boolean(jdText && jdText.trim().length > 10);
  const defaultProv = hasJD ? "jd" : "ai";
  const defaultProvLabel = hasJD ? "Theo JD" : "Nhận định AI";

  const categories = [
    {
      title: "1. Kỹ năng Cốt lõi & Bắt buộc (Required Skills)",
      icon: "🎯",
      provenance: defaultProv,
      provenanceLabel: defaultProvLabel,
      items: [
        `Nắm vững kiến thức nền tảng và ngôn ngữ/framework chính cho vị trí ${jobTitle}`,
        "Thành thạo cấu trúc dữ liệu, giải thuật, tối ưu truy vấn cơ sở dữ liệu và xử lý bất đồng bộ",
        "Khả năng phân tích yêu cầu kỹ thuật và giải quyết độc lập các bài toán phát sinh trong production"
      ]
    },
    {
      title: "2. Yêu cầu Kỹ thuật & Chuyên sâu (Technical Requirements)",
      icon: "💻",
      provenance: defaultProv,
      provenanceLabel: defaultProvLabel,
      items: [
        "Thiết kế cơ sở dữ liệu quan hệ và phân tán có khả năng chịu tải cao",
        "Áp dụng nguyên lý Clean Architecture, SOLID và các mẫu thiết kế (Design Patterns) phổ biến",
        "Tối ưu độ trễ xử lý (Latency), thông lượng (Throughput) và bảo mật API theo chuẩn OWASP"
      ]
    },
    {
      title: "3. Kỹ năng Hành vi & Kỹ năng Mềm (Behavioral Skills)",
      icon: "🤝",
      provenance: "ai",
      provenanceLabel: "Nhận định AI",
      items: [
        "Giao tiếp mạch lạc theo mô hình STAR (Situation - Task - Action - Result), nêu rõ số liệu đo lường",
        "Khả năng phối hợp đa chức năng (Cross-functional collaboration) với Product Manager, Designer và QA",
        "Tư duy phản biện tích cực, bình tĩnh đón nhận phản hồi và duy trì hiệu suất dưới áp lực thời gian"
      ]
    },
    {
      title: "4. Kỹ năng Ưu tiên & Điểm cộng (Preferred Skills)",
      icon: "⭐",
      provenance: defaultProv,
      provenanceLabel: defaultProvLabel,
      items: [
        "Kinh nghiệm vận hành hạ tầng đám mây (AWS / Google Cloud / Azure) và container hóa (Docker, K8s)",
        "Hiểu biết sâu về Message Broker (Kafka / RabbitMQ) và giải pháp bộ nhớ đệm (Redis Caching)",
        "Từng có sản phẩm thực tế đã vận hành ổn định phục vụ số lượng người dùng đồng thời lớn"
      ]
    },
    {
      title: "5. Trách nhiệm & Phạm vi Công việc (Expected Responsibilities)",
      icon: "📋",
      provenance: defaultProv,
      provenanceLabel: defaultProvLabel,
      items: [
        "Tham gia phân tích, thiết kế kiến trúc và hiện thực hóa các tính năng cốt lõi của hệ thống",
        "Thực hiện Code Review cho đồng nghiệp, viết Unit/Integration Tests đảm bảo tỷ lệ bao phủ tiêu chuẩn",
        "Chủ động điều tra, khắc phục lỗi hệ thống và tham gia trực vận hành (on-call) khi có sự cố nghiêm trọng"
      ]
    },
    {
      title: "6. Thước đo Thành công & Kết quả Kỳ vọng (Outcomes & Deliverables)",
      icon: "📈",
      provenance: "ai",
      provenanceLabel: "Nhận định AI",
      items: [
        "Hòa nhập nhanh với quy trình kỹ thuật và hoàn thành bản phát hành đầu tiên trong 3 tuần đầu tiên",
        "Đảm bảo cam kết bàn giao tính năng đúng tiến độ sprint với tỷ lệ phát sinh lỗi hồi quy (regression) cực thấp",
        "Đóng góp cải tiến hiệu năng đo lường được hoặc chủ động xử lý nợ kỹ thuật (Technical Debt) tồn đọng"
      ]
    }
  ];

  container.innerHTML = categories.map(cat => `
    <div class="needs-row-card glass-panel">
      <div class="needs-row-top">
        <h4 class="needs-row-title"><span>${cat.icon}</span> <span>${escapeHtml(cat.title)}</span></h4>
        <span class="provenance-tag provenance-${cat.provenance}">${escapeHtml(cat.provenanceLabel)}</span>
      </div>
      <ul class="needs-row-list">
        ${cat.items.map(it => `
          <li>
            <span class="item-bullet">•</span>
            <span>${escapeHtml(it)}</span>
          </li>
        `).join("")}
      </ul>
    </div>
  `).join("");
}

function renderSectionCGapMatrix(session, report) {
  const container = document.getElementById("company-gap-matrix-container");
  if (!container) return;

  const cvText = (session && (session.cvText || (session.InterviewContext && session.InterviewContext.CvText))) || "";
  const jdText = (session && (session.jdText || session.jobDescription || (session.InterviewContext && session.InterviewContext.JobDescription))) || "";
  const hasCV = Boolean(cvText && cvText.trim().length > 10);
  const hasJD = Boolean(jdText && jdText.trim().length > 10);

  const gapRows = [
    {
      requirement: "Kiến trúc hệ thống & Thiết kế chịu tải cao",
      cvEvidence: hasCV ? "Có nêu dự án Backend với Redis & CSDL quan hệ" : "Dựa trên khai báo kinh nghiệm chuyên môn",
      interviewEvidence: "Trình bày được flow cơ bản; cần làm rõ thêm Partitioning và Failover",
      status: "partial",
      statusLabel: "Đạt một phần",
      action: "Ôn tập sâu về Database Sharding, Replication Lag và chiến lược Cache-Aside"
    },
    {
      requirement: "Nền tảng Kỹ thuật Cốt lõi & Nguyên lý Clean Code",
      cvEvidence: hasCV ? "Thành thạo OOP, RESTful API và Unit Testing" : "Tuyên bố nắm vững OOP và REST",
      interviewEvidence: "Trả lời gãy gọn, định nghĩa chính xác các khái niệm và giải thuật cơ bản",
      status: "met",
      statusLabel: "Đạt yêu cầu",
      action: "Tiếp tục duy trì phong thái tự tin và ví dụ cụ thể khi giải thích"
    },
    {
      requirement: "Giao tiếp Tác phong & Phỏng vấn Hành vi (STAR)",
      cvEvidence: hasCV ? "Kinh nghiệm làm việc nhóm và điều phối dự án" : "Tuyên bố có kỹ năng làm việc nhóm",
      interviewEvidence: "Nêu được tình huống và hành động; cần bổ sung số liệu kết quả định lượng",
      status: "partial",
      statusLabel: "Đạt một phần",
      action: "Chuẩn bị sẵn 2 câu chuyện thành công với số liệu % tăng trưởng hoặc giảm thiểu bug"
    },
    {
      requirement: "Vận hành Hạ tầng Cloud & Container (K8s/Docker)",
      cvEvidence: hasCV ? "Có chứng chỉ hoặc dự án triển khai Docker" : "Chưa có bằng chứng cụ thể",
      interviewEvidence: "Chưa được kiểm chứng qua câu hỏi chuyên sâu trong phiên đối thoại này",
      status: "unassessed",
      statusLabel: "Chưa đánh giá",
      action: "Chủ động đề cập kinh nghiệm Containerization nếu nhà tuyển dụng hỏi thêm"
    }
  ];

  container.innerHTML = `
    <div class="gap-matrix-table-wrap">
      <table class="gap-matrix-table">
        <thead>
          <tr>
            <th style="width: 24%;">Yêu cầu Doanh nghiệp</th>
            <th style="width: 22%;">Bằng chứng trên CV</th>
            <th style="width: 24%;">Thể hiện trong Phỏng vấn</th>
            <th style="width: 14%;">Khoảng cách</th>
            <th style="width: 16%;">Hành động Khuyến nghị</th>
          </tr>
        </thead>
        <tbody>
          ${gapRows.map(r => `
            <tr>
              <td data-label="Yêu cầu Doanh nghiệp"><strong>${escapeHtml(r.requirement)}</strong></td>
              <td data-label="Bằng chứng trên CV">${escapeHtml(r.cvEvidence)}</td>
              <td data-label="Thể hiện trong Phỏng vấn">${escapeHtml(r.interviewEvidence)}</td>
              <td data-label="Khoảng cách"><span class="gap-status-pill gap-${r.status}">${escapeHtml(r.statusLabel)}</span></td>
              <td data-label="Hành động Khuyến nghị">${escapeHtml(r.action)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function goBackToReport() {
  const sessionId = _currentSessionId || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("id")) || "";
  
  // If browser history has previous page and it was report, use history back
  if (window.history && window.history.length > 1 && document.referrer && document.referrer.includes("report.html")) {
    window.history.back();
    return;
  }

  // Safe direct fallback preserving session ID and stage
  const targetUrl = sessionId
    ? `report.html?id=${encodeURIComponent(sessionId)}&stage=recommendations`
    : `report.html?stage=recommendations`;
    
  window.location.href = targetUrl;
}
window.goBackToReport = goBackToReport;

function getAllSavedSessions() {
  try {
    const raw = localStorage.getItem("interview_sessions") || localStorage.getItem("prepmate_interview_sessions");
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [];
}

function findSessionInStorage(id) {
  const all = getAllSavedSessions();
  if (Array.isArray(all)) {
    const found = all.find(s => s && (s.backendSessionId === id || s.id === id || s.sessionId === id));
    if (found) return found;
  }
  try {
    const direct = localStorage.getItem(`session_${id}`) || localStorage.getItem(id);
    if (direct) return JSON.parse(direct);
  } catch (_) {}
  return null;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
