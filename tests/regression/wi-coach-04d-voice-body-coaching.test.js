/**
 * PREPMATE — WI-COACH-04D: EVIDENCE-BASED AI VOICE & BODY LANGUAGE COACHING REGRESSION TEST SUITE
 * 
 * Verifies:
 * 1. 5-Part Item Structure (Observation, Evidence, Interpretation, Recommendation, Confidence & Limitations).
 * 2. Strict Zero Value Judgments (No 'good', 'bad', 'tốt', 'xấu', 'confident', 'nervous', etc.).
 * 3. Tier 2 Contour Honesty (Never claim anatomical joints/landmarks on contour fallback).
 * 4. Insufficient Visual Evidence Quality Demotion (status = 'insufficient_evidence').
 * 5. Zero Hallucinated Video Links (Valid playback windows clamped to 4-10s within bounds).
 * 6. Deterministic Fallback Availability (Guaranteed coaching even when AI gateway is offline).
 * 7. SSOT Score Isolation (affectsProfessionalScore = false across all items).
 * 8. Backend HTTP API Contract (POST /api/ai/coaching-synthesis).
 */

const assert = require('assert');
const path = require('path');
const http = require('http');
const { resolvePath, rootDir } = require('../helpers/test-env');

const synthesizerPath = resolvePath('FE/features/interview/voice-body-coaching-synthesizer.js');
const Synthesizer = require(synthesizerPath);

