using System;
using System.Collections.Generic;
using System.Linq;
using backend.Models;

namespace backend.Services.Evaluation
{
    public class ImprovementRoadmapService : IImprovementRoadmapService
    {
        public ImprovementRoadmap GenerateRoadmap(Session session, FinalInterviewEvaluation evaluation)
        {
            if (session == null) throw new ArgumentNullException(nameof(session));
            if (evaluation == null) throw new ArgumentNullException(nameof(evaluation));

            var context = session.InterviewContext;
            var targetPosition = !string.IsNullOrWhiteSpace(context?.TargetPosition)
                ? context.TargetPosition
                : (!string.IsNullOrWhiteSpace(session.JobTitle)
                    ? session.JobTitle
                    : (!string.IsNullOrWhiteSpace(evaluation.TargetPosition) ? evaluation.TargetPosition : ProfessionalDomainClassifier.DefaultPositionTitle));

            var targetLevel = !string.IsNullOrWhiteSpace(context?.ExperienceLevel)
                ? context.ExperienceLevel
                : (!string.IsNullOrWhiteSpace(session.InterviewState?.CandidateLevel)
                    ? session.InterviewState.CandidateLevel
                    : (!string.IsNullOrWhiteSpace(evaluation.TargetLevel) ? evaluation.TargetLevel : "Mid"));

            var roadmap = new ImprovementRoadmap
            {
                SessionId = session.Id ?? string.Empty,
                TargetPosition = targetPosition,
                TargetLevel = targetLevel,
                CreatedAt = DateTime.UtcNow
            };

            var diagnostics = evaluation.DiagnosticAnalysis;
            if (diagnostics == null || (diagnostics.Weaknesses.Count == 0 && diagnostics.KnowledgeGaps.Count == 0 && diagnostics.Risks.Count == 0 && diagnostics.CrossDimensionFindings.Count == 0))
            {
                roadmap.Summary = "Ứng viên thể hiện tốt toàn diện hoặc chưa có đủ dữ liệu chẩn đoán để lập lộ trình cải thiện.";
                return roadmap;
            }

            var blueprintConcepts = GetAllBlueprintConcepts(session);

            // 1. Map Tested Weaknesses to Improvement Items
            var items = new List<ImprovementItem>();
            foreach (var weakness in diagnostics.Weaknesses)
            {
                // Invariant: Weakness must be from tested evidence
                var matchedConcept = FindBlueprintConcept(blueprintConcepts, weakness.RelatedCompetency);

                var item = new ImprovementItem
                {
                    Id = Guid.NewGuid().ToString(),
                    DiagnosticReference = weakness.Title,
                    ConceptId = matchedConcept?.Id ?? string.Empty,
                    ConceptName = matchedConcept?.Name ?? (!string.IsNullOrWhiteSpace(weakness.RelatedCompetency) ? weakness.RelatedCompetency : weakness.Title),
                    RelatedCompetency = weakness.RelatedCompetency,
                    RootCause = weakness.RootCause,
                    Priority = weakness.Priority,
                    Impact = weakness.Impact,
                    CurrentState = weakness.Explanation,
                    TurnReferences = weakness.TurnReferences != null ? new List<int>(weakness.TurnReferences) : new List<int>(),
                    EstimatedEffort = DetermineEstimatedEffort(weakness.RootCause, weakness.Impact)
                };

                // Calibrate Objective and Actions by RootCause and Level
                CalibrateObjectiveAndActions(item, targetLevel, context?.TargetCompany);

                // Evidence Required for Verification
                item.EvidenceRequired = GenerateEvidenceRequired(weakness.RootCause, item.ConceptName);

                items.Add(item);
            }

            // 2. Deterministic Sorting:
            // High Priority > Medium Priority > Low Priority
            // Mandatory Concept > Optional Concept
            // High Impact > Medium Impact > Low Impact
            items = items
                .OrderBy(it => GetPriorityOrder(it.Priority))
                .ThenByDescending(it => IsMandatoryConcept(blueprintConcepts, it.ConceptId, it.RelatedCompetency))
                .ThenBy(it => GetImpactOrder(it.Impact))
                .ThenBy(it => it.ConceptName, StringComparer.OrdinalIgnoreCase)
                .ToList();

            roadmap.Items = items;

            // 3. Top Priorities
            roadmap.TopPriorities = items
                .Where(it => it.Priority == DiagnosticPriority.HIGH)
                .Select(it => it.ImprovementObjective)
                .Take(3)
                .ToList();

            if (roadmap.TopPriorities.Count == 0 && items.Count > 0)
            {
                roadmap.TopPriorities = items.Take(2).Select(it => it.ImprovementObjective).ToList();
            }

            // 4. Map UNASSESSED / Knowledge Gaps strictly to VerificationPlan & Limitations
            // INVARIANT: UNASSESSED gaps NEVER become an ImprovementItem in Items!
            foreach (var gap in diagnostics.KnowledgeGaps)
            {
                if (gap.GapType == KnowledgeGapType.UNASSESSED || gap.Confidence == EvaluationConfidence.INSUFFICIENT_EVIDENCE)
                {
                    roadmap.VerificationPlan.Add(new VerificationPlanItem
                    {
                        TargetConcept = gap.Title,
                        VerificationMethod = "Phỏng vấn bổ sung / Kịch bản đánh giá kỹ năng chưa kiểm tra",
                        ScenarioDescription = $"Đưa ra tình huống thực tế liên quan đến {gap.Title} để thu thập bằng chứng năng lực còn khuyết.",
                        ExpectedSignals = new List<string>
                        {
                            $"Trình bày được định nghĩa, kiến trúc và phạm vi ứng dụng của {gap.Title}.",
                            $"Đưa ra ví dụ triển khai hoặc giải pháp thực tế giải quyết bài toán liên quan."
                        }
                    });

                    roadmap.Limitations.Add($"Kỹ năng '{gap.Title}' chưa được kiểm tra trong buổi phỏng vấn; cần kế hoạch xác minh riêng thay vì kết luận là điểm yếu.");
                }
            }

            // 5. Strength Leverage Notes
            if (diagnostics.Strengths != null && diagnostics.Strengths.Count > 0)
            {
                foreach (var strength in diagnostics.Strengths)
                {
                    if (strength.Type == StrengthType.TECHNICAL_KNOWLEDGE || strength.Type == StrengthType.PRACTICAL_EXPERIENCE)
                    {
                        roadmap.StrengthLeverageNotes.Add(
                            $"Tận dụng thế mạnh thực tế về '{strength.RelatedCompetency}' làm điểm tựa khi luyện tập các bài toán phân tích trade-off và tối ưu hóa hệ thống.");
                    }
                    else if (strength.Type == StrengthType.COMMUNICATION)
                    {
                        roadmap.StrengthLeverageNotes.Add(
                            $"Phát huy kỹ năng giao tiếp có cấu trúc để trình bày rõ ràng các giải pháp kỹ thuật chuyên sâu.");
                    }
                    else
                    {
                        roadmap.StrengthLeverageNotes.Add(
                            $"Khai thác ưu điểm '{strength.Title}' để củng cố sự tự tin khi giải quyết các lỗ hổng kiến trúc.");
                    }
                }
            }

            // 6. Synthesis Summary
            roadmap.Summary = GenerateRoadmapSummary(roadmap);

            return roadmap;
        }

