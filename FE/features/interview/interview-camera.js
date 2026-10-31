// CAMERA & WEBCAM CONTROLS & HARDENED CAM STATE MACHINE
// ==========================================

// Privacy Disclosure Notice: Local-only processing, no unauthorized uploads
const CAM_PRIVACY_DISCLOSURE = "Hình ảnh từ camera được xử lý cục bộ trực tiếp trên trình duyệt nhằm hỗ trợ phân tích tác phong phỏng vấn. Video/hình ảnh hoàn toàn không được gửi lên máy chủ khi chưa có sự đồng ý của bạn.";

// Safe global reference for Node.js test runners & browsers
if (typeof window === "undefined") {
  globalThis.window = globalThis;
}

// Camera stream reference
window._userWebcamStream = null;

const CAM_STATE = {
  NO_PERMISSION: "NO_PERMISSION",
  REQUESTING: "REQUESTING",
  READY: "READY",
  ON: "ON",
  OFF: "OFF",
  ERROR: "ERROR",
  NOT_SUPPORTED: "NOT_SUPPORTED",
};
let currentCamState = CAM_STATE.OFF;

function getCamState() {
  return currentCamState;
}

function debugInterviewSafe(topic, ...args) {
  if (typeof debugInterview === "function") {
    debugInterview(topic, ...args);
  }
}

function setCamState(state, detail = "") {
  currentCamState = state;
  debugInterviewSafe("CAM_STATE", state, detail);

  const doc = typeof document !== "undefined" ? document : null;
  if (!doc) return;

  const btnToggleCam = doc.getElementById("btn-toggle-cam");
  const videoElement = doc.getElementById("webcam-video");
  const placeholder = doc.getElementById("camera-placeholder");
  const privacyIndicator = doc.getElementById("camera-privacy-indicator");
  const statusEl = doc.getElementById("candidate-tile-status");

  switch (state) {
    case CAM_STATE.ON:
      if (videoElement) videoElement.style.display = "block";
      if (placeholder) placeholder.style.display = "none";
      if (statusEl) {
        statusEl.textContent = "Webcam HD • Trực tiếp";
        statusEl.title = CAM_PRIVACY_DISCLOSURE;
      }
      if (privacyIndicator) {
        privacyIndicator.style.display = "inline-flex";
        privacyIndicator.title = CAM_PRIVACY_DISCLOSURE;
      }
      if (btnToggleCam) {
        if (typeof ZOOM_ICONS !== "undefined" && ZOOM_ICONS.camOn) {
          btnToggleCam.innerHTML = ZOOM_ICONS.camOn;
        }
        btnToggleCam.classList.remove("off");
        btnToggleCam.title = "Tắt Camera • " + CAM_PRIVACY_DISCLOSURE;
        btnToggleCam.setAttribute("aria-label", "Tắt camera");
        btnToggleCam.setAttribute("aria-pressed", "true");
      }
      break;

    case CAM_STATE.OFF:
      if (videoElement) {
        videoElement.srcObject = null;
        videoElement.style.display = "none";
      }
      if (placeholder) placeholder.style.display = "flex";
      if (statusEl) {
        statusEl.textContent = "Camera tắt";
        statusEl.title = "";
      }
      if (privacyIndicator) {
        privacyIndicator.style.display = "none";
      }
      if (btnToggleCam) {
        if (typeof ZOOM_ICONS !== "undefined" && ZOOM_ICONS.camMuted) {
          btnToggleCam.innerHTML = ZOOM_ICONS.camMuted;
        }
        btnToggleCam.classList.add("off");
        btnToggleCam.title = "Bật Camera (không bắt buộc) • " + CAM_PRIVACY_DISCLOSURE;
        btnToggleCam.setAttribute("aria-label", "Bật camera");
        btnToggleCam.setAttribute("aria-pressed", "false");
      }
      break;

    case CAM_STATE.NO_PERMISSION:
    case CAM_STATE.ERROR:
    case CAM_STATE.NOT_SUPPORTED:
      if (videoElement) {
        videoElement.srcObject = null;
        videoElement.style.display = "none";
      }
      if (placeholder) {
        placeholder.style.display = "flex";
        const offText = placeholder.querySelector(".camera-off-indicator span:last-child");
        if (offText) {
          offText.textContent = detail || "Camera đang tắt. Bạn vẫn có thể tiếp tục phỏng vấn bình thường.";
        }
      }
      if (statusEl) {
        statusEl.textContent = "Camera không khả dụng";
      }
      if (privacyIndicator) {
        privacyIndicator.style.display = "none";
      }
      if (btnToggleCam) {
        if (typeof ZOOM_ICONS !== "undefined" && ZOOM_ICONS.camMuted) {
          btnToggleCam.innerHTML = ZOOM_ICONS.camMuted;
        }
        btnToggleCam.classList.add("off");
        btnToggleCam.title = "Bật Camera (không bắt buộc)";
        btnToggleCam.setAttribute("aria-label", "Bật camera (không bắt buộc)");
        btnToggleCam.setAttribute("aria-pressed", "false");
      }
      break;
  }
}
window.CAM_STATE = CAM_STATE;
window.CAM_PRIVACY_DISCLOSURE = CAM_PRIVACY_DISCLOSURE;
window.getCamState = getCamState;
window.setCamState = setCamState;

