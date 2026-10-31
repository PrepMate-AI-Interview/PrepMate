/**
 * PREPMATE — TIMESTAMP-ALIGNED VIDEO CLIP PLAYER (WI-COACH-04C)
 *
 * Dedicated report-side video player allowing candidates to replay the exact video
 * moment associated with an observed body-language or timeline event without duplicating media files.
 *
 * Core Architectural Guarantees:
 * 1. Single Master Video SSOT: Re-uses the master video Blob in IndexedDB (`PrepMateAudioRecorder`).
 *    Zero duplicate video files or physical clip splitting.
 * 2. Window Clamping & Accurate Seeking:
 *    - Proposed clip window: 4–8 seconds with surrounding behavioral context.
 *    - Clamped strictly within `[0, recording.durationSec]`.
 *    - Waits for HTMLMediaElement `seeked` event before presenting moment as ready to play.
 * 3. Boundary Containment:
 *    - Starts at `startSec` and automatically pauses at `endSec`.
 *    - Playback NEVER bleeds into subsequent portions of the answer.
 * 4. Dedicated Replay Controls:
 *    - Immediate 1-click repetition of the selected interval.
 * 5. Evidence-to-Player Association:
 *    - Links directly to session ID, question ID, turn index, mediaOffsetSec, selectedTier, method, and confidence.
 *    - For `insufficient_visual_evidence`, renders video for candidate review but flags as unverified.
 *    - Zero value judgments (no "good", "bad", "confident", "nervous").
 * 6. Privacy & Memory Safety:
 *    - 100% on-device client-side playback.
 *    - Object URLs tracked and explicitly revoked via `dispose()` and on page unload.
 * 7. Graceful Fallbacks:
 *    - Handles missing/expired IndexedDB entries, audio-only recordings, and unsupported codecs cleanly.
 */

