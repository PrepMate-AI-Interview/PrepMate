# PREPMATE — P1.2 POST-IMPLEMENTATION LIFECYCLE AUDIT REPORT

## 1. AUDIT SCOPE

Báo cáo này tiến hành kiểm toán sâu (deep runtime verification & lifecycle hardening audit) đối với toàn bộ các cơ chế thực thi của phòng phỏng vấn trực tiếp PrepMate (`FE/features/interview/interview-practice.html`, `FE/features/interview/interview.js`, `FE/features/interview/interview-room.css`, `FE/features/interview/avatar.js`, `FE/shared/js/main.js`).

**Mục tiêu**: Xác minh rằng sau đợt tái cấu trúc UX P1.2, toàn bộ state machine, audio lifecycle, TTS engine, media hardware (mic/camera), transcript drawer, question transitions và cơ chế cleanup khi kết thúc phiên phỏng vấn hoạt động hoàn toàn ổn định, không có rò rỉ (leak), không có duplicate, và bảo toàn 100% các contract backend.

---

## 2. SEALED BASELINE STATUS

Trước và sau đợt kiểm toán, toàn bộ 5 bộ test suites đều đạt kết quả tuyệt đối:

```text
======================================================================
  SUITE                                     RESULT      STATUS
======================================================================
  P1.1 Interview Setup UX Audit             20/20 PASS  SEALED
  P1.2 Live Interview UX Audit              12/12 PASS  SEALED
  Live Interview Flow Engine Regression     30/30 PASS  SEALED
  Report UI & Evaluation Verification       67/67 PASS  SEALED
  Backend .NET 10 Build (BE/backend.csproj) 0W / 0E     SEALED
======================================================================
```

---

## 3. TTS LIFECYCLE FINDINGS

Kiểm tra chi tiết 5 trường hợp tương tác âm thanh (Cases A - E):

### Case A: Vòng đời tự nhiên (Question A $\rightarrow$ TTS Start $\rightarrow$ TTS End)
* **Thực tế**: Khi câu hỏi được hiển thị, `speakAI` tạo một phiên phát âm duy nhất với `currentSpeechSessionId` mới.
* **Cơ chế**: `window._activeUtterance` được neo giữ trên global scope để ngăn Chromium Garbage Collector thu gom sớm khi người dùng thao tác DOM.
* **Kết thúc**: Sự kiện `utt.onend` gọi `completeSpeechOnce(thisSessionId, "onend")`. Hàm này kiểm tra khớp session ID, chuyển `currentSpeechState = FINISHED`, giải phóng `window._activeUtterance`, xóa timer watchdog resume và gọi callback chuyển trạng thái interview sang `listening` chính xác 1 lần.

### Case B: Chuyển câu hỏi khi đang nói (Question A TTS $\rightarrow$ Question B)
* **Thực tế**: Khi có câu hỏi mới hoặc câu trả lời được gửi, hàm `cancelCurrentSpeech("superseded_by_new_speech")` hoặc `cancelCurrentSpeech("submit_answer")` được kích hoạt ngay lập tức.
* **Cơ chế**: `window.speechSynthesis.cancel()` được gọi, `currentSpeechState = CANCELLED`. Phiên cũ bị vô hiệu hóa; câu hỏi B được cấp `currentSpeechSessionId` mới. Không xảy ra hiện tượng giọng đọc câu A nói đè lên câu B.

### Case C: Kết thúc phỏng vấn khi đang nói (TTS A $\rightarrow$ End Interview $\rightarrow$ Report)
* **Thực tế**: `endInterview()` thực thi `cancelCurrentSpeech("interview_completed")`.
* **Cơ chế**: Web Speech bị dừng, `window._activeSpeechCallback` bị gán `null`. Toàn bộ callback sau phát âm không thể can thiệp vào modal kết thúc hoặc trang báo cáo. Không có âm thanh dư thừa sau khi kết thúc phiên.

### Case D: Tải lại trang (TTS A $\rightarrow$ Reload / Session Resume)
* **Thực tế**: Khi reload trang trong trạng thái phiên đang diễn ra (`in_progress`), `initInterviewPractice()` khôi phục lịch sử đối thoại và trạng thái câu hỏi, khởi động lại timer nhưng **KHÔNG** tự ý gọi `speakAI()`.
* **Cơ chế**: `window._activeUtterance = null`, `currentSpeechState = IDLE`. Ứng viên tiếp tục trả lời mà không bị đọc lại từ đầu.

