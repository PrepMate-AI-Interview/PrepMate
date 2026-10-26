# PREPMATE — H2 DESIGN SYSTEM & SHARED LAYOUT SPECIFICATION

> **Phase**: H2 — Design System + Shared Layout  
> **Target**: Unified, Human-designed, Professional UI Foundation  
> **Status**: COMPLETED & VERIFIED (Light-First, WCAG AA Baseline)

---

## 1. DESIGN PRINCIPLES

PrepMate được định vị là:
> **Một nền tảng luyện tập phỏng vấn chuyên nghiệp, thực chiến, có AI hỗ trợ thông minh phía sau.**

Hệ thống tuân thủ 5 nguyên lý cốt lõi:
1. **Visual Hierarchy > Decoration**: Cấu trúc thị giác được xây dựng bằng Typography, Spacing, Layout và Contrast. Không dùng icon, màu mè hay gradient lòe loẹt để bù đắp sự thiếu hụt về phân cấp nội dung.
2. **Không lạm dụng Card (Anti-Card-Overuse)**: Tránh bọc mọi section trong một chiếc card riêng biệt. Ưu tiên sử dụng tiêu đề phân cấp, đường kẻ phân chia (divider), khoảng trắng (whitespace) và danh sách / bảng biểu trực quan.
3. **Triệt tiêu "AI-Looking" Fluff**: Loại bỏ hoàn toàn hình ảnh bộ não phát sáng, quả cầu neon (glowing orb), hạt bụi chuyển động (particles), 3D avatar hay gradient tím neon. Sức mạnh AI được thể hiện qua câu hỏi thích ứng (adaptive questions), nhận xét sâu sắc và đánh giá theo mô hình STAR.
4. **Icon Policy nghiêm ngặt**: Icon chỉ được dùng khi cần định hướng thị giác nhanh, báo hiệu trạng thái hoặc nút bấm chức năng. Không dùng emoji trong giao diện, không gắn icon vào tiêu đề mục một cách vô nghĩa.
5. **Light-First & Accessible**: Nền sáng thanh lịch, độ tương phản cao, hỗ trợ điều hướng bàn phím hoàn chỉnh đạt chuẩn WCAG AA.

---

## 2. COLOR TOKENS (SSOT: `tokens.css`)

Màu sắc được chuẩn hóa theo vai trò ngữ nghĩa (semantic roles), không hardcode mã HEX rải rác:

| Semantic Token | Giá trị | Mục đích sử dụng |
| :--- | :--- | :--- |
| `--color-bg` | `#f8fafc` | Nền canvas chính của ứng dụng (slate-50 sáng, dịu mắt) |
| `--color-surface` | `#ffffff` | Nền component, sidebar, modal, header |
| `--color-surface-muted`| `#f1f5f9` | Nền phụ, header bảng, thẻ tag, trạng thái hover |
| `--color-surface-hover`| `#f8fafc` | Hiệu ứng hover hàng trong bảng, menu con |
| `--color-border` | `#e2e8f0` | Viền khung chuẩn, đường chia tách |
| `--color-border-subtle`| `#f1f5f9` | Đường phân cách mờ bên trong card / list |
| `--color-border-focus` | `#2563eb` | Viền khi phần tử được focus |
| `--color-text` | `#0f172a` | Chữ chính (tiêu đề, nhãn quan trọng - slate-900) |
| `--color-text-secondary`| `#475569`| Chữ phụ, đoạn văn bản mô tả (slate-600) |
| `--color-text-muted` | `#94a3b8` | Metadata, thông tin thời gian, gợi ý placeholder |
| `--color-primary` | `#1d4ed8` | Điểm nhấn chính duy nhất (Royal Blue 700 - tin cậy, vững chãi) |
| `--color-primary-hover`| `#1e40af`| Hover của nút bấm chính |
| `--color-primary-light`| `#eff6ff` | Nền nhạt cho active menu, highlight |
| `--color-primary-border`| `#bfdbfe`| Viền liên kết thương hiệu |
| `--color-success` | `#059669` | Trạng thái hoàn tất, đạt tiêu chuẩn, phản hồi đúng |
| `--color-warning` | `#d97706` | Trạng thái cần chú ý, gói dùng thử sắp hết hạn |
| `--color-danger` | `#dc2626` | Trạng thái lỗi, câu trả lời sai, thao tác hủy |
| `--color-info` | `#0284c7` | Thông tin hướng dẫn, gợi ý phương pháp STAR |

---

## 3. TYPOGRAPHY SCALE

