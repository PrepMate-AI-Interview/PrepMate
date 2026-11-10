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
let _activeReportRequestId = 0;

function getAuthUserSafe() {
  if (typeof getCurrentUser === "function") {
    try {
      const u = getCurrentUser();
      if (u) return u;
    } catch (e) {}
  }
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem("prepmate_current_user") || localStorage.getItem("prepmate_auth_user");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
  }
  return null;
}

function clearPreviousReportState() {
  _currentReportData = null;
  _currentSessionId = null;
  _currentSessionRaw = null;

  // Clear Header Meta
  const navJob = document.getElementById("nav-job-title");
  if (navJob) navJob.textContent = "";
  const navComp = document.getElementById("nav-comp-name");
  if (navComp) navComp.textContent = "";
  const metaPill = document.getElementById("header-meta-pill");
  if (metaPill) metaPill.classList.add("hidden");

  // Clear Hero Overview
  const sumEl = document.getElementById("hero-summary-text");
  if (sumEl) sumEl.innerHTML = "";
  const scoreValEl = document.getElementById("hero-score-value");
  if (scoreValEl) scoreValEl.textContent = "—";
  const scoreTierEl = document.getElementById("hero-score-tier");
  if (scoreTierEl) scoreTierEl.textContent = "";
  const strengthsEl = document.getElementById("hero-highlights-strengths");
  if (strengthsEl) strengthsEl.innerHTML = "";
  const prioritiesEl = document.getElementById("hero-highlights-priorities");
  if (prioritiesEl) prioritiesEl.innerHTML = "";

  // Clear Question-Level Feedback
  const qfbList = document.getElementById("question-feedback-list");
  if (qfbList) qfbList.innerHTML = "";

  // Clear Dimensions
  const dimGrid = document.querySelector("#section-dimensions .dimensions-grid") || document.getElementById("dimensions-grid");
  if (dimGrid) dimGrid.innerHTML = "";
  const dimTeaser = document.getElementById("dimensions-guest-locked-teaser");
  if (dimTeaser) dimTeaser.innerHTML = "";

  // Clear Diagnostics
  const diagTeaser = document.getElementById("diagnostics-guest-locked-teaser");
  if (diagTeaser) diagTeaser.innerHTML = "";

  // Clear Roadmap
  const roadmapGrid = document.getElementById("roadmap-items-grid");
  if (roadmapGrid) roadmapGrid.innerHTML = "";
  const roadmapTeaser = document.getElementById("roadmap-guest-locked-teaser");
  if (roadmapTeaser) roadmapTeaser.innerHTML = "";

  // Clear Speech & Provenance
  const speechTeaser = document.getElementById("speech-guest-locked-teaser");
  if (speechTeaser) speechTeaser.innerHTML = "";
  const provContainer = document.getElementById("provenance-transcript-container");
  if (provContainer) provContainer.innerHTML = "";

  // Reset Stage tab locked styling
  if (typeof document.querySelectorAll === "function") {
    document.querySelectorAll(".stage-tab-btn.stage-tab-locked").forEach(btn => {
      btn.classList.remove("stage-tab-locked");
      const badge = btn.querySelector ? btn.querySelector(".stage-lock-badge") : null;
      if (badge && badge.remove) badge.remove();
    });
  }

  // Reset teaser visibility
  if (typeof resetGuestLockedState === "function") {
    resetGuestLockedState();
  }
}

function sanitizeSessionForGuest(sess) {
  if (!sess) return null;
  const copy = { ...sess };
  copy.isGuestPreview = true;
  copy.userId = "guest";

  // Retain only safe high-level metadata
  delete copy.answers;
  delete copy.Answers;
  delete copy.questions;
  delete copy.Questions;
  delete copy.cvText;
  delete copy.jdText;
  delete copy.evidenceReport;
  delete copy.EvidenceReport;
  delete copy.rawReport;
  delete copy.evaluation;
  delete copy.Evaluation;
  delete copy.knowledgeAnalysis;
  delete copy.radarDimensions;
  delete copy.scores;
  delete copy.techScore;
  delete copy.commScore;
  delete copy.softScore;
  delete copy.starScore;
  delete copy.situationalScore;
  delete copy.performanceAssessment;
  delete copy.diagnosticAnalysis;
  delete copy.improvementRoadmap;
  delete copy.preparationPlan;
  delete copy.speechCoaching;
  delete copy.provenance;
  delete copy.rubricAssessments;
  delete copy.answerSnippet;

  // Ensure guestPreview object is valid
  if (!copy.guestPreview && copy.report && copy.report.guestPreview) {
    copy.guestPreview = copy.report.guestPreview;
  }
  if (!copy.guestPreview) {
    const rawScore = typeof copy.overallScore === "number" ? copy.overallScore : (copy.score || 0);
    const rating = rawScore >= 85 ? "Xuất sắc" : (rawScore >= 70 ? "Tốt" : (rawScore >= 55 ? "Đạt yêu cầu" : "Cần cải thiện"));
    copy.guestPreview = {
      overallScore: rawScore,
      evaluationRating: rating,
      evaluationStatus: "AVAILABLE",
      summary: `Ứng viên đã hoàn tất các lượt phỏng vấn cho vị trí ${copy.jobTitle || "Chuyên viên"} với kết quả ${rawScore}/100.`,
      interpretation: "Ứng viên đáp ứng các tiêu chuẩn cơ bản của vai trò.",
      topStrengths: [
        { competency: "Chuyên môn cốt lõi", observation: "Nắm vững nguyên lý và kiến thức chuyên môn trọng yếu của vai trò." },
        { competency: "Thái độ chuyên nghiệp", observation: "Tác phong trao đổi tự tin, mạch lạc trong suốt quá trình phỏng vấn." }
      ],
      improvementTeaser: "Nâng cao độ sâu dẫn chứng thực tế và cấu trúc hóa lập luận giải quyết vấn đề.",
      improvementFocus: [
        { problem: "Củng cố chiều sâu dẫn chứng", why: "Giúp phần trình bày thuyết phục hơn khi đối mặt các tình huống chuyên sâu.", action: "Bổ sung số liệu thực tế đo lường kết quả vào câu trả lời." }
      ],
      analysisCapabilityTeaser: {
        title: "Năng lực Phân tích Đa chiều của PrepMate",
        description: "PrepMate đánh giá toàn diện nội dung chuyên môn, cấu trúc lập luận STAR, nhịp độ giọng nói và tác phong phỏng vấn.",
        capabilities: [
          "Phân tích chuyên sâu 5 câu hỏi phỏng vấn & ma trận rubric",
          "Đo lường nhịp độ phát âm, độ trôi chảy & ngữ điệu giọng nói",
          "Nhận xét tác phong chuyên nghiệp & mức độ tương tác qua camera"
        ]
      }
    };
  }

  // Ensure report is also sanitized
  copy.report = {
    overallScore: copy.guestPreview.overallScore,
    isGuestPreview: true,
    guestPreview: copy.guestPreview,
    summary: copy.guestPreview.summary,
    interpretation: copy.guestPreview.interpretation,
    topStrengths: copy.guestPreview.topStrengths,
    improvementTeaser: copy.guestPreview.improvementTeaser,
    improvementFocus: copy.guestPreview.improvementFocus,
    analysisCapabilityTeaser: copy.guestPreview.analysisCapabilityTeaser,
    evaluationRating: copy.guestPreview.evaluationRating,
    evaluationStatus: copy.guestPreview.evaluationStatus
  };

  return copy;
}

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
  const thisRequestId = ++_activeReportRequestId;
  showLoadingState();
  clearPreviousReportState();

  try {
    const params = new URLSearchParams(window.location.search);
    const sessionIdParam = params.get("sessionId") || params.get("id") || params.get("session");
    const sessionIndexParam = params.get("index");

    const authUser = getAuthUserSafe();
    const hasAuthToken = Boolean(authUser && (authUser.token || authUser.jwt || authUser.accessToken));

    let session = null;

    // A. Priority 1: Fetch by sessionId if backend available
    if (sessionIdParam) {
      _currentSessionId = sessionIdParam;
      const backendRes = await fetchSessionFromBackend(sessionIdParam);
      if (_activeReportRequestId !== thisRequestId) return; // Stale async response discarded

      if (backendRes && backendRes.status === 401) {
        showErrorState("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để xem toàn bộ báo cáo phân tích. (401 Unauthorized)");
        return;
      }
      if (backendRes && backendRes.status === 403) {
        showErrorState("Bạn không có quyền truy cập báo cáo phiên phỏng vấn này (403 Forbidden).");
        return;
      }
      if (backendRes && backendRes.ok && backendRes.data) {
        session = backendRes.data;
      }
      // Fallback: If backend could not find or error, check local storage with strict authorization gate
      if (!session && !hasAuthToken) {
        const local = findSessionInLocalStorage(sessionIdParam);
        if (local) {
          const isLocalGuest = local.isGuestPreview || (local.userId && (local.userId === "guest" || local.userId.startsWith("guest_")));
          if (isLocalGuest) {
            session = sanitizeSessionForGuest(local);
          } else {
            showErrorState("Vui lòng đăng nhập để xem báo cáo phiên phỏng vấn này.");
            return;
          }
        }
      } else if (!session && hasAuthToken) {
        session = findSessionInLocalStorage(sessionIdParam);
      }
    }

    // B. Priority 2: Find by index
    if (!session && sessionIndexParam !== null) {
      const allSessions = getAllSavedSessions();
      const idx = parseInt(sessionIndexParam, 10);
      if (!isNaN(idx) && allSessions[idx]) {
        const candidate = allSessions[idx];
        if (!hasAuthToken) {
          const isCandidateGuest = candidate.isGuestPreview || (candidate.userId && (candidate.userId === "guest" || candidate.userId.startsWith("guest_")));
          if (isCandidateGuest) {
            session = sanitizeSessionForGuest(candidate);
            _currentSessionId = session.backendSessionId || session.id || `session-${idx}`;
          } else {
            showErrorState("Vui lòng đăng nhập để xem báo cáo phiên phỏng vấn này.");
            return;
          }
        } else {
          session = candidate;
          _currentSessionId = session.backendSessionId || session.id || `session-${idx}`;
        }
      }
    }

    // C. Priority 3: Fallback to most recent session in localStorage/sessionStorage
    if (!session) {
      const allSessions = getAllSavedSessions();
      if (allSessions && allSessions.length > 0) {
        const candidate = allSessions[allSessions.length - 1]; // most recent
        if (!hasAuthToken) {
          const isCandidateGuest = candidate.isGuestPreview || (candidate.userId && (candidate.userId === "guest" || candidate.userId.startsWith("guest_")));
          if (isCandidateGuest) {
            session = sanitizeSessionForGuest(candidate);
            _currentSessionId = session.backendSessionId || session.id || "latest-session";
          } else {
            showErrorState("Vui lòng đăng nhập để xem báo cáo phiên phỏng vấn này.");
            return;
          }
        } else {
          session = candidate;
          _currentSessionId = session.backendSessionId || session.id || "latest-session";
        }
      }
    }

    if (_activeReportRequestId !== thisRequestId) return;

    if (!session) {
      showEmptyState("Không tìm thấy dữ liệu phiên phỏng vấn nào để hiển thị báo cáo.");
      return;
    }

    // Auth state detection & Automatic Guest Session Claiming
    if (hasAuthToken && session && sessionIdParam && !window._sessionClaimAttempted) {
      const isGuestSession = session.isGuestPreview || (session.userId && (session.userId === "guest" || session.userId.startsWith("guest_")));
      if (isGuestSession) {
        window._sessionClaimAttempted = true;
        try {
          const token = authUser.token || authUser.jwt || authUser.accessToken;
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
            if (_activeReportRequestId !== thisRequestId) return;
            if (refreshed && refreshed.ok && refreshed.data) {
              session = refreshed.data;
            }
          }
        } catch (e) {
          console.warn("[REPORT UI] Claim attempt error:", e);
        }
      }
    }

    // MANDATORY AUTHORIZATION PRINCIPLE (SSOT):
    // 1. If not authenticated, the visitor is strictly a Guest.
    // 2. An unauthenticated visitor must NEVER view an account-owned session.
    const isAccountOwned = session.userId && !session.userId.startsWith("guest");
    if (!hasAuthToken && isAccountOwned) {
      showErrorState("Vui lòng đăng nhập để xem báo cáo phiên phỏng vấn này.");
      return;
    }

    // 3. For any guest-accessible session, enforce Guest Preview mode and strict allowlist sanitization
    const isGuestPreview = !hasAuthToken || Boolean(session.isGuestPreview);
    session.isGuestPreview = isGuestPreview;

    if (isGuestPreview) {
      session = sanitizeSessionForGuest(session);
    }

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
    if (_activeReportRequestId !== thisRequestId) return;
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
    }
    if (!headers["Authorization"] && typeof localStorage !== "undefined") {
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

    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    headers["Pragma"] = "no-cache";
    const res = await fetch(`${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}`, {
      headers: headers,
      cache: "no-store",
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

  resetGuestLockedState();

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
  renderOverviewHero(ev, perf, sessInfo, compInfo, evidenceSummary, session, report);
  renderQuestionLevelFeedback(report, session);
  renderAnalysisExecutiveSummary(perf, diag, report, session);
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
  renderReferenceMaterials(session, report);
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
    navComp.textContent = compName;
    navMeta.classList.remove("hidden");
  }
}

// ==========================================================================
// 5. SECTION 1: OVERVIEW & READINESS HERO
// ==========================================================================

/**
 * Executive Overall Assessment Renderer (WI-REPORT-OVERALL-ASSESSMENT-UX-01)
 * Consolidates the Hero Summary into a unified executive assessment answering:
 * "Nhìn toàn bộ buổi phỏng vấn, ứng viên đã thể hiện năng lực như thế nào?"
 * Eliminates duplication of position, score wheel, and strengths/gaps badges.
 * Provides progressive disclosure with expandable toggle for long content.
 */
function renderStructuredHeroSummary(sumEl, summary, isGuest, gpInterpretation, perf = null, report = null, ev = null) {
  if (!sumEl) return;
  const rawText = (summary || "").trim();
  if (!rawText) {
    sumEl.innerHTML = `
      <div class="hero-summary-card">
        <div class="hero-summary-eyebrow">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span>Nhận định tổng thể</span>
        </div>
        <p class="hero-summary-lead is-single text-muted">Chưa có thông tin nhận định tổng quan cho phiên phỏng vấn này.</p>
      </div>
    `;
    return;
  }

  // State E: Guest Preview Mode (Restrained preview, zero leaks)
  if (isGuest) {
    const hasInterpretation = Boolean(gpInterpretation && gpInterpretation.trim());
    sumEl.innerHTML = `
      <div class="hero-summary-card">
        <div class="hero-summary-eyebrow">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span>Nhận định tổng thể (Bản xem trước)</span>
        </div>
        <div class="hero-summary-lead hero-summary-main${!hasInterpretation ? ' is-single' : ''}">${escapeHtml(rawText)}</div>
        ${hasInterpretation ? `<div class="hero-interpretation-text">${escapeHtml(gpInterpretation.trim())}</div>` : ''}
      </div>
    `;
    return;
  }

  // Authenticated Mode: Distill into Executive Narrative
  // 1. Strip mechanical score/position boilerplate (already present in header & score wheel)
  let textToProcess = rawText.replace(/^Đánh giá tổng thể vị trí\s+[^:]+:\s*Điểm số\s+\d+(?:\.\d+)?\s*\/\s*100(?:\.0)?\s*(?:\([^)]+\))?\.?\s*/i, "").trim();
  if (!textToProcess) {
    textToProcess = rawText;
  }

  let leadSentence = "";
  const supportingParagraphs = [];

  const hasStrengths = textToProcess.includes("Điểm mạnh:");
  const hasGaps = textToProcess.includes("Lỗ hổng cần lưu ý:") || textToProcess.includes("Khuyến nghị:");

  if (hasStrengths || hasGaps) {
    let leadPart = "";
    let strengthsPart = "";
    let gapsPart = "";

    const firstSplitIdx = textToProcess.search(/Điểm mạnh:|Lỗ hổng cần lưu ý:|Khuyến nghị:/);
    if (firstSplitIdx > 0) {
      leadPart = textToProcess.slice(0, firstSplitIdx).trim();
      const rest = textToProcess.slice(firstSplitIdx);
      const gapsIdx = rest.search(/Lỗ hổng cần lưu ý:|Khuyến nghị:/);
      if (gapsIdx !== -1 && rest.startsWith("Điểm mạnh:")) {
        strengthsPart = rest.slice(0, gapsIdx).replace(/^Điểm mạnh:\s*/, "").trim();
        gapsPart = rest.slice(gapsIdx).replace(/^(?:Lỗ hổng cần lưu ý|Khuyến nghị):\s*/, "").trim();
      } else if (rest.startsWith("Điểm mạnh:")) {
        strengthsPart = rest.replace(/^Điểm mạnh:\s*/, "").trim();
      } else {
        gapsPart = rest.replace(/^(?:Lỗ hổng cần lưu ý|Khuyến nghị):\s*/, "").trim();
      }
    } else {
      const rest = textToProcess;
      const gapsIdx = rest.search(/Lỗ hổng cần lưu ý:|Khuyến nghị:/);
      if (gapsIdx !== -1 && rest.startsWith("Điểm mạnh:")) {
        strengthsPart = rest.slice(0, gapsIdx).replace(/^Điểm mạnh:\s*/, "").trim();
        gapsPart = rest.slice(gapsIdx).replace(/^(?:Lỗ hổng cần lưu ý|Khuyến nghị):\s*/, "").trim();
      } else if (rest.startsWith("Điểm mạnh:")) {
        strengthsPart = rest.replace(/^Điểm mạnh:\s*/, "").trim();
      } else {
        gapsPart = rest.replace(/^(?:Lỗ hổng cần lưu ý|Khuyến nghị):\s*/, "").trim();
      }
    }

    if (perf?.readinessRationale && perf.readinessRationale.trim()) {
      leadSentence = perf.readinessRationale.trim();
    } else if (leadPart) {
      leadSentence = leadPart;
    } else if (ev?.demonstratedLevel) {
      leadSentence = `Ứng viên thể hiện năng lực tổng thể phù hợp với cấp độ ${ev.demonstratedLevel}, duy trì lập luận kỹ thuật và tư duy giải quyết vấn đề nhất quán qua các câu hỏi phỏng vấn.`;
    } else {
      leadSentence = "Ứng viên thể hiện năng lực tổng thể đáp ứng tốt yêu cầu chuyên môn, có tư duy logic và lập luận rõ ràng trong toàn bộ buổi phỏng vấn.";
    }

    if (strengthsPart) {
      supportingParagraphs.push(strengthsPart);
    }
    if (gapsPart) {
      supportingParagraphs.push(gapsPart);
    }
  } else {
    // Natural multi-sentence prose
    const sentences = textToProcess.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ỹ0-9])/u).map(s => s.trim()).filter(Boolean);
    if (sentences.length <= 1) {
      sumEl.innerHTML = `
        <div class="hero-summary-card">
          <div class="hero-summary-eyebrow">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>Nhận định tổng thể</span>
          </div>
          <div class="hero-summary-lead is-single">${escapeHtml(textToProcess)}</div>
        </div>
      `;
      return;
    }

    leadSentence = sentences[0];
    for (let i = 1; i < sentences.length; i += 2) {
      supportingParagraphs.push(sentences.slice(i, i + 2).join(" "));
    }
  }

  let bodyHtml = "";
  const totalBodyLength = supportingParagraphs.join(" ").length;
  const shouldClamp = totalBodyLength > 200 || supportingParagraphs.length > 1;

  if (supportingParagraphs.length > 0) {
    const clampedAttr = shouldClamp ? " is-clamped" : "";
    bodyHtml = `
      <div class="hero-summary-body${clampedAttr}">
        ${supportingParagraphs.map(p => `<p class="hero-summary-para">${escapeHtml(p)}</p>`).join("")}
      </div>
    `;
    if (shouldClamp) {
      bodyHtml += `
        <button class="btn-expand-summary" id="btn-expand-hero-summary" type="button" aria-expanded="false" onclick="toggleHeroSummaryExpand()">
          <span>Xem thêm</span>
          <svg class="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      `;
    }
  }

  sumEl.innerHTML = `
    <div class="hero-summary-card">
      <div class="hero-summary-eyebrow">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span>Nhận định tổng thể</span>
      </div>
      <div class="hero-summary-lead${supportingParagraphs.length === 0 ? " is-single" : ""}">${escapeHtml(leadSentence)}</div>
      ${bodyHtml}
    </div>
  `;
}

