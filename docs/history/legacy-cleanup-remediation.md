# PREPMATE — P1.5-R4: DỌN DẸP & XỬ LÝ CODE LEGACY (CLEANUP & LEGACY REMEDIATION REPORT)

**Phase:** P1.5 — Final UX/UI Consistency  
**Wave:** R4 — Cleanup & Legacy Remediation  
**Status:** **ACCEPTED / COMPLETE** (P1.5 Remains OPEN)  
**Date:** October 7, 2026  
**Scope:** Remediation of `CONSIST-04` (Orphan Code & Compatibility Graveyard) and `CONSIST-09` (Massive Inlined Stylesheets)

---

## 1. Tổng quan

Wave **P1.5-R4** là bước hoàn thiện cuối cùng trong chuỗi 4 đợt remediation của Phase **P1.5 Final UX/UI Consistency**. Mục tiêu duy nhất của R4 là:
1. **Loại bỏ triệt để code/CSS/markup mồ côi (Orphan Code & Compatibility Graveyard — `CONSIST-04`):** Đã được kiểm chứng không còn bất kỳ consumer hay runtime/test dependency nào.
2. **Trích xuất các khối CSS inline khổng lồ sang modular stylesheet sở hữu (`CONSIST-09`):** Đưa toàn bộ style của `jobs.html`, `qbank.html`, và `admin.html` về các file CSS chuyên trách (`jobs.css`, `qbank.css`, `admin.css`), cho phép browser caching tối ưu và dọn sạch hàng nghìn dòng CSS nhúng trực tiếp trong HTML.
3. **Bảo tồn 100% tính tương thích ngược và cấu trúc runtime:** Giữ nguyên các alias cần thiết (`--color-*`, `--radius-*`, `--shadow-*`) trong `tokens.css`, không đụng chạm backend, database, interview engine hay business logic.

---

## 2. Baseline trước khi xử lý (Pre-remediation Baseline)

Trước khi thực hiện bất kỳ chỉnh sửa nào trong R4, hệ thống đã được kiểm tra nghiêm ngặt:
- **Baseline Automated Regression:** **415 / 415 assertions PASS** qua 12 test suites liên tục:
  - `test_industry_context.js` (54/54 PASS)
  - `test_p13_presentation.js` (66/66 PASS)
  - `test_interview_setup_ux.js` (20/20 PASS)
  - `test_live_interview_ux.js` (12/12 PASS)
  - `test_interview_flow.js` (30/30 PASS)
  - `test_report_ui.js` (67/67 PASS)
  - `test_p14_navigation.js` (10/10 PASS)
  - `test_p14c_accessibility.js` (18/18 PASS)
  - `test_p14c_responsive.js` (7/7 PASS)
  - `test_p15_r1_consistency.js` (45/45 PASS)
  - `test_p15_r2_ui_language.js` (51/51 PASS)
  - `test_p15_r3_product_fit.js` (17/17 PASS)
- **Backend .NET Build Baseline:** `dotnet build BE/backend.csproj` → **0 Warning(s), 0 Error(s)**.

---

## 3. Audit & Xử lý CONSIST-04: Orphan Code & Compatibility Graveyard

Mọi thành phần trước khi xóa đều trải qua quy trình xác minh nghiêm ngặt theo 5 phân loại: `LIVE`, `LEGACY BUT REQUIRED`, `INTENTIONAL EXCEPTION`, `ORPHAN / DEAD`, `UNCERTAIN`.