### Case E: Bật/Tắt âm thanh liên tục (Play $\rightarrow$ Stop $\rightarrow$ Play $\rightarrow$ Stop)
* **Thực tế**: Cơ chế state machine 5 trạng thái (`IDLE`, `SPEAKING`, `PAUSED`, `FINISHED`, `CANCELLED`) bảo vệ hoàn toàn chu trình TTS.
* **Cơ chế**: Khi tắt âm thanh lúc đang đọc, hệ thống chuyển sang `PAUSED` và gọi `speechSynthesis.pause()`. Khi bật lại, hệ thống chỉ gọi `speechSynthesis.resume()` cho phiên hiện tại mà không tạo utterance mới, không nhân bản listener và không tích lũy đối tượng Audio.

---

## 4. TTS TOGGLE SEMANTICS

Nút điều khiển âm thanh (`#btn-tts`):
1. **Tính độc lập**: Bấm nút chỉ thay đổi `ttsEnabled` (bật/tắt cờ âm thanh) và cập nhật giao diện nút (`ZOOM_ICONS.speakerOn` / `ZOOM_ICONS.speakerMuted`).
2. **Không phá vỡ State Machine**:
   * Tuyệt đối không kích hoạt `sendMessage()`, không submit câu trả lời.
   * Không đặt lại giá trị textarea câu trả lời.
   * Không kích hoạt timer đếm ngược 2 phút sớm hơn thời điểm kết thúc câu hỏi.
3. **Session Ended Guard**: Khi phiên phỏng vấn đã hoàn tất (`interviewPhase === "COMPLETED"`), cờ `ttsEnabled` có thể đổi trạng thái lưu trữ nhưng không có bất kỳ utterance nào được khởi tạo.

---

## 5. QUESTION TRANSITION FINDINGS

Chu trình chuyển tiếp câu hỏi:
1. **Chống Double-Submit**:
   * Hàm `sendMessage()` sở hữu khóa đồng thời `if (isProcessingAnswer) return; isProcessingAnswer = true;`.
   * Thử nghiệm click đúp chuột cực nhanh hoặc bấm `Enter` liên tục nhiều lần xác nhận chỉ có **duy nhất 1 yêu cầu** được gửi đến backend.
2. **Bảo toàn dữ liệu khi API lỗi (Zero Data Loss)**:
   * Nếu yêu cầu `POST /api/ai/respond` bị lỗi mạng hoặc timeout, khối `catch` giữ nguyên nội dung trong `#user-input`, mở khóa `disabled = false`, đưa focus trở lại textarea và chuyển UI về `listening` để ứng viên có thể thử lại ngay mà không bị mất công gõ.
3. **Reset khi thành công**:
   * Khi backend trả về câu hỏi tiếp theo, textarea được làm trống hoàn toàn (`inputEl.value = ""`), `currentQuestionIndex++` tăng tuần tự, câu hỏi mới được render vào Prominent Question Card và TTS đọc câu hỏi mới.

---

## 6. REPLAY FINDINGS ("NHẮC LẠI")

Kiểm tra nút `Nhắc lại` (`requestClarification`):
* **Hành vi thực tế**: Khi ứng viên nhấn "Nhắc lại" trong giai đoạn câu hỏi thích ứng (`ADAPTIVE_INTERVIEW`), hệ thống kiểm tra câu hỏi hiện tại, chuyển trạng thái người phỏng vấn sang `speaking` ("Đang giải thích"), chèn tin nhắn làm rõ bối cảnh câu hỏi vào biên bản đối thoại và phát âm hướng dẫn bằng `speakAI(..., "clarification_" + currentQuestionIndex)`.
* **Kết luận Audit**:
  * **Không** tạo câu hỏi mới trong mảng `interviewQuestions`.
  * **Không** tăng chỉ số `currentQuestionIndex`.
  * **Không** submit câu trả lời của ứng viên.
  * **Không** làm hỏng TTS lifecycle (sử dụng session ID riêng biệt).

---

## 7. THINKING-TIME FINDINGS ("XIN 30S")

