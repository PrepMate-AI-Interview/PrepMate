/**
 * visual-coaching-engine.js
 * PREPMATE — Visual Presence, Frame Analysis & Temporal Body Language Engine (WI-COACH-VIDEO-01, WI-COACH-VIDEO-02B, WI-COACH-BODY-LANGUAGE-02)
 *
 * Provides objective, client-side camera setup and presentation analysis:
 * 1. Frame Resolution & Geometry checks.
 * 2. Pixel Luminance & Dynamic Range (ITU-R BT.601 Luma: Y = 0.299R + 0.587G + 0.114B).
 * 3. Exposure status: OPTIMAL, UNDEREXPOSED, OVEREXPOSED, BACKLIT, COVERED/DARK.
 * 4. Framing balance & spatial contrast distribution (Centered, Lean Left/Right).
 * 5. Temporal motion stability (inter-frame delta: Frozen, Natural, Erratic).
 * 6. On-device person presence & bounding box via calibrated YCbCr skin locus.
 * 7. Temporal body language tracking:
 *    - Relative Head Orientation (Facing Camera, Turned Left/Right, Tilted Down/Up).
 *    - Upper Body Posture (Upright Centered, Leaning Left/Right, Shoulders Out of Frame).
 *    - Hand Visibility & Gestures (Gesturing, Resting, Out of Frame).
 * 8. Structured 4-part observations: [Observation, Context, Limitation, Actionable Suggestion].
 *
 * Strict ethical & technical constraints:
 * - NO deception or emotion guessing from facial pixels.
 * - Does NOT affect Part A (Professional Competency Assessment: affectsProfessionalScore === false).
 * - Clear disclosure of local browser processing and canvas pixel heuristics.
 * - Explicit disclosure: Relative Head Orientation estimation, NOT Eye Gaze Tracking.
 */

