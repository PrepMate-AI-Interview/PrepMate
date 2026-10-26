// ==========================================
// PREPMATE — CHAT BOX & MESSAGE RENDERING
// ARCHITECTURE: INTERVIEW PRACTICE ROOM CHAT HUD
// ==========================================

/**
 * Appends User message to Chat (RULE 11: exactly once, only in sendMessage)
 */
function appendUserMessage(text, turnIndex = null) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox || !text) return null;

  const normalized = String(text).trim();
  if (!normalized) return null;

  if (typeof window !== "undefined") {
    window._lastAppendedAiMessage = ""; // Reset AI check tracker so AI question can follow
  }

  const msg = document.createElement("div");
  msg.className = "msg user-msg";
  msg.textContent = normalized;

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  if (typeof debugInterview === "function") {
    debugInterview("CHAT", "Appended User message.");
  }

  // Attach audio playback widget if recording exists for this turn (WI-COACH-AUDIO-01)
  if (typeof turnIndex === "number" && typeof PrepMateAudioRecorder !== "undefined" && typeof PrepMateAudioPlayer !== "undefined") {
    const sessId = (typeof currentInterviewSession !== "undefined" && (currentInterviewSession?.backendSessionId || currentInterviewSession?.id))
      || (typeof sessionStorage !== "undefined" && sessionStorage.getItem("prepmate_backend_session_id"))
      || "";
    if (sessId) {
      const recordId = `${sessId}_turn_${turnIndex}`;
      setTimeout(async () => {
        try {
          const record = await PrepMateAudioRecorder.getRecording(recordId);
          if (record && record.audioBlob && record.audioBlob.size > 0) {
            const playerEl = PrepMateAudioPlayer.createAudioPlayerElement(record, { compact: true, showNote: false });
            msg.appendChild(playerEl);
            chatBox.scrollTop = chatBox.scrollHeight;
          }
        } catch (e) {}
      }, 200);
    }
  }

  return msg;
}

/**
 * Resolves display name of current interviewer persona from DOM with fallback
 */
function getActiveInterviewerDisplayName() {
  const el = document.getElementById("interviewer-name-display");
  if (el && el.textContent.trim()) {
    return `${el.textContent.trim()} (Người phỏng vấn)`;
  }
  return "Trần Minh Vũ (Người phỏng vấn)";
}

/**
 * Resolves avatar initials of current interviewer persona from DOM with fallback
 */
function getActiveInterviewerInitials() {
  const el = document.querySelector("#interviewer-avatar-preview span");
  if (el && el.textContent.trim()) {
    return el.textContent.trim();
  }
  return "MV";
}

/**
 * Appends AI message to Chat (RULE 10: Anti-duplicate check)
 */
function appendAIMessage(text, headerLabel = null, isFollowUp = false) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox || !text) return;

  const normalized = String(text).trim();
  if (!normalized) return;

  // Check if last message rendered in chatBox is already an AI message with this exact text
  const lastMsg = chatBox.lastElementChild;
  if (lastMsg && lastMsg.classList.contains("ai-msg")) {
    const lastText = lastMsg.querySelector(".msg-text")?.textContent?.trim() || "";
    if (lastText === normalized) {
      if (typeof debugInterview === "function") {
        debugInterview("CHAT", "Prevented duplicate consecutive AI message render:", normalized.substring(0, 40));
      }
      return;
    }
  }

  if (typeof window !== "undefined") {
    window._lastAppendedAiMessage = normalized;
  }

  const resolvedHeader = headerLabel || getActiveInterviewerDisplayName();
  const resolvedInitials = getActiveInterviewerInitials();

  const msg = document.createElement("div");
  msg.className = "msg ai-msg";

  const followUpTag = isFollowUp ? ' <span class="follow-up-indicator">Đào sâu</span>' : "";

  const safeEscape = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");

  msg.innerHTML = `
    <div class="msg-avatar-thumb">
      <div class="msg-avatar-badge interviewer-badge">
        <span>${safeEscape(resolvedInitials)}</span>
      </div>
    </div>
    <div class="msg-body">
      <div class="ai-msg-header">
        <span>${safeEscape(resolvedHeader)}${followUpTag}</span>
      </div>
      <div class="msg-text">${safeEscape(normalized)}</div>
    </div>
  `;

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  if (typeof debugInterview === "function") {
    debugInterview("CHAT", "Appended AI message:", normalized.substring(0, 40));
  }
}

