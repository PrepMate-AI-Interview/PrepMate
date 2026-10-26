// ==========================================
// PREPMATE — UNIFIED INTERVIEW API CLIENT (LAYERED SERVICE)
// ARCHITECTURE: INTERVIEW BACKEND TRANSPORT & SESSION CLIENT
// ==========================================

/**
 * Sanitizes and validates an API base URL (WI-02B4)
 */
function sanitizeBaseUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  // If absolute URL, validate syntax
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    const URLCtor = typeof URL !== "undefined"
      ? URL
      : (typeof window !== "undefined" && typeof window.URL !== "undefined"
          ? window.URL
          : (typeof globalThis !== "undefined" ? globalThis.URL : null));
    if (URLCtor) {
      try {
        new URLCtor(trimmed);
      } catch (e) {
        throw new Error(`PrepMate API configuration error: Invalid API_BASE_URL "${trimmed}".`);
      }
    }
  }
  return trimmed.replace(/\/+$/, "");
}

/**
 * Resolves the API base URL safely according to environment rules (WI-02B4)
 * - Explicit InterviewApiClient.baseUrl takes highest priority
 * - Explicit window.PREPMATE_API_BASE_URL takes priority
 * - Explicit window.API_BASE_URL is respected, unless it was polluted by legacy auto-forcing to port 5000 on a different port
 * - In HTTP/HTTPS origins, defaults to relative URL ("") so requests route to the current origin & port
 * - In file:// protocol, throws configuration error if not explicitly configured (no silent guessing)
 */
function resolveApiBaseUrl() {
  // 1. Explicit override on client
  if (typeof window !== "undefined" && window.InterviewApiClient && typeof window.InterviewApiClient.baseUrl === "string") {
    return sanitizeBaseUrl(window.InterviewApiClient.baseUrl);
  }
  if (typeof InterviewApiClient !== "undefined" && InterviewApiClient && typeof InterviewApiClient.baseUrl === "string") {
    return sanitizeBaseUrl(InterviewApiClient.baseUrl);
  }

  // 2. Meta tag configuration: <meta name="prepmate-api-base-url" content="...">
  try {
    if (typeof document !== "undefined") {
      const meta = document.querySelector('meta[name="prepmate-api-base-url"]');
      if (meta && meta.content) return sanitizeBaseUrl(meta.content.trim());
    }
  } catch (e) {}

  // 3. Explicit window configuration: PREPMATE_API_BASE_URL or PREPMATE_CONFIG.apiBaseUrl
  if (typeof window !== "undefined") {
    if (typeof window.PREPMATE_API_BASE_URL === "string" && window.PREPMATE_API_BASE_URL.trim() !== "") {
      return sanitizeBaseUrl(window.PREPMATE_API_BASE_URL);
    }
    if (window.PREPMATE_CONFIG && typeof window.PREPMATE_CONFIG.apiBaseUrl === "string" && window.PREPMATE_CONFIG.apiBaseUrl.trim() !== "") {
      return sanitizeBaseUrl(window.PREPMATE_CONFIG.apiBaseUrl);
    }

    if (typeof window.API_BASE_URL === "string" && window.API_BASE_URL.trim() !== "") {
      const sanitizedLegacyUrl = sanitizeBaseUrl(window.API_BASE_URL);
      // Guard against legacy auto-forced "http://localhost:5000" when document is actually on another backend test port
      if (typeof location !== "undefined" && location.protocol && location.protocol !== "file:") {
        const isLocalHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
        const isStaticDevServer = /^55\d{2}$/.test(location.port) || location.port === "5173" || location.port === "3000";
        const isLegacyForced5000 = (sanitizedLegacyUrl === "http://localhost:5000" || sanitizedLegacyUrl === "http://127.0.0.1:5000")
          && isLocalHost
          && location.port
          && location.port !== "5000"
          && !isStaticDevServer;
        if (!isLegacyForced5000) {
          return sanitizedLegacyUrl;
        }
      } else {
        return sanitizedLegacyUrl;
      }
    }
  }

  // 4. Auto-detect from browser location
  if (typeof location !== "undefined") {
    if (location.protocol === "http:" || location.protocol === "https:") {
      const isLocalHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
      if (isLocalHost && (/^55\d{2}$/.test(location.port) || location.port === "5173" || location.port === "3000")) {
        return "http://127.0.0.1:5000";
      }
      return "";
    }

    if (location.protocol === "file:") {
      throw new Error("PrepMate API configuration error: API_BASE_URL is not configured for file:// protocol. Please configure window.API_BASE_URL or serve via a web server.");
    }
  }

  return "";
}

/**
 * Builds a clean, safe, joined API URL without double slashes or missing slashes
 */
function buildApiUrl(endpoint) {
  if (!endpoint || typeof endpoint !== "string") {
    throw new Error("PrepMate API: Endpoint must be a non-empty string.");
  }
  const base = resolveApiBaseUrl();
  const cleanBase = base ? base.replace(/\/+$/, "") : "";
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
  return `${cleanBase}${cleanEndpoint}`;
}