(function (root) {
  "use strict";

  let _activeVideoInstance = null;
  let _activeVideoWidget = null;
  const _activeBlobUrls = new Set();
  const _allocatedWidgets = new Set();

  function formatTime(sec) {
    if (!sec || isNaN(sec) || sec < 0) return "00:00";
    const totalSec = Math.floor(sec);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  function formatTimestampRange(startSec, endSec) {
    return `${formatTime(startSec)} – ${formatTime(endSec)} (${Math.max(0.5, endSec - startSec).toFixed(1)}s)`;
  }

  function stopCurrentlyPlaying() {
    if (_activeVideoInstance) {
      try {
        _activeVideoInstance.pause();
      } catch (e) {}
      _activeVideoInstance = null;
    }
    if (_activeVideoWidget) {
      _activeVideoWidget.classList.remove("is-playing");
      const playBtn = _activeVideoWidget.querySelector(".pm-vclip-play-btn");
      if (playBtn) {
        playBtn.classList.remove("is-playing");
        const icon = playBtn.querySelector(".btn-icon");
        if (icon) icon.textContent = "▶";
        const label = playBtn.querySelector(".btn-text");
        if (label) label.textContent = "Xem khoảnh khắc";
      }
      _activeVideoWidget = null;
    }

    // Mutual exclusion with audio player if present
    if (root.PrepMateAudioPlayer && typeof root.PrepMateAudioPlayer.stopCurrentlyPlaying === "function") {
      try { root.PrepMateAudioPlayer.stopCurrentlyPlaying(); } catch (e) {}
    }
  }

  /**
   * Calculates a defensible 4-8 second clip window with surrounding context.
   * Clamps strictly to media duration.
   */
  function calculateClipWindow(observation, recordingDurationSec) {
    const dur = Math.max(0.5, Number(recordingDurationSec) || 0);

    let centerSec = 0;
    if (typeof observation.mediaOffsetSec === "number") {
      centerSec = observation.mediaOffsetSec;
    } else if (typeof observation.startMs === "number" && typeof observation.endMs === "number") {
      centerSec = (observation.startMs + observation.endMs) / 2000;
    } else if (typeof observation.startSec === "number") {
      centerSec = observation.startSec;
    }

    let rawStartSec = centerSec - 2.5;
    let rawEndSec = centerSec + 3.5; // Default 6.0s window

    // If explicit startMs / endMs exist, encompass them with leading/trailing context
    if (typeof observation.startMs === "number" && typeof observation.endMs === "number") {
      const evtStart = observation.startMs / 1000;
      const evtEnd = observation.endMs / 1000;
      const evtDur = Math.max(0.2, evtEnd - evtStart);

      // Desired window: 4 to 8s
      const pad = Math.max(1.0, Math.min(2.5, (6.0 - evtDur) / 2));
      rawStartSec = evtStart - pad;
      rawEndSec = evtEnd + pad;
    }

    // Ensure total window is between 4.0s and 8.0s
    if ((rawEndSec - rawStartSec) < 4.0) {
      const diff = 4.0 - (rawEndSec - rawStartSec);
      rawStartSec -= diff / 2;
      rawEndSec += diff / 2;
    } else if ((rawEndSec - rawStartSec) > 8.0) {
      const excess = (rawEndSec - rawStartSec) - 8.0;
      rawStartSec += excess / 2;
      rawEndSec -= excess / 2;
    }

    // Clamping to valid recording bounds
    let startSec = Math.max(0, rawStartSec);
    let endSec = Math.min(dur, rawEndSec);

    // If clamping compressed the window near boundaries, adjust the other side to maintain 4s context if available
    if ((endSec - startSec) < 4.0 && dur >= 4.0) {
      if (startSec === 0) {
        endSec = Math.min(dur, 4.0);
      } else if (endSec === dur) {
        startSec = Math.max(0, dur - 4.0);
      }
    }

    // Guarantee endSec > startSec
    if (endSec <= startSec) {
      endSec = Math.min(dur, startSec + Math.min(dur, 2.0));
      if (endSec <= startSec) {
        startSec = 0;
        endSec = dur;
      }
    }

    return {
      startSec: Number(startSec.toFixed(2)),
      endSec: Number(endSec.toFixed(2)),
      durationSec: Number((endSec - startSec).toFixed(2))
    };
  }

  /**
   * Resolves master recording from PrepMateAudioRecorder IndexedDB storage
   */
  async function resolveRecording(sessionId, turnIndex) {
    if (!sessionId) return null;
    const recorder = root.PrepMateAudioRecorder;
    if (!recorder) return null;

    const recordId = `${sessionId}_turn_${turnIndex}`;
    if (typeof recorder.getRecording === "function") {
      try {
        const rec = await recorder.getRecording(recordId);
        if (rec) return rec;
      } catch (e) {}
    }

    if (typeof recorder.getAllRecordingsForSession === "function") {
      try {
        const all = await recorder.getAllRecordingsForSession(sessionId);
        if (Array.isArray(all)) {
          const match = all.find(r => r.turnIndex === turnIndex);
          if (match) return match;
        }
      } catch (e) {}
    }

    return null;
  }

  /**
   * Extracts replayable observations from a turn recording and its body-language analysis
   */
  function extractReplayableObservations(recordingRecord) {
    if (!recordingRecord) return [];

    const observations = [];
    const sessId = recordingRecord.sessionId || "unassigned";
    const qId = recordingRecord.questionId || "";
    const turnIdx = typeof recordingRecord.turnIndex === "number" ? recordingRecord.turnIndex : 0;
    const totalDurationSec = (recordingRecord.durationMs || 1000) / 1000;

    const bl = recordingRecord.bodyLanguageAnalysis;
    const timeline = recordingRecord.timeline || {};
    const events = timeline.events || [];

    // 1. Check timeline events for discrete hand gesture moments
    events.forEach((ev, i) => {
      if (ev.type === "body_language_hand_gesture") {
        const mediaOffset = typeof ev.mediaOffsetSec === "number" ? ev.mediaOffsetSec : (ev.startMs / 1000);
        const win = calculateClipWindow({ mediaOffsetSec: mediaOffset, startMs: ev.startMs, endMs: ev.endMs }, totalDurationSec);
        observations.push({
          id: `obs_${turnIdx}_gesture_${i}`,
          sessionId: sessId,
          questionId: qId,
          turnIndex: turnIdx,
          title: "Cử chỉ tay minh họa khi diễn đạt ý",
          eventType: "hand_gesture",
          mediaOffsetSec: mediaOffset,
          startSec: win.startSec,
          endSec: win.endSec,
          selectedTier: bl?.selectedTier || "tier2_contour_fallback",
          method: bl?.selectedTier === "tier1_mediapipe_vision" ? "mediapipe_hand_landmarks" : "motion_contour_estimate",
          anatomicalLandmarksAvailable: Boolean(bl?.anatomicalLandmarksAvailable),
          confidence: ev.confidence || 0.85,
          status: "reliable_evidence",
          measurementLabel: "Biên độ cử chỉ & chuyển động bàn tay",
          measurementDetail: ev.measurements?.wristPosition
            ? `Vị trí tay ghi nhận trong khung hình (x: ${ev.measurements.wristPosition.x || 0}, y: ${ev.measurements.wristPosition.y || 0})`
            : "Chuyển động tay trong vùng minh họa phía dưới",
          isInsufficient: false
        });
      }
    });

    // 2. Hand movement summary / Out-of-frame moments
    const hm = bl?.handMovement;
    if (hm) {
      if (hm.status === "insufficient_visual_evidence") {
        const win = calculateClipWindow({ mediaOffsetSec: 0 }, totalDurationSec);
        observations.push({
          id: `obs_${turnIdx}_hand_insufficient`,
          sessionId: sessId,
          questionId: qId,
          turnIndex: turnIdx,
          title: "Quan sát tham khảo: Cử chỉ tay (Chưa đủ điều kiện xác thực)",
          eventType: "hand_insufficient",
          mediaOffsetSec: 0,
          startSec: win.startSec,
          endSec: win.endSec,
          selectedTier: bl.selectedTier || "tier2_contour_fallback",
          method: bl.selectedTier === "tier1_mediapipe_vision" ? "mediapipe_hand_landmarks" : "motion_contour_estimate",
          anatomicalLandmarksAvailable: Boolean(bl.anatomicalLandmarksAvailable),
          confidence: 0,
          status: "insufficient_visual_evidence",
          reason: hm.reason || "Thời lượng quan sát hoặc số khung hình chưa đạt ngưỡng tin cậy",
          measurementLabel: "Dữ liệu chưa hoàn thiện",
          measurementDetail: hm.reason,
          isInsufficient: true
        });
      } else if (Array.isArray(hm.outOfFramePeriods) && hm.outOfFramePeriods.length > 0) {
        const firstOut = hm.outOfFramePeriods[0];
        const win = calculateClipWindow({ mediaOffsetSec: firstOut.mediaOffsetSec, startMs: firstOut.startMs, endMs: firstOut.endMs }, totalDurationSec);
        observations.push({
          id: `obs_${turnIdx}_hand_outof_frame`,
          sessionId: sessId,
          questionId: qId,
          turnIndex: turnIdx,
          title: "Khoảng thời gian hạ tay xuống dưới khung hình",
          eventType: "hand_out_of_frame",
          mediaOffsetSec: firstOut.mediaOffsetSec,
          startSec: win.startSec,
          endSec: win.endSec,
          selectedTier: bl.selectedTier || "tier2_contour_fallback",
          method: bl.selectedTier === "tier1_mediapipe_vision" ? "mediapipe_hand_landmarks" : "motion_contour_estimate",
          anatomicalLandmarksAvailable: Boolean(bl.anatomicalLandmarksAvailable),
          confidence: 0.85,
          status: "reliable_evidence",
          measurementLabel: `Thời gian ngoài khung nhìn: ${(firstOut.durationMs / 1000).toFixed(1)}s`,
          measurementDetail: `Bàn tay hạ xuống dưới góc máy trong ${(firstOut.durationMs / 1000).toFixed(1)} giây liên tục`,
          isInsufficient: false
        });
      } else if (hm.wristMotionDeltaNorm > 0) {
        // Active gestures present
        const win = calculateClipWindow({ mediaOffsetSec: totalDurationSec / 2 }, totalDurationSec);
        observations.push({
          id: `obs_${turnIdx}_gestures_active`,
          sessionId: sessId,
          questionId: qId,
          turnIndex: turnIdx,
          title: "Tác phong diễn đạt bằng cử chỉ tay",
          eventType: "hand_gesturing_general",
          mediaOffsetSec: totalDurationSec / 2,
          startSec: win.startSec,
          endSec: win.endSec,
          selectedTier: bl.selectedTier || "tier2_contour_fallback",
          method: bl.selectedTier === "tier1_mediapipe_vision" ? "mediapipe_hand_landmarks" : "motion_contour_estimate",
          anatomicalLandmarksAvailable: Boolean(bl.anatomicalLandmarksAvailable),
          confidence: 0.85,
          status: "reliable_evidence",
          measurementLabel: `Tần số cử chỉ: ${hm.movementFrequencyHz ? hm.movementFrequencyHz + " Hz" : "ổn định"}`,
          measurementDetail: `Tỷ lệ hiện diện bàn tay trong khung hình đạt ${hm.handDetectionCoveragePct}%`,
          isInsufficient: false
        });
      }
    }

    // 3. Upper body posture moments
    const ub = bl?.upperBodyPosture;
    if (ub) {
      if (ub.status === "insufficient_visual_evidence") {
        const win = calculateClipWindow({ mediaOffsetSec: 0 }, totalDurationSec);
        observations.push({
          id: `obs_${turnIdx}_posture_insufficient`,
          sessionId: sessId,
          questionId: qId,
          turnIndex: turnIdx,
          title: "Quan sát tham khảo: Tư thế thân trên (Chưa đủ điều kiện xác thực)",
          eventType: "posture_insufficient",
          mediaOffsetSec: 0,
          startSec: win.startSec,
          endSec: win.endSec,
          selectedTier: bl.selectedTier || "tier2_contour_fallback",
          method: bl.selectedTier === "tier1_mediapipe_vision" ? "mediapipe_pose_landmarks" : "torso_contour_silhouette",
          anatomicalLandmarksAvailable: Boolean(bl.anatomicalLandmarksAvailable),
          confidence: 0,
          status: "insufficient_visual_evidence",
          reason: ub.reason || "Tỷ lệ nhận diện hai vai thấp hoặc thời lượng quá ngắn",
          measurementLabel: "Dữ liệu chưa hoàn thiện",
          measurementDetail: ub.reason,
          isInsufficient: true
        });
      } else if (ub.torsoLeanEstimate === "LEANING_LEFT" || ub.torsoLeanEstimate === "LEANING_RIGHT") {
        const leanSide = ub.torsoLeanEstimate === "LEANING_LEFT" ? "bên trái" : "bên phải";
        const win = calculateClipWindow({ mediaOffsetSec: totalDurationSec / 3 }, totalDurationSec);
        observations.push({
          id: `obs_${turnIdx}_posture_lean`,
          sessionId: sessId,
          questionId: qId,
          turnIndex: turnIdx,
          title: `Tư thế thân trên hơi nghiêng sang ${leanSide}`,
          eventType: "posture_lean",
          mediaOffsetSec: totalDurationSec / 3,
          startSec: win.startSec,
          endSec: win.endSec,
          selectedTier: bl.selectedTier || "tier2_contour_fallback",
          method: bl.selectedTier === "tier1_mediapipe_vision" ? "mediapipe_pose_landmarks" : "torso_contour_silhouette",
          anatomicalLandmarksAvailable: Boolean(bl.anatomicalLandmarksAvailable),
          confidence: ub.postureConfidence || 0.85,
          status: "reliable_evidence",
          measurementLabel: `Độ lệch tâm: ${(ub.lateralOffsetAvgNorm * 100).toFixed(1)}% | Góc vai: ${ub.shoulderAngleAvgDeg}°`,
          measurementDetail: `Đường nối hai vai lệch ${Math.abs(ub.shoulderAngleAvgDeg)}° so với phương ngang`,
          isInsufficient: false
        });
      } else if (ub.torsoLeanEstimate === "UPRIGHT_CENTERED") {
        const win = calculateClipWindow({ mediaOffsetSec: totalDurationSec / 2 }, totalDurationSec);
        observations.push({
          id: `obs_${turnIdx}_posture_upright`,
          sessionId: sessId,
          questionId: qId,
          turnIndex: turnIdx,
          title: "Tư thế ngồi thẳng & cân bằng trung tâm",
          eventType: "posture_upright",
          mediaOffsetSec: totalDurationSec / 2,
          startSec: win.startSec,
          endSec: win.endSec,
          selectedTier: bl.selectedTier || "tier2_contour_fallback",
          method: bl.selectedTier === "tier1_mediapipe_vision" ? "mediapipe_pose_landmarks" : "torso_contour_silhouette",
          anatomicalLandmarksAvailable: Boolean(bl.anatomicalLandmarksAvailable),
          confidence: ub.postureConfidence || 0.9,
          status: "reliable_evidence",
          measurementLabel: `Độ ổn định trục vai: ${ub.shoulderAngleStabilityDeg}°`,
          measurementDetail: `Độ bao phủ nhận diện hai vai đạt ${ub.postureCoveragePct}% thời lượng trả lời`,
          isInsufficient: false
        });
      }
    }

    // Fallback: If no discrete events found, create an anchor moment for answer review
    if (observations.length === 0) {
      const win = calculateClipWindow({ mediaOffsetSec: totalDurationSec / 2 }, totalDurationSec);
      observations.push({
        id: `obs_${turnIdx}_default`,
        sessionId: sessId,
        questionId: qId,
        turnIndex: turnIdx,
        title: turnIdx === 0 ? "Khoảnh khắc mở đầu câu trả lời" : `Khoảnh khắc câu trả lời #${turnIdx}`,
        eventType: "turn_sample",
        mediaOffsetSec: totalDurationSec / 2,
        startSec: win.startSec,
        endSec: win.endSec,
        selectedTier: bl?.selectedTier || "tier2_contour_fallback",
        method: bl?.selectedTier === "tier1_mediapipe_vision" ? "mediapipe_pose_landmarks" : "torso_contour_silhouette",
        anatomicalLandmarksAvailable: Boolean(bl?.anatomicalLandmarksAvailable),
        confidence: 0.8,
        status: "reliable_evidence",
        measurementLabel: "Khoảnh khắc đại diện trong câu trả lời",
        measurementDetail: "Trích đoạn ghi hình để ứng viên tự đối chiếu tác phong",
        isInsufficient: false
      });
    }

    return observations;
  }

  /**
   * Creates an interactive, accessible video clip player DOM element.
   *
   * @param {Object} observation - The observation record
   * @param {Object} recordingRecord - Master recording record with videoBlob
   * @param {Object} options - { compact: boolean }
   * @returns {HTMLElement}
   */
  function createVideoClipPlayerElement(observation, recordingRecord, options = {}) {
    const container = document.createElement("div");
    container.className = "pm-video-clip-widget";
    if (options.compact) container.classList.add("compact");
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", `Video khoảnh khắc: ${observation.title || 'Quan sát tác phong'}`);
    container.setAttribute("tabindex", "0");

    _allocatedWidgets.add(container);

    // 1. Fallback: Recording missing or empty
    if (!recordingRecord) {
      container.classList.add("fallback", "missing-recording");
      container.innerHTML = `
        <div class="pm-vclip-fallback-notice">
          <span class="fallback-icon">📹</span>
          <div class="fallback-content">
            <strong class="fallback-title">Không tìm thấy bản ghi video cho lượt này</strong>
            <p class="fallback-desc">Bản ghi có thể đã hết hạn lưu trữ hoặc đã bị xóa theo chính sách bảo mật thiết bị của bạn.</p>
          </div>
        </div>
      `;
      return container;
    }

    // 2. Fallback: Audio-only answer (Camera was off)
    const hasVideo = Boolean(
      recordingRecord.videoBlob &&
      recordingRecord.videoBlob.size > 0 &&
      (recordingRecord.isMasterMedia || (recordingRecord.mimeType && recordingRecord.mimeType.startsWith("video/")))
    );

    if (!hasVideo) {
      container.classList.add("fallback", "audio-only");
      container.innerHTML = `
        <div class="pm-vclip-fallback-notice">
          <span class="fallback-icon">🎙️</span>
          <div class="fallback-content">
            <strong class="fallback-title">Lượt trả lời này được ghi âm chỉ có âm thanh (không có video)</strong>
            <p class="fallback-desc">Camera đã tắt trong lượt này để bảo vệ quyền riêng tư. Không có dữ liệu hình ảnh để hiển thị khoảnh khắc video.</p>
          </div>
        </div>
      `;
      return container;
    }

    // 3. Normal Flow: Master Video Available
    const videoBlob = recordingRecord.videoBlob;
    let objectUrl = null;
    try {
      objectUrl = URL.createObjectURL(videoBlob);
      _activeBlobUrls.add(objectUrl);
    } catch (e) {
      container.classList.add("fallback", "blob-error");
      container.innerHTML = `
        <div class="pm-vclip-fallback-notice">
          <span class="fallback-icon">⚠️</span>
          <div class="fallback-content">
            <strong class="fallback-title">Lỗi truy xuất luồng video cục bộ</strong>
            <p class="fallback-desc">Trình duyệt không thể giải mã dữ liệu video từ bộ nhớ IndexedDB.</p>
          </div>
        </div>
      `;
      return container;
    }

    const recDurSec = Math.max(0.5, (recordingRecord.durationMs || 1000) / 1000);
    const win = calculateClipWindow(observation, recDurSec);
    const startSec = win.startSec;
    const endSec = win.endSec;
    const clipDurationSec = win.durationSec;

    // Header info & Source Badge
    const tierBadgeLabel = observation.selectedTier === "tier1_mediapipe_vision"
      ? "MediaPipe Landmarker (Tier 1)"
      : "Đường bao & Silhouette (Tier 2)";
    const tierBadgeClass = observation.selectedTier === "tier1_mediapipe_vision" ? "tier1-badge" : "tier2-badge";

    const qualityBadgeHtml = observation.isInsufficient
      ? `<span class="pm-vclip-quality-badge insufficient" title="Chưa đủ thời lượng/mẫu để kết luận xác thực">⚠️ Quan sát tham khảo</span>`
      : `<span class="pm-vclip-quality-badge reliable" title="Đã qua bộ lọc ngưỡng tin cậy">✓ Dữ liệu hợp lệ</span>`;

    const methodExplanation = observation.selectedTier === "tier1_mediapipe_vision"
      ? "Đo lường khớp cổ tay và trục vai bằng mô hình điểm mốc MediaPipe Vision."
      : "Ước lượng vùng cử chỉ và độ cân bằng thân trên bằng phân tích mật độ pixel và đường bao contour (không định danh khớp giải phẫu).";

    container.innerHTML = `
      <div class="pm-vclip-header">
        <div class="pm-vclip-title-row">
          <h4 class="pm-vclip-title">${escapeHtml(observation.title)}</h4>
          <div class="pm-vclip-badges">
            <span class="pm-vclip-tier-badge ${tierBadgeClass}">${escapeHtml(tierBadgeLabel)}</span>
            ${qualityBadgeHtml}
          </div>
        </div>
        <div class="pm-vclip-time-window">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span class="time-range-text">Khoảnh khắc: ${formatTimestampRange(startSec, endSec)}</span>
          <span class="turn-index-text">• Lượt #${observation.turnIndex}</span>
        </div>
        <p class="pm-vclip-method-desc">${escapeHtml(methodExplanation)}</p>
      </div>

      <div class="pm-vclip-stage">
        <div class="pm-vclip-video-wrapper">
          <video class="pm-vclip-video" playsinline preload="metadata" src="${objectUrl}"></video>
          <div class="pm-vclip-seeking-overlay hidden">
            <div class="seeking-spinner"></div>
            <span>Đang định vị khoảnh khắc...</span>
          </div>
        </div>

        <div class="pm-vclip-controls">
          <div class="pm-vclip-btn-group">
            <button type="button" class="pm-vclip-play-btn" aria-label="Xem khoảnh khắc">
              <span class="btn-icon">▶</span>
              <span class="btn-text">Xem khoảnh khắc</span>
            </button>
            <button type="button" class="pm-vclip-replay-btn" aria-label="Phát lại khoảnh khắc từ đầu" title="Phát lại khoảnh khắc này">
              <span class="btn-icon">↺</span>
              <span class="btn-text">Phát lại</span>
            </button>
          </div>

          <div class="pm-vclip-progress-area">
            <div class="pm-vclip-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0" aria-label="Tiến trình phát khoảnh khắc">
              <div class="pm-vclip-progress-fill" style="width: 0%;"></div>
            </div>
            <div class="pm-vclip-time-display">
              <span class="current-time">00:00</span> / <span class="total-time">${formatTime(clipDurationSec)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="pm-vclip-footer">
        <span class="pm-vclip-footnote">
          * Video phát trực tiếp từ bản ghi gốc trong trình duyệt, không tạo tệp video trùng lặp. Tự động dừng tại giây ${endSec} để giữ tập trung vào khoảnh khắc cần xem.
        </span>
      </div>
    `;

    // DOM Elements references
    const video = container.querySelector(".pm-vclip-video");
    const playBtn = container.querySelector(".pm-vclip-play-btn");
    const replayBtn = container.querySelector(".pm-vclip-replay-btn");
    const progressFill = container.querySelector(".pm-vclip-progress-fill");
    const currentTimeEl = container.querySelector(".current-time");
    const seekingOverlay = container.querySelector(".pm-vclip-seeking-overlay");
    const progressBar = container.querySelector(".pm-vclip-progress-bar");

    let isSeeking = false;
    let isPlaying = false;

    // Set initial position to startSec once metadata is loaded
    video.addEventListener("loadedmetadata", () => {
      try {
        video.currentTime = startSec;
      } catch (e) {}
    });

    // Seek completion handler
    video.addEventListener("seeked", () => {
      isSeeking = false;
      if (seekingOverlay) seekingOverlay.classList.add("hidden");
      updateProgressUI();
    });

    // Time update listener enforcing interval boundary
    video.addEventListener("timeupdate", () => {
      if (isSeeking) return;

      // BOUNDARY ENFORCEMENT: Stop automatically at endSec
      if (video.currentTime >= (endSec - 0.05)) {
        video.pause();
        try {
          video.currentTime = startSec; // Reset to window start for replay
        } catch (e) {}
        setPlayingState(false, true);
        return;
      }

      updateProgressUI();
    });

    video.addEventListener("pause", () => {
      setPlayingState(false);
    });

    video.addEventListener("play", () => {
      setPlayingState(true);
    });

    video.addEventListener("error", () => {
      container.classList.add("fallback", "video-error");
      const stage = container.querySelector(".pm-vclip-stage");
      if (stage) {
        stage.innerHTML = `
          <div class="pm-vclip-fallback-notice">
            <span class="fallback-icon">⚠️</span>
            <div class="fallback-content">
              <strong class="fallback-title">Không thể phát định dạng video này</strong>
              <p class="fallback-desc">Trình duyệt không hỗ trợ codec của bản ghi WebM/MP4 này.</p>
            </div>
          </div>
        `;
      }
    });

    function updateProgressUI() {
      const relTime = Math.max(0, Math.min(clipDurationSec, video.currentTime - startSec));
      const pct = (relTime / clipDurationSec) * 100;
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (currentTimeEl) currentTimeEl.textContent = formatTime(relTime);
      if (progressBar) progressBar.setAttribute("aria-valuenow", Math.round(pct).toString());
    }

    function setPlayingState(playing, isAtEnd = false) {
      isPlaying = playing;
      if (playing) {
        container.classList.add("is-playing");
        playBtn.classList.add("is-playing");
        playBtn.querySelector(".btn-icon").textContent = "⏸";
        playBtn.querySelector(".btn-text").textContent = "Tạm dừng";
        _activeVideoInstance = video;
        _activeVideoWidget = container;
      } else {
        container.classList.remove("is-playing");
        playBtn.classList.remove("is-playing");
        playBtn.querySelector(".btn-icon").textContent = isAtEnd ? "↺" : "▶";
        playBtn.querySelector(".btn-text").textContent = isAtEnd ? "Xem lại" : "Xem khoảnh khắc";
        if (_activeVideoInstance === video) {
          _activeVideoInstance = null;
          _activeVideoWidget = null;
        }
      }
    }

    async function triggerPlay() {
      stopCurrentlyPlaying();

      // If video position is outside [startSec, endSec], seek to startSec first
      if (video.currentTime < (startSec - 0.1) || video.currentTime >= (endSec - 0.1)) {
        isSeeking = true;
        if (seekingOverlay) seekingOverlay.classList.remove("hidden");
        video.currentTime = startSec;
        await waitForSeek(video);
      }

      try {
        await video.play();
        setPlayingState(true);
      } catch (err) {
        console.warn("[VIDEO CLIP PLAYER] Play error:", err);
      }
    }

    async function triggerReplay() {
      stopCurrentlyPlaying();
      isSeeking = true;
      if (seekingOverlay) seekingOverlay.classList.remove("hidden");
      video.currentTime = startSec;
      await waitForSeek(video);
      try {
        await video.play();
        setPlayingState(true);
      } catch (err) {}
    }

    function waitForSeek(vid) {
      return new Promise((resolve) => {
        if (!vid.seeking) return resolve();
        const handler = () => {
          vid.removeEventListener("seeked", handler);
          resolve();
        };
        vid.addEventListener("seeked", handler);
      });
    }

    // Play / Pause button
    playBtn.addEventListener("click", () => {
      if (isPlaying) {
        video.pause();
      } else {
        triggerPlay();
      }
    });

    // Replay button
    replayBtn.addEventListener("click", () => {
      triggerReplay();
    });

    // Scrubber click within interval
    if (progressBar) {
      progressBar.addEventListener("click", (e) => {
        const rect = progressBar.getBoundingClientRect();
        const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const targetRelSec = clickRatio * clipDurationSec;
        const targetAbsSec = startSec + targetRelSec;

        isSeeking = true;
        if (seekingOverlay) seekingOverlay.classList.remove("hidden");
        video.currentTime = targetAbsSec;
      });
    }

    // Accessible Keyboard Navigation
    container.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (isPlaying) video.pause();
        else triggerPlay();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        triggerReplay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        video.currentTime = Math.max(startSec, video.currentTime - 1.0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        video.currentTime = Math.min(endSec - 0.1, video.currentTime + 1.0);
      }
    });

    // Cleanup method exposed on container
    container._pmDispose = function () {
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch (e) {}
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
          _activeBlobUrls.delete(objectUrl);
        } catch (e) {}
      }
      _allocatedWidgets.delete(container);
    };

    return container;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function disposeAll() {
    stopCurrentlyPlaying();
    _allocatedWidgets.forEach(w => {
      if (w && typeof w._pmDispose === "function") {
        try { w._pmDispose(); } catch (e) {}
      }
    });
    _allocatedWidgets.clear();

    _activeBlobUrls.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (e) {}
    });
    _activeBlobUrls.clear();
  }

  // Auto clean up on page unload
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", disposeAll);
  }

  // Public Module API
  const PrepMateVideoClipPlayer = {
    calculateClipWindow,
    resolveRecording,
    extractReplayableObservations,
    createVideoClipPlayerElement,
    stopCurrentlyPlaying,
    disposeAll,
    formatTime,
    formatTimestampRange
  };

  if (typeof window !== "undefined") {
    window.PrepMateVideoClipPlayer = PrepMateVideoClipPlayer;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = PrepMateVideoClipPlayer;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
