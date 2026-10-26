# PrepMate — Centralized Automated Testing Framework

Thư mục `tests/` là trung tâm quản lý và thực thi kiểm thử độc lập cho toàn bộ dự án **PrepMate**. Tất cả mã kiểm thử được tách biệt hoàn toàn khỏi cây thư mục mã nguồn (`FE/` và `BE/`) và được tổ chức theo trách nhiệm kỹ thuật thực tế (semantic domain).

---

## 1. Cấu trúc Thư mục Kiểm thử

```text
tests/
├── README.md                              # Tài liệu hướng dẫn kiểm thử
├── run-all.js                             # Master runner cho 22 static regression suites
├── run-integration.js                     # Runner cho live integration tests
├── run-e2e.js                             # Runner cho browser E2E & live AI benchmarks
├── helpers/
│   └── test-env.js                        # Bộ giải quyết đường dẫn root chuẩn hóa
├── regression/                            # 16 suites kiểm thử hồi quy tính năng cốt lõi
│   ├── industry-context.test.js           # 54 checks: Ngữ cảnh đa ngành & JobFamily
│   ├── presentation-layer.test.js         # 66 checks: Trình bày báo cáo & định vị đa ngành
│   ├── interview-setup-ux.test.js         # 20 checks: Setup wizard & CV dropzone
│   ├── live-interview-ux.test.js          # 12 checks: Buồng phỏng vấn HUD & camera tiles
│   ├── interview-flow.test.js             # 35 checks: Máy trạng thái, TTS & Gemini fallback
│   ├── navigation-architecture.test.js    # 10 checks: Kiến trúc thông tin & điều hướng
│   ├── report-ui.test.js                  # 69 checks: Báo cáo STAR & chuẩn hóa điểm 100
│   ├── interview-api-config.test.js       # 9 checks: Cấu hình base URL độc lập môi trường
│   ├── interview-ai-resilience.test.js    # 10 checks: Khôi phục lỗi AI Gateway & timeout
│   ├── admin-ai-config.test.js            # 53 checks: Presets, precedence & che giấu secret
│   ├── admin-ai-registry.test.js          # 63 checks: Provider registry & adapters
│   ├── ai-architecture-reconstruction.test.js # 13 checks: AIRouter & IPrepMateAIClient
│   ├── combo-root-alias.test.js           # 15 checks: Logical alias PrepMate & Combo Root
│   ├── vilao-model-discovery.test.js      # 13 checks: Discovery danh sách model Vilao
│   ├── evidence-ledger-consistency.test.js # 14 checks: EvidenceLedger cô lập claim/fact
│   └── scoring-standardization.test.js    # 39 checks: Thang 100 điểm, clamping, trung bình
├── accessibility/                         # Kiểm thử khả năng tiếp cận WCAG AA
│   └── accessibility.test.js              # 24 checks: Focus visible, ARIA landmarks, sliders
├── responsive/                            # Kiểm thử đáp ứng đa màn hình (375px -> 1024px)
│   └── responsive.test.js                 # 19 checks: Breakpoints, table containment, padding
├── consistency/                           # Kiểm thử nhất quán thiết kế & hệ thống tokens
│   ├── design-tokens.test.js              # 45 checks: Design tokens SSOT & button radius
│   ├── ui-iconography.test.js             # 51 checks: Thay thế SVG vector & Outfit font
│   ├── product-showcase.test.js           # 17 checks: Multi-industry selector trên Landing
│   └── stylesheet-extraction.test.js      # 14 checks: Trích xuất CSS & bảo toàn 58 HUD IDs
├── integration/                           # Kiểm thử tích hợp trực tiếp với backend server
│   └── conversational-persona.test.js     # 8 cases: Tích hợp API phỏng vấn tự nhiên
└── e2e/                                   # Kiểm thử chấp nhận E2E với trình duyệt thực tế
    └── cross-industry-live.test.js        # 20 kịch bản 5 ngành + audit DOM báo cáo
```

---

## 2. Đường cơ sở Nghiệm thu (Golden Regression Baseline)

- **Tổng số Suites tĩnh:** 22 test suites.
- **Tổng số Assertions:** **665 assertions PASS (100%)**.
- **Backend .NET Build:** **0 Warning(s) / 0 Error(s)**.
- **Integration Test Cases:** 8 cases (thực thi khi backend online).
- **Cross-Industry Live AI E2E:** 20/20 kịch bản PASS trên 5 ngành nghề.

---

## 3. Hướng dẫn Thực thi Kiểm thử

### 3.1 Chạy toàn bộ Regression tĩnh (Khuyến nghị cho CI/CD & Local Pre-Push)
Hoàn toàn offline, không phụ thuộc mạng hay API key:
```bash
node tests/run-all.js
```

### 3.2 Chạy từng Suite đơn lẻ
Mọi test suite đều có thể thực thi độc lập:
```bash
node tests/regression/scoring-standardization.test.js
node tests/regression/combo-root-alias.test.js
node tests/regression/interview-flow.test.js
node tests/regression/report-ui.test.js
```

### 3.3 Chạy Live E2E & Trình duyệt thực tế (Yêu cầu Vilao API Key)
```bash
# Thiết lập key trong phiên làm việc:
# Windows PowerShell: $env:VILAO_API_KEY="sk-..."
# Linux / macOS: export VILAO_API_KEY="sk-..."

node tests/run-e2e.js
```

---

## 4. An toàn Dữ liệu khi Kiểm thử
- Cơ sở dữ liệu chính tại `BE/data/db.json` được bảo vệ với mã băm SHA-256 cố định: `D2F70C35456A0AA5968DE4FDD6A41E70C08371FF9CC193A69BBD081714A30323`.
- Các bài kiểm thử tích hợp và E2E tự động sử dụng cơ sở dữ liệu tạm thời trong thư mục temp của hệ điều hành qua biến môi trường `DATABASE_FILE_PATH`. Tuyệt đối không ghi đè dữ liệu production.