/**
 * Waits for a video element to have non-zero dimensions and be actively playing.
 * Supports timeout fallback so the application never hangs if the mock or device delays.
 */
function waitForVideoReady(videoElement, maxWaitMs = 3000) {
  return new Promise((resolve) => {
    if (!videoElement) return resolve(false);

    // If already playing and has valid dimensions
    if (
      (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) ||
      (videoElement.width > 0 && videoElement.height > 0)
    ) {
      return resolve(true);
    }

    let settled = false;
    let timer = null;
    let pollInterval = null;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (pollInterval) clearInterval(pollInterval);
      try {
        videoElement.removeEventListener("playing", onReady);
        videoElement.removeEventListener("loadeddata", onReady);
        videoElement.removeEventListener("canplay", onReady);
      } catch (e) {}
    };

    const onReady = () => {
      cleanup();
      resolve(true);
    };

    const onTimeout = () => {
      cleanup();
      const isReady = Boolean(
        (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) ||
        (videoElement.width > 0 && videoElement.height > 0) ||
        (videoElement.readyState && videoElement.readyState >= 2)
      );
      resolve(isReady);
    };

    try {
      videoElement.addEventListener("playing", onReady, { once: true });
      videoElement.addEventListener("loadeddata", onReady, { once: true });
      videoElement.addEventListener("canplay", onReady, { once: true });
    } catch (e) {}

    pollInterval = setInterval(() => {
      if (
        (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) ||
        (videoElement.width > 0 && videoElement.height > 0)
      ) {
        onReady();
      }
    }, 100);

    timer = setTimeout(onTimeout, maxWaitMs);
  });
}
window.waitForVideoReady = waitForVideoReady;

/**
 * Resolves the active interview turn index from runtime state.
 * Returns 0 for introduction, 1..N for question turns, or null if not currently in an active turn.
 */
function getActiveTurnIndex() {
  if (typeof window !== "undefined") {
    // WI-INTERVIEW-PREFLIGHT-01: Disallow active turn sampling during preflight
    if (window._isInterviewSessionStarted === false) {
      return null;
    }
    if (typeof window.getInterviewPhase === "function") {
      const phase = window.getInterviewPhase();
      if (phase === "INTRODUCTION") {
        return 0;
      }
      if (phase === "ADAPTIVE_INTERVIEW") {
        const qIdx = typeof window.getCurrentQuestionIndex === "function" ? window.getCurrentQuestionIndex() : 0;
        return qIdx + 1;
      }
      if (phase === "COMPLETED") {
        return null;
      }
    }
    if (typeof window.interviewPhase !== "undefined") {
      if (window.interviewPhase === "INTRODUCTION") return 0;
      if (window.interviewPhase === "ADAPTIVE_INTERVIEW") {
        return (Number(window.currentQuestionIndex) || 0) + 1;
      }
      if (window.interviewPhase === "COMPLETED") return null;
    }
  }
  return null;
}
window.getActiveTurnIndex = getActiveTurnIndex;