        private static List<BlueprintConcept> GetAllBlueprintConcepts(Session session)
        {
            var list = new List<BlueprintConcept>();
            var bp = session.InterviewContext?.KnowledgeBlueprint;
            if (bp?.Areas != null)
            {
                foreach (var area in bp.Areas)
                {
                    if (area.Concepts != null)
                    {
                        list.AddRange(area.Concepts);
                    }
                }
            }
            return list;
        }

        private static BlueprintConcept? FindBlueprintConcept(List<BlueprintConcept> concepts, string competency)
        {
            if (string.IsNullOrWhiteSpace(competency) || concepts.Count == 0) return null;

            return concepts.FirstOrDefault(c =>
                c.Name.Equals(competency, StringComparison.OrdinalIgnoreCase) ||
                c.Id.Equals(competency, StringComparison.OrdinalIgnoreCase) ||
                competency.IndexOf(c.Name, StringComparison.OrdinalIgnoreCase) >= 0 ||
                c.Name.IndexOf(competency, StringComparison.OrdinalIgnoreCase) >= 0);
        }

        private static bool IsMandatoryConcept(List<BlueprintConcept> concepts, string conceptId, string competency)
        {
            var concept = concepts.FirstOrDefault(c =>
                (!string.IsNullOrWhiteSpace(conceptId) && c.Id.Equals(conceptId, StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrWhiteSpace(competency) && (c.Name.Equals(competency, StringComparison.OrdinalIgnoreCase) || c.Id.Equals(competency, StringComparison.OrdinalIgnoreCase))));

            return concept?.IsMandatory ?? false;
        }

        private static int GetPriorityOrder(DiagnosticPriority priority)
        {
            return priority switch
            {
                DiagnosticPriority.HIGH => 0,
                DiagnosticPriority.MEDIUM => 1,
                DiagnosticPriority.LOW => 2,
                _ => 3
            };
        }

        private static int GetImpactOrder(DiagnosticImpact impact)
        {
            return impact switch
            {
                DiagnosticImpact.HIGH => 0,
                DiagnosticImpact.MEDIUM => 1,
                DiagnosticImpact.LOW => 2,
                _ => 3
            };
        }

        private static string DetermineEstimatedEffort(DiagnosticRootCause rootCause, DiagnosticImpact impact)
        {
            if (rootCause == DiagnosticRootCause.TRADE_OFF_REASONING_GAP || rootCause == DiagnosticRootCause.MISSING_PRACTICAL_EXPERIENCE)
            {
                return "HIGH";
            }
            if (rootCause == DiagnosticRootCause.INSUFFICIENT_DEPTH || rootCause == DiagnosticRootCause.FOLLOW_UP_DEPTH_GAP)
            {
                return "MEDIUM";
            }
            if (impact == DiagnosticImpact.LOW)
            {
                return "LOW";
            }
            return "MEDIUM";
        }

        private static void CalibrateObjectiveAndActions(ImprovementItem item, string targetLevel, string? targetCompany)
        {
            var isSenior = targetLevel.IndexOf("Senior", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           targetLevel.IndexOf("Lead", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           targetLevel.IndexOf("Principal", StringComparison.OrdinalIgnoreCase) >= 0;

            var isJunior = targetLevel.IndexOf("Junior", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           targetLevel.IndexOf("Fresher", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           targetLevel.IndexOf("Intern", StringComparison.OrdinalIgnoreCase) >= 0;

            var companyContextSuffix = !string.IsNullOrWhiteSpace(targetCompany)
                ? $" (Cân nhắc bối cảnh và yêu cầu thực tế của {targetCompany})"
                : string.Empty;

            switch (item.RootCause)
            {
                case DiagnosticRootCause.TRADE_OFF_REASONING_GAP:
                    item.ImprovementObjective = isSenior
                        ? $"Nâng cao năng lực phân tích trade-off kiến trúc và bảo vệ giải pháp trước các ràng buộc phi chức năng (latency, throughput, cost) cho {item.ConceptName}{companyContextSuffix}."
                        : $"Nắm rõ ưu nhược điểm và căn cứ lựa chọn giữa các giải pháp kỹ thuật thay thế cho {item.ConceptName}.";

                    item.Actions = new List<ImprovementActionItem>
                    {
                        new ImprovementActionItem
                        {
                            StepIndex = 1,
                            Title = "Lập ma trận phân tích Trade-off và Ràng buộc",
                            ActionType = "Trade-off Analysis",
                            Description = isSenior
                                ? $"Xây dựng bảng so sánh chi tiết giữa các kiến trúc giải pháp cho {item.ConceptName}, phân tích tác động tới scale, reliability và maintenance."
                                : $"So sánh {item.ConceptName} với ít nhất 1 phương án thay thế, chỉ rõ ưu điểm và hạn chế trong từng ngữ cảnh."
                        },
                        new ImprovementActionItem
                        {
                            StepIndex = 2,
                            Title = "Thực hành thiết kế với ràng buộc kỹ thuật khắt khe",
                            ActionType = "Hands-on Exercise",
                            Description = $"Mô phỏng tình huống hệ thống chịu tải cao hoặc giới hạn tài nguyên và biện minh cho quyết định thiết kế đã chọn."
                        }
                    };
                    item.ExpectedOutcome = "Khả năng bảo vệ quyết định kỹ thuật và lý giải rõ ràng các trade-off khi đối mặt với các ràng buộc khắt khe.";
                    item.VerificationCriteria = "Trình bày được ít nhất 2 phương án kỹ thuật kèm phân tích trade-off định lượng và lý do lựa chọn giải pháp tối ưu.";
                    break;

                case DiagnosticRootCause.KNOWLEDGE_GAP:
                    item.ImprovementObjective = isSenior
                        ? $"Chuẩn hóa và làm chủ toàn diện các nguyên lý cốt lõi, đặc tính vận hành nâng cao của {item.ConceptName}."
                        : $"Nắm vững khái niệm nền tảng, định nghĩa chuẩn và cơ chế hoạt động căn bản của {item.ConceptName}.";

                    item.Actions = new List<ImprovementActionItem>
                    {
                        new ImprovementActionItem
                        {
                            StepIndex = 1,
                            Title = "Ôn tập và hệ thống hóa lý thuyết cốt lõi",
                            ActionType = "Concept Review",
                            Description = $"Sử dụng kỹ thuật Feynman để giải thích tường minh định nghĩa, vòng đời và cơ chế vận hành của {item.ConceptName}."
                        },
                        new ImprovementActionItem
                        {
                            StepIndex = 2,
                            Title = "Bài tập củng cố định nghĩa và chuẩn mực kỹ thuật",
                            ActionType = "Drill",
                            Description = $"Thực hành trả lời ngắn gọn, chính xác các câu hỏi lý thuyết then chốt về {item.ConceptName} mà không nhầm lẫn thuật ngữ."
                        }
                    };
                    item.ExpectedOutcome = "Nắm vững định nghĩa và nguyên lý hoạt động căn bản của công nghệ.";
                    item.VerificationCriteria = "Định nghĩa chính xác thuật ngữ kỹ thuật và nêu đúng bản chất cơ chế hoạt động mà không nhầm lẫn.";
                    break;

                case DiagnosticRootCause.MISSING_PRACTICAL_EXPERIENCE:
                    item.ImprovementObjective = isSenior
                        ? $"Bổ sung kinh nghiệm triển khai production, cấu hình hạ tầng và xử lý sự cố quy mô lớn cho {item.ConceptName}{companyContextSuffix}."
                        : $"Thực hành ứng dụng thực tế thông qua dự án mẫu và trực tiếp triển khai {item.ConceptName}.";

                    item.Actions = new List<ImprovementActionItem>
                    {
                        new ImprovementActionItem
                        {
                            StepIndex = 1,
                            Title = "Xây dựng dự án Lab / Mini-Project thực chiến",
                            ActionType = "Hands-on Exercise",
                            Description = $"Cài đặt và tích hợp {item.ConceptName} vào một ứng dụng thực tế chạy trong môi trường sandbox."
                        },
                        new ImprovementActionItem
                        {
                            StepIndex = 2,
                            Title = "Mô phỏng sự cố và quy trình xử lý lỗi (Troubleshooting)",
                            ActionType = "Deep Dive",
                            Description = $"Tự tạo các tình huống lỗi phổ biến (bottleneck, failover, timeout) và thực hành điều tra qua logs, metrics."
                        }
                    };
                    item.ExpectedOutcome = "Có trải nghiệm trực tiếp về vận hành, cấu hình và khắc phục sự cố thực tế.";
                    item.VerificationCriteria = "Có khả năng mô tả từng bước cấu hình, gỡ lỗi và giải quyết sự cố thực tế đã gặp trong lab/project.";
                    break;

                case DiagnosticRootCause.INSUFFICIENT_DEPTH:
                    item.ImprovementObjective = isSenior
                        ? $"Đào sâu cơ chế kiến trúc nội tại (under the hood), thuật toán nội bộ và giới hạn biên của {item.ConceptName}."
                        : $"Nâng cao hiểu biết về cơ chế hoạt động bên dưới bề mặt API của {item.ConceptName}.";

                    item.Actions = new List<ImprovementActionItem>
                    {
                        new ImprovementActionItem
                        {
                            StepIndex = 1,
                            Title = "Đọc hiểu cơ chế nội tại (Under the hood)",
                            ActionType = "Deep Dive",
                            Description = $"Nghiên cứu tài liệu kỹ thuật chuyên sâu hoặc mã nguồn (under the hood) để giải thích cơ chế xử lý bên trong của {item.ConceptName}."
                        },
                        new ImprovementActionItem
                        {
                            StepIndex = 2,
                            Title = "Khảo sát và xử lý các trường hợp biên (Edge cases)",
                            ActionType = "Hands-on Exercise",
                            Description = $"Phân tích hành vi của hệ thống khi gặp điều kiện biên, race conditions hoặc sự cố phần cứng/mạng."
                        }
                    };
                    item.ExpectedOutcome = "Hiểu rõ cơ chế tầng sâu và lý do tại sao hệ thống hoạt động như vậy thay vì chỉ biết cách dùng.";
                    item.VerificationCriteria = "Trả lời sâu sắc câu hỏi 'tại sao', phân tích được hành vi của hệ thống ở tầng thấp và giải quyết được bài toán biên.";
                    break;

                case DiagnosticRootCause.FOLLOW_UP_DEPTH_GAP:
                    item.ImprovementObjective = isSenior
                        ? $"Duy trì tính vững chắc và nhất quán khi trả lời các câu hỏi đào sâu đa tầng về {item.ConceptName}."
                        : $"Tự tin bảo vệ luận điểm và ứng biến tốt khi được hỏi tiếp về chi tiết kỹ thuật của {item.ConceptName}.";

                    item.Actions = new List<ImprovementActionItem>
                    {
                        new ImprovementActionItem
                        {
                            StepIndex = 1,
                            Title = "Luyện tập phản xạ trả lời câu hỏi follow-up 3 tầng",
                            ActionType = "Drill",
                            Description = $"Thực hành trả lời theo 3 tầng: 1. Khái niệm tổng quan -> 2. Cơ chế thực hiện chi tiết -> 3. Xử lý kịch bản dị thường."
                        },
                        new ImprovementActionItem
                        {
                            StepIndex = 2,
                            Title = "Mô phỏng phản biện kỹ thuật (Mock Defense)",
                            ActionType = "Trade-off Analysis",
                            Description = $"Thực hành các phiên phản biện giả lập với các câu hỏi đào sâu liên tiếp về {item.ConceptName}."
                        }
                    };
                    item.ExpectedOutcome = "Duy trì phong độ nhất quán và bảo vệ được luận điểm khi bị người phỏng vấn liên tục đào sâu.";
                    item.VerificationCriteria = "Trả lời mạch lạc qua 2-3 câu hỏi follow-up liên tiếp mà không bị mâu thuẫn hay mất bình tĩnh.";
                    break;

                case DiagnosticRootCause.COMMUNICATION_STRUCTURE_GAP:
                    item.ImprovementObjective = "Cải thiện kỹ năng cấu trúc câu trả lời kỹ thuật, diễn đạt súc tích và mạch lạc.";
                    item.Actions = new List<ImprovementActionItem>
                    {
                        new ImprovementActionItem
                        {
                            StepIndex = 1,
                            Title = "Áp dụng khung cấu trúc STAR / PREP",
                            ActionType = "Drill",
                            Description = "Luyện tập trình bày câu trả lời kỹ thuật theo khung PREP (Point - Reason - Example - Point) trong thời lượng 60-90 giây."
                        },
                        new ImprovementActionItem
                        {
                            StepIndex = 2,
                            Title = "Rà soát tính súc tích và loại bỏ lan man",
                            ActionType = "Concept Review",
                            Description = "Tóm tắt ý chính trước khi đi vào chi tiết, tránh đưa các thông tin không liên quan trực tiếp đến câu hỏi."
                        }
                    };
                    item.ExpectedOutcome = "Truyền tải ý tưởng kỹ thuật một cách cô đọng, có cấu trúc chặt chẽ và đúng trọng tâm.";
                    item.VerificationCriteria = "Trình bày giải pháp kỹ thuật có mở đầu rõ ràng, lập luận logic và kết luận ngắn gọn trong khung thời gian quy định.";
                    break;

                default:
                    item.ImprovementObjective = $"Củng cố và nâng cao năng lực về {item.ConceptName}.";
                    item.Actions = new List<ImprovementActionItem>
                    {
                        new ImprovementActionItem
                        {
                            StepIndex = 1,
                            Title = "Ôn tập chuyên đề",
                            ActionType = "Concept Review",
                            Description = $"Rà soát lại kiến thức nền tảng và phương pháp thực hành về {item.ConceptName}."
                        }
                    };
                    item.ExpectedOutcome = $"Nâng cao hiểu biết và kỹ năng ứng dụng {item.ConceptName}.";
                    item.VerificationCriteria = $"Giải quyết được bài toán tình huống liên quan đến {item.ConceptName}.";
                    break;
            }
        }

        private static List<string> GenerateEvidenceRequired(DiagnosticRootCause rootCause, string conceptName)
        {
            return rootCause switch
            {
                DiagnosticRootCause.TRADE_OFF_REASONING_GAP => new List<string>
                {
                    $"Bảng phân tích trade-off so sánh {conceptName} với giải pháp thay thế.",
                    "Lý giải các chỉ số throughput, latency hoặc cost trong quyết định kiến trúc."
                },
                DiagnosticRootCause.KNOWLEDGE_GAP => new List<string>
                {
                    $"Định nghĩa chuẩn xác và giải thích cơ chế nội bộ của {conceptName}.",
                    "Phân biệt đúng các thuật ngữ và công nghệ liên quan."
                },
                DiagnosticRootCause.MISSING_PRACTICAL_EXPERIENCE => new List<string>
                {
                    $"Mã nguồn hoặc cấu hình của dự án lab sử dụng {conceptName}.",
                    "Kịch bản xử lý sự cố thực tế kèm các lệnh gỡ lỗi hoặc giải pháp khắc phục."
                },
                DiagnosticRootCause.INSUFFICIENT_DEPTH => new List<string>
                {
                    $"Phân tích cơ chế under-the-hood của {conceptName}.",
                    "Giải pháp xử lý các tình huống biên (edge cases) và lỗi tiềm ẩn."
                },
                DiagnosticRootCause.FOLLOW_UP_DEPTH_GAP => new List<string>
                {
                    "Khả năng trả lời trơn tru tối thiểu 2 tầng câu hỏi đào sâu liên tiếp.",
                    "Không xuất hiện mâu thuẫn giữa câu trả lời ban đầu và chi tiết triển khai."
                },
                DiagnosticRootCause.COMMUNICATION_STRUCTURE_GAP => new List<string>
                {
                    "Câu trả lời tuân thủ cấu trúc PREP/STAR dưới 90 giây.",
                    "Trọng tâm rõ ràng, kết luận dứt khoát."
                },
                _ => new List<string>
                {
                    $"Bằng chứng chứng minh sự tiến bộ đối với {conceptName}."
                }
            };
        }

        private static string GenerateRoadmapSummary(ImprovementRoadmap roadmap)
        {
            if (roadmap.Items.Count == 0)
            {
                return $"Lộ trình phát triển vị trí {roadmap.TargetPosition} ({roadmap.TargetLevel}): Không ghi nhận điểm yếu cần can thiệp khẩn cấp.";
            }

            var highCount = roadmap.Items.Count(it => it.Priority == DiagnosticPriority.HIGH);
            var medCount = roadmap.Items.Count(it => it.Priority == DiagnosticPriority.MEDIUM);

            var topItemsStr = roadmap.TopPriorities.Count > 0
                ? string.Join("; ", roadmap.TopPriorities.Take(2))
                : string.Join("; ", roadmap.Items.Take(2).Select(i => i.ConceptName));

            return $"Lộ trình cải thiện cá nhân hóa cho vị trí {roadmap.TargetPosition} ({roadmap.TargetLevel}): Xác định {roadmap.Items.Count} hạng mục cần hoàn thiện ({highCount} mức ưu tiên cao, {medCount} mức trung bình). Trọng tâm cải thiện trước mắt: {topItemsStr}.";
        }
    }
}
