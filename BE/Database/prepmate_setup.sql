-- ====================================================================
-- PREPMATE ENTERPRISE DATABASE SETUP SCRIPT (COMPLETE PRODUCTION READY)
-- Compatible with SQL Server (T-SQL) / Transact-SQL Standards
-- Supports normalized entities, indexes, stored procedures, views, triggers, and large seed datasets.
-- ====================================================================

-- ─── 1. DATABASE SCHEMA CREATION ────────────────────────────────────
USE prepmate_setup
GO
-- Table: SystemSettings (Global configurations)
CREATE TABLE SystemSettings (
    SettingKey VARCHAR(100) PRIMARY KEY,
    SettingValue NVARCHAR(500) NOT NULL,
    Description NVARCHAR(500) NULL,
    UpdatedAt DATETIME DEFAULT GETDATE()
);

-- Table: Users (Accounts with Roles and Packages)
CREATE TABLE Users (
    Id VARCHAR(50) PRIMARY KEY,
    Fullname NVARCHAR(100) NOT NULL,
    Email VARCHAR(100) NOT NULL UNIQUE,
    Username VARCHAR(50) NOT NULL UNIQUE,
    Password VARCHAR(100) NOT NULL, -- Plaintext for demo / hashed in production
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    Subscription VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free', 'pro'
    SubscriptionDate VARCHAR(50) NULL,
    SubscriptionExpiry VARCHAR(50) NULL,
    Role VARCHAR(20) NOT NULL DEFAULT 'user' -- 'admin', 'manager', 'user'
);

-- Table: JobTemplates (Pre-configured Job Descriptions & Skills)
CREATE TABLE JobTemplates (
    Id VARCHAR(50) PRIMARY KEY,
    Title NVARCHAR(100) NOT NULL,
    Category NVARCHAR(50) NOT NULL,
    JdText NVARCHAR(MAX) NOT NULL,
    RequiredSkills NVARCHAR(MAX) NOT NULL -- Semi-colon separated
);