var API_BASE_URL = (function () {
  try {
    return resolveApiBaseUrl();
  } catch (e) {
    return "";
  }
})();

if (typeof window !== "undefined") {
  const isLegacyForced = typeof window.API_BASE_URL === "string" && (function () {
    try {
      const s = sanitizeBaseUrl(window.API_BASE_URL);
      const isLocalHost = typeof location !== "undefined" && (location.hostname === "localhost" || location.hostname === "127.0.0.1");
      const isStaticDevServer = typeof location !== "undefined" && (/^55\d{2}$/.test(location.port) || location.port === "5173" || location.port === "3000");
      return (s === "http://localhost:5000" || s === "http://127.0.0.1:5000") && isLocalHost && location.port && location.port !== "5000" && !isStaticDevServer;
    } catch (e) {
      return false;
    }
  })();

  if (typeof window.API_BASE_URL !== "string" || isLegacyForced) {
    window.API_BASE_URL = API_BASE_URL;
  }
}

var InterviewApiClient = {
  baseUrl: undefined,

  resolveBaseUrl() {
    return resolveApiBaseUrl();
  },

  resolveApiBaseUrl() {
    return resolveApiBaseUrl();
  },

  buildUrl(endpoint) {
    return buildApiUrl(endpoint);
  },

  buildApiUrl(endpoint) {
    return buildApiUrl(endpoint);
  },

  setBaseUrl(url) {
    this.baseUrl = url;
  },

  async request(endpoint, options = {}) {
    const url = buildApiUrl(endpoint);
    const defaultHeaders = { "Content-Type": "application/json" };
    const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
    const authHeaders = currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {};
    const mergedOptions = {
      credentials: "include",
      ...options,
      headers: {
        ...defaultHeaders,
        ...authHeaders,
        ...(options.headers || {}),
      },
    };

    const response = await fetch(url, mergedOptions);
    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401 && typeof showToast === "function") {
        showToast("Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.", "warning");
      }
      const errorMsg = data?.error || `Máy chủ phản hồi mã lỗi HTTP ${response.status}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  async getQuota() {
    return this.request("/api/user/quota", { method: "GET" });
  },

  async getSession(sessionId) {
    return this.request(`/api/sessions/${sessionId}`, { method: "GET" });
  },

  async startSession(sessionId) {
    return this.request(`/api/sessions/${sessionId}/start`, {
      method: "POST",
    });
  },

  async createSession(payload) {
    return this.request("/api/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async submitIntroduction(sessionId, introduction) {
    return this.request("/api/ai/introduction", {
      method: "POST",
      body: JSON.stringify({ sessionId, introduction }),
    });
  },

  async submitAnswer(sessionId, question, message) {
    return this.request("/api/ai/respond", {
      method: "POST",
      body: JSON.stringify({ sessionId, question, message }),
    });
  },

  async endInterview(sessionId, jobTitle, language, responses) {
    return this.request("/api/ai/end-interview", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        jobTitle,
        language: language || "vi",
        responses: (responses || []).map((r) => ({
          question: r.question || "",
          answer: r.answer || "",
        })),
      }),
    });
  },

  /**
   * Categorizes an interview API or network error into structured status, Vietnamese guidance, and retry metadata.
   * @param {Error|Object} error
   */
  categorizeError(error) {
    return categorizeInterviewError(error);
  },
};

/**
 * Categorizes an interview API or network error into structured status, Vietnamese guidance, and retry metadata.
 * @param {Error|Object} error
 * @returns {{
 *   type: "MODEL_INACTIVE" | "GATEWAY_UNAVAILABLE" | "TIMEOUT" | "AUTH_ERROR" | "VALIDATION_ERROR" | "NETWORK_ERROR" | "SERVER_ERROR",
 *   status: number,
 *   title: string,
 *   message: string,
 *   shortStatus: string,
 *   actionPrompt: string,
 *   canRetry: boolean
 * }}
 */
function categorizeInterviewError(error) {
  const status = Number(error?.status || (error?.data && error?.data?.status) || 0);
  const rawMsg = String(error?.data?.error || error?.message || "").trim();
  const lowerMsg = rawMsg.toLowerCase();

  // 1. Upstream AI provider inactive model (HTTP 503 with MODEL_INACTIVE or explicit inactive mention)
  if (
    (status === 503 || status === 500) &&
    (lowerMsg.includes("model_inactive") || lowerMsg.includes("ngừng hoạt động") || lowerMsg.includes("inactive model"))
  ) {
    return {
      type: "MODEL_INACTIVE",
      status: 503,
      title: "Mô hình AI đang tạm ngưng",
      message: rawMsg || "Mô hình AI hiện đang ở trạng thái ngừng hoạt động phía nhà cung cấp (MODEL_INACTIVE). Quản trị viên vui lòng kiểm tra portal nhà cung cấp hoặc đổi sang mô hình khác.",
      shortStatus: "Mô hình AI tạm ngưng hoạt động (MODEL_INACTIVE). Câu trả lời của bạn đã được bảo toàn an toàn.",
      actionPrompt: "Vui lòng đợi vài phút rồi nhấn 'Thử lại' hoặc liên hệ quản trị viên để cập nhật cấu hình mô hình.",
      canRetry: true,
    };
  }

  // 2. Gateway / Service Unavailable (HTTP 502 / 503)
  if (status === 503 || status === 502) {
    return {
      type: "GATEWAY_UNAVAILABLE",
      status: status,
      title: "Dịch vụ AI tạm thời không khả dụng",
      message: rawMsg || `Dịch vụ AI đang tạm thời quá tải hoặc đang bảo trì (${status}).`,
      shortStatus: "Dịch vụ AI tạm thời gián đoạn. Câu trả lời của bạn đã được giữ nguyên.",
      actionPrompt: "Hệ thống đã bảo toàn câu trả lời của bạn. Bạn hãy nhấn 'Thử lại' sau giây lát.",
      canRetry: true,
    };
  }

  // 3. Timeout (HTTP 504 or network/gateway timeout)
  if (
    status === 504 ||
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("quá thời gian") ||
    lowerMsg.includes("timed out")
  ) {
    return {
      type: "TIMEOUT",
      status: status || 504,
      title: "Hết thời gian chờ phản hồi AI",
      message: rawMsg || "Quá thời gian phản hồi từ dịch vụ AI (Gateway Timeout). Kết nối mạng hoặc phía AI đang phản hồi chậm.",
      shortStatus: "Quá thời gian chờ phản hồi AI. Câu trả lời của bạn vẫn nguyên vẹn.",
      actionPrompt: "Nội dung trả lời vẫn được giữ trong khung soạn thảo. Bạn vui lòng bấm 'Thử lại'.",
      canRetry: true,
    };
  }

  // 4a. Quota Exceeded / Rate Limited (HTTP 429)
  if (status === 429) {
    return {
      type: "QUOTA_EXCEEDED",
      status: 429,
      title: "Đã đạt giới hạn phỏng vấn",
      message: rawMsg || "Bạn đã đạt giới hạn số lượt phỏng vấn cho phép.",
      shortStatus: rawMsg || "Đã đạt giới hạn số lượt phỏng vấn.",
      actionPrompt: "Vui lòng nâng cấp tài khoản hoặc đăng nhập để tiếp tục luyện tập.",
      canRetry: false,
    };
  }

  // 4. Unauthorized / Forbidden (HTTP 401 / 403)
  if (status === 401 || status === 403) {
    return {
      type: "AUTH_ERROR",
      status: status,
      title: "Phiên làm việc hết hạn",
      message: rawMsg || "Phiên đăng nhập đã hết hạn hoặc không đủ quyền thực hiện thao tác.",
      shortStatus: "Phiên làm việc hết hạn hoặc cần xác thực lại.",
      actionPrompt: "Vui lòng mở tab khác đăng nhập lại tài khoản, sau đó quay lại nhấn 'Thử lại'.",
      canRetry: true,
    };
  }

  // 5. Validation error (HTTP 400)
  if (status === 400) {
    return {
      type: "VALIDATION_ERROR",
      status: 400,
      title: "Yêu cầu không hợp lệ",
      message: rawMsg || "Dữ liệu gửi lên không đúng định dạng hoặc thiếu nội dung.",
      shortStatus: rawMsg || "Dữ liệu trả lời chưa hợp lệ.",
      actionPrompt: "Vui lòng kiểm tra lại câu trả lời trong ô nhập và nhấn gửi lại.",
      canRetry: true,
    };
  }

  // 6. Network failure (TypeError, Failed to fetch, offline)
  if (
    !status ||
    lowerMsg.includes("failed to fetch") ||
    lowerMsg.includes("network") ||
    lowerMsg.includes("kết nối")
  ) {
    return {
      type: "NETWORK_ERROR",
      status: 0,
      title: "Gián đoạn kết nối mạng",
      message: rawMsg || "Không thể kết nối đến máy chủ hoặc đường truyền mạng bị gián đoạn.",
      shortStatus: "Không thể kết nối máy chủ. Câu trả lời của bạn được lưu an toàn.",
      actionPrompt: "Vui lòng kiểm tra kết nối mạng của thiết bị rồi bấm 'Thử lại'.",
      canRetry: true,
    };
  }

  // 7. General Server Error (HTTP 500 / other)
  return {
    type: "SERVER_ERROR",
    status: status || 500,
    title: "Sự cố xử lý phản hồi",
    message: rawMsg || "Đã xảy ra sự cố từ máy chủ khi phân tích câu trả lời.",
    shortStatus: "Có sự cố khi phân tích câu trả lời. Nội dung của bạn đã được bảo toàn.",
    actionPrompt: "Bạn có thể chỉnh sửa thêm nội dung hoặc bấm 'Thử lại' để gửi lại câu trả lời.",
    canRetry: true,
  };
}

if (typeof window !== "undefined") {
  window.InterviewApiClient = InterviewApiClient;
  window.resolveApiBaseUrl = resolveApiBaseUrl;
  window.buildApiUrl = buildApiUrl;
  window.categorizeInterviewError = categorizeInterviewError;
}
