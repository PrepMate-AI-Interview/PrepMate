/**
 * ==============================================================================
 * PREPMATE — GOOGLE ANALYTICS 4 (GA4) INTEGRATION MODULE
 * ==============================================================================
 * Hỗ trợ theo dõi lưu lượng truy cập, số lượt xem trang và các sự kiện nghiệp vụ
 * (Bắt đầu phỏng vấn, hoàn thành phỏng vấn, đăng ký, đăng nhập).
 *
 * Cách sử dụng:
 * 1. Đặt mã đo lường vào window.PREPMATE_GA_ID = 'G-XXXXXXXXXX';
 *    hoặc lưu vào localStorage: localStorage.setItem('prepmate_ga_id', 'G-XXXXXXXXXX');
 * 2. Gọi PrepMateAnalytics.init('G-XXXXXXXXXX') hoặc để module tự động khởi tạo.
 */

(function (window, document) {
  "use strict";

  // Mã đo lường mặc định (Google Analytics 4)
  const DEFAULT_GA_MEASUREMENT_ID = "G-4BRJP69Z42";

  const PrepMateAnalytics = {
    measurementId: null,
    isInitialized: false,

    /**
     * Lấy Measurement ID từ biến môi trường, window hoặc localStorage
     */
    resolveMeasurementId: function () {
      if (typeof window.PREPMATE_GA_ID === "string" && window.PREPMATE_GA_ID.trim().startsWith("G-")) {
        return window.PREPMATE_GA_ID.trim();
      }

      try {
        const stored = localStorage.getItem("prepmate_ga_id");
        if (stored && stored.trim().startsWith("G-")) {
          return stored.trim();
        }
      } catch (e) {}

      return DEFAULT_GA_MEASUREMENT_ID;
    },

    /**
     * Khởi tạo Google Analytics 4 (gtag.js)
     * @param {string} [id] - Mã đo lường G-XXXXXXXXXX
     */
    init: function (id) {
      const measurementId = id || this.resolveMeasurementId();
      this.measurementId = measurementId;

      // Không tải script nếu mã vẫn là placeholder mặc định hoặc rỗng
      if (!measurementId || measurementId === "G-XXXXXXXXXX") {
        console.info(
          "[PrepMate Analytics] GA4 chưa được kích hoạt vì mã đo lường đang là placeholder ('G-XXXXXXXXXX'). " +
          "Hãy điền mã thật vào window.PREPMATE_GA_ID hoặc localStorage.setItem('prepmate_ga_id', 'G-...')."
        );
        return false;
      }

      if (this.isInitialized) {
        return true;
      }

      // 1. Khởi tạo dataLayer & hàm gtag toàn cục
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      window.gtag = window.gtag || gtag;

      gtag("js", new Date());
      gtag("config", measurementId, {
        send_page_view: true,
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname + window.location.search
      });

      // 2. Chèn thẻ script gtag.js bất đồng bộ vào <head>
      const existingScript = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${measurementId}"]`);
      if (!existingScript) {
        const script = document.createElement("script");
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        document.head.appendChild(script);
      }

      this.isInitialized = true;
      console.log(`[PrepMate Analytics] Đã kích hoạt GA4 thành công với mã: ${measurementId}`);
      return true;
    },

    /**
     * Gửi sự kiện tùy biến (Custom Event) lên Google Analytics
     * @param {string} eventName - Tên sự kiện (ví dụ: 'interview_start', 'interview_completed')
     * @param {Object} [params] - Thông số đính kèm
     */
    trackEvent: function (eventName, params) {
      if (typeof window.gtag === "function" && this.isInitialized) {
        window.gtag("event", eventName, params || {});
      } else {
        // Ghi log ở chế độ phát triển
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
          console.debug(`[PrepMate Analytics Event (Preview)] ${eventName}:`, params);
        }
      }
    },

    /**
     * Gửi lượt xem trang (Pageview) khi chuyển trang SPA hoặc load trang mới
     * @param {string} [pageTitle]
     * @param {string} [pagePath]
     */
    trackPageView: function (pageTitle, pagePath) {
      const title = pageTitle || document.title;
      const path = pagePath || (window.location.pathname + window.location.search);
      this.trackEvent("page_view", {
        page_title: title,
        page_location: window.location.href,
        page_path: path
      });
    },

    /**
     * Ghi nhận sự kiện bắt đầu phỏng vấn
     */
    trackInterviewStart: function (jobTitle, industry) {
      this.trackEvent("interview_start", {
        job_title: jobTitle || "Chuyên viên",
        industry: industry || "Chưa phân loại",
        timestamp: new Date().toISOString()
      });
    },

    /**
     * Ghi nhận sự kiện hoàn thành phỏng vấn
     */
    trackInterviewCompleted: function (sessionId, overallScore) {
      this.trackEvent("interview_completed", {
        session_id: sessionId,
        overall_score: Number(overallScore || 0),
        timestamp: new Date().toISOString()
      });
    },

    /**
     * Ghi nhận sự kiện đăng ký hoặc đăng nhập
     */
    trackAuth: function (method, role) {
      this.trackEvent("login", {
        method: method || "standard",
        user_role: role || "user"
      });
    }
  };

  // Expose ra window toàn cục
  window.PrepMateAnalytics = PrepMateAnalytics;

  // Tự động khởi tạo khi DOM sẵn sàng nếu đã có mã hợp lệ
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      PrepMateAnalytics.init();
    });
  } else {
    PrepMateAnalytics.init();
  }
})(window, document);
