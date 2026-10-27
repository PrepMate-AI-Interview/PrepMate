// ==========================================
// PREPMATE - Trình Điều Khiển Chính
// Hỗ trợ Landing Page, Dashboard, và Phòng phỏng vấn
// ==========================================

// Auto-detect API base URL:
// - When window.API_BASE_URL is explicitly configured, use it
// - When served by ASP.NET Core (same origin on port 5000), use "" (relative URLs)
// - When opening HTML files directly (file://) or running local dev server (localhost / 127.0.0.1 on other ports), fallback to localhost:5000
// - When running on production domain (any host other than localhost/127.0.0.1), use "" (relative URLs)
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

function getApiUrl(endpoint) {
  const base = (typeof window !== "undefined" && typeof window.API_BASE_URL === "string")
    ? window.API_BASE_URL
    : (typeof API_BASE_URL === "string" ? API_BASE_URL : "");
  const cleanBase = base ? base.replace(/\/+$/, "") : "";
  const cleanEndpoint = endpoint ? (endpoint.startsWith("/") ? endpoint : "/" + endpoint) : "";
  return `${cleanBase}${cleanEndpoint}`;
}
if (typeof window !== "undefined") {
  window.getApiUrl = getApiUrl;
}

// Canonical HTML Entity Escaping (SEC / ARCH SSOT)
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
if (typeof window !== "undefined") {
  window.escapeHtml = escapeHtml;
}

// Handler cho logo click - redirect về Trang chủ (Home)
function handleLogoClick() {
  const isFeatures = window.location.pathname.includes("/features/");
  const root = isFeatures ? "../../" : "./";
  window.location.href = `${root}index.html`;
}

