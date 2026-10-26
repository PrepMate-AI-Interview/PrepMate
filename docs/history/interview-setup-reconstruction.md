# PREPMATE — P1.1 INTERVIEW SETUP RECONSTRUCTION REPORT

## 1. EXECUTIVE SUMMARY

- **Phase**: P1.1 — Interview Setup Reconstruction
- **Target File**: `FE/features/interview/interview-info.html`
- **Objective**: Tái cấu trúc UX/UI trang thiết lập phỏng vấn nhằm xóa bỏ gánh nặng nhận thức (cognitive overload) từ màn hình đơn khối (monolith), giải quyết triệt để sự thiên vị chỉ dành cho ngành công nghệ phần mềm (SWE-only bias), loại bỏ hoàn toàn biểu tượng robot (robot emoji `🤖`), và thiết lập luồng chuẩn bị 4 bước tuần tự, chuyên nghiệp, tinh gọn.
- **Outcome**: **SEALED & VERIFIED**
  - Setup UX Verification Suite: **20/20 PASS**
  - Live Interview Flow Regression: **30/30 PASS**
  - Report UI/UX Regression: **67/67 PASS**
  - .NET Backend Build: **0 Warning(s) / 0 Error(s)**
  - State & DOM Contract Breaking Changes: **0**

---

## 2. SEALED BASELINE CONFIRMATION

Trước khi thực hiện thay đổi, toàn bộ regression suite đã được thực thi và xác nhận trạng thái nguyên vẹn:

| Test Suite | Metric / Pass Count | Status |
|---|---|---|
| `FE/features/interview/test_interview_flow.js` | 30 / 30 PASS | SEALED |
| `FE/features/report/test_report_ui.js` | 67 / 67 PASS | SEALED |
| `BE/backend.csproj` (.NET 10 Build) | 0 Warning / 0 Error | SEALED |

---

## 3. ROOT CAUSE OF P1-1

Theo phân tích kiến trúc từ `P0.1_FULL_UI_UX_AUDIT.md`:

1. **Monolithic Information Overload**: Toàn bộ cấu hình vị trí, cấp bậc, doanh nghiệp, CV upload, JD parsing, ngôn ngữ, giọng nói, phong cách phỏng vấn, webcam và checklist bị nhồi nhét trên cùng một màn hình dài, khiến người dùng bị ngợp trước khi bắt đầu phỏng vấn.
2. **SWE-Only Bias**: Input vị trí bị hardcode cứng mặc định `value="Frontend Developer"`, kết hợp với danh sách chip gợi ý nhanh chỉ gồm các vai trò tech (`Frontend`, `Backend`, `DevOps`, `QA`, `Full Stack`), loại trừ ứng viên từ các lĩnh vực Kinh doanh, Marketing, Tài chính, Nhân sự, Quản lý sản phẩm.
3. **Robot / AI Chatbot Appearance**: Sử dụng nhiều biểu tượng robot emoji (`🤖`), tạo cảm giác như một chatbot giải trí hoặc dashboard AI thông thường thay vì một hệ thống chuẩn bị phỏng vấn tuyển dụng chuyên nghiệp.
4. **CV Re-entry Friction**: Người dùng đã có CV lưu trữ trên hệ thống vẫn phải đối mặt với dropzone upload trống, gây mơ hồ về việc hệ thống đã nhận diện hồ sơ hay chưa.

---

## 4. ARCHITECTURE COMPARISON (BEFORE VS AFTER)