async function requestCameraAccess(customMediaDevices, deviceId = null) {
  const mediaDevices = customMediaDevices || (typeof navigator !== "undefined" ? navigator.mediaDevices : null);
  const doc = typeof document !== "undefined" ? document : null;
  const videoElement = doc ? doc.getElementById("webcam-video") : null;
  const statusEl = doc ? doc.getElementById("candidate-tile-status") : null;

  if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
    setCamState(CAM_STATE.NOT_SUPPORTED, "Trình duyệt không hỗ trợ truy cập camera.");
    return false;
  }

  setCamState(CAM_STATE.REQUESTING);

  try {
    const stream = await mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: false,
    });

    window._userWebcamStream = stream;

    if (videoElement) {
      videoElement.srcObject = stream;
      if (typeof videoElement.play === "function") {
        try { videoElement.play(); } catch (e) {}
      }
    }
    setCamState(CAM_STATE.ON);
    if (statusEl) statusEl.textContent = "Webcam HD • Trực tiếp";

    // Wait for video stream readiness before in-turn sampling (WI-COACH-VIDEO-03)
    if (videoElement) {
      await waitForVideoReady(videoElement, 3000);
    }

    // Late Camera Enable: If camera turned on mid-interview during an active turn, trigger sampling immediately
    const activeTurn = getActiveTurnIndex();
    if (activeTurn !== null && activeTurn !== undefined) {
      startInTurnSampling(activeTurn);
    }

    return true;
  } catch (err) {
    debugInterviewSafe("CAMERA", "Access denied or device not found:", err && err.name);
    setCamState(CAM_STATE.NO_PERMISSION, "Không thể truy cập camera. Bạn vẫn có thể tiếp tục phỏng vấn bằng văn bản hoặc micro.");
    return false;
  }
}
window.requestCameraAccess = requestCameraAccess;

function stopCamera() {
  stopInTurnSampling();
  _isSamplingPaused = false;
  _pendingTurnSnapshotPromises.clear();
  if (window._userWebcamStream) {
    try {
      const tracks = typeof window._userWebcamStream.getTracks === "function" ? window._userWebcamStream.getTracks() : [];
      tracks.forEach((t) => {
        if (t && typeof t.stop === "function") {
          t.stop();
        }
      });
    } catch (e) {}
    window._userWebcamStream = null;
  }
  const doc = typeof document !== "undefined" ? document : null;
  const videoElement = doc ? doc.getElementById("webcam-video") : null;
  if (videoElement) {
    videoElement.srcObject = null;
  }
  setCamState(CAM_STATE.OFF);
}
window.stopCamera = stopCamera;

function toggleCamera() {
  const isCamActive = Boolean(window._userWebcamStream && window._userWebcamStream.active);
  if (isCamActive) {
    stopCamera();
    if (typeof showToast === "function") showToast("Đã tắt camera.", "info");
  } else {
    requestCameraAccess().then((success) => {
      if (success && typeof showToast === "function") {
        showToast("Đã bật camera.", "success");
      }
    });
  }
}
window.toggleCamera = toggleCamera;

async function switchCameraDevice(deviceId) {
  if (typeof window !== "undefined") {
    window._selectedVideoDeviceId = deviceId;
  }
  if (currentCamState === CAM_STATE.ON) {
    stopCamera();
    return await requestCameraAccess(null, deviceId);
  }
  return true;
}
window.switchCameraDevice = switchCameraDevice;