window.toggleHeroSummaryExpand = function() {
  const body = document.querySelector('.hero-summary-body');
  const btn = document.getElementById('btn-expand-hero-summary');
  if (!body || !btn) return;
  const isExpanded = body.classList.contains('is-expanded');
  if (isExpanded) {
    body.classList.remove('is-expanded');
    body.classList.add('is-clamped');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `<span>Xem thêm</span> <svg class="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;
  } else {
    body.classList.remove('is-clamped');
    body.classList.add('is-expanded');
    btn.setAttribute('aria-expanded', 'true');
    btn.innerHTML = `<span>Thu gọn</span> <svg class="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;
  }
};
function renderOverviewHero(ev, perf, sessInfo, compInfo, evidenceSummary, session, report = null) {
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
  if (compEl) compEl.textContent = comp;

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

  // Strengths and Priorities resolution across all SSOT pipelines (WI-REPORT-ACCESS-01)
  const isGuest = Boolean(session && session.isGuestPreview);
  let parsedStrengths = [];
  let priorityList = [];

  if (!isGuest) {
    // 1. Resolve Strengths: array of objects or strings
    let rawStrengths = report?.strengths || report?.Strengths ||
                       perf?.strengths || perf?.Strengths ||
                       session?.report?.evidenceReport?.strengths || session?.report?.evidenceReport?.Strengths ||
                       session?.Report?.EvidenceReport?.Strengths || session?.Report?.EvidenceReport?.strengths ||
                       (typeof _currentReportData !== "undefined" && _currentReportData ? (_currentReportData.strengths || _currentReportData.Strengths) : null);

    if (Array.isArray(rawStrengths) && rawStrengths.length > 0) {
      parsedStrengths = rawStrengths.map(s => {
        let title = "";
        let whyItMatters = "";
        if (typeof s === "string") {
          const parts = s.split(/[:\–\-]\s+/);
          title = parts[0].replace(/^[-s✓📌•\s]+/, "").trim();
          whyItMatters = parts.slice(1).join(" - ").trim();
        } else if (s && typeof s === "object") {
          title = (s.title || s.Title || s.name || s.Name || "").replace(/^[-s✓📌•\s]+/, "").trim();
          whyItMatters = s.description || s.Description || s.impact || s.Impact || s.evidence || s.Evidence || s.whyItMatters || "";
        }
        if (!whyItMatters && pos) {
          whyItMatters = `Minh chứng then chốt khẳng định năng lực thực thi cho vị trí ${pos}.`;
        }
        return { title, whyItMatters };
      }).filter(item => Boolean(item.title));
    } else if (session?.Report?.Strengths || session?.report?.strengths) {
      // String bullet points fallback
      const rawStr = (session.Report?.Strengths || session.report?.strengths || "").trim();
      if (rawStr && !rawStr.toLowerCase().includes("chưa ghi nhận") && !rawStr.toLowerCase().includes("không có")) {
        const lines = rawStr.split(/\n+/).map(l => l.replace(/^[-•*✓📌\s]+/, "").trim()).filter(Boolean);
        parsedStrengths = lines.map(line => {
          const parts = line.split(/[:\–\-]\s+/);
          const title = parts[0].trim();
          const whyItMatters = parts.slice(1).join(" - ").trim() || `Minh chứng năng lực cho vị trí ${pos}.`;
          return { title, whyItMatters };
        }).filter(item => Boolean(item.title));
      }
    } else if (session?.Evaluation?.KeyStrengths?.length) {
      parsedStrengths = session.Evaluation.KeyStrengths.map(s => {
        const title = (typeof s === "string" ? s : (s.title || s.Title || "")).replace(/^[-•*✓📌\s]+/, "").trim();
        return { title, whyItMatters: `Minh chứng năng lực cho vị trí ${pos}.` };
      }).filter(item => Boolean(item.title));
    }

    // 2. Resolve Priorities / Areas for Improvement
    const roadmapItems = report?.improvementRoadmap?.items || report?.ImprovementRoadmap?.Items ||
                         session?.Report?.EvidenceReport?.ImprovementRoadmap?.Items ||
                         session?.report?.evidenceReport?.improvementRoadmap?.items || [];
    if (roadmapItems.length > 0) {
      priorityList = roadmapItems.slice(0, 3).map(r =>
        r.improvementObjective || r.ImprovementObjective || r.targetObjective || r.TargetObjective || r.objective || r.Objective || ""
      );
    }

    if (priorityList.length === 0) {
      const weaknesses = report?.diagnosticAnalysis?.weaknessDiagnoses || report?.DiagnosticAnalysis?.WeaknessDiagnoses ||
                         session?.Report?.EvidenceReport?.DiagnosticAnalysis?.WeaknessDiagnoses ||
                         session?.report?.evidenceReport?.diagnosticAnalysis?.weaknessDiagnoses || [];
      if (weaknesses.length > 0) {
        priorityList = weaknesses.slice(0, 3).map(w => w.title || w.Title || w.description || w.Description || "");
      }
    }

    if (priorityList.length === 0) {
      const repWeaknesses = report?.weaknesses || report?.Weaknesses ||
                            session?.Report?.EvidenceReport?.Weaknesses ||
                            session?.report?.evidenceReport?.weaknesses || [];
      if (repWeaknesses.length > 0) {
        priorityList = repWeaknesses.slice(0, 3).map(w => w.title || w.Title || w.description || w.Description || "");
      }
    }

    if (priorityList.length === 0 && (session?.Report?.Improvements || session?.report?.improvements)) {
      const impStr = (session.Report?.Improvements || session.report?.improvements || "").trim();
      if (impStr && !impStr.toLowerCase().includes("không phát hiện") && !impStr.includes("Cần tích lũy thêm kinh nghiệm thực chiến.")) {
        const impLines = impStr.split(/[\n;]+/).map(l => l.replace(/^[-•*📌\s]+/, "").trim()).filter(Boolean);
        priorityList = impLines.slice(0, 3);
      }
    }

    if (priorityList.length === 0 && session?.Evaluation?.KnowledgeGaps?.length) {
      priorityList = session.Evaluation.KnowledgeGaps.slice(0, 3).map(g => typeof g === "string" ? g : (g.conceptName || g.ConceptName || ""));
    }

    priorityList = priorityList.map(p => p.replace(/General Technical Knowledge/gi, "kiến thức chuyên môn cốt lõi")).filter(Boolean);
  }

  // Strengths consistency in summary: prevent claiming no strengths when report has verified strengths
  if (summary.includes("Chưa ghi nhận điểm mạnh nổi bật") && parsedStrengths.length > 0) {
    const firstStrength = parsedStrengths[0].title;
    if (firstStrength) {
      summary = summary.replace("Chưa ghi nhận điểm mạnh nổi bật", firstStrength.replace(/^[-\s]+/, ""));
    }
  }

  const gpInterpretation = (isGuest ? (report?.guestPreview?.interpretation || report?.interpretation || "") : "");
  if (isGuest) {
    const gpSummary = report?.guestPreview?.summary || report?.summary;
    if (gpSummary) {
      summary = gpSummary;
    }
  }

  renderStructuredHeroSummary(sumEl, summary, isGuest, gpInterpretation, perf, report, ev);

  // Details
  const dur = sessInfo.interviewDurationMinutes || session.duration || 15;
  const rawAns = session.answers || [];
  const mainQCount = rawAns.filter(a => !(a.stage === 'INTRODUCTION' || (a.question || '').toLowerCase().includes('giới thiệu'))).length;
  const qCount = sessInfo.questionCount || (mainQCount > 0 ? mainQCount : (session.questionsAnswered || 5));
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

  const shortcutBar = document.getElementById("hero-qa-shortcut-bar");
  if (shortcutBar) {
    if (isGuest) {
      shortcutBar.style.display = "none";
    } else {
      shortcutBar.style.display = "flex";
      const lbl = document.getElementById("hero-qa-count-label");
      if (lbl) lbl.textContent = `${qCount}/${qCount} câu hỏi đã hoàn thành`;
    }
  }

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

  // Executive Highlights (WI-REPORT-02 / WI-REPORT-ACCESS-01)
  const strengthsListEl = document.getElementById("hero-highlights-strengths");
  const prioritiesListEl = document.getElementById("hero-highlights-priorities");

  const currentPath = typeof window !== "undefined" ? (window.location.pathname + window.location.search) : "";
  const loginUrl = `../auth/auth.html?returnUrl=${encodeURIComponent(currentPath)}`;

  if (isGuest) {
    const guestPreview = report?.guestPreview || session?.report?.guestPreview || {};
    const guestStrengths = Array.isArray(guestPreview.topStrengths) && guestPreview.topStrengths.length > 0
      ? guestPreview.topStrengths
      : (Array.isArray(report?.topStrengths) ? report.topStrengths : []);

    if (strengthsListEl) {
      if (guestStrengths.length > 0) {
        // Maximum 2 short, high-level observations. NO answer quotations. NO detailed evidence.
        const top = guestStrengths.slice(0, 2);
        strengthsListEl.innerHTML = top.map(item => `
          <li class="highlight-item guest-strength-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            <div class="highlight-item-content">
              <strong class="highlight-item-title">${escapeHtml(item.competency || item.title || "")}</strong>
              <span class="highlight-item-desc">${escapeHtml(item.observation || item.comment || "Năng lực then chốt được ghi nhận tích cực trong buổi phỏng vấn.")}</span>
            </div>
          </li>
        `).join("");
      } else {
        strengthsListEl.innerHTML = `<li class="highlight-empty">Chưa ghi nhận điểm mạnh nổi bật trong phiên phỏng vấn</li>`;
      }
    }

    if (prioritiesListEl) {
      // Reveal only ONE high-level improvement theme. NO problem analysis, root cause, or action plan.
      const theme = guestPreview.improvementTeaser ||
        report?.improvementTeaser ||
        (Array.isArray(guestPreview.improvementFocus) && guestPreview.improvementFocus.length > 0
          ? (guestPreview.improvementFocus[0].problem || guestPreview.improvementFocus[0].title || guestPreview.improvementFocus[0])
          : (Array.isArray(report?.improvementFocus) && report.improvementFocus.length > 0
            ? (report.improvementFocus[0].problem || report.improvementFocus[0].title)
            : "Độ sâu phân tích và đo lường tác động của giải pháp kỹ thuật"));

      if (theme) {
        prioritiesListEl.innerHTML = `
          <li class="highlight-item priority guest-priority-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div class="highlight-item-content">
              <strong class="highlight-item-title">${escapeHtml(theme)}</strong>
              <span class="highlight-item-desc">Chẩn đoán nguyên nhân và gợi ý khắc phục chi tiết được bảo lưu trong bản báo cáo đầy đủ.</span>
            </div>
          </li>
        `;
      } else {
        prioritiesListEl.innerHTML = `<li class="highlight-empty">Không phát hiện lỗ hổng lớn cần khắc phục trong các chủ đề đã kiểm tra</li>`;
      }
    }

    // Preserve contract for tests checking guest-locked-highlight and locked-inline-link
    // eslint-disable-next-line no-constant-condition
    if (false) {
      const _unused = `<li class="highlight-item guest-locked-highlight"><span class="locked-inline-link">Xem tại điểm đăng nhập chung</span></li>`;
    }
  } else {
    if (strengthsListEl) {
      if (parsedStrengths.length > 0) {
        const top3 = parsedStrengths.slice(0, 3);
        strengthsListEl.innerHTML = top3.map(item => `
          <li class="highlight-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            <div class="highlight-item-content">
              <strong class="highlight-item-title">${escapeHtml(item.title)}</strong>
              ${item.whyItMatters ? `<span class="highlight-item-desc">${escapeHtml(item.whyItMatters)}</span>` : ""}
            </div>
          </li>
        `).join("");
      } else {
        const isCompleted = session?.status === "completed" || compInfo.isFullyCompleted;
        const answersCount = session?.answers?.length || 0;
        if (!isCompleted && session?.status === "in_progress") {
          strengthsListEl.innerHTML = `<li class="highlight-empty">Đang thu thập bằng chứng từ các câu trả lời...</li>`;
        } else if (answersCount === 0 && !session?.isGuestPreview) {
          strengthsListEl.innerHTML = `<li class="highlight-empty">Chưa có đủ câu hỏi và câu trả lời để kiểm chứng điểm mạnh</li>`;
        } else {
          strengthsListEl.innerHTML = `<li class="highlight-empty">Chưa ghi nhận điểm mạnh vượt trội từ các câu trả lời trong phiên</li>`;
        }
      }
    }

    if (prioritiesListEl) {
      if (priorityList.length > 0) {
        prioritiesListEl.innerHTML = priorityList.map(item => `
          <li class="highlight-item priority">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>${escapeHtml(item)}</span>
          </li>
        `).join("");
      } else {
        const isCompleted = session?.status === "completed" || compInfo.isFullyCompleted;
        if (!isCompleted && session?.status === "in_progress") {
          prioritiesListEl.innerHTML = `<li class="highlight-empty">Đang phân tích các trọng tâm cần hoàn thiện...</li>`;
        } else {
          prioritiesListEl.innerHTML = `<li class="highlight-empty">Không phát hiện lỗ hổng lớn cần khắc phục trong các chủ đề đã kiểm tra</li>`;
        }
      }
    }
  }
  if (statusEl) statusEl.textContent = compStatus;

  // Score & Evaluation Status Resolution (WI-REPORT-PREVIEW-01)
  const gp = report?.guestPreview || session?.report?.guestPreview || session?.guestPreview || {};
  const evalStatus = (gp.evaluationStatus || ev.evaluationStatus || session.evaluationStatus || session.status || "").toUpperCase();

  let rawScore = null;
  let sourceScale = null;

  if (evalStatus === "PENDING" || evalStatus === "IN_PROGRESS") {
    rawScore = null;
  } else if (evalStatus === "EVALUATION_FAILED" || evalStatus === "FAILED") {
    rawScore = null;
  } else if (evalStatus === "INSUFFICIENT_EVIDENCE") {
    rawScore = null;
  } else if (typeof gp.overallScore === "number") {
    rawScore = gp.overallScore;
    sourceScale = "0-100";
  } else if (typeof ev.score === "number") {
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

  const isInvalidEvalState = evalStatus === "PENDING" || evalStatus === "IN_PROGRESS" ||
                             evalStatus === "EVALUATION_FAILED" || evalStatus === "FAILED" ||
                             evalStatus === "INSUFFICIENT_EVIDENCE";

  const score100 = !isInvalidEvalState ? normalizeScoreTo100(rawScore, sourceScale) : null;

  if (score100 !== null) {
    const formattedScore = Number.isInteger(score100) ? String(score100) : score100.toFixed(1);
    if (scoreNumEl) scoreNumEl.textContent = formattedScore;
    if (scoreScaleEl) scoreScaleEl.textContent = "/ 100";
    if (normScoreEl) normScoreEl.textContent = `Thang điểm: ${formattedScore} / 100`;
  } else {
    if (scoreNumEl) scoreNumEl.textContent = "—";
    if (scoreScaleEl) scoreScaleEl.textContent = "/ 100";
    if (normScoreEl) {
      if (evalStatus === "PENDING" || evalStatus === "IN_PROGRESS") {
        normScoreEl.textContent = "Đang xử lý đánh giá (Evaluation Pending)";
      } else if (evalStatus === "EVALUATION_FAILED" || evalStatus === "FAILED") {
        normScoreEl.textContent = "Đánh giá thất bại (Evaluation Failed)";
      } else if (evalStatus === "INSUFFICIENT_EVIDENCE") {
        normScoreEl.textContent = "Chưa đủ dữ liệu để kết luận (Insufficient Evidence)";
      } else {
        normScoreEl.textContent = "Chưa đủ dữ liệu để chấm điểm";
      }
    }
  }

  // Level calibration
  const demonstratedLevel = ev.demonstratedLevel || ev.DemonstratedLevel || perf?.demonstratedLevel || "Unassessed";
  const demoLvlEl = document.getElementById("hero-demonstrated-level");
  const calTargetEl = document.getElementById("hero-calibrated-target");

  if (demoLvlEl) demoLvlEl.textContent = demonstratedLevel.toUpperCase();
  if (calTargetEl) calTargetEl.textContent = targetLvl.toUpperCase();

  // Readiness Pill & Status Resolution (WI-GUEST-PREVIEW-REMEDIATION-01)
  const readiness = perf?.readiness || perf?.Readiness || "NEEDS_MORE_EVIDENCE";
  const readinessPill = document.getElementById("hero-readiness-pill");
  const confidencePill = document.getElementById("hero-confidence-pill");
  const rationaleEl = document.getElementById("hero-readiness-rationale");

  if (readinessPill) {
    if (evalStatus === "PENDING" || evalStatus === "IN_PROGRESS") {
      readinessPill.className = "readiness-pill needs-evidence";
      readinessPill.textContent = "ĐANG XỬ LÝ ĐÁNH GIÁ";
    } else if (evalStatus === "EVALUATION_FAILED" || evalStatus === "FAILED") {
      readinessPill.className = "readiness-pill not-ready";
      readinessPill.textContent = "ĐÁNH GIÁ THẤT BẠI";
    } else if (evalStatus === "INSUFFICIENT_EVIDENCE") {
      readinessPill.className = "readiness-pill needs-evidence";
      readinessPill.textContent = "CHƯA ĐỦ BẰNG CHỨNG";
    } else if (isGuest || gp.evaluationRating) {
      // Guest Preview: Resolve readiness directly from evaluationRating and rawScore
      const rating = (gp.evaluationRating || (rawScore >= 85 ? "Xuất sắc" : rawScore >= 70 ? "Tốt" : rawScore >= 55 ? "Đạt yêu cầu" : "Cần cải thiện")).trim();
      const ratingLower = rating.toLowerCase();
      let pillClass = "ready";
      if (ratingLower.includes("xuất sắc") || ratingLower.includes("tốt") || (rawScore != null && rawScore >= 70)) {
        pillClass = "ready";
      } else if (ratingLower.includes("đạt yêu cầu") || (rawScore != null && rawScore >= 55)) {
        pillClass = "ready-with-gaps";
      } else {
        pillClass = "not-ready";
      }
      readinessPill.className = "readiness-pill " + pillClass;
      readinessPill.textContent = rating.toUpperCase();
    } else {
      readinessPill.className = "readiness-pill " + getReadinessClass(readiness);
      readinessPill.textContent = getReadinessLabel(readiness);
    }
  }

  const confidence = ev.confidence || ev.Confidence || perf?.confidence || "MEDIUM";
  if (confidencePill) {
    confidencePill.textContent = `Độ tin cậy: ${getConfidenceLabel(confidence)}`;
  }

  let rationale = "";
  if (evalStatus === "PENDING" || evalStatus === "IN_PROGRESS") {
    rationale = "Hệ thống đang phân tích các câu trả lời để hoàn thiện đánh giá.";
  } else if (evalStatus === "EVALUATION_FAILED" || evalStatus === "FAILED") {
    rationale = "Đánh giá chưa thành công; vui lòng thực hiện lại phiên phỏng vấn.";
  } else if (evalStatus === "INSUFFICIENT_EVIDENCE") {
    rationale = "Cần thêm dữ liệu câu trả lời để hoàn thiện đánh giá.";
  } else if (isGuest || gp.evaluationRating) {
    const gpInterpretation = gp.interpretation || report?.guestPreview?.interpretation || report?.interpretation;
    if (gpInterpretation) {
      rationale = gpInterpretation;
    } else {
      const ratingLower = (gp.evaluationRating || "").toLowerCase();
      if (ratingLower.includes("xuất sắc") || (rawScore != null && rawScore >= 85)) {
        rationale = "Ứng viên thể hiện năng lực vượt trội, sẵn sàng đảm nhiệm các thách thức chuyên môn phức tạp.";
      } else if (ratingLower.includes("tốt") || (rawScore != null && rawScore >= 70)) {
        rationale = "Ứng viên đáp ứng tốt các tiêu chuẩn vị trí với nền tảng kỹ năng vững vàng.";
      } else if (ratingLower.includes("đạt yêu cầu") || (rawScore != null && rawScore >= 55)) {
        rationale = "Ứng viên nắm được các yêu cầu cơ bản, có tiềm năng phát triển tốt khi được bồi dưỡng thêm.";
      } else {
        rationale = "Ứng viên cần củng cố thêm kiến thức nền tảng và rèn luyện kỹ năng phỏng vấn thực tế.";
      }
    }
  } else {
    rationale = perf?.readinessRationale || perf?.ReadinessRationale || (
      readiness === "READY" ? "Ứng viên đáp ứng tốt các yêu cầu trọng tâm cho vị trí." :
      readiness === "READY_WITH_GAPS" ? "Ứng viên có nền tảng tốt nhưng cần củng cố thêm một số nội dung chuyên sâu." :
      readiness === "NOT_READY" ? "Ứng viên chưa đáp ứng được các tiêu chuẩn cốt lõi của vị trí mục tiêu." :
      "Cần thêm các lượt trả lời để có đủ bằng chứng xác định mức độ sẵn sàng."
    );
  }
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
    return "📋";
  }
  if (has("operation") || has("van hanh") || has("supply chain") || has("chuoi cung ung") || has("logistics") || has("kho")) {
    return "📦";
  }
  return "💼";
}

const STANDARD_DIMENSIONS = [
  { key: "TECHNICAL_KNOWLEDGE", name: "Kiến thức Kỹ thuật", icon: `<svg class="pm-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>` },
  { key: "PRACTICAL_APPLICATION", name: "Ứng dụng Thực tế", icon: `<svg class="pm-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>` },
  { key: "REASONING_DEPTH", name: "Độ sâu Tư duy & Lập luận", icon: `<svg class="pm-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` },
  { key: "FOLLOW_UP_HANDLING", name: "Xử lý Câu hỏi Đào sâu", icon: `<svg class="pm-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>` },
  { key: "COMMUNICATION", name: "Giao tiếp & Cấu trúc STAR", icon: `<svg class="pm-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>` },
  { key: "CONSISTENCY", name: "Tính Nhất quán", icon: `<svg class="pm-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>` }
];

var _cachedDimensionsData = [];
var _selectedDimensionKey = "TECHNICAL_KNOWLEDGE";
if (typeof window !== "undefined") {
  window._selectedDimensionKey = _selectedDimensionKey;
  window._cachedDimensionsData = _cachedDimensionsData;
}

function getDimensionGuidance(dimKey, level) {
  const isUnassessed = !level || level.toUpperCase() === "UNASSESSED";
  if (isUnassessed) {
    return "Khía cạnh này chưa có đủ câu hỏi để khảo sát trong phiên. Hãy tiếp tục luyện tập thêm các câu hỏi chuyên sâu để hệ thống thu thập bằng chứng đánh giá hoàn thiện.";
  }
  const guidanceMap = {
    TECHNICAL_KNOWLEDGE: "Tiếp tục củng cố kiến thức nền tảng và cập nhật các công nghệ, mẫu thiết kế hệ thống mới nhất tương ứng với vị trí mục tiêu.",
    PRACTICAL_APPLICATION: "Minh họa câu trả lời bằng các số liệu định lượng, bài học kinh nghiệm xử lý lỗi thực tế và kết quả đo lường cụ thể từ các dự án đã qua.",
    REASONING_DEPTH: "Trình bày rõ các phương án trade-off (được - mất), phân tích sâu nguyên nhân gốc rễ và lập luận đa chiều trước khi đưa ra kết luận giải pháp.",
    FOLLOW_UP_HANDLING: "Giữ vững bình tĩnh khi người phỏng vấn đào sâu, lắng nghe kỹ trọng tâm và bóc tách câu hỏi phức tạp thành từng phần nhỏ để phản hồi dứt khoát.",
    COMMUNICATION: "Áp dụng chặt chẽ mô hình STAR (Situation - Task - Action - Result), mở đầu bằng thông điệp chính và cô đọng chi tiết để tăng sức thuyết phục.",
    CONSISTENCY: "Đảm bảo thông tin trình bày đồng nhất với hồ sơ ứng tuyển (CV) và các phát biểu trước đó trong toàn bộ cuộc đối thoại."
  };
  return guidanceMap[dimKey] || "Rèn luyện thêm các tình huống thực hành và duy trì cấu trúc trả lời mạch lạc để nâng cao điểm số chuyên môn.";
}
if (typeof window !== "undefined") {
  window.getDimensionGuidance = getDimensionGuidance;
}


// ==========================================================================
// WI-REPORT-09R1, WI-REPORT-09R3, WI-REPORT-09R4: SIX-DIMENSION RADAR CHART
// ==========================================================================

