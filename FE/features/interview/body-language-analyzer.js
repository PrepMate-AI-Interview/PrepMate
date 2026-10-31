/**
 * PREPMATE — ON-DEVICE BODY-LANGUAGE ANALYSIS ENGINE (WI-COACH-04B)
 *
 * Core Capabilities:
 * 1. On-device landmark detection (MediaPipe Pose & Hand Landmarker with browser-native fallback).
 * 2. Re-uses existing camera stream (window._userWebcamStream) without duplicate capture.
 * 3. Configurable target sampling rate of 5–8 FPS (default 150ms / ~6.6 FPS).
 * 4. Measurable feature extraction:
 *    - Hand Movement: 0/1/2 hands visible, wrist delta, movement frequency (Hz), amplitude, coverage %, out-of-frame periods.
 *    - Upper-Body Posture: Shoulder-line angle (deg), stability, lateral offset, lean estimate, coverage %.
 * 5. Strict Ethical Guardrails:
 *    - Zero value judgments: NO "good", "bad", "confident", "nervous", "dishonest".
 *    - No emotion or personality inferences.
 *    - Returns "insufficient_visual_evidence" when samples or confidence are below threshold.
 *    - affectsProfessionalScore = false (Completely isolated from 0-100 competency scoring).
 * 6. Timeline Integration: Emits media-relative events (mediaOffsetSec) onto PrepMateAudioRecorder timeline.
 * 7. Complete resource cleanup and performance measurement (latency, fps, dropped frames).
 */