function updateCandidateAvatarAndName() {
  try {
    let user = typeof getCurrentUser === "function" ? getCurrentUser() : null;
    if (!user && typeof localStorage !== "undefined") {
      user = JSON.parse(localStorage.getItem("prepmate_current_user") || "null")
        || JSON.parse(localStorage.getItem("prepmate_auth_user") || "null");
    }
    const name = user ? (user.fullname || user.fullName || user.name || user.username || "Ứng viên") : "Bạn (Ứng viên)";

    const doc = typeof document !== "undefined" ? document : null;
    if (!doc) return;

    const nameEl = doc.getElementById("candidate-tile-name") || doc.querySelector("#candidate-tile .tile-user-name");
    if (nameEl) {
      nameEl.textContent = user ? `${name} (Bạn)` : "Bạn (Ứng viên)";
    }

    const initialsEl = doc.getElementById("candidate-initials");
    if (initialsEl && name && name !== "Bạn (Ứng viên)") {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      let initials = "UV";
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      } else if (parts.length === 1) {
        initials = parts[0].substring(0, 2).toUpperCase();
      }
      initialsEl.textContent = initials;
    }
  } catch (e) {}
}
window.updateCandidateAvatarAndName = updateCandidateAvatarAndName;

// Visual presence frame sampling & session aggregate (WI-COACH-VIDEO-01 Bước C, WI-COACH-VIDEO-02, WI-COACH-VIDEO-03 & WI-COACH-VIDEO-03R)
let _sessionVisualEvaluations = [];

// Periodic in-turn sampling state (WI-COACH-VIDEO-03 & WI-COACH-VIDEO-03R)
let _samplingIntervalTimer = null;
let _activeSamplingTurnIndex = null;
let _prevSampleFrameData = null;
let _prevSampleWidth = 0;
let _prevSampleHeight = 0;
let _isSamplingPaused = false;
let _pendingTurnSnapshotPromises = new Map();

function getActiveSessionId() {
  if (typeof window !== "undefined") {
    if (window.currentInterviewSession) {
      const id = window.currentInterviewSession.backendSessionId || window.currentInterviewSession.id;
      if (id) return String(id);
    }
    if (window.sessionStorage) {
      const sessId = window.sessionStorage.getItem("prepmate_backend_session_id") || window.sessionStorage.getItem("prepmate_active_session_id");
      if (sessId) return String(sessId);
    }
  }
  return "session_unknown";
}

function pauseInTurnSampling() {
  if (_isSamplingPaused) return;
  _isSamplingPaused = true;
  if (_samplingIntervalTimer) {
    clearInterval(_samplingIntervalTimer);
    _samplingIntervalTimer = null;
  }
  debugInterviewSafe("CAMERA", `Paused in-turn sampling (Turn #${_activeSamplingTurnIndex})`);
}

function resumeInTurnSampling() {
  if (!_isSamplingPaused) return;
  _isSamplingPaused = false;
  debugInterviewSafe("CAMERA", "Resuming in-turn sampling...");

  const isCamActive = Boolean(
    window._userWebcamStream &&
    window._userWebcamStream.active &&
    (!window._userWebcamStream.getVideoTracks || window._userWebcamStream.getVideoTracks().some(t => t.readyState === "live" && t.enabled !== false))
  );

  if (!isCamActive || currentCamState !== CAM_STATE.ON) {
    debugInterviewSafe("CAMERA", "Cannot resume sampling: camera is OFF or inactive");
    _activeSamplingTurnIndex = null;
    return;
  }

  const currentTurn = getActiveTurnIndex();
  const turnToResume = (currentTurn !== null && currentTurn !== undefined) ? currentTurn : _activeSamplingTurnIndex;
  if (turnToResume !== null && turnToResume !== undefined) {
    startInTurnSampling(turnToResume);
  }
}

function isSamplingPaused() {
  return _isSamplingPaused;
}

