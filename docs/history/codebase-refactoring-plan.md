# PREPMATE — P1.5-FR FULL CODEBASE REFACTORING & STRUCTURE NORMALIZATION
## PHASE A: REPOSITORY AUDIT & REFACTORING PLAN

**Phase:** P1.5-FR (Full Codebase Refactoring & Structure Normalization)  
**Execution Stage:** Phase A — Audit & Plan Only (Strictly No Code Modifications)  
**Status:** **AUDIT COMPLETE — AWAITING REVIEW**  
**Date:** October 7, 2026  
**Auditor:** Senior Principal Software Architect & QA Lead  

---

## 1. Executive Summary

Hệ thống PrepMate đã hoàn thành toàn bộ các mốc chất lượng UX/UI từ P1.3, P1.4-B, P1.4-C đến P1.5 (Waves R1–R4) và đã đạt trạng thái **PASS — READY TO SEAL** với 429 automated regression assertions và 0 lỗi build backend .NET.

Tuy nhiên, trải qua nhiều giai đoạn phát triển và remediation liên tiếp, cấu trúc repository hiện tại bộc lộ nhiều điểm nghẽn về mặt công thái học kỹ thuật (architectural ergonomics):
1. **Ô nhiễm mã kiểm thử trong thư mục production:** Toàn bộ 14 test scripts hiện đang nằm rải rác trực tiếp bên trong `FE/features/interview/`, `FE/features/report/`, và một thư mục `FE/features/accessibility/` vốn không hề chứa mã production nào.
2. **File rác và file trùng lặp tại thư mục gốc:** Tồn tại file `test_p14c_responsive.js` ở root dự án (bản nháp cũ bị trượt 3 checks do CSS đã được trích xuất sang `admin.css`), cùng thư mục rỗng `bin/` ở root.
3. **Mã nguồn C# mồ côi (0-byte stubs):** Tồn tại 2 file rỗng 0 bytes trong backend: `BE/Models/Common/ApiResponse.cs` và `BE/Models/Common/ErrorResponse.cs` không có bất kỳ consumer nào.
4. **Phân mảnh tài liệu tại root:** 19 file markdown báo cáo audit từ P0.1 đến P1.5 nằm trực tiếp ở thư mục gốc gây rối mắt cho developer mới.
5. **Độ lệch ngữ nghĩa của Stylesheet dùng chung:** File `FE/features/dashboard/new-dashboard.css` trên thực tế đang đóng vai trò là stylesheet layout khung (candidate shell layout) cho 13 trang web khác nhau nhưng lại mang tiền tố legacy `new-` và nằm dưới feature `dashboard`.
6. **Sự bất cập trong đường dẫn kiểm thử (Root cause phát hiện trong Audit):** Cả `test_p14c_accessibility.js` và `test_p14c_responsive.js` đang fail 3 assertions do assert các thẻ `@media` trực tiếp trong `admin.html`, trong khi ở P1.5-R4 các luật này đã được trích xuất chuẩn mực sang `admin.css`.

**Mục tiêu của P1.5-FR:** Thực hiện quy chuẩn hóa toàn bộ cấu trúc dự án (structure normalization), tách biệt hoàn toàn production code khỏi test suite, dọn dẹp file thừa/trùng lặp, thiết lập cây thư mục `tests/` và `docs/` chuyên nghiệp, đảm bảo **100% BEHAVIOR GIỮ NGUYÊN** và bảo tồn toàn bộ regression suite.

---

## 2. Current Repository Structure

Tổng số file trong filesystem dự án: **282 files** (trong đó có 234 active project files, loại trừ thư mục build `BE/bin/`, `BE/obj/` và `.git/`).