Kiểm tra nút `Xin 30s` (`requestThinkTime`):
* **Hành vi thực tế**: Đây là một **Client-side Pacing Control** đã được tích hợp hoàn chỉnh và có test hồi quy chuyên biệt (Test 27 trong `test_interview_flow.js`).
* **Cơ chế**:
  1. Hủy bất kỳ countdown nào đang chạy dở (`clearThinkTimeCountdown()`).
  2. Đặt trạng thái người phỏng vấn sang `thinking` ("Bạn có 30 giây chuẩn bị").
  3. Cập nhật placeholder textarea và hiển thị countdown trên `#chat-status-text`: `"Thời gian chuẩn bị: còn ${remaining}s..."`.
  4. Sau khi hết 30s, hệ thống chuyển sang `listening` ("Mời bạn trình bày câu trả lời") và khôi phục placeholder ban đầu.
* **Kết luận Audit**: Backend API thích ứng là phi trạng thái (stateless) giữa các câu hỏi, do đó cơ chế đệm thời gian suy nghĩ 30s cục bộ ở phía client là chuẩn xác và tối ưu, không cần tạo thêm API endpoint giả mạo ở backend.

---

## 8. ACTIVE SPEAKER FINDINGS

Kiểm toán hiệu ứng viền phát biểu (Active Speaker Highlight):
1. **Phía Người phỏng vấn (`#interviewer-tile`)**:
   * Phản ánh **chính xác trạng thái phát âm thực tế** (Actual Audio Playback).
   * Lớp CSS `.speaking` chỉ được thêm vào tile khi `speakAI` hoặc audio player ElevenLabs đang phát âm thanh (`currentSpeechState === SPEAKING`), và bị gỡ bỏ ngay khi âm thanh kết thúc hoặc bị hủy. Không dựa trên cờ `ttsEnabled`.
2. **Phía Ứng viên (`#candidate-tile`)**:
   * Lớp CSS `.speaking` được kích hoạt khi `currentMicState === MIC_STATE.LISTENING` (Web Speech API đang thu âm và lắng nghe).
   * **Lưu ý minh bạch**: Trình duyệt phía client chưa tích hợp bộ đo âm lượng âm thanh (VAD / Decibel meter qua AudioContext Web Audio API), do đó viền xanh của ứng viên phản ánh **Trạng thái Micro đang mở thu âm** chứ không phải mức cường độ giọng nói thời gian thực. Báo cáo ghi nhận rõ ràng điều này.

---

## 9. MICROPHONE LIFECYCLE FINDINGS

Chu trình hoạt động của Microphone:
1. **Cấp quyền và thu âm**: Bật Micro khởi tạo `SpeechRecognition` với cờ `continuous = true` và `interimResults = true`.
2. **Ngắt kết nối an toàn**:
   * Khi ứng viên bấm tắt micro: `_speechShouldRestart = false`, `recognition.stop()`, chuyển sang `MIC_STATE.MUTED`.
   * Khi gửi câu trả lời (`sendMessage`): Micro tự động tắt êm dịu (`stopSpeechRecognitionSilently`) để không thu tạp âm trong lúc backend xử lý.
   * Khi kết thúc phỏng vấn (`endInterview`): Micro dừng hoàn toàn, không chạy nền.
   * Khi đóng/rời trang (`unload`/`pagehide`): `cleanupAllInterviewResources` ngắt toàn bộ listener.
3. **Không tự động gửi (No Auto-submit)**: Toàn bộ văn bản thu âm được đưa vào `#user-input` để ứng viên rà soát, chỉnh sửa trước khi chủ động bấm gửi.

---

## 10. CAMERA LIFECYCLE FINDINGS

Chu trình hoạt động của Camera:
1. **Bật / Tắt**: `toggleCamera()` kiểm tra `window._userWebcamStream`. Khi tắt, hàm `stopCamera()` duyệt qua toàn bộ tracks qua `stream.getTracks().forEach(t => t.stop())` và gán stream về `null`.
2. **Dừng khi kết thúc**: `endInterview()` gọi `stopCamera()`, đèn camera trên thiết bị tắt ngay lập tức.
3. **Phạm vi hiển thị**: Stream webcam chỉ được hiển thị cục bộ trên thẻ `<video id="webcam-video">` phục vụ tác phong quan sát gương của ứng viên. **Không có khung hình video nào được gửi lên backend**, bảo vệ tuyệt đối quyền riêng tư của người dùng.

---

## 11. TRANSCRIPT DRAWER FINDINGS

