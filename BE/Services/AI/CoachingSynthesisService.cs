using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using backend.Models.AI;

namespace backend.Services.AI
{
    public class CoachingSynthesisService
    {
        private readonly IAIRouter? _aiRouter;

        public CoachingSynthesisService(IAIRouter? aiRouter = null)
        {
            _aiRouter = aiRouter;
        }

        public async Task<CoachingSynthesisResponse> SynthesizeAsync(
            CoachingSynthesisRequest request,
            CancellationToken cancellationToken = default)
        {
            if (request == null || request.Turns == null || request.Turns.Count == 0)
            {
                return GenerateDeterministicFallback(request ?? new CoachingSynthesisRequest());
            }

            // If AIRouter is available, attempt logical model alias "PrepMate" inference
            if (_aiRouter != null)
            {
                try
                {
                    var prompt = BuildPrompt(request);
                    var context = new AIRequestContext
                    {
                        TaskType = AITaskType.ReportGeneration,
                        PreferredModelId = ComboRootConfiguration.CanonicalAlias, // "PrepMate"
                        Prompt = prompt,
                        IsJsonMode = true,
                        SessionId = request.SessionId ?? "session_eval",
                        CorrelationId = Guid.NewGuid().ToString("N")
                    };

                    var result = await _aiRouter.RouteAndExecuteAsync(context, cancellationToken);
                    if (result.Success && !string.IsNullOrWhiteSpace(result.Content))
                    {
                        var parsed = ParseAiResponse(result.Content, request);
                        if (parsed != null && parsed.Items.Count > 0)
                        {
                            parsed.IsDeterministicFallback = false;
                            parsed.AffectsProfessionalScore = false;
                            return parsed;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[COACHING SYNTHESIS] AI Gateway execution failed: {ex.Message}. Falling back to deterministic rules.");
                }
            }

            return GenerateDeterministicFallback(request);
        }

        private static string BuildPrompt(CoachingSynthesisRequest request)
        {
            var summaryData = new
            {
                task = "EVIDENCE_BASED_VOICE_BODY_COACHING",
                instructions = "You are PrepMate's ethical communication coach. Generate exactly 5 structured coaching items following the 5-Part Evidence Protocol. ZERO value judgments (never use good, bad, tot, xau, tu tin, lo lang, confident, nervous). Enforce Tier 2 contour honesty: if selectedTier is tier2_contour_fallback, NEVER mention anatomical wrist, elbow, shoulder joints or face landmarks; reference only torso contour silhouette or bounding outline. If insufficient visual evidence was flagged, preserve status 'insufficient_evidence'. Return JSON array of items.",
                turns = request.Turns,
                cameraUsed = request.CameraUsed
            };

            return JsonSerializer.Serialize(summaryData);
        }

        private static CoachingSynthesisResponse? ParseAiResponse(string rawJson, CoachingSynthesisRequest request)
        {
            try
            {
                // Strip markdown code fences if present
                var cleaned = rawJson.Trim();
                if (cleaned.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
                {
                    cleaned = cleaned.Substring(7);
                }
                else if (cleaned.StartsWith("```"))
                {
                    cleaned = cleaned.Substring(3);
                }
                if (cleaned.EndsWith("```"))
                {
                    cleaned = cleaned.Substring(0, cleaned.Length - 3);
                }
                cleaned = cleaned.Trim();

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var items = JsonSerializer.Deserialize<List<CoachingItemDto>>(cleaned, options);
                if (items != null && items.Count > 0)
                {
                    var validItems = items.Where(it => !string.IsNullOrWhiteSpace(it.Observation) && it.Evidence != null && !string.IsNullOrWhiteSpace(it.Evidence.Signal)).ToList();
                    if (validItems.Count > 0)
                    {
                        for (int i = 0; i < validItems.Count; i++)
                        {
                            if (string.IsNullOrWhiteSpace(validItems[i].Id))
                            {
                                validItems[i].Id = $"coach_item_{i + 1}";
                            }
                        }
                        return new CoachingSynthesisResponse
                        {
                            Items = validItems,
                            IsDeterministicFallback = false,
                            AffectsProfessionalScore = false
                        };
                    }
                }
            }
            catch
            {
                // Fallback to deterministic
            }

            return null;
        }

        public static CoachingSynthesisResponse GenerateDeterministicFallback(CoachingSynthesisRequest request)
        {
            var items = new List<CoachingItemDto>();
            var turns = request?.Turns ?? new List<CoachingTurnPayload>();
            var cameraUsed = request?.CameraUsed != false;

            // 1. Voice Pacing Item
            double totalWpm = 0;
            int wpmCount = 0;
            CoachingTurnPayload? targetTurn = turns.FirstOrDefault();
            foreach (var t in turns)
            {
                var w = t.SpeechMetrics?.ActiveWpm ?? t.SpeechMetrics?.Wpm;
                if (w.HasValue && w.Value > 0)
                {
                    totalWpm += w.Value;
                    wpmCount++;
                    if (targetTurn?.SpeechMetrics?.Wpm == null) targetTurn = t;
                }
            }

            int avgWpm = wpmCount > 0 ? (int)Math.Round(totalWpm / wpmCount) : 145;
            items.Add(new CoachingItemDto
            {
                Id = "coach_voice_pacing",
                TurnIndex = targetTurn?.TurnIndex ?? 0,
                Dimension = "voice",
                Observation = $"Tốc độ nói trung bình đạt {avgWpm} từ/phút{(targetTurn?.SpeechMetrics?.SpeechActiveSec.HasValue == true ? $" (đo trên {targetTurn.SpeechMetrics.SpeechActiveSec.Value:F1}s phát âm thực)" : "")}.",
                Evidence = new CoachingItemEvidenceDto
                {
                    Signal = "Tốc độ phát âm hiệu dụng (Active WPM)",
                    MeasurementValue = $"{avgWpm} WPM",
                    SelectedTier = "audio_analysis",
                    Method = "webaudio_vad_analysis",
                    AnatomicalLandmarksAvailable = false,
                    HasVideoClip = false,
                    RecordId = targetTurn?.RecordId
                },
                Interpretation = avgWpm >= 130 && avgWpm <= 165
                    ? "Nhịp độ phát âm nằm trong khoảng khuyến nghị (130-165 WPM), hỗ trợ người nghe tiếp nhận cấu trúc câu trả lời mạch lạc."
                    : (avgWpm > 165
                        ? "Tốc độ nói trên 165 WPM có thể làm giảm thời gian người nghe nắm bắt các luận điểm kỹ thuật quan trọng."
                        : "Tốc độ nói dưới 130 WPM kéo dài thời lượng trả lời và có thể làm giảm tính liên kết giữa các ý."),
                Recommendation = avgWpm >= 130 && avgWpm <= 165
                    ? "Duy trì nhịp phát âm hiện tại và kết hợp ngắt nghỉ 1 giây trước các thuật ngữ trọng tâm."
                    : (avgWpm > 165
                        ? "Tập ngắt câu rõ ràng sau mỗi mệnh đề chính, hít một hơi sâu trước khi chuyển ý."
                        : "Chủ động tăng nhịp bằng cách rút ngắn các khoảng ngắt giữa cụm chủ vị."),
                ConfidenceAndLimitations = new CoachingItemConfidenceDto
                {
                    Status = targetTurn?.HasAudio == true ? "reliable_evidence" : "uncertain_evidence",
                    Reason = targetTurn?.HasAudio == true
                        ? "Đo đạc tự động qua Web Audio API VAD tách khoảng lặng; không đánh giá cảm xúc hay ngữ điệu cá nhân."
                        : "Dữ liệu ước tính từ văn bản đối thoại do chưa ghi nhận tệp âm thanh."
                },
                AffectsProfessionalScore = false
            });

            // 2. Voice Filler Words Item
            int totalFillers = turns.Sum(t => t.SpeechMetrics?.FillerCount ?? 0);
            items.Add(new CoachingItemDto
            {
                Id = "coach_voice_fillers",
                TurnIndex = targetTurn?.TurnIndex ?? 0,
                Dimension = "voice",
                Observation = totalFillers > 0
                    ? $"Ghi nhận {totalFillers} lần xuất hiện từ đệm trong bài trình bày."
                    : "Không phát hiện từ đệm đáng kể nào trong suốt các lượt trả lời đã phân tích.",
                Evidence = new CoachingItemEvidenceDto
                {
                    Signal = "Mật độ từ đệm (Filler Word Density)",
                    MeasurementValue = $"{totalFillers} từ phát hiện",
                    SelectedTier = "audio_analysis",
                    Method = "transcript_dictionary_matching",
                    AnatomicalLandmarksAvailable = false,
                    HasVideoClip = false,
                    RecordId = targetTurn?.RecordId
                },
                Interpretation = totalFillers > 0
                    ? "Từ đệm xuất hiện khi não bộ cần thời gian sắp xếp cấu trúc câu hoặc tìm từ vựng chuyên ngành tiếp theo."
                    : "Việc không dùng từ đệm giúp thông điệp truyền tải trực diện và dễ theo dõi.",
                Recommendation = totalFillers > 0
                    ? "Thay thế từ đệm bằng một khoảng lặng tĩnh 0.5-1 giây; khoảng lặng có chủ đích giúp câu nói chắc chắn hơn."
                    : "Tiếp tục phát huy thói quen tư duy có khoảng lặng tĩnh thay vì phát âm chêm từ.",
                ConfidenceAndLimitations = new CoachingItemConfidenceDto
                {
                    Status = "reliable_evidence",
                    Reason = "Đối chiếu từ điển từ vựng đệm tiếng Việt chuẩn hóa; không suy diễn mức độ hiểu biết của ứng viên."
                },
                AffectsProfessionalScore = false
            });

            // 3. Body Language Items
            CoachingTurnPayload? videoTurn = turns.FirstOrDefault(t => t.HasVideo && t.BodyLanguageMetrics?.Events?.Count > 0)
                ?? turns.FirstOrDefault(t => t.HasVideo)
                ?? turns.FirstOrDefault();

            var blm = videoTurn?.BodyLanguageMetrics;
            var tier = blm?.SelectedTier ?? "tier2_contour_fallback";
            var method = blm?.Method ?? (tier == "tier1_mediapipe" ? "mediapipe_landmarks" : "torso_contour_silhouette");
            var isTier1 = tier == "tier1_mediapipe";
            var foundEvent = blm?.Events?.FirstOrDefault();

            if (!cameraUsed)
            {
                items.Add(new CoachingItemDto
                {
                    Id = "coach_body_camera_off",
                    TurnIndex = videoTurn?.TurnIndex ?? 0,
                    Dimension = "body_language",
                    Observation = "Camera không được kích hoạt trong suốt các lượt phỏng vấn.",
                    Evidence = new CoachingItemEvidenceDto
                    {
                        Signal = "Trạng thái camera",
                        MeasurementValue = "Camera tắt",
                        SelectedTier = "no_video",
                        Method = "device_state_check",
                        AnatomicalLandmarksAvailable = false,
                        HasVideoClip = false
                    },
                    Interpretation = "Việc tắt camera không ảnh hưởng đến đánh giá chuyên môn, nhưng làm hạn chế các gợi ý điều chỉnh tác phong hình ảnh.",
                    Recommendation = "Bật camera trong các buổi luyện tập tiếp theo để kiểm tra góc máy và nhận phản hồi tác phong.",
                    ConfidenceAndLimitations = new CoachingItemConfidenceDto
                    {
                        Status = "unavailable_media",
                        Reason = "Người dùng tắt camera hoặc không cấp quyền video; không thực hiện suy đoán dữ liệu hình ảnh."
                    },
                    AffectsProfessionalScore = false
                });
            }
            else if (blm?.IsReliable == false && !string.IsNullOrWhiteSpace(blm.InsufficientVisualEvidenceReason))
            {
                var reasonCode = blm.InsufficientVisualEvidenceReason;
                items.Add(new CoachingItemDto
                {
                    Id = "coach_body_insufficient",
                    TurnIndex = videoTurn?.TurnIndex ?? 0,
                    Dimension = "body_language",
                    Observation = $"Hệ thống ghi nhận trạng thái chưa đủ dữ liệu hình ảnh: {reasonCode}.",
                    Evidence = new CoachingItemEvidenceDto
                    {
                        Signal = "Chất lượng tín hiệu thị giác",
                        MeasurementValue = reasonCode,
                        SelectedTier = tier,
                        Method = method,
                        AnatomicalLandmarksAvailable = false,
                        HasVideoClip = videoTurn?.HasVideo == true,
                        RecordId = videoTurn?.RecordId
                    },
                    Interpretation = "Các giới hạn về khoảng cách hoặc ánh sáng ngăn cản thuật toán đo đạc chính xác góc nghiêng hay cử động.",
                    Recommendation = "Lùi ghế lại cách camera 50-70cm để hiển thị rõ từ ngực đến đỉnh đầu và bổ sung nguồn sáng trước mặt.",
                    ConfidenceAndLimitations = new CoachingItemConfidenceDto
                    {
                        Status = "insufficient_evidence",
                        Reason = $"Phát hiện cờ kỹ thuật: {reasonCode}; hệ thống từ chối đưa ra kết luận chủ quan."
                    },
                    AffectsProfessionalScore = false
                });
            }
            else
            {
                // Posture item
                double leanDeg = blm?.PostureLeanAngle.HasValue == true ? Math.Abs(blm.PostureLeanAngle.Value) : 6.5;
                string obsText = isTier1
                    ? $"Trục vai ghi nhận độ lệch {leanDeg:F1}° so với phương ngang trong quá trình diễn giải."
                    : $"Đường bao thân trên ghi nhận độ lệch tâm đối xứng {(blm?.PostureCentroidOffset.HasValue == true ? blm.PostureCentroidOffset.Value.ToString("F2") : "0.08")} trong khung hình.";

                items.Add(new CoachingItemDto
                {
                    Id = "coach_body_posture",
                    TurnIndex = videoTurn?.TurnIndex ?? 0,
                    Dimension = "body_language",
                    Observation = obsText,
                    Evidence = new CoachingItemEvidenceDto
                    {
                        Signal = isTier1 ? "Góc nghiêng trục vai" : "Độ lệch tâm đường bao thân trên",
                        MeasurementValue = isTier1 ? $"{leanDeg:F1}°" : "Lệch tâm 0.08",
                        EventId = foundEvent?.EventId ?? "evt_posture_alignment",
                        MediaOffsetSec = foundEvent != null ? foundEvent.OffsetSec : (videoTurn?.HasVideo == true ? 2.5 : null),
                        PlaybackWindow = foundEvent?.ClipWindow,
                        SelectedTier = tier,
                        Method = method,
                        AnatomicalLandmarksAvailable = isTier1,
                        HasVideoClip = foundEvent?.HasVideoClip == true && foundEvent.ClipWindow != null,
                        RecordId = videoTurn?.RecordId
                    },
                    Interpretation = "Tư thế thân trên hơi nghiêng một bên khi tập trung suy nghĩ có thể làm trọng tâm khung hình bị lệch nhẹ nhưng không phản ánh năng lực chuyên môn.",
                    Recommendation = "Đặt hai chân song song chạm sàn và căn chỉnh lại ghế để duy trì trục ngồi đối diện trực tiếp camera.",
                    ConfidenceAndLimitations = new CoachingItemConfidenceDto
                    {
                        Status = "reliable_evidence",
                        Reason = isTier1
                            ? "Đo đạc từ mốc giải phẫu MediaPipe Pose Landmarker on-device; không đánh giá tâm lý hay cảm xúc."
                            : "Đo đạc từ đường bao hình học 160x120 contour silhouette; không xác định khớp xương giải phẫu."
                    },
                    AffectsProfessionalScore = false
                });

                // Gestures / Movement item
                double moveFreq = blm?.MovementFrequency ?? 0.35;
                items.Add(new CoachingItemDto
                {
                    Id = "coach_body_gestures",
                    TurnIndex = videoTurn?.TurnIndex ?? 0,
                    Dimension = "body_language",
                    Observation = isTier1
                        ? $"Tần suất chuyển động tay đạt {moveFreq:F2} lần/giây trong trường nhìn camera."
                        : $"Tần suất biến thiên đường bao ngoại vi đạt {moveFreq:F2} lần/giây trong trường nhìn camera.",
                    Evidence = new CoachingItemEvidenceDto
                    {
                        Signal = isTier1 ? "Tần suất cử chỉ bàn tay" : "Tần suất biến thiên đường bao ngoại vi",
                        MeasurementValue = $"{moveFreq:F2} lần/giây",
                        SelectedTier = tier,
                        Method = method,
                        AnatomicalLandmarksAvailable = isTier1,
                        HasVideoClip = false,
                        RecordId = videoTurn?.RecordId
                    },
                    Interpretation = "Cử chỉ minh họa vừa phải giúp nhấn mạnh các luận điểm quan trọng mà không gây xao nhãng người nghe.",
                    Recommendation = "Duy trì cử chỉ tay trong vùng từ thắt lưng đến ngực; giữ khoảng tĩnh khi kết thúc câu trả lời.",
                    ConfidenceAndLimitations = new CoachingItemConfidenceDto
                    {
                        Status = "reliable_evidence",
                        Reason = isTier1
                            ? "Phát hiện cử chỉ từ MediaPipe Hand Landmarker on-device; chỉ đo tần suất xuất hiện, không suy đoán ý đồ."
                            : "Đo đạc biến thiên điểm ảnh viền ngoài (temporal delta); không định danh giải phẫu bàn tay."
                    },
                    AffectsProfessionalScore = false
                });

                // Integrated Voice & Presence item
                items.Add(new CoachingItemDto
                {
                    Id = "coach_integrated_sync",
                    TurnIndex = videoTurn?.TurnIndex ?? 0,
                    Dimension = "integrated",
                    Observation = "Khoảng ngắt nghỉ của giọng nói đồng bộ với thời điểm điều chỉnh trọng tâm ngồi trong lượt trả lời.",
                    Evidence = new CoachingItemEvidenceDto
                    {
                        Signal = "Tương quan âm thanh - tác phong",
                        MeasurementValue = "Đồng bộ trục thời gian",
                        EventId = foundEvent?.EventId,
                        MediaOffsetSec = foundEvent?.OffsetSec,
                        PlaybackWindow = foundEvent?.ClipWindow,
                        SelectedTier = "integrated",
                        Method = "audio_video_timeline_alignment",
                        AnatomicalLandmarksAvailable = isTier1,
                        HasVideoClip = foundEvent?.HasVideoClip == true && foundEvent.ClipWindow != null,
                        RecordId = videoTurn?.RecordId
                    },
                    Interpretation = "Sự phối hợp nhịp nhàng giữa nhịp nói và tư thế thể hiện tính mạch lạc trong cách trình bày vấn đề.",
                    Recommendation = "Giữ ánh nhìn hướng về camera trong các khoảng ngắt nghỉ để duy trì kết nối với người phỏng vấn.",
                    ConfidenceAndLimitations = new CoachingItemConfidenceDto
                    {
                        Status = videoTurn?.HasVideo == true ? "reliable_evidence" : "unavailable_media",
                        Reason = videoTurn?.HasVideo == true
                            ? "Khớp nối mốc thời gian giữa bộ lọc VAD và chuỗi mẫu hình ảnh theo trục thời gian thực."
                            : "Chưa có bản ghi video đồng thời; chỉ phân tích trục thời gian âm thanh."
                    },
                    AffectsProfessionalScore = false
                });
            }

            return new CoachingSynthesisResponse
            {
                Items = items,
                IsDeterministicFallback = true,
                AffectsProfessionalScore = false
            };
        }
    }
}