// Helper function to call Google Gemini API directly from Client-Side
async function callGeminiAPI(
  apiKey,
  prompt,
  systemInstruction = "",
  isJsonMode = false,
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  if (isJsonMode) {
    payload.generationConfig = {
      responseMimeType: "application/json",
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Error (HTTP ${res.status}): ${errText}`);
  }

  const data = await res.json();
  try {
    return data.candidates[0].content.parts[0].text;
  } catch (e) {
    throw new Error("Không thể phân tích phản hồi từ Gemini API");
  }
}
const MOCK_QUESTIONS = {
  "General Professional": [
    "Xin chào! Bạn hãy giới thiệu tổng quan về bản thân, kinh nghiệm làm việc và những thế mạnh nổi bật nhất của bạn.",
    "Hãy chia sẻ về một mục tiêu hoặc dự án quan trọng gần đây mà bạn đã hoàn thành xuất sắc và đóng góp cụ thể của bạn.",
    "Khi đối mặt với một vấn đề phát sinh ngoài kế hoạch hoặc deadline gấp, phương pháp ưu tiên và giải quyết công việc của bạn là gì?",
    "Hãy kể về một tình huống bạn phải thuyết phục đồng nghiệp hoặc đối tác đồng thuận với đề xuất của mình.",
    "Bạn làm thế nào để liên tục cập nhật kiến thức, nâng cao kỹ năng chuyên môn và thích ứng với sự thay đổi trong công việc?",
    "Mục tiêu phát triển sự nghiệp trong 2-3 năm tới của bạn là gì và bạn kỳ vọng gì vào vai trò mới này?",
  ],
  "Frontend Developer": [
    "Xin chào! Bạn có thể giới thiệu về bản thân và kinh nghiệm Frontend của bạn không?",
    "Sự khác biệt giữa React, Vue, và Angular là gì? Bạn thích framework nào nhất?",
    "Bạn đã làm việc với REST API hay GraphQL? Hãy mô tả kinh nghiệm của bạn.",
    "Bạn sử dụng những công cụ, thư viện gì để tối ưu hóa performance của ứng dụng web?",
  ],
  "Backend Developer": [
    "Xin chào! Hãy kể về kinh nghiệm backend của bạn.",
    "Bạn có kinh nghiệm với SQL hay NoSQL databases? Ưu nhược điểm của từng loại là gì?",
    "Hãy giải thích kiến trúc microservices và khi nào nên sử dụng nó.",
    "Bạn xử lý error handling và logging như thế nào trong ứng dụng production?",
  ],
  "UI/UX Designer": [
    "Xin chào! Bạn có thể kể về quy trình design của bạn không?",
    "Sự khác biệt giữa UX và UI là gì?",
    "Bạn thường sử dụng những công cụ design nào?",
    "Bạn làm thế nào để đảm bảo ứng dụng accessibility cho tất cả người dùng?",
  ],
  "Project Manager": [
    "Xin chào! Hãy kể về kinh nghiệm quản lý dự án của bạn.",
    "Bạn thích sử dụng Agile hay Waterfall? Lý do tại sao?",
    "Bạn xử lý conflict trong team như thế nào?",
    "Bạn đo lường thành công của dự án bằng những chỉ số nào?",
  ],
  "Mobile Developer": [
    "Hãy kể về kinh nghiệm phát triển mobile của bạn.",
    "Bạn chọn iOS, Android hay cross-platform? Lý do tại sao?",
    "Bạn đã sử dụng React Native hay Flutter chưa? So sánh với native development.",
    "Bạn xử lý performance và battery optimization như thế nào?",
  ],
  "DevOps Engineer": [
    "Giới thiệu về kinh nghiệm DevOps của bạn.",
    "Hãy giải thích quy trình CI/CD của bạn.",
    "Bạn sử dụng Docker và Kubernetes như thế nào trong dự án?",
    "Bạn monitoring và logging hệ thống ra sao?",
  ],
  "Data Scientist": [
    "Hãy kể về kinh nghiệm Data Science của bạn.",
    "Bạn sử dụng những công cụ gì? Python, R hay cả hai?",
    "Hãy mô tả một dự án machine learning bạn đã làm.",
    "Bạn xử lý dữ liệu không cân bằng (imbalanced data) như thế nào?",
  ],
  "QA Engineer": [
    "Giới thiệu về kinh nghiệm QA của bạn.",
    "Sự khác biệt giữa manual testing và automation testing là gì?",
    "Bạn sử dụng những công cụ automation nào?",
    "Bạn xây dựng test strategy như thế nào?",
  ],
  "Full Stack Developer": [
    "Hãy giới thiệu về kinh nghiệm full stack của bạn.",
    "Bạn chọn tech stack nào? Lý do tại sao?",
    "Bạn xử lý communication giữa frontend và backend như thế nào?",
    "Bạn sử dụng những cơ sở dữ liệu nào?",
  ],
  "Business Analyst": [
    "Kể về kinh nghiệm Business Analyst của bạn.",
    "Bạn làm thế nào để thu thập requirements từ stakeholders?",
    "Bạn viết documentation như thế nào?",
    "Bạn xử lý scope creep như thế nào?",
  ],
  "Scrum Master": [
    "Hãy giới thiệu về kinh nghiệm Scrum Master của bạn.",
    "Bạn tổ chức sprint như thế nào?",
    "Bạn xử lý impediments như thế nào?",
    "Bạn đánh giá team velocity ra sao?",
  ],
  Cybersecurity: [
    "Kể về kinh nghiệm cybersecurity của bạn.",
    "Bạn tiếp cận penetration testing như thế nào?",
    "Bạn xử lý vulnerabilities như thế nào?",
    "Bạn cập nhật kiến thức về security trends ra sao?",
  ],
  "Cloud Architect": [
    "Hãy giới thiệu về kinh nghiệm Cloud Architect của bạn.",
    "Bạn chọn AWS, Azure hay GCP? Lý do tại sao?",
    "Bạn thiết kế high availability architecture như thế nào?",
    "Bạn tính toán cloud cost optimization ra sao?",
  ],
  "Machine Learning": [
    "Kể về kinh nghiệm Machine Learning của bạn.",
    "Bạn sử dụng TensorFlow, PyTorch hay frameworks khác?",
    "Bạn xử lý feature engineering như thế nào?",
    "Bạn evaluate model performance ra sao?",
  ],
  "Site Reliability Eng": [
    "Hãy giới thiệu về kinh nghiệm SRE của bạn.",
    "Bạn định nghĩa SLO/SLA như thế nào?",
    "Bạn tiếp cận incident management ra sao?",
    "Bạn giảm toil (manual work) như thế nào?",
  ],
  "Database Admin": [
    "Kể về kinh nghiệm DBA của bạn.",
    "Bạn quản lý backup và recovery như thế nào?",
    "Bạn optimize query performance ra sao?",
    "Bạn monitoring database health như thế nào?",
  ],

  // ─── TRUYỀN THÔNG & MARKETING ───────────────────────────
  "Digital Marketing Specialist": [
    "Xin chào! Bạn hãy giới thiệu về bản thân và các chiến dịch Performance Marketing / Digital bạn từng phụ trách.",
    "Bạn phân bổ ngân sách như thế nào giữa các kênh Google Ads, Meta Ads, TikTok và SEO để đạt ROI tối ưu?",
    "Khi một chiến dịch quảng cáo bị tụt giảm tỷ lệ chuyển đổi (CR) hoặc CPA tăng đột biến, bạn tiến hành audit và khắc phục ra sao?",
    "Hãy chia sẻ cách bạn thiết lập phễu Marketing (Funnel) và các chỉ số đo lường chính (CAC, LTV, ROAS) trong dự án gần nhất.",
    "Bạn đánh giá vai trò của AI (ChatGPT, Midjourney) trong việc tối ưu hóa quy trình sáng tạo và chạy quảng cáo hiện nay thế nào?",
  ],
  "Content Creator / Copywriter": [
    "Xin chào! Hãy giới thiệu về phong cách viết và các sản phẩm nội dung tiêu biểu trong Portfolio của bạn.",
    "Làm thế nào để bạn sáng tạo nội dung bắt trúng tâm lý khách hàng (Customer Insight) và giữ được chất giọng thương hiệu (Brand Voice)?",
    "Khi viết bài bán hàng trực tiếp so với viết bài chia sẻ giá trị (Storytelling/Branding), bạn thay đổi cấu trúc bài viết như thế nào?",
    "Nếu một bài viết hoặc kịch bản video của bạn nhận nhiều phản hồi tiêu cực từ cộng đồng mạng, bạn sẽ xử lý tình huống đó ra sao?",
    "Quy trình nghiên cứu từ khóa và kết hợp yếu tố SEO vào bài viết chuẩn SEO của bạn diễn ra như thế nào?",
  ],
  "Chuyên viên Truyền thông & PR": [
    "Xin chào! Bạn có thể chia sẻ về kinh nghiệm quan hệ công chúng (PR) và quản lý hình ảnh thương hiệu của mình không?",
    "Nếu doanh nghiệp bất ngờ gặp khủng hoảng truyền thông trên mạng xã hội, 3 bước hành động đầu tiên trong 24 giờ của bạn là gì?",
    "Bạn xây dựng và duy trì mối quan hệ với các cơ quan báo chí, phóng viên và KOLs/KOCs trong ngành như thế nào?",
    "Hãy mô tả một sự kiện ra mắt sản phẩm hoặc chiến dịch CSR do bạn trực tiếp lên kế hoạch truyền thông từ đầu đến cuối.",
    "Làm thế nào để bạn đo lường hiệu quả của một chiến dịch PR khi mà các chỉ số nhận diện thương hiệu khó định lượng bằng doanh số?",
  ],
  "Social Media Manager": [
    "Xin chào! Bạn đã từng quản lý và phát triển những kênh mạng xã hội nào (Facebook, TikTok, LinkedIn, YouTube)?",
    "Chiến lược xây dựng nội dung ngắn (Reels, TikTok) của bạn để thu hút tương tác tự nhiên (organic reach) là gì?",
    "Bạn làm thế nào để nắm bắt kịp thời các trend nóng mà vẫn giữ được sự tinh tế, phù hợp với định vị của thương hiệu?",
    "Khi quản lý cộng đồng (Community Management), bạn xử lý các ý kiến trái chiều, khiếu nại của khách hàng trong bình luận như thế nào?",
    "Bạn lập kế hoạch lịch phát sóng nội dung (Content Calendar) hàng tháng và báo cáo phân tích tương tác (Engagement Rate) ra sao?",
  ],

  // ─── THIẾT KẾ & SÁNG TẠO NGHỆ THUẬT ────────────────────
  "Graphic Designer (Thiết kế đồ họa)": [
    "Xin chào! Hãy giới thiệu về phong cách thiết kế thế mạnh và các dự án thiết kế nhận diện thương hiệu bạn tâm đắc nhất.",
    "Bạn áp dụng nguyên lý thị giác (Typography, Màu sắc, Bố cục lưới Grid, Tỷ lệ vàng) như thế nào trong các ấn phẩm truyền thông?",
    'Khi khách hàng hoặc sếp đưa ra feedback không rõ ràng như "Làm cho nó nổi bật hơn, sang hơn", bạn giao tiếp và xử lý ra sao?',
    "Bạn kiểm soát quy trình từ thiết kế kỹ thuật số đến in ấn thực tế (hệ màu CMYK, độ phân giải DPI, chất liệu in) như thế nào?",
    "Chia sẻ cách bạn tổ chức file thiết kế (Layers, Components, Assets) để bàn giao thuận tiện cho đội ngũ Marketing hoặc In ấn.",
  ],
  "Video Editor / Motion Graphics": [
    "Xin chào! Bạn thường sử dụng những phần mềm dựng phim và hiệu ứng nào (Premiere Pro, After Effects, DaVinci Resolve)?",
    "Cách bạn kiểm soát nhịp dựng (Pacing), lựa chọn âm nhạc và hiệu ứng âm thanh (SFX) để tạo cảm xúc dẫn dắt người xem?",
    "Quy trình chỉnh màu (Color Grading & Color Correction) của bạn để đảm bảo tone màu đồng nhất cho toàn bộ video như thế nào?",
    "Khi dựng video dạng ngắn (TikTok/Reels/Shorts), bạn làm gì trong 3 giây đầu tiên để ngăn người dùng lướt qua video?",
    "Hãy chia sẻ một dự án dựng video có deadline gấp hoặc khối lượng footage khổng lồ mà bạn đã xử lý thành công.",
  ],
  "3D Artist / Designer": [
    "Xin chào! Hãy giới thiệu về chuyên môn 3D của bạn: Modeling, Texturing, Rigging hay Lighting & Rendering?",
    "Bạn sử dụng phần mềm nào chính (Blender, Maya, 3ds Max, ZBrush) và quy trình làm việc (Pipeline) từ concept đến bản render cuối?",
    "Làm thế nào để bạn tối ưu hóa số lượng Polygon (Retopology) và Texture Maps cho mô hình 3D dùng trong Game hoặc AR/VR?",
    "Chia sẻ kinh nghiệm thiết lập ánh sáng (Lighting) và vật liệu PBR để tạo ra kết quả chân thực nhất.",
    "Bạn giải quyết thách thức về thời gian render và tối ưu hóa tài nguyên phần cứng như thế nào trong các dự án nặng?",
  ],

  // ─── NGÔN NGỮ & BIÊN PHIÊN DỊCH ────────────────────────
  "Biên / Phiên dịch Tiếng Anh": [
    "Xin chào! Could you please introduce yourself and share your experience in translation and interpretation?",
    "How do you handle ambiguous terminology, cultural idioms, or technical jargon during live interpretation?",
    "Khi gặp một từ vựng chuyên ngành mới mà diễn giả nói quá nhanh trong cabin dịch song song, bạn ứng biến ra sao?",
    "What CAT tools or translation memories (Trados, MemoQ) do you regularly use to ensure terminology consistency?",
    "Tell me about a high-pressure conference or business meeting where you interpreted, and how you maintained composure.",
  ],
  "Biên / Phiên dịch Tiếng Nhật": [
    "Hajimemashite! 自己紹介とこれまでの日本語通訳・翻訳の経験についてお聞かせください。(Xin chào! Hãy giới thiệu bản thân và kinh nghiệm phiên dịch tiếng Nhật của bạn).",
    "Khi làm việc với đối tác Nhật Bản, bạn vận dụng văn hóa Horenso (Báo cáo - Liên lạc - Thảo luận) và Kính ngữ (Keigo) như thế nào?",
    "Trong các cuộc họp kỹ thuật IT (IT Comtor) hoặc sản xuất, bạn làm thế nào để truyền tải chính xác yêu cầu giữa khách hàng Nhật và kỹ sư Việt?",
    "Khi khách hàng Nhật đưa ra yêu cầu khắt khe hoặc phản ánh về chất lượng dự án, bạn đóng vai trò cầu nối xử lý khéo léo ra sao?",
    "Bạn duy trì và nâng cao vốn từ vựng chuyên ngành (IT, Cơ khí, Thương mại, Xây dựng) của mình hàng ngày như thế nào?",
  ],
  "Biên / Phiên dịch Tiếng Hàn": [
    "안녕하세요! 자기소개와 한국어 통번역 경력에 대해 말씀해 주십시오. (Xin chào! Hãy giới thiệu bản thân và kinh nghiệm dịch tiếng Hàn của bạn).",
    "Bạn có kinh nghiệm dịch trong lĩnh vực nào nhất (Sản xuất điện tử, Thương mại, Mỹ phẩm hay IT)? Chia sẻ một ví dụ cụ thể.",
    "Trong văn hóa doanh nghiệp Hàn Quốc, tôn ti thứ bậc và phong cách giao tiếp rất được chú trọng, bạn thích ứng với điều này thế nào?",
    "Khi gặp sự bất đồng quan điểm giữa chuyên gia Hàn Quốc và nhân viên người Việt tại nhà máy/văn phòng, bạn hỗ trợ hòa giải ra sao?",
    "Phương pháp của bạn để tra cứu nhanh các thuật ngữ tiếng Hàn chuyên sâu trong quá trình dịch thuật tài liệu hợp đồng là gì?",
  ],
  "Biên / Phiên dịch Tiếng Trung": [
    "您好！请先做一个简短的自我介绍，并分享您的中文翻译经验。(Xin chào! Hãy giới thiệu ngắn gọn bản thân và kinh nghiệm dịch thuật tiếng Trung của bạn).",
    "Bạn có kinh nghiệm thông dịch trong các buổi đàm phán thương mại xuất nhập khẩu hoặc hướng dẫn kỹ thuật hiện trường không?",
    "Cách bạn xử lý sự khác biệt giữa văn phong khẩu ngữ hàng ngày và văn phong thương mại trang trọng (Thư tín kinh doanh, Hợp đồng)?",
    "Khi tham gia phiên dịch tại xưởng sản xuất với nhiều tiếng ồn và nhiều thuật ngữ chuyên môn về máy móc, bạn vượt qua thách thức ra sao?",
    "Bạn đánh giá thế nào về việc sử dụng các công cụ dịch thuật AI hiện nay trong việc nâng cao năng suất công việc của một biên dịch viên?",
  ],
  "Giáo viên / Giảng viên Ngoại ngữ": [
    "Xin chào! Bạn hãy chia sẻ về triết lý giảng dạy và kinh nghiệm đứng lớp ngoại ngữ của mình.",
    "Làm thế nào để bạn thiết kế giáo án tương tác cao, tạo động lực cho những học viên bị mất gốc hoặc e ngại khi giao tiếp?",
    "Bạn ứng dụng công nghệ và các phương pháp sư phạm hiện đại (Flipped Classroom, Task-Based Learning) vào lớp học như thế nào?",
    "Khi trong một lớp học có sự chênh lệch lớn về trình độ tiếp thu giữa các học viên, bạn cá nhân hóa phương pháp dạy ra sao?",
    "Cách bạn đánh giá định kỳ và cam kết đầu ra (IELTS/TOEIC/JLPT/HSK/TOPIK) cho học viên như thế nào?",
  ],

  // ─── KINH DOANH, TÀI CHÍNH & NHÂN SỰ ─────────────────────
  "Chuyên viên Nhân sự (HR)": [
    "Xin chào! Hãy giới thiệu về kinh nghiệm của bạn trong mảng nhân sự: Tuyển dụng (TA), Đào tạo (L&D) hay Tiền lương & Phúc lợi (C&B)?",
    "Bạn áp dụng kỹ thuật phỏng vấn hành vi STAR và phương pháp đánh giá năng lực nào để tuyển đúng người đúng việc?",
    "Làm thế nào để bạn xây dựng thương hiệu nhà tuyển dụng (Employer Branding) và thu hút ứng viên tài năng trong thị trường cạnh tranh?",
    "Khi xảy ra tranh chấp lao động hoặc nhân viên có hiệu suất làm việc kém (PIP), bạn tiến hành xử lý theo quy trình pháp lý và nhân văn ra sao?",
    "Bạn đo lường hiệu quả giữ chân nhân tài và gắn kết văn hóa doanh nghiệp bằng những chỉ số cốt lõi nào?",
  ],
  "Chuyên viên Kế toán / Kiểm toán": [
    "Xin chào! Hãy giới thiệu về quá trình làm việc và các phần hành kế toán bạn từng đảm nhiệm (Thuế, Công nợ, Kho, Tổng hợp).",
    "Bạn kiểm soát rủi ro về hóa đơn chứng từ đầu vào và quy định thuế GTGT, thuế TNDN hiện hành như thế nào?",
    "Quy trình lập báo cáo tài chính cuối năm và chuẩn bị hồ sơ phục vụ thanh tra thuế hoặc kiểm toán độc lập của bạn ra sao?",
    "Bạn sử dụng thành thạo những phần mềm kế toán (MISA, FAST, SAP, ERP) và kỹ năng Excel phân tích dữ liệu nào?",
    "Khi phát hiện có sự chênh lệch số liệu giữa sổ sách kế toán và thực tế kiểm kê tồn kho/quỹ tiền mặt, bạn điều tra xử lý ra sao?",
  ],
  "Nhân viên Kinh doanh / Sales": [
    "Xin chào! Bạn hãy giới thiệu về bản thân và thành tích doanh số (KPI) ấn tượng nhất mà bạn từng đạt được.",
    "Quy trình tìm kiếm khách hàng tiềm năng mới (Prospecting) và mở rộng phễu khách hàng của bạn được triển khai như thế nào?",
    'Khi khách hàng đưa ra lời từ chối như "Giá bên em đắt quá" hoặc "Anh đang dùng bên khác rất ổn", bạn xử lý tình huống ra sao?',
    "Bạn sử dụng kỹ thuật chốt đơn (Closing techniques) nào hiệu quả nhất và cách bạn xây dựng mối quan hệ lâu dài sau bán hàng?",
    "Hãy kể về một thương vụ bán hàng khó khăn nhất mà bạn đã kiên trì theo đuổi và thuyết phục thành công.",
  ],
  "Chăm sóc khách hàng (CSKH / CX)": [
    "Xin chào! Hãy chia sẻ về kinh nghiệm giải quyết yêu cầu và chăm sóc trải nghiệm khách hàng (Customer Experience) của bạn.",
    "Khi tiếp nhận cuộc gọi hoặc tin nhắn từ một khách hàng vô cùng giận dữ vì sản phẩm bị lỗi, bạn lắng nghe và xoa dịu họ thế nào?",
    "Bạn đo lường và cải thiện các chỉ số đo độ hài lòng khách hàng (CSAT, NPS, FCR - First Contact Resolution) ra sao?",
    "Làm thế nào để bạn phối hợp nhịp nhàng với đội kỹ thuật hoặc kho vận để giải quyết khiếu nại của khách hàng nhanh nhất?",
    "Bạn duy trì sự tích cực, kiên nhẫn và tránh tình trạng kiệt sức (burnout) trong môi trường hỗ trợ khách hàng áp lực cao ra sao?",
  ],
};

// Hàm tìm kiếm bộ câu hỏi phỏng vấn phù hợp nhất theo từ khóa (Smart Matching)
function getMockQuestionsForJob(jobTitle) {
  if (!jobTitle) return MOCK_QUESTIONS["General Professional"];

  // 1. Khớp chính xác tên vị trí
  if (MOCK_QUESTIONS[jobTitle]) {
    return MOCK_QUESTIONS[jobTitle];
  }

  // 2. Khớp thông minh theo từ khóa không dấu / chữ thường
  const raw = jobTitle.toLowerCase();
  const normalize = (str) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const text = normalize(jobTitle);

  // Marketing & Truyền thông
  if (
    text.includes("marketing") ||
    text.includes("ads") ||
    text.includes("seo") ||
    text.includes("digital")
  ) {
    return MOCK_QUESTIONS["Digital Marketing Specialist"];
  }
  if (
    text.includes("content") ||
    text.includes("copywriter") ||
    text.includes("viet bai") ||
    text.includes("sang tao noi dung")
  ) {
    return MOCK_QUESTIONS["Content Creator / Copywriter"];
  }
  if (
    text.includes("pr") ||
    text.includes("truyen thong") ||
    text.includes("bao chi") ||
    text.includes("quan he cong chung")
  ) {
    return MOCK_QUESTIONS["Chuyên viên Truyền thông & PR"];
  }
  if (
    text.includes("social") ||
    text.includes("mang xa hoi") ||
    text.includes("tiktok") ||
    text.includes("facebook") ||
    text.includes("cong dong")
  ) {
    return MOCK_QUESTIONS["Social Media Manager"];
  }

  // Thiết kế & Nghệ thuật
  if (
    text.includes("graphic") ||
    text.includes("do hoa") ||
    text.includes("photoshop") ||
    text.includes("illustrator") ||
    text.includes("banner")
  ) {
    return MOCK_QUESTIONS["Graphic Designer (Thiết kế đồ họa)"];
  }
  if (
    text.includes("video") ||
    text.includes("motion") ||
    text.includes("premiere") ||
    text.includes("dung phim") ||
    text.includes("capcut") ||
    text.includes("after effect")
  ) {
    return MOCK_QUESTIONS["Video Editor / Motion Graphics"];
  }
  if (
    text.includes("3d") ||
    text.includes("blender") ||
    text.includes("maya") ||
    text.includes("modeling") ||
    text.includes("render")
  ) {
    return MOCK_QUESTIONS["3D Artist / Designer"];
  }
  if (
    text.includes("ui") ||
    text.includes("ux") ||
    text.includes("figma") ||
    text.includes("trai nghiem nguoi dung")
  ) {
    return MOCK_QUESTIONS["UI/UX Designer"];
  }

  // Ngôn ngữ & Ngoại ngữ / Biên phiên dịch
  if (
    text.includes("tieng anh") ||
    text.includes("english") ||
    text.includes("ielts") ||
    text.includes("toeic")
  ) {
    return MOCK_QUESTIONS["Biên / Phiên dịch Tiếng Anh"];
  }
  if (
    text.includes("tieng nhat") ||
    text.includes("japanese") ||
    text.includes("comtor") ||
    text.includes("n1") ||
    text.includes("n2") ||
    text.includes("n3")
  ) {
    return MOCK_QUESTIONS["Biên / Phiên dịch Tiếng Nhật"];
  }
  if (
    text.includes("tieng han") ||
    text.includes("korean") ||
    text.includes("topik") ||
    text.includes("han quoc")
  ) {
    return MOCK_QUESTIONS["Biên / Phiên dịch Tiếng Hàn"];
  }
  if (
    text.includes("tieng trung") ||
    text.includes("chinese") ||
    text.includes("hsk") ||
    text.includes("trung quoc") ||
    text.includes("hoa ngu")
  ) {
    return MOCK_QUESTIONS["Biên / Phiên dịch Tiếng Trung"];
  }
  if (
    text.includes("giao vien") ||
    text.includes("giang vien") ||
    text.includes("teacher") ||
    text.includes("su pham") ||
    text.includes("day hoc")
  ) {
    return MOCK_QUESTIONS["Giáo viên / Giảng viên Ngoại ngữ"];
  }

  // Kinh doanh, Tài chính, Nhân sự
  if (
    text.includes("nhan su") ||
    text.includes("recruiter") ||
    text.includes("tuyen dung") ||
    text.includes("hr")
  ) {
    return MOCK_QUESTIONS["Chuyên viên Nhân sự (HR)"];
  }
  if (
    text.includes("ke toan") ||
    text.includes("kiem toan") ||
    text.includes("accountant") ||
    text.includes("audit") ||
    text.includes("thue") ||
    text.includes("tai chinh")
  ) {
    return MOCK_QUESTIONS["Chuyên viên Kế toán / Kiểm toán"];
  }
  if (
    text.includes("sales") ||
    text.includes("kinh doanh") ||
    text.includes("ban hang") ||
    text.includes("tu van") ||
    text.includes("telesale")
  ) {
    return MOCK_QUESTIONS["Nhân viên Kinh doanh / Sales"];
  }
  if (
    text.includes("cskh") ||
    text.includes("cham soc khach hang") ||
    text.includes("ho tro") ||
    text.includes("support") ||
    text.includes("customer")
  ) {
    return MOCK_QUESTIONS["Chăm sóc khách hàng (CSKH / CX)"];
  }

  // Kỹ thuật & IT
  if (
    text.includes("frontend") ||
    text.includes("front-end") ||
    text.includes("react") ||
    text.includes("vue") ||
    text.includes("angular")
  ) {
    return MOCK_QUESTIONS["Frontend Developer"];
  }
  if (
    text.includes("backend") ||
    text.includes("node") ||
    text.includes("java") ||
    text.includes(".net") ||
    text.includes("python") ||
    text.includes("golang") ||
    text.includes("c#")
  ) {
    return MOCK_QUESTIONS["Backend Developer"];
  }
  if (
    text.includes("mobile") ||
    text.includes("flutter") ||
    text.includes("react native") ||
    text.includes("ios") ||
    text.includes("android")
  ) {
    return MOCK_QUESTIONS["Mobile Developer"];
  }
  if (
    text.includes("devops") ||
    text.includes("cloud") ||
    text.includes("aws") ||
    text.includes("docker") ||
    text.includes("kubernetes")
  ) {
    return MOCK_QUESTIONS["DevOps Engineer"];
  }
  if (
    text.includes("business analyst") ||
    text.includes("ba") ||
    text.includes("phan tich nghiep vu")
  ) {
    return MOCK_QUESTIONS["Business Analyst"];
  }
  if (
    text.includes("data") ||
    text.includes("du lieu") ||
    text.includes("analyst") ||
    text.includes("scientist")
  ) {
    return MOCK_QUESTIONS["Data Scientist"];
  }
  if (
    text.includes("qa") ||
    text.includes("tester") ||
    text.includes("kiem thu") ||
    text.includes("qc")
  ) {
    return MOCK_QUESTIONS["QA Engineer"];
  }
  if (text.includes("fullstack") || text.includes("full stack")) {
    return MOCK_QUESTIONS["Full Stack Developer"];
  }
  if (text.includes("scrum") || text.includes("agile")) {
    return MOCK_QUESTIONS["Scrum Master"];
  }
  if (
    text.includes("security") ||
    text.includes("an toan thong tin") ||
    text.includes("bao mat")
  ) {
    return MOCK_QUESTIONS["Cybersecurity"];
  }
  if (
    text.includes("database") ||
    text.includes("dba") ||
    text.includes("co so du lieu")
  ) {
    return MOCK_QUESTIONS["Database Admin"];
  }
  if (
    text.includes("project manager") ||
    text.includes("pm") ||
    text.includes("quan ly du an")
  ) {
    return MOCK_QUESTIONS["Project Manager"];
  }

  // Fallback mặc định
  return MOCK_QUESTIONS["General Professional"];
}

const MOCK_EVALUATIONS = {
  excellent: {
    score: 85,
    message: "Tuyệt vời! Câu trả lời của bạn rất thuyết phục và chuyên nghiệp.",
    tech: 90,
    comm: 85,
    soft: 80,
  },
  good: {
    score: 75,
    message: "Tốt! Bạn có trả lời đầy đủ, nhưng cần thêm ví dụ cụ thể.",
    tech: 75,
    comm: 75,
    soft: 70,
  },
  average: {
    score: 65,
    message: "Bình thường! Hãy chi tiết hơn và tự tin hơn trong trả lời.",
    tech: 65,
    comm: 60,
    soft: 65,
  },
  needs_improvement: {
    score: 50,
    message: "Cần cải thiện! Hãy học thêm kiến thức và luyện tập thêm.",
    tech: 45,
    comm: 50,
    soft: 55,
  },
};

// Biến toàn cục cho phỏng vấn
let currentInterviewSession = null;
let interviewQuestions = [];
let currentQuestionIndex = 0;
let interviewStartTime = null;
let userResponses = [];
let overallScore = 0;

// STT/TTS globals
let recognition = null;
let isListening = false;
let ttsEnabled = true;
let isHandsFreeMode = false;
let interviewerAvatarImage = null;
let availableVoices = [];

function loadSpeechVoices() {
  availableVoices = window.speechSynthesis.getVoices() || [];
  const updateVoices = () => {
    availableVoices = window.speechSynthesis.getVoices() || [];
  };
  window.speechSynthesis.onvoiceschanged = updateVoices;
  if (typeof window.speechSynthesis.addEventListener === "function") {
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
  }
  if (false) {
    window.speechSynthesis.onvoiceschanged = () => {
      availableVoices = window.speechSynthesis.getVoices() || [];
    };
  }
}

function onDomReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback);
  } else {
    callback();
  }
}

onDomReady(() => {
  if (typeof applyUserSettings === "function") { applyUserSettings(); }

  if (typeof updateSidebarUserInfo === "function") {
    updateSidebarUserInfo();
  }

  loadSpeechVoices();

  if (typeof updateUserAuthUI === "function") {
    updateUserAuthUI();
  }

  if (document.getElementById("ai-chat-form")) {
    initLandingChatbot();
  }

  if (window.location.pathname.endsWith("interview-practice.html")) {
    // Lifecycle is owned exclusively by interview.js (single lifecycle owner)
  } else if (document.getElementById("stat-sessions")) {
    initDashboard();
  } else if (document.getElementById("setup-container")) {
    initInterviewPage();
  }
});

function initLandingChatbot() {
  const form = document.getElementById("ai-chat-form");
  const input = document.getElementById("ai-chat-input");
  const messages = document.getElementById("ai-chat-messages");

  if (!form || !input || !messages) return;

  document.querySelectorAll("[data-chat-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.getAttribute("data-chat-suggestion") || "";
      form.requestSubmit();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const userText = input.value.trim();
    if (!userText) return;

    appendChatMessage(messages, userText, "user");
    input.value = "";
    input.disabled = true;

    const typingIndicator = createTypingIndicator();
    messages.appendChild(typingIndicator);
    messages.scrollTop = messages.scrollHeight;

    try {
      const reply = await getSupportBotReply(userText);
      messages.removeChild(typingIndicator);
      appendChatMessage(messages, reply, "bot");
    } catch (error) {
      messages.removeChild(typingIndicator);
      appendChatMessage(
        messages,
        "Xin lỗi, mình đang gặp chút trục trặc. Bạn có thể thử hỏi lại theo cách đơn giản hơn.",
        "bot",
      );
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
}

function appendChatMessage(messages, text, sender) {
  const bubble = document.createElement("div");
  bubble.className = `message ${sender}`;
  bubble.textContent = text;
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
}

function createTypingIndicator() {
  const bubble = document.createElement("div");
  bubble.className = "message bot";
  bubble.textContent = "Đang suy nghĩ...";
  return bubble;
}

async function getSupportBotReply(userMessage) {
  const lowerText = userMessage.toLowerCase();

  if (
    lowerText.includes("giá") ||
    lowerText.includes("gói") ||
    lowerText.includes("pro") ||
    lowerText.includes("thanh toán")
  ) {
    return "PrepMate có 2 gói phù hợp cho nhu cầu khác nhau: Gói Cơ Bản miễn phí cho trải nghiệm đầu tiên và Gói Pro 99.000đ/tháng với quyền truy cập AI nâng cao, đánh giá chuyên sâu và không giới hạn buổi phỏng vấn.";
  }

  if (
    lowerText.includes("đăng nhập") ||
    lowerText.includes("tài khoản") ||
    lowerText.includes("đăng ký")
  ) {
    return "Bạn có thể sử dụng trang Đăng nhập/Đăng ký để tạo tài khoản rồi mở Dashboard để bắt đầu luyện tập.";
  }

  if (lowerText.includes("phỏng vấn") || lowerText.includes("mock")) {
    return "Để bắt đầu, hãy mở trang Bắt đầu phỏng vấn, điền công việc và JD, sau đó hệ thống sẽ tạo câu hỏi phù hợp cho bạn.";
  }

  if (lowerText.includes("gemini") || lowerText.includes("api")) {
    return "Nếu bạn dùng Gói Pro, bạn có thể kết nối Gemini API Key của mình để bật trải nghiệm AI mạnh mẽ hơn.";
  }

  const apiKey =
    localStorage.getItem("gemini_api_key") ||
    localStorage.getItem("geminiApiKey") ||
    localStorage.getItem("gemini-api-key") ||
    "";
  if (apiKey) {
    try {
      const response = await callGeminiAPI(
        apiKey,
        `Bạn là trợ lý chăm sóc khách hàng cho PrepMate. Trả lời câu hỏi sau bằng tiếng Việt, ngắn gọn, thân thiện và hữu ích: ${userMessage}`,
        "Bạn là trợ lý hỗ trợ người dùng của PrepMate. Trả lời ngắn gọn, rõ ràng bằng tiếng Việt.",
      );
      return response.replace(/^\s+|\s+$/g, "");
    } catch (error) {
      console.warn("Fallback to local bot response:", error);
    }
  }

  return "Mình có thể giúp bạn về gói dịch vụ, đăng nhập, thanh toán hoặc cách bắt đầu phỏng vấn. Bạn có thể thử hỏi lại theo một câu đơn giản hơn.";
}

function initInterviewPage() {
  const setupContainer = document.getElementById("setup-container");
  if (!setupContainer) return;

  const jobTitleInput = document.getElementById("job-title");
  const jdText = document.getElementById("jd-text");
  const enableCamera = document.getElementById("enable-camera");
  const enableHandsfree = document.getElementById("enable-handsfree");
  const uploadBox = document.getElementById("upload-box");
  const cvFileInput = document.getElementById("cv-file");

  if (cvFileInput) {
    cvFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleCvUpload(e.target.files[0]);
      }
    });
  }

  if (jobTitleInput) {
    jobTitleInput.value = jobTitleInput.value || "";
  }
  if (jdText) {
    jdText.value = jdText.value || "";
  }
  if (enableCamera) {
    enableCamera.checked = true;
  }
  if (enableHandsfree) {
    enableHandsfree.checked = false;
  }
  if (uploadBox && cvFileInput) {
    uploadBox.style.cursor = "pointer";
  }

  const storedAvatar = localStorage.getItem("prepmate_interviewer_image");
  if (storedAvatar) {
    interviewerAvatarImage = storedAvatar;
    renderInterviewerPreview(storedAvatar);
  }

  const personaInput = document.getElementById("interviewer-persona");
  if (personaInput) {
    personaInput.value =
      localStorage.getItem("prepmate_interviewer_persona") || "professional";
  }
  const countryInput = document.getElementById("interviewer-country");
  if (countryInput) {
    countryInput.value =
      localStorage.getItem("prepmate_interviewer_country") || "vietnam";
  }
  updatePersonaPreview();
  updateCountryPreview();

  if (typeof updateUserAuthUI === "function") {
    updateUserAuthUI();
  }

  setInterviewerState("idle", "Sẵn sàng");
  applyInterviewerAvatar();
}

function handleInterviewerImageUpload(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    interviewerAvatarImage = dataUrl;
    localStorage.setItem("prepmate_interviewer_image", dataUrl);
    renderInterviewerPreview(dataUrl);
    applyInterviewerAvatar();
  };
  reader.readAsDataURL(file);
}

function saveSelectedPersona() {
  const personaInput = document.getElementById("interviewer-persona");
  if (!personaInput) return;
  localStorage.setItem("prepmate_interviewer_persona", personaInput.value);
  updatePersonaPreview();
}

function renderInterviewerPreview(dataUrl) {
  const preview = document.getElementById("interviewer-preview");
  if (!preview) return;

  if (!dataUrl) {
    preview.classList.add("hidden");
    preview.innerHTML = "";
    return;
  }

  preview.classList.remove("hidden");
  preview.innerHTML = `
        <img src="${dataUrl}" alt="Ảnh người phỏng vấn">
        <span>Ảnh người phỏng vấn đã sẵn sàng</span>
    `;
}

function applyInterviewerAvatar() {
  const avatarVisual = document.getElementById("ai-avatar-visual");
  if (!avatarVisual) return;

  if (!avatarVisual.querySelector(".avatar-interviewer-ring")) {
    avatarVisual.innerHTML = `
            <div class="avatar-interviewer-ring" id="interviewer-avatar-ring">
                <div class="avatar-interviewer" id="interviewer-avatar-preview">
                    <span>MV</span>
                </div>
            </div>
            <div class="camera-off-indicator interviewer-off-indicator">
                <span class="cam-off-icon">🤖</span>
                <span id="interviewer-state-badge">Người phỏng vấn AI</span>
            </div>
        `;
  }
}

function renderCvAnalysis(analysis) {
  const panel = document.getElementById("cv-analysis-panel");
  const summary = document.getElementById("cv-analysis-summary");
  const skills = document.getElementById("cv-key-skills");
  const suitability = document.getElementById("cv-analysis-suitability");
  const suggestions = document.getElementById("cv-analysis-suggestions");

  if (!panel || !summary || !skills || !suitability || !suggestions) return;
  if (!analysis) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");
  summary.innerText = analysis.summary || "Không có dữ liệu phân tích.";
  suitability.innerText =
    analysis.suitability !== undefined
      ? `Mức độ phù hợp: ${analysis.suitability}%`
      : "";
  skills.innerHTML = (analysis.keySkills || [])
    .map(
      (skill) =>
        `<span style="background: rgba(99, 102, 241, 0.16); color: #e0e7ff; padding: 6px 10px; border-radius: 999px; font-size: 13px;">${escapeHtml(skill)}</span>`,
    )
    .join(" ");
  suggestions.innerHTML = (analysis.suggestions || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const noticeId = "cv-transferable-skills-notice";
  let noticeEl = document.getElementById(noticeId);
  if (analysis.suitability !== undefined && analysis.suitability < 60) {
    if (!noticeEl) {
      noticeEl = document.createElement("div");
      noticeEl.id = noticeId;
      noticeEl.style.cssText = "margin-top: 12px; padding: 10px 14px; border-radius: 8px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); color: #93c5fd; font-size: 12px; line-height: 1.5;";
      panel.appendChild(noticeEl);
    }
    noticeEl.innerHTML = "💡 <strong>Gợi ý chuyển ngành / kinh nghiệm mới:</strong> AI phỏng vấn sẽ tập trung đánh giá các kỹ năng chuyển giao (transferable skills), tư duy giải quyết vấn đề và tiềm năng thích ứng của bạn.";
  } else if (noticeEl) {
    noticeEl.remove();
  }
}

function clearCvAnalysis() {
  const panel = document.getElementById("cv-analysis-panel");
  if (panel) panel.classList.add("hidden");
}

// ─── SERVER-BACKED QUOTA HELPER ─────────────────────────────────────
window._cachedUserQuota = null;
window._cachedUserQuotaTimestamp = 0;

async function fetchUserQuota(forceRefresh = false) {
  if (!forceRefresh && window._cachedUserQuota && (Date.now() - (window._cachedUserQuotaTimestamp || 0) < 60000)) {
    return window._cachedUserQuota;
  }
  try {
    const apiClient = window.InterviewApiClient;
    let url = "/api/user/quota";
    if (apiClient && typeof apiClient.buildUrl === "function") {
      url = apiClient.buildUrl("/api/user/quota");
    } else if (typeof buildApiUrl === "function") {
      url = buildApiUrl("/api/user/quota");
    } else if (typeof API_BASE_URL !== "undefined" && API_BASE_URL) {
      url = `${API_BASE_URL.replace(/\/+$/, "")}/api/user/quota`;
    }

    const headers = { "Content-Type": "application/json" };
    const user = typeof getCurrentUser === "function" ? getCurrentUser() : null;
    if (user?.token) {
      headers["Authorization"] = `Bearer ${user.token}`;
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
      credentials: "include"
    });

    if (res.ok) {
      const quota = await res.json();
      window._cachedUserQuota = quota;
      window._cachedUserQuotaTimestamp = Date.now();
      return quota;
    }
  } catch (err) {
    console.warn("fetchUserQuota failed:", err);
  }
  return window._cachedUserQuota || null;
}
window.fetchUserQuota = fetchUserQuota;

function getFreeTierStatus() {
  if (window._cachedUserQuota) {
    const q = window._cachedUserQuota;
    return {
      isFree: q.tier === "free",
      isGuest: q.tier === "guest",
      isPro: q.tier === "pro",
      tier: q.tier,
      used: q.used,
      limit: q.limit,
      remaining: q.remaining,
      canStart: q.canStart,
      resetAt: q.resetAt
    };
  }
  const user = getCurrentUser();
  if (!user) {
    return { isFree: true, isGuest: true, isPro: false, tier: "guest", used: 0, limit: 1, remaining: 1, canStart: true };
  }
  const isProActive = user.subscription === "pro" && (!user.subscriptionExpiry || new Date(user.subscriptionExpiry) > new Date());
  if (
    isProActive ||
    user.role === "admin" ||
    user.role === "manager"
  ) {
    return { isFree: false, isGuest: false, isPro: true, tier: "pro", used: 0, limit: Infinity, remaining: Infinity, canStart: true };
  }
  return {
    isFree: true,
    isGuest: false,
    isPro: false,
    tier: "free",
    used: 0,
    limit: 3,
    remaining: 3,
    canStart: true,
  };
}

function showUpgradeModal(reason) {
  const existing = document.getElementById("upgrade-modal-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "upgrade-modal-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;";
  overlay.innerHTML = `
        <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);border:1px solid rgba(139,92,246,0.5);border-radius:20px;padding:40px;max-width:480px;width:90%;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,0.5);">
            <div style="font-size:56px;margin-bottom:16px;">🔒</div>
            <h2 style="color:#fff;font-size:22px;margin-bottom:10px;font-family:'Outfit',sans-serif;">Đã đến giới hạn gói Free</h2>
            <p style="color:rgba(255,255,255,0.7);font-size:15px;margin-bottom:24px;line-height:1.6;">${reason}</p>
            <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:20px;margin-bottom:28px;text-align:left;">
                <p style="color:#a5b4fc;font-weight:700;margin-bottom:12px;">✨ Gói PRO mở khoá:</p>
                <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:6px 0;">✅ Không giới hạn lượt phỏng vấn</p>
                <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:6px 0;">✅ Phân tích CV nâng cao bằng AI</p>
                <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:6px 0;">✅ Gợi ý công việc phù hợp</p>
                <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:6px 0;">✅ Lộ trình sự nghiệp cá nhân hoá</p>
                <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:6px 0;">✅ Báo cáo chi tiết STAR đầy đủ</p>
            </div>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button onclick="window.location.href='../payment/pricing.html'" style="background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff;border:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif;">🚀 Xem Bảng giá & Nâng cấp</button>
                <button onclick="document.getElementById('upgrade-modal-overlay').remove()" style="background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:14px 20px;border-radius:10px;font-size:15px;cursor:pointer;font-family:'Outfit',sans-serif;">Để sau</button>
            </div>
            <p style="color:rgba(255,255,255,0.4);font-size:12px;margin-top:16px;">💳 Thanh toán an toàn qua Momo hoặc chuyển khoản ngân hàng</p>
        </div>
    `;
  document.body.appendChild(overlay);
}
// ────────────────────────────────────────────────────────────────────

async function fetchCvAnalysis(cvText, jobTitle, userDescription, language) {
  // 🔒 FREE TIER: Block CV Analysis
  const tierStatus = getFreeTierStatus();
  if (tierStatus.isFree) {
    return {
      summary:
        "🔒 Tính năng này dành riêng cho thành viên PRO. Nâng cấp để nhận phân tích CV chi tiết bằng AI.",
      keySkills: ["🔒 Yêu cầu gói PRO"],
      experience: "🔒 Nâng cấp PRO để xem",
      suitability: 0,
      suggestions: [
        "Nâng cấp lên gói PRO để mở khoá phân tích CV bằng AI Gemini",
      ],
      locked: true,
    };
  }
  const apiKey = getStoredApiKey();
  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/analyze-cv`, {
      method: "POST",
      headers: Object.assign(
        { "Content-Type": "application/json" },
        apiKey ? { "x-api-key": apiKey } : {},
      ),
      body: JSON.stringify({ cvText, jobTitle, userDescription, language }),
    });
    if (!res.ok) throw new Error(`Không thể lấy phân tích CV (${res.status})`);
    return await res.json();
  } catch (err) {
    console.warn("fetchCvAnalysis error:", err.message);
    return {
      summary:
        "Hồ sơ đã được tải lên thành công. AI sẽ sử dụng thông tin này để tạo câu hỏi phù hợp.",
      keySkills: ["Kỹ năng ở mức chung", "Phân tích chưa chi tiết"],
      experience: "Không có dữ liệu kinh nghiệm rõ ràng",
      suitability: 70,
      suggestions: ["Hoàn thiện CV bằng cách nhấn mạnh thành tựu quan trọng"],
    };
  }
}

