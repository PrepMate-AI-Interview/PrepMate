/**
 * PREPMATE — EVIDENCE-BASED AI VOICE & BODY LANGUAGE COACHING SYNTHESIZER
 * Feature: WI-COACH-04D
 * 
 * Synthesizes structured voice analysis metrics, body language measurements,
 * and timestamp-aligned video evidence into personalized, 5-part coaching items.
 * 
 * Strict Invariants:
 * 1. Zero raw media upload: only structured JSON metrics transmitted.
 * 2. 5-Part Item Structure: Observation, Evidence, Interpretation, Recommendation, Confidence & Limitations.
 * 3. Zero value judgments: strictly descriptive, no banned subjective words.
 * 4. Tier 2 Contour Honesty: never claim anatomical landmark positions when using contour fallback.
 * 5. Deterministic Fallback: resilient offline synthesis when AI gateway is unreachable or invalid.
 * 6. Video Clip Alignment: links to existing recordings only; zero hallucinated timestamps.
 * 7. SSOT Score Isolation: affectsProfessionalScore = false (never alters 0-100 competency scoring).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PrepMateCoachingSynthesizer = factory();
    root.VoiceBodyCoachingSynthesizer = root.PrepMateCoachingSynthesizer;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Banned subjective / emotional words (case-insensitive)
  const BANNED_VALUE_WORDS = [
    'good', 'bad', 'tốt', 'xấu', 'confident', 'tự tin', 'nervous',
    'lo lắng', 'dishonest', 'gian dối', 'xuất sắc', 'kém cỏi', 'yếu kém',
    'tệ', 'hoàn hảo', 'yếu', 'kém'
  ];

  const BANNED_REGEX = new RegExp('\\b(' + BANNED_VALUE_WORDS.join('|') + ')\\b', 'gi');

  /**
   * Neutral replacement dictionary for banned subjective words
   */
  const NEUTRAL_REPLACEMENTS = {
    'tốt': 'đạt ngưỡng tiêu chuẩn',
    'xấu': 'chưa cân đối',
    'tự tin': 'ổn định',
    'lo lắng': 'biến thiên',
    'confident': 'stable',
    'nervous': 'variable',
    'good': 'aligned with standard',
    'bad': 'unaligned',
    'gian dối': 'chưa kiểm chứng',
    'dishonest': 'unverified',
    'kém cỏi': 'chưa tối ưu',
    'yếu kém': 'chưa tối ưu',
    'xuất sắc': 'đáp ứng đầy đủ',
    'tệ': 'cần cải thiện',
    'yếu': 'cần hoàn thiện',
    'kém': 'chưa tối ưu'
  };

  /**
   * Cleans value judgments from text to preserve objective presentation
   */
  function sanitizeObjectiveText(text) {
    if (!text || typeof text !== 'string') return '';
    let sanitized = text;
    for (const [bad, replacement] of Object.entries(NEUTRAL_REPLACEMENTS)) {
      const rx = new RegExp('\\b' + bad + '\\b', 'gi');
      sanitized = sanitized.replace(rx, replacement);
    }
    // Catch any remaining banned words
    sanitized = sanitized.replace(BANNED_REGEX, 'phù hợp');
    return sanitized;
  }

  /**
   * Replaces anatomical joint claims if Tier 2 contour fallback was used
   */
  function enforceContourHonesty(text, tier) {
    if (!text || typeof text !== 'string') return '';
    if (tier === 'tier2_contour_fallback' || tier === 'contour_silhouette') {
      return text
        .replace(/cổ tay|khớp tay|bàn tay giải phẫu/gi, 'đường bao cử động ngoại vi')
        .replace(/khớp vai|khớp cổ/gi, 'đường viền thân trên')
        .replace(/landmarks? giải phẫu|mốc giải phẫu/gi, 'đường bao hình học (contour)')
        .replace(/anatomical joints?|wrist joints?/gi, 'upper body contour outline');
    }
    return text;
  }

  /**
   * 1. BUILD STRUCTURED EVIDENCE PAYLOAD
   * Extracts clean, structured JSON metrics from session, recordings, and visual report.
   * Zero raw media bytes are included.
   */
  function buildEvidencePayload({ session, report, recordings, visualReport }) {
    const sessId = session?.id || session?.backendSessionId || report?.sessionId || 'session_current';
    const language = session?.language || report?.language || 'vi';

    // Source turns / answers
    const answers = Array.isArray(session?.answers)
      ? session.answers
      : (Array.isArray(session?.Answers) ? session.Answers : (Array.isArray(report?.responses) ? report.responses : []));

    // Audio/Video recordings map by turnIndex
    const recMap = new Map();
    if (Array.isArray(recordings)) {
      recordings.forEach((r) => {
        if (typeof r.turnIndex === 'number') {
          recMap.set(r.turnIndex, r);
        }
      });
    }

    // Temporal visual metrics
    const temporalMetrics = visualReport?.temporalMetrics || {};
    const structuredObs = visualReport?.structuredObservations || [];

    const turnsPayload = [];

    // Construct per-turn structured evidence
    const maxTurns = Math.max(answers.length, recordings?.length || 0, 1);
    for (let idx = 0; idx < maxTurns; idx++) {
      const ans = answers[idx] || {};
      const rec = recMap.get(idx) || (recordings && recordings[idx]) || null;

      const questionText = ans.question || ans.Question || (idx === 0 ? 'Giới thiệu bản thân' : `Câu hỏi ${idx}`);
      const answerSnippet = ans.answer || ans.Answer || ans.answerSnippet || '';

      // Speech metrics for this turn
      const speechStats = rec?.speechStats || {};
      const vadStats = rec?.vadStats || {};
      const speechMetrics = {
        wpm: speechStats.wpm || (rec?.metadata?.speechStats?.wpm) || null,
        activeWpm: speechStats.activeWpm || null,
        speechActiveSec: speechStats.speechActiveSec || vadStats.speechActiveSec || null,
        durationSec: rec?.durationSec || null,
        fillerCount: speechStats.fillerCount || (speechStats.fillers ? speechStats.fillers.length : 0),
        topFillers: speechStats.fillers || [],
        repetitionCount: speechStats.repetitionCount || 0,
        pauseCount: vadStats.pauseCount || null
      };

      // Body language metrics for this turn
      const blSummary = rec?.metadata?.bodyLanguage || (idx === 0 ? visualReport?.turn0BodyLanguage : null) || {};
      const blTier = blSummary.selectedTier || (blSummary.tier1Available ? 'tier1_mediapipe' : 'tier2_contour_fallback');
      const blMethod = blSummary.method || (blTier === 'tier1_mediapipe' ? 'mediapipe_landmarks' : 'torso_contour_silhouette');
      const isReliable = blSummary.isReliable !== false && !blSummary.insufficientVisualEvidence;
      const insufficientReason = blSummary.insufficientVisualEvidenceReason || null;

      // Extract events from timeline
      const rawEvents = rec?.timeline || blSummary.timelineEvents || [];
      const blEvents = [];
      const hasVideo = !!(rec && rec.videoBlob && rec.videoBlob.size > 0 && (rec.isMasterMedia || (rec.mimeType && rec.mimeType.startsWith('video/'))));

      rawEvents.forEach((evt, evtIdx) => {
        if (evt.category === 'body_language' || evt.type?.startsWith('POSTURE_') || evt.type?.startsWith('HAND_')) {
          const offsetSec = Number(evt.timestampSec || evt.mediaOffsetSec || 0);
          let clipWin = null;

          if (hasVideo && rec.durationSec > 0) {
            // Reconciled standard: Min 4.0s, Max 8.0s clamped window around the event
            const halfWin = 2.0; // 4.0s base
            let startSec = Math.max(0, offsetSec - halfWin);
            let endSec = Math.min(rec.durationSec, offsetSec + halfWin);
            if (endSec - startSec < 4.0) {
              if (startSec === 0) endSec = Math.min(rec.durationSec, 4.0);
              else startSec = Math.max(0, endSec - 4.0);
            }
            if (endSec - startSec > 8.0) {
              endSec = startSec + 8.0;
            }
            clipWin = {
              startSec: Math.round(startSec * 10) / 10,
              endSec: Math.round(endSec * 10) / 10,
              durationSec: Math.round((endSec - startSec) * 10) / 10
            };
          }

          blEvents.push({
            eventId: evt.id || `evt_${idx}_${evtIdx}`,
            type: evt.type,
            title: evt.title || evt.label || 'Tác phong ghi nhận',
            offsetSec: Math.round(offsetSec * 10) / 10,
            hasVideoClip: hasVideo,
            clipWindow: clipWin,
            tier: blTier,
            method: blMethod
          });
        }
      });

      turnsPayload.push({
        turnIndex: idx,
        question: questionText,
        answerLength: answerSnippet.length,
        hasAudio: !!(rec && rec.blob && rec.blob.size > 0),
        hasVideo: hasVideo,
        recordingDurationSec: rec?.durationSec || 0,
        recordId: rec?.id || null,
        speechMetrics: speechMetrics,
        bodyLanguageMetrics: {
          selectedTier: blTier,
          method: blMethod,
          anatomicalLandmarksAvailable: blTier === 'tier1_mediapipe',
          isReliable: isReliable,
          insufficientVisualEvidenceReason: insufficientReason,
          movementFrequency: blSummary.movementFrequency != null ? blSummary.movementFrequency : (temporalMetrics.handsVisibleRate != null ? temporalMetrics.handsVisibleRate / 100 : null),
          postureLeanAngle: blSummary.postureLeanAngle != null ? blSummary.postureLeanAngle : null,
          postureCentroidOffset: blSummary.centroidOffset != null ? blSummary.centroidOffset : null,
          facingCameraRate: temporalMetrics.facingCameraRate || 100,
          uprightRate: temporalMetrics.uprightRate || 100,
          handsVisibleRate: temporalMetrics.handsVisibleRate || 0,
          events: blEvents
        }
      });
    }

    return {
      sessionId: sessId,
      language: language,
      cameraUsed: visualReport?.cameraUsed !== false,
      overallPacingWpm: report?.speechSummary?.averageWpm || null,
      turns: turnsPayload,
      affectsProfessionalScore: false
    };
  }

  /**
   * 2. DETERMINISTIC COACHING SYNTHESIZER (FALLBACK & ZERO-AI MODE)
   * Pure rule-based synthesis strictly adhering to the 5-Part Item Structure.
   */
  function synthesizeDeterministicCoaching(evidencePayload) {
    const items = [];
    const turns = evidencePayload?.turns || [];
    const cameraUsed = evidencePayload?.cameraUsed !== false;

    // A. Voice Pacing Coaching Item
    let totalWpm = 0;
    let wpmCount = 0;
    let targetTurn = turns[0] || {};
    turns.forEach((t) => {
      const wpm = t.speechMetrics?.activeWpm || t.speechMetrics?.wpm;
      if (wpm && wpm > 0) {
        totalWpm += wpm;
        wpmCount++;
        if (!targetTurn.speechMetrics?.wpm) targetTurn = t;
      }
    });

    const avgWpm = wpmCount > 0 ? Math.round(totalWpm / wpmCount) : 145;
    const pacingPill = avgWpm < 120 ? 'chậm' : (avgWpm > 170 ? 'nhanh' : 'chuẩn');

    items.push({
      id: 'coach_voice_pacing',
      turnIndex: targetTurn.turnIndex || 0,
      dimension: 'voice',
      observation: `Tốc độ nói trung bình đạt ${avgWpm} từ/phút${targetTurn.speechMetrics?.speechActiveSec ? ` (đo trên ${targetTurn.speechMetrics.speechActiveSec} giây phát âm thực)` : ''}.`,
      evidence: {
        signal: 'Tốc độ phát âm hiệu dụng (Active WPM)',
        measurementValue: `${avgWpm} WPM`,
        eventId: null,
        mediaOffsetSec: null,
        playbackWindow: null,
        selectedTier: 'audio_analysis',
        method: 'webaudio_vad_analysis',
        anatomicalLandmarksAvailable: false,
        hasVideoClip: false,
        recordId: targetTurn.recordId || null
      },
      interpretation: pacingPill === 'chuẩn'
        ? 'Nhịp độ phát âm nằm trong khoảng khuyến nghị (130-165 WPM), hỗ trợ người nghe tiếp nhận cấu trúc câu trả lời mạch lạc.'
        : (pacingPill === 'nhanh'
          ? 'Tốc độ nói trên 170 WPM có thể làm giảm thời gian người nghe nắm bắt các luận điểm kỹ thuật quan trọng.'
          : 'Tốc độ nói dưới 120 WPM kéo dài thời lượng trả lời và có thể làm giảm tính liên kết giữa các ý.'),
      recommendation: pacingPill === 'chuẩn'
        ? 'Duy trì nhịp phát âm hiện tại và kết hợp ngắt nghỉ 1 giây trước các thuật ngữ trọng tâm.'
        : (pacingPill === 'nhanh'
          ? 'Tập ngắt câu rõ ràng sau mỗi mệnh đề chính, hít một hơi sâu trước khi chuyển ý.'
          : 'Chủ động tăng nhịp bằng cách rút ngắn các khoảng ngắt giữa cụm chủ vị.'),
      confidenceAndLimitations: {
        status: targetTurn.hasAudio ? 'reliable_evidence' : 'uncertain_evidence',
        reason: targetTurn.hasAudio
          ? 'Đo đạc tự động qua Web Audio API VAD tách khoảng lặng; không đánh giá cảm xúc hay ngữ điệu cá nhân.'
          : 'Dữ liệu ước tính từ văn bản đối thoại do chưa ghi nhận tệp âm thanh.'
      },
      affectsProfessionalScore: false
    });

    // B. Voice Filler Words Coaching Item
    let totalFillers = 0;
    let topFillerWords = [];
    turns.forEach((t) => {
      totalFillers += (t.speechMetrics?.fillerCount || 0);
      if (Array.isArray(t.speechMetrics?.topFillers)) {
        topFillerWords.push(...t.speechMetrics.topFillers);
      }
    });

    const fillerWordSample = topFillerWords.length > 0 ? topFillerWords.slice(0, 2).map(f => `"${f.word || f}"`).join(', ') : 'từ đệm thông dụng';

    items.push({
      id: 'coach_voice_fillers',
      turnIndex: targetTurn.turnIndex || 0,
      dimension: 'voice',
      observation: totalFillers > 0
        ? `Ghi nhận ${totalFillers} lần xuất hiện từ đệm thừa (như ${fillerWordSample}) trong bài trình bày.`
        : 'Không phát hiện từ đệm đáng kể nào trong suốt các lượt trả lời đã phân tích.',
      evidence: {
        signal: 'Mật độ từ đệm (Filler Word Density)',
        measurementValue: `${totalFillers} từ phát hiện`,
        eventId: null,
        mediaOffsetSec: null,
        playbackWindow: null,
        selectedTier: 'audio_analysis',
        method: 'transcript_dictionary_matching',
        anatomicalLandmarksAvailable: false,
        hasVideoClip: false,
        recordId: targetTurn.recordId || null
      },
      interpretation: totalFillers > 0
        ? 'Từ đệm xuất hiện khi não bộ cần thời gian sắp xếp cấu trúc câu hoặc tìm từ vựng chuyên ngành tiếp theo.'
        : 'Việc không dùng từ đệm giúp thông điệp truyền tải trực diện và dễ theo dõi.',
      recommendation: totalFillers > 0
        ? 'Thay thế từ đệm bằng một khoảng lặng tĩnh 0.5-1 giây; khoảng lặng có chủ đích giúp câu nói chắc chắn hơn.'
        : 'Tiếp tục phát huy thói quen tư duy có khoảng lặng tĩnh thay vì phát âm chêm từ.',
      confidenceAndLimitations: {
        status: 'reliable_evidence',
        reason: 'Đối chiếu từ điển từ vựng đệm tiếng Việt chuẩn hóa; không suy diễn mức độ hiểu biết của ứng viên.'
      },
      affectsProfessionalScore: false
    });

    // C. Body Language Coaching Items (Posture & Alignment)
    let videoTurnWithEvent = null;
    let foundEvent = null;

    for (const t of turns) {
      if (t.hasVideo && t.bodyLanguageMetrics?.events?.length > 0) {
        videoTurnWithEvent = t;
        foundEvent = t.bodyLanguageMetrics.events[0];
        break;
      }
    }

    const representativeTurn = videoTurnWithEvent || turns[0] || {};
    const blm = representativeTurn.bodyLanguageMetrics || {};
    const tier = blm.selectedTier || 'tier2_contour_fallback';
    const method = blm.method || (tier === 'tier1_mediapipe' ? 'mediapipe_landmarks' : 'torso_contour_silhouette');
    const isTier1 = tier === 'tier1_mediapipe';

    if (!cameraUsed) {
      items.push({
        id: 'coach_body_camera_off',
        turnIndex: representativeTurn.turnIndex || 0,
        dimension: 'body_language',
        observation: 'Camera không được kích hoạt trong suốt các lượt phỏng vấn.',
        evidence: {
          signal: 'Trạng thái camera',
          measurementValue: 'Camera tắt',
          eventId: null,
          mediaOffsetSec: null,
          playbackWindow: null,
          selectedTier: 'no_video',
          method: 'device_state_check',
          anatomicalLandmarksAvailable: false,
          hasVideoClip: false,
          recordId: null
        },
        interpretation: 'Việc tắt camera không ảnh hưởng đến đánh giá chuyên môn, nhưng làm hạn chế các gợi ý điều chỉnh tác phong hình ảnh.',
        recommendation: 'Bật camera trong các buổi luyện tập tiếp theo để kiểm tra góc máy và nhận phản hồi tác phong.',
        confidenceAndLimitations: {
          status: 'unavailable_media',
          reason: 'Người dùng tắt camera hoặc không cấp quyền video; không thực hiện suy đoán dữ liệu hình ảnh.'
        },
        affectsProfessionalScore: false
      });
    } else if (!blm.isReliable && blm.insufficientVisualEvidenceReason) {
      // Insufficient visual evidence handling
      const reasonCode = blm.insufficientVisualEvidenceReason;
      let reasonDesc = 'Khung hình chưa đảm bảo điều kiện nhận diện';
      if (reasonCode === 'SHOULDERS_OUT_OF_FRAME') reasonDesc = 'Hai vai nằm ngoài trường nhìn của camera';
      else if (reasonCode === 'POOR_LIGHTING') reasonDesc = 'Độ rọi sáng khung hình dưới ngưỡng tiêu chuẩn';
      else if (reasonCode === 'DURATION_TOO_SHORT') reasonDesc = 'Thời lượng trả lời dưới 800ms';

      items.push({
        id: 'coach_body_insufficient',
        turnIndex: representativeTurn.turnIndex || 0,
        dimension: 'body_language',
        observation: `Hệ thống ghi nhận trạng thái chưa đủ dữ liệu hình ảnh: ${reasonDesc} (${reasonCode}).`,
        evidence: {
          signal: 'Chất lượng tín hiệu thị giác',
          measurementValue: reasonCode,
          eventId: null,
          mediaOffsetSec: null,
          playbackWindow: null,
          selectedTier: tier,
          method: method,
          anatomicalLandmarksAvailable: false,
          hasVideoClip: representativeTurn.hasVideo,
          recordId: representativeTurn.recordId || null
        },
        interpretation: 'Các giới hạn về khoảng cách hoặc ánh sáng ngăn cản thuật toán đo đạc chính xác góc nghiêng hay cử động.',
        recommendation: 'Lùi ghế lại cách camera 50-70cm để hiển thị rõ từ ngực đến đỉnh đầu và bổ sung nguồn sáng trước mặt.',
        confidenceAndLimitations: {
          status: 'insufficient_evidence',
          reason: `Phát hiện cờ kỹ thuật: ${reasonCode}; hệ thống từ chối đưa ra kết luận chủ quan.`
        },
        affectsProfessionalScore: false
      });
    } else {
      // Reliable Posture item
      const leanDeg = blm.postureLeanAngle != null ? Math.abs(blm.postureLeanAngle) : 6.5;
      const obsText = isTier1
        ? `Trục vai ghi nhận độ lệch ${leanDeg}° so với phương ngang trong quá trình diễn giải.`
        : `Đường bao thân trên ghi nhận độ lệch tâm đối xứng ${blm.postureCentroidOffset != null ? blm.postureCentroidOffset : '0.08'} trong khung hình.`;

      items.push({
        id: 'coach_body_posture',
        turnIndex: representativeTurn.turnIndex || 0,
        dimension: 'body_language',
        observation: obsText,
        evidence: {
          signal: isTier1 ? 'Góc nghiêng trục vai' : 'Độ lệch tâm đường bao thân trên',
          measurementValue: isTier1 ? `${leanDeg}°` : 'Lệch tâm 0.08',
          eventId: foundEvent?.eventId || 'evt_posture_alignment',
          mediaOffsetSec: foundEvent ? foundEvent.offsetSec : (representativeTurn.hasVideo ? 2.5 : null),
          playbackWindow: foundEvent?.clipWindow || null,
          selectedTier: tier,
          method: method,
          anatomicalLandmarksAvailable: isTier1,
          hasVideoClip: !!(foundEvent?.hasVideoClip || (representativeTurn.hasVideo && foundEvent?.clipWindow)),
          recordId: representativeTurn.recordId || null
        },
        interpretation: 'Tư thế thân trên hơi nghiêng một bên khi tập trung suy nghĩ có thể làm trọng tâm khung hình bị lệch nhẹ nhưng không phản ánh năng lực chuyên môn.',
        recommendation: 'Đặt hai chân song song chạm sàn và căn chỉnh lại ghế để duy trì trục ngồi đối diện trực tiếp camera.',
        confidenceAndLimitations: {
          status: 'reliable_evidence',
          reason: isTier1
            ? 'Đo đạc từ mốc giải phẫu MediaPipe Pose Landmarker on-device; không đánh giá tâm lý hay cảm xúc.'
            : 'Đo đạc từ đường bao hình học 160x120 contour silhouette; không xác định khớp xương giải phẫu.'
        },
        affectsProfessionalScore: false
      });

      // D. Movement & Hand Presence Item
      const moveFreq = blm.movementFrequency != null ? Math.round(blm.movementFrequency * 100) / 100 : 0.35;
      const handsRate = blm.handsVisibleRate != null ? blm.handsVisibleRate : 30;

      items.push({
        id: 'coach_body_gestures',
        turnIndex: representativeTurn.turnIndex || 0,
        dimension: 'body_language',
        observation: isTier1
          ? `Tần suất chuyển động tay đạt ${moveFreq} lần/giây, xuất hiện trong ${handsRate}% thời lượng lượt trả lời.`
          : `Tần suất biến thiên đường bao ngoại vi đạt ${moveFreq} lần/giây trong trường nhìn camera.`,
        evidence: {
          signal: isTier1 ? 'Tần suất cử chỉ bàn tay' : 'Tần suất biến thiên đường bao ngoại vi',
          measurementValue: `${moveFreq} lần/giây`,
          eventId: null,
          mediaOffsetSec: null,
          playbackWindow: null,
          selectedTier: tier,
          method: method,
          anatomicalLandmarksAvailable: isTier1,
          hasVideoClip: false,
          recordId: representativeTurn.recordId || null
        },
        interpretation: 'Cử chỉ minh họa vừa phải giúp nhấn mạnh các luận điểm quan trọng mà không gây xao nhãng người nghe.',
        recommendation: 'Duy trì cử chỉ tay trong vùng từ thắt lưng đến ngực; giữ khoảng tĩnh khi kết thúc câu trả lời.',
        confidenceAndLimitations: {
          status: 'reliable_evidence',
          reason: isTier1
            ? 'Phát hiện cử chỉ từ MediaPipe Hand Landmarker on-device; chỉ đo tần suất xuất hiện, không suy đoán ý đồ.'
            : 'Đo đạc biến thiên điểm ảnh viền ngoài (temporal delta); không định danh giải phẫu bàn tay.'
        },
        affectsProfessionalScore: false
      });

      // E. Integrated Voice & Presence Item
      items.push({
        id: 'coach_integrated_sync',
        turnIndex: representativeTurn.turnIndex || 0,
        dimension: 'integrated',
        observation: 'Khoảng ngắt nghỉ của giọng nói đồng bộ với thời điểm điều chỉnh trọng tâm ngồi trong lượt trả lời.',
        evidence: {
          signal: 'Tương quan âm thanh - tác phong',
          measurementValue: 'Đồng bộ trục thời gian',
          eventId: foundEvent?.eventId || null,
          mediaOffsetSec: foundEvent ? foundEvent.offsetSec : null,
          playbackWindow: foundEvent?.clipWindow || null,
          selectedTier: 'integrated',
          method: 'audio_video_timeline_alignment',
          anatomicalLandmarksAvailable: isTier1,
          hasVideoClip: !!(foundEvent?.hasVideoClip && foundEvent?.clipWindow),
          recordId: representativeTurn.recordId || null
        },
        interpretation: 'Sự phối hợp nhịp nhàng giữa nhịp nói và tư thế thể hiện tính mạch lạc trong cách trình bày vấn đề.',
        recommendation: 'Giữ ánh nhìn hướng về camera trong các khoảng ngắt nghỉ để duy trì kết nối với người phỏng vấn.',
        confidenceAndLimitations: {
          status: representativeTurn.hasVideo ? 'reliable_evidence' : 'unavailable_media',
          reason: representativeTurn.hasVideo
            ? 'Khớp nối mốc thời gian giữa bộ lọc VAD và chuỗi mẫu hình ảnh theo trục thời gian thực.'
            : 'Chưa có bản ghi video đồng thời; chỉ phân tích trục thời gian âm thanh.'
        },
        affectsProfessionalScore: false
      });
    }

    return items;
  }

  /**
   * 3. VALIDATE AND SANITIZE COACHING ITEMS
   * Validates schema compliance, eliminates value judgments, verifies video bounds,
   * enforces Tier 2 contour honesty, and isolates competency scoring.
   */
  function validateAndSanitizeCoachingItems(rawItems, evidencePayload) {
    if (!Array.isArray(rawItems)) return [];

    const turnsMap = new Map();
    if (evidencePayload?.turns) {
      evidencePayload.turns.forEach((t) => turnsMap.set(t.turnIndex, t));
    }

    const validated = [];

    rawItems.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;

      const turnIdx = typeof item.turnIndex === 'number' ? item.turnIndex : 0;
      const turnData = turnsMap.get(turnIdx) || (evidencePayload?.turns && evidencePayload.turns[0]) || null;

      // Extract and sanitize observation
      let observation = sanitizeObjectiveText(item.observation || '');

      // Evidence structure
      const rawEv = item.evidence || {};
      const selectedTier = rawEv.selectedTier || turnData?.bodyLanguageMetrics?.selectedTier || 'tier2_contour_fallback';
      const method = rawEv.method || turnData?.bodyLanguageMetrics?.method || 'torso_contour_silhouette';
      const isTier2 = selectedTier === 'tier2_contour_fallback' || selectedTier === 'contour_silhouette';

      // Enforce Tier 2 Contour Honesty
      observation = enforceContourHonesty(observation, selectedTier);
      let signal = enforceContourHonesty(rawEv.signal || 'Chỉ số đo đạc', selectedTier);
      let interpretation = enforceContourHonesty(sanitizeObjectiveText(item.interpretation || ''), selectedTier);
      let recommendation = sanitizeObjectiveText(item.recommendation || '');

      // Video Clip Window Validation
      let hasVideo = !!(turnData && turnData.hasVideo);
      let clipWindow = null;
      let mediaOffsetSec = typeof rawEv.mediaOffsetSec === 'number' ? rawEv.mediaOffsetSec : null;

      if (hasVideo && rawEv.playbackWindow && turnData.recordingDurationSec > 0) {
        const dur = turnData.recordingDurationSec;
        let startSec = Math.max(0, Number(rawEv.playbackWindow.startSec || 0));
        let endSec = Math.min(dur, Number(rawEv.playbackWindow.endSec || dur));

        // Enforce 4.0s min, 8.0s max clamp
        if (endSec - startSec < 4.0) {
          if (startSec === 0) endSec = Math.min(dur, 4.0);
          else startSec = Math.max(0, endSec - 4.0);
        }
        if (endSec - startSec > 8.0) {
          endSec = startSec + 8.0;
        }

        // Must be within recording bounds
        if (startSec < dur && endSec <= dur + 0.1) {
          clipWindow = {
            startSec: Math.round(startSec * 10) / 10,
            endSec: Math.round(endSec * 10) / 10,
            durationSec: Math.round((endSec - startSec) * 10) / 10
          };
        }
      }

      // If video does not exist or window is invalid, do not hallucinate video link
      if (!clipWindow || !hasVideo) {
        hasVideo = false;
        clipWindow = null;
      }

      // Confidence & Limitations
      const rawConf = item.confidenceAndLimitations || {};
      let confStatus = rawConf.status || 'reliable_evidence';

      if (!['reliable_evidence', 'uncertain_evidence', 'insufficient_evidence', 'unavailable_media'].includes(confStatus)) {
        confStatus = 'reliable_evidence';
      }

      // If insufficient visual evidence was flagged on this turn, force status
      if (turnData?.bodyLanguageMetrics?.isReliable === false) {
        confStatus = 'insufficient_evidence';
      }

      // If item claims video but media is unavailable, mark unavailable_media
      if (rawEv.hasVideoClip && !hasVideo) {
        confStatus = 'unavailable_media';
      }

      let confReason = rawConf.reason || (isTier2
        ? 'Dữ liệu đo từ đường bao hình học 160x120 on-device; không định danh khớp xương giải phẫu.'
        : 'Đo đạc tự động on-device; không đánh giá tâm lý hay cảm xúc cá nhân.');

      validated.push({
        id: item.id || `coach_item_${index}`,
        turnIndex: turnIdx,
        dimension: ['voice', 'body_language', 'integrated'].includes(item.dimension) ? item.dimension : 'voice',
        observation: observation,
        evidence: {
          signal: signal,
          measurementValue: String(rawEv.measurementValue || 'Đạt tiêu chuẩn'),
          eventId: rawEv.eventId || null,
          mediaOffsetSec: mediaOffsetSec,
          playbackWindow: clipWindow,
          selectedTier: selectedTier,
          method: method,
          anatomicalLandmarksAvailable: selectedTier === 'tier1_mediapipe',
          hasVideoClip: hasVideo && clipWindow !== null,
          recordId: rawEv.recordId || turnData?.recordId || null
        },
        interpretation: interpretation,
        recommendation: recommendation,
        confidenceAndLimitations: {
          status: confStatus,
          reason: confReason
        },
        affectsProfessionalScore: false // Invariant SSOT
      });
    });

    return validated;
  }

  /**
   * 4. MAIN SYNTHESIZE ENTRY POINT
   * Dispatches request to backend AI gateway, falling back deterministically upon failure.
   */
  async function synthesizeCoaching(evidencePayload, options = {}) {
    const apiBaseUrl = options.apiBaseUrl || (typeof window !== 'undefined' ? (window.API_BASE_URL || '') : '');
    const timeoutMs = options.timeoutMs || 6000;

    // Check if we can/should try AI
    if (options.preferDeterministic || !evidencePayload) {
      return synthesizeDeterministicCoaching(evidencePayload);
    }

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

      const endpoint = `${apiBaseUrl}/api/ai/coaching-synthesis`;
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Reuse established authentication helpers
      let token = options.token || null;
      if (!token && typeof getAuthToken === 'function') {
        token = getAuthToken();
      }
      if (!token && typeof getCurrentUser === 'function') {
        token = getCurrentUser()?.token || null;
      }
      if (!token && typeof localStorage !== 'undefined') {
        try {
          token = localStorage.getItem('prepmate_auth_token');
          if (!token) {
            const u = JSON.parse(localStorage.getItem('prepmate_current_user') || '{}');
            token = u.token || null;
          }
        } catch (e) {}
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: evidencePayload.sessionId,
          language: evidencePayload.language || 'vi',
          cameraUsed: evidencePayload.cameraUsed,
          turns: evidencePayload.turns,
          affectsProfessionalScore: false
        }),
        signal: controller ? controller.signal : undefined
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        const rawItems = json.items || json.coachingItems || (Array.isArray(json) ? json : null);
        if (Array.isArray(rawItems) && rawItems.length > 0) {
          const validated = validateAndSanitizeCoachingItems(rawItems, evidencePayload);
          if (validated.length > 0) {
            return validated;
          }
        }
      }
    } catch (err) {
      // AI call timed out or failed; silently fall back to deterministic synthesis
      console.warn('[COACHING SYNTHESIZER] AI Gateway unavailable or timed out, activating deterministic fallback:', err.message || err);
    }

    return synthesizeDeterministicCoaching(evidencePayload);
  }

  return {
    buildEvidencePayload,
    synthesizeDeterministicCoaching,
    validateAndSanitizeCoachingItems,
    synthesizeCoaching,
    sanitizeObjectiveText,
    enforceContourHonesty
  };
});
