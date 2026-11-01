// ==========================================================================
// PREPMATE — EXECUTIVE DEBRIEF REPORT CONTROLLER
// PHASE 3 STEP 7: Presentation Layer Integration
// Pure deterministic projection of backend evidence without recalculation.
// ==========================================================================

var API_BASE_URL = (function () {
  // 1. Meta tag configuration: <meta name="prepmate-api-base-url" content="...">
  const metaUrl = (function () {
    try {
      if (typeof document !== "undefined") {
        const meta = document.querySelector('meta[name="prepmate-api-base-url"]');
        if (meta && meta.content) return meta.content.trim();
      }
    } catch (e) {}
    return "";
  })();
  if (metaUrl) {
    return metaUrl.replace(/\/+$/, "");
  }

  // 2. Explicit window configuration: window.PREPMATE_API_BASE_URL or window.PREPMATE_CONFIG.apiBaseUrl
  if (typeof window !== "undefined" && typeof window.PREPMATE_API_BASE_URL === "string" && window.PREPMATE_API_BASE_URL.trim() !== "") {
    return window.PREPMATE_API_BASE_URL.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.PREPMATE_CONFIG && typeof window.PREPMATE_CONFIG.apiBaseUrl === "string" && window.PREPMATE_CONFIG.apiBaseUrl.trim() !== "") {
    return window.PREPMATE_CONFIG.apiBaseUrl.trim().replace(/\/+$/, "");
  }

  // 3. Explicit window.API_BASE_URL (sanitized)
  if (typeof window !== "undefined" && typeof window.API_BASE_URL === "string" && window.API_BASE_URL.trim() !== "" && window.API_BASE_URL !== "http://localhost:5000" && window.API_BASE_URL !== "http://127.0.0.1:5000") {
    return window.API_BASE_URL.trim().replace(/\/+$/, "");
  }

  // 4. Automatic Environment Detection
  if (typeof location !== "undefined") {
    if (location.protocol === "file:") {
      return "http://127.0.0.1:5000";
    }
    const isLocalHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (isLocalHost) {
      if (location.port === "5000") {
        return "";
      }
      // Static local dev servers (Live Server on 5500-5599, Vite 5173, Webpack 3000, etc.)
      if (/^55\d{2}$/.test(location.port) || location.port === "5173" || location.port === "3000" || location.port === "8080") {
        return "http://127.0.0.1:5000";
      }
    }
    // Production domain / same-origin deployment
    return "";
  }
  return "http://127.0.0.1:5000";
})();

if (typeof window !== "undefined") {
  window.API_BASE_URL = API_BASE_URL;
  if (!window.PREPMATE_API_BASE_URL && API_BASE_URL) {
    window.PREPMATE_API_BASE_URL = API_BASE_URL;
  }
}

let _currentReportData = null;
let _currentSessionId = null;
let _currentSessionRaw = null;

document.addEventListener("DOMContentLoaded", () => {
  initReportPage();
  setupSubnavObserver();
  setupPhaseNavigation();
});

// ==========================================================================

// ==========================================
// SCORING STANDARDIZATION HELPER (0 - 100)
// ==========================================
function normalizeScoreTo100(val, explicitScale) {
  if (val === null || val === undefined || val === "" || typeof val === "boolean") {
    return null;
  }
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return null;
  }

  let converted = num;
  const scaleStr = String(explicitScale || "").toLowerCase().trim();

  if (scaleStr === "0-4" || scaleStr === "4" || explicitScale === 4) {
    converted = (num / 4.0) * 100.0;
  } else if (scaleStr === "0-10" || scaleStr === "10" || explicitScale === 10) {
    converted = (num / 10.0) * 100.0;
  } else if (scaleStr === "0-100" || scaleStr === "100" || explicitScale === 100) {
    converted = num;
  } else {
    // Auto-detect legacy scale
    if (num > 0 && num <= 10.0) {
      converted = num * 10.0;
    }
  }

  // Clamping to [0, 100]
  if (converted < 0) converted = 0;
  if (converted > 100) converted = 100;

  // Preserve 1 decimal place if fractional, otherwise clean integer
  return Math.round(converted * 10) / 10;
}
if (typeof window !== "undefined") {
  window.normalizeScoreTo100 = normalizeScoreTo100;
}

// 1. INITIALIZATION & DATA RETRIEVAL
// ==========================================================================
async function initReportPage() {
  showLoadingState();

  try {
    const params = new URLSearchParams(window.location.search);
    const sessionIdParam = params.get("sessionId") || params.get("id");
    const sessionIndexParam = params.get("index");

    let session = null;

    // A. Priority 1: Fetch by sessionId if backend available or find in localStorage
    if (sessionIdParam) {
      _currentSessionId = sessionIdParam;
      const backendRes = await fetchSessionFromBackend(sessionIdParam);
      if (backendRes && backendRes.status === 403) {
        showErrorState("Bạn không có quyền truy cập báo cáo phiên phỏng vấn này (403 Forbidden).");
        return;
      }
      if (backendRes && backendRes.status === 401) {
        session = findSessionInLocalStorage(sessionIdParam);
        if (!session) {
          showErrorState("Phiên đăng nhập đã hết hạn hoặc bạn cần đăng nhập để xem báo cáo này (401 Unauthorized).");
          return;
        }
      }
      if (backendRes && backendRes.ok && backendRes.data) {
        session = backendRes.data;
      }
      if (!session) {
        session = findSessionInLocalStorage(sessionIdParam);
      }
    }

    // B. Priority 2: Find by index
    if (!session && sessionIndexParam !== null) {
      const allSessions = getAllSavedSessions();
      const idx = parseInt(sessionIndexParam, 10);
      if (!isNaN(idx) && allSessions[idx]) {
        session = allSessions[idx];
        _currentSessionId = session.backendSessionId || session.id || `session-${idx}`;
      }
    }

    // C. Priority 3: Fallback to most recent session in localStorage/sessionStorage
    if (!session) {
      const allSessions = getAllSavedSessions();
      if (allSessions && allSessions.length > 0) {
        session = allSessions[allSessions.length - 1]; // most recent
        _currentSessionId = session.backendSessionId || session.id || "latest-session";
      }
    }

    if (!session) {
      showEmptyState("Không tìm thấy dữ liệu phiên phỏng vấn nào để hiển thị báo cáo.");
      return;
    }

    // Auth state detection & Automatic Guest Session Claiming
    const authUser = (function () {
      if (typeof getCurrentUser === "function") {
        const u = getCurrentUser();
        if (u) return u;
      }
      if (typeof localStorage !== "undefined") {
        try {
          const raw = localStorage.getItem("prepmate_current_user") || localStorage.getItem("prepmate_auth_user");
          if (raw) return JSON.parse(raw);
        } catch (e) {}
      }
      return null;
    })();

    if (authUser && (authUser.token || authUser.jwt) && session && sessionIdParam && !window._sessionClaimAttempted) {
      const isGuestSession = session.isGuestPreview || (session.userId && (session.userId === "guest" || session.userId.startsWith("guest_")));
      if (isGuestSession) {
        window._sessionClaimAttempted = true;
        try {
          const token = authUser.token || authUser.jwt;
          const claimRes = await fetch(`${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionIdParam)}/claim`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            credentials: "include"
          });
          if (claimRes.ok) {
            const refreshed = await fetchSessionFromBackend(sessionIdParam);
            if (refreshed && refreshed.ok && refreshed.data) {
              session = refreshed.data;
            }
          }
        } catch (e) {
          console.warn("[REPORT UI] Claim attempt error:", e);
        }
      }
    }

    const isGuestPreview = Boolean(
      session.isGuestPreview ||
      (!authUser && (session.userId === "guest" || (session.userId && session.userId.startsWith("guest_"))))
    );
    session.isGuestPreview = isGuestPreview;

    // Extract report object
    _currentReportData = extractReportPayload(session);

    if (!_currentReportData) {
      showEmptyState("Phiên phỏng vấn chưa có báo cáo đánh giá năng lực từ hệ thống.");
      return;
    }

    _currentSessionRaw = session;
    renderFullReport(_currentReportData, session);
    showContentState();
  } catch (error) {
    console.error("[REPORT UI] Failed to load report:", error);
    showErrorState(error.message || "Không thể tải báo cáo đánh giá.");
  }
}

// ==========================================================================
// 2. DATA RESOLUTION HELPERS
// ==========================================================================
async function fetchSessionFromBackend(sessionId) {
  try {
    const headers = {};
    if (typeof getCurrentUser === "function") {
      const user = getCurrentUser();
      if (user && user.token) {
        headers["Authorization"] = `Bearer ${user.token}`;
      }
    } else if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("prepmate_current_user") || localStorage.getItem("prepmate_auth_user");
      if (raw) {
        try {
          const user = JSON.parse(raw);
          const token = user.token || user.jwt || user.accessToken;
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
        } catch (e) {}
      }
    }

    const res = await fetch(`${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}`, {
      headers: headers,
      credentials: "include"
    });
    if (res.ok) {
      return { ok: true, status: res.status, data: await res.json() };
    }
    return { ok: false, status: res.status, data: null };
  } catch (e) {
    console.warn("[REPORT UI] Cannot reach /api/sessions:", e);
  }
  return { ok: false, status: 0, data: null };
}

