using System;
using System.Collections.Generic;
using backend.Models;

namespace backend.Services.Knowledge
{
    /// <summary>
    /// Provides authoritative, validated evaluation blueprints across all supported sectors
    /// when no custom Job Description (JD) is provided, ensuring JD-independent evaluation.
    /// Supports: IT/Software, Data Analytics, BA, Product/Project, Marketing, Finance/Accounting, HR, and General Professional.
    /// </summary>
    public static class DomainCompetencyTemplateProvider
    {
        public static KnowledgeBlueprint GetTemplate(string position, string experienceLevel, string? jobFamily = null)
        {
            var safePos = string.IsNullOrWhiteSpace(position) ? ProfessionalDomainClassifier.DefaultPositionTitle : position.Trim();
            var safeLevel = string.IsNullOrWhiteSpace(experienceLevel) ? ProfessionalDomainClassifier.DefaultTargetLevel : experienceLevel.Trim();
            var family = !string.IsNullOrWhiteSpace(jobFamily) ? jobFamily : ProfessionalDomainClassifier.Classify(safePos);

            var blueprint = new KnowledgeBlueprint
            {
                Id = Guid.NewGuid().ToString(),
                Position = safePos,
                Level = safeLevel,
                Version = "1.0",
                Areas = BuildAreasForFamily(family, safeLevel)
            };

            return blueprint;
        }

        private static List<KnowledgeArea> BuildAreasForFamily(string family, string level)
        {
            return family switch
            {
                JobFamily.SOFTWARE_ENGINEERING => BuildSoftwareEngineeringAreas(level),
                JobFamily.DATA_ANALYTICS => BuildDataAnalyticsAreas(level),
                JobFamily.BUSINESS_ANALYSIS => BuildBusinessAnalysisAreas(level),
                JobFamily.PRODUCT_PROJECT => BuildProductProjectAreas(level),
                JobFamily.MARKETING_GROWTH => BuildMarketingGrowthAreas(level),
                JobFamily.FINANCE_ACCOUNTING => BuildFinanceAccountingAreas(level),
                JobFamily.HR_PEOPLE => BuildHrPeopleAreas(level),
                _ => BuildGeneralProfessionalAreas(level)
            };
        }