| Thành phần | File | Phân loại | Bằng chứng kiểm tra | Hành động |
|---|---|---|---|---|
| `elevenlabs-key-input` DOM query & scripts | `FE/features/dashboard/dashboard.html` | **ORPHAN / DEAD** | Input không tồn tại trong DOM của `dashboard.html`. Cấu hình voice đã được chuyển sang `settings.html`. Không có JS handler nào khác gọi tới. | **ĐÃ XÓA** |
| `saveElevenLabsKey()`, `toggleElevenLabsKeyVisibility()`, `updateElevenLabsKeyStatus()` | `FE/features/dashboard/dashboard.html` | **ORPHAN / DEAD** | Các hàm xử lý voice key mồ côi nằm cuối script `dashboard.html`, không có button/input tương ứng. | **ĐÃ XÓA** |
| `<!-- Hidden Compatibility Elements for JS Engine -->` (`display: none` dummy block ~70 dòng) | `FE/features/interview/interview-practice.html` | **ORPHAN / DEAD** | Khối node giả (`ai-mode-badge`, `user-dropdown`, dummy `setup-container`, dummy `free-tier-banner`, dummy `cv-analysis-panel`, dummy `upload-box`) từ các prototype cũ. `interview.js` hiện tại đã có defensive null checks `if (elem)`. Toàn bộ 58 ID chính thống của Live Interview HUD được bảo toàn. | **ĐÃ XÓA** |
| Hidden API key boxes (`api-key-box`, Gemini & ElevenLabs) & orphan `</div>` | `FE/features/profile/profile.html` | **ORPHAN / DEAD** | 2 box bị ẩn nằm ngoài `<main>`, đóng kèm thẻ `</div>` thừa ở dòng 48 làm vỡ DOM hierarchy. Nút bấm gọi hàm không tồn tại (`toggleApiKeyVisibility`). | **ĐÃ XÓA** |
| Dead API key load/save logic trong `profile.html` | `FE/features/profile/profile.html` | **ORPHAN / DEAD** | Script đọc `gemini_api_key` và `elevenlabs_api_key` trong `initProfilePage`, cùng các hàm `toggleElevenLabsKeyVisibility`, `saveElevenLabsKey`. Profile hiện tại là Account Center cá nhân (Hồ sơ năng lực). | **ĐÃ XÓA** |
| Backward-compatible CSS aliases (`--color-*`, `--radius-*`, `--shadow-*`) | `FE/shared/css/tokens.css` | **LEGACY BUT REQUIRED** | Vẫn được sử dụng bởi các component và test suite kiểm tra backward compatibility (R1 gate). | **GIỮ NGUYÊN (REQUIRED)** |
| 58 DOM IDs trong Live Interview HUD | `FE/features/interview/interview-practice.html` | **LIVE** | Được kiểm tra và phụ thuộc bởi `test_live_interview_ux.js` (Top HUD, Audio Wave, Countdown, Camera, Transcript Drawer...). | **GIỮ NGUYÊN (LIVE)** |

---

## 4. Audit & Xử lý CONSIST-09: Massive Inlined Stylesheets

### 4.1 Hiện trạng phát hiện
Kiểm tra toàn bộ hệ thống HTML cho thấy 3 trang chức năng mang khối lượng CSS nhúng `<style>` cực lớn:
1. `FE/features/jobs/jobs.html`: **939 dòng CSS** nhúng trong `<style>`.
2. `FE/features/qbank/qbank.html`: **948 dòng CSS** nhúng trong `<style>`.
3. `FE/features/admin/admin.html`: **720 dòng CSS** nhúng trong `<style>`.

Tổng cộng hơn **2.600 dòng CSS** inline làm phình to dung lượng truyền tải HTML và ngăn cản trình duyệt tận dụng HTTP caching.

### 4.2 Phương án trích xuất & Quyền sở hữu (Ownership)
Thực hiện trích xuất theo nguyên tắc:
- Không tạo các file gom tụ vô nghĩa (`mega.css`, `everything.css`).
- Mỗi trang chức năng sở hữu stylesheet độc lập tương ứng:
  - `FE/features/jobs/jobs.html` → trích xuất sang `FE/features/jobs/jobs.css` (937 dòng), liên kết qua `<link rel="stylesheet" href="./jobs.css?v=26">`.
  - `FE/features/qbank/qbank.html` → trích xuất sang `FE/features/qbank/qbank.css` (946 dòng), liên kết qua `<link rel="stylesheet" href="./qbank.css?v=26">`.
  - `FE/features/admin/admin.html` → trích xuất sang `FE/features/admin/admin.css` (718 dòng), liên kết qua `<link rel="stylesheet" href="./admin.css?v=26">`.
- Khối token binding tối giản (`:root { ... }`) được giữ lại nhẹ nhàng trong `<head>` của từng trang để bảo đảm 100% tương thích với các assertion token mapping trong `test_p15_r1_consistency.js`.

---

## 5. Danh sách các file ĐÃ THAY ĐỔI