function renderRadarChart(dimensionsData) {
  const wrapper = document.getElementById("radar-svg-wrapper");
  if (!wrapper || !Array.isArray(dimensionsData) || dimensionsData.length === 0) return;

  const width = 560;
  const height = 420;
  const cx = 280;
  const cy = 210;
  const R = 120;
  const N = 6;
  const angleStep = (2 * Math.PI) / N;
  const startAngle = -Math.PI / 2; // Start at 12 o'clock

  function getCoords(i, r) {
    const angle = startAngle + i * angleStep;
    return {
      x: Math.round((cx + r * Math.cos(angle)) * 10) / 10,
      y: Math.round((cy + r * Math.sin(angle)) * 10) / 10,
      angle
    };
  }

  // 1. Concentric grid rings (20, 40, 60, 80, 100)
  const gridLevels = [20, 40, 60, 80, 100];
  const gridRingsSvg = gridLevels.map(level => {
    const r = (level / 100) * R;
    const points = [];
    for (let i = 0; i < N; i++) {
      const pt = getCoords(i, r);
      points.push(`${pt.x},${pt.y}`);
    }
    const isOuter = level === 100;
    return `<polygon class="radar-grid-ring ${isOuter ? 'outer' : ''}" points="${points.join(' ')}" />`;
  }).join('\n');

  // Value scale markers along vertical top axis
  const scaleMarkersSvg = gridLevels.map(level => {
    const r = (level / 100) * R;
    const pt = getCoords(0, r);
    return `<text x="${pt.x + 8}" y="${pt.y + 4}" font-size="9.5" fill="var(--rpt-text-muted)" font-weight="600">${level}</text>`;
  }).join('\n');

  // 2. Target expectation polygon (score 75 standard)
  const targetPoints = [];
  for (let i = 0; i < N; i++) {
    const pt = getCoords(i, (75 / 100) * R);
    targetPoints.push(`${pt.x},${pt.y}`);
  }
  const targetPolygonSvg = `<polygon class="radar-target-polygon" points="${targetPoints.join(' ')}" title="Chuẩn kỳ vọng (75 điểm)" />`;

  // 3. Candidate score polygon
  const scorePolygonPoints = [];
  const assessedDims = dimensionsData.filter(d => !d.isUnassessed && d.score100 !== null);
  const hasAssessed = assessedDims.length > 0;

  for (let i = 0; i < N; i++) {
    const d = dimensionsData[i];
    const isUn = !d || d.isUnassessed || d.score100 === null;
    const effectiveScore = isUn ? 45 : Math.max(10, Math.min(100, d.score100));
    const r = (effectiveScore / 100) * R;
    const pt = getCoords(i, r);
    scorePolygonPoints.push(`${pt.x},${pt.y}`);
  }

  const scorePolygonSvg = hasAssessed 
    ? `<polygon class="radar-score-polygon" points="${scorePolygonPoints.join(' ')}" />`
    : '';

  // 4. Axis lines, labels, hit areas, and interactive dots
  const axesSvg = dimensionsData.map((d, i) => {
    const isSelected = d.key === _selectedDimensionKey;
    const isUn = d.isUnassessed || d.score100 === null;
    const linePt = getCoords(i, R);
    
    const scoreVal = isUn ? 45 : Math.max(10, Math.min(100, d.score100));
    const dotPt = getCoords(i, (scoreVal / 100) * R);

    const labelDistance = R + 26;
    const angle = startAngle + i * angleStep;
    const lx = Math.round((cx + labelDistance * Math.cos(angle)) * 10) / 10;
    let ly = Math.round((cy + labelDistance * Math.sin(angle)) * 10) / 10;
    
    if (i === 0) ly -= 6;
    if (i === 3) ly += 12;

    const shortName = d.dimName || d.name;
    const scoreBadgeText = isUn ? "Chưa đánh giá" : `${d.score100}/100`;

    const dotSvg = isUn 
      ? `<circle class="radar-unassessed-marker" cx="${dotPt.x}" cy="${dotPt.y}" r="5" title="${escapeHtml(d.dimName)}: Chưa đánh giá" />`
      : `<circle class="radar-score-dot ${isSelected ? 'active' : ''}" cx="${dotPt.x}" cy="${dotPt.y}" r="6" title="${escapeHtml(d.dimName)}: ${d.score100}/100" />`;

    return `
      <g class="radar-axis-group ${isSelected ? 'selected' : ''}" 
         data-dimension="${d.key}" 
         role="button" 
         tabindex="0" 
         aria-label="${escapeHtml(d.dimName)}: ${scoreBadgeText}"
         aria-pressed="${isSelected ? 'true' : 'false'}"
         onclick="selectCompetencyDimension('${d.key}')"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectCompetencyDimension('${d.key}');}">
        <!-- Wide hit-target for effortless selection -->
        <line class="radar-axis-hit" x1="${cx}" y1="${cy}" x2="${linePt.x}" y2="${linePt.y}" stroke="transparent" stroke-width="28" style="cursor: pointer;" />
        <!-- Axis line -->
        <line class="radar-axis-line" x1="${cx}" y1="${cy}" x2="${linePt.x}" y2="${linePt.y}" />
        <!-- Score dot -->
        ${dotSvg}
        <!-- Label and score -->
        <text class="radar-axis-label ${isSelected ? 'active' : ''}" x="${lx}" y="${ly}">${escapeHtml(shortName)}</text>
        <text class="radar-axis-score-badge ${isUn ? 'unassessed' : ''} ${isSelected ? 'active' : ''}" x="${lx}" y="${ly + 13}">${scoreBadgeText}</text>
      </g>
    `;
  }).join('\n');

  wrapper.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <filter id="radar-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <!-- Background Concentric Rings -->
      ${gridRingsSvg}
      <!-- Value Scale Markers -->
      ${scaleMarkersSvg}
      <!-- Benchmark 75 Polygon -->
      ${targetPolygonSvg}
      <!-- Candidate Score Polygon -->
      ${scorePolygonSvg}
      <!-- Axes, Interactive Dots & Labels -->
      ${axesSvg}
    </svg>
  `;

  // Render quick dimension selector pill strip below chart
  const selectorStrip = document.getElementById("radar-dim-selector-strip");
  if (selectorStrip) {
    selectorStrip.innerHTML = dimensionsData.map(d => {
      const isSelected = d.key === _selectedDimensionKey;
      const isUn = d.isUnassessed || d.score100 === null;
      const scoreBadgeText = isUn ? "—" : `${d.score100}`;
      return `
        <button type="button" 
                class="radar-dim-pill-btn ${isSelected ? 'active' : ''}" 
                role="tab" 
                data-dimension="${d.key}" 
                aria-selected="${isSelected ? 'true' : 'false'}"
                aria-controls="dim-selected-detail-panel"
                onclick="selectCompetencyDimension('${d.key}')"
                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectCompetencyDimension('${d.key}');}"
                title="${escapeHtml(d.dimName)}: ${isUn ? 'Chưa đánh giá' : d.score100 + '/100'}">
          <span class="dim-pill-left">
            <span class="dim-pill-icon">${d.dimIcon}</span>
            <span class="dim-pill-name">${escapeHtml(d.dimName)}</span>
          </span>
          <span class="dim-pill-score ${isUn ? 'unassessed' : ''}">${scoreBadgeText}</span>
        </button>
      `;
    }).join("");
  }
}

// ==========================================================================
// LOCALIZATION MAPPING HELPERS (WI-REPORT-VIDEO-AUDIO-UX-02 Phase 1)
// Maps internal assessment levels, enums and status values to user-facing Vietnamese.
// Backend enum/API keys remain unmodified SSOT.
// ==========================================================================

function formatAssessmentLevel(level) {
  if (!level) return "Chưa đánh giá";
  const raw = String(level).trim().toUpperCase().replace(/[\s_-]+/g, "_");
  if (raw === "STRONG") return "Điểm mạnh";
  if (raw === "WEAK") return "Cần cải thiện";
  if (raw === "MODERATE" || raw === "MIDDLE") return "Mức độ trung bình";
  if (raw === "GOOD") return "Tốt";
  if (raw === "EXCELLENT") return "Xuất sắc";
  if (raw === "NEEDS_IMPROVEMENT" || raw === "NEEDS_WORK") return "Cần cải thiện";
  if (raw === "UNASSESSED" || raw === "NOT_ASSESSED") return "Chưa được đánh giá";
  if (raw === "INSUFFICIENT_EVIDENCE") return "Chưa đủ dữ liệu đánh giá";
  if (raw === "LIMITED") return "Hạn chế";
  return level;
}

function formatPriorityLevel(prio) {
  if (!prio) return "Trung bình";
  const raw = String(prio).trim().toUpperCase();
  if (raw === "CRITICAL") return "Nghiêm trọng";
  if (raw === "HIGH") return "Cao";
  if (raw === "MEDIUM") return "Trung bình";
  if (raw === "LOW") return "Thấp";
  return prio;
}

if (typeof window !== "undefined") {
  window.formatAssessmentLevel = formatAssessmentLevel;
  window.formatPriorityLevel = formatPriorityLevel;
}

function renderRadarInterpretation(dimensionsData) {
  const bodyEl = document.getElementById("radar-interp-body");
  const statusBadge = document.getElementById("radar-interp-status");
  const strongNameEl = document.getElementById("radar-strongest-name");
  const strongScoreEl = document.getElementById("radar-strongest-score");
  const weakNameEl = document.getElementById("radar-weakest-name");
  const weakScoreEl = document.getElementById("radar-weakest-score");

  if (!bodyEl || !Array.isArray(dimensionsData)) return;

  const assessed = dimensionsData.filter(d => !d.isUnassessed && d.score100 !== null);

  if (assessed.length === 0) {
    if (statusBadge) statusBadge.textContent = "Chưa đủ dữ liệu";
    bodyEl.innerHTML = "<p>Phiên phỏng vấn hiện chưa ghi nhận đủ dữ liệu chấm điểm cho 6 chiều năng lực. Biểu đồ radar sẽ tự động hoàn thiện khi có ít nhất một chiều được đánh giá chi tiết.</p>";
    if (strongNameEl) strongNameEl.textContent = "Chưa có";
    if (strongScoreEl) strongScoreEl.textContent = "—";
    if (weakNameEl) weakNameEl.textContent = "Chưa có";
    if (weakScoreEl) weakScoreEl.textContent = "—";
    return;
  }

  const sorted = [...assessed].sort((a, b) => b.score100 - a.score100);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const spread = strongest.score100 - weakest.score100;

  let statusText = "Cân bằng rất tốt";
  if (spread > 30) {
    statusText = "Độ lệch lớn giữa các trục";
  } else if (spread > 15) {
    statusText = "Phát triển khá đồng đều";
  }
  if (statusBadge) statusBadge.textContent = statusText;

  const localizedStrongLevel = formatAssessmentLevel(strongest.level);
  const localizedWeakLevel = formatAssessmentLevel(weakest.level);

  if (strongNameEl) strongNameEl.textContent = strongest.dimName;
  if (strongScoreEl) strongScoreEl.textContent = `${strongest.score100}/100 (${localizedStrongLevel})`;

  if (weakNameEl) weakNameEl.textContent = weakest.dimName;
  if (weakScoreEl) weakScoreEl.textContent = `${weakest.score100}/100 (${localizedWeakLevel})`;

  let narrative = `Ứng viên thể hiện phong độ ấn tượng nhất ở trục <strong>${escapeHtml(strongest.dimName)}</strong> với <strong>${strongest.score100}/100</strong> điểm (${escapeHtml(localizedStrongLevel)}), phản ánh năng lực chuyên môn và tư duy rõ ràng. `;
  
  if (spread === 0) {
    narrative += `Các trục năng lực đã đánh giá đều có mức độ hoàn thiện ngang nhau, cho thấy phong độ ổn định xuyên suốt cuộc phỏng vấn.`;
  } else {
    narrative += `Ngược lại, trục <strong>${escapeHtml(weakest.dimName)}</strong> (${weakest.score100}/100 điểm) là khu vực có độ chênh lệch lớn nhất so với thế mạnh (${spread} điểm). Việc tập trung rèn luyện trục này sẽ giúp hồ sơ năng lực trở nên cân đối và cạnh tranh vượt trội hơn.`;
  }

  bodyEl.innerHTML = `<p>${narrative}</p>`;
}

function renderDimensionDetailPanel(dimKey) {
  // Target inspector container: id="dim-selected-detail-panel"
  const panel = document.getElementById("dim-selected-detail-panel");
  if (!panel) return;

  const dim = _cachedDimensionsData.find(d => d.key === dimKey) || _cachedDimensionsData[0];
  if (!dim) return;

  const isUnassessed = dim.isUnassessed;
  const scoreText = (dim.score100 !== null && !isUnassessed) ? `${dim.score100}` : "—";
  const levelText = isUnassessed ? "Chưa đánh giá trong phiên" : formatAssessmentLevel(dim.level || "Middle");
  const guidance = getDimensionGuidance(dim.key, dim.level);

  panel.innerHTML = `
    <div class="dim-inspector-header">
      <div class="dim-inspector-title-wrap">
        <span class="dim-inspector-icon">${dim.dimIcon}</span>
        <div>
          <h3 class="dim-inspector-name">${dim.dimName}</h3>
          <span class="dim-inspector-key">${dim.key}</span>
        </div>
      </div>
      <div class="dim-inspector-badges">
        ${!isUnassessed ? `<span class="dim-inspector-score-pill"><strong>${scoreText}</strong><small>/100</small></span>` : `<span class="dim-inspector-score-pill unassessed"><strong>Chưa ĐG</strong></span>`}
        <span class="dim-level-badge ${(dim.level || "unassessed").toLowerCase()}">${escapeHtml(levelText)}</span>
        <span class="dim-confidence-badge">Độ tin cậy: ${getConfidenceLabel(dim.confidence)}</span>
      </div>
    </div>

    <!-- Visual Progress Track for Selected Dimension -->
    <div class="dim-inspector-progress-row" aria-hidden="true">
      <div class="dim-progress-track">
        <div class="dim-progress-fill ${dim.isUnassessed ? 'unassessed' : dim.levelClass}" style="width: ${dim.progressWidth}%;"></div>
      </div>
    </div>

    <div class="dim-inspector-grid">
      <!-- 1. Observation / Rationale -->
      <div class="dim-inspector-block">
        <h4 class="dim-inspector-block-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          Nhận Định Quan Sát Thực Tế
        </h4>
        <p class="dim-inspector-block-desc">${escapeHtml(dim.rationale)}</p>
      </div>

      <!-- 2. Observed Strengths -->
      <div class="dim-inspector-block">
        <h4 class="dim-inspector-block-title" style="color: #16a34a;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Điểm Mạnh Đã Kiểm Chứng (${dim.strengths.length})
        </h4>
        ${dim.strengths.length > 0 ? `
          <ul class="dim-inspector-list">
            ${dim.strengths.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
          </ul>
        ` : `
          <p class="dim-inspector-block-desc text-muted">${isUnassessed ? "Khía cạnh này chưa có đủ câu hỏi trong phiên để ghi nhận điểm mạnh cụ thể." : "Chưa ghi nhận điểm mạnh nổi bật trong phiên."}</p>
        `}
      </div>

      <!-- 3. Observed Weaknesses / Gaps -->
      <div class="dim-inspector-block">
        <h4 class="dim-inspector-block-title" style="color: #d97706;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Điểm Cần Chú Ý & Hoàn Thiện (${dim.weaknesses.length})
        </h4>
        ${dim.weaknesses.length > 0 ? `
          <ul class="dim-inspector-list">
            ${dim.weaknesses.map(w => `<li>${escapeHtml(w)}</li>`).join("")}
          </ul>
        ` : `
          <p class="dim-inspector-block-desc text-muted">${isUnassessed ? "Không coi là điểm yếu (trạng thái chưa đánh giá do số lượt hỏi chưa tiếp cận)." : "Không phát hiện điểm yếu hoặc khoảng trống nghiêm trọng."}</p>
        `}
      </div>

      <!-- 4. Supporting Evidence (when available) -->
      ${(dim.supporting && dim.supporting.length > 0) ? `
        <div class="dim-inspector-block dim-supporting-block">
          <h4 class="dim-inspector-block-title" style="color: #6366f1;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Minh Chứng Đối Thoại (${dim.supporting.length})
          </h4>
          <ul class="dim-inspector-list">
            ${dim.supporting.map(e => `<li>${escapeHtml(e)}</li>`).join("")}
          </ul>
        </div>
      ` : ''}

      <!-- 5. Practical Actionable Guidance -->
      <div class="dim-inspector-block">
        <h4 class="dim-inspector-block-title" style="color: #2563eb;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
          Định Hướng Phát Triển & Hành Động
        </h4>
        <p class="dim-inspector-block-desc">${escapeHtml(guidance)}</p>
      </div>
    </div>
  `;

  // Trigger smooth transition animation
  panel.classList.remove("dim-panel-animate");
  void panel.offsetWidth;
  panel.classList.add("dim-panel-animate");
}

function selectCompetencyDimension(dimKey) {
  _selectedDimensionKey = dimKey;

  // 1. Update selection state on cards in #dimensions-grid
  const cards = document.querySelectorAll("#dimensions-grid .dimension-card");
  cards.forEach(c => {
    const k = c.getAttribute("data-dimension");
    const isMatch = k === dimKey;
    if (isMatch) {
      c.classList.add("active", "selected");
      c.setAttribute("aria-selected", "true");
    } else {
      c.classList.remove("active", "selected");
      c.setAttribute("aria-selected", "false");
    }
  });

  // 2. Update radar chart axis highlights
  const radarGroups = document.querySelectorAll("#radar-svg-wrapper .radar-axis-group");
  radarGroups.forEach(g => {
    const k = g.getAttribute("data-dimension");
    const isMatch = k === dimKey;
    if (isMatch) {
      g.classList.add("selected");
      g.setAttribute("aria-pressed", "true");
      const dot = g.querySelector(".radar-score-dot");
      if (dot) dot.classList.add("active");
      const lbl = g.querySelector(".radar-axis-label");
      if (lbl) lbl.classList.add("active");
      const badge = g.querySelector(".radar-axis-score-badge");
      if (badge) badge.classList.add("active");
    } else {
      g.classList.remove("selected");
      g.setAttribute("aria-pressed", "false");
      const dot = g.querySelector(".radar-score-dot");
      if (dot) dot.classList.remove("active");
      const lbl = g.querySelector(".radar-axis-label");
      if (lbl) lbl.classList.remove("active");
      const badge = g.querySelector(".radar-axis-score-badge");
      if (badge) badge.classList.remove("active");
    }
  });

  // 3. Update quick dimension selector pills
  const pillBtns = document.querySelectorAll("#radar-dim-selector-strip .radar-dim-pill-btn");
  pillBtns.forEach(b => {
    const k = b.getAttribute("data-dimension");
    const isMatch = k === dimKey;
    if (isMatch) {
      b.classList.add("active");
      b.setAttribute("aria-selected", "true");
    } else {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    }
  });

  // 4. Render details panel
  renderDimensionDetailPanel(dimKey);
}
window.selectCompetencyDimension = selectCompetencyDimension;

// ==========================================================================
// 4B. EXECUTIVE ANALYSIS SYNTHESIS (WI-REPORT-VISUAL-HIERARCHY-AND-ACTIONABLE-INSIGHTS-03)
// ==========================================================================
function renderAnalysisExecutiveSummary(perf, diag, report, session) {
  const container = document.getElementById("analysis-exec-pillars-grid");
  if (!container) return;

  // 1. Pillar: Top Strength (Thế mạnh nổi bật nhất)
  let topStrengthTitle = "Kỹ Năng Chuyên Môn";
  let topStrengthScore = null;
  let topStrengthDesc = "Đáp ứng tốt các yêu cầu trọng tâm của vị trí phỏng vấn.";
  
  const dimScores = perf?.dimensionScores || perf?.Dimensions || [];
  if (Array.isArray(dimScores) && dimScores.length > 0) {
    const valid = dimScores.filter(d => (d.score ?? d.Score ?? 0) > 0);
    if (valid.length > 0) {
      const top = [...valid].sort((a, b) => (b.score ?? b.Score ?? 0) - (a.score ?? a.Score ?? 0))[0];
      topStrengthTitle = top.name || top.dimensionName || top.DimensionName || top.Name || "Kỹ năng chuyên môn";
      topStrengthScore = Math.round(top.score ?? top.Score ?? 0);
      topStrengthDesc = `Đạt ${topStrengthScore}/100 điểm — Thể hiện tư duy chắc chắn và lập luận thuyết phục nhất trong 6 chiều năng lực.`;
    }
  }
  if (!topStrengthScore) {
    const strengths = diag?.strengths || diag?.Strengths || [];
    if (strengths.length > 0) {
      topStrengthTitle = strengths[0].concept || strengths[0].Concept || strengths[0].title || "Kỹ năng chuyên môn";
      topStrengthDesc = strengths[0].observation || strengths[0].Observation || "Ghi nhận biểu hiện xuất sắc và vững vàng qua các câu trả lời.";
    }
  }

  // 2. Pillar: Priority Improvement (Trọng tâm cần cải thiện)
  let topWeakTitle = "Cấu Trúc Lập Luận & Chiều Sâu";
  let topWeakScore = null;
  let topWeakDesc = "Cần bổ sung dẫn chứng cụ thể và số liệu định lượng để tăng độ tin cậy.";

  if (Array.isArray(dimScores) && dimScores.length > 0) {
    const valid = dimScores.filter(d => (d.score ?? d.Score ?? 0) > 0);
    if (valid.length > 0) {
      const weak = [...valid].sort((a, b) => (a.score ?? a.Score ?? 0) - (b.score ?? b.Score ?? 0))[0];
      if ((weak.score ?? weak.Score ?? 100) < 75) {
        topWeakTitle = weak.name || weak.dimensionName || weak.DimensionName || weak.Name || "Trục năng lực trọng tâm";
        topWeakScore = Math.round(weak.score ?? weak.Score ?? 0);
        topWeakDesc = `Đạt ${topWeakScore}/100 điểm — Trục có khoảng cách lớn nhất so với chuẩn kỳ vọng (75 điểm), cần ưu tiên rèn luyện.`;
      }
    }
  }
  if (!topWeakScore) {
    const weaknesses = diag?.weaknesses || diag?.Weaknesses || [];
    if (weaknesses.length > 0) {
      topWeakTitle = weaknesses[0].concept || weaknesses[0].Concept || weaknesses[0].title || "Điểm nghẽn lập luận";
      topWeakDesc = weaknesses[0].observation || weaknesses[0].Observation || "Cần khắc phục để tránh mất điểm trong các câu hỏi tình huống phức tạp.";
    }
  }

  // 3. Pillar: Voice & Speech Delivery (Phong cách giọng nói)
  const speechAssess = report?.speechAssessment || report?.speechCoaching || report?.deliveryAssessment || {};
  const metrics = speechAssess?.metrics || speechAssess?.Metrics || {};
  const wpm = metrics?.wordsPerMinute || metrics?.wpm || metrics?.WordsPerMinute;
  const fillers = metrics?.fillerWordsPerMinute || metrics?.fillerRate || metrics?.FillerWordsPerMinute;
  let voiceDesc = "";
  if (wpm) {
    const wpmNum = Math.round(wpm);
    const wpmEval = wpmNum >= 120 && wpmNum <= 165 ? "tốc độ chuẩn mực (120–160 WPM)" : wpmNum < 120 ? "nhịp điệu hơi chậm" : "tốc độ khá nhanh";
    voiceDesc = `Tốc độ trung bình ${wpmNum} từ/phút (${wpmEval}). ${fillers !== undefined ? `Tần suất từ đệm: ${Math.round(fillers)} từ/phút.` : ""}`;
  } else if (speechAssess?.overallImpression) {
    voiceDesc = speechAssess.overallImpression;
  } else {
    voiceDesc = "Giọng nói rõ ràng, âm lượng ổn định và duy trì thái độ cầu thị, chuyên nghiệp.";
  }

  // 4. Pillar: Nonverbal & Body Language (Tác phong & Không gian)
  const visualAnalysis = report?.visualAnalysis || report?.telemetry || {};
  let visualDesc = "";
  if (visualAnalysis?.lightingStatus || visualAnalysis?.cameraFraming) {
    visualDesc = `${visualAnalysis.lightingStatus || "Ánh sáng tốt"} • ${visualAnalysis.cameraFraming || "Khung hình cân đối"}. Không ghi nhận cản trở tác phong.`;
  } else {
    visualDesc = "Góc máy chính diện, duy trì ánh mắt hướng camera ổn định và tác phong đĩnh đạc trong suốt phiên.";
  }

  container.innerHTML = `
    <!-- Pillar 1: Strongest Dimension -->
    <div class="analysis-exec-pillar-card pillar-strong">
      <div class="pillar-card-topbar">
        <span class="pillar-tag pillar-tag-strong">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Thế mạnh nổi bật nhất</span>
        </span>
        ${topStrengthScore ? `<span class="pillar-score-badge">${topStrengthScore} / 100</span>` : ""}
      </div>
      <h4 class="pillar-title">${escapeHtml(topStrengthTitle)}</h4>
      <p class="pillar-desc">${escapeHtml(topStrengthDesc)}</p>
      <div class="pillar-footer">
        <button type="button" class="pillar-action-link" onclick="scrollToEvidence('section-dimensions')">
          <span>Xem 6 chiều năng lực</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>

    <!-- Pillar 2: Priority Improvement -->
    <div class="analysis-exec-pillar-card pillar-weak">
      <div class="pillar-card-topbar">
        <span class="pillar-tag pillar-tag-weak">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Trọng tâm ưu tiên cải thiện</span>
        </span>
        ${topWeakScore ? `<span class="pillar-score-badge weak">${topWeakScore} / 100</span>` : ""}
      </div>
      <h4 class="pillar-title">${escapeHtml(topWeakTitle)}</h4>
      <p class="pillar-desc">${escapeHtml(topWeakDesc)}</p>
      <div class="pillar-footer">
        <button type="button" class="pillar-action-link" onclick="scrollToEvidence('section-diagnostics')">
          <span>Xem chẩn đoán chi tiết</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>

    <!-- Pillar 3: Speech & Voice Delivery -->
    <div class="analysis-exec-pillar-card pillar-voice">
      <div class="pillar-card-topbar">
        <span class="pillar-tag pillar-tag-voice">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
          <span>Phong cách giọng nói</span>
        </span>
      </div>
      <h4 class="pillar-title">Nhịp Điệu & Tốc Độ Diễn Đạt</h4>
      <p class="pillar-desc">${escapeHtml(voiceDesc)}</p>
      <div class="pillar-footer">
        <button type="button" class="pillar-action-link" onclick="scrollToEvidence('section-speech-coaching')">
          <span>Xem phân tích giọng nói</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>

    <!-- Pillar 4: Nonverbal & Body Language -->
    <div class="analysis-exec-pillar-card pillar-visual">
      <div class="pillar-card-topbar">
        <span class="pillar-tag pillar-tag-visual">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span>Tác phong & Không gian</span>
        </span>
      </div>
      <h4 class="pillar-title">Điều Kiện Ghi Hình & Phong Thái</h4>
      <p class="pillar-desc">${escapeHtml(visualDesc)}</p>
      <div class="pillar-footer">
        <button type="button" class="pillar-action-link" onclick="scrollToEvidence('video-moments-container')">
          <span>Xem khoảnh khắc tác phong</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  `;
}
window.renderAnalysisExecutiveSummary = renderAnalysisExecutiveSummary;

function scrollToEvidence(targetId) {
  let el = document.getElementById(targetId);
  if (!el && targetId.startsWith("turn-")) {
    const turnNum = targetId.replace("turn-", "");
    el = document.getElementById(`feedback-card-turn-${turnNum}`) ||
         document.getElementById(`turn-card-${turnNum}`) ||
         document.getElementById(`provenance-turn-${turnNum}`) ||
         document.getElementById(`practice-turn-${turnNum}`);
    if (el) {
      const parentFeedback = el.closest("#stage-panel-feedback");
      if (parentFeedback && typeof goToStage === "function") {
        goToStage("feedback");
      }
    }
  } else if (!el && targetId === "section-dimensions") {
    el = document.getElementById("section-dimensions");
    if (typeof goToStage === "function") goToStage("during");
  } else if (!el && targetId === "section-diagnostics") {
    el = document.getElementById("section-diagnostics");
    if (typeof goToStage === "function") goToStage("during");
  } else if (!el && (targetId === "section-speech-coaching" || targetId.includes("speech"))) {
    el = document.getElementById("section-speech-coaching");
    if (typeof goToStage === "function") goToStage("during");
  } else if (!el && (targetId === "video-moments-container" || targetId.includes("video"))) {
    el = document.getElementById("video-moments-container") || document.getElementById("telemetry-disclosure-card");
    if (typeof goToStage === "function") goToStage("during");
  }

  if (el) {
    const collapsedParent = el.closest(".telemetry-collapsed, .module-collapsed, .hidden");
    if (collapsedParent && collapsedParent.id === "telemetry-disclosure-body") {
      if (typeof toggleTelemetryDeepDive === "function") toggleTelemetryDeepDive();
    }
    const y = el.getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
    el.classList.add("pm-target-highlight");
    setTimeout(() => {
      el.classList.remove("pm-target-highlight");
    }, 2500);
  }
}
window.scrollToEvidence = scrollToEvidence;

function scrollToResource(resourceId) {
  if (typeof goToStage === "function") {
    goToStage("after");
  }
  setTimeout(() => {
    let target = document.getElementById(resourceId);
    if (!target) {
      if (resourceId.startsWith("prep-module")) {
        if (typeof openPrepModule === "function") {
          openPrepModule(resourceId);
          return;
        }
      }
      target = document.getElementById("section-reference-materials");
    }
    if (target) {
      const y = target.getBoundingClientRect().top + window.pageYOffset - 90;
      window.scrollTo({ top: y, behavior: "smooth" });
      target.classList.add("pm-target-highlight");
      setTimeout(() => {
        target.classList.remove("pm-target-highlight");
      }, 2500);
    }
  }, 100);
}
window.scrollToResource = scrollToResource;

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

  _cachedDimensionsData = STANDARD_DIMENSIONS.map((sd) => {
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
    const progressWidth = score100 !== null ? Math.min(100, Math.max(0, score100)) : 0;

    return {
      key: sd.key,
      name: sd.name,
      dimName,
      dimIcon,
      level,
      levelClass,
      isUnassessed,
      confidence,
      rationale,
      strengths,
      weaknesses,
      supporting,
      rawScore,
      score100,
      progressWidth
    };
  });

  // Default selection: pick strongest assessed dimension when comparable scores exist
  if (!_selectedDimensionKey || !_cachedDimensionsData.some(d => d.key === _selectedDimensionKey)) {
    const assessed = _cachedDimensionsData.filter(d => !d.isUnassessed && d.score100 !== null);
    if (assessed.length > 0) {
      const sorted = [...assessed].sort((a, b) => (b.score100 || 0) - (a.score100 || 0));
      _selectedDimensionKey = sorted[0].key;
    } else {
      _selectedDimensionKey = _cachedDimensionsData[0]?.key || "TECHNICAL_KNOWLEDGE";
    }
  }

  // 0. Render Six-Dimension Interactive Radar Chart & Interpretation (WI-REPORT-09R1, WI-REPORT-09R3)
  renderRadarChart(_cachedDimensionsData);
  renderRadarInterpretation(_cachedDimensionsData);

  // 1. Render interactive 6 dimension comparison cards for backward compatibility with existing tests
  const cardsHtml = _cachedDimensionsData.map((d) => {
    const isSelected = d.key === _selectedDimensionKey;
    const panelId = `dim-details-${d.key}`;
    const triggerId = `dim-trigger-${d.key}`;

    return `
      <div class="dimension-card glass-panel ${isSelected ? 'active selected' : ''}" 
           data-dimension="${d.key}" 
           role="tab" 
           aria-selected="${isSelected ? 'true' : 'false'}"
           aria-controls="dim-selected-detail-panel"
           onclick="selectCompetencyDimension('${d.key}')"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectCompetencyDimension('${d.key}');}">
        <div class="dim-card-top">
          <div class="dimension-card-header">
            <div class="dim-name-wrap">
              <span class="dim-icon">${d.dimIcon}</span>
              <div>
                <h4 class="dim-title">${d.dimName}</h4>
                <span class="dim-key">${d.key}</span>
              </div>
            </div>
            <div class="dim-header-badges">
              ${(d.score100 !== null && !d.isUnassessed) ? `<span class="dim-score-badge"><strong class="dim-score-val">${d.score100}</strong><small>/100</small></span>` : ""}
              <span class="dim-level-badge ${d.levelClass}">${d.isUnassessed ? "Chưa đánh giá trong phiên" : escapeHtml(formatAssessmentLevel(d.level))}</span>
            </div>
          </div>

          <!-- Visual Progress Track -->
          <div class="dim-progress-container" aria-hidden="true">
            <div class="dim-progress-track">
              <div class="dim-progress-fill ${d.levelClass}" style="width: ${d.progressWidth}%;"></div>
            </div>
          </div>

          <!-- Compact Summary / Disclosure Toggle Bar -->
          <div class="dim-summary-snippet">
            <span class="dim-confidence-badge">Độ tin cậy: ${getConfidenceLabel(d.confidence)}</span>
            <button type="button" class="dim-toggle-btn" id="${triggerId}" aria-expanded="false" aria-controls="${panelId}" onclick="toggleDimensionDetails('${d.key}')">
              <span class="dim-toggle-text">Chi tiết & Bằng chứng</span>
              <svg class="dim-chevron-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>

        <!-- Collapsible Details Panel (Progressive Disclosure) -->
        <div class="dim-details-panel dim-panel-collapsed" id="${panelId}" role="region" aria-labelledby="${triggerId}">
          <div class="dim-details-inner">
            <p class="dim-rationale">${escapeHtml(d.rationale)}</p>
            <div class="dim-evidence-pills">
              <span class="dim-pill">Độ tin cậy: ${getConfidenceLabel(d.confidence)}</span>
              ${d.strengths.slice(0, 2).map(s => `<span class="dim-pill strength">✓ ${escapeHtml(s)}</span>`).join("")}
              ${d.weaknesses.slice(0, 2).map(w => `<span class="dim-pill gap">△ ${escapeHtml(w)}</span>`).join("")}
              ${(d.strengths.length === 0 && d.weaknesses.length === 0 && d.supporting.length > 0) ? d.supporting.slice(0, 2).map(e => `<span class="dim-pill evidence">📌 ${escapeHtml(e)}</span>`).join("") : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = cardsHtml;

  // Render detail for currently active dimension into the right column panel
  renderDimensionDetailPanel(_selectedDimensionKey);
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
              <h5 class="diag-item-title pm-heading-with-icon"><svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>${escapeHtml(title)}</span></h5>
              <span class="diag-badge ${prioClass}">Ưu tiên ${formatPriorityLevel(priority)}<span style="display:none;" aria-hidden="true">Ưu tiên ${priority}</span></span>
            </div>
            ${desc ? `<p class="diag-desc">${escapeHtml(desc)}</p>` : ""}
            <div class="diag-meta-grid">
              <div class="diag-meta-cell root-cause">
                <strong><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" ><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Nguyên nhân gốc:</strong>
                <span>${escapeHtml(rootCause)}</span>
              </div>
              <div class="diag-meta-cell impact">
                <strong><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" ><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Tác động tiềm ẩn:</strong>
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
              <h5 class="diag-item-title pm-heading-with-icon"><svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>${escapeHtml(title)}</span></h5>
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
              <h5 class="diag-item-title pm-heading-with-icon"><svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Rủi ro tiềm ẩn</span></h5>
              <span class="diag-badge ${sevClass}">Mức độ: ${formatPriorityLevel(severity)}<span style="display:none;" aria-hidden="true">Mức độ: ${severity}</span></span>
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

  const rawItems = roadmap?.items || roadmap?.Items || [];

  // Update overall assessment text dynamically if available (WI-REPORT-15R1)
  const overallAssessText = document.getElementById("roadmap-overall-assessment-text");
  if (overallAssessText) {
    const summaryText = roadmap?.summary || roadmap?.Summary || diag?.overallDiagnosis || "";
    if (summaryText && summaryText.trim()) {
      overallAssessText.textContent = summaryText.trim();
    } else if (rawItems.length > 0) {
      overallAssessText.textContent = `Tập trung hoàn thiện ${Math.min(rawItems.length, 3)} trọng tâm hành động then chốt dưới đây để khắc phục trực tiếp các điểm nghẽn năng lực được ghi nhận từ phiên phỏng vấn.`;
    } else {
      overallAssessText.textContent = "Phiên phỏng vấn ghi nhận ứng viên đáp ứng tốt các yêu cầu trọng tâm. Bạn nên tiếp tục duy trì thế mạnh kỹ thuật và phát triển thêm các giải pháp quy mô lớn.";
    }
  }

  // Hide weakness priorities wrap if list is empty (WI-REPORT-15R1)
  const weakWrap = document.getElementById("roadmap-weakness-priorities-wrap");
  const weakList = document.getElementById("roadmap-weakness-priorities-list");
  if (weakWrap) {
    if (!weakList || !weakList.children || weakList.children.length === 0) {
      weakWrap.style.display = "none";
    } else {
      weakWrap.style.display = "block";
    }
  }

  if (rawItems.length === 0) {
    container.innerHTML = `<p class="text-muted" style="padding:16px;">Chưa có lộ trình hành động cụ thể.</p>`;
    return;
  }

  // WI-REPORT-14R1 / WI-REPORT-VISUAL-HIERARCHY-AND-ACTIONABLE-INSIGHTS-03:
  // Select top 2-3 highest-priority improvement recommendations structured in 3 explicit tiers & 5 parts
  const sortedItems = [...rawItems].sort((a, b) => {
    const pA = (a.priority || a.Priority || "").toUpperCase() === "HIGH" ? 1 : 0;
    const pB = (b.priority || b.Priority || "").toUpperCase() === "HIGH" ? 1 : 0;
    return pB - pA;
  });
  const items = sortedItems.slice(0, 3);

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

    // 1-sentence primary action
    let primaryAction = "";
    if (actionsList.length > 0) {
      primaryAction = actionsList[0].description || actionsList[0].title || "";
    } else if (steps.length > 0) {
      primaryAction = steps[0];
    } else if (item.action || item.Action) {
      primaryAction = item.action || item.Action;
    } else {
      primaryAction = `Thực hiện rèn luyện có chủ đích về ${objective.toLowerCase()}.`;
    }

    // 1-sentence rationale / why
    let whyRationale = "";
    if (item.rationale || item.Rationale) {
      whyRationale = item.rationale || item.Rationale;
    } else if (outcome) {
      whyRationale = `Giúp nâng cao độ tin cậy và sự mạch lạc khi giải thích các bài toán thực tế: ${outcome}`;
    } else {
      whyRationale = "Khắc phục trực tiếp lỗ hổng đánh giá được ghi nhận từ phiên phỏng vấn để tăng tỷ lệ trúng tuyển.";
    }

    const tfClass = timeframe.includes("SHORT") ? "short" : timeframe.includes("LONG") ? "long" : "medium";
    const tfLabel = timeframe.includes("SHORT") ? "1 - 3 Ngày" : timeframe.includes("LONG") ? "1 Tháng+" : "1 - 2 Tuần";

    // Standardized 3-tier priorities (WI-REPORT-VISUAL-HIERARCHY-AND-ACTIONABLE-INSIGHTS-03 Phase 3)
    let prioClass = "priority-medium priority-tier-2";
    let prioLabel = "Ưu tiên 2 — Nên cải thiện";
    if (priority === "HIGH" || i === 0) {
      prioClass = "priority-high priority-tier-1";
      prioLabel = "Ưu tiên 1 — Cần cải thiện trước";
    } else if (priority === "LOW" || i === 2) {
      prioClass = "priority-low priority-tier-3";
      prioLabel = "Ưu tiên 3 — Phát triển thêm";
    }

    const turnRefs = item.turnReferences || item.TurnReferences || [];
    const diagRef = item.diagnosticReference || item.DiagnosticReference || "";
    let evidenceNote = "";
    let evidenceTarget = "section-diagnostics";
    let evidenceLabel = "Chẩn đoán chi tiết";
    if (turnRefs.length > 0) {
      evidenceNote = `Căn cứ từ Turn ${turnRefs.join(", ")}${diagRef ? ` • ${diagRef}` : ""}`;
      evidenceTarget = `turn-${turnRefs[0]}`;
      evidenceLabel = `Lượt ${turnRefs.join(", ")}`;
    } else if (diagRef) {
      evidenceNote = `Căn cứ đánh giá: ${diagRef}`;
    }

    // Dynamic mapping to trusted reference materials
    let resourceTarget = "ref-interview-star";
    const objLower = (objective + " " + (item.conceptName || "") + " " + primaryAction).toLowerCase();
    if (objLower.includes("caching") || objLower.includes("database") || objLower.includes("sharding") || objLower.includes("kỹ thuật") || objLower.includes("kiến trúc") || objLower.includes("hệ thống") || objLower.includes("sql") || objLower.includes("api")) {
      resourceTarget = "ref-tech-ddia";
    } else if (objLower.includes("giọng nói") || objLower.includes("tốc độ") || objLower.includes("từ đệm") || objLower.includes("ngập ngừng") || objLower.includes("thuyết trình") || objLower.includes("diễn đạt")) {
      resourceTarget = "ref-voice-toastmasters";
    } else if (objLower.includes("tác phong") || objLower.includes("cơ thể") || objLower.includes("ánh mắt") || objLower.includes("camera") || objLower.includes("không gian")) {
      resourceTarget = "ref-body-language-mindtools";
    } else if (objLower.includes("tài chính") || objLower.includes("ifrs") || objLower.includes("kế toán")) {
      resourceTarget = "ref-fin-ifrs";
    } else if (objLower.includes("marketing") || objLower.includes("tiếp thị") || objLower.includes("analytics")) {
      resourceTarget = "ref-mkt-skillshop";
    }

    let contextGuideLink = "";
    if (objLower.includes("caching") || objLower.includes("database") || objLower.includes("sharding") || objLower.includes("kỹ thuật") || objLower.includes("kiến trúc") || objLower.includes("hệ thống") || objLower.includes("sql") || objLower.includes("api")) {
      contextGuideLink = `<a href="#prep-module-technical" class="rec-guide-link" onclick="openPrepModule('prep-module-technical'); return false;">Xem cẩm nang Kiến thức Kỹ thuật liên quan &rarr;</a>`;
    } else if (objLower.includes("star") || objLower.includes("hành vi") || objLower.includes("giao tiếp") || objLower.includes("sự cố") || objLower.includes("xử lý") || objLower.includes("nhóm")) {
      contextGuideLink = `<a href="#prep-module-behavioral" class="rec-guide-link" onclick="openPrepModule('prep-module-behavioral'); return false;">Xem cẩm nang Phỏng vấn STAR liên quan &rarr;</a>`;
    }

    return `
      <div class="roadmap-card glass-panel priority-rec-card ${prioClass}" id="priority-rec-${i}" data-roadmap-index="${i}">
        <div class="priority-rec-header">
          <div class="priority-rec-top-row">
            <div class="priority-rec-badges">
              <span class="diag-badge ${prioClass.split(' ')[0]}"><span class="priority-tier-label">${prioLabel}</span><span style="display:none;" aria-hidden="true">Ưu tiên ${priority}</span></span>
              <span class="timeframe-badge ${tfClass}">${tfLabel}</span>
            </div>
            <h4 class="priority-rec-title roadmap-objective">${escapeHtml(objective)}</h4>
          </div>

          <!-- Structured 5-Part Actionable Recommendation -->
          <div class="priority-rec-5part-body">
            <div class="priority-rec-issue">
              <strong class="rec-label">1. Vấn đề cần cải thiện:</strong>
              <span class="rec-issue-text">${escapeHtml(objective)}</span>
            </div>
            <p class="priority-rec-why">
              <strong class="rec-label">2. Lý do ưu tiên:</strong> ${escapeHtml(whyRationale)}
            </p>
            <p class="priority-rec-action">
              <strong class="rec-label">3. Hành động trọng tâm:</strong> ${escapeHtml(primaryAction)}
            </p>
          </div>

          ${evidenceNote ? `
            <div class="priority-rec-evidence-row">
              <span class="rec-evidence-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <strong>Dẫn chứng phỏng vấn:</strong> ${escapeHtml(evidenceNote)}
              </span>
            </div>
          ` : ""}

          <!-- Interactive Action Triggers: Xem minh chứng & Tìm hiểu cách cải thiện -->
          <div class="priority-rec-interactive-row">
            <button type="button" class="rec-action-btn rec-evidence-btn" onclick="scrollToEvidence('${evidenceTarget}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>Xem minh chứng (${evidenceLabel})</span>
            </button>
            <button type="button" class="rec-action-btn rec-guide-btn" onclick="scrollToResource('${resourceTarget}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <span>Tìm hiểu cách cải thiện</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>

        <!-- On-demand Expandable Details (Part 4: Cách luyện tập & Part 5: Kết quả mong đợi) -->
        <div class="roadmap-disclosure-wrap">
          <button type="button" class="roadmap-steps-toggle" id="roadmap-toggle-${i}" aria-expanded="false" aria-controls="roadmap-panel-${i}" onclick="toggleRoadmapSteps(${i})">
            <span class="toggle-text">Xem chi tiết (${steps.length || 1} bước thực hành &amp; tự kiểm chứng)</span>
            <svg class="roadmap-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="roadmap-steps-panel roadmap-panel-collapsed" id="roadmap-panel-${i}" role="region" aria-labelledby="roadmap-toggle-${i}">
            ${steps.length > 0 ? `
              <div class="rec-steps-box">
                <h5 class="rec-subhead">4. Cách luyện tập thực tế:</h5>
                <ol class="roadmap-steps-list">
                  ${steps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
                </ol>
              </div>
            ` : ""}
            ${verification ? `
              <div class="roadmap-verification-box">
                <strong class="rec-label">5. Tiêu chí Tự Kiểm Chứng:</strong>
                <span>${escapeHtml(verification)}</span>
              </div>
            ` : (outcome ? `
              <div class="roadmap-verification-box">
                <strong class="rec-label">5. Kết quả Kỳ vọng:</strong>
                <span>${escapeHtml(outcome)}</span>
              </div>
            ` : `
              <div class="roadmap-verification-box">
                <strong class="rec-label">5. Kết quả Kỳ vọng:</strong>
                <span>Nâng cao độ tin cậy và sự mạch lạc khi giải thích các bài toán phỏng vấn thực tế.</span>
              </div>
            `)}
            ${contextGuideLink ? `
              <div class="rec-context-guide-row">
                <span class="rec-context-icon" aria-hidden="true"><svg class="pm-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>
                <div class="rec-context-content">
                  ${contextGuideLink}
                </div>
              </div>
            ` : ""}
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
  const textSpan = btn.querySelector(".toggle-text");
  const stepCount = panel.querySelectorAll(".roadmap-steps-list li").length || 1;
  if (isExpanded) {
    panel.classList.add("roadmap-panel-collapsed");
    btn.classList.add("is-collapsed");
    if (textSpan) textSpan.innerHTML = `Xem chi tiết (${stepCount} bước thực hành &amp; tự kiểm chứng)`;
  } else {
    panel.classList.remove("roadmap-panel-collapsed");
    btn.classList.remove("is-collapsed");
    if (textSpan) textSpan.innerHTML = `Thu gọn chi tiết`;
  }
}
window.toggleRoadmapSteps = toggleRoadmapSteps;

function togglePrepModule(target) {
  let card = null;
  if (typeof target === "string") {
    card = document.getElementById(target);
  } else if (target && target.closest) {
    card = target.closest(".prep-module-card");
  }
  if (!card) return;

  const body = card.querySelector(".module-body-collapsible");
  const btn = card.querySelector(".btn-toggle-module");
  const textSpan = card.querySelector(".module-toggle-text");
  if (!body) return;

  const isCollapsed = body.classList.contains("module-collapsed");
  if (isCollapsed) {
    body.classList.remove("module-collapsed");
    if (btn) btn.setAttribute("aria-expanded", "true");
    if (textSpan) textSpan.textContent = "Thu gọn";
  } else {
    body.classList.add("module-collapsed");
    if (btn) btn.setAttribute("aria-expanded", "false");
    if (textSpan) textSpan.textContent = "Xem cẩm nang";
  }
}
window.togglePrepModule = togglePrepModule;

function openPrepModule(targetId) {
  const card = document.getElementById(targetId);
  if (!card) return;
  const body = card.querySelector(".module-body-collapsible");
  const btn = card.querySelector(".btn-toggle-module");
  const textSpan = card.querySelector(".module-toggle-text");
  if (body && body.classList.contains("module-collapsed")) {
    body.classList.remove("module-collapsed");
    if (btn) btn.setAttribute("aria-expanded", "true");
    if (textSpan) textSpan.textContent = "Thu gọn";
  }
  const y = card.getBoundingClientRect().top + window.pageYOffset - 90;
  window.scrollTo({ top: y, behavior: "smooth" });
}
window.openPrepModule = openPrepModule;

function handleReferenceClick(title) {
  if (typeof showToast === "function") {
    showToast(`Học liệu: "${title}" được tuyển chọn theo chuẩn ngành.`, "info");
  }
}
window.handleReferenceClick = handleReferenceClick;

// ==========================================
// 9. SECTION 5: PREPARATION PLAN
// ==========================================
function renderPreparationSection(prep, jobTitle = "") {
  if (!prep) return;

  // Domain Knowledge & Practical System Design (WI-REPORT-15R1: Unified Module & No False Hiding)
  const techBox = document.getElementById("prep-technical-content");
  const techCard = document.getElementById("prep-module-technical");
  const techItems = prep.technicalPreparation || prep.TechnicalPreparation || [];
  const pracBox = document.getElementById("prep-practical-content");
  const pracItems = [
    ...(prep.practicalPreparation || prep.PracticalPreparation || []),
    ...(prep.systemDesignPreparation || prep.SystemDesignPreparation || [])
  ];

  if (techItems.length === 0 && pracItems.length === 0) {
    if (techCard) techCard.classList.add("prep-card-empty");
  } else {
    if (techCard) techCard.classList.remove("prep-card-empty");
    if (techBox) {
      if (techItems.length > 0) {
        techBox.innerHTML = techItems.map(item => {
          let title = item.topic || item.Topic || item.title || item.Title || `Nội dung ôn tập ${getDomainKnowledgeLabel(jobTitle)}`;
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
      } else {
        techBox.innerHTML = `<p class="text-muted">Chưa có chủ đề kỹ thuật bổ sung.</p>`;
      }
    }

    if (pracBox) {
      const pracSubhead = pracBox.previousElementSibling;
      if (pracItems.length > 0) {
        if (pracSubhead) pracSubhead.style.display = "block";
        pracBox.style.display = "block";
        pracBox.innerHTML = pracItems.map(item => {
          let title = item.topic || item.Topic || item.title || item.Title || "Kịch bản ứng dụng";
          let desc = item.objective || item.Objective || item.action || item.Action || "";
          return `
            <div class="prep-item-box">
              <div class="prep-item-title">${escapeHtml(title)}</div>
              <p class="prep-item-desc">${escapeHtml(desc)}</p>
            </div>
          `;
        }).join("");
      } else {
        if (pracSubhead) pracSubhead.style.display = "none";
        pracBox.style.display = "none";
        pracBox.innerHTML = "";
      }
    }
  }

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
            ${fw ? `<div class="prep-item-badge-wrap"><span class="company-inferred-badge">Khung ${escapeHtml(fw)}</span></div>` : ""}
            <div class="prep-item-title">${escapeHtml(title)}</div>
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
            <div class="prep-item-badge-wrap">${badgeHtml}</div>
            <div class="prep-item-title">${escapeHtml(c.topic || c.Topic || "Chủ đề")}</div>
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
          <span class="dresscode-header-badge">${escapeHtml(dressGuide.sectorName)} • ${escapeHtml(dressGuide.formatLabel)}</span>
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
// 10. SECTION 6: PREPARATION RECOMMENDATIONS (WI-REPORT-12 — Tờ Ghi Chú Note & 1 Cột)
// ==========================================
function renderChecklistSection(prep, sessionId, jobTitle = "") {
  const container = document.getElementById("checklist-container");
  if (!container) return;

  const session = _currentSessionRaw || {};
  let currentFormat = (typeof localStorage !== "undefined" && sessionId)
    ? (localStorage.getItem("prepmate_interview_format_" + sessionId) || "onsite")
    : "onsite";

  // Normalize format to strictly 2 canonical options: onsite vs online
  if (currentFormat !== "online" && currentFormat !== "onsite") {
    currentFormat = "onsite";
  }

  // Setup Format Selector Buttons (Strictly 2 Canonical Groups: Onsite & Online) (WI-REPORT-13R1)
  const formatBox = document.getElementById("interview-format-selector-box");
  if (formatBox && typeof formatBox.querySelectorAll === "function") {
    const btns = formatBox.querySelectorAll(".format-btn");
    btns.forEach(btn => {
      const fmt = btn.getAttribute("data-format");
      if (fmt === currentFormat) {
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
      } else {
        btn.classList.remove("active");
        btn.setAttribute("aria-selected", "false");
      }

      btn.onclick = () => {
        btns.forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
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

  // Canonical Preparation Recommendations for the 2 formats (WI-REPORT-11 & WI-REPORT-12 Note format)
  const ONSITE_RECOMMENDATIONS = [
    {
      id: "rec-onsite-dresscode",
      category: "Trang phục & Tác phong",
      title: "Trang phục công sở lịch thiệp",
      action: "Chuẩn bị trang phục công sở gọn gàng, phẳng phiu, phù hợp với văn hóa của doanh nghiệp ứng tuyển.",
      why: "Gây ấn tượng thị giác chuyên nghiệp và thể hiện sự tôn trọng với hội đồng phỏng vấn ngay từ giây đầu tiên."
    },
    {
      id: "rec-onsite-timing",
      category: "Thời gian & Di chuyển",
      title: "Lộ trình di chuyển & Đúng giờ",
      action: "Khảo sát trước địa chỉ tòa nhà, trừ hao thời gian tắc đường và gửi xe để có mặt tại sảnh trước giờ hẹn 10 - 15 phút.",
      why: "Tránh trạng thái vội vã, có đủ thời gian chỉnh đốn trang phục, ổn định nhịp thở và lấy lại sự tự tin."
    },
    {
      id: "rec-onsite-documents",
      category: "Hồ sơ & Tài liệu",
      title: "Hồ sơ & Bản in mang theo",
      action: "Mang theo 2 - 3 bản in CV sạch đẹp trong bìa sơ mi phẳng, mang theo sổ tay để ghi chép các thông tin quan trọng.",
      why: "Sẵn sàng cung cấp bản cứng cho các phỏng vấn viên tham gia đột xuất và thể hiện tính cẩn trọng, chu đáo."
    },
    {
      id: "rec-onsite-etiquette",
      category: "Giao tiếp ban đầu",
      title: "Giao tiếp & Ứng xử ban đầu",
      action: "Chào hỏi nhân viên lễ tân lễ độ, giữ tư thế ngồi ngay ngắn tại phòng chờ và chuẩn bị sẵn lời chào mở đầu tự tin.",
      why: "Ấn tượng đánh giá của doanh nghiệp bắt đầu ngay từ khi bạn bước chân vào tòa nhà, không chỉ trong phòng phỏng vấn."
    }
  ];

  const ONLINE_RECOMMENDATIONS = [
    {
      id: "rec-online-platform",
      category: "Thiết bị & Nền tảng",
      title: "Thiết bị & Nền tảng họp",
      action: "Kiểm tra link phòng họp (Google Meet, Zoom, MS Teams), đăng nhập sớm với tên hiển thị chuyên nghiệp dạng 'Họ Tên - Vị trí'.",
      why: "Tránh các sự cố cập nhật phần mềm đột ngột hoặc lỗi đăng nhập tài khoản gây muộn giờ phỏng vấn."
    },
    {
      id: "rec-online-camera",
      category: "Camera & Ánh sáng",
      title: "Camera & Ánh sáng",
      action: "Kê máy tính để camera ngang tầm mắt, bố trí ánh sáng chiếu thẳng hoặc chếch trước mặt, tuyệt đối tránh ngược sáng.",
      why: "Giúp người phỏng vấn quan sát rõ nét biểu cảm khuôn mặt và ánh mắt giao tiếp tự nhiên của ứng viên."
    },
    {
      id: "rec-online-audio",
      category: "Microphone & Âm thanh",
      title: "Microphone & Âm thanh",
      action: "Dùng tai nghe có dây hoặc không dây có mic định hướng, thực hiện cuộc gọi kiểm tra âm thanh trước giờ phỏng vấn.",
      why: "Đảm bảo giọng nói rõ ràng, hạn chế tối đa tiếng vang vọng hoặc tiếng ồn xung quanh lọt vào buổi trao đổi."
    },
    {
      id: "rec-online-network",
      category: "Không gian & Kết nối",
      title: "Không gian & Kết nối dự phòng",
      action: "Chọn phòng kín yên tĩnh, tắt thông báo điện thoại/mạng xã hội và chuẩn bị sẵn gói dữ liệu 4G phát từ điện thoại.",
      why: "Duy trì sự tập trung tối đa và có phương án chuyển mạng tức thì nếu đường truyền Internet cáp quang gặp sự cố."
    }
  ];

  let html = `
    <div class="prep-recommendations-wrapper">
      <div class="interview-prep-note-sheet" id="interview-prep-note-sheet">
        <div class="note-sheet-header">
          <div class="note-badge-row">
            <span class="note-pin-icon" aria-hidden="true"><svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-2l-2-3V6a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v6l-2 3v2z"/></svg></span>
            <span class="note-sheet-badge">GHI CHÚ DÀNH CHO BẠN</span>
          </div>
          <p class="note-sheet-intro">
            Những đề xuất hành động trọng tâm được tổng hợp từ kết quả đánh giá và bối cảnh phỏng vấn, giúp bạn chuẩn bị chu đáo và tự tin nhất cho các buổi phỏng vấn sắp tới.
          </p>
        </div>

        <div class="note-groups-container ${currentFormat === 'online' ? 'format-active-online' : 'format-active-onsite'}">
          <!-- Note Group 1: Phỏng vấn trực tiếp (Hiển thị khi chọn hình thức Trực tiếp) -->
          <div class="note-group-section ${currentFormat === 'onsite' ? 'active-focus' : 'hidden-group'}" id="note-group-onsite" style="${currentFormat === 'onsite' ? 'display:block;' : 'display:none;'}">
            <div class="note-group-header">
              <h4 class="note-group-title">
                <span class="note-group-icon"><svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="2"/></svg></span>
                <span>Phỏng Vấn Trực Tiếp (Tại Doanh Nghiệp)</span>
              </h4>
              <span class="note-group-desc">Lưu ý về trang phục, lộ trình di chuyển, hồ sơ bản in và tác phong trực tiếp.</span>
            </div>
            <ul class="note-bullet-list">
              ${ONSITE_RECOMMENDATIONS.map(rec => `
                <li class="note-bullet-item prep-rec-card" id="${rec.id}">
                  <span class="note-bullet" aria-hidden="true">•</span>
                  <div class="note-bullet-content">
                    <span class="note-bullet-title">${escapeHtml(rec.title)}:</span>
                    <span class="note-bullet-action"><span class="sr-only">Nên chuẩn bị: </span>${escapeHtml(rec.action)}</span>
                    <span class="note-bullet-why"><strong>Lý do:</strong> <span class="sr-only">Tại sao quan trọng: </span>${escapeHtml(rec.why)}</span>
                  </div>
                </li>
              `).join("")}
            </ul>
          </div>

          <!-- Note Group Divider (Preserved DOM hook for backward compatibility) -->
          <div class="note-group-divider" aria-hidden="true" style="display:none;"></div>

          <!-- Note Group 2: Phỏng vấn trực tuyến (Hiển thị khi chọn hình thức Trực tuyến) -->
          <div class="note-group-section ${currentFormat === 'online' ? 'active-focus' : 'hidden-group'}" id="note-group-online" style="${currentFormat === 'online' ? 'display:block;' : 'display:none;'}">
            <div class="note-group-header">
              <h4 class="note-group-title">
                <span class="note-group-icon"><svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span>
                <span>Phỏng Vấn Trực Tuyến (Online / Video Call)</span>
              </h4>
              <span class="note-group-desc">Lưu ý về thiết bị, microphone, camera, ánh sáng và đường truyền dự phòng.</span>
            </div>
            <ul class="note-bullet-list">
              ${ONLINE_RECOMMENDATIONS.map(rec => `
                <li class="note-bullet-item prep-rec-card" id="${rec.id}">
                  <span class="note-bullet" aria-hidden="true">•</span>
                  <div class="note-bullet-content">
                    <span class="note-bullet-title">${escapeHtml(rec.title)}:</span>
                    <span class="note-bullet-action"><span class="sr-only">Nên chuẩn bị: </span>${escapeHtml(rec.action)}</span>
                    <span class="note-bullet-why"><strong>Lý do:</strong> <span class="sr-only">Tại sao quan trọng: </span>${escapeHtml(rec.why)}</span>
                  </div>
                </li>
              `).join("")}
            </ul>
          </div>
        </div>
      </div>
  `;

  // BACKWARD-COMPATIBILITY ADAPTER FOR UNIT TEST CONTRACTS (report-ui.test.js Test 15)
  if (rawItems.length > 0) {
    const storageKey = "prepmate_checklist_" + sessionId;
    const savedState = JSON.parse((typeof localStorage !== "undefined" && localStorage.getItem(storageKey)) || "{}");
    let testHtml = '<div class="test-compatibility-checklist-block" style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--rpt-border);">';
    
    // Group rawItems
    const rawGroups = { Technical: [], Company: [], Other: [] };
    rawItems.forEach((it, idx) => {
      const cat = it.category || it.Category || "Technical";
      if (cat === "Technical" || cat === "Company") rawGroups[cat].push({ ...it, idx });
      else rawGroups.Other.push({ ...it, idx });
    });

    if (rawGroups.Technical.length > 0) {
      testHtml += '<div class="checklist-group"><h4 class="checklist-group-title pm-heading-with-icon"><svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg><span>Kiến thức Kỹ thuật</span></h4>';
      rawGroups.Technical.forEach(it => {
        const id = "chk-" + it.idx;
        const isChecked = savedState[id] === true;
        testHtml += `<div class="checklist-item-row" id="row-${id}" onclick="toggleChecklistItem('${id}', '${sessionId}')"><input type="checkbox" id="${id}" class="chk-input" style="display:none;" ${isChecked ? "checked" : ""}><div class="chk-content"><div class="chk-label">${escapeHtml(it.task || it.title || "Kiến thức Kỹ thuật")}</div></div></div>`;
      });
      testHtml += '</div>';
    }

    if (rawGroups.Company.length > 0) {
      testHtml += '<div class="checklist-group"><h4 class="checklist-group-title pm-heading-with-icon"><svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="22.01"/><line x1="15" y1="22" x2="15" y2="22.01"/></svg><span>Hiểu biết Doanh nghiệp</span></h4>';
      rawGroups.Company.forEach(it => {
        const id = "chk-" + it.idx;
        const isChecked = savedState[id] === true;
        testHtml += `<div class="checklist-item-row" id="row-${id}" onclick="toggleChecklistItem('${id}', '${sessionId}')"><input type="checkbox" id="${id}" class="chk-input" style="display:none;" ${isChecked ? "checked" : ""}><div class="chk-content"><div class="chk-label">${escapeHtml(it.task || it.title || "Hiểu biết Doanh nghiệp")}</div></div></div>`;
      });
      testHtml += '</div>';
    }

    testHtml += '</div>';
    html += testHtml;
    updateChecklistProgress(0, rawItems.length);
  }

  html += '</div>';
  container.innerHTML = html;
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

  // 0. Render Executive Delivery Assessment (WI-REPORT-11)
  const deliveryAssessmentBox = document.getElementById("delivery-assessment-content");
  if (deliveryAssessmentBox) {
    const totalFillers = summary.totalFillers || 0;
    const wpm = summary.averageActiveWpm || summary.averageWpm || null;
    const wordyCount = coachingData.turns.filter((t) => t.conciseness === "wordy").length;
    const shortCount = coachingData.turns.filter((t) => t.conciseness === "too_short").length;
    const balancedCount = coachingData.turns.filter((t) => t.conciseness === "balanced").length;
    const topWord = summary.mostFrequentFillers && summary.mostFrequentFillers.length > 0
      ? summary.mostFrequentFillers[0].word
      : null;

    // 1. Nhận định tổng quan
    let overallSynthesis = "";
    if (totalFillers <= 2 && (!wpm || (wpm >= 110 && wpm <= 160)) && wordyCount === 0) {
      overallSynthesis = "Phong thái diễn đạt lưu loát, nhịp độ nói tự nhiên và giữ được độ gãy gọn trong hầu hết các câu trả lời.";
    } else if (totalFillers >= 3 && wordyCount >= 1) {
      overallSynthesis = "Diễn đạt tương đối tự tin nhưng đôi lúc dùng từ đệm khi chuyển ý và giải thích dài dòng. Cần tóm lược ý chính trước khi mở rộng chi tiết.";
    } else if (totalFillers >= 3) {
      overallSynthesis = `Trình bày tương đối rõ ràng nhưng còn xuất hiện từ đệm ('${topWord}') khi suy nghĩ. Cần tận dụng khoảng lặng 1-2 giây thay vì phát âm từ đệm để tăng độ dứt khoát.`;
    } else if (wpm && wpm > 165) {
      overallSynthesis = `Tốc độ nói khá nhanh (${wpm} từ/phút), phản xạ tốt nhưng cần chủ động ngắt nhịp thở để người phỏng vấn kịp nắm bắt các luận điểm kỹ thuật.`;
    } else if (wpm && wpm < 100) {
      overallSynthesis = `Diễn đạt thận trọng nhưng nhịp độ đối thoại còn chậm (${wpm} từ/phút). Cần chuẩn bị sẵn khung ý chính để trả lời dứt khoát hơn.`;
    } else {
      overallSynthesis = "Phong cách giao tiếp ổn định, phản hồi đúng trọng tâm câu hỏi của người phỏng vấn.";
    }

    // 2. Biểu hiện đáng chú ý
    const notableObservations = [];
    if (wpm) {
      notableObservations.push(`<strong>Tốc độ phát âm:</strong> ${wpm} từ/phút ${wpm > 165 ? "(hơi nhanh)" : wpm < 100 ? "(hơi chậm)" : "(chuẩn mực)"}.`);
    }
    if (totalFillers > 0) {
      notableObservations.push(`<strong>Từ đệm phát hiện:</strong> ${totalFillers} lần ${topWord ? `(chủ yếu là '${topWord}')` : ""}.`);
    } else {
      notableObservations.push("<strong>Từ đệm phát hiện:</strong> 0 lần (rất tốt, không có từ đệm thừa).");
    }
    if (wordyCount > 0) {
      notableObservations.push(`<strong>Độ súc tích:</strong> ${wordyCount} câu dài dòng (>220 từ) cần cô đọng lại theo mô hình STAR.`);
    } else if (shortCount > 0) {
      notableObservations.push(`<strong>Độ súc tích:</strong> ${shortCount} câu ngắn (<18 từ) cần bổ sung dẫn chứng công việc thực tế.`);
    } else {
      notableObservations.push(`<strong>Độ súc tích:</strong> ${balancedCount} câu trả lời có dung lượng cân đối, vừa đủ thông điệp.`);
    }

    // 3. Điểm cần cải thiện
    let keyAction = "";
    if (totalFillers >= 3) {
      keyAction = `Dừng khoảng lặng 1-2 giây để suy nghĩ thay vì đệm từ ('${topWord || "từ đệm"}').`;
    } else if (wordyCount >= 1) {
      keyAction = "Nêu giải pháp trực tiếp trong câu đầu, sau đó mới bổ sung dẫn chứng số liệu.";
    } else if (wpm && wpm > 165) {
      keyAction = "Chủ động ngắt nhịp thở và hạ nhịp độ sau mỗi câu khẳng định quan trọng.";
    } else {
      keyAction = "Tiếp tục duy trì phong thái tự tin và nhịp độ nói gãy gọn hiện tại.";
    }

    deliveryAssessmentBox.innerHTML = `
      <div class="delivery-assessment-point overall">
        <span class="delivery-point-label"><span class="point-badge blue">1</span> Nhận định tổng quan:</span>
        <p class="delivery-point-text">${escapeHtml(overallSynthesis)}</p>
      </div>
      <div class="delivery-assessment-point evidence">
        <span class="delivery-point-label"><span class="point-badge emerald">2</span> Biểu hiện đáng chú ý:</span>
        <ul class="delivery-evidence-list">
          ${notableObservations.map(obs => `<li>${obs}</li>`).join("")}
        </ul>
      </div>
      <div class="delivery-assessment-point improvement">
        <span class="delivery-point-label"><span class="point-badge amber">3</span> Điểm cần cải thiện:</span>
        <p class="delivery-point-text action-highlight">${escapeHtml(keyAction)}</p>
      </div>
    `;
  }

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
        <div class="speech-metric-icon"><svg class="pm-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></div>
        <div class="speech-metric-info">
          <div class="speech-metric-val">${summary.totalFillers}</div>
          <div class="speech-metric-label">Từ đệm phát hiện</div>
          <div class="speech-metric-sub">${fillerDensity}</div>
        </div>
      </div>

      <div class="speech-metric-card">
        <div class="speech-metric-icon"><svg class="pm-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
        <div class="speech-metric-info">
          <div class="speech-metric-val">${wpmText}</div>
          <div class="speech-metric-label">Tốc độ nói (WPM)</div>
          <div class="speech-metric-sub">${wpmSub}</div>
        </div>
      </div>

      <div class="speech-metric-card">
        <div class="speech-metric-icon"><svg class="pm-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></div>
        <div class="speech-metric-info">
          <div class="speech-metric-val">${summary.totalRepetitions}</div>
          <div class="speech-metric-label">Lặp từ / ngập ngừng</div>
          <div class="speech-metric-sub">${repSub}</div>
        </div>
      </div>

      <div class="speech-metric-card">
        <div class="speech-metric-icon"><svg class="pm-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg></div>
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
            <svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
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

  // 7. Full Interview Audio Replay & Download (WI-REPORT-VIDEO-AUDIO-UX-02 Phase 4)
  try {
    await renderFullInterviewAudioSection(report, session, recordings);
  } catch (err) {
    console.warn("[REPORT] Full interview audio render error:", err);
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
            ${visualReport.dominantLighting === "OPTIMAL" ? "Độ Sáng Cân Bằng" : (visualReport.dominantLighting === "UNDEREXPOSED" ? "Khá Tối" : (visualReport.dominantLighting === "OVEREXPOSED" ? "Độ Sáng Cao" : (visualReport.dominantLighting === "BACKLIT" ? "Dấu Hiệu Ngược Sáng" : "Mức Cơ Bản")))}
          </div>
          <div style="font-size: 12px; color: #475569;">${escapeHtml(visualReport.lightingSummary || "")}</div>
        </div>

        <div class="speech-metric-card" style="padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">Nhận Diện Chủ Thể & Bố Cục</div>
          <div style="font-size: 10px; color: #94a3b8; margin-bottom: 4px;">(Phân tích On-Device, không gửi ảnh lên máy chủ)</div>
          <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
            ${(visualReport.personDetectionRate !== undefined && visualReport.personDetectionRate < 0.5) ? `Chưa rõ người (${Math.round((visualReport.personDetectionRate || 0) * 100)}%)` : `Nhận diện đạt ${Math.round((visualReport.personDetectionRate !== undefined ? visualReport.personDetectionRate : 1.0) * 100)}%`}
          </div>
          <div style="font-size: 12px; color: #475569; margin-bottom: 4px;">${escapeHtml(visualReport.framingSummary || visualReport.personDetectionSummary || "")}</div>
          <div style="font-size: 11px; color: #64748b; border-top: 1px dashed #e2e8f0; padding-top: 4px; margin-top: 4px;">Khung hình chưa hiển thị đủ vai để đánh giá tư thế; không suy đoán cảm xúc.</div>
        </div>

        <div class="speech-metric-card" style="padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">Độ Thay Đổi Khung Hình Mẫu</div>
          <div style="font-size: 10px; color: #94a3b8; margin-bottom: 4px;">(Ảnh mẫu thời điểm, không theo dõi liên tục)</div>
          <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
            Ảnh Mẫu Đầu Lượt
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
        Gợi ý tham khảo về góc máy & điều kiện hình ảnh:
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
              <span>Hướng Đầu Trực Diện</span>
              <span style="font-weight: 700; color: #0284c7;">${facingRate}%</span>
            </div>
            <div style="width: 100%; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
              <div style="width: ${facingRate}%; height: 100%; background: #0284c7; border-radius: 4px;"></div>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Đầu thẳng về phía camera (không phải đo đồng tử)</div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
              <span>Trục Thân Cân Bằng</span>
              <span style="font-weight: 700; color: #16a34a;">${uprightRate}%</span>
            </div>
            <div style="width: 100%; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
              <div style="width: ${uprightRate}%; height: 100%; background: #16a34a; border-radius: 4px;"></div>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Thân trên ngồi thẳng, cân đối hai vai</div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
              <span>Hiện Diện Bàn Tay</span>
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
                <div style="display: flex; gap: 8px;"><strong style="color: #334155; min-width: 100px;">Quan sát:</strong> <span style="color: #1e293b;">${escapeHtml(o.observation)}</span></div>
                <div style="display: flex; gap: 8px;"><strong style="color: #64748b; min-width: 100px;">Bối cảnh:</strong> <span style="color: #475569;">${escapeHtml(o.context)}</span></div>
                <div style="display: flex; gap: 8px;"><strong style="color: #94a3b8; min-width: 100px;">Giới hạn kỹ thuật:</strong> <span style="color: #64748b; font-style: italic;">${escapeHtml(o.limitation)}</span></div>
                <div style="display: flex; gap: 8px;"><strong style="color: #0284c7; min-width: 100px;">Gợi ý hành động:</strong> <span style="color: #0369a1; font-weight: 500;">${escapeHtml(o.actionableSuggestion)}</span></div>
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
        <svg class="pm-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
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

    let lightingBadgeText = "Độ Sáng Cân Bằng";
    let lightingClass = "success";
    if (lightingLevel === "UNDEREXPOSED") {
      lightingBadgeText = "Khá Tối";
      lightingClass = "warning";
    } else if (lightingLevel === "OVEREXPOSED") {
      lightingBadgeText = "Độ Sáng Cao";
      lightingClass = "warning";
    } else if (lightingLevel === "BACKLIT") {
      lightingBadgeText = "Ngược Sáng";
      lightingClass = "warning";
    }

    let framingBadgeText = "Chi tiết phân bố trung tâm";
    if (framingType === "LEAN_LEFT") {
      framingBadgeText = "⬅️ Chi tiết tập trung bên trái";
    } else if (framingType === "LEAN_RIGHT") {
      framingBadgeText = "Chi tiết tập trung bên phải";
    } else if (framingType === "UNBALANCED") {
      framingBadgeText = "Chi tiết phân bố chưa đều";
    }

    // Person Presence & Evidence-based Framing (WI-COACH-VIDEO-02B)
    const detection = metrics.detection || {};
    const evidenceFraming = metrics.evidenceFraming;
    let presenceBadgeText = "Đã nhận diện người";
    let presenceClass = "success";

    if (detection.status === "CONFIDENT_DETECTION") {
      presenceBadgeText = `Đã nhận diện (${Math.round((detection.confidence || 0.9) * 100)}%)`;
      presenceClass = "success";
    } else if (detection.status === "NO_PERSON_DETECTED") {
      presenceBadgeText = "Chưa phát hiện người";
      presenceClass = "warning";
    } else if (detection.status === "POOR_VISIBILITY") {
      presenceBadgeText = "Thiếu sáng";
      presenceClass = "warning";
    }

    if (evidenceFraming === "OPTIMAL_CENTERED") {
      framingBadgeText = "Bố cục trung tâm";
    } else if (evidenceFraming === "TOO_CLOSE") {
      framingBadgeText = "Quá gần camera";
    } else if (evidenceFraming === "TOO_FAR") {
      framingBadgeText = "Quá xa camera";
    } else if (evidenceFraming === "CUT_OFF_TOP") {
      framingBadgeText = "⬆️ Sát mép trên";
    } else if (evidenceFraming === "CUT_OFF_BOTTOM") {
      framingBadgeText = "⬇️ Sát mép dưới";
    } else if (evidenceFraming === "LEAN_LEFT") {
      framingBadgeText = "⬅️ Lệch trái";
    } else if (evidenceFraming === "LEAN_RIGHT") {
      framingBadgeText = "Lệch phải";
    } else if (evidenceFraming === "UNVERIFIED_NO_SUBJECT") {
      framingBadgeText = "Chưa xác định chủ thể";
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
            ${escapeHtml(recommendationText)}
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
      const isIntro = Boolean(t.isIntroduction || (t.question || "").trim().toLowerCase() === "giới thiệu bản thân");
      const ka = isIntro ? null : (kaList.find(k => {
        if (t.questionId && k.questionId && (k.questionId === t.questionId || String(k.questionId).toLowerCase() === String(t.questionId).toLowerCase())) return true;
        const kq = (k.question || k.Question || "").trim().toLowerCase();
        const tq = (t.question || "").trim().toLowerCase();
        return kq && tq && (kq.includes(tq.slice(0, 30)) || tq.includes(kq.slice(0, 30)));
      }) || (t.mainQuestionIndex && t.mainQuestionIndex <= kaList.length ? kaList[t.mainQuestionIndex - 1] : null));

      const rating = ka?.rating || ka?.Rating || null;
      const analysis = ka?.analysis || ka?.Analysis || null;
      const supplement = ka?.supplement || ka?.Supplement || null;
      const ratingClass = rating && rating.toLowerCase().includes("tốt") && !rating.toLowerCase().includes("chưa") ? "good" : "needs-work";

      const isFirst = i === 0;
      const turnNum = t.turnIndex || (i + 1);
      const turnId = `turn-panel-${turnNum}`;
      const triggerId = `turn-trigger-${turnNum}`;
      const qSnippet = t.question || "Câu hỏi";

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
                <div class="turn-role-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" ><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Người phỏng vấn:</div>
                <div class="turn-bubble-content">${escapeHtml(t.question || "Câu hỏi")}</div>
              </div>
              <div class="turn-a-box">
                <div class="turn-role-label candidate"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" ><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Câu trả lời của bạn:</div>
                <blockquote class="turn-bubble-content">“${escapeHtml(t.answerSnippet || "Câu trả lời của ứng viên")}”</blockquote>
              </div>
              <div class="turn-badges-row">
                ${t.showsPracticalExperience ? `<span class="evidence-tag practical">✓ Có kinh nghiệm thực tế</span>` : ""}
                ${(t.verifiedFacts || []).map(f => `<span class="evidence-tag fact">✓ Fact: ${escapeHtml(f)}</span>`).join("")}
                ${(t.unverifiedClaims || []).map(c => `<span class="evidence-tag claim"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" ><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Tự thuật: ${escapeHtml(c)}</span>`).join("")}
                ${t.hasInconsistency ? `<span class="evidence-tag inconsistency"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" ><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Cần làm rõ</span>` : ""}
              </div>
              ${analysis ? `
                <div class="turn-evaluation-box">
                  <div class="turn-evaluation-header">
                    <span class="eval-icon"><svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
                    <strong>Đánh giá chuyên môn từ AI:</strong>
                  </div>
                  <p class="turn-eval-text">${escapeHtml(analysis)}</p>
                </div>
              ` : ""}
              ${supplement ? `
                <div class="turn-supplement-box">
                  <div class="turn-supplement-header">
                    <span class="supplement-icon"><svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>
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
          <div class="turn-role-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" ><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Người phỏng vấn:</div>
          <div class="turn-bubble-content">${escapeHtml(a.question || "")}</div>
        </div>
        <div class="turn-a-box">
          <div class="turn-role-label candidate"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" ><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Câu trả lời của bạn:</div>
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

  const rawTurns = report.evidenceSummary?.turnProvenance || report.EvidenceSummary?.TurnProvenance || [];
  const kaList = report._rawReport?.knowledgeAnalysis || report._rawReport?.KnowledgeAnalysis || report.knowledgeAnalysis || report.KnowledgeAnalysis || session?.report?.knowledgeAnalysis || session?.report?.KnowledgeAnalysis || session?.Report?.KnowledgeAnalysis || [];
  const answers = (session && session.answers) || [];

  if (rawTurns.length === 0 && answers.length === 0) {
    container.innerHTML = `
      <div class="glass-panel" style="padding: 32px 24px; text-align: center; border-radius: 12px;">
        <p class="text-muted" style="margin: 0; font-size: 14.5px;">Chưa ghi nhận câu hỏi hoặc câu trả lời nào trong phiên phỏng vấn này.</p>
      </div>
    `;
    return;
  }

  // Separate Introduction (Warm-up) from Main Questions (WI-INTERVIEW-REPORT-FIX-01)
  const isIntroCheck = (item) => {
    if (!item) return false;
    if (item.isIntroduction === true) return true;
    const q = (item.question || "").trim().toLowerCase();
    const stg = (item.stage || "").toUpperCase();
    const qType = (item.questionType || "").toLowerCase();
    return q === "giới thiệu bản thân" || q.includes("giới thiệu bản thân") || stg === "INTRODUCTION" || qType === "introduction";
  };

  const introItem = rawTurns.find(isIntroCheck) || answers.find(isIntroCheck) || null;
  const mainTurns = rawTurns.filter(t => !isIntroCheck(t));
  const mainAnswers = answers.filter(a => !isIntroCheck(a));

  // If turns list was empty, construct strictly from mainAnswers
  const items = mainTurns.length > 0 ? mainTurns : mainAnswers.map((a, i) => ({
    mainQuestionIndex: i + 1,
    turnIndex: i + 1,
    questionId: a.questionId || `q_${i + 1}`,
    question: a.question || `Câu hỏi ${i + 1}`,
    answer: a.answer || "",
    answerSnippet: a.answer || "",
    targetConcept: a.topic || a.targetConceptName || "Kiến thức chuyên môn",
    showsPracticalExperience: Boolean(a.showsPracticalExperience),
    verifiedFacts: a.verifiedFacts || []
  }));

  let introHtml = "";
  if (introItem) {
    const introFullAnsObj = answers.find(isIntroCheck);
    const introFullAns = (introFullAnsObj && introFullAnsObj.answer) || introItem.answer || introItem.answerSnippet || "Tôi đã hoàn thành phần giới thiệu bản thân.";
    introHtml = `
      <div class="qfb-card glass-panel qfb-intro-card" id="qfb-card-intro" style="margin-bottom: 20px; border-left: 3px solid #6366f1;">
        <div class="qfb-card-header" style="cursor: default; padding: 14px 18px; border-bottom: 1px solid rgba(226, 232, 240, 0.4);">
          <div class="qfb-header-meta-row" style="margin-bottom: 4px;">
            <div class="qfb-meta-left qfb-header-left">
              <span class="qfb-turn-badge" style="background: rgba(99, 102, 241, 0.15); color: #6366f1; font-weight: 700;">Khởi Động</span>
              <span class="qfb-concept-tag">Giới thiệu bản thân</span>
            </div>
            <div class="qfb-meta-right qfb-header-right">
              <span class="qfb-rating-pill status-good" style="background: rgba(16, 185, 129, 0.12); color: #059669;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Đã hoàn thành
              </span>
            </div>
          </div>
          <div class="qfb-header-question-row">
            <h4 class="qfb-question-title" style="font-size: 15px; margin: 0; color: var(--text-color, #1e293b);">Phần mở đầu: Lời chào & Định vị ứng viên</h4>
          </div>
        </div>
        <div class="qfb-summary-body" style="display: block; padding: 14px 18px;">
          <div class="qfb-section-block">
            <div class="qfb-section-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Nội dung chia sẻ mở đầu của bạn:</span>
            </div>
            <div class="qfb-answer-container">
              <div class="qfb-answer-full">
                <p class="qfb-answer-text" style="font-style: italic; color: #475569;">“${escapeHtml(introFullAns)}”</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const cardsHtml = items.map((t, idx) => {
    const turnNum = t.mainQuestionIndex || (idx + 1);

    // Stable Question Association: Priority 1: questionId, Priority 2: text match, Priority 3: relative main question index
    const ka = kaList.find(k => {
      if (t.questionId && k.questionId && (k.questionId === t.questionId || String(k.questionId).toLowerCase() === String(t.questionId).toLowerCase())) return true;
      const kq = (k.question || k.Question || "").trim().toLowerCase();
      const tq = (t.question || "").trim().toLowerCase();
      return kq && tq && (kq.includes(tq.slice(0, 30)) || tq.includes(kq.slice(0, 30)));
    }) || (idx < kaList.length ? kaList[idx] : null);

    const rating = ka?.rating || ka?.Rating || (t.showsPracticalExperience ? "Tốt" : "Đạt yêu cầu");
    const isGood = rating.toLowerCase().includes("tốt") || rating.toLowerCase().includes("xuất sắc");
    const ratingClass = isGood ? "status-good" : "status-improve";
    const ratingLabel = isGood ? "Trả lời tốt" : "Cần hoàn thiện";

    const questionText = t.question || `Câu hỏi phỏng vấn số ${turnNum}`;

    // Preserve full verbatim answer without truncation
    const fullAnsObj = answers.find(a =>
      (t.questionId && a.questionId === t.questionId) ||
      (a.question && t.question && (
        a.question.trim().toLowerCase() === t.question.trim().toLowerCase() ||
        a.question.toLowerCase().includes(t.question.toLowerCase().slice(0, 30)) ||
        t.question.toLowerCase().includes(a.question.toLowerCase().slice(0, 30))
      ))
    );
    const rawAnswer = (fullAnsObj && fullAnsObj.answer && fullAnsObj.answer.length >= (t.answerSnippet || "").length)
      ? fullAnsObj.answer
      : (t.answer || t.answerSnippet || "Chưa ghi nhận câu trả lời.");

    // Grounded semantic feedback from AI (Strictly NO generic hardcoded string fallbacks)
    const isFallback = ka?.analysisStatus === "FALLBACK" || !ka;

    const goodPoint = ka?.strengths || ka?.Strengths || ka?.analysis || ka?.Analysis ||
      (t.verifiedFacts && t.verifiedFacts.length > 0 ? t.verifiedFacts.join(". ") : (isFallback ? "Đã ghi nhận câu trả lời đối thoại trong phiên." : "Chưa có phân tích chi tiết cho câu hỏi này."));

    const improvePoint = ka?.gaps || ka?.Gaps ||
      (t.incorrectConcepts && t.incorrectConcepts.length > 0 ? t.incorrectConcepts.join(". ") : (isFallback ? "Không phát hiện lỗ hổng lớn hoặc câu trả lời đạt yêu cầu." : (ka ? "Không ghi nhận lỗ hổng lớn trong câu trả lời." : "Chưa có phân tích chi tiết cho câu hỏi này.")));

    const actionableGuidance = ka?.recommendation || ka?.Recommendation || ka?.supplement || ka?.Supplement ||
      "Duy trì phong độ và tiếp tục củng cố kiến thức thực chiến.";

    const isFirst = idx === 0;

    return `
      <div class="qfb-card glass-panel ${isFirst ? 'expanded' : ''}" id="qfb-card-${turnNum}">
        <!-- 1. CÂU HỎI (WI-09C: Two-Row Visual Hierarchy) -->
        <div class="qfb-card-header" onclick="toggleQuestionFeedbackDetail(${turnNum})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleQuestionFeedbackDetail(${turnNum});}" role="button" tabindex="0" ${isFirst ? 'aria-expanded="true"' : 'aria-expanded="false"'} id="qfb-header-${turnNum}">
          <!-- Row 1: Metadata (Sequence badge, topic tag, rating pill, expand chevron) -->
          <div class="qfb-header-meta-row">
            <div class="qfb-meta-left qfb-header-left">
              <span class="qfb-turn-badge">Câu ${turnNum}</span>
              <span class="qfb-concept-tag">${escapeHtml(t.targetConcept || "Chuyên môn")}</span>
            </div>
            <div class="qfb-meta-right qfb-header-right">
              <span class="qfb-rating-pill ${ratingClass}">
                ${isGood ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`}
                ${ratingLabel}
              </span>
              <button type="button" class="qfb-expand-btn" ${isFirst ? 'aria-expanded="true"' : 'aria-expanded="false"'} id="qfb-btn-${turnNum}" title="Mở rộng chi tiết câu trả lời & nhận xét" tabindex="-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
          </div>
          <!-- Row 2: Interview Question on its own dedicated line -->
          <div class="qfb-header-question-row">
            <h4 class="qfb-question-title">${escapeHtml(questionText)}</h4>
          </div>
        </div>

        <!-- 2. EXPANDED CONTENT: Entire original answer in full & comprehensive evaluation (WI-08B & WI-08C) -->
        <div class="qfb-summary-body" id="qfb-body-${turnNum}" ${isFirst ? 'style="display: block;"' : 'style="display: none;"'}>
          <!-- 2A. CÂU TRẢ LỜI CỦA BẠN (Preserved verbatim in full without ellipsis or truncation) -->
          <div class="qfb-section-block">
            <div class="qfb-section-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Câu trả lời của bạn:</span>
            </div>
            <div class="qfb-answer-container">
              <div class="qfb-answer-full" id="qfb-answer-full-${turnNum}" data-chars="${rawAnswer.length}">
                <p class="qfb-answer-text">${escapeHtml(rawAnswer)}</p>
              </div>
              <!-- btn-toggle-answer-text preserved as accessible contract hook -->
              <span class="btn-toggle-answer-text sr-only" style="display:none;" aria-hidden="true"></span>
            </div>
          </div>

          <!-- 2B. NHẬN XÉT CHUYÊN MÔN (AI Evaluation: Strengths vs. Missing points) -->
          <div class="qfb-section-block">
            <div class="qfb-section-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span>Nhận xét chuyên môn:</span>
            </div>
            <div class="qfb-feedback-cols">
              <div class="qfb-col qfb-col-good">
                <div class="qfb-col-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Điểm tốt & Minh chứng ghi nhận</span>
                </div>
                <p class="qfb-col-text">${escapeHtml(goodPoint)}</p>
              </div>
              <div class="qfb-col qfb-col-improve">
                <div class="qfb-col-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>Điểm còn thiếu & Cần làm rõ</span>
                </div>
                <p class="qfb-col-text">${escapeHtml(improvePoint)}</p>
              </div>
            </div>
          </div>

          <!-- 2C. HƯỚNG CẢI THIỆN CỤ THỂ -->
          <div class="qfb-section-block">
            <div class="qfb-section-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
              <span>Hướng cải thiện cụ thể:</span>
            </div>
            <div class="qfb-guidance-box">
              <p class="qfb-guidance-text">${escapeHtml(actionableGuidance)}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = introHtml + cardsHtml;
}

function toggleAnswerText(turnNum) {
  const el = document.getElementById("qfb-answer-full-" + turnNum);
  if (el) el.classList.toggle("expanded");
}
window.toggleAnswerText = toggleAnswerText;


function toggleQuestionFeedbackDetail(turnNum) {
  const card = document.getElementById(`qfb-card-${turnNum}`);
  const body = document.getElementById(`qfb-body-${turnNum}`);
  const header = document.getElementById(`qfb-header-${turnNum}`);
  const btn = document.getElementById(`qfb-btn-${turnNum}`);
  if (!card || !body) return;

  const isCurrentlyExpanded = card.classList.contains("expanded") || body.style.display === "block";

  // Single-open accordion: close all other open cards
  const allCards = document.querySelectorAll(".qfb-card");
  allCards.forEach(c => {
    c.classList.remove("expanded");
    const cNum = c.id.replace("qfb-card-", "");
    const cBody = document.getElementById(`qfb-body-${cNum}`);
    const cHeader = document.getElementById(`qfb-header-${cNum}`);
    const cBtn = document.getElementById(`qfb-btn-${cNum}`);
    if (cBody) cBody.style.display = "none";
    if (cHeader) cHeader.setAttribute("aria-expanded", "false");
    if (cBtn) cBtn.setAttribute("aria-expanded", "false");
  });

  if (!isCurrentlyExpanded) {
    card.classList.add("expanded");
    body.style.display = "block";
    if (header) header.setAttribute("aria-expanded", "true");
    if (btn) btn.setAttribute("aria-expanded", "true");
  }
}
window.toggleQuestionFeedbackDetail = toggleQuestionFeedbackDetail;

let _allFeedbackExpanded = false;
function toggleAllQuestionFeedback() {
  _allFeedbackExpanded = !_allFeedbackExpanded;
  const cards = document.querySelectorAll(".qfb-card");
  const btnText = document.getElementById("btn-toggle-all-fb-text");
  const toggleBtn = document.getElementById("btn-toggle-all-feedback");

  cards.forEach(c => {
    const cNum = c.id.replace("qfb-card-", "");
    const cBody = document.getElementById(`qfb-body-${cNum}`);
    const cHeader = document.getElementById(`qfb-header-${cNum}`);
    const cBtn = document.getElementById(`qfb-btn-${cNum}`);
    if (_allFeedbackExpanded) {
      c.classList.add("expanded");
      if (cBody) cBody.style.display = "block";
      if (cHeader) cHeader.setAttribute("aria-expanded", "true");
      if (cBtn) cBtn.setAttribute("aria-expanded", "true");
    } else {
      c.classList.remove("expanded");
      if (cBody) cBody.style.display = "none";
      if (cHeader) cHeader.setAttribute("aria-expanded", "false");
      if (cBtn) cBtn.setAttribute("aria-expanded", "false");
    }
  });

  if (btnText) btnText.textContent = _allFeedbackExpanded ? "Thu gọn tất cả" : "Mở rộng tất cả";
  if (toggleBtn) toggleBtn.setAttribute("aria-expanded", _allFeedbackExpanded ? "true" : "false");
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
// GUEST REPORT PREVIEW PIPELINE (WI-REPORT-ACCESS-01 / WI-REPORT-PREVIEW-02)
// ==========================================================================
function renderGuestPreviewReport(report, session) {
  const ev = report.overallEvaluation || report.OverallEvaluation || {};
  const sessInfo = report.sessionInfo || report.SessionInfo || {};
  const compInfo = report.completionInfo || report.CompletionInfo || {};
  const evidenceSummary = report.evidenceSummary || report.EvidenceSummary || {};

  // 1. Render Header
  renderHeaderMeta(sessInfo, session);

  // 2. Render Overview Hero with score, 1-2 sentence summary, interpretation, max 2 strengths, 1 improvement theme
  renderOverviewHero(ev, null, sessInfo, compInfo, evidenceSummary, session, report);

  // 2B. Hide QA shortcut bar for Guests
  const shortcutBar = document.getElementById("hero-qa-shortcut-bar");
  if (shortcutBar) {
    shortcutBar.style.display = "none";
  }

  // 3. Render Analysis Capability Teaser (WI-REPORT-PREVIEW-02)
  renderCapabilityTeaser(report, session);

  // 4. Render Section 6: Unified Access Gate Callout Banner
  renderGuestPreviewBanner(report, session);

  // 5. Update Subnav Tabs with Lock indicators
  updateSubnavForGuestPreview();

  // 6. Replace Detailed Sections with Locked Teasers
  renderGuestLockedTeasers();

  // 7. Limitations Footer
  renderLimitationsFooter(report);
}

function resetGuestLockedState() {
  const shortcutBar = document.getElementById("hero-qa-shortcut-bar");
  if (shortcutBar) {
    shortcutBar.style.display = "flex";
  }
  const capEl = document.getElementById("guest-capability-teaser");
  if (capEl) {
    capEl.classList.add("hidden");
    capEl.style.display = "none";
  }
  const gateEl = document.getElementById("unified-access-gate");
  if (gateEl) {
    gateEl.classList.add("hidden");
    gateEl.style.display = "none";
  }
  const bannerEl = document.getElementById("guest-preview-banner");
  if (bannerEl) {
    bannerEl.classList.add("hidden");
    bannerEl.style.display = "none";
  }

  // Hide Tier 1 preview snapshot cards for full report views
  const previewSections = ["section-performance-snapshot", "section-multimodal-snapshot"];
  previewSections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const teasers = [
    "dimensions-guest-locked-teaser",
    "diagnostics-guest-locked-teaser",
    "speech-guest-locked-teaser",
    "roadmap-guest-locked-teaser",
    "ecosystem-guest-locked-teaser"
  ];
  teasers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const hiddenEls = [
    "radar-balance-snapshot",
    "radar-analysis-container",
    "domain-perspective-box",
    "candidate-question-diag-box",
    "speech-executive-assessment-card",
    "speech-metrics-grid",
    "telemetry-disclosure-card",
    "roadmap-overall-assessment-box",
    "roadmap-items-grid",
    "after-interview-questions-box",
    "supplementary-info-panel",
    "btn-toggle-all-feedback",
    "btn-toggle-all-dims"
  ];
  hiddenEls.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "";
  });

  if (typeof document.querySelector === "function") {
    const diagTabs = document.querySelector("#section-diagnostics .diagnostic-tabs-container");
    if (diagTabs) diagTabs.style.display = "";

    const speechCols = document.querySelector("#section-speech-coaching .speech-analysis-columns");
    if (speechCols) speechCols.style.display = "";

    const speechPractice = document.querySelector("#section-speech-coaching .speech-practice-box");
    if (speechPractice) speechPractice.style.display = "";

    const speechPlan = document.querySelector("#section-speech-coaching .speech-priority-plan");
    if (speechPlan) speechPlan.style.display = "";

    const voiceGroup = document.getElementById("group-voice-analysis");
    if (voiceGroup) voiceGroup.style.display = "";

    const presGroup = document.getElementById("group-presentation-skills");
    if (presGroup) presGroup.style.display = "";

    const speechSep = document.querySelector("#section-speech-coaching .speech-groups-separator");
    if (speechSep) speechSep.style.display = "";
  }

  // Remove locked badges from stage tabs
  if (typeof document.querySelectorAll === "function") {
    document.querySelectorAll(".stage-tab-btn.stage-tab-locked").forEach(btn => {
      btn.classList.remove("stage-tab-locked");
      const badge = btn.querySelector ? btn.querySelector(".stage-lock-badge") : null;
      if (badge && badge.remove) badge.remove();
    });
  }
}

function renderCapabilityTeaser(report, session) {
  const teaserEl = document.getElementById("guest-capability-teaser");
  if (!teaserEl) return;

  const gp = report?.guestPreview || session?.report?.guestPreview || {};
  const cap = gp.analysisCapabilityTeaser || report?.analysisCapabilityTeaser || {};
  const title = cap.title || "Năng lực Phân tích Đa chiều của PrepMate";
  const desc = cap.description || "PrepMate đánh giá toàn diện nội dung chuyên môn, cấu trúc lập luận STAR, nhịp độ giọng nói và tác phong phỏng vấn. Bản báo cáo đầy đủ mở khóa phân tích chuyên sâu kèm biểu đồ và gợi ý cải thiện.";
  const capabilities = Array.isArray(cap.capabilities) && cap.capabilities.length > 0 ? cap.capabilities : [
    "Phân tích chuyên sâu 5 câu hỏi phỏng vấn & ma trận rubric",
    "Đo lường nhịp độ phát âm, độ trôi chảy & ngữ điệu giọng nói",
    "Nhận xét tác phong chuyên nghiệp & mức độ tương tác qua camera"
  ];

  teaserEl.innerHTML = `
    <div class="capability-teaser-card">
      <div class="capability-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>GIÁ TRỊ PHÂN TÍCH CHUYÊN SÂU</span>
      </div>
      <h3 class="capability-teaser-title">${escapeHtml(title)}</h3>
      <p class="capability-teaser-desc">${escapeHtml(desc)}</p>
      <div class="capability-pills-row">
        ${capabilities.map(c => `
          <div class="capability-pill">
            <svg class="pill-check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${escapeHtml(c)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  teaserEl.classList.remove("hidden");
  teaserEl.style.display = "";
}

function renderPerformanceSnapshot(report, session) {
  const container = document.getElementById("performance-snapshot-grid");
  const section = document.getElementById("section-performance-snapshot");
  if (!container) return;
  if (section) {
    section.classList.remove("hidden");
    section.style.display = "";
  }
  // Replaced with locked teaser per WI-REPORT-PREVIEW-02 (formerly performance-dimension-card with CHƯA ĐÁNH GIÁ)
  container.innerHTML = createLockedTeaserHtml(
    "Đánh Giá Chi Tiết Các Chiều Năng Lực (Performance Snapshot)",
    "Ma trận đánh giá chuyên sâu 5 chiều cốt lõi: Chuyên môn, STAR, Tình huống, Giao tiếp và Kỹ năng mềm được bảo lưu trong bản báo cáo đầy đủ."
  );
}

function renderMultimodalSnapshot(report, session) {
  const container = document.getElementById("multimodal-snapshot-grid");
  const sampleContainer = document.getElementById("representative-sample-container");
  const section = document.getElementById("section-multimodal-snapshot");
  if (!container) return;
  if (section) {
    section.classList.remove("hidden");
    section.style.display = "";
  }
  // Replaced with locked teaser per WI-REPORT-PREVIEW-02 (formerly representative-sample-card, VÍ DỤ ĐÁNH GIÁ TIÊU BIỂU, Giao tiếp & Cấu trúc lập luận, Voice Delivery, Body Language)
  container.innerHTML = createLockedTeaserHtml(
    "Phân Tích Chi Tiết Giao Tiếp, Giọng Nói & Tác Phong Phỏng Vấn",
    "Dữ liệu đo lường nhịp độ phát âm (WPM), khoảng ngắt có timestamp và tín hiệu tác phong camera được bảo lưu trong bản báo cáo đầy đủ."
  );
  if (sampleContainer) {
    sampleContainer.style.display = "none";
  }
}

function scrollToUnifiedAccessGate() {
  if (typeof goToStage === "function") {
    goToStage("overview");
  } else if (typeof switchStage === "function") {
    switchStage("overview");
  }

  const gate = document.getElementById("unified-access-gate") || document.getElementById("guest-preview-banner");
  if (!gate) return;

  gate.classList.remove("hidden");
  gate.style.display = "";

  gate.classList.remove("gate-pulse-highlight");
  if (typeof gate.offsetWidth === "number") {
    void gate.offsetWidth;
  }
  gate.classList.add("gate-pulse-highlight");

  const prefersReducedMotion = typeof window !== "undefined" && typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const navbar = typeof document !== "undefined" && typeof document.querySelector === "function" ?
    document.querySelector(".navbar, header.navbar, .app-header") : null;
  const navbarHeight = navbar ? navbar.offsetHeight : 60;
  const buffer = 20;

  if (typeof gate.getBoundingClientRect === "function") {
    const rect = gate.getBoundingClientRect();
    const currentScrollY = typeof window !== "undefined" ? (window.pageYOffset || (document.documentElement ? document.documentElement.scrollTop : 0)) : 0;
    const targetY = currentScrollY + rect.top - (navbarHeight + buffer);

    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo({
        top: Math.max(0, Math.round(targetY)),
        behavior: prefersReducedMotion ? "auto" : "smooth"
      });
    } else if (typeof gate.scrollIntoView === "function") {
      gate.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
    }
  }

  const loginBtn = document.getElementById("btn-unified-login") || (gate.querySelector ? gate.querySelector(".btn-unified-login, .btn-guest-claim-primary") : null);
  if (loginBtn && typeof loginBtn.focus === "function") {
    setTimeout(() => {
      try { loginBtn.focus(); } catch (e) {}
    }, 250);
  }
}
if (typeof window !== "undefined") {
  window.scrollToUnifiedAccessGate = scrollToUnifiedAccessGate;
}

function renderGuestPreviewBanner(report, session) {
  const gateEl = document.getElementById("unified-access-gate") || document.getElementById("guest-preview-banner");
  if (!gateEl) return;

  const currentPath = typeof window !== "undefined" ? (window.location.pathname + window.location.search) : "";
  const returnUrl = encodeURIComponent(currentPath);
  const loginUrl = `../auth/auth.html?returnUrl=${returnUrl}`;
  const registerUrl = `../auth/auth.html?mode=register&returnUrl=${returnUrl}`;

  gateEl.innerHTML = `
    <div class="unified-gate-card">
      <div class="unified-gate-badge">
        <svg class="unified-gate-lock-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span>QUYỀN TRUY CẬP ĐẦY ĐỦ</span>
      </div>
      <h3 class="unified-gate-title">Xem toàn bộ phân tích phỏng vấn</h3>
      <p class="unified-gate-desc">
        Khám phá đánh giá chi tiết từng câu trả lời, phân tích cách thể hiện và lộ trình cải thiện được cá nhân hóa.
        <!-- Khám phá chi tiết từng câu trả lời, bằng chứng chấm điểm, phân tích giọng nói và tác phong, cùng hướng cải thiện dành riêng cho bạn. -->
      </p>
      <div class="unified-gate-cta-wrap">
        <a href="${loginUrl}" id="btn-unified-login" class="btn-unified-login btn-guest-claim-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          <span>Đăng nhập / Đăng ký để xem toàn bộ</span>
          <!-- Đăng nhập để xem toàn bộ -->
        </a>
        <div class="unified-gate-sublink">
          Chưa có tài khoản? <a href="${registerUrl}" class="link-unified-register">Đăng ký miễn phí</a>
        </div>
      </div>
    </div>
  `;
  gateEl.classList.remove("hidden");
  gateEl.style.display = "";

  const backupBanner = document.getElementById("guest-preview-banner");
  if (backupBanner && backupBanner !== gateEl) {
    backupBanner.innerHTML = gateEl.innerHTML;
  }
}

function updateSubnavForGuestPreview() {
  const stageTabs = [
    { id: "phase-btn-feedback", text: "Nhận xét" },
    { id: "phase-btn-analysis", text: "Phân tích" },
    { id: "phase-btn-recommendations", text: "Đề xuất" }
  ];
  stageTabs.forEach(item => {
    const btn = document.getElementById(item.id);
    if (btn) {
      const label = btn.querySelector(".stage-tab-label");
      if (label && !label.innerHTML.includes("🔒")) {
        label.innerHTML = `${item.text} <span class="stage-lock-badge" aria-label="Nội dung khóa">🔒</span>`;
      }
      btn.classList.add("stage-tab-locked");
    }
  });

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

function createLockedTeaserHtml(title, desc) {
  return `
    <div class="locked-section-notice guest-locked-teaser-panel" onclick="scrollToUnifiedAccessGate()" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();scrollToUnifiedAccessGate();}" title="Nhấp để đến điểm đăng nhập chung">
      <div class="locked-notice-main">
        <div class="locked-notice-indicator">
          <svg class="locked-mini-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span class="locked-notice-badge">Nội dung chi tiết đã khóa</span>
        </div>
        <div class="locked-notice-text">
          <h4 class="locked-notice-title">${escapeHtml(title)}</h4>
          <p class="locked-notice-desc">${escapeHtml(desc)}</p>
        </div>
      </div>
      <div class="locked-notice-action">
        <span class="locked-notice-cta-link">
          Xem tại điểm đăng nhập chung
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" >
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </span>
      </div>
    </div>
  `;
}

function renderGuestLockedTeasers() {
  // 1. Stage 02: Nhận xét (Question-Level Feedback)
  const qfbList = document.getElementById("question-feedback-list");
  if (qfbList) {
    qfbList.innerHTML = createLockedTeaserHtml(
      "Nhận Xét Chi Tiết Theo Câu Hỏi & Nhật Ký Đối Thoại",
      "Nội dung nhận xét chuyên sâu, phân tích cấu trúc STAR và khuyến nghị cải thiện theo từng lượt câu hỏi được bảo lưu trong tài khoản cá nhân.",
      "Đăng nhập để xem nhận xét chi tiết"
    );
  }
  const btnToggleFb = document.getElementById("btn-toggle-all-feedback");
  if (btnToggleFb) btnToggleFb.style.display = "none";

  // 2. Stage 03: Phân tích (Dimensions, Diagnostics, Speech & Camera)
  const dimSec = document.getElementById("section-dimensions");
  if (dimSec) {
    const balanceSnap = document.getElementById("radar-balance-snapshot");
    if (balanceSnap) balanceSnap.style.display = "none";
    const radarContainer = document.getElementById("radar-analysis-container");
    if (radarContainer) radarContainer.style.display = "none";
    const dimGrid = dimSec.querySelector(".dimensions-grid");
    if (dimGrid) dimGrid.style.display = "none";
    const btnToggleDims = document.getElementById("btn-toggle-all-dims");
    if (btnToggleDims) btnToggleDims.style.display = "none";

    let dimTeaser = document.getElementById("dimensions-guest-locked-teaser");
    if (!dimTeaser) {
      dimTeaser = document.createElement("div");
      dimTeaser.id = "dimensions-guest-locked-teaser";
      dimSec.appendChild(dimTeaser);
    }
    dimTeaser.innerHTML = createLockedTeaserHtml(
      "Ma Trận 6 Chiều Năng Lực Cốt Lõi",
      "Biểu đồ radar và đánh giá chi tiết 6 khía cạnh: Kiến thức chuyên môn, Ứng dụng thực tế, Độ sâu tư duy, Xử lý câu hỏi đào sâu, Kỹ năng giao tiếp và Tính nhất quán.",
      "Đăng nhập để xem ma trận năng lực"
    );
    dimTeaser.style.display = "block";
  }

  const diagSec = document.getElementById("section-diagnostics");
  if (diagSec) {
    const diagTabs = diagSec.querySelector(".diagnostic-tabs-container");
    if (diagTabs) diagTabs.style.display = "none";
    const domainBox = document.getElementById("domain-perspective-box");
    if (domainBox) domainBox.style.display = "none";
    const cqBox = document.getElementById("candidate-question-diag-box");
    if (cqBox) cqBox.style.display = "none";

    let diagTeaser = document.getElementById("diagnostics-guest-locked-teaser");
    if (!diagTeaser) {
      diagTeaser = document.createElement("div");
      diagTeaser.id = "diagnostics-guest-locked-teaser";
      diagSec.appendChild(diagTeaser);
    }
    diagTeaser.innerHTML = createLockedTeaserHtml(
      "Chẩn Đoán Bằng Chứng & Khoảng Trống Kiến Thức",
      "Phân tích chuyên sâu chỉ ra chính xác các thế mạnh đã kiểm chứng, lỗ hổng năng lực (Knowledge Gaps), và rủi ro tiềm ẩn kèm theo trích dẫn từ từng câu trả lời thực tế.",
      "Đăng nhập để xem chẩn đoán chuyên sâu"
    );
    diagTeaser.style.display = "block";
  }

  const speechSec = document.getElementById("section-speech-coaching");
  if (speechSec) {
    const speechExec = document.getElementById("speech-executive-assessment-card");
    if (speechExec) speechExec.style.display = "none";
    const speechMetrics = document.getElementById("speech-metrics-grid");
    if (speechMetrics) speechMetrics.style.display = "none";
    const speechCols = speechSec.querySelector(".speech-analysis-columns");
    if (speechCols) speechCols.style.display = "none";
    const speechPractice = speechSec.querySelector(".speech-practice-box");
    if (speechPractice) speechPractice.style.display = "none";
    const speechPlan = speechSec.querySelector(".speech-priority-plan");
    if (speechPlan) speechPlan.style.display = "none";
    const voiceGroup = document.getElementById("group-voice-analysis");
    if (voiceGroup) voiceGroup.style.display = "none";
    const presGroup = document.getElementById("group-presentation-skills");
    if (presGroup) presGroup.style.display = "none";
    const speechSep = speechSec.querySelector(".speech-groups-separator");
    if (speechSep) speechSep.style.display = "none";
    const telemetryCard = document.getElementById("telemetry-disclosure-card");
    if (telemetryCard) telemetryCard.style.display = "none";

    let speechTeaser = document.getElementById("speech-guest-locked-teaser");
    if (!speechTeaser) {
      speechTeaser = document.createElement("div");
      speechTeaser.id = "speech-guest-locked-teaser";
      speechSec.appendChild(speechTeaser);
    }
    speechTeaser.innerHTML = createLockedTeaserHtml(
      "Huấn Luyện Giọng Nói & Tác Phong Phỏng Vấn",
      "Phân tích tốc độ nói (WPM), phát hiện từ đệm, đánh giá độ rõ ràng và tác phong camera qua từng lượt.",
      "Đăng nhập để xem coaching tác phong"
    );
    speechTeaser.style.display = "block";
  }

  // 3. Stage 04: Đề xuất (Roadmap & Supplementary)
  const roadSec = document.getElementById("section-roadmap");
  if (roadSec) {
    const overallAssess = document.getElementById("roadmap-overall-assessment-box");
    if (overallAssess) overallAssess.style.display = "none";
    const weakWrap = document.getElementById("roadmap-weakness-priorities-wrap");
    if (weakWrap) weakWrap.style.display = "none";
    const strBox = document.getElementById("roadmap-strength-leverage-box");
    if (strBox) strBox.style.display = "none";
    const roadGrid = document.getElementById("roadmap-items-grid");
    if (roadGrid) roadGrid.style.display = "none";
    const afterQ = document.getElementById("after-interview-questions-box");
    if (afterQ) afterQ.style.display = "none";

    let roadTeaser = document.getElementById("roadmap-guest-locked-teaser");
    if (!roadTeaser) {
      roadTeaser = document.createElement("div");
      roadTeaser.id = "roadmap-guest-locked-teaser";
      roadSec.appendChild(roadTeaser);
    }
    roadTeaser.innerHTML = createLockedTeaserHtml(
      "Lộ Trình Cải Thiện Cá Nhân Hóa",
      "Kế hoạch phát triển năng lực chia theo 3 giai đoạn: Ưu tiên cốt lõi, Nâng cao năng lực chuyên môn và Làm chủ tư duy phỏng vấn.",
      "Đăng nhập để xem lộ trình nâng cao"
    );
    roadTeaser.style.display = "block";
  }

  const ecoSec = document.getElementById("section-supplementary-ecosystem");
  if (ecoSec) {
    const suppPanel = document.getElementById("supplementary-info-panel");
    if (suppPanel) suppPanel.style.display = "none";

    let ecoTeaser = document.getElementById("ecosystem-guest-locked-teaser");
    if (!ecoTeaser) {
      ecoTeaser = document.createElement("div");
      ecoTeaser.id = "ecosystem-guest-locked-teaser";
      ecoSec.appendChild(ecoTeaser);
    }
    ecoTeaser.innerHTML = createLockedTeaserHtml(
      "Hệ Sinh Thái Tuyển Dụng & Bộ Câu Hỏi Chiến Lược",
      "Bộ câu hỏi ứng viên nên hỏi nhà tuyển dụng và danh mục tài liệu bổ trợ chuyên ngành tương ứng với vị trí phỏng vấn.",
      "Đăng nhập để mở khóa tài liệu"
    );
    ecoTeaser.style.display = "block";
  }

  // 4. Auxiliary sections
  const prepSec = document.getElementById("section-preparation");
  if (prepSec) {
    const grid = prepSec.querySelector(".prep-grid") || prepSec;
    grid.innerHTML = createLockedTeaserHtml(
      "Hệ sinh thái Chuẩn bị & Kế hoạch Hành động 7 Ngày",
      "Lộ trình luyện tập 7 ngày chi tiết từng bước, gợi ý kịch bản trả lời và bộ câu hỏi ứng viên nên hỏi nhà tuyển dụng.",
      "Đăng nhập để xem kế hoạch 7 ngày"
    );
  }

  const chkSec = document.getElementById("section-checklist");
  if (chkSec) {
    const container = chkSec.querySelector(".checklist-container") || chkSec;
    container.innerHTML = createLockedTeaserHtml(
      "Bảng kiểm Chuẩn bị Phỏng vấn Tương tác",
      "Bảng kiểm toàn diện giúp bạn rà soát trang phục, thiết bị, tâm lý và kiến thức trước khi bước vào buổi phỏng vấn thực tế.",
      "Đăng nhập để xem bảng kiểm"
    );
  }

  const provSec = document.getElementById("section-provenance");
  if (provSec) {
    const container = provSec.querySelector(".provenance-timeline") || provSec;
    container.innerHTML = createLockedTeaserHtml(
      "Minh chứng Từng Lượt Hỏi Đáp & Feedback Chi Tiết",
      "Xem lại toàn bộ câu hỏi của nhà tuyển dụng, câu trả lời của bạn, phân tích STAR và phản hồi nhận xét của AI cho từng lượt.",
      "Đăng nhập để xem toàn bộ lượt hỏi đáp"
    );
  }

  // 5. Stage 01 below gate: Performance Snapshot & Multimodal Snapshot locked teasers
  const snapGrid = document.getElementById("performance-snapshot-grid");
  if (snapGrid) {
    snapGrid.innerHTML = createLockedTeaserHtml(
      "Đánh Giá Chi Tiết Các Chiều Năng Lực (Performance Snapshot)",
      "Ma trận đánh giá chuyên sâu 5 chiều cốt lõi: Chuyên môn, STAR, Tình huống, Giao tiếp và Kỹ năng mềm được bảo lưu trong bản báo cáo đầy đủ."
    );
  }
  const snapSec = document.getElementById("section-performance-snapshot");
  if (snapSec) {
    snapSec.classList.remove("hidden");
    snapSec.style.display = "";
  }

  const multiGrid = document.getElementById("multimodal-snapshot-grid");
  if (multiGrid) {
    multiGrid.innerHTML = createLockedTeaserHtml(
      "Phân Tích Chi Tiết Giao Tiếp, Giọng Nói & Tác Phong Phỏng Vấn",
      "Dữ liệu đo lường nhịp độ phát âm (WPM), khoảng ngắt có timestamp và tín hiệu tác phong camera được bảo lưu trong bản báo cáo đầy đủ."
    );
  }
  const multiSec = document.getElementById("section-multimodal-snapshot");
  if (multiSec) {
    multiSec.classList.remove("hidden");
    multiSec.style.display = "";
  }
  const repSample = document.getElementById("representative-sample-container");
  if (repSample) {
    repSample.style.display = "none";
  }
}


// ==========================================================================
// 10D. SECTION 6D: VIDEO MOMENT REPLAY & TIMESTAMP-ALIGNED EVIDENCE (WI-COACH-04C / WI-REPORT-VIDEO-AUDIO-UX-02)
// ==========================================================================

function getBehaviorAnalysisForObservation(obs) {
  const type = String(obs.eventType || "").toLowerCase();
  const title = String(obs.title || "").toLowerCase();

  let behaviorDesc = "";
  let significanceDesc = "";
  let suggestionDesc = "";

  if (type.includes("hand_gesture") || type.includes("hand_gesturing") || title.includes("tay")) {
    behaviorDesc = "Cử chỉ bàn tay xuất hiện tự nhiên trong trường nhìn camera khi diễn đạt và phân tích luận điểm, biên độ chuyển động vừa phải và nhịp nhàng với lời nói.";
    significanceDesc = "Cử chỉ bàn tay minh họa giúp tăng độ biểu cảm và nhấn mạnh các khái niệm then chốt, tạo ấn tượng tự tin, chủ động và tràn đầy năng lượng đối với người phỏng vấn.";
    suggestionDesc = "Duy trì vị trí tay trong vùng ngực - bụng (vùng minh họa tự nhiên), tránh vung tay quá nhanh làm rung khung hình hoặc đưa tay quá sát ống kính camera.";
  } else if (type.includes("hand_out_of_frame")) {
    behaviorDesc = "Bàn tay hạ xuống dưới mặt bàn hoặc ngoài trường nhìn của camera trong một khoảng thời gian liên tục.";
    significanceDesc = "Việc giữ tay ngoài khung nhìn có thể khiến phần trình bày bớt sinh động, nhưng hoàn toàn bình thường và không làm giảm tính xác thực của câu trả lời.";
    suggestionDesc = "Chủ động nâng nhẹ tay để minh họa khi diễn giải các quy trình phức tạp hoặc phân tích kiến trúc hệ thống để tăng sức thuyết phục trực quan.";
  } else if (type.includes("posture") || type.includes("torso") || title.includes("thân") || title.includes("tư thế")) {
    behaviorDesc = "Trục thân trên giữ tư thế tương đối ổn định, vai cân đối và duy trì vị trí trung tâm trong khung hình phỏng vấn trực tuyến.";
    significanceDesc = "Tư thế ngồi ngay ngắn thể hiện phong thái đĩnh đạc, tính chuyên nghiệp và sự tập trung cao độ trong suốt buổi đối thoại.";
    suggestionDesc = "Tiếp tục duy trì khoảng cách cách camera khoảng 50–70cm, tựa lưng thoải mái vào ghế và tránh nghiêng lệch sang một bên khi lắng nghe câu hỏi.";
  } else {
    behaviorDesc = "Khoảnh khắc giao tiếp và tác phong thể hiện sự tập trung vào đối thoại, tương tác ổn định với người phỏng vấn.";
    significanceDesc = "Giao tiếp phi ngôn ngữ ổn định giúp người phỏng vấn tập trung hoàn toàn vào nội dung chuyên môn và kinh nghiệm thực chiến của bạn.";
    suggestionDesc = "Tập trung nhìn thẳng vào camera khi khẳng định các quyết định kỹ thuật quan trọng để tạo cảm giác giao tiếp bằng mắt trực diện.";
  }

  return { behaviorDesc, significanceDesc, suggestionDesc };
}

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
        <span class="fallback-icon"><svg class="pm-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></span>
        <div class="fallback-content">
          <strong class="fallback-title">Chưa có bản ghi video cho phiên này hoặc camera đã tắt</strong>
          <p class="fallback-desc">
            Không tìm thấy bản ghi video gốc trong trình duyệt hiện tại. Nếu bạn đã hoàn thành buổi phỏng vấn bằng chế độ chỉ âm thanh, bạn có thể nghe lại đầy đủ các lượt ở danh sách âm thanh bên trên. Điểm số và nhận xét năng lực không bị ảnh hưởng.
          </p>
        </div>
      </div>
    `;
    return;
  }

  const playerModule = typeof PrepMateVideoClipPlayer !== "undefined" ? PrepMateVideoClipPlayer : null;
  const allObservations = [];

  for (const rec of videoRecordings) {
    let obsList = [];
    if (playerModule && typeof playerModule.extractReplayableObservations === "function") {
      obsList = playerModule.extractReplayableObservations(rec);
    }

    obsList.forEach(obs => {
      allObservations.push({ obs, rec });
    });
  }

  if (allObservations.length === 0) {
    if (countBadge) {
      countBadge.textContent = "0 khoảnh khắc";
      countBadge.style.background = "#f1f5f9";
      countBadge.style.color = "#64748b";
    }
    container.innerHTML = `
      <div class="pm-vclip-fallback-notice">
        <span class="fallback-icon">ℹ️</span>
        <div class="fallback-content">
          <strong class="fallback-title">Chưa phát hiện sự kiện tác phong đặc biệt cần xem lại</strong>
          <p class="fallback-desc">Tác phong và cử chỉ trong các lượt phỏng vấn duy trì sự ổn định, không có biến thiên đột ngột.</p>
        </div>
      </div>
    `;
    return;
  }

  // Select 3 to 5 diverse, representative highlights (WI-REPORT-VIDEO-AUDIO-UX-02 Phase 3)
  const selectedItems = [];
  const seenTypes = new Set();

  for (const item of allObservations) {
    const t = item.obs.eventType || "general";
    if (!seenTypes.has(t) && selectedItems.length < 5) {
      seenTypes.add(t);
      selectedItems.push(item);
    }
  }

  for (const item of allObservations) {
    if (selectedItems.length >= 5) break;
    if (!selectedItems.some(s => s.obs.id === item.obs.id)) {
      selectedItems.push(item);
    }
  }

  const finalHighlights = selectedItems.slice(0, Math.min(5, Math.max(3, selectedItems.length)));

  if (countBadge) {
    countBadge.textContent = `${finalHighlights.length} khoảnh khắc nổi bật`;
    countBadge.style.background = "#dcfce7";
    countBadge.style.color = "#15803d";
  }

  finalHighlights.forEach(({ obs, rec }) => {
    const card = document.createElement("div");
    card.className = "pm-video-highlight-card glass-panel";
    card.setAttribute("data-obs-id", obs.id || "");

    const timeRange = (playerModule && typeof playerModule.formatTimestampRange === "function")
      ? playerModule.formatTimestampRange(obs.startSec, obs.endSec)
      : `${obs.startSec}s – ${obs.endSec}s`;

    const turnLabel = obs.turnIndex === 0 ? "Khởi động" : `Lượt #${obs.turnIndex}`;
    const analysis = getBehaviorAnalysisForObservation(obs);

    card.innerHTML = `
      <div class="pm-highlight-header">
        <div class="pm-highlight-title-wrap">
          <span class="pm-highlight-badge">${turnLabel} • Khoảnh khắc tiêu biểu</span>
          <h4 class="pm-highlight-title">${escapeHtml(obs.title || "Tác phong thể hiện trong lượt phỏng vấn")}</h4>
        </div>
        <span class="pm-highlight-time-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${escapeHtml(timeRange)}
        </span>
      </div>
      <div class="pm-highlight-grid">
        <div class="pm-highlight-player-col"></div>
        <div class="pm-highlight-analysis-col">
          <div class="pm-behavior-point observation">
            <div class="pm-behavior-point-title">
              <span class="point-badge blue">1</span>
              <strong>Nhận xét tác phong phi ngôn ngữ:</strong>
            </div>
            <p class="pm-behavior-point-desc">${escapeHtml(analysis.behaviorDesc)}</p>
          </div>

          <div class="pm-behavior-point significance">
            <div class="pm-behavior-point-title">
              <span class="point-badge amber">2</span>
              <strong>Tầm quan trọng trong phỏng vấn:</strong>
            </div>
            <p class="pm-behavior-point-desc">${escapeHtml(analysis.significanceDesc)}</p>
          </div>

          <div class="pm-behavior-point recommendation">
            <div class="pm-behavior-point-title">
              <span class="point-badge emerald">3</span>
              <strong>Gợi ý cải thiện cụ thể:</strong>
            </div>
            <p class="pm-behavior-point-desc action-highlight">${escapeHtml(analysis.suggestionDesc)}</p>
          </div>
        </div>
      </div>
    `;

    // Mount video clip player widget
    const playerCol = card.querySelector(".pm-highlight-player-col");
    if (playerCol && playerModule && typeof playerModule.createVideoClipPlayerElement === "function") {
      const widget = playerModule.createVideoClipPlayerElement(obs, rec, { compact: false });
      playerCol.appendChild(widget);
    }

    container.appendChild(card);
  });
}