```
[TRƯỚC — MONOLITHIC OVERLOAD]
┌─────────────────────────────────────────────────────────────┐
│ 1 màn hình cuộn dài > 1,440 dòng                            │
│ ├── Hardcode Frontend Developer                             │
│ ├── Quick chips chỉ có SWE/Tech                             │
│ ├── Robot emoji 🤖 rải rác                                  │
│ ├── CV upload + JD tab bẫy lẫn nhau                         │
│ ├── Ngôn ngữ + Persona + Voice + Camera hiện cùng lúc       │
│ └── Nút Bắt đầu nằm sâu dưới đáy form cuộn                  │
└─────────────────────────────────────────────────────────────┘

                                ↓

[SAU — 4-STEP STRUCTURED WIZARD]
┌─────────────────────────────────────────────────────────────┐
│ Visual Stepper Header: [1. Bối cảnh] → [2. Hồ sơ] → [3. Phỏng vấn] → [4. Sẵn sàng] │
├─────────────────────────────────────────────────────────────┤
│ • Bước 1: Vị trí & Bối cảnh (Role, 8 khối ngành, Seniority, Doanh nghiệp, Vòng pv)│
│ • Bước 2: Hồ sơ & Trọng tâm (Nhận diện CV đã lưu, Upload dropzone, JD, Focus notes)│
│ • Bước 3: Cấu hình Phỏng vấn (Ngôn ngữ cờ tròn, Chat vs Voice, 3 Persona lãnh đạo)│
│ • Bước 4: Kiểm tra Sẵn sàng (Executive Summary 6 chiều, Checklist thiết bị, CTA)  │
│ ─────────────────────────────────────────────────────────── │
│ Sidebar: Live Briefing Card + Adaptive STAR Mechanism + Pre-interview Tips  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 4-STEP WIZARD UX BREAKDOWN

### Bước 1: Vị trí & Bối cảnh (Role & Context)
- **Neutral Placeholder**: Input `#job-title` chuyển sang placeholder trung tính: `Ví dụ: Business Analyst, Software Engineer, Marketing Manager, Kế toán trưởng...` (không hardcode giá trị mặc định).
- **8 Khối ngành nghề đa dạng**: Thay thế các chip thuần dev bằng 8 thẻ ngành đại diện:
  - `Software Engineer` (Công nghệ thông tin)
  - `Business Analyst` (Phân tích nghiệp vụ)
  - `Digital Marketing Specialist` (Marketing & Truyền thông)
  - `B2B Sales Executive` (Kinh doanh doanh nghiệp)
  - `Financial Analyst` (Tài chính & Kế toán)
  - `HR Recruiter` (Nhân sự & Tuyển dụng)
  - `Project Manager` (Vận hành & Dự án)
  - `UI/UX Designer` (Thiết kế sản phẩm)
- **Seniority Levels**: Giữ nguyên 4 cấp độ: `Junior (< 2 năm)`, `Mid-level (2 – 4 năm)`, `Senior (5+ năm)`, `Lead / Manager (Dẫn dắt chuyên môn)`.
- **Target Company**: Datalist mở rộng gồm FPT, Viettel, VNG, Techcombank, Shopee, MoMo, Vinamilk, Unilever, Grab, MB Bank, Masan.
- **Interview Round**: Vòng 1 (Sơ loại HR), Vòng 2 (Chuyên môn / Kỹ thuật), Vòng 3 (Văn hóa & Quản lý).
- **Validation**: Nút `Tiếp tục sang Hồ sơ →` tự động kiểm tra xem ứng viên đã điền vị trí mục tiêu chưa; nếu chưa, highlight viền đỏ và focus ngay lập tức.

### Bước 2: Hồ sơ & Trọng tâm (Profile & Objectives)
- **Saved CV Highlight Card**: Tự động nhận diện CV đã lưu từ API `/api/cv`, hiển thị tên tệp, dung lượng, trạng thái "Đang sử dụng", huy hiệu sẵn sàng và nút "Đổi CV khác" linh hoạt.
- **Drag & Drop Upload Zone**: Giữ nguyên cơ chế kéo thả, hỗ trợ tệp `.pdf` và `.txt` với bộ giải mã PDF.js phía client.
- **JD Direct Input**: Tab dán nội dung tuyển dụng (JD) độc lập, không che khuất CV.
- **Candidate Focus Notes**: Vùng ghi chú `#user-description` để ứng viên chỉ định kỹ năng hoặc case study muốn AI tập trung đào sâu.