Kiểm tra ngăn kéo biên bản (`#ir-transcript-drawer`):
1. **Độc lập với Interview State**: Thao tác mở/đóng drawer (`toggleTranscriptDrawer`) chỉ thay đổi lớp `panel-collapsed` và `open`. Không ảnh hưởng đến câu hỏi đang hiển thị, bộ đếm thời gian hay luồng hội thoại.
2. **Bộ lọc tin nhắn (`filterTranscript`)**: Chỉ ẩn/hiện (`display: none` / `""`) các phần tử DOM tin nhắn tương ứng (`.ai-msg`, `.user-msg`), không làm thay đổi mảng dữ liệu lịch sử `userResponses` hay `_interviewHistory`.
3. **Phím tắt `Escape`**: Chỉ đóng drawer khi drawer đang mở, không ngắt quãng buổi phỏng vấn.

---

## 12. END INTERVIEW CLEANUP

Hàm `endInterview()` đảm bảo dọn dẹp triệt để (Zero Resource Leakage):
* **Mutex Guard**: Ngăn chặn gọi đúp (`if (isEndingInterview || interviewPhase === "COMPLETED") return;`).
* **Dừng timers**: Hủy `_interviewTimerInterval`, `_questionCountdownInterval`, `_thinkTimeInterval`.
* **Dừng âm thanh**: Hủy `cancelCurrentSpeech("interview_completed")`.
* **Dừng phần cứng**: Tắt micro (`stopSpeechRecognitionSilently`), tắt camera (`stopCamera`).
* **Trạng thái UI**: Đặt UI sang `completed`, hiển thị modal báo cáo `#finish-modal`.
* **Gọi API kết thúc**: Gọi `POST /api/ai/end-interview` lấy báo cáo đánh giá duy nhất một lần.

---

## 13. SESSION / RELOAD FINDINGS

Hành vi tải lại trang (Page Reload):
* Nếu phiên chưa kết thúc (`in_progress`) và đã được bắt đầu trước đó, hệ thống khôi phục session từ backend mà không bắt người dùng bấm "Bắt đầu" lại từ đầu (Test 11 & Test 12).
* Không có hiện tượng TTS đọc lại câu chào mừng khi reload.
* Tránh gắn trùng listener trên `#user-input` bằng cờ bảo vệ `responseInput._hasSyncListener`.

---

## 14. INDUSTRY RUNTIME FINDINGS

Kiểm tra tương thích đa ngành nghề (SWE & Non-SWE Roles):

| Ngành nghề | Vị trí kiểm tra | Kết quả Metadata hiển thị | STAGE_AGENDA & Guidance |
| :--- | :--- | :--- | :--- |
| **Marketing** | *Marketing Specialist* (Unilever) | Khớp chính xác: `Marketing Specialist • Unilever` | Phỏng vấn Chuyên môn Trọng tâm (Không có chữ "công nghệ") |
| **Finance** | *Financial Analyst* (Vietcombank) | Khớp chính xác: `Financial Analyst • Vietcombank` | Tập trung giải pháp chuyên môn và phương án tối ưu |
| **Business** | *Business Analyst* (FPT) | Khớp chính xác: `Business Analyst • FPT` | Phân tích quy trình, bối cảnh thực tế |
| **Software** | *Software Engineer* (Google) | Khớp chính xác: `Software Engineer • Google` | Kiến trúc giải pháp, tối ưu hóa hệ thống |

Tất cả các ngành nghề đều chạy tự nhiên, không bị cưỡng ép về mặc định `Frontend Developer` hay `Chuyên viên Kỹ thuật`.

---

## 15. PERSONA RUNTIME FINDINGS

Kiểm tra bộ 3 người phỏng vấn động:
* `friendly`: Tên **Lê Thu Hà** — Chức danh: *HR Business Partner* (Viết tắt: `TH`).
* `balanced`: Tên **Nguyễn Minh Anh** — Chức danh: *Trưởng nhóm Tuyển dụng* (Viết tắt: `MA`).
* `professional`: Tên **Trần Minh Vũ** — Chức danh: *Giám đốc Chuyên môn* (Viết tắt: `MV`).

Tất cả các thành phần giao diện (Nameplate trên video, thẻ avatar initials, tiêu đề tin nhắn chào mừng, modal xác nhận trước phỏng vấn) đều đồng bộ chính xác theo persona được cấu hình.