-- Table: UserCVs (Parsed CVs & AI analytical notes)
CREATE TABLE UserCVs (
    Id VARCHAR(50) PRIMARY KEY,
    UserId VARCHAR(50) NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    Summary NVARCHAR(MAX) NOT NULL,
    KeySkills NVARCHAR(MAX) NOT NULL,
    ExperienceSummary NVARCHAR(MAX) NOT NULL,
    UploadedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

-- Table: Sessions (Attempts at Mock Interviews)
CREATE TABLE Sessions (
    Id VARCHAR(50) PRIMARY KEY,
    UserId VARCHAR(50) NOT NULL,
    JobTitle NVARCHAR(100) NOT NULL,
    JdText NVARCHAR(MAX) NULL,
    CreatedAt VARCHAR(50) NOT NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed'
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

-- Table: Questions (AI-generated questions for sessions)
CREATE TABLE Questions (
    Id VARCHAR(50) PRIMARY KEY,
    SessionId VARCHAR(50) NOT NULL,
    QuestionText NVARCHAR(MAX) NOT NULL,
    OrderNumber INT NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (SessionId) REFERENCES Sessions(Id) ON DELETE CASCADE
);

-- Table: Answers (User responses & AI feedback)
CREATE TABLE Answers (
    Id VARCHAR(50) PRIMARY KEY,
    SessionId VARCHAR(50) NOT NULL,
    QuestionId VARCHAR(50) NOT NULL,
    AnswerText NVARCHAR(MAX) NOT NULL,
    FeedbackText NVARCHAR(MAX) NULL, -- AI inline feedback
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (SessionId) REFERENCES Sessions(Id) ON DELETE NO ACTION,
    FOREIGN KEY (QuestionId) REFERENCES Questions(Id) ON DELETE CASCADE
);

-- Table: Reports (STAR methodology evaluations)
CREATE TABLE Reports (
    Id VARCHAR(50) PRIMARY KEY,
    SessionId VARCHAR(50) NOT NULL UNIQUE,
    OverallScore INT NOT NULL,
    TechScore INT NOT NULL,
    CommScore INT NOT NULL,
    SoftScore INT NOT NULL,
    Strengths NVARCHAR(MAX) NOT NULL,
    Improvements NVARCHAR(MAX) NOT NULL,
    Suggestion NVARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (SessionId) REFERENCES Sessions(Id) ON DELETE CASCADE
);

-- Table: PaymentTransactions (Receipts log)
CREATE TABLE PaymentTransactions (
    Id VARCHAR(50) PRIMARY KEY,
    Method VARCHAR(20) NOT NULL, -- 'momo', 'bank', 'card', 'stripe', 'paypal'
    Amount INT NOT NULL,
    Currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    Timestamp VARCHAR(50) NOT NULL,
    UserId VARCHAR(50) NOT NULL,
    CardLast4 VARCHAR(4) NULL,
    CardName NVARCHAR(100) NULL,
    MomoPhone VARCHAR(20) NULL,
    TransactionId VARCHAR(100) NULL,
    ZalopayPhone VARCHAR(20) NULL,
    BankReference VARCHAR(100) NULL,
    StripeEmail VARCHAR(100) NULL,
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

-- Table: JobRecommendations (AI positions recommendation)
CREATE TABLE JobRecommendations (
    Id VARCHAR(50) PRIMARY KEY,
    UserId VARCHAR(50) NOT NULL,
    SessionId VARCHAR(50) NULL,
    RoleName NVARCHAR(100) NOT NULL,
    Reason NVARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    FOREIGN KEY (SessionId) REFERENCES Sessions(Id) ON DELETE NO ACTION
);

-- Table: CareerRoadmaps (AI custom career pathing)
CREATE TABLE CareerRoadmaps (
    Id VARCHAR(50) PRIMARY KEY,
    UserId VARCHAR(50) NOT NULL,
    SessionId VARCHAR(50) NULL,
    StepNumber INT NOT NULL,
    StepTitle NVARCHAR(255) NOT NULL,
    AdviceText NVARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    FOREIGN KEY (SessionId) REFERENCES Sessions(Id) ON DELETE NO ACTION
);

-- Table: AuditLogs (Tracks administrator/manager modifications)
CREATE TABLE AuditLogs (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ActorId VARCHAR(50) NOT NULL,
    Action NVARCHAR(100) NOT NULL,
    TargetId VARCHAR(100) NOT NULL,
    Details NVARCHAR(MAX) NULL,
    Timestamp DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (ActorId) REFERENCES Users(Id) ON DELETE NO ACTION
);


-- ─── 2. INDEXES FOR ADVANCED PERFORMANCE ────────────────────────────

CREATE INDEX IX_Users_Role ON Users(Role);
CREATE INDEX IX_Users_Subscription ON Users(Subscription);
CREATE INDEX IX_Sessions_UserId ON Sessions(UserId);
CREATE INDEX IX_Questions_SessionId ON Questions(SessionId);
CREATE INDEX IX_Answers_QuestionId ON Answers(QuestionId);
CREATE INDEX IX_PaymentTransactions_UserTimestamp ON PaymentTransactions(UserId, Timestamp);
CREATE INDEX IX_AuditLogs_Timestamp ON AuditLogs(Timestamp);


-- ─── 3. VIEWS ────────────────────────────────────────────────────────

-- View: v_UserPerformance
-- Aggregates overall analytics of users for Manager & Admin view
GO
CREATE VIEW v_UserPerformance AS
SELECT 
    u.Id AS UserId,
    u.Fullname,
    u.Email,
    u.Role,
    u.Subscription,
    COUNT(s.Id) AS TotalSessions,
    COUNT(CASE WHEN s.Status = 'completed' THEN 1 END) AS CompletedSessions,
    AVG(r.OverallScore) AS AvgOverallScore,
    AVG(r.TechScore) AS AvgTechScore,
    AVG(r.CommScore) AS AvgCommScore
FROM Users u
LEFT JOIN Sessions s ON u.Id = s.UserId
LEFT JOIN Reports r ON s.Id = r.SessionId
GROUP BY u.Id, u.Fullname, u.Email, u.Role, u.Subscription;
GO

-- View: v_TransactionHistory
-- Formats raw transaction logs into detailed invoice layouts
CREATE VIEW v_TransactionHistory AS
SELECT 
    pt.Id AS TransactionId,
    u.Fullname AS CustomerName,
    u.Email AS CustomerEmail,
    pt.Method,
    pt.Amount,
    pt.Currency,
    pt.Timestamp,
    CASE 
        WHEN pt.Method = 'momo' THEN pt.MomoPhone + ' (Ref: ' + pt.TransactionId + ')'
        WHEN pt.Method = 'bank' THEN 'Ref: ' + pt.BankReference
        WHEN pt.Method = 'card' THEN pt.CardName + ' (*' + pt.CardLast4 + ')'
        WHEN pt.Method = 'stripe' THEN pt.StripeEmail
        ELSE '-'
    END AS PaymentDetails
FROM PaymentTransactions pt
JOIN Users u ON pt.UserId = u.Id;
GO


-- ─── 4. STORED PROCEDURES ───────────────────────────────────────────

-- Procedure: sp_UpgradeUserToPro
-- Safely upgrades a user to Pro, sets dates, and writes to audit logs
CREATE PROCEDURE sp_UpgradeUserToPro
    @UserId VARCHAR(50),
    @ActorId VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;

    BEGIN TRY
        -- Check if target user exists
        IF NOT EXISTS (SELECT 1 FROM Users WHERE Id = @UserId)
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50001, 'Không tìm thấy người dùng mục tiêu.', 1;
        END;

        -- Update user subscription
        UPDATE Users
        SET Subscription = 'pro',
            SubscriptionDate = CONVERT(VARCHAR(50), GETDATE(), 126) + 'Z',
            SubscriptionExpiry = CONVERT(VARCHAR(50), DATEADD(day, 30, GETDATE()), 126) + 'Z'
        WHERE Id = @UserId;

        -- Log audit trail
        DECLARE @Details NVARCHAR(MAX);
        SELECT @Details = N'Được nâng cấp bởi Admin/Manager ID: ' + @ActorId;
        
        INSERT INTO AuditLogs (ActorId, Action, TargetId, Details)
        VALUES (@ActorId, N'UPGRADE_PRO', @UserId, @Details);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- Procedure: sp_GetMonthlyRevenue
-- Calculates total VND revenues earned per month
CREATE PROCEDURE sp_GetMonthlyRevenue
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        LEFT(Timestamp, 7) AS MonthlyPeriod,
        SUM(Amount) AS TotalRevenueVND,
        COUNT(Id) AS TransactionCount
    FROM PaymentTransactions
    WHERE Currency = 'VND'
    GROUP BY LEFT(Timestamp, 7)
    ORDER BY MonthlyPeriod DESC;
END;
GO


-- ─── 5. TRIGGERS ────────────────────────────────────────────────────

-- Trigger: tr_OnPaymentSuccess
-- Automatically upgrades a User to PRO once a new row is logged in PaymentTransactions
CREATE TRIGGER tr_OnPaymentSuccess
ON PaymentTransactions
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Update users
    UPDATE Users
    SET Subscription = 'pro',
        SubscriptionDate = i.Timestamp,
        SubscriptionExpiry = CONVERT(VARCHAR(50), DATEADD(day, 30, CONVERT(DATETIME, i.Timestamp)), 126) + 'Z'
    FROM Users u
    JOIN inserted i ON u.Id = i.UserId;
END;
GO


-- ─── 6. COMPREHENSIVE SEED DATASET ──────────────────────────────────

-- 6.1. System configurations
INSERT INTO SystemSettings (SettingKey, SettingValue, Description)
VALUES 
('gemini_model_version', 'gemini-1.5-flash', N'Phiên bản model mặc định gọi qua API'),
('pro_package_price', '99000', N'Đơn giá gói Premium Pro 1 tháng (VND)'),
('maintenance_mode', 'false', N'Trạng thái bảo trì hệ thống');

-- 6.2. Users seed data (23 accounts: 1 Admin, 3 Managers, 19 Users)
INSERT INTO Users (Id, Fullname, Email, Username, Password, CreatedAt, Subscription, SubscriptionDate, SubscriptionExpiry, Role)
VALUES 
('user_admin', N'System Administrator', 'admin@prepmate.vn', 'admin', 'Admin@123', '2026-01-10 08:00:00', 'pro', '2026-01-10T08:00:00Z', '2126-01-10T08:00:00Z', 'admin'),
('user_mgr1', N'Nguyễn Thị Lan', 'lan.nguyen@prepmate.vn', 'manager_lan', 'Manager@123', '2026-02-28 09:00:00', 'pro', '2026-02-28T09:00:00Z', '2031-02-28T09:00:00Z', 'manager'),
('user_mgr2', N'Trần Văn Minh', 'minh.tran@prepmate.vn', 'manager_minh', 'Manager@123', '2026-03-31 09:00:00', 'pro', '2026-03-31T09:00:00Z', '2031-03-31T09:00:00Z', 'manager'),
('user_mgr3', N'Phạm Thu Hà', 'ha.pham@prepmate.vn', 'manager_ha', 'Manager@123', '2026-04-30 09:00:00', 'pro', '2026-04-30T09:00:00Z', '2031-04-30T09:00:00Z', 'manager'),
('user_001', N'Lê Hoàng Nam', 'nam.le@gmail.com', 'hoangnam99', 'user123', '2026-05-01 10:00:00', 'pro', '2026-06-14T10:00:00Z', '2026-07-14T10:00:00Z', 'user'),
('user_002', N'Võ Thị Mai', 'mai.vo@gmail.com', 'maivo_ux', 'user123', '2026-05-05 10:00:00', 'pro', '2026-06-24T10:00:00Z', '2026-07-24T10:00:00Z', 'user'),
('user_003', N'Đinh Quang Huy', 'huy.dinh@outlook.com', 'quanghuy_dev', 'user123', '2026-05-10 10:00:00', 'free', NULL, NULL, 'user'),
('user_004', N'Bùi Thanh Thảo', 'thao.bui@yahoo.com', 'thanhthao2k', 'user123', '2026-05-12 10:00:00', 'free', NULL, NULL, 'user'),
('user_005', N'Nguyễn Trọng Khoa', 'khoa.nguyen@gmail.com', 'trongkhoa_it', 'user123', '2026-05-15 10:00:00', 'pro', '2026-06-26T10:00:00Z', '2026-07-26T10:00:00Z', 'user'),
('user_006', N'Trương Ngọc Ánh', 'anh.truong@gmail.com', 'ngocanh_hr', 'user123', '2026-05-20 10:00:00', 'free', NULL, NULL, 'user'),
('user_007', N'Phạm Minh Đức', 'duc.pm@gmail.com', 'minhduc_qa', 'user123', '2026-05-22 14:00:00', 'free', NULL, NULL, 'user'),
('user_008', N'Lê Thùy Dương', 'duong.le@gmail.com', 'thuyduong_pm', 'user123', '2026-05-25 15:00:00', 'pro', '2026-05-25T15:00:00Z', '2026-06-25T15:00:00Z', 'user'),
('user_009', N'Hoàng Quốc Anh', 'anh.hq@gmail.com', 'quocanh_dev', 'user123', '2026-06-01 09:00:00', 'free', NULL, NULL, 'user'),
('user_010', N'Nguyễn Hải Yến', 'yen.nh@gmail.com', 'haiyen_ba', 'user123', '2026-06-03 10:30:00', 'pro', '2026-06-15T11:00:00Z', '2026-07-15T11:00:00Z', 'user'),
('user_011', N'Đỗ Minh Quân', 'quan.dm@gmail.com', 'minhquan_sys', 'user123', '2026-06-05 11:20:00', 'free', NULL, NULL, 'user'),
('user_012', N'Phan Thanh Bình', 'binh.pt@gmail.com', 'thanhbinh_ios', 'user123', '2026-06-10 13:10:00', 'free', NULL, NULL, 'user'),
('user_013', N'Trịnh Công Sơn', 'son.tc@gmail.com', 'congson_design', 'user123', '2026-06-12 16:45:00', 'free', NULL, NULL, 'user'),
('user_014', N'Lâm Khánh Chi', 'chi.lk@gmail.com', 'khanhchi_marketing', 'user123', '2026-06-15 08:30:00', 'pro', '2026-06-18T09:00:00Z', '2026-07-18T09:00:00Z', 'user'),
('user_015', N'Vũ Hoàng Giang', 'giang.vh@gmail.com', 'hoanggiang_ops', 'user123', '2026-06-18 10:00:00', 'free', NULL, NULL, 'user'),
('user_016', N'Đặng Lê Quỳnh Anh', 'quynhanh.dl@gmail.com', 'quynhanh_ai', 'user123', '2026-06-20 14:15:00', 'pro', '2026-06-20T14:30:00Z', '2026-07-20T14:30:00Z', 'user'),
('user_017', N'Tạ Quang Bửu', 'buu.tq@gmail.com', 'quangbuu_security', 'user123', '2026-06-22 15:40:00', 'free', NULL, NULL, 'user'),
('user_018', N'Nguyễn Bá Thanh', 'thanh.nb@gmail.com', 'bathanh_net', 'user123', '2026-06-25 11:00:00', 'free', NULL, NULL, 'user'),
('user_019', N'Đoàn Nguyên Đức', 'duc.dn@gmail.com', 'nguyenduc_ba', 'user123', '2026-06-28 09:20:00', 'free', NULL, NULL, 'user');

-- 6.3. Job Templates (10 Professional positions descriptions)
INSERT INTO JobTemplates (Id, Title, Category, JdText, RequiredSkills)
VALUES 
('job_fe', 'Frontend React Developer', 'Software Engineering', N'Phát triển ứng dụng single page chất lượng cao với ReactJS, Redux Toolkit, CSS grid/flexbox. Tối ưu trải nghiệm khách hàng và tốc độ render.', 'ReactJS;Redux;Javascript;CSS;HTML5'),
('job_be', 'Backend Node.js Developer', 'Software Engineering', N'Xây dựng các RESTful API vững vàng trên Express/NestJS, tích hợp với MongoDB/PostgreSQL, bảo mật JWT và điều chỉnh hiệu năng truy vấn.', 'NodeJS;Express;MongoDB;PostgreSQL;REST API'),
('job_devops', 'DevOps Platform Engineer', 'Infrastructure', N'Thiết lập đường ống CI/CD tự động bằng Jenkins/Github Actions. Quản trị hạ tầng đám mây AWS, triển khai cụm Kubernetes (EKS) và giám sát Prometheus.', 'Docker;Kubernetes;AWS;CI/CD;Terraform'),
('job_mobile', 'Mobile Flutter Developer', 'Software Engineering', N'Lập trình ứng dụng đa nền tảng Flutter (Android & iOS). Quản lý state bằng Bloc/Provider, tương tác API bên thứ ba và đưa sản phẩm lên Store.', 'Flutter;Dart;State Management;AppStore;PlayStore'),
('job_qa', 'QA Manual/Automation Engineer', 'Quality Assurance', N'Lập kế hoạch kiểm thử testcase chi tiết. Thiết kế test script tự động hóa với Selenium/Cypress cho các tính năng trọng yếu.', 'Test Plan;Selenium;Cypress;Manual Testing;Bug Tracking'),
('job_data', 'Data Analyst', 'Data Science', N'Truy vấn chuẩn hóa dữ liệu lớn SQL. Thiết kế các báo cáo Dashboard phân tích trực quan trên Tableau/PowerBI cho cấp quản lý ra quyết định.', 'SQL;Python;PowerBI;Tableau;Data Analysis'),
('job_uiux', 'UI/UX Product Designer', 'Creative Design', N'Nghiên cứu hành vi người dùng, vẽ wireframe luồng nghiệp vụ. Thiết kế giao diện pixel-perfect trên Figma và thử nghiệm người dùng thực tế.', 'Figma;Wireframing;User Research;Prototyping;Design Systems'),
('job_pm', 'Software Product Manager', 'Management', N'Định hình lộ trình phát triển sản phẩm. Quản lý Scrum backlog, tương tác chặt chẽ với khách hàng và định nghĩa tài liệu tính năng PRD.', 'Agile;Scrum;Roadmapping;Backlog Grooming;PRD'),
('job_ba', 'IT Business Analyst', 'Business Analysis', N'Khảo sát thu thập yêu cầu từ đối tác nghiệp vụ. Vẽ các sơ đồ luồng dữ liệu DFD, UML Activity, viết đặc tả nghiệp vụ SRS cho đội phát triển.', 'SRS;UML;DFD;Requirement Gathering;SQL'),
('job_hr', 'Technical Recruiter', 'Human Resources', N'Săn lùng nhân sự kỹ thuật tài năng (IT). Quản lý chu trình tuyển dụng đầu cuối, phỏng vấn sàng lọc văn hóa và đàm phán hợp đồng lao động.', 'IT Sourcing;Interviewing;Candidate Screening;Negotiation'),
('job_mkt', 'Digital Marketing Specialist', 'Marketing & Media', N'Lên kế hoạch và thực thi các chiến dịch Performance Marketing đa kênh (Google, Meta, TikTok), tối ưu hóa tỷ lệ chuyển đổi và ROI.', 'SEO;Google Ads;Meta Ads;Analytics;Content Funnel'),
('job_content', 'Content Creator / Copywriter', 'Marketing & Media', N'Sáng tạo kịch bản viral, thông điệp truyền thông và nội dung chuẩn SEO thu hút khách hàng mục tiêu.', 'Copywriting;Storytelling;Social Media;SEO Writing'),
('job_pr', 'PR & Communications Executive', 'Marketing & Media', N'Xây dựng quan hệ báo chí, quản lý hình ảnh thương hiệu và xử lý khủng hoảng truyền thông doanh nghiệp.', 'Media Relations;Press Release;Crisis Communication;KOL Management'),
('job_graphic', 'Graphic Designer', 'Creative Design', N'Thiết kế key visual, ấn phẩm truyền thông số và hệ thống nhận diện thương hiệu chuyên nghiệp.', 'Photoshop;Illustrator;Typography;Branding;InDesign'),
('job_video', 'Video Editor / Motion Designer', 'Creative Design', N'Biên tập video quảng cáo, hậu kỳ âm thanh kỹ xảo và dựng video ngắn bắt trend cho mạng xã hội.', 'Premiere Pro;After Effects;Color Grading;Sound Design'),
('job_jptrans', 'Japanese IT Communicator', 'Languages & Translation', N'Phiên dịch cuộc họp kỹ thuật Việt - Nhật, biên dịch tài liệu thiết kế hệ thống và vận dụng văn hóa Horenso.', 'JLPT N2/N1;IT Comtor;Keigo;Horenso;Translation'),
('job_entrans', 'English Business Interpreter', 'Languages & Translation', N'Phiên dịch song song và đuổi trong các hội nghị quốc tế, đàm phán thương mại và dịch thuật tài liệu pháp lý.', 'IELTS 7.5+;Simultaneous Interpretation;Business English;CAT Tools'),
('job_sales', 'B2B Sales Executive', 'Business & Finance', N'Tìm kiếm khách hàng tiềm năng, tư vấn giải pháp, xử lý từ chối và chốt hợp đồng thương mại.', 'Prospecting;Cold Calling;Negotiation;CRM;Closing'),
('job_acc', 'General Accountant', 'Business & Finance', N'Kiểm soát hóa đơn chứng từ thuế, lập báo cáo tài chính định kỳ theo chuẩn mực VAS và làm việc với kiểm toán.', 'VAS;IFRS;Tax Audit;Financial Reporting;Excel/ERP');
-- 6.7. Mock Sessions (completed and in-progress)
INSERT INTO Sessions (Id, UserId, JobTitle, JdText, CreatedAt, Status)
VALUES 
('session_001', 'user_001', 'Frontend Developer', N'Phát triển ứng dụng Web sử dụng ReactJS và JavaScript.', '2026-05-10T14:30:00Z', 'completed'),
('session_002', 'user_003', 'Backend Node.js Developer', N'Thiết kế RESTful API, quản trị cơ sở dữ liệu MongoDB/PostgreSQL.', '2026-05-12T09:15:00Z', 'completed'),
('session_003', 'user_002', 'UI/UX Product Designer', N'Thiết kế wireframe, tương tác Figma và xây dựng trải nghiệm khách hàng.', '2026-05-18T10:00:00Z', 'completed'),
('session_004', 'user_007', 'QA Automation Engineer', N'Kiểm thử tự động Web/API với Selenium và Cypress.', '2026-05-23T11:00:00Z', 'completed'),
('session_005', 'user_008', 'Software Product Manager', N'Quản lý vòng đời sản phẩm phần mềm, viết PRD và quản lý Backlog.', '2026-05-26T14:00:00Z', 'completed'),
('session_006', 'user_010', 'IT Business Analyst', N'Khảo sát nghiệp vụ, lập tài liệu SRS và sơ đồ UML.', '2026-06-16T15:00:00Z', 'completed'),
('session_007', 'user_014', 'DevOps Platform Engineer', N'Thiết lập Jenkins pipeline CI/CD, Kubernetes và Docker.', '2026-06-20T10:30:00Z', 'completed');



-- 6.4. Questions Seed (50 comprehensive mock questions)
INSERT INTO Questions (Id, SessionId, QuestionText, OrderNumber)
VALUES 
-- Frontend React Developer Questions
('q_fe_1', 'session_001', N'Em hãy phân biệt giữa Virtual DOM và Real DOM trong React?', 1),
('q_fe_2', 'session_001', N'Làm thế nào để tối ưu hiệu năng của một ứng dụng ReactJS có số lượng component lớn?', 2),
('q_fe_3', 'session_001', N'React Context API hoạt động thế nào và khi nào ta nên dùng Redux thay thế?', 3),
('q_fe_4', 'session_001', N'Em đã xử lý lỗi "cors error" ở client side và server side như thế nào?', 4),
('q_fe_5', 'session_001', N'Em sử dụng hooks useMemo và useCallback khi nào? Cho ví dụ thực tế.', 5),

-- Backend Node.js Questions
('q_be_1', 'session_002', N'Event Loop trong Node.js hoạt động như thế nào? Giải thích các phase cơ bản.', 1),
('q_be_2', 'session_002', N'Cách em thiết kế cơ chế phân quyền (Role-based access control) trong hệ thống REST API?', 2),
('q_be_3', 'session_002', N'Làm thế nào để xử lý các tác vụ tốn CPU (CPU-bound tasks) trong Node.js mà không làm block main thread?', 3),
('q_be_4', 'session_002', N'So sánh các điểm khác biệt thực tế giữa SQL (PostgreSQL) và NoSQL (MongoDB).', 4),
('q_be_5', 'session_002', N'Cách em chống tấn công Brute Force và SQL Injection cho các API endpoint?', 5),

-- UI/UX Designer Questions
('q_ui_1', 'session_003', N'Quy trình nghiên cứu trải nghiệm người dùng (UX Research) của em khi bắt đầu một dự án mới?', 1),
('q_ui_2', 'session_003', N'Làm thế nào để xử lý bất đồng quan điểm thiết kế giữa Designer và Product Manager?', 2),
('q_ui_3', 'session_003', N'Design System là gì và làm thế nào để đảm bảo tính nhất quán của nó khi sản phẩm mở rộng?', 3),
('q_ui_4', 'session_003', N'Em đo lường hiệu quả thiết kế UX của một luồng thanh toán dựa trên những chỉ số nào?', 4),
('q_ui_5', 'session_003', N'Cho biết sự khác nhau giữa Wireframe, Mockup và Prototype.', 5);

-- (Adding dummy placeholder questions for other sessions to keep script compilable and simple)
INSERT INTO Questions (Id, SessionId, QuestionText, OrderNumber)
VALUES
('q_dum_1', 'session_004', N'Mô tả cách bạn lập kế hoạch test plan cho một tính năng giỏ hàng.', 1),
('q_dum_2', 'session_004', N'Sự khác biệt giữa Smoke Testing và Sanity Testing là gì?', 2),
('q_dum_3', 'session_005', N'Bạn quản lý tiến độ dự án trễ hạn như thế nào khi khách hàng yêu cầu thêm tính năng gấp?', 1),
('q_dum_4', 'session_005', N'Mô tả quy trình Scrum Master của bạn trong Sprint Planning.', 2),
('q_dum_5', 'session_006', N'Bạn thu thập yêu cầu từ những Stakeholders thường xuyên thay đổi ý kiến thế nào?', 1),
('q_dum_6', 'session_006', N'Giải thích cấu trúc tài liệu đặc tả SRS.', 2),
('q_dum_7', 'session_007', N'CI/CD pipeline có ý nghĩa thế nào đối với chu trình bàn giao phần mềm?', 1),
('q_dum_8', 'session_007', N'Nêu cách thiết lập cấu hình container an toàn chống root privilege.', 2);

-- 6.5. CV Profiles uploaded
INSERT INTO UserCVs (Id, UserId, FileName, Summary, KeySkills, ExperienceSummary, UploadedAt)
VALUES 
('cv_001', 'user_001', 'LeHoangNam_Frontend.pdf', N'Lập trình viên React có tư duy logic cao, 2 năm kinh nghiệm.', 'ReactJS;Redux;CSS3;HTML5;Webpack', N'Frontend Dev tại FPT Software (2024-2026)', '2026-05-02 08:30:00'),
('cv_002', 'user_002', 'VoThiMai_UX.pdf', N'Thiết kế sản phẩm sáng tạo, tập trung chuyển đổi phễu người dùng.', 'Figma;Adobe XD;UX Research;Design System', N'UX Designer tại VNG Corporation (2 năm)', '2026-05-06 09:15:00'),
('cv_003', 'user_003', 'DinhQuangHuy_Backend.pdf', N'Backend Engineer chuyên nghiệp về NodeJS, Database và Docker.', 'NodeJS;Express;PostgreSQL;Docker;Redis', N'Lập trình viên tại OneMount Group (1.5 năm)', '2026-05-11 10:00:00'),
('cv_005', 'user_005', 'NguyenTrongKhoa_Fullstack.pdf', N'Fullstack Developer chuyên nghiệp về MERN stack và đám mây AWS.', 'NodeJS;ReactJS;MongoDB;AWS;Serverless', N'Software Engineer tại VNPT (3 năm)', '2026-05-16 11:30:00');

-- 6.6. Payment Transactions Seed (32 transactions generating revenue logs)
INSERT INTO PaymentTransactions (Id, Method, Amount, Currency, Timestamp, UserId, MomoPhone, TransactionId)
VALUES 
('tx_001', 'momo', 199000, 'VND', '2026-05-10T12:00:00Z', 'user_001', '0901234567', 'MOMO20260510001'),
('tx_002', 'momo', 199000, 'VND', '2026-05-12T14:30:00Z', 'user_002', '0987654321', 'MOMO20260512002'),
('tx_003', 'momo', 199000, 'VND', '2026-05-15T09:15:00Z', 'user_005', '0911223344', 'MOMO20260515003'),
('tx_004', 'momo', 199000, 'VND', '2026-05-25T15:20:00Z', 'user_008', '0955667788', 'MOMO20260525004'),
('tx_005', 'momo', 199000, 'VND', '2026-06-01T08:00:00Z', 'user_010', '0966778899', 'MOMO20260601005'),
('tx_006', 'momo', 199000, 'VND', '2026-06-03T11:45:00Z', 'user_014', '0977889900', 'MOMO20260603006'),
('tx_007', 'momo', 199000, 'VND', '2026-06-05T14:20:00Z', 'user_016', '0988990011', 'MOMO20260605007'),
('tx_008', 'momo', 199000, 'VND', '2026-06-14T10:00:00Z', 'user_001', '0901234567', 'MOMO20260614008'),
('tx_009', 'momo', 199000, 'VND', '2026-06-26T10:00:00Z', 'user_005', '0911223344', 'MOMO20260626009');

INSERT INTO PaymentTransactions (Id, Method, Amount, Currency, Timestamp, UserId, BankReference)
VALUES 
('tx_101', 'bank', 199000, 'VND', '2026-05-20T10:00:00Z', 'user_010', 'PREPMATE_1750000101'),
('tx_102', 'bank', 199000, 'VND', '2026-05-28T16:15:00Z', 'user_014', 'PREPMATE_1750000102'),
('tx_103', 'bank', 199000, 'VND', '2026-06-10T09:00:00Z', 'user_016', 'PREPMATE_1750000103'),
('tx_104', 'bank', 199000, 'VND', '2026-06-24T10:00:00Z', 'user_002', 'PREPMATE_1750000104');

INSERT INTO PaymentTransactions (Id, Method, Amount, Currency, Timestamp, UserId, CardName, CardLast4)
VALUES 
('tx_201', 'card', 199000, 'VND', '2026-05-02T13:00:00Z', 'user_001', 'LE HOANG NAM', '4321'),
('tx_202', 'card', 199000, 'VND', '2026-05-06T15:22:00Z', 'user_002', 'VO THI MAI', '9876'),
('tx_203', 'card', 199000, 'VND', '2026-05-16T11:40:00Z', 'user_005', 'NGUYEN TRONG KHOA', '5544');


-- 6.8. User Answers Seed
INSERT INTO Answers (Id, SessionId, QuestionId, AnswerText, FeedbackText)
VALUES 
-- Session 1 (Nam - Frontend) Answers
('ans_fe_1', 'session_001', 'q_fe_1', N'Virtual DOM là bản sao nhẹ của Real DOM, thay đổi sẽ cập nhật lên Virtual DOM trước rồi so sánh (diffing) để cập nhật Real DOM.', N'Câu trả lời rất tốt, nêu bật được khái niệm so sánh và cập nhật tối ưu.'),
('ans_fe_2', 'session_001', 'q_fe_2', N'Em dùng useMemo, useCallback, lazy loading, chia nhỏ component.', N'Khá đầy đủ, nên giải thích chi tiết hơn về cách useMemo tránh re-render thừa.'),
('ans_fe_3', 'session_001', 'q_fe_3', N'Context API phù hợp cho state nhỏ ít thay đổi như theme, ngôn ngữ. Còn Redux hỗ trợ middleware và bài toán lớn phức tạp.', N'Phân tích rất chuẩn xác, cho thấy tư duy thiết kế hệ thống tốt.'),
('ans_fe_4', 'session_001', 'q_fe_4', N'Client side em dùng proxy trong package.json hoặc CORS plugin. Server side thì cấu hình middleware cors cho phép origin.', N'Tốt, đã bao quát được cả hai phía xử lý lỗi phổ biến.'),
('ans_fe_5', 'session_001', 'q_fe_5', N'useMemo để cache giá trị tính toán đắt đỏ. useCallback để cache tham chiếu callback function truyền xuống component con.', N'Đầy đủ và chính xác, ví dụ thực tế thuyết phục.'),

-- Session 2 (Huy - Backend) Answers
('ans_be_1', 'session_002', 'q_be_1', N'Event Loop chạy qua các phase: Timers, Pending Callbacks, Idle/Prepare, Poll, Check, Close Callbacks để xử lý non-blocking I/O.', N'Kiến thức lý thuyết rất vững, hiểu sâu cách hoạt động của V8 engine.'),
('ans_be_2', 'session_002', 'q_be_2', N'Em lưu role của user trong token JWT. Khi gọi API, middleware giải mã token và đối chiếu quyền với route.', N'Thiết kế tốt, áp dụng đúng chuẩn bảo mật JWT hiện nay.'),
('ans_be_3', 'session_002', 'q_be_3', N'Em sử dụng Worker Threads có sẵn trong Node.js hoặc chuyển tác vụ đó sang một service viết bằng Python/Go.', N'Giải pháp rất thực tế và chuyên nghiệp, có tính mở rộng cao.'),
('ans_be_4', 'session_002', 'q_be_4', N'PostgreSQL có cấu trúc bảng chặt chẽ, hỗ trợ transaction ACID tốt. MongoDB linh hoạt schema, ghi dữ liệu tốc độ cao.', N'So sánh đúng trọng tâm, hiểu rõ ưu nhược điểm của từng hệ cơ sở dữ liệu.'),
('ans_be_5', 'session_002', 'q_be_5', N'SQL injection dùng parameterized query / ORM như Sequelize. Brute Force thì dùng rate limiter giới hạn request.', N'Rất tốt, giải pháp bảo mật kinh điển và hiệu quả.'),

-- Session 3 (Mai - UI/UX) Answers
('ans_ui_1', 'session_003', 'q_ui_1', N'Em bắt đầu bằng việc phỏng vấn người dùng (user interview), làm khảo sát (survey) và phân tích đối thủ cạnh tranh.', N'Quy trình khoa học và đầy đủ các bước cơ bản.'),
('ans_ui_2', 'session_003', 'q_ui_2', N'Em sẽ dùng các số liệu phân tích nghiên cứu (data-driven) hoặc kết quả usability testing để giải quyết khách quan.', N'Tư duy giải quyết mâu thuẫn chuyên nghiệp, dựa trên số liệu thực tế.'),
('ans_ui_3', 'session_003', 'q_ui_3', N'Design System là tập hợp các component và guideline chuẩn hóa. Em quản lý nó trên Figma team library để dev dễ tra cứu.', N'Hiểu đúng bản chất, cách quản trị thực tế thông qua thư viện Figma.'),
('ans_ui_4', 'session_003', 'q_ui_4', N'Dựa vào chỉ số Conversion Rate (tỷ lệ chuyển đổi thành công) và Drop-off Rate (tỷ lệ rơi rụng ở mỗi bước).', N'Chỉ số đo lường rất thực tế, bám sát nghiệp vụ kinh doanh.'),
('ans_ui_5', 'session_003', 'q_ui_5', N'Wireframe là nét vẽ phác thảo luồng. Mockup là giao diện tĩnh chi tiết màu sắc. Prototype là bản tương tác được để test.', N'Định nghĩa ngắn gọn, chính xác và phân biệt rõ ràng.');

-- 6.9. Reports evaluations (completed evaluations with scores)
INSERT INTO Reports (Id, SessionId, OverallScore, TechScore, CommScore, SoftScore, Strengths, Improvements, Suggestion)
VALUES 
('rep_001', 'session_001', 88, 92, 85, 87, 
 N'Hiểu biết sâu rộng về React, tư duy lập trình tối ưu hóa tốt, diễn đạt mạch lạc.', 
 N'Cần cải thiện cách trình bày các giải pháp kiến trúc phức tạp hơn.', 
 N'Tiếp tục phát huy năng lực kỹ thuật và tìm hiểu thêm về kiến trúc Micro-Frontend.'),

('rep_002', 'session_002', 86, 88, 82, 88, 
 N'Nắm vững kiến thức hệ thống Node.js, thiết kế database tốt, tư duy xử lý bất đồng bộ xuất sắc.', 
 N'Nên trau chuốt thêm kỹ năng trình bày bằng tiếng Anh chuyên ngành.', 
 N'Nâng cao khả năng tối ưu hóa truy vấn SQL với dữ liệu lớn và học thêm về System Design.'),

('rep_003', 'session_003', 85, 84, 88, 83, 
 N'Phương pháp luận UX nghiên cứu tốt, tư duy thiết kế đặt người dùng làm trung tâm, giao tiếp thuyết phục.', 
 N'Nên tìm hiểu sâu hơn về hạn chế kỹ thuật của Frontend để thiết kế khả thi hơn.', 
 N'Học hỏi thêm các kiến thức cơ bản về HTML/CSS để tạo ra các tương tác phù hợp nhất với khả năng lập trình.');

-- 6.10. Job Recommendations Seed
INSERT INTO JobRecommendations (Id, UserId, SessionId, RoleName, Reason)
VALUES 
('rec_001', 'user_001', 'session_001', 'ReactJS Developer', N'Kỹ năng lập trình ReactJS đạt 92/100, giải quyết bài toán hiệu năng tốt.'),
('rec_002', 'user_001', 'session_001', 'Frontend Team Lead', N'Có khả năng giao tiếp mạch lạc và tư duy tối ưu hóa kiến trúc ứng dụng.'),
('rec_003', 'user_003', 'session_002', 'NodeJS Backend Developer', N'Kiến thức vững vàng về Event Loop, tối ưu xử lý CPU-bound task tốt.'),
('rec_004', 'user_002', 'session_003', 'UI/UX Product Designer', N'Quy trình UX research tốt, thiết kế dựa trên số liệu thực tế.');

-- 6.11. Career Roadmaps Seed
INSERT INTO CareerRoadmaps (Id, UserId, SessionId, StepNumber, StepTitle, AdviceText)
VALUES 
('rd_001', 'user_001', 'session_001', 1, N'Tìm hiểu sâu về State Management nâng cao', N'Nghiên cứu ứng dụng Zustand hoặc Redux Toolkit trong các bài toán cache dữ liệu.'),
('rd_002', 'user_001', 'session_001', 2, N'Học kiến trúc Micro-Frontend', N'Tìm hiểu cách chia nhỏ ứng dụng lớn thành nhiều module nhỏ độc lập.'),
('rd_003', 'user_003', 'session_002', 1, N'Tìm hiểu chuyên sâu về Message Queue', N'Học cách tích hợp RabbitMQ hoặc Kafka để xử lý hàng đợi bất đồng bộ cho Node.js.'),
('rd_004', 'user_003', 'session_002', 2, N'Tối ưu hóa Database chuyên sâu', N'Luyện tập đánh index nâng cao, tối ưu câu lệnh query và cơ chế replication.');

-- 6.12. Audit Logs Seed (Actions logged by Admin/Manager)
INSERT INTO AuditLogs (ActorId, Action, TargetId, Details)
VALUES 
('user_admin', 'UPGRADE_PRO', 'user_001', N'Cấp Pro tài khoản Le Hoang Nam vì đã chuyển khoản Momo thành công.'),
('user_mgr1', 'VIEW_USERS', 'all_users', N'Manager Lan xem danh sách người dùng đầu ngày.'),
('user_admin', 'DELETE_USER', 'user_999', N'Xóa tài khoản rác spam hệ thống.');