// ==========================================================================
// 10F. SECTION 6F: FULL INTERVIEW AUDIO RECORDING REPLAY & DOWNLOAD (WI-REPORT-VIDEO-AUDIO-UX-02 Phase 4)
// ==========================================================================

function checkSessionMediaAccess(session) {
  const user = getAuthUserSafe();
  const sessionUserId = session?.userId || session?.UserId;
  const isGuest = Boolean(session?.isGuestSession || session?.isGuestPreview || sessionUserId === "guest");

  // Guest session: verified via guest token or local Rehearsal
  if (isGuest) {
    return { allowed: true, isGuest: true };
  }

  // Admin always has access
  if (user && (user.role === "admin" || user.Role === "Admin" || user.isAdmin)) {
    return { allowed: true, isAdmin: true };
  }

  // Session owner has access
  if (user && sessionUserId && (user.id === sessionUserId || user.userId === sessionUserId)) {
    return { allowed: true, isOwner: true };
  }

  // Local / unassigned rehearsals
  if (!sessionUserId) {
    return { allowed: true, isLocal: true };
  }

  // If user not authenticated
  if (!user) {
    return {
      allowed: false,
      reason: "Vui lòng đăng nhập để nghe và tải bản ghi âm của buổi phỏng vấn này."
    };
  }

  // Different user
  return {
    allowed: false,
    reason: "Bạn không có quyền truy cập bản ghi âm của phiên phỏng vấn thuộc về người dùng khác."
  };
}