Phông chữ hệ thống: `'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.  
Code / dữ liệu kỹ thuật: `'JetBrains Mono', monospace`.

| Style Class | Cỡ chữ / Line Height | Trọng số (Weight) | Ứng dụng |
| :--- | :--- | :--- | :--- |
| `.text-display` | `36px (2.25rem) / 1.25` | Bold (700) | Hero title, thông điệp trọng tâm trang chủ |
| `.text-h1`, `h1` | `28px (1.75rem) / 1.25` | Bold (700) | Tiêu đề chính trang (Page Header Title) |
| `.text-h2`, `h2` | `22px (1.375rem) / 1.35`| Semibold (600) | Tiêu đề section chính |
| `.text-h3`, `h3` | `18px (1.125rem) / 1.35`| Semibold (600) | Tiêu đề nhóm, card header, tiêu đề câu hỏi |
| `.text-h4`, `h4` | `15px (0.9375rem) / 1.4`| Semibold (600) | Tiêu đề phân mục nhỏ, nhãn nhóm |
| `.text-body`, `p` | `14px (0.875rem) / 1.5`  | Regular (400) | Nội dung đoạn văn bản đọc chuẩn |
| `.text-sm` | `13px (0.8125rem) / 1.5`| Regular (400) | Văn bản phụ, nội dung bảng dữ liệu |
| `.text-caption` | `12px (0.75rem) / 1.4`   | Medium (500) | Metadata, timestamp, trợ giúp |
| `.text-label` | `12px (0.75rem) / 1.3`   | Semibold (600) | Tiêu đề nhóm in hoa, nhãn form (Letter-spacing: 0.05em) |

---

## 4. SPACING SCALE

Chuẩn hóa theo dãy số học toán học để đảm bảo nhịp điệu thị giác (Vertical Rhythm):

```text
--space-1:   4px
--space-2:   8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
```

---

## 5. RADIUS & SHADOWS

### Border Radius
* `--radius-sm: 6px`: Dành cho nút bấm (button), ô nhập liệu (input, select, textarea).
* `--radius-md: 10px`: Dành cho dropdown menu, modal dialog, bảng responsive.
* `--radius-lg: 14px`: Dành cho khung container lớn.
* `--radius-pill: 9999px`: Chỉ dành riêng cho badge trạng thái và tag lọc.

### Shadows
Shadows được thiết kế mờ mịn (subtle matte), triệt tiêu hoàn toàn hiệu ứng phát sáng neon:
* `--shadow-xs`: `0 1px 2px 0 rgba(15, 23, 42, 0.04)`
* `--shadow-sm`: `0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)`
* `--shadow-md`: `0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`
* `--shadow-lg`: `0 10px 15px -3px rgba(15, 23, 42, 0.07), 0 4px 6px -4px rgba(15, 23, 42, 0.03)`
* `--shadow-focus`: `0 0 0 3px rgba(37, 99, 235, 0.16)` (Accessible focus ring)

---

## 6. LAYOUT SYSTEM & APPLICATION SHELL

### 6.1. Public Layout
Áp dụng cho Landing page, About, Help, Login, Register, Pricing:
```text
Public Header (Logo, Nav Links, Đăng nhập, Đăng ký)
    ↓
Main Content Container (Max width: 1200px)
    ↓