```text
PrepMate/
├── .gitignore
├── .vscode/
│   └── settings.json
├── bin/                                       <-- [ANOMALY: Empty folder at root]
├── test_p14c_responsive.js                    <-- [ANOMALY: Orphan draft test at root]
├── H2_DESIGN_SYSTEM.md                        <-- [Historical Report]
├── P0.1_FULL_UI_UX_AUDIT.md                   <-- [Historical Report]
├── P0.1_FUNCTIONAL_INTEGRITY_AUDIT.md         <-- [Historical Report]
├── P0.2_ARCHITECTURE_STABILIZATION_REPORT.md  <-- [Historical Report]
├── P1.1_INTERVIEW_SETUP_RECONSTRUCTION_REPORT.md
├── P1.2_LIVE_INTERVIEW_UX_RECONSTRUCTION_REPORT.md
├── P1.2_POST_IMPLEMENTATION_LIFECYCLE_AUDIT.md
├── P1.3_INDUSTRY_NEUTRAL_CONTENT_CONTEXT_AUDIT.md
├── P1.3_WAVE_A_CONTEXT_CORE_REMEDIATION_REPORT.md
├── P1.3_WAVE_B_EVALUATION_PRESENTATION_REMEDIATION_REPORT.md
├── P1.4_A_FULL_PRODUCT_UX_UI_REAUDIT.md
├── P1.4_B_INFORMATION_ARCHITECTURE_NAVIGATION_REMEDIATION.md
├── P1.4_C_ACCESSIBILITY_RESPONSIVE_REMEDIATION.md
├── P1_5_FINAL_ACCEPTANCE_REVIEW.md
├── P1_5_FINAL_UX_UI_CONSISTENCY_AUDIT.md
├── P1_5_R1_DESIGN_SYSTEM_SHELL_REMEDIATION.md
├── P1_5_R2_UI_LANGUAGE_ICONOGRAPHY_REMEDIATION.md
├── P1_5_R3_PRODUCT_FIT_MULTI_INDUSTRY_REMEDIATION.md
├── P1_5_R4_CLEANUP_LEGACY_REMEDIATION.md
│
├── BE/
│   ├── backend.csproj                         <-- .NET 10 Web Project
│   ├── backend.http
│   ├── Program.cs                             <-- Configures static files to ../FE
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   ├── Configuration/
│   │   └── AIConfiguration.cs
│   ├── Controllers/                           <-- 9 API Controllers
│   ├── Database/
│   │   └── prepmate_setup.sql
│   ├── Middleware/
│   │   └── RateLimitMiddleware.cs
│   ├── Models/                                <-- 47 Model & DTO files
│   │   ├── Common/
│   │   │   ├── ApiResponse.cs                 <-- [ANOMALY: 0-byte stub]
│   │   │   └── ErrorResponse.cs               <-- [ANOMALY: 0-byte stub]
│   │   ├── Company/
│   │   ├── DTOs/
│   │   ├── Evaluation/
│   │   ├── Interview/
│   │   ├── Knowledge/
│   │   ├── Preparation/
│   │   ├── Question/
│   │   └── User/
│   ├── Prompts/                               <-- 12 Structured Prompt Classes
│   ├── Properties/
│   │   └── launchSettings.json
│   └── Services/                              <-- 59 Domain & Infrastructure Services
│
└── FE/
    ├── 404.html
    ├── index.html                             <-- Landing Page (Default file)
    ├── manifest.json
    ├── features/
    │   ├── about/
    │   │   └── about.html
    │   ├── accessibility/                     <-- [ANOMALY: Contains NO prod code!]
    │   │   ├── test_p14c_accessibility.js
    │   │   └── test_p14c_responsive.js
    │   ├── admin/
    │   │   ├── admin.css
    │   │   └── admin.html
    │   ├── auth/
    │   │   ├── auth.html
    │   │   └── auth.js
    │   ├── dashboard/
    │   │   ├── dashboard.html
    │   │   ├── dashboard.js
    │   │   └── new-dashboard.css              <-- Shell Layout CSS (Used by 13 pages)
    │   ├── design-system/
    │   │   └── showcase.html
    │   ├── help/
    │   │   └── help.html
    │   ├── interview/                         <-- Heavy mixing of prod & test code
    │   │   ├── avatar.js
    │   │   ├── history.html                   <-- Should conceptually be its own feature
    │   │   ├── interview-info.css
    │   │   ├── interview-info.html
    │   │   ├── interview-practice.html
    │   │   ├── interview-room.css
    │   │   ├── interview.js
    │   │   ├── test_conversational_persona.js <-- Integration Test (Needs BE)
    │   │   ├── test_industry_context.js       <-- Test
    │   │   ├── test_interview_flow.js         <-- Test
    │   │   ├── test_interview_setup_ux.js     <-- Test
    │   │   ├── test_live_interview_ux.js      <-- Test
    │   │   ├── test_p13_presentation.js       <-- Test
    │   │   ├── test_p14_navigation.js         <-- Test
    │   │   ├── test_p15_r1_consistency.js     <-- Test
    │   │   ├── test_p15_r2_ui_language.js     <-- Test
    │   │   ├── test_p15_r3_product_fit.js     <-- Test
    │   │   └── test_p15_r4_cleanup.js         <-- Test
    │   ├── jobs/
    │   │   ├── jobs.css
    │   │   └── jobs.html
    │   ├── payment/
    │   │   ├── payment.html
    │   │   └── pricing.html
    │   ├── profile/
    │   │   ├── cv.html
    │   │   ├── profile.html
    │   │   └── settings.html
    │   ├── progress/
    │   │   └── progress.html
    │   ├── qbank/
    │   │   ├── qbank.css
    │   │   └── qbank.html
    │   └── report/
    │       ├── report.css
    │       ├── report.html
    │       ├── report.js
    │       └── test_report_ui.js              <-- Test mixed with prod code
    │
    └── shared/
        ├── css/
        │   ├── base.css
        │   ├── components.css
        │   ├── landing.css
        │   ├── layout.css
        │   ├── style.css                      <-- 4,253 lines (Mega global style)
        │   ├── tokens.css                     <-- SSOT Design Tokens (--pm-*)
        │   └── utilities.css
        ├── images/
        │   ├── bank_qr.jpg
        │   ├── interviewer_lead.jpg
        │   └── momo_qr.jpg
        └── js/
            ├── components.js                  <-- Web Components (AppHeader, AppSidebar)
            ├── main.js                        <-- 2,683 lines monolithic runtime
            ├── components/                    <-- Sub-components (used by showcase.html)
            │   ├── loading.js
            │   ├── modal.js
            │   ├── tabs.js
            │   └── toast.js
            ├── core/                          <-- Core modules (used by showcase.html)
            │   ├── auth.js                    <-- Linked by all 20 pages!
            │   ├── routing.js
            │   ├── storage.js
            │   └── user.js
            └── layout/                        <-- Layout scripts (used by showcase.html)
                ├── header.js
                ├── sidebar.js
                └── user-menu.js
```

---

## 3. Production Code Inventory

Tất cả các file mã nguồn phục vụ trực tiếp quá trình vận hành của người dùng và backend:

### 3.1 Giao diện HTML (20 files)
| File | Vai trò / Tính năng | Layout Shell | Scripts nạp |
|---|---|---|---|
| `FE/index.html` | Trang chủ Landing Page đa ngành | Custom Landing Shell | `main.js`, `auth.js`, `dashboard.js`, `interview.js`, `components.js` |
| `FE/404.html` | Trang báo lỗi 404 Not Found | Standalone Shell | `core/auth.js` |
| `FE/features/about/about.html` | Giới thiệu nền tảng & Đội ngũ | Guest Shell | `main.js`, `auth.js`, `components.js` |
| `FE/features/admin/admin.html` | Trung tâm điều hành quản trị viên | Admin Shell (`admin.css`) | Inline modular admin JS |
| `FE/features/auth/auth.html` | Đăng nhập / Đăng ký tài khoản | Auth Shell | `main.js`, `auth.js`, `components.js` |
| `FE/features/dashboard/dashboard.html` | Bảng điều khiển chính của Candidate | Candidate Shell (`new-dashboard.css`) | `main.js`, `auth.js`, `dashboard.js`, `interview.js`, `components.js` |
| `FE/features/design-system/showcase.html` | Trang tra cứu UI components & tokens | Design System Preview | `shared/js/core/*`, `components/*`, `layout/*` |
| `FE/features/help/help.html` | Trung tâm Trợ giúp & FAQ | Guest Shell | `main.js`, `auth.js`, `components.js` |
| `FE/features/interview/history.html` | Lịch sử phỏng vấn & Kết quả cũ | Candidate Shell | `main.js`, `components.js`, `auth.js`, `dashboard.js` |
| `FE/features/interview/interview-info.html` | Wizard thiết lập phỏng vấn 4 bước | Candidate Shell | `avatar.js`, `main.js`, `auth.js`, `dashboard.js`, `interview.js`, `components.js` |
| `FE/features/interview/interview-practice.html` | Phòng phỏng vấn trực tiếp (Live HUD) | Executive Meeting Room (`interview-room.css`) | `components.js`, `auth.js`, `dashboard.js`, `avatar.js`, `main.js`, `interview.js` |
| `FE/features/jobs/jobs.html` | Khám phá cơ hội việc làm | Candidate Shell (`jobs.css`) | `main.js`, `auth.js`, `dashboard.js`, `interview.js`, `components.js` |
| `FE/features/payment/payment.html` | Thanh toán đơn hàng & Nâng cấp gói | Candidate Shell | `main.js`, `auth.js`, `dashboard.js`, `interview.js`, `components.js` |
| `FE/features/payment/pricing.html` | Bảng giá các gói dịch vụ | Guest Shell | `main.js`, `auth.js`, `components.js` |
| `FE/features/profile/cv.html` | Quản lý CV & Phân tích kỹ năng | Candidate Shell | `main.js`, `components.js`, `auth.js`, `dashboard.js` |
| `FE/features/profile/profile.html` | Hồ sơ năng lực ứng viên | Candidate Shell | `main.js`, `auth.js`, `dashboard.js`, `interview.js`, `components.js` |
| `FE/features/profile/settings.html` | Cài đặt tài khoản & Bảo mật | Candidate Shell | `main.js`, `components.js`, `auth.js`, `dashboard.js` |
| `FE/features/progress/progress.html` | Biểu đồ tiến độ rèn luyện năng lực | Candidate Shell | `Chart.js`, `main.js`, `auth.js`, `components.js` |
| `FE/features/qbank/qbank.html` | Ngân hàng câu hỏi theo ngành nghề | Candidate Shell (`qbank.css`) | `main.js`, `auth.js`, `components.js` |
| `FE/features/report/report.html` | Báo cáo đánh giá năng lực STAR chi tiết | Candidate Shell (`report.css`) | `components.js`, `auth.js`, `dashboard.js`, `report.js` |

### 3.2 Stylesheets CSS (14 files)
- **Shared CSS (7 files):** `tokens.css` (SSOT variables), `base.css` (Resets), `layout.css` (Containers), `components.css` (Buttons/Badges), `utilities.css` (Helpers), `landing.css` (Landing Hero/Showcase), `style.css` (Mega bundle).
- **Feature CSS (7 files):** `admin.css`, `new-dashboard.css`, `interview-info.css`, `interview-room.css`, `jobs.css`, `qbank.css`, `report.css`.

### 3.3 Client-Side JavaScript (18 files)
- **Feature JS (5 files):** `auth.js`, `dashboard.js`, `avatar.js`, `interview.js`, `report.js`.
- **Shared Main (2 files):** `components.js` (Custom Web Components), `main.js` (Core Runtime API, Gemini fallback, speech synthesis).
- **Shared Modular (11 files):** `core/auth.js` (dùng ở tất cả 20 trang), `core/storage.js`, `core/user.js`, `core/routing.js`, `layout/header.js`, `layout/sidebar.js`, `layout/user-menu.js`, `components/loading.js`, `components/modal.js`, `components/tabs.js`, `components/toast.js`.

### 3.4 Backend C# Codebase (136 active files)
- **Controllers (9):** `AdminController.cs`, `AIConfigurationController.cs`, `AIController.cs`, `AuthController.cs`, `CVController.cs`, `HealthController.cs`, `PaymentController.cs`, `ProfileController.cs`, `SessionsController.cs`.
- **Services (59):** Trải dài trên 10 domain: `AI/` (5), `Analysis/` (2), `Company/` (1), `Context/` (1), `Evaluation/` (10), `Interview/` (27), `Knowledge/` (5), `Preparation/` (2), `Question/` (1), `Security/` (2), `Storage/` (2), `FileDb.cs`.
- **Models & DTOs (45 active):** Định nghĩa cấu trúc dữ liệu phỏng vấn, STAR criteria, JobFamily, DTOs, Evaluation.
- **Prompts (12):** AI prompt templates cho Gemini/OpenAI.
- **Middleware & Config (3):** `RateLimitMiddleware.cs`, `AIConfiguration.cs`, `Program.cs`.

---

## 4. Test Inventory

Toàn bộ **15 file kiểm thử** trong repository được phân tích chi tiết:

| # | Đường dẫn hiện tại | Số dòng / Kích thước | Loại kiểm thử | Số Assertions | Đối tượng kiểm tra | Trạng thái hiện tại |
|---|---|---|---|---|---|---|
| 1 | `test_p14c_responsive.js` (Root) | 343 dòng / 17.8 KB | Static Regex/DOM | 19 checks | CSS Media queries trên 14 surfaces | **FAIL (16/19)** (Do tìm inline CSS trong `admin.html`) |
| 2 | `FE/features/accessibility/test_p14c_responsive.js` | 183 dòng / 11.9 KB | Static Regex/DOM | 19 checks | CSS Media queries trên 14 surfaces | **FAIL (16/19)** (Duplicate của file root, cùng lỗi `admin.html`) |
| 3 | `FE/features/accessibility/test_p14c_accessibility.js` | 231 dòng / 9.4 KB | Static Regex/DOM | 18 groups / 24 checks | WCAG, Focus, ARIA, Touch target | **FAIL (16/18)** (Tests 10 & 11 tìm inline CSS trong `admin.html`) |
| 4 | `FE/features/interview/test_industry_context.js` | 311 dòng / 13.6 KB | Static C#/Prompt | 54 assertions | `JobFamily.cs`, STAR Prompts, Context | **PASS (54/54)** |
| 5 | `FE/features/interview/test_p13_presentation.js` | 204 dòng / 17.3 KB | Static HTML/JS | 66 assertions | Report layout, Radar, STAR presentation | **PASS (66/66)** |
| 6 | `FE/features/interview/test_interview_setup_ux.js` | 227 dòng / 8.1 KB | Static HTML/CSS | 20 assertions | Setup Wizard Stepper, CV dropzone | **PASS (20/20)** |
| 7 | `FE/features/interview/test_live_interview_ux.js` | 213 dòng / 9.2 KB | Static HTML/CSS/JS | 12 assertions | HUD room, Camera grid, Visualizer | **PASS (12/12)** |
| 8 | `FE/features/interview/test_interview_flow.js` | 1638 dòng / 68.0 KB | VM Simulation | 30 assertions | State machine, TTS, API fallback | **PASS (30/30)** |
| 9 | `FE/features/report/test_report_ui.js` | 409 dòng / 19.8 KB | Static HTML/CSS/JS | 67 assertions | Report components, score badges | **PASS (67/67)** |
| 10 | `FE/features/interview/test_p14_navigation.js` | 257 dòng / 19.9 KB | Static HTML/JS | 10 assertions | Navigation links, Profile/Settings split | **PASS (10/10)** |
| 11 | `FE/features/interview/test_p15_r1_consistency.js` | 134 dòng / 7.8 KB | Static Tokens/CSS | 45 assertions | `tokens.css`, Button radius, Glow removal | **PASS (45/45)** |
| 12 | `FE/features/interview/test_p15_r2_ui_language.js` | 158 dòng / 10.3 KB | Static SVG/Font | 51 assertions | SVG replacements, Outfit font standard | **PASS (51/51)** |
| 13 | `FE/features/interview/test_p15_r3_product_fit.js` | 195 dòng / 10.5 KB | Static HTML/JS/C# | 17 assertions | Multi-industry switcher, STAR data | **PASS (17/17)** |
| 14 | `FE/features/interview/test_p15_r4_cleanup.js` | 183 dòng / 11.1 KB | Static File/DOM | 14 assertions | Extracted CSS, Orphan removal, HUD IDs | **PASS (14/14)** |
| 15 | `FE/features/interview/test_conversational_persona.js` | 197 dòng / 8.2 KB | Live HTTP Integration | 8 test cases | Cần backend live chạy trên cổng 5000 | **LIVE INTEGRATION** |