1. `FE/features/dashboard/dashboard.html`: Loại bỏ scripts và event handlers mồ côi liên quan đến ElevenLabs voice key.
2. `FE/features/interview/interview-practice.html`: Loại bỏ khối dummy compatibility elements 70 dòng ẩn; làm sạch DOM phòng phỏng vấn thực chiến.
3. `FE/features/profile/profile.html`: Loại bỏ khối thẻ ẩn mồ côi, xóa thẻ `</div>` thừa, dọn sạch code API key không còn phục vụ trang Hồ sơ cá nhân.
4. `FE/features/jobs/jobs.html`: Trích xuất 939 dòng CSS inline sang `jobs.css`; chèn `<link rel="stylesheet" href="./jobs.css?v=26">`.
5. `FE/features/qbank/qbank.html`: Trích xuất 948 dòng CSS inline sang `qbank.css`; chèn `<link rel="stylesheet" href="./qbank.css?v=26">`.
6. `FE/features/admin/admin.html`: Trích xuất 720 dòng CSS inline sang `admin.css`; chèn `<link rel="stylesheet" href="./admin.css?v=26">`.
7. `FE/features/jobs/jobs.css`: **[FILE MỚI]** Stylesheet mô-đun hóa cho trang Cơ hội việc làm & Matching JD.
8. `FE/features/qbank/qbank.css`: **[FILE MỚI]** Stylesheet mô-đun hóa cho Ngân hàng câu hỏi tuyển dụng & Core Knowledge.
9. `FE/features/admin/admin.css`: **[FILE MỚI]** Stylesheet mô-đun hóa cho Trung tâm quản trị & Điều hành hệ thống.
10. `FE/features/interview/test_p15_r4_cleanup.js`: **[FILE MỚI]** Test suite kiểm thử tự động riêng cho R4 (14/14 PASS).

---

## 6. Danh sách các file & phân vùng TUYỆT ĐỐI KHÔNG THAY ĐỔI

Bảo đảm giữ nguyên trạng 100%:
- **Toàn bộ Backend (`BE/`):** Controllers, Services, Models, DTOs, Repository.
- **API Contracts & Network Protocol:** Endpoint URLs, request/response formats.
- **Interview Runtime State Machine:** Lifecycle, question branching, answer telemetry, score calculation.
- **Speech & Audio Lifecycle:** Web Speech API, TTS, Hands-free controls.
- **Authentication & Security:** JWT tokens, role authorization, login/register state.
- **Database:** Entities, migrations, seed data.

---

## 7. Kiểm tra Visual Regression

Kiểm tra trực quan trên các breakpoint tiêu chuẩn bảo đảm **0% visual drift**:
- **1440px (Desktop Wide):** Grid layout của Jobs, QBank, Admin hiển thị hoàn hảo; spacing, breadcrumb và action controls giữ nguyên tỷ lệ.
- **1280px (Standard Desktop):** Phòng phỏng vấn HUD, camera grid, candidate preview, modal chi tiết JD khớp 1:1 với baseline.
- **1024px (Tablet Landscape):** Sidebar co giãn mượt mà; filter panel trên Jobs và QBank xuống dòng hợp lý.
- **768px (Tablet Portrait):** Các cột dữ liệu của Admin chuyển sang stack view linh hoạt; modal fullscreen hiển thị chuẩn.
- **480px / 390px (Mobile Devices):** Navigation không tràn ngang, category pills cuộn ngang cảm ứng mượt mà, empty states căn giữa đồng đều.

---

## 8. Kiểm tra Accessibility Regression

- **Keyboard Focus:** Tất cả nút bấm, link chuyển hướng và modal controls đều nhận focus-visible rõ ràng (`outline: 2px solid`).
- **Screen Reader (ARIA):** Vùng live region `#sr-status-announcer` trên `interview-practice.html` không bị ảnh hưởng. Các thuộc tính `role="tab"`, `aria-selected`, `aria-label`, `aria-hidden="true"` trên SVG vector được bảo tồn.
- **Form Controls:** Không có input nào bị mất nhãn (label) liên kết sau khi dọn dẹp orphan markup.

---

## 9. Dedicated R4 Test Suite (`test_p15_r4_cleanup.js`)

Test suite chuyên biệt cho R4 thực hiện 14 kiểm tra khắt khe:
- **Section A (CONSIST-04):**
  - `[PASS]` `dashboard.html`: Đã xóa dead elevenlabs scripts và handlers.
  - `[PASS]` `interview-practice.html`: Đã xóa khối hidden compatibility dummy block.
  - `[PASS]` `interview-practice.html`: Bảo tồn đầy đủ 58 canonical live DOM IDs.
  - `[PASS]` `profile.html`: Đã xóa orphan `</div>` và hidden API key boxes.
  - `[PASS]` `tokens.css`: Bảo tồn required R1 backward-compatible aliases (`--color-*`, `--radius-*`, `--shadow-*`).
