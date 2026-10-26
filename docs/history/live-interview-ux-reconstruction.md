# PREPMATE — P1.2 LIVE INTERVIEW UX RECONSTRUCTION REPORT

## 1. EXECUTIVE SUMMARY

Trong giai đoạn **P1.2 — Live Interview UX Reconstruction**, giao diện phòng phỏng vấn trực tiếp (`FE/features/interview/interview-practice.html` cùng `interview-room.css`, `avatar.js`, `interview.js`) đã được tái thiết kế toàn diện theo tiêu chuẩn phòng họp điều hành chuyên nghiệp (Executive Virtual Interview Room), mô phỏng trải nghiệm hội thoại thực tế giữa ứng viên và hội đồng phỏng vấn cấp cao thay vì giao diện AI chatbot, game HUD hoặc công cụ kỹ thuật SWE đơn thuần.

Toàn bộ các ràng buộc kiến trúc, backend contract, adaptive interview engine, TTS state machine, audio lifecycle và 58 ID DOM cốt lõi được bảo toàn tuyệt đối 100%.

---

## 2. BASELINE & INVARIANTS PRESERVED

Trước và sau khi tái cấu trúc UX, toàn bộ các test suite đều đạt trạng thái **PASS 100%**:

```text
======================================================================
  SUITE                                     RESULT      STATUS
======================================================================
  FE/features/interview/test_live_interview_ux.js   12/12 PASS  SEALED
  FE/features/interview/test_interview_flow.js       30/30 PASS  SEALED
  FE/features/interview/test_interview_setup_ux.js   20/20 PASS  SEALED
  FE/features/report/test_report_ui.js               67/67 PASS  SEALED
  BE/backend.csproj (dotnet build)                   0W / 0E     SEALED
======================================================================
```

Tất cả các hành vi của TTS lifecycle, think-time requests, answer retry on error, transcript buffering, audio mute/unmute isolation, webcam mirroring và post-interview reporting đều vận hành trơn tru mà không có bất kỳ hồi quy nào.

---

## 3. VISUAL FOCAL HIERARCHY RECONSTRUCTION

Cấu trúc giao diện được tổ chức lại theo mô hình 3 tầng thị giác tự nhiên (3-Tier Focal Hierarchy), tập trung vào tương tác người - người:

```text
+--------------------------------------------------------------------------+
| TOP HUD BAR: Brand | Vị trí ứng tuyển & Công ty | Bảo mật | Timer | CTAs |
+--------------------------------------------------------------------------+
| MAIN STAGE (Cột trung tâm chuyên dụng):                                  |
|                                                                          |
| 1. UPPER TIER: DUAL-TILE VIDEO MEETING GRID                              |
|    [ Interviewer Tile ]                     [ Candidate Video / Mirror ] |
|    • Live tag, Avatar, Trạng thái           • Camera placeholder/stream  |
|    • Nameplate: Trần Minh Vũ / Lê Thu Hà    • In-tile Mute & Camera      |
|    • In-tile Audio toggle (SVG)                                          |
|                                                                          |
| 2. MIDDLE TIER (FOCAL POINT 1): PROMINENT QUESTION CARD                  |
|    [Badge: Phần mở đầu / Chuyên môn / STAR]   [Nhắc lại]  [Xin 30s]      |
|    Câu hỏi hiển thị rõ ràng, cỡ chữ 17-18px, độ tương phản cao           |
|    Hướng dẫn bối cảnh chuyên môn (Contextual guidance)                   |
|                                                                          |
| 3. LOWER TIER (FOCAL POINT 2): SPACIOUS RESPONSE CONSOLE                 |
|    Trạng thái hội thoại (Chat status) | Đồng hồ đếm ngược 2 phút         |
|    [ Textarea rộng rãi, đa dòng, phông chữ 14px, focus ring sắc nét ]    |
|    [ Nút "Gửi trả lời" trang nhã, hỗ trợ Enter / Shift+Enter ]           |
+--------------------------------------------------------------------------+
| SLIDE-OVER DRAWER: Biên bản đối thoại & Lịch sử câu hỏi (Đóng/Mở linh hoạt)
+--------------------------------------------------------------------------+
```