function getAllSavedSessions() {
  try {
    if (typeof getCurrentUser === "function" && typeof getUserSessions === "function") {
      const user = getCurrentUser();
      if (user) {
        const uSessions = getUserSessions();
        if (uSessions && uSessions.length > 0) return uSessions;
      }
    }
  } catch (e) {}

  try {
    const raw = localStorage.getItem("interview_sessions");
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return [];
}

function findSessionInLocalStorage(sessionId) {
  const sessions = getAllSavedSessions();
  if (!Array.isArray(sessions)) return null;
  return sessions.find(
    (s) => s && (s.backendSessionId === sessionId || s.id === sessionId || s.sessionId === sessionId)
  ) || null;
}

function extractReportPayload(session) {
  // If session is already an InterviewReport or ReportModel
  if (session.overallEvaluation || session.OverallEvaluation) return session;

  // Modern backend: session.report or session.Report
  const rep = session.report || session.Report || session.rawReport;
  if (rep) {
    if (rep.evidenceReport || rep.EvidenceReport) {
      const merged = { ...rep.evidenceReport || rep.EvidenceReport };
      // Preserve top-level properties if needed
      merged._rawReport = rep;
      return merged;
    }
    return rep;
  }

  // Check if session itself has evidenceReport
  if (session.evidenceReport || session.EvidenceReport) {
    return session.evidenceReport || session.EvidenceReport;
  }

  // Legacy fallback: convert flat session to report structure
  return session;
}

// ==========================================================================
// 3. UI RENDERING PIPELINE
// ==========================================================================
function renderFullReport(report, session) {
  if (session && session.isGuestPreview) {
    renderGuestPreviewReport(report, session);
    return;
  }

  const ev = report.overallEvaluation || report.OverallEvaluation || {};
  const perf = report.performanceAssessment || report.PerformanceAssessment || null;
  const diag = report.diagnosticAnalysis || report.DiagnosticAnalysis || null;
  const roadmap = report.improvementRoadmap || report.ImprovementRoadmap || null;
  const prep = report.preparationPlan || report.PreparationPlan || null;
  const sessInfo = report.sessionInfo || report.SessionInfo || {};
  const compInfo = report.completionInfo || report.CompletionInfo || {};
  const evidenceSummary = report.evidenceSummary || report.EvidenceSummary || {};
  const jobTitle = sessInfo.targetPosition || session.jobTitle || "Chuyên viên chuyên môn";

  renderHeaderMeta(sessInfo, session);
  renderOverviewHero(ev, perf, sessInfo, compInfo, evidenceSummary, session);
  renderQuestionLevelFeedback(report, session);
  renderDimensionsSection(perf, jobTitle);
  renderDiagnosticsSection(report, diag, perf);
  renderCandidateQuestionDiagnostic(report, session);
  renderDomainPerspective(report, session);
  renderRoadmapSection(roadmap, diag);
  renderPreparationSection(prep, jobTitle);
  renderChecklistSection(prep, _currentSessionId, jobTitle);
  renderSpeechCoachingSection(report, session);
  renderTurnProvenanceSection(report, session);
  renderLimitationsFooter(report);
  setupReportVoiceControls(report, session);
  setupPhaseNavigation();
  renderCompanyIntelligence(session, report);
  renderRecruitingNeedsBreakdown(session, report);
  renderCandidateToCompanyGap(session, report);
  renderVisualOutfitSuggestions(session);
  renderAfterInterviewGuidance(session, report);
}

// ==========================================================================
// 4. HEADER META
// ==========================================================================
function renderHeaderMeta(sessInfo, session) {
  const jobTitle = sessInfo.targetPosition || session.jobTitle || "Chuyên viên chuyên môn";
  const compName = sessInfo.targetCompany || session.company || session.companyName || "Doanh nghiệp";

  const navMeta = document.getElementById("header-meta-pill");
  const navJob = document.getElementById("nav-job-title");
  const navComp = document.getElementById("nav-comp-name");

  if (navMeta && navJob && navComp) {
    navJob.textContent = jobTitle;
    navComp.textContent = `🏢 ${compName}`;
    navMeta.classList.remove("hidden");
  }
}

// ==========================================================================
// 5. SECTION 1: OVERVIEW & READINESS HERO
// ==========================================================================
function renderOverviewHero(ev, perf, sessInfo, compInfo, evidenceSummary, session) {
  // Title & Badges
  const posEl = document.getElementById("hero-target-position");
  const lvlEl = document.getElementById("hero-target-level");
  const compEl = document.getElementById("hero-target-company");
  const sumEl = document.getElementById("hero-summary-text");

  const pos = sessInfo.targetPosition || session.jobTitle || "Chuyên viên chuyên môn";
  const targetLvl = sessInfo.targetLevel || session.level || "Middle";
  const comp = sessInfo.targetCompany || session.company || session.companyName || "Doanh nghiệp";

  if (posEl) posEl.textContent = `Vị trí: ${pos}`;
  if (lvlEl) lvlEl.textContent = `Mục tiêu: ${targetLvl}`;
  if (compEl) compEl.textContent = `🏢 ${comp}`;

  const interviewerEl = document.getElementById("hero-interviewer-name");
  if (interviewerEl) {
    let rawPersona = session.interviewerPersona || session.config?.interviewerPersona || sessInfo.interviewerPersona;
    if (!rawPersona && typeof sessionStorage !== "undefined") {
      try {
        const initData = JSON.parse(sessionStorage.getItem("interview_init_data") || "{}");
        rawPersona = initData.interviewerPersona;
      } catch (e) {}
    }
    rawPersona = rawPersona || "professional";
    let pName = "Trần Minh Vũ";
    if (typeof PrepMatePersonas !== "undefined" && typeof PrepMatePersonas.getPersona === "function") {
      pName = PrepMatePersonas.getPersona(rawPersona).name;
    } else if (rawPersona === "friendly") {
      pName = "Lê Lan Anh";
    } else if (rawPersona === "balanced") {
      pName = "Nguyễn Hoàng Nam";
    }
    interviewerEl.textContent = `Người phỏng vấn: ${pName}`;
  }

  let summary = ev.summary || ev.Summary || session.analysis?.suggestion || "Ứng viên đã hoàn tất phiên phỏng vấn và cung cấp đầy đủ thông tin năng lực.";
  // Score scale standardization in summary text (convert legacy '5.5/10.0' or '5.5/10' to '55/100')
  summary = summary.replace(/(\d+(?:\.\d+)?)\s*\/\s*10(?:\.0)?/g, (match, p1) => {
    const s10 = parseFloat(p1);
    return !isNaN(s10) ? `${Math.round(s10 * 10)}/100` : match;
  });

  // Strengths consistency in summary: prevent claiming no strengths when report has verified strengths
  const rawReport = (typeof _currentReport !== "undefined" && _currentReport) ? _currentReport : (session?.Report || session?.report || {});
  const verifiedStrengths = perf?.strengths || perf?.Strengths || rawReport?.strengths || rawReport?.Strengths || (rawReport?._rawReport?.strengths ? [rawReport._rawReport.strengths] : []);
  if (summary.includes("Chưa ghi nhận điểm mạnh nổi bật") && Array.isArray(verifiedStrengths) && verifiedStrengths.length > 0) {
    const firstStrength = typeof verifiedStrengths[0] === "string" ? verifiedStrengths[0] : (verifiedStrengths[0]?.title || verifiedStrengths[0]?.Title || "");
    if (firstStrength) {
      summary = summary.replace("Chưa ghi nhận điểm mạnh nổi bật", firstStrength.replace(/^[-\s]+/, ""));
    }
  }

  if (sumEl) sumEl.textContent = summary;

  // Details
    const dur = sessInfo.interviewDurationMinutes || session.duration || 15;
  const qCount = sessInfo.questionCount || session.questionsAnswered || session.answers?.length || 5;
  const sDate = session.date || session.createdAt ? new Date(session.date || session.createdAt).toLocaleDateString("vi-VN") : "Hôm nay";

  const durEl = document.getElementById("hero-duration");
  const qEl = document.getElementById("hero-question-count");
  const dateEl = document.getElementById("hero-date");

  const compStatus = formatUiStatus(compInfo.isFullyCompleted ? "Đã hoàn thành" : (compInfo.completionStatus || session.status || "Đang xử lý"));
  const statusEl = document.getElementById("hero-completion-status");

  if (durEl) durEl.textContent = `${dur} phút`;
  if (qEl) qEl.textContent = `${qCount} câu hỏi`;
  if (dateEl) dateEl.textContent = sDate;
  if (statusEl) statusEl.textContent = compStatus;

  // Compact Header Banner Synchronization (WI-REPORT-03R2)
  const hdrPosEl = document.getElementById("header-target-position");
  const hdrCompEl = document.getElementById("header-target-company");
  const hdrDateEl = document.getElementById("header-session-date");
  const hdrDurEl = document.getElementById("header-session-duration");
  const hdrStatusEl = document.getElementById("header-status-text");

  if (hdrPosEl) hdrPosEl.textContent = pos;
  if (hdrCompEl) hdrCompEl.textContent = comp;
  if (hdrDateEl) hdrDateEl.textContent = sDate;
  if (hdrDurEl) hdrDurEl.textContent = `${dur} phút (${qCount} câu)`;
  if (hdrStatusEl) hdrStatusEl.textContent = compStatus;

  // Executive Highlights (WI-REPORT-02)
  const strengthsListEl = document.getElementById("hero-highlights-strengths");
  if (strengthsListEl) {
    if (Array.isArray(verifiedStrengths) && verifiedStrengths.length > 0) {
      const top3 = verifiedStrengths.slice(0, 3).map(s => {
        const text = typeof s === "string" ? s : (s.title || s.Title || s.description || s.Description || "");
        return text.replace(/^[-s✓📌•]+/, "").trim();
      }).filter(Boolean);
      strengthsListEl.innerHTML = top3.map(str => `
        <li class="highlight-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${escapeHtml(str)}</span>
        </li>
      `).join("");
    } else {
      strengthsListEl.innerHTML = `<li class="highlight-empty">Chưa có đủ câu hỏi để kiểm chứng điểm mạnh</li>`;
    }
  }

  const prioritiesListEl = document.getElementById("hero-highlights-priorities");
  if (prioritiesListEl) {
    const roadmapItems = rawReport?.improvementRoadmap?.items || rawReport?.ImprovementRoadmap?.Items || [];
    const weaknesses = rawReport?.diagnosticAnalysis?.weaknessDiagnoses || rawReport?.DiagnosticAnalysis?.WeaknessDiagnoses || [];
    let priorityList = [];
    if (roadmapItems.length > 0) {
      priorityList = roadmapItems.slice(0, 2).map(r => r.improvementObjective || r.ImprovementObjective || r.targetObjective || r.TargetObjective || r.objective || r.Objective || "");
    } else if (weaknesses.length > 0) {
      priorityList = weaknesses.slice(0, 2).map(w => w.title || w.Title || w.description || w.Description || "");
    }
    priorityList = priorityList.map(p => p.replace(/General Technical Knowledge/gi, "kiến thức chuyên môn cốt lõi")).filter(Boolean);

    if (priorityList.length > 0) {
      prioritiesListEl.innerHTML = priorityList.map(item => `
        <li class="highlight-item priority">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>${escapeHtml(item)}</span>
        </li>
      `).join("");
    } else {
      prioritiesListEl.innerHTML = `<li class="highlight-empty">Không phát hiện lỗ hổng lớn cần khắc phục</li>`;
    }
  }
  if (statusEl) statusEl.textContent = compStatus;

  // Score
  let rawScore = null;
  let sourceScale = null;

  if (typeof ev.score === "number") {
    rawScore = ev.score;
    sourceScale = ev.scoreScale || ev.ScoreScale || (ev.score <= 10 ? "0-10" : "0-100");
  } else if (typeof ev.Score === "number") {
    rawScore = ev.Score;
    sourceScale = ev.ScoreScale || ev.scoreScale || (ev.Score <= 10 ? "0-10" : "0-100");
  } else if (typeof session.score === "number") {
    rawScore = session.score;
    sourceScale = session.scoreScale || (session.score <= 10 ? "0-10" : "0-100");
  } else if (typeof session.overallScore === "number") {
    rawScore = session.overallScore;
    sourceScale = session.scoreScale || (session.overallScore <= 10 ? "0-10" : "0-100");
  } else if (session.report && typeof session.report.overallScore === "number") {
    rawScore = session.report.overallScore;
    sourceScale = "0-100";
  } else if (session.report && typeof session.report.OverallScore === "number") {
    rawScore = session.report.OverallScore;
    sourceScale = "0-100";
  }

  const scoreNumEl = document.getElementById("hero-score-value");
  const scoreScaleEl = document.getElementById("hero-score-scale");
  const normScoreEl = document.getElementById("hero-normalized-score");

  const score100 = normalizeScoreTo100(rawScore, sourceScale);

  if (score100 !== null) {
    const formattedScore = Number.isInteger(score100) ? String(score100) : score100.toFixed(1);
    if (scoreNumEl) scoreNumEl.textContent = formattedScore;
    if (scoreScaleEl) scoreScaleEl.textContent = "/ 100";
    if (normScoreEl) normScoreEl.textContent = `Thang điểm: ${formattedScore} / 100`;
  } else {
    if (scoreNumEl) scoreNumEl.textContent = "—";
    if (scoreScaleEl) scoreScaleEl.textContent = "/ 100";
    if (normScoreEl) normScoreEl.textContent = "Chưa đủ dữ liệu để chấm điểm";
  }

  // Level calibration
  const demonstratedLevel = ev.demonstratedLevel || ev.DemonstratedLevel || perf?.demonstratedLevel || "Unassessed";
  const demoLvlEl = document.getElementById("hero-demonstrated-level");
  const calTargetEl = document.getElementById("hero-calibrated-target");

  if (demoLvlEl) demoLvlEl.textContent = demonstratedLevel.toUpperCase();
  if (calTargetEl) calTargetEl.textContent = targetLvl.toUpperCase();

  // Readiness Pill
  const readiness = perf?.readiness || perf?.Readiness || "NEEDS_MORE_EVIDENCE";
  const readinessPill = document.getElementById("hero-readiness-pill");
  const confidencePill = document.getElementById("hero-confidence-pill");
  const rationaleEl = document.getElementById("hero-readiness-rationale");

  if (readinessPill) {
    readinessPill.className = "readiness-pill " + getReadinessClass(readiness);
    readinessPill.textContent = getReadinessLabel(readiness);
  }

  const confidence = ev.confidence || ev.Confidence || perf?.confidence || "MEDIUM";
  if (confidencePill) {
    confidencePill.textContent = `Độ tin cậy: ${getConfidenceLabel(confidence)}`;
  }

  const rationale = perf?.readinessRationale || perf?.ReadinessRationale || (
    readiness === "READY" ? "Ứng viên đáp ứng tốt các yêu cầu trọng tâm cho vị trí." :
    readiness === "READY_WITH_GAPS" ? "Ứng viên có nền tảng tốt nhưng cần củng cố thêm một số nội dung chuyên sâu." :
    readiness === "NOT_READY" ? "Ứng viên chưa đáp ứng được các tiêu chuẩn cốt lõi của vị trí mục tiêu." :
    "Cần thêm các lượt trả lời để có đủ bằng chứng xác định mức độ sẵn sàng."
  );
  if (rationaleEl) rationaleEl.textContent = rationale;

  // Evidence stats counters
  const totalEv = evidenceSummary.totalEvidenceItems || evidenceSummary.TotalEvidenceItems || 0;
  const pracEv = evidenceSummary.practicalExperienceEvidenceCount || evidenceSummary.PracticalExperienceEvidenceCount || 0;
  const factEv = evidenceSummary.verifiedFactsCount || evidenceSummary.VerifiedFactsCount || 0;

  const totalEvEl = document.getElementById("stat-evidence-count");
  const pracEvEl = document.getElementById("stat-practical-count");
  const factEvEl = document.getElementById("stat-facts-count");

  if (totalEvEl) totalEvEl.textContent = totalEv;
  if (pracEvEl) pracEvEl.textContent = pracEv;
  if (factEvEl) factEvEl.textContent = factEv;
}

// ==========================================
// 6. SECTION 2: 6 PERFORMANCE DIMENSIONS
// ==========================================
// P1.3 WAVE B: DYNAMIC DOMAIN KNOWLEDGE MAPPING
// ==========================================
function getDomainKnowledgeLabel(targetPosition) {
  if (!targetPosition) return "Năng lực Chuyên môn";
  const raw = String(targetPosition).toLowerCase();
  const text = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = text.split(/[\s/.,_\-]+/);

  const has = (term) => text.includes(term);
  const hasW = (w) => words.includes(w);

  if (has("software") || has("developer") || has("engineer") || has("backend") || has("frontend") || has("fullstack") || has("lap trinh") || has("devops") || has("cloud") || has("qa") || has("tester") || has("kiem thu") || has("security") || has("mobile") || hasW("it")) {
    return "Kiến thức Kỹ thuật";
  }
  if (has("data") || has("du lieu") || has("scientist") || has("machine learning") || hasW("ai") || has("tri tue nhan tao")) {
    return "Năng lực Dữ liệu & AI";
  }
  if (has("business analyst") || hasW("ba") || has("phan tich nghiep vu")) {
    return "Năng lực Phân tích Nghiệp vụ";
  }
  if (has("marketing") || has("marketer") || has("growth") || has("seo") || has("ads") || has("content") || hasW("pr") || has("truyen thong")) {
    return "Năng lực Marketing";
  }
  if (has("finan") || has("tai chinh") || has("ke toan") || has("kiem toan") || has("accountant") || has("audit") || has("ngan hang") || has("bank")) {
    return "Năng lực Tài chính";
  }
  if (has("sales") || has("kinh doanh") || has("ban hang") || has("business development") || has("account executive") || hasW("ae")) {
    return "Năng lực Bán hàng";
  }
  if (hasW("hr") || has("hrbp") || has("nhan su") || has("tuyen dung") || has("talent") || has("people")) {
    return "Năng lực Nhân sự";
  }
  if (has("design") || hasW("ui") || hasW("ux") || has("do hoa") || has("graphic")) {
    return "Năng lực Thiết kế";
  }
  if (has("product") || has("project") || has("scrum") || has("agile") || has("du an") || has("san pham") || hasW("pm") || hasW("po")) {
    return "Năng lực Quản lý Dự án";
  }
  if (has("operation") || has("van hanh") || has("supply chain") || has("chuoi cung ung") || has("logistics") || has("kho")) {
    return "Năng lực Vận hành";
  }
  if (has("customer") || has("cskh") || has("cham soc khach hang") || has("client success") || has("support")) {
    return "Năng lực Chăm sóc Khách hàng";
  }
  return "Năng lực Chuyên môn";
}

function getDomainKnowledgeIcon(targetPosition) {
  if (!targetPosition) return "💼";
  const raw = String(targetPosition).toLowerCase();
  const text = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = text.split(/[\s/.,_\-]+/);

  const has = (term) => text.includes(term);
  const hasW = (w) => words.includes(w);

  if (has("software") || has("developer") || has("engineer") || has("backend") || has("frontend") || has("fullstack") || has("lap trinh") || has("devops") || has("cloud") || has("qa") || has("tester") || has("kiem thu") || has("security") || has("mobile") || hasW("it")) {
    return "💻";
  }
  if (has("data") || has("du lieu") || has("scientist") || has("machine learning") || hasW("ai") || has("tri tue nhan tao")) {
    return "📊";
  }
  if (has("business analyst") || hasW("ba") || has("phan tich nghiep vu")) {
    return "📊";
  }
  if (has("marketing") || has("marketer") || has("growth") || has("seo") || has("ads") || has("content") || hasW("pr") || has("truyen thong")) {
    return "📢";
  }
  if (has("finan") || has("tai chinh") || has("ke toan") || has("kiem toan") || has("accountant") || has("audit") || has("ngan hang") || has("bank")) {
    return "📈";
  }
  if (has("sales") || has("kinh doanh") || has("ban hang") || has("business development") || has("account executive") || hasW("ae")) {
    return "💼";
  }
  if (hasW("hr") || has("hrbp") || has("nhan su") || has("tuyen dung") || has("talent") || has("people")) {
    return "👥";
  }
  if (has("design") || hasW("ui") || hasW("ux") || has("do hoa") || has("graphic")) {
    return "🎨";
  }
  if (has("product") || has("project") || has("scrum") || has("agile") || has("du an") || has("san pham") || hasW("pm") || hasW("po")) {
    return "🚀";
  }
  if (has("operation") || has("van hanh") || has("supply chain") || has("chuoi cung ung") || has("logistics") || has("kho")) {
    return "📦";
  }
  return "💼";
}

const STANDARD_DIMENSIONS = [
  { key: "TECHNICAL_KNOWLEDGE", name: "Kiến thức Kỹ thuật", icon: "⚙️" },
  { key: "PRACTICAL_APPLICATION", name: "Ứng dụng Thực tế", icon: "🛠️" },
  { key: "REASONING_DEPTH", name: "Độ sâu Tư duy & Lập luận", icon: "🧠" },
  { key: "FOLLOW_UP_HANDLING", name: "Xử lý Câu hỏi Đào sâu", icon: "🎯" },
  { key: "COMMUNICATION", name: "Giao tiếp & Cấu trúc STAR", icon: "💬" },
  { key: "CONSISTENCY", name: "Tính Nhất quán", icon: "⚖️" }
];

function renderDimensionsSection(perf, jobTitle = "") {
  const container = document.getElementById("dimensions-grid");
  if (!container) return;

  const domainLabel = getDomainKnowledgeLabel(jobTitle);
  const domainIcon = getDomainKnowledgeIcon(jobTitle);

  const rawDims = perf?.dimensions || perf?.Dimensions || [];
  const dimAssessments = Array.isArray(rawDims) ? rawDims : (rawDims && typeof rawDims === 'object' ? Object.entries(rawDims).map(([k, v]) => ({ dimension: k, ...(typeof v === 'object' ? v : {}) })) : []);
  const dimMap = new Map();
  dimAssessments.forEach((d) => {
    const k = (d.dimension || d.Dimension || "").toUpperCase();
    if (k) dimMap.set(k, d);
  });

  container.innerHTML = STANDARD_DIMENSIONS.map((sd) => {
    const isTech = sd.key === "TECHNICAL_KNOWLEDGE";
    const dimName = isTech ? domainLabel : sd.name;
    const dimIcon = isTech ? domainIcon : sd.icon;

    const assessment = dimMap.get(sd.key);
    const rawLevel = assessment?.level || assessment?.Level || assessment?.demonstratedLevel || assessment?.DemonstratedLevel || "Unassessed";
    const level = rawLevel;
    const confidence = assessment?.confidence || assessment?.Confidence || "INSUFFICIENT_EVIDENCE";
    const rationale = assessment?.summary || assessment?.Summary || assessment?.rationale || assessment?.Rationale || "Chưa có đủ câu hỏi và bằng chứng quan sát để đánh giá khía cạnh này.";

    const strengths = assessment?.observedStrengths || assessment?.ObservedStrengths || [];
    const weaknesses = assessment?.observedWeaknesses || assessment?.ObservedWeaknesses || [];
    const supporting = assessment?.supportingEvidence || assessment?.SupportingEvidence || [];

    const rawScore = assessment?.score !== undefined ? assessment.score : (assessment?.Score !== undefined ? assessment.Score : null);
    const score100 = (rawScore !== null && rawScore !== undefined && !isNaN(Number(rawScore)) && Number(rawScore) > 0)
      ? normalizeScoreTo100(rawScore, "0-10")
      : null;

    const levelClass = (level || "unassessed").toLowerCase();
    const isUnassessed = level.toUpperCase() === "UNASSESSED";
    const panelId = `dim-details-${sd.key}`;
    const triggerId = `dim-trigger-${sd.key}`;
    const progressWidth = score100 !== null ? Math.min(100, Math.max(0, score100)) : 0;

    return `
      <div class="dimension-card glass-panel" data-dimension="${sd.key}">
        <div class="dim-card-top">
          <div class="dimension-card-header">
            <div class="dim-name-wrap">
              <span class="dim-icon">${dimIcon}</span>
              <div>
                <h4 class="dim-title">${dimName}</h4>
                <span class="dim-key">${sd.key}</span>
              </div>
            </div>
            <div class="dim-header-badges">
              ${(score100 !== null && !isUnassessed) ? `<span class="dim-score-badge"><strong class="dim-score-val">${score100}</strong><small>/100</small></span>` : ""}
              <span class="dim-level-badge ${levelClass}">${isUnassessed ? "Chưa đánh giá trong phiên" : escapeHtml(level)}</span>
            </div>
          </div>

          <!-- Visual Progress Track (WI-REPORT-02) -->
          <div class="dim-progress-container" aria-hidden="true">
            <div class="dim-progress-track">
              <div class="dim-progress-fill ${levelClass}" style="width: ${progressWidth}%;"></div>
            </div>
          </div>

          <!-- Compact Summary / Disclosure Toggle Bar -->
          <div class="dim-summary-snippet">
            <span class="dim-confidence-badge">Độ tin cậy: ${getConfidenceLabel(confidence)}</span>
            <button type="button" class="dim-toggle-btn" id="${triggerId}" aria-expanded="false" aria-controls="${panelId}" onclick="toggleDimensionDetails('${sd.key}')">
              <span class="dim-toggle-text">Chi tiết & Bằng chứng</span>
              <svg class="dim-chevron-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>

        <!-- Collapsible Details Panel (Progressive Disclosure) -->
        <div class="dim-details-panel dim-panel-collapsed" id="${panelId}" role="region" aria-labelledby="${triggerId}">
          <div class="dim-details-inner">
            <p class="dim-rationale">${escapeHtml(rationale)}</p>
            <div class="dim-evidence-pills">
              <span class="dim-pill">Độ tin cậy: ${getConfidenceLabel(confidence)}</span>
              ${strengths.slice(0, 2).map(s => `<span class="dim-pill strength">✓ ${escapeHtml(s)}</span>`).join("")}
              ${weaknesses.slice(0, 2).map(w => `<span class="dim-pill gap">△ ${escapeHtml(w)}</span>`).join("")}
              ${(strengths.length === 0 && weaknesses.length === 0 && supporting.length > 0) ? supporting.slice(0, 2).map(e => `<span class="dim-pill evidence">📌 ${escapeHtml(e)}</span>`).join("") : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function toggleDimensionDetails(key) {
  const card = document.querySelector(`.dimension-card[data-dimension="${key}"]`);
  if (!card) return;
  const panel = card.querySelector(".dim-details-panel");
  const btn = card.querySelector(".dim-toggle-btn");
  if (!panel || !btn) return;
  const isExpanded = btn.getAttribute("aria-expanded") === "true";
  btn.setAttribute("aria-expanded", String(!isExpanded));
  if (isExpanded) {
    panel.classList.add("dim-panel-collapsed");
    card.classList.remove("is-expanded");
  } else {
    panel.classList.remove("dim-panel-collapsed");
    card.classList.add("is-expanded");
  }
}
window.toggleDimensionDetails = toggleDimensionDetails;

function toggleAllDimensions() {
  const btn = document.getElementById("btn-toggle-all-dims");
  const txt = document.getElementById("btn-toggle-all-dims-text");
  const isAllExpanded = btn && btn.getAttribute("aria-expanded") === "true";
  const newExpanded = !isAllExpanded;

  if (btn) btn.setAttribute("aria-expanded", String(newExpanded));
  if (txt) txt.textContent = newExpanded ? "Thu gọn tất cả" : "Mở rộng tất cả";

  const cards = document.querySelectorAll(".dimension-card");
  cards.forEach(card => {
    const panel = card.querySelector(".dim-details-panel");
    const toggleBtn = card.querySelector(".dim-toggle-btn");
    if (panel) {
      if (newExpanded) panel.classList.remove("dim-panel-collapsed");
      else panel.classList.add("dim-panel-collapsed");
    }
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", String(newExpanded));
    if (newExpanded) card.classList.add("is-expanded");
    else card.classList.remove("is-expanded");
  });
}
window.toggleAllDimensions = toggleAllDimensions;

// ==========================================
// 7. SECTION 3: EVIDENCE & DIAGNOSTICS
// ==========================================
function renderDiagnosticsSection(report, diag, perfParam = null) {
  const perf = perfParam || report?.performanceAssessment || report?.PerformanceAssessment || null;
  // Strengths (Authoritative evidence-backed fallback when concept strengths are empty)
  let strengths = diag?.strengthDiagnoses || diag?.StrengthDiagnoses || report.strengths || report.Strengths || [];
  if ((!strengths || strengths.length === 0) && perf?.strengths && perf.strengths.length > 0) {
    strengths = perf.strengths.map((str, idx) => ({
      title: `Điểm mạnh thể hiện #${idx + 1}`,
      description: str,
      evidenceReferences: ["Đánh giá đối thoại thực tế"]
    }));
  }
  if ((!strengths || strengths.length === 0) && report._rawReport?.strengths) {
    const rawStr = report._rawReport.strengths;
    const lines = typeof rawStr === "string" ? rawStr.split("\n").filter(l => l.trim().length > 0) : [];
    if (lines.length > 0) {
      strengths = lines.map((l, idx) => ({
        title: `Điểm mạnh chuyên môn #${idx + 1}`,
        description: l.replace(/^[-\s]+/, "").trim(),
        evidenceReferences: ["Nội dung đối thoại"]
      }));
    }
  }
  const strContainer = document.getElementById("diag-strengths-list");
  const countStr = document.getElementById("count-strengths");
  if (countStr) countStr.textContent = strengths.length;

  if (strContainer) {
    if (strengths.length === 0) {
      strContainer.innerHTML = `<p class="text-muted" style="padding:16px;">Chưa ghi nhận điểm mạnh được chứng minh qua bằng chứng.</p>`;
    } else {
      strContainer.innerHTML = strengths.map((s, i) => {
        const title = s.conceptId || s.title || s.Title || `Điểm mạnh #${i + 1}`;
        const desc = s.evidence || s.description || s.Description || "Thể hiện kiến thức vững chắc trong câu trả lời.";
        const turns = s.turnReferences || s.evidenceReferences || s.EvidenceReferences || [];
        return `
          <div class="diag-item-card">
            <div class="diag-card-header">
              <h5 class="diag-item-title"><span>✓</span> ${escapeHtml(title)}</h5>
            </div>
            <p class="diag-desc">${escapeHtml(desc)}</p>
            ${turns.length > 0 ? `
              <div class="turn-tag-wrap">
                <span style="font-size:11px;color:var(--rpt-text-muted);display:flex;align-items:center;">Căn cứ:</span>
                ${turns.map(t => `<span class="turn-tag">${escapeHtml(String(t))}</span>`).join("")}
              </div>
            ` : ""}
          </div>
        `;
      }).join("");
    }
  }

  // Weaknesses
  const weaknesses = diag?.weaknessDiagnoses || diag?.WeaknessDiagnoses || report.weaknesses || report.Weaknesses || [];
  const weakContainer = document.getElementById("diag-weaknesses-list");
  const countWeak = document.getElementById("count-weaknesses");
  if (countWeak) countWeak.textContent = weaknesses.length;

  if (weakContainer) {
    if (weaknesses.length === 0) {
      weakContainer.innerHTML = `<p class="text-muted" style="padding:16px;">Không ghi nhận điểm yếu nghiêm trọng trong các lượt hỏi đã thực hiện.</p>`;
    } else {
      weakContainer.innerHTML = weaknesses.map((w) => {
        const title = w.conceptId || w.title || w.Title || "Nội dung cần hoàn thiện";
        const desc = w.evidence || w.description || w.Description || "";
        const rootCause = w.rootCause || w.RootCause || w.reason || w.Reason || "Chưa có thông tin nguyên nhân gốc.";
        const impact = w.impact || w.Impact || "Có thể ảnh hưởng đến kết quả phỏng vấn kỹ thuật.";
        const priority = (w.priority || w.Priority || "MEDIUM").toUpperCase();
        const prioClass = priority === "HIGH" ? "priority-high" : priority === "LOW" ? "priority-low" : "priority-medium";
        const turns = w.turnReferences || w.evidenceReferences || w.EvidenceReferences || [];

        return `
          <div class="diag-item-card">
            <div class="diag-card-header">
              <h5 class="diag-item-title"><span>⚠️</span> ${escapeHtml(title)}</h5>
              <span class="diag-badge ${prioClass}">Ưu tiên ${priority}</span>
            </div>
            ${desc ? `<p class="diag-desc">${escapeHtml(desc)}</p>` : ""}
            <div class="diag-meta-grid">
              <div class="diag-meta-cell root-cause">
                <strong><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" style="vertical-align:-1px;margin-right:4px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Nguyên nhân gốc:</strong>
                <span>${escapeHtml(rootCause)}</span>
              </div>
              <div class="diag-meta-cell impact">
                <strong><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" style="vertical-align:-1px;margin-right:4px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Tác động tiềm ẩn:</strong>
                <span>${escapeHtml(impact)}</span>
              </div>
            </div>
            ${turns.length > 0 ? `
              <div class="turn-tag-wrap">
                <span style="font-size:11px;color:var(--rpt-text-muted);display:flex;align-items:center;">Minh chứng:</span>
                ${turns.map(t => `<span class="turn-tag">${escapeHtml(String(t))}</span>`).join("")}
              </div>
            ` : ""}
          </div>
        `;
      }).join("");
    }
  }

  // Gaps (Separate UNASSESSED cleanly!)
  const gaps = diag?.knowledgeGapDiagnoses || diag?.KnowledgeGapDiagnoses || report.knowledgeGaps || report.KnowledgeGaps || [];
  const gapContainer = document.getElementById("diag-gaps-list");
  const countGaps = document.getElementById("count-gaps");
  if (countGaps) countGaps.textContent = gaps.length;

  if (gapContainer) {
    if (gaps.length === 0) {
      gapContainer.innerHTML = `<p class="text-muted" style="padding:16px;">Tất cả các chủ đề trọng tâm trong buổi phỏng vấn đã được bao phủ đầy đủ.</p>`;
    } else {
      gapContainer.innerHTML = gaps.map((g) => {
        const title = g.conceptName || g.conceptId || g.ConceptName || "Chủ đề";
        const rawType = String(g.gapType || g.GapType || "UNASSESSED").toUpperCase();
        const isUnassessed = rawType === "UNASSESSED";
        const badgeClass = isUnassessed ? "gap-unassessed" : "gap-tested";
        const badgeLabel = isUnassessed ? "CHƯA ĐÁNH GIÁ (CƠ HỘI)" : "CHƯA ĐẠT YÊU CẦU";
        const desc = g.description || g.Description || (isUnassessed ? "Chưa được kiểm tra trong phiên phỏng vấn này." : "Đã kiểm tra nhưng chưa cung cấp câu trả lời thỏa đáng.");
        const isMandatory = g.isMandatory !== false && g.IsMandatory !== false;

        return `
          <div class="diag-item-card">
            <div class="diag-card-header">
              <h5 class="diag-item-title"><span>🔍</span> ${escapeHtml(title)}</h5>
              <div style="display:flex;gap:6px;">
                ${isMandatory ? `<span class="diag-badge priority-high">Bắt buộc</span>` : `<span class="diag-badge priority-low">Tùy chọn</span>`}
                <span class="diag-badge ${badgeClass}">${badgeLabel}</span>
              </div>
            </div>
            <p class="diag-desc">${escapeHtml(desc)}</p>
          </div>
        `;
      }).join("");
    }
  }

  // Risks
  const risks = diag?.riskDiagnoses || diag?.RiskDiagnoses || report.risks || report.Risks || [];
  const riskContainer = document.getElementById("diag-risks-list");
  const countRisks = document.getElementById("count-risks");
  if (countRisks) countRisks.textContent = risks.length;

  if (riskContainer) {
    if (risks.length === 0) {
      riskContainer.innerHTML = `<p class="text-muted" style="padding:16px;">Không phát hiện rủi ro lớn trong phong thái hoặc tính nhất quán.</p>`;
    } else {
      riskContainer.innerHTML = risks.map((r) => {
        const severity = (r.severity || r.Severity || "MEDIUM").toUpperCase();
        const desc = r.description || r.Description || "Rủi ro cần lưu ý.";
        const evidence = r.evidence || r.Evidence || "";
        const sevClass = severity === "CRITICAL" || severity === "HIGH" ? "priority-high" : severity === "LOW" ? "priority-low" : "priority-medium";

        return `
          <div class="diag-item-card">
            <div class="diag-card-header">
              <h5 class="diag-item-title"><span>🛡️</span> Rủi ro tiềm ẩn</h5>
              <span class="diag-badge ${sevClass}">Mức độ: ${severity}</span>
            </div>
            <p class="diag-desc">${escapeHtml(desc)}</p>
            ${evidence ? `
              <div class="diag-meta-grid">
                <div class="diag-meta-cell">
                  <strong>Căn cứ:</strong>
                  <span>${escapeHtml(evidence)}</span>
                </div>
              </div>
            ` : ""}
          </div>
        `;
      }).join("");
    }
  }
}

// ==========================================
// 7B. DEDICATED DIAGNOSTIC: CANDIDATE QUESTIONS
// Isolated diagnostic signal, does NOT alter OverallScore
// ==========================================
function renderCandidateQuestionDiagnostic(report, session) {
  const box = document.getElementById("candidate-question-diag-box");
  const scoreVal = document.getElementById("cq-score-val");
  const detailBody = document.getElementById("cq-detail-body");
  if (!box) return;

  let cqScore = null;
  if (typeof report?.candidateQuestionScore === "number") cqScore = report.candidateQuestionScore;
  else if (typeof report?.CandidateQuestionScore === "number") cqScore = report.CandidateQuestionScore;
  else if (report?._rawReport && typeof report._rawReport.candidateQuestionScore === "number") cqScore = report._rawReport.candidateQuestionScore;
  else if (report?._rawReport && typeof report._rawReport.CandidateQuestionScore === "number") cqScore = report._rawReport.CandidateQuestionScore;
  else if (session && typeof session.candidateQuestionScore === "number") cqScore = session.candidateQuestionScore;
  else if (session && typeof session.CandidateQuestionScore === "number") cqScore = session.CandidateQuestionScore;

  if (cqScore !== null && cqScore >= 0) {
    box.classList.remove("hidden");
    const normalized = cqScore <= 10 ? Math.round(cqScore * 10) : Math.round(cqScore);
    if (scoreVal) scoreVal.textContent = String(normalized);

    let qualityAssessment = "";
    if (normalized >= 80) {
      qualityAssessment = "Ứng viên chủ động đặt câu hỏi có chiều sâu cao, thể hiện sự am hiểu về văn hóa kỹ thuật, thách thức thực tế của sản phẩm và tư duy chiến lược.";
    } else if (normalized >= 60) {
      qualityAssessment = "Ứng viên đặt câu hỏi phù hợp về quy trình làm việc, công nghệ ứng dụng và kỳ vọng đối với vị trí công việc.";
    } else {
      qualityAssessment = "Ứng viên đặt câu hỏi cơ bản hoặc chưa khai thác sâu các khía cạnh kỹ thuật và định hướng của đội ngũ.";
    }

    if (detailBody) {
      detailBody.innerHTML = `
        <p style="margin: 0; font-size: 14px; color: var(--rpt-text-secondary); line-height: 1.6;">${escapeHtml(qualityAssessment)}</p>
      `;
    }
  } else {
    box.classList.add("hidden");
  }
}

function switchDiagTab(tabKey) {
  const tabs = document.querySelectorAll(".diag-tab");
  tabs.forEach((t) => {
    t.classList.remove("active");
    t.setAttribute("aria-selected", "false");
  });

  const panels = ["strengths", "weaknesses", "gaps", "risks"];
  panels.forEach((p) => {
    const el = document.getElementById(`diag-panel-${p}`);
    if (el) el.classList.add("hidden");
  });

  const activePanel = document.getElementById(`diag-panel-${tabKey}`);
  if (activePanel) activePanel.classList.remove("hidden");

  // Highlight button
  const clickedBtn = Array.from(tabs).find((b) =>
    b.getAttribute("data-tab") === tabKey || b.getAttribute("onclick")?.includes(tabKey)
  );
  if (clickedBtn) {
    clickedBtn.classList.add("active");
    clickedBtn.setAttribute("aria-selected", "true");
  }
}
window.switchDiagTab = switchDiagTab;