### Bước 3: Phòng phỏng vấn & Người phỏng vấn AI
- **Ngôn ngữ**: Tiếng Việt (cờ đỏ sao vàng SVG) & English (cờ Anh quốc SVG) gọn gàng, có checkmark phản hồi trạng thái.
- **Phương thức trả lời**: Gõ phím văn bản (Chat) vs Nói trực tiếp (Voice AI) với badge "Khuyên dùng" rõ ràng.
- **Human Professional Personas**: Thay thế toàn bộ avatar robot bằng 3 vai trò lãnh đạo thực tế:
  - **Giám đốc Chuyên môn** (`professional`): Đào sâu kỹ thuật, chuẩn xác nghiệp vụ và kiến trúc.
  - **Trưởng nhóm Tuyển dụng** (`balanced`): Cân bằng chuyên môn với kỹ năng STAR và phối hợp thực tế.
  - **Chuyên viên Nhân sự** (`friendly`): Cởi mở, đánh giá động lực nghề nghiệp và độ phù hợp văn hóa.
- **Collapsible Advanced Options**: Phần cài đặt nâng cao (webcam toggle `#enable-camera`) được gập gọn, tránh làm rối mắt người dùng phổ thông.

### Bước 4: Kiểm tra Sẵn sàng & Khởi động (Launch)
- **Executive Summary Card**: Trình bày tổng thể 6 thông số thiết lập: Vị trí & Cấp bậc, Doanh nghiệp, Vòng phỏng vấn, Hồ sơ năng lực, Ngôn ngữ & Phương thức, và Phong cách người phỏng vấn.
- **Pre-Flight Hardware Checklist**: Đánh giá Micro & Loa, Camera quan sát cử chỉ, Không gian yên tĩnh & Đường truyền mạng.
- **Commanding Start CTA**: Nút bấm `#btn-start-interview` nổi bật, kèm thông tin ước tính thời lượng (15 - 20 phút) và trạng thái kết nối thích ứng.

---

## 6. ELIMINATION OF SWE-ONLY BIAS

| Tiêu chí | Trước khi sửa | Sau khi sửa |
|---|---|---|
| Mặc định `#job-title` | Hardcoded `Frontend Developer` | Placeholder trung tính đa ngành |
| Gợi ý vai trò nhanh | 8 chip thuần dev (Frontend, Backend, DevOps, QA...) | 8 thẻ ngành cân bằng (Tech, BA, Marketing, Sales, Finance, HR, PM, Design) |
| Doanh nghiệp mục tiêu | Chỉ gồm các công ty IT thuần | Kết hợp IT, Ngân hàng, Bán lẻ, FMCG, Dịch vụ |
| Datalist `#job-titles` | 14 vị trí phần lớn là lập trình | Đa dạng hóa vai trò kinh doanh, tài chính, nhân sự, vận hành |

---

## 7. HUMAN-DESIGNED PROFESSIONAL PERSONAS (ELIMINATION OF ROBOT EMOJIS)

Toàn bộ icon `🤖` trên giao diện thiết lập đã bị xóa bỏ hoàn toàn:
- Thay bằng SVG icon người chuyên nghiệp (`Executive`, `Scale / STAR`, `Heart / Culture`).
- Chuyển đổi tên hiển thị từ phong cách chung chung sang chức danh công việc thực tế trong hội đồng phỏng vấn:
  1. `professional` $\rightarrow$ **Giám đốc Chuyên môn (Senior Lead)**
  2. `balanced` $\rightarrow$ **Trưởng nhóm Tuyển dụng (Hiring Manager)**
  3. `friendly` $\rightarrow$ **Chuyên viên Nhân sự (HR Business Partner)**

---

## 8. SAVED CV RECOGNITION & RE-ENTRY PREVENTION INVARIANT