### Phát hiện đặc biệt quan trọng về Test Failures:
Cả 3 bài test fail hiện tại (`test_p14c_responsive.js`, `FE/features/accessibility/test_p14c_responsive.js`, `FE/features/accessibility/test_p14c_accessibility.js`) thực chất **không phải lỗi giao diện của sản phẩm**.
- Sản phẩm trong `FE/features/admin/admin.css` (dòng 675, 690, 707) **CÓ ĐẦY ĐỦ** các media queries `@media (max-width: 1024px)`, `@media (max-width: 768px)`, `@media (max-width: 480px)`.
- Tuy nhiên, 3 test script này được viết ở P1.4-C khi CSS còn inline trong `admin.html`. Khi P1.5-R4 tách CSS ra file riêng, test script chưa được cập nhật đường dẫn kiểm tra file `admin.css`.
- Đây là bằng chứng rõ ràng nhất cho thấy việc để test script nằm phân mảnh không có môi trường chung (`tests/helpers/test-env.js`) sẽ tạo ra false negative khi refactor CSS.

---

## 5. Documentation Inventory

Có **19 file Markdown** nằm tại thư mục gốc của repository:

| Nhóm tài liệu | File | Kích thước | Mục đích |
|---|---|---|---|
| **Design System** | `H2_DESIGN_SYSTEM.md` | 16.8 KB | Tài liệu thiết kế hệ thống H2 ban đầu |
| **P0 Baseline** | `P0.1_FULL_UI_UX_AUDIT.md` | 35.5 KB | Audit UI/UX toàn diện P0.1 |
| | `P0.1_FUNCTIONAL_INTEGRITY_AUDIT.md` | 12.8 KB | Kiểm toán toàn vẹn chức năng |
| | `P0.2_ARCHITECTURE_STABILIZATION_REPORT.md` | 9.4 KB | Báo cáo ổn định kiến trúc |
| **P1.1 - P1.2** | `P1.1_INTERVIEW_SETUP_RECONSTRUCTION_REPORT.md` | 20.8 KB | Tái cấu trúc Setup Wizard |
| | `P1.2_LIVE_INTERVIEW_UX_RECONSTRUCTION_REPORT.md` | 14.7 KB | Tái cấu trúc Live Interview |
| | `P1.2_POST_IMPLEMENTATION_LIFECYCLE_AUDIT.md` | 18.7 KB | Kiểm toán vòng đời phỏng vấn |
| **P1.3 Multi-Industry** | `P1.3_INDUSTRY_NEUTRAL_CONTENT_CONTEXT_AUDIT.md` | 51.2 KB | Kiểm toán đa ngành nghề |
| | `P1.3_WAVE_A_CONTEXT_CORE_REMEDIATION_REPORT.md` | 18.8 KB | Khắc phục ngữ cảnh đa ngành Wave A |
| | `P1.3_WAVE_B_EVALUATION_PRESENTATION_REMEDIATION_REPORT.md` | 23.9 KB | Khắc phục trình bày đánh giá Wave B |
| **P1.4 IA, Nav, A11y** | `P1.4_A_FULL_PRODUCT_UX_UI_REAUDIT.md` | 46.2 KB | Tái kiểm toán toàn sản phẩm |
| | `P1.4_B_INFORMATION_ARCHITECTURE_NAVIGATION_REMEDIATION.md` | 20.8 KB | Khắc phục kiến trúc thông tin |
| | `P1.4_C_ACCESSIBILITY_RESPONSIVE_REMEDIATION.md` | 15.7 KB | Khắc phục khả năng tiếp cận & responsive |
| **P1.5 Consistency** | `P1_5_FINAL_UX_UI_CONSISTENCY_AUDIT.md` | 37.3 KB | Kiểm toán nhất quán toàn diện P1.5 |
| | `P1_5_R1_DESIGN_SYSTEM_SHELL_REMEDIATION.md` | 11.0 KB | Khắc phục Design System & Shell |
| | `P1_5_R2_UI_LANGUAGE_ICONOGRAPHY_REMEDIATION.md` | 11.0 KB | Khắc phục Ngôn ngữ UI & Icons |
| | `P1_5_R3_PRODUCT_FIT_MULTI_INDUSTRY_REMEDIATION.md` | 8.5 KB | Khắc phục Định vị đa ngành Landing |
| | `P1_5_R4_CLEANUP_LEGACY_REMEDIATION.md` | 14.0 KB | Khắc phục Dọn dẹp & CSS inline |
| | `P1_5_FINAL_ACCEPTANCE_REVIEW.md` | 17.6 KB | Báo cáo nghiệm thu cuối cùng P1.5 |