/**
 * Renders default initial welcome message in Chat box
 */
function renderNewInterviewWelcomeMessage() {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;

  const displayName = getActiveInterviewerDisplayName();
  const initials = getActiveInterviewerInitials();
  const nameOnly = displayName.replace(/\s*\(.*?\)\s*/, "");

  chatBox.innerHTML = `
    <div class="msg ai-msg">
      <div class="msg-avatar-thumb">
        <div class="msg-avatar-badge interviewer-badge">
          <span>${initials}</span>
        </div>
      </div>
      <div class="msg-body">
        <div class="ai-msg-header">
          <span>${displayName}</span>
          <span class="msg-timestamp">Chuẩn bị</span>
        </div>
        <div class="msg-text">
          Xin chào bạn! Tôi là ${nameOnly}, người đồng hành cùng bạn trong buổi phỏng vấn hôm nay. Bạn hãy kiểm tra lại góc máy camera, âm thanh micro và nhấn nút <strong>"Bắt đầu"</strong> ở góc trên bên phải khi đã sẵn sàng nhé!
        </div>
      </div>
    </div>
  `;
}

/**
 * Appends inline System Error message to Chat (role="alert")
 */
function appendInterviewErrorMessage(errorMessage, title = "Lỗi kết nối AI") {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;

  // Clear previous error message if present to prevent multiple consecutive duplicate error cards
  clearInterviewErrorMessage();

  const safeEscape = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
  const normalizedTitle = safeEscape(String(title || "Lỗi xử lý phản hồi").trim());
  const normalizedMsg = safeEscape(String(errorMessage || "Không thể kết nối đến mô hình AI.").trim());

  const msg = document.createElement("div");
  msg.className = "msg system-msg error-msg";
  msg.setAttribute("role", "alert");

  msg.innerHTML = `
    <div class="msg-avatar-thumb">
      <div class="msg-avatar-badge error-badge" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;font-weight:700;">
        <span>!</span>
      </div>
    </div>
    <div class="msg-body">
      <div class="ai-msg-header error-header">
        <span style="color:#dc2626;font-weight:600;">${normalizedTitle}</span>
      </div>
      <div class="msg-text error-card" style="color:#991b1b;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 12px;margin-top:4px;">
        <p style="margin:0 0 6px 0;line-height:1.45;font-size:12.5px;">${normalizedMsg}</p>
        <button type="button" class="btn-chat-retry" onclick="retryInterviewSubmission()" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;font-size:12px;font-weight:600;color:#ffffff;background:#dc2626;border:none;border-radius:4px;cursor:pointer;">
          Thử lại
        </button>
      </div>
    </div>
  `;

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  if (typeof debugInterview === "function") {
    debugInterview("CHAT", "Appended System Error message:", normalizedTitle);
  }
}

/**
 * Clears any inline System Error messages from Chat
 */
function clearInterviewErrorMessage() {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;

  if (Array.isArray(chatBox.children)) {
    for (let i = chatBox.children.length - 1; i >= 0; i--) {
      const child = chatBox.children[i];
      if (child && child.classList && (child.classList.contains("error-msg") || child.classList.contains("system-msg"))) {
        chatBox.children.splice(i, 1);
        if (typeof child.remove === "function") child.remove();
      }
    }
  }
  if (typeof chatBox.querySelectorAll === "function") {
    const existing = chatBox.querySelectorAll(".error-msg");
    if (existing && existing.forEach) {
      existing.forEach((el) => {
        if (el && typeof el.remove === "function") el.remove();
      });
    }
  }
}

if (typeof window !== "undefined") {
  window.appendUserMessage = appendUserMessage;
  window.appendAIMessage = appendAIMessage;
  window.appendInterviewErrorMessage = appendInterviewErrorMessage;
  window.clearInterviewErrorMessage = clearInterviewErrorMessage;
  window.renderNewInterviewWelcomeMessage = renderNewInterviewWelcomeMessage;
  window.getActiveInterviewerDisplayName = getActiveInterviewerDisplayName;
  window.getActiveInterviewerInitials = getActiveInterviewerInitials;
}