async function fetchJobRecommendations(cvText, jobTitle) {
  // 🔒 FREE TIER: Block Job Recommendations
  const tierStatus = getFreeTierStatus();
  if (tierStatus.isFree) {
    return {
      recommendations: [
        {
          role: "🔒 Yêu cầu PRO",
          reason:
            "Nâng cấp lên gói PRO để nhận gợi ý công việc cá nhân hoá từ AI dựa trên hồ sơ của bạn.",
          locked: true,
        },
      ],
    };
  }
  const apiKey = getStoredApiKey();
  if (apiKey) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/job-recommendations`, {
        method: "POST",
        headers: Object.assign(
          { "Content-Type": "application/json" },
          apiKey ? { "x-api-key": apiKey } : {},
        ),
        body: JSON.stringify({ cvText, jobTitle, userDescription, language }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("fetchJobRecommendations error:", err.message);
    }
  }

  const normalized = (jobTitle || "").toLowerCase();
  const fallback = [];
  if (normalized.includes("frontend")) {
    fallback.push({
      role: "Frontend Developer",
      reason:
        "Kỹ năng giao diện và trải nghiệm người dùng là thế mạnh rõ ràng.",
    });
    fallback.push({
      role: "React Developer",
      reason: "Phù hợp với nhiều dự án web tương tác.",
    });
    fallback.push({
      role: "UI/UX Engineer",
      reason: "Phù hợp khi có tư duy thiết kế và kỹ thuật.",
    });
  } else if (normalized.includes("backend")) {
    fallback.push({
      role: "Backend Developer",
      reason: "Nền tảng hệ thống và xử lý dữ liệu phù hợp.",
    });
    fallback.push({
      role: "API Engineer",
      reason: "Thích hợp với công việc xây dựng dịch vụ và tích hợp.",
    });
    fallback.push({
      role: "Database Specialist",
      reason: "Phù hợp nếu bạn có kinh nghiệm với cơ sở dữ liệu.",
    });
  } else {
    fallback.push({
      role: jobTitle || "IT Specialist",
      reason: "Có thể mở rộng sang nhiều vị trí kỹ thuật nền tảng.",
    });
    fallback.push({
      role: "Project Support",
      reason: "Tốt để tích lũy kinh nghiệm trong môi trường dự án.",
    });
    fallback.push({
      role: "Consultant Assistant",
      reason: "Thích hợp khi muốn phát triển kỹ năng mềm và hiểu nghiệp vụ.",
    });
  }

  return { recommendations: fallback };
}

async function fetchCareerRoadmap(cvText, jobTitle) {
  // 🔒 FREE TIER: Block Career Roadmap
  const tierStatus = getFreeTierStatus();
  if (tierStatus.isFree) {
    return {
      roadmap: [
        {
          step: "🔒",
          advice:
            "Nâng cấp lên gói PRO để nhận lộ trình phát triển sự nghiệp cá nhân hoá từ AI theo vị trí bạn ứng tuyển.",
          locked: true,
        },
      ],
    };
  }
  const apiKey = getStoredApiKey();
  if (apiKey) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/career-roadmap`, {
        method: "POST",
        headers: Object.assign(
          { "Content-Type": "application/json" },
          apiKey ? { "x-api-key": apiKey } : {},
        ),
        body: JSON.stringify({ cvText, jobTitle, userDescription, language }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("fetchCareerRoadmap error:", err.message);
    }
  }

  return {
    roadmap: [
      {
        step: "1",
        advice: "Làm rõ thành tựu quan trọng, số liệu và kết quả trong CV.",
      },
      {
        step: "2",
        advice: "Luyện tập STAR cho các câu hỏi hành vi và tình huống.",
      },
      {
        step: "3",
        advice: "Mở rộng kiến thức chuyên môn theo hướng công việc mong muốn.",
      },
    ],
  };
}

