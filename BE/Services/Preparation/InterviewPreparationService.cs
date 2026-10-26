using System;
using System.Collections.Generic;
using System.Linq;
using backend.Models;

namespace backend.Services.Preparation
{
    public class InterviewPreparationService : IInterviewPreparationService
    {
        public InterviewPreparationPlan GeneratePreparationPlan(Session session, FinalInterviewEvaluation evaluation)
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

            var isSenior = targetLevel.IndexOf("Senior", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           targetLevel.IndexOf("Lead", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           targetLevel.IndexOf("Principal", StringComparison.OrdinalIgnoreCase) >= 0;

            var isJunior = targetLevel.IndexOf("Junior", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           targetLevel.IndexOf("Fresher", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           targetLevel.IndexOf("Intern", StringComparison.OrdinalIgnoreCase) >= 0;

            var plan = new InterviewPreparationPlan
            {
                SessionId = session.Id ?? string.Empty,
                TargetPosition = targetPosition,
                TargetLevel = targetLevel,
                OverallReadiness = evaluation.PerformanceAssessment?.Readiness ?? InterviewReadinessStatus.NEEDS_MORE_EVIDENCE,
                ReadinessRationale = !string.IsNullOrWhiteSpace(evaluation.PerformanceAssessment?.ReadinessRationale)
                    ? evaluation.PerformanceAssessment.ReadinessRationale
                    : (evaluation.OverallConfidence == EvaluationConfidence.INSUFFICIENT_EVIDENCE
                        ? "Chưa có đủ dữ liệu phỏng vấn để xác định mức độ sẵn sàng."
                        : "Cần kế hoạch chuẩn bị chuyên sâu trước buổi phỏng vấn chính thức."),
                CreatedAt = DateTime.UtcNow
            };

            var blueprintConcepts = GetAllBlueprintConcepts(session);
            if (blueprintConcepts.Count == 0)
            {
                plan.Limitations.Add("Knowledge Blueprint không khả dụng cho phiên phỏng vấn này.");
            }

            var diagnostics = evaluation.DiagnosticAnalysis;
            var roadmap = evaluation.ImprovementRoadmap;

            // 1. Process Tested Weaknesses & Roadmap Items into Categories
            if (roadmap?.Items != null && roadmap.Items.Count > 0)
            {
                foreach (var rmItem in roadmap.Items)
                {
                    var title = !string.IsNullOrWhiteSpace(rmItem.ImprovementObjective)
                        ? rmItem.ImprovementObjective
                        : (!string.IsNullOrWhiteSpace(rmItem.ConceptName)
                            ? $"Củng cố và hoàn thiện kỹ năng: {rmItem.ConceptName}"
                            : rmItem.DiagnosticReference);

                    var objective = !string.IsNullOrWhiteSpace(rmItem.ImprovementObjective)
                        ? rmItem.ImprovementObjective
                        : (!string.IsNullOrWhiteSpace(rmItem.ConceptName)
                            ? $"Ôn tập và nâng cao năng lực về {rmItem.ConceptName}."
                            : $"Khắc phục hạn chế: {rmItem.DiagnosticReference}.");

                    var matchedConcept = FindBlueprintConcept(blueprintConcepts, rmItem.ConceptName);
                    var conceptId = !string.IsNullOrWhiteSpace(rmItem.ConceptId)
                        ? rmItem.ConceptId
                        : (matchedConcept?.Id ?? string.Empty);
                    var conceptName = !string.IsNullOrWhiteSpace(rmItem.ConceptName)
                        ? rmItem.ConceptName
                        : (matchedConcept?.Name ?? rmItem.DiagnosticReference);

                    var prepItem = new PreparationItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Title = title,
                        ConceptId = conceptId,
                        ConceptName = conceptName,
                        Priority = rmItem.Priority,
                        CurrentState = rmItem.CurrentState,
                        Objective = objective,
                        ExpectedSignal = rmItem.VerificationCriteria,
                        DiagnosticReference = rmItem.DiagnosticReference,
                        TurnReferences = rmItem.TurnReferences != null ? new List<int>(rmItem.TurnReferences) : new List<int>(),
                        Actions = rmItem.Actions != null ? rmItem.Actions.Select(a => $"{a.Title}: {a.Description}").ToList() : new List<string>(),
                        IsMandatory = IsConceptMandatory(blueprintConcepts, conceptId, conceptName),
                        SourceType = RequirementSource.OFFICIAL
                    };

                    switch (rmItem.RootCause)
                    {
                        case DiagnosticRootCause.MISSING_PRACTICAL_EXPERIENCE:
                            prepItem.Category = "Practical";
                            prepItem.Reason = $"Phát hiện khoảng trống kinh nghiệm thực hành: {rmItem.DiagnosticReference}.";
                            plan.PracticalPreparation.Add(prepItem);
                            break;

                        case DiagnosticRootCause.TRADE_OFF_REASONING_GAP:
                            prepItem.Category = "SystemDesign";
                            prepItem.Reason = $"Phát hiện hạn chế trong tư duy phân tích trade-off và bảo vệ giải pháp kiến trúc: {rmItem.DiagnosticReference}.";
                            plan.SystemDesignPreparation.Add(prepItem);
                            break;

                        case DiagnosticRootCause.FOLLOW_UP_DEPTH_GAP:
                            prepItem.Category = "FollowUp";
                            prepItem.Reason = $"Lúng túng khi người phỏng vấn đào sâu nhiều tầng câu hỏi: {rmItem.DiagnosticReference}.";
                            plan.FollowUpPreparation.Add(prepItem);
                            break;

                        case DiagnosticRootCause.COMMUNICATION_STRUCTURE_GAP:
                            prepItem.Category = "Communication";
                            prepItem.Reason = $"Kỹ năng truyền tải kỹ thuật còn lan man, thiếu cấu trúc: {rmItem.DiagnosticReference}.";
                            plan.CommunicationPreparation.Add(prepItem);
                            break;

                        case DiagnosticRootCause.INSUFFICIENT_DEPTH:
                        case DiagnosticRootCause.KNOWLEDGE_GAP:
                        default:
                            prepItem.Category = "Technical";
                            prepItem.Reason = $"Lỗ hổng kiến thức hoặc độ sâu lý thuyết: {rmItem.DiagnosticReference}.";
                            plan.TechnicalPreparation.Add(prepItem);
                            break;
                    }
                }
            }

            // 2. UNASSESSED Concepts Handling (INVARIANT: UNASSESSED != WEAK)
            if (diagnostics?.KnowledgeGaps != null)
            {
                foreach (var gap in diagnostics.KnowledgeGaps.Where(g => g.GapType == KnowledgeGapType.UNASSESSED || g.Confidence == EvaluationConfidence.INSUFFICIENT_EVIDENCE))
                {
                    var matchedConcept = FindBlueprintConcept(blueprintConcepts, gap.RelatedCompetency);
                    var isMandatory = matchedConcept?.IsMandatory ?? gap.IsMandatory;

                    var unassessedItem = new PreparationItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Title = $"Chuẩn bị và kiểm chứng kỹ năng: {gap.Title}",
                        Category = "Technical",
                        Priority = isMandatory ? DiagnosticPriority.HIGH : DiagnosticPriority.MEDIUM,
                        Reason = $"Kỹ năng '{gap.Title}' chưa được kiểm tra trong buổi phỏng vấn (Cơ hội chuẩn bị & kiểm chứng).",
                        CurrentState = "Chưa được đánh giá (UNASSESSED).",
                        Objective = isSenior
                            ? $"Ôn tập nguyên lý nâng cao, kiến trúc phân tán và các ca sự cố thực tế liên quan đến {gap.Title}."
                            : $"Nắm vững khái niệm nền tảng về {gap.Title} và chuẩn bị 1 ví dụ ứng dụng thực tế.",
                        Actions = new List<string>
                        {
                            $"Ôn lại định nghĩa chuẩn mực, cơ chế vận hành và best practices của {gap.Title}.",
                            $"Chuẩn bị giải thích rõ ràng khi nào nên sử dụng {gap.Title} và cách xử lý lỗi thường gặp."
                        },
                        ExpectedSignal = $"Giải thích được bản chất kỹ thuật, kịch bản ứng dụng và phân tích trade-off khi sử dụng {gap.Title}.",
                        SourceType = matchedConcept?.RequirementSource ?? RequirementSource.OFFICIAL,
                        DiagnosticReference = gap.Title,
                        ConceptId = matchedConcept?.Id ?? string.Empty,
                        ConceptName = matchedConcept?.Name ?? gap.Title,
                        IsMandatory = isMandatory
                    };

                    plan.TechnicalPreparation.Add(unassessedItem);
                    plan.ReadinessSignals.Add($"Cần kiểm chứng thêm năng lực về '{gap.Title}' trước khi đưa ra kết luận tuyển dụng dứt khoát.");
                    plan.Limitations.Add($"Kỹ năng '{gap.Title}' chưa được đánh giá trong buổi phỏng vấn; khuyến nghị chuẩn bị kiểm chứng thay vì coi là điểm yếu.");
                }
            }

            // 3. Mandatory Blueprint Concepts Baseline (For strong or empty candidates)
            if (plan.TechnicalPreparation.Count == 0 && blueprintConcepts.Count > 0)
            {
                foreach (var concept in blueprintConcepts.Where(c => c.IsMandatory && c.RequirementSource == RequirementSource.OFFICIAL).Take(3))
                {
                    plan.TechnicalPreparation.Add(new PreparationItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Title = $"Củng cố kỹ năng cốt lõi: {concept.Name}",
                        Category = "Technical",
                        Priority = DiagnosticPriority.MEDIUM,
                        Reason = $"Kỹ năng bắt buộc then chốt theo JD vị trí {targetPosition}.",
                        CurrentState = "Đã thể hiện tốt hoặc là yêu cầu nền tảng của vị trí.",
                        Objective = $"Duy trì sự tự tin và chuẩn bị các ví dụ thực chiến sâu sắc về {concept.Name}.",
                        Actions = new List<string>
                        {
                            $"Rà soát lại các câu hỏi phỏng vấn nâng cao về {concept.Name}.",
                            $"Chuẩn bị chia sẻ về một bài toán kỹ thuật phức tạp đã trực tiếp giải quyết với {concept.Name}."
                        },
                        ExpectedSignal = $"Trình bày mạch lạc, sâu sắc về kiến trúc và kinh nghiệm thực chiến với {concept.Name}.",
                        SourceType = RequirementSource.OFFICIAL,
                        ConceptId = concept.Id,
                        ConceptName = concept.Name,
                        IsMandatory = true
                    });
                }
            }

            // 4. Behavioral Preparation (STAR/PREP)
            plan.BehavioralPreparation = GenerateBehavioralPreparation(targetLevel, isSenior);

            // 5. Company Preparation (Respecting reliability: OFFICIAL vs INFERRED)
            plan.CompanyPreparation = GenerateCompanyPreparation(session.InterviewContext?.CompanyContext, targetPosition, targetLevel);

            // 6. Execution Preparation
            plan.ExecutionPreparation = GenerateExecutionPreparation(diagnostics, targetPosition);

            // 7. Mock Interview Recommendations
            plan.MockInterviewRecommendations = GenerateMockRecommendations(plan, isSenior);

            // 8. Preparation Checklist
            plan.PreparationChecklist = GeneratePreparationChecklist(plan);

            // 9. Strength Leverage Notes
            if (roadmap?.StrengthLeverageNotes != null && roadmap.StrengthLeverageNotes.Count > 0)
            {
                plan.StrengthLeverageNotes.AddRange(roadmap.StrengthLeverageNotes);
            }
            else if (diagnostics?.Strengths != null)
            {
                foreach (var str in diagnostics.Strengths)
                {
                    plan.StrengthLeverageNotes.Add($"Phát huy điểm mạnh về '{str.Title}' làm điểm tựa tinh thần và kỹ thuật khi trình bày các nội dung chuyên sâu.");
                }
            }

            // 10. Top Preparation Priorities
            var allItems = new List<PreparationItem>();
            allItems.AddRange(plan.TechnicalPreparation);
            allItems.AddRange(plan.PracticalPreparation);
            allItems.AddRange(plan.SystemDesignPreparation);
            allItems.AddRange(plan.FollowUpPreparation);
            allItems.AddRange(plan.CommunicationPreparation);

            // Deterministic Ordering: High priority > Mandatory > Medium > Low
            var sortedItems = allItems
                .OrderBy(it => GetPriorityOrder(it.Priority))
                .ThenByDescending(it => it.IsMandatory)
                .ThenBy(it => it.ConceptName, StringComparer.OrdinalIgnoreCase)
                .ToList();

            plan.PreparationPriorities = sortedItems
                .Select(it => it.Title)
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Distinct()
                .Take(4)
                .ToList();

            if (plan.PreparationPriorities.Count == 0)
            {
                plan.PreparationPriorities.Add($"Rà soát các yêu cầu cốt lõi theo JD vị trí {targetPosition}.");
                plan.PreparationPriorities.Add("Luyện tập 5 câu chuyện tình huống theo khung STAR.");
            }

            // 11. Synthesis Summary
            plan.Summary = GeneratePlanSummary(plan);

            return plan;
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

        private static bool IsConceptMandatory(List<BlueprintConcept> concepts, string conceptId, string conceptName)
        {
            var matched = concepts.FirstOrDefault(c =>
                (!string.IsNullOrWhiteSpace(conceptId) && c.Id.Equals(conceptId, StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrWhiteSpace(conceptName) && (c.Name.Equals(conceptName, StringComparison.OrdinalIgnoreCase) || c.Id.Equals(conceptName, StringComparison.OrdinalIgnoreCase))));

            return matched?.IsMandatory ?? true;
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

        private static List<BehavioralPreparationItem> GenerateBehavioralPreparation(string targetLevel, bool isSenior)
        {
            return new List<BehavioralPreparationItem>
            {
                new BehavioralPreparationItem
                {
                    StoryType = "Self Introduction",
                    Prompt = "Hãy giới thiệu về bản thân, kinh nghiệm nổi bật và định hướng phù hợp với vị trí.",
                    Framework = "PREP",
                    KeyPointsToCover = new List<string>
                    {
                        "Tóm tắt 1-2 câu về chuyên môn chính và số năm kinh nghiệm.",
                        isSenior ? "Điểm nhấn về năng lực dẫn dắt kiến trúc và giải quyết bài toán quy mô lớn." : "Điểm nhấn về thế mạnh lập trình vững vàng và tinh thần học hỏi nhanh.",
                        "Lý do ứng tuyển và giá trị có thể đóng góp cho công ty trong 3-6 tháng đầu."
                    },
                    CandidateEvidenceStatus = "Need candidate preparation"
                },
                new BehavioralPreparationItem
                {
                    StoryType = "Project Ownership",
                    Prompt = "Kể về một dự án kỹ thuật tiêu biểu mà bạn chịu trách nhiệm chính hoặc có đóng góp quan trọng.",
                    Framework = "STAR",
                    KeyPointsToCover = new List<string>
                    {
                        "Situation: Bối cảnh dự án, quy mô người dùng hoặc thách thức kinh doanh.",
                        "Task: Mục tiêu kỹ thuật cụ thể và trách nhiệm cá nhân của bạn.",
                        "Action: Giải pháp kiến trúc/mã nguồn bạn đã chọn và lý do chọn.",
                        "Result: Kết quả định lượng (tăng throughput, giảm latency, giảm chi phí server, hoàn thành đúng hạn)."
                    },
                    CandidateEvidenceStatus = "Need candidate preparation"
                },
                new BehavioralPreparationItem
                {
                    StoryType = "Technical Failure / Mistake",
                    Prompt = "Kể về một sự cố kỹ thuật (incident) hoặc sai lầm trong quá khứ và bài học rút ra.",
                    Framework = "STAR",
                    KeyPointsToCover = new List<string>
                    {
                        "Situation: Nguyên nhân phát sinh sự cố (code bug, config lỗi, tải đột biến).",
                        "Task: Trách nhiệm xử lý và mục tiêu khắc phục.",
                        "Action: Các bước điều tra (post-mortem), xử lý khẩn cấp và giải pháp khắc phục triệt để.",
                        "Result: Hệ thống ổn định trở lại, quy trình phòng ngừa rủi ro được thiết lập cho tương lai."
                    },
                    CandidateEvidenceStatus = "Need candidate preparation"
                },
                new BehavioralPreparationItem
                {
                    StoryType = "Conflict Resolution",
                    Prompt = "Kể về một lần bạn và đồng nghiệp/tech lead có bất đồng ý kiến về giải pháp kỹ thuật.",
                    Framework = "STAR",
                    KeyPointsToCover = new List<string>
                    {
                        "Situation: Điểm khác biệt quan điểm kỹ thuật giữa các bên.",
                        "Action: Sử dụng dữ liệu, benchmark hoặc PoC để phân tích khách quan thay vì cảm tính.",
                        "Result: Đạt được sự đồng thuận của cả đội ngũ và giải pháp triển khai thành công."
                    },
                    CandidateEvidenceStatus = "Need candidate preparation"
                },
                new BehavioralPreparationItem
                {
                    StoryType = "Learning & Adaptability",
                    Prompt = "Kể về một công nghệ hoặc nghiệp vụ hoàn toàn mới mà bạn phải nắm bắt trong thời gian rất ngắn.",
                    Framework = "STAR",
                    KeyPointsToCover = new List<string>
                    {
                        "Situation: Yêu cầu bất ngờ của dự án đòi hỏi áp dụng công nghệ mới.",
                        "Action: Phương pháp tự học (đọc tài liệu chính thức, xây dựng prototype nhỏ, tìm hiểu failure modes).",
                        "Result: Làm chủ công nghệ và ứng dụng hiệu quả vào sản phẩm."
                    },
                    CandidateEvidenceStatus = "Need candidate preparation"
                }
            };
        }

        private static List<CompanyPreparationItem> GenerateCompanyPreparation(CompanyContext? companyContext, string targetPosition, string targetLevel)
        {
            var list = new List<CompanyPreparationItem>();

            if (companyContext == null || string.IsNullOrWhiteSpace(companyContext.CompanyName))
            {
                list.Add(new CompanyPreparationItem
                {
                    Topic = "Nghiên cứu Doanh nghiệp & Ngành",
                    Information = "Chưa có thông tin doanh nghiệp mục tiêu cụ thể.",
                    Reliability = RequirementSource.UNKNOWN,
                    PreparationAdvice = "Chủ động tìm hiểu mô hình kinh doanh, sản phẩm chủ lực và đối tượng khách hàng của công ty trước khi phỏng vấn.",
                    IsMandatory = false
                });
                return list;
            }

            // Company Overview
            list.Add(new CompanyPreparationItem
            {
                Topic = $"Tổng quan {companyContext.CompanyName}",
                Information = $"Lĩnh vực: {companyContext.Industry ?? "Công nghệ thông tin"}, Mô hình: {companyContext.CompanyType ?? "Doanh nghiệp công nghệ"}.",
                Reliability = companyContext.SourceReliability != RequirementSource.UNKNOWN ? companyContext.SourceReliability : RequirementSource.OFFICIAL,
                PreparationAdvice = $"Tìm hiểu sản phẩm chủ lực, tệp khách hàng và các dịch vụ nổi bật của {companyContext.CompanyName}.",
                IsMandatory = true
            });

            // Known Facts (Official / External)
            if (companyContext.KnownFacts != null)
            {
                foreach (var fact in companyContext.KnownFacts)
                {
                    list.Add(new CompanyPreparationItem
                    {
                        Topic = "Thông tin xác minh về doanh nghiệp",
                        Information = fact.Information,
                        Reliability = fact.Reliability,
                        PreparationAdvice = $"Liên hệ kinh nghiệm bản thân với ngữ cảnh '{fact.Information}' để tạo điểm nhấn phù hợp trong buổi phỏng vấn.",
                        IsMandatory = fact.Reliability == RequirementSource.OFFICIAL
                    });
                }
            }

            // Inferred Facts (INVARIANT: MUST BE IsMandatory = false)
            if (companyContext.Inferences != null)
            {
                foreach (var inf in companyContext.Inferences)
                {
                    list.Add(new CompanyPreparationItem
                    {
                        Topic = "Ngữ cảnh tham khảo / Suy luận doanh nghiệp",
                        Information = inf.Information,
                        Reliability = RequirementSource.INFERRED,
                        PreparationAdvice = $"Tìm hiểu thêm về '{inf.Information}' (mang tính tham khảo/suy luận từ bối cảnh doanh nghiệp, không phải yêu cầu bắt buộc tuyệt đối).",
                        IsMandatory = false
                    });
                }
            }

            return list;
        }

        private static List<ExecutionPreparationItem> GenerateExecutionPreparation(DiagnosticAnalysis? diagnostics, string? targetPosition = null)
        {
            var hasFollowUpGap = diagnostics?.Weaknesses?.Any(w => w.RootCause == DiagnosticRootCause.FOLLOW_UP_DEPTH_GAP) ?? false;
            var hasCommGap = diagnostics?.Weaknesses?.Any(w => w.RootCause == DiagnosticRootCause.COMMUNICATION_STRUCTURE_GAP) ?? false;

            var family = ProfessionalDomainClassifier.Classify(targetPosition);
            bool isTech = family == JobFamily.SOFTWARE_ENGINEERING || family == JobFamily.DATA_ANALYTICS;

            string clarificationGuidance = isTech
                ? "Trước khi trả lời bài toán thiết kế hệ thống hoặc coding, luôn đặt 1-2 câu hỏi làm rõ phạm vi: scale người dùng, throughput kỳ vọng, latency SLA và các ràng buộc dữ liệu."
                : "Trước khi đưa ra giải pháp hoặc kế hoạch hành động, luôn đặt 1-2 câu hỏi làm rõ phạm vi: bối cảnh nghiệp vụ, mục tiêu ưu tiên, nguồn lực sẵn có và các bên liên quan (stakeholders).";

            string questionsForInterviewerGuidance = isTech
                ? "Chuẩn bị 2-3 câu hỏi thông minh thể hiện tầm nhìn: Văn hóa xử lý tech debt, lộ trình nâng cấp kiến trúc trong 12 tháng tới, cách đội ngũ đo lường thành công kỹ thuật."
                : "Chuẩn bị 2-3 câu hỏi thông minh thể hiện tầm nhìn: Mục tiêu chiến lược của bộ phận trong 12 tháng tới, văn hóa phối hợp liên chức năng, và cách tổ chức đo lường thành công cho vị trí này.";

            return new List<ExecutionPreparationItem>
            {
                new ExecutionPreparationItem
                {
                    Area = "Answer Structuring (STAR / PREP)",
                    Guidance = "Áp dụng khung PREP cho câu hỏi lý thuyết/kiến trúc: Điểm chính (Point) -> Lý do (Reason) -> Ví dụ thực tế (Example) -> Kết luận (Point). Giới hạn câu trả lời trong 60-90 giây.",
                    Priority = hasCommGap ? DiagnosticPriority.HIGH : DiagnosticPriority.MEDIUM
                },
                new ExecutionPreparationItem
                {
                    Area = "Follow-up Handling & Defense",
                    Guidance = "Khi người phỏng vấn hỏi tiếp 'Tại sao?' hoặc 'Điều gì xảy ra nếu...', hãy giữ bình tĩnh, xác định rõ điều kiện biên và bảo vệ luận điểm bằng trade-off thay vì thay đổi câu trả lời tùy tiện.",
                    Priority = hasFollowUpGap ? DiagnosticPriority.HIGH : DiagnosticPriority.MEDIUM
                },
                new ExecutionPreparationItem
                {
                    Area = "Clarification & Requirement Scoping",
                    Guidance = clarificationGuidance,
                    Priority = DiagnosticPriority.MEDIUM
                },
                new ExecutionPreparationItem
                {
                    Area = "Handling Unknown Questions",
                    Guidance = "Nếu gặp câu hỏi chưa từng làm qua: Thành thật thừa nhận chưa có trải nghiệm trực tiếp, sau đó diễn đạt tư duy logic cách bạn sẽ phân tích và giải quyết bài toán đó.",
                    Priority = DiagnosticPriority.MEDIUM
                },
                new ExecutionPreparationItem
                {
                    Area = "Questions for Interviewer",
                    Guidance = questionsForInterviewerGuidance,
                    Priority = DiagnosticPriority.MEDIUM
                }
            };
        }

        private static List<MockInterviewFocusItem> GenerateMockRecommendations(InterviewPreparationPlan plan, bool isSenior)
        {
            var recommendations = new List<MockInterviewFocusItem>();

            // If practical gap exists
            if (plan.PracticalPreparation.Count > 0)
            {
                var target = plan.PracticalPreparation[0];
                recommendations.Add(new MockInterviewFocusItem
                {
                    FocusArea = $"Mô phỏng Xử lý Sự cố & Thực chiến: {target.ConceptName}",
                    Rationale = $"Củng cố kinh nghiệm thực tế về {target.ConceptName} thông qua bài tập tình huống có lỗi phát sinh.",
                    Priority = DiagnosticPriority.HIGH,
                    SuggestedScenarios = new List<string>
                    {
                        $"Mô phỏng tình huống hệ thống sử dụng {target.ConceptName} bị bottleneck hoặc tăng đột biến latency.",
                        "Yêu cầu ứng viên mô tả các lệnh command, log trace và quy trình từng bước điều tra lỗi."
                    }
                });
            }

            // If system design gap exists
            if (plan.SystemDesignPreparation.Count > 0)
            {
                var target = plan.SystemDesignPreparation[0];
                recommendations.Add(new MockInterviewFocusItem
                {
                    FocusArea = $"Mô phỏng Phản biện Kiến trúc & Trade-off: {target.ConceptName}",
                    Rationale = "Rèn luyện khả năng lựa chọn giải pháp và bảo vệ quyết định kỹ thuật trước các ràng buộc khắt khe.",
                    Priority = DiagnosticPriority.HIGH,
                    SuggestedScenarios = new List<string>
                    {
                        $"Thiết kế hệ thống chịu tải cao với {target.ConceptName}, so sánh với tối thiểu 1 phương án thay thế.",
                        "Người phỏng vấn đặt câu hỏi phản biện về throughput, resource cost và single point of failure."
                    }
                });
            }

            // If follow-up gap exists
            if (plan.FollowUpPreparation.Count > 0)
            {
                recommendations.Add(new MockInterviewFocusItem
                {
                    FocusArea = "Luyện tập Phản xạ Đào sâu 3 Tầng (Rapid Follow-up)",
                    Rationale = "Khắc phục hiện tượng lúng túng khi gặp chuỗi câu hỏi đào sâu liên tiếp.",
                    Priority = DiagnosticPriority.HIGH,
                    SuggestedScenarios = new List<string>
                    {
                        "Hỏi một câu tổng quan về công nghệ, sau đó lập tức đào sâu vào internals.",
                        "Tiếp tục hỏi kịch bản edge case và xem xét sự nhất quán trong câu trả lời."
                    }
                });
            }

            // Fallback general recommendation
            if (recommendations.Count == 0)
            {
                var family = ProfessionalDomainClassifier.Classify(plan.TargetPosition);
                string focusArea;
                string scenarioTech;
                switch (family)
                {
                    case JobFamily.SOFTWARE_ENGINEERING:
                    case JobFamily.DATA_ANALYTICS:
                        focusArea = isSenior ? "Mô phỏng System Design & High Availability" : "Mô phỏng Kỹ thuật Tổng hợp & Coding Best Practices";
                        scenarioTech = "Phỏng vấn kỹ thuật 45 phút bao quát các chủ đề cốt lõi của vị trí.";
                        break;
                    case JobFamily.MARKETING_GROWTH:
                        focusArea = isSenior ? "Mô phỏng Chiến lược Tăng trưởng & Phân bổ Ngân sách" : "Mô phỏng Kế hoạch Chiến dịch & Phân tích Kênh Marketing";
                        scenarioTech = "Phỏng vấn chuyên môn 45 phút về kênh tăng trưởng, CAC/LTV và đo lường ROI.";
                        break;
                    case JobFamily.FINANCE_ACCOUNTING:
                        focusArea = isSenior ? "Mô phỏng Quản trị Tài chính & Chiến lược Vốn" : "Mô phỏng Báo cáo Tài chính & Kiểm soát Chi phí";
                        scenarioTech = "Phỏng vấn chuyên môn 45 phút về phân tích dòng tiền, thẩm định rủi ro và mô hình tài chính.";
                        break;
                    case JobFamily.BUSINESS_ANALYSIS:
                    case JobFamily.PRODUCT_PROJECT:
                        focusArea = isSenior ? "Mô phỏng Hoạch định Sản phẩm & Quản trị Stakeholder" : "Mô phỏng Đặc tả Yêu cầu & Quản lý Backlog";
                        scenarioTech = "Phỏng vấn chuyên môn 45 phút về phân tích nghiệp vụ, mô hình hóa quy trình và giải quyết xung đột ưu tiên.";
                        break;
                    case JobFamily.SALES_BUSINESS_DEVELOPMENT:
                        focusArea = isSenior ? "Mô phỏng Chiến lược Mở rộng Thị trường & Đàm phán Hợp đồng Lớn" : "Mô phỏng Quy trình Bán hàng B2B & Xử lý Từ chối";
                        scenarioTech = "Phỏng vấn chuyên môn 45 phút về quản lý phễu khách hàng, chốt deal và dự báo doanh thu.";
                        break;
                    case JobFamily.HR_PEOPLE:
                        focusArea = isSenior ? "Mô phỏng Chiến lược Phát triển Tổ chức & Nhân tài" : "Mô phỏng Quy trình Tuyển dụng & Gắn kết Nhân viên";
                        scenarioTech = "Phỏng vấn chuyên môn 45 phút về thu hút nhân tài, quan hệ lao động và chính sách đãi ngộ.";
                        break;
                    default:
                        focusArea = isSenior ? "Mô phỏng Quản lý & Hoạch định Chiến lược Chuyên môn" : "Mô phỏng Phỏng vấn Chuyên môn Tổng hợp";
                        scenarioTech = "Phỏng vấn chuyên môn 45 phút bao quát các chủ đề cốt lõi của vị trí.";
                        break;
                }

                recommendations.Add(new MockInterviewFocusItem
                {
                    FocusArea = focusArea,
                    Rationale = "Kiểm tra toàn diện sự tự tin và phản xạ trả lời câu hỏi chuyên môn.",
                    Priority = DiagnosticPriority.MEDIUM,
                    SuggestedScenarios = new List<string>
                    {
                        scenarioTech,
                        "15 phút phỏng vấn hành vi và xử lý tình huống làm việc nhóm."
                    }
                });
            }

            return recommendations;
        }

        private static PreparationChecklist GeneratePreparationChecklist(InterviewPreparationPlan plan)
        {
            var checklist = new PreparationChecklist();

            // Technical tasks
            foreach (var item in plan.TechnicalPreparation.Take(3))
            {
                checklist.TechnicalTasks.Add(new ChecklistItem
                {
                    Task = $"Ôn tập vững chắc kiến thức: {item.ConceptName}",
                    Category = "Technical",
                    IsEvidenceDerived = !string.IsNullOrEmpty(item.DiagnosticReference),
                    Priority = item.Priority
                });
            }
            foreach (var item in plan.PracticalPreparation.Take(2))
            {
                checklist.TechnicalTasks.Add(new ChecklistItem
                {
                    Task = $"Thực hành lab / troubleshooting: {item.ConceptName}",
                    Category = "Technical",
                    IsEvidenceDerived = true,
                    Priority = item.Priority
                });
            }
            foreach (var item in plan.SystemDesignPreparation.Take(2))
            {
                checklist.TechnicalTasks.Add(new ChecklistItem
                {
                    Task = $"Chuẩn bị bảng so sánh trade-off giải pháp: {item.ConceptName}",
                    Category = "Technical",
                    IsEvidenceDerived = true,
                    Priority = item.Priority
                });
            }

            // Behavioral tasks
            checklist.BehavioralTasks.Add(new ChecklistItem { Task = "Luyện tập phần giới thiệu bản thân trong 90 giây theo khung PREP", Category = "Behavioral", Priority = DiagnosticPriority.HIGH });
            checklist.BehavioralTasks.Add(new ChecklistItem { Task = "Chuẩn bị 2 câu chuyện dự án thành công tiêu biểu theo khung STAR", Category = "Behavioral", Priority = DiagnosticPriority.HIGH });
            checklist.BehavioralTasks.Add(new ChecklistItem { Task = "Chuẩn bị 1 câu chuyện về sự cố kỹ thuật (incident) và bài học rút ra", Category = "Behavioral", Priority = DiagnosticPriority.MEDIUM });
            checklist.BehavioralTasks.Add(new ChecklistItem { Task = "Chuẩn bị 1 câu chuyện về giải quyết bất đồng quan điểm kỹ thuật", Category = "Behavioral", Priority = DiagnosticPriority.MEDIUM });

            // Company tasks
            checklist.CompanyTasks.Add(new ChecklistItem { Task = "Đọc kỹ mô tả công việc (JD) và ghi chú các từ khóa kỹ thuật then chốt", Category = "Company", Priority = DiagnosticPriority.HIGH });
            checklist.CompanyTasks.Add(new ChecklistItem { Task = "Tìm hiểu mô hình kinh doanh, sản phẩm chính và công nghệ công khai của công ty", Category = "Company", Priority = DiagnosticPriority.MEDIUM });
            checklist.CompanyTasks.Add(new ChecklistItem { Task = "Chuẩn bị 2-3 câu hỏi chất lượng dành cho người phỏng vấn ở cuối buổi", Category = "Company", Priority = DiagnosticPriority.MEDIUM });

            // Logistics tasks
            checklist.LogisticsTasks.Add(new ChecklistItem { Task = "Kiểm tra kết nối Internet ổn định, camera sắc nét và micro rõ ràng", Category = "Logistics", Priority = DiagnosticPriority.HIGH });
            checklist.LogisticsTasks.Add(new ChecklistItem { Task = "Chuẩn bị không gian phỏng vấn yên tĩnh, đủ ánh sáng và trang phục chỉn chu", Category = "Logistics", Priority = DiagnosticPriority.MEDIUM });
            checklist.LogisticsTasks.Add(new ChecklistItem { Task = "Mở sẵn bản CV cập nhật nhất và portfolio/GitHub dự án", Category = "Logistics", Priority = DiagnosticPriority.MEDIUM });

            return checklist;
        }

        private static string GeneratePlanSummary(InterviewPreparationPlan plan)
        {
            var readinessText = plan.OverallReadiness switch
            {
                InterviewReadinessStatus.READY => "Sẵn sàng tốt",
                InterviewReadinessStatus.READY_WITH_GAPS => "Sẵn sàng với một số khoảng trống cần bổ sung",
                InterviewReadinessStatus.NEEDS_MORE_EVIDENCE => "Cần thêm bằng chứng kiểm chứng",
                InterviewReadinessStatus.NOT_READY => "Chưa đạt mức độ sẵn sàng mục tiêu",
                _ => "Đang trong quá trình đánh giá"
            };

            var topTasks = plan.PreparationPriorities.Count > 0
                ? string.Join("; ", plan.PreparationPriorities.Take(2))
                : "Ôn tập kiến thức nền tảng và luyện tập phỏng vấn tình huống";

            return $"Kế hoạch chuẩn bị phỏng vấn toàn diện cho vị trí {plan.TargetPosition} ({plan.TargetLevel}) [Đánh giá độ sẵn sàng: {readinessText}]. Trọng tâm ưu tiên hàng đầu: {topTasks}.";
        }
    }
}
