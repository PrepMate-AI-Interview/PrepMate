using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using backend.Models.QBank;

namespace backend.Services.QBank
{
    public class QBankService : IQBankService
    {
        private readonly List<QuestionSource> _sources;
        private readonly List<QuestionItemDto> _questions;

        public QBankService()
        {
            _sources = InitializeSources();
            _questions = InitializeQuestions();
        }

        public Task<QBankResponse> SearchQuestionsAsync(QBankQuery query)
        {
            query ??= new QBankQuery();
            var page = Math.Max(1, query.Page);
            var pageSize = query.PageSize > 0 ? Math.Min(50, query.PageSize) : 6;

            var filtered = _questions.Where(q => q.Published).AsEnumerable();

            // Keyword filter
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var kw = query.Keyword.Trim().ToLowerInvariant();
                filtered = filtered.Where(q =>
                    q.Title.ToLowerInvariant().Contains(kw) ||
                    q.Role.ToLowerInvariant().Contains(kw) ||
                    q.Company.ToLowerInvariant().Contains(kw) ||
                    q.Context.ToLowerInvariant().Contains(kw) ||
                    q.Keywords.Any(k => k.ToLowerInvariant().Contains(kw)) ||
                    q.TopicParam.ToLowerInvariant().Contains(kw));
            }

            // Industry filter
            if (!string.IsNullOrWhiteSpace(query.Industry) && !query.Industry.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                filtered = filtered.Where(q => q.Industry.Equals(query.Industry, StringComparison.OrdinalIgnoreCase));
            }

            // Company filter
            if (!string.IsNullOrWhiteSpace(query.Company) && !query.Company.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                filtered = filtered.Where(q => q.Company.Equals(query.Company, StringComparison.OrdinalIgnoreCase) ||
                                               q.SourceId.Equals(query.Company, StringComparison.OrdinalIgnoreCase));
            }

            // Difficulty filter
            if (!string.IsNullOrWhiteSpace(query.Difficulty) && !query.Difficulty.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                filtered = filtered.Where(q => q.Difficulty.Equals(query.Difficulty, StringComparison.OrdinalIgnoreCase));
            }

            // Seniority filter
            if (!string.IsNullOrWhiteSpace(query.Seniority) && !query.Seniority.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                filtered = filtered.Where(q => q.Seniority.Equals(query.Seniority, StringComparison.OrdinalIgnoreCase));
            }

            // Question Type filter
            if (!string.IsNullOrWhiteSpace(query.QuestionType) && !query.QuestionType.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                filtered = filtered.Where(q => q.Type.Equals(query.QuestionType, StringComparison.OrdinalIgnoreCase));
            }

            // Language filter
            if (!string.IsNullOrWhiteSpace(query.Language) && !query.Language.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                filtered = filtered.Where(q => q.Lang.Equals(query.Language, StringComparison.OrdinalIgnoreCase));
            }

            // Provenance filter
            if (!string.IsNullOrWhiteSpace(query.Provenance) && !query.Provenance.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                filtered = filtered.Where(q => q.Provenance.Equals(query.Provenance, StringComparison.OrdinalIgnoreCase));
            }

            var filteredList = filtered.ToList();
            var totalCount = filteredList.Count;
            var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
            if (totalPages < 1) totalPages = 1;

            // Sorting
            switch (query.SortBy?.ToLowerInvariant())
            {
                case "difficulty_asc":
                    filteredList = filteredList.OrderBy(q => GetDifficultyRank(q.Difficulty)).ToList();
                    break;
                case "difficulty_desc":
                    filteredList = filteredList.OrderByDescending(q => GetDifficultyRank(q.Difficulty)).ToList();
                    break;
                case "newest":
                    filteredList = filteredList.OrderByDescending(q => q.Id).ToList();
                    break;
                default: // "recommended"
                    // Preserve curated order
                    break;
            }

            var pagedQuestions = filteredList
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            // Calculate Industry Facets based on current search/filter scope
            var industryFacets = CalculateFacets();

            var companies = _questions
                .Select(q => q.Company)
                .Distinct()
                .OrderBy(c => c)
                .ToList();

            var response = new QBankResponse
            {
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = totalPages,
                Questions = pagedQuestions,
                Sources = _sources,
                IndustryFacets = industryFacets,
                Companies = companies
            };

            return Task.FromResult(response);
        }