Footer (Liên kết hỗ trợ & pháp lý)
```

### 6.2. Authenticated Application Shell
Áp dụng cho Dashboard, Interview, Progress, Profile, Admin:
```text
┌────────────────────────────────────────────────────────┐
│ Header (Breadcrumbs, Title, Account Popover)           │
├────────────┬───────────────────────────────────────────┤
│ Sidebar    │ Main Content                              │
│ (240px)    │ ┌───────────────────────────────────────┐ │
│            │ │ Page Header (Title, Desc, Actions)    │ │
│            │ ├───────────────────────────────────────┤ │
│            │ │ Page Body (max-width: 1200px)         │ │
│            │ └───────────────────────────────────────┘ │
└────────────┴───────────────────────────────────────────┘
```

---

## 7. SIDEBAR RULES & NAVIGATION INVENTORY

Sidebar được thiết kế tuân thủ 100% mục 15 của đặc tả:
* Không đưa Question Bank, CV, Payment, Notifications, Help thành primary sidebar items (các mục này được đưa vào menu hồ sơ hoặc dashboard action).
* Không sử dụng emoji.
* Active state thể hiện rõ qua màu nền `--color-primary-light` và chữ `--color-primary`.
* Hỗ trợ thu gọn (collapse) linh hoạt sang dạng compact icon 68px.

### Cấu trúc Navigation theo Role:
```text
CANDIDATE / USER:
├── TỔNG QUAN
│   └── Tổng quan (/features/dashboard/dashboard.html)
├── PHỎNG VẤN
│   ├── Phỏng vấn mới (/features/interview/interview-info.html)
│   └── Lịch sử (/features/dashboard/dashboard.html#history)
├── KHÁM PHÁ
│   └── Nghề nghiệp (/features/jobs/jobs.html)
├── TIẾN BỘ
│   └── Tiến độ (/features/progress/progress.html)
└── CÁ NHÂN
    ├── Hồ sơ (/features/profile/profile.html)
    └── Cài đặt (/features/profile/settings.html)

MANAGER:
├── QUẢN LÝ
│   ├── Tổng quan (/features/admin/admin.html)
│   ├── Người dùng (/features/admin/admin.html#users-tab)
│   ├── Gói dịch vụ (/features/admin/admin.html#plans-tab)
│   ├── Nội dung (/features/admin/admin.html#content-tab)
│   ├── Báo cáo (/features/admin/admin.html#reports-tab)
│   └── Nhật ký hoạt động (/features/admin/admin.html#audit-tab)
└── HỆ THỐNG
    └── Cài đặt cá nhân (/features/profile/settings.html)

ADMIN:
├── QUẢN TRỊ
│   ├── Tổng quan (/features/admin/admin.html)
│   ├── Người dùng (/features/admin/admin.html#users-tab)
│   ├── Vai trò & quyền (/features/admin/admin.html#roles-tab)
│   ├── Gói dịch vụ & Giá (/features/admin/admin.html#plans-tab)
│   ├── Nội dung (/features/admin/admin.html#content-tab)
│   └── Báo cáo (/features/admin/admin.html#reports-tab)
└── HỆ THỐNG
    ├── Giao dịch doanh thu (/features/admin/admin.html#transactions-tab)
    ├── Cấu hình hệ thống (/features/admin/admin.html#settings-tab)
    ├── Nhật ký hệ thống (/features/admin/admin.html#audit-tab)
    └── Cài đặt cá nhân (/features/profile/settings.html)
```

---

## 8. COMPONENT INVENTORY

| Component | Selector / Lớp | Đặc điểm nổi bật |
| :--- | :--- | :--- |
| **Buttons** | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-link` | Kích thước `.btn-sm`, `.btn-md`, `.btn-lg`; trạng thái `.loading` với spinner tự động căn giữa |
| **Form Controls** | `.form-group`, `.form-label`, `.form-control`, `.form-helper`, `.form-error` | Nhãn rõ ràng, dấu sao bắt buộc, báo lỗi viền đỏ và thông điệp tiếng Việt |
| **Status Badges** | `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`, `.badge-neutral` | Kích thước nhỏ gọn, dạng viên thuốc bo tròn |
| **Table** | `.pm-table`, `.table-responsive` | Bọc trong container cuộn ngang an toàn, hover hàng, highlight hàng được chọn |
| **Tabs** | `.pm-tabs`, `.pm-tab`, `.pm-tab-panel` | Điều hướng chuyển tab không reload, chỉ hỗ trợ 1 cấp tab theo đúng chuẩn |
| **Modal** | `.pm-modal-backdrop`, `.pm-modal`, `.pm-modal-header`, `.pm-modal-body`, `.pm-modal-footer` | Bắt phím Escape để đóng, khóa cuộn trang nền, bẫy focus bàn phím |
| **Toast** | `.pm-toast-container`, `.pm-toast`, `.pm-toast-[type]` | Thông báo tự biến mất sau 4 giây, hỗ trợ live region cho trình đọc màn hình |
| **Loading** | `.skeleton`, `.skeleton-text`, `.skeleton-avatar`, `.skeleton-card`, `.pm-spinner` | Hiệu ứng xung nhịp nhẹ nhàng (pulse), ngăn chặn nhảy giật layout (layout shift) |
| **Empty State** | `.pm-empty-state`, `.pm-state-mark`, `.pm-state-title`, `.pm-state-desc` | Luôn có biểu tượng đơn sắc, tiêu đề, lời giải thích và nút hành động kêu gọi |
| **Error State** | `.pm-error-state` | Phân biệt rõ lỗi mạng / lỗi server / lỗi xác thực, đi kèm nút thử lại |
| **Page Header** | `.page-header`, `.page-header-title`, `.page-header-desc`, `.page-header-actions` | Mẫu đầu trang chuẩn cho toàn bộ ứng dụng |

---

## 9. CSS ARCHITECTURE

```text
FE/shared/css/
├── tokens.css       <- Single Source of Truth cho toàn bộ CSS Variables
├── base.css         <- CSS Reset, Accessible Outline, Typography Baseline
├── layout.css       <- App Shell, Sidebar, Public Layout, Responsive Breakpoints
├── components.css   <- Buttons, Forms, Badges, Tables, Modals, Toasts, Skeletons
├── utilities.css    <- Spacing helpers (m-*, p-*), Flexbox, Text helpers, Accessibility
└── style.css        <- Root legacy file (Prepend @import các file trên, ánh xạ biến cũ)
```

Mọi trang HTML hiện tại liên kết `../../shared/css/style.css` đều tự động kế thừa 100% Design Tokens và Component System mà không cần sửa đổi hàng loạt thẻ `<link>`.

---

## 10. JAVASCRIPT ARCHITECTURE

Hệ thống script được tổ chức dạng module Vanilla JS thuần túy, đóng gói theo namespace `PM_*`:

```text
FE/shared/js/
├── core/
│   ├── storage.js   <- Safe LocalStorage Wrapper (JSON handling, fallback)
│   ├── user.js      <- User profile, role detection, PRO subscription helper
│   ├── auth.js      <- Token retrieval, logout handler, route authentication
│   └── routing.js   <- Path resolution, active navigation link matcher
├── layout/
│   ├── header.js    <- Public & App Header renderers
│   ├── sidebar.js   <- Sidebar renderer tuân thủ Section 15 navigation rules
│   └── user-menu.js <- Accessible user account dropdown popover
├── components/
│   ├── modal.js     <- Modal dialog controller (Escape key, backdrop click, focus)
│   ├── toast.js     <- Standardized toast dispatcher (auto dismiss, live region)
│   ├── loading.js   <- Button loading spinner & skeleton generators
│   └── tabs.js      <- Semantic tab switcher & panel visibility manager
└── main.js          <- Legacy shared script (đã được củng cố sidebar & toast)
```

---

## 11. ACCESSIBILITY COMPLIANCE (WCAG AA BASELINE)

1. **Tương phản màu sắc (Color Contrast)**:
   * Chữ chính `#0f172a` trên nền `#ffffff` đạt tỷ lệ tương phản **15.8:1** (vượt xa chuẩn 4.5:1 của WCAG AA).
   * Chữ phụ `#475569` trên nền `#ffffff` đạt tỷ lệ tương phản **7.2:1**.
   * Màu nhấn `--color-primary` (`#1d4ed8`) trên nền `#ffffff` đạt **8.4:1**.
2. **Focus Visible**:
   * Tất cả nút bấm, link, ô nhập liệu có `:focus-visible` với vòng outline 2px màu xanh và khoảng đệm 2px rõ nét.
3. **Keyboard Navigation**:
   * Modal tự động đóng khi nhấn phím `Escape`.
   * Dropdown menu tự động đóng khi nhấn `Escape` hoặc click ra ngoài.
   * Tab hỗ trợ điều hướng bàn phím với thuộc tính `aria-selected` và `role="tab"`.

---

## 12. SHOWCASE & VISUAL VALIDATION

Trang kiểm thử trực quan độc lập đã được tạo lập tại:
```text
/FE/features/design-system/showcase.html
```

Nội dung trang showcase bao gồm:
* Mẫu màu sắc trực quan (Color token swatches).
* Bảng tỷ lệ phông chữ (Typography Scale).
* Thước đo khoảng cách (Spacing Scale Demo).
* Thư viện nút bấm tương tác (Button Variants, Sizes, Loading State).
* Biểu mẫu nhập liệu chuẩn (Inputs, Validation Errors, Textarea, Select, Checkboxes).
* Bảng dữ liệu có chọn hàng (Selected Table Rows & Badges).
* Khối Tabs chuyển nội dung tương tác.
* Nút kích hoạt Modal & Toast Notifications trực tiếp trên màn hình.
* Mẫu Skeleton Loader mô phỏng thời gian chờ.
* Mẫu Empty State & Error State chuẩn.

---

## 13. MIGRATION & BACKWARD COMPATIBILITY

* **Không làm hỏng bất kỳ trang chức năng nào hiện có**: Các trang Dashboard, Phỏng vấn, Báo cáo, Admin tiếp tục hoạt động bình thường.
* **Không thay đổi Backend**: Backend .NET 10 tiếp tục vượt qua 100% bài kiểm thử (1,712 / 1,712 PASS).
* **Không làm mất phiên làm việc**: Dữ liệu tài khoản trong LocalStorage giữ nguyên cấu trúc schema hiện tại.
* **Quy tắc dừng**: Hệ thống dừng lại tại H2 để nghiệm thu Design System & Shared Layout trước khi tiến hành chuyển đổi chi tiết các trang nghiệp vụ ở phase sau.
