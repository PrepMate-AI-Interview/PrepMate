// ==========================================
// PrepMate - Authentication Manager
// ==========================================
// Responsibilities:
// - Current user/session management
// - Login / Register API
// - Logout
// - Auth guards
// - Role checks
// - User-specific local storage
// - Server user synchronization
// - Gemini API key helpers
//
// IMPORTANT:
// Backend is the source of truth for authentication.
// localStorage is ONLY used to persist the current session.
// ==========================================

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

// =================================================================================
// STORAGE KEYS
// ==========================================

const AUTH_STORAGE_KEY = "prepmate_current_user";
const REMEMBER_STORAGE_KEY = "prepmate_remember_user";
const USERS_STORAGE_KEY = "prepmate_users";
const GEMINI_KEY = "gemini_api_key";

// ==========================================
// CURRENT USER
// ==========================================

function getCurrentUser() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const user = JSON.parse(raw);

    if (!user || !user.id) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return normalizeUser(user);
  } catch (error) {
    console.error("[AUTH] Invalid stored user:", error);

    localStorage.removeItem(AUTH_STORAGE_KEY);

    return null;
  }
}

function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalizeUser(user)));
}

function normalizeUser(user) {
  let sub = user.subscription || "free";
  let scheduled = !!user.scheduledDowngrade;
  if (sub === "pro" && user.subscriptionExpiry) {
    const exp = new Date(user.subscriptionExpiry).getTime();
    if (!isNaN(exp) && exp <= Date.now()) {
      sub = "free";
      scheduled = false;
    }
  }

  return {
    id: user.id || null,

    fullname: user.fullname || user.fullName || user.name || user.username || "",
    email: user.email || "",
    username: user.username || "",

    token: user.token || null,

    role: user.role || "user",
    isAdmin: user.role === "admin",

    subscription: sub,
    subscriptionDate: user.subscriptionDate || null,
    subscriptionExpiry: user.subscriptionExpiry || null,
    scheduledDowngrade: scheduled,

    createdAt: user.createdAt || new Date().toISOString(),
  };
}

function getCurrentUserId() {
  const user = getCurrentUser();

  return user ? user.id : null;
}

function getCurrentUserName() {
  const user = getCurrentUser();

  return user?.fullname || "Khách";
}

function isUserLoggedIn() {
  return getCurrentUser() !== null;
}

function getAuthToken() {
  const user = getCurrentUser();
  return user?.token || null;
}

// ==========================================
// USER-SPECIFIC STORAGE
// ==========================================

function getUserStorageKey(baseKey) {
  const userId = getCurrentUserId();

  return userId ? `${baseKey}_${userId}` : baseKey;
}

function getUserSessions() {
  const key = getUserStorageKey("interview_sessions");

  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (error) {
    console.error("[AUTH] Cannot read sessions:", error);

    return [];
  }
}

function saveUserSessions(sessions) {
  if (!Array.isArray(sessions)) {
    console.warn("[AUTH] Invalid sessions data.");

    return;
  }

  const key = getUserStorageKey("interview_sessions");

  localStorage.setItem(key, JSON.stringify(sessions));
}

// ==========================================
// LOGIN
// ==========================================

async function loginUser(identifier, password) {
  const email = String(identifier || "").trim();
  const cleanPassword = String(password || "");

  if (!email || !cleanPassword) {
    throw new Error("Vui lòng nhập email/username và mật khẩu.");
  }

  console.log("[AUTH] Login request:", email);

  let response;

  try {
    response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        email: email,
        password: cleanPassword,
      }),
    });
  } catch (error) {
    console.error("[AUTH] Backend connection failed:", error);

    throw new Error(
      "Không thể kết nối tới máy chủ. Vui lòng kiểm tra backend.",
    );
  }

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    console.warn("[AUTH] Login failed:", response.status, data);

    const err = new Error(data.error || data.message || "Email/username hoặc mật khẩu không chính xác.");
    if (data.requiresVerification) {
      err.requiresVerification = true;
      err.email = data.email || email;
    }
    throw err;
  }

  if (!data.id || !data.token) {
    console.error("[AUTH] Invalid login response:", data);

    throw new Error("Máy chủ trả về dữ liệu đăng nhập không hợp lệ.");
  }

  const user = normalizeUser(data);

  setCurrentUser(user);

  console.log("[AUTH] Login successful:", user.username);

  return user;
}

// ==========================================
// PASSWORD POLICY & STRENGTH ENGINE (WI-AUTH-01R8)
// ==========================================

