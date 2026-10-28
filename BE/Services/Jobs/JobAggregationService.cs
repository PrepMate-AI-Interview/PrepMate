using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using backend.Models.Jobs;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace backend.Services.Jobs
{
    public class JobAggregationService : IJobAggregationService
    {
        private readonly IEnumerable<IJobProvider> _providers;
        private readonly ExternalSearchLinkProvider _linkProvider;
        private readonly IMemoryCache _cache;
        private readonly ILogger<JobAggregationService> _logger;

        public JobAggregationService(
            IEnumerable<IJobProvider> providers,
            ExternalSearchLinkProvider linkProvider,
            IMemoryCache cache,
            ILogger<JobAggregationService> logger)
        {
            _providers = providers;
            _linkProvider = linkProvider;
            _cache = cache;
            _logger = logger;
        }

        public List<ProviderStatus> GetProviderStatuses()
        {
            var list = _providers.Select(p => p.GetStatus()).ToList();
            list.Add(new ProviderStatus
            {
                Name = "TopCV / VietnamWorks / ITviec / CareerViet",
                SourceKey = "direct_hub",
                IsEnabled = true,
                IsConfigured = true,
                Mode = "ExternalSearchLink",
                Attribution = "Điều hướng tìm kiếm trực tiếp có bản quyền trên nền tảng gốc",
                StatusMessage = "Sẵn sàng (Tạo liên kết tìm kiếm trực tiếp theo từ khóa và địa điểm)"
            });
            return list;
        }

        public async Task<JobSearchResponse> SearchJobsAsync(JobSearchQuery query, CancellationToken cancellationToken = default)
        {
            var cacheKey = $"jobs_agg_{query.Keyword?.Trim().ToLowerInvariant()}_{query.Location?.Trim().ToLowerInvariant()}_{query.Category?.Trim().ToLowerInvariant()}_{query.EmploymentType?.Trim().ToLowerInvariant()}_{query.WorkMode?.Trim().ToLowerInvariant()}_{query.Experience?.Trim().ToLowerInvariant()}_{query.MinSalary ?? 0}_{query.MaxSalary ?? 0}_{query.Page}_{query.PageSize}_{query.Source?.Trim().ToLowerInvariant()}_{query.SortBy?.Trim().ToLowerInvariant()}";
            if (_cache.TryGetValue(cacheKey, out JobSearchResponse? cachedResponse) && cachedResponse != null)
            {
                return cachedResponse;
            }

            var externalLinks = _linkProvider.GenerateLinks(query);
            var providerStatuses = new List<ProviderStatus>();
            var aggregatedJobs = new List<JobPostingDto>();

            var activeProviders = _providers.Where(p => string.IsNullOrWhiteSpace(query.Source) || query.Source.Equals("all", StringComparison.OrdinalIgnoreCase) || p.SourceKey.Equals(query.Source, StringComparison.OrdinalIgnoreCase)).ToList();

            var searchTasks = activeProviders.Select(async p =>
            {
                try
                {
                    using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                    cts.CancelAfter(TimeSpan.FromSeconds(8));
                    return await p.SearchJobsAsync(query, cts.Token);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Provider {Provider} failed: {Msg}", p.ProviderName, ex.Message);
                    return new ProviderSearchResult
                    {
                        Status = p.GetStatus(),
                        ErrorMessage = ex.Message
                    };
                }
            });

            var results = await Task.WhenAll(searchTasks);

            var hasLiveConfigured = false;
            foreach (var r in results)
            {
                providerStatuses.Add(r.Status);
                if (r.Status.IsConfigured)
                {
                    hasLiveConfigured = true;
                }
                if (r.Jobs.Count > 0)
                {
                    aggregatedJobs.AddRange(r.Jobs);
                }
            }

            // Deduplicate live jobs by applyUrl or (Title + CompanyName)
            var seenKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var deduplicatedJobs = new List<JobPostingDto>();
            foreach (var j in aggregatedJobs)
            {
                var key = !string.IsNullOrWhiteSpace(j.ApplyUrl)
                    ? j.ApplyUrl
                    : $"{j.Title}@@{j.CompanyName}";
                if (seenKeys.Add(key))
                {
                    deduplicatedJobs.Add(j);
                }
            }

            var sampleCatalog = GetBenchmarkSampleCatalog();
            var filteredSamples = FilterSampleJobs(sampleCatalog, query);

            List<JobPostingDto> finalJobs;
            List<JobPostingDto> benchmarkJobs = new();
            string notice;

            if (hasLiveConfigured)
            {
                // When API is configured, never mix benchmark samples into the live jobs list!
                finalJobs = new List<JobPostingDto>(deduplicatedJobs);

                if (finalJobs.Count > 0)
                {
                    notice = "Kết quả được tổng hợp trực tiếp từ Jooble live API.";
                }
                else
                {
                    notice = "Không tìm thấy tin tuyển dụng trực tiếp nào khớp từ khóa trên Jooble. Hãy thử tìm trên các nền tảng tuyển dụng liên kết bên dưới hoặc tham khảo các vị trí benchmark mẫu.";
                    benchmarkJobs = filteredSamples.Take(6).ToList();
                }
            }
            else
            {
                // When unconfigured, present the verified benchmark catalog as sample reference
                finalJobs = new List<JobPostingDto>(filteredSamples);
                notice = "Chưa cấu hình JOOBLE_API_KEY. Đang hiển thị danh mục việc làm benchmark mẫu được thẩm định của PrepMate cùng các liên kết tìm việc trực tiếp TopCV, VietnamWorks, ITviec, CareerViet.";
            }

            // Apply client-requested sorting
            if (string.Equals(query.SortBy, "salary", StringComparison.OrdinalIgnoreCase))
            {
                finalJobs = finalJobs.OrderByDescending(j => j.SalaryMax ?? j.SalaryMin ?? 0).ToList();
            }
            else if (string.Equals(query.SortBy, "newest", StringComparison.OrdinalIgnoreCase))
            {
                finalJobs = finalJobs.OrderBy(j => j.PostedDays ?? 99).ToList();
            }
            else
            {
                finalJobs = finalJobs.OrderByDescending(j => j.MatchScore).ToList();
            }

            // Pagination calculation
            var page = Math.Max(1, query.Page);
            var pageSize = Math.Clamp(query.PageSize, 1, 50);
            int totalCount;
            List<JobPostingDto> pagedJobs;

            if (hasLiveConfigured)
            {
                var maxLiveTotal = results
                    .Where(r => r.Status.IsConfigured)
                    .Select(r => r.TotalCount)
                    .DefaultIfEmpty(0)
                    .Max();

                totalCount = Math.Max(maxLiveTotal, finalJobs.Count);
                // Provider already paged results using query.Page and query.PageSize
                pagedJobs = finalJobs;
            }
            else
            {
                totalCount = finalJobs.Count;
                pagedJobs = finalJobs.Skip((page - 1) * pageSize).Take(pageSize).ToList();
            }

            var response = new JobSearchResponse
            {
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                Jobs = pagedJobs,
                BenchmarkJobs = benchmarkJobs,
                Providers = providerStatuses,
                ExternalSearchLinks = externalLinks,
                Query = query,
                HasLiveProvidersConfigured = hasLiveConfigured,
                Notice = notice
            };

            // Cache for 3 minutes to relieve external rate limits
            _cache.Set(cacheKey, response, TimeSpan.FromMinutes(3));
            return response;
        }

        private static List<JobPostingDto> FilterSampleJobs(List<JobPostingDto> samples, JobSearchQuery query)
        {
            var kw = query.Keyword?.Trim().ToLowerInvariant();
            var loc = query.Location?.Trim().ToLowerInvariant();
            var cat = query.Category?.Trim().ToLowerInvariant();
            var type = query.EmploymentType?.Trim().ToLowerInvariant();
            var exp = query.Experience?.Trim().ToLowerInvariant();
            var workMode = query.WorkMode?.Trim().ToLowerInvariant();
            var minSal = query.MinSalary ?? 0;
            var maxSal = query.MaxSalary ?? 0;

            return samples.Where(j =>
            {
                if (!string.IsNullOrWhiteSpace(kw))
                {
                    var matchTitle = j.Title.ToLowerInvariant().Contains(kw);
                    var matchCompany = j.CompanyName.ToLowerInvariant().Contains(kw);
                    var matchSkills = j.Skills.Any(s => s.ToLowerInvariant().Contains(kw));
                    var matchDesc = j.Description.ToLowerInvariant().Contains(kw);
                    if (!matchTitle && !matchCompany && !matchSkills && !matchDesc) return false;
                }

                if (!string.IsNullOrWhiteSpace(loc))
                {
                    if (loc == "hanoi" && !j.Location.Contains("Hà Nội")) return false;
                    if (loc == "hcm" && !j.Location.Contains("TP. HCM")) return false;
                    if (loc == "danang" && !j.Location.Contains("Đà Nẵng")) return false;
                    if (loc == "remote" && j.WorkMode != "Remote") return false;
                }

                if (!string.IsNullOrWhiteSpace(cat) && !cat.Equals("all", StringComparison.OrdinalIgnoreCase))
                {
                    var jCat = MapCategory(j.Title, j.Skills);
                    if (!string.Equals(jCat, cat, StringComparison.OrdinalIgnoreCase)) return false;
                }

                if (!string.IsNullOrWhiteSpace(type) && !type.Equals("all", StringComparison.OrdinalIgnoreCase))
                {
                    if (!j.EmploymentType.Equals(type, StringComparison.OrdinalIgnoreCase) && !(type == "remote" && j.WorkMode == "Remote"))
                        return false;
                }

                if (!string.IsNullOrWhiteSpace(workMode) && !workMode.Equals("all", StringComparison.OrdinalIgnoreCase))
                {
                    if (!string.Equals(j.WorkMode, workMode, StringComparison.OrdinalIgnoreCase)) return false;
                }

                if (!string.IsNullOrWhiteSpace(exp) && !exp.Equals("any", StringComparison.OrdinalIgnoreCase))
                {
                    if (!string.Equals(j.ExperienceLevel, exp, StringComparison.OrdinalIgnoreCase)) return false;
                }

                if (minSal > 0 && (j.SalaryMax ?? j.SalaryMin ?? 0) < minSal)
                {
                    return false;
                }

                if (maxSal > 0 && (j.SalaryMin ?? j.SalaryMax ?? 0) > maxSal)
                {
                    return false;
                }

                return true;
            }).ToList();
        }

        private static string MapCategory(string title, List<string> skills)
        {
            var t = title.ToLowerInvariant();
            var s = string.Join(" ", skills).ToLowerInvariant();
            var combined = $"{t} {s}";

            if (combined.Contains("business analyst") || t.Contains("ba")) return "business";
            if (combined.Contains("finance") || combined.Contains("tài chính") || combined.Contains("fp&a") || combined.Contains("kế toán") || combined.Contains("ngân hàng")) return "finance";
            if (combined.Contains("sales") || combined.Contains("bán hàng") || combined.Contains("account executive") || combined.Contains("kinh doanh") || combined.Contains("telesales")) return "sales";
            if (combined.Contains("marketing") || combined.Contains("truyền thông") || combined.Contains("digital marketing") || combined.Contains("seo") || combined.Contains("content")) return "marketing";
            if (combined.Contains("hr") || combined.Contains("nhân sự") || combined.Contains("talent") || combined.Contains("tuyển dụng") || combined.Contains("pháp chế")) return "hr";
            if (combined.Contains("supply chain") || combined.Contains("logistics") || combined.Contains("operations") || combined.Contains("vận hành") || combined.Contains("kho vận")) return "operations";
            if (combined.Contains("designer") || combined.Contains("ui/ux") || combined.Contains("thiết kế") || combined.Contains("graphic")) return "design";
            if (combined.Contains("data") || combined.Contains("analytics") || combined.Contains("ai") || combined.Contains("dữ liệu") || combined.Contains("powerbi")) return "data";
            if (combined.Contains("product manager") || combined.Contains("tpm") || combined.Contains("project manager") || combined.Contains("quản lý dự án")) return "pm";
            if (combined.Contains("cơ khí") || combined.Contains("điện tử") || combined.Contains("sản xuất") || combined.Contains("chế tạo") || combined.Contains("engineering")) return "engineering";
            if (combined.Contains("chăm sóc khách hàng") || combined.Contains("customer service") || combined.Contains("hỗ trợ khách hàng") || combined.Contains("cskh")) return "customer-service";
            if (combined.Contains("giáo viên") || combined.Contains("giảng viên") || combined.Contains("đào tạo") || combined.Contains("education")) return "education";
            if (combined.Contains("bác sĩ") || combined.Contains("dược sĩ") || combined.Contains("y tế") || combined.Contains("điều dưỡng") || combined.Contains("healthcare")) return "healthcare";
            if (combined.Contains("xây dựng") || combined.Contains("bất động sản") || combined.Contains("kiến trúc") || combined.Contains("construction")) return "construction";
            if (combined.Contains("nhà hàng") || combined.Contains("khách sạn") || combined.Contains("bán lẻ") || combined.Contains("hospitality") || combined.Contains("retail") || combined.Contains("f&b")) return "hospitality";
            return "tech";
        }

        private static List<JobPostingDto> GetBenchmarkSampleCatalog()
        {
            return new List<JobPostingDto>
            {
                new JobPostingDto
                {
                    Id = "sample_10",
                    Title = "Senior Business Analyst",
                    CompanyName = "Viettel Telecom",
                    CompanyLogo = "V",
                    Location = "Hà Nội",
                    SalaryMin = 1800,
                    SalaryMax = 3200,
                    SalaryCurrency = "USD",
                    EmploymentType = "Full-time",
                    WorkMode = "On-site",
                    ExperienceLevel = "3-5",
                    Description = "Phân tích quy trình kinh doanh và làm cầu nối nghiệp vụ giữa khối viễn thông số và đội ngũ kỹ thuật sản phẩm.",
                    Skills = new List<string> { "BPMN", "User Stories", "Requirement Engineering", "SQL", "Stakeholder Management" },
                    PostedDays = 1,
                    SourceName = "Dữ liệu mẫu PrepMate",
                    SourceKey = "topcv",
                    ApplyUrl = "https://www.topcv.vn/tim-viec-lam?keyword=Business+Analyst",
                    IsSample = true,
                    Featured = true,
                    MatchScore = 96
                },
                new JobPostingDto
                {
                    Id = "sample_11",
                    Title = "Financial Planning & Analysis (FP&A) Lead",
                    CompanyName = "Masan Group",
                    CompanyLogo = "M",
                    Location = "TP. HCM",
                    SalaryMin = 2200,
                    SalaryMax = 3800,
                    SalaryCurrency = "USD",
                    EmploymentType = "Full-time",
                    WorkMode = "On-site",
                    ExperienceLevel = "3-5",
                    Description = "Chịu trách nhiệm mô hình hóa tài chính, dự báo dòng tiền và phân tích hiệu quả vốn đầu tư cho chuỗi bán lẻ toàn quốc.",
                    Skills = new List<string> { "Financial Modeling", "OPEX Forecast", "Cash Flow Analysis", "Budget Planning", "PowerBI" },
                    PostedDays = 3,
                    SourceName = "Dữ liệu mẫu PrepMate",
                    SourceKey = "linkedin",
                    ApplyUrl = "https://www.linkedin.com/jobs/search/?keywords=FP%26A",
                    IsSample = true,
                    Featured = true,
                    MatchScore = 92
                },
                new JobPostingDto
                {
                    Id = "sample_12",
                    Title = "B2B Enterprise Account Executive",
                    CompanyName = "Base.vn",
                    CompanyLogo = "B",
                    Location = "Hà Nội",
                    SalaryMin = 1000,
                    SalaryMax = 2500,
                    SalaryCurrency = "USD",
                    EmploymentType = "Full-time",
                    WorkMode = "On-site",
                    ExperienceLevel = "1-2",
                    Description = "Tư vấn chuyển đổi số và phát triển tệp khách hàng doanh nghiệp quy mô lớn cho hệ sinh thái quản trị Base Platform.",
                    Skills = new List<string> { "Consultative Selling", "SaaS", "B2B Sales", "Negotiation", "CRM Pipelines" },
                    PostedDays = 4,
                    SourceName = "Dữ liệu mẫu PrepMate",
                    SourceKey = "topcv",
                    ApplyUrl = "https://www.topcv.vn/tim-viec-lam?keyword=Account+Executive",
                    IsSample = true,
                    Featured = false,
                    MatchScore = 89
                },
                new JobPostingDto
                {
                    Id = "sample_13",
                    Title = "HR Business Partner (HRBP)",
                    CompanyName = "Samsung Electronics",
                    CompanyLogo = "S",
                    Location = "Hà Nội",
                    SalaryMin = 1600,
                    SalaryMax = 2800,
                    SalaryCurrency = "USD",
                    EmploymentType = "Full-time",
                    WorkMode = "On-site",
                    ExperienceLevel = "3-5",
                    Description = "Đồng hành cùng lãnh đạo khối R&D về hoạch định nhân sự, phát triển năng lực đội ngũ và tối ưu môi trường làm việc.",
                    Skills = new List<string> { "Talent Strategy", "Employee Relations", "Performance Management", "Labor Law", "Culture" },
                    PostedDays = 2,
                    SourceName = "Dữ liệu mẫu PrepMate",
                    SourceKey = "linkedin",
                    ApplyUrl = "https://www.linkedin.com/jobs/search/?keywords=HRBP",
                    IsSample = true,
                    Featured = false,
                    MatchScore = 90
                },
                new JobPostingDto
                {
                    Id = "sample_14",
                    Title = "Supply Chain & Operations Specialist",
                    CompanyName = "Unilever Vietnam",
                    CompanyLogo = "U",
                    Location = "TP. HCM",
                    SalaryMin = 1200,
                    SalaryMax = 2200,
                    SalaryCurrency = "USD",
                    EmploymentType = "Full-time",
                    WorkMode = "On-site",
                    ExperienceLevel = "1-2",
                    Description = "Quản lý chuỗi cung ứng đầu cuối, tối ưu hóa mức tồn kho an toàn và nâng cao độ chính xác trong dự báo nhu cầu thị trường.",
                    Skills = new List<string> { "Demand Planning", "Logistics", "Inventory Control", "SAP ERP", "Process Optimization" },
                    PostedDays = 5,
                    SourceName = "Dữ liệu mẫu PrepMate",
                    SourceKey = "itviec",
                    ApplyUrl = "https://careerviet.vn/tim-viec-lam?keywords=Supply+Chain",
                    IsSample = true,
                    Featured = false,
                    MatchScore = 85
                },
                new JobPostingDto
                {
                    Id = "sample_15",
                    Title = "Senior Brand & Growth Marketing Manager",
                    CompanyName = "Vinamilk",
                    CompanyLogo = "V",
                    Location = "TP. HCM",
                    SalaryMin = 1800,
                    SalaryMax = 3200,
                    SalaryCurrency = "USD",
                    EmploymentType = "Full-time",
                    WorkMode = "On-site",
                    ExperienceLevel = "3-5",
                    Description = "Xây dựng chiến lược thương hiệu, hoạch định chiến dịch truyền thông đa kênh và tối ưu hóa hiệu quả tăng trưởng thị phần toàn quốc.",
                    Skills = new List<string> { "Brand Strategy", "Digital Marketing", "Growth Hacking", "Performance Ads", "Campaign Management" },
                    PostedDays = 2,
                    SourceName = "Dữ liệu mẫu PrepMate",
                    SourceKey = "topcv",
                    ApplyUrl = "https://www.topcv.vn/tim-viec-lam?keyword=Brand+Marketing",
                    IsSample = true,
                    Featured = true,
                    MatchScore = 94
                },
                new JobPostingDto
                {
                    Id = "sample_1",
                    Title = "Senior Frontend Developer (React/Next.js)",
                    CompanyName = "VNG Corporation",
                    CompanyLogo = "V",
                    Location = "TP. HCM",
                    SalaryMin = 2000,
                    SalaryMax = 3500,
                    SalaryCurrency = "USD",
                    EmploymentType = "Full-time",
                    WorkMode = "On-site",
                    ExperienceLevel = "3-5",
                    Description = "Phát triển và tối ưu giao diện người dùng cho nền tảng giải trí và gaming với hàng chục triệu người dùng hoạt động hàng ngày.",
                    Skills = new List<string> { "React", "TypeScript", "Next.js", "Redux Toolkit", "Performance" },
                    PostedDays = 2,
                    SourceName = "Dữ liệu mẫu PrepMate",
                    SourceKey = "topcv",
                    ApplyUrl = "https://www.topcv.vn/tim-viec-lam?keyword=Frontend",
                    IsSample = true,
                    Featured = true,
                    MatchScore = 95
                },
                new JobPostingDto
                {
                    Id = "sample_2",
                    Title = "Full Stack Engineer (.NET 8 + React)",
                    CompanyName = "FPT Software",
                    CompanyLogo = "F",
                    Location = "Hà Nội",
                    SalaryMin = 1800,
                    SalaryMax = 3000,
                    SalaryCurrency = "USD",
                    EmploymentType = "Full-time",
                    WorkMode = "On-site",
                    ExperienceLevel = "3-5",
                    Description = "Tham gia thiết kế kiến trúc và phát triển hệ thống Enterprise quy mô lớn cho các đối tác tài chính & viễn thông quốc tế.",
                    Skills = new List<string> { ".NET 8", "C#", "React", "SQL Server", "Azure", "Microservices" },
                    PostedDays = 1,
                    SourceName = "Dữ liệu mẫu PrepMate",
                    SourceKey = "linkedin",
                    ApplyUrl = "https://www.linkedin.com/jobs/search/?keywords=Full+Stack",
                    IsSample = true,
                    Featured = true,
                    MatchScore = 91
                },
                new JobPostingDto
                {
                    Id = "sample_3",
                    Title = "Product UI/UX Designer",
                    CompanyName = "Tiki Corporation",
                    CompanyLogo = "T",
                    Location = "TP. HCM",
                    SalaryMin = 1200,
                    SalaryMax = 2200,
                    SalaryCurrency = "USD",
                    EmploymentType = "Full-time",
                    WorkMode = "On-site",
                    ExperienceLevel = "1-2",
                    Description = "Thiết kế trải nghiệm mua sắm mượt mà trên Mobile App & Web E-commerce, tối ưu tỷ lệ chuyển đổi cho 20 triệu người dùng.",
                    Skills = new List<string> { "Figma", "User Research", "Design System", "Usability Testing" },
                    PostedDays = 5,
                    SourceName = "Dữ liệu mẫu PrepMate",
                    SourceKey = "topcv",
                    ApplyUrl = "https://www.topcv.vn/tim-viec-lam?keyword=UI%2FUX",
                    IsSample = true,
                    Featured = false,
                    MatchScore = 84
                },
                new JobPostingDto
                {
                    Id = "sample_4",
                    Title = "Backend Engineer (Python / FastAPI / Cloud)",
                    CompanyName = "Sky Mavis",
                    CompanyLogo = "S",
                    Location = "Remote",
                    SalaryMin = 3000,
                    SalaryMax = 5000,
                    SalaryCurrency = "USD",
                    EmploymentType = "Remote",
                    WorkMode = "Remote",
                    ExperienceLevel = "3-5",
                    Description = "Xây dựng dịch vụ backend hiệu năng cao, chịu tải hàng triệu giao dịch tức thời mỗi ngày với độ trễ cực thấp.",
                    Skills = new List<string> { "Python", "FastAPI", "PostgreSQL", "Redis", "AWS", "Docker" },
                    PostedDays = 3,
                    SourceName = "Dữ liệu mẫu PrepMate",
                    SourceKey = "linkedin",
                    ApplyUrl = "https://www.linkedin.com/jobs/search/?keywords=Backend+Python",
                    IsSample = true,
                    Featured = false,
                    MatchScore = 88
                },
                new JobPostingDto
                {
                    Id = "sample_5",
                    Title = "Data Platform Engineer",
                    CompanyName = "MoMo E-Wallet",
                    CompanyLogo = "M",
                    Location = "TP. HCM",
                    SalaryMin = 1500,
                    SalaryMax = 2800,
                    SalaryCurrency = "USD",
                    EmploymentType = "Full-time",
                    WorkMode = "On-site",
                    ExperienceLevel = "1-2",
                    Description = "Vận hành Data Lakehouse và phát triển các streaming pipelines phục vụ tính năng phân tích giao dịch thanh toán theo thời gian thực.",
                    Skills = new List<string> { "Python", "Apache Spark", "Kafka", "Airflow", "BigQuery" },
                    PostedDays = 7,
                    SourceName = "Dữ liệu mẫu PrepMate",
                    SourceKey = "itviec",
                    ApplyUrl = "https://itviec.com/it-jobs?query=Data+Engineer",
                    IsSample = true,
                    Featured = false,
                    MatchScore = 79
                }
            };
        }
    }
}