Tất cả 19 files này là bằng chứng nghiệm thu lịch sử (audit trail) cực kỳ giá trị, **tuyệt đối không được xóa**, nhưng cần được tổ chức vào cây thư mục `docs/phases/` để giải phóng root directory.

---

## 6. Duplicate Analysis

1. **`test_p14c_responsive.js` (Root) vs `FE/features/accessibility/test_p14c_responsive.js`:**
   - Hai file này gần như giống nhau từng dòng code kiểm tra 19 assertions.
   - File ở root là bản sao chép thử nghiệm (draft copy) bị bỏ quên.
2. **Modular JS vs Monolithic Components:**
   - `FE/shared/js/components.js` định nghĩa Web Components (`<app-header>`, `<app-sidebar>`).
   - Trong khi đó, `FE/shared/js/components/` chứa `modal.js`, `toast.js`, `loading.js`, `tabs.js` chỉ được dùng bởi `showcase.html`.
   - `FE/shared/js/main.js` (120 KB) lại định nghĩa thêm các hàm popup, toast, modal độc lập bên trong chính nó.
3. **Candidate Shell CSS:**
   - `new-dashboard.css` chứa các luật cho `.sidebar-new`, `.main-content-new`, `.top-header`.
   - Các page `jobs.html`, `qbank.html`, `admin.html` vừa import `new-dashboard.css`, vừa định nghĩa lại một số luật override cho main content.

---

## 7. Dead / Orphan Analysis

1. **`BE/Models/Common/ApiResponse.cs` & `BE/Models/Common/ErrorResponse.cs`:**
   - Dung lượng: **0 bytes** (hoàn toàn rỗng).
   - Tham chiếu: **0 references** trong toàn bộ code C#.
   - Đánh giá: **CONFIRMED DEAD STUBS**. Cần xóa an toàn.
2. **`test_p14c_responsive.js` (Root):**
   - Đánh giá: **CONFIRMED DUPLICATE / OBSOLETE**. Bản canonical nằm trong thư mục accessibility.
3. **Thư mục `bin/` tại root:**
   - Dung lượng: **0 files**.
   - Đánh giá: **CONFIRMED EMPTY ARTIFACT**. Cần xóa.
4. **Thư mục `FE/features/accessibility/`:**
   - Chứa: Chỉ có 2 test files `test_p14c_accessibility.js` và `test_p14c_responsive.js`.
   - Không chứa bất kỳ HTML, CSS, hay JS production nào.
   - Đánh giá: **MISPLACED FEATURE FOLDER**. Thư mục này bản chất là thư mục test, không phải feature của ứng dụng. Sau khi di chuyển test, thư mục này sẽ trở thành rỗng và cần được gỡ bỏ.

---

## 8. CSS Ownership Analysis

Cấu trúc CSS hiện tại và phân định ownership:
1. **Design Tokens (`FE/shared/css/tokens.css`):**
   - **Owner:** Design System.
   - **Nhiệm vụ:** Single Source of Truth cho biến màu sắc, kích thước, font, bo góc `--pm-*`. Không chứa style cho bất kỳ selector component cụ thể nào.
2. **Global Framework Bundle (`FE/shared/css/style.css`):**
   - **Owner:** Global Shell.
   - **Nhiệm vụ:** Nạp các module shared qua `@import`, cung cấp typography cơ sở, header/navbar dùng chung, glassmorphism card, và các tiện ích toàn cục.
3. **Candidate Shell (`FE/features/dashboard/new-dashboard.css`):**
   - **Owner:** Candidate Portal Shell.
   - **Thực tế:** Được 13 trang sử dụng như khung layout mặc định (sidebar co giãn, header cá nhân, responsive grid).
   - **Khuyến nghị:** Trong tương lai có thể đổi tên thành `candidate-shell.css`, tuy nhiên để tránh blast radius cho Phase A/B, cần giữ nguyên đường dẫn hoặc sử dụng alias an toàn.
4. **Feature Stylesheets:**
   - `interview-room.css`: Chuyên biệt cho buồng phỏng vấn Live HUD (camera, waveform, transcript drawer).
   - `interview-info.css`: Chuyên biệt cho Setup Wizard 4 bước.
   - `report.css`: Chuyên biệt cho bảng điểm và phân tích năng lực STAR.
   - `jobs.css`, `qbank.css`, `admin.css`: Được trích xuất độc lập từ R4.
   - `landing.css`: Chuyên biệt cho Showcase đa ngành và Hero Landing Page.

---

## 9. JavaScript Ownership Analysis

1. **`FE/shared/js/main.js` (2,683 lines):**
   - Đóng vai trò là Runtime Engine phía client.
   - Chứa: Cấu hình `API_BASE_URL`, hàm gọi client-side Gemini fallback (`callGeminiAPI`), audio visualizer, điều khiển âm lượng, timer đếm ngược, và các handler tương tác giao diện.
   - **Đánh giá:** File có kích thước lớn nhưng có tính phụ thuộc cao (coupling cao với hầu hết các trang HTML). **Tuyệt đối không rewrite hoặc chia nhỏ tùy tiện** trong đợt refactor cấu trúc này để bảo vệ runtime.
2. **`FE/features/interview/interview.js` (118 KB):**
   - Chứa toàn bộ máy trạng thái phỏng vấn (Interview State Machine), ghi âm Web Speech API, phát âm giọng nói (TTS), xử lý phản hồi AI theo lượt.
   - **Đánh giá:** Lõi kinh doanh phỏng vấn. **Được đóng băng (FROZEN)** theo quy tắc Section 26.
3. **`FE/shared/js/core/auth.js`:**
   - Cung cấp đối tượng `window.PM_Auth` kiểm tra token, quyền hạn và chuyển hướng đăng nhập.
   - Được nạp và tin cậy bởi toàn bộ 20 trang HTML.

---

## 10. HTML Structure Analysis

- **Entry point:** `FE/index.html` được phục vụ ở root `/` thông qua ASP.NET Core `app.UseDefaultFiles()`.
- **Đường dẫn feature:** Toàn bộ các trang con nằm trong cấu trúc `/features/{feature_name}/{feature_name}.html`.
- **Cấu hình Redirect:** Backend `Program.cs` (dòng 167) có redirect cứng:
  `/auth.html` → `/features/auth/auth.html`.