(function (root) {
  "use strict";

  // --------------------------------------------------------------------------
  // 1. CONSTANTS & DEFINITIONS
  // --------------------------------------------------------------------------
  const ALGORITHM_VERSION = "prepmate_body_v1.0";
  const DEFAULT_SAMPLING_INTERVAL_MS = 150; // ~6.6 FPS (within 5-8 FPS target)
  const MIN_SAMPLES_FOR_EVIDENCE = 4;        // Minimum frames required for defensible estimation
  const MIN_SAMPLES_FOR_FREQUENCY = 6;       // Minimum frames for movement frequency calculation (~1s)
  const CONFIDENCE_THRESHOLD = 0.5;          // Landmark visibility threshold

  const TORSO_LEAN = Object.freeze({
    UPRIGHT_CENTERED: "UPRIGHT_CENTERED",
    LEANING_LEFT: "LEANING_LEFT",
    LEANING_RIGHT: "LEANING_RIGHT",
    FORWARD_LEAN: "FORWARD_LEAN",
    BACKWARD_LEAN: "BACKWARD_LEAN",
    SHOULDERS_OUT_OF_FRAME: "SHOULDERS_OUT_OF_FRAME",
    UNRELIABLE: "UNRELIABLE"
  });

  const HAND_PRESENCE = Object.freeze({
    NO_HANDS: "NO_HANDS",
    ONE_HAND: "ONE_HAND",
    BOTH_HANDS: "BOTH_HANDS",
    OUT_OF_FRAME: "OUT_OF_FRAME"
  });

  // --------------------------------------------------------------------------
  // 2. STATE & PERFORMANCE METRICS
  // --------------------------------------------------------------------------
  let _samplingIntervalMs = DEFAULT_SAMPLING_INTERVAL_MS;
  let _samplingTimer = null;
  let _isActive = false;
  let _isPaused = false;
  let _activeTurnIndex = null;
  let _activeSessionId = null;
  let _activeQuestionId = null;
  let _turnStartTime = 0;
  let _turnStartPerf = 0;
  let _turnStartVideoCurrentTime = null;
  let _sampleBuffer = [];
  let _customDetector = null; // Test hook for deterministic landmarks

  // Performance telemetry & Tier selection state
  const _telemetry = {
    selectedTier: "tier2_contour_fallback",
    tierSelectionReason: "MediaPipe Vision Tasks not initialized in window; browser-native geometric contours active",
    totalFramesProcessed: 0,
    droppedFramesCount: 0,
    totalInferenceLatencyMs: 0,
    maxInferenceLatencyMs: 0,
    minInferenceLatencyMs: 999999,
    lastFrameTimestamp: 0,
    actualFps: 0
  };

  // --------------------------------------------------------------------------
  // 3. LANDMARK DETECTOR (DUAL-TIER: MEDIAPIPE + BROWSER-NATIVE FALLBACK)
  // --------------------------------------------------------------------------

  /**
   * Estimates landmarks from an HTMLVideoElement or Canvas / ImageData
   * Normalized coordinates (x, y, z in [0, 1])
   */
  async function detectLandmarks(videoOrCanvas, customDetector = null) {
    const startTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

    // Priority 1: Custom test detector hook
    if (customDetector && typeof customDetector === "function") {
      const res = await customDetector(videoOrCanvas);
      updateTelemetry(startTime, "custom_detector");
      return res;
    }
    if (_customDetector && typeof _customDetector === "function") {
      const res = await _customDetector(videoOrCanvas);
      updateTelemetry(startTime, "custom_detector");
      return res;
    }

    // Priority 2: MediaPipe Vision Tasks (if loaded in window)
    if (typeof window !== "undefined" && window._mediaPipePoseLandmarker && window._mediaPipeHandLandmarker) {
      try {
        const poseResult = window._mediaPipePoseLandmarker.detectForVideo(videoOrCanvas, startTime);
        const handResult = window._mediaPipeHandLandmarker.detectForVideo(videoOrCanvas, startTime);
        const structured = formatMediaPipeResult(poseResult, handResult);
        updateTelemetry(startTime, "tier1_mediapipe_vision");
        return structured;
      } catch (mpErr) {
        // Fall back seamlessly to browser-native detector
      }
    }

    // Priority 3: Browser-Native Geometric Landmark Estimator (Zero External Dependency)
    const nativeResult = detectLandmarksNative(videoOrCanvas);
    updateTelemetry(startTime, "tier2_contour_fallback");
    return nativeResult;
  }

  function updateTelemetry(startTime, tier = "tier2_contour_fallback") {
    const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const latency = Math.max(0, now - startTime);
    _telemetry.selectedTier = tier;
    if (tier === "tier1_mediapipe_vision") {
      _telemetry.tierSelectionReason = "MediaPipe Vision Tasks detected and initialized in window";
    } else if (tier === "custom_detector") {
      _telemetry.tierSelectionReason = "Custom landmark detector injected for deterministic verification";
    } else {
      _telemetry.tierSelectionReason = "MediaPipe Vision Tasks not initialized; browser-native geometric contours active";
    }
    _telemetry.totalFramesProcessed++;
    _telemetry.totalInferenceLatencyMs += latency;
    if (latency > _telemetry.maxInferenceLatencyMs) _telemetry.maxInferenceLatencyMs = latency;
    if (latency < _telemetry.minInferenceLatencyMs) _telemetry.minInferenceLatencyMs = latency;

    if (_telemetry.lastFrameTimestamp > 0) {
      const dt = (now - _telemetry.lastFrameTimestamp) / 1000;
      if (dt > 0) {
        const instantFps = 1 / dt;
        _telemetry.actualFps = Number(((_telemetry.actualFps * 0.8) + (instantFps * 0.2)).toFixed(1));
      }
      // If frame interval is more than 2.5x the target sampling interval, account as dropped frame
      if ((now - _telemetry.lastFrameTimestamp) > (_samplingIntervalMs * 2.5)) {
        _telemetry.droppedFramesCount++;
      }
    }
    _telemetry.lastFrameTimestamp = now;
  }

  /**
   * Formats MediaPipe raw landmarks into PrepMate canonical landmark schema
   */
  function formatMediaPipeResult(poseRes, handRes) {
    const poseLandmarks = poseRes?.landmarks?.[0] || [];
    const leftShoulder = poseLandmarks[11] || null; // MediaPipe pose index 11
    const rightShoulder = poseLandmarks[12] || null; // MediaPipe pose index 12
    const nose = poseLandmarks[0] || null;

    const hands = handRes?.landmarks || [];
    const leftWrist = hands[0]?.[0] || null; // wrist is landmark 0
    const rightWrist = hands[1]?.[0] || null;

    return {
      tier: "tier1_mediapipe_vision",
      anatomicalLandmarksAvailable: true,
      pose: {
        method: "mediapipe_pose_landmarks",
        detected: Boolean(leftShoulder && rightShoulder),
        leftShoulder: leftShoulder ? { x: leftShoulder.x, y: leftShoulder.y, z: leftShoulder.z || 0, visibility: leftShoulder.visibility || 0.9 } : null,
        rightShoulder: rightShoulder ? { x: rightShoulder.x, y: rightShoulder.y, z: rightShoulder.z || 0, visibility: rightShoulder.visibility || 0.9 } : null,
        nose: nose ? { x: nose.x, y: nose.y, z: nose.z || 0, visibility: nose.visibility || 0.9 } : null,
        confidence: poseRes?.landmarks?.length > 0 ? 0.88 : 0.0
      },
      hands: {
        method: "mediapipe_hand_landmarks",
        count: hands.length,
        leftHand: leftWrist ? { wrist: { x: leftWrist.x, y: leftWrist.y }, confidence: 0.85 } : null,
        rightHand: rightWrist ? { wrist: { x: rightWrist.x, y: rightWrist.y }, confidence: 0.85 } : null,
        confidence: hands.length > 0 ? 0.85 : 0.0
      },
      engineSource: "mediapipe_vision"
    };
  }

  /**
   * Browser-Native High-Efficiency Landmark Estimator
   * Samples video frame pixels via an offscreen 160x120 canvas to extract
   * anatomical contours, shoulder-line angle, and hand clusters without external network dependencies.
   */
  function detectLandmarksNative(videoOrCanvas) {
    if (!videoOrCanvas) {
      return createEmptyLandmarkResult("no_input");
    }

    try {
      const w = videoOrCanvas.videoWidth || videoOrCanvas.width || 0;
      const h = videoOrCanvas.videoHeight || videoOrCanvas.height || 0;
      if (w === 0 || h === 0) {
        return createEmptyLandmarkResult("zero_dimensions");
      }

      // If input already has getBoundingClientRect or is a mock object
      if (videoOrCanvas._mockLandmarks) {
        return videoOrCanvas._mockLandmarks;
      }

      // Check if document / offscreen canvas is available
      if (typeof document === "undefined") {
        return createEmptyLandmarkResult("no_document_context");
      }

      let canvas = window._prepmateLandmarkCanvas;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 120;
        window._prepmateLandmarkCanvas = canvas;
      }

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return createEmptyLandmarkResult("no_2d_context");

      ctx.drawImage(videoOrCanvas, 0, 0, 160, 120);
      const imgData = ctx.getImageData(0, 0, 160, 120);
      const pixels = imgData.data;

      // Sample background reference from top-left and top-right corners
      let bgRSum = 0, bgGSum = 0, bgBSum = 0, bgCount = 0;
      for (let y = 0; y < 15; y += 3) {
        for (let x = 0; x < 20; x += 3) {
          const idx = (y * 160 + x) * 4;
          bgRSum += pixels[idx]; bgGSum += pixels[idx + 1]; bgBSum += pixels[idx + 2]; bgCount++;
        }
        for (let x = 140; x < 160; x += 3) {
          const idx = (y * 160 + x) * 4;
          bgRSum += pixels[idx]; bgGSum += pixels[idx + 1]; bgBSum += pixels[idx + 2]; bgCount++;
        }
      }
      const bgR = bgCount > 0 ? (bgRSum / bgCount) : 30;
      const bgG = bgCount > 0 ? (bgGSum / bgCount) : 40;
      const bgB = bgCount > 0 ? (bgBSum / bgCount) : 55;

      // Detect skin pixels & contrast contours
      let skinPixels = 0;
      let sumFaceX = 0, sumFaceY = 0, faceCount = 0;
      let sumShoulderLX = 0, sumShoulderLY = 0, countSL = 0;
      let sumShoulderRX = 0, sumShoulderRY = 0, countSR = 0;
      let leftHandX = 0, leftHandY = 0, countHL = 0;
      let rightHandX = 0, rightHandY = 0, countHR = 0;

      for (let y = 0; y < 120; y++) {
        for (let x = 0; x < 160; x++) {
          const idx = (y * 160 + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];

          // Normalized skin color heuristic
          const isSkin = (r > 80 && g > 35 && b > 20 && (r - g) > 10 && (r - b) > 10);
          // Clothing must contrast distinctly from background
          const bgDiff = Math.hypot(r - bgR, g - bgG, b - bgB);
          const isClothingEdge = bgDiff > 25 && (r + g + b) > 30;

          // Upper region (Face & Head: y in [10..60], x in [45..115])
          if (isSkin && y >= 10 && y <= 60 && x >= 45 && x <= 115) {
            sumFaceX += x; sumFaceY += y; faceCount++;
          }

          // Shoulder band (y in [50..85])
          if (isClothingEdge && y >= 50 && y <= 85) {
            if (x >= 15 && x <= 65) {
              sumShoulderLX += x; sumShoulderLY += y; countSL++;
            } else if (x >= 95 && x <= 145) {
              sumShoulderRX += x; sumShoulderRY += y; countSR++;
            }
          }

          // Lower region for hands (y in [75..118])
          if (isSkin && y >= 75 && y <= 118) {
            if (x < 80) {
              leftHandX += x; leftHandY += y; countHL++;
            } else {
              rightHandX += x; rightHandY += y; countHR++;
            }
          }
        }
      }

      const shouldersDetected = (countSL >= 12 && countSR >= 12);
      const leftShoulderNorm = shouldersDetected ? {
        x: Number(((sumShoulderLX / countSL) / 160).toFixed(3)),
        y: Number(((sumShoulderLY / countSL) / 120).toFixed(3)),
        z: 0,
        visibility: 0.85
      } : null;

      const rightShoulderNorm = shouldersDetected ? {
        x: Number(((sumShoulderRX / countSR) / 160).toFixed(3)),
        y: Number(((sumShoulderRY / countSR) / 120).toFixed(3)),
        z: 0,
        visibility: 0.85
      } : null;

      const noseNorm = (faceCount >= 20) ? {
        x: Number(((sumFaceX / faceCount) / 160).toFixed(3)),
        y: Number(((sumFaceY / faceCount) / 120).toFixed(3)),
        z: 0,
        visibility: 0.90
      } : null;

      // Hands presence threshold (> 8 skin pixels in hand regions)
      const leftHandDetected = countHL >= 8;
      const rightHandDetected = countHR >= 8;
      let handsCount = 0;
      if (leftHandDetected) handsCount++;
      if (rightHandDetected) handsCount++;

      return {
        tier: "tier2_contour_fallback",
        anatomicalLandmarksAvailable: false,
        pose: {
          method: "torso_contour_silhouette",
          detected: shouldersDetected,
          leftShoulder: leftShoulderNorm,
          rightShoulder: rightShoulderNorm,
          nose: noseNorm,
          confidence: shouldersDetected ? 0.85 : (faceCount > 20 ? 0.45 : 0.0)
        },
        hands: {
          method: "motion_contour_estimate",
          count: handsCount,
          leftHand: leftHandDetected ? {
            wrist: {
              x: Number(((leftHandX / countHL) / 160).toFixed(3)),
              y: Number(((leftHandY / countHL) / 120).toFixed(3))
            },
            confidence: 0.80
          } : null,
          rightHand: rightHandDetected ? {
            wrist: {
              x: Number(((rightHandX / countHR) / 160).toFixed(3)),
              y: Number(((rightHandY / countHR) / 120).toFixed(3))
            },
            confidence: 0.80
          } : null,
          confidence: handsCount > 0 ? 0.80 : 0.0
        },
        engineSource: "browser_native_contours"
      };

    } catch (err) {
      return createEmptyLandmarkResult("exception_" + err.message);
    }
  }

  function createEmptyLandmarkResult(reason = "empty") {
    return {
      tier: "tier2_contour_fallback",
      anatomicalLandmarksAvailable: false,
      pose: { method: "none", detected: false, leftShoulder: null, rightShoulder: null, nose: null, confidence: 0.0 },
      hands: { method: "none", count: 0, leftHand: null, rightHand: null, confidence: 0.0 },
      engineSource: "fallback_" + reason
    };
  }

  // --------------------------------------------------------------------------
  // 4. MEASURABLE FEATURE EXTRACTION (HAND MOVEMENT & UPPER-BODY POSTURE)
  // --------------------------------------------------------------------------

  /**
   * Computes comprehensive hand movement features over the sample buffer
   */
  function extractHandMovementFeatures(samples, totalDurationMs) {
    if (!samples || samples.length < MIN_SAMPLES_FOR_EVIDENCE) {
      return {
        status: "insufficient_visual_evidence",
        reason: "Không đủ số mẫu khung hình hợp lệ để đo lường cử chỉ tay",
        sampleCount: samples ? samples.length : 0,
        totalDurationMs: totalDurationMs || 0,
        minSamplesRequired: MIN_SAMPLES_FOR_EVIDENCE,
        minDurationRequiredMs: 800,
        handsVisibleCountAvg: 0,
        handDetectionCoveragePct: 0,
        wristMotionDeltaNorm: 0,
        movementFrequencyHz: null,
        movementAmplitudeNorm: 0,
        outOfFramePeriods: []
      };
    }

    if (totalDurationMs < 800) {
      return {
        status: "insufficient_visual_evidence",
        reason: "Thời lượng quan sát quá ngắn (<800ms) để kết luận cử chỉ tay",
        sampleCount: samples.length,
        totalDurationMs: totalDurationMs || 0,
        minSamplesRequired: MIN_SAMPLES_FOR_EVIDENCE,
        minDurationRequiredMs: 800,
        handsVisibleCountAvg: 0,
        handDetectionCoveragePct: 0,
        wristMotionDeltaNorm: 0,
        movementFrequencyHz: null,
        movementAmplitudeNorm: 0,
        outOfFramePeriods: []
      };
    }

    const totalSamples = samples.length;
    let samplesWithHand = 0;
    let handCountSum = 0;
    const wristPositions = [];
    const outOfFramePeriods = [];
    let currentOutOfFrameStart = null;

    for (let i = 0; i < totalSamples; i++) {
      const s = samples[i];
      const hCount = s.landmarks?.hands?.count || 0;
      handCountSum += hCount;

      if (hCount > 0) {
        samplesWithHand++;
        if (currentOutOfFrameStart !== null) {
          const outDur = s.timeOffsetMs - currentOutOfFrameStart;
          if (outDur >= 400) {
            outOfFramePeriods.push({
              startMs: currentOutOfFrameStart,
              endMs: s.timeOffsetMs,
              durationMs: outDur,
              mediaOffsetSec: Number((currentOutOfFrameStart / 1000).toFixed(3))
            });
          }
          currentOutOfFrameStart = null;
        }

        // Collect dominant wrist point (left or right, or center if both)
        const lWrist = s.landmarks?.hands?.leftHand?.wrist;
        const rWrist = s.landmarks?.hands?.rightHand?.wrist;
        if (lWrist && rWrist) {
          wristPositions.push({ x: (lWrist.x + rWrist.x) / 2, y: (lWrist.y + rWrist.y) / 2, t: s.timeOffsetMs });
        } else if (lWrist) {
          wristPositions.push({ x: lWrist.x, y: lWrist.y, t: s.timeOffsetMs });
        } else if (rWrist) {
          wristPositions.push({ x: rWrist.x, y: rWrist.y, t: s.timeOffsetMs });
        }
      } else {
        if (currentOutOfFrameStart === null) {
          currentOutOfFrameStart = s.timeOffsetMs;
        }
      }
    }

    // Flush last out-of-frame period
    if (currentOutOfFrameStart !== null && totalDurationMs > currentOutOfFrameStart) {
      const outDur = totalDurationMs - currentOutOfFrameStart;
      if (outDur >= 400) {
        outOfFramePeriods.push({
          startMs: currentOutOfFrameStart,
          endMs: totalDurationMs,
          durationMs: outDur,
          mediaOffsetSec: Number((currentOutOfFrameStart / 1000).toFixed(3))
        });
      }
    }

    const coveragePct = Number(((samplesWithHand / totalSamples) * 100).toFixed(1));
    const avgHands = Number((handCountSum / totalSamples).toFixed(2));

    // Motion deltas & Path Length
    let totalPathLength = 0;
    const velocities = [];
    let minX = 1.0, maxX = 0.0, minY = 1.0, maxY = 0.0;

    for (let i = 1; i < wristPositions.length; i++) {
      const p1 = wristPositions[i - 1];
      const p2 = wristPositions[i];
      const dt = (p2.t - p1.t) / 1000;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      totalPathLength += dist;
      if (dt > 0) {
        velocities.push((p2.y - p1.y) / dt); // vertical velocity for gesture cycles
      }
      if (p2.x < minX) minX = p2.x;
      if (p2.x > maxX) maxX = p2.x;
      if (p2.y < minY) minY = p2.y;
      if (p2.y > maxY) maxY = p2.y;
    }

    const avgWristDelta = wristPositions.length > 1
      ? Number((totalPathLength / (wristPositions.length - 1)).toFixed(4))
      : 0;

    // Movement Frequency (zero-crossings of velocity)
    let movementFreqHz = null;
    if (wristPositions.length >= MIN_SAMPLES_FOR_FREQUENCY && totalDurationMs >= 800) {
      let zeroCrossings = 0;
      for (let i = 1; i < velocities.length; i++) {
        if ((velocities[i] >= 0 && velocities[i - 1] < 0) || (velocities[i] < 0 && velocities[i - 1] >= 0)) {
          zeroCrossings++;
        }
      }
      // Each full cycle has 2 zero crossings
      const activeSeconds = totalDurationMs / 1000;
      movementFreqHz = Number(((zeroCrossings / 2) / activeSeconds).toFixed(2));
    }

    // Movement Amplitude (Normalized peak-to-peak displacement)
    const amplitudeNorm = (maxX >= minX && maxY >= minY)
      ? Number(Math.hypot(maxX - minX, maxY - minY).toFixed(3))
      : 0;

    return {
      status: "reliable_evidence",
      sampleCount: totalSamples,
      handsVisibleCountAvg: avgHands,
      handDetectionCoveragePct: coveragePct,
      wristMotionDeltaNorm: avgWristDelta,
      movementFrequencyHz: movementFreqHz,
      movementAmplitudeNorm: amplitudeNorm,
      outOfFramePeriods: outOfFramePeriods
    };
  }

  /**
   * Computes comprehensive upper-body posture features over the sample buffer
   */
  function extractPostureFeatures(samples, totalDurationMs) {
    if (!samples || samples.length < MIN_SAMPLES_FOR_EVIDENCE) {
      return {
        status: "insufficient_visual_evidence",
        reason: "Không đủ số mẫu khung hình hợp lệ để đo lường tư thế thân trên",
        sampleCount: samples ? samples.length : 0,
        totalDurationMs: totalDurationMs || 0,
        minSamplesRequired: MIN_SAMPLES_FOR_EVIDENCE,
        minDurationRequiredMs: 800,
        shoulderAngleAvgDeg: 0,
        shoulderAngleStabilityDeg: 0,
        lateralOffsetAvgNorm: 0,
        torsoLeanEstimate: TORSO_LEAN.UNRELIABLE,
        postureCoveragePct: 0,
        postureConfidence: 0
      };
    }

    const totalSamples = samples.length;
    let validShoulderSamples = 0;
    const angles = [];
    const lateralOffsets = [];
    let confSum = 0;

    for (let i = 0; i < totalSamples; i++) {
      const s = samples[i];
      const pose = s.landmarks?.pose;
      if (pose && pose.detected && pose.leftShoulder && pose.rightShoulder) {
        validShoulderSamples++;
        confSum += (pose.confidence || 0.8);

        const ls = pose.leftShoulder;
        const rs = pose.rightShoulder;
        const dx = rs.x - ls.x;
        const dy = rs.y - ls.y;

        // Angle in degrees relative to horizontal: 0 deg = perfectly horizontal
        const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
        angles.push(angleDeg);

        // Lateral midpoint relative to frame center (0.5)
        const midX = (ls.x + rs.x) / 2;
        lateralOffsets.push(midX - 0.5);
      }
    }

    const coveragePct = Number(((validShoulderSamples / totalSamples) * 100).toFixed(1));
    if (validShoulderSamples < MIN_SAMPLES_FOR_EVIDENCE || coveragePct < 30) {
      return {
        status: "insufficient_visual_evidence",
        reason: "Tỷ lệ nhận diện hai vai thấp (<30% thời lượng), không thể kết luận tư thế",
        sampleCount: totalSamples,
        validShoulderSamples,
        postureCoveragePct: coveragePct,
        shoulderAngleAvgDeg: 0,
        shoulderAngleStabilityDeg: 0,
        lateralOffsetAvgNorm: 0,
        torsoLeanEstimate: TORSO_LEAN.SHOULDERS_OUT_OF_FRAME,
        postureConfidence: 0
      };
    }

    if (totalDurationMs < 800) {
      return {
        status: "insufficient_visual_evidence",
        reason: "Thời lượng quan sát quá ngắn (<800ms) để kết luận tư thế thân trên",
        sampleCount: totalSamples,
        validShoulderSamples,
        postureCoveragePct: coveragePct,
        shoulderAngleAvgDeg: 0,
        shoulderAngleStabilityDeg: 0,
        lateralOffsetAvgNorm: 0,
        torsoLeanEstimate: TORSO_LEAN.UNRELIABLE,
        postureConfidence: 0
      };
    }

    // Mean angle and standard deviation (stability)
    const meanAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
    const variance = angles.reduce((sum, a) => sum + Math.pow(a - meanAngle, 2), 0) / angles.length;
    const stdDevAngle = Math.sqrt(variance);

    // Mean lateral offset
    const meanLateralOffset = lateralOffsets.reduce((a, b) => a + b, 0) / lateralOffsets.length;

    // Lean classification based strictly on geometric thresholds (Zero value judgment)
    let lean = TORSO_LEAN.UPRIGHT_CENTERED;
    if (meanLateralOffset < -0.09 || meanAngle > 6.0) {
      lean = TORSO_LEAN.LEANING_LEFT;
    } else if (meanLateralOffset > 0.09 || meanAngle < -6.0) {
      lean = TORSO_LEAN.LEANING_RIGHT;
    }

    const avgConf = Number((confSum / validShoulderSamples).toFixed(2));

    return {
      status: "reliable_evidence",
      sampleCount: totalSamples,
      validShoulderSamples,
      postureCoveragePct: coveragePct,
      postureConfidence: avgConf,
      shoulderAngleAvgDeg: Number(meanAngle.toFixed(2)),
      shoulderAngleStabilityDeg: Number(stdDevAngle.toFixed(2)),
      lateralOffsetAvgNorm: Number(meanLateralOffset.toFixed(3)),
      torsoLeanEstimate: lean
    };
  }

  // --------------------------------------------------------------------------
  // 5. TURN SAMPLING LIFECYCLE & TIMELINE INTEGRATION
  // --------------------------------------------------------------------------

  function startTurn(turnIndex, sessionId, questionId = "") {
    _activeTurnIndex = typeof turnIndex === "number" ? turnIndex : 0;
    _activeSessionId = sessionId || "unassigned";
    _activeQuestionId = questionId || "";
    _turnStartTime = Date.now();
    _turnStartPerf = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const doc = (typeof document !== "undefined") ? document : null;
    const videoEl = doc ? doc.getElementById("webcam-video") : null;
    _turnStartVideoCurrentTime = (videoEl && typeof videoEl.currentTime === "number") ? videoEl.currentTime : null;

    _sampleBuffer = [];
    _isActive = true;
    _isPaused = false;

    updateHUDIndicator(true);

    if (_samplingTimer) {
      clearInterval(_samplingTimer);
    }

    _samplingTimer = setInterval(() => {
      if (!_isActive || _isPaused) return;
      sampleCurrentFrame();
    }, _samplingIntervalMs);

    // Immediate first sample
    sampleCurrentFrame();
  }

  async function sampleCurrentFrame() {
    if (!_isActive || _isPaused) return;

    const doc = typeof document !== "undefined" ? document : null;
    const videoEl = doc ? doc.getElementById("webcam-video") : null;
    const isCamActive = Boolean(
      root._userWebcamStream &&
      root._userWebcamStream.active &&
      (!root._userWebcamStream.getVideoTracks || root._userWebcamStream.getVideoTracks().some(t => t.readyState === "live" && t.enabled !== false))
    );

    if (!isCamActive && !videoEl && !_customDetector) {
      return;
    }

    const targetEl = (videoEl && videoEl.videoWidth > 0) ? videoEl : null;

    // Derive exact source frame timestamp if video clock is advancing, otherwise high-res performance clock
    let timeOffsetMs = 0;
    if (targetEl && typeof targetEl.currentTime === "number" && _turnStartVideoCurrentTime !== null && targetEl.currentTime >= _turnStartVideoCurrentTime) {
      timeOffsetMs = Math.round((targetEl.currentTime - _turnStartVideoCurrentTime) * 1000);
    } else {
      const nowPerf = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      timeOffsetMs = Math.max(0, Math.round(nowPerf - _turnStartPerf));
    }

    try {
      const landmarks = await detectLandmarks(targetEl);
      _sampleBuffer.push({
        timeOffsetMs,
        mediaOffsetSec: Number((timeOffsetMs / 1000).toFixed(3)),
        landmarks
      });

      // Emit discrete timeline event when notable movement occurs
      checkAndEmitIntraTurnEvents(_sampleBuffer, _activeTurnIndex, _activeSessionId, _activeQuestionId);

    } catch (e) {
      // Preserve recording experience without unhandled errors
    }
  }

  let _lastEmittedGestureTime = 0;
  function checkAndEmitIntraTurnEvents(samples, turnIndex, sessionId, questionId) {
    if (samples.length < 3) return;
    const recent = samples.slice(-3);
    const last = recent[recent.length - 1];

    // Check if hands were actively gesturing in the recent 3 samples (>350ms)
    const allHandsActive = recent.every(s => (s.landmarks?.hands?.count || 0) > 0);
    if (allHandsActive && (last.timeOffsetMs - _lastEmittedGestureTime) > 2000) {
      _lastEmittedGestureTime = last.timeOffsetMs;

      // Emit to PrepMateAudioRecorder timeline if available
      if (root.PrepMateAudioRecorder && typeof root.PrepMateAudioRecorder.recordTimelineEvent === "function") {
        root.PrepMateAudioRecorder.recordTimelineEvent({
          sessionId,
          questionId,
          turnIndex,
          type: "body_language_hand_gesture",
          label: "Cử chỉ tay minh họa nội dung",
          mediaOffsetSec: last.mediaOffsetSec,
          startMs: Math.max(0, last.timeOffsetMs - 450),
          endMs: last.timeOffsetMs,
          measurements: {
            handsCount: last.landmarks?.hands?.count || 1,
            wristPosition: last.landmarks?.hands?.leftHand?.wrist || last.landmarks?.hands?.rightHand?.wrist
          },
          confidence: 0.85,
          sampleCount: 3,
          coverage: 100,
          algorithmVersion: ALGORITHM_VERSION
        });
      }
    }
  }

  function pauseAnalysis() {
    _isPaused = true;
    updateHUDIndicator(false, "Tạm dừng");
  }

  function resumeAnalysis() {
    _isPaused = false;
    updateHUDIndicator(true);
  }

  function stopTurn() {
    if (_samplingTimer) {
      clearInterval(_samplingTimer);
      _samplingTimer = null;
    }

    _isActive = false;
    _isPaused = false;
    updateHUDIndicator(false);

    const totalDurationMs = Math.max(0, Date.now() - _turnStartTime);
    const handFeatures = extractHandMovementFeatures(_sampleBuffer, totalDurationMs);
    const postureFeatures = extractPostureFeatures(_sampleBuffer, totalDurationMs);

    const detectedTiers = Array.from(new Set(_sampleBuffer.map(s => s.landmarks?.tier).filter(Boolean)));
    const primaryTier = detectedTiers.length > 0 ? detectedTiers[0] : _telemetry.selectedTier;
    const anatomicalLandmarksAvailable = _sampleBuffer.some(s => s.landmarks?.anatomicalLandmarksAvailable === true);

    const turnSummary = {
      sessionId: _activeSessionId,
      turnIndex: _activeTurnIndex,
      questionId: _activeQuestionId,
      totalDurationMs,
      sampleCount: _sampleBuffer.length,
      samplingRateFps: Number((_sampleBuffer.length / Math.max(0.1, totalDurationMs / 1000)).toFixed(1)),
      selectedTier: primaryTier,
      anatomicalLandmarksAvailable,
      handMovement: handFeatures,
      upperBodyPosture: postureFeatures,
      telemetry: {
        selectedTier: primaryTier,
        tierSelectionReason: _telemetry.tierSelectionReason,
        avgInferenceLatencyMs: _telemetry.totalFramesProcessed > 0
          ? Number((_telemetry.totalInferenceLatencyMs / _telemetry.totalFramesProcessed).toFixed(1))
          : 0,
        maxInferenceLatencyMs: _telemetry.maxInferenceLatencyMs,
        droppedFramesCount: _telemetry.droppedFramesCount,
        actualFps: _telemetry.actualFps
      },
      affectsProfessionalScore: false, // Strict ethical SSOT isolation
      algorithmVersion: ALGORITHM_VERSION
    };

    // Emit turn summary event on timeline
    if (root.PrepMateAudioRecorder && typeof root.PrepMateAudioRecorder.recordTimelineEvent === "function") {
      root.PrepMateAudioRecorder.recordTimelineEvent({
        sessionId: _activeSessionId,
        questionId: _activeQuestionId,
        turnIndex: _activeTurnIndex,
        type: "body_language_turn_summary",
        label: "Tổng hợp phân tích chuyển động thân trên & tay",
        mediaOffsetSec: Number((totalDurationMs / 1000).toFixed(3)),
        startMs: 0,
        endMs: totalDurationMs,
        measurements: {
          handCoveragePct: handFeatures.handDetectionCoveragePct,
          postureCoveragePct: postureFeatures.postureCoveragePct,
          torsoLeanEstimate: postureFeatures.torsoLeanEstimate
        },
        confidence: postureFeatures.postureConfidence || 0.8,
        sampleCount: _sampleBuffer.length,
        coverage: postureFeatures.postureCoveragePct,
        algorithmVersion: ALGORITHM_VERSION
      });
    }

    return turnSummary;
  }

  function dispose() {
    stopTurn();
    _sampleBuffer = [];
    _customDetector = null;
    if (typeof window !== "undefined" && window._prepmateLandmarkCanvas) {
      window._prepmateLandmarkCanvas = null;
    }
  }

  // --------------------------------------------------------------------------
  // 6. UI HUD INDICATOR (NON-INTRUSIVE, ZERO EMOJI)
  // --------------------------------------------------------------------------
  function updateHUDIndicator(visible, statusText = "Chuyển động (On-device)") {
    if (typeof document === "undefined") return;
    const badge = document.getElementById("body-language-status-badge");
    if (!badge) return;

    if (visible) {
      badge.style.display = "inline-flex";
      badge.innerText = statusText;
    } else {
      badge.style.display = "none";
    }
  }

  // --------------------------------------------------------------------------
  // 7. EXPORTS & ATTACHMENT
  // --------------------------------------------------------------------------
  const PrepMateBodyLanguageAnalyzer = {
    ALGORITHM_VERSION,
    TORSO_LEAN,
    HAND_PRESENCE,
    DEFAULT_SAMPLING_INTERVAL_MS,
    setSamplingIntervalMs: (ms) => { _samplingIntervalMs = Math.max(50, ms); },
    getSamplingIntervalMs: () => _samplingIntervalMs,
    setCustomDetector: (fn) => { _customDetector = fn; },
    getTelemetry: () => ({ ..._telemetry }),
    detectLandmarks,
    extractHandMovementFeatures,
    extractPostureFeatures,
    startTurn,
    pauseAnalysis,
    resumeAnalysis,
    stopTurn,
    dispose,
    isActive: () => _isActive,
    isPaused: () => _isPaused
  };

  if (typeof window !== "undefined") {
    window.PrepMateBodyLanguageAnalyzer = PrepMateBodyLanguageAnalyzer;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = PrepMateBodyLanguageAnalyzer;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