(function (global) {
  "use strict";

  const ETHICAL_DISCLAIMER =
    "Nhận xét tác phong mang tính tham khảo kỹ thuật (ánh sáng, phát hiện chủ thể on-device, bố cục hình ảnh và xu hướng cử chỉ quan sát được), " +
    "không nhận diện sinh trắc học để định danh, không suy đoán tâm lý/cảm xúc và không ảnh hưởng đến điểm năng lực chuyên môn.";

  const METHODOLOGY = "HTML5 Canvas On-Device Person Detection & Spatial Chrominance/Luma Analysis (ITU-R BT.601 Luma + YCbCr Skin Locus, không suy đoán cảm xúc)";

  const LIGHTING_STATUS = {
    OPTIMAL: "OPTIMAL",
    ACCEPTABLE: "ACCEPTABLE",
    UNDEREXPOSED: "UNDEREXPOSED",
    OVEREXPOSED: "OVEREXPOSED",
    BACKLIT: "BACKLIT",
    INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  };

  const FRAMING_STATUS = {
    CENTERED: "CENTERED",
    LEAN_LEFT: "LEAN_LEFT",
    LEAN_RIGHT: "LEAN_RIGHT",
    UNBALANCED: "UNBALANCED",
    INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  };

  const MOTION_STABILITY = {
    NATURAL: "NATURAL",
    FROZEN_OR_STATIC: "FROZEN_OR_STATIC",
    ERRATIC_OR_SHAKY: "ERRATIC_OR_SHAKY",
    INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  };

  const DETECTION_STATUS = {
    CONFIDENT_DETECTION: "CONFIDENT_DETECTION",
    LOW_CONFIDENCE: "LOW_CONFIDENCE",
    NO_PERSON_DETECTED: "NO_PERSON_DETECTED",
    POOR_VISIBILITY: "POOR_VISIBILITY",
    MODEL_NOT_READY: "MODEL_NOT_READY",
    CAMERA_OFF: "CAMERA_OFF",
    INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  };

  const EVIDENCE_FRAMING = {
    OPTIMAL_CENTERED: "OPTIMAL_CENTERED",
    TOO_CLOSE: "TOO_CLOSE",
    TOO_FAR: "TOO_FAR",
    LEAN_LEFT: "LEAN_LEFT",
    LEAN_RIGHT: "LEAN_RIGHT",
    CUT_OFF_TOP: "CUT_OFF_TOP",
    CUT_OFF_BOTTOM: "CUT_OFF_BOTTOM",
    UNVERIFIED_NO_SUBJECT: "UNVERIFIED_NO_SUBJECT",
  };

  const LANDMARKS_STATUS = {
    HEAD_FEATURES_DETECTED: "HEAD_FEATURES_DETECTED",
    INSUFFICIENT_SHOULDERS: "INSUFFICIENT_SHOULDERS",
    NONE: "NONE",
  };

  const HEAD_ORIENTATION = {
    FACING_CAMERA: "FACING_CAMERA",
    TURNED_LEFT: "TURNED_LEFT",
    TURNED_RIGHT: "TURNED_RIGHT",
    TILTED_DOWN: "TILTED_DOWN",
    TILTED_UP: "TILTED_UP",
    UNVERIFIED_NO_SUBJECT: "UNVERIFIED_NO_SUBJECT",
  };

  const BODY_POSTURE = {
    UPRIGHT_CENTERED: "UPRIGHT_CENTERED",
    LEANING_LEFT: "LEANING_LEFT",
    LEANING_RIGHT: "LEANING_RIGHT",
    SHOULDERS_OUT_OF_FRAME: "SHOULDERS_OUT_OF_FRAME",
  };

  const HAND_GESTURES = {
    HANDS_GESTURING: "HANDS_GESTURING",
    HANDS_OBSERVED_RESTING: "HANDS_OBSERVED_RESTING",
    HANDS_NOT_IN_FRAME: "HANDS_NOT_IN_FRAME",
  };

  /**
   * Calculates ITU-R BT.601 Luma for an RGBA buffer.
   * Y = 0.299*R + 0.587*G + 0.114*B
   */
  function calculateLuma(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /**
   * On-device person presence detection using calibrated YCbCr skin locus + spatial bounding cluster.
   * Zero external API calls, offline-capable, respects complete user privacy.
   *
   * @param {Uint8ClampedArray|Array<number>} data - RGBA byte array
   * @param {number} width - Frame width
   * @param {number} height - Frame height
   * @param {Object} options - Custom detector hook or tuning parameters
   * @returns {Object} Detection result { hasPerson, confidence, status, reason, boundingBox, landmarks, landmarksStatus, postureFeedback }
   */
  function detectPersonPresence(data, width, height, options = {}) {
    if (!data || !width || !height || width <= 0 || height <= 0 || data.length < width * height * 4) {
      return {
        hasPerson: false,
        confidence: 0,
        status: DETECTION_STATUS.INSUFFICIENT_DATA,
        reason: "Dữ liệu khung hình không hợp lệ",
        boundingBox: null,
        landmarks: null,
        landmarksStatus: LANDMARKS_STATUS.NONE,
        postureFeedback: "Không có dữ liệu hình ảnh để đánh giá.",
      };
    }

    // Quick luma check for covered/pitch-black camera
    let lumaSum = 0;
    let sampleCount = 0;
    const step = Math.max(2, Math.floor(Math.min(width, height) / 120));

    for (let y = 0; y < height; y += step * 2) {
      for (let x = 0; x < width; x += step * 2) {
        const idx = (y * width + x) * 4;
        lumaSum += calculateLuma(data[idx], data[idx + 1], data[idx + 2]);
        sampleCount++;
      }
    }
    const meanLuma = sampleCount > 0 ? lumaSum / sampleCount : 0;
    if (meanLuma < 12) {
      return {
        hasPerson: false,
        confidence: 0,
        status: DETECTION_STATUS.POOR_VISIBILITY,
        reason: "Khung hình quá tối hoặc camera bị che",
        boundingBox: null,
        landmarks: null,
        landmarksStatus: LANDMARKS_STATUS.NONE,
        postureFeedback: "Khung hình quá tối để đánh giá tư thế.",
      };
    }

    // Allow custom detector if provided or attached
    if (typeof options.customDetector === "function") {
      try {
        const customRes = options.customDetector(data, width, height);
        if (customRes && customRes.status) return customRes;
      } catch (e) {}
    }

    // Skin locus & facial structure detection in YCbCr space
    const xs = [];
    const ys = [];
    let totalSkinSamples = 0;
    let scannedPixels = 0;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        scannedPixels++;

        // YCbCr transformation
        const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
        const cbVal = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const crVal = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

        // Calibrated skin locus
        const isSkinChromatic = (cbVal >= 80 && cbVal <= 124 && crVal >= 135 && crVal <= 173);
        const isSkinLuma = (yVal >= 40 && yVal <= 245);
        const isSkinRgb = (r > g && g > b && (r - g) >= 12 && (r - b) >= 20 && r >= 60);

        if (isSkinChromatic && isSkinLuma && isSkinRgb) {
          xs.push(x);
          ys.push(y);
          totalSkinSamples++;
        }
      }
    }

    const minRequiredSamples = Math.max(16, Math.floor((width * height) / (step * step * 100)));

    if (totalSkinSamples < minRequiredSamples) {
      return {
        hasPerson: false,
        confidence: 0,
        status: DETECTION_STATUS.NO_PERSON_DETECTED,
        reason: "Không phát hiện khuôn mặt hoặc chủ thể người trong khung hình",
        boundingBox: null,
        landmarks: null,
        landmarksStatus: LANDMARKS_STATUS.NONE,
        postureFeedback: "Không phát hiện chủ thể trong khung hình để nhận xét tư thế.",
      };
    }

    // Calculate robust percentiles (p10, p90) to reject outliers
    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);

    const p10Idx = Math.floor(totalSkinSamples * 0.10);
    const p90Idx = Math.min(totalSkinSamples - 1, Math.floor(totalSkinSamples * 0.90));

    const minX = xs[p10Idx];
    const maxX = xs[p90Idx];
    const minY = ys[p10Idx];
    const maxY = ys[p90Idx];

    // Compute skin centroid within inlier distribution
    let inlierSumX = 0;
    let inlierSumY = 0;
    let inlierCount = 0;
    for (let i = p10Idx; i <= p90Idx; i++) {
      inlierSumX += xs[i];
      inlierSumY += ys[i];
      inlierCount++;
    }
    const centroidX = inlierCount > 0 ? inlierSumX / inlierCount : (minX + (maxX - minX) / 2);
    const centroidY = inlierCount > 0 ? inlierSumY / inlierCount : (minY + (maxY - minY) / 2);

    const clusterWidth = Math.max(1, maxX - minX);
    const clusterHeight = Math.max(1, maxY - minY);
    const heightRatio = clusterHeight / height;
    const widthRatio = clusterWidth / width;
    const aspectRatio = clusterWidth / clusterHeight;
    const areaRatio = (clusterWidth * clusterHeight) / (width * height);
    const centerX = (minX + clusterWidth / 2) / width;
    const centerY = (minY + clusterHeight / 2) / height;

    // Expected face + head proportions: aspect ratio 0.50 to 1.55, height at least 10%
    const isAspectValid = (aspectRatio >= 0.50 && aspectRatio <= 1.55);
    const isHeightValid = (heightRatio >= 0.10);

    // Density within bounding box
    const boxSamplesPossible = (clusterWidth / step) * (clusterHeight / step);
    const density = boxSamplesPossible > 0 ? (totalSkinSamples * 0.8) / boxSamplesPossible : 0;

    let confidence = 0;
    if (isAspectValid && isHeightValid && density >= 0.15) {
      confidence = Math.min(0.96, Math.max(0.55, 0.50 + density * 0.35 + (heightRatio >= 0.18 ? 0.10 : 0)));
    } else if (isHeightValid || density >= 0.12) {
      confidence = Math.min(0.48, Math.max(0.22, 0.20 + density * 0.25));
    } else {
      confidence = 0.10;
    }

    const roundedConfidence = Math.round(confidence * 100) / 100;

    if (confidence >= 0.50) {
      return {
        hasPerson: true,
        confidence: roundedConfidence,
        status: DETECTION_STATUS.CONFIDENT_DETECTION,
        reason: `Đã nhận diện chủ thể người (độ tin cậy: ${Math.round(roundedConfidence * 100)}%)`,
        boundingBox: {
          x: minX,
          y: minY,
          width: clusterWidth,
          height: clusterHeight,
          centerX: Math.round(centerX * 100) / 100,
          centerY: Math.round(centerY * 100) / 100,
          centroidX: Math.round(centroidX * 10) / 10,
          centroidY: Math.round(centroidY * 10) / 10,
          heightRatio: Math.round(heightRatio * 100) / 100,
          areaRatio: Math.round(areaRatio * 100) / 100,
          maxY: ys[totalSkinSamples - 1],
        },
        landmarks: {
          features: "head_facial_contour",
          shouldersDetected: false,
        },
        landmarksStatus: LANDMARKS_STATUS.INSUFFICIENT_SHOULDERS,
        postureFeedback: "Khung hình chưa hiển thị đủ phần vai để đánh giá tư thế. Không nhận diện tư thế cơ thể hay cảm xúc.",
      };
    } else if (confidence >= 0.20) {
      return {
        hasPerson: false,
        confidence: roundedConfidence,
        status: DETECTION_STATUS.LOW_CONFIDENCE,
        reason: "Phát hiện tín hiệu mờ nhạt nhưng chưa đủ độ tin cậy",
        boundingBox: {
          x: minX,
          y: minY,
          width: clusterWidth,
          height: clusterHeight,
          centerX: Math.round(centerX * 100) / 100,
          centerY: Math.round(centerY * 100) / 100,
          centroidX: Math.round(centroidX * 10) / 10,
          centroidY: Math.round(centroidY * 10) / 10,
          heightRatio: Math.round(heightRatio * 100) / 100,
          areaRatio: Math.round(areaRatio * 100) / 100,
          maxY: ys[totalSkinSamples - 1],
        },
        landmarks: null,
        landmarksStatus: LANDMARKS_STATUS.NONE,
        postureFeedback: "Chưa đủ độ tin cậy để nhận xét tư thế.",
      };
    } else {
      return {
        hasPerson: false,
        confidence: roundedConfidence,
        status: DETECTION_STATUS.NO_PERSON_DETECTED,
        reason: "Không phát hiện khuôn mặt hoặc chủ thể người trong khung hình",
        boundingBox: null,
        landmarks: null,
        landmarksStatus: LANDMARKS_STATUS.NONE,
        postureFeedback: "Không phát hiện chủ thể trong khung hình.",
      };
    }
  }

  /**
   * Evidence-based framing evaluation based on detected subject bounding box.
   * If person is not detected, returns UNVERIFIED_NO_SUBJECT without guessing.
   *
   * @param {Object} detection - Result from detectPersonPresence
   * @param {number} width - Frame width
   * @param {number} height - Frame height
   * @returns {Object} { evidenceFraming, framingFeedback, isConfident }
   */
  function evaluateEvidenceFraming(detection, width, height) {
    if (!detection || detection.status !== DETECTION_STATUS.CONFIDENT_DETECTION || !detection.boundingBox) {
      const feedback = (!detection || detection.status === DETECTION_STATUS.NO_PERSON_DETECTED)
        ? "Chưa phát hiện người trong khung hình để đánh giá bố cục. Vui lòng ngồi trước camera."
        : (detection && detection.status === DETECTION_STATUS.POOR_VISIBILITY
          ? "Không thể đánh giá bố cục do khung hình quá tối."
          : "Chưa đủ độ tin cậy để nhận xét bố cục.");

      return {
        evidenceFraming: EVIDENCE_FRAMING.UNVERIFIED_NO_SUBJECT,
        framingFeedback: feedback,
        isConfident: false,
      };
    }

    const box = detection.boundingBox;
    const topRatio = box.y / height;
    const bottomRatio = (box.y + box.height) / height;
    const heightRatio = box.heightRatio;
    const widthRatio = box.width / width;
    const areaRatio = box.areaRatio;
    const centerX = box.centerX;
    const centerY = box.centerY;

    if (topRatio <= 0.06 || centerY < 0.25) {
      return {
        evidenceFraming: EVIDENCE_FRAMING.CUT_OFF_TOP,
        framingFeedback: "Đỉnh đầu có nguy cơ bị cắt khỏi khung hình (sát mép trên). Hãy hạ góc camera hoặc lùi lại một chút.",
        isConfident: true,
      };
    } else if (bottomRatio >= 0.96 && centerY > 0.72) {
      return {
        evidenceFraming: EVIDENCE_FRAMING.CUT_OFF_BOTTOM,
        framingFeedback: "Chủ thể bị cắt ở mép dưới khung hình. Gợi ý: Điều chỉnh góc camera hướng lên hoặc nâng độ cao máy.",
        isConfident: true,
      };
    } else if (heightRatio >= 0.55 || areaRatio >= 0.25 || widthRatio >= 0.48) {
      return {
        evidenceFraming: EVIDENCE_FRAMING.TOO_CLOSE,
        framingFeedback: `Chủ thể quá gần camera (khuôn mặt chiếm ${Math.round(heightRatio * 100)}% chiều cao). Gợi ý: Giữ khoảng cách 50-70cm để có góc nhìn tự nhiên.`,
        isConfident: true,
      };
    } else if (heightRatio < 0.18 || areaRatio < 0.04) {
      return {
        evidenceFraming: EVIDENCE_FRAMING.TOO_FAR,
        framingFeedback: `Chủ thể ở quá xa camera (chiếm ${Math.round(heightRatio * 100)}% chiều cao). Gợi ý: Ngồi gần hơn để biểu cảm rõ ràng hơn.`,
        isConfident: true,
      };
    } else if (centerX < 0.35) {
      return {
        evidenceFraming: EVIDENCE_FRAMING.LEAN_LEFT,
        framingFeedback: `Chủ thể lệch sang bên trái khung hình (tâm = ${Math.round(centerX * 100)}%). Gợi ý: Điều chỉnh ghế hoặc camera về trung tâm.`,
        isConfident: true,
      };
    } else if (centerX > 0.65) {
      return {
        evidenceFraming: EVIDENCE_FRAMING.LEAN_RIGHT,
        framingFeedback: `Chủ thể lệch sang bên phải khung hình (tâm = ${Math.round(centerX * 100)}%). Gợi ý: Điều chỉnh ghế hoặc camera về trung tâm.`,
        isConfident: true,
      };
    } else {
      return {
        evidenceFraming: EVIDENCE_FRAMING.OPTIMAL_CENTERED,
        framingFeedback: "Bố cục chủ thể cân đối ở trung tâm khung hình, khoảng cách và tỷ lệ đạt chuẩn phỏng vấn.",
        isConfident: true,
      };
    }
  }

  /**
   * Estimates relative head orientation (Facing Camera, Turned Left/Right, Tilted Down/Up).
   * Note: This is geometric head pose approximation, NOT eye gaze tracking.
   *
   * @param {Uint8ClampedArray|Array<number>} data - RGBA byte array
   * @param {number} width - Frame width
   * @param {number} height - Frame height
   * @param {Object} detection - Result from detectPersonPresence
   * @param {Object} [options] - Tuning options or custom detector hook
   * @returns {Object} { orientation, feedback, isConfident, horizontalOffset, verticalOffset, technicalDisclosure }
   */
  function estimateHeadOrientation(data, width, height, detection, options = {}) {
    if (typeof options.customOrientation === "function") {
      try {
        const res = options.customOrientation(data, width, height, detection);
        if (res && res.orientation) return res;
      } catch (e) {}
    }

    if (!detection || detection.status !== DETECTION_STATUS.CONFIDENT_DETECTION || !detection.boundingBox) {
      return {
        orientation: HEAD_ORIENTATION.UNVERIFIED_NO_SUBJECT,
        feedback: "Chưa nhận diện được chủ thể để xác định hướng đầu.",
        isConfident: false,
        horizontalOffset: 0,
        verticalOffset: 0,
        technicalDisclosure: "Ước lượng hướng đầu tương đối (Head Orientation) - không phải Eye Gaze Tracking.",
      };
    }

    const box = detection.boundingBox;
    const boxCenterX = box.x + box.width / 2;
    const boxCenterY = box.y + box.height / 2;

    const centroidX = (box.centroidX !== undefined) ? box.centroidX : boxCenterX;
    const centroidY = (box.centroidY !== undefined) ? box.centroidY : boxCenterY;

    // Relative centroid offsets normalized by box dimensions
    const hOffset = (centroidX - boxCenterX) / (box.width || 1);
    const vOffset = (centroidY - boxCenterY) / (box.height || 1);

    const roundedH = Math.round(hOffset * 100) / 100;
    const roundedV = Math.round(vOffset * 100) / 100;

    let orientation = HEAD_ORIENTATION.FACING_CAMERA;
    let feedback = "";

    // Thresholds: +/-0.06 for left/right turn; +0.08 for tilt down; -0.08 for tilt up
    if (hOffset < -0.06) {
      orientation = HEAD_ORIENTATION.TURNED_LEFT;
      feedback = "Hướng đầu có xu hướng quay sang bên trái người xem. Gợi ý: Hướng mắt về phía ống kính camera.";
    } else if (hOffset > 0.06) {
      orientation = HEAD_ORIENTATION.TURNED_RIGHT;
      feedback = "Hướng đầu có xu hướng quay sang bên phải người xem. Gợi ý: Hướng mắt về phía ống kính camera.";
    } else if (vOffset > 0.08) {
      orientation = HEAD_ORIENTATION.TILTED_DOWN;
      feedback = "Hướng đầu hơi cúi xuống (có thể đang đọc tài liệu hoặc ghi chú). Gợi ý: Nâng tầm nhìn đối diện trực diện.";
    } else if (vOffset < -0.08) {
      orientation = HEAD_ORIENTATION.TILTED_UP;
      feedback = "Hướng đầu hơi ngửa lên trên. Gợi ý: Điều chỉnh góc camera ngang tầm mắt.";
    } else {
      orientation = HEAD_ORIENTATION.FACING_CAMERA;
      feedback = "Hướng đầu trực diện về phía camera, tạo điểm nhìn giao tiếp tự nhiên và gắn kết.";
    }

    return {
      orientation,
      feedback,
      isConfident: true,
      horizontalOffset: roundedH,
      verticalOffset: roundedV,
      technicalDisclosure: "Ước lượng hướng đầu tương đối (Head Orientation) - không phải Eye Gaze Tracking.",
    };
  }

  /**
   * Estimates upper body posture (Upright Centered, Leaning Left/Right, Shoulders Out of Frame).
   *
   * @param {Uint8ClampedArray|Array<number>} data - RGBA byte array
   * @param {number} width - Frame width
   * @param {number} height - Frame height
   * @param {Object} detection - Result from detectPersonPresence
   * @param {Object} [options] - Tuning options or custom posture hook
   * @returns {Object} { posture, feedback, shouldersVisible, postureEvaluated, asymmetry }
   */
  function estimateBodyPosture(data, width, height, detection, options = {}) {
    if (typeof options.customPosture === "function") {
      try {
        const res = options.customPosture(data, width, height, detection);
        if (res && res.posture) return res;
      } catch (e) {}
    }

    if (!detection || detection.status !== DETECTION_STATUS.CONFIDENT_DETECTION || !detection.boundingBox) {
      return {
        posture: BODY_POSTURE.SHOULDERS_OUT_OF_FRAME,
        feedback: "Chưa nhận diện được chủ thể trong khung hình.",
        shouldersVisible: false,
        postureEvaluated: false,
        asymmetry: 0,
      };
    }

    const box = detection.boundingBox;
    // Sample background reference from top-left and top-right corners
    let bgRSum = 0, bgGSum = 0, bgBSum = 0, bgCount = 0;
    const bgW = Math.max(10, Math.floor(width * 0.12));
    const bgH = Math.max(10, Math.floor(height * 0.15));
    const bgStep = 4;
    for (let y = 0; y < bgH; y += bgStep) {
      for (let x = 0; x < bgW; x += bgStep) {
        const idx1 = (y * width + x) * 4;
        bgRSum += data[idx1];
        bgGSum += data[idx1 + 1];
        bgBSum += data[idx1 + 2];
        const idx2 = (y * width + (width - 1 - x)) * 4;
        bgRSum += data[idx2];
        bgGSum += data[idx2 + 1];
        bgBSum += data[idx2 + 2];
        bgCount += 2;
      }
    }
    const bgR = bgCount > 0 ? bgRSum / bgCount : 128;
    const bgG = bgCount > 0 ? bgGSum / bgCount : 128;
    const bgB = bgCount > 0 ? bgBSum / bgCount : 128;

    // Shoulders begin below the chin and lower jawline
    const bottomY = box.maxY || (box.y + box.height);
    const shoulderTop = bottomY + 10;
    const shoulderBottom = Math.min(height, shoulderTop + box.height * 0.9);

    // If shoulder band is too small or clipped at the frame boundary
    if (shoulderBottom - shoulderTop < 20 || shoulderTop >= height * 0.88) {
      return {
        posture: BODY_POSTURE.SHOULDERS_OUT_OF_FRAME,
        feedback: "Khung hình chưa hiển thị đủ phần vai để đánh giá tư thế. Không nhận diện tư thế cơ thể hay cảm xúc.",
        shouldersVisible: false,
        postureEvaluated: false,
        asymmetry: 0,
      };
    }

    const boxCenterX = box.x + box.width / 2;
    const step = 2;
    let leftMass = 0;
    let rightMass = 0;

    for (let y = Math.floor(shoulderTop); y < Math.floor(shoulderBottom); y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Chromatic skin check
        const cbVal = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const crVal = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
        const isSkin = (cbVal >= 80 && cbVal <= 124 && crVal >= 135 && crVal <= 173 && yVal >= 40 && yVal <= 245 && r > g && g > b);

        // Subject foreground check (color/contrast difference from background corners)
        const colorDiff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        const isForeground = isSkin || colorDiff > 55;

        if (isForeground) {
          if (x < boxCenterX) {
            leftMass++;
          } else {
            rightMass++;
          }
        }
      }
    }

    const totalMass = leftMass + rightMass;
    // Must have at least 200 foreground samples in shoulder band to verify shoulders
    if (totalMass < 200) {
      return {
        posture: BODY_POSTURE.SHOULDERS_OUT_OF_FRAME,
        feedback: "Khung hình chưa hiển thị đủ phần vai để đánh giá tư thế. Không nhận diện tư thế cơ thể hay cảm xúc.",
        shouldersVisible: false,
        postureEvaluated: false,
        asymmetry: 0,
      };
    }

    const asymmetry = (leftMass - rightMass) / totalMass;

    let posture = BODY_POSTURE.UPRIGHT_CENTERED;
    let feedback = "";

    if (asymmetry > 0.18) {
      posture = BODY_POSTURE.LEANING_LEFT;
      feedback = "Tư thế thân trên có xu hướng nghiêng về bên trái. Gợi ý: Điều chỉnh ngồi thẳng và thả lỏng hai vai.";
    } else if (asymmetry < -0.18) {
      posture = BODY_POSTURE.LEANING_RIGHT;
      feedback = "Tư thế thân trên có xu hướng nghiêng về bên phải. Gợi ý: Điều chỉnh ngồi thẳng và thả lỏng hai vai.";
    } else {
      posture = BODY_POSTURE.UPRIGHT_CENTERED;
      feedback = "Tư thế ngồi thẳng cân đối, hai vai giữ thế song song tự nhiên.";
    }

    return {
      posture,
      feedback,
      shouldersVisible: true,
      postureEvaluated: true,
      asymmetry: Math.round(asymmetry * 100) / 100,
    };
  }

  /**
   * Estimates hand visibility and gestures in the lower frame.
   *
   * @param {Uint8ClampedArray|Array<number>} data - RGBA byte array
   * @param {number} width - Frame width
   * @param {number} height - Frame height
   * @param {Object} detection - Result from detectPersonPresence
   * @param {Object} [options] - Tuning options or custom hand detector hook
   * @returns {Object} { status, feedback, handsDetected, isGesturing, handSkinPixels }
   */
  function estimateHandPresence(data, width, height, detection, options = {}) {
    if (typeof options.customHands === "function") {
      try {
        const res = options.customHands(data, width, height, detection);
        if (res && res.status) return res;
      } catch (e) {}
    }

    if (!data || !width || !height || width <= 0 || height <= 0 || !detection || detection.status !== DETECTION_STATUS.CONFIDENT_DETECTION) {
      return {
        status: HAND_GESTURES.HANDS_NOT_IN_FRAME,
        feedback: "Bàn tay nằm ngoài góc nhìn camera; không đủ dữ liệu để đánh giá cử chỉ.",
        handsDetected: false,
        isGesturing: false,
        handSkinPixels: 0,
      };
    }

    const box = detection.boundingBox || { y: 0, height: 0 };
    const lowerYStart = Math.max(Math.floor(height * 0.55), Math.floor(box.y + box.height * 1.05));
    const step = 4;
    let handSkinPixels = 0;

    for (let y = lowerYStart; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const cbVal = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const crVal = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        const yVal = 0.299 * r + 0.587 * g + 0.114 * b;

        const isSkin = (cbVal >= 80 && cbVal <= 124 && crVal >= 135 && crVal <= 173 && yVal >= 40 && yVal <= 245 && r > g && g > b);
        if (isSkin) {
          handSkinPixels++;
        }
      }
    }

    const minHandSamples = 16;
    if (handSkinPixels < minHandSamples) {
      return {
        status: HAND_GESTURES.HANDS_NOT_IN_FRAME,
        feedback: "Bàn tay nằm ngoài góc nhìn camera; không đủ dữ liệu để đánh giá cử chỉ.",
        handsDetected: false,
        isGesturing: false,
        handSkinPixels,
      };
    }

    const motionVal = options.motionDelta ? options.motionDelta.avgDelta : (options.avgMotionDelta || 0);

    if (motionVal >= 3.0 || options.isGesturing === true) {
      return {
        status: HAND_GESTURES.HANDS_GESTURING,
        feedback: "Phát hiện bàn tay trong khung hình đang có cử chỉ minh họa khi diễn đạt.",
        handsDetected: true,
        isGesturing: true,
        handSkinPixels,
      };
    } else {
      return {
        status: HAND_GESTURES.HANDS_OBSERVED_RESTING,
        feedback: "Phát hiện bàn tay trong khung hình ở trạng thái nghỉ/đặt trên bàn.",
        handsDetected: true,
        isGesturing: false,
        handSkinPixels,
      };
    }
  }

  /**
   * Analyzes a single video frame from raw RGBA pixel data (or mock object).
   *
   * @param {Uint8ClampedArray|Array<number>} data - RGBA byte array (length = width * height * 4)
   * @param {number} width - Frame width in pixels
   * @param {number} height - Frame height in pixels
   * @param {Object} [options] - Custom detectors or tuning flags
   * @returns {Object} Comprehensive framing and lighting metrics
   */
  function analyzeFrame(data, width, height, options = {}) {
    if (!data || !width || !height || width <= 0 || height <= 0 || data.length < width * height * 4) {
      return {
        isEvaluated: false,
        reason: "Không đủ dữ liệu hình ảnh để đánh giá",
        lighting: LIGHTING_STATUS.INSUFFICIENT_DATA,
        framing: FRAMING_STATUS.INSUFFICIENT_DATA,
        headOrientation: HEAD_ORIENTATION.UNVERIFIED_NO_SUBJECT,
        bodyPosture: BODY_POSTURE.SHOULDERS_OUT_OF_FRAME,
        handGestures: HAND_GESTURES.HANDS_NOT_IN_FRAME,
        disclaimer: ETHICAL_DISCLAIMER,
        methodology: METHODOLOGY,
      };
    }

    const totalPixels = width * height;
    let sumLuma = 0;
    let sumSqLuma = 0;

    // Spatial subdivisions for framing and backlit analysis:
    // Center box: [0.25w to 0.75w] x [0.2w to 0.8h]
    const xMinCenter = Math.floor(width * 0.25);
    const xMaxCenter = Math.floor(width * 0.75);
    const yMinCenter = Math.floor(height * 0.2);
    const yMaxCenter = Math.floor(height * 0.8);

    let centerLumaSum = 0;
    let centerPixelCount = 0;
    let outerLumaSum = 0;
    let outerPixelCount = 0;

    // 3 vertical columns for left/center/right balance:
    // Left: [0, 0.33w), Center: [0.33w, 0.67w), Right: [0.67w, w)
    const colLeftEnd = Math.floor(width / 3);
    const colRightStart = Math.floor((width * 2) / 3);

    let sumLumaLeft = 0, countLeft = 0, sumSqLeft = 0;
    let sumLumaMid = 0, countMid = 0, sumSqMid = 0;
    let sumLumaRight = 0, countRight = 0, sumSqRight = 0;

    // Sample step to ensure fast client-side performance (step 2 or 4 pixels)
    const step = totalPixels > 100000 ? 2 : 1;
    let sampledCount = 0;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const luma = calculateLuma(r, g, b);

        sumLuma += luma;
        sumSqLuma += luma * luma;
        sampledCount++;

        // Center vs Outer
        if (x >= xMinCenter && x <= xMaxCenter && y >= yMinCenter && y <= yMaxCenter) {
          centerLumaSum += luma;
          centerPixelCount++;
        } else {
          outerLumaSum += luma;
          outerPixelCount++;
        }

        // Left / Center / Right columns
        if (x < colLeftEnd) {
          sumLumaLeft += luma;
          sumSqLeft += luma * luma;
          countLeft++;
        } else if (x < colRightStart) {
          sumLumaMid += luma;
          sumSqMid += luma * luma;
          countMid++;
        } else {
          sumLumaRight += luma;
          sumSqRight += luma * luma;
          countRight++;
        }
      }
    }

    if (sampledCount === 0) {
      return {
        isEvaluated: false,
        reason: "Không thể lấy mẫu pixel từ frame",
        lighting: LIGHTING_STATUS.INSUFFICIENT_DATA,
        framing: FRAMING_STATUS.INSUFFICIENT_DATA,
        headOrientation: HEAD_ORIENTATION.UNVERIFIED_NO_SUBJECT,
        bodyPosture: BODY_POSTURE.SHOULDERS_OUT_OF_FRAME,
        handGestures: HAND_GESTURES.HANDS_NOT_IN_FRAME,
        disclaimer: ETHICAL_DISCLAIMER,
      };
    }

    const meanLuma = sumLuma / sampledCount;
    const varianceLuma = Math.max(0, sumSqLuma / sampledCount - meanLuma * meanLuma);
    const stdDevLuma = Math.sqrt(varianceLuma);

    const meanCenter = centerPixelCount > 0 ? centerLumaSum / centerPixelCount : meanLuma;
    const meanOuter = outerPixelCount > 0 ? outerLumaSum / outerPixelCount : meanLuma;

    const stdLeft = countLeft > 0 ? Math.sqrt(Math.max(0, sumSqLeft / countLeft - Math.pow(sumLumaLeft / countLeft, 2))) : 0;
    const stdMid = countMid > 0 ? Math.sqrt(Math.max(0, sumSqMid / countMid - Math.pow(sumLumaMid / countMid, 2))) : 0;
    const stdRight = countRight > 0 ? Math.sqrt(Math.max(0, sumSqRight / countRight - Math.pow(sumLumaRight / countRight, 2))) : 0;

    // Check 1: Covered lens or pitch black room
    if (meanLuma < 18 && stdDevLuma < 10) {
      const darkDetection = {
        hasPerson: false,
        confidence: 0,
        status: DETECTION_STATUS.POOR_VISIBILITY,
        reason: "Khung hình quá tối hoặc camera bị che",
        boundingBox: null,
        landmarks: null,
        landmarksStatus: LANDMARKS_STATUS.NONE,
        postureFeedback: "Khung hình quá tối để đánh giá tư thế.",
      };
      return {
        isEvaluated: false,
        reason: "Chưa thể đánh giá điều kiện hình ảnh (khung hình quá tối hoặc ống kính bị che)",
        lighting: LIGHTING_STATUS.INSUFFICIENT_DATA,
        framing: FRAMING_STATUS.INSUFFICIENT_DATA,
        evidenceFraming: EVIDENCE_FRAMING.UNVERIFIED_NO_SUBJECT,
        detection: darkDetection,
        landmarksStatus: {
          status: LANDMARKS_STATUS.NONE,
          shouldersVisible: false,
          postureEvaluated: false,
          feedback: "Khung hình quá tối để đánh giá tư thế.",
        },
        headOrientation: HEAD_ORIENTATION.UNVERIFIED_NO_SUBJECT,
        bodyPosture: BODY_POSTURE.SHOULDERS_OUT_OF_FRAME,
        handGestures: HAND_GESTURES.HANDS_NOT_IN_FRAME,
        meanLuma: Math.round(meanLuma),
        stdDevLuma: Math.round(stdDevLuma),
        resolution: { width, height, isOptimal: width >= 1280 && height >= 720 },
        feedback: "Khung hình quá tối hoặc ống kính camera bị che. Bạn có thể kiểm tra lại camera, nắp che hoặc nguồn sáng trước khi tiếp tục.",
        evidenceFramingFeedback: "Không thể đánh giá bố cục do khung hình quá tối.",
        disclaimer: ETHICAL_DISCLAIMER,
        methodology: METHODOLOGY,
      };
    }

    // Check 2: Pure blank/solid frame (zero texture)
    if (stdDevLuma < 4) {
      const blankDetection = {
        hasPerson: false,
        confidence: 0,
        status: DETECTION_STATUS.NO_PERSON_DETECTED,
        reason: "Khung hình đơn sắc hoặc không có chi tiết",
        boundingBox: null,
        landmarks: null,
        landmarksStatus: LANDMARKS_STATUS.NONE,
        postureFeedback: "Khung hình không có chi tiết để nhận xét tư thế.",
      };
      return {
        isEvaluated: false,
        reason: "Chưa thể đánh giá điều kiện hình ảnh (khung hình đơn sắc hoặc không có chi tiết)",
        lighting: LIGHTING_STATUS.INSUFFICIENT_DATA,
        framing: FRAMING_STATUS.INSUFFICIENT_DATA,
        evidenceFraming: EVIDENCE_FRAMING.UNVERIFIED_NO_SUBJECT,
        detection: blankDetection,
        landmarksStatus: {
          status: LANDMARKS_STATUS.NONE,
          shouldersVisible: false,
          postureEvaluated: false,
          feedback: "Khung hình không có chi tiết để nhận diện chủ thể.",
        },
        headOrientation: HEAD_ORIENTATION.UNVERIFIED_NO_SUBJECT,
        bodyPosture: BODY_POSTURE.SHOULDERS_OUT_OF_FRAME,
        handGestures: HAND_GESTURES.HANDS_NOT_IN_FRAME,
        meanLuma: Math.round(meanLuma),
        stdDevLuma: Math.round(stdDevLuma),
        resolution: { width, height, isOptimal: width >= 1280 && height >= 720 },
        feedback: "Khung hình không có chi tiết hoặc tương phản rõ nét. Hãy kiểm tra lại góc hướng camera vào không gian làm việc của bạn.",
        evidenceFramingFeedback: "Không phát hiện chủ thể trong khung hình đơn sắc.",
        disclaimer: ETHICAL_DISCLAIMER,
        methodology: METHODOLOGY,
      };
    }

    // Determine Lighting Condition
    let lighting = LIGHTING_STATUS.ACCEPTABLE;
    let lightingFeedback = "";

    if (meanLuma < 45) {
      lighting = LIGHTING_STATUS.UNDEREXPOSED;
      lightingFeedback = "Khung hình khá tối (độ sáng trung bình " + Math.round(meanLuma) + "/255). Bạn có thể cân nhắc bổ sung nguồn sáng trước mặt để hình ảnh rõ hơn.";
    } else if (meanLuma > 215) {
      lighting = LIGHTING_STATUS.OVEREXPOSED;
      lightingFeedback = "Khung hình có độ sáng quá cao (độ sáng trung bình " + Math.round(meanLuma) + "/255). Bạn có thể điều chỉnh giảm nguồn sáng trực diện hoặc chỉnh góc máy.";
    } else if (meanOuter - meanCenter > 45 && meanOuter > 135 && meanCenter < 85) {
      lighting = LIGHTING_STATUS.BACKLIT;
      lightingFeedback = "Có dấu hiệu ngược sáng (vùng viền/nền sáng hơn đáng kể so với vùng trung tâm). Bạn có thể kiểm tra xem phía sau có nguồn sáng mạnh hay không.";
    } else if (meanLuma >= 70 && meanLuma <= 180 && stdDevLuma >= 15) {
      lighting = LIGHTING_STATUS.OPTIMAL;
      lightingFeedback = "Độ sáng tương đối cân bằng và tương phản ổn định (" + Math.round(meanLuma) + "/255), đáp ứng tốt điều kiện hình ảnh phỏng vấn trực tuyến.";
    } else {
      lighting = LIGHTING_STATUS.ACCEPTABLE;
      lightingFeedback = "Độ sáng ở mức cơ bản (" + Math.round(meanLuma) + "/255), đáp ứng điều kiện quan sát tối thiểu.";
    }

    // Determine Framing & Spatial Contrast Distribution (Heuristic estimation without face/person detection)
    let framing = FRAMING_STATUS.CENTERED;
    let framingFeedback = "";

    if (stdLeft > stdMid * 1.7 && stdLeft > stdRight * 1.5) {
      framing = FRAMING_STATUS.LEAN_LEFT;
      framingFeedback = "Chi tiết hình ảnh tập trung nhiều hơn ở phía trái khung hình. Gợi ý: Bạn có thể điều chỉnh nhẹ góc đặt webcam để căn chỉnh cân đối hơn.";
    } else if (stdRight > stdMid * 1.7 && stdRight > stdLeft * 1.5) {
      framing = FRAMING_STATUS.LEAN_RIGHT;
      framingFeedback = "Chi tiết hình ảnh tập trung nhiều hơn ở phía phải khung hình. Gợi ý: Bạn có thể điều chỉnh nhẹ góc đặt webcam để căn chỉnh cân đối hơn.";
    } else {
      framing = FRAMING_STATUS.CENTERED;
      framingFeedback = "Phân bố tương phản giữa các vùng tương đối cân bằng. Gợi ý tham khảo: Đặt camera ngang tầm mắt và giữ khoảng cách 50-70cm.";
    }

    // On-device Person Detection & Evidence Framing (WI-COACH-VIDEO-02B)
    const detection = detectPersonPresence(data, width, height, options);
    const evidenceFramingResult = evaluateEvidenceFraming(detection, width, height);

    // Temporal Body Language Estimations (WI-COACH-BODY-LANGUAGE-02)
    const headOrientationResult = estimateHeadOrientation(data, width, height, detection, options);
    const bodyPostureResult = estimateBodyPosture(data, width, height, detection, options);
    const handGesturesResult = estimateHandPresence(data, width, height, detection, options);

    // Honest shoulder/posture constraint disclosure
    const landmarksStatus = {
      status: detection.landmarksStatus || LANDMARKS_STATUS.NONE,
      shouldersVisible: bodyPostureResult.shouldersVisible,
      postureEvaluated: bodyPostureResult.postureEvaluated,
      feedback: bodyPostureResult.feedback,
    };

    // Resolution quality
    const isOptimalRes = width >= 1280 && height >= 720;
    const isAcceptableRes = width >= 640 && height >= 480;

    return {
      isEvaluated: true,
      lighting,
      framing,
      evidenceFraming: evidenceFramingResult.evidenceFraming,
      detection,
      landmarksStatus,
      headOrientation: headOrientationResult.orientation,
      headOrientationFeedback: headOrientationResult.feedback,
      headOrientationMetrics: headOrientationResult,
      bodyPosture: bodyPostureResult.posture,
      bodyPostureFeedback: bodyPostureResult.feedback,
      bodyPostureMetrics: bodyPostureResult,
      handGestures: handGesturesResult.status,
      handGesturesFeedback: handGesturesResult.feedback,
      handGesturesMetrics: handGesturesResult,
      metrics: {
        meanLuma: Math.round(meanLuma),
        stdDevLuma: Math.round(stdDevLuma),
        centerLuma: Math.round(meanCenter),
        outerLuma: Math.round(meanOuter),
        contrastDistribution: {
          left: Math.round(stdLeft),
          center: Math.round(stdMid),
          right: Math.round(stdRight),
        },
      },
      resolution: {
        width,
        height,
        aspectRatio: (width / height).toFixed(2),
        isOptimal: isOptimalRes,
        isAcceptable: isAcceptableRes,
      },
      lightingFeedback,
      framingFeedback,
      evidenceFramingFeedback: evidenceFramingResult.framingFeedback,
      disclaimer: ETHICAL_DISCLAIMER,
      methodology: METHODOLOGY,
    };
  }

  /**
   * Calculates frame-to-frame pixel delta to evaluate motion stability.
   *
   * @param {Uint8ClampedArray|Array<number>} prevData
   * @param {Uint8ClampedArray|Array<number>} currData
   * @param {number} width
   * @param {number} height
   */
  function analyzeMotionDelta(prevData, currData, width, height) {
    if (!prevData || !currData || !width || !height || prevData.length !== currData.length) {
      return {
        stability: MOTION_STABILITY.INSUFFICIENT_DATA,
        avgDelta: 0,
        feedback: "Không đủ dữ liệu hai khung hình liên tiếp để đo chuyển động.",
      };
    }

    const totalPixels = width * height;
    let sumAbsDiff = 0;
    let count = 0;
    const step = 4; // fast sample

    for (let i = 0; i < totalPixels * 4; i += 4 * step) {
      const yPrev = calculateLuma(prevData[i], prevData[i + 1], prevData[i + 2]);
      const yCurr = calculateLuma(currData[i], currData[i + 1], currData[i + 2]);
      sumAbsDiff += Math.abs(yCurr - yPrev);
      count++;
    }

    const avgDelta = count > 0 ? sumAbsDiff / count : 0;
    const roundedDelta = Math.round(avgDelta * 10) / 10;

    if (avgDelta < 1.2) {
      return {
        stability: MOTION_STABILITY.FROZEN_OR_STATIC,
        avgDelta: roundedDelta,
        feedback: "Mức độ thay đổi giữa 2 khung hình mẫu rất thấp (delta = " + roundedDelta + "), gần như tĩnh.",
      };
    } else if (avgDelta > 38) {
      return {
        stability: MOTION_STABILITY.ERRATIC_OR_SHAKY,
        avgDelta: roundedDelta,
        feedback: "Mức độ thay đổi giữa 2 khung hình mẫu đáng kể (delta = " + roundedDelta + "). Lưu ý: Đây là so sánh giữa các ảnh mẫu thời điểm, không phải theo dõi chuyển động liên tục.",
      };
    } else {
      return {
        stability: MOTION_STABILITY.NATURAL,
        avgDelta: roundedDelta,
        feedback: "Mức độ thay đổi giữa 2 khung hình mẫu ở mức vừa phải (delta = " + roundedDelta + "). Lưu ý: Đây là chỉ số tham khảo giữa các ảnh mẫu thời điểm, không theo dõi liên tục.",
      };
    }
  }

  /**
   * Aggregates multiple snapshot evaluations across the interview session.
   *
   * @param {Array<Object>} evaluations - Array of single frame evaluations
   * @param {Object} options - { cameraEnabled: boolean }
   * @returns {Object} Comprehensive session visual coaching report
   */
  function aggregateSessionVisuals(evaluations, options = {}) {
    const isCameraEnabled = options.cameraEnabled !== false && Array.isArray(evaluations) && evaluations.length > 0;

    if (!isCameraEnabled || !evaluations || evaluations.length === 0) {
      return {
        evaluated: false,
        cameraUsed: false,
        summaryTitle: "Không sử dụng camera",
        summaryBadge: "Camera tắt",
        statusClass: "neutral",
        lightingSummary: "Không đánh giá (Camera tắt trong suốt buổi)",
        framingSummary: "Không đánh giá (Camera tắt trong suốt buổi)",
        motionSummary: "Không đánh giá",
        recommendations: [
          "Bật camera trong các buổi luyện tập tiếp theo để nhận gợi ý tối ưu hóa góc máy và ánh sáng.",
          "Việc tắt camera không ảnh hưởng đến điểm năng lực chuyên môn của bạn.",
        ],
        disclaimer: ETHICAL_DISCLAIMER,
        affectsProfessionalScore: false,
      };
    }

    const validEvals = evaluations.filter((e) => e && e.isEvaluated);

    if (validEvals.length === 0) {
      return {
        evaluated: false,
        cameraUsed: true,
        summaryTitle: "Dữ liệu hình ảnh chưa đủ điều kiện",
        summaryBadge: "Chưa đủ dữ liệu",
        statusClass: "warning",
        lightingSummary: "Khung hình quá tối hoặc ống kính bị che",
        framingSummary: "Không thể xác định bố cục rõ nét",
        motionSummary: "Chưa đủ dữ liệu chuỗi thời gian",
        recommendations: [
          "Kiểm tra lại nắp che camera hoặc quyền truy cập của trình duyệt.",
          "Đảm bảo có đủ ánh sáng trong phòng để camera thu được hình ảnh rõ ràng.",
        ],
        disclaimer: ETHICAL_DISCLAIMER,
        affectsProfessionalScore: false,
      };
    }

    // Tally lighting states, framing states, and person detection (WI-COACH-VIDEO-02B)
    const lightingCounts = {};
    const framingCounts = {};
    const evidenceFramingCounts = {};
    let personDetectedCount = 0;
    let totalLuma = 0;

    // Collect all temporal samples across turns
    const allTemporalSamples = [];

    validEvals.forEach((ev) => {
      lightingCounts[ev.lighting] = (lightingCounts[ev.lighting] || 0) + 1;
      framingCounts[ev.framing] = (framingCounts[ev.framing] || 0) + 1;
      if (ev.evidenceFraming) {
        evidenceFramingCounts[ev.evidenceFraming] = (evidenceFramingCounts[ev.evidenceFraming] || 0) + 1;
      }
      if (ev.detection && (ev.detection.hasPerson || ev.detection.status === DETECTION_STATUS.CONFIDENT_DETECTION)) {
        personDetectedCount++;
      }
      if (ev.metrics && ev.metrics.meanLuma) {
        totalLuma += ev.metrics.meanLuma;
      }

      if (Array.isArray(ev.temporalSamples) && ev.temporalSamples.length > 0) {
        allTemporalSamples.push(...ev.temporalSamples);
      } else {
        allTemporalSamples.push(ev);
      }
    });

    const dominantLighting = Object.keys(lightingCounts).reduce((a, b) =>
      lightingCounts[a] > lightingCounts[b] ? a : b
    );
    const dominantFraming = Object.keys(framingCounts).reduce((a, b) =>
      framingCounts[a] > framingCounts[b] ? a : b
    );
    const dominantEvidenceFraming = Object.keys(evidenceFramingCounts).length > 0
      ? Object.keys(evidenceFramingCounts).reduce((a, b) => evidenceFramingCounts[a] > evidenceFramingCounts[b] ? a : b)
      : EVIDENCE_FRAMING.UNVERIFIED_NO_SUBJECT;

    const personDetectionRate = validEvals.length > 0 ? Math.round((personDetectedCount / validEvals.length) * 100) / 100 : 0;

    const avgLuma = Math.round(totalLuma / validEvals.length);
    const recommendations = [];

    // Lighting summary & recommendation
    let lightingSummary = "";
    if (dominantLighting === LIGHTING_STATUS.OPTIMAL) {
      lightingSummary = "Độ sáng tương đối cân bằng (độ sáng trung bình ~" + avgLuma + "/255).";
      recommendations.push("Duy trì nguồn sáng hiện tại (độ sáng trung bình ~" + avgLuma + "/255).");
    } else if (dominantLighting === LIGHTING_STATUS.UNDEREXPOSED) {
      lightingSummary = "Khung hình khá tối (độ sáng trung bình ~" + avgLuma + "/255).";
      recommendations.push("Bổ sung nguồn sáng trước mặt để hình ảnh rõ hơn.");
    } else if (dominantLighting === LIGHTING_STATUS.OVEREXPOSED) {
      lightingSummary = "Khung hình có độ sáng quá cao (độ sáng trung bình ~" + avgLuma + "/255).";
      recommendations.push("Cần giảm bớt nguồn sáng gắt chiếu thẳng vào webcam hoặc chỉnh góc phơi sáng.");
    } else if (dominantLighting === LIGHTING_STATUS.BACKLIT) {
      lightingSummary = "Có dấu hiệu ngược sáng (vùng viền sáng hơn vùng trung tâm).";
      recommendations.push("Cần tránh nguồn sáng mạnh chiếu từ phía sau (cửa sổ hoặc đèn trần công suất lớn).");
    } else {
      lightingSummary = "Độ sáng ở mức cơ bản (" + avgLuma + "/255).";
      recommendations.push("Điều kiện ánh sáng cơ bản chấp nhận được.");
    }

    // Framing summary & recommendation
    let framingSummary = "";
    if (dominantEvidenceFraming === EVIDENCE_FRAMING.OPTIMAL_CENTERED) {
      framingSummary = "Bố cục chủ thể cân đối ở trung tâm khung hình, khoảng cách và tỷ lệ đạt chuẩn phỏng vấn.";
      recommendations.push("Gợi ý tham khảo: Duy trì góc đặt webcam ngang tầm mắt và khoảng cách 50-70cm.");
    } else if (dominantEvidenceFraming === EVIDENCE_FRAMING.TOO_CLOSE) {
      framingSummary = "Chủ thể ở khá gần camera trong phần lớn các lượt.";
      recommendations.push("Gợi ý tham khảo: Giữ khoảng cách 50-70cm để khuôn mặt và khung hình tự nhiên hơn.");
    } else if (dominantEvidenceFraming === EVIDENCE_FRAMING.TOO_FAR) {
      framingSummary = "Chủ thể ở khoảng cách khá xa so với camera.";
      recommendations.push("Gợi ý tham khảo: Ngồi gần hơn một chút để người phỏng vấn quan sát rõ hơn.");
    } else if (dominantEvidenceFraming === EVIDENCE_FRAMING.LEAN_LEFT || dominantFraming === FRAMING_STATUS.LEAN_LEFT) {
      framingSummary = "Chi tiết/chủ thể tập trung nhiều hơn ở phía trái khung hình.";
      recommendations.push("Gợi ý tham khảo: Kiểm tra vị trí ngồi đối diện trực diện với camera.");
    } else if (dominantEvidenceFraming === EVIDENCE_FRAMING.LEAN_RIGHT || dominantFraming === FRAMING_STATUS.LEAN_RIGHT) {
      framingSummary = "Chi tiết/chủ thể tập trung nhiều hơn ở phía phải khung hình.";
      recommendations.push("Gợi ý tham khảo: Kiểm tra vị trí ngồi đối diện trực diện với camera.");
    } else if (dominantEvidenceFraming === EVIDENCE_FRAMING.CUT_OFF_TOP) {
      framingSummary = "Đỉnh đầu có xu hướng sát mép trên khung hình.";
      recommendations.push("Gợi ý tham khảo: Điều chỉnh góc camera hoặc hạ ghế ngồi xuống một chút.");
    } else {
      framingSummary = "Phân bố chi tiết tương đối cân bằng.";
      recommendations.push("Gợi ý tham khảo: Đặt camera ngang tầm mắt và giữ khoảng cách 50-70cm.");
    }

    // Person Presence Summary
    let personDetectionSummary = "";
    if (personDetectionRate >= 0.70) {
      personDetectionSummary = `Chủ thể người được nhận diện ổn định trong suốt các lượt (${Math.round(personDetectionRate * 100)}% số lượt).`;
    } else if (personDetectionRate >= 0.30) {
      personDetectionSummary = `Chủ thể được phát hiện trong một số lượt (${Math.round(personDetectionRate * 100)}% số lượt), cần chú ý duy trì vị trí trước ống kính.`;
    } else {
      personDetectionSummary = `Chưa nhận diện được chủ thể rõ ràng trong phần lớn thời gian (${Math.round(personDetectionRate * 100)}% số lượt).`;
    }

    // Temporal Body Language Aggregation (WI-COACH-BODY-LANGUAGE-02)
    const totalSamples = allTemporalSamples.length;
    const headCounts = {
      [HEAD_ORIENTATION.FACING_CAMERA]: 0,
      [HEAD_ORIENTATION.TURNED_LEFT]: 0,
      [HEAD_ORIENTATION.TURNED_RIGHT]: 0,
      [HEAD_ORIENTATION.TILTED_DOWN]: 0,
      [HEAD_ORIENTATION.TILTED_UP]: 0,
      [HEAD_ORIENTATION.UNVERIFIED_NO_SUBJECT]: 0,
    };
    const postureCounts = {
      [BODY_POSTURE.UPRIGHT_CENTERED]: 0,
      [BODY_POSTURE.LEANING_LEFT]: 0,
      [BODY_POSTURE.LEANING_RIGHT]: 0,
      [BODY_POSTURE.SHOULDERS_OUT_OF_FRAME]: 0,
    };
    const handCounts = {
      [HAND_GESTURES.HANDS_GESTURING]: 0,
      [HAND_GESTURES.HANDS_OBSERVED_RESTING]: 0,
      [HAND_GESTURES.HANDS_NOT_IN_FRAME]: 0,
    };

    allTemporalSamples.forEach((s) => {
      const h = s.headOrientation || HEAD_ORIENTATION.FACING_CAMERA;
      headCounts[h] = (headCounts[h] || 0) + 1;

      const p = s.bodyPosture || (s.landmarksStatus && s.landmarksStatus.shouldersVisible ? BODY_POSTURE.UPRIGHT_CENTERED : BODY_POSTURE.SHOULDERS_OUT_OF_FRAME);
      postureCounts[p] = (postureCounts[p] || 0) + 1;

      const hg = s.handGestures || HAND_GESTURES.HANDS_NOT_IN_FRAME;
      handCounts[hg] = (handCounts[hg] || 0) + 1;
    });

    const facingCameraCount = headCounts[HEAD_ORIENTATION.FACING_CAMERA] || 0;
    const turnedLeftCount = headCounts[HEAD_ORIENTATION.TURNED_LEFT] || 0;
    const turnedRightCount = headCounts[HEAD_ORIENTATION.TURNED_RIGHT] || 0;
    const tiltedDownCount = headCounts[HEAD_ORIENTATION.TILTED_DOWN] || 0;
    const tiltedUpCount = headCounts[HEAD_ORIENTATION.TILTED_UP] || 0;
    const lookingAwayCount = turnedLeftCount + turnedRightCount + tiltedDownCount + tiltedUpCount;

    const uprightCount = postureCounts[BODY_POSTURE.UPRIGHT_CENTERED] || 0;
    const leanLeftCount = postureCounts[BODY_POSTURE.LEANING_LEFT] || 0;
    const leanRightCount = postureCounts[BODY_POSTURE.LEANING_RIGHT] || 0;
    const shouldersOutOfFrameCount = postureCounts[BODY_POSTURE.SHOULDERS_OUT_OF_FRAME] || 0;

    const handsGesturingCount = handCounts[HAND_GESTURES.HANDS_GESTURING] || 0;
    const handsRestingCount = handCounts[HAND_GESTURES.HANDS_OBSERVED_RESTING] || 0;
    const handsOutOfFrameCount = handCounts[HAND_GESTURES.HANDS_NOT_IN_FRAME] || 0;

    const facingCameraRate = totalSamples > 0 ? Math.round((facingCameraCount / totalSamples) * 100) : 0;
    const lookingAwayRate = totalSamples > 0 ? Math.round((lookingAwayCount / totalSamples) * 100) : 0;
    const uprightRate = totalSamples > 0 ? Math.round((uprightCount / totalSamples) * 100) : 0;
    const leaningRate = totalSamples > 0 ? Math.round(((leanLeftCount + leanRightCount) / totalSamples) * 100) : 0;
    const handsVisibleRate = totalSamples > 0 ? Math.round(((handsGesturingCount + handsRestingCount) / totalSamples) * 100) : 0;
    const gesturingRate = totalSamples > 0 ? Math.round((handsGesturingCount / totalSamples) * 100) : 0;

    // Structured 4-Part Observations: Observation, Context, Limitation, Actionable Suggestion
    const structuredObservations = [];

    // 1. Head Orientation Observation
    if (facingCameraRate >= 70) {
      structuredObservations.push({
        dimension: "HEAD_ORIENTATION",
        title: "Hướng Đầu & Giao Tiếp Trực Diện",
        observation: `Ứng viên duy trì hướng đầu thẳng về phía camera trong ${facingCameraRate}% thời lượng (${facingCameraCount}/${totalSamples} mẫu quan sát).`,
        context: "Trong suốt quá trình diễn đạt câu trả lời các lượt phỏng vấn.",
        limitation: "Ước lượng hướng đầu tương đối (Head Orientation) dựa trên phân bố hình học khuôn mặt trên trình duyệt; không phải công nghệ theo dõi cử động đồng tử (Eye Gaze Tracking).",
        actionableSuggestion: "Tiếp tục duy trì hướng nhìn trực diện về camera để tạo ấn tượng tự tin, cởi mở và gắn kết với người phỏng vấn.",
        statusClass: "success",
        rate: facingCameraRate,
      });
    } else if (totalSamples > 0 && tiltedDownCount / totalSamples >= 0.25) {
      const downRate = Math.round((tiltedDownCount / totalSamples) * 100);
      structuredObservations.push({
        dimension: "HEAD_ORIENTATION",
        title: "Hướng Đầu & Giao Tiếp Trực Diện",
        observation: `Phát hiện xu hướng cúi đầu xuống trong ${downRate}% thời lượng (${tiltedDownCount}/${totalSamples} mẫu quan sát).`,
        context: "Trong các đoạn suy nghĩ hoặc trình bày chi tiết.",
        limitation: "Hệ thống chỉ đo độ lệch tâm hình học khuôn mặt; có thể do người dùng nhìn xuống bàn phím hoặc đọc tài liệu ghi chú.",
        actionableSuggestion: "Hạn chế nhìn xuống tài liệu quá lâu; hãy đặt tài liệu ghi chú hoặc cửa sổ câu hỏi ngay dưới webcam để ánh nhìn tự nhiên hơn.",
        statusClass: "warning",
        rate: facingCameraRate,
      });
    } else {
      structuredObservations.push({
        dimension: "HEAD_ORIENTATION",
        title: "Hướng Đầu & Giao Tiếp Trực Diện",
        observation: `Ứng viên giữ hướng nhìn trực diện trong ${facingCameraRate}% thời lượng; có sự dịch chuyển góc nhìn sang hai bên trong ${lookingAwayRate}% thời lượng.`,
        context: "Trong khi diễn giải các ý tưởng phỏng vấn.",
        limitation: "Ước lượng hướng đầu tương đối trên trình duyệt, không phân tích ánh mắt hay suy đoán tâm lý lo âu.",
        actionableSuggestion: "Tập trung điểm nhìn vào ống kính máy quay khi chốt các ý chính để tạo cảm giác quyết đoán.",
        statusClass: "info",
        rate: facingCameraRate,
      });
    }

    // 2. Upper Body Posture Observation
    if (totalSamples > 0 && shouldersOutOfFrameCount / totalSamples >= 0.60) {
      structuredObservations.push({
        dimension: "UPPER_BODY_POSTURE",
        title: "Tư Thế Thân Trên & Trục Cân Bằng",
        observation: `Khung hình tập trung cận cảnh khuôn mặt nên phần vai nằm ngoài góc nhìn camera trong ${Math.round((shouldersOutOfFrameCount / totalSamples) * 100)}% thời lượng.`,
        context: "Tại các khoảng cách ghi hình cận cảnh.",
        limitation: "Không đủ thông tin biên viền vai để đo độ nghiêng thân mình; hệ thống minh bạch báo cáo giới hạn thay vì phỏng đoán.",
        actionableSuggestion: "Bạn có thể lùi xa camera khoảng 50-70cm để hiển thị cân đối từ ngực và vai trở lên.",
        statusClass: "neutral",
        rate: uprightRate,
      });
    } else if (uprightRate >= 65) {
      structuredObservations.push({
        dimension: "UPPER_BODY_POSTURE",
        title: "Tư Thế Thân Trên & Trục Cân Bằng",
        observation: `Tư thế thân trên giữ cân đối ở trục giữa trong ${uprightRate}% thời lượng phân tích.`,
        context: "Xuyên suốt phiên trả lời.",
        limitation: "Phân tích dựa trên đường viền vai và phân bố tương phản hai bên cơ thể trên Canvas cục bộ.",
        actionableSuggestion: "Duy trì thế ngồi vững vàng, hai vai thả lỏng tự nhiên để giọng nói có hơi thở ổn định nhất.",
        statusClass: "success",
        rate: uprightRate,
      });
    } else {
      const dominantLean = leanLeftCount > leanRightCount ? "trái" : "phải";
      structuredObservations.push({
        dimension: "UPPER_BODY_POSTURE",
        title: "Tư Thế Thân Trên & Trục Cân Bằng",
        observation: `Xu hướng nghiêng thân mình về bên ${dominantLean} chiếm ${leaningRate}% thời lượng mẫu.`,
        context: "Trong các phần trả lời câu hỏi chuyên sâu.",
        limitation: "Chỉ ghi nhận độ bất đối xứng của vùng thân trên; không đo tư thế cột sống hay kết cấu ghế ngồi.",
        actionableSuggestion: "Đặt cả hai bàn chân phẳng trên sàn và điều chỉnh tựa lưng ghế để tránh dồn trọng tâm về một bên.",
        statusClass: "warning",
        rate: uprightRate,
      });
    }

    // 3. Hand Visibility & Gestures Observation
    if (totalSamples > 0 && handsOutOfFrameCount / totalSamples >= 0.70) {
      structuredObservations.push({
        dimension: "HAND_GESTURES",
        title: "Cử Chỉ Tay & Tương Tác Minh Họa",
        observation: `Bàn tay nằm ngoài góc nhìn camera trong ${Math.round((handsOutOfFrameCount / totalSamples) * 100)}% thời lượng (${handsOutOfFrameCount}/${totalSamples} mẫu).`,
        context: "Góc máy đặt ngang tầm mặt/ngực.",
        limitation: "Camera chỉ quan sát được cử chỉ khi bàn tay đưa vào tầm quét khung hình; không gán nhãn cử chỉ là đúng hay sai.",
        actionableSuggestion: "Khi cần nhấn mạnh các giai đoạn hoặc cấu trúc luận điểm, bạn có thể đưa tay vào khung hình tự nhiên để tăng sinh động.",
        statusClass: "neutral",
        rate: handsVisibleRate,
      });
    } else {
      structuredObservations.push({
        dimension: "HAND_GESTURES",
        title: "Cử Chỉ Tay & Tương Tác Minh Họa",
        observation: `Bàn tay xuất hiện trong khung hình ${handsVisibleRate}% thời lượng (trong đó có ${gesturingRate}% thời lượng có cử chỉ minh họa năng động).`,
        context: "Trong các lượt giải thích luận điểm.",
        limitation: "Nhận diện dựa trên cụm sắc tố da chuyển động ở nửa dưới khung hình; không suy diễn cử chỉ thành cảm xúc cá nhân.",
        actionableSuggestion: "Cử chỉ tay vừa phải giúp tạo sự tự nhiên; chú ý tránh gõ tay xuống bàn hoặc cử chỉ quá dồn dập.",
        statusClass: gesturingRate > 15 ? "success" : "info",
        rate: handsVisibleRate,
      });
    }

    // Honest Posture Disclosure
    const postureSummary = shouldersOutOfFrameCount / totalSamples >= 0.60
      ? "Khung hình chưa hiển thị đủ phần vai để đánh giá tư thế cơ thể. PrepMate không nhận diện cảm xúc hay suy đoán tâm lý."
      : `Tư thế thân trên cân đối đạt ${uprightRate}% thời lượng phân tích.`;

    const motionSummary = totalSamples > validEvals.length
      ? `Đã theo dõi chuỗi thời gian (${totalSamples} mẫu định kỳ qua các lượt trả lời).`
      : "Chưa đủ dữ liệu chuỗi thời gian để đánh giá chuyển động (phiên hiện tại chỉ lấy 1 ảnh mẫu tại đầu mỗi lượt trả lời).";

    return {
      evaluated: true,
      cameraUsed: true,
      summaryTitle: "Điều kiện Ghi hình: " + (dominantLighting === LIGHTING_STATUS.OPTIMAL ? "Cân bằng" : "Khá"),
      summaryBadge: dominantLighting === LIGHTING_STATUS.OPTIMAL ? "Độ sáng cân bằng" : "Độ sáng khá",
      statusClass: dominantLighting === LIGHTING_STATUS.OPTIMAL ? "success" : "info",
      dominantLighting,
      dominantFraming,
      dominantEvidenceFraming,
      personDetectionRate,
      personDetectionSummary,
      postureSummary,
      avgLuma,
      samplesAnalyzed: validEvals.length,
      temporalSamplesAnalyzed: totalSamples,
      lightingSummary,
      framingSummary,
      motionSummary,
      recommendations,
      temporalMetrics: {
        totalSamples,
        facingCameraRate,
        lookingAwayRate,
        uprightRate,
        leaningRate,
        handsVisibleRate,
        gesturingRate,
        headBreakdown: {
          facingCamera: facingCameraCount,
          turnedLeft: turnedLeftCount,
          turnedRight: turnedRightCount,
          tiltedDown: tiltedDownCount,
          tiltedUp: tiltedUpCount,
        },
        postureBreakdown: {
          uprightCentered: uprightCount,
          leaningLeft: leanLeftCount,
          leaningRight: leanRightCount,
          shouldersOutOfFrame: shouldersOutOfFrameCount,
        },
        handsBreakdown: {
          gesturing: handsGesturingCount,
          resting: handsRestingCount,
          outOfFrame: handsOutOfFrameCount,
        },
      },
      structuredObservations,
      disclaimer: ETHICAL_DISCLAIMER,
      methodology: METHODOLOGY,
      affectsProfessionalScore: false,
    };
  }

  // Exports
  const VisualCoachingEngine = {
    ETHICAL_DISCLAIMER,
    METHODOLOGY,
    LIGHTING_STATUS,
    FRAMING_STATUS,
    MOTION_STABILITY,
    DETECTION_STATUS,
    EVIDENCE_FRAMING,
    LANDMARKS_STATUS,
    HEAD_ORIENTATION,
    BODY_POSTURE,
    HAND_GESTURES,
    calculateLuma,
    detectPersonPresence,
    evaluateEvidenceFraming,
    estimateHeadOrientation,
    estimateBodyPosture,
    estimateHandPresence,
    analyzeFrame,
    analyzeMotionDelta,
    aggregateSessionVisuals,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = VisualCoachingEngine;
  }
  if (typeof window !== "undefined") {
    window.VisualCoachingEngine = VisualCoachingEngine;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