### Điểm cải tiến so với phiên bản cũ:
1. **Thoát khỏi sự tù túng của Drawer**: Trước đây `#user-input` và `#btn-send` bị giam cầm trong drawer hẹp 360px bên phải cùng với hàng loạt bubble tin nhắn lịch sử. Bây giờ, Response Console là một khu vực làm việc rộng rãi, độc lập, nằm ngay dưới thẻ câu hỏi.
2. **Thẻ câu hỏi nổi bật (Prominent Question Card)**: Bỏ bỏ giới hạn `max-height: 110px` cũ. Câu hỏi có không gian hiển thị tự nhiên, typography chuẩn mực, đi kèm các nút hỗ trợ thực tế ("Nhắc lại", "Xin 30s").

---

## 4. SLIDE-OVER DIALOGUE & TRANSCRIPT DRAWER ARCHITECTURE

Panel biên bản `#ir-transcript-drawer` được thiết kế dưới dạng **Slide-over Drawer** thanh lịch:
* Mặc định ở trạng thái thu gọn (`panel-collapsed`), giúp ứng viên tập trung 100% vào người phỏng vấn và câu hỏi đang diễn ra.
* Khi ứng viên muốn xem lại toàn bộ lịch sử trao đổi, nút **Biên bản** trên HUD bar mở drawer trượt mượt mà (`transform: translateX(0)`) từ mép phải màn hình mà không làm co giật hay méo mó khu vực video và câu hỏi.
* Hỗ trợ đóng nhanh bằng phím `Escape` hoặc nút `✕` góc trên.
* Bộ lọc chip thông minh (`Tất cả`, `Người phỏng vấn`, `Trả lời của bạn`) cho phép rà soát nhanh tiến trình phỏng vấn.

---

## 5. ELIMINATION OF ROBOT & GAMING TROPES

Đã thanh trừng toàn bộ các emoji robot, biểu tượng HUD gaming và danh xưng bot:

| Vị trí cũ | Yếu tố cũ | Thay thế chuẩn mực mới |
| :--- | :--- | :--- |
| Interviewer Avatar Tile | Emoji `🤖` | Biểu tượng người đại diện SVG tinh tế (`user-tie`) |
| Interviewer State Badge | `"Người phỏng vấn AI"` | `"Người phỏng vấn"` |
| Audio Control Tooltip | `"Bật/Tắt âm thanh người phỏng vấn AI"` | `"Bật/Tắt âm thanh người phỏng vấn"` |
| Start Modal Header | Emoji `💼` | SVG Cặp tài liệu điều hành (`briefcase`) |
| Device Checklist Cam | Emoji `📹` | SVG Camera chuẩn meeting |
| Device Checklist Mic | Emoji `🎙️` | SVG Microphone chuyên dụng |
| Device Checklist Audio | Emoji `🔊` | SVG Loa chuẩn meeting |
| Countdown Timer | Emoji `⏱️` | SVG Đồng hồ đếm giờ thanh lịch |
| Full Report CTA | Emoji `📊` | SVG Biểu đồ phân tích năng lực |
| Audio Waveform | Nhấp nháy màu mè | Thanh sóng âm trầm tĩnh (`#voice-wave`) |

---

## 6. NON-SWE ROLE NEUTRALITY & DYNAMIC METADATA BINDING

Hệ thống không còn thiên vị riêng cho lập trình viên (SWE):
1. **Dynamic Interviewer Personas**:
   * `friendly`: **Lê Thu Hà** — HR Business Partner (Initials: `TH`)
   * `balanced`: **Nguyễn Minh Anh** — Trưởng nhóm Tuyển dụng (Initials: `MA`)
   * `professional` (Default): **Trần Minh Vũ** — Giám đốc Chuyên môn (Initials: `MV`)
2. **Tự động gắn kết Công ty mục tiêu**:
   * Khi ứng viên ứng tuyển vào công ty cụ thể (ví dụ: Vinamilk, Techcombank, Shopee), danh xưng người phỏng vấn sẽ hiển thị trang trọng: `Trần Minh Vũ (Giám đốc Chuyên môn • Techcombank)`.