function flushPendingTurnSnapshot(turnIndex, maxWaitMs = 1500) {
  const sessionId = getActiveSessionId();
  const numericTurn = Number.isInteger(Number(turnIndex)) ? Number(turnIndex) : 0;
  const key = `${sessionId}_turn_${numericTurn}`;
  const pendingPromise = _pendingTurnSnapshotPromises.get(key);

  if (!pendingPromise) {
    return Promise.resolve(true);
  }

  let timeoutTimer = null;
  const timeoutPromise = new Promise((resolve) => {
    timeoutTimer = setTimeout(() => {
      debugInterviewSafe("CAMERA", `Pending snapshot write timed out for turn ${numericTurn}`);
      resolve(false);
    }, maxWaitMs);
  });

  return Promise.race([
    pendingPromise.then(() => true).catch(() => false),
    timeoutPromise,
  ]).finally(() => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
  });
}

function startInTurnSampling(turnIndex, customSessionId) {
  if (typeof window !== "undefined" && window._isInterviewSessionStarted === false) {
    debugInterviewSafe("CAMERA", "Cannot start in-turn sampling before interview is started.");
    return;
  }
  const numericTurn = Number.isInteger(Number(turnIndex)) ? Number(turnIndex) : 0;

  // If currently paused, do not sample
  if (_isSamplingPaused) {
    _activeSamplingTurnIndex = numericTurn;
    return;
  }

  // If already sampling this turn, don't restart interval
  if (_samplingIntervalTimer && _activeSamplingTurnIndex === numericTurn) {
    return;
  }

  // If sampling another turn, stop it first
  if (_samplingIntervalTimer) {
    stopInTurnSampling();
  }

  _activeSamplingTurnIndex = numericTurn;
  _prevSampleFrameData = null;
  _prevSampleWidth = 0;
  _prevSampleHeight = 0;

  debugInterviewSafe("CAMERA", `Starting in-turn sampling for Turn #${numericTurn}`);

  // Immediate capture for this turn
  try {
    captureAndAnalyzeCurrentFrame(numericTurn, null, customSessionId);
  } catch (err) {
    debugInterviewSafe("CAMERA", "Initial in-turn sample error:", err && err.message);
  }

  // Periodic sampling every 3 seconds (3000ms)
  _samplingIntervalTimer = setInterval(() => {
    const isCamActive = Boolean(
      window._userWebcamStream &&
      window._userWebcamStream.active &&
      (!window._userWebcamStream.getVideoTracks || window._userWebcamStream.getVideoTracks().some(t => t.readyState === "live" && t.enabled !== false))
    );

    if (!isCamActive || currentCamState !== CAM_STATE.ON || _isSamplingPaused) {
      stopInTurnSampling();
      return;
    }

    try {
      captureAndAnalyzeCurrentFrame(numericTurn, null, customSessionId);
    } catch (err) {
      debugInterviewSafe("CAMERA", "Periodic sampling tick error:", err && err.message);
    }
  }, 3000);
}

function stopInTurnSampling() {
  if (_samplingIntervalTimer) {
    clearInterval(_samplingIntervalTimer);
    _samplingIntervalTimer = null;
  }
  debugInterviewSafe("CAMERA", `Stopped in-turn sampling (was Turn #${_activeSamplingTurnIndex})`);
  _activeSamplingTurnIndex = null;
  _prevSampleFrameData = null;
  _prevSampleWidth = 0;
  _prevSampleHeight = 0;
}

function handleInterviewTurnStarted(turnIndex) {
  debugInterviewSafe("CAMERA", "handleInterviewTurnStarted:", turnIndex);
  if (typeof window !== "undefined" && window.PrepMateBodyLanguageAnalyzer) {
    try {
      const activeSid = (typeof getActiveSessionId === "function") ? getActiveSessionId() : "unassigned";
      window.PrepMateBodyLanguageAnalyzer.startTurn(turnIndex, activeSid);
    } catch (e) {}
  }
  const isCamActive = Boolean(
    window._userWebcamStream &&
    window._userWebcamStream.active &&
    (!window._userWebcamStream.getVideoTracks || window._userWebcamStream.getVideoTracks().some(t => t.readyState === "live" && t.enabled !== false))
  );
  if (isCamActive && currentCamState === CAM_STATE.ON && !_isSamplingPaused) {
    startInTurnSampling(turnIndex);
  } else {
    // Record camera-off turn placeholder
    captureAndAnalyzeCurrentFrame(turnIndex);
  }
}