- **Kết luận:** Cấu trúc đặt các file `.html` trong `FE/features/` hiện tại đang hoạt động đồng bộ với routing tĩnh của backend ASP.NET Core. **Không nên thay đổi vị trí của các file HTML** để tránh làm đứt gãy routing và URL bookmark của người dùng.

---

## 11. Backend Structure Analysis

Backend ASP.NET Core 10 được cấu trúc theo mô hình phân tầng hướng dịch vụ (Service-Oriented Architecture) rất rõ ràng:
- **`Controllers/` (9):** Nhận HTTP request, kiểm tra Model State và chuyển giao xử lý cho Services.
- **`Services/` (59):** Chia module logic nghiệp vụ sâu: AI, Phân tích năng lực (Analysis), Đánh giá STAR (Evaluation), Phỏng vấn thích ứng (Adaptive Interview Engine), Trí tuệ doanh nghiệp (Company Intelligence), Lưu trữ FileDb.
- **`Models/` (47):** Dữ liệu strongly-typed chia theo domain.
- **`Prompts/` (12):** Quản lý prompts AI độc lập.
- **Tính an toàn:** Backend build thành công 0 Warning / 0 Error. Ngoại trừ việc loại bỏ 2 file rỗng `ApiResponse.cs` và `ErrorResponse.cs`, **không cần di dời bất kỳ file C# nào trong backend**.

---

## 12. Proposed Target Structure

Thiết kế cấu trúc mục tiêu sau khi chuẩn hóa: Tách biệt hoàn toàn `tests/` và `docs/` ra khỏi production tree:

```text
PrepMate/
├── .gitignore
├── .vscode/
│   └── settings.json
├── README.md                                  <-- Root project overview & navigation map
│
├── docs/                                      <-- Centralized Documentation
│   ├── architecture/
│   │   └── H2_DESIGN_SYSTEM.md
│   └── phases/                                <-- Preserved Historical Audit Reports
│       ├── p0/
│       │   ├── P0.1_FULL_UI_UX_AUDIT.md
│       │   ├── P0.1_FUNCTIONAL_INTEGRITY_AUDIT.md
│       │   └── P0.2_ARCHITECTURE_STABILIZATION_REPORT.md
│       ├── p1_1_p1_2/
│       │   ├── P1.1_INTERVIEW_SETUP_RECONSTRUCTION_REPORT.md
│       │   ├── P1.2_LIVE_INTERVIEW_UX_RECONSTRUCTION_REPORT.md
│       │   └── P1.2_POST_IMPLEMENTATION_LIFECYCLE_AUDIT.md
│       ├── p1_3/
│       │   ├── P1.3_INDUSTRY_NEUTRAL_CONTENT_CONTEXT_AUDIT.md
│       │   ├── P1.3_WAVE_A_CONTEXT_CORE_REMEDIATION_REPORT.md
│       │   └── P1.3_WAVE_B_EVALUATION_PRESENTATION_REMEDIATION_REPORT.md
│       ├── p1_4/
│       │   ├── P1.4_A_FULL_PRODUCT_UX_UI_REAUDIT.md
│       │   ├── P1.4_B_INFORMATION_ARCHITECTURE_NAVIGATION_REMEDIATION.md
│       │   └── P1.4_C_ACCESSIBILITY_RESPONSIVE_REMEDIATION.md
│       └── p1_5/
│           ├── P1_5_FINAL_ACCEPTANCE_REVIEW.md
│           ├── P1_5_FINAL_UX_UI_CONSISTENCY_AUDIT.md
│           ├── P1_5_R1_DESIGN_SYSTEM_SHELL_REMEDIATION.md
│           ├── P1_5_R2_UI_LANGUAGE_ICONOGRAPHY_REMEDIATION.md
│           ├── P1_5_R3_PRODUCT_FIT_MULTI_INDUSTRY_REMEDIATION.md
│           ├── P1_5_R4_CLEANUP_LEGACY_REMEDIATION.md
│           └── P1_5_FR_REFACTOR_PLAN.md
│
├── tests/                                     <-- Dedicated Clean Test Tree
│   ├── README.md                              <-- Test guide, commands, categories
│   ├── run-all.js                             <-- Master CLI test runner
│   ├── helpers/
│   │   └── test-env.js                        <-- Universal path resolver & test helpers
│   ├── regression/
│   │   ├── industry-context.test.js           <-- (was test_industry_context.js)
│   │   ├── interview-flow.test.js             <-- (was test_interview_flow.js)
│   │   ├── interview-setup-ux.test.js         <-- (was test_interview_setup_ux.js)
│   │   ├── live-interview-ux.test.js          <-- (was test_live_interview_ux.js)
│   │   ├── p13-presentation.test.js           <-- (was test_p13_presentation.js)
│   │   ├── p14-navigation.test.js             <-- (was test_p14_navigation.js)
│   │   └── report-ui.test.js                  <-- (was test_report_ui.js)
│   ├── accessibility/
│   │   └── accessibility.test.js              <-- (was test_p14c_accessibility.js)
│   ├── responsive/
│   │   └── responsive.test.js                 <-- (was test_p14c_responsive.js)
│   ├── p1_5/
│   │   ├── r1-consistency.test.js             <-- (was test_p15_r1_consistency.js)
│   │   ├── r2-ui-language.test.js             <-- (was test_p15_r2_ui_language.js)
│   │   ├── r3-product-fit.test.js             <-- (was test_p15_r3_product_fit.js)
│   │   └── r4-cleanup.test.js                 <-- (was test_p15_r4_cleanup.js)
│   └── integration/
│       └── conversational-persona.test.js     <-- (was test_conversational_persona.js)
│
├── BE/                                        <-- Pure Backend Code (Clean .NET)
│   └── ... (Tất cả C# source, Models, Services, Controllers được bảo tồn nguyên vẹn)
│
└── FE/                                        <-- Pure Production Frontend (Zero Test Files)
    ├── 404.html
    ├── index.html
    ├── manifest.json
    ├── features/                              <-- 12 Real Production Features
    │   ├── about/
    │   ├── admin/
    │   ├── auth/
    │   ├── dashboard/
    │   ├── design-system/
    │   ├── help/
    │   ├── interview/                         <-- Pure prod code (Cleaned of 11 test files)
    │   ├── jobs/
    │   ├── payment/
    │   ├── profile/
    │   ├── progress/
    │   ├── qbank/
    │   └── report/                            <-- Pure prod code (Cleaned of 1 test file)
    └── shared/
        ├── css/
        ├── images/
        └── js/
```