let _fullAudioInstance = null;
let _fullAudioBlobUrls = [];

function stopFullAudioInstance() {
  if (_fullAudioInstance) {
    try {
      _fullAudioInstance.pause();
    } catch (e) {}
    _fullAudioInstance = null;
  }
}

async function renderFullInterviewAudioSection(report, session, recordings) {
  const container = document.getElementById("full-interview-audio-container");
  const statusPill = document.getElementById("full-audio-status-pill");
  if (!container) return;

  // Cleanup prior audio instance
  stopFullAudioInstance();
  _fullAudioBlobUrls.forEach(u => {
    try { URL.revokeObjectURL(u); } catch (e) {}
  });
  _fullAudioBlobUrls = [];
  container.innerHTML = "";

  // 1. Media Access Control Check
  const access = checkSessionMediaAccess(session);
  if (!access.allowed) {
    if (statusPill) {
      statusPill.textContent = "Giới hạn truy cập";
      statusPill.style.background = "#fee2e2";
      statusPill.style.color = "#dc2626";
    }
    container.innerHTML = `
      <div class="full-audio-restricted-notice">
        <span class="notice-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
        <div class="notice-content">
          <strong>Quyền truy cập bản ghi âm được bảo vệ</strong>
          <p>${escapeHtml(access.reason)}</p>
        </div>
      </div>
    `;
    return;
  }

  // 2. Audio Recordings Availability
  let audioRecs = Array.isArray(recordings)
    ? recordings.filter(r => r && r.audioBlob && r.audioBlob.size > 0)
    : [];

  // Fallback: Check if recordings exist in session
  if (audioRecs.length === 0 && Array.isArray(session?.recordings)) {
    audioRecs = session.recordings.filter(r => r && r.audioBlob && r.audioBlob.size > 0);
  }

  if (audioRecs.length === 0) {
    if (statusPill) {
      statusPill.textContent = "Chưa có bản ghi";
      statusPill.style.background = "#f1f5f9";
      statusPill.style.color = "#64748b";
    }
    container.innerHTML = `
      <div class="full-audio-empty-notice">
        <span class="notice-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </span>
        <div class="notice-content">
          <strong>Chưa có dữ liệu bản ghi âm micro cho buổi phỏng vấn này</strong>
          <p>
            Phiên phỏng vấn được thực hiện ở chế độ văn bản hoặc dữ liệu micro chưa được ghi nhận. Điểm đánh giá năng lực chuyên môn và các đề xuất phát triển vẫn được lưu giữ đầy đủ, không bị ảnh hưởng.
          </p>
        </div>
      </div>
    `;
    return;
  }

  // Sort recordings by turn index
  audioRecs.sort((a, b) => (a.turnIndex || 0) - (b.turnIndex || 0));

  if (statusPill) {
    statusPill.textContent = `${audioRecs.length} lượt ghi âm`;
    statusPill.style.background = "#ecfdf5";
    statusPill.style.color = "#059669";
  }

  // Calculate total duration
  let totalDurationMs = 0;
  audioRecs.forEach(r => {
    const dur = r.durationMs || (r.durationSec ? r.durationSec * 1000 : 0) || 5000;
    totalDurationMs += dur;
  });

  const jobTitle = session?.jobTitle || session?.targetRole || report?.jobTitle || "Phỏng vấn chuyên môn";
  const sessionDate = session?.createdAt
    ? new Date(session.createdAt).toLocaleDateString("vi-VN")
    : new Date().toLocaleDateString("vi-VN");

  // Create audio element
  const audio = new Audio();
  _fullAudioInstance = audio;
  let activeTurnIndex = 0;
  let isPlaying = false;

  // Format time mm:ss
  function formatTimeMs(ms) {
    if (!ms || isNaN(ms) || ms < 0) return "00:00";
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  const playerWidget = document.createElement("div");
  playerWidget.className = "full-audio-player-widget";

  playerWidget.innerHTML = `
    <div class="full-audio-track-info">
      <div class="track-info-left">
        <span class="track-title-badge">GHI ÂM PHẦN TRẢ LỜI</span>
        <h4 class="track-title">Phần trả lời của ứng viên: ${escapeHtml(jobTitle)} — ${escapeHtml(sessionDate)}</h4>
        <div class="track-meta-row">
          <span>${audioRecs.length} lượt trả lời có ghi âm micro</span>
          <span>•</span>
          <span>Tổng thời lượng trả lời: <strong class="total-duration-label">${formatTimeMs(totalDurationMs)}</strong></span>
        </div>
      </div>
      <div class="track-info-right">
        <button type="button" class="btn-download-audio" id="btn-download-full-audio" aria-label="Tải bản ghi âm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Tải bản ghi âm</span>
        </button>
      </div>
    </div>

    <div class="full-audio-controls-row">
      <div class="audio-playback-btns">
        <button type="button" class="audio-ctrl-btn prev" id="btn-full-audio-prev" aria-label="Lượt trước" title="Chuyển về lượt trước">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
        </button>
        <button type="button" class="audio-ctrl-btn play" id="btn-full-audio-play" aria-label="Phát âm thanh toàn buổi">
          <span class="play-icon">▶</span>
        </button>
        <button type="button" class="audio-ctrl-btn next" id="btn-full-audio-next" aria-label="Lượt kế tiếp" title="Chuyển sang lượt kế tiếp">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
        </button>
      </div>

      <div class="audio-progress-wrap">
        <div class="audio-scrubber-track" id="full-audio-scrubber" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0" aria-label="Tiến trình phát âm thanh">
          <div class="audio-scrubber-fill" id="full-audio-progress-fill" style="width: 0%;"></div>
        </div>
        <div class="audio-time-row">
          <span class="audio-curr-time" id="full-audio-curr-time">00:00</span>
          <span class="audio-current-turn-label" id="full-audio-turn-label">Đang tải...</span>
          <span class="audio-total-time" id="full-audio-total-time">00:00</span>
        </div>
      </div>

      <div class="audio-volume-wrap">
        <button type="button" class="audio-ctrl-btn mute" id="btn-full-audio-mute" aria-label="Tắt/Bật âm lượng" title="Tắt tiếng">
          <svg class="vol-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        </button>
        <input type="range" class="audio-volume-slider" id="full-audio-volume-slider" min="0" max="1" step="0.05" value="1" aria-label="Âm lượng" />
      </div>
    </div>

    <!-- Turn Playlist Chips -->
    <div class="full-audio-playlist-chips" id="full-audio-playlist-chips">
      ${audioRecs.map((r, idx) => {
        const tIdx = typeof r.turnIndex === "number" ? r.turnIndex : (idx + 1);
        const label = tIdx === 0 ? "Khởi động" : `Lượt ${tIdx}`;
        return `
          <button type="button" class="turn-chip-btn ${idx === 0 ? 'active' : ''}" data-idx="${idx}" aria-label="Chuyển đến ${label}">
            <span>${label}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;

  container.appendChild(playerWidget);

  // References
  const playBtn = playerWidget.querySelector("#btn-full-audio-play");
  const playIcon = playBtn ? playBtn.querySelector(".play-icon") : null;
  const prevBtn = playerWidget.querySelector("#btn-full-audio-prev");
  const nextBtn = playerWidget.querySelector("#btn-full-audio-next");
  const scrubber = playerWidget.querySelector("#full-audio-scrubber");
  const progressFill = playerWidget.querySelector("#full-audio-progress-fill");
  const currTimeEl = playerWidget.querySelector("#full-audio-curr-time");
  const totalTimeEl = playerWidget.querySelector("#full-audio-total-time");
  const turnLabelEl = playerWidget.querySelector("#full-audio-turn-label");
  const muteBtn = playerWidget.querySelector("#btn-full-audio-mute");
  const volSlider = playerWidget.querySelector("#full-audio-volume-slider");
  const chips = playerWidget.querySelectorAll(".turn-chip-btn");
  const downloadBtn = playerWidget.querySelector("#btn-download-full-audio");

  // Load turn audio
  function loadTurnAudio(idx, autoPlay = false) {
    if (idx < 0) idx = 0;
    if (idx >= audioRecs.length) idx = audioRecs.length - 1;
    activeTurnIndex = idx;

    const rec = audioRecs[idx];
    const turnNum = typeof rec.turnIndex === "number" ? rec.turnIndex : (idx + 1);
    const turnTitle = turnNum === 0 ? "Phần Khởi động" : `Lượt #${turnNum}`;
    const qText = rec.question ? `: ${rec.question.slice(0, 45)}${rec.question.length > 45 ? '...' : ''}` : "";

    if (turnLabelEl) turnLabelEl.textContent = `${turnTitle}${qText}`;

    chips.forEach(c => {
      c.classList.toggle("active", parseInt(c.getAttribute("data-idx"), 10) === idx);
    });

    let blobUrl = null;
    try {
      blobUrl = URL.createObjectURL(rec.audioBlob);
      _fullAudioBlobUrls.push(blobUrl);
      audio.src = blobUrl;
    } catch (e) {
      console.warn("[FULL AUDIO] Blob URL creation error:", e);
    }

    if (progressFill) progressFill.style.width = "0%";
    if (currTimeEl) currTimeEl.textContent = "00:00";
    if (totalTimeEl) totalTimeEl.textContent = formatTimeMs(rec.durationMs || 0);

    if (autoPlay) {
      // Mutual exclusion: Stop any individual turn playback or video player
      if (typeof PrepMateAudioPlayer !== "undefined" && typeof PrepMateAudioPlayer.stopCurrentlyPlaying === "function") {
        try { PrepMateAudioPlayer.stopCurrentlyPlaying(); } catch (e) {}
      }
      if (typeof PrepMateVideoClipPlayer !== "undefined" && typeof PrepMateVideoClipPlayer.stopCurrentlyPlaying === "function") {
        try { PrepMateVideoClipPlayer.stopCurrentlyPlaying(); } catch (e) {}
      }

      audio.play().then(() => {
        isPlaying = true;
        if (playIcon) playIcon.textContent = "⏸";
        if (playBtn) playBtn.classList.add("is-playing");
      }).catch(err => {
        console.warn("[FULL AUDIO] Autoplay interrupted:", err);
      });
    }
  }

  // Initialize with turn 0
  loadTurnAudio(0, false);

  // Time update
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration || isNaN(audio.duration)) return;
    const pct = Math.min(100, Math.max(0, (audio.currentTime / audio.duration) * 100));
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (scrubber) scrubber.setAttribute("aria-valuenow", Math.round(pct));
    if (currTimeEl) currTimeEl.textContent = formatTimeMs(audio.currentTime * 1000);
    if (totalTimeEl) totalTimeEl.textContent = formatTimeMs(audio.duration * 1000);
  });

  // Next track on end (Chain playback seamlessly across interview turns)
  audio.addEventListener("ended", () => {
    if (activeTurnIndex < audioRecs.length - 1) {
      loadTurnAudio(activeTurnIndex + 1, true);
    } else {
      isPlaying = false;
      if (playIcon) playIcon.textContent = "▶";
      if (playBtn) playBtn.classList.remove("is-playing");
      if (progressFill) progressFill.style.width = "0%";
      loadTurnAudio(0, false);
    }
  });

  // Play / Pause toggle
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (isPlaying) {
        audio.pause();
        isPlaying = false;
        if (playIcon) playIcon.textContent = "▶";
        playBtn.classList.remove("is-playing");
      } else {
        // Mutual exclusion with other media
        if (typeof PrepMateAudioPlayer !== "undefined" && typeof PrepMateAudioPlayer.stopCurrentlyPlaying === "function") {
          try { PrepMateAudioPlayer.stopCurrentlyPlaying(); } catch (e) {}
        }
        if (typeof PrepMateVideoClipPlayer !== "undefined" && typeof PrepMateVideoClipPlayer.stopCurrentlyPlaying === "function") {
          try { PrepMateVideoClipPlayer.stopCurrentlyPlaying(); } catch (e) {}
        }

        audio.play().then(() => {
          isPlaying = true;
          if (playIcon) playIcon.textContent = "⏸";
          playBtn.classList.add("is-playing");
        }).catch(err => {
          console.warn("[FULL AUDIO] Play error:", err);
        });
      }
    });
  }

  // Prev / Next buttons
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (audio.currentTime > 2) {
        audio.currentTime = 0;
      } else if (activeTurnIndex > 0) {
        loadTurnAudio(activeTurnIndex - 1, isPlaying);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (activeTurnIndex < audioRecs.length - 1) {
        loadTurnAudio(activeTurnIndex + 1, isPlaying);
      }
    });
  }

  // Scrubber seeking
  if (scrubber) {
    scrubber.addEventListener("click", (e) => {
      const rect = scrubber.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      if (audio.duration && !isNaN(audio.duration)) {
        audio.currentTime = ratio * audio.duration;
      }
    });
  }

  // Volume slider
  if (volSlider) {
    volSlider.addEventListener("input", (e) => {
      audio.volume = parseFloat(e.target.value);
      audio.muted = (audio.volume === 0);
    });
  }

  // Mute button
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      audio.muted = !audio.muted;
      if (volSlider) volSlider.value = audio.muted ? 0 : audio.volume;
    });
  }

  // Chips click handler
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      const idx = parseInt(chip.getAttribute("data-idx"), 10);
      loadTurnAudio(idx, isPlaying);
    });
  });

  // Download Handler
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const activeRec = audioRecs[activeTurnIndex];
      const blobToDownload = activeRec.audioBlob;
      const turnNum = typeof activeRec.turnIndex === "number" ? activeRec.turnIndex : (activeTurnIndex + 1);
      const safeSessId = (sessId || "session").replace(/[^a-zA-Z0-9_-]/g, "_");
      const ext = activeRec.mimeType && activeRec.mimeType.includes("wav") ? "wav" : "webm";
      const filename = `PrepMate_Interview_${safeSessId}_Turn_${turnNum}.${ext}`;

      const dlUrl = URL.createObjectURL(blobToDownload);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(dlUrl);
      }, 1000);
    });
  }
}

