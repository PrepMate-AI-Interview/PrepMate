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

    throw new Error(
      data.error ||
        data.message ||
        "Email/username hoặc mật khẩu không chính xác.",
    );
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

  setCurrentUser(user);

  return user;
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
    button.innerText = "🔒";
  } else {
    input.type = "password";
    button.innerText = "👁️";
  }
}

function updateApiKeyStatus(hasKey) {
  const status = document.getElementById("api-key-status");

  if (!status) {
    return;
  }

  if (hasKey) {
    status.innerText = "✅ Đã cấu hình Gemini API Key";

    status.style.color = "#10b981";
  } else {
    status.innerText = "ℹ️ Đang chạy chế độ Tiêu chuẩn (Backend Engine)";

    status.style.color = "#94a3b8";
  }
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
    .includes("/features/auth/auth.html");

  if (isAuthPage) {
    return;
  }

  // Sync server data in background.
  syncUserFromServer();
});