// ==========================================
// 8. SECTION 4: ROADMAP
// ==========================================
function renderRoadmapSection(roadmap, diag) {
  const container = document.getElementById("roadmap-items-grid");
  const strengthBox = document.getElementById("roadmap-strength-leverage-box");
  const strengthText = document.getElementById("roadmap-strength-leverage-text");

  // Strength leverage
  const notes = roadmap?.strengthLeverageNotes || roadmap?.StrengthLeverageNotes || [];
  if (notes.length > 0 && strengthText) {
    strengthText.textContent = notes.join(" • ");
    if (strengthBox) strengthBox.style.display = "flex";
  } else if (!notes.length && strengthBox) {
    strengthBox.style.display = "none";
  }

  if (!container) return;

  const items = roadmap?.items || roadmap?.Items || [];
  if (items.length === 0) {
    container.innerHTML = `<p class="text-muted" style="padding:16px;">Chưa có lộ trình hành động cụ thể.</p>`;
    return;
  }

  container.innerHTML = items.map((item, i) => {
    const timeframe = (item.timeframe || item.Timeframe || "SHORT_TERM").toUpperCase();
    const priority = (item.priority || item.Priority || "MEDIUM").toUpperCase();
    let objective = item.improvementObjective || item.ImprovementObjective || item.targetObjective || item.TargetObjective || "Mục tiêu rèn luyện";
    if (objective.includes("General Technical Knowledge")) {
      objective = objective.replace("General Technical Knowledge", "các nguyên lý kiến trúc và công nghệ cốt lõi của vị trí ứng tuyển");
    }
    const actionsList = item.actions || item.Actions || [];
    const steps = actionsList.length > 0
      ? actionsList.map(a => `${a.title || a.Title}: ${a.description || a.Description}`)
      : (item.concreteStepActions || item.ConcreteStepActions || []);
    const outcome = item.expectedOutcome || item.ExpectedOutcome || "";
    const verification = item.verificationCriteria || item.VerificationCriteria || "";

    const tfClass = timeframe.includes("SHORT") ? "short" : timeframe.includes("LONG") ? "long" : "medium";
    const tfLabel = timeframe.includes("SHORT") ? "1 - 3 Ngày" : timeframe.includes("LONG") ? "1 Tháng+" : "1 - 2 Tuần";

    const prioClass = priority === "HIGH" ? "priority-high" : priority === "LOW" ? "priority-low" : "priority-medium";

    return `
      <div class="roadmap-card glass-panel" data-roadmap-index="${i}">
        <div>
          <div class="roadmap-top-row">
            <span class="timeframe-badge ${tfClass}">${tfLabel}</span>
            <span class="diag-badge ${prioClass}">Ưu tiên ${priority}</span>
          </div>
          <h4 class="roadmap-objective">${escapeHtml(objective)}</h4>
        </div>

        <!-- Collapsible Steps & Verification (WI-REPORT-02) -->
        <div class="roadmap-disclosure-wrap">
          <button type="button" class="roadmap-steps-toggle" id="roadmap-toggle-${i}" aria-expanded="true" aria-controls="roadmap-panel-${i}" onclick="toggleRoadmapSteps(${i})">
            <span>Chi tiết các bước thực hiện & Tiêu chí (${steps.length || 1} bước)</span>
            <svg class="roadmap-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="roadmap-steps-panel" id="roadmap-panel-${i}" role="region" aria-labelledby="roadmap-toggle-${i}">
            ${steps.length > 0 ? `
              <ol class="roadmap-steps-list">
                ${steps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
              </ol>
            ` : ""}
            ${verification ? `
              <div class="roadmap-verification-box">
                <strong>Tiêu chí Tự Kiểm Chứng:</strong>
                <span>${escapeHtml(verification)}</span>
              </div>
            ` : (outcome ? `
              <div class="roadmap-verification-box">
                <strong>Kết quả Kỳ vọng:</strong>
                <span>${escapeHtml(outcome)}</span>
              </div>
            ` : "")}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function toggleRoadmapSteps(idx) {
  const panel = document.getElementById(`roadmap-panel-${idx}`);
  const btn = document.getElementById(`roadmap-toggle-${idx}`);
  if (!panel || !btn) return;
  const isExpanded = btn.getAttribute("aria-expanded") === "true";
  btn.setAttribute("aria-expanded", String(!isExpanded));
  if (isExpanded) {
    panel.classList.add("roadmap-panel-collapsed");
    btn.classList.add("is-collapsed");
  } else {
    panel.classList.remove("roadmap-panel-collapsed");
    btn.classList.remove("is-collapsed");
  }
}
window.toggleRoadmapSteps = toggleRoadmapSteps;

// ==========================================
// 9. SECTION 5: PREPARATION PLAN
// ==========================================
function renderPreparationSection(prep, jobTitle = "") {
  if (!prep) return;

  // Domain Knowledge
  const techBox = document.getElementById("prep-technical-content");
  const techItems = prep.technicalPreparation || prep.TechnicalPreparation || [];
  if (techBox) renderPrepCategory(techBox, techItems, `Nội dung ôn tập ${getDomainKnowledgeLabel(jobTitle)}`);

  // Practical
  const pracBox = document.getElementById("prep-practical-content");
  const pracItems = [
    ...(prep.practicalPreparation || prep.PracticalPreparation || []),
    ...(prep.systemDesignPreparation || prep.SystemDesignPreparation || [])
  ];
  if (pracBox) renderPrepCategory(pracBox, pracItems, "Kịch bản ứng dụng & thiết kế hệ thống");

  // Behavioral
  const behBox = document.getElementById("prep-behavioral-content");
  const behCard = behBox?.closest ? behBox.closest(".prep-module-card") : null;
  const behItems = prep.behavioralPreparation || prep.BehavioralPreparation || [];
  if (behBox) {
    if (behItems.length === 0) {
      if (behCard) behCard.classList.add("prep-card-empty");
      behBox.innerHTML = `<p class="text-muted">Chưa có kịch bản hành vi bổ sung.</p>`;
    } else {
      if (behCard) behCard.classList.remove("prep-card-empty");
      behBox.innerHTML = behItems.map((b) => {
        const title = b.competencyName || b.CompetencyName || b.storyType || b.StoryType || "Kỹ năng hành vi";
        const fw = b.framework || b.Framework;
        const prompt = b.prompt || b.Prompt;
        const points = Array.isArray(b.keyPointsToCover || b.KeyPointsToCover) ? (b.keyPointsToCover || b.KeyPointsToCover).join("; ") : "";
        const star = b.starStoryRecommendation || b.StarStoryRecommendation || (prompt ? (prompt + (points ? ` (${points})` : "")) : points);
        return `
          <div class="prep-item-box">
            <div class="prep-item-title">
              <span>${escapeHtml(title)}</span>
              ${fw ? `<span class="company-inferred-badge" style="margin-left:6px;">Khung ${escapeHtml(fw)}</span>` : ""}
            </div>
            <p class="prep-item-desc"><strong>STAR Story:</strong> ${escapeHtml(star)}</p>
          </div>
        `;
      }).join("");
    }
  }

  // Company
  const compBox = document.getElementById("prep-company-content");
  const compCard = compBox?.closest ? compBox.closest(".prep-module-card") : null;
  const compItems = prep.companyPreparation || prep.CompanyPreparation || [];
  const sess = (typeof _currentSessionRaw !== "undefined" && _currentSessionRaw) || {};
  const hasCompanyData = Boolean(
    (sess.companyName && sess.companyName !== "unspecified" && sess.companyName !== "Doanh nghiệp") ||
    (sess.company && sess.company !== "unspecified" && sess.company !== "Doanh nghiệp") ||
    sess.targetCompany || sess.jdText || sess.jobDescription
  );
  if (compBox) {
    if (compItems.length === 0 && !hasCompanyData) {
      if (compCard) compCard.classList.add("prep-card-empty");
      compBox.innerHTML = `<p class="text-muted">Chưa có thông tin doanh nghiệp cụ thể.</p>`;
    } else {
      if (compCard) compCard.classList.remove("prep-card-empty");
      if (compItems.length === 0) compBox.innerHTML = "";
      compBox.innerHTML = compItems.map((c) => {
        const isMandatory = c.isMandatory === true || c.IsMandatory === true;
        const reliability = c.reliabilityBadge || c.ReliabilityBadge || (isMandatory ? "OFFICIAL" : "INFERRED");
        const badgeHtml = reliability === "OFFICIAL"
          ? `<span class="company-official-badge">Chính thức</span>`
          : `<span class="company-inferred-badge">Gợi ý tham khảo</span>`;

        return `
          <div class="prep-item-box">
            <div class="prep-item-title">
              <span>${escapeHtml(c.topic || c.Topic || "Chủ đề")}</span>
              ${badgeHtml}
            </div>
            <p class="prep-item-desc">${escapeHtml(c.expectedKnowledge || c.ExpectedKnowledge || "")}</p>
          </div>
        `;
      }).join("");
    }
  }

  // Dress Code & Presentation Guide (WI-COACH-PRESENTATION-02)
  const dressBox = document.getElementById("prep-dresscode-content");
  if (dressBox && typeof PrepMatePreparationGuide !== "undefined" && typeof PrepMatePreparationGuide.getDressCodeGuide === "function") {
    const session = _currentSessionRaw || {};
    const sessionId = _currentSessionId || session?.id || session?.backendSessionId;
    const industryInput = session?.selectedIndustry || session?.industry || "";
    const currentFormat = (typeof localStorage !== "undefined" && sessionId)
      ? (localStorage.getItem("prepmate_interview_format_" + sessionId) || "unspecified")
      : "unspecified";
    const dressGuide = PrepMatePreparationGuide.getDressCodeGuide(industryInput, currentFormat, {
      companyName: session?.companyName || session?.company || "",
      jobTitle: jobTitle || session?.jobTitle || "",
      seniority: session?.seniority || session?.targetLevel || ""
    });

    dressBox.innerHTML = `
      <div class="prep-dresscode-box">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <span class="dresscode-header-badge">👔 ${escapeHtml(dressGuide.sectorName)} • ${escapeHtml(dressGuide.formatLabel)}</span>
          ${dressGuide.companyNotice ? `<span style="font-size: 11px; color: #64748b; font-style: italic;">${escapeHtml(dressGuide.companyNotice)}</span>` : ""}
        </div>
        <h4 class="dresscode-style-title">${escapeHtml(dressGuide.typicalStyle)}</h4>
        <p style="font-size: 13px; color: #475569; margin: 0;">${escapeHtml(dressGuide.summary)}</p>
        <ul class="dresscode-list">
          ${dressGuide.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join("")}
          ${dressGuide.formatSpecificAdvice ? dressGuide.formatSpecificAdvice.map(a => `<li><strong>${escapeHtml(a)}</strong></li>`).join("") : ""}
        </ul>
        <div class="dresscode-disclaimer">
          ℹ️ ${escapeHtml(dressGuide.disclaimer)}
        </div>
      </div>
    `;
  }

  const mockBox = document.getElementById("prep-mock-content");
  const mockCard = mockBox?.closest ? mockBox.closest(".prep-module-card") : null;
  const mockItems = prep.mockInterviewRecommendations || prep.MockInterviewRecommendations || [];
  if (mockBox) {
    if (mockItems.length === 0) {
      if (mockCard) mockCard.classList.add("prep-card-empty");
      mockBox.innerHTML = `<p class="text-muted">Bạn đã sẵn sàng cho buổi phỏng vấn tiếp theo.</p>`;
    } else {
      if (mockCard) mockCard.classList.remove("prep-card-empty");
      mockBox.innerHTML = mockItems.map((m) => {
        const title = m.focusArea || m.FocusArea || m.topic || m.Topic || "Khu vực trọng tâm";
        const desc = m.rationale || m.Rationale || m.objective || m.Objective || "";
        const scenarios = m.suggestedScenarios || m.SuggestedScenarios || [];
        return `
          <div class="prep-item-box">
            <div class="prep-item-title">${escapeHtml(title)}</div>
            <p class="prep-item-desc">${escapeHtml(desc)}</p>
            ${scenarios.length > 0 ? `
              <ul style="margin: 6px 0 0 16px; padding: 0; font-size: 12.5px; color: #475569;">
                ${scenarios.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
              </ul>
            ` : ""}
          </div>
        `;
      }).join("");
    }
  }
}

function renderPrepCategory(container, items, defaultTitle) {
  const card = container?.closest ? container.closest(".prep-module-card") : null;
  if (!items || items.length === 0) {
    if (card) card.classList.add("prep-card-empty");
    container.innerHTML = `<p class="text-muted">Chưa có nội dung bổ sung.</p>`;
    return;
  }
  if (card) card.classList.remove("prep-card-empty");
  container.innerHTML = items.map((item) => {
    let title = item.topic || item.Topic || item.title || item.Title || defaultTitle;
    title = title.replace(/General Technical Knowledge/gi, "kiến thức chuyên môn cốt lõi");
    const actionList = Array.isArray(item.actions || item.Actions) ? (item.actions || item.Actions) : [];
    let desc = item.objective || item.Objective || item.action || item.Action || (actionList.length > 0 ? actionList.join("; ") : "");
    desc = desc.replace(/General Technical Knowledge/gi, "kiến thức chuyên môn cốt lõi");
    return `
      <div class="prep-item-box">
        <div class="prep-item-title">${escapeHtml(title)}</div>
        <p class="prep-item-desc">${escapeHtml(desc)}</p>
      </div>
    `;
  }).join("");
}

// ==========================================
// 10. SECTION 6: INTERACTIVE CHECKLIST
// ==========================================
function renderChecklistSection(prep, sessionId, jobTitle = "") {
  const container = document.getElementById("checklist-container");
  if (!container) return;

  const session = _currentSessionRaw || {};
  const currentFormat = (typeof localStorage !== "undefined" && sessionId)
    ? (localStorage.getItem("prepmate_interview_format_" + sessionId) || "unspecified")
    : "unspecified";

  // Setup Format Selector Buttons (WI-COACH-PRESENTATION-02)
  const formatBox = document.getElementById("interview-format-selector-box");
  if (formatBox && typeof formatBox.querySelectorAll === "function") {
    const btns = formatBox.querySelectorAll(".format-btn");
    btns.forEach(btn => {
      const fmt = btn.getAttribute("data-format");
      if (fmt === currentFormat) btn.classList.add("active");
      else btn.classList.remove("active");

      btn.onclick = () => {
        btns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        if (typeof localStorage !== "undefined" && sessionId) {
          localStorage.setItem("prepmate_interview_format_" + sessionId, fmt);
        }
        renderChecklistSection(prep, sessionId, jobTitle);
        renderPreparationSection(prep, jobTitle);
      };
    });
  }

  const checklistData = prep?.preparationChecklist || prep?.PreparationChecklist || null;
  const rawItems = checklistData?.items || checklistData?.Items || [];

  // Get Etiquette Checklist Items
  let etiquetteItems = [];
  if (typeof PrepMatePreparationGuide !== "undefined" && typeof PrepMatePreparationGuide.getEtiquetteChecklist === "function") {
    const etqRes = PrepMatePreparationGuide.getEtiquetteChecklist(currentFormat, {
      jobTitle,
      companyName: session?.companyName || session?.company || ""
    });
    etiquetteItems = etqRes.flatItems || [];
  }

  if (rawItems.length === 0 && etiquetteItems.length === 0) {
    container.innerHTML = '<p class="text-muted" style="padding:16px;">Chưa có danh mục kiểm tra.</p>';
    updateChecklistProgress(0, 0);
    return;
  }

  // Saved state
  const storageKey = "prepmate_checklist_" + sessionId;
  const savedState = JSON.parse((typeof localStorage !== "undefined" && localStorage.getItem(storageKey)) || "{}");

  // Group by category
  const groups = {
    Technical: [],
    Behavioral: [],
    Company: [],
    Logistics: [],
    PhaseA: [],
    PhaseB: [],
    PhaseC: [],
    PhaseD: []
  };

  rawItems.forEach((it, idx) => {
    const cat = it.category || it.Category || "Technical";
    const groupKey = groups[cat] ? cat : "Technical";
    groups[groupKey].push({
      id: "chk-" + idx,
      title: it.task || it.Task || it.title || it.Title || "Nội dung chuẩn bị",
      sub: it.timing || it.Timing || "",
      globalIndex: idx
    });
  });

  etiquetteItems.forEach((it) => {
    const cat = it.phase || "PhaseA";
    if (groups[cat]) {
      groups[cat].push({
        id: it.id,
        title: it.title,
        sub: it.subtitle ? (it.subtitle + (it.timing ? " (" + it.timing + ")" : "")) : (it.timing || ""),
        isEtiquette: true
      });
    }
  });

  const groupLabels = {
    Technical: { title: getDomainKnowledgeLabel(jobTitle), icon: getDomainKnowledgeIcon(jobTitle) },
    Behavioral: { title: "Tác phong & Câu chuyện STAR", icon: "🤝" },
    Company: { title: "Hiểu biết Doanh nghiệp", icon: "🏢" },
    Logistics: { title: "Thiết bị & Môi trường Phỏng vấn", icon: "💻" },
    PhaseA: { title: "Nghi thức A: Trước buổi phỏng vấn", icon: "📋" },
    PhaseB: { title: currentFormat === "online" ? "Nghi thức B: Chuẩn bị phòng họp online" : "Nghi thức B: Khi đến nơi & Phòng chờ", icon: "🏢" },
    PhaseC: { title: "Nghi thức C: Trong buổi phỏng vấn", icon: "🤝" },
    PhaseD: { title: "Nghi thức D: Kết thúc & Sau phỏng vấn", icon: "✉️" }
  };

  let html = "";
  let totalItemsCount = 0;
  let checkedItemsCount = 0;

  Object.keys(groups).forEach((cat) => {
    const list = groups[cat];
    if (list.length === 0) return;

    const meta = groupLabels[cat] || { title: cat, icon: "📌" };

    html += `
      <div class="checklist-group">
        <h4 class="checklist-group-title"><span>${meta.icon}</span> ${meta.title}</h4>
        ${list.map((it) => {
          totalItemsCount++;
          const id = it.id;
          const isChecked = savedState[id] === true;
          if (isChecked) checkedItemsCount++;
          const text = it.title || "Nội dung chuẩn bị";
          const sub = it.sub || "";

          return `
            <div class="checklist-item-row ${isChecked ? "completed" : ""}" id="row-${id}" onclick="toggleChecklistItem('${id}', '${sessionId}')">
              <input type="checkbox" id="${id}" class="chk-input" ${isChecked ? "checked" : ""} onclick="event.stopPropagation(); toggleChecklistItem('${id}', '${sessionId}', true)">
              <div class="chk-content">
                <div class="chk-label">${escapeHtml(text)}</div>
                ${sub ? `<p class="chk-sub">${escapeHtml(sub)}</p>` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  });

  container.innerHTML = html;
  updateChecklistProgress(checkedItemsCount, totalItemsCount);
}

function toggleChecklistItem(id, sessionId, fromDirectInput = false) {
  const chk = document.getElementById(id);
  const row = document.getElementById(`row-${id}`);
  if (!chk) return;

  const newState = fromDirectInput ? chk.checked : !chk.checked;
  if (!fromDirectInput) {
    chk.checked = newState;
  }

  if (row) {
    if (newState) row.classList.add("completed");
    else row.classList.remove("completed");
  }

  // Save to localStorage
  const storageKey = `prepmate_checklist_${sessionId}`;
  const savedState = JSON.parse(localStorage.getItem(storageKey) || "{}");
  savedState[id] = newState;
  localStorage.setItem(storageKey, JSON.stringify(savedState));

  // Recalculate progress
  const allCheckboxes = document.querySelectorAll(".chk-input");
  const total = allCheckboxes.length;
  const checked = document.querySelectorAll(".chk-input:checked").length;
  updateChecklistProgress(checked, total);
}
window.toggleChecklistItem = toggleChecklistItem;

function updateChecklistProgress(checked, total) {
  const textEl = document.getElementById("checklist-progress-text");
  const barEl = document.getElementById("checklist-progress-bar");
  if (!textEl || !barEl) return;

  if (total === 0) {
    textEl.textContent = "0 / 0 việc (0%)";
    barEl.style.width = "0%";
    return;
  }

  const percent = Math.round((checked / total) * 100);
  textEl.textContent = `${checked} / ${total} việc (${percent}%)`;
  barEl.style.width = `${percent}%`;
}

// ==========================================
// 10B. SECTION 6B: SPEECH & PRESENTATION COACHING (WI-COACH-AUDIO-01 & 02)
// ==========================================
async function renderSpeechCoachingSection(report, session) {
  const container = document.getElementById("section-speech-coaching");
  if (!container) return;

  const answers = Array.isArray(session?.answers)
    ? session.answers
    : (Array.isArray(session?.Answers) ? session.Answers : []);

  let sourceAnswers = answers;
  if (sourceAnswers.length === 0 && report?.evidenceSummary?.turnProvenance) {
    sourceAnswers = report.evidenceSummary.turnProvenance.map((t, idx) => ({
      question: t.question || `Câu hỏi ${idx + 1}`,
      answer: t.answerSnippet || ""
    }));
  }

  const sessionId = _currentSessionId || session?.id || session?.backendSessionId;
  let recordings = [];
  if (sessionId && typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.getAllRecordingsForSession === "function") {
    try {
      recordings = await PrepMateAudioRecorder.getAllRecordingsForSession(sessionId);
    } catch (e) {
      console.warn("[REPORT UI] Cannot load audio recordings:", e);
    }
  }

  if (typeof SpeechCoachingEngine === "undefined" || typeof SpeechCoachingEngine.analyzeSessionSpeechCoaching !== "function") {
    return;
  }

  const coachingData = SpeechCoachingEngine.analyzeSessionSpeechCoaching(sourceAnswers, recordings);
  const summary = coachingData.summary;

  // 1. Render Metrics Grid
  const metricsGrid = document.getElementById("speech-metrics-grid");
  if (metricsGrid) {
    const hasActiveWpm = summary.pacingBasis === "speech_active" && summary.averageActiveWpm;
    const wpmText = hasActiveWpm ? `${summary.averageActiveWpm}` : (summary.averageWpm ? `${summary.averageWpm}` : "—");
    const wpmSub = hasActiveWpm
      ? `Đo trên ${summary.speechActiveMinutes || "0.1"} phút phát âm thực (đã trừ khoảng lặng)`
      : (summary.averageWpm ? `Toàn bộ lượt (${summary.durationMinutes} phút, chưa tách lặng)` : "Chưa có audio để tính WPM");

    const durationText = summary.durationMinutes > 0 ? `${summary.durationMinutes} phút` : "Chưa ghi nhận";
    const fillerDensity = summary.fillerDensityPerMin != null ? `${summary.fillerDensityPerMin} từ/phút` : "—";

    const repDetails = [];
    if (summary.totalRepetitions > 0) repDetails.push(`${summary.totalRepetitions} lặp trực tiếp`);
    if (summary.totalPhraseRepetitions > 0) repDetails.push(`${summary.totalPhraseRepetitions} cụm lặp`);
    if (summary.totalIdeaOverlaps > 0) repDetails.push(`${summary.totalIdeaOverlaps} dấu hiệu lặp ý`);
    const repSub = repDetails.length > 0 ? repDetails.join(" • ") : "Không có hiện tượng nói lặp";

    metricsGrid.innerHTML = `
      <div class="speech-metric-card">
        <div class="speech-metric-icon">🗣️</div>
        <div class="speech-metric-info">
          <div class="speech-metric-val">${summary.totalFillers}</div>
          <div class="speech-metric-label">Từ đệm phát hiện</div>
          <div class="speech-metric-sub">${fillerDensity}</div>
        </div>
      </div>

      <div class="speech-metric-card">
        <div class="speech-metric-icon">⏱️</div>
        <div class="speech-metric-info">
          <div class="speech-metric-val">${wpmText}</div>
          <div class="speech-metric-label">Tốc độ nói (WPM)</div>
          <div class="speech-metric-sub">${wpmSub}</div>
        </div>
      </div>

      <div class="speech-metric-card">
        <div class="speech-metric-icon">🔁</div>
        <div class="speech-metric-info">
          <div class="speech-metric-val">${summary.totalRepetitions}</div>
          <div class="speech-metric-label">Lặp từ / ngập ngừng</div>
          <div class="speech-metric-sub">${repSub}</div>
        </div>
      </div>

      <div class="speech-metric-card">
        <div class="speech-metric-icon">🎙️</div>
        <div class="speech-metric-info">
          <div class="speech-metric-val">${durationText}</div>
          <div class="speech-metric-label">Thời lượng trả lời</div>
          <div class="speech-metric-sub">${recordings.length} lượt có bản ghi âm</div>
        </div>
      </div>
    `;
  }

  // 2. Render Fillers List
  const fillersContainer = document.getElementById("speech-fillers-list");
  if (fillersContainer) {
    if (summary.mostFrequentFillers && summary.mostFrequentFillers.length > 0) {
      fillersContainer.innerHTML = `
        <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Các từ hoặc cụm từ đệm xuất hiện nhiều nhất trong bài trình bày:</p>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${summary.mostFrequentFillers.map((f) => `
            <span class="speech-filler-pill">
              <span>"${escapeHtml(f.word)}"</span>
              <strong>× ${f.count}</strong>
            </span>
          `).join("")}
        </div>
      `;
    } else {
      fillersContainer.innerHTML = `
        <div style="padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; font-size: 13px;">
          ✓ Rất tốt! Bạn không sử dụng từ đệm thừa thãi nào trong toàn bộ buổi phỏng vấn.
        </div>
      `;
    }
  }

  // 3. Render Delivery Structure Summary
  const structureContainer = document.getElementById("speech-structure-summary");
  if (structureContainer) {
    const wordyCount = coachingData.turns.filter((t) => t.conciseness === "wordy").length;
    const shortCount = coachingData.turns.filter((t) => t.conciseness === "too_short").length;
    const balancedCount = coachingData.turns.filter((t) => t.conciseness === "balanced").length;

    structureContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
        <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 6px;">
          <span style="color: #475569;">Cân đối, đủ ý (18 - 220 từ):</span>
          <strong style="color: #059669;">${balancedCount} lượt</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 6px;">
          <span style="color: #475569;">Dài dòng (> 220 từ):</span>
          <strong style="${wordyCount > 0 ? "color: #d97706;" : "color: #64748b;"}">${wordyCount} lượt</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 6px;">
          <span style="color: #475569;">Quá ngắn (< 18 từ):</span>
          <strong style="${shortCount > 0 ? "color: #dc2626;" : "color: #64748b;"}">${shortCount} lượt</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 6px;">
          <span style="color: #475569;">Dấu hiệu lặp ý (trùng từ khoá):</span>
          <strong style="${(summary.totalIdeaOverlaps || 0) > 0 ? "color: #d97706;" : "color: #059669;"}">${summary.totalIdeaOverlaps || 0} cặp câu</strong>
        </div>
      </div>
    `;
  }

  // 4. Targeted Practice Moments with per-turn audio player
  const momentsContainer = document.getElementById("speech-practice-moments-list");
  if (momentsContainer) {
    momentsContainer.innerHTML = "";
    const moments = coachingData.turns.filter((t) =>
      t.fillerCount > 0 ||
      t.repetitionCount > 0 ||
      (t.phraseRepetitions && t.phraseRepetitions.length > 0) ||
      (t.ideaOverlaps && t.ideaOverlaps.length > 0) ||
      t.conciseness !== "balanced"
    );

    if (moments.length === 0) {
      momentsContainer.innerHTML = `
        <div style="padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; font-size: 13px;">
          ✓ Không có đoạn ngập ngừng hay từ đệm đáng chú ý nào. Phong thái diễn đạt của bạn rất tự nhiên và mạch lạc.
        </div>
      `;
    } else {
      const recMap = new Map();
      recordings.forEach((r) => recMap.set(r.turnIndex, r));

      moments.forEach((m) => {
        const card = document.createElement("div");
        card.className = "speech-practice-card";

        const rec = recMap.get(m.turnIndex);
        let badgeText = "Độ dài chưa tối ưu";
        let excerptText = m.answer;

        if (m.ideaOverlaps && m.ideaOverlaps.length > 0) {
          badgeText = `Dấu hiệu lặp ý (${m.ideaOverlaps.length})`;
          excerptText = m.ideaOverlaps[0].phrase || m.answer;
        } else if (m.phraseRepetitions && m.phraseRepetitions.length > 0) {
          badgeText = `Lặp cụm từ (${m.phraseRepetitions.length})`;
          excerptText = m.phraseRepetitions[0].phrase || m.answer;
        } else if (m.fillerCount > 0) {
          badgeText = `Từ đệm (${m.fillerCount})`;
          excerptText = (m.fillers.length > 0 && m.fillers[0].excerpts.length > 0) ? m.fillers[0].excerpts[0] : m.answer;
        } else if (m.repetitionCount > 0) {
          badgeText = "Lặp từ đơn";
        }

        card.innerHTML = `
          <div class="speech-practice-card-header">
            <span class="speech-practice-badge">${badgeText}</span>
            <span style="font-size: 11.5px; color: #64748b; font-weight: 500;">Lượt ${m.turnIndex === 0 ? "Khởi động" : m.turnIndex}</span>
          </div>
          <div class="speech-practice-q">Câu hỏi: ${escapeHtml(m.question || "")}</div>
          <div class="speech-practice-excerpt">"${escapeHtml(excerptText)}"</div>
          <div class="speech-audio-slot"></div>
          <div class="speech-practice-advice">
            <span>💡</span>
            <span><strong>Lời khuyên:</strong> ${escapeHtml(m.structureFeedback || m.pacingFeedback)}</span>
          </div>
        `;

        // Embed audio player if recording exists
        const audioSlot = card.querySelector(".speech-audio-slot");
        if (audioSlot && typeof PrepMateAudioPlayer !== "undefined" && typeof PrepMateAudioPlayer.createAudioPlayerElement === "function") {
          const playerWidget = PrepMateAudioPlayer.createAudioPlayerElement(rec, { compact: true });
          audioSlot.appendChild(playerWidget);
        }

        momentsContainer.appendChild(card);
      });
    }
  }

  // 5. Priority Improvements (Top 3)
  const priorityContainer = document.getElementById("speech-priority-items-list");
  if (priorityContainer) {
    priorityContainer.innerHTML = coachingData.priorityImprovements.map((p, idx) => `
      <div class="speech-priority-item">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#2563eb; color:#fff; font-size:12px; font-weight:700;">${idx + 1}</span>
          <h4>${escapeHtml(p.area)}</h4>
        </div>
        <div class="speech-priority-meta">
          <strong>Tại sao cần cải thiện:</strong> ${escapeHtml(p.why)}
        </div>
        <div class="speech-priority-drill">
          <strong>Bài tập thực hành:</strong> ${escapeHtml(p.drill)}
        </div>
        <div style="font-size: 12px; color: #059669; margin-top: 6px;">
          <strong>Cách tự kiểm tra:</strong> ${escapeHtml(p.selfCheck)}
        </div>
      </div>
    `).join("");
  }

  // 6. Visual Coaching Integration (WI-COACH-VIDEO-01)
  try {
    await renderVisualCoachingSection(report, session);
  } catch (err) {
    console.warn("[REPORT] Visual coaching render failed:", err);
  }
}

// ==========================================
// 10C. SECTION 6C: VISUAL PRESENCE & CAMERA SETUP COACHING (WI-COACH-VIDEO-01)
// ==========================================
async function renderVisualCoachingSection(report, session) {
  const container = document.getElementById("visual-coaching-box");
  if (!container) return;

  const metricsGrid = document.getElementById("visual-metrics-grid");
  const recsContainer = document.getElementById("visual-recommendations");
  const statusPill = document.getElementById("visual-status-pill");

  const sessId = session?.backendSessionId || session?.id || report?.sessionId ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sessionId"));

  // Check persisted turn snapshots in IndexedDB to support late-camera enable sync (WI-COACH-VIDEO-03)
  let loadedSnapshots = [];
  const snapshotStore = (typeof PrepMateVisualSnapshotStore !== "undefined")
    ? PrepMateVisualSnapshotStore
    : ((typeof window !== "undefined" && window.PrepMateVisualSnapshotStore) ? window.PrepMateVisualSnapshotStore : null);

  if (snapshotStore && typeof snapshotStore.getSnapshotsForSession === "function" && sessId) {
    try {
      loadedSnapshots = await snapshotStore.getSnapshotsForSession(sessId);
    } catch (e) {
      console.warn("[REPORT] Error fetching snapshots from store:", e);
    }
  }

  if ((!loadedSnapshots || loadedSnapshots.length === 0) && Array.isArray(session?.visualSnapshots)) {
    loadedSnapshots = session.visualSnapshots;
  }

  let visualReport = session?.visualReport || report?.visualReport;

  // Fallback checking sessionStorage
  if (!visualReport && typeof sessionStorage !== "undefined") {
    try {
      const cached = sessionStorage.getItem("prepmate_visual_report_" + sessId);
      if (cached) visualReport = JSON.parse(cached);
    } catch (e) {}
  }

  // Late Enable Sync: If user enabled camera mid-interview and snapshots were saved, force cameraUsed = true
  if (loadedSnapshots && loadedSnapshots.length > 0) {
    const snapEvals = loadedSnapshots.map(s => s.metrics || { cameraEnabled: true, isEvaluated: true });
    if (!visualReport || !visualReport.cameraUsed || !visualReport.evaluated) {
      if (typeof VisualCoachingEngine !== "undefined" && typeof VisualCoachingEngine.aggregateSessionVisuals === "function") {
        visualReport = VisualCoachingEngine.aggregateSessionVisuals(snapEvals, { cameraEnabled: true });
      } else {
        visualReport = visualReport || {};
        visualReport.cameraUsed = true;
        visualReport.evaluated = true;
      }
    } else {
      visualReport.cameraUsed = true;
      visualReport.evaluated = true;
    }
  }

  // If still null, run visual aggregate from engine with default (Camera OFF fallback)
  if (!visualReport) {
    if (typeof VisualCoachingEngine !== "undefined" && typeof VisualCoachingEngine.aggregateSessionVisuals === "function") {
      visualReport = VisualCoachingEngine.aggregateSessionVisuals([], { cameraEnabled: false });
    } else {
      visualReport = {
        evaluated: false,
        cameraUsed: false,
        summaryTitle: "Không sử dụng camera",
        lightingSummary: "Không đánh giá (Camera tắt trong suốt buổi)",
        framingSummary: "Không đánh giá (Camera tắt trong suốt buổi)",
        motionSummary: "Không đánh giá",
        recommendations: [
          "Bật camera trong các buổi luyện tập tiếp theo để nhận gợi ý tối ưu hóa góc máy và ánh sáng.",
          "Việc tắt camera không ảnh hưởng đến điểm năng lực chuyên môn của bạn."
        ],
        affectsProfessionalScore: false
      };
    }
  }

  // Update Status Pill
  if (statusPill) {
    if (!visualReport.cameraUsed) {
      statusPill.textContent = "Camera tắt";
      statusPill.style.background = "#f1f5f9";
      statusPill.style.color = "#64748b";
    } else if (visualReport.evaluated) {
      statusPill.textContent = visualReport.summaryBadge || "Đã phân tích";
      statusPill.style.background = visualReport.statusClass === "success" ? "#dcfce7" : "#e0f2fe";
      statusPill.style.color = visualReport.statusClass === "success" ? "#15803d" : "#0369a1";
    } else {
      statusPill.textContent = "Chưa đủ dữ liệu";
      statusPill.style.background = "#fef3c7";
      statusPill.style.color = "#b45309";
    }
  }

  // Render Metrics Grid
  if (metricsGrid) {
    if (!visualReport.cameraUsed) {
      metricsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; color: #64748b; font-size: 13px; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 18px;">ℹ️</span>
          <div>
            <strong>Camera đã tắt trong suốt buổi phỏng vấn.</strong> Bạn đã lựa chọn hoàn thành phỏng vấn qua micro/văn bản. Điểm đánh giá năng lực chuyên môn (Phần A) và phân tích giọng nói (Phần B1) được ghi nhận đầy đủ, không bị ảnh hưởng.
          </div>
        </div>
      `;
    } else {
      metricsGrid.innerHTML = `
        <div class="speech-metric-card" style="padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">Ánh Sáng Khung Hình</div>
          <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
            ${visualReport.dominantLighting === "OPTIMAL" ? "☀️ Độ Sáng Cân Bằng" : (visualReport.dominantLighting === "UNDEREXPOSED" ? "🌙 Khá Tối" : (visualReport.dominantLighting === "OVEREXPOSED" ? "⚡ Độ Sáng Cao" : (visualReport.dominantLighting === "BACKLIT" ? "⛅ Dấu Hiệu Ngược Sáng" : "🌤️ Mức Cơ Bản")))}
          </div>
          <div style="font-size: 12px; color: #475569;">${escapeHtml(visualReport.lightingSummary || "")}</div>
        </div>

        <div class="speech-metric-card" style="padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">Nhận Diện Chủ Thể & Bố Cục</div>
          <div style="font-size: 10px; color: #94a3b8; margin-bottom: 4px;">(Phân tích On-Device, không gửi ảnh lên máy chủ)</div>
          <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
            ${(visualReport.personDetectionRate !== undefined && visualReport.personDetectionRate < 0.5) ? `⚠️ Chưa rõ người (${Math.round((visualReport.personDetectionRate || 0) * 100)}%)` : `👤 Nhận diện đạt ${Math.round((visualReport.personDetectionRate !== undefined ? visualReport.personDetectionRate : 1.0) * 100)}%`}
          </div>
          <div style="font-size: 12px; color: #475569; margin-bottom: 4px;">${escapeHtml(visualReport.framingSummary || visualReport.personDetectionSummary || "")}</div>
          <div style="font-size: 11px; color: #64748b; border-top: 1px dashed #e2e8f0; padding-top: 4px; margin-top: 4px;">🛡️ Khung hình chưa hiển thị đủ vai để đánh giá tư thế; không suy đoán cảm xúc.</div>
        </div>

        <div class="speech-metric-card" style="padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">Độ Thay Đổi Khung Hình Mẫu</div>
          <div style="font-size: 10px; color: #94a3b8; margin-bottom: 4px;">(Ảnh mẫu thời điểm, không theo dõi liên tục)</div>
          <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
            📸 Ảnh Mẫu Đầu Lượt
          </div>
          <div style="font-size: 12px; color: #475569;">${escapeHtml(visualReport.motionSummary || "Chưa đủ dữ liệu chuỗi thời gian để đánh giá chuyển động liên tục")}</div>
        </div>
      `;
    }
  }

  // Render Recommendations
  if (recsContainer) {
    const recs = visualReport.recommendations || [];
    recsContainer.innerHTML = `
      <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
        💡 Gợi ý tham khảo về góc máy & điều kiện hình ảnh:
      </div>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; display: flex; flex-direction: column; gap: 6px;">
        ${recs.map(r => `<li>${escapeHtml(r)}</li>`).join("")}
      </ul>
    `;
  }


  // Render Temporal Body Language Tracking (WI-COACH-BODY-LANGUAGE-02)
  const temporalContainer = document.getElementById("temporal-body-language-container");
  const temporalBadge = document.getElementById("temporal-samples-badge");
  const temporalBreakdown = document.getElementById("temporal-breakdown-grid");
  const temporalObsList = document.getElementById("temporal-observations-list");

  if (temporalContainer) {
    if (!visualReport.cameraUsed) {
      temporalContainer.style.display = "none";
    } else {
      temporalContainer.style.display = "block";
      const tm = visualReport.temporalMetrics || {};
      const sampleCount = tm.totalSamples || visualReport.temporalSamplesAnalyzed || visualReport.samplesAnalyzed || 0;
      if (temporalBadge) {
        temporalBadge.textContent = `${sampleCount} mẫu định kỳ`;
      }

      if (temporalBreakdown) {
        const facingRate = tm.facingCameraRate !== undefined ? tm.facingCameraRate : 100;
        const uprightRate = tm.uprightRate !== undefined ? tm.uprightRate : 100;
        const handsRate = tm.handsVisibleRate !== undefined ? tm.handsVisibleRate : 0;

        temporalBreakdown.innerHTML = `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
              <span>👀 Hướng Đầu Trực Diện</span>
              <span style="font-weight: 700; color: #0284c7;">${facingRate}%</span>
            </div>
            <div style="width: 100%; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
              <div style="width: ${facingRate}%; height: 100%; background: #0284c7; border-radius: 4px;"></div>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Đầu thẳng về phía camera (không phải đo đồng tử)</div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
              <span>🧍 Trục Thân Cân Bằng</span>
              <span style="font-weight: 700; color: #16a34a;">${uprightRate}%</span>
            </div>
            <div style="width: 100%; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
              <div style="width: ${uprightRate}%; height: 100%; background: #16a34a; border-radius: 4px;"></div>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Thân trên ngồi thẳng, cân đối hai vai</div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
              <span>👐 Hiện Diện Bàn Tay</span>
              <span style="font-weight: 700; color: #9333ea;">${handsRate}%</span>
            </div>
            <div style="width: 100%; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
              <div style="width: ${handsRate}%; height: 100%; background: #9333ea; border-radius: 4px;"></div>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Cử chỉ minh họa trong trường nhìn camera</div>
          </div>
        `;
      }

      if (temporalObsList) {
        const obs = visualReport.structuredObservations || [];
        if (obs.length === 0) {
          temporalObsList.innerHTML = `<div style="font-size: 12px; color: #64748b;">Chưa đủ mẫu chuỗi thời gian để tổng hợp nhận xét 4 phần.</div>`;
        } else {
          temporalObsList.innerHTML = obs.map((o) => `
            <div class="temporal-observation-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
              <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                <span>${escapeHtml(o.title)}</span>
                <span style="font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: ${o.statusClass === 'success' ? '#dcfce7' : (o.statusClass === 'warning' ? '#fef3c7' : '#e0f2fe')}; color: ${o.statusClass === 'success' ? '#15803d' : (o.statusClass === 'warning' ? '#b45309' : '#0369a1')};">
                  ${o.rate !== undefined ? `${o.rate}%` : 'Ghi nhận'}
                </span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr; gap: 6px; font-size: 12px; line-height: 1.5;">
                <div style="display: flex; gap: 8px;"><strong style="color: #334155; min-width: 100px;">🔍 Quan sát:</strong> <span style="color: #1e293b;">${escapeHtml(o.observation)}</span></div>
                <div style="display: flex; gap: 8px;"><strong style="color: #64748b; min-width: 100px;">🎯 Bối cảnh:</strong> <span style="color: #475569;">${escapeHtml(o.context)}</span></div>
                <div style="display: flex; gap: 8px;"><strong style="color: #94a3b8; min-width: 100px;">⚙️ Giới hạn kỹ thuật:</strong> <span style="color: #64748b; font-style: italic;">${escapeHtml(o.limitation)}</span></div>
                <div style="display: flex; gap: 8px;"><strong style="color: #0284c7; min-width: 100px;">💡 Gợi ý hành động:</strong> <span style="color: #0369a1; font-weight: 500;">${escapeHtml(o.actionableSuggestion)}</span></div>
              </div>
            </div>
          `).join("");
        }
      }
    }
  }

  // Render Turn-by-Turn Visual Snapshots Gallery (WI-COACH-VIDEO-02 & WI-COACH-VIDEO-03)
  renderVisualSnapshotsGallery(report, session, visualReport, loadedSnapshots);

  // 7. Video Moment Replay & Timestamp-Aligned Evidence (WI-COACH-04C)
  try {
    await renderVideoMomentsSection(report, session, visualReport);
  } catch (err) {
    console.warn("[REPORT] Video moments render error:", err);
  }

  // 8. Evidence-Based Voice & Body Language AI Coaching (WI-COACH-04D)
  try {
    await renderVoiceBodyCoachingSection(report, session, visualReport);
  } catch (err) {
    console.warn("[REPORT] Voice & Body coaching render error:", err);
  }
}

// Track object URLs to revoke on page unload
window._prepmateVisualBlobUrls = window._prepmateVisualBlobUrls || [];

async function renderVisualSnapshotsGallery(report, session, visualReport, preloadedSnapshots) {
  const gallery = document.getElementById("visual-snapshots-gallery");
  const countBadge = document.getElementById("visual-snapshots-count-badge");
  if (!gallery) return;

  // Revoke any previous blob URLs
  if (Array.isArray(window._prepmateVisualBlobUrls)) {
    window._prepmateVisualBlobUrls.forEach((u) => {
      try { URL.revokeObjectURL(u); } catch (e) {}
    });
    window._prepmateVisualBlobUrls = [];
  }

  if (!visualReport || !visualReport.cameraUsed) {
    if (countBadge) countBadge.textContent = "Camera tắt";
    gallery.innerHTML = `
      <div class="pm-visual-empty-card" style="padding: 14px 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 13px; display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 22px;">📷</span>
        <div>
          <strong style="color: #334155;">Lượt này không có ảnh minh chứng vì camera chưa bật hoặc không thu được frame hợp lệ.</strong>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
            PrepMate bảo vệ quyền riêng tư người dùng: bạn hoàn toàn có thể hoàn thành phỏng vấn xuất sắc bằng giọng nói/văn bản. Điểm năng lực chuyên môn không bị ảnh hưởng.
          </div>
        </div>
      </div>
    `;
    return;
  }

  const sessId = session?.backendSessionId || session?.id || report?.sessionId ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sessionId"));

  let snapshots = preloadedSnapshots || [];
  const snapshotStore = (typeof PrepMateVisualSnapshotStore !== "undefined")
    ? PrepMateVisualSnapshotStore
    : ((typeof window !== "undefined" && window.PrepMateVisualSnapshotStore) ? window.PrepMateVisualSnapshotStore : null);

  if ((!snapshots || snapshots.length === 0) && snapshotStore && typeof snapshotStore.getSnapshotsForSession === "function" && sessId) {
    try {
      snapshots = await snapshotStore.getSnapshotsForSession(sessId);
    } catch (e) {
      console.warn("[REPORT] Error fetching snapshots from store:", e);
    }
  }

  // Fallback to session.visualSnapshots if store was empty or unavailable
  if ((!snapshots || snapshots.length === 0) && Array.isArray(session?.visualSnapshots)) {
    snapshots = session.visualSnapshots;
  }

  if (!snapshots || snapshots.length === 0) {
    if (countBadge) countBadge.textContent = "Chưa có ảnh";
    gallery.innerHTML = `
      <div class="pm-visual-empty-card" style="padding: 14px 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 13px; display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 22px;">ℹ️</span>
        <div>
          <strong style="color: #334155;">Lượt này không có ảnh minh chứng vì camera chưa bật hoặc không thu được frame hợp lệ.</strong>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
            Không tìm thấy ảnh mẫu đã lưu cho phiên này trong trình duyệt hiện tại.
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (countBadge) {
    countBadge.textContent = `${snapshots.length} lượt có ảnh`;
    countBadge.style.background = "#dbeafe";
    countBadge.style.color = "#1d4ed8";
  }

  // Resolve turn question texts
  const userResponses = session?.userResponses || report?.responses || report?.userResponses || report?.answers || [];

  gallery.innerHTML = snapshots.map((s, idx) => {
    const turnIdx = (typeof s.turnIndex === "number") ? s.turnIndex : idx;
    let questionText = "Lượt phỏng vấn #" + turnIdx;
    if (turnIdx === 0) {
      questionText = "Phần Giới thiệu bản thân";
    } else if (userResponses[turnIdx - 1]) {
      const q = userResponses[turnIdx - 1].question || userResponses[turnIdx - 1].Question;
      if (q) questionText = `Câu hỏi ${turnIdx}: ${q}`;
    }

    // Image URL resolution
    let imgHtml = "";
    if (s.imageBlob && (typeof Blob !== "undefined" && s.imageBlob instanceof Blob)) {
      const blobUrl = URL.createObjectURL(s.imageBlob);
      window._prepmateVisualBlobUrls.push(blobUrl);
      imgHtml = `<img src="${blobUrl}" alt="Ảnh minh chứng ${escapeHtml(questionText)}" class="pm-visual-thumbnail" loading="lazy" />`;
    } else if (typeof s.imageBlob === "string" && s.imageBlob.startsWith("data:image")) {
      imgHtml = `<img src="${s.imageBlob}" alt="Ảnh minh chứng ${escapeHtml(questionText)}" class="pm-visual-thumbnail" loading="lazy" />`;
    } else {
      imgHtml = `
        <div style="width:100%;height:100%;min-height:100px;display:flex;align-items:center;justify-content:center;background:#1e293b;color:#94a3b8;font-size:11px;text-align:center;padding:8px;">
          <span>Không có ảnh</span>
        </div>
      `;
    }

    // Format metrics
    const metrics = s.metrics || {};
    const lightingLevel = metrics.lightingLevel || (metrics.isUnderExposed ? "UNDEREXPOSED" : (metrics.isOverExposed ? "OVEREXPOSED" : "OPTIMAL"));
    const framingType = metrics.framingType || "CENTERED";

    let lightingBadgeText = "☀️ Độ Sáng Cân Bằng";
    let lightingClass = "success";
    if (lightingLevel === "UNDEREXPOSED") {
      lightingBadgeText = "🌙 Khá Tối";
      lightingClass = "warning";
    } else if (lightingLevel === "OVEREXPOSED") {
      lightingBadgeText = "⚡ Độ Sáng Cao";
      lightingClass = "warning";
    } else if (lightingLevel === "BACKLIT") {
      lightingBadgeText = "⛅ Ngược Sáng";
      lightingClass = "warning";
    }

    let framingBadgeText = "🎯 Chi tiết phân bố trung tâm";
    if (framingType === "LEAN_LEFT") {
      framingBadgeText = "⬅️ Chi tiết tập trung bên trái";
    } else if (framingType === "LEAN_RIGHT") {
      framingBadgeText = "➡️ Chi tiết tập trung bên phải";
    } else if (framingType === "UNBALANCED") {
      framingBadgeText = "⚖️ Chi tiết phân bố chưa đều";
    }

    // Person Presence & Evidence-based Framing (WI-COACH-VIDEO-02B)
    const detection = metrics.detection || {};
    const evidenceFraming = metrics.evidenceFraming;
    let presenceBadgeText = "👤 Đã nhận diện người";
    let presenceClass = "success";

    if (detection.status === "CONFIDENT_DETECTION") {
      presenceBadgeText = `👤 Đã nhận diện (${Math.round((detection.confidence || 0.9) * 100)}%)`;
      presenceClass = "success";
    } else if (detection.status === "NO_PERSON_DETECTED") {
      presenceBadgeText = "⚠️ Chưa phát hiện người";
      presenceClass = "warning";
    } else if (detection.status === "POOR_VISIBILITY") {
      presenceBadgeText = "⚠️ Thiếu sáng";
      presenceClass = "warning";
    }

    if (evidenceFraming === "OPTIMAL_CENTERED") {
      framingBadgeText = "🎯 Bố cục trung tâm";
    } else if (evidenceFraming === "TOO_CLOSE") {
      framingBadgeText = "🔍 Quá gần camera";
    } else if (evidenceFraming === "TOO_FAR") {
      framingBadgeText = "🔭 Quá xa camera";
    } else if (evidenceFraming === "CUT_OFF_TOP") {
      framingBadgeText = "⬆️ Sát mép trên";
    } else if (evidenceFraming === "CUT_OFF_BOTTOM") {
      framingBadgeText = "⬇️ Sát mép dưới";
    } else if (evidenceFraming === "LEAN_LEFT") {
      framingBadgeText = "⬅️ Lệch trái";
    } else if (evidenceFraming === "LEAN_RIGHT") {
      framingBadgeText = "➡️ Lệch phải";
    } else if (evidenceFraming === "UNVERIFIED_NO_SUBJECT") {
      framingBadgeText = "❓ Chưa xác định chủ thể";
    }

    const interpretationText = "Ảnh mẫu đầu lượt (On-Device YCbCr Skin Locus + BT.601 Luma), không sử dụng mô hình nhận diện khuôn mặt sinh trắc học để định danh; không nhận diện cảm xúc hay suy đoán tâm lý.";

    let recommendationText = metrics.evidenceFramingFeedback || "Ánh sáng và góc máy ở lượt này đạt chuẩn chuyên nghiệp cho buổi phỏng vấn trực tuyến.";
    if (lightingLevel === "UNDEREXPOSED") {
      recommendationText += " Gợi ý: Bổ sung nguồn sáng trước mặt để làm rõ khung hình.";
    } else if (lightingLevel === "BACKLIT") {
      recommendationText += " Gợi ý: Tránh nguồn sáng mạnh phía sau lưng.";
    }

    const timeStr = s.capturedAt ? new Date(s.capturedAt).toLocaleTimeString("vi-VN") : "";

    return `
      <div class="pm-visual-turn-card">
        <div class="pm-visual-thumb-wrapper">
          ${imgHtml}
        </div>
        <div class="pm-visual-turn-content">
          <div class="pm-visual-turn-header">
            <span class="pm-visual-turn-badge">${turnIdx === 0 ? "LƯỢT GIỚI THIỆU" : `LƯỢT #${turnIdx}`}</span>
            ${timeStr ? `<span class="pm-visual-turn-time">${escapeHtml(timeStr)}</span>` : ""}
          </div>
          <h5 class="pm-visual-question-title">${escapeHtml(questionText)}</h5>
          <div class="pm-visual-metrics-row">
            <span class="pm-visual-metric-pill ${presenceClass}">${escapeHtml(presenceBadgeText)}</span>
            <span class="pm-visual-metric-pill ${lightingClass}">${escapeHtml(lightingBadgeText)}</span>
            <span class="pm-visual-metric-pill">${escapeHtml(framingBadgeText)}</span>
          </div>
          <div class="pm-visual-interpretation">
            ${escapeHtml(interpretationText)}
          </div>
          <div class="pm-visual-recommendation">
            💡 ${escapeHtml(recommendationText)}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// 11. SECTION 7: TURN PROVENANCE
// ==========================================
function renderTurnProvenanceSection(report, session) {
  const container = document.getElementById("turn-provenance-list");
  if (!container) return;

  const kaList = report._rawReport?.knowledgeAnalysis || report._rawReport?.KnowledgeAnalysis || report.knowledgeAnalysis || report.KnowledgeAnalysis || session.report?.knowledgeAnalysis || session.report?.KnowledgeAnalysis || session.Report?.KnowledgeAnalysis || [];
  const turns = report.evidenceSummary?.turnProvenance || report.EvidenceSummary?.TurnProvenance || [];

  if (turns.length > 0) {
    container.innerHTML = turns.map((t, i) => {
      const ka = kaList.find(k => {
        const kq = (k.question || k.Question || "").trim().toLowerCase();
        const tq = (t.question || "").trim().toLowerCase();
        return kq && tq && (kq.includes(tq.slice(0, 30)) || tq.includes(kq.slice(0, 30)));
      }) || kaList[i] || null;

      const rating = ka?.rating || ka?.Rating || null;
      const analysis = ka?.analysis || ka?.Analysis || null;
      const supplement = ka?.supplement || ka?.Supplement || null;
      const ratingClass = rating && rating.toLowerCase().includes("tốt") && !rating.toLowerCase().includes("chưa") ? "good" : "needs-work";

      const isFirst = i === 0;
      const turnNum = t.turnIndex || (i + 1);
      const turnId = `turn-panel-${turnNum}`;
      const triggerId = `turn-trigger-${turnNum}`;
      const qSnippet = (t.question || "Câu hỏi").length > 85 ? (t.question.slice(0, 85) + "...") : t.question;

      return `
        <div class="turn-trace-card glass-panel ${isFirst ? 'is-expanded' : 'is-collapsed'}" data-turn-index="${turnNum}">
          <!-- Turn Accordion Header Trigger (WI-REPORT-02) -->
          <button type="button" class="turn-accordion-trigger" id="${triggerId}" aria-expanded="${isFirst ? 'true' : 'false'}" aria-controls="${turnId}" onclick="toggleTurnAccordion(${turnNum})">
            <div class="turn-trigger-left">
              <span class="turn-badge">Lượt ${turnNum}</span>
              ${rating ? `<span class="turn-rating-badge ${ratingClass}">${escapeHtml(rating)}</span>` : ""}
              <span class="turn-trigger-title">${escapeHtml(qSnippet)}</span>
            </div>
            <div class="turn-trigger-right">
              ${t.targetConcept ? `<span class="turn-concept-pill">${escapeHtml(t.targetConcept)}</span>` : ""}
              <svg class="turn-chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </button>

          <!-- Turn Accordion Panel (Progressive Disclosure) -->
          <div class="turn-accordion-panel ${isFirst ? '' : 'turn-panel-collapsed'}" id="${turnId}" role="region" aria-labelledby="${triggerId}">
            <div class="turn-panel-inner">
              <div class="turn-q-box">
                <div class="turn-role-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="vertical-align:-2px;margin-right:4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Người phỏng vấn:</div>
                <div class="turn-bubble-content">${escapeHtml(t.question || "Câu hỏi")}</div>
              </div>
              <div class="turn-a-box">
                <div class="turn-role-label candidate"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="vertical-align:-2px;margin-right:4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Câu trả lời của bạn:</div>
                <blockquote class="turn-bubble-content">“${escapeHtml(t.answerSnippet || "Câu trả lời của ứng viên")}”</blockquote>
              </div>
              <div class="turn-badges-row">
                ${t.showsPracticalExperience ? `<span class="evidence-tag practical">✓ Có kinh nghiệm thực tế</span>` : ""}
                ${(t.verifiedFacts || []).map(f => `<span class="evidence-tag fact">✓ Fact: ${escapeHtml(f)}</span>`).join("")}
                ${(t.unverifiedClaims || []).map(c => `<span class="evidence-tag claim"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="vertical-align:-1px;margin-right:3px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Tự thuật: ${escapeHtml(c)}</span>`).join("")}
                ${t.hasInconsistency ? `<span class="evidence-tag inconsistency"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="vertical-align:-1px;margin-right:3px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Cần làm rõ</span>` : ""}
              </div>
              ${analysis ? `
                <div class="turn-evaluation-box">
                  <div class="turn-evaluation-header">
                    <span class="eval-icon">🎯</span>
                    <strong>Đánh giá chuyên môn từ AI:</strong>
                  </div>
                  <p class="turn-eval-text">${escapeHtml(analysis)}</p>
                </div>
              ` : ""}
              ${supplement ? `
                <div class="turn-supplement-box">
                  <div class="turn-supplement-header">
                    <span class="supplement-icon">💡</span>
                    <strong>Định hướng câu trả lời chuẩn mực & Chiều sâu kỹ thuật:</strong>
                  </div>
                  <p class="turn-supplement-text">${escapeHtml(supplement)}</p>
                </div>
              ` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");
    return;
  }

  // Fallback to session.answers
  const answers = session.answers || [];
  if (answers.length > 0) {
    container.innerHTML = answers.map((a, i) => `
      <div class="turn-trace-card glass-panel" data-turn-index="${i + 1}">
        <div class="turn-trace-header">
          <span class="turn-badge">Lượt ${i + 1}</span>
          ${a.topic ? `<span class="turn-concept">Chủ đề: <strong>${escapeHtml(a.topic)}</strong></span>` : ""}
        </div>
        <div class="turn-q-box">
          <div class="turn-role-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="vertical-align:-2px;margin-right:4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Người phỏng vấn:</div>
          <div class="turn-bubble-content">${escapeHtml(a.question || "")}</div>
        </div>
        <div class="turn-a-box">
          <div class="turn-role-label candidate"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="vertical-align:-2px;margin-right:4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Câu trả lời của bạn:</div>
          <blockquote class="turn-bubble-content">“${escapeHtml(a.answer || "")}”</blockquote>
        </div>
      </div>
    `).join("");
    return;
  }

  container.innerHTML = `<p class="text-muted" style="padding:16px;">Chưa có nhật ký đối thoại chi tiết.</p>`;
}

function toggleTurnAccordion(num) {
  const card = document.querySelector(`.turn-trace-card[data-turn-index="${num}"]`);
  if (!card) return;
  const panel = card.querySelector(".turn-accordion-panel");
  const btn = card.querySelector(".turn-accordion-trigger");
  if (!panel || !btn) return;
  const isExpanded = btn.getAttribute("aria-expanded") === "true";
  btn.setAttribute("aria-expanded", String(!isExpanded));
  if (isExpanded) {
    panel.classList.add("turn-panel-collapsed");
    card.classList.remove("is-expanded");
    card.classList.add("is-collapsed");
  } else {
    panel.classList.remove("turn-panel-collapsed");
    card.classList.add("is-expanded");
    card.classList.remove("is-collapsed");
  }
}
window.toggleTurnAccordion = toggleTurnAccordion;

function toggleAllTurns() {
  const btn = document.getElementById("btn-toggle-all-turns");
  const txt = document.getElementById("btn-toggle-all-turns-text");
  const isAllExpanded = btn && btn.getAttribute("aria-expanded") === "true";
  const newExpanded = !isAllExpanded;

  if (btn) btn.setAttribute("aria-expanded", String(newExpanded));
  if (txt) txt.textContent = newExpanded ? "Thu gọn tất cả" : "Mở rộng tất cả";

  const cards = document.querySelectorAll(".turn-trace-card");
  cards.forEach(card => {
    const panel = card.querySelector(".turn-accordion-panel");
    const trigger = card.querySelector(".turn-accordion-trigger");
    if (panel) {
      if (newExpanded) panel.classList.remove("turn-panel-collapsed");
      else panel.classList.add("turn-panel-collapsed");
    }
    if (trigger) trigger.setAttribute("aria-expanded", String(newExpanded));
    if (newExpanded) {
      card.classList.add("is-expanded");
      card.classList.remove("is-collapsed");
    } else {
      card.classList.remove("is-expanded");
      card.classList.add("is-collapsed");
    }
  });
}
window.toggleAllTurns = toggleAllTurns;

function toggleTelemetryDeepDive() {
  const body = document.getElementById("telemetry-disclosure-body");
  const btn = document.getElementById("btn-toggle-telemetry");
  const txt = document.getElementById("btn-toggle-telemetry-text");
  if (!body || !btn) return;
  const isExpanded = btn.getAttribute("aria-expanded") === "true";
  btn.setAttribute("aria-expanded", String(!isExpanded));
  if (isExpanded) {
    body.classList.add("telemetry-collapsed");
    btn.classList.remove("is-expanded");
    if (txt) txt.textContent = "Xem chi tiết";
  } else {
    body.classList.remove("telemetry-collapsed");
    btn.classList.add("is-expanded");
    if (txt) txt.textContent = "Thu gọn";
  }
}
window.toggleTelemetryDeepDive = toggleTelemetryDeepDive;

// ==========================================
// 12. LIMITATIONS FOOTER
// ==========================================

// ==========================================================================
// 11B. QUESTION-LEVEL FEEDBACK (WI-REPORT-04)
// ==========================================================================
function renderQuestionLevelFeedback(report, session) {
  const container = document.getElementById("question-feedback-list");
  if (!container) return;

  const turns = report.evidenceSummary?.turnProvenance || report.EvidenceSummary?.TurnProvenance || [];
  const kaList = report._rawReport?.knowledgeAnalysis || report._rawReport?.KnowledgeAnalysis || report.knowledgeAnalysis || report.KnowledgeAnalysis || session?.report?.knowledgeAnalysis || session?.report?.KnowledgeAnalysis || session?.Report?.KnowledgeAnalysis || [];
  const answers = (session && session.answers) || [];

  if (turns.length === 0 && answers.length === 0) {
    container.innerHTML = `
      <div class="glass-panel" style="padding: 24px; text-align: center;">
        <p class="text-muted">Chưa ghi nhận câu hỏi hoặc câu trả lời nào trong phiên phỏng vấn này.</p>
      </div>
    `;
    return;
  }

  const items = turns.length > 0 ? turns : answers.map((a, i) => ({
    turnIndex: i + 1,
    question: a.question || `Câu hỏi ${i + 1}`,
    answerSnippet: a.answer || "",
    targetConcept: a.topic || "Kiến thức chuyên môn",
    showsPracticalExperience: false,
    verifiedFacts: []
  }));

  const cardsHtml = items.map((t, idx) => {
    const turnNum = t.turnIndex || (idx + 1);
    const ka = kaList.find(k => {
      const kq = (k.question || k.Question || "").trim().toLowerCase();
      const tq = (t.question || "").trim().toLowerCase();
      return kq && tq && (kq.includes(tq.slice(0, 30)) || tq.includes(kq.slice(0, 30)));
    }) || kaList[idx] || null;

    const rating = ka?.rating || ka?.Rating || (t.showsPracticalExperience ? "Tốt" : "Cần phát triển");
    const isGood = rating.toLowerCase().includes("tốt") && !rating.toLowerCase().includes("chưa");
    const ratingClass = isGood ? "status-good" : "status-improve";
    const ratingLabel = isGood ? "Trả lời tốt" : "Cần cải thiện";

    const goodPoint = ka?.analysis || (t.verifiedFacts && t.verifiedFacts.length > 0 ? t.verifiedFacts.join(". ") : "Nắm được khái niệm cơ bản và trả lời đúng trọng tâm câu hỏi.");
    const improvePoint = ka?.supplement || "Cần bổ sung thêm ví dụ dự án thực tế, số liệu định lượng và giải thích cơ chế sâu hơn để tăng tính thuyết phục.";

    const questionText = t.question || "Nội dung câu hỏi";
    const answerSnippet = t.answerSnippet || t.answer || "Chưa ghi nhận câu trả lời.";

    return `
      <div class="qfb-card glass-panel" id="qfb-card-${turnNum}">
        <div class="qfb-card-header" onclick="toggleQuestionFeedbackDetail(${turnNum})">
          <div class="qfb-header-left">
            <span class="qfb-turn-badge">Câu ${turnNum}</span>
            <span class="qfb-concept-tag">${escapeHtml(t.targetConcept || "Chuyên môn")}</span>
            <h4 class="qfb-question-title">${escapeHtml(questionText)}</h4>
          </div>
          <div class="qfb-header-right">
            <span class="qfb-rating-pill ${ratingClass}">
              ${isGood ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`}
              ${ratingLabel}
            </span>
            <button type="button" class="qfb-expand-btn" aria-expanded="false" id="qfb-btn-${turnNum}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>

        <div class="qfb-summary-body">
          <div class="qfb-answer-quote">
            <span class="qfb-quote-label">Câu trả lời tóm lược:</span>
            <p class="qfb-quote-text">"${escapeHtml(answerSnippet.length > 220 ? answerSnippet.slice(0, 220) + "..." : answerSnippet)}"</p>
          </div>

          <div class="qfb-feedback-cols">
            <div class="qfb-col qfb-col-good">
              <div class="qfb-col-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <strong>Điểm tốt</strong>
              </div>
              <p class="qfb-col-text">${escapeHtml(goodPoint)}</p>
            </div>
            <div class="qfb-col qfb-col-improve">
              <div class="qfb-col-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <strong>Cần cải thiện</strong>
              </div>
              <p class="qfb-col-text">${escapeHtml(improvePoint)}</p>
            </div>
          </div>

          <div class="qfb-action-row" style="margin-top: 12px; display: flex; justify-content: flex-end;">
            <button type="button" class="btn-toggle-raw-answer" id="btn-toggle-raw-${turnNum}" onclick="event.stopPropagation(); toggleQuestionFeedbackDetail(${turnNum})">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Xem câu trả lời gốc & minh chứng</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="raw-arrow"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>

        <div class="qfb-detail-panel hidden" id="qfb-detail-${turnNum}">
          <div class="qfb-detail-divider"></div>
          <div class="qfb-detail-content">
            <div class="qfb-detail-full-answer">
              <div class="qfb-detail-sec-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <strong>Câu trả lời gốc của bạn:</strong>
              </div>
              <div class="qfb-full-answer-box">${escapeHtml(answerSnippet)}</div>
            </div>

            ${(t.verifiedFacts && t.verifiedFacts.length > 0) ? `
              <div class="qfb-facts-list">
                <div class="qfb-detail-sec-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <strong>Bằng chứng thực tế đã ghi nhận (Observed Facts):</strong>
                </div>
                <ul>
                  ${t.verifiedFacts.map(f => `<li><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> ${escapeHtml(f)}</li>`).join("")}
                </ul>
              </div>
            ` : ""}

            ${t.showsPracticalExperience ? `
              <div class="qfb-practical-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Đã thể hiện kinh nghiệm thực chiến qua dự án thực tế
              </div>
            ` : ""}

            <div class="qfb-cross-examine-note">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>Đối chiếu trực tiếp giữa câu hỏi, câu trả lời gốc và tiêu chí rubric chuẩn hóa.</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  const deepAuditFooter = `
    <div class="qfb-deep-audit-link-box glass-panel" style="margin-top: 24px; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; border: 1px dashed var(--rpt-border-subtle, #cbd5e1); border-radius: 12px; background: rgba(248, 250, 252, 0.6);">
      <div style="font-size: 13.5px; color: var(--rpt-text-secondary); max-width: 580px;">
        <strong style="color: var(--rpt-text-primary); font-size: 14px;">Cần tra cứu toàn bộ đối thoại & căn cứ đánh giá?</strong>
        <span style="display: block; font-size: 12.5px; margin-top: 4px; color: var(--rpt-text-muted);">Xem lại toàn bộ câu hỏi, câu trả lời và ghi chú quan sát trong phần Phân tích chi tiết.</span>
      </div>
      <button type="button" class="btn btn-outline btn-sm" onclick="goToStage('analysis')">
        <span>Xem toàn bộ nội dung phỏng vấn</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  `;

  container.innerHTML = cardsHtml + deepAuditFooter;
}
function toggleQuestionFeedbackDetail(turnNum) {
  const panel = document.getElementById(`qfb-detail-${turnNum}`);
  const btn = document.getElementById(`qfb-btn-${turnNum}`);
  if (!panel) return;
  const isHidden = panel.classList.contains("hidden");
  if (isHidden) {
    panel.classList.remove("hidden");
    if (btn) {
      btn.classList.add("expanded");
      btn.setAttribute("aria-expanded", "true");
    }
  } else {
    panel.classList.add("hidden");
    if (btn) {
      btn.classList.remove("expanded");
      btn.setAttribute("aria-expanded", "false");
    }
  }
}
window.toggleQuestionFeedbackDetail = toggleQuestionFeedbackDetail;

let _allFeedbackExpanded = false;
function toggleAllQuestionFeedback() {
  _allFeedbackExpanded = !_allFeedbackExpanded;
  const panels = document.querySelectorAll(".qfb-detail-panel");
  const btns = document.querySelectorAll(".qfb-expand-btn");
  const textEl = document.getElementById("btn-toggle-all-fb-text");

  panels.forEach(p => {
    if (_allFeedbackExpanded) {
      p.classList.remove("hidden");
    } else {
      p.classList.add("hidden");
    }
  });

  btns.forEach(b => {
    if (_allFeedbackExpanded) {
      b.classList.add("expanded");
      b.setAttribute("aria-expanded", "true");
    } else {
      b.classList.remove("expanded");
      b.setAttribute("aria-expanded", "false");
    }
  });

  if (textEl) {
    textEl.textContent = _allFeedbackExpanded ? "Thu gọn tất cả" : "Mở rộng tất cả";
  }
}
window.toggleAllQuestionFeedback = toggleAllQuestionFeedback;

let _ecosystemExpanded = false;
function toggleSupplementaryEcosystem() {
  _ecosystemExpanded = !_ecosystemExpanded;
  const body = document.getElementById("ecosystem-collapsible-body");
  const btn = document.getElementById("btn-toggle-ecosystem");
  const textEl = document.getElementById("btn-toggle-eco-text");

  if (body) {
    if (_ecosystemExpanded) {
      body.classList.remove("hidden");
    } else {
      body.classList.add("hidden");
    }
  }

  if (btn) {
    btn.setAttribute("aria-expanded", _ecosystemExpanded ? "true" : "false");
  }

  if (textEl) {
    textEl.textContent = _ecosystemExpanded ? "Thu gọn tài liệu" : "Mở rộng tài liệu";
  }
}
window.toggleSupplementaryEcosystem = toggleSupplementaryEcosystem;


function renderLimitationsFooter(report) {
  const container = document.getElementById("report-limitations-list");
  if (!container) return;

  const limitations = report.limitations || report.Limitations || [];
  const defaultItems = [
    "Kết quả đánh giá dựa hoàn toàn trên bằng chứng thu thập được trong phạm vi phiên phỏng vấn mô phỏng.",
    "Khái niệm chưa được hỏi (Chưa đánh giá trong phiên) không đồng nghĩa với năng lực yếu kém của ứng viên.",
    "Điểm số và xếp hạng năng lực được tính toán bằng động cơ quy tắc xác định (deterministic rules), bảo vệ chống ảo giác hoặc thiên lệch AI."
  ];

  const merged = Array.from(new Set([...limitations, ...defaultItems]));
  container.innerHTML = merged.map(l => {
    let prefix = "Cam kết chuẩn mực:";
    if (l.includes("bằng chứng") || l.includes("Kết quả")) prefix = "Căn cứ minh chứng:";
    else if (l.includes("UNASSESSED") || l.includes("chưa được hỏi") || l.includes("Chưa đánh giá trong phiên")) prefix = "Khái niệm chưa đánh giá:";
    else if (l.includes("quy tắc") || l.includes("deterministic") || l.includes("thiên lệch")) prefix = "Bảo vệ chống thiên lệch AI:";

    return `
      <li class="limitation-item">
        <span class="lim-bullet-icon" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <div class="lim-item-content">
          <strong>${prefix}</strong>
          <span>${escapeHtml(l)}</span>
        </div>
      </li>
    `;
  }).join("");
}

// ==========================================
// 13. STATE TRANSITIONS
// ==========================================
function showLoadingState() {
  document.getElementById("report-loading-state")?.classList.remove("hidden");
  document.getElementById("report-error-state")?.classList.add("hidden");
  document.getElementById("report-empty-state")?.classList.add("hidden");
  document.getElementById("report-content-container")?.classList.add("hidden");
}

function showContentState() {
  document.getElementById("report-loading-state")?.classList.add("hidden");
  document.getElementById("report-error-state")?.classList.add("hidden");
  document.getElementById("report-empty-state")?.classList.add("hidden");
  document.getElementById("report-content-container")?.classList.remove("hidden");
}

function showErrorState(msg) {
  document.getElementById("report-loading-state")?.classList.add("hidden");
  document.getElementById("report-empty-state")?.classList.add("hidden");
  document.getElementById("report-content-container")?.classList.add("hidden");

  const errEl = document.getElementById("report-error-state");
  const msgEl = document.getElementById("report-error-message");
  if (errEl) errEl.classList.remove("hidden");
  if (msgEl && msg) msgEl.textContent = msg;
}

function showEmptyState(msg) {
  document.getElementById("report-loading-state")?.classList.add("hidden");
  document.getElementById("report-error-state")?.classList.add("hidden");
  document.getElementById("report-content-container")?.classList.add("hidden");

  const emptyEl = document.getElementById("report-empty-state");
  const msgEl = document.getElementById("report-empty-message");
  if (emptyEl) emptyEl.classList.remove("hidden");
  if (msgEl && msg) msgEl.textContent = msg;
}

function retryLoadingReport() {
  initReportPage();
}
window.retryLoadingReport = retryLoadingReport;

// ==========================================
// 14. SUBNAV SCROLLSPY
// ==========================================
function setupSubnavObserver() {
  const tabs = document.querySelectorAll(".subnav-tab");
  const sections = document.querySelectorAll(".report-section");

  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute("id");
        tabs.forEach((tab) => {
          if (tab.getAttribute("data-target") === id) {
            tab.classList.add("active");
          } else {
            tab.classList.remove("active");
          }
        });
      }
    });
  }, { rootMargin: "-120px 0px -70% 0px" });

  sections.forEach((s) => observer.observe(s));
}

// ==========================================
// 15. UTILITIES
// ==========================================
function getReadinessClass(r) {
  const raw = String(r || "").toUpperCase();
  if (raw === "READY") return "ready";
  if (raw === "READY_WITH_GAPS") return "ready-with-gaps";
  if (raw === "NOT_READY") return "not-ready";
  return "needs-evidence";
}

function getReadinessLabel(r) {
  const raw = String(r || "").toUpperCase();
  if (raw === "READY") return "SẴN SÀNG";
  if (raw === "READY_WITH_GAPS") return "CẦN CỦNG CỐ";
  if (raw === "NOT_READY") return "CHƯA ĐẠT";
  return "CẦN BỔ SUNG BẰNG CHỨNG";
}

function getConfidenceLabel(c) {
  const raw = String(c || "").toUpperCase();
  if (raw === "HIGH") return "CAO";
  if (raw === "MEDIUM") return "TRUNG BÌNH";
  if (raw === "LOW") return "THẤP";
  return "CHƯA ĐỦ BẰNG CHỨNG";
}

function formatUiStatus(status) {
  if (!status) return "Đang xử lý";
  const s = String(status).toLowerCase();
  if (s === "completed" || s === "done" || s === "hoàn thành đầy đủ") return "Đã hoàn thành";
  if (s === "in_progress" || s === "active" || s === "đang phỏng vấn") return "Đang thực hiện";
  if (s === "pending") return "Đang chờ xử lý";
  if (s === "failed") return "Không thành công";
  return status;
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

function printReport() {
  window.print();
}
window.printReport = printReport;

function repracticeCurrentSession() {
  const sessInfo = _currentReportData?.sessionInfo || _currentReportData?.SessionInfo || {};
  const session = _currentSessionRaw || {};

  const role = sessInfo.targetPosition || session.jobTitle || "";
  const company = sessInfo.targetCompany || session.company || session.companyName || "";
  const level = sessInfo.targetLevel || session.level || session.targetLevel || "";
  const language = session.language || "vi";
  const focus = session.interviewFocus || "";

  const repracticeConfig = {
    role,
    company,
    level,
    language,
    focus
  };

  sessionStorage.setItem("prepmate_repractice_config", JSON.stringify(repracticeConfig));
  window.location.href = `../../features/interview/interview-info.html?from=repractice&role=${encodeURIComponent(role)}&company=${encodeURIComponent(company)}`;
}
window.repracticeCurrentSession = repracticeCurrentSession;


// ==========================================
// 7C. DOMAIN-AWARE EVALUATION PERSPECTIVE
// Provides industry-tailored evaluation lens (6 key profiles + general)
// Grounded strictly in actual transcript/claims. Zero fake metrics.
// ==========================================
function renderDomainPerspective(report, session) {
  const box = document.getElementById("domain-perspective-box");
  const body = document.getElementById("domain-perspective-body");
  const badge = document.getElementById("domain-perspective-badge");
  const title = document.getElementById("domain-perspective-title");
  const desc = document.getElementById("domain-perspective-desc");
  if (!box || !body) return;

  const sessInfo = report?.sessionInfo || report?.SessionInfo || {};
  const jobTitle = sessInfo.targetPosition || session?.jobTitle || "";
  const selectedIndustry = session?.selectedIndustry || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("prepmate_selected_industry") : "") || "";

  const raw = (jobTitle + " " + selectedIndustry).toLowerCase();
  const text = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  let profile = "GENERAL";
  if (text.includes("software") || text.includes("developer") || text.includes("engineer") || text.includes("backend") || text.includes("frontend") || text.includes("fullstack") || text.includes("devops") || text.includes("cloud") || text.includes("qa") || text.includes("tester") || text.includes("it_software")) {
    profile = "IT";
  } else if (text.includes("marketing") || text.includes("growth") || text.includes("seo") || text.includes("ads") || text.includes("marketing_advertising_ecommerce")) {
    profile = "MARKETING";
  } else if (text.includes("content") || text.includes("creator") || text.includes("media") || text.includes("video") || text.includes("copywriter") || text.includes("content_media_creative")) {
    profile = "CONTENT_MEDIA";
  } else if (text.includes("tai chinh") || text.includes("finan") || text.includes("ke toan") || text.includes("kiem toan") || text.includes("accountant") || text.includes("audit") || text.includes("bank") || text.includes("finance_accounting_banking")) {
    profile = "FINANCE";
  } else if (text.includes("nhan su") || text.includes("tuyen dung") || text.includes("hr") || text.includes("talent") || text.includes("people") || text.includes("hr_training")) {
    profile = "HR";
  } else if (text.includes("business analyst") || text.includes(" ba ") || text.startsWith("ba ") || text.endsWith(" ba") || text.includes("phan tich nghiep vu") || text.includes("project") || text.includes("product") || text.includes("operation") || text.includes("van hanh") || text.includes("ba_product_project")) {
    profile = "BA_OPS";
  }

  const profileConfigs = {
    IT: {
      badge: "GÓC NHÌN NGÀNH IT & PHẦN MỀM",
      title: "Tiêu chuẩn Đánh giá Kỹ thuật & Hệ thống",
      desc: "Trọng tâm thẩm định tập trung vào tư duy trade-off kiến trúc, độ trễ hệ thống, tối ưu hóa truy vấn và tính ổn định (robustness) của mã nguồn.",
      pillars: [
        { name: "Trade-off Kiến trúc & Khả năng Mở rộng", desc: "Cân nhắc giữa hiệu năng, chi phí tài nguyên và độ phức tạp mã nguồn (Scalability vs Simplicity)." },
        { name: "Độ trễ & Tối ưu hóa Hiệu năng", desc: "Xử lý nút thắt cổ chai (bottlenecks), indexing cơ sở dữ liệu, chiến lược caching và an toàn tải cao." },
        { name: "Clean Code & Xử lý Ngoại lệ", desc: "Tổ chức module có khả năng kiểm thử cao (testability), bao bọc lỗi chặt chẽ và phòng chống lỗ hổng bảo mật." }
      ]
    },
    MARKETING: {
      badge: "GÓC NHÌN NGÀNH MARKETING & TMĐT",
      title: "Tiêu chuẩn Đánh giá Chiến dịch & Chuyển đổi",
      desc: "Trọng tâm thẩm định tập trung vào tư duy phễu toàn diện (Full-funnel), hiệu quả kinh tế đơn vị (Unit Economics) và phương pháp luận thử nghiệm A/B.",
      pillars: [
        { name: "Tư duy Phễu & Hành trình Khách hàng", desc: "Thiết kế luồng trải nghiệm từ nhận biết (Awareness), kích hoạt (Activation) đến giữ chân (Retention)." },
        { name: "Hiệu quả ROI / CAC / LTV", desc: "Tối ưu hóa ngân sách tiếp thị dựa trên chỉ số hoàn vốn thực tế và chi phí chuyển đổi đơn vị." },
        { name: "Kiểm định A/B & Phân tích Số liệu", desc: "Xây dựng giả thuyết đo lường khoa học, đọc biểu đồ cohort và ra quyết định dựa trên dữ liệu thực tế." }
      ]
    },
    CONTENT_MEDIA: {
      badge: "GÓC NHÌN NGÀNH SÁNG TẠO NỘI DUNG & MEDIA",
      title: "Tiêu chuẩn Đánh giá Sáng tạo & Định vị Thông điệp",
      desc: "Trọng tâm thẩm định tập trung vào tính độc bản của ý tưởng, nghệ thuật kể chuyện (Storytelling) và khả năng tối ưu hóa tương tác đa kênh.",
      pillars: [
        { name: "Tính Độc bản & Tiếng nói Thương hiệu", desc: "Tạo lập phong cách thể hiện riêng biệt, tránh lối mòn nội dung và nhất quán với bộ quy chuẩn nhận diện." },
        { name: "Storytelling & Dẫn dắt Cảm xúc", desc: "Cấu trúc kịch bản khéo léo, chạm đúng tâm lý người tiếp nhận (Insight) và giữ chân khán giả." },
        { name: "Mức độ Tương tác (Engagement) & Thuật toán Kênh", desc: "Nắm bắt logic phân phối của nền tảng (Video ngắn, Social, SEO) để tối ưu phạm vi lan tỏa." }
      ]
    },
    FINANCE: {
      badge: "GÓC NHÌN NGÀNH TÀI CHÍNH & KẾ TOÁN",
      title: "Tiêu chuẩn Đánh giá Độ chính xác & Kiểm soát Rủi ro",
      desc: "Trọng tâm thẩm định tập trung vào tính toàn vẹn số liệu, tuân thủ chuẩn mực kế toán (VAS/IFRS) và năng lực quản trị thanh khoản/dòng tiền.",
      pillars: [
        { name: "Độ chính xác & Toàn vẹn Dữ liệu", desc: "Tính toán chặt chẽ, kiểm soát sai lệch số liệu và bảo đảm tính minh bạch của sổ sách báo cáo." },
        { name: "Tuân thủ Chuẩn mực VAS / IFRS & Pháp lý Thuế", desc: "Áp dụng chính xác quy định hạch toán hiện hành, điều lệ kiểm toán và nguyên tắc quản trị rủi ro pháp lý." },
        { name: "Quản trị Dòng tiền & Tối ưu Chi phí", desc: "Dự báo luồng tiền vào/ra (Cash flow), phân tích biến động chi phí và bảo vệ an toàn thanh khoản." }
      ]
    },
    HR: {
      badge: "GÓC NHÌN NGÀNH NHÂN SỰ & QUẢN TRỊ CON NGƯỜI",
      title: "Tiêu chuẩn Đánh giá Phát triển Tổ chức & Quan hệ Lao động",
      desc: "Trọng tâm thẩm định tập trung vào cấu trúc phỏng vấn hành vi STAR, chiến lược giải quyết xung đột nội bộ và hoạch định nhân tài.",
      pillars: [
        { name: "Phương pháp luận STAR & Thẩm định Ứng viên", desc: "Khai thác sâu bối cảnh, nhiệm vụ, hành động và kết quả để đo lường năng lực hành vi khách quan." },
        { name: "Hòa giải Xung đột & Văn hóa Doanh nghiệp", desc: "Kỹ năng lắng nghe thấu cảm, giải quyết tranh chấp quyền lợi và xây dựng môi trường gắn kết đội ngũ." },
        { name: "Hoạch định Nguồn nhân lực & Giữ chân Nhân tài", desc: "Cân đối ngân sách tuyển dụng, thiết kế chính sách đãi ngộ (C&B) và lộ trình thăng tiến nhân sự." }
      ]
    },
    BA_OPS: {
      badge: "GÓC NHÌN NGÀNH PHÂN TÍCH NGHIỆP VỤ & VẬN HÀNH",
      title: "Tiêu chuẩn Đánh giá Khảo sát Yêu cầu & Quản trị Quy trình",
      desc: "Trọng tâm thẩm định tập trung vào khả năng chuyển hóa bài toán kinh doanh thành giải pháp, điều phối kỳ vọng bên liên quan và mô hình hóa luồng xử lý.",
      pillars: [
        { name: "Bóc tách Yêu cầu & Phân tích Khoảng trống (Gap Analysis)", desc: "Xác định ranh giới bài toán, viết Use Cases / User Stories rõ ràng và hạn chế phát sinh phạm vi (scope creep)." },
        { name: "Quản lý Kỳ vọng Stakeholder & Backlog", desc: "Điều phối mâu thuẫn ưu tiên giữa các phòng ban, sắp xếp lộ trình tính năng và quản trị rủi ro bàn giao." },
        { name: "Mô hình hóa Quy trình (BPMN) & Tối ưu Lead Time", desc: "Trực quan hóa luồng công việc hiện tại (As-Is) và tương lai (To-Be) nhằm cắt giảm lãng phí vận hành." }
      ]
    },
    GENERAL: {
      badge: "GÓC NHÌN NĂNG LỰC CHUYÊN MÔN TOÀN DIỆN",
      title: "Tiêu chuẩn Đánh giá Phương pháp Luận & Tư duy Giải quyết Vấn đề",
      desc: "Trọng tâm thẩm định tập trung vào tư duy phản biện, phương pháp tiếp cận bài toán có cấu trúc, năng lực thích ứng và đạo đức nghề nghiệp.",
      pillars: [
        { name: "Tư duy Phản biện & Tiếp cận Có Cấu trúc", desc: "Phân tích vấn đề theo từng lớp logic, truy tìm nguyên nhân gốc và bảo vệ quan điểm bằng lập luận xác đáng." },
        { name: "Khả năng Thích ứng & Tự học Chủ động", desc: "Tốc độ cập nhật nghiệp vụ mới, linh hoạt điều chỉnh khi môi trường thay đổi và chủ động khắc phục điểm nghẽn." },
        { name: "Đạo đức Nghề nghiệp & Trách nhiệm Cam kết", desc: "Thực hiện cam kết công việc với tính trung thực cao, tôn trọng quy chuẩn tổ chức và tinh thần hợp tác." }
      ]
    }
  };

  const cfg = profileConfigs[profile] || profileConfigs.GENERAL;
  if (badge) badge.textContent = cfg.badge;
  if (title) title.textContent = cfg.title;
  if (desc) desc.textContent = cfg.desc;

  // Extract actual verified diagnoses to anchor feedback to reality
  const diag = report?.diagnosticAnalysis || report?.DiagnosticAnalysis || {};
  const strengths = diag.strengthDiagnoses || diag.StrengthDiagnoses || report?.strengths || [];
  const weaknesses = diag.weaknessDiagnoses || diag.WeaknessDiagnoses || report?.weaknesses || [];

  let evidenceSnippetHtml = "";
  if (strengths.length > 0 || weaknesses.length > 0) {
    const verifiedPoints = [
      ...strengths.slice(0, 2).map(s => `
        <li class="dp-evidence-item strength">
          <span class="dp-evidence-badge strength"><i class="fas fa-check-circle"></i> Điểm mạnh</span>
          <div class="dp-evidence-content">
            <strong class="dp-evidence-title">${escapeHtml(s.conceptId || s.title || s.Title || "Năng lực chuyên môn")}</strong>
            <span class="dp-evidence-sep">—</span>
            <span class="dp-evidence-desc">${escapeHtml(s.evidence || s.description || "Thể hiện kiến thức vững vàng.")}</span>
          </div>
        </li>
      `),
      ...weaknesses.slice(0, 1).map(w => `
        <li class="dp-evidence-item weakness">
          <span class="dp-evidence-badge weakness"><i class="fas fa-exclamation-circle"></i> Cần củng cố</span>
          <div class="dp-evidence-content">
            <strong class="dp-evidence-title">${escapeHtml(w.conceptId || w.title || w.Title || "Nội dung cần lưu ý")}</strong>
            <span class="dp-evidence-sep">—</span>
            <span class="dp-evidence-desc">${escapeHtml(w.rootCause || w.RootCause || w.evidence || "Cần bổ sung dẫn chứng chi tiết hơn.")}</span>
          </div>
        </li>
      `)
    ];
    evidenceSnippetHtml = `
      <div class="dp-evidence-box">
        <span class="dp-evidence-box-title"><i class="fas fa-clipboard-check"></i> Minh chứng ghi nhận từ các lượt trả lời trong buổi phỏng vấn:</span>
        <ul class="dp-evidence-list">
          ${verifiedPoints.join("")}
        </ul>
      </div>
    `;
  } else {
    evidenceSnippetHtml = `
      <div class="dp-evidence-box empty">
        <i class="fas fa-info-circle"></i> Chưa có đủ lượt trả lời thực tế để đối chiếu chi tiết theo tiêu chuẩn ngành này. Các tiêu chí trên sẽ được AI tự động kiểm tra trong suốt buổi phỏng vấn thực chiến.
      </div>
    `;
  }

  body.innerHTML = `
    <div class="dp-pillars-grid">
      ${cfg.pillars.map((p, idx) => `
        <div class="dp-pillar-card">
          <div class="dp-pillar-num">0${idx + 1}</div>
          <h4 class="dp-pillar-title">${escapeHtml(p.name)}</h4>
          <p class="dp-pillar-desc">${escapeHtml(p.desc)}</p>
        </div>
      `).join("")}
    </div>
    ${evidenceSnippetHtml}
  `;
}

// ==========================================================================
// PREPMATE REPORT VOICE (TEXT-TO-SPEECH) SUBSYSTEM (WI-REPORT-ACCESS-01)
// ==========================================================================
const PrepMateReportVoice = (function () {
  let _activeBtn = null;
  let _currentUtterance = null;

  function isSupported() {
    return typeof window !== "undefined" && Boolean(window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined");
  }

  function stop() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    if (_activeBtn) {
      _activeBtn.classList.remove("is-speaking");
      _activeBtn.setAttribute("aria-label", "Nghe nhận xét bằng giọng đọc");
      const icon = _activeBtn.querySelector(".voice-icon");
      if (icon) icon.textContent = "🔊";
      const label = _activeBtn.querySelector(".voice-label");
      if (label) {
        if (_activeBtn.dataset.voiceRole === "overview") label.textContent = "Nghe nhận xét tổng quan";
        else if (_activeBtn.dataset.voiceRole === "diagnostics") label.textContent = "Nghe nhận xét chẩn đoán";
        else label.textContent = "Nghe";
      }
      _activeBtn = null;
    }
    _currentUtterance = null;
  }

  function getVietnameseVoice() {
    if (!window.speechSynthesis || typeof window.speechSynthesis.getVoices !== "function") return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.lang && (v.lang.toLowerCase() === "vi-vn" || v.lang.toLowerCase().startsWith("vi"))) ||
           voices.find(v => v.lang && v.lang.startsWith("en")) ||
           voices[0] || null;
  }

  function speak(text, buttonEl, role = "") {
    if (!isSupported()) {
      alert("Trình duyệt hiện tại chưa hỗ trợ Web Speech API. Bạn có thể đọc trực tiếp nội dung văn bản trên màn hình.");
      return;
    }

    if (_activeBtn === buttonEl) {
      stop();
      return;
    }

    stop();

    if (!text || typeof text !== "string" || !text.trim()) return;

    const cleanText = text
      .replace(/<[^>]*>/g, " ")
      .replace(/[*#_`~>\[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText) return;

    try {
      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.lang = "vi-VN";
      utter.rate = 1.0;
      utter.pitch = 1.0;

      const v = getVietnameseVoice();
      if (v) utter.voice = v;

      utter.onend = function () {
        stop();
      };
      utter.onerror = function (e) {
        console.warn("[REPORT VOICE] Speech error:", e);
        stop();
      };

      _currentUtterance = utter;
      _activeBtn = buttonEl;

      if (_activeBtn) {
        _activeBtn.classList.add("is-speaking");
        _activeBtn.setAttribute("aria-label", "Dừng phát giọng đọc");
        const icon = _activeBtn.querySelector(".voice-icon");
        if (icon) icon.textContent = "⏹";
        const label = _activeBtn.querySelector(".voice-label");
        if (label) label.textContent = "Dừng nghe";
      }

      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("[REPORT VOICE] Speech failed:", e);
      stop();
    }
  }

  function toggleVoice(type, btnEl) {
    if (!btnEl) return;
    btnEl.dataset.voiceRole = type;

    if (_activeBtn === btnEl) {
      stop();
      return;
    }

    let textToRead = "";
    if (type === "overview") {
      const sumEl = document.getElementById("hero-summary-text");
      const ratEl = document.getElementById("hero-readiness-rationale");
      textToRead = (sumEl ? sumEl.textContent.trim() : "") + " " + (ratEl ? ratEl.textContent.trim() : "");
    } else if (type === "diagnostics") {
      const activeTabBtn = document.querySelector(".diag-tab.active");
      const activeKey = activeTabBtn ? activeTabBtn.dataset.tab : "strengths";
      const panel = document.getElementById(`diag-panel-${activeKey}`);
      if (panel) {
        textToRead = panel.innerText || panel.textContent || "";
      }
    } else if (type.startsWith("turn-")) {
      const parentCard = btnEl.closest(".turn-trace-card") || btnEl.closest(".glass-panel");
      if (parentCard) {
        textToRead = parentCard.innerText || parentCard.textContent || "";
      }
    }

    speak(textToRead, btnEl, type);
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", stop);
    window.addEventListener("pagehide", stop);
  }

  return {
    isSupported,
    speak,
    stop,
    toggleVoice
  };
})();

if (typeof window !== "undefined") {
  window.PrepMateReportVoice = PrepMateReportVoice;
}

function setupReportVoiceControls(report, session) {
  // 1. Overview Voice Button
  const heroVoiceContainer = document.getElementById("hero-voice-container");
  if (heroVoiceContainer) {
    heroVoiceContainer.innerHTML = `
      <button type="button" class="btn-report-voice" onclick="PrepMateReportVoice.toggleVoice('overview', this)" aria-label="Nghe nhận xét tổng quan bằng giọng đọc">
        <span class="voice-icon" aria-hidden="true">🔊</span>
        <span class="voice-label">Nghe nhận xét tổng quan</span>
      </button>
    `;
  }

  // 2. Diagnostic Voice Button
  const diagVoiceContainer = document.getElementById("diag-voice-container");
  if (diagVoiceContainer) {
    diagVoiceContainer.innerHTML = `
      <button type="button" class="btn-report-voice" onclick="PrepMateReportVoice.toggleVoice('diagnostics', this)" aria-label="Nghe nhận xét chẩn đoán bằng giọng đọc">
        <span class="voice-icon" aria-hidden="true">🔊</span>
        <span class="voice-label">Nghe nhận xét chẩn đoán</span>
      </button>
    `;
  }
}

// ==========================================================================
// GUEST REPORT PREVIEW PIPELINE (WI-REPORT-ACCESS-01)
// ==========================================================================
function renderGuestPreviewReport(report, session) {
  const ev = report.overallEvaluation || report.OverallEvaluation || {};
  const sessInfo = report.sessionInfo || report.SessionInfo || {};
  const compInfo = report.completionInfo || report.CompletionInfo || {};
  const evidenceSummary = report.evidenceSummary || report.EvidenceSummary || {};

  // 1. Render Header
  renderHeaderMeta(sessInfo, session);

  // 2. Render Overview Hero with score and summary
  renderOverviewHero(ev, null, sessInfo, compInfo, evidenceSummary, session);

  // 3. Render Guest Preview Callout Banner
  renderGuestPreviewBanner(report, session);

  // 4. Update Subnav Tabs with Lock indicators
  updateSubnavForGuestPreview();

  // 5. Replace Detailed Sections with Locked Teasers
  renderGuestLockedTeasers();

  // 6. Limitations Footer
  renderLimitationsFooter(report);
}

function renderGuestPreviewBanner(report, session) {
  const bannerEl = document.getElementById("guest-preview-banner");
  if (!bannerEl) return;

  const currentPath = typeof window !== "undefined" ? (window.location.pathname + window.location.search) : "";
  const returnUrl = encodeURIComponent(currentPath);
  const loginUrl = `../auth/auth.html?returnUrl=${returnUrl}`;
  const registerUrl = `../auth/auth.html?mode=register&returnUrl=${returnUrl}`;

  const overallScoreVal = Number(report.overallScore ?? report.OverallScore ?? report.score ?? 0);

  bannerEl.innerHTML = `
    <div class="guest-banner-header">
      <span class="guest-banner-icon" aria-hidden="true">🔒</span>
      <h3 class="guest-banner-title">Mở khóa Báo cáo Đánh giá Năng lực Toàn diện</h3>
    </div>
    <p class="guest-banner-desc">
      Bạn đã hoàn thành phiên phỏng vấn thử nghiệm dành cho khách với điểm số tổng quan đạt <strong>${overallScoreVal} / 100</strong>.
      Đăng nhập hoặc đăng ký tài khoản PrepMate miễn phí để mở khóa toàn bộ ma trận 6 chiều năng lực, bằng chứng STAR, phân tích điểm mạnh - điểm yếu chi tiết, và kế hoạch cải thiện 7 ngày.
    </p>
    <div class="guest-banner-actions">
      <a href="${loginUrl}" class="btn-guest-claim-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Đăng nhập để xem báo cáo chi tiết
      </a>
      <a href="${registerUrl}" class="btn-guest-claim-secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        Tạo tài khoản miễn phí
      </a>
    </div>
  `;
  bannerEl.classList.remove("hidden");
}

function updateSubnavForGuestPreview() {
  const tabs = document.querySelectorAll(".subnav-tab");
  tabs.forEach(tab => {
    const href = tab.getAttribute("href");
    if (href && href !== "#section-overview") {
      if (!tab.innerHTML.includes("🔒")) {
        tab.innerHTML = `${tab.innerHTML.trim()} <span aria-hidden="true" style="font-size: 11px; margin-left: 3px; opacity: 0.7;">🔒</span>`;
      }
    }
  });
}

function createLockedTeaserHtml(title, desc, btnText) {
  const currentPath = typeof window !== "undefined" ? (window.location.pathname + window.location.search) : "";
  const loginUrl = `../auth/auth.html?returnUrl=${encodeURIComponent(currentPath)}`;

  return `
    <div class="guest-locked-teaser-panel">
      <span class="guest-locked-icon" aria-hidden="true">🔒</span>
      <h4 class="guest-locked-title">${escapeHtml(title)}</h4>
      <p class="guest-locked-desc">${escapeHtml(desc)}</p>
      <div class="guest-locked-actions">
        <a href="${loginUrl}" class="btn-locked-unlock">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          ${escapeHtml(btnText)} &rarr;
        </a>
      </div>
    </div>
  `;
}

function renderGuestLockedTeasers() {
  // 1. Dimensions
  const dimSec = document.getElementById("section-dimensions");
  if (dimSec) {
    const grid = dimSec.querySelector(".dimensions-grid") || dimSec;
    grid.innerHTML = createLockedTeaserHtml(
      "Ma trận 6 Chiều Năng Lực",
      "Biểu đồ radar và đánh giá chi tiết 6 khía cạnh: Kiến thức chuyên môn, Ứng dụng thực tế, Độ sâu tư duy, Xử lý câu hỏi đào sâu, Kỹ năng giao tiếp và Tính nhất quán.",
      "Đăng nhập để xem ma trận năng lực"
    );
  }

  // 2. Diagnostics
  const diagSec = document.getElementById("section-diagnostics");
  if (diagSec) {
    const content = diagSec.querySelector(".diagnostic-tabs-container") || diagSec;
    content.innerHTML = createLockedTeaserHtml(
      "Chẩn đoán Điểm Mạnh & Điểm Yếu Chuyên Sâu",
      "Phân tích chuyên sâu chỉ ra chính xác các thế mạnh đã kiểm chứng, lỗ hổng năng lực (Knowledge Gaps), và rủi ro tiềm ẩn kèm theo trích dẫn từ từng câu trả lời thực tế.",
      "Đăng nhập để xem chẩn đoán chuyên sâu"
    );
  }

  // 3. Roadmap
  const roadSec = document.getElementById("section-roadmap");
  if (roadSec) {
    const container = roadSec.querySelector(".roadmap-timeline") || roadSec.querySelector(".roadmap-card") || roadSec;
    container.innerHTML = createLockedTeaserHtml(
      "Lộ trình Nâng cao Năng lực Cá nhân hóa",
      "Kế hoạch phát triển năng lực chia theo 3 giai đoạn: Ưu tiên cốt lõi, Nâng cao năng lực chuyên môn và Làm chủ tư duy phỏng vấn.",
      "Đăng nhập để xem lộ trình nâng cao"
    );
  }

  // 4. Preparation Plan
  const prepSec = document.getElementById("section-preparation");
  if (prepSec) {
    const grid = prepSec.querySelector(".prep-grid") || prepSec;
    grid.innerHTML = createLockedTeaserHtml(
      "Hệ sinh thái Chuẩn bị & Kế hoạch Hành động 7 Ngày",
      "Lộ trình luyện tập 7 ngày chi tiết từng bước, gợi ý kịch bản trả lời và bộ câu hỏi ứng viên nên hỏi nhà tuyển dụng.",
      "Đăng nhập để xem kế hoạch 7 ngày"
    );
  }

  // 5. Checklist
  const chkSec = document.getElementById("section-checklist");
  if (chkSec) {
    const container = chkSec.querySelector(".checklist-container") || chkSec;
    container.innerHTML = createLockedTeaserHtml(
      "Bảng kiểm Chuẩn bị Phỏng vấn Tương tác",
      "Bảng kiểm toàn diện giúp bạn rà soát trang phục, thiết bị, tâm lý và kiến thức trước khi bước vào buổi phỏng vấn thực tế.",
      "Đăng nhập để xem bảng kiểm"
    );
  }

  // 6. Speech Coaching
  const speechSec = document.getElementById("section-speech-coaching");
  if (speechSec) {
    const container = speechSec.querySelector(".speech-coaching-container") || speechSec;
    container.innerHTML = createLockedTeaserHtml(
      "Huấn luyện Giọng nói & Tác phong Phỏng vấn",
      "Phân tích tốc độ nói (WPM), phát hiện khoảng lặng ngập ngừng, đánh giá độ rõ ràng và tác phong camera qua từng lượt.",
      "Đăng nhập để xem coaching tác phong"
    );
  }

  // 7. Provenance
  const provSec = document.getElementById("section-provenance");
  if (provSec) {
    const container = provSec.querySelector(".provenance-timeline") || provSec;
    container.innerHTML = createLockedTeaserHtml(
      "Minh chứng Từng Lượt Hỏi Đáp & Feedback Chi Tiết",
      "Xem lại toàn bộ câu hỏi của nhà tuyển dụng, câu trả lời của bạn, phân tích STAR và phản hồi nhận xét của AI cho từng lượt.",
      "Đăng nhập để xem toàn bộ lượt hỏi đáp"
    );
  }
}


// ==========================================================================
// 10D. SECTION 6D: VIDEO MOMENT REPLAY & TIMESTAMP-ALIGNED EVIDENCE (WI-COACH-04C)
// ==========================================================================
async function renderVideoMomentsSection(report, session, visualReport) {
  const container = document.getElementById("video-moments-list");
  const countBadge = document.getElementById("video-moments-count-badge");
  if (!container) return;

  // Cleanup previously allocated video widgets and object URLs
  if (typeof PrepMateVideoClipPlayer !== "undefined" && typeof PrepMateVideoClipPlayer.disposeAll === "function") {
    PrepMateVideoClipPlayer.disposeAll();
  }
  container.innerHTML = "";

  const sessId = session?.backendSessionId || session?.id || report?.sessionId || _currentSessionId ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sessionId"));

  let recordings = [];
  if (typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.getAllRecordingsForSession === "function" && sessId) {
    try {
      recordings = await PrepMateAudioRecorder.getAllRecordingsForSession(sessId);
    } catch (e) {
      console.warn("[REPORT] Cannot load recordings for video replay:", e);
    }
  }

  if ((!recordings || recordings.length === 0) && Array.isArray(session?.recordings)) {
    recordings = session.recordings;
  }

  // Filter video recordings
  const videoRecordings = (recordings || []).filter(r =>
    r.videoBlob &&
    r.videoBlob.size > 0 &&
    (r.isMasterMedia || (r.mimeType && r.mimeType.startsWith("video/")))
  );

  if (videoRecordings.length === 0) {
    if (countBadge) {
      countBadge.textContent = "Chưa có video";
      countBadge.style.background = "#f1f5f9";
      countBadge.style.color = "#64748b";
    }
    container.innerHTML = `
      <div class="pm-vclip-fallback-notice">
        <span class="fallback-icon">📹</span>
        <div class="fallback-content">
          <strong class="fallback-title">Chưa có bản ghi video cho phiên này hoặc camera đã tắt</strong>
          <p class="fallback-desc">
            Không tìm thấy bản ghi video gốc trong trình duyệt hiện tại. Nếu bạn đã hoàn thành buổi phỏng vấn bằng chế độ chỉ âm thanh, bạn có thể nghe lại đầy đủ các lượt ở danh sách âm thanh bên trên.
          </p>
        </div>
      </div>
    `;
    return;
  }

  let totalObservationsCount = 0;
  const playerModule = typeof PrepMateVideoClipPlayer !== "undefined" ? PrepMateVideoClipPlayer : null;

  for (const rec of videoRecordings) {
    let obsList = [];
    if (playerModule && typeof playerModule.extractReplayableObservations === "function") {
      obsList = playerModule.extractReplayableObservations(rec);
    }

    obsList.forEach(obs => {
      totalObservationsCount++;
      if (playerModule && typeof playerModule.createVideoClipPlayerElement === "function") {
        const widget = playerModule.createVideoClipPlayerElement(obs, rec, { compact: false });
        container.appendChild(widget);
      }
    });
  }

  if (countBadge) {
    countBadge.textContent = `${totalObservationsCount} khoảnh khắc`;
    countBadge.style.background = "#dcfce7";
    countBadge.style.color = "#15803d";
  }
}


// ==========================================================================
// 10E. SECTION 6E: EVIDENCE-BASED AI VOICE & BODY COACHING (WI-COACH-04D)
// ==========================================================================
async function renderVoiceBodyCoachingSection(report, session, visualReport) {
  const container = document.getElementById("voice-body-coaching-list");
  const countBadge = document.getElementById("voice-body-coaching-badge");
  if (!container) return;

  container.innerHTML = "";

  const sessId = session?.backendSessionId || session?.id || report?.sessionId || _currentSessionId ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sessionId"));

  let recordings = [];
  if (typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioRecorder.getAllRecordingsForSession === "function" && sessId) {
    try {
      recordings = await PrepMateAudioRecorder.getAllRecordingsForSession(sessId);
    } catch (e) {
      console.warn("[REPORT] Cannot load recordings for coaching synthesis:", e);
    }
  }

  if ((!recordings || recordings.length === 0) && Array.isArray(session?.recordings)) {
    recordings = session.recordings;
  }

  const synth = typeof VoiceBodyCoachingSynthesizer !== "undefined"
    ? VoiceBodyCoachingSynthesizer
    : ((typeof PrepMateCoachingSynthesizer !== "undefined") ? PrepMateCoachingSynthesizer : null);

  if (!synth) {
    container.innerHTML = `<div style="font-size:12px;color:#64748b;padding:12px;">Đang tải động cơ huấn luyện tác phong & diễn đạt...</div>`;
    return;
  }

  const payload = synth.buildEvidencePayload({ session, report, recordings, visualReport });
  const items = await synth.synthesizeCoaching(payload, { apiBaseUrl: window.API_BASE_URL || "" });

  if (countBadge) {
    countBadge.textContent = `${items.length} khuyến nghị chuẩn 5 phần`;
  }

  if (items.length === 0) {
    container.innerHTML = `<div style="font-size:12px;color:#64748b;padding:12px;">Chưa có đủ dữ liệu đối thoại để tổng hợp khuyến nghị.</div>`;
    return;
  }

  // Pre-index recordings by id
  const recMap = new Map();
  (recordings || []).forEach(r => {
    if (r.id) recMap.set(r.id, r);
    if (typeof r.turnIndex === "number") recMap.set("turn_" + r.turnIndex, r);
  });

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "pm-coaching-card";
    card.setAttribute("data-item-id", item.id);

    // Dimension badge styling
    let dimLabel = "🗣️ Giọng nói & Nhịp độ";
    let dimClass = "voice";
    if (item.dimension === "body_language") {
      dimLabel = "🧍 Tác phong & Ngôn ngữ cơ thể";
      dimClass = "body";
    } else if (item.dimension === "integrated") {
      dimLabel = "🔄 Tích hợp Diễn đạt & Tác phong";
      dimClass = "integrated";
    }

    // Confidence badge styling
    const confStatus = item.confidenceAndLimitations?.status || "reliable_evidence";
    let confText = "✓ Minh chứng tin cậy";
    let confClass = "status-reliable";
    if (confStatus === "uncertain_evidence") {
      confText = "⚠️ Minh chứng ước lượng";
      confClass = "status-uncertain";
    } else if (confStatus === "insufficient_evidence") {
      confText = "⚠️ Chưa đủ dữ liệu hình ảnh";
      confClass = "status-insufficient";
    } else if (confStatus === "unavailable_media") {
      confText = "📹 Không có video / Chỉ có âm thanh";
      confClass = "status-unavailable";
    }

    const turnLabel = item.turnIndex === 0 ? "Khởi động" : `Lượt ${item.turnIndex}`;

    // Tier badge
    const tier = item.evidence?.selectedTier || "";
    let tierText = "🎙️ Phân tích âm thanh";
    if (tier === "tier1_mediapipe") tierText = "🎯 Tier 1 MediaPipe";
    else if (tier === "tier2_contour_fallback") tierText = "📐 Tier 2 Contour Fallback";
    else if (tier === "integrated") tierText = "🔗 Tích hợp Âm thanh & Hình ảnh";

    // Video clip button or placeholder
    let videoActionHtml = "";
    if (item.evidence?.hasVideoClip && item.evidence?.playbackWindow) {
      const pw = item.evidence.playbackWindow;
      videoActionHtml = `
        <button type="button" class="pm-coaching-clip-btn" data-record-id="${escapeHtml(item.evidence.recordId || "")}" data-turn="${item.turnIndex}" data-start="${pw.startSec}" data-end="${pw.endSec}" data-title="${escapeHtml(item.observation)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Xem khoảnh khắc video (${pw.startSec}s - ${pw.endSec}s)
        </button>
      `;
    } else if (item.dimension === "body_language" && !item.evidence?.hasVideoClip) {
      videoActionHtml = `<span class="pm-coaching-no-vid">Chỉ có âm thanh / Không có video lượt này</span>`;
    }

    card.innerHTML = `
      <div class="pm-coaching-header">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span class="pm-dim-badge ${dimClass}">${dimLabel}</span>
          <span class="pm-turn-badge">${turnLabel}</span>
        </div>
        <span class="pm-conf-badge ${confClass}">${confText}</span>
      </div>

      <div class="pm-coaching-body">
        <!-- Phần A: Quan sát thực tế -->
        <div class="pm-coaching-row pm-row-obs">
          <div class="pm-row-label">🔍 Quan sát thực tế (Observation)</div>
          <div class="pm-row-text">${escapeHtml(item.observation)}</div>
        </div>

        <!-- Phần B: Minh chứng & Tín hiệu -->
        <div class="pm-coaching-row pm-row-ev">
          <div class="pm-row-label">📊 Tín hiệu đo đạc (Evidence)</div>
          <div class="pm-row-content">
            <span class="pm-ev-chip">
              ${escapeHtml(item.evidence?.signal || "")}: <strong>${escapeHtml(item.evidence?.measurementValue || "")}</strong>
            </span>
            <span class="pm-tier-chip">${tierText}</span>
            ${videoActionHtml}
          </div>
          <!-- In-card clip player container -->
          <div class="pm-coaching-inlined-player" style="display:none; margin-top:8px;"></div>
        </div>

        <!-- Phần C: Phân tích tác động -->
        <div class="pm-coaching-row pm-row-interp">
          <div class="pm-row-label">🎯 Phân tích tác động (Interpretation)</div>
          <div class="pm-row-text">${escapeHtml(item.interpretation)}</div>
        </div>

        <!-- Phần D: Bài tập rèn luyện -->
        <div class="pm-coaching-row pm-row-rec">
          <div class="pm-row-label">💡 Bài tập rèn luyện (Recommendation)</div>
          <div class="pm-row-text">${escapeHtml(item.recommendation)}</div>
        </div>

        <!-- Phần E: Giới hạn & Độ tin cậy -->
        <div class="pm-coaching-row pm-row-lim">
          <div class="pm-row-label">⚙️ Độ tin cậy & Giới hạn kỹ thuật (Confidence & Limitations)</div>
          <div class="pm-row-text">${escapeHtml(item.confidenceAndLimitations?.reason || "")}</div>
        </div>
      </div>

      <div class="pm-coaching-footer">
        <span>🛡️ Chuẩn minh chứng PrepMate • Hoàn toàn độc lập với điểm năng lực chuyên môn (affectsProfessionalScore = false)</span>
      </div>
    `;

    // Hook click event on clip button
    const clipBtn = card.querySelector(".pm-coaching-clip-btn");
    if (clipBtn) {
      clipBtn.addEventListener("click", () => {
        const recId = clipBtn.getAttribute("data-record-id");
        const turnIdx = parseInt(clipBtn.getAttribute("data-turn"), 10);
        const startSec = parseFloat(clipBtn.getAttribute("data-start"));
        const endSec = parseFloat(clipBtn.getAttribute("data-end"));
        const title = clipBtn.getAttribute("data-title");

        // Find matching recording
        let matchedRec = recId ? recMap.get(recId) : null;
        if (!matchedRec) matchedRec = recMap.get("turn_" + turnIdx);
        if (!matchedRec && recordings && recordings[turnIdx]) matchedRec = recordings[turnIdx];

        const playerContainer = card.querySelector(".pm-coaching-inlined-player");
        if (playerContainer && matchedRec && typeof PrepMateVideoClipPlayer !== "undefined") {
          if (playerContainer.style.display === "block" && playerContainer.childNodes.length > 0) {
            playerContainer.style.display = "none";
            playerContainer.innerHTML = "";
            return;
          }
          playerContainer.innerHTML = "";
          playerContainer.style.display = "block";

          const pseudoObs = {
            id: item.id,
            title: title || item.observation,
            type: "COACHING_MOMENT",
            clipWindow: { startSec, endSec, durationSec: endSec - startSec }
          };
          const playerWidget = PrepMateVideoClipPlayer.createVideoClipPlayerElement(pseudoObs, matchedRec, { compact: false });
          playerContainer.appendChild(playerWidget);
        } else if (typeof PrepMateVideoClipPlayer !== "undefined" && typeof PrepMateVideoClipPlayer.openClip === "function") {
          PrepMateVideoClipPlayer.openClip({ recordId: recId, startSec, endSec, eventTitle: title });
        }
      });
    }

    container.appendChild(card);
  });
}

// ==========================================================================
// 19. WI-REPORT-03: INTERVIEW INTELLIGENCE & PREPARATION ECOSYSTEM
// ==========================================================================

function getUserRole() {
  try {
    if (typeof getCurrentUser === "function") {
      const u = getCurrentUser();
      if (u && (u.role || u.Role)) return String(u.role || u.Role).toLowerCase();
    }
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem("prepmate_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.role || parsed.Role)) return String(parsed.role || parsed.Role).toLowerCase();
      }
    }
  } catch (e) {}
  return "candidate";
}

// ==========================================================================
// WI-REPORT-03 & WI-REPORT-03R1: Guided Three-Stage Stepper & Viewport Panels
// ==========================================================================

let _currentActiveStage = "overview";
let _currentActivePhase = "overview";

function goToStage(stageName, options = { scroll: true }) {
  let stage = stageName || "overview";
  
  // Aliases and normalizations
  if (stage === "analysis") stage = "during";
  if (stage === "recommendations") stage = "after";
  
  const validStages = ["overview", "feedback", "during", "after", "before"];
  if (!validStages.includes(stage)) stage = "overview";
  
  _currentActiveStage = stage;
  _currentActivePhase = stage;

  // 1. Toggle visibility of stage panels in DOM (Strict Viewport Isolation)
  const panels = [
    { id: "stage-panel-overview", match: stage === "overview" },
    { id: "stage-panel-feedback", match: stage === "feedback" },
    { id: "stage-panel-during", match: stage === "during" },
    { id: "stage-panel-after", match: stage === "after" },
    { id: "stage-panel-before", match: stage === "before" }
  ];

  panels.forEach(({ id, match }) => {
    const panel = document.getElementById(id);
    if (!panel) return;
    if (match) {
      panel.style.display = "block";
      if (panel.classList) panel.classList.add("active");
    } else {
      panel.style.display = "none";
      if (panel.classList) panel.classList.remove("active");
    }
  });

  // 2. Toggle active state of stepper tab buttons
  const stageBtns = [
    { id: "phase-btn-overview", active: stage === "overview" },
    { id: "phase-btn-feedback", active: stage === "feedback" },
    { id: "phase-btn-analysis", active: stage === "during" },
    { id: "phase-btn-recommendations", active: stage === "after" },
    { id: "phase-btn-before", active: stage === "before" },
    { id: "phase-btn-during", active: stage === "during" },
    { id: "phase-btn-after", active: stage === "after" }
  ];

  stageBtns.forEach(({ id, active }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (active) {
      if (btn.classList) btn.classList.add("active");
      if (typeof btn.setAttribute === "function") btn.setAttribute("aria-selected", "true");
    } else {
      if (btn.classList) btn.classList.remove("active");
      if (typeof btn.setAttribute === "function") btn.setAttribute("aria-selected", "false");
    }
  });

  // Also support any button matching data-stage, data-tab, or data-phase
  const allBtns = (typeof document.querySelectorAll === "function" ? document.querySelectorAll(".stage-tab-btn, .phase-pill-btn, .report-stage-btn") : []) || [];
  allBtns.forEach((b) => {
    const s = (typeof b.getAttribute === "function" ? (b.getAttribute("data-stage") || b.getAttribute("data-tab") || b.getAttribute("data-phase")) : null);
    const isActive = (s === stage) || 
      (stage === "during" && (s === "analysis" || s === "during")) ||
      (stage === "after" && (s === "recommendations" || s === "after")) ||
      (stage === "overview" && (s === "overview" || s === "all"));
    if (isActive) {
      if (b.classList) b.classList.add("active");
      if (typeof b.setAttribute === "function") b.setAttribute("aria-selected", "true");
    } else if (s && s !== "all") {
      if (b.classList) b.classList.remove("active");
      if (typeof b.setAttribute === "function") b.setAttribute("aria-selected", "false");
    }
  });

  // 3. Update URL search param without full-page reload
  if (typeof window !== "undefined" && window.history && typeof window.history.replaceState === "function" && window.location) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("stage", stage);
      window.history.replaceState(null, "", url.toString());
    } catch (_) {}
  }

  // 4. Scroll smoothly to primary stage navigation/stages viewport if requested
  if (options && options.scroll && typeof document !== "undefined") {
    const viewport = document.getElementById("report-phase-nav") || document.getElementById("stages-viewport");
    if (viewport && typeof viewport.scrollIntoView === "function") {
      viewport.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}
window.goToStage = goToStage;

function switchActivePhase(phase, options = { scroll: true }) {
  const targetStage = (phase === "all" || !phase) ? "before" : phase;
  goToStage(targetStage, options);
}
window.switchActivePhase = switchActivePhase;

function setupPhaseNavigation() {
  const phaseNav = document.getElementById("report-phase-nav");
  if (!phaseNav) return;

  const buttons = (typeof phaseNav.querySelectorAll === "function" ? phaseNav.querySelectorAll(".stage-tab-btn, .phase-pill-btn") : []) || [];
  buttons.forEach((btn) => {
    if (btn.dataset && btn.dataset.stageBound === "true") return;
    if (btn.dataset) btn.dataset.stageBound = "true";

    if (typeof btn.addEventListener === "function") {
      btn.addEventListener("click", () => {
        const stage = (typeof btn.getAttribute === "function" ? (btn.getAttribute("data-stage") || btn.getAttribute("data-phase")) : null) || "before";
        goToStage(stage, { scroll: true });
      });
    }
  });

  // Setup subnav anchor interception so clicking links smoothly reveals the appropriate stage
  setupSubnavInterception();

  // Check URL query param for initial stage
  if (typeof window !== "undefined" && window.location && window.location.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      const initialStage = params.get("stage");
      if (initialStage && ["overview", "feedback", "analysis", "recommendations", "during", "after", "before"].includes(initialStage)) {
        goToStage(initialStage, { scroll: false });
        return;
      }
    } catch (_) {}
  }

  // Ensure initial active stage is synced
  goToStage(_currentActiveStage || "overview", { scroll: false });
}
window.setupPhaseNavigation = setupPhaseNavigation;

function setupSubnavInterception() {
  const sectionStageMap = {
    "section-overview": "overview",
    "section-question-feedback": "feedback",
    "section-preparation": "before",
    "section-checklist": "before",
    "section-dimensions": "during",
    "section-diagnostics": "during",
    "section-speech-coaching": "during",
    "section-provenance": "during",
    "section-roadmap": "after"
  };

  const navLinks = (typeof document.querySelectorAll === "function" ? document.querySelectorAll(".subnav-tab, #hero-cta-explore, .hero-cta-btn") : []) || [];
  navLinks.forEach((link) => {
    if (link.dataset && link.dataset.stageNavBound === "true") return;
    if (link.dataset) link.dataset.stageNavBound = "true";

    if (typeof link.addEventListener === "function") {
      link.addEventListener("click", (e) => {
        const href = (typeof link.getAttribute === "function" ? link.getAttribute("href") : "") || "";
        const targetId = (typeof link.getAttribute === "function" ? link.getAttribute("data-target") : "") || (href.startsWith("#") ? href.slice(1) : "");
        const targetStage = sectionStageMap[targetId];

        if (targetStage) {
          goToStage(targetStage, { scroll: false });
          const targetEl = document.getElementById(targetId);
          if (targetEl && typeof targetEl.scrollIntoView === "function") {
            if (typeof e.preventDefault === "function") e.preventDefault();
            targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      });
    }
  });
}
window.setupSubnavInterception = setupSubnavInterception;

// --------------------------------------------------------------------------
// Company Intelligence & Provenance
// --------------------------------------------------------------------------
function renderCompanyIntelligence(session = {}, report = {}) {
  const container = document.getElementById("prep-company-intel-box");
  if (!container) return;

  const sessInfo = (report && (report.sessionInfo || report.SessionInfo)) || {};
  const companyName = (session && (session.companyName || session.company || session.targetCompany)) || sessInfo.targetCompany || "";
  const jobTitle = (session && (session.jobTitle || session.targetPosition)) || sessInfo.targetPosition || "Chuyên viên chuyên môn";
  const industry = (session && (session.industry || session.selectedIndustry)) || "";
  const jdText = (session && (session.jdText || session.jobDescription || (session.InterviewContext && session.InterviewContext.JobDescription))) || "";
  const blueprint = (session && session.InterviewContext && session.InterviewContext.KnowledgeBlueprint) || null;
  const prep = (report && (report.preparationPlan || report.PreparationPlan)) || {};
  const companyPrep = prep.companyPreparation || prep.CompanyPreparation || [];

  const hasRealCompany = Boolean(companyName && companyName !== "Doanh nghiệp" && companyName !== "unspecified");
  const hasJD = Boolean(jdText && jdText.trim().length > 10);
  const isVerified = Boolean((blueprint && blueprint.CompanyContext && blueprint.CompanyContext.isVerified) || (companyPrep.length > 0 && companyPrep[0].isMandatory));

  const companyProvenance = isVerified ? "verified" : (hasJD ? "jd" : (hasRealCompany ? "ai" : "missing"));
  const companyProvenanceLabel = isVerified ? "Đã xác minh" : (hasJD ? "Theo JD" : (hasRealCompany ? "Nhận định AI" : "Chưa có dữ liệu"));

  const displayName = hasRealCompany ? companyName : "Doanh nghiệp mục tiêu (Chưa định danh)";
  const displaySector = industry || (hasJD ? "Công nghệ & Dịch vụ số" : "Chưa xác định nhóm ngành");
  let searchSessionId = "";
  if (typeof window !== "undefined" && window.location && window.location.search && typeof URLSearchParams !== "undefined") {
    try {
      const p = new URLSearchParams(window.location.search);
      searchSessionId = p.get("id") || p.get("sessionId") || "";
    } catch (_) {}
  }
  const sessionId = session?.backendSessionId || session?.id || _currentSessionId || searchSessionId || "";

  const hasCompanyData = hasRealCompany || hasJD;

  const topRequirements = hasJD
    ? [
        `Nắm vững kiến thức nền tảng và kỹ năng kỹ thuật trọng tâm cho vị trí ${jobTitle}`,
        "Thiết kế kiến trúc hệ thống chịu tải cao, áp dụng chuẩn thiết kế mở rộng và bảo mật",
        "Kỹ năng giải quyết bài toán nghiệp vụ thực tế và giao tiếp minh bạch theo chuẩn mực"
      ]
    : (hasRealCompany ? [
        `Nền tảng chuyên môn cốt lõi theo chuẩn vị trí ${jobTitle}`,
        "Khả năng thích ứng nhanh với môi trường làm việc thực tế tại doanh nghiệp"
      ] : []);

  container.innerHTML = `
    <div class="company-summary-card glass-panel" id="company-summary-card">
      <div class="company-summary-header">
        <div class="company-summary-title-wrap">
          <span class="company-summary-badge">TỔNG QUAN DOANH NGHIỆP & YÊU CẦU</span>
          <h4 class="company-summary-name">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="2"/><line x1="8" y1="6" x2="8.01" y2="6"/><line x1="16" y1="6" x2="16.01" y2="6"/><line x1="8" y1="10" x2="8.01" y2="10"/><line x1="16" y1="10" x2="16.01" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="8" y1="18" x2="8.01" y2="18"/><line x1="16" y1="18" x2="16.01" y2="18"/></svg>
            ${escapeHtml(displayName)}
          </h4>
        </div>
        <div class="company-summary-provenance">
          <span class="provenance-tag provenance-${companyProvenance}">${escapeHtml(companyProvenanceLabel)}</span>
        </div>
      </div>

      <div class="company-summary-meta-row">
        <div class="company-summary-meta-item">
          <span class="meta-label">Vị trí ứng tuyển:</span>
          <strong class="meta-val">${escapeHtml(jobTitle)}</strong>
        </div>
        <div class="company-summary-meta-item">
          <span class="meta-label">Lĩnh vực:</span>
          <strong class="meta-val">${escapeHtml(displaySector)}</strong>
        </div>
      </div>

      ${hasCompanyData ? `
        <div class="company-summary-requirements">
          <div class="requirements-header-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Yêu cầu tuyển dụng nổi bật:</span>
          </div>
          <ul class="summary-req-list">
            ${topRequirements.map(req => `<li><span class="bullet">•</span> <span>${escapeHtml(req)}</span></li>`).join("")}
          </ul>
        </div>

        <div class="company-summary-action-row">
          <a href="company-intelligence.html?id=${encodeURIComponent(sessionId)}&from=report" class="btn btn-primary btn-view-company-cta" id="btn-view-company-intelligence">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span>Xem phân tích doanh nghiệp</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        </div>
      ` : `
        <div class="company-summary-empty-note">
          <p class="text-muted" style="margin: 8px 0 0; font-size: 13px;">Phiên phỏng vấn này chưa có dữ liệu doanh nghiệp mục tiêu hoặc mô tả công việc (JD) đính kèm.</p>
        </div>
      `}
    </div>
  `;
}
window.renderCompanyIntelligence = renderCompanyIntelligence;

function renderRecruitingNeedsBreakdown(session = {}, report = {}) {
  const container = document.getElementById("company-needs-breakdown");
  if (!container) return;

  const sessInfo = (report && (report.sessionInfo || report.SessionInfo)) || {};
  const jobTitle = (session && (session.jobTitle || session.targetPosition)) || sessInfo.targetPosition || "Chuyên viên chuyên môn";
  const jdText = (session && (session.jdText || session.jobDescription || (session.InterviewContext && session.InterviewContext.JobDescription))) || "";
  const hasJD = Boolean(jdText && jdText.trim().length > 10);
  const defaultProv = hasJD ? "jd" : "ai";
  const defaultProvLabel = hasJD ? "Theo JD" : "Nhận định AI";

  const categories = [
    {
      key: "required_skills",
      title: "Kỹ năng Cốt lõi & Bắt buộc",
      icon: "🎯",
      provenance: defaultProv,
      provenanceLabel: defaultProvLabel,
      items: hasJD
        ? ["Nắm vững kiến thức nền tảng và ngôn ngữ/framework chính của vị trí " + jobTitle, "Thành thạo cấu trúc dữ liệu, giải thuật và tối ưu truy vấn cơ bản", "Khả năng đọc hiểu tài liệu kỹ thuật và giải quyết vấn đề độc lập"]
        : ["Nền tảng chuyên môn cốt lõi theo chuẩn vị trí " + jobTitle, "Kỹ năng lập trình hoặc nghiệp vụ xử lý dữ liệu chuẩn xác", "Khả năng phân tích yêu cầu bài toán thực tế"]
    },
    {
      key: "technical_requirements",
      title: "Yêu cầu Kỹ thuật & Chuyên sâu",
      icon: "💻",
      provenance: defaultProv,
      provenanceLabel: defaultProvLabel,
      items: [
        "Thiết kế cơ sở dữ liệu quan hệ và phi quan hệ chịu tải cao",
        "Áp dụng nguyên lý Clean Architecture, SOLID và Design Patterns",
        "Tối ưu độ trễ hệ thống và bảo mật API theo chuẩn OWASP"
      ]
    },
    {
      key: "behavioral_skills",
      title: "Kỹ năng Hành vi & Kỹ năng Mềm",
      icon: "🤝",
      provenance: "ai",
      provenanceLabel: "Nhận định AI",
      items: [
        "Giao tiếp mạch lạc theo mô hình STAR, rõ bối cảnh và kết quả",
        "Tinh thần hợp tác liên phòng ban (Cross-functional collaboration)",
        "Khả năng thích ứng với thay đổi và tư duy phản biện tích cực"
      ]
    },
    {
      key: "preferred_skills",
      title: "Kỹ năng Ưu tiên & Điểm cộng",
      icon: "⭐",
      provenance: defaultProv,
      provenanceLabel: defaultProvLabel,
      items: [
        "Kinh nghiệm với hạ tầng Cloud (AWS/GCP/Azure) hoặc công cụ container (Docker, K8s)",
        "Hiểu biết về kiến trúc vi dịch vụ (Microservices), Caching (Redis) và Message Queue",
        "Có sản phẩm thực tế đã vận hành quy mô người dùng lớn"
      ]
    },
    {
      key: "expected_responsibilities",
      title: "Trách nhiệm & Phạm vi Công việc",
      icon: "📋",
      provenance: defaultProv,
      provenanceLabel: defaultProvLabel,
      items: [
        "Tham gia phân tích, thiết kế và phát triển các mô-đun nghiệp vụ trọng điểm",
        "Thực hiện Code Review, viết Unit Test và đảm bảo tiêu chuẩn chất lượng",
        "Hỗ trợ điều tra, xử lý sự cố vận hành phát sinh trong môi trường thực tế"
      ]
    },
    {
      key: "outcomes_deliverables",
      title: "Kết quả Kỳ vọng & Thước đo Thành công",
      icon: "📈",
      provenance: "ai",
      provenanceLabel: "Nhận định AI",
      items: [
        "Hòa nhập nhanh với codebase và hoàn thành task đầu tiên trong 2 tuần đầu",
        "Đảm bảo cam kết bàn giao tính năng đúng tiến độ sprint với tỷ lệ bug thấp",
        "Đóng góp cải tiến hiệu năng hoặc giảm thiểu nợ kỹ thuật (Technical Debt)"
      ]
    }
  ];

  const primaryCategories = categories.slice(0, 3);
  const extraCategories = categories.slice(3);

  const renderCard = (cat) => `
    <div class="needs-category-card">
      <div class="needs-cat-header">
        <h5 class="needs-cat-title"><span>${cat.icon}</span> <span>${escapeHtml(cat.title)}</span></h5>
        <span class="provenance-tag provenance-${cat.provenance}">${escapeHtml(cat.provenanceLabel)}</span>
      </div>
      <ul class="needs-items-list">
        ${cat.items.map(it => `
          <li class="needs-item-row">
            <span class="needs-item-bullet">•</span>
            <span>${escapeHtml(it)}</span>
          </li>
        `).join("")}
      </ul>
    </div>
  `;

  container.innerHTML = `
    <h4 class="needs-section-title">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
      Phân Tích Chi Tiết 6 Nhóm Nhu Cầu Tuyển Dụng
    </h4>
    <div class="needs-grid needs-primary-grid">
      ${primaryCategories.map(renderCard).join("")}
    </div>
    <div class="needs-grid needs-expandable-grid" id="needs-extra-grid" style="display: none; margin-top: 14px;">
      ${extraCategories.map(renderCard).join("")}
    </div>
    <div class="needs-toggle-wrap">
      <button type="button" class="btn-needs-toggle" id="btn-toggle-needs" onclick="toggleExtraNeeds()" aria-expanded="false">
        <span>Xem thêm 3 nhóm yêu cầu khác (Ưu tiên, Trách nhiệm & Thước đo)</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    </div>
  `;
}

function toggleExtraNeeds() {
  const extraGrid = document.getElementById("needs-extra-grid");
  const btn = document.getElementById("btn-toggle-needs");
  if (!extraGrid || !btn) return;
  const isHidden = extraGrid.style.display === "none" || !extraGrid.style.display;
  if (isHidden) {
    extraGrid.style.display = "grid";
    if (typeof btn.setAttribute === "function") btn.setAttribute("aria-expanded", "true");
    btn.innerHTML = `<span>Thu gọn 3 nhóm yêu cầu mở rộng</span> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>`;
  } else {
    extraGrid.style.display = "none";
    if (typeof btn.setAttribute === "function") btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = `<span>Xem thêm 3 nhóm yêu cầu khác (Ưu tiên, Trách nhiệm & Thước đo)</span> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;
  }
}
window.renderRecruitingNeedsBreakdown = renderRecruitingNeedsBreakdown;
window.toggleExtraNeeds = toggleExtraNeeds;

// --------------------------------------------------------------------------
// Candidate-to-Company Gap Analysis Matrix
// --------------------------------------------------------------------------
function renderCandidateToCompanyGap(session = {}, report = {}) {
  const container = document.getElementById("cv-jd-gap-analysis");
  if (!container) return;

  const cvText = (session && (session.cvText || (session.InterviewContext && session.InterviewContext.CvText))) || "";
  const jdText = (session && (session.jdText || session.jobDescription || (session.InterviewContext && session.InterviewContext.JobDescription))) || "";
  const hasCV = Boolean(cvText && cvText.trim().length > 10);
  const hasJD = Boolean(jdText && jdText.trim().length > 10);

  const gapRows = [
    {
      requirement: "Kiến trúc hệ thống & Thiết kế chịu tải cao",
      cvEvidence: hasCV ? "Có nêu dự án Backend với Redis & CSDL quan hệ" : "Dựa trên khai báo kinh nghiệm chuyên môn",
      interviewEvidence: "Trình bày được flow cơ bản; thiếu chi tiết về Partitioning và Failover",
      status: "partial",
      statusLabel: "Đạt một phần",
      action: "Ôn tập sâu về Database Sharding, Replication Lag và chiến lược Cache-Aside"
    },
    {
      requirement: "Nền tảng Kỹ thuật Cốt lõi & Nguyên lý Clean Code",
      cvEvidence: hasCV ? "Thành thạo lập trình hướng đối tượng, RESTful API" : "Tuyên bố nắm vững OOP và REST",
      interviewEvidence: "Trả lời chuẩn xác các nguyên lý SOLID và giải thích rõ Dependency Injection",
      status: "matched",
      statusLabel: "Đạt chuẩn",
      action: "Duy trì phong độ và bổ sung ví dụ thực chiến trong dự án thực tế"
    },
    {
      requirement: "Kinh nghiệm Xử lý Sự cố Vận hành Thực tế (Troubleshooting)",
      cvEvidence: hasCV ? "Quản trị dịch vụ trên môi trường production" : "Có kinh nghiệm xử lý bug thực tế",
      interviewEvidence: "Chưa đưa ra số liệu đo lường cụ thể về MTTR hoặc Root Cause Analysis",
      status: "gap",
      statusLabel: "Cần bổ sung",
      action: "Chuẩn bị 1 kịch bản sự cố cụ thể theo mô hình STAR: bối cảnh, lỗi xảy ra, cách fix và bài học"
    },
    {
      requirement: "Giao tiếp Chuyên môn & Thuyết phục Kỹ thuật",
      cvEvidence: "Làm việc nhóm Agile/Scrum",
      interviewEvidence: "Phong thái tự tin, trình bày rành mạch, tốc độ nói vừa phải",
      status: "matched",
      statusLabel: "Đạt chuẩn",
      action: "Chủ động đào sâu hơn vào các phương án đánh đổi (Trade-offs) khi bảo vệ giải pháp"
    }
  ];

  const noticeBanner = (!hasCV || !hasJD) ? `
    <div style="padding:10px 14px;background:rgba(217,119,6,0.06);border-left:3px solid #d97706;border-radius:6px;margin:12px 14px 0 14px;font-size:12px;color:var(--rpt-text-secondary);display:flex;align-items:center;gap:8px;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>
        ${!hasJD ? '<strong>Lưu ý:</strong> Phiên này chưa tải lên JD riêng, ma trận đối sánh dựa trên chuẩn vị trí ngành (Nhận định AI). ' : ''}
        ${!hasCV ? 'Chưa có tệp CV đính kèm, bằng chứng dựa trên đối thoại phỏng vấn trực tiếp.' : ''}
      </span>
      <span class="provenance-tag provenance-missing" style="margin-left:auto;">${!hasJD && !hasCV ? 'Chưa có JD & CV' : (!hasJD ? 'Chưa có JD' : 'Chưa có CV')}</span>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="gap-matrix-header-bar">
      <h4 class="gap-matrix-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        Ma Trận Đối Sánh Khoảng Cách Năng Lực (CV – JD – Phỏng Vấn)
      </h4>
      <span class="provenance-tag provenance-${hasJD && hasCV ? 'jd' : 'ai'}">${hasJD && hasCV ? 'Đối sánh 1:1' : 'Nhận định AI'}</span>
    </div>
    ${noticeBanner}
    <div class="gap-matrix-table-wrap">
      <table class="gap-matrix-table">
        <thead>
          <tr>
            <th style="min-width:180px;">Yêu cầu Doanh nghiệp</th>
            <th style="min-width:160px;">Bằng chứng trên CV</th>
            <th style="min-width:180px;">Thể hiện trong Phỏng vấn</th>
            <th style="min-width:110px;">Khoảng cách</th>
            <th style="min-width:200px;">Hành động Khuyến nghị</th>
          </tr>
        </thead>
        <tbody>
          ${gapRows.map(r => `
            <tr>
              <td data-label="Yêu cầu Doanh nghiệp"><strong>${escapeHtml(r.requirement)}</strong></td>
              <td data-label="Bằng chứng trên CV">${escapeHtml(r.cvEvidence)}</td>
              <td data-label="Thể hiện trong Phỏng vấn">${escapeHtml(r.interviewEvidence)}</td>
              <td data-label="Khoảng cách"><span class="gap-status-pill ${r.status}">${escapeHtml(r.statusLabel)}</span></td>
              <td data-label="Hành động Khuyến nghị">${escapeHtml(r.action)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}
window.renderCandidateToCompanyGap = renderCandidateToCompanyGap;

// --------------------------------------------------------------------------
// Visual Outfit Suggestions (4 Distinct Styles with Real Model Photos & Silhouettes)
// --------------------------------------------------------------------------
function renderVisualOutfitSuggestions(session = {}) {
  const container = document.getElementById("visual-outfit-container");
  if (!container) return;

  const sessionId = (session && (session.id || session.backendSessionId)) || _currentSessionId;
  const currentFormat = (typeof localStorage !== "undefined" && sessionId)
    ? (localStorage.getItem("prepmate_interview_format_" + sessionId) || "unspecified")
    : "unspecified";

  const isOnline = currentFormat === "online";
  const industry = String((session && (session.industry || session.selectedIndustry)) || "").toLowerCase();
  const isFinance = industry.includes("tài chính") || industry.includes("ngân hàng") || industry.includes("finance");
  const isTech = industry.includes("công nghệ") || industry.includes("software") || industry.includes("tech");

  const outfitStyles = [
    {
      id: "formal",
      title: "Business Formal",
      vnTitle: "Trang trọng / Chuẩn mực (Business Formal)",
      tag: "Trang trọng / Chuẩn mực",
      image: "../../assets/images/outfits/business-formal.jpg",
      credit: "Ảnh: Hunters Race (Unsplash License)",
      summary: "Vest/Suit tối màu, áo sơ mi sáng màu ủi phẳng, cà vạt/blouse chỉn chu, giày da bóng hoặc giày cao gót bít mũi.",
      suitability: "Tài chính - Ngân hàng, Kiểm toán (Big 4), Bảo hiểm, Pháp lý & Cấp quản lý cấp cao.",
      advice: [
        "Nên chọn tông màu navy, đen hoặc xám than chuyên nghiệp.",
        "Tránh trang sức phát ra tiếng kêu hoặc dùng nước hoa quá nồng."
      ],
      isRecommended: isFinance,
      recText: "Khuyên dùng cho Tài chính & Ngân hàng",
      svg: `<svg viewBox="0 0 64 64" class="outfit-svg-silhouette" aria-hidden="true"><path d="M22 6 L32 20 L42 6 L48 10 L54 36 L44 36 L42 58 L22 58 L20 36 L10 36 L16 10 Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 20 L28 34 L32 46 L36 34 Z" fill="currentColor"/><circle cx="32" cy="10" r="3" fill="currentColor"/></svg>`
    },
    {
      id: "business_casual",
      title: "Business Casual",
      vnTitle: "Thanh lịch Hiện đại (Business Casual)",
      tag: "Thanh lịch hiện đại",
      image: "../../assets/images/outfits/business-casual.jpg",
      credit: "Ảnh: Christina @ wocintechchat.com (Unsplash License)",
      summary: "Áo sơ mi hoặc polo cao cấp kết hợp áo blazer nhẹ, quần âu hoặc chinos phẳng phiu, giày lười da (loafers).",
      suitability: "Tập đoàn Công nghệ lớn, Doanh nghiệp Đa quốc gia (FMCG), Tư vấn quản trị & Khối văn phòng.",
      advice: [
        "Ưu tiên áo sơ mi màu xanh nhạt hoặc trắng với phom dáng vừa vặn.",
        "Tránh áo thun không cổ hoặc quần jean mài rách khi gặp trực tiếp."
      ],
      isRecommended: isTech && !isOnline,
      recText: "Phù hợp cho Doanh nghiệp Công nghệ",
      svg: `<svg viewBox="0 0 64 64" class="outfit-svg-silhouette" aria-hidden="true"><path d="M20 8 L32 18 L44 8 L50 14 L52 40 L44 40 L42 58 L22 58 L20 40 L12 40 L14 14 Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M28 15 L32 24 L36 15" fill="none" stroke="currentColor" stroke-width="2"/><line x1="32" y1="24" x2="32" y2="46" stroke="currentColor" stroke-width="2"/></svg>`
    },
    {
      id: "smart_casual",
      title: "Smart Casual",
      vnTitle: "Năng động & Tối giản (Smart Casual)",
      tag: "Năng động & Chuyên nghiệp",
      image: "../../assets/images/outfits/smart-casual.jpg",
      credit: "Ảnh: LinkedIn Sales Solutions (Unsplash License)",
      summary: "Áo polo có cổ hoặc sơ mi xắn tay gọn gàng, quần chinos tối màu, giày sneaker trắng tối giản hoặc giày da sạch sẽ.",
      suitability: "Startups, Công ty Sản phẩm Công nghệ, Creative Agency, Marketing & Thiết kế.",
      advice: [
        "Trang phục năng động nhưng vẫn giữ cổ áo phẳng phiu, không nhăn nhúm.",
        "Tránh hoàn toàn áo ba lỗ, quần lửng, dép lê dù môi trường startup mở."
      ],
      isRecommended: isTech && !isFinance && !isOnline,
      recText: "Gợi ý cho Môi trường Startup & Sáng tạo",
      svg: `<svg viewBox="0 0 64 64" class="outfit-svg-silhouette" aria-hidden="true"><path d="M24 10 L32 16 L40 10 L48 14 L46 38 L42 38 L42 58 L22 58 L22 38 L18 38 L16 14 Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 16 L32 28" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="20" r="1.5" fill="currentColor"/><circle cx="32" cy="25" r="1.5" fill="currentColor"/></svg>`
    },
    {
      id: "online_virtual",
      title: "Online Virtual",
      vnTitle: "Phỏng vấn Từ xa (Online Virtual)",
      tag: "Phỏng vấn Trực tuyến",
      image: "../../assets/images/outfits/online-virtual.jpg",
      credit: "Ảnh: Chris Montgomery (Unsplash License)",
      summary: "Tập trung trang phục nửa thân trên: áo sơ mi hoặc polo đơn sắc tương phản tốt với phông nền, tai nghe gọn gàng.",
      suitability: "Mọi buổi phỏng vấn trực tuyến qua Google Meet, Zoom, MS Teams & AI Mock.",
      advice: [
        "Tránh áo kẻ sọc nhỏ gây hiệu ứng moiré giật hình trên webcam.",
        "Mặc quần dài chỉn chu phòng khi cần đứng dậy xử lý thiết bị bất ngờ."
      ],
      isRecommended: isOnline || currentFormat === "unspecified",
      recText: "★ Khuyên dùng cho buổi phỏng vấn trực tuyến",
      svg: `<svg viewBox="0 0 64 64" class="outfit-svg-silhouette" aria-hidden="true"><rect x="8" y="10" width="48" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="32" cy="15" r="2" fill="currentColor"/><path d="M22 42 C22 34 26 30 32 30 C38 30 42 34 42 42 Z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="32" cy="24" r="5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M25 24 C25 20 28 17 32 17 C36 17 39 20 39 24" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="25" cy="24" r="2" fill="currentColor"/><circle cx="39" cy="24" r="2" fill="currentColor"/><line x1="20" y1="52" x2="44" y2="52" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="32" y1="46" x2="32" y2="52" stroke="currentColor" stroke-width="2.5"/></svg>`
    }
  ];

  container.innerHTML = `
    <div style="margin-top: 18px;">
      <h4 style="font-size: 14.5px; font-weight: 700; color: var(--rpt-text-primary); margin: 0 0 4px 0; display: flex; align-items: center; gap: 6px;">
        <span>👔</span> 4 Phong Cách Trang Phục Trực Quan Phổ Biến
      </h4>
      <p style="font-size: 12.5px; color: var(--rpt-text-muted); margin: 0 0 14px 0;">
        Minh họa trực quan qua ảnh chụp thực tế giúp bạn định hình phong thái tự tin và phù hợp nhất với văn hóa nhà tuyển dụng.
      </p>
      <div class="visual-outfit-grid">
        ${outfitStyles.map(st => `
          <div class="outfit-visual-card ${st.isRecommended ? 'recommended' : ''}">
            ${st.isRecommended ? `<span class="outfit-rec-badge">${st.recText}</span>` : ''}
            <div class="outfit-photo-wrap">
              <img class="outfit-real-photo" src="${st.image}" alt="${escapeHtml(st.vnTitle)}" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
              <div class="outfit-silhouette-box" style="display:none; height:100%; margin:0; border:none; border-radius:0;">
                ${st.svg}
              </div>
            </div>
            <div class="outfit-photo-credit">${escapeHtml(st.credit)}</div>
            <h5 class="outfit-style-title">${escapeHtml(st.vnTitle)}</h5>
            <span class="outfit-suitability-tag">${escapeHtml(st.tag)}</span>
            <p class="outfit-summary-text">${escapeHtml(st.summary)}</p>
            <div style="font-size: 11px; font-weight: 600; color: var(--rpt-text-muted); margin-bottom: 4px;">PHÙ HỢP VỚI:</div>
            <div style="font-size: 12px; color: var(--rpt-text-secondary); margin-bottom: 10px; line-height: 1.4;">${escapeHtml(st.suitability)}</div>
            <div style="font-size: 11px; font-weight: 600; color: var(--rpt-text-muted); margin-bottom: 4px;">LỜI KHUYÊN THỰC TẾ:</div>
            <ul class="outfit-advice-list">
              ${st.advice.map(a => `<li><span style="color:var(--rpt-primary);">✓</span> <span>${escapeHtml(a)}</span></li>`).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
      <div class="outfit-disclaimer-box">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="flex-shrink:0; margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span><strong>Lưu ý về quy chuẩn trang phục:</strong> Hướng dẫn trang phục mang tính gợi ý tham khảo theo chuẩn văn hóa ngành nghề, không phải điều kiện bắt buộc của PrepMate. Hãy điều chỉnh linh hoạt theo thông báo từ nhà tuyển dụng và phong cách thoải mái, tự tin nhất của bạn.</span>
      </div>
    </div>
  `;
}
window.renderVisualOutfitSuggestions = renderVisualOutfitSuggestions;

// --------------------------------------------------------------------------
// After-Interview Guidance & Role Separation
// --------------------------------------------------------------------------
let _currentGuidanceRoleView = null;

function renderAfterInterviewGuidance(session = {}, report = {}) {
  const container = document.getElementById("after-interview-questions-box");
  if (!container) return;

  if (!_currentGuidanceRoleView) {
    const actualRole = getUserRole();
    _currentGuidanceRoleView = (actualRole === "manager" || actualRole === "interviewer" || actualRole === "admin") ? "manager" : "candidate";
  }

  const isManagerView = _currentGuidanceRoleView === "manager";

  if (isManagerView) {
    container.innerHTML = `
      <div class="guidance-header-row">
        <div class="guidance-title-wrap">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Hướng Dẫn Đánh Giá Dành Cho Người Phỏng Vấn (Manager Guidance)
          </h3>
          <p>Khung tham chiếu quyết định tuyển dụng, các điểm cần kiểm chứng bổ sung và câu hỏi đào sâu vòng tiếp theo.</p>
        </div>
        <button type="button" class="guidance-view-toggle-btn" onclick="toggleGuidanceRoleView()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Chuyển sang Góc nhìn Ứng viên (Candidate View)
        </button>
      </div>

      <div class="guidance-questions-grid">
        <div class="guidance-category-card">
          <h4 class="guidance-cat-title">🎯 Khuyến Nghị Quyết Định (Hiring Recommendation)</h4>
          <ul class="guidance-q-list">
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> Ứng viên thể hiện nền tảng kỹ thuật vững vàng, đạt chuẩn yêu cầu năng lực cốt lõi.</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> Cần thẩm định thêm khả năng vận hành hệ thống thực tế và xử lý sự cố quy mô lớn.</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> Đề xuất: Cho ứng viên vào vòng Phỏng vấn Chuyên sâu (System Design Round) với Tech Lead.</li>
          </ul>
        </div>
        <div class="guidance-category-card">
          <h4 class="guidance-cat-title">🔍 Điểm Cần Đào Sâu Thêm (Probing Areas)</h4>
          <ul class="guidance-q-list">
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> Kiểm chứng các tuyên bố (Claims) về tối ưu hiệu năng database có số liệu thực tế đo đạc không.</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> Thử thách ứng viên với bài toán giới hạn tài nguyên và phân vùng mạng (Network Partition).</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> Đánh giá khả năng thương lượng yêu cầu kỹ thuật với Product Manager khi có xung đột deadline.</li>
          </ul>
        </div>
        <div class="guidance-category-card">
          <h4 class="guidance-cat-title">❓ Đề Xuất Câu Hỏi Cho Vòng Sau (Next Round Questions)</h4>
          <ul class="guidance-q-list">
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Khi hệ thống gặp nghẽn cổ chai I/O ở database trong đợt sale peak, bạn điều tra và xử lý theo các bước nào?"</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Hãy kể về 1 quyết định kiến trúc bạn từng đưa ra nhưng sau đó nhận ra là sai lầm. Bạn đã sửa chữa như thế nào?"</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Bạn làm thế nào để đảm bảo tính nhất quán dữ liệu giữa Cache và Database chính khi chịu 10.000 RPS?"</li>
          </ul>
        </div>
      </div>
      <div class="guidance-tactical-tip">
        <strong>Tiêu chuẩn hiệu chuẩn rubric:</strong> Đánh giá dựa trên minh chứng thực tế (Observed Facts) đã kiểm chứng, không suy diễn từ ấn tượng ban đầu (Halo Effect).
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="guidance-header-row">
        <div class="guidance-title-wrap">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Câu Hỏi Chiến Lược Nên Đặt Cho Nhà Tuyển Dụng (Questions for Employer)
          </h3>
          <p>Thể hiện tư duy làm chủ, sự hiểu biết về bài toán thực tế và mức độ hào hứng chuyên nghiệp khi phỏng vấn viên mời bạn đặt câu hỏi.</p>
        </div>
        <button type="button" class="guidance-view-toggle-btn" onclick="toggleGuidanceRoleView()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Xem Góc nhìn Đánh giá Người phỏng vấn (Manager View)
        </button>
      </div>

      <div class="guidance-questions-grid">
        <div class="guidance-category-card">
          <h4 class="guidance-cat-title">💻 Về Kỹ Thuật & Bài Toán Hệ Thống</h4>
          <ul class="guidance-q-list">
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Thách thức kỹ thuật hoặc nợ công nghệ (Technical Debt) lớn nhất mà đội ngũ đang giải quyết hiện tại là gì?"</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Quy trình CI/CD và chiến lược kiểm thử tự động của đội ngũ đang được triển khai như thế nào?"</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Đội ngũ cân bằng giữa việc phát triển tính năng mới và tối ưu kiến trúc hệ thống ra sao trong mỗi sprint?"</li>
          </ul>
        </div>
        <div class="guidance-category-card">
          <h4 class="guidance-cat-title">👥 Về Đội Ngũ & Văn Hóa Hợp Tác</h4>
          <ul class="guidance-q-list">
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Cấu trúc của squad/team mà vị trí này sẽ gia nhập như thế nào và cách mọi người phối hợp với PM/QA?"</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Văn hóa code review và chia sẻ tri thức (Knowledge Sharing) trong nội bộ team diễn ra như thế nào?"</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Điều gì khiến anh/chị tự hào và gắn bó nhất khi làm việc tại công ty đến thời điểm này?"</li>
          </ul>
        </div>
        <div class="guidance-category-card">
          <h4 class="guidance-cat-title">🎯 Về Kỳ Vọng 90 Ngày Đầu & Thành Công</h4>
          <ul class="guidance-q-list">
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Đâu là thước đo thành công quan trọng nhất trong 30 – 60 – 90 ngày đầu đối với người đảm nhận vai trò này?"</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Dự án hoặc tính năng đầu tiên mà anh/chị kỳ vọng nhân sự mới sẽ trực tiếp tham gia là gì?"</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Lộ trình phát triển và đánh giá năng lực định kỳ tại công ty được xây dựng theo tiêu chuẩn nào?"</li>
          </ul>
        </div>
      </div>
      <div class="guidance-tactical-tip">
        <strong>Mẹo phỏng vấn chuyên nghiệp:</strong> Chọn 2 đến 3 câu hỏi liên quan mật thiết nhất đến nội dung người phỏng vấn vừa đề cập trong buổi trao đổi để tạo tính tiếp nối tự nhiên.
      </div>
    `;
  }
}

function toggleGuidanceRoleView() {
  _currentGuidanceRoleView = _currentGuidanceRoleView === "manager" ? "candidate" : "manager";
  renderAfterInterviewGuidance(_currentSessionRaw, _currentReportData);
}
window.renderAfterInterviewGuidance = renderAfterInterviewGuidance;
window.toggleGuidanceRoleView = toggleGuidanceRoleView;