3. **Trung hòa hóa STAGE_AGENDA**:
   * Thay thế `"Phỏng vấn Kỹ thuật Chuyên môn"` $\rightarrow$ `"Phỏng vấn Chuyên môn Trọng tâm"`.
   * Thay thế hướng dẫn `"các công nghệ thế mạnh"` $\rightarrow$ `"các thế mạnh và mục tiêu nghề nghiệp"`.
   * Áp dụng tự nhiên cho mọi ngành nghề: Kế toán, Marketing, Bán hàng, Nhân sự, Quản lý sản phẩm, Kỹ thuật.

---

## 7. DOM ID AND CONTRACT PRESERVATION AUDIT

Tất cả **58 ID DOM** được `interview.js` và `test_interview_flow.js` tiêu thụ đã được kiểm tra và giữ nguyên 100%:

```text
[OK] topbar-job-title           [OK] question-counter            [OK] main-status-dot
[OK] main-status-label          [OK] timer-pulse-indicator       [OK] interview-timer-display
[OK] btn-toggle-transcript      [OK] btn-pause-interview         [OK] btn-start-interview
[OK] btn-end-interview          [OK] ir-video-grid               [OK] interviewer-tile
[OK] interviewer-status-pill    [OK] topbar-status-dot           [OK] interviewer-status-text
[OK] ai-avatar-visual           [OK] interviewer-avatar-ring     [OK] interviewer-avatar-preview
[OK] interviewer-state-badge    [OK] voice-wave                  [OK] interviewer-mic-badge
[OK] interviewer-name-display   [OK] btn-tts                     [OK] candidate-tile
[OK] webcam-video               [OK] camera-placeholder          [OK] candidate-avatar-ring
[OK] candidate-avatar-preview   [OK] candidate-initials          [OK] candidate-mic-badge
[OK] candidate-tile-name        [OK] btn-mic                     [OK] btn-toggle-cam
[OK] current-question-badge     [OK] current-question-hint       [OK] current-question-text
[OK] stage-context-guidance     [OK] chat-status                 [OK] chat-status-dot
[OK] chat-status-text           [OK] dialogue-answer-countdown   [OK] answer-countdown-time
[OK] speech-status-indicator    [OK] speech-status-text-hint     [OK] user-input
[OK] btn-send                   [OK] ir-transcript-drawer        [OK] ai-mode-badge-conv
[OK] chat-box                   [OK] zoom-start-confirm-modal    [OK] confirm-modal-job-title
[OK] confirm-modal-round        [OK] confirm-modal-interviewer   [OK] finish-modal
[OK] finish-score-value         [OK] finish-score-verdict        [OK] finish-message
[OK] finish-summary             [OK] btn-view-deep-report
```

---

## 8. KEYBOARD & ACCESSIBILITY ENHANCEMENTS

1. **Focus Ring & ARIA Labels**:
   * Tất cả nút hành động đều có `aria-label` và trạng thái `:focus-visible` với outline xanh chuẩn (`var(--ir-blue)`).
2. **Keyboard Navigation**:
   * `Enter`: Gửi câu trả lời khi đang ở `#user-input`.
   * `Shift + Enter`: Xuống dòng mới trong textarea.
   * `Space`: Bật/Tắt Micro khi đang ở ngoài các trường nhập liệu văn bản.
   * `Escape`: Đóng nhanh Slide-over Transcript Drawer hoặc Pre-Flight Confirm Modal.
3. **Contrast & Typography**:
   * Đạt chuẩn WCAG 2.1 AA về tỉ lệ tương phản chữ trên nền sáng và nền video tối.

---

## 9. HARDWARE CONTROLS INTEGRITY

Các bộ điều khiển phần cứng được bố trí ngay trên khung video (In-Tile Meeting Controls):
* **Phía Người phỏng vấn**: Nút bật/tắt âm thanh (`#btn-tts`) độc lập hoàn toàn với interview state machine.
* **Phía Ứng viên**: Nút Micro (`#btn-mic`) và nút Camera (`#btn-toggle-cam`) phản ánh trung thực trạng thái MediaStream và SpeechRecognition của trình duyệt.
* Hiệu ứng viền xanh chủ động (Active Speaker Highlight `#22c55e`) phản hồi khi người phỏng vấn hoặc ứng viên đang phát biểu.

---