---

## 13. Files To Move

| File nguồn | Thư mục đích | Lý do di chuyển |
|---|---|---|
| `FE/features/interview/test_industry_context.js` | `tests/regression/` | Tách biệt kiểm thử khỏi feature |
| `FE/features/interview/test_p13_presentation.js` | `tests/regression/` | Tách biệt kiểm thử khỏi feature |
| `FE/features/interview/test_interview_setup_ux.js` | `tests/regression/` | Tách biệt kiểm thử khỏi feature |
| `FE/features/interview/test_live_interview_ux.js` | `tests/regression/` | Tách biệt kiểm thử khỏi feature |
| `FE/features/interview/test_interview_flow.js` | `tests/regression/` | Tách biệt kiểm thử khỏi feature |
| `FE/features/interview/test_p14_navigation.js` | `tests/regression/` | Tách biệt kiểm thử khỏi feature |
| `FE/features/report/test_report_ui.js` | `tests/regression/` | Tách biệt kiểm thử khỏi feature |
| `FE/features/accessibility/test_p14c_accessibility.js` | `tests/accessibility/` | Tách biệt kiểm thử khỏi feature |
| `FE/features/accessibility/test_p14c_responsive.js` | `tests/responsive/` | Tách biệt kiểm thử khỏi feature |
| `FE/features/interview/test_p15_r1_consistency.js` | `tests/p1_5/` | Tách biệt kiểm thử khỏi feature |
| `FE/features/interview/test_p15_r2_ui_language.js` | `tests/p1_5/` | Tách biệt kiểm thử khỏi feature |
| `FE/features/interview/test_p15_r3_product_fit.js` | `tests/p1_5/` | Tách biệt kiểm thử khỏi feature |
| `FE/features/interview/test_p15_r4_cleanup.js` | `tests/p1_5/` | Tách biệt kiểm thử khỏi feature |
| `FE/features/interview/test_conversational_persona.js` | `tests/integration/` | Phân loại đúng bài test cần live server |
| Toàn bộ 19 file `*.md` tại root | `docs/phases/{p0,p1_1_p1_2,p1_3,p1_4,p1_5}/` | Làm sạch root directory, bảo lưu audit trail |

---

## 14. Files To Rename

Chuẩn hóa tên file kiểm thử sang định dạng `kebab-case.test.js`:
- `test_industry_context.js` → `industry-context.test.js`
- `test_interview_flow.js` → `interview-flow.test.js`
- `test_interview_setup_ux.js` → `interview-setup-ux.test.js`
- `test_live_interview_ux.js` → `live-interview-ux.test.js`
- `test_p13_presentation.js` → `p13-presentation.test.js`
- `test_p14_navigation.js` → `p14-navigation.test.js`
- `test_report_ui.js` → `report-ui.test.js`
- `test_p14c_accessibility.js` → `accessibility.test.js`
- `test_p14c_responsive.js` → `responsive.test.js`
- `test_p15_r1_consistency.js` → `r1-consistency.test.js`
- `test_p15_r2_ui_language.js` → `r2-ui-language.test.js`
- `test_p15_r3_product_fit.js` → `r3-product-fit.test.js`
- `test_p15_r4_cleanup.js` → `r4-cleanup.test.js`
- `test_conversational_persona.js` → `conversational-persona.test.js`

*Lưu ý:* Các file HTML, CSS và JS của production **KHÔNG RENAME** để bảo đảm tính tương thích tuyệt đối cho các liên kết `<a href>`, `<link href>`, `<script src>` và routes backend.

---

## 15. Files To Merge

- **Không thực hiện merge bất kỳ file production nào trong wave này.**
- Lý do: Mỗi module JS (`interview.js`, `dashboard.js`, `report.js`, `auth.js`) và CSS (`admin.css`, `jobs.css`, `qbank.css`) đều có vòng đời riêng và người chịu trách nhiệm rõ ràng. Việc cố ép merge các file sẽ phá vỡ nguyên tắc Golden Rule "Behavior Must Not Change".

---

## 16. Files To Delete

Chỉ xóa các file đã được chứng minh 100% là rác/mồ côi/trùng lặp:
1. `test_p14c_responsive.js` (tại root): File draft bị trôi nổi và không còn sử dụng.
2. `BE/Models/Common/ApiResponse.cs`: 0 bytes, 0 references.
3. `BE/Models/Common/ErrorResponse.cs`: 0 bytes, 0 references.
4. Thư mục `bin/` tại root: Thư mục rỗng không dùng.
5. Thư mục `FE/features/accessibility/`: Sau khi di chuyển 2 test files, thư mục này sẽ trống và được gỡ bỏ.

---

## 17. Files To Keep

- **100% Production HTML (20 files)**
- **100% Production CSS (14 files)**
- **100% Production JS (18 files)**
- **100% Production Backend C# (134 active files)**
- **100% Assets & Images (3 files)**
- **100% Database SQL & Configs (5 files)**
- **100% Historical Test Suites (14 suites di dời và chuẩn hóa đường dẫn)**

---

## 18. Dependency & Reference Risks

| Rủi ro tiềm ẩn | Mức độ | Nguyên nhân | Biện pháp kiểm soát & Phòng ngừa |
|---|---|---|---|
| **Lỗi đường dẫn trong Test Scripts** | **RẤT CAO** | Các test script hiện tại sử dụng `path.join(__dirname, '../..')`. Khi chuyển sang `tests/`, `__dirname` sẽ thay đổi độ sâu thư mục. | Xây dựng helper `tests/helpers/test-env.js` cung cấp hàm `getRepoPath(relativePath)` dựa trên `git root` hoặc vị trí cố định của project root. |
| **Lỗi kiểm tra Media Query trong Admin** | **CAO** | `accessibility.test.js` và `responsive.test.js` tìm media query trong `admin.html` thay vì `admin.css`. | Cập nhật assertion trong 2 bài test này để đọc cả `adminHtml` và `adminCss`. |
| **Đứt gãy ASP.NET Static Files Routing** | **TRUNG BÌNH** | Nếu di dời file HTML hoặc CSS của production, ASP.NET Core sẽ trả về 404. | **Giữ nguyên 100% vị trí các file production trong `FE/`**. Không di dời file HTML nào. |
| **Đứt gãy liên kết Document trong Reports** | **THẤP** | Các link giữa các markdown report có thể bị ảnh hưởng nếu chuyển vào `docs/phases/`. | Đặt file `docs/README.md` và root `README.md` với index map rõ ràng. |