function handleInterviewTurnCompleted(turnIndex) {
  debugInterviewSafe("CAMERA", "handleInterviewTurnCompleted:", turnIndex);
  stopInTurnSampling();
  if (typeof window !== "undefined" && window.PrepMateBodyLanguageAnalyzer && window.PrepMateBodyLanguageAnalyzer.isActive()) {
    try {
      window._lastTurnBodyLanguageSummary = window.PrepMateBodyLanguageAnalyzer.stopTurn();
    } catch (e) {}
  }

  const numericTurn = Number.isInteger(Number(turnIndex)) ? Number(turnIndex) : 0;
  const isCamActive = Boolean(
    window._userWebcamStream &&
    window._userWebcamStream.active &&
    (!window._userWebcamStream.getVideoTracks || window._userWebcamStream.getVideoTracks().some(t => t.readyState === "live" && t.enabled !== false))
  );

  // Safety fallback guarantee (WI-COACH-VIDEO-02B): if camera is ON and no snapshot was recorded yet for this turn, capture now
  const hasSnapshotForTurn = _sessionVisualEvaluations.some(ev => ev && ev.turnIndex === numericTurn && ev.hasSnapshot);
  if (isCamActive && currentCamState === CAM_STATE.ON && !_isSamplingPaused && !hasSnapshotForTurn) {
    try {
      captureAndAnalyzeCurrentFrame(numericTurn);
    } catch (err) {
      debugInterviewSafe("CAMERA", "Fallback capture on turn completed error:", err && err.message);
    }
  }

  return flushPendingTurnSnapshot(turnIndex);
}