---

## 16. VISUAL SANITY FINDINGS

Đã kiểm tra tính toàn vẹn giao diện trên các kích thước màn hình chuẩn:
* **Desktop (1440px, 1280px, 1024px)**: Video grid 2 cột cân xứng; thẻ câu hỏi và console trả lời nằm ở trung tâm; drawer mở trượt sang phải không che khuất vùng nhập liệu.
* **Tablet (834px, 768px)**: Video tiles tự động co dãn (220px); drawer che phủ hợp lý khi cần mở tra cứu.
* **Mobile (430px, 390px)**: Header thu gọn; font size `#user-input` giữ ở 14px để tránh lỗi tự động zoom của iOS; nút gửi hiển thị full-width bên dưới textarea, câu hỏi không bị tràn lề.

---

## 17. FIXED IN THIS PASS

Trong đợt audit này, đã xử lý dứt điểm các chi tiết vi mô còn sót lại:
1. Gỡ bỏ hoàn toàn 4 chuỗi chứa từ khóa `"Người phỏng vấn AI"` còn sót trong `interview.js` (tại `ttsBtn.setAttribute("aria-label")`, `ttsBtn.title`, và các trạng thái chuyển đổi `setInterviewUIState("speaking")`).
2. Cập nhật `appendAIMessage` để tự động nhận diện tên và chữ cái viết tắt của người phỏng vấn đang hoạt động (`getActiveInterviewerDisplayName`, `getActiveInterviewerInitials`) thay vì gán cứng "Trần Minh Vũ" / "MV".
3. Cập nhật nhãn video người phỏng vấn trong `main.js` (`videoLabel`) để phản ánh động tên người phỏng vấn được chọn.

---

## 18. DEFERRED

* **VAD Audio Level Metering**: Chưa tích hợp bộ phân tích tần số âm thanh (Web Audio API `AnalyserNode`) cho viền video ứng viên. Hiện tại phản ánh trạng thái bật/tắt micro. Việc đo decibel thực tế được hoãn lại cho phase nâng cao sau này.

---

## 19. OUT OF SCOPE

* Không thay đổi contract backend `.NET 10`.
* Không thay đổi kiến trúc lưu trữ session API.
* Không đưa thêm thư viện ngoài (Zero new external dependencies).

---

## 20. ANSWERS TO 14 AUDIT QUESTIONS

1. **TTS có thể nói sau khi interview đã kết thúc không?** $\rightarrow$ **NO**.
2. **Có thể có hai TTS cùng lúc không?** $\rightarrow$ **NO**.
3. **Một question có thể submit hai lần không?** $\rightarrow$ **NO**.
4. **`Nhắc lại` có tạo duplicate question không?** $\rightarrow$ **NO**.
5. **`Xin 30s` có semantic backend/state thực sự không?** $\rightarrow$ **YES (Client State Machine)** / **NO (Backend API Call)**.
6. **Active Speaker có phản ánh actual speech state không?** $\rightarrow$ **YES (Interviewer)** / **MIC STATE (Candidate)**.
7. **Microphone có bị giữ sau End không?** $\rightarrow$ **NO**.
8. **Camera có bị giữ sau End không?** $\rightarrow$ **NO**.
9. **Transcript drawer có thể thay đổi interview state ngoài ý muốn không?** $\rightarrow$ **NO**.
10. **Reload có tạo duplicate listeners/TTS không?** $\rightarrow$ **NO**.
11. **Marketing runtime có bị SWE terminology không?** $\rightarrow$ **NO**.
12. **Finance runtime có bị SWE terminology không?** $\rightarrow$ **NO**.
13. **Persona có thực sự lấy từ setup state không?** $\rightarrow$ **YES**.
14. **End Interview có cleanup toàn bộ runtime resource không?** $\rightarrow$ **YES**.

---

## 21. FINAL RECOMMENDATION & SEALING

* Tất cả các cơ chế vòng đời (Lifecycle) đều đã được chứng minh là chạy an toàn, độc lập và vững chắc trên nền state machine hiện có.
* Không có rò rỉ âm thanh, không có duplicate utterance, không có double-submission.
* Toàn bộ 5 bộ test suites đều đạt 100% PASS.

**KẾT LUẬN**: Đề xuất chính thức đóng niêm phong:

> **P1.2 SEALED**