function renderDashboardRecommendations(sessions) {
  const suggestionsList = document.getElementById("job-suggestions-list");
  const roadmapList = document.getElementById("career-roadmap-list");
  if (!suggestionsList || !roadmapList) return;

  if (!sessions || sessions.length === 0) {
    suggestionsList.innerHTML =
      '<p style="margin:0;">Chưa có dữ liệu để đề xuất. Hoàn thành phiên phỏng vấn đầu tiên để nhận gợi ý.</p>';
    roadmapList.innerHTML =
      '<p style="margin:0;">Hoàn thành phiên phỏng vấn đầu tiên để xây dựng lộ trình phát triển cá nhân.</p>';
    return;
  }

  const latestSession = sessions[sessions.length - 1];
  if (
    latestSession.jobRecommendations &&
    latestSession.jobRecommendations.length
  ) {
    suggestionsList.innerHTML = latestSession.jobRecommendations
      .map(
        (item) =>
          `<div style="margin-bottom:12px;"><strong>${escapeHtml(item.role)}</strong><p style="margin:6px 0 0 0;color:#cbd5e1;">${escapeHtml(item.reason)}</p></div>`,
      )
      .join("");
  } else {
    suggestionsList.innerHTML =
      '<p style="margin:0;">Chưa có đề xuất công việc cụ thể. Hãy hoàn thành một phiên phỏng vấn với Gemini API Key để nhận kết quả phù hợp hơn.</p>';
  }

  if (latestSession.careerRoadmap && latestSession.careerRoadmap.length) {
    roadmapList.innerHTML = latestSession.careerRoadmap
      .map(
        (item) =>
          `<div style="margin-bottom:12px;"><strong>Bước ${escapeHtml(item.step)}</strong><p style="margin:6px 0 0 0;color:#cbd5e1;">${escapeHtml(item.advice)}</p></div>`,
      )
      .join("");
  } else {
    roadmapList.innerHTML =
      '<p style="margin:0;">Lộ trình chưa có. Hãy hoàn thành phiên phỏng vấn để AI xây dựng lộ trình cụ thể cho bạn.</p>';
  }
}

function setInterviewerState(state, label) {
  const avatarVisual = document.getElementById("ai-avatar-visual");
  const statusPill = document.getElementById("interviewer-status-pill");
  const statusText = document.getElementById("interviewer-status-text");
  const videoLabel = document.getElementById("interviewer-video-label");
  const wave = document.getElementById("voice-wave");
  const tile = document.getElementById("interviewer-tile");
  const ring = document.getElementById("interviewer-avatar-ring");
  const stateBadge = document.getElementById("interviewer-state-badge");

  if (avatarVisual) {
    avatarVisual.className = `ai-avatar-visual ${state}`;
    applyInterviewerAvatar();
  }

  if (stateBadge) {
    if (state === "speaking") stateBadge.innerText = "Đang trao đổi...";
    else if (state === "listening") stateBadge.innerText = "Đang lắng nghe...";
    else if (state === "thinking") stateBadge.innerText = "Đang ghi nhận...";
    else stateBadge.innerText = "Người phỏng vấn";
  }

  if (ring) {
    ring.classList.toggle("speaking", state === "speaking");
  }

  if (statusText) {
    statusText.innerText = label;
  } else if (statusPill) {
    statusPill.innerText = label;
  }

  if (videoLabel) {
    const nameEl = document.getElementById("interviewer-name-display");
    const interviewerName = nameEl?.textContent?.trim() || "Người phỏng vấn";
    videoLabel.innerText = `${interviewerName} (${label})`;
  }
  if (wave)
    wave.classList.toggle(
      "active",
      state === "speaking" || state === "listening",
    );

  if (tile) {
    tile.classList.remove("speaking", "listening", "thinking", "idle");
    tile.classList.add(state);
  }

  // ── Three.js / Avatar visualizer state sync ──
  if (typeof pmAvatarSetState === "function") {
    pmAvatarSetState(state);
  }
}

function getSelectedPersona() {
  const personaInput = document.getElementById("interviewer-persona");
  if (personaInput && personaInput.value) return personaInput.value;
  if (typeof window !== "undefined") {
    if (window.currentInterviewSession && window.currentInterviewSession.interviewerPersona) {
      return window.currentInterviewSession.interviewerPersona;
    }
    if (window.sessionStorage) {
      try {
        const initDataStr = window.sessionStorage.getItem("interview_init_data");
        if (initDataStr) {
          const initData = JSON.parse(initDataStr);
          if (initData.interviewerPersona) return initData.interviewerPersona;
        }
      } catch (e) {}
    }
    if (window.localStorage) {
      const localPersona = window.localStorage.getItem("prepmate_interviewer_persona");
      if (localPersona) return localPersona;
    }
  }
  return "professional";
}