function captureAndAnalyzeCurrentFrame(turnIndex, customEngine, targetSessionId) {
  if (_isSamplingPaused) {
    debugInterviewSafe("CAMERA", "Skipping capture: interview is paused");
    return null;
  }

  const vEngine = customEngine || (typeof VisualCoachingEngine !== "undefined" ? VisualCoachingEngine : null);
  const isCamActive = Boolean(
    window._userWebcamStream &&
    window._userWebcamStream.active &&
    (!window._userWebcamStream.getVideoTracks || window._userWebcamStream.getVideoTracks().some(t => t.readyState === "live" && t.enabled !== false))
  );

  const sessionId = targetSessionId || getActiveSessionId();

  if (!isCamActive) {
    const record = {
      turnIndex,
      sessionId,
      isEvaluated: false,
      cameraEnabled: false,
      hasSnapshot: false,
      timestamp: Date.now(),
    };
    const existingIdx = _sessionVisualEvaluations.findIndex(e => e.turnIndex === turnIndex && e.sessionId === sessionId);
    if (existingIdx >= 0) {
      _sessionVisualEvaluations[existingIdx] = record;
    } else {
      _sessionVisualEvaluations.push(record);
    }
    return record;
  }

  const doc = typeof document !== "undefined" ? document : null;
  const videoEl = doc ? doc.getElementById("webcam-video") : null;
  if (!videoEl || (!videoEl.videoWidth && !videoEl.width)) {
    const record = {
      turnIndex,
      sessionId,
      isEvaluated: false,
      cameraEnabled: true,
      hasSnapshot: false,
      reason: "Video element chưa có kích thước khung hình",
      timestamp: Date.now(),
    };
    const existingIdx = _sessionVisualEvaluations.findIndex(e => e.turnIndex === turnIndex && e.sessionId === sessionId);
    if (existingIdx >= 0) {
      _sessionVisualEvaluations[existingIdx] = record;
    } else {
      _sessionVisualEvaluations.push(record);
    }
    return record;
  }

  try {
    const width = videoEl.videoWidth || videoEl.width || 640;
    const height = videoEl.videoHeight || videoEl.height || 480;
    const canvas = doc.createElement("canvas");
    canvas.width = Math.min(width, 640);
    canvas.height = Math.min(height, 480);
    const ctx = canvas.getContext("2d");
    if (ctx && typeof ctx.drawImage === "function") {
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (vEngine && typeof vEngine.analyzeFrame === "function") {
        const evalResult = vEngine.analyzeFrame(imgData.data, canvas.width, canvas.height);

        // Motion delta calculation between consecutive samples (WI-COACH-VIDEO-03)
        let motionDelta = null;
        if (
          _prevSampleFrameData &&
          _prevSampleWidth === canvas.width &&
          _prevSampleHeight === canvas.height &&
          typeof vEngine.analyzeMotionDelta === "function"
        ) {
          try {
            motionDelta = vEngine.analyzeMotionDelta(_prevSampleFrameData, imgData.data, canvas.width, canvas.height);
          } catch (e) {}
        }

        // Cache current frame bytes for the next interval calculation
        try {
          _prevSampleFrameData = new Uint8ClampedArray(imgData.data);
          _prevSampleWidth = canvas.width;
          _prevSampleHeight = canvas.height;
        } catch (e) {}

        const existingIdx = _sessionVisualEvaluations.findIndex(e => e.turnIndex === turnIndex && e.sessionId === sessionId);
        const existingRecord = existingIdx >= 0 ? _sessionVisualEvaluations[existingIdx] : null;
        const prevSamples = (existingRecord && Array.isArray(existingRecord.temporalSamples)) ? existingRecord.temporalSamples : [];

        const sampleEntry = {
          timestamp: Date.now(),
          turnIndex,
          headOrientation: evalResult.headOrientation,
          bodyPosture: evalResult.bodyPosture,
          handGestures: evalResult.handGestures,
          motionDelta,
          luma: evalResult.metrics ? evalResult.metrics.meanLuma : undefined,
          confidence: evalResult.detection ? evalResult.detection.confidence : undefined,
          isPersonDetected: evalResult.detection ? evalResult.detection.hasPerson : false,
        };

        const record = {
          turnIndex,
          sessionId,
          timestamp: Date.now(),
          cameraEnabled: true,
          hasSnapshot: existingRecord ? Boolean(existingRecord.hasSnapshot) : false,
          snapshotWidth: existingRecord ? existingRecord.snapshotWidth : undefined,
          snapshotHeight: existingRecord ? existingRecord.snapshotHeight : undefined,
          snapshotMimeType: existingRecord ? existingRecord.snapshotMimeType : undefined,
          ...evalResult,
          temporalSamples: [...prevSamples, sampleEntry],
        };

        if (motionDelta && motionDelta.stability) {
          record.motionDelta = motionDelta;
          record.motionStability = motionDelta.stability;
          record.avgMotionDelta = motionDelta.avgDelta;
        }

        // Update or replace existing record for this turn (e.g. replacing earlier camera-off placeholder)
        if (existingIdx >= 0) {
          _sessionVisualEvaluations[existingIdx] = record;
        } else {
          _sessionVisualEvaluations.push(record);
        }

        // If snapshot has already been captured and persisted for this turn, avoid duplicate disk writes
        if (existingRecord && existingRecord.hasSnapshot) {
          return record;
        }

        // Asynchronously persist snapshot thumbnail in IndexedDB with race-condition tracking (WI-COACH-VIDEO-03R)
        const snapshotStore = (typeof PrepMateVisualSnapshotStore !== "undefined")
          ? PrepMateVisualSnapshotStore
          : ((typeof window !== "undefined" && window.PrepMateVisualSnapshotStore) ? window.PrepMateVisualSnapshotStore : null);

        if (snapshotStore && typeof snapshotStore.createThumbnailBlob === "function") {
          const boundSessionId = sessionId;
          const boundTurnIndex = turnIndex;
          const key = `${boundSessionId}_turn_${boundTurnIndex}`;

          const savePromise = (async () => {
            try {
              // Create thumbnail with safe timeout safeguard (2500ms)
              const thumb = await Promise.race([
                snapshotStore.createThumbnailBlob(canvas, 320, 240, 0.8),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Thumbnail creation timeout")), 2500)),
              ]);

              if (thumb && thumb.blob) {
                record.hasSnapshot = true;
                record.snapshotWidth = thumb.width;
                record.snapshotHeight = thumb.height;
                record.snapshotMimeType = thumb.mimeType;

                await Promise.race([
                  snapshotStore.saveSnapshot({
                    sessionId: boundSessionId,
                    turnIndex: boundTurnIndex,
                    capturedAt: record.timestamp,
                    mimeType: thumb.mimeType,
                    width: thumb.width,
                    height: thumb.height,
                    imageBlob: thumb.blob,
                    metrics: record,
                  }),
                  new Promise((_, reject) => setTimeout(() => reject(new Error("IndexedDB save timeout")), 2500)),
                ]);
              } else {
                record.hasSnapshot = false;
              }
            } catch (err) {
              record.hasSnapshot = false;
              record.snapshotError = err && err.message;
              debugInterviewSafe("CAMERA", "Thumbnail persistence error:", err && err.message);
            } finally {
              if (_pendingTurnSnapshotPromises.get(key) === savePromise) {
                _pendingTurnSnapshotPromises.delete(key);
              }
            }
          })();

          _pendingTurnSnapshotPromises.set(key, savePromise);
        }

        return record;
      }
    }
  } catch (err) {
    debugInterviewSafe("CAMERA", "Capture frame failed:", err && err.message);
  }
  return null;
}