        private static List<KnowledgeArea> BuildSoftwareEngineeringAreas(string level)
        {
            return new List<KnowledgeArea>
            {
                new KnowledgeArea
                {
                    Name = "Kiến trúc & Thiết kế phần mềm (Architecture & System Design)",
                    Description = "Năng lực thiết kế cấu trúc module, nguyên lý hướng đối tượng/hướng dịch vụ, phân tách tầng và quản trị luồng dữ liệu.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "System Architecture", "API Design & Integration", "Design Patterns" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "system-architecture",
                            Name = "Kiến trúc hệ thống & Thiết kế Module",
                            ExpectedUnderstanding = new List<string> { "Hiểu rõ nguyên lý phân rã module, kiến trúc đa tầng (N-tier), Clean/Hexagonal Architecture và quản lý phụ thuộc (IoC/DI)." },
                            PracticalSignals = new List<string> { "Giải thích được trade-off khi tách service, cách xử lý kết nối dữ liệu và đảm bảo tính mở rộng." },
                            FailureSignals = new List<string> { "Tổ chức code lộn xộn, vi phạm nguyên lý đóng gói, phụ thuộc chéo khó bảo trì." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "api-design",
                            Name = "Thiết kế & Tích hợp API",
                            ExpectedUnderstanding = new List<string> { "Nắm vững chuẩn RESTful, idempotent HTTP methods, quản lý phiên bản (versioning) và xử lý lỗi chuẩn hoá." },
                            PracticalSignals = new List<string> { "Thiết kế API có hợp đồng dữ liệu rõ ràng, phân trang an toàn và mã trạng thái HTTP chuẩn mực." },
                            FailureSignals = new List<string> { "Dùng sai HTTP method, không xử lý validation lỗi hoặc lộ dữ liệu nhạy cảm." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Kỹ nghệ dữ liệu & Tối ưu hiệu năng (Data & Performance)",
                    Description = "Quản lý tương tác cơ sở dữ liệu, tối ưu truy vấn, lưu bộ nhớ đệm và tính toàn vẹn dữ liệu.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Database Persistence", "Caching & Concurrency" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "data-persistence",
                            Name = "Tương tác CSDL & Tối ưu truy vấn",
                            ExpectedUnderstanding = new List<string> { "Nguyên lý giao dịch ACID, cơ chế Indexing, quan hệ dữ liệu và phòng ngừa N+1 query." },
                            PracticalSignals = new List<string> { "Biết phân tích execution plan, áp dụng index đúng cột và tối ưu hóa câu lệnh query nặng." },
                            FailureSignals = new List<string> { "Không nắm được cơ chế transaction, index bừa bãi hoặc gây khóa deadlock." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "caching-concurrency",
                            Name = "Bộ nhớ đệm & Xử lý đồng thời (Caching & Concurrency)",
                            ExpectedUnderstanding = new List<string> { "Chiến lược cache (Cache-Aside, Write-Through), vô hiệu hóa cache (TTL, eviction) và đồng bộ luồng." },
                            PracticalSignals = new List<string> { "Phân biệt được cache phân tán (Redis) và in-memory cache, kiểm soát race conditions." },
                            FailureSignals = new List<string> { "Không tính đến cache stampede, stale data hoặc xung đột ghi đồng thời." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = false
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Chất lượng mã nguồn, Kiểm thử & Khắc phục sự cố (Quality & Debugging)",
                    Description = "Khả năng viết mã dễ kiểm thử, tự động hóa test, xử lý lỗi và điều tra sự cố vận hành.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Unit Testing & QA", "Debugging & Error Handling" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "testing-qa",
                            Name = "Kiểm thử tự động & Đảm bảo chất lượng",
                            ExpectedUnderstanding = new List<string> { "Viết unit test cách ly, mock/stub phụ thuộc, kiểm thử biên và nguyên tắc kim tự tháp kiểm thử." },
                            PracticalSignals = new List<string> { "Trình bày được cách thiết kế test case cho edge cases và tự động hóa kiểm thử trong CI/CD." },
                            FailureSignals = new List<string> { "Coi nhẹ kiểm thử, viết test phụ thuộc môi trường ngoài hoặc bỏ qua edge cases." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "debugging-troubleshooting",
                            Name = "Xử lý ngoại lệ & Truy vết sự cố (Troubleshooting)",
                            ExpectedUnderstanding = new List<string> { "Cơ chế quản lý exception tập trung, logging có cấu trúc, tracing và phân tích root cause." },
                            PracticalSignals = new List<string> { "Có phương pháp tiếp cận điều tra bug có hệ thống, dựa vào log/metrics thay vì đoán mò." },
                            FailureSignals = new List<string> { "Nuốt exception rỗng (catch-all swallow), log thiếu ngữ cảnh hoặc hoảng loạn khi hệ thống lỗi." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                }
            };
        }

        private static List<KnowledgeArea> BuildBusinessAnalysisAreas(string level)
        {
            return new List<KnowledgeArea>
            {
                new KnowledgeArea
                {
                    Name = "Khai thác & Quản lý yêu cầu (Requirements Engineering)",
                    Description = "Năng lực phỏng vấn các bên liên quan, làm rõ bài toán kinh doanh, viết User Story và định nghĩa tiêu chí chấp nhận (AC).",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Requirements Elicitation", "User Story & Acceptance Criteria", "Scope Management" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "requirements-elicitation",
                            Name = "Khai thác & Phân tích yêu cầu (Elicitation)",
                            ExpectedUnderstanding = new List<string> { "Kỹ thuật phỏng vấn, workshop, đặt câu hỏi đào sâu nguyên nhân gốc rễ (5 Whys), phân biệt Need vs Want." },
                            PracticalSignals = new List<string> { "Biết cách làm việc với stakeholder không am hiểu kỹ thuật để mô tả chính xác yêu cầu cốt lõi." },
                            FailureSignals = new List<string> { "Chỉ ghi chép thụ động yêu cầu của khách hàng mà không phân tích tính khả thi và logic nghiệp vụ." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "user-story-acceptance-criteria",
                            Name = "Mô tả User Story & Tiêu chí nghiệm thu (Given-When-Then)",
                            ExpectedUnderstanding = new List<string> { "Cấu trúc User Story chuẩn INVEST, tiêu chí nghiệm thu rõ ràng, tránh mơ hồ và đo lường được." },
                            PracticalSignals = new List<string> { "Viết Acceptance Criteria chi tiết, bao quát cả happy path và edge cases / exception flows." },
                            FailureSignals = new List<string> { "Viết User Story quá lớn (Epic chưa chẻ), thiếu điều kiện biên, tạo mơ hồ cho đội ngũ phát triển." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Mô hình hóa quy trình & Phân tích giải pháp (Process Modeling & Solution)",
                    Description = "Vẽ sơ đồ luồng nghiệp vụ (BPMN/UML), phân tích khoảng cách (Gap Analysis) và đánh giá tác động.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Business Process Modeling", "Gap Analysis & Impact Assessment" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "process-modeling",
                            Name = "Mô hình hóa quy trình (BPMN, Flowchart)",
                            ExpectedUnderstanding = new List<string> { "Kỹ thuật vẽ luồng As-Is và To-Be, swimlanes, các điểm quyết định và luồng rẽ nhánh." },
                            PracticalSignals = new List<string> { "Minh họa được quy trình vận hành phức tạp thành sơ đồ trực quan, dễ hiểu cho cả dev và business." },
                            FailureSignals = new List<string> { "Nhầm lẫn ký hiệu luồng, bỏ sót luồng hoàn tác/ngoại lệ hoặc tạo sơ đồ bế tắc." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "gap-analysis",
                            Name = "Phân tích khoảng cách & Đánh giá tác động (Gap Analysis)",
                            ExpectedUnderstanding = new List<string> { "So sánh hiện trạng và mục tiêu tương lai, nhận diện khoảng cách tính năng và rủi ro thay đổi." },
                            PracticalSignals = new List<string> { "Đưa ra khuyến nghị giải pháp khả thi có đối chiếu chi phí và tác động đến các hệ thống liên quan." },
                            FailureSignals = new List<string> { "Đề xuất giải pháp nóng vội mà không đánh giá tác động đến các quy trình hoặc bộ phận liên đới." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = false
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Quản lý bên liên quan & Nghiệm thu (Stakeholder & UAT)",
                    Description = "Quản lý kỳ vọng, giải quyết xung đột yêu cầu và điều phối kiểm thử chấp nhận người dùng.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Stakeholder Alignment", "UAT Planning & Execution" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "stakeholder-alignment",
                            Name = "Quản lý kỳ vọng & Xử lý xung đột yêu cầu",
                            ExpectedUnderstanding = new List<string> { "Ma trận stakeholder, nghệ thuật đàm phán phạm vi (Scope negotiation) và chốt quyết định." },
                            PracticalSignals = new List<string> { "Dẫn dắt các buổi thống nhất yêu cầu khi các phòng ban có mục tiêu mâu thuẫn nhau." },
                            FailureSignals = new List<string> { "Hứa hẹn vượt quá năng lực (over-promising), né tránh xung đột hoặc làm hài lòng một bên gây hại dự án." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "uat-validation",
                            Name = "Kế hoạch & Điều phối kiểm thử chấp nhận (UAT)",
                            ExpectedUnderstanding = new List<string> { "Xây dựng kịch bản UAT sát thực tế kinh doanh, quản lý phản hồi và tiêu chí go-live." },
                            PracticalSignals = new List<string> { "Hỗ trợ người dùng đầu cuối test quy trình thông suốt và phân loại bug/change request minh bạch." },
                            FailureSignals = new List<string> { "Đẩy thẳng tính năng cho người dùng mà không có kịch bản test hoặc buông lỏng tiêu chí nghiệm thu." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                }
            };
        }

        private static List<KnowledgeArea> BuildMarketingGrowthAreas(string level)
        {
            return new List<KnowledgeArea>
            {
                new KnowledgeArea
                {
                    Name = "Chiến lược tiếp thị & Tăng trưởng kênh (Marketing Strategy & Growth Channels)",
                    Description = "Hoạch định chiến dịch đa kênh, phân bổ ngân sách, tối ưu hóa các kênh chuyển đổi (Paid, Organic, Social).",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Channel Strategy", "Campaign Planning & Budgeting" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "channel-strategy",
                            Name = "Chiến lược kênh tiếp thị & Tối ưu phễu",
                            ExpectedUnderstanding = new List<string> { "Mô hình phễu chuyển đổi (AARRR, TOFU-MOFU-BOFU), đặc thù từng kênh và phối hợp đa kênh." },
                            PracticalSignals = new List<string> { "Lựa chọn kênh tiếp cận phù hợp chân dung khách hàng mục tiêu với chi phí tối ưu." },
                            FailureSignals = new List<string> { "Đốt tiền quảng cáo dàn trải mà không có chiến lược phễu hoặc phân loại đối tượng." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "campaign-execution",
                            Name = "Lập kế hoạch & Thực thi chiến dịch",
                            ExpectedUnderstanding = new List<string> { "Timeline triển khai chiến dịch, thông điệp chủ đạo (Key Message), KPIs và kế hoạch dự phòng." },
                            PracticalSignals = new List<string> { "Điều phối chiến dịch nhịp nhàng, đo lường tiến độ và phản ứng nhanh với biến động thị trường." },
                            FailureSignals = new List<string> { "Kế hoạch mơ hồ không có chỉ số đo lường, thông điệp rời rạc hoặc trễ tiến độ liên tục." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Phân tích số liệu & Đo lường hiệu quả (Data Analytics & Performance)",
                    Description = "Phân tích các chỉ số hiệu quả (CAC, LTV, ROI, ROAS, CR), A/B testing và ra quyết định dựa trên dữ liệu.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Unit Economics", "A/B Testing & Attribution" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "unit-economics",
                            Name = "Hiệu quả kinh tế đơn vị (CAC, LTV, ROAS, ROI)",
                            ExpectedUnderstanding = new List<string> { "Công thức tính và ý nghĩa của Customer Acquisition Cost, Lifetime Value, Payback Period và Return on Ad Spend." },
                            PracticalSignals = new List<string> { "Đánh giá được tính lành mạnh của chiến dịch dựa trên tỷ lệ LTV/CAC và điểm hòa vốn." },
                            FailureSignals = new List<string> { "Nhầm lẫn giữa doanh thu thuần và lợi nhuận, khoe số liệu ảo (vanity metrics) như view/like mà không ra đơn." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "ab-testing-optimization",
                            Name = "Thử nghiệm A/B & Tối ưu tỷ lệ chuyển đổi (CRO)",
                            ExpectedUnderstanding = new List<string> { "Phương pháp kiểm định giả thuyết, cỡ mẫu thống kê, tối ưu trang đích và hành vi người dùng." },
                            PracticalSignals = new List<string> { "Thiết kế bài kiểm tra có đối chứng rõ ràng và đưa ra kết luận có ý nghĩa thống kê." },
                            FailureSignals = new List<string> { "Kết luận vội vàng dựa trên dữ liệu quá nhỏ hoặc thay đổi nhiều biến số cùng lúc gây nhiễu kết quả." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Thương hiệu, Nội dung & Nghiên cứu khách hàng (Brand & Customer Insights)",
                    Description = "Xây dựng chân dung khách hàng, thấu hiểu tâm lý hành vi (Insights) và định vị thương hiệu nhất quán.",
                    Importance = AreaImportance.MEDIUM,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Customer Persona & Research", "Brand Positioning & Content" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "customer-insights",
                            Name = "Nghiên cứu khách hàng & Điểm đau (Pain Points)",
                            ExpectedUnderstanding = new List<string> { "Phương pháp phỏng vấn người dùng, khảo sát thị trường, thấu hiểu động cơ mua hàng và rào cản tâm lý." },
                            PracticalSignals = new List<string> { "Biết biến dữ liệu nghiên cứu khách hàng thành thông điệp giải quyết đúng nỗi đau của người dùng." },
                            FailureSignals = new List<string> { "Tự suy diễn chủ quan về khách hàng mà không có nghiên cứu hoặc dữ liệu thực tế chứng minh." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                }
            };
        }

        private static List<KnowledgeArea> BuildFinanceAccountingAreas(string level)
        {
            return new List<KnowledgeArea>
            {
                new KnowledgeArea
                {
                    Name = "Báo cáo tài chính & Kế toán chuẩn mực (Financial Reporting & Standards)",
                    Description = "Lập và phân tích bảng cân đối kế toán, báo cáo kết quả kinh doanh, báo cáo lưu chuyển tiền tệ theo chuẩn VAS/IFRS.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Financial Statements", "Accounting Standards Compliance" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "financial-statements",
                            Name = "Hệ thống Báo cáo tài chính & Đối chiếu",
                            ExpectedUnderstanding = new List<string> { "Mối quan hệ chặt chẽ giữa 3 báo cáo (P&L, Balance Sheet, Cash Flow), nguyên tắc dồn tích và ghi nhận doanh thu." },
                            PracticalSignals = new List<string> { "Phát hiện được sai lệch số dư, đọc hiểu luồng tiền hoạt động kinh doanh (Operating Cash Flow) thực tế." },
                            FailureSignals = new List<string> { "Nhầm lẫn giữa lợi nhuận kế toán và dòng tiền thực thu, không đối chiếu được sai lệch số dư." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "accounting-standards",
                            Name = "Tuân thủ Chuẩn mực Kế toán & Thuế",
                            ExpectedUnderstanding = new List<string> { "Chuẩn mực kế toán hiện hành, quy định hóa đơn chứng từ, thuế GTGT, TNDN và TNCN." },
                            PracticalSignals = new List<string> { "Áp dụng đúng quy định ghi nhận chi phí hợp lý hợp lệ, phòng ngừa rủi ro thanh tra thuế." },
                            FailureSignals = new List<string> { "Hiểu sai quy định khấu trừ thuế, đưa chi phí không hợp lệ vào sổ sách gây rủi ro pháp lý." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Phân tích tài chính & Dự báo ngân sách (Financial Planning & Analysis - FP&A)",
                    Description = "Lập mô hình tài chính, phân tích chỉ số biến động (Variance Analysis), dự phóng dòng tiền và quản trị chi phí.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Budgeting & Forecasting", "Financial Ratio Analysis" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "budgeting-forecasting",
                            Name = "Lập ngân sách & Dự báo dòng tiền (Forecasting)",
                            ExpectedUnderstanding = new List<string> { "Quy trình lập ngân sách hàng năm, dự báo cuốn chiếu (Rolling Forecast), phân tích Actual vs Budget." },
                            PracticalSignals = new List<string> { "Đưa ra kịch bản dòng tiền (Best, Base, Worst case) giúp ban giám đốc chủ động nguồn vốn." },
                            FailureSignals = new List<string> { "Dự báo cơ học chỉ cộng trừ số cũ mà không gắn liền với kế hoạch vận hành và biến động vĩ mô." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "financial-ratios",
                            Name = "Phân tích chỉ số tài chính & Hiệu quả hoạt động",
                            ExpectedUnderstanding = new List<string> { "Các nhóm chỉ số sinh lời (ROS, ROE, ROA), thanh khoản (Current, Quick), đòn bẩy nợ và vòng quay vốn." },
                            PracticalSignals = new List<string> { "Chỉ ra được nguyên nhân đằng sau sự sụt giảm biên lợi nhuận hoặc ứ đọng vốn lưu động." },
                            FailureSignals = new List<string> { "Thuộc vẹt công thức nhưng không diễn giải được ý nghĩa kinh doanh hoặc đưa ra khuyến nghị rỗng." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Kiểm soát nội bộ & Quản trị rủi ro tài chính (Internal Controls & Risk Management)",
                    Description = "Thiết lập quy trình kiểm soát nội bộ, phân quyền duyệt chi, phát hiện gian lận và quản lý rủi ro tín dụng/tỷ giá.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Internal Control System", "Financial Risk Mitigation" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "internal-controls",
                            Name = "Hệ thống kiểm soát nội bộ & Phòng ngừa gian lận",
                            ExpectedUnderstanding = new List<string> { "Nguyên tắc bất kiêm nhiệm (Segregation of Duties), quy trình phê duyệt thanh toán và bảo vệ tài sản." },
                            PracticalSignals = new List<string> { "Nhận diện được kẽ hở trong quy trình duyệt chi và đề xuất chốt chặn kiểm soát hiệu quả." },
                            FailureSignals = new List<string> { "Buông lỏng kiểm soát, thiếu đối chiếu chéo tạo lỗ hổng cho thất thoát tài sản doanh nghiệp." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                }
            };
        }

        private static List<KnowledgeArea> BuildHrPeopleAreas(string level)
        {
            return new List<KnowledgeArea>
            {
                new KnowledgeArea
                {
                    Name = "Thu hút & Tuyển chọn nhân tài (Talent Acquisition & Sourcing)",
                    Description = "Hoạch định nguồn nhân lực, tạo nguồn ứng viên (sourcing), phỏng vấn theo khung năng lực và tối ưu trải nghiệm ứng viên.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Talent Sourcing Strategy", "Competency-based Interviewing" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "talent-sourcing",
                            Name = "Chiến lược tạo nguồn & Tuyển dụng (Sourcing & Pipeline)",
                            ExpectedUnderstanding = new List<string> { "Đa dạng hóa kênh tuyển dụng, xây dựng talent pool, tối ưu Time-to-Hire và Cost-per-Hire." },
                            PracticalSignals = new List<string> { "Chủ động tiếp cận nhân tài qua mạng lưới chuyên nghiệp, không chỉ phụ thuộc vào đăng tin thụ động." },
                            FailureSignals = new List<string> { "Đăng tin chờ ứng viên nộp CV, không theo dõi số liệu phễu tuyển dụng dẫn đến hụt kế hoạch nhân sự." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "competency-interviewing",
                            Name = "Phỏng vấn theo khung năng lực & Kỹ thuật STAR",
                            ExpectedUnderstanding = new List<string> { "Kỹ thuật phỏng vấn hành vi (Behavioral Event Interviewing), chấm điểm theo rubric khách quan, tránh thiên vị." },
                            PracticalSignals = new List<string> { "Đặt câu hỏi đào sâu bằng chứng thực tế, phát hiện được ứng viên nói quá sự thật về năng lực." },
                            FailureSignals = new List<string> { "Đánh giá cảm tính bằng 'trực giác', hỏi câu hỏi mẹo hoặc không bám sát yêu cầu công việc." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Chính sách nhân sự, Đãi ngộ & Pháp luật lao động (C&B and Labor Law)",
                    Description = "Xây dựng hệ thống lương thưởng, phúc lợi (Total Rewards), hợp đồng lao động và tuân thủ Luật Lao động hiện hành.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Labor Code Compliance", "Compensation & Benefits (C&B)" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "labor-law-compliance",
                            Name = "Tuân thủ Bộ luật Lao động & Quan hệ lao động",
                            ExpectedUnderstanding = new List<string> { "Quy định thử việc, chấm dứt hợp đồng, xử lý kỷ luật lao động, tranh chấp lao động và chế độ bảo hiểm." },
                            PracticalSignals = new List<string> { "Tư vấn phương án giải quyết tranh chấp hoặc thôi việc đúng luật, bảo vệ uy tín và pháp lý doanh nghiệp." },
                            FailureSignals = new List<string> { "Sa thải sai quy trình, làm trái luật lao động đẩy công ty vào nguy cơ kiện tụng bồi thường." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "compensation-benefits",
                            Name = "Cơ cấu Lương thưởng & Đãi ngộ (Total Rewards)",
                            ExpectedUnderstanding = new List<string> { "Cấu trúc lương 3P, khảo sát thị trường lương, chính sách incentive gắn với hiệu suất kinh doanh." },
                            PracticalSignals = new List<string> { "Thiết kế gói đãi ngộ cạnh tranh có tính công bằng nội bộ và phù hợp ngân sách doanh nghiệp." },
                            FailureSignals = new List<string> { "Xếp bậc lương tùy tiện gây bức xúc nội bộ hoặc xây dựng chính sách thưởng không có nguồn chi trả." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Quản trị hiệu suất & Văn hóa doanh nghiệp (Performance & Engagement)",
                    Description = "Thiết lập mục tiêu và đo lường (OKR/KPI), đánh giá hiệu suất định kỳ, phát triển nhân viên và giữ chân nhân tài.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Performance Management (OKR/KPI)", "Employee Retention & Culture" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "performance-management",
                            Name = "Quản trị hiệu suất liên tục (Continuous Performance Management)",
                            ExpectedUnderstanding = new List<string> { "Chu trình quản trị hiệu suất, phản hồi 1-on-1, kế hoạch cải thiện hiệu suất (PIP) và gắn kết mục tiêu." },
                            PracticalSignals = new List<string> { "Hỗ trợ line managers thực hiện các buổi đối thoại hiệu suất mang tính xây dựng, rõ ràng mục tiêu." },
                            FailureSignals = new List<string> { "Đánh giá hình thức vào cuối năm, cào bằng kết quả hoặc không giải quyết nhân viên làm việc kém." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                }
            };
        }

        private static List<KnowledgeArea> BuildDataAnalyticsAreas(string level)
        {
            return new List<KnowledgeArea>
            {
                new KnowledgeArea
                {
                    Name = "Truy vấn & Xử lý dữ liệu (SQL & Data Wrangling)",
                    Description = "Kỹ năng viết truy vấn SQL phức tạp, xử lý dữ liệu khuyết thiếu, làm sạch và chuẩn hóa dữ liệu phục vụ phân tích.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Advanced SQL", "Data Cleansing & Transformation" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "advanced-sql",
                            Name = "Truy vấn SQL nâng cao & Xử lý tập dữ liệu lớn",
                            ExpectedUnderstanding = new List<string> { "Window functions, Common Table Expressions (CTEs), phép JOINs tối ưu, Aggregations và Subqueries." },
                            PracticalSignals = new List<string> { "Viết query rõ ràng, tối ưu tốc độ xử lý trên bảng dữ liệu lớn, tránh full table scan." },
                            FailureSignals = new List<string> { "Không nắm vững window functions, viết query lặp lại hoặc tính toán sai số liệu do duplicate rows." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "data-transformation",
                            Name = "Làm sạch, Chuẩn hóa & Kiểm tra chất lượng dữ liệu",
                            ExpectedUnderstanding = new List<string> { "Xử lý missing values, outliers, ép kiểu dữ liệu và kiểm thử tính toàn vẹn (data integrity)." },
                            PracticalSignals = new List<string> { "Tự động hóa pipeline kiểm tra dữ liệu đầu vào trước khi tổng hợp số liệu báo cáo." },
                            FailureSignals = new List<string> { "Sử dụng dữ liệu bẩn để tính toán dẫn đến sai lệch kết quả mà không phát hiện được." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Trực quan hóa & Báo cáo thông minh (Data Visualization & BI)",
                    Description = "Thiết kế Dashboard trực quan (Power BI, Tableau), chọn đúng loại biểu đồ và truyền đạt thông điệp số liệu.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Dashboard Design", "Data Storytelling" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "dashboard-bi",
                            Name = "Thiết kế Dashboard & Trực quan hóa dữ liệu",
                            ExpectedUnderstanding = new List<string> { "Nguyên lý thiết kế UI cho dữ liệu, lựa chọn biểu đồ đúng bản chất, tổ chức layout theo thói quen người dùng." },
                            PracticalSignals = new List<string> { "Xây dựng dashboard trực quan, giúp người ra quyết định nắm bắt vấn đề kinh doanh trong 30 giây." },
                            FailureSignals = new List<string> { "Dồn quá nhiều biểu đồ rối mắt, dùng sai loại đồ thị gây hiểu nhầm xu hướng số liệu." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Tư duy phân tích nghiệp vụ & Kiểm định giả thuyết (Business Insights & Hypothesis Testing)",
                    Description = "Chuyển đổi bài toán kinh doanh thành câu hỏi phân tích, tìm kiếm nguyên nhân gốc rễ và đưa ra khuyến nghị thực tế.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Hypothesis-driven Analysis", "Actionable Business Recommendations" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "business-insights",
                            Name = "Tư duy phân tích nguyên nhân gốc rễ & Khuyến nghị hành động",
                            ExpectedUnderstanding = new List<string> { "Phân tích đào sâu (Drill-down), phân tích nhóm thuần tập (Cohort Analysis), đối chiếu tương quan và nhân quả." },
                            PracticalSignals = new List<string> { "Từ số liệu chỉ ra được nguyên nhân tăng giảm doanh số/khách hàng và đề xuất hành động cụ thể." },
                            FailureSignals = new List<string> { "Chỉ mô tả lại số liệu ('tháng này giảm 10%') mà không trả lời được câu hỏi 'Tại sao giảm?' và 'Phải làm gì?'." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                }
            };
        }

        private static List<KnowledgeArea> BuildProductProjectAreas(string level)
        {
            return new List<KnowledgeArea>
            {
                new KnowledgeArea
                {
                    Name = "Chiến lược sản phẩm & Quản lý Backlog (Product Strategy & Backlog)",
                    Description = "Xây dựng Product Vision, Roadmap, ưu tiên hóa tính năng (RICE/MoSCoW) và quản trị vòng đời sản phẩm.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Product Roadmap & Vision", "Feature Prioritization" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "product-prioritization",
                            Name = "Ưu tiên hóa tính năng & Quản lý Backlog",
                            ExpectedUnderstanding = new List<string> { "Khung ưu tiên (RICE, WSJF, MoSCoW), cân bằng giữa Giá trị kinh doanh (Value), Chi phí (Cost) và Khả thi (Feasibility)." },
                            PracticalSignals = new List<string> { "Giải thích thuyết phục lý do chọn làm tính năng A trước tính năng B dựa trên dữ liệu và mục tiêu chiến lược." },
                            FailureSignals = new List<string> { "Làm theo ý kiến chủ quan của người có tiếng nói to nhất (HiPPO) mà không có khung đánh giá logic." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Thực thi dự án & Phương pháp Agile/Scrum (Execution & Delivery)",
                    Description = "Vận hành Sprint, quản trị tiến độ, loại bỏ rào cản (impediments), quản trị rủi ro và cam kết bàn giao.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Sprint Planning & Execution", "Risk & Dependency Management" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "agile-delivery",
                            Name = "Vận hành dự án Agile/Scrum & Quản lý tiến độ",
                            ExpectedUnderstanding = new List<string> { "Nghi thức Scrum (Daily, Refinement, Demo, Retro), đo lường vận tốc (Velocity) và kiểm soát phạm vi." },
                            PracticalSignals = new List<string> { "Chủ động nhận diện phụ thuộc giữa các team và tháo gỡ điểm nghẽn giúp team bàn giao đúng hạn." },
                            FailureSignals = new List<string> { "Áp dụng Scrum hình thức, để xảy ra trễ hạn bất ngờ vào cuối sprint mà không có cảnh báo sớm." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                }
            };
        }

        private static List<KnowledgeArea> BuildGeneralProfessionalAreas(string level)
        {
            return new List<KnowledgeArea>
            {
                new KnowledgeArea
                {
                    Name = "Năng lực chuyên môn cốt lõi (Core Professional Competency)",
                    Description = "Hiểu biết bản chất lĩnh vực chuyên môn, nắm vững phương pháp luận và quy trình thực hiện công việc chuẩn mực.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Core Domain Principles", "Methodology & Best Practices" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "domain-fundamentals",
                            Name = "Nguyên lý & Phương pháp luận chuyên môn cốt lõi",
                            ExpectedUnderstanding = new List<string> { "Nắm vững nguyên tắc nền tảng, thuật ngữ và tiêu chuẩn thực hành của ngành nghề ứng tuyển." },
                            PracticalSignals = new List<string> { "Áp dụng đúng phương pháp chuẩn mực vào xử lý bài toán công việc, giải thích được tính hợp lý của lựa chọn." },
                            FailureSignals = new List<string> { "Hiểu sai khái niệm cơ bản, làm theo thói quen cảm tính không có cơ sở phương pháp luận." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        },
                        new BlueprintConcept
                        {
                            Id = "problem-solving-execution",
                            Name = "Kỹ năng giải quyết vấn đề & Thực thi công việc",
                            ExpectedUnderstanding = new List<string> { "Tư duy phân tích có cấu trúc, phân rã vấn đề phức tạp, xác định nguyên nhân và thực thi giải pháp." },
                            PracticalSignals = new List<string> { "Đưa ra giải pháp khả thi trong điều kiện nguồn lực hữu hạn, có đo lường kết quả thực tế." },
                            FailureSignals = new List<string> { "Đưa ra giải pháp chung chung không thể thực thi hoặc né tránh trách nhiệm khi gặp khó khăn." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                },
                new KnowledgeArea
                {
                    Name = "Quản lý công việc & Hợp tác đa chức năng (Work Management & Collaboration)",
                    Description = "Lập kế hoạch công việc, quản lý thời gian, giao tiếp hiệu quả và phối hợp nhịp nhàng với đồng nghiệp.",
                    Importance = AreaImportance.HIGH,
                    RequiredLevel = level,
                    Competencies = new List<string> { "Task Planning & Prioritization", "Cross-functional Collaboration" },
                    Concepts = new List<BlueprintConcept>
                    {
                        new BlueprintConcept
                        {
                            Id = "collaboration-communication",
                            Name = "Hợp tác & Giao tiếp trong công việc",
                            ExpectedUnderstanding = new List<string> { "Truyền đạt thông điệp rõ ràng, lắng nghe tích cực, xây dựng sự tin cậy và phối hợp đa phòng ban." },
                            PracticalSignals = new List<string> { "Chủ động cập nhật tiến độ, minh bạch thông tin và phối hợp giải quyết xung đột có văn hóa." },
                            FailureSignals = new List<string> { "Làm việc độc lập kiểu ốc đảo (silo), đổ lỗi cho bộ phận khác hoặc giao tiếp gây hiểu lầm." },
                            RequirementSource = RequirementSource.OFFICIAL,
                            IsMandatory = true
                        }
                    }
                }
            };
        }
    }
}
