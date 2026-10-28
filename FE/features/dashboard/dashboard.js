// ==========================================
// DASHBOARD PAGE LOGIC
// ==========================================

function escapeHtml(str) {
    if (typeof window !== "undefined" && typeof window.escapeHtml === "function") {
        return window.escapeHtml(str);
    }
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function initDashboard() {
    // Contract verification: Only initialize if dashboard DOM elements exist
    const hasDashboardDOM = Boolean(
        document.getElementById('stat-sessions') ||
        document.getElementById('stat-sessions-total') ||
        document.getElementById('recent-interviews-list')
    );
    if (!hasDashboardDOM) {
        return;
    }

    // Display current user & show/hide buttons
    const currentUser = getCurrentUser();
    updateUserAuthUI();

    if (currentUser) {
        const userNameEl = document.getElementById('current-user-name');
        if (userNameEl) {
            userNameEl.innerText = `👤 ${currentUser.fullname}`;
        }
        const welcomeUserEl = document.getElementById('current-user-name-welcome');
        if (welcomeUserEl) {
            welcomeUserEl.innerText = currentUser.fullname;
        }
    }

    const apiKeyInput = document.getElementById('api-key-input');
    const storedKey = getStoredApiKey();
    if (storedKey && apiKeyInput) {
        apiKeyInput.value = storedKey;
        updateApiKeyStatus(true);
    }
    loadHistory();
}

function updateUserAuthUI() {
    const currentUser = getCurrentUser();
    const logoutBtn = document.getElementById('logout-btn');
    const loginBtn = document.getElementById('login-btn');

    if (logoutBtn && loginBtn) {
        if (currentUser) {
            logoutBtn.style.display = 'block';
            loginBtn.style.display = 'none';
        } else {
            logoutBtn.style.display = 'none';
            loginBtn.style.display = 'block';
        }
    }
}

function showExperienceWidget() {
    const widget = document.getElementById('auth-widget');
    const actions = document.getElementById('auth-widget-actions');
    const title = document.getElementById('auth-widget-title');
    const subtitle = document.getElementById('auth-widget-subtitle');
    const currentUser = getCurrentUser();

    if (!widget || !actions || !title || !subtitle) return;

    actions.innerHTML = '';

    if (currentUser) {
        title.innerText = `Xin chào, ${currentUser.fullname}`;
        subtitle.innerText = 'Bạn đã đăng nhập. Tiếp tục tới Dashboard hoặc đăng xuất.';

        const dashboardBtn = document.createElement('button');
        dashboardBtn.className = 'btn btn-primary btn-sm';
        dashboardBtn.innerText = 'Vào Dashboard';
        dashboardBtn.onclick = () => window.location.href = 'dashboard.html';

        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn btn-outline btn-sm';
        logoutBtn.innerText = 'Đăng xuất';
        logoutBtn.onclick = () => {
            logoutUser();
            closeAuthWidget();
        };

        actions.append(dashboardBtn, logoutBtn);
    } else {
        title.innerText = 'Đăng nhập / Đăng ký';
        subtitle.innerText = 'Đăng nhập để lưu tiến trình và tiếp tục trải nghiệm dashboard.';

        const loginBtn = document.createElement('button');
        loginBtn.className = 'btn btn-primary btn-sm';
        loginBtn.innerText = '🔓 Đăng nhập';
        loginBtn.onclick = () => window.location.href = '../auth/auth.html';

        const signupBtn = document.createElement('button');
        signupBtn.className = 'btn btn-outline btn-sm';
        signupBtn.innerText = '✍️ Đăng ký';
        signupBtn.onclick = () => window.location.href = '../auth/auth.html';

        actions.append(loginBtn, signupBtn);
    }

    widget.classList.remove('hidden');
}

function closeAuthWidget() {
    const widget = document.getElementById('auth-widget');
    if (widget) widget.classList.add('hidden');
}

function getUserSettings() {
    return JSON.parse(localStorage.getItem(getUserStorageKey('user_settings'))) || {};
}

function saveUserSettings(settings) {
    localStorage.setItem(getUserStorageKey('user_settings'), JSON.stringify(settings));
}

const TRANSLATIONS = {
    vi: {
        navLogout: "Đăng xuất",
        sbEnterpriseDesc: "Đăng tin tuyển dụng",
        sbEnterprise: "Dành cho Doanh nghiệp",
        footerAddress: "Tầng 21, tòa nhà Viwaseen, 48 Tố Hữu, phường Đại Mỗ, Hà Nội",
        footerCopyright: "Copyright @ PrepMate",
        footerContactUs: "Liên hệ",
        footerPrivacy: "Quy định bảo mật",
        footerTerms: "Điều khoản sử dụng",
        footerSupport: "Hỗ trợ và pháp lý",
        footerViewAll: "Xem tất cả khu vực",
        footerByRegion: "Việc làm theo khu vực",
        footerOptimizeCv: "Cẩm nang phỏng vấn",
        footerSalary: "Tra cứu lương",
        footerPracticeAi: "Luyện tập phỏng vấn với AI",
        footerPrepare: "Chuẩn bị mọi thứ trước khi tham gia phỏng vấn chính thức",
        footerFindJobs: "Tìm việc làm",
        footerCandidates: "Dành cho ứng viên",
        footerContact: "Liên hệ tư vấn",
        footerAiInterview: "Ứng dụng AI phỏng vấn",
        footerPostJob: "Đăng tin tuyển dụng",
        footerEmployers: "Dành cho nhà tuyển dụng",
        footerLangLabel: "Ngôn ngữ hiển thị",
        footerFollow: "Theo dõi PrepMate trên",
        footerDesc: "Nền tảng tìm kiếm việc làm và luyện tập phỏng vấn với AI tiên phong ở Việt Nam",
        profileNoTransactions: "Chưa có giao dịch nào.",
        profilePaymentHistory: "Lịch sử thanh toán",
        profileUpgradeBtn: "Nâng cấp sang Gói Pro",
        profileProExpiry: "Gói Pro của bạn hết hạn vào:",
        profilePlanFreeDesc: "Bạn đang sử dụng gói Free với các tính năng cơ bản.",
        profilePlanFree: "Gói Free",
        profileCurrentPlan: "Gói hiện tại:",
        profileBilling: "Gói dịch vụ & Thanh toán",
        profileLanguageDesc: "Chọn ngôn ngữ hiển thị của ứng dụng",
        profileLanguage: "Ngôn ngữ",
        profileThemeDesc: "Chọn giao diện phù hợp với sở thích của bạn",
        profileTheme: "Chế độ sáng/tối",
        profileThemeSettings: "Tùy chỉnh giao diện",
        profileSaveInfo: "Lưu thông tin",
        profileBioPlaceholder: "Mô tả ngắn về bạn...",
        profileBio: "Giới thiệu ngắn:",
        profilePhone: "Số điện thoại:",
        profileEmail: "Email:",
        profileFullNamePlaceholder: "Nhập tên của bạn",
        profileFullName: "Họ và tên:",
        profilePersonalInfo: "Thông tin cá nhân",
        profileSaveVoiceKey: "Lưu Voice Key",
        profileElevenLabsDesc: "Nhập ElevenLabs API Key để kích hoạt giọng nói cao cấp:",
        profileElevenLabsConfig: "Cấu hình ElevenLabs",
        profileSaveApiKey: "Lưu API Key",
        profileBtnShow: "Hiện",
        profileGeminiDesc: "Nhập Gemini API Key để kích hoạt AI thực tế:",
        profileGeminiConfig: "Cấu hình Gemini",
        sbInterviewHistory: "Lịch sử phỏng vấn",
        sbHistory: "Lịch sử luyện tập",
        sbFeedback: "Gửi phản hồi",
        sbBlog: "Blog nghề nghiệp",
        sbPricing: "Gói dịch vụ",
        sbJobs: "Việc làm",
        sbInterview: "Luyện tập phỏng vấn",
        sbOverview: "Tổng quan",
        sbHome: "Trang chủ",
        documentTitleIndex: 'PrepMate - Nền tảng luyện phỏng vấn giả lập AI thế hệ mới',
        documentTitleAuth: 'PrepMate - Đăng nhập & Đăng ký',
        documentTitleHelp: 'PrepMate - Trợ giúp & Hỏi đáp',
        documentTitleDashboard: 'PrepMate - Dashboard',
        documentTitleInterview: 'PrepMate - Phòng phỏng vấn AI',
        documentTitleProfile: 'PrepMate - Hồ sơ & Cài đặt',
        navHome: 'Trang chủ',
        navDashboard: 'Tổng quan',
        navInterview: 'Phỏng vấn ngay',
        navProfile: 'Cài đặt',
        navHelp: 'Trợ giúp',
        heroTitle: 'Bứt phá sự nghiệp cùng\n<span class="gradient-text">Phỏng vấn giả lập AI</span>',
        heroSubtitle: 'PrepMate giúp bạn luyện tập phỏng vấn 1-1 với trí tuệ nhân tạo, nhận nhận xét chi tiết, chấm điểm câu trả lời và định hình phong cách giao tiếp chuyên nghiệp.',
        heroPrimary: 'Bắt đầu phỏng vấn ngay',
        heroSecondary: 'Xem bảng tiến trình',
        feature1Title: 'AI Phỏng vấn thời gian thực',
        feature1Desc: 'Mô phỏng chân thực cuộc hội thoại phỏng vấn dựa trên CV và bản mô tả công việc (JD) của bạn.',
        feature2Title: 'Báo cáo chuyên sâu',
        feature2Desc: 'Chấm điểm năng lực chuyên môn, khả năng giao tiếp và gợi ý cải thiện chi tiết theo chuẩn STAR.',
        feature3Title: 'Đa dạng ngành nghề',
        feature3Desc: 'Hỗ trợ đa dạng vai trò từ Công nghệ, Kinh doanh, Marketing, Tài chính đến Nhân sự.',
        pricingBasicTitle: 'Gói Cơ Bản',
        pricingBasicCta: 'Trải nghiệm ngay',
        pricingProTitle: 'Gói Pro',
        pricingProCta: '💳 Nâng cấp Pro',
        pricingBasicFeature1: '⚡ Chạy thử nghiệm offline',
        pricingBasicFeature2: '⚡ Động cơ phỏng vấn thích ứng',
        pricingBasicFeature3: '📊 Báo cáo đánh giá cơ bản',
        pricingBasicFeature4: '🔒 Lưu trữ cục bộ 5 phiên',
        pricingProFeature1: '🔥 Kết nối Gemini API Key của bạn',
        pricingProFeature2: '🤖 Trò chuyện AI động thực tế 100%',
        pricingProFeature3: '📊 Đánh giá chuyên sâu từng câu trả lời',
        pricingProFeature4: '💼 Đánh giá chuẩn năng lực CV/JD',
        pricingProFeature5: '🌟 Không giới hạn số lượt phỏng vấn',
        dashboardTitle: 'Bảng điều khiển 📊',
        dashboardSubtitle: 'Theo dõi quá trình luyện tập và điểm số phỏng vấn của bạn.',
        statSessions: 'Số buổi đã luyện',
        statAvgScore: 'Điểm trung bình',
        statTime: 'Thời gian luyện',
        historyHeading: '📜 Lịch sử phỏng vấn',
        emptyHistory: '📭 Chưa có buổi phỏng vấn. Hãy bắt đầu ngay!',
        authLoginTab: '🔓 Đăng nhập',
        authSignupTab: '✍️ Đăng ký',
        authLoginTitle: 'Đăng nhập',
        authLoginSubtitle: 'Tiếp tục hành trình luyện phỏng vấn của bạn',
        authSignupTitle: 'Đăng ký tài khoản',
        authSignupSubtitle: 'Bắt đầu luyện tập phỏng vấn với AI',
        authLoginEmail: '📧 Email hoặc tên đăng nhập:',
        authLoginPassword: '🔒 Mật khẩu:',
        authLoginRemember: 'Ghi nhớ đăng nhập',
        authLoginButton: '🚀 Đăng nhập',
        authSignupFullname: '👤 Họ và tên:',
        authSignupEmail: '📧 Email:',
        authSignupUsername: '🆔 Tên đăng nhập:',
        authSignupPassword: '🔒 Mật khẩu:',
        authSignupConfirm: '🔑 Xác nhận mật khẩu:',
        authSignupAgree: 'Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật',
        authSignupButton: '✍️ Đăng ký',
        authBackLink: '← Quay lại trang chủ',
        helpTitle: 'Trợ giúp & Hỏi đáp ❓',
        helpSubtitle: 'Tìm câu trả lời cho những câu hỏi thường gặp về PrepMate',
        helpAll: 'Tất cả',
        helpGeneral: 'Chung',
        helpInterview: 'Phỏng vấn',
        helpApi: 'API & Cài đặt',
        helpTechnical: 'Kỹ thuật',
        contactTitle: '📧 Vẫn cần giúp đỡ?',
        contactSubtitle: 'Không tìm thấy câu trả lời của bạn? Liên hệ với chúng tôi!',
        contactEmail: '📧 Email hỗ trợ',
        contactChat: '💬 Chat trực tiếp',
        contactResources: '📱 Tài nguyên'
    },
    en: {
        navLogout: "Log out",
        sbEnterpriseDesc: "Post Jobs",
        sbEnterprise: "For Enterprises",
        footerAddress: "21st Floor, Viwaseen Tower, 48 To Huu, Dai Mo Ward, Hanoi",
        footerCopyright: "Copyright @ PrepMate",
        footerContactUs: "Contact",
        footerPrivacy: "Privacy Policy",
        footerTerms: "Terms of Service",
        footerSupport: "Support & Legal",
        footerViewAll: "View all regions",
        footerByRegion: "Jobs by Region",
        footerOptimizeCv: "Optimize CV (Coming Soon)",
        footerSalary: "Salary Lookup",
        footerPracticeAi: "Practice Interview with AI",
        footerPrepare: "Prepare everything before the official interview",
        footerFindJobs: "Find Jobs",
        footerCandidates: "For Candidates",
        footerContact: "Contact Us",
        footerAiInterview: "AI Interview Solution",
        footerPostJob: "Post a Job",
        footerEmployers: "For Employers",
        footerLangLabel: "Display language",
        footerFollow: "Follow PrepMate on",
        footerDesc: "Vietnam's pioneering AI-powered job search and interview practice platform",
        profileBioPlaceholder: "Short description about yourself...",
        profileFullNamePlaceholder: "Enter your name",
        profileNoTransactions: "No transactions yet.",
        profilePaymentHistory: "Payment History",
        profileUpgradeBtn: "Upgrade to Pro Plan",
        profileProExpiry: "Your Pro plan expires on:",
        profilePlanFreeDesc: "You are using the Free plan with basic features.",
        profilePlanFree: "Free Plan",
        profileCurrentPlan: "Current Plan:",
        profileBilling: "Billing & Subscription",
        profileLanguageDesc: "Choose the display language of the application",
        profileLanguage: "Language",
        profileThemeDesc: "Choose a theme that suits your preferences",
        profileTheme: "Light/Dark Mode",
        profileThemeSettings: "Interface Settings",
        profileSaveInfo: "Save Information",
        profileBio: "Bio:",
        profilePhone: "Phone number:",
        profileEmail: "Email:",
        profileFullName: "Full Name:",
        profilePersonalInfo: "Personal Information",
        profileSaveVoiceKey: "Save Voice Key",
        profileElevenLabsDesc: "Enter ElevenLabs API Key for premium voices:",
        profileElevenLabsConfig: "ElevenLabs Configuration",
        profileSaveApiKey: "Save API Key",
        profileBtnShow: "Show",
        profileGeminiDesc: "Enter Gemini API Key to activate real AI:",
        profileGeminiConfig: "Gemini Configuration",
        sbInterviewHistory: "Interview History",
        sbHistory: "Practice History",
        sbFeedback: "Send Feedback",
        sbBlog: "Career Blog",
        sbPricing: "Pricing",
        sbJobs: "Jobs",
        sbInterview: "Interview Practice",
        sbOverview: "Overview",
        sbHome: "Home",
        documentTitleIndex: 'PrepMate - Next-gen AI interview training platform',
        documentTitleAuth: 'PrepMate - Login & Sign Up',
        documentTitleHelp: 'PrepMate - Help & FAQ',
        documentTitleDashboard: 'PrepMate - Dashboard',
        documentTitleInterview: 'PrepMate - AI Interview Room',
        documentTitleProfile: 'PrepMate - Profile & Settings',
        navHome: 'Home',
        navDashboard: 'Dashboard',
        navInterview: 'Interview',
        navProfile: 'Settings',
        navHelp: 'Help',
        heroTitle: 'Accelerate your career with<br><span class="gradient-text">AI-powered mock interviews</span>',
        heroSubtitle: 'PrepMate helps you practice 1-on-1 interviews with AI, get detailed feedback, score answers, and refine professional communication.',
        heroPrimary: 'Start interviewing now',
        heroSecondary: 'View progress dashboard',
        feature1Title: 'Live AI Interviewing',
        feature1Desc: 'Realistic interview conversations driven by your CV and job description.',
        feature2Title: 'Deep feedback reports',
        feature2Desc: 'Score professional expertise, communication, and receive detailed STAR-based improvement tips.',
        feature3Title: 'Multi-role support',
        feature3Desc: 'Support diverse roles from Tech, Business, Marketing, Finance to Human Resources.',
        pricingBasicTitle: 'Basic Plan',
        pricingBasicCta: 'Try it now',
        pricingProTitle: 'Pro Plan',
        pricingProCta: '💳 Upgrade to Pro',
        pricingBasicFeature1: '⚡ Offline practice mode',
        pricingBasicFeature2: '⚡ Adaptive interview engine',
        pricingBasicFeature3: '📊 Basic performance reports',
        pricingBasicFeature4: '🔒 Local storage for 5 sessions',
        pricingProFeature1: '🔥 Connect your Gemini API Key',
        pricingProFeature2: '🤖 Live AI interview experience',
        pricingProFeature3: '📊 Detailed performance feedback',
        pricingProFeature4: '💼 CV/JD-aligned questioning',
        pricingProFeature5: '🌟 Unlimited interview sessions',
        dashboardTitle: 'Dashboard 📊',
        dashboardSubtitle: 'Track your practice progress and interview scores.',
        statSessions: 'Practice sessions',
        statAvgScore: 'Average score',
        statTime: 'Practice time',
        historyHeading: '📜 Interview history',
        emptyHistory: 'Bạn chưa có buổi phỏng vấn nào. Hãy bắt đầu luyện tập ngay!',
        authLoginTab: '🔓 Login',
        authSignupTab: '✍️ Sign Up',
        authLoginTitle: 'Login',
        authLoginSubtitle: 'Continue your interview preparation journey',
        authSignupTitle: 'Create an account',
        authSignupSubtitle: 'Start practicing interviews with AI',
        authLoginEmail: '📧 Email or username:',
        authLoginPassword: '🔒 Password:',
        authLoginRemember: 'Remember me',
        authLoginButton: '🚀 Login',
        authSignupFullname: '👤 Full name:',
        authSignupEmail: '📧 Email:',
        authSignupUsername: '🆔 Username:',
        authSignupPassword: '🔒 Password:',
        authSignupConfirm: '🔑 Confirm password:',
        authSignupAgree: 'I agree to the Terms of Service and Privacy Policy',
        authSignupButton: '✍️ Sign Up',
        authBackLink: '← Back to homepage',
        helpTitle: 'Help & FAQ ❓',
        helpSubtitle: 'Find answers to common questions about PrepMate',
        helpAll: 'All',
        helpGeneral: 'General',
        helpInterview: 'Interview',
        helpApi: 'API & Settings',
        helpTechnical: 'Technical',
        contactTitle: '📧 Need more help?',
        contactSubtitle: 'Can’t find your answer? Reach out to us!',
        contactEmail: '📧 Support email',
        contactChat: '💬 Live chat',
        contactResources: '📱 Resources'
    }
};

function applyTheme(mode) {
    if (typeof applyGlobalTheme === 'function') {
        applyGlobalTheme(mode);
    } else {
        const body = document.body;
        body.classList.remove('light-mode');
        body.classList.remove('dark-mode');

        if (mode === 'light') {
            body.classList.add('light-mode');
        } else if (mode === 'dark') {
            body.classList.add('dark-mode');
        } else if (mode === 'auto') {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (!prefersDark) {
                body.classList.add('light-mode');
            } else {
                body.classList.add('dark-mode');
            }
        }
    }
    localStorage.setItem('prepmate_theme', mode);
}

function translateElement(el, value) {
    if (!el || value === undefined) return;
    if (el.dataset.i18nHtml !== undefined) {
        el.innerHTML = value;
    } else if (el.dataset.i18nPlaceholder !== undefined) {
        el.placeholder = value;
    } else {
        el.innerText = value;
    }
}

function applyLanguage(lang) {
    const language = lang === 'en' ? 'en' : 'vi';
    document.documentElement.lang = language;
    const values = TRANSLATIONS[language] || TRANSLATIONS.vi;

    document.title = values.documentTitleIndex;
    const path = window.location.pathname.toLowerCase();
    if (path.endsWith('dashboard.html')) {
        document.title = values.documentTitleDashboard;
    } else if (path.endsWith('profile.html')) {
        document.title = values.documentTitleProfile;
    } else if (path.endsWith('interview.html')) {
        document.title = values.documentTitleInterview;
    } else if (path.includes('/auth.html')) {
        document.title = values.documentTitleAuth;
    } else if (path.endsWith('help.html')) {
        document.title = values.documentTitleHelp;
    }

    document.querySelectorAll('[data-i18n-key]').forEach(el => {
        const key = el.dataset.i18nKey;
        translateElement(el, values[key]);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (values[key] !== undefined) {
            el.placeholder = values[key];
        }
    });
}


function syncPreferencesUI() {
    const settings = getUserSettings();
    const themeSelect = document.getElementById('theme-mode');
    const langSelect = document.getElementById('language');

    if (themeSelect && settings.themeMode) {
        themeSelect.value = settings.themeMode;
    }
    if (langSelect && settings.language) {
        langSelect.value = settings.language;
    }
}

function applyUserSettings() {
    syncPreferencesUI();
    const settings = getUserSettings();
    if (settings.themeMode) {
        applyTheme(settings.themeMode);
    }
    if (settings.language) {
        applyLanguage(settings.language);
    }
}

let isLoadingHistory = false;

const sortDashboardSessions = (list) => [...(list || [])].filter(Boolean).sort((a, b) => {
    const tA = new Date(a?.createdAt || a?.date || a?.startTime || 0).getTime() || 0;
    const tB = new Date(b?.createdAt || b?.date || b?.startTime || 0).getTime() || 0;
    if (tB !== tA) return tB - tA;
    const idA = String(a?.id || a?.backendSessionId || a?.sessionId || '');
    const idB = String(b?.id || b?.backendSessionId || b?.sessionId || '');
    return idB.localeCompare(idA);
});

async function loadHistory() {
    if (isLoadingHistory) return;
    isLoadingHistory = true;

    const historyList = document.getElementById('history-list');
    try {
        const currentUser = getCurrentUser();
        let localSessions = currentUser ? getUserSessions() : JSON.parse(localStorage.getItem('interview_sessions')) || [];
        if (!Array.isArray(localSessions)) localSessions = [];
        localSessions = sortDashboardSessions(localSessions);

        if (localSessions.length === 0) {
            if (historyList) {
                historyList.innerHTML = `
                    <div class="empty-state-new">
                        <div class="empty-icon">📋</div>
                        <h4 class="empty-title">Bạn chưa có buổi phỏng vấn nào</h4>
                        <p class="empty-desc">Bắt đầu buổi phỏng vấn đầu tiên để hệ thống phân tích năng lực và lập báo cáo chi tiết.</p>
                        <a href="../../features/interview/interview-info.html" class="btn-empty-cta">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            <span>Tạo phiên phỏng vấn mới</span>
                        </a>
                    </div>
                `;
            }
            updateDashboardStats([]);
            renderDashboardRecommendations([]);
        } else {
            renderHistoryList(localSessions);
            updateDashboardStats(localSessions);
            renderDashboardRecommendations(localSessions);
        }

        // Background synchronization with backend single source of truth
        if (typeof syncUserInterviewSessions === 'function') {
            try {
                const synced = await syncUserInterviewSessions();
                if (Array.isArray(synced)) {
                    const sortedSynced = sortDashboardSessions(synced);
                    if (sortedSynced.length === 0) {
                        if (historyList) {
                            historyList.innerHTML = `
                                <div class="empty-state-new">
                                    <div class="empty-icon">📋</div>
                                    <h4 class="empty-title">Bạn chưa có buổi phỏng vấn nào</h4>
                                    <p class="empty-desc">Bắt đầu buổi phỏng vấn đầu tiên để hệ thống phân tích năng lực và lập báo cáo chi tiết.</p>
                                    <a href="../../features/interview/interview-info.html" class="btn-empty-cta">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        <span>Tạo phiên phỏng vấn mới</span>
                                    </a>
                                </div>
                            `;
                        }
                        updateDashboardStats([]);
                        renderDashboardRecommendations([]);
                    } else {
                        renderHistoryList(sortedSynced);
                        updateDashboardStats(sortedSynced);
                        renderDashboardRecommendations(sortedSynced);
                    }
                }
            } catch (syncErr) {
                console.warn('[DASHBOARD] syncUserInterviewSessions warning:', syncErr);
            }
        }
    } catch (err) {
        console.error('Lỗi tải lịch sử:', err);
        if (historyList) {
            historyList.innerHTML = `
                <div class="empty-state-new" style="padding:32px 20px;text-align:center;">
                    <div class="empty-icon" style="width:48px;height:48px;font-size:22px;margin:0 auto 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:50%;display:flex;align-items:center;justify-content:center;">⚠️</div>
                    <h4 style="font-size:15px;font-weight:700;color:#dc2626;margin:0 0 6px;">Không thể tải lịch sử phỏng vấn</h4>
                    <p style="font-size:13px;color:#64748b;margin:0 0 16px;">Đã xảy ra lỗi khi đọc dữ liệu lưu trữ. Vui lòng thử lại.</p>
                    <button type="button" onclick="loadHistory()" class="btn btn-sm btn-outline" style="display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:8px;font-weight:600;cursor:pointer;">
                        🔄 Thử lại
                    </button>
                </div>
            `;
        }
    } finally {
        isLoadingHistory = false;
    }
}

function renderDashboardRecommendations(sessions) {
    const countBadge = document.getElementById('history-total-count');
    if (countBadge) {
        countBadge.innerText = sessions.length > 0 ? `${sessions.length} phiên đã lưu` : 'Cập nhật thời gian thực';
    }

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

    const latestSession = sessions[0];
    if (latestSession.jobRecommendations && latestSession.jobRecommendations.length) {
        suggestionsList.innerHTML = latestSession.jobRecommendations
            .map(item => `<div style="margin-bottom:12px;"><strong>${item.role}</strong><p style="margin:6px 0 0 0;color:#cbd5e1;">${item.reason}</p></div>`)
            .join("");
    } else {
        suggestionsList.innerHTML =
            '<p style="margin:0;">Chưa có đề xuất công việc cụ thể. Hãy hoàn thành một phiên phỏng vấn với Gemini API Key để nhận kết quả phù hợp hơn.</p>';
    }

    if (latestSession.careerRoadmap && latestSession.careerRoadmap.length) {
        roadmapList.innerHTML = latestSession.careerRoadmap
            .map(item => `<div style="margin-bottom:12px;"><strong>Bước ${item.step}</strong><p style="margin:6px 0 0 0;color:#cbd5e1;">${item.advice}</p></div>`)
            .join("");
    } else {
        roadmapList.innerHTML =
            '<p style="margin:0;">Lộ trình chưa có. Hãy hoàn thành phiên phỏng vấn để AI xây dựng lộ trình cụ thể cho bạn.</p>';
    }
}

function renderHistoryList(sessions) {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    historyList.innerHTML = '';

    const sortedSessions = sortDashboardSessions(sessions);
    const displaySessions = sortedSessions.slice(0, 5);
    displaySessions.forEach((session, idx) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item glass-card';

        const isCompleted = session.status === 'completed' || !!session.report || !!session.overallEvaluation || (typeof session.score === 'number' && session.score > 0);
        const isInProgress = session.status === 'in_progress' || session.status === 'active';

        let displayScore = '—';
        let scoreColor = '#64748b';
        let scoreBg = '#f1f5f9';
        let scoreBorder = '#e2e8f0';

        if (isCompleted) {
            let numericScore = 0;
            if (typeof session.score === 'number') numericScore = session.score;
            else if (typeof session.overallScore === 'number') numericScore = session.overallScore;
            else if (session.report?.overallEvaluation?.normalizedScore) numericScore = session.report.overallEvaluation.normalizedScore;
            else if (session.report?.overallEvaluation?.score) numericScore = session.report.overallEvaluation.score <= 10 ? session.report.overallEvaluation.score * 10 : session.report.overallEvaluation.score;

            const normalized = Math.round(numericScore <= 10 && numericScore > 0 ? numericScore * 10 : numericScore);
            displayScore = String(normalized);
            scoreColor = normalized >= 80 ? '#059669' : normalized >= 60 ? '#d97706' : '#dc2626';
            scoreBg = normalized >= 80 ? '#ecfdf5' : normalized >= 60 ? '#fffbeb' : '#fef2f2';
            scoreBorder = normalized >= 80 ? '#a7f3d0' : normalized >= 60 ? '#fde68a' : '#fecaca';
        }

        const jobTitle = session.jobTitle || 'Buổi phỏng vấn';
        const jobIcon = (jobTitle.includes('Frontend') || jobTitle.includes('Backend') || jobTitle.includes('DevOps') || jobTitle.includes('Engineer')) ? '💻' :
            jobTitle.includes('Designer') || jobTitle.includes('Design') ? '🎨' :
            jobTitle.includes('Marketing') ? '📈' :
            jobTitle.includes('Tài chính') || jobTitle.includes('Kế toán') ? '📊' :
            jobTitle.includes('Nhân sự') ? '👥' : '💼';

        const sessionDate = session.date ? new Date(session.date).toLocaleDateString('vi-VN') : (session.createdAt ? new Date(session.createdAt).toLocaleDateString('vi-VN') : 'Gần đây');
        const compName = session.company || session.companyName || session.targetCompany || 'Doanh nghiệp';
        const lang = session.language === 'en' || session.language === 'English' ? 'English' : 'Tiếng Việt';
        const flag = lang === 'English' ? '🇬🇧' : '🇻🇳';
        const level = session.level || session.targetLevel || 'Middle';
        const diffClass = level === 'Senior' || level === 'Lead' ? 'hard' : level === 'Junior' || level === 'Fresher' ? 'basic' : 'medium';
        const diffDots = level === 'Senior' || level === 'Lead' ? '●●●' : level === 'Junior' || level === 'Fresher' ? '●○○' : '●●○';

        let statusBadgeHtml = '';
        let actionButtonsHtml = '';
        const sessId = session.backendSessionId || session.id || session.sessionId;

        if (isCompleted) {
            statusBadgeHtml = `<span class="pm-status-pill done"><span class="pm-status-dot"></span> Hoàn thành</span>`;
            const reportUrl = sessId ? `../report/report.html?sessionId=${encodeURIComponent(sessId)}` : `../report/report.html?index=${idx}`;
            actionButtonsHtml = `
                <a href="${reportUrl}" class="btn-action-report" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;font-weight:700;border-radius:9px;padding:7px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px;text-decoration:none;">
                    <span>📊</span> Xem báo cáo
                </a>
            `;
        } else if (isInProgress) {
            statusBadgeHtml = `<span class="pm-status-pill in-progress" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;"><span class="pm-status-dot" style="background:#2563eb;"></span> Đang phỏng vấn</span>`;
            const resumeUrl = sessId ? `../interview/interview-practice.html?resume=${encodeURIComponent(sessId)}` : `../interview/interview-practice.html`;
            actionButtonsHtml = `
                <a href="${resumeUrl}" style="background:#1d4ed8;color:#ffffff;border:none;font-weight:700;border-radius:9px;padding:7px 14px;text-decoration:none;display:inline-flex;align-items:center;gap:5px;font-size:13px;">
                    <span>▶️</span> Tiếp tục phỏng vấn
                </a>
            `;
        } else {
            statusBadgeHtml = `<span class="pm-status-pill incomplete" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;"><span class="pm-status-dot" style="background:#dc2626;"></span> Chưa hoàn thành</span>`;
            actionButtonsHtml = `
                <a href="../interview/interview-info.html" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;font-weight:700;border-radius:9px;padding:7px 12px;text-decoration:none;display:inline-flex;align-items:center;gap:5px;font-size:13px;">
                    <span>🔄</span> Luyện tập lại
                </a>
            `;
        }

        historyItem.innerHTML = `
            <div class="history-item-score" style="background: ${scoreBg}; border: 2px solid ${scoreBorder}; color: ${scoreColor}; font-weight: 800;">
                ${displayScore}
            </div>
            <div class="history-item-info">
                <div class="history-item-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                    <span style="font-weight:700;font-size:14.5px;color:#0f172a;">${jobIcon} ${escapeHtml(jobTitle)}</span>
                    <span class="pm-company-pill"><span class="comp-icon">🏢</span> ${escapeHtml(compName)}</span>
                </div>
                <div class="pm-meta-row" style="margin-top:4px;">
                    <span class="pm-flag-badge"><span class="flag-icon">${flag}</span> ${lang}</span>
                    <span class="pm-time-badge"><span class="time-glyph">◷</span> ${session.duration || 15} phút</span>
                    <span class="pm-tag-pill blue">💬 ${session.questionsAnswered || 5} câu hỏi</span>
                    <span class="pm-diff-badge ${diffClass}"><span class="pm-diff-dots">${diffDots}</span> ${level}</span>
                    ${statusBadgeHtml}
                    <span style="font-size:11.5px;color:#64748b;margin-left:auto;">📅 ${sessionDate}</span>
                </div>
            </div>
            <div class="history-item-actions" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                ${actionButtonsHtml}
            </div>
        `;

        historyList.appendChild(historyItem);
    });

    if (sessions.length > 5) {
        const viewAllRow = document.createElement('div');
        viewAllRow.style.cssText = 'text-align:center;padding:12px 0 6px;';
        viewAllRow.innerHTML = `
            <a href="../interview/history.html" class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:7px 16px;border-radius:8px;font-weight:700;">
                <span>🕒</span> Xem toàn bộ lịch sử (${sessions.length} buổi) →
            </a>
        `;
        historyList.appendChild(viewAllRow);
    }
}

