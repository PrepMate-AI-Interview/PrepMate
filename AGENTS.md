# PREPMATE — AI CODING AGENT ONBOARDING & ARCHITECTURAL GUIDELINES

Tài liệu này là cẩm nang hướng dẫn chuẩn (Single Source of Truth) dành cho mọi AI coding assistant (Antigravity, Claude, Gemini, Cursor, Copilot, v.v.) và kỹ sư phần mềm khi tham gia phát triển, bảo trì hoặc kiểm thử trên repository PrepMate.

---

## 1. Thứ Tự Đọc Tài Liệu Khi Bắt Đầu (Reading Order)

Trước khi đề xuất hoặc thực hiện bất kỳ thay đổi nào vào mã nguồn, agent **PHẢI** đọc các tài liệu sau theo thứ tự:

1. **[`README.md`](README.md):** Tổng quan sản phẩm, 5 nhóm ngành phỏng vấn, năng lực cốt lõi và kiến trúc tổng quan.
2. **[`DEPLOYMENT.md`](DEPLOYMENT.md):** Kiến trúc vận hành, danh mục biến môi trường, bảo mật khóa ký số, kết nối FE–BE và giới hạn single-instance của FileDb.
3. **Tài liệu chuyên môn liên quan trực tiếp đến tác vụ (nằm trong thư mục `docs/`):**
   - **Kiến trúc hệ thống & Dữ liệu:** [`docs/system/SYSTEM_ARCHITECTURE.md`](docs/system/SYSTEM_ARCHITECTURE.md), [`docs/system/DATA_MODEL.md`](docs/system/DATA_MODEL.md), [`docs/system/USER_ROLES.md`](docs/system/USER_ROLES.md).
   - **Quy trình phỏng vấn & AI:** [`docs/features/ADAPTIVE_INTERVIEW.md`](docs/features/ADAPTIVE_INTERVIEW.md), [`docs/features/INTERVIEW.md`](docs/features/INTERVIEW.md), [`docs/features/REPORTING.md`](docs/features/REPORTING.md).
   - **Xác thực & Bảo mật:** [`docs/features/AUTHENTICATION.md`](docs/features/AUTHENTICATION.md), [`docs/quality/SECURITY.md`](docs/quality/SECURITY.md).
   - **Quy chuẩn kiểm thử:** [`docs/quality/TESTING.md`](docs/quality/TESTING.md).

> [!TIP]
> **Cách kích hoạt agent đọc tài liệu này:** Khi bắt đầu một phiên làm việc mới, người dùng chỉ cần nhắc agent: *"Hãy đọc `AGENTS.md` và tuân thủ các quy tắc kiến trúc của PrepMate trước khi thực hiện task."*

---

## 2. Các Quy Tắc Bất Biến Về Kiến Trúc (Architectural Invariants)

Tuyệt đối tuân thủ các nguyên tắc cốt lõi sau. Không được tự ý thay đổi khi tác vụ không yêu cầu rõ:

1. **Chuẩn Đánh Giá Điểm Số Thống Nhất (0–100 Point Scale SSOT):**
   - Mọi chiều đánh giá năng lực (`OverallScore`, `TechScore`, `StarScore`, `SituationalScore`, `CandidateQuestionScore`) **bắt buộc** chuẩn hóa trên thang điểm số nguyên **0 đến 100**.
   - Tuyệt đối không tự ý chuyển đổi sang thang điểm 1-10 hay 1-5.
2. **Cổng Trí Tuệ Nhân Tạo Hợp Nhất (Single AI Gateway SSOT):**
   - Mọi luồng suy luận trực tiếp gọi qua `https://api.vilao.ai/v1` với định danh mô hình logic **`PrepMate`** (hoặc thông qua `AIRouter` / `ComboRootService`).
   - Plaintext API key tuyệt đối **không được** trả về Frontend hay in ra log hệ thống.