function getSessionVisualEvaluations() {
  return _sessionVisualEvaluations;
}

function clearSessionVisualEvaluations() {
  _sessionVisualEvaluations = [];
}

function getSessionVisualReport(options = {}, customEngine) {
  const vEngine = customEngine || (typeof VisualCoachingEngine !== "undefined" ? VisualCoachingEngine : null);
  const cameraEverEnabled = Boolean(
    window._userWebcamStream ||
    _sessionVisualEvaluations.some((e) => e.cameraEnabled === true)
  );

  if (vEngine && typeof vEngine.aggregateSessionVisuals === "function") {
    return vEngine.aggregateSessionVisuals(_sessionVisualEvaluations, {
      cameraEnabled: cameraEverEnabled,
      ...options,
    });
  }
  return null;
}

// Window unloads cleanup
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("beforeunload", () => {
    try { stopInTurnSampling(); } catch (e) {}
    try { stopCamera(); } catch (e) {}
  });
}

window.captureAndAnalyzeCurrentFrame = captureAndAnalyzeCurrentFrame;
window.getSessionVisualEvaluations = getSessionVisualEvaluations;
window.clearSessionVisualEvaluations = clearSessionVisualEvaluations;
window.getSessionVisualReport = getSessionVisualReport;
window.startInTurnSampling = startInTurnSampling;
window.stopInTurnSampling = stopInTurnSampling;
window.handleInterviewTurnStarted = handleInterviewTurnStarted;
window.handleInterviewTurnCompleted = handleInterviewTurnCompleted;
window.pauseInTurnSampling = pauseInTurnSampling;
window.resumeInTurnSampling = resumeInTurnSampling;
window.isSamplingPaused = isSamplingPaused;
window.flushPendingTurnSnapshot = flushPendingTurnSnapshot;

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CAM_STATE,
    CAM_PRIVACY_DISCLOSURE,
    getCamState,
    setCamState,
    waitForVideoReady,
    getActiveTurnIndex,
    getActiveSamplingTurnIndex: () => _activeSamplingTurnIndex,
    requestCameraAccess,
    stopCamera,
    toggleCamera,
    updateCandidateAvatarAndName,
    captureAndAnalyzeCurrentFrame,
    getSessionVisualEvaluations,
    clearSessionVisualEvaluations,
    getSessionVisualReport,
    startInTurnSampling,
    stopInTurnSampling,
    handleInterviewTurnStarted,
    handleInterviewTurnCompleted,
    pauseInTurnSampling,
    resumeInTurnSampling,
    isSamplingPaused,
    flushPendingTurnSnapshot,
  };
}