        public Task<QuestionItemDto?> GetQuestionByIdAsync(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return Task.FromResult<QuestionItemDto?>(null);
            var item = _questions.FirstOrDefault(q => q.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
            return Task.FromResult(item);
        }

        public Task<List<QuestionSource>> GetSourcesAsync()
        {
            return Task.FromResult(_sources);
        }

        public Task<object> GetTaxonomyAsync()
        {
            var taxonomy = new
            {
                Industries = CalculateFacets(),
                Companies = _sources.Select(s => new { s.Id, s.Company, s.Domain, s.SourceType, s.Verified }),
                SeniorityLevels = new[] { "Fresher", "Mid", "Senior", "Lead" },
                QuestionTypes = new[]
                {
                    new { Key = "technical", Label = "Kỹ thuật / Chuyên môn" },
                    new { Key = "star", Label = "Hành vi chuẩn STAR" },
                    new { Key = "case", Label = "Tình huống thực tế" },
                    new { Key = "system", Label = "Kiến trúc hệ thống" }
                },
                Difficulties = new[]
                {
                    new { Key = "easy", Label = "●○○ Cơ bản (Fresher / Junior)" },
                    new { Key = "medium", Label = "●●○ Trung cấp (Mid-level)" },
                    new { Key = "hard", Label = "●●● Nâng cao (Senior / Lead)" }
                },
                Languages = new[]
                {
                    new { Key = "vi", Label = "Tiếng Việt", Flag = "🇻🇳" },
                    new { Key = "en", Label = "English", Flag = "🇬🇧" },
                    new { Key = "ja", Label = "日本語", Flag = "🇯🇵" }
                }
            };

            return Task.FromResult<object>(taxonomy);
        }

        private static int GetDifficultyRank(string diff) => diff?.ToLowerInvariant() switch
        {
            "easy" => 1,
            "medium" => 2,
            "hard" => 3,
            _ => 2
        };

        private List<IndustryFacet> CalculateFacets()
        {
            var list = new List<IndustryFacet>
            {
                new() { Key = "all", Label = "Tất cả", Count = _questions.Count },
                new() { Key = "it", Label = "Công nghệ thông tin", Count = _questions.Count(q => q.Industry == "it") },
                new() { Key = "marketing", Label = "Marketing & Truyền thông", Count = _questions.Count(q => q.Industry == "marketing") },
                new() { Key = "design", Label = "Thiết kế & Sáng tạo", Count = _questions.Count(q => q.Industry == "design") },
                new() { Key = "sales", Label = "Kinh doanh & Bán hàng", Count = _questions.Count(q => q.Industry == "sales") },
                new() { Key = "languages", Label = "Ngôn ngữ & Dịch thuật", Count = _questions.Count(q => q.Industry == "languages") },
                new() { Key = "finance", Label = "Tài chính & Kế toán", Count = _questions.Count(q => q.Industry == "finance") },
                new() { Key = "hr", Label = "Nhân sự & Tuyển dụng", Count = _questions.Count(q => q.Industry == "hr") },
                new() { Key = "softskills", Label = "Kỹ năng mềm & Quản trị", Count = _questions.Count(q => q.Industry == "softskills") }
            };
            return list;
        }

        private static List<QuestionSource> InitializeSources()
        {
            return new List<QuestionSource>
            {
                new()
                {
                    Id = "src-amazon",
                    Company = "Amazon",
                    Domain = "Cloud Infrastructure & E-Commerce",
                    SourceUrl = "https://www.amazon.jobs/content/en/how-we-hire",
                    SourceType = "PrepMateCurated",
                    ApplicableIndustries = new() { "it", "design", "hr" },
                    Verified = false,
                    Attribution = "Biên soạn bởi PrepMate (Tham khảo Khung năng lực Amazon Leadership Principles công khai)",
                    Description = "Bộ câu hỏi mô phỏng do PrepMate biên soạn dựa trên 16 nguyên tắc lãnh đạo và hướng dẫn phỏng vấn công khai của Amazon."
                },
                new()
                {
                    Id = "src-msft",
                    Company = "Microsoft",
                    Domain = "Enterprise Cloud & Developer Tools",
                    SourceUrl = "https://careers.microsoft.com/v2/global/en/hiring-tips/interview-tips",
                    SourceType = "PrepMateCurated",
                    ApplicableIndustries = new() { "it", "softskills" },
                    Verified = false,
                    Attribution = "Biên soạn bởi PrepMate (Tham khảo Hướng dẫn phỏng vấn kỹ thuật & Growth Mindset Microsoft)",
                    Description = "Bộ câu hỏi mô phỏng do PrepMate biên soạn theo hướng dẫn phỏng vấn kỹ thuật và tư duy tăng trưởng công khai của Microsoft."
                },
                new()
                {
                    Id = "src-fpt",
                    Company = "FPT Software",
                    Domain = "Global Software Services & Digital Transformation",
                    SourceUrl = "https://fptjobs.com/gioi-thieu",
                    SourceType = "PrepMateCurated",
                    ApplicableIndustries = new() { "it", "sales", "languages" },
                    Verified = false,
                    Attribution = "Biên soạn bởi PrepMate (Tham khảo Khung năng lực kỹ sư & Chuẩn bàn giao FPT Software)",
                    Description = "Khung năng lực kỹ sư toàn cầu, quản trị dự án phần mềm và ngôn ngữ doanh nghiệp do PrepMate tổng hợp."
                },
                new()
                {
                    Id = "src-viettel",
                    Company = "Viettel Solutions",
                    Domain = "Telecom, Enterprise Security & Digital Infrastructure",
                    SourceUrl = "https://tuyendung.viettel.vn",
                    SourceType = "PrepMateCurated",
                    ApplicableIndustries = new() { "it", "hr" },
                    Verified = false,
                    Attribution = "Biên soạn bởi PrepMate (Tham khảo Tiêu chuẩn tuyển dụng Viettel Solutions)",
                    Description = "Chuẩn phỏng vấn an ninh mạng, hạ tầng viễn thông và quản trị nguồn nhân lực do PrepMate tổng hợp."
                },
                new()
                {
                    Id = "src-vinamilk",
                    Company = "Vinamilk",
                    Domain = "FMCG, Brand Marketing & Global Supply Chain",
                    SourceUrl = "https://www.vinamilk.com.vn/vi/tuyen-dung",
                    SourceType = "PrepMateCurated",
                    ApplicableIndustries = new() { "marketing", "finance", "softskills" },
                    Verified = false,
                    Attribution = "Biên soạn bởi PrepMate (Tham khảo Khung năng lực thương mại & vận hành Vinamilk)",
                    Description = "Tiêu chuẩn đánh giá năng lực thương hiệu, tài chính nội bộ và chuỗi cung ứng sản xuất do PrepMate tổng hợp."
                },
                new()
                {
                    Id = "src-masan",
                    Company = "Masan Group",
                    Domain = "Retail, Consumer Goods & Financial Planning",
                    SourceUrl = "https://www.masangroup.com/careers",
                    SourceType = "PrepMateCurated",
                    ApplicableIndustries = new() { "finance", "marketing", "sales", "languages" },
                    Verified = false,
                    Attribution = "Biên soạn bởi PrepMate (Tham khảo Mô hình hoạch định tài chính & bán lẻ Masan)",
                    Description = "Chuẩn phỏng vấn FP&A, kiểm toán tài chính và phát triển thị trường bán lẻ do PrepMate tổng hợp."
                },
                new()
                {
                    Id = "src-base",
                    Company = "Base.vn",
                    Domain = "Enterprise B2B SaaS Ecosystem",
                    SourceUrl = "https://base.vn/careers",
                    SourceType = "PrepMateCurated",
                    ApplicableIndustries = new() { "it", "design", "sales" },
                    Verified = false,
                    Attribution = "Biên soạn bởi PrepMate (Tham khảo Phương pháp tư vấn giải pháp SaaS Base.vn)",
                    Description = "Mô hình phỏng vấn chuyên sâu về thiết kế sản phẩm SaaS và tư vấn chuyển đổi số doanh nghiệp do PrepMate tổng hợp."
                },
                new()
                {
                    Id = "src-shopee",
                    Company = "Shopee",
                    Domain = "High-Traffic E-Commerce & Logistics",
                    SourceUrl = "https://careers.shopee.vn",
                    SourceType = "PrepMateCurated",
                    ApplicableIndustries = new() { "it", "design" },
                    Verified = false,
                    Attribution = "Biên soạn bởi PrepMate (Tham khảo Tiêu chuẩn hệ thống tải cao & UX Shopee)",
                    Description = "Bộ câu hỏi mô phỏng xử lý tải cao, kiến trúc hệ thống và chuyển đổi trải nghiệm checkout do PrepMate tổng hợp."
                }
            };
        }

        private static List<QuestionItemDto> InitializeQuestions()
        {
            return new List<QuestionItemDto>
            {
                // ==========================================
                // 1. CÔNG NGHỆ THÔNG TIN (IT / TECH)
                // ==========================================
                new()
                {
                    Id = "Q-101",
                    Title = "Bạn xử lý vấn đề database deadlock và tối ưu concurrency trong hệ thống high-traffic như thế nào?",
                    QuestionText = "Bạn xử lý vấn đề database deadlock và tối ưu concurrency trong hệ thống high-traffic như thế nào?",
                    Company = "Amazon",
                    SourceId = "src-amazon",
                    SourceUrl = "https://www.amazon.jobs/content/en/how-we-hire",
                    SourceAttribution = "Amazon AWS Concurrency & SDE II Interview Guide",
                    Provenance = "PrepMateCurated",
                    Industry = "it",
                    IndustryLabel = "Công nghệ",
                    Role = "Backend Engineer",
                    Seniority = "Senior",
                    Skills = new() { "MySQL", "PostgreSQL", "Redis", "Distributed Lock", "Concurrency" },
                    Type = "technical",
                    TypeLabel = "Kỹ thuật",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "6-8 phút",
                    Context = "Câu hỏi kiểm tra hiểu biết sâu sắc về ACID, Transaction Isolation Levels, cơ chế Row/Table Lock và kỹ năng chẩn đoán deadlock trong môi trường hàng chục nghìn giao dịch mỗi giây.",
                    Followup = "Nếu xảy ra deadlock do 2 transaction update chéo 2 bảng theo thứ tự ngược nhau dưới tải cao, bạn sẽ dùng chiến lược Locking Order nhất quán hay chuyển sang Optimistic Locking với Versioning?",
                    Star = new StarResponseModel
                    {
                        S = "Hệ thống thanh toán chịu tải 5,000 req/s xuất hiện mã lỗi Deadlock 1213 liên tục trong giờ cao điểm.",
                        T = "Cô lập nguyên nhân gây deadlock giữa bảng Order và Inventory, loại bỏ lỗi 500 cho người dùng.",
                        A = "Phân tích log deadlock trên MySQL/PostgreSQL, áp dụng chuẩn hóa thứ tự khóa bản ghi và triển khai Redis Distributed Lock với Retry Exponential Backoff.",
                        R = "Tỷ lệ lỗi deadlock giảm về 0%, độ trễ xử lý transaction p99 giảm từ 1.2s xuống 85ms."
                    },
                    Keywords = new() { "Transaction Isolation", "Deadlock Detection", "Optimistic Locking", "InnoDB Row Lock", "Redis Distributed Lock" },
                    TopicParam = "Database Deadlock & Concurrency Optimization",
                    ExpectedCompetencies = new() { "Database Internals", "Concurrency Control", "High-Throughput Systems" },
                    RubricGuidance = "Đánh giá mức độ hiểu biết về lock order, deadlocks resolution và graceful retry."
                },
                new()
                {
                    Id = "Q-102",
                    Title = "Bạn đã từng tối ưu Core Web Vitals (LCP, CLS, INP) trên một ứng dụng Single Page Application phức tạp như thế nào?",
                    QuestionText = "Bạn đã từng tối ưu Core Web Vitals (LCP, CLS, INP) trên một ứng dụng Single Page Application phức tạp như thế nào?",
                    Company = "Microsoft",
                    SourceId = "src-msft",
                    SourceUrl = "https://careers.microsoft.com/v2/global/en/hiring-tips/interview-tips",
                    SourceAttribution = "Microsoft Web Platform Engineering Tips",
                    Provenance = "PrepMateCurated",
                    Industry = "it",
                    IndustryLabel = "Công nghệ",
                    Role = "Frontend Developer",
                    Seniority = "Senior",
                    Skills = new() { "React", "TypeScript", "Performance", "Web Vitals", "Lighthouse" },
                    Type = "technical",
                    TypeLabel = "Kỹ thuật",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "en",
                    LangLabel = "English",
                    LangFlag = "🇬🇧",
                    Duration = "6-8 phút",
                    Context = "Kiểm tra kỹ năng đo lường Critical Rendering Path, tối ưu tài nguyên bundle, memory leaks và nâng cao trải nghiệm người dùng theo tiêu chuẩn đánh giá của Google.",
                    Followup = "When bundle size exceeds 2.5MB causing high LCP, how do you implement route-based code splitting, dynamic imports, and asset preloading without hurting the user experience on slow mobile connections?",
                    Star = new StarResponseModel
                    {
                        S = "A dashboard SPA with 40+ charts was experiencing a poor LCP score of 4.8s and INP above 350ms on mobile.",
                        T = "Improve Core Web Vitals into the 'Good' green threshold to avoid SEO penalties and improve retention.",
                        A = "Conducted Lighthouse audit, replaced heavy chart libraries with lightweight alternatives, introduced Web Workers for heavy data processing, and configured dynamic code-splitting.",
                        R = "LCP dropped from 4.8s to 1.4s, INP improved to 65ms, and bounce rate decreased by 18%."
                    },
                    Keywords = new() { "Core Web Vitals", "Code Splitting", "LCP / CLS / INP", "Tree Shaking", "Service Workers" },
                    TopicParam = "Core Web Vitals & SPA Performance",
                    ExpectedCompetencies = new() { "Browser Rendering Lifecycle", "Bundle Optimization", "Modern JavaScript" },
                    RubricGuidance = "Focus on measurable metrics before and after profiling."
                },
                new()
                {
                    Id = "Q-103",
                    Title = "Khi cluster Kubernetes gặp sự cố CrashLoopBackOff hàng loạt trong giờ cao điểm, quy trình điều tra và cô lập lỗi của bạn gồm những bước nào?",
                    QuestionText = "Khi cluster Kubernetes gặp sự cố CrashLoopBackOff hàng loạt trong giờ cao điểm, quy trình điều tra và cô lập lỗi của bạn gồm những bước nào?",
                    Company = "FPT Software",
                    SourceId = "src-fpt",
                    SourceUrl = "https://fptjobs.com/gioi-thieu",
                    SourceAttribution = "FPT Software Cloud & DevOps Competency Framework",
                    Provenance = "PrepMateCurated",
                    Industry = "it",
                    IndustryLabel = "Công nghệ",
                    Role = "DevOps & Cloud Engineer",
                    Seniority = "Senior",
                    Skills = new() { "Kubernetes", "Docker", "Prometheus", "Troubleshooting", "Linux" },
                    Type = "case",
                    TypeLabel = "Tình huống",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "7-9 phút",
                    Context = "Đánh giá khả năng xử lý khủng hoảng hạ tầng, kỹ năng troubleshooting pod/container lifecycle, và phân tích log dưới áp lực cao.",
                    Followup = "Làm sao bạn phân biệt nhanh giữa lỗi OOMKilled (Exit Code 137) do vượt Memory Limit với lỗi Application Crash do connection pool database bị cạn kiệt?",
                    Star = new StarResponseModel
                    {
                        S = "Production cluster báo động đỏ khi 12 pod dịch vụ Authentication liên tục khởi động lại trong giờ cao điểm.",
                        T = "Khôi phục dịch vụ xác thực ngay lập tức và ngăn chặn tình trạng tuyết lở (cascading failure).",
                        A = "Sử dụng kubectl describe pod & logs --previous để bắt Exit Code, phát hiện leak memory khi parse token JWT, tăng tạm thời pod memory limit và rollback phiên bản hotfix.",
                        R = "Dịch vụ hồi phục sau 6 phút, cấu hình thêm Liveness/Readiness probe và alerts qua Prometheus."
                    },
                    Keywords = new() { "CrashLoopBackOff", "kubectl describe", "OOMKilled 137", "Readiness Probes", "Prometheus Alerting" },
                    TopicParam = "Kubernetes Incident Response & CrashLoopBackOff",
                    ExpectedCompetencies = new() { "Container Orchestration", "Site Reliability Engineering", "Incident RCA" },
                    RubricGuidance = "Quy trình điều tra rõ ràng từ logs, metrics đến remediation."
                },
                new()
                {
                    Id = "Q-104",
                    Title = "Hãy thiết kế một hệ thống Distributed Rate Limiter hỗ trợ 100.000 requests/giây để chống brute-force và DDoS.",
                    QuestionText = "Hãy thiết kế một hệ thống Distributed Rate Limiter hỗ trợ 100.000 requests/giây để chống brute-force và DDoS.",
                    Company = "Shopee",
                    SourceId = "src-shopee",
                    SourceUrl = "https://careers.shopee.vn",
                    SourceAttribution = "Shopee High-Scale Infrastructure Architecture Guide",
                    Provenance = "PrepMateCurated",
                    Industry = "it",
                    IndustryLabel = "Công nghệ",
                    Role = "System Architect",
                    Seniority = "Lead",
                    Skills = new() { "System Design", "Redis", "Distributed Systems", "Security" },
                    Type = "system",
                    TypeLabel = "Kiến trúc",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "en",
                    LangLabel = "English",
                    LangFlag = "🇬🇧",
                    Duration = "10-12 phút",
                    Context = "Đánh giá năng lực thiết kế hệ thống phân tán chịu lỗi cao, lựa chọn thuật toán rate limit phù hợp và tối ưu độ trễ với Redis Cluster.",
                    Followup = "Compare Token Bucket and Sliding Window Log algorithms in terms of memory footprint and boundary accuracy when scaling to tens of millions of active IP addresses.",
                    Star = new StarResponseModel
                    {
                        S = "API Gateway faced malicious bot scraping causing server degradation and high database utilization.",
                        T = "Architect a distributed, multi-region rate limiter keeping overhead latency below 3ms per request.",
                        A = "Designed a hybrid Token Bucket algorithm using Redis Lua scripts for atomic operations, combined with local in-memory caching for tier-1 filtering.",
                        R = "Handled 120,000 peak RPS smoothly with sub-2ms latency overhead, stopping 99.4% of automated scraping attacks."
                    },
                    Keywords = new() { "Token Bucket", "Redis Lua Scripting", "Distributed Cache", "Sliding Window", "DDoS Mitigation" },
                    TopicParam = "Distributed Rate Limiter at Scale",
                    ExpectedCompetencies = new() { "System Architecture", "Scalability", "Algorithmic Efficiency" },
                    RubricGuidance = "Thấu hiểu trade-offs giữa tính nhất quán và độ trễ."
                },
                new()
                {
                    Id = "Q-105",
                    Title = "Làm thế nào để phát hiện và giảm thiểu hiện tượng hallucination (ảo tưởng) trong hệ thống RAG (Retrieval-Augmented Generation)?",
                    QuestionText = "Làm thế nào để phát hiện và giảm thiểu hiện tượng hallucination (ảo tưởng) trong hệ thống RAG (Retrieval-Augmented Generation)?",
                    Company = "Microsoft",
                    SourceId = "src-msft",
                    SourceUrl = "https://careers.microsoft.com/v2/global/en/hiring-tips/interview-tips",
                    SourceAttribution = "Microsoft AI Platform Interview Guide",
                    Provenance = "PrepMateCurated",
                    Industry = "it",
                    IndustryLabel = "Công nghệ",
                    Role = "AI / Machine Learning Engineer",
                    Seniority = "Senior",
                    Skills = new() { "LLM", "RAG", "Embeddings", "Vector DB", "Evaluation" },
                    Type = "technical",
                    TypeLabel = "Kỹ thuật",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "7-9 phút",
                    Context = "Kiểm tra kiến trúc Vector Search, Semantic Chunking, Re-ranking và các kỹ thuật Guardrails đánh giá độ tin cậy của mô hình ngôn ngữ lớn.",
                    Followup = "Khi chunk text tài liệu có ngữ cảnh quá rộng hoặc quá hẹp, bạn tối ưu phương pháp Chunk Overlap và kết hợp HyDE (Hypothetical Document Embeddings) ra sao?",
                    Star = new StarResponseModel
                    {
                        S = "Trợ lý AI tra cứu văn bản pháp lý nội bộ đưa ra 12% câu trả lời có thông tin trích dẫn không tồn tại.",
                        T = "Nâng độ chính xác trích dẫn (Faithfulness score) lên trên 95% theo chuẩn Ragas evaluation.",
                        A = "Thiết kế pipeline RAG 2 bước: Hybrid Search (BM25 + Dense Vectors), tích hợp Cohere Reranker và áp dụng Self-Consistency Guardrails trước khi trả phản hồi.",
                        R = "Tỷ lệ hallucination giảm từ 12% xuống dưới 1.5%, độ hài lòng của chuyên viên pháp lý đạt 98%."
                    },
                    Keywords = new() { "RAG Pipeline", "Vector Database", "Hybrid Search", "Re-ranking", "Faithfulness Guardrails" },
                    TopicParam = "Mitigating Hallucination in RAG Systems",
                    ExpectedCompetencies = new() { "Generative AI", "Information Retrieval", "LLM Evaluation" },
                    RubricGuidance = "Chú trọng phương pháp định lượng và các kỹ thuật hybrid rerank."
                },
                new()
                {
                    Id = "Q-106",
                    Title = "Tối ưu hóa mức tiêu thụ pin và quản lý background task trên ứng dụng định vị thời gian thực.",
                    QuestionText = "Tối ưu hóa mức tiêu thụ pin và quản lý background task trên ứng dụng định vị thời gian thực.",
                    Company = "Viettel Solutions",
                    SourceId = "src-viettel",
                    SourceUrl = "https://tuyendung.viettel.vn",
                    SourceAttribution = "Viettel Digital Solutions Mobile Engineering Standards",
                    Provenance = "PrepMateCurated",
                    Industry = "it",
                    IndustryLabel = "Công nghệ",
                    Role = "Mobile Developer (Flutter / Android / iOS)",
                    Seniority = "Mid",
                    Skills = new() { "Mobile", "GPS", "Background Task", "Battery Optimization", "Kotlin" },
                    Type = "technical",
                    TypeLabel = "Kỹ thuật",
                    Difficulty = "medium",
                    DifficultyLabel = "Trung cấp",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "6-8 phút",
                    Context = "Kiểm tra việc sử dụng Location API hiệu quả, batching updates, và tối ưu Foreground Services / Background Fetch.",
                    Followup = "Làm sao để cân bằng giữa độ chính xác vị trí GPS theo thời gian thực với thời lượng pin khi người dùng đứng yên hoặc di chuyển tốc độ cao?",
                    Star = new StarResponseModel
                    {
                        S = "Ứng dụng giao hàng bị người dùng phàn nàn tụt pin 25%/giờ khi tài xế bật chế độ nhận đơn liên tục.",
                        T = "Giảm mức tiêu thụ pin xuống dưới 10%/giờ mà vẫn duy trì lộ trình tracking chính xác.",
                        A = "Triển khai Geofencing và Adaptive Distance Filter: chuyển đổi linh hoạt giữa GPS vệ tinh khi di chuyển và Cell Tower/Wi-Fi khi dừng xe.",
                        R = "Mức tiêu thụ pin giảm 60%, app rating trên App Store tăng từ 3.6 lên 4.6 sao."
                    },
                    Keywords = new() { "Location Services", "Geofencing", "Battery Optimization", "Foreground Service", "Adaptive Sampling" },
                    TopicParam = "Mobile Battery & Background Task Optimization",
                    ExpectedCompetencies = new() { "Mobile Lifecycle", "Power Management", "Location Services" },
                    RubricGuidance = "Kiểm tra cơ chế adaptive sampling và quản lý OS constraints."
                },

                // ==========================================
                // 2. MARKETING & TRUYỀN THÔNG
                // ==========================================
                new()
                {
                    Id = "Q-107",
                    Title = "Chiến lược tối ưu hóa CAC (Customer Acquisition Cost) và nâng cao LTV khi chi phí quảng cáo tăng cao trên các kênh Paid Ads.",
                    QuestionText = "Chiến lược tối ưu hóa CAC (Customer Acquisition Cost) và nâng cao LTV khi chi phí quảng cáo tăng cao trên các kênh Paid Ads.",
                    Company = "Vinamilk",
                    SourceId = "src-vinamilk",
                    SourceUrl = "https://www.vinamilk.com.vn/vi/tuyen-dung",
                    SourceAttribution = "Vinamilk Digital Marketing & Commercial Competency Model",
                    Provenance = "PrepMateCurated",
                    Industry = "marketing",
                    IndustryLabel = "Marketing",
                    Role = "Performance Marketing Lead",
                    Seniority = "Senior",
                    Skills = new() { "Paid Ads", "CAC/LTV", "CRO", "Attribution", "Funnel Analytics" },
                    Type = "case",
                    TypeLabel = "Tình huống",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "6-8 phút",
                    Context = "Đánh giá tư duy phân tích dữ liệu đa kênh, tối ưu phễu chuyển đổi (Conversion Rate Optimization) và chiến lược giữ chân khách hàng.",
                    Followup = "Khi CPM trên Facebook và TikTok tăng 35% trong quý 4, bạn sẽ phân bổ ngân sách lại giữa Top of Funnel và Retargeting như thế nào để đảm bảo ROAS mục tiêu?",
                    Star = new StarResponseModel
                    {
                        S = "Chi phí mua một khách hàng mới (CAC) của sản phẩm tiêu dùng tăng từ 180,000đ lên 320,000đ do cạnh tranh quảng cáo.",
                        T = "Kéo CAC trở lại mức an toàn dưới 220,000đ trong khi vẫn duy trì lượng đơn hàng mới trên 5,000 đơn/tháng.",
                        A = "Triển khai A/B test 15 biến thể Landing Page, cắt giảm 30% ngân sách nhóm ads kém hiệu quả, đẩy mạnh Referral Program và Lead Nurturing qua Email Automation.",
                        R = "CAC giảm còn 195,000đ, tỷ lệ chuyển đổi Landing Page tăng từ 2.4% lên 4.8%, ROAS tổng thể đạt 3.4x."
                    },
                    Keywords = new() { "CAC & LTV", "ROAS Optimization", "A/B Testing", "Funnel CRO", "Attribution Modeling" },
                    TopicParam = "Performance Marketing CAC and LTV Optimization",
                    ExpectedCompetencies = new() { "Commercial Acumen", "Performance Marketing", "Data-Driven Attribution" },
                    RubricGuidance = "Khả năng phân bổ ngân sách dựa trên số liệu thực chứng."
                },
                new()
                {
                    Id = "Q-108",
                    Title = "Kế hoạch xử lý khủng hoảng truyền thông mạng xã hội khi sản phẩm công ty xuất hiện sự cố chất lượng.",
                    QuestionText = "Kế hoạch xử lý khủng hoảng truyền thông mạng xã hội khi sản phẩm công ty xuất hiện sự cố chất lượng.",
                    Company = "Masan Group",
                    SourceId = "src-masan",
                    SourceUrl = "https://www.masangroup.com/careers",
                    SourceAttribution = "Masan Consumer PR & Corporate Affairs Guidelines",
                    Provenance = "PrepMateCurated",
                    Industry = "marketing",
                    IndustryLabel = "Marketing",
                    Role = "PR & Communications Specialist",
                    Seniority = "Senior",
                    Skills = new() { "Crisis Management", "Public Relations", "Brand Reputation", "Media Relations" },
                    Type = "star",
                    TypeLabel = "Hành vi STAR",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "7-9 phút",
                    Context = "Khảo sát tư duy bảo vệ danh tiếng thương hiệu, tốc độ phản hồi 24/7 và nguyên tắc giao tiếp trung thực, có trách nhiệm với công chúng.",
                    Followup = "Nếu một video tố giác ẩn danh đạt 1 triệu view trên TikTok sau 3 giờ, phản hồi đầu tiên của bạn trên trang chính thức nên tập trung vào điểm nào để tránh 'đổ thêm dầu vào lửa'?",
                    Star = new StarResponseModel
                    {
                        S = "Một bài đăng khiếu nại chất lượng sản phẩm nhận 50,000 lượt tương tác tiêu cực và kêu gọi tẩy chay trong 6 giờ.",
                        T = "Ngăn chặn thông tin sai lệch lan rộng, bảo vệ uy tín thương hiệu và chuyển hóa thái độ tiêu cực của cộng đồng.",
                        A = "Kích hoạt 'Phòng Tình Huống Khẩn Cấp', phát hành thông cáo báo chí chính thức minh bạch quy trình kiểm định, trực tiếp liên hệ đền bù và mời cơ quan chuyên môn xác minh độc lập.",
                        R = "85% báo chí đưa tin khách quan theo thông cáo, chỉ số Brand Sentiment hồi phục từ -45% lên +20% sau 72 giờ."
                    },
                    Keywords = new() { "Crisis PR", "Brand Sentiment", "Social Listening", "Holding Statement", "Media Ethics" },
                    TopicParam = "Social Media PR Crisis Management",
                    ExpectedCompetencies = new() { "Crisis Communication", "Stakeholder Management", "Ethical PR" },
                    RubricGuidance = "Nguyên tắc 'Holding Statement' chuẩn mực và thấu cảm với khách hàng."
                },
                new()
                {
                    Id = "Q-109",
                    Title = "Xây dựng chiến lược Content Pillar và Organic Search Engine nhằm tạo dòng khách hàng tiềm năng B2B bền vững.",
                    QuestionText = "Xây dựng chiến lược Content Pillar và Organic Search Engine nhằm tạo dòng khách hàng tiềm năng B2B bền vững.",
                    Company = "Base.vn",
                    SourceId = "src-base",
                    SourceUrl = "https://base.vn/careers",
                    SourceAttribution = "Base.vn Inbound Content & Marketing Playbook",
                    Provenance = "PrepMateCurated",
                    Industry = "marketing",
                    IndustryLabel = "Marketing",
                    Role = "Content Marketing Strategist",
                    Seniority = "Mid",
                    Skills = new() { "SEO", "Content Marketing", "B2B SaaS", "Topic Clusters", "Inbound" },
                    Type = "technical",
                    TypeLabel = "Kỹ thuật",
                    Difficulty = "medium",
                    DifficultyLabel = "Trung cấp",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "6-8 phút",
                    Context = "Kiểm tra kỹ năng nghiên cứu ý định tìm kiếm (Search Intent), kiến trúc Topic Clusters và chuyển đổi độc giả thành khách hàng dùng thử sản phẩm SaaS.",
                    Followup = "Làm sao đo lường chính xác đóng góp của một bài viết chuyên sâu dạng Thought Leadership vào doanh thu bán hàng B2B chu kỳ dài (6-12 tháng)?",
                    Star = new StarResponseModel
                    {
                        S = "Lượng organic traffic của công ty B2B chững lại ở mức 15,000 sessions/tháng, chỉ đóng góp 3% số lead tiềm năng.",
                        T = "Tái cấu trúc nội dung, tăng organic traffic lên 60,000 sessions và nâng tỷ lệ lead inbound lên 15%.",
                        A = "Xây dựng 4 Content Pillars theo mô hình Topic Cluster, xuất bản 30 bài chuyên sâu giải quyết bài toán quản trị, đính kèm Whitepaper và Template tính toán ROI miễn phí.",
                        R = "Organic traffic tăng 320% sau 6 tháng, chi phí lead inbound thấp hơn 65% so với Google Search Ads."
                    },
                    Keywords = new() { "Topic Clusters", "Search Intent", "B2B Inbound", "Thought Leadership", "Lead Magnet" },
                    TopicParam = "B2B Content Strategy & Organic Inbound Engine",
                    ExpectedCompetencies = new() { "SEO Strategy", "Content Architecture", "B2B Buyer Journey" },
                    RubricGuidance = "Khả năng liên kết giữa Content SEO với chuyển đổi bán hàng B2B thực tế."
                },

                // ==========================================
                // 3. THIẾT KẾ & SÁNG TẠO (DESIGN)
                // ==========================================
                new()
                {
                    Id = "Q-110",
                    Title = "Cách bạn thiết lập và duy trì Design System đa nền tảng để đảm bảo tính nhất quán giữa Figma và mã nguồn thực tế?",
                    QuestionText = "Cách bạn thiết lập và duy trì Design System đa nền tảng để đảm bảo tính nhất quán giữa Figma và mã nguồn thực tế?",
                    Company = "Base.vn",
                    SourceId = "src-base",
                    SourceUrl = "https://base.vn/careers",
                    SourceAttribution = "Base.vn Enterprise UI/UX Design System Guide",
                    Provenance = "PrepMateCurated",
                    Industry = "design",
                    IndustryLabel = "Thiết kế",
                    Role = "UI/UX Design Lead",
                    Seniority = "Lead",
                    Skills = new() { "Figma", "Design Tokens", "Design System", "CSS Variables", "WCAG" },
                    Type = "technical",
                    TypeLabel = "Kỹ thuật",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "7-9 phút",
                    Context = "Đánh giá tư duy hệ thống hóa giao diện (Systemic Design), cách quản lý Design Tokens 3 tầng và quy trình phối hợp hiệu quả giữa Designer và Frontend Engineer.",
                    Followup = "Khi đội lập trình yêu cầu thay đổi token màu để đạt độ tương phản WCAG 2.1 AA trên Dark Mode mà Designer muốn giữ màu thương hiệu gốc, bạn giải quyết xung đột này như thế nào?",
                    Star = new StarResponseModel
                    {
                        S = "Công ty có 5 sản phẩm web/mobile dùng hơn 40 sắc thái màu xám và 12 loại button khác nhau, gây lãng phí thời gian code lại.",
                        T = "Quy chuẩn hóa toàn bộ giao diện thành một Design System duy nhất, giảm 50% thời gian handoff giữa Design và Dev.",
                        A = "Thiết lập cấu trúc Design Tokens (Primitive -> Semantic -> Component), tích hợp Tokens Studio với GitHub Action để tự động biên dịch sang CSS Variables.",
                        R = "Tốc độ bàn giao màn hình mới tăng gấp đôi, lỗi giao diện giảm 70%, 100% component đạt chuẩn accessibility WCAG AA."
                    },
                    Keywords = new() { "Design Tokens", "Tokens Studio", "Semantic Tokens", "Design-to-Code", "WCAG 2.1 AA" },
                    TopicParam = "Design System Token Architecture & Multi-Platform Sync",
                    ExpectedCompetencies = new() { "Design Systems", "Cross-Platform Consistency", "Accessibility" },
                    RubricGuidance = "Hiểu sâu về cấu trúc Token 3 tầng và pipeline tự động hóa."
                },
                new()
                {
                    Id = "Q-111",
                    Title = "Khi tỷ lệ hủy đơn hàng tại bước thanh toán (Checkout Drop-off) tăng đột biến 20%, quy trình nghiên cứu UX và đề xuất cải tiến của bạn ra sao?",
                    QuestionText = "Khi tỷ lệ hủy đơn hàng tại bước thanh toán (Checkout Drop-off) tăng đột biến 20%, quy trình nghiên cứu UX và đề xuất cải tiến của bạn ra sao?",
                    Company = "Shopee",
                    SourceId = "src-shopee",
                    SourceUrl = "https://careers.shopee.vn",
                    SourceAttribution = "Shopee SEA Product Design Practice & E-Commerce CRO",
                    Provenance = "PrepMateCurated",
                    Industry = "design",
                    IndustryLabel = "Thiết kế",
                    Role = "Product Designer (E-Commerce)",
                    Seniority = "Senior",
                    Skills = new() { "UX Research", "Hotjar", "Usability Testing", "Funnel CRO", "E-Commerce" },
                    Type = "case",
                    TypeLabel = "Tình huống",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "7-9 phút",
                    Context = "Kiểm tra kỹ năng kết hợp dữ liệu định lượng (Funnel Analytics, Heatmaps) với dữ liệu định tính (Usability Testing, User Interviews) để tìm ra điểm nghẽn trải nghiệm người dùng.",
                    Followup = "Làm sao bạn cân bằng giữa việc yêu cầu người dùng điền đầy đủ thông tin xuất hóa đơn đỏ với trải nghiệm thanh toán 1-Click tối giản?",
                    Star = new StarResponseModel
                    {
                        S = "Tính năng thanh toán mới ra mắt làm sụt giảm 18% tỷ lệ hoàn tất đơn hàng trên phiên bản ứng dụng di động.",
                        T = "Xác định chính xác nguyên nhân và phục hồi tỷ lệ chuyển đổi checkout về mức bình thường trong 2 tuần.",
                        A = "Phân tích 200 phiên ghi màn hình trên Hotjar, phát hiện lỗi phím ảo che mất nút chọn phương thức thanh toán ví điện tử; tiến hành A/B test layout dạng accordion tinh gọn.",
                        R = "Tỷ lệ checkout thành công tăng thêm 23%, giá trị đơn hàng trung bình duy trì ổn định."
                    },
                    Keywords = new() { "Checkout UX", "Heatmaps & Recordings", "Usability Testing", "Drop-off Analysis", "Micro-Interactions" },
                    TopicParam = "Enterprise Checkout Redesign & Conversion Drop Analysis",
                    ExpectedCompetencies = new() { "Quantitative & Qualitative UX", "Mobile First Design", "Checkout Psychology" },
                    RubricGuidance = "Phương pháp nghiên cứu thực nghiệm và đo lường conversion."
                },
                new()
                {
                    Id = "Q-112",
                    Title = "Kể về một lần bạn bảo vệ thành công một quyết định thiết kế quan trọng trước sự phản đối của Product Manager hoặc ban giám đốc.",
                    QuestionText = "Kể về một lần bạn bảo vệ thành công một quyết định thiết kế quan trọng trước sự phản đối của Product Manager hoặc ban giám đốc.",
                    Company = "Amazon",
                    SourceId = "src-amazon",
                    SourceUrl = "https://www.amazon.jobs/content/en/how-we-hire",
                    SourceAttribution = "Amazon Customer Obsession & Design Leadership Framework",
                    Provenance = "PrepMateCurated",
                    Industry = "design",
                    IndustryLabel = "Thiết kế",
                    Role = "Senior UX Designer",
                    Seniority = "Senior",
                    Skills = new() { "Design Critique", "Stakeholder Management", "Data-Driven UX", "Customer Obsession" },
                    Type = "star",
                    TypeLabel = "Hành vi STAR",
                    Difficulty = "medium",
                    DifficultyLabel = "Trung cấp",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "6-8 phút",
                    Context = "Đánh giá năng lực thuyết phục dựa trên dữ liệu người dùng, kỹ năng lắng nghe và tư duy đặt trải nghiệm khách hàng lên hàng đầu (Customer Obsession).",
                    Followup = "Nếu sau khi A/B test phương án bạn đề xuất lại có chỉ số doanh thu ngắn hạn thấp hơn nhưng sự hài lòng dài hạn cao hơn, bạn trình bày case study này với ban lãnh đạo thế nào?",
                    Star = new StarResponseModel
                    {
                        S = "Product Manager muốn chèn thêm 2 pop-up quảng cáo tại trang chủ để đạt KPI tương tác quý, điều này gây phiền toái lớn cho khách hàng.",
                        T = "Bảo vệ trải nghiệm người dùng sạch sẽ mà vẫn giúp sản phẩm đạt mục tiêu tăng trưởng lượt đăng ký.",
                        A = "Thực hiện kiểm thử người dùng nhanh trên 10 khách hàng mục tiêu, ghi lại video phản ứng thất vọng của họ và đề xuất giải pháp thay thế: banner ngữ cảnh không chặn thao tác.",
                        R = "Ban lãnh đạo đồng thuận 100% với phương án banner mới; tỷ lệ đăng ký tài khoản tăng 14% mà không gây tăng tỷ lệ gỡ app."
                    },
                    Keywords = new() { "Design Critique", "Stakeholder Alignment", "Customer Advocacy", "Usability Evidence", "Empathy" },
                    TopicParam = "Design Critique & Cross-Functional Conflict Resolution",
                    ExpectedCompetencies = new() { "Stakeholder Influence", "Customer Advocacy", "Compromise & Trade-Offs" },
                    RubricGuidance = "Sử dụng bằng chứng người dùng để bảo vệ quan điểm một cách xây dựng."
                },

                // ==========================================
                // 4. KINH DOANH & BÁN HÀNG (SALES)
                // ==========================================
                new()
                {
                    Id = "Q-113",
                    Title = "Chiến lược tiếp cận và đàm phán hợp đồng phần mềm doanh nghiệp (B2B Enterprise SaaS) trị giá trên 500 triệu đồng với các tập đoàn lớn.",
                    QuestionText = "Chiến lược tiếp cận và đàm phán hợp đồng phần mềm doanh nghiệp (B2B Enterprise SaaS) trị giá trên 500 triệu đồng với các tập đoàn lớn.",
                    Company = "Base.vn",
                    SourceId = "src-base",
                    SourceUrl = "https://base.vn/careers",
                    SourceAttribution = "Base.vn Enterprise Solution Sales Methodology",
                    Provenance = "PrepMateCurated",
                    Industry = "sales",
                    IndustryLabel = "Kinh doanh",
                    Role = "Enterprise Account Executive",
                    Seniority = "Senior",
                    Skills = new() { "Enterprise Sales", "MEDDPICC", "B2B Negotiation", "SaaS", "C-Level Pitching" },
                    Type = "case",
                    TypeLabel = "Tình huống",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "7-9 phút",
                    Context = "Khảo sát phương pháp bán hàng chuẩn mực như MEDDPICC/BANT, kỹ năng xác định người bảo trợ nội bộ (Economic Buyer & Champion) và kỹ năng giải quyết lo ngại bảo mật.",
                    Followup = "Khi bộ phận CNTT của khách hàng bất ngờ phủ quyết hợp đồng với lý do muốn tự xây dựng phần mềm nội bộ (Build vs Buy), bạn làm gì để thuyết phục Giám đốc điều hành (CEO)?",
                    Star = new StarResponseModel
                    {
                        S = "Dự án chuyển đổi số quản trị quy mô 800 nhân sự bị đình trệ 4 tháng do phòng IT lo ngại rủi ro tích hợp hệ thống cũ.",
                        T = "Tái kích hoạt thương vụ, ký kết hợp đồng trị giá 650 triệu đồng trong vòng 45 ngày trước khi kết thúc năm tài chính.",
                        A = "Tổ chức buổi workshop kỹ thuật chuyên sâu với Giám đốc CNTT, xây dựng bảng đối chiếu chi phí sở hữu (TCO) giữa tự phát triển và dùng SaaS, cam kết chứng chỉ ISO 27001.",
                        R = "Ký kết thành công hợp đồng 3 năm trị giá 1.8 tỷ đồng; thời gian triển khai thực tế chỉ mất 6 tuần."
                    },
                    Keywords = new() { "MEDDPICC", "Economic Buyer", "TCO Analysis", "Enterprise SaaS", "Objection Handling" },
                    TopicParam = "B2B Enterprise SaaS Deal Negotiation & Objection Handling",
                    ExpectedCompetencies = new() { "Enterprise Deal Structuring", "C-Level Relationship", "TCO Modeling" },
                    RubricGuidance = "Quy trình MEDDPICC và cách khai thác Champion."
                },
                new()
                {
                    Id = "Q-114",
                    Title = "Kể về một thương vụ bán hàng tưởng chừng đã thất bại nhưng bạn đã kiên trì xoay chuyển tình thế để chốt hợp đồng thành công.",
                    QuestionText = "Kể về một thương vụ bán hàng tưởng chừng đã thất bại nhưng bạn đã kiên trì xoay chuyển tình thế để chốt hợp đồng thành công.",
                    Company = "FPT Software",
                    SourceId = "src-fpt",
                    SourceUrl = "https://fptjobs.com/gioi-thieu",
                    SourceAttribution = "FPT Software Global Business Development & Account Management",
                    Provenance = "PrepMateCurated",
                    Industry = "sales",
                    IndustryLabel = "Kinh doanh",
                    Role = "B2B Sales Manager",
                    Seniority = "Mid",
                    Skills = new() { "Consultative Selling", "Account Management", "Relationship Building", "Resilience" },
                    Type = "star",
                    TypeLabel = "Hành vi STAR",
                    Difficulty = "medium",
                    DifficultyLabel = "Trung cấp",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "6-8 phút",
                    Context = "Đánh giá sự kiên trì, tư duy đồng hành (Consultative Selling) và khả năng tìm kiếm nhu cầu chưa được nói ra (Unstated Needs) của khách hàng.",
                    Followup = "Làm sao để biết thời điểm nào nên kiên trì theo đuổi và thời điểm nào nên từ bỏ một cơ hội (Disqualify Lead) để không lãng phí thời gian của đội ngũ?",
                    Star = new StarResponseModel
                    {
                        S = "Một khách hàng tiềm năng gửi email thông báo lựa chọn giải pháp của đối thủ cạnh tranh với mức giá rẻ hơn 30%.",
                        T = "Giành lại cơ hội đàm phán mà không bước vào cuộc chiến giảm giá làm tổn hại giá trị thương hiệu.",
                        A = "Gửi một bức thư cảm ơn chân thành kèm bảng phân tích các rủi ro vận hành tiềm ẩn mà gói giá rẻ bỏ sót; mời khách hàng tham quan một nhà máy đang ứng dụng thành công giải pháp.",
                        R = "Khách hàng quay lại ký hợp đồng dịch vụ cao cấp, duy trì hợp tác liên tục suốt 3 năm liền."
                    },
                    Keywords = new() { "Win-back Strategy", "Consultative Selling", "Value Proposition", "Price vs Value", "Resilience" },
                    TopicParam = "Turning Stalled Inbound Deals into Closed-Won Contracts",
                    ExpectedCompetencies = new() { "Consultative Selling", "Value Demonstration", "Negotiation Resilience" },
                    RubricGuidance = "Khả năng phân biệt giữa Giá cả (Price) và Giá trị (Value)."
                },
                new()
                {
                    Id = "Q-115",
                    Title = "Phương pháp phân tích Sales Velocity và dự báo doanh số (Sales Forecasting) chính xác cho đội ngũ 20 nhân viên kinh doanh.",
                    QuestionText = "Phương pháp phân tích Sales Velocity và dự báo doanh số (Sales Forecasting) chính xác cho đội ngũ 20 nhân viên kinh doanh.",
                    Company = "Masan Group",
                    SourceId = "src-masan",
                    SourceUrl = "https://www.masangroup.com/careers",
                    SourceAttribution = "Masan Commercial Excellence & Sales Leadership Framework",
                    Provenance = "PrepMateCurated",
                    Industry = "sales",
                    IndustryLabel = "Kinh doanh",
                    Role = "Head of Sales / Sales Director",
                    Seniority = "Lead",
                    Skills = new() { "Sales Pipeline", "Sales Velocity", "Forecasting", "CRM Management", "KPI Design" },
                    Type = "technical",
                    TypeLabel = "Kỹ thuật",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "7-9 phút",
                    Context = "Kiểm tra kỹ năng quản trị phễu bán hàng (Pipeline Management), công thức Sales Velocity (Số cơ hội x Tỷ lệ chốt x Giá trị trung bình / Chu kỳ bán) và đào tạo đội ngũ.",
                    Followup = "Khi phát hiện một nhóm nhân viên thường xuyên giữ cơ hội ảo (Sandbagging deals) để dễ đạt KPI tháng sau, bạn xử lý văn hóa này như thế nào?",
                    Star = new StarResponseModel
                    {
                        S = "Dự báo doanh số hàng tháng của công ty sai lệch tới 40% so với thực tế, gây khó khăn cho kế hoạch tài chính và dòng tiền.",
                        T = "Nâng độ chính xác của Sales Forecast lên trên 90% và rút ngắn chu kỳ bán hàng từ 90 ngày xuống 60 ngày.",
                        A = "Chuẩn hóa tiêu chuẩn chuyển đổi từng giai đoạn trong CRM, triển khai công thức tính Pipeline Health Score và huấn luyện kỹ năng phân loại khách hàng hàng tuần.",
                        R = "Độ chính xác dự báo đạt 93% liên tục 4 quý; doanh thu toàn đội tăng trưởng 35% so với cùng kỳ."
                    },
                    Keywords = new() { "Sales Velocity", "Pipeline Hygiene", "Sales Forecasting", "CRM Standardization", "Sandbagging" },
                    TopicParam = "Sales Pipeline Velocity & Quota Forecasting Strategy",
                    ExpectedCompetencies = new() { "Sales Operations", "Predictive Analytics", "Team Coaching" },
                    RubricGuidance = "Sử dụng công thức Sales Velocity và quy chuẩn CRM chặt chẽ."
                },

                // ==========================================
                // 5. NGÔN NGỮ & DỊCH THUẬT (LANGUAGES)
                // ==========================================
                new()
                {
                    Id = "Q-116",
                    Title = "Quy trình dịch thuật và đối chiếu thuật ngữ chuyên ngành công nghệ / tài chính trong hợp đồng quốc tế đòi hỏi độ chính xác tuyệt đối.",
                    QuestionText = "Quy trình dịch thuật và đối chiếu thuật ngữ chuyên ngành công nghệ / tài chính trong hợp đồng quốc tế đòi hỏi độ chính xác tuyệt đối.",
                    Company = "FPT Software",
                    SourceId = "src-fpt",
                    SourceUrl = "https://fptjobs.com/gioi-thieu",
                    SourceAttribution = "FPT Software Global Delivery Translation & Quality Standards",
                    Provenance = "PrepMateCurated",
                    Industry = "languages",
                    IndustryLabel = "Ngôn ngữ",
                    Role = "Technical & Legal Translator",
                    Seniority = "Senior",
                    Skills = new() { "CAT Tools", "Terminology Management", "Legal Translation", "ISO 17100" },
                    Type = "technical",
                    TypeLabel = "Kỹ thuật",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "6-8 phút",
                    Context = "Khảo sát kỹ năng sử dụng công cụ hỗ trợ dịch thuật (CAT Tools như Trados, MemoQ), quản lý cơ sở dữ liệu thuật ngữ (TermBase) và kiểm soát chất lượng chuẩn ISO 17100.",
                    Followup = "Làm sao xử lý những điều khoản pháp lý bằng tiếng Anh/Nhật không có thuật ngữ tương đương hoàn toàn trong pháp luật Việt Nam?",
                    Star = new StarResponseModel
                    {
                        S = "Dự án đấu thầu quốc tế yêu cầu dịch 450 trang tài liệu kỹ thuật và hợp đồng đối tác trong thời hạn gấp 5 ngày.",
                        T = "Đảm bảo tính nhất quán 100% về thuật ngữ giữa 6 dịch giả làm việc song song mà không sai sót pháp lý.",
                        A = "Thiết lập TermBase dùng chung trên MemoQ Cloud, phân quyền kiểm duyệt chéo (Cross-Proofreading) và chạy công cụ QA tự động để phát hiện số liệu sai lệch.",
                        R = "Bàn giao tài liệu đúng tiến độ, hồ sơ đấu thầu được đối tác thông qua ngay lần thẩm định đầu tiên."
                    },
                    Keywords = new() { "CAT Tools", "TermBase", "Translation Memory", "Legal Nuance", "ISO 17100" },
                    TopicParam = "Cross-Border Technical Contract Translation & Terminology Alignment",
                    ExpectedCompetencies = new() { "Terminology Governance", "CAT Tool Mastery", "Quality Assurance" },
                    RubricGuidance = "Tuân thủ quy trình kiểm soát chất lượng 3 bước TEP (Translation, Editing, Proofreading)."
                },
                new()
                {
                    Id = "Q-117",
                    Title = "Kinh nghiệm phiên dịch đồng thời (Simultaneous Interpreting) trong các phiên đàm phán M&A hoặc hội nghị cấp cao đa quốc gia.",
                    QuestionText = "Kinh nghiệm phiên dịch đồng thời (Simultaneous Interpreting) trong các phiên đàm phán M&A hoặc hội nghị cấp cao đa quốc gia.",
                    Company = "Masan Group",
                    SourceId = "src-masan",
                    SourceUrl = "https://www.masangroup.com/careers",
                    SourceAttribution = "Masan Corporate Affairs High-Stakes Interpretation Standards",
                    Provenance = "PrepMateCurated",
                    Industry = "languages",
                    IndustryLabel = "Ngôn ngữ",
                    Role = "Simultaneous Conference Interpreter",
                    Seniority = "Senior",
                    Skills = new() { "Simultaneous Interpreting", "Cognitive Load", "Stress Management", "M&A" },
                    Type = "star",
                    TypeLabel = "Hành vi STAR",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "en",
                    LangLabel = "English",
                    LangFlag = "🇬🇧",
                    Duration = "7-9 phút",
                    Context = "Đánh giá khả năng tập trung cao độ, xử lý độ trễ dịch (Décalage/Ear-Voice Span), và ứng biến linh hoạt khi diễn giả nói tiếng lóng hoặc ngữ điệu khó nghe.",
                    Followup = "When a speaker makes a factual mistake in numbers during a high-stakes M&A session, how do you handle the interpretation without breaking professional neutrality?",
                    Star = new StarResponseModel
                    {
                        S = "Interpreted a 4-hour live cross-border M&A negotiation between Vietnamese enterprise leaders and Japanese investment funds.",
                        T = "Maintain accurate real-time interpretation with sub-2 second décalage under intense financial vocabulary scrutiny.",
                        A = "Pre-studied target company balance sheets, created synchronized shorthand glossaries, and partnered seamlessly with cabin colleague through 20-minute rotation cycles.",
                        R = "Both delegations reached mutual consensus on valuation clauses with zero misunderstandings."
                    },
                    Keywords = new() { "Simultaneous Interpreting", "Décalage", "M&A Negotiations", "Cognitive Stamina", "Booth Etiquette" },
                    TopicParam = "Simultaneous Interpreting During High-Stakes M&A Negotiations",
                    ExpectedCompetencies = new() { "Simultaneous Processing", "Professional Neutrality", "Crisis Improvisation" },
                    RubricGuidance = "Đánh giá việc phối hợp cabin và quản lý độ trễ décalage."
                },
                new()
                {
                    Id = "Q-118",
                    Title = "Quy trình bản địa hóa sản phẩm phần mềm (Software Localization - L10n) khi mở rộng sang các thị trường Nhật Bản và Đông Nam Á.",
                    QuestionText = "Quy trình bản địa hóa sản phẩm phần mềm (Software Localization - L10n) khi mở rộng sang các thị trường Nhật Bản và Đông Nam Á.",
                    Company = "Amazon",
                    SourceId = "src-amazon",
                    SourceUrl = "https://www.amazon.jobs/content/en/how-we-hire",
                    SourceAttribution = "Amazon Internationalization & Localization Best Practices",
                    Provenance = "PrepMateCurated",
                    Industry = "languages",
                    IndustryLabel = "Ngôn ngữ",
                    Role = "Localization Program Manager",
                    Seniority = "Mid",
                    Skills = new() { "L10n / i18n", "Crowdin", "Cultural Nuance", "Pseudo-localization" },
                    Type = "case",
                    TypeLabel = "Tình huống",
                    Difficulty = "medium",
                    DifficultyLabel = "Trung cấp",
                    Lang = "ja",
                    LangLabel = "日本語",
                    LangFlag = "🇯🇵",
                    Duration = "6-8 phút",
                    Context = "Kiểm tra kiến thức về Quốc tế hóa (i18n), Bản địa hóa (L10n), xử lý văn hóa ứng xử bản địa (Keigo trong tiếng Nhật), và kiểm thử giao diện sau bản địa hóa (LQA).",
                    Followup = "UIのテキストが日本語に翻訳された際、英語より文字幅や行数が長くなってレイアウト崩れが発生した場合、どのようにエンジニアやデザイナーと協調して解決しますか？",
                    Star = new StarResponseModel
                    {
                        S = "Ứng dụng thanh toán mở rộng sang Nhật Bản bị người dùng đánh giá thấp vì văn phong quá cứng nhắc và lỗi tràn chữ (Text Truncation).",
                        T = "Hoàn thiện quy trình L10n, nâng trải nghiệm ứng dụng đạt chuẩn văn hóa bản địa Nhật Bản trong 4 tuần.",
                        A = "Áp dụng Pseudo-localization trong quy trình CI/CD để phát hiện lỗi giao diện sớm; chuyển đổi toàn bộ chuỗi thông báo sang kính ngữ Keigo phù hợp ngữ cảnh dịch vụ tài chính.",
                        R = "Tỷ lệ giữ chân người dùng Nhật Bản trong 30 ngày đầu tăng 42%, điểm đánh giá app tăng lên 4.7 sao."
                    },
                    Keywords = new() { "Software L10n", "Pseudo-localization", "Japanese Keigo", "LQA Testing", "Cultural Adaptation" },
                    TopicParam = "Localization QA & Cultural Adaptation for Global SaaS Launch",
                    ExpectedCompetencies = new() { "Localization Pipeline", "Cultural Nuance", "Cross-Functional LQA" },
                    RubricGuidance = "Xử lý triệt để bài toán chuỗi ký tự dài (Text expansion) và văn phong bản địa."
                },

                // ==========================================
                // 6. TÀI CHÍNH & KẾ TOÁN (FINANCE)
                // ==========================================
                new()
                {
                    Id = "Q-119",
                    Title = "Phương pháp xây dựng mô hình tài chính dự báo dòng tiền (Financial Forecasting) và phân tích độ nhạy (Sensitivity Analysis) cho dự án đầu tư mới.",
                    QuestionText = "Phương pháp xây dựng mô hình tài chính dự báo dòng tiền (Financial Forecasting) và phân tích độ nhạy (Sensitivity Analysis) cho dự án đầu tư mới.",
                    Company = "Masan Group",
                    SourceId = "src-masan",
                    SourceUrl = "https://www.masangroup.com/careers",
                    SourceAttribution = "Masan Group FP&A Financial Modeling Standards",
                    Provenance = "PrepMateCurated",
                    Industry = "finance",
                    IndustryLabel = "Tài chính",
                    Role = "FP&A Manager / Financial Analyst",
                    Seniority = "Senior",
                    Skills = new() { "Financial Modeling", "DCF", "Sensitivity Analysis", "NPV / IRR", "Cash Flow" },
                    Type = "technical",
                    TypeLabel = "Kỹ thuật",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "7-9 phút",
                    Context = "Đánh giá tư duy định giá (DCF, NPV, IRR), kỹ năng xây dựng mô hình 3 báo cáo tài chính liên kết (3-Statement Model) và kiểm tra kịch bản rủi ro thị trường.",
                    Followup = "Khi lãi suất thị trường tăng 2% và chi phí nguyên liệu thô tăng 15%, những chỉ số tài chính nào trên bảng cân đối sẽ chịu áp lực thanh khoản đầu tiên?",
                    Star = new StarResponseModel
                    {
                        S = "Doanh nghiệp chuẩn bị đầu tư dây chuyền sản xuất mới trị giá 120 tỷ đồng nhưng thiếu mô hình đánh giá rủi ro lãi suất biến động.",
                        T = "Xây dựng mô hình tài chính toàn diện, tính toán các kịch bản Base, Best và Worst Case để tư vấn Hội đồng quản trị.",
                        A = "Thiết lập mô hình tài chính tích hợp 3 báo cáo, chạy mô phỏng Monte Carlo với 1,000 kịch bản biến động chi phí vốn (WACC) và doanh thu.",
                        R = "Hội đồng quản trị thông qua kế hoạch đầu tư kèm gói bảo hiểm rủi ro lãi suất; dự án đạt điểm hòa vốn sớm hơn 4 tháng so với kế hoạch."
                    },
                    Keywords = new() { "DCF Valuation", "Sensitivity Analysis", "3-Statement Model", "WACC", "Capital Budgeting" },
                    TopicParam = "SaaS Unit Economics & Rolling Financial Modeling",
                    ExpectedCompetencies = new() { "Corporate Finance", "Scenario Modeling", "Risk Sensitivity" },
                    RubricGuidance = "Khả năng xây dựng kịch bản Stress-test tài chính thực tế."
                },
                new()
                {
                    Id = "Q-120",
                    Title = "Kể về một tình huống bạn phát hiện sai lệch số liệu doanh thu trọng yếu trong quá trình kiểm toán và cách bạn xử lý với ban điều hành.",
                    QuestionText = "Kể về một tình huống bạn phát hiện sai lệch số liệu doanh thu trọng yếu trong quá trình kiểm toán và cách bạn xử lý với ban điều hành.",
                    Company = "Vinamilk",
                    SourceId = "src-vinamilk",
                    SourceUrl = "https://www.vinamilk.com.vn/vi/tuyen-dung",
                    SourceAttribution = "Vinamilk Internal Audit & Accounting Governance",
                    Provenance = "PrepMateCurated",
                    Industry = "finance",
                    IndustryLabel = "Tài chính",
                    Role = "Senior Internal Auditor / Chief Accountant",
                    Seniority = "Senior",
                    Skills = new() { "Internal Audit", "IFRS 15", "Revenue Recognition", "Internal Controls" },
                    Type = "star",
                    TypeLabel = "Hành vi STAR",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "7-9 phút",
                    Context = "Khảo sát tính liêm chính nghề nghiệp, sự hiểu biết về chuẩn mực ghi nhận doanh thu (IFRS 15 / VAS 14), và kỹ năng giao tiếp khéo léo nhưng cương quyết.",
                    Followup = "Nếu áp lực ghi nhận doanh thu xuất phát từ chính người quản lý trực tiếp của bạn nhằm làm đẹp báo cáo quý, bạn kích hoạt kênh báo cáo nào?",
                    Star = new StarResponseModel
                    {
                        S = "Trong đợt soát xét quý 3, phát hiện chi nhánh ghi nhận trước doanh thu 25 tỷ đồng cho các hợp đồng giao hàng chưa hoàn tất điều kiện chuyển giao rủi ro.",
                        T = "Điều chỉnh số liệu kế toán về đúng bản chất theo IFRS 15 và củng cố chốt kiểm soát nội bộ mà không làm đình trệ hoạt động kinh doanh.",
                        A = "Thu thập đầy đủ bằng chứng vận đơn, lập báo cáo giải trình chi tiết về rủi ro vi phạm pháp luật nếu bị cơ quan thuế thanh tra, và đề xuất bút toán điều chỉnh hồi tố.",
                        R = "Ban giám đốc đồng ý điều chỉnh số liệu minh bạch; thiết lập quy trình đối soát 3 bên (Sales - Kho - Kế toán) tự động trên ERP."
                    },
                    Keywords = new() { "IFRS 15", "Revenue Recognition", "Audit Evidence", "Internal Controls", "Professional Skepticism" },
                    TopicParam = "Financial Audit Discrepancy & Revenue Recognition Under IFRS 15",
                    ExpectedCompetencies = new() { "Auditing Standards", "Professional Skepticism", "Governance Ethics" },
                    RubricGuidance = "Tính độc lập nghề nghiệp và giải pháp khắc phục hệ thống (Root cause remediation)."
                },

                // ==========================================
                // 7. NHÂN SỰ & TUYỂN DỤNG (HR)
                // ==========================================
                new()
                {
                    Id = "Q-121",
                    Title = "Chiến lược xây dựng dải lương (Salary Band) và chính sách giữ chân nhân sự công nghệ chủ chốt trong bối cảnh thị trường cạnh tranh gay gắt.",
                    QuestionText = "Chiến lược xây dựng dải lương (Salary Band) và chính sách giữ chân nhân sự công nghệ chủ chốt trong bối cảnh thị trường cạnh tranh gay gắt.",
                    Company = "Viettel Solutions",
                    SourceId = "src-viettel",
                    SourceUrl = "https://tuyendung.viettel.vn",
                    SourceAttribution = "Viettel Total Rewards & Talent Strategy Standards",
                    Provenance = "PrepMateCurated",
                    Industry = "hr",
                    IndustryLabel = "Nhân sự",
                    Role = "Senior HR Business Partner (HRBP)",
                    Seniority = "Senior",
                    Skills = new() { "Total Rewards", "Salary Benchmarking", "Talent Retention", "ESOP", "HRBP" },
                    Type = "case",
                    TypeLabel = "Tình huống",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "7-9 phút",
                    Context = "Khảo sát tư duy Total Rewards (Lương, thưởng, phúc lợi, ESOP), kỹ năng đối chuẩn thị trường (Mercer/Towers Watson) và thiết kế lộ trình thăng tiến kép (Dual Career Ladder).",
                    Followup = "Khi một kỹ sư chủ chốt nhận được offer lương gấp 1.5 lần từ công ty nước ngoài, bạn dùng những đòn bẩy phi tài chính nào để thuyết phục họ ở lại?",
                    Star = new StarResponseModel
                    {
                        S = "Tỷ lệ nghỉ việc của đội ngũ kỹ sư phần mềm cấp cao tăng lên 24%/năm do dải lương công ty thấp hơn mặt bằng thị trường 20%.",
                        T = "Kiểm soát tỷ lệ nghỉ việc xuống dưới 10% và thu hút thêm 15 chuyên gia công nghệ trong vòng 6 tháng.",
                        A = "Thực hiện khảo sát đối chuẩn lương theo ngành, tái cấu trúc gói đãi ngộ: điều chỉnh lương cơ bản theo percentile 65, bổ sung quỹ cổ phiếu thưởng ESOP gắn với kết quả kinh doanh và lộ trình thăng tiến chuyên gia kỹ thuật.",
                        R = "Tỷ lệ nghỉ việc giảm xuống 8.5%, thời gian tuyển dụng trung bình cho vị trí Senior giảm từ 60 ngày xuống 35 ngày."
                    },
                    Keywords = new() { "Total Rewards", "Salary Benchmarking", "Dual Career Ladder", "ESOP Retention", "HRBP Strategy" },
                    TopicParam = "Tech Talent Retention & Compensation Band Benchmarking",
                    ExpectedCompetencies = new() { "Compensation & Benefits", "Talent Architecture", "Strategic HRBP" },
                    RubricGuidance = "Cân bằng giữa ngân sách chi phí nhân sự và năng lực cạnh tranh thị trường."
                },
                new()
                {
                    Id = "Q-122",
                    Title = "Kể về một lần bạn phải xử lý tình huống nhân viên cấp dưới hoặc đồng nghiệp không đạt hiệu suất công việc (Performance Improvement Plan - PIP).",
                    QuestionText = "Kể về một lần bạn phải xử lý tình huống nhân viên cấp dưới hoặc đồng nghiệp không đạt hiệu suất công việc (Performance Improvement Plan - PIP).",
                    Company = "Amazon",
                    SourceId = "src-amazon",
                    SourceUrl = "https://www.amazon.jobs/content/en/how-we-hire",
                    SourceAttribution = "Amazon Performance Management & Leadership Development",
                    Provenance = "PrepMateCurated",
                    Industry = "hr",
                    IndustryLabel = "Nhân sự",
                    Role = "Engineering Manager / HR Specialist",
                    Seniority = "Lead",
                    Skills = new() { "Performance Management", "PIP", "Empathetic Leadership", "Labor Law" },
                    Type = "star",
                    TypeLabel = "Hành vi STAR",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "7-9 phút",
                    Context = "Đánh giá kỹ năng phản hồi mang tính xây dựng (Radical Candor), thiết lập mục tiêu cải thiện có thể đo lường và tuân thủ chặt chẽ pháp luật lao động.",
                    Followup = "Nếu nhân viên phản ứng gay gắt, cho rằng họ bị đối xử bất công và đe dọa khiếu nại lên cơ quan lao động, bạn xử lý cuộc trao đổi đó ra sao?",
                    Star = new StarResponseModel
                    {
                        S = "Một nhân viên kỳ cựu liên tục trễ hạn dự án và gây ảnh hưởng tiêu cực đến tinh thần làm việc của các thành viên mới trong nhóm.",
                        T = "Giúp nhân viên cải thiện hiệu suất rõ rệt trong 60 ngày hoặc chia tay văn minh, đúng quy định pháp luật.",
                        A = "Thiết lập kế hoạch PIP 60 ngày với các mốc kiểm tra hàng tuần minh bạch; lắng nghe khó khăn cá nhân của nhân viên, cung cấp mentor hỗ trợ và ghi nhận biên bản làm việc rõ ràng.",
                        R = "Nhân viên đạt 90% mục tiêu PIP, lấy lại sự tự tin và tiếp tục đóng góp hiệu quả cho dự án lớn của công ty."
                    },
                    Keywords = new() { "PIP Process", "Radical Candor", "Performance Coaching", "Labor Compliance", "Empathy" },
                    TopicParam = "Handling Underperforming Senior Engineers & PIP Strategy",
                    ExpectedCompetencies = new() { "Performance Coaching", "Labor Law Compliance", "Constructive Feedback" },
                    RubricGuidance = "Tập trung vào mục tiêu giúp đỡ nhân sự cải thiện trước khi tính đến phương án chấm dứt."
                },

                // ==========================================
                // 8. KỸ NĂNG MỀM & QUẢN TRỊ (SOFTSKILLS)
                // ==========================================
                new()
                {
                    Id = "Q-123",
                    Title = "Kể về một tình huống xảy ra xung đột quyền lợi và ưu tiên công việc gay gắt giữa 2 phòng ban, và cách bạn đứng ra dàn xếp.",
                    QuestionText = "Kể về một tình huống xảy ra xung đột quyền lợi và ưu tiên công việc gay gắt giữa 2 phòng ban, và cách bạn đứng ra dàn xếp.",
                    Company = "Microsoft",
                    SourceId = "src-msft",
                    SourceUrl = "https://careers.microsoft.com/v2/global/en/hiring-tips/interview-tips",
                    SourceAttribution = "Microsoft Growth Mindset & Cross-Team Collaboration Guide",
                    Provenance = "PrepMateCurated",
                    Industry = "softskills",
                    IndustryLabel = "Quản trị",
                    Role = "Lead Product Manager",
                    Seniority = "Lead",
                    Skills = new() { "Negotiation", "Conflict Resolution", "OKR Alignment", "Cross-Functional" },
                    Type = "star",
                    TypeLabel = "Hành vi STAR",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "7-9 phút",
                    Context = "Khảo sát tư duy hướng tới mục tiêu chung của tổ chức (Organizational Goal), khả năng phân tích được mất (Trade-offs) và kỹ năng thương lượng Win-Win.",
                    Followup = "Khi cả hai bên đều dẫn chứng dữ liệu để chứng minh quan điểm của mình là đúng và từ chối nhượng bộ, bạn đưa ra quyết định dựa trên nguyên tắc nào?",
                    Star = new StarResponseModel
                    {
                        S = "Đội ngũ Kinh doanh muốn ra mắt tính năng sớm để đạt KPI doanh số quý, trong khi đội Kỹ thuật kiên quyết hoãn lại 1 tháng để vá lỗ hổng bảo mật.",
                        T = "Hòa giải xung đột, đảm bảo an toàn cho sản phẩm mà không làm lỡ cơ hội kinh doanh trọng yếu.",
                        A = "Tổ chức phiên làm việc chung, lượng hóa rủi ro tài chính nếu bị tấn công so với chi phí mất doanh thu nếu hoãn; đề xuất phương án thỏa hiệp: phát hành bản Beta giới hạn cho 5 khách hàng chiến lược đã ký cam kết kiểm thử.",
                        R = "Cả hai phòng ban đều đồng thuận 100%; sản phẩm ra mắt an toàn và mang về doanh thu 1.2 tỷ đồng ngay trong tháng đầu."
                    },
                    Keywords = new() { "Conflict Mediation", "Risk Quantification", "Compromise Solution", "Cross-Functional", "Win-Win" },
                    TopicParam = "Cross-Department Priority Conflict & OKR Trade-Offs",
                    ExpectedCompetencies = new() { "Conflict Management", "Organizational Awareness", "Strategic Trade-Offs" },
                    RubricGuidance = "Khả năng tìm kiếm giải pháp thứ ba thỏa mãn mục tiêu cốt lõi của cả hai bên."
                },
                new()
                {
                    Id = "Q-124",
                    Title = "Khi đối tác cung cấp dịch vụ hạ tầng đột ngột tăng giá 40% hoặc đe dọa cắt đứt hợp tác, bạn đàm phán và xây dựng kế hoạch dự phòng (Contingency Plan) thế nào?",
                    QuestionText = "Khi đối tác cung cấp dịch vụ hạ tầng đột ngột tăng giá 40% hoặc đe dọa cắt đứt hợp tác, bạn đàm phán và xây dựng kế hoạch dự phòng (Contingency Plan) thế nào?",
                    Company = "Vinamilk",
                    SourceId = "src-vinamilk",
                    SourceUrl = "https://www.vinamilk.com.vn/vi/tuyen-dung",
                    SourceAttribution = "Vinamilk Supply Chain Continuity & Vendor Management",
                    Provenance = "PrepMateCurated",
                    Industry = "softskills",
                    IndustryLabel = "Quản trị",
                    Role = "Operations & Supply Chain Manager",
                    Seniority = "Senior",
                    Skills = new() { "Vendor Management", "SLA Negotiation", "Contingency Planning", "Risk Mitigation" },
                    Type = "case",
                    TypeLabel = "Tình huống",
                    Difficulty = "hard",
                    DifficultyLabel = "Nâng cao",
                    Lang = "vi",
                    LangLabel = "Tiếng Việt",
                    LangFlag = "🇻🇳",
                    Duration = "7-9 phút",
                    Context = "Đánh giá khả năng quản lý rủi ro nhà cung ứng (Vendor Risk Management), năng lực đàm phán trên thế yếu và kế hoạch duy trì kinh doanh liên tục (Business Continuity Planning - BCP).",
                    Followup = "Nếu đối tác là đơn vị độc quyền trên thị trường và không có nhà cung cấp thay thế ngay lập tức, bạn sử dụng những đòn bẩy nào trên bàn đàm phán?",
                    Star = new StarResponseModel
                    {
                        S = "Nhà cung cấp dịch vụ cloud độc quyền thông báo tăng phí 40% sau 30 ngày, đe dọa thâm hụt ngân sách vận hành 800 triệu đồng/năm.",
                        T = "Đàm phán duy trì mức phí hợp lý và thiết lập lộ trình giảm thiểu phụ thuộc vào một nhà cung cấp duy nhất.",
                        A = "Phân tích điều khoản hợp đồng cũ, phát hiện đối tác chưa đạt cam kết uptime SLA trong 2 quý trước; đàm phán ký hợp đồng dài hạn 2 năm để giữ nguyên giá, đồng thời kích hoạt dự án kiến trúc Multi-Cloud dự phòng.",
                        R = "Giữ nguyên chi phí cũ, tiết kiệm 800 triệu đồng và hoàn thành kiến trúc Multi-Cloud sau 5 tháng."
                    },
                    Keywords = new() { "Vendor SLA", "Contingency Plan", "Multi-Cloud Strategy", "Negotiation Leverage", "BCP" },
                    TopicParam = "Supply Chain Disruption & Vendor SLA Renegotiation",
                    ExpectedCompetencies = new() { "Vendor Management", "Business Continuity", "Strategic Sourcing" },
                    RubricGuidance = "Khai thác điểm yếu trong cam kết SLA cũ và kiến trúc dự phòng dài hạn."
                }
            };
        }
    }
}