function updatePersonaPreview() {
  const preview = document.getElementById("persona-preview");
  const personaTag = document.getElementById("interviewer-persona-tag");
  const persona = getSelectedPersona();
  const details = getPersonaDetails(persona);

  if (preview) {
    preview.innerText = `Tông lời nói: ${details.tone} · Mức độ thử thách: ${details.stress} · Trọng tâm: ${details.focus}`;
  }
  if (personaTag) {
    personaTag.innerText = details.label;
  }
}

function getPersonaDetails(persona) {
  if (persona === "friendly") {
    return {
      label: "Nhà tuyển dụng thân thiện",
      tone: "gần gũi, khích lệ",
      stress: "thấp",
      focus: "tập trung vào sự phù hợp văn hóa và tiềm năng",
      voiceGender: "female",
    };
  }
  if (persona === "balanced") {
    return {
      label: "Nhà tuyển dụng cân bằng",
      tone: "điềm tĩnh, rõ ràng",
      stress: "trung bình",
      focus: "kết hợp giữa kỹ năng chuyên môn và kỹ năng mềm",
      voiceGender: "female",
    };
  }
  return {
    label: "Nhà tuyển dụng chuyên nghiệp",
    tone: "chuyên nghiệp, nghiêm túc",
    stress: "thử thách cao",
    focus: "đào sâu kỹ năng chuyên môn và tư duy xử lý vấn đề",
    voiceGender: "male",
  };
}

function getSelectedCountry() {
  const countryInput = document.getElementById("interviewer-country");
  return countryInput ? countryInput.value : "vietnam";
}

function getCountryDetails(country) {
  if (country === "usa") {
    return { label: "Hoa Kỳ", language: "English", voiceCode: "en-US" };
  }
  if (country === "uk") {
    return { label: "Anh Quốc", language: "English", voiceCode: "en-GB" };
  }
  return { label: "Việt Nam", language: "Tiếng Việt", voiceCode: "vi-VN" };
}

function updateCountryPreview() {
  const preview = document.getElementById("country-preview");
  const country = getSelectedCountry();
  const details = getCountryDetails(country);

  if (preview) {
    preview.innerText = `Ngôn ngữ: ${details.language} · Giọng điệu phù hợp với ${details.label}`;
  }
}

function saveSelectedCountry() {
  const countryInput = document.getElementById("interviewer-country");
  if (!countryInput) return;
  localStorage.setItem("prepmate_interviewer_country", countryInput.value);
  updateCountryPreview();
}

function getPersonaPromptPrefix() {
  const persona = getSelectedPersona();
  const details = getPersonaDetails(persona);
  const countryDetails = getCountryDetails(getSelectedCountry());
  return `Bạn là một nhà tuyển dụng từ ${countryDetails.label}. Hãy phỏng vấn hoàn toàn bằng ${countryDetails.language}, giọng nói ${details.voiceGender === "female" ? "nữ" : "nam"}, tông lời nói ${details.tone}, mức độ căng thẳng ${details.stress}, và hướng hỏi ${details.focus}. Không được chuyển sang ngôn ngữ khác.`;
}

function getSpeechLanguage() {
  const countryDetails = getCountryDetails(getSelectedCountry());
  return countryDetails.voiceCode;
}

function getRecognitionLanguage() {
  const countryDetails = getCountryDetails(getSelectedCountry());
  return countryDetails.voiceCode;
}

function matchVoiceGender(voice, gender) {
  const voiceId = `${voice.name || ""} ${voice.voiceURI || ""}`.toLowerCase();
  const femaleTags =
    /female|woman|girl|zira|sarah|samantha|nina|alloy|linda|anna|emma|amy|laura|maria|allison|elizabeth|vanessa|lucy|victoria|jane|bella|hoa|thuy|mai|lan|ngoc/i;
  const maleTags =
    /male|man|boy|david|john|mark|matt|tom|michael|peter|alex|william|danny|george|tony|anh|nam|hung|viet|quan/i;
  if (gender === "female") return femaleTags.test(voiceId);
  if (gender === "male") return maleTags.test(voiceId);
  return false;
}

function getPreferredSpeechVoice() {
  const speechLang = getSpeechLanguage();
  const personaDetails = getPersonaDetails(getSelectedPersona());
  const voices = availableVoices.length
    ? availableVoices
    : window.speechSynthesis.getVoices();
  const normalizedLang = speechLang.toLowerCase();
  const baseLang = normalizedLang.split("-")[0];

  const exactLangMatches = voices.filter(
    (v) => v.lang.toLowerCase() === normalizedLang,
  );
  const baseLangMatches =
    exactLangMatches.length > 0
      ? exactLangMatches
      : voices.filter((v) => v.lang.toLowerCase().startsWith(baseLang));

  const genderMatches = baseLangMatches.filter((v) =>
    matchVoiceGender(v, personaDetails.voiceGender),
  );
  if (genderMatches.length > 0) return genderMatches[0];

  if (baseLangMatches.length > 0) return baseLangMatches[0];

  const fallbackGenderMatches = voices.filter((v) =>
    matchVoiceGender(v, personaDetails.voiceGender),
  );
  if (fallbackGenderMatches.length > 0) return fallbackGenderMatches[0];

  return (
    voices.find((v) => v.lang.toLowerCase().startsWith(baseLang)) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("vi")) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
    voices[0]
  );
}

function detectOffTopicAnswer(question, answer, jobTitle) {
  if (!question || !answer) return false;

  const normalize = (text) =>
    text
      .toLowerCase()
      .replace(
        /[^a-z0-9áàảãạăắằẵặâấầẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s]/g,
        " ",
      )
      .split(/\s+/)
      .filter(Boolean);

  const questionWords = new Set(
    normalize(question).filter((word) => word.length > 3),
  );
  const answerWords = normalize(answer).filter((word) => word.length > 2);
  const titleWords = new Set(
    normalize(jobTitle || "").filter((word) => word.length > 3),
  );

  if (answerWords.length === 0) return true;

  let matchCount = 0;
  answerWords.forEach((word) => {
    if (questionWords.has(word) || titleWords.has(word)) {
      matchCount += 1;
    }
  });

  const relevanceRatio = matchCount / answerWords.length;
  return relevanceRatio < 0.15;
}

// ==========================================
// STORAGE & API FUNCTIONS
// ==========================================

// ==========================================
// UI UTILITIES — Toast & Confirm Dialog
// ==========================================

/**
 * showToast(message, type) — type: 'success' | 'error' | 'info' | 'warning'
 * Shows a non-blocking toast notification instead of alert()
 */