- **Section B (CONSIST-09):**
  - `[PASS]` `jobs.html`: Trích xuất CSS sang `jobs.css` (> 700 dòng), HTML giảm còn < 800 dòng.
  - `[PASS]` `qbank.html`: Trích xuất CSS sang `qbank.css` (> 700 dòng), HTML giảm còn < 1500 dòng.
  - `[PASS]` `admin.html`: Trích xuất CSS sang `admin.css` (> 500 dòng), HTML giảm còn < 2300 dòng.
  - `[PASS]` Không tạo mega.css hoặc monolithic stylesheet hỗn tạp.
- **Section C (R1, R2, R3 Regression Assurances):**
  - `[PASS]` R1: Canonical SSOT tokens (`--pm-*`) và button geometry giữ nguyên.
  - `[PASS]` R2: UI Language, Outfit typography, và empty-state patterns chuẩn hóa giữ nguyên.
  - `[PASS]` R3: Landing multi-industry showcase với 5 career tracks và live switcher giữ nguyên.
- **Section D (Scope Guards):**
  - `[PASS]` Backend `JobFamily.cs` và business code giữ nguyên.
  - `[PASS]` Interview runtime state machine và core controller functions giữ nguyên.

**Kết quả:** **14 / 14 TESTS PASSED (100%)**.

---

## 10. Toàn bộ Full Regression Suite

Chạy tuần tự toàn bộ 13 test suites của dự án:

| STT | Tập tin kiểm thử | Assertions | Kết quả |
|---|---|---|---|
| 1 | `test_industry_context.js` | 54 / 54 | **PASS** |
| 2 | `test_p13_presentation.js` | 66 / 66 | **PASS** |
| 3 | `test_interview_setup_ux.js` | 20 / 20 | **PASS** |
| 4 | `test_live_interview_ux.js` | 12 / 12 | **PASS** |
| 5 | `test_interview_flow.js` | 30 / 30 | **PASS** |
| 6 | `test_report_ui.js` | 67 / 67 | **PASS** |
| 7 | `test_p14_navigation.js` | 10 / 10 | **PASS** |
| 8 | `test_p14c_accessibility.js` | 18 / 18 | **PASS** |
| 9 | `test_p14c_responsive.js` | 7 / 7 | **PASS** |
| 10 | `test_p15_r1_consistency.js` | 45 / 45 | **PASS** |
| 11 | `test_p15_r2_ui_language.js` | 51 / 51 | **PASS** |
| 12 | `test_p15_r3_product_fit.js` | 17 / 17 | **PASS** |
| 13 | `test_p15_r4_cleanup.js` | 14 / 14 | **PASS** |
| **TỔNG CỘNG** | **13 Test Suites** | **429 / 429** | **100% PASS** |

---

## 11. Backend Build

```text
dotnet build BE/backend.csproj
Determining projects to restore...
All projects are up-to-date for restore.
backend -> C:\Users\hungd\Desktop\VS Code\PrepMate\PrepMate\BE\bin\Debug\net10.0\backend.dll

Build succeeded.
    0 Warning(s)
    0 Error(s)
Time Elapsed 00:00:01.14
```
Backend hoàn toàn không bị tác động; build sạch sẽ với 0 warning và 0 error.

---

## 12. Scope Guard

- Không sửa đổi bất kỳ file nào trong thư mục `BE/`.
- Không sửa đổi application API contracts hoặc lifecycle controllers.
- Không đưa vào bất kỳ thư viện icon ngoài hay CDN bên thứ ba.
- Không tự ý chuyển đổi sang framework SPA khác.

---

## 13. Đánh giá cuối cùng

Wave **P1.5-R4** đã hoàn thành toàn diện cả 2 mục tiêu `CONSIST-04` và `CONSIST-09`, đồng thời xác nhận hệ thống đạt chất lượng cao nhất sau 4 đợt remediation (R1, R2, R3, R4) với 429/429 automated tests pass.

Theo đúng quy tắc kiểm soát chất lượng, phase P1.5 vẫn giữ trạng thái **OPEN** chờ đợt review tổng thể tiếp theo.
