using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace backend.Models
{
    // =========================================================================
    // PHASE 5 STEP 5: REALISTIC MULTI-INDUSTRY INTERVIEW SCENARIOS & BEHAVIOR
    // =========================================================================

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ScenarioState
    {
        INITIAL,
        INVESTIGATING,
        NEW_INFORMATION_REVEALED,
        DECISION_REQUIRED,
        CHALLENGE,
        RESOLUTION,
        COMPLETED
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum InterviewerBehaviorType
    {
        NEUTRAL,
        PROBING,
        SKEPTICAL,
        PRESSURE,
        SUPPORTIVE
    }

    /// <summary>
    /// Represents a discrete piece of scenario information.
    /// Distinguishes directly available context from unknown facts requiring candidate investigation.
    /// </summary>
    public class ScenarioFactItem
    {
        public string Key { get; set; } = string.Empty;
        public string Category { get; set; } = "General"; // Metrics, Architecture, Business, Constraints, Timeline, Policy
        public string Fact { get; set; } = string.Empty;
        public bool IsDirectlyAvailable { get; set; } = false;
        public bool IsRevealed { get; set; } = false;
        public List<string> TriggerKeywords { get; set; } = new();
    }

    /// <summary>
    /// Records candidate decisions, trade-offs identified, and defenses during scenario progression.
    /// </summary>
    public class ScenarioCandidateDecision
    {
        public int Turn { get; set; }
        public string DecisionSummary { get; set; } = string.Empty;
        public string TradeOffIdentified { get; set; } = string.Empty;
        public string RiskIdentified { get; set; } = string.Empty;
        public string Rationale { get; set; } = string.Empty;
        public bool IsChallenged { get; set; } = false;
        public string? DefenseResponse { get; set; }
    }

    /// <summary>
    /// Multi-Industry Realistic Scenario Blueprint.
    /// Provides context, problem, constraints, information boundaries, and deterministic state evolution.
    /// Invariant: Gemini CANNOT create new facts or decide scenario state.
    /// Invariant: Behavior profile alters only interviewer interaction style, NEVER candidate evaluation scores.
    /// </summary>
    public class InterviewScenario
    {
        public string ScenarioId { get; set; } = Guid.NewGuid().ToString();
        public string Title { get; set; } = string.Empty;
        public string Industry { get; set; } = "General";
        public string JobFamily { get; set; } = "General";
        public string Role { get; set; } = "Professional";
        public string Seniority { get; set; } = "Mid";
        public string Objective { get; set; } = string.Empty;

        // Context + Problem + Constraints + Trade-off
        public string Context { get; set; } = string.Empty;
        public string Problem { get; set; } = string.Empty;
        public string InitialConstraint { get; set; } = string.Empty;
        public List<string> Constraints { get; set; } = new();
        public List<string> Competencies { get; set; } = new();
        public InterviewDifficultyLevel Difficulty { get; set; } = InterviewDifficultyLevel.STANDARD;
        public string ExpectedDecisionType { get; set; } = "TradeOffResolution";

        // Information Boundary
        public List<ScenarioFactItem> AvailableInformation { get; set; } = new();
        public List<ScenarioFactItem> UnknownInformation { get; set; } = new();

        // Deterministic State & Behavior
        public ScenarioState State { get; set; } = ScenarioState.INITIAL;
        public InterviewerBehaviorType Behavior { get; set; } = InterviewerBehaviorType.NEUTRAL;
        public List<ScenarioCandidateDecision> Decisions { get; set; } = new();
        public List<string> RevealedFactKeys { get; set; } = new();
        public List<string> HistoryLog { get; set; } = new();

        // =====================================================================
        // MULTI-INDUSTRY FACTORY METHODS
        // =====================================================================

        public static InterviewScenario CreateSoftwareIncidentScenario(string seniority = "Senior")
        {
            return new InterviewScenario
            {
                Title = "Xử lý sự cố tăng đột biến độ trễ thanh toán trong giờ cao điểm",
                Industry = "Technology",
                JobFamily = "Software Engineering",
                Role = "Backend Engineer",
                Seniority = seniority,
                Objective = "Đánh giá khả năng điều tra nguyên nhân gốc rễ, xử lý sự cố hệ thống phân tán và cân nhắc trade-off giữa khôi phục nhanh và cam kết đối tác.",
                Context = "Hệ thống thanh toán cốt lõi đang xử lý 15,000 giao dịch/giây trong đợt khuyến mãi lớn. Đột ngột số lượng cảnh báo timeout tăng vọt.",
                Problem = "P99 latency tăng từ 120ms lên 3.2s, gây lỗi HTTP 504 Gateway Timeout cho 12% giao dịch của khách hàng.",
                InitialConstraint = "Yêu cầu tuyệt đối không downtime toàn hệ thống; SLA cam kết 99.9%; không làm mất dữ liệu giao dịch đã trừ tiền.",
                Constraints = new List<string>
                {
                    "Không được tắt toàn bộ hệ thống (zero downtime)",
                    "Thời gian phản hồi P99 phải dưới 200ms",
                    "Bản deploy mới v2.4 có tính năng đối soát mới ký kết với đối tác chiến lược"
                },
                Competencies = new List<string> { "Problem Solving", "System Architecture", "Risk Awareness", "Trade-Off", "Decision Quality" },
                Difficulty = seniority.Equals("Lead", StringComparison.OrdinalIgnoreCase) || seniority.Equals("Senior", StringComparison.OrdinalIgnoreCase)
                    ? InterviewDifficultyLevel.CHALLENGING
                    : InterviewDifficultyLevel.ADVANCED,
                ExpectedDecisionType = "IncidentMitigationAndTradeOff",
                AvailableInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "traffic_metrics",
                        Category = "Metrics",
                        Fact = "Lưu lượng giao dịch tăng 25% so với ngày thường nhưng vẫn nằm trong ngưỡng dự phòng của hạ tầng gateway.",
                        IsDirectlyAvailable = true,
                        IsRevealed = true
                    },
                    new ScenarioFactItem
                    {
                        Key = "gateway_logs",
                        Category = "Architecture",
                        Fact = "API Gateway ghi nhận lỗi 504 tập trung tại route /v1/payments/process khi gọi sang payment-core service.",
                        IsDirectlyAvailable = true,
                        IsRevealed = true
                    }
                },
                UnknownInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "db_cpu_and_pool",
                        Category = "Metrics",
                        Fact = "Database cluster CPU chạm 94%, connection pool bị cạn kiệt do nhiều transaction bị giữ lâu bởi slow query.",
                        TriggerKeywords = new List<string> { "database", "db", "cpu", "connection", "query", "cơ sở dữ liệu", "pool" }
                    },
                    new ScenarioFactItem
                    {
                        Key = "deploy_changelog",
                        Category = "Timeline",
                        Fact = "Bản deploy v2.4 cách đây 45 phút bổ sung query tổng hợp điểm tích lũy real-time nhưng chưa được đánh composite index.",
                        TriggerKeywords = new List<string> { "deploy", "release", "commit", "phiên bản", "thay đổi", "changelog", "vừa cập nhật", "triển khai" }
                    },
                    new ScenarioFactItem
                    {
                        Key = "downstream_partner_status",
                        Category = "Business",
                        Fact = "Cổng thanh toán ngân hàng đối tác bên thứ ba (Acquirer) vẫn phản hồi bình thường với latency trung bình 110ms.",
                        TriggerKeywords = new List<string> { "đối tác", "bên thứ ba", "third party", "ngân hàng", "acquirer", "gateway ngoài" }
                    }
                }
            };
        }

        public static InterviewScenario CreateSalesNegotiationScenario(string seniority = "Senior")
        {
            return new InterviewScenario
            {
                Title = "Đàm phán gia hạn hợp đồng doanh nghiệp lớn trước áp lực giảm giá đối thủ",
                Industry = "Sales",
                JobFamily = "Commercial & Sales",
                Role = "Enterprise Account Executive",
                Seniority = seniority,
                Objective = "Đánh giá năng lực đàm phán giá trị (value-based selling), bảo vệ biên lợi nhuận và kiểm soát rủi ro mất khách hàng chiến lược.",
                Context = "Khách hàng doanh nghiệp đóng góp 18% doanh thu năm của công ty đang đến hạn tái ký hợp đồng dịch vụ hàng năm.",
                Problem = "Đối thủ cạnh tranh mới chào giá thấp hơn 30% với danh mục tính năng tương đương trên tài liệu; Giám đốc mua hàng yêu cầu giảm giá 25% hoặc sẽ chấm dứt hợp tác.",
                InitialConstraint = "Biên lợi nhuận gộp (Gross Margin) của công ty không được giảm dưới 45%; Hạn chót tái ký trong 7 ngày tới.",
                Constraints = new List<string>
                {
                    "Không giảm giá thuần túy quá 10% nếu không cắt giảm phạm vi dịch vụ",
                    "Giữ vững cam kết SLA hỗ trợ 24/7",
                    "Thời hạn ký gia hạn hợp đồng trước khi kết thúc quý"
                },
                Competencies = new List<string> { "Negotiation", "Value Selling", "Relationship Management", "Decision Quality", "Trade-Off" },
                Difficulty = InterviewDifficultyLevel.ADVANCED,
                ExpectedDecisionType = "ValueRestructuringAndNegotiation",
                AvailableInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "contract_tenure",
                        Category = "Business",
                        Fact = "Khách hàng đã đồng hành 3 năm liên tiếp, đội ngũ nhân viên rất quen thuộc với phần mềm hiện tại.",
                        IsDirectlyAvailable = true,
                        IsRevealed = true
                    },
                    new ScenarioFactItem
                    {
                        Key = "competitor_offer",
                        Category = "Business",
                        Fact = "Đối thủ chào giá thấp hơn 30% cho gói thuê bao cơ bản nhưng tính phí rất cao cho dịch vụ di chuyển dữ liệu và hỗ trợ kỹ thuật.",
                        IsDirectlyAvailable = true,
                        IsRevealed = true
                    }
                },
                UnknownInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "customer_internal_usage",
                        Category = "Metrics",
                        Fact = "Dữ liệu sử dụng thực tế cho thấy khách hàng chỉ dùng 60% tính năng nâng cao trong gói dịch vụ hiện tại.",
                        TriggerKeywords = new List<string> { "sử dụng", "usage", "tính năng", "thực tế", "thống kê", "quota" }
                    },
                    new ScenarioFactItem
                    {
                        Key = "switching_cost_barrier",
                        Category = "Business",
                        Fact = "Trưởng phòng vận hành của khách hàng e ngại chi phí đào tạo lại hơn 200 nhân sự và rủi ro gián đoạn công việc nếu chuyển sang phần mềm mới.",
                        TriggerKeywords = new List<string> { "chi phí chuyển đổi", "đào tạo", "vận hành", "khó khăn", "chuyển đổi", "switching cost" }
                    }
                }
            };
        }

        public static InterviewScenario CreateMarketingCampaignScenario(string seniority = "Mid")
        {
            return new InterviewScenario
            {
                Title = "Tối ưu hóa chiến dịch tăng trưởng khi lưu lượng tăng nhưng tỷ lệ chuyển đổi giảm sâu",
                Industry = "Marketing",
                JobFamily = "Growth & Marketing",
                Role = "Growth Marketing Specialist",
                Seniority = seniority,
                Objective = "Đánh giá tư duy phân tích phễu chuyển đổi, khả năng xác định điểm rơi dữ liệu và tối ưu chi phí thu hút khách hàng (CAC).",
                Context = "Chiến dịch quảng cáo mùa hè đa kênh đang chi tiêu 500 triệu VNĐ/tháng trên Meta, Google Search và TikTok.",
                Problem = "Lưu lượng truy cập (traffic) tăng 45% nhưng tỷ lệ chuyển đổi ra đơn (CVR) giảm từ 3.8% xuống 1.4%, khiến chi phí trên mỗi đơn hàng tăng vọt 60%.",
                InitialConstraint = "Không được bổ sung thêm ngân sách tiếp thị; Phải đạt chỉ tiêu 2,500 đơn hàng trước ngày 30 của tháng.",
                Constraints = new List<string>
                {
                    "Ngân sách cố định, không được tăng thêm chi phí",
                    "Chỉ còn 14 ngày để phục hồi hiệu suất chiến dịch",
                    "Duy trì điểm chất lượng quảng cáo và nhận diện thương hiệu"
                },
                Competencies = new List<string> { "Data Analytics", "Funnel Optimization", "Trade-Off", "Problem Solving" },
                Difficulty = InterviewDifficultyLevel.STANDARD,
                ExpectedDecisionType = "FunnelOptimizationAndExperimentation",
                AvailableInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "budget_split",
                        Category = "Metrics",
                        Fact = "Ngân sách phân bổ: Meta Ads 50%, TikTok 30%, Google Search 20%.",
                        IsDirectlyAvailable = true,
                        IsRevealed = true
                    },
                    new ScenarioFactItem
                    {
                        Key = "funnel_drop",
                        Category = "Metrics",
                        Fact = "Điểm rơi lưu lượng lớn nhất xuất hiện tại bước người dùng chuyển từ Landing Page sang Form điền thông tin mua hàng.",
                        IsDirectlyAvailable = true,
                        IsRevealed = true
                    }
                },
                UnknownInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "traffic_demographics",
                        Category = "Metrics",
                        Fact = "70% traffic mới từ TikTok thuộc nhóm dưới 18 tuổi không có tài khoản thanh toán trực tuyến.",
                        TriggerKeywords = new List<string> { "chất lượng traffic", "độ tuổi", "nhân khẩu", "audience", "tiktok", "khách hàng" }
                    },
                    new ScenarioFactItem
                    {
                        Key = "mobile_page_speed",
                        Category = "Architecture",
                        Fact = "Landing page trên thiết bị di động có tốc độ tải trang lên tới 7.2 giây do nhúng video giới thiệu độ phân giải 4K chưa nén.",
                        TriggerKeywords = new List<string> { "tốc độ", "tải trang", "page speed", "mobile", "landing page", "kỹ thuật", "hiệu năng" }
                    }
                }
            };
        }

        public static InterviewScenario CreateHrHiringPressureScenario(string seniority = "Mid")
        {
            return new InterviewScenario
            {
                Title = "Giải quyết áp lực tuyển dụng gấp nhân sự chủ chốt khi chất lượng ứng viên chưa đạt chuẩn",
                Industry = "Human Resources",
                JobFamily = "People & Culture",
                Role = "Talent Acquisition Specialist",
                Seniority = seniority,
                Objective = "Đánh giá kỹ năng tư vấn cho Hiring Manager, quản lý xung đột kỳ vọng và kiên định với tiêu chuẩn văn hóa tổ chức.",
                Context = "Dự án mới vừa được ký duyệt, Trưởng phòng Kỹ thuật yêu cầu tuyển gấp 3 Senior Engineer trong vòng 3 tuần để kịp tiến độ.",
                Problem = "Ứng viên kỹ thuật giỏi nhất qua vòng phỏng vấn chuyên môn có dấu hiệu giao tiếp độc hại, thiếu tinh thần hợp tác, trong khi ứng viên phù hợp văn hóa cần 2 tháng nữa mới có thể nhận việc.",
                InitialConstraint = "Tiến độ bàn giao dự án không thể lùi; Đội ngũ kỹ thuật hiện tại đang quá tải nghiêm trọng.",
                Constraints = new List<string>
                {
                    "Không được hạ tiêu chuẩn cốt lõi về văn hóa làm việc của tổ chức",
                    "Hạn chót khởi động dự án cố định trong 21 ngày",
                    "Giữ vững sự gắn kết và tinh thần của các thành viên hiện tại"
                },
                Competencies = new List<string> { "Stakeholder Management", "Assessment Quality", "Integrity", "Decision Quality" },
                Difficulty = InterviewDifficultyLevel.STANDARD,
                ExpectedDecisionType = "StakeholderBalancingAndCulturalIntegrity",
                AvailableInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "hiring_urgency",
                        Category = "Timeline",
                        Fact = "Hiring Manager liên tục thúc giục ký hợp đồng ngay với ứng viên kỹ thuật xuất sắc để kịp tiến độ.",
                        IsDirectlyAvailable = true,
                        IsRevealed = true
                    }
                },
                UnknownInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "candidate_reference_check",
                        Category = "Policy",
                        Fact = "Kết quả kiểm tra tham chiếu cho thấy ứng viên từng rời bỏ 2 công ty trước vì mâu thuẫn gay gắt với đồng nghiệp trong nhóm.",
                        TriggerKeywords = new List<string> { "tham chiếu", "reference", "công ty cũ", "quá khứ", "lý do nghỉ việc", "kiểm tra" }
                    },
                    new ScenarioFactItem
                    {
                        Key = "internal_reallocation_capacity",
                        Category = "Business",
                        Fact = "Có 2 kỹ sư cấp cao từ dự án khác vừa hoàn thành giai đoạn cao điểm và có thể hỗ trợ 50% thời gian trong 1 tháng tới.",
                        TriggerKeywords = new List<string> { "nội bộ", "điều phối", "nhân sự có sẵn", "hỗ trợ", "tái phân bổ", "dự án khác" }
                    }
                }
            };
        }

        public static InterviewScenario CreateFinanceAuditScenario(string seniority = "Senior")
        {
            return new InterviewScenario
            {
                Title = "Đối soát và xử lý sai lệch số liệu doanh thu trước kỳ phát hành báo cáo tài chính",
                Industry = "Finance",
                JobFamily = "Finance & Accounting",
                Role = "Senior Financial Analyst / Accountant",
                Seniority = seniority,
                Objective = "Đánh giá tính tuân thủ nguyên tắc chuẩn mực kế toán, sự hoài nghi nghề nghiệp và khả năng ra quyết định minh bạch dưới áp lực chỉ tiêu.",
                Context = "Phòng Tài chính đang hoàn tất Báo cáo tài chính quý để trình Hội đồng quản trị và đơn vị Kiểm toán độc lập trong vòng 48 giờ.",
                Problem = "Đối soát phát hiện khoản doanh thu 4.2 tỷ VNĐ đã được xuất hóa đơn cuối kỳ nhưng biên bản nghiệm thu bàn giao thực tế chưa được đối tác ký xác nhận.",
                InitialConstraint = "Thời hạn nộp báo cáo luật định không thể gia hạn; Giám đốc kinh doanh gây áp lực yêu cầu ghi nhận để đạt KPI doanh thu quý.",
                Constraints = new List<string>
                {
                    "Tuân thủ nghiêm ngặt chuẩn mực kế toán về thời điểm ghi nhận doanh thu",
                    "Bảo đảm tính minh bạch trước cơ quan kiểm toán độc lập",
                    "Xử lý hài hòa quan hệ hợp tác với bộ phận kinh doanh"
                },
                Competencies = new List<string> { "Financial Integrity", "Regulatory Compliance", "Risk Awareness", "Decision Quality" },
                Difficulty = InterviewDifficultyLevel.ADVANCED,
                ExpectedDecisionType = "ComplianceAndEthicalDilemma",
                AvailableInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "erp_invoiced_status",
                        Category = "Metrics",
                        Fact = "Hóa đơn giá trị gia tăng đã phát hành thành công trên hệ thống hóa đơn điện tử vào ngày cuối cùng của quý.",
                        IsDirectlyAvailable = true,
                        IsRevealed = true
                    }
                },
                UnknownInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "goods_delivery_evidence",
                        Category = "Policy",
                        Fact = "Hàng hóa mới chỉ xuất kho trung tâm, chưa vận chuyển tới kho người mua và hợp đồng có điều khoản cho phép khách hàng đổi trả trong 30 ngày.",
                        TriggerKeywords = new List<string> { "giao hàng", "vận chuyển", "nghiệm thu", "kho", "logistics", "đổi trả", "bàn giao" }
                    }
                }
            };
        }

        public static InterviewScenario CreateProductRoadmapScenario(string seniority = "Senior")
        {
            return new InterviewScenario
            {
                Title = "Cân đối ưu tiên lộ trình sản phẩm trước yêu cầu tùy biến riêng của khách hàng VIP",
                Industry = "Product",
                JobFamily = "Product Management",
                Role = "Product Manager",
                Seniority = seniority,
                Objective = "Đánh giá khả năng bảo vệ tầm nhìn sản phẩm, tính toán chi phí cơ hội và tìm kiếm giải pháp có thể nhân rộng thay vì gia công theo yêu cầu.",
                Context = "Sản phẩm B2B SaaS đang phục vụ hơn 200 khách hàng vừa và nhỏ với lộ trình chuẩn hóa nền tảng.",
                Problem = "Một tập đoàn lớn đề nghị hợp đồng trị giá 500,000 USD/năm với điều kiện đội ngũ phát triển phải bổ sung module tùy biến theo quy trình riêng của họ trong 60 ngày.",
                InitialConstraint = "Năng lực kỹ thuật của team chỉ đủ để hoàn thành module tùy biến này HOẶC hoàn thành các tính năng cốt lõi đã cam kết với 200 khách hàng hiện tại.",
                Constraints = new List<string>
                {
                    "Không được làm vỡ cam kết lộ trình công khai với tệp khách hàng hiện tại",
                    "Không biến sản phẩm cốt lõi thành hệ thống phân mảnh mã nguồn",
                    "Khai thác giá trị doanh thu từ hợp đồng lớn một cách bền vững"
                },
                Competencies = new List<string> { "Product Thinking", "Prioritization", "Trade-Off", "Decision Quality" },
                Difficulty = InterviewDifficultyLevel.ADVANCED,
                ExpectedDecisionType = "RoadmapPrioritizationAndScalability",
                AvailableInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "roadmap_commitments",
                        Category = "Timeline",
                        Fact = "Lộ trình Q3 đã cam kết công khai tính năng báo cáo nâng cao và cải thiện tốc độ xử lý cho toàn bộ người dùng.",
                        IsDirectlyAvailable = true,
                        IsRevealed = true
                    }
                },
                UnknownInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "custom_module_reusability",
                        Category = "Architecture",
                        Fact = "Module yêu cầu của khách hàng VIP có thể trừu tượng hóa thành một bộ Open API / Webhook framework hữu ích cho toàn bộ hệ sinh thái khách hàng sau này.",
                        TriggerKeywords = new List<string> { "tái sử dụng", "api", "mở rộng", "webhook", "framework", "trừu tượng", "hệ sinh thái" }
                    }
                }
            };
        }

        public static InterviewScenario CreateSupplyChainDisruptionScenario(string seniority = "Senior")
        {
            return new InterviewScenario
            {
                Title = "Xử lý đứt gãy nguồn cung ứng linh kiện và bảo đảm cam kết giao hàng cho đối tác",
                Industry = "Operations",
                JobFamily = "Operations & Supply Chain",
                Role = "Supply Chain Manager",
                Seniority = seniority,
                Objective = "Đánh giá năng lực ứng phó rủi ro chuỗi cung ứng, phân tích trade-off chi phí vận tải và bảo vệ cam kết SLA khách hàng.",
                Context = "Nhà máy đang chuẩn bị cho đơn hàng xuất khẩu quan trọng đi thị trường Châu Âu với tiến độ bàn giao cố định.",
                Problem = "Nhà cung ứng linh kiện độc quyền thông báo nhà máy bị đình công, khiến vật tư bị trễ ít nhất 3 tuần.",
                InitialConstraint = "Hợp đồng có điều khoản phạt chậm giao hàng 2% giá trị mỗi tuần và hủy hợp đồng sau 15 ngày trễ hạn.",
                Constraints = new List<string>
                {
                    "Bảo đảm thời hạn giao hàng cam kết trong hợp đồng",
                    "Tối ưu hóa chi phí vận chuyển phát sinh",
                    "Duy trì chất lượng kỹ thuật linh kiện thay thế"
                },
                Competencies = new List<string> { "Supply Chain Resilience", "Risk Management", "Trade-Off", "Decision Quality" },
                Difficulty = InterviewDifficultyLevel.ADVANCED,
                ExpectedDecisionType = "SupplyChainMitigation",
                AvailableInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "buffer_stock",
                        Category = "Metrics",
                        Fact = "Lượng linh kiện tồn kho đệm hiện tại chỉ đủ duy trì dây chuyền lắp ráp trong 4 ngày làm việc tiếp theo.",
                        IsDirectlyAvailable = true,
                        IsRevealed = true
                    }
                },
                UnknownInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "alternate_air_freight",
                        Category = "Business",
                        Fact = "Một nhà cung ứng phụ tại khu vực có sẵn linh kiện tương đương nhưng giá đắt hơn 20% và phải chuyển bằng đường hàng không.",
                        TriggerKeywords = new List<string> { "nhà cung cấp khác", "thay thế", "hàng không", "air freight", "vận chuyển", "kho khác" }
                    }
                }
            };
        }

        public static InterviewScenario CreateHealthcareTriageScenario(string seniority = "Mid")
        {
            return new InterviewScenario
            {
                Title = "Phân loại bệnh nhân và điều phối tài nguyên cấp cứu khi khoa vượt quá công suất tiếp nhận",
                Industry = "Healthcare",
                JobFamily = "Medical & Healthcare",
                Role = "Emergency Care Coordinator",
                Seniority = seniority,
                Objective = "Đánh giá nguyên tắc y đức, sự bình tĩnh dưới áp lực, phân loại ca bệnh dựa trên chứng cứ lâm sàng và điều phối tài nguyên khan hiếm.",
                Context = "Khoa cấp cứu bệnh viện tiếp nhận tai nạn liên hoàn trong giờ trực đêm khi chỉ còn 1 phòng mổ và 2 kíp bác sĩ trực.",
                Problem = "Cùng lúc có 3 ca bệnh nguy kịch cần can thiệp khẩn cấp: một ca xuất huyết nội đang tụt huyết áp, một ca chấn thương sọ não tiến triển, và một ca gãy xương hở mất máu.",
                InitialConstraint = "Không thể đồng thời mổ tại chỗ cho cả 3 ca; Thời gian xe vận chuyển chuyên dụng chuyển viện viện tuyến trên mất 30 phút.",
                Constraints = new List<string>
                {
                    "Tuân thủ nghiêm ngặt chuẩn mực phân loại cấp cứu ESI/START",
                    "Duy trì ổn định huyết động tối đa cho tất cả bệnh nhân chờ",
                    "Minh bạch thông tin y tế với người nhà bệnh nhân"
                },
                Competencies = new List<string> { "Clinical Prioritization", "Emergency Management", "Ethics", "Decision Quality" },
                Difficulty = InterviewDifficultyLevel.ADVANCED,
                ExpectedDecisionType = "ClinicalTriageAndResourceAllocation",
                AvailableInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "staffing_limit",
                        Category = "Constraints",
                        Fact = "Khoa chỉ có 1 phòng phẫu thuật vô trùng sẵn sàng hoạt động ngay lập tức.",
                        IsDirectlyAvailable = true,
                        IsRevealed = true
                    }
                },
                UnknownInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "patient_hemodynamic_status",
                        Category = "Metrics",
                        Fact = "Bệnh nhân xuất huyết nội có huyết áp tụt nhanh đe dọa ngừng tim trong 15 phút nếu không cầm máu; ca chấn thương sọ não hiện sinh hiệu còn tạm ổn định.",
                        TriggerKeywords = new List<string> { "chỉ số", "huyết áp", "sinh hiệu", "sinh tồn", "tình trạng", "nguy kịch", "thời gian" }
                    }
                }
            };
        }

        public static InterviewScenario CreateGenericProblemSolvingScenario(string seniority = "Mid")
        {
            return new InterviewScenario
            {
                Title = "Giải quyết sự cố vận hành phát sinh đột xuất và cân đối ưu tiên giải pháp",
                Industry = "General",
                JobFamily = "General Operations",
                Role = "Professional",
                Seniority = seniority,
                Objective = "Đánh giá phương pháp thu thập dữ kiện, xác định nguyên nhân cốt lõi và đưa ra quyết định cân nhắc giữa ngắn hạn và dài hạn.",
                Context = "Quy trình vận hành thường nhật của bộ phận gặp sự cố gián đoạn đột xuất gây ảnh hưởng đến tiến độ của các bên liên quan.",
                Problem = "Thời gian xử lý công việc bị kéo dài gấp 3 lần bình thường, gây ùn ứ yêu cầu và phát sinh phản hồi chưa hài lòng.",
                InitialConstraint = "Cần khôi phục hoạt động cơ bản trong thời gian sớm nhất với nguồn lực nhân sự hiện tại.",
                Constraints = new List<string>
                {
                    "Bảo đảm an toàn và tính chính xác của dữ liệu",
                    "Khôi phục quy trình trong thời gian ngắn nhất",
                    "Rút ra bài học ngăn chặn sự cố tái diễn"
                },
                Competencies = new List<string> { "Problem Solving", "Process Improvement", "Trade-Off", "Decision Quality" },
                Difficulty = InterviewDifficultyLevel.STANDARD,
                ExpectedDecisionType = "GenericRootCauseAndMitigation",
                AvailableInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "general_incident_log",
                        Category = "General",
                        Fact = "Sự cố phát sinh sau khi tổ chức áp dụng bản cập nhật quy trình bàn giao thông tin đầu tuần.",
                        IsDirectlyAvailable = true,
                        IsRevealed = true
                    }
                },
                UnknownInformation = new List<ScenarioFactItem>
                {
                    new ScenarioFactItem
                    {
                        Key = "process_bottleneck_detail",
                        Category = "General",
                        Fact = "Điểm nghẽn nằm ở bước kiểm duyệt trung gian bị thiếu người phụ trách phê duyệt do không có phương án phân quyền dự phòng.",
                        TriggerKeywords = new List<string> { "nguyên nhân", "điểm nghẽn", "quy trình", "phê duyệt", "tại sao", "nghẽn", "kiểm duyệt" }
                    }
                }
            };
        }

        public static InterviewScenario CreateScenarioForContext(InterviewContext? context, InterviewBlueprint? blueprint = null)
        {
            var industry = context?.Industry ?? blueprint?.Industry ?? "General";
            var role = context?.TargetPosition ?? blueprint?.Role ?? "Professional";
            var seniority = context?.ExperienceLevel ?? blueprint?.Seniority ?? "Mid";

            var lowerInd = industry.ToLowerInvariant();
            var lowerRole = role.ToLowerInvariant();

            if (lowerInd.Contains("tech") || lowerInd.Contains("soft") || lowerInd.Contains("it") ||
                lowerRole.Contains("developer") || lowerRole.Contains("engineer") || lowerRole.Contains("backend") || lowerRole.Contains("frontend"))
            {
                return CreateSoftwareIncidentScenario(seniority);
            }
            if (lowerInd.Contains("sale") || lowerInd.Contains("thương mại") || lowerRole.Contains("account executive") || lowerRole.Contains("bán hàng"))
            {
                return CreateSalesNegotiationScenario(seniority);
            }
            if (lowerInd.Contains("market") || lowerInd.Contains("truyền thông") || lowerRole.Contains("growth") || lowerRole.Contains("marketing"))
            {
                return CreateMarketingCampaignScenario(seniority);
            }
            if (lowerInd.Contains("hr") || lowerInd.Contains("human") || lowerInd.Contains("resource") || lowerInd.Contains("nhân sự") || lowerRole.Contains("talent") || lowerRole.Contains("recruiter"))
            {
                return CreateHrHiringPressureScenario(seniority);
            }
            if (lowerInd.Contains("finan") || lowerInd.Contains("tài chính") || lowerInd.Contains("kế toán") || lowerRole.Contains("accountant") || lowerRole.Contains("auditor"))
            {
                return CreateFinanceAuditScenario(seniority);
            }
            if (lowerInd.Contains("product") || lowerRole.Contains("product manager") || lowerRole.Contains("po") || lowerRole.Contains("pm"))
            {
                return CreateProductRoadmapScenario(seniority);
            }
            if (lowerInd.Contains("operat") || lowerInd.Contains("supply") || lowerInd.Contains("chuỗi cung ứng") || lowerRole.Contains("logistics"))
            {
                return CreateSupplyChainDisruptionScenario(seniority);
            }
            if (lowerInd.Contains("health") || lowerInd.Contains("y tế") || lowerInd.Contains("bệnh viện") || lowerRole.Contains("bác sĩ") || lowerRole.Contains("nurse"))
            {
                return CreateHealthcareTriageScenario(seniority);
            }

            return CreateGenericProblemSolvingScenario(seniority);
        }
    }
}