function updateDashboardStats(sessions) {
    const completedSessions = sessions.filter(s => s.status === 'completed' || s.overallScore || s.score || s.report);
    const scores = completedSessions.map(s => {
        if (typeof s.overallScore === 'number' && s.overallScore > 0) return s.overallScore <= 10 ? s.overallScore * 10 : s.overallScore;
        if (typeof s.score === 'number' && s.score > 0) return s.score <= 10 ? s.score * 10 : s.score;
        if (s.report?.overallEvaluation?.normalizedScore) return s.report.overallEvaluation.normalizedScore;
        if (s.report?.overallEvaluation?.score) return s.report.overallEvaluation.score <= 10 ? s.report.overallEvaluation.score * 10 : s.report.overallEvaluation.score;
        return 0;
    }).filter(x => x > 0);

    const avgScore = scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
        : null;
    const totalTime = completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    const statSessionsEl = document.getElementById('stat-sessions');
    if (statSessionsEl) statSessionsEl.innerText = completedSessions.length;

    const statAvgScoreEl = document.getElementById('stat-avg-score');
    if (statAvgScoreEl) {
        statAvgScoreEl.innerText = avgScore !== null ? avgScore : '—';
    }

    const statAvgScoreLbl = document.getElementById('stat-avg-score-lbl');
    if (statAvgScoreLbl) {
        statAvgScoreLbl.innerText = scores.length > 0 ? `Điểm TB (${scores.length} phiên)` : 'Điểm đánh giá TB';
    }

    const timeEl = document.getElementById('stat-time');
    if (timeEl) timeEl.innerText = `${totalTime} phút`;

    const totalEl = document.getElementById('stat-sessions-total');
    if (totalEl) totalEl.innerText = sessions.length;

    // Cập nhật thẻ mục tiêu tuần & streak chân thực
    const streakBadge = document.getElementById('dash-streak-badge');
    const weekText = document.getElementById('dash-week-text');
    const weekBar = document.getElementById('dash-week-bar');
    const weekDesc = document.getElementById('dash-week-desc');

    if (sessions.length === 0) {
        if (streakBadge) {
            streakBadge.textContent = 'Chưa có chuỗi';
            streakBadge.style.color = '#64748b';
            streakBadge.style.background = '#f1f5f9';
            streakBadge.style.borderColor = '#e2e8f0';
        }
        if (weekText) weekText.textContent = '0 / 3 buổi (0%)';
        if (weekBar) weekBar.style.width = '0%';
        if (weekDesc) weekDesc.textContent = 'Thực hiện buổi phỏng vấn đầu tiên để bắt đầu ghi nhận tiến độ tuần và chuỗi streak thực tế.';
    } else {
        const now = Date.now();
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const weekSessions = completedSessions.filter(s => new Date(s.date || s.startTime || 0).getTime() >= oneWeekAgo);
        const weekTarget = 3;
        const weekCount = weekSessions.length;
        const weekPct = Math.min(100, Math.round((weekCount / weekTarget) * 100));

        let streak = 0;
        if (typeof calcStreak === 'function') {
            streak = calcStreak(sessions);
        } else {
            streak = sessions.length > 0 ? 1 : 0;
        }

        if (streakBadge) {
            streakBadge.textContent = streak > 0 ? `Chuỗi ${streak} ngày 🔥` : 'Chưa có chuỗi';
            streakBadge.style.color = streak > 0 ? '#059669' : '#64748b';
            streakBadge.style.background = streak > 0 ? '#ecfdf5' : '#f1f5f9';
            streakBadge.style.borderColor = streak > 0 ? '#a7f3d0' : '#e2e8f0';
        }
        if (weekText) weekText.textContent = `${weekCount} / ${weekTarget} buổi (${weekPct}%)`;
        if (weekBar) weekBar.style.width = `${weekPct}%`;
        if (weekDesc) weekDesc.textContent = 'Duy trì ít nhất 3 buổi phỏng vấn mô phỏng mỗi tuần để tăng 40% tốc độ phản xạ và cấu trúc câu trả lời STAR.';
    }

    // Cập nhật icon điểm
    const scoreIcon = document.getElementById('score-icon');
    if (scoreIcon) {
        if (avgScore >= 80) scoreIcon.innerText = '🔥';
        else if (avgScore >= 60) scoreIcon.innerText = '📈';
        else scoreIcon.innerText = '📊';
    }
}

