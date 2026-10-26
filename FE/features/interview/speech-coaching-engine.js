/**
 * PREPMATE — SPEECH & PRESENTATION COACHING ENGINE (WI-COACH-AUDIO-01 STEP 3)
 *
 * Deterministic client-side analysis of candidate presentation delivery:
 *   - Filler words detection & excerpt quotes ("ừm", "à", "ờ", "kiểu như", "thực ra thì", etc.)
 *   - Immediate repetition & stutter detection (e.g. "chúng tôi chúng tôi")
 *   - Pacing & Words-Per-Minute (WPM) calculation based on verified audio duration
 *   - Response structure & conciseness heuristics (length, conclusion markers, personal agency)
 *   - Top 3 prioritized, non-duplicated improvement drills
 *
 * Reliability Principles:
 *   - Never claims to measure pitch, breathing, or volume if only text/duration exists.
 *   - Clearly separates measured metrics from qualitative advice.
 *   - Distinguishes technical vocabulary from accidental repetitions.
 */

(function () {
  "use strict";

  // Standard Vietnamese filler words and conversational crutches (Unicode aware)
  const FILLER_PATTERNS = [
    { pattern: /(?:^|[^\p{L}])(kiểu như)(?=[^\p{L}]|$)/giu, canonical: "kiểu như" },
    { pattern: /(?:^|[^\p{L}])(thực ra thì)(?=[^\p{L}]|$)/giu, canonical: "thực ra thì" },
    { pattern: /(?:^|[^\p{L}])(nói chung là)(?=[^\p{L}]|$)/giu, canonical: "nói chung là" },
    { pattern: /(?:^|[^\p{L}])(đại loại là)(?=[^\p{L}]|$)/giu, canonical: "đại loại là" },
    { pattern: /(?:^|[^\p{L}])(cơ bản là)(?=[^\p{L}]|$)/giu, canonical: "cơ bản là" },
    { pattern: /(?:^|[^\p{L}])(thì là)(?=[^\p{L}]|$)/giu, canonical: "thì là" },
    { pattern: /(?:^|[^\p{L}])(ừm+)(?=[^\p{L}]|$)/giu, canonical: "ừm" },
    { pattern: /(?:^|[^\p{L}])(àh?)(?=[^\p{L}]|$)/giu, canonical: "à" },
    { pattern: /(?:^|[^\p{L}])(ờ+)(?=[^\p{L}]|$)/giu, canonical: "ờ" },
    { pattern: /(?:^|[^\p{L}])(ơ+)(?=[^\p{L}]|$)/giu, canonical: "ơ" }
  ];

  // Common technical / grammatical terms exempted from repetition flagging
  const EXEMPT_REPETITION_TERMS = new Set([
    "c#", ".net", "sql", "api", "rest", "db", "io", "gc", "ram", "cpu", "star",
    "ai", "ui", "ux", "pr", "ci", "cd", "p99", "k8s", "docker", "kafka", "aws", "gcp", "azure"
  ]);

  // Standard Vietnamese stopwords for lexical content analysis
  const VI_STOPWORDS = new Set([
    "và", "là", "thì", "mà", "ở", "với", "cho", "của", "các", "những", "được", "bị", "trong",
    "đã", "đang", "sẽ", "để", "do", "bởi", "vì", "nên", "nếu", "tuy", "nhưng", "rằng", "một",
    "này", "đó", "kia", "ra", "vào", "lại", "rất", "quá", "lắm", "như", "theo", "tại", "về",
    "khi", "tôi", "chúng", "bạn", "họ", "mình", "có", "không", "cũng", "đều", "phải", "từ"
  ]);

  // Conclusion markers
  const CONCLUSION_MARKERS = [
    "tóm lại", "kết quả là", "nhờ vậy", "do đó", "vì thế", "sau cùng", "giúp cho", "kết luận"
  ];

  /**
   * Deterministic client-side Voice Activity Detection on PCM Float32Array
   */
  function analyzePcmVoiceActivity(channelData, sampleRate = 16000) {
    if (!channelData || channelData.length === 0) {
      return {
        speechActiveMs: 0,
        silenceMs: 0,
        totalDurationMs: 0,
        speechRatio: 0,
        isReliable: false,
        basis: "insufficient_data",
        method: "empty_buffer"
      };
    }

    const totalSamples = channelData.length;
    const totalDurationMs = Math.round((totalSamples / sampleRate) * 1000);

    if (totalDurationMs < 800) {
      return {
        speechActiveMs: 0,
        silenceMs: totalDurationMs,
        totalDurationMs,
        speechRatio: 0,
        isReliable: false,
        basis: "insufficient_data",
        method: "duration_too_short"
      };
    }

    const frameSamples = Math.floor(sampleRate * 0.025);
    const hopSamples = Math.floor(sampleRate * 0.010);

    const frameEnergies = [];
    const frameZcrs = [];

    for (let offset = 0; offset + frameSamples <= totalSamples; offset += hopSamples) {
      let sumSq = 0;
      let zcrCount = 0;
      let prevSign = channelData[offset] >= 0;

      for (let i = 0; i < frameSamples; i++) {
        const val = channelData[offset + i];
        sumSq += val * val;
        const sign = val >= 0;
        if (sign !== prevSign) {
          zcrCount++;
          prevSign = sign;
        }
      }

      const rms = Math.sqrt(sumSq / frameSamples);
      const zcr = zcrCount / frameSamples;
      frameEnergies.push(rms);
      frameZcrs.push(zcr);
    }

    const totalFrames = frameEnergies.length;
    if (totalFrames === 0) {
      return {
        speechActiveMs: 0,
        silenceMs: totalDurationMs,
        totalDurationMs,
        speechRatio: 0,
        isReliable: false,
        basis: "insufficient_data",
        method: "zero_frames"
      };
    }

    const sortedEnergies = [...frameEnergies].sort((a, b) => a - b);
    const noiseFloor = sortedEnergies[Math.floor(sortedEnergies.length * 0.15)] || 0;
    const maxEnergy = sortedEnergies[sortedEnergies.length - 1] || 0;

    // Adaptive threshold for human speech with sensitivity to soft/quiet speech & fillers
    const minSpeechRms = 0.008;
    const dynamicThreshold = Math.min(
      Math.max(minSpeechRms, maxEnergy * 0.5),
      Math.max(minSpeechRms, noiseFloor * 2.2, (maxEnergy + noiseFloor) * 0.12)
    );
    const releaseThreshold = Math.max(minSpeechRms * 0.65, Math.min(dynamicThreshold * 0.7, noiseFloor * 1.35));

    // Raw frame classification with hysteresis
    const rawActive = new Array(totalFrames).fill(false);
    let inSpeech = false;
    for (let i = 0; i < totalFrames; i++) {
      const rms = frameEnergies[i];
      const zcr = frameZcrs[i];
      if (!inSpeech) {
        if (rms >= dynamicThreshold && zcr >= 0.015 && zcr <= 0.48) {
          inSpeech = true;
          rawActive[i] = true;
        }
      } else {
        if (rms >= releaseThreshold && zcr <= 0.52) {
          rawActive[i] = true;
        } else {
          inSpeech = false;
        }
      }
    }

    // Smoothing 1: Remove isolated false-positive spikes (clicks/pops <= 20ms)
    for (let i = 1; i < totalFrames - 1; i++) {
      if (rawActive[i] && !rawActive[i - 1] && !rawActive[i + 1]) {
        rawActive[i] = false;
      }
    }

    // Smoothing 2: Hangover (bridge short inter-syllable gaps up to 150ms = 15 frames)
    const hangoverFrames = 15;
    const activeSmoothed = new Array(totalFrames).fill(false);
    let hangoverCounter = 0;

    for (let i = 0; i < totalFrames; i++) {
      if (rawActive[i]) {
        activeSmoothed[i] = true;
        hangoverCounter = hangoverFrames;
      } else if (hangoverCounter > 0) {
        activeSmoothed[i] = true;
        hangoverCounter--;
      }
    }

    const activeCount = activeSmoothed.filter(Boolean).length;
    const frameDurationMs = (hopSamples / sampleRate) * 1000;
    let speechActiveMs = Math.round(activeCount * frameDurationMs);
    if (speechActiveMs > totalDurationMs) speechActiveMs = totalDurationMs;
    const silenceMs = Math.max(0, totalDurationMs - speechActiveMs);
    const speechRatio = totalDurationMs > 0 ? Number((speechActiveMs / totalDurationMs).toFixed(2)) : 0;

    // Segment extraction: Group raw contiguous active regions, apply pre/post-roll, and bridge gaps
    const rawIntervals = [];
    let startIdx = -1;
    for (let i = 0; i < totalFrames; i++) {
      if (activeSmoothed[i]) {
        if (startIdx < 0) startIdx = i;
      } else {
        if (startIdx >= 0) {
          rawIntervals.push({ startFrame: startIdx, endFrame: i });
          startIdx = -1;
        }
      }
    }
    if (startIdx >= 0) {
      rawIntervals.push({ startFrame: startIdx, endFrame: totalFrames });
    }

    // Pre-roll (200ms = 20 frames) and post-roll (250ms = 25 frames)
    const preRollFrames = 20;
    const postRollFrames = 25;
    const minBridgingGapFrames = 35; // 350ms gap bridging for inter-syllable & short pauses

    const expanded = rawIntervals.map(it => ({
      startFrame: Math.max(0, it.startFrame - preRollFrames),
      endFrame: Math.min(totalFrames, it.endFrame + postRollFrames)
    }));

    const merged = [];
    for (const it of expanded) {
      if (merged.length === 0) {
        merged.push(it);
      } else {
        const prev = merged[merged.length - 1];
        if (it.startFrame <= prev.endFrame + minBridgingGapFrames) {
          prev.endFrame = Math.max(prev.endFrame, it.endFrame);
        } else {
          merged.push(it);
        }
      }
    }

    const speechSegments = [];
    let segTotalDuration = 0;
    for (const it of merged) {
      const startMs = Math.round((it.startFrame * hopSamples / sampleRate) * 1000);
      const endMs = Math.min(totalDurationMs, Math.round(((it.endFrame * hopSamples + frameSamples) / sampleRate) * 1000));
      const durationMs = Math.max(0, endMs - startMs);
      if (durationMs >= 120) {
        speechSegments.push({
          startMs,
          endMs,
          durationMs,
          startSample: Math.min(totalSamples, Math.floor(startMs * sampleRate / 1000)),
          endSample: Math.min(totalSamples, Math.floor(endMs * sampleRate / 1000))
        });
        segTotalDuration += durationMs;
      }
    }

    const hasSpeech = speechSegments.length > 0 && speechActiveMs >= 200 && maxEnergy >= minSpeechRms;
    const isPureSilence = !hasSpeech;

    const hasDynamicRange = (maxEnergy / Math.max(0.001, noiseFloor)) >= 2.2;
    const isSteadyNoise = speechRatio >= 0.98 && (maxEnergy / Math.max(0.001, noiseFloor)) < 2.5;
    const isReliable = Boolean(
      totalDurationMs >= 2000 &&
      speechActiveMs >= 1000 &&
      maxEnergy >= minSpeechRms &&
      hasDynamicRange &&
      !isSteadyNoise &&
      speechRatio >= 0.08
    );

    return {
      speechActiveMs: hasSpeech ? speechActiveMs : 0,
      silenceMs: hasSpeech ? silenceMs : totalDurationMs,
      totalDurationMs,
      speechRatio: hasSpeech ? speechRatio : 0,
      noiseFloor: Number(noiseFloor.toFixed(4)),
      maxEnergy: Number(maxEnergy.toFixed(4)),
      isReliable,
      hasSpeech,
      isPureSilence,
      speechSegments: hasSpeech ? speechSegments : [],
      filteredPlaybackDurationMs: hasSpeech ? segTotalDuration : 0,
      basis: isReliable ? "speech_active" : "turn_elapsed",
      method: "energy_zcr_vad"
    };
  }

  function extractSpeechSegments(channelData, sampleRate = 16000) {
    const vad = analyzePcmVoiceActivity(channelData, sampleRate);
    return {
      speechSegments: vad.speechSegments || [],
      speechActiveMs: vad.speechActiveMs || 0,
      silenceMs: vad.silenceMs || 0,
      totalDurationMs: vad.totalDurationMs || 0,
      hasSpeech: Boolean(vad.hasSpeech),
      isPureSilence: Boolean(vad.isPureSilence)
    };
  }

  /**
   * Cleans and tokenizes text into words
   */
  function tokenizeWords(text) {
    if (!text || typeof text !== "string") return [];
    return text.trim().split(/\s+/).filter(Boolean);
  }

  /**
   * Extracts sentences containing a specific match
   */
  function extractExcerpts(text, regex, maxExcerpts = 2) {
    if (!text) return [];
    const sentences = text.split(/(?<=[.?!;:\n])\s+/);
    const results = [];

    for (const s of sentences) {
      if (regex.test(s)) {
        results.push(s.trim());
        if (results.length >= maxExcerpts) break;
      }
    }
    return results;
  }

  /**
   * Analyzes filler words in a single answer
   */
  function analyzeFillerWords(text) {
    if (!text) return { totalCount: 0, breakdown: [] };

    let total = 0;
    const breakdown = [];

    for (const item of FILLER_PATTERNS) {
      const matches = text.match(item.pattern);
      if (matches && matches.length > 0) {
        total += matches.length;
        const excerpts = extractExcerpts(text, item.pattern, 2);
        breakdown.push({
          word: item.canonical,
          count: matches.length,
          excerpts
        });
      }
    }

    return { totalCount: total, breakdown };
  }

  /**
   * Extracts substantive content keywords (length >= 2, non-stopword, non-numeric)
   */
  function extractContentKeywords(text) {
    if (!text) return [];
    const words = text
      .toLowerCase()
      .replace(/[.,!?;:()"'“”‘’\[\]{}]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return words.filter((w) => w.length >= 2 && !VI_STOPWORDS.has(w) && !/^\d+$/.test(w));
  }

  /**
   * Detects non-consecutive multi-word phrases repeated across the answer
   */
  function findLongestRepeatedPhrases(text) {
    if (!text) return [];
    const words = text
      .toLowerCase()
      .replace(/[.,!?;:()"'“”‘’\[\]{}]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length < 6) return [];

    const minLen = 3;
    const maxLen = Math.min(10, Math.floor(words.length / 2));
    const counts = new Map();

    for (let len = maxLen; len >= minLen; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const phraseTokens = words.slice(i, i + len);
        const contentTokens = phraseTokens.filter((t) => !VI_STOPWORDS.has(t));
        if (contentTokens.length < 2) continue;

        const phrase = phraseTokens.join(" ");
        if (phrase.length < 10) continue;
        counts.set(phrase, (counts.get(phrase) || 0) + 1);
      }
    }

    const candidates = [];
    for (const [phrase, count] of counts.entries()) {
      if (count >= 2) {
        candidates.push({ phrase, count, len: phrase.split(" ").length });
      }
    }

    candidates.sort((a, b) => b.len - a.len);

    const results = [];
    for (const c of candidates) {
      const isContained = results.some((r) => r.phrase.includes(c.phrase) && r.count >= c.count);
      if (!isContained) {
        results.push(c);
      }
    }

    return results.map((r) => ({ phrase: r.phrase, count: r.count }));
  }

  /**
   * Lexical Content Overlap Heuristic: flags distinct sentences sharing high % of core content keywords
   * NOTE: This is a token/n-gram keyword overlap heuristic, NOT a semantic AI model.
   */
  function analyzeIdeaOverlaps(text) {
    if (!text) return [];
    const rawSentences = text
      .split(/(?<=[.?!;\n])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 15);

    if (rawSentences.length < 2) return [];

    const sentenceData = rawSentences
      .map((s) => {
        const keywords = extractContentKeywords(s);
        return {
          raw: s,
          keywords: new Set(keywords),
          keywordList: keywords
        };
      })
      .filter((sd) => sd.keywords.size >= 4);

    const overlaps = [];

    for (let i = 0; i < sentenceData.length; i++) {
      for (let j = i + 1; j < sentenceData.length; j++) {
        const s1 = sentenceData[i];
        const s2 = sentenceData[j];

        if (s1.raw.toLowerCase() === s2.raw.toLowerCase()) continue;

        const set1 = s1.keywords;
        const set2 = s2.keywords;

        const intersection = new Set([...set1].filter((x) => set2.has(x)));
        const minSize = Math.min(set1.size, set2.size);
        const overlapRatio = minSize > 0 ? intersection.size / minSize : 0;
        const union = new Set([...set1, ...set2]);
        const jaccard = union.size > 0 ? intersection.size / union.size : 0;

        if (intersection.size >= 4 && (overlapRatio >= 0.65 || jaccard >= 0.50)) {
          overlaps.push({
            sentence1: s1.raw,
            sentence2: s2.raw,
            sharedKeywords: Array.from(intersection),
            overlapRatio: Number(overlapRatio.toFixed(2)),
            jaccardRatio: Number(jaccard.toFixed(2)),
            method: "lexical_content_overlap_heuristic",
            explanation: "Hai câu chia sẻ phần lớn các từ khoá nội dung cốt lõi, có dấu hiệu lặp lại cùng một luận điểm."
          });
        }
      }
    }

    return overlaps;
  }

  /**
   * Analyzes repeated words, repeated phrases, and content overlap in an answer
   */
  function analyzeRepetitions(text) {
    if (!text) return { totalCount: 0, items: [], phraseRepetitions: [], ideaOverlaps: [] };

    const items = [];
    const words = text.replace(/[.,!?;:()]/g, " ").trim().split(/\s+/).filter(Boolean);

    // 1. Two-word phrase immediate repetition: "chúng tôi chúng tôi"
    for (let i = 0; i < words.length - 3; i++) {
      const w1 = words[i].toLowerCase();
      const w2 = words[i + 1].toLowerCase();
      const w3 = words[i + 2].toLowerCase();
      const w4 = words[i + 3].toLowerCase();

      if (w1 === w3 && w2 === w4) {
        const phrase = `${words[i]} ${words[i + 1]}`;
        if (!EXEMPT_REPETITION_TERMS.has(w1) && !EXEMPT_REPETITION_TERMS.has(w2)) {
          items.push({
            phrase: `${phrase} ${phrase}`,
            word: phrase,
            type: "phrase"
          });
          i += 2; // skip past repeated phrase
        }
      }
    }

    // 2. Single word immediate repetition: "và và", "tôi tôi"
    for (let i = 0; i < words.length - 1; i++) {
      const w1 = words[i].toLowerCase();
      const w2 = words[i + 1].toLowerCase();

      if (w1 === w2 && w1.length >= 2 && !EXEMPT_REPETITION_TERMS.has(w1)) {
        const alreadyInPhrase = items.some((it) => it.word.toLowerCase().includes(w1));
        if (!alreadyInPhrase) {
          items.push({
            phrase: `${words[i]} ${words[i + 1]}`,
            word: words[i],
            type: "single"
          });
          i += 1;
        }
      }
    }

    // 3. Multi-word phrase non-consecutive repetitions across answer
    const phraseRepetitions = findLongestRepeatedPhrases(text);

    // 4. Content keyword overlap across distinct sentences
    const ideaOverlaps = analyzeIdeaOverlaps(text);

    return {
      totalCount: items.length + phraseRepetitions.length + ideaOverlaps.length,
      immediateCount: items.length,
      phraseCount: phraseRepetitions.length,
      ideaOverlapCount: ideaOverlaps.length,
      items,
      phraseRepetitions,
      ideaOverlaps
    };
  }

  /**
   * Analyzes pacing (WPM) based on word count, duration, and optional speech-active time
   * @param {number} wordCount
   * @param {number} durationMs - total elapsed turn duration
   * @param {number|null} speechActiveMs - optional VAD-verified speech-active time
   * @param {object|null} vadMeta - optional VAD analysis metadata
   */
  function analyzePacing(wordCount, durationMs, speechActiveMs = null, vadMeta = null) {
    const hasReliableVad = Boolean(
      speechActiveMs &&
      speechActiveMs >= 1000 &&
      (!vadMeta || vadMeta.isReliable !== false)
    );

    const effectiveDurationMs = hasReliableVad ? speechActiveMs : durationMs;
    const basis = hasReliableVad
      ? "speech_active"
      : (durationMs && durationMs >= 2000 ? "turn_elapsed" : "insufficient_data");

    if (!effectiveDurationMs || effectiveDurationMs < 2000 || !wordCount || wordCount < 4) {
      return {
        wpm: null,
        activeWpm: null,
        turnWpm: null,
        status: "insufficient_data",
        basis: "insufficient_data",
        feedback: "Chưa có đủ thời lượng ghi âm tin cậy để đo tốc độ nói (WPM).",
        speechActiveMs: speechActiveMs || 0,
        totalDurationMs: durationMs || 0,
        silenceMs: vadMeta?.silenceMs || (durationMs ? Math.max(0, durationMs - (speechActiveMs || 0)) : 0)
      };
    }

    const durationMin = effectiveDurationMs / 60000;
    const wpm = Math.round(wordCount / durationMin);
    const turnWpm = durationMs && durationMs >= 2000 ? Math.round(wordCount / (durationMs / 60000)) : null;

    let status = "moderate";
    let feedback = "";

    if (wpm < 95) {
      status = "slow";
      feedback = hasReliableVad
        ? `Tốc độ phát âm khá chậm (${wpm} từ/phút, đo trên ${Math.round(speechActiveMs / 1000)}s phát âm thực tế). Cần tăng sự lưu loát khi diễn đạt.`
        : `Tốc độ ước tính theo toàn bộ thời gian lượt (${Math.round(durationMs / 1000)}s): ${wpm} từ/phút (bao gồm cả khoảng dừng suy nghĩ, chưa tách riêng thời gian phát âm).`;
    } else if (wpm > 175) {
      status = "fast";
      feedback = hasReliableVad
        ? `Tốc độ phát âm khá nhanh (${wpm} từ/phút, đo trên ${Math.round(speechActiveMs / 1000)}s phát âm thực tế). Nên chủ động ngắt nhịp thở sau các luận điểm chính.`
        : `Tốc độ ước tính theo toàn bộ thời gian lượt (${Math.round(durationMs / 1000)}s): ${wpm} từ/phút (khá nhanh).`;
    } else {
      status = "moderate";
      feedback = hasReliableVad
        ? `Tốc độ nói đạt ${wpm} từ/phút (chuẩn mực, đo trên ${Math.round(speechActiveMs / 1000)}s phát âm thực tế, đã trừ khoảng lặng).`
        : `Tốc độ nói ước tính đạt ${wpm} từ/phút theo toàn bộ lượt (${Math.round(durationMs / 1000)}s).`;
    }

    return {
      wpm,
      activeWpm: hasReliableVad ? wpm : null,
      turnWpm,
      status,
      basis,
      speechActiveMs: speechActiveMs || 0,
      totalDurationMs: durationMs || 0,
      silenceMs: vadMeta?.silenceMs || (durationMs ? Math.max(0, durationMs - (speechActiveMs || 0)) : 0),
      feedback
    };
  }

  /**
   * Evaluates response structure & conciseness
   */
  function analyzeStructure(text) {
    if (!text) {
      return {
        wordCount: 0,
        conciseness: "empty",
        hasConclusion: false,
        feedback: "Không có nội dung trả lời."
      };
    }

    const words = tokenizeWords(text);
    const wordCount = words.length;
    const lower = text.toLowerCase();

    const hasConclusion = CONCLUSION_MARKERS.some((m) => lower.includes(m));

    let conciseness = "balanced";
    let feedback = "Độ dài câu trả lời cân đối, vừa đủ truyền tải bối cảnh và giải pháp.";

    if (wordCount < 18) {
      conciseness = "too_short";
      feedback = "Câu trả lời quá ngắn, chưa nêu rõ nguyên nhân, số liệu hoặc hành động thực tế.";
    } else if (wordCount > 220) {
      conciseness = "wordy";
      feedback = "Câu trả lời tương đối dài dòng. Nên tóm lược theo cấu trúc STAR để tránh loãng thông tin.";
    }

    return {
      wordCount,
      conciseness,
      hasConclusion,
      feedback
    };
  }

  /**
   * Analyzes an entire interview session
   * @param {Array} answers - [{ question, answer }]
   * @param {Array} recordings - [{ turnIndex, durationMs, audioBlob }]
   */
  function analyzeSessionSpeechCoaching(answers = [], recordings = []) {
    const validAnswers = (answers || [])
      .map((a) => ({
        question: a?.question || a?.Question || "",
        answer: (typeof a?.answer === "string" ? a.answer : (typeof a?.Answer === "string" ? a.Answer : "")).trim()
      }))
      .filter((a) => a.answer.length > 0);

    const recordingMap = new Map();
    (recordings || []).forEach((r) => {
      if (r && typeof r.turnIndex === "number") {
        recordingMap.set(r.turnIndex, r);
      }
    });

    let totalWords = 0;
    let totalDurationMs = 0;
    let totalSpeechActiveMs = 0;
    let reliableActiveTurnCount = 0;
    let totalFillers = 0;
    let totalRepetitions = 0;
    let totalPhraseRepetitions = 0;
    let totalIdeaOverlaps = 0;
    const fillerWordFrequency = {};

    const turnAnalyses = [];

    validAnswers.forEach((item, index) => {
      const qText = item.question || "";
      const isIntro = qText === "Giới thiệu bản thân";
      const turnIdx = isIntro ? 0 : index;

      const rec = recordingMap.get(turnIdx);
      const durationMs = rec?.durationMs || 0;
      totalDurationMs += durationMs;

      const words = tokenizeWords(item.answer);
      totalWords += words.length;

      const fillerAnalysis = analyzeFillerWords(item.answer);
      totalFillers += fillerAnalysis.totalCount;

      fillerAnalysis.breakdown.forEach((f) => {
        fillerWordFrequency[f.word] = (fillerWordFrequency[f.word] || 0) + f.count;
      });

      const repetitionAnalysis = analyzeRepetitions(item.answer);
      totalRepetitions += repetitionAnalysis.totalCount;
      totalPhraseRepetitions += (repetitionAnalysis.phraseCount || 0);
      totalIdeaOverlaps += (repetitionAnalysis.ideaOverlapCount || 0);

      const speechActiveMs = (typeof rec?.speechActiveMs === "number" && rec.speechActiveMs > 0) ? rec.speechActiveMs : null;
      const vadMeta = rec ? { isReliable: rec.vadReliable !== false, silenceMs: rec.silenceMs, speechRatio: rec.speechRatio } : null;
      const pacingAnalysis = analyzePacing(words.length, durationMs, speechActiveMs, vadMeta);

      if (pacingAnalysis.basis === "speech_active" && pacingAnalysis.speechActiveMs > 0) {
        totalSpeechActiveMs += pacingAnalysis.speechActiveMs;
        reliableActiveTurnCount++;
      }

      const structureAnalysis = analyzeStructure(item.answer);

      turnAnalyses.push({
        turnIndex: turnIdx,
        question: qText,
        answer: item.answer,
        durationMs,
        speechActiveMs: pacingAnalysis.speechActiveMs,
        silenceMs: pacingAnalysis.silenceMs,
        wordCount: words.length,
        wpm: pacingAnalysis.wpm,
        activeWpm: pacingAnalysis.activeWpm,
        turnWpm: pacingAnalysis.turnWpm,
        pacingBasis: pacingAnalysis.basis,
        pacingStatus: pacingAnalysis.status,
        pacingFeedback: pacingAnalysis.feedback,
        fillerCount: fillerAnalysis.totalCount,
        fillers: fillerAnalysis.breakdown,
        repetitionCount: repetitionAnalysis.totalCount,
        immediateRepetitions: repetitionAnalysis.items,
        phraseRepetitions: repetitionAnalysis.phraseRepetitions || [],
        ideaOverlaps: repetitionAnalysis.ideaOverlaps || [],
        repetitions: repetitionAnalysis.items,
        conciseness: structureAnalysis.conciseness,
        hasConclusion: structureAnalysis.hasConclusion,
        structureFeedback: structureAnalysis.feedback,
        hasAudio: Boolean(rec && rec.audioBlob && (rec.hasSpeech !== false && rec.speechActiveMs !== 0)),
        hasOriginalRecording: Boolean(rec && rec.audioBlob),
        hasSpeech: Boolean(rec && rec.audioBlob && (rec.hasSpeech !== false && rec.speechActiveMs !== 0)),
        isPureSilence: Boolean(rec && rec.audioBlob && (rec.isPureSilence === true || rec.hasSpeech === false || rec.speechActiveMs === 0)),
        speechSegments: rec?.speechSegments || []
      });
    });

    // Summary statistics
    const durationMinutes = totalDurationMs > 0 ? (totalDurationMs / 60000) : 0;
    const speechActiveMinutes = totalSpeechActiveMs > 0 ? (totalSpeechActiveMs / 60000) : 0;

    const averageTurnWpm = durationMinutes > 0.05 && totalWords > 6 ? Math.round(totalWords / durationMinutes) : null;
    const averageActiveWpm = speechActiveMinutes > 0.05 && totalWords > 6 ? Math.round(totalWords / speechActiveMinutes) : null;

    // Prefer active WPM if at least one turn had reliable speech active time
    const averageWpm = averageActiveWpm || averageTurnWpm;
    const pacingBasis = reliableActiveTurnCount > 0 ? "speech_active" : (durationMinutes > 0 ? "turn_elapsed" : "insufficient_data");
    const fillerDensityPerMin = durationMinutes > 0.1 ? Number((totalFillers / durationMinutes).toFixed(1)) : null;

    const sortedFillers = Object.entries(fillerWordFrequency)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);

    // Formulate Top 3 Prioritized, Non-Repetitive Improvements
    const priorityImprovements = [];

    if (totalFillers >= 3) {
      const topWord = sortedFillers[0]?.word || "từ đệm";
      priorityImprovements.push({
        area: "Giảm từ đệm khi tư duy",
        why: `Bạn đã sử dụng ${totalFillers} từ đệm (đặc biệt là '${topWord}'). Điều này có thể làm giảm cảm giác quyết đoán của câu trả lời.`,
        drill: `Tập dừng khoảng lặng 1-2 giây thay vì phát âm '${topWord}' khi bạn cần thời gian suy nghĩ câu trả lời tiếp theo.`,
        selfCheck: "Trong buổi luyện tập tới, hãy chú ý nghe lại các lượt trả lời và đặt mục tiêu giảm số lượng từ đệm xuống dưới 2 lần."
      });
    }

    if (totalIdeaOverlaps >= 1) {
      priorityImprovements.push({
        area: "Tránh lặp lại cùng một luận điểm (Dấu hiệu lặp ý)",
        why: `Phát hiện ${totalIdeaOverlaps} vị trí câu chia sẻ phần lớn từ khoá nội dung cốt lõi. Việc lặp lại cùng một luận điểm làm giảm độ súc tích.`,
        drill: "Mỗi câu chỉ nên chuyển tải một thông điệp mới: Câu 1 nêu giải pháp, Câu 2 nêu số liệu hoặc kết quả thay vì diễn giải lại giải pháp.",
        selfCheck: "Sau khi trả lời, rà soát lại xem có câu nào lặp lại nội dung đã nói ở câu trước đó hay không."
      });
    } else if (totalPhraseRepetitions >= 2) {
      priorityImprovements.push({
        area: "Đa dạng hoá cách diễn đạt cụm từ",
        why: `Có ${totalPhraseRepetitions} cụm từ được lặp lại nguyên văn nhiều lần trong cùng câu trả lời.`,
        drill: "Sử dụng đại từ thay thế hoặc tóm lược ngắn thay vì lặp lại nguyên văn cả cụm tên gọi kỹ thuật.",
        selfCheck: "Mục tiêu không lặp lại nguyên văn một cụm từ dài quá 2 lần trong cùng một câu trả lời."
      });
    }

    if (averageWpm && (averageWpm < 100 || averageWpm > 170)) {
      const isFast = averageWpm > 170;
      priorityImprovements.push({
        area: isFast ? "Kiểm soát nhịp độ nói vừa phải" : "Tăng cường sự lưu loát khi trình bày",
        why: isFast
          ? `Tốc độ nói trung bình đạt ${averageWpm} từ/phút (khá nhanh), dễ khiến phỏng vấn viên không kịp ghi chép các luận điểm quan trọng.`
          : `Tốc độ nói trung bình là ${averageWpm} từ/phút, có nhiều khoảng ngập ngừng khiến buổi đối thoại chậm nhịp.`,
        drill: isFast
          ? "Sau mỗi luận điểm kỹ thuật, hãy ngắt nhịp thở nhẹ một nhịp trước khi chuyển sang phần tiếp theo."
          : "Trước khi bắt đầu nói, dành 5 giây xác định 2 ý chính sẽ nói để tránh ngập ngừng giữa chừng.",
        selfCheck: "Mục tiêu duy trì dải tốc độ tối ưu từ 110 - 150 từ/phút trong toàn bộ buổi phỏng vấn."
      });
    }

    const shortAnswers = turnAnalyses.filter((t) => t.conciseness === "too_short");
    const wordyAnswers = turnAnalyses.filter((t) => t.conciseness === "wordy");

    if (priorityImprovements.length < 3 && wordyAnswers.length >= 1) {
      priorityImprovements.push({
        area: "Rút gọn và tập trung vào trọng tâm",
        why: "Có câu trả lời khá dài dòng vượt quá 220 từ, dễ làm loãng thông điệp kỹ thuật cốt lõi.",
        drill: "Áp dụng công thức 3 câu: Câu 1 nêu giải pháp trực tiếp, Câu 2 nêu số liệu/công nghệ áp dụng, Câu 3 nêu bài học hoặc kết quả.",
        selfCheck: "Kiểm tra xem câu trả lời có thể trình bày hoàn tất trong vòng dưới 90 giây hay không."
      });
    } else if (priorityImprovements.length < 3 && shortAnswers.length >= 2) {
      priorityImprovements.push({
        area: "Bổ sung bối cảnh và dẫn chứng cụ thể",
        why: "Một số câu trả lời quá ngắn dưới 18 từ, chưa làm nổi bật được năng lực và đóng góp cá nhân.",
        drill: "Luôn kèm theo một bài toán thực tế bạn đã giải quyết khi trả lời các câu hỏi tình huống hoặc nguyên lý.",
        selfCheck: "Mỗi câu trả lời chuyên môn nên có ít nhất một dẫn chứng công nghệ cụ thể."
      });
    }

    // Fallback if candidate spoke cleanly
    if (priorityImprovements.length === 0) {
      priorityImprovements.push({
        area: "Duy trì phong độ và độ gãy gọn",
        why: "Cách phát âm, tốc độ và từ vựng của bạn rất chuẩn mực và lưu loát.",
        drill: "Tiếp tục thực hành các câu hỏi chuyên sâu với độ khó cao hơn để nâng cao phản xạ tự nhiên.",
        selfCheck: "Giữ vững phong thái tự tin và nhịp điệu hiện tại."
      });
    }

    return {
      summary: {
        totalWords,
        totalDurationMs,
        durationMinutes: Number(durationMinutes.toFixed(1)),
        totalSpeechActiveMs,
        speechActiveMinutes: Number(speechActiveMinutes.toFixed(1)),
        pacingBasis,
        averageWpm,
        averageActiveWpm,
        averageTurnWpm,
        totalFillers,
        fillerDensityPerMin,
        totalRepetitions,
        totalPhraseRepetitions,
        totalIdeaOverlaps,
        mostFrequentFillers: sortedFillers.slice(0, 3)
      },
      turns: turnAnalyses,
      priorityImprovements: priorityImprovements.slice(0, 3)
    };
  }

  const SpeechCoachingEngine = {
    analyzeFillerWords,
    analyzeRepetitions,
    findLongestRepeatedPhrases,
    analyzeIdeaOverlaps,
    analyzePcmVoiceActivity,
    extractSpeechSegments,
    analyzePacing,
    analyzeStructure,
    analyzeSessionSpeechCoaching
  };

  if (typeof window !== "undefined") {
    window.SpeechCoachingEngine = SpeechCoachingEngine;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = SpeechCoachingEngine;
  }
})();