3. **Cơ Chế Lưu Trữ Single-Instance FileDb & Bootstrap Môi Trường:**
   - Hệ thống lưu trữ `FileDb` là tệp JSON duy nhất (`data/db.json`), sử dụng ghi tệp nguyên tử (Atomic file swap) và lock in-memory.
   - Không được giả định hệ thống có distributed lock hay hỗ trợ horizontal clustering nhiều container.
   - Trong môi trường `Production`, tính năng auto-seeding dữ liệu ngẫu nhiên bị vô hiệu hóa. Nếu `db.json` chưa tồn tại, backend tự động bootstrap cơ sở dữ liệu khởi tạo sạch từ template an toàn `db.example.json` và kích hoạt mật khẩu cho `user_admin` thông qua biến môi trường `PREPMATE_ADMIN_PASSWORD` (hoặc fallback mặc định an toàn `PrepMate@2026!` nếu để trống). Nếu thiếu cả template mẫu, server dừng khởi động với ngoại lệ `FileNotFoundException`.
   - Bộ kiểm thử tự động sử dụng fixture độc lập, an toàn (`tests/fixtures/test_db_fixture.json` thông qua `tests/helpers/test-env.js`), hoàn toàn không phụ thuộc database production, không hard-code hash dữ liệu cá nhân và không đưa `db.json` thật vào Git.
4. **Bảo Mật Tách Biệt Khóa Ký Số (Cryptographic Key Separation):**
   - Khóa ký JWT (`JWT__SECRET`) và Khóa HMAC của khách (`GUEST_TOKEN__SIGNING_KEY`) **bắt buộc phải là hai chuỗi ký tự độc lập, khác nhau hoàn toàn**, có độ dài tối thiểu 32 ký tự (256-bit).
5. **Tính Toàn Vẹn Của State Machine Phỏng Vấn:**
   - Giữ nguyên luồng trạng thái (`InterviewStageOrchestrator`, `InterviewFlowService`) và bảng ghi nhận chứng cứ (`EvidenceLedger`: `ObservedFacts`, `CandidateClaims`).
   - Khẳng định của ứng viên (`Claims`) không được tự động chuyển thành sự thật (`Facts`) nếu chưa có kiểm chứng thực tế qua các turn phỏng vấn.

---

## 3. Quy Tắc Bảo Vệ Working Tree & Git Safety

1. **Tuyệt đối không chạy các lệnh Git mang tính phá hủy (Destructive Git Commands):**
   - **NGHIÊM CẤM:** `git clean`, `git reset --hard`, `git checkout --`, `git restore`, `git stash drop`.
   - Luôn tôn trọng và bảo vệ các thay đổi có sẵn trên working tree của người dùng; không được ghi đè hoặc xóa bỏ chúng.
2. **Không tự ý commit hoặc push:**
   - Chỉ chuẩn bị mã nguồn và kiểm tra diff sạch sẽ (`git status --short`, `git diff`). Chỉ commit hoặc push khi người dùng có yêu cầu rõ ràng.
3. **Bảo vệ dữ liệu người dùng và secrets:**
   - Không tạo hoặc sửa tệp `.env` chứa secret thật.
   - Không commit dữ liệu cá nhân, CV ứng viên thật, database production hay chứng chỉ SSL (`*.pem`, `*.key`, `*.pfx`).

---

## 4. Quy Trình Kiểm Tra & Xác Minh (Testing Protocol)

Mọi thay đổi trên mã nguồn Backend hoặc Frontend đều phải được xác minh qua các cổng kiểm thử:

1. **Biên dịch Backend:**
   ```bash
   dotnet build BE/backend.csproj
   # Yêu cầu: 0 Warning(s), 0 Error(s)
   ```
2. **Chạy Master Regression Test Runner:**
   ```bash
   node tests/run-all.js
   # Yêu cầu: Tất cả 61 test suites PASS (1244 checks), không có regression
   ```
3. **Chạy kiểm thử đơn lẻ khi chỉnh sửa module cụ thể:**
   ```bash
   node tests/regression/scoring-standardization.test.js
   node tests/regression/evidence-ledger-consistency.test.js
   node tests/regression/interview-flow.test.js
   node tests/consistency/shared-components.test.js
   ```

> [!CAUTION]
> **Tuyệt đối không sửa assertion hoặc hạ thấp tiêu chuẩn của test suites chỉ để làm cho test pass một cách giả tạo.** Nếu test fail, nguyên nhân nằm ở mã nguồn vừa sửa đã phá vỡ hợp đồng kiến trúc của hệ thống.