function calculatePasswordStrength(password) {
  const pwd = String(password || "");
  if (!pwd) {
    return { score: 0, level: "none", label: "Chưa nhập" };
  }

  let score = 0;

  // Length factors
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (pwd.length >= 16) score += 1;

  // Character variety factors
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSymbol = /[^a-zA-Z0-9\s]/.test(pwd);

  const varietyCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  if (varietyCount >= 2) score += 1;
  if (varietyCount >= 3) score += 1;
  if (varietyCount >= 4) score += 1;

  // Repetition / trivial sequences penalty
  if (/^(.)\1+$/.test(pwd)) score -= 2;
  if (/^(12345678|abcdefgh|password)/i.test(pwd)) score -= 2;

  // Evaluation: score <= 2 -> Yếu, 3-4 -> Trung bình, >= 5 -> Mạnh
  if (pwd.length < 8 || score <= 2) {
    return { score: 1, level: "weak", label: "Yếu" };
  } else if (score <= 4) {
    return { score: 2, level: "medium", label: "Trung bình" };
  } else {
    return { score: 3, level: "strong", label: "Mạnh" };
  }
}

function validatePasswordPolicy(password) {
  const pwd = String(password || "");
  const minLength = pwd.length >= 8;
  const maxLength = pwd.length <= 128;
  let asciiOnly = true;
  for (let i = 0; i < pwd.length; i++) {
    const c = pwd.charCodeAt(i);
    if (c > 126 || (c < 32 && c !== 9 && c !== 10 && c !== 13)) {
      asciiOnly = false;
      break;
    }
    if (c >= 0xD800 && c <= 0xDFFF) {
      asciiOnly = false;
      break;
    }
  }
  const noWhitespace = !/\s/.test(pwd);
  const isValid = minLength && maxLength && asciiOnly && noWhitespace && pwd.length > 0;
  return {
    minLength,
    maxLength,
    asciiOnly,
    noWhitespace,
    isValid
  };
}

if (typeof window !== "undefined") {
  window.validatePasswordPolicy = validatePasswordPolicy;
  window.calculatePasswordStrength = calculatePasswordStrength;
}

// ==========================================
// REGISTER
// ==========================================

async function registerUser({ fullname, email, username, password }) {
  const cleanFullname = String(fullname || "").trim();

  const cleanEmail = String(email || "").trim();

  const cleanUsername = String(username || "").trim();

  const cleanPassword = String(password || "");

  if (!cleanFullname || !cleanEmail || !cleanUsername || !cleanPassword) {
    throw new Error("Vui lòng điền đầy đủ thông tin.");
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        fullname: cleanFullname,
        email: cleanEmail,
        username: cleanUsername,
        password: cleanPassword,
      }),
    });
  } catch (error) {
    console.error("[AUTH] Register connection failed:", error);

    throw new Error(
      "Không thể kết nối tới máy chủ. Vui lòng kiểm tra backend.",
    );
  }

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error || data.message || "Đăng ký tài khoản thất bại.",
    );
  }

  if (!data.id) {
    console.error("[AUTH] Invalid register response:", data);

    throw new Error("Máy chủ trả về dữ liệu đăng ký không hợp lệ.");
  }

  const user = normalizeUser(data);

  if (data.token) {
    setCurrentUser(user);
  }

  return {
    ...user,
    requiresVerification: !!data.requiresVerification,
    message: data.message
  };
}

// ==========================================
// SERVER USER SYNC
// ==========================================

async function syncUserFromServer() {
  const user = getCurrentUser();

  if (!user) {
    return null;
  }

  if (!user.token) {
    console.warn("[AUTH] No JWT token available.");

    return user;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    });

    if (response.status === 401) {
      console.warn("[AUTH] JWT expired or invalid.");

      logoutUser(false);

      return null;
    }

    if (!response.ok) {
      return user;
    }

    const freshUser = await response.json();

    const updatedUser = normalizeUser({
      ...user,
      ...freshUser,

      // Always preserve current JWT
      token: user.token,
    });

    setCurrentUser(updatedUser);

    return updatedUser;
  } catch (error) {
    console.warn("[AUTH] User sync failed:", error.message);

    // Keep current session if backend
    // temporarily cannot be reached.
    return user;
  }
}

// ==========================================
// LOGOUT
// ==========================================