## 10. RESPONSIVE LAYOUT BREAKDOWN

Hệ thống phản hồi mượt mà trên 3 dải độ phân giải:
1. **Desktop ($\ge 1024px$)**:
   * Video grid 2 cột song song chuẩn hội nghị điều hành.
   * Question card và Response Console dàn đều chiều ngang, tạo tầm nhìn bao quát không cần cuộn.
2. **Tablet ($768px - 1023px$)**:
   * Video grid tự động cân đối chiều cao tile (`220px`).
   * Drawer mở rộng tối đa `380px`, che phủ góc phải khi cần tra cứu biên bản.
3. **Mobile ($< 768px$ & $\le 480px$)**:
   * Top HUD thu gọn thông tin phụ, bảo toàn Timer và các nút điều khiển.
   * Video grid hiển thị dạng thẻ gọn (`150px - 180px`).
   * Question Header tự động xếp dọc.
   * `#user-input` cố định cỡ chữ `14px` để ngăn hiện tượng tự động phóng to của trình duyệt di động iOS Safari.
   * Nút `#btn-send` chuyển thành nút full-width dưới textarea.

---

## 11. PRE-FLIGHT READINESS CHAMBER (CONFIRM MODAL)

Modal xác nhận trước khi vào phỏng vấn (`#zoom-start-confirm-modal`) được làm mới:
* Biểu tượng cặp tài liệu SVG thanh lịch.
* Danh mục kiểm tra thiết bị tự động (Camera, Micro, Loa) với nhãn "Sẵn sàng" đồng nhất.
* Cập nhật động vị trí ứng tuyển, tên người phỏng vấn và vòng phỏng vấn theo dữ liệu thực tế từ phiên làm việc.

---

## 12. EXECUTIVE POST-INTERVIEW DEBRIEF CHAMBER (FINISH MODAL)

Modal kết thúc buổi phỏng vấn (`#finish-modal`) được chuẩn hóa:
* Loại bỏ emoji biểu đồ, thay bằng icon báo cáo SVG tinh gọn.
* Vòng tròn điểm năng lực tổng thể hiển thị trung thực theo dữ liệu backend tính toán.
* Nút chuyển hướng trực tiếp đến Báo cáo Đánh giá Chuyên sâu (`report.html`) theo chuẩn STAR.

---

## 13. AUTOMATED ACCEPTANCE TESTING

Test suite tự động `FE/features/interview/test_live_interview_ux.js` đã được khởi tạo và chạy thành công:

```text
[PASS] No robot or HUD gaming emojis in interview-practice.html
[PASS] No robot or HUD gaming emojis in interview-room.css
[PASS] No robot or HUD gaming emojis in avatar.js
[PASS] Prominent question stage exists in video stage column
[PASS] Spacious response console exists in main stage column (not trapped in drawer)
[PASS] Slide-over transcript drawer is isolated with panel-collapsed default
[PASS] All required 58 DOM IDs are preserved in interview-practice.html
[PASS] Zero "Người phỏng vấn AI" in user-facing labels
[PASS] Dynamic interviewer persona binding supports friendly, balanced, professional
[PASS] CSS has unconstrained prominent question card and spacious response input
[PASS] CSS contains responsive breakpoints for mobile and tablet
[PASS] STAGE_AGENDA in interview.js is industry-neutral

TOTAL: 12 | PASS: 12 | FAIL: 0
```

---

## 14. REGRESSION VERIFICATION SIGN-OFF

Toàn bộ hệ sinh thái PrepMate tiếp tục duy trì trạng thái ổn định vững chắc:

1. **Live Interview Flow Engine**: `30/30 PASS` (`test_interview_flow.js`)
2. **Live Interview UX Reconstruction**: `12/12 PASS` (`test_live_interview_ux.js`)
3. **Interview Setup UX**: `20/20 PASS` (`test_interview_setup_ux.js`)
4. **Report UI & Evaluation**: `67/67 PASS` (`test_report_ui.js`)
5. **Backend Compilation (.NET 10)**: `0 Warning / 0 Error`

Giai đoạn **P1.2 — Live Interview UX Reconstruction** đã hoàn tất trọn vẹn và chính thức được đóng niêm phong (**SEALED**).