Tuân thủ bất biến **No-Re-entry**:
- Khi người dùng đã có CV trên hệ thống (đăng nhập có token và fetch thành công `/api/cv`), hệ thống không bắt người dùng phải tải lại tệp.
- Thẻ `#saved-cv-box` tự động xuất hiện với trạng thái "Đã lưu", hiển thị tên file, dung lượng và các thẻ kỹ năng đã bóc tách từ trước.
- Ứng viên chỉ cần bấm "Tiếp tục" hoặc có thể chủ động bấm "Đổi CV khác" nếu muốn cập nhật hồ sơ mới.

---

## 9. STATE & DOM CONTRACT INTEGRITY AUDIT

Bảng đối chiếu kiểm tra tính toàn vẹn của tất cả DOM Elements mà `interview.js` và backend tiêu thụ:

| Element ID / Selector | Loại Element | Hành vi & Consumer | Trạng thái bảo toàn |
|---|---|---|---|
| `#job-title` | Input Text | `startInterview()` đọc vị trí | 100% Nguyên vẹn |
| `input[name="seniority"]` | Radio Group | `startInterview()` đọc cấp bậc | 100% Nguyên vẹn |
| `#company-name` | Input Text | `startInterview()` đọc công ty | 100% Nguyên vẹn |
| `#interview-round` | Select Dropdown | `startInterview()` đọc vòng pv | 100% Nguyên vẹn |
| `#cv-file` | Input File | `handleCvUpload()` xử lý tải tệp | 100% Nguyên vẹn |
| `#upload-box` | Dropzone Div | Drag & drop file event handler | 100% Nguyên vẹn |
| `#upload-status` | Status Div | Trạng thái tải tệp hoàn tất | 100% Nguyên vẹn |
| `#status-filename` | Span | Hiển thị tên tệp tải lên | 100% Nguyên vẹn |
| `#status-filesize` | Span | Hiển thị kích thước tệp | 100% Nguyên vẹn |
| `#btn-remove-cv` | Button | `removeUploadedCv()` gỡ tệp | 100% Nguyên vẹn |
| `#cv-text` | Textarea Hidden | Chứa nội dung text CV trích xuất | 100% Nguyên vẹn |
| `#jd-text` | Textarea | Chứa nội dung mô tả công việc | 100% Nguyên vẹn |
| `#user-description` | Textarea | Chứa mục tiêu/giới thiệu bản thân | 100% Nguyên vẹn |
| `#interview-language` | Input Hidden | Chứa mã ngôn ngữ (`vi` / `en`) | 100% Nguyên vẹn |
| `#interviewer-country` | Select Hidden | Chứa quốc gia (`vietnam` / `usa`) | 100% Nguyên vẹn |
| `#enable-text` | Radio Hidden | Chế độ gõ phím (`text`) | 100% Nguyên vẹn |
| `#enable-handsfree` | Radio Hidden | Chế độ giọng nói (`voice`) | 100% Nguyên vẹn |
| `#interviewer-persona` | Select Hidden | Chứa giá trị persona AI | 100% Nguyên vẹn |
| `#enable-camera` | Input Checkbox | Trạng thái webcam bật/tắt | 100% Nguyên vẹn |
| `#btn-start-interview` | Button | Kích hoạt `startInterview()` | 100% Nguyên vẹn |
| `#brief-position-display` | Span | Đồng bộ hiển thị vị trí ở Sidebar | 100% Nguyên vẹn |
| `#brief-company-display` | Span | Đồng bộ hiển thị công ty ở Sidebar | 100% Nguyên vẹn |
| `#brief-round-display` | Span | Đồng bộ hiển thị vòng pv ở Sidebar | 100% Nguyên vẹn |
| `#brief-lang-badge` | Span | Đồng bộ hiển thị cờ/ngôn ngữ | 100% Nguyên vẹn |
| `#brief-mode-badge` | Span | Đồng bộ hiển thị chế độ trả lời | 100% Nguyên vẹn |

---

## 10. SCRIPT & QUERY PARAMETER COMPATIBILITY

Giao diện mới bảo toàn 100% các luồng tích hợp với các module khác của PrepMate:

1. **Question Bank & Jobs Query Params**:
   - `?role=...`: Tự động điền `#job-title` và đồng bộ chip tương ứng.
   - `?company=...`: Tự động điền `#company-name`.
   - `?lang=en`: Tự động chuyển ngôn ngữ sang English.
   - `?topic=...`: Tự động cập nhật vào `#user-description`.
2. **Job Exploration Prefill via LocalStorage**:
   - `prefill_job_title`, `prefill_company_name`, `prefill_jd` từ trang `jobs.html` tiếp tục được nạp tự động vào form và xóa sạch sau khi nạp để bảo mật phiên.
3. **Server Profile & CV Prefill**:
   - Tự động gọi `/api/profile` để nạp chức danh và cấp bậc ứng viên đã khai báo trong hồ sơ.
   - Tự động gọi `/api/cv` để lấy CV gần nhất và phân tích kỹ năng trọng tâm.

---

## 11. ADVANCED OPTIONS PROGRESSIVE DISCLOSURE

- **Vấn đề cũ**: Toggle camera và các tùy chọn thiết bị nằm rải rác cùng với các lựa chọn cốt lõi, làm gia tăng số lượng quyết định mà người dùng phải thực hiện.
- **Giải pháp P1.1**: Tích hợp thẻ collapsible "Tùy chọn nâng cao & Thiết bị" (`.advanced-options-card`). Mặc định gập gọn; khi người dùng cần tùy chỉnh góc nhìn camera hoặc thiết bị phụ trợ, chỉ cần nhấp mở mà không làm ngắt quãng luồng chính.

---

## 12. PRE-FLIGHT READINESS & LAUNCH CTA HARMONIZATION

- **Vị trí nút CTA**: Chuyển vị trí nút `#btn-start-interview` vào Bước 4 (Sẵn sàng) thay vì nằm ở cuối trang cuộn bất tận.
- **Tâm lý ứng viên**: Người dùng được rà soát lại thông tin tổng thể qua bản tóm tắt trực quan, xác nhận microphone/camera đã ổn định, mang lại cảm giác sẵn sàng và tự tin tối đa trước khi bước vào phòng phỏng vấn thực chiến.

---

## 13. ACCESSIBILITY, RESPONSIVENESS & DESIGN SYSTEM COMPLIANCE

- **Chuẩn màu sắc Light-First**: Sử dụng bảng màu sáng chuẩn PrepMate (`#ffffff`, `#f8fafc`, `#eff6ff`, `#e2e8f0`, viền `#bfdbfe`, text `#0f172a`), không dùng gradient đen neon tối kiểu gaming.
- **Phản hồi Responsive**:
  - Desktop (> 1040px): 2 cột tối ưu (70% Wizard Form, 30% Sticky Briefing Sidebar).
  - Tablet (768px – 1040px): Sidebar chuyển xuống phía dưới, Stepper thích ứng mượt mà.
  - Mobile (< 768px): Stepper chuyển sang grid 2x2, các tile ngôn ngữ/chế độ xếp dọc, khoảng cách touch target đạt chuẩn $\ge 44\text{px}$.
- **Accessibility**: Bổ sung `aria-label`, `role="radiogroup"`, `fieldset`/`legend`, thẻ `<label>` liên kết chính xác với từng `id`.

---

## 14. TEST HARNESS & VERIFICATION SUITE

Tạo kịch bản kiểm thử tự động độc lập `FE/features/interview/test_interview_setup_ux.js` để kiểm tra toàn diện 20 tiêu chí:

```text
================================================================
   P1.1 VERIFICATION: INTERVIEW SETUP RECONSTRUCTION AUDIT      
================================================================

[PASS] Test 1: Stepper contains 4 structured step tabs (Context, Profile, Interview, Readiness)
[PASS] Test 2: Setup form decomposed into 4 distinct step panes
[PASS] Test 3: Eliminated hardcoded "Frontend Developer" default value from #job-title input
[PASS] Test 4: Diverse career quick chips present across 8 major domains (Tech, BA, Marketing, Sales, Finance, HR, PM, Design)
[PASS] Test 5: Seniority radio group preserves Junior, Mid-level, Senior, and Lead options
[PASS] Test 6: Target companies datalist expanded beyond pure tech to banking, retail, FMCG
[PASS] Test 7: Interview round selector preserves round1, round2, round3 values
[PASS] Test 8: CV upload dropzone, status, and hidden text storage contracts preserved
[PASS] Test 9: Saved CV recognition UI card present for seamless server prefill
[PASS] Test 10: AI CV analysis panel contracts fully preserved
[PASS] Test 11: JD input and candidate focus description textareas preserved
[PASS] Test 12: Context switcher tabs preserved for tab switching compatibility
[PASS] Test 13: Language tiles and underlying hidden select contracts preserved
[PASS] Test 14: Response mode tiles and underlying radio inputs preserved
[PASS] Test 15: Zero robot emojis (🤖) - interviewer personas fully humanized and professionalized
[PASS] Test 16: Professional interviewer personas configured (Technical Lead, Hiring Manager, HR Partner)
[PASS] Test 17: Collapsible advanced options card with webcam toggle switch
[PASS] Test 18: Step 4 executive readiness summary card with 6 live spec dimensions
[PASS] Test 19: Single commanding start CTA and sidebar live briefing contracts preserved
[PASS] Test 20: Full compatibility with query parameters, job exploration prefill, and authenticated server profile/CV

================================================================
   TOTAL TESTS: 20 | PASS: 20 | FAIL: 0
================================================================
```

---

## 15. REGRESSION SUITE RESULTS

Sau khi tái cấu trúc `interview-info.html`:

1. **Setup UX Verification Suite**:
   - `node FE/features/interview/test_interview_setup_ux.js`
   - **20 / 20 PASS**
2. **Interview Practice Flow Acceptance & State Suite**:
   - `node FE/features/interview/test_interview_flow.js`
   - **30 / 30 PASS**
3. **Report UI / UX & Diagnostics Suite**:
   - `node FE/features/report/test_report_ui.js`
   - **67 / 67 PASS**
4. **Backend Compilation & Contract Validation**:
   - `dotnet build BE/backend.csproj`
   - **Build succeeded: 0 Warning(s), 0 Error(s)**

---

## 16. ZERO BREAKING CHANGE GUARANTEE

- Không đổi tên bất kỳ field nào trong payload khởi tạo phiên phỏng vấn (`JobTitle`, `Seniority`, `TargetCompany`, `InterviewRound`, `CandidateCV`, `JobDescription`, `CandidateDescription`, `Language`, `EnableCamera`, `EnableHandsFree`).
- Không tác động tiêu cực đến logic chuyển trang `window.location.href = "interview-practice.html"` trong `interview.js`.
- Không ảnh hưởng đến dữ liệu lưu trữ `sessionStorage.getItem("interview_init_data")`.

---

## 17. CONCLUSION & NEXT STEPS

- **Status**: **P1.1 HOÀN TẤT & SEALED THÀNH CÔNG**.
- Toàn bộ mục tiêu đặt ra cho `interview-info.html` đã được giải quyết triệt để:
  - Loại bỏ hoàn toàn khối form đơn lẻ rối mắt.
  - Xóa bỏ định kiến SWE-only, hỗ trợ ứng viên từ 8+ khối ngành.
  - Nhân cách hóa người phỏng vấn chuẩn hội đồng tuyển dụng chuyên nghiệp, xóa bỏ emoji robot.
  - Giảm thiểu tối đa gánh nặng nhận thức qua wizard 4 bước rõ ràng và mượt mà.
- **Khuyến nghị giai đoạn tiếp theo (P1.2)**: Tiến hành tái cấu trúc trang **Preparation Module / CV Optimization & Matching** để hoàn thiện chuỗi giá trị từ Chuẩn bị hồ sơ $\rightarrow$ Thiết lập phỏng vấn $\rightarrow$ Thực chiến $\rightarrow$ Báo cáo debrief.