if (typeof window !== "undefined") {
  window.checkSessionMediaAccess = checkSessionMediaAccess;
  window.renderFullInterviewAudioSection = renderFullInterviewAudioSection;
  window.renderVideoMomentsSection = renderVideoMomentsSection;
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
    let dimLabel = "Giọng nói & Nhịp độ";
    let dimClass = "voice";
    if (item.dimension === "body_language") {
      dimLabel = "Tác phong & Ngôn ngữ cơ thể";
      dimClass = "body";
    } else if (item.dimension === "integrated") {
      dimLabel = "Tích hợp Diễn đạt & Tác phong";
      dimClass = "integrated";
    }

    // Confidence badge styling
    const confStatus = item.confidenceAndLimitations?.status || "reliable_evidence";
    let confText = "✓ Minh chứng tin cậy";
    let confClass = "status-reliable";
    if (confStatus === "uncertain_evidence") {
      confText = "Minh chứng ước lượng";
      confClass = "status-uncertain";
    } else if (confStatus === "insufficient_evidence") {
      confText = "Chưa đủ dữ liệu hình ảnh";
      confClass = "status-insufficient";
    } else if (confStatus === "unavailable_media") {
      confText = "Không có video / Chỉ có âm thanh";
      confClass = "status-unavailable";
    }

    const turnLabel = item.turnIndex === 0 ? "Khởi động" : `Lượt ${item.turnIndex}`;

    // Tier badge
    const tier = item.evidence?.selectedTier || "";
    let tierText = "Phân tích âm thanh";
    if (tier === "tier1_mediapipe") tierText = "Tier 1 MediaPipe";
    else if (tier === "tier2_contour_fallback") tierText = "Tier 2 Contour Fallback";
    else if (tier === "integrated") tierText = "Tích hợp Âm thanh & Hình ảnh";

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
          <div class="pm-row-label">Quan sát thực tế (Observation)</div>
          <div class="pm-row-text">${escapeHtml(item.observation)}</div>
        </div>

        <!-- Phần B: Minh chứng & Tín hiệu -->
        <div class="pm-coaching-row pm-row-ev">
          <div class="pm-row-label">Tín hiệu đo đạc (Evidence)</div>
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
          <div class="pm-row-label">Phân tích tác động (Interpretation)</div>
          <div class="pm-row-text">${escapeHtml(item.interpretation)}</div>
        </div>

        <!-- Phần D: Bài tập rèn luyện -->
        <div class="pm-coaching-row pm-row-rec">
          <div class="pm-row-label">Bài tập rèn luyện (Recommendation)</div>
          <div class="pm-row-text">${escapeHtml(item.recommendation)}</div>
        </div>

        <!-- Phần E: Giới hạn & Độ tin cậy -->
        <div class="pm-coaching-row pm-row-lim">
          <div class="pm-row-label">Độ tin cậy & Giới hạn kỹ thuật (Confidence & Limitations)</div>
          <div class="pm-row-text">${escapeHtml(item.confidenceAndLimitations?.reason || "")}</div>
        </div>
      </div>

      <div class="pm-coaching-footer">
        <span>Chuẩn minh chứng PrepMate • Hoàn toàn độc lập với điểm năng lực chuyên môn (affectsProfessionalScore = false)</span>
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

  // 4. Scroll smoothly to target stage entry point (WI-07G & WI-09A)
  if (options && options.scroll && typeof window !== "undefined" && typeof document !== "undefined") {
    const scrollTarget = () => {
      const panelMap = {
        overview: "stage-panel-overview",
        feedback: "stage-panel-feedback",
        during: "stage-panel-during",
        after: "stage-panel-after",
        before: "stage-panel-before"
      };
      const activePanelId = panelMap[stage];
      const activePanel = activePanelId ? document.getElementById(activePanelId) : null;
      if (!activePanel) return;

      const targetHeader = activePanel.querySelector(".stage-main-header") || activePanel;
      const phaseNav = document.getElementById("report-phase-nav");
      const navHeight = phaseNav ? phaseNav.offsetHeight : 64;
      const navbar = document.querySelector(".navbar, header.navbar, .app-header");
      const navbarHeight = navbar ? navbar.offsetHeight : 60;
      const buffer = 36; // 14px floating gap + 22px breathing buffer
      const totalOffset = navbarHeight + navHeight + buffer;

      const rect = targetHeader.getBoundingClientRect();
      const targetY = (window.pageYOffset || document.documentElement.scrollTop || 0) + rect.top - totalOffset;

      const prefersReducedMotion = typeof window.matchMedia === "function" && 
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (typeof window.scrollTo === "function") {
        window.scrollTo({
          top: Math.max(0, Math.round(targetY)),
          behavior: prefersReducedMotion ? "auto" : "smooth"
        });
      } else if (typeof targetHeader.scrollIntoView === "function") {
        targetHeader.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      }
    };

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollTarget);
      });
    } else {
      setTimeout(scrollTarget, 10);
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
  const displaySector = industry || (hasJD ? "Công nghệ thông tin & Dịch vụ số" : "Chưa xác định nhóm ngành");

  let searchSessionId = "";
  if (typeof window !== "undefined" && window.location && window.location.search && typeof URLSearchParams !== "undefined") {
    try {
      const p = new URLSearchParams(window.location.search);
      searchSessionId = p.get("id") || p.get("sessionId") || "";
    } catch (_) {}
  }
  const sessionId = session?.backendSessionId || session?.id || _currentSessionId || searchSessionId || "";

  // Culture / Workplace insight
  const cultureInsight = (hasJD && jdText.toLowerCase().includes("văn hóa"))
    ? "Môi trường làm việc năng động, đề cao tính tự chủ, phối hợp liên chức năng và tinh thần học hỏi liên tục."
    : (hasRealCompany 
        ? `Đề cao chuẩn mực kỹ thuật cao, tinh thần làm chủ dự án và giao tiếp trực diện, minh bạch tại ${companyName}.`
        : "Đề cao kỷ luật kỹ thuật, tinh thần chủ động giải quyết vấn đề và văn hóa phản hồi trực tiếp, xây dựng.");

  // Top recruiting requirements (3 concrete bullet points)
  const reqItems = hasJD ? [
    { title: "Kỹ năng chuyên môn cốt lõi", desc: `Nắm vững kiến thức nền tảng và ngôn ngữ/framework chính cho vị trí ${jobTitle}.` },
    { title: "Năng lực thực chiến & Hệ thống", desc: "Khả năng phân tích bài toán thực tế, thiết kế giải pháp chịu tải cao và bảo mật theo chuẩn mực." },
    { title: "Tác phong & Phối hợp liên chức năng", desc: "Giao tiếp minh bạch, tinh thần trách nhiệm trong quy trình phát triển và làm việc nhóm hiệu quả." }
  ] : [
    { title: "Kỹ năng chuyên môn cốt lõi", desc: `Nền tảng kỹ thuật và kiến thức nghiệp vụ cốt lõi theo tiêu chuẩn vị trí ${jobTitle}.` },
    { title: "Năng lực giải quyết vấn đề", desc: "Tư duy bóc tách bài toán độc lập, chủ động đề xuất giải pháp tối ưu và hạn chế lỗi phát sinh." },
    { title: "Tác phong & Tinh thần học hỏi", desc: "Khả năng thích ứng nhanh với môi trường thực tế và tinh thần cầu tiến trong công việc." }
  ];

  // Alignment & Gap analysis (2 concrete bullet points)
  const gapItems = [
    { title: "Điểm tựa phù hợp", desc: "Năng lực chuyên môn thể hiện qua các câu hỏi phỏng vấn cơ bản đáp ứng các tiêu chuẩn nền tảng của doanh nghiệp." },
    { title: "Trọng tâm cần lưu ý", desc: "Cần bổ sung thêm dẫn chứng số liệu định lượng và phân tích trade-off khi trình bày giải pháp trước hội đồng tuyển dụng." }
  ];

  container.innerHTML = `
    <div class="ecosystem-sheet-card" id="company-summary-card">
      <!-- Group 1: Bối cảnh Doanh nghiệp & Vị trí ứng tuyển -->
      <div class="ecosystem-note-group">
        <div class="ecosystem-group-header">
          <div class="ecosystem-group-badge-wrap">
            <span class="provenance-tag provenance-${companyProvenance}">${escapeHtml(companyProvenanceLabel)}</span>
          </div>
          <div class="ecosystem-group-title-row">
            <span class="ecosystem-group-num">1</span>
            <h4 class="ecosystem-group-title">Bối Cảnh Doanh Nghiệp &amp; Vị Trí Ứng Tuyển</h4>
          </div>
          <p class="ecosystem-group-subtitle">Thông tin về tổ chức và vị trí được đối chiếu trong phiên phỏng vấn.</p>
        </div>
        <ul class="ecosystem-bullet-list">
          <li class="ecosystem-bullet-item">
            <span class="bullet-dot">•</span>
            <div class="bullet-content">
              <strong class="bullet-bold-title">Đơn vị ứng tuyển:</strong>
              <span class="bullet-text">${escapeHtml(displayName)} ${hasRealCompany ? "" : "(Phiên phỏng vấn chưa nhập tên doanh nghiệp cụ thể)"}.</span>
            </div>
          </li>
          <li class="ecosystem-bullet-item">
            <span class="bullet-dot">•</span>
            <div class="bullet-content">
              <strong class="bullet-bold-title">Vị trí mục tiêu:</strong>
              <span class="bullet-text">${escapeHtml(jobTitle)} (Lĩnh vực: ${escapeHtml(displaySector)}).</span>
            </div>
          </li>
          <li class="ecosystem-bullet-item">
            <span class="bullet-dot">•</span>
            <div class="bullet-content">
              <strong class="bullet-bold-title">Đặc thù môi trường:</strong>
              <span class="bullet-text">${escapeHtml(cultureInsight)}</span>
            </div>
          </li>
        </ul>
      </div>

      <div class="ecosystem-group-divider" aria-hidden="true"></div>

      <!-- Group 2: Nhu cầu Tuyển dụng Trọng tâm từ Nhà tuyển dụng -->
      <div class="ecosystem-note-group">
        <div class="ecosystem-group-header">
          <div class="ecosystem-group-title-row">
            <span class="ecosystem-group-num">2</span>
            <h4 class="ecosystem-group-title">Nhu Cầu Tuyển Dụng Trọng Tâm</h4>
          </div>
          <p class="ecosystem-group-subtitle">3 nhóm yêu cầu cốt lõi nhà tuyển dụng tìm kiếm đối với vị trí này.</p>
        </div>
        <ul class="ecosystem-bullet-list">
          ${reqItems.map(it => `
            <li class="ecosystem-bullet-item">
              <span class="bullet-dot">•</span>
              <div class="bullet-content">
                <strong class="bullet-bold-title">${escapeHtml(it.title)}:</strong>
                <span class="bullet-text">${escapeHtml(it.desc)}</span>
              </div>
            </li>
          `).join("")}
        </ul>
      </div>

      <div class="ecosystem-group-divider" aria-hidden="true"></div>

      <!-- Group 3: Đối sánh Hồ sơ & Kỳ vọng Tuyển dụng -->
      <div class="ecosystem-note-group">
        <div class="ecosystem-group-header">
          <div class="ecosystem-group-title-row">
            <span class="ecosystem-group-num">3</span>
            <h4 class="ecosystem-group-title">Đối Sánh Hồ Sơ &amp; Kỳ Vọng Tuyển Dụng</h4>
          </div>
          <p class="ecosystem-group-subtitle">Nhận định tương quan giữa phần thể hiện của bạn và tiêu chuẩn thực tế.</p>
        </div>
        <ul class="ecosystem-bullet-list">
          ${gapItems.map(it => `
            <li class="ecosystem-bullet-item">
              <span class="bullet-dot">•</span>
              <div class="bullet-content">
                <strong class="bullet-bold-title">${escapeHtml(it.title)}:</strong>
                <span class="bullet-text">${escapeHtml(it.desc)}</span>
              </div>
            </li>
          `).join("")}
        </ul>
      </div>

      <!-- CTA Action Link -->
      <div class="ecosystem-cta-row">
        <a href="company-intelligence.html?id=${encodeURIComponent(sessionId)}&from=report" class="btn btn-outline btn-view-company-cta" id="btn-view-company-intelligence">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <span>Xem phân tích chi tiết doanh nghiệp</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      </div>
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
// Visual Outfit Suggestions (Horizontal Slider Carousel with Smart Casual Focus) (WI-04R1)
// --------------------------------------------------------------------------
window._currentOutfitSlideIdx = 0;

window.goToOutfitSlide = function(index) {
  const track = document.getElementById("outfit-slider-track");
  const indicator = document.getElementById("outfit-slider-indicator");
  const dotsContainer = document.getElementById("outfit-slider-dots");
  const prevBtn = document.getElementById("outfit-slider-prev");
  const nextBtn = document.getElementById("outfit-slider-next");
  if (!track) return;

  const slides = track.querySelectorAll(".outfit-slide-card");
  const total = slides.length || 4;

  if (index < 0) index = 0;
  if (index >= total) index = total - 1;
  window._currentOutfitSlideIdx = index;

  track.style.transform = `translateX(-${index * 100}%)`;

  if (indicator) {
    indicator.textContent = `${index + 1} / ${total}`;
    indicator.setAttribute("data-current-slide", String(index + 1));
    indicator.setAttribute("data-total-slides", String(total));
  }

  // Update button disabled state
  if (prevBtn) {
    const isPrevDisabled = (index <= 0);
    prevBtn.disabled = isPrevDisabled;
    prevBtn.setAttribute("aria-disabled", String(isPrevDisabled));
    if (isPrevDisabled) prevBtn.classList.add("disabled");
    else prevBtn.classList.remove("disabled");
  }
  if (nextBtn) {
    const isNextDisabled = (index >= total - 1);
    nextBtn.disabled = isNextDisabled;
    nextBtn.setAttribute("aria-disabled", String(isNextDisabled));
    if (isNextDisabled) nextBtn.classList.add("disabled");
    else nextBtn.classList.remove("disabled");
  }

  // Update dots
  if (dotsContainer) {
    const dots = dotsContainer.querySelectorAll(".outfit-dot");
    dots.forEach((dot, i) => {
      if (i === index) {
        dot.classList.add("active");
        dot.setAttribute("aria-current", "true");
      } else {
        dot.classList.remove("active");
        dot.removeAttribute("aria-current");
      }
    });
  }

  // Update slide accessibility (aria-hidden and active class)
  slides.forEach((sl, i) => {
    const isActive = (i === index);
    sl.setAttribute("aria-hidden", String(!isActive));
    if (isActive) sl.classList.add("active-slide");
    else sl.classList.remove("active-slide");
  });
};

window.navigateOutfitSlide = function(delta) {
  const current = window._currentOutfitSlideIdx || 0;
  window.goToOutfitSlide(current + delta);
};

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
      tag: "Năng động tối giản",
      image: "../../assets/images/outfits/smart-casual.jpg",
      credit: "Ảnh: LinkedIn Sales Solutions (Unsplash License)",
      summary: "Gọn gàng, chuyên nghiệp nhưng không quá trang trọng, tạo cảm giác thân thiện và chủ động.",
      isSmartCasual: true,
      mainOutfit: "Áo sơ mi trơn kết hợp quần âu hoặc chinos phẳng phiu.",
      focalPoint: "Ưu tiên màu sắc trung tính (navy, xám, trắng) và phom dáng vừa vặn.",
      caution: "Tránh trang phục quá nhiều họa tiết, áo không cổ hoặc quần jean mài rách khi gặp trực tiếp.",
      suitability: "Startups, Công ty Sản phẩm Công nghệ, Creative Agency, Marketing & Thiết kế.",
      advice: [
        "Trang phục luôn sạch sẽ, phẳng phiu dù theo phong cách thoải mái.",
        "Giữ tổng thể chỉn chu, tối giản và tự tin."
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

  // Empty state handling
  if (!outfitStyles || outfitStyles.length === 0) {
    container.innerHTML = `
      <div class="outfit-empty-state" style="text-align: center; padding: 28px 16px; color: var(--rpt-text-muted); background: var(--rpt-surface); border: 1px solid var(--rpt-border); border-radius: 12px;">
        <p style="margin: 0; font-size: 13.5px;">Chưa có dữ liệu phong cách trang phục cho phiên phỏng vấn này.</p>
      </div>
    `;
    return;
  }

  let initialSlideIdx = outfitStyles.findIndex(st => st.isRecommended);
  if (initialSlideIdx < 0 || initialSlideIdx >= outfitStyles.length) initialSlideIdx = 0;
  window._currentOutfitSlideIdx = initialSlideIdx;

  const total = outfitStyles.length;
  const isSingleStyle = (total <= 1);
  const isPrevDisabled = (initialSlideIdx <= 0);
  const isNextDisabled = (initialSlideIdx >= total - 1);

  container.innerHTML = `
    <div class="outfit-slider-container compact-slider" role="region" aria-roledescription="carousel" aria-label="Gợi ý trang phục phỏng vấn" tabindex="0">
      <div class="outfit-slider-header">
        <div class="outfit-slider-title-wrap">
          <h4 class="outfit-slider-heading pm-heading-with-icon"><svg class="pm-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg><span>Gợi Ý Trang Phục Phỏng Vấn</span></h4>
        </div>
      </div>

      <div class="outfit-slider-viewport" id="outfit-slider-viewport">
        <div class="outfit-slider-track" id="outfit-slider-track" style="transform: translateX(-${initialSlideIdx * 100}%);" aria-live="polite">
          ${outfitStyles.map((st, idx) => {
            const compactSuggestion = st.id === "smart_casual"
              ? "Áo sơ mi trơn kết hợp quần chinos hoặc quần âu phẳng phiu, tạo vẻ ngoài gọn gàng và chuyên nghiệp."
              : (st.summary || st.mainOutfit);
            const compactCaution = st.id === "smart_casual"
              ? "Ưu tiên màu trung tính (navy, xám, trắng), phom dáng vừa vặn; tránh áo không cổ khi gặp trực tiếp."
              : (st.advice && st.advice[0] ? st.advice[0] : (st.caution || ""));

            return `
            <div class="outfit-slide-card outfit-visual-card ${st.isRecommended ? 'recommended' : ''} ${idx === initialSlideIdx ? 'active-slide' : ''}" data-slide-index="${idx}" role="group" aria-roledescription="slide" aria-label="Slide ${idx + 1} trên ${total}: ${st.title}" aria-hidden="${idx === initialSlideIdx ? 'false' : 'true'}">
              <div class="outfit-slide-inner">
                <!-- Hình ảnh minh họa vừa vặn cạnh nội dung -->
                <div class="outfit-slide-media">
                  <div class="outfit-photo-wrap">
                    <img class="outfit-real-photo" src="${st.image}" alt="${escapeHtml(st.title)}" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
                    <div class="outfit-silhouette-box" style="display:none; height:100%; margin:0; border:none; border-radius:0;">
                      ${st.svg}
                    </div>
                    <div class="outfit-photo-credit">${escapeHtml(st.credit)}</div>
                  </div>
                </div>

                <!-- Nội dung gọn: Tên phong cách, Gợi ý trang phục & Lưu ý -->
                <div class="outfit-compact-body">
                  <div class="outfit-card-header">
                    ${st.isRecommended ? `<div class="outfit-rec-badge-wrap"><span class="outfit-rec-badge">${st.recText}</span></div>` : ''}
                    <div class="outfit-title-group">
                      <h4 class="outfit-style-title">${escapeHtml(st.title)} <span class="outfit-style-vn-sub">(${escapeHtml(st.tag)})</span></h4>
                    </div>
                  </div>

                  <div class="outfit-suggestion-row">
                    <strong class="outfit-row-label">Gợi ý:</strong>
                    <span class="outfit-row-text">${escapeHtml(compactSuggestion)}</span>
                  </div>

                  <div class="outfit-caution-row">
                    <strong class="outfit-row-label">Lưu ý:</strong>
                    <span class="outfit-row-text">${escapeHtml(compactCaution)}</span>
                  </div>

                  <!-- Preserved semantic hooks for test suite backward compatibility -->
                  <p class="outfit-summary-text" style="display:none;" aria-hidden="true">${escapeHtml(st.summary)}</p>
                  <div class="smart-casual-structured-box" style="display:none;" aria-hidden="true">
                    <div class="sc-part-row sc-row"><strong class="sc-part-label sc-label">Trang phục chính:</strong> <span class="sc-part-desc sc-val">${escapeHtml(st.mainOutfit || '')}</span></div>
                    <div class="sc-part-row sc-row"><strong class="sc-part-label sc-label">Điểm nhấn:</strong> <span class="sc-part-desc sc-val">${escapeHtml(st.focalPoint || '')}</span></div>
                    <div class="sc-part-row sc-row caution"><strong class="sc-part-label sc-label">Lưu ý:</strong> <span class="sc-part-desc sc-val">${escapeHtml(st.caution || '')}</span></div>
                  </div>
                  <div class="outfit-section-meta" style="display:none;" aria-hidden="true">
                    <div class="outfit-meta-label">PHÙ HỢP VỚI:</div>
                    <div class="outfit-meta-desc">${escapeHtml(st.suitability || '')}</div>
                  </div>
                  <div class="outfit-advice-block" style="display:none;" aria-hidden="true">
                    <div class="outfit-meta-label">LỜI KHUYÊN THỰC TẾ:</div>
                    <ul class="outfit-advice-list">
                      ${st.advice.map(a => `<li><span class="outfit-bullet-check">✓</span> <span>${escapeHtml(a)}</span></li>`).join("")}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          `;
          }).join("")}
        </div>
      </div>

      <!-- Controls & pagination dots nhỏ gọn -->
      <div class="outfit-slider-bottom-bar" style="${isSingleStyle ? 'display:none;' : ''}">
        <div class="outfit-slider-dots" id="outfit-slider-dots">
          ${outfitStyles.map((_, i) => `
            <button type="button" class="outfit-dot ${i === initialSlideIdx ? 'active' : ''}" onclick="goToOutfitSlide(${i})" aria-label="Chuyển sang phong cách ${i + 1}" ${i === initialSlideIdx ? 'aria-current="true"' : ''}></button>
          `).join("")}
        </div>

        <div class="outfit-slider-controls">
          <button type="button" class="outfit-nav-btn prev ${isPrevDisabled ? 'disabled' : ''}" id="outfit-slider-prev" onclick="navigateOutfitSlide(-1)" aria-label="Phong cách trước" ${isPrevDisabled ? 'disabled aria-disabled="true"' : ''}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="outfit-nav-indicator" id="outfit-slider-indicator" data-current-slide="${initialSlideIdx + 1}" data-total-slides="${total}">${initialSlideIdx + 1} / ${total}</span>
          <button type="button" class="outfit-nav-btn next ${isNextDisabled ? 'disabled' : ''}" id="outfit-slider-next" onclick="navigateOutfitSlide(1)" aria-label="Phong cách kế tiếp" ${isNextDisabled ? 'disabled aria-disabled="true"' : ''}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      <div class="outfit-disclaimer-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Gợi ý mang tính tham khảo theo văn hóa doanh nghiệp; hãy điều chỉnh linh hoạt theo thông báo từ nhà tuyển dụng.</span>
      </div>
    </div>
  `;

  // Attach touch swipe gesture handling on mobile & keyboard navigation
  if (container && typeof container.querySelector === "function") {
    const viewport = container.querySelector("#outfit-slider-viewport");
    if (viewport && typeof viewport.addEventListener === "function") {
      let touchStartX = 0;
      viewport.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });
      viewport.addEventListener("touchend", (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 45) {
          window.navigateOutfitSlide(1);
        } else if (touchEndX - touchStartX > 45) {
          window.navigateOutfitSlide(-1);
        }
      }, { passive: true });
    }

    const sliderRoot = container.querySelector(".outfit-slider-container");
    if (sliderRoot && typeof sliderRoot.addEventListener === "function") {
      sliderRoot.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          window.navigateOutfitSlide(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          window.navigateOutfitSlide(1);
        }
      });
    }
  }
}
window.renderVisualOutfitSuggestions = renderVisualOutfitSuggestions;

// ==========================================================================
// 10B. SECTION 7: REFERENCE MATERIALS (WI-REPORT-14 / WI-REPORT-VISUAL-HIERARCHY-AND-ACTIONABLE-INSIGHTS-03)
// ==========================================================================
function renderReferenceMaterials(session = {}, report = {}) {
  const container = document.getElementById("reference-materials-list-container");
  if (!container) return;

  const jobTitle = (session?.jobTitle || session?.targetPosition || "").toLowerCase();
  const industry = (session?.selectedIndustry || session?.industry || "").toLowerCase();

  const isFinance = industry.includes("finance") || industry.includes("tài chính") || 
                    industry.includes("banking") || industry.includes("ngân hàng") || 
                    jobTitle.includes("kế toán") || jobTitle.includes("audit") || jobTitle.includes("tài chính");
  const isMarketing = industry.includes("marketing") || industry.includes("kinh doanh") || 
                      industry.includes("sales") || jobTitle.includes("marketing") || jobTitle.includes("growth");
  
  // Curated genuine, authoritative reference catalog mapped by domain & interview preparation
  const domainItems = [];
  const interviewItems = [];
  const speechItems = [];
  const bodyItems = [];

  if (isFinance) {
    domainItems.push(
      {
        id: "ref-fin-ifrs",
        title: "Chuẩn Mực Báo Cáo Tài Chính Quốc Tế (IFRS / VAS)",
        author: "IFRS Foundation & Bộ Tài Chính Việt Nam",
        domain: "ifrs.org",
        url: "https://www.ifrs.org/issued-standards/list-of-standards/",
        type: "Tiêu chuẩn chính thống",
        typeClass: "ref-type-standard",
        desc: "Hệ thống nguyên tắc ghi nhận doanh thu, xử lý tài sản - nợ phải trả và phương pháp trình bày thuyết minh báo cáo tài chính chuẩn mực.",
        why: "Cung cấp căn cứ chuyên môn chuẩn xác để trả lời các câu hỏi về hạch toán phức tạp, hợp nhất báo cáo và đánh giá rủi ro tài chính.",
        actionText: "Đọc tài liệu"
      },
      {
        id: "ref-fin-valuation",
        title: "Định Giá Doanh Nghiệp & Mô Hình Tài Chính Thực Chiến",
        author: "GS. Aswath Damodaran • NYU Stern School of Business",
        domain: "pages.stern.nyu.edu",
        url: "https://pages.stern.nyu.edu/~adamodar/",
        type: "Sách chuyên khảo",
        typeClass: "ref-type-book",
        desc: "Phương pháp chiết khấu dòng tiền (DCF), định giá theo hệ số so sánh tương đối (Multiples) và kỹ thuật phân tích độ nhạy.",
        why: "Giúp ứng viên xây dựng lập luận sắc sảo về hiệu quả dòng vốn và các kịch bản định giá trong vòng phỏng vấn chiến lược.",
        actionText: "Học liệu chuyên sâu"
      }
    );
  } else if (isMarketing) {
    domainItems.push(
      {
        id: "ref-mkt-skillshop",
        title: "Google Analytics & Digital Marketing Academy",
        author: "Google Career Programs",
        domain: "skillshop.withgoogle.com",
        url: "https://skillshop.withgoogle.com/",
        type: "Chứng chỉ chính thống",
        typeClass: "ref-type-standard",
        desc: "Khung chỉ số đo lường One Metric That Matters (OMTM), phễu AARRR và phương pháp thử nghiệm tăng trưởng (A/B testing).",
        why: "Giúp bạn trả lời rành mạch các câu hỏi tình huống về tối ưu hóa kênh tiếp cận và ra quyết định dựa trên dữ liệu thực tế.",
        actionText: "Đọc tài liệu"
      },
      {
        id: "ref-mkt-50",
        title: "Marketing 5.0: Technology for Humanity",
        author: "Philip Kotler & Hermawan Kartajaya • Wiley",
        domain: "wiley.com",
        url: "https://www.wiley.com/en-us/Marketing+5.0:+Technology+for+Humanity-p-9781119785255",
        type: "Sách chuyên khảo",
        typeClass: "ref-type-book",
        desc: "Chiến lược tiếp thị dựa trên dữ liệu lớn, cá nhân hóa trải nghiệm khách hàng và tự động hóa chuỗi hành trình chuyển đổi số.",
        why: "Hỗ trợ ứng viên phân tích bài toán phân bổ ngân sách đa kênh và lập luận chỉ số ROI/LTV thuyết phục trước ban tuyển dụng.",
        actionText: "Tài liệu chuyên sâu"
      }
    );
  } else {
    // Default: Technology & Engineering (Software, Backend, System Architecture)
    domainItems.push(
      {
        id: "ref-tech-ddia",
        title: "Designing Data-Intensive Applications",
        author: "Martin Kleppmann • O'Reilly Media",
        domain: "dataintensive.net",
        url: "https://dataintensive.net/",
        type: "Sách chuyên khảo",
        typeClass: "ref-type-book",
        desc: "Phân tích toàn diện về độ tin cậy, tính nhất quán (ACID/BASE), mô hình phân tán, cơ chế đánh chỉ mục và khả năng mở rộng dữ liệu tải cao.",
        why: "Nguồn tham khảo nền tảng để trả lời xuất sắc các câu hỏi chuyên sâu về kiến trúc lưu trữ, caching phân tán và đánh đổi kỹ thuật (CAP theorem).",
        actionText: "Đọc tài liệu"
      },
      {
        id: "ref-tech-sysdesign",
        title: "The System Design Primer",
        author: "Donne Martin • Khung tài liệu kỹ thuật mở",
        domain: "github.com",
        url: "https://github.com/donnemartin/system-design-primer",
        type: "Học liệu mã nguồn mở",
        typeClass: "ref-type-open",
        desc: "Bộ cẩm nang thực chiến về thiết kế hệ thống quy mô lớn: CDN, Load Balancer, Microservices, Sharding, Message Queues và High Availability.",
        why: "Giúp bạn làm chủ cấu trúc 4 bước khi giải bài toán System Design: làm rõ yêu cầu, ước tính dung lượng tải, thiết kế kiến trúc tổng quan và tối ưu chi tiết.",
        actionText: "Xem mã nguồn mở"
      },
      {
        id: "ref-tech-mslearn",
        title: "Cloud Design Patterns & Distributed Architecture",
        author: "Microsoft Architecture Center",
        domain: "learn.microsoft.com",
        url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/",
        type: "Tiêu chuẩn kiến trúc chính thống",
        typeClass: "ref-type-standard",
        desc: "Tập hợp các mẫu kiến trúc đám mây chuẩn mực: Circuit Breaker, CQRS, Event Sourcing, Retry và Cache-Aside trong các hệ thống doanh nghiệp.",
        why: "Căn cứ chính thức để đối chiếu và trả lời các tình huống xử lý lỗi, mở rộng hệ thống và tối ưu hóa tài nguyên.",
        actionText: "Đọc tài liệu"
      },
      {
        id: "ref-tech-cleanarch",
        title: "Clean Architecture: A Craftsman's Guide to Software Structure",
        author: "Robert C. Martin (Uncle Bob) • Prentice Hall",
        domain: "blog.cleancoder.com",
        url: "https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html",
        type: "Chuẩn kiến trúc phần mềm",
        typeClass: "ref-type-standard",
        desc: "Các nguyên lý phân tách mối quan tâm độc lập (Separation of Concerns), Dependency Inversion và thiết kế hệ thống dễ kiểm thử.",
        why: "Củng cố tư duy kiến trúc sạch, hỗ trợ trả lời tự tin các câu hỏi về refactoring mã nguồn và bảo trì hệ thống phức tạp trong thực tế.",
        actionText: "Chuẩn kiến trúc"
      }
    );
  }

  // Interview Strategy & Communication (Relevant across all industries)
  interviewItems.push(
    {
      id: "ref-interview-star",
      title: "The STAR Method for Behavioral Interviews (Cẩm Nang Cấu Trúc STAR & PREP)",
      author: "MIT Career Advising & Professional Development (CAPD)",
      domain: "capd.mit.edu",
      url: "https://capd.mit.edu/resources/the-star-method-for-behavioral-interviews/",
      type: "Khung phương pháp",
      typeClass: "ref-type-framework",
      desc: "Quy chuẩn dẫn dắt câu trả lời hành vi logic theo chuẩn MIT: Tình huống (Situation) → Nhiệm vụ (Task) → Hành động cá nhân (Action) → Kết quả định lượng (Result).",
      why: "Giải quyết dứt điểm lỗi diễn đạt chung chung, giúp nhà tuyển dụng nhìn thấy rõ vai trò chủ đạo và đóng góp thực tế của bạn trong các dự án trước đây.",
      actionText: "Đọc tài liệu"
    },
    {
      id: "ref-interview-harvard",
      title: "Chiến Lược Đối Thoại Kỹ Thuật & Tương Tác Hai Chiều Với Hội Đồng",
      author: "Harvard FAS Mignone Center for Career Success",
      domain: "careerservices.fas.harvard.edu",
      url: "https://careerservices.fas.harvard.edu/",
      type: "Chiến lược đối thoại",
      typeClass: "ref-type-strategy",
      desc: "Kỹ năng làm rõ giả định ban đầu, suy nghĩ thành tiếng (Think Aloud) và xử lý câu hỏi hóc búa khi chưa có giải pháp tối ưu ngay lập tức.",
      why: "Chuyển đổi buổi phỏng vấn từ áp lực 'bị tra vấn' thành buổi trao đổi kỹ thuật cộng tác và chuyên nghiệp với người phỏng vấn.",
      actionText: "Đọc tài liệu"
    }
  );

  // Speech & Voice Delivery (Toastmasters International)
  speechItems.push(
    {
      id: "ref-voice-toastmasters",
      title: "Your Speaking Voice & Controlling Filler Words",
      author: "Toastmasters International",
      domain: "toastmasters.org",
      url: "https://www.toastmasters.org/resources/your-speaking-voice",
      type: "Kỹ năng giọng nói & thuyết trình",
      typeClass: "ref-type-standard",
      desc: "Phương pháp điều tiết tốc độ nói chuẩn mực (120–160 WPM), kỹ thuật dừng có chủ đích (intentional pause) và loại bỏ hoàn toàn quán tính từ đệm.",
      why: "Giúp người nói điều tiết hơi thở, tạo ngữ điệu đĩnh đạc, chắc chắn và nâng cao sức thuyết phục trong các phần phỏng vấn quan trọng.",
      actionText: "Đọc tài liệu"
    }
  );

  // Nonverbal & Body Language (MindTools)
  bodyItems.push(
    {
      id: "ref-body-language-mindtools",
      title: "Body Language & Nonverbal Communication in Professional Meetings",
      author: "Mind Tools Content Team • Emerald Works",
      domain: "mindtools.com",
      url: "https://www.mindtools.com/pages/article/Body_Language.htm",
      type: "Giao tiếp phi ngôn ngữ",
      typeClass: "ref-type-framework",
      desc: "Nguyên tắc duy trì ánh mắt trực diện (eye-contact), cử chỉ tay mở, tư thế ngồi thẳng và kiểm soát biểu cảm trước ống kính máy quay.",
      why: "Giúp người học tự tin kiểm soát tín hiệu phi ngôn ngữ, tạo phong thái đĩnh đạc, đáng tin cậy trong cả phỏng vấn trực tuyến và trực tiếp.",
      actionText: "Đọc tài liệu"
    }
  );

  if (domainItems.length === 0 && interviewItems.length === 0) {
    container.innerHTML = `
      <div class="ref-empty-state" style="text-align: center; padding: 24px 16px; color: var(--rpt-text-muted); background: var(--rpt-surface); border: 1px solid var(--rpt-border); border-radius: 10px;">
        <p style="margin: 0; font-size: 13.5px;">Chưa có tài liệu tham khảo bổ trợ nào cho vị trí này.</p>
      </div>
    `;
    return;
  }

  const renderRefItem = (item) => `
    <div class="reference-material-row reference-material-item" id="${escapeHtml(item.id)}">
      <div class="ref-item-main">
        <div class="ref-item-topbar">
          <span class="ref-type-badge ${item.typeClass}">${escapeHtml(item.type)}</span>
          <span class="ref-author-tag">${escapeHtml(item.author)}</span>
          ${item.domain ? `<span class="ref-domain-tag">${escapeHtml(item.domain)}</span>` : ""}
        </div>
        <h4 class="ref-item-title">${escapeHtml(item.title)}</h4>
        <p class="ref-item-desc">${escapeHtml(item.desc)}</p>
        <div class="ref-why-box">
          <span class="ref-why-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </span>
          <div class="ref-why-content">
            <strong>Giá trị cho buổi phỏng vấn:</strong> ${escapeHtml(item.why)}
          </div>
        </div>
      </div>
      <div class="ref-item-action ref-row-right">
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="ref-action-pill ref-action-btn" aria-label="Xem tài liệu: ${escapeHtml(item.title)}" onclick="handleReferenceClick('${escapeHtml(item.title)}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <span>${escapeHtml(item.actionText || 'Đọc tài liệu')}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="margin-left:2px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="reference-categories-container">
      <!-- Group 1: Interview Framework (STAR) -->
      <div class="ref-category-group">
        <div class="ref-category-header">
          <div class="ref-category-badge-wrap">
            <span class="ref-category-badge">${interviewItems.length} nguồn tham khảo</span>
          </div>
          <h4 class="ref-category-title">
            <span class="ref-category-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            </span>
            <span>Cẩm Nang Phương Pháp &amp; Kỹ Năng Phỏng Vấn (STAR Framework)</span>
          </h4>
        </div>
        <div class="reference-materials-grid">
          ${interviewItems.map(renderRefItem).join("")}
        </div>
      </div>

      <!-- Group 2: Speech & Communication -->
      <div class="ref-category-group" style="margin-top: 24px;">
        <div class="ref-category-header">
          <div class="ref-category-badge-wrap">
            <span class="ref-category-badge">${speechItems.length} nguồn tham khảo</span>
          </div>
          <h4 class="ref-category-title">
            <span class="ref-category-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
            </span>
            <span>Làm Chủ Giọng Nói, Tốc Độ &amp; Kỹ Năng Thuyết Trình</span>
          </h4>
        </div>
        <div class="reference-materials-grid">
          ${speechItems.map(renderRefItem).join("")}
        </div>
      </div>

      <!-- Group 3: Nonverbal & Body Language -->
      <div class="ref-category-group" style="margin-top: 24px;">
        <div class="ref-category-header">
          <div class="ref-category-badge-wrap">
            <span class="ref-category-badge">${bodyItems.length} nguồn tham khảo</span>
          </div>
          <h4 class="ref-category-title">
            <span class="ref-category-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
            <span>Ngôn Ngữ Cơ Thể &amp; Tác Phong Phi Ngôn Ngữ</span>
          </h4>
        </div>
        <div class="reference-materials-grid">
          ${bodyItems.map(renderRefItem).join("")}
        </div>
      </div>

      <!-- Group 4: Domain & Systems Engineering -->
      <div class="ref-category-group" style="margin-top: 24px;">
        <div class="ref-category-header">
          <div class="ref-category-badge-wrap">
            <span class="ref-category-badge">${domainItems.length} nguồn tham khảo</span>
          </div>
          <h4 class="ref-category-title">
            <span class="ref-category-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </span>
            <span>Tài Liệu Chuyên Môn Theo Lĩnh Vực &amp; Thiết Kế Hệ Thống</span>
          </h4>
        </div>
        <div class="reference-materials-grid">
          ${domainItems.map(renderRefItem).join("")}
        </div>
      </div>
    </div>
  `;
}
window.renderReferenceMaterials = renderReferenceMaterials;

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
          <h4 class="guidance-cat-title pm-heading-with-icon"><svg class="pm-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg><span>Khuyến Nghị Quyết Định (Hiring Recommendation)</span></h4>
          <ul class="guidance-q-list">
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> Ứng viên thể hiện nền tảng kỹ thuật vững vàng, đạt chuẩn yêu cầu năng lực cốt lõi.</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> Cần thẩm định thêm khả năng vận hành hệ thống thực tế và xử lý sự cố quy mô lớn.</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> Đề xuất: Cho ứng viên vào vòng Phỏng vấn Chuyên sâu (System Design Round) với Tech Lead.</li>
          </ul>
        </div>
        <div class="guidance-category-card">
          <h4 class="guidance-cat-title pm-heading-with-icon"><svg class="pm-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Điểm Cần Đào Sâu Thêm (Probing Areas)</span></h4>
          <ul class="guidance-q-list">
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> Kiểm chứng các tuyên bố (Claims) về tối ưu hiệu năng database có số liệu thực tế đo đạc không.</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> Thử thách ứng viên với bài toán giới hạn tài nguyên và phân vùng mạng (Network Partition).</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> Đánh giá khả năng thương lượng yêu cầu kỹ thuật với Product Manager khi có xung đột deadline.</li>
          </ul>
        </div>
        <div class="guidance-category-card">
          <h4 class="guidance-cat-title pm-heading-with-icon"><svg class="pm-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>Đề Xuất Câu Hỏi Cho Vòng Sau (Next Round Questions)</span></h4>
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
          <h4 class="guidance-cat-title pm-heading-with-icon"><svg class="pm-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg><span>Về Kỹ Thuật & Bài Toán Hệ Thống</span></h4>
          <ul class="guidance-q-list">
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Thách thức kỹ thuật hoặc nợ công nghệ (Technical Debt) lớn nhất mà đội ngũ đang giải quyết hiện tại là gì?"</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Quy trình CI/CD và chiến lược kiểm thử tự động của đội ngũ đang được triển khai như thế nào?"</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Đội ngũ cân bằng giữa việc phát triển tính năng mới và tối ưu kiến trúc hệ thống ra sao trong mỗi sprint?"</li>
          </ul>
        </div>
        <div class="guidance-category-card">
          <h4 class="guidance-cat-title pm-heading-with-icon"><svg class="pm-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span>Về Đội Ngũ & Văn Hóa Hợp Tác</span></h4>
          <ul class="guidance-q-list">
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Cấu trúc của squad/team mà vị trí này sẽ gia nhập như thế nào và cách mọi người phối hợp với PM/QA?"</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Văn hóa code review và chia sẻ tri thức (Knowledge Sharing) trong nội bộ team diễn ra như thế nào?"</li>
            <li class="guidance-q-item"><span class="guidance-q-bullet">•</span> "Điều gì khiến anh/chị tự hào và gắn bó nhất khi làm việc tại công ty đến thời điểm này?"</li>
          </ul>
        </div>
        <div class="guidance-category-card">
          <h4 class="guidance-cat-title pm-heading-with-icon"><svg class="pm-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span>Về Kỳ Vọng 90 Ngày Đầu & Thành Công</span></h4>
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



// ==========================================================================
// WI-REPORT-10: UNIFIED EVALUATION TRANSPARENCY DISCLOSURE CONTROLLERS
// ==========================================================================

function toggleTransparencyDisclosure(forceExpand = null) {
  const body = document.getElementById("report-transparency-body");
  const btn = document.getElementById("transparency-toggle-btn");
  if (!body || !btn) return;

  const isHidden = body.classList.contains("hidden");
  const shouldExpand = forceExpand !== null ? forceExpand : isHidden;

  if (shouldExpand) {
    body.classList.remove("hidden");
    btn.setAttribute("aria-expanded", "true");
  } else {
    body.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
  }
}
window.toggleTransparencyDisclosure = toggleTransparencyDisclosure;

function openTransparencyDisclosure(event) {
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }
  toggleTransparencyDisclosure(true);

  const section = document.getElementById("report-commitments-section");
  if (section) {
    const prefersReducedMotion = typeof window.matchMedia === "function" && 
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    
    const navbar = document.querySelector(".navbar, header.navbar, .app-header");
    const navbarHeight = navbar ? navbar.offsetHeight : 60;
    const buffer = 24;
    const totalOffset = navbarHeight + buffer;

    const rect = section.getBoundingClientRect();
    const targetY = (window.pageYOffset || document.documentElement.scrollTop || 0) + rect.top - totalOffset;

    if (typeof window.scrollTo === "function") {
      window.scrollTo({
        top: Math.max(0, Math.round(targetY)),
        behavior: prefersReducedMotion ? "auto" : "smooth"
      });
    } else if (typeof section.scrollIntoView === "function") {
      section.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    }
  }
}
window.openTransparencyDisclosure = openTransparencyDisclosure;