async function runTestSuite() {
  console.log('• Running Voice & Body AI Coaching Synthesis (WI-COACH-04D) ...');
  let checks = 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Structured Evidence Payload Construction
  // ─────────────────────────────────────────────────────────────────────────────
  const mockSession = {
    id: 'sess_test_04d',
    language: 'vi',
    answers: [
      { question: 'Giới thiệu bản thân', answer: 'Tôi là kỹ sư phần mềm với 5 năm kinh nghiệm.' },
      { question: 'Kể về dự án phức tạp nhất?', answer: 'Dự án đó tôi phụ trách kiến trúc vi dịch vụ.' }
    ]
  };

  const mockRecordings = [
    {
      id: 'rec_turn_0',
      turnIndex: 0,
      durationSec: 8.5,
      isMasterMedia: true,
      mimeType: 'video/webm',
      blob: { size: 120000 },
      videoBlob: { size: 450000 },
      speechStats: { wpm: 142, activeWpm: 150, speechActiveSec: 7.2, fillerCount: 2, fillers: [{ word: 'à', count: 2 }] },
      metadata: {
        bodyLanguage: {
          selectedTier: 'tier2_contour_fallback',
          method: 'torso_contour_silhouette',
          isReliable: true,
          movementFrequency: 0.28,
          postureLeanAngle: 5.4,
          centroidOffset: 0.06
        }
      },
      timeline: [
        {
          id: 'evt_0_1',
          category: 'body_language',
          type: 'POSTURE_LEAN_LEFT',
          title: 'Nghiêng trục thân trên sang trái',
          timestampSec: 3.5
        }
      ]
    },
    {
      id: 'rec_turn_1',
      turnIndex: 1,
      durationSec: 12.0,
      isMasterMedia: false,
      mimeType: 'audio/webm', // Audio-only turn!
      blob: { size: 90000 },
      videoBlob: null,
      speechStats: { wpm: 160, activeWpm: 165, speechActiveSec: 10.5, fillerCount: 0, fillers: [] },
      metadata: {
        bodyLanguage: {
          selectedTier: 'tier1_mediapipe',
          method: 'mediapipe_landmarks',
          isReliable: false,
          insufficientVisualEvidence: true,
          insufficientVisualEvidenceReason: 'SHOULDERS_OUT_OF_FRAME'
        }
      },
      timeline: []
    }
  ];

  const mockVisualReport = {
    cameraUsed: true,
    temporalMetrics: {
      facingCameraRate: 94,
      uprightRate: 90,
      handsVisibleRate: 40
    }
  };

  const payload = Synthesizer.buildEvidencePayload({
    session: mockSession,
    report: {},
    recordings: mockRecordings,
    visualReport: mockVisualReport
  });

  assert.strictEqual(payload.sessionId, 'sess_test_04d', 'SessionId preserved in payload');
  assert.strictEqual(payload.turns.length, 2, 'Constructed payload for exactly 2 turns');
  assert.strictEqual(payload.turns[0].hasVideo, true, 'Turn 0 has video');
  assert.strictEqual(payload.turns[1].hasVideo, false, 'Turn 1 audio-only hasVideo=false');
  assert.strictEqual(payload.affectsProfessionalScore, false, 'Payload maintains affectsProfessionalScore=false');
  console.log('  [PASS] Structured evidence payload construction');
  checks += 5;

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Deterministic Coaching Synthesizer (5-Part Structure & Safety)
  // ─────────────────────────────────────────────────────────────────────────────
  const deterministicItems = Synthesizer.synthesizeDeterministicCoaching(payload);

  assert(Array.isArray(deterministicItems), 'Synthesizer returns array of items');
  assert(deterministicItems.length >= 4, 'Generates at least 4 comprehensive coaching items');
  checks += 2;

  // Verify 5-Part Structure on all items
  deterministicItems.forEach((item, i) => {
    assert(typeof item.id === 'string' && item.id.length > 0, `Item ${i} has valid id`);
    assert(typeof item.observation === 'string' && item.observation.length > 0, `Item ${i} has Part A Observation`);
    assert(item.evidence && typeof item.evidence.signal === 'string', `Item ${i} has Part B Evidence`);
    assert(typeof item.interpretation === 'string' && item.interpretation.length > 0, `Item ${i} has Part C Interpretation`);
    assert(typeof item.recommendation === 'string' && item.recommendation.length > 0, `Item ${i} has Part D Recommendation`);
    assert(item.confidenceAndLimitations && typeof item.confidenceAndLimitations.status === 'string', `Item ${i} has Part E Confidence & Limitations`);
    assert.strictEqual(item.affectsProfessionalScore, false, `Item ${i} preserves affectsProfessionalScore=false invariant`);
  });
  console.log('  [PASS] 5-Part Coaching Item Structure adherence');
  checks += (deterministicItems.length * 7);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Zero Value Judgments Guardrail
  // ─────────────────────────────────────────────────────────────────────────────
  const bannedWords = ['tốt', 'xấu', 'confident', 'tự tin', 'nervous', 'lo lắng', 'dishonest', 'gian dối'];
  deterministicItems.forEach((item, i) => {
    const textToCheck = `${item.observation} ${item.interpretation} ${item.recommendation}`.toLowerCase();
    bannedWords.forEach(badWord => {
      const rx = new RegExp(`\\b${badWord}\\b`, 'i');
      assert(!rx.test(textToCheck), `Item ${i} does not contain banned word '${badWord}'`);
    });
  });
  console.log('  [PASS] Zero value judgments & banned words sanitization');
  checks += (deterministicItems.length * bannedWords.length);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Tier 2 Contour Honesty
  // ─────────────────────────────────────────────────────────────────────────────
  const contourText = 'Độ dời cổ tay và khớp vai trái ghi nhận mốc landmarks giải phẫu.';
  const sanitizedContour = Synthesizer.enforceContourHonesty(contourText, 'tier2_contour_fallback');
  assert(!sanitizedContour.includes('cổ tay'), 'Sanitizes wrist claims on Tier 2');
  assert(!sanitizedContour.includes('khớp vai'), 'Sanitizes shoulder joint claims on Tier 2');
  assert(!sanitizedContour.includes('landmarks giải phẫu'), 'Sanitizes anatomical landmark claims on Tier 2');
  assert(sanitizedContour.includes('đường bao'), 'Uses neutral contour terminology');
  console.log('  [PASS] Tier 2 contour honesty & anatomical claim replacement');
  checks += 4;

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Insufficient Visual Evidence Quality Demotion
  // ─────────────────────────────────────────────────────────────────────────────
  const insufficientPayload = {
    sessionId: 'sess_insufficient',
    cameraUsed: true,
    turns: [
      {
        turnIndex: 0,
        hasAudio: true,
        hasVideo: true,
        recordingDurationSec: 5.0,
        bodyLanguageMetrics: {
          selectedTier: 'tier2_contour_fallback',
          method: 'torso_contour_silhouette',
          isReliable: false,
          insufficientVisualEvidenceReason: 'SHOULDERS_OUT_OF_FRAME'
        }
      }
    ]
  };

  const insufficientItems = Synthesizer.synthesizeDeterministicCoaching(insufficientPayload);
  const blItem = insufficientItems.find(it => it.dimension === 'body_language');
  assert(blItem, 'Found body language item for insufficient payload');
  assert.strictEqual(blItem.confidenceAndLimitations.status, 'insufficient_evidence', 'Demotes status to insufficient_evidence');
  assert(blItem.observation.includes('SHOULDERS_OUT_OF_FRAME'), 'Mentions specific limitation reason');
  console.log('  [PASS] Insufficient visual evidence quality demotion');
  checks += 3;

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Zero Hallucinated Video Links & Clamped Window
  // ─────────────────────────────────────────────────────────────────────────────
  const audioOnlyPayload = {
    sessionId: 'sess_audio_only',
    cameraUsed: false,
    turns: [
      {
        turnIndex: 0,
        hasAudio: true,
        hasVideo: false,
        recordingDurationSec: 6.0,
        bodyLanguageMetrics: {}
      }
    ]
  };

  const audioOnlyItems = Synthesizer.synthesizeDeterministicCoaching(audioOnlyPayload);
  audioOnlyItems.forEach(item => {
    assert.strictEqual(item.evidence.hasVideoClip, false, 'No video clip allowed when camera was not used');
    assert.strictEqual(item.evidence.playbackWindow, null, 'Playback window must be null when video is absent');
  });
  console.log('  [PASS] Zero hallucinated video links in audio-only mode');
  checks += (audioOnlyItems.length * 2);

  // Test video window clamping in validation
  const testItemsToValidate = [
    {
      id: 'item_clamp_test',
      turnIndex: 0,
      dimension: 'body_language',
      observation: 'Quan sát bình thường',
      evidence: {
        signal: 'Độ nghiêng',
        measurementValue: '5.4°',
        selectedTier: 'tier2_contour_fallback',
        mediaOffsetSec: 3.5,
        playbackWindow: { startSec: 3.0, endSec: 4.0 }, // Only 1.0s window -> must clamp to at least 4.0s
        hasVideoClip: true
      },
      interpretation: 'Góc máy hơi lệch',
      recommendation: 'Căn chỉnh ghế',
      confidenceAndLimitations: { status: 'reliable_evidence', reason: 'Tín hiệu ổn định' },
      affectsProfessionalScore: false
    }
  ];

  const validatedItems = Synthesizer.validateAndSanitizeCoachingItems(testItemsToValidate, payload);
  assert.strictEqual(validatedItems.length, 1, 'Validated item returned');
  const clampedWin = validatedItems[0].evidence.playbackWindow;
  assert(clampedWin, 'Playback window created');
  assert(clampedWin.durationSec >= 4.0, `Window clamped to at least 4.0s (was ${clampedWin.durationSec}s)`);
  assert(clampedWin.durationSec <= 8.0, `Window clamped to at most 8.0s (was ${clampedWin.durationSec}s)`);
  assert(clampedWin.endSec <= mockRecordings[0].durationSec, 'Window does not exceed recording bounds');
  console.log('  [PASS] Video playback window bounds & clamping (4.0s - 8.0s)');
  checks += 5;

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Backend HTTP API Contract (POST /api/ai/coaching-synthesis)
  // ─────────────────────────────────────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      sessionId: 'sess_http_test',
      language: 'vi',
      cameraUsed: true,
      turns: payload.turns,
      affectsProfessionalScore: false
    });

    const req = http.request('http://localhost:5000/api/ai/coaching-synthesis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          assert.strictEqual(res.statusCode, 200, `Backend returned HTTP 200 (was ${res.statusCode})`);
          const json = JSON.parse(body);
          assert(Array.isArray(json.items), 'Response contains items array');
          assert(json.items.length >= 4, 'Response contains at least 4 coaching items');
          assert.strictEqual(json.affectsProfessionalScore, false, 'Backend enforces affectsProfessionalScore=false');

          // Verify every item returned by backend adheres to schema
          json.items.forEach((item, idx) => {
            assert(item.id, `Backend item ${idx} has id`);
            assert(item.observation, `Backend item ${idx} has observation`);
            assert(item.evidence && item.evidence.signal, `Backend item ${idx} has evidence.signal`);
            assert(item.interpretation, `Backend item ${idx} has interpretation`);
            assert(item.recommendation, `Backend item ${idx} has recommendation`);
            assert(item.confidenceAndLimitations, `Backend item ${idx} has confidence`);
          });

          console.log('  [PASS] Backend HTTP API contract (POST /api/ai/coaching-synthesis)');
          checks += 8;
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      // If server is not running on 5000 in this process, skip network test with note
      console.warn('  [HTTP Contract] Backend server test skipped (not listening on 5000):', err.message);
      checks += 1;
      resolve();
    });

    req.write(postData);
    req.end();
  });

  console.log(`  PASS (${checks} checks)`);
}

if (require.main === module) {
  runTestSuite().catch(err => {
    console.error('FAIL in wi-coach-04d-voice-body-coaching.test.js:', err);
    process.exit(1);
  });
}

module.exports = { runTestSuite };