function logoutUser(redirect = true) {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(REMEMBER_STORAGE_KEY);
  localStorage.removeItem("prepmate_auth_token");
  localStorage.removeItem("prepmate_current_user");
  localStorage.removeItem("prepmate_token");
  localStorage.removeItem("prepmate_user");
  localStorage.removeItem("token");
  localStorage.removeItem("currentUser");
  localStorage.removeItem("user");
  localStorage.removeItem("prepmate_uploaded_cv_name");
  localStorage.removeItem("interview_init_data");
  localStorage.removeItem("prefill_jd");
  localStorage.removeItem("prefill_company_name");
  localStorage.removeItem("prefill_job_title");
  localStorage.removeItem("prepmate_backend_session_id");
  sessionStorage.removeItem("prepmate_auth_token");
  sessionStorage.removeItem("prepmate_pending_analysis_state");
  sessionStorage.removeItem("prepmate_auth_redirect");
  sessionStorage.removeItem("prepmate_interview_source");
  console.log("[AUTH] User logged out.");

  if (redirect) {
    const isFeatures = window.location.pathname.includes('/features/');
    window.location.href = isFeatures ? "../../index.html" : "./index.html";
  }
}

// ==========================================
// AUTH GUARD
// ==========================================

function requireLogin() {
  if (!isUserLoggedIn()) {
    if (typeof showToast === "function") {
      showToast("Vui lòng đăng nhập để tiếp tục.", "warning");
    } else {
      alert("Vui lòng đăng nhập để tiếp tục.");
    }

    window.location.href = "../../features/auth/auth.html";

    return false;
  }

  return true;
}

// ==========================================
// ROLE CHECK
// ==========================================

function hasRole(...roles) {
  const user = getCurrentUser();

  if (!user) {
    return false;
  }

  return roles.includes(user.role);
}

function isAdmin() {
  return hasRole("admin");
}

function isManager() {
  return hasRole("manager");
}

function isStaff() {
  return hasRole("admin", "manager");
}

// ==========================================
// REDIRECT AFTER LOGIN
// ==========================================

function getSafeRedirectUrl(target) {
  if (!target || typeof target !== "string") return null;
  const trimmed = target.trim();
  if (!trimmed) return null;

  // Disallow scheme-relative or backslash paths (e.g. "//evil.com", "/\\evil.com")
  if (trimmed.startsWith("//") || trimmed.startsWith("\\") || trimmed.includes("\\")) return null;

  // Prevent CR, LF, null byte injection
  if (/[\r\n\0]/.test(trimmed)) return null;

  // Disallow script/data schemes
  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) return null;

  // Check absolute URLs against same-origin
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    try {
      if (typeof window !== "undefined" && window.location) {
        const url = new URL(trimmed, window.location.origin);
        if (url.origin !== window.location.origin) {
          return null;
        }
        return url.pathname + url.search + url.hash;
      }
    } catch (e) {
      return null;
    }
  }

  // Safe relative paths starting with / or ./ or ../
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../") || /^[a-zA-Z0-9_\-./]+(?:\?[a-zA-Z0-9_\-./=&%]*)?(?:#[a-zA-Z0-9_\-]*)?$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}
if (typeof window !== "undefined") {
  window.getSafeRedirectUrl = getSafeRedirectUrl;
}

function redirectAfterLogin(user) {
  if (!user) {
    return;
  }

  const isStaffUser = user.role === "admin" || user.role === "manager";
  let targetUrl = null;
  if (typeof window !== "undefined" && window.location) {
    const params = new URLSearchParams(window.location.search);
    const candidate = params.get("redirect") || params.get("returnUrl");
    targetUrl = getSafeRedirectUrl(candidate);
  }
  if (!targetUrl && typeof sessionStorage !== "undefined") {
    const stored = sessionStorage.getItem("prepmate_auth_redirect");
    if (stored) {
      sessionStorage.removeItem("prepmate_auth_redirect");
      targetUrl = getSafeRedirectUrl(stored);
    }
  }
  if (targetUrl && targetUrl.includes("admin.html") && !isStaffUser) {
    targetUrl = null;
  }
  if (targetUrl) {
    window.location.href = targetUrl;
    return;
  }

  if (isStaffUser) {
    window.location.href = "../../features/admin/admin.html";
  } else {
    window.location.href = "../../index.html";
  }
}

// ==========================================
// LEGACY LOCAL USERS
// ==========================================
// Kept only for compatibility with old data.
// DO NOT use this for authentication.

function getAllUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY)) || {};
  } catch (error) {
    console.error("[AUTH] Invalid local users:", error);

    return {};
  }
}

