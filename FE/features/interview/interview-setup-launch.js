// ==========================================
// PREPMATE — INTERVIEW SETUP LAUNCH MODULE
// ARCHITECTURE: SETUP CONFIGURATION & LAUNCH
// ==========================================

var INTERVIEW_SESSION_STORAGE_KEY = (typeof window !== "undefined" && window.INTERVIEW_SESSION_STORAGE_KEY) || "prepmate_backend_session_id";
if (typeof window !== "undefined") { window.INTERVIEW_SESSION_STORAGE_KEY = INTERVIEW_SESSION_STORAGE_KEY; }

let isStartingInterview = false;

async function startInterview() {
  if (isStartingInterview) return;

  const jobTitle = document.getElementById("job-title")?.value.trim();
  const seniority = document.querySelector('input[name="seniority"]:checked')?.value || "Senior";
  const companyName = document.getElementById("company-name")?.value.trim() || "";
  const interviewRound = document.getElementById("interview-round")?.value || "round2";
  const cvText = document.getElementById("cv-text")?.value.trim() || window._extractedCvText || "";
  const jdText = document.getElementById("jd-text")?.value.trim() || "";
  const userDescription = document.getElementById("user-description")?.value.trim() || "";
  const interviewerPersona = (typeof getSelectedPersona === "function" ? getSelectedPersona() : "")
    || document.getElementById("interviewer-persona")?.value
    || (typeof localStorage !== "undefined" ? localStorage.getItem("prepmate_interviewer_persona") : "")
    || "professional";
  const interviewLanguage = document.getElementById("interview-language")?.value || "vi";
  const enableCamera = document.getElementById("enable-camera")?.checked || false;
  const enableHandsFree = document.getElementById("enable-handsfree")?.checked || false;

  if (!jobTitle) {
    if (typeof goToStep === "function") {
      goToStep(1);
    }
    if (typeof triggerStep1Error === "function") {
      triggerStep1Error();
    } else {
      const el = document.getElementById("job-title");
      if (el) {
        el.classList.add("input-error");
        el.focus();
        setTimeout(() => { el.classList.remove("input-error"); }, 3000);
      }
      const err = document.getElementById("job-title-error");
      if (err) err.classList.remove("hidden");
    }
    if (typeof showToast === "function") {
      showToast("Vui lòng nhập vị trí ứng tuyển mục tiêu để bắt đầu!", "danger");
    }
    return;
  }

  if (typeof fetchUserQuota === "function") {
    try {
      const quota = await fetchUserQuota(true);
      if (quota && !quota.canStart) {
        if (quota.tier === "guest" && typeof promptGuestLogin === "function") {
          promptGuestLogin();
          return;
        }
        if (typeof showUpgradeModal === "function") {
          const reason = quota.tier === "guest"
            ? "Bạn đã sử dụng hết <strong>1 lượt phỏng vấn thử nghiệm (Demo)</strong> dành cho Khách. Vui lòng đăng nhập hoặc đăng ký tài khoản để tiếp tục luyện tập."
            : "Bạn đã sử dụng hết <strong>3 lượt phỏng vấn miễn phí</strong> trong tháng này. Nâng cấp tài khoản PRO để luyện tập không giới hạn!";
          showUpgradeModal(reason);
        }
        return;
      }
    } catch (e) {
      console.warn("Quota pre-check failed:", e);
    }
  } else if (typeof getFreeTierStatus === "function") {
    const tierStatus = getFreeTierStatus();
    if (tierStatus && tierStatus.remaining <= 0) {
      if (tierStatus.isGuest && typeof promptGuestLogin === "function") {
        promptGuestLogin();
        return;
      }
      if (typeof showUpgradeModal === "function") {
        showUpgradeModal("Bạn đã sử dụng hết số lượt phỏng vấn cho phép.");
      }
      return;
    }
  }

  const startBtn = document.getElementById("btn-start-interview");
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.classList.add("loading");
    startBtn.dataset.originalHtml = startBtn.innerHTML;
    startBtn.innerHTML = `
      <span class="btn-spinner" style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:8px;vertical-align:middle;"></span>
      <span>Đang chuẩn bị phòng phỏng vấn...</span>
    `;
  }

  isStartingInterview = true;

  try {
    const selectedIndustry = (typeof getSelectedIndustryId === "function" ? getSelectedIndustryId() : "") ||
      sessionStorage.getItem("prepmate_selected_industry") || "";
    const domainContextNotes = typeof gatherDomainContextNotes === "function" ? gatherDomainContextNotes() : "";
    const experienceYears = document.getElementById("experience-years")?.value || "auto";
    const levelContextNotes = (typeof window !== "undefined" && window.PrepMateTaxonomy && typeof window.PrepMateTaxonomy.getAdaptiveLevelContext === "function")
      ? window.PrepMateTaxonomy.getAdaptiveLevelContext(seniority, experienceYears)
      : "";

    let enrichedDescription = userDescription;
    if (levelContextNotes) {
      enrichedDescription = enrichedDescription ? `${enrichedDescription}\n${levelContextNotes}` : levelContextNotes;
    }
    if (domainContextNotes) {
      enrichedDescription = enrichedDescription ? `${enrichedDescription}\n${domainContextNotes}` : domainContextNotes;
    }

    const config = {
      jobTitle,
      seniority,
      targetLevel: seniority,
      experienceLevel: seniority,
      experienceYears,
      companyName,
      interviewRound,
      cvText,
      jdText,
      userDescription: enrichedDescription,
      selectedIndustry,
      interviewerPersona,
      interviewLanguage,
      enableCamera,
      enableHandsFree,
      ttsVoice: (() => {
        const activePersonaId = interviewerPersona || "professional";
        const pObj = (typeof window !== "undefined" && window.PrepMatePersonas && typeof window.PrepMatePersonas.getPersona === "function")
          ? window.PrepMatePersonas.getPersona(activePersonaId)
          : null;
        const personaVoiceId = pObj?.voiceId || pObj?.defaultVoiceId || (activePersonaId === "friendly" ? "3BUMLmVV2cgPJQ2pAwBa" : (activePersonaId === "professional" ? "yTpM1yhZn6oZ0xMLpLFT" : "GbyYOHheg88tlJBFNEYY"));
        const currentTts = (typeof window !== "undefined" && typeof window.getTtsVoiceConfig === "function")
          ? window.getTtsVoiceConfig()
          : {};

        const resolvedVoice = {
          provider: "elevenlabs",
          voiceId: personaVoiceId,
          personaId: activePersonaId,
          modelId: "eleven_flash_v2_5",
          speed: typeof currentTts.speed === "number" ? currentTts.speed : 1.0,
          pitch: pObj?.pitch ?? 1.0,
          rate: pObj?.rate ?? 1.0,
          fallbackVoiceGender: pObj?.fallbackVoiceGender || (activePersonaId === "friendly" ? "female" : "male"),
          name: pObj?.name || (activePersonaId === "friendly" ? "Lê Lan Anh" : (activePersonaId === "professional" ? "Trần Minh Vũ" : "Nguyễn Hoàng Nam")),
        };
        try {
          localStorage.setItem("prepmate_interviewer_persona", activePersonaId);
          localStorage.setItem("prepmate_tts_voice_config", JSON.stringify(resolvedVoice));
        } catch (e) {}
        return resolvedVoice;
      })(),
    };

    sessionStorage.setItem("interview_init_data", JSON.stringify(config));
    sessionStorage.removeItem(INTERVIEW_SESSION_STORAGE_KEY);
    if (typeof window !== "undefined" && window.PrepMatePersonas && typeof window.PrepMatePersonas.stopGreeting === "function") {
      try { window.PrepMatePersonas.stopGreeting(); } catch (e) {}
    }
    window.location.href = "interview-practice.html";
  } catch (err) {
    console.error("[START INTERVIEW] Launch error:", err);
    isStartingInterview = false;
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.classList.remove("loading");
      if (startBtn.dataset.originalHtml) {
        startBtn.innerHTML = startBtn.dataset.originalHtml;
      }
    }
    if (typeof showToast === "function") {
      showToast("Có lỗi xảy ra khi chuẩn bị phòng phỏng vấn. Vui lòng thử lại.", "danger");
    }
  }
}
window.startInterview = startInterview;