---

## 19. Test Migration Plan (Cho Phase B)

Quá trình di dời test code phải được tiến hành theo các bước kiểm soát nghiêm ngặt:
1. **Bước 1: Khởi tạo khung thư mục `tests/`**
   Tạo các thư mục con: `tests/regression/`, `tests/accessibility/`, `tests/responsive/`, `tests/p1_5/`, `tests/integration/`, `tests/helpers/`.
2. **Bước 2: Viết module chuẩn hóa môi trường `test-env.js`**
   ```javascript
   // tests/helpers/test-env.js
   const path = require('path');
   const rootDir = path.resolve(__dirname, '../..');
   module.exports = {
     rootDir,
     resolvePath: (rel) => path.join(rootDir, rel),
     read: (rel) => require('fs').readFileSync(path.join(rootDir, rel), 'utf8')
   };
   ```
3. **Bước 3: Di dời và cập nhật từng file kiểm thử**
   - Di dời từng file, thay thế các phép tính `path.join(__dirname, ...)` bằng `testEnv.resolvePath(...)`.
   - Cập nhật `responsive.test.js` và `accessibility.test.js` nạp đúng `admin.css` để 19/19 và 18/18 checks đều PASS.
4. **Bước 4: Tạo Test Runner tập trung `tests/run-all.js`**
   Cho phép chạy toàn bộ 13 test suites chỉ bằng 1 lệnh duy nhất: `node tests/run-all.js`.
5. **Bước 5: Lập tài liệu hướng dẫn `tests/README.md`**

---

## 20. Regression Plan

Sau khi hoàn thành di dời mã nguồn ở Phase B, toàn bộ regression test suite phải được thực thi lại:
1. **Tiêu chí số lượng:** Tối thiểu **429 assertions PASS (100%)**.
2. **Khắc phục false-negatives:** Do `admin.css` được nạp đúng vào bài kiểm tra responsive và accessibility, tổng số assertions pass thực tế dự kiến sẽ đạt chuẩn đầy đủ 100% mà không còn bất kỳ failure nào.
3. **Kiểm tra Backend:** `dotnet build BE/backend.csproj` phải đạt **0 Warning / 0 Error**.
4. **Kiểm tra Assets & Links:** Xác nhận toàn bộ 20 trang HTML tải đúng CSS/JS và không phát sinh lỗi 404 trên console.

---

## 21. Risk Assessment

| Hạng mục rủi ro | Xác suất | Tác động | Chiến lược xử lý |
|---|---|---|---|
| Làm thay đổi hành vi người dùng (User-facing regression) | Cực thấp | Thảm họa | Tuân thủ tuyệt đối Golden Rule: Chỉ di dời test và dọn dẹp file thừa, không sửa logic nghiệp vụ, không thay đổi DOM HTML production. |
| Làm hỏng các file test cũ | Cao | Nghiêm trọng | Kiểm tra từng test suite ngay sau khi di chuyển. So sánh kết quả trước và sau khi refactor. |
| Mất lịch sử git blame | Trung bình | Vừa | Sử dụng thao tác `git mv` thay vì copy-paste để bảo toàn commit history. |

---

## 22. Expected Final Structure

Khi hoàn thành toàn bộ Phase B, PrepMate sẽ có diện mạo của một codebase chuẩn công nghiệp (enterprise standard):
- Root sạch sẽ, chỉ chứa config thiết yếu và `README.md`.
- `FE/` hoàn toàn là production code, không lẫn bất kỳ file test nào.
- `tests/` là trung tâm duy nhất cho QA/Tester với cấu trúc phân tầng rõ ràng, có runner và tài liệu hướng dẫn cụ thể.
- `docs/` lưu trữ toàn bộ biên bản audit theo từng phase một cách khoa học.
- `BE/` loại bỏ triệt để file rác, build sạch 0 lỗi.

---

## 23. Refactor Acceptance Criteria

Để Phase B được nghiệm thu (Accepted & Sealed), kế hoạch refactor phải thỏa mãn đầy đủ **8 Structural Quality Gates**:

- [ ] **Gate A — Organization:** Không còn bất kỳ file test nào nằm trong `FE/features/` hoặc root. Toàn bộ test nằm dưới `tests/`.
- [ ] **Gate B — Ownership:** Mỗi file CSS/JS có chủ thể rõ ràng. Không có thư mục feature giả lập như `FE/features/accessibility/`.
- [ ] **Gate C — Dead Code:** Toàn bộ confirmed dead files (`ApiResponse.cs`, `ErrorResponse.cs`, root `bin/`, draft `test_p14c_responsive.js`) được xóa an toàn.
- [ ] **Gate D — Duplication:** Không còn duplicate test scripts.
- [ ] **Gate E — Naming:** Toàn bộ test files tuân thủ chuẩn `kebab-case.test.js`.
- [ ] **Gate F — Dependencies:** Mọi relative path trong test resolver đều trỏ chính xác về repository root.
- [ ] **Gate G — Behavior:** Không có bất kỳ thay đổi nào về giao diện, luồng phỏng vấn, API contract hay logic nghiệp vụ.
- [ ] **Gate H — Tests & Build:** Chạy `node tests/run-all.js` đạt 100% PASS; `dotnet build BE/backend.csproj` đạt 0 Warnings / 0 Errors.

---

### KẾT LUẬN PHASE A:
Kế hoạch tái cấu trúc **P1.5-FR Phase A** đã hoàn thành việc audit toàn diện 100% repository, phân loại từng file, định vị rủi ro và xác lập cấu trúc mục tiêu rõ ràng.
Tuân thủ nghiêm ngặt chỉ thị, **không có bất kỳ dòng mã production nào bị thay đổi**. Hệ thống sẵn sàng chờ phê duyệt để bước vào Phase B.