function viewReport(sessionIndex) {
    openFullDebriefReport(sessionIndex);
}
window.viewReport = viewReport;

function openFullDebriefReport(sessionRef) {
    const currentUser = getCurrentUser();
    const sessions = currentUser ? getUserSessions() : (JSON.parse(localStorage.getItem('interview_sessions')) || []);
    const sortedSessions = sortDashboardSessions(sessions);

    let session = null;
    if (typeof sessionRef === 'string') {
        session = sortedSessions.find(s => (s.backendSessionId || s.id || s.sessionId) === sessionRef);
    }
    if (!session && typeof sessionRef === 'number') {
        session = sortedSessions[sessionRef];
    }
    if (!session && sortedSessions.length > 0) {
        session = sortedSessions[0];
    }
    if (!session) return;

    const sessId = session.backendSessionId || session.id || session.sessionId;
    if (sessId) {
        window.location.href = `../report/report.html?sessionId=${encodeURIComponent(sessId)}`;
    } else {
        const originalIndex = sortedSessions.indexOf(session);
        window.location.href = `../report/report.html?index=${originalIndex >= 0 ? originalIndex : 0}`;
    }
}
window.openFullDebriefReport = openFullDebriefReport;

function closeModal(id) {
    if (id) {
        const target = document.getElementById(id);
        if (target) {
            target.classList.add('hidden');
            target.style.display = 'none';
        }
        return;
    }
    const modal = document.getElementById('report-modal') || document.getElementById('session-detail-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}
window.closeModal = closeModal;

function downloadReport() {
    if (typeof showToast === 'function') {
        showToast('Tính năng tải xuống báo cáo PDF sẽ sớm được cập nhật.', 'info');
    } else {
        alert('Tính năng tải xuống báo cáo PDF sẽ sớm được cập nhật.');
    }
}