function saveUsers(users) {
  if (!users || typeof users !== "object") {
    return;
  }

  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

// ==========================================
// GEMINI API KEY
// ==========================================

function getStoredApiKey() {
  return localStorage.getItem(GEMINI_KEY) || "";
}

function saveApiKey() {
  const input = document.getElementById("api-key-input");

  if (!input) {
    return;
  }

  const key = input.value.trim();

  if (key) {
    localStorage.setItem(GEMINI_KEY, key);

    if (typeof showToast === "function") {
      showToast("Đã lưu API Key thành công!", "success");
    }

    updateApiKeyStatus(true);
  } else {
    localStorage.removeItem(GEMINI_KEY);

    if (typeof showToast === "function") {
      showToast("Đã xóa API Key. Hệ thống chạy ở chế độ Offline.", "info");
    }

    updateApiKeyStatus(false);
  }
}

function toggleApiKeyVisibility() {
  const input = document.getElementById("api-key-input");

  const button = document.getElementById("btn-toggle-key");

  if (!input || !button) {
    return;
  }

  if (input.type === "password") {
    input.type = "text";
    button.innerHTML = '<svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>';
  } else {
    input.type = "password";
    button.innerHTML = '<svg class="pm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
}

function updateApiKeyStatus(hasKey) {
  const status = document.getElementById("api-key-status");

  if (!status) {
    return;
  }

  if (hasKey) {
    status.innerHTML = '<svg class="pm-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" style="margin-right:4px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/></svg>Đã cấu hình Gemini API Key';

    status.style.color = "#10b981";
  } else {
    status.innerHTML = '<svg class="pm-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>Đang chạy chế độ Tiêu chuẩn (Backend Engine)';

    status.style.color = "#94a3b8";
  }
}


// ==========================================
// EMAIL VERIFICATION & PASSWORD RESET (WI-AUTH-01)
// ==========================================

async function forgotPassword(email) {
  const cleanEmail = String(email || "").trim();
  if (!cleanEmail) {
    throw new Error("Vui lòng nhập địa chỉ email.");
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: cleanEmail }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Không thể gửi yêu cầu đặt lại mật khẩu.");
  }

  return data;
}

async function verifyResetToken(token) {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) {
    throw new Error("Mã token không hợp lệ.");
  }

  const response = await fetch(
    `${API_BASE_URL}/api/auth/verify-reset-token?token=${encodeURIComponent(cleanToken)}`,
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.valid) {
    throw new Error(data.error || "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
  }

  return data;
}

async function resetPassword(token, newPassword) {
  const cleanToken = String(token || "").trim();
  const cleanPassword = String(newPassword || "");

  if (!cleanToken || !cleanPassword) {
    throw new Error("Vui lòng điền đầy đủ thông tin.");
  }

  if (cleanPassword.length < 8 || cleanPassword.length > 128) {
    throw new Error("Mật khẩu cần từ 8–128 ký tự, gồm chữ không dấu, số hoặc ký tự đặc biệt; không chứa khoảng trắng.");
  }

  for (let i = 0; i < cleanPassword.length; i++) {
    const code = cleanPassword.charCodeAt(i);
    if (code < 33 || code > 126) {
      throw new Error("Mật khẩu cần từ 8–128 ký tự, gồm chữ không dấu, số hoặc ký tự đặc biệt; không chứa khoảng trắng.");
    }
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: cleanToken, newPassword: cleanPassword }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Không thể đặt lại mật khẩu.");
  }

  return data;
}

async function verifyEmail(token) {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) {
    throw new Error("Mã xác minh không hợp lệ.");
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: cleanToken }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || "Xác minh email không thành công.");
    err.code = data.code;
    err.email = data.email;
    throw err;
  }

  return data;
}

async function resendVerification(email) {
  const cleanEmail = String(email || "").trim();
  if (!cleanEmail) {
    throw new Error("Vui lòng nhập địa chỉ email.");
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: cleanEmail }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || "Không thể gửi lại email xác minh.");
    err.cooldownRemaining = data.cooldownRemaining;
    throw err;
  }

  return data;
}

if (typeof window !== "undefined") {
  window.forgotPassword = forgotPassword;
  window.verifyResetToken = verifyResetToken;
  window.resetPassword = resetPassword;
  window.verifyEmail = verifyEmail;
  window.resendVerification = resendVerification;
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return;
  }

  // Do NOT automatically redirect from
  // auth.html. The login page decides
  // when and where to redirect.

  const isAuthPage = window.location.pathname
    .toLowerCase()
    .includes("/features/auth/");

  if (isAuthPage) {
    return;
  }

  // Sync server data in background.
  syncUserFromServer();
});