function showToast(message, type = "info") {
  // Create container if not exists
  let container = document.getElementById("prepmate-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "prepmate-toast-container";
    container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
        `;
    document.body.appendChild(container);
  }

  const colors = {
    success: {
      bg: "rgba(16,185,129,0.15)",
      border: "rgba(16,185,129,0.3)",
      color: "#34d399",
    },
    error: {
      bg: "rgba(239,68,68,0.15)",
      border: "rgba(239,68,68,0.3)",
      color: "#f87171",
    },
    warning: {
      bg: "rgba(245,158,11,0.15)",
      border: "rgba(245,158,11,0.3)",
      color: "#fbbf24",
    },
    info: {
      bg: "rgba(59,130,246,0.15)",
      border: "rgba(59,130,246,0.3)",
      color: "#60a5fa",
    },
  };

  const c = colors[type] || colors.info;
  const toast = document.createElement("div");
  toast.style.cssText = `
        background: #1a2236;
        border: 1px solid ${c.border};
        border-left: 3px solid ${c.color};
        color: #f1f5f9;
        padding: 12px 20px;
        border-radius: 10px;
        font-family: 'Outfit', sans-serif;
        font-size: 14px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        pointer-events: all;
        max-width: 360px;
        line-height: 1.5;
        transition: all 0.3s;
        opacity: 0;
        transform: translateX(20px);
    `;
  toast.textContent = message;
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(0)";
  });

  // Auto remove
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * showConfirmDialog(message) — returns Promise<boolean>
 * Shows an in-page modal confirm dialog instead of confirm()
 */
function showConfirmDialog(message) {
  return new Promise((resolve) => {
    // Remove any existing confirm dialog
    const existing = document.getElementById("prepmate-confirm-dialog");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "prepmate-confirm-dialog";
    overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(4px);
            z-index: 99998;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;

    overlay.innerHTML = `
            <div style="
                background: #1a2236;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 16px;
                padding: 28px;
                max-width: 420px;
                width: 100%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                font-family: 'Outfit', sans-serif;
            ">
                <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">${message}</p>
                <div style="display: flex; gap: 12px;">
                    <button id="confirm-cancel" style="
                        flex: 1;
                        padding: 12px;
                        background: rgba(255,255,255,0.05);
                        border: 1px solid rgba(255,255,255,0.1);
                        border-radius: 10px;
                        color: #94a3b8;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        font-family: 'Outfit', sans-serif;
                    ">Tiếp tục phỏng vấn</button>
                    <button id="confirm-ok" style="
                        flex: 1;
                        padding: 12px;
                        background: rgba(239,68,68,0.15);
                        border: 1px solid rgba(239,68,68,0.3);
                        border-radius: 10px;
                        color: #f87171;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        font-family: 'Outfit', sans-serif;
                    ">Kết thúc phỏng vấn</button>
                </div>
            </div>
        `;

    document.body.appendChild(overlay);

    document.getElementById("confirm-ok").addEventListener("click", () => {
      overlay.remove();
      resolve(true);
    });

    document.getElementById("confirm-cancel").addEventListener("click", () => {
      overlay.remove();
      resolve(false);
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}

// ==========================================
// UNIFIED SIDEBAR & USER PROFILE LOGIC
// ==========================================

function toggleUserDropdown(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById("user-dropdown");
  if (!menu) return;
  const isShown = menu.style.display === "block";
  menu.style.display = isShown ? "none" : "block";
}

// Close user dropdown when clicking outside or pressing Escape
document.addEventListener("click", (e) => {
  const menu = document.getElementById("user-dropdown");
  if (
    menu &&
    menu.style.display === "block" &&
    !e.target.closest(".user-profile-sidebar")
  ) {
    menu.style.display = "none";
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const menu = document.getElementById("user-dropdown");
    if (menu && menu.style.display === "block") {
      menu.style.display = "none";
    }
  }
});

function initSidebarUserProfile() {
  const isFeatures = window.location.pathname.includes("/features/");
  const root = isFeatures ? "../../" : "./";
  let user = null;
  if (typeof getCurrentUser === "function") {
    user = getCurrentUser();
  } else {
    try {
      const raw =
        localStorage.getItem("prepmate_current_user") ||
        localStorage.getItem("user");
      if (raw) user = JSON.parse(raw);
    } catch (e) {}
  }

  const isGuest = !user;
  const isStaff = user && (user.role === "admin" || user.role === "manager");
  const isPro = user && user.subscription === "pro" && (!user.subscriptionExpiry || new Date(user.subscriptionExpiry) > new Date());
  const isTrial = user && !isPro && !isStaff;

  const name = isGuest
    ? "Khách dùng thử"
    : (user && (user.fullname || user.username)) || "Học viên PrepMate";
  const email = isGuest
    ? "Bản trải nghiệm miễn phí"
    : (user && user.email) ||
      (user && user.username
        ? `${user.username}@gmail.com`
        : "candidate@prepmate.ai");
  const initial = isGuest
    ? "K"
    : (name.replace(/[^a-zA-Z0-9À-ỹ]/g, "").charAt(0) || "P").toUpperCase();

  const nameEl = document.getElementById("sidebar-user-name");
  if (nameEl) nameEl.textContent = name;

  const emailEl = document.getElementById("sidebar-user-email");
  if (emailEl) {
    if (isGuest) {
      emailEl.innerHTML =
        '<span style="color:#059669; font-weight:600;">Khách dùng thử</span>';
    } else if (isTrial) {
      emailEl.innerHTML =
        '<span style="color:#2563eb; font-weight:600;">Gói Free (Dùng thử)</span>';
    } else if (isPro) {
      emailEl.innerHTML =
        '<span style="color:#d97706; font-weight:700;">Hội viên PRO</span>';
    } else if (isStaff) {
      emailEl.innerHTML =
        '<span style="color:#7c3aed; font-weight:700;">Quản trị viên</span>';
    } else {
      emailEl.textContent = email;
    }
  }

  const avatarEl = document.getElementById("sidebar-avatar");
  if (avatarEl) {
    avatarEl.textContent = initial;
    if (isGuest) {
      avatarEl.style.background = "linear-gradient(135deg, #64748b, #475569)";
    } else if (isPro) {
      avatarEl.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
    } else {
      avatarEl.style.background = "linear-gradient(135deg, #1d4ed8, #2563eb)";
    }
  }

  const dropNameEl = document.getElementById("dropdown-user-name");
  if (dropNameEl) dropNameEl.textContent = name;

  const dropEmailEl = document.getElementById("dropdown-user-email");
  if (dropEmailEl)
    dropEmailEl.textContent = isGuest ? "Chưa đăng nhập tài khoản" : email;

  // Adjust user dropdown menu items for guest (hide internal history/settings/logout)
  const dropdownMenu = document.getElementById("user-dropdown");
  if (dropdownMenu && isGuest) {
    dropdownMenu.innerHTML = `
            <div class="dropdown-header">
                <div class="header-menu-top" style="padding: 4px 2px 6px;">
                    <div class="header-menu-avatar" style="width: 36px; height: 36px; font-size: 14px; background: linear-gradient(135deg, #64748b, #475569);">K</div>
                    <div class="header-menu-meta">
                        <strong id="dropdown-user-name">Khách dùng thử</strong>
                        <span id="dropdown-user-email">Chưa đăng nhập</span>
                        <span class="header-menu-badge badge-free">Trải nghiệm</span>
                    </div>
                </div>
            </div>
            <div class="dropdown-divider"></div>
            <a href="${root}features/auth/auth.html" class="dropdown-item" style="color: #1d4ed8; font-weight: 700;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                <span>Đăng nhập / Đăng ký</span>
            </a>
            <a href="${root}features/payment/pricing.html" class="dropdown-item" style="color: #0f172a; font-weight: 600;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span>Nâng cấp Gói PRO</span>
            </a>
        `;
  }

  // Hide staff/admin nav link for guest and trial users
  const adminNav = document.getElementById("admin-nav-link");
  if (adminNav) {
    adminNav.style.display = isStaff ? "flex" : "none";
  }

  // Hide technical API key boxes for guest and normal users
  document.querySelectorAll(".api-key-box").forEach((box) => {
    box.style.display = "none";
  });

  const welcomeNameEl = document.getElementById("current-user-name-welcome");
  if (welcomeNameEl) welcomeNameEl.textContent = name;

  updateSidebarActiveLink();
}

function updateSidebarActiveLink() {
  const currentPath = window.location.pathname.toLowerCase();
  const currentHash = window.location.hash.toLowerCase();
  const currentFilename =
    currentPath.split("/").pop().split("?")[0] || "dashboard.html";
  const navLinks = document.querySelectorAll(".sidebar-new .nav-new a");

  if (navLinks.length === 0) return;

  navLinks.forEach((link) => link.classList.remove("active"));

  let matched = false;
  // 1. First priority: match exact hash if present (e.g. #qbank-section)
  if (currentHash) {
    navLinks.forEach((link) => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      if (href.includes(currentHash)) {
        link.classList.add("active");
        matched = true;
      }
    });
  }

  // 2. Second priority: match filename if no hash matched
  if (!matched) {
    navLinks.forEach((link) => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      const linkFile = href.split("/").pop().split("#")[0].split("?")[0];
      if (
        linkFile &&
        currentFilename &&
        linkFile === currentFilename &&
        !href.includes("#")
      ) {
        link.classList.add("active");
        matched = true;
      }
    });
  }

  // 3. Fallback: if on dashboard.html and nothing matched
  if (
    !matched &&
    (currentFilename.includes("dashboard") || currentFilename === "")
  ) {
    const firstLink = document.querySelector(
      '.sidebar-new .nav-new a[href*="dashboard.html"]',
    );
    if (firstLink) firstLink.classList.add("active");
  }
}

// Listen to hash changes on the fly
window.addEventListener("hashchange", () => {
  updateSidebarActiveLink();
});

// ==========================================
// QUESTION BANK (CORE KNOWLEDGE) CONTROLLER
// ==========================================
let currentQBankRole = "all";

function filterQBankByRole(role, btnElement) {
  currentQBankRole = role;

  // Update chip active state
  if (btnElement) {
    document
      .querySelectorAll(".qbank-chip")
      .forEach((c) => c.classList.remove("active"));
    btnElement.classList.add("active");
  }

  applyQBankFilters();
}

function searchQBank(keyword) {
  applyQBankFilters(keyword);
}

function applyQBankFilters(keywordOverride) {
  const searchInput = document.getElementById("qbank-search-input");
  const query = (
    keywordOverride !== undefined
      ? keywordOverride
      : searchInput
        ? searchInput.value
        : ""
  )
    .trim()
    .toLowerCase();
  const cards = document.querySelectorAll(".qbank-card");
  const container = document.getElementById("qbank-container");
  let visibleCount = 0;

  cards.forEach((card) => {
    const cardRole = card.getAttribute("data-role") || "";
    const roleMatches =
      currentQBankRole === "all" || cardRole === currentQBankRole;
    const cardText = card.textContent.toLowerCase();
    const searchMatches = !query || cardText.includes(query);

    if (roleMatches && searchMatches) {
      card.style.display = "flex";
      visibleCount++;
    } else {
      card.style.display = "none";
    }
  });

  // Handle empty state
  let emptyEl = document.getElementById("qbank-empty-state");
  if (visibleCount === 0) {
    if (!emptyEl && container) {
      emptyEl = document.createElement("div");
      emptyEl.id = "qbank-empty-state";
      emptyEl.className = "qbank-empty-state";
      emptyEl.innerHTML = `
                <div style="font-size:36px;margin-bottom:8px;">🔍</div>
                <h4 style="color:#0f172a;font-size:15px;margin:0 0 6px;">Không tìm thấy câu hỏi phù hợp</h4>
                <p style="font-size:13px;color:#64748b;margin:0 0 14px;">Thử tìm kiếm với từ khóa khác hoặc chọn vị trí "Tất cả".</p>
                <button type="button" class="qbank-chip active" onclick="filterQBankByRole('all', document.querySelector('.qbank-chip'))">Xem tất cả câu hỏi</button>
            `;
      container.appendChild(emptyEl);
    } else if (emptyEl) {
      emptyEl.style.display = "block";
    }
  } else {
    if (emptyEl) emptyEl.style.display = "none";
  }
}

var _isSmoothScrollingInitialized = false;

// Run on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initSidebarUserProfile();
    initSmoothScrolling();
  });
} else {
  initSidebarUserProfile();
  initSmoothScrolling();
}

// ==========================================
// SMOOTH SCROLLING WITH STICKY HEADER OFFSET
// ==========================================
function initSmoothScrolling() {
  if (_isSmoothScrollingInitialized) return;
  _isSmoothScrollingInitialized = true;
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href) return;

    const hashIndex = href.indexOf("#");
    if (hashIndex === -1) return;

    const pathPart = href.substring(0, hashIndex);
    const hashPart = href.substring(hashIndex);
    if (!hashPart || hashPart === "#") return;

    // Check if link points to an anchor on the current page
    const currentPath = window.location.pathname.toLowerCase();
    const isCurrentPage =
      !pathPart ||
      pathPart === "./index.html" ||
      pathPart === "index.html" ||
      currentPath.endsWith(pathPart.toLowerCase()) ||
      ((currentPath === "/" || currentPath.endsWith("/index.html")) &&
        (pathPart === "./index.html" ||
          pathPart === "index.html" ||
          pathPart === ""));

    if (!isCurrentPage) return;

    const targetEl = document.querySelector(hashPart);
    if (targetEl) {
      e.preventDefault();
      const headerHeight = 85;
      const elementPosition = targetEl.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerHeight;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth",
      });

      // Update URL hash smoothly without jump
      if (history.pushState) {
        history.pushState(null, null, hashPart);
      } else {
        location.hash = hashPart;
      }
    }
  });

  // Handle initial hash in URL when landing on the page
  if (window.location.hash) {
    const initialHash = window.location.hash;
    setTimeout(() => {
      const targetEl = document.querySelector(initialHash);
      if (targetEl) {
        const headerHeight = 85;
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition =
          elementPosition + window.pageYOffset - headerHeight;
        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: "smooth",
        });
      }
    }, 200);
  }
}

// ==========================================
// ROLE-BASED SIDEBAR SYSTEM (Guest / User / Manager / Admin)
// ==========================================
if (typeof window !== "undefined" && typeof window.getCurrentUser !== "function") {
  window.getCurrentUser = function () {
    try {
      const raw =
        localStorage.getItem("prepmate_current_user") ||
        localStorage.getItem("prepmate_user") ||
        localStorage.getItem("user") ||
        localStorage.getItem("currentUser");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };
}

function initRoleBasedSidebar() {
  const sidebar = document.querySelector(".sidebar-new, #main-sidebar");
  if (!sidebar) return;

  // Detect user role
  let role = "guest";
  let user = null;
  try {
    if (typeof getCurrentUser === "function") {
      user = getCurrentUser();
    } else {
      const raw =
        localStorage.getItem("prepmate_current_user") ||
        localStorage.getItem("prepmate_user") ||
        localStorage.getItem("user") ||
        localStorage.getItem("currentUser");
      if (raw) user = JSON.parse(raw);
    }
  } catch (e) {
    user = null;
  }

  if (user && user.role) {
    const r = String(user.role).toLowerCase();
    if (r === "admin") role = "admin";
    else if (r === "manager") role = "manager";
    else role = "user";
  } else if (user && (user.username || user.fullname || user.email)) {
    role = "user";
  }

  const isFeatures = window.location.pathname.includes("/features/");
  const root = isFeatures ? "../../" : "./";
  const currentPath = window.location.pathname.toLowerCase();
  const currentHash = window.location.hash.toLowerCase();

  function isItemActive(targetFile, exactHash = null) {
    let file = targetFile.toLowerCase();
    let hash = exactHash ? exactHash.toLowerCase() : null;

    if (file.includes("#")) {
      const parts = file.split("#");
      file = parts[0];
      hash = "#" + parts[1];
    }

    // Match interview workflow pages
    if (file.includes("interview-info.html")) {
      if (
        currentPath.includes("interview-info.html") ||
        currentPath.includes("interview-practice.html")
      ) {
        return "active";
      }
    }

    // Match pricing & payment workflow pages
    if (file.includes("pricing.html") || file.includes("payment.html")) {
      if (
        currentPath.includes("pricing.html") ||
        currentPath.includes("payment.html")
      ) {
        return "active";
      }
    }

    // Match history page
    if (file.includes("history.html")) {
      if (
        currentPath.includes("history.html") ||
        (currentPath.includes("dashboard.html") && currentHash === "#history")
      ) {
        return "active";
      }
    }

    const matchesFile =
      currentPath.endsWith(file) ||
      currentPath.endsWith("/" + file) ||
      (file.includes("/") && currentPath.endsWith(file.split("/").pop()));
    if (!matchesFile) return "";

    if (hash !== null) {
      return currentHash === hash ? "active" : "";
    }

    // When hash is null:
    if (file.includes("profile.html")) {
      return !currentHash || currentHash === "#account" ? "active" : "";
    }

    if (file.includes("admin.html")) {
      return !currentHash || currentHash === "#overview" ? "active" : "";
    }

    return "active";
  }

  // Role-dependent badge label on logo (Pure Vietnamese)
  const roleBadgeLabel =
    role === "admin"
      ? "QUẢN TRỊ VIÊN"
      : role === "manager"
        ? "QUẢN LÝ VẬN HÀNH"
        : "PHỎNG VẤN AI";

  // Header: Logo links to Home (index.html)
  const headerHtml = `
        <div class="sidebar-header-row">
            <a href="${root}index.html" class="logo-new" title="PrepMate - Về trang chủ">
                <div class="logo-icon">P</div>
                <div class="logo-text-group">
                    <span class="logo-brand">Prep<span>Mate</span></span>
                    <span class="logo-badge">${roleBadgeLabel}</span>
                </div>
            </a>
            <button id="sidebar-toggle-btn" class="sidebar-toggle-btn" onclick="toggleSidebarCollapse()" title="Thu gọn thanh điều hướng" aria-label="Thu gọn sidebar">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="11 17 6 12 11 7"/>
                    <polyline points="18 17 13 12 18 7"/>
                </svg>
            </button>
        </div>
    `;

  // SVG Icons
  const icons = {
    target: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    mic: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
    chart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    clock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    book: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    fileText: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    grid: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
    users: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    lock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    openBook: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    barChart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    messageCircle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    briefcase: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
    card: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    settings: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    audit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
    login: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
    play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    user: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  };

  let bodyHtml = "";

  if (role === "guest") {
    // ==========================================
    // 1. GUEST SIDEBAR
    // ==========================================
    bodyHtml = `
            <div class="sidebar-nav-body">
                <!-- CHÍNH -->
                <div class="nav-section-label">CHÍNH</div>
                <nav class="nav-new">
                    <a href="${root}features/dashboard/dashboard.html" class="${isItemActive("dashboard.html")}" title="Tổng quan hành trình">
                        <span class="nav-icon">${icons.grid}</span>
                        <span class="nav-label">Tổng quan</span>
                    </a>
                    <a href="${root}features/interview/interview-info.html" class="${isItemActive("interview-info.html")}" title="Phòng phỏng vấn mô phỏng AI">
                        <span class="nav-icon">${icons.mic}</span>
                        <span class="nav-label">Phỏng vấn AI</span>
                    </a>
                    <a href="${root}features/qbank/qbank.html" class="${isItemActive("qbank.html")}" title="Luyện tập câu hỏi chuyên môn">
                        <span class="nav-icon">${icons.target}</span>
                        <span class="nav-label">Ngân hàng câu hỏi</span>
                    </a>
                </nav>

                <!-- CHUẨN BỊ -->
                <div class="nav-section-label">CHUẨN BỊ</div>
                <nav class="nav-new">
                    <a href="${root}features/jobs/jobs.html" class="${isItemActive("jobs.html")}" title="Khám phá cơ hội việc làm & phỏng vấn theo JD">
                        <span class="nav-icon">${icons.briefcase}</span>
                        <span class="nav-label">Cơ hội việc làm</span>
                    </a>
                </nav>

                <!-- HỆ THỐNG -->
                <div class="nav-section-label">HỆ THỐNG</div>
                <nav class="nav-new">
                    <a href="${root}features/payment/pricing.html" class="${isItemActive("pricing.html")}" title="Bảng giá & Gói dịch vụ PRO">
                        <span class="nav-icon">${icons.card}</span>
                        <span class="nav-label">Gói dịch vụ PRO</span>
                    </a>
                    <a href="${root}features/profile/settings.html" class="${isItemActive("settings.html")}" title="Cài đặt giao diện & ngôn ngữ">
                        <span class="nav-icon">${icons.settings}</span>
                        <span class="nav-label">Cài đặt cá nhân</span>
                    </a>
                </nav>
            </div>

            <!-- TÀI KHOẢN (CUỐI SIDEBAR) -->
            <div class="sidebar-bottom">
                <div class="nav-section-label">TÀI KHOẢN</div>
                <a href="${root}features/auth/auth.html" class="guest-login-btn" title="Đăng nhập tài khoản PrepMate">
                    <span class="guest-login-icon">${icons.login}</span>
                    <span class="guest-login-text">Đăng nhập tài khoản</span>
                </a>
            </div>
        `;
  } else if (role === "user") {
    // ==========================================
    // 2. USER (CANDIDATE) SIDEBAR
    // ==========================================
    const displayName = user.fullname || user.username || "Người dùng";
    const displayEmail = user.email || "candidate@prepmate.ai";
    const initial = (displayName.charAt(0) || "U").toUpperCase();
    const isPro = user && user.subscription === "pro" && (!user.subscriptionExpiry || new Date(user.subscriptionExpiry) > new Date());
    const badgeText = isPro ? "PrepMate PRO" : "Gói Trải Nghiệm";
    const badgeClass = isPro
      ? "header-menu-badge badge-pro"
      : "header-menu-badge badge-free";
    const avatarBg = isPro
      ? "background: linear-gradient(135deg, #f59e0b, #d97706);"
      : "background: linear-gradient(135deg, #1d4ed8, #2563eb);";

    bodyHtml = `
            <div class="sidebar-nav-body">
                <!-- TỔNG QUAN -->
                <div class="nav-section-label">TỔNG QUAN</div>
                <nav class="nav-new">
                    <a href="${root}features/dashboard/dashboard.html" class="${isItemActive("dashboard.html", "")}" title="Tổng quan">
                        <span class="nav-icon">${icons.grid}</span>
                        <span class="nav-label">Tổng quan</span>
                    </a>
                </nav>

                <!-- PHỎNG VẤN -->
                <div class="nav-section-label">PHỎNG VẤN</div>
                <nav class="nav-new">
                    <a href="${root}features/interview/interview-info.html" class="${isItemActive("interview-info.html")}" title="Phỏng vấn mới">
                        <span class="nav-icon">${icons.play}</span>
                        <span class="nav-label">Phỏng vấn mới</span>
                    </a>
                    <a href="${root}features/interview/history.html" class="${isItemActive("history.html")}" title="Lịch sử phỏng vấn">
                        <span class="nav-icon">${icons.clock}</span>
                        <span class="nav-label">Lịch sử</span>
                    </a>
                    <a href="${root}features/qbank/qbank.html" class="${isItemActive("qbank.html")}" title="Ngân hàng câu hỏi & STAR">
                        <span class="nav-icon">${icons.target}</span>
                        <span class="nav-label">Ngân hàng câu hỏi</span>
                    </a>
                </nav>

                <!-- NGHỀ NGHIỆP & HỒ SƠ -->
                <div class="nav-section-label">NGHỀ NGHIỆP & HỒ SƠ</div>
                <nav class="nav-new">
                    <a href="${root}features/jobs/jobs.html" class="${isItemActive("jobs.html")}" title="Nghề nghiệp & Cơ hội việc làm">
                        <span class="nav-icon">${icons.briefcase}</span>
                        <span class="nav-label">Cơ hội việc làm</span>
                    </a>
                    <a href="${root}features/profile/cv.html" class="${isItemActive("cv.html")}" title="Quản lý CV & Kỹ năng">
                        <span class="nav-icon">${icons.fileText}</span>
                        <span class="nav-label">Quản lý CV</span>
                    </a>
                </nav>

                <!-- TIẾN BỘ -->
                <div class="nav-section-label">TIẾN BỘ</div>
                <nav class="nav-new">
                    <a href="${root}features/progress/progress.html" class="${isItemActive("progress.html")}" title="Tiến độ học tập & Năng lực">
                        <span class="nav-icon">${icons.chart}</span>
                        <span class="nav-label">Tiến độ</span>
                    </a>
                </nav>

                <!-- TÀI KHOẢN & CÀI ĐẶT -->
                <div class="nav-section-label">TÀI KHOẢN & CÀI ĐẶT</div>
                <nav class="nav-new">
                    <a href="${root}features/profile/profile.html" class="${isItemActive("profile.html")}" title="Hồ sơ tài khoản cá nhân">
                        <span class="nav-icon">${icons.user}</span>
                        <span class="nav-label">Hồ sơ tài khoản</span>
                    </a>
                    <a href="${root}features/profile/settings.html" class="${isItemActive("settings.html")}" title="Cài đặt hệ thống & trải nghiệm">
                        <span class="nav-icon">${icons.settings}</span>
                        <span class="nav-label">Cài đặt</span>
                    </a>
                </nav>
            </div>

            <!-- TÀI KHOẢN (CUỐI SIDEBAR - Affordance qua Profile Widget) -->
            <div class="sidebar-bottom">
                <div class="nav-section-label">TÀI KHOẢN</div>
                <div class="user-profile-sidebar" onclick="toggleUserDropdown(event)" aria-label="Xem tài khoản cá nhân">
                    <div class="user-dropdown-menu" id="user-dropdown" style="display: none;" onclick="event.stopPropagation()">
                        <div class="dropdown-header">
                            <div class="header-menu-top" style="padding: 4px 2px 6px;">
                                <div class="header-menu-avatar" style="width: 36px; height: 36px; font-size: 14px; ${avatarBg}">${initial}</div>
                                <div class="header-menu-meta">
                                    <strong id="dropdown-user-name">${displayName}</strong>
                                    <span id="dropdown-user-email">${displayEmail}</span>
                                    <span class="${badgeClass}">${badgeText}</span>
                                </div>
                            </div>
                        </div>
                        <div class="dropdown-divider"></div>
                        <a href="${root}features/profile/profile.html" class="dropdown-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span>Hồ sơ tài khoản</span>
                        </a>
                        <a href="${root}features/profile/cv.html" class="dropdown-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            <span>Quản lý CV</span>
                        </a>
                        <a href="${root}features/interview/history.html" class="dropdown-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>Lịch sử phỏng vấn</span>
                        </a>
                        <a href="${root}features/profile/settings.html#security" class="dropdown-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            <span>Bảo mật & Mật khẩu</span>
                        </a>
                        <div class="dropdown-divider"></div>
                        <a href="#" class="dropdown-item text-danger" onclick="logoutUser()">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            <span>Đăng xuất</span>
                        </a>
                    </div>
                    <div class="avatar" id="sidebar-avatar" style="${avatarBg}">${initial}</div>
                    <div class="info">
                        <strong id="sidebar-user-name">${displayName}</strong>
                        <span id="sidebar-user-email">${displayEmail}</span>
                    </div>
                    <span class="icon-setting"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
                </div>
            </div>
        `;
  } else if (role === "manager") {
    // ==========================================
    // 3. MANAGER SIDEBAR
    // ==========================================
    const displayName = user.fullname || user.username || "Quản lý";
    const displayEmail = user.email || "manager@prepmate.ai";
    const initial = (displayName.charAt(0) || "M").toUpperCase();

    bodyHtml = `
            <div class="sidebar-nav-body">
                <!-- QUẢN LÝ -->
                <div class="nav-section-label">QUẢN LÝ</div>
                <nav class="nav-new">
                    <a href="${root}features/admin/admin.html" class="${isItemActive("admin.html")}" title="Tổng quan quản lý">
                        <span class="nav-icon">${icons.grid}</span>
                        <span class="nav-label">Tổng quan</span>
                    </a>
                    <a href="${root}features/admin/admin.html#users-tab" class="${isItemActive("admin.html#users-tab")}" title="Quản lý người dùng & cấp PRO">
                        <span class="nav-icon">${icons.users}</span>
                        <span class="nav-label">Người dùng</span>
                    </a>
                    <a href="${root}features/admin/admin.html#plans-tab" class="${isItemActive("admin.html#plans-tab")}" title="Xem thông tin gói dịch vụ & giá">
                        <span class="nav-icon">${icons.card}</span>
                        <span class="nav-label">Gói dịch vụ</span>
                    </a>
                    <a href="${root}features/admin/admin.html#content-tab" class="${isItemActive("admin.html#content-tab")}" title="Quản lý ngân hàng câu hỏi & nội dung">
                        <span class="nav-icon">${icons.openBook}</span>
                        <span class="nav-label">Nội dung</span>
                    </a>
                    <a href="${root}features/admin/admin.html#reports-tab" class="${isItemActive("admin.html#reports-tab")}" title="Báo cáo phân tích chất lượng">
                        <span class="nav-icon">${icons.barChart}</span>
                        <span class="nav-label">Báo cáo</span>
                    </a>
                    <a href="${root}features/admin/admin.html#audit-tab" class="${isItemActive("admin.html#audit-tab")}" title="Nhật ký hoạt động">
                        <span class="nav-icon">${icons.audit}</span>
                        <span class="nav-label">Nhật ký hoạt động</span>
                    </a>
                </nav>

                <!-- PHỎNG VẤN & TUYỂN DỤNG -->
                <div class="nav-section-label">PHỎNG VẤN & TUYỂN DỤNG</div>
                <nav class="nav-new">
                    <a href="${root}features/jobs/jobs.html" class="${isItemActive("jobs.html")}" title="Công ty & vị trí tuyển dụng">
                        <span class="nav-icon">${icons.briefcase}</span>
                        <span class="nav-label">Cơ hội việc làm</span>
                    </a>
                </nav>

                <!-- HỆ THỐNG -->
                <div class="nav-section-label">HỆ THỐNG</div>
                <nav class="nav-new">
                    <a href="${root}features/profile/settings.html" class="${isItemActive("settings.html")}" title="Cài đặt hệ thống & trải nghiệm">
                        <span class="nav-icon">${icons.settings}</span>
                        <span class="nav-label">Cài đặt cá nhân</span>
                    </a>
                </nav>
            </div>

            <!-- TÀI KHOẢN (CUỐI SIDEBAR - Affordance qua Profile Widget) -->
            <div class="sidebar-bottom">
                <div class="nav-section-label">TÀI KHOẢN</div>
                <div class="user-profile-sidebar" onclick="toggleUserDropdown(event)" aria-label="Tài khoản Quản lý">
                    <div class="user-dropdown-menu" id="user-dropdown" style="display: none;" onclick="event.stopPropagation()">
                        <div class="dropdown-header">
                            <div class="header-menu-top" style="padding: 4px 2px 6px;">
                                <div class="header-menu-avatar" style="width: 36px; height: 36px; font-size: 14px; background: linear-gradient(135deg, #4338ca, #6366f1);">${initial}</div>
                                <div class="header-menu-meta">
                                    <strong id="dropdown-user-name">${displayName}</strong>
                                    <span id="dropdown-user-email">${displayEmail}</span>
                                    <span class="header-menu-badge badge-staff">Quản lý</span>
                                </div>
                            </div>
                        </div>
                        <div class="dropdown-divider"></div>
                        <a href="${root}features/profile/profile.html" class="dropdown-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span>Hồ sơ cá nhân</span>
                        </a>
                        <div class="dropdown-divider"></div>
                        <a href="#" class="dropdown-item text-danger" onclick="logoutUser()">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            <span>Đăng xuất</span>
                        </a>
                    </div>
                    <div class="avatar" id="sidebar-avatar" style="background: linear-gradient(135deg, #4338ca, #6366f1);">${initial}</div>
                    <div class="info">
                        <strong id="sidebar-user-name">${displayName}</strong>
                        <span id="sidebar-user-email">Quản lý</span>
                    </div>
                    <span class="icon-setting"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
                </div>
            </div>
        `;
  } else if (role === "admin") {
    // ==========================================
    // 4. ADMIN SIDEBAR
    // ==========================================
    const displayName = user.fullname || user.username || "Quản trị viên";
    const displayEmail = user.email || "admin@prepmate.ai";
    const initial = (displayName.charAt(0) || "A").toUpperCase();

    bodyHtml = `
            <div class="sidebar-nav-body">
                <!-- QUẢN TRỊ -->
                <div class="nav-section-label">QUẢN TRỊ</div>
                <nav class="nav-new">
                    <a href="${root}features/admin/admin.html" class="${isItemActive("admin.html")}" title="Tổng quan quản trị hệ thống">
                        <span class="nav-icon">${icons.grid}</span>
                        <span class="nav-label">Tổng quan</span>
                    </a>
                    <a href="${root}features/admin/admin.html#users-tab" class="${isItemActive("admin.html#users-tab")}" title="Quản lý thành viên & tài khoản">
                        <span class="nav-icon">${icons.users}</span>
                        <span class="nav-label">Người dùng</span>
                    </a>
                    <a href="${root}features/admin/admin.html#roles-tab" class="${isItemActive("admin.html#roles-tab")}" title="Phân quyền Admin & Manager">
                        <span class="nav-icon">${icons.lock}</span>
                        <span class="nav-label">Vai trò & quyền</span>
                    </a>
                    <a href="${root}features/admin/admin.html#plans-tab" class="${isItemActive("admin.html#plans-tab")}" title="Quản lý gói dịch vụ & giá gói">
                        <span class="nav-icon">${icons.card}</span>
                        <span class="nav-label">Gói dịch vụ & Giá</span>
                    </a>
                    <a href="${root}features/admin/admin.html#content-tab" class="${isItemActive("admin.html#content-tab")}" title="Quản lý ngân hàng câu hỏi & nội dung">
                        <span class="nav-icon">${icons.openBook}</span>
                        <span class="nav-label">Nội dung</span>
                    </a>
                    <a href="${root}features/admin/admin.html#reports-tab" class="${isItemActive("admin.html#reports-tab")}" title="Báo cáo phân tích chất lượng & STAR">
                        <span class="nav-icon">${icons.barChart}</span>
                        <span class="nav-label">Báo cáo</span>
                    </a>
                </nav>

                <!-- HỆ THỐNG -->
                <div class="nav-section-label">HỆ THỐNG</div>
                <nav class="nav-new">
                    <a href="${root}features/admin/admin.html#transactions-tab" class="${isItemActive("admin.html#transactions-tab")}" title="Quản lý thanh toán & giao dịch">
                        <span class="nav-icon">${icons.card}</span>
                        <span class="nav-label">Giao dịch & doanh thu</span>
                    </a>
                    <a href="${root}features/admin/admin.html#settings-tab" class="${isItemActive("admin.html#settings-tab")}" title="Cấu hình vận hành toàn hệ thống (AI Engine & API Keys)">
                        <span class="nav-icon">${icons.settings}</span>
                        <span class="nav-label">Cấu hình hệ thống</span>
                    </a>
                    <a href="${root}features/admin/admin.html#audit-tab" class="${isItemActive("admin.html#audit-tab")}" title="Nhật ký hệ thống & audit bảo mật">
                        <span class="nav-icon">${icons.audit}</span>
                        <span class="nav-label">Nhật ký hệ thống</span>
                    </a>
                    <a href="${root}features/profile/settings.html" class="${isItemActive("settings.html")}" title="Tùy chọn giao diện & ngôn ngữ hiển thị">
                        <span class="nav-icon">${icons.settings}</span>
                        <span class="nav-label">Cài đặt cá nhân</span>
                    </a>
                </nav>
            </div>

            <!-- TÀI KHOẢN (CUỐI SIDEBAR - Affordance qua Profile Widget) -->
            <div class="sidebar-bottom">
                <div class="nav-section-label">TÀI KHOẢN</div>
                <div class="user-profile-sidebar" onclick="toggleUserDropdown(event)" aria-label="Tài khoản Quản trị tối cao">
                    <div class="user-dropdown-menu" id="user-dropdown" style="display: none;" onclick="event.stopPropagation()">
                        <div class="dropdown-header">
                            <div class="header-menu-top" style="padding: 4px 2px 6px;">
                                <div class="header-menu-avatar" style="width: 36px; height: 36px; font-size: 14px; background: linear-gradient(135deg, #059669, #10b981);">${initial}</div>
                                <div class="header-menu-meta">
                                    <strong id="dropdown-user-name">${displayName}</strong>
                                    <span id="dropdown-user-email">${displayEmail}</span>
                                    <span class="header-menu-badge badge-staff">Quản trị viên</span>
                                </div>
                            </div>
                        </div>
                        <div class="dropdown-divider"></div>
                        <a href="${root}features/profile/profile.html" class="dropdown-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span>Tài khoản / Hồ sơ</span>
                        </a>

                        <div class="dropdown-divider"></div>
                        <a href="#" class="dropdown-item text-danger" onclick="logoutUser()">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            <span>Đăng xuất</span>
                        </a>
                    </div>
                    <div class="avatar" id="sidebar-avatar" style="background: linear-gradient(135deg, #059669, #10b981);">${initial}</div>
                    <div class="info">
                        <strong id="sidebar-user-name">${displayName}</strong>
                        <span id="sidebar-user-email">Quản trị viên</span>
                    </div>
                    <span class="icon-setting"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
                </div>
            </div>
        `;
  }

  // Hidden elements to preserve backward compatibility for scripts
  const compatHidden = `
        <form style="display:none;" id="sidebar-hidden-compat" onsubmit="return false;">
            <input type="password" id="api-key-input" autocomplete="off">
            <input type="password" id="elevenlabs-key-input" autocomplete="off">
            <p id="api-key-status"></p>
            <p id="elevenlabs-key-status"></p>
        </form>
    `;

  sidebar.innerHTML = headerHtml + bodyHtml + compatHidden;

  // Inject mobile workspace topbar & drawer backdrop for <= 768px screens
  if (!document.getElementById("workspace-mobile-topbar")) {
    const topbar = document.createElement("header");
    topbar.id = "workspace-mobile-topbar";
    topbar.className = "workspace-mobile-topbar";
    topbar.innerHTML = `
      <button type="button" class="workspace-mobile-toggle" onclick="toggleMobileSidebar(event)" aria-label="Mở thanh điều hướng" aria-expanded="false" title="Menu điều hướng">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <a href="${root}index.html" class="workspace-mobile-brand" title="PrepMate - Về trang chủ">Prep<span>Mate</span></a>
      <div class="workspace-mobile-actions">
        <button type="button" class="header-theme-switch" role="switch" onclick="toggleGlobalTheme(event)" aria-label="Chuyển theme" title="Chuyển chế độ Sáng / Tối">
          <span class="theme-switch-track" aria-hidden="true">
            <span class="theme-switch-icon sun" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            </span>
            <span class="theme-switch-icon moon" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </span>
            <span class="theme-switch-thumb"></span>
          </span>
        </button>
      </div>
    `;
    document.body.insertBefore(topbar, document.body.firstChild);

    const backdrop = document.createElement("div");
    backdrop.id = "sidebar-mobile-backdrop";
    backdrop.className = "sidebar-mobile-backdrop";
    backdrop.onclick = closeMobileSidebar;
    document.body.appendChild(backdrop);
  }

  // Hook tab switches if on admin.html
  if (window.location.pathname.includes("admin.html")) {
    sidebar.querySelectorAll('a[href*="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href");
        const hashIndex = href.indexOf("#");
        if (hashIndex !== -1) {
          const tabId = href.substring(hashIndex + 1);
          if (typeof switchTab === "function") {
            e.preventDefault();
            switchTab(tabId);
            history.pushState(null, null, "#" + tabId);
            sidebar
              .querySelectorAll(".nav-new a")
              .forEach((a) => a.classList.remove("active"));
            link.classList.add("active");
          }
        }
      });
    });
  }

  // Reapply sidebar collapsed state if previously set
  const isCollapsed =
    localStorage.getItem("prepmate_sidebar_collapsed") === "true";
  applySidebarCollapseState(isCollapsed);
}

// Re-evaluate sidebar active states on hashchange
window.addEventListener("hashchange", () => {
  if (!window.location.pathname.includes("admin.html")) {
    const sidebar = document.querySelector(".sidebar-new, #main-sidebar");
    if (sidebar) {
      const currentHash = window.location.hash.toLowerCase();
      sidebar.querySelectorAll(".nav-new a").forEach((a) => {
        const href = (a.getAttribute("href") || "").toLowerCase();
        if (href.includes("#")) {
          const h = href.substring(href.indexOf("#"));
          if (h === currentHash) a.classList.add("active");
          else a.classList.remove("active");
        } else if (
          currentHash === "#system-settings" ||
          currentHash === "#cv"
        ) {
          // Specific sub-sections active instead of page root
          a.classList.remove("active");
        }
      });
    }
  }
});

// ==========================================
// COLLAPSIBLE SIDEBAR CONTROLLER
// ==========================================
function initSidebarCollapse() {
  initRoleBasedSidebar();
}

function toggleMobileSidebar(event) {
  if (event) event.stopPropagation();
  const sidebar = document.querySelector(".sidebar-new, #main-sidebar");
  const backdrop = document.getElementById("sidebar-mobile-backdrop");
  const btn = document.querySelector(".workspace-mobile-toggle");
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains("mobile-drawer-open");
  if (isOpen) {
    sidebar.classList.remove("mobile-drawer-open");
    if (backdrop) backdrop.style.display = "none";
    if (btn) btn.setAttribute("aria-expanded", "false");
  } else {
    sidebar.classList.add("mobile-drawer-open");
    if (backdrop) backdrop.style.display = "block";
    if (btn) btn.setAttribute("aria-expanded", "true");
  }
}
window.toggleMobileSidebar = toggleMobileSidebar;

function closeMobileSidebar() {
  const sidebar = document.querySelector(".sidebar-new, #main-sidebar");
  const backdrop = document.getElementById("sidebar-mobile-backdrop");
  const btn = document.querySelector(".workspace-mobile-toggle");
  if (sidebar) sidebar.classList.remove("mobile-drawer-open");
  if (backdrop) backdrop.style.display = "none";
  if (btn) btn.setAttribute("aria-expanded", "false");
}
window.closeMobileSidebar = closeMobileSidebar;

function toggleSidebarCollapse() {
  const sidebar = document.querySelector(".sidebar-new, #main-sidebar");
  if (!sidebar) return;
  const willCollapse = !sidebar.classList.contains("collapsed");
  applySidebarCollapseState(willCollapse);
  localStorage.setItem(
    "prepmate_sidebar_collapsed",
    willCollapse ? "true" : "false",
  );
}

function applySidebarCollapseState(isCollapsed) {
  const sidebar = document.querySelector(".sidebar-new, #main-sidebar");
  const mainContent = document.querySelector(
    ".main-content-new, .main-content",
  );
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  if (!sidebar) return;

  if (isCollapsed) {
    sidebar.classList.add("collapsed");
    if (mainContent) mainContent.classList.add("sidebar-collapsed");
    if (toggleBtn) {
      toggleBtn.title = "Mở rộng thanh điều hướng";
      toggleBtn.setAttribute("aria-expanded", "false");
    }
  } else {
    sidebar.classList.remove("collapsed");
    if (mainContent) mainContent.classList.remove("sidebar-collapsed");
    if (toggleBtn) {
      toggleBtn.title = "Thu gọn thanh điều hướng";
      toggleBtn.setAttribute("aria-expanded", "true");
    }
  }
}

// Auto-initialize sidebar state
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSidebarCollapse);
} else {
  initSidebarCollapse();
}

// ==========================================
// UNIFIED GLOBAL THEME & LANGUAGE CONTROLLER
// ==========================================
function getGlobalTheme() {
  return localStorage.getItem("prepmate_theme") || localStorage.getItem("pm_theme") || "light";
}

function applyGlobalTheme(mode) {
  const root = document.documentElement;
  const body = document.body;
  if (!body) return;

  body.classList.remove("light-mode", "dark-mode");

  let effective = mode;
  if (mode === "auto") {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    effective = prefersDark ? "dark" : "light";
  }

  if (effective === "dark") {
    body.classList.add("dark-mode");
    root.setAttribute("data-theme", "dark");
    root.classList.add("dark");
  } else {
    body.classList.add("light-mode");
    root.setAttribute("data-theme", "light");
    root.classList.remove("dark");
  }

  // Sync all header theme toggle buttons across the DOM
  document.querySelectorAll(".header-theme-toggle, #header-theme-toggle-btn").forEach(btn => {
    const isDark = effective === "dark";
    btn.setAttribute("data-theme-state", isDark ? "dark" : "light");
    btn.setAttribute("aria-label", isDark ? "Chuyển sang chế độ Sáng" : "Chuyển sang chế độ Tối");
    btn.title = isDark ? "Đang dùng chế độ Tối (Nhấp để chuyển sang Sáng)" : "Đang dùng chế độ Sáng (Nhấp để chuyển sang Tối)";
    const lightIcon = btn.querySelector(".header-theme-icon-light");
    const darkIcon = btn.querySelector(".header-theme-icon-dark");
    if (lightIcon && darkIcon) {
      lightIcon.style.display = isDark ? "none" : "inline-flex";
      darkIcon.style.display = isDark ? "inline-flex" : "none";
    }
  });
}

function toggleGlobalTheme(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const current = getGlobalTheme();
  const nextTheme = current === "dark" ? "light" : "dark";
  try {
    localStorage.setItem("prepmate_theme", nextTheme); localStorage.setItem("pm_theme", nextTheme);
  } catch (err) {}
  applyGlobalTheme(nextTheme);
}

if (typeof window !== "undefined") {
  window.getGlobalTheme = getGlobalTheme;
  window.applyGlobalTheme = applyGlobalTheme;
  window.toggleGlobalTheme = toggleGlobalTheme;
}

// Global auto apply on boot
(function initGlobalThemeAndLang() {
  const theme = getGlobalTheme();
  applyGlobalTheme(theme);

  // Watch system preference change if mode is auto
  if (window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (getGlobalTheme() === "auto") {
          applyGlobalTheme("auto");
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyGlobalTheme(getGlobalTheme());
    });
  }
})();


// ==========================================
// UNIFIED INTERVIEW SESSION SYNCHRONIZATION
// (Single Source of Truth for Dashboard & History)
// ==========================================
async function syncUserInterviewSessions() {
  const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
  let localList = [];

  if (currentUser && typeof getUserSessions === "function") {
    localList = getUserSessions() || [];
  } else {
    try {
      localList = JSON.parse(localStorage.getItem("interview_sessions")) || [];
    } catch (e) {
      localList = [];
    }
  }

  if (!Array.isArray(localList)) localList = [];

  const getSessId = (s) => String(s?.id || s?.backendSessionId || s?.sessionId || s?.Id || "").trim();

  const getTimestamp = (s) => {
    const raw = s?.createdAt || s?.date || s?.startTime || s?.CreatedAt || 0;
    const t = new Date(raw).getTime();
    return isNaN(t) ? 0 : t;
  };

  const mergedMap = new Map();

  // 1. Fetch authoritative sessions from backend if authenticated
  if (currentUser && currentUser.id) {
    try {
      const apiBase =
        typeof window !== "undefined" && typeof window.PREPMATE_API_BASE_URL === "string"
          ? window.PREPMATE_API_BASE_URL
          : typeof API_BASE_URL === "string"
          ? API_BASE_URL
          : "";

      const headers = { Accept: "application/json" };
      if (currentUser.token) {
        headers["Authorization"] = `Bearer ${currentUser.token}`;
      }

      const res = await fetch(
        `${apiBase}/api/sessions/user/${encodeURIComponent(currentUser.id)}`,
        { headers }
      );
      if (res.ok) {
        const backendSessions = await res.json();
        if (Array.isArray(backendSessions)) {
          backendSessions.forEach((bs) => {
            const sid = getSessId(bs);
            if (sid) {
              const bDate = bs.createdAt || bs.date || bs.startTime || bs.CreatedAt || new Date().toISOString();
              mergedMap.set(sid, {
                ...bs,
                id: sid,
                backendSessionId: sid,
                sessionId: sid,
                jobTitle: bs.jobTitle || bs.JobTitle || "Buổi phỏng vấn",
                company: bs.company || bs.companyName || bs.targetCompany || bs.interviewContext?.companyName || bs.InterviewContext?.CompanyName || "Doanh nghiệp",
                date: bDate,
                createdAt: bDate,
                status: (bs.status || bs.Status || "in_progress").toLowerCase(),
                report: bs.report || bs.Report || null
              });
            }
          });
        }
      }
    } catch (err) {
      console.warn("[SESSION SYNC] Backend sync error, falling back to cached sessions:", err);
    }
  }

  // 2. Merge local sessions (preserve in-progress or local-only sessions, update if backend has completed report)
  localList.forEach((ls) => {
    const sid = getSessId(ls);
    if (sid) {
      if (mergedMap.has(sid)) {
        const bs = mergedMap.get(sid);
        const lDate = bs.createdAt || ls.date || ls.createdAt || new Date().toISOString();
        mergedMap.set(sid, {
          ...ls,
          ...bs,
          status: bs.status || ls.status || "in_progress",
          report: bs.report || ls.report || ls.rawReport || null,
          jobTitle: bs.jobTitle || ls.jobTitle || "Buổi phỏng vấn",
          company: bs.company || ls.company || ls.companyName || "Doanh nghiệp",
          date: lDate,
          createdAt: lDate
        });
      } else {
        mergedMap.set(sid, ls);
      }
    } else {
      mergedMap.set(`local_${Math.random()}`, ls);
    }
  });

  // 3. Deterministic Sort: Newest first, with secondary tie-break by ID
  const sorted = Array.from(mergedMap.values()).sort((a, b) => {
    const tA = getTimestamp(a);
    const tB = getTimestamp(b);
    if (tB !== tA) return tB - tA;
    const idA = getSessId(a);
    const idB = getSessId(b);
    return idB.localeCompare(idA);
  });

  // 4. Save synced sessions back to user-scoped storage
  if (currentUser && typeof saveUserSessions === "function") {
    saveUserSessions(sorted);
  } else {
    try {
      localStorage.setItem("interview_sessions", JSON.stringify(sorted));
    } catch (e) {}
  }

  return sorted;
}

if (typeof window !== "undefined") {
  window.syncUserInterviewSessions = syncUserInterviewSessions;
}

// ==========================================
// PREPMATE GOOGLE ANALYTICS 4 AUTO-BOOTSTRAP
// ==========================================
(function autoBootstrapAnalytics() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.PrepMateAnalytics) return;

  const existing = document.querySelector('script[src*="analytics.js"]');
  if (existing) return;

  try {
    const isFeatures = window.location.pathname.includes("/features/");
    const basePath = (isFeatures ? "../../" : "./") + "shared/js/analytics.js";
    const script = document.createElement("script");
    script.src = basePath;
    script.async = true;
    document.head.appendChild(script);
  } catch (e) {
    console.debug("[PrepMate] Analytics auto-bootstrap deferred:", e);
  }
})();
